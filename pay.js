/* ASTROJAK shared payment + price code. Needs pricing.js loaded first.
   - fills every [data-price="plan-id"] with the price from pricing.js
   - any element with data-pay="plan-id" becomes a Pay button: it asks the server
     (Netlify function) for a fresh Razorpay link and opens it. If that fails, the
     visitor is sent to WhatsApp instead. */
(function () {
  var PR = window.PRICING; if (!PR) return;
  var WA = '917827673637', API = '/.netlify/functions/create-payment-link';
  function money(id) { var p = PR.plans[id]; return p ? PR.symbol + p.price : ''; }
  function waLink(id) {
    var p = PR.plans[id]; if (!p) return '#';
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Hi! I want to ' + (id === 'reserve' ? 'reserve my slot' : 'book ' + p.name) + ' for ' + money(id) + '.');
  }
  window.fmtPrice = money;
  function fill() {
    [].forEach.call(document.querySelectorAll('[data-price]'), function (e) { var t = money(e.getAttribute('data-price')); if (t) e.textContent = t; });
    [].forEach.call(document.querySelectorAll('a[data-pay]'), function (a) { var id = a.getAttribute('data-pay'); if (PR.plans[id]) a.href = waLink(id); });
  }
  window.applyPrices = fill;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();

  var css = '.paybtn{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;cursor:pointer;font:inherit;font-weight:800;font-size:16px;line-height:1.2;color:#3D2600;background:linear-gradient(135deg,#F8B700,#FF9800);padding:15px 16px;border-radius:14px;box-shadow:0 8px 20px rgba(255,111,0,.28);white-space:nowrap;transition:transform .15s,box-shadow .15s}'
    + '.paybtn::before{content:"\\1F512";font-size:14px}'
    + '.paybtn::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);animation:payshine 3.4s infinite}'
    + '@keyframes payshine{0%{left:-60%}60%,100%{left:130%}}'
    + '.paybtn:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(255,111,0,.34)}.paybtn:active{transform:translateY(1px)}'
    + '.paybtn.busy,.rsv.busy{opacity:.75;pointer-events:none}.paybtn.busy::before{content:""}'
    + '.paynote{margin-top:8px;text-align:center;font-size:12.5px;color:#6b6b6b}'
    + '.plan-pay .paybtn{position:relative!important}'
    + '.pm-ov{position:fixed;inset:0;z-index:9999;background:rgba(20,14,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:0}'
    + '.pm{width:100%;max-width:480px;background:#fff;color:#1A1A1A;border-radius:22px 22px 0 0;padding:22px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -12px 40px rgba(0,0,0,.25);animation:pmup .25s ease;max-height:92vh;overflow:auto}'
    + '@keyframes pmup{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}'
    + '@media(min-width:600px){.pm-ov{align-items:center}.pm{border-radius:22px}}'
    + '.pm h3{font-size:21px;margin-bottom:4px}.pm p{font-size:14px;color:#5C5C5C;margin-bottom:6px}'
    + '.pm label{display:block;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#7A5A12;margin:12px 0 6px}.pm label span{text-transform:none;font-weight:500;letter-spacing:0}'
    + '.pm input{width:100%;font:inherit;font-size:16px;padding:13px 12px;border:1.5px solid #F2E4C4;border-radius:12px;background:#FFFDF7;color:#1A1A1A}.pm input:focus{outline:2px solid #F8B700;outline-offset:1px}'
    + '.pm-err{color:#C62828!important;font-weight:600;margin-top:8px!important}'
    + '.pm .paybtn{margin-top:16px}.pm-x{display:block;width:100%;margin-top:8px;padding:12px;border:0;background:none;font:inherit;font-size:14px;font-weight:700;color:#6b6b6b;cursor:pointer}'
    + '@media (prefers-reduced-motion:reduce){.paybtn::after{animation:none;display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function reset(b) { if (b.__label != null) { b.innerHTML = b.__label; b.__label = null; } b.__busy = 0; b.classList.remove('busy'); }
  window.addEventListener('pageshow', function () { [].forEach.call(document.querySelectorAll('[data-pay]'), reset); });

  var LEAD = 'https://formspree.io/f/moejvjbn';
  var ov = null;
  function digits10(v) { var d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
  function validPhone(v) { return /^[6-9]\d{9}$/.test(digits10(v)); }
  function saved() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem('astrojak_cust') || '{}') || {}; } catch (_) {}
    try { var m = document.cookie.match(/(?:^|; )astrojak_form=([^;]*)/); if (m) { var f = (JSON.parse(decodeURIComponent(m[1])) || {}).f || {}; o.name = o.name || f.name; o.phone = o.phone || f.phone; o.email = o.email || f.email; } } catch (_) {}
    return o;
  }
  function closeModal() { if (ov) { ov.remove(); ov = null; } }
  function openModal(id, p, pre, done) {
    var s = saved();
    ov = document.createElement('div'); ov.className = 'pm-ov';
    ov.innerHTML = '<div class="pm" role="dialog" aria-modal="true" aria-label="Your details"><h3>Almost there!</h3><p>Enter your details so we can reach you about your booking' + (id === 'reserve' ? ' and send your PDF report' : '') + '.</p>'
      + '<label>Your name</label><input id="pmN" type="text" autocomplete="name" placeholder="Full name">'
      + '<label>Mobile / WhatsApp number</label><input id="pmP" type="tel" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number">'
      + '<label>Email <span>(optional)</span></label><input id="pmE" type="email" autocomplete="email" placeholder="you@example.com">'
      + '<p class="pm-err" id="pmX" hidden></p>'
      + '<button type="button" class="paybtn" id="pmGo">Continue to Pay ' + money(id) + ' →</button>'
      + '<button type="button" class="pm-x" id="pmC">Cancel</button></div>';
    document.body.appendChild(ov);
    var g = function (i) { return document.getElementById(i); };
    g('pmN').value = pre.name || s.name || ''; g('pmP').value = pre.contact || s.phone || ''; g('pmE').value = pre.email || s.email || '';
    g('pmC').onclick = closeModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    g('pmGo').onclick = function () {
      var n = g('pmN').value.trim(), ph = g('pmP').value, em = g('pmE').value.trim(), x = g('pmX'); x.hidden = true;
      if (n.length < 2) { x.textContent = 'Please enter your name.'; x.hidden = false; return; }
      if (!validPhone(ph)) { x.textContent = 'Please enter a valid 10-digit mobile number.'; x.hidden = false; return; }
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { x.textContent = 'That email does not look right.'; x.hidden = false; return; }
      try { localStorage.setItem('astrojak_cust', JSON.stringify({ name: n, phone: digits10(ph), email: em })); } catch (_) {}
      closeModal(); done({ name: n, contact: digits10(ph), email: em }, true);
    };
    setTimeout(function () { g('pmN').focus(); }, 50);
  }
  function lead(id, p, c, ref, pos) {
    try {
      var fd = new FormData();
      fd.append('_subject', 'ASTROJAK payment started: ' + p.name + ' (' + money(id) + ')');
      fd.append('status', 'Payment link opened (check Razorpay for paid status)'); fd.append('plan', p.name); fd.append('amount', money(id));
      fd.append('name', c.name || ''); fd.append('phone', c.contact || ''); if (c.email) fd.append('email', c.email);
      fd.append('reference_id', ref || ''); fd.append('button', pos || ''); fd.append('page', location.href);
      fetch(LEAD, { method: 'POST', headers: { Accept: 'application/json' }, body: fd, keepalive: true }).catch(function () {});
    } catch (_) {}
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pay]'); if (!b) return;
    e.preventDefault();
    if (b.__busy) return;
    var id = b.getAttribute('data-pay');
    if (id === 'selected') { var s = document.getElementById('plan'); id = s ? s.value : ''; }
    var p = PR.plans[id]; if (!p) return;
    var hook = window.PAY_HOOK || {};
    var cust = {}; try { cust = (hook.customer && hook.customer()) || {}; } catch (_) {}
    function go(c, fromModal) {
      try { if (hook.before) hook.before(id); } catch (_) {}
      if (window.gtag) gtag('event', 'begin_checkout', { currency: 'INR', value: p.price, items: [{ item_id: id, item_name: p.name, price: p.price }], position: b.getAttribute('data-pos') || '' });
      var body = { plan: id, position: b.getAttribute('data-pos') || '', source: location.pathname, customer: c };
      b.__busy = 1; b.__label = b.innerHTML; b.classList.add('busy'); b.textContent = 'Opening secure payment…';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.url) throw new Error('no link'); return j; }); })
        .then(function (j) { if (fromModal) lead(id, p, c, j.ref, b.getAttribute('data-pos')); setTimeout(function () { location.href = j.url; }, fromModal ? 250 : 0); })
        .catch(function () { reset(b); location.href = waLink(id); });
    }
    if (validPhone(cust.contact)) go(cust, false); else openModal(id, p, cust, go);
  });
})();
