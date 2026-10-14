/* BRAMUlab Web · «Nivel BRAMU»: pantalla viva en tres escenas (cuestionario → medidor CALIBRANDO → un partido ajusta el Nivel).
   Cifras: EJEMPLO ILUSTRATIVO calculado con el motor vigente (ver css/nivel.css). Autónomo, sin backend. */
(function () {
  'use strict';
  var doc = document;
  var stage = doc.getElementById('lv-stage'), fit = doc.getElementById('lv-fit'), stepsEl = doc.getElementById('lv-steps');
  if (!stage || !fit) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function $(s) { return fit.querySelector(s); }
  var s1 = $('#lv-s1'), s3 = $('#lv-s3');
  var cards = Array.prototype.slice.call(fit.querySelectorAll('[data-cards] .lv-card'));
  var dots = Array.prototype.slice.call(fit.querySelectorAll('.lv-rail__dot'));
  var thumb = $('[data-thumb]'), line = $('[data-line]'), pick = $('[data-pick]');
  var cont = $('[data-continue]'), startBtn = $('[data-start]'), confirmBtn = $('[data-confirm]');
  var arc = $('[data-arc]'), gval = $('[data-gval]'), gcat = $('[data-gcat]'), gnote = $('[data-gnote]'), gbtns = $('[data-gbtns]');
  var nCard = $('[data-n]'), nval = $('[data-nval]'), chip = $('[data-chip]'), ncal = $('[data-ncal]'), nbar = $('[data-nbar]');
  var riv = $('[data-riv]'), bBox = $('[data-b]'), bt = $('[data-bt]'), bp = $('[data-bp]');
  var caseEls = Array.prototype.slice.call(fit.querySelectorAll('[data-case]'));
  var stepEls = stepsEl ? Array.prototype.slice.call(stepsEl.querySelectorAll('li')) : [];

  /* Casos de la escena 3 (motor nivel_bramu_v1_0): jugador 5,3 CALIBRANDO (conf. 0,15), compañero 5,5 (0,40), 6-4 6-3, rivales conf. 0,63. */
  var CASES = [
    { riv: 'Nivel 6.4 · 6.6', to: 5.5, chip: '↑ 0.2', t: 'Triunfo de alto valor', p: 'Superaron a una pareja con mayor Nivel BRAMU. Como todavía estás calibrando, este resultado aporta más información.' },
    { riv: 'Nivel 4.3 · 4.5', to: 5.4, chip: '↑ 0.1', t: 'Resultado esperado', p: 'La victoria confirma tu nivel actual. El cambio fue pequeño porque la diferencia previa era favorable.' }
  ];
  var START_LEVEL = 5.3;

  /* ---------- escala ---------- */
  function scale() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) fit.style.setProperty('--k', Math.min(w / 390, h / 600).toFixed(4));
  }
  scale(); window.addEventListener('resize', scale); window.addEventListener('load', function () { scale(); layoutRail(); });
  if (window.ResizeObserver) new ResizeObserver(scale).observe(stage);

  /* ---------- riel del selector (posiciones a partir de la altura real de cada tarjeta) ---------- */
  function layoutRail() {
    if (!cards.length || !cards[0].offsetHeight) return;
    var centers = cards.map(function (c) { return c.offsetTop + c.offsetHeight / 2; });
    dots.forEach(function (d, i) { d.style.top = centers[i] + 'px'; });
    line.style.top = centers[0] + 'px'; line.style.height = (centers[3] - centers[0]) + 'px';
    thumb.style.top = centers[2] + 'px';
  }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layoutRail);
  layoutRail();

  /* ---------- medidor ---------- */
  var G = { cx: 110, cy: 112, r: 88, min: 1, max: 10 };
  function pt(v) { var th = 180 * (G.max - v) / (G.max - G.min) * Math.PI / 180; return [G.cx + G.r * Math.cos(th), G.cy - G.r * Math.sin(th)]; }
  function setGauge(v) {
    var p1 = pt(G.min), p2 = pt(v);
    arc.setAttribute('d', 'M ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + ' A 88 88 0 0 1 ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2));
    gval.textContent = (Math.round(v * 10) / 10).toFixed(1);
  }

  /* ---------- tiempos ---------- */
  var timers = [], raf = 0;
  function clearAll() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function press(el, ms) { el.classList.add('is-press'); setTimeout(function () { el.classList.remove('is-press'); }, ms || 180); }
  function tween(ms, ease, upd, done) {
    var t0 = null;
    function f(ts) { if (t0 === null) t0 = ts; var p = Math.min(1, (ts - t0) / ms); upd(ease(p)); if (p < 1) raf = requestAnimationFrame(f); else if (done) done(); }
    raf = requestAnimationFrame(f);
  }
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };

  function setScene(n) {
    stage.setAttribute('data-scene', String(n));
    stepEls.forEach(function (li) { li.classList.toggle('is-active', parseInt(li.getAttribute('data-scene'), 10) === n); });
  }

  /* ----- escena 1 ----- */
  function resetS1() {
    s1.classList.remove('is-quiz');
    cards.forEach(function (c) { c.classList.remove('is-on', 'is-press'); });
    dots.forEach(function (d) { d.classList.remove('is-active'); });
    thumb.classList.remove('is-show');
    cont.className = 'lv-btn is-off'; startBtn.className = 'lv-btn is-on';
  }
  function chooseS1() {
    pick.classList.add('is-on'); dots[2].classList.add('is-active'); layoutRail(); thumb.classList.add('is-show');
    cont.className = 'lv-btn is-on';
  }
  /* ----- escena 2 ----- */
  function resetS2() { setGauge(1); gcat.classList.remove('is-show'); gnote.classList.remove('is-show'); gbtns.classList.remove('is-show'); confirmBtn.classList.remove('is-press'); }
  function finalS2() { setGauge(START_LEVEL); gcat.classList.add('is-show'); gnote.classList.add('is-show'); gbtns.classList.add('is-show'); }
  /* ----- escena 3 ----- */
  function setCase(i) {
    var c = CASES[i];
    caseEls.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
    riv.textContent = c.riv; bt.textContent = c.t; bp.textContent = c.p; chip.textContent = c.chip;
  }
  function resetS3(i) {
    setCase(i || 0);
    s3.classList.remove('is-m', 'is-score', 'is-n', 'is-b');
    nval.textContent = START_LEVEL.toFixed(1); chip.classList.remove('is-show'); nCard.classList.remove('is-up');
    ncal.textContent = 'CALIBRANDO'; nbar.style.width = '0%';
  }
  function applyS3() { var c = CASES[curCase]; nval.textContent = c.to.toFixed(1); chip.classList.add('is-show'); nCard.classList.add('is-up'); ncal.textContent = 'CALIBRANDO'; nbar.style.width = '30%'; }
  var curCase = 0;
  function finalS3(i) { curCase = i; resetS3(i); s3.classList.add('is-m', 'is-score', 'is-n', 'is-b'); applyS3(); }
  // un caso completo de la escena 3 (t0 = ms relativos al comienzo del caso)
  function playCase(i, t0, first) {
    curCase = i;
    at(t0, function () { setCase(i); if (!first) { s3.classList.remove('is-score', 'is-b'); nval.textContent = START_LEVEL.toFixed(1); chip.classList.remove('is-show'); nCard.classList.remove('is-up'); ncal.textContent = 'CALIBRANDO'; nbar.style.width = '0%'; bBox.classList.add('is-swap'); } });
    at(t0 + 300, function () { s3.classList.add('is-m'); });
    at(t0 + 1100, function () { s3.classList.add('is-score'); });
    at(t0 + 1700, function () { s3.classList.add('is-n'); });
    at(t0 + 2300, function () {
      var from = START_LEVEL, to = CASES[i].to;
      applyS3Quiet(); tween(900, easeOut, function (e) { nval.textContent = (from + (to - from) * e).toFixed(1); }, function () { nval.textContent = to.toFixed(1); });
    });
    at(t0 + 3000, function () { s3.classList.add('is-b'); bBox.classList.remove('is-swap'); });
  }
  function applyS3Quiet() { chip.textContent = CASES[curCase].chip; chip.classList.add('is-show'); nCard.classList.add('is-up'); ncal.textContent = 'CALIBRANDO'; nbar.style.width = '30%'; }

  /* ---------- secuencia completa ---------- */
  function start() {
    clearAll(); resetS1(); resetS2(); resetS3(0); setScene(1);
    if (mq.matches) { finalS1(); return; }
    layoutRail();
    at(1500, function () { press(startBtn, 200); });
    at(1750, function () { s1.classList.add('is-quiz'); });
    at(3500, function () { press(pick, 220); });
    at(3700, chooseS1);
    at(4900, function () { press(cont, 200); });
    at(5150, function () { setScene(2); tween(1500, easeOut, function (e) { setGauge(1 + (START_LEVEL - 1) * e); }, function () { setGauge(START_LEVEL); }); });
    at(6900, function () { gcat.classList.add('is-show'); });
    at(7500, function () { gnote.classList.add('is-show'); gbtns.classList.add('is-show'); });
    at(9200, function () { press(confirmBtn, 200); });
    at(9500, function () { setScene(3); playCase(0, 150, true); playCase(1, 150 + 5200, false); });
  }
  function finalS1() { s1.classList.add('is-quiz'); chooseS1(); }
  function reset() { clearAll(); resetS1(); resetS2(); resetS3(0); setScene(1); }

  // El visitante puede elegir una escena (también con el teclado); la escena 3 permite alternar los dos casos.
  stepEls.forEach(function (li) {
    li.setAttribute('tabindex', '0'); li.setAttribute('role', 'button');
    function go() {
      var n = parseInt(li.getAttribute('data-scene'), 10);
      clearAll(); resetS1(); resetS2(); resetS3(0); setScene(n);
      if (n === 1) { finalS1(); } else if (n === 2) { finalS1(); finalS2(); } else { finalS3(0); }
    }
    li.addEventListener('click', go);
    li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  caseEls.forEach(function (el, i) {
    el.addEventListener('click', function () { clearAll(); setScene(3); finalS3(i); });
  });

  if (!('IntersectionObserver' in window)) { finalS3(0); setScene(3); return; }
  var playing = false;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.intersectionRatio >= 0.55 && !playing) { playing = true; start(); }
      else if (e.intersectionRatio === 0 && playing) { playing = false; reset(); }
    });
  }, { threshold: [0, 0.55] }).observe(stage);
})();
