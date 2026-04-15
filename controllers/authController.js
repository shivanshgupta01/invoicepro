const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { pool } = require('../config/db');
const { generateToken }          = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../utils/email');
require('dotenv').config();

// ── REGISTER ──────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, businessName } = req.body;

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (existing.length) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.execute(
      `INSERT INTO users (first_name, last_name, email, password_hash, business_name)
       VALUES (?, ?, ?, ?, ?)`,
      [firstName.trim(), lastName?.trim() || '', email.toLowerCase().trim(), passwordHash, businessName?.trim() || null]
    );

    const [newUser] = await pool.execute(
      'SELECT id, first_name, last_name, email, business_name FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    const user = newUser[0];
    const token = generateToken(user);

    return res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, businessName: user.business_name },
      redirect: '/landing.html',
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const user = rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ message: 'This account uses Google Sign-In. Please use the Google button.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    return res.status(200).json({
      message: 'Signed in successfully!',
      token,
      user: { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, businessName: user.business_name, avatarUrl: user.avatar_url },
      redirect: '/landing.html',
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── GOOGLE CALLBACK ───────────────────────────────────────────
const googleCallback = (req, res) => {
  try {
    const token = generateToken(req.user);
    res.redirect(`${process.env.FRONTEND_URL}/auth-success.html?token=${token}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/auth.html?error=google_failed`);
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.execute(
      'SELECT id, first_name, email FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase().trim()]
    );

    // Always return success — never reveal if email exists
    const ok = { message: "If that email is registered, you'll receive a reset link shortly." };
    if (!rows.length) return res.status(200).json(ok);

    const user       = rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt  = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await pool.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
    await pool.execute(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, expiresAt]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;
    await sendPasswordResetEmail(user.email, resetLink, user.first_name);

    return res.status(200).json(ok);
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Failed to send email. Try again.' });
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const [rows] = await pool.execute(
      `SELECT prt.*, u.email, u.first_name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = ? AND prt.used = 0 AND prt.expires_at > datetime('now')`,
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ message: 'Reset link is invalid or expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.execute(
      `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
      [passwordHash, rows[0].user_id]
    );
    await pool.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [rows[0].id]);

    return res.status(200).json({ message: 'Password reset! You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── GET ME (protected) ────────────────────────────────────────
const getMe = (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user.id,
      firstName: req.user.first_name,
      lastName: req.user.last_name,
      email: req.user.email,
      businessName: req.user.business_name,
    },
  });
};

module.exports = { register, login, googleCallback, forgotPassword, resetPassword, getMe };
