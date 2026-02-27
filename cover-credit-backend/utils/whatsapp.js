// ============================================================
// UTIL: WhatsApp Notifications via CallMeBot (free)
// Updated for new department-based booking form
//
// Setup (one-time):
//   1. Save +34 644 59 72 87 as "CallMeBot" in WhatsApp
//   2. Send: I allow callmebot to send me messages
//   3. You'll receive your API key via WhatsApp
//   4. Add CALLMEBOT_APIKEY and WHATSAPP_TO to .env
// ============================================================

const https = require('https');

const DEPT_LABELS = {
  loan:       '🏠 Loans & Finance',
  health:     '🏥 Health Insurance',
  life:       '❤️ Life Insurance',
  bike:       '🏍️ Bike Insurance',
  car:        '🚗 Car Insurance',
  commercial: '🚛 Commercial Vehicle',
};

async function sendWhatsApp(message) {
  const phone  = process.env.WHATSAPP_TO;
  const apiKey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apiKey) {
    console.warn('⚠️  WhatsApp not configured (WHATSAPP_TO or CALLMEBOT_APIKEY missing)');
    return;
  }

  const encoded = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('📱  WhatsApp notification sent');
        } else {
          console.warn('⚠️  WhatsApp response:', res.statusCode, body);
        }
        resolve();
      });
    }).on('error', (err) => {
      console.error('WhatsApp error:', err.message);
      resolve();
    });
  });
}

// ── Build dept-specific detail lines ─────────────────────
function buildDetailLines(department, details = {}) {
  if (!details || Object.keys(details).length === 0) return '';

  const fieldMap = {
    // LOAN
    loanType:         '💼 Loan Type',
    loanAmount:       '💰 Loan Amount',
    employmentType:   '👔 Employment',
    monthlyIncome:    '📈 Monthly Income',
    existingLoans:    '🔗 Existing Loans',
    // HEALTH
    coverage:         '👨‍👩‍👧 Coverage For',
    sumInsured:       '🛡️ Sum Insured',
    existingPolicy:   '📄 Existing Policy',
    preExisting:      '🏥 Pre-existing',
    // LIFE
    ageGroup:         '🎂 Age Group',
    smoker:           '🚬 Smoker',
    planType:         '📋 Plan Type',
    coverageAmount:   '🛡️ Coverage Amount',
    dependants:       '👨‍👩‍👧 Dependants',
    // BIKE / CAR
    regNumber:        '🚘 Reg. Number',
    makeModel:        '🏷️ Make & Model',
    year:             '📅 Year',
    currentInsurer:   '📄 Current Insurer',
    coverageType:     '🛡️ Coverage Type',
    addOns:           '➕ Add-ons',
    // COMMERCIAL
    vehicleType:      '🚛 Vehicle Type',
    numberOfVehicles: '🔢 No. of Vehicles',
    goodsCarrierType: '📦 Goods Type',
  };

  return Object.entries(details)
    .filter(([, v]) => v && v !== '')
    .map(([key, value]) => `${fieldMap[key] || key}: ${value}`)
    .join('\n');
}

// ── Formatted booking WhatsApp message ───────────────────
function bookingWhatsAppMessage(data) {
  const dept        = DEPT_LABELS[data.department] || data.department || '—';
  const detailLines = buildDetailLines(data.department, data.details);
  const ist         = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const lines = [
    '📅 *New Booking — Cover Credit*',
    '─────────────────────────',
    `${dept}`,
    '─────────────────────────',
    `👤 *Name:* ${data.name}`,
    `📞 *Phone:* ${data.phone}`,
    `✉️ *Email:* ${data.email || 'Not provided'}`,
    `📍 *City:* ${data.city || '—'}`,
  ];

  if (detailLines) {
    lines.push('─────────────────────────');
    lines.push(detailLines);
  }

  lines.push('─────────────────────────');
  lines.push(`📲 *Contact Via:* ${data.contactMethod || 'Phone Call'}`);
  lines.push(`🕐 *Best Time:* ${data.timeSlot || '—'}`);

  if (data.notes) {
    lines.push(`📝 *Notes:* ${data.notes}`);
  }

  lines.push('─────────────────────────');
  lines.push(`⏰ ${ist} IST`);

  return lines.join('\n');
}

// ── Formatted contact WhatsApp message ───────────────────
function contactWhatsAppMessage(data) {
  return [
    '🔔 *New Contact Lead — Cover Credit*',
    '─────────────────────────',
    `👤 *Name:* ${data.firstName} ${data.lastName}`,
    `📞 *Phone:* ${data.phone}`,
    `✉️ *Email:* ${data.email || 'Not provided'}`,
    `📋 *Interest:* ${data.interest}`,
    `💬 *Message:* ${data.message || 'None'}`,
    '─────────────────────────',
    `🕐 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
  ].join('\n');
}

async function notifyNewContact(data) {
  await sendWhatsApp(contactWhatsAppMessage(data));
}

async function notifyNewBooking(data) {
  await sendWhatsApp(bookingWhatsAppMessage(data));
}

module.exports = { notifyNewContact, notifyNewBooking };
