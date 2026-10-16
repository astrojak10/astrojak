// Creates a Razorpay Payment Link for a plan and returns its URL.
// Prices come from pricing.js (the same file the website uses), never from the browser.
// Keys live ONLY in Netlify environment variables: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
const PRICING = require('../../pricing.js');

const allowedOrigins = new Set([
  'https://www.astrojak.in',
  'https://astrojak.in',
  'http://localhost:8765',
]);

const reply = (statusCode, body, origin) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers.Vary = 'Origin';
  }
  return { statusCode, headers, body: JSON.stringify(body) };
};

function cleanCustomer(c) {
  const out = {};
  if (!c || typeof c !== 'object') return out;
  const digits = String(c.contact || '').replace(/[^\d]/g, '');
  const tail = digits.length >= 10 ? digits.slice(-10) : '';
  if (/^[6-9]\d{9}$/.test(tail)) out.contact = '+91' + tail;
  return out;
}

async function createLink(auth, payload) {
  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !!data.short_url, status: res.status, data };
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  if (event.httpMethod === 'OPTIONS') return reply(204, {}, origin);
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST' }, origin);

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
    return reply(500, { error: 'Payment is not configured' }, origin);
  }

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) {
    return reply(400, { error: 'Invalid request' }, origin);
  }

  const planId = String(input.plan || '');
  const plan = Object.prototype.hasOwnProperty.call(PRICING.plans, planId) ? PRICING.plans[planId] : null;
  if (!plan) return reply(400, { error: 'Unknown plan' }, origin);
  const customer = cleanCustomer(input.customer);
  if (!customer.contact) return reply(400, { error: 'A valid mobile number is required' }, origin);

  const appointment = input.appointment || {};
  const date = String(appointment.date || '');
  const time = String(appointment.time || '');
  const slotLabels = ['09:00 AM – 12:00 PM', '12:00 PM – 03:00 PM', '03:00 PM – 06:00 PM', '06:00 PM – 09:00 PM'];
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00Z') : null;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
  const todayIst = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  const noAppointment = !date && !time;
  const validAppointment = validDate && date >= todayIst && slotLabels.indexOf(time) !== -1;
  if (!(planId === 'reserve' && noAppointment) && !validAppointment) {
    return reply(400, { error: 'Choose a valid future appointment date and time slot' }, origin);
  }

  // Return customers to the domain that served the payment request.
  const h = event.headers || {};
  const host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  const site = /^[a-z0-9.-]+(:\d+)?$/i.test(host)
    ? (/^localhost/i.test(host) ? 'http://' : 'https://') + host
    : (process.env.URL || 'https://www.astrojak.in').replace(/\/$/, '');
  const payload = {
    amount: Math.round(plan.price * 100), // paise, from pricing.js
    currency: 'INR',
    accept_partial: false,
    // plan id is the first part, so the thank-you page can tell which plan was paid
    reference_id: planId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    description: plan.name + ' with Acharya Narender Ji' + (planId === 'reserve' ? ' (includes detailed horoscope PDF report)' : ''),
    expire_by: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // link valid for 2 hours
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: (() => {
      const callback = new URL(site + '/thank-you');
      if (validAppointment) {
        callback.searchParams.set('appointment_date', date);
        callback.searchParams.set('appointment_time', time);
      }
      return callback.toString();
    })(),
    callback_method: 'get',
    notes: {
      plan: planId,
      position: String(input.position || '').slice(0, 20),
      source: String(input.source || '').slice(0, 30),
      appointment_date: validAppointment ? date : '',
      appointment_time: validAppointment ? time : '',
      topics: Array.isArray(input.topics) ? input.topics.map(String).join(', ').slice(0, 240) : '',
    },
  };
  payload.notes.customer_phone = customer.contact;

  const auth = 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64');

  try {
    const r = await createLink(auth, { ...payload, customer });
    if (!r.ok) {
      console.error('Razorpay error', r.status, JSON.stringify(r.data));
      return reply(502, { error: 'Could not create payment link' }, origin);
    }
    return reply(200, { url: r.data.short_url, ref: payload.reference_id }, origin);
  } catch (err) {
    console.error('Request failed', err);
    return reply(502, { error: 'Could not create payment link' }, origin);
  }
};
