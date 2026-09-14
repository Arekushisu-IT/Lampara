/**
 * run-player-data-fixes.js
 * Phase 4 data cleanup (data only, no schema change). Idempotent.
 *
 *   1. Invalid positions. A player whose saved position (current_quest_id,
 *      current_sub_quest) matches no quest row, but who has completed quests, is moved
 *      to the next quest after their furthest completed one, in game order. This covers
 *      players left on slots removed by quest_chapters.sql (e.g. MQ2-SQ5) and players
 *      stuck at 0-0 despite completions. players.chapter (the main-quest number) is set
 *      to match. Players with a valid position, or with no completions, are not touched.
 *
 *   2. Stale online flags. is_online is set at login and cleared only by an explicit
 *      logout, so players who close the app stay "online" forever. Flags whose last
 *      login is more than 24 hours old are cleared; a real session sets it again at the
 *      next login.
 *
 * Proposals are computed from the live data on every run, not hardcoded.
 *
 *   node migrations/run-player-data-fixes.js            # dry run
 *   node migrations/run-player-data-fixes.js --apply    # executes
 *
 * A restore file of every changed value is written before anything is changed.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2');
const pool = require('../db');

const APPLY = process.argv.includes('--apply');
const STALE_ONLINE_HOURS = 24;

(async () => {
  try {
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log(`Connected to database: ${db}`);
    console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: DRY RUN (pass --apply to execute)\n');

    // ---------------------------------------------------------------- 1. positions
    const [order] = await pool.query(
      "SELECT id, main_quest, sub_quest FROM quests WHERE status = 'active' ORDER BY main_quest, sub_quest"
    );
    const orderIndex = new Map(order.map((q, i) => [q.id, i]));

    const [invalid] = await pool.query(
      `SELECT p.id, p.name, p.username, p.chapter, p.current_quest_id, p.current_sub_quest
         FROM players p
        WHERE NOT EXISTS (SELECT 1 FROM quests q
                           WHERE q.main_quest = p.current_quest_id AND q.sub_quest = p.current_sub_quest)
          AND EXISTS (SELECT 1 FROM player_quests pq
                       WHERE pq.player_id = p.id AND pq.status = 'completed')`
    );

    const positionFixes = [];
    for (const p of invalid) {
      const [done] = await pool.query(
        "SELECT quest_id FROM player_quests WHERE player_id = ? AND status = 'completed'", [p.id]
      );
      const indexes = done.map(r => orderIndex.get(r.quest_id)).filter(i => i !== undefined);
      if (indexes.length === 0) continue;
      const furthest = Math.max(...indexes);
      const next = order[Math.min(furthest + 1, order.length - 1)];
      positionFixes.push({
        p,
        furthest: order[furthest],
        target: { main_quest: next.main_quest, sub_quest: next.sub_quest }
      });
    }

    console.log(`1. Invalid positions with completed quests: ${positionFixes.length}`);
    for (const f of positionFixes) {
      console.log(`  ${APPLY ? 'SET  ' : 'WOULD'} ${f.p.name} @${f.p.username} (id ${f.p.id}): ` +
                  `${f.p.current_quest_id}-${f.p.current_sub_quest} -> MQ${f.target.main_quest}-SQ${f.target.sub_quest} ` +
                  `(furthest completed MQ${f.furthest.main_quest}-SQ${f.furthest.sub_quest}; chapter ${f.p.chapter} -> ${f.target.main_quest})`);
    }

    // ------------------------------------------------------------ 2. online flags
    const [stale] = await pool.query(
      `SELECT id, name, username, last_login FROM players
        WHERE is_online = 1 AND (last_login IS NULL OR last_login < NOW() - INTERVAL ? HOUR)`,
      [STALE_ONLINE_HOURS]
    );
    const [[{ online }]] = await pool.query('SELECT COUNT(*) AS online FROM players WHERE is_online = 1');
    console.log(`\n2. Stale online flags (last login over ${STALE_ONLINE_HOURS}h ago or never): ` +
                `${stale.length} of ${online} flagged online  ${stale.length ? (APPLY ? '-> CLEAR' : '-> WOULD CLEAR') : ''}`);

    if (APPLY && (positionFixes.length > 0 || stale.length > 0)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(__dirname, 'backups');
      const backupFile = path.join(backupDir, `player_data_fixes_${stamp}.sql`);
      const lines = [
        '-- Restore point written by run-player-data-fixes.js before changing players.',
        `-- Captured: ${new Date().toISOString()}  Database: ${db}`,
        '-- To restore, run this file against the same database.',
        '',
        ...positionFixes.map(f =>
          `UPDATE players SET current_quest_id = ${mysql.escape(f.p.current_quest_id)}, ` +
          `current_sub_quest = ${mysql.escape(f.p.current_sub_quest)}, chapter = ${mysql.escape(f.p.chapter)} ` +
          `WHERE id = ${mysql.escape(f.p.id)};`),
        ...(stale.length ? [`UPDATE players SET is_online = 1 WHERE id IN (${stale.map(s => mysql.escape(s.id)).join(', ')});`] : []),
        ''
      ];
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(backupFile, lines.join('\n'), 'utf8');
      if (fs.statSync(backupFile).size === 0) throw new Error('backup file is empty');
      console.log(`\nBACKUP ${path.relative(process.cwd(), backupFile)}`);

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const f of positionFixes) {
          await conn.query(
            'UPDATE players SET current_quest_id = ?, current_sub_quest = ?, chapter = ? WHERE id = ?',
            [f.target.main_quest, f.target.sub_quest, f.target.main_quest, f.p.id]
          );
        }
        if (stale.length) {
          await conn.query('UPDATE players SET is_online = 0 WHERE id IN (?)', [stale.map(s => s.id)]);
        }
        await conn.commit();
        console.log(`UPDATED ${positionFixes.length} positions, cleared ${stale.length} online flags`);
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [[v]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM players p
             WHERE NOT EXISTS (SELECT 1 FROM quests q WHERE q.main_quest = p.current_quest_id AND q.sub_quest = p.current_sub_quest)
               AND EXISTS (SELECT 1 FROM player_quests pq WHERE pq.player_id = p.id AND pq.status = 'completed')) AS invalid_positions,
           (SELECT COUNT(*) FROM players
             WHERE is_online = 1 AND (last_login IS NULL OR last_login < NOW() - INTERVAL ? HOUR)) AS stale_online`,
        [STALE_ONLINE_HOURS]
      );
      console.log('\nVerification:');
      console.log(`  invalid positions with completions: ${v.invalid_positions} (expect 0)`);
      console.log(`  stale online flags: ${v.stale_online} (expect 0)`);
    }

    console.log(`\nDone (${APPLY ? 'applied' : 'dry run - nothing changed'}).`);
    process.exit(0);
  } catch (err) {
    console.error('\nData fix failed:', err.code || '', err.message);
    process.exit(1);
  }
})();
