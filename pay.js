/* ASTROJAK shared payment + price code. Needs pricing.js loaded first.
   - fills every [data-price="plan-id"] with the price from pricing.js
   - any element with data-pay="plan-id" becomes a Pay button: it asks the server
     (Netlify function) for a fresh Razorpay link and opens it. */
(function () {
  var PR = window.PRICING; if (!PR) return;
  var API = 'https://api.astrojak.in/create-payment-link';
  function money(id) { var p = PR.plans[id]; return p ? PR.symbol + p.price : ''; }
  function discount(id) {
    var p = PR.plans[id];
    return p && p.listPrice > p.price ? Math.round((p.listPrice - p.price) / p.listPrice * 100) : 0;
  }
  window.fmtPrice = money;
  function fill() {
    [].forEach.call(document.querySelectorAll('[data-price]'), function (e) { var t = money(e.getAttribute('data-price')); if (t) e.textContent = t; });
    [].forEach.call(document.querySelectorAll('[data-list-price]'), function (e) {
      var p = PR.plans[e.getAttribute('data-list-price')];
      if (p && p.listPrice) e.textContent = PR.symbol + p.listPrice;
    });
    [].forEach.call(document.querySelectorAll('[data-discount]'), function (e) {
      var percent = discount(e.getAttribute('data-discount'));
      if (percent) e.textContent = percent + '% OFF';
    });
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
  function saved() { try { return JSON.parse(localStorage.getItem('astrojak_cust') || '{}') || {}; } catch (_) { return {}; } }
  function words() {
    var lang = window.ASTROJAK_LANGUAGE || 'en';
    var copy = {
      en: ['Enter your mobile number', 'We will use this number for your booking and WhatsApp updates.', 'Mobile / WhatsApp number', '10-digit mobile number', 'Please enter a valid 10-digit mobile number.', 'Continue to Pay', 'Cancel'],
      hing: ['Apna mobile number darj karein', 'Booking aur WhatsApp updates ke liye is number ka use hoga.', 'Mobile / WhatsApp number', '10-digit mobile number', 'Sahi 10-digit mobile number darj karein.', 'Payment ke liye aage badhein', 'Cancel'],
      hi: ['अपना मोबाइल नंबर दर्ज करें', 'बुकिंग और WhatsApp अपडेट के लिए इस नंबर का उपयोग होगा।', 'मोबाइल / WhatsApp नंबर', '10 अंकों का मोबाइल नंबर', 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।', 'भुगतान के लिए आगे बढ़ें', 'रद्द करें']
    };
    return copy[lang] || copy.en;
  }
  function closeModal() { if (ov) { ov.remove(); ov = null; } }
  function openModal(id, p, pre, done) {
    var s = saved(), w = words();
    ov = document.createElement('div'); ov.className = 'pm-ov';
    ov.innerHTML = '<div class="pm" role="dialog" aria-modal="true" aria-label="' + w[0] + '"><h3>' + w[0] + '</h3><p>' + w[1] + '</p>'
      + '<label>' + w[2] + '</label><input id="pmP" type="tel" inputmode="tel" autocomplete="tel" placeholder="' + w[3] + '">'
      + '<p class="pm-err" id="pmX" hidden></p>'
      + '<button type="button" class="paybtn" id="pmGo">' + w[5] + ' ' + money(id) + ' →</button>'
      + '<button type="button" class="pm-x" id="pmC">' + w[6] + '</button></div>';
    document.body.appendChild(ov);
    var g = function (i) { return document.getElementById(i); };
    g('pmP').value = pre.contact || s.phone || '';
    g('pmC').onclick = closeModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    g('pmGo').onclick = function () {
      var ph = g('pmP').value, x = g('pmX'); x.hidden = true;
      if (!validPhone(ph)) { x.textContent = w[4]; x.hidden = false; return; }
      try { localStorage.setItem('astrojak_cust', JSON.stringify({ phone: digits10(ph) })); } catch (_) {}
      closeModal(); done({ contact: digits10(ph) }, true);
    };
    setTimeout(function () { g('pmP').focus(); }, 50);
  }
  function lead(id, p, c, ref, pos) {
    try {
      var fd = new FormData();
      fd.append('_subject', 'ASTROJAK payment started: ' + p.name + ' (' + money(id) + ')');
      fd.append('status', 'Payment link opened (check Razorpay for paid status)'); fd.append('plan', p.name); fd.append('amount', money(id));
      fd.append('phone', c.contact || '');
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
    if (!hook.validate && id !== 'reserve') {
      location.href = '/?plan=' + encodeURIComponent(id) + '#slotPicker';
      return;
    }
    var cust = {}; try { cust = (hook.customer && hook.customer()) || {}; } catch (_) {}
    try { if (hook.validate && hook.validate(id) === false) return; } catch (_) { return; }
    function go(c, fromModal) {
      try { if (hook.before) hook.before(id); } catch (_) {}
      if (window.gtag) gtag('event', 'begin_checkout', { currency: 'INR', value: p.price, items: [{ item_id: id, item_name: p.name, price: p.price }], position: b.getAttribute('data-pos') || '' });
      var body = { plan: id, position: b.getAttribute('data-pos') || '', source: location.pathname, customer: c };
      try {
        if (hook.appointment) body.appointment = hook.appointment();
        if (hook.topics) body.topics = hook.topics();
      } catch (_) {}
      b.__busy = 1; b.__label = b.innerHTML; b.classList.add('busy'); b.textContent = 'Opening secure payment…';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok || !j.url) throw new Error(j.error || 'Could not create payment link');
            return j;
          });
        })
        .then(function (j) {
          if (fromModal) lead(id, p, c, j.ref, b.getAttribute('data-pos'));
          try { if (hook.paymentLinkCreated) hook.paymentLinkCreated(id, j); } catch (err) { console.error('Could not update local slot estimate', err); }
          setTimeout(function () { location.href = j.url; }, fromModal ? 250 : 0);
        })
        .catch(function (err) {
          reset(b);
          console.error('Razorpay checkout could not be opened:', err);
          alert('Unable to open Razorpay checkout right now. Your number is saved; please try again in a moment.' +
            (err && err.message && err.message !== 'Failed to fetch' ? '\n\n' + err.message : ''));
        });
    }
    openModal(id, p, cust, go);
  });
})();
