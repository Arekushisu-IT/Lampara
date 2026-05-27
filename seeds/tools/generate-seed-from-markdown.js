const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error('Usage: node seeds/tools/generate-seed-from-markdown.js <markdown-path>');
}

const markdown = fs.readFileSync(sourcePath, 'utf8');

const chapterQuestIds = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 11,
  10: 12,
  11: 13,
  12: 14,
  13: 16,
  14: 17,
  15: 18,
  16: 19,
  17: 21,
  18: 22,
  19: 26,
  20: 31
};

const chapterDescriptionOverrides = {
  20: {
    basedOn: 'El Filibusterismo Chapter XXXIX',
    setting: "Padre Florentino's house by the sea, the final confession"
  }
};

const sceneBoundaryPattern = /^(#### Scene \d+: .+|### [^\n]+|## Main Quest(?: .+)?|---)$/gm;

function escapeJs(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

function escapeSql(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

function cleanChoiceText(raw) {
  const text = raw
    .replace(/^Simoun:\s*/m, '')
    .trim()
    .replace(/[“”]/g, '')
    .replace(/\s+/g, ' ');
  return text;
}

function buildDescription(chapter) {
  const override = chapterDescriptionOverrides[chapter.chapter] || {};
  const basedOn = override.basedOn || chapter.basedOn || '';
  const setting = override.setting || chapter.setting || '';

  if (basedOn && setting) return `Based on ${basedOn}. Setting: ${setting}.`;
  if (basedOn) return `Based on ${basedOn}.`;
  if (setting) return `Setting: ${setting}.`;
  return chapter.title;
}

function parseScene(sceneBlock, chapterNumber, questId) {
  const sceneHeader = sceneBlock.match(/^#### Scene (\d+): (.+)$/m);
  if (!sceneHeader) {
    throw new Error(`Missing scene header for chapter ${chapterNumber}`);
  }

  const sequenceOrder = Number(sceneHeader[1]);
  const sceneTitle = sceneHeader[2].trim();
  const playerChoiceIndex = sceneBlock.indexOf('Player Choice:');
  if (playerChoiceIndex === -1) {
    throw new Error(`Missing Player Choice block for chapter ${chapterNumber}, scene ${sequenceOrder}`);
  }

  const preChoice = sceneBlock
    .slice(sceneHeader[0].length, playerChoiceIndex)
    .trim();

  const speakerMatches = [...preChoice.matchAll(/^([^:\n]+):\s*$/gm)];
  const npcName = (speakerMatches.at(-1)?.[1] || 'NPC').trim();

  const optionSection = sceneBlock.slice(playerChoiceIndex);
  const optionHeaderPattern = /^([ABC])\.\s*(Correct Answer|Wrong Answer(?: \/ Reveals Simoun Faster)?)\s*[—-]\s*Suspicion Meter\s*([+-]?\d+)\s*$/gm;
  const optionHeaders = [...optionSection.matchAll(optionHeaderPattern)];
  const options = {};

  for (let index = 0; index < optionHeaders.length; index++) {
    const match = optionHeaders[index];
    const nextMatch = optionHeaders[index + 1];
    const key = match[1].toLowerCase();
    const label = match[2];
    const delta = Number(match[3]);
    const bodyStart = match.index + match[0].length;
    const bodyEnd = nextMatch ? nextMatch.index : optionSection.length;
    const body = cleanChoiceText(optionSection.slice(bodyStart, bodyEnd));
    options[key] = {
      text: body,
      delta,
      correct: label.startsWith('Correct')
    };
  }

  for (const key of ['a', 'b', 'c']) {
    if (!options[key]) {
      throw new Error(`Missing option ${key.toUpperCase()} for chapter ${chapterNumber}, scene ${sequenceOrder}`);
    }
  }

  return {
    quest_id: questId,
    sequence_order: sequenceOrder,
    npc_name: npcName,
    npc_text: preChoice,
    option_a_text: options.a.text,
    option_b_text: options.b.text,
    option_c_text: options.c.text,
    option_a_correct: options.a.correct ? 1 : 0,
    option_b_correct: options.b.correct ? 1 : 0,
    option_c_correct: options.c.correct ? 1 : 0,
    option_a_delta: options.a.delta,
    option_b_delta: options.b.delta,
    option_c_delta: options.c.delta,
    suspicion_penalty: options.b.delta,
    context_notes: `Scene ${sequenceOrder}: ${sceneTitle}`
  };
}

const chapterMatches = [...markdown.matchAll(/^### Chapter (\d+) Dialogue Script: (.+)$/gm)];
const chapters = chapterMatches.map((match, index) => {
  const start = match.index;
  const end = index + 1 < chapterMatches.length ? chapterMatches[index + 1].index : markdown.length;
  const block = markdown.slice(start, end);
  const chapter = Number(match[1]);
  const title = match[2].trim();
  const basedOn = (block.match(/^Based on: (.+)$/m) || [null, ''])[1].trim();
  const setting = (block.match(/^Setting: (.+)$/m) || [null, ''])[1].trim();
  const sceneMatches = [...block.matchAll(/^#### Scene \d+: .+$/gm)];
  const boundaryIndexes = [...block.matchAll(sceneBoundaryPattern)]
    .map(boundaryMatch => boundaryMatch.index)
    .sort((a, b) => a - b);
  const scenes = sceneMatches.map(sceneMatch => {
    const sceneStart = sceneMatch.index;
    const sceneEnd = boundaryIndexes.find(boundaryIndex => boundaryIndex > sceneStart) ?? block.length;
    return block.slice(sceneStart, sceneEnd).trim();
  });

  const questId = chapterQuestIds[chapter];
  if (!questId) {
    throw new Error(`No quest ID mapping for chapter ${chapter}`);
  }

  return {
    chapter,
    questId,
    title,
    basedOn,
    setting,
    description: buildDescription({ chapter, title, basedOn, setting }),
    scenes: scenes.map(scene => parseScene(scene, chapter, questId))
  };
});

const questUpdates = chapters.map(chapter => ({
  id: chapter.questId,
  title: chapter.title,
  description: chapter.description
}));

const dialogues = chapters.flatMap(chapter => chapter.scenes);

const seedFile = `/**
 * seed-dialogues.js
 * Generated from All_El_Filibusterismo_Game_Dialogues.md
 */

const QUEST_UPDATES = [
${questUpdates.map(item => `  { id: ${item.id}, title: '${escapeJs(item.title)}', description: '${escapeJs(item.description)}' }`).join(',\n')}
];

const DIALOGUES = [
${dialogues.map(item => `  {
    quest_id: ${item.quest_id},
    sequence_order: ${item.sequence_order},
    npc_name: '${escapeJs(item.npc_name)}',
    npc_text: '${escapeJs(item.npc_text)}',
    option_a_text: '${escapeJs(item.option_a_text)}',
    option_b_text: '${escapeJs(item.option_b_text)}',
    option_c_text: '${escapeJs(item.option_c_text)}',
    option_a_correct: ${item.option_a_correct},
    option_b_correct: ${item.option_b_correct},
    option_c_correct: ${item.option_c_correct},
    option_a_delta: ${item.option_a_delta},
    option_b_delta: ${item.option_b_delta},
    option_c_delta: ${item.option_c_delta},
    suspicion_penalty: ${item.suspicion_penalty},
    context_notes: '${escapeJs(item.context_notes)}'
  }`).join(',\n')}
];

module.exports = { QUEST_UPDATES, DIALOGUES };
`;

const sqlFile = `-- Lampara Dialogue Import
-- Generated: ${new Date().toISOString()}
-- Source: ${sourcePath}

${questUpdates.map(item => `UPDATE quests SET title = '${escapeSql(item.title)}', description = '${escapeSql(item.description)}', updated_at = NOW() WHERE id = ${item.id};`).join('\n')}

DELETE FROM quest_dialogues;

${dialogues.map(item => `INSERT INTO quest_dialogues (quest_id, sequence_order, npc_name, npc_text, option_a_text, option_b_text, option_c_text, option_a_correct, option_b_correct, option_c_correct, suspicion_penalty, option_a_delta, option_b_delta, option_c_delta, context_notes) VALUES (${item.quest_id}, ${item.sequence_order}, '${escapeSql(item.npc_name)}', '${escapeSql(item.npc_text)}', '${escapeSql(item.option_a_text)}', '${escapeSql(item.option_b_text)}', '${escapeSql(item.option_c_text)}', ${item.option_a_correct}, ${item.option_b_correct}, ${item.option_c_correct}, ${item.suspicion_penalty}, ${item.option_a_delta}, ${item.option_b_delta}, ${item.option_c_delta}, '${escapeSql(item.context_notes)}');`).join('\n')}
`;

fs.writeFileSync(path.join(__dirname, '..', 'generated', 'seed-dialogues.js'), seedFile, 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'generated', 'import-dialogues.sql'), sqlFile, 'utf8');

console.log(`Generated ${questUpdates.length} quest updates and ${dialogues.length} dialogues.`);
