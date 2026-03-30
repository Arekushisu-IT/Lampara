const express = require('express');
const pool = require('../db');

// Add authentication — logs should only be accessible to logged-in admins
const verifyToken = require('../src/middleware/auth');

const router = express.Router();

/**
 * GET /api/logs
 * Now protected — only authenticated users can read activity logs
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const [logs] = await pool.query(
      'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100'
    );
    res.json(logs);
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * POST /api/logs
 * Now protected — uses the logged-in user's ID from their JWT token
 * instead of defaulting to user_id = 1
 */
router.post('/', verifyToken, async (req, res) => {
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
    console.error('Log create error:', err);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

module.exports = router;