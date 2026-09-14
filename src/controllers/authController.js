const crypto = require('crypto');
const { isMultiAccountEmail, emailHasAccount } = require('../utils/accountEmail');
const fs = require('fs');
const path = require('path');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db');

const localAdminAuthPath = path.resolve(__dirname, '../../../Lampara-Local-Dev/local-admin-auth.js');
let localAdminAuth = null;

if (fs.existsSync(localAdminAuthPath)) {
  try {
    localAdminAuth = require(localAdminAuthPath);
  } catch (error) {
    console.error('Failed to load local admin auth module:', error.message);
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * FR5/FR6: fetch the player's in-progress metrics for the quest they are
 * currently on, so a mid-quest counter survives logout/login.
 *
 * players.current_quest_id holds the MAIN QUEST NUMBER (not a quests.id FK),
 * so the quest row is resolved by (main_quest, sub_quest) — the same way
 * POST /players/:id/save-checkpoint resolves it. `chapter` is deliberately not
 * part of the lookup: quests rows all store chapter = 1 while players.chapter
 * holds the main-quest number, so including it failed for every player past MQ1.
 *
 * Deliberately fail-safe: any error (most likely the quest_metrics migration
 * not being applied yet) returns zeros rather than breaking the login path.
 */
async function getCurrentQuestMetrics(player) {
  const fallback = { failure_count: 0, artifacts_found: 0, book_chapter_start: null, book_chapter_end: null };

  if (!player || !player.current_quest_id || !player.current_sub_quest) {
    return fallback;
  }

  try {
    // LEFT JOIN: the quest's book-chapter range is returned even when the player has
    // no player_quests row for it yet.
    const [rows] = await pool.query(
      `SELECT q.chapter_start, q.chapter_end, pq.failure_count, pq.artifacts_found
         FROM quests q
         LEFT JOIN player_quests pq ON pq.quest_id = q.id AND pq.player_id = ?
        WHERE q.main_quest = ? AND q.sub_quest = ?
        LIMIT 1`,
      [player.id, player.current_quest_id, player.current_sub_quest]
    );

    if (rows.length === 0) return fallback;

    return {
      failure_count: rows[0].failure_count || 0,
      artifacts_found: rows[0].artifacts_found || 0,
      book_chapter_start: rows[0].chapter_start,
      book_chapter_end: rows[0].chapter_end
    };
  } catch (err) {
    console.warn('[auth] Could not load quest metrics (run migrations/quest_metrics.sql):', err.message);
    return fallback;
  }
}

function getLocalAdminConfig() {
  if (!localAdminAuth || typeof localAdminAuth.isEnabled !== 'function') {
    return null;
  }

  if (!localAdminAuth.isEnabled()) {
    return null;
  }

  return localAdminAuth.getConfiguredAdmin();
}

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

    const localAdmin = getLocalAdminConfig();
    if (localAdmin && normalizeEmail(email) === normalizeEmail(localAdmin.email)) {
      const passwordMatch = localAdmin.passwordHash
        ? await bcryptjs.compare(password, localAdmin.passwordHash)
        : password === localAdmin.password;

      if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });

      const token = jwt.sign(
        localAdminAuth.toTokenPayload(localAdmin),
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION || '4h' }
      );

      return res.json({
        token,
        user: localAdminAuth.toResponseUser(localAdmin)
      });
    }

    const [users] = await pool.query('SELECT * FROM Admin_User WHERE email = ?', [email]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = users[0];
    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '4h' }
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
      { expiresIn: '7d' }
    );

    // Turn them ONLINE
    await pool.query(
      'UPDATE players SET last_login = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP, is_online = true WHERE id = ?',
      [player.id]);

    const metrics = await getCurrentQuestMetrics(player);

    return res.json({
      message: 'Login successful',
      token,
      player: {
        id: player.id, name: player.name, username: player.username, email: player.email,
        level: player.level, experience: player.experience, status: player.status,
        has_completed_tutorial: !!player.has_completed_tutorial,
        current_main_quest: player.current_quest_id,
        current_sub_quest: player.current_sub_quest,
        chapter: player.chapter,
        suspicion: player.suspicion,
        suspicion_seq: player.suspicion_seq,
        failure_count: metrics.failure_count,
        artifacts_found: metrics.artifacts_found,
        book_chapter_start: metrics.book_chapter_start,
        book_chapter_end: metrics.book_chapter_end
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
      const [players] = await pool.query(
        'SELECT id, username, name, email, level, experience, status, has_completed_tutorial, ' +
        'current_quest_id, current_sub_quest, chapter, suspicion, suspicion_seq FROM players WHERE id = ?',
        [req.user.id]
      );
      if (players.length === 0) return res.status(401).json({ error: 'Player not found' });

      const player = players[0];
      const metrics = await getCurrentQuestMetrics(player);

      return res.json({
        user: {
          id: player.id, name: player.name, username: player.username, email: player.email,
          level: player.level, experience: player.experience, status: player.status,
          has_completed_tutorial: !!player.has_completed_tutorial,
          current_main_quest: player.current_quest_id,
          current_sub_quest: player.current_sub_quest,
          chapter: player.chapter,
          suspicion: player.suspicion,
          suspicion_seq: player.suspicion_seq,
          failure_count: metrics.failure_count,
          artifacts_found: metrics.artifacts_found,
          book_chapter_start: metrics.book_chapter_start,
          book_chapter_end: metrics.book_chapter_end
        }
      });
    } else {
      const localAdmin = getLocalAdminConfig();
      if (req.user.local_dev_admin) {
        if (!localAdmin || normalizeEmail(req.user.email) !== normalizeEmail(localAdmin.email)) {
          return res.status(401).json({ error: 'Local admin session is not available' });
        }

        return res.json({ user: localAdminAuth.toResponseUser(localAdmin) });
      }

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

    const hashedPassword = await bcryptjs.hash(password, 12);
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

    // One account per email address (per Google account for Gmail -- dots and
    // +tags are ignored). Addresses in MULTI_ACCOUNT_EMAILS are exempt, for testing.
    // Suspended and rejected accounts are kept with status 'banned', so they also
    // block a new registration with the same address.
    if (!isMultiAccountEmail(email) && await emailHasAccount(pool, email)) {
      return res.status(409).json({
        error: 'An account with this email already exists. Log in, or reset your password if you forgot it.'
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    // Generate token + 24hr expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // New players start at game_config.suspicion_start rather than a hardcoded 0,
    // so the admin Game Settings screen keeps control of the value. A missing or
    // unparseable key falls back to 0 instead of failing the registration.
    // NOTE: the main-quest SuspicionMeter still hardcodes its tuning constants, so
    // this value only reaches the tutorial until the client reads /api/game/config.
    let startingSuspicion = 0;
    const [startRows] = await pool.query(
      "SELECT config_value FROM game_config WHERE config_key = 'suspicion_start'"
    );
    if (startRows.length > 0) {
      const parsed = parseInt(startRows[0].config_value, 10);
      if (Number.isInteger(parsed)) {
        startingSuspicion = Math.max(0, Math.min(100, parsed));
      }
    }

    // Insert player as inactive with token
    await pool.query(
      `INSERT INTO players
       (name, username, password, email, birthdate, level, experience, status, chapter, suspicion, verify_token, token_expires_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, 'inactive', 1, ?, ?, ?)`,
      [name, username, hashedPassword, email || null, birthdate, startingSuspicion, token, expiresAt]
    );

    // Send verification email if email provided
    if (email) {
      try {
        // Use production URL when deployed, local URL for dev
        const baseUrl = process.env.NODE_ENV === 'production'
          ? (process.env.FRONTEND_URL_PROD || 'https://lampara.life')
          : (process.env.FRONTEND_URL || 'http://127.0.0.1:5500');
        const verifyUrl = `${baseUrl}/verify.html?token=${token}`;

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

  if (process.env.NODE_ENV !== 'production') {
    console.log('🔐 [VERIFY] Request received');
    console.log('🔐 [VERIFY] Token present:', !!token);
    if (token) {
      console.log('🔐 [VERIFY] Token length:', token.length);
    }
  }

  if (!token) {
    console.warn('❌ [VERIFY] No token provided in request body');
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    // Find player by verification token
    const [rows] = await pool.query(
      'SELECT id, name, email, status, token_expires_at FROM players WHERE verify_token = ?',
      [token]
    );



    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    const player = rows[0];


    // Check if already verified
    if (player.status === 'active') {
      return res.status(409).json({
        error: 'Already verified',
        user: { name: player.name, email: player.email }
      });
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(player.token_expires_at);

    if (now > expiresAt) {
      return res.status(410).json({ error: 'Link expired' });
    }

    // Verify the account (keep the token for future "already verified" checks)
    await pool.query(
      'UPDATE players SET status = "active" WHERE id = ?',
      [player.id]
    );

    res.json({
      message: 'Verified!',
      user: { name: player.name, email: player.email }
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// CHECK PLAYER VERIFICATION STATUS
// ==========================================
const checkStatus = async (req, res, next) => {
  try {
    // Use authenticated user's ID — players can only check their own status
    const id = req.body.id || req.user.id;

    // Players can only check their own status; admin/staff can check any
    if (req.user.role === 'player' && Number(req.user.id) !== Number(id)) {
      return res.status(403).json({ error: 'Forbidden: cannot check another player\'s status' });
    }

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
// CHECK VERIFICATION STATUS (PUBLIC)
// Players can check if their account is verified
// by providing their username or email — no auth required.
// ==========================================
const checkVerification = async (req, res, next) => {
  try {
    const { username, email } = req.body;

    if (!username && !email) {
      return res.status(400).json({ error: 'Username or email is required' });
    }

    let query, param;
    if (username) {
      query = 'SELECT status, name FROM players WHERE username = ?';
      param = username;
    } else {
      query = 'SELECT status, name FROM players WHERE email = ?';
      param = email;
    }

    const [rows] = await pool.query(query, [param]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const player = rows[0];
    const isVerified = player.status === 'active';

    res.json({
      verified: isVerified,
      status: player.status,
      name: player.name
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// FORGOT PASSWORD (send reset link via email)
// ==========================================
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Find player by email
    const [rows] = await pool.query(
      'SELECT id, name, email FROM players WHERE email = ? AND status = ?',
      [email, 'active']
    );

    // Always return success even if not found (prevents email enumeration)
    if (rows.length === 0) {
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const player = rows[0];

    // Generate reset token (1 hour expiry)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Invalidate any existing reset tokens for this player
    await pool.query('UPDATE password_resets SET used = TRUE WHERE player_id = ? AND used = FALSE', [player.id]);

    // Insert new reset token
    await pool.query(
      'INSERT INTO password_resets (player_id, token, expires_at) VALUES (?, ?, ?)',
      [player.id, token, expiresAt]
    );

    // Build reset URL
    const baseUrl = process.env.NODE_ENV === 'production'
      ? (process.env.FRONTEND_URL_PROD || 'https://lampara.life')
      : (process.env.FRONTEND_URL || 'http://127.0.0.1:5500');
    const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;

    const emailHtml = `
      <div style="font-family:Georgia,serif;background:#0a0805;color:#e8dcc8;padding:40px;max-width:500px;margin:0 auto;border:1px solid #3d2d14;border-radius:8px;">
        <h2 style="color:#e8b84b;letter-spacing:6px;font-size:24px;">⚜ LAMPARA</h2>
        <p style="font-size:16px;">Hello, <strong>${player.name}</strong>.</p>
        <p style="color:#a89070;line-height:1.8;">We received a request to reset your password. Click the button below to set a new password.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}"
             style="background:rgba(201,149,58,.2);border:1px solid #7a5820;border-radius:5px;color:#e8b84b;padding:14px 32px;text-decoration:none;font-size:13px;letter-spacing:2px;">
            ⚜ RESET PASSWORD
          </a>
        </div>
        <p style="font-size:11px;color:#6b5740;">This link expires in 1 hour. If you didn't request this, ignore this email.<br>STI College General Santos · BSIT Capstone 2026</p>
      </div>
    `;

    sendEmailViaWebhook(player.email, '⚜ Reset Your Lampara Password', emailHtml)
      .catch(err => console.error('CRITICAL: Password reset email failed:', err));

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// RESET PASSWORD (validate token + update)
// ==========================================
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be 8-128 characters' });
    }

    // Find valid reset token
    const [rows] = await pool.query(
      'SELECT pr.id, pr.player_id, pr.expires_at, p.name FROM password_resets pr JOIN players p ON pr.player_id = p.id WHERE pr.token = ? AND pr.used = FALSE',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const reset = rows[0];

    // Check expiry
    if (new Date() > new Date(reset.expires_at)) {
      await pool.query('UPDATE password_resets SET used = TRUE WHERE id = ?', [reset.id]);
      return res.status(410).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    // Hash new password and update
    const hashedPassword = await bcryptjs.hash(password, 10);
    await pool.query('UPDATE players SET password = ? WHERE id = ?', [hashedPassword, reset.player_id]);

    // Mark token as used
    await pool.query('UPDATE password_resets SET used = TRUE WHERE id = ?', [reset.id]);

    res.json({ message: 'Password has been reset successfully. You can now sign in with your new password.', name: reset.name });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// EXPORT ALL FUNCTIONS
// ==========================================
module.exports = { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, checkUsername, verifyPlayer, checkStatus, checkVerification, forgotPassword, resetPassword };
