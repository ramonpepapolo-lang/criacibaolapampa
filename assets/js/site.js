(function () {
  'use strict';

  var root = document.documentElement;
  var current = null; // index of the horse open in the dialog
  var opener = null;
  // data/site.json, edited on the admin page:
  // { updated: 'YYYY-MM-DD', sold: [slug], announcement: { en, es }, horses: [added horses] }
  var siteStatus = null;
  var EMAIL = 'info@criacibaolapampa.com';
  var TITLES = {
    en: 'Cría Cibao La Pampa · Polo Horses, La Pampa, Argentina',
    es: 'Cría Cibao La Pampa · Caballos de Polo, La Pampa, Argentina'
  };
  var MAIL = {
    en: function (name) { return { subject: 'Enquiry: ' + name, body: 'Hi, I am interested in ' + name + '.\n\n' }; },
    es: function (name) { return { subject: 'Consulta: ' + name, body: 'Hola, me interesa ' + name + '.\n\n' }; }
  };

  function lang() { return root.getAttribute('data-lang') === 'es' ? 'es' : 'en'; }
  function li() { return lang() === 'es' ? 1 : 0; }

  /* ---------- Language ---------- */

  function applyLang(l) {
    root.setAttribute('data-lang', l);
    root.lang = l;
    document.title = TITLES[l];
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l));
    });
    document.querySelectorAll('[data-label-' + l + ']').forEach(function (el) {
      el.setAttribute('aria-label', el.getAttribute('data-label-' + l));
    });
    if (current !== null) fillDialog(current);
    renderUpdated();
    renderAnnouncement();
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      var l = b.getAttribute('data-set-lang');
      try { localStorage.setItem('lang', l); } catch (e) {}
      applyLang(l);
    });
  });

  /* ---------- Header ---------- */

  var header = document.getElementById('site-header');
  var toggle = document.querySelector('.menu-toggle');

  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  toggle.addEventListener('click', function () {
    setMenu(!header.classList.contains('menu-open'));
  });
  document.querySelectorAll('.site-nav a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) setMenu(false);
  });

  /* ---------- Horse dialog ---------- */

  var horses = JSON.parse(document.getElementById('horse-data').textContent);
  var dialog = document.getElementById('horse-dialog');
  var img = document.getElementById('dlg-img');

  function bi(pair) {
    return '<span lang="en">' + pair[0] + '</span><span lang="es">' + pair[1] + '</span>';
  }

  function fillDialog(i) {
    var h = horses[i];
    var full = 'Cibao ' + h.name;
    current = i;
    img.src = h.full;
    img.width = h.w;
    img.height = h.h;
    img.alt = full;
    document.getElementById('dlg-name').textContent = h.name;
    document.getElementById('dlg-sex').innerHTML = bi(h.sex);
    document.getElementById('dlg-age').innerHTML = bi(h.age);
    document.getElementById('dlg-purchased').innerHTML = bi(h.purchased);
    document.getElementById('dlg-mallet').textContent = h.mallet;
    document.getElementById('dlg-sold').hidden = !h.sold;
    document.getElementById('dlg-count').textContent = (i + 1) + ' / ' + horses.length;
    var mail = MAIL[lang()](full);
    document.getElementById('dlg-mail').href = 'mailto:' + EMAIL +
      '?subject=' + encodeURIComponent(mail.subject) + '&body=' + encodeURIComponent(mail.body);
    // warm the neighbours so next/previous feels instant
    [i - 1, i + 1].forEach(function (n) {
      var k = (n + horses.length) % horses.length;
      new Image().src = horses[k].full;
    });
  }

  function setHash(hash) {
    try { history.replaceState(null, '', hash); } catch (e) {}
  }

  // Anonymous counts for the admin page (GoatCounter events; skipped on the owner's devices)
  function track(path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, title: title, event: true });
      }
    } catch (e) {}
  }
  function viewed(i) { track('view-' + horses[i].slug, 'Viewed Cibao ' + horses[i].name); }

  function openHorse(i, from) {
    opener = from || null;
    fillDialog(i);
    viewed(i);
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    setHash('#horse-' + horses[i].slug);
  }

  function step(d) {
    if (current === null) return;
    var i = (current + d + horses.length) % horses.length;
    fillDialog(i);
    viewed(i);
    setHash('#horse-' + horses[i].slug);
  }

  function closeDialog() {
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }

  dialog.addEventListener('close', function () {
    var slug = current !== null ? horses[current].slug : null;
    current = null;
    setHash('#horses');
    var target = opener || (slug && document.querySelector('#horse-' + slug + ' .horse-open'));
    if (target) target.focus({ preventScroll: false });
    opener = null;
  });

  function indexOf(slug) {
    for (var i = 0; i < horses.length; i++) if (horses[i].slug === slug) return i;
    return -1;
  }
  // one listener for every card, including horses added later from the admin page
  document.querySelector('.horse-grid').addEventListener('click', function (e) {
    var b = e.target.closest('.horse-open');
    if (!b) return;
    var i = indexOf(b.closest('.horse').id.replace(/^horse-/, ''));
    if (i !== -1) openHorse(i, b);
  });
  document.getElementById('dlg-mail').addEventListener('click', function () {
    if (current !== null) track('enquiry-' + horses[current].slug, 'Enquiry: Cibao ' + horses[current].name);
  });
  document.querySelectorAll('[data-mailto]').forEach(function (a) {
    a.addEventListener('click', function () { track('enquiry-general', 'Enquiry: general'); });
  });
  dialog.querySelector('[data-close]').addEventListener('click', closeDialog);
  dialog.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () { step(Number(b.getAttribute('data-step'))); });
  });
  // click on the dimmed backdrop closes
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();
  });
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  // swipe between horses on touch screens
  var touchX = null;
  dialog.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  dialog.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  });

  // links like criacibaolapampa.com/#horse-drogba open that horse directly
  function fromHash() {
    var m = /^#horse-(.+)$/.exec(location.hash);
    if (!m || dialog.open) return;
    var i = indexOf(m[1]);
    if (i !== -1) openHorse(i);
  }

  /* ---------- Sold horses and "last updated" (set on the admin page) ---------- */

  var MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function biEl(tag, en, es) {
    var wrap = document.createDocumentFragment();
    var a = el(tag, '', en); a.lang = 'en';
    var b = el(tag, '', es); b.lang = 'es';
    wrap.appendChild(a);
    wrap.appendChild(b);
    return wrap;
  }

  // Horses added on the admin page: same card as the others, newest first.
  function addedHorse(a) {
    var m = /^(\d{4})-(\d{2})$/.exec(a.purchased || '');
    var age = Number(a.age) || 0;
    return {
      slug: a.slug,
      name: a.name,
      full: a.photo,
      w: a.w || 1600,
      h: a.h || 1200,
      thumb: a.thumb,
      sex: a.sex === 'm' ? ['Gelding', 'Macho'] : ['Mare', 'Hembra'],
      age: [age + (age === 1 ? ' year' : ' years'), age + (age === 1 ? ' año' : ' años')],
      purchased: m ? [MONTHS.en[Number(m[2]) - 1] + ' ' + m[1], MONTHS.es[Number(m[2]) - 1] + ' ' + m[1]] : ['', ''],
      mallet: String(a.mallet || '')
    };
  }

  function horseCard(h) {
    var li = el('li', 'horse');
    li.id = 'horse-' + h.slug;
    var photo = el('div', 'horse-photo');
    var im = el('img');
    im.src = h.thumb;
    im.width = 640;
    im.height = 533;
    im.loading = 'lazy';
    im.decoding = 'async';
    im.alt = 'Cibao ' + h.name;
    photo.appendChild(im);
    var body = el('div', 'horse-body');
    var h3 = el('h3');
    var btn = el('button', 'horse-open');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.appendChild(el('small', '', 'Cibao'));
    btn.appendChild(document.createTextNode(h.name));
    h3.appendChild(btn);
    var dl = el('dl', 'meta');
    [[['Sex', 'Sexo'], h.sex], [['Age', 'Edad'], h.age], [['Purchased', 'Compra'], h.purchased], [['Mallet size', 'Taco'], [h.mallet, h.mallet]]]
      .forEach(function (row) {
        var d = el('div');
        var dt = el('dt'); dt.appendChild(biEl('span', row[0][0], row[0][1]));
        var dd = el('dd'); dd.appendChild(biEl('span', row[1][0], row[1][1]));
        d.appendChild(dt);
        d.appendChild(dd);
        dl.appendChild(d);
      });
    var more = el('span', 'horse-more');
    more.setAttribute('aria-hidden', 'true');
    more.appendChild(biEl('span', 'View details', 'Ver ficha'));
    body.appendChild(h3);
    body.appendChild(dl);
    body.appendChild(more);
    li.appendChild(photo);
    li.appendChild(body);
    return li;
  }

  function renderAdded(list) {
    var grid = document.querySelector('.horse-grid');
    grid.querySelectorAll('.horse.is-added').forEach(function (e) { e.remove(); });
    var bySlug = {};
    horses.forEach(function (h) { bySlug[h.slug] = h; });
    (list || []).slice().reverse().forEach(function (a) {
      if (!a || !a.slug || !a.photo || document.getElementById('horse-' + a.slug)) return;
      var h = addedHorse(a);
      bySlug[h.slug] = h;
      var card = horseCard(h);
      card.classList.add('is-added');
      grid.insertBefore(card, grid.firstChild);
    });
    // keep next / previous in the same order as the cards on the page
    horses = Array.prototype.map.call(grid.querySelectorAll('.horse[id^="horse-"]'), function (c) {
      return bySlug[c.id.replace(/^horse-/, '')];
    }).filter(Boolean);
    var count = document.querySelector('.horses-count');
    if (count) count.textContent = horses.length;
  }

  function renderAnnouncement() {
    var bar = document.getElementById('announce');
    if (!bar || !siteStatus) return;
    var a = siteStatus.announcement || {};
    var en = String(a.en || '').trim();
    var es = String(a.es || '').trim();
    var text = lang() === 'es' ? (es || en) : (en || es);
    bar.hidden = !text;
    bar.querySelector('p').textContent = text;
    root.style.setProperty('--announce-h', text ? bar.offsetHeight + 'px' : '0px');
  }
  window.addEventListener('resize', renderAnnouncement);

  function applyStatus(s) {
    siteStatus = s || { sold: [] };
    renderAdded(siteStatus.horses);
    var sold = siteStatus.sold || [];
    horses.forEach(function (h) {
      h.sold = sold.indexOf(h.slug) !== -1;
      var card = document.getElementById('horse-' + h.slug);
      if (!card) return;
      card.classList.toggle('is-sold', h.sold);
      var band = card.querySelector('.sold-band');
      if (h.sold && !band) {
        band = document.createElement('span');
        band.className = 'sold-band';
        band.innerHTML = bi(['Sold', 'Vendida']);
        card.querySelector('.horse-photo').prepend(band);
      } else if (!h.sold && band) {
        band.remove();
      }
    });
    if (current !== null) fillDialog(current);
    renderUpdated();
    renderAnnouncement();
    fromHash(); // a link to a horse added on the admin page can only open once it is loaded
  }

  function renderUpdated() {
    var el = document.getElementById('last-updated');
    var m = siteStatus && /^(\d{4})-(\d{2})-(\d{2})$/.exec(siteStatus.updated || '');
    if (!el || !m) return;
    var date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    var t = el.querySelector('time');
    t.setAttribute('datetime', siteStatus.updated);
    t.textContent = new Intl.DateTimeFormat(lang() === 'es' ? 'es-AR' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    el.hidden = false;
  }

  fetch('data/site.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
    .catch(function () { return JSON.parse(document.getElementById('site-status').textContent); })
    .then(applyStatus);

  /* ---------- Reveal on scroll ---------- */

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  applyLang(lang());
  fromHash();
  window.addEventListener('hashchange', fromHash);
})();
