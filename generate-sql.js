
/**
 * generate-sql.js
 * Parses seed-dialogues.js and outputs a .sql file for Railway console
 * Run: node generate-sql.js
 */
require('dotenv').config();

// Re-import the seed module to get DIALOGUES and QUEST_UPDATES
const seedPath = './seeds/seed-dialogues.js';
let fs = require('fs');
const seedContent = fs.readFileSync(seedPath, 'utf8');

// Extract DIALOGUES array by evaluating in a sandbox fashion
const QUEST_UPDATES = [];
const QUESTS = [];
const DIALOGUES = [];

// Simple JS parser to extract the data
const vm = require('vm');
const sandbox = {
  require: () => ({}),
  console,
  process,
  pool: {},
  QUEST_UPDATES,
  DIALOGUES,
};
// Extract just the data portions
const matchQuests = seedContent.match(/const QUEST_UPDATES = (\[.*?\]);/s);
const_matchDialogues = seedContent.match(/const DIALOGUES = (\[.*?\]);$/s);

if (matchQuests) {
  eval('const temp = ' + matchQuests[1] + ';');
  // This approach won't work cleanly. Let's just generate SQL directly from the seed file content
}

// Better approach: Just generate the SQL output file directly
console.log('Generating SQL file...');

// Read the seed and extract dialogue data lines
const lines = seedContent.split('\n');
let inDialogues = false;
let braceCount = 0;
let currentObj = '';
let dialogueCount = 0;

for (const line of lines) {
  if (line.includes('const DIALOGUES = [' )) {
    inDialogues = true;
    continue;
  }
  if (inDialogues) {
    currentObj += line + '\n';
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    if (braceCount === 0 && line.includes('];')) {
      break;
    }
  }
}

// Remove trailing ]\n; and parse
const objContent = currentObj.replace(/\];?\s*$/, '').trim();
const objs = [];
const splitPattern = /},\s*\n\s*\{/g;
const parts = objContent.split(splitPattern);

for (const part of parts) {
  const cleaned = part.replace(/^[\s{]+/, '').replace(/[\s}]+$/, '');
  try {
    const obj = eval('(' + cleaned + ')');
    objs.push(obj);
    dialogueCount++;
  } catch(e) {
    // Skip malformed entries
  }
}

console.log(`Found ${dialogueCount} dialogue entries`);
console.log(`Quest IDs covered: ${[...new Set(objs.map(o => o.quest_id))].sort((a,b)=>a-b).join(', ')}`);
