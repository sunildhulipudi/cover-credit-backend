// ============================================================
// ROUTE: /api/admin  — Protected admin endpoints (JWT)
// ============================================================

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Contact = require('../models/Contact');
const Booking = require('../models/Booking');
const { sendReminderEmail } = require('../utils/email');

router.use(auth);

// ══════════════════════════════════════════════════════════
// DASHBOARD STATS  GET /api/admin/stats
// ══════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [
      totalContacts, totalBookings,
      newContacts,   newBookings,
      contactsByInterest, bookingsByTopic, recentActivity,
    ] = await Promise.all([
      Contact.countDocuments(),
      Booking.countDocuments(),
      Contact.countDocuments({ status: 'new' }),
      Booking.countDocuments({ status: 'new' }),
      Contact.aggregate([{ $group: { _id: '$interest', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Booking.aggregate([{ $group: { _id: '$topic',    count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Promise.all([
        Contact.find().sort({ createdAt: -1 }).limit(5).lean(),
        Booking.find().sort({ createdAt: -1 }).limit(5).lean(),
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        totalContacts, totalBookings,
        totalLeads: totalContacts + totalBookings,
        newContacts, newBookings,
        newLeads: newContacts + newBookings,
      },
      contactsByInterest, bookingsByTopic,
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
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
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
    res.json({ success: true, data: contacts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load contacts.' });
  }
});

router.patch('/contacts/:id', async (req, res) => {
  try {
    const allowed = ['status', 'adminNotes'];
    const update  = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    const contact = await Contact.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
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
// BOOKINGS — list + status update
// ══════════════════════════════════════════════════════════
router.get('/bookings', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { name:  { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { topic: { $regex: s, $options: 'i' } },
      ];
    }
    const [bookings, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, data: bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load bookings.' });
  }
});

// PATCH /api/admin/bookings/:id  — update status only (notes done via /note)
router.patch('/bookings/:id', async (req, res) => {
  try {
    const allowed = ['status', 'scheduledAt'];
    const update  = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
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
// Appends a new timestamped note to the call log
// ══════════════════════════════════════════════════════════
router.post('/bookings/:id/note', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required.' });
    }

    const note = { text: text.trim(), addedAt: new Date() };

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $push: { adminNotes: note } },
      { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    res.json({ success: true, data: booking, note });
  } catch (err) {
    console.error('Add note error:', err);
    res.status(500).json({ success: false, message: 'Failed to save note.' });
  }
});

// ══════════════════════════════════════════════════════════
// REMINDERS  POST /api/admin/bookings/:id/reminder
// Saves reminder datetime + sends confirmation email to admin
// ══════════════════════════════════════════════════════════
router.post('/bookings/:id/reminder', async (req, res) => {
  try {
    const { scheduledAt, note } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'Reminder date & time is required.' });
    }

    const reminderDate = new Date(scheduledAt);
    if (isNaN(reminderDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format.' });
    }
    if (reminderDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'Reminder must be set for a future time.' });
    }

    const reminder = { scheduledAt: reminderDate, note: (note || '').trim(), sent: false, sentAt: null };

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { reminder } },
      { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Send a "reminder set" confirmation email to admin right now
    await sendReminderEmail(booking, 'set');

    res.json({ success: true, data: booking, message: 'Reminder set. You will get an email when it is due.' });
  } catch (err) {
    console.error('Set reminder error:', err);
    res.status(500).json({ success: false, message: 'Failed to set reminder.' });
  }
});

module.exports = router;
