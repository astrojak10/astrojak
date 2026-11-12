import PRICING from '../pricing.js';

const ALLOWED_ORIGINS = new Set([
  'https://www.astrojak.in',
  'https://astrojak.in',
  'http://localhost:8765',
]);

const PLANS = PRICING.plans;
const PRECHECKOUT_LEADS_SPREADSHEET_ID = '10dAPMDIUQQVKuhYj8uww9atBGbdOSATJ_0AoxawN22g';
const CUSTOMER_BOOKINGS_SPREADSHEET_ID = '1Ecr2oISzV7vJY5CJyu9QNyd-E1TxaENOcbns31X3fOk';

const SLOT_LABELS = [
  '09:00 AM – 12:00 PM',
  '12:00 PM – 03:00 PM',
  '03:00 PM – 06:00 PM',
  '06:00 PM – 09:00 PM',
];

function response(status, body, origin, extraHeaders = {}) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

const ADMIN_SESSION_COOKIE = 'astrojak_admin_session';
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const DEFAULT_PAYMENT_SETTINGS = {
  activeGateway: 'razorpay',
  cashfreeMode: 'sandbox',
  payuMode: 'sandbox',
  easebuzzMode: 'sandbox',
  paytmMode: 'sandbox',
};
const PAYU_PLAN_PREFIXES = {
  reserve: 'res',
  kundali: 'kun',
  'detailed-kundali': 'det',
  matchmaking: 'mat',
};

function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

async function adminSessionKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

async function createAdminSession(username, secret) {
  const payload = base64Url(JSON.stringify({
    username,
    expiresAt: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
  }));
  const key = await adminSessionKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

function requestCookie(request, name) {
  const cookies = String(request.headers.get('Cookie') || '').split(';');
  const match = cookies.map(cookie => cookie.trim()).find(cookie => cookie.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

async function hasAdminSession(request, env) {
  const secret = String(env.ADMIN_SESSION_SECRET || '');
  if (!secret) return false;
  const [payload, signature, extra] = requestCookie(request, ADMIN_SESSION_COOKIE).split('.');
  if (!payload || !signature || extra !== undefined) return false;
  try {
    const key = await adminSessionKey(secret, ['verify']);
    const signatureBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - signature.length % 4) % 4)),
      character => character.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(payload),
    );
    if (!valid) return false;
    const claims = JSON.parse(atob(
      payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4),
    ));
    return claims.username === env.ADMIN_USERNAME
      && Number.isInteger(claims.expiresAt)
      && claims.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function getPaymentSettings(env) {
  if (!env.PAYMENT_SETTINGS) throw new Error('Payment settings storage is not configured');
  const saved = await env.PAYMENT_SETTINGS.get('gateway-settings', 'json');
  if (!saved) return { ...DEFAULT_PAYMENT_SETTINGS };
  const settings = { ...DEFAULT_PAYMENT_SETTINGS, ...saved };
  if (!['razorpay', 'cashfree', 'payu', 'easebuzz', 'paytm'].includes(settings.activeGateway)
    || !['sandbox', 'production'].includes(settings.cashfreeMode)
    || !['sandbox', 'production'].includes(settings.payuMode)
    || !['sandbox', 'production'].includes(settings.easebuzzMode)
    || !['sandbox', 'production'].includes(settings.paytmMode)) {
    throw new Error('Saved payment settings are invalid');
  }
  return settings;
}

function paytmCredentials(env, mode) {
  const production = mode === 'production';
  return {
    mid: production ? env.PAYTM_PRODUCTION_MID : env.PAYTM_STAGING_MID,
    merchantKey: production ? env.PAYTM_PRODUCTION_MERCHANT_KEY : env.PAYTM_STAGING_MERCHANT_KEY,
  };
}

function paymentGatewayConfigured(env, gateway, settings) {
  if (gateway === 'cashfree') return Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
  if (gateway === 'payu') return Boolean(env.PAYU_MERCHANT_KEY && env.PAYU_MERCHANT_SALT);
  if (gateway === 'easebuzz') return Boolean(env.EASEBUZZ_KEY && env.EASEBUZZ_SALT);
  if (gateway === 'paytm') {
    const credentials = paytmCredentials(env, settings?.paytmMode || 'sandbox');
    return Boolean(credentials.mid && credentials.merchantKey && credentials.merchantKey.length === 16);
  }
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function paytmBaseUrl(mode) {
  return mode === 'sandbox'
    ? 'https://securestage.paytmpayments.com'
    : 'https://secure.paytmpayments.com';
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function paytmChecksum(body, merchantKey) {
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(3)));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${body}|${salt}`),
  );
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') + salt;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(merchantKey),
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: new TextEncoder().encode('@@@@&&&&####$$$$') },
    key,
    new TextEncoder().encode(hash),
  );
  return bytesToBase64(new Uint8Array(encrypted));
}

async function paytmVerifyChecksum(body, merchantKey, signature) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(merchantKey),
      { name: 'AES-CBC' },
      false,
      ['decrypt'],
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: new TextEncoder().encode('@@@@&&&&####$$$$') },
      key,
      base64ToBytes(signature),
    );
    const hash = new TextDecoder().decode(decrypted);
    const salt = hash.slice(-4);
    const expectedDigest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${body}|${salt}`),
    );
    const expected = Array.from(new Uint8Array(expectedDigest), byte => byte.toString(16).padStart(2, '0')).join('') + salt;
    return constantTimeEqual(hash, expected);
  } catch {
    return false;
  }
}

async function paytmRequest(baseUrl, path, body, merchantKey) {
  const bodyJson = JSON.stringify(body);
  const signature = await paytmChecksum(bodyJson, merchantKey);
  const result = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ body, head: { signature } }),
  });
  const data = await result.json().catch(() => ({}));
  const responseSignature = data.head?.signature;
  const validSignature = typeof responseSignature === 'string'
    && data.body
    && await paytmVerifyChecksum(JSON.stringify(data.body), merchantKey, responseSignature);
  return {
    ok: result.ok && validSignature,
    httpOk: result.ok,
    signatureValid: Boolean(validSignature),
    status: result.status,
    data,
  };
}

async function verifiedPaytmOrder(env, orderId) {
  if (!/^[A-Za-z0-9]{1,50}$/.test(orderId) || !env.PAYMENT_SETTINGS) return null;
  const order = await env.PAYMENT_SETTINGS.get(`paytm-order:${orderId}`, 'json');
  if (!order || !['sandbox', 'production'].includes(order.mode)) return null;
  const credentials = paytmCredentials(env, order.mode);
  if (!credentials.mid || !credentials.merchantKey || credentials.merchantKey.length !== 16
    || credentials.mid !== order.mid) return null;

  const result = await paytmRequest(
    paytmBaseUrl(order.mode),
    '/v3/order/status',
    { mid: credentials.mid, orderId },
    credentials.merchantKey,
  );
  const transaction = result.data.body;
  const plan = Object.prototype.hasOwnProperty.call(PLANS, order.planId) ? PLANS[order.planId] : null;
  const amount = Math.round(Number(transaction?.txnAmount) * 100);
  if (!result.ok || !plan || transaction?.resultInfo?.resultStatus !== 'TXN_SUCCESS'
    || transaction.mid !== credentials.mid || transaction.orderId !== orderId
    || !/^[A-Za-z0-9]{1,50}$/.test(String(transaction.txnId || ''))
    || !Number.isFinite(amount) || amount !== plan.price * 100
    || amount !== order.amount || (transaction.txnType && transaction.txnType !== 'SALE')
    || ((order.appointmentDate || order.appointmentTime)
      && !isValidAppointment({ date: order.appointmentDate, time: order.appointmentTime }))
    || (!order.appointmentDate && !order.appointmentTime && order.planId !== 'reserve')) return null;

  return {
    paymentId: String(transaction.txnId),
    orderId,
    referenceId: orderId,
    planId: order.planId,
    amount,
    currency: 'INR',
    appointmentDate: order.appointmentDate,
    appointmentTime: order.appointmentTime,
    createdAt: Math.floor(Date.now() / 1000),
  };
}

async function cashfreeRequest(env, settings, path, method, body) {
  const baseUrl = settings.cashfreeMode === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';
  const result = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'x-client-id': env.CASHFREE_APP_ID,
      'x-client-secret': env.CASHFREE_SECRET_KEY,
      'x-api-version': '2025-01-01',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await result.json().catch(() => ({}));
  return { ok: result.ok, status: result.status, data };
}

function paymentOrderFailure(gateway, status, data, origin) {
  const rawCode = data?.code
    || data?.error?.code
    || data?.error_code
    || data?.status_code
    || '';
  const providerCode = /^[A-Za-z0-9_.-]{1,64}$/.test(String(rawCode))
    ? String(rawCode)
    : '';
  const rawMessage = data?.message
    || data?.error?.description
    || data?.error?.message
    || data?.error_desc
    || data?.msg
    || '';
  const providerMessage = typeof rawMessage === 'string'
    ? rawMessage.replace(/[\r\n\t]+/g, ' ')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
      .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, '[mobile]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180)
    : '';
  const diagnostic = `${gateway} rejected the order (HTTP ${status}${providerCode ? `, ${providerCode}` : ''})${providerMessage ? `: ${providerMessage}` : '.'}`;
  console.error('Payment gateway rejected order', {
    gateway,
    status,
    providerCode: providerCode || 'unknown',
    providerMessage,
  });
  return response(502, {
    error: 'Could not create payment order',
    code: `${gateway.toUpperCase()}_ORDER_REJECTED`,
    diagnostic,
  }, origin);
}

async function verifiedCashfreeOrder(env, settings, orderId) {
  if (!/^[A-Za-z0-9_-]{1,45}$/.test(orderId)) return null;
  const savedOrder = env.PAYMENT_SETTINGS
    ? await env.PAYMENT_SETTINGS.get(`cashfree-order:${orderId}`, 'json')
    : null;
  const orderSettings = savedOrder && ['sandbox', 'production'].includes(savedOrder.mode)
    ? { ...settings, cashfreeMode: savedOrder.mode }
    : settings;
  const result = await cashfreeRequest(
    env,
    orderSettings,
    `/orders/${encodeURIComponent(orderId)}`,
    'GET',
  );
  if (!result.ok || result.data.order_status !== 'PAID') return null;
  const order = result.data;
  const planId = String(savedOrder?.planId || order.order_tags?.plan || '');
  const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
  if (!plan || !orderId.startsWith(`${planId}_`)
    || order.order_id !== orderId || order.order_currency !== 'INR'
    || Number(order.order_amount) !== plan.price
    || (savedOrder && Number(savedOrder.amount) !== plan.price)) return null;
  return {
    paymentId: orderId,
    orderId,
    referenceId: orderId,
    planId,
    amount: Math.round(Number(order.order_amount) * 100),
    currency: order.order_currency,
    appointmentDate: String(savedOrder?.appointmentDate || order.order_tags?.appointment_date || ''),
    appointmentTime: String(savedOrder?.appointmentTime || order.order_tags?.appointment_time || ''),
  };
}

function payuBaseUrl(settings) {
  return settings.payuMode === 'sandbox' ? 'https://test.payu.in' : 'https://secure.payu.in';
}

function easebuzzBaseUrl(settings) {
  return settings.easebuzzMode === 'sandbox' ? 'https://testpay.easebuzz.in' : 'https://pay.easebuzz.in';
}

function easebuzzTransactionUrl(settings) {
  return settings.easebuzzMode === 'sandbox'
    ? 'https://testdashboard.easebuzz.in/transaction/v2.1/retrieve'
    : 'https://dashboard.easebuzz.in/transaction/v2.1/retrieve';
}

async function sha512(value) {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function easebuzzRequest(url, fields) {
  const result = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(fields),
  });
  const data = await result.json().catch(() => ({}));
  return { ok: result.ok, status: result.status, data };
}

async function verifiedEasebuzzTransaction(env, settings, transactionId) {
  if (!/^[A-Za-z0-9_|/-]{1,40}$/.test(transactionId)) return null;
  const key = env.EASEBUZZ_KEY;
  const salt = env.EASEBUZZ_SALT;
  const hash = await sha512(`${key}|${transactionId}|${salt}`);
  const result = await easebuzzRequest(easebuzzTransactionUrl(settings), {
    key,
    txnid: transactionId,
    hash,
  });
  if (!result.ok || result.data.status !== true || !Array.isArray(result.data.msg)) return null;

  const transaction = result.data.msg.find(entry => entry && entry.txnid === transactionId);
  if (!transaction || String(transaction.status || '').toLowerCase() !== 'success'
    || transaction.key !== key) return null;
  const planId = String(transaction.udf1 || '');
  const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
  const amount = Math.round(Number(transaction.amount) * 100);
  const appointmentDate = String(transaction.udf2 || '');
  const appointmentTimeCode = String(transaction.udf3 || '');
  if (appointmentTimeCode && !/^[1-4]$/.test(appointmentTimeCode)) return null;
  const appointmentTime = appointmentTimeCode
    ? SLOT_LABELS[Number(appointmentTimeCode) - 1]
    : '';
  if (!plan || !transactionId.startsWith(`e${PAYU_PLAN_PREFIXES[planId]}`)
    || !/^[A-Za-z0-9]{1,40}$/.test(String(transaction.easepayid || ''))
    || !Number.isFinite(amount) || amount !== plan.price * 100
    || transaction.productinfo !== `ASTROJAK ${plan.name}`
    || ((appointmentDate || appointmentTime)
      && !isValidAppointment({ date: appointmentDate, time: appointmentTime }))
    || (!appointmentDate && !appointmentTime && planId !== 'reserve')) return null;

  const addedOn = Date.parse(`${String(transaction.addedon || '').replace(' ', 'T')}Z`);
  return {
    paymentId: String(transaction.easepayid),
    orderId: transactionId,
    referenceId: transactionId,
    planId,
    amount,
    currency: 'INR',
    appointmentDate,
    appointmentTime,
    createdAt: Number.isFinite(addedOn) ? Math.floor(addedOn / 1000) : Math.floor(Date.now() / 1000),
  };
}

async function payuRequest(settings, fields) {
  const endpoint = settings.payuMode === 'sandbox'
    ? 'https://test.payu.in/merchant/postservice.php?form=2'
    : 'https://info.payu.in/merchant/postservice.php?form=2';
  const result = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const data = await result.json().catch(() => ({}));
  return { ok: result.ok, status: result.status, data };
}

async function verifiedPayuTransaction(env, settings, transactionId) {
  if (!/^[A-Za-z0-9]{1,25}$/.test(transactionId)) return null;
  const key = env.PAYU_MERCHANT_KEY;
  const salt = env.PAYU_MERCHANT_SALT;
  const hash = await sha512(`${key}|verify_payment|${transactionId}|${salt}`);
  const result = await payuRequest(settings, {
    key,
    command: 'verify_payment',
    var1: transactionId,
    hash,
  });
  if (!result.ok || Number(result.data.status) !== 1) return null;

  const transaction = result.data.transaction_details?.[transactionId];
  if (!transaction || transaction.txnid !== transactionId
    || String(transaction.status || '').toLowerCase() !== 'success') return null;
  const planId = String(transaction.udf1 || '');
  const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
  const amount = Math.round(Number(transaction.amt) * 100);
  const appointmentDate = String(transaction.udf2 || '');
  const appointmentTime = String(transaction.udf3 || '');
  if (!plan || !transactionId.startsWith(PAYU_PLAN_PREFIXES[planId])
    || !/^\d{1,20}$/.test(String(transaction.mihpayid || ''))
    || !Number.isFinite(amount) || amount !== plan.price * 100
    || transaction.productinfo !== `ASTROJAK ${plan.name}`
    || ((appointmentDate || appointmentTime)
      && !isValidAppointment({ date: appointmentDate, time: appointmentTime }))
    || (!appointmentDate && !appointmentTime && planId !== 'reserve')) return null;

  const addedOn = Date.parse(`${String(transaction.addedon || '').replace(' ', 'T')}+05:30`);
  return {
    paymentId: String(transaction.mihpayid || ''),
    orderId: transactionId,
    referenceId: transactionId,
    planId,
    amount,
    currency: 'INR',
    appointmentDate,
    appointmentTime,
    createdAt: Number.isFinite(addedOn) ? Math.floor(addedOn / 1000) : Math.floor(Date.now() / 1000),
  };
}

function payuCallbackPage(origin, transactionId, status) {
  const payload = JSON.stringify({
    type: 'payu-result',
    txnid: transactionId,
    status,
  }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const allowedOrigins = [...ALLOWED_ORIGINS].join(' ');
  const html = `<!doctype html><meta charset="utf-8"><title>Payment result</title><script>
    var result=${payload};
    var targetOrigin=${JSON.stringify(origin)};
    if(window.parent!==window)window.parent.postMessage(result,targetOrigin);
    if(window.opener)window.opener.postMessage(result,targetOrigin);
    if(window.parent===window&&!window.opener)location.replace('https://www.astrojak.in/thank-you.html?gateway=payu&txnid='+encodeURIComponent(result.txnid));
  </script>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors ${allowedOrigins}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
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

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function metaApiUrl(env, datasetId) {
  const accessToken = String(env.META_CAPI_ACCESS_TOKEN || '').trim();
  const graphVersion = String(env.META_CAPI_GRAPH_VERSION || '').trim();
  if (!datasetId || !accessToken || !/^v\d+\.\d+$/.test(graphVersion)) {
    throw new Error('Meta Conversions API is not configured');
  }
  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(datasetId)}/events`,
  );
  url.searchParams.set('access_token', accessToken);
  return url;
}

function metaTestCode(env) {
  return String(env.META_CAPI_TEST_EVENT_CODE || '').trim();
}

async function postMetaEvent(env, event, eventType) {
  const payload = { data: [event] };
  const testEventCode = metaTestCode(env);
  if (testEventCode) payload.test_event_code = testEventCode;
  const result = await fetch(metaApiUrl(env, String(env.META_CAPI_DATASET_ID || '').trim()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || Number(data.events_received) !== 1) {
    const message = typeof data.error?.message === 'string'
      ? data.error.message.replace(/[\r\n]+/g, ' ').slice(0, 240)
      : `HTTP_${result.status}`;
    throw new Error(`Meta Conversions API rejected the ${eventType} event: ${message}`);
  }
  console.info(`Meta Conversions API accepted ${eventType} event`, {
    eventsReceived: data.events_received,
    fbTraceId: typeof data.fbtrace_id === 'string' ? data.fbtrace_id : '',
    testEvent: Boolean(testEventCode),
  });
}

function metaPhone(value) {
  let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

async function sendMetaCheckoutLeadEvent(env, lead) {
  const phone = metaPhone(lead.phone);
  if (!phone) throw new Error('A valid customer phone is required for Meta matching');
  const pageUrl = new URL(String(lead.page || ''));
  if (!ALLOWED_ORIGINS.has(pageUrl.origin)) {
    throw new Error('The checkout page URL is not an allowed website origin');
  }
  pageUrl.search = '';
  pageUrl.hash = '';
  const eventTime = Math.floor(Date.now() / 1000);
  const phoneHash = await sha256(phone);
  await postMetaEvent(env, {
    event_name: 'Lead',
    event_time: eventTime,
    action_source: 'website',
    event_source_url: pageUrl.toString(),
    event_id: `lead_${phoneHash.slice(0, 32)}_${eventTime}`,
    user_data: { ph: [phoneHash] },
    custom_data: { content_name: lead.plan },
  }, 'checkout lead');
}

async function sendMetaPaidBookingEvent(env, booking) {
  const userData = {};
  const email = String(booking.email || '').trim().toLowerCase();
  const phone = metaPhone(booking.phone);
  if (email) {
    userData.em = [await sha256(email)];
  }
  if (phone) userData.ph = [await sha256(phone)];
  if (!userData.em && !userData.ph) {
    throw new Error('A valid customer email or phone is required for Meta matching');
  }
  const rawEventTime = Number(booking.eventTime);
  const eventTime = Math.floor(rawEventTime > 1e12 ? rawEventTime / 1000 : rawEventTime);
  const now = Math.floor(Date.now() / 1000);
  if (!eventTime || eventTime > now + 300 || eventTime < now - 7 * 24 * 60 * 60) {
    throw new Error('Payment time is invalid or too old for Meta event reporting');
  }

  const event = {
    event_name: 'Purchase',
    event_time: eventTime,
    action_source: 'website',
    event_id: String(booking.paymentId),
    event_source_url: 'https://www.astrojak.in/thank-you.html',
    user_data: userData,
    custom_data: {
      value: booking.amount,
      currency: 'INR',
      content_name: booking.plan,
    },
  };
  await postMetaEvent(env, event, 'paid booking');
}

async function trackMetaCheckoutLead(env, lead) {
  try {
    await sendMetaCheckoutLeadEvent(env, lead);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Could not send checkout lead to Meta; checkout lead is saved:', message);
  }
}

async function trackMetaPaidBooking(env, booking) {
  try {
    await sendMetaPaidBookingEvent(env, booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Could not send paid booking to Meta; Google Sheets booking is saved:', message);
  }
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

function base64Url(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function googleAccessToken(credentials, scope = 'https://www.googleapis.com/auth/calendar.events') {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsignedToken = `${header}.${claim}`;
  const privateKeyBytes = Uint8Array.from(
    atob(credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')),
    character => character.charCodeAt(0),
  );
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
  const result = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.access_token) {
    const reason = typeof data.error === 'string' && /^[a-z0-9_-]+$/i.test(data.error)
      ? data.error
      : `HTTP_${result.status}`;
    throw new Error(`Google OAuth rejected the service account (${reason})`);
  }
  return data.access_token;
}

function googleServiceAccount(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
  }
  let credentials;
  try {
    credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON');
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Service-account JSON must contain client_email and private_key');
  }
  return credentials;
}

async function appendGoogleSheetRow(accessToken, spreadsheetId, range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const result = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  if (!result.ok) {
    const failure = await result.json().catch(() => ({}));
    const status = typeof failure.error?.status === 'string'
      && /^[a-z0-9_-]+$/i.test(failure.error.status)
      ? failure.error.status
      : `HTTP_${result.status}`;
    const message = typeof failure.error?.message === 'string'
      ? failure.error.message.replace(/[\r\n]+/g, ' ').slice(0, 240)
      : '';
    throw new Error(`Google Sheets API: ${status}${message ? ` — ${message}` : ''}`);
  }
  const data = await result.json();
  if (data.updates?.updatedRows !== 1) {
    throw new Error('Google Sheets API did not confirm the row append');
  }
}

async function googleSheetTab(accessToken, spreadsheetId, preferredTitle) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(title)`;
  const result = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!result.ok) {
    const failure = await result.json().catch(() => ({}));
    const status = typeof failure.error?.status === 'string'
      && /^[a-z0-9_-]+$/i.test(failure.error.status)
      ? failure.error.status
      : `HTTP_${result.status}`;
    const message = typeof failure.error?.message === 'string'
      ? failure.error.message.replace(/[\r\n]+/g, ' ').slice(0, 240)
      : '';
    throw new Error(`Google Sheets API: ${status}${message ? ` — ${message}` : ''}`);
  }
  const spreadsheet = await result.json();
  const titles = Array.isArray(spreadsheet.sheets)
    ? spreadsheet.sheets
      .map(sheet => sheet?.properties?.title)
      .filter(title => typeof title === 'string' && title.length > 0)
    : [];
  if (!titles.length) {
    throw new Error('Google Sheets API returned no worksheet tabs for this spreadsheet');
  }
  if (titles.includes(preferredTitle)) return preferredTitle;
  console.warn('Preferred Google Sheets tab was not found; using the first worksheet tab', preferredTitle, titles[0]);
  return titles[0];
}

function googleSheetRange(tabTitle, columns) {
  return `'${tabTitle.replace(/'/g, "''")}'!${columns}`;
}

async function sheetContainsValue(accessToken, spreadsheetId, range, value) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const result = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!result.ok) {
    const failure = await result.json().catch(() => ({}));
    const status = typeof failure.error?.status === 'string'
      && /^[a-z0-9_-]+$/i.test(failure.error.status)
      ? failure.error.status
      : `HTTP_${result.status}`;
    const message = typeof failure.error?.message === 'string'
      ? failure.error.message.replace(/[\r\n]+/g, ' ').slice(0, 240)
      : '';
    throw new Error(`Google Sheets API: ${status}${message ? ` — ${message}` : ''}`);
  }
  const data = await result.json();
  return Array.isArray(data.values)
    && data.values.some(row => Array.isArray(row) && row[0] === value);
}

function appointmentTimes(label) {
  const times = {
    '09:00 AM – 12:00 PM': ['09:00', '12:00'],
    '12:00 PM – 03:00 PM': ['12:00', '15:00'],
    '03:00 PM – 06:00 PM': ['15:00', '18:00'],
    '06:00 PM – 09:00 PM': ['18:00', '21:00'],
  };
  return times[label];
}

async function eventIdForPayment(paymentId) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(paymentId));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }

    if (url.pathname === '/admin/login') {
      if (request.method !== 'POST') return response(405, { error: 'Use POST' }, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
      if (!env.ADMIN_USERNAME || env.ADMIN_USERNAME.length > 64
        || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12
        || env.ADMIN_PASSWORD.length > 256
        || !env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) {
        return response(503, { error: 'Admin login is not configured' }, origin);
      }
      const input = await parseInput(request);
      if (!input || typeof input.username !== 'string' || typeof input.password !== 'string'
        || input.username.length > 64 || input.password.length > 256
        || !constantTimeEqual(input.username, env.ADMIN_USERNAME)
        || !constantTimeEqual(input.password, env.ADMIN_PASSWORD)) {
        return response(401, { error: 'Invalid username or password' }, origin);
      }
      try {
        const session = await createAdminSession(env.ADMIN_USERNAME, env.ADMIN_SESSION_SECRET);
        return response(200, { authenticated: true }, origin, {
          'Set-Cookie': `${ADMIN_SESSION_COOKIE}=${session}; Domain=astrojak.in; Path=/admin; Max-Age=${ADMIN_SESSION_SECONDS}; Secure; HttpOnly; SameSite=Strict`,
        });
      } catch (error) {
        console.error('Could not create admin session', error);
        return response(503, { error: 'Admin login is unavailable' }, origin);
      }
    }

    if (url.pathname === '/admin/logout') {
      if (request.method !== 'POST') return response(405, { error: 'Use POST' }, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
      return response(200, { loggedOut: true }, origin, {
        'Set-Cookie': `${ADMIN_SESSION_COOKIE}=; Domain=astrojak.in; Path=/admin; Max-Age=0; Secure; HttpOnly; SameSite=Strict`,
      });
    }

    if (url.pathname === '/payment-config') {
      if (request.method !== 'GET') return response(405, { error: 'Use GET' }, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
      try {
        const settings = await getPaymentSettings(env);
        return response(200, {
          activeGateway: settings.activeGateway,
          cashfreeMode: settings.cashfreeMode,
          payuMode: settings.payuMode,
          easebuzzMode: settings.easebuzzMode,
          paytmMode: settings.paytmMode,
          requiresEmail: settings.activeGateway === 'payu' || settings.activeGateway === 'easebuzz',
        }, origin);
      } catch (error) {
        console.error('Could not read payment settings', error);
        return response(503, { error: 'Payment settings are unavailable' }, origin);
      }
    }

    if (url.pathname === '/payu-callback') {
      if (request.method !== 'POST') return new Response('Use POST', { status: 405 });
      const callbackOrigin = url.searchParams.get('origin') || '';
      if (!ALLOWED_ORIGINS.has(callbackOrigin)) {
        return new Response('Origin not allowed', { status: 403 });
      }
      let form;
      try {
        form = await request.formData();
      } catch {
        return new Response('Invalid payment response', { status: 400 });
      }
      const transactionId = String(form.get('txnid') || '');
      const status = String(form.get('status') || '').toLowerCase();
      if (!/^[A-Za-z0-9]{1,25}$/.test(transactionId)
        || !/^[a-z]{1,20}$/.test(status)) {
        return new Response('Invalid payment response', { status: 400 });
      }
      return payuCallbackPage(callbackOrigin, transactionId, status);
    }

    if (url.pathname === '/admin/payment-settings') {
      if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
      if (!env.ADMIN_USERNAME || env.ADMIN_USERNAME.length > 64
        || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12
        || env.ADMIN_PASSWORD.length > 256
        || !env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) {
        return response(503, { error: 'Payment admin is not configured' }, origin);
      }
      if (!await hasAdminSession(request, env)) {
        return response(401, { error: 'Please sign in again' }, origin);
      }
      if (request.method !== 'GET' && request.method !== 'PUT') {
        return response(405, { error: 'Use GET or PUT' }, origin);
      }
      try {
        if (request.method === 'GET') {
          const settings = await getPaymentSettings(env);
          return response(200, {
            ...settings,
            credentials: {
              razorpay: paymentGatewayConfigured(env, 'razorpay'),
              cashfree: paymentGatewayConfigured(env, 'cashfree'),
              payu: paymentGatewayConfigured(env, 'payu'),
              easebuzz: paymentGatewayConfigured(env, 'easebuzz'),
              paytmSandbox: paymentGatewayConfigured(env, 'paytm', { paytmMode: 'sandbox' }),
              paytmProduction: paymentGatewayConfigured(env, 'paytm', { paytmMode: 'production' }),
            },
          }, origin);
        }
        const input = await parseInput(request);
        if (!input || !['razorpay', 'cashfree', 'payu', 'easebuzz', 'paytm'].includes(input.activeGateway)
          || !['sandbox', 'production'].includes(input.cashfreeMode)
          || !['sandbox', 'production'].includes(input.payuMode)
          || !['sandbox', 'production'].includes(input.easebuzzMode)
          || !['sandbox', 'production'].includes(input.paytmMode)) {
          return response(400, { error: 'Invalid payment settings' }, origin);
        }
        if (!paymentGatewayConfigured(env, input.activeGateway, input)) {
          return response(400, { error: 'Add the selected gateway credentials before enabling it' }, origin);
        }
        const settings = {
          activeGateway: input.activeGateway,
          cashfreeMode: input.cashfreeMode,
          payuMode: input.payuMode,
          easebuzzMode: input.easebuzzMode,
          paytmMode: input.paytmMode,
        };
        await env.PAYMENT_SETTINGS.put('gateway-settings', JSON.stringify(settings));
        return response(200, { saved: true, ...settings }, origin);
      } catch (error) {
        console.error('Could not update payment settings', error);
        return response(503, { error: 'Payment settings could not be saved' }, origin);
      }
    }

    const checkoutLeadRoute = url.pathname === '/append-checkout-lead';
    const supportedRoutes = [
      '/create-order',
      '/verify-payment',
      '/create-calendar-event',
      '/append-checkout-lead',
      '/append-customer-details',
    ];
    if (!supportedRoutes.includes(url.pathname)) {
      return response(404, { error: 'Not found' }, origin);
    }
    if (request.method !== 'POST') return response(405, { error: 'Use POST' }, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');

    const input = await parseInput(request);
    if (!input || typeof input !== 'object') return response(400, { error: 'Invalid request' }, origin);

    if (checkoutLeadRoute) {
      const planId = String(input.plan || '');
      const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
      const contact = normalizedContact({ contact: input.mobile });
      const appointment = {
        date: String(input.appointment_date || ''),
        time: String(input.appointment_time || ''),
      };
      if (!plan || !contact || ((appointment.date || appointment.time)
        && !isValidAppointment(appointment))) {
        return response(400, { error: 'Valid mobile and booking details are required' }, origin);
      }

      ctx.waitUntil(trackMetaCheckoutLead(env, {
        phone: contact,
        page: String(input.page || ''),
        plan: String(input.selected_plan || plan.name).slice(0, 150),
      }));
      try {
        const credentials = googleServiceAccount(env);
        const accessToken = await googleAccessToken(
          credentials,
          'https://www.googleapis.com/auth/spreadsheets',
        );
        const tab = await googleSheetTab(
          accessToken,
          PRECHECKOUT_LEADS_SPREADSHEET_ID,
          'Pre-Checkout Leads',
        );
        const topics = Array.isArray(input.topics)
          ? input.topics.map(topic => String(topic).slice(0, 120)).slice(0, 12).join(', ')
          : '';
        await appendGoogleSheetRow(
          accessToken,
          PRECHECKOUT_LEADS_SPREADSHEET_ID,
          googleSheetRange(tab, 'A:I'),
          [[
            new Date().toISOString(),
            contact,
            plan.name,
            String(input.selected_plan || '').trim().slice(0, 150),
            topics,
            plan.price,
            appointment.date,
            appointment.time,
            `${String(input.position || '').slice(0, 30)} | ${String(input.page || '').slice(0, 300)}`,
          ]],
        );
        return response(200, { appended: true }, origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        console.error('Pre-checkout Google Sheets append failed', message);
        return response(502, { error: 'Could not save pre-checkout lead', diagnostic: message }, origin);
      }
    }

    if (url.pathname === '/append-customer-details') {
      if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        return response(503, { error: 'Google Sheets is not configured' }, origin);
      }
      const gateway = String(input.gateway || 'razorpay');
      if (!['razorpay', 'cashfree', 'payu', 'easebuzz', 'paytm'].includes(gateway)) {
        return response(400, { error: 'Unknown payment gateway' }, origin);
      }
      const paymentId = String(input.payment_id || '');
      const referenceId = String(input.reference_id || '');
      const name = String(input.name || '').trim().slice(0, 100);
      const contact = normalizedContact({ contact: input.mobile });
      const birthDate = String(input.birth_date || '').trim().slice(0, 30);
      const birthTime = String(input.birth_time || '').trim().slice(0, 30);
      const birthPlace = String(input.birth_place || '').trim().slice(0, 150);
      const appointment = {
        date: String(input.appointment_date || ''),
        time: String(input.appointment_time || ''),
      };
      if (!(gateway === 'cashfree'
        ? /^[A-Za-z0-9_-]{1,45}$/.test(paymentId)
        : gateway === 'payu'
          ? /^\d{1,20}$/.test(paymentId)
          : gateway === 'easebuzz'
            ? /^[A-Za-z0-9]{1,40}$/.test(paymentId)
            : gateway === 'paytm'
              ? /^[A-Za-z0-9]{1,50}$/.test(paymentId)
              : /^pay_[A-Za-z0-9]+$/.test(paymentId))
        || !referenceId || !name || !contact
        || !birthDate || !birthPlace
        || Boolean(appointment.date) !== Boolean(appointment.time)
        || ((appointment.date || appointment.time) && !isValidAppointment(appointment))) {
        return response(400, { error: 'Valid payment, customer, and booking details are required' }, origin);
      }

      let stage = `${gateway} payment verification`;
      try {
        let payment;
        let order;
        if (gateway === 'cashfree') {
          const settings = await getPaymentSettings(env);
          const verified = await verifiedCashfreeOrder(env, settings, paymentId);
          if (!verified || verified.referenceId !== referenceId) {
            return response(400, { error: 'A paid Cashfree order is required' }, origin);
          }
          payment = {
            amount: verified.amount,
            currency: verified.currency,
            status: 'captured',
            created_at: Math.floor(Date.now() / 1000),
          };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else if (gateway === 'payu') {
          const settings = await getPaymentSettings(env);
          const verified = await verifiedPayuTransaction(env, settings, referenceId);
          if (!verified || verified.paymentId !== paymentId) {
            return response(400, { error: 'A successful PayU transaction is required' }, origin);
          }
          payment = {
            amount: verified.amount,
            currency: verified.currency,
            status: 'captured',
            created_at: verified.createdAt,
          };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else if (gateway === 'easebuzz') {
          const settings = await getPaymentSettings(env);
          const verified = await verifiedEasebuzzTransaction(env, settings, referenceId);
          if (!verified || verified.paymentId !== paymentId) {
            return response(400, { error: 'A successful Easebuzz transaction is required' }, origin);
          }
          payment = {
            amount: verified.amount,
            currency: verified.currency,
            status: 'captured',
            created_at: verified.createdAt,
          };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else if (gateway === 'paytm') {
          const verified = await verifiedPaytmOrder(env, referenceId);
          if (!verified || verified.paymentId !== paymentId) {
            return response(400, { error: 'A successful Paytm transaction is required' }, origin);
          }
          payment = { amount: verified.amount, currency: verified.currency };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else {
          const paymentResult = await razorpayRequest(
            env,
            `/payments/${encodeURIComponent(paymentId)}`,
            'GET',
          );
          if (!paymentResult.ok) {
            console.error('Razorpay Sheets payment lookup failed', paymentResult.status);
            return response(502, { error: 'Could not verify payment' }, origin);
          }
          payment = paymentResult.data;
          const orderId = String(payment.order_id || '');
          if (!/^order_[A-Za-z0-9]+$/.test(orderId) || payment.status !== 'captured') {
            return response(400, { error: 'A captured payment is required' }, origin);
          }
          const orderResult = await razorpayRequest(
            env,
            `/orders/${encodeURIComponent(orderId)}`,
            'GET',
          );
          if (!orderResult.ok) {
            console.error('Razorpay Sheets order lookup failed', orderResult.status);
            return response(502, { error: 'Could not verify payment' }, origin);
          }
          order = orderResult.data;
        }
        const orderId = String(order.id || '');
        const planId = String(order.notes?.plan || '');
        const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
        const orderAppointment = {
          date: String(order.notes?.appointment_date || ''),
          time: String(order.notes?.appointment_time || ''),
        };
        const orderHasAppointment = Boolean(orderAppointment.date || orderAppointment.time);
        if (!plan || order.id !== orderId || order.receipt !== referenceId
          || (!['payu', 'easebuzz', 'paytm'].includes(gateway)
            && !referenceId.startsWith(`${planId}_`))
          || payment.currency !== 'INR' || payment.amount !== plan.price * 100
          || order.currency !== 'INR' || order.amount !== payment.amount
          || (!orderHasAppointment && planId !== 'reserve')
          || (orderHasAppointment
            && (orderAppointment.date !== appointment.date
              || orderAppointment.time !== appointment.time
              || !isValidAppointment(orderAppointment)))) {
          return response(400, { error: 'Payment does not match this booking' }, origin);
        }

        stage = 'Google service-account credentials';
        const credentials = googleServiceAccount(env);
        stage = 'Google OAuth';
        const accessToken = await googleAccessToken(
          credentials,
          'https://www.googleapis.com/auth/spreadsheets',
        );
        stage = 'Google Sheets API';
        const tab = await googleSheetTab(
          accessToken,
          CUSTOMER_BOOKINGS_SPREADSHEET_ID,
          'Customers Bookings',
        );
        const alreadyExists = await sheetContainsValue(
          accessToken,
          CUSTOMER_BOOKINGS_SPREADSHEET_ID,
          googleSheetRange(tab, 'B2:B'),
          paymentId,
        );
        if (alreadyExists) {
          ctx.waitUntil(trackMetaPaidBooking(env, {
            paymentId,
            phone: contact,
            amount: payment.amount / 100,
            plan: plan.name,
            eventTime: payment.created_at,
            page: String(input.page || ''),
          }));
          return response(200, { appended: true, already_exists: true }, origin);
        }
        const topics = Array.isArray(input.topics)
          ? input.topics.map(topic => String(topic).slice(0, 120)).slice(0, 12).join(', ')
          : '';
        const selectedPlan = String(input.selected_plan || '').trim().slice(0, 150);
        const page = String(input.page || '').slice(0, 500);
        await appendGoogleSheetRow(
          accessToken,
          CUSTOMER_BOOKINGS_SPREADSHEET_ID,
          googleSheetRange(tab, 'A:O'),
          [[
            new Date().toISOString(),
            paymentId,
            name,
            contact,
            plan.name,
            selectedPlan,
            topics,
            appointment.date,
            appointment.time,
            payment.amount / 100,
            birthDate,
            birthTime,
            birthPlace,
            referenceId,
            page,
          ]],
        );
        ctx.waitUntil(trackMetaPaidBooking(env, {
          paymentId,
          phone: contact,
          amount: payment.amount / 100,
          plan: plan.name,
          eventTime: payment.created_at,
          page: String(input.page || ''),
        }));
        return response(200, { appended: true, already_exists: false }, origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        console.error('Customer Google Sheets append failed', stage, message);
        return response(502, {
          error: 'Could not save customer booking',
          diagnostic: message.startsWith('Google Sheets API:')
            ? message
            : `${stage}: ${message}`,
        }, origin);
      }
    }

    if (url.pathname === '/create-calendar-event') {
      if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GOOGLE_CALENDAR_ID) {
        return response(503, { error: 'Google Calendar is not configured' }, origin);
      }

      const gateway = String(input.gateway || 'razorpay');
      if (!['razorpay', 'cashfree', 'payu', 'easebuzz', 'paytm'].includes(gateway)) {
        return response(400, { error: 'Unknown payment gateway' }, origin);
      }
      const paymentId = String(input.payment_id || '');
      const referenceId = String(input.reference_id || '');
      const appointment = {
        date: String(input.appointment_date || ''),
        time: String(input.appointment_time || ''),
      };
      const name = String(input.name || '').trim().slice(0, 100);
      const contact = normalizedContact({ contact: input.mobile });
      if (!(gateway === 'cashfree'
        ? /^[A-Za-z0-9_-]{1,45}$/.test(paymentId)
        : gateway === 'payu'
          ? /^\d{1,20}$/.test(paymentId)
          : gateway === 'easebuzz'
            ? /^[A-Za-z0-9]{1,40}$/.test(paymentId)
            : gateway === 'paytm'
              ? /^[A-Za-z0-9]{1,50}$/.test(paymentId)
              : /^pay_[A-Za-z0-9]+$/.test(paymentId))
        || !name || !contact
        || !referenceId || !isValidAppointment(appointment)) {
        return response(400, { error: 'Valid payment, customer, and appointment details are required' }, origin);
      }

      let stage = `${gateway} payment verification`;
      try {
        let payment;
        let order;
        if (gateway === 'cashfree') {
          const settings = await getPaymentSettings(env);
          const verified = await verifiedCashfreeOrder(env, settings, paymentId);
          if (!verified || verified.referenceId !== referenceId) {
            return response(400, { error: 'A paid Cashfree order is required' }, origin);
          }
          payment = { amount: verified.amount, currency: verified.currency };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else if (gateway === 'payu') {
          const settings = await getPaymentSettings(env);
          const verified = await verifiedPayuTransaction(env, settings, referenceId);
          if (!verified || verified.paymentId !== paymentId) {
            return response(400, { error: 'A successful PayU transaction is required' }, origin);
          }
          payment = { amount: verified.amount, currency: verified.currency };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else if (gateway === 'easebuzz') {
          const settings = await getPaymentSettings(env);
          const verified = await verifiedEasebuzzTransaction(env, settings, referenceId);
          if (!verified || verified.paymentId !== paymentId) {
            return response(400, { error: 'A successful Easebuzz transaction is required' }, origin);
          }
          payment = { amount: verified.amount, currency: verified.currency };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else if (gateway === 'paytm') {
          const verified = await verifiedPaytmOrder(env, referenceId);
          if (!verified || verified.paymentId !== paymentId) {
            return response(400, { error: 'A successful Paytm transaction is required' }, origin);
          }
          payment = {
            amount: verified.amount,
            currency: verified.currency,
            status: 'captured',
            created_at: verified.createdAt,
          };
          order = {
            id: verified.orderId,
            receipt: verified.referenceId,
            currency: verified.currency,
            amount: verified.amount,
            notes: {
              plan: verified.planId,
              appointment_date: verified.appointmentDate,
              appointment_time: verified.appointmentTime,
            },
          };
        } else {
          const paymentResult = await razorpayRequest(
            env,
            `/payments/${encodeURIComponent(paymentId)}`,
            'GET',
          );
          if (!paymentResult.ok) {
            console.error('Razorpay calendar payment lookup failed', paymentResult.status);
            return response(502, { error: 'Could not verify payment' }, origin);
          }
          payment = paymentResult.data;
          const orderId = String(payment.order_id || '');
          if (!/^order_[A-Za-z0-9]+$/.test(orderId) || payment.status !== 'captured') {
            return response(400, { error: 'A captured payment is required' }, origin);
          }
          const orderResult = await razorpayRequest(
            env,
            `/orders/${encodeURIComponent(orderId)}`,
            'GET',
          );
          if (!orderResult.ok) {
            console.error('Razorpay calendar order lookup failed', orderResult.status);
            return response(502, { error: 'Could not verify payment' }, origin);
          }
          order = orderResult.data;
        }
        const orderId = String(order.id || '');
        const planId = String(order.notes?.plan || '');
        const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
        const orderDate = String(order.notes?.appointment_date || '');
        const orderTime = String(order.notes?.appointment_time || '');
        if (!plan || order.id !== orderId || order.receipt !== referenceId
          || (!['payu', 'easebuzz', 'paytm'].includes(gateway)
            && !referenceId.startsWith(`${planId}_`))
          || payment.currency !== 'INR' || payment.amount !== plan.price * 100
          || order.currency !== 'INR' || order.amount !== payment.amount
          || ((orderDate || orderTime) && (appointment.date !== orderDate || appointment.time !== orderTime))) {
          return response(400, { error: 'Payment does not match this booking' }, origin);
        }

        const credentials = googleServiceAccount(env);
        stage = 'Google OAuth';
        const accessToken = await googleAccessToken(credentials);
        const [startTime, endTime] = appointmentTimes(appointment.time);
        const topics = Array.isArray(input.topics)
          ? input.topics.map(topic => String(topic).slice(0, 120)).slice(0, 12)
          : [];
        const birthDate = String(input.birth_date || '').trim().slice(0, 30);
        const birthTime = String(input.birth_time || '').trim().slice(0, 30);
        const birthPlace = String(input.birth_place || '').trim().slice(0, 150);
        const description = [
          `Customer: ${name}`,
          `Mobile: ${contact}`,
          `Date of birth: ${birthDate || 'Not provided'}`,
          `Birth time: ${birthTime || 'Not provided'}`,
          `Birth place: ${birthPlace || 'Not provided'}`,
          `Plan: ${plan.name}`,
          input.selected_plan ? `Selected analysis: ${String(input.selected_plan).slice(0, 150)}` : '',
          topics.length ? `Topics: ${topics.join(', ')}` : '',
          `Appointment: ${appointment.date}, ${appointment.time} IST`,
          `Amount paid: ₹${(payment.amount / 100).toLocaleString('en-IN')}`,
          `Payment ID: ${paymentId}`,
          `Payment reference: ${referenceId}`,
        ].join('\n');
        const event = {
          id: await eventIdForPayment(paymentId),
          summary: `ASTROJAK Consultation – ${name}`,
          description,
          start: { dateTime: `${appointment.date}T${startTime}:00`, timeZone: 'Asia/Kolkata' },
          end: { dateTime: `${appointment.date}T${endTime}:00`, timeZone: 'Asia/Kolkata' },
        };
        const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`;
        stage = 'Google Calendar API';
        const calendarResult = await fetch(calendarUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        if (calendarResult.status === 409) {
          const updateUrl = `${calendarUrl}/${encodeURIComponent(event.id)}`;
          const updateResult = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              Authorization: 'Bearer ' + accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          });
          if (!updateResult.ok) {
            const failure = await updateResult.json().catch(() => ({}));
            const googleError = failure.error && typeof failure.error === 'object' ? failure.error : {};
            const reason = typeof googleError.status === 'string'
              && /^[a-z0-9_-]+$/i.test(googleError.status)
              ? googleError.status
              : `HTTP_${updateResult.status}`;
            const message = typeof googleError.message === 'string'
              ? googleError.message.replace(/[\r\n]+/g, ' ').slice(0, 180)
              : '';
            return response(502, {
              error: 'Could not update Calendar event',
              diagnostic: `Google Calendar API: ${reason} (HTTP ${updateResult.status})${message ? ` — ${message}` : ''}`,
            }, origin);
          }
          return response(200, { created: true, already_exists: true, updated: true }, origin);
        }
        if (!calendarResult.ok) {
          const failure = await calendarResult.json().catch(() => ({}));
          const googleError = failure.error && typeof failure.error === 'object' ? failure.error : {};
          const googleReason = Array.isArray(googleError.errors)
            ? googleError.errors.find(item => item && typeof item.reason === 'string')?.reason
            : '';
          const reason = [googleReason, googleError.status]
            .find(value => typeof value === 'string' && /^[a-z0-9_-]+$/i.test(value))
            || `HTTP_${calendarResult.status}`;
          const message = typeof googleError.message === 'string'
            ? googleError.message.replace(/[\r\n]+/g, ' ').slice(0, 180)
            : '';
          const diagnostic = `Google Calendar API: ${reason} (HTTP ${calendarResult.status})${message ? ` — ${message}` : ''}`;
          console.error('Google Calendar event creation failed', calendarResult.status, reason, message);
          return response(502, {
            error: 'Could not create Calendar event',
            diagnostic,
          }, origin);
        }
        return response(200, { created: true, already_exists: false }, origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        console.error('Google Calendar event creation failed', stage, message);
        return response(502, {
          error: 'Could not create Calendar event',
          diagnostic: `${stage}: ${message}`,
        }, origin);
      }
    }

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
      let settings;
      try {
        settings = await getPaymentSettings(env);
      } catch (error) {
        console.error('Could not read payment settings', error);
        return response(503, { error: 'Payment settings are unavailable' }, origin);
      }
      const gateway = settings.activeGateway;
      if (!paymentGatewayConfigured(env, gateway, settings)) {
        return response(503, { error: 'Selected payment gateway is not configured' }, origin);
      }
      try {
        if (gateway === 'paytm') {
          const credentials = paytmCredentials(env, settings.paytmMode);
          const orderId = `PTM${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
          const orderMetadata = {
            mode: settings.paytmMode,
            mid: credentials.mid,
            planId,
            amount: plan.price * 100,
            appointmentDate: isValidAppointment(appointment) ? String(appointment.date) : '',
            appointmentTime: isValidAppointment(appointment) ? String(appointment.time) : '',
          };
          await env.PAYMENT_SETTINGS.put(
            `paytm-order:${orderId}`,
            JSON.stringify(orderMetadata),
            { expirationTtl: 60 * 60 * 24 * 90 },
          );
          const requestBody = {
            requestType: 'Payment',
            mid: credentials.mid,
            websiteName: settings.paytmMode === 'sandbox' ? 'WEBSTAGING' : 'DEFAULT',
            orderId,
            txnAmount: { value: plan.price.toFixed(2), currency: 'INR' },
            userInfo: {
              custId: `C${contact.slice(-10)}`,
              mobile: contact.slice(-10),
            },
          };
          const result = await paytmRequest(
            paytmBaseUrl(settings.paytmMode),
            `/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(credentials.mid)}&orderId=${encodeURIComponent(orderId)}`,
            requestBody,
            credentials.merchantKey,
          );
          const token = result.data.body?.txnToken;
          if (!result.ok || typeof token !== 'string' || !token) {
            await env.PAYMENT_SETTINGS.delete(`paytm-order:${orderId}`);
            const code = !result.httpOk
              ? 'PAYTM_HTTP_ERROR'
              : !result.signatureValid
                ? 'PAYTM_RESPONSE_SIGNATURE_INVALID'
                : 'PAYTM_TOKEN_MISSING';
            console.error('Paytm payment initiation failed', {
              status: result.status,
              code,
              resultCode: String(result.data.body?.resultInfo?.resultCode || '').slice(0, 64),
              resultStatus: String(result.data.body?.resultInfo?.resultStatus || '').slice(0, 32),
            });
            return response(502, {
              error: `Paytm ${settings.paytmMode === 'sandbox' ? 'staging' : 'production'} checkout could not start. Check that the selected environment matches your MID and Merchant Key.`,
              code,
            }, origin);
          }
          return response(200, {
            gateway,
            order_id: orderId,
            txn_token: token,
            mid: credentials.mid,
            amount: plan.price.toFixed(2),
            paytm_mode: settings.paytmMode,
          }, origin);
        }
        if (gateway === 'payu') {
          const email = String(input.customer?.email || '').trim().slice(0, 254);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return response(400, { error: 'A valid email address is required for PayU checkout' }, origin);
          }
          const txnid = `${PAYU_PLAN_PREFIXES[planId]}${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
          const amount = plan.price.toFixed(2);
          const productinfo = `ASTROJAK ${plan.name}`;
          const firstname = String(input.customer?.name || 'ASTROJAK Customer').trim().slice(0, 60) || 'Customer';
          const udf1 = planId;
          const udf2 = isValidAppointment(appointment) ? String(appointment.date) : '';
          const udf3 = isValidAppointment(appointment) ? String(appointment.time) : '';
          const callbackUrl = `https://api.astrojak.in/payu-callback?origin=${encodeURIComponent(origin)}`;
          const fields = {
            key: env.PAYU_MERCHANT_KEY,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            phone: contact.slice(-10),
            surl: callbackUrl,
            furl: callbackUrl,
            udf1,
            udf2,
            udf3,
          };
          fields.hash = await sha512([
            fields.key,
            fields.txnid,
            fields.amount,
            fields.productinfo,
            fields.firstname,
            fields.email,
            fields.udf1,
            fields.udf2,
            fields.udf3,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            env.PAYU_MERCHANT_SALT,
          ].join('|'));
          return response(200, {
            gateway,
            txnid,
            action_url: `${payuBaseUrl(settings)}/_payment`,
            fields,
          }, origin);
        }
        if (gateway === 'easebuzz') {
          const email = String(input.customer?.email || '').trim();
          if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return response(400, { error: 'A valid email address is required for Easebuzz checkout' }, origin);
          }
          const txnid = `e${PAYU_PLAN_PREFIXES[planId]}${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
          const amount = plan.price.toFixed(2);
          const productinfo = `ASTROJAK ${plan.name}`;
          const rawName = String(input.customer?.name || 'ASTROJAK Customer').trim();
          const firstname = rawName.replace(/[^a-zA-Z0-9&\-._ ()\/,@]/g, ' ').trim().slice(0, 150)
            || 'ASTROJAK Customer';
          const udf1 = planId;
          const udf2 = isValidAppointment(appointment) ? String(appointment.date) : '';
          const udf3 = isValidAppointment(appointment)
            ? String(SLOT_LABELS.indexOf(String(appointment.time)) + 1)
            : '';
          const returnUrl = `https://www.astrojak.in/thank-you.html?gateway=easebuzz&txnid=${encodeURIComponent(txnid)}`;
          const fields = {
            key: env.EASEBUZZ_KEY,
            txnid,
            amount,
            productinfo,
            firstname,
            phone: contact.slice(-10),
            email,
            surl: returnUrl,
            furl: returnUrl,
            udf1,
            udf2,
            udf3,
          };
          for (let index = 4; index <= 10; index += 1) fields[`udf${index}`] = '';
          fields.hash = await sha512([
            fields.key,
            fields.txnid,
            fields.amount,
            fields.productinfo,
            fields.firstname,
            fields.email,
            fields.udf1,
            fields.udf2,
            fields.udf3,
            fields.udf4,
            fields.udf5,
            fields.udf6,
            fields.udf7,
            fields.udf8,
            fields.udf9,
            fields.udf10,
            env.EASEBUZZ_SALT,
          ].join('|'));
          const result = await easebuzzRequest(
            `${easebuzzBaseUrl(settings)}/payment/initiateLink`,
            fields,
          );
          if (!result.ok || result.data.status !== 1 || typeof result.data.data !== 'string'
            || !/^[A-Za-z0-9_-]{1,100}$/.test(result.data.data)) {
            return paymentOrderFailure('Easebuzz', result.status, result.data, origin);
          }
          return response(200, {
            gateway,
            txnid,
            access_key: result.data.data,
            merchant_key: env.EASEBUZZ_KEY,
            easebuzz_mode: settings.easebuzzMode === 'sandbox' ? 'test' : 'prod',
          }, origin);
        }
        if (gateway === 'cashfree') {
          const cashfreeOrder = {
            mode: settings.cashfreeMode,
            planId,
            amount: plan.price,
            appointmentDate: validAppointment ? String(appointment.date) : '',
            appointmentTime: validAppointment ? String(appointment.time) : '',
          };
          await env.PAYMENT_SETTINGS.put(
            `cashfree-order:${reference}`,
            JSON.stringify(cashfreeOrder),
            { expirationTtl: 60 * 60 * 24 * 90 },
          );
          const result = await cashfreeRequest(env, settings, '/orders', 'POST', {
            order_id: reference,
            order_amount: plan.price,
            order_currency: 'INR',
            customer_details: {
              customer_id: reference.slice(0, 50),
              customer_name: String(input.customer?.name || 'ASTROJAK Customer').slice(0, 100),
              customer_phone: contact.slice(-10),
            },
            order_meta: {
              return_url: `https://www.astrojak.in/thank-you.html?gateway=cashfree&order_id=${encodeURIComponent(reference)}`,
            },
            order_note: `ASTROJAK ${plan.name}`,
          });
          if (!result.ok || !result.data.payment_session_id || result.data.order_id !== reference) {
            return paymentOrderFailure('Cashfree', result.status, result.data, origin);
          }
          return response(200, {
            gateway,
            cashfree_mode: settings.cashfreeMode,
            payment_session_id: result.data.payment_session_id,
            order_id: result.data.order_id,
            amount: plan.price * 100,
            currency: 'INR',
            ref: reference,
          }, origin);
        }
        const result = await razorpayRequest(env, '/orders', 'POST', {
          amount: plan.price * 100,
          currency: 'INR',
          receipt: reference,
          notes: orderNotes(input, planId, contact, appointment),
        });
        if (!result.ok || !result.data.id) {
          return paymentOrderFailure('Razorpay', result.status, result.data, origin);
        }
        return response(200, {
          gateway,
          key_id: env.RAZORPAY_KEY_ID,
          order_id: result.data.id,
          amount: result.data.amount,
          currency: result.data.currency,
          ref: reference,
        }, origin);
      } catch (error) {
        console.error('Payment-order request failed', {
          gateway,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        return response(502, {
          error: 'Could not create payment order',
          code: 'PAYMENT_GATEWAY_REQUEST_FAILED',
          diagnostic: `The ${gateway} order request could not be completed. Please retry.`,
        }, origin);
      }
    }

    if (input.gateway === 'cashfree') {
      if (!paymentGatewayConfigured(env, 'cashfree')) {
        return response(503, { error: 'Cashfree is not configured' }, origin);
      }
      try {
        const settings = await getPaymentSettings(env);
        const orderId = String(input.order_id || '');
        const verified = await verifiedCashfreeOrder(env, settings, orderId);
        if (!verified) return response(409, { error: 'Cashfree payment is not confirmed as paid' }, origin);
        return response(200, {
          verified: true,
          payment_id: verified.paymentId,
          order_id: verified.orderId,
          reference_id: verified.referenceId,
          plan: verified.planId,
          appointment_date: verified.appointmentDate,
          appointment_time: verified.appointmentTime,
        }, origin);
      } catch (error) {
        console.error('Cashfree payment verification failed', error);
        return response(502, { error: 'Could not verify payment' }, origin);
      }
    }

    if (input.gateway === 'payu') {
      if (!paymentGatewayConfigured(env, 'payu')) {
        return response(503, { error: 'PayU is not configured' }, origin);
      }
      try {
        const settings = await getPaymentSettings(env);
        const transactionId = String(input.txnid || '');
        const verified = await verifiedPayuTransaction(env, settings, transactionId);
        if (!verified) return response(409, { error: 'PayU payment is not confirmed as successful' }, origin);
        return response(200, {
          verified: true,
          payment_id: verified.paymentId,
          order_id: verified.orderId,
          reference_id: verified.referenceId,
          plan: verified.planId,
          appointment_date: verified.appointmentDate,
          appointment_time: verified.appointmentTime,
        }, origin);
      } catch (error) {
        console.error('PayU payment verification failed', error);
        return response(502, { error: 'Could not verify payment' }, origin);
      }
    }

    if (input.gateway === 'easebuzz') {
      if (!paymentGatewayConfigured(env, 'easebuzz')) {
        return response(503, { error: 'Easebuzz is not configured' }, origin);
      }
      try {
        const settings = await getPaymentSettings(env);
        const transactionId = String(input.txnid || '');
        const verified = await verifiedEasebuzzTransaction(env, settings, transactionId);
        if (!verified) return response(409, { error: 'Easebuzz payment is not confirmed as successful' }, origin);
        return response(200, {
          verified: true,
          payment_id: verified.paymentId,
          order_id: verified.orderId,
          reference_id: verified.referenceId,
          plan: verified.planId,
          appointment_date: verified.appointmentDate,
          appointment_time: verified.appointmentTime,
        }, origin);
      } catch (error) {
        console.error('Easebuzz payment verification failed', error);
        return response(502, { error: 'Could not verify payment' }, origin);
      }
    }

    if (input.gateway === 'paytm') {
      try {
        const orderId = String(input.order_id || '');
        const verified = await verifiedPaytmOrder(env, orderId);
        if (!verified) return response(409, { error: 'Paytm payment is not confirmed as successful' }, origin);
        return response(200, {
          verified: true,
          payment_id: verified.paymentId,
          order_id: verified.orderId,
          reference_id: verified.referenceId,
          plan: verified.planId,
          appointment_date: verified.appointmentDate,
          appointment_time: verified.appointmentTime,
        }, origin);
      } catch (error) {
        console.error('Paytm payment verification failed', error);
        return response(502, { error: 'Could not verify payment' }, origin);
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
