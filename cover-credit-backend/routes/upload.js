// ============================================================
// ROUTE: /api/admin/upload  — PROTECTED
// Accepts image → uploads to Cloudinary → returns CDN URL
//
// Setup (one-time):
//   npm install multer cloudinary
//   Add to Render environment variables:
//     CLOUDINARY_CLOUD_NAME=your_cloud_name
//     CLOUDINARY_API_KEY=your_api_key
//     CLOUDINARY_API_SECRET=your_api_secret
//   Get free account: cloudinary.com
// ============================================================
const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const auth       = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/jpg','image/png','image/webp','image/gif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP and GIF images are allowed.'), false);
    }
  },
});

router.use(auth);

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No image file provided.' });

    if (!process.env.CLOUDINARY_CLOUD_NAME)
      return res.status(500).json({ success: false, message: 'Image upload not configured. Add CLOUDINARY_* env vars to Render.' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'cover-credit/blog', transformation: [{ width: 1200, height: 630, crop: 'fill', quality: 'auto', fetch_format: 'auto' }], resource_type: 'image' },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });

    res.json({ success: true, url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'Image too large. Max 5 MB.' });
  res.status(400).json({ success: false, message: err.message || 'Upload error.' });
});

module.exports = router;
