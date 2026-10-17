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

function orderNotes(input, planId, contact, appointment) {
  const validAppointment = isValidAppointment(appointment);
  return {
    plan: planId,
    position: String(input.position || '').slice(0, 20),
    source: String(input.source || '').slice(0, 30),
    appointment_date: validAppointment ? String(appointment.date) : '',
    appointment_time: validAppointment ? String(appointment.time) : '',
    topics: Array.isArray(input.topics) ? input.topics.map(String).join(', ').slice(0, 240) : '',
    customer_phone: contact,
  };
}

async function razorpayRequest(env, path, method, body) {
  const credentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const result = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await result.json().catch(() => ({}));
  return { ok: result.ok, status: result.status, data };
}

async function signatureMatches(orderId, paymentId, signature, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`),
  );
  const expected = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const supplied = signature.toLowerCase();
  let difference = expected.length ^ supplied.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ (supplied.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function parseInput(request) {
  return request.json().catch(() => null);
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

    if (!['/create-order', '/verify-payment'].includes(url.pathname)) {
      return response(404, { error: 'Not found' }, origin);
    }
    if (request.method !== 'POST') return response(405, { error: 'Use POST' }, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return response(503, { error: 'Payment is not configured' }, origin);
    }

    const input = await parseInput(request);
    if (!input || typeof input !== 'object') return response(400, { error: 'Invalid request' }, origin);

    if (url.pathname === '/create-order') {
      const planId = String(input.plan || '');
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

      const reference = `${planId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        const result = await razorpayRequest(env, '/orders', 'POST', {
          amount: plan.price * 100,
          currency: 'INR',
          receipt: reference,
          notes: orderNotes(input, planId, contact, appointment),
        });
        if (!result.ok || !result.data.id) {
          console.error('Razorpay order request failed', result.status);
          return response(502, { error: 'Could not create payment order' }, origin);
        }
        return response(200, {
          key_id: env.RAZORPAY_KEY_ID,
          order_id: result.data.id,
          amount: result.data.amount,
          currency: result.data.currency,
          ref: reference,
        }, origin);
      } catch (error) {
        console.error('Payment-order request failed', error);
        return response(502, { error: 'Could not create payment order' }, origin);
      }
    }

    const orderId = String(input.razorpay_order_id || '');
    const paymentId = String(input.razorpay_payment_id || '');
    const signature = String(input.razorpay_signature || '');
    if (!/^order_[A-Za-z0-9]+$/.test(orderId)
      || !/^pay_[A-Za-z0-9]+$/.test(paymentId)
      || !/^[a-f0-9]{64}$/i.test(signature)) {
      return response(400, { error: 'Invalid payment verification details' }, origin);
    }

    try {
      if (!await signatureMatches(orderId, paymentId, signature, env.RAZORPAY_KEY_SECRET)) {
        return response(400, { error: 'Payment signature is invalid' }, origin);
      }

      const [orderResult, paymentResult] = await Promise.all([
        razorpayRequest(env, `/orders/${encodeURIComponent(orderId)}`, 'GET'),
        razorpayRequest(env, `/payments/${encodeURIComponent(paymentId)}`, 'GET'),
      ]);
      if (!orderResult.ok || !paymentResult.ok) {
        console.error('Razorpay payment verification lookup failed', orderResult.status, paymentResult.status);
        return response(502, { error: 'Could not verify payment' }, origin);
      }

      const order = orderResult.data;
      let payment = paymentResult.data;
      const planId = String(order.notes?.plan || '');
      const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
      if (!plan || order.id !== orderId || payment.order_id !== orderId
        || order.currency !== 'INR' || order.amount !== plan.price * 100
        || payment.currency !== 'INR' || payment.amount !== order.amount) {
        return response(400, { error: 'Payment does not match this order' }, origin);
      }

      if (payment.status === 'authorized') {
        const capture = await razorpayRequest(
          env,
          `/payments/${encodeURIComponent(paymentId)}/capture`,
          'POST',
          { amount: order.amount, currency: order.currency },
        );
        if (!capture.ok) {
          console.error('Razorpay payment capture failed', capture.status);
          return response(502, { error: 'Payment was authorized but could not be captured' }, origin);
        }
        payment = capture.data;
      }
      if (payment.status !== 'captured') {
        return response(409, { error: 'Payment has not been captured' }, origin);
      }

      return response(200, {
        verified: true,
        payment_id: paymentId,
        reference_id: String(order.receipt || ''),
        plan: planId,
        appointment_date: String(order.notes?.appointment_date || ''),
        appointment_time: String(order.notes?.appointment_time || ''),
      }, origin);
    } catch (error) {
      console.error('Payment verification failed', error);
      return response(502, { error: 'Could not verify payment' }, origin);
    }
  },
};
