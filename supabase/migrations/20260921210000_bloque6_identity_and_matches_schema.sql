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

alter table public.level_events
  add column if not exists match_id uuid references public.matches (match_id),
  add column if not exists match_level_result_id uuid references public.match_level_results (result_id);

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
