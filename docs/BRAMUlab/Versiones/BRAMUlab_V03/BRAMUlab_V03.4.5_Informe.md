# BRAMUlab V03.4.5 — Informe (microparche responsive final sobre V03.4.4)

Ronda puramente visual/responsive — cero cambios de lógica, datos o fórmula (grupos, puntos,
Race anual, admins, BRAMU Intelligence, GeoRef, Perfil mobile, Mis Datos, ubicación, Nivel
BRAMU, Ranking BRAMU oficial, backend, todos intactos).

## 1. MIS GRUPOS — botón CREAR GRUPO sin el "+" (§1)

Cambio de una línea: el label del botón `.btn-secondary--lime` (agregado en V03.4.4) pasa de
`+ CREAR GRUPO` a `CREAR GRUPO`. Cero cambios de tamaño, color, borde, padding, ubicación ni
jerarquía — solo el texto.

## 2. BOTTOM NAV en tablet — bug real, dos capas (§2)

La barra se veía como una pastilla flotante angosta en tablet (ej. iPad Mini, 768px de ancho).
Dos problemas apilados, no uno:

1. **El ancho tope estaba mal elegido.** `max-width:480px` era más angosto que el ancho "de
   contenido" que ya usa TODO el resto de la interfaz en este mismo breakpoint (`min-width:
   720px`): `.view--history`, `.history-filters` y `.profile-tabs` usan los tres
   `max-width:768px` — la barra inferior era la única pieza de la pantalla con un ancho
   distinto (y más chico) que el resto.

2. **El truco de centrado estaba mal combinado con la regla base — y este era el bug que de
   verdad importaba.** `.bottom-nav` centraba con `left:50%; transform:translateX(-50%)`, pero
   la regla BASE (fuera del media query) ya traía `right:0` — y ese `right:0` seguía activo
   (el media query nunca lo pisaba). Con `left:50%` Y `right:0` simultáneos, el navegador
   resuelve el ancho por ecuación (`ancho = contenedor - left - right`), lo que en un viewport
   de 768px da exactamente `768 - 384 - 0 = 384px` — **sin importar qué valor tuviera
   `max-width`**. Subir el número de 480 a 768 solo, sin tocar esto, no habría cambiado nada en
   la práctica (confirmado midiendo con `getBoundingClientRect()` antes/después).

Fix: mismo patrón que `.view--history`/`.history-filters`/`.profile-tabs` — `left:0; right:0`
(ancho automático = 100% del contenedor) + `margin:0 auto` para centrar una vez que
`max-width:768px` lo topea. Sin el conflicto de la capa 2, el ancho real pasó a ser
exactamente 768px en tablet (verificado: `navWidth:768, navLeft:0` — de punta a punta en un
iPad Mini) y se centra con margen simétrico en desktop más ancho (768px, 256px de margen a
cada lado en un viewport de 1280px — mismo margen que Perfil/Historial en ese mismo ancho).
Se retira también el `border-radius`: a 768px de viewport la barra queda pegada a ambos bordes,
así que esquinas redondeadas ahí se hubieran visto como un recorte roto. Mobile (`<720px`) no
tiene cambios — la regla vive entera dentro del media query existente.

## 3. PERFIL — tabs en tablet (§3)

Mismo tipo de bug que el punto 2, en otro componente: `.profile-tabs` es un ítem flex del
contenedor columna `.view--history` (`display:flex;flex-direction:column`). Al agregarle
`margin:0 auto` para centrarlo (mismo patrón que `.history-filters`), el eje cruzado (horizontal
en este caso) pasa a tener márgenes automáticos — y eso, por especificación de flexbox,
**desactiva el `align-items:stretch` por defecto**: en vez de ocupar el ancho disponible
(768px), el contenedor colapsaba a "encogerse hasta el contenido" — medido en vivo: ~348px, muy
lejos del `max-width:768px` que la regla declaraba. Los 3 `flex:1` de `.profile-tab` se repartían
ESE ancho angosto (no el ancho real de la pantalla), dejando las 3 pestañas apretadas contra el
borde izquierdo con un vacío enorme a la derecha — el bug real detrás de "quedan agrupadas".

Fix: un `width:100%` explícito en la misma regla. Al dejar de ser `auto`, el ancho ya no depende
de si `stretch` está activo o no — simplemente ES 100% del contenedor (topeado por
`max-width:768px`). Verificado con `getBoundingClientRect()` en las 3 pestañas: cada una pasa a
medir ~241px y a repartirse todo el ancho real (18px a 750px, exactamente el padding declarado
de cada lado) — MI PERFIL / MIS DATOS / JUGADORES ahora ocupan la pantalla completa, mismo
tamaño de fuente (13px), mismo peso, mismo indicador de pestaña activa (línea inferior lima),
cero cambios en mobile.

## 4. PERFIL — gráfico de Evolución en tablet (§4)

Bug real encontrado en `buildLevelEvolutionSvgHTML` (el SVG de "Evolución del Nivel BRAMU"): el
`viewBox` usaba un ancho virtual FIJO (`LEVEL_CHART_WIDTH = 320`) mientras el `<svg>` se
renderiza a `width:100%; height:auto` (para entrar siempre en el ancho disponible). En SVG, el
tamaño de fuente (`font-size`) de los textos vive en las MISMAS unidades del `viewBox`, no en
píxeles reales de pantalla — así que al estirar un `viewBox` de 320 unidades hasta un contenedor
de ~700px en tablet, el navegador escala TODO el sistema de coordenadas por igual, texto
incluido: un factor ~2.2x, labels de 9px terminaban renderizando a ~20-23px reales (confirmado
con una réplica exacta del algoritmo inyectada en vivo: `labelRealPixelHeight` pasó de 23.5px
con el ancho fijo a 10.5px con el fix — y el alto total del SVG, que también escalaba de
más, bajó de 392px a los 178px correctos). Exactamente el síntoma descrito: "el gráfico gana
ancho, pero también se están escalando demasiado los textos".

Fix: `buildLevelEvolutionSvgHTML` pasa a recibir el ancho como parámetro (`chartWidth`) en vez
de usar la constante fija. `renderProfileEvolution` mide el ancho REAL del contenedor
(`#evolution-chart-wrap`, ya presente en el DOM y todavía vacío en ese momento — medirlo no
depende de su propio contenido) con `getBoundingClientRect()` justo antes de insertar el SVG, y
pasa ese número. Con el `viewBox` coincidiendo con el ancho renderizado real, la escala queda
siempre ~1:1: el gráfico SÍ gana ancho real (más espacio horizontal entre puntos de datos, el
objetivo pedido), pero el texto deja de crecer porque ya no hay factor de escala que lo
infle. La altura del `viewBox` (180, fija) no se tocó, así que la altura del gráfico tampoco
crece — solo se ensancha. Cero cambios a `computeLevelEvolution`/`computeLevelDeltaForMatch`
(la fórmula/lógica de Nivel BRAMU) ni a `LEVEL_CHART_PAD_*`/`LEVEL_CHART_MAX_X_LABELS` (densidad
de labels sin cambios). Único punto de fallback: si el contenedor mide 0 (vista todavía oculta
al momento del render), usa la constante fija de siempre en vez de romper con un viewBox de
ancho 0.

**Nota de verificación:** el gráfico numérico real solo se muestra para cuentas
`legacyMigrated:true` (el consolidado V03.0 lo confirma: para cuentas nuevas "la fórmula real
todavía no existe", se ve CALIBRANDO en su lugar) — no fue posible generar una de esas cuentas
con datos reales sin fabricar historial de partidos a mano. La verificación se hizo inyectando
en vivo una réplica exacta del algoritmo de `buildLevelEvolutionSvgHTML` (mismas constantes,
mismo cálculo de `xAt`/`yAt`/grid) dentro del contenedor real (`#evolution-chart-wrap`) de una
cuenta de prueba en tablet, comparando el resultado con ancho fijo (320, el bug) contra ancho
medido (el fix) — mismo componente, mismas clases CSS, mismo `getComputedStyle` real.

## 5. QA

**Mobile (375px):** Home, Perfil (tabs, tarjetas), selector de Mis Grupos con el botón `CREAR
GRUPO` (sin `+`, mismo estilo) — sin regresiones, bottom nav sin cambios.

**Tablet (768px, iPad Mini):** bottom nav de punta a punta (`navWidth:768, navLeft:0`, sin
`border-radius`) · tabs de Perfil repartidas en 3 segmentos iguales de ~241px cada una,
cubriendo el ancho completo (`getBoundingClientRect()` en las 3) · gráfico de Evolución con
labels de eje X/Y en su tamaño real (~10.5px de alto, no ~23.5px) y altura de 178px (no 392px) ·
título/badge BETA/valores superiores (HTML normal, nunca dentro del SVG) sin cambios, ya estaban
inmunes a este bug por construcción.

**Desktop (1280px):** bottom nav y tabs de Perfil, ambos consistentes con el mismo
`max-width:768px` centrado que ya usa el resto de la interfaz a ese ancho (256px de margen a
cada lado) — chequeo rápido sin hallazgos.

## 6. Tests

Sin tests nuevos — los 4 puntos son CSS de layout/ancho y una corrección de escala geométrica en
un SVG (nunca la fórmula ni los datos de Nivel BRAMU), ninguno toca lógica pura cubierta por la
suite. **Suite completa, una sola corrida al cierre: 828/828 OK** (sin cambios respecto a
V03.4.4 — ninguna función pura se tocó; `buildLevelEvolutionSvgHTML` no tiene tests dedicados,
solo `computeLevelEvolution`/`computeLevelDeltaForMatch`/etc., que no se tocaron).

## 7. Versionado

`Store.VERSION`: `BRAMUlab V03.4.5`. Quartet completo: `version.json`, `sw.js` (`CACHE_NAME` +
`CORE_ASSETS`), `index.html` (`?v=03.4.5`).

## 8. Commit / tag / deploy

Tag `BRAMUlab_V03.4.5`. Push a `main` → GitHub Pages redeploya automáticamente
(https://sebastianvilaa.github.io/BRAMUlab/bramulab/).
