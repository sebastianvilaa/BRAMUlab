/* BRAMUlab Web · franja «Jugás. Lo cargás. Empieza a sumar.»: arma la secuencia (estado inicial) y la corre al entrar en pantalla.
   Sin JS, sin IntersectionObserver o con movimiento reducido NO se arma: queda el estado final estático (el relato se entiende igual).
   Vuelve a correr al regresar a la sección (igual que Grupos y Nivel). Solo alterna clases; las animaciones son CSS (transform/opacity). */
(function () {
  'use strict';
  var el = document.getElementById('puente');
  var stage = document.getElementById('bridge-stage');
  if (!el || !stage) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  if (mq.matches || !('IntersectionObserver' in window)) return;

  el.classList.add('is-armed');
  var playing = false;
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.intersectionRatio >= 0.5 && !playing) { playing = true; el.classList.add('is-play'); }
      else if (e.intersectionRatio === 0 && playing) { playing = false; el.classList.remove('is-play'); }
    });
  }, { threshold: [0, 0.5] }).observe(stage);
})();
