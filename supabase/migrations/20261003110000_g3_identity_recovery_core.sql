-- BRAMUlab — V04.29 · FRONTERA A2 (recuperación de identidad + replay de Nivel) y base de C (duplicados).
--
-- Decisión técnica del seam `legal_acceptances` (NO es decisión de producto; ver 116 §2.3):
--   OPCIÓN B — la cuenta destino (la que ya tiene auth_user_id, perfil, level_states, pilot_events y, si corresponde,
--   la aceptación legal APPEND-ONLY) es SIEMPRE la identidad final; la provisional (P1) se REASOCIA hacia ella y queda
--   como tombstone auditable. Por eso el alta nueva y la cuenta existente usan EXACTAMENTE el mismo mecanismo y:
--     * no se borra ni se muta ninguna fila de legal_acceptances (ni se toca su trigger);
--     * no se adopta auth_user_id sobre otra fila ni se copia evidencia legal;
--     * no hay DELETE de players (P0.3/FKs sin cascade intactos).
--   La opción A (P1 final + copiar la aceptación legal) obligaba a falsificar evidencia append-only y a mover
--   profile/level_states/pilot_events de la cuenta.
--
-- Clasificación de las FKs reales hacia players.player_id (replay PGlite, 37 columnas) — se REPUNTEA solo la verdad actual:
--   verdad actual/reasociable ...... match_participants.player_id  (+ refresh de participant_fingerprint)
--   auditoría histórica (NO se toca) match_actions.actor, match_revisions.proposed_by, match_submissions.submitted_by,
--                                    matches.created_by, match_identity_issues.*, match_level_results.actor,
--                                    provisional_claims.*, players.created_by, pilot_events, notifications,
--                                    location_change_events, ranking_profile_events
--   snapshots publicados (NO se toca) ranking_rows, ranking_network_hidden
--   regenerable ..................... intelligence_match_outputs (se regenera sola por fingerprint)
--   evidencia legal append-only ..... legal_acceptances (intacta)
--   no aplican a una provisional .... level_states/level_events, group_*, groups, profiles, player_saved_players (solo
--                                    registradas), match_user_state, api_rate_limits
--
-- Nivel recuperado: la provisional nunca tuvo delta propio. El efecto del TARGET se calcula server-side con el motor
-- compartido (nivel_bramu_v1_0 vía match-level-engine.js, Edge `process-identity-recovery`) y se persiste ACÁ:
--   * como una fila de match_level_result_players del resultado vigente del partido (así correcciones, anulaciones,
--     identidad, rated_matches/distinct_opponents y reversiones EXISTENTES lo tratan como a cualquier participante, sin
--     tocar los deltas de terceros), y
--   * como fila de ledger en level_recovery_effects (UNIQUE (recovery_id, match_id): idempotencia, auditoría y
--     reversión estrecha de un duplicado).

-- ------------------------------------------------------------------
-- 1) player_identity_recoveries — auditoría server-only
-- ------------------------------------------------------------------

create table public.player_identity_recoveries (
  recovery_id uuid primary key default gen_random_uuid(),
  source_provisional_player_id uuid not null references public.players (player_id),
  target_player_id uuid not null references public.players (player_id),
  claim_id uuid not null references public.provisional_claims (claim_id),
  actor_player_id uuid not null references public.players (player_id),
  status text not null check (status in ('completed', 'blocked_conflict')),
  -- Procesamiento de Nivel: 'pending' hasta que el target tenga Nivel base y el replay termine.
  level_status text not null default 'not_needed' check (level_status in ('not_needed', 'pending', 'completed')),
  context jsonb not null default '{}'::jsonb,
  recovered_match_ids uuid[] not null default '{}',
  conflicts jsonb,
  attempts integer not null default 1,
  result jsonb not null default '{}'::jsonb,
  level_lease_token uuid,
  level_lease_expires_at timestamptz,
  level_last_error text,
  level_processed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint player_identity_recoveries_distinct_players check (source_provisional_player_id <> target_player_id)
);

comment on table public.player_identity_recoveries is
  'Auditoría server-only de la vinculación provisional -> cuenta registrada (V04.29). Una sola recuperación COMPLETED por
   provisional y por claim. blocked_conflict registra (sin mutar nada) un intento que dejaría a la misma persona en dos
   slots de un partido. Sin acceso directo del cliente: RLS sin políticas; lectura/escritura solo vía RPC SECURITY DEFINER.';

create unique index player_identity_recoveries_one_completed_per_source
  on public.player_identity_recoveries (source_provisional_player_id) where status = 'completed';
create unique index player_identity_recoveries_one_completed_per_claim
  on public.player_identity_recoveries (claim_id) where status = 'completed';
create unique index player_identity_recoveries_one_blocked_per_pair
  on public.player_identity_recoveries (source_provisional_player_id, target_player_id) where status = 'blocked_conflict';
create index player_identity_recoveries_target_idx on public.player_identity_recoveries (target_player_id, status, level_status);
create index player_identity_recoveries_claim_idx on public.player_identity_recoveries (claim_id);
create index player_identity_recoveries_actor_idx on public.player_identity_recoveries (actor_player_id);

alter table public.player_identity_recoveries enable row level security;
revoke all on table public.player_identity_recoveries from public, anon, authenticated;
revoke delete, truncate, references, trigger on table public.player_identity_recoveries from service_role;
grant select, insert, update on table public.player_identity_recoveries to service_role;

-- ------------------------------------------------------------------
-- 2) level_recovery_effects — ledger server-only (UNIQUE (recovery_id, match_id))
-- ------------------------------------------------------------------

create table public.level_recovery_effects (
  effect_id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references public.player_identity_recoveries (recovery_id),
  match_id uuid not null references public.matches (match_id),
  target_player_id uuid not null references public.players (player_id),
  status text not null check (status in ('applied', 'skipped_ineligible', 'skipped_missing_snapshot', 'reverted_duplicate')),
  reason_codes jsonb not null default '[]'::jsonb,
  played_at timestamptz not null,
  -- Resultado vigente al que se agregó la fila del target (match_level_result_players). NULL si fue omitido.
  source_result_id uuid references public.match_level_results (result_id),
  algorithm_version text,
  -- Referencias históricas REALES usadas (compañero/rivales: formula_*_before del partido) + estado del target.
  snapshots_used jsonb,
  mu_before_live numeric, confidence_before_live numeric, evidence_units_before_live numeric,
  mu_after_live numeric, confidence_after_live numeric, evidence_units_after_live numeric,
  -- Efecto del partido sobre el target (mismos conceptos que computeLevelStateUpdates): sostiene la reversión estrecha.
  mu_effect numeric, confidence_effect numeric, evidence_effect numeric,
  applied_at timestamptz,
  reverted_at timestamptz,
  reverted_reason text,
  resolution_candidate_id uuid,
  created_at timestamptz not null default now(),
  constraint level_recovery_effects_recovery_match_key unique (recovery_id, match_id)
);

comment on table public.level_recovery_effects is
  'Ledger server-only del replay de Nivel de una recuperación (V04.29). applied = el partido aportó evidencia al target;
   skipped_* = quedó en Historial/Stats sin efecto de Nivel (nunca se inventa evidencia); reverted_duplicate = el partido
   resultó duplicado y su efecto se revirtió de forma estrecha e idempotente. El efecto VIGENTE vive además en
   match_level_result_players (fila del target en el resultado applied del partido).';

create index level_recovery_effects_match_idx on public.level_recovery_effects (match_id, status);
create index level_recovery_effects_target_idx on public.level_recovery_effects (target_player_id);
create index level_recovery_effects_source_result_idx on public.level_recovery_effects (source_result_id);

alter table public.level_recovery_effects enable row level security;
revoke all on table public.level_recovery_effects from public, anon, authenticated;
revoke delete, truncate, references, trigger on table public.level_recovery_effects from service_role;
grant select, insert, update on table public.level_recovery_effects to service_role;

-- ------------------------------------------------------------------
-- 3) match_duplicate_candidates — candidatos/resoluciones persistidos (no se pregunta infinitamente)
-- ------------------------------------------------------------------

create table public.match_duplicate_candidates (
  candidate_id uuid primary key default gen_random_uuid(),
  match_low_id uuid not null references public.matches (match_id),
  match_high_id uuid not null references public.matches (match_id),
  recovery_id uuid references public.player_identity_recoveries (recovery_id),
  -- Quien debe confirmar (la persona cuya identidad se recuperó). Solo ella lista/resuelve.
  target_player_id uuid not null references public.players (player_id),
  status text not null default 'open' check (status in ('open', 'resolved_same', 'resolved_different', 'void')),
  evidence jsonb not null default '{}'::jsonb,
  resolution jsonb,
  canonical_match_id uuid references public.matches (match_id),
  resolved_by_player_id uuid references public.players (player_id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_duplicate_candidates_ordered check (match_low_id < match_high_id),
  constraint match_duplicate_candidates_pair_key unique (match_low_id, match_high_id)
);

comment on table public.match_duplicate_candidates is
  'Pares de partidos que, tras vincular una identidad, tienen la misma composición (huella) y ventana temporal
   (V04.29). Un NO deja status=resolved_different y el par nunca se vuelve a ofrecer (unique). Server-only.';

create index match_duplicate_candidates_target_idx on public.match_duplicate_candidates (target_player_id, status);
create index match_duplicate_candidates_high_idx on public.match_duplicate_candidates (match_high_id);
create index match_duplicate_candidates_recovery_idx on public.match_duplicate_candidates (recovery_id);
create index match_duplicate_candidates_canonical_idx on public.match_duplicate_candidates (canonical_match_id);
create index match_duplicate_candidates_resolved_by_idx on public.match_duplicate_candidates (resolved_by_player_id);

alter table public.match_duplicate_candidates enable row level security;
revoke all on table public.match_duplicate_candidates from public, anon, authenticated;
revoke delete, truncate, references, trigger on table public.match_duplicate_candidates from service_role;
grant select, insert, update on table public.match_duplicate_candidates to service_role;

alter table public.level_recovery_effects
  add constraint level_recovery_effects_candidate_fkey
  foreign key (resolution_candidate_id) references public.match_duplicate_candidates (candidate_id);
create index level_recovery_effects_candidate_idx on public.level_recovery_effects (resolution_candidate_id);

-- ------------------------------------------------------------------
-- 4) Semántica estructural de duplicados (misma de create_or_attach_match)
-- ------------------------------------------------------------------

/** Misma ventana que create_or_attach_match: ±3 h si AMBAS horas son conocidas; si no, mismo día en Buenos Aires. */
create or replace function public._match_time_window_equivalent(
  p_a_at timestamptz, p_a_time_known boolean, p_b_at timestamptz, p_b_time_known boolean
) returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_a_time_known, true) and coalesce(p_b_time_known, true)
      then abs(extract(epoch from (p_a_at - p_b_at))) <= 10800
    else date_trunc('day', p_a_at at time zone 'America/Argentina/Buenos_Aires')
       = date_trunc('day', p_b_at at time zone 'America/Argentina/Buenos_Aires')
  end;
$$;

revoke all on function public._match_time_window_equivalent(timestamptz, boolean, timestamptz, boolean) from public, anon, authenticated;

/** Un partido es "vivo" para dedupe igual que en create_or_attach_match: validated, o pending_validation no vencido. */
create or replace function public._match_is_live_for_dedupe(p_status text, p_deadline timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_status = 'validated' or (p_status = 'pending_validation' and p_deadline > now());
$$;

revoke all on function public._match_is_live_for_dedupe(text, timestamptz) from public, anon, authenticated;

/** Detecta y persiste (idempotente) candidatos de duplicado para UN partido: misma huella de participantes, mismo
 *  formato, ambos vivos y dentro de la ventana temporal. Nunca por nombres. Devuelve cuántos candidatos NUEVOS creó. */
create or replace function public._detect_duplicate_candidates(p_match_id uuid, p_recovery_id uuid, p_target_player_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.matches;
  v_other public.matches;
  v_inserted integer := 0;
  v_n integer;
begin
  select * into v_m from public.matches where match_id = p_match_id;
  if v_m is null
     or v_m.participant_fingerprint like 'bloque6_unidentified:%'
     or not public._match_is_live_for_dedupe(v_m.status, v_m.validation_deadline_at) then
    return 0;
  end if;

  for v_other in
    select m.* from public.matches m
    where m.match_id <> v_m.match_id
      and m.participant_fingerprint = v_m.participant_fingerprint
      and m.format_id = v_m.format_id
      and public._match_is_live_for_dedupe(m.status, m.validation_deadline_at)
      and public._match_time_window_equivalent(m.played_at, m.played_at_time_known, v_m.played_at, v_m.played_at_time_known)
    order by m.match_id
  loop
    insert into public.match_duplicate_candidates (match_low_id, match_high_id, recovery_id, target_player_id, evidence)
    values (
      least(v_m.match_id, v_other.match_id), greatest(v_m.match_id, v_other.match_id), p_recovery_id, p_target_player_id,
      jsonb_build_object(
        'formatId', v_m.format_id,
        'sameParticipantFingerprint', true,
        'minutesApart', round(abs(extract(epoch from (v_m.played_at - v_other.played_at))) / 60),
        'timeKnown', jsonb_build_array(v_m.played_at_time_known, v_other.played_at_time_known),
        'statuses', jsonb_build_array(v_m.status, v_other.status)
      )
    )
    on conflict (match_low_id, match_high_id) do nothing;
    get diagnostics v_n = row_count;
    v_inserted := v_inserted + v_n;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public._detect_duplicate_candidates(uuid, uuid, uuid) from public, anon, authenticated;

/** Re-detección idempotente para los partidos de las recuperaciones RECIENTES de un jugador (cubre una carga concurrente de
 *  create_or_attach_match que haya nacido con la nueva huella antes de que el vínculo hiciera commit). Acotada: solo
 *  recuperaciones de los últimos 45 días (ventana máxima en la que un partido puede seguir siendo candidato). */
create or replace function public._redetect_duplicate_candidates_for_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
begin
  for v_rec in
    select r.recovery_id, unnest(r.recovered_match_ids) as match_id
      from public.player_identity_recoveries r
     where r.target_player_id = p_player_id and r.status = 'completed' and r.created_at > now() - interval '45 days'
  loop
    perform public._detect_duplicate_candidates(v_rec.match_id, v_rec.recovery_id, p_player_id);
  end loop;
end;
$$;

revoke all on function public._redetect_duplicate_candidates_for_player(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- 5) claim_provisional_player — vínculo atómico, multi-link, cuenta nueva o existente
-- ------------------------------------------------------------------

/** SOY YO. Target = el player registrado de la sesión (cuenta nueva sin perfil todavía O cuenta completa). Source = la
 *  provisional del token. Contrato jsonb {ok, code, ...}; los errores de negocio son RETURN (no raise) para no revertir el
 *  incremento del rate limit.
 *
 *  Concurrencia (CRÍTICA con varios links por provisional): ANTES de leer/mutar claims se serializa por IDENTIDAD
 *  provisional con un advisory lock transaccional determinístico y luego por target (jerarquía fija prov -> target ->
 *  filas de matches ordenadas por match_id; sin FOR UPDATE sobre players, para no chocar con los FOR KEY SHARE que
 *  officialize_match_validation toma al insertar notifications). Bajo lock se RELEE el claim, se validan estado/vigencia
 *  y que la provisional siga activa/no recuperada, se hace el PRE-FLIGHT completo de partidos, y recién entonces se
 *  muta: repunteo de match_participants + refresh de huella + tombstone + claim ganador `claimed` + resto de pending
 *  `revoked` + auditoría, todo en una transacción. Idempotente: reintentar el mismo token por la misma cuenta devuelve el
 *  mismo recovery sin duplicar nada. */
create or replace function public.claim_provisional_player(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.players;
  v_token text := trim(coalesce(p_token, ''));
  v_hash text;
  v_peek record;
  v_claim public.provisional_claims;
  v_prov public.players;
  v_existing public.player_identity_recoveries;
  v_match_ids uuid[];
  v_match_id uuid;
  v_conflicts jsonb;
  v_recovery_id uuid;
  v_dup_total integer := 0;
  v_matches_json jsonb;
begin
  select * into v_target from public.players where auth_user_id = auth.uid();
  if v_target.player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_target.player_id, 'claim_provisional_player', 10, 900) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  -- Formato validado DESPUÉS de consumir cuota (un token inválido cuenta como intento real).
  if v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Lectura SIN lock solo para saber QUÉ provisional serializar.
  select claim_id, provisional_player_id into v_peek from public.provisional_claims where token_hash = v_hash;
  if v_peek.claim_id is null then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;

  -- (1) por provisional, (2) por target — siempre en este orden (jerarquía anti-deadlock).
  perform pg_advisory_xact_lock(hashtextextended('bramu:identity_recovery:prov:' || v_peek.provisional_player_id::text, 7));
  perform pg_advisory_xact_lock(hashtextextended('bramu:identity_recovery:target:' || v_target.player_id::text, 7));

  -- Relectura bajo lock: nada de lo leído antes del lock es confiable.
  select * into v_claim from public.provisional_claims where claim_id = v_peek.claim_id for update;
  select * into v_prov from public.players where player_id = v_claim.provisional_player_id;

  if not (v_target.type = 'registered' and v_target.is_active and v_target.deleted_at is null) then
    return jsonb_build_object('ok', false, 'code', 'account_not_eligible');
  end if;

  -- Reintento idempotente (red/doble toque): el MISMO target ya recuperó esta provisional.
  select * into v_existing from public.player_identity_recoveries
    where source_provisional_player_id = v_claim.provisional_player_id and status = 'completed';
  if v_existing.recovery_id is not null then
    if v_existing.target_player_id = v_target.player_id then
      return jsonb_build_object(
        'ok', true, 'code', 'recovered', 'idempotentReturn', true,
        'recoveryId', v_existing.recovery_id, 'targetPlayerId', v_target.player_id,
        'matchCount', coalesce(array_length(v_existing.recovered_match_ids, 1), 0),
        'levelPending', v_existing.level_status = 'pending',
        'duplicateCandidates', (select count(*)::int from public.match_duplicate_candidates c
                                 where c.recovery_id = v_existing.recovery_id and c.status = 'open')
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;

  if v_claim.status = 'claimed' then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;
  if v_claim.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'claim_revoked');
  end if;
  if v_claim.status = 'expired' or v_claim.expires_at <= now() then
    update public.provisional_claims set status = 'expired' where claim_id = v_claim.claim_id and status = 'pending';
    return jsonb_build_object('ok', false, 'code', 'claim_expired');
  end if;

  if v_prov is null or v_prov.type <> 'provisional' or not v_prov.is_active or v_prov.recovered_into_player_id is not null then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;

  -- PRE-FLIGHT completo (cero mutación si hay conflicto): todos los partidos de la provisional.
  select array_agg(distinct mp.match_id order by mp.match_id) into v_match_ids
    from public.match_participants mp where mp.player_id = v_prov.player_id;
  v_match_ids := coalesce(v_match_ids, '{}');

  select jsonb_agg(jsonb_build_object('matchId', m.match_id, 'playedAt', m.played_at, 'status', m.status) order by m.played_at)
    into v_conflicts
    from public.matches m
    where m.match_id = any (v_match_ids)
      and exists (select 1 from public.match_participants t where t.match_id = m.match_id and t.player_id = v_target.player_id);

  if v_conflicts is not null then
    -- El target ya figura en otro slot de al menos un partido de la provisional: la misma persona no puede ocupar dos
    -- slots. NO se mueve nada, NO se consume el link, NO cuenta como recovery exitosa. Se deja auditado el intento.
    insert into public.player_identity_recoveries (
      source_provisional_player_id, target_player_id, claim_id, actor_player_id, status, context, conflicts
    ) values (
      v_prov.player_id, v_target.player_id, v_claim.claim_id, v_target.player_id, 'blocked_conflict',
      jsonb_build_object('via', 'claim_link'), v_conflicts
    )
    on conflict (source_provisional_player_id, target_player_id) where status = 'blocked_conflict'
    do update set attempts = public.player_identity_recoveries.attempts + 1,
                  conflicts = excluded.conflicts, claim_id = excluded.claim_id, updated_at = now();
    return jsonb_build_object('ok', false, 'code', 'identity_conflict', 'conflicts', v_conflicts);
  end if;

  -- Filas de partidos en orden determinístico (anti-deadlock entre dos vínculos que comparten partidos).
  if array_length(v_match_ids, 1) is not null then
    perform 1 from public.matches where match_id = any (v_match_ids) order by match_id for update;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'matchId', m.match_id, 'playedAt', m.played_at,
           'team', mp.team, 'position', mp.position_in_team) order by m.played_at, m.match_id), '[]'::jsonb)
    into v_matches_json
    from public.match_participants mp join public.matches m on m.match_id = mp.match_id
    where mp.player_id = v_prov.player_id;

  insert into public.player_identity_recoveries (
    source_provisional_player_id, target_player_id, claim_id, actor_player_id, status, level_status,
    context, recovered_match_ids, result, completed_at
  ) values (
    v_prov.player_id, v_target.player_id, v_claim.claim_id, v_target.player_id, 'completed',
    case when array_length(v_match_ids, 1) is null then 'not_needed' else 'pending' end,
    jsonb_build_object('via', 'claim_link', 'invitedBy', v_claim.created_by_player_id, 'matches', v_matches_json),
    v_match_ids, jsonb_build_object('matchCount', coalesce(array_length(v_match_ids, 1), 0)), now()
  ) returning recovery_id into v_recovery_id;

  -- Verdad ACTUAL: reasociar slots. display_name_snapshot, actor/proposer/submission/revision NO se reescriben.
  update public.match_participants set player_id = v_target.player_id where player_id = v_prov.player_id;

  foreach v_match_id in array v_match_ids loop
    perform public._bloque6_refresh_participant_fingerprint(v_match_id);
  end loop;

  -- Tombstone de la provisional (auditable, ya no seleccionable/invitable).
  update public.players
    set is_active = false, recovered_into_player_id = v_target.player_id, recovered_at = now(), updated_at = now()
    where player_id = v_prov.player_id;

  -- Ganador: consume SU link y revoca los demás pending de esa provisional (otros invitadores) en la misma transacción.
  update public.provisional_claims
    set status = 'claimed', claimed_at = now(), claimed_by_player_id = v_target.player_id
    where claim_id = v_claim.claim_id;
  update public.provisional_claims
    set status = 'revoked', revoked_at = now(), revoked_reason = 'recovered_elsewhere'
    where provisional_player_id = v_prov.player_id and status = 'pending' and claim_id <> v_claim.claim_id;

  insert into public.pilot_events (event_name, player_id, properties)
    values ('provisional_claimed', v_target.player_id, '{}'::jsonb);

  -- Posibles duplicados reveladas por la nueva composición (no se fusiona nada acá).
  foreach v_match_id in array v_match_ids loop
    v_dup_total := v_dup_total + public._detect_duplicate_candidates(v_match_id, v_recovery_id, v_target.player_id);
  end loop;

  update public.player_identity_recoveries
    set result = result || jsonb_build_object('duplicateCandidates', v_dup_total), updated_at = now()
    where recovery_id = v_recovery_id;

  return jsonb_build_object(
    'ok', true, 'code', 'recovered', 'recoveryId', v_recovery_id, 'targetPlayerId', v_target.player_id,
    'matchCount', coalesce(array_length(v_match_ids, 1), 0),
    'levelPending', array_length(v_match_ids, 1) is not null,
    'duplicateCandidates', v_dup_total
  );
end;
$$;

comment on function public.claim_provisional_player is
  'SOY YO (V04.29). Vincula la provisional del token a la cuenta registrada de la sesión (alta nueva o cuenta existente).
   Serializa por provisional y por target (advisory locks, jerarquía prov->target->matches ordenados), relee y valida
   bajo lock, hace preflight de conflicto de slots (identity_conflict = cero mutación), repuntea match_participants,
   refresca huellas, deja tombstone y auditoría, consume el link ganador y revoca los demás pending. Idempotente por
   (provisional, target). Devuelve jsonb; los errores de negocio son return (no raise).';

revoke all on function public.claim_provisional_player(text) from public, anon;
grant execute on function public.claim_provisional_player(text) to authenticated;

-- ------------------------------------------------------------------
-- 6) Estado de recuperación del caller (para reintentos silenciosos del cliente)
-- ------------------------------------------------------------------

create or replace function public.get_my_identity_recovery_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  select p.player_id into v_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  -- Idempotente y acotado a recuperaciones recientes del propio caller (casi siempre ninguna).
  perform public._redetect_duplicate_candidates_for_player(v_player_id);
  return jsonb_build_object(
    'pendingLevelRecoveries', (select count(*)::int from public.player_identity_recoveries r
                                where r.target_player_id = v_player_id and r.status = 'completed' and r.level_status = 'pending'),
    'openDuplicateCandidates', (select count(*)::int from public.match_duplicate_candidates c
                                 where c.target_player_id = v_player_id and c.status = 'open'
                                   and exists (select 1 from public.matches m where m.match_id = c.match_low_id and m.status <> 'annulled')
                                   and exists (select 1 from public.matches m where m.match_id = c.match_high_id and m.status <> 'annulled'))
  );
end;
$$;

comment on function public.get_my_identity_recovery_status is
  'Contadores mínimos del caller: recuperaciones con Nivel pendiente y posibles duplicados abiertos (re-detecta de forma idempotente
   sobre sus recuperaciones recientes). Sin ids ni datos de terceros.';

revoke all on function public.get_my_identity_recovery_status() from public, anon;
grant execute on function public.get_my_identity_recovery_status() to authenticated;

-- ------------------------------------------------------------------
-- 7) RPC server-only del replay de Nivel (las llama la Edge `process-identity-recovery` con service_role)
-- ------------------------------------------------------------------

/** Cuenta de partidos/oponentes de Nivel de UN jugador — MISMAS consultas que officialize_match_validation. */
create or replace function public._level_recovery_counts(p_player_id uuid)
returns table (rated_matches integer, distinct_opponents integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(distinct mlr.match_id)::int
       from public.match_level_result_players mlrp
       join public.match_level_results mlr on mlr.result_id = mlrp.result_id
      where mlrp.player_id = p_player_id and mlr.effect_status = 'applied' and mlr.eligible),
    (select count(distinct opp.player_id)::int
       from public.match_participants self_p
       join public.match_participants opp
         on opp.match_id = self_p.match_id and opp.team <> self_p.team and opp.player_id is not null
       join public.match_level_results mlr
         on mlr.match_id = self_p.match_id and mlr.effect_status = 'applied' and mlr.eligible
      where self_p.player_id = p_player_id);
$$;

revoke all on function public._level_recovery_counts(uuid) from public, anon, authenticated;

/** Entrada del replay: estado del target + partidos recuperados todavía sin fila de ledger, ordenados por played_at ASC. */
create or replace function public.get_identity_recovery_level_input(p_recovery_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rec public.player_identity_recoveries;
  v_ls public.level_states;
begin
  select * into v_rec from public.player_identity_recoveries where recovery_id = p_recovery_id;
  if v_rec is null or v_rec.status <> 'completed' then
    return jsonb_build_object('ok', false, 'code', 'recovery_not_found');
  end if;
  select * into v_ls from public.level_states where player_id = v_rec.target_player_id;

  return jsonb_build_object(
    'ok', true, 'recoveryId', v_rec.recovery_id, 'targetPlayerId', v_rec.target_player_id,
    'levelStatus', v_rec.level_status,
    'target', jsonb_build_object(
      'status', coalesce(v_ls.status, 'PENDIENTE'), 'mu', v_ls.mu, 'confidence', v_ls.confidence,
      'evidenceUnits', v_ls.evidence_units, 'lastRatedAt', v_ls.last_rated_at,
      'ratedMatches', v_ls.rated_matches, 'distinctOpponents', v_ls.distinct_opponents
    ),
    'pendingMatches', coalesce((
      select jsonb_agg(jsonb_build_object('matchId', m.match_id, 'playedAt', m.played_at) order by m.played_at, m.match_id)
        from public.matches m
       where m.match_id = any (v_rec.recovered_match_ids)
         and not exists (select 1 from public.level_recovery_effects e where e.recovery_id = v_rec.recovery_id and e.match_id = m.match_id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_identity_recovery_level_input(uuid) from public, anon, authenticated;
grant execute on function public.get_identity_recovery_level_input(uuid) to service_role;

/** Recuperaciones del target con Nivel pendiente (para que la Edge procese solo lo del caller). */
create or replace function public.list_identity_recoveries_pending_level(p_target_player_id uuid)
returns table (recovery_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select r.recovery_id from public.player_identity_recoveries r
   where r.target_player_id = p_target_player_id and r.status = 'completed' and r.level_status = 'pending'
   order by r.created_at, r.recovery_id;
$$;

revoke all on function public.list_identity_recoveries_pending_level(uuid) from public, anon, authenticated;
grant execute on function public.list_identity_recoveries_pending_level(uuid) to service_role;

/** Lease por recuperación: un solo procesador a la vez (la Edge puede dispararse dos veces). Devuelve el token o NULL. */
create or replace function public.acquire_identity_recovery_level_lease(p_recovery_id uuid, p_ttl_seconds integer default 120)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec public.player_identity_recoveries;
  v_token uuid;
begin
  select * into v_rec from public.player_identity_recoveries where recovery_id = p_recovery_id for update;
  if v_rec is null or v_rec.status <> 'completed' or v_rec.level_status <> 'pending' then
    return null;
  end if;
  if v_rec.level_lease_token is not null and v_rec.level_lease_expires_at > now() then
    return null;
  end if;
  v_token := gen_random_uuid();
  update public.player_identity_recoveries
    set level_lease_token = v_token,
        level_lease_expires_at = now() + make_interval(secs => greatest(10, least(coalesce(p_ttl_seconds, 120), 600))),
        updated_at = now()
    where recovery_id = p_recovery_id;
  return v_token;
end;
$$;

revoke all on function public.acquire_identity_recovery_level_lease(uuid, integer) from public, anon, authenticated;
grant execute on function public.acquire_identity_recovery_level_lease(uuid, integer) to service_role;

create or replace function public.release_identity_recovery_level_lease(p_recovery_id uuid, p_lease uuid, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.player_identity_recoveries
     set level_lease_token = null, level_lease_expires_at = null,
         level_last_error = left(p_error, 500), updated_at = now()
   where recovery_id = p_recovery_id and level_lease_token = p_lease;
$$;

revoke all on function public.release_identity_recovery_level_lease(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_identity_recovery_level_lease(uuid, uuid, text) to service_role;

/** Ledger de un partido OMITIDO (sin efecto de Nivel). Idempotente por (recovery, match). */
create or replace function public.record_level_recovery_skip(
  p_recovery_id uuid, p_lease uuid, p_match_id uuid, p_status text, p_reason_codes jsonb, p_snapshots jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec public.player_identity_recoveries;
  v_played_at timestamptz;
begin
  if p_status not in ('skipped_ineligible', 'skipped_missing_snapshot') then
    raise exception 'invalid_skip_status' using errcode = 'P0001';
  end if;
  select * into v_rec from public.player_identity_recoveries where recovery_id = p_recovery_id for update;
  if v_rec is null or v_rec.status <> 'completed' or not (p_match_id = any (v_rec.recovered_match_ids)) then
    return jsonb_build_object('ok', false, 'code', 'recovery_not_found');
  end if;
  if v_rec.level_lease_token is distinct from p_lease or v_rec.level_lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'lease_lost');
  end if;
  select played_at into v_played_at from public.matches where match_id = p_match_id;

  insert into public.level_recovery_effects (recovery_id, match_id, target_player_id, status, reason_codes, played_at, snapshots_used)
  values (p_recovery_id, p_match_id, v_rec.target_player_id, p_status, coalesce(p_reason_codes, '[]'::jsonb), v_played_at, p_snapshots)
  on conflict (recovery_id, match_id) do nothing;

  return jsonb_build_object('ok', true, 'status', (
    select e.status from public.level_recovery_effects e where e.recovery_id = p_recovery_id and e.match_id = p_match_id));
end;
$$;

revoke all on function public.record_level_recovery_skip(uuid, uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_level_recovery_skip(uuid, uuid, uuid, text, jsonb, jsonb) to service_role;

/** Aplica el efecto de UN partido recuperado sobre el target (ya calculado por el motor JS en la Edge — nunca recalculado
 *  acá). Atómico: ledger + fila del target en el resultado vigente + level_states + level_events. Orden de locks idéntico
 *  al de officialize_match_validation (match -> resultado -> level_states) precedido por la fila de la recuperación
 *  (que solo toma este camino). Verificación optimista del estado del target redondeada a 4 decimales (mismo criterio que
 *  officialize_match_validation). Idempotente por (recovery, match). */
create or replace function public.apply_level_recovery_effect(
  p_recovery_id uuid,
  p_lease uuid,
  p_match_id uuid,
  p_expected_result_id uuid,
  p_result_player jsonb,
  p_level_state_update jsonb,
  p_algorithm_version text,
  p_reason_codes jsonb,
  p_snapshots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec public.player_identity_recoveries;
  v_existing public.level_recovery_effects;
  v_match public.matches;
  v_applied public.match_level_results;
  v_ls public.level_states;
  v_rated integer;
  v_distinct integer;
  v_status text;
  v_last_rated_at timestamptz;
  v_effect_id uuid;
  v_team text;
  v_final_mu numeric := (p_level_state_update->>'finalMu')::numeric;
  v_final_conf numeric := (p_level_state_update->>'finalConfidence')::numeric;
  v_final_ev numeric := (p_level_state_update->>'finalEvidenceUnits')::numeric;
begin
  select * into v_rec from public.player_identity_recoveries where recovery_id = p_recovery_id for update;
  if v_rec is null or v_rec.status <> 'completed' or not (p_match_id = any (v_rec.recovered_match_ids)) then
    return jsonb_build_object('ok', false, 'code', 'recovery_not_found');
  end if;
  if v_rec.level_lease_token is distinct from p_lease or v_rec.level_lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'lease_lost');
  end if;
  if (p_result_player->>'playerId')::uuid is distinct from v_rec.target_player_id
     or (p_level_state_update->>'playerId')::uuid is distinct from v_rec.target_player_id then
    raise exception 'recovery_effect_player_mismatch' using errcode = 'P0001';
  end if;

  select * into v_existing from public.level_recovery_effects where recovery_id = p_recovery_id and match_id = p_match_id;
  if v_existing.effect_id is not null then
    return jsonb_build_object('ok', true, 'idempotentReturn', true, 'status', v_existing.status, 'effectId', v_existing.effect_id);
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null or v_match.status <> 'validated' then
    return jsonb_build_object('ok', false, 'code', 'stale_match_state');
  end if;

  select * into v_applied from public.match_level_results where match_id = p_match_id and effect_status = 'applied' for update;
  if v_applied.result_id is null or v_applied.result_id <> p_expected_result_id or not v_applied.eligible then
    return jsonb_build_object('ok', false, 'code', 'stale_match_state');
  end if;
  if exists (select 1 from public.match_level_result_players where result_id = v_applied.result_id and player_id = v_rec.target_player_id) then
    return jsonb_build_object('ok', false, 'code', 'target_already_in_result');
  end if;
  select team into v_team from public.match_participants where match_id = p_match_id and player_id = v_rec.target_player_id;
  if v_team is null then
    return jsonb_build_object('ok', false, 'code', 'stale_match_state');
  end if;

  select * into v_ls from public.level_states where player_id = v_rec.target_player_id for update;
  if v_ls is null or v_ls.status = 'PENDIENTE' or v_ls.mu is null then
    return jsonb_build_object('ok', false, 'code', 'level_pending');
  end if;
  if round(v_ls.mu, 4) is distinct from round((p_level_state_update->>'currentMuForLock')::numeric, 4)
     or round(v_ls.confidence, 4) is distinct from round((p_level_state_update->>'currentConfidenceForLock')::numeric, 4)
     or round(coalesce(v_ls.evidence_units, 0), 4) is distinct from round(coalesce((p_level_state_update->>'currentEvidenceUnitsForLock')::numeric, 0), 4) then
    return jsonb_build_object('ok', false, 'code', 'stale_level_snapshot');
  end if;

  insert into public.match_level_result_players (
    result_id, player_id, team,
    formula_mu_before, formula_confidence_before, formula_state,
    effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
    original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before,
    mu_after, confidence_after
  ) values (
    v_applied.result_id, v_rec.target_player_id, v_team,
    (p_result_player->>'formulaMuBefore')::numeric, (p_result_player->>'formulaConfidenceBefore')::numeric, p_result_player->>'formulaState',
    (p_result_player->>'effectiveLevel')::numeric, (p_result_player->>'k')::numeric, (p_result_player->>'opponentFactor')::numeric,
    (p_result_player->>'circleFactor')::numeric, (p_result_player->>'deltaRaw')::numeric, (p_result_player->>'deltaCapped')::numeric,
    (p_result_player->>'evidenceQuality')::numeric,
    (p_result_player->>'originalLiveMuBefore')::numeric, (p_result_player->>'originalLiveConfidenceBefore')::numeric,
    (p_result_player->>'originalLiveEvidenceUnitsBefore')::numeric,
    (p_result_player->>'muAfter')::numeric, (p_result_player->>'confidenceAfter')::numeric
  );

  select c.rated_matches, c.distinct_opponents into v_rated, v_distinct from public._level_recovery_counts(v_rec.target_player_id) c;

  -- Recuperar NUNCA descalibra: CALIBRADO/RECALIBRANDO se conservan; CALIBRANDO cierra con 5 partidos + 3 rivales.
  v_status := case
    when v_ls.status = 'RECALIBRANDO' then 'RECALIBRANDO'
    when v_ls.status = 'CALIBRADO' then 'CALIBRADO'
    when coalesce(v_rated, 0) >= 5 and coalesce(v_distinct, 0) >= 3 then 'CALIBRADO'
    else 'CALIBRANDO'
  end;
  v_last_rated_at := greatest(coalesce(v_ls.last_rated_at, v_match.played_at), v_match.played_at);

  update public.level_states set
    mu = v_final_mu, confidence = v_final_conf, evidence_units = v_final_ev,
    rated_matches = coalesce(v_rated, 0), distinct_opponents = coalesce(v_distinct, 0),
    status = v_status, algorithm_version = p_algorithm_version, last_rated_at = v_last_rated_at, updated_at = now()
  where player_id = v_rec.target_player_id;

  insert into public.level_recovery_effects (
    recovery_id, match_id, target_player_id, status, reason_codes, played_at, source_result_id, algorithm_version, snapshots_used,
    mu_before_live, confidence_before_live, evidence_units_before_live, mu_after_live, confidence_after_live, evidence_units_after_live,
    mu_effect, confidence_effect, evidence_effect, applied_at
  ) values (
    p_recovery_id, p_match_id, v_rec.target_player_id, 'applied', coalesce(p_reason_codes, '[]'::jsonb), v_match.played_at,
    v_applied.result_id, p_algorithm_version, p_snapshots,
    v_ls.mu, v_ls.confidence, v_ls.evidence_units, v_final_mu, v_final_conf, v_final_ev,
    (p_result_player->>'muAfter')::numeric - (p_result_player->>'originalLiveMuBefore')::numeric,
    (p_result_player->>'confidenceAfter')::numeric - (p_result_player->>'originalLiveConfidenceBefore')::numeric,
    (p_result_player->>'evidenceQuality')::numeric, now()
  ) returning effect_id into v_effect_id;

  -- Evento con el snapshot post-evento COMPLETO (get_player_level_state_as_of lo lee igual que a un match_delta).
  insert into public.level_events (player_id, event_type, algorithm_version, match_id, match_level_result_id, result)
  values (
    v_rec.target_player_id, 'identity_reassignment_delta', p_algorithm_version, p_match_id, v_applied.result_id,
    jsonb_build_object(
      'kind', 'identity_recovery', 'recoveryId', p_recovery_id, 'effectId', v_effect_id,
      'muAfter', v_final_mu, 'confidenceAfter', v_final_conf, 'evidenceUnitsAfter', v_final_ev,
      'statusAfter', v_status, 'lastRatedAtAfter', v_last_rated_at
    )
  );

  return jsonb_build_object('ok', true, 'status', 'applied', 'effectId', v_effect_id,
                            'ratedMatches', coalesce(v_rated, 0), 'distinctOpponents', coalesce(v_distinct, 0), 'levelStatus', v_status);
end;
$$;

revoke all on function public.apply_level_recovery_effect(uuid, uuid, uuid, uuid, jsonb, jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_level_recovery_effect(uuid, uuid, uuid, uuid, jsonb, jsonb, text, jsonb, jsonb) to service_role;

/** Cierra el replay de Nivel: solo si TODOS los partidos recuperados tienen fila de ledger. */
create or replace function public.complete_identity_recovery_level(p_recovery_id uuid, p_lease uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec public.player_identity_recoveries;
  v_missing integer;
begin
  select * into v_rec from public.player_identity_recoveries where recovery_id = p_recovery_id for update;
  if v_rec is null or v_rec.status <> 'completed' then
    return jsonb_build_object('ok', false, 'code', 'recovery_not_found');
  end if;
  if v_rec.level_status = 'completed' then
    return jsonb_build_object('ok', true, 'idempotentReturn', true);
  end if;
  if v_rec.level_lease_token is distinct from p_lease then
    return jsonb_build_object('ok', false, 'code', 'lease_lost');
  end if;
  select count(*)::int into v_missing from unnest(v_rec.recovered_match_ids) as t(mid)
    where not exists (select 1 from public.level_recovery_effects e where e.recovery_id = p_recovery_id and e.match_id = t.mid);
  if v_missing > 0 then
    return jsonb_build_object('ok', false, 'code', 'incomplete', 'missing', v_missing);
  end if;
  update public.player_identity_recoveries
    set level_status = 'completed', level_processed_at = now(), level_lease_token = null,
        level_lease_expires_at = null, level_last_error = null, updated_at = now(),
        result = result || jsonb_build_object(
          'levelApplied', (select count(*)::int from public.level_recovery_effects e where e.recovery_id = p_recovery_id and e.status = 'applied'),
          'levelSkipped', (select count(*)::int from public.level_recovery_effects e where e.recovery_id = p_recovery_id and e.status like 'skipped%'))
    where recovery_id = p_recovery_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.complete_identity_recovery_level(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_identity_recovery_level(uuid, uuid) to service_role;
