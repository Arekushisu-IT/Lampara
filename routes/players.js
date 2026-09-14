const express = require('express');
const { validationResult } = require('express-validator');
const pool = require('../db');

// Use the SHARED middleware instead of a copy-paste
const verifyToken = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');
const { NotFoundError, ValidationError } = require('../src/utils/errors');
const { validatePlayerCreate, validatePlayerUpdate, validate } = require('../src/middleware/validation');
const { artifactNameFromPath } = require('../src/utils/artifacts');

const router = express.Router();

// Get all players (admin/staff only)
router.get('/', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const [players] = await pool.query(
      `SELECT p.id, p.name, p.username, p.email, p.birthdate, p.level, p.experience,
              p.status, p.is_online, p.chapter, p.suspicion, p.current_quest_id,
              p.current_sub_quest, p.created_at,
              (SELECT cq.chapter_start FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as book_chapter_start,
              (SELECT cq.chapter_end FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as book_chapter_end,
              (SELECT COUNT(*) FROM player_quests apq JOIN quests aq ON aq.id = apq.quest_id WHERE apq.player_id = p.id AND apq.artifacts_found > 0 AND aq.artifacts_total > 0 AND aq.status = 'active') as artifacts_collected,
              (SELECT COUNT(*) FROM quests aq WHERE aq.status = 'active' AND aq.artifacts_total > 0) as artifacts_total,
              (SELECT COALESCE(SUM(fpq.failure_count), 0) FROM player_quests fpq WHERE fpq.player_id = p.id) as total_failures,
              COALESCE(ROUND((SELECT COUNT(*) FROM player_quests pq WHERE pq.player_id = p.id AND pq.status = 'completed') * 100.0 / NULLIF((SELECT COUNT(*) FROM quests WHERE status = 'active'), 0), 0), 0) as overall_progress
       FROM players p ORDER BY p.created_at DESC`
    );

    const count7dResult = await pool.query(
      'SELECT COUNT(*) as c FROM players WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    res.json({
      count: players.length,
      players,
      stats: {
        weeklyNew: count7dResult[0][0].c || 0
      }
    });
  } catch (err) {
    next(err);
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
  const { name, username, email, birthdate, level = 1, experience = 0, status = 'active' } = req.body;

  try {
    // Generate a random password and include it in the response for the admin to share
    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const bcryptjs = require('bcryptjs');
    const hashedPassword = await bcryptjs.hash(tempPassword, 10);

    const [result] = await pool.query(
      'INSERT INTO players (name, username, password, email, birthdate, level, experience, status, is_online) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false)',
      [name, username, hashedPassword, email || null, birthdate, level, experience, status]
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
  const { name, username, email, birthdate, level, experience, status, is_online } = req.body;

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
    if (birthdate !== undefined) {
      updates.push('birthdate = ?');
      values.push(birthdate);
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

// Game Client: Update Tutorial Status (player can update their own status)
router.post('/update-tutorial-status', verifyToken, async (req, res, next) => {
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'Player ID required' });
  }

  // Security: Players can only update their own tutorial status
  // Admin/staff can update any player's status
  const userRole = req.user.role;
  const userId = req.user.id;

  // Convert both to numbers for safe comparison
  if (userRole !== 'admin' && userRole !== 'staff' && Number(userId) !== Number(playerId)) {
    return res.status(403).json({ error: 'Forbidden: cannot update another player\'s tutorial status' });
  }

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

// Game Client: Update Quest Status (player can update their own quest status)
router.post('/update-quest-status', verifyToken, async (req, res, next) => {
  const { playerId, currentMainQuest, currentSubQuest } = req.body;

  if (!playerId || currentMainQuest === undefined || currentSubQuest === undefined) {
    return res.status(400).json({ error: 'playerId, currentMainQuest, and currentSubQuest are required' });
  }

  // Security: Players can only update their own quest status
  // Admin/staff can update any player's status
  const userRole = req.user.role;
  const userId = req.user.id;

  // FIXED: Use Number() conversion to prevent type mismatch bypass
  if (userRole !== 'admin' && userRole !== 'staff' && Number(userId) !== Number(playerId)) {
    return res.status(403).json({ error: 'Forbidden: cannot update another player\'s quest status' });
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
router.post('/:id/complete-quest', verifyToken, async (req, res, next) => {
  const { id } = req.params; // The Player's ID
  const {
    currentMainQuest, currentSubQuest, quest_id, xp_reward, advance_to_chapter,
    failure_count, artifacts_found, currentSuspicion
  } = req.body;

  // Security: Players can only complete their own quests
  // Admin/staff can complete any player's quest
  const userRole = req.user.role;
  const userId = req.user.id;

  if (userRole !== 'admin' && userRole !== 'staff' && userId !== parseInt(id)) {
    return res.status(403).json({ error: 'Forbidden: cannot complete another player\'s quest' });
  }

  let conn;
  try {
    // 0. Resolve the quest row.
    //    quest_id is authoritative: it identifies the quest the player just COMPLETED.
    //    currentMainQuest / currentSubQuest are the player's NEW position after
    //    advancing, so they must NOT be used to resolve this row -- the old
    //    (chapter, main_quest, sub_quest) fallback resolved to the *next* quest and
    //    would have filed the completion against the wrong row. Removed, not reordered.
    const resolvedQuestId = Number(quest_id);
    if (!Number.isInteger(resolvedQuestId) || resolvedQuestId < 1) {
      return res.status(400).json({ error: 'quest_id is required and must be a positive integer' });
    }

    const [questCheck] = await pool.query('SELECT id FROM quests WHERE id = ?', [resolvedQuestId]);
    if (questCheck.length === 0) {
      return res.status(404).json({ error: 'Quest not found in database — cannot complete quest' });
    }

    // Use a transaction so quest completion + XP/level update are atomic
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1a. Idempotency guard: was this quest ALREADY completed?
    //     Must be read before the upsert below, which sets status='completed'.
    //     A repeat completion still records metrics and advances position,
    //     but awards ZERO XP -- otherwise replaying a quest farms XP forever.
    const [existingQuest] = await conn.query(
      "SELECT status FROM player_quests WHERE player_id = ? AND quest_id = ? FOR UPDATE",
      [id, resolvedQuestId]
    );
    const isRepeatCompletion = existingQuest.length > 0 && existingQuest[0].status === 'completed';

    // 1b. Log the quest as 'completed' in the player_quests table.
    //    failure_count / artifacts_found are the FR5-FR7 metrics Unity reports.
    //    Both are MONOTONIC -- GREATEST, not a blind overwrite. The client sends a
    //    running absolute total, so replaying a quest cleanly used to overwrite the
    //    recorded failures with a lower number and the lifetime record could fall.
    //    Monotonic also makes the write idempotent, so a redelivered offline
    //    request is a harmless no-op.
    await conn.query(
      `INSERT INTO player_quests
         (player_id, quest_id, status, progress_percent, failure_count, artifacts_found, completed_at)
       VALUES (?, ?, 'completed', 100, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE status = 'completed', progress_percent = 100,
         failure_count   = GREATEST(failure_count,   VALUES(failure_count)),
         artifacts_found = GREATEST(artifacts_found, VALUES(artifacts_found)),
         completed_at = CURRENT_TIMESTAMP`,
      [id, resolvedQuestId, failure_count || 0, artifacts_found || 0]
    );

    // 2. Fetch the player's current stats
    const [players] = await conn.query('SELECT level, experience, chapter FROM players WHERE id = ?', [id]);
    if (players.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Player not found' });
    }

    let { level, experience, chapter } = players[0];

    // 3. Add the XP and handle "Leveling Up"
    //    Repeat completions award nothing (see the idempotency guard above).
    // XP is a property of the quest, not something the client gets to nominate.
    // xp_reward still arrives on the wire from older builds; it is deliberately ignored.
    // TODO: move to a quests.xp_reward column so the award can vary per quest.
    const QUEST_XP = 500;
    const effectiveXpReward = isRepeatCompletion ? 0 : QUEST_XP;
    experience += effectiveXpReward;

    // while, not if: a single large reward can cross more than one level boundary
    while (experience >= level * 1000) {
      experience -= level * 1000; // Keep rollover XP
      level += 1;                 // Level up!
    }

    // 4. Advance Chapter (Only if Unity tells us they finished a Main Chapter)
    // Chapter advances by at most one step and never moves backwards, so a patched
    // client cannot jump straight to the endgame.
    const requestedChapter = Number(advance_to_chapter);
    if (Number.isInteger(requestedChapter) && requestedChapter > chapter) {
      chapter = Math.min(requestedChapter, chapter + 1);
    }

    // 5. Update the player's current quest progression
    // Suspicion is only written when the client actually sends it, so an older build
    // that omits the field leaves the stored value alone rather than zeroing it.
    const suspicion =
      currentSuspicion === undefined || currentSuspicion === null
        ? null
        : Math.max(0, Math.min(100, Number(currentSuspicion) || 0));

    await conn.query(
      `UPDATE players SET current_quest_id = ?, current_sub_quest = ?, level = ?,
         experience = ?, chapter = ?, suspicion = COALESCE(?, suspicion) WHERE id = ?`,
      [currentMainQuest, currentSubQuest, level, experience, chapter, suspicion, id]
    );

    await conn.commit();

    res.json({
      message: isRepeatCompletion ? 'Quest already completed - no XP awarded.' : 'Quest Completed!',
      newLevel: level,
      newExperience: experience,
      newChapter: chapter,
      xpAwarded: effectiveXpReward,
      repeatCompletion: isRepeatCompletion
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Progression Error:", err);
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

// ==========================================
// POST: SAVE MID-QUEST CHECKPOINT
// Lets the Unity Pause Menu "Save Game" persist progress server-side
// so a player can resume on another device.
// ==========================================
router.post('/:id/save-checkpoint', verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const {
    currentMainQuest, currentSubQuest, currentSuspicion, suspicionSeq,
    failureCount, artifactsFound
  } = req.body;

  if (currentMainQuest === undefined || currentSubQuest === undefined) {
    return res.status(400).json({ error: 'currentMainQuest and currentSubQuest are required' });
  }

  // Security: players can only checkpoint themselves; admin/staff can do any player
  const userRole = req.user.role;
  const userId = req.user.id;

  if (userRole !== 'admin' && userRole !== 'staff' && Number(userId) !== Number(id)) {
    return res.status(403).json({ error: 'Forbidden: cannot save another player\'s checkpoint' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [players] = await conn.query(
      'SELECT suspicion, suspicion_seq FROM players WHERE id = ? FOR UPDATE', [id]);
    if (players.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Player not found' });
    }

    // ----------------------------------------------------------------
    // Suspicion write, guarded by a monotonic sequence number.
    //
    // suspicion is a running 0-100 meter that moves in BOTH directions: it rises on
    // a wrong choice, falls on a streak bonus, and resets to 0 when a failure at 100
    // restarts the sub-quest. So it cannot use the GREATEST() merge that makes
    // failure_count and artifacts_found idempotent -- given two values there is no
    // way to tell which is newer.
    //
    // That matters because the client's live send path does not check whether its
    // offline queue is non-empty before firing, so a request queued while offline can
    // be overtaken by a later live one and then replayed on top of it. Without this
    // guard a stale "suspicion = 100" can land after a fresh "suspicion = 0", and the
    // player is restored into a permanent game over on next login.
    //
    // Three cases:
    //   - no currentSuspicion        -> leave the stored value alone (unchanged behaviour)
    //   - currentSuspicion, no seq   -> apply unconditionally, so existing APKs that
    //                                   predate G4 keep working through the rollout
    //   - currentSuspicion + seq     -> apply only when the payload is newer
    //
    // Deliberately NOT applied to current_quest_id / current_sub_quest: the sequence
    // counts dialogue choices, and a player can change position without making one
    // (finishing a sub-quest, quitting from a cutscene). Gating position on a choice
    // counter would silently reject legitimate progress.
    // ----------------------------------------------------------------
    const storedSuspicion = players[0].suspicion;
    const storedSeq = players[0].suspicion_seq || 0;

    const hasSuspicion = currentSuspicion !== undefined && currentSuspicion !== null;
    const parsedSeq = Number(suspicionSeq);
    const hasSeq = Number.isInteger(parsedSeq) && parsedSeq >= 0;

    const suspicion = hasSuspicion
      ? Math.max(0, Math.min(100, Number(currentSuspicion) || 0))
      : storedSuspicion;

    // A rejected write is NOT an error. It must still return 2xx so the client's
    // offline queue consumes and discards it instead of retrying it forever.
    const suspicionApplied = hasSuspicion && (!hasSeq || parsedSeq > storedSeq);
    const nextSeq = hasSeq ? Math.max(storedSeq, parsedSeq) : storedSeq;

    if (suspicionApplied) {
      await conn.query(
        `UPDATE players SET current_quest_id = ?, current_sub_quest = ?,
           suspicion = ?, suspicion_seq = ? WHERE id = ?`,
        [currentMainQuest, currentSubQuest, suspicion, nextSeq, id]
      );
    } else {
      // Position still advances -- only the suspicion write was stale.
      await conn.query(
        `UPDATE players SET current_quest_id = ?, current_sub_quest = ?,
           suspicion_seq = ? WHERE id = ?`,
        [currentMainQuest, currentSubQuest, nextSeq, id]
      );
      if (hasSuspicion) {
        console.warn(
          `[save-checkpoint] Stale suspicion write for player ${id} ignored ` +
          `(seq ${parsedSeq} <= stored ${storedSeq}).`
        );
      }
    }

    // Persist the in-progress failure count against the quest the player is on.
    // The quest row is identified by (main_quest, sub_quest) ONLY. `chapter` is not a
    // lookup key: every quests row stores chapter = 1, while players.chapter holds the
    // main-quest number, so including it matched nothing past MQ1 and every MQ2+
    // in-progress failure/artifact was silently dropped. Skip silently if the position
    // has no quest row (e.g. the slot after the final quest).
    let questId = null;
    if (failureCount !== undefined || artifactsFound !== undefined) {
      const [questRows] = await conn.query(
        'SELECT id FROM quests WHERE main_quest = ? AND sub_quest = ?',
        [currentMainQuest, currentSubQuest]
      );

      if (questRows.length > 0) {
        questId = questRows[0].id;
        // Never downgrade an already-completed quest back to in_progress.
        // Counters are monotonic here too -- this is the path OnSuspicionGameOver
        // posts to, so it is what actually records an FR6 "Cover Blown" failure.
        await conn.query(
          `INSERT INTO player_quests (player_id, quest_id, status, failure_count, artifacts_found)
           VALUES (?, ?, 'in_progress', ?, ?)
           ON DUPLICATE KEY UPDATE
             failure_count   = GREATEST(failure_count,   VALUES(failure_count)),
             artifacts_found = GREATEST(artifacts_found, VALUES(artifacts_found)),
             status = IF(status = 'completed', 'completed', 'in_progress')`,
          [id, questId, failureCount || 0, artifactsFound || 0]
        );
      }
    }

    await conn.commit();

    res.json({
      message: 'Checkpoint saved',
      current_quest_id: currentMainQuest,
      current_sub_quest: currentSubQuest,
      // The value now in the database, which is NOT what was sent when the write was
      // rejected as stale. The client should reconcile against this rather than assume
      // its own number won.
      suspicion: suspicionApplied ? suspicion : storedSuspicion,
      suspicion_seq: nextSeq,
      suspicion_applied: suspicionApplied,
      quest_id: questId
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

// ============================================================
// GET: PLAYER PROGRESSION (Detailed quest completion breakdown)
// ============================================================
router.get('/:id/progression', verifyToken, async (req, res, next) => {
  const { id } = req.params;

  // Admin/staff may read anyone; a player may read only their own. The player portal
  // calls this with a player token, and the previous admin/staff-only guard returned
  // 403 to every player. role === 'player' is required for the self check because
  // admin-panel accounts have their own numeric ids that could equal a player id.
  const role = req.user.role;
  const isStaff = role === 'admin' || role === 'staff';
  const isSelf = role === 'player' && Number(req.user.id) === Number(id);
  if (!isStaff && !isSelf) {
    return res.status(403).json({ error: "Forbidden: cannot view another player's progression" });
  }

  try {
    // 1. Fetch the player's basic info
    const [players] = await pool.query(
      `SELECT p.id, p.name, p.username, p.status, p.chapter, p.current_quest_id, p.current_sub_quest, p.suspicion,
              (SELECT cq.chapter_start FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as book_chapter_start,
              (SELECT cq.chapter_end FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as book_chapter_end
         FROM players p WHERE p.id = ?`,
      [id]
    );

    if (players.length === 0) {
      throw new NotFoundError('Player not found');
    }

    const player = players[0];

    // 2. Fetch all quests, grouped below by main quest
    const [allQuests] = await pool.query(
      `SELECT q.id, q.main_quest, q.sub_quest, q.chapter_start, q.chapter_end, q.title, q.status,
       q.artifacts_total,
       pq.status as player_status, pq.progress_percent, pq.completed_at,
       pq.failure_count, pq.artifacts_found
       FROM quests q
       LEFT JOIN player_quests pq ON pq.quest_id = q.id AND pq.player_id = ?
       WHERE q.status = 'active'
       ORDER BY q.main_quest, q.sub_quest`,
      [id]
    );

    // 3. Build structured progression, one entry per main quest. (Grouping by
    //    quests.chapter produced a single "Chapter 1" bucket -- that column is legacy
    //    and always 1. Book chapters come from chapter_start / chapter_end.)
    const mainQuestMap = {};
    let totalSubQuests = 0;
    let completedSubQuests = 0;
    let totalFailures = 0;
    let totalArtifactsFound = 0;
    let totalArtifactsAvailable = 0;

    allQuests.forEach(q => {
      if (!mainQuestMap[q.main_quest]) {
        mainQuestMap[q.main_quest] = { main_quest: q.main_quest, sub_quests: [] };
      }

      totalSubQuests++;
      const isCompleted = q.player_status === 'completed';
      if (isCompleted) completedSubQuests++;

      const failureCount = q.failure_count || 0;
      const artifactsFound = q.artifacts_found || 0;
      const artifactsTotal = q.artifacts_total || 0;

      totalFailures += failureCount;
      // Capped at what the quest holds: more than one game script can record the
      // same artifact, and the completion rate must never exceed 100%.
      totalArtifactsFound += Math.min(artifactsFound, artifactsTotal);
      totalArtifactsAvailable += artifactsTotal;

      mainQuestMap[q.main_quest].sub_quests.push({
        sub_quest: q.sub_quest,
        quest_id: q.id,
        title: q.title,
        chapter_start: q.chapter_start,
        chapter_end: q.chapter_end,
        status: isCompleted ? 'completed' : (q.player_status || 'not_started'),
        progress_percent: q.progress_percent || 0,
        failure_count: failureCount,
        artifacts_found: artifactsFound,
        artifacts_total: artifactsTotal,
        completed_at: q.completed_at
      });
    });

    // Summarise each main quest: completion, plus the book-chapter span it covers
    // (the lowest chapter_start to the highest chapter_end of its sub-quests).
    const mainQuests = Object.values(mainQuestMap).map(mq => {
      const completed = mq.sub_quests.filter(sq => sq.status === 'completed').length;
      const total = mq.sub_quests.length;
      const starts = mq.sub_quests.map(sq => sq.chapter_start).filter(v => v != null);
      const ends = mq.sub_quests.map(sq => sq.chapter_end).filter(v => v != null);
      return {
        ...mq,
        chapter_start: starts.length ? Math.min(...starts) : null,
        chapter_end: ends.length ? Math.max(...ends) : null,
        completion: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed_count: completed,
        total_count: total
      };
    });

    // 4. Build codex string
    const codex = `${player.chapter}-${player.current_quest_id || 1}`;
    const overallProgress = totalSubQuests > 0
      ? Math.round((completedSubQuests / totalSubQuests) * 100)
      : 0;

    // FR5: Artifact Completion Rate — R = (found / total) * 100
    const artifactCompletionRate = totalArtifactsAvailable > 0
      ? Math.round((totalArtifactsFound / totalArtifactsAvailable) * 100)
      : 0;

    res.json({
      player_id: player.id,
      player_name: player.name,
      status: player.status,
      suspicion: player.suspicion,
      current_chapter: player.chapter,
      current_book_chapter_start: player.book_chapter_start,
      current_book_chapter_end: player.book_chapter_end,
      current_quest: player.current_quest_id,
      current_sub_quest: player.current_sub_quest,
      codex,
      overall_progress: overallProgress,
      completed_sub_quests: completedSubQuests,
      total_sub_quests: totalSubQuests,
      total_failures: totalFailures,
      artifacts_found: totalArtifactsFound,
      artifacts_total: totalArtifactsAvailable,
      artifact_completion_rate: artifactCompletionRate,
      main_quests: mainQuests
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET: PLAYER ARTIFACT COLLECTION (glossary data)
// Every sub-quest's artifact in game order, with whether this player has collected
// it. Used by the admin player profile, and ready for the in-game glossary.
// ============================================================
router.get('/:id/artifacts', verifyToken, async (req, res, next) => {
  const { id } = req.params;

  // Same access rule as /progression: admin/staff read anyone, a player reads only
  // their own (role must be 'player' -- admin-panel ids can equal player ids).
  const role = req.user.role;
  const isStaff = role === 'admin' || role === 'staff';
  const isSelf = role === 'player' && Number(req.user.id) === Number(id);
  if (!isStaff && !isSelf) {
    return res.status(403).json({ error: "Forbidden: cannot view another player's artifacts" });
  }

  try {
    const [players] = await pool.query('SELECT id, name FROM players WHERE id = ?', [id]);
    if (players.length === 0) {
      throw new NotFoundError('Player not found');
    }

    // One AR artifact per sub-quest, so the player's row for the quest is the record:
    // collected when artifacts_found > 0. A quest holds an artifact when
    // artifacts_total > 0 -- the same rule GET /players and the leaderboard count with,
    // so every "X of Y" agrees. artifact_name is null while a path is not yet set.
    const [rows] = await pool.query(
      `SELECT q.id AS quest_id, q.main_quest, q.sub_quest, q.chapter_start, q.chapter_end,
              q.title AS quest_title, q.artifact_resource_path,
              COALESCE(pq.artifacts_found, 0) > 0 AS collected
         FROM quests q
         LEFT JOIN player_quests pq ON pq.quest_id = q.id AND pq.player_id = ?
        WHERE q.status = 'active' AND q.artifacts_total > 0
        ORDER BY q.main_quest, q.sub_quest`,
      [id]
    );

    const artifacts = rows.map(r => ({
      quest_id: r.quest_id,
      main_quest: r.main_quest,
      sub_quest: r.sub_quest,
      chapter_start: r.chapter_start,
      chapter_end: r.chapter_end,
      quest_title: r.quest_title,
      artifact_name: artifactNameFromPath(r.artifact_resource_path),
      artifact_resource_path: r.artifact_resource_path,
      collected: Boolean(r.collected)
    }));

    res.json({
      player_id: players[0].id,
      player_name: players[0].name,
      collected: artifacts.filter(a => a.collected).length,
      total: artifacts.length,
      artifacts
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;