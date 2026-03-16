const express = require('express');
const { validationResult, body } = require('express-validator');
const pool = require('../db');

const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all activity logs
router.get('/', verifyToken, async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;

  try {
    const conn = await pool.getConnection();

    const [logs] = await conn.query(
      'SELECT id, user_id, action, description, timestamp FROM activity_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await conn.query('SELECT COUNT(*) as total FROM activity_logs');

    conn.release();

    res.json({ 
      count: logs.length,
      total: countResult[0].total,
      logs 
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get logs for specific user
router.get('/user/:userId', verifyToken, async (req, res) => {
  const { userId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const conn = await pool.getConnection();

    const [logs] = await conn.query(
      'SELECT id, user_id, action, description, timestamp FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [userId, parseInt(limit), parseInt(offset)]
    );

    conn.release();

    res.json({ 
      userId,
      count: logs.length,
      logs 
    });
  } catch (err) {
    console.error('Error fetching user logs:', err);
    res.status(500).json({ error: 'Failed to fetch user logs' });
  }
});

// Create activity log
router.post('/', verifyToken, [
  body('action').notEmpty(),
  body('description').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { action, description } = req.body;
  const userId = req.userId;

  try {
    const conn = await pool.getConnection();

    const [result] = await conn.query(
      'INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)',
      [userId, action, description]
    );

    conn.release();

    res.status(201).json({
      message: 'Log created successfully',
      logId: result.insertId
    });
  } catch (err) {
    console.error('Error creating log:', err);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

// Get logs by action
router.get('/action/:action', verifyToken, async (req, res) => {
  const { action } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const conn = await pool.getConnection();

    const [logs] = await conn.query(
      'SELECT id, user_id, action, description, timestamp FROM activity_logs WHERE action = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [action, parseInt(limit), parseInt(offset)]
    );

    conn.release();

    res.json({ 
      action,
      count: logs.length,
      logs 
    });
  } catch (err) {
    console.error('Error fetching action logs:', err);
    res.status(500).json({ error: 'Failed to fetch action logs' });
  }
});

// Delete old logs (optional maintenance)
router.delete('/before/:date', verifyToken, async (req, res) => {
  const { date } = req.params;

  try {
    const conn = await pool.getConnection();

    const [result] = await conn.query(
      'DELETE FROM activity_logs WHERE timestamp < ?',
      [date]
    );

    conn.release();

    res.json({ 
      message: 'Logs deleted successfully',
      deletedCount: result.affectedRows 
    });
  } catch (err) {
    console.error('Error deleting logs:', err);
    res.status(500).json({ error: 'Failed to delete logs' });
  }
});

module.exports = router;
