/* BRAMUlab web — contador anónimo de vistas y clics (v1.1). No usar en la app/PWA.
 * Agregar con <script defer src="/js/web-metrics.js"></script> a la web pública
 * SOLAMENTE cuando se apruebe su Política de Privacidad y activación.
 * No usa cookies, localStorage, IDs, IP ni seguimiento entre dominios.
 */
(function () {
  'use strict';
  const HOSTS = new Set(['bramulab.com', 'www.bramulab.com']);
  const APP_URL = 'https://app.bramulab.com';
  const SOURCES = new Set(['hero', 'login', 'instalacion', 'final']);
  if (!HOSTS.has(window.location.hostname)) return;

  function count(event, source) {
    const payload = JSON.stringify({ event, source });
    let sent = false;
    try {
      if (navigator.sendBeacon) {
        sent = navigator.sendBeacon('/api/metrics', new Blob([payload], { type: 'application/json' }));
      }
    } catch (_) { /* nunca impedir navegar */ }
    if (!sent && typeof fetch === 'function') {
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'same-origin'
      }).catch(function () { /* medición aproximada, jamás bloquear el enlace */ });
    }
  }
  function init() {
    count('view', 'page');
    document.addEventListener('click', function (e) {
      const a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      let u;
      try { u = new URL(a.href, window.location.href); } catch (_) { return; }
      // Solo la entrada real a la app (home/PWA), nunca documentos legales
      // (/terminos/, /privacidad/) u otras rutas alojadas en el mismo dominio.
      // El query/hash del acceso principal puede variar sin cambiar su destino.
      if (u.origin !== APP_URL || (u.pathname !== '/' && u.pathname !== '/index.html')) return;
      const source = (a.dataset && a.dataset.bramuCta) || 'other';
      count('click', SOURCES.has(source) ? source : 'other');
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
