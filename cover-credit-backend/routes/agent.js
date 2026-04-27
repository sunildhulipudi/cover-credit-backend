// ============================================================
// ROUTE: /api/agent
// All endpoints used by the agent dashboard (agent-dashboard.html).
// Every response is scoped to the logged-in agent automatically.
// ============================================================
const express = require('express');
const router  = express.Router();
const Booking = require('../models/Booking');
const User    = require('../models/User');
const {
  authenticate,
  bookingScope,
  stampLead,
} = require('../middleware/role');

// All agent routes require a valid agent/leader JWT
router.use(authenticate);

// ════════════════════════════════════════════════════════════
// DASHBOARD — single call that returns everything the
// agent dashboard needs to render
// GET /api/agent/dashboard
// ════════════════════════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  try {
    const scope = bookingScope(req);
    const now   = new Date();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [
      totalLeads,
      leadsToday,
      leadsThisWeek,
      leadsThisMonth,
      converted,
      newLeads,
      recentLeads,
      byDepartment,
      byStatus,
      bySource,
      dailyTrend,
    ] = await Promise.all([
      Booking.countDocuments(scope),
      Booking.countDocuments({ ...scope, createdAt: { $gte: todayStart } }),
      Booking.countDocuments({ ...scope, createdAt: { $gte: weekStart } }),
      Booking.countDocuments({ ...scope, createdAt: { $gte: monthStart } }),
      Booking.countDocuments({ ...scope, status: 'converted' }),
      Booking.countDocuments({ ...scope, status: 'new' }),

      Booking.find(scope)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      Booking.aggregate([
        { $match: scope },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

      Booking.aggregate([
        { $match: scope },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

      Booking.aggregate([
        { $match: scope },
        { $group: { _id: '$leadSource', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

      // Last 14 days — one count per day
      Booking.aggregate([
        {
          $match: {
            ...scope,
            createdAt: { $gte: new Date(Date.now() - 14 * 86400000) },
          },
        },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const conversionRate = totalLeads > 0
      ? Math.round((converted / totalLeads) * 100)
      : 0;

    res.json({
      success: true,
      stats: {
        totalLeads,
        leadsToday,
        leadsThisWeek,
        leadsThisMonth,
        converted,
        newLeads,
        conversionRate,
      },
      recentLeads,
      charts: { byDepartment, byStatus, bySource, dailyTrend },
      agent: req.user.toPublic(),
    });
  } catch (err) {
    console.error('Agent dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
});

// ════════════════════════════════════════════════════════════
// LEADS — scoped automatically to the logged-in role
// ════════════════════════════════════════════════════════════

// GET /api/agent/leads
router.get('/leads', async (req, res) => {
  try {
    const scope = bookingScope(req);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = { ...scope };
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.dept && req.query.dept !== 'all') {
      filter.department = req.query.dept;
    }
    if (req.query.source && req.query.source !== 'all') {
      filter.leadSource = req.query.source;
    }
    if (req.query.q) {
      const re = new RegExp(req.query.q.trim(), 'i');
      filter.$or = [{ name: re }, { phone: re }, { city: re }];
    }

    const [leads, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data:    leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Agent leads error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch leads.' });
  }
});

// POST /api/agent/leads — agent manually enters a new lead
router.post('/leads', async (req, res) => {
  try {
    const body = stampLead(req, { ...req.body });

    if (!body.name?.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (!body.phone?.trim()) {
      return res.status(400).json({ success: false, message: 'Phone is required.' });
    }
    if (!body.department) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }

    // City is required by Booking schema — default to agent's city if not provided
    if (!body.city?.trim()) {
      body.city = req.user.city || 'Not specified';
    }

    body.source    = 'agent-dashboard';
    body.ipAddress = req.ip;

    const booking = await Booking.create(body);

    res.status(201).json({
      success: true,
      message: 'Lead saved.',
      data:    booking,
    });
  } catch (err) {
    console.error('Create lead error:', err);
    res.status(500).json({ success: false, message: 'Failed to save lead.' });
  }
});

// GET /api/agent/leads/:id — single lead
router.get('/leads/:id', async (req, res) => {
  try {
    const scope   = bookingScope(req);
    const booking = await Booking.findOne({ _id: req.params.id, ...scope }).lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch lead.' });
  }
});

// PATCH /api/agent/leads/:id — update status, add note
router.patch('/leads/:id', async (req, res) => {
  try {
    const scope   = bookingScope(req);
    const booking = await Booking.findOne({ _id: req.params.id, ...scope });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Lead not found or access denied.' });
    }

    // Fields agents are allowed to update
    const allowed = ['status', 'contactMethod', 'timeSlot', 'adminNotes'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) booking[f] = req.body[f];
    });

    // Append note if provided
    if (req.body.note?.trim()) {
      booking.noteLog.push({
        note:        req.body.note.trim(),
        addedBy:     req.user._id,
        addedByName: req.user.name,
        addedAt:     new Date(),
      });
    }

    await booking.save();
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Update lead error:', err);
    res.status(500).json({ success: false, message: 'Failed to update lead.' });
  }
});

// ════════════════════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════════════════════

// GET /api/agent/profile
router.get('/profile', (req, res) => {
  res.json({ success: true, data: req.user.toPublic() });
});

// PATCH /api/agent/profile
router.patch('/profile', async (req, res) => {
  try {
    const user    = await User.findById(req.user._id);
    const allowed = ['name', 'phone', 'city'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    });
    await user.save();
    res.json({ success: true, data: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

module.exports = router;
