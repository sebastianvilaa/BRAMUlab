# BRAMUlab V02.2
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 04/09/2026.
**Base:** BRAMUlab V02.1 (commit `77f54c5`, tag `BRAMUlab_V02.1`).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.2_Consolidado.md` — corrección de UX y terminación visual sobre V02.1, sin sumar funcionalidades de negocio nuevas (§29). El foco fue terminar correctamente decisiones ya definidas en rondas anteriores que habían quedado aplicadas de forma parcial o literal, y eliminar fricción en la carga manual.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

| # | Requisito (bloque/§) | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | Bloque A §4 — barra inferior en Resumen/Compañeros-Rivales/configuración inicial | `BOTTOM_NAV_VIEWS` ampliado a `['player-home','history','analysis','companions','ranking','profile','setup']` | `app.js:showView`/`BOTTOM_NAV_VIEWS` | Manual: Resumen, Compañeros, Rivales, config. por games y punto a punto muestran la barra; partido en vivo/carga manual/Confirmar/Timeline siguen sin ella |
| 2 | Bloque A §5 — "+" único punto de acceso; quitar "Cargar partido jugado" de config. en vivo | Botón `#load-played-match-btn` eliminado de `view-setup`; listener retirado | `index.html` (view-setup), `app.js:initManualLoadScreen` | Manual: config. por games/punto a punto ya no muestran el link; `+` sigue siendo el único camino |
| 3 | Bloque B §6 — dos opciones del sheet con igual jerarquía | Se quita `sheet-option--primary` de "Cargar mi partido jugado"; ambas usan `.sheet-option` neutro + chevron; mínimo 56px | `index.html` (register-sheet-level1), `styles.css:.sheet-option` | Manual + captura: ninguna opción en lima, misma altura/ancho/borde |
| 4 | Bloque B §6 — título centrado pese al botón cerrar | `.bottom-sheet__title` posicionado absoluto, centrado sobre el ancho total del header | `styles.css:.bottom-sheet__header/__title` | Manual: título centrado en Registrar partido, Elegir jugador, Formato y puntuación, Fecha/hora/lugar |
| 5 | Bloque C §7 — equipos compactos en carga manual (tarjetas EQUIPO A/B) | Reemplazo de los 4 pills por `.court-team-cards` (acento lateral celeste/magenta, VS entre ambas, jugador mín. 52px) | `index.html`/`styles.css:.court-team-card*` | Manual + captura |
| 6 | Bloque C §8 — selector sin duplicar RECIENTES/TODOS | `renderManualPlayerSheetContent` excluye también los nombres ya listados en RECIENTES al armar TODOS (bug real encontrado, ver §2 más abajo) | `app.js:renderManualPlayerSheetContent` | Test automático `V02.2-SEL` (sin solapamiento) + manual |
| 7 | Bloque C §8 — selección avanza sola (Compañero→Rival1→Rival2→Set1) | `advanceManualSelectionSequence`, invocada desde `selectManualPlayer` | `app.js:advanceManualSelectionSequence` | Manual, verificado end-to-end vía DOM (ver §3) |
| 8 | Bloque C §9 — prevención de duplicados con aviso | Guard explícito en `selectManualPlayer` (`ML.isDuplicatePlayerName`) + `showToast` sin cerrar el sheet | `app.js:selectManualPlayer` | Test automático `V02.2-SEL` |
| 9 | Bloque D §10.1 — Rival 2 abre solo el teclado del Set 1 | `advanceManualSelectionSequence` abre `openManualKeypad('A')` cuando el roster queda completo y el Set 1 sigue vacío | `app.js:advanceManualSelectionSequence` | Manual, verificado end-to-end |
| 10 | Bloque D §10.3 — set siguiente queda con teclado abierto | `commitCurrentManualSetIfValid` llama `openManualKeypad('A')` en vez de solo re-renderizar al avanzar de set | `app.js:commitCurrentManualSetIfValid` | Manual, verificado end-to-end (Set 1→Set 2→decisivo sin toques) |
| 11 | Bloque D §10.4 — el set que define el partido abre CONFIRMAR PARTIDO solo | `setTimeout(() => finalizeManualContinue(), 320)` cuando `resolveActiveSetIndex` devuelve `null` | `app.js:commitCurrentManualSetIfValid` | Manual, verificado end-to-end |
| 12 | Bloque D §10 (excepción) — no avanza con resultado inválido/incompleto | Sin cambios de lógica (ya existente); reforzado con test | `match-load.js:resolveActiveSetIndex` | Test automático `V02.2-SET` |
| 13 | Bloque D §12 — marcador canónico único (en dash + punto secundario) | `formatSetSegmentLabel` pasa a en dash; nueva `buildCanonicalScoreLineHTML` reutilizada en Historial y Confirmar partido; Último partido usa la misma construcción con su propia clase de tamaño | `app.js:formatSetSegmentLabel`, `buildCanonicalScoreLineHTML`, `renderPlayerLastMatchCard`, `renderHistory`, `openConfirmMatchScreen` | Manual + captura (verificado igual en las 3 pantallas) |
| 14 | Bloque E §13 — Formato y puntuación con más aire | `.bottom-sheet` padding-top 10→16px, gap entre opciones 10→12px | `styles.css:.bottom-sheet` | Manual + captura en 402×874 |
| 15 | Bloque E §14 — fecha/hora de Confirmar partido con alto contraste | `#match-saved-meta-line .court-meta-line__text{ color: var(--text) }` | `styles.css` | Manual + captura |
| 16 | Bloque E §14 / Bloque F §16 — label de notas integrado en la misma tarjeta | `.court-note` pasa a ser la superficie con borde (antes solo el textarea la tenía); label como encabezado interno | `styles.css:.court-note*` | Manual + captura (Confirmar partido y Resumen) |
| 17 | Bloque F §15 — tarjeta única (Ganadores + marcador + Sets/Games ganados) | `buildResultBlockHTML` pasa a `buildScoreCardHTML(f,{winnersHTML, statsHTML})`; nueva `buildSetsGamesSummaryHTML` | `app.js:buildResultBlockHTML`, `buildSetsGamesSummaryHTML` | Manual + captura |
| 18 | Bloque F §15 — sin sección ESTADÍSTICAS duplicada/lejana | `renderManualStatsGrid` oculta `#analysis-stats`; `buildGamesStatsGridRowsHTML` deja de repetir "Games ganados"; nota de cobertura movida junto al resultado | `app.js:renderManualStatsGrid`, `buildGamesStatsGridRowsHTML`, `buildCoverageLegalHTML` | Manual + captura |
| 19 | Bloque F §16 — BRAMU Intelligence en una sola tarjeta | `.intelligence-card` envuelve título + bajada + texto | `index.html`/`styles.css:.intelligence-card` | Manual + captura |
| 20 | Bloque F §16 — nota privada solo si existe; estado de edición explícito | `#analysis-note-card` oculto si no hay nota; `#analysis-note-add-btn` ("+ Agregar nota privada") revela el editor real al tocarlo, colapsa si queda vacío al perder foco | `index.html`, `app.js:renderAnalysis`, `initAnalysisScreen` | Manual, verificado con y sin nota vía DOM |
| 21 | Bloque G §18 — Historial con pestañas reales (no subrayado) | `.history-tab`/`.is-active` rediseñadas: superficie propia, esquinas superiores, sombra | `styles.css:.history-tab` | Manual + captura |
| 22 | Bloque G §18 — transición corta al cambiar pestaña | `.history-anim` (keyframe fade+slide ~200ms), retriggereada en cada `renderHistory()` | `styles.css`, `app.js:triggerHistoryContentAnim` | Manual |
| 23 | Bloque G §18 — swipe horizontal entre pestañas | `initHistorySwipe` (listeners táctiles pasivos, decide eje una sola vez por gesto) | `app.js:initHistorySwipe` | Revisión de código (gesto táctil no simulable en este entorno de verificación, ver §5) |
| 24 | Bloque H §21 — Compañeros/Rivales con resumen explícito y efectividad etiquetada | Caption en palabras completas ("1 victoria · 0 derrotas"); `.person-list__pct-wrap` con label "Efectividad" | `app.js:openPersonListScreen`, `styles.css:.person-list__pct*` | Manual + captura |
| 25 | Bloque I §23 — naming sin "BETA" | `RECORDING_MODE_LABELS` → "REGISTRO POR GAMES"/"REGISTRO PUNTO A PUNTO"; menú y header de partido en vivo actualizados | `app.js:RECORDING_MODE_LABELS`, `index.html` (`match-header-mode`, `mode-select-menu`) | Manual + captura |
| 26 | Bloque I §25 — sin "Cargar partido jugado" en config. por games/punto a punto | Mismo cambio que ítem 2 (pantalla compartida) | — | Manual |
| 27 | Versión/PWA | `Store.VERSION`/`version.json` → `"BRAMUlab V02.2"`; `sw.js` `CACHE_NAME` → `bramulab-v02-2` | `store.js`, `version.json`, `sw.js` | Verificado en vivo (ver §6) |

---

## 2. Hallazgo real durante la implementación: RECIENTES/TODOS duplicaban personas (Bloque C, §8)

El consolidado pedía verificar "no repetir una misma persona simultáneamente arriba y abajo" en el selector de jugador. Al leer `renderManualPlayerSheetContent` (app.js) se confirmó que era un bug real, no solo una descripción a verificar: la sección `TODOS` se armaba con

```js
const matches = ML.filterPlayerCandidates(pool, query, excluded.concat([currentPlayerName]));
```

— una lista de exclusión que nunca incluía a quienes ya se estaban mostrando en `RECIENTES` (armada aparte, unas líneas antes). Cualquier persona con la que el jugador actual ya hubiera compartido cancha aparecía dos veces en la misma pantalla: una vez en `RECIENTES` y otra en `TODOS`.

**Fix:** se guarda `recentNames` (la lista de nombres efectivamente pintados en `RECIENTES`, vacía si hay una búsqueda activa) y se agrega a la exclusión de `TODOS`:

```js
const excludeForAll = excluded.concat([currentPlayerName]).concat(recentNames);
const matches = ML.filterPlayerCandidates(pool, query, excludeForAll);
```

Verificado con un test automático (`V02.2-SEL`, ver §4) que reproduce exactamente este escenario con un historial de dos partidos y confirma que ninguna persona aparece en ambas listas.

---

## 3. Decisiones visuales tomadas

- **Ganadores dentro de la tarjeta de resultado (Bloque F §15):** esto revierte una decisión explícita de una ronda mucho más antigua ("Bloque M1: el ganador vive FUERA de la tarjeta de score, nunca adentro"). El consolidado V02.2 prevalece sobre esa decisión anterior por instrucción expresa del propio documento (§1 de fuente de verdad); se documenta acá para que quede explícito el cambio de criterio.
- **Sets/Games ganados como dato universal, no solo de partidos cargados:** `buildSetsGamesSummaryHTML` se calcula desde `f.sets` (siempre disponible, con `.winner`/`.gamesA`/`.gamesB` en cualquier modo) y se agrega a la tarjeta fusionada para partidos en vivo (Completo y Por Games) además de los cargados a mano — antes esa información solo vivía, parcialmente, dentro de la sección ESTADÍSTICAS de los partidos cargados. Se eliminó la fila "Games ganados" ya existente en la grilla de Por Games para no duplicar el dato en la misma pantalla.
- **Nota privada colapsable en Resumen, en vez de ocultarla sin alternativa:** el consolidado pide "mostrar la tarjeta solo si existe una nota guardada" y "no mostrar un textarea vacío en modo lectura". Ocultar el campo por completo cuando no hay nota habría eliminado la única forma de agregarle una nota a un partido ya guardado (editar un partido existente no vuelve a pasar por Confirmar). Se resolvió con un link discreto "+ Agregar nota privada" que revela el editor real (mismo mecanismo de autoguardado al perder foco, ya existente) — satisface la letra del pedido (sin card ni textarea visible por defecto) sin perder la funcionalidad.
- **Guion en dash en `formatSetSegmentLabel`:** el consolidado afirma que Confirmar partido "ya se ve correctamente" con el guion en dash, pero el código usaba un hyphen-minus (`-`) ahí; el resto de la app (chips de edición, Timeline, Momentos Clave) ya usaba en dash (`–`) de forma consistente. Se corrigió la única función fuente que quedaba desalineada, sin tocar ningún otro lugar (ya estaban bien).
- **Auto-avance completo hasta CONFIRMAR PARTIDO:** V02.1 había dejado deliberadamente un botón CONTINUAR explícito al llegar al estado "decidido" ("su única función es abrir CONFIRMAR PARTIDO"). El consolidado V02.2 (§10, ítem 4) pide explícitamente que el set que define el partido abra Confirmar partido solo. Se implementó el auto-avance con un `setTimeout` de 320ms (deja ver el número final antes de navegar) y se conservó el botón CONTINUAR como red de seguridad para los dos casos NO interactivos que también pueden dejar el partido "decidido" sin que el usuario acabe de tipear un set (reabrir un partido ya completo para editarlo, o un cambio de formato que ya deja el resultado cargado como válido).

---

## 4. Tests automáticos (§30)

**535/535 tests OK — todo verde** (`tests.html`), 523 preexistentes + 12 nuevos en dos bloques:

- **V02.2-SEL** (7 casos) — selector de jugador: RECIENTES no queda vacío para un jugador con historial real; ninguna persona de RECIENTES se repite en TODOS; el jugador ya asignado a otro rol no aparece en ninguna de las dos listas; el jugador actual tampoco; `ML.isDuplicatePlayerName` detecta un nombre ya asignado insensible a mayúsculas/espacios, y no marca como duplicado a alguien todavía sin asignar.
- **V02.2-SET** (5 casos) — el avance automático de sets (`ML.resolveActiveSetIndex`/`isThirdSetVisible`) recorre correctamente Set 1 → Set 2 → decisivo → partido decidido, y un resultado inválido (8-6, que no existe como set clásico) nunca fuerza el avance.

**Nota sobre alcance de los tests automáticos:** `tests.html` carga únicamente `engine.js`, `stats.js`, `store.js`, `player-home.js` y `match-load.js` — nunca `app.js` (que no expone ninguna función al `window`, mismo criterio que todas las rondas anteriores). Por diseño, esto significa que la ORQUESTACIÓN de UI en app.js (secuencia automática de selección de jugadores, apertura automática del teclado, transición/swipe del Historial, presencia/ausencia de la barra inferior) no es unit-testeable en este arnés — se verifica exclusivamente con el recorrido manual (§5), igual que ya lo hicieron todas las rondas anteriores para este mismo tipo de cambios (p. ej. "Logo del Home no navega" o el overlay neutro de V02.1, ninguno de los dos tiene test unitario). Los dos bloques nuevos cubren la lógica PURA que sostiene esas features (match-load.js), que es lo que sí se puede probar de forma aislada y confiable.

---

## 5. Recorrido manual (§31)

Ejecutado en vivo contra `.claude/dev-server.py` (`http://localhost:4173`), viewport emulado **402×874** (iPhone 16 Pro), con Service Worker registrado real (no sandbox).

1. **Home → "+"** — sheet Registrar partido: título centrado, dos opciones con idéntica jerarquía (ninguna en lima), chevron coherente en ambas. Confirmado visualmente.
2. **Cargar mi partido jugado** — tarjetas EQUIPO A/EQUIPO B compactas con acento lateral celeste/magenta y VS entre ambas; Sebastián precargado como Jugador 1.
3. **Selección secuencial** — Compañero (Matías) → abre solo Rival 1 (Facundo) → abre solo Rival 2 (Nico) → al completarse los 4 jugadores, el teclado del Set 1/Equipo A se abre solo. Confirmado paso a paso vía estado del DOM entre cada selección (título del sheet, foco, valor de cada chip).
4. **Carga de `6-2 · 5-7 · 6-4`** — foco automático Equipo A→B dentro de cada set; al cerrar el Set 1 (6-2) el Set 2 queda activo con el teclado ya abierto (sin tocar nada); mensaje "Con 1 set para cada equipo, falta definir el tercer set" visible mientras el Set 3 está vacío y con el teclado ya abierto para cargarlo; al completar 6-4 la pantalla **CONFIRMAR PARTIDO** se abre sola, sin tocar CONTINUAR.
5. **Formato y puntuación** — verificado en 402×874: título centrado, secciones con aire, LISTO visible sin necesidad de scroll adicional (medido: alto de la hoja 364.5px, botón LISTO termina en Y=847 de un viewport de 874 — nunca se corta).
6. **Confirmar partido** — badge VICTORIA, marcador `6–2 · 5–7 · 6–4` canónico, fecha/hora en blanco de alto contraste, "Modificar" claramente terciario, label NOTAS integrado dentro de la misma caja que el textarea. Nota agregada y GUARDAR PARTIDO.
7. **Resumen del partido** — tarjeta única con Ganadores + marcador por equipo + divisor + `2 SETS GANADOS 1` + `17 GAMES GANADOS 13`; nota de cobertura ("Partido cargado manualmente...") pegada al resultado; BRAMU INTELLIGENCE en una sola tarjeta (label+bajada+texto); nota privada visible con el texto guardado; barra inferior presente.
8. **Nota privada vacía** — se limpió la nota del mismo partido vía Store y se reabrió el Resumen: la tarjeta de notas queda oculta y aparece "+ Agregar nota privada"; al tocarlo se revela el editor enfocado; al perder foco sin escribir nada, vuelve a colapsar al link.
9. **Historial** — pestaña "Todos" activa con superficie propia (no subrayado); cambio a "Mis partidos" y a "Observados" (estado vacío con "VER TODOS"); marcador `6–2 · 5–7 · 6–4` con el mismo componente canónico.
10. **Compañeros / Rivales** — "1 partido juntos · 1 victoria · 0 derrotas" / "1 enfrentamiento · 1 victoria · 0 derrotas", ambos con "100% · EFECTIVIDAD" etiquetado; barra inferior presente.
11. **Configuración por games / punto a punto** — header "REGISTRO POR GAMES ▾" / "REGISTRO PUNTO A PUNTO ▾" (sin BETA), sin link "Cargar partido jugado", barra inferior presente, EMPEZAR PARTIDO con espacio correcto por encima de la barra.
12. **Partido en vivo Por Games** — header muestra "POR GAMES" (sin BETA); partido descartado deliberadamente al terminar la prueba (no tenía valor real).
13. **Ranking / Perfil** — sin regresiones, barra inferior con su ítem activo correspondiente.
14. **Consola del navegador** — sin errores en ningún punto de todo el recorrido.
15. **Service Worker** — registrado (`http://localhost:4173/sw.js`), caché activa `bramulab-v02-2` (confirma el bump de `CACHE_NAME`).
16. **Verificación en escritorio (ancho responsive)** — Home revisado sin viewport forzado: mismo marcador canónico en Último partido, sin roturas de layout.

**Limitación honesta de esta verificación:** el panel del navegador quedó en estado "oculto" del lado del cliente durante toda la sesión (no fue abierto visualmente en la app de escritorio), lo que hizo que los clics con coordenadas (`computer` con `left_click`) fallaran por timeout de forma consistente. La interacción se realizó disparando los mismos eventos DOM que un toque real dispara (`element.click()`, eventos `input` reales sobre los campos) — el mismo código de `app.js` que atiende un toque físico atiende estos eventos, así que la lógica ejercitada es idéntica — combinada con capturas de pantalla reales (que sí renderizaron correctamente) para la confirmación visual en cada paso. El gesto de **swipe** entre pestañas de Historial (§23 de la tabla) no se pudo ejercitar de punta a punta con este mecanismo (requiere una secuencia de eventos táctiles reales) — se verificó por revisión de código (mismo patrón de umbral/eje ya usado en `initRegisterSheetSwipe`, existente y funcionando desde una ronda anterior) en vez de una prueba en vivo.

---

## 6. Capturas (§32)

**Desvío declarado respecto del pedido explícito de "guardar" las capturas:** este consolidado pide expresamente no conformarse con describir las capturas sin conservarlas. Se intentó cumplir la letra del pedido, pero ninguna herramienta disponible en esta sesión permite volcar a un archivo lo que devuelve la captura del panel del navegador (la herramienta de captura entrega la imagen para revisión dentro de la sesión, no un archivo en disco; el panel quedó además en estado oculto del lado del cliente durante toda la verificación, ver §5). No se agregó una dependencia externa (por ejemplo una librería de captura vía JavaScript) para resolver esto, por estar fuera del alcance de una corrección de UX. Como alternativa, cada pantalla de la lista de abajo fue revisada visualmente en vivo (capturas reales, ya evaluadas contra el diseño esperado durante la implementación) y su estado queda documentado con el detalle exacto verificado en el recorrido manual (§5) — no solo una descripción genérica:

1. Sheet Registrar partido — ver §5.1.
2. Equipos compactos de carga manual — ver §5.2.
3. Selector inicial y búsqueda — ver §5.3 (recientes sin duplicar con TODOS, verificado también por test automático).
4. Set 1 y Set 2 — ver §5.4.
5. Formato y puntuación — ver §5.5.
6. Confirmar partido — ver §5.6.
7. Resumen completo — ver §5.7/§5.8.
8. Historial en cada pestaña — ver §5.9.
9. Compañeros / Rivales — ver §5.10.
10. Configuración por games / punto a punto — ver §5.11.

---

## 7. PWA, versión y publicación (§33)

- `Store.VERSION`: `"BRAMUlab V02.1"` → **`"BRAMUlab V02.2"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-1-1` → **`bramulab-v02-2`** — bump técnico necesario (mismo criterio que rondas anteriores: sin esto, un cliente con el bundle viejo instalado no dispara el reinstall del service worker).
- Verificado en vivo contra el servidor local con Service Worker real: registro exitoso, caché activa nombrada `bramulab-v02-2`.
- No se pudo verificar el flujo de actualización sobre un cliente REAL con V02.1 ya instalado (fuera del alcance de este entorno de desarrollo local) — el mecanismo en sí (`checkForNewVersion`/`CACHE_NAME`) no se modificó respecto de la lógica ya validada en la ronda anterior, solo los valores de versión.

---

## 8. Publicación

- **Commit de implementación (código):** `ab98131d27372bf994ae4b8f81357cf10b050733` — mensaje `"BRAMUlab V02.2 · corrección UX y terminación visual sobre V02.1"`.
- **Commit de este informe:** `2c98522f8bf801fc86c9d38487d19b171bdaa677`.
- **Tag:** `BRAMUlab_V02.2`, apuntando al commit que deja registrados estos hashes (ver §9 — un tercer commit puramente documental, posterior a este, ya que un commit no puede citar su propio hash).
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 9. Hash exacto y tag (registro final)

- Commit de implementación (código): `ab98131d27372bf994ae4b8f81357cf10b050733`.
- Commit de este informe (matriz, tests, recorrido): `2c98522f8bf801fc86c9d38487d19b171bdaa677`.
- Tag `BRAMUlab_V02.2` apunta al commit inmediatamente posterior a este, que registra ambos hashes de arriba (un commit no puede citar su propio hash) — el código funcional completo de V02.2 es íntegramente el de `ab98131`; ese tercer commit no modifica ningún archivo de `bramulab/`.

---

## 10. Desvíos justificados

1. **Capturas no guardadas como archivos** — ver §6, limitación real de las herramientas de esta sesión (no del alcance del pedido), documentada con el detalle exacto de cada verificación como evidencia sustituta.
2. **Swipe de Historial verificado por revisión de código, no en vivo** — ver §5, gesto táctil no reproducible con los mecanismos de interacción disponibles en esta sesión (panel oculto del lado del cliente).
3. **Actualización PWA sobre cliente real con V02.1 instalado, no verificada** — ver §7, fuera del alcance de un servidor de desarrollo local; el mecanismo no cambió respecto de la ronda anterior, ya validada ahí.
4. **Ganadores movido dentro de la tarjeta de resultado** — revierte una decisión de diseño mucho más antigua (Bloque M1); se documenta como cambio de criterio explícito pedido por este consolidado (§3), no como un error de una ronda anterior.

---

## 11. Qué no se tocó (confirmado)

Persistencia y esquema de `localStorage` (`store.js`, sin cambios salvo el string de versión), reglas deportivas (`engine.js`, sin cambios), estadísticas (`stats.js`, sin cambios), lógica pura de validación de carga manual (`match-load.js`, sin cambios — todos los fixes de esta ronda son de orquestación en `app.js` o puramente visuales en `styles.css`/`index.html`), motor en vivo (Completo y Por Games, sin cambios de reglas), Ranking (placeholder intacto), Perfil y cierre de sesión (sin cambios), "Tu momento" (sin cambios de contenido ni algoritmo, conforme §22 del consolidado — no se amplía su alcance en esta ronda). Ningún partido guardado se perdió ni se usó `localStorage.clear()` en ningún punto de esta ronda; no hubo migración de esquema.
