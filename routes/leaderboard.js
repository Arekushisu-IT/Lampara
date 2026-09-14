const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');
const { NotFoundError } = require('../src/utils/errors');

const router = express.Router();

/**
 * Unified Ranking Strategy:
 *   1. Quest Progress (DESC)     — players further in the story rank higher
 *   2. Total Failures ASC        — FR6 "Cover Blown" count, fewer = better rank
 *   3. Suspicion ASC             — current meter breaks ties between equal failures
 *   4. Updated At (DESC)         — recent activity breaks the remaining ties
 */
const RANKING_ORDER = 'questProgress DESC, totalFailures ASC, p.suspicion ASC, p.updated_at DESC';

// ---------- shared helpers ----------

function buildRanking(playerRow, index) {
  return {
    rank:            index + 1,
    playerId:        playerRow.playerId,
    playerName:      playerRow.playerName,
    email:           playerRow.email,
    questProgress:   Math.min(100, playerRow.questProgress || 0),
    currentQuest:    playerRow.current_quest_id,
    currentSubQuest: playerRow.current_sub_quest,
    chapter:         playerRow.chapter,                 // main-quest number (legacy name)
    bookChapterStart: playerRow.bookChapterStart,       // El Filibusterismo chapters the
    bookChapterEnd:   playerRow.bookChapterEnd,         // player's current sub-quest covers
    failCount:       playerRow.totalFailures || 0,  // FR6: game-overs, from player_quests
    suspicion:       playerRow.suspicion || 0,      // current meter, not a fail count

    // Aliases for the Unity client. LeaderboardEntry (LeaderboardManager.cs) reads
    // currentMainQuest / suspicionScore / codexCompletion; without these three the
    // in-game leaderboard renders 0 in those columns. The web admin panel reads the
    // names above, so both spellings are emitted rather than renaming either.
    currentMainQuest: playerRow.current_quest_id,
    suspicionScore:   playerRow.suspicion || 0,
    codexCompletion:  Math.min(100, playerRow.codexCompletion || 0),
    questsCompleted: playerRow.questsCompleted || 0,
    isActive:        playerRow.isActive === 1,
    createdAt:       playerRow.created_at,
    updatedAt:       playerRow.updated_at,
    status:          playerRow.status
  };
}

const BASE_SELECT = `
  p.id               as playerId,
  p.name             as playerName,
  p.email            as email,
  p.chapter          as chapter,
  (SELECT cq.chapter_start FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as bookChapterStart,
  (SELECT cq.chapter_end FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as bookChapterEnd,
  p.current_quest_id,
  p.current_sub_quest,
  p.suspicion,
  p.status,
  p.is_online        as isActive,
  p.created_at,
  p.updated_at,
  ROUND(
    COALESCE(pq.quests_completed, 0) * 100.0 /
    GREATEST(
      (SELECT COUNT(*) FROM quests WHERE status = 'active'),
      1
    ),
    0
  ) as questProgress,
  COALESCE(pq.quests_completed, 0) as questsCompleted,
  COALESCE(pq.total_failures, 0)    as totalFailures,
  -- FR5 artifact completion, aggregated across every ACTIVE quest. Reads 0 while
  -- quests.artifacts_total is unpopulated (most quests are still 0), so this only
  -- becomes meaningful once real per-quest artifact counts are entered.
  ROUND(
    COALESCE(pq.total_artifacts, 0) * 100.0 /
    GREATEST((SELECT COALESCE(SUM(artifacts_total), 0) FROM quests WHERE status = 'active'), 1),
    0
  ) as codexCompletion
`;

const FROM_AND_JOINS = `
FROM players p
LEFT JOIN (
  -- The status filter moved into the COUNT so failures recorded on in-progress and
  -- failed rows are still summed; leaving it in the WHERE would drop them silently.
  SELECT player_id,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as quests_completed,
         SUM(failure_count)                               as total_failures,
         SUM(artifacts_found)                             as total_artifacts
  FROM player_quests
  GROUP BY player_id
) pq ON p.id = pq.player_id
`;

const ACTIVE_GROUP_BY = `WHERE p.status = 'active' GROUP BY p.id`;


// ============================================================
// GET /api/leaderboard/rankings
// ============================================================
router.get('/rankings', verifyToken, async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const parsedLimit  = Math.min(parseInt(limit)  || 100, 500);
    const parsedOffset = Math.max(parseInt(offset) || 0,   0);

    const query = `
      SELECT ${BASE_SELECT}
      ${FROM_AND_JOINS}
      ${ACTIVE_GROUP_BY}
      ORDER BY ${RANKING_ORDER}
      LIMIT ? OFFSET ?
    `;

    const [rankings] = await pool.query(query, [parsedLimit, parsedOffset]);

    const transformedRankings = rankings.map((row, idx) =>
      buildRanking(row, parsedOffset + idx)
    );

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM players WHERE status = ?',
      ['active']
    );

    res.json({
      success:     true,
      rankings:    transformedRankings,
      totalPlayers: total,
      pagination:  {
        limit:  parsedLimit,
        offset: parsedOffset,
        total
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});


// ============================================================
// GET /api/leaderboard/player/:playerId
// ============================================================
router.get('/player/:playerId', verifyToken, async (req, res, next) => {
  const { playerId } = req.params;

  try {
    const query = `
      SELECT ${BASE_SELECT}
      ${FROM_AND_JOINS}
      ${ACTIVE_GROUP_BY}
      ORDER BY ${RANKING_ORDER}
    `;

    const [allRankings] = await pool.query(query);

    const idx = allRankings.findIndex(r => r.playerId == playerId);
    if (idx === -1) {
      throw new NotFoundError('Player not found or inactive');
    }

    const playerData = allRankings[idx];
    const player = buildRanking(playerData, idx);

    res.json({
      success: true,
      player: {
        ...player,
        totalPlayers: allRankings.length
      }
    });
  } catch (err) {
    next(err);
  }
});


// ============================================================
// GET /api/leaderboard/top/:count
// ============================================================
router.get('/top/:count', verifyToken, async (req, res, next) => {
  try {
    const { count = 10 } = req.params;
    const parsedCount = Math.min(parseInt(count) || 10, 100);

    const query = `
      SELECT
        p.id              as playerId,
        p.name            as playerName,
        p.email           as email,
        p.chapter         as chapter,
        (SELECT cq.chapter_start FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as bookChapterStart,
        (SELECT cq.chapter_end FROM quests cq WHERE cq.main_quest = p.current_quest_id AND cq.sub_quest = p.current_sub_quest) as bookChapterEnd,
        p.current_quest_id,
        p.current_sub_quest,
        p.suspicion,
        p.status,
        COALESCE(pq.total_failures, 0) as totalFailures,
        ROUND(p.current_quest_id * 50 + p.current_sub_quest * 7, 0) as questProgress
      FROM players p
      LEFT JOIN (
        SELECT player_id, SUM(failure_count) as total_failures
        FROM player_quests
        GROUP BY player_id
      ) pq ON p.id = pq.player_id
      WHERE p.status = 'active'
      ORDER BY questProgress DESC, totalFailures ASC, p.suspicion ASC, p.updated_at DESC
      LIMIT ?
    `;

    const [topPlayers] = await pool.query(query, [parsedCount]);

    // Built once. The previous version mapped this list a second time inside the
    // response and read raw-row keys (p.current_quest_id, p.suspicion) off the
    // already-mapped objects, so currentQuest / currentSubQuest came back undefined
    // and failCount was always 0.
    const topRankings = topPlayers.map((p, idx) => ({
      rank:            idx + 1,
      playerId:        p.playerId,
      playerName:      p.playerName,
      email:           p.email,
      questProgress:   Math.min(100, p.questProgress || 0),
      currentQuest:    p.current_quest_id,
      currentSubQuest: p.current_sub_quest,
      chapter:         p.chapter,
      bookChapterStart: p.bookChapterStart,
      bookChapterEnd:   p.bookChapterEnd,
      failCount:       p.totalFailures || 0,
      suspicion:       p.suspicion || 0,
      // Aliases the Unity LeaderboardEntry reads -- see buildRanking above.
      currentMainQuest: p.current_quest_id,
      suspicionScore:   p.suspicion || 0,
      status:          p.status
    }));

    res.json({
      success:   true,
      topPlayers: topRankings,
      count:     topRankings.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
