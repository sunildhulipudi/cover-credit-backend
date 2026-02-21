// ============================================================
// ROUTE: /api/book
// Handles consultation booking form submissions
// ============================================================

const express   = require('express');
const { body, validationResult } = require('express-validator');
const router    = express.Router();
const Booking   = require('../models/Booking');
const { sendBookingAlert, sendUserConfirmation } = require('../utils/email');
const { notifyNewBooking } = require('../utils/whatsapp');

// ── Validation rules ─────────────────────────────────────
const bookingValidation = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
  body('phone')
    .trim().notEmpty().withMessage('Phone number is required')
    .matches(/^[+\d][\d\s\-]{7,15}$/).withMessage('Invalid phone number'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  body('topic')
    .trim().notEmpty().withMessage('Please select a topic'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Notes too long (max 1000 chars)'),
];

// ── POST /api/book ────────────────────────────────────────
router.post('/', bookingValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    const {
      name, phone, email, topic,
      preferredLanguage, preferredTimeSlot, notes,
    } = req.body;

    const booking = await Booking.create({
      name,
      phone,
      email:               email             || '',
      topic,
      preferredLanguage:   preferredLanguage  || 'Telugu',
      preferredTimeSlot:   preferredTimeSlot  || 'Any time is fine',
      notes:               notes             || '',
      ipAddress:           req.ip,
      source:              'book-form',
    });

    // Background alerts
    sendBookingAlert(booking.toObject()).catch(console.error);
    notifyNewBooking(booking.toObject()).catch(console.error);

    if (email) {
      sendUserConfirmation(email, name, 'booking').catch(console.error);
    }

    res.status(201).json({
      success: true,
      message: 'Booking confirmed! We will call you shortly to confirm your time slot.',
      id: booking._id,
    });

  } catch (err) {
    console.error('Booking submission error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please call us directly at +91 96428 34789.',
    });
  }
});

module.exports = router;
