const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../db');

const APPLY = process.argv.includes('--apply');
const TARGET_QUEST_ID = getArgValue('--quest-id');

function getArgValue(name) {
  const arg = process.argv.find(item => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripOwnSpeakerPrefix(npcText, npcName) {
  const name = String(npcName || '').trim();
  if (!name) {
    return String(npcText || '');
  }

  let cleaned = String(npcText || '');
  const prefixPattern = new RegExp(`^\\s*${escapeRegExp(name)}\\s*:\\s*(?:\\\\n\\s*)?`, 'iu');

  // Remove repeated accidental prefixes, but only when they match npc_name.
  for (let guard = 0; guard < 5 && prefixPattern.test(cleaned); guard += 1) {
    cleaned = cleaned.replace(prefixPattern, '');
  }

  return cleaned.trim();
}

async function fetchDialogues() {
  const params = [];
  const whereClause = TARGET_QUEST_ID ? 'WHERE quest_id = ?' : '';
  if (TARGET_QUEST_ID) {
    params.push(Number(TARGET_QUEST_ID));
  }

  const [rows] = await db.query(`
    SELECT id, quest_id, sequence_order, npc_name, npc_text
    FROM quest_dialogues
    ${whereClause}
    ORDER BY quest_id, sequence_order
  `, params);

  return rows;
}

function buildCleanupPlan(dialogues) {
  return dialogues
    .map(dialogue => {
      const cleanedText = stripOwnSpeakerPrefix(dialogue.npc_text, dialogue.npc_name);

      return {
        ...dialogue,
        cleanedText
      };
    })
    .filter(dialogue => dialogue.cleanedText !== String(dialogue.npc_text || '') && dialogue.cleanedText);
}

async function applyCleanup(plan) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const row of plan) {
      await connection.query(
        `UPDATE quest_dialogues
         SET npc_text = ?
         WHERE id = ?`,
        [row.cleanedText, row.id]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function printPlan(plan) {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} clean dialogue speaker prefixes`);
  console.log(`Rows to clean: ${plan.length}`);
  if (TARGET_QUEST_ID) {
    console.log(`Quest filter: ${TARGET_QUEST_ID}`);
  }

  for (const row of plan.slice(0, 20)) {
    const before = String(row.npc_text || '').replace(/\s+/g, ' ').slice(0, 90);
    const after = row.cleanedText.replace(/\s+/g, ' ').slice(0, 90);
    console.log(`\nQuest ${row.quest_id}, sequence ${row.sequence_order}, id ${row.id}, ${row.npc_name}`);
    console.log(`  before: ${before}`);
    console.log(`  after : ${after}`);
  }

  if (plan.length > 20) {
    console.log(`\n...${plan.length - 20} more rows not shown`);
  }
}

async function main() {
  const dialogues = await fetchDialogues();
  const plan = buildCleanupPlan(dialogues);
  printPlan(plan);

  if (!APPLY) {
    console.log('\nNo changes applied. Run with --apply to update the database.');
    return;
  }

  if (plan.length === 0) {
    console.log('\nNo speaker prefixes found.');
    return;
  }

  await applyCleanup(plan);
  console.log('\nCleanup applied successfully.');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
