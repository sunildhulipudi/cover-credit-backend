// ============================================================
// MODEL: Booking
// Stores data from the Book Consultation page (wizard form)
// Updated to match new 4-step department-based form
// + Sub-agent fields added at the bottom (all optional/defaulted,
//   so every existing booking in MongoDB is completely unaffected)
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
      enum: [
        // Original statuses — kept exactly
        'new', 'confirmed', 'completed', 'cancelled', 'no-show',
        // Added for agent CRM workflow
        'contacted', 'qualified', 'proposal', 'converted',
        'notInterested', 'followUp',
        'noAnswer1', 'noAnswer2', 'noAnswer3',
        'callbackScheduled', 'wrongNumber', 'spam', 'lost',
      ],
      default: 'new',
    },
    scheduledAt:  { type: Date,   default: null },
    adminNotes:   { type: String, default: '' },   // kept for backward compatibility
    source:       { type: String, default: 'book-form' },
    referredFrom: { type: String, default: '' },
    ipAddress:    { type: String, default: '' },

    // ── Call notes log ─────────────────────────────────────
    // Each entry added when admin saves a note after a call.
    // Text + timestamp stored permanently — never overwritten.
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

    // ══════════════════════════════════════════════════════
    // SUB-AGENT FIELDS — all optional, all defaulted to null/[]
    // Every existing booking in MongoDB is completely unaffected.
    // null agentId = website lead (owned by owner, same as before).
    // ══════════════════════════════════════════════════════

    // Which agent entered this lead manually?
    // null  → came from covercredit.in website form
    // ObjectId → agent typed it in their dashboard
    agentId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
      index:   true,
    },

    // Denormalised leader ID — lets owner filter "all leads from Team A" in one query.
    teamLeaderId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
      index:   true,
    },

    // How did this lead arrive?
    // 'website'  → visitor booked via covercredit.in (default — same as before)
    // 'agent'    → agent entered manually in their dashboard
    // 'whatsapp' → agent entered from a WhatsApp conversation
    // 'referral' → referral
    // 'walkIn'   → met in person / offline
    leadSource: {
      type:    String,
      enum:    ['website', 'agent', 'whatsapp', 'referral', 'walkIn', 'other'],
      default: 'website',
    },

    // Append-only note log for the agent dashboard.
    // callNotes (above) = owner/admin notes from the existing system.
    // noteLog           = agent notes from the agent dashboard.
    // Both coexist — admin sees both in full booking detail.
    noteLog: {
      type: [
        {
          note:        { type: String, required: true, trim: true, maxlength: [2000, 'Note too long'] },
          addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          addedByName: { type: String, default: '' },
          addedAt:     { type: Date, default: Date.now },
          _id:         false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ department: 1 });
bookingSchema.index({ phone: 1 });
bookingSchema.index({ 'reminder.sent': 1, 'reminder.scheduledAt': 1 });
bookingSchema.index({ agentId: 1, createdAt: -1 });
bookingSchema.index({ teamLeaderId: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
