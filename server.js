const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_PROD
  ],
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const questRoutes = require('./routes/quests');
const logRoutes = require('./routes/logs');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/logs', logRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'LAMPARA Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'LAMPARA Admin Panel API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      players: '/api/players',
      quests: '/api/quests',
      logs: '/api/logs',
      health: '/api/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✓ LAMPARA Backend server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ API Documentation:`);
  console.log(`  - Health Check: http://localhost:${PORT}/api/health`);
  console.log(`  - API Root: http://localhost:${PORT}/\n`);
});

module.exports = app;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));