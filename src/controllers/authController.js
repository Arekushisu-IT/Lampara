const crypto = require('crypto');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db');

/**
 * Send an email via Google Apps Script webhook.
 * This bypasses Railway's SMTP port block by using HTTPS (port 443).
 */
async function sendEmailViaWebhook(to, subject, html) {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('EMAIL_WEBHOOK_URL is not set in environment variables!');
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, html }),
    redirect: 'follow' // Google Apps Script redirects on POST
  });

  if (!response.ok) {
    throw new Error(`Webhook responded with status ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Webhook email failed');
  }

  console.log(`Verification email sent to ${to} via webhook`);
}

// ==========================================
// ADMIN & STAFF LOGIN
// ==========================================
const adminLogin = async (req, res, next) => {
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
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, av: '#7c5c1a', ac: '#d4af37', ini: user.name.charAt(0).toUpperCase() }
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// UNITY PLAYER LOGIN
// ==========================================
const playerLogin = async (req, res, next) => {
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
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Turn them ONLINE
    await pool.query('UPDATE players SET last_login = CURRENT_TIMESTAMP, is_online = true WHERE id = ?', [player.id]);

    return res.json({
      message: 'Login successful',
      token,
      player: {
        id: player.id, name: player.name, username: player.username, email: player.email,
        level: player.level, experience: player.experience, status: player.status,
        has_completed_tutorial: !!player.has_completed_tutorial,
        current_main_quest: player.current_quest_id,
        current_sub_quest: player.current_sub_quest,
        chapter: player.chapter
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// UNITY PLAYER LOGOUT
// ==========================================
const playerLogout = async (req, res, next) => {
  try {
    // Use the authenticated user's ID from JWT (more secure than trusting req.body)
    const id = req.user.id;

    // Turn them OFFLINE safely
    await pool.query('UPDATE players SET is_online = false WHERE id = ?', [id]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// GET CURRENT USER / PLAYER (Using Token)
// ==========================================
const getMe = async (req, res, next) => {
  try {
    if (req.user.role === 'player') {
      const [players] = await pool.query('SELECT id, username, name, email, level, experience, status, has_completed_tutorial, current_quest_id, current_sub_quest, chapter FROM players WHERE id = ?', [req.user.id]);
      if (players.length === 0) return res.status(401).json({ error: 'Player not found' });

      const player = players[0];
      return res.json({
        user: {
          id: player.id, name: player.name, username: player.username, email: player.email,
          level: player.level, experience: player.experience, status: player.status,
          has_completed_tutorial: !!player.has_completed_tutorial,
          current_main_quest: player.current_quest_id,
          current_sub_quest: player.current_sub_quest,
          chapter: player.chapter
        }
      });
    } else {
      const [users] = await pool.query('SELECT id, email, name, role, status FROM Admin_User WHERE id = ?', [req.user.id]);
      if (users.length === 0) return res.status(401).json({ error: 'User not found' });
      const user = users[0];
      return res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, av: '#7c5c1a', ac: '#d4af37', ini: user.name.charAt(0).toUpperCase() } });
    }
  } catch (err) {
    next(err);
  }
};

// ==========================================
// ADMIN REGISTER (Always creates 'admin' role)
// ==========================================
const adminRegister = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });

    const hashedPassword = await bcryptjs.hash(password, 10);
    await pool.query('INSERT INTO Admin_User (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)', [email, hashedPassword, name, 'admin', 'active']);
    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    next(err);
  }
};

// ==========================================
// UNITY PLAYER REGISTER
// ==========================================
const playerRegister = async (req, res, next) => {
  try {
    const { name, username, password, email, birthdate } = req.body;
    if (!name || !username || !password || !birthdate || !email) {
      return res.status(400).json({ error: 'Name, Username, Password, Email, and Birthdate are required' });
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
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Insert player as inactive with token
    await pool.query(
      `INSERT INTO players
       (name, username, password, email, birthdate, level, experience, status, chapter, suspicion, verify_token, token_expires_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, 'inactive', 1, 0, ?, ?)`,
      [name, username, hashedPassword, email || null, birthdate, token, expiresAt]
    );

    // Send verification email if email provided
    if (email) {
      try {
        const verifyUrl = `${process.env.FRONTEND_URL}/verify.html?token=${token}`;

        const emailHtml = `
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
        `;

        // Send in background so Unity doesn't freeze
        sendEmailViaWebhook(email, '⚜ Verify Your Lampara Account', emailHtml)
          .catch(err => console.error('CRITICAL: Player saved to DB, but Email failed:', err));
      } catch (err) {
        console.error('Email configuration error:', err);
      }
    }

    res.status(201).json({
      message: 'Registration submitted! Please check your email to verify your account.'
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// CHECK IF USERNAME IS TAKEN
// ==========================================
const checkUsername = async (req, res, next) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const [existing] = await pool.query('SELECT id FROM players WHERE username = ?', [username]);

    if (existing.length > 0) {
      return res.json({ available: false, message: 'Username is already taken' });
    }

    return res.json({ available: true, message: 'Username is available' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// VERIFY PLAYER EMAIL
// ==========================================
const verifyPlayer = async (req, res, next) => {
  const { token } = req.body;

  console.log('🔐 [VERIFY] Request received');
  console.log('🔐 [VERIFY] Token present:', !!token);
  if (token) {
    console.log('🔐 [VERIFY] Token length:', token.length);
    console.log('🔐 [VERIFY] Token preview:', token.substring(0, 20) + '...');
  }

  if (!token) {
    console.warn('❌ [VERIFY] No token provided in request body');
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    // Find player by verification token
    console.log('🔍 [VERIFY] Querying database for token...');
    const [rows] = await pool.query(
      'SELECT id, name, email, status, token_expires_at FROM players WHERE verify_token = ?',
      [token]
    );

    console.log(' [VERIFY] Database result count:', rows.length);

    if (rows.length === 0) {
      console.log('❌ [VERIFY] No player found with this token');
      return res.status(404).json({ error: 'Invalid token' });
    }

    const player = rows[0];
    console.log('✅ [VERIFY] Player found:', { id: player.id, name: player.name, status: player.status });

    // Check if already verified
    if (player.status === 'active') {
      console.log('ℹ️  [VERIFY] Player already verified - returning user info');
      return res.status(409).json({
        error: 'Already verified',
        user: { name: player.name, email: player.email }
      });
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(player.token_expires_at);
    console.log('⏰ [VERIFY] Current time:', now.toISOString());
    console.log('⏰ [VERIFY] Token expires at:', expiresAt.toISOString());
    console.log('⏰ [VERIFY] Is expired:', now > expiresAt);

    if (now > expiresAt) {
      console.warn('⏳ [VERIFY] Token has expired');
      return res.status(410).json({ error: 'Link expired' });
    }

    // Verify the account (keep the token for future "already verified" checks)
    console.log('✨ [VERIFY] Activating player account...');
    await pool.query(
      'UPDATE players SET status = "active" WHERE id = ?',
      [player.id]
    );

    console.log('✅ [VERIFY] Account verified successfully:', player.email);
    res.json({
      message: 'Verified!',
      user: { name: player.name, email: player.email }
    });

  } catch (err) {
    console.error('❌ [VERIFY] Error during verification:', err);
    next(err);
  }
};

// ==========================================
// CHECK PLAYER VERIFICATION STATUS
// ==========================================
const checkStatus = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Player ID required' });

    const [rows] = await pool.query(
      'SELECT status, has_completed_tutorial FROM players WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    res.json({ status: rows[0].status, has_completed_tutorial: !!rows[0].has_completed_tutorial });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// EXPORT ALL FUNCTIONS
// ==========================================
module.exports = { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, checkUsername, verifyPlayer, checkStatus };