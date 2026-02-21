// ============================================================
// MIDDLEWARE: JWT Authentication (protects /api/admin routes)
// ============================================================

const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  // Accept token from Authorization header OR cookie
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Please log in.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.',
    });
  }
};
