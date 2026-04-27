// ============================================================
// MIDDLEWARE: role.js
// NEW FILE — handles JWT auth and data scoping for agents.
// The existing middleware/auth.js (for the owner/admin) is
// completely untouched and still used by /api/admin routes.
// ============================================================
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── 1. authenticate ───────────────────────────────────────
// Verifies a JWT issued to an agent or leader.
// On success: attaches req.user (full User document).
// Used by /api/agent and /api/team routes.
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Owner tokens have role:'admin' — reject them here (they use /api/admin)
    if (decoded.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Use the admin panel instead.' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Account not found.' });
    }
    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact your admin.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// ── 2. requireRole ────────────────────────────────────────
// Usage: requireRole('leader')  or  requireRole('leader', 'agent')
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}.`,
    });
  }
  next();
};

// ── 3. bookingScope ───────────────────────────────────────
// Returns a MongoDB filter object based on who is logged in.
// Call inside any route that fetches bookings.
//
//   leader → { teamLeaderId: id }   — sees their whole team
//   agent  → { agentId: id }        — sees only their own leads
//
// Note: owner doesn't use this — they already see everything via /api/admin.
const bookingScope = (req) => {
  const { _id, role } = req.user;
  if (role === 'leader') return { teamLeaderId: _id };
  return { agentId: _id };
};

// ── 4. teamScope ──────────────────────────────────────────
// Returns a MongoDB User filter based on who is logged in.
//
//   leader → { teamLeaderId: id }   — agents under this leader
//   agent  → { _id: id }            — only themselves
//
const teamScope = (req) => {
  const { _id, role } = req.user;
  if (role === 'leader') return { teamLeaderId: _id };
  return { _id };
};

// ── 5. canManage ──────────────────────────────────────────
// Returns true if req.user is allowed to manage targetUser.
//
//   leader → can manage agents in their own team
//   agent  → cannot manage anyone
//
const canManage = (req, targetUser) => {
  const { _id, role } = req.user;
  if (role === 'leader') {
    return (
      targetUser.role === 'agent' &&
      String(targetUser.teamLeaderId) === String(_id)
    );
  }
  return false;
};

// ── 6. stampLead ──────────────────────────────────────────
// Attaches agentId + teamLeaderId + leadSource to a booking body
// when an agent enters a lead manually from their dashboard.
const stampLead = (req, body) => {
  const { _id, role, teamLeaderId } = req.user;
  if (role === 'agent') {
    body.agentId      = _id;
    body.teamLeaderId = teamLeaderId || null;
    body.leadSource   = body.leadSource || 'agent';
  } else if (role === 'leader') {
    body.agentId      = _id;
    body.teamLeaderId = _id;
    body.leadSource   = body.leadSource || 'agent';
  }
  return body;
};

module.exports = {
  authenticate,
  requireRole,
  bookingScope,
  teamScope,
  canManage,
  stampLead,
};
