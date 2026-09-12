/* BRAMU Lab — service worker mínimo, offline-first para los archivos propios.
   Usa rutas relativas para funcionar tanto en file:// / local como en
   GitHub Pages (subcarpetas). Si falla el registro (p.ej. abierto con
   file://, donde los service workers no corren), la app sigue funcionando
   normalmente: este archivo es un "mejor esfuerzo", no una dependencia. */

// Reorganización de aplicaciones — cache propia de BRAMU Lab, con nombre y esquema de
// versión completamente separados del marcador congelado BRAMU Lab Partidos
// (bramulab-partidos-*). Debe coincidir con PLStore.VERSION (store.js) Y con
// `version.json` — ese archivo es lo que el cliente consulta para detectar que hay una
// versión nueva, así que los TRES deben actualizarse juntos en cada release. Esto NUNCA
// toca localStorage.
//
// BRAMU Lab y BRAMU Lab Partidos conviven en el mismo origen (sebastianvilaa.github.io) —
// y Cache Storage es por origen, no por ruta. El filtro de limpieza de abajo solo borra
// cachés de la propia familia ('bramulab-vN'), nunca las del marcador congelado
// ('bramulab-partidos-...') — OJO: el prefijo no puede ser el genérico 'bramulab-', porque
// 'bramulab-partidos-v14' también empieza con esas letras y terminaría borrado por error.
// V02.1 — bump de la clave de caché junto con Store.VERSION/version.json (el string humano
// SÍ cambia esta vez, "BRAMUlab V02.1" — ver checkForNewVersion en app.js). Necesario en
// cualquier caso porque sw.js no cambia de bytes en una ronda de ajuste típica, así que sin
// este bump un cliente con el bundle viejo ya instalado nunca dispara un reinstall del
// service worker y se queda para siempre con la caché desactualizada.
// Hotfix bloqueante de V03.5.2 (crash de Ranking con self sin partidos) — sufijo `-h1` SOLO
// acá y en las query strings de abajo, nunca en `Store.VERSION`/`version.json`: el string
// humano de versión sigue siendo "BRAMUlab V03.5.2" a propósito (no es una V03.5.3), pero el
// bundle SÍ cambió de bytes, así que sin este bump el cliente que ya tenía el service worker
// instalado nunca se entera — se queda para siempre sirviendo el `player-home.js` roto desde
// caché, exactamente el bug que este hotfix corrige.
// `-h2` — microajuste visual posterior (bottom sheet de selección simple del Ranking en
// mobile, solo `styles.css`): mismo motivo de bump, ninguno nuevo.
const CACHE_NAME = 'bramulab-v03-6';
// V03.1.6 — "?v=X" en los JS/CSS propios: DEBE ser el mismo valor que usan los <script src>/
// <link> de index.html (ver nota ahí — bug real de update-loop en producción, nunca
// reproducido en el dev server local porque ese sí manda Cache-Control: no-store en todo). Si
// estas dos listas de URLs no coinciden AL BYTE, `caches.match(event.request)` del fetch
// handler de abajo nunca encuentra el asset pre-cacheado (la query string es parte de la
// clave) y cada carga real termina pidiéndolo de nuevo a la red — funciona igual, pero pierde
// el offline-first. Bumpear siempre junto con CACHE_NAME/APP_VERSION/version.json.
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=03.6',
  './engine.js?v=03.6',
  './stats.js?v=03.6',
  './store.js?v=03.6',
  './player-home.js?v=03.6',
  './match-load.js?v=03.6',
  './player-identity.js?v=03.6',
  './groups.js?v=03.6',
  './locations.js?v=03.6',
  './ranking.js?v=03.6',
  './app.js?v=03.6',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
  './icons/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => { /* si algún asset falla, no bloquear la instalación */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('bramulab-v') && k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Google Fonts u otro origen externo: intentar red, sin romper si falla.
  const isSameOrigin = event.request.url.startsWith(self.location.origin);
  if (!isSameOrigin) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 504 })));
    return;
  }
  // V13.2 (§2): `version.json` es la fuente de verdad para detectar una versión nueva —
  // SIEMPRE red, nunca esta estrategia cache-first. Si se sirviera cacheado, el chequeo de
  // versión nunca podría ver una versión más nueva hasta que la propia caché ya se hubiera
  // actualizado sola — exactamente lo que este archivo existe para evitar. Nunca se agrega
  // a CORE_ASSETS ni se guarda en `caches` por este mismo motivo.
  if (event.request.url.indexOf('/version.json') !== -1) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => new Response('{}', { status: 504 })));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
