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
const { sendReminderEmail } = require('../utils/email');

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
      bookingsByDepartment,
      recentActivity,
    ] = await Promise.all([
      Contact.countDocuments(),
      Booking.countDocuments(),
      Contact.countDocuments({ status: 'new' }),
      Booking.countDocuments({ status: 'new' }),

      Contact.aggregate([
        { $group: { _id: '$interest', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

      Booking.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),

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
      bookingsByDepartment,
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

router.get('/bookings', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.department && req.query.department !== 'all') {
      filter.department = req.query.department;
    }
    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { name:       { $regex: s, $options: 'i' } },
        { phone:      { $regex: s, $options: 'i' } },
        { email:      { $regex: s, $options: 'i' } },
        { city:       { $regex: s, $options: 'i' } },
        { department: { $regex: s, $options: 'i' } },
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

// PATCH /api/admin/bookings/:id — update status / scheduledAt / adminNotes
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

router.delete('/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed.' });
  }
});

// ══════════════════════════════════════════════════════════
// CALL NOTES  POST /api/admin/bookings/:id/note
// Appends a new timestamped note to callNotes array.
// Never overwrites — each note is permanent with its own timestamp.
// ══════════════════════════════════════════════════════════
router.post('/bookings/:id/note', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required.' });
    }

    const newNote = { text: String(text).trim(), addedAt: new Date() };

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $push: { callNotes: newNote } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Add note error:', err);
    res.status(500).json({ success: false, message: 'Failed to save note.' });
  }
});

// ══════════════════════════════════════════════════════════
// REMINDER  POST /api/admin/bookings/:id/reminder
// Saves reminder date/time + note, then emails admin immediately
// to confirm the reminder was set.
// The actual "due" email is sent by the cron in server.js.
// ══════════════════════════════════════════════════════════
router.post('/bookings/:id/reminder', async (req, res) => {
  try {
    const { scheduledAt, note } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'Reminder date & time is required.' });
    }

    const reminderDate = new Date(scheduledAt);
    if (isNaN(reminderDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date/time.' });
    }
    if (reminderDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'Reminder must be a future date and time.' });
    }

    const reminder = {
      scheduledAt: reminderDate,
      note:        (note || '').trim(),
      sent:        false,
      sentAt:      null,
    };

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { reminder } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Send "reminder set" confirmation email to admin (non-blocking)
    sendReminderEmail(booking, 'set').catch(err =>
      console.error('Reminder confirmation email failed:', err.message)
    );

    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Set reminder error:', err);
    res.status(500).json({ success: false, message: 'Failed to set reminder.' });
  }
});

module.exports = router;
