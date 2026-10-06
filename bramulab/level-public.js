/* ==========================================================================
   BRAMU Lab — level-public.js (V04.35 / 04.35-h2, hardening de exposición)
   Primitivas PÚBLICAS de Nivel BRAMU para el NAVEGADOR: lo único que la app necesita del
   namespace `PLLevel` (estados, versión de algoritmo, redondeo público y clamp a la escala).

   Por qué existe: el motor dinámico posterior a partidos (expectativa, margen, K, repetición,
   círculo competitivo, confianza, inactividad…) vive en `level.js` + `level-context.js` y corre
   EXCLUSIVAMENTE server-side (Edge Functions) y en tests. Ya no se sirve al navegador. Este
   archivo reemplaza a `level.js` en `index.html`/`sw.js`/`dist/`.

   Contrato (verificado por `h2-hardening-exposicion.test.mjs`):
   - expone `window.PLLevel` con SOLO `ALGORITHM_VERSION`, `STATES`, `roundPublicLevel`,
     `clampLevel`; el test compara cada una contra `level.js` (mismos valores/mismo
     comportamiento) para que no puedan divergir en silencio;
   - no contiene ningún parámetro ni fórmula del motor dinámico (la escala 1–10 y los
     decimales de redondeo son públicos: figuran en la UI y en Nivel_BRAMU.md);
   - `level.js` NO se modifica (su SHA-256 está pineado por v0428-nivel-inicial-v13.test.mjs).
   Cualquier primitiva nueva que necesite el navegador se agrega acá y se paridad-testea; jamás
   se vuelve a cargar `level.js`/`level-context.js` en `index.html`.
   ========================================================================== */
(function (global) {
  'use strict';

  const ALGORITHM_VERSION = 'nivel_bramu_v1_0';

  const STATES = {
    NONE: 'sin_estimacion',
    CALIBRATING: 'calibrando',
    CALIBRATED: 'calibrado',
    RECALIBRATING: 'recalibrando',
  };

  // Escala pública (1.0–10.0) y precisión: interna 4 decimales, de presentación 1 decimal.
  const SCALE_MIN = 1.0;
  const SCALE_MAX = 10.0;
  const INTERNAL_DECIMALS = 4;
  const PUBLIC_DECIMALS = 1;

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function roundTo(n, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(n * factor) / factor;
  }

  function roundInternal(n) { return roundTo(n, INTERNAL_DECIMALS); }

  /** Único punto de redondeo a 1 decimal para mostrar. Normaliza `-0` a `0`. */
  function roundPublicLevel(mu) {
    const r = roundTo(mu, PUBLIC_DECIMALS);
    return r === 0 ? 0 : r;
  }

  function clampLevel(mu) { return roundInternal(clamp(mu, SCALE_MIN, SCALE_MAX)); }

  global.PLLevel = {
    ALGORITHM_VERSION,
    STATES,
    roundPublicLevel,
    clampLevel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
