// ============================================================
// UTIL: Email Alerts via Gmail SMTP (FREE)
// ============================================================

const nodemailer = require('nodemailer');

// Create reusable transporter using Brevo SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_LOGIN,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

// ── Verify connection on startup ──────────────────────────
transporter.verify((err) => {
  if (err) {
    console.warn('⚠️  Email service not configured:', err.message);
  } else {
    console.log('📧  Email service ready');
  }
});

// ── HTML email template ───────────────────────────────────
function buildEmailHTML(type, data) {
  const isBooking = type === 'booking';
  const color     = '#e8622a';
  const title     = isBooking ? '📅 New Consultation Booking' : '📩 New Contact Form Submission';

  const rows = Object.entries(data)
    .filter(([key]) => !['_id', '__v', 'ipAddress', 'adminNotes', 'source'].includes(key))
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase());
      return `
        <tr>
          <td style="padding:10px 16px;font-weight:600;color:#1a3c5e;
                     background:#f8f6f1;border-bottom:1px solid #e5e0d8;
                     width:38%;font-size:13px;">${label}</td>
          <td style="padding:10px 16px;color:#333;border-bottom:1px solid #e5e0d8;
                     font-size:13px;">${value || '—'}</td>
        </tr>`;
    }).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:30px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a3c5e,#0f2440);
                     padding:28px 32px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;
                      font-family:Georgia,serif;">CoverCredit</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">
              Insurance Advisors for AP &amp; Telangana</p>
          </td>
        </tr>

        <!-- Title bar -->
        <tr>
          <td style="background:${color};padding:14px 32px;">
            <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">${title}</p>
          </td>
        </tr>

        <!-- Data table -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;">
              ${rows}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:20px 32px 32px;">
            <a href="mailto:${data.email || ''}"
               style="display:inline-block;background:${color};color:#fff;
                      padding:12px 24px;border-radius:6px;font-weight:600;
                      font-size:14px;text-decoration:none;">
              Reply to Lead →
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:#999;">
              Received at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send new contact alert ────────────────────────────────
async function sendContactAlert(data) {
  if (!process.env.EMAIL_USER) return;
  try {
    // EMAIL_TO supports multiple emails separated by comma
    // e.g. EMAIL_TO=one@gmail.com,two@gmail.com,three@gmail.com
    const recipients = process.env.EMAIL_TO;
    await transporter.sendMail({
      from:    `"Cover Credit Leads" <${process.env.EMAIL_USER}>`,
      to:      recipients,
      subject: `📩 New Lead: ${data.firstName} ${data.lastName} — ${data.interest}`,
      html:    buildEmailHTML('contact', data),
    });
    console.log('📧  Contact alert email sent to:', recipients);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

// ── Send new booking alert ────────────────────────────────
async function sendBookingAlert(data) {
  if (!process.env.EMAIL_USER) return;
  try {
    // EMAIL_TO supports multiple emails separated by comma
    const recipients = process.env.EMAIL_TO;
    await transporter.sendMail({
      from:    `"Cover Credit Leads" <${process.env.EMAIL_USER}>`,
      to:      recipients,
      subject: `📅 New Booking: ${data.name} — ${data.topic}`,
      html:    buildEmailHTML('booking', data),
    });
    console.log('📧  Booking alert email sent to:', recipients);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

// ── Send confirmation to the user ────────────────────────
async function sendUserConfirmation(toEmail, name, type) {
  if (!process.env.EMAIL_USER || !toEmail) return;
  const subject = type === 'booking'
    ? `Your consultation is booked — Cover Credit`
    : `We received your message — Cover Credit`;
  const bodyLine = type === 'booking'
    ? `We've received your consultation request and will call you shortly to confirm your time slot.`
    : `We've received your message and will get back to you within 24 hours.`;

  try {
    await transporter.sendMail({
      from:    `"Cover Credit" <${process.env.EMAIL_USER}>`,
      to:      toEmail,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#1a3c5e,#0f2440);
                      padding:24px 28px;border-radius:12px 12px 0 0;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#fff;
                      font-family:Georgia,serif;">CoverCredit</p>
          </div>
          <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;
                      border:1px solid #e5e0d8;border-top:none;">
            <p style="font-size:16px;color:#1a3c5e;">Hi ${name},</p>
            <p style="color:#555;line-height:1.7;">${bodyLine}</p>
            <p style="color:#555;line-height:1.7;">
              If you need immediate help, call us at
              <strong style="color:#e8622a;">+91 96428 34789</strong>
            </p>
            <p style="color:#555;">— The Cover Credit Team</p>
          </div>
        </div>`,
    });
    console.log('📧  Confirmation email sent to user');
  } catch (err) {
    console.error('Confirmation email error:', err.message);
  }
}

module.exports = { sendContactAlert, sendBookingAlert, sendUserConfirmation };
