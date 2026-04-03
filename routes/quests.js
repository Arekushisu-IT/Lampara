const express = require('express');
const { validationResult, body } = require('express-validator');
const pool = require('../db');

// Use the SHARED middleware instead of a copy-paste
const verifyToken = require('../src/middleware/auth');
const { NotFoundError, ValidationError } = require('../src/utils/errors');

const router = express.Router();

// Get all quests
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const [quests] = await pool.query(
      `SELECT q.id, q.chapter, q.main_quest, q.sub_quest, q.title, q.description, q.status,
       (SELECT COUNT(*) FROM players p WHERE p.current_quest_id = q.id) as player_count
       FROM quests q ORDER BY q.chapter, q.main_quest, q.sub_quest`
    );

    res.json({ 
      count: quests.length,
      quests 
    });
  } catch (err) {
    next(err);
  }
});

// Get quests by chapter
router.get('/chapter/:chapter', verifyToken, async (req, res, next) => {
  const { chapter } = req.params;

  try {
    const [quests] = await pool.query(
      'SELECT id, chapter, title, description, status FROM quests WHERE chapter = ? ORDER BY id',
      [chapter]
    );

    res.json({ 
      chapter,
      count: quests.length,
      quests 
    });
  } catch (err) {
    next(err);
  }
});

// Get quest by ID
router.get('/:id', verifyToken, async (req, res, next) => {
  const { id } = req.params;

  try {
    const [quests] = await pool.query(
      'SELECT * FROM quests WHERE id = ?',
      [id]
    );

    if (quests.length === 0) {
      throw new NotFoundError('Quest not found');
    }

    res.json({ quest: quests[0] });
  } catch (err) {
    next(err);
  }
});

// Create new quest
router.post('/', verifyToken, [
  body('chapter').notEmpty(),
  body('title').notEmpty(),
  body('description').notEmpty()
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { chapter, title, description, status = 'active' } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO quests (chapter, title, description, status) VALUES (?, ?, ?, ?)',
      [chapter, title, description, status]
    );

    res.status(201).json({
      message: 'Quest created successfully',
      questId: result.insertId
    });
  } catch (err) {
    next(err);
  }
});

// Update quest
router.put('/:id', verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { chapter, title, description, status } = req.body;

  try {
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
      throw new ValidationError('No fields to update');
    }

    updateQuery += updates.join(', ') + ' WHERE id = ?';
    values.push(id);

    const [result] = await pool.query(updateQuery, values);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Quest not found');
    }

    res.json({ message: 'Quest updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Delete quest
router.delete('/:id', verifyToken, async (req, res, next) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM quests WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Quest not found');
    }

    res.json({ message: 'Quest deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
