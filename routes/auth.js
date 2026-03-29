const authController = require('../src/controllers/authController');

// File: routes/auth.js
const express = require('express');
const router = express.Router();

// 1. Import our Security Guard (Middleware)
const verifyToken = require('../src/middleware/auth');

// 2. Import our Database Logic (Controller)
const { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister, checkUsername, verifyPlayer } = require('../src/controllers/authController');

// 3. Map the URLs to the Controller functions!
router.post('/check-status', checkStatus);
router.post('/login', adminLogin);
router.post('/register', adminRegister);
router.post('/check-username', checkUsername);
router.post('/verify', verifyPlayer)
router.post('/player-login', playerLogin);
router.post('/player-register', playerRegister);
router.post('/player-logout', playerLogout);

// The Security Guard (verifyToken) stops people before they can run getMe!
router.get('/me', verifyToken, getMe); 


router.post('/google-login', authController.googleLogin);
module.exports = router;