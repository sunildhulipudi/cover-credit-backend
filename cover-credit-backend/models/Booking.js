// ============================================================
// MODEL: Booking
// Stores data from the Book Consultation page (wizard form)
// Updated to match new 4-step department-based form
// ============================================================
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    // ── Step 1: Department ─────────────────────────────────
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: ['loan', 'health', 'life', 'bike', 'car', 'commercial'],
    },

    // ── Step 2: Common contact details ────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name too long'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[+\d][\d\s\-]{7,15}$/, 'Invalid phone number'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City name too long'],
    },

    // ── Step 3: Department-specific details ───────────────
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ── Step 4: Schedule preferences ──────────────────────
    contactMethod: {
      type: String,
      enum: ['Phone Call', 'WhatsApp', 'Email'],
      default: 'Phone Call',
    },
    timeSlot: {
      type: String,
      enum: [
        'Morning (9 AM – 12 PM)',
        'Afternoon (12 PM – 4 PM)',
        'Evening (4 PM – 7 PM)',
      ],
      default: 'Morning (9 AM – 12 PM)',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes too long'],
      default: '',
    },

    // ── Admin / system fields ──────────────────────────────
    status: {
      type: String,
      enum: ['new', 'confirmed', 'completed', 'cancelled', 'no-show'],
      default: 'new',
    },
    scheduledAt:  { type: Date,   default: null },
    adminNotes:   { type: String, default: '' },   // kept for backward compatibility
    source:       { type: String, default: 'book-form' },
    referredFrom: { type: String, default: '' },
    ipAddress:    { type: String, default: '' },

    // ── Call notes log ─────────────────────────────────────
    // Each entry is added when admin saves a note after a call.
    // Text + timestamp are stored permanently — never overwritten.
    callNotes: {
      type: [
        {
          text:    { type: String, required: true, trim: true, maxlength: [2000, 'Note too long'] },
          addedAt: { type: Date, default: Date.now },
          _id:     false,
        },
      ],
      default: [],
    },

    // ── Reminder ───────────────────────────────────────────
    // One active reminder per booking. Replaced each time admin sets a new one.
    reminder: {
      scheduledAt: { type: Date,    default: null  },
      note:        { type: String,  default: ''    },
      sent:        { type: Boolean, default: false },
      sentAt:      { type: Date,    default: null  },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ department: 1 });
bookingSchema.index({ phone: 1 });
// Fast lookup for reminder cron — only non-null, unsent, due reminders
bookingSchema.index({ 'reminder.sent': 1, 'reminder.scheduledAt': 1 });

module.exports = mongoose.model('Booking', bookingSchema);
