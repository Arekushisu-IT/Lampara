const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');
const { NotFoundError } = require('../src/utils/errors');

const router = express.Router();

// ============================================================
// GET /api/game/quest-content/:chapter/:quest/:subquest
// Unity Game Client fetches all dialogue content for a specific sub-quest
// ============================================================
router.get('/quest-content/:chapter/:quest/:subquest', verifyToken, async (req, res, next) => {
  const { chapter, quest, subquest } = req.params;

  try {
    // 1. Find the quest record
    const [quests] = await pool.query(
      'SELECT id, chapter, main_quest, sub_quest, title, description, artifact_resource_path, status FROM quests WHERE chapter = ? AND main_quest = ? AND sub_quest = ?',
      [chapter, quest, subquest]
    );

    if (quests.length === 0) {
      throw new NotFoundError(`Quest not found: Chapter ${chapter}, Quest ${quest}, Sub-Quest ${subquest}`);
    }

    const questData = quests[0];

    // 2. Fetch all dialogues for this sub-quest
    const [dialogues] = await pool.query(
      `SELECT id, sequence_order, npc_name, npc_text, option_a_text, option_b_text, option_c_text,
              option_a_correct, option_b_correct, option_c_correct, suspicion_penalty
       FROM quest_dialogues
       WHERE quest_id = ?
       ORDER BY sequence_order`,
      [questData.id]
    );

    res.json({
      quest: {
        id: questData.id,
        chapter: questData.chapter,
        quest: questData.main_quest,
        sub_quest: questData.sub_quest,
        title: questData.title,
        description: questData.description,
        artifact_resource_path: questData.artifact_resource_path,
        status: questData.status
      },
      dialogues,
      dialogue_count: dialogues.length
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/game/config
// Unity Game Client fetches all game configuration (suspicion meter etc.)
// ============================================================
router.get('/config', verifyToken, async (req, res, next) => {
  try {
    const [configs] = await pool.query(
      'SELECT config_key, config_value FROM game_config ORDER BY id'
    );

    // Return as a flat key-value map for easy consumption by Unity
    const configMap = {};
    configs.forEach(c => { configMap[c.config_key] = c.config_value; });

    res.json(configMap);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/game/quest-list/:chapter
// Unity fetches all quests for a chapter (for quest selection screen)
// ============================================================
router.get('/quest-list/:chapter', verifyToken, async (req, res, next) => {
  const { chapter } = req.params;

  try {
    const [quests] = await pool.query(
      `SELECT q.id, q.chapter, q.main_quest, q.sub_quest, q.title, q.description, q.artifact_resource_path, q.status,
       (SELECT COUNT(*) FROM quest_dialogues qd WHERE qd.quest_id = q.id) as dialogue_count
       FROM quests q 
       WHERE q.chapter = ? AND q.status = 'active'
       ORDER BY q.main_quest, q.sub_quest`,
      [chapter]
    );

    res.json({
      chapter: parseInt(chapter),
      count: quests.length,
      quests
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
