// ============================================================
// ROUTE: /api/track  — PUBLIC
// Receives page view pings from frontend pages
// Wire in server.js: app.use('/api/track', require('./routes/track'));
// ============================================================
const express  = require('express');
const router   = express.Router();
const PageView = require('../models/PageView');

// POST /api/track
router.post('/', async (req, res) => {
  // Always respond immediately — never block the visitor
  res.json({ ok: true });

  // Process async after response sent
  setImmediate(async () => {
    try {
      const { page, path } = req.body;
      if (!page) return;

      const referer = req.headers['referer'] || req.headers['referrer'] || req.body.referrer || '';
      const ua      = req.headers['user-agent'] || '';

      await PageView.create({
        page:     String(page).slice(0, 100),
        path:     String(path || '').slice(0, 200),
        source:   PageView.detectSource(referer),
        device:   PageView.detectDevice(ua),
        referrer: referer.slice(0, 300),
      });
    } catch (e) {
      console.error('Track error:', e.message);
    }
  });
});

// GET /api/track/stats — admin use (called from adminAnalytics route)
// Returns summary stats for the admin panel
router.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalViews,
      bySource,
      byDevice,
      byPage,
      byDay,
    ] = await Promise.all([
      // Total in period
      PageView.countDocuments({ createdAt: { $gte: from } }),

      // By source
      PageView.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // By device
      PageView.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // By page (top 10)
      PageView.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$page', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Daily views for chart (last 14 days)
      PageView.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ success: true, data: { totalViews, bySource, byDevice, byPage, byDay, days } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
});

module.exports = router;
