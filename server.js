const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./routes/auth');
const logsRoutes = require('./routes/logs');
const playersRoutes = require('./routes/players');
const questsRoutes = require('./routes/quests');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Logs routes
app.use('/api/logs', logsRoutes);

// Players routes (FIXED - now includes PUT for approvals!)
app.use('/api/players', playersRoutes);

// Quests routes
app.use('/api/quests', questsRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'LAMPARA Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me',
        playerLogin: 'POST /api/auth/player-login',
        playerRegister: 'POST /api/auth/player-register'
      },
      data: {
        players: {
          getAll: 'GET /api/players',
          getById: 'GET /api/players/:id',
          create: 'POST /api/players',
          update: 'PUT /api/players/:id',
          delete: 'DELETE /api/players/:id'
        },
        quests: {
          getAll: 'GET /api/quests',
          getById: 'GET /api/quests/:id',
          create: 'POST /api/quests',
          update: 'PUT /api/quests/:id',
          delete: 'DELETE /api/quests/:id'
        },
        logs: {
          getAll: 'GET /api/logs',
          create: 'POST /api/logs'
        }
      }
    }
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: 'GET /'
  });
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✓ MySQL Database Connected Successfully');

    // Ensure essential tables exist; if not, attempt to initialize schema
    try {
      const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
      if (!rows || rows.length === 0) {
        console.warn('⚠ Required tables not found. Running database initializer...');
        const { exec } = require('child_process');
        const path = require('path');
        const initScript = path.join(__dirname, 'init-db-deploy.js');

        exec(`node "${initScript}"`, { cwd: __dirname }, (err, stdout, stderr) => {
          if (err) {
            console.error('✗ Database initializer failed:', err.message);
            if (stderr) console.error(stderr);
            return;
          }
          console.log(stdout);
          console.log('✓ Database initialized by init-db-deploy.js');
        });
      }
    } catch (checkErr) {
      console.warn('Could not verify tables:', checkErr.message);
    }
  } catch (err) {
    console.error('✗ Database Connection Error:', err.message);
  }

  app.listen(PORT, () => {
    console.log('✓ LAMPARA Backend server running on port ' + PORT);
    console.log('✓ Environment: ' + process.env.NODE_ENV);
    console.log('✓ API Documentation:');
    console.log('  - Health Check: http://localhost:' + PORT + '/api/health');
    console.log('  - API Root: http://localhost:' + PORT + '/');
    console.log('✓ Ready to accept student approvals!');
  });
}

startServer();

module.exports = app;