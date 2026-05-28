const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../db');
const { QUEST_UPDATES, DIALOGUES } = require('../generated/seed-dialogues');
const { normalizeImportedDialogues } = require('../../src/utils/dialogueImport');

const INSERT_COLUMNS = [
  'quest_id',
  'sequence_order',
  'npc_name',
  'npc_text',
  'option_a_text',
  'option_b_text',
  'option_c_text',
  'option_a_correct',
  'option_b_correct',
  'option_c_correct',
  'suspicion_penalty',
  'option_a_delta',
  'option_b_delta',
  'option_c_delta',
  'context_notes'
];

const REQUIRED_COLUMNS = [
  { name: 'option_a_delta', definition: 'INT NOT NULL DEFAULT 0' },
  { name: 'option_b_delta', definition: 'INT NOT NULL DEFAULT 10' },
  { name: 'option_c_delta', definition: 'INT NOT NULL DEFAULT 10' }
];

async function ensureDialogueColumns(connection) {
  const [columns] = await connection.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'quest_dialogues'
  `);

  const existing = new Set(columns.map(column => column.COLUMN_NAME));

  for (const column of REQUIRED_COLUMNS) {
    if (existing.has(column.name)) continue;
    await connection.query(`ALTER TABLE quest_dialogues ADD COLUMN ${column.name} ${column.definition}`);
  }
}

function buildInsertRows() {
  return normalizeImportedDialogues(DIALOGUES).map(dialogue => [
    dialogue.quest_id,
    dialogue.sequence_order,
    dialogue.npc_name,
    dialogue.npc_text,
    dialogue.option_a_text,
    dialogue.option_b_text,
    dialogue.option_c_text,
    dialogue.option_a_correct,
    dialogue.option_b_correct,
    dialogue.option_c_correct,
    dialogue.suspicion_penalty,
    dialogue.option_a_delta,
    dialogue.option_b_delta,
    dialogue.option_c_delta,
    dialogue.context_notes
  ]);
}

async function main() {
  const connection = await db.getConnection();

  try {
    await ensureDialogueColumns(connection);
    await connection.beginTransaction();

    for (const quest of QUEST_UPDATES) {
      await connection.query(
        'UPDATE quests SET title = ?, description = ?, updated_at = NOW() WHERE id = ?',
        [quest.title, quest.description, quest.id]
      );
    }

    await connection.query('DELETE FROM quest_dialogues');

    const rows = buildInsertRows();
    await connection.query(
      `INSERT INTO quest_dialogues (${INSERT_COLUMNS.join(', ')}) VALUES ?`,
      [rows]
    );

    await connection.commit();

    const [result] = await connection.query(
      'SELECT COUNT(*) AS count FROM quest_dialogues WHERE quest_id IN (?)',
      [QUEST_UPDATES.map(quest => quest.id)]
    );

    console.log(`Imported ${rows.length} dialogues across ${QUEST_UPDATES.length} quests.`);
    console.log(`quest_dialogues rows present for imported quests: ${result[0].count}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
