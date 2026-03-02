// ============================================================
// ROUTE: /api/admin/blog  — PROTECTED
// ============================================================
const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const BlogPost = require('../models/BlogPost');

router.use(auth);

// GET /api/admin/blog — all posts (drafts + expired included)
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const filter = {};
    if (req.query.status   && req.query.status   !== 'all') filter.status   = req.query.status;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { title:   { $regex: s, $options: 'i' } },
        { excerpt: { $regex: s, $options: 'i' } },
        { author:  { $regex: s, $options: 'i' } },
      ];
    }
    const [posts, total] = await Promise.all([
      BlogPost.find(filter).sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).select('-content').lean(),
      BlogPost.countDocuments(filter),
    ]);
    res.json({ success: true, data: posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load posts.' });
  }
});

// GET /api/admin/blog/:id — single post with full content
router.get('/:id', async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load post.' });
  }
});

// POST /api/admin/blog — create
router.post('/', async (req, res) => {
  try {
    const { title, excerpt, content, coverImage, category, tags, author, status, expiresAt } = req.body;
    if (!title || !excerpt || !content || !category)
      return res.status(400).json({ success: false, message: 'Title, excerpt, content, and category are required.' });

    const post = new BlogPost({
      title: title.trim(), excerpt: excerpt.trim(), content,
      coverImage: coverImage || '',
      category, author: (author || 'Cover Credit Team').trim(),
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t=>t.trim()).filter(Boolean) : []),
      status: status || 'draft',
      publishedAt: status === 'published' ? new Date() : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    await post.save();
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'A post with this title already exists.' });
    res.status(500).json({ success: false, message: err.message || 'Failed to create post.' });
  }
});

// PATCH /api/admin/blog/:id — update
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['title','excerpt','content','coverImage','category','tags','author','status','expiresAt'];
    const update  = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    if (update.tags && typeof update.tags === 'string')
      update.tags = update.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (update.expiresAt === '' || update.expiresAt === null) update.expiresAt = null;
    else if (update.expiresAt) update.expiresAt = new Date(update.expiresAt);

    if (update.status === 'published') {
      const existing = await BlogPost.findById(req.params.id).select('publishedAt').lean();
      if (existing && !existing.publishedAt) update.publishedAt = new Date();
    }

    const post = await BlogPost.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!post) return res.status(404).json({ success: false, message: 'Not found.' });

    // Re-run slug generation if title changed
    if (update.title) {
      post.isNew = false;
      post.markModified('title');
      await post.save();
    }

    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update post.' });
  }
});

// DELETE /api/admin/blog/:id
router.delete('/:id', async (req, res) => {
  try {
    await BlogPost.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete post.' });
  }
});

module.exports = router;
