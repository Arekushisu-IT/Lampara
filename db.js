const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'shortline.proxy.rlwy.net',
  port: process.env.DB_PORT || 20695,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'GWfTGOjllDMkISGtmudCOsoYoscLoiBK',
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
