# Backend Bloque 5 — Corrección pre-Staging

**Fecha:** 20/09/2026
**Rama:** `staging`
**HEAD de partida:** `768d21a` (revisión pre-Staging de ChatGPT)
**Documento seguido:** `06_Revision_Pre_Staging_ChatGPT.md` — todas las correcciones marcadas como obligatorias se implementaron.

Este documento registra las correcciones aplicadas sobre la implementación de `05_Resultado_Implementacion_Claude.md`, sin reabrir ese documento (queda como snapshot histórico de esa ronda). El estado real y actualizado de Bloque 5 es el que describe este archivo.

**Estado tras esta corrección: CORREGIDO, TODAVÍA NO APLICADO A SUPABASE.** Sigue sin haber acceso a Supabase/Deno/Docker/Postgres local en esta sesión (mismo bloqueo documentado en `05_Resultado_Implementacion_Claude.md` §2) — nada de lo de acá se ejecutó contra un backend real. Según `06_Revision_Pre_Staging_ChatGPT.md` §11, el siguiente paso (revisar diff, aplicar migraciones, desplegar Edge Function, validar) lo hace ChatGPT central con su propio acceso operativo a Staging.

---

## 1. Correcciones aplicadas (una por cada punto de `06_Revision_Pre_Staging_ChatGPT.md`)

### §1 — Bloque 5 ya no marca un partido `validated`

`create_or_attach_match` (rama de conformidad rival, score coincidente desde el lado que no había declarado):

- **Antes:** `status='validated'`, `validated_at=now()`, acción `'validated'`, evento `pilot_events('match_validated')`.
- **Ahora:** `action_side=null` únicamente; acción append-only `'confirmed'`; `status` permanece `pending_validation`; `validated_at` permanece `null`; **no se emite ningún `pilot_events`**. La respuesta conserva `code:'matched_confirmed'` pero agrega `status:'pending_validation'` y `readyForValidation:true`.
- `match_actions.action_type` reordenado: `'confirmed'` pasa a la lista de valores que Bloque 5 SÍ emite; `'validated'` pasa a la lista de reservados para Bloque 6, sin emisor todavía.
- `get_my_matches`/`get_match_detail` ganan la columna/campo `readyForValidation` (`pending_validation` + `action_side is null` + no vencido) para que Bloque 6 pueda identificar qué partidos están listos para su transacción de oficialización sin que Bloque 5 la haya adelantado.
- Archivo: `supabase/migrations/20260920180000_bloque5_matches_core.sql` (comentarios/CHECK), `20260920190000_bloque5_rpcs_read.sql` (columna nueva), `20260920200000_bloque5_create_or_attach_rpc.sql` (lógica).

### §2 — El límite de 5 pendientes solo bloquea CREAR

- El chequeo de `compute_pending_action_count(...) >= 5` se movió de "antes de la búsqueda de candidatos" a **dentro de la rama `if v_target_match_id is null then` (crear nuevo)**, después de confirmar que la carga efectivamente va a crear un partido — nunca antes.
- Un attach, una conformidad, una revisión o una desambiguación hacia un candidato existente ya NO pasan por este chequeo en ningún punto del código.
- Test nuevo en `verify-bloque5.mjs`: con F en el límite (5/5), una carga que ADJUNTA a uno de esos 5 partidos existentes (`attachWhileAtLimit`) debe tener éxito (`matched_confirmed`), mientras que crear uno genuinamente nuevo (`sixthByF`) sigue rechazado.

### §3 — Carrera con la MISMA `idempotency_key`

- Se agregó un **segundo advisory lock transaccional**, `pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 1))`, tomado **antes** de la primera consulta a `match_submissions` — semilla `1`, distinta de la semilla `0` que ya usaba el lock por huella (resuelven problemas distintos, documentado explícitamente en el SQL).
- Test nuevo: dos llamadas via `Promise.all` con la MISMA `idempotencyKey` y el MISMO payload deben devolver exactamente el mismo `matchId`/`code`, y `matches` no debe terminar con una fila duplicada.

### §4 — El hash de idempotencia debe cubrir todo el payload

- `v_payload` (la estructura que se hashea) ahora incluye `reportedTimeZone`, `scoringSystem`, `locationName`, `locationLat`, `locationLng` además de los campos que ya tenía.
- Test nuevo: la misma `idempotencyKey` con **solo** `locationName` distinto también se rechaza como `idempotency_key_reused_with_different_payload`.

### §5 — Policies recursivas sobre `match_participants`

- Se eliminaron las **6 policies de `select`** (una por cada una de `matches`/`match_participants`/`match_sets`/`match_revisions`/`match_actions`/`match_user_state`) y sus **6 `grant select ... to authenticated`** correspondientes.
- Las 7 tablas de partidos quedan con RLS habilitada y **cero políticas** para `authenticated`/`anon` — el mismo criterio deny-by-default-total que ya usan `provisional_claims`/`api_rate_limits`/`match_submissions` desde Bloque 4.
- Toda lectura pasa exclusivamente por `get_my_matches`/`get_match_detail`/`get_pending_action_count`/`list_related_provisional_players` (`SECURITY DEFINER`, corren con los privilegios del rol dueño de la tabla, nunca con los del caller — mismo mecanismo ya usado por `list_my_provisional_players` en Bloque 4). Ninguna RPC necesitó ningún cambio de lógica por esto: las `SECURITY DEFINER` nunca dependieron de las policies que se acaban de borrar.
- `service_role` conserva `select/insert/update/delete` directo en las 7 tablas (lo necesitan `create_or_attach_match` internamente por ser dueño, y los scripts de verificación para setup/cleanup vía REST).
- Tests nuevos: lectura directa `authenticated` sobre `matches` y sobre `match_participants` (además de la ya existente sobre `match_submissions`) debe fallar o devolver vacío.

### §6 — `disambiguation_match_id` debe respetar la ventana temporal

- La búsqueda de candidatos se unificó en una sola consulta: cuando `p_disambiguation_match_id` viene informado, se agrega `and m.match_id = p_disambiguation_match_id` al mismo `WHERE` que ya aplica huella/formato/estado/**ventana temporal** — nunca una consulta separada sin esa condición.
- Si el candidato nombrado no la cumple (fuera de ventana, o cualquier otro motivo), la función devuelve `disambiguation_match_id_invalid` explícito — nunca cae silenciosamente a "crear un partido nuevo".
- Test nuevo: un `disambiguationMatchId` que apunta a un partido real pero a 7 días de distancia se rechaza con `disambiguation_match_id_invalid`.

### §7 — Setup de ambigüedad no determinístico

- `ambigCreate2` ahora manda `disambiguationForceNew: true` explícitamente, garantizando que se cree un **segundo** `match_id` real (antes, con el algoritmo ya corregido, esa segunda carga se hubiera adjuntado como revisión del primero, y el test de ambigüedad nunca hubiera tenido 2 candidatos reales que ofrecer).

### §8 — Aislar el test del límite de pendientes

- Se agregaron 4 cuentas dedicadas nuevas (`G`, `H`, `I`, `J`), usadas **exclusivamente** como creadoras en la sección de límite de pendientes — nunca aparecen en ningún otro fixture del script.
- `F` (la cuenta que acumula los 5 pendientes) tampoco aparece en ningún otro fixture.
- Se verifica explícitamente `pendingCountBefore === 0` para F antes de generar los 5 pendientes, y las fechas de esa sección se recalcularon para caer siempre dentro de la ventana de 14 días (bug encontrado durante esta misma corrección: las fechas originales de esa sección — y la del intento de 6ª carga — quedaban fuera de la ventana retroactiva, lo que hubiera hecho fallar el test con `played_at_too_old` en vez de ejercer `pending_action_limit_reached`).

## 2. Los 9 puntos de la §9 de la revisión, uno por uno

1. Segunda declaración coincidente → mismo `match_id`, conformidad registrada, sigue `pending_validation` — cubierto (§7 del script, 3 aserciones: código, estado, fila real).
2. No se crea `match_validated` en Bloque 5 — cubierto (assert directo sobre `match_actions.action_type` que incluye `'confirmed'` y excluye `'validated'`).
3. Nivel sigue intacto — cubierto (assert sobre `level_states` después de la conformidad, no solo después de crear).
4. Con 5 pendientes, crear nuevo se bloquea — cubierto (`sixthByF`).
5. Con 5 pendientes, attach/respuesta a partido existente sigue permitido — cubierto (`attachWhileAtLimit`, caso nuevo).
6. Misma idempotency key concurrente no duplica ni falla — cubierto (`idemRace1`/`idemRace2` vía `Promise.all`).
7. Ambigüedad real con 2 candidatos funciona — cubierto (`ambigCreate2` con `disambiguationForceNew`).
8. `disambiguation_match_id` fuera de ventana es rechazado — cubierto (`disambigOutOfWindow`, caso nuevo).
9. Acceso directo autenticado a tablas de matches sigue denegado; RPCs autorizadas funcionan — cubierto (`authedReadMatches`/`authedReadParticipants`, casos nuevos; el resto del script ya ejercita extensivamente que las RPCs sí funcionan).

## 3. Qué NO cambió (confirmado explícitamente, per §10 de la revisión)

7 tablas, advisory lock por huella (ahora + advisory lock por idempotency_key), canonicalización determinística por parejas, ventana ±3 horas/mismo día, búsqueda también contra `validated`, provisionales relacionadas, expiración lógica, Edge Function con motor JS compartido, outbox local sin wiring todavía, sin migración de historial legacy, `main`/Production/BRAMUlive sin tocar.

## 4. Resultado de la suite local tras la corrección

- `tests.html`: **1414/1414** (sin cambios — esta corrección no tocó ningún archivo de `bramulab/*.js` de producto, solo SQL y el script de verificación).
- `node --test bramulab/scripts/env-guard.test.mjs bramulab/api/health.test.mjs`: **17/17**.
- `node --check` sobre las 3 migraciones corregidas, la Edge Function, `verify-bloque5.mjs`, `matches.js`, `store.js` y `match-load.js`: sin errores de sintaxis JS/SQL detectables estáticamente.
- **Nada de esto se corrió contra Postgres/Supabase real** — sigue siendo el mismo bloqueo de entorno de la ronda anterior (§2 de `05_Resultado_Implementacion_Claude.md`).

## 5. Bloqueo real restante

Idéntico al de la ronda anterior: esta sesión no tiene `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, ni Supabase CLI, ni Deno, ni Docker/Postgres local. No se aplicó ninguna migración, no se desplegó la Edge Function, no se corrió `verify-bloque5.mjs` ni una sola vez contra un backend real.

Por indicación explícita de esta ronda (`06_Revision_Pre_Staging_ChatGPT.md` §11 y el mensaje de la tarea), este bloqueo ya no requiere intervención de Sebastián: **ChatGPT central tiene acceso operativo a Supabase Staging** y hará el siguiente paso (revisar diff, aplicar migraciones, desplegar Edge Function, ejecutar validaciones reales) de forma autónoma.

## 6. Confirmación de alcance respetado

- **No** se aplicó ninguna migración a Supabase.
- **No** se desplegó la Edge Function a ningún entorno real.
- **No** se tocó Vercel.
- **No** se modificó `main`.
- **No** se modificó Production.
- **No** se tocó BRAMUlive.
- **No** se implementó ningún comportamiento de Bloque 6 — al contrario, esta corrección existe precisamente para que Bloque 5 deje de invadir ese territorio (§1).
- Los únicos archivos modificados son las 3 migraciones SQL de Bloque 5, `verify-bloque5.mjs`, y esta documentación — ningún archivo de `bramulab/*.js` de producto se tocó en esta ronda de corrección.
