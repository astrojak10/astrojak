import PRICING from '../pricing.js';

const ALLOWED_ORIGINS = new Set([
  'https://www.astrojak.in',
  'https://astrojak.in',
  'http://localhost:8765',
]);

const PLANS = PRICING.plans;

const SLOT_LABELS = [
  '09:00 AM – 12:00 PM',
  '12:00 PM – 03:00 PM',
  '03:00 PM – 06:00 PM',
  '06:00 PM – 09:00 PM',
];

function response(status, body, origin) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function normalizedContact(customer) {
  if (!customer || typeof customer !== 'object') return '';
  const digits = String(customer.contact || '').replace(/\D/g, '');
  const tail = digits.length >= 10 ? digits.slice(-10) : '';
  return /^[6-9]\d{9}$/.test(tail) ? `+91${tail}` : '';
}

function isValidAppointment(appointment) {
  const date = String(appointment?.date || '');
  const time = String(appointment?.time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SLOT_LABELS.includes(time)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const todayIst = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  return date >= todayIst;
}

function siteUrl(env) {
  const value = String(env.SITE_URL || 'https://www.astrojak.in').replace(/\/+$/, '');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('SITE_URL must use HTTPS');
    return url.origin;
  } catch (error) {
    throw new Error('SITE_URL must be a valid HTTPS origin');
  }
}

async function createPaymentLink(env, payload) {
  const credentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const result = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.short_url) {
    console.error('Razorpay payment-link request failed', result.status);
    return null;
  }
  return data.short_url;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }

    if (url.pathname !== '/create-payment-link') return response(404, { error: 'Not found' }, origin);
    if (request.method !== 'POST') return response(405, { error: 'Use POST' }, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return response(503, { error: 'Payment is not configured' }, origin);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return response(400, { error: 'Invalid request' }, origin);
    }

    const planId = String(input?.plan || '');
    const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
    if (!plan) return response(400, { error: 'Unknown plan' }, origin);

    const contact = normalizedContact(input.customer);
    if (!contact) return response(400, { error: 'A valid mobile number is required' }, origin);

    const appointment = input.appointment && typeof input.appointment === 'object' ? input.appointment : {};
    const date = String(appointment.date || '');
    const time = String(appointment.time || '');
    const noAppointment = !date && !time;
    const validAppointment = isValidAppointment(appointment);
    if (!(planId === 'reserve' && noAppointment) && !validAppointment) {
      return response(400, { error: 'Choose a valid future appointment date and time slot' }, origin);
    }

    let callback;
    try {
      callback = new URL('/thank-you.html', siteUrl(env));
    } catch (error) {
      console.error(error.message);
      return response(500, { error: 'Payment configuration is invalid' }, origin);
    }
    if (validAppointment) {
      callback.searchParams.set('appointment_date', date);
      callback.searchParams.set('appointment_time', time);
    }

    const reference = `${planId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      amount: plan.price * 100,
      currency: 'INR',
      accept_partial: false,
      reference_id: reference,
      description: `${plan.name} with Acharya Narender Ji${planId === 'reserve' ? ' (includes detailed horoscope PDF report)' : ''}`,
      expire_by: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
      notify: { sms: false, email: false },
      reminder_enable: false,
      callback_url: callback.toString(),
      callback_method: 'get',
      customer: { contact },
      notes: {
        plan: planId,
        position: String(input.position || '').slice(0, 20),
        source: String(input.source || '').slice(0, 30),
        appointment_date: validAppointment ? date : '',
        appointment_time: validAppointment ? time : '',
        topics: Array.isArray(input.topics) ? input.topics.map(String).join(', ').slice(0, 240) : '',
        customer_phone: contact,
      },
    };

    try {
      const paymentUrl = await createPaymentLink(env, payload);
      if (!paymentUrl) return response(502, { error: 'Could not create payment link' }, origin);
      return response(200, { url: paymentUrl, ref: reference }, origin);
    } catch (error) {
      console.error('Payment-link request failed', error);
      return response(502, { error: 'Could not create payment link' }, origin);
    }
  },
};
