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
// BRAMUlab_V03.6 — sufijo `-h1` reiniciado para esta versión (ronda de correcciones post-QA
// real: bug de historial/Nivel simulado en Perfil público, Recuperar contraseña, onboarding,
// Mis Datos tappable, copy de WhatsApp — ver el Reporte para ChatGPT). Mismo criterio de
// siempre: `Store.VERSION`/`version.json` siguen en "BRAMUlab V03.6" (nunca V03.7), pero
// varios `.js`/`.css` propios sí cambiaron de bytes.
// `-h2` — último hotfix focal de V03.6: Ranking usaba Nivel simulado por hash para jugadores
// reales no-self (ranking.js), "Mis jugadores" mostraba un @usuario fabricado en vez del real
// (app.js), y estructura de fila de Ranking normalizada a 3 renglones (app.js/styles.css).
// Mismo motivo de bump de siempre, ninguno nuevo.
// BRAMUlab_V03.7 — versión nueva (no un hotfix de V03.6): corrección de geografía del Ranking
// (Local/Provincial/País dejan de mezclar localidades/provincias sin relación, ranking.js) +
// nueva tarjeta RANKING BRAMU en Perfil público (app.js/index.html/styles.css). Sufijo `-h`
// reiniciado (sin sufijo) porque es una versión nueva, no una ronda de ajuste sobre V03.6.
// BRAMUlab_V03.8 — cierre UX de Ranking BRAMU: tarjeta territorial también en Mi Perfil (misma
// fuente que Perfil público), jerarquía tipográfica del puesto reforzada, Ranking como
// candidato de TU MOMENTO en Home (ranking.js/player-home.js/app.js/index.html/styles.css) —
// "TU POSICIÓN → contexto cercano" ya funcionaba (sin cambios de código, ver reporte).
// BRAMUlab_V03.9 — microajustes de cierre de V03: framing de forma reciente en TU MOMENTO según
// el balance real (nunca "ganar" con balance negativo, player-home.js), composición/copy de TU
// POSICIÓN en Mi red con 1-2 elegibles (app.js), prueba determinística de rollover semanal
// (tests.html, sin cambios de lógica temporal).
// BRAMUlab_V03.10 — cierre final de V03: TU MOMENTO omite la forma reciente cuando el balance no
// es positivo (nunca "perdiste"/neutro, superando el copy de V03.9, player-home.js); Compañeros/
// Rivales muestran `Nombre · @username` con identidad segura por userId (player-home.js/app.js).
// BRAMUlab_V04.5 — primer bump de versión pública desde el cierre de V03.10 (tag estable
// anterior, sigue disponible). La app que Sebastián abre para desarrollar/probar V04 ahora se
// identifica como "BRAMUlab V04.5" en vez de seguir mostrando "V03.10" — necesario además para
// que level.js/level-context.js/level-calibration.js (agregados a index.html en V04.4, hasta
// ahora sin bump porque no había release) y el ícono nuevo de preview (V04.4.1→V04.5) lleguen
// realmente a quien ya tenía la PWA/caché instalada, mismo motivo que cualquier bump anterior.
// BRAMUlab_V04.6 — estimador inicial V1.1 (reemplaza a V1.4) + medidor/categoría/laboratorio;
// bump necesario para que quien ya tenía la PWA instalada deje de ver el cuestionario/stepper
// viejos (Handoff V04.6 §14).
// Backend Bloque 2 — sufijo `-h1` (mismo patrón que V03.5.2/V03.6 más arriba): agrega
// auth.js/env.generated.js + toca index.html/app.js/store.js/player-identity.js/locations.js
// para conectar Supabase Auth real. `Store.VERSION`/`version.json` siguen en "BRAMUlab V04.10"
// a propósito — esto es un bloque de Backend/Infraestructura, no una ronda nueva de Nivel BRAMU
// (ver docs/BRAMUlab/README.md §6: Backend no usa la numeración V04.x). Sin este bump, un
// cliente que ya tenía el service worker instalado seguiría sirviendo desde caché la versión
// sin backend real.
// BRAMUlive (2026-09-18) — sufijo `-h2`: separación del marcador/registro en vivo (retira
// `Registrar partido en vivo`, view-setup/view-match, Timeline, la pestaña Observados de
// Historial; el `+` va directo a Cargar mi partido) a la aplicación hermana BRAMUlive. Mismo
// motivo que el bump anterior: sin esto, un cliente con el service worker ya instalado
// seguiría viendo el selector viejo. `Store.VERSION`/`version.json` siguen en
// "BRAMUlab V04.10" a propósito, mismo criterio que Backend Bloque 2 arriba.
// Backend Bloque 3 — `-h4`: detectar signup obfuscado de email existente en auth.js.
// El sufijo solo renueva el bundle/caché; Store.VERSION y version.json siguen V04.10.
// Backend Bloque 3 — `-h8`: si el email ya fue confirmado anticipadamente y la sesión
// sigue válida, CONFIRMAR MI NIVEL salta OTP y oficializa directo.
// Backend Bloque 4 — `-h9`: bug real encontrado al bumpear esta ronda — la línea anterior
// tenía un "\n" literal (texto, no salto de línea real) que dejaba `const CACHE_NAME = ...`
// adentro de este mismo comentario `//`, así que NUNCA se declaraba de verdad: cualquier
// referencia a CACHE_NAME (install/activate/fetch de abajo) lanzaba ReferenceError en tiempo
// de ejecución, rompiendo el caching offline-first por completo. Se corrige acá de paso,
// porque bumpear el sufijo exige tocar esta misma línea de todos modos.
// Backend Bloque 5 — `-h15`: correcciones de QA real de Work — identidad por player_id
// aunque dos usuarios compartan display_name, hora desconocida sin 00:00 en Historial,
// estado pendiente visible en Último partido y copy correcto Ocultar/Descartar.
// Bump para invalidar el bundle h14 cacheado.
// Backend Bloque 5 — `-h14`: ajuste final de la separación display/computable para ocultos:
 // el cache conserva hidden para que un partido VALIDADO oculto siga computando, mientras
 // match-sync.js lo excluye de Home/Historial. Mismo criterio de bump de bundle.
// Backend Bloque 5 — `-h13`: revisión posterior al wiring real — preserva hora conocida/zona/
// lugar/nota privada en el feed compartido, respeta ocultamiento personal y evita que un partido
// pendiente altere la forma reciente. Bump necesario para que esos hotfixes no queden detrás
// del bundle `-h12` ya cacheado.
// Backend Bloque 5 — `-h12`: wiring de frontend de partidos compartidos — agrega matches.js/
// match-sync.js a CORE_ASSETS y toca app.js/store.js/index.html. Mismo criterio que Bloque 2/3/4
// arriba: `Store.VERSION`/`version.json` siguen en "BRAMUlab V04.10" (Backend/Infraestructura no
// usa la numeración V04.x). Sin este bump, un cliente con el service worker ya instalado
// seguiría sirviendo desde caché la app.js sin la carga server-backed.
const CACHE_NAME = 'bramulab-v04-10-h18';
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
  './styles.css?v=04.10-h18',
  './engine.js?v=04.10-h18',
  './stats.js?v=04.10-h18',
  './store.js?v=04.10-h18',
  // BRAMUlab_V04.5 — quedaban fuera de CORE_ASSETS desde que se agregaron a index.html en
  // V04.4 (a propósito, sin bump todavía); esta es la primera release real que los incluye.
  './level.js?v=04.10-h18',
  './level-context.js?v=04.10-h18',
  './level-calibration.js?v=04.10-h18',
  './player-home.js?v=04.10-h18',
  './match-load.js?v=04.10-h18',
  './player-identity.js?v=04.10-h18',
  './groups.js?v=04.10-h18',
  './locations.js?v=04.10-h18',
  './ranking.js?v=04.10-h18',
  // Backend Bloque 2 — auth.js (nuevo). El CDN de supabase-js y env.generated.js NO se
  // pre-cachean acá a propósito: el primero es de otro origen (el fetch handler de abajo ya
  // trata cualquier origen externo aparte, "mejor esfuerzo" sin bloquear el install), y el
  // segundo varía por deploy (Vercel lo genera en build) — igual queda cacheado la primera vez
  // que se pide, por el fetch handler genérico de más abajo.
  './auth.js?v=04.10-h18',
  // Backend Bloque 5 — matches.js/match-sync.js (nuevos). Igual criterio que auth.js: quedan
  // inertes sin backend configurado, pero se pre-cachean igual (offline-first para todos).
  './matches.js?v=04.10-h18',
  './match-sync.js?v=04.10-h18',
  './match-validation.js?v=04.10-h18',
  './app.js?v=04.10-h18',
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
