// File: routes/auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// 1. Import our Security Guard (Middleware)
const verifyToken = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');

// 2. Import our Validation Rules
const { validatePlayerRegister, validate, validateAdminRegister } = require('../src/middleware/validation');

// 3. Import our Database Logic (Controller)
const { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, checkUsername, verifyPlayer, checkStatus, checkVerification, forgotPassword, resetPassword } = require('../src/controllers/authController');

// ============================================================
// RATE LIMITERS FOR AUTH ENDPOINTS
// ============================================================

// Login rate limiter
// TODO: REVERT AFTER BETA → max: 5, windowMs: 10 * 60 * 1000
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,       // BETA: 5 min (was 10 min)
  max: 20,                        // BETA: 20 (was 5)
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req),
  message: { error: 'Too many login attempts. Please try again after 5 minutes.' }
});

// Player registration rate limiter
// TODO: REVERT AFTER BETA → max: 3, windowMs: 60 * 60 * 1000
const playerRegistrationLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,      // BETA: 30 min (was 60 min)
  max: 30,                        // BETA: 30 (was 3)
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req),
  message: { error: 'Too many registration attempts. Please try again after 30 minutes.' }
});

// Admin registration rate limiter: 3 registrations per 1 hour
const adminRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req),
  message: { error: 'Too many registration attempts. Please try again after 1 hour.' }
});

// Username check rate limiter
// TODO: REVERT AFTER BETA → max: 30
const usernameCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,                       // BETA: 100 (was 30)
  message: { error: 'Too many username checks. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req)
});

// Verification rate limiter: 10 requests per 15 minutes
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req)
});

// Status check rate limiter: 20 requests per 15 minutes
const statusCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many status checks. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req)
});

// ============================================================
// ROUTE MAPPINGS
// ============================================================

// Login endpoints (strict rate limiting)
router.post('/login', loginLimiter, adminLogin);
router.post('/player-login', loginLimiter, playerLogin);

// Registration endpoints (separate limiters — 3 per hour each)
router.post('/register', verifyToken, authorize('admin'), adminRegistrationLimiter, validateAdminRegister, validate, adminRegister);
router.post('/player-register', playerRegistrationLimiter, validatePlayerRegister, validate, playerRegister);

// Verification endpoint (more generous rate limit — 10 per 15 min)
router.post('/verify', verificationLimiter, verifyPlayer);

// Username availability check (separate generous rate limit — 30 per 15 min)
router.post('/check-username', usernameCheckLimiter, checkUsername);

// Player logout (requires auth to prevent spoofed logouts)
router.post('/player-logout', verifyToken, playerLogout);

// Status check (requires authentication — players can only check their own status)
router.post('/check-status', verifyToken, statusCheckLimiter, checkStatus);

// The Security Guard (verifyToken) stops people before they can run getMe!
router.get('/me', verifyToken, getMe);

// Public verification status check (no auth — for registration page)
router.post('/check-verification', statusCheckLimiter, checkVerification);

// Password reset (public — no auth required)
router.post('/forgot-password', verificationLimiter, forgotPassword);
router.post('/reset-password', verificationLimiter, resetPassword);

module.exports = router;