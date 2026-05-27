const mysql = require('mysql2/promise');

const useRailwayRootInDev =
  process.env.NODE_ENV !== 'production' &&
  Boolean(process.env.RAILWAY_MYSQL_PASSWORD);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: useRailwayRootInDev ? 'root' : process.env.DB_USER,
  password: useRailwayRootInDev ? process.env.RAILWAY_MYSQL_PASSWORD : process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  timezone: '+08:00'
});

module.exports = pool;
