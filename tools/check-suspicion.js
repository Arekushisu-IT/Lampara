/**
 * check-suspicion.js — READ-ONLY live view of the suspicion pipeline.
 *
 * Run this between actions while play-testing to see what actually reached the
 * database. Nothing is written.
 *
 *   node tools/check-suspicion.js                 # the 8 most recently active players
 *   node tools/check-suspicion.js Mico1234        # one player by username
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../db');

const username = process.argv[2];

(async () => {
  try {
    const [players] = username
      ? await pool.query(
          `SELECT id, username, suspicion, suspicion_seq, current_quest_id, current_sub_quest,
                  chapter, updated_at
             FROM players WHERE username = ?`, [username])
      : await pool.query(
          `SELECT id, username, suspicion, suspicion_seq, current_quest_id, current_sub_quest,
                  chapter, updated_at
             FROM players ORDER BY updated_at DESC LIMIT 8`);

    if (players.length === 0) {
      console.log(username ? `No player named "${username}".` : 'No players found.');
      process.exit(0);
    }

    console.log('=== players: the live meter and its version ===');
    console.table(players.map(p => ({
      id: p.id,
      username: p.username,
      suspicion: p.suspicion,
      seq: p.suspicion_seq,
      position: `MQ${p.current_quest_id}-SQ${p.current_sub_quest}`,
      updated: p.updated_at ? p.updated_at.toISOString().replace('T', ' ').slice(0, 19) : null
    })));

    const ids = players.map(p => p.id);
    const [quests] = await pool.query(
      `SELECT pq.player_id, pq.quest_id, q.main_quest mq, q.sub_quest sq,
              pq.status, pq.failure_count, pq.artifacts_found, q.artifacts_total
         FROM player_quests pq
         JOIN quests q ON q.id = pq.quest_id
        WHERE pq.player_id IN (?) AND (pq.failure_count > 0 OR pq.status <> 'completed')
        ORDER BY pq.player_id, pq.quest_id`, [ids]);

    console.log('\n=== player_quests: FR6 failures and in-progress rows ===');
    if (quests.length === 0) {
      console.log('  (no failures recorded and nothing in progress for these players)');
    } else {
      console.table(quests.map(r => ({
        player_id: r.player_id,
        quest: `MQ${r.mq}-SQ${r.sq}`,
        status: r.status,
        failures: r.failure_count,
        artifacts: `${r.artifacts_found}/${r.artifacts_total}`
      })));
    }

    const [[cfg]] = await pool.query(
      `SELECT
         MAX(CASE WHEN config_key='suspicion_start' THEN config_value END) start,
         MAX(CASE WHEN config_key='suspicion_wrong_penalty' THEN config_value END) wrong,
         MAX(CASE WHEN config_key='suspicion_streak_bonus' THEN config_value END) streak_bonus,
         MAX(CASE WHEN config_key='suspicion_streak_threshold' THEN config_value END) streak_at,
         MAX(CASE WHEN config_key='suspicion_max' THEN config_value END) max
       FROM game_config`);
    console.log('\n=== game_config the client should be obeying ===');
    console.table([cfg]);

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.code || '', err.message);
    process.exit(1);
  }
})();
