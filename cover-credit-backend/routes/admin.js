// ============================================================
// ROUTE: /api/admin
// Protected admin endpoints — all require valid JWT
// Updated for new department-based booking form
// ============================================================

const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const Contact  = require('../models/Contact');
const Booking  = require('../models/Booking');

// Apply auth to ALL admin routes
router.use(auth);

// ══════════════════════════════════════════════════════════
// DASHBOARD STATS
// GET /api/admin/stats
// ══════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [
      totalContacts,
      totalBookings,
      newContacts,
      newBookings,
      contactsByInterest,
      bookingsByDepartment,   // ← was bookingsByTopic
      recentActivity,
    ] = await Promise.all([
      Contact.countDocuments(),
      Booking.countDocuments(),
      Contact.countDocuments({ status: 'new' }),
      Booking.countDocuments({ status: 'new' }),

      // Group contacts by interest
      Contact.aggregate([
        { $group: { _id: '$interest', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

      // Group bookings by department (replaces old topic grouping)
      Booking.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

      // Last 5 of each
      Promise.all([
        Contact.find().sort({ createdAt: -1 }).limit(5).lean(),
        Booking.find().sort({ createdAt: -1 }).limit(5).lean(),
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        totalContacts,
        totalBookings,
        totalLeads:  totalContacts + totalBookings,
        newContacts,
        newBookings,
        newLeads:    newContacts + newBookings,
      },
      contactsByInterest,
      bookingsByDepartment,      // ← renamed
      recentContacts: recentActivity[0],
      recentBookings: recentActivity[1],
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
});

// ══════════════════════════════════════════════════════════
// CONTACTS
// ══════════════════════════════════════════════════════════

// GET /api/admin/contacts?page=1&limit=20&status=new&search=ravi
router.get('/contacts', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { firstName: { $regex: s, $options: 'i' } },
        { lastName:  { $regex: s, $options: 'i' } },
        { phone:     { $regex: s, $options: 'i' } },
        { email:     { $regex: s, $options: 'i' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Contact.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load contacts.' });
  }
});

// PATCH /api/admin/contacts/:id
router.patch('/contacts/:id', async (req, res) => {
  try {
    const allowed = ['status', 'adminNotes'];
    const update  = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const contact = await Contact.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    );
    if (!contact) return res.status(404).json({ success: false, message: 'Not found.' });

    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed.' });
  }
});

// DELETE /api/admin/contacts/:id
router.delete('/contacts/:id', async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed.' });
  }
});

// ══════════════════════════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════════════════════════

// GET /api/admin/bookings?page=1&status=new&department=bike&search=
router.get('/bookings', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    // New: filter by department
    if (req.query.department && req.query.department !== 'all') {
      filter.department = req.query.department;
    }
    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { name:       { $regex: s, $options: 'i' } },
        { phone:      { $regex: s, $options: 'i' } },
        { email:      { $regex: s, $options: 'i' } },
        { city:       { $regex: s, $options: 'i' } },      // ← new
        { department: { $regex: s, $options: 'i' } },      // ← new
      ];
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Booking.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load bookings.' });
  }
});

// PATCH /api/admin/bookings/:id
router.patch('/bookings/:id', async (req, res) => {
  try {
    const allowed = ['status', 'adminNotes', 'scheduledAt'];
    const update  = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const booking = await Booking.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Not found.' });

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed.' });
  }
});

// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed.' });
  }
});

module.exports = router;
