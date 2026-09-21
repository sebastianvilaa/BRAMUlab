# Backend Bloque 6 — Análisis técnico (Claude Code)

**Fecha:** 21/09/2026
**Rama:** `staging`
**HEAD de partida:** `9d9aeb8` (fast-forward desde `02dafa1`, sin commits propios todavía)
**Handoff base:** `Implementacion/Backend/Bloque_06/01_Handoff_Inicio_Bloque_06.md`
**Alcance de esta ronda:** SOLO análisis. No se tocó código, Supabase, Vercel, `main`, Production ni BRAMUlive.

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

Ver **DECISIÓN ABIERTA #2** más abajo — es exactamente el punto que el handoff pide marcar así si la fuente no lo resuelve de forma inequívoca, y no lo resuelve.

### 3.6 (§6.6) Representación de "Jugador no identificado" sin fabricar identidad

`match_participants.player_id` ya es nullable por diseño de Bloque 5 para este caso exacto. La recomendación es **no** usar un tercer valor de `players.type` (eso sí sería fabricar una identidad-fantasma con fila propia en `players`) sino modelar el ciclo de vida de la incidencia en una tabla nueva y chica, separada de `match_participants` (mismo criterio arquitectónico que ya separa `match_revisions`/`match_actions` de `matches`, o `provisional_claims` de `players`):

`match_identity_issues`: `issue_id`, `match_id`, `team`, `position_in_team` (referencia al slot exacto), `previous_player_id` (auditoría de quién estaba mal puesto), `opened_by_player_id`, `opened_at`, `status check (in ('open','resolved','unidentified'))`, `resolved_player_id`, `resolved_at`. Único índice parcial: como máximo una incidencia `open` por slot a la vez.

- Al abrirse la incidencia (`report_identity_issue`, pre o post-validación): si el partido ya está `validated`, dentro de la misma operación se revierte (§3.3) el efecto de Nivel que ese slot había recibido — "el jugador incorrecto no puede seguir recibiendo efecto" es una regla ya cerrada por el handoff, no una decisión a tomar. `match_participants.player_id` de ese slot pasa a `NULL` inmediatamente (el slot queda "por identificar"); `display_name_snapshot` se actualiza a un valor neutro tipo "Por identificar" para no seguir mostrando el nombre de quien dijo que no participó.
- Si se resuelve dentro de los 7 días (`resolve_identity_issue`): `match_participants.player_id` pasa al nuevo jugador; si el partido está `validated`, se recalcula (mismo mecanismo de §3.3/§3.4) el efecto de Nivel de los 4 slots usando el snapshot correcto del participante correcto (DECISIÓN ABIERTA #2).
- Si vencen los 7 días sin resolución: **no hace falta ninguna escritura nueva.** Una lectura que detecte `status='open'` con `opened_at + 7 días` vencido presenta ese slot como `Jugador no identificado` (terminal) sin volver a ofrecerlo como accionable — otra vez expiración lógica calculada en lectura, sin cron. El slot sigue con `player_id=NULL` para siempre: eso es exactamente "no fabricar identidad". Para el motor de Nivel, un slot en este estado terminal se trata igual que un invitado sin nivel conocido de §13 de la fórmula (nunca recibe efecto, participa solo por imputación si corresponde) — no hace falta ninguna regla nueva del motor, ya existe.

### 3.7 (§6.7) Estadísticas oficiales

Hoy **toda** estadística (`stats.js`) es client-side y parte de un array de partidos ya en memoria — no hay una segunda fuente server-side que pueda divergir todavía. Se recomienda **no** crear un pipeline de agregados persistidos (evita una segunda fuente de verdad, y el handoff pide explícitamente no crear métricas nuevas). En cambio:

- extender `get_my_matches` (ya existente, ya filtra `hidden`) para que el cliente pueda pedir específicamente "mis partidos oficiales" (`status='validated'`) como el único insumo legítimo de `stats.js`;
- el cliente sigue corriendo el mismo módulo `stats.js` puro que ya existe, pero alimentado por la respuesta del servidor en vez de `localStorage`;
- esto garantiza automáticamente "pending nunca cuenta, validated sí" porque la fuente de datos ya viene filtrada por el servidor, y una corrección/anulación se refleja sola en la próxima lectura (no hay un agregado desactualizado que invalidar).

Es una combinación mínima, no dos de las tres opciones que el handoff planteaba: se deriva server-side (la lista de partidos oficiales) y se computa client-side (con el motor ya existente, sin duplicarlo).

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

### Riesgo 1 — Adaptador de datos entre el esquema Supabase y `level-context.js` (alto, central)

`level-context.js` fue escrito para el modelo local (`match.players[]` con `{name, team, userId}`, `match.sets[].winner`, `match.winnerTeam`, `match.formatId`, `match.mode`, `match.regulationCompleted`, `match.validationState`) — ninguno de esos campos existe tal cual en `matches`/`match_participants`/`match_sets`. Antes de poder llamar a `computeMatchLevelUpdate`, la Edge Function necesita una capa de adaptación explícita que traduzca filas Supabase → esa forma exacta. Es trabajo real, pero acotado y sin ambigüedad de producto: todos los campos que necesita tienen un origen server-side claro, con una excepción:

- `match.regulationCompleted`: no existe ningún camino en Bloque 5 para cargar un partido incompleto/abandono/walkover (`validateMatchSets` exige un ganador válido por sets). Se puede fijar siempre en `true` al adaptar — no es una laguna que Bloque 6 tenga que resolver, es una laguna preexistente de qué puede cargarse, fuera de este alcance.
- `match.mode`: todo partido server-backed es carga manual por definición del producto (`Experiencia_Inicial.md` §4.1) → siempre `'manual'`.
- `match.validationState`: se deriva 1:1 de `matches.status` (`pending_validation→'pendiente'`, `validated→'validado'`, etc.).

**Mitigación:** escribir y testear este adaptador como una función pura aislada (mismo criterio "cero DOM/localStorage" que el resto del motor), con fixtures explícitos que crucen los tests de `Nivel_BRAMU_Formula_V1.5.md` §14 contra partidos con forma Supabase.

### Riesgo 2 — El chequeo interno de 30 días de `level-context.js` queda inerte con datos de Bloque 5 (alto, ligado a Decisión Abierta #1)

`computeMatchStatus` en `level-context.js` excluye un partido manual si `createdAt - playedAt > 30 días`. Pero Bloque 5 **ya** limita la carga a 14 días retroactivos (`create_or_attach_match`), así que ese chequeo interno **nunca puede dispararse** con datos reales de Bloque 5 (14 < 30 siempre). El control real de "ventana vigente para que un partido compute" que pide el handoff §5 tiene que vivir en otro lado — ver Decisión Abierta #1.

### Riesgo 3 — Costo de traer historial de 180 días por 4 jugadores en cada oficialización (medio)

Cada oficialización necesita, para cada uno de hasta 4 participantes conocidos, sus partidos validados de los últimos 180 días (para repetición/compañero/círculo). Para 10–20 jugadores de piloto el volumen es trivial, pero conviene que la consulta esté indexada por `(player_id, played_at)` vía `match_participants_player_id_idx` (ya existe) + `matches_played_at_idx` (ya existe) — no se necesita un índice nuevo, pero si el volumen creciera fuerte convendría revisarlo en Bloque 9.

### Riesgo 4 — Corrección post-validación que además cambia Nivel de un partido con incidencia de identidad simultánea (medio)

Si una corrección de resultado (§3.4) y una incidencia de identidad (§3.6) están abiertas al mismo tiempo sobre el mismo partido, el orden de reversión/reaplicación importa (revertir dos veces el mismo efecto, o aplicar la corrección sobre snapshots que ya no corresponden al participante vigente). **Mitigación recomendada:** serializar ambos flujos con el mismo lock de `level_states` de §3.2 (ya cubre esto porque ambos pasan por la misma RPC de reversión/reaplicación) y prohibir aceptar una corrección de resultado mientras existe una incidencia de identidad `open` sobre ese mismo partido (se resuelve primero la identidad, después se puede corregir el resultado) — evita razonar dos reversiones concurrentes sobre el mismo partido.

### Riesgo 5 — Regresión sobre Bloques 2–5 (bajo, con mitigación ya probada)

Bloque 6 no necesita modificar el cuerpo de `create_or_attach_match` salvo un agregado acotado al final (invocar la oficialización compartida cuando `readyForValidation=true`) — evita tocar la lógica de deduplicación/concurrencia ya validada. La suite local (1448/1448 al cierre de Bloque 5) y los `verify-bloque{2,3,4,5}.mjs` deben seguir en verde antes de considerar cerrado cualquier checkpoint.

---

## 5. Decisiones técnicas recomendadas (resumen)

1. Un único núcleo de oficialización (`officialize_match_validation` + rutina compartida en la Edge Function), invocado desde dos triggers (`Confirmar` explícito y el cierre de `create-or-attach-match`) — nunca dos lógicas paralelas.
2. Atomicidad vía lock de fila (`for update`, orden por `player_id`) + verificación optimista del snapshot usado por el motor, dentro de la RPC — no se confía en que la lectura Edge siga vigente al escribir.
3. Nueva tabla `match_level_results` + 2 columnas en `level_events` + nuevos valores de `event_type`, en vez de sobrecargar `level_states`/`level_events` actuales o crear una segunda fuente de verdad.
4. Corrección post-validación: revisión "en espera" separada de la oficial (`matches.pending_correction_revision_id`), nunca se pierde cuál es la versión oficial vigente mientras se decide.
5. "Jugador no identificado": tabla chica `match_identity_issues` con ciclo de vida propio y expiración lógica en lectura — nunca una fila fantasma en `players`.
6. Estadísticas oficiales: servidor filtra (`status='validated'`), cliente sigue calculando con el mismo `stats.js` — sin agregados persistidos nuevos.
7. Notificaciones: tabla nueva siguiendo el contrato ya cerrado de `Backend_Infraestructura.md` §6.7, escrita desde las mismas RPCs de negocio.
8. Comando administrativo: 2 RPCs `service_role`-only + script local, mismo patrón que `verify-*.mjs` — sin rol admin nuevo, sin panel.
9. El adaptador Supabase → `level-context.js` es trabajo de datos, no de fórmula: la matemática de Nivel (incluida repetición/compañero/círculo) ya está cerrada y testeada en `level.js`/`level-context.js`.

---

## 6. DECISIONES ABIERTAS

Solo se listan acá los puntos donde las fuentes vigentes genuinamente no alcanzan a determinar una respuesta inequívoca — no se inventó ninguna decisión de producto.

### DECISIÓN ABIERTA #1 — Ventana temporal exacta para que un partido sea computable por Nivel

**El problema:** existen tres lecturas distintas, y ninguna fuente las concilia explícitamente:

- `Nivel_BRAMU_Formula_V1.5.md` §12.2 (texto literal): *"un partido manual debe completar carga, asociación **y validación** dentro de los 30 días posteriores a la fecha real de juego."* — es decir, `validated_at − played_at ≤ 30 días`.
- El propio handoff de Bloque 6, §5: *"un partido manual debe quedar cargado/asociado/validado dentro de **la ventana vigente** para ser computable"* — sin fijar cuál es "la ventana vigente" quando hay más de una en juego.
- `Backend_Infraestructura.md`/Bloque 5 (ya implementado y cerrado, no se reabre): carga retroactiva máxima **14 días** desde `played_at`, más deadline de validación de **30 días desde la carga** (`created_at`, no `played_at`). En el peor caso, un partido puede validarse hasta **44 días** después de jugado (`14 + 30`) y seguir siendo `validated` según Bloque 5.
- El propio motor local (`level-context.js`, ya escrito antes de que existiera Bloque 5) interpreta el "30 días" de una tercera forma: `created_at − played_at ≤ 30 días` (ventana de **carga**, no de validación) — que, alimentada con datos reales de Bloque 5 (siempre `≤14` días), **nunca se dispara** (ver Riesgo 2).

Ninguna de las tres lecturas es la misma, y las tres citan la misma regla de producto "30 días". No es un caso donde Backend_Infraestructura ya tradujo la regla de Nivel sin ambigüedad: es un caso donde la traducción diverge del texto normativo de Nivel.

**Recomendación concreta:** no agregar una segunda ventana temporal independiente para Nivel. Tratar "la ventana vigente" del handoff como **la ventana operativa ya implementada y cerrada de Bloque 5** (14 días de carga + 30 días de pendiente desde la carga) como único criterio de computabilidad temporal — es decir, **cualquier partido que llegue a `validated` bajo las reglas de Bloque 5 es, por ese solo hecho, elegible en el tiempo para Nivel**, sin un segundo chequeo `validated_at − played_at ≤ 30` que podría rechazar por Nivel un partido que el propio sistema ya aceptó como oficial. Motivo: (a) evita crear un estado nuevo "validado pero no computable por antigüedad" que ninguna fuente define ni ninguna pantalla contempla; (b) evita reabrir Bloque 5 (expresamente prohibido en esta ronda y ya cerrado con evidencia real en Staging); (c) el caso límite real (validación entre el día 30 y el 44 desde jugado) requiere que una pareja tarde casi el máximo del plazo pendiente en confirmar un partido cargado casi al límite retroactivo — un caso extremo, no el camino normal.

Si Sebastián/ChatGPT central prefieren la lectura literal de la fórmula (`validated_at − played_at ≤ 30`), la alternativa es agregar ese chequeo explícito dentro de `officialize_match_validation`: un partido que lo exceda queda `validated` igual (Bloque 5 ya lo aceptó, no se puede negar la oficialización del resultado en sí) pero **sin efecto de Nivel**, con un `reasonCode` nuevo (`'fuera_de_ventana_30_dias_desde_partido'`) — technically posible, pero introduce el estado híbrido mencionado arriba y una superficie nueva para explicarlo al usuario.

### DECISIÓN ABIERTA #2 — Snapshot temporal del participante correcto tras un cambio de identidad

Exactamente el punto que el handoff (§6.5) pide marcar así si no hay criterio inequívoco — y no lo hay: ninguna fuente dice si, al reemplazar un slot (por `No participé` o por incidencia de identidad post-validación), el cálculo debe usar el **Nivel del participante correcto tal como estaba en el momento en que el partido se validó originalmente**, o su **Nivel actual** en el momento en que se resuelve la incidencia (que puede ser hasta 17 días después — 10 para abrir + 7 para identificar — y el jugador correcto puede haber jugado otros partidos mientras tanto).

**Recomendación concreta: usar el snapshot histórico del participante correcto reconstruido a la fecha de validación original (`validated_at`), no su Nivel actual.**

Motivos:

- Es la lectura más consistente con `Nivel_BRAMU_Formula_V1.5.md` §12.3, que ya exige "recalcular el partido corregido con los mismos snapshots previos" para correcciones de resultado — aplicar el mismo criterio a un cambio de participante evita dos reglas distintas para dos tipos de corrección sobre el mismo partido.
- Evita que el resultado de este partido quede influido por partidos que el participante correcto jugó **después**, lo cual sería cronológicamente incorrecto (el partido se jugó en una fecha fija, con un nivel de cada jugador en ese momento).
- Es técnicamente viable sin infraestructura nueva más allá de la que Bloque 6 ya necesita: si cada `match_level_results`/`level_event` guarda el `muAfter`/`confidenceAfter` posterior a cada partido con su timestamp (requisito ya cerrado en §3.3 para poder revertir exacto), "el estado de un jugador a una fecha `T`" se reconstruye tomando su último `level_event` con `created_at ≤ T` — no hace falta una tabla de snapshots periódicos aparte.
- Si el participante correcto no tenía todavía ningún `level_state`/`level_event` anterior a `validated_at` (por ejemplo, se registró después), se lo trata exactamente como un invitado sin nivel conocido según §13 de la fórmula — mismo camino de imputación que ya existe, sin regla nueva.

**Alternativa no recomendada:** usar el Nivel actual del participante correcto. Es más simple de implementar (no requiere reconstrucción "a una fecha"), pero rompe la consistencia con §12.3 y puede dar resultados que dependen de *cuándo* se resuelve la incidencia, no de *cuándo* se jugó el partido.

Estas son las únicas dos decisiones de producto/criterio genuinamente abiertas encontradas. Todo lo demás en §6.1–§6.11 del handoff tiene una respuesta técnica concreta derivable de fuentes ya cerradas y del código ya implementado (ver §3).

---

## 7. Casos mínimos de testing (refinado sobre §7 del handoff)

Se mantiene la lista completa del handoff (Validación/Nivel/Corrección/Identidad/Seguridad/Regresiones) y se agregan, con los nombres de RPC/Edge Function propuestos en este análisis:

- `officialize_match_validation` llamada dos veces seguidas (reintento HTTP) → mismo `match_level_results`, cero deltas duplicados.
- Dos partidos distintos que comparten un jugador, oficializados en paralelo → ambos aplican, ningún delta se pierde, orden de lock por `player_id` no produce deadlock.
- `officialize_match_validation` con snapshot desactualizado a propósito → `stale_level_snapshot`, cero escritura, la Edge Function reintenta y sí aplica.
- Partido con 4 niveles conocidos / 3 / 2 (uno por pareja) / 2 en la misma pareja (no computa) — sobre datos reales de `match_participants`, no simulados.
- Corrección post-validación aceptada dentro de 3 días → reversión exacta + delta neto; fuera de 3 días → rechazada, sin tocar `level_states`.
- `report_identity_issue` sobre partido `validated` → el jugador incorrecto pierde el efecto en la misma operación (verificar `level_states`/`match_level_results` antes/después).
- `resolve_identity_issue` con el participante correcto usando snapshot histórico vs. snapshot actual — verificar que se usa el histórico (Decisión Abierta #2).
- Incidencia sin resolver a los 7 días → lectura muestra `Jugador no identificado`, sin escritura, sin efecto de Nivel para ese slot.
- `compute_pending_action_count` no cambia con correcciones/incidencias post-validación abiertas (regresión directa de Bloque 5, sin tocar esa función).
- `admin_annul_match`/`admin_force_resolve` solo ejecutables con `service_role` — un intento con JWT de usuario normal debe fallar (RLS/GRANT).
- Suite local completa (baseline 1448/1448 al cierre de Bloque 5) + `verify-bloque{2,3,4,5}.mjs` en verde antes y después de cada checkpoint.

---

*Fin del análisis. Continúa en `03_Plan_Implementacion_Claude.md`.*
