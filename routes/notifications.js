const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');

const router = express.Router();

// All notification routes require authentication
router.use(verifyToken);

// ============================================================
// GET /api/notifications — Get player's notifications
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const playerId = req.user.id;
    const { limit = 30, offset = 0 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 30, 50);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    const [notifications] = await pool.query(`
      SELECT id, type, message, reference_id, is_read, created_at
      FROM notifications
      WHERE player_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [playerId, parsedLimit, parsedOffset]);

    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/notifications/unread-count — Get unread count
// ============================================================
router.get('/unread-count', async (req, res, next) => {
  try {
    const playerId = req.user.id;

    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE player_id = ? AND is_read = FALSE',
      [playerId]
    );

    res.json({ success: true, count });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PUT /api/notifications/:id/read — Mark single as read
// ============================================================
router.put('/:id/read', async (req, res, next) => {
  try {
    const playerId = req.user.id;
    const notifId = parseInt(req.params.id);

    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND player_id = ?',
      [notifId, playerId]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PUT /api/notifications/read-all — Mark all as read
// ============================================================
router.put('/read-all', async (req, res, next) => {
  try {
    const playerId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE player_id = ? AND is_read = FALSE',
      [playerId]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
