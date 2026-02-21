// ============================================================
// MODEL: Booking
// Stores data from the Book Consultation page form
// ============================================================

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
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
    topic: {
      type: String,
      required: [true, 'Topic is required'],
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
    preferredLanguage: {
      type: String,
      enum: ['Telugu', 'English', 'Telugu + English (mix)'],
      default: 'Telugu',
    },
    preferredTimeSlot: {
      type: String,
      enum: [
        'Morning (9 AM – 12 PM)',
        'Afternoon (12 PM – 3 PM)',
        'Evening (3 PM – 7 PM)',
        'Any time is fine',
      ],
      default: 'Any time is fine',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes too long'],
      default: '',
    },

    // Admin fields
    status: {
      type: String,
      enum: ['new', 'confirmed', 'completed', 'cancelled', 'no-show'],
      default: 'new',
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      default: 'book-form',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ phone: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
