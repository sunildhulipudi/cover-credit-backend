// ============================================================
// ROUTE: /api/track  — PUBLIC
// ============================================================
const express  = require('express');
const router   = express.Router();
const PageView = require('../models/PageView');

const VALID_SOURCES = ['google','whatsapp','facebook','instagram','linkedin','telegram','twitter','youtube','direct','other'];

// POST /api/track — receive ping from frontend
router.post('/', async (req, res) => {
  res.json({ ok: true }); // always respond immediately

  setImmediate(async () => {
    try {
      const { page, path, source, device, utmMedium, utmCampaign, referrer } = req.body;
      if (!page) return;

      // Frontend UTM/detection wins; fallback to server-side referer detection
      const referer   = referrer || req.headers['referer'] || req.headers['referrer'] || '';
      const ua        = req.headers['user-agent'] || '';
      const rawSource = (source || '').toLowerCase().trim();
      const finalSource = VALID_SOURCES.includes(rawSource)
        ? rawSource
        : PageView.detectSource(referer);
      const finalDevice = ['mobile','desktop','tablet'].includes(device)
        ? device
        : PageView.detectDevice(ua);

      await PageView.create({
        page:        String(page).slice(0, 100),
        path:        String(path || '').slice(0, 200),
        source:      finalSource,
        device:      finalDevice,
        utmMedium:   String(utmMedium   || '').slice(0, 100),
        utmCampaign: String(utmCampaign || '').slice(0, 100),
        referrer:    referer.slice(0, 300),
      });
    } catch (e) {
      console.error('Track error:', e.message);
    }
  });
});

// GET /api/track/stats — admin analytics
router.get('/stats', async (req, res) => {
  try {
    const days = Math.min(365, parseInt(req.query.days) || 30);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalViews, bySource, byDevice, byPage, byDay, byCampaign] = await Promise.all([

      PageView.countDocuments({ createdAt: { $gte: from } }),

      PageView.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      PageView.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      PageView.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: '$page', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Daily for last 14 days (for sparkline)
      PageView.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 86400000) } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
            count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),

      // UTM campaigns (top 5)
      PageView.aggregate([
        { $match: { createdAt: { $gte: from }, utmCampaign: { $ne: '' } } },
        { $group: { _id: { campaign: '$utmCampaign', source: '$source' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({ success: true, data: { totalViews, bySource, byDevice, byPage, byDay, byCampaign, days } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
});

module.exports = router;
