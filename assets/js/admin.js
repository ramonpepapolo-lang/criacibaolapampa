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

  // The horses built into the page, in page order: [{ slug, name, thumb }]
  var STATIC_HORSES = JSON.parse($('static-horses').textContent);
  var added = [];  // horses added from this page, newest first (site.json "horses")
  var extra = {};  // any other fields in site.json, kept as they are

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function allHorses() {
    return added.map(function (a) { return { slug: a.slug, name: a.name, thumb: a.thumb }; }).concat(STATIC_HORSES);
  }

  function soldNow() {
    var sold = [];
    document.querySelectorAll('#sold-list input').forEach(function (c) { if (c.checked) sold.push(c.value); });
    return sold;
  }

  function current() {
    var data = {};
    Object.keys(extra).forEach(function (k) { data[k] = extra[k]; });
    data.updated = $('updated').value || today();
    data.sold = soldNow();
    data.announcement = { en: $('ann-en').value.trim(), es: $('ann-es').value.trim() };
    data.horses = added;
    return data;
  }
  function serialize(data) { return JSON.stringify(data, null, 2) + '\n'; }
  function markDirty() {
    var dirty = serialize(current()) !== saved;
    if (dirty) say($('save-msg'), 'You have unsaved changes.', 'Tenés cambios sin guardar.');
    else say($('save-msg'), 'Everything is saved.', 'Todo está guardado.');
  }

  function text(tag, cls, value) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = value;
    return e;
  }
  function biHtml(en, es) { return '<span lang="en">' + en + '</span><span lang="es">' + es + '</span>'; }

  function renderSoldList(sold) {
    var ul = $('sold-list');
    ul.textContent = '';
    allHorses().forEach(function (h) {
      var li = document.createElement('li');
      var label = document.createElement('label');
      var im = text('img');
      im.src = '../' + h.thumb;
      im.alt = '';
      im.width = 72;
      im.height = 60;
      im.loading = 'lazy';
      var name = text('span', 'name');
      name.appendChild(text('small', '', 'Cibao'));
      name.appendChild(document.createTextNode(h.name));
      var sw = text('span', 'switch');
      var input = text('input');
      input.type = 'checkbox';
      input.value = h.slug;
      input.checked = sold.indexOf(h.slug) !== -1;
      input.addEventListener('change', markDirty);
      var track = text('span', 'track');
      track.setAttribute('aria-hidden', 'true');
      var state = text('span', 'state');
      state.setAttribute('aria-hidden', 'true');
      state.innerHTML = '<span class="off">' + biHtml('For sale', 'En venta') + '</span><span class="on">' + biHtml('Sold', 'Vendida') + '</span>';
      sw.appendChild(input);
      sw.appendChild(track);
      sw.appendChild(state);
      label.appendChild(im);
      label.appendChild(name);
      label.appendChild(sw);
      li.appendChild(label);
      ul.appendChild(li);
    });
  }

  function fill(data) {
    extra = {};
    Object.keys(data).forEach(function (k) {
      if (['updated', 'sold', 'announcement', 'horses'].indexOf(k) === -1) extra[k] = data[k];
    });
    added = Array.isArray(data.horses) ? data.horses : [];
    $('updated').value = data.updated || today();
    var a = data.announcement || {};
    $('ann-en').value = a.en || '';
    $('ann-es').value = a.es || '';
    renderSoldList(data.sold || []);
    renderAddedList();
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
    var body_ = serialize(current());
    btn.disabled = true;
    say($('save-msg'), 'Saving...', 'Guardando...');
    var body = { message: 'Update from the admin page', content: b64(enc.encode(body_)), branch: BRANCH };
    if (fileSha) body.sha = fileSha;
    return gh('/contents/' + FILE, { method: 'PUT', body: body }).then(function (r) {
      if ((r.status === 409 || r.status === 422) && !retry) {
        // the file changed since it was loaded: pick up the latest version and save on top
        return readFile().then(function (f) { fileSha = f.sha; btn.disabled = false; return save(true); });
      }
      if (!r.ok) throw r.status;
      return r.json().then(function (j) {
        fileSha = j.content.sha;
        saved = body_;
        say($('save-msg'), 'Saved. The website will show it in about a minute.', 'Guardado. La página lo va a mostrar en más o menos un minuto.', 'ok');
      });
    }).catch(function () {
      say($('save-msg'), 'Could not save. Check your connection and try again.', 'No se pudo guardar. Revisá tu conexión y probá de nuevo.', 'error');
    }).then(function () { btn.disabled = false; });
  }

  $('today').addEventListener('click', function () { $('updated').value = today(); markDirty(); });
  $('updated').addEventListener('change', markDirty);
  $('ann-en').addEventListener('input', markDirty);
  $('ann-es').addEventListener('input', markDirty);
  $('ann-clear').addEventListener('click', function () { $('ann-en').value = ''; $('ann-es').value = ''; markDirty(); });
  $('save').addEventListener('click', function () { save(false); });

  /* ---------- Several files in one change (photos + site.json) ---------- */

  function ghJson(path, opts) {
    return gh(path, opts).then(function (r) {
      if (r.status === 401) throw 'auth';
      if (!r.ok) { var e = new Error('GitHub ' + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }

  // files: [{ path, b64 } | { path, text } | { path, remove: true }]; returns { path: blobSha }
  function commitFiles(files, message, attempt) {
    var blobs = {};
    return ghJson('/git/ref/heads/' + BRANCH).then(function (ref) {
      var parent = ref.object.sha;
      return ghJson('/git/commits/' + parent).then(function (base) {
        return Promise.all(files.map(function (f) {
          if (f.remove) return { path: f.path, mode: '100644', type: 'blob', sha: null };
          var content = f.b64 || b64(enc.encode(f.text));
          return ghJson('/git/blobs', { method: 'POST', body: { content: content, encoding: 'base64' } }).then(function (b) {
            blobs[f.path] = b.sha;
            return { path: f.path, mode: '100644', type: 'blob', sha: b.sha };
          });
        })).then(function (tree) {
          return ghJson('/git/trees', { method: 'POST', body: { base_tree: base.tree.sha, tree: tree } });
        }).then(function (t) {
          return ghJson('/git/commits', { method: 'POST', body: { message: message, tree: t.sha, parents: [parent] } });
        }).then(function (c) {
          return ghJson('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: c.sha } });
        });
      });
    }).then(function () { return blobs; }, function (err) {
      // the website changed at the same moment (e.g. another device saved): try once more
      if (err && err.status === 422 && !attempt) return commitFiles(files, message, 1);
      throw err;
    });
  }

  /* ---------- Add a horse ---------- */

  var MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  };
  (function fillDateSelects() {
    var now = new Date();
    MONTHS.en.forEach(function (m, i) {
      var o = text('option', '', m + ' / ' + MONTHS.es[i]);
      o.value = ('0' + (i + 1)).slice(-2);
      if (i === now.getMonth()) o.selected = true;
      $('h-month').appendChild(o);
    });
    for (var y = now.getFullYear() + 1; y >= 2015; y--) {
      var o = text('option', '', String(y));
      o.value = String(y);
      if (y === now.getFullYear()) o.selected = true;
      $('h-year').appendChild(o);
    }
  })();

  var photo = null; // { full: Blob, card: Blob, w, h }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject('format'); };
      im.src = URL.createObjectURL(file);
    });
  }
  function drawTo(im, sx, sy, sw, sh, w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    return c;
  }
  function jpeg(canvas) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.8); });
  }
  function blobB64(blob) {
    return new Promise(function (resolve) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.readAsDataURL(blob);
    });
  }
  // Big photo for the detail view (max 1600px) and a 6:5 card crop from the middle.
  function makeImages(im) {
    var W = im.naturalWidth, H = im.naturalHeight, R = 6 / 5;
    var s = Math.min(1, 1600 / Math.max(W, H));
    var fw = Math.round(W * s), fh = Math.round(H * s);
    var cw = W / H > R ? H * R : W;
    var ch = W / H > R ? H : W / R;
    var full = drawTo(im, 0, 0, W, H, fw, fh);
    var card = drawTo(im, (W - cw) / 2, (H - ch) / 2, cw, ch, 800, 667);
    return Promise.all([jpeg(full), jpeg(card)]).then(function (b) {
      return { full: b[0], card: b[1], w: fw, h: fh, preview: card.toDataURL('image/jpeg', 0.7) };
    });
  }

  $('h-photo').addEventListener('change', function () {
    var file = this.files && this.files[0];
    photo = null;
    $('h-preview').hidden = true;
    if (!file) return;
    say($('add-msg'), 'Preparing the photo...', 'Preparando la foto...');
    loadImage(file).then(makeImages).then(function (p) {
      photo = p;
      $('h-preview').querySelector('img').src = p.preview;
      $('h-preview').hidden = false;
      say($('add-msg'), '');
    }).catch(function () {
      say($('add-msg'), 'This photo could not be opened. Try a JPG or PNG, or take a screenshot of the photo and use that.', 'No se pudo abrir esta foto. Probá con una JPG o PNG, o sacale una captura de pantalla y usá esa.', 'error');
    });
  });

  function slugify(name) {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'horse';
  }
  function uniqueSlug(base) {
    var taken = allHorses().map(function (h) { return h.slug; });
    var s = base, n = 2;
    while (taken.indexOf(s) !== -1) s = base + '-' + n++;
    return s;
  }

  function commitError(msgEl, err) {
    if (err === 'auth') {
      say(msgEl, 'The GitHub key stopped working. Lock the page and connect this device again.', 'La clave de GitHub dejó de funcionar. Cerrá y conectá este dispositivo de nuevo.', 'error');
    } else {
      say(msgEl, 'Could not save. Check your connection and try again.', 'No se pudo guardar. Revisá tu conexión y probá de nuevo.', 'error');
    }
  }

  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('add-msg');
    var name = $('h-name').value.trim().replace(/^cibao\s+/i, '');
    var age = parseInt($('h-age').value, 10);
    var mallet = parseInt($('h-mallet').value, 10);
    if (!name) { say(msg, 'Write the horse\'s name.', 'Escribí el nombre del caballo.', 'error'); $('h-name').focus(); return; }
    if (!(age > 0 && age < 40)) { say(msg, 'Write the age in years.', 'Escribí la edad en años.', 'error'); $('h-age').focus(); return; }
    if (!(mallet > 0)) { say(msg, 'Write the mallet size.', 'Escribí el taco.', 'error'); $('h-mallet').focus(); return; }
    if (!photo) { say(msg, 'Choose a photo.', 'Elegí una foto.', 'error'); return; }

    var slug = uniqueSlug(slugify(name));
    var stamp = Date.now().toString(36);
    var horse = {
      slug: slug,
      name: name,
      sex: $('h-sex').value,
      age: age,
      purchased: $('h-year').value + '-' + $('h-month').value,
      mallet: String(mallet),
      photo: 'assets/img/horses/added/' + slug + '-' + stamp + '.jpg',
      thumb: 'assets/img/horses/added/' + slug + '-' + stamp + '-card.jpg',
      w: photo.w,
      h: photo.h,
      added: today()
    };
    var btn = $('h-add');
    btn.disabled = true;
    say(msg, 'Uploading...', 'Subiendo...');
    var before = added;
    added = [horse].concat(added);
    var data = serialize(current());
    Promise.all([blobB64(photo.full), blobB64(photo.card)]).then(function (b) {
      return commitFiles([
        { path: horse.photo, b64: b[0] },
        { path: horse.thumb, b64: b[1] },
        { path: FILE, text: data }
      ], 'Add Cibao ' + name + ' from the admin page');
    }).then(function (blobs) {
      fileSha = blobs[FILE];
      saved = data;
      renderSoldList(soldNow());
      renderAddedList();
      $('add-form').reset();
      fillDefaults();
      photo = null;
      $('h-preview').hidden = true;
      say(msg, 'Cibao ' + name + ' was added. It will be on the website in about a minute.', 'Se agregó Cibao ' + name + '. Va a estar en la página en más o menos un minuto.', 'ok');
      markDirty();
      rankingLoaded = false;
      if (statsLoaded) loadRanking();
    }).catch(function (err) {
      added = before;
      commitError(msg, err);
    }).then(function () { btn.disabled = false; });
  });

  function fillDefaults() {
    var now = new Date();
    $('h-month').value = ('0' + (now.getMonth() + 1)).slice(-2);
    $('h-year').value = String(now.getFullYear());
  }

  function renderAddedList() {
    var ul = $('added-list');
    ul.textContent = '';
    $('added-wrap').hidden = added.length === 0;
    added.forEach(function (h) {
      var li = document.createElement('li');
      var im = text('img');
      im.src = '../' + h.thumb;
      im.alt = '';
      im.width = 72;
      im.height = 60;
      var name = text('span', 'name');
      name.appendChild(text('small', '', 'Cibao'));
      name.appendChild(document.createTextNode(h.name));
      var btn = text('button', 'btn btn-ghost btn-sm');
      btn.type = 'button';
      btn.innerHTML = biHtml('Remove', 'Quitar');
      var armed = null;
      btn.addEventListener('click', function () {
        if (!armed) {
          btn.innerHTML = biHtml('Tap again to remove', 'Tocá de nuevo para quitar');
          btn.classList.add('is-armed');
          armed = setTimeout(function () {
            armed = null;
            btn.innerHTML = biHtml('Remove', 'Quitar');
            btn.classList.remove('is-armed');
          }, 4000);
          return;
        }
        clearTimeout(armed);
        removeHorse(h, btn);
      });
      li.appendChild(im);
      li.appendChild(name);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function removeHorse(h, btn) {
    var msg = $('add-msg');
    btn.disabled = true;
    say(msg, 'Removing...', 'Quitando...');
    var before = added;
    added = added.filter(function (a) { return a.slug !== h.slug; });
    var soldBefore = soldNow();
    var data = current();
    data.sold = soldBefore.filter(function (s) { return s !== h.slug; });
    var textOut = serialize(data);
    var files = [{ path: FILE, text: textOut }];
    var withPhotos = files.concat([{ path: h.photo, remove: true }, { path: h.thumb, remove: true }]);
    commitFiles(withPhotos, 'Remove Cibao ' + h.name + ' from the admin page').catch(function (err) {
      if (err === 'auth') throw err;
      return commitFiles(files, 'Remove Cibao ' + h.name + ' from the admin page'); // photos already gone
    }).then(function (blobs) {
      fileSha = blobs[FILE];
      saved = textOut;
      renderSoldList(data.sold);
      renderAddedList();
      say(msg, 'Cibao ' + h.name + ' was removed from the website.', 'Se quitó Cibao ' + h.name + ' de la página.', 'ok');
      markDirty();
      rankingLoaded = false;
      if (statsLoaded) loadRanking();
    }).catch(function (err) {
      added = before;
      btn.disabled = false;
      commitError(msg, err);
    });
  }

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
        loadRanking();
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

  /* ---------- Most viewed horses and enquiries (GoatCounter events from the site) ---------- */

  var GC = 'https://criacibaolapampa.goatcounter.com/counter/';
  var rankingLoaded = false;
  var lastRanking = null;

  function pathCount(path) {
    // a path nobody has triggered yet answers 404 with a count of 0
    return fetch(GC + encodeURIComponent(path) + '.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return num(j.count); }, function () { return 0; });
  }

  function loadRanking() {
    if (rankingLoaded) return;
    rankingLoaded = true;
    $('ranking').hidden = false;
    say($('rank-msg'), 'Loading...', 'Cargando...');
    var list = allHorses();
    Promise.all(list.map(function (h) {
      return Promise.all([pathCount('view-' + h.slug), pathCount('enquiry-' + h.slug)]);
    }).concat([pathCount('enquiry-general')])).then(function (res) {
      var general = res.pop(); // the last request is the general email count
      var rows = list.map(function (h, i) { return { h: h, views: res[i][0], enq: res[i][1] }; });
      renderRanking(rows, general);
    });
  }

  function renderRanking(rows, general) {
    lastRanking = [rows, general];
    rows = rows.slice().sort(function (a, b) { return b.views - a.views || b.enq - a.enq; });
    var max = Math.max.apply(null, rows.map(function (r) { return r.views; }).concat([1]));
    var total = rows.reduce(function (a, r) { return a + r.views + r.enq; }, 0);
    if (!total) say($('rank-msg'), 'No views yet. They appear here as people open the horses\' cards.', 'Todavía no hay vistas. Van a aparecer acá a medida que la gente abra las fichas.');
    else say($('rank-msg'), '');
    var ol = $('rank-list');
    ol.textContent = '';
    rows.forEach(function (r) {
      var li = document.createElement('li');
      var im = text('img');
      im.src = '../' + r.h.thumb;
      im.alt = '';
      im.width = 44;
      im.height = 37;
      im.loading = 'lazy';
      var mid = text('div', 'rank-main');
      var name = text('span', 'rank-name');
      name.appendChild(text('small', '', 'Cibao '));
      name.appendChild(document.createTextNode(r.h.name));
      var track = text('span', 'rank-track');
      var bar = text('span', 'rank-bar');
      bar.style.width = (r.views / max * 100) + '%';
      if (!r.views) bar.hidden = true;
      track.appendChild(bar);
      mid.appendChild(name);
      mid.appendChild(track);
      var v = text('span', 'rank-num', fmt(r.views));
      var q = text('span', 'rank-num', fmt(r.enq));
      li.setAttribute('aria-label', 'Cibao ' + r.h.name + ': ' + r.views + (lang() === 'es' ? ' vistas, ' : ' views, ') + r.enq + (lang() === 'es' ? ' consultas' : ' enquiries'));
      li.appendChild(im);
      li.appendChild(mid);
      li.appendChild(v);
      li.appendChild(q);
      ol.appendChild(li);
    });
    $('rank-general').innerHTML = biHtml('General email clicks (not about one horse): ', 'Clics de email generales (no sobre un caballo): ') + '<b>' + fmt(general) + '</b>';
  }

  // re-render numbers and dates when the language switches
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (lastStats) renderStats(lastStats[0], lastStats[1]);
      if (lastRanking) renderRanking(lastRanking[0], lastRanking[1]);
    });
  });

  $('skip-me').addEventListener('change', function () {
    try {
      // GoatCounter skips counting only when this is 't'; 'f' remembers the owner chose to be counted
      localStorage.setItem('skipgc', this.checked ? 't' : 'f');
    } catch (e) {}
  });

  show('view-login');
})();
