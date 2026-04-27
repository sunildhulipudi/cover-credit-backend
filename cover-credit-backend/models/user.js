// ============================================================
// MODEL: User
// NEW FILE — agents and team leaders only.
// Owner/admin is NOT in this collection — they authenticate
// via ADMIN_EMAIL / ADMIN_PASSWORD env vars (completely unchanged).
// ============================================================
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({

  // ── Identity ──────────────────────────────────────────────
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  password: { type: String, required: true },

  // ── Role ──────────────────────────────────────────────────
  // 'leader' → sees own leads + their team's leads, can create agents
  // 'agent'  → sees only their own leads, can enter leads manually
  role: {
    type:    String,
    enum:    ['leader', 'agent'],
    default: 'agent',
  },

  // ── Team structure ────────────────────────────────────────
  // Which leader does this agent belong to?
  teamLeaderId: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'User',
    default: null,
    index:   true,
  },

  // ── Agent identity ────────────────────────────────────────
  agentCode: {        // e.g. CC-AG-001 — auto-generated
    type:   String,
    unique: true,
    sparse: true,
  },
  city:   { type: String, trim: true, default: '' },
  region: { type: String, trim: true, default: '' },

  // Services this agent is authorised to sell
  services: {
    type:    [String],
    default: ['health', 'life', 'vehicle', 'loans'],
  },

  // ── Status ────────────────────────────────────────────────
  active:      { type: Boolean, default: true },
  mustResetPw: { type: Boolean, default: true },
  lastLoginAt: { type: Date,    default: null },

  // ── Meta ──────────────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ active: 1 });

// ── Hash password before save ─────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare password ──────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Safe public object (no password) ─────────────────────
userSchema.methods.toPublic = function () {
  return {
    _id:          this._id,
    name:         this.name,
    email:        this.email,
    phone:        this.phone,
    role:         this.role,
    agentCode:    this.agentCode,
    city:         this.city,
    region:       this.region,
    services:     this.services,
    active:       this.active,
    mustResetPw:  this.mustResetPw,
    lastLoginAt:  this.lastLoginAt,
    teamLeaderId: this.teamLeaderId,
    createdAt:    this.createdAt,
  };
};

// ── Generate next agent code ──────────────────────────────
userSchema.statics.nextAgentCode = async function () {
  const last = await this.findOne({ agentCode: { $exists: true, $ne: null } })
    .sort({ createdAt: -1 }).select('agentCode').lean();
  if (!last?.agentCode) return 'CC-AG-001';
  const num = parseInt(last.agentCode.replace('CC-AG-', ''), 10);
  return `CC-AG-${String(num + 1).padStart(3, '0')}`;
};

module.exports = mongoose.model('User', userSchema);
