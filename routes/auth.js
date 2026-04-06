// File: routes/auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// 1. Import our Security Guard (Middleware)
const verifyToken = require('../src/middleware/auth');

// 2. Import our Validation Rules
const { validatePlayerRegister, validate, validateAdminRegister } = require('../src/middleware/validation');

// 3. Import our Database Logic (Controller)
const { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, checkUsername, verifyPlayer, checkStatus } = require('../src/controllers/authController');

// ============================================================
// RATE LIMITERS FOR AUTH ENDPOINTS
// ============================================================

// Login rate limiter: 10 requests per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Registration/verification rate limiter: 5 requests per 15 minutes
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================
// ROUTE MAPPINGS
// ============================================================

// Login endpoints (strict rate limiting)
router.post('/login', loginLimiter, adminLogin);
router.post('/player-login', loginLimiter, playerLogin);

// Registration and verification endpoints (stricter rate limiting)
router.post('/register', registrationLimiter, validateAdminRegister, validate, adminRegister);
router.post('/player-register', registrationLimiter, validatePlayerRegister, validate, playerRegister);
router.post('/verify', registrationLimiter, verifyPlayer);

// Username availability check (moderate rate limiting)
router.post('/check-username', registrationLimiter, checkUsername);

// Player logout (no rate limiting needed)
router.post('/player-logout', playerLogout);

// Status check (moderate rate limiting)
router.post('/check-status', registrationLimiter, checkStatus);

// The Security Guard (verifyToken) stops people before they can run getMe!
router.get('/me', verifyToken, getMe);

module.exports = router;