const express = require('express');
const { validationResult } = require('express-validator');
const pool = require('../db');

// Use the SHARED middleware instead of a copy-paste
const verifyToken = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');
const { NotFoundError, ValidationError } = require('../src/utils/errors');
const { validateQuestCreate, validateQuestUpdate, validate } = require('../src/middleware/validation');
const { artifactNameFromPath } = require('../src/utils/artifacts');
const { buildOptionDeltas } = require('../src/utils/dialogues');
const { normalizeImportedDialogues } = require('../src/utils/dialogueImport');

const router = express.Router();

// Get all quests
router.get('/', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const [quests] = await pool.query(
      `SELECT q.id, q.chapter, q.chapter_start, q.chapter_end, q.main_quest, q.sub_quest, q.title, q.description,
              q.artifact_resource_path, q.artifacts_total, q.status,
       -- players.current_quest_id holds the MAIN QUEST NUMBER, so match on the
       -- player's (main quest, sub quest) position. Comparing it to q.id counted the
       -- wrong players for every quest past the first row of each main quest.
       (SELECT COUNT(*) FROM players p
         WHERE p.current_quest_id = q.main_quest AND p.current_sub_quest = q.sub_quest) as player_count
       FROM quests q ORDER BY q.main_quest, q.sub_quest`
    );

    // Readable name for each sub-quest's artifact, derived from the prefab path.
    quests.forEach(q => { q.artifact_name = artifactNameFromPath(q.artifact_resource_path); });

    res.json({
      count: quests.length,
      quests
    });
  } catch (err) {
    next(err);
  }
});

// Get quests by chapter
router.get('/chapter/:chapter', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
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
router.get('/:id(\\d+)', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
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

// Get the sub quests of one main quest. :chapter is kept for URL compatibility but
// ignored -- quests are identified by main_quest / sub_quest, not chapter.
router.get('/chapter/:chapter/main/:mainQuest', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { chapter, mainQuest } = req.params;

  try {
    const [quests] = await pool.query(
      'SELECT * FROM quests WHERE main_quest = ? ORDER BY sub_quest',
      [mainQuest]
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
//
// The id is set explicitly to (main_quest - 1) * 5 + sub_quest. The game computes
// quest ids with that formula (SubQuestSequenceManager.CalculateQuestID), so a row
// that took an AUTO_INCREMENT id (36, 37, ...) could never be found or completed.
// validateQuestCreate bounds main_quest to 1-7 and sub_quest to 1-5 so the formula
// cannot collide across main quests. `chapter` is legacy and not a lookup key; the
// El Filibusterismo book-chapter range is stored separately.
router.post('/', verifyToken, authorize('admin', 'staff'), validateQuestCreate, validate, async (req, res, next) => {
  const { chapter = 1, main_quest, sub_quest, title, description = '', status = 'active' } = req.body;
  const id = (main_quest - 1) * 5 + sub_quest;

  try {
    await pool.query(
      'INSERT INTO quests (id, chapter, main_quest, sub_quest, title, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, chapter, main_quest, sub_quest, title, description, status]
    );

    res.status(201).json({
      message: 'Quest created successfully',
      questId: id
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `MQ${main_quest} SQ${sub_quest} already exists.` });
    }
    next(err);
  }
});

// Update quest (with validation)
router.put('/:id(\\d+)', verifyToken, authorize('admin', 'staff'), validateQuestUpdate, validate, async (req, res, next) => {
  const { id } = req.params;
  const { chapter, chapter_start, chapter_end, title, description, artifact_resource_path, artifacts_total, status } = req.body;

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
    if (artifact_resource_path !== undefined) {
      updates.push('artifact_resource_path = ?');
      values.push(artifact_resource_path);
    }
    if (artifacts_total !== undefined) {
      const total = Number(artifacts_total);
      if (!Number.isInteger(total) || total < 0) {
        throw new ValidationError('artifacts_total must be a non-negative integer');
      }
      updates.push('artifacts_total = ?');
      values.push(total);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    // El Filibusterismo book-chapter range. Either end may be sent alone, so the
    // start <= end rule is checked against the stored value of the other end.
    if (chapter_start !== undefined || chapter_end !== undefined) {
      const [current] = await pool.query(
        'SELECT chapter_start, chapter_end FROM quests WHERE id = ?', [id]);
      if (current.length === 0) {
        throw new NotFoundError('Quest not found');
      }
      const start = chapter_start !== undefined ? chapter_start : current[0].chapter_start;
      const end = chapter_end !== undefined ? chapter_end : current[0].chapter_end;
      if (start != null && end != null && start > end) {
        throw new ValidationError('chapter_start must not be greater than chapter_end');
      }
      if (chapter_start !== undefined) {
        updates.push('chapter_start = ?');
        values.push(chapter_start);
      }
      if (chapter_end !== undefined) {
        updates.push('chapter_end = ?');
        values.push(chapter_end);
      }
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

// Bulk update status for all sub quests under a main quest.
// :chapter is kept for URL compatibility but ignored (not a lookup key).
router.put('/bulk-status/:chapter/:mainQuest', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { mainQuest } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    const [result] = await pool.query(
      'UPDATE quests SET status = ? WHERE main_quest = ?',
      [status, mainQuest]
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
router.delete('/:id(\\d+)', verifyToken, authorize('admin'), async (req, res, next) => {
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

// ============================================================
// DIALOGUE MANAGEMENT ENDPOINTS
// ============================================================

// Get all dialogues for a quest
router.get('/:id(\\d+)/dialogues', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { id } = req.params;

  try {
    const [dialogues] = await pool.query(
      `SELECT id, quest_id, sequence_order, npc_name, npc_text,
              option_a_text, option_b_text, option_c_text, option_a_correct, option_b_correct, option_c_correct,
              suspicion_penalty, option_a_delta, option_b_delta, option_c_delta, artifact_resource_path, context_notes, created_at, updated_at
       FROM quest_dialogues
       WHERE quest_id = ?
       ORDER BY sequence_order`,
      [id]
    );

    res.json({
      quest_id: parseInt(id),
      count: dialogues.length,
      dialogues
    });
  } catch (err) {
    next(err);
  }
});

// Create a dialogue entry for a quest
router.post('/:id(\\d+)/dialogues', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { id } = req.params;
  const {
    sequence_order,
    npc_name = 'NPC',
    npc_text,
    option_a_text,
    option_b_text,
    option_c_text,
    option_a_correct = 0,
    option_b_correct = 1,
    option_c_correct = 0,
    option_a_delta,
    option_b_delta,
    option_c_delta,
    suspicion_penalty = 10,
    artifact_resource_path,
    context_notes = ''
  } = req.body;

  if (!npc_text || !option_a_text || !option_b_text) {
    return res.status(400).json({ error: 'npc_text, option_a_text, and option_b_text are required' });
  }

  try {
    const { optionADelta, optionBDelta, optionCDelta, suspicionPenalty } = buildOptionDeltas({
      option_a_correct,
      option_b_correct,
      option_c_correct,
      option_a_delta,
      option_b_delta,
      option_c_delta,
      suspicion_penalty
    });

    // Auto-assign sequence_order if not provided
    let seqOrder = sequence_order;
    if (!seqOrder) {
      const [maxSeq] = await pool.query(
        'SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order FROM quest_dialogues WHERE quest_id = ?',
        [id]
      );
      seqOrder = maxSeq[0].next_order;
    }

    const [result] = await pool.query(
      `INSERT INTO quest_dialogues
       (quest_id, sequence_order, npc_name, npc_text, option_a_text, option_b_text, option_c_text,
        option_a_correct, option_b_correct, option_c_correct, suspicion_penalty, option_a_delta, option_b_delta, option_c_delta, context_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, seqOrder, npc_name, npc_text, option_a_text, option_b_text, option_c_text,
       option_a_correct, option_b_correct, option_c_correct, suspicionPenalty, optionADelta, optionBDelta, optionCDelta, context_notes]
    );

    res.status(201).json({
      message: 'Dialogue created successfully',
      dialogueId: result.insertId,
      sequence_order: seqOrder
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A dialogue with this sequence order already exists for this quest.' });
    }
    next(err);
  }
});

// Update a dialogue entry
router.put('/dialogues/:dialogueId', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { dialogueId } = req.params;
  const { npc_name, npc_text, option_a_text, option_b_text, option_c_text,
          option_a_correct, option_b_correct, option_c_correct, suspicion_penalty,
          option_a_delta, option_b_delta, option_c_delta, context_notes, sequence_order } = req.body;

  try {
    let updateQuery = 'UPDATE quest_dialogues SET ';
    const updates = [];
    const values = [];

    if (npc_name !== undefined)        { updates.push('npc_name = ?');        values.push(npc_name); }
    if (npc_text !== undefined)        { updates.push('npc_text = ?');        values.push(npc_text); }
    if (option_a_text !== undefined)   { updates.push('option_a_text = ?');   values.push(option_a_text); }
    if (option_b_text !== undefined)   { updates.push('option_b_text = ?');   values.push(option_b_text); }
    if (option_c_text !== undefined)   { updates.push('option_c_text = ?');   values.push(option_c_text); }
    const hasDeltaInput =
      option_a_correct !== undefined ||
      option_b_correct !== undefined ||
      option_c_correct !== undefined ||
      suspicion_penalty !== undefined ||
      option_a_delta !== undefined ||
      option_b_delta !== undefined ||
      option_c_delta !== undefined;

    if (option_a_correct !== undefined){ updates.push('option_a_correct = ?');values.push(option_a_correct); }
    if (option_b_correct !== undefined){ updates.push('option_b_correct = ?');values.push(option_b_correct); }
    if (option_c_correct !== undefined){ updates.push('option_c_correct = ?');values.push(option_c_correct); }

    if (hasDeltaInput) {
      const { optionADelta, optionBDelta, optionCDelta, suspicionPenalty } = buildOptionDeltas({
        option_a_correct,
        option_b_correct,
        option_c_correct,
        suspicion_penalty,
        option_a_delta,
        option_b_delta,
        option_c_delta
      });
      updates.push('suspicion_penalty = ?'); values.push(suspicionPenalty);
      updates.push('option_a_delta = ?'); values.push(optionADelta);
      updates.push('option_b_delta = ?'); values.push(optionBDelta);
      updates.push('option_c_delta = ?'); values.push(optionCDelta);
    }
    if (context_notes !== undefined)   { updates.push('context_notes = ?');   values.push(context_notes); }
    if (sequence_order !== undefined)  { updates.push('sequence_order = ?');  values.push(sequence_order); }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updateQuery += updates.join(', ') + ' WHERE id = ?';
    values.push(dialogueId);

    const [result] = await pool.query(updateQuery, values);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Dialogue not found');
    }

    res.json({ message: 'Dialogue updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Delete a dialogue entry
router.delete('/dialogues/:dialogueId', verifyToken, authorize('admin'), async (req, res, next) => {
  const { dialogueId } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM quest_dialogues WHERE id = ?', [dialogueId]);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Dialogue not found');
    }

    res.json({ message: 'Dialogue deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Get quest difficulty/failure statistics for dashboard
router.get('/quest-stats', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const [stats] = await pool.query(`
      -- Difficulty is measured in game-overs (player_quests.failure_count, FR6).
      -- "failed" used to count every non-completed row, so a player still mid-quest
      -- showed as a failure; statuses are now reported as they are stored.
      SELECT
        q.id as quest_id,
        q.main_quest,
        q.sub_quest,
        q.chapter_start,
        q.chapter_end,
        CONCAT('MQ', q.main_quest, ' SQ', q.sub_quest) as quest_label,
        q.title,
        COUNT(pq.id) as attempts,
        COALESCE(SUM(pq.status = 'completed'), 0)   as completed,
        COALESCE(SUM(pq.status = 'in_progress'), 0) as in_progress,
        COALESCE(SUM(pq.status = 'failed'), 0)      as failed,
        COALESCE(SUM(pq.failure_count), 0)          as game_overs
      FROM quests q
      LEFT JOIN player_quests pq ON pq.quest_id = q.id
      WHERE q.status = 'active'
      GROUP BY q.id, q.main_quest, q.sub_quest, q.chapter_start, q.chapter_end, q.title
      HAVING attempts > 0
      ORDER BY game_overs DESC, attempts DESC
    `);

    res.json({ count: stats.length, stats });
  } catch (err) {
    next(err);
  }
});

// Import dialogue seed data into quest_dialogues table
router.post('/import-dialogues', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  let conn;
  try {
    // Clear require cache to pick up latest seed data
    delete require.cache[require.resolve('../seeds/generated/seed-dialogues')];
    const { QUEST_UPDATES, DIALOGUES } = require('../seeds/generated/seed-dialogues');

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Update quest titles & descriptions
    for (const q of QUEST_UPDATES) {
      await conn.query(
        'UPDATE quests SET title = ?, description = ?, updated_at = NOW() WHERE id = ?',
        [q.title, q.description, q.id]
      );
    }

    // 2. Delete ALL existing dialogues (clean slate)
    const [delResult] = await conn.query('DELETE FROM quest_dialogues');

    const normalizedDialogues = normalizeImportedDialogues(DIALOGUES);

    // 3. Insert all dialogues
    let inserted = 0;
    for (const d of normalizedDialogues) {
      await conn.query(
        `INSERT INTO quest_dialogues
          (quest_id, sequence_order, npc_name, npc_text,
           option_a_text, option_b_text, option_c_text,
           option_a_correct, option_b_correct, option_c_correct,
           suspicion_penalty, option_a_delta, option_b_delta, option_c_delta, context_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.quest_id, d.sequence_order, d.npc_name, d.npc_text,
          d.option_a_text, d.option_b_text, d.option_c_text,
          d.option_a_correct ?? 1,
          d.option_b_correct ?? 0,
          d.option_c_correct ?? 0,
          d.suspicion_penalty ?? 10,
          d.option_a_delta ?? -10,
          d.option_b_delta ?? 10,
          d.option_c_delta ?? 35,
          d.context_notes
        ]
      );
      inserted++;
    }

    // 4. Activate quests that have dialogues
    const questIdsWithDialogues = [...new Set(normalizedDialogues.map(d => d.quest_id))];
    if (questIdsWithDialogues.length > 0) {
      await conn.query(
        `UPDATE quests SET status = 'active' WHERE id IN (${questIdsWithDialogues.map(() => '?').join(',')})`,
        questIdsWithDialogues
      );
    }

    await conn.commit();

    res.json({
      message: `Import complete: ${inserted} dialogues inserted, ${QUEST_UPDATES.length} quest titles updated, ${delResult.affectedRows} old dialogues removed`,
      inserted,
      questsUpdated: QUEST_UPDATES.length,
      deleted: delResult.affectedRows
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
