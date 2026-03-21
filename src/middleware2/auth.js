// File: routes/auth.js
const express = require('express');
const router = express.Router();

// 1. Import our Middlewares (Security & Validation)
const verifyToken = require('../src/middleware/auth');
const { validatePlayerRegister, validate } = require('../src/middleware/validation');

// 2. Import our Database Logic (Controllers)
const { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister } = require('../src/controllers/authController');

// 3. Map the URLs
router.post('/login', adminLogin);
router.post('/register', adminRegister);

router.post('/player-login', playerLogin);
router.post('/player-logout', playerLogout);

// ✨ NEW: We put the validators right here! The request must pass both before reaching playerRegister
router.post('/player-register', validatePlayerRegister, validate, playerRegister);

router.get('/me', verifyToken, getMe); 

module.exports = router;