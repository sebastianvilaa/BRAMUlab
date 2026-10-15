/* BRAMUlab Web · franja «Cada partido tiene una historia.»: arma la secuencia y, cuando termina, la deja «viva» mientras la sección está visible.
   Al entrar en pantalla corre la secuencia inicial UNA vez (~5,8 s: «La guardás» entra cuando la pelota cruza la red por primera vez). Después se agrega
   `is-live`: el peloteo nunca se frena, el celular tiene un destello, el tilde late y las barras de estadística se vuelven a armar, SIN reiniciar ni
   hacer desaparecer ningún texto. Sin límite de repeticiones ni fundidos. Al salir de pantalla (o con la pestaña en segundo plano) todo se detiene sin
   dejar temporizadores ni animaciones corriendo; al volver, retoma desde cero. Sin JS, sin IntersectionObserver o con movimiento reducido NO se arma:
   queda el estado final estático (el relato se entiende igual). Solo alterna clases; el movimiento es CSS. */
(function () {
  'use strict';
  var el = document.getElementById('puente');
  var stage = document.getElementById('bridge-stage');
  if (!el || !stage) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  if (mq.matches || !('IntersectionObserver' in window)) return;

  var INTRO = 5800;
  var inView = false, timer = null, running = false;

  function stop() {
    clearTimeout(timer); timer = null; running = false;
    el.classList.remove('is-play', 'is-live'); el.classList.add('is-armed');
  }
  function start() {
    clearTimeout(timer);
    running = true;
    // Reinicio real de las animaciones CSS: se quitan y se vuelven a poner con un reflow entre medio.
    el.classList.remove('is-play', 'is-armed', 'is-live');
    void el.offsetWidth;
    el.classList.add('is-armed');
    void el.offsetWidth;
    el.classList.add('is-play');
    timer = setTimeout(function () { timer = null; el.classList.add('is-live'); }, INTRO);
  }
  function sync() {
    if (inView && !document.hidden) { if (!running) start(); } else if (running) stop();
  }

  el.classList.add('is-armed');
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.intersectionRatio >= 0.4) inView = true;
      else if (e.intersectionRatio === 0) inView = false;
    });
    sync();
  }, { threshold: [0, 0.4] }).observe(stage);
  document.addEventListener('visibilitychange', sync);
})();
