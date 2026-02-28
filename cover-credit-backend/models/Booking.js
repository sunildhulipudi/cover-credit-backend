// ============================================================
// MODEL: Booking
// ============================================================

const mongoose = require('mongoose');

// Each call note has text + permanent timestamp
const callNoteSchema = new mongoose.Schema({
  text:    { type: String, required: true, trim: true, maxlength: [2000, 'Note too long'] },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

// One active reminder per booking
const reminderSchema = new mongoose.Schema({
  scheduledAt: { type: Date, required: true },
  note:        { type: String, default: '', trim: true, maxlength: [500, 'Too long'] },
  sent:        { type: Boolean, default: false },
  sentAt:      { type: Date, default: null },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: [100, 'Name too long'] },
  phone: { type: String, required: true, trim: true, match: [/^[+\d][\d\s\-]{7,15}$/, 'Invalid phone'] },
  email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'], default: '' },
  topic: {
    type: String, required: true,
    enum: [
      'Health Insurance — New / Renewal / Review',
      'Life / Term Insurance',
      'Bike Insurance',
      'Car Insurance',
      'Commercial Vehicle Insurance',
      'Loan Guidance',
      'Claim Assistance',
      'Not sure — need general advice',
    ],
  },
  preferredLanguage:  { type: String, enum: ['Telugu','English','Telugu + English (mix)'], default: 'Telugu' },
  preferredTimeSlot:  { type: String, enum: ['Morning (9 AM – 12 PM)','Afternoon (12 PM – 3 PM)','Evening (3 PM – 7 PM)','Any time is fine'], default: 'Any time is fine' },
  notes:              { type: String, trim: true, maxlength: [1000, 'Notes too long'], default: '' },

  // Admin fields
  status:      { type: String, enum: ['new','confirmed','completed','cancelled','no-show'], default: 'new' },
  scheduledAt: { type: Date, default: null },

  // Timestamped call notes log
  adminNotes:  { type: [callNoteSchema], default: [] },

  // Reminder
  reminder:    { type: reminderSchema, default: null },

  source:     { type: String, default: 'book-form' },
  ipAddress:  { type: String, default: '' },
}, { timestamps: true });

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ phone: 1 });
bookingSchema.index({ 'reminder.sent': 1, 'reminder.scheduledAt': 1 });

module.exports = mongoose.model('Booking', bookingSchema);
