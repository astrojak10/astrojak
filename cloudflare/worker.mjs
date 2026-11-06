import PRICING from '../pricing.js';

const ALLOWED_ORIGINS = new Set([
  'https://www.astrojak.in',
  'https://astrojak.in',
  'http://localhost:8765',
]);

const PLANS = PRICING.plans;
const PRECHECKOUT_LEADS_SPREADSHEET_ID = '10dAPMDIUQQVKuhYj8uww9atBGbdOSATJ_0AoxawN22g';
const CUSTOMER_BOOKINGS_SPREADSHEET_ID = '1Ecr2oISzV7vJY5CJyu9QNyd-E1TxaENOcbns31X3fOk';
const ZOHO_DATA_CENTERS = {
  com: { accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com' },
  eu: { accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu' },
  in: { accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in' },
  'com.au': { accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au' },
  jp: { accounts: 'https://accounts.zoho.jp', api: 'https://www.zohoapis.jp' },
  ca: { accounts: 'https://accounts.zohocloud.ca', api: 'https://www.zohoapis.ca' },
  'com.cn': { accounts: 'https://accounts.zoho.com.cn', api: 'https://www.zohoapis.com.cn' },
};

let zohoTokenCache = null;

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

async function zohoAccessToken(env) {
  const region = String(env.ZOHO_REGION || '').trim().toLowerCase();
  const dataCenter = ZOHO_DATA_CENTERS[region];
  if (!dataCenter || !env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REFRESH_TOKEN) {
    throw new Error('Zoho CRM is not configured; check ZOHO_REGION and OAuth secrets');
  }
  if (zohoTokenCache?.region === region && zohoTokenCache.expiresAt > Date.now() + 60_000) {
    return zohoTokenCache.accessToken;
  }
  const result = await fetch(`${dataCenter.accounts}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      refresh_token: env.ZOHO_REFRESH_TOKEN,
    }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.access_token) {
    const reason = typeof data.error === 'string' && /^[a-z0-9_-]+$/i.test(data.error)
      ? data.error
      : `HTTP_${result.status}`;
    throw new Error(`Zoho OAuth rejected the refresh token (${reason})`);
  }
  const expiresIn = Number(data.expires_in) || 3600;
  zohoTokenCache = {
    region,
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return data.access_token;
}

async function upsertZohoLead(env, lead) {
  const dataCenter = ZOHO_DATA_CENTERS[String(env.ZOHO_REGION || '').trim().toLowerCase()];
  if (!dataCenter) throw new Error('Zoho CRM region is not configured');

  const name = String(lead.name || '').trim().slice(0, 100);
  const phone = String(lead.phone || '').trim().slice(0, 30);
  const email = String(lead.email || '').trim().slice(0, 120);
  const description = String(lead.description || '').trim().slice(0, 3000);
  const page = String(lead.page || '').trim().slice(0, 500);
  if (!phone && !email) {
    throw new Error('At least one contact method is required for Zoho CRM');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required for Zoho CRM');
  }

  const record = {
    Last_Name: name || `Website lead ${phone}`,
    Company: 'Individual',
    Lead_Source: 'Website',
    Description: [description, page ? `Website page: ${page}` : ''].filter(Boolean).join('\n').slice(0, 3200),
  };
  if (phone) {
    record.Phone = phone;
    record.Mobile = phone;
  }
  if (email) record.Email = email;
  const duplicateFields = [];
  if (email) duplicateFields.push('Email');
  if (phone) duplicateFields.push('Phone');

  const accessToken = await zohoAccessToken(env);
  const result = await fetch(`${dataCenter.api}/crm/v8/Leads/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [record],
      duplicate_check_fields: duplicateFields,
    }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const code = Array.isArray(data.data) && typeof data.data[0]?.code === 'string'
      ? data.data[0].code
      : `HTTP_${result.status}`;
    const message = Array.isArray(data.data) && typeof data.data[0]?.message === 'string'
      ? data.data[0].message.replace(/[\r\n]+/g, ' ').slice(0, 200)
      : '';
    throw new Error(`Zoho CRM rejected the lead (${code})${message ? `: ${message}` : ''}`);
  }
  const leadResult = data.data?.[0];
  if (leadResult?.status !== 'success') {
    const code = leadResult?.code || 'UNKNOWN';
    const message = typeof leadResult?.message === 'string'
      ? leadResult.message.replace(/[\r\n]+/g, ' ').slice(0, 200)
      : '';
    throw new Error(`Zoho CRM did not accept the lead (${code})${message ? `: ${message}` : ''}`);
  }
  return {
    id: String(leadResult.details?.id || ''),
    action: String(leadResult.action || 'upsert'),
  };
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

    const checkoutLeadRoute = url.pathname === '/append-checkout-lead';
    const zohoLeadRoute = url.pathname === '/zoho-lead';
    const supportedRoutes = [
      '/create-order',
      '/verify-payment',
      '/create-calendar-event',
      '/append-checkout-lead',
      '/append-customer-details',
      '/zoho-lead',
    ];
    if (!supportedRoutes.includes(url.pathname)) {
      return response(404, { error: 'Not found' }, origin);
    }
    if (request.method !== 'POST') return response(405, { error: 'Use POST' }, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return response(403, { error: 'Origin not allowed' }, '');
    if (!checkoutLeadRoute && !zohoLeadRoute && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)) {
      return response(503, { error: 'Payment is not configured' }, origin);
    }

    const input = await parseInput(request);
    if (!input || typeof input !== 'object') return response(400, { error: 'Invalid request' }, origin);

    if (zohoLeadRoute) {
      try {
        const result = await upsertZohoLead(env, input);
        return response(200, { success: true, id: result.id, action: result.action }, origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        console.error('Zoho CRM lead upsert failed', message);
        return response(502, { error: 'Could not save lead to Zoho CRM', diagnostic: message }, origin);
      }
    }

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
      if (!/^pay_[A-Za-z0-9]+$/.test(paymentId) || !referenceId || !name || !contact
        || !birthDate || !birthPlace
        || Boolean(appointment.date) !== Boolean(appointment.time)
        || ((appointment.date || appointment.time) && !isValidAppointment(appointment))) {
        return response(400, { error: 'Valid payment, customer, and booking details are required' }, origin);
      }

      let stage = 'Razorpay payment verification';
      try {
        const paymentResult = await razorpayRequest(
          env,
          `/payments/${encodeURIComponent(paymentId)}`,
          'GET',
        );
        if (!paymentResult.ok) {
          console.error('Razorpay Sheets payment lookup failed', paymentResult.status);
          return response(502, { error: 'Could not verify payment' }, origin);
        }
        const payment = paymentResult.data;
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
        const order = orderResult.data;
        const planId = String(order.notes?.plan || '');
        const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
        const orderAppointment = {
          date: String(order.notes?.appointment_date || ''),
          time: String(order.notes?.appointment_time || ''),
        };
        const orderHasAppointment = Boolean(orderAppointment.date || orderAppointment.time);
        if (!plan || order.id !== orderId || order.receipt !== referenceId
          || !referenceId.startsWith(`${planId}_`)
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

      const paymentId = String(input.payment_id || '');
      const referenceId = String(input.reference_id || '');
      const appointment = {
        date: String(input.appointment_date || ''),
        time: String(input.appointment_time || ''),
      };
      const name = String(input.name || '').trim().slice(0, 100);
      const contact = normalizedContact({ contact: input.mobile });
      if (!/^pay_[A-Za-z0-9]+$/.test(paymentId) || !name || !contact
        || !referenceId || !isValidAppointment(appointment)) {
        return response(400, { error: 'Valid payment, customer, and appointment details are required' }, origin);
      }

      let stage = 'Google service-account credentials';
      try {
        const paymentResult = await razorpayRequest(
          env,
          `/payments/${encodeURIComponent(paymentId)}`,
          'GET',
        );
        if (!paymentResult.ok) {
          console.error('Razorpay calendar payment lookup failed', paymentResult.status);
          return response(502, { error: 'Could not verify payment' }, origin);
        }
        const payment = paymentResult.data;
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
        const order = orderResult.data;
        const planId = String(order.notes?.plan || '');
        const plan = Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
        const orderDate = String(order.notes?.appointment_date || '');
        const orderTime = String(order.notes?.appointment_time || '');
        if (!plan || order.id !== orderId || order.receipt !== referenceId
          || !referenceId.startsWith(`${planId}_`)
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
