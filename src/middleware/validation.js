// File: src/middleware/validation.js
const { body, validationResult } = require('express-validator');

// ============================================================
// SHARED VALIDATION HELPERS
// ============================================================

// Generic validation checker — use after any validation rules
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

// ============================================================
// PLAYER REGISTRATION (Unity Client)
// ============================================================
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
    .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters long.'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email format.')
    .normalizeEmail(),

  body('birthdate')
    .notEmpty().withMessage('Birthdate is required.')
    .isDate().withMessage('Birthdate must be a valid date (YYYY-MM-DD).')
];

// ============================================================
// ADMIN REGISTER
// ============================================================
const validateAdminRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name is too long.')
    .escape(),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email format.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isStrongPassword({
      minLength: 10,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    }).withMessage('Password must be at least 10 characters and include uppercase, lowercase, number, and symbol.')
];

// ============================================================
// PLAYER CREATE (Admin Panel)
// ============================================================
const validatePlayerCreate = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name is too long.')
    .escape(),

  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isAlphanumeric().withMessage('Username can only contain letters and numbers.')
    .isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters.'),

  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail().withMessage('Invalid email format.')
    .normalizeEmail(),

  body('birthdate')
    .notEmpty().withMessage('Birthdate is required.')
    .isDate().withMessage('Birthdate must be a valid date (YYYY-MM-DD).'),

  body('level')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 100 }).withMessage('Level must be between 1 and 100.')
    .toInt(),

  body('status')
    .optional({ nullable: true })
    .isIn(['active', 'inactive', 'pending', 'banned', 'suspended']).withMessage('Invalid status value.')
];

// ============================================================
// PLAYER UPDATE (Admin Panel)
// ============================================================
const validatePlayerUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Name is too long.')
    .escape(),

  body('username')
    .optional()
    .trim()
    .isAlphanumeric().withMessage('Username can only contain letters and numbers.')
    .isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters.'),

  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail().withMessage('Invalid email format.')
    .normalizeEmail(),

  body('birthdate')
    .optional({ nullable: true })
    .if((value) => value !== undefined && value !== '')
    .isISO8601().withMessage('Birthdate must be a valid date (YYYY-MM-DD).'),

  body('level')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 100 }).withMessage('Level must be between 1 and 100.')
    .toInt(),

  body('experience')
    .optional({ nullable: true })
    .isInt({ min: 0 }).withMessage('Experience must be a positive number.')
    .toInt(),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'banned', 'suspended']).withMessage('Invalid status value.'),

  body('is_online')
    .optional()
    .isBoolean().withMessage('is_online must be true or false.')
    .toBoolean()
];

// ============================================================
// QUEST CREATE
// ============================================================
const validateQuestCreate = [
  // Legacy column, not a lookup key -- optional, defaults to 1 in the route.
  body('chapter')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 13 }).withMessage('Chapter must be between 1 and 13.')
    .toInt(),

  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ max: 200 }).withMessage('Title is too long (max 200 characters).')
    .escape(),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Description is too long (max 1000 characters).')
    .escape(),

  body('status')
    .optional()
    .isIn(['active', 'standby', 'completed', 'archived']).withMessage('Invalid status value.'),

  // Bounded so the id formula (main_quest - 1) * 5 + sub_quest stays collision-free.
  body('main_quest')
    .notEmpty().withMessage('Main quest is required.')
    .isInt({ min: 1, max: 7 }).withMessage('Main quest must be between 1 and 7.')
    .toInt(),

  body('sub_quest')
    .notEmpty().withMessage('Sub quest is required.')
    .isInt({ min: 1, max: 5 }).withMessage('Sub quest must be between 1 and 5.')
    .toInt()
];

// ============================================================
// QUEST UPDATE
// ============================================================
const validateQuestUpdate = [
  body('chapter')
    .optional()
    .isInt({ min: 1, max: 13 }).withMessage('Chapter must be between 1 and 13.')
    .toInt(),

  // El Filibusterismo has 39 chapters. null clears the value.
  body('chapter_start')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 39 }).withMessage('chapter_start must be between 1 and 39.')
    .toInt(),

  body('chapter_end')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 39 }).withMessage('chapter_end must be between 1 and 39.')
    .toInt(),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Title is too long (max 200 characters).')
    .escape(),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Description is too long (max 1000 characters).')
    .escape(),

  body('status')
    .optional()
    .isIn(['active', 'standby', 'completed', 'archived']).withMessage('Invalid status value.')
];

// ============================================================
// EXPORT ALL
// ============================================================
module.exports = {
  validate,
  validatePlayerRegister,
  validateAdminRegister,
  validatePlayerCreate,
  validatePlayerUpdate,
  validateQuestCreate,
  validateQuestUpdate
};