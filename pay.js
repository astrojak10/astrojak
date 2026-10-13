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
    + '@media (prefers-reduced-motion:reduce){.paybtn::after{animation:none;display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function reset(b) { if (b.__label != null) { b.innerHTML = b.__label; b.__label = null; } b.__busy = 0; b.classList.remove('busy'); }
  window.addEventListener('pageshow', function () { [].forEach.call(document.querySelectorAll('[data-pay]'), reset); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pay]'); if (!b) return;
    e.preventDefault();
    if (b.__busy) return;
    var id = b.getAttribute('data-pay');
    if (id === 'selected') { var s = document.getElementById('plan'); id = s ? s.value : ''; }
    var p = PR.plans[id]; if (!p) return;
    var hook = window.PAY_HOOK || {};
    try { if (hook.before) hook.before(id); } catch (_) {}
    if (window.gtag) gtag('event', 'begin_checkout', { currency: 'INR', value: p.price, items: [{ item_id: id, item_name: p.name, price: p.price }], position: b.getAttribute('data-pos') || '' });
    var body = { plan: id, position: b.getAttribute('data-pos') || '', source: location.pathname };
    try { if (hook.customer) body.customer = hook.customer(); } catch (_) {}
    b.__busy = 1; b.__label = b.innerHTML; b.classList.add('busy'); b.textContent = 'Opening secure payment…';
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.url) throw new Error('no link'); return j; }); })
      .then(function (j) { location.href = j.url; })
      .catch(function () { reset(b); location.href = waLink(id); });
  });
})();
