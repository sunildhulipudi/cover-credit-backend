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
app.use(helmet({
  contentSecurityPolicy: false,   // allow admin panel inline styles
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'https://gleaming-rabanadas-c36160.netlify.app',
    'https://gleaming-rabanadas-c36160.netlify.app',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Global Rate Limiter ────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// ── Stricter limiter for form submissions ──────────────────
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
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
// Runs every 60 seconds after DB is connected.
// Finds bookings with unsent reminders whose time has passed,
// fires the "due" email, then marks them as sent so they never fire twice.
function startReminderChecker() {
  const Booking = require('./models/Booking');
  const { sendReminderEmail } = require('./utils/email');

  setInterval(async () => {
    try {
      // Only query if reminder.scheduledAt is set and in the past and not yet sent
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
app.use('/api/contact',  formLimiter, require('./routes/contact'));
app.use('/api/book',     formLimiter, require('./routes/book'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/auth',     require('./routes/auth'));

// ── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Cover Credit API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
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
