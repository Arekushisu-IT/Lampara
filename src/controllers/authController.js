const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db'); 

// ==========================================
// ADMIN & STAFF LOGIN
// ==========================================
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [users] = await pool.query('SELECT * FROM Admin_User WHERE email = ?', [email]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = users[0];
    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, av: '#7c5c1a', ac: '#d4af37', ini: user.name.charAt(0).toUpperCase() }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// ==========================================
// UNITY PLAYER LOGIN
// ==========================================
const playerLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and Password are required' });

    const [players] = await pool.query('SELECT * FROM players WHERE username = ?', [username]);
    if (players.length === 0) return res.status(401).json({ error: 'Player account not found.' });

    const player = players[0];
    const passwordMatch = await bcryptjs.compare(password, player.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid Username or Password.' });

    if (player.status === 'banned' || player.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    const token = jwt.sign(
      { id: player.id, username: player.username, role: 'player' },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '30d' }
    );

    // Turn them ONLINE
    await pool.query('UPDATE players SET last_login = CURRENT_TIMESTAMP, is_online = true WHERE id = ?', [player.id]);

    return res.json({
      message: 'Login successful',
      token,
      player: { id: player.id, name: player.name, username: player.username, school: player.school, level: player.level, experience: player.experience, status: player.status }
    });
  } catch (err) {
    console.error('Player login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// ==========================================
// UNITY PLAYER LOGOUT
// ==========================================
const playerLogout = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Player ID required' });

    // Turn them OFFLINE safely
    await pool.query('UPDATE players SET is_online = false WHERE id = ?', [id]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// ==========================================
// GET CURRENT USER / PLAYER (Using Token)
// ==========================================
const getMe = async (req, res) => {
  try {
    if (req.user.role === 'player') {
      const [players] = await pool.query('SELECT id, username, name, school, level, experience, status FROM players WHERE id = ?', [req.user.id]);
      if (players.length === 0) return res.status(401).json({ error: 'Player not found' });
      return res.json({ user: players[0] });
    } else {
      const [users] = await pool.query('SELECT id, email, name, role, status FROM Admin_User WHERE id = ?', [req.user.id]);
      if (users.length === 0) return res.status(401).json({ error: 'User not found' });
      const user = users[0];
      return res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, av: '#7c5c1a', ac: '#d4af37', ini: user.name.charAt(0).toUpperCase() } });
    }
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// ==========================================
// ADMIN REGISTER
// ==========================================
const adminRegister = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });

    const hashedPassword = await bcryptjs.hash(password, 10);
    await pool.query('INSERT INTO Admin_User (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)', [email, hashedPassword, name, role || 'staff', 'active']);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Registration failed' });
  }
};

// ==========================================
// UNITY PLAYER REGISTER
// ==========================================
const playerRegister = async (req, res) => {
  try {
    const { name, username, password, school } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'Name, Username, and Password are required' });

    const [existing] = await pool.query('SELECT id FROM players WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username is already registered.' });

    const hashedPassword = await bcryptjs.hash(password, 10);
    
    // CHANGED: Status defaults to "pending" so admins must approve them
    await pool.query('INSERT INTO players (name, username, password, school, level, experience, status, chapter, suspicion) VALUES (?, ?, ?, ?, 1, 0, "pending", 1, 0)', [name, username, hashedPassword, school || null]);
    
    res.status(201).json({ message: 'Registration submitted! Waiting for approval.' });
  } catch (err) {
    console.error('Player registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// ==========================================
// ADMIN: UPDATE PLAYER STATUS
// ==========================================
const updatePlayerStatus = async (req, res) => {
  try {
    const { id, status } = req.body; 

    if (!id || !status) {
      return res.status(400).json({ error: 'Player ID and new status are required' });
    }

    // Update the database
    await pool.query('UPDATE players SET status = ? WHERE id = ?', [status, id]);

    // Extra Security: Force offline if suspended
    if (status === 'suspended') {
      await pool.query('UPDATE players SET is_online = false WHERE id = ?', [id]);
    }

    res.json({ message: `Player successfully marked as ${status}` });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update player status' });
  }
};

module.exports = { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, updatePlayerStatus };