// Creates a Razorpay Payment Link for a plan and returns its URL.
// Prices come from pricing.js (the same file the website uses), never from the browser.
// Keys live ONLY in Netlify environment variables: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
const PRICING = require('../../pricing.js');

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

function cleanCustomer(c) {
  const out = {};
  if (!c || typeof c !== 'object') return out;
  const name = String(c.name || '').trim().slice(0, 60);
  if (name) out.name = name;
  const email = String(c.email || '').trim().slice(0, 80);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email;
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
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST' });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
    return reply(500, { error: 'Payment is not configured' });
  }

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) {}

  const planId = String(input.plan || '');
  const plan = Object.prototype.hasOwnProperty.call(PRICING.plans, planId) ? PRICING.plans[planId] : null;
  if (!plan) return reply(400, { error: 'Unknown plan' });

  // Always send the customer back to the exact address they paid from (works for netlify.app, custom domains, previews)
  const h = event.headers || {};
  const host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  const site = /^[a-z0-9.-]+(:\d+)?$/i.test(host)
    ? (/^localhost/i.test(host) ? 'http://' : 'https://') + host
    : (process.env.URL || 'https://astrojak.netlify.app').replace(/\/$/, '');
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
    callback_url: site + '/thank-you',
    callback_method: 'get',
    notes: { plan: planId, position: String(input.position || '').slice(0, 20), source: String(input.source || '').slice(0, 30) },
  };
  // customer details also go into Notes, so they show on every payment in the Razorpay dashboard and exports
  const customer = cleanCustomer(input.customer);
  if (customer.name) payload.notes.customer_name = customer.name;
  if (customer.contact) payload.notes.customer_phone = customer.contact;
  if (customer.email) payload.notes.customer_email = customer.email;

  const auth = 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64');

  try {
    let r = await createLink(auth, Object.keys(customer).length ? { ...payload, customer } : payload);
    if (!r.ok && Object.keys(customer).length) r = await createLink(auth, payload); // retry without prefill
    if (!r.ok) {
      console.error('Razorpay error', r.status, JSON.stringify(r.data));
      return reply(502, { error: 'Could not create payment link' });
    }
    return reply(200, { url: r.data.short_url, ref: payload.reference_id });
  } catch (err) {
    console.error('Request failed', err);
    return reply(502, { error: 'Could not create payment link' });
  }
};
