/* BRAMUlab Web · prototipo local. JavaScript simple, sin dependencias.
   Funciona al abrir index.html por doble clic (script clásico, sin módulos). */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var reduce = mq.matches;
  if (mq.addEventListener) mq.addEventListener('change', function () { reduce = mq.matches; if (reduce) pauseSvg(); update(); });

  /* ---------- 1. Titular: separar en palabras para la entrada escalonada ---------- */
  function splitWords(el) {
    var i = 0;
    function walk(node, target) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { target.appendChild(doc.createTextNode(' ')); return; }
            var w = doc.createElement('span');
            w.className = 'w';
            var inner = doc.createElement('span');
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            w.appendChild(inner);
            target.appendChild(w);
          });
        } else if (child.nodeType === 1) {
          var clone = child.cloneNode(false);
          target.appendChild(clone);
          walk(child, clone);
        }
      });
    }
    var holder = doc.createDocumentFragment();
    var label = el.textContent.trim();
    walk(el, holder);
    el.setAttribute('aria-label', label);
    el.textContent = '';
    el.appendChild(holder);
    Array.prototype.forEach.call(el.querySelectorAll('.w'), function (w) { w.setAttribute('aria-hidden', 'true'); });
  }

  Array.prototype.forEach.call(doc.querySelectorAll('[data-split]'), splitWords);
  Array.prototype.forEach.call(doc.querySelectorAll('.hero [data-rise]'), function (el, i) {
    el.style.setProperty('--ri', i);
  });

  function start() {
    var hero = doc.querySelector('.hero');
    if (hero) hero.classList.add('is-loaded');
    Array.prototype.forEach.call(doc.querySelectorAll('[data-split]'), function (el) { el.classList.add('is-in'); });
  }
  if (doc.readyState === 'complete') { requestAnimationFrame(start); }
  else { window.addEventListener('load', function () { requestAnimationFrame(start); }); }
  // Por si la imagen tarda: no dejar el titular escondido.
  setTimeout(start, 1600);

  /* ---------- 2. Aparición progresiva al hacer scroll ---------- */
  var revealEls = Array.prototype.slice.call(doc.querySelectorAll('[data-reveal]'));
  // pequeño escalonado entre hermanos
  revealEls.forEach(function (el) {
    var sibs = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.hasAttribute('data-reveal'); }) : [];
    var idx = sibs.indexOf(el);
    if (idx > 0) el.style.setProperty('--d', Math.min(idx, 5) * 90 + 'ms');
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- «Cómo funciona»: pantallas recreadas en HTML (js/demos.js) ----------
     Escritorio: las tres demos viven en la escena; la del paso activo corre sola cuando la escena entra en pantalla y se
     puede volver a ver al regresar al paso o a la sección. Móvil: cada demo se muda a su paso y corre al verse. */
  var stage = doc.getElementById('stage');
  var D = window.BramuDemos || { activate: function () {}, deactivate: function () {}, finish: function () {}, fit: function () {}, home: null };
  var seen = false;
  var shown = 0;                                   // demo que está corriendo en la escena (escritorio)
  function syncDemos() {
    if (!stage) return;
    var step = parseInt(stage.getAttribute('data-step'), 10) || 1;
    var want = seen ? (wide.matches ? step : 1) : 0;
    if (want === shown) return;
    if (shown) D.deactivate(shown);
    shown = want;
    if (shown) D.activate(shown);
  }
  (function () {
    if (!stage || !('IntersectionObserver' in window)) { seen = true; return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.intersectionRatio >= 0.5) { seen = true; syncDemos(); }
        else if (e.intersectionRatio === 0) { seen = false; syncDemos(); if (D.finish) { D.finish(1); D.finish(2); D.finish(3); D.finish(4); } }
      });
    }, { threshold: [0, 0.5] }).observe(stage);
  })();

  // Móvil: las demos de los pasos 2 y 3 viven dentro de su paso; en escritorio, todas en la escena.
  var wideMQ = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: true };
  var demoEls = Array.prototype.slice.call(doc.querySelectorAll('.demo'));
  var figIO = null;
  function placeDemos() {
    var isWide = wideMQ.matches;
    demoEls.forEach(function (d, i) {
      var n = i + 1;
      if (!isWide && n > 1) {
        var host = doc.querySelector('.step__demo[data-for="' + n + '"]');
        if (host && d.parentNode !== host) host.appendChild(d);
      } else if (d.parentNode !== stage && stage) { stage.appendChild(d); }
    });
    D.fit();
    if (figIO) { figIO.disconnect(); figIO = null; }
    if (!isWide && 'IntersectionObserver' in window) {
      figIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var n = parseInt(e.target.getAttribute('data-for'), 10);
          if (e.intersectionRatio >= 0.55) D.activate(n);
          else if (e.intersectionRatio === 0) { D.deactivate(n); D.finish(n); }
        });
      }, { threshold: [0, 0.55] });
      Array.prototype.forEach.call(doc.querySelectorAll('.step__demo'), function (h) { figIO.observe(h); });
    }
  }
  placeDemos();
  if (wideMQ.addEventListener) wideMQ.addEventListener('change', function () { shown = 0; placeDemos(); syncDemos(); });

  /* ---------- 3. Scroll: progreso, encabezado, parallax, pasos ---------- */
  var bar = doc.getElementById('progress-bar');
  var topbar = doc.getElementById('topbar');
  var heroLogo = doc.querySelector('.hero__logo');
  var heroImg = doc.querySelector('.hero__img');
  var heroEl = doc.querySelector('.hero');
  var steps = Array.prototype.slice.call(doc.querySelectorAll('.step'));
  var wide = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: true };
  var activeIdx = 0;
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.pageYOffset || root.scrollTop;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    if (bar) bar.style.transform = 'scaleX(' + Math.min(1, y / max).toFixed(4) + ')';

    // El logo del encabezado aparece cuando el logo grande del hero ya salió de la pantalla.
    if (topbar && heroLogo) {
      var r = heroLogo.getBoundingClientRect();
      topbar.classList.toggle('is-solid', r.bottom < 48 || y > window.innerHeight * 0.6);
    }

    // Parallax suave de la foto (solo mientras el hero es visible).
    if (!reduce && heroImg && heroEl && y < heroEl.offsetHeight) {
      heroImg.style.transform = 'translate3d(0,' + (y * 0.16).toFixed(1) + 'px,0) scale(' + (1.06 + y / 6000).toFixed(4) + ')';
    }

    // Paso activo (solo escritorio): el bloque de texto cuyo centro está más cerca del centro de la escena.
    // Es función pura de las posiciones actuales: sin estados residuales al subir y bajar.
    if (stage && steps.length && wide.matches) {
      var sr = stage.getBoundingClientRect();
      var mid = (sr.top + sr.bottom) / 2;
      var idx = 0, best = Infinity;
      steps.forEach(function (s, i) {
        var b = s.getBoundingClientRect();
        var d = Math.abs((b.top + b.bottom) / 2 - mid);
        if (d < best) { best = d; idx = i; }
      });
      setStep(idx);
    }
    if (getApi) getApi.update();
  }
  function setStep(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    steps.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
    stage.setAttribute('data-step', String(idx + 1));
    syncDemos();
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { if (!wide.matches) { steps.forEach(function (s, i) { s.classList.toggle('is-active', i === 0); }); activeIdx = 0; stage.setAttribute('data-step', '1'); syncDemos(); } onScroll(); });
  update();

  /* ---------- «Qué obtenés»: el Home de BRAMUlab recreado en HTML dentro de un teléfono ----------
     Escritorio: el foco sigue al bloque de texto que pasa junto al teléfono (escena fija y corta, función pura del scroll).
     Móvil: scroll vertical natural; las categorías son un carrusel horizontal (swipe + avance automático cada ~4,5 s) y el
     teléfono enfoca la tarjeta del Home que corresponde. El avance automático se detiene al tocar/deslizar y mientras la
     sección no está en pantalla. Cada tarjeta enfocada corre su propia animación (js/demos.js → home.focus). */
  var getGrid = doc.getElementById('get-grid');
  var getApi = null;
  if (getGrid) {
    (function () {
      var screen = doc.getElementById('phone-screen'), fixed = doc.getElementById('phone-fixed');
      var layer = doc.getElementById('phone-layer'), spot = doc.getElementById('phone-spot');
      var headEl = doc.querySelector('#phone-fixed .h-head'), navEl = doc.querySelector('#phone-fixed .h-nav');
      var scrollBox = doc.querySelector('#phone-layer .h-scroll');
      var scrollEl = doc.getElementById('get-scroll'), pin = doc.getElementById('get-pin');
      var items = Array.prototype.slice.call(doc.querySelectorAll('.get__item'));
      var dotEls = Array.prototype.slice.call(doc.querySelectorAll('#get-dots i'));
      var cur = -2, K = 1;

      function cardRect(el) { return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; }
      function measure() {                       // escala base: 390 px de diseño → ancho real de la pantalla
        var w = screen.clientWidth, h = screen.clientHeight;
        if (!w) return false;
        K = w / 390;
        fixed.style.width = '390px'; fixed.style.height = (h / K).toFixed(1) + 'px'; fixed.style.transform = 'scale(' + K.toFixed(4) + ')';
        return true;
      }
      function focus(idx) {
        if (!measure()) return;
        var Wd = 390, Hd = screen.clientHeight / K;
        var hH = headEl.offsetHeight, nH = (getComputedStyle(navEl).display === 'none') ? 0 : navEl.offsetHeight;
        var L = layer.offsetHeight;
        var D2 = window.BramuDemos && window.BramuDemos.home;
        if (idx < 0) {                           // vista general del Home
          layer.style.transform = 'translate(0px,0px) scale(1)';
          spot.style.opacity = '0';
          if (D2) D2.reset();
          return;
        }
        var el = layer.querySelector('[data-home="' + items[idx].getAttribute('data-target') + '"]');
        var r = cardRect(el);
        var s = wide.matches ? 1.26 : 1.4;
        var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        var m = Wd * 0.05;                       // aire lateral: la tarjeta no queda pegada al borde del teléfono
        var tx = Wd / 2 - cx * s, ty = hH + (Hd - hH - nH) / 2 - cy * s;
        tx = Math.min(m, Math.max(Wd - Wd * s - m, tx));
        ty = Math.min(0, Math.max(Hd - nH - L * s, ty));
        layer.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + s + ')';
        var first = spot.style.opacity !== '1';
        if (first) spot.style.transition = 'none';
        spot.style.left = r.x + 'px'; spot.style.top = r.y + 'px'; spot.style.width = r.w + 'px'; spot.style.height = r.h + 'px';
        if (first) { void spot.offsetWidth; spot.style.transition = ''; }
        spot.style.opacity = '1';
        if (D2) D2.focus(items[idx].getAttribute('data-target'));
      }
      function setIdx(idx) {
        if (idx === cur) return;
        cur = idx;
        items.forEach(function (it, i) { it.classList.toggle('is-active', i === idx); });
        dotEls.forEach(function (d, i) { d.classList.toggle('is-on', i === idx); });
        focus(idx);
      }
      var hovering = false;
      function fromScroll() {
        if (!wide.matches || hovering || !scrollEl || !pin) return;
        // Escritorio: progreso de scroll dentro de la escena fija y corta (antes de fijarse: vista general del Home).
        var rect = scrollEl.getBoundingClientRect();
        var range = scrollEl.offsetHeight - pin.offsetHeight;
        var pinTop = parseFloat(getComputedStyle(pin).top) || 0;
        var prog = range > 0 ? (pinTop - rect.top) / range : 0;
        setIdx(prog < 0 ? -1 : Math.min(items.length - 1, Math.floor(prog * items.length)));
      }

      /* ----- móvil: carrusel horizontal ----- */
      var track = doc.getElementById('get-items');
      var AUTO_MS = 4500, HOLD_MS = 9000;            // avance automático y pausa tras una interacción manual
      var inView = false, lastUser = 0, autoTimer = 0, touching = false, tgt = -1;
      function padL() { return parseFloat(getComputedStyle(track).paddingLeft) || 0; }
      function nearest() {                           // tarjeta alineada (o la más cercana) al borde izquierdo del carrusel
        var max = track.scrollWidth - track.clientWidth, x = track.scrollLeft;
        if (max > 0 && x >= max - 2) return items.length - 1;
        var best = 0, d = Infinity;
        items.forEach(function (it, i) { var dd = Math.abs(it.offsetLeft - padL() - x); if (dd < d) { d = dd; best = i; } });
        return best;
      }
      function goTo(i, smooth) {
        tgt = i;
        var left = Math.max(0, items[i].offsetLeft - padL());
        if (track.scrollTo) track.scrollTo({ left: left, behavior: smooth && !reduce ? 'smooth' : 'auto' }); else track.scrollLeft = left;
      }
      function onTrackScroll() {
        if (wide.matches) return;
        var i = nearest();
        if (tgt >= 0 && Math.abs(items[tgt].offsetLeft - padL() - track.scrollLeft) < 3) tgt = -1;
        setIdx(i);
      }
      function userTouched() { lastUser = Date.now(); tgt = -1; }
      function tick() {
        if (wide.matches || reduce || !inView || doc.hidden || touching) return;
        if (Date.now() - lastUser < HOLD_MS) return;
        goTo((Math.max(0, cur) + 1) % items.length, true);
      }
      if (track) {
        track.addEventListener('scroll', onTrackScroll, { passive: true });
        ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (ev) { track.addEventListener(ev, userTouched, { passive: true }); });
        track.addEventListener('touchstart', function () { touching = true; }, { passive: true });
        ['touchend', 'touchcancel'].forEach(function (ev) { track.addEventListener(ev, function () { touching = false; lastUser = Date.now(); }, { passive: true }); });
        dotEls.forEach(function (d, i) { d.addEventListener('click', function () { if (wide.matches) return; userTouched(); goTo(i, true); }); d.style.cursor = 'pointer'; });
        autoTimer = setInterval(tick, AUTO_MS);
        if ('IntersectionObserver' in window && scrollEl) {
          new IntersectionObserver(function (es) {
            es.forEach(function (e) {
              var was = inView; inView = e.intersectionRatio >= 0.4;
              if (inView && !was && !wide.matches && cur < 0) { lastUser = 0; setIdx(nearest()); }   // al entrar: enfoca la tarjeta visible
            });
          }, { threshold: [0, 0.4, 0.7] }).observe(scrollEl);
        }
      }
      // Escritorio: pasar el mouse por una categoría enfoca su tarjeta (hasta que el mouse salga de la lista).
      items.forEach(function (it, i) {
        it.addEventListener('mouseenter', function () { if (wide.matches) { hovering = true; setIdx(i); } });
      });
      var listEl = doc.querySelector('.get__list');
      if (listEl) listEl.addEventListener('mouseleave', function () { hovering = false; fromScroll(); });
      function relayout() { var keep = cur; cur = -2; measure(); fromScroll(); if (cur === -2) setIdx(keep < -1 ? -1 : keep); }
      window.addEventListener('resize', relayout);
      function syncTrackTab() { if (!track) return; if (wide.matches) track.removeAttribute('tabindex'); else track.setAttribute('tabindex', '0'); }
      syncTrackTab();
      if (wideMQ.addEventListener) wideMQ.addEventListener('change', function () { syncTrackTab(); if (track) track.scrollLeft = 0; hovering = false; cur = -2; relayout(); if (!wide.matches && inView && track) setIdx(nearest()); });
      window.addEventListener('load', relayout);
      getApi = { update: fromScroll };
      measure();
      setIdx(-1);
    })();
  }

  /* ---------- 4. Movimiento reducido: pausar la animación SVG de la pelota ---------- */
  function pauseSvg() {
    Array.prototype.forEach.call(doc.querySelectorAll('svg'), function (s) {
      if (s.pauseAnimations) s.pauseAnimations();
    });
  }
  if (reduce) pauseSvg();

  /* ---------- 5. Enlaces ancla: respetar movimiento reducido ---------- */
  if (reduce) { root.style.scrollBehavior = 'auto'; }
})();
