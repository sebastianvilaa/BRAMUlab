/* BRAMUlab Web · demostraciones de la interfaz real (HTML/CSS/JS, sin dependencias).
   Cuatro pantallas de «Cómo funciona» y las tarjetas del Home de «Qué obtenés». Cada demo es una secuencia predeterminada:
   sin backend, reproducible (activate = reiniciar y mostrar) y con estado final directo para movimiento reducido.
   API: window.BramuDemos = { activate(n), deactivate(n), finish(n), fit(), home: { focus(key), reset() } } */
(function () {
  'use strict';
  var doc = document;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return mqReduce.matches; }
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ---------- utilidades: línea de tiempo cancelable y tweens ---------- */
  function Runner() { this.timers = []; this.rafs = []; this.alive = true; }
  Runner.prototype.at = function (ms, fn) {
    var self = this;
    this.timers.push(setTimeout(function () { if (self.alive) fn(); }, ms));
  };
  Runner.prototype.tween = function (ms, delay, ease, update, done) {
    var self = this, t0 = null, id;
    function frame(ts) {
      if (!self.alive) return;
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / ms);
      update(ease(p));
      if (p < 1) { id = requestAnimationFrame(frame); self.rafs.push(id); } else if (done) done();
    }
    this.timers.push(setTimeout(function () { if (self.alive) { id = requestAnimationFrame(frame); self.rafs.push(id); } }, delay || 0));
  };
  Runner.prototype.stop = function () {
    this.alive = false;
    this.timers.forEach(clearTimeout);
    this.rafs.forEach(cancelAnimationFrame);
  };
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
  // desaceleración con un pequeño rebote final, como un selector que se asienta
  var easeSettle = function (x) { var c = 1.1, n = x - 1; return 1 + (c + 1) * n * n * n + c * n * n; };
  function press(el, ms) { if (!el) return; el.classList.add('is-press'); setTimeout(function () { el.classList.remove('is-press'); }, ms || 170); }
  function typeInto(r, el, text, start, step, onEach) {
    for (var i = 1; i <= text.length; i++) (function (n) {
      r.at(start + (n - 1) * step, function () { el.textContent = text.slice(0, n); if (onEach) onEach(n); });
    })(i);
  }

  /* ---------- escala: cada pantalla se dibuja a 390 × 600 y se ajusta al espacio disponible ---------- */
  function fit() {
    $$('.demo').forEach(function (d) {
      var box = d.parentElement;
      var w = box.clientWidth, h = box.clientHeight;
      if (!w || !h) return;
      var k = Math.min(w / 390, h / 600);
      d.style.setProperty('--k', k.toFixed(4));
    });
  }

  /* ========================================================================
     DEMO 1 · Elegí quiénes jugaron
     ======================================================================== */
  var P = {
    matu: { img: 'real-matu', name: 'Matu', user: '@matu_qa', lvl: '6.0' },
    esteban: { img: 'real-esteban', name: 'Esteban', user: '@esteban_qa', lvl: '5.9' },
    marcos: { av: 'M', name: 'Marcos', user: 'Sin cuenta', lvl: '', guest: true }
  };
  function rowHTML(p) {
    var av = p.img ? '<div class="a-av a-av--photo"><img src="assets/img/avatar-' + p.img + '.jpg' + '" alt="" width="100" height="100"></div>' : '<div class="a-av">' + p.av + '</div>';
    return av + '<div class="a-who"><b>' + p.name + '</b><small>' + p.user + '</small></div>' +
      (p.lvl ? '<div class="a-lvl"><small>NIVEL BRAMU</small><b>' + p.lvl + '</b></div>' : '');
  }
  var d1 = (function () {
    var root = $('#a1');
    if (!root) return null;
    var slots = { A2: $('[data-slot="A2"]', root), B1: $('[data-slot="B1"]', root), B2: $('[data-slot="B2"]', root) };
    var orig = {};
    Object.keys(slots).forEach(function (k) { orig[k] = { html: slots[k].innerHTML, cls: slots[k].className }; });
    var scrim = $('.a-scrim', root), sheet = $('.a-sheet', root), title = $('[data-sheet-title]', root);
    var typed = $('[data-typed]', root), ph = $('.a-search__ph', root), caret = $('.a-caret', root), search = $('.a-search', root);
    var res = { matu: $('[data-res="matu"]', root), esteban: $('[data-res="esteban"]', root), add: $('[data-res="add"]', root) };
    var hint = $('[data-hint]', root), link = $('[data-link]', root), cta = $('[data-cta]', root);
    var run = null;

    function resetSheet() {
      sheet.classList.remove('is-open'); scrim.classList.remove('is-open');
      typed.textContent = ''; ph.hidden = false; caret.hidden = true; search.classList.remove('is-focus');
      Object.keys(res).forEach(function (k) { res[k].classList.remove('is-show', 'is-press'); });
      hint.classList.remove('is-show'); link.classList.remove('is-show');
    }
    function reset() {
      if (run) run.stop(); run = null;
      Object.keys(slots).forEach(function (k) { slots[k].innerHTML = orig[k].html; slots[k].className = orig[k].cls; });
      resetSheet();
      cta.className = 'a-cta is-off';
    }
    function open(t) { title.textContent = t; scrim.classList.add('is-open'); sheet.classList.add('is-open'); }
    function close() { sheet.classList.remove('is-open'); scrim.classList.remove('is-open'); search.classList.remove('is-focus'); caret.hidden = true; }
    function focusSearch() { search.classList.add('is-focus'); caret.hidden = false; ph.hidden = true; }
    function fill(slot, p) {
      var el = slots[slot];
      el.classList.remove('a-slot'); el.classList.toggle('a-row--guest', !!p.guest);
      el.innerHTML = rowHTML(p); el.classList.add('is-in');
    }
    function ctaOn() { cta.className = 'a-cta is-on is-pulse'; }

    function finish() {
      reset();
      fill('A2', P.marcos); fill('B1', P.matu); fill('B2', P.esteban);
      Object.keys(slots).forEach(function (k) { slots[k].classList.remove('is-in'); });
      cta.className = 'a-cta is-on';
    }
    function play() {
      reset();
      var r = run = new Runner();
      // 1) compañero sin cuenta: no aparece en la búsqueda, se agrega como invitado
      r.at(450, function () { press(slots.A2); });
      r.at(650, function () { open('ELEGIR COMPAÑERO'); });
      r.at(1000, focusSearch);
      typeInto(r, typed, 'Marcos', 1120, 90);
      r.at(1800, function () { res.add.classList.add('is-show'); link.classList.add('is-show'); });
      r.at(2400, function () { press(res.add, 200); });
      r.at(2570, function () { close(); fill('A2', P.marcos); });
      // 2) primer rival registrado: se escribe «Matu» y se elige
      r.at(3100, function () { press(slots.B1); });
      r.at(3280, function () { resetSheet(); open('ELEGIR RIVAL'); });
      r.at(3630, focusSearch);
      typeInto(r, typed, 'Matu', 3780, 120);
      r.at(4380, function () { res.matu.classList.add('is-show'); });
      r.at(4930, function () { press(res.matu, 200); });
      r.at(5100, function () { close(); fill('B1', P.matu); });
      // 3) segundo rival registrado, desde recientes, y el botón queda listo
      r.at(5700, function () { press(slots.B2); });
      r.at(5880, function () { resetSheet(); open('ELEGIR RIVAL'); hint.classList.add('is-show'); res.esteban.classList.add('is-show'); });
      r.at(6500, function () { press(res.esteban, 200); });
      r.at(6670, function () { close(); fill('B2', P.esteban); });
      r.at(7200, ctaOn);
    }
    return { play: play, reset: reset, finish: finish, stop: function () { if (run) run.stop(); run = null; } };
  })();

  /* ========================================================================
     DEMO 2 · Cargá el resultado (selector numérico vertical A/B)
     ======================================================================== */
  var d2 = (function () {
    var root = $('#a2');
    if (!root) return null;
    var ITEM = 34, MAX = 7;
    var lists = { a: $('[data-wheel="a"]', root), b: $('[data-wheel="b"]', root) };
    var panel = $('[data-panel]', root), wtitle = $('[data-wtitle]', root), next = $('[data-next]', root);
    var cta = $('[data-cta]', root), win = $('[data-win]', root);
    var cell = function (t, n) { return $('[data-cell="' + t + n + '"]', root); };
    var sls = $$('[data-sl]', root);
    var run = null, pos = { a: 0, b: 0 };
    // construye los ítems 0..7 de cada selector
    Object.keys(lists).forEach(function (k) {
      var html = '';
      for (var i = 0; i <= MAX; i++) html += '<div class="a-wheel__item">' + i + '</div>';
      lists[k].innerHTML = html;
    });
    function setPos(k, p) {                      // p = valor (fraccionario) que está en el centro del selector
      pos[k] = p;
      lists[k].style.transform = 'translateY(' + (68 - ITEM * p).toFixed(2) + 'px)';
      var sel = Math.max(0, Math.min(MAX, Math.round(p)));
      var items = lists[k].children;
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('is-sel', i === sel);
      return sel;
    }
    function live(set, k, p) {                   // el valor que pasa por el centro se ve «en vivo» en el resumen
      var sel = setPos(k, p);
      var c = cell(k.toUpperCase(), set);
      if (c.textContent !== String(sel)) c.textContent = sel;
      c.classList.add('is-set');
    }
    function activeSet(n) {
      sls.forEach(function (el, i) { el.classList.toggle('is-active', i + 1 === n); });
      ['A', 'B'].forEach(function (t) { [1, 2, 3].forEach(function (i) { cell(t, i).classList.toggle('is-active', i === n); }); });
      wtitle.textContent = 'SET ' + n;
    }
    function style(setN, a, b) {                 // set cerrado: ganador más claro, perdedor atenuado
      var ca = cell('A', setN), cb = cell('B', setN);
      ca.classList.remove('is-active'); cb.classList.remove('is-active');
      ca.classList.toggle('is-win', a > b); ca.classList.toggle('is-lose', a < b);
      cb.classList.toggle('is-win', b > a); cb.classList.toggle('is-lose', b < a);
    }
    function reset() {
      if (run) run.stop(); run = null;
      ['A', 'B'].forEach(function (t) { [1, 2, 3].forEach(function (i) { var c = cell(t, i); c.textContent = '–'; c.className = 'a-cell'; }); });
      setPos('a', 0); setPos('b', 0);
      activeSet(1);
      panel.classList.remove('is-hidden');
      next.className = 'a-wheel__next is-off';
      cta.className = 'a-cta is-off'; cta.style.marginTop = '12px';
      win.classList.remove('is-show');
    }
    var SETS = [[6, 4], [3, 6], [6, 4]];
    function finish() {
      reset();
      SETS.forEach(function (s, i) {
        cell('A', i + 1).textContent = s[0]; cell('B', i + 1).textContent = s[1];
        cell('A', i + 1).classList.add('is-set'); cell('B', i + 1).classList.add('is-set');
        style(i + 1, s[0], s[1]);
      });
      sls.forEach(function (el) { el.classList.remove('is-active'); });
      panel.classList.add('is-hidden'); win.classList.add('is-show'); cta.className = 'a-cta is-on';
    }
    function play() {
      reset();
      var r = run = new Runner();
      // Set 1 completo: se ve cómo los números se desplazan hasta 6 (Equipo A) y 4 (Equipo B)
      r.tween(1250, 400, easeSettle, function (e) { live(1, 'a', 6 * e); });
      r.tween(1000, 1350, easeSettle, function (e) { live(1, 'b', 4 * e); });
      r.at(2500, function () { next.classList.remove('is-off'); });
      r.at(2950, function () { press(next, 190); });
      r.at(3120, function () { style(1, 6, 4); activeSet(2); setPos('a', 0); setPos('b', 0); next.classList.add('is-off'); });
      // Set 2 (más rápido): 3 – 6
      r.tween(650, 3350, easeSettle, function (e) { live(2, 'a', 3 * e); });
      r.tween(700, 3450, easeSettle, function (e) { live(2, 'b', 6 * e); });
      r.at(4300, function () { next.classList.remove('is-off'); });
      r.at(4550, function () { press(next, 190); });
      r.at(4720, function () { style(2, 3, 6); activeSet(3); setPos('a', 0); setPos('b', 0); next.classList.add('is-off'); });
      // Set 3: 6 – 4 y el partido queda decidido
      r.tween(650, 4950, easeSettle, function (e) { live(3, 'a', 6 * e); });
      r.tween(600, 5050, easeSettle, function (e) { live(3, 'b', 4 * e); });
      r.at(5800, function () { next.classList.remove('is-off'); });
      r.at(6050, function () { press(next, 190); });
      r.at(6230, function () {
        style(3, 6, 4); sls.forEach(function (el) { el.classList.remove('is-active'); });
        panel.classList.add('is-hidden'); win.classList.add('is-show'); cta.className = 'a-cta is-on';
      });
    }
    return { play: play, reset: reset, finish: finish, stop: function () { if (run) run.stop(); run = null; } };
  })();

  /* ========================================================================
     DEMO 3 · Esperando validación + invitar al jugador sin cuenta
     ======================================================================== */
  var d3 = (function () {
    var root = $('#a3');
    if (!root) return null;
    var sum = $('[data-sum]', root), gh = $('[data-gh]', root), guest = $('[data-guest]', root), btn = $('[data-btn]', root);
    var run = null;
    function reset() {
      if (run) run.stop(); run = null;
      sum.classList.remove('is-pending'); gh.classList.remove('is-show'); guest.classList.remove('is-show');
      btn.classList.remove('is-glow', 'is-press', 'is-ripple');
    }
    function finish() { reset(); sum.classList.add('is-pending'); gh.classList.add('is-show'); guest.classList.add('is-show'); btn.classList.add('is-glow'); }
    function play() {
      reset();
      var r = run = new Runner();
      r.at(450, function () { sum.classList.add('is-pending'); });
      r.at(1500, function () { gh.classList.add('is-show'); guest.classList.add('is-show'); });
      r.at(2500, function () { btn.classList.add('is-glow'); });
      r.at(3000, function () { press(btn, 220); btn.classList.add('is-ripple'); });
      r.at(3800, function () { btn.classList.remove('is-ripple'); });
    }
    return { play: play, reset: reset, finish: finish, stop: function () { if (run) run.stop(); run = null; } };
  })();

  /* ========================================================================
     DEMO 4 · Un rival lo confirma (cuenta de Seba → cuenta de Esteban → Home → Resumen → validar)
     ======================================================================== */
  var d4 = (function () {
    var root = $('#a4');
    if (!root) return null;
    var who = $('[data-who]', root), whoImg = $('[data-who-img]', root), whoName = $('[data-who-name]', root);
    var swap = $('[data-swap]', root), card = $('[data-card]', root), sum = $('[data-sum4]', root);
    var act = $('.a4-act', root), okBtn = $('[data-ok]', root);
    var run = null;
    function setWho(name, img) { whoName.textContent = name; whoImg.setAttribute('src', 'assets/img/avatar-' + img + '.jpg'); }
    function reset() {
      if (run) run.stop(); run = null;
      root.setAttribute('data-view', '1'); setWho('SEBA', 'seba');
      who.classList.remove('is-flip'); swap.classList.remove('is-on');
      card.classList.remove('is-glow', 'is-press');
      sum.classList.add('is-pending'); sum.classList.remove('is-ok');
      act.classList.remove('is-done'); okBtn.classList.remove('is-glow', 'is-press');
    }
    function finish() {
      reset();
      root.setAttribute('data-view', '3'); setWho('ESTEBAN', 'real-esteban');
      sum.classList.remove('is-pending'); sum.classList.add('is-ok'); act.classList.add('is-done');
    }
    function play() {
      reset();
      var r = run = new Runner();
      // 1) el partido ya cargado, desde la cuenta de Seba
      // 2) cambio de perspectiva: se aclara que ahora se ve la cuenta de un rival
      r.at(2300, function () { who.classList.add('is-flip'); swap.classList.add('is-on'); });
      r.at(2650, function () { root.setAttribute('data-view', '2'); setWho('ESTEBAN', 'real-esteban'); who.classList.remove('is-flip'); });
      r.at(2800, function () { swap.classList.remove('is-on'); });
      // 3) Home de Esteban: el pendiente accionable se destaca y lo toca
      r.at(3700, function () { card.classList.add('is-glow'); });
      r.at(5400, function () { press(card, 260); });
      r.at(5750, function () { root.setAttribute('data-view', '3'); });
      // 4) Resumen del mismo partido: revisa y valida
      r.at(7000, function () { okBtn.classList.add('is-glow'); });
      r.at(8500, function () { press(okBtn, 220); });
      r.at(8750, function () { okBtn.classList.remove('is-glow'); sum.classList.remove('is-pending'); sum.classList.add('is-ok'); act.classList.add('is-done'); });
    }
    return { play: play, reset: reset, finish: finish, stop: function () { if (run) run.stop(); run = null; } };
  })();

  /* ========================================================================
     PREGUNTAS RÁPIDAS · versiones breves de las demos 1 y 4. Reutilizan los mismos componentes: se clonan nodos de #a1 y #a4
     (sin duplicar marcado ni estilos) y los helpers Runner / rowHTML / press / typeInto. Corren al abrir la pregunta.
     ======================================================================== */
  var minis = (function () {
    var out = {};
    var a1 = $('#a1'), a4 = $('#a4');
    function host(kind) { var d = $('details[data-mini="' + kind + '"]'); return d ? { d: d, h: $('.mini-host', d) } : null; }
    function clone(el) { return el ? el.cloneNode(true) : null; }

    // --- ¿Y si alguno no tiene cuenta? : Marcos se agrega como invitado ---
    var g = host('guest');
    if (g && a1) {
      var root = doc.createElement('div'); root.className = 'a mini';
      var seba = a1.querySelector('.a-team .a-row'), slot0 = a1.querySelector('[data-slot="A2"]');
      root.innerHTML = '<div class="a-tl"><i></i>EQUIPO A</div><div class="a-team"></div><div class="mini__sheet"><div class="a-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="a-search__ph">Buscar jugador…</span><span data-typed></span><i class="a-caret" hidden></i></div><div class="a-res"></div></div>';
      var team = $('.a-team', root);
      team.appendChild(clone(seba)); var slot = clone(slot0); slot.removeAttribute('data-slot'); team.appendChild(slot);
      var slotHTML = slot.innerHTML, slotCls = slot.className;
      var add = clone(a1.querySelector('[data-res="add"]')); $('.a-res', root).appendChild(add);
      g.h.appendChild(root);
      var sheet = $('.mini__sheet', root), typed = $('[data-typed]', root), ph = $('.a-search__ph', root), caret = $('.a-caret', root), search = $('.a-search', root);
      var run = null;
      var reset = function () {
        if (run) run.stop(); run = null;
        slot.className = slotCls; slot.innerHTML = slotHTML;
        sheet.classList.remove('is-show'); add.classList.remove('is-show', 'is-press');
        typed.textContent = ''; ph.hidden = false; caret.hidden = true; search.classList.remove('is-focus');
      };
      var finish = function () { reset(); slot.className = 'a-row a-row--guest'; slot.innerHTML = rowHTML(P.marcos); };
      var play = function () {
        reset(); var r = run = new Runner();
        r.at(500, function () { press(slot); });
        r.at(700, function () { sheet.classList.add('is-show'); });
        r.at(1000, function () { search.classList.add('is-focus'); caret.hidden = false; ph.hidden = true; });
        typeInto(r, typed, 'Marcos', 1150, 95);
        r.at(1900, function () { add.classList.add('is-show'); });
        r.at(2500, function () { press(add, 200); });
        r.at(2700, function () { sheet.classList.remove('is-show'); slot.className = 'a-row a-row--guest is-in'; slot.innerHTML = rowHTML(P.marcos); });
      };
      out.guest = { d: g.d, play: play, reset: reset, finish: finish, stop: function () { if (run) run.stop(); run = null; } };
      finish();
    }

    // --- ¿Cómo se validan los partidos? : desde la cuenta de Esteban, Validar partido ---
    var v = host('validate');
    if (v && a4) {
      var rv = doc.createElement('div'); rv.className = 'a mini';
      rv.appendChild(clone(a4.querySelector('.a4-who')));
      var card = clone(a4.querySelector('[data-card]')), sum = clone(a4.querySelector('[data-sum4]')), act = clone(a4.querySelector('.a4-act'));
      var cardWrap = doc.createElement('div'); cardWrap.className = 'mini__card'; cardWrap.appendChild(card);
      rv.appendChild(cardWrap); rv.appendChild(sum); rv.appendChild(act);
      var who = $('.a4-who', rv); $('[data-who-name]', who).textContent = 'ESTEBAN'; $('[data-who-img]', who).setAttribute('src', 'assets/img/avatar-real-esteban.jpg');
      who.classList.remove('is-flip'); v.h.appendChild(rv);
      var ok = $('[data-ok]', act), runv = null;
      var resetv = function () {
        if (runv) runv.stop(); runv = null;
        rv.classList.remove('is-open'); card.classList.remove('is-glow', 'is-press');
        sum.classList.add('is-pending'); sum.classList.remove('is-ok'); act.classList.remove('is-done'); ok.classList.remove('is-glow', 'is-press');
      };
      var finishv = function () { resetv(); rv.classList.add('is-open'); sum.classList.remove('is-pending'); sum.classList.add('is-ok'); act.classList.add('is-done'); };
      var playv = function () {
        resetv(); var r = runv = new Runner();
        r.at(500, function () { card.classList.add('is-glow'); });
        r.at(1700, function () { press(card, 260); });
        r.at(2000, function () { rv.classList.add('is-open'); });
        r.at(3200, function () { ok.classList.add('is-glow'); });
        r.at(4400, function () { press(ok, 220); });
        r.at(4650, function () { ok.classList.remove('is-glow'); sum.classList.remove('is-pending'); sum.classList.add('is-ok'); act.classList.add('is-done'); });
      };
      out.validate = { d: v.d, play: playv, reset: resetv, finish: finishv, stop: function () { if (runv) runv.stop(); runv = null; } };
      finishv();
    }

    Object.keys(out).forEach(function (k) {
      var m = out[k];
      m.d.addEventListener('toggle', function () { if (m.d.open) { if (reduced()) m.finish(); else m.play(); } else { m.stop(); m.finish(); } });
    });
    return out;
  })();

  var demos = { 1: d1, 2: d2, 3: d3, 4: d4 };
  /* Bucle de las cuatro demostraciones del recorrido «Cómo funciona»: secuencia completa → pausa de ~5 s con el estado final → fundido corto → vuelve a empezar,
     mientras la demo siga activa (visible). `deactivate`/`finish` y las pestañas en segundo plano cortan el ciclo sin dejar temporizadores. Con movimiento
     reducido no hay bucle: se muestra el estado final. (Las mini-demos de las preguntas frecuentes siguen reproduciéndose una vez al abrirse.) */
  var LOOP_PAUSE = 5000, LOOP_FADE = 380, LOOP_MAX = 3;   // hasta 3 reproducciones por activación; luego queda en el estado final
  var SEQ_MS = { 1: 7800, 2: 6800, 3: 4300, 4: 9300 };   // fin de cada secuencia (ms, medido sobre sus líneas de tiempo)
  var looping = {};                                       // n -> { timer }
  function demoEl(n) { return $('.demo--' + n); }
  function loopStop(n) {
    var l = looping[n]; if (!l) return;
    clearTimeout(l.timer); delete looping[n];
    var el = demoEl(n); if (el) el.classList.remove('is-loopfade');
  }
  function loopPlay(n) {
    var d = demos[n]; if (!d) return;
    var l = looping[n] = looping[n] || {};
    var el = demoEl(n); if (el) el.classList.remove('is-loopfade');
    d.play();
    l.n = (l.n || 0) + 1;
    l.timer = setTimeout(function () {
      if (!looping[n]) return;
      if (l.n >= LOOP_MAX) return;                        // última vez: se queda en el estado final
      if (el) el.classList.add('is-loopfade');            // fundido: la repetición no «salta»
      l.timer = setTimeout(function () { if (looping[n]) loopPlay(n); }, LOOP_FADE);
    }, SEQ_MS[n] + LOOP_PAUSE);
  }
  function activate(n) {
    var d = demos[n]; if (!d) return;
    loopStop(n);
    if (reduced()) { d.finish(); return; }
    if (doc.hidden) { d.finish(); return; }
    loopPlay(n);
  }
  function deactivate(n) { loopStop(n); var d = demos[n]; if (d) d.stop(); }
  function finish(n) { loopStop(n); var d = demos[n]; if (d) d.finish(); }
  // pestaña en segundo plano: se detiene (estado final); al volver, se retoman las demos que seguían activas
  var wasLooping = [];
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) {
      wasLooping = Object.keys(looping).map(Number);
      wasLooping.forEach(function (n) { loopStop(n); var d = demos[n]; if (d) { d.stop(); d.finish(); } });
    } else {
      wasLooping.forEach(function (n) { if (!reduced()) { loopStop(n); loopPlay(n); } });
      wasLooping = [];
    }
  });
  // estado inicial: pantallas completas (sin JS de secuencia, o antes de activarse)
  [1, 2, 3, 4].forEach(function (n) { if (demos[n]) demos[n].finish(); });

  /* ========================================================================
     HOME · animaciones propias de cada tarjeta («Qué obtenés»)
     ======================================================================== */
  var home = (function () {
    var layer = $('#phone-layer');
    if (!layer) return null;
    var anims = [], counters = [];
    function cancelAll() {
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); anims = [];
      counters.forEach(function (c) { c.stop(); }); counters = [];
    }
    function count(el, to, delay, dur) {
      var r = new Runner(); counters.push(r);
      el.textContent = '0';
      r.tween(dur, delay, easeOut, function (e) { el.textContent = Math.round(to * e); }, function () { el.textContent = to; });
    }
    function anim(el, frames, opts) { if (!el || !el.animate) return; anims.push(el.animate(frames, opts)); }
    var EASE = 'cubic-bezier(.22,.8,.24,1)';
    var scenes = {
      act: function (c) {                                  // las barras crecen, de a una
        $$('.h-bar-c', c).forEach(function (b, i) {
          anim(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 750, delay: 120 + i * 140, easing: EASE, fill: 'backwards' });
        });
        anim($('.h-leg', c), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 700, fill: 'backwards' });
        anim($('p', c), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 800, fill: 'backwards' });
      },
      efe: function (c) {                                  // el anillo se dibuja y el porcentaje sube hasta el valor real
        var C = 97.4, fin = 41.9;
        $$('.fl, .gl', c).forEach(function (el) {
          anim(el, [{ strokeDashoffset: C }, { strokeDashoffset: fin }], { duration: 1300, delay: 150, easing: EASE, fill: 'backwards' });
        });
        count($('[data-count]', c), 57, 150, 1300);
        anim($('.h-cap', c), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 900, fill: 'backwards' });
      },
      rac: function (c) {                                  // el número sube de un hueco hasta su valor
        var v = $('.v', c);
        anim(v, [{ opacity: 0, transform: 'translateY(18px) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 120, easing: EASE, fill: 'backwards' });
        count($('[data-count]', c), 2, 200, 700);
        anim($('p', c), [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 600, fill: 'backwards' });
      },
      com: function (c) {
        anim($('.v', c), [{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 120, easing: EASE, fill: 'backwards' });
        count($('[data-count]', c), 75, 350, 900);
        anim($('p', c), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 350, fill: 'backwards' });
      },
      riv: function (c) {
        anim($('.v', c), [{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 120, easing: EASE, fill: 'backwards' });
        count($('[data-count]', c), 48, 350, 1000);
        anim($('p', c), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 350, fill: 'backwards' });
      }
    };
    function reset() { cancelAll(); $$('[data-count]', layer).forEach(function (e) { e.textContent = e.getAttribute('data-count'); }); }
    function focus(key) {
      cancelAll();
      var c = $('[data-home="' + key + '"]', layer);
      if (!c || reduced()) { reset(); return; }
      $$('[data-count]', layer).forEach(function (e) { e.textContent = e.getAttribute('data-count'); });
      if (scenes[key]) scenes[key](c);
    }
    return { focus: focus, reset: reset };
  })();

  window.BramuDemos = { activate: activate, deactivate: deactivate, finish: finish, fit: fit, home: home };
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(fit);
    $$('.stage, .step__demo').forEach(function (e) { ro.observe(e); });
  }
})();
