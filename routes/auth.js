// File: routes/auth.js
const express = require('express');
const router = express.Router();

// 1. Import our Security Guard (Middleware)
const verifyToken = require('../src/middleware/auth');

// 2. Import our Database Logic (Controller)
const { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister } = require('../src/controllers/authController');

// 3. Map the URLs to the Controller functions!
router.post('/login', adminLogin);
router.post('/register', adminRegister);

router.post('/player-login', playerLogin);
router.post('/player-register', playerRegister);
router.post('/player-logout', playerLogout);

// The Security Guard (verifyToken) stops people before they can run getMe!
router.get('/me', verifyToken, getMe); 

module.exports = router;