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
// File: src/middleware/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    req.user = decoded; 
    next(); 
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = verifyToken;
router.get('/me', verifyToken, getMe); 

module.exports = router;