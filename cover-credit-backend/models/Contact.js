// ============================================================
// MODEL: Contact
// Stores data from the Contact page form
// ============================================================

const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'Name too long'],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Name too long'],
      default: '',
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
    interest: {
      type: String,
      enum: [
        'Health Insurance',
        'Life Insurance',
        'Bike Insurance',
        'Car Insurance',
        'Commercial Vehicle Insurance',
        'Loans',
        'Claim Support',
        'Other',
      ],
      default: 'Other',
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, 'Message too long'],
      default: '',
    },

    // Meta
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'closed'],
      default: 'new',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      default: 'contact-form',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,   // adds createdAt & updatedAt automatically
  }
);

// Index for fast admin queries
contactSchema.index({ createdAt: -1 });
contactSchema.index({ status: 1 });
contactSchema.index({ phone: 1 });

module.exports = mongoose.model('Contact', contactSchema);
