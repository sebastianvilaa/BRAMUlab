# BRAMU Lab — Etapa 4.1
## v2.1 · Historial filtrable y evolución del Nivel BRAMU simulada — Informe de entrega

**Estado:** implementado, commiteado, tagueado y verificado en producción. **No cerrado por cuenta propia** — pendiente de revisión externa de ChatGPT y de la evaluación de Sebastián.
**Fecha:** 03 de septiembre de 2026
**Documentos de origen:** `docs/bramulab/consolidados/BRAMU_Lab_Etapa_4_1_v2_1_Historial_y_Evolucion_Consolidado.md`, `docs/bramulab/consolidados/BRAMU_Lab_v2_Prueba_Guiada_Datos_Simulados.md`
**Versión de partida:** v2.0 (commit `9fcad8ca7221148268c4bcb7aa3b075f7cbd03d6`)
**Versión entregada:** v2.1 (commit `e5b28700f947e5a7d62c6ff757d9cc64374d8169`, tag `v2.1`)
**Aplicación tocada:** `bramulab/` únicamente. `bramulab-partidos/` permanece intacta en v14 (verificado, ver §14).

---

## 1. Resumen ejecutivo

Esta ronda corrige dos inconsistencias que la revisión externa de ChatGPT detectó en producción sobre v2.0, y agrega dos funciones nuevas al Historial y al Perfil.

**Correcciones (§2 del consolidado):**
1. El botón Volver del Historial ahora regresa al Home cuando el Historial se abrió desde la barra inferior — que es, en la práctica, casi siempre. Se conserva "Configurar partido" como destino únicamente para el punto de entrada heredado (el menú de la pantalla tradicional de Setup), guardando el origen explícitamente en vez de adivinarlo.
2. Las hojas "Registrar partido", "Elegir jugador" y "Formato y puntuación" ya no quedan fijas en 480px en tablet/escritorio. La causa real (no visible a simple vista) era un bug de cascada CSS: la regla de ancho responsive vivía ANTES en el archivo que la regla base sin media query, así que la base — sin ninguna condición — ganaba siempre, en cualquier tamaño de pantalla. Reubicada inmediatamente después de la base, mide 768px en tablet/escritorio (medido con `getBoundingClientRect`, no solo visualmente).

**Funciones nuevas:**
- **Historial con filtros:** pestañas de pertenencia (Todos/Mis partidos/Observados, con conteos reales) + chips de modo de registro (Todos los modos/Cargados/Game por game/Punto por punto) como filtro secundario. Sin pestaña Pendientes — no existe todavía su modelo real de validación.
- **Evolución del Nivel BRAMU simulada:** reemplaza el valor fijo `5.3` de v2.0 por una serie derivada del historial real, con una regla de movimiento provisional y documentada (§4.3 del consolidado). Vive en una tarjeta nueva de Perfil (badge `SIMULADO · BETA`, gráfico de línea, resumen numérico) y alimenta también la Tarjeta de jugador del Home — una única fuente, nunca dos series paralelas.

Se agregaron 33 tests nuevos (465/465 en verde), incluida una reproducción exacta, partido a partido, del ejemplo numérico de la Prueba Guiada v2.1. Se verificó en mobile (390px), tablet (834px) y escritorio (1366px), y se publicó en producción con confirmación de que la actualización PWA de v2.0 a v2.1 funciona.

---

## 2. Los dos hallazgos de v2.0, corregidos y demostrados

### 2.1 — Volver desde Historial

**Causa real:** `initHistoryScreen()` llevaba siempre a `showView('setup')`, sin importar desde dónde se hubiera abierto el Historial. Historial tiene dos puntos de entrada reales: la barra inferior (Home/Ranking/Perfil) y el menú "☰" de la pantalla tradicional Configurar partido.

**Corrección:** `openHistoryScreen(origin)` ahora guarda el origen en una variable de módulo (`historyOpenedFrom`, `'player-home'` o `'setup'`), y `initHistoryScreen()` decide el destino de Volver según ese valor guardado — nunca lo infiere por otro estado visual.

**Demostrado:**
- Historial abierto desde la barra inferior → Volver → Home (`view-player-home` visible, `view-setup` oculto). ✅
- Historial abierto desde el menú de Configurar partido → Volver → Configurar partido (`view-setup` visible). ✅
- "Inicio" de la barra inferior sigue llevando al Home directo, sin pasar por Historial. ✅
- Recargar la app con identidad y sin partido activo entra al Home (comportamiento preexistente de `bootDefaultScreen`, no tocado, reverificado). ✅

### 2.2 — Ancho de hojas y selectores en tablet/escritorio

**Causa real (el detalle importante para quien lea el código):** en v2.0, `.bottom-sheet` tenía dos reglas de ancho — una base sin media query (`max-width: 480px`, en la sección "Etapa 3 Fase 2") y una condicionada a `min-width: 720px` (`max-width: 640px`, en la sección "Rama Jugador Etapa 2", que aparece ANTES en el archivo). Ambas reglas tienen la misma especificidad CSS (una sola clase); ante un empate de especificidad, gana la que aparece más tarde en el archivo — que era la base de 480px, sin ninguna condición de ancho. El resultado: el ancho de 640px nunca se aplicaba, en ningún tamaño de pantalla, aunque el informe de v2.0 lo describiera como aplicado (se había verificado solo visualmente en ese momento, no con `getBoundingClientRect` — el error de proceso que permitió que pasara desapercibido).

**Corrección:** la regla responsive se movió a inmediatamente después de la definición base de `.bottom-sheet` (mismo archivo, un solo lugar posible), y el ancho se llevó a 768px — coincidiendo con el ancho "de contenido" que ya usan Análisis/Historial, tal como pide el consolidado de Etapa 4.1 (§2.2: "el panel debe coincidir con el ancho útil del shell principal de BRAMU Lab, hasta 768px").

**Demostrado con `getBoundingClientRect` en los tres viewports**, sobre las tres hojas que comparten la clase `.bottom-sheet` (Registrar partido, Elegir jugador, Formato y puntuación):

| Viewport | `#register-sheet` | `#load-player-sheet` | `#load-format-sheet` |
|---|---|---|---|
| 390px (mobile) | 390px (ancho completo) | 390px | 390px |
| 834px (tablet) | 768px | 768px | 768px |
| 1366px (escritorio) | — | — | 768px |

Esquinas superiores, scrim, cierre por cruz/toque exterior/gesto y Escape no se tocaron — siguen intactos.

---

## 3. Historial con pestañas y filtros horizontales

**Pestañas de pertenencia** (`#history-tabs`): Todos, Mis partidos, Observados — con conteo real junto a cada etiqueta, calculado siempre sobre el historial completo (no se recalculan según el chip de modo activo: cada fila informa su propia dimensión). Clasificación: "mine" si el jugador actual aparece entre los 4 participantes, "observed" si no.

**Chips de modo** (`#history-mode-chips`): Todos los modos, Cargados, Game por game, Punto por punto — filtro secundario, intersección con la pestaña activa. El modo se lee del campo canónico `match.mode`; un partido guardado antes de que ese campo existiera se trata como `complete` (mismo criterio de compatibilidad que ya usaba `isGamesMode()`).

**Sin pestaña Pendientes** — no implementada, tal como pide el consolidado, porque no existe todavía el modelo real de validación entre jugadores.

**Estado vacío contextual:** si el historial completo está vacío, ofrece "REGISTRAR PARTIDO" (abre la hoja Registrar partido); si hay partidos pero el filtro activo no tiene ninguno, explica qué filtro está activo y ofrece "VER TODOS" (resetea ambos filtros). Probado en vivo tocando "Observados" con 8 partidos "Mis partidos" y 0 Observados: mostró el texto contextual correcto, nunca una pantalla rota.

**Orden:** siempre por `playedAt` descendente, aplicado después de filtrar — se conserva sin importar la combinación de filtros activa.

**Eliminar no abre el detalle:** el botón ✕ ya usaba `stopPropagation()` desde v1.3 — verificado que sigue así, sin cambios necesarios.

---

## 4. Evolución del Nivel BRAMU simulada

### 4.1 Regla de movimiento (§4.3 del consolidado, implementada tal cual)

Base `5.0`. Por partido terminado y propio:

| Resultado | Movimiento |
|---|---:|
| Victoria en 2 sets | +0.2 |
| Victoria en 3 sets | +0.1 |
| Derrota en 2 sets | −0.2 |
| Derrota en 3 sets | −0.1 |
| Americano, victoria | +0.1 |
| Americano, derrota | −0.1 |

Redondeo a 1 decimal en cada paso (no solo al final, para no arrastrar error de punto flotante). Acotado a `[1.0, 10.0]` en cada paso.

**Qué partidos se consideran:** solo partidos con `winnerTeam` definido, `regulationCompleted !== false` (excluye partidos cortados manualmente por tiempo/lesión/suspendido) y donde el jugador actual participa (nunca un Observado). Un Americano se identifica por el formato (`bestOfSets === 1`), nunca por la cantidad de sets jugados.

**Recalculada entera en cada lectura**, ordenando cronológicamente por `playedAt` ascendente antes de aplicar los movimientos — nunca un puntaje acumulado guardado aparte que pudiera desincronizarse del historial (§4.2). Esto significa que editar o eliminar un partido, o cargarlos en cualquier orden, siempre produce la misma serie final.

### 4.2 Dónde vive

- **Perfil** — tarjeta nueva "EVOLUCIÓN DEL NIVEL BRAMU", badge `SIMULADO · BETA` siempre visible. Muestra nivel actual, cambio acumulado desde 5.0 y cantidad de partidos considerados; gráfico de línea (grilla tenue, línea lima, puntos tocables, pulso sutil en el último punto); al tocar un punto muestra fecha, resultado, rivales y nivel resultante en texto plano dentro de la misma tarjeta.
- **Home** (Tarjeta de jugador) — mismo cálculo, mostrando nivel actual y la variación del ÚLTIMO partido (no el cambio acumulado — son dos números distintos a propósito, cada uno pedido para su tarjeta específica por el consolidado) y una barra de progreso derivada de la posición real de `current` dentro de `[1.0, 10.0]`.
- Ambas pantallas llaman a la misma función pura (`PH.computeLevelEvolution`) — nunca hay una segunda fuente de verdad.

### 4.3 Verificación contra la Prueba Guiada v2.1

Se reprodujeron los 8 partidos exactos del documento de datos simulados (mismas fechas, parejas, rivales y resultados), cargados en el mismo orden atípico que pide la prueba (el partido del 27AGO al final). Resultado, comparado con la tabla del documento:

| Partido | Esperado | Obtenido |
|---|---:|---:|
| 1 | 5.2 | 5.2 |
| 2 | 5.1 | 5.1 |
| 3 | 5.3 | 5.3 |
| 4 | 5.4 | 5.4 |
| 5 | 5.3 | 5.3 |
| 6 | 5.5 | 5.5 |
| 7 | 5.7 | 5.7 |
| 8 | 5.9 | 5.9 |

**Coincide exactamente, partido a partido.** También coincidieron: Partidos totales (8), Efectividad 30 días (75% · 6 de 8), Actividad 30 días (8 partidos), Forma de los últimos 5 (V·D·V·V·V), Racha actual (3), Mejor compañero (Matu, 100% · 5 partidos), Rival más enfrentado (Esteban, 5 enfrentamientos), Historial (Todos 8 / Mis partidos 8 / Observados 0, orden 03SEP→27AGO).

**Editar y restaurar (recorrido §5-6 de la prueba guiada):** se editó el partido 5 a una victoria en 2 sets — el nivel final subió de 5.9 a 6.2, como pide la comprobación ("debe recalcularse y subir"). Se restauró el resultado original — el nivel volvió exactamente a 5.9, sin ningún residuo de la edición anterior (confirmado también con un test automático dedicado).

---

## 5. Un comportamiento a tener en cuenta (no es un bug — documentado para revisión)

Durante la verificación con los datos exactos de la prueba guiada encontré que, si el partido 8 se carga con su hora tal cual la indica el documento (22:00) y la prueba se corre en un momento del día ANTERIOR a esa hora, Actividad y Efectividad de 30 días muestran 7 partidos en vez de 8 hasta que el reloj real pase las 22:00 de ese mismo día. La causa es intencional, no un error: `computeActivity30d`/`computeEffectiveness30d` (ya existentes desde v2.0, no tocadas en esta ronda) excluyen cualquier partido cuya fecha/hora sea posterior al momento real actual — un partido "cargado con hora futura" todavía no debería contar como actividad reciente. El número se autocorrige solo apenas pasa esa hora, sin ninguna acción del usuario.

Esto solo importa si Sebastián corre el recorrido de la prueba guiada en algún momento del día ANTES de las 22:00 y compara contra la tabla "Resultado exacto esperado" en ese preciso momento — el Nivel BRAMU, el Historial y el resto de los números no se ven afectados, porque ninguno de ellos depende de una ventana de 30 días relativa a "ahora". Dejo esto para que ChatGPT confirme si el criterio de "excluir partidos con hora futura" sigue siendo el correcto (creo que sí — es honesto, no inventa actividad que todavía no pasó) o si conviene documentarlo explícitamente en una futura prueba guiada.

---

## 6. Archivos modificados

Ningún archivo nuevo — toda la lógica se apoya en los módulos puros existentes.

- `bramulab/player-home.js` — 12 funciones puras nuevas: clasificación y filtrado de Historial (`classifyMatchOwnership`, `filterHistoryByOwnership`, `matchModeCanonical`, `filterHistoryByMode`, `filterHistoryCombined`, `computeHistoryTabCounts`) y evolución del Nivel BRAMU (`isMatchConsideredForLevel`, `computeLevelDeltaForMatch`, `computeLevelEvolution`, más las constantes `LEVEL_BASE`/`LEVEL_MIN`/`LEVEL_MAX`).
- `bramulab/app.js` — orquestación de los filtros del Historial y de la tarjeta de Evolución (gráfico SVG, resumen numérico, detalle de punto), corrección de `historyOpenedFrom`, `renderPlayerCard` ahora deriva el Nivel BRAMU en vez de usar `LEVEL_DEMO` (eliminado).
- `bramulab/index.html` — filas de filtro en Historial, tarjeta "Evolución del Nivel BRAMU" en Perfil.
- `bramulab/styles.css` — estilos de pestañas/chips de Historial, tarjeta y gráfico de Evolución, y la reubicación del ancho responsive de `.bottom-sheet` (§2.2).
- `bramulab/tests.html` — 33 tests nuevos.
- `bramulab/store.js`, `bramulab/version.json`, `bramulab/sw.js` — versión `v2.0` → `v2.1`.

---

## 7. Tests automáticos y resultado

- Suite completa: **465/465 en verde** (432 preexistentes + 33 nuevos de Etapa 4.1).
- Cobertura de los 33 nuevos: clasificación mine/observed, filtro por modo (incluida compatibilidad con partidos sin campo `mode`), intersección pestaña+modo, conteos por pestaña, orden por `playedAt`; las 6 combinaciones de movimiento de nivel (2/3 sets, Americano, victoria/derrota); exclusión de partidos sin ganador, cortados manualmente y Observados; casos límite (cero partidos, un partido, límites 1.0/10.0 con series largas); y la reproducción exacta de la Prueba Guiada v2.1 completa, incluida edición y eliminación.
- Se corrió sirviendo `bramulab/` con `.claude/dev-server.py` (ya existente en el repo).

---

## 8. Pruebas manuales por viewport

**Mobile (390×844):** recorrido completo con los 8 partidos de la Prueba Guiada — Home, Último partido, Historial con los tres filtros (incluido tocar "Observados" con la lista vacía y volver con "Ver todos"), Perfil con el gráfico de Evolución (8 puntos, línea, pulso en el último, detalle al tocar un punto), edición del partido 5 y restauración. Volver desde Historial (ambos orígenes). Registro en vivo Punto por punto (4 puntos, gana el primer game) sin errores de consola.

**Tablet (834×1112) y Escritorio (1366×768):** las tres hojas midieron 768px con `getBoundingClientRect` (ver tabla en §2.2); Historial y Perfil utilizables, filas de filtro dentro del ancho de contenido sin desbordar.

**Consola:** sin errores propios de la app en ningún viewport (los únicos mensajes observados fueron recursos externos bloqueados por la sandbox de verificación — Google Fonts, `version.json` offline — y un rechazo esperado de Wake Lock por pestaña no visible).

**Producción real (post-deploy):** identidad nueva, Historial con las 3 pestañas en 0/0/0, Perfil con la tarjeta de Evolución mostrando 5.0 (estado vacío honesto) — confirmado que el código publicado se comporta igual que en el entorno de verificación. Cache Storage confirmada en `bramulab-v2.1` con el service worker activo. Datos de prueba limpiados de ese perfil de navegador al terminar.

---

## 9. Comprobación de los 12 criterios de aceptación (§8 del consolidado)

1. ✅ Los dos hallazgos de v2.0 corregidos y demostrados con mediciones (§2 de este informe).
2. ✅ Historial filtra por pertenencia y modo con datos reales.
3. ✅ No aparece Pendientes.
4. ✅ La evolución responde de inmediato a guardar, editar y eliminar (recalculada en cada lectura, probado con edición+restauración real).
5. ✅ Home y Perfil usan una única fuente derivada de nivel (`PH.computeLevelEvolution`).
6. ✅ La serie es reproducible a partir del historial (determinística, probada con orden de carga distinto al cronológico).
7. ✅ Los datos anteriores permanecen intactos — no hay migración ni borrado, mismas claves `bramulab.*`.
8. ✅ Mobile, tablet y escritorio utilizables.
9. ✅ Sin regresiones en carga manual (guardar/editar probado real) ni registro en vivo (Punto por punto probado real; Game por game no tocado por esta ronda, ya verificado en la ronda anterior).
10. ✅ `bramulab-partidos/` permanece fuera del cambio (ver §14).
11. ✅ Se publica como v2.1 solo después de que la suite completa y las pruebas manuales estuvieran en verde.
12. ✅ Este informe permite revisión externa sin depender del chat.

---

## 10. Limitaciones y deuda técnica

- El comportamiento descripto en §5 (partidos con hora futura excluidos de Actividad/Efectividad hasta que el reloj los alcanza) queda documentado, no es un bug, pero puede confundir si se compara la Prueba Guiada contra el reloj exacto antes de las 22:00.
- La regla de movimiento del Nivel BRAMU es explícitamente provisional (§4.3 del consolidado) — aislada en `computeLevelDeltaForMatch`/`isMatchConsideredForLevel` para poder reemplazarla por el algoritmo oficial sin tocar la interfaz.
- El punto de entrada heredado de Historial (menú de Configurar partido → Volver a Configurar partido) sigue existiendo tal como lo pidió el consolidado — documentado en el código para que quede claro que es intencional, no un olvido.

---

## 11. Commit final y tag

- Commit: `e5b28700f947e5a7d62c6ff757d9cc64374d8169` — *"BRAMU Lab v2.1 · Historial filtrable y evolución del Nivel BRAMU simulada"*.
- Tag: `v2.1`, apuntando exactamente a ese commit.
- Rama: `main`, pusheada a `origin/main`.

---

## 12. Estado del deploy de GitHub Pages

El workflow `pages build and deployment` completó con `success` (verificado con `gh run list`). El paso de deploy en GitHub tardó más de lo habitual esta vez (~6 minutos contra ~40 segundos en rondas anteriores) — no fue un error, solo una cola más lenta del lado de GitHub; se esperó hasta la confirmación de `completed/success` antes de verificar producción.

---

## 13. URLs verificadas

- App: `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` — v2.1 confirmada en producción (footer, Cache Storage `bramulab-v2.1`, service worker activo).
- Marcador congelado (no tocado): `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — v14 confirmada, intacta.
- Repositorio: `https://github.com/sebastianvilaa/BRAMUlab`.

---

## 14. Confirmación explícita — `bramulab-partidos/` intacta

- `git status`/`git diff --stat` confirman **cero archivos modificados** dentro de `bramulab-partidos/` en todo el trabajo de esta etapa.
- Se navegó la URL de producción de `bramulab-partidos/` después del deploy: sigue mostrando `v14`, con su pantalla de Configurar partido intacta.

---

## 15. ¿Lista para revisión externa?

**Sí.** El código está commiteado, tagueado como `v2.1`, pusheado a `main`, y verificado en producción real de GitHub Pages, incluida la actualización de la PWA desde v2.0. `bramulab-partidos/` permanece intacta en v14. Queda un punto abierto para que ChatGPT confirme (§5 de este informe: exclusión de partidos con hora futura en las ventanas de 30 días) — no bloquea la entrega, pero lo dejo planteado en vez de resolverlo por mi cuenta ya que toca cómo se interpreta "actividad reciente".

No avanzo a ninguna etapa siguiente hasta la revisión de ChatGPT y la evaluación de Sebastián.
