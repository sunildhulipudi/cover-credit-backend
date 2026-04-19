// ============================================================
// ROUTE: /api/tax-enquiry
// Public POST — receives tax-services.html popup submissions
// Saves to TaxEnquiry collection (separate from Booking)
// ============================================================

const express     = require('express');
const router      = express.Router();
const TaxEnquiry  = require('../models/TaxEnquiry');
const { sendTaxEnquiryAlert, sendUserConfirmation } = require('../utils/email');
const { notifyNewTaxEnquiry, sendUserTaxConfirmation } = require('../utils/whatsapp');

// ── POST /api/tax-enquiry ─────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name, phone, email,
      city,
      department, service, topic,   // accept all three field names
      message,                          // fallback for notes
      notes,
      page, source,
    } = req.body;

    // ── Validation ────────────────────────────────────────
    if (!name || !name.trim()) {
      return res.status(422).json({ success: false, message: 'Name is required.' });
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return res.status(422).json({ success: false, message: 'A valid 10-digit phone number is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(422).json({ success: false, message: 'Please select your city.' });
    }

    const finalService = (service || department || topic || '').trim();
    if (!finalService) {
      return res.status(422).json({ success: false, message: 'Please select a service.' });
    }

    // ── Save ──────────────────────────────────────────────
    const enquiry = await TaxEnquiry.create({
      name:       name.trim(),
      phone:      phone.trim(),
      email:      (email || '').trim().toLowerCase(),
      city:       city.trim(),
      service:    finalService,
      notes:      (notes || message || '').trim(),  // accept 'notes' or 'message'
      page:       page || '/tax-services',
      source:     source || 'tax-services-popup',
      ipAddress:  req.ip || '',
    });

    // ── Background notifications (silent) ─────────────────
    const notifyData = {
      ...enquiry.toObject(),
      topic: finalService,   // email/WA util uses 'topic'
    };
    sendTaxEnquiryAlert(notifyData).catch(err => console.error('Tax enquiry email error:', err));
    notifyNewTaxEnquiry(notifyData).catch(err => console.error('Tax enquiry admin WA error:', err));

    // WhatsApp confirmation to user
    if (enquiry.phone) {
      sendUserTaxConfirmation(
        enquiry.phone,
        enquiry.name,
        enquiry.service
      ).catch(err => console.error('User tax WA confirmation error:', err));
    }

    // Email confirmation to user
    if (enquiry.email && enquiry.email.includes('@')) {
      sendUserConfirmation(
        enquiry.email,
        enquiry.name,
        'tax',
        enquiry.service
      ).catch(err => console.error('User tax email confirmation error:', err));
    }

    return res.status(201).json({
      success: true,
      message: 'Enquiry received! We will call you within 2 hours.',
      id: enquiry._id,
    });

  } catch (err) {
    console.error('Tax enquiry error:', err);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please WhatsApp us at +91 78428 54466.',
    });
  }
});

module.exports = router;
