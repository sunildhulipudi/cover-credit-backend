// ============================================================
// UTIL: Email Alerts via Brevo HTTP API (works on Render free tier)
// ============================================================

const https = require('https');

function brevoRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('📧  Email sent via Brevo API');
          resolve(data);
        } else {
          console.error('Brevo API error:', res.statusCode, data);
          reject(new Error(data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── HTML email template ───────────────────────────────────
function buildEmailHTML(type, data) {
  const isBooking = type === 'booking';
  const color = '#e8622a';
  const title = isBooking ? '📅 New Consultation Booking' : '📩 New Contact Form Submission';

  const rows = Object.entries(data)
    .filter(([key]) => !['_id', '__v', 'ipAddress', 'adminNotes', 'source'].includes(key))
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      return `
        <tr>
          <td style="padding:10px 16px;font-weight:600;color:#1a3c5e;background:#f8f6f1;border-bottom:1px solid #e5e0d8;width:38%;font-size:13px;">${label}</td>
          <td style="padding:10px 16px;color:#333;border-bottom:1px solid #e5e0d8;font-size:13px;">${value || '—'}</td>
        </tr>`;
    }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:30px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1a3c5e,#0f2440);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">CoverCredit</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Insurance Advisors</p>
        </td></tr>
        <tr><td style="background:${color};padding:14px 32px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">${title}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;">
            ${rows}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#999;">Received at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Send contact alert ────────────────────────────────────
async function sendContactAlert(data) {
  if (!process.env.BREVO_API_KEY) return;
  try {
    await brevoRequest({
      sender: { name: 'Cover Credit Leads', email: process.env.EMAIL_FROM || 'leads@covercredit.in' },
      to: process.env.EMAIL_TO.split(',').map(e => ({ email: e.trim() })),
      subject: `📩 New Lead: ${data.firstName} ${data.lastName} — ${data.interest}`,
      htmlContent: buildEmailHTML('contact', data),
    });
  } catch (err) {
    console.error('Contact email error:', err.message);
  }
}

// ── Send booking alert ────────────────────────────────────
async function sendBookingAlert(data) {
  if (!process.env.BREVO_API_KEY) return;
  try {
    await brevoRequest({
      sender: { name: 'Cover Credit Leads', email: process.env.EMAIL_FROM || 'leads@covercredit.in' },
      to: process.env.EMAIL_TO.split(',').map(e => ({ email: e.trim() })),
      subject: `📅 New Booking: ${data.name} — ${data.topic}`,
      htmlContent: buildEmailHTML('booking', data),
    });
  } catch (err) {
    console.error('Booking email error:', err.message);
  }
}

// ── Send confirmation to user ─────────────────────────────
async function sendUserConfirmation(toEmail, name, type) {
  if (!process.env.BREVO_API_KEY || !toEmail) return;
  const subject = type === 'booking'
    ? 'Your consultation is booked — Cover Credit'
    : 'We received your message — Cover Credit';
  const bodyLine = type === 'booking'
    ? 'We have received your consultation request and will call you shortly to confirm your time slot.'
    : 'We have received your message and will get back to you within 24 hours.';
  try {
    await brevoRequest({
      sender: { name: 'Cover Credit', email: process.env.EMAIL_FROM || 'leads@covercredit.in' },
      to: [{ email: toEmail }],
      subject,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a3c5e,#0f2440);padding:24px 28px;border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">CoverCredit</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e0d8;border-top:none;">
          <p style="font-size:16px;color:#1a3c5e;">Hi ${name},</p>
          <p style="color:#555;line-height:1.7;">${bodyLine}</p>
          <p style="color:#555;">For immediate help call <strong style="color:#e8622a;">+91 96428 34789</strong></p>
          <p style="color:#555;">— The Cover Credit Team</p>
        </div>
      </div>`,
    });
  } catch (err) {
    console.error('Confirmation email error:', err.message);
  }
}




// ── Send reminder email to admin ──────────────────────────
// type = 'set' (confirmation when set) | 'due' (fired when due)
async function sendReminderEmail(booking, type = 'due') {
  if (!process.env.BREVO_API_KEY) return;

  const ist = (d) => new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isDue   = type === 'due';
  const subject = isDue
    ? `⏰ REMINDER DUE: Call ${booking.name} — ${booking.topic}`
    : `✅ Reminder Set: ${booking.name} — ${ist(booking.reminder.scheduledAt)} IST`;

  const headerColor = isDue ? '#c94f1a' : '#1a6e35';
  const headerLabel = isDue ? '⏰ Reminder Due — Call Now' : '✅ Reminder Scheduled';

  const noteHtml = booking.reminder?.note
    ? `<tr><td style="padding:10px 16px;font-weight:600;color:#1a3c5e;background:#f8f6f1;border-bottom:1px solid #e5e0d8;width:38%;font-size:13px;">Your Note</td>
       <td style="padding:10px 16px;color:#333;border-bottom:1px solid #e5e0d8;font-size:13px;">${booking.reminder.note}</td></tr>`
    : '';

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:30px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1a3c5e,#0f2440);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">CoverCredit</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Admin Reminder System</p>
        </td></tr>
        <tr><td style="background:${headerColor};padding:14px 32px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">${headerLabel}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:10px 16px;font-weight:600;color:#1a3c5e;background:#f8f6f1;border-bottom:1px solid #e5e0d8;width:38%;font-size:13px;">Customer</td>
              <td style="padding:10px 16px;color:#333;border-bottom:1px solid #e5e0d8;font-size:13px;font-weight:700;">${booking.name}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:600;color:#1a3c5e;background:#f8f6f1;border-bottom:1px solid #e5e0d8;font-size:13px;">Phone</td>
              <td style="padding:10px 16px;border-bottom:1px solid #e5e0d8;font-size:13px;"><a href="tel:${booking.phone}" style="color:#e8622a;font-weight:700;">${booking.phone}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:600;color:#1a3c5e;background:#f8f6f1;border-bottom:1px solid #e5e0d8;font-size:13px;">Topic</td>
              <td style="padding:10px 16px;color:#333;border-bottom:1px solid #e5e0d8;font-size:13px;">${booking.topic}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:600;color:#1a3c5e;background:#f8f6f1;border-bottom:1px solid #e5e0d8;font-size:13px;">Reminder Time</td>
              <td style="padding:10px 16px;color:#333;border-bottom:1px solid #e5e0d8;font-size:13px;font-weight:700;">${ist(booking.reminder?.scheduledAt)}</td>
            </tr>
            ${noteHtml}
          </table>
        </td></tr>
        ${isDue ? `
        <tr><td style="padding:16px 32px 8px;">
          <a href="tel:${booking.phone}" style="display:inline-block;background:#e8622a;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">📞 Call ${booking.name} Now</a>
        </td></tr>` : ''}
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#999;">Generated at ${ist(new Date())} IST</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    await brevoRequest({
      sender: { name: 'Cover Credit Admin', email: process.env.EMAIL_FROM || 'leads@covercredit.in' },
      to: process.env.EMAIL_TO.split(',').map(e => ({ email: e.trim() })),
      subject,
      htmlContent,
    });
    console.log(`📧  Reminder email sent (${type}) for booking: ${booking.name}`);
  } catch (err) {
    console.error('Reminder email error:', err.message);
  }
}

module.exports = { sendContactAlert, sendBookingAlert, sendUserConfirmation, sendReminderEmail };
