const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('✗ Missing required database environment variables:', missingVars.join(', '));
  console.error('  Please check your .env file and ensure all DB_* variables are set.');
}

// Create connection pool for better performance
let pool;

if (!missingVars.length) {
  pool = mysql.createPool({
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
}

module.exports = pool || mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'dummy',
  password: 'dummy',
  database: 'dummy',
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0
});
