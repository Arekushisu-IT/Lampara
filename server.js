const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./routes/auth');
const logsRoutes = require('./routes/logs');
const playersRoutes = require('./routes/players');
const questsRoutes = require('./routes/quests');
const gameConfigRoutes = require('./routes/gameConfig');
const gameRoutes = require('./routes/game');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_super_secret_key_here') {
  console.error('✗ JWT_SECRET is not configured properly.');
  console.error('  Please set a strong JWT_SECRET in your .env file (minimum 64 characters).');
  process.exit(1);
}

// ============================================================
// RATE LIMITING CONFIGURATION
// ============================================================

// General API rate limit: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Note: Login and registration rate limiters are defined in routes/auth.js
// and applied per-endpoint for granular control.

// ============================================================
// MIDDLEWARE
// ============================================================

// Trust Railway's reverse proxy for real IP addresses
// Use '1' to trust exactly one proxy hop (Railway's load balancer)
app.set('trust proxy', 1);

// Express has built-in JSON and URL parsing (no need for body-parser)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Apply general rate limit to all API routes
app.use('/api', generalLimiter);

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://localhost',
    'http://127.0.0.1:5500',
    'https://lampara-capstone.netlify.app',
    'https://lampara2026.netlify.app',
    'https://lampara.life',
    'https://api.lampara.life',
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.FRONTEND_URL_PROD || 'https://lampara.life'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✨ NEW: Add Logger HERE (It tracks every request before it hits the routes!)
const logger = require('./src/middleware/logger');
app.use(logger);

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

// Players routes
app.use('/api/players', playersRoutes);

// Quests routes
app.use('/api/quests', questsRoutes);

// Game Config routes (Suspicion Meter settings)
app.use('/api/game-config', gameConfigRoutes);

// Game Client routes (Unity content endpoints)
app.use('/api/game', gameRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'LAMPARA Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      // ... existing endpoint documentation ...
    }
  });
});

// 404 Route Not Found Catch
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// ✨ NEW: Add Global Error Handler HERE (It catches any crashes from the routes above!)
const errorHandler = require('./src/middleware/errorHandler');
app.use(errorHandler);

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✓ MySQL Database Connected Successfully');
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