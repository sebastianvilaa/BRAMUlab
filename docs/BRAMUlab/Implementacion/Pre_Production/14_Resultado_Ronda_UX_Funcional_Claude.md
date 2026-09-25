# BRAMUlab — Resultado · Ronda UX 25/09 (Bloque 1 — funcional/estado)

**Rama:** `staging`
**Fecha:** 25/09/2026
**Handoff de origen:** `docs/BRAMUlab/Implementacion/Pre_Production/13_Handoff_Implementacion_Ronda_UX_25SEP.md` (Ronda 1 — corrección funcional/estado, §7)
**Fuente de detalle:** `05_Laboratorio_UX_Uso_Real.md` §15.2–§15.22

---

## 1. Diagnóstico técnico breve

Los siete puntos pedidos (A/F/G/I/L/M/N) eran, en su mayoría, bugs reales de **presentación/estado**, no de datos: el backend (Bloques 1–8, ya cerrados) ya tenía la información correcta — el problema era que `app.js` no la usaba, o usaba un dato equivocado para decidir qué mostrar.

Hallazgos centrales antes de tocar código:

- **§A** — `renderPlayerLastMatchCard`/`renderHistory` ya ponían la pareja propia primero en los **nombres**, pero seguían pasando `m.sets` (orden canónico A/B) sin invertir al `buildLastMatchScoreHTML`/`buildCanonicalScoreLineHTML` — el bug exacto que describe el Laboratorio §15.7 (nombres invertidos, score no).
- **§F** — la hoja de corrección (`openProposeCorrection`) renderizaba exactamente `(f.sets||[]).length` inputs y validaba cada uno a mano con `E.isValidCompletedSetScore`, sin usar `ML.isThirdSetVisible`/`ML.validateMatchSets` (las mismas funciones puras que ya usa Cargar partido) — por eso nunca podía agregar un Set 3 a una corrección de un partido cargado con 2 sets.
- **§G** — `get_match_detail` YA devuelve `currentRevisionNumber` y `actions[].actorPlayerId`, pero `translateServerMatchToLocalShape` (match-sync.js) nunca los exponía — sin ese dato, `paintB6Actions` no podía distinguir "esta revisión pendiente es una corrección" de "es la carga original".
- **§I** — mismo problema de raíz: sin `actionsRaw`/`currentRevisionNumber` en la lista liviana (`get_my_matches`), la Home no puede saber con certeza qué pasó — se corrigió evitando la afirmación falsa en vez de inventar una certeza que el contrato no da.
- **§L** — la píldora `NIVEL CALIBRADO` (`levelV1BadgeHTML`) era una decisión visual explícita de V04.9 que no sobrevivió al uso real en iPhone (Laboratorio §15.21).
- **§M** — se rastreó el camino completo de "Evolución del Nivel BRAMU": el único gráfico real de esa tarjeta (`#evolution-chart-wrap`) se alimenta EXCLUSIVAMENTE del motor simulado legacy (`PH.computeLevelEvolution`), nunca de `level_events`/Nivel V1. Para una cuenta V1 calibrada no existe ningún camino real que graficar hoy.
- **§N** — el selector server-backed de Cargar partido (`renderManualPlayerSheetContentServerBacked`) mostraba Invitados + búsqueda por texto, pero nunca "Recientes" reales — el comentario original decía explícitamente "sin Recientes todavía... Bloque 5 no existía"; Bloque 5 ya está cerrado, el dato ya existe.

No fue necesaria ninguna migración/RPC nueva: en los siete puntos, el contrato de backend ya alcanzaba (ver §6 para el único caso límite, documentado como quedó fuera).

---

## 2. Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `bramulab/app.js` | Núcleo de la ronda: orientación de score (§A), hoja de corrección dinámica (§F), copies contextuales de Resumen/Home/Notificaciones (§G/§I), remoción de píldora CALIBRADO + ocultamiento de Evolución (§L/§M), RECIENTES server-backed (§N) |
| `bramulab/player-home.js` | `PH.computeRecentRealPlayers` (nueva, pura) — RECIENTES por `player_id` |
| `bramulab/match-sync.js` | `currentRevisionNumber`/`revisionCount` expuestos en `translateServerMatchToLocalShape` (ya venían de `get_match_detail`, nunca se mapeaban) |
| `bramulab/index.html` | botón "ACEPTAR CORRECCIÓN", `id="evolution-card"`, bump de bundle en los `<script src>` |
| `bramulab/styles.css` | `.b6-correction-set[hidden]` (Set 3 dinámico), remoción de `.level-v1-badge` (huérfana tras §L) |
| `bramulab/store.js` | `BUNDLE_VERSION` → `04.11-h2` |
| `bramulab/sw.js` | `CACHE_NAME`/`CORE_ASSETS` → `04.11-h2` |
| `bramulab/version.json` | `bundle` → `04.11-h2` |
| `bramulab/tests.html` | 8 aserciones nuevas para `PH.computeRecentRealPlayers` (homónimos, exclusión, límite, orden) |

Sin cambios en `bramulive/`, `main`, Production, Mis grupos, responsive de escritorio, Realtime/polling, fórmula de Nivel, reglas de Ranking ni la lista legacy de JUGADORES por nombre.

---

## 3. Qué quedó implementado

### A — Perspectiva personal
`orientMatchForTeam(sets, currentPartial, team)` (nueva, app.js): overlay puro que invierte `gamesA/gamesB/tiebreak/winner` cuando `team==='B'`, sin tocar el dato guardado. Aplicado en `renderPlayerLastMatchCard` (Home) y `renderHistory` — ambas ya resuelven `myTeam`/`firstTeam` vía `PH.getPlayerTeam` y ahora también orientan el score con la misma función. Resumen/Confirmar partido (`buildScoreCardHTML`) **no se tocó**: sigue en orden canónico A/B, como pide el handoff.

### F — Corrección de resultado
La hoja reutiliza `ML.isThirdSetVisible` (recalculado en cada `input`) para mostrar/ocultar el Set 3 exactamente con el mismo criterio que Cargar partido, y `ML.validateMatchSets` como único validador (mismo mapa de mensajes `MANUAL_ERROR_MESSAGES`). Prellenada con el score actual. Feedback de éxito: toast más largo (3200ms) y explícito ("Corrección enviada. Esperando confirmación de la otra pareja.").

### G — Recepción de una corrección
Pre-validación: `paintB6Actions` distingue `currentRevisionNumber > 1` y cambia banner + botón a "ACEPTAR CORRECCIÓN" con el actor real. Post-validación: el flujo ya existente (`respondBlock`) ahora nombra al actor real (antes: pareja genérica) y el botón dice "ACEPTAR CORRECCIÓN" (antes: "ACEPTAR"). Revisión append-only intacta — no se tocó ninguna RPC ni la lógica de negocio, solo lectura de campos ya existentes.

### I — Eventos y copies contextuales
- Resumen: actor real vía `b6RevisionProposerName(f)` (busca `actorPlayerId` de la última `revision_proposed` en `f.actionsRaw`, resuelve el nombre en `f.players`).
- Home: se retiró la afirmación falsa "X registró un partido..." (podía ser una corrección o una identidad resuelta, Laboratorio §15.7/§15.12) por un copy neutro y siempre verdadero.
- Notificaciones: `correction_proposed` arma su body con el nombre real del proponente, resuelto sin llamada de red nueva (`resolvePlayerNameFromMatchesCache`, busca en `Store.loadServerMatchesCache()` ya en memoria).

### L — Nivel 5/5
Sin píldora `NIVEL CALIBRADO` en Home ni Mi Perfil una vez calibrado — la tarjeta vuelve a su composición normal (identidad + Nivel numérico). `levelV1BadgeHTML` y `.level-v1-badge`/`.level-v1-badge--calibrated` quedaron huérfanos y se eliminaron.

### M — Evolución del Nivel BRAMU
Una vez calibrado (`isCalibrated`), la tarjeta `#evolution-card` completa queda oculta — nunca el copy falso "es una primera referencia...". Mientras sigue CALIBRANDO, la tarjeta se conserva sin cambios (ese copy ahí sí es verdadero).

### N — Recientes server-backed
`PH.computeRecentRealPlayers(history, playerRef, excludeIds, limit)`: recorre `getDisplayHistory()` (cualquier estado, ya en memoria), identidad exclusivamente por `player_id` (`m.players[].userId`), excluye slots sin cuenta real (provisional/"por identificar") y al propio jugador. Sección "RECIENTES" nueva en el sheet server-backed de Cargar partido, visible solo sin búsqueda activa (nunca duplica con `search_players`).

---

## 4. Qué no se implementó y por qué

- **G — línea "qué cambió" (ej. `Set 2: 6–3 → 6–4`)**: el contrato actual de `get_match_detail` solo devuelve los sets de la revisión **vigente**, nunca los de la revisión anterior — no hay forma de armar el diff sin un cambio de backend (agregar `previousSets`, condicionado a `currentRevisionNumber > 1`). Esta sesión no tiene acceso real a Supabase Staging (sin Supabase CLI ni credenciales en este entorno) para escribir y **verificar** una migración nueva contra la base real, así que se decidió no tocar backend en esta ronda — coherente con "no tocar el backend si el contrato actual alcanza" y con no poder probarla. El resto de G (actor real, framing de corrección, CTA) quedó completo sin backend nuevo.
- **I — Notificaciones persistidas sin actor** (`match_validated`, `correction_accepted`, `identity_resolved`, `identity_unidentified`, `admin_action`): sus payloads (`insert into notifications`, Bloque 6) no incluyen un `player_id` de actor — solo `correction_proposed` lo trae. Nombrar al actor en el resto exigiría una llamada adicional por notificación o un cambio de payload en varias RPCs. Se dejaron con su copy genérico ya existente (tipo-diferenciado, nunca atribuye una acción falsa) en vez de ampliar el alcance de backend de esta ronda.
- **H (identidad incorrecta)**: explícitamente fuera de esta ronda ("no tocar en lo esencial"). No se tocó.

---

## 5. Tests

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS** (sin cambios respecto de antes de la ronda).
- `bramulab/tests.html` (navegador embebido, servido con `python3 -m http.server`) → **1486/1486 PASS** (1478 previos + 8 aserciones nuevas de `PH.computeRecentRealPlayers`: orden por más reciente, no-duplicado, autoexclusión, ignora partidos ajenos, excluye slots sin `userId`, respeta `excludeIds`, respeta el límite, protege homónimos con `player_id` distinto).
- Boot smoke test: `index.html` cargado en el navegador embebido con el bundle `04.11-h2` — todos los módulos (`app.js`, `player-home.js`, `match-sync.js`, etc.) cargan 200 OK, sin errores de consola nuevos (el único 404 — `env.generated.js` — es preexistente y esperado sin Supabase configurado en este entorno local).

**No verificado desde esta sesión** (requiere backend Supabase Staging real + al menos dos cuentas, no disponible en este entorno sandbox — mismo patrón que toda ronda anterior de este proyecto, siempre validada por Work/iPhone contra Staging real):
- recorrido visual completo de §A (mismo partido desde Team A y Team B reales);
- §F end-to-end (proponer corrección 2↔3 sets contra el backend real);
- §G/§I en vivo (recepción de corrección real, notificación real con actor);
- §L/§M con una cuenta real pasando 4/5 → 5/5;
- §N con relaciones reales de partidos compartidos.

---

## 6. Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios — esta ronda no abre una versión nueva de Nivel).
- Bundle técnico: `04.11-h1` → **`04.11-h2`**.
- Sincronizados: `bramulab/version.json`, `Store.BUNDLE_VERSION`, todos los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## 7. Migraciones / RPC

Ninguna. El contrato vigente alcanzó para los siete puntos implementados (ver §4 para el único caso donde no alcanzó — `previousSets` de G — deliberadamente diferido).

---

## 8. Riesgos residuales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Sin verificación en vivo | Ningún punto de esta ronda se probó contra Supabase Staging real ni con más de una cuenta | Pendiente de QA real (Work/iPhone) antes de considerar la ronda cerrada |
| G — diff "qué cambió" ausente | El receptor de una corrección ve el resultado actualizado en la tarjeta de score, pero no una línea explícita de "antes → después" | Requiere `previousSets` en `get_match_detail` (migración mínima, aditiva) en una ronda con acceso real a Staging |
| I — notificaciones sin actor en 5 de 6 tipos | Copy genérico pero nunca falso (tipo-diferenciado) | Requiere decidir entre N llamadas adicionales o ampliar payloads de varias RPCs — evaluar en la ronda de Notificaciones (Ronda 2 del handoff 13) |
| `.level-v1-badge` eliminada de CSS | Dos comentarios de contexto en `index.html` (líneas ~587/1140) siguen mencionando la clase por nombre, como referencia histórica | Sin riesgo funcional (son comentarios, no selectores); no se tocaron para no inflar el diff |

---

## 9. Decisiones abiertas

Ninguna decisión de producto nueva. La única `DECISIÓN ABIERTA` real que toca esta zona del código (autor del partido cuestionado, §15.2 del Laboratorio) pertenece al punto H, explícitamente fuera de esta ronda — no se reabrió.

---

## 10. Qué debe revisar ChatGPT central

1. HEAD de `staging` (diff + este documento) antes de autorizar el bloque visual grande (Ronda 2 del handoff 13).
2. Confirmar que el criterio de §4 (no tocar backend sin poder verificarlo en Staging real desde esta sesión) es aceptable, o indicar si debe programarse una ronda de backend acotada para `previousSets` antes de la Ronda 2.
3. Programar la QA real (Work/iPhone) de los 7 puntos contra Staging — esta sesión no pudo ejecutarla.

No se pidió a Sebastián validación manual, por instrucción explícita del handoff. Frenado después del push, a la espera de la revisión de central.
