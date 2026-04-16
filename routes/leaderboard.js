const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');
const { NotFoundError } = require('../src/utils/errors');

const router = express.Router();

/**
 * Unified Ranking Strategy:
 *   1. Quest Progress (DESC)     — players further in the story rank higher
 *   2. Suspicion ASC              — fewer wrong dialogue choices = better rank
 *   3. Updated At (DESC)         — recent activity breaks ties
 */
const RANKING_ORDER = 'questProgress DESC, p.suspicion ASC, p.updated_at DESC';

// ---------- shared helpers ----------

function buildRanking(playerRow, index) {
  return {
    rank:            index + 1,
    playerId:        playerRow.playerId,
    playerName:      playerRow.playerName,
    email:           playerRow.email,
    questProgress:   playerRow.questProgress || 0,
    currentQuest:    playerRow.current_quest_id,
    currentSubQuest: playerRow.current_sub_quest,
    chapter:         playerRow.chapter,
    failCount:       playerRow.suspicion || 0,    // wrong dialogue choices
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
  p.current_quest_id,
  p.current_sub_quest,
  p.suspicion,
  p.status,
  p.is_online        as isActive,
  p.created_at,
  p.updated_at,
  ROUND(p.current_quest_id * 50 + p.current_sub_quest * 7, 0) as questProgress,
  COALESCE(pq.quests_completed, 0) as questsCompleted
`;

const FROM_AND_JOINS = `
FROM players p
LEFT JOIN (
  SELECT player_id, COUNT(*) as quests_completed
  FROM player_quests
  WHERE status = 'completed'
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
        p.current_quest_id,
        p.current_sub_quest,
        p.suspicion,
        p.status,
        ROUND(p.current_quest_id * 50 + p.current_sub_quest * 7, 0) as questProgress
      FROM players p
      WHERE p.status = 'active'
      ORDER BY questProgress DESC, p.suspicion ASC, p.updated_at DESC
      LIMIT ?
    `;

    const [topPlayers] = await pool.query(query, [parsedCount]);

    const topRankings = topPlayers.map((p, idx) => ({
      rank:            idx + 1,
      playerId:        p.playerId,
      playerName:      p.playerName,
      email:           p.email,
      questProgress:   p.questProgress || 0,
      currentQuest:    p.current_quest_id,
      currentSubQuest: p.current_sub_quest,
      chapter:         p.chapter,
      failCount:       p.suspicion || 0,
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
