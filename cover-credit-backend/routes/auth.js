// ============================================================
// ROUTE: /api/auth
// Handles login for ALL roles from one endpoint.
//
// Owner login  → matches ADMIN_EMAIL / ADMIN_PASSWORD env vars
//                returns role: 'owner', redirects to /admin
//
// Agent/Leader → looks up in User collection
//                returns role: 'agent' or 'leader',
//                redirects to /agent-dashboard.html
//
// Existing /api/auth/verify is kept exactly as-is.
// ============================================================
const express    = require('express');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const existingAuth = require('../middleware/auth'); // existing owner middleware — unchanged

// Strict limiter: 10 attempts per hour
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

    // ── 1. Check if this is the owner ────────────────────
    const isOwnerEmail = emailLower === process.env.ADMIN_EMAIL?.toLowerCase();
    const isOwnerPass  = password === process.env.ADMIN_PASSWORD;

    if (isOwnerEmail && isOwnerPass) {
      const token = jwt.sign(
        { email: process.env.ADMIN_EMAIL, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );
      return res.json({
        success:    true,
        message:    'Login successful',
        token,
        role:       'owner',
        expiresIn:  '8h',
        redirectTo: '/admin',
      });
    }

    // ── 2. Check agent / leader in database ──────────────
    let User;
    try {
      User = require('../models/User');
    } catch (e) {
      // User model not yet created — only owner login is available
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = await User.findOne({ email: emailLower });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact your admin.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      success:    true,
      message:    'Login successful',
      token,
      role:       user.role,
      name:       user.name,
      agentCode:  user.agentCode,
      mustResetPw: user.mustResetPw,
      expiresIn:  '12h',
      redirectTo: '/agent-dashboard.html',
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/auth/verify ──────────────────────────────────
// Kept exactly as original — verifies owner token for admin panel
router.get('/verify', existingAuth, (req, res) => {
  res.json({ success: true, message: 'Token valid', admin: req.admin });
});

// ── POST /api/auth/agent/change-password ─────────────────
// Agents change their password (separate from admin)
router.post('/agent/change-password', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const jwt2 = require('jsonwebtoken');
    const decoded = jwt2.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Use admin settings instead.' });
    }

    const User = require('../models/User');
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both fields required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password    = newPassword;
    user.mustResetPw = false;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────
// Returns current agent profile (for auto-login on page load)
router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      return res.json({ success: true, role: 'owner', name: 'Admin' });
    }

    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: 'Account not found.' });
    }

    res.json({ success: true, ...user.toPublic() });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
});

module.exports = router;
