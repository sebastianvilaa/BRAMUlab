# Backend Bloque 5 — Análisis técnico
## Partidos compartidos e historial

**Fecha:** 20/09/2026
**Rama:** `staging`
**HEAD de partida:** `3e37314` (fast-forward desde `877069c`, sin cambios de código de producto)
**Estado de esta ronda:** análisis y diseño exclusivamente. Ningún servicio remoto tocado, ninguna migración aplicada, ningún código de producto modificado.

Este documento sigue el orden de precedencia documental de `docs/BRAMUlab/README.md`: fuente maestra `Backend_Infraestructura.md`, alineada con `Experiencia_Inicial.md`, sin reabrir Bloques 1–4 (cerrados). Todo lo que seguía a esas dos fuentes sin contradicción se tomó como vigente sin volver a discutirlo acá.

---

## 0. Resumen ejecutivo

1. El modelo local actual (`bramulab/match-load.js` + `bramulab/store.js`) ya separa correctamente lo que Bloque 5 necesita mantener intacto: validación pura de sets/formato, resolución de identidad por `userId` (autoritativa) con fallback por nombre (legacy), y un objeto de partido con forma estable que **stats.js/player-home.js/groups.js consumen de forma agnóstica a su origen** — esto habilita una estrategia de integración de bajo riesgo: traducir los partidos del servidor a esa MISMA forma en un único punto de entrada, sin tocar la lógica de agregación/estadísticas existente.
2. La arquitectura de Bloques 1–4 fija un patrón repetible que Bloque 5 debe seguir sin inventar uno nuevo: **Edge Function (valida con el motor JS compartido, vía symlink) → RPC `SECURITY DEFINER` restringida a `service_role` (persiste)**. Es exactamente el patrón de `officialize-onboarding` → `officialize_level_onboarding` de Bloque 3. Se propone `create-or-attach-match` (Edge Function) → `create_or_attach_match` (RPC).
3. Propongo **7 tablas**, no 6: a las 6 pedidas (`matches`, `match_participants`, `match_sets`, `match_revisions`, `match_actions`, `match_user_state`) se suma `match_submissions`, una tabla de idempotencia dedicada. Está justificada en §5.5 — sin ella, reintentar un envío ambiguo o rechazado podría devolver una respuesta distinta la segunda vez si el estado de la base cambió entre medio, lo que rompe la garantía de idempotencia que pide la Parte 4/6 del pedido.
4. La deduplicación de encuentro (`create-or-attach`) se resuelve con una **huella determinística (`participant_fingerprint`)** calculada a partir de los 4 `player_id` ya canonicalizados por pareja (no solo por jugador) — nunca por nombre. El diseño completo, con los 4 casos (0/1/N candidatos, ambigüedad, error), está en §5.
5. `action_side` en `matches` quedó modelado como una **columna redundante mantenida en sincronía** con `proposed_by_team` de la revisión vigente — nunca una fuente de verdad independiente. Esto evita que un futuro bug de sincronización entre dos campos produzca un partido con "nadie tiene la acción" o "dos lados tienen la acción" simultáneamente.
6. La reutilización de un mismo invitado provisional por **un participante distinto del creador original** requiere una capacidad que Bloque 4 no dejó construida: una forma de descubrir provisionales "relacionadas" (que aparecieron en un partido compartido), más allá de `list_my_provisional_players` (solo las que el propio usuario creó). Se propone una RPC nueva, `list_related_provisional_players`, en la Parte 8/§7.
7. La vencida física a `expired` se resuelve **sin cron ni infraestructura nueva**: se calcula en el momento de lectura (`status='pending_validation' AND now() > validation_deadline_at` ⇒ se presenta como vencido) en las RPC de lectura, nunca escribiendo una transición que hoy no le corresponde a Bloque 5. Justificación y alternativa en la Decisión Abierta #4.
8. Encontré **4 decisiones que no cierran solo con la documentación vigente** y las marqué como DECISIÓN ABIERTA en la §9, cada una con alternativas concretas y una recomendación técnica — ninguna bloquea seguir diseñando el resto.
9. El baseline local se corrió sin tocar código de producto: **1408/1408** (`tests.html`, navegador real) + **17/17** (`env-guard.test.mjs`/`health.test.mjs`, Node) + `node --check` limpio en los 9 módulos de `bramulab/*.js`. Detalle en §11.
10. No se tocó Supabase, Vercel, `main`, Production ni BRAMUlive. Los únicos archivos modificados en esta ronda son estos dos documentos, commiteados y pusheados únicamente a `staging`.

---

## 1. Auditoría del estado actual

### 1.1 Flujo actual de "Cargar partido jugado"

Fuente: [`bramulab/match-load.js`](../../../../../bramulab/match-load.js) (332 líneas, puro, sin DOM) + orquestación en [`bramulab/app.js`](../../../../../bramulab/app.js) líneas ~1340–1565.

- El selector de jugadores es **100% local y por nombre de texto libre**: `computeRecentPlayers`/`computeAllKnownPlayers`/`filterPlayerCandidates` operan sobre `Store.loadPlayerNames()` y sobre los nombres ya presentes en `Store.loadHistory()`. No hay concepto de `player_id` en esta pantalla hoy — la única inyección de identidad real ocurre **después**, cuando `buildManualMatchSnapshot` (app.js:1415) estampa el `userId` de la sesión activa sobre la fila cuyo nombre coincide con `Store.loadCurrentPlayerName()` (vía `Store.stampPlayersWithUserId`). Los otros 3 jugadores del partido **nunca** quedan con `userId` en el modelo actual, sin importar si son cuentas reales.
- La validación central del marcador (`validateMatchDraft`, match-load.js:249) es la única fuente de verdad para "¿es un resultado de set completo y válido para este formato?" (`Engine.isValidCompletedSetScore`) y para determinar el ganador. Esta función **debe reutilizarse tal cual server-side** (ver §2 y §7) — es exactamente el tipo de lógica que Bloque 3 ya decidió no reimplementar en SQL.
- `buildPlayedAtFromLocalFields` (match-load.js:232) ya resuelve correctamente el problema histórico de mezclar UTC/hora local (bug real de V02.1, ver memoria del repo) — construye `playedAt` con el constructor `Date(y,m,d,h,mi)` en hora local y lo serializa a ISO. Esto es exactamente lo que la ventana de 14 días retroactivos necesita recibir del cliente, aunque el servidor deba revalidarla con su propio reloj (nunca confiar en el cliente).
- **Formato/modalidad**: `Engine.FORMATS` define solo dos valores hoy — `classic` (mejor de 3, sets a 6, tie break en 6-6) y `americano` (1 set a 6, tie break en 5-5). `manualSelectedScoring` (`golden`/`starpoint`/`classic`, ver `Engine.SCORING_SYSTEMS`) es un dato **descriptivo sobre cómo se llegó al resultado game a game**, irrelevante para decidir quién ganó un set ya completo — no participa en absoluto de la deduplicación ni de la oficialización.

### 1.2 Representación actual del partido local

El objeto que arma `buildManualMatchSnapshot` (app.js:1415-1484) es la forma canónica que **toda la app ya consume** (Home, Historial, stats.js, groups.js, player-home.js). Campos relevantes para Bloque 5:

```
matchId, createdAt, playedAt, startedAt, timeZone, finishedAt,
players: [{id, team, name, userId?}] × 4,
mode: 'manual', scoringSystem, formatId, sets: [{gamesA, gamesB, tiebreak, winner}],
winnerTeam, location: {name, lat?, lng?} | null, privateNote: string | null
```

Puntos clave:
- **`players[].team`** es `'A'`/`'B'` pero es **arbitrario por partido**: en la carga manual, "el jugador actual siempre es Equipo A" (comentario explícito en `openConfirmMatchScreen`, app.js:1505). Esto confirma exactamente lo que pide Backend_Infraestructura §6.4/Parte 4 del pedido: **la comparación de create-or-attach nunca puede confiar en la etiqueta A/B que puso cada cargador**, porque dos cargadores independientes del mismo encuentro casi seguro van a etiquetarse a sí mismos como "A" cada uno.
- **Identidad**: `findPlayerRow` (player-home.js:43) ya define la regla de integridad vigente — "un `userId` ya guardado en una fila es autoritativo y exclusivo para esa fila". Bloque 5 hereda esta regla sin cambios: la deduplicación de encuentro se hace 100% por `player_id`, nunca por nombre.
- **`getPlayedAt`** (player-home.js:117) ya define la cadena de fallback `playedAt → startedAt → finishedAt` para "cuándo se jugó realmente". Bloque 5 no necesita este fallback server-side (el servidor siempre va a tener `played_at` resuelto), pero si se traduce un partido servidor→forma local (ver §7), hay que poblar los 3 campos de forma consistente para no romper `comparePlayedAtDesc`.

### 1.3 Edición y "eliminar partido" (estado actual)

- Editar un partido manual (`manualEditingMatchId`) hoy **sobrescribe completo** vía `Store.upsertHistory` (dedup por `matchId`) — no hay concepto de revisión, versión ni concurrencia porque todo el modelo es de un solo dispositivo. Esto es exactamente lo que Bloque 5 tiene que introducir (`match_revisions`) porque dos dispositivos van a poder proponer versiones distintas del mismo partido.
- "Eliminar partido" (app.js:1886-1899, botón `.analysis-delete-btn`) hoy llama `Store.removeFromHistory(matchId)` — **un borrado real y total**, aceptable hoy porque el historial es privado de un solo dispositivo. Para un partido server-backed esto **debe dejar de ser un borrado** y convertirse en `hide_match_for_me` (Backend_Infraestructura §8.8: "ocultar no elimina"). Es un cambio de comportamiento real de UI que hay que planear con cuidado (ver Parte 12, `app.js`) — el mismo botón, con la misma etiqueta visible o una levemente ajustada, debe hacer algo distinto según si el partido es local o server-backed.
- **Notas privadas**: `privateNote` ya existe hoy como campo 100% local, editable solo por el dueño del dispositivo, nunca compartido. Mapea 1:1 sobre `match_user_state.private_note` por participante — no hace falta ningún cambio conceptual, solo mover su persistencia.

### 1.4 Qué es real, qué es legacy/mock

| Campo/función | Estado | Nota |
|---|---|---|
| `Engine.FORMATS`, `isValidCompletedSetScore`, `completedSetHasTiebreak` | **Real, reutilizar** | Única fuente de verdad de reglas de set/formato. |
| `match-load.js: validateMatchDraft` | **Real, reutilizar parcialmente** | Hay que extraer la mitad "sets→resultado" (ver §7) para poder correrla también en la Edge Function. La mitad "nombres duplicados" es exclusiva de la UI local con nombres de texto y no aplica server-side (ahí se compara por `player_id`). |
| `players[].userId` | **Real, criterio vigente** | La resolución de identidad de Bloque 3/4/`player-home.js` es exactamente lo que Bloque 5 debe usar; no hay nada legacy acá. |
| `players[].team` ('A'/'B') | **Real pero arbitrario por partido** | Nunca es una etiqueta global ni comparable entre dos cargas independientes sin normalizar. |
| `scoringSystem` (`golden`/`starpoint`/`classic`) | **Real, pero no autoritativo server-side** | Se conserva como dato descriptivo (Intelligence futura), nunca decide ganador ni participa en dedup. |
| `mode: 'manual'` | **Legacy/irrelevante para Bloque 5** | Distingue "carga manual" de "en vivo" (BRAMUlive); todo lo que entra a Bloque 5 es por definición carga de partido ya jugado — el campo puede seguir existiendo en la forma local sin equivalente server-side. |
| `durationMs`, `events`, `perSetStats`, `evolution`, `highlights`, `intelligence`, `stats` | **Local, derivado, no persistir server-side en Bloque 5** | Son subproductos calculados client-side a partir de `sets`+`players`; el servidor solo necesita persistir el resultado estructurado (`sets`), no sus derivados. Recalcular en cliente al leer, igual que hoy. |
| `terminationType`/`terminationReason*`/`regulationCompleted` | **Exclusivo de partido en vivo, no aplica** | Siempre `'automatic'`/`true` en carga manual; sin equivalente en Bloque 5. |

### 1.5 Qué NO hay que reescribir

- El motor de reglas (`engine.js`) — se reutiliza tal cual, vía symlink en la Edge Function, igual que `level.js`/`level-calibration.js` en Bloque 3.
- `player-home.js`/`stats.js`/`groups.js` — son funciones puras que reciben `history`/`playerRef` como parámetro; no hace falta tocarlas si los partidos server-backed se traducen a la misma forma antes de llegar a ellas (ver §7).
- El selector de fecha/hora/lugar (`initManualDateTimeFields`, `manual-place-input`, `locations.js` para geocoding) — sigue funcionando igual, solo cambia qué pasa al tocar "Guardar".
- `search_players`/`get_public_profile`/`create_provisional_player`/`claim_provisional_player` (Bloque 4) — se consumen tal cual, sin ningún cambio de firma.

### 1.6 Migraciones y RPCs de Bloques 1–4 (compatibilidad verificada)

Leí las 4 migraciones aplicadas (`20260916120000`, `20260916180000`, `20260919120000`, `20260920120000` + sus 2 hotfixes de grants). Puntos que fijan restricciones de diseño para Bloque 5:

- **GRANT y RLS son capas separadas** (lección de Bloque 1 §13, repetida en Bloque 2 §6/Informe): toda tabla nueva de Bloque 5 necesita su `grant select on ... to authenticated` explícito además de las policies — Supabase de este proyecto tiene "Automatically expose new tables" desactivado. Este es el error más repetido del proyecto hasta ahora; lo marco explícitamente en el plan de implementación (§ de la Parte 2 del plan) como paso obligatorio a no saltear.
- **Patrón de escritura sensible**: toda escritura pasa por RPC `SECURITY DEFINER`, nunca por policy de `insert`/`update` directa — `matches`/`match_participants`/`match_revisions`/`match_sets`/`match_actions` heredan este mismo patrón sin excepción.
- **Patrón de error de negocio**: desde el hotfix de Bloque 4 (`claim_provisional_player`), un error de negocio esperable se devuelve como `jsonb {ok:false, code:...}` con `return`, nunca `raise exception` — porque una excepción revierte toda la transacción, incluido un `consume_rate_limit` ya incrementado. `create_or_attach_match` sigue este mismo contrato.
- **`players.type`** ya distingue `registered`/`provisional`; **`players.created_by_player_id`** ya existe (reservado en Bloque 1, usado por Bloque 4 para provisionales). Bloque 5 no necesita ninguna columna nueva en `players`.
- **`level_states`/`level_events`** no se tocan — Bloque 5 no escribe Nivel bajo ninguna circunstancia (ver Frontera con Bloque 6 más abajo).
- **`pilot_events`** ya declara `'match_created'`, `'match_validated'`, `'match_rejected'` en su CHECK desde Bloque 2, sin que ningún bloque los emita todavía. Bloque 5 puede emitir `'match_created'`/`'match_validated'` **sin tocar el CHECK**. **`'match_rejected'` queda deliberadamente sin emitirse** — es un vestigio del modelo `validar/rechazar` que `Backend_Infraestructura.md` §18.9 da por superado; no hay ningún caso en Bloque 5 (ni en Bloque 6 documentado) donde "rechazar" sea la respuesta normal a una discrepancia.

---

## 2. Arquitectura general propuesta

Bloque 5 introduce un único tramo de escritura sensible: crear/adjuntar un partido. Sigue el patrón exacto de Bloque 3 (única precedencia arquitectónica del repo para "escritura que depende de una regla compleja no trivial de reimplementar en SQL"):

```
Cliente (match-load.js + nuevo matches.js)
   │  POST con JWT + payload estructurado (participantes por player_id, sets crudos, formato, fecha)
   ▼
Edge Function `create-or-attach-match` (Deno)
   │  1. Verifica JWT → obtiene player_id del caller (igual que officialize-onboarding)
   │  2. Revalida sets/formato con el MISMO engine.js que usa el navegador (symlink real)
   │  3. Deriva sets normalizados + winner_team — el cliente nunca puede inyectar un
   │     winnerTeam que no corresponda a los games que declaró
   │  4. Llama a la RPC con la service role key
   ▼
RPC `create_or_attach_match` (SECURITY DEFINER, solo service_role)
   │  Idempotencia, validación de participantes, ventana de 14 días,
   │  canonicalización, búsqueda de candidato, creación o adjunción atómica,
   │  auditoría (match_actions), pilot_events.
   ▼
jsonb estructurado {ok, code, match_id, status, action_side, candidates?}
```

Por qué este patrón y no una RPC `authenticated` directa (como `complete_profile`): la validación de "¿es un score de set completo y válido para este formato?" es la MISMA regla que ya usa `engine.js` en el navegador. Reimplementarla en PL/pgSQL crearía una segunda fuente de verdad que puede divergir (el motivo exacto por el que Bloque 3 evitó reimplementar la fórmula de Nivel en SQL). La RPC en sí **sí** puede otorgarse a `authenticated` en lugar de `service_role` si se prefiere evitar una Edge Function nueva — lo dejo marcado como variante técnica menor en el Plan de Implementación, pero mi recomendación es mantener paridad con el patrón ya usado.

Las RPC de **solo lectura o escritura trivial** (`get_my_matches`, `get_match_detail`, `hide_match_for_me`, `get_pending_action_count`) no necesitan Edge Function — son `SECURITY DEFINER` otorgadas directo a `authenticated`, igual que `search_players`/`get_public_profile`/`list_my_provisional_players` de Bloque 4.

---

## 3. Modelo de datos exacto

> Esta sección es una **especificación**, no la migración final — el SQL exacto (con `comment on`, nombres de constraint, etc., siguiendo el estilo ya usado en `supabase/migrations/`) se escribe recién en la próxima ronda de implementación, nunca en esta.

### 3.1 `matches`

Entidad central: un encuentro de dobles ya jugado.

```
match_id                  uuid PK default gen_random_uuid()
created_by_player_id      uuid NOT NULL → players(player_id)
participant_fingerprint   text NOT NULL           -- ver §5.2, canonicalización de las 2 parejas
format_id                 text NOT NULL CHECK IN ('classic','americano')
scoring_system            text NULL               -- descriptivo, sin CHECK (ver §3.7), nunca autoritativo
played_at                 timestamptz NOT NULL    -- refleja SIEMPRE la revisión vigente (current_revision_id)
played_at_time_known      boolean NOT NULL DEFAULT true
reported_time_zone        text NULL               -- IANA, informativo/Intelligence, nunca autoritativo
location_name             text NULL
location_lat              numeric NULL
location_lng              numeric NULL
status                    text NOT NULL DEFAULT 'pending_validation'
                             CHECK IN ('pending_validation','validated','expired','annulled')
action_side               text NULL CHECK IN ('A','B')   -- ver invariante abajo
current_revision_id       uuid NULL → match_revisions(revision_id)  -- FK diferida (ver nota)
validation_deadline_at    timestamptz NOT NULL    -- created_at + 30 días, fijo, nunca se reinicia
validated_at              timestamptz NULL
annulled_at               timestamptz NULL        -- solo Bloque 6 (admin), Bloque 5 nunca escribe
annulment_reason          jsonb NULL              -- solo Bloque 6 (admin), Bloque 5 nunca escribe
created_at                timestamptz NOT NULL DEFAULT now()
updated_at                timestamptz NOT NULL DEFAULT now()
```

**Invariante de `action_side`** (documentar como comentario en la migración real): mientras `status='pending_validation'`, `action_side` es SIEMPRE el equipo opuesto a `match_revisions.proposed_by_team` de la revisión vigente (`current_revision_id`). Nunca es una fuente de verdad independiente — se recalcula y persiste junto con cada cambio de revisión, exclusivamente dentro de `create_or_attach_match`. Al validar/expirar/anular, pasa a `NULL`.

**Nota sobre la FK circular** `matches.current_revision_id ↔ match_revisions.match_id`: se resuelve como en cualquier par de tablas mutuamente referenciadas — `matches` se crea primero con `current_revision_id NULL`, se inserta la revisión 1, y un `UPDATE` fija el puntero, todo dentro de la misma transacción de la RPC. La FK se declara `DEFERRABLE INITIALLY DEFERRED` o simplemente se agrega en un segundo `ALTER TABLE` después de crear `match_revisions` en la misma migración.

**Quién escribe qué:** todo el ciclo de vida (creación, cambio de revisión, validación, `action_side`) lo escribe exclusivamente `create_or_attach_match` (`service_role`). `annulled_at`/`annulment_reason` quedan reservados para una futura RPC administrativa de Bloque 6 — la columna existe ahora para que Bloque 6 no necesite un `ALTER TABLE` sobre una tabla ya con datos reales.

**Índices:**
- `(participant_fingerprint, format_id, status)` — búsqueda de candidatos de create-or-attach.
- `(played_at)` — orden cronológico / filtro de ventana.
- Índice implícito por PK en `match_id`; índice por FK en `created_by_player_id`.

### 3.2 `match_participants`

Los 4 lugares del encuentro. Tabla de **estado actual** (no revisionada) — un reemplazo de participante por identidad incorrecta es una capacidad de Bloque 6 que actualiza esta fila en el futuro; Bloque 5 solo inserta, nunca actualiza.

```
match_id              uuid NOT NULL → matches(match_id) ON DELETE CASCADE
team                  text NOT NULL CHECK IN ('A','B')
position_in_team      smallint NOT NULL CHECK IN (1,2)
player_id             uuid NULL → players(player_id)     -- NULL reservado para "por identificar" (Bloque 6, nunca usado por Bloque 5)
display_name_snapshot text NOT NULL
created_at            timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (match_id, team, position_in_team)
```

**Invariante que Bloque 5 SÍ impone activamente:** al crear un partido, las 4 filas son NOT NULL en `player_id` — Bloque 5 nunca crea un slot "por identificar"; esa capacidad la introduce Bloque 6 (`No participé`). La columna es nullable solo para no forzar a Bloque 6 a un `ALTER TABLE` sobre una tabla ya con millones de filas reales de producción.

**Quién escribe:** exclusivamente `create_or_attach_match`, una sola vez por partido (las 4 filas del `INSERT` inicial). Nunca se actualiza en Bloque 5.

**Índices:** `(player_id)` — es el índice de mayor uso real (resolver "todos los partidos de este jugador" para `get_my_matches`/contador de pendientes).

### 3.3 `match_sets`

Resultado estructurado, **revisionado** (append-only): cada revisión conserva su propio conjunto de sets.

```
match_id        uuid NOT NULL → matches(match_id) ON DELETE CASCADE
revision_number integer NOT NULL
set_number      smallint NOT NULL CHECK IN (1,2,3)
games_a         smallint NOT NULL CHECK (games_a >= 0)
games_b         smallint NOT NULL CHECK (games_b >= 0)
tiebreak_a      smallint NULL
tiebreak_b      smallint NULL
PRIMARY KEY (match_id, revision_number, set_number)
FOREIGN KEY (match_id, revision_number) → match_revisions(match_id, revision_number)
```

`games_a`/`games_b` corresponden siempre a `team='A'`/`'B'` de `match_participants` de ESE partido — la orientación se fija en la revisión 1 y toda revisión posterior ya llega normalizada a esa misma orientación (normalización que hace `create_or_attach_match`, nunca el cliente).

**Quién escribe:** exclusivamente `create_or_attach_match`, un `INSERT` (1 a 3 filas) por cada revisión nueva. Append-only real: nunca `UPDATE`/`DELETE`.

### 3.4 `match_revisions`

Cada versión editable del partido.

```
revision_id         uuid PK default gen_random_uuid()
match_id            uuid NOT NULL → matches(match_id) ON DELETE CASCADE
revision_number     integer NOT NULL
proposed_by_player_id uuid NOT NULL → players(player_id)
proposed_by_team    text NOT NULL CHECK IN ('A','B')
source              text NOT NULL CHECK IN ('created','proposed_correction')
played_at           timestamptz NOT NULL
input_submission_id uuid NULL → match_submissions(idempotency_key)   -- trazabilidad, ver §3.5
created_at          timestamptz NOT NULL DEFAULT now()
UNIQUE (match_id, revision_number)
```

`source='created'` es siempre `revision_number=1`. `source='proposed_correction'` cubre tanto el camino de Bloque 5 (segunda carga con score distinto vía create-or-attach) como el futuro botón explícito "Proponer corrección" de Bloque 6 — es deliberadamente el mismo mecanismo, para que Bloque 6 no necesite un tipo de revisión nuevo.

No se revisiona `location`/`scoring_system` (quedan solo en `matches`, editables directo si algún día hiciera falta) — no son parte de la disputa oficial resultado/participantes que exige revisión auditada, y Backend_Infraestructura no los menciona entre los campos con ventana de corrección formal.

**Quién escribe:** exclusivamente `create_or_attach_match`.

### 3.5 `match_submissions` (tabla agregada, justificación en §5.5)

Registro de idempotencia — separado de `match_actions` porque tiene que sobrevivir incluso a un resultado de error/ambigüedad, y necesita guardar el payload de respuesta completo para poder repetirlo sin recalcular.

```
idempotency_key       uuid PK
submitted_by_player_id uuid NOT NULL → players(player_id)
payload_hash          text NOT NULL      -- sha256 del payload normalizado, detecta reuso indebido de la key
result_code           text NOT NULL      -- 'created' | 'matched_confirmed' | 'matched_revised' |
                                          -- 'matched_same_side' | 'already_validated' |
                                          -- 'ambiguous_candidates' | '<código de error>'
result_match_id       uuid NULL → matches(match_id)
result_payload        jsonb NOT NULL     -- la respuesta completa tal cual se le devolvió al cliente
created_at            timestamptz NOT NULL DEFAULT now()
```

**Quién escribe:** exclusivamente `create_or_attach_match`, una fila por intento lógico (nunca se actualiza; un reintento es una lectura, un intento realmente nuevo — con nueva información, como una respuesta de desambiguación — usa una `idempotency_key` nueva).

RLS: deny-by-default total (mismo criterio que `provisional_claims`/`api_rate_limits`) — nadie la lee ni escribe directo, ni siquiera `authenticated`.

### 3.6 `match_actions`

Bitácora de auditoría, append-only.

```
action_id       uuid PK default gen_random_uuid()
match_id        uuid NOT NULL → matches(match_id) ON DELETE CASCADE
action_type     text NOT NULL CHECK IN (
                    'created', 'declared_again_same_side', 'validated', 'revision_proposed',
                    -- valores reservados para Bloque 6, declarados ahora para no requerir
                    -- una migración de CHECK sobre una tabla con filas reales:
                    'confirmed', 'identity_questioned', 'participant_replaced',
                    'correction_timeout_resolved', 'annulled'
                 )
actor_player_id uuid NOT NULL → players(player_id)
acting_side     text NULL CHECK IN ('A','B')
revision_id     uuid NULL → match_revisions(revision_id)
occurred_at     timestamptz NOT NULL DEFAULT now()   -- SIEMPRE hora de servidor
reason_code     text NULL       -- sin CHECK deliberadamente: Bloque 6 va a agregar códigos nuevos
                                 -- sin necesitar otra migración de este archivo
metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
```

Bloque 5 solo emite `'created'`, `'declared_again_same_side'`, `'validated'`, `'revision_proposed'`. El resto de los valores del CHECK están declarados pero **sin ningún emisor todavía** — mismo criterio ya usado en `pilot_events`/`level_events` en Bloques 2/3 ("declarar estructura sin uso todavía" quedó explícitamente autorizado ahí cuando el valor pertenece a un contrato ya cerrado por la fuente maestra, que es exactamente este caso: Backend_Infraestructura §6.4 ya lista estas acciones como parte del contrato de `match_actions`).

### 3.7 `match_user_state`

Estado privado por usuario.

```
match_id                 uuid NOT NULL → matches(match_id) ON DELETE CASCADE
player_id                uuid NOT NULL → players(player_id)
hidden                   boolean NOT NULL DEFAULT false
hidden_at                timestamptz NULL
private_note             text NULL
private_note_updated_at  timestamptz NULL
updated_at               timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (match_id, player_id)
```

Ocultar nunca borra `matches`/`match_participants`/efectos oficiales — es exactamente una fila de preferencia personal, mismo criterio que `hidden_network_players`/`added_players` locales ya usan hoy (Store.js), solo que ahora vive server-side porque un partido compartido no puede depender de `localStorage` de un solo dispositivo.

**Quién escribe:** exclusivamente `hide_match_for_me` (para `hidden`) y una segunda llamada de la misma RPC o una hermana `set_match_private_note` (para `private_note` — ver Parte 6, RPCs) — nunca INSERT/UPDATE directo del cliente.

---

## 4. Estado y ciclo del partido

### 4.1 Estados server-side (columna `matches.status`)

| Estado | Quién lo fija | Efectos oficiales |
|---|---|---|
| `pending_validation` | `create_or_attach_match` al crear | Ninguno — nunca alimenta Nivel/estadísticas/Ranking. |
| `validated` | `create_or_attach_match` (Bloque 5, vía el camino de create-or-attach) **o** Bloque 6 (vía `Confirmar` explícito, todavía no implementado) | Los define Bloque 6; Bloque 5 no calcula ni persiste ningún efecto de Nivel. |
| `expired` | Ver Decisión Abierta #4 — en esta ronda, **calculado en lectura**, nunca escrito físicamente por Bloque 5. | Ninguno. |
| `annulled` | Exclusivo de una futura RPC administrativa de Bloque 6 | Ninguno (reversión de lo que hubiera). |

**Nunca existe `rejected`** como valor de columna — ninguna RPC de Bloque 5 lo usa ni lo necesita, conforme a la instrucción explícita del handoff y a la alineación ya cerrada en `Backend_Infraestructura.md` §18.9.

### 4.2 Estados locales de UI (nunca en `matches.status`)

| Estado local | Dónde vive | Significado |
|---|---|---|
| `draft` | Solo en memoria de `app.js` mientras se completa el formulario | Nada enviado todavía. Sin cambios respecto de hoy. |
| `sync_pending` | Nueva clave `bramulab.matchOutbox.v1` (ver Parte 7) | Enviado localmente, todavía sin respuesta confirmada del servidor. |
| `necesita_revision` | Mismo outbox, en la misma entrada | El servidor respondió pidiendo una decisión del usuario — reutiliza el concepto ya definido en `Experiencia_Inicial.md` §6.4 para "inconsistencia corregible", extendido para cubrir también el caso nuevo de `ambiguous_candidates` (§5.4). |

Una vez que el servidor confirma cualquier resultado final (creado, adjuntado, confirmado, revisado), la entrada sale del outbox — de ahí en más el partido es simplemente lo que diga `get_my_matches`, sin ningún estado local adicional.

### 4.3 Convivencia con `validated`/`expired`/`annulled` de Bloque 6

Bloque 5 deja las 4 columnas (`status`, `action_side`, `validation_deadline_at`, `validated_at`) listas para que Bloque 6 las use sin ningún cambio de esquema: Bloque 6 solo necesita agregar las RPC `Confirmar`/`Proponer corrección`/`No participé` que escriban sobre esas mismas columnas con la misma semántica que `create_or_attach_match` ya usa internamente (de hecho, gran parte de la lógica de "revisión nueva → `action_side` cambia de lado" que Bloque 5 implementa dentro de `create_or_attach_match` es literalmente la misma que Bloque 6 va a necesitar para su botón "Proponer corrección" — puede factorizarse en una función SQL interna compartida cuando llegue ese momento, sin romper nada de Bloque 5).

---

## 5. Create-or-attach

### 5.1 Separación conceptual

- **Idempotencia**: mismo envío/reintento del MISMO dispositivo para el MISMO intento lógico → nunca duplica nada, siempre devuelve el mismo resultado. Se resuelve enteramente con `match_submissions` (§5.5).
- **Deduplicación de encuentro**: dos participantes DISTINTOS cargan independientemente el mismo partido → deben converger en un único `match_id` cuando la coincidencia es inequívoca. Se resuelve con canonicalización + huella (§5.2) + búsqueda de candidatos (§5.3).

Son problemas ortogonales y las dos capas conviven: un reintento offline de un envío que YA fue absorbido por otro partido (create-or-attach de otra persona) debe reconciliar sin duplicar en ninguna de las dos dimensiones (ver Parte 7, reconciliación de outbox).

### 5.2 Canonicalización y huella (`participant_fingerprint`)

Backend_Infraestructura exige que la comparación sea "sin depender de si una UI las llamó A/B" — la composición de las **parejas** (no solo el conjunto de 4 personas) debe ser parte de la huella, porque los mismos 4 jugadores pueden jugar en distinta composición de pareja en dos encuentros genuinamente distintos (`Seba+Matu vs Lucho+Agus` un día, `Seba+Lucho vs Matu+Agus` otro día — nunca deben fusionarse).

Algoritmo, dado `pair_1 = {id1, id2}` y `pair_2 = {id3, id4}` tal como el cliente los envió:

1. `sorted_pair_1 = (min(id1,id2), max(id1,id2))`; `sorted_pair_2 = (min(id3,id4), max(id3,id4))` — orden lexicográfico de UUID como texto.
2. `canonical_first`, `canonical_second` = ordenar `sorted_pair_1` vs `sorted_pair_2` comparando su primer elemento — el que tenga el UUID menor va primero. Esto es 100% determinístico e independiente de qué pareja llamó cada cargador "A".
3. `participant_fingerprint = sha256(canonical_first[0] || ':' || canonical_first[1] || '|' || canonical_second[0] || ':' || canonical_second[1])`, codificado en hex.
4. `orientation`: si `canonical_first` corresponde a `pair_1` tal como lo envió el cliente, la orientación es directa; si corresponde a `pair_2`, hay que invertir los sets (`gamesA↔gamesB` de cada set) antes de comparar/persistir contra la orientación ya fijada por la revisión 1 del partido existente (si lo hay).

Al **crear** un partido nuevo (0 candidatos), la asignación de `team='A'`/`'B'` en `match_participants` puede ser arbitraria y estable (por ejemplo, `canonical_first` = equipo A) — no importa cuál sea, porque es interna a ese `match_id` y nunca se compara contra la etiqueta de otro partido.

### 5.3 Búsqueda de candidatos

```sql
select match_id, played_at, current_revision_id, action_side, status
from matches
where participant_fingerprint = :fp
  and format_id = :format_id
  and status in ('pending_validation', 'validated')   -- ver Decisión Abierta #2
  and played_at between (:played_at - ventana) and (:played_at + ventana)
```

**Ventana temporal** — ver Decisión Abierta #1 para el valor exacto recomendado; la regla general es más estricta cuando ambas partes conocen la hora exacta y más laxa (día calendario) cuando alguna de las dos cargó solo la fecha (`played_at_time_known=false`).

- **0 candidatos** → crear partido nuevo (revisión 1, `source='created'`), `action_side` = equipo opuesto al del cargador, `validation_deadline_at = now() + 30 días`. `pilot_events('match_created')`.
- **Exactamente 1 candidato** → adjuntar (§5.4).
- **N > 1 candidatos** → ambiguo, nunca fusionar solo: devolver `{ok:false, code:'ambiguous_candidates', candidates:[...]}` con un resumen de cada uno (fecha, score, formato) para que el cliente pregunte "¿es este partido?". El cliente reintenta con `p_disambiguation_match_id` (eligió uno) o `p_disambiguation_force_new=true` (es otro partido, crear igual) — usando una `idempotency_key` NUEVA (es un intento lógico distinto, con información nueva).

### 5.4 Lógica de adjunción (1 candidato resuelto, con o sin desambiguación)

Sea `R` la revisión vigente del candidato (`current_revision_id`) y `caller_team` el equipo del cargador ya normalizado a la orientación del candidato:

1. Normalizar los sets enviados a la orientación del candidato (según `orientation` de §5.2).
2. Comparar el score normalizado + ganador contra el de `R`.
3. **Si coincide exactamente:**
   - si `caller_team ≠ R.proposed_by_team` → **confirmación**: `status='validated'`, `validated_at=now()`, `action_side=NULL`. `match_actions('validated')`. `pilot_events('match_validated')`. Código de resultado `matched_confirmed`.
   - si `caller_team = R.proposed_by_team` → **redeclaración del mismo lado** (ej. la pareja del cargador original vuelve a cargar el mismo partido): sin cambio de estado. `match_actions('declared_again_same_side')`. Código `matched_same_side`.
4. **Si difiere:** siempre se crea una revisión nueva (`revision_number+1`, `source='proposed_correction'`, `proposed_by_team=caller_team`), `matches.current_revision_id` apunta a la nueva revisión, `matches.action_side` pasa al equipo OPUESTO a `caller_team` (sin importar cuál era antes — la regla es simétrica y cubre tanto "el rival corrige" como "el propio cargador se corrige a sí mismo antes de que el rival responda", ambos casos permitidos por `Experiencia_Inicial.md` §12.1). `match_actions('revision_proposed')`. Código `matched_revised`.
5. **Si el candidato ya está `validated`** (ver Decisión Abierta #2) y el score normalizado coincide con la revisión oficial → no-op informativo, código `already_validated`, sin crear nada nuevo. Si difiere, se rechaza explícitamente con `validated_match_needs_bloque6_correction` — Bloque 5 nunca reabre una corrección post-validación (eso es la ventana de 3 días de Bloque 6).

### 5.5 Por qué `match_submissions` (idempotencia dedicada)

Sin esta tabla, reintentar exactamente el mismo envío después de un corte de red podría:
- re-ejecutar la búsqueda de candidatos contra un estado de base que cambió entre medio (por ejemplo, un tercer partido que ahora también matchea, volviendo ambiguo algo que la primera vez no lo era), devolviendo una respuesta distinta la segunda vez — rompe la idempotencia real, no solo evita duplicar filas.
- perder el detalle exacto de una respuesta `ambiguous_candidates` ya mostrada al usuario, si el cliente necesita volver a leerla (por ejemplo, tras un refresh de página).

`match_submissions` guarda el `result_payload` completo la primera vez y lo devuelve tal cual ante cualquier reintento con la misma `idempotency_key`, sin volver a ejecutar ninguna lógica de negocio. Un intento con información nueva (por ejemplo, la respuesta a la desambiguación) usa una `idempotency_key` nueva — es, correctamente, un intento lógico distinto.

### 5.6 Concurrencia

Dos envíos simultáneos que representan el mismo encuentro: la RPC hace `select ... for update` sobre la fila candidata de `matches` (bloqueo de fila) antes de decidir crear vs. adjuntar. La segunda transacción concurrente espera el lock, ve el estado ya actualizado por la primera (o ve que ya existe el `match_id` que hubiera creado ella) y resuelve como "1 candidato" en vez de crear una fila paralela. Es el mismo patrón exacto que `officialize_level_onboarding` (Bloque 3) y `claim_provisional_player` (Bloque 4) ya usan y que la suite `verify-bloque4.mjs` ya probó con éxito contra Supabase real (`Promise.all` de 2 reclamos del mismo token, exactamente 1 gana).

### 5.7 Qué devuelve la RPC en cada caso (contrato completo)

```
{ok:true,  code:'created',           match_id, status:'pending_validation', action_side}
{ok:true,  code:'matched_confirmed', match_id, status:'validated'}
{ok:true,  code:'matched_same_side', match_id, status:<sin cambio>}
{ok:true,  code:'matched_revised',   match_id, status:'pending_validation', action_side}
{ok:true,  code:'already_validated', match_id, status:'validated'}
{ok:false, code:'ambiguous_candidates', candidates:[{match_id, played_at, format_id, sets_summary}]}
{ok:false, code:'validated_match_needs_bloque6_correction', match_id}
{ok:false, code:'pending_action_limit_reached'}
{ok:false, code:'played_at_too_old' | 'played_at_in_future'}
{ok:false, code:'not_a_participant' | 'duplicate_participant' | 'participant_not_found' | 'provisional_not_selectable'}
{ok:false, code:'idempotency_key_reused_with_different_payload'}
{ok:false, code:'rate_limited'}
```

Nunca `raise exception` para ninguno de estos — mismo criterio que `claim_provisional_player`.

---

## 6. Provisionales y Bloque 4

### 6.1 Lo que ya está garantizado sin cambios

El contrato de identidad de Bloque 4 ya alcanza para lo esencial: `players.player_id` de una provisional es estable, `create_provisional_player` nunca fusiona por nombre, y `claim_provisional_player` conserva ese mismo `player_id` al reclamar. Bloque 5 **no necesita ninguna migración de esos objetos** — solo necesita empezar a usarlos como `player_id` de un `match_participants`, lo cual ya es válido hoy (`players.type='provisional'` es una fila como cualquier otra).

### 6.2 Lo que falta para que la reutilización sea real (más allá del creador)

`list_my_provisional_players` (Bloque 4) solo devuelve provisionales creadas por el propio caller. Esto alcanza para el caso más simple del criterio de aceptación de Bloque 5 — "el mismo creador reutiliza su propio invitado en 2 partidos" — pero Backend_Infraestructura §8.5.2 pide explícitamente "reutilizar identidades provisionales **relacionadas**", y la experiencia de producto (§9.1 de Backend_Infraestructura: "puede reaparecer para usuarios relacionados") implica que si Juan (provisional) jugó conmigo en un partido, yo también debería poder reutilizar a Juan en un partido futuro con otras personas — no solo quien lo creó originalmente.

Propongo una RPC nueva: **`list_related_provisional_players()`** — devuelve provisionales que (a) el caller creó (`created_by_player_id = caller`, igual que hoy) **o** (b) aparecieron junto al caller en algún `match_participants` ya existente. Es una consulta de solo lectura, sin ningún riesgo de seguridad nuevo (nunca expone `auth_user_id`, mismo criterio que la RPC de Bloque 4), y no reemplaza `list_my_provisional_players` (que puede seguir usándose para pantallas que específicamente quieran "solo las mías").

### 6.3 El test literal pedido

El test que por primera vez demuestra "el mismo provisional aparece en dos partidos distintos con el mismo `player_id`" (ver matriz completa en `verify-bloque5.mjs`, Parte 12) necesita:

1. Cuenta real A crea una provisional P (`create_provisional_player`).
2. A carga Partido 1 usando a P en un slot (`create_or_attach_match`).
3. A carga Partido 2, distinto encuentro (fecha o pareja distinta), reutilizando el mismo `player_id` de P.
4. Verificar: `match_participants` de ambos partidos tiene la MISMA fila de `player_id` para P, con dos `match_id` distintos.
5. (Extensión, usando `list_related_provisional_players`) Un tercer jugador B, que compartió el Partido 1 con P, puede ver a P en su propia lista de "reutilizables" y cargar un Partido 3 con P sin ser quien la creó.
6. Reclamar P (`claim_provisional_player`, ya cerrado en Bloque 4) y verificar que los 3 partidos siguen apuntando al mismo `player_id` sin ninguna migración de fila.

---

## 7. Outbox / offline

### 7.1 Qué se guarda localmente y cuándo se borra

Nueva clave de storage `bramulab.matchOutbox.v1` (lista, no un dict — puede haber más de un envío pendiente simultáneo si el usuario carga varios partidos offline seguidos). Cada entrada:

```
{
  localDraftId,       // igual formato que hoy: 'm_' + timestamp36 + random — identidad LOCAL, para
                       // que la UI tenga algo estable mientras no hay match_id de servidor
  submissionId,       // uuid — la idempotency_key de ESTE intento lógico
  payload: { pair1PlayerIds, pair2PlayerIds, rawSets, formatId, scoringSystem,
             playedAt, playedAtTimeKnown, reportedTimeZone, locationName, locationLat, locationLng },
  privateNote,        // local hasta confirmar — se persiste en match_user_state recién al sincronizar
  state: 'sync_pending' | 'necesita_revision',
  lastError: { code, candidates? } | null,   // solo cuando state='necesita_revision'
  createdAt,
}
```

Se borra de `bramulab.matchOutbox.v1` en el momento en que el servidor confirma cualquier resultado FINAL (`created`/`matched_confirmed`/`matched_same_side`/`matched_revised`/`already_validated`) — nunca antes. Mientras el resultado sea `ambiguous_candidates` u otro error corregible, la entrada permanece con `state:'necesita_revision'` y el usuario puede reabrirla y decidir (elegir candidato, forzar nuevo, corregir el dato inválido) generando el siguiente intento con una `submissionId` nueva.

### 7.2 Reintento automático

Al recuperar conexión (o al abrir la app con entradas `sync_pending`), reintentar cada una con su MISMA `submissionId` — la idempotencia de `match_submissions` (§5.5) garantiza que un reintento nunca duplica, incluso si el primer envío en realidad ya había sido aceptado por el servidor y solo se perdió la respuesta de vuelta.

### 7.3 Reconciliación cuando el servidor devuelve `match_id`

Al recibir un resultado final, la app:
1. Quita la entrada de `bramulab.matchOutbox.v1`.
2. Si había `privateNote`, la persiste ahora vía la RPC de nota privada (§8, `match_user_state`).
3. Invalida/refresca el cache local de partidos de servidor (ver §8.1) para que el nuevo/actualizado `match_id` aparezca en Historial de inmediato, sin esperar el próximo `get_my_matches` completo.

No hace falta ninguna infraestructura nueva (sin colas, sin service worker con Background Sync) — el mismo patrón de "reintentar al recuperar conexión / al abrir la app" que ya usa el resto de la app para lo poco que tiene de tolerancia a cortes alcanza para el volumen del piloto.

---

## 8. Historial compartido

### 8.1 Traducción a la forma local existente (recomendación central de integración)

La recomendación de mayor impacto de todo este análisis: **traducir cada fila de servidor a la MISMA forma de objeto que ya usa `buildManualMatchSnapshot`** (§1.2) en un único punto de la app, en vez de enseñarle a `stats.js`/`player-home.js`/`groups.js` una forma nueva. Concretamente:

```
server row (get_my_matches) → {
  matchId: match_id,                       // el UUID real de servidor, no un id local
  playedAt, startedAt: playedAt, finishedAt: playedAt,
  players: [{id, team, name: display_name_snapshot, userId: player_id}] × 4,
  sets: [{gamesA, gamesB, tiebreak, winner}],   // de la revisión vigente
  winnerTeam, formatId, scoringSystem, location,
  privateNote,                              // de match_user_state propio
  // campos NUEVOS que hoy no existen en la forma local, sin romper nada de lo que ya la lee:
  status, actionSide, isActionable, validationDeadlineAt, validatedAt, serverBacked: true,
}
```

Esto es exactamente el mismo criterio que ya usó Bloque 2 con `Store.cacheServerUser` (comentario explícito en store.js:353-357: "el resto de la app... sigue funcionando sin ningún cambio... el `userId` pasa a ser el `player_id` real de Supabase... pero sigue siendo un string opaco"). `player-home.js`/`stats.js`/`groups.js` reciben siempre `history` como parámetro (confirmé que ninguno de los tres llama `Store.loadHistory()` por su cuenta) — con esta traducción, ninguno de esos 3 archivos necesita ningún cambio.

Consecuencia directa: los ~17 call sites de `Store.loadHistory()` en `app.js` deben pasar por **un único punto de entrada nuevo** (ej. `getEffectiveHistory()`) que devuelve `[...local legacy sin userId, ...servidor traducidos, ...outbox pendientes traducidos]`, en vez de que cada call site decida por su cuenta cómo mezclar — es la misma lección ya aplicada en V04.7 (memoria del repo: "real Home-without-Nivel nav bug fixed (single choke point `openPlayerHome`)") aplicada de nuevo acá para no repetir el mismo tipo de bug (un call site que se olvida de incluir los partidos de servidor).

### 8.2 Convivencia con el historial local sin romperlo

- Una cuenta **sin backend configurado** (`Auth.isConfigured()===false`) sigue viendo exactamente el comportamiento actual — cero cambios, mismo criterio dual-path que `auth.js` ya estableció.
- Una cuenta real pero **antes de que exista ningún partido server-backed** simplemente tiene `getEffectiveHistory()` devolviendo lo mismo que hoy (servidor vacío) — no hay diferencia visible.
- Los partidos LOCALES viejos sin `userId` (legacy, pre-V03.0) **no se migran automáticamente al servidor** — no hace falta y no corresponde (Backend_Infraestructura §2: "no se migrarán a Producción los partidos, cuentas o rankings simulados actuales"). Siguen existiendo como historia local del dispositivo, mezclados solo visualmente en la misma lista.
- **Badges honestos**: `pending_validation` se etiqueta "PENDIENTE DE VALIDACIÓN" (nunca contribuye a estadísticas oficiales), `expired` se etiqueta como tal y tampoco contribuye, `sync_pending` (local) se etiqueta "PENDIENTE DE SINCRONIZACIÓN" — los 3 textos ya están definidos en `Experiencia_Inicial.md` §6.2/§6.4/§11.3, ninguno nuevo.

### 8.3 No se propone ninguna migración automática de historial legacy

Ninguno de los ~200 partidos locales existentes en un dispositivo de prueba se convierte en fila de `matches` — el usuario simplemente empieza a cargar partidos nuevos server-backed desde que este bloque se despliegue, exactamente como ya decidió Backend_Infraestructura §2/§13.6 para el resto del prototipo.

---

## 9. Pendientes (soporte server-side, sin UX de resolución)

- **Contador personal**: `get_pending_action_count()` — cuenta, para el `player_id` del caller, cuántos `matches` tienen `status='pending_validation'` (no vencido, ver Decisión Abierta #4), el caller es participante, y `action_side` = el equipo del caller en ESE partido. No cuenta partidos donde el caller espera al otro lado (su `action_side` no es el suyo), ni incidencias post-validación (no existen todavía).
- **Límite de 5**: se aplica DENTRO de `create_or_attach_match`, antes de intentar cualquier búsqueda de candidato — si el conteo ya es ≥5, la RPC devuelve `pending_action_limit_reached` sin siquiera evaluar create-or-attach. Es correcto que el bloqueo sea "antes de intentar la carga" y no "antes de crear un partido nuevo específicamente", porque el usuario no puede saber de antemano si su carga va a crear o adjuntar (Experiencia_Inicial.md §10: el límite bloquea "seguir iniciando cargas").
- **`validation_deadline_at`**: fijo en `created_at + 30 días` al crear la revisión 1, nunca se reescribe por ninguna revisión posterior (Backend_Infraestructura §5.5/§8.6: "el deadline original nunca se reinicia") — literal en el diseño, `create_or_attach_match` nunca toca esta columna después del `INSERT` inicial.

No se implementa ninguna pantalla de "bandeja de pendientes" ni los botones `Confirmar`/`Proponer corrección`/`No participé` — eso es exactamente la frontera con Bloque 6.

---

## 10. Seguridad / RLS

Regla general heredada sin excepción: **deny-by-default**, GRANT y RLS son capas separadas (repetir el `grant select ... to authenticated` explícito en cada tabla nueva, la lección de Bloque 1 §13/Bloque 2 §Informe), toda escritura sensible pasa por RPC `SECURITY DEFINER`.

| Tabla | SELECT (`authenticated`) | INSERT/UPDATE directo | Vía RPC |
|---|---|---|---|
| `matches` | Participante del partido (`match_id in (select match_id from match_participants where player_id in (mis player_id))`) | Ninguno | `create_or_attach_match` (`service_role`) |
| `match_participants` | Igual regla (ver las otras 3 filas de un partido donde participo) | Ninguno | ídem |
| `match_sets` | Igual regla | Ninguno | ídem |
| `match_revisions` | Igual regla | Ninguno | ídem |
| `match_actions` | Igual regla (para la sección "Modificaciones") | Ninguno | ídem |
| `match_user_state` | Solo mi propia fila | Ninguno | `hide_match_for_me`, nota privada (`authenticated` directo, sin Edge Function — no depende del motor compartido) |
| `match_submissions` | Deny-by-default TOTAL (ni siquiera propio) | Ninguno | Uso interno exclusivo de `create_or_attach_match` |

- **Provisionales**: sin cambios de Bloque 4 — nunca tienen `auth_user_id` propio hasta el claim; su exposición en `match_participants` a otros participantes del mismo partido es exactamente lo que Backend_Infraestructura §9.1 autoriza ("reaparecer en... partidos... de usuarios relacionados").
- **No participantes**: `get_match_detail` devuelve vacío/null si el caller no es participante (mismo criterio de "nunca confirmar ni negar" que `get_public_profile` ya usa para una provisional inexistente) — nunca un error 403 que confirme que el `match_id` existe.
- **`service_role`**: necesita `grant select, insert, update on matches, match_participants, match_sets, match_revisions, match_actions, match_submissions to service_role` — mismo patrón que `level_states`/`level_events` en Bloque 3. `match_user_state` no necesita grant a `service_role` (nunca la toca la Edge Function).
- **`anon`**: cero acceso a cualquiera de las 7 tablas y cero RPC nuevas otorgadas a `anon` — a diferencia de `is_username_available` (Bloque 3), nada de Bloque 5 tiene sentido antes de tener sesión.

---

## 11. Baseline local (sin tocar código de producto)

- `git status` al iniciar: limpio salvo los 2 untracked ya conocidos (`Referencias/`, `docs/identidad-visual/Logo.ai`) — **no tocados** en esta ronda.
- `git fetch` + fast-forward de `staging`: `877069c` → `3e373146b45cce7c410433632d81ae6c54ff6082` (HEAD esperado por el handoff), sin conflictos.
- Suite local completa (`bramulab/tests.html`, corrida real en navegador vía el dev server del proyecto): **1408/1408 — todo verde**, sin cambios respecto del baseline documentado al cierre de Bloque 4.
- Tests de infraestructura Node (`bramulab/scripts/env-guard.test.mjs` + `bramulab/api/health.test.mjs`): **17/17 verdes**.
- `node --check` sobre los 9 módulos de `bramulab/*.js` (app.js, store.js, match-load.js, player-home.js, stats.js, player-identity.js, groups.js, locations.js, auth.js): sin errores de sintaxis.
- No se corrió ningún `verify-bloque*.mjs` contra Supabase real (piden `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` reales) ni ningún comando del Supabase CLI — conforme a la instrucción explícita de no tocar servicios remotos en esta ronda.

---

## 12. Riesgos

| Riesgo | Mitigación en este diseño |
|---|---|
| Divergencia entre la validación de sets del navegador y la del servidor | Reutilizar `engine.js` vía symlink en la Edge Function (mismo patrón ya probado en Bloque 3), nunca reimplementar en SQL. |
| Fusión incorrecta de dos partidos distintos entre las mismas 4 personas | Huella incluye composición de pareja, no solo el conjunto de 4 IDs; ventana temporal acotada; ambigüedad nunca se resuelve sola. |
| Reintento offline duplica un partido | `match_submissions` con `idempotency_key` estable + lock de fila en la búsqueda de candidato. |
| Un provisional termina inutilizable fuera del creador original | `list_related_provisional_players` nueva (§6.2) — sin ella, la promesa de "invitado persistente y reutilizable" de Backend_Infraestructura §9.1 queda parcialmente incumplida en la práctica. |
| Repetir el error de GRANT/RLS de Bloques 1–2 | Checklist explícito en el Plan de Implementación: cada tabla nueva necesita su `grant select ... to authenticated` Y su policy — ninguna de las dos alcanza sola. |
| `action_side` y la revisión vigente se desincronizan con el tiempo | `action_side` documentado como estrictamente derivado de `proposed_by_team` de la revisión vigente, escrito únicamente dentro de la misma transacción que cambia la revisión. |
| Historial local (17 call sites de `Store.loadHistory()`) se actualiza a medias, algunos siguen sin ver partidos de servidor | Único punto de entrada `getEffectiveHistory()` (§8.1), mismo criterio ya aplicado en V04.7 para un bug de navegación análogo. |
| "Eliminar partido" borra de verdad un partido compartido | El botón debe distinguir explícitamente partido local (borra) vs. server-backed (`hide_match_for_me`, nunca borra) — marcado como punto de atención concreto en el mapa de `app.js` (Parte 12/§12 del Plan). |
| Reglas 14/30 días bypaseadas por reloj de cliente | Toda ventana temporal se valida con `now()` de Postgres dentro de la RPC, nunca con la fecha que declara el payload. |

---

## 13. Decisiones abiertas (requieren revisión de Sebastián/ChatGPT)

### DECISIÓN ABIERTA #1 — Duración exacta de la "ventana temporal compatible" de create-or-attach

Ningún documento maestro fija un número. Alternativas:

- **A (recomendada)**: ±3 horas cuando ambas cargas declaran hora conocida; mismo día calendario en `America/Argentina/Buenos_Aires` cuando alguna de las dos declaró solo fecha (sin hora) — reutiliza el mismo huso horario que Ranking BRAMU ya usa como ancla (Backend_Infraestructura §5.5), sin inventar una regla nueva de zona horaria.
- **B**: ventana fija más angosta (ej. ±1 hora) — reduce el riesgo de fusionar 2 partidos reales jugados el mismo día por las mismas 4 personas (ej. torneo con revancha), pero aumenta el riesgo de que 2 cargas legítimas del mismo partido con estimaciones de hora distintas no se reconozcan como el mismo encuentro y generen 2 partidos pendientes en paralelo.
- **C**: ventana más amplia (ej. ±6 horas o "mismo día calendario" siempre, sin importar si la hora es conocida) — prioriza nunca duplicar por sobre nunca fusionar de más.

**Impacto de la elección**: A es un punto medio razonable para un padel social (partido de ~1.5-2h); si Sebastián sabe que sus jugadores repiten partidos el mismo día con frecuencia real, B es más seguro; si el problema real observado en el piloto termina siendo "duplicados" más que "fusiones erróneas", C es preferible.

### DECISIÓN ABIERTA #2 — Alcance de create-or-attach frente a un partido YA validado

- **A (recomendada)**: la búsqueda de candidatos también considera partidos `validated` con la misma huella/formato/ventana. Si el score normalizado coincide exactamente, se responde `already_validated` (informativo, no crea nada). Si difiere, se rechaza explícitamente con `validated_match_needs_bloque6_correction` — sin crear un partido duplicado, pero también sin intentar resolver la discrepancia (eso es la ventana de 3 días de corrección normal de Bloque 6, fuera de alcance).
- **B**: la búsqueda de candidatos ignora completamente los partidos `validated` — cualquier carga tardía sobre un encuentro ya oficializado simplemente crea un partido nuevo, independiente, que eventualmente expira sin efecto. Más simple de implementar en Bloque 5, pero dejaría un registro "fantasma" duplicado en el historial hasta que expire (30 días), lo cual puede leerse como confuso para el usuario aunque nunca afecte Nivel/estadísticas.

**Impacto de la elección**: A es algo más de trabajo en Bloque 5 (una rama de código adicional) pero evita una experiencia rara; B es más rápido de construir ahora y desplaza el problema a Bloque 6.

### DECISIÓN ABIERTA #3 — Alcance de "provisionales relacionadas" en esta ronda

- **A (recomendada)**: incluir `list_related_provisional_players` (§6.2) en Bloque 5, para que cualquier co-participante de un partido ya cargado —no solo el creador original de la provisional— pueda reutilizarla en un partido futuro. Es lo que la experiencia de producto describe ("puede reaparecer para usuarios relacionados") y evita que la promesa de "invitado persistente" quede coja en la práctica.
- **B**: limitar Bloque 5 a que solo el creador original reutilice sus propias provisionales (`list_my_provisional_players`, sin cambios). Bloque 5 queda más chico y rápido; la reutilización "por terceros relacionados" se pospone a una ronda posterior (podría ser parte de Bloque 6, ya que ahí también se trabaja fuerte con identidad de participantes).

**Impacto de la elección**: A agrega una RPC de solo lectura, bajo riesgo técnico; B reduce el alcance de esta ronda a costa de una funcionalidad que la documentación de producto sí describe como parte del comportamiento esperado del invitado.

### DECISIÓN ABIERTA #4 — Mecanismo de expiración a `expired`

- **A (recomendada para esta ronda)**: cálculo perezoso en lectura — ninguna fila física cambia a `expired` sola; `get_my_matches`/`get_match_detail`/`get_pending_action_count` tratan `status='pending_validation' AND now() > validation_deadline_at` como vencido para efectos de presentación y de conteo de pendientes, sin escribir nada. No requiere infraestructura nueva (sin `pg_cron`), consistente con "no sobreingenierizar" del pedido.
- **B**: persistir la transición físicamente mediante un job programado (`pg_cron`, disponible en Supabase) que corre periódicamente y hace `UPDATE matches SET status='expired' WHERE ...`. Más correcto para reportes/métricas agregadas que necesiten filtrar por `status` sin repetir la comparación de fecha en cada query, pero introduce una pieza de infraestructura nueva y un timing exacto (¿cada cuánto corre?) que hay que decidir y probar.

**Impacto de la elección**: A es lo mínimo necesario para que Bloque 5 cumpla su propio criterio de cierre sin construir infraestructura que Backend_Infraestructura no pide todavía; B es más robusto a largo plazo (Bloque 7/Ranking/Intelligence eventualmente van a querer filtrar "partidos vencidos" de forma barata) y podría convenir introducirlo recién cuando ese consumo real aparezca.

---

## 14. Definición de cierre de Bloque 5

Bloque 5 puede darse por cerrado cuando, contra Supabase/Vercel Staging real:

- un partido cargado en un dispositivo aparece exactamente una vez en el historial de cada uno de sus 4 participantes (incluidos provisionales, vía `list_related_provisional_players` si se adopta la Decisión #3-A);
- cargar sin conexión conserva el borrador, lo muestra como `PENDIENTE DE SINCRONIZACIÓN`, y reintenta sin duplicar tras recuperar conexión;
- dos cargas independientes del mismo encuentro (mismos 4 `player_id`, misma composición de pareja, ventana temporal compatible, mismo formato) convergen en un único `match_id`, con o sin coincidencia de score, sin excepción;
- una coincidencia ambigua nunca se fusiona sola — siempre pide confirmación explícita;
- ningún partido `pending_validation`/`expired` modifica `level_states`, estadísticas, ni Ranking;
- el mismo invitado provisional aparece, con el mismo `player_id`, en 2+ partidos distintos, demostrado con un test real contra Supabase Staging (no solo conceptualmente);
- reclamar esa provisional después no requiere migrar ninguna fila de `matches`/`match_participants`;
- el límite de 5 pendientes accionables bloquea nuevas cargas exactamente como describe `Experiencia_Inicial.md` §10;
- ocultar un partido para mí (`hide_match_for_me`) nunca lo elimina para los demás participantes;
- toda tabla nueva pasó las pruebas de RLS positivas y negativas (participante lee, no-participante no lee, `anon` no lee nada);
- la suite local (`tests.html`) sigue en 1408/1408 sin ninguna regresión sobre lo que ya funcionaba.

---

## 15. Confirmación de alcance respetado

- **No** se aplicó ninguna migración a Supabase (ni Staging ni ningún otro proyecto).
- **No** se tocó ninguna configuración de Vercel.
- **No** se modificó `main`.
- **No** se modificó Production.
- **No** se tocó BRAMUlive.
- **No** se borraron ni modificaron datos de QA de Bloque 4 (`@claim_mualea_20`, `@claimb4h11`, `@normalb4h11` — no se los referenció en ninguna operación de esta ronda).
- **No** se generaron secretos ni se leyó ninguna variable de entorno con credenciales reales.
- **No** se modificó ningún archivo de código de producto (`bramulab/*.js`, `bramulab/index.html`, `supabase/migrations/*.sql`, `supabase/functions/*`) — verificado con `git status` antes y después de esta ronda.
- Los únicos archivos modificados por esta ronda son los dos documentos de `docs/BRAMUlab/Implementacion/Backend/Bloque_05/`, commiteados y pusheados únicamente a `staging`.
