/* BRAMU Lab — service worker mínimo, offline-first para los archivos propios.
   Usa rutas relativas para funcionar tanto en file:// / local como en
   GitHub Pages (subcarpetas). Si falla el registro (p.ej. abierto con
   file://, donde los service workers no corren), la app sigue funcionando
   normalmente: este archivo es un "mejor esfuerzo", no una dependencia. */

// V13.3: bump de versión de cache (bramulab-v13.3). Debe coincidir con PLStore.VERSION
// (store.js) Y con `version.json` (bramu-lab/version.json) — ese archivo es lo que el
// cliente consulta para detectar que hay una versión nueva (§2), así que los TRES deben
// actualizarse juntos en cada release o el chequeo de versión mentiría. Esto NUNCA toca
// localStorage — el historial y el partido en curso viven en otra capa de almacenamiento
// y no se pierden por este cambio de versión.
const CACHE_NAME = 'bramulab-v13.3';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './engine.js',
  './stats.js',
  './store.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
  './icons/splash-b.png',
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
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
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
