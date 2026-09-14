/**
 * run-quest-chapters.js
 * Idempotent runner for migrations/quest_chapters.sql (Phase 1, Step 1B).
 *
 * Brings the quests table in line with the questing design (20 sub-quests, each
 * covering an El Filibusterismo book-chapter range):
 *
 *   1. Deletes the 13 'standby' placeholder rows and quests 5 and 10 (a 5th sub-quest
 *      in MQ1/MQ2 that exists in neither the design nor the game). FK ON DELETE CASCADE
 *      removes their player_quests rows -- duplicates left by the old off-by-one
 *      completion bug. A restore file is written BEFORE anything is deleted.
 *   2. Adds quests.chapter_start / quests.chapter_end  INT NULL
 *   3. Adds UNIQUE KEY uq_mq_sq (main_quest, sub_quest) -- the lookup key the API uses
 *   4. Fills the chapter range of every designed sub-quest
 *
 *   node migrations/run-quest-chapters.js            # dry run -- shows what it would do
 *   node migrations/run-quest-chapters.js --apply    # executes
 *
 * Safe to re-run: every step checks current state first and skips what is done.
 * Aborts before deleting anything if a safety pre-check fails.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2');
const pool = require('../db');

const APPLY = process.argv.includes('--apply');

// Quests to remove besides every status = 'standby' row. Each is a 5th sub-quest the
// questing design and the Unity scenes (SQ1-SQ4 only) do not contain.
const EXTRA_QUEST_IDS = [5, 10];

// El Filibusterismo book-chapter range per designed sub-quest: [main, sub, start, end]
const CHAPTER_RANGES = [
  [1, 1, 1, 2],   [1, 2, 3, 4],   [1, 3, 5, 6],   [1, 4, 7, 8],
  [2, 1, 9, 10],  [2, 2, 11, 12], [2, 3, 13, 14], [2, 4, 15, 16],
  [3, 1, 17, 18], [3, 2, 19, 20], [3, 3, 21, 22], [3, 4, 23, 24],
  [4, 1, 25, 26], [4, 2, 27, 28], [4, 3, 29, 30], [4, 4, 31, 32],
  [5, 1, 33, 34], [5, 2, 35, 36],
  [6, 1, 37, 38],
  [7, 1, 39, 39],
];

const DELETE_WHERE = `id IN (${EXTRA_QUEST_IDS.join(', ')}) OR status = 'standby'`;

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(table, index) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows.length > 0;
}

/**
 * SELECT list for a table with every date/time column rendered as a plain string,
 * so the restore file reproduces the stored value exactly regardless of the driver's
 * timezone handling.
 */
async function selectList(table) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME name, DATA_TYPE type FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [table]
  );
  const names = cols.map(c => c.name);
  const select = cols.map(c =>
    ['date', 'datetime', 'timestamp'].includes(c.type)
      ? `DATE_FORMAT(\`${c.name}\`, '%Y-%m-%d %H:%i:%s') AS \`${c.name}\``
      : `\`${c.name}\``
  ).join(', ');
  return { names, select };
}

function insertStatements(table, names, rows) {
  const cols = names.map(n => `\`${n}\``).join(', ');
  return rows.map(r =>
    `INSERT INTO \`${table}\` (${cols}) VALUES (${names.map(n => mysql.escape(r[n])).join(', ')});`
  );
}

(async () => {
  try {
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log(`Connected to database: ${db}`);
    console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: DRY RUN (pass --apply to execute)\n');

    // ------------------------------------------------------------------
    // Step 1 -- remove standby placeholders and quests 5 / 10
    // ------------------------------------------------------------------
    const [doomed] = await pool.query(
      `SELECT q.id, q.main_quest mq, q.sub_quest sq, q.status, q.title,
              (SELECT COUNT(*) FROM quest_dialogues d WHERE d.quest_id = q.id) dialogues,
              (SELECT COUNT(*) FROM player_quests pq WHERE pq.quest_id = q.id) player_rows
         FROM quests q WHERE ${DELETE_WHERE} ORDER BY q.id`
    );

    console.log('1. Remove quests not in the design');
    if (doomed.length === 0) {
      console.log('  SKIP  nothing to remove - already done');
    } else {
      const [cascaded] = await pool.query(
        `SELECT pq.player_id, pq.quest_id, pq.failure_count, pq.artifacts_found,
                (SELECT COUNT(*) FROM player_quests x
                  WHERE x.player_id = pq.player_id AND x.quest_id = pq.quest_id - 1) has_previous_row
           FROM player_quests pq
          WHERE pq.quest_id IN (SELECT id FROM quests WHERE ${DELETE_WHERE})`
      );

      // Safety pre-checks. Any failure aborts before a single row is touched.
      const problems = [];
      for (const q of doomed) {
        if (q.dialogues > 0) problems.push(`quest ${q.id} has ${q.dialogues} dialogue rows`);
        if (q.status === 'standby' && q.player_rows > 0) {
          problems.push(`standby quest ${q.id} has ${q.player_rows} player rows`);
        }
      }
      for (const r of cascaded) {
        if (r.failure_count > 0 || r.artifacts_found > 0) {
          problems.push(`player ${r.player_id} quest ${r.quest_id} holds real metrics ` +
                        `(failures ${r.failure_count}, artifacts ${r.artifacts_found})`);
        }
        if (!r.has_previous_row) {
          problems.push(`player ${r.player_id} quest ${r.quest_id} is not a duplicate ` +
                        `(no row for quest ${r.quest_id - 1})`);
        }
      }

      console.log(`  quests to delete: ${doomed.length} ` +
                  `(${doomed.filter(q => q.status === 'standby').length} standby + ` +
                  `${doomed.filter(q => q.status !== 'standby').length} extra)`);
      doomed.filter(q => q.status !== 'standby').forEach(q =>
        console.log(`        id ${q.id}  MQ${q.mq}-SQ${q.sq}  "${q.title}"  dialogues=${q.dialogues}  player_rows=${q.player_rows}`));
      console.log(`  player_quests rows removed by cascade: ${cascaded.length} ` +
                  '(each must duplicate the previous sub-quest row, with 0 failures and 0 artifacts)');

      if (problems.length > 0) {
        console.error('\n  ABORT - safety pre-check failed, nothing was changed:');
        problems.forEach(p => console.error(`    - ${p}`));
        process.exit(1);
      }
      console.log('  pre-checks passed');

      if (APPLY) {
        // Restore file first. If it cannot be written, nothing is deleted.
        const q = await selectList('quests');
        const pq = await selectList('player_quests');
        const [questRows] = await pool.query(`SELECT ${q.select} FROM quests WHERE ${DELETE_WHERE} ORDER BY id`);
        const [pqRows] = await pool.query(
          `SELECT ${pq.select} FROM player_quests
            WHERE quest_id IN (SELECT id FROM quests WHERE ${DELETE_WHERE}) ORDER BY id`
        );

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'backups');
        const backupFile = path.join(backupDir, `quest_cleanup_${stamp}.sql`);
        const lines = [
          '-- Restore point written by run-quest-chapters.js before deleting quests.',
          `-- Captured: ${new Date().toISOString()}  Database: ${db}`,
          `-- ${questRows.length} quests rows, ${pqRows.length} player_quests rows.`,
          '-- To restore, run this file against the same database (quests first, then player_quests).',
          '',
          ...insertStatements('quests', q.names, questRows),
          '',
          ...insertStatements('player_quests', pq.names, pqRows),
          ''
        ];
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(backupFile, lines.join('\n'), 'utf8');
        if (fs.statSync(backupFile).size === 0) throw new Error('backup file is empty');
        console.log(`  BACKUP ${path.relative(process.cwd(), backupFile)}`);

        const [beforePq] = await pool.query('SELECT COUNT(*) n FROM player_quests');
        const [del] = await pool.query(`DELETE FROM quests WHERE ${DELETE_WHERE}`);
        const [afterPq] = await pool.query('SELECT COUNT(*) n FROM player_quests');
        console.log(`  DELETED ${del.affectedRows} quests, cascade removed ` +
                    `${beforePq[0].n - afterPq[0].n} player_quests rows`);
      }
    }

    // ------------------------------------------------------------------
    // Steps 2-3 -- columns and unique index
    // ------------------------------------------------------------------
    console.log('\n2. Book-chapter columns and lookup index');
    const ddl = [
      {
        label: 'quests.chapter_start',
        exists: () => columnExists('quests', 'chapter_start'),
        sql: 'ALTER TABLE quests ADD COLUMN chapter_start INT NULL AFTER chapter',
      },
      {
        label: 'quests.chapter_end',
        exists: () => columnExists('quests', 'chapter_end'),
        sql: 'ALTER TABLE quests ADD COLUMN chapter_end INT NULL AFTER chapter_start',
      },
      {
        label: 'UNIQUE uq_mq_sq (main_quest, sub_quest)',
        exists: () => indexExists('quests', 'uq_mq_sq'),
        sql: 'ALTER TABLE quests ADD UNIQUE KEY uq_mq_sq (main_quest, sub_quest)',
      },
    ];
    for (const change of ddl) {
      if (await change.exists()) {
        console.log(`  SKIP  ${change.label} - already exists`);
      } else if (!APPLY) {
        console.log(`  WOULD ${change.label}`);
        console.log(`        ${change.sql}`);
      } else {
        await pool.query(change.sql);
        console.log(`  ADDED ${change.label}`);
      }
    }

    // ------------------------------------------------------------------
    // Step 4 -- chapter ranges
    // ------------------------------------------------------------------
    console.log('\n3. Chapter ranges (El Filibusterismo)');
    const hasColumns = await columnExists('quests', 'chapter_end');
    let wouldSet = 0, set = 0, already = 0;
    const missing = [];
    for (const [mq, sq, start, end] of CHAPTER_RANGES) {
      const [rows] = await pool.query(
        hasColumns
          ? 'SELECT id, chapter_start, chapter_end FROM quests WHERE main_quest = ? AND sub_quest = ?'
          : 'SELECT id FROM quests WHERE main_quest = ? AND sub_quest = ?',
        [mq, sq]
      );
      if (rows.length === 0) { missing.push(`MQ${mq}-SQ${sq}`); continue; }
      if (hasColumns && rows[0].chapter_start === start && rows[0].chapter_end === end) { already++; continue; }
      if (!APPLY) { wouldSet++; continue; }
      await pool.query(
        'UPDATE quests SET chapter_start = ?, chapter_end = ? WHERE main_quest = ? AND sub_quest = ?',
        [start, end, mq, sq]
      );
      set++;
    }
    if (missing.length) console.log(`  MISSING quest rows (range not set): ${missing.join(', ')}`);
    console.log(APPLY
      ? `  SET ${set}, already correct ${already}`
      : `  WOULD SET ${wouldSet}, already correct ${already}`);

    // ------------------------------------------------------------------
    // Verification
    // ------------------------------------------------------------------
    if (APPLY) {
      const [[v]] = await pool.query(
        `SELECT COUNT(*) total, SUM(status = 'active') active, SUM(status = 'standby') standby,
                SUM(chapter_start IS NULL OR chapter_end IS NULL) null_ranges,
                (SELECT COUNT(*) FROM player_quests pq LEFT JOIN quests q ON q.id = pq.quest_id WHERE q.id IS NULL) orphan_player_rows,
                (SELECT COUNT(*) FROM quest_dialogues d LEFT JOIN quests q ON q.id = d.quest_id WHERE q.id IS NULL) orphan_dialogues
           FROM quests`
      );
      console.log('\nVerification:');
      console.log(`  quests: ${v.total} total, ${v.active} active, ${v.standby || 0} standby (expect 20 / 20 / 0)`);
      console.log(`  NULL chapter ranges: ${v.null_ranges} (expect 0)`);
      console.log(`  orphan player_quests: ${v.orphan_player_rows}, orphan dialogues: ${v.orphan_dialogues} (expect 0 / 0)`);
      console.log('\nNext: update docs/ACTUAL-DB-SCHEMA.md, then deploy the code that reads chapter_start/chapter_end.');
    }

    console.log(`\nDone (${APPLY ? 'applied' : 'dry run - nothing changed'}).`);
    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err.code || '', err.message);
    process.exit(1);
  }
})();
