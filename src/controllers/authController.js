const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client("351853811252-b88at4b83vljbvo2f7nqaikb13qjater.apps.googleusercontent.com");
const crypto     = require('crypto');    
const nodemailer = require('nodemailer')

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db'); 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.MAIL_PASSWORD
  }
});

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
      player: { id: player.id, name: player.name, username: player.username, email: player.email, level: player.level, experience: player.experience, status: player.status }
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
      const [players] = await pool.query('SELECT id, username, name, email, level, experience, status FROM players WHERE id = ?', [req.user.id]);
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
    const { name, username, password, email } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, Username, and Password are required' });
    }

    // Check if username is taken
    const [existing] = await pool.query(
      'SELECT id FROM players WHERE username = ?', [username]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username is already registered.' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    // Generate token + 24hr expiry
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Insert player as inactive with token
    await pool.query(
      `INSERT INTO players 
       (name, username, password, email, level, experience, status, chapter, suspicion, verify_token, token_expires_at)
       VALUES (?, ?, ?, ?, 1, 0, 'inactive', 1, 0, ?, ?)`,
      [name, username, hashedPassword, email || null, token, expiresAt]
    );

    // Send verification email if email provided
    if (email) {
      const verifyUrl = `${process.env.FRONTEND_URL}/verify.html?token=${token}`;

      await transporter.sendMail({
        from: `"LAMPARA Archive" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '⚜ Verify Your Lampara Account',
        html: `
          <div style="font-family:Georgia,serif;background:#0a0805;color:#e8dcc8;padding:40px;max-width:500px;margin:0 auto;border:1px solid #3d2d14;border-radius:8px;">
            <h2 style="color:#e8b84b;letter-spacing:6px;font-size:24px;">⚜ LAMPARA</h2>
            <p style="font-size:16px;">Welcome, <strong>${name}</strong>.</p>
            <p style="color:#a89070;line-height:1.8;">Click the button below to verify your account and start playing.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${verifyUrl}" 
                 style="background:rgba(201,149,58,.2);border:1px solid #7a5820;border-radius:5px;color:#e8b84b;padding:14px 32px;text-decoration:none;font-size:13px;letter-spacing:2px;">
                ⚜ VERIFY ACCOUNT
              </a>
            </div>
            <p style="font-size:11px;color:#6b5740;">This link expires in 24 hours.<br>STI College General Santos · BSIT Capstone 2026</p>
          </div>
        `
      });
    }

    res.status(201).json({ 
      message: 'Registration submitted! Please check your email to verify your account.' 
    });

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

    await pool.query('UPDATE players SET status = ? WHERE id = ?', [status, id]);

    if (status === 'suspended') {
      await pool.query('UPDATE players SET is_online = false WHERE id = ?', [id]);
    }

    res.json({ message: `Player successfully marked as ${status}` });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update player status' });
  }
};

// ==========================================
// CHECK IF USERNAME IS TAKEN
// ==========================================
const checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    
    const [existing] = await pool.query('SELECT id FROM players WHERE username = ?', [username]);
    
    if (existing.length > 0) {
      return res.json({ available: false, message: 'Username is already taken' });
    }
    
    return res.json({ available: true, message: 'Username is available' });
  } catch (err) {
    console.error('Username check error:', err);
    res.status(500).json({ error: 'Failed to check username' });
  }
};

// ==========================================
// GOOGLE LOGIN LOGIC (NEW & FIXED)
// ==========================================
const googleLogin = async (req, res) => {
    const { idToken } = req.body;

    try {
        // 1. Verify token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: "351853811252-b88at4b83vljbvo2f7nqaikb13qjater.apps.googleusercontent.com",
        });
        
        const payload = ticket.getPayload();
        const { email, name } = payload; 

        // 2. Check Database using pool.query
        const [results] = await pool.query('SELECT * FROM players WHERE email = ?', [email]);

        if (results.length > 0) {
            // USER EXISTS
            const player = results[0];
            
            // Auto-activate them if they were inactive
            if (player.status !== 'active') {
                await pool.query('UPDATE players SET status = "active" WHERE id = ?', [player.id]);
                player.status = 'active';
            }

            // Log them in
            const token = jwt.sign(
              { id: player.id, username: player.username, role: 'player' }, 
              process.env.JWT_SECRET || 'dev-secret-key', 
              { expiresIn: '30d' }
            );
            
            await pool.query('UPDATE players SET last_login = CURRENT_TIMESTAMP, is_online = true WHERE id = ?', [player.id]);

            return res.status(200).json({ message: "Google Login successful", token, player });
        } else {
            // NEW USER! Auto-register them
            const baseUsername = email.split('@')[0];
            const dummyPassword = "[GOOGLE_ACCOUNT]"; 

            // Insert matching your exact database columns
            const [insertResult] = await pool.query(
                'INSERT INTO players (name, username, email, password, level, experience, status, chapter, suspicion) VALUES (?, ?, ?, ?, 1, 0, "active", 1, 0)',
                [name, baseUsername, email, dummyPassword]
            );

            // Fetch newly created player
            const [newResults] = await pool.query('SELECT * FROM players WHERE id = ?', [insertResult.insertId]);
            const newPlayer = newResults[0];

            const token = jwt.sign(
              { id: newPlayer.id, username: newPlayer.username, role: 'player' }, 
              process.env.JWT_SECRET || 'dev-secret-key', 
              { expiresIn: '30d' }
            );
            
            await pool.query('UPDATE players SET last_login = CURRENT_TIMESTAMP, is_online = true WHERE id = ?', [newPlayer.id]);

            return res.status(200).json({ message: "Google Registration successful", token, player: newPlayer });
        }
    } catch (error) {
        console.error("Google Token Verification Failed:", error);
        res.status(401).json({ message: "Invalid Google Token" });
    }
};
// ==========================================
// VERIFY PLAYER EMAIL
// ==========================================
const verifyPlayer = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, status, token_expires_at FROM players WHERE verify_token = ?',
      [token]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Invalid token' });
    if (rows[0].status === 'active') return res.status(409).json({ error: 'Already verified' });
    if (new Date() > new Date(rows[0].token_expires_at)) return res.status(410).json({ error: 'Link expired' });

    await pool.query(
      'UPDATE players SET status = "active", verify_token = NULL, token_expires_at = NULL WHERE id = ?',
      [rows[0].id]
    );

    res.json({ 
      message: 'Verified!', 
      user: { name: rows[0].name, email: rows[0].email } 
    });

  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};
// ==========================================
// CHECK PLAYER VERIFICATION STATUS
// ==========================================
const checkStatus = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Player ID required' });

    const [rows] = await pool.query(
      'SELECT status FROM players WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    res.json({ status: rows[0].status });
  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
};
// ==========================================
// EXPORT ALL FUNCTIONS AT THE VERY END
// ==========================================
module.exports = { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, updatePlayerStatus, checkUsername, googleLogin, verifyPlayer };