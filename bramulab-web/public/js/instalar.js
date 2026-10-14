/* BRAMUlab Web · «Tu pádel, siempre a mano»: pantalla viva de instalación (iPhone / Android). Autónomo, sin dependencias.
   iPhone: Safari → Compartir → Agregar a Inicio → «Abrir como app web» → ícono. Android: Chrome → ⋮ → Instalar app → ícono. */
(function () {
  'use strict';
  var doc = document;
  var sec = doc.getElementById('instalar'), dev = doc.getElementById('inst-dev'), fit = doc.getElementById('inst-fit'), dv = doc.getElementById('inst-dv');
  var stepsEl = doc.getElementById('inst-steps');
  if (!sec || !dev || !dv) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var tabs = Array.prototype.slice.call(sec.querySelectorAll('.inst__seg button'));
  var stepEls = Array.prototype.slice.call(stepsEl.querySelectorAll('li'));
  var os = 'ios', timers = [], playing = false;

  function scale() { var w = dev.clientWidth, h = dev.clientHeight; if (w && h) fit.style.setProperty('--k', Math.min(w / 300, h / 610).toFixed(4)); }
  scale(); window.addEventListener('resize', scale); window.addEventListener('load', scale);
  if (window.ResizeObserver) new ResizeObserver(scale).observe(dev);

  function clearAll() { timers.forEach(clearTimeout); timers = []; }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  var STATES = ['is-tapshare', 'is-sheet', 'is-pick', 'is-add', 'is-toggle', 'is-tapadd', 'is-home', 'is-icon', 'is-tapmenu', 'is-menu', 'is-dlg', 'is-tapinstall'];
  function clearStates() { STATES.forEach(function (c) { dv.classList.remove(c); }); }
  function on() { for (var i = 0; i < arguments.length; i++) dv.classList.add(arguments[i]); }
  function off() { for (var i = 0; i < arguments.length; i++) dv.classList.remove(arguments[i]); }
  function setStep(n) { stepEls.forEach(function (li) { li.classList.toggle('is-active', parseInt(li.getAttribute('data-scene'), 10) === n); }); }

  // estado fijo de cada paso (clic en un paso, o movimiento reducido)
  function stateFor(n) {
    clearStates(); setStep(n);
    if (os === 'ios') {
      if (n === 2) on('is-sheet', 'is-pick');
      if (n === 3) on('is-add', 'is-toggle');
      if (n === 4) on('is-home', 'is-icon');
    } else {
      if (n === 2) on('is-menu', 'is-pick');
      if (n === 3) on('is-dlg');
      if (n === 4) on('is-home', 'is-icon');
    }
  }
  function play() {
    clearAll(); clearStates(); setStep(1);
    if (mq.matches) { stateFor(4); return; }
    if (os === 'ios') {
      at(1300, function () { setStep(2); on('is-tapshare'); });
      at(2100, function () { off('is-tapshare'); on('is-sheet'); });
      at(3100, function () { on('is-pick'); });
      at(3900, function () { setStep(3); off('is-sheet', 'is-pick'); on('is-add'); });
      at(4900, function () { on('is-toggle'); });
      at(5900, function () { on('is-tapadd'); });
      at(6300, function () { setStep(4); off('is-tapadd', 'is-add'); on('is-home'); });
      at(7000, function () { on('is-icon'); });
    } else {
      at(1300, function () { setStep(2); on('is-tapmenu'); });
      at(2000, function () { off('is-tapmenu'); on('is-menu'); });
      at(3000, function () { on('is-pick'); });
      at(3800, function () { setStep(3); off('is-menu', 'is-pick'); on('is-dlg'); });
      at(5100, function () { on('is-tapinstall'); });
      at(5600, function () { setStep(4); off('is-tapinstall', 'is-dlg'); on('is-home'); });
      at(6300, function () { on('is-icon'); });
    }
  }
  function setOS(next, replay) {
    os = next; sec.setAttribute('data-os', next);
    tabs.forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-os') === next ? 'true' : 'false'); });
    if (replay) play();
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { setOS(t.getAttribute('data-os'), true); }); });
  // opción por defecto: el sistema del visitante
  var ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) setOS('android', false);
  stepEls.forEach(function (li) {
    li.setAttribute('tabindex', '0'); li.setAttribute('role', 'button');
    function go() { clearAll(); stateFor(parseInt(li.getAttribute('data-scene'), 10)); }
    li.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) return; go(); });
    li.addEventListener('keydown', function (e) { if (e.target.closest && e.target.closest('a')) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  if (!('IntersectionObserver' in window)) { stateFor(4); return; }
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.intersectionRatio >= 0.5 && !playing) { playing = true; play(); }
      else if (e.intersectionRatio === 0 && playing) { playing = false; clearAll(); clearStates(); setStep(1); }
    });
  }, { threshold: [0, 0.5] }).observe(dev);
})();
