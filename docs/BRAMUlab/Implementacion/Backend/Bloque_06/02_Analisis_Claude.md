# Backend Bloque 6 — Análisis técnico (Claude Code)

**Fecha:** 21/09/2026
**Rama:** `staging`
**HEAD de partida:** `9d9aeb8` (fast-forward desde `02dafa1`, sin commits propios todavía)
**Handoff base:** `Implementacion/Backend/Bloque_06/01_Handoff_Inicio_Bloque_06.md`
**Revisión central:** `Implementacion/Backend/Bloque_06/04_Revision_ChatGPT.md` — **APROBADO CON AJUSTES OBLIGATORIOS**, incorporados en esta versión del documento (ver §3.4–§3.7, §4 y §6 actualizados).
**Alcance de esta ronda:** análisis. No se tocó Supabase real, Vercel, `main`, Production ni BRAMUlive. La implementación de Fase A (código en `staging`, sin aplicar a Supabase real) se describe en `03_Plan_Implementacion_Claude.md` y en el cierre de esa ronda.

---

## 1. Método

Se leyeron completas, en el orden de precedencia del handoff:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Experiencia_Inicial.md` (completo, incluidos §§8–16 y §22)
3. `docs/BRAMUlab/Backend_Infraestructura.md` (completo)
4. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md` (completo)
5. `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md` (completo)
6. `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` — secciones Bloque 3, Bloque 4, Bloque 5
7. `docs/BRAMUlab/Implementacion/Backend/Bloque_05/16_Cierre_Bloque_05.md`

Y se inspeccionó el código vigente de `staging` (sin modificarlo):

- las 14 migraciones SQL en `supabase/migrations/` (Bloques 1–5 completos);
- las dos Edge Functions existentes: `supabase/functions/officialize-onboarding/`, `supabase/functions/create-or-attach-match/`;
- el motor de Nivel compartido: `bramulab/level.js`, `bramulab/level-calibration.js`, `bramulab/level-context.js`, `bramulab/engine.js`, `bramulab/match-load.js`;
- `bramulab/stats.js`, `bramulab/matches.js`, `bramulab/app.js` (secciones relevantes: notificaciones, pendientes, Historial);
- `supabase/tests/*.mjs` (patrón de scripts de verificación/administración ya existente).

No se leyó `Archivo/`, `Backup/` ni handoffs históricos ya consumidos, según la regla de lectura del README.

---

## 2. Mapa exacto heredado (qué existe hoy y qué falta)

### 2.1 Tablas (Bloques 1–5, todas con RLS deny-by-default, cero SELECT directo a `authenticated`)

| Tabla | Bloque | Estado relevante para Bloque 6 |
|---|---|---|
| `players` | 1 | `type in ('registered','provisional')`. Sin un tercer valor para "no identificado". `is_active`, `created_by_player_id`. |
| `profiles`, `locations` | 2 | Sin impacto directo en Bloque 6. |
| `level_states` | 3 | `mu`, `confidence`, `rated_matches`, `distinct_opponents`, `status` (`PENDIENTE/CALIBRANDO/CALIBRADO/RECALIBRANDO`), `algorithm_version`. Única vía de escritura: `officialize_level_onboarding` (RPC `service_role`-only). **Bloque 6 necesita una segunda vía de escritura** (efecto por partido) sobre esta misma tabla — no requiere columnas nuevas. |
| `level_events` | 3 | `event_type check (event_type in ('initial_estimate'))` — **CHECK cerrado a un solo valor**, deliberadamente, a la espera de Bloque 5/6. `input_context`/`result` en `jsonb`. Sin columna que vincule un evento a un `match_id`. |
| `provisional_claims` | 4 | Sin impacto directo, salvo que un claim en curso pueda tocar un partido pendiente (ya resuelto en Bloque 4/Bloque 5 vía `player_id` estable). |
| `matches` | 5 | `status check (in ('pending_validation','validated','expired','annulled'))` — **`validated`/`annulled` ya están en el CHECK pero ningún código los escribe todavía**. `validated_at`, `annulled_at`, `annulment_reason` existen como columnas **reservadas sin escritor** (comentario explícito de la migración: "reservados para una futura RPC administrativa de Bloque 6"). `action_side` es derivado y se vuelve `NULL` cuando la conformidad rival ya se registró (`readyForValidation`). |
| `match_participants` | 5 | 4 filas por partido, `player_id` **ya nullable** — reservado explícitamente para el slot "por identificar" de Bloque 6. Tabla de **estado actual, no revisionada** (Bloque 5 solo inserta). |
| `match_sets` | 5 | Revisionada (append-only por `revision_number`). |
| `match_revisions` | 5 | `source check (in ('created','proposed_correction'))`. `revision_number` correlativo. |
| `match_actions` | 5 | `action_type check` ya incluye, **sin emisor todavía**, `validated`, `identity_questioned`, `participant_replaced`, `correction_timeout_resolved`, `annulled` — reservados explícitamente para Bloque 6. Sin CHECK en `reason_code` (extensible sin migración). |
| `match_submissions` | 5 | Idempotencia de `create_or_attach_match`. No participa directamente de la oficialización (que no es un reintento del mismo payload de carga). |
| `match_user_state` | 5 | Oculto/nota privada. Sin impacto en Bloque 6 salvo que "ocultar" debe seguir sin afectar el efecto oficial (ya así). |

**No existe todavía:** `match_level_results` (mencionada como pendiente en `Nivel_BRAMU_Implementacion.md` §3 y en `Backend_Infraestructura.md` §6.5) ni `notifications` (contrato ya escrito en `Backend_Infraestructura.md` §6.7, tabla no creada — la migración de Bloque 5 dice explícitamente "`notifications`: Bloque 6").

### 2.2 RPCs y Edge Functions existentes

| Componente | Qué hace | Patrón (relevante para Bloque 6) |
|---|---|---|
| `officialize-onboarding` (Edge Function) + `officialize_level_onboarding` (RPC, `service_role`-only) | Oficializa el Nivel inicial. | **Edge Function → motor JS compartido (symlink real) → RPC privada transaccional idempotente por estado + `for update`.** Único patrón ya probado de "cálculo JS + escritura atómica en `level_states`/`level_events`". |
| `create-or-attach-match` (Edge Function) + `create_or_attach_match` (RPC, `service_role`-only) | Crea o adjunta un partido; detecta conformidad rival y dedup. | Mismo patrón: Edge Function revalida con `engine.js`/`match-load.js` (symlinks) y llama a una RPC privada con dos `pg_advisory_xact_lock` (idempotencia + huella) y `select ... for update` sobre la fila candidata. **Cuando la conformidad rival coincide, deja `readyForValidation=true` y `action_side=null`, pero NUNCA escribe `validated`** — ese límite está documentado en el código con cita textual a la decisión de producto. |
| `get_my_matches`, `get_match_detail`, `get_pending_action_count`, `compute_pending_action_count`, `hide_match_for_me`, `set_match_private_note`, `list_related_provisional_players` | Lecturas/escrituras triviales, `SECURITY DEFINER`, `grant` directo a `authenticated` (sin Edge Function, porque no hay cálculo del motor JS involucrado). | `compute_pending_action_count` ya define "pendiente accionable" exactamente como `Experiencia_Inicial.md` §8.1 lo pide, y **ya excluye** cualquier partido `validated` — o sea que correcciones/incidencias post-validación **no van a contar para el límite de 5 sin que Bloque 6 tenga que tocar esta función**. |

### 2.3 El motor de Nivel — pieza central para responder §6.2/§6.8

`bramulab/level.js` (Etapa A, matemática pura) expone `PLLevel.computeMatchUpdate(engineInput)`, que ya calcula: `teamStrength`, `expectation`, `margin`, `formatFactor`, `reasonCodes`, y por jugador `{muBefore, confidenceBefore, effectiveLevel, k, opponentFactor, circleFactor, deltaRaw, deltaCapped, deltaPublic, evidenceQuality, muAfter, confidenceAfter}`. Es determinístico y no toca DOM/localStorage/Store — ya listo para correr en Deno exactamente igual que `level.js`/`level-calibration.js` corren hoy en `officialize-onboarding`.

**Hallazgo clave:** `bramulab/level-context.js` (Etapa B, ya implementado y testeado) es la capa que **arma el `engineInput`** que `computeMatchUpdate` necesita: decide elegibilidad (§13), calcula disponibilidad/imputación de invitados, y — esto es lo que estaba marcado como pendiente en el handoff (§6.8) — **ya calcula `repetitionFactor`, `companionFactor` y `circleFactors` reales a partir de un historial de partidos** (`PLLevelContext.computeMatchLevelUpdate(match, history, playerStates, options)`). Esto significa que la matemática de repetición/compañero/círculo competitivo **no hay que diseñarla de nuevo**: ya existe, cerrada y testeada. El trabajo real de Bloque 6 en este punto es de **adaptación de datos**, no de fórmula — ver riesgo #1 más abajo.

Esto también responde de forma muy concreta la pregunta de arquitectura del handoff §6.2: **el patrón "Edge Function → cálculo JS → RPC privada transaccional" no es una opción a evaluar, es el mismo patrón que Bloque 3 y Bloque 5 ya usan en producción de Staging**, dos veces. Bloque 6 lo reutiliza una tercera vez.

### 2.4 Estadísticas — qué existe hoy

`bramulab/stats.js` (3085 líneas) calcula Efectividad, Racha, Evolución, Mejor compañero/Rival más enfrentado, BRAMU Intelligence local, etc. **Todo client-side, puro, a partir de un array de partidos en memoria** (mismo modelo local que `level-context.js`, con `Store`/`localStorage` como origen de datos hoy). No hay ninguna estadística oficial persistida server-side ni derivada server-side todavía.

### 2.5 Notificaciones — qué existe hoy

Existe una pantalla `notifications` en `app.js` (vista, lista, botón "marcar todas"), pero está alimentada por datos locales/simulados. No existe tabla `notifications`, no existe ningún emisor server-side. El contrato de campos ya está escrito en `Backend_Infraestructura.md` §6.7 y no necesita reabrirse.

### 2.6 Comando administrativo — qué existe hoy

No existe ningún patrón de "rol admin" en el backend (sin `is_admin`, sin claim de rol, cero RPCs con ese criterio). El único precedente de "operación administrativa" son los scripts `supabase/tests/verify-*.mjs`, que ya usan la `service role key` fuera del cliente para verificación/limpieza (por ejemplo, la limpieza de partidos QA documentada en el cierre de Bloque 5). Bloque 6 puede apoyarse en exactamente ese mismo patrón para el comando administrativo mínimo — ver §5.11.

---

## 3. Respuestas técnicas punto por punto (§6 del handoff)

### 3.1 (§6.1) Cómo se dispara la oficialización

Los dos caminos deben converger en **una única rutina de oficialización**, invocada desde dos puntos de entrada distintos, nunca con dos implementaciones paralelas:

- **Camino 1 — `Confirmar` explícito:** el cliente llama a una nueva Edge Function `officialize-match` con `{matchId, expectedRevisionId}`.
- **Camino 2 — segunda carga coincidente (Bloque 5):** cuando `create-or-attach-match` recibe de `create_or_attach_match` un resultado con `readyForValidation: true` (código `matched_already_confirmed` o `matched_confirmed`), la **misma invocación de la Edge Function**, antes de responder al cliente, llama internamente a la rutina compartida de oficialización — sin que el cliente tenga que hacer una segunda llamada.

Ambos caminos terminan llamando a la misma RPC privada `officialize_match_validation` (idempotente por estado, igual que `officialize_level_onboarding`). Esto es lo único que hace que sea "un único comando idempotente": no dos lógicas de negocio, sino un único núcleo llamado desde dos triggers.

**Recuperación ante fallo:** si el proceso se corta después de que `create_or_attach_match` deja `readyForValidation=true` pero antes de correr la oficialización (crash del runtime, timeout), el partido queda en un estado transitorio pero **seguro y recuperable sin cron**: cualquier lectura posterior (`get_my_matches`/`get_match_detail`) que detecte `readyForValidation=true` en un partido `pending_validation` dispara automáticamente, desde el cliente, un reintento silencioso de `officialize-match` para ese `matchId`. Es el mismo criterio de "expiración lógica calculada en lectura, sin `pg_cron`" que Bloque 5 ya usa para `expired`.

### 3.2 (§6.2) Atomicidad con el motor JS

Arquitectura recomendada — reutiliza el patrón ya probado, con el agregado necesario para partidos (que Bloque 3 no necesitaba, porque `officialize_level_onboarding` solo toca **un** jugador):

1. **Lectura:** la Edge Function (`service_role` client) lee `matches` + `match_participants` + `match_sets` de la revisión vigente, y `level_states` de los participantes con `player_id` conocido.
2. **Historial:** para cada participante conocido, lee sus partidos `validated` de los últimos 180 días (nueva consulta — ver §4 más abajo) para alimentar repetición/compañero/círculo.
3. **Adaptación:** convierte esas filas al formato local que `level-context.js` espera (`match.players[]`, `match.sets[]`, `match.winnerTeam`, etc. — ver riesgo #1).
4. **Cálculo:** llama a `PLLevelContext.computeMatchLevelUpdate(...)` (que internamente llama a `PLLevel.computeMatchUpdate`). Esto corre en la Edge Function, nunca en SQL.
5. **Escritura atómica con protección de concurrencia:** la Edge Function llama a la RPC privada `officialize_match_validation`, pasando el resultado del motor **junto con el snapshot (`muBefore`/`confidenceBefore`) que usó para calcularlo**. Dentro de la RPC, en una única transacción:
   - `select * from level_states where player_id = any(<participantes conocidos>) order by player_id for update` — bloqueo de fila real, en **orden determinístico por `player_id`** (evita deadlocks si dos partidos que comparten jugadores se oficializan a la vez, igual criterio que ya usan los `pg_advisory_xact_lock` de Bloque 5, pero con locks de fila reales porque acá las filas sí existen);
   - **verificación optimista:** si el `mu`/`confidence`/`status` actual de algún jugador ya no coincide con el snapshot que la Edge Function usó para calcular (porque otro partido concurrente lo actualizó primero), la RPC devuelve `{ok:false, code:'stale_level_snapshot'}` sin escribir nada — la Edge Function debe releer y reintentar (recalcular con el motor sobre el estado fresco). Es el mismo criterio de "comparación de versiones / retry" que el propio handoff propone en §6.2, aplicado a `level_states` en vez de a `match_revisions`;
   - si el snapshot es válido, escribe `level_states` (mu/confidence/rated_matches/distinct_opponents/status), `level_events` (uno por jugador afectado), `match_level_results` (snapshot completo del partido — ver §3.3), `matches.status='validated'` + `validated_at=now()`, `match_actions('validated')`, `notifications`, `pilot_events('match_validated')`.
6. **Idempotencia:** si `matches.status` ya es `validated` cuando llega la RPC, devuelve el resultado ya persistido tal cual (mismo criterio que `officialize_level_onboarding`) — un reintento de la Edge Function (por timeout HTTP, por ejemplo) nunca duplica efectos.

No se demuestra "lectura Edge + escritura atómica posterior" como segura por sí sola — lo que la hace segura es el paso 5: la RPC **no confía** en que el snapshot leído por la Edge Function siga vigente, lo revalida bajo lock antes de escribir.

### 3.3 (§6.3) Qué persistir para poder revertir exactamente

`level_events` actual **no alcanza sola**: guarda respuestas/resultado en `jsonb` pero no tiene columna para vincular el evento a un partido/revisión, y su `event_type` está cerrado a `'initial_estimate'`. Se necesita agregar (ver plan §5.1):

- una tabla nueva `match_level_results` — snapshot reproducible por partido+revisión: `mu`/`confidence` antes y después de cada jugador afectado, `expectation`, `margin`, `formatFactor`, `availabilityFactor`, `knownLevelsCount`, `reasonCodes`, `algorithmVersion`, y un vínculo explícito `reverses_result_id`/`supersedes_result_id` para encadenar oficialización → reversión → nueva oficialización sin ambigüedad;
- dos columnas nuevas en `level_events` (`match_id`, `match_level_result_id`, ambas nullable) para que cada delta individual quede trazable hasta el partido que lo originó;
- nuevos valores en el CHECK de `level_events.event_type` (`match_delta`, `match_correction_reversal`, `match_correction_reapply`) — exactamente los que el propio comentario de la migración de Bloque 3 dejó anticipados ("se agregan cuando el bloque que los emite exista de verdad").

Con esto, revertir un efecto exacto es: leer el `match_level_results` vigente de ese partido/revisión, aplicar el delta inverso a `level_states` (bajo el mismo lock/verificación optimista de §3.2), marcar ese resultado como `reverted`, y — si corresponde — aplicar el nuevo cálculo como una fila `match_level_results` nueva vinculada por `reverses_result_id`. Nunca se recalcula en cascada el resto del historial del jugador: solo se toca el delta de ESE partido.

### 3.4 (§6.4) Corrección de un partido ya oficial

Mecanismo recomendado, sin tocar el núcleo de `create_or_attach_match` (que ya devuelve explícitamente `validated_match_needs_bloque6_correction` cuando alguien reintenta cargar un score distinto sobre un partido ya `validated` — ese código de error es la entrada natural a este flujo, no un obstáculo):

1. `propose_post_validation_correction(match_id, new_sets, ...)` (RPC nueva, vía una Edge Function nueva que revalida con `engine.js`) crea una `match_revision` nueva **sin mover `matches.current_revision_id`** (que debe seguir apuntando a la última revisión oficial mientras la propuesta espera). Se agrega `matches.pending_correction_revision_id` (nullable) para guardar la propuesta en espera. Se rechaza si `now() > validated_at + interval '3 days'`.
2. `respond_post_validation_correction(match_id, accept)`:
   - si la pareja contraria a quien propuso acepta dentro de la ventana: dispara (vía Edge Function, porque hay que recalcular Nivel) la secuencia exacta que pide `Nivel_BRAMU_Formula_V1.5.md` §12.3 — revertir el efecto anterior exacto (usando el `match_level_results` vigente), recalcular con el motor sobre los **mismos snapshots previos que correspondan** (ver DECISIÓN ABIERTA #2 si la corrección también cambia un participante), aplicar solo la diferencia neta, mover `current_revision_id` a la nueva revisión, limpiar `pending_correction_revision_id`;
   - si no se acepta dentro de la ventana: no hace falta ningún job — una lectura (`get_match_detail`) que detecte `pending_correction_revision_id` no nulo con `validated_at + 3 días` ya vencido simplemente deja de ofrecerla como accionable (expiración lógica, mismo criterio que partidos `pending_validation` vencidos).

Nunca se recomputa en cascada el resto del historial de los 4 jugadores: la reversión+reaplicación toca únicamente el delta de este partido.

### 3.5 (§6.5) Cambio de participante después de validar

**Resuelto por la revisión central (04_Revision_ChatGPT.md §2) — ya no es una decisión abierta.** Se adopta la recomendación de este análisis con una precisión temporal obligatoria: al reemplazar un participante después de validar, se usa el estado histórico que ese participante correcto tenía **inmediatamente antes de la oficialización original de ese partido**, no su Nivel actual al resolver la incidencia.

Precisión obligatoria agregada por la revisión: la reconstrucción de "estado inmediatamente anterior" no puede resolverse solo con "último evento con `created_at <= validated_at`" porque puede haber más de un evento con timestamps equivalentes. Necesita **orden determinístico**: `(created_at, event_id)` como clave de ordenamiento, nunca `created_at` solo. Si no existe ningún estado de Nivel válido para ese jugador en ese momento (por ejemplo, todavía no tenía cuenta), se lo trata como participante sin Nivel conocido según las reglas de imputación/disponibilidad de §13 de la fórmula — mismo camino que ya existe para invitados, sin regla nueva.

### 3.6 (§6.6) Representación de "Jugador no identificado" sin fabricar identidad

`match_participants.player_id` ya es nullable por diseño de Bloque 5 para este caso exacto. La recomendación es **no** usar un tercer valor de `players.type` (eso sí sería fabricar una identidad-fantasma con fila propia en `players`) sino modelar el ciclo de vida de la incidencia en una tabla nueva y chica, separada de `match_participants` (mismo criterio arquitectónico que ya separa `match_revisions`/`match_actions` de `matches`, o `provisional_claims` de `players`):

`match_identity_issues`: `issue_id`, `match_id`, `team`, `position_in_team` (referencia al slot exacto), `previous_player_id` (auditoría de quién estaba mal puesto), `opened_by_player_id`, `opened_at`, `status check (in ('open','resolved','unidentified'))`, `resolved_player_id`, `resolved_at`. Único índice parcial: como máximo una incidencia `open` por slot a la vez.

**Alcance de la reversión al abrir la incidencia — corregido por la revisión central (04_Revision_ChatGPT.md §3).** La versión anterior de este análisis decía que se revertía "el efecto de Nivel que ese slot había recibido" — insuficiente: la composición de los cuatro jugadores determina fuerza de pareja, expectativa, disponibilidad/imputación, confianza rival, repetición, compañero y círculo competitivo, así que una identidad incorrecta puede invalidar **el cálculo completo del partido**, no solo el delta de un jugador. Secuencia correcta:

1. abrir la incidencia (pre o post-validación) retira inmediatamente `match_participants.player_id` de ese slot (pasa a `NULL`, `display_name_snapshot` a un valor neutro);
2. si el partido estaba `validated`, la misma operación **suspende/revierte de forma atómica el efecto de Nivel completo de ese partido** (los 4 jugadores conocidos, no solo el slot cuestionado) — es una reversión pura contra el resultado ya calculado (`match_level_results`), no requiere el motor JS de nuevo;
3. mientras la incidencia sigue abierta, ese partido no mantiene ningún delta de Nivel vigente (compuesto sobre una identidad que ya se sabe incorrecta);
4. si se identifica al jugador correcto dentro de los 7 días, se recalcula y reaplica el **partido completo** (los 4 slots, no solo el reemplazado) con los snapshots temporales correctos (§3.5) — sí requiere el motor JS, vía Edge Function;
5. si vencen los 7 días sin resolución, el slot queda `Jugador no identificado` de forma **idempotente y materializada** (no puramente lazy/sin escritura — corrección de la versión anterior de este análisis, ver 04_Revision_ChatGPT.md §6/§7): la primera lectura o acción posterior al vencimiento dispara una operación server-side que fija `status='unidentified'` y reevalúa el partido con las reglas V1.5 de nivel ausente — si sigue siendo computable (por ejemplo, quedan 3 niveles conocidos con al menos uno por pareja), se reaplica el efecto válido tratando ese slot exactamente como un invitado sin nivel conocido de §13; si no cumple elegibilidad, el partido queda sin efecto de Nivel pero sigue siendo oficial en historial/estadísticas.

El resultado deportivo puede seguir siendo oficial durante todo el proceso (`Experiencia_Inicial.md`). El slot nunca recibe un `player_id` fabricado — eso es lo que "no fabricar identidad" significa en este modelo.

### 3.7 (§6.7) Estadísticas oficiales

**Corregido por la revisión central (04_Revision_ChatGPT.md §4/§5).** La versión anterior de este análisis proponía agregar un parámetro `p_only_validated` a `get_my_matches` sin auditar antes lo que ya existe — eso hubiera reabierto exactamente el bug de "ocultar afecta lo oficial" que Bloque 5 ya cerró, porque `get_my_matches` filtra `hidden` por defecto salvo que se pida `p_include_hidden`.

**Lo que ya existe y hay que reutilizar**, confirmado en el código de `bramulab/match-sync.js` (Bloque 5, ya wireado en `app.js`):

- `translateServerMatchToLocalShape(row)` — ya traduce una fila `get_my_matches`/`get_match_detail` a la **misma forma local** que usa la carga manual (`players[]`, `sets[]`, `winnerTeam` derivado con el mismo `Engine`, `mode:'manual'`, `regulationCompleted:true`) — es, de hecho, un adaptador muy cercano al que Bloque 6 necesita para alimentar `level-context.js` (ver §4, Riesgo 1 actualizado);
- `isComputableMatch(match)` — ya devuelve `status === 'validated'` para un partido server-backed, sin excepciones;
- `buildDisplayHistory({localHistory, serverRows, outboxEntries})` — filtra `hidden`, para Home/Historial;
- `buildComputableHistory({localHistory, serverRows})` — **no filtra `hidden`**, para `stats.js`/`player-home.js`/`groups.js`; ya está wireada en `app.js` (`Matches.getMyMatches({limit:200, includeHidden:true})` alimenta ambas funciones desde el mismo cache).

El propio comentario de cabecera de `match-sync.js` ya documenta explícitamente que esto quedó preparado a propósito para Bloque 6: *"un partido server-backed SOLO es computable cuando `status==='validated'` — hoy eso nunca ocurre todavía... así que en la práctica ningún partido server-backed alimenta estadísticas hasta que exista Bloque 6."*

**Conclusión:** Bloque 6 no necesita ninguna vía nueva de datos para estadísticas. En cuanto `officialize_match_validation` empiece a escribir `matches.status='validated'` de verdad, `buildComputableHistory` (ya invocada por `app.js`) empieza a incluir esos partidos automáticamente, con `hidden` sin afectar el cómputo. El primer paso de cualquier checkpoint de estadísticas debe ser **probar el camino vigente contra un partido validado real** y corregir solo lo que efectivamente falte — nunca agregar una segunda vía de datos por adelantado.

### 3.8 (§6.8) Repetición / compañero / círculo competitivo

Ya resuelto por `level-context.js` (ver §2.3). El trabajo real de Bloque 6 es **fetch + adaptación**, no fórmula: para cada participante conocido, traer sus partidos `validated` de los últimos 180 días (consulta nueva, ver §4 riesgo #1) y convertirlos al formato local exacto que `computeTeamRepetitionFactors`/`computeClosedCircleContext` esperan. Una corrección posterior preserva los snapshots usados originalmente porque `match_level_results` (§3.3) ya guarda `repetitionFactor`/`companionFactor`/`circleFactor` tal como se calcularon en el momento — no se vuelven a recalcular sobre el historial actual al revertir/reaplicar un partido corregido, salvo que la corrección sea justamente sobre ESE partido.

### 3.9 (§6.9) Pendientes accionables y superficies

`compute_pending_action_count` (Bloque 5) **ya excluye correctamente** correcciones/incidencias post-validación sin que Bloque 6 tenga que tocarla: solo cuenta `status='pending_validation'` con `action_side` propio, y una vez `validated` el partido sale de ese universo por definición. Lo que falta es **superficie**, no lógica de conteo:

- Home/Historial necesitan un tercer badge visual, distinto de "pendiente accionable" y "pendiente en espera": **"corrección propuesta"** (post-validación, alguien debe aceptar/rechazar) e **"identidad cuestionada"** (post-validación, incidencia abierta). Ambos se leen de `get_match_detail`/`get_my_matches` extendidas (exponer `pendingCorrectionRevisionId`/`openIdentityIssue`), nunca del contador de 5.
- Notificaciones necesita los eventos nuevos de §3.10.
- Detalle del partido necesita las 3 acciones nuevas (`Confirmar`/`Proponer corrección`/`No participé`) cuando corresponde, más la sección "Modificaciones" ya prevista por Bloque 5 (`match_actions` vía `get_match_detail`) — sin rediseñar esa sección, solo alimentarla con los nuevos `action_type`.

### 3.10 (§6.10) Notificaciones internas

El contrato de campos ya está cerrado en `Backend_Infraestructura.md` §6.7. Se agrega la tabla `notifications` (§5.1) y se escribe desde cada RPC de este bloque (oficialización, corrección propuesta/aceptada, identidad cuestionada, expiración) — mismo patrón que ya usa `pilot_events` (insert directo dentro de la misma transacción de la RPC que emite el evento de negocio, sin un segundo paso). Se agregan dos RPCs triviales de lectura/escritura (`get_notifications`, `mark_notification_read`), mismo patrón que `hide_match_for_me`. La pantalla de Notificaciones ya existe en `app.js` — solo hay que cambiar su fuente de datos, no rediseñarla.

### 3.11 (§6.11) Comando administrativo mínimo

Sin panel. Dos RPCs nuevas, `SECURITY DEFINER`, **exclusivamente `service_role`** (mismo criterio que `officialize_level_onboarding`, revocado de `public`/`authenticated`/`anon`):

- `admin_annul_match(match_id, actor_label, reason)`: revierte el efecto de Nivel si estaba `validated` (reusa §3.3), escribe `matches.annulled_at`/`annulment_reason` (columnas **ya reservadas** por Bloque 5, sin migración nueva para esto), `match_actions('annulled')`.
- `admin_force_resolve(match_id | issue_id, ...)`: para los casos excepcionales que el piloto necesite resolver a mano (p. ej. reabrir una incidencia de identidad vencida) — mismo patrón de auditoría (actor + motivo obligatorios).

Se invocan igual que los scripts `verify-*.mjs` ya existentes: un script Node corrido a mano por Sebastián/administración con la `service role key` como variable de entorno local, nunca desde la app ni desde un rol expuesto al cliente. Consistente con "no construir panel admin complejo en este bloque".

---

## 4. Riesgos técnicos reales

### Riesgo 1 — Adaptador de datos entre el esquema Supabase y `level-context.js` (medio, reducido tras auditar `match-sync.js`)

`level-context.js` fue escrito para el modelo local (`match.players[]` con `{name, team, userId}`, `match.sets[].winner`, `match.winnerTeam`, `match.formatId`, `match.mode`, `match.regulationCompleted`, `match.validationState`). El riesgo era mayor en la versión anterior de este análisis porque asumía que había que construir este adaptador desde cero. **No es así:** `bramulab/match-sync.js` (Bloque 5, ya implementado y wireado en `app.js`) ya expone `translateServerMatchToLocalShape(row)`, que traduce una fila `get_my_matches`/`get_match_detail` a **exactamente** esa forma local (`players[]`, `sets[]` con `winner` derivado vía el mismo `Engine`, `mode:'manual'`, `regulationCompleted:true`), reutilizable tal cual server-side. El trabajo real que queda es más chico de lo estimado:

- una nueva RPC de lectura que devuelva, para un conjunto arbitrario de `player_id` (no solo el caller, a diferencia de `get_my_matches`), sus partidos `validated` en un formato de fila compatible con lo que `translateServerMatchToLocalShape` espera;
- el mapeo `level_states.status` (`PENDIENTE/CALIBRANDO/CALIBRADO/RECALIBRANDO`) → `Level.STATES` (`sin_estimacion/calibrando/calibrado/recalibrando`) — los strings no coinciden 1:1, hay que traducirlos explícitamente;
- el chequeo de ventana temporal de Nivel (ver Riesgo 2, ya resuelto por la revisión central) **antes** de invocar el motor, no dentro de `level-context.js`.

`match.regulationCompleted` se fija siempre en `true` (no existe ningún camino en Bloque 5 para cargar un partido incompleto/walkover — laguna preexistente fuera de este alcance, ya así en `match-sync.js`).

### Riesgo 2 — Ventana de 30 días: RESUELTO por la revisión central, ya no es un riesgo abierto

**Antes** DECISIÓN ABIERTA #1 de este análisis. La revisión central (`04_Revision_ChatGPT.md` §1) la resolvió por precedencia documental: `Nivel_BRAMU_Formula_V1.5.md` es la fuente normativa de Nivel y su §12.2/§13 son explícitos — `validated_at − played_at > 30 días` significa historial/estadísticas sí, Nivel no. Bloque 5 conserva sus reglas operativas (14 días de carga + 30 días de pendiente desde la carga, que en el peor caso permite `validated_at` hasta 44 días después de `played_at`) sin reabrirse; la diferencia entre ambas ventanas la absorbe Bloque 6 como una elegibilidad **adicional y más estricta**, exclusiva del efecto de Nivel, nunca del estado oficial del partido.

Implementación obligatoria: el chequeo `validated_at − played_at ≤ 30 días` vive en el **adaptador/orquestador server-side de Bloque 6** (antes de invocar el motor), no dentro de `level-context.js` (cuyo chequeo interno de `createdAt − playedAt` queda confirmado como inerte con datos de Bloque 5, y no se toca ese archivo). Un partido que exceda la ventana queda `validated` igual — el resultado deportivo es oficial — pero no produce ningún delta de Nivel, con un `reasonCode` explícito (`fuera_de_ventana_30_dias_desde_partido`) guardado igual que cualquier otro resultado de elegibilidad, nunca como una excepción silenciosa.

### Riesgo 3 — Costo de traer historial de 180 días por 4 jugadores en cada oficialización (medio)

Cada oficialización necesita, para cada uno de hasta 4 participantes conocidos, sus partidos validados de los últimos 180 días (para repetición/compañero/círculo). Para 10–20 jugadores de piloto el volumen es trivial, pero conviene que la consulta esté indexada por `(player_id, played_at)` vía `match_participants_player_id_idx` (ya existe) + `matches_played_at_idx` (ya existe) — no se necesita un índice nuevo, pero si el volumen creciera fuerte convendría revisarlo en Bloque 9.

### Riesgo 4 — Corrección post-validación que además cambia Nivel de un partido con incidencia de identidad simultánea (medio, con regla de serialización obligatoria)

Si una corrección de resultado (§3.4) y una incidencia de identidad (§3.6) están abiertas al mismo tiempo sobre el mismo partido, el orden de reversión/reaplicación importa. La revisión central (`04_Revision_ChatGPT.md` §11) hace obligatoria la mitigación que este análisis ya recomendaba: **no permitir aceptar una corrección de resultado mientras exista una incidencia de identidad `open` sobre ese mismo partido** — se resuelve primero la identidad, después el resultado. Se serializa además con el mismo lock de `level_states` de §3.2 (ambos caminos pasan por el mismo núcleo de reversión/reaplicación).

### Riesgo 5 — Regresión sobre Bloques 2–5 (bajo, con mitigación ya probada)

Bloque 6 no necesita modificar el cuerpo de `create_or_attach_match` salvo un agregado acotado al final (invocar la rutina compartida de oficialización cuando `readyForValidation=true`, importada como módulo — nunca una llamada HTTP Edge→Edge hacia el mismo backend, `04_Revision_ChatGPT.md` §10) — evita tocar la lógica de deduplicación/concurrencia ya validada. La suite local (1448/1448 al cierre de Bloque 5) y los `verify-bloque{2,3,4,5}.mjs` deben seguir en verde antes de considerar cerrado cualquier checkpoint.

### Riesgo 6 (nuevo) — `evidence_units`/`confidence_origin` no existen todavía en `level_states`

`Nivel_BRAMU_Formula_V1.5.md` §2/§19 exige conservar `evidence_units` (evidencia acumulada ponderada) como parte del estado de cada jugador — es lo que hace matemáticamente exacta y determinística una reversión de confianza (§10.1/§10.2 de la fórmula: `evidence_units` se acumula de forma aditiva y `confidence` es una función pura del total acumulado, no de una cadena de valores intermedios). `level_states` de Bloque 3 no tiene esa columna porque solo necesitaba persistir el resultado del cuestionario inicial. Bloque 6 la necesita para poder revertir/reaplicar `confidence` con la misma exactitud que `mu` (diferencia neta), en vez de aproximar. Se agrega como columna nueva (ver plan §1.4) con backfill seguro: al cierre de Bloque 3, `confidence == b` (`evidence_units` implícitamente 0 para todos), así que `confidence_origin` puede completarse desde el valor actual de `confidence` sin ambigüedad.

---

## 5. Decisiones técnicas recomendadas (resumen, actualizado tras la revisión central)

1. Un único núcleo de oficialización, extraído como **módulo compartido** que importan las distintas Edge Functions (nunca una llamada HTTP Edge→Edge) — invocado desde dos triggers (`Confirmar` explícito y el cierre de `create-or-attach-match`), y reutilizado también para reaplicar tras una corrección o una identidad resuelta.
2. Atomicidad vía lock de fila (`for update`, orden por `player_id`) + verificación optimista del snapshot usado por el motor, dentro de la RPC — no se confía en que la lectura Edge siga vigente al escribir.
3. Nuevas tablas `match_level_results`/`match_level_result_players` (normalizada, no un blob `jsonb` único) para poder contar `rated_matches`/`distinct_opponents` por consulta directa en vez de mantener contadores incrementales propensos a desincronizarse con las reversiones.
4. Corrección post-validación: revisión "en espera" separada de la oficial (`matches.pending_correction_revision_id`), nunca se pierde cuál es la versión oficial vigente mientras se decide.
5. "Jugador no identificado": tabla chica `match_identity_issues` con ciclo de vida propio; el vencimiento a 7 días se **materializa de forma idempotente** en la primera lectura/acción posterior (no queda como estado puramente derivado sin escritura — corregido por la revisión central).
6. Estadísticas oficiales: **no se agrega ninguna vía nueva de datos.** Se reutiliza `buildComputableHistory`/`buildDisplayHistory` (`match-sync.js`, Bloque 5) ya wireadas en `app.js`, que ya separan correctamente computable-con-ocultos vs. visible-sin-ocultos.
7. Ocultar (`hidden`) nunca puede sacar un partido `validated` de Nivel/estadísticas — la capa computable no filtra `hidden`, ya es así en el código existente, Bloque 6 no debe introducir un feed que sí filtre.
8. Notificaciones: tabla nueva siguiendo el contrato ya cerrado de `Backend_Infraestructura.md` §6.7; el vencimiento/aviso temporal se materializa igual que el de identidad — idempotente en la primera lectura/acción posterior, sin cron.
9. Comando administrativo: 2 RPCs `service_role`-only + script en el repo para trazabilidad — pensado para que lo ejecute un agente/entorno autorizado, nunca que Sebastián maneje la `service role key` o pegue secretos en el chat.
10. Ventana de Nivel de 30 días desde `played_at`: chequeo explícito en el orquestador de Bloque 6, separado del estado oficial del partido (Riesgo 2).
11. Cambio de participante: snapshot histórico reconstruido con orden determinístico `(created_at, event_id)`, nunca el Nivel actual (§3.5).
12. `evidence_units`/`confidence_origin` se agregan a `level_states` para que la reversión de `confidence` sea exacta, no aproximada (Riesgo 6).

---

## 6. Decisiones de producto — estado final tras la revisión central

Las dos decisiones que este análisis había marcado como abiertas fueron revisadas y **cerradas** por `04_Revision_ChatGPT.md`. Se documentan acá como registro, no como pendientes.

### Ex-DECISIÓN ABIERTA #1 — Ventana temporal de Nivel → RESUELTA

Ver Riesgo 2 (§4). Resolución: `Nivel_BRAMU_Formula_V1.5.md` manda por precedencia documental. `validated_at − played_at > 30 días` ⇒ historial/estadísticas oficiales sí, Nivel no. Bloque 5 no se reabre.

### Ex-DECISIÓN ABIERTA #2 — Snapshot del participante correcto → APROBADA con precisión temporal

Ver §3.5. Resolución: estado histórico inmediatamente anterior a la oficialización original, con orden determinístico `(created_at, event_id)` — nunca el Nivel actual al momento de resolver.

**No queda ninguna decisión de producto pendiente de Sebastián o de ChatGPT central antes de implementar** (`04_Revision_ChatGPT.md` §13). Cualquier decisión abierta nueva que surja durante la implementación de Fase A se documentará en el cierre de esa ronda, no acá.

---

## 7. Casos mínimos de testing (refinado sobre §7 del handoff + §12 de la revisión central)

Se mantiene la lista completa del handoff (Validación/Nivel/Corrección/Identidad/Seguridad/Regresiones) y se agrega, con los nombres de RPC/Edge Function de este análisis y la cobertura adicional obligatoria de `04_Revision_ChatGPT.md` §12:

- `officialize_match_validation` llamada dos veces seguidas (reintento HTTP) → mismo `match_level_results`, cero deltas duplicados.
- Dos partidos distintos que comparten un jugador, oficializados en paralelo → ambos aplican, ningún delta se pierde, orden de lock por `player_id` no produce deadlock.
- `officialize_match_validation` con snapshot desactualizado a propósito → `stale_level_snapshot`, cero escritura, la Edge Function reintenta y sí aplica.
- Partido con 4 niveles conocidos / 3 / 2 (uno por pareja) / 2 en la misma pareja (no computa) — sobre datos reales de `match_participants`, no simulados.
- Partido validado entre el día 31 y el 44 desde `played_at`: historial/estadísticas oficiales sí, Nivel no — verificar `reasonCode` explícito y cero deltas.
- Corrección post-validación aceptada dentro de 3 días → reversión exacta + delta neto; fuera de 3 días → rechazada, sin tocar `level_states`.
- Corrección de resultado bloqueada mientras existe una incidencia de identidad `open` sobre el mismo partido (Riesgo 4).
- `report_identity_issue` sobre partido `validated` → se suspende/revierte el efecto **completo del partido** (los 4 jugadores conocidos), no solo el del slot cuestionado.
- `resolve_identity_issue` dentro de 7 días → recalcula y reaplica el **partido completo**, usando el snapshot histórico reconstruido del participante correcto (orden determinístico) — nunca su Nivel actual.
- Incidencia sin resolver a los 7 días → la primera lectura/acción posterior materializa `unidentified` de forma idempotente y reaplica con las reglas V1.5 de nivel ausente (computable con 3 conocidos, o sin efecto si no cumple elegibilidad).
- Un partido `validated` oculto (`hidden=true` para ese usuario) sigue contando en Nivel y en `buildComputableHistory` — nunca se usa un feed que filtre ocultos para la capa computable.
- `compute_pending_action_count` no cambia con correcciones/incidencias post-validación abiertas (regresión directa de Bloque 5, sin tocar esa función).
- `admin_annul_match`/`admin_force_resolve` solo ejecutables con `service_role` — un intento con JWT de usuario normal debe fallar (RLS/GRANT).
- Suite local completa (baseline 1448/1448 al cierre de Bloque 5) + `verify-bloque{2,3,4,5}.mjs` en verde antes y después de cada checkpoint.

---

*Fin del análisis. Continúa en `03_Plan_Implementacion_Claude.md`.*
