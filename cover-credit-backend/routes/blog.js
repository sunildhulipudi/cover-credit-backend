// ============================================================
// ROUTE: /api/blog  — PUBLIC
// ============================================================
const express  = require('express');
const router   = express.Router();
const BlogPost = require('../models/BlogPost');

// GET /api/blog — published, non-expired posts
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const now   = new Date();

    const filter = {
      status: 'published',
      publishedAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;

    const [posts, total] = await Promise.all([
      BlogPost.find(filter).sort({ publishedAt: -1 })
        .skip((page - 1) * limit).limit(limit).select('-content').lean(),
      BlogPost.countDocuments(filter),
    ]);

    res.json({ success: true, data: posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load posts.' });
  }
});

// GET /api/blog/:slug — single post + increment views
router.get('/:slug', async (req, res) => {
  try {
    const now  = new Date();
    const post = await BlogPost.findOne({
      slug: req.params.slug, status: 'published', publishedAt: { $lte: now },
    }).lean();
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    BlogPost.findByIdAndUpdate(post._id, { $inc: { views: 1 } }).exec();
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load post.' });
  }
});

module.exports = router;
