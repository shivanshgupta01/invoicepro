const express  = require('express');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const router   = express.Router();
const { register, login, googleCallback, forgotPassword, resetPassword, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Stop on first validation error
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// POST /api/auth/register
router.post('/register',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate, register
);

// POST /api/auth/login
router.post('/login',
  [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate, login
);

// GET /api/auth/google  → redirects to Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// GET /api/auth/google/callback  → Google redirects here
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth.html?error=google_failed' }),
  googleCallback
);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  [body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail()],
  validate, forgotPassword
);

// POST /api/auth/reset-password
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Token required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate, resetPassword
);

// GET /api/auth/me  (🔒 protected)
router.get('/me', protect, getMe);

module.exports = router;
