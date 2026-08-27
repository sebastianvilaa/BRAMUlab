/* BRAMU Lab — service worker mínimo, offline-first para los archivos propios.
   Usa rutas relativas para funcionar tanto en file:// / local como en
   GitHub Pages (subcarpetas). Si falla el registro (p.ej. abierto con
   file://, donde los service workers no corren), la app sigue funcionando
   normalmente: este archivo es un "mejor esfuerzo", no una dependencia. */

// V11.7: bump de versión de cache (bramulab-v11.7). Debe coincidir con PLStore.VERSION
// (store.js) — un service worker no puede importar ese módulo, así que este string se
// actualiza a mano en cada versión, pero es el ÚNICO lugar fuera de store.js donde
// vive el número. Esto NUNCA toca localStorage — el historial y el partido en curso
// viven en otra capa de almacenamiento y no se pierden por este cambio de versión.
const CACHE_NAME = 'bramulab-v11.7';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './engine.js',
  './stats.js',
  './store.js',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
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
