/* Neto · landing de lista de espera */
(function () {
  'use strict';

  var cfg = window.NETO_CONFIG || {};

  /* ---------- Analytics (Umami, sin cookies) ---------- */
  if (cfg.UMAMI_WEBSITE_ID) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://cloud.umami.is/script.js';
    s.setAttribute('data-website-id', cfg.UMAMI_WEBSITE_ID);
    document.head.appendChild(s);
  }
  function track(name, data) {
    try { if (window.umami && window.umami.track) window.umami.track(name, data); } catch (e) {}
  }

  /* ---------- Ejemplo del dashboard (números ficticios) ---------- */
  var RATES = { MEP: 1450, CCL: 1480 };           // cotizaciones de ejemplo
  var NOMINAL = { ARS: '+38,2%', MEP: '+6,3%', CCL: '+5,9%' };
  var BROKERS = [                                 // tenencias de ejemplo, en pesos
    ['Cocos', 9080000],
    ['IOL', 7210000],
    ['Balanz', 5610000],
    ['PPI', 3205000],
    ['Bull Market', 1604000]
  ];
  var TOTAL_ARS = BROKERS.reduce(function (a, b) { return a + b[1]; }, 0);
  var nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

  function money(ars, cur) {
    return cur === 'ARS' ? '$ ' + nf.format(ars) : 'US$ ' + nf.format(ars / RATES[cur]);
  }

  var elTotal = document.getElementById('mock-total');
  var elSub = document.getElementById('mock-sub');
  var elNom = document.getElementById('mock-nom');
  var elNomCur = document.getElementById('mock-nom-cur');
  var elList = document.getElementById('mock-brokers');
  var segButtons = document.querySelectorAll('.seg button');

  function renderMock(cur) {
    elTotal.textContent = money(TOTAL_ARS, cur);
    elSub.textContent = cur === 'ARS'
      ? 'Valuado en pesos (ejemplo)'
      : 'Dólar ' + cur + ' de ejemplo: $ ' + nf.format(RATES[cur]);
    elNom.textContent = NOMINAL[cur];
    elNomCur.textContent = cur === 'ARS' ? 'en pesos' : 'en ' + cur;
    elList.innerHTML = '';
    BROKERS.forEach(function (b) {
      var pct = Math.round((b[1] / TOTAL_ARS) * 100);
      var li = document.createElement('li');
      li.innerHTML = '<span class="bname"></span><span class="bval"></span><span class="bar"><i></i></span>';
      li.querySelector('.bname').textContent = b[0] + ' · ' + pct + '%';
      li.querySelector('.bval').textContent = money(b[1], cur);
      li.querySelector('.bar i').style.width = pct + '%';
      elList.appendChild(li);
    });
    segButtons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-cur') === cur ? 'true' : 'false');
    });
  }
  segButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cur = btn.getAttribute('data-cur');
      renderMock(cur);
      track('demo-moneda', { moneda: cur });
    });
  });
  renderMock('MEP');

  /* ---------- Formulario (Netlify Forms) ---------- */
  var form = document.getElementById('waitlist');
  var submitBtn = document.getElementById('submit');
  var statusEl = document.getElementById('form-status');
  var formView = document.getElementById('form-view');
  var done = document.getElementById('done');

  // De dónde vino la visita (para comparar canales: Instagram, WhatsApp, etc.)
  try {
    var qs = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
      if (qs.get(k)) form.elements[k].value = qs.get(k).slice(0, 100);
    });
    if (!form.elements.utm_source.value && qs.get('ref')) form.elements.utm_source.value = qs.get('ref').slice(0, 100);
    if (document.referrer && document.referrer.indexOf(location.host) === -1) {
      form.elements.referrer.value = document.referrer.slice(0, 200);
    }
  } catch (e) {}

  var otroCheck = document.getElementById('broker-otro');
  var otroWrap = document.getElementById('otro-wrap');
  otroCheck.addEventListener('change', function () {
    otroWrap.hidden = !otroCheck.checked;
    if (otroCheck.checked) document.getElementById('broker_otro').focus();
  });

  var started = false;
  form.addEventListener('input', function () {
    if (!started) { started = true; track('form-empezado'); }
  });

  function showErr(id, show) {
    var el = document.getElementById(id);
    el.hidden = !show;
    if (el.parentElement.classList) el.parentElement.classList.toggle('invalid', show);
  }

  function validate() {
    var ok = true, first = null;
    var email = form.elements.email;
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    showErr('err-email', !emailOk);
    if (!emailOk) { ok = false; first = first || email; }

    var brokers = form.querySelectorAll('input[name="brokers"]:checked');
    showErr('err-brokers', brokers.length === 0);
    if (!brokers.length) { ok = false; first = first || form.querySelector('input[name="brokers"]'); }

    var cartera = form.querySelector('input[name="cartera"]:checked');
    showErr('err-cartera', !cartera);
    if (!cartera) { ok = false; first = first || form.querySelector('input[name="cartera"]'); }

    var pagaria = form.querySelector('input[name="pagaria_informe"]:checked');
    showErr('err-pagaria', !pagaria);
    if (!pagaria) { ok = false; first = first || form.querySelector('input[name="pagaria_informe"]'); }

    if (first) first.focus();
    return ok;
  }

  // Al corregir, esconder el error de ese bloque
  form.addEventListener('change', function (e) {
    var n = e.target.name;
    if (n === 'brokers') showErr('err-brokers', false);
    if (n === 'cartera') showErr('err-cartera', false);
    if (n === 'pagaria_informe') showErr('err-pagaria', false);
  });
  // Esconder el error del email mientras se escribe (no al salir del campo:
  // eso movería la página justo cuando la persona toca la siguiente opción)
  form.elements.email.addEventListener('input', function () {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.value.trim())) showErr('err-email', false);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusEl.hidden = true;
    if (!validate()) { track('form-error-validacion'); return; }

    // Un solo campo "brokers" con todos los elegidos, así el CSV queda en una columna
    var data = new URLSearchParams();
    var brokers = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.name === 'brokers') { if (el.checked) brokers.push(el.value); return; }
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      data.append(el.name, el.name === 'email' ? el.value.trim().toLowerCase() : el.value.trim());
    });
    data.append('brokers', brokers.join(', '));

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: data.toString()
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      track('anotado', {
        pagaria: data.get('pagaria_informe'),
        cartera: data.get('cartera'),
        brokers: brokers.length
      });
      formView.hidden = true;
      done.hidden = false;
      done.focus();
      done.scrollIntoView({ block: 'center' });
    }).catch(function () {
      track('form-error-envio');
      statusEl.textContent = 'No pudimos guardar tus datos. Revisá tu conexión y probá de nuevo en un ratito.';
      statusEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Anotarme gratis';
    });
  });

  /* ---------- Compartir ---------- */
  var shareUrl = location.origin + location.pathname + '?utm_source=compartido';
  var shareText = '¿Cuánto ganaste de verdad con tus inversiones? Neto junta todos tus brokers, en dólares y contra la inflación. Sumate a la lista: ';
  document.getElementById('share-wa').href = 'https://wa.me/?text=' + encodeURIComponent(shareText + shareUrl);
  var copyBtn = document.getElementById('share-copy');
  var copyLabel = navigator.share ? 'Compartir de otra forma' : 'Copiar link';
  copyBtn.textContent = copyLabel;
  copyBtn.addEventListener('click', function () {
    function ok() { copyBtn.textContent = '¡Link copiado!'; setTimeout(function () { copyBtn.textContent = copyLabel; }, 2200); }
    if (navigator.share) {
      navigator.share({ title: 'Neto', text: shareText, url: shareUrl }).catch(function () {});
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(ok, function () {});
  });
})();
