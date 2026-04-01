const pool = require('./db');

async function runMigration() {
  console.log('Starting Phase 1 Database Migration (Tutorial Tracking)...');
  
  const queries = [
    "ALTER TABLE players ADD COLUMN has_completed_tutorial BOOLEAN DEFAULT false",
    "ALTER TABLE players ADD COLUMN current_quest_id INT DEFAULT 0",
    "ALTER TABLE players ADD COLUMN current_sub_quest INT DEFAULT 0"
  ];

  for (let q of queries) {
    try {
      await pool.query(q);
      console.log(`[Success] Executed: ${q}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`[Skip] Column already exists, skipping: ${q}`);
      } else {
        console.error(`[Error] Failed query ${q} ->`, err.message);
      }
    }
  }

  console.log('\nMigration complete! Your players table is now ready for the Tutorial data.');
  console.log('You can now run this script with: node migrate-tutorial-columns.js');
  process.exit(0);
}

runMigration();
