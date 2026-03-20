const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
  console.log('Starting database initialization...');
  
  try {
    // Create connection to MySQL without selecting database first
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'mysql.railway.internal',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    console.log('✓ Connected to MySQL server');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'database.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.warn('⚠ database.sql file not found, skipping initialization');
      await connection.end();
      process.exit(0);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL statements sequentially and continue on errors
    const statements = sqlContent
      .split(/;\s*\n/) // split on semicolon + newline to keep multi-line statements together
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (stmtErr) {
        console.warn('⚠ SQL statement failed (continuing):', stmtErr.message);
        console.warn('  Failed statement preview:', stmt.slice(0, 200).replace(/\n/g, ' '));
        // continue with next statement
      }
    }

    console.log('✓ Database schema initialization attempted (errors logged above if any)');

    await connection.end();
    console.log('\n✓ Database initialization complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error initializing database:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();