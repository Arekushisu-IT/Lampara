const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../db');

async function main() {
  const [rows] = await db.query(`
    SELECT
      quest_id,
      sequence_order,
      suspicion_penalty,
      option_a_delta,
      option_b_delta,
      option_c_delta,
      option_c_text
    FROM quest_dialogues
    WHERE (quest_id = 1 AND sequence_order = 1)
       OR (quest_id = 19 AND sequence_order = 6)
       OR (quest_id = 22 AND sequence_order = 6)
       OR (quest_id = 31 AND sequence_order = 6)
    ORDER BY quest_id, sequence_order
  `);

  console.log(JSON.stringify(rows));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
