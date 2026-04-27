// ============================================================
// MODEL: User
// Sub-agent system — agents and team leaders only
// Owner login stays env-var based (ADMIN_EMAIL / ADMIN_PASSWORD)
// This model is ONLY for agents/leaders created by the owner
// ============================================================
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    password: { type: String, required: true },

    // 'leader' → sees own leads + their team's leads, can create agents
    // 'agent'  → sees only their own leads
    role: {
      type:    String,
      enum:    ['leader', 'agent'],
      default: 'agent',
    },

    // agents assigned to a leader store that leader's _id here
    teamLeaderId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
      index:   true,
    },

    // Short code e.g. "CC-AG-001" — auto-generated on creation
    agentCode: {
      type:   String,
      unique: true,
      sparse: true,
    },

    city:    { type: String, trim: true, default: '' },
    region:  { type: String, trim: true, default: '' },
    services: {
      type:    [String],
      default: ['health', 'life', 'vehicle', 'loans'],
    },

    active:      { type: Boolean, default: true },
    mustResetPw: { type: Boolean, default: true },
    lastLoginAt: { type: Date,    default: null },
    createdBy:   { type: String,  default: 'owner' },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ active: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

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

// Auto-generate next agent code: CC-AG-001, CC-AG-002 ...
userSchema.statics.nextAgentCode = async function () {
  const last = await this.findOne({ agentCode: { $exists: true, $ne: null } })
    .sort({ createdAt: -1 }).select('agentCode').lean();
  if (!last?.agentCode) return 'CC-AG-001';
  const num = parseInt(last.agentCode.replace('CC-AG-', ''), 10);
  return `CC-AG-${String(num + 1).padStart(3, '0')}`;
};

module.exports = mongoose.model('User', userSchema);
