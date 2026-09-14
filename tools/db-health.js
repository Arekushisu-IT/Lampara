/**
 * db-health.js — READ-ONLY data health report for the live database.
 *
 * Runs a list of consistency checks and prints what it finds. Nothing is written.
 *
 *   node tools/db-health.js            # summary + up to 5 sample rows per finding
 *   node tools/db-health.js --all      # every affected row
 *
 * Levels: OK (nothing found), WARN (data is wrong or will show wrongly), INFO (worth
 * knowing, not an error — e.g. test accounts parked at position 0 on purpose).
 * Emails are never printed; rows are identified by id and username.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');
const { normalizeAccountEmail, isMultiAccountEmail } = require('../src/utils/accountEmail');
const { ONLINE_WINDOW_MINUTES } = require('../src/utils/presence');

const SHOW_ALL = process.argv.includes('--all');
const SAMPLE = 5;

// Sub-quests per main quest in the design (20 total); matches migrations/quest_chapters.sql.
const DESIGN = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 2, 6: 1, 7: 1 };

const results = [];

/** Runs one SQL check. `level` applies when rows come back; no rows means OK. */
async function sqlCheck(area, name, level, sql, params = [], fmt = r => JSON.stringify(r)) {
  const [rows] = await pool.query(sql, params);
  results.push({ area, name, level: rows.length ? level : 'OK', count: rows.length, lines: rows.map(fmt) });
}

function addResult(area, name, level, lines) {
  results.push({ area, name, level: lines.length ? level : 'OK', count: lines.length, lines });
}

const who = r => `#${r.id} ${r.username}`;

(async () => {
  try {
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log(`LAMPARA data health — ${db} — ${new Date().toISOString()}\n`);

    // ------------------------------------------------------------------ quests
    const [quests] = await pool.query('SELECT * FROM quests ORDER BY main_quest, sub_quest');
    const designTotal = Object.values(DESIGN).reduce((a, b) => a + b, 0);
    addResult('quests', `quest rows match the ${designTotal}-quest design`, 'WARN',
      quests.length === designTotal ? [] : [`${quests.length} rows, expected ${designTotal}`]);
    addResult('quests', 'every designed sub-quest has a row', 'WARN',
      Object.entries(DESIGN).flatMap(([mq, n]) =>
        Array.from({ length: n }, (_, i) => i + 1)
          .filter(sq => !quests.some(q => q.main_quest === Number(mq) && q.sub_quest === sq))
          .map(sq => `MQ${mq} SQ${sq} missing`)));
    addResult('quests', 'rows outside the design', 'WARN',
      quests.filter(q => !(DESIGN[q.main_quest] >= q.sub_quest)).map(q => `#${q.id} MQ${q.main_quest} SQ${q.sub_quest}`));
    addResult('quests', 'id = (main_quest-1)*5 + sub_quest', 'WARN',
      quests.filter(q => q.id !== (q.main_quest - 1) * 5 + q.sub_quest).map(q => `#${q.id} MQ${q.main_quest} SQ${q.sub_quest}`));
    addResult('quests', 'book chapter range set and valid (1–39, start ≤ end)', 'WARN',
      quests.filter(q => q.chapter_start == null || q.chapter_end == null || q.chapter_start < 1 || q.chapter_end > 39 || q.chapter_start > q.chapter_end)
        .map(q => `#${q.id} Ch.${q.chapter_start}–${q.chapter_end}`));
    addResult('quests', 'book chapter ranges do not overlap', 'WARN',
      quests.slice(1).filter((q, i) => q.chapter_start != null && quests[i].chapter_end != null && q.chapter_start <= quests[i].chapter_end)
        .map(q => `#${q.id} starts at Ch.${q.chapter_start}, previous ends Ch.${quests.find(x => x === q) && quests[quests.indexOf(q) - 1].chapter_end}`));
    addResult('quests', 'artifact path set and artifacts_total = 1', 'WARN',
      quests.filter(q => !q.artifact_resource_path || Number(q.artifacts_total) !== 1)
        .map(q => `#${q.id} total=${q.artifacts_total} path=${q.artifact_resource_path ? 'set' : 'EMPTY'}`));
    addResult('quests', 'quest status is active', 'WARN',
      quests.filter(q => q.status !== 'active').map(q => `#${q.id} status=${q.status}`));
    await sqlCheck('quests', 'quests with no admin dialogue rows (game uses its local JSON)', 'INFO',
      `SELECT q.id, q.main_quest, q.sub_quest FROM quests q
        WHERE NOT EXISTS (SELECT 1 FROM quest_dialogues d WHERE d.quest_id = q.id)
        ORDER BY q.id`, [], r => `#${r.id} MQ${r.main_quest} SQ${r.sub_quest}`);

    // ----------------------------------------------------------------- players
    await sqlCheck('players', 'status is active / inactive / banned', 'WARN',
      `SELECT id, username, status FROM players WHERE status IS NULL OR status NOT IN ('active','inactive','banned')`,
      [], r => `${who(r)} status=${r.status}`);
    await sqlCheck('players', 'position points at a real quest', 'WARN',
      `SELECT p.id, p.username, p.current_quest_id mq, p.current_sub_quest sq FROM players p
        WHERE p.current_quest_id > 0
          AND NOT EXISTS (SELECT 1 FROM quests q WHERE q.main_quest = p.current_quest_id AND q.sub_quest = p.current_sub_quest)`,
      [], r => `${who(r)} at MQ${r.mq} SQ${r.sq}`);
    await sqlCheck('players', 'players at position 0 (not started / test accounts)', 'INFO',
      `SELECT id, username, status FROM players WHERE COALESCE(current_quest_id, 0) = 0 ORDER BY id`,
      [], r => `${who(r)} ${r.status}`);
    await sqlCheck('players', 'players.chapter mirrors current_quest_id', 'WARN',
      `SELECT id, username, chapter, current_quest_id FROM players
        WHERE current_quest_id > 0 AND chapter <> current_quest_id`,
      [], r => `${who(r)} chapter=${r.chapter} main_quest=${r.current_quest_id}`);
    await sqlCheck('players', 'suspicion within 0–100, suspicion_seq ≥ 0', 'WARN',
      `SELECT id, username, suspicion, suspicion_seq FROM players
        WHERE suspicion IS NULL OR suspicion < 0 OR suspicion > 100 OR suspicion_seq < 0`,
      [], r => `${who(r)} suspicion=${r.suspicion} seq=${r.suspicion_seq}`);
    await sqlCheck('players', 'past the tutorial but has_completed_tutorial = 0', 'WARN',
      `SELECT p.id, p.username, p.current_quest_id mq FROM players p
        WHERE COALESCE(p.has_completed_tutorial, 0) = 0
          AND (p.current_quest_id > 1 OR EXISTS (SELECT 1 FROM player_quests pq WHERE pq.player_id = p.id AND pq.status = 'completed'))`,
      [], r => `${who(r)} at MQ${r.mq}`);
    await sqlCheck('players', 'unverified sign-ups still within their 24h link', 'INFO',
      `SELECT id, username, token_expires_at FROM players WHERE status = 'inactive' AND token_expires_at >= NOW()`,
      [], r => `${who(r)} link expires ${new Date(r.token_expires_at).toISOString()}`);
    await sqlCheck('players', 'unverified sign-ups whose link expired (released on next matching registration)', 'INFO',
      `SELECT id, username, token_expires_at FROM players
        WHERE status = 'inactive' AND (token_expires_at IS NULL OR token_expires_at < NOW())`,
      [], r => `${who(r)} expired ${r.token_expires_at ? new Date(r.token_expires_at).toISOString() : '(no expiry set)'}`);
    await sqlCheck('players', `is_online flag left set, not seen in ${ONLINE_WINDOW_MINUTES} min (already shown offline)`, 'INFO',
      `SELECT id, username, last_seen_at FROM players
        WHERE is_online = 1 AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL ${ONLINE_WINDOW_MINUTES} MINUTE)`,
      [], r => `${who(r)} last seen ${r.last_seen_at ? new Date(r.last_seen_at).toISOString() : 'never'}`);
    await sqlCheck('players', 'email missing or not an address', 'WARN',
      `SELECT id, username FROM players WHERE email IS NULL OR email NOT REGEXP '^[^@[:space:]]+@[^@[:space:]]+\\\\.[^@[:space:]]+$'`,
      [], who);

    const [emails] = await pool.query('SELECT id, username, email FROM players');
    const groups = new Map();
    for (const r of emails) {
      if (!r.email) continue;
      const key = normalizeAccountEmail(r.email);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const dupGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1);
    addResult('players', 'emails shared by several accounts (exempt testing address)', 'INFO',
      dupGroups.filter(([key]) => isMultiAccountEmail(key)).map(([, rows]) => `${rows.length} accounts on the MULTI_ACCOUNT_EMAILS address`));
    addResult('players', 'emails shared by several accounts (not exempt; from before the rule)', 'INFO',
      dupGroups.filter(([key]) => !isMultiAccountEmail(key))
        .map(([, rows]) => `${rows.length} accounts: ${rows.map(who).join(', ')}`));

    // ----------------------------------------------------------- player_quests
    await sqlCheck('player_quests', 'status is a known value', 'WARN',
      `SELECT id, player_id, status FROM player_quests
        WHERE status IS NULL OR status NOT IN ('in_progress','completed','failed','not_started')`,
      [], r => `row #${r.id} player #${r.player_id} status=${r.status}`);
    await sqlCheck('player_quests', 'one row per player per quest', 'WARN',
      `SELECT player_id, quest_id, COUNT(*) n FROM player_quests GROUP BY player_id, quest_id HAVING n > 1`,
      [], r => `player #${r.player_id} quest #${r.quest_id} × ${r.n}`);
    await sqlCheck('player_quests', 'counters not negative', 'WARN',
      `SELECT id, player_id, failure_count, artifacts_found FROM player_quests
        WHERE failure_count < 0 OR artifacts_found < 0`,
      [], r => `row #${r.id} player #${r.player_id} fails=${r.failure_count} artifacts=${r.artifacts_found}`);
    await sqlCheck('player_quests', 'artifacts_found ≤ quest artifacts_total', 'WARN',
      `SELECT pq.id, pq.player_id, pq.artifacts_found, q.artifacts_total FROM player_quests pq
        JOIN quests q ON q.id = pq.quest_id WHERE pq.artifacts_found > q.artifacts_total`,
      [], r => `row #${r.id} player #${r.player_id} found=${r.artifacts_found} of ${r.artifacts_total} (UI caps it)`);
    await sqlCheck('player_quests', 'completed rows have completed_at and 100%', 'WARN',
      `SELECT id, player_id, completed_at, progress_percent FROM player_quests
        WHERE status = 'completed' AND (completed_at IS NULL OR progress_percent < 100)`,
      [], r => `row #${r.id} player #${r.player_id} completed_at=${r.completed_at ? 'set' : 'NULL'} progress=${r.progress_percent}`);
    await sqlCheck('player_quests', 'completed_at only on completed rows', 'WARN',
      `SELECT id, player_id, status FROM player_quests WHERE status <> 'completed' AND completed_at IS NOT NULL`,
      [], r => `row #${r.id} player #${r.player_id} status=${r.status}`);
    await sqlCheck('player_quests', 'progress_percent within 0–100', 'WARN',
      `SELECT id, player_id, progress_percent FROM player_quests WHERE progress_percent < 0 OR progress_percent > 100`,
      [], r => `row #${r.id} player #${r.player_id} progress=${r.progress_percent}`);
    await sqlCheck('player_quests', 'no rows ahead of the player\'s current position', 'WARN',
      `SELECT pq.id, p.id pid, p.username, q.main_quest mq, q.sub_quest sq, pq.status,
              p.current_quest_id cmq, p.current_sub_quest csq
         FROM player_quests pq JOIN players p ON p.id = pq.player_id JOIN quests q ON q.id = pq.quest_id
        WHERE (q.main_quest * 10 + q.sub_quest) > (COALESCE(p.current_quest_id, 0) * 10 + COALESCE(p.current_sub_quest, 0))`,
      [], r => `#${r.pid} ${r.username} has MQ${r.mq} SQ${r.sq} ${r.status}, but is at MQ${r.cmq} SQ${r.csq}`);
    await sqlCheck('player_quests', 'earlier sub-quests completed before the current one', 'INFO',
      `SELECT p.id, p.username, p.current_quest_id mq, p.current_sub_quest sq,
              (SELECT COUNT(*) FROM quests q WHERE (q.main_quest * 10 + q.sub_quest) < (p.current_quest_id * 10 + p.current_sub_quest)) expected,
              (SELECT COUNT(*) FROM player_quests pq JOIN quests q ON q.id = pq.quest_id
                WHERE pq.player_id = p.id AND pq.status = 'completed'
                  AND (q.main_quest * 10 + q.sub_quest) < (p.current_quest_id * 10 + p.current_sub_quest)) done
         FROM players p WHERE p.current_quest_id > 0
       HAVING done < expected`,
      [], r => `${who(r)} at MQ${r.mq} SQ${r.sq}: ${r.done} of ${r.expected} earlier sub-quests completed`);

    // --------------------------------------------------------------- community
    await sqlCheck('community', 'likes_count matches post_likes', 'WARN',
      `SELECT c.id, c.likes_count, (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = c.id) actual
         FROM community_posts c HAVING c.likes_count <> actual`,
      [], r => `post #${r.id} likes_count=${r.likes_count} actual=${r.actual}`);
    await sqlCheck('community', 'comments_count matches post_comments', 'WARN',
      `SELECT c.id, c.comments_count, (SELECT COUNT(*) FROM post_comments m WHERE m.post_id = c.id) actual
         FROM community_posts c HAVING c.comments_count <> actual`,
      [], r => `post #${r.id} comments_count=${r.comments_count} actual=${r.actual}`);
    await sqlCheck('community', 'one like per player per post', 'WARN',
      `SELECT post_id, player_id, COUNT(*) n FROM post_likes GROUP BY post_id, player_id HAVING n > 1`,
      [], r => `post #${r.post_id} player #${r.player_id} × ${r.n}`);

    // ------------------------------------------------------------------- other
    await sqlCheck('other', 'password reset tokens expired but unused (harmless)', 'INFO',
      `SELECT COUNT(*) n FROM password_resets WHERE used = 0 AND expires_at < NOW() HAVING n > 0`,
      [], r => `${r.n} tokens`);

    // ------------------------------------------------------------------ output
    const order = { WARN: 0, INFO: 1, OK: 2 };
    let area = null;
    for (const r of results) {
      if (r.area !== area) { area = r.area; console.log(`\n[${area}]`); }
      const tag = r.level.padEnd(4);
      console.log(`  ${tag}  ${r.name}${r.count ? `  (${r.count})` : ''}`);
      if (r.level !== 'OK') {
        const shown = SHOW_ALL ? r.lines : r.lines.slice(0, SAMPLE);
        shown.forEach(l => console.log(`          - ${l}`));
        if (shown.length < r.lines.length) console.log(`          … ${r.lines.length - shown.length} more (--all)`);
      }
    }
    const tally = results.reduce((t, r) => ((t[r.level] = (t[r.level] || 0) + 1), t), {});
    console.log(`\nSummary: ${tally.WARN || 0} WARN, ${tally.INFO || 0} INFO, ${tally.OK || 0} OK — ${results.length} checks. Nothing was changed.`);
    results.sort((a, b) => order[a.level] - order[b.level]);
    process.exit(0);
  } catch (err) {
    console.error('\nHealth check failed:', err.code || '', err.message);
    process.exit(1);
  }
})();
