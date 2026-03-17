const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/logs
 */
router.get('/', async (req, res) => {
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
 */
router.post('/', async (req, res) => {
  try {
    const { action, description, user_id } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    const userId = user_id || 1;

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