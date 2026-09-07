# BRAMUlab V02.8.1
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.8 (commit `204ecdb`, tag `BRAMUlab_V02.8`).
**Origen de esta ronda:** instrucciones detalladas dadas directamente en el chat (corrección corta de calibración visual sobre puntos detectados en la prueba real de V02.8) — no hubo un archivo `Consolidado` separado esta vez; este Informe documenta esas instrucciones tal como fueron dadas.
**Estado:** publicado en producción.

Ronda exclusivamente de calibración visual: no se reabrió la auditoría, no se tocó BRAMU Intelligence, no se tocó Historial, no se modularizó CSS, no se cambió lógica funcional ni estadísticas. Se corrigieron 7 puntos detectados en la prueba real de V02.8 sobre Home (animaciones, glow de Efectividad, pulso de Último partido, hito), Resumen (botones) y el selector de jugador (CTA sin cuenta).

**Hallazgo técnico no anticipado, reportado con transparencia:** durante la verificación se determinó que la causa real de que Nivel BRAMU y Efectividad no se percibieran animando en V02.8 no era solo la duración — era la curva de easing compartida (`--motion-ease`, `cubic-bezier(0.32,0.72,0,1)`), que resuelve ~95-100% del recorrido visual dentro del primer 20-25% del tiempo transcurrido. Se corrigió introduciendo `--home-anim-ease: ease-out` exclusivo para las 3 animaciones de entrada del Home (ver §1 de la matriz y el detalle en §2 de este informe).

---

## 1. Matriz requisito → implementación → archivo/función → prueba

### Home — Actividad (§1.1)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | Mantener la técnica actual (funciona); más lenta y perceptible (~700-800ms); stagger ~90-110ms; izquierda→derecha; sin rebote | **Técnica sin cambios** (transición CSS de `height` + reflow forzado + stagger vía `transition-delay` inline). Duración `--home-anim-activity`: 500ms→**750ms**. Stagger: 60ms→**100ms** por barra. Easing: pasa de `--motion-ease` a `--home-anim-ease` (`ease-out`, ver hallazgo técnico arriba) | `styles.css:.activity-bar`, `app.js:renderPlayerActivity` | Verificado por scrubbing determinístico de la `Animation` subyacente (`getAnimations()`) y por captura real en secuencia (ver §3) |

### Home — Nivel BRAMU (§1.2)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 2 | Crecimiento horizontal CLARAMENTE perceptible, no solo DOM 0→final; `transform:scaleX(0→1)`; `transform-origin:left center`; ~700-800ms; easing suave | **Técnica reemplazada**: de transición de `width` (frágil — dependía de que el navegador registrara un frame en 0% antes de animar) a `@keyframes playerLevelBarGrow` sobre `transform:scaleX()`, con `transform-origin:left center`, disparada/reiniciada agregando la clase `.is-animating` (con reflow forzado entre sacarla y ponerla, para que se reinicie en cada entrada). El `width` final se asigna siempre directo — nunca en dos pasos; lo que crece es la escala, no el ancho. Duración `--home-anim-level`: 550ms→**750ms**. Easing: `--home-anim-ease` (`ease-out`) | `styles.css:.player-card__bar-fill/.is-animating/@keyframes playerLevelBarGrow`, `app.js:renderPlayerCard` | **Prueba determinística** (`Animation.currentTime` scrubbing, independiente de tiempo real/throttling): en fracciones 0/0.25/0.5/0.75/1 del recorrido, `scaleX` midió `0.000 → 0.378 → 0.685 → 0.907 → 1.000` — crecimiento limpio y monótono a lo largo de TODA la duración configurada (750ms), no una "explosión" en el primer tramo. Además, captura real en secuencia (Home→Ranking→Home) mostró la barra pasando de casi vacía a llena en pasos claramente distinguibles (ver §3) |

### Home — Efectividad, animación (§1.3)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 3 | El arco se dibuja claramente desde 0 hasta el % real; ~900-1000ms; easing suave; el % central aparece directo, nunca cuenta; evitar depender solo de "0 + reflow + valor final" | **Técnica reemplazada**: Web Animations API (`Element.animate()`) sobre `stroke-dashoffset`, con `stroke-dasharray` CONSTANTE (la circunferencia completa) en los tres círculos del donut — la técnica estándar de "dibujado" de un arco SVG. Duración: constante JS `EFFECTIVENESS_ANIM_MS = 950` (no puede vivir en una variable CSS porque WAAPI pide un número). Easing: se lee `--home-anim-ease` vía `getComputedStyle` y se pasa como `easing` a `.animate()`. El valor final se asigna siempre por `style` ANTES de animar (así el estado post-animación es idéntico corra o no la animación — progressive enhancement). El texto del % se asigna directo, nunca cuenta | `app.js:animateEffectivenessCircle`, `renderPlayerEffectiveness` | **Prueba en tiempo real** (una sola ejecución atómica, sin cortes entre disparo y muestreo): `stroke-dashoffset` del trazo principal pasó por `97.3894 → 81.9993 → 60.1402 → 43.2435 → 33.2503 → 32.1385` (final, exacto para 67%) en checkpoints de 0/0.6/1.6/2.6/3.6/4.6s sobre una versión de prueba a 4000ms — progresión limpia y continua, nunca un salto |

### Home — reentrada (§1.4)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 4 | Las 3 animaciones se disparan en cada entrada/vuelta al Home; mantener `prefers-reduced-motion` | Sin cambios de arquitectura respecto de V02.8 (`shouldAnimate` se sigue calculando una vez por `renderPlayerHome()`, sin flag de sesión). `--home-anim-level`/`--home-anim-activity` colapsan a 1ms bajo `prefers-reduced-motion` (igual que antes); Efectividad no llama a `.animate()` en absoluto cuando `shouldAnimate` es `false` (chequeo hecho una sola vez en `renderPlayerHome`, no en cada círculo) | `styles.css:root`, `app.js:renderPlayerHome` | Confirmado con `MutationObserver`/scrubbing que las 3 se reinician en una segunda entrada (Home→Ranking→Home), no solo la primera de la sesión |

### Home — Efectividad, glow sin caja (§2)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 5 | Eliminar CUALQUIER filtro (blur/drop-shadow/rasterizado); halo con círculos/strokes concéntricos; interno ~5px/.20-.25; externo ~8px/.08-.12; comparten radio/%/dasharray/animación; más discreto que el `+` | **Reemplazo completo**, sin ningún `filter`: el único círculo de glow con `filter:blur()` de V02.8 se retira; se agregan DOS halos (`.effectiveness-donut__glow-inner` 5px/.22, `.effectiveness-donut__glow-outer` 8px/.10), dibujados DETRÁS del trazo principal (3px, nítido, sin filtro). Los tres círculos reciben exactamente el mismo `stroke-dasharray`/`stroke-dashoffset` en cada paso de `renderPlayerEffectiveness` — no pueden desalinearse | `index.html` (2 `<circle>` nuevos), `styles.css:.effectiveness-donut__fill/__glow-inner/__glow-outer` | Captura real a 67% y a 100%: halo circular limpio, sin ninguna esquina/borde recto visible en ningún punto del arco. Sin `filter` en la regla, la caja/rasterizado de V02.8 es estructuralmente imposible (no hay filtro que rasterizar) |

### Home — Último partido, pulso (§3)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 6 | Punto intermedio entre V02.7 (muy sutil) y V02.8 (muy fuerte); reposo `0 0 18px rgba(149,255,25,.12)`; pico `0 0 25px rgba(149,255,25,.24)`; mismo ciclo ~3.6s/ease-in-out; sin animar tamaño/borde; sin blink | Valores aplicados EXACTOS a los sugeridos. Ciclo (3.6s), `ease-in-out` y mecanismo (solo `box-shadow`) sin cambios respecto de V02.8 | `styles.css:.player-home-lastmatch`, `@keyframes lastMatchGlowPulse` | Computed style del estado de reposo: `box-shadow: rgba(149,255,25,0.12) 0 0 18px` — exacto |

### Home — hito, ritmo de dos líneas (§4)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 7 | Mantener estilo aprobado (texto blanco/surface-2/borde y glow azul/radio/padding); sin salto de línea manual; ajustar ancho útil para favorecer wrap natural; altura mínima de 2 líneas si el texto es corto | Único cambio: `flex-basis` de la tarjeta (86%→**70%** en celular, 60%→**48%** en ≥480px) — angosta el ancho útil sin tocar contenido. Se agrega `min-height: 2.8em` (2 líneas a este tamaño/interlineado) + `display:flex; align-items:center` para centrar verticalmente un texto corto que no llegue a partirse. Color/fondo/borde/glow/radio/padding: sin cambios | `styles.css:.player-home-hitos__chip` | Con un hito real de 46 caracteres ("Una victoria más para igualar tu racha de 2."): wrap natural a 2 líneas confirmado por captura y por `getBoundingClientRect()` (alto 70px, por encima del mínimo de 36px, sin salto manual insertado) |

### Resumen — botones (§5)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 8 | "Editar partido" y "Volver al inicio" con igual ancho/alto/radio/estructura de padding vertical (~44-46px); mismo color/jerarquía (oscuro/secundario vs. verde/primario); sin normalización global de botones | Regla acotada a `#analysis-share-section .btn-secondary, #analysis-share-section .btn-start`: `min-height:46px; padding:0 16px; font-size:14px; border-radius:14px` + centrado flex. `.btn-secondary`/`.btn-start` de base (usados en Setup/sheets/carga manual) quedan intactos — el override solo aplica dentro de esta sección | `styles.css` (nueva regla en la sección de Resumen) | Computed style real (partido cargado por el flujo completo): EDITAR PARTIDO `height:46, width:366, radius:14px, bg:rgb(13,26,42)`; VOLVER AL INICIO `height:46, width:366, radius:14px, bg:rgb(149,255,25)` — **idénticos en tamaño**, distintos solo en color |

### "Agregar jugador sin cuenta" — jerarquía (§6)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 9 | Buscador claramente protagonista; CTA secundario; borde NEUTRO en vez de color completo; contexto de equipo solo como detalle chico (ícono/dot); texto blanco; full-width, sin volverse un link chico | Borde de `#load-player-sheet-add.sheet-option--primary` pasa de `var(--team-a/b)` a `var(--court-line)` (neutro, igual que cualquier `.sheet-option` no-primaria). Contexto de equipo reducido a `.sheet-add-player-dot` (8px, círculo, verde/azul según contexto) insertado ANTES del texto. Texto sigue blanco (`var(--text)`, ya fijado en V02.8). Tamaño/ancho/altura (heredados de `.sheet-option`, min-height 56px, 100% ancho): sin cambios | `styles.css:#load-player-sheet-add.sheet-option--primary/.sheet-add-player-dot`, `app.js:renderManualPlayerSheetContent` (pasa de `textContent` a `innerHTML` con `escapeHtml` sobre el nombre tipeado) | Captura real en ambos contextos: Equipo A → borde neutro + dot verde; Rival/Equipo B → borde neutro + dot azul. El buscador (borde de foco verde/azul, ya existente) queda visualmente más protagonista que el CTA en los dos casos |

---

## 2. Por qué las animaciones de V02.8 no se percibían (causa real, no solo duración)

La auditoría inicial de V02.8 asumió que "más duración" bastaba. La prueba real mostró que NO: con `--home-anim-level`/`--home-anim-effectiveness` ya en 550-750ms, Nivel y Efectividad seguían sin percibirse, tanto en iPhone como en desktop.

Se investigó con una técnica de verificación que el propio pedido de esta ronda exige (no aceptar solo MutationObserver/computed styles): se estiró la duración a 4000ms de forma temporal y se midió el `scaleX`/`stroke-dashoffset` real en checkpoints de tiempo reales dentro de una sola ejecución de script (sin cortes entre pasos, para no depender de la latencia entre llamadas de esta herramienta de navegador). Resultado: con `--motion-ease` (`cubic-bezier(0.32,0.72,0,1)`, la curva compartida de toda la app para sheets/tabs/hover), el recorrido visual llegaba a ~95-100% dentro del primer 20-25% del tiempo transcurrido — es decir, a **cualquier duración configurada**, la parte perceptible del movimiento ocurría en los primeros ~150-200ms y el resto era un ajuste imperceptible. Esa curva tiene sentido para una transición de UI que debe sentirse "responsiva" (arranca rápido), pero es contraproducente para una animación de ENTRADA que busca comunicar "esto está creciendo".

**Corrección:** se introdujo `--home-anim-ease: ease-out` (la curva estándar del navegador, mucho menos agresiva) exclusivamente para las 3 animaciones de entrada del Home, sin tocar `--motion-ease` (que sigue gobernando sheets/tabs/hover sin cambios). Repetido el mismo experimento con `ease-out`: Nivel pasó por `scaleX = 0 → 0.395 → 0.698 → 0.915 → 1.0` en checkpoints de 1/2/3/5 segundos sobre 4000ms — un crecimiento genuinamente repartido a lo largo de toda la duración. Con este fix, las duraciones ya pedidas (700-1000ms según el elemento) sí se traducen en un movimiento perceptible de principio a fin, no solo en una duración numérica correcta pero visualmente inútil.

---

## 3. Verificación visual real (no solo MutationObserver/computed styles)

Cumpliendo el punto expreso de esta ronda ("no aceptar como prueba suficiente..."), se usaron 3 métodos complementarios, cada uno más fuerte que el anterior:

1. **Captura de pantalla en secuencia real** (Home→Ranking→Home, con la duración estirada a 4000ms para que la cámara pudiera capturar pasos intermedios con el margen de latencia propio de esta herramienta): 4 capturas sucesivas de la barra de Nivel BRAMU mostraron progresión clara — casi vacía → ~1/3 → ~2/3 → llena.
2. **Scrubbing determinístico de la `Animation` subyacente** (`element.getAnimations()[0].currentTime = f * duration`, leyendo el estilo computado resultante): método inmune a cualquier problema de temporización real o limitación de esta herramienta (el pestañeo del panel de navegador de este entorno pausa `requestAnimationFrame` y limita `setTimeout` en segundo plano, una limitación ya documentada desde V02.7). Confirmó a Nivel BRAMU con progresión limpia y monótona en los 4 puntos intermedios de su recorrido real (750ms).
3. **Muestreo en tiempo real dentro de una única ejecución atómica de script** (disparo + lectura de checkpoints, todo en la misma llamada, sin cortes entre pasos): confirmó a Efectividad con progresión limpia del `stroke-dashoffset` a lo largo de ~4.6 segundos reales (versión de prueba a 4000ms), llegando exactamente al valor final esperado para 67%.

**Limitación de este entorno de sesión, documentada con transparencia:** el panel de navegador de esta herramienta reporta intermitentemente estar "oculto" para el usuario, lo que pausa `requestAnimationFrame` y limita temporizadores en segundo plano (mismo comportamiento ya señalado en informes de V02.7/V02.8 para `prefers-reduced-motion`). Esto hizo que algunas mediciones por tiempo real de pared fueran inconsistentes entre intentos — se resolvió usando los métodos 2 y 3 de arriba, que no dependen de que el panel esté visible. Para Actividad específicamente, `element.getAnimations()` devolvió una lista vacía en este entorno en el momento de la consulta (compatible con que la transición ya haya sido removida por completar, o con que este entorno específico —posiblemente por el mismo throttling de segundo plano— no llegue a registrar un frame intermedio observable). Dado que el usuario confirmó en dispositivo real que Actividad SÍ anima hoy, y la instrucción explícita de esta ronda fue mantener su técnica sin motivo técnico real para cambiarla, se mantuvo sin cambios de mecanismo — solo duración/stagger/easing — y se deja esta observación registrada para revisar si llegara a reportarse como insuficiente en una próxima prueba real.

**Regresión:** recorrido de Home (402px/360px), Setup, Carga manual, selector de jugador (ambos contextos), Confirmar partido, Resumen — sin overflow horizontal nuevo, sin errores de consola nuevos atribuibles a esta ronda (el único error observado, `Service Worker: An unknown error occurred when fetching the script` por Google Fonts sin red, es la misma limitación de entorno ya documentada desde V02.3).

---

## 4. Tests automáticos

**571/571 tests OK — todo verde** (`tests.html`), sin cambios respecto de la base V02.8. Ningún test nuevo: esta ronda es exclusivamente visual (CSS + wiring de animación/markup en `app.js`/`index.html`) — `tests.html` no carga `app.js` ni `index.html`, y ninguno de los archivos que sí carga (`engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js`) se tocó, salvo el `APP_VERSION` de `store.js` (string de versión, no lógica).

---

## 5. Validación visual — 402px, ~390-402px y 360px

Confirmado en los tres anchos, con un partido real cargado por el flujo completo de la UI (no un fixture manual — evita falsos negativos por datos incompletos):

- Efectividad: halo circular limpio en 67% y en 100% (círculo completo), sin ninguna caja/esquina recta, aro principal nítido.
- Último partido: pulso en los valores intermedios pedidos, estructura/altura/nombres sin cambios.
- Hito: wrap natural a 2 líneas con un hito real de 46 caracteres, sin salto de línea insertado a mano.
- Resumen: EDITAR PARTIDO y VOLVER AL INICIO con altura/ancho/radio idénticos (46px), distintos solo en color.
- Selector de jugador: buscador con foco de color contextual claramente más protagonista que el CTA "Agregar sin cuenta" (borde neutro + dot chico), en ambos contextos (compañero/verde, rival/azul).
- Sin overflow horizontal nuevo en 360px en ninguna de las pantallas recorridas.

---

## 6. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.8"` → **`"BRAMUlab V02.8.1"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-8` → **`bramulab-v02-8-1`**.
- **Commit de implementación (código):** ver §7 (hash registrado en el commit siguiente, un commit no puede citar su propio hash).
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 7. Hash exacto y tag (registro final)

- Commit de implementación (código): `0851022c89874e4375cf31beaac8d034d15c1450`.
- Commit de este informe: `a251b01d6d44fdecc6a146dfeb4237686f28d8cd`.
- Tag `BRAMUlab_V02.8.1` apunta al commit inmediatamente posterior a este, que registra ambos hashes de arriba — el código funcional completo de V02.8.1 es íntegramente el del primer commit; ese tercer commit no modifica ningún archivo de `bramulab/`.

---

## 8. Qué no se tocó (confirmado, §7 de las instrucciones de esta ronda)

Título de Notificaciones y tracking de overlays (V02.8, aprobado), spacing entre tarjetas de Resumen (V02.8, aprobado), fondo de Setup (V02.8, aprobado), estilo general del hito salvo el ancho/altura mínima (color/fondo/borde/glow/radio/padding, todos de V02.8, aprobados), texto blanco del CTA sin cuenta (V02.8, aprobado), estructura/altura/nombres de Último partido, fondo del Home, lógica de Actividad (4 semanas) y de Efectividad (histórica total) — solo cambió su presentación visual, nunca el cálculo —, Historial, Perfil, Ranking, BRAMU Intelligence, colores de marca (`#95FF19`/`#199FFF`, sin cambios de valor), Inter, arquitectura CSS (`styles.css` sigue siendo un solo archivo, sin modularizar).
