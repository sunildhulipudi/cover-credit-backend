// ============================================================
// ROUTE: /api/admin/policy  — PROTECTED
// ============================================================
const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const Policy   = require('../models/Policy');

router.use(auth);

// GET /api/admin/policy — all policies with search/filter
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const filter = {};

    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.type   && req.query.type   !== 'all') filter.type   = req.query.type;
    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { clientName:   { $regex: s, $options: 'i' } },
        { policyNumber: { $regex: s, $options: 'i' } },
        { phone:        { $regex: s, $options: 'i' } },
        { insurerName:  { $regex: s, $options: 'i' } },
        { vehicleNumber:{ $regex: s, $options: 'i' } },
      ];
    }

    const [policies, total] = await Promise.all([
      Policy.find(filter).sort({ expiresAt: 1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Policy.countDocuments(filter),
    ]);

    // Auto-update status for expired
    const now = new Date();
    policies.forEach(p => {
      if (new Date(p.expiresAt) < now && p.status === 'active') p.status = 'expired';
      p.daysLeft = Math.ceil((new Date(p.expiresAt) - now) / 86400000);
    });

    res.json({
      success: true, data: policies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load policies.' });
  }
});

// GET /api/admin/policy/stats — dashboard numbers
router.get('/stats', async (req, res) => {
  try {
    const now      = new Date();
    const in30days = new Date(now.getTime() + 30 * 86400000);

    const [total, active, expired, renewingSoon] = await Promise.all([
      Policy.countDocuments(),
      Policy.countDocuments({ status: 'active', expiresAt: { $gte: now } }),
      Policy.countDocuments({ $or: [{ status: 'expired' }, { expiresAt: { $lt: now } }] }),
      Policy.countDocuments({ status: 'active', expiresAt: { $gte: now, $lte: in30days } }),
    ]);

    res.json({ success: true, data: { total, active, expired, renewingSoon } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
});

// GET /api/admin/policy/:id — single policy
router.get('/:id', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id).lean();
    if (!policy) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load policy.' });
  }
});

// POST /api/admin/policy — create
router.post('/', async (req, res) => {
  try {
    const {
      clientName, phone, email, policyNumber, vehicleNumber,
      type, insurerName, coverAmount, premium,
      startDate, expiresAt, ncb, notes,
    } = req.body;

    if (!clientName || !phone || !policyNumber || !type || !insurerName || !coverAmount || !premium || !startDate || !expiresAt) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
    }

    const policy = new Policy({
      clientName: clientName.trim(),
      phone:      phone.trim(),
      email:      (email || '').trim(),
      policyNumber: policyNumber.trim().toUpperCase(),
      vehicleNumber: (vehicleNumber || '').trim().toUpperCase(),
      type, insurerName: insurerName.trim(),
      coverAmount: Number(coverAmount),
      premium:     Number(premium),
      startDate:   new Date(startDate),
      expiresAt:   new Date(expiresAt),
      ncb:         Number(ncb) || 0,
      notes:       (notes || '').trim(),
      status: new Date(expiresAt) < new Date() ? 'expired' : 'active',
    });

    await policy.save();
    res.status(201).json({ success: true, data: policy });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'A policy with this number already exists.' });
    res.status(500).json({ success: false, message: err.message || 'Failed to create policy.' });
  }
});

// PATCH /api/admin/policy/:id — update
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['clientName','phone','email','vehicleNumber','type','insurerName',
                     'coverAmount','premium','startDate','expiresAt','ncb','notes','status'];
    const update = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    if (update.coverAmount) update.coverAmount = Number(update.coverAmount);
    if (update.premium)     update.premium     = Number(update.premium);
    if (update.ncb)         update.ncb         = Number(update.ncb);
    if (update.startDate)   update.startDate   = new Date(update.startDate);
    if (update.expiresAt) {
      update.expiresAt = new Date(update.expiresAt);
      if (update.expiresAt < new Date()) update.status = 'expired';
      else if (!update.status) update.status = 'active';
    }

    const policy = await Policy.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!policy) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update.' });
  }
});

// DELETE /api/admin/policy/:id
router.delete('/:id', async (req, res) => {
  try {
    await Policy.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Policy deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete.' });
  }
});

module.exports = router;
