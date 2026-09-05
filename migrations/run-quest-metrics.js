/**
 * run-quest-metrics.js
 * Idempotent runner for migrations/quest_metrics.sql (FR5 / FR6 / FR7).
 *
 * Adds:
 *   player_quests.failure_count   INT NOT NULL DEFAULT 0
 *   player_quests.artifacts_found INT NOT NULL DEFAULT 0
 *   quests.artifacts_total        INT NOT NULL DEFAULT 0
 *
 * Checks INFORMATION_SCHEMA first, so re-running is safe (skips existing columns).
 *
 *   node migrations/run-quest-metrics.js            # dry run -- shows what it would do
 *   node migrations/run-quest-metrics.js --apply    # actually runs the ALTERs
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');

const APPLY = process.argv.includes('--apply');

const CHANGES = [
  {
    table: 'player_quests',
    column: 'failure_count',
    ddl: 'ALTER TABLE player_quests ADD COLUMN failure_count INT NOT NULL DEFAULT 0 AFTER progress_percent',
  },
  {
    table: 'player_quests',
    column: 'artifacts_found',
    ddl: 'ALTER TABLE player_quests ADD COLUMN artifacts_found INT NOT NULL DEFAULT 0 AFTER failure_count',
  },
  {
    table: 'quests',
    column: 'artifacts_total',
    ddl: 'ALTER TABLE quests ADD COLUMN artifacts_total INT NOT NULL DEFAULT 0 AFTER artifact_resource_path',
  },
];

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

(async () => {
  try {
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log(`Connected to database: ${db}`);
    console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: DRY RUN (pass --apply to execute)\n');

    let applied = 0;
    let skipped = 0;

    for (const change of CHANGES) {
      const exists = await columnExists(change.table, change.column);
      const label = `${change.table}.${change.column}`;

      if (exists) {
        console.log(`  SKIP  ${label} - already exists`);
        skipped++;
        continue;
      }

      if (!APPLY) {
        console.log(`  WOULD ${label}`);
        console.log(`        ${change.ddl}`);
        continue;
      }

      await pool.query(change.ddl);
      console.log(`  ADDED ${label}`);
      applied++;
    }

    console.log(`\nDone. ${APPLY ? `${applied} added` : 'dry run'}, ${skipped} already present.`);

    if (APPLY) {
      const [pqCols] = await pool.query('SHOW COLUMNS FROM player_quests');
      const [qCols] = await pool.query('SHOW COLUMNS FROM quests');
      console.log('\nplayer_quests columns:', pqCols.map(c => c.Field).join(', '));
      console.log('quests columns:', qCols.map(c => c.Field).join(', '));
    }

    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err.code || '', err.message);
    process.exit(1);
  }
})();
