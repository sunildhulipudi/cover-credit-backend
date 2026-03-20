// ============================================================
// COVER CREDIT — Main Server
// ============================================================

require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const app = express();

// ── Security & Middleware ──────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: [
    'https://covercredit.in',
    'https://www.covercredit.in',
    process.env.FRONTEND_URL || 'https://gleaming-rabanadas-c36160.netlify.app',
    'https://gleaming-rabanadas-c36160.netlify.app',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// FIX: was '10kb' — blog post HTML content easily exceeds that → "Something went wrong"
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Global Rate Limiter ────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true, legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// ── Stricter limiter for form submissions ──────────────────
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  message: { success: false, message: 'Too many submissions. Please try again in an hour.' },
});

// ── Database Connection ────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    startReminderChecker();
  })
  .catch(err => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Reminder Checker ──────────────────────────────────────
function startReminderChecker() {
  const Booking = require('./models/Booking');
  const { sendReminderEmail } = require('./utils/email');

  setInterval(async () => {
    try {
      const due = await Booking.find({
        'reminder.sent':        false,
        'reminder.scheduledAt': { $ne: null, $lte: new Date() },
      });
      for (const booking of due) {
        await sendReminderEmail(booking, 'due');
        booking.reminder.sent   = true;
        booking.reminder.sentAt = new Date();
        await booking.save();
        console.log(`⏰  Reminder fired — ${booking.name} (${booking._id})`);
      }
    } catch (err) {
      console.error('Reminder checker error:', err.message);
    }
  }, 60 * 1000);

  console.log('⏰  Reminder checker running (every 60s)');
}

// ── API Routes ────────────────────────────────────────────
app.use('/api/contact',      formLimiter, require('./routes/contact'));
app.use('/api/book',         formLimiter, require('./routes/book'));
app.use('/api/admin/upload', require('./routes/upload'));       // ← image upload (Cloudinary)
app.use('/api/admin/blog',   require('./routes/adminBlog'));    // ← must be before /api/admin
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/blog',         require('./routes/blog'));
app.use('/api/track',        require('./routes/track'));        // ← site analytics tracking
app.use('/api/auth',         require('./routes/auth'));

// ── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Cover Credit API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Dynamic OG Preview for Blog Posts ────────────────────
app.get('/og/:slug', async (req, res) => {
  try {
    const BlogPost = require('./models/BlogPost');
    const post = await BlogPost.findOne({
      slug: req.params.slug,
      status: 'published'
    });

    if (!post) return res.redirect('https://covercredit.in/blog');

    const title       = post.title   || 'Cover Credit Blog';
    const description = post.excerpt || 'Read this article on Cover Credit';
    const image       = post.coverImage || 'https://covercredit.in/og-banner.png';
    const pageUrl     = `https://covercredit.in/blog?post=${post.slug}`;

    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${title} — Cover Credit</title>
  <meta name="description" content="${description}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:site_name" content="Cover Credit"/>
  <meta property="og:url" content="${pageUrl}"/>
  <meta property="og:title" content="${title} — Cover Credit"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${image}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="${image}"/>
  <meta http-equiv="refresh" content="0;url=${pageUrl}"/>
  <script>window.location.href="${pageUrl}";</script>
</head>
<body>Redirecting...</body>
</html>`);
  } catch(err) {
    console.error('OG route error:', err.message);
    res.redirect('https://covercredit.in/blog');
  }
});

// ── Serve Admin Panel ─────────────────────────────────────
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ── 404 Handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again.'
      : err.message,
  });
});

// ── Start Server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀  Cover Credit server running on port ${PORT}`);
  console.log(`📊  Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🔗  API health:  http://localhost:${PORT}/api/health`);
});
