-- BRAMUlab — Bloque 6: incidencias de identidad + extensiones de matches/match_actions/level_events.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.4/§3.6,
-- 03_Plan_Implementacion_Claude.md §1.2/§1.3}. Resumen:
--
--   1) `matches.pending_correction_revision_id` — revisión propuesta post-validación EN ESPERA.
--      No mueve `current_revision_id` (que sigue apuntando a la última revisión OFICIAL)
--      mientras la pareja contraria no acepta — Nivel_BRAMU_Formula_V1.5.md §12.3/
--      Experiencia_Inicial.md §12.3: "la última versión validada sigue siendo la oficial"
--      mientras se decide. Sin FK físico, mismo criterio que `current_revision_id` (comentario
--      original de bloque5_matches_core.sql: evita la referencia circular entre matches y
--      match_revisions — la integridad la garantizan las RPCs de Bloque 6, siempre dentro de la
--      misma transacción).
--   2) `match_actions.action_type` — Bloque 5 ya reservó `validated`, `identity_questioned`,
--      `participant_replaced`, `correction_timeout_resolved`, `annulled`. Se agregan
--      `correction_accepted` (falta un tipo para "la pareja contraria aceptó la corrección
--      post-validación", distinto de proponerla) y `participant_unidentified` (falta un tipo
--      para "se venció la ventana de 7 días sin identificar al jugador correcto").
--   3) `level_events.event_type` — se agregan los 4 tipos que el comentario de la migración de
--      Bloque 3 dejó anticipados: `match_delta`, `match_correction_reversal`,
--      `match_correction_reapply`, `identity_reassignment_delta`. Se agregan también
--      `match_id`/`match_level_result_id` (nullable, solo se completan en estos 4 tipos nuevos)
--      para poder trazar cada delta hasta el partido/resultado que lo originó.
--   4) `match_identity_issues` — ciclo de vida de una incidencia de identidad por slot. Único
--      índice parcial: como máximo una incidencia `open` por slot a la vez.
--   5) `_bloque6_refresh_participant_fingerprint(match_id)` — 08_Revision_Central_Adicional.md
--      B6-B-04: mantiene matches.participant_fingerprint sincronizado con match_participants
--      tras cualquier cambio de identidad, reutilizando exactamente el mismo hash de Bloque 5.

-- ------------------------------------------------------------------
-- 1) matches.pending_correction_revision_id
-- ------------------------------------------------------------------

alter table public.matches
  add column if not exists pending_correction_revision_id uuid;

comment on column public.matches.pending_correction_revision_id is
  'Revisión post-validación propuesta y todavía EN ESPERA de que la pareja contraria acepte o
   venza la ventana de 3 días (Bloque 6). NULL en cualquier otro momento. Sin FK físico, mismo
   criterio que current_revision_id: la integridad la garantizan
   propose_post_validation_correction/respond_post_validation_correction, siempre dentro de la
   misma transacción.';

-- ------------------------------------------------------------------
-- 2) match_actions.action_type — extender el CHECK existente
-- ------------------------------------------------------------------

alter table public.match_actions
  drop constraint match_actions_action_type_check,
  add constraint match_actions_action_type_check check (action_type in (
    'created', 'declared_again_same_side', 'confirmed', 'revision_proposed',
    'validated', 'identity_questioned', 'participant_replaced',
    'correction_timeout_resolved', 'annulled',
    -- Bloque 6 (nuevos):
    'correction_accepted', 'participant_unidentified'
  ));

-- ------------------------------------------------------------------
-- 3) level_events — nuevos event_type + trazabilidad hacia el partido
-- ------------------------------------------------------------------

alter table public.level_events
  drop constraint level_events_event_type_check,
  add constraint level_events_event_type_check check (event_type in (
    'initial_estimate',
    -- Bloque 6 (nuevos) — exactamente los que 20260919120000_bloque3_nivel_persistente.sql ya
    -- dejó anticipados en su comentario de cabecera ("se agregan cuando el bloque que los emite
    -- exista de verdad"):
    'match_delta', 'match_correction_reversal', 'match_correction_reapply',
    'identity_reassignment_delta'
  ));

-- 06_Revision_Fase_A_ChatGPT.md B6-A-01: questionnaire_version/questionnaire_mode eran NOT NULL
-- desde Bloque 3 (obligatorios solo para initial_estimate, el único event_type que existía
-- entonces). Los 4 event_type nuevos de Bloque 6 (match_delta/match_correction_reversal/
-- match_correction_reapply/identity_reassignment_delta) nunca los completan — sin este cambio,
-- la primera oficialización real habría fallado por NOT NULL. Se preserva la invariancia
-- original con un CHECK explícito en vez de dejarla implícita.
alter table public.level_events
  alter column questionnaire_version drop not null,
  alter column questionnaire_mode drop not null;

alter table public.level_events
  add constraint level_events_questionnaire_required_for_initial_estimate check (
    event_type <> 'initial_estimate'
    or (questionnaire_version is not null and questionnaire_mode is not null)
  );

alter table public.level_events
  add column if not exists match_id uuid references public.matches (match_id),
  add column if not exists match_level_result_id uuid references public.match_level_results (result_id);

comment on column public.level_events.questionnaire_version is
  'Obligatorio (por CHECK) únicamente cuando event_type=initial_estimate — Bloque 6 (B6-A-01)
   relajó el NOT NULL de columna porque sus 4 event_type nuevos nunca lo completan.';
comment on column public.level_events.questionnaire_mode is
  'Obligatorio (por CHECK) únicamente cuando event_type=initial_estimate — ver
   questionnaire_version.';
comment on column public.level_events.match_id is
  'Solo se completa en event_type de Bloque 6 (match_delta/match_correction_reversal/
   match_correction_reapply/identity_reassignment_delta). NULL para initial_estimate.';
comment on column public.level_events.match_level_result_id is
  'Vínculo exacto al match_level_results que originó este evento — permite reconstruir, para
   cualquier delta individual, el cálculo completo del partido que lo produjo.';

-- ------------------------------------------------------------------
-- 4) match_identity_issues
-- ------------------------------------------------------------------

create table public.match_identity_issues (
  issue_id            uuid primary key default gen_random_uuid(),
  match_id            uuid not null references public.matches (match_id) on delete cascade,
  team                text not null check (team in ('A', 'B')),
  position_in_team    smallint not null check (position_in_team in (1, 2)),
  -- Auditoría de quién estaba mal puesto en ese slot — nunca se borra aunque se resuelva.
  previous_player_id  uuid references public.players (player_id),
  opened_by_player_id uuid not null references public.players (player_id),
  opened_at           timestamptz not null default now(),
  -- 7 días corridos desde el reporte (Experiencia_Inicial.md §13.4) — fijo al abrir, nunca se
  -- recalcula ni se reinicia.
  resolution_deadline_at timestamptz not null,
  status              text not null default 'open' check (status in ('open', 'resolved', 'unidentified')),
  resolved_player_id  uuid references public.players (player_id),
  resolved_at         timestamptz,
  -- Resultado de Nivel que esta incidencia revirtió al abrirse, y el que produjo al resolverse/
  -- vencer — trazabilidad completa sin necesidad de recorrer match_actions.
  reverted_result_id  uuid references public.match_level_results (result_id),
  reapplied_result_id uuid references public.match_level_results (result_id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.match_identity_issues is
  'Ciclo de vida de una incidencia de identidad por slot (Bloque 6). NUNCA crea una fila
   player/provisional fantasma: match_participants.player_id de ese slot pasa a NULL mientras
   status=open, y se queda en NULL para siempre si status=unidentified. "unidentified" se
   materializa de forma idempotente en la primera lectura/acción posterior al vencimiento de
   resolution_deadline_at (04_Revision_ChatGPT.md §6/§7) — nunca queda como estado puramente
   derivado sin escritura.';

create unique index match_identity_issues_one_open_per_slot
  on public.match_identity_issues (match_id, team, position_in_team)
  where status = 'open';

create index match_identity_issues_match_id_idx on public.match_identity_issues (match_id);

alter table public.match_identity_issues enable row level security;
-- Deny-by-default TOTAL, mismo criterio que el resto de las tablas de partidos. Lectura
-- exclusiva vía RPC SECURITY DEFINER (get_match_detail extendida).

grant select, insert, update, delete on table public.match_identity_issues to service_role;

-- ------------------------------------------------------------------
-- 5) _bloque6_refresh_participant_fingerprint — 08_Revision_Central_Adicional.md B6-B-04
-- ------------------------------------------------------------------
--
-- Bloque 5 deduplica por participant_fingerprint (sha256 de los 4 player_id canonicalizados por
-- pareja — ver create_or_attach_match). Bloque 6 modifica match_participants (identidad
-- cuestionada/resuelta/no identificada) pero nunca actualizaba matches.participant_fingerprint:
-- una carga posterior con los participantes correctos podía crear un duplicado, y una carga con
-- la identidad incorrecta vieja todavía podía adjuntarse al partido. Definida ANTES de las RPCs
-- que la invocan (officialize_match_validation/report_identity_issue/resolve_identity_issue/
-- admin_force_resolve_identity_issue) para que el orden de migraciones quede limpio. Interna —
-- sin GRANT a nadie, uso exclusivo de otras funciones SECURITY DEFINER de Bloque 6.
create or replace function public._bloque6_refresh_participant_fingerprint(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a1 uuid;
  v_a2 uuid;
  v_b1 uuid;
  v_b2 uuid;
  v_pair_a_key text;
  v_pair_b_key text;
  v_fingerprint text;
begin
  select
    max(player_id) filter (where team = 'A' and position_in_team = 1),
    max(player_id) filter (where team = 'A' and position_in_team = 2),
    max(player_id) filter (where team = 'B' and position_in_team = 1),
    max(player_id) filter (where team = 'B' and position_in_team = 2)
    into v_a1, v_a2, v_b1, v_b2
  from public.match_participants
  where match_id = p_match_id;

  if v_a1 is not null and v_a2 is not null and v_b1 is not null and v_b2 is not null then
    -- EXACTAMENTE el mismo algoritmo que create_or_attach_match (Bloque 5) — nunca se
    -- reimplementa distinto: ordenar IDs dentro de cada pareja, ordenar ambas parejas,
    -- sha256(pairA|pairB).
    v_pair_a_key := least(v_a1::text, v_a2::text) || ':' || greatest(v_a1::text, v_a2::text);
    v_pair_b_key := least(v_b1::text, v_b2::text) || ':' || greatest(v_b1::text, v_b2::text);
    v_fingerprint := encode(
      extensions.digest(least(v_pair_a_key, v_pair_b_key) || '|' || greatest(v_pair_a_key, v_pair_b_key), 'sha256'),
      'hex'
    );
  else
    -- Al menos un slot sin identidad: centinela determinístico y único por match_id — jamás
    -- coincide con un hash sha256 real (formato distinto, nunca 64 caracteres hex puros)
    -- mientras exista un slot no identificado/open.
    v_fingerprint := 'bloque6_unidentified:' || p_match_id::text;
  end if;

  update public.matches set participant_fingerprint = v_fingerprint, updated_at = now()
    where match_id = p_match_id;
end;
$$;

comment on function public._bloque6_refresh_participant_fingerprint is
  'Recalcula matches.participant_fingerprint tras cualquier cambio de identidad de Bloque 6
   (B6-B-04). Con los 4 player_id conocidos, EXACTAMENTE el mismo hash que create_or_attach_match
   (Bloque 5) — nunca un algoritmo distinto. Con algún slot NULL, un centinela determinístico por
   match_id que nunca colisiona con un hash real. Interno, sin GRANT.';
