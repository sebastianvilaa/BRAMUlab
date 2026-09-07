# BRAMUlab V02.8
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.7 (commit `f789631`, tag `BRAMUlab_V02.7`).
**Documentos de referencia:** `BRAMUlab_V02.8_Consolidado.md` y `BRAMUlab_V02.8_Auditoria_Visual_CSS.md` (ambos en esta misma carpeta).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.8_Consolidado.md` — corrección de las inconsistencias visuales verificadas por la auditoría previa, mejora del dinamismo del Home (microanimaciones en cada entrada, glow de Efectividad sin caja, pulso de Último partido) y limpieza de CSS muerto/duplicado de bajo riesgo, sin reabrir decisiones cerradas ni tocar BRAMU Intelligence. **No se encontró ninguna contradicción real que impidiera implementar el consolidado tal como está escrito** — la única tensión aparente (§6/§10 tocan puntualmente componentes que viven dentro de "Carga manual"/"Confirmar partido", listados en §14 como "mantener sin cambios") se resuelve sola: son excepciones explícitas y nombradas del propio consolidado sobre pantallas que, en conjunto, no cambian ni de comportamiento ni de aspecto salvo en el punto puntual pedido (ver nota en la matriz, ítems 6 y 15-17).

---

## 1. Matriz requisito → implementación → archivo/función → prueba

### Home — microanimaciones en cada entrada (§1)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | Las animaciones de Nivel/Actividad/Efectividad corren CADA VEZ que se entra o se vuelve al Home, no solo la primera vez de la sesión | Se retira el flag `homeEnteredThisSession` (V02.7). `shouldAnimate` pasa a ser `!prefersReducedMotion`, calculado en cada llamada a `renderPlayerHome()` | `app.js:renderPlayerHome` | Test empírico con `MutationObserver({attributeOldValue:true})` sobre `#player-home-level-bar`/`#player-home-effectiveness-ring` — confirma la secuencia `valor final → 0 → valor final` en una SEGUNDA entrada (Home→Ranking→Home), ver §4 |
| 2 | Todos los caminos reales de "entrar/volver al Home" deben re-renderizar (no solo des-ocultar la vista vieja) | `renderPlayerHome()` ya se invocaba en todo call-site que muestra la vista, salvo dos: los botones "Volver" de Ranking y de Perfil llamaban `showView('player-home')` directo, sin re-render — se cambian a `openPlayerHome()` (misma función que usa el tab "Inicio" de la barra inferior) | `app.js:initRankingScreen`, `app.js:initProfileScreen` | Manual: Home→Ranking→Volver y Home→Perfil→Volver, confirmado que el Nivel/Efectividad vuelven a animar |
| 3 | Nivel BRAMU: barra 0→valor real, ~0.5–0.6s, sin rebote | Token nuevo `--home-anim-level: 550ms` (dentro del rango pedido), mismo mecanismo `0% → reflow → % final` de V02.7, misma curva `--motion-ease` (`cubic-bezier(0.32,0.72,0,1)`, ya sin rebote) | `styles.css:root`, `.player-card__bar-fill` | Manual + verificación empírica (ítem 1) |
| 4 | Actividad: 4 barras 0→altura real, stagger izquierda→derecha ~60–80ms, duración ~0.45–0.6s | Token nuevo `--home-anim-activity: 500ms`; el stagger por índice (`transition-delay: i*60ms`, ya existente desde V02.7) queda dentro del rango pedido sin cambios | `styles.css:.activity-bar`, `app.js:renderPlayerActivity` | Manual (mecanismo sin cambios de lógica, solo duración vía token) |
| 5 | Efectividad: arco 0→% real, número central directo (sin contar), ~0.7–0.8s | Token nuevo `--home-anim-effectiveness: 750ms`; el número (`textContent`) se sigue asignando directo, nunca anima (sin cambios) | `styles.css:.effectiveness-donut__fill/__glow`, `app.js:renderPlayerEffectiveness` | Manual + verificación empírica (ítem 1) |
| 6 | `prefers-reduced-motion`: estado final directo, sin pulsos | Los 3 tokens nuevos se suman al colapso existente a `1ms` bajo `prefers-reduced-motion` (mismo mecanismo que `--motion-base`/`--motion-fast`); el chequeo explícito en JS (`window.matchMedia`, ya existente desde V02.7) sigue cubriendo el stagger inline de Actividad | `styles.css:root` (media query) | Manual: no hay forma de emular `prefers-reduced-motion` con las herramientas de este entorno de sesión (misma limitación documentada desde V02.3) — verificado por lectura de código |

### Home — Efectividad, glow sin caja (§2)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 7 | Reemplazar el `drop-shadow` (rectangular/casi invisible en iPhone) por un halo que siga el arco | Se retira `filter: drop-shadow(...)` de `.effectiveness-donut__fill`. Se agrega un SEGUNDO `<circle>` (`.effectiveness-donut__glow`, `#player-home-effectiveness-glow`) dibujado DETRÁS del trazo principal en el mismo `<svg>`: mismo `cx/cy/r`, trazo más grueso (7px vs. 3px), opacidad baja (.45) y `filter: blur(2.5px)` — un blur sobre una forma ya trazada sigue la curva, nunca encuadra en un rectángulo | `index.html` (nuevo `<circle>`), `styles.css:.effectiveness-donut__glow`, `app.js:renderPlayerEffectiveness` | Verificado por computed style: `stroke-dasharray` del glow IDÉNTICO al del trazo principal en todo momento (ver §4); captura visual en 402px y 360px (arco redondo, sin esquinas) |
| 8 | El glow debe verse en iPhone, pero seguir por debajo del `+` central en intensidad | `stroke-width:7 / opacity:.45 / blur(2.5px)` es una presencia moderada, comparable en espíritu a la del `+` (`box-shadow 0 6px 16px rgba(...,0.4)` sobre 52px de relleno sólido) pero nunca mayor — no depende de `drop-shadow`, que es la causa raíz de que casi no se viera en iPhone | `styles.css:.effectiveness-donut__glow` | Manual (no hay forma de probar en un iPhone real desde este entorno; el fix ataca la causa documentada del bug — un filtro SVG rasterizado por bounding box en vez de por forma — no un ajuste de intensidad) |
| 9 | Mantener Efectividad histórica total y copy "X ganados de Y jugados" | `computeEffectivenessTotal` y el copy de `renderPlayerEffectiveness` no se tocan | `player-home.js`, `app.js` (sin diffs de lógica) | Tests preexistentes sin tocar, siguen verdes |

### Home — Último partido, pulso ajustado (§3)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 10 | Mantener estructura/altura/nombres/marcador/separadores sin cambios | Sin diffs en el HTML generado (`renderPlayerLastMatchCard`) ni en `.player-home-lastmatch__*` | `app.js`, `styles.css` (sin cambios en esas reglas) | Captura antes/después — geometría idéntica |
| 11 | Subir un escalón la intensidad del pulso, mismo ciclo ~3–4s, variando solo el glow, sin blink | `@keyframes lastMatchGlowPulse`: reposo `0 0 16px rgba(...,.10)` → `0 0 20px rgba(...,.16)`; pico `0 0 22px rgba(...,.20)` → `0 0 30px rgba(...,.32)`. Ciclo sin cambios (3.6s, `ease-in-out infinite`, dentro del rango pedido). Borde y tamaño sin tocar | `styles.css:.player-home-lastmatch`, `@keyframes lastMatchGlowPulse` | Computed style del estado de reposo (`boxShadow`) confirmado por script; el pulso en sí es intencionalmente sutil y difícil de certificar por captura estática (mismo criterio documentado en V02.7) |
| 12 | Mantener `prefers-reduced-motion` | `@media (prefers-reduced-motion: reduce){ .player-home-lastmatch{ animation:none; } }` sin cambios | `styles.css` | — |

### Home — tarjeta de hito (§4)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 13 | Reemplazar por la variante validada: texto blanco, fondo `surface-2`, borde azul BRAMU, glow azul leve, hasta 2 líneas; sin carrusel/tarjetas nuevas | `.player-home-hitos__chip` reescrita EXACTAMENTE con el bloque CSS del consolidado (`background: var(--surface-2)`, `border: 1px solid #199FFF`, `box-shadow: 0 0 5px rgba(25,159,255,0.5)`, `color: var(--text)`); sin cambios de layout/scroll-snap/carrusel | `styles.css:.player-home-hitos__chip` | Computed style verificado con historial sintético real (hito disparado por `computeHitos`): `background-color: rgb(13,26,42)`, `border-color: rgb(25,159,255)`, `box-shadow: rgba(25,159,255,0.5) 0 0 5px`, `color: rgb(248,250,252)` — los 4 valores coinciden exactamente con la variante pedida |

### Títulos de overlays/modales (§5)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 14 | Bajar `.overlay__title` de `letter-spacing: 0.1em` a `0.03em`, para TODA la familia (no solo Notificaciones); mantener mayúsculas/peso/color | Un solo cambio en la clase compartida — alcanza a los ~18 modales que la usan (Notificaciones, Pausa, Finalizar partido, Corregir marcador, ¿Quién sos?, Sistema de puntuación, etc.) | `styles.css:.overlay__title` | Computed style de `#notifications-modal .overlay__title`: `letterSpacing: "0.6px"` (= 0.03em × 20px) — antes `2px` (0.1em × 20px) |

### "Agregar como jugador sin cuenta" (§6)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 15 | Texto pasa a `var(--text)` (blanco); el borde sigue siendo contextual verde (compañero/Equipo A) o azul (rival/Equipo B); fondo/lógica sin cambios | Se cambia únicamente `color` en las dos reglas (`#load-player-sheet-add.sheet-option--primary` y su variante `.is-context-rival`); `border-color`/`background` sin tocar. Este botón vive dentro de la hoja "Elegir jugador", reutilizada por Setup y por Carga manual — el cambio es el único tocado ahí, todo lo demás de esas pantallas queda intacto (ver §14 del consolidado, "carga manual" como categoría general de no-cambio) | `styles.css:#load-player-sheet-add.sheet-option--primary` | Computed style en los dos contextos: Equipo A → `color: rgb(248,250,252)`, `border-color: rgb(149,255,25)`; Rival/Equipo B → `color: rgb(248,250,252)`, `border-color: rgb(25,159,255)` |

### Resumen del partido — ritmo vertical (§7)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 16 | Más aire entre metadata (fecha/hora/formato) y la primera tarjeta (~12–16px) | `.analysis-meta{ margin-bottom }`: `4px` → `14px` | `styles.css:.analysis-meta` | Computed style: `marginBottom: "14px"` |
| 17 | Bajar el ritmo entre Resultado/BRAMU Intelligence/Notas privadas/Editar partido/acciones a 12px estándar, hasta 16px si hay cambio real de bloque; sin tocar padding interno ni contenido | `.analysis-section{ margin-bottom }`: `26px` → `12px` (ritmo estándar, aplica a Resultado→Intelligence→Estadísticas→Evolución). Dos transiciones que sí cambian de tipo de bloque suben a `16px` vía override puntual por ID: `#analysis-keymoments` (antes de Notas privadas) y `#analysis-note-section` (antes del grupo de acciones). Ningún padding interno de tarjeta se tocó | `styles.css:.analysis-section`, `#analysis-keymoments, #analysis-note-section` | Computed style de las 6 secciones de un Resumen real (partido cargado por el flujo completo Carga manual→Confirmar→Guardar): `12px` en Resultado/Intelligence/Estadísticas/Evolución, `16px` en Momentos clave y Notas privadas — ver §4 |

### Setup / Configurar partido (§8)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 18 | `.view--setup` usa la misma familia de fondo funcional que Historial/Ranking/Perfil/Carga manual/Confirmar/Resumen (`--bg-gradient-app`), sin tocar el degradé propio del Home | Se agrega `background: var(--bg-gradient-app)` a `.view--setup` (antes sin `background` propio, heredaba el `--ink` plano de `html,body`) | `styles.css:.view--setup` | Computed style: `backgroundImage` de `#view-setup` idéntico byte a byte al de Historial/Resumen/Carga manual (`linear-gradient(rgb(9,19,31) 0%, rgb(5,10,18) 40%, rgb(3,7,13) 100%)`); captura visual confirmando que ya no se ve plano/negro |

### Overlay Highlight (§9)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 19 | `.overlay--highlight` pasa de `rgba(11,18,17,0.55)` (negro-verdoso pre-V02, bug heredado que V02.1 §28 ya había corregido en el resto de los overlays) a `var(--scrim)` | Un cambio de una línea | `styles.css:.overlay--highlight` | Computed style: `backgroundColor: "rgba(1, 5, 10, 0.78)"` = `--scrim` exacto |

### Normalización segura de radios (§10)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 20 | `.court-team-card__player`: 11px → 12px | Cambio directo | `styles.css:.court-team-card__player` | Grep de confirmación (sin `11px` restante en el archivo) |
| 21 | Tarjetas estándar con `16px` literal exacto → `var(--radius-card)` | 6 reglas migradas: `.team-block`, `.btn-start`, `.result-card`, `.pastilla`, `.sheet-active-card` (más `.intelligence-card`/`#summary-manual-intelligence`, que YA usaban el token desde antes) | `styles.css` (6 reglas) | Computed style sin cambios (`16px` sigue siendo `16px`, ahora vía variable — cero diferencia visual, confirmado en Confirmar partido/Home/Setup) |
| 22 | Tarjetas hero con `18px` literal exacto → `var(--radius-hero)` | 2 reglas migradas: `.highlight-popup__card`, `.court-current-set` (más `.player-home-lastmatch`, que YA usaba el token) | `styles.css` (2 reglas) | Computed style sin cambios (`18px` sigue siendo `18px`) |
| 23 | No homogeneizar las familias (circular/pill/microcontrol/superficie/tarjeta/hero/sheet) en un solo valor | Ninguna otra regla de radio tocada — las 7 familias descritas en la auditoría siguen exactamente igual de distintas entre sí | `styles.css` (sin más diffs de `border-radius`) | Grep del archivo completo: mismo inventario de valores de radio que antes, salvo los 3 casos explícitamente listados arriba |

### Historial — bordes (§11)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 24 | No agregar bordes verdes/azules a Historial; no convertirlo en copia del Home | Ningún selector de `.history-item`/`.person-list__item` fue tocado | `styles.css` (sin diffs) | Computed style de `.history-item`: `border-radius: 12px`, `border-style: none` — idéntico a antes de esta ronda |

### Limpieza CSS segura (§12)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 25 | Eliminar el duplicado exacto de `.status-banner`/`.band-seg` sin cambio visual | Se retira el bloque completo "V5" (comentario de sección + `.status-banner`, `.status-banner__primary`, `.band-seg`, `.band-seg--team`, `.band-seg--team::before`) — cada declaración era byte-idéntica a la del bloque "V7" siguiente, o quedaba completamente superada por él (misma especificidad, orden posterior gana) | `styles.css` (−19 líneas) | Diff de la banda de estado en un partido en vivo (Deuce/Punto de Oro/Break Point): sin cambios visuales — la regla que sobrevive es exactamente la que ya ganaba antes |
| 26 | Eliminar las ~85 líneas confirmadas sin uso de la vieja pantalla Resumen inmediato (`.view--summary`, `.summary-card*`, `.summary-stats`, `.summary-actions`), solo si no hay referencias activas | Confirmado por búsqueda de `class="..."` en `index.html`/`app.js`: ninguna de esas clases tiene markup vivo (la pantalla `#view-summary` fue retirada en V02.1 §13/§15 y el CSS nunca se limpió). Se retiran todas; se conserva `.summary-undo-btn` (reutilizada por `#analysis-undo-btn`/`#analysis-resume-btn` en Resumen) y se conserva/ajusta `.analysis-meta` (viva, ítem 16 de esta matriz). También se retira el override responsive muerto `.summary-card{ max-width:600px }` | `styles.css` (−24 líneas netas, incluyendo el ítem 16) | Grep de confirmación: cero referencias restantes a `.view--summary`/`.summary-card*`/`.summary-stats`/`.summary-actions` en todo el repositorio de `bramulab/`; Resumen probado de punta a punta (ver §3) sin ningún efecto visible |

### Arquitectura CSS (§13)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 27 | Mantener un solo `styles.css`, sin modularizar | Ningún archivo nuevo creado; `styles.css` sigue siendo el único archivo de estilos de la app | — | `ls bramulab/*.css` → un solo resultado |

---

## 2. Contradicción evaluada (no bloqueante)

El consolidado lista "carga manual", "selector alto" y "Confirmar partido" en su §14 ("mantener sin cambios") como categorías generales, pero §6 y §10 piden cambios puntuales y explícitamente nombrados dentro de esas mismas pantallas (el color de texto de "Agregar jugador sin cuenta", vive en la hoja de selección de jugador reutilizada por Carga manual/Setup; el radio de `.court-team-card__player`, que es Carga manual). Esto no es una contradicción real: una instrucción específica y nombrada por sección (§6, §10) prevalece sobre una categoría general de no-cambio (§14) cuando ambas conviven en el mismo documento — es el patrón normal de "regla general + excepción explícita", no un choque. Se implementaron ambos cambios puntuales; el resto de esas pantallas (estructura, layout, lógica de validación, teclado, flujo de guardado) no se tocó, verificado en el recorrido de §3.

---

## 3. Recorrido funcional completo (regresión)

Recorrido en vivo contra `.claude/dev-server.py`, con historial sintético sembrado vía `PLStore` y un partido real completo cargado a través del flujo genuino de la UI (Registrar partido → Cargar partido ya jugado → selección de 4 jugadores vía "Elegir jugador" → teclado numérico → Confirmar partido → Guardar → Resumen), no con un fixture manual — así se ejercitó el cómputo real de estadísticas (`stats`) que alimenta BRAMU Intelligence y Resumen, evitando falsos positivos de un fixture incompleto.

- **Home**: identificación de jugador (¿QUIÉN SOS?), tarjeta de jugador con Nivel BRAMU, tarjeta de Último partido, "Tu momento", hito, Actividad, Efectividad, métricas chicas, barra inferior — todo renderiza sin errores.
- **Historial**: tabs Todos/Mis partidos/Observados, tarjeta del partido cargado, sin bordes de color — intacto.
- **Ranking**: placeholder sin cambios; volver re-anima el Home (ítem 2).
- **Perfil**: Evolución del Nivel BRAMU, cerrar sesión; volver re-anima el Home (ítem 2).
- **Setup**: fondo degradé unificado (antes plano); formato/sistema de puntuación sin cambios.
- **Carga manual** (Cargar partido ya jugado): entrada de sets por teclado, avance automático de set, selector de jugador (probado en ambos contextos, compañero y rival) con el CTA "Agregar sin cuenta" en blanco/borde contextual.
- **Confirmar partido**: tarjeta de resultado (radio sin cambio visual), Guardar partido.
- **Resumen**: metadata con aire correcto, ritmo 12/16px entre bloques, BRAMU Intelligence y Notas privadas sin cambios de contenido.
- **Notificaciones**: tracking de título corregido, resto sin cambios.
- **Highlight**: `background` corregido a `--scrim` (verificado por computed style; el popup en sí solo aparece durante un partido en vivo, fuera del alcance de este recorrido de carga manual, pero la regla CSS se confirmó directamente).

**Sin overflow horizontal nuevo** en 402px ni 360px (`document.documentElement.scrollWidth > clientWidth` chequeado en Home y Resumen, ambos `false`).

**Sin errores de consola nuevos atribuibles a V02.8** — el único error observado (`Service Worker: An unknown error occurred when fetching the script`, por Google Fonts sin red en este entorno) es la misma limitación de sesión ya documentada desde V02.3.

---

## 4. Verificación empírica de las microanimaciones (no solo lectura de código)

Dado que este entorno de sesión no permite observar una transición CSS en tiempo real de forma confiable (el panel de navegador puede quedar oculto, lo que pausa `requestAnimationFrame`), se verificó el comportamiento real con `MutationObserver({attributeOldValue:true})` sobre los elementos animados, que sí registra cada asignación de estilo aunque el documento esté oculto:

- **Nivel BRAMU** (Home→Ranking→Volver a Home): secuencia observada `width: 20% → width: 0% → width: 20%` — confirma que la SEGUNDA entrada también dispara el paso "reset a 0%" (V02.7 solo lo hacía en la primera entrada de la sesión).
- **Efectividad** (mismo recorrido): `stroke-dasharray` del trazo principal y del glow nuevo pasan, EN SINCRONÍA exacta, por `"58.4336, 97.3894" → "0, 97.3894" → "58.4336, 97.3894"` — confirma tanto la re-animación en cada entrada como que el glow duplicado crece pegado al arco real, nunca desfasado.

---

## 5. Tests automáticos

**571/571 tests OK — todo verde** (`tests.html`), sin cambios respecto de la base V02.7. Ningún test nuevo: el consolidado no introduce lógica pura nueva (solo CSS, wiring de animación en `app.js` y un elemento SVG adicional), y `tests.html` no carga `app.js` ni `index.html` — solo `engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js`, ninguno de los cuales se modificó. Corresponde con lo pedido en el consolidado (§16: "agregar tests solo si aparece lógica nueva real; no inventar tests para CSS puro").

---

## 6. Validación visual — 402px y 360px

Confirmado en ambos anchos, sobre Home (con historial sintético: Nivel 5.2, Actividad 1 semana con partido, Efectividad 100%) y Resumen (partido real 6-3/6-4 cargado por el flujo completo):

1. Efectividad: arco de glow claramente redondo, sigue la circunferencia, ningún borde recto visible — incluso en el caso límite de 100% (círculo completo).
2. Último partido: mismo tamaño/borde/contenido que antes; glow de reposo confirmado por computed style en `20px/.16`.
3. Hito: fondo/borde/glow/texto blanco exactos a la variante validada.
4. Setup: degradé visible (ya no plano/negro), sin overflow.
5. Resumen: aire visiblemente mayor entre fecha/formato y la primera tarjeta; bloques más compactos y con jerarquía (12px estándar, 16px antes de Notas privadas y antes de las acciones) en vez del parejo 26px anterior.
6. Historial: sin cambios — mismas tarjetas sin borde, mismo radio 12px.
7. 360px: sin recortes ni overflow nuevos en ninguna de las pantallas recorridas.

---

## 7. Criterio de éxito (consolidado, sección final) — verificado

BRAMU se siente visualmente consistente sin que todas las superficies sean iguales (las 7 familias de radio y la distinción fila/tarjeta de bordes se mantuvieron intactas, ver ítems 23-24); las microanimaciones del Home son perceptibles pero discretas (verificado empíricamente en §4); no quedan las inconsistencias heredadas que señaló la auditoría (overlay Highlight, tracking de `.overlay__title`, ritmo de Resumen, fondo de Setup, radio huérfano, duplicado y CSS muerto — todas corregidas, ver matriz).

---

## 8. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.7"` → **`"BRAMUlab V02.8"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-7` → **`bramulab-v02-8`**.
- **Commit de implementación (código):** ver §9 (hash registrado en el commit siguiente, un commit no puede citar su propio hash).
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 9. Hash exacto y tag (registro final)

- Commit de implementación (código): `fe8c6be4443d44059b739fe2c74e625e33d52987`.
- Commit de este informe (matriz, tests, recorrido) y del README actualizado: `95255f143652bc4bd74291f948e52b553627f5af`.
- Tag `BRAMUlab_V02.8` apunta al commit inmediatamente posterior a este, que registra ambos hashes de arriba — el código funcional completo de V02.8 es íntegramente el del primer commit; ese tercer commit no modifica ningún archivo de `bramulab/`.

---

## 10. Qué no se tocó (confirmado, §14/§15 del consolidado)

Inter, verde BRAMU `#95FF19`, azul BRAMU `#199FFF` (mismo valor, ahora también literal en el hito por decisión explícita del consolidado), degradé propio del Home, Actividad de últimas 4 semanas (lógica sin cambios, solo duración de la transición), semana actual a la derecha, Efectividad histórica total (cálculo sin cambios), estructura/altura/nombres de Último partido, barra inferior, lógica de Carga manual/selector/Confirmar partido (solo los 2 puntos puntuales de §6/§10, ver §2 de este informe), contenido/estadísticas de Resumen (solo spacing), Notas privadas, BRAMU Intelligence (sin diffs en `stats.js`), reglas deportivas (`engine.js` sin cambios), backend/BD, perfiles sociales, Ranking real. Tampoco se modularizó `styles.css`, no se refactorizaron los keyframes de pulso de banda de equipo (identificados por la auditoría como candidato de mantenibilidad, explícitamente fuera de alcance por §15), y no se rediseñó Historial (queda para el próximo bloque de producto, según indica el propio consolidado en su cierre).
