// File: routes/auth.js
const express = require('express');
const router = express.Router();

const verifyToken = require('../src/middleware/auth');
const { validatePlayerRegister, validate } = require('../src/middleware/validation');
const { adminLogin, playerLogin, playerLogout, getMe, adminRegister, playerRegister } = require('../src/controllers/authController');

router.post('/login', adminLogin);
router.post('/register', adminRegister);

router.post('/player-login', playerLogin);
router.post('/player-logout', playerLogout);

router.post('/player-register', validatePlayerRegister, validate, playerRegister);

router.get('/me', verifyToken, getMe); 

module.exports = router;