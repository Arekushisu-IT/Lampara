const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

/**
 * POST /api/auth/login
 * (For Admins and Staff - Requires Email & Password)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Query user
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Compare password
    const passwordMatch = await bcryptjs.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        av: '#7c5c1a',
        ac: '#d4af37',
        ini: user.name.charAt(0).toUpperCase()
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/player-login
 * (For Unity Game - Requires Username and Password)
 */
router.post('/player-login', async (req, res) => {
  try {
    const { username, password } = req.body; 

    if (!username || !password) {
      return res.status(400).json({ error: 'Username (Student ID) and Password are required' });
    }

    // Check if player exists in the players table
    const [players] = await pool.query('SELECT * FROM players WHERE username = ?', [username]);

    if (players.length === 0) {
      return res.status(401).json({ error: 'Player account not found. Please ask your teacher to register you.' });
    }

    const player = players[0];

    // Verify Password using bcrypt
    const passwordMatch = await bcryptjs.compare(password, player.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid Username or Password.' });
    }

    // 1. Block PENDING (inactive) players from entering
    if (player.status === 'inactive' || player.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending. Please wait for your teacher to approve it.' });
    }

    // 2. Block SUSPENDED/BANNED players
    if (player.status === 'banned' || player.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please see your teacher.' });
    }

    // Generate JWT for the player
    const token = jwt.sign(
      { id: player.id, username: player.username, role: 'player' },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '30d' } 
    );

    // ✨ THE ONLINE SWITCH ✨
    // Update last_login timestamp AND set them to online!
    await pool.query('UPDATE players SET last_login = CURRENT_TIMESTAMP, is_online = true WHERE id = ?', [player.id]);

    return res.json({
      message: 'Login successful',
      token,
      player: {
        id: player.id,
        name: player.name,
        username: player.username,
        school: player.school,
        level: player.level,
        experience: player.experience,
        status: player.status
      }
    });
  } catch (err) {
    console.error('Player login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');

    if (decoded.role === 'player') {
      const [players] = await pool.query('SELECT id, username, name, school, level, experience, status FROM players WHERE id = ?', [decoded.id]);
      if (players.length === 0) return res.status(401).json({ error: 'Player not found' });
      return res.json({ user: players[0] });
    } else {
      const [users] = await pool.query('SELECT id, email, name, role, status FROM users WHERE id = ?', [decoded.id]);
      if (users.length === 0) return res.status(401).json({ error: 'User not found' });
      
      const user = users[0];
      return res.json({
        user: {
          id: user.id, email: user.email, name: user.name, role: user.role, status: user.status,
          av: '#7c5c1a', ac: '#d4af37', ini: user.name.charAt(0).toUpperCase()
        }
      });
    }
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

/**
 * POST /api/auth/register
 * (For Admins and Staff)
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    await pool.query(
      'INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name, role || 'staff', 'active']
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/player-register
 * (For Unity Game - Students applying for an account)
 */
router.post('/player-register', async (req, res) => {
  try {
    const { name, username, password, school } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, Username, and Password are required' });
    }

    const [existing] = await pool.query('SELECT id FROM players WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This Username is already registered.' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    // Keep "inactive" here because it means "Waiting for teacher approval"
    await pool.query(
      'INSERT INTO players (name, username, password, school, level, experience, status) VALUES (?, ?, ?, ?, 1, 0, "inactive")',
      [name, username, hashedPassword, school || null]
    );

    res.status(201).json({ message: 'Registration submitted! Please wait for your teacher to approve it.' });
  } catch (err) {
    console.error('Player registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/player-logout
 * ✨ NEW: The safe way to log out!
 */
router.post('/player-logout', async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Player ID required' });
    }

    // Only switch "is_online" to false. Do NOT touch their approval status!
    await pool.query('UPDATE players SET is_online = false WHERE id = ?', [id]);
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// module.exports must ALWAYS be at the very bottom!
module.exports = router;