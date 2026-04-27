// ============================================================
// ROUTE: /api/auth
// Handles login for ALL user types:
//   Owner  → validated against ADMIN_EMAIL / ADMIN_PASSWORD env vars (unchanged)
//   Leader → validated against User model in MongoDB
//   Agent  → validated against User model in MongoDB
//
// Single /login endpoint — frontend redirects based on role returned
// ============================================================

const express    = require('express');
const jwt        = require('jsonwebtoken');
const router     = express.Router();
const rateLimit  = require('express-rate-limit');

// Strict limiter: max 10 login attempts per hour
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in an hour.' },
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const emailLower = email.trim().toLowerCase();

    // ── Step 1: Check if this is the owner (env vars) ─────
    // This is your existing auth — completely unchanged.
    const isOwnerEmail    = emailLower === process.env.ADMIN_EMAIL?.toLowerCase();
    const isOwnerPassword = password   === process.env.ADMIN_PASSWORD;

    if (isOwnerEmail && isOwnerPassword) {
      const token = jwt.sign(
        { email: process.env.ADMIN_EMAIL, role: 'owner' },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );
      return res.json({
        success:    true,
        message:    'Login successful',
        token,
        role:       'owner',
        expiresIn:  '8h',
        redirectTo: '/admin',       // owner goes to existing admin panel
      });
    }

    // ── Step 2: Check if this is an agent or leader ───────
    // Only runs if owner login didn't match.
    let User;
    try {
      User = require('../models/User');
    } catch {
      // User model doesn't exist yet — agent system not set up
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = await User.findOne({ email: emailLower });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact your admin.',
      });
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success:     true,
      message:     'Login successful',
      token,
      role:        user.role,
      name:        user.name,
      agentCode:   user.agentCode,
      mustResetPw: user.mustResetPw,
      expiresIn:   '24h',
      redirectTo:  '/agent-dashboard.html',  // agents go to their dashboard
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/auth/verify ──────────────────────────────────
// Checks if token is still valid — used by admin panel on load
// Works for both owner token (from env) and agent token (from User model)
router.get('/verify', require('../middleware/auth'), (req, res) => {
  res.json({ success: true, message: 'Token valid', admin: req.admin });
});

// ── GET /api/auth/me ──────────────────────────────────────
// Returns the logged-in agent's profile (agents/leaders only)
router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);

    // Owner token has no 'id' field — only email and role
    if (decoded.role === 'owner') {
      return res.json({ role: 'owner', email: decoded.email });
    }

    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user.toPublic());
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── POST /api/auth/change-password ───────────────────────
// For agents/leaders to change their password after first login
router.post('/change-password', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'owner') {
      return res.status(400).json({
        error: 'Owner password is managed via environment variables.',
      });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both fields required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const User = require('../models/User');
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password    = newPassword;
    user.mustResetPw = false;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
