const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { touchPlayer } = require('../utils/presence');

const verifyToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Player activity keeps them "online" (see src/utils/presence.js). Awaited, so a
  // logout request's own touch lands before the logout handler clears is_online.
  // touchPlayer never throws and is throttled to one write a minute per player.
  if (req.user && req.user.role === 'player') {
    await touchPlayer(pool, req.user.id);
  }
  next();
};

module.exports = verifyToken;
