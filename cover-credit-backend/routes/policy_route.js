// ============================================================
// ROUTE: /api/policy  — PUBLIC
// ============================================================
const express = require('express');
const router  = express.Router();
const Policy  = require('../models/Policy');

// GET /api/policy/:policyNumber — look up a policy by number
// Returns safe subset of data — no phone/email exposed publicly
router.get('/:policyNumber', async (req, res) => {
  try {
    const policyNum = req.params.policyNumber.trim().toUpperCase();

    if (!policyNum || policyNum.length < 5) {
      return res.status(400).json({ success: false, message: 'Please enter a valid policy number.' });
    }

    const policy = await Policy.findOne({ policyNumber: policyNum }).lean();

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found. Please check the number or contact Cover Credit.',
      });
    }

    // Auto-check expiry
    const now     = new Date();
    const expired = new Date(policy.expiresAt) < now;
    const daysLeft = expired ? 0 : Math.ceil((new Date(policy.expiresAt) - now) / 86400000);

    // Return only the fields the customer needs — never expose phone/email publicly
    res.json({
      success: true,
      data: {
        clientName:    policy.clientName,
        policyNumber:  policy.policyNumber,
        type:          policy.type,
        insurerName:   policy.insurerName,
        coverAmount:   policy.coverAmount,
        premium:       policy.premium,
        startDate:     policy.startDate,
        expiresAt:     policy.expiresAt,
        ncb:           policy.ncb,
        status:        expired ? 'expired' : policy.status,
        daysLeft:      daysLeft,
        vehicleNumber: policy.vehicleNumber || null,
      },
    });
  } catch (err) {
    console.error('Policy lookup error:', err.message);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
