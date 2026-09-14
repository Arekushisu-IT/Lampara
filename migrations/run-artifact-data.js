/**
 * run-artifact-data.js
 * Idempotent runner for migrations/artifact_data.sql (Phase 2, Step 1).
 *
 * Brings quests' artifact data in line with the game. Data only -- no schema change.
 *
 *   quests.artifact_resource_path  <- the AR artifact prefab each sub-quest's scene uses
 *   quests.artifacts_total         <- 1 per sub-quest
 *
 * Source of truth: the Unity MQ scenes' SubQuestSequenceConfig.artifactResourcePath,
 * read 2026-09-14 after Plastic changeset 120. Every path below resolves to an existing
 * prefab under Assets/Resources. Each sub-quest has exactly one AR artifact, and
 * ARImageTrackingController stops after the first correct scan, so the game counts one
 * artifact per sub-quest.
 *
 * The game already uses these same paths from its Inspector config, so copying them
 * changes nothing for players -- it makes the data visible to the admin panel, the
 * leaderboard and the artifact glossary API.
 *
 *   node migrations/run-artifact-data.js            # dry run -- shows what it would do
 *   node migrations/run-artifact-data.js --apply    # executes
 *
 * Safe to re-run: rows that already match are skipped. A restore file of the previous
 * values is written before anything is changed.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2');
const pool = require('../db');

const APPLY = process.argv.includes('--apply');

// [main_quest, sub_quest, artifact_resource_path] in game order
const ARTIFACTS = [
  [1, 1, 'Artifacts/PassageOfTheTabo/PassageOfTheTabo_Artifact'],
  [1, 2, 'Artifacts/The Decree of Arrest/TheDecreeOfLandSeizure_Artifact'],
  [1, 3, 'Artifacts/CapitanBasilioLamp/CapitanBasilioLamp_Artifact'],
  [1, 4, 'Artifacts/GlassesModel/SimounsGoggles_Artifact'],
  [2, 1, 'Artifacts/TalesRevolver/TalesRevolver_Artifact'],
  [2, 2, 'Artifacts/The Academy Petition/TheAcademyPetition_Artifact'],
  [2, 3, 'Artifacts/TheBrokenApparatus/TheBrokenApparatus_Artifact'],
  [2, 4, 'Artifacts/QuirogasCrate/QuirogasCrate_Artifact'],
  [3, 1, 'Artifacts/MrLeedsHead/MrLeedsHead_Artifact'],
  [3, 2, 'Artifacts/TheHiddenFuse/TheHiddenFuse_Artifact'],
  [3, 3, 'Artifacts/SimounsJewelCase/SimounsJewelCase_Artifact'],
  [3, 4, 'Artifacts/QuillofRevolution/QuillofRevolution_Artifact'],
  [4, 1, 'Artifacts/ThePasquinade/ThePasquinade_Artifact'],
  [4, 2, 'Artifacts/PadreFernandezsCross/PadreFernandezsCross_Artifact'],
  [4, 3, 'Artifacts/JulisEarrings/JulisEarrings_Artifact'],
  [4, 4, 'Artifacts/Wedding Invitation/WeddingInvitation_Artifact'],
  [5, 1, 'Artifacts/PomegranateLamp/PomegranateLamp_Artifact'],
  [5, 2, 'Artifacts/PomegranateLamp/PomegranateLamp_WeddingGift_Artifact'],
  // Same prefab as MQ2-SQ4 in the Unity scene -- copied as configured; flagged for the
  // Unity owner to confirm whether MQ6 should have its own artifact.
  [6, 1, 'Artifacts/QuirogasCrate/QuirogasCrate_Artifact'],
  [7, 1, 'Artifacts/TheSunkenTreasure/TheSunkenTreasure_Artifact'],
];
const ARTIFACTS_PER_SUB_QUEST = 1;

(async () => {
  try {
    const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
    console.log(`Connected to database: ${db}`);
    console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: DRY RUN (pass --apply to execute)\n');

    // Resolve every target row first. Abort before changing anything if one is missing.
    const plan = [];
    const missing = [];
    for (const [mq, sq, artifactPath] of ARTIFACTS) {
      const [rows] = await pool.query(
        'SELECT id, title, artifact_resource_path, artifacts_total FROM quests WHERE main_quest = ? AND sub_quest = ?',
        [mq, sq]
      );
      if (rows.length === 0) { missing.push(`MQ${mq}-SQ${sq}`); continue; }
      const row = rows[0];
      const changes = row.artifact_resource_path !== artifactPath || row.artifacts_total !== ARTIFACTS_PER_SUB_QUEST;
      plan.push({ mq, sq, artifactPath, row, changes });
    }
    if (missing.length > 0) {
      console.error(`ABORT - quest rows not found: ${missing.join(', ')}. Nothing was changed.`);
      process.exit(1);
    }

    const toChange = plan.filter(p => p.changes);
    console.log(`Artifact data for ${plan.length} sub-quests: ${toChange.length} to update, ` +
                `${plan.length - toChange.length} already correct`);
    for (const p of plan) {
      const current = p.row.artifact_resource_path ? p.row.artifact_resource_path : '(empty)';
      console.log(`  ${p.changes ? (APPLY ? 'SET  ' : 'WOULD') : 'SKIP '} MQ${p.mq}-SQ${p.sq}  ` +
                  `total ${p.row.artifacts_total} -> ${ARTIFACTS_PER_SUB_QUEST}  ` +
                  `${p.changes ? `${current} -> ` : ''}${p.artifactPath}`);
    }

    if (APPLY && toChange.length > 0) {
      // Restore file of the values being replaced, written before any UPDATE runs.
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(__dirname, 'backups');
      const backupFile = path.join(backupDir, `artifact_data_${stamp}.sql`);
      const lines = [
        '-- Restore point written by run-artifact-data.js before updating quests artifact data.',
        `-- Captured: ${new Date().toISOString()}  Database: ${db}`,
        '-- To restore, run this file against the same database.',
        '',
        ...toChange.map(p =>
          `UPDATE quests SET artifact_resource_path = ${mysql.escape(p.row.artifact_resource_path)}, ` +
          `artifacts_total = ${mysql.escape(p.row.artifacts_total)} WHERE id = ${mysql.escape(p.row.id)};`),
        ''
      ];
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(backupFile, lines.join('\n'), 'utf8');
      if (fs.statSync(backupFile).size === 0) throw new Error('backup file is empty');
      console.log(`\nBACKUP ${path.relative(process.cwd(), backupFile)}`);

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const p of toChange) {
          await conn.query(
            'UPDATE quests SET artifact_resource_path = ?, artifacts_total = ? WHERE id = ?',
            [p.artifactPath, ARTIFACTS_PER_SUB_QUEST, p.row.id]
          );
        }
        await conn.commit();
        console.log(`UPDATED ${toChange.length} quests`);
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const [[v]] = await pool.query(
        `SELECT COUNT(*) total,
                SUM(artifact_resource_path IS NULL OR artifact_resource_path = '') empty_paths,
                SUM(artifacts_total) artifacts_total,
                (SELECT COUNT(*) FROM player_quests pq JOIN quests q ON q.id = pq.quest_id
                  WHERE pq.artifacts_found > q.artifacts_total) over_count_rows
           FROM quests`
      );
      console.log('\nVerification:');
      console.log(`  quests: ${v.total}, empty artifact paths: ${v.empty_paths} (expect 0), ` +
                  `artifacts_total sum: ${v.artifacts_total} (expect 20)`);
      console.log(`  player_quests rows with artifacts_found > artifacts_total: ${v.over_count_rows} ` +
                  '(the API caps these at 1 per quest)');
    }

    console.log(`\nDone (${APPLY ? 'applied' : 'dry run - nothing changed'}).`);
    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err.code || '', err.message);
    process.exit(1);
  }
})();
