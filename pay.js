/* ASTROJAK shared payment + price code. Needs pricing.js loaded first.
   - fills every [data-price="plan-id"] with the price from pricing.js
   - any element with data-pay="plan-id" becomes a Pay button: it asks the server
     for an order and opens the active gateway checkout. */
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
    + '.pm-email{width:100%;height:50px;padding:0 14px;border:1.5px solid #F2E4C4;border-radius:12px;background:#FFFDF7;color:#1A1A1A;font:inherit;font-size:16px}.pm-email:focus{border-color:#F8B700;outline:0;box-shadow:0 0 0 3px rgba(248,183,0,.18)}'
    + '.pm-err{color:#C62828!important;font-weight:600;margin-top:8px!important}'
    + '.pm .paybtn{margin-top:16px;padding-left:28px;padding-right:28px}.pm-x{display:block;width:100%;margin-top:8px;padding:12px;border:0;background:none;font:inherit;font-size:14px;font-weight:700;color:#6b6b6b;cursor:pointer}'
    + '@media(max-width:380px){.pm .paybtn{white-space:normal;flex-wrap:wrap;font-size:15px;padding:14px 24px}}'
    + '.cf-ov{position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,14,0,.58)}'
    + '.cf-modal{display:flex;flex-direction:column;width:min(100%,480px);height:min(82dvh,720px);overflow:hidden;border-radius:18px 18px 0 0;background:#fff;box-shadow:0 -12px 40px rgba(0,0,0,.25)}'
    + '.cf-head{display:flex;flex:0 0 50px;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #eee;color:#292318;font:600 15px/1.2 system-ui,sans-serif}'
    + '.cf-close{width:36px;height:36px;border:0;border-radius:50%;background:#f5f5f5;color:#292318;font:24px/1 system-ui,sans-serif;cursor:pointer}'
    + '.cf-frame{display:block;flex:1;min-height:0;width:100%;border:0;background:#fff;overflow:hidden}'
    + '.cf-open{flex:0 0 auto;margin:8px 14px 12px;padding:10px 12px;border:1px solid #e6dece;border-radius:9px;background:#fff;color:#5c4a24;font:600 13px system-ui,sans-serif;cursor:pointer}'
    + '@media(min-width:600px){.cf-ov{align-items:center;padding:16px}.cf-modal{height:min(85dvh,740px);border-radius:18px}}'
    + '.ptm-ov{position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,14,0,.58)}'
    + '.ptm-modal{display:flex;flex-direction:column;width:min(100%,480px);height:min(82dvh,720px);overflow:hidden;border-radius:18px 18px 0 0;background:#fff;box-shadow:0 -12px 40px rgba(0,0,0,.25)}'
    + '.ptm-head{display:flex;flex:0 0 50px;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #eee;color:#292318;font:600 15px/1.2 system-ui,sans-serif}'
    + '.ptm-root{position:relative;flex:1;min-height:240px;overflow:auto;background:#fff}'
    + '.ptm-root iframe{max-width:100%;border:0}'
    + '@media(min-width:600px){.ptm-ov{align-items:center;padding:16px}.ptm-modal{height:min(85dvh,740px);border-radius:18px}}'
    + '@media (prefers-reduced-motion:reduce){.paybtn::after{animation:none;display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function reset(b) { if (b.__label != null) { b.innerHTML = b.__label; b.__label = null; } b.__busy = 0; b.classList.remove('busy'); }
  window.addEventListener('pageshow', function () { [].forEach.call(document.querySelectorAll('[data-pay]'), reset); });

  var SPLITFORMS = 'https://splitforms.com/api/submit';
  var SPLITFORMS_ACCESS_KEY = '9d208e837cab446dbcaf6f562900f3e6';
  var CHECKOUT_CONTEXT = 'astrojak_pending_checkout';
  var ov = null;
  function redirectToBookingWhatsApp() {
    var message = 'I need to book astrology consultation.';
    location.href = 'https://wa.me/917827673637?text=' + encodeURIComponent(message);
  }
  function digits10(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.slice(0, 2) === '91') d = d.slice(2);
    return d.length === 10 ? d : '';
  }
  function phoneInputDigits(v) {
    var d = String(v || '').replace(/\D/g, '');
    if ((d.length === 12 && d.slice(0, 2) === '91') || (d.length === 11 && d.charAt(0) === '0')) {
      d = d.slice(-10);
    }
    return d.slice(0, 10);
  }
  function validPhone(v) { return /^[6-9]\d{9}$/.test(String(v || '')); }
  function saved() { try { return JSON.parse(localStorage.getItem('astrojak_cust') || '{}') || {}; } catch (_) { return {}; } }
  function words() {
    var lang = window.ASTROJAK_LANGUAGE || 'en';
    var copy = {
      en: ['Enter your mobile number', 'We will use this number for your booking and WhatsApp updates.', 'Mobile / WhatsApp number', '10-digit mobile number', 'Please enter a valid 10-digit mobile number.', 'Pay', 'Cancel', 'Please enter a valid email address.', 'Email address'],
      hing: ['Apna mobile number darj karein', 'Booking aur WhatsApp updates ke liye is number ka use hoga.', 'Mobile / WhatsApp number', '10-digit mobile number', 'Sahi 10-digit mobile number darj karein.', 'Pay karein', 'Cancel', 'Sahi email address darj karein.', 'Email address'],
      hi: ['अपना मोबाइल नंबर दर्ज करें', 'बुकिंग और WhatsApp अपडेट के लिए इस नंबर का उपयोग होगा।', 'मोबाइल / WhatsApp नंबर', '10 अंकों का मोबाइल नंबर', 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।', 'भुगतान', 'रद्द करें', 'कृपया सही ईमेल पता दर्ज करें।', 'ईमेल पता']
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
  function openModal(id, p, pre, done, button, needsEmail) {
    var s = saved(), w = words();
    ov = document.createElement('div'); ov.className = 'pm-ov';
    ov.innerHTML = '<div class="pm" role="dialog" aria-modal="true" aria-label="' + w[0] + '"><h3>' + w[0] + '</h3><p>' + w[1] + '</p>'
      + '<label for="pmP">' + w[2] + '</label><div class="pm-phone"><span class="pm-prefix" aria-hidden="true">+91</span><input id="pmP" type="tel" inputmode="numeric" autocomplete="tel" maxlength="15" pattern="[6-9][0-9]{9}" aria-label="' + w[3] + '" placeholder="XXXXXXXXXX"></div>'
      + (needsEmail ? '<label for="pmEmail">' + w[8] + '</label><input id="pmEmail" class="pm-email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required>' : '')
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
      this.value = phoneInputDigits(this.value);
    });
    g('pmP').addEventListener('change', function () {
      this.value = phoneInputDigits(this.value);
    });
    g('pmC').onclick = closeModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    g('pmGo').onclick = async function () {
      var ph = g('pmP').value, x = g('pmX'); x.hidden = true;
      if (!validPhone(ph)) { x.textContent = w[4]; x.hidden = false; return; }
      var email = needsEmail ? g('pmEmail').value.trim() : '';
      if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        x.textContent = w[7]; x.hidden = false; return;
      }
      try { localStorage.setItem('astrojak_cust', JSON.stringify({ phone: digits10(ph) })); } catch (_) {}
      var customer = { contact: digits10(ph) };
      if (needsEmail) customer.email = email;
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
      submit.textContent = 'Opening secure payment…';
      try {
        lead(id, p, customer, button.getAttribute('data-pos'), appointment, selectedPlan, topics)
          .catch(function (err) {
            console.error('Could not send checkout lead to Splitforms:', err);
          });
      } catch (err) {
        console.error('Could not start the Splitforms checkout lead request:', err);
      }
      try {
        saveCheckoutLead(id, customer, button.getAttribute('data-pos'), appointment, selectedPlan, topics)
          .catch(function (err) {
            console.error('Could not save pre-checkout lead to Google Sheets:', err);
          });
      } catch (err) {
        console.error('Could not start the Google Sheets pre-checkout lead request:', err);
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
  function saveCheckoutLead(id, customer, pos, appointment, selectedPlan, topics) {
    return fetch(API + '/append-checkout-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        mobile: customer.contact,
        plan: id,
        selected_plan: selectedPlan || '',
        topics: topics || [],
        position: pos || '',
        appointment_date: appointment ? appointment.date : '',
        appointment_time: appointment ? appointment.time : '',
        page: location.origin + location.pathname
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.appended) {
          throw new Error(data.diagnostic || data.error || 'Google Sheets rejected the checkout lead');
        }
      });
    });
  }
  var checkoutScripts = {};
  var paytmScriptKeyLoaded = '';
  var paymentGateways = ['razorpay', 'cashfree', 'payu', 'easebuzz', 'paytm'];
  function loadCheckout(gateway, order) {
    if (gateway === 'payu') return Promise.resolve();
    if (gateway === 'cashfree' && window.Cashfree) return Promise.resolve();
    if (gateway === 'razorpay' && window.Razorpay) return Promise.resolve();
    if (gateway === 'easebuzz' && window.EasebuzzCheckout) return Promise.resolve();
    if (gateway === 'paytm' && !order) return Promise.resolve();
    var scriptKey = gateway === 'paytm'
      ? 'paytm:' + order.paytm_mode + ':' + order.mid
      : gateway;
    if (gateway === 'paytm' && window.Paytm && window.Paytm.CheckoutJS
      && paytmScriptKeyLoaded === scriptKey) return Promise.resolve();
    if (checkoutScripts[scriptKey]) return checkoutScripts[scriptKey];
    checkoutScripts[scriptKey] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = gateway === 'cashfree'
        ? 'https://sdk.cashfree.com/js/v3/cashfree.js'
        : gateway === 'easebuzz'
          ? 'https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js'
          : gateway === 'paytm'
            ? (order.paytm_mode === 'sandbox'
              ? 'https://securestage.paytmpayments.com'
              : 'https://secure.paytmpayments.com') + '/merchantpgpui/checkoutjs/merchants/' + encodeURIComponent(order.mid) + '.js'
          : 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = function () {
        if (gateway === 'paytm' && window.Paytm && window.Paytm.CheckoutJS) {
          paytmScriptKeyLoaded = scriptKey;
          checkoutScripts[scriptKey] = null;
        }
        if ((gateway === 'cashfree' && window.Cashfree)
          || (gateway === 'easebuzz' && window.EasebuzzCheckout)
          || (gateway === 'paytm' && window.Paytm && window.Paytm.CheckoutJS)
          || (gateway === 'razorpay' && window.Razorpay)) resolve();
        else {
          checkoutScripts[scriptKey] = null;
          reject(new Error(gateway === 'cashfree'
            ? 'Cashfree Checkout could not be initialized'
            : gateway === 'easebuzz'
              ? 'Easebuzz Checkout could not be initialized'
              : gateway === 'paytm'
                ? 'Paytm Checkout could not be initialized'
                : 'Razorpay Checkout could not be initialized'));
        }
      };
      script.onerror = function () {
        checkoutScripts[scriptKey] = null;
        reject(new Error(gateway === 'cashfree'
          ? 'Cashfree Checkout could not be loaded'
          : gateway === 'easebuzz'
            ? 'Easebuzz Checkout could not be loaded'
            : gateway === 'paytm'
              ? 'Paytm Checkout could not be loaded'
              : 'Razorpay Checkout could not be loaded'));
      };
      document.head.appendChild(script);
    });
    return checkoutScripts[scriptKey];
  }
  function getPaymentConfig() {
    return fetch(API + '/payment-config', { cache: 'no-store' })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (config) {
          if (!res.ok || !paymentGateways.includes(config.activeGateway)) {
            throw new Error(config.error || 'Could not load payment settings');
          }
          return config;
        });
      });
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var error = new Error(j.error || 'Payment request failed');
          error.code = j.code || '';
          throw error;
        }
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

  function verifyCashfreeOrder(orderId) {
    return verifyPayment({ gateway: 'cashfree', order_id: orderId });
  }

  function openCashfreeCheckout(order, button) {
    var overlay = document.createElement('div');
    overlay.className = 'cf-ov';
    var modal = document.createElement('div');
    modal.className = 'cf-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Secure Cashfree checkout');
    var header = document.createElement('div');
    header.className = 'cf-head';
    var title = document.createElement('span');
    title.textContent = 'Secure checkout';
    var close = document.createElement('button');
    close.className = 'cf-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close checkout');
    close.textContent = '×';
    var frame = document.createElement('div');
    frame.className = 'cf-frame';
    header.appendChild(title);
    header.appendChild(close);
    modal.appendChild(header);
    modal.appendChild(frame);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var closed = false;
    var previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function dismiss() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = previousBodyOverflow;
      overlay.remove();
      reset(button);
    }
    function onKeydown(event) {
      if (event.key === 'Escape') dismiss();
    }
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) dismiss();
    });
    document.addEventListener('keydown', onKeydown);

    var width = Math.min(480, window.innerWidth);
    var height = Math.max(300, Math.floor(Math.min(720, window.innerHeight * 0.82) - 50));
    var checkout;
    try {
      var cashfree = window.Cashfree({ mode: order.cashfree_mode });
      checkout = cashfree.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: frame,
        appearance: {
          width: width + 'px',
          height: height + 'px'
        }
      });
    } catch (err) {
      dismiss();
      console.error('Cashfree Checkout could not be opened:', err);
      alert('Secure checkout could not be opened. Please try again.');
      return Promise.resolve();
    }
    return checkout.then(function (result) {
      if (closed) return;
      if (result && result.paymentDetails) {
        button.textContent = 'Verifying payment…';
        title.textContent = 'Verifying payment…';
        return verifyCashfreeOrder(order.order_id).then(function (verified) {
          var query = new URLSearchParams({
            gateway: 'cashfree',
            order_id: verified.order_id
          });
          dismiss();
          location.href = '/thank-you.html?' + query.toString();
        }).catch(function (err) {
          dismiss();
          console.error('Cashfree payment could not be verified:', err);
          alert('Your payment was submitted, but we could not confirm it yet. Please do not pay again. Contact us and share order ID ' + order.order_id + '.');
        });
      }
      if (result && result.redirect) {
        console.warn('Cashfree requested its redirect fallback; checkout may not be supported in this browser context.');
        dismiss();
        return;
      }
      if (result && result.error) {
        console.warn('Cashfree Checkout closed or payment did not complete:', result.error);
      }
      dismiss();
    }).catch(function (err) {
      dismiss();
      console.error('Cashfree Checkout could not be opened:', err);
      alert('Secure checkout could not be opened. Please try again.');
    });
  }

  function openPayuCheckout(order, button, checkoutData) {
    var overlay = document.createElement('div');
    overlay.className = 'cf-ov';
    var modal = document.createElement('div');
    modal.className = 'cf-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Secure PayU checkout');
    var header = document.createElement('div');
    header.className = 'cf-head';
    var title = document.createElement('span');
    title.textContent = 'Secure PayU checkout';
    var close = document.createElement('button');
    close.className = 'cf-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close checkout');
    close.textContent = '×';
    var frame = document.createElement('iframe');
    frame.className = 'cf-frame';
    frame.title = 'PayU secure payment';
    frame.name = 'payuCheckout' + Date.now();
    var openInTab = document.createElement('button');
    openInTab.className = 'cf-open';
    openInTab.type = 'button';
    openInTab.textContent = 'Open checkout in a new tab';
    header.appendChild(title);
    header.appendChild(close);
    modal.appendChild(header);
    modal.appendChild(frame);
    modal.appendChild(openInTab);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var form = document.createElement('form');
    form.method = 'POST';
    form.hidden = true;
    var activeOrder = order;
    function setFormOrder(nextOrder, target) {
      activeOrder = nextOrder;
      form.action = nextOrder.action_url;
      form.target = target;
      while (form.firstChild) form.removeChild(form.firstChild);
      Object.keys(nextOrder.fields || {}).forEach(function (name) {
        var field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        field.value = String(nextOrder.fields[name]);
        form.appendChild(field);
      });
    }
    setFormOrder(order, frame.name);
    document.body.appendChild(form);

    var closed = false;
    var previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function dismiss() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('message', onMessage);
      document.body.style.overflow = previousBodyOverflow;
      form.remove();
      overlay.remove();
      reset(button);
    }
    function onKeydown(event) {
      if (event.key === 'Escape') dismiss();
    }
    function onMessage(event) {
      if (event.origin !== API || !event.data || event.data.type !== 'payu-result'
        || event.data.txnid !== activeOrder.txnid || closed) return;
      if (event.data.status !== 'success') {
        dismiss();
        alert('PayU did not confirm a successful payment. You can try again.');
        return;
      }
      button.textContent = 'Verifying payment…';
      title.textContent = 'Verifying payment…';
      verifyPayment({ gateway: 'payu', txnid: activeOrder.txnid }).then(function (verified) {
        try {
          sessionStorage.setItem('astrojak_payu_verified_' + activeOrder.txnid, JSON.stringify({
            payment_id: verified.payment_id,
            reference_id: verified.reference_id,
            plan: verified.plan,
            appointment_date: verified.appointment_date || '',
            appointment_time: verified.appointment_time || ''
          }));
        } catch (err) {
          console.error('Could not save PayU payment confirmation:', err);
        }
        var query = new URLSearchParams({
          gateway: 'payu',
          txnid: activeOrder.txnid,
          payment_status: 'paid',
          payment_id: verified.payment_id,
          reference_id: verified.reference_id,
          plan: verified.plan
        });
        if (verified.appointment_date) query.set('appointment_date', verified.appointment_date);
        if (verified.appointment_time) query.set('appointment_time', verified.appointment_time);
        dismiss();
        location.href = '/thank-you.html?' + query.toString();
      }).catch(function (err) {
        dismiss();
        console.error('PayU payment could not be verified:', err);
        alert('Your payment was submitted, but we could not confirm it yet. Please do not pay again. Contact us and share transaction ID ' + activeOrder.txnid + '.');
      });
    }
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) dismiss();
    });
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('message', onMessage);
    openInTab.addEventListener('click', function () {
      var fallbackTarget = 'payuFallback' + Date.now();
      var fallbackWindow = window.open('about:blank', fallbackTarget);
      if (!fallbackWindow) {
        alert('Please allow pop-ups to open the secure PayU checkout in a new tab.');
        return;
      }
      openInTab.disabled = true;
      openInTab.textContent = 'Preparing secure checkout…';
      frame.src = 'about:blank';
      title.textContent = 'Complete payment in the new tab';
      post('/create-order', checkoutData).then(function (fallbackOrder) {
        setFormOrder(fallbackOrder, fallbackTarget);
        form.submit();
      }).catch(function (err) {
        fallbackWindow.close();
        openInTab.disabled = false;
        openInTab.textContent = 'Open checkout in a new tab';
        title.textContent = 'Secure PayU checkout';
        console.error('PayU fallback checkout could not be created:', err);
        alert('Secure checkout could not be opened. Please try again.');
      });
    });
    form.submit();
  }

  function openEasebuzzCheckout(order, button) {
    var completed = false;
    var cleanup = function () {};
    function onResponse(result) {
      if (completed) return;
      completed = true;
      if (result && result.error) {
        reset(button);
        console.error('Easebuzz Checkout returned an error:', result.message || 'Unknown error');
        alert('Secure checkout could not be completed. Please try again.');
        return;
      }
      button.textContent = 'Verifying payment…';
      verifyPayment({ gateway: 'easebuzz', txnid: order.txnid }).then(function (verified) {
        try {
          sessionStorage.setItem('astrojak_easebuzz_verified_' + order.txnid, JSON.stringify({
            txnid: order.txnid,
            payment_id: verified.payment_id,
            reference_id: verified.reference_id,
            plan: verified.plan,
            appointment_date: verified.appointment_date || '',
            appointment_time: verified.appointment_time || ''
          }));
        } catch (err) {
          console.error('Could not save Easebuzz payment confirmation:', err);
        }
        var query = new URLSearchParams({
          gateway: 'easebuzz',
          txnid: order.txnid,
          payment_status: 'paid',
          payment_id: verified.payment_id,
          reference_id: verified.reference_id,
          plan: verified.plan
        });
        if (verified.appointment_date) query.set('appointment_date', verified.appointment_date);
        if (verified.appointment_time) query.set('appointment_time', verified.appointment_time);
        location.href = '/thank-you.html?' + query.toString();
      }).catch(function (err) {
        reset(button);
        console.error('Easebuzz payment could not be verified:', err);
        alert('Your payment was submitted, but we could not confirm it yet. Please do not pay again. Contact us and share transaction ID ' + order.txnid + '.');
      });
    }
    try {
      var checkout = new window.EasebuzzCheckout(order.merchant_key, order.easebuzz_mode);
      var container = document.getElementById('easebuzz-container-' + checkout.ebcid);
      var iframe = document.getElementById('easebuzz-checkout-frame-' + checkout.ebcid);
      // EaseCheckout expands to full viewport on mobile; keep it in the site's partial-screen modal.
      var resizeModal = function () {
        if (!container || !iframe) return;
        var width = Math.min(480, window.innerWidth);
        var height = Math.max(160, Math.floor(Math.min(720, window.innerHeight * 0.82)));
        container.style.overflow = 'hidden';
        iframe.style.position = 'absolute';
        iframe.style.width = width + 'px';
        iframe.style.maxWidth = width + 'px';
        iframe.style.height = height + 'px';
        iframe.style.minHeight = '0';
        iframe.style.maxHeight = height + 'px';
        iframe.style.bottom = window.innerWidth < 600 ? '0' : 'auto';
        iframe.style.top = window.innerWidth < 600 ? 'auto' : '50%';
        iframe.style.transform = window.innerWidth < 600
          ? 'translateX(-50%)'
          : 'translate(-50%, -50%)';
        iframe.style.borderRadius = window.innerWidth < 600 ? '18px 18px 0 0' : '18px';
      };
      var observer = container ? new MutationObserver(function () {
        if (container.style.visibility === 'hidden') {
          cleanup();
          container.remove();
          if (!completed) reset(button);
        }
      }) : null;
      if (observer) observer.observe(container, { attributes: true, attributeFilter: ['style'] });
      var originalResize = checkout.resizeCheckoutIframe;
      checkout.resizeCheckoutIframe = function (dimensions) {
        originalResize.call(checkout, dimensions);
        resizeModal();
      };
      window.addEventListener('resize', resizeModal);
      cleanup = function () {
        window.removeEventListener('resize', resizeModal);
        if (observer) observer.disconnect();
      };
      checkout.initiatePayment({
        access_key: order.access_key,
        onResponse: onResponse,
        theme: '#F8B700'
      });
      resizeModal();
    } catch (err) {
      cleanup();
      reset(button);
      console.error('Easebuzz Checkout could not be opened:', err);
      alert('Secure checkout could not be opened. Please try again.');
    }
  }

  function openPaytmCheckout(order, button) {
    var overlay = document.createElement('div');
    overlay.className = 'ptm-ov';
    var modal = document.createElement('div');
    modal.className = 'ptm-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Secure Paytm checkout');
    var header = document.createElement('div');
    header.className = 'ptm-head';
    var title = document.createElement('span');
    title.textContent = 'Secure Paytm checkout';
    var close = document.createElement('button');
    close.className = 'cf-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close checkout');
    close.textContent = '×';
    var root = document.createElement('div');
    root.className = 'ptm-root';
    root.id = 'paytm-checkout-root-' + Date.now();
    header.appendChild(title);
    header.appendChild(close);
    modal.appendChild(header);
    modal.appendChild(root);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var closed = false;
    var verifying = false;
    var previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function dismiss() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = previousBodyOverflow;
      overlay.remove();
      reset(button);
    }
    function confirmPayment() {
      if (closed || verifying) return;
      verifying = true;
      title.textContent = 'Verifying payment…';
      close.disabled = true;
      verifyPayment({ gateway: 'paytm', order_id: order.order_id }).then(function (verified) {
        var confirmed = {
          order_id: verified.order_id,
          payment_id: verified.payment_id,
          reference_id: verified.reference_id,
          plan: verified.plan,
          appointment_date: verified.appointment_date || '',
          appointment_time: verified.appointment_time || ''
        };
        try {
          sessionStorage.setItem('astrojak_paytm_verified_' + order.order_id, JSON.stringify(confirmed));
        } catch (err) {
          console.error('Could not save Paytm payment confirmation:', err);
        }
        var query = new URLSearchParams({
          gateway: 'paytm',
          order_id: confirmed.order_id,
          payment_status: 'paid',
          payment_id: confirmed.payment_id,
          reference_id: confirmed.reference_id,
          plan: confirmed.plan
        });
        if (confirmed.appointment_date) query.set('appointment_date', confirmed.appointment_date);
        if (confirmed.appointment_time) query.set('appointment_time', confirmed.appointment_time);
        dismiss();
        location.href = '/thank-you.html?' + query.toString();
      }).catch(function (err) {
        dismiss();
        console.error('Paytm payment could not be verified:', err);
        alert('Paytm has not confirmed this payment yet. If you completed payment, do not pay again; contact us and share order ID ' + order.order_id + '.');
      });
    }
    function onKeydown(event) {
      if (event.key === 'Escape' && !verifying) dismiss();
    }
    close.addEventListener('click', function () {
      if (!verifying) dismiss();
    });
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay && !verifying) dismiss();
    });
    document.addEventListener('keydown', onKeydown);

    try {
      window.Paytm.CheckoutJS.onLoad(function () {
        if (closed) return;
        window.Paytm.CheckoutJS.init({
          root: '#' + root.id,
          flow: 'DEFAULT',
          data: {
            orderId: order.order_id,
            token: order.txn_token,
            tokenType: 'TXN_TOKEN',
            amount: order.amount
          },
          handler: {
            notifyMerchant: function (eventName) {
              if (['APP_CLOSED', 'PAYMENT_SUCCESS', 'TRANSACTION_COMPLETE'].includes(String(eventName).toUpperCase())) {
                confirmPayment();
              }
            }
          }
        }).then(function () {
          if (!closed) window.Paytm.CheckoutJS.invoke();
        }).catch(function (error) {
          dismiss();
          console.error('Paytm Checkout could not be initialized:', error);
          alert('Secure checkout could not be opened. Please try again.');
        });
      });
    } catch (error) {
      dismiss();
      console.error('Paytm Checkout could not be opened:', error);
      alert('Secure checkout could not be opened. Please try again.');
    }
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
      post('/create-order', body).then(function (order) {
        if (!paymentGateways.includes(order.gateway)) {
          throw new Error('The server returned an unsupported payment gateway');
        }
        return loadCheckout(order.gateway, order).then(function () {
          return order;
        });
      })
        .then(function (order) {
          try { if (hook.paymentOrderCreated) hook.paymentOrderCreated(id, order); } catch (err) { console.error('Could not update local slot estimate', err); }
          if (order.gateway === 'cashfree') {
            return openCashfreeCheckout(order, b);
          }
          if (order.gateway === 'payu') {
            return openPayuCheckout(order, b, body);
          }
          if (order.gateway === 'easebuzz') {
            return openEasebuzzCheckout(order, b);
          }
          if (order.gateway === 'paytm') {
            return openPaytmCheckout(order, b);
          }
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
                    razorpay_payment_id: verified.payment_id,
                    plan: verified.plan
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
          checkout.on('payment.failed', function (failure) {
            console.error('Razorpay payment failed:', failure && failure.error);
            reset(b);
            redirectToBookingWhatsApp();
          });
          checkout.open();
        })
        .catch(function (err) {
          reset(b);
          console.error('Payment checkout could not be opened:', err.code || '', err);
          alert(err.message || 'Secure checkout could not be opened. Please try again.');
        });
    }
    getPaymentConfig().then(function (config) {
      openModal(id, p, cust, go, b, Boolean(config && config.requiresEmail));
    }).catch(function (err) {
      reset(b);
      console.error('Payment settings could not be loaded:', err);
      alert('Payment settings could not be loaded. Please try again later.');
    });
  });
})();
