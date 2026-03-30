// File: routes/auth.js
const express = require('express');
const router = express.Router();

// 1. Import our Security Guard (Middleware)
const verifyToken = require('../src/middleware/auth');

// 2. Import our Validation Rules
const { validatePlayerRegister, validate } = require('../src/middleware/validation');

// 3. Import our Database Logic (Controller)
const { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, checkUsername, verifyPlayer, checkStatus } = require('../src/controllers/authController');

// 4. Map the URLs to the Controller functions!
router.post('/login', adminLogin);
router.post('/register', adminRegister);
router.post('/check-username', checkUsername);
router.post('/verify', verifyPlayer);
router.post('/player-login', playerLogin);
router.post('/player-register', validatePlayerRegister, validate, playerRegister);
router.post('/player-logout', playerLogout);
router.post('/check-status', checkStatus);

// The Security Guard (verifyToken) stops people before they can run getMe!
router.get('/me', verifyToken, getMe); 

module.exports = router;