// File: src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR CAUGHT]:', err.message);

  // If it's one of our custom errors, send it cleanly to Unity
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  // Handle MySQL Duplicate Entry (e.g., username taken)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ error: 'This username or email is already taken.', code: 'DUPLICATE_ERROR' });
  }

  // If it's a completely unknown server crash
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
};

module.exports = errorHandler;