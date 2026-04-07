const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./routes/auth');
const logsRoutes = require('./routes/logs');
const playersRoutes = require('./routes/players');
const questsRoutes = require('./routes/quests');

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

// Strict rate limit for login endpoints: 10 requests per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limit for registration/verification: 5 requests per 15 minutes
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration/verification attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================
// MIDDLEWARE
// ============================================================

// Express has built-in JSON and URL parsing (no need for body-parser)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Apply general rate limit to all API routes
app.use('/api', generalLimiter);

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost',
    'http://127.0.0.1:5500',
    'https://lampara-capstone.netlify.app',
    'https://lampara2026.netlify.app',
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.FRONTEND_URL_PROD || 'https://yourdomain.com'
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

    // Ensure essential tables exist; if not, attempt to initialize schema
    try {
      const [rows] = await pool.query("SHOW TABLES LIKE 'Admin_User'");
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