// ============================================================
// ROUTE: /api/team
// Team management — used by the owner's admin panel.
// Protected by the existing owner auth middleware.
// ============================================================
const express    = require('express');
const router     = express.Router();
const ownerAuth  = require('../middleware/auth');  // existing owner middleware
const User       = require('../models/User');
const Booking    = require('../models/Booking');

// All team routes require the owner to be logged in
router.use(ownerAuth);

// ════════════════════════════════════════════════════════════
// OVERVIEW — all agents + their stats
// GET /api/team/overview
// ════════════════════════════════════════════════════════════
router.get('/overview', async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['agent', 'leader'] } })
      .select('-password')
      .lean();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Per-agent stats
    const agentStats = await Promise.all(users.map(async (u) => {
      const f = { agentId: u._id };
      const [total, thisMonth, converted, newLeads, lastLead] = await Promise.all([
        Booking.countDocuments(f),
        Booking.countDocuments({ ...f, createdAt: { $gte: monthStart } }),
        Booking.countDocuments({ ...f, status: 'converted' }),
        Booking.countDocuments({ ...f, status: 'new' }),
        Booking.findOne(f).sort({ createdAt: -1 }).select('createdAt').lean(),
      ]);
      return {
        ...u,
        stats: {
          total,
          thisMonth,
          converted,
          newLeads,
          conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
          lastLeadAt: lastLead?.createdAt || null,
        },
      };
    }));

    const totals = agentStats.reduce(
      (acc, a) => ({
        total:     acc.total     + a.stats.total,
        thisMonth: acc.thisMonth + a.stats.thisMonth,
        converted: acc.converted + a.stats.converted,
      }),
      { total: 0, thisMonth: 0, converted: 0 }
    );

    res.json({
      success:     true,
      agents:      agentStats,
      totals,
      agentCount:  users.filter(u => u.role === 'agent').length,
      leaderCount: users.filter(u => u.role === 'leader').length,
    });
  } catch (err) {
    console.error('Team overview error:', err);
    res.status(500).json({ success: false, message: 'Failed to load team overview.' });
  }
});

// ════════════════════════════════════════════════════════════
// LIST AGENTS
// GET /api/team/agents
// ════════════════════════════════════════════════════════════
router.get('/agents', async (req, res) => {
  try {
    const agents = await User.find()
      .select('-password')
      .populate('teamLeaderId', 'name agentCode')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: agents });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch agents.' });
  }
});

// ════════════════════════════════════════════════════════════
// CREATE AGENT OR LEADER
// POST /api/team/agents
// ════════════════════════════════════════════════════════════
router.post('/agents', async (req, res) => {
  try {
    const { name, email, phone, role, city, region, services, teamLeaderId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-6).toUpperCase() +
                         Math.random().toString(36).slice(-6) + '1!';
    const agentCode    = await User.nextAgentCode();

    const newUser = await User.create({
      name:         name.trim(),
      email:        email.trim(),
      phone:        phone || '',
      password:     tempPassword,
      role:         role || 'agent',
      agentCode,
      city:         city || '',
      region:       region || '',
      services:     services || ['health', 'life', 'vehicle', 'loans'],
      teamLeaderId: teamLeaderId || null,
      mustResetPw:  true,
      active:       true,
    });

    // Send welcome email (non-blocking)
    try {
      const { sendWelcomeAgentEmail } = require('../utils/email');
      await sendWelcomeAgentEmail({
        to:          newUser.email,
        agentName:   newUser.name,
        agentCode:   newUser.agentCode,
        tempPassword,
        loginUrl:    `${process.env.FRONTEND_URL}/agent-dashboard.html`,
      });
    } catch (emailErr) {
      console.warn('Welcome email failed (non-fatal):', emailErr.message);
    }

    res.status(201).json({
      success:     true,
      data:        newUser.toPublic(),
      tempPassword, // shown once so admin can share if email fails
    });
  } catch (err) {
    console.error('Create agent error:', err);
    res.status(500).json({ success: false, message: 'Failed to create agent.' });
  }
});

// ════════════════════════════════════════════════════════════
// UPDATE AGENT
// PATCH /api/team/agents/:id
// ════════════════════════════════════════════════════════════
router.patch('/agents/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Agent not found.' });

    const allowed = ['name', 'phone', 'city', 'region', 'services', 'active', 'teamLeaderId', 'role'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    });

    await user.save();
    res.json({ success: true, data: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update agent.' });
  }
});

// ════════════════════════════════════════════════════════════
// RESET PASSWORD
// POST /api/team/agents/:id/reset-password
// ════════════════════════════════════════════════════════════
router.post('/agents/:id/reset-password', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Agent not found.' });

    const newPassword  = Math.random().toString(36).slice(-6).toUpperCase() +
                         Math.random().toString(36).slice(-6) + '2@';
    user.password      = newPassword;
    user.mustResetPw   = true;
    await user.save();

    res.json({ success: true, tempPassword: newPassword });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// ════════════════════════════════════════════════════════════
// DEACTIVATE AGENT
// DELETE /api/team/agents/:id
// ════════════════════════════════════════════════════════════
router.delete('/agents/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Agent not found.' });
    user.active = false;
    await user.save();
    res.json({ success: true, message: `${user.name} deactivated.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to deactivate agent.' });
  }
});

// ════════════════════════════════════════════════════════════
// VIEW A SPECIFIC AGENT'S LEADS
// GET /api/team/agents/:id/leads
// ════════════════════════════════════════════════════════════
router.get('/agents/:id/leads', async (req, res) => {
  try {
    const agent = await User.findById(req.params.id).select('-password').lean();
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found.' });

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Booking.find({ agentId: agent._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments({ agentId: agent._id }),
    ]);

    res.json({
      success: true,
      agent,
      data:    leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch agent leads.' });
  }
});

module.exports = router;
