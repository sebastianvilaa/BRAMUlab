/* BRAMUlive — service worker mínimo, offline-first para los archivos propios.
   Usa rutas relativas para funcionar tanto en file:// / local como en un
   hosting estático. Si falla el registro (p.ej. abierto con file://, donde
   los service workers no corren), la app sigue funcionando normalmente:
   este archivo es un "mejor esfuerzo", no una dependencia. */

// BRAMUlive (desde 2026-09-18): aplicación hermana de BRAMUlab (bramulab/).
// Antes se llamaba BRAMU Lab Partidos y vivía en bramulab-partidos/.
// Cuentas/Nivel/Ranking quedan en BRAMUlab; el registro en vivo, acá.
// Cache con nombre propio, separado del de BRAMUlab. Cuando cambie el bundle,
// actualizar esta clave y `version.json`/PLStore.VERSION según corresponda;
// un cambio de ruta requiere renovar la caché aunque la versión visible siga en v16.
// Esto NUNCA toca localStorage — el historial y el partido en curso viven en otra capa de
// almacenamiento y no se pierden por este cambio.
//
// BRAMUlive y BRAMUlab pueden convivir en el mismo origen — y Cache Storage es por origen,
// no por ruta. El filtro de limpieza de abajo solo borra cachés de la propia familia
// (bramulive-* y el prefijo anterior bramulab-partidos-*), nunca las de la otra app: sin
// estos prefijos específicos, cualquiera de los dos service workers borraría la caché del otro en
// cuanto se activara.
// V16 (2026-09-19) — corrige el criterio de la V15: hereda la UI/UX real del flujo en vivo
// tal como había evolucionado dentro de BRAMUlab justo antes de separarlo (tag
// pre-bramulive-separation-2026-09-18), no solo su paleta. Bump necesario por el mismo
// motivo de siempre: sin esto, un cliente con el service worker ya instalado seguiría
// viendo la pantalla vieja.
// Mismo producto v16; clave renovada por el traslado de la carpeta técnica.
const CACHE_NAME = 'bramulive-v16';
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
      keys.filter((k) => (k.startsWith('bramulive-') || k.startsWith('bramulab-partidos-')) && k !== CACHE_NAME).map((k) => caches.delete(k))
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
