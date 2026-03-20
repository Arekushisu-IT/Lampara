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
    // Conditional verbose logging for debugging (set AUTH_VERBOSE_LOG=true in env)
    const authVerbose = String(process.env.AUTH_VERBOSE_LOG || '').toLowerCase() === 'true';
    if (authVerbose) {
      const masked = Object.assign({}, req.body);
      if (masked.password) masked.password = `[REDACTED length=${String(masked.password).length}]`;
      console.log('[AUTH] Incoming request:', req.method, req.originalUrl);
      console.log('[AUTH] Payload:', masked);
      console.log('[AUTH] Remote IP:', req.headers['x-forwarded-for'] || req.ip || req.connection && req.connection.remoteAddress);
      console.log('[AUTH] UA:', req.headers['user-agent'] || 'n/a');
    }
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Query user (UPDATED TO Admin_User)
    const [users] = await pool.query('SELECT * FROM Admin_User WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Ensure user has a stored password hash before comparing
    if (!user.password) {
      console.error('User record missing password hash for id', user.id);
      return res.status(500).json({ error: 'Login failed' });
    }

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
    const authVerbose = String(process.env.AUTH_VERBOSE_LOG || '').toLowerCase() === 'true';
    if (authVerbose) {
      const masked = Object.assign({}, req.body);
      if (masked.password) masked.password = `[REDACTED length=${String(masked.password).length}]`;
      console.log('[AUTH] Incoming request:', req.method, req.originalUrl);
      console.log('[AUTH] Payload:', masked);
      console.log('[AUTH] Remote IP:', req.headers['x-forwarded-for'] || req.ip || req.connection && req.connection.remoteAddress);
      console.log('[AUTH] UA:', req.headers['user-agent'] || 'n/a');
    }
    const { username, password } = req.body; // Changed from email to username

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
      { expiresIn: '30d' } // Players stay logged in for 30 days
    );

    // Update their last_login timestamp in the database
    await pool.query('UPDATE players SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [player.id]);

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

    // Check if it's a player or an admin asking for their profile
    if (decoded.role === 'player') {
      // Updated query to fetch username and school instead of email
      const [players] = await pool.query('SELECT id, username, name, school, level, experience, status FROM players WHERE id = ?', [decoded.id]);
      if (players.length === 0) return res.status(401).json({ error: 'Player not found' });
      return res.json({ user: players[0] });
    } else {
      // Query user (UPDATED TO Admin_User)
      const [users] = await pool.query('SELECT id, email, name, role, status FROM Admin_User WHERE id = ?', [decoded.id]);
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

    // Insert user (UPDATED TO Admin_User)
    await pool.query(
      'INSERT INTO Admin_User (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)',
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

    // 1. Check if this username/student ID is already registered
    const [existing] = await pool.query('SELECT id FROM players WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This Username is already registered.' });
    }

    // 2. Hash the password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // 3. Insert the new player with an "inactive" status (Pending Approval)
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

// module.exports must ALWAYS be at the very bottom!
module.exports = router;