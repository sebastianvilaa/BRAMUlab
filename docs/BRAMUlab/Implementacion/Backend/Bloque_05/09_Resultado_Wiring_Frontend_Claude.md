# Backend Bloque 5 — Resultado del wiring frontend

**Fecha:** 20/09/2026
**Rama:** `staging`
**HEAD de partida:** `8c56c01` (`08_Validacion_Backend_Staging_ChatGPT.md`, backend ya validado contra Supabase Staging real)
**Documento seguido:** el pedido de wiring de esta ronda (13 puntos) + `08_Validacion_Backend_Staging_ChatGPT.md` como fuente de verdad del contrato de red (RPCs, códigos de respuesta, columnas de `get_my_matches`/`get_match_detail`). No se repitió ninguna prueba SQL/backend ya cubierta ahí.

Este documento registra el wiring de **frontend** que conecta "Cargar partido jugado" y el Historial con el backend real de partidos compartidos. No se tocó ninguna migración, RPC ni Edge Function — solo `bramulab/*.js`, `styles.css`, `index.html`, `sw.js` y `tests.html`.

**Estado: implementado y verificado con tests unitarios (1443/1443) + verificación manual en navegador local (sin Supabase real disponible en este entorno — ver §6).**

---

## 1. Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `bramulab/match-sync.js` | **Nuevo.** Único punto de traducción servidor→forma local + separación historial/estadísticas. Puro (sin DOM/red/storage). |
| `bramulab/matches.js` | Ya existía de una ronda anterior; esta ronda solo agregó `normalizeMyMatchesRow` (snake_case→camelCase de `get_my_matches`) dentro de `getMyMatches`. |
| `bramulab/store.js` | Agregado `SERVER_MATCHES_CACHE` + `loadServerMatchesCache`/`saveServerMatchesCache`. Aclarado (sin cambiar lógica) el comentario de `saveMatchOutboxEntry`: reemplaza la entrada entera, nunca la mergea con lo ya guardado — cada call-site de app.js ya hacía `Object.assign({}, entryExistente, {...})` correctamente. |
| `bramulab/app.js` | El grueso de esta ronda: selector de participantes server-backed, flujo de guardado con outbox, interpretación de respuesta de `create_or_attach_match`, modal de desambiguación, `getDisplayHistory`/`getComputableHistory` como los DOS únicos puntos de lectura de historial, hide/nota server-backed, badge de estado en Historial. |
| `bramulab/index.html` | +`matches.js`/`match-sync.js` a los `<script>`, +modal `#ambiguous-match-overlay`, versión `?v=` de todos los assets `04.10-h11`→`04.10-h12`. |
| `bramulab/sw.js` | `CACHE_NAME` → `bramulab-v04-10-h12`, `CORE_ASSETS` con las mismas dos entradas nuevas y el mismo bump de versión. `Store.VERSION`/`version.json` **no** cambiaron (regla de las rondas de Backend/Infraestructura). |
| `bramulab/styles.css` | Un solo selector nuevo: `.history-item__badge--pending` (tono neutro `--text-dim`, nunca lima/coral). |
| `bramulab/tests.html` | +`match-sync.js` al arnés, +29 tests nuevos (`BLOQUE5-*`). |

---

## 2. Cómo funciona el flujo real

### 2.1 Selector de participantes (punto 2 del pedido)

`openManualLoadScreen` fija `manualServerBacked = isServerBackedSession()` (mismo choke point que ya usa el resto de la app desde Bloque 2: `Auth.isConfigured() && user.serverBacked`). Con backend real, `renderManualPlayerSheetContent` delega en `renderManualPlayerSheetContentServerBacked`, que combina en paralelo:

- `Matches.listRelatedProvisionalPlayers()` — provisionales creados por el caller o que ya compartieron un partido con él (nunca el universo global de provisionales de otra persona);
- `Auth.listMyProvisionalPlayers()`;
- `Auth.searchPlayers(query)` (solo con 2+ caracteres) — cuentas reales.

La identidad de cada slot se resuelve **siempre por `player_id`** (`manualPlayerIds[slot] = {playerId, kind}`), nunca por nombre — dos personas con el mismo nombre real nunca se fusionan. El camino local/legacy (sin backend) sigue exactamente igual que antes (mismo código, sin tocar).

### 2.2 Guardado con outbox e idempotencia (punto 3)

`finalizeManualContinue` ahora obliga a TODA carga server-backed a pasar por la pantalla de Confirmar (antes algunas rutas locales guardaban directo). Al tocar "Guardar":

1. Se genera (o reutiliza) `manualSubmissionId` — la `idempotencyKey` de este intento lógico.
2. **Antes de llamar a la red**, se guarda el intento en el outbox local (`Store.saveMatchOutboxEntry`, estado `sync_pending`) — así un cierre de la app o una caída de red a mitad de camino nunca pierde el partido.
3. Se llama `Matches.createOrAttach(...)` (Edge Function `create-or-attach-match`).
4. `handleCreateOrAttachOutcome` (punto único de interpretación, compartido con el reintento automático) decide:
   - **éxito** (`created`/`matched_confirmed`/`matched_already_confirmed`/`matched_same_side`/`matched_revised`/`already_validated`) → saca la entrada del outbox, refresca el cache de `get_my_matches`, navega al Resumen real;
   - **`ambiguous_candidates`** → outbox pasa a `necesita_revision`, se abre el modal de desambiguación (punto 7 — ver §2.4);
   - **error de negocio real** (`MATCH_BUSINESS_ERROR_CODES` — repetido, formato inválido, límite de 5 pendientes, fecha fuera de rango, etc.) → outbox pasa a `necesita_revision`, toast explicando el motivo, vuelve al formulario;
   - **cualquier otra cosa** (red caída, `rate_limited`, 5xx) → se trata como **transitorio**: el outbox queda `sync_pending` tal cual, se muestra un Resumen local con badge "PENDIENTE DE SINCRONIZACIÓN" para que el usuario nunca sienta que "se perdió" el partido.

Reintento: `retryMatchOutbox()` corre al reanudar sesión y en `window.addEventListener('online', ...)`. Reintenta cada entrada `sync_pending` con la **misma** `submissionId` — nunca genera una nueva. Solo una respuesta a una desambiguación (`resolveAmbiguousMatch`/`forceNewFromAmbiguous`) genera una `idempotencyKey` nueva, porque ahí el intento lógico cambió (trae información que el original no tenía).

### 2.3 Historial compartido y separación historial/estadísticas (puntos 4 y 5)

Toda la separación vive en **dos funciones** (app.js), el único par de puntos de lectura de historial que debe usar cualquier pantalla nueva:

- `getDisplayHistory()` — local legacy + server-backed en CUALQUIER estado + outbox. Para Historial y para "Último partido" (que debe poder mostrar un pendiente, ver `Experiencia_Inicial.md` §22.B).
- `getComputableHistory()` — local legacy completo + SOLO server-backed `validated` (hoy, ninguno — Bloque 5 nunca escribe ese estado). Para Nivel/Efectividad/Racha/Compañero-Rival/Ranking/Tu Momento/Mis Grupos.

Sin backend configurado, ambas son exactamente `Store.loadHistory()` — cero cambio de comportamiento para una cuenta local/legacy.

La traducción servidor→forma local vive en **un solo lugar**, `match-sync.js` (`translateServerMatchToLocalShape`): arma el mismo shape que ya arma un partido local (`players[]`, `sets[]`, `winnerTeam` derivado con el mismo Engine, `stats`/`intelligence` con el mismo `computeManualStats`/`generateManualIntelligence`), así que Resumen/Análisis/Historial no necesitaron ningún cambio para poder pintar un partido server-backed. Se agregan solo campos nuevos que un consumidor viejo ignora: `serverBacked`, `status`, `actionSide`, `readyForValidation`, `hidden`, `createdByPlayerId`, `validatedAt`, `validationDeadlineAt`.

`isComputableMatch(match)` es el único gate: `!match.serverBacked` (legacy, siempre computable) `|| match.status === 'validated'`. Se revisaron los **17 call-sites** de `Store.loadHistory()` en `app.js` y cada uno se migró a `getDisplayHistory()` o `getComputableHistory()` según si alimenta una vista de navegación/directorio o una métrica oficial (Nivel, Efectividad, Racha, Ranking, tablas de Mis Grupos, Compañeros/Rivales, Evolución). El caso más delicado fue `renderPlayerHome()`: se separó en `matches` (computable, para Nivel/Hitos/Actividad/Efectividad/Tu Momento) y `displayMatches` (display, exclusivo para la tarjeta "Último partido"), exactamente como pide `Experiencia_Inicial.md` §22.B ("Último partido muestra el partido pendiente" + "0 estadísticas oficiales derivadas de ese encuentro"). También se corrigió, por consistencia, el drill-down "Efectividad" de Historial (antes recalculaba sobre display history y podía mostrar más partidos que los que realmente compusieron el porcentaje mostrado en Home).

Un detalle real encontrado y corregido durante esta ronda: `buildDisplayHistory`/`buildComputableHistory` concatenaban local+servidor+outbox sin ordenar. Como `Store.loadHistory()` en solitario mantiene orden de inserción (coincide con más-reciente-primero porque `upsertHistory` siempre hace `unshift`), una simple concatenación hubiera dejado SIEMPRE el historial local antes que cualquier partido server-backed, aunque este último fuera más reciente — rompiendo cualquier consumidor que asuma `matches[0] === "el último partido"` (la propia tarjeta "Último partido", `computeRecentForm`, etc.). Se agregó un `sortByCreatedAtDesc` explícito dentro de las dos funciones de `match-sync.js`.

### 2.4 Ambigüedad (punto 7)

Si `create_or_attach_match` devuelve `ambiguous_candidates`, se abre `#ambiguous-match-overlay`: lista cada candidato (fecha/hora + formato) como un botón; elegir uno reenvía con `disambiguationMatchId`, "Es otro partido" reenvía con `disambiguationForceNew:true`. Ambas respuestas son un intento lógico nuevo → `idempotencyKey` nueva, pero **la misma** entrada de outbox (mismo `localDraftId`, nunca un segundo borrador). Resolución funcional mínima, sin rediseño — marcada UX REVIEW (§5).

### 2.5 Ocultar y nota privada (puntos 8 y 9)

`renderAnalysis`/el botón de eliminar bifurca en 3 caminos según `f.serverBacked`/`f.status`:

- **borrador de outbox** (`sync_pending`/`necesita_revision`) → "¿Descartar esta carga?" → `Store.removeMatchOutboxEntry` (nunca llamó al servidor, no hay nada que ocultar ahí);
- **server-backed ya sincronizado** → "¿Ocultar este partido de tu historial?" → `Matches.hideMatchForMe(matchId, true)` (RPC `hide_match_for_me`) + refresco de cache — nunca borra el partido compartido ni afecta a los demás participantes;
- **local legacy** → exactamente el `Store.removeFromHistory` de siempre, sin cambios.

La nota privada usa el mismo criterio: outbox actualiza el campo en la entrada local; ya sincronizado llama `Matches.setMatchPrivateNote` (RPC `set_match_private_note`); legacy usa `Store.patchHistoryEntry` de siempre. Nunca se comparte con los demás participantes (ninguna de las 3 rutas la expone).

### 2.6 `matched_confirmed` / `matched_already_confirmed` (punto 6)

Ninguno de los dos códigos escribe `status='validated'` — el backend (hotfix `20260921004000_bloque5_conformity_guard.sql`) siempre deja `status='pending_validation'`. El frontend nunca mira el `code` de la respuesta para decidir qué mostrar en Historial/Análisis — solo mira `status` (vía `isComputableMatch`/`serverMatchStatusLabel`), así que ambos casos automáticamente siguen mostrando "PENDIENTE DE VALIDACIÓN", nunca "Validado"/"Oficial". Cubierto explícitamente por tests (`BLOQUE5-CONFORMIDAD`, ver §4).

---

## 3. Comportamiento offline

- Un intento de guardado se persiste en el outbox **antes** de llamar a la red — un cierre de la app, pérdida de conexión o recarga a mitad de camino nunca pierde el partido cargado.
- Sin conexión, `createOrAttach` falla con un código no reconocido como error de negocio → tratado como transitorio → el outbox queda `sync_pending`, se muestra igual un Resumen local (vía `MSync.buildOutboxDisplayEntry`) con el badge correspondiente, nunca se le pide al usuario "corregir" algo que no depende de él.
- Al recuperar conexión (`window.online`) o al reabrir la app con sesión activa, se reintenta automáticamente cada entrada `sync_pending`, **con la misma `idempotencyKey`** — nunca duplica el partido en el servidor.
- Una entrada `necesita_revision` (error de negocio real o ambigüedad ya informada) nunca se reintenta sola — espera una decisión explícita del usuario, para no repetirle un error o una ambigüedad que ya vio.

---

## 4. Tests

Se agregaron **29 tests nuevos** a `bramulab/tests.html` (prefijo `BLOQUE5-`), cargando `match-sync.js` en el arnés (puro, sin red/DOM, mismo criterio que `level.js`/`level-context.js`). Cubren los 9 casos mínimos pedidos y algunos más que surgieron directamente del código escrito esta ronda:

1. **Traducción servidor→local** (`BLOQUE5-SYNC`): `matchId`/`serverBacked`/`status` preservados, `players[]`/`sets[]` correctos, `winnerTeam` derivado con el mismo Engine, `stats`/`intelligence` calculados con el mismo agregador que un partido local.
2. **Pending nunca entra a estadísticas** (`BLOQUE5-COMPUTABLE`): `pending_validation`/`expired` → `isComputableMatch` false; `validated` → true (reservado para Bloque 6); local legacy → siempre true.
3. **`matched_confirmed`/`matched_already_confirmed` siguen pending** (`BLOQUE5-CONFORMIDAD`): ambos casos traducen `status:'pending_validation'` pese a `readyForValidation:true`, y ninguno es computable.
4. **Separación historial/estadísticas end-to-end** (`BLOQUE5-HISTORIAL`): sin server, `buildDisplayHistory`/`buildComputableHistory` devuelven el legacy sin alterar; con un partido server-backed pendiente más reciente, el Historial (display) lo incluye y lo ordena primero, pero `buildComputableHistory` lo excluye siempre.
5. **Outbox sobrevive, reintento conserva idempotencyKey, éxito lo saca** (`BLOQUE5-OUTBOX`): `saveMatchOutboxEntry`→`getMatchOutboxEntry` simula un refresh real; actualizar un campo (nota privada, mismo patrón que `initAnalysisScreen`) conserva la `submissionId`; un reintento automático nunca genera una nueva; `removeMatchOutboxEntry` limpia sin dejar basura.
6. **Ocultar server-backed nunca borra local** (`BLOQUE5-HIDE`): se verifica el invariante de storage — refrescar el cache de servidor y reconstruir el historial de exhibición nunca escribe en `bramulab.history.v1`; el partido local sigue intacto.

**Resultado: 1443/1443 tests OK** (suite completa, incluyendo los ~1414 preexistentes — cero regresiones). `node --check` limpio en `app.js`, `store.js`, `matches.js`, `match-sync.js`.

Verificación adicional (no pedida, pero de bajo costo): se sirvió la app localmente (`python3 -m http.server`, sin Supabase configurado → camino 100% local/legacy) y se navegó Home, Historial, Perfil (MI PERFIL + JUGADORES), Mis Grupos, Rivales y el drill-down de Efectividad con un partido local cargado a mano — sin errores de consola nuevos (el único 404 es `env.generated.js`, esperado en este entorno sin build de Vercel) y con Nivel/Efectividad/Racha/Último partido mostrando los valores correctos. No repite ni reemplaza la validación real de navegador/Vercel contra Supabase Staging que hará ChatGPT/Work.

---

## 5. UX REVIEW pendiente (decisiones visuales menores, resueltas de forma funcional/mínima)

1. **Badge de estado en Historial** (`.history-item__badge--pending`): tono neutro gris (`--text-dim`) para no leerse como logro (lima) ni error (coral). Revisar si necesita ícono o color propio.
2. **Modal de desambiguación** (`#ambiguous-match-overlay`): lista de candidatos como botones simples de texto (fecha/hora + formato), sin ningún tratamiento visual nuevo. Funcional, no rediseñado — se pidió explícitamente no rediseñar en esta ronda.
3. **Mensajes de error de negocio** (`MATCH_BUSINESS_ERROR_MESSAGES`): textos directos vía `showToast`, mismo componente de siempre. Revisar copy con Sebastián si alguno suena demasiado técnico para el usuario final (p. ej. "Ese partido ya quedó oficial — la corrección todavía no está disponible" para `validated_match_needs_bloque6_correction`).
4. **`renderPlayerLastMatchCard`**: al usar `displayMatches` (incluye pendientes), la "forma reciente" (puntos de victoria/derrota, `computeRecentForm`) de esa tarjeta puede incluir un partido pendiente en la racha visual — hoy sin impacto real porque nunca hay partidos server-backed en producción, pero cuando Bloque 6 exista habrá que decidir si esos puntos también deberían excluir pendientes.
5. **Botón "AGREGAR JUGADOR SIN CUENTA" / fila "Agregar a…"** dentro del selector server-backed: reutiliza el mismo patrón visual que ya existía para el buscador de jugadores (Bloque 4), sin ajuste adicional.

Ninguno de estos bloquea el uso funcional del flujo — son decisiones de pulido que se pueden resolver en una ronda posterior con Sebastián.

---

## 6. Bloqueos reales

Ninguno que impida el wiring en sí. Limitación de entorno ya documentada en rondas anteriores (`05_Resultado_Implementacion_Claude.md` §2): esta sesión no tiene acceso a Supabase/Vercel real, así que no pudo ejercer el flujo contra el backend de Staging (crear un partido real, ver la respuesta real de `create-or-attach-match`, confirmar en el navegador real cómo se ve un partido `pending_validation` de otra pareja). Esa validación queda, como pidió esta ronda explícitamente, para ChatGPT/Work.

---

## 7. Confirmaciones

- **`main`**: no tocado (todo el trabajo es sobre `staging`).
- **Production / Vercel**: no tocado.
- **BRAMUlive**: no tocado.
- **Bloque 6** (Confirmar/Proponer corrección/No participé, `status='validated'`): no implementado — `matched_confirmed`/`matched_already_confirmed` siguen mostrando `pending_validation` explícitamente, como exige esta ronda.
- **Historial local legacy**: no migrado automáticamente a ningún concepto de servidor — sigue siendo exactamente `Store.loadHistory()`, sin ningún campo nuevo.
- **Compatibilidad**: Home, Historial local, Perfil, Nivel, Ranking simulado, onboarding, claim, búsqueda de jugadores — verificados sin regresión (suite completa 1443/1443 + navegación manual local, §4).
