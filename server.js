const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./auth');
const logsRoutes = require('./logs');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================
// MIDDLEWARE
// ============================================================

// Body parser
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// CORS - Allow frontend to connect
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost',
    'http://127.0.0.1:5500',
    'file://',
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.FRONTEND_URL_PROD || 'https://yourdomain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================================
// ROUTES
// ============================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Logs routes
app.use('/api/logs', logsRoutes);

// Players routes (placeholder)
app.get('/api/players', (req, res) => {
  try {
    pool.query('SELECT * FROM players LIMIT 100', (err, results) => {
      if (err) {
        console.error('Players query error:', err);
        return res.status(500).json({ error: 'Failed to fetch players' });
      }
      res.json(results);
    });
  } catch (err) {
    console.error('Players error:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Quests routes (placeholder)
app.get('/api/quests', (req, res) => {
  try {
    pool.query('SELECT * FROM quests LIMIT 100', (err, results) => {
      if (err) {
        console.error('Quests query error:', err);
        return res.status(500).json({ error: 'Failed to fetch quests' });
      }
      res.json(results);
    });
  } catch (err) {
    console.error('Quests error:', err);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'LAMPARA Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: {
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        register: 'POST /api/auth/register'
      },
      data: {
        players: 'GET /api/players',
        quests: 'GET /api/quests',
        logs: 'GET /api/logs'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// ============================================================
// SERVER START
// ============================================================

// Check database connection on startup
pool.query('SELECT 1', (err) => {
  if (err) {
    console.error('✗ Database Connection Error:', err.message);
  } else {
    console.log('✓ MySQL Database Connected Successfully');
  }
});

app.listen(PORT, () => {
  console.log('✓ LAMPARA Backend server running on port ' + PORT);
  console.log('✓ Environment: ' + process.env.NODE_ENV);
  console.log('✓ API Documentation:');
  console.log('  - Health Check: http://localhost:' + PORT + '/api/health');
  console.log('  - API Root: http://localhost:' + PORT + '/');
});

module.exports = app;