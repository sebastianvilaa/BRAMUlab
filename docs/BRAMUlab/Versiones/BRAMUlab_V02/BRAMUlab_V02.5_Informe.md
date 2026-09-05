# BRAMUlab V02.5
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 04/09/2026.
**Base:** BRAMUlab V02.4 (commit `86e9a94`, tag `BRAMUlab_V02.4`).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.5_Consolidado.md` — integración visual + UX de carga manual y Resumen, en una sola ronda, avanzando internamente Bloque A → B → C → D como pide el propio consolidado. Objetivo: llevar la carga manual y el Resumen al nivel visual que ya alcanzó el Home en V02.4, consolidar la nueva dupla cromática verde/azul BRAMU y sacar fricción de pasos que no aportaban al flujo principal — sin sumar funciones nuevas.

No se encontró ninguna contradicción real que impidiera implementar el consolidado tal como está escrito; sí hubo una ambigüedad menor (color de foco del buscador de jugador) resuelta con una decisión documentada en §3 — no bloqueaba la implementación correcta.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

### Bloque A — Sistema visual + Home

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | §2 — Inter se mantiene; tracking de labels chicos a `0.03em` de referencia (sin reemplazo global ciego) | Reducido en los labels de Home, headers de sheets, labels de equipo y Resumen explícitamente señalados por el consolidado (`.pastilla__title`, `.pastilla__microlabel`, `.player-card__level-label`, `.player-home-group-label`, `.player-home-lastmatch__title`, `.bottom-sheet__title`, `.court-header__status(--saved)`, `.team-block__label`, `.court-team-card__label`, `.manual-field-label`, `.summary-card__title/__reason`, `.result-card__winners`, `.analysis-header__title`, `.analysis-section__title`, `.analysis-subsection__title`); el resto del archivo NO se tocó | `styles.css` (18 reglas puntuales) | Manual + captura |
| 2 | §3 — nueva dupla `--brand-lime:#95FF19` / `--accent-cyan:#19BAFF`; `--team-a`/`--team-b` como alias directos; magenta fuera del sistema de equipos | Tokens raíz reescritos; `--team-a: var(--brand-lime)`, `--team-b: var(--accent-cyan)`, `--success: var(--brand-lime)`; **hallazgo real**: 24 reglas con colores de equipo hardcodeados en RGB (nunca `var()`) no habrían heredado el cambio — sweep completo de `45,156,255`/`255,62,165`/`200,255,61`/`50,215,255`/`51,166,255` (este último, un typo de paleta preexistente) a los RGB nuevos | `styles.css:root` + 24 reglas puntuales | Manual + captura (verde/azul en selector, cancha, Historial, Confirmar partido, Resumen) |
| 3 | §4 — degradé sutil exclusivo del Home, sin look "galaxia" | `#view-player-home{ background: linear-gradient(180deg, var(--surface-2), var(--bg), var(--bg-deep)) }` — mismos tokens de superficie de siempre | `styles.css:#view-player-home` | Manual + captura |
| 4 | §5 — Actividad: victorias abajo, derrotas arriba (lógica temporal SIN tocar) | `.activity-bar` pasa de `flex-direction:column` a `column-reverse` — mismo HTML/JS de V02.4, ningún cambio de cálculo | `styles.css:.activity-bar` | Manual + captura; tests V02.3-ACT/V02.4-ACT-SEG sin tocar, siguen verdes |
| 5 | §6 — punto y guion del marcador ópticamente centrados; punto más grande que V02.4 | `.lastmatch-score__dash`/`__dot` ganan `vertical-align:middle` (el bug real: por default caían al baseline de la fuente, no al centro óptico); punto 0.75em→0.9em | `styles.css:.lastmatch-score__dash/__dot` | Manual + captura + estilos computados (360/402px) |
| 6 | §7 — KPIs "Tu historial" con geometría idéntica | **Hallazgo real**: "Partidos totales" (única sin `.pastilla--link`) no tenía el wrapper `.pastilla__title-row`, dejando su fila de label más baja que las otras 3 (sin la altura que aporta el chevron) → el dato principal arrancaba en Y distinto. Se agregó el wrapper + `.player-home-widgets-grid .pastilla__title-row{ min-height:18px; margin-bottom:0 }` acotado a esta grilla | `index.html`/`styles.css` | Manual + medición en vivo (`valueTop` de las 4 tarjetas, 41-43px vs. 47px de una wrappeada con label de 2 líneas — variación esperada por contenido, no por estructura) |
| 7 | §8 — ícono de Historial inequívoco | **Hallazgo real**: el ícono anterior dibujaba la manecilla como un sub-path UNIDO (mismo color) al círculo sólido — sin contraste posible, se veía como una mancha lisa. Reemplazado por trazo (círculo + manecillas), única excepción de estilo en esta barra (los demás íconos son siluetas sólidas) | `index.html`/`styles.css:.bottom-nav__icon--history` | Manual + captura |

### Bloque B — Carga manual: fecha, jugadores y set

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 8 | §9 — investigar causa de fechas incorrectas ANTES de tocar UI | Ver §2 de este informe (hallazgo completo) | — | Tests `V02.5-FECHA` (7 casos) |
| 9 | §10 — fila fecha/hora con jerarquía equivalente a formato/reglas | `.court-meta-line` pasa de fondo transparente + texto gris apagado a fondo `--court-surface` + texto blanco/peso 700 — mismo tratamiento que `.load-format-line` | `styles.css:.court-meta-line` | Manual + captura |
| 10 | §11 — Fecha y Hora con la misma geometría, Hora nunca corrida | **Hallazgo real** (bug reproducible): `.field + .field{ margin-top:8px }` (pensada para formularios apilados verticalmente) alcanzaba también a Fecha/Hora por ser hermanos adyacentes en el DOM aunque visualmente están lado a lado en una fila flex — Hora quedaba SIEMPRE 8px más abajo. Se anula con `.manual-datetime-row .field + .field{ margin-top:0 }` | `styles.css:.manual-datetime-row` | Manual + medición en vivo (`top` de ambos campos: 977 vs. 985 → 648 vs. 648 tras el fix) |
| 11 | §12 — selector de jugador: sheet a 70-75%, categoría reutilizable, búsqueda completa, filas verticales avatar+Nombre+@usuario | Nueva `.bottom-sheet--tall` (72dvh, nunca confundida con `.bottom-sheet--compact` de Registrar partido — no tocada); nuevo `.player-search-field` (contenedor delimitado + ícono + foco contextual verde/azul); nuevo componente `.player-row` (avatar 48px + nombre 700 + `@handle` derivado con `buildPlayerHandle`, mismo criterio que el jugador actual) compartido por RECIENTES y TODOS | `index.html`; `app.js:buildPlayerRowHTML`, `openManualPlayerSheet`, `renderManualPlayerSheetContent`; `styles.css` | Manual + captura + medición en vivo (72% de alto) |
| 12 | §13 — pantalla de carga del set con más profundidad, Equipo A verde/B azul, sin magenta | Color automático por el token (ítem 2); **superficie**: `.view--court` (Carga manual + Confirmar partido, nunca el partido en vivo — clase distinta) redefine `--court-surface`/`--court-surface-2` un escalón más arriba en la MISMA escala de superficies, sin tocar el alias global que usan los sheets | `styles.css:.view--court` | Manual + captura |

### Bloque C — Guardado, notas y Resumen manual

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 13 | §14 — Notas deja de ser paso obligatorio; Guardar va directo a Resumen | Se elimina la tarjeta de notas completa (`.court-note`/textarea) de `view-match-saved`; el handler de GUARDAR PARTIDO ya no lee ni pisa `privateNote` (una edición preserva la nota existente, un alta nueva arranca sin nota) | `index.html`; `app.js` (handler de `#match-saved-view-summary`) | Manual, verificado en vivo (`hasNoteCard:false` en Confirmar partido) |
| 14 | §15 — tarjeta de notas en Resumen: candado + "NOTAS PRIVADAS", sin "SOLO VOS" ni "Los datos viven..." | Label actualizado, párrafo técnico eliminado, placeholder vacío → "Agregar una nota" | `index.html`; `app.js:renderAnalysisNoteDisplay` | Manual + captura |
| 15 | §16 — sin "PARTIDO CARGADO" ni texto técnico en el Resumen (Historial SÍ lo conserva) | `buildMatchMetaLine` (único consumidor real: `#analysis-meta`, Historial arma la suya por separado) deja de agregar `modeLabel` para `mode==='manual'`; `buildCoverageLegalHTML` devuelve `''` para `f.mode==='manual'` | `app.js:buildMatchMetaLine`, `buildCoverageLegalHTML` | Manual + captura (meta line sin "PARTIDO CARGADO"; Historial confirmado SIN cambios en la misma sesión) |
| 16 | §17 — compactar nombre↔resultado en la tarjeta principal | **Hallazgo real**: `.result-card__name{flex:1}` + fila en `justify-content:space-between` empujaban el marcador al borde derecho de la tarjeta, dejando un hueco enorme para nombres cortos. Nombre pasa a `flex:0 1 auto; max-width:62%` (elipsis si hace falta), fila a `justify-content:flex-start` — resultado queda pegado al nombre con el mismo `gap` de siempre | `styles.css:.result-card__row/__name` | Manual + captura + medición en vivo (gap exacto: 10px) |
| 17 | §18 — Sets/Games ganados en filas, A verde/B azul, mejor legibilidad | Color ya automático por token; números 16→17px, padding de la fila con un poco más de aire — estructura de grid de 3 columnas (ya alineaba correctamente) sin cambios | `styles.css:.summary-stat-row*` | Manual + captura |
| 18 | §19 — BRAMU Intelligence intacto | Sin cambios de contenido/motor; verificado que el layout de alrededor no lo rompe | — | Manual (verificado en el mismo recorrido de Resumen) |

### Bloque D — Consistencia, regresiones y validación

| # | Requisito | Implementación | Prueba |
|---|---|---|---|
| 19 | §20 — sheet Registrar partido sin cambios (sigue a ~35%) | No tocado (`.bottom-sheet--compact` intacta) | Medido en vivo: 306px / 35% de 874px, igual que V02.4 |
| 20 | §21 — fuera de alcance respetado | BRAMU Intelligence, reglas deportivas, registro en vivo, Ranking, Notificaciones, Historial (salvo ícono/tokens), cálculos de Nivel/Actividad/Efectividad/Tu momento, esquema de datos — ninguno tocado salvo lo explícitamente autorizado | Ver §5 "Qué no se tocó" |

---

## 2. Investigación de fechas incorrectas (§9 — obligatoria antes de tocar UI)

**Causa encontrada:** V02.1 (ronda anterior, mismo repositorio) ya había encontrado y corregido un bug real: el prefill de fecha para un partido NUEVO mezclaba `now.toISOString().slice(0,10)` (fecha en **UTC**) con `getHours()/getMinutes()` (hora **local**). Durante la ventana horaria en la que el calendario UTC ya rotó pero el local todavía no (en Argentina, aprox. 21:00–23:59), esa combinación producía un `playedAt` hasta 24 horas adelantado — un partido jugado un día quedaba guardado como si fuera del día siguiente.

Ese fix (`localDateInputValue`/`localTimeInputValue`, 100% locales) **sigue vigente y correcto hoy** — se revisó el código completo de construcción/edición de `playedAt` (prefill de alta nueva, prefill de edición vía `Intl.DateTimeFormat` con la zona ORIGINAL del partido, y los 3 puntos donde se reconstruye el instante a partir de los campos) y no se encontró ningún bug NUEVO ni reintroducido.

**Conclusión:** los partidos con fecha rara que el usuario ve hoy son datos **viejos**, cargados **antes** del fix de V02.1, nunca migrados con retroactividad — decisión correcta entonces y ahora: no hay forma de distinguir con certeza cuáles fueron víctimas del bug de cuáles el usuario cargó a propósito con otra fecha. Siguiendo la instrucción explícita del consolidado ("no inventar migraciones"), **no se tocaron datos existentes**.

**Endurecimiento aplicado de todos modos** (consolidación, no una corrección de bug nuevo): la construcción de `playedAt` desde los campos de la pantalla estaba duplicada 3 veces en `app.js` como `new Date(\`${dateVal}T${timeVal}\`)` (funcionalmente correcta, pero nunca testeada ni centralizada). Se extrajo a una función pura nueva, `ML.buildPlayedAtFromLocalFields(dateVal, timeVal)` (`match-load.js`), que arma el instante con el constructor de `Date` por componentes numéricos (`new Date(y, m, d, h, mi)` — interpretación local sin ninguna ambigüedad de parsing de string) en vez de concatenar un string. Los 3 call sites de `app.js` (alta nueva, "Modificar" sobre un partido ya guardado, y el guardado final desde Confirmar partido) pasan a usarla. **Efecto colateral corregido**: "Modificar" sobre un partido ya guardado no actualizaba el campo `timeZone` del registro (solo `buildManualMatchSnapshot`, usado al crear/editar el resultado, lo hacía) — inconsistencia latente que solo se manifestaría si el dispositivo cambiara de huso entre la carga y una edición posterior (no aplica al uso real de un único dispositivo en Argentina, sin horario de verano, pero se corrige por prolijidad ya que se tocó esta misma función).

7 tests nuevos (`V02.5-FECHA`) blindan el invariante que el bug de V02.1 rompía: cualquier fecha/hora local que se le pida a `buildPlayedAtFromLocalFields` vuelve exactamente como el mismo día/hora local al leerla de vuelta, sin importar el huso horario real del dispositivo que corre el test (incluye el caso exacto 23:30, el borde de año nuevo y fin de año, hora vacía → `timeKnown:false`/asume 00:00 local, y fecha vacía → `null`).

---

## 3. Decisiones y desvíos justificados

- **Foco del buscador de jugador — verde/azul CONTEXTUAL, no azul fijo.** El consolidado pide "foco claro con azul BRAMU" (§12.2) para el campo de búsqueda nuevo, pero no menciona el sistema de acento contextual por rol (verde para Compañero/Equipo A, azul para Rival/Equipo B) que V02.3 ya había implementado y que ningún bloque de V02.5 pide retirar. Se interpretó "azul BRAMU" como el color que corresponde según el rol que se está eligiendo — literalmente azul para Rival (Equipo B), y verde (igual de "BRAMU") para Compañero (Equipo A) — preservando el sistema ya aprobado en vez de aplanarlo a un solo color fijo. No bloqueaba la implementación; se documenta como decisión, no como contradicción.
- **`--court-surface`/`--court-surface-2` redefinidos SOLO dentro de `.view--court`.** El consolidado pide más diferencia de superficie en "la pantalla de carga del set" (§13.3) sin mandar a redefinir la escala global. Como esas variables son alias compartidos con los bottom sheets (`.bottom-sheet` también usa `--court-surface`), subir el valor en `:root` habría aclarado TODOS los sheets de la app, no solo la pantalla pedida. Se optó por redefinir las variables dentro del selector `.view--court` (que agrupa Carga manual y Confirmar partido — nunca el partido en vivo, que usa `.view--match`, una clase distinta) — mismo truco de cascada de variables CSS, alcance exactamente acotado a lo pedido.
- **`buildCoverageLegalHTML`/`buildMatchMetaLine` comparten código con la función de "compartir" (retirada de la UI desde V02.2).** Ambas funciones también alimentan `share-capture`, una capacidad técnica que existe en el código pero no tiene ningún botón que la dispare (confirmado en el Informe V02.2). El cambio de texto para `mode==='manual'` alcanza igual a ese código muerto — sin efecto visible para ningún usuario real, no se dupliquen funciones para evitarlo.

---

## 4. Tests automáticos (§22)

**565/565 tests OK — todo verde** (`tests.html`), 558 preexistentes + 7 nuevos:

- **V02.5-FECHA** (7 casos) — `ML.buildPlayedAtFromLocalFields`: round-trip exacto para 23:30 (el caso puntual del bug histórico de V02.1), año nuevo y fin de año (bordes de mes/año), `timeKnown` correcto con y sin hora, asume 00:00 local sin hora (nunca corrido a UTC), y `null` sin fecha.

Se mantuvieron sin tocar (§22.2, cumplido): los tests temporales de Actividad de V02.3 (`V02.3-ACT`) y los de progreso de Nivel/segmentos de Actividad de V02.4 (`V02.4-NIVEL`, `V02.4-ACT-SEG`) — ninguno de los dos cálculos cambió en esta ronda (solo el orden VISUAL de Actividad, vía CSS).

No se agregaron tests para el selector de jugador (§22.4): no se extrajo lógica pura nueva de selección/orden — el rediseño fue puramente de presentación (`buildPlayerRowHTML` arma HTML a partir de nombres ya resueltos por `ML.computeRecentPlayers`/`filterPlayerCandidates`, sin cambios de esa lógica pura, ya cubierta por los tests `V02.2-SEL` existentes).

---

## 5. Validación visual (§23)

Ejecutada en vivo contra `.claude/dev-server.py`, viewport móvil de referencia (402×874) y 360px donde podía existir overflow (marcador de Último partido).

**5 capturas** (dentro del máximo sugerido), una por punto pedido:

1. **Home completo** — degradé sutil, Actividad con victorias abajo/derrotas arriba (4 barras con volumen y mezcla distintos), Último partido (verde, marcador con punto/guion corregidos), Nivel BRAMU, ícono de Historial (reloj con manecillas), navegación inferior.
2. **Carga manual con Equipo A/B + bloques editables** — Equipo A verde/Equipo B azul, fila de formato y fila de fecha/hora con la MISMA jerarquía visual, tres pastillas de set (V02.4) sin cambios, superficies con más profundidad que V02.4.
3. **Selector de compañero** — sheet a 72% de alto, campo de búsqueda completo con ícono y foco verde (contexto Compañero), lista vertical RECIENTES con avatar 48px + nombre en negrita + `@usuario`, separador antes de la lista completa.
4. **Sheet Fecha, hora y lugar** — Fecha y Hora perfectamente alineadas (mismo `top`, mismo alto de campo — antes Hora quedaba 8px más abajo).
5. **Resumen manual** — marcador compacto (nombre y resultado pegados, sin hueco), filas SETS GANADOS/GAMES GANADOS en verde/azul, BRAMU Intelligence intacto, tarjeta "NOTAS PRIVADAS" con "Agregar una nota" (sin "SOLO VOS" ni el texto técnico), sin "PARTIDO CARGADO" en la meta line, EDITAR PARTIDO/VOLVER AL INICIO sin cambios.

**Verificaciones adicionales sin captura** (resueltas con DOM/estilos computados, según autoriza §23): Nivel BRAMU forzado a 6.9 (90%) sin que la pastilla de variación desborde el borde derecho; Registrar partido medido en 306px/35% de un viewport de 874px, idéntico a V02.4; Historial confirmado con "PARTIDO CARGADO" intacto en la MISMA sesión (contraste directo con su ausencia en Resumen); selector de jugador con 2 sets y a 360px sin overflow del marcador de Último partido (44px→40.68px vía el `clamp()` de V02.4, sin cambios).

**Regresión:** sin errores de consola de aplicación en todo el recorrido (el único error observado, `Service Worker: An unknown error occurred when fetching the script`, es una limitación puntual de este entorno de sesión — no del código; ver desvío ya documentado en Informes V02.3/V02.4). Flujo completo recorrido de punta a punta: selección de 4 jugadores por el selector rediseñado → carga de 3 sets → pausa "Resultado válido" → Confirmar partido (sin notas) → GUARDAR PARTIDO → Resumen (con notas opcionales, sin textos técnicos) → Historial (sin cambios) → Perfil (sin errores).

---

## 6. Criterios de aceptación (§24) — verificados

Sistema visual, Home, Carga manual, Guardado/Resumen y Regresión: **todos los ítems del checklist del consolidado se verificaron true** durante el recorrido de §5 y las mediciones en vivo citadas en la matriz de §1. No se detectó ningún criterio incumplido.

---

## 7. PWA, versión y publicación (§25)

- `Store.VERSION`: `"BRAMUlab V02.4"` → **`"BRAMUlab V02.5"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-4` → **`bramulab-v02-5`**.
- **Commit de implementación (código):** `e85de14f2177e699ba17eb3356c43a3664359f88` — mensaje `"BRAMUlab V02.5 · dupla cromática verde/azul, selector de jugador y Resumen sin fricción"`.
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 8. Hash exacto y tag (registro final)

- Commit de implementación (código): `e85de14f2177e699ba17eb3356c43a3664359f88`.
- Commit de este informe (matriz, tests, recorrido) y del README actualizado: ver el commit inmediatamente posterior a este archivo en el historial de `main`.
- Tag `BRAMUlab_V02.5` apunta al commit que deja registrados ambos hashes (un commit no puede citar su propio hash) — el código funcional completo de V02.5 es íntegramente el de `e85de14`; ese commit posterior no modifica ningún archivo de `bramulab/`.

---

## 9. Qué no se tocó (confirmado, §21 del consolidado)

BRAMU Intelligence / motor de análisis, reglas deportivas (`engine.js` sin cambios), registro en vivo por games o punto a punto (`.view--match`, sin cambios de ningún tipo — ni siquiera de color, al usar una clase distinta de `.view--court`), Ranking, Perfil (sin cambios salvo la propagación automática de tokens de color, efecto colateral explícitamente autorizado), Notificaciones, Historial como pantalla (sigue mostrando "PARTIDO CARGADO", verificado en la misma sesión — solo cambiaron el ícono de navegación y los colores heredados por token), cálculos de Nivel BRAMU/Actividad/Efectividad/"Tu momento" (`player-home.js` sin cambios de lógica), esquema de `localStorage` (sin migraciones, sin `localStorage.clear()`), sheet Registrar partido (sigue en `.bottom-sheet--compact`, ~35%, sin tocar). No se creó una carpeta `V02.5` — este informe vive en `Versiones/BRAMUlab_V02/`, junto al resto de la subversión.
