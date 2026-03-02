// ============================================================
// MODEL: BlogPost
// ============================================================
const mongoose = require('mongoose');

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 100);
}

const blogPostSchema = new mongoose.Schema({
  title:      { type: String, required: [true,'Title required'], trim: true, maxlength: 200 },
  slug:       { type: String, unique: true, trim: true, lowercase: true },
  excerpt:    { type: String, required: [true,'Excerpt required'], trim: true, maxlength: 400 },
  content:    { type: String, required: [true,'Content required'] },
  coverImage: { type: String, default: '', trim: true },
  category: {
    type: String,
    enum: ['health','life','vehicle','loans','tips','news','guides'],
    required: [true,'Category required'],
  },
  tags:       { type: [String], default: [] },
  author:     { type: String, default: 'Cover Credit Team', trim: true, maxlength: 100 },
  status:     { type: String, enum: ['draft','published'], default: 'draft' },
  publishedAt:{ type: Date, default: null },
  expiresAt:  { type: Date, default: null },
  views:      { type: Number, default: 0, min: 0 },
}, { timestamps: true });

blogPostSchema.pre('save', async function(next) {
  if (!this.isModified('title') && this.slug) return next();
  let base = slugify(this.title), slug = base, c = 1;
  while (await mongoose.model('BlogPost').findOne({ slug, _id: { $ne: this._id } })) {
    slug = `${base}-${c++}`;
  }
  this.slug = slug;
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ slug: 1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);
