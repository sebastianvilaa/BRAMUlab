# BRAMUlab V02.6
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 05/09/2026.
**Base:** BRAMUlab V02.5 (commit `a5e1aca`, tag `BRAMUlab_V02.5`).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.6_Consolidado.md` — corrección visual + regresiones de layout sobre V02.5, priorizando primero la regresión crítica de Confirmar partido/Resumen (§11) y después los ajustes visuales del resto de las secciones (1 a 10 y 12). No se agrega producto ni se reabre BRAMU Intelligence. No se encontró ninguna contradicción real que impidiera implementar el consolidado tal como está escrito.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

### Prioridad crítica — Confirmar partido / Resumen (§11-12)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | §11 — columnas de set alineadas entre las dos filas de equipo, en Confirmar partido y Resumen | **Causa real de la regresión**: `.result-card__row` era `flex` puro (nombre + sets en fila); el bloque de sets arrancaba justo después del nombre, así que su posición horizontal dependía del largo de CADA nombre — con "Equipo A" corto y "Equipo B" largo (o viceversa), las columnas de set de una fila quedaban corridas respecto de la otra. Se reemplaza por grid de 2 columnas (`minmax(0,1fr) auto`): el nombre se trunca con elipsis dentro de su columna, y los sets viven en una columna `auto` cuyo ancho es SIEMPRE el mismo entre ambas filas porque `.result-card__sets` fija cada track en 28px (`grid-auto-columns`) — ya no depende del contenido del nombre. Se actualiza también el override de Confirmar partido (`.court-saved-result-card`, sets a 32px) para que la celda y el track de grilla crezcan juntos | `styles.css:.result-card__row/__sets/__set`, `.court-saved-result-card` | Manual + captura (402/360px, nombres muy distintos entre equipos) |
| 2 | §12 — Sets ganados/Games ganados con altura de fila consistente y números centrados, sin importar la cantidad de dígitos | Columnas laterales pasan de `auto` (ancho variable según dígitos) a 44px fijos; se agrega `min-height:44px` a la fila y `line-height:1` a los números | `styles.css:.summary-stat-row*` | Manual + captura |

### Sistema cromático y texto (§1)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 3 | §1.1 — azul BRAMU `#19BAFF` → `#199FFF`, arrastrando toda la familia (deep, focus, hover, glows, shadows, bordes, hardcodes RGB) | `--accent-cyan`/`--team-b` actualizados en `:root`; `--team-b-deep` `#0A87BD` → `#0D6FCC` (referencia del consolidado); **sweep** de los 11 hardcodes RGB equivalentes (`25,186,255` → `25,159,255`) que quedaron de V02.5 en glows/shadows/bordes/hovers — el cambio de token solo no alcanzaba, igual que el hallazgo de V02.5 con el verde | `styles.css:root` + 11 reglas puntuales | Manual + captura (selector de rival, cancha, Confirmar/Resumen) |
| 4 | §1.2 — texto principal `#F5F7FA` → `#F8FAFC`, cambio sutil, sin tocar `--text-dim`/`--text-faint` | Un solo token actualizado en `:root` | `styles.css:root` | Manual |

### Ajustes visuales (§2-10)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 5 | §2 — Home: oscurecer la zona superior del degradé sin volver a un fondo plano | Tope del degradé pasa de `var(--surface-2)` (`#0D1A2A`, muy claro) a `#08121E`; punto medio adelantado 55%→45% para que la zona oscura gane terreno | `styles.css:#view-player-home` | Manual + captura |
| 6 | §3.1 — Actividad: glow leve en el segmento verde activo | `box-shadow: 0 0 8px rgba(149,255,25,.16)` en `.activity-bar__win` | `styles.css:.activity-bar__win` | Manual + captura |
| 7 | §3.2 — Efectividad: drop-shadow leve en el stroke verde del aro | `filter: drop-shadow(0 0 4px rgba(149,255,25,.20))` en `.effectiveness-donut__fill` | `styles.css:.effectiveness-donut__fill` | Manual + captura |
| 8 | §3.3 — Último partido: presencia sin engrosar el borde a 2px | Se mantiene `border` 1px; se agrega `box-shadow: 0 0 16px rgba(149,255,25,.10)` a la tarjeta | `styles.css:.player-home-lastmatch` | Manual + captura |
| 9 | §4 — tarjeta de insight superior con borde completo azul + glow + hasta 2 líneas | Borde lateral de 3px reemplazado por borde completo `rgba(25,159,255,.70)` + `box-shadow` leve; el texto ya soportaba varias líneas (`white-space:normal`, sin cambios); solo gana algo de padding. Sin carrusel ni tarjetas nuevas (fuera de alcance, respetado) | `styles.css:.player-home-hitos__chip` | Manual + inyección de contenido para verificar el estilo (no se fuerza la condición real de negocio que dispara el hito) |
| 10 | §5 — perfil: menos aire muerto entre la barra de Nivel y "N partidos en tu historia" | **Causa real**: `.player-card` es `flex-wrap` con `gap:14px`, que ya separaba esa fila de la barra; `.player-card__count` sumaba además su propio `margin-top:6px` (20px totales de por medio). Se retira el margin-top redundante — el gap del contenedor pasa a ser la única fuente de separación. Barra sin cambios de tamaño | `styles.css:.player-card__count` | Manual + captura |
| 11 | §6 — "Tu momento" con más peso/contraste, por debajo del título en jerarquía | `font-weight:500` + `color: rgba(248,250,252,.78)` (antes `--paper-dim`, más lavado) | `styles.css:.pastilla-momento__text` | Manual + captura |
| 12 | §7 — Efectividad: "22 de 32" → "22 ganados de 32 jugados", mismo cálculo | Un cambio de copy en el `textContent`, sin tocar `PH.computeEffectiveness30d` | `app.js:renderPlayerEffectiveness` | Manual + captura; tests de `computeEffectiveness30d` (no dependen del copy) siguen verdes |
| 13 | §8 — botón "Agregar como jugador sin cuenta": de acción rellena a outlined/secundaria, color contextual por equipo | Fondo pasa de `rgba(color,0.12)` a `var(--court-surface-2)` (el mismo neutro que usan las demás `.sheet-option`) — se retira el relleno de color, se mantienen borde y texto en el color contextual del equipo (verde Compañero / azul Rival). Lógica de selección/búsqueda sin cambios | `styles.css:#load-player-sheet-add.sheet-option--primary` | Manual + captura |
| 14 | §9 — sheet Fecha/Hora/Lugar: tipografía un escalón más chica, más aire vertical, sin achicar áreas táctiles | Labels 11px→10px, valores de campo 16px→14px (scoped a `#manual-meta-sheet`, nunca al `.field__input` global); alto explícito de 38px de los inputs sin cambios; se agrega aire entre la fila Fecha/Hora y Lugar, y antes de "Usar mi ubicación"; padding del sheet levemente mayor | `styles.css:#manual-meta-sheet *` | Manual + captura (Fecha/Hora siguen perfectamente alineadas) |
| 15 | §10 — dash y dot del marcador de Último partido: geométricos, no glifo tipográfico, mismo eje óptico que los números | Ver §2 de este informe (implementación completa) | `app.js:buildLastMatchScoreHTML/buildLastMatchScoreLabel`; `styles.css:.lastmatch-score*` | Manual + captura (402/360px) |

### Lo que se mantiene / fuera de alcance (§13-14)

| # | Verificado | Prueba |
|---|---|---|
| 16 | Inter, verde BRAMU `#95FF19`, lógica de Actividad, selector alto (~72%), equipos A/B verde/azul, flow de carga manual, fecha/hora funcional, notas privadas en Resumen, sheet Registrar partido (~35%) — ninguno tocado salvo lo explícitamente autorizado | Recorrido de §5; sin diffs fuera de `bramulab/{app.js,store.js,styles.css,sw.js,version.json}` |
| 17 | BRAMU Intelligence, backend/BD, perfiles sociales, ranking real, nuevas funciones de historial, reglas deportivas — nada de esto se tocó | `engine.js`/`stats.js` sin diffs; ver §9 |

---

## 2. Implementación final del score dash/dot (§10)

**Problema:** el guion y el punto separadores del marcador grande de "Último partido" eran texto (`–`/`·`) más chico que los números vecinos; por default el navegador alinea texto de distinto tamaño al **baseline** de la línea, no al centro óptico de un número mucho más grande. V02.5 ya había compensado esto con `vertical-align:middle`, pero seguía siendo una aproximación tipográfica, nunca perfecta en todos los tamaños de pantalla del `clamp()`.

**Solución implementada:** se dejó de depender del glifo. `buildLastMatchScoreHTML` (app.js) ahora arma cada número en su propio `<span class="lastmatch-score__num">` y el guion/punto como `<span>` vacíos (`.lastmatch-score__dash`/`__dot`, `aria-hidden="true"`) que son barras/puntos geométricos reales (`background:currentColor`, sin contenido de texto). El contenedor (`.lastmatch-score`) pasa a `inline-flex` con `align-items:center`, así el centrado es de **layout** (todos los hijos comparten la misma línea central del flex), no de tipografía. El tamaño del set (`clamp(36px, 11.3vw, 44px)`) se movió al contenedor para que tanto el dash (hijo de `.lastmatch-score__set`) como el dot (hijo directo de `.lastmatch-score`, entre sets) midan sus `width`/`height` en `em` relativos al MISMO tamaño heredado, y escalen exactamente junto con los números en cualquier ancho de pantalla.

**Accesibilidad:** como los separadores ya no llevan un carácter que un lector de pantalla pudiera anunciar, se agregó `buildLastMatchScoreLabel` (texto plano equivalente, ej. `"6 a 3 · 4 a 6 · 7 a 6, tie break 10 a 8"`) como `aria-label` del contenedor `.player-home-lastmatch__score`.

**Verificación:** confirmado visualmente en 402px y 360px con datos sintéticos — dash y dot quedan perfectamente centrados en el mismo eje que los números, sin ningún hack de `vertical-align` ni transform específico de navegador.

---

## 3. Causa exacta de la regresión Confirmar partido / Resumen (§11)

V02.5 armó `.result-card__row` como una fila `flex` (`justify-content:flex-start`) con el nombre primero (`flex:0 1 auto; max-width:62%`) y el bloque de sets después (`flex:none`), separados por un `gap` fijo — un cambio pensado para pegar el resultado al nombre en vez de empujarlo al borde derecho (bug de V02.4 corregido en su momento).

El problema no anticipado: en flex, el bloque de sets arranca **justo después** de donde termina la caja del nombre. Cuando el nombre del Equipo A es corto (por ejemplo "Yo") y el del Equipo B es largo ("Rival Uno / Rival Dos Con Nombre Bastante Largo"), cada fila tiene un ancho de nombre distinto — así que el bloque de sets de una fila arranca en una posición X y el de la otra en una posición X distinta. Resultado: las columnas de set (Set 1, Set 2, Set 3) NO quedan alineadas verticalmente entre ambas filas, exactamente la regresión reportada.

**Fix:** grid de 2 columnas por fila (`grid-template-columns: minmax(0,1fr) auto`). La columna de sets es `auto`, pero su ancho ya no depende del nombre — depende únicamente del contenido de `.result-card__sets`, que ahora fija cada set en un track de **ancho fijo** (`grid-auto-columns: 28px`, 32px en Confirmar partido). Como ese ancho es idéntico en ambas filas (mismo número de sets, mismo ancho fijo por set), la columna `auto` mide lo mismo en las dos filas independientemente del largo del nombre — y por lo tanto arranca en la misma posición X en ambas. El nombre, en la columna `minmax(0,1fr)`, se trunca con elipsis si no entra.

---

## 4. Tests automáticos (§15.1)

**565/565 tests OK — todo verde** (`tests.html`), sin cambios respecto de V02.5. Esta ronda es mayormente CSS/copy — el consolidado explícitamente pide no agregar tests por cambios puramente visuales (§15.1), y así se hizo. La única lógica pura tocada (`buildLastMatchScoreHTML`/`buildLastMatchScoreLabel`, `renderPlayerEffectiveness`) genera HTML/copy a partir de datos que ya vienen calculados por funciones puras existentes (`PH.computeEffectiveness30d`, etc.) — esas funciones no cambiaron y sus tests (`E4`, `V02.3-EFE`, ...) siguen verdes sin modificación.

---

## 5. Validación visual (§15.2)

Ejecutada en vivo contra `.claude/dev-server.py`, con datos sintéticos sembrados en `localStorage` (nombres de equipo de longitud muy distinta entre A y B, a propósito, para forzar el caso que rompía en V02.5), en 402px y 360px.

1. **Home completo** — degradé con tope más oscuro, tarjeta de insight con borde azul completo + glow, Nivel BRAMU con menos aire muerto bajo la barra, "Tu momento" con más contraste, Actividad/Efectividad con glow leve, Último partido con glow en vez de borde grueso.
2. **Último partido — marcador** — dash y dot geométricos, perfectamente centrados respecto de los números, en un partido de 3 sets con tie break.
3. **Selector de jugador y "Agregar sin cuenta"** — sheet igual que V02.5 (72%, sin cambios ahí), botón de alta manual ahora outlined (fondo neutro, borde y texto azules en contexto Rival).
4. **Sheet Fecha/Hora/Lugar** — tipografía un escalón más chica, más aire entre bloques, Fecha y Hora siguen perfectamente alineadas (sin reabrir el bug de V02.5).
5. **Confirmar partido** — con nombres de equipo de longitud muy distinta ("Sebastián / Gonzalo Martínez De La Fuente" vs. "Rival Uno / Rival Dos Con Nombre..."): columnas de set (6/6 vs. 3/4) perfectamente alineadas entre ambas filas, en 402px y 360px.
6. **Resumen** — mismo caso de nombres asimétricos: columnas de set alineadas, filas SETS GANADOS/GAMES GANADOS con altura y centrado consistentes (2/1, 17/15).

**Regresión:** recorrido completo sin errores de consola de aplicación — selección de 4 jugadores → carga de 2 sets → Confirmar partido → Resumen. Los datos sintéticos usados para forzar el caso límite se removieron de `localStorage` al finalizar; no queda ningún partido de prueba en el historial.

---

## 6. Criterios de aceptación (§16) — verificados

Todos los ítems del checklist del consolidado (azul `#199FFF`, texto `#F8FAFC`, degradé del Home con contraste recuperado, glow leve en Actividad/Efectividad/Último partido, tarjeta de insight con borde completo + glow, perfil sin aire muerto, "Tu momento" más legible, copy de Efectividad actualizado, botón de alta manual como acción secundaria, sheet Fecha/Hora con más aire sin tipografía sobredimensionada, dash/dot geométricos centrados, Confirmar partido y Resumen con grilla estable y columnas alineadas, Sets/Games ganados con estructura broadcast consistente, BRAMU Intelligence intacto, sin regresiones funcionales) se verificaron en el recorrido de §5 y las mediciones de la matriz de §1.

---

## 7. PWA, versión y publicación (§17)

- `Store.VERSION`: `"BRAMUlab V02.5"` → **`"BRAMUlab V02.6"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-5` → **`bramulab-v02-6`**.
- **Commit de implementación (código):** ver §8 (hash registrado en el commit siguiente, un commit no puede citar su propio hash).
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 8. Hash exacto y tag (registro final)

- Commit de implementación (código): PENDIENTE_HASH_CODIGO.
- Commit de este informe (matriz, tests, recorrido) y del README actualizado: PENDIENTE_HASH_INFORME.
- Tag `BRAMUlab_V02.6` apunta al commit inmediatamente posterior a este, que registra ambos hashes de arriba — el código funcional completo de V02.6 es íntegramente el del primer commit; ese tercer commit no modifica ningún archivo de `bramulab/`.

---

## 9. Qué no se tocó (confirmado, §14 del consolidado)

BRAMU Intelligence / motor de análisis (sin diffs en `stats.js`), reglas deportivas (`engine.js` sin cambios), backend/base de datos (no existe, sin cambios), perfiles sociales, ranking real, nuevas funciones de Historial, esquema de `localStorage` (sin migraciones, sin `localStorage.clear()`), sheet Registrar partido (`.bottom-sheet--compact`, ~35%, sin tocar), selector de jugador (estructura/lógica de V02.5 intacta — solo cambió el botón de alta manual), flow de carga manual y fecha/hora funcional (sin cambios de lógica, solo de tipografía/espaciado). No se creó una carpeta `V02.6` — este informe vive en `Versiones/BRAMUlab_V02/`, junto al resto de la subversión.
