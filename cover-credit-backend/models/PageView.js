// ============================================================
// MODEL: PageView — tracks all website page visits
// ============================================================
const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
  page:        { type: String, required: true },
  path:        { type: String, default: '' },
  source:      {
    type: String,
    enum: ['google','whatsapp','facebook','instagram','linkedin','telegram','twitter','youtube','direct','other'],
    default: 'direct',
  },
  device:      { type: String, enum: ['mobile','desktop','tablet'], default: 'desktop' },
  utmMedium:   { type: String, default: '' },
  utmCampaign: { type: String, default: '' },
  referrer:    { type: String, default: '' },
}, { timestamps: true });

pageViewSchema.index({ page: 1 });
pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ source: 1 });

// Fallback detection from referer (used only when no UTM)
pageViewSchema.statics.detectSource = function (referer) {
  if (!referer) return 'direct';
  const r = referer.toLowerCase();
  if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(r)) return 'google';
  if (/whatsapp|wa\.me|wa\.link/.test(r))             return 'whatsapp';
  if (/facebook\.|fb\.com|fb\.me|l\.facebook/.test(r))return 'facebook';
  if (/instagram\./.test(r))                          return 'instagram';
  if (/linkedin\./.test(r))                           return 'linkedin';
  if (/t\.me|telegram\./.test(r))                     return 'telegram';
  if (/twitter\.|t\.co|x\.com/.test(r))               return 'twitter';
  if (/youtube\.|youtu\.be/.test(r))                  return 'youtube';
  return 'other';
};

pageViewSchema.statics.detectDevice = function (ua) {
  if (!ua) return 'desktop';
  const u = ua.toLowerCase();
  if (/(ipad|tablet|playbook|silk)/.test(u) || (u.includes('android') && !u.includes('mobile'))) return 'tablet';
  if (/(mobile|iphone|ipod|android|blackberry|windows phone)/.test(u)) return 'mobile';
  return 'desktop';
};

module.exports = mongoose.model('PageView', pageViewSchema);
