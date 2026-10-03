-- BRAMUlab — V04.29-h2 · Corrección forward-only del gate de Central (118) sobre G3 YA APLICADO en Staging.
--
-- Esta migración NO reescribe las G3 ejecutadas: las corrige hacia adelante. Cuatro hallazgos:
--
--  H1  Duplicados con score DISTINTO. "SÍ, ES EL MISMO" solo confirma que es el mismo encuentro; si los scores difieren BRAMU ya no
--      elige por antigüedad ni revierte nada: crea sobre el partido ancla una corrección PROPUESTA (la mecánica vigente de
--      corrección/validación) con el score del otro registro, y el candidato queda `awaiting_confirmation`. La pareja contraria acepta
--      o rechaza con la UX existente; SOLO entonces se finaliza (anular secundario, revertir el doble efecto) dentro de la misma
--      transacción que la aceptación (officialize_match_validation) o el rechazo (respond_post_validation_correction). Una corrección
--      de origen duplicado no vence a los 3 días (`_pending_correction_is_duplicate_origin`); la ventana ordinaria queda intacta.
--  H2  Contadores de Nivel. rated_matches y distinct_opponents salen de UNA sola función (`_level_evidence_counts`): cuenta solo los
--      partidos donde ESE jugador tiene su propia fila vigente en match_level_result_players de un resultado applied+eligible; los
--      rivales distintos se toman de esos mismos partidos (el rival no necesita fila propia). Reemplaza las consultas duplicadas de
--      officialize_match_validation, _bloque6_revert_applied_result y _level_recovery_counts.
--  H3  Concurrencia. Jerarquía única de locks: advisory de PROVISIONAL (seed 7, el mismo del claim) -> advisory de target -> filas de
--      `matches` por match_id. Todo writer que asigna una provisional a un slot (create_or_attach_match, resolve_identity_issue,
--      admin_force_resolve_identity_issue, officialize_match_validation/identity_resolved) toma el lock de la provisional ANTES de
--      cualquier lock de fila y revalida activa/no recuperada bajo lock. claim_provisional_player bloquea las filas de partidos ANTES del
--      preflight y relee bajo lock. Defensa en profundidad: UNIQUE (match_id, player_id) WHERE player_id IS NOT NULL.
--  H4  Contrato de resolve_duplicate_match_candidate: `merged` (terminado) vs `merge_pending_confirmation` (esperando a la otra pareja).

-- ------------------------------------------------------------------
-- 0) Esquema: estados/columnas del candidato + unicidad por slot
-- ------------------------------------------------------------------

alter table public.match_duplicate_candidates drop constraint if exists match_duplicate_candidates_status_check;
alter table public.match_duplicate_candidates add constraint match_duplicate_candidates_status_check
  check (status in ('open', 'awaiting_confirmation', 'resolved_same', 'resolved_different', 'void'));

alter table public.match_duplicate_candidates
  add column if not exists secondary_match_id uuid references public.matches (match_id),
  add column if not exists pending_revision_id uuid references public.match_revisions (revision_id);

create index if not exists match_duplicate_candidates_secondary_idx on public.match_duplicate_candidates (secondary_match_id);
create index if not exists match_duplicate_candidates_pending_revision_idx on public.match_duplicate_candidates (pending_revision_id);

comment on column public.match_duplicate_candidates.secondary_match_id is
  'Registro secundario del par cuando se confirmó "es el mismo" con score distinto: se anula recién al responder la otra pareja.';
comment on column public.match_duplicate_candidates.pending_revision_id is
  'Revisión propuesta sobre el partido ancla (score del otro registro) que la pareja contraria debe aceptar o rechazar.';

-- Defensa en profundidad (116 §H3): nunca la misma persona dos veces en el mismo partido. Los writers igual validan y devuelven códigos
-- estructurados (identity_conflict / duplicate_participant); esta unicidad solo evita que una carrera deje datos corruptos.
create unique index if not exists match_participants_one_slot_per_player
  on public.match_participants (match_id, player_id) where player_id is not null;

-- ------------------------------------------------------------------
-- 1) H2 — contadores de Nivel: UNA sola definición
-- ------------------------------------------------------------------

create or replace function public._level_evidence_counts(p_player_id uuid, p_exclude_match_id uuid default null)
returns table (rated_matches integer, distinct_opponents integer)
language sql
stable
security definer
set search_path = public
as $$
  -- Un partido cuenta SOLO si el jugador tiene su propia fila vigente en un resultado applied+eligible. Los rivales distintos salen de
  -- esos mismos partidos computables DEL JUGADOR (un rival registrado/provisional sin Nivel propio igual suma: B6-A-11).
  with my_matches as (
    select distinct mlr.match_id
      from public.match_level_result_players mlrp
      join public.match_level_results mlr on mlr.result_id = mlrp.result_id
     where mlrp.player_id = p_player_id and mlr.effect_status = 'applied' and mlr.eligible
       and (p_exclude_match_id is null or mlr.match_id <> p_exclude_match_id)
  )
  select
    (select count(*)::int from my_matches),
    (select count(distinct opp.player_id)::int
       from my_matches mm
       join public.match_participants self_p on self_p.match_id = mm.match_id and self_p.player_id = p_player_id
       join public.match_participants opp
         on opp.match_id = mm.match_id and opp.team <> self_p.team and opp.player_id is not null);
$$;

comment on function public._level_evidence_counts is
  'Fuente ÚNICA de rated_matches/distinct_opponents (recovery, reversión, oficialización/corrección). Cuenta solo partidos con fila
   propia vigente del jugador; no toca la fórmula de Nivel. Interna.';
revoke all on function public._level_evidence_counts(uuid, uuid) from public, anon, authenticated;

create or replace function public._level_recovery_counts(p_player_id uuid)
returns table (rated_matches integer, distinct_opponents integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.rated_matches, c.distinct_opponents from public._level_evidence_counts(p_player_id, null) c;
$$;
revoke all on function public._level_recovery_counts(uuid) from public, anon, authenticated;

-- 2) _bloque6_revert_applied_result — misma definición vigente + contadores desde la fuente única

create or replace function public._bloque6_revert_applied_result(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applied public.match_level_results;
  v_row public.match_level_result_players;
  v_cls public.level_states;
  v_rated integer;
  v_distinct integer;
  v_status text;
  v_last_rated_at timestamptz;
  v_final_mu numeric;
  v_final_confidence numeric;
  v_final_evidence_units numeric;
begin
  select * into v_applied from public.match_level_results
    where match_id = p_match_id and effect_status = 'applied' for update;
  if v_applied is null then
    return null;
  end if;

  -- Ajuste secundario recomendado (08_Revision_Central_Adicional.md): orden determinístico por
  -- player_id, mismo criterio que officialize_match_validation, para reducir riesgo de deadlock
  -- entre dos reversiones/oficializaciones concurrentes que comparten jugadores.
  for v_row in select * from public.match_level_result_players where result_id = v_applied.result_id order by player_id
  loop
    select * into v_cls from public.level_states where player_id = v_row.player_id for update;

    -- H2 (V04.29-h2): contadores desde la fuente única, excluyendo el partido que se está revirtiendo.
    select c.rated_matches, c.distinct_opponents into v_rated, v_distinct
      from public._level_evidence_counts(v_row.player_id, p_match_id) c;

    -- B6-A-12: no monotónico — la evidencia oficial VIGENTE decide, nunca "una vez CALIBRADO
    -- siempre CALIBRADO". RECALIBRANDO conserva su semántica propia, fuera de Bloque 6.
    v_status := case
      when v_cls.status = 'RECALIBRANDO' then 'RECALIBRANDO'
      when coalesce(v_rated, 0) >= 5 and coalesce(v_distinct, 0) >= 3 then 'CALIBRADO'
      else 'CALIBRANDO'
    end;

    -- B6-A-13 + C-09: last_rated_at se recompone desde la actividad computable restante,
    -- pero NUNCA puede perder el ancla inicial del cuestionario. Si se revierte el único partido
    -- computable, el reloj de inactividad vuelve al initial_estimate en vez de quedar NULL.
    select greatest(
      (
        select max(m.played_at)
        from public.match_level_result_players mlrp
        join public.match_level_results mlr
          on mlr.result_id = mlrp.result_id and mlr.effect_status = 'applied' and mlr.eligible
          and mlr.result_id <> v_applied.result_id
        join public.matches m on m.match_id = mlr.match_id
        where mlrp.player_id = v_row.player_id
      ),
      (
        select max(le.created_at)
        from public.level_events le
        where le.player_id = v_row.player_id and le.event_type = 'initial_estimate'
      )
    ) into v_last_rated_at;

    -- B6-A-03/B6-A-04/C-01: revertir con el EFECTO REAL de esta aplicación — `X_after` (valor
    -- ABSOLUTO de fórmula, nunca contaminado por el LIVE) menos `original_live_X_before` (el
    -- baseline LIVE inmutable de este partido/jugador) — nunca `delta_capped`/`evidence_quality`
    -- a mano, que pueden diferir cerca de los clamps o de la fórmula incremental de confianza, y
    -- nunca un movimiento LIVE-a-LIVE, que un partido/corrección posterior intercalado podía
    -- corromper (C-01) — mu/confidence/evidence_units los tres, nunca solo mu.
    update public.level_states set
      mu = round(greatest(1.0, least(10.0, mu - (v_row.mu_after - v_row.original_live_mu_before))), 4),
      confidence = confidence - (v_row.confidence_after - v_row.original_live_confidence_before),
      evidence_units = greatest(0, evidence_units - v_row.evidence_quality),
      rated_matches = coalesce(v_rated, 0),
      distinct_opponents = coalesce(v_distinct, 0),
      status = v_status,
      last_rated_at = v_last_rated_at,
      updated_at = now()
    where player_id = v_row.player_id
    returning mu, confidence, evidence_units into v_final_mu, v_final_confidence, v_final_evidence_units;

    -- B6-B-02: este evento es el ÚNICO que representa esta reversión (nunca hay un evento
    -- posterior en la misma transacción, a diferencia de officialize_match_validation) — debe
    -- llevar el snapshot post-evento COMPLETO, nunca solo `{revertedResultId}`. Antes de este
    -- fix, get_player_level_state_as_of podía leer un evento sin muAfter/confidenceAfter/
    -- evidenceUnitsAfter/statusAfter y devolver campos NULL, tratando a un jugador real como
    -- invitado sin Nivel.
    insert into public.level_events (player_id, event_type, algorithm_version, match_id, match_level_result_id, result)
    values (
      v_row.player_id, 'match_correction_reversal', v_applied.algorithm_version, p_match_id, v_applied.result_id,
      jsonb_build_object(
        'revertedResultId', v_applied.result_id,
        'muAfter', v_final_mu,
        'confidenceAfter', v_final_confidence,
        'evidenceUnitsAfter', v_final_evidence_units,
        'statusAfter', v_status,
        'lastRatedAtAfter', v_last_rated_at
      )
    );
  end loop;

  update public.match_level_results set effect_status = 'reverted', reverted_at = now() where result_id = v_applied.result_id;
  return v_applied.result_id;
end;
$$;

-- ------------------------------------------------------------------
-- 3) H3 — helpers de serialización por provisional (mismo advisory que claim_provisional_player/create_claim_link)
-- ------------------------------------------------------------------

create or replace function public._lock_provisional_for_assignment(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is not null and exists (select 1 from public.players where player_id = p_player_id and type = 'provisional') then
    perform pg_advisory_xact_lock(hashtextextended('bramu:identity_recovery:prov:' || p_player_id::text, 7));
  end if;
end;
$$;

-- Varios ids: siempre en orden por player_id (dos writers con las mismas provisionales nunca se cruzan).
create or replace function public._lock_provisionals_for_assignment(p_player_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select pl.player_id from public.players pl
     where pl.player_id = any (p_player_ids) and pl.type = 'provisional'
     order by pl.player_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('bramu:identity_recovery:prov:' || v_id::text, 7));
  end loop;
end;
$$;

comment on function public._lock_provisional_for_assignment is
  'Jerarquía de locks (H3): provisional -> target -> filas de matches. Todo writer que asigna una provisional a un slot la toma ANTES de
   bloquear filas y revalida is_active/recovered_into_player_id bajo lock. Interna.';
revoke all on function public._lock_provisional_for_assignment(uuid) from public, anon, authenticated;
revoke all on function public._lock_provisionals_for_assignment(uuid[]) from public, anon, authenticated;

-- 4) officialize_match_validation — misma definición vigente (27SEP) + H2 contadores + H3 locks/revalidación + H1 finalización

create or replace function public.officialize_match_validation(
  p_match_id uuid,
  -- La revisión que ESTE cálculo asume vigente — B6-A-07: bajo lock, debe coincidir con
  -- matches.current_revision_id (initial/identity_*) o matches.pending_correction_revision_id
  -- (correction_accepted). Mismatch => stale_match_revision, cero escritura.
  p_revision_id uuid,
  p_trigger text,
  p_actor_player_id uuid,
  p_actor_note text,
  p_eligible boolean,
  p_reason_codes jsonb,
  p_algorithm_version text,
  p_known_levels_count integer,
  p_team_strength_a numeric,
  p_team_strength_b numeric,
  p_expectation_a numeric,
  p_expectation_b numeric,
  p_rival_pair_confidence_avg_a numeric,
  p_rival_pair_confidence_avg_b numeric,
  p_margin numeric,
  p_format_factor numeric,
  p_availability_factor numeric,
  p_repetition_factor_a numeric,
  p_repetition_factor_b numeric,
  p_companion_factor_a numeric,
  p_companion_factor_b numeric,
  -- [{playerId,team,formulaMuBefore,formulaConfidenceBefore,formulaState,effectiveLevel,k,
  --   opponentFactor,circleFactor,deltaRaw,deltaCapped,evidenceQuality,
  --   muBefore,muAfter,confidenceBefore,confidenceAfter,evidenceUnitsBefore,evidenceUnitsAfter}]
  -- — salida de PLMatchLevelEngine.computeLevelStateUpdates().resultPlayers. Vacío si !p_eligible.
  p_result_players jsonb,
  -- [{playerId,finalMu,finalConfidence,finalEvidenceUnits,currentMuForLock,
  --   currentConfidenceForLock,currentEvidenceUnitsForLock}] — .levelStateUpdates. Incluye TODO
  -- jugador afectado (viejo ∪ nuevo), incluso uno que ya no participa del resultado nuevo
  -- (reversión pura, ver computeLevelStateUpdates).
  p_level_state_updates jsonb,
  -- Bookkeeping atómico específico de trigger (B6-A-08/B6-A-09) — NULL salvo que corresponda.
  -- team/position_in_team del slot NO se reciben como parámetro: se leen de la propia fila de
  -- match_identity_issues (ya bajo lock acá abajo) para que nunca puedan desalinearse de la
  -- incidencia real que se está resolviendo.
  p_identity_issue_id uuid default null,
  p_identity_replacement_player_id uuid default null,
  -- Pre-Production P0.1 (revisión central 24/09/2026) — MISMO winnerTeam que la Edge Function ya
  -- calculó vía match-sync.js#deriveWinnerTeam para localMatch (nunca recalculado acá). Default
  -- null: un caller que todavía no lo pase deja matches.winner_team intacto, nunca lo pisa con
  -- NULL — ver el guard `if p_winner_team is not null` más abajo.
  p_winner_team text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_existing_applied public.match_level_results;
  v_existing_player_ids uuid[];
  v_new_result_player_ids uuid[];
  v_identity_issue public.match_identity_issues;
  v_result_id uuid;
  v_update jsonb;
  v_player_id uuid;
  v_has_new_row boolean;
  v_current_level_state public.level_states;
  v_new_rated_matches integer;
  v_new_distinct_opponents integer;
  v_new_status text;
  v_new_last_rated_at timestamptz;
  v_event_type text;
  v_action_type text;
  v_notification_type text;
  v_result jsonb;
begin
  if p_trigger not in ('initial', 'correction_accepted', 'identity_resolved', 'identity_unidentified') then
    raise exception 'invalid_trigger' using errcode = 'P0001';
  end if;
  if p_trigger in ('identity_resolved', 'identity_unidentified') and p_identity_issue_id is null then
    raise exception 'identity_issue_id_required' using errcode = 'P0001';
  end if;
  if p_trigger = 'identity_resolved' and p_identity_replacement_player_id is null then
    raise exception 'identity_replacement_player_id_required' using errcode = 'P0001';
  end if;

  -- H3: la provisional que se va a asignar se serializa ANTES de cualquier lock de fila (jerarquía provisional -> matches).
  if p_trigger = 'identity_resolved' then
    perform public._lock_provisional_for_assignment(p_identity_replacement_player_id);
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;

  -- ------------------------------------------------------------------
  -- C-02 — defensa en profundidad para la PRIMERA oficialización.
  -- Solo un partido pending_validation puede crear un resultado initial nuevo. Un partido ya
  -- validated es un estado terminal para este trigger: el reintento de Confirmar se resuelve en
  -- la Edge Function como NO-OP y, aun si algún caller service-role invoca este núcleo directo,
  -- acá nunca se permite que un trigger='initial' pise un resultado posterior de corrección o
  -- identidad. Tampoco estados annulled/expired/etc. pueden oficializarse por accidente.
  -- ------------------------------------------------------------------
  if p_trigger = 'initial' then
    if v_match.status = 'validated' then
      return jsonb_build_object('ok', false, 'code', 'already_validated');
    end if;
    if v_match.status <> 'pending_validation' then
      return jsonb_build_object('ok', false, 'code', 'match_not_actionable');
    end if;
    if v_match.action_side is not null then
      return jsonb_build_object('ok', false, 'code', 'not_ready_for_validation');
    end if;
    if v_match.validation_deadline_at is null or now() > v_match.validation_deadline_at then
      return jsonb_build_object('ok', false, 'code', 'match_expired');
    end if;
    if exists (select 1 from public.match_identity_issues where match_id = p_match_id and status = 'open') then
      return jsonb_build_object('ok', false, 'code', 'identity_issue_open');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- B6-A-07 — verificación de REVISIÓN esperada, distinta y adicional a la de snapshots de
  -- Nivel: protege contra oficializar/reaplicar sobre una revisión que ya dejó de ser la
  -- correcta para este trigger (p. ej. una nueva corrección pre-validación se coló entre que la
  -- Edge Function leyó el snapshot y llamó acá).
  -- ------------------------------------------------------------------
  if p_trigger = 'correction_accepted' then
    if v_match.pending_correction_revision_id is null or v_match.pending_correction_revision_id <> p_revision_id then
      return jsonb_build_object('ok', false, 'code', 'stale_match_revision');
    end if;
  else
    if v_match.current_revision_id is null or v_match.current_revision_id <> p_revision_id then
      return jsonb_build_object('ok', false, 'code', 'stale_match_revision');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- B6-A-09 — para triggers de identidad, la incidencia debe seguir open bajo lock: protege
  -- contra una resolución concurrente duplicada o una ya vencida/materializada por otro camino.
  -- ------------------------------------------------------------------
  if p_trigger in ('identity_resolved', 'identity_unidentified') then
    select * into v_identity_issue from public.match_identity_issues where issue_id = p_identity_issue_id for update;
    if v_identity_issue is null or v_identity_issue.status <> 'open' then
      return jsonb_build_object('ok', false, 'code', 'identity_issue_not_open');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- Idempotencia por estado (mismo criterio que officialize_level_onboarding, Bloque 3): si YA
  -- existe un resultado applied para exactamente esta revisión/trigger/composición de
  -- jugadores conocidos, se devuelve tal cual — nunca se recalcula ni se duplica.
  -- ------------------------------------------------------------------
  -- H3: revalidación BAJO LOCK del reemplazo (resolve_identity_issue autorizó en otra transacción): nunca la misma persona dos veces
  -- ni una provisional ya recuperada/inactiva. Va antes de cualquier escritura (un return normal confirmaría lo escrito).
  if p_trigger = 'identity_resolved' then
    if exists (select 1 from public.match_participants where match_id = p_match_id and player_id = p_identity_replacement_player_id) then
      return jsonb_build_object('ok', false, 'code', 'duplicate_participant');
    end if;
    if not exists (select 1 from public.players where player_id = p_identity_replacement_player_id and is_active) then
      return jsonb_build_object('ok', false, 'code', 'participant_not_found');
    end if;
  end if;

  select * into v_existing_applied
  from public.match_level_results
  where match_id = p_match_id and effect_status = 'applied'
  for update;

  if v_existing_applied.result_id is not null and v_existing_applied.revision_id = p_revision_id and v_existing_applied.trigger = p_trigger then
    select array_agg(player_id order by player_id) into v_existing_player_ids
    from public.match_level_result_players where result_id = v_existing_applied.result_id;

    select array_agg((elem->>'playerId')::uuid order by (elem->>'playerId')::uuid)
      into v_new_result_player_ids
      from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) elem;

    if coalesce(v_existing_player_ids, array[]::uuid[]) = coalesce(v_new_result_player_ids, array[]::uuid[]) then
      return jsonb_build_object(
        'ok', true, 'resultId', v_existing_applied.result_id, 'eligible', v_existing_applied.eligible,
        'idempotentReturn', true
      );
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- Verificación optimista: el mu/confidence/evidence_units ACTUAL de level_states (bajo lock,
  -- en orden determinístico por player_id para no producir deadlocks entre dos oficializaciones
  -- concurrentes que comparten jugadores) debe coincidir con el que el motor usó como base del
  -- neto. Si no coincide, otra oficialización concurrente ya movió ese jugador primero: se
  -- rechaza sin escribir nada — el llamador relee y recalcula sobre el estado fresco.
  --
  -- Fix P0 precisión (handoff 23, 26/09/2026) — la comparación pasa de igualdad EXACTA
  -- (`is distinct from` directo sobre el numeric crudo) a igualdad redondeada a
  -- INTERNAL_DECIMALS=4 (level.js#PARAMS.INTERNAL_DECIMALS, la misma precisión interna que la
  -- fórmula normativa ya usa para todo su pipeline — Nivel_BRAMU_Formula_V1.5.md). El valor
  -- persistido en `level_states` y el valor recibido en `p_level_state_updates` viajan por
  -- Postgres NUMERIC -> JSON -> JavaScript Number -> JSON -> NUMERIC; esa ida y vuelta puede
  -- introducir un artefacto binario IEEE-754 en los decimales MÁS ALLÁ del cuarto (ej.
  -- 2.4797000000000004 vs. 2.4797000000000002 — el mismo valor de negocio, una diferencia de
  -- representación, nunca un cambio real). Redondear ambos lados a 4 decimales antes de
  -- comparar es fiel a la propia precisión que el motor ya declara como su resolución interna
  -- — nunca una tolerancia arbitraria inventada acá. El lock sigue rechazando cualquier
  -- diferencia REAL (>= 0.0001): una oficialización/corrección/identidad concurrente que de
  -- verdad movió mu/confidence/evidence_units sigue produciendo `stale_level_snapshot` como
  -- corresponde. `4` es literal (SQL no puede importar la constante JS) — si
  -- INTERNAL_DECIMALS cambia algún día en level.js, esta función debe actualizarse junto con
  -- ese cambio normativo.
  -- ------------------------------------------------------------------
  for v_player_id in
    select (elem->>'playerId')::uuid
    from jsonb_array_elements(coalesce(p_level_state_updates, '[]'::jsonb)) elem
    order by (elem->>'playerId')::uuid
  loop
    select * into v_current_level_state from public.level_states where player_id = v_player_id for update;
    v_update := (
      select elem from jsonb_array_elements(p_level_state_updates) elem where (elem->>'playerId')::uuid = v_player_id limit 1
    );
    if v_current_level_state is null
       or round(v_current_level_state.mu, 4) is distinct from round((v_update->>'currentMuForLock')::numeric, 4)
       or round(v_current_level_state.confidence, 4) is distinct from round((v_update->>'currentConfidenceForLock')::numeric, 4)
       or round(coalesce(v_current_level_state.evidence_units, 0), 4) is distinct from round(coalesce((v_update->>'currentEvidenceUnitsForLock')::numeric, 0), 4)
    then
      return jsonb_build_object('ok', false, 'code', 'stale_level_snapshot', 'playerId', v_player_id);
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- Revertir el resultado anterior vigente (si existe) — nunca se borra, se marca reverted.
  --
  -- B6-B-02: acá NO se escribe un level_events por jugador. Todo jugador del resultado anterior
  -- (viejo ∪ nuevo, ver PLMatchLevelEngine.computeLevelStateUpdates) recibe MÁS ABAJO, en la
  -- MISMA transacción, un evento único con el snapshot post-operación COMPLETO — un segundo
  -- evento acá, con el mismo `created_at` de transacción (now() es fijo por transacción en
  -- Postgres) y solo `{revertedResultId}`, competía por el desempate de
  -- get_player_level_state_as_of y podía devolver un estado roto. El resultado revertido sigue
  -- siendo auditable por match_level_results.reverses_result_id/superseded_by_result_id.
  -- ------------------------------------------------------------------
  if v_existing_applied.result_id is not null then
    update public.match_level_results
      set effect_status = 'reverted', reverted_at = now()
      where result_id = v_existing_applied.result_id;
  end if;

  -- ------------------------------------------------------------------
  -- Nuevo match_level_results (cabecera) — siempre se inserta, eligible o no, para auditoría.
  -- ------------------------------------------------------------------
  insert into public.match_level_results (
    match_id, revision_id, trigger, algorithm_version, eligible, reason_codes,
    known_levels_count, team_strength_a, team_strength_b, expectation_a, expectation_b,
    rival_pair_confidence_avg_a, rival_pair_confidence_avg_b, margin, format_factor,
    availability_factor, repetition_factor_a, repetition_factor_b, companion_factor_a, companion_factor_b,
    reverses_result_id, actor_player_id, actor_note
  ) values (
    p_match_id, p_revision_id, p_trigger, p_algorithm_version, coalesce(p_eligible, false), coalesce(p_reason_codes, '[]'::jsonb),
    p_known_levels_count, p_team_strength_a, p_team_strength_b, p_expectation_a, p_expectation_b,
    p_rival_pair_confidence_avg_a, p_rival_pair_confidence_avg_b, p_margin, p_format_factor,
    p_availability_factor, p_repetition_factor_a, p_repetition_factor_b, p_companion_factor_a, p_companion_factor_b,
    case when v_existing_applied.result_id is not null then v_existing_applied.result_id else null end,
    p_actor_player_id, p_actor_note
  ) returning result_id into v_result_id;

  if v_existing_applied.result_id is not null then
    update public.match_level_results set superseded_by_result_id = v_result_id where result_id = v_existing_applied.result_id;
  end if;

  if coalesce(p_eligible, false) then
    -- C-01: original_live_*_before es el baseline LIVE INMUTABLE de este partido/jugador
    -- (se propaga sin cambios entre correcciones); mu_after/confidence_after son el valor
    -- ABSOLUTO de fórmula de ESTA aplicación puntual (nunca el LIVE contaminado por partidos
    -- posteriores) — ver PLMatchLevelEngine.computeLevelStateUpdates.
    insert into public.match_level_result_players (
      result_id, player_id, team,
      formula_mu_before, formula_confidence_before, formula_state,
      effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
      original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before,
      mu_after, confidence_after
    )
    select
      v_result_id, (rp->>'playerId')::uuid, rp->>'team',
      (rp->>'formulaMuBefore')::numeric, (rp->>'formulaConfidenceBefore')::numeric, rp->>'formulaState',
      (rp->>'effectiveLevel')::numeric, (rp->>'k')::numeric, (rp->>'opponentFactor')::numeric, (rp->>'circleFactor')::numeric,
      (rp->>'deltaRaw')::numeric, (rp->>'deltaCapped')::numeric, (rp->>'evidenceQuality')::numeric,
      (rp->>'originalLiveMuBefore')::numeric, (rp->>'originalLiveConfidenceBefore')::numeric, (rp->>'originalLiveEvidenceUnitsBefore')::numeric,
      (rp->>'muAfter')::numeric, (rp->>'confidenceAfter')::numeric
    from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) rp;
  end if;

  -- ------------------------------------------------------------------
  -- B6-B-06 — para identity_resolved, el reemplazo de participante debe quedar escrito ANTES de
  -- recalcular rated_matches/distinct_opponents (loop de abajo): si no, el conteo de los propios
  -- RIVALES del jugador reemplazado podía leer ese slot todavía NULL/con el jugador viejo. Ocurre
  -- en la MISMA transacción que todo lo demás — si algo falla después, Postgres revierte todo.
  -- B6-B-04: el fingerprint se actualiza inmediatamente después, atómicamente.
  -- ------------------------------------------------------------------
  if p_trigger = 'identity_resolved' then
    update public.match_participants set
      player_id = p_identity_replacement_player_id,
      display_name_snapshot = coalesce((select display_name from public.players where player_id = p_identity_replacement_player_id), 'Jugador')
    where match_id = p_match_id and team = v_identity_issue.team and position_in_team = v_identity_issue.position_in_team;

    perform public._bloque6_refresh_participant_fingerprint(p_match_id);
  end if;

  -- ------------------------------------------------------------------
  -- Escribir los valores YA CALCULADOS en level_states. B6-A-11: distinct_opponents cuenta
  -- CUALQUIER player_id rival de match_participants (registrado o provisional, nunca un slot
  -- NULL) de partidos con resultado applied+eligible — no exige que el rival tenga su propia
  -- fila en match_level_result_players. B6-A-12: status se deriva de la evidencia oficial
  -- VIGENTE, nunca monotónico (una corrección/incidencia que retira evidencia puede devolver
  -- CALIBRADO -> CALIBRANDO; RECALIBRANDO conserva su semántica propia, fuera de Bloque 6).
  -- B6-A-13: last_rated_at es actividad deportiva computable (played_at del partido), nunca
  -- hora de escritura — y para un jugador cuya contribución a ESTE partido se retira sin
  -- reemplazo (reversión pura dentro de esta misma operación), se recompone como el máximo
  -- played_at de sus resultados applied+eligible restantes.
  -- ------------------------------------------------------------------
  v_event_type := case p_trigger
    when 'initial' then 'match_delta'
    when 'correction_accepted' then 'match_correction_reapply'
    else 'identity_reassignment_delta'
  end;

  for v_update in select * from jsonb_array_elements(coalesce(p_level_state_updates, '[]'::jsonb))
  loop
    v_player_id := (v_update->>'playerId')::uuid;
    select * into v_current_level_state from public.level_states where player_id = v_player_id;

    v_has_new_row := exists (
      select 1 from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) rp
      where (rp->>'playerId')::uuid = v_player_id
    );

    -- H2: fuente única de contadores.
    select c.rated_matches, c.distinct_opponents into v_new_rated_matches, v_new_distinct_opponents
      from public._level_evidence_counts(v_player_id, null) c;

    v_new_status := case
      when v_current_level_state.status = 'RECALIBRANDO' then 'RECALIBRANDO'
      when coalesce(v_new_rated_matches, 0) >= 5 and coalesce(v_new_distinct_opponents, 0) >= 3 then 'CALIBRADO'
      else 'CALIBRANDO'
    end;

    if v_has_new_row then
      v_new_last_rated_at := greatest(coalesce(v_current_level_state.last_rated_at, v_match.played_at), v_match.played_at);
    else
      -- Reversión pura sin reemplazo en esta misma operación (p. ej. identidad retirada):
      -- last_rated_at nunca puede caer por debajo del ancla inicial del cuestionario (C-09).
      -- Se recompone con la actividad computable restante y, como piso temporal real, el
      -- initial_estimate que creó el primer Nivel del jugador.
      select greatest(
        (
          select max(m.played_at)
          from public.match_level_result_players mlrp
          join public.match_level_results mlr on mlr.result_id = mlrp.result_id and mlr.effect_status = 'applied' and mlr.eligible
          join public.matches m on m.match_id = mlr.match_id
          where mlrp.player_id = v_player_id
        ),
        (
          select max(le.created_at)
          from public.level_events le
          where le.player_id = v_player_id and le.event_type = 'initial_estimate'
        )
      ) into v_new_last_rated_at;
    end if;

    update public.level_states set
      mu = (v_update->>'finalMu')::numeric,
      confidence = (v_update->>'finalConfidence')::numeric,
      evidence_units = (v_update->>'finalEvidenceUnits')::numeric,
      rated_matches = coalesce(v_new_rated_matches, 0),
      distinct_opponents = coalesce(v_new_distinct_opponents, 0),
      status = v_new_status,
      algorithm_version = p_algorithm_version,
      last_rated_at = v_new_last_rated_at,
      updated_at = now()
    where player_id = v_player_id;

    insert into public.level_events (player_id, event_type, algorithm_version, match_id, match_level_result_id, result)
    values (
      v_player_id, v_event_type, p_algorithm_version, p_match_id, v_result_id,
      jsonb_build_object(
        'muAfter', (v_update->>'finalMu')::numeric,
        'confidenceAfter', (v_update->>'finalConfidence')::numeric,
        'evidenceUnitsAfter', (v_update->>'finalEvidenceUnits')::numeric,
        'statusAfter', v_new_status,
        -- B6-B-02: imprescindible para que get_player_level_state_as_of pueda devolver lastRatedAt.
        'lastRatedAtAfter', v_new_last_rated_at
      )
    );
  end loop;

  -- ------------------------------------------------------------------
  -- B6-A-08/B6-A-09 — bookkeeping atómico específico de trigger, en la MISMA transacción que
  -- ya aplicó/revirtió Nivel: nunca queda un estado a medias entre "el resultado/participante ya
  -- cambió" y "Nivel todavía no". La reasignación de match_participants de identity_resolved ya
  -- ocurrió ARRIBA (B6-B-06, antes de recalcular distinct_opponents) — acá solo cierra la
  -- incidencia, enlazando el resultado recién calculado.
  -- ------------------------------------------------------------------
  if p_trigger = 'correction_accepted' then
    update public.matches set
      current_revision_id = p_revision_id,
      pending_correction_revision_id = null,
      updated_at = now()
    where match_id = p_match_id;
  elsif p_trigger = 'identity_resolved' then
    update public.match_identity_issues set
      status = 'resolved', resolved_player_id = p_identity_replacement_player_id, resolved_at = now(),
      reapplied_result_id = v_result_id, updated_at = now()
    where issue_id = p_identity_issue_id;
  elsif p_trigger = 'identity_unidentified' then
    update public.match_identity_issues set
      status = 'unidentified', resolved_at = now(), reapplied_result_id = v_result_id, updated_at = now()
    where issue_id = p_identity_issue_id;
  end if;

  -- ------------------------------------------------------------------
  -- Pre-Production P0.1 (revisión central 24/09/2026) — único agregado real de esta migración:
  -- persiste el winnerTeam que la Edge Function ya calculó (nunca lo recalcula), para los 4
  -- triggers por igual. `is not null` protege contra un caller viejo que todavía no lo pase: deja
  -- matches.winner_team exactamente como estaba, nunca lo pisa con NULL por omisión.
  -- ------------------------------------------------------------------
  if p_winner_team is not null then
    update public.matches set winner_team = p_winner_team, updated_at = now() where match_id = p_match_id;
  end if;

  -- ------------------------------------------------------------------
  -- match_actions / notifications / pilot_events
  -- ------------------------------------------------------------------
  v_action_type := case p_trigger
    when 'initial' then 'validated'
    when 'correction_accepted' then 'correction_accepted'
    when 'identity_resolved' then 'participant_replaced'
    else 'participant_unidentified'
  end;
  v_notification_type := case p_trigger
    when 'initial' then 'match_validated'
    when 'correction_accepted' then 'correction_accepted'
    when 'identity_resolved' then 'identity_resolved'
    else 'identity_unidentified'
  end;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
  values (p_match_id, v_action_type, coalesce(p_actor_player_id, v_match.created_by_player_id), null, p_revision_id, coalesce(p_reason_codes, '[]'::jsonb));

  insert into public.notifications (player_id, type, match_id, payload)
  select mp.player_id, v_notification_type, p_match_id, '{}'::jsonb
  from public.match_participants mp
  where mp.match_id = p_match_id and mp.player_id is not null;

  if p_trigger = 'initial' then
    update public.matches set
      status = 'validated',
      validated_at = coalesce(validated_at, now()),
      action_side = null,
      updated_at = now()
    where match_id = p_match_id;

    insert into public.pilot_events (event_name, player_id, properties)
    values ('match_validated', v_match.created_by_player_id, jsonb_build_object('matchId', p_match_id));
  end if;

  -- H1: si esta corrección era la propuesta de una reconciliación de duplicado, la ACEPTACIÓN deja un único encuentro efectivo
  -- (anula el secundario y revierte su efecto) en esta misma transacción.
  if p_trigger = 'correction_accepted' then
    perform public._finalize_duplicate_reconciliation(p_match_id, p_revision_id, 'accepted');
  end if;

  select jsonb_build_object('ok', true, 'resultId', v_result_id, 'eligible', coalesce(p_eligible, false)) into v_result;
  return v_result;
end;
$$;

-- 5) create_or_attach_match — misma definición vigente + lock de provisionales (H3)

create or replace function public.create_or_attach_match(
  p_auth_user_id uuid,
  p_idempotency_key uuid,
  p_pair1_player_id_1 uuid,
  p_pair1_player_id_2 uuid,
  p_pair2_player_id_1 uuid,
  p_pair2_player_id_2 uuid,
  p_played_at timestamptz,
  p_played_at_time_known boolean,
  p_format_id text,
  -- Sets tal como los envió el cliente, YA validados/normalizados por la Edge Function con
  -- engine.js: [{"gamesA":int,"gamesB":int,"tiebreakA":int|null,"tiebreakB":int|null}, ...],
  -- orientados "pair1 vs pair2" (no A/B — esa etiqueta la decide esta función, ver arriba).
  p_sets jsonb,
  p_reported_time_zone text default null,
  p_scoring_system text default null,
  p_location_name text default null,
  p_location_lat numeric default null,
  p_location_lng numeric default null,
  p_disambiguation_match_id uuid default null,
  p_disambiguation_force_new boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_payload jsonb;
  v_payload_hash text;
  v_existing_submission public.match_submissions;
  v_ids uuid[];
  v_distinct_ids uuid[];
  v_pid uuid;
  v_result jsonb;
  v_pending_count integer;
  v_new_set_count integer;
  v_pair1_key text;
  v_pair2_key text;
  v_pair1_is_first boolean;
  v_team_a_1 uuid;
  v_team_a_2 uuid;
  v_team_b_1 uuid;
  v_team_b_2 uuid;
  v_fingerprint text;
  v_caller_team text;
  v_candidates jsonb;
  v_candidate_count integer;
  v_target_match_id uuid;
  v_match public.matches;
  v_current_revision_number integer;
  v_current_set_count integer;
  v_scores_match boolean;
  v_current_proposer_team text;
  v_revision_id uuid;
  v_revision_number integer;
  v_new_action_side text;
  v_identity_candidates jsonb;
  v_identity_candidate_count integer;
  v_identity_target_match_id uuid;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = p_auth_user_id;
  if v_caller_player_id is null then
    raise exception 'no_player_for_user' using errcode = 'P0001';
  end if;

  -- ------------------------------------------------------------------
  -- Idempotencia (02_Analisis_Claude.md §5.5; corregida en 06_Revision_Pre_Staging_ChatGPT.md
  -- §3/§4). El hash cubre TODOS los inputs de negocio de la RPC — no solo los que participan de
  -- la huella — para que reusar la misma key con cualquier otro dato distinto se detecte como
  -- `idempotency_key_reused_with_different_payload`, nunca se confunda con "mismo intento".
  -- ------------------------------------------------------------------
  v_payload := jsonb_build_object(
    'pair1a', p_pair1_player_id_1, 'pair1b', p_pair1_player_id_2,
    'pair2a', p_pair2_player_id_1, 'pair2b', p_pair2_player_id_2,
    'playedAt', p_played_at, 'playedAtTimeKnown', p_played_at_time_known,
    'formatId', p_format_id, 'sets', p_sets,
    'reportedTimeZone', p_reported_time_zone, 'scoringSystem', p_scoring_system,
    'locationName', p_location_name, 'locationLat', p_location_lat, 'locationLng', p_location_lng,
    'disambiguationMatchId', p_disambiguation_match_id,
    'disambiguationForceNew', p_disambiguation_force_new
  );
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  -- Advisory lock por idempotency_key — ANTES de consultar match_submissions. Sin esto, dos
  -- requests concurrentes con la MISMA key podrían leer "no existe" al mismo tiempo y ejecutar
  -- la lógica de negocio dos veces (06_Revision_Pre_Staging_ChatGPT.md §3). Semilla 1, distinta
  -- de la semilla 0 del lock por huella de más abajo — resuelven problemas diferentes y no
  -- comparten el mismo espacio de hash.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 1));

  select * into v_existing_submission from public.match_submissions where idempotency_key = p_idempotency_key;
  if v_existing_submission is not null then
    if v_existing_submission.payload_hash <> v_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'idempotency_key_reused_with_different_payload');
    end if;
    return v_existing_submission.result_payload;
  end if;

  -- ------------------------------------------------------------------
  -- Validación de participantes
  -- ------------------------------------------------------------------
  v_ids := array[p_pair1_player_id_1, p_pair1_player_id_2, p_pair2_player_id_1, p_pair2_player_id_2];
  select array_agg(distinct x) into v_distinct_ids from unnest(v_ids) as x;
  if v_distinct_ids is null or array_length(v_distinct_ids, 1) <> 4 then
    v_result := jsonb_build_object('ok', false, 'code', 'duplicate_participant');
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
    return v_result;
  end if;

  if not (v_caller_player_id = any (v_ids)) then
    v_result := jsonb_build_object('ok', false, 'code', 'not_a_participant');
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
    return v_result;
  end if;

  -- H3: serializar las provisionales de esta carga (orden determinístico) ANTES de leer is_active/crear filas; un vínculo concurrente
  -- sobre alguna de ellas espera acá y esta carga ve la provisional ya inactiva (participant_not_found), o el vínculo ve el partido nuevo.
  perform public._lock_provisionals_for_assignment(v_ids);

  foreach v_pid in array v_ids loop
    if not exists (select 1 from public.players where player_id = v_pid and is_active) then
      v_result := jsonb_build_object('ok', false, 'code', 'participant_not_found', 'playerId', v_pid);
      insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
        values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
      return v_result;
    end if;

    -- Provisional "seleccionable" (Decisión #3): creada por el caller, o ya compartió un
    -- partido con el caller — mismo criterio que list_related_provisional_players. Nunca
    -- fusiona por nombre, nunca alcanza con "existe": tiene que estar relacionada.
    if exists (select 1 from public.players where player_id = v_pid and type = 'provisional') then
      if not (
        exists (select 1 from public.players where player_id = v_pid and created_by_player_id = v_caller_player_id)
        or exists (
          select 1 from public.match_participants mp_prov
          join public.match_participants mp_self on mp_self.match_id = mp_prov.match_id and mp_self.player_id = v_caller_player_id
          where mp_prov.player_id = v_pid
        )
      ) then
        v_result := jsonb_build_object('ok', false, 'code', 'provisional_not_selectable', 'playerId', v_pid);
        insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
          values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
        return v_result;
      end if;
    end if;
  end loop;

  if p_format_id not in ('classic', 'americano') then
    v_result := jsonb_build_object('ok', false, 'code', 'invalid_format');
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
    return v_result;
  end if;

  -- Defensa en profundidad: la Edge Function ya validó legalidad completa de los sets con
  -- engine.js — acá solo se verifica la forma básica (cantidad de sets), nunca se reimplementa
  -- la regla de set/formato en SQL (02_Analisis_Claude.md §2).
  v_new_set_count := jsonb_array_length(coalesce(p_sets, '[]'::jsonb));
  if v_new_set_count < 1 or v_new_set_count > 3 then
    v_result := jsonb_build_object('ok', false, 'code', 'invalid_sets');
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
    return v_result;
  end if;

  -- ------------------------------------------------------------------
  -- Ventana de 14 días retroactivos, con hora de SERVIDOR (nunca el reloj del cliente).
  -- ------------------------------------------------------------------
  if p_played_at > now() + interval '5 minutes' then
    v_result := jsonb_build_object('ok', false, 'code', 'played_at_in_future');
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
    return v_result;
  end if;
  if p_played_at < now() - interval '14 days' then
    v_result := jsonb_build_object('ok', false, 'code', 'played_at_too_old');
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
    return v_result;
  end if;

  -- ------------------------------------------------------------------
  -- Canonicalización + huella (ver comentario de cabecera).
  -- ------------------------------------------------------------------
  v_pair1_key := least(p_pair1_player_id_1::text, p_pair1_player_id_2::text) || ':' || greatest(p_pair1_player_id_1::text, p_pair1_player_id_2::text);
  v_pair2_key := least(p_pair2_player_id_1::text, p_pair2_player_id_2::text) || ':' || greatest(p_pair2_player_id_1::text, p_pair2_player_id_2::text);
  v_pair1_is_first := v_pair1_key < v_pair2_key;

  if v_pair1_is_first then
    v_team_a_1 := p_pair1_player_id_1; v_team_a_2 := p_pair1_player_id_2;
    v_team_b_1 := p_pair2_player_id_1; v_team_b_2 := p_pair2_player_id_2;
  else
    v_team_a_1 := p_pair2_player_id_1; v_team_a_2 := p_pair2_player_id_2;
    v_team_b_1 := p_pair1_player_id_1; v_team_b_2 := p_pair1_player_id_2;
  end if;

  v_fingerprint := encode(
    extensions.digest(least(v_pair1_key, v_pair2_key) || '|' || greatest(v_pair1_key, v_pair2_key), 'sha256'),
    'hex'
  );

  v_caller_team := case when v_caller_player_id in (v_team_a_1, v_team_a_2) then 'A' else 'B' end;

  -- Advisory lock por huella — ver comentario de cabecera de este archivo (§3 de la revisión
  -- pre-Staging). Necesario porque el caso "crear nuevo" (0 candidatos) no tiene todavía
  -- ninguna fila de `matches` que bloquear con `for update`.
  perform pg_advisory_xact_lock(hashtextextended(v_fingerprint, 0));

  -- ------------------------------------------------------------------
  -- Búsqueda de candidatos (Decisiones #1/#2 de 04_Revision_ChatGPT.md). Un candidato
  -- pending_validation cuyo deadline ya venció NUNCA se ofrece — se trata como si no existiera.
  -- Si el cliente mandó `p_disambiguation_match_id`, se aplica exactamente la MISMA condición
  -- de ventana temporal que la búsqueda normal (06_Revision_Pre_Staging_ChatGPT.md §6): nunca
  -- se adjunta a un candidato fuera de ventana solo porque el cliente lo haya nombrado.
  -- ------------------------------------------------------------------
  if p_disambiguation_force_new then
    v_target_match_id := null;
  else
    select
      jsonb_agg(jsonb_build_object('matchId', m.match_id, 'playedAt', m.played_at, 'formatId', m.format_id, 'status', m.status)),
      count(*),
      (array_agg(m.match_id))[1]
      into v_candidates, v_candidate_count, v_target_match_id
    from public.matches m
    where m.participant_fingerprint = v_fingerprint
      and m.format_id = p_format_id
      and (m.status = 'validated' or (m.status = 'pending_validation' and m.validation_deadline_at > now()))
      and (p_disambiguation_match_id is null or m.match_id = p_disambiguation_match_id)
      and (
        case
          when p_played_at_time_known and m.played_at_time_known
            then abs(extract(epoch from (m.played_at - p_played_at))) <= 10800  -- ±3 horas, Decisión #1
          else date_trunc('day', m.played_at at time zone 'America/Argentina/Buenos_Aires')
             = date_trunc('day', p_played_at at time zone 'America/Argentina/Buenos_Aires')
        end
      );

    if p_disambiguation_match_id is not null then
      -- El filtro de arriba ya acota a ese match_id puntual (clave primaria): el conteo solo
      -- puede ser 0 o 1. Si es 0 (no calificó por huella/formato/estado/ventana), es un error de
      -- negocio EXPLÍCITO — nunca se cae silenciosamente al camino de crear un partido nuevo.
      if coalesce(v_candidate_count, 0) <> 1 then
        v_result := jsonb_build_object('ok', false, 'code', 'disambiguation_match_id_invalid');
        insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
          values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
        return v_result;
      end if;
    elsif coalesce(v_candidate_count, 0) > 1 then
      v_result := jsonb_build_object('ok', false, 'code', 'ambiguous_candidates', 'candidates', v_candidates);
      insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
        values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
      return v_result;
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- CREAR (0 candidatos, o desambiguación explícita "es otro partido")
  -- ------------------------------------------------------------------
  if v_target_match_id is null then
    -- C-03 (10_Revision_Final_Pre_Staging_ChatGPT.md): un partido con una incidencia de
    -- identidad open/terminal-unidentified tiene un fingerprint CENTINELA
    -- (bloque6_unidentified:<match_id>, ver _bloque6_refresh_participant_fingerprint) — nunca
    -- coincide por huella exacta con una carga normal de 4 IDs, así que la búsqueda de arriba
    -- siempre da 0 candidatos para él. Sin esta guardia, tanto una carga con los 3 participantes
    -- conocidos correctos como una con la identidad vieja todavía crearían un match_id duplicado
    -- en vez de señalar el partido que necesita resolución de identidad primero.
    if not p_disambiguation_force_new then
      select
        jsonb_agg(jsonb_build_object('matchId', m.match_id, 'playedAt', m.played_at, 'formatId', m.format_id, 'status', m.status)),
        count(*), (array_agg(m.match_id))[1]
        into v_identity_candidates, v_identity_candidate_count, v_identity_target_match_id
      from public.matches m
      where m.format_id = p_format_id
        and (m.status = 'validated' or (m.status = 'pending_validation' and m.validation_deadline_at > now()))
        and (
          case
            when p_played_at_time_known and m.played_at_time_known
              then abs(extract(epoch from (m.played_at - p_played_at))) <= 10800
            else date_trunc('day', m.played_at at time zone 'America/Argentina/Buenos_Aires')
               = date_trunc('day', p_played_at at time zone 'America/Argentina/Buenos_Aires')
          end
        )
        and exists (select 1 from public.match_identity_issues mii where mii.match_id = m.match_id and mii.status in ('open', 'unidentified'))
        and (select count(*) from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = any(v_ids)) = 3
        and (select count(*) from public.match_participants mp where mp.match_id = m.match_id and mp.player_id is null) = 1;

      if coalesce(v_identity_candidate_count, 0) > 1 then
        -- C-03 exige ambigüedad explícita cuando más de un partido con slot no identificado
        -- podría corresponder: nunca elegir/fusionar a ciegas.
        v_result := jsonb_build_object('ok', false, 'code', 'ambiguous_candidates', 'candidates', v_identity_candidates);
        insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
          values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
        return v_result;
      elsif coalesce(v_identity_candidate_count, 0) = 1 then
        v_result := jsonb_build_object(
          'ok', false, 'code', 'identity_resolution_required',
          'matchId', v_identity_target_match_id, 'candidates', v_identity_candidates
        );
        insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
          values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', v_identity_target_match_id, v_result);
        return v_result;
      end if;
    end if;

    -- Límite de pendientes accionables (Experiencia_Inicial.md §10): bloquea EXCLUSIVAMENTE
    -- crear un partido nuevo — nunca un attach/conformidad/revisión/desambiguación sobre un
    -- encuentro ya existente (06_Revision_Pre_Staging_ChatGPT.md §2). Por eso el chequeo vive
    -- ACÁ, recién cuando ya se sabe que esta carga efectivamente va a crear, y no antes de la
    -- búsqueda de candidatos.
    v_pending_count := public.compute_pending_action_count(v_caller_player_id);
    if v_pending_count >= 5 then
      v_result := jsonb_build_object('ok', false, 'code', 'pending_action_limit_reached', 'count', v_pending_count);
      insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
        values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', null, v_result);
      return v_result;
    end if;

    insert into public.matches (
      created_by_player_id, participant_fingerprint, format_id, scoring_system,
      played_at, played_at_time_known, reported_time_zone,
      location_name, location_lat, location_lng,
      status, action_side, validation_deadline_at
    ) values (
      v_caller_player_id, v_fingerprint, p_format_id, p_scoring_system,
      p_played_at, coalesce(p_played_at_time_known, true), p_reported_time_zone,
      p_location_name, p_location_lat, p_location_lng,
      'pending_validation', case v_caller_team when 'A' then 'B' else 'A' end,
      now() + interval '30 days'
    ) returning match_id into v_target_match_id;

    insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot)
    select v_target_match_id, 'A', 1, v_team_a_1, coalesce(pl.display_name, 'Jugador') from public.players pl where pl.player_id = v_team_a_1
    union all
    select v_target_match_id, 'A', 2, v_team_a_2, coalesce(pl.display_name, 'Jugador') from public.players pl where pl.player_id = v_team_a_2
    union all
    select v_target_match_id, 'B', 1, v_team_b_1, coalesce(pl.display_name, 'Jugador') from public.players pl where pl.player_id = v_team_b_1
    union all
    select v_target_match_id, 'B', 2, v_team_b_2, coalesce(pl.display_name, 'Jugador') from public.players pl where pl.player_id = v_team_b_2;

    insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at, input_submission_id)
    values (v_target_match_id, 1, v_caller_player_id, v_caller_team, 'created', p_played_at, p_idempotency_key)
    returning revision_id into v_revision_id;

    update public.matches set current_revision_id = v_revision_id, updated_at = now() where match_id = v_target_match_id;

    insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b, tiebreak_a, tiebreak_b)
    select
      v_target_match_id, 1, ord::smallint,
      case when v_pair1_is_first then (s->>'gamesA')::smallint else (s->>'gamesB')::smallint end,
      case when v_pair1_is_first then (s->>'gamesB')::smallint else (s->>'gamesA')::smallint end,
      case when v_pair1_is_first then (s->>'tiebreakA')::smallint else (s->>'tiebreakB')::smallint end,
      case when v_pair1_is_first then (s->>'tiebreakB')::smallint else (s->>'tiebreakA')::smallint end
    from jsonb_array_elements(p_sets) with ordinality as t(s, ord);

    insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
    values (v_target_match_id, 'created', v_caller_player_id, v_caller_team, v_revision_id, '{}'::jsonb);

    insert into public.pilot_events (event_name, player_id, properties)
    values ('match_created', v_caller_player_id, jsonb_build_object('matchId', v_target_match_id));

    v_result := jsonb_build_object(
      'ok', true, 'code', 'created', 'matchId', v_target_match_id,
      'status', 'pending_validation', 'actionSide', case v_caller_team when 'A' then 'B' else 'A' end
    );
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, 'created', v_target_match_id, v_result);
    return v_result;
  end if;

  -- ------------------------------------------------------------------
  -- ADJUNTAR a v_target_match_id (1 candidato, o desambiguación explícita eligiendo uno) — NUNCA
  -- bloqueado por el límite de pendientes: responder o coincidir sobre un encuentro existente no
  -- es "iniciar una carga nueva" (06_Revision_Pre_Staging_ChatGPT.md §2).
  -- ------------------------------------------------------------------
  select * into v_match from public.matches where match_id = v_target_match_id for update;

  -- C-04 (10_Revision_Final_Pre_Staging_ChatGPT.md): para un ATTACH a un match YA EXISTENTE, la
  -- orientación A/B se toma de match_participants YA ALMACENADA — nunca se recalcula por orden
  -- léxico de los IDs entrantes (v_pair1_is_first/v_caller_team de más arriba, calculados para el
  -- camino "crear nuevo"). Un reemplazo de identidad puede cambiar cuál pair key sería
  -- lexicográficamente menor si se recalculara desde cero, invirtiendo qué pareja es "A" frente a
  -- la orientación ya fija del partido. Un fingerprint coincidente garantiza la MISMA pareja
  -- (X+Y vs Z+W) — nunca una partición distinta de los mismos 4 IDs — así que pair1 SIEMPRE
  -- coincide íntegramente con team A o con team B ya almacenada.
  select team into v_caller_team from public.match_participants
    where match_id = v_match.match_id and player_id = v_caller_player_id;
  select (count(*) filter (where mp.team = 'A')) = 2 into v_pair1_is_first
    from public.match_participants mp
    where mp.match_id = v_match.match_id and mp.player_id in (p_pair1_player_id_1, p_pair1_player_id_2);

  select revision_number into v_current_revision_number from public.match_revisions where revision_id = v_match.current_revision_id;
  select proposed_by_team into v_current_proposer_team from public.match_revisions where revision_id = v_match.current_revision_id;
  select count(*) into v_current_set_count from public.match_sets where match_id = v_match.match_id and revision_number = v_current_revision_number;

  if v_current_set_count <> v_new_set_count then
    v_scores_match := false;
  else
    select not exists (
      select 1
      from jsonb_array_elements(p_sets) with ordinality as new_s(s, ord)
      join public.match_sets cur
        on cur.match_id = v_match.match_id and cur.revision_number = v_current_revision_number and cur.set_number = ord::smallint
      where (case when v_pair1_is_first then (new_s.s->>'gamesA')::int else (new_s.s->>'gamesB')::int end) is distinct from cur.games_a
         or (case when v_pair1_is_first then (new_s.s->>'gamesB')::int else (new_s.s->>'gamesA')::int end) is distinct from cur.games_b
    ) into v_scores_match;
  end if;

  if v_match.status = 'validated' then
    if v_scores_match then
      v_result := jsonb_build_object('ok', true, 'code', 'already_validated', 'matchId', v_match.match_id, 'status', 'validated');
    else
      -- Decisión #2: no crea un duplicado, tampoco reabre la corrección — eso es Bloque 6.
      v_result := jsonb_build_object('ok', false, 'code', 'validated_match_needs_bloque6_correction', 'matchId', v_match.match_id);
    end if;
    insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
      values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', v_match.match_id, v_result);
    return v_result;
  end if;

  -- status = 'pending_validation' de acá en más. Bloque 5 NUNCA lo cambia a 'validated' —
  -- 06_Revision_Pre_Staging_ChatGPT.md §1.
  if v_scores_match then
    if v_match.action_side is null then
      -- La conformidad rival ya fue registrada por algún integrante de esa pareja.
      -- Otra carga coincidente del mismo encuentro (por ejemplo, el compañero del que confirmó)
      -- converge al mismo match_id pero NO duplica la acción 'confirmed'. match_submissions ya
      -- conserva la declaración/idempotencia individual; la conformidad de pareja sigue siendo
      -- un único hecho para Bloque 6.
      v_result := jsonb_build_object(
        'ok', true, 'code', 'matched_already_confirmed', 'matchId', v_match.match_id,
        'status', 'pending_validation', 'readyForValidation', true
      );
    elsif v_caller_team <> v_current_proposer_team then
      -- CONFORMIDAD RIVAL: la declaración coincide y viene del lado que todavía no había
      -- hablado. Se registra la conformidad (acción append-only 'confirmed') y se libera
      -- action_side (ya no queda ninguna acción HUMANA pendiente) — pero el partido sigue
      -- pending_validation, sin validated_at, sin ningún efecto de Nivel. La oficialización
      -- real (status=validated + transacción atómica de Nivel) es exclusiva de Bloque 6.
      update public.matches set action_side = null, updated_at = now()
      where match_id = v_match.match_id;
      insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
      values (v_match.match_id, 'confirmed', v_caller_player_id, v_caller_team, v_match.current_revision_id, '{}'::jsonb);
      v_result := jsonb_build_object(
        'ok', true, 'code', 'matched_confirmed', 'matchId', v_match.match_id,
        'status', 'pending_validation', 'readyForValidation', true
      );
    else
      -- REDECLARACIÓN DEL MISMO LADO (p. ej. la pareja del cargador original también carga): sin
      -- cambio de estado, nunca reemplaza la conformidad rival necesaria.
      insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
      values (v_match.match_id, 'declared_again_same_side', v_caller_player_id, v_caller_team, v_match.current_revision_id, '{}'::jsonb);
      v_result := jsonb_build_object('ok', true, 'code', 'matched_same_side', 'matchId', v_match.match_id, 'status', v_match.status);
    end if;
  else
    -- REVISIÓN NUEVA: el score declarado difiere del vigente — cubre tanto "el rival corrige"
    -- como "el propio lado se corrige antes de que el rival responda" (Experiencia_Inicial.md
    -- §12.1) e incluso "alguien discrepa después de que ya se había registrado conformidad"
    -- (action_side era null), con la misma regla simétrica: la acción siempre pasa al lado
    -- opuesto al que acaba de declarar, sin importar cuál era el lado con la acción antes.
    select coalesce(max(revision_number), 0) + 1 into v_revision_number from public.match_revisions where match_id = v_match.match_id;

    insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at, input_submission_id)
    values (v_match.match_id, v_revision_number, v_caller_player_id, v_caller_team, 'proposed_correction', p_played_at, p_idempotency_key)
    returning revision_id into v_revision_id;

    insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b, tiebreak_a, tiebreak_b)
    select
      v_match.match_id, v_revision_number, ord::smallint,
      case when v_pair1_is_first then (s->>'gamesA')::smallint else (s->>'gamesB')::smallint end,
      case when v_pair1_is_first then (s->>'gamesB')::smallint else (s->>'gamesA')::smallint end,
      case when v_pair1_is_first then (s->>'tiebreakA')::smallint else (s->>'tiebreakB')::smallint end,
      case when v_pair1_is_first then (s->>'tiebreakB')::smallint else (s->>'tiebreakA')::smallint end
    from jsonb_array_elements(p_sets) with ordinality as t(s, ord);

    v_new_action_side := case v_caller_team when 'A' then 'B' else 'A' end;
    update public.matches
      set current_revision_id = v_revision_id, action_side = v_new_action_side, played_at = p_played_at, updated_at = now()
      where match_id = v_match.match_id;

    insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
    values (v_match.match_id, 'revision_proposed', v_caller_player_id, v_caller_team, v_revision_id, '{}'::jsonb);

    v_result := jsonb_build_object('ok', true, 'code', 'matched_revised', 'matchId', v_match.match_id, 'status', 'pending_validation', 'actionSide', v_new_action_side);
  end if;

  insert into public.match_submissions (idempotency_key, submitted_by_player_id, payload_hash, result_code, result_match_id, result_payload)
    values (p_idempotency_key, v_caller_player_id, v_payload_hash, v_result->>'code', v_match.match_id, v_result);
  return v_result;
end;
$$;

-- 6) resolve_identity_issue — misma definición vigente + lock de provisional (H3)

create or replace function public.resolve_identity_issue(
  p_auth_user_id uuid,
  p_issue_id uuid,
  p_replacement_player_id uuid default null,
  -- true = materializar el vencimiento de 7 días de forma idempotente (04_Revision_ChatGPT.md
  -- §6): el slot queda definitivamente "no identificado". Solo válido si ya venció
  -- resolution_deadline_at — no es un atajo para saltarse la ventana de resolución normal.
  p_force_unidentified boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_caller_team text;
  v_issue public.match_identity_issues;
  v_match public.matches;
  v_new_revision_number integer;
  v_new_revision_id uuid;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = p_auth_user_id;
  if v_caller_player_id is null then
    raise exception 'no_player_for_user' using errcode = 'P0001';
  end if;

  -- H3: la provisional de reemplazo se serializa antes de bloquear incidencia/partido.
  perform public._lock_provisional_for_assignment(p_replacement_player_id);

  select * into v_issue from public.match_identity_issues where issue_id = p_issue_id for update;
  if v_issue is null then
    return jsonb_build_object('ok', false, 'code', 'issue_not_found');
  end if;
  if v_issue.status <> 'open' then
    -- Idempotente: si ya está resolved/unidentified, se devuelve tal cual en vez de fallar.
    return jsonb_build_object('ok', true, 'code', 'already_resolved', 'status', v_issue.status, 'idempotentReturn', true);
  end if;

  select * into v_match from public.matches where match_id = v_issue.match_id for update;

  -- B6-B-05: conocer un issue_id no alcanza para resolver una incidencia — el caller debe seguir
  -- siendo participante ACTUAL del partido. La vía administrativa (admin_force_resolve_identity_
  -- issue, service_role) sigue completamente separada y no pasa por acá.
  select team into v_caller_team from public.match_participants
    where match_id = v_issue.match_id and player_id = v_caller_player_id;
  if v_caller_team is null then
    return jsonb_build_object('ok', false, 'code', 'not_a_participant');
  end if;

  -- B6-B-07: la ventana fija de 30 días (Experiencia_Inicial.md §11.2) también gobierna acá
  -- mientras el partido siga pending_validation — un partido con deadline ya vencido deja de ser
  -- accionable, nunca se reactiva por resolver una identidad.
  if v_match.status = 'pending_validation'
     and (v_match.validation_deadline_at is null or now() > v_match.validation_deadline_at) then
    return jsonb_build_object('ok', false, 'code', 'match_expired');
  end if;

  if coalesce(p_force_unidentified, false) then
    if now() < v_issue.resolution_deadline_at then
      return jsonb_build_object('ok', false, 'code', 'resolution_window_not_expired');
    end if;

    if v_match.status = 'validated' then
      -- B6-A-09: partido validated -> NO se mutan match_identity_issues/notifications acá. Solo
      -- se AUTORIZA (ventana efectivamente vencida, incidencia todavía open) — materializar el
      -- estado terminal y reaplicar Nivel para el partido completo ocurre ATÓMICAMENTE dentro
      -- de officialize_match_validation(trigger=identity_unidentified), que la Edge Function
      -- llama inmediatamente después. Sin esto, una identidad podía quedar "resolved"/
      -- "unidentified" con el efecto de Nivel todavía suspendido si el recálculo fallaba en una
      -- transacción separada.
      return jsonb_build_object(
        'ok', true, 'code', 'identity_unidentified_authorized', 'issueId', p_issue_id, 'matchId', v_issue.match_id,
        'team', v_issue.team, 'positionInTeam', v_issue.position_in_team,
        'needsRecompute', true
      );
    end if;

    -- Partido todavía pending_validation: no hay ningún efecto de Nivel que atomizar, se
    -- materializa directo.
    update public.match_identity_issues set status = 'unidentified', resolved_at = now(), updated_at = now()
      where issue_id = p_issue_id;
    -- match_participants.player_id sigue NULL para siempre — nunca se fabrica una identidad
    -- (04_Revision_ChatGPT.md §6). El slot queda mostrado como "Jugador no identificado" a
    -- través de match_participants.display_name_snapshot ya fijado en 'Por identificar' al
    -- abrir; el estado terminal se distingue vía match_identity_issues.status.
    insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
    values (v_issue.match_id, 'participant_unidentified', v_caller_player_id, null, jsonb_build_object('issueId', p_issue_id));
    insert into public.notifications (player_id, type, match_id, payload)
    select mp.player_id, 'identity_unidentified', v_issue.match_id, jsonb_build_object('issueId', p_issue_id)
    from public.match_participants mp where mp.match_id = v_issue.match_id and mp.player_id is not null;

    return jsonb_build_object('ok', true, 'code', 'identity_unidentified', 'issueId', p_issue_id, 'matchId', v_issue.match_id, 'needsRecompute', false);
  end if;

  if p_replacement_player_id is null then
    return jsonb_build_object('ok', false, 'code', 'replacement_player_required');
  end if;
  if now() > v_issue.resolution_deadline_at then
    return jsonb_build_object('ok', false, 'code', 'resolution_window_expired');
  end if;
  if exists (
    select 1 from public.match_participants where match_id = v_issue.match_id and player_id = p_replacement_player_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_participant');
  end if;

  -- B6-B-05: el reemplazo debe existir y estar activo; si es provisional, debe estar
  -- RELACIONADO con el caller — creado por él, o ya compartió un partido con él (EXACTAMENTE el
  -- mismo criterio que create_or_attach_match, Bloque 5 — nunca se reimplementa distinto).
  if not exists (select 1 from public.players where player_id = p_replacement_player_id and is_active) then
    return jsonb_build_object('ok', false, 'code', 'participant_not_found');
  end if;
  if exists (select 1 from public.players where player_id = p_replacement_player_id and type = 'provisional') then
    if not (
      exists (select 1 from public.players where player_id = p_replacement_player_id and created_by_player_id = v_caller_player_id)
      or exists (
        select 1 from public.match_participants mp_prov
        join public.match_participants mp_self on mp_self.match_id = mp_prov.match_id and mp_self.player_id = v_caller_player_id
        where mp_prov.player_id = p_replacement_player_id
      )
    ) then
      return jsonb_build_object('ok', false, 'code', 'provisional_not_selectable');
    end if;
  end if;

  if v_match.status = 'validated' then
    -- B6-A-09: idéntico criterio que arriba — solo AUTORIZA, nunca reasigna match_participants
    -- ni marca la incidencia resolved acá. officialize_match_validation(trigger=
    -- identity_resolved) hace la reasignación + el cierre de la incidencia + la reaplicación de
    -- Nivel del partido completo en UNA sola transacción.
    return jsonb_build_object(
      'ok', true, 'code', 'identity_resolved_authorized', 'issueId', p_issue_id, 'matchId', v_issue.match_id,
      'team', v_issue.team, 'positionInTeam', v_issue.position_in_team,
      'replacementPlayerId', p_replacement_player_id, 'needsRecompute', true
    );
  end if;

  -- Partido todavía pending_validation (B6-B-03, Experiencia_Inicial.md §§7/11/12/13): la
  -- corrección de identidad es una CONVERSACIÓN ENTRE PAREJAS, no una mutación directa — mismo
  -- mecanismo que propose_post_validation_correction/create_or_attach_match cuando una segunda
  -- carga trae un dato distinto: nueva revisión append-only, copia de los sets vigentes, deja
  -- conforme a la pareja del actor y pasa la acción a la pareja contraria. NUNCA reinicia
  -- validation_deadline_at (B6-B-07) ni el fingerprint queda desalineado (B6-B-04).
  select coalesce(max(revision_number), 0) + 1 into v_new_revision_number
    from public.match_revisions where match_id = v_issue.match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
  values (v_issue.match_id, v_new_revision_number, v_caller_player_id, v_caller_team, 'proposed_correction', v_match.played_at)
  returning revision_id into v_new_revision_id;

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b, tiebreak_a, tiebreak_b)
  select v_issue.match_id, v_new_revision_number, ms.set_number, ms.games_a, ms.games_b, ms.tiebreak_a, ms.tiebreak_b
  from public.match_sets ms
  where ms.match_id = v_issue.match_id
    and ms.revision_number = (select revision_number from public.match_revisions where revision_id = v_match.current_revision_id);

  update public.match_participants set
    player_id = p_replacement_player_id,
    display_name_snapshot = coalesce((select display_name from public.players where player_id = p_replacement_player_id), 'Jugador')
  where match_id = v_issue.match_id and team = v_issue.team and position_in_team = v_issue.position_in_team;

  perform public._bloque6_refresh_participant_fingerprint(v_issue.match_id);

  update public.matches set
    current_revision_id = v_new_revision_id,
    action_side = case v_caller_team when 'A' then 'B' else 'A' end,
    updated_at = now()
  where match_id = v_issue.match_id;

  update public.match_identity_issues set status = 'resolved', resolved_player_id = p_replacement_player_id, resolved_at = now(), updated_at = now()
    where issue_id = p_issue_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
  values (v_issue.match_id, 'participant_replaced', v_caller_player_id, v_caller_team, v_new_revision_id, jsonb_build_object('issueId', p_issue_id, 'replacementPlayerId', p_replacement_player_id));

  insert into public.notifications (player_id, type, match_id, payload)
  select mp.player_id, 'identity_resolved', v_issue.match_id, jsonb_build_object('issueId', p_issue_id)
  from public.match_participants mp
  where mp.match_id = v_issue.match_id and mp.player_id is not null and mp.team <> v_caller_team;

  return jsonb_build_object(
    'ok', true, 'code', 'identity_resolved', 'issueId', p_issue_id, 'matchId', v_issue.match_id,
    'revisionId', v_new_revision_id, 'needsRecompute', false
  );
end;
$$;

-- 7) admin_force_resolve_identity_issue — misma definición vigente + lock de provisional (H3)

create or replace function public.admin_force_resolve_identity_issue(
  p_issue_id uuid,
  p_replacement_player_id uuid,
  p_actor_label text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.match_identity_issues;
  v_match public.matches;
begin
  if coalesce(trim(p_actor_label), '') = '' or coalesce(trim(p_reason), '') = '' then
    raise exception 'actor_label_and_reason_required' using errcode = 'P0001';
  end if;

  perform public._lock_provisional_for_assignment(p_replacement_player_id);

  select * into v_issue from public.match_identity_issues where issue_id = p_issue_id for update;
  if v_issue is null then
    return jsonb_build_object('ok', false, 'code', 'issue_not_found');
  end if;
  if v_issue.status <> 'open' then
    return jsonb_build_object('ok', true, 'code', 'already_resolved', 'status', v_issue.status, 'idempotentReturn', true);
  end if;

  select * into v_match from public.matches where match_id = v_issue.match_id for update;

  if exists (select 1 from public.match_participants where match_id = v_issue.match_id and player_id = p_replacement_player_id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_participant');
  end if;

  if v_match.status = 'validated' then
    -- C-05 (10_Revision_Final_Pre_Staging_ChatGPT.md): STAGED, igual que resolve_identity_issue
    -- normal (B6-A-09) — solo AUTORIZA (actor+motivo ya validados, ignora deliberadamente
    -- resolution_deadline_at: es el "corregir excepcionalmente" del handoff §6.11), nunca muta
    -- match_participants ni cierra la incidencia todavía. La Edge Function
    -- admin-resolve-identity-issue (alcanzable SOLO con la service role key exacta, nunca un JWT
    -- de usuario) llama inmediatamente después a officialize_match_validation(trigger=
    -- identity_resolved), que hace la reasignación + el refresco de fingerprint + la
    -- reaplicación de Nivel + el cierre de la incidencia en UNA sola transacción atómica. Antes
    -- de este fix, un fallo/interrupción entre la mutación directa y el recálculo separado podía
    -- dejar la identidad ya reasignada con Nivel todavía suspendido, y sin camino idempotente
    -- para completarlo (officialize_match_validation exige la incidencia todavía open).
    return jsonb_build_object(
      'ok', true, 'code', 'identity_resolved_authorized', 'issueId', p_issue_id, 'matchId', v_issue.match_id,
      'team', v_issue.team, 'positionInTeam', v_issue.position_in_team,
      'replacementPlayerId', p_replacement_player_id, 'needsRecompute', true
    );
  end if;

  -- Partido todavía pending_validation: sin efecto de Nivel que atomizar, se reasigna directo
  -- (ignora deliberadamente resolution_deadline_at, es el "corregir excepcionalmente" del
  -- handoff §6.11).
  update public.match_participants set
    player_id = p_replacement_player_id,
    display_name_snapshot = coalesce((select display_name from public.players where player_id = p_replacement_player_id), 'Jugador')
  where match_id = v_issue.match_id and team = v_issue.team and position_in_team = v_issue.position_in_team;

  -- B6-B-04: mantiene participant_fingerprint sincronizado también en la vía administrativa.
  perform public._bloque6_refresh_participant_fingerprint(v_issue.match_id);

  update public.match_identity_issues set status = 'resolved', resolved_player_id = p_replacement_player_id, resolved_at = now(), updated_at = now()
    where issue_id = p_issue_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (
    v_issue.match_id, 'participant_replaced', v_issue.opened_by_player_id, null,
    jsonb_build_object('issueId', p_issue_id, 'replacementPlayerId', p_replacement_player_id, 'adminActorLabel', p_actor_label, 'reason', p_reason)
  );

  return jsonb_build_object(
    'ok', true, 'code', 'identity_resolved', 'issueId', p_issue_id, 'matchId', v_issue.match_id, 'needsRecompute', false
  );
end;
$$;

-- 8) claim_provisional_player — locks de partidos ANTES del preflight, relectura bajo lock, unicidad defensiva (H3)

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

  -- (1) Partidos de la provisional. Solo un writer que tenga el lock de esta provisional puede sumarle partidos (H3), y este
  --     claim ya lo tiene: la lista no puede crecer mientras dure la transacción.
  select array_agg(distinct mp.match_id order by mp.match_id) into v_match_ids
    from public.match_participants mp where mp.player_id = v_prov.player_id;
  v_match_ids := coalesce(v_match_ids, '{}');

  -- (2) Bloquear TODAS las filas de esos partidos, en orden determinístico, ANTES del preflight definitivo (H3): cualquier otro flujo
  --     de identidad sobre esos partidos (resolve/officialize/admin) espera acá o ya hizo commit.
  if array_length(v_match_ids, 1) is not null then
    perform 1 from public.matches where match_id = any (v_match_ids) order by match_id for update;
  end if;

  -- (3) Relectura bajo lock: ninguna decisión crítica depende de lo leído antes. Si apareciera un partido nuevo (no debería: ver (1))
  --     se lo bloquea también y entra al preflight.
  select array_agg(distinct x order by x) into v_match_ids from (
    select unnest(v_match_ids) as x
    union
    select mp.match_id from public.match_participants mp where mp.player_id = v_prov.player_id
  ) u;
  v_match_ids := coalesce(v_match_ids, '{}');
  if array_length(v_match_ids, 1) is not null then
    perform 1 from public.matches where match_id = any (v_match_ids) order by match_id for update;
  end if;

  -- (4) PRE-FLIGHT completo (cero mutación si hay conflicto).
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

  select coalesce(jsonb_agg(jsonb_build_object(
           'matchId', m.match_id, 'playedAt', m.played_at,
           'team', mp.team, 'position', mp.position_in_team) order by m.played_at, m.match_id), '[]'::jsonb)
    into v_matches_json
    from public.match_participants mp join public.matches m on m.match_id = mp.match_id
    where mp.player_id = v_prov.player_id;

  -- (5) PRIMERA mutación, dentro de un sub-bloque: si la unicidad (match_id, player_id) saltara por una carrera que el protocolo de
  --     locks no cubra, se devuelve identity_conflict estructurado con CERO mutación (nada se escribió antes de este punto).
  begin
    update public.match_participants set player_id = v_target.player_id where player_id = v_prov.player_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'identity_conflict', 'conflicts', '[]'::jsonb);
  end;

  insert into public.player_identity_recoveries (
    source_provisional_player_id, target_player_id, claim_id, actor_player_id, status, level_status,
    context, recovered_match_ids, result, completed_at
  ) values (
    v_prov.player_id, v_target.player_id, v_claim.claim_id, v_target.player_id, 'completed',
    case when array_length(v_match_ids, 1) is null then 'not_needed' else 'pending' end,
    jsonb_build_object('via', 'claim_link', 'invitedBy', v_claim.created_by_player_id, 'matches', v_matches_json),
    v_match_ids, jsonb_build_object('matchCount', coalesce(array_length(v_match_ids, 1), 0)), now()
  ) returning recovery_id into v_recovery_id;

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

-- ------------------------------------------------------------------
-- 9) H1 — origen "duplicado" de una corrección pendiente (sin columna nueva en matches: se deriva del candidato)
-- ------------------------------------------------------------------

create or replace function public._pending_correction_is_duplicate_origin(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.matches m
      join public.match_duplicate_candidates c
        on c.canonical_match_id = m.match_id and c.status = 'awaiting_confirmation'
       and c.pending_revision_id = m.pending_correction_revision_id
     where m.match_id = p_match_id and m.pending_correction_revision_id is not null
  );
$$;

comment on function public._pending_correction_is_duplicate_origin is
  'Una corrección pendiente es de origen duplicado/recuperación si hay un candidato awaiting_confirmation que la propuso. Esa corrección NO
   vence a los 3 días (el duplicado puede ser histórico); las correcciones ordinarias conservan exactamente la ventana de 3 días.';
revoke all on function public._pending_correction_is_duplicate_origin(uuid) from public, anon, authenticated;

-- 10) respond_post_validation_correction — ventana de 3 días intacta salvo origen duplicado + finalización en el rechazo (H1)

create or replace function public.respond_post_validation_correction(
  p_auth_user_id uuid,
  p_match_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_caller_team text;
  v_match public.matches;
  v_pending_revision public.match_revisions;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = p_auth_user_id;
  if v_caller_player_id is null then
    raise exception 'no_player_for_user' using errcode = 'P0001';
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    return jsonb_build_object('ok', false, 'code', 'match_not_found');
  end if;

  select team into v_caller_team from public.match_participants where match_id = p_match_id and player_id = v_caller_player_id;
  if v_caller_team is null then
    return jsonb_build_object('ok', false, 'code', 'not_a_participant');
  end if;

  if v_match.pending_correction_revision_id is null then
    -- Ajuste secundario recomendado (08_Revision_Central_Adicional.md): un reintento del cliente
    -- después de que la corrección ya fue aceptada y aplicada en un intento anterior (p. ej. un
    -- timeout de red tras el éxito real) no debe reportarse como error — se detecta por la
    -- existencia de un match_level_results applied con trigger=correction_accepted para este
    -- partido, sin complicar el contrato normal (sigue siendo {ok:false} cuando genuinamente
    -- nunca hubo una corrección pendiente).
    if exists (
      select 1 from public.match_level_results
      where match_id = p_match_id and effect_status = 'applied' and trigger = 'correction_accepted'
    ) then
      return jsonb_build_object('ok', true, 'code', 'correction_already_accepted', 'matchId', p_match_id, 'idempotentReturn', true);
    end if;
    return jsonb_build_object('ok', false, 'code', 'no_pending_correction');
  end if;
  if v_match.validated_at is null
     or (now() > v_match.validated_at + interval '3 days' and not public._pending_correction_is_duplicate_origin(p_match_id)) then
    -- Ventana vencida: la propuesta nunca llegó a resolverse por autoservicio. Se limpia acá
    -- (primera acción posterior al vencimiento la materializa) en vez de dejarla colgada.
    update public.matches set pending_correction_revision_id = null, updated_at = now() where match_id = p_match_id;
    insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
    values (p_match_id, 'correction_timeout_resolved', v_caller_player_id, v_caller_team, v_match.pending_correction_revision_id, '{}'::jsonb);
    return jsonb_build_object('ok', false, 'code', 'correction_window_expired');
  end if;

  select * into v_pending_revision from public.match_revisions where revision_id = v_match.pending_correction_revision_id;
  if v_pending_revision.proposed_by_team = v_caller_team then
    return jsonb_build_object('ok', false, 'code', 'cannot_respond_to_own_proposal');
  end if;

  if not coalesce(p_accept, false) then
    update public.matches set pending_correction_revision_id = null, updated_at = now() where match_id = p_match_id;
    insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
    values (p_match_id, 'correction_timeout_resolved', v_caller_player_id, v_caller_team, v_pending_revision.revision_id, jsonb_build_object('rejected', true));
    -- H1: si la propuesta era de una reconciliación de duplicado, el RECHAZO conserva el score vigente y finaliza (anula el secundario,
    -- revierte su efecto) en esta misma transacción.
    perform public._finalize_duplicate_reconciliation(p_match_id, v_pending_revision.revision_id, 'rejected');
    return jsonb_build_object('ok', true, 'code', 'correction_rejected', 'matchId', p_match_id);
  end if;

  -- B6-A-08: NO se mueve current_revision_id/pending_correction_revision_id acá. Esta función
  -- solo AUTORIZA la aceptación (caller válido, ventana vigente, no es su propia propuesta) y
  -- devuelve la revisión objetivo — mover el puntero y aplicar/reaplicar Nivel ocurre
  -- ATÓMICAMENTE dentro de officialize_match_validation(trigger=correction_accepted,
  -- p_revision_id=pendingRevisionId), que la Edge Function llama inmediatamente después. Si
  -- mover el puntero ocurriera acá, en una transacción SEPARADA de la de Nivel, un fallo entre
  -- ambas dejaría el resultado oficial ya cambiado con Nivel/snapshots todavía correspondiendo a
  -- la revisión anterior — exactamente lo que B6-A-08 corrige.
  return jsonb_build_object('ok', true, 'code', 'correction_authorized', 'matchId', p_match_id, 'pendingRevisionId', v_pending_revision.revision_id);
end;
$$;

-- 11) get_notifications — la tarea correction_proposed de origen duplicado sigue visible aunque el partido sea histórico

create or replace function public.get_notifications(p_limit integer default 50, p_only_unread boolean default false)
returns table (
  notification_id uuid,
  type             text,
  match_id         uuid,
  payload          jsonb,
  created_at       timestamptz,
  read_at          timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- C-08/C-10 (10_Revision_Final_Pre_Staging_ChatGPT.md): las tareas accionables se DERIVAN en
  -- lectura desde el estado real del partido/revisión/incidencia — nunca se persisten como
  -- mensajes históricos (report_identity_issue/propose_post_validation_correction ya NO insertan
  -- 'identity_questioned'/'correction_proposed'). Así desaparecen automáticamente para AMBOS
  -- integrantes de la pareja apenas se resuelve el estado, sin poder marcarse "leídas"
  -- prematuramente (una tarea sintética nunca tiene una fila real que mark_notification_read
  -- pueda actualizar). La ventana de 3 días de una corrección pendiente (C-10) se evalúa acá
  -- mismo contra validated_at — sin cron, una corrección vencida simplemente deja de aparecer.
  -- notification_id se deriva determinísticamente (md5 formateado como uuid) del tipo+clave real
  -- para que sea estable entre lecturas sucesivas.
  return query
    select all_rows.* from (
      -- 1) pending_review — partido pending_validation, deadline vigente, la acción es del lado
      --    del caller (aparece para AMBOS integrantes de esa pareja, cada uno al consultar).
      --    Corrección post-QA — suma matchContext (§2): mismo criterio que el resto de las ramas.
      select
        (regexp_replace(md5('pending_review:' || m.match_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid as notification_id,
        'pending_review'::text as type,
        m.match_id as match_id,
        jsonb_build_object('matchContext', public._bloque6_notification_match_context(m.match_id, v_caller_player_id)) as payload,
        m.created_at as created_at,
        null::timestamptz as read_at
      from public.matches m
      join public.match_participants mp on mp.match_id = m.match_id and mp.player_id = v_caller_player_id
      where m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side = mp.team

      union all

      -- 2) correction_proposed — corrección post-validación en espera, ventana de 3 días vigente
      --    (C-10: vencida deja de mostrarse, sin necesitar materializar nada), lado del caller es
      --    quien debe responder.
      select
        (regexp_replace(md5('correction_proposed:' || m.pending_correction_revision_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid,
        'correction_proposed'::text,
        m.match_id,
        jsonb_build_object(
          'pendingCorrectionRevisionId', m.pending_correction_revision_id,
          'proposedByPlayerId', mr.proposed_by_player_id,
          'matchContext', public._bloque6_notification_match_context(m.match_id, v_caller_player_id)
        ),
        mr.created_at,
        null::timestamptz
      from public.matches m
      join public.match_revisions mr on mr.revision_id = m.pending_correction_revision_id
      join public.match_participants mp on mp.match_id = m.match_id and mp.player_id = v_caller_player_id
      where m.pending_correction_revision_id is not null
        and mp.team <> mr.proposed_by_team
        and m.validated_at is not null
        and (now() <= m.validated_at + interval '3 days' or public._pending_correction_is_duplicate_origin(m.match_id))

      union all

      -- 3) identity_questioned — incidencia open sobre un partido donde el caller sigue siendo
      --    participante habilitado.
      select
        (regexp_replace(md5('identity_questioned:' || mii.issue_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid,
        'identity_questioned'::text,
        mii.match_id,
        jsonb_build_object(
          'issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team,
          'openedByPlayerId', mii.opened_by_player_id,
          'matchContext', public._bloque6_notification_match_context(mii.match_id, v_caller_player_id)
        ),
        mii.opened_at,
        null::timestamptz
      from public.match_identity_issues mii
      join public.match_participants mp on mp.match_id = mii.match_id and mp.player_id = v_caller_player_id
      where mii.status = 'open'

      union all

      -- 4) notificaciones PERSISTIDAS informativas — eventos ya consumados (match_validated,
      --    correction_accepted, identity_resolved/unidentified, admin_action, etc.).
      --    Corrección post-QA — el LATERAL calcula UNA vez por fila tanto el actor histórico
      --    como matchContext (nunca dos llamadas separadas a la misma función). El payload YA
      --    enriquecido de una fila FUTURA (trigger bloque6_enrich_notification_actor, Ronda 2)
      --    tiene prioridad absoluta: solo se agrega actorPlayerId reconstruido cuando la clave
      --    todavía no está en `n.payload`, nunca se pisa un valor existente.
      select
        n.notification_id, n.type, n.match_id,
        (
          case
            when n.payload ? 'actorPlayerId' then n.payload
            when ctx.hist_actor is not null then n.payload || jsonb_build_object('actorPlayerId', ctx.hist_actor)
            else n.payload
          end
        ) || jsonb_build_object('matchContext', ctx.match_context) as payload,
        n.created_at, n.read_at
      from public.notifications n
      left join lateral (
        select
          public._bloque6_notification_historical_actor(n.match_id, n.type) as hist_actor,
          public._bloque6_notification_match_context(n.match_id, v_caller_player_id) as match_context
      ) ctx on true
      where n.player_id = v_caller_player_id
    ) all_rows
    where not p_only_unread or all_rows.read_at is null
    order by all_rows.created_at desc
    limit v_limit;
end;
$$;

-- 12) get_my_matches — agrega pending_correction_origin ('duplicate' | null). Cambia el tipo de retorno: drop + create + grants explícitos.

drop function if exists public.get_my_matches(integer, boolean);

create or replace function public.get_my_matches(p_limit integer default 50, p_include_hidden boolean default false)
returns table (
  match_id uuid,
  status text,
  played_at timestamptz,
  played_at_time_known boolean,
  reported_time_zone text,
  format_id text,
  scoring_system text,
  location_name text,
  location_lat numeric,
  location_lng numeric,
  my_team text,
  action_side text,
  is_action_mine boolean,
  ready_for_validation boolean,
  created_by_player_id uuid,
  validated_at timestamptz,
  validation_deadline_at timestamptz,
  hidden boolean,
  private_note text,
  participants jsonb,
  sets jsonb,
  pending_correction_revision_id uuid,
  has_open_identity_issue boolean,
  pending_correction_origin text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  select player_id into v_caller_player_id
  from public.players
  where auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  return query
    select
      m.match_id,
      case when m.status = 'pending_validation' and m.validation_deadline_at <= now()
           then 'expired' else m.status end as status,
      m.played_at,
      m.played_at_time_known,
      m.reported_time_zone,
      m.format_id,
      m.scoring_system,
      m.location_name,
      m.location_lat,
      m.location_lng,
      mp_self.team as my_team,
      m.action_side,
      (m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side = mp_self.team) as is_action_mine,
      (m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side is null) as ready_for_validation,
      m.created_by_player_id,
      m.validated_at,
      m.validation_deadline_at,
      coalesce(mus.hidden, false) as hidden,
      mus.private_note,
      (
        select jsonb_agg(jsonb_build_object(
          'team', mp.team,
          'position', mp.position_in_team,
          'playerId', mp.player_id,
          'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
        ) order by mp.team, mp.position_in_team)
        from public.match_participants mp
        where mp.match_id = m.match_id
      ) as participants,
      (
        select jsonb_agg(jsonb_build_object(
          'setNumber', ms.set_number,
          'gamesA', ms.games_a,
          'gamesB', ms.games_b,
          'tiebreakA', ms.tiebreak_a,
          'tiebreakB', ms.tiebreak_b
        ) order by ms.set_number)
        from public.match_sets ms
        where ms.match_id = m.match_id
          and ms.revision_number = (
            select mr.revision_number
            from public.match_revisions mr
            where mr.revision_id = m.current_revision_id
          )
      ) as sets,
      m.pending_correction_revision_id,
      exists (
        select 1 from public.match_identity_issues mii
        where mii.match_id = m.match_id and mii.status = 'open'
      ) as has_open_identity_issue,
      case when public._pending_correction_is_duplicate_origin(m.match_id) then 'duplicate' else null end as pending_correction_origin
    from public.matches m
    join public.match_participants mp_self
      on mp_self.match_id = m.match_id
     and mp_self.player_id = v_caller_player_id
    left join public.match_user_state mus
      on mus.match_id = m.match_id
     and mus.player_id = v_caller_player_id
    where (p_include_hidden or coalesce(mus.hidden, false) = false)
    order by m.played_at desc
    limit v_limit;
end;
$$;
revoke all on function public.get_my_matches(integer, boolean) from public, anon;
grant execute on function public.get_my_matches(integer, boolean) to authenticated;

-- 13) get_match_detail — agrega pendingCorrectionOrigin

create or replace function public.get_match_detail(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_match public.matches;
  v_my_row public.match_participants;
  v_result jsonb;
begin
  select player_id into v_caller_player_id
  from public.players
  where auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select * into v_match
  from public.matches
  where match_id = p_match_id;

  if v_match is null then
    return null;
  end if;

  select * into v_my_row
  from public.match_participants
  where match_id = p_match_id
    and player_id = v_caller_player_id;

  if v_my_row is null then
    return null;
  end if;

  select jsonb_build_object(
    'matchId', v_match.match_id,
    'status', case when v_match.status = 'pending_validation'
                       and v_match.validation_deadline_at <= now()
                   then 'expired' else v_match.status end,
    'playedAt', v_match.played_at,
    'playedAtTimeKnown', v_match.played_at_time_known,
    'reportedTimeZone', v_match.reported_time_zone,
    'formatId', v_match.format_id,
    'scoringSystem', v_match.scoring_system,
    'locationName', v_match.location_name,
    'locationLat', v_match.location_lat,
    'locationLng', v_match.location_lng,
    'myTeam', v_my_row.team,
    'actionSide', v_match.action_side,
    'isActionMine', (
      v_match.status = 'pending_validation'
      and v_match.validation_deadline_at > now()
      and v_match.action_side = v_my_row.team
    ),
    'readyForValidation', (
      v_match.status = 'pending_validation'
      and v_match.validation_deadline_at > now()
      and v_match.action_side is null
    ),
    'createdByPlayerId', v_match.created_by_player_id,
    'validatedAt', v_match.validated_at,
    'validationDeadlineAt', v_match.validation_deadline_at,
    'pendingCorrectionRevisionId', v_match.pending_correction_revision_id,
    'pendingCorrectionOrigin', case when public._pending_correction_is_duplicate_origin(v_match.match_id) then 'duplicate' else null end,
    'currentRevisionNumber', (
      select revision_number
      from public.match_revisions
      where revision_id = v_match.current_revision_id
    ),
    'participants', (
      select jsonb_agg(jsonb_build_object(
        'team', mp.team,
        'position', mp.position_in_team,
        'playerId', mp.player_id,
        'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
      ) order by mp.team, mp.position_in_team)
      from public.match_participants mp
      where mp.match_id = v_match.match_id
    ),
    'sets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number,
        'gamesA', ms.games_a,
        'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a,
        'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (
          select revision_number
          from public.match_revisions
          where revision_id = v_match.current_revision_id
        )
    ),
    -- Ronda correctiva (revisión central) — ver nota de cabecera §1. `revision_number - 1` sobre
    -- la MISMA revisión vigente ya resuelta arriba (nunca un segundo criterio de "cuál es la
    -- vigente"); si no existe esa revisión_number-1 en match_sets (currentRevisionNumber=1),
    -- `jsonb_agg` sin filas devuelve `null`, igual que `sets` arriba sin `coalesce`.
    'previousRevisionSets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number,
        'gamesA', ms.games_a,
        'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a,
        'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (
          select revision_number - 1
          from public.match_revisions
          where revision_id = v_match.current_revision_id
        )
    ),
    -- Ronda correctiva (revisión central) — ver nota de cabecera §2. `pending_correction_revision_id`
    -- ya se exponía como id (`pendingCorrectionRevisionId`, sin cambios), nunca resuelto a sets
    -- hasta ahora. Sin corrección pendiente, `v_match.pending_correction_revision_id` es NULL:
    -- comparar `revision_id = NULL` nunca es verdadero en SQL, el subselect no encuentra fila y
    -- el `jsonb_agg` externo devuelve `null` sin necesitar un `case`/`if` aparte.
    'pendingCorrectionSets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number,
        'gamesA', ms.games_a,
        'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a,
        'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (
          select revision_number
          from public.match_revisions
          where revision_id = v_match.pending_correction_revision_id
        )
    ),
    'revisionCount', (
      select count(*)
      from public.match_revisions
      where match_id = v_match.match_id
    ),
    'actions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'actionType', ma.action_type,
        'actorPlayerId', ma.actor_player_id,
        'actingSide', ma.acting_side,
        'occurredAt', ma.occurred_at
      ) order by ma.occurred_at), '[]'::jsonb)
      from public.match_actions ma
      where ma.match_id = v_match.match_id
    ),
    'openIdentityIssues', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team,
        'openedAt', mii.opened_at, 'resolutionDeadlineAt', mii.resolution_deadline_at
      )), '[]'::jsonb)
      from public.match_identity_issues mii
      where mii.match_id = v_match.match_id and mii.status = 'open'
    ),
    'hidden', coalesce((
      select hidden
      from public.match_user_state
      where match_id = v_match.match_id
        and player_id = v_caller_player_id
    ), false),
    'privateNote', (
      select private_note
      from public.match_user_state
      where match_id = v_match.match_id
        and player_id = v_caller_player_id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------------------------------------------
-- 14) H1 — helpers de reconciliación de duplicados
-- ------------------------------------------------------------------

-- Sets de la revisión vigente de p_secondary orientados a los equipos A/B de p_canonical.
create or replace function public._secondary_sets_oriented(p_secondary_match_id uuid, p_canonical_match_id uuid)
returns table (set_number smallint, games_a smallint, games_b smallint, tiebreak_a smallint, tiebreak_b smallint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_same boolean;
  v_rev integer;
begin
  select (count(*) = 2) into v_same
    from public.match_participants sa
    join public.match_participants ca on ca.match_id = p_canonical_match_id and ca.player_id = sa.player_id and ca.team = 'A'
   where sa.match_id = p_secondary_match_id and sa.team = 'A';
  select r.revision_number into v_rev from public.matches m join public.match_revisions r on r.revision_id = m.current_revision_id
   where m.match_id = p_secondary_match_id;
  return query
    select ss.set_number,
           case when v_same then ss.games_a else ss.games_b end,
           case when v_same then ss.games_b else ss.games_a end,
           case when v_same then ss.tiebreak_a else ss.tiebreak_b end,
           case when v_same then ss.tiebreak_b else ss.tiebreak_a end
      from public.match_sets ss
     where ss.match_id = p_secondary_match_id and ss.revision_number = v_rev
     order by ss.set_number;
end;
$$;
revoke all on function public._secondary_sets_oriented(uuid, uuid) from public, anon, authenticated;

create or replace function public._duplicate_scores_differ(p_secondary_match_id uuid, p_canonical_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c_rev integer;
  v_c_count integer;
  v_s_count integer;
begin
  select r.revision_number into v_c_rev from public.matches m join public.match_revisions r on r.revision_id = m.current_revision_id
   where m.match_id = p_canonical_match_id;
  select count(*) into v_c_count from public.match_sets where match_id = p_canonical_match_id and revision_number = v_c_rev;
  select count(*) into v_s_count from public._secondary_sets_oriented(p_secondary_match_id, p_canonical_match_id);
  if v_c_count <> v_s_count then return true; end if;
  return exists (
    select 1 from public._secondary_sets_oriented(p_secondary_match_id, p_canonical_match_id) s
    join public.match_sets cs on cs.match_id = p_canonical_match_id and cs.revision_number = v_c_rev and cs.set_number = s.set_number
    where s.games_a is distinct from cs.games_a or s.games_b is distinct from cs.games_b
  );
end;
$$;
revoke all on function public._duplicate_scores_differ(uuid, uuid) from public, anon, authenticated;

-- Anula el secundario como duplicado (nunca borra): revierte su efecto si estaba validated (reversión pura vigente), pasa su ledger de
-- recuperación a reverted_duplicate, lo oculta del feed y deja la acción de auditoría. Idempotente.
create or replace function public._annul_match_as_duplicate(
  p_secondary_match_id uuid, p_canonical_match_id uuid, p_candidate_id uuid, p_actor_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.matches;
  v_reverted uuid;
  v_ledger integer := 0;
begin
  select * into v_s from public.matches where match_id = p_secondary_match_id for update;
  if v_s is null or v_s.status = 'annulled' then
    return jsonb_build_object('revertedResultId', null, 'ledgerReverted', 0, 'alreadyAnnulled', v_s.status = 'annulled');
  end if;
  if v_s.status = 'validated' then
    v_reverted := public._bloque6_revert_applied_result(p_secondary_match_id);
  end if;
  update public.level_recovery_effects
    set status = 'reverted_duplicate', reverted_at = now(),
        reverted_reason = 'duplicate_of:' || p_canonical_match_id::text, resolution_candidate_id = p_candidate_id
    where match_id = p_secondary_match_id and status = 'applied';
  get diagnostics v_ledger = row_count;
  update public.matches
    set status = 'annulled', annulled_at = now(), action_side = null, pending_correction_revision_id = null,
        annulment_reason = jsonb_build_object('kind', 'duplicate', 'canonicalMatchId', p_canonical_match_id, 'candidateId', p_candidate_id),
        updated_at = now()
    where match_id = p_secondary_match_id;
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (p_secondary_match_id, 'annulled', p_actor_player_id, null,
          jsonb_build_object('reason', 'duplicate', 'canonicalMatchId', p_canonical_match_id, 'candidateId', p_candidate_id));
  insert into public.match_user_state (match_id, player_id, hidden, hidden_at)
    select p_secondary_match_id, mp.player_id, true, now()
      from public.match_participants mp where mp.match_id = p_secondary_match_id and mp.player_id is not null
    on conflict (match_id, player_id) do update set hidden = true, hidden_at = coalesce(public.match_user_state.hidden_at, now()), updated_at = now();
  update public.match_duplicate_candidates
    set status = 'void', updated_at = now()
    where status = 'open' and candidate_id <> p_candidate_id
      and (match_low_id = p_secondary_match_id or match_high_id = p_secondary_match_id);
  return jsonb_build_object('revertedResultId', v_reverted, 'ledgerReverted', v_ledger);
end;
$$;
revoke all on function public._annul_match_as_duplicate(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- Finaliza una reconciliación que esperaba a la pareja contraria. outcome: 'accepted' (quedó el score alternativo, ya aplicado por
-- officialize_match_validation) | 'rejected' (se conserva el vigente). Devuelve NULL si la revisión no era de un duplicado. Idempotente.
create or replace function public._finalize_duplicate_reconciliation(p_canonical_match_id uuid, p_revision_id uuid, p_outcome text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.match_duplicate_candidates;
  v_annul jsonb := '{}'::jsonb;
  v_resolution jsonb;
begin
  select * into v_c from public.match_duplicate_candidates
   where canonical_match_id = p_canonical_match_id and status = 'awaiting_confirmation' and pending_revision_id = p_revision_id
   for update;
  if v_c.candidate_id is null then
    return null;
  end if;
  if v_c.secondary_match_id is not null then
    v_annul := public._annul_match_as_duplicate(v_c.secondary_match_id, p_canonical_match_id, v_c.candidate_id, v_c.target_player_id);
  end if;
  v_resolution := coalesce(v_c.resolution, '{}'::jsonb) || jsonb_build_object(
    'code', 'merged', 'finalizedBy', p_outcome,
    'chosenScore', case p_outcome when 'accepted' then 'alternative' else 'current' end,
    'revertedResultId', v_annul->'revertedResultId', 'ledgerReverted', v_annul->'ledgerReverted');
  update public.match_duplicate_candidates
    set status = 'resolved_same', resolution = v_resolution, resolved_at = now(), updated_at = now()
    where candidate_id = v_c.candidate_id;
  return v_resolution;
end;
$$;
revoke all on function public._finalize_duplicate_reconciliation(uuid, uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- 15) resolve_duplicate_match_candidate — H1/H4
-- ------------------------------------------------------------------
-- "SÍ, ES EL MISMO" confirma SOLO que es el mismo encuentro.
--   * ambos pending: se pliega la declaración del secundario al ancla (semántica vigente) y se anula el secundario.
--   * score IGUAL: reconciliación inmediata (anula el secundario, revierte solo su efecto) -> code `merged`.
--   * score DISTINTO (ancla validated): NO se elige por antigüedad ni se revierte nada todavía. Se propone sobre el ancla, a nombre de
--     quien confirmó, una corrección con el score del otro registro (mecánica vigente); la pareja contraria acepta o rechaza y recién
--     entonces se finaliza (_finalize_duplicate_reconciliation) -> code `merge_pending_confirmation`. Si el otro registro era un
--     pending (sin efecto deportivo) se anula ya, porque su declaración quedó preservada en la revisión propuesta.
create or replace function public.resolve_duplicate_match_candidate(p_candidate_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_peek public.match_duplicate_candidates;
  v_cand public.match_duplicate_candidates;
  v_low public.matches;
  v_high public.matches;
  v_canonical public.matches;
  v_secondary public.matches;
  v_fold jsonb := jsonb_build_object('folded', false);
  v_resolution jsonb;
  v_annul jsonb := '{}'::jsonb;
  v_canonical_status text;
  v_ready boolean := false;
  v_differ boolean;
  v_caller_team text;
  v_revision_number integer;
  v_revision_id uuid;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_caller, 'resolve_duplicate_match_candidate', 20, 600) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  if p_decision is null or p_decision not in ('same', 'different') then
    return jsonb_build_object('ok', false, 'code', 'invalid_decision');
  end if;

  select * into v_peek from public.match_duplicate_candidates where candidate_id = p_candidate_id;
  if v_peek.candidate_id is null or v_peek.target_player_id <> v_caller then
    return jsonb_build_object('ok', false, 'code', 'candidate_not_found');
  end if;
  select * into v_low from public.matches where match_id = v_peek.match_low_id;
  perform pg_advisory_xact_lock(hashtextextended(v_low.participant_fingerprint, 0));

  select * into v_cand from public.match_duplicate_candidates where candidate_id = p_candidate_id for update;

  -- Idempotencia / estados terminales.
  if v_cand.status = 'awaiting_confirmation' then
    if p_decision = 'same' then
      return coalesce(v_cand.resolution, '{}'::jsonb) || jsonb_build_object('ok', true, 'idempotentReturn', true, 'code', 'merge_pending_confirmation');
    end if;
    return jsonb_build_object('ok', false, 'code', 'already_resolved');
  end if;
  if v_cand.status in ('resolved_same', 'resolved_different') then
    if (v_cand.status = 'resolved_same') = (p_decision = 'same') then
      return coalesce(v_cand.resolution, '{}'::jsonb) || jsonb_build_object('ok', true, 'idempotentReturn', true, 'code', case when v_cand.status = 'resolved_same' then 'merged' else 'kept_both' end);
    end if;
    return jsonb_build_object('ok', false, 'code', 'already_resolved');
  end if;
  if v_cand.status = 'void' then
    return jsonb_build_object('ok', false, 'code', 'candidate_stale');
  end if;

  perform 1 from public.matches where match_id in (v_cand.match_low_id, v_cand.match_high_id) order by match_id for update;
  select * into v_low from public.matches where match_id = v_cand.match_low_id;
  select * into v_high from public.matches where match_id = v_cand.match_high_id;

  if p_decision = 'different' then
    v_resolution := jsonb_build_object('decision', 'different', 'code', 'kept_both');
    update public.match_duplicate_candidates
      set status = 'resolved_different', resolution = v_resolution, resolved_by_player_id = v_caller, resolved_at = now(), updated_at = now()
      where candidate_id = v_cand.candidate_id;
    return v_resolution || jsonb_build_object('ok', true);
  end if;

  if v_low.participant_fingerprint <> v_high.participant_fingerprint
     or v_low.participant_fingerprint like 'bloque6_unidentified:%'
     or not public._match_is_live_for_dedupe(v_low.status, v_low.validation_deadline_at)
     or not public._match_is_live_for_dedupe(v_high.status, v_high.validation_deadline_at)
     or not exists (select 1 from public.match_participants where match_id = v_low.match_id and player_id = v_caller)
     or not exists (select 1 from public.match_participants where match_id = v_high.match_id and player_id = v_caller) then
    update public.match_duplicate_candidates set status = 'void', updated_at = now() where candidate_id = v_cand.candidate_id;
    return jsonb_build_object('ok', false, 'code', 'candidate_stale');
  end if;

  -- Ancla técnica: validated sobre pending; entre dos validated, el de validated_at más antiguo; entre dos pending, el más antiguo.
  -- Ser ancla NO significa que su score sea la verdad deportiva cuando los scores difieren.
  if v_low.status = 'validated' and v_high.status <> 'validated' then
    v_canonical := v_low; v_secondary := v_high;
  elsif v_high.status = 'validated' and v_low.status <> 'validated' then
    v_canonical := v_high; v_secondary := v_low;
  elsif v_low.status = 'validated' then
    if (v_low.validated_at, v_low.created_at, v_low.match_id) <= (v_high.validated_at, v_high.created_at, v_high.match_id) then
      v_canonical := v_low; v_secondary := v_high;
    else
      v_canonical := v_high; v_secondary := v_low;
    end if;
  else
    if (v_low.created_at, v_low.match_id) <= (v_high.created_at, v_high.match_id) then
      v_canonical := v_low; v_secondary := v_high;
    else
      v_canonical := v_high; v_secondary := v_low;
    end if;
  end if;

  v_differ := public._duplicate_scores_differ(v_secondary.match_id, v_canonical.match_id);

  -- (D) pending + pending: se conserva la regresión vigente (pliegue como conformidad/revisión del flujo de carga).
  if v_canonical.status = 'pending_validation' and v_secondary.status = 'pending_validation' then
    v_fold := public._fold_pending_match_into(v_secondary.match_id, v_canonical.match_id, v_cand.candidate_id);
    v_annul := public._annul_match_as_duplicate(v_secondary.match_id, v_canonical.match_id, v_cand.candidate_id, v_caller);

  elsif not v_differ then
    -- Mismo resultado: reconciliación inmediata, un único efecto.
    v_annul := public._annul_match_as_duplicate(v_secondary.match_id, v_canonical.match_id, v_cand.candidate_id, v_caller);

  else
    -- (B)/(C) validated con score distinto: el conflicto queda PENDIENTE de la pareja contraria. Sin mutar nada hasta tener dónde alojarlo.
    if v_canonical.pending_correction_revision_id is not null then
      return jsonb_build_object('ok', false, 'code', 'correction_already_pending', 'canonicalMatchId', v_canonical.match_id);
    end if;
    if exists (select 1 from public.match_identity_issues where match_id = v_canonical.match_id and status = 'open') then
      return jsonb_build_object('ok', false, 'code', 'identity_issue_open', 'canonicalMatchId', v_canonical.match_id);
    end if;
    select team into v_caller_team from public.match_participants where match_id = v_canonical.match_id and player_id = v_caller;

    select coalesce(max(revision_number), 0) + 1 into v_revision_number from public.match_revisions where match_id = v_canonical.match_id;
    insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
      values (v_canonical.match_id, v_revision_number, v_caller, v_caller_team, 'proposed_correction', v_canonical.played_at)
      returning revision_id into v_revision_id;
    insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b, tiebreak_a, tiebreak_b)
      select v_canonical.match_id, v_revision_number, s.set_number, s.games_a, s.games_b, s.tiebreak_a, s.tiebreak_b
        from public._secondary_sets_oriented(v_secondary.match_id, v_canonical.match_id) s;
    update public.matches set pending_correction_revision_id = v_revision_id, updated_at = now() where match_id = v_canonical.match_id;
    insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
      values (v_canonical.match_id, 'revision_proposed', v_caller, v_caller_team, v_revision_id,
              jsonb_build_object('origin', 'duplicate_recovery', 'candidateId', v_cand.candidate_id, 'foldedFromMatchId', v_secondary.match_id));

    -- Un pending no tiene efecto deportivo y su declaración ya quedó preservada en la revisión propuesta: se anula ya.
    if v_secondary.status = 'pending_validation' then
      v_annul := public._annul_match_as_duplicate(v_secondary.match_id, v_canonical.match_id, v_cand.candidate_id, v_caller);
    end if;

    v_resolution := jsonb_build_object(
      'decision', 'same', 'code', 'merge_pending_confirmation', 'scoreConflict', true,
      'canonicalMatchId', v_canonical.match_id, 'secondaryMatchId', v_secondary.match_id,
      'pendingRevisionId', v_revision_id, 'secondaryAnnulledNow', v_secondary.status = 'pending_validation');
    update public.match_duplicate_candidates
      set status = 'awaiting_confirmation', canonical_match_id = v_canonical.match_id, secondary_match_id = v_secondary.match_id,
          pending_revision_id = v_revision_id, resolution = v_resolution, resolved_by_player_id = v_caller, updated_at = now()
      where candidate_id = v_cand.candidate_id;
    return v_resolution || jsonb_build_object('ok', true, 'awaitingConfirmation', true);
  end if;

  select status, (status = 'pending_validation' and action_side is null and validation_deadline_at > now())
    into v_canonical_status, v_ready from public.matches where match_id = v_canonical.match_id;

  v_resolution := jsonb_build_object(
    'decision', 'same', 'code', 'merged', 'canonicalMatchId', v_canonical.match_id, 'annulledMatchId', v_secondary.match_id,
    'fold', v_fold, 'revertedResultId', v_annul->'revertedResultId', 'ledgerReverted', v_annul->'ledgerReverted',
    'canonicalStatus', v_canonical_status, 'readyForValidation', v_ready);
  update public.match_duplicate_candidates
    set status = 'resolved_same', resolution = v_resolution, canonical_match_id = v_canonical.match_id, secondary_match_id = v_secondary.match_id,
        resolved_by_player_id = v_caller, resolved_at = now(), updated_at = now()
    where candidate_id = v_cand.candidate_id;
  return v_resolution || jsonb_build_object('ok', true);
end;
$$;

comment on function public.resolve_duplicate_match_candidate is
  'SÍ, ES EL MISMO / NO, SON DOS PARTIDOS DISTINTOS. Solo la persona recuperada. Idempotente. Misma resolución -> `merged`; score distinto ->
   `merge_pending_confirmation` (corrección propuesta que la pareja contraria acepta/rechaza; sin anular ni revertir hasta entonces).';

revoke all on function public.resolve_duplicate_match_candidate(uuid, text) from public, anon;
grant execute on function public.resolve_duplicate_match_candidate(uuid, text) to authenticated;

