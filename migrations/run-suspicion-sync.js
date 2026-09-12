/**
 * run-suspicion-sync.js
 * Idempotent runner for migrations/suspicion_sync.sql (BK1).
 *
 * Adds:
 *   players.suspicion_seq  INT NOT NULL DEFAULT 0
 *
 * players.suspicion is a running 0-100 meter that moves in BOTH directions --
 * it rises on a wrong choice, falls on a streak bonus, and resets to 0 when a
 * failure at 100 restarts the sub-quest. So it cannot be merged with GREATEST()
 * the way failure_count and artifacts_found are. suspicion_seq is the monotonic
 * counter that lets the server reject a stale offline replay instead.
 *
 * Checks INFORMATION_SCHEMA first, so re-running is safe (skips existing columns).
 *
 *   node migrations/run-suspicion-sync.js            # dry run -- shows what it would do
 *   node migrations/run-suspicion-sync.js --apply    # actually runs the ALTERs
 *
 * Run this BEFORE deploying the code that reads suspicion_seq. Nothing in
 * server.js applies migrations at startup -- a pushed .sql file does nothing on
 * its own, and deploying first means those endpoints 500 on a missing column.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');

const APPLY = process.argv.includes('--apply');

const CHANGES = [
  {
    table: 'players',
    column: 'suspicion_seq',
    ddl: 'ALTER TABLE players ADD COLUMN suspicion_seq INT NOT NULL DEFAULT 0 AFTER suspicion',
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
      // DEFAULT 0 backfills every existing row, so no separate UPDATE is needed --
      // confirm that rather than assume it.
      const [cols] = await pool.query("SHOW COLUMNS FROM players LIKE 'suspicion%'");
      console.log('\nplayers suspicion columns:');
      cols.forEach(c => console.log(`  ${c.Field}  ${c.Type}  NULL=${c.Null}  DEFAULT=${c.Default}`));

      const [[check]] = await pool.query(
        'SELECT COUNT(*) AS total, SUM(suspicion_seq IS NULL) AS nulls FROM players'
      );
      console.log(`\nBackfill check: ${check.total} rows, ${check.nulls} NULL suspicion_seq (expected 0).`);
      console.log('\nNext: deploy the code that reads suspicion_seq (BK2), not before this point.');
    }

    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err.code || '', err.message);
    process.exit(1);
  }
})();
