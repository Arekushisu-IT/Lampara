const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../db');

const APPLY = process.argv.includes('--apply');
const TARGET_QUEST_ID = getArgValue('--quest-id');
const TEMP_SEQUENCE_OFFSET = 1000000;

function getArgValue(name) {
  const arg = process.argv.find(item => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function parseMergedSpeakerBlocks(rawText, fallbackNpcName = 'NPC') {
  const text = String(rawText || '').replace(/\r/g, '').trim();
  const speakerPattern = /^([^:\n]+):\n([\s\S]*?)(?=\n\n[^:\n]+:\n|$)/gm;
  const speakerBlocks = [];
  const narrationSegments = [];
  let lastIndex = 0;
  let match;

  while ((match = speakerPattern.exec(text)) !== null) {
    const leadingText = text.slice(lastIndex, match.index).trim();
    if (leadingText) {
      narrationSegments.push(leadingText);
    }

    speakerBlocks.push({
      npc_name: match[1].trim() || fallbackNpcName,
      npc_text: match[2].trim()
    });

    lastIndex = match.index + match[0].length;
  }

  const trailingText = text.slice(lastIndex).trim();
  if (trailingText) {
    narrationSegments.push(trailingText);
  }

  if (speakerBlocks.length <= 1) {
    return [];
  }

  const narrationText = narrationSegments.join('\n\n').trim();
  if (narrationText) {
    speakerBlocks[0].npc_text = `${narrationText}\n\n${speakerBlocks[0].npc_text}`.trim();
  }

  return speakerBlocks.filter(block => block.npc_text);
}

function makeSplitRows(dialogue) {
  const speakerBlocks = parseMergedSpeakerBlocks(dialogue.npc_text, dialogue.npc_name);
  if (speakerBlocks.length <= 1) {
    return [];
  }

  return speakerBlocks.map((block, index) => {
    const isLast = index === speakerBlocks.length - 1;

    return {
      quest_id: dialogue.quest_id,
      sequence_order: dialogue.sequence_order + index,
      npc_name: block.npc_name,
      npc_text: block.npc_text,
      option_a_text: isLast ? dialogue.option_a_text : '',
      option_b_text: isLast ? dialogue.option_b_text : '',
      option_c_text: isLast ? dialogue.option_c_text : null,
      option_a_correct: isLast ? dialogue.option_a_correct : 0,
      option_b_correct: isLast ? dialogue.option_b_correct : 0,
      option_c_correct: isLast ? dialogue.option_c_correct : 0,
      suspicion_penalty: isLast ? dialogue.suspicion_penalty : 0,
      option_a_delta: isLast ? dialogue.option_a_delta : 0,
      option_b_delta: isLast ? dialogue.option_b_delta : 0,
      option_c_delta: isLast ? dialogue.option_c_delta : 0,
      context_notes: isLast ? dialogue.context_notes : ''
    };
  });
}

async function fetchDialogues() {
  const params = [];
  const whereClause = TARGET_QUEST_ID ? 'WHERE quest_id = ?' : '';
  if (TARGET_QUEST_ID) {
    params.push(Number(TARGET_QUEST_ID));
  }

  const [rows] = await db.query(`
    SELECT
      id,
      quest_id,
      sequence_order,
      npc_name,
      npc_text,
      option_a_text,
      option_b_text,
      option_c_text,
      option_a_correct,
      option_b_correct,
      option_c_correct,
      suspicion_penalty,
      option_a_delta,
      option_b_delta,
      option_c_delta,
      context_notes
    FROM quest_dialogues
    ${whereClause}
    ORDER BY quest_id, sequence_order
  `, params);

  return rows;
}

function buildMigrationPlan(dialogues) {
  return dialogues
    .map(dialogue => ({
      source: dialogue,
      rows: makeSplitRows(dialogue)
    }))
    .filter(plan => plan.rows.length > 1);
}

function buildQuestMigrationRows(questDialogues, plansBySourceId) {
  const migrationRows = [];

  for (const dialogue of questDialogues) {
    const plan = plansBySourceId.get(dialogue.id);
    if (!plan) {
      migrationRows.push({
        action: 'update',
        sourceId: dialogue.id,
        row: { ...dialogue }
      });
      continue;
    }

    for (let index = 0; index < plan.rows.length; index += 1) {
      migrationRows.push({
        action: index === 0 ? 'update' : 'insert',
        sourceId: dialogue.id,
        row: { ...plan.rows[index] }
      });
    }
  }

  return migrationRows.map((entry, index) => ({
    ...entry,
    row: {
      ...entry.row,
      sequence_order: index + 1
    }
  }));
}

async function updateDialogueRow(connection, id, row) {
  await connection.query(
    `UPDATE quest_dialogues
     SET
       sequence_order = ?,
       npc_name = ?,
       npc_text = ?,
       option_a_text = ?,
       option_b_text = ?,
       option_c_text = ?,
       option_a_correct = ?,
       option_b_correct = ?,
       option_c_correct = ?,
       suspicion_penalty = ?,
       option_a_delta = ?,
       option_b_delta = ?,
       option_c_delta = ?,
       context_notes = ?
     WHERE id = ?`,
    [
      row.sequence_order,
      row.npc_name,
      row.npc_text,
      row.option_a_text,
      row.option_b_text,
      row.option_c_text,
      row.option_a_correct,
      row.option_b_correct,
      row.option_c_correct,
      row.suspicion_penalty,
      row.option_a_delta,
      row.option_b_delta,
      row.option_c_delta,
      row.context_notes,
      id
    ]
  );
}

async function insertDialogueRow(connection, row) {
  await connection.query(
    `INSERT INTO quest_dialogues
      (quest_id, sequence_order, npc_name, npc_text,
       option_a_text, option_b_text, option_c_text,
       option_a_correct, option_b_correct, option_c_correct,
       suspicion_penalty, option_a_delta, option_b_delta, option_c_delta, context_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.quest_id,
      row.sequence_order,
      row.npc_name,
      row.npc_text,
      row.option_a_text,
      row.option_b_text,
      row.option_c_text,
      row.option_a_correct,
      row.option_b_correct,
      row.option_c_correct,
      row.suspicion_penalty,
      row.option_a_delta,
      row.option_b_delta,
      row.option_c_delta,
      row.context_notes
    ]
  );
}

async function applyPlan(plans, dialogues) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const plansByQuest = new Map();
    const plansBySourceId = new Map();
    for (const plan of plans) {
      if (!plansByQuest.has(plan.source.quest_id)) {
        plansByQuest.set(plan.source.quest_id, []);
      }
      plansByQuest.get(plan.source.quest_id).push(plan);
      plansBySourceId.set(plan.source.id, plan);
    }

    for (const [questId, questPlans] of plansByQuest.entries()) {
      const questDialogues = dialogues
        .filter(dialogue => dialogue.quest_id === questId)
        .sort((a, b) => a.sequence_order - b.sequence_order);
      const migrationRows = buildQuestMigrationRows(questDialogues, plansBySourceId);
      const addedRows = migrationRows.filter(entry => entry.action === 'insert').length;

      await connection.query(
        `UPDATE quest_dialogues
         SET sequence_order = sequence_order + ?
         WHERE quest_id = ?`,
        [TEMP_SEQUENCE_OFFSET, questId]
      );

      for (const entry of migrationRows) {
        if (entry.action === 'update') {
          await updateDialogueRow(connection, entry.sourceId, entry.row);
        } else {
          await insertDialogueRow(connection, entry.row);
        }
      }

      console.log(`Applied quest ${questId}: split ${questPlans.length} merged row(s), added ${addedRows} row(s).`);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function printPlan(plans) {
  let addedRows = 0;
  for (const plan of plans) {
    addedRows += plan.rows.length - 1;
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} split merged dialogues`);
  console.log(`Matched merged rows: ${plans.length}`);
  console.log(`Additional rows to create: ${addedRows}`);
  if (TARGET_QUEST_ID) {
    console.log(`Quest filter: ${TARGET_QUEST_ID}`);
  }

  for (const plan of plans.slice(0, 20)) {
    console.log(`\nQuest ${plan.source.quest_id}, original sequence ${plan.source.sequence_order}, id ${plan.source.id}`);
    for (const row of plan.rows) {
      const hasChoices = Boolean(row.option_a_text || row.option_b_text || row.option_c_text);
      const preview = row.npc_text.replace(/\s+/g, ' ').slice(0, 90);
      console.log(`  -> #${row.sequence_order} ${row.npc_name} ${hasChoices ? '[choices]' : '[narration]'}: ${preview}`);
    }
  }

  if (plans.length > 20) {
    console.log(`\n...${plans.length - 20} more merged rows not shown`);
  }
}

async function main() {
  const dialogues = await fetchDialogues();
  const plans = buildMigrationPlan(dialogues);
  printPlan(plans);

  if (!APPLY) {
    console.log('\nNo changes applied. Run with --apply to update the database.');
    return;
  }

  if (plans.length === 0) {
    console.log('\nNo merged rows found.');
    return;
  }

  await applyPlan(plans, dialogues);
  console.log('\nMigration applied successfully.');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
