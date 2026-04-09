const express = require('express');
const pool = require('../db');

// Add authentication — logs should only be accessible to logged-in admins
const verifyToken = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');

const router = express.Router();

/**
 * GET /api/logs
 * Now protected — only authenticated users can read activity logs
 */
router.get('/', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const [logs] = await pool.query(
      'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM activity_logs');

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/logs
 * Now protected — uses the logged-in user's ID from their JWT token
 * instead of defaulting to user_id = 1
 */
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { action, description } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    // Use the authenticated user's ID from the JWT token
    const userId = req.user.id;

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)',
      [userId, action, description || '']
    );

    res.status(201).json({ message: 'Log created' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;