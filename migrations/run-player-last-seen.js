/**
 * run-player-last-seen.js
 * Idempotent runner for migrations/player_last_seen.sql.
 *
 * Adds:
 *   players.last_seen_at  TIMESTAMP NULL  (backfilled from last_login)
 *
 * Why: is_online is set at login and cleared only by an explicit logout, so a player
 * who closes the app or whose battery dies stays "online" forever. With last_seen_at
 * (refreshed by any authenticated player request, at most once a minute), the API
 * reports a player as online only while is_online = 1 AND they were seen in the last
 * 15 minutes -- stale sessions age out on their own, no cleanup job needed.
 *
 *   node migrations/run-player-last-seen.js            # dry run
 *   node migrations/run-player-last-seen.js --apply    # executes
 *
 * Apply BEFORE deploying the code that reads last_seen_at. Nothing in server.js runs
 * migrations; the player list and leaderboard would fail on the missing column.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');

const APPLY = process.argv.includes('--apply');

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

    const ddl = 'ALTER TABLE players ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL AFTER last_login';
    const exists = await columnExists('players', 'last_seen_at');

    if (exists) {
      console.log('  SKIP  players.last_seen_at - already exists');
    } else if (!APPLY) {
      console.log('  WOULD players.last_seen_at');
      console.log(`        ${ddl}`);
    } else {
      await pool.query(ddl);
      console.log('  ADDED players.last_seen_at');
    }

    // Backfill so players who logged in recently are not shown offline until their next
    // request. Only rows never set, so re-running never overwrites real activity.
    if (exists || APPLY) {
      const [[{ pending }]] = await pool.query(
        'SELECT COUNT(*) AS pending FROM players WHERE last_seen_at IS NULL AND last_login IS NOT NULL'
      );
      if (!APPLY) {
        console.log(`  WOULD backfill last_seen_at from last_login for ${pending} players`);
      } else {
        const [r] = await pool.query(
          'UPDATE players SET last_seen_at = last_login WHERE last_seen_at IS NULL AND last_login IS NOT NULL'
        );
        console.log(`  BACKFILLED last_seen_at for ${r.affectedRows} players`);
      }
    } else {
      const [[{ withLogin }]] = await pool.query(
        'SELECT COUNT(*) AS withLogin FROM players WHERE last_login IS NOT NULL'
      );
      console.log(`  WOULD backfill last_seen_at from last_login for ${withLogin} players`);
    }

    if (APPLY) {
      const [cols] = await pool.query("SHOW COLUMNS FROM players LIKE 'last_%'");
      console.log('\nplayers last_* columns:');
      cols.forEach(c => console.log(`  ${c.Field}  ${c.Type}  NULL=${c.Null}  DEFAULT=${c.Default}`));
      const [[v]] = await pool.query(
        `SELECT COUNT(*) total, SUM(last_seen_at IS NOT NULL) seen,
                SUM(is_online = 1 AND last_seen_at >= NOW() - INTERVAL 15 MINUTE) online_now
           FROM players`
      );
      console.log(`\n${v.seen} of ${v.total} players have last_seen_at; ${v.online_now} count as online now.`);
      console.log('Next: deploy the backend code that reads last_seen_at.');
    }

    console.log(`\nDone (${APPLY ? 'applied' : 'dry run - nothing changed'}).`);
    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err.code || '', err.message);
    process.exit(1);
  }
})();
