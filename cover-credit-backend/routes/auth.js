// ============================================================
// ROUTE: /api/auth
// Admin login — returns JWT
// ============================================================

const express  = require('express');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const router   = express.Router();
const rateLimit = require('express-rate-limit');

// Strict limiter: max 10 login attempts per hour
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in an hour.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    // Compare against env vars (no DB needed for single admin)
    const emailMatch    = email.trim().toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
    const passwordMatch = password === process.env.ADMIN_PASSWORD;

    if (!emailMatch || !passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Issue JWT (expires in 8 hours)
    const token = jwt.sign(
      { email: process.env.ADMIN_EMAIL, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      expiresIn: '8h',
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/auth/verify  — check if token is still valid
router.get('/verify', require('../middleware/auth'), (req, res) => {
  res.json({ success: true, message: 'Token valid', admin: req.admin });
});

module.exports = router;
