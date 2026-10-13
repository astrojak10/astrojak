// Creates a fixed Rs 101 Razorpay Payment Link and returns its URL.
// Keys live ONLY in Netlify environment variables: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
const AMOUNT_PAISE = 10100; // Rs 101, fixed here so visitors cannot change it

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST' });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
    return reply(500, { error: 'Payment is not configured' });
  }

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) {}

  const site = (process.env.URL || 'https://astrojak.netlify.app').replace(/\/$/, '');
  const payload = {
    amount: AMOUNT_PAISE,
    currency: 'INR',
    accept_partial: false,
    reference_id: 'rsv' + Date.now() + Math.random().toString(36).slice(2, 6),
    description: 'Reserve your slot with Acharya Narender Ji (includes detailed horoscope PDF report)',
    expire_by: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // link valid for 2 hours
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: site + '/thank-you',
    callback_method: 'get',
    notes: { offer: 'reserve_101', position: String(input.position || '').slice(0, 20) },
  };

  try {
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64'),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.short_url) {
      console.error('Razorpay error', res.status, JSON.stringify(data));
      return reply(502, { error: 'Could not create payment link' });
    }
    return reply(200, { url: data.short_url });
  } catch (err) {
    console.error('Request failed', err);
    return reply(502, { error: 'Could not create payment link' });
  }
};
