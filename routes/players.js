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

// Get all players (UPDATED: Removed email, added username, school, is_online)
router.get('/', verifyToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const [players] = await conn.query(
      'SELECT id, name, username, school, level, experience, status, is_online, created_at FROM players ORDER BY created_at DESC'
    );

    conn.release();

    res.json({ 
      count: players.length,
      players 
    });
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get player by ID
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();

    const [players] = await conn.query(
      'SELECT * FROM players WHERE id = ?',
      [id]
    );

    conn.release();

    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ player: players[0] });
  } catch (err) {
    console.error('Error fetching player:', err);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Create new player from Admin Panel (UPDATED: email -> username)
router.post('/', verifyToken, [
  body('name').notEmpty(),
  body('username').notEmpty() 
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, username, school, level = 1, experience = 0, status = 'active' } = req.body;

  try {
    const conn = await pool.getConnection();

    // Default password for players created manually by admin (e.g., "lampara123")
    // Note: Usually players self-register, but this is a fallback for manual creation
    const bcryptjs = require('bcryptjs');
    const hashedPassword = await bcryptjs.hash('lampara123', 10);

    const [result] = await conn.query(
      'INSERT INTO players (name, username, password, school, level, experience, status, is_online) VALUES (?, ?, ?, ?, ?, ?, ?, false)',
      [name, username, hashedPassword, school || null, level, experience, status]
    );

    conn.release();

    res.status(201).json({
      message: 'Player created successfully',
      playerId: result.insertId
    });
  } catch (err) {
    console.error('Error creating player:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Update player (UPDATED: Added username, school, is_online support)
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, username, school, level, experience, status, is_online } = req.body;

  try {
    const conn = await pool.getConnection();

    let updateQuery = 'UPDATE players SET ';
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (school !== undefined) {
      updates.push('school = ?');
      values.push(school);
    }
    if (level !== undefined) {
      updates.push('level = ?');
      values.push(level);
    }
    if (experience !== undefined) {
      updates.push('experience = ?');
      values.push(experience);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (is_online !== undefined) {
      updates.push('is_online = ?');
      values.push(is_online);
    }

    if (updates.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateQuery += updates.join(', ') + ' WHERE id = ?';
    values.push(id);

    const [result] = await conn.query(updateQuery, values);

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Player updated successfully' });
  } catch (err) {
    console.error('Error updating player:', err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete player
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();

    const [result] = await conn.query('DELETE FROM players WHERE id = ?', [id]);

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Player deleted successfully' });
  } catch (err) {
    console.error('Error deleting player:', err);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

module.exports = router;