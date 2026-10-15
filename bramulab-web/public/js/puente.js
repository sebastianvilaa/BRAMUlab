/* BRAMUlab Web · franja «Cada partido tiene una historia.»: arma la secuencia y la repite mientras la sección está visible, hasta 3 veces.
   Ciclo = secuencia (~5,8 s: «La guardás» arranca cuando la pelota cruza la red por primera vez y el peloteo sigue) + pausa de ~5 s con el estado
   final completo + fundido corto y reinicio. Tras la 3.ª vez queda quieta en el estado final (no se vuelve repetitiva); si la persona sale de la
   sección y vuelve, retoma desde cero. Se suspende (sin temporizadores ni animaciones corriendo) cuando la sección sale de pantalla o la pestaña pasa
   a segundo plano. Sin JS, sin IntersectionObserver o con movimiento reducido NO se arma: queda el estado final estático (el relato se entiende igual).
   Solo alterna clases; el movimiento es CSS. */
(function () {
  'use strict';
  var el = document.getElementById('puente');
  var stage = document.getElementById('bridge-stage');
  if (!el || !stage) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  if (mq.matches || !('IntersectionObserver' in window)) return;

  var SEQ = 5800, PAUSE = 5000, FADE = 400, MAX_PLAYS = 3;
  var inView = false, timer = null, plays = 0, done = false;

  function stop() {
    clearTimeout(timer); timer = null; plays = 0; done = false;
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
    plays += 1;
    timer = setTimeout(function () {
      if (plays >= MAX_PLAYS) { done = true; timer = null; return; }   // última vez: se queda en el estado final
      stage.classList.add('is-fade');             // fundido antes de reiniciar: la repetición no «salta»
      timer = setTimeout(cycle, FADE);
    }, SEQ + PAUSE);
  }
  function sync() {
    if (inView && !document.hidden) { if (!timer && !done) cycle(); } else if (timer || done || el.classList.contains('is-play')) stop();
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
