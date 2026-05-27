/**
 * seed-dialogues-to-sql.js
 * Generates SQL INSERT statements from seed-dialogues.js for Railway console.
 * Run: node seeds/seed-dialogues-to-sql.js > seeds/import-dialogues.sql
 */

const { QUEST_UPDATES, DIALOGUES } = require('./seed-dialogues');

function escapeSql(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

let sql = '';

sql += '-- Lampara Dialogue Import\n';
sql += `-- Generated: ${new Date().toISOString()}\n\n`;

for (const quest of QUEST_UPDATES) {
  sql += `UPDATE quests SET title = '${escapeSql(quest.title)}', description = '${escapeSql(quest.description)}', updated_at = NOW() WHERE id = ${quest.id};\n`;
}

sql += '\nDELETE FROM quest_dialogues;\n\n';

for (const dialogue of DIALOGUES) {
  sql += `INSERT INTO quest_dialogues (quest_id, sequence_order, npc_name, npc_text, option_a_text, option_b_text, option_c_text, option_a_correct, option_b_correct, option_c_correct, suspicion_penalty, option_a_delta, option_b_delta, option_c_delta, context_notes) VALUES (${dialogue.quest_id}, ${dialogue.sequence_order}, '${escapeSql(dialogue.npc_name)}', '${escapeSql(dialogue.npc_text)}', '${escapeSql(dialogue.option_a_text)}', '${escapeSql(dialogue.option_b_text)}', '${escapeSql(dialogue.option_c_text)}', ${dialogue.option_a_correct}, ${dialogue.option_b_correct}, ${dialogue.option_c_correct}, ${dialogue.suspicion_penalty}, ${dialogue.option_a_delta}, ${dialogue.option_b_delta}, ${dialogue.option_c_delta}, '${escapeSql(dialogue.context_notes)}');\n`;
}

console.log(sql);
