// ============================================================
// MODEL: PageView — tracks all website page visits
// ============================================================
const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
  page:     { type: String, required: true },   // e.g. 'home', 'health-insurance', 'blog'
  path:     { type: String, default: '' },       // e.g. '/health-insurance.html'
  source:   {
    type: String,
    enum: ['google', 'whatsapp', 'facebook', 'instagram', 'telegram', 'twitter', 'direct', 'other'],
    default: 'direct',
  },
  device:   { type: String, enum: ['mobile', 'desktop', 'tablet'], default: 'desktop' },
  referrer: { type: String, default: '' },
}, { timestamps: true });

pageViewSchema.index({ page: 1 });
pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ source: 1 });

// ── Detect source from Referer ────────────────────────────
pageViewSchema.statics.detectSource = function(referer) {
  if (!referer) return 'direct';
  const r = referer.toLowerCase();
  if (r.includes('google.') || r.includes('bing.') || r.includes('yahoo.') || r.includes('duckduckgo.')) return 'google';
  if (r.includes('whatsapp') || r.includes('wa.me') || r.includes('wa.link')) return 'whatsapp';
  if (r.includes('facebook.') || r.includes('fb.com') || r.includes('fb.me') || r.includes('l.facebook')) return 'facebook';
  if (r.includes('instagram.')) return 'instagram';
  if (r.includes('t.me') || r.includes('telegram.')) return 'telegram';
  if (r.includes('twitter.') || r.includes('t.co') || r.includes('x.com')) return 'twitter';
  return 'other';
};

// ── Detect device from User-Agent ─────────────────────────
pageViewSchema.statics.detectDevice = function(ua) {
  if (!ua) return 'desktop';
  const u = ua.toLowerCase();
  if (/(ipad|tablet|playbook|silk)/.test(u) || (u.includes('android') && !u.includes('mobile'))) return 'tablet';
  if (/(mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm)/.test(u)) return 'mobile';
  return 'desktop';
};

module.exports = mongoose.model('PageView', pageViewSchema);
