// ============================================================
// ROUTE: /api/contact
// Handles contact form submissions
// ============================================================

const express   = require('express');
const { body, validationResult } = require('express-validator');
const router    = express.Router();
const Contact   = require('../models/Contact');
const { sendContactAlert, sendUserConfirmation } = require('../utils/email');
const { notifyNewContact } = require('../utils/whatsapp');

// ── Validation rules ─────────────────────────────────────
const contactValidation = [
  body('firstName')
    .trim().notEmpty().withMessage('First name is required')
    .isLength({ max: 50 }).withMessage('Name too long'),
  body('phone')
    .trim().notEmpty().withMessage('Phone number is required')
    .matches(/^[+\d][\d\s\-]{7,15}$/).withMessage('Invalid phone number'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  body('message')
    .optional()
    .isLength({ max: 1000 }).withMessage('Message too long (max 1000 chars)'),
];

// ── POST /api/contact ─────────────────────────────────────
router.post('/', contactValidation, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  try {
    const { firstName, lastName, phone, email, interest, message } = req.body;

    // Save to MongoDB
    const contact = await Contact.create({
      firstName,
      lastName:   lastName  || '',
      phone,
      email:      email     || '',
      interest:   interest  || 'Other',
      message:    message   || '',
      ipAddress:  req.ip,
      source:     'contact-form',
    });

    // Fire alerts in background (don't await — keeps response fast)
    sendContactAlert(contact.toObject()).catch(console.error);
    notifyNewContact(contact.toObject()).catch(console.error);

    // Send confirmation to user if email provided
    if (email) {
      sendUserConfirmation(email, firstName, 'contact').catch(console.error);
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! We will contact you within 24 hours.',
      id: contact._id,
    });

  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please call us directly at +91 96428 34789.',
    });
  }
});

module.exports = router;
