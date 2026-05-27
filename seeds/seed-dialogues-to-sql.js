
/**
 * seed-dialogues-to-sql.js
 * Generates SQL INSERT statements from seed-dialogues.js for Railway console
 * Run: node seeds/seed-dialogues-to-sql.js > seeds/import-dialogues.sql
 */
require('dotenv').config();

// We need to extract data from seed-dialogues.js without executing DB calls
const fs = require('fs');
const path = require('path');

// Read the original seed file
const seedContent = fs.readFileSync(path.join(__dirname, 'seed-dialogues.js'), 'utf8');

// Extract QUEST_UPDATES array
const questUpdatesMatch = seedContent.match(/const QUEST_UPDATES = (\[[\s\S]*?\]);\n/);
const questUpdates = [];
if (questUpdatesMatch) {
  const arrStr = questUpdatesMatch[1].trim();
  // Parse it
  const arrMatch = arrStr.match(/\{[\s\S]*?\}/g);
  if (arrMatch) {
    for (const match of arrMatch) {
      const idMatch = match.match(/id:\s*(\d+)/);
      const titleMatch = match.match(/title:\s*['"]([^'"]+)['"]/);
      const descMatch = match.match(/description:\s*['"]([^'"]+)['"]/);
      if (idMatch && titleMatch) {
        questUpdates.push({
          id: parseInt(idMatch[1]),
          title: titleMatch[1],
          description: descMatch ? descMatch[1] : ''
        });
      }
    }
  }
}

// Extract DIALOGUES array
const dialoguesMatch = seedContent.match(/const DIALOGUES = (\[[\s\S]*?\]);\n/);
const dialogues = [];
if (dialoguesMatch) {
  const arrStr = dialoguesMatch[1].trim();
  // Split by },\n  {
  const objMatches = arrStr.match(/\{[\s\S]*?\}/g);
  if (objMatches) {
    for (const match of objMatches) {
      const questIdMatch = match.match(/quest_id:\s*(\d+)/);
      const seqMatch = match.match(/sequence_order:\s*(\d+)/);
      const npcMatch = match.match(/npc_name:\s*['"]([^'"]+)['"]/);
      const npcTextMatch = match.match(/npc_text:\s*['"]([\s\S]*?)['"],/);
      const optionAMatch = match.match(/option_a_text:\s*['"]([^'"]+)['"]/);
      const optionBMatch = match.match(/option_b_text:\s*['"]([^'"]+)['"]/);
      const optionCMatch = match.match(/option_c_text:\s*['"]([^'"]+)['"]/);
      const contextMatch = match.match(/context_notes:\s*['"]([^'"]+)['"]/);

      if (questIdMatch && seqMatch && npcMatch) {
        dialogues.push({
          quest_id: parseInt(questIdMatch[1]),
          sequence_order: parseInt(seqMatch[1]),
          npc_name: npcMatch[1] || 'NPC',
          npc_text: npcTextMatch ? npcTextMatch[1] : '',
          option_a_text: optionAMatch ? optionAMatch[1] : '',
          option_b_text: optionBMatch ? optionBMatch[1] : '',
          option_c_text: optionCMatch ? optionCMatch[1] : '',
          context_notes: contextMatch ? contextMatch[1] : ''
        });
      }
    }
  }
}

// Use process.stderr for all console output so only SQL goes to stdout
const log = (...args) => process.stderr.write(args.map(String).join(' ') + '\n');

log(`Extracted ${questUpdates.length} quest updates and ${dialogues.length} dialogues`);

// Generate SQL
let sql = '';

// Header
sql += '-- Lampara Dialogue Import\n';
sql += '-- Generated: ' + new Date().toISOString() + '\n';
sql += '-- Run this in Railway MySQL Console\n\n';

// Quest updates
sql += "-- Update quest titles and descriptions\n";
for (const q of questUpdates) {
  const safeTitle = q.title.replace(/'/g, "\\'");
  const safeDesc = q.description.replace(/'/g, "\\'");
  sql += `UPDATE quests SET title = '${safeTitle}', description = '${safeDesc}', updated_at = NOW() WHERE id = ${q.id};\n`;
}
sql += '\n';

// Delete existing dialogues (clean slate)
sql += '-- Delete ALL existing dialogues (clean slate)\n';
sql += 'DELETE FROM quest_dialogues;\n\n';

// Insert dialogues
sql += '-- Insert dialogues\n';
for (const d of dialogues) {
  const npcText = d.npc_text.replace(/'/g, "\\'").replace(/\n/g, '\\n');
  const optA = d.option_a_text.replace(/'/g, "\\'");
  const optB = d.option_b_text.replace(/'/g, "\\'");
  const optC = d.option_c_text.replace(/'/g, "\\'");
  const notes = d.context_notes.replace(/'/g, "\\'");

  sql += `INSERT INTO quest_dialogues (quest_id, sequence_order, npc_name, npc_text, option_a_text, option_b_text, option_c_text, option_a_correct, option_b_correct, option_c_correct, suspicion_penalty, context_notes) VALUES (${d.quest_id}, ${d.sequence_order}, '${d.npc_name}', '${npcText}', '${optA}', '${optB}', '${optC}', 1, 0, 0, 10, '${notes}');\n`;
}

sql += '\n-- Verification query\n';
sql += 'SELECT q.id, q.title, COUNT(qd.id) as dialogues FROM quests q LEFT JOIN quest_dialogues qd ON qd.quest_id = q.id GROUP BY q.id ORDER BY q.id;\n';

console.log(sql);
process.exit(0);
