/*
 * Admin page: lets the owner set the "last updated" date and mark horses as sold.
 *
 * The website is static, so changes are saved by committing data/site.json to the
 * GitHub repository (GitHub Pages then republishes the site in about a minute).
 * Saving needs a GitHub key (personal access token). It is entered once per device and
 * kept only in that browser, encrypted with the admin password. The password alone
 * cannot change anything: this code is public, so the key is what actually protects
 * the website.
 */
(function () {
  'use strict';

  var OWNER = 'ramonpepapolo-lang';
  var REPO = 'criacibaolapampa';
  var BRANCH = 'main';
  var FILE = 'data/site.json';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
  // sha256('cria-cibao-admin:' + password)
  var PASS_HASH = 'b7b157a0dd87b2e22faf49c1797337b583338254d9c03233f8d55ebbcaf4f547';
  var STORE = 'cria-admin-key';

  var root = document.documentElement;
  var password = null;
  var token = null;
  var fileSha = null;
  var saved = null; // last saved JSON string, to detect unsaved changes

  var $ = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder();

  /* ---------- Language ---------- */

  function lang() { return root.getAttribute('data-lang') === 'es' ? 'es' : 'en'; }
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      var l = b.getAttribute('data-set-lang');
      try { localStorage.setItem('lang', l); } catch (e) {}
      root.setAttribute('data-lang', l);
      root.lang = l;
      document.querySelectorAll('[data-set-lang]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
    });
    b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang()));
  });

  function say(el, en, es, kind) {
    el.className = 'admin-msg' + (kind ? ' is-' + kind : '');
    el.innerHTML = en ? '<span lang="en">' + en + '</span><span lang="es">' + es + '</span>' : '';
  }

  function show(view) {
    ['view-login', 'view-connect', 'view-edit'].forEach(function (id) { $(id).hidden = id !== view; });
    var focus = { 'view-login': 'password', 'view-connect': 'token' }[view];
    if (focus) $(focus).focus();
  }

  /* ---------- Crypto helpers ---------- */

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function b64(bytes) {
    var s = '';
    new Uint8Array(bytes).forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s);
  }
  function unb64(str) {
    var bin = atob(str.replace(/\s/g, ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function checkPassword(pw) {
    return crypto.subtle.digest('SHA-256', enc.encode('cria-cibao-admin:' + pw))
      .then(function (d) { return hex(d) === PASS_HASH; });
  }
  function keyFrom(pw, salt) {
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function lockToken(tok, pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return keyFrom(pw, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(tok));
    }).then(function (ct) {
      return JSON.stringify({ s: b64(salt), i: b64(iv), c: b64(ct) });
    });
  }
  function unlockToken(blob, pw) {
    var o = JSON.parse(blob);
    return keyFrom(pw, unb64(o.s)).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.i) }, key, unb64(o.c));
    }).then(function (pt) { return new TextDecoder().decode(pt); });
  }
  function stored() { try { return localStorage.getItem(STORE); } catch (e) { return null; } }

  /* ---------- GitHub ---------- */

  function gh(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + (opts.token || token),
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  }

  /* ---------- 1. Password ---------- */

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('login-msg');
    if (!window.crypto || !crypto.subtle) {
      say(msg, 'Open this page with https:// to use admin.', 'Abrí esta página con https:// para usar el admin.', 'error');
      return;
    }
    var pw = $('password').value;
    checkPassword(pw).then(function (ok) {
      if (!ok) {
        say(msg, 'Wrong password.', 'Contraseña incorrecta.', 'error');
        $('password').select();
        return;
      }
      password = pw;
      $('password').value = '';
      try { if (localStorage.getItem('skipgc') === null) localStorage.setItem('skipgc', 't'); } catch (err) {}
      say(msg, '');
      var blob = stored();
      if (!blob) { show('view-connect'); return; }
      unlockToken(blob, pw).then(function (tok) {
        token = tok;
        load();
      }, function () {
        // saved with an older password: set the device up again
        try { localStorage.removeItem(STORE); } catch (err) {}
        show('view-connect');
      });
    });
  });

  /* ---------- 2. Connect this device ---------- */

  $('connect-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('connect-msg');
    var tok = $('token').value.trim();
    say(msg, 'Checking the key...', 'Revisando la clave...');
    gh('', { token: tok }).then(function (r) {
      if (r.status === 401) throw 'bad';
      if (!r.ok) throw 'net';
      return r.json();
    }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw 'perm';
      token = tok;
      $('token').value = '';
      return lockToken(tok, password).then(function (blob) {
        try { localStorage.setItem(STORE, blob); } catch (err) {}
        say(msg, '');
        load();
      });
    }).catch(function (err) {
      if (err === 'bad') say(msg, 'That key did not work. Check you copied all of it.', 'Esa clave no funcionó. Revisá que la copiaste completa.', 'error');
      else if (err === 'perm') say(msg, 'That key cannot make changes. Create it again with the box <b>public_repo</b> ticked.', 'Esa clave no puede hacer cambios. Creala de nuevo con la casilla <b>public_repo</b> marcada.', 'error');
      else say(msg, 'Could not reach GitHub. Check your connection and try again.', 'No se pudo conectar con GitHub. Revisá tu conexión y probá de nuevo.', 'error');
    });
  });

  /* ---------- 3. Editor ---------- */

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function current() {
    var sold = [];
    document.querySelectorAll('.sold-list input').forEach(function (c) { if (c.checked) sold.push(c.value); });
    return { updated: $('updated').value || today(), sold: sold };
  }
  function serialize(data) {
    return '{\n  "updated": ' + JSON.stringify(data.updated) + ',\n  "sold": ' + JSON.stringify(data.sold).replace(/","/g, '", "') + '\n}\n';
  }
  function markDirty() {
    var dirty = serialize(current()) !== saved;
    if (dirty) say($('save-msg'), 'You have unsaved changes.', 'Tenés cambios sin guardar.');
    else say($('save-msg'), 'Everything is saved.', 'Todo está guardado.');
  }

  function fill(data) {
    $('updated').value = data.updated || today();
    var sold = data.sold || [];
    document.querySelectorAll('.sold-list input').forEach(function (c) { c.checked = sold.indexOf(c.value) !== -1; });
    saved = serialize(current());
  }

  function readFile() {
    return gh('/contents/' + FILE + '?ref=' + BRANCH).then(function (r) {
      if (r.status === 404) return { sha: null, data: { updated: today(), sold: [] } };
      if (r.status === 401) throw 'auth';
      if (!r.ok) throw 'net';
      return r.json().then(function (j) {
        return { sha: j.sha, data: JSON.parse(new TextDecoder().decode(unb64(j.content))) };
      });
    });
  }

  function load() {
    show('view-edit');
    loadStats();
    say($('save-msg'), 'Loading...', 'Cargando...');
    readFile().then(function (f) {
      fileSha = f.sha;
      fill(f.data);
      markDirty();
    }).catch(function (err) {
      if (err === 'auth') {
        forget();
        say($('connect-msg'), 'The GitHub key stopped working. Please connect this device again.', 'La clave de GitHub dejó de funcionar. Conectá este dispositivo de nuevo.', 'error');
        show('view-connect');
      } else {
        say($('save-msg'), 'Could not load the current settings. Check your connection and reload.', 'No se pudo cargar la configuración. Revisá tu conexión y recargá.', 'error');
      }
    });
  }

  function save(retry) {
    var btn = $('save');
    var text = serialize(current());
    btn.disabled = true;
    say($('save-msg'), 'Saving...', 'Guardando...');
    var body = { message: 'Update from the admin page', content: b64(enc.encode(text)), branch: BRANCH };
    if (fileSha) body.sha = fileSha;
    gh('/contents/' + FILE, { method: 'PUT', body: body }).then(function (r) {
      if ((r.status === 409 || r.status === 422) && !retry) {
        // the file changed since it was loaded: pick up the latest version and save on top
        return readFile().then(function (f) { fileSha = f.sha; return save(true); });
      }
      if (!r.ok) throw r.status;
      return r.json().then(function (j) {
        fileSha = j.content.sha;
        saved = text;
        say($('save-msg'), 'Saved. The website will show it in about a minute.', 'Guardado. La página lo va a mostrar en más o menos un minuto.', 'ok');
      });
    }).catch(function () {
      say($('save-msg'), 'Could not save. Check your connection and try again.', 'No se pudo guardar. Revisá tu conexión y probá de nuevo.', 'error');
    }).then(function () { btn.disabled = false; });
  }

  $('today').addEventListener('click', function () { $('updated').value = today(); markDirty(); });
  $('updated').addEventListener('change', markDirty);
  document.querySelectorAll('.sold-list input').forEach(function (c) { c.addEventListener('change', markDirty); });
  $('save').addEventListener('click', function () { save(false); });

  function lock() {
    password = null;
    token = null;
    show('view-login');
  }
  function forget() {
    try { localStorage.removeItem(STORE); } catch (e) {}
  }
  $('lock').addEventListener('click', lock);
  $('forget').addEventListener('click', function () { forget(); lock(); });

  window.addEventListener('beforeunload', function (e) {
    if (!$('view-edit').hidden && saved !== null && serialize(current()) !== saved) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ---------- Visitor stats (GoatCounter) ---------- */

  // GoatCounter's public counter: CORS-enabled JSON, needs "Allow adding visitor counts"
  // in the GoatCounter settings. ?end=DATE counts every hour up to DATE 00:00 UTC, so a
  // day's visitors are the difference between two consecutive running totals.
  var COUNTER = 'https://criacibaolapampa.goatcounter.com/counter/TOTAL.json';
  var DAYS = 30;
  var statsLoaded = false;

  function isoUTC(d) { return d.toISOString().slice(0, 10); }
  function num(s) { return Number(String(s).replace(/[^0-9]/g, '')) || 0; }
  function fmt(n) { return new Intl.NumberFormat(lang() === 'es' ? 'es-AR' : 'en-GB').format(n); }
  function dayLabel(iso, long) {
    return new Intl.DateTimeFormat(lang() === 'es' ? 'es-AR' : 'en-GB', long
      ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
  }

  function counter(query) {
    return fetch(COUNTER + query, { cache: 'no-store' }).then(function (r) {
      if (r.status === 403) throw 'setting';
      return r.json().then(function (j) {
        if (j.count === undefined) throw 'missing';
        return num(j.count);
      }, function () { throw 'missing'; });
    });
  }

  function loadStats() {
    if (statsLoaded) return;
    var msg = $('stats-msg');
    say(msg, 'Loading visitor numbers...', 'Cargando las visitas...');
    try { $('skip-me').checked = localStorage.getItem('skipgc') === 't'; } catch (e) {}

    var today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    var ends = [];
    for (var i = DAYS - 1; i >= -1; i--) ends.push(isoUTC(new Date(today.getTime() - i * 864e5)));

    Promise.all([counter('')].concat(ends.map(function (d) { return counter('?end=' + d); })))
      .then(function (res) {
        var all = res[0], cum = res.slice(1), days = [];
        for (var k = 0; k < DAYS; k++) days.push({ date: ends[k], n: Math.max(0, cum[k + 1] - cum[k]) });
        statsLoaded = true;
        say(msg, '');
        $('stats-setup').hidden = true;
        $('stats-body').hidden = false;
        renderStats(all, days);
      })
      .catch(function (err) {
        $('stats-body').hidden = true;
        if (err === 'setting') {
          say(msg, 'Almost there: in GoatCounter open <b>Settings</b>, tick <b>Allow adding visitor counts on your website</b> and save.', 'Casi listo: en GoatCounter abrí <b>Settings</b>, marcá <b>Allow adding visitor counts on your website</b> y guardá.', 'error');
          $('stats-setup').hidden = true;
        } else {
          say(msg, 'Visitor stats are not connected yet.', 'Las estadísticas de visitas todavía no están conectadas.');
          $('stats-setup').hidden = false;
        }
      });
  }

  var lastStats = null;
  function renderStats(all, days) {
    lastStats = [all, days];
    var sum = function (n) { return days.slice(-n).reduce(function (a, d) { return a + d.n; }, 0); };
    $('st-all').textContent = fmt(all);
    $('st-today').textContent = fmt(days[days.length - 1].n);
    $('st-7').textContent = fmt(sum(7));
    $('st-30').textContent = fmt(sum(30));

    var max = Math.max.apply(null, days.map(function (d) { return d.n; }));
    var top = niceCeil(max);
    var plot = $('chart');
    plot.textContent = '';
    [0, top / 2, top].forEach(function (v, idx) {
      if (idx === 1 && v % 1) return;
      var g = document.createElement('div');
      g.className = 'chart-grid' + (v === 0 ? ' is-base' : '');
      g.style.bottom = (v / top * 100) + '%';
      var s = document.createElement('span');
      s.textContent = fmt(v);
      g.appendChild(s);
      plot.appendChild(g);
    });

    var bars = document.createElement('div');
    bars.className = 'chart-bars';
    var peak = -1;
    days.forEach(function (d, i) { if (d.n > 0 && (peak < 0 || d.n >= days[peak].n)) peak = i; });
    var rows = $('chart-rows');
    rows.textContent = '';
    days.forEach(function (d, i) {
      var col = document.createElement('button');
      col.type = 'button';
      col.className = 'chart-col';
      col.setAttribute('aria-label', dayLabel(d.date, true) + ': ' + fmt(d.n));
      if (i === peak) {
        var cap = document.createElement('span');
        cap.className = 'chart-cap';
        cap.textContent = fmt(d.n);
        col.appendChild(cap);
      }
      var bar = document.createElement('span');
      bar.className = 'chart-bar';
      bar.style.height = (d.n / top * 100) + '%';
      col.appendChild(bar);
      var showTip = function () { tip(col, d); };
      col.addEventListener('pointerenter', showTip);
      col.addEventListener('focus', showTip);
      col.addEventListener('click', showTip);
      col.addEventListener('pointerleave', hideTip);
      col.addEventListener('blur', hideTip);
      bars.appendChild(col);

      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      var td2 = document.createElement('td');
      td1.textContent = dayLabel(d.date, true);
      td2.textContent = fmt(d.n);
      tr.appendChild(td1);
      tr.appendChild(td2);
      rows.insertBefore(tr, rows.firstChild); // newest first
    });
    plot.appendChild(bars);

    var x = $('chart-x');
    x.textContent = '';
    [0, Math.floor((days.length - 1) / 2), days.length - 1].forEach(function (i) {
      var s = document.createElement('span');
      s.textContent = i === days.length - 1 ? (lang() === 'es' ? 'Hoy' : 'Today') : dayLabel(days[i].date);
      x.appendChild(s);
    });
  }

  function niceCeil(v) {
    if (v <= 4) return 4;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v) return steps[i] * p;
    return 10 * p;
  }

  function tip(col, d) {
    var t = $('chart-tip');
    var fig = t.parentNode.getBoundingClientRect();
    var c = col.getBoundingClientRect();
    var bar = col.querySelector('.chart-bar').getBoundingClientRect();
    t.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = fmt(d.n) + ' ' + (lang() === 'es' ? (d.n === 1 ? 'visita' : 'visitas') : (d.n === 1 ? 'visitor' : 'visitors'));
    var span = document.createElement('span');
    span.textContent = dayLabel(d.date, true);
    t.appendChild(strong);
    t.appendChild(span);
    t.hidden = false;
    var left = c.left + c.width / 2 - fig.left;
    var half = t.offsetWidth / 2;
    left = Math.max(half, Math.min(fig.width - half, left));
    t.style.left = left + 'px';
    t.style.top = (Math.min(bar.top, c.bottom - 2) - fig.top) + 'px';
    document.querySelectorAll('.chart-col.is-active').forEach(function (e) { e.classList.remove('is-active'); });
    col.classList.add('is-active');
  }
  function hideTip() {
    $('chart-tip').hidden = true;
    document.querySelectorAll('.chart-col.is-active').forEach(function (e) { e.classList.remove('is-active'); });
  }

  // re-render numbers and dates when the language switches
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { if (lastStats) renderStats(lastStats[0], lastStats[1]); });
  });

  $('skip-me').addEventListener('change', function () {
    try {
      // GoatCounter skips counting only when this is 't'; 'f' remembers the owner chose to be counted
      localStorage.setItem('skipgc', this.checked ? 't' : 'f');
    } catch (e) {}
  });

  show('view-login');
})();
