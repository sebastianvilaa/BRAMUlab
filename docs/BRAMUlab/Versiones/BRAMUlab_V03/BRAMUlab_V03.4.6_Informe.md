# BRAMUlab V03.4.6 — Informe (dos hallazgos de QA sobre V03.4.5)

Ronda puramente visual/responsive — cero cambios de lógica, datos o fórmula.

## 1. Historial — tabs sin alinear a la izquierda en tablet (bug real)

Mismo mecanismo EXACTO que el bug ya corregido en `.profile-tabs` (V03.4.5 §3), en otro
componente que hasta ahora no lo mostraba: `.history-filters` es ítem flex DIRECTO de
`.view--history` (`display:flex;flex-direction:column`) en la pantalla de Historial. El
`margin:0 auto` que centra el bloque en tablet desactiva `align-items:stretch` por spec, así que
el contenedor colapsaba a su ancho de contenido (~361px medido, lejos del `max-width:768px`
declarado) y quedaba centrado como bloque angosto en el medio de la pantalla. Como
`.history-tab` es `flex:none` (chips de ancho natural, no se estiran), el síntoma no era "las
pestañas se ven mal" sino "el BLOQUE ENTERO de pestañas está corrido hacia el centro" — leído
como "no están a la izquierda".

**¿Por qué Mis Grupos (mismo `.history-filters`, mismas pestañas `.history-tab`) no lo
mostraba?** Porque ahí el contenedor vive anidado dentro de `.analysis-scroll` (`flex:1`, pero
`display` normal, no `flex`) — no es ítem flex directo de `.view--history`, así que nunca sufrió
el `align-items:stretch` desactivado. Dos pantallas que comparten el mismo componente visual
pueden tener bugs de ancho distintos si la posición en el árbol del DOM difiere — la lección que
ya había dejado V03.4.5 sobre `.profile-tabs`, repetida acá en un componente hermano que hasta
ahora había quedado sin revisar.

Fix: mismo `width:100%` explícito en la regla `@media(min-width:720px){.history-filters{...}}`.
Verificado con `getBoundingClientRect()`: `.history-filters` pasa a medir 768px (antes ~361px) y
la primera pestaña ("Todos") arranca en x=18px (el padding declarado), exactamente igual que
"Actual" en Mis Grupos arranca a la misma distancia relativa de su propio contenedor. Mobile sin
cambios (la regla vive dentro del media query existente).

## 2. Gráfico de Evolución en Perfil — el fix de V03.4.5 no se aplicaba en el flujo real (bug real)

La ronda anterior corrigió correctamente EL CÁLCULO (viewBox = ancho real medido en vez de una
constante fija), pero no funcionaba en la práctica por un problema de ORDEN/TIMING que solo
aparece siguiendo el flujo real de navegación — el motivo por el que no se detectó en V03.4.5:
la verificación de esa ronda se hizo inyectando una réplica del algoritmo directamente en un
contenedor YA VISIBLE, lo cual nunca ejercitó el bug real.

`renderProfileEvolution` (donde vive la medición) es llamada por `renderProfileView`, y en los
**3 lugares del código** donde eso pasa (abrir Perfil desde el bottom nav/Home, volver a Perfil
después de "Completar acceso", volver a Perfil después de guardar en Editar Datos), el orden es
siempre:

```
renderProfileView();   // ← acá adentro se mide #evolution-chart-wrap
showView('profile');   // ← recién ACÁ deja de estar `hidden` la pantalla
```

Como la medición corre ANTES de `showView('profile')`, en ese momento `#view-profile` (o un
ancestro) todavía tiene el atributo `hidden` — y `getBoundingClientRect()` de un elemento dentro
de un ancestro oculto devuelve `width:0` siempre. El fallback que V03.4.5 agregó para ese caso
("si mide 0, usar la constante fija de siempre") es exactamente lo que TERMINABA usándose en
el 100% de los casos reales — reproduciendo el bug de escala que esa ronda creía haber resuelto.

**Fix:** dentro de `renderProfileEvolution`, si la medición inicial da 0, el pintado del gráfico
se pospone un `requestAnimationFrame` en vez de caer al fallback fijo. Para cuando ese callback
corre, `showView('profile')` ya se ejecutó (mismo stack síncrono de la llamada original) y el
layout real ya existe — sin tocar el orden en ninguno de los 3 puntos de entrada a Perfil. Si el
contenedor YA es visible en el momento del render (el único caso donde eso pasa hoy:
`refreshAfterAvatarChange`, llamado con el usuario ya parado en Perfil, sin `showView` de por
medio), se sigue pintando de una sola vez, sin esperar un frame de más.

**Verificación esta vez con datos reales, no una réplica aislada:** se migró una cuenta legacy
de prueba (localStorage sembrado con `bramulab.currentPlayerName.v1` + 7 partidos reales en
`bramulab.history.v1`, dejando que `migrateLegacyPlayerToUserIfNeeded` corriera su flujo normal
al arrancar la app) para poder ver el gráfico NUMÉRICO real (no el estado CALIBRANDO que
muestran las cuentas nuevas) y confirmar el fix contra el código real, no una copia. Resultado en
tablet: `viewBox="0 0 706 180"` (antes habría sido `0 0 320 180`), labels de eje Y/X a 9px reales
(`getComputedStyle`) con una altura real de 10.5px — 13 etiquetas visibles, ninguna superpuesta,
línea del gráfico ocupando el ancho completo de la tarjeta. En mobile el viewBox mide ~313
(prácticamente igual a la constante fija anterior, 320) — comportamiento visual sin cambios ahí.

## 3. QA

**Tablet (768px, cuenta legacy con 7 partidos reales):** Historial con "Todos 7 / Mis partidos 7
/ Observados 0" alineadas a la izquierda (antes centradas como bloque) · gráfico de Evolución
con Nivel BRAMU real (5.6, +0.2), 13 etiquetas de eje sin superposición, línea completa · Mis
Grupos sin cambios (ya estaba bien, se usó como referencia de comparación).

**Mobile (375px):** Historial y gráfico de Evolución sin regresiones — mismo viewBox de siempre
en el gráfico (~313 vs. la constante anterior de 320, visualmente idéntico).

## 4. Tests

Sin tests nuevos — layout/CSS y timing de render, no lógica pura. **Suite completa, una sola
corrida al cierre: 828/828 OK.**

## 5. Versionado

`Store.VERSION`: `BRAMUlab V03.4.6`. Quartet completo: `version.json`, `sw.js` (`CACHE_NAME` +
`CORE_ASSETS`), `index.html` (`?v=03.4.6`).

## 6. Commit / tag / deploy

Tag `BRAMUlab_V03.4.6`. Push a `main` → GitHub Pages redeploya automáticamente
(https://sebastianvilaa.github.io/BRAMUlab/bramulab/).
