const express = require('express');
const { validationResult } = require('express-validator');
const pool = require('../db');

// Use the SHARED middleware instead of a copy-paste
const verifyToken = require('../src/middleware/auth');
const { NotFoundError, ValidationError } = require('../src/utils/errors');
const { validateQuestCreate, validateQuestUpdate, validate } = require('../src/middleware/validation');

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

// Get quest by chapter and main_quest (for Unity client)
router.get('/chapter/:chapter/main/:mainQuest', verifyToken, async (req, res, next) => {
  const { chapter, mainQuest } = req.params;

  try {
    const [quests] = await pool.query(
      'SELECT * FROM quests WHERE chapter = ? AND main_quest = ? ORDER BY sub_quest',
      [chapter, mainQuest]
    );

    res.json({
      chapter: parseInt(chapter),
      main_quest: parseInt(mainQuest),
      count: quests.length,
      quests
    });
  } catch (err) {
    next(err);
  }
});

// Create single sub quest (with validation)
router.post('/', verifyToken, validateQuestCreate, validate, async (req, res, next) => {
  const { chapter, main_quest = 1, sub_quest = 1, title, description = '', status = 'active' } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO quests (chapter, main_quest, sub_quest, title, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [chapter, main_quest, sub_quest, title, description, status]
    );

    res.status(201).json({
      message: 'Quest created successfully',
      questId: result.insertId
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'A quest with this Chapter/MainQuest/SubQuest already exists.' });
    next(err);
  }
});

// Batch-create a full Main Quest with 5 empty sub quests
router.post('/batch-main-quest', verifyToken, async (req, res, next) => {
  const { chapter, main_quest, status = 'standby' } = req.body;
  if (!chapter || !main_quest) return res.status(400).json({ error: 'chapter and main_quest are required' });

  try {
    let created = 0;
    for (let sq = 1; sq <= 5; sq++) {
      await pool.query(
        'INSERT INTO quests (chapter, main_quest, sub_quest, title, description, status) VALUES (?, ?, ?, ?, ?, ?)',
        [chapter, main_quest, sq, `Standby`, `Awaiting storyboard content.`, status]
      );
      created++;
    }
    res.status(201).json({ message: `Main Quest ${main_quest} created with ${created} sub quests`, created });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Some sub quests in this Main Quest already exist.' });
    next(err);
  }
});

// Update quest (with validation)
router.put('/:id', verifyToken, validateQuestUpdate, validate, async (req, res, next) => {
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

// Bulk update status for all sub quests under a chapter + main_quest
router.put('/bulk-status/:chapter/:mainQuest', verifyToken, async (req, res, next) => {
  const { chapter, mainQuest } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    const [result] = await pool.query(
      'UPDATE quests SET status = ? WHERE chapter = ? AND main_quest = ?',
      [status, chapter, mainQuest]
    );

    res.json({
      message: `${result.affectedRows} sub quests set to ${status}`,
      affected: result.affectedRows
    });
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
