// ============================================================
// UTIL: WhatsApp Notifications via CallMeBot (COMPLETELY FREE)
//
// Setup (one-time, takes 2 minutes):
//   1. Save +34 644 59 72 87 in your phone as "CallMeBot"
//   2. Send this WhatsApp message to that number:
//      I allow callmebot to send me messages
//   3. You'll receive your API key via WhatsApp
//   4. Add CALLMEBOT_APIKEY and WHATSAPP_TO to your .env
// ============================================================

const https = require('https');

/**
 * Send a WhatsApp message via CallMeBot (free)
 * @param {string} message - plain text message
 */
async function sendWhatsApp(message) {
  const phone  = process.env.WHATSAPP_TO;       // your number e.g. 919642834789
  const apiKey = process.env.CALLMEBOT_APIKEY;  // key from CallMeBot

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
      resolve(); // don't crash the app if WA fails
    });
  });
}

// ── Formatted message builders ────────────────────────────

function contactWhatsAppMessage(data) {
  return [
    '🔔 *New Contact Lead — Cover Credit*',
    '─────────────────────',
    `👤 *Name:* ${data.firstName} ${data.lastName}`,
    `📞 *Phone:* ${data.phone}`,
    `✉️ *Email:* ${data.email || 'Not provided'}`,
    `📋 *Interest:* ${data.interest}`,
    `💬 *Message:* ${data.message || 'None'}`,
    '─────────────────────',
    `🕐 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
  ].join('\n');
}

function bookingWhatsAppMessage(data) {
  return [
    '📅 *New Booking — Cover Credit*',
    '─────────────────────',
    `👤 *Name:* ${data.name}`,
    `📞 *Phone:* ${data.phone}`,
    `✉️ *Email:* ${data.email || 'Not provided'}`,
    `📋 *Topic:* ${data.topic}`,
    `🗣️ *Language:* ${data.preferredLanguage}`,
    `🕐 *Time Slot:* ${data.preferredTimeSlot}`,
    `📝 *Notes:* ${data.notes || 'None'}`,
    '─────────────────────',
    `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
  ].join('\n');
}

async function notifyNewContact(data) {
  await sendWhatsApp(contactWhatsAppMessage(data));
}

async function notifyNewBooking(data) {
  await sendWhatsApp(bookingWhatsAppMessage(data));
}

module.exports = { notifyNewContact, notifyNewBooking };
