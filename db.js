const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'lampara_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lampara_database',
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
