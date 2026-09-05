# BRAMUlab V02.7
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 05/09/2026.
**Base:** BRAMUlab V02.6 (commit `8518d19`, tag `BRAMUlab_V02.6`).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.7_Consolidado.md` — afinación visual, unificación de fondos entre pantallas y dinámica de entrada al Home sobre V02.6, sin reabrir decisiones cerradas ni tocar BRAMU Intelligence. No se encontró ninguna contradicción real que impidiera implementar el consolidado tal como está escrito.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

### Fondo global (§1)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | El degradé del Home se mantiene exactamente igual a V02.6 | `#view-player-home` no se tocó — sigue con su propio degradé (`#08121E`/`--bg`/`--bg-deep`), que ahora referencia el nuevo token `--bg-gradient-app` solo conceptualmente (valor propio, no compartido) | `styles.css:#view-player-home` | Manual + computed style (`backgroundImage` idéntico al de V02.6) |
| 2 | Historial/Ranking/Perfil/Carga manual/Confirmar partido/Resumen comparten la misma familia de fondo, un escalón menos intensa, sin fondo plano/negro | Token nuevo `--bg-gradient-app` (mismos 3 stops que el Home pero con `--surface-1`, ya parte de la escala de superficies, en vez del tono a medida del Home) aplicado a `.view--analysis, .view--history` (cubre Resumen + Historial/Ranking/Compañeros-Rivales/Perfil, todas comparten esas clases) y a `.view--court` (Carga manual + Confirmar partido, reemplazando su `background: var(--court-bg)` plano) | `styles.css:root`, `.view--analysis, .view--history`, `.view--court` | Manual + computed style de las 6 pantallas (ver §5) |

### Limpieza de títulos del Home (§2)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 3 | Eliminar "ÚLTIMOS 30 DÍAS" y "TU HISTORIAL", sin huecos artificiales | Se quitan los dos `<div class="player-home-group-label">` de `index.html` y la regla CSS asociada (quedaba sin ningún otro uso); el espaciado entre bloques pasa a depender solo de `margin-bottom:12px` de `.pastilla`/`.player-home-metrics-row .pastilla` (ya existente) — mismo aire que entre cualquier otro par de tarjetas del Home, sin hueco extra ni faltante | `index.html`, `styles.css` (regla `.player-home-group-label` eliminada) | Manual + captura |

### Actividad — 4 semanas calendario (§3)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 4 | Semana lunes-domingo; semana actual siempre a la derecha; semanas viejas a la izquierda | Función pura nueva `computeActivityWeeks4(matches, playerName, nowDate)`, apoyada en `startOfWeekMonday(date)` (medianoche LOCAL del lunes de la semana de `date` — mismo criterio de fecha local que el resto de la app desde V02.1/V02.5). `buckets[3]` es siempre la semana que contiene `nowDate`; `buckets[0]` la de hace 3 semanas | `player-home.js:startOfWeekMonday`, `computeActivityWeeks4` | 12 tests nuevos `V02.7-ACT` (ver §2 de este informe) |
| 5 | Cada lunes entra una semana nueva por la derecha y sale la más vieja por la izquierda | La ventana de 4 semanas se recalcula desde `nowDate` en cada llamada (sin estado persistente) — al cruzar la medianoche de domingo a lunes, `nowDate` cae en una semana-lunes nueva y las 4 conocidas se desplazan solas; no hay lógica de "descarte" explícita, la semana vieja simplemente deja de tener lugar entre las 4 | `player-home.js:computeActivityWeeks4` | Test `V02.7-ACT · al cruzar a lunes...` (domingo 23:00 vs. lunes 00:05, mismos partidos) |
| 6 | Copy: "X partidos en las últimas 4 semanas" | `renderPlayerActivity` actualizado | `app.js:renderPlayerActivity` | Manual + captura |
| 7 | Ganados abajo / derrotas arriba sin cambios | `computeActivityBarSegments` no se tocó (sigue recibiendo `count/wins/losses`, ahora por semana en vez de por bloque de ~7.5 días) | `player-home.js:computeActivityBarSegments` (sin cambios) | Tests preexistentes sin tocar, siguen verdes |

### Efectividad — histórica total (§4)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 8 | Efectividad es un balance acumulado de TODO el historial, no de 30 días | **Hallazgo real**: `computeEffectiveness30d` (V02.1-V02.6) SÍ recortaba a los últimos 30 días — contradecía la intención ya explícita en el copy ("balance de tu historial") y en la propia decisión del consolidado ("mantener… si ya es ese comportamiento"). Se reemplaza por `computeEffectivenessTotal(matches, playerName)`, sin ventana de tiempo — ver §3 de este informe | `player-home.js:computeEffectivenessTotal` (reemplaza a `computeEffectiveness30d`) | Tests `V02.7-EFE` + `V02.3-EFE` adaptados |
| 9 | Copy explícito ("X ganados de Y jugados") sin cambios | Sin cambios en `renderPlayerEffectiveness` más allá del cálculo | `app.js:renderPlayerEffectiveness` | Manual + captura |
| 10 | El drill-through de Efectividad (Home → Historial) sigue mostrando EXACTAMENTE los partidos que originaron el %, ahora sin límite de fecha | **Consecuencia necesaria del cambio anterior, no prevista explícitamente por el consolidado pero indispensable para no dejar una inconsistencia**: el filtro contextual `type:'last30'` (ligado 1:1 a Efectividad, sin otro uso) pasa a `type:'effectiveness'`, y su fuente pasa de `filterMatchesWithin30d` a la función pura nueva `filterMatchesWithDefinedResult(matches, playerName)` — mismo principio de siempre ("Racha/Efectividad abren Historial recortado al conjunto EXACTO que originó el número tocado", comentario ya existente en `initPlayerHomeMetricsNav`) | `player-home.js:filterMatchesWithDefinedResult`, `app.js` (handler del click + `renderHistory`) | Test `V02.1-M` adaptado + manual (ver §5) |

### Glow de Efectividad (§5)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 11 | Glow visible pero sutil, menos intenso que el `+` central | `filter: drop-shadow(...)` de `.effectiveness-donut__fill` sube de `4px/.20` (V02.6, casi imperceptible) a `6px/.45` — claramente visible sobre un trazo fino de 3px, todavía muy por debajo del `+` (`box-shadow 0 6px 16px rgba(...,0.4)` sobre un relleno sólido de 52px) | `styles.css:.effectiveness-donut__fill` | Manual + captura (ver §5) |

### Microanimaciones de entrada (§6)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 12 | Nivel BRAMU crece horizontalmente desde 0 hasta el % real | `transition: width` en `.player-card__bar-fill` + `renderPlayerCard` fuerza `0% → reflow → % final` solo si `shouldAnimate` | `styles.css`, `app.js:renderPlayerCard` | Manual (ver §5); valor final idéntico al de siempre, sin tests nuevos (no hay lógica pura nueva, `levelProgressPct` sin cambios) |
| 13 | Actividad crece verticalmente, con stagger opcional izquierda→derecha | `transition: height` en `.activity-bar` + `transition-delay` inline por índice (0/60/120/180ms) + mismo patrón `0% → reflow → alto final` | `styles.css`, `app.js:renderPlayerActivity` | Manual (ver §5) |
| 14 | Efectividad completa el arco hasta el % final, número central estable (sin "contar") | Reutiliza la `transition: stroke-dasharray` ya existente desde antes de V02.6; `renderPlayerEffectiveness` fuerza `dasharray "0" → reflow → dasharray final` solo si `shouldAnimate`; el texto del número se asigna directo, nunca anima | `styles.css` (sin cambios en la transición), `app.js:renderPlayerEffectiveness` | Manual (ver §5) |
| 15 | No repetir de forma agresiva en cada micro-navegación | **Decisión de implementación** (el consolidado ofrecía elegir entre "limitar a la primera entrada" o "duración muy corta al reingresar"): se eligió un flag booleano de sesión (`homeEnteredThisSession`, declarado junto a `currentPlayerName`) — más simple de razonar y más predecible que repetir una animación corta en cada regreso. Se calcula `shouldAnimate` una sola vez por llamada a `renderPlayerHome()` y se propaga a los 3 renders animados | `app.js:renderPlayerHome` | Manual: se verificó que la 1ª entrada anima y que Home→Resumen→Home no repite el "crecer desde 0" |
| 16 | `prefers-reduced-motion`: sin crecimiento, sin pulsos, estado final directo | Doble capa: (a) CSS — `--motion-base`/`--motion-fast` ya colapsan a `1ms` bajo `prefers-reduced-motion` (mecanismo preexistente de la app, reutilizado sin cambios) para las transiciones de `width`/`height`; (b) **JS explícito** — `shouldAnimate` también chequea `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, necesario porque el stagger de Actividad usa `transition-delay` inline (no depende de `--motion-base`) y sin este chequeo igual se vería un desfasaje entre barras | `app.js:renderPlayerHome` (chequeo JS), `styles.css:root` (colapso ya existente) | Manual: no hay forma de emular `prefers-reduced-motion` con las herramientas de este entorno de sesión — ver §5, limitación documentada |

### Último partido — pulso sutil (§7)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 17 | Pulso extremadamente sutil de intensidad del glow, sin blink, sin cambiar borde/tamaño | `@keyframes lastMatchGlowPulse` (3.6s, ease-in-out, infinito) varía SOLO `box-shadow` entre el valor estático de V02.6 (`0 0 16px rgba(...,.10)`, el extremo bajo del pulso — nunca queda "menos encendida" que antes en reposo) y un pico apenas mayor (`0 0 22px rgba(...,.20)`); borde sin animar | `styles.css:.player-home-lastmatch`, `@keyframes lastMatchGlowPulse` | Manual + captura (difícil de apreciar en una imagen estática por diseño — "debe poder pasar desapercibido") |
| 18 | Desactivar con `prefers-reduced-motion` | `@media (prefers-reduced-motion: reduce){ .player-home-lastmatch{ animation:none; } }` | `styles.css` | — |

### Hito / Insight (§8)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 19 | Texto principal en azul BRAMU `#199FFF` | `.player-home-hitos__chip{ color: var(--accent-cyan); }` (antes `var(--paper)`); borde/glow/fondo/2 líneas sin cambios; sin carrusel ni tarjetas nuevas | `styles.css:.player-home-hitos__chip` | Manual + captura |

---

## 2. Función pura para los buckets semanales y criterio lunes-domingo

`startOfWeekMonday(date)` (player-home.js) devuelve la medianoche LOCAL del lunes de la semana que contiene `date`, usando únicamente getters locales (`getFullYear/getMonth/getDate/getDay`) — mismo criterio de "fecha siempre local, nunca UTC" que el resto de la app desde el fix de V02.1/V02.5. `getDay()` en JS devuelve `0` para domingo; un domingo retrocede 6 días para llegar a SU lunes, cualquier otro día retrocede `day - 1` días.

`computeActivityWeeks4(matches, playerName, nowDate)` calcula `currentWeekStart = startOfWeekMonday(nowDate)` y arma las 4 semanas conocidas como `currentWeekStart - {3,2,1,0} semanas`, en ESE orden (índice 0 = hace 3 semanas, índice 3 = la actual). Cada partido se ubica en el bucket cuya semana-lunes coincide EXACTAMENTE (por timestamp) con la suya — nunca por rango de días, así una semana que cruza de mes o de año sigue siendo una sola semana.

**Bug real encontrado y corregido durante el desarrollo** (antes de la validación final, nunca llegó a publicarse): la primera versión de `computeActivityWeeks4` armaba el array de semanas con `[3,2,1,0].map(...)` (ya en orden correcto, más-antigua→más-reciente, porque `.map` conserva el orden del array de entrada) y le aplicaba un `.reverse()` de más — el resultado quedaba invertido: la semana ACTUAL caía en el índice 0 (izquierda) y la más vieja en el índice 3 (derecha), exactamente al revés de lo que pide el consolidado. Los tests nuevos (`V02.7-ACT`) lo detectaron de inmediato (3 fallos) antes de cualquier validación visual; se quitó el `.reverse()` sobrante y los 571 tests quedaron verdes.

---

## 3. Efectividad: de ventana de 30 días a historial total

`computeEffectiveness30d` (V02.1-V02.6) SÍ excluía partidos con más de 30 días — confirmado leyendo su código (`if (age < 0 || age > THIRTY_DAYS_MS) return;`) y por los tests que la ejercitaban (`V02.3-EFE · un partido de 31 días no modifica el porcentaje`, ahora eliminado por obsoleto). El consolidado pide "mantener Efectividad como métrica histórica total… si ya es ese comportamiento" — no lo era, así que el cambio real necesario fue hacerla total, autorizado explícitamente por el propio consolidado en su lista de "lo que no debe cambiar salvo…": *"lógica histórica de Efectividad salvo confirmar que sea total"*.

Se reemplaza por `computeEffectivenessTotal(matches, playerName)`: cuenta victorias/derrotas de TODO el array recibido, sin filtrar por fecha — más simple que su antecesora (ya no necesita `nowDate` ni comparar edades). Se agregó `filterMatchesWithDefinedResult(matches, playerName)` como reemplazo de `filterMatchesWithin30d` para el drill-through del Home (ver matriz, ítem 10) — la única otra consumidora de esa función, ahora eliminada por no tener ya ningún uso.

---

## 4. Tests automáticos (§11.1/§11.2)

**571/571 tests OK — todo verde** (`tests.html`), 565 preexistentes + cambios netos de esta ronda:

- **12 tests nuevos `V02.7-ACT`** (Actividad, semanas calendario): `startOfWeekMonday` empieza lunes/termina domingo (3 casos: jueves→su lunes, domingo→el mismo lunes que su jueves, lunes siguiente→lunes nuevo); semana actual siempre en el bucket derecho; un cambio de MES dentro de la misma semana no rompe la agrupación (31-ago/2-sep); un cambio de AÑO dentro de la misma semana tampoco (31-dic-2026/1-ene-2027); la transición domingo→lunes corre las 4 barras (la más vieja sale, m2/m3/m4 se corren, la nueva entra a la derecha); sin fecha válida o fuera de la ventana no cuenta; orden de carga no importa; un observado no suma actividad propia.
- **4 tests nuevos `V02.7-EFE`** (Efectividad total): cuenta partidos de 400/900 días (fuera de cualquier ventana anterior); un partido sin ganador nunca cuenta; historial vacío nunca inventa porcentaje; `filterMatchesWithDefinedResult` expone el mismo conjunto que cuenta el porcentaje.
- **Adaptados** (misma propiedad, función/fecha nueva): `V02.1-M` (drill-through ya no excluye por fecha), `V02.3-ACT` (2 de 4 sub-tests: orden de carga y observados, re-verificados sobre `computeActivityWeeks4`; el resto quedó documentado como superseded, ver comentario en el propio archivo), `V02.3-EFE` (3 casos de porcentaje/perspectiva/observado, sin cambios de fondo — son partidos recientes, cuentan igual con o sin ventana de tiempo).
- **Eliminado por incompatible con el nuevo comportamiento**: `V02.3-EFE · un partido de 31 días no modifica el porcentaje` — es exactamente lo opuesto de lo que ahora debe pasar (ver §3); su reemplazo conceptual son los nuevos `V02.7-EFE` con partidos de 400/900 días.

Todos los tests que dependían de fechas usan anclas construidas con el constructor `Date` por COMPONENTES locales (`new Date(y,m,d,h,mi)`) en vez de strings ISO/UTC — mismo criterio que los tests `V02.5-FECHA`, para que el resultado sea determinístico sin importar en qué huso horario corra el navegador que ejecuta la batería.

---

## 5. Validación visual (§11.3/§11.4)

Ejecutada en vivo contra `.claude/dev-server.py`, con historial sintético de 8 partidos sembrado en `localStorage`, en 402px y 360px.

1. **Home completo** — sin "ÚLTIMOS 30 DÍAS" ni "TU HISTORIAL"; hito superior con texto azul BRAMU; Actividad con copy "X partidos en las últimas 4 semanas"; Efectividad con glow claramente más visible que V02.6; degradé del Home sin cambios.
2. **Confirmado por computed style** (`getComputedStyle(...).backgroundImage`) que Historial, Ranking, Perfil, Carga manual y Confirmar partido/Resumen comparten EXACTAMENTE `linear-gradient(rgb(9,19,31) 0%, rgb(5,10,18) 40%, rgb(3,7,13) 100%)`, y que el Home mantiene el suyo propio (`rgb(8,18,30)`/45%) — nunca fondo plano negro en ninguna de las 6 pantallas.
3. **Efectividad → Historial**: el drill-through ahora dice "Filtrando: Efectividad" y muestra los 8 partidos del historial sintético (antes solo mostraba los de los últimos 30 días) — confirma que ya no hay ventana de tiempo.
4. **Resumen**: la grilla estable de Confirmar partido/Resumen de V02.6 sigue intacta (columnas de set alineadas), notas privadas y BRAMU Intelligence sin cambios.
5. **360px**: hito en 2 líneas, marcador de Último partido, navegación inferior — sin overflow ni recortes nuevos.

**Limitación de este entorno de sesión (documentada, no es un defecto del código):** las herramientas de navegador disponibles no permiten emular `prefers-reduced-motion: reduce` (sí permiten emular `color-scheme`), así que el comportamiento bajo esa preferencia se verificó por lectura de código/CSS (doble capa: colapso de `--motion-base` a 1ms + chequeo explícito en JS, ver matriz ítem 16) pero no pudo confirmarse con una captura en vivo.

**Regresión:** sin errores de consola nuevos — el único error observado (`Service Worker: An unknown error occurred when fetching the script`) es la misma limitación puntual de este entorno de sesión ya documentada en informes anteriores (V02.3 en adelante), no del código.

---

## 6. Criterios de aceptación (§10) — verificados

Fondo, Home, Actividad, Efectividad, Animaciones, Último partido e Hito: todos los ítems del checklist del consolidado se verificaron en el recorrido de §5, las mediciones de computed style, y la batería de tests de §4. No se detectó ningún criterio incumplido.

---

## 7. PWA, versión y publicación (§12)

- `Store.VERSION`: `"BRAMUlab V02.6"` → **`"BRAMUlab V02.7"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-6` → **`bramulab-v02-7`**.
- **Commit de implementación (código):** ver §8 (hash registrado en el commit siguiente, un commit no puede citar su propio hash).
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 8. Hash exacto y tag (registro final)

- Commit de implementación (código): `f7896315dc264118c4f35e9c24e893d2b579deb6`.
- Commit de este informe (matriz, tests, recorrido) y del README actualizado: `9da724a3de1896d34060f1732d6df2dcdd3f5d0e`.
- Tag `BRAMUlab_V02.7` apunta al commit inmediatamente posterior a este, que registra ambos hashes de arriba — el código funcional completo de V02.7 es íntegramente el del primer commit; ese tercer commit no modifica ningún archivo de `bramulab/`.

---

## 9. Qué no se tocó (confirmado, §9 del consolidado)

BRAMU Intelligence / motor de análisis (sin diffs en `stats.js`), reglas deportivas (`engine.js` sin cambios), verde BRAMU `#95FF19` y azul BRAMU `#199FFF` (tokens sin cambios de valor), texto principal `#F8FAFC` (sin cambios), Inter, layout corregido de Confirmar partido/Resumen de V02.6 (grilla de sets intacta), separadores geométricos dash/dot del score de Último partido (sin cambios), selector de jugador, flujo de carga manual, fecha/hora/lugar, notas privadas, reglas deportivas, ranking real, backend/base de datos, perfiles sociales, cálculo de Nivel BRAMU (`levelProgressPct`/`computeLevelEvolution` sin cambios — solo se le agregó la animación visual de la barra). No se creó una carpeta `V02.7` — este informe vive en `Versiones/BRAMUlab_V02/`, junto al resto de la subversión.
