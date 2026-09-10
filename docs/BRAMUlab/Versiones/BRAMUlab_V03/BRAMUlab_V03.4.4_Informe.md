# BRAMUlab V03.4.4 — Informe (microparche final sobre V03.4.3)

Ronda puramente visual — cero cambios de lógica (grupos, puntos, Race anual, admins, BRAMU
Intelligence, tabs, GeoRef, Perfil, Historial, Home, Ranking BRAMU oficial, backend, todos
intactos).

## 1. MIS GRUPOS — botón "+ CREAR GRUPO" (§1)

Antes era una fila de texto lima dentro de la lista de grupos (`.picker-sheet-option`, sin
ningún borde/fondo propio — solo el color lo distinguía) — se leía "perdido" contra el resto de
la lista. Pasa a ser un botón real: mismo sistema que `.btn-secondary--accent` (azul, EDITAR
PARTIDO) / `.btn-secondary--danger` (rojo, CERRAR SESIÓN) — mismo alto/padding/radio/
tipografía/tracking que esa familia — con una nueva variante `.btn-secondary--lime` (borde
verde, texto verde, fondo lima muy lavado `rgba(149,255,25,0.10)`). Deliberadamente NO
`.btn-start` (lima sólido): sigue siendo una acción secundaria respecto del grupo activo, nunca
un CTA primario. Vive debajo de la lista de grupos con su propio margen (14px) y `flex:none`
(evita el bug ya documentado de `.btn-secondary` con `flex:1` creciendo para llenar todo el alto
del contenedor padre cuando ese padre es flex-column, como pasó una vez en Configuración del
grupo — acá se previene desde el vamos).

## 2. MIS GRUPOS — cantidad de jugadores por grupo (§2)

Cada fila del selector suma una segunda lectura: `Jueves De Padel · 1 jugador` /
`Sabados Torneo · 3 jugadores`. El nombre conserva el color de la fila (paper normal, o lima si
es el grupo activo); la cantidad queda siempre en `--paper-dim` ("Paper Dim"), sin importar el
estado de selección. La cuenta usa el mismo criterio que ya usa Configuración del grupo
(`PG.isMemberActiveAt`) — cuenta solo miembros ACTIVOS, nunca alguien que ya salió del grupo.
Singular/plural cubierto explícitamente (`1 jugador` vs. `N jugadores`). No se muestran los
nombres de los miembros, solo el total.

## 3. SPLASH — recomposición (§3)

Se retira el ISO "B" (`icons/splash-b.png`), que vivía arriba del wordmark como una segunda
marca separada — el pedido explícito era "una sola marca protagonista, sin duplicar ISO +
wordmark". Queda solo `icons/logo.png` (el mismo wordmark que ya usa el header/footer del resto
de la app), agrandado un 40% (184px → 260px) y a opacidad plena (antes 0.92). El contenedor
vuelve a `justify-content:center` (centrado matemático real) — el `padding-top:26vh` que lo
subía en V03.2.1 estaba pensado para compensar el corrimiento óptico de un bloque de DOS
elementos apilados; con un solo elemento, mucho más corto, ese corrimiento ya no aplica igual y
el centrado matemático lee bien. Verificado visualmente en mobile (375px): el wordmark cae
centrado, sin la sensación de "demasiado arriba" original. La pantalla de acceso/login no se
tocó (nunca usó el splash).

## 4. Ícono de la app (§4) — sin cambios, ver nota

Se revisaron los cinco assets vigentes (`icons/icon-192.png`, `icon-512.png`,
`icon-512-maskable.png`, `apple-touch-icon.png`, `favicon-64.png`) y el `manifest.webmanifest`
(`background_color`/`theme_color`). **Los cinco ya están en azul noche + B lima, sin fondo
verde** — el último cambio sobre esos archivos fue el commit `8c15419` (BRAMUlab V03.2, del
2026-09-09, un día antes de este microparche), que ya los dejó alineados con la identidad
vigente. No se tocó ningún asset para no reintroducir una versión distinta de un ícono que ya
está bien.

Lo más probable es que lo que se está viendo con fondo verde sea el **ícono cacheado por el
sistema operativo** desde antes de V03.2: iOS/Android capturan el ícono en el momento de
"Agregar a pantalla de inicio" y no lo vuelven a consultar después, aunque el `manifest.
webmanifest`/los PNGs cambien en cada deploy (a diferencia de `styles.css`/`app.js`, que sí se
refrescan solos vía el quartet de versión + Service Worker). La solución no es de código: sacar
el ícono de la pantalla de inicio y volver a agregarlo desde el navegador ya muestra la versión
actual.

## 5. QA

**Mobile (375px):** cuenta creada de punta a punta (registro nuevo), 2 grupos creados
("Jueves De Padel" con 1 miembro, "Sabados Torneo" con 3) para cubrir singular y plural a la
vez · selector con 1 grupo → botón `.btn-secondary--lime` visible, separado de la lista,
"1 jugador" en gris tenue · selector con 2+ grupos → mismo botón, "3 jugadores" en plural, check
en el grupo activo, cambio de grupo funcionando (switch real, no solo visual) · splash
recompuesto, capturado con la animación congelada vía inspección directa del elemento (se apaga
sola a 1.5s) — wordmark centrado y agrandado, sin el ISO arriba · regresión: modal "Eliminar
grupo" sigue en 12px (`getComputedStyle` confirmó `12px` en ambos botones, fix de V03.4.3
intacto) · tabs "Actual/Anterior/Race anual" siguen en minúscula/mayúscula inicial (fix de
V03.4.3 intacto).

**Desktop (1200px):** selector de grupos con el mismo botón y segunda lectura, chequeo visual
rápido sin hallazgos.

## 6. Tests

Sin tests nuevos — los 4 puntos son texto/CSS/orden de render/composición de imágenes, no
lógica nueva (mismo criterio explícito del consolidado: "sin tests nuevos salvo que se toque
lógica accidentalmente"). **Suite completa, una sola corrida al cierre: 828/828 OK** (sin
cambios respecto a V03.4.3 — ninguna función pura se tocó).

## 7. Versionado

`Store.VERSION`: `BRAMUlab V03.4.4`. Quartet completo: `version.json`, `sw.js` (`CACHE_NAME` +
`CORE_ASSETS` — también se retiró de `CORE_ASSETS` la entrada `icons/splash-b.png`, que ya no se
usa en ninguna pantalla), `index.html` (`?v=03.4.4`).

## 8. Commit / tag / deploy

Tag `BRAMUlab_V03.4.4`. Push a `main` → GitHub Pages redeploya automáticamente
(https://sebastianvilaa.github.io/BRAMUlab/bramulab/).
