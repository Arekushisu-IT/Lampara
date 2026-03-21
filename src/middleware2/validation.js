// File: src/middleware/validation.js
const { body, validationResult } = require('express-validator');

// 1. The Rules for Unity Player Registration
const validatePlayerRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name is too long.'),
  
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isAlphanumeric().withMessage('Username can only contain letters and numbers (no spaces or special characters).')
    .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters.'),
  
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
];

// 2. The Checkpoint
// This runs after the rules above. If a rule was broken, it stops the request and sends the error to Unity!
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // We grab the very first error message and send it back in our standard { error: "msg" } format
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next(); // Passed validation! Go to the Controller.
};

module.exports = { validatePlayerRegister, validate };