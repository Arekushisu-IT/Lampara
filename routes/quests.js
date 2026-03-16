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

// Get all quests
router.get('/', verifyToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const [quests] = await conn.query(
      'SELECT id, chapter, title, description, status, created_at FROM quests ORDER BY chapter, id'
    );

    conn.release();

    res.json({ 
      count: quests.length,
      quests 
    });
  } catch (err) {
    console.error('Error fetching quests:', err);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// Get quests by chapter
router.get('/chapter/:chapter', verifyToken, async (req, res) => {
  const { chapter } = req.params;

  try {
    const conn = await pool.getConnection();

    const [quests] = await conn.query(
      'SELECT id, chapter, title, description, status FROM quests WHERE chapter = ? ORDER BY id',
      [chapter]
    );

    conn.release();

    res.json({ 
      chapter,
      count: quests.length,
      quests 
    });
  } catch (err) {
    console.error('Error fetching chapter quests:', err);
    res.status(500).json({ error: 'Failed to fetch chapter quests' });
  }
});

// Get quest by ID
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();

    const [quests] = await conn.query(
      'SELECT * FROM quests WHERE id = ?',
      [id]
    );

    conn.release();

    if (quests.length === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    res.json({ quest: quests[0] });
  } catch (err) {
    console.error('Error fetching quest:', err);
    res.status(500).json({ error: 'Failed to fetch quest' });
  }
});

// Create new quest
router.post('/', verifyToken, [
  body('chapter').notEmpty(),
  body('title').notEmpty(),
  body('description').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { chapter, title, description, status = 'active' } = req.body;

  try {
    const conn = await pool.getConnection();

    const [result] = await conn.query(
      'INSERT INTO quests (chapter, title, description, status) VALUES (?, ?, ?, ?)',
      [chapter, title, description, status]
    );

    conn.release();

    res.status(201).json({
      message: 'Quest created successfully',
      questId: result.insertId
    });
  } catch (err) {
    console.error('Error creating quest:', err);
    res.status(500).json({ error: 'Failed to create quest' });
  }
});

// Update quest
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { chapter, title, description, status } = req.body;

  try {
    const conn = await pool.getConnection();

    let updateQuery = 'UPDATE quests SET ';
    const updates = [];
    const values = [];

    if (chapter !== undefined) {
      updates.push('chapter = ?');
      values.push(chapter);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
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
      return res.status(404).json({ error: 'Quest not found' });
    }

    res.json({ message: 'Quest updated successfully' });
  } catch (err) {
    console.error('Error updating quest:', err);
    res.status(500).json({ error: 'Failed to update quest' });
  }
});

// Delete quest
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();

    const [result] = await conn.query('DELETE FROM quests WHERE id = ?', [id]);

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    res.json({ message: 'Quest deleted successfully' });
  } catch (err) {
    console.error('Error deleting quest:', err);
    res.status(500).json({ error: 'Failed to delete quest' });
  }
});

module.exports = router;
