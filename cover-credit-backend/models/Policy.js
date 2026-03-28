// ============================================================
// MODEL: Policy — stores client insurance policy details
// ============================================================
const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  // Client details
  clientName:    { type: String, required: true, trim: true },
  phone:         { type: String, required: true, trim: true },
  email:         { type: String, trim: true, default: '' },

  // Policy identity
  policyNumber:  { type: String, required: true, trim: true, unique: true, uppercase: true },
  vehicleNumber: { type: String, trim: true, uppercase: true, default: '' }, // optional

  // Policy details
  type: {
    type: String,
    enum: ['health', 'life', 'vehicle-bike', 'vehicle-car', 'vehicle-commercial', 'travel', 'home'],
    required: true,
  },
  insurerName:   { type: String, required: true, trim: true },
  coverAmount:   { type: Number, required: true, min: 0 },  // in rupees
  premium:       { type: Number, required: true, min: 0 },  // annual premium in rupees

  // Dates
  startDate:     { type: Date, required: true },
  expiresAt:     { type: Date, required: true },

  // NCB — only relevant for vehicle insurance
  ncb:           { type: Number, default: 0, min: 0, max: 50 }, // percentage: 0,20,25,35,45,50

  // Status
  status:        { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },

  // Internal notes
  notes:         { type: String, default: '' },
}, { timestamps: true });

// Auto-update status based on expiry
policySchema.pre('save', function(next) {
  if (this.expiresAt && new Date(this.expiresAt) < new Date()) {
    this.status = 'expired';
  }
  next();
});

// Indexes
policySchema.index({ policyNumber: 1 });
policySchema.index({ phone: 1 });
policySchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Policy', policySchema);
