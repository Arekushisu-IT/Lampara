const mysql = require('mysql2/promise');
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('✗ Missing required database environment variables:', missingVars.join(', '));
  console.error('  Please check your .env file and ensure all DB_* variables are set.');
  process.exit(1);
}

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('✓ MySQL Database Connected Successfully');
    conn.release();
  })
  .catch(err => {
    console.error('✗ Database Connection Error:', err.message);
  });

module.exports = pool;
