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

// Login rate limiter: 5 failed attempts per 10 minutes
// (successful logins don't count; validation errors don't count)
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key: use real IP + X-Forwarded-For (Railway proxy)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  message: { error: 'Too many login attempts. Please try again after 10 minutes.' }
});

// Player registration rate limiter: 3 registrations per 1 hour
// (successful registrations don't count; validation errors don't count)
const playerRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  message: { error: 'Too many registration attempts. Please try again after 1 hour.' }
});

// Admin registration rate limiter: 3 registrations per 1 hour
const adminRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  message: { error: 'Too many registration attempts. Please try again after 1 hour.' }
});

// Username check rate limiter: 30 requests per 15 minutes
// (very generous — users may try many usernames)
const usernameCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many username checks. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Verification rate limiter: 10 requests per 15 minutes
// (more generous — users may refresh the page or have slow networks)
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Status check rate limiter: 20 requests per 15 minutes
// (generous for checking verification status)
const statusCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many status checks. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================
// ROUTE MAPPINGS
// ============================================================

// Login endpoints (strict rate limiting)
router.post('/login', loginLimiter, adminLogin);
router.post('/player-login', loginLimiter, playerLogin);

// Registration endpoints (separate limiters — 3 per hour each)
router.post('/register', adminRegistrationLimiter, validateAdminRegister, validate, adminRegister);
router.post('/player-register', playerRegistrationLimiter, validatePlayerRegister, validate, playerRegister);

// Verification endpoint (more generous rate limit — 10 per 15 min)
router.post('/verify', verificationLimiter, verifyPlayer);

// Username availability check (separate generous rate limit — 30 per 15 min)
router.post('/check-username', usernameCheckLimiter, checkUsername);

// Player logout (requires auth to prevent spoofed logouts)
router.post('/player-logout', verifyToken, playerLogout);

// Status check (moderate rate limiting)
router.post('/check-status', statusCheckLimiter, checkStatus);

// The Security Guard (verifyToken) stops people before they can run getMe!
router.get('/me', verifyToken, getMe);

module.exports = router;