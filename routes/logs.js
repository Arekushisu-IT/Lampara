const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/logs
 * Get all activity logs
 */
router.get('/', (req, res) => {
  try {
    pool.query(
      'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100',
      (err, results) => {
        if (err) {
          console.error('Get logs error:', err);
          return res.status(500).json({ error: 'Failed to fetch logs' });
        }
        res.json(results);
      }
    );
  } catch (err) {
    console.error('Logs error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * POST /api/logs
 * Create a new activity log
 */
router.post('/', (req, res) => {
  try {
    const { action, description, user_id } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    // Use user_id from body or default to 1 (admin)
    const userId = user_id || 1;

    pool.query(
      'INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)',
      [userId, action, description || ''],
      (err, results) => {
        if (err) {
          console.error('Create log error:', err);
          return res.status(500).json({ error: 'Failed to create log' });
        }
        res.status(201).json({
          message: 'Log created',
          logId: results.insertId
        });
      }
    );
  } catch (err) {
    console.error('Log create error:', err);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

module.exports = router;