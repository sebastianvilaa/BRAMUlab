-- BRAMUlab — Bloque 5: Partidos compartidos e historial — esquema base.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_05/{02_Analisis_Claude.md,04_Revision_ChatGPT.md}
-- para el razonamiento completo. Resumen de esta migración:
--
--   1) `matches` — un encuentro de dobles ya jugado. Nace SIEMPRE `pending_validation`, con
--      `validation_deadline_at = created_at + 30 días` fijo (Backend_Infraestructura.md §5.5).
--      `action_side` es una columna DERIVADA, mantenida en sincronía por
--      `create_or_attach_match` con `proposed_by_team` de la revisión vigente — nunca una
--      fuente de verdad independiente. Sin `status='rejected'`: no existe esa respuesta normal
--      (Backend_Infraestructura.md §18.9).
--   2) `match_participants` — los 4 lugares del encuentro, por player_id (registrado o
--      provisional). Tabla de estado ACTUAL, no revisionada: Bloque 5 solo inserta, nunca
--      actualiza (el reemplazo de un participante es comportamiento de Bloque 6).
--   3) `match_submissions` — idempotencia dedicada (séptima tabla, más allá de las 6 pedidas
--      por el handoff, justificada en 02_Analisis_Claude.md §5.5): un reintento exacto de la
--      MISMA `idempotency_key` devuelve el `result_payload` ya calculado, sin volver a
--      ejecutar ninguna lógica de negocio ni siquiera para un resultado de error/ambigüedad.
--   4) `match_revisions` — cada versión editable del partido (revisión 1 = 'created',
--      siguientes = 'proposed_correction' — mismo mecanismo que va a reutilizar el futuro
--      botón "Proponer corrección" de Bloque 6, sin inventar un tipo de revisión nuevo).
--   5) `match_sets` — resultado estructurado, revisionado (append-only): cada revisión
--      conserva su propio conjunto de sets, siempre en la orientación team_a/team_b fija de
--      ESE partido (ver `create_or_attach_match`, próxima migración, para la canonicalización).
--   6) `match_actions` — bitácora de auditoría append-only. Declara ya los `action_type` que
--      Bloque 6 va a necesitar (mismo criterio que `pilot_events`/`level_events` en Bloques
--      2/3: declarar estructura sin uso todavía, cuando el valor ya pertenece a un contrato
--      cerrado por la fuente maestra).
--   7) `match_user_state` — ocultamiento/nota privada por participante. Ocultar NUNCA borra el
--      partido compartido ni sus efectos oficiales (Backend_Infraestructura.md §8.8).
--
-- RLS deny-by-default en las 7 tablas: SELECT solo para participantes del partido (o propia
-- fila en `match_user_state`); CERO insert/update/delete para authenticated/anon en ninguna —
-- toda escritura pasa por las RPC SECURITY DEFINER de las próximas 2 migraciones.
--
-- GRANT y RLS son capas separadas (lección de Bloque 1 §13 / Bloque 2 Informe, "Automatically
-- expose new tables" está desactivado en este proyecto): cada tabla nueva de acá abajo tiene su
-- propio `grant select ... to authenticated` explícito, además de la policy.
--
-- Deliberadamente FUERA de esta migración (no le corresponde a Bloque 5):
--   - Confirmar / Proponer corrección / No participé como acciones explícitas de usuario: Bloque 6.
--   - `notifications`: Bloque 6 (Backend_Infraestructura.md §15).
--   - cualquier efecto sobre `level_states`/`level_events`/Ranking: Bloque 6/7.
--   - expiración física a `expired` (pg_cron u otro job): Decisión #4 de 04_Revision_ChatGPT.md
--     — Bloque 5 la calcula perezosamente en lectura (próxima migración), nunca la escribe acá.
--   - reemplazo de participante / slot "por identificar": Bloque 6. `match_participants.player_id`
--     queda NULLABLE solo para que Bloque 6 no necesite un ALTER TABLE sobre una tabla con datos
--     reales — Bloque 5 nunca inserta un slot sin player_id resuelto.
--   - `annulled_at`/`annulment_reason` de `matches`: reservados para una futura RPC
--     administrativa de Bloque 6 — Bloque 5 nunca los escribe.

-- ------------------------------------------------------------------
-- 1) matches
-- ------------------------------------------------------------------

create table public.matches (
  match_id                uuid primary key default gen_random_uuid(),
  created_by_player_id    uuid not null references public.players (player_id),
  participant_fingerprint text not null,
  format_id               text not null check (format_id in ('classic', 'americano')),
  -- Descriptivo (cómo se llegó al resultado game a game), nunca autoritativo: no decide
  -- ganador ni participa de la deduplicación. Sin CHECK a propósito — Engine.SCORING_SYSTEMS
  -- puede crecer sin necesitar otra migración de esta tabla.
  scoring_system          text,
  -- Refleja SIEMPRE la revisión vigente (current_revision_id); se actualiza junto con ella.
  played_at               timestamptz not null,
  played_at_time_known    boolean not null default true,
  reported_time_zone      text,
  location_name           text,
  location_lat            numeric,
  location_lng            numeric,
  status                  text not null default 'pending_validation'
                             check (status in ('pending_validation', 'validated', 'expired', 'annulled')),
  action_side             text check (action_side is null or action_side in ('A', 'B')),
  -- Sin FK físico a match_revisions (evita la referencia circular entre ambas tablas): la
  -- integridad la garantiza que ÚNICAMENTE create_or_attach_match escribe ambas, siempre
  -- dentro de la misma transacción.
  current_revision_id     uuid,
  validation_deadline_at  timestamptz not null,
  validated_at            timestamptz,
  annulled_at             timestamptz,
  annulment_reason        jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.matches is
  'Un encuentro de dobles ya jugado. Nace pending_validation; validation_deadline_at nunca se
   reinicia. Toda escritura exclusiva de create_or_attach_match (service_role) — ver la próxima
   migración. annulled_at/annulment_reason reservados para una futura RPC administrativa de
   Bloque 6, sin escritor todavía.';
comment on column public.matches.action_side is
  'Derivado, no autoritativo por sí solo: mientras status=pending_validation, es SIEMPRE el
   equipo opuesto a proposed_by_team de la revisión vigente (current_revision_id). NULL en
   cualquier otro estado. Mantenido en sincronía únicamente por create_or_attach_match.';
comment on column public.matches.participant_fingerprint is
  'sha256 hex de los 4 player_id canonicalizados por pareja (nunca por nombre) — ver
   create_or_attach_match. Independiente del orden A/B con que cada cargador etiquetó su
   propia pareja.';

-- ------------------------------------------------------------------
-- 2) match_participants
-- ------------------------------------------------------------------

create table public.match_participants (
  match_id              uuid not null references public.matches (match_id) on delete cascade,
  team                  text not null check (team in ('A', 'B')),
  position_in_team      smallint not null check (position_in_team in (1, 2)),
  player_id             uuid references public.players (player_id),
  display_name_snapshot text not null,
  created_at            timestamptz not null default now(),
  primary key (match_id, team, position_in_team)
);

comment on table public.match_participants is
  'Los 4 lugares del encuentro. Estado ACTUAL, no revisionada — Bloque 5 solo hace un INSERT de
   4 filas al crear el partido, nunca UPDATE. player_id nullable únicamente para un futuro slot
   "por identificar" de Bloque 6; Bloque 5 siempre inserta las 4 filas con player_id resuelto.';

-- ------------------------------------------------------------------
-- 3) match_submissions — idempotencia dedicada
-- ------------------------------------------------------------------

create table public.match_submissions (
  idempotency_key        uuid primary key,
  submitted_by_player_id uuid not null references public.players (player_id),
  payload_hash           text not null,
  result_code            text not null,
  result_match_id        uuid references public.matches (match_id),
  result_payload         jsonb not null,
  created_at             timestamptz not null default now()
);

comment on table public.match_submissions is
  'Idempotencia por intento lógico. Un reintento exacto de la misma idempotency_key devuelve
   result_payload tal cual, sin recalcular nada — incluso para un resultado de error o de
   ambigüedad. Un intento con información nueva (p. ej. la respuesta a una desambiguación) usa
   una idempotency_key nueva. RLS deny-by-default TOTAL: uso interno exclusivo de
   create_or_attach_match.';

-- ------------------------------------------------------------------
-- 4) match_revisions
-- ------------------------------------------------------------------

create table public.match_revisions (
  revision_id           uuid primary key default gen_random_uuid(),
  match_id              uuid not null references public.matches (match_id) on delete cascade,
  revision_number       integer not null check (revision_number > 0),
  proposed_by_player_id uuid not null references public.players (player_id),
  proposed_by_team      text not null check (proposed_by_team in ('A', 'B')),
  source                text not null check (source in ('created', 'proposed_correction')),
  played_at             timestamptz not null,
  input_submission_id   uuid references public.match_submissions (idempotency_key),
  created_at            timestamptz not null default now(),
  unique (match_id, revision_number)
);

comment on table public.match_revisions is
  'Cada versión editable del partido. revision_number=1 siempre source=created. Los siguientes
   son SIEMPRE proposed_correction — mismo mecanismo que create_or_attach_match usa cuando una
   segunda carga trae un score distinto (Bloque 5) y que el futuro botón explícito "Proponer
   corrección" de Bloque 6 va a reutilizar sin inventar un tipo nuevo.';

-- ------------------------------------------------------------------
-- 5) match_sets
-- ------------------------------------------------------------------

create table public.match_sets (
  match_id        uuid not null references public.matches (match_id) on delete cascade,
  revision_number integer not null,
  set_number      smallint not null check (set_number between 1 and 3),
  games_a         smallint not null check (games_a >= 0),
  games_b         smallint not null check (games_b >= 0),
  tiebreak_a      smallint,
  tiebreak_b      smallint,
  primary key (match_id, revision_number, set_number),
  foreign key (match_id, revision_number) references public.match_revisions (match_id, revision_number)
);

comment on table public.match_sets is
  'Resultado estructurado, revisionado (append-only). games_a/games_b corresponden SIEMPRE a
   team=A/B de match_participants de ESE partido — la orientación se fija en la revisión 1 y
   toda revisión posterior ya llega normalizada a esa misma orientación por
   create_or_attach_match, nunca por el cliente.';

-- ------------------------------------------------------------------
-- 6) match_actions — bitácora append-only
-- ------------------------------------------------------------------

create table public.match_actions (
  action_id       uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.matches (match_id) on delete cascade,
  action_type     text not null check (action_type in (
                     -- Emitidos por Bloque 5:
                     'created', 'declared_again_same_side', 'validated', 'revision_proposed',
                     -- Reservados para Bloque 6 (Backend_Infraestructura.md §6.4 ya los declara
                     -- como parte del contrato de match_actions) — sin emisor todavía, mismo
                     -- criterio que pilot_events/level_events en Bloques 2/3.
                     'confirmed', 'identity_questioned', 'participant_replaced',
                     'correction_timeout_resolved', 'annulled'
                   )),
  actor_player_id uuid not null references public.players (player_id),
  acting_side     text check (acting_side is null or acting_side in ('A', 'B')),
  revision_id     uuid references public.match_revisions (revision_id),
  occurred_at     timestamptz not null default now(),
  -- Sin CHECK a propósito: Bloque 6 va a agregar códigos nuevos sin necesitar otra migración
  -- de este archivo (mismo criterio ya aceptado para columnas de auditoría extensibles).
  reason_code     text,
  metadata        jsonb not null default '{}'::jsonb
);

comment on table public.match_actions is
  'Bitácora de auditoría append-only. Bloque 5 solo emite created/declared_again_same_side/
   validated/revision_proposed. occurred_at es SIEMPRE hora de servidor (default now()), nunca
   un valor que el cliente pueda mandar.';

-- ------------------------------------------------------------------
-- 7) match_user_state
-- ------------------------------------------------------------------

create table public.match_user_state (
  match_id                uuid not null references public.matches (match_id) on delete cascade,
  player_id               uuid not null references public.players (player_id),
  hidden                  boolean not null default false,
  hidden_at               timestamptz,
  private_note            text,
  private_note_updated_at timestamptz,
  updated_at              timestamptz not null default now(),
  primary key (match_id, player_id)
);

comment on table public.match_user_state is
  'Estado privado por usuario. Ocultar (hidden=true) nunca borra matches/match_participants ni
   sus efectos oficiales — mismo criterio que hidden_network_players/added_players locales
   (store.js), ahora server-side porque un partido compartido no puede depender de localStorage
   de un solo dispositivo.';

-- ------------------------------------------------------------------
-- RLS — deny-by-default, SELECT solo para participantes (o propia fila)
-- ------------------------------------------------------------------

alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_sets enable row level security;
alter table public.match_revisions enable row level security;
alter table public.match_actions enable row level security;
alter table public.match_user_state enable row level security;
alter table public.match_submissions enable row level security;
-- match_submissions: deny-by-default TOTAL, cero políticas (mismo criterio que
-- provisional_claims/api_rate_limits en Bloque 4) — ni siquiera el propio autor la lee directo.

create policy "matches_select_participant"
  on public.matches
  for select
  to authenticated
  using (
    match_id in (
      select match_id from public.match_participants
      where player_id in (select player_id from public.players where auth_user_id = auth.uid())
    )
  );

create policy "match_participants_select_participant"
  on public.match_participants
  for select
  to authenticated
  using (
    match_id in (
      select match_id from public.match_participants
      where player_id in (select player_id from public.players where auth_user_id = auth.uid())
    )
  );

create policy "match_sets_select_participant"
  on public.match_sets
  for select
  to authenticated
  using (
    match_id in (
      select match_id from public.match_participants
      where player_id in (select player_id from public.players where auth_user_id = auth.uid())
    )
  );

create policy "match_revisions_select_participant"
  on public.match_revisions
  for select
  to authenticated
  using (
    match_id in (
      select match_id from public.match_participants
      where player_id in (select player_id from public.players where auth_user_id = auth.uid())
    )
  );

create policy "match_actions_select_participant"
  on public.match_actions
  for select
  to authenticated
  using (
    match_id in (
      select match_id from public.match_participants
      where player_id in (select player_id from public.players where auth_user_id = auth.uid())
    )
  );

create policy "match_user_state_select_own"
  on public.match_user_state
  for select
  to authenticated
  using (player_id in (select player_id from public.players where auth_user_id = auth.uid()));

-- Sin políticas de insert/update/delete en ninguna de las 7 tablas para authenticated/anon:
-- toda escritura pasa por las RPC SECURITY DEFINER de las próximas 2 migraciones.

-- ------------------------------------------------------------------
-- GRANTs — capa separada de RLS, ninguna de las dos alcanza sola en este proyecto
-- ------------------------------------------------------------------

grant select on table public.matches to authenticated;
grant select on table public.match_participants to authenticated;
grant select on table public.match_sets to authenticated;
grant select on table public.match_revisions to authenticated;
grant select on table public.match_actions to authenticated;
grant select on table public.match_user_state to authenticated;
-- match_submissions: sin grant a authenticated/anon a propósito.

grant select, insert, update, delete on table public.matches to service_role;
grant select, insert, update, delete on table public.match_participants to service_role;
grant select, insert, update, delete on table public.match_sets to service_role;
grant select, insert, update, delete on table public.match_revisions to service_role;
grant select, insert, update, delete on table public.match_actions to service_role;
grant select, insert, update, delete on table public.match_user_state to service_role;
grant select, insert, update, delete on table public.match_submissions to service_role;

-- ------------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------------

create index matches_fingerprint_idx on public.matches (participant_fingerprint, format_id, status);
create index matches_played_at_idx on public.matches (played_at);
create index match_participants_player_id_idx on public.match_participants (player_id);
