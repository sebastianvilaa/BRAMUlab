/* BRAMUlab Web · «Tu círculo → Grupos BRAMU»: una sola secuencia (jugadores conectados → grupo → tabla semanal).
   Los mismos nodos pasan del círculo al grupo; la tarjeta y la tabla replican .lobby-card y .group-table de la app.
   Los datos son un EJEMPLO ILUSTRATIVO coherente con el reglamento (ver css/club.css). Autónomo y sin backend. */
(function () {
  'use strict';
  var doc = document;
  var stage = doc.getElementById('club-stage'), fit = doc.getElementById('club-fit'), stepsEl = doc.getElementById('club-steps');
  if (!stage || !fit) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------- datos del ejemplo ---------- */
  // x1,y1: posición en el círculo (escena 1). Orden = orden de entrada y de la fila de avatares del grupo (escena 2).
  var P = [
    { id: 'vos', name: 'Vos', kind: 'me', x1: 190, y1: 270 },
    { id: 'matu', name: 'Matu', kind: 'mate', img: 'real-matu', x1: 190, y1: 74 },
    { id: 'esteban', name: 'Esteban', kind: 'rival', img: 'real-esteban', x1: 295, y1: 131 },
    { id: 'jona', name: 'Jona', kind: 'mate', img: 'real-jona', ini: 'J', x1: 338, y1: 270 },
    { id: 'lucho', name: 'Lucho', kind: 'rival', img: 'real-lucho', ini: 'L', x1: 295, y1: 409 },
    { id: 'gusti', name: 'Gusti', kind: 'mate', img: 'real-gusti', ini: 'G', x1: 190, y1: 466 },
    { id: 'diego', name: 'Diego', kind: 'rival', ini: 'D', x1: 85, y1: 409 },
    { id: 'agus', name: 'Agus', kind: 'mate', img: 'agus', ini: 'A', x1: 42, y1: 270 },
    { id: 'flor', name: 'Flor', kind: 'rival', img: 'flor', ini: 'F', x1: 85, y1: 131 }
  ];
  var byId = {}; P.forEach(function (p, i) { p.i = i; byId[p.id] = p; });
  // Tabla semanal (2 mejores partidos puntuables; derrota = 0). Antes y después de que «Vos» gane un partido de Clásico (+5).
  var T = {
    lucho:   { before: { pts: 12, cap: '4 partidos · 3 V · 1 D' } },   // 2 mejores: 7 (Clásico con 2 bonus) + 5
    esteban: { before: { pts: 10, cap: '3 partidos · 2 V · 1 D' } },   // 5 + 5
    vos:     { before: { pts: 6,  cap: '3 partidos · 1 V · 2 D' }, after: { pts: 11, cap: '4 partidos · 2 V · 2 D' } },   // 6 (Clásico +1) → 6 + 5
    gusti:   { before: { pts: 5,  cap: '3 partidos · 1 V · 2 D' } },   // 5
    jona:    { before: { pts: 3,  cap: '2 partidos · 1 V · 1 D' } },   // Americano: 3
    matu:    { before: { pts: 0,  cap: '1 partido · 0 V · 1 D' } }
  };
  var ORDER0 = ['lucho', 'esteban', 'vos', 'gusti', 'jona', 'matu'];
  var ORDER1 = ['lucho', 'vos', 'esteban', 'gusti', 'jona', 'matu'];
  var MEDAL = ['🥇', '🥈', '🥉'];

  function av(p, cls) {
    if (p.id === 'vos') return '<span class="' + cls + ' me">VOS</span>';
    return '<span class="' + cls + '">' + (p.img ? '<img src="assets/img/avatar-' + p.img + '.jpg" alt="" width="100" height="100">' : p.ini) + '</span>';
  }

  /* ---------- construcción ---------- */
  var html = '<svg class="club__lines" viewBox="0 0 380 560" aria-hidden="true">';
  P.slice(1).forEach(function (p, k) {
    html += '<line class="' + (p.kind === 'mate' ? 'm' : 'r') + '" style="--i:' + k + '" x1="190" y1="270" x2="' + p.x1 + '" y2="' + p.y1 + '"/>';
  });
  html += '</svg>';
  P.forEach(function (p) {
    var x2 = 86 + 26 * p.i;
    html += '<div class="cn cn--' + p.kind + '" style="--i:' + p.i + ';--x1:' + p.x1 + 'px;--y1:' + p.y1 + 'px;--x2:' + x2 + 'px;--y2:46px">' +
      '<span class="cn__a">' + (p.id === 'vos' ? 'VOS' : (p.img ? '<img src="assets/img/avatar-' + p.img + '.jpg" alt="" width="100" height="100">' : p.ini)) + '</span>' +
      (p.id === 'vos' ? '' : '<span class="cn__n">' + p.name + '</span>') + '</div>';
  });
  html += '<div class="club__legend"><span class="m"><i></i>Compañeros</span><span class="r"><i></i>Rivales</span></div>';
  html += '<i class="club__ring"></i><span class="club__tag">EJEMPLO ILUSTRATIVO · DATOS FICTICIOS</span>';
  // tarjeta de grupo (como .lobby-card)
  html += '<div class="lc"><div class="lc__head"><span class="lc__av">PJ</span><div><b>El pádel de los jueves</b><small>9 jugadores</small></div></div>';
  ORDER0.slice(0, 3).forEach(function (id, n) {
    var p = byId[id];
    html += '<div class="lc__row' + (id === 'vos' ? ' me' : '') + '" style="--n:' + n + '"><span class="lc__pos">' + MEDAL[n] + '</span>' + av(p, 'lc__rav') + '<span class="lc__nm">' + p.name + '</span><b class="lc__pt">' + T[id].before.pts + ' pts</b></div>';
  });
  html += '</div>';
  // tabla semanal (como .group-table)
  html += '<div class="lt"><div class="lt__tabs"><span class="on">Semana actual</span><span>Semana pasada</span><span>Race anual</span></div><div class="lt__rows">';
  ORDER0.forEach(function (id, r) {
    var p = byId[id], d = T[id].before;
    html += '<div class="lt__row' + (id === 'vos' ? ' is-me' : '') + (r === 0 ? ' top' : '') + '" data-id="' + id + '" style="--r:' + r + '"><span class="lt__pos">' + (r + 1) + '</span>' +
      av(p, 'lt__av') + '<div class="lt__i"><b>' + p.name + '</b><small>' + d.cap + '</small></div><div class="lt__p"><b>' + d.pts + '</b><small>PTS</small></div>' +
      (id === 'vos' ? '<span class="lt__plus">+5</span>' : '') + '</div>';
  });
  html += '</div></div>';
  fit.innerHTML = html;

  var rows = {};
  Array.prototype.forEach.call(fit.querySelectorAll('.lt__row'), function (r) { rows[r.getAttribute('data-id')] = r; });
  var stepEls = stepsEl ? Array.prototype.slice.call(stepsEl.querySelectorAll('li')) : [];

  /* ---------- escala ---------- */
  function scale() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) fit.style.setProperty('--k', Math.min(w / 380, h / 560).toFixed(4));
  }
  scale(); window.addEventListener('resize', scale); window.addEventListener('load', scale);
  if (window.ResizeObserver) new ResizeObserver(scale).observe(stage);

  /* ---------- escenas ---------- */
  var timers = [], raf = 0, eventDone = false;
  function clearAll() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function setScene(n) {
    stage.setAttribute('data-scene', String(n));
    stepEls.forEach(function (li) { li.classList.toggle('is-active', parseInt(li.getAttribute('data-scene'), 10) === n); });
  }
  function setTable(order, after) {
    order.forEach(function (id, r) {
      var row = rows[id]; row.style.setProperty('--r', r);
      row.querySelector('.lt__pos').textContent = r + 1;
      row.classList.toggle('top', r === 0);
    });
    if (after) {
      var v = rows.vos, d = T.vos.after;
      v.querySelector('.lt__p b').textContent = d.pts; v.querySelector('small').textContent = d.cap;
    }
  }
  function resetTable() {
    ORDER0.forEach(function (id) {
      var d = T[id].before, row = rows[id];
      row.querySelector('.lt__p b').textContent = d.pts; row.querySelector('.lt__i small').textContent = d.cap;
    });
    setTable(ORDER0, false);
    rows.vos.querySelector('.lt__plus').classList.remove('is-go');
    stage.classList.remove('is-moving');
    eventDone = false;
  }
  // «Vos» gana un partido de Clásico (+5): suma 5 puntos (6 + 5 = 11), pasa a Esteban (10) y queda 2.º. Todo según el reglamento.
  function matchEvent() {
    if (eventDone) return; eventDone = true;
    var plus = rows.vos.querySelector('.lt__plus'); plus.classList.remove('is-go'); void plus.offsetWidth; plus.classList.add('is-go');
    var pts = rows.vos.querySelector('.lt__p b'), t0 = null;
    function tick(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / 900);
      pts.textContent = Math.round(6 + 5 * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else pts.textContent = 11;
    }
    at(450, function () { raf = requestAnimationFrame(tick); });
    at(1500, function () { stage.classList.add('is-moving'); setTable(ORDER1, true); });
  }
  function start() {
    clearAll(); resetTable(); setScene(1);
    stage.classList.remove('is-run');
    void stage.offsetWidth;
    if (mq.matches) { final(); return; }
    stage.classList.add('is-run');
    at(2900, function () { setScene(2); });
    at(5600, function () { setScene(3); });
    at(8700, matchEvent);
  }
  function final() {
    clearAll(); stage.classList.add('is-run'); setScene(3); stage.classList.add('is-moving');
    setTable(ORDER1, true); rows.vos.querySelector('.lt__p b').textContent = T.vos.after.pts; eventDone = true;
  }
  function reset() { clearAll(); stage.classList.remove('is-run', 'is-moving'); resetTable(); setScene(1); }

  // El visitante puede elegir una escena (también se activa con el teclado).
  stepEls.forEach(function (li) {
    li.setAttribute('tabindex', '0'); li.setAttribute('role', 'button');
    function pick() {
      var n = parseInt(li.getAttribute('data-scene'), 10);
      clearAll(); stage.classList.add('is-run'); resetTable(); setScene(n);
      if (n === 3) { stage.classList.add('is-moving'); setTable(ORDER1, true); rows.vos.querySelector('.lt__p b').textContent = T.vos.after.pts; eventDone = true; }
    }
    li.addEventListener('click', pick);
    li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });

  // Arranca solo al entrar en pantalla y se puede volver a ver al regresar a la sección.
  if (!('IntersectionObserver' in window)) { final(); return; }
  var playing = false;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.intersectionRatio >= 0.55 && !playing) { playing = true; start(); }
      else if (e.intersectionRatio === 0 && playing) { playing = false; reset(); }
    });
  }, { threshold: [0, 0.55] }).observe(stage);
})();
