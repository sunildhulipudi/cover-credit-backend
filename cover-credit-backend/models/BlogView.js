// ============================================================
// MODEL: BlogView — tracks individual post views
// ============================================================
const mongoose = require('mongoose');

const blogViewSchema = new mongoose.Schema({
  postId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true, index: true },
  slug:     { type: String, required: true },
  source:   {
    type: String,
    enum: ['google', 'whatsapp', 'facebook', 'instagram', 'telegram', 'twitter', 'direct', 'other'],
    default: 'direct',
  },
  device:   { type: String, enum: ['mobile', 'desktop', 'tablet'], default: 'desktop' },
  referrer: { type: String, default: '' }, // raw referrer URL (trimmed to 300 chars)
}, { timestamps: true });

// ── Detect source from Referer header ──────────────────────
blogViewSchema.statics.detectSource = function(referer) {
  if (!referer) return 'direct';
  const r = referer.toLowerCase();
  if (r.includes('google.') || r.includes('bing.') || r.includes('yahoo.') || r.includes('duckduckgo.')) return 'google';
  if (r.includes('whatsapp') || r.includes('wa.me') || r.includes('wa.link')) return 'whatsapp';
  if (r.includes('facebook.') || r.includes('fb.com') || r.includes('fb.me')) return 'facebook';
  if (r.includes('instagram.')) return 'instagram';
  if (r.includes('t.me') || r.includes('telegram.')) return 'telegram';
  if (r.includes('twitter.') || r.includes('t.co') || r.includes('x.com')) return 'twitter';
  return 'other';
};

// ── Detect device from User-Agent header ──────────────────
blogViewSchema.statics.detectDevice = function(ua) {
  if (!ua) return 'desktop';
  const u = ua.toLowerCase();
  if (/(ipad|tablet|playbook|silk)/.test(u) || (u.includes('android') && !u.includes('mobile'))) return 'tablet';
  if (/(mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm)/.test(u)) return 'mobile';
  return 'desktop';
};

module.exports = mongoose.model('BlogView', blogViewSchema);
