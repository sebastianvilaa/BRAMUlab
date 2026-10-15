/* BRAMUlab Web · franja «Cada partido tiene una historia.»: arma la secuencia y la repite en bucle mientras la sección está visible.
   Ciclo = secuencia (~8,3 s) + pausa de ~3 s con el estado final completo + fundido corto y reinicio. Se suspende (sin temporizadores ni
   animaciones corriendo) cuando la sección sale de pantalla o la pestaña pasa a segundo plano. Sin JS, sin IntersectionObserver o con
   movimiento reducido NO se arma: queda el estado final estático (el relato se entiende igual). Solo alterna clases; el movimiento es CSS. */
(function () {
  'use strict';
  var el = document.getElementById('puente');
  var stage = document.getElementById('bridge-stage');
  if (!el || !stage) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  if (mq.matches || !('IntersectionObserver' in window)) return;

  var SEQ = 8300, PAUSE = 3000, FADE = 400;
  var inView = false, timer = null;

  function stop() {
    clearTimeout(timer); timer = null;
    el.classList.remove('is-play'); el.classList.add('is-armed'); stage.classList.remove('is-fade');
  }
  function cycle() {
    clearTimeout(timer);
    stage.classList.remove('is-fade');
    // Reinicio real de las animaciones CSS: se quitan (is-armed + is-play) y se vuelven a poner con un reflow entre medio.
    el.classList.remove('is-play', 'is-armed');
    void el.offsetWidth;
    el.classList.add('is-armed');
    void el.offsetWidth;
    el.classList.add('is-play');
    timer = setTimeout(function () {
      stage.classList.add('is-fade');             // fundido antes de reiniciar: la repetición no «salta»
      timer = setTimeout(cycle, FADE);
    }, SEQ + PAUSE);
  }
  function sync() {
    if (inView && !document.hidden) { if (!timer) cycle(); } else if (timer || el.classList.contains('is-play')) stop();
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
