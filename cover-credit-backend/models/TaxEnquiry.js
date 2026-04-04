// ============================================================
// MODEL: TaxEnquiry
// Stores submissions from the tax-services.html popup
// Separate from Booking (book.html) and Contact (contact form)
// ============================================================

const mongoose = require('mongoose');

const taxEnquirySchema = new mongoose.Schema(
  {
    // ── Client details ─────────────────────────────────────
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
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      required: [true, 'City is required'],
    },

    // ── Tax-specific fields ────────────────────────────────
    service: {
      type: String,
      trim: true,
      required: [true, 'Service is required'],
      // e.g. ITR Filing, GST Returns, GST Registration,
      // Company Registration, Firm Registration, Annual Filings, Tax Audit
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes too long'],
      default: '',
    },

    // ── Admin workflow status ──────────────────────────────
    // Extended statuses specific to tax compliance work
    status: {
      type: String,
      enum: [
        'new',            // Just submitted — needs first contact
        'contacted',      // Called / WhatsApp'd — awaiting docs
        'docs-received',  // Documents received from client
        'in-progress',    // Filing / registration in progress
        'query',          // Waiting for clarification from client
        'quote-sent',     // Quote sent to client
        'payment-pending',// Payment awaited
        'payment-done',   // Payment received — work in progress
        'filed',          // Filed / submitted to govt portal
        'completed',      // Fully completed — acknowledgement sent
        'cancelled',      // Client cancelled
        'no-response',    // Client not responding
      ],
      default: 'new',
    },

    // ── Internal admin fields ──────────────────────────────
    // Single latest admin note (shown in table)
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },

    // Timestamped note log (like callNotes in Booking)
    noteLog: {
      type: [{
        text:     { type: String, required: true },
        addedAt:  { type: Date, default: Date.now },
      }],
      default: [],
    },
    assignedTo: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      default: 'tax-services-popup',
    },
    page: {
      type: String,
      default: '/tax-services',
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

taxEnquirySchema.index({ createdAt: -1 });
taxEnquirySchema.index({ status: 1 });
taxEnquirySchema.index({ city: 1 });
taxEnquirySchema.index({ service: 1 });
taxEnquirySchema.index({ phone: 1 });

module.exports = mongoose.model('TaxEnquiry', taxEnquirySchema);
