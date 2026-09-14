const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');
const { NotFoundError } = require('../src/utils/errors');
const { buildOptionDeltas } = require('../src/utils/dialogues');

const router = express.Router();

// ============================================================
// GET /api/game/quest-content/:chapter/:quest/:subquest
// Unity Game Client fetches all dialogue content for a specific sub-quest
// ============================================================
router.get('/quest-content/:chapter/:quest/:subquest', verifyToken, async (req, res, next) => {
  // :chapter stays in the URL for installed APKs but is ignored. The game sends the
  // main-quest number there while every quests row stores chapter = 1, so filtering on
  // it 404'd every sub-quest past MQ1 -- admin-edited dialogue and the AR artifact path
  // never reached the game. (main_quest, sub_quest) identifies the row on its own.
  const { quest, subquest } = req.params;

  try {
    // 1. Find the quest record
    const [quests] = await pool.query(
      'SELECT id, chapter, chapter_start, chapter_end, main_quest, sub_quest, title, description, artifact_resource_path, status FROM quests WHERE main_quest = ? AND sub_quest = ?',
      [quest, subquest]
    );

    if (quests.length === 0) {
      throw new NotFoundError(`Quest not found: MQ${quest} SQ${subquest}`);
    }

    const questData = quests[0];

    // 2. Fetch all dialogues for this sub-quest
    const [dialogues] = await pool.query(
      `SELECT id, sequence_order, npc_name, npc_text, option_a_text, option_b_text, option_c_text,
              option_a_correct, option_b_correct, option_c_correct, suspicion_penalty,
              option_a_delta, option_b_delta, option_c_delta
       FROM quest_dialogues
       WHERE quest_id = ?
       ORDER BY sequence_order`,
      [questData.id]
    );

    res.json({
      quest: {
        id: questData.id,
        chapter: questData.chapter,
        chapter_start: questData.chapter_start,
        chapter_end: questData.chapter_end,
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
// POST /api/game/save-dialogues/:chapter/:quest/:subquest
// Unity pushes full dialogue array from Inspector for a sub-quest
// Performs UPSERT: UPDATE if quest_id+sequence_order exists, INSERT otherwise
// ============================================================
router.post('/save-dialogues/:chapter/:quest/:subquest', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  // :chapter is ignored for the same reason as GET /quest-content above.
  const { quest, subquest } = req.params;
  const { dialogues } = req.body;

  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return res.status(400).json({ error: 'dialogues array is required and must not be empty' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Look up quest_id
    const [quests] = await conn.query(
      'SELECT id FROM quests WHERE main_quest = ? AND sub_quest = ?',
      [quest, subquest]
    );

    if (quests.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: `Quest not found: MQ${quest} SQ${subquest}` });
    }

    const questId = quests[0].id;
    let savedCount = 0;

    for (const d of dialogues) {
      // Skip entries with no meaningful content
      if (!d.npc_text || !d.option_a_text || !d.option_b_text) {
        console.log(`[save-dialogues] Skipping dialogue at sequence_order=${d.sequence_order}: missing required text fields`);
        continue;
      }

      const npcName = d.npc_name || 'NPC';
      const npcText = d.npc_text;
      const optionAText = d.option_a_text;
      const optionBText = d.option_b_text;
      const optionCText = d.option_c_text || null;
      const optionACorrect = d.option_a_correct ? 1 : 0;
      const optionBCorrect = d.option_b_correct ? 1 : 0;
      const optionCCorrect = d.option_c_correct ? 1 : 0;
      const { optionADelta, optionBDelta, optionCDelta, suspicionPenalty } = buildOptionDeltas(d);

      // Check if dialogue with this sequence_order already exists
      const [existing] = await conn.query(
        'SELECT id FROM quest_dialogues WHERE quest_id = ? AND sequence_order = ?',
        [questId, d.sequence_order]
      );

      if (existing.length > 0) {
        // UPDATE
        await conn.query(
          `UPDATE quest_dialogues SET
            npc_name = ?, npc_text = ?, option_a_text = ?, option_b_text = ?, option_c_text = ?,
            option_a_correct = ?, option_b_correct = ?, option_c_correct = ?,
            suspicion_penalty = ?, option_a_delta = ?, option_b_delta = ?, option_c_delta = ?, updated_at = NOW()
          WHERE quest_id = ? AND sequence_order = ?`,
          [npcName, npcText, optionAText, optionBText, optionCText,
           optionACorrect, optionBCorrect, optionCCorrect,
           suspicionPenalty, optionADelta, optionBDelta, optionCDelta, questId, d.sequence_order]
        );
      } else {
        // INSERT
        await conn.query(
          `INSERT INTO quest_dialogues
            (quest_id, sequence_order, npc_name, npc_text, option_a_text, option_b_text, option_c_text,
             option_a_correct, option_b_correct, option_c_correct, suspicion_penalty, option_a_delta, option_b_delta, option_c_delta)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [questId, d.sequence_order, npcName, npcText, optionAText, optionBText, optionCText,
           optionACorrect, optionBCorrect, optionCCorrect, suspicionPenalty, optionADelta, optionBDelta, optionCDelta]
        );
      }
      savedCount++;
    }

    await conn.commit();
    res.json({ success: true, saved: savedCount, quest_id: questId });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
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
// Unity fetches the playable quest list (for quest selection screen).
// :chapter is kept for URL compatibility but ignored -- it is not a meaningful
// filter (every quests row stores chapter = 1), so all active quests are returned.
// ============================================================
router.get('/quest-list/:chapter', verifyToken, async (req, res, next) => {
  const { chapter } = req.params;

  try {
    const [quests] = await pool.query(
      `SELECT q.id, q.chapter, q.chapter_start, q.chapter_end, q.main_quest, q.sub_quest, q.title, q.description,
              q.artifact_resource_path, q.status,
       (SELECT COUNT(*) FROM quest_dialogues qd WHERE qd.quest_id = q.id) as dialogue_count
       FROM quests q
       WHERE q.status = 'active'
       ORDER BY q.main_quest, q.sub_quest`
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
