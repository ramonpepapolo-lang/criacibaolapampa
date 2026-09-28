(function () {
  'use strict';

  var root = document.documentElement;
  var current = null; // index of the horse open in the dialog
  var opener = null;
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

  function openHorse(i, from) {
    opener = from || null;
    fillDialog(i);
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

  document.querySelectorAll('.horse-open').forEach(function (b) {
    b.addEventListener('click', function () { openHorse(Number(b.getAttribute('data-index')), b); });
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
    if (!m) return;
    for (var i = 0; i < horses.length; i++) {
      if (horses[i].slug === m[1]) { openHorse(i); return; }
    }
  }

  /* ---------- Video ---------- */

  var frame = document.getElementById('video-frame');
  var videoId = (frame.getAttribute('data-youtube-id') || '').trim();
  if (videoId) {
    var poster = frame.querySelector('.video-poster');
    frame.querySelector('[data-when="channel"]').hidden = true;
    frame.querySelector('[data-when="video"]').hidden = false;
    poster.setAttribute('href', 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId));
    poster.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) +
        '?autoplay=1&rel=0&playsinline=1&hl=' + lang();
      iframe.title = 'Cibao La Pampa · YouTube';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.replaceChild(iframe, poster);
    });
  }

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
