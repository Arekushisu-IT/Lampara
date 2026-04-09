const express = require('express');
const pool = require('../db');
const verifyToken = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');
const { NotFoundError, ValidationError } = require('../src/utils/errors');

const router = express.Router();

// ============================================================
// GET /api/game-config — List all game settings
// Used by: Admin Dashboard
// ============================================================
router.get('/', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const [configs] = await pool.query(
      'SELECT id, config_key, config_value, description, updated_at FROM game_config ORDER BY id'
    );

    // Also return as a key-value map for convenience
    const configMap = {};
    configs.forEach(c => { configMap[c.config_key] = c.config_value; });

    res.json({
      count: configs.length,
      configs,
      configMap
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/game-config/:key — Get a single config value
// ============================================================
router.get('/:key', verifyToken, authorize('admin', 'staff'), async (req, res, next) => {
  const { key } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT config_key, config_value, description FROM game_config WHERE config_key = ?',
      [key]
    );

    if (rows.length === 0) {
      throw new NotFoundError(`Config key "${key}" not found`);
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PUT /api/game-config — Batch update config values
// Body: { configs: { "suspicion_start": "50", "suspicion_wrong_penalty": "15", ... } }
// ============================================================
router.put('/', verifyToken, authorize('admin'), async (req, res, next) => {
  const { configs } = req.body;

  if (!configs || typeof configs !== 'object') {
    return res.status(400).json({ error: 'configs object is required' });
  }

  try {
    let updated = 0;

    for (const [key, value] of Object.entries(configs)) {
      // Validate that the value is a reasonable number string
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const [result] = await pool.query(
        'UPDATE game_config SET config_value = ? WHERE config_key = ?',
        [String(value), key]
      );

      if (result.affectedRows > 0) updated++;
    }

    res.json({
      message: `${updated} config value(s) updated successfully`,
      updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
