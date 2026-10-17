/* ASTROJAK shared payment + price code. Needs pricing.js loaded first.
   - fills every [data-price="plan-id"] with the price from pricing.js
   - any element with data-pay="plan-id" becomes a Pay button: it asks the server
     for a Razorpay order and opens Checkout.js. */
(function () {
  var PR = window.PRICING; if (!PR) return;
  var API = 'https://api.astrojak.in';
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
    + '.pm-ov{position:fixed;top:var(--pm-vtop,0px);left:0;right:0;height:var(--pm-vheight,100dvh);z-index:9999;background:rgba(20,14,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:0;overflow:hidden}'
    + '.pm{width:100%;max-width:480px;background:#fff;color:#1A1A1A;border-radius:22px 22px 0 0;padding:22px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -12px 40px rgba(0,0,0,.25);animation:pmup .25s ease;max-height:var(--pm-max-height,92vh);overflow:auto;overscroll-behavior:contain}'
    + '@keyframes pmup{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}'
    + '@media(min-width:600px){.pm-ov{align-items:center}.pm{border-radius:22px}}'
    + '.pm h3{font-size:21px;margin-bottom:4px}.pm p{font-size:14px;color:#5C5C5C;margin-bottom:6px}'
    + '.pm label{display:block;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#7A5A12;margin:12px 0 6px}.pm label span{text-transform:none;font-weight:500;letter-spacing:0}'
    + '.pm-phone{display:flex;align-items:stretch;border:1.5px solid #F2E4C4;border-radius:12px;background:#FFFDF7;color:#1A1A1A;overflow:hidden}.pm-phone:focus-within{border-color:#F8B700;box-shadow:0 0 0 3px rgba(248,183,0,.18)}.pm-prefix{display:flex;flex:0 0 66px;align-items:center;justify-content:center;min-height:50px;padding:0 8px;border-right:1px solid #E4D8BE;font:inherit;font-size:16px;font-weight:700;color:#5C5C5C;white-space:nowrap}.pm-phone input{flex:1;min-width:0;width:100%;height:50px;margin:0;padding:0 14px;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#1A1A1A;font:inherit;font-size:16px;outline:0!important;appearance:none;-webkit-appearance:none}.pm-phone input::placeholder{color:#8A8170;opacity:1}'
    + '.pm-err{color:#C62828!important;font-weight:600;margin-top:8px!important}'
    + '.pm .paybtn{margin-top:16px;padding-left:28px;padding-right:28px}.pm-x{display:block;width:100%;margin-top:8px;padding:12px;border:0;background:none;font:inherit;font-size:14px;font-weight:700;color:#6b6b6b;cursor:pointer}'
    + '@media(max-width:380px){.pm .paybtn{white-space:normal;flex-wrap:wrap;font-size:15px;padding:14px 24px}}'
    + '@media (prefers-reduced-motion:reduce){.paybtn::after{animation:none;display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function reset(b) { if (b.__label != null) { b.innerHTML = b.__label; b.__label = null; } b.__busy = 0; b.classList.remove('busy'); }
  window.addEventListener('pageshow', function () { [].forEach.call(document.querySelectorAll('[data-pay]'), reset); });

  var SPLITFORMS = 'https://splitforms.com/api/submit';
  var SPLITFORMS_ACCESS_KEY = '9d208e837cab446dbcaf6f562900f3e6';
  var CHECKOUT_CONTEXT = 'astrojak_pending_checkout';
  var ov = null;
  function digits10(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.slice(0, 2) === '91') d = d.slice(2);
    return d.length === 10 ? d : '';
  }
  function validPhone(v) { return /^[6-9]\d{9}$/.test(String(v || '')); }
  function saved() { try { return JSON.parse(localStorage.getItem('astrojak_cust') || '{}') || {}; } catch (_) { return {}; } }
  function words() {
    var lang = window.ASTROJAK_LANGUAGE || 'en';
    var copy = {
      en: ['Enter your mobile number', 'We will use this number for your booking and WhatsApp updates.', 'Mobile / WhatsApp number', '10-digit mobile number', 'Please enter a valid 10-digit mobile number.', 'Pay', 'Cancel'],
      hing: ['Apna mobile number darj karein', 'Booking aur WhatsApp updates ke liye is number ka use hoga.', 'Mobile / WhatsApp number', '10-digit mobile number', 'Sahi 10-digit mobile number darj karein.', 'Pay karein', 'Cancel'],
      hi: ['अपना मोबाइल नंबर दर्ज करें', 'बुकिंग और WhatsApp अपडेट के लिए इस नंबर का उपयोग होगा।', 'मोबाइल / WhatsApp नंबर', '10 अंकों का मोबाइल नंबर', 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।', 'भुगतान', 'रद्द करें']
    };
    return copy[lang] || copy.en;
  }
  function closeModal() {
    if (!ov) return;
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', syncModalViewport);
      window.visualViewport.removeEventListener('scroll', syncModalViewport);
    }
    window.removeEventListener('resize', syncModalViewport);
    ov.remove();
    ov = null;
  }
  function syncModalViewport() {
    if (!ov) return;
    var viewport = window.visualViewport;
    var top = viewport ? viewport.offsetTop : 0;
    var height = viewport ? viewport.height : window.innerHeight;
    ov.style.setProperty('--pm-vtop', top + 'px');
    ov.style.setProperty('--pm-vheight', height + 'px');
    ov.style.setProperty('--pm-max-height', Math.max(160, height - 12) + 'px');
  }
  function openModal(id, p, pre, done, button) {
    var s = saved(), w = words();
    ov = document.createElement('div'); ov.className = 'pm-ov';
    ov.innerHTML = '<div class="pm" role="dialog" aria-modal="true" aria-label="' + w[0] + '"><h3>' + w[0] + '</h3><p>' + w[1] + '</p>'
      + '<label for="pmP">' + w[2] + '</label><div class="pm-phone"><span class="pm-prefix" aria-hidden="true">+91</span><input id="pmP" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" pattern="[6-9][0-9]{9}" aria-label="' + w[3] + '" placeholder="XXXXXXXXXX"></div>'
      + '<p class="pm-err" id="pmX" hidden></p>'
      + '<button type="button" class="paybtn" id="pmGo">' + w[5] + ' ' + money(id) + ' →</button>'
      + '<button type="button" class="pm-x" id="pmC">' + w[6] + '</button></div>';
    document.body.appendChild(ov);
    syncModalViewport();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncModalViewport);
      window.visualViewport.addEventListener('scroll', syncModalViewport);
    }
    window.addEventListener('resize', syncModalViewport);
    var g = function (i) { return document.getElementById(i); };
    g('pmP').value = digits10(pre.contact || s.phone || '');
    g('pmP').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });
    g('pmC').onclick = closeModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    g('pmGo').onclick = async function () {
      var ph = g('pmP').value, x = g('pmX'); x.hidden = true;
      if (!validPhone(ph)) { x.textContent = w[4]; x.hidden = false; return; }
      try { localStorage.setItem('astrojak_cust', JSON.stringify({ phone: digits10(ph) })); } catch (_) {}
      var customer = { contact: digits10(ph) };
      var booking = window.PAY_HOOK || {};
      var appointment = booking.appointment ? booking.appointment() : null;
      var selectedPlan = booking.selectedPlan ? booking.selectedPlan() : p.name;
      var topics = booking.topics ? booking.topics() : [];
      var context = {
        mobile: customer.contact,
        plan: p.name,
        amount: money(id),
        selectedPlan: selectedPlan,
        topics: topics,
        appointment: appointment
      };
      try {
        sessionStorage.setItem(CHECKOUT_CONTEXT, JSON.stringify(context));
      } catch (err) {
        console.error('Could not save checkout details for the thank-you page:', err);
      }
      var submit = document.getElementById('pmGo');
      submit.disabled = true;
      submit.textContent = 'Saving booking details…';
      try {
        await lead(id, p, customer, button.getAttribute('data-pos'), appointment, selectedPlan, topics);
      } catch (err) {
        console.error('Could not send checkout lead to Splitforms:', err);
        x.textContent = "Couldn't save your booking details. Please try again.";
        x.hidden = false;
        submit.disabled = false;
        submit.textContent = w[5] + ' ' + money(id) + ' →';
        return;
      }
      closeModal(); done(customer, true);
    };
    setTimeout(function () {
      syncModalViewport();
      g('pmP').focus();
      g('pmP').scrollIntoView({ block: 'nearest' });
    }, 50);
  }
  function lead(id, p, c, pos, appointment, selectedPlan, topics) {
    var fd = new FormData();
    fd.append('access_key', SPLITFORMS_ACCESS_KEY);
    fd.append('_subject', 'ASTROJAK booking details: ' + (selectedPlan || p.name) + ' (' + money(id) + ')');
    fd.append('status', 'Mobile number captured');
    fd.append('plan', selectedPlan || p.name);
    fd.append('payment_plan', p.name);
    fd.append('amount', money(id));
    fd.append('mobile', c.contact || '');
    fd.append('selected_plan', selectedPlan || p.name);
    fd.append('topics', (topics || []).join(', '));
    fd.append('discussion_topics', (topics || []).join(', '));
    fd.append('appointment_date', appointment ? appointment.date : '');
    fd.append('appointment_time', appointment ? appointment.time : '');
    fd.append('button', pos || ''); fd.append('page', location.href);
    return fetch(SPLITFORMS, { method: 'POST', headers: { Accept: 'application/json' }, body: fd })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data.success) throw new Error(data.message || 'Splitforms rejected the checkout lead');
        });
      });
  }

  var checkoutScript;
  function loadCheckout() {
    if (window.Razorpay) return Promise.resolve();
    if (checkoutScript) return checkoutScript;
    checkoutScript = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = function () {
        if (window.Razorpay) resolve();
        else {
          checkoutScript = null;
          reject(new Error('Razorpay Checkout could not be initialized'));
        }
      };
      script.onerror = function () {
        checkoutScript = null;
        reject(new Error('Razorpay Checkout could not be loaded'));
      };
      document.head.appendChild(script);
    });
    return checkoutScript;
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Payment request failed');
        return j;
      });
    });
  }

  function verifyPayment(response) {
    var attempt = 0;
    function verify() {
      attempt++;
      return post('/verify-payment', response).then(function (result) {
        if (!result.verified) throw new Error('Payment could not be verified');
        return result;
      }).catch(function (error) {
        if (attempt < 3) {
          return new Promise(function (resolve) { setTimeout(resolve, attempt * 1000); }).then(verify);
        }
        throw error;
      });
    }
    return verify();
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
      loadCheckout()
        .then(function () { return post('/create-order', body); })
        .then(function (order) {
          try { if (hook.paymentOrderCreated) hook.paymentOrderCreated(id, order); } catch (err) { console.error('Could not update local slot estimate', err); }
          var checkout = new window.Razorpay({
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: 'ASTROJAK',
            description: p.name,
            order_id: order.order_id,
            prefill: { contact: c.contact },
            notes: { plan: id, reference_id: order.ref },
            theme: { color: '#F8B700' },
            modal: { ondismiss: function () { reset(b); } },
            handler: function (payment) {
              b.textContent = 'Verifying payment…';
              verifyPayment(payment)
                .then(function (verified) {
                  var query = new URLSearchParams({
                    razorpay_payment_link_status: 'paid',
                    razorpay_payment_link_reference_id: verified.reference_id,
                    razorpay_payment_id: verified.payment_id
                  });
                  if (verified.appointment_date) query.set('appointment_date', verified.appointment_date);
                  if (verified.appointment_time) query.set('appointment_time', verified.appointment_time);
                  location.href = '/thank-you.html?' + query.toString();
                })
                .catch(function (err) {
                  reset(b);
                  console.error('Razorpay payment could not be verified:', err);
                  alert('Your payment was submitted, but we could not confirm it yet. Please do not pay again. Contact us and share payment ID ' + payment.razorpay_payment_id + '.');
                });
            }
          });
          checkout.open();
        })
        .catch(function (err) {
          reset(b);
          console.error('Razorpay checkout could not be opened:', err);
          alert('Unable to open Razorpay checkout right now. Your number is saved; please try again in a moment.' +
            (err && err.message && err.message !== 'Failed to fetch' ? '\n\n' + err.message : ''));
        });
    }
    openModal(id, p, cust, go, b);
  });
})();
