// ============================================================
// UTIL: Email Alerts via Brevo HTTP API
// Updated for new department-based booking form
// ============================================================

const https = require('https');

// ── Department display names & icons ─────────────────────
const DEPT_META = {
  loan:       { label: 'Loans & Finance',           icon: '🏠' },
  health:     { label: 'Health Insurance',           icon: '🏥' },
  life:       { label: 'Life Insurance',             icon: '❤️' },
  bike:       { label: 'Bike Insurance',             icon: '🏍️' },
  car:        { label: 'Car Insurance',              icon: '🚗' },
  commercial: { label: 'Commercial Vehicle Insurance', icon: '🚛' },
};

// ── Field labels for dept-specific details ────────────────
const DETAIL_LABELS = {
  // LOAN
  loanType:       'Loan Type',
  loanAmount:     'Loan Amount',
  employmentType: 'Employment Type',
  monthlyIncome:  'Monthly Income',
  existingLoans:  'Existing Loans',

  // HEALTH
  coverage:       'Coverage For',
  sumInsured:     'Sum Insured',
  existingPolicy: 'Existing Policy',
  preExisting:    'Pre-existing Conditions',

  // LIFE
  ageGroup:       'Age Group',
  smoker:         'Smoker',
  planType:       'Plan Type',
  coverageAmount: 'Coverage Amount',
  dependants:     'Dependants',

  // BIKE / CAR
  regNumber:      'Registration Number',
  makeModel:      'Make & Model',
  year:           'Year of Manufacture',
  currentInsurer: 'Current / Expiring Insurer',
  coverageType:   'Coverage Type',
  addOns:         'Add-ons Interested In',

  // COMMERCIAL
  vehicleType:       'Vehicle Type',
  numberOfVehicles:  'Number of Vehicles',
  goodsCarrierType:  'Goods Carrier Type',
};

// ── Raw Brevo HTTP request ────────────────────────────────
function brevoRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept':         'application/json',
        'api-key':        process.env.BREVO_API_KEY,
        'content-type':   'application/json',
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

// ── Build a table row ─────────────────────────────────────
function row(label, value, highlight = false) {
  const bg    = highlight ? '#fff8f0' : '#f8f6f1';
  const color = highlight ? '#c94f00' : '#1a3c5e';
  return `
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:${color};background:${bg};
                 border-bottom:1px solid #e5e0d8;width:38%;font-size:13px;">${label}</td>
      <td style="padding:10px 16px;color:#333;border-bottom:1px solid #e5e0d8;
                 font-size:13px;">${value || '—'}</td>
    </tr>`;
}

// ── Build dept-specific detail rows ──────────────────────
function buildDetailRows(details = {}) {
  return Object.entries(details)
    .filter(([, v]) => v && v !== '')
    .map(([key, value]) => {
      const label = DETAIL_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      return row(label, value);
    }).join('');
}

// ── Full HTML email for internal alert ───────────────────
function buildBookingAlertHTML(data) {
  const dept   = DEPT_META[data.department] || { label: data.department, icon: '📋' };
  const details = buildDetailRows(data.details || {});
  const ist    = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="620" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1a3c5e,#0f2440);padding:24px 32px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Cover<span style="color:#f5a623;">Credit</span></p>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.55);">Insurance Advisors — AP & Telangana</p>
      </td></tr>

      <!-- Department badge -->
      <tr><td style="background:#e8622a;padding:12px 32px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">
          📅 New Booking — ${dept.icon} ${dept.label}
        </p>
      </td></tr>

      <tr><td style="padding:24px 32px 8px;">

        <!-- Section: Contact details -->
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1.5px;">Contact Details</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${row('Full Name',       data.name,          true)}
          ${row('Phone Number',    data.phone,         true)}
          ${row('Email Address',   data.email || '—')}
          ${row('City / Location', data.city)}
        </table>

        <!-- Section: Department specifics -->
        ${details ? `
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1.5px;">${dept.label} — Specifics</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${details}
        </table>
        ` : ''}

        <!-- Section: Schedule -->
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1.5px;">Contact Preference</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${row('Contact Via',     data.contactMethod)}
          ${row('Best Time',       data.timeSlot)}
          ${row('Notes',           data.notes || 'None')}
        </table>

        ${data.referredFrom ? `
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1.5px;">Source</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${row('Referred From Page', data.referredFrom)}
        </table>
        ` : ''}

      </td></tr>

      <!-- Footer timestamp -->
      <tr><td style="padding:16px 32px 28px;">
        <p style="margin:0;font-size:12px;color:#aaa;">
          Received at <strong>${ist}</strong> IST &nbsp;·&nbsp;
          ID: ${data._id || '—'}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Contact form HTML (unchanged structure, labels updated) ─
function buildContactAlertHTML(data) {
  const rows = Object.entries(data)
    .filter(([key]) => !['_id', '__v', 'ipAddress', 'adminNotes', 'source'].includes(key))
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      return row(label, value);
    }).join('');

  const ist = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="620" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#1a3c5e,#0f2440);padding:24px 32px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Cover<span style="color:#f5a623;">Credit</span></p>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.55);">Insurance Advisors</p>
      </td></tr>
      <tr><td style="background:#e8622a;padding:12px 32px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">📩 New Contact Form Submission</p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;">
          ${rows}
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;">
        <p style="margin:0;font-size:12px;color:#aaa;">Received at ${ist} IST</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── User confirmation email ───────────────────────────────
function buildUserConfirmationHTML(name, department) {
  const dept   = DEPT_META[department] || { label: 'your query', icon: '📋' };
  const callUs = '+91 78428 54466';

  return `
  <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#1a3c5e,#0f2440);padding:24px 28px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">
        Cover<span style="color:#f5a623;">Credit</span>
      </p>
      <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">Insurance Advisors — AP & Telangana</p>
    </div>
    <div style="background:#fff;padding:28px 28px 24px;border-radius:0 0 12px 12px;
                border:1px solid #e5e0d8;border-top:3px solid #e8622a;">
      <p style="font-size:17px;color:#1a3c5e;margin:0 0 8px;">Hi ${name}, you're all set! ✅</p>
      <p style="color:#555;line-height:1.7;margin:0 0 16px;">
        We've received your consultation request for
        <strong>${dept.icon} ${dept.label}</strong>.
        Our specialist will call you at your preferred time — usually within 2 business hours.
      </p>
      <div style="background:#fff8f0;border-left:3px solid #e8622a;border-radius:0 8px 8px 0;
                  padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#c94f00;font-weight:700;">What to expect:</p>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:#555;line-height:1.8;">
          <li>A call from our team (Mon–Sat, 9 AM–7 PM)</li>
          <li>A clear, jargon-free comparison of options</li>
          <li>Zero pressure — you decide at your own pace</li>
        </ul>
      </div>
      <p style="color:#555;font-size:13px;margin:0 0 4px;">
        Need to reach us sooner? Call or WhatsApp:
        <a href="tel:${callUs.replace(/\s/g,'')}" style="color:#e8622a;font-weight:700;text-decoration:none;">
          ${callUs}
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin:20px 0 0;">— The Cover Credit Team</p>
    </div>
  </div>`;
}

// ── Public functions ──────────────────────────────────────

async function sendContactAlert(data) {
  if (!process.env.BREVO_API_KEY) return;
  try {
    await brevoRequest({
      sender:      { name: 'Cover Credit Leads', email: process.env.EMAIL_FROM || 'leads@covercredit.in' },
      to:          process.env.EMAIL_TO.split(',').map(e => ({ email: e.trim() })),
      subject:     `📩 New Lead: ${data.firstName} ${data.lastName} — ${data.interest}`,
      htmlContent: buildContactAlertHTML(data),
    });
  } catch (err) {
    console.error('Contact email error:', err.message);
  }
}

async function sendBookingAlert(data) {
  if (!process.env.BREVO_API_KEY) return;
  const dept  = DEPT_META[data.department] || { label: data.department, icon: '📋' };
  try {
    await brevoRequest({
      sender:      { name: 'Cover Credit Leads', email: process.env.EMAIL_FROM || 'leads@covercredit.in' },
      to:          process.env.EMAIL_TO.split(',').map(e => ({ email: e.trim() })),
      subject:     `📅 New Booking: ${data.name} — ${dept.icon} ${dept.label} — ${data.city}`,
      htmlContent: buildBookingAlertHTML(data),
    });
  } catch (err) {
    console.error('Booking email error:', err.message);
  }
}

async function sendUserConfirmation(toEmail, name, type, department) {
  if (!process.env.BREVO_API_KEY || !toEmail) return;

  const subject = type === 'booking'
    ? `Your consultation is booked — Cover Credit`
    : `We received your message — Cover Credit`;

  const htmlContent = type === 'booking'
    ? buildUserConfirmationHTML(name, department)
    : `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a3c5e,#0f2440);padding:24px 28px;border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Cover<span style="color:#f5a623;">Credit</span></p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e0d8;border-top:none;">
          <p style="font-size:16px;color:#1a3c5e;">Hi ${name},</p>
          <p style="color:#555;line-height:1.7;">We have received your message and will get back to you within 24 hours.</p>
          <p style="color:#555;">For immediate help call <strong style="color:#e8622a;">+91 78428 54466</strong></p>
          <p style="color:#555;">— The Cover Credit Team</p>
        </div>
      </div>`;

  try {
    await brevoRequest({
      sender:      { name: 'Cover Credit', email: process.env.EMAIL_FROM || 'leads@covercredit.in' },
      to:          [{ email: toEmail }],
      subject,
      htmlContent,
    });
  } catch (err) {
    console.error('Confirmation email error:', err.message);
  }
}

module.exports = { sendContactAlert, sendBookingAlert, sendUserConfirmation };
