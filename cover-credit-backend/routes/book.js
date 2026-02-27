// ============================================================
// ROUTE: /api/book
// Handles consultation booking form submissions
// Updated for new 4-step department-based wizard form
// ============================================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const router  = express.Router();
const Booking = require('../models/Booking');
const { sendBookingAlert, sendUserConfirmation } = require('../utils/email');
const { notifyNewBooking } = require('../utils/whatsapp');

// ── Validation rules ──────────────────────────────────────
const bookingValidation = [
  body('department')
    .trim().notEmpty().withMessage('Please select a department')
    .isIn(['loan', 'health', 'life', 'bike', 'car', 'commercial'])
    .withMessage('Invalid department selected'),

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

  body('city')
    .trim().notEmpty().withMessage('City is required')
    .isLength({ max: 100 }).withMessage('City name too long'),

  body('details')
    .optional()
    .isObject().withMessage('Details must be an object'),

  body('contactMethod')
    .optional()
    .isIn(['Phone Call', 'WhatsApp', 'Email']).withMessage('Invalid contact method'),

  body('timeSlot')
    .optional()
    .isIn([
      'Morning (9 AM – 12 PM)',
      'Afternoon (12 PM – 4 PM)',
      'Evening (4 PM – 7 PM)',
    ]).withMessage('Invalid time slot'),

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
      errors:  errors.array(),
    });
  }

  try {
    const {
      department,
      name,
      phone,
      email,
      city,
      details,
      contactMethod,
      timeSlot,
      notes,
      referredFrom,
    } = req.body;

    const booking = await Booking.create({
      department,
      name,
      phone,
      email:         email         || '',
      city,
      details:       details       || {},
      contactMethod: contactMethod || 'Phone Call',
      timeSlot:      timeSlot      || 'Morning (9 AM – 12 PM)',
      notes:         notes         || '',
      referredFrom:  referredFrom  || '',
      ipAddress:     req.ip,
      source:        'book-form',
    });

    // Fire-and-forget alerts (don't block the response)
    sendBookingAlert(booking.toObject()).catch(console.error);
    notifyNewBooking(booking.toObject()).catch(console.error);

    if (email) {
      sendUserConfirmation(email, name, 'booking', department).catch(console.error);
    }

    res.status(201).json({
      success:   true,
      message:   'Booking confirmed! We will reach you shortly.',
      id:        booking._id,
      reference: `CC-${new Date().getFullYear()}-${booking._id.toString().slice(-4).toUpperCase()}`,
    });

  } catch (err) {
    console.error('Booking submission error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please call us directly at +91 78428 54466.',
    });
  }
});

module.exports = router;
