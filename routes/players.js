const express = require('express');
const { validationResult } = require('express-validator');
const pool = require('../db');

// Use the SHARED middleware instead of a copy-paste
const verifyToken = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');
const { NotFoundError, ValidationError } = require('../src/utils/errors');
const { validatePlayerCreate, validatePlayerUpdate, validate } = require('../src/middleware/validation');

const router = express.Router();

// Get all players (admin/staff only)
router.get('/', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  try {
    // Use pool.query() directly — no connection leak risk
    const [players] = await pool.query(
      'SELECT id, name, username, email, age, level, experience, status, is_online, chapter, suspicion, current_quest_id, current_sub_quest, created_at FROM players ORDER BY created_at DESC'
    );

    res.json({
      count: players.length,
      players
    });
  } catch (err) {
    next(err); // Let global error handler catch it
  }
});

// Get player by ID
router.get('/:id', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { id } = req.params;

  try {
    const [players] = await pool.query(
      'SELECT * FROM players WHERE id = ?',
      [id]
    );

    if (players.length === 0) {
      throw new NotFoundError('Player not found');
    }

    res.json({ player: players[0] });
  } catch (err) {
    next(err);
  }
});

// Create new player from Admin Panel (with validation)
router.post('/', verifyToken, authorize('admin', 'staff'), validatePlayerCreate, validate, async (req, res, next) => {
  const { name, username, email, age, level = 1, experience = 0, status = 'active' } = req.body;

  try {
    // Generate a random password and include it in the response for the admin to share
    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const bcryptjs = require('bcryptjs');
    const hashedPassword = await bcryptjs.hash(tempPassword, 10);

    const [result] = await pool.query(
      'INSERT INTO players (name, username, password, email, age, level, experience, status, is_online) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false)',
      [name, username, hashedPassword, email || null, age || null, level, experience, status]
    );

    res.status(201).json({
      message: 'Player created successfully',
      playerId: result.insertId,
      tempPassword: tempPassword
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username or Email already exists' });
    }
    next(err);
  }
});

// Update player (with validation)
router.put('/:id', verifyToken, authorize('admin', 'staff'), validatePlayerUpdate, validate, async (req, res, next) => {
  const { id } = req.params;
  const { name, username, email, age, level, experience, status, is_online } = req.body;

  try {
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
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (age !== undefined) {
      updates.push('age = ?');
      values.push(age);
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
      throw new ValidationError('No fields to update');
    }

    updateQuery += updates.join(', ') + ' WHERE id = ?';
    values.push(id);

    const [result] = await pool.query(updateQuery, values);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Player not found');
    }

    res.json({ message: 'Player updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Delete player
router.delete('/:id', verifyToken, authorize('admin'), async (req, res, next) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM players WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Player not found');
    }

    res.json({ message: 'Player deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Game Client: Update Tutorial Status
router.post('/update-tutorial-status', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: 'Player ID required' });

  try {
    const [result] = await pool.query(
      'UPDATE players SET has_completed_tutorial = true WHERE id = ?',
      [playerId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Player not found');
    }

    res.json({ message: 'Tutorial status updated to true' });
  } catch (err) {
    next(err);
  }
});

// Game Client: Update Quest Status
router.post('/update-quest-status', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { playerId, currentMainQuest, currentSubQuest } = req.body;

  if (!playerId || currentMainQuest === undefined || currentSubQuest === undefined) {
    return res.status(400).json({ error: 'playerId, currentMainQuest, and currentSubQuest are required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE players SET current_quest_id = ?, current_sub_quest = ? WHERE id = ?',
      [currentMainQuest, currentSubQuest, playerId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Player not found');
    }

    res.json({ message: 'Quest status updated successfully' });
  } catch (err) {
    next(err);
  }
});
// ==========================================
// POST: COMPLETE QUEST & ADD PROGRESSION
// ==========================================
router.post('/:id/complete-quest', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { id } = req.params; // The Player's ID
  const { currentMainQuest, currentSubQuest, quest_id, xp_reward, advance_to_chapter } = req.body;

  try {
    // 1. Log the quest as 'completed' in the player_quests table
    await pool.query(
      `INSERT INTO player_quests (player_id, quest_id, status, progress_percent, completed_at)
       VALUES (?, ?, 'completed', 100, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE status = 'completed', progress_percent = 100, completed_at = CURRENT_TIMESTAMP`,
      [id, quest_id]
    );

    // 2. Fetch the player's current stats
    const [players] = await pool.query('SELECT level, experience, chapter FROM players WHERE id = ?', [id]);
    if (players.length === 0) return res.status(404).json({ error: 'Player not found' });

    let { level, experience, chapter } = players[0];

    // 3. Add the XP and handle "Leveling Up"
    experience += (xp_reward || 500); // Default to 500 XP if not specified
    let xpNeededForNextLevel = level * 1000;

    if (experience >= xpNeededForNextLevel) {
      level += 1; // Level up!
      experience -= xpNeededForNextLevel; // Keep rollover XP
    }

    // 4. Advance Chapter (Only if Unity tells us they finished a Main Chapter)
    if (advance_to_chapter) {
      chapter = advance_to_chapter;
    }

    // 5. Update the player's current quest progression
    await pool.query(
      'UPDATE players SET current_quest_id = ?, current_sub_quest = ?, level = ?, experience = ?, chapter = ? WHERE id = ?',
      [currentMainQuest, currentSubQuest, level, experience, chapter, id]
    );

    res.json({
      message: 'Quest Completed!',
      newLevel: level,
      newExperience: experience,
      newChapter: chapter
    });

  } catch (err) {
    console.error("Progression Error:", err);
    next(err);
  }
});

// ============================================================
// GET: PLAYER PROGRESSION (Detailed quest completion breakdown)
// ============================================================
router.get('/:id/progression', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { id } = req.params;

  try {
    // 1. Fetch the player's basic info
    const [players] = await pool.query(
      'SELECT id, name, username, chapter, current_quest_id, current_sub_quest, suspicion FROM players WHERE id = ?',
      [id]
    );

    if (players.length === 0) {
      throw new NotFoundError('Player not found');
    }

    const player = players[0];

    // 2. Fetch all quests grouped by chapter
    const [allQuests] = await pool.query(
      `SELECT q.id, q.chapter, q.main_quest, q.sub_quest, q.title, q.status,
       pq.status as player_status, pq.progress_percent, pq.completed_at
       FROM quests q
       LEFT JOIN player_quests pq ON pq.quest_id = q.id AND pq.player_id = ?
       WHERE q.status = 'active'
       ORDER BY q.chapter, q.main_quest, q.sub_quest`,
      [id]
    );

    // 3. Build structured progression
    const chaptersMap = {};
    let totalSubQuests = 0;
    let completedSubQuests = 0;

    allQuests.forEach(q => {
      if (!chaptersMap[q.chapter]) {
        chaptersMap[q.chapter] = { chapter: q.chapter, quests: {} };
      }

      if (!chaptersMap[q.chapter].quests[q.main_quest]) {
        chaptersMap[q.chapter].quests[q.main_quest] = {
          quest: q.main_quest,
          sub_quests: []
        };
      }

      totalSubQuests++;
      const isCompleted = q.player_status === 'completed';
      if (isCompleted) completedSubQuests++;

      chaptersMap[q.chapter].quests[q.main_quest].sub_quests.push({
        sub_quest: q.sub_quest,
        quest_id: q.id,
        title: q.title,
        status: isCompleted ? 'completed' : (q.player_status || 'not_started'),
        progress_percent: q.progress_percent || 0,
        completed_at: q.completed_at
      });
    });

    // Convert to arrays and add completion percentages
    const chapters = Object.values(chaptersMap).map(ch => {
      const questsArray = Object.values(ch.quests).map(mq => {
        const completed = mq.sub_quests.filter(sq => sq.status === 'completed').length;
        const total = mq.sub_quests.length;
        return {
          ...mq,
          completion: total > 0 ? Math.round((completed / total) * 100) : 0,
          completed_count: completed,
          total_count: total
        };
      });

      return {
        chapter: ch.chapter,
        quests: questsArray
      };
    });

    // 4. Build codex string
    const codex = `${player.chapter}-${player.current_quest_id || 1}`;
    const overallProgress = totalSubQuests > 0
      ? Math.round((completedSubQuests / totalSubQuests) * 100)
      : 0;

    res.json({
      player_id: player.id,
      player_name: player.name,
      current_chapter: player.chapter,
      current_quest: player.current_quest_id,
      current_sub_quest: player.current_sub_quest,
      codex,
      overall_progress: overallProgress,
      completed_sub_quests: completedSubQuests,
      total_sub_quests: totalSubQuests,
      chapters
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;