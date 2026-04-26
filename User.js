const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // ── Identity ──────────────────────────────────────────────
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:        { type: String, trim: true },
  password:     { type: String, required: true },

  // ── Role ──────────────────────────────────────────────────
  // owner  → full access, sees everything
  // leader → sees own leads + their team's leads, can create agents
  // agent  → sees own leads only, can enter leads
  role: {
    type:    String,
    enum:    ['owner', 'leader', 'agent'],
    default: 'agent',
  },

  // ── Team structure ────────────────────────────────────────
  // agents and leaders belong to a parent user (owner or leader)
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    default: null,
  },

  // agents assigned directly to a leader
  teamLeaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    default: null,
  },

  // ── Agent identity ────────────────────────────────────────
  // Short unique code shown in the agent dashboard
  // e.g. "CC-AG-001" — generated on create
  agentCode: {
    type:   String,
    unique: true,
    sparse: true,
  },

  // City / region the agent operates in
  city:   { type: String, trim: true },
  region: { type: String, trim: true },

  // Services the agent is authorised to sell
  services: {
    type:    [String],
    default: ['health', 'life', 'vehicle', 'loans'],
  },

  // ── Status ────────────────────────────────────────────────
  active:        { type: Boolean, default: true },
  mustResetPw:   { type: Boolean, default: true },   // force pw change on first login
  lastLoginAt:   { type: Date },
  lastLoginIp:   { type: String },

  // ── Meta ──────────────────────────────────────────────────
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ── Indexes ───────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ teamLeaderId: 1 });
userSchema.index({ parentId: 1 });
userSchema.index({ active: 1 });

// ── Pre-save: hash password ───────────────────────────────
userSchema.pre('save', async function (next) {
  this.updatedAt = new Date();
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance: compare password ────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Instance: safe public view (no password) ─────────────
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
    parentId:     this.parentId,
    createdAt:    this.createdAt,
  };
};

// ── Static: generate next agent code ─────────────────────
userSchema.statics.nextAgentCode = async function () {
  const last = await this.findOne({ agentCode: { $exists: true } })
    .sort({ createdAt: -1 })
    .select('agentCode');
  if (!last || !last.agentCode) return 'CC-AG-001';
  const num = parseInt(last.agentCode.replace('CC-AG-', ''), 10);
  return `CC-AG-${String(num + 1).padStart(3, '0')}`;
};

module.exports = mongoose.model('User', userSchema);
