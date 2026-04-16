const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');
const { NotFoundError } = require('../src/utils/errors');

const router = express.Router();

/**
 * GET /leaderboard/rankings
 * Fetches ranked players based on quest progress.
 * Supports filtering by ranking type (quest_progress, codex_completion, suspicion_score, playtime).
 * Accessible to all authenticated players.
 */
router.get('/rankings', verifyToken, async (req, res, next) => {
  try {
    const { type = 'quest_progress', limit = 100, offset = 0 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 100, 500); // Cap at 500
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    let orderByClause;
    let selectFields = `
      p.id as playerId,
      p.name as playerName,
      p.email,
      p.chapter,
      p.current_main_quest,
      p.current_sub_quest,
      p.suspicion,
      p.status,
      p.is_online as isActive,
      p.created_at,
      p.updated_at,
      ROUND((p.current_main_quest / 2 * 50 + p.current_sub_quest / 7 * 50), 0) as questProgress,
      COALESCE(c.codex_count, 0) as codexCompletion,
      FLOOR((MAX(UNIX_TIMESTAMP(l.timestamp)) - MIN(UNIX_TIMESTAMP(l.timestamp))) / 60) as playtimeMinutes
    `;

    // Determine sorting based on ranking type
    switch (type) {
      case 'quest_progress':
        orderByClause = 'ORDER BY questProgress DESC, p.updated_at DESC';
        break;
      case 'codex_completion':
        orderByClause = 'ORDER BY codexCompletion DESC, questProgress DESC';
        break;
      case 'suspicion_score':
        orderByClause = 'ORDER BY p.suspicion ASC, questProgress DESC'; // Lower suspicion is better
        break;
      case 'playtime':
        orderByClause = 'ORDER BY playtimeMinutes DESC, questProgress DESC';
        break;
      default:
        orderByClause = 'ORDER BY questProgress DESC, p.updated_at DESC';
    }

    const query = `
      SELECT ${selectFields}
      FROM players p
      LEFT JOIN (
        SELECT player_id, COUNT(*) as codex_count
        FROM codex_entries
        WHERE discovered = TRUE
        GROUP BY player_id
      ) c ON p.id = c.player_id
      LEFT JOIN logs l ON p.id = l.user_id
      WHERE p.status = 'active'
      GROUP BY p.id
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const [rankings] = await pool.query(query, [parsedLimit, parsedOffset]);

    // Transform data for response
    const transformedRankings = rankings.map((row, index) => ({
      rank: parsedOffset + index + 1,
      playerId: row.playerId,
      playerName: row.playerName,
      email: row.email,
      questProgress: row.questProgress || 0,
      currentMainQuest: row.current_main_quest,
      currentSubQuest: row.current_sub_quest,
      chapter: row.chapter,
      codexCompletion: row.codexCompletion || 0,
      suspicionScore: row.suspicion || 0,
      isActive: row.isActive === 1,
      status: row.status,
      playtimeMinutes: row.playtimeMinutes || 0,
      lastActivityTime: row.updated_at
    }));

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM players
      WHERE status = 'active'
    `;
    const [countResult] = await pool.query(countQuery);
    const totalPlayers = countResult[0]?.total || 0;

    res.json({
      success: true,
      rankings: transformedRankings,
      totalPlayers,
      rankingType: type,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: totalPlayers
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /leaderboard/player/:playerId
 * Fetches a specific player's leaderboard rank and stats.
 */
router.get('/player/:playerId', verifyToken, async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const { type = 'quest_progress' } = req.query;

    let orderByClause;
    switch (type) {
      case 'quest_progress':
        orderByClause = 'ORDER BY questProgress DESC, p.updated_at DESC';
        break;
      case 'codex_completion':
        orderByClause = 'ORDER BY codexCompletion DESC, questProgress DESC';
        break;
      case 'suspicion_score':
        orderByClause = 'ORDER BY p.suspicion ASC, questProgress DESC';
        break;
      default:
        orderByClause = 'ORDER BY questProgress DESC, p.updated_at DESC';
    }

    const query = `
      SELECT 
        p.id as playerId,
        p.name as playerName,
        p.email,
        p.chapter,
        p.current_main_quest,
        p.current_sub_quest,
        p.suspicion,
        p.status,
        p.is_online as isActive,
        ROUND((p.current_main_quest / 2 * 50 + p.current_sub_quest / 7 * 50), 0) as questProgress,
        COALESCE(c.codex_count, 0) as codexCompletion
      FROM players p
      LEFT JOIN (
        SELECT player_id, COUNT(*) as codex_count
        FROM codex_entries
        WHERE discovered = TRUE
        GROUP BY player_id
      ) c ON p.id = c.player_id
      WHERE p.status = 'active'
      GROUP BY p.id
      ${orderByClause}
    `;

    const [allRankings] = await pool.query(query);

    // Find player's rank
    const playerRank = allRankings.findIndex(p => p.playerId == playerId);

    if (playerRank === -1) {
      throw new NotFoundError('Player not found or inactive');
    }

    const playerData = allRankings[playerRank];

    res.json({
      success: true,
      player: {
        rank: playerRank + 1,
        playerId: playerData.playerId,
        playerName: playerData.playerName,
        email: playerData.email,
        questProgress: playerData.questProgress || 0,
        currentMainQuest: playerData.current_main_quest,
        currentSubQuest: playerData.current_sub_quest,
        chapter: playerData.chapter,
        codexCompletion: playerData.codexCompletion || 0,
        suspicionScore: playerData.suspicion || 0,
        isActive: playerData.isActive === 1,
        status: playerData.status,
        totalPlayers: allRankings.length,
        rankingType: type
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /leaderboard/top/:count
 * Fetches the top N players by quest progress.
 */
router.get('/top/:count', verifyToken, async (req, res, next) => {
  try {
    const { count = 10 } = req.params;
    const parsedCount = Math.min(parseInt(count) || 10, 100);

    const query = `
      SELECT 
        p.id as playerId,
        p.name as playerName,
        p.email,
        p.chapter,
        p.current_main_quest,
        p.current_sub_quest,
        p.status,
        ROUND((p.current_main_quest / 2 * 50 + p.current_sub_quest / 7 * 50), 0) as questProgress
      FROM players p
      WHERE p.status = 'active'
      ORDER BY questProgress DESC, p.updated_at DESC
      LIMIT ?
    `;

    const [topPlayers] = await pool.query(query, [parsedCount]);

    const topRankings = topPlayers.map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      playerName: row.playerName,
      email: row.email,
      questProgress: row.questProgress || 0,
      chapter: row.chapter,
      status: row.status
    }));

    res.json({
      success: true,
      topPlayers: topRankings,
      count: topRankings.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
