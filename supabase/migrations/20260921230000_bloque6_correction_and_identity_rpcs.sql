-- BRAMUlab — Bloque 6: corrección post-validación + incidencias de identidad.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.4/§3.6,
-- 03_Plan_Implementacion_Claude.md §1.4, 04_Revision_ChatGPT.md §3/§6/§11,
-- 08_Revision_Central_Adicional.md B6-B-01/03/04/05/07}.
--
--   0) _bloque6_revert_applied_result(match_id) — helper interno (sin GRANT a nadie, uso
--      exclusivo de las funciones de este archivo): revierte de forma EXACTA y PURA (sin volver
--      a invocar el motor JS — ir a "sin efecto" nunca necesita recalcular nada) el
--      match_level_results actualmente `applied` de un partido, si existe. Reutilizado por
--      report_identity_issue (abrir incidencia sobre un partido validated = suspender el efecto
--      COMPLETO del partido, no solo el del slot cuestionado — 04_Revision_ChatGPT.md §3) y por
--      admin_annul_match. El level_events que escribe lleva el snapshot post-evento completo
--      (B6-B-02) y bloquea/itera jugadores en orden determinístico por player_id.
--   1) propose_post_validation_correction / respond_post_validation_correction — corrección de
--      RESULTADO dentro de los 3 días desde validated_at. La revisión propuesta queda en espera
--      (matches.pending_correction_revision_id) sin mover current_revision_id hasta que se
--      acepta — la última revisión oficial sigue siendo la vigente mientras tanto. Bloqueada
--      mientras exista una incidencia de identidad `open` sobre el mismo partido
--      (04_Revision_ChatGPT.md §11: primero identidad, después resultado).
--   2) report_identity_issue / resolve_identity_issue — incidencia de identidad por slot, 10+7
--      días (Experiencia_Inicial.md §13.4). Alcance de reversión de PARTIDO COMPLETO, no de un
--      jugador (04_Revision_ChatGPT.md §3). resolve_identity_issue con force_unidentified=true
--      es la materialización IDEMPOTENTE del vencimiento de 7 días (04_Revision_ChatGPT.md §6):
--      nunca queda como estado puramente derivado sin escritura. Exige participación actual del
--      caller y validez del reemplazo (B6-B-05); respeta la ventana de 30 días del partido sin
--      reiniciarla (B6-B-07); un reemplazo pre-validación crea una revisión append-only y pasa
--      la acción a la pareja contraria, nunca muta directo (B6-B-03); mantiene
--      participant_fingerprint sincronizado (B6-B-04).

-- ------------------------------------------------------------------
-- 0) helper interno de reversión pura
-- ------------------------------------------------------------------

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

    select count(distinct mlr.match_id) into v_rated
      from public.match_level_result_players mlrp
      join public.match_level_results mlr on mlr.result_id = mlrp.result_id
      where mlrp.player_id = v_row.player_id and mlr.effect_status = 'applied' and mlr.eligible
        and mlr.result_id <> v_applied.result_id;

    -- B6-A-11: cuenta CUALQUIER player_id rival de match_participants (registrado o
    -- provisional, nunca un slot NULL) de partidos con resultado applied+eligible — no exige
    -- que el rival tenga su propia fila en match_level_result_players (un rival sin Nivel
    -- propio sigue siendo una identidad distinta a efectos de diversidad).
    select count(distinct opp.player_id) into v_distinct
      from public.match_participants self_p
      join public.match_participants opp
        on opp.match_id = self_p.match_id and opp.team <> self_p.team and opp.player_id is not null
      join public.match_level_results mlr
        on mlr.match_id = self_p.match_id and mlr.effect_status = 'applied' and mlr.eligible
        and mlr.result_id <> v_applied.result_id
      where self_p.player_id = v_row.player_id;

    -- B6-A-12: no monotónico — la evidencia oficial VIGENTE decide, nunca "una vez CALIBRADO
    -- siempre CALIBRADO". RECALIBRANDO conserva su semántica propia, fuera de Bloque 6.
    v_status := case
      when v_cls.status = 'RECALIBRANDO' then 'RECALIBRANDO'
      when coalesce(v_rated, 0) >= 5 and coalesce(v_distinct, 0) >= 3 then 'CALIBRADO'
      else 'CALIBRANDO'
    end;

    -- B6-A-13: last_rated_at es actividad deportiva computable — se recompone como el máximo
    -- played_at de los resultados applied+eligible que le quedan a este jugador tras revertir
    -- (NULL si no le queda ninguno).
    select max(m.played_at) into v_last_rated_at
      from public.match_level_result_players mlrp
      join public.match_level_results mlr
        on mlr.result_id = mlrp.result_id and mlr.effect_status = 'applied' and mlr.eligible
        and mlr.result_id <> v_applied.result_id
      join public.matches m on m.match_id = mlr.match_id
      where mlrp.player_id = v_row.player_id;

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

comment on function public._bloque6_revert_applied_result is
  'Interno — sin GRANT a nadie, uso exclusivo de otras funciones SECURITY DEFINER de Bloque 6
   (corren con los privilegios del mismo dueño, no necesitan GRANT explícito). Reversión pura y
   exacta (movimiento real after-before, B6-A-03/04), sin motor JS: ir a "sin efecto" nunca
   necesita recalcular nada. distinct_opponents cuenta cualquier rival identificado (B6-A-11);
   status nunca es monotónico (B6-A-12); last_rated_at se recompone como actividad computable
   restante (B6-A-13). Bloquea/itera jugadores en orden determinístico por player_id
   (08_Revision_Central_Adicional.md, ajuste secundario #1). El level_events que escribe lleva
   SIEMPRE el snapshot post-evento completo (B6-B-02) — es el único evento de esta reversión, sin
   ninguno posterior en la misma transacción que lo complete.';

-- ------------------------------------------------------------------
-- 1) propose_post_validation_correction
-- ------------------------------------------------------------------

create or replace function public.propose_post_validation_correction(
  p_auth_user_id uuid,
  p_match_id uuid,
  -- Mismo formato que create_or_attach_match: [{"gamesA":int,"gamesB":int,"tiebreakA":int|null,
  -- "tiebreakB":int|null}, ...], YA orientado team_a/team_b según la orientación FIJA de este
  -- partido (la Edge Function la toma de match_participants existente, nunca la recalcula).
  p_sets jsonb
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
  v_new_set_count integer;
  v_revision_number integer;
  v_revision_id uuid;
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

  if v_match.status <> 'validated' then
    return jsonb_build_object('ok', false, 'code', 'match_not_validated');
  end if;
  if v_match.validated_at is null or now() > v_match.validated_at + interval '3 days' then
    return jsonb_build_object('ok', false, 'code', 'correction_window_expired');
  end if;
  if exists (select 1 from public.match_identity_issues where match_id = p_match_id and status = 'open') then
    -- 04_Revision_ChatGPT.md §11: primero se resuelve identidad, después se puede corregir el
    -- resultado.
    return jsonb_build_object('ok', false, 'code', 'identity_issue_open');
  end if;
  if v_match.pending_correction_revision_id is not null then
    return jsonb_build_object('ok', false, 'code', 'correction_already_pending');
  end if;

  v_new_set_count := jsonb_array_length(coalesce(p_sets, '[]'::jsonb));
  if v_new_set_count < 1 or v_new_set_count > 3 then
    return jsonb_build_object('ok', false, 'code', 'invalid_sets');
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_revision_number from public.match_revisions where match_id = p_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
  values (p_match_id, v_revision_number, v_caller_player_id, v_caller_team, 'proposed_correction', v_match.played_at)
  returning revision_id into v_revision_id;

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b, tiebreak_a, tiebreak_b)
  select p_match_id, v_revision_number, ord::smallint,
    (s->>'gamesA')::smallint, (s->>'gamesB')::smallint,
    (s->>'tiebreakA')::smallint, (s->>'tiebreakB')::smallint
  from jsonb_array_elements(p_sets) with ordinality as t(s, ord);

  update public.matches set pending_correction_revision_id = v_revision_id, updated_at = now() where match_id = p_match_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
  values (p_match_id, 'revision_proposed', v_caller_player_id, v_caller_team, v_revision_id, '{}'::jsonb);

  -- C-08: sin insert en notifications acá — get_notifications DERIVA la tarea
  -- 'correction_proposed' en lectura desde matches.pending_correction_revision_id (mientras la
  -- ventana de 3 días siga vigente, C-10), nunca la persiste como mensaje histórico.

  return jsonb_build_object('ok', true, 'code', 'correction_proposed', 'matchId', p_match_id, 'pendingCorrectionRevisionId', v_revision_id);
end;
$$;

comment on function public.propose_post_validation_correction is
  'Corrección de RESULTADO post-validación, ventana de 3 días desde validated_at. Deja la
   propuesta EN ESPERA sin mover current_revision_id — la última revisión oficial sigue vigente
   hasta que la pareja contraria acepta. Bloqueada si hay una incidencia de identidad open.
   Cambio de participante NO pasa por acá: eso es report_identity_issue/resolve_identity_issue.';

revoke all on function public.propose_post_validation_correction(uuid, uuid, jsonb) from public;
grant execute on function public.propose_post_validation_correction(uuid, uuid, jsonb) to service_role;

-- ------------------------------------------------------------------
-- respond_post_validation_correction
-- ------------------------------------------------------------------

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
  if v_match.validated_at is null or now() > v_match.validated_at + interval '3 days' then
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

comment on function public.respond_post_validation_correction is
  'Rechazo: mutación directa (sin Nivel involucrado). Aceptación: SOLO autoriza y devuelve
   pendingRevisionId — mover current_revision_id/pending_correction_revision_id y aplicar Nivel
   ocurre atómicamente dentro de officialize_match_validation(trigger=correction_accepted),
   nunca acá (B6-A-08: evita una ventana de inconsistencia entre "resultado ya cambió" y "Nivel
   todavía no").';

revoke all on function public.respond_post_validation_correction(uuid, uuid, boolean) from public;
grant execute on function public.respond_post_validation_correction(uuid, uuid, boolean) to service_role;

-- ------------------------------------------------------------------
-- 2) report_identity_issue
-- ------------------------------------------------------------------

create or replace function public.report_identity_issue(
  p_match_id uuid,
  p_team text,
  p_position_in_team smallint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_match public.matches;
  v_slot public.match_participants;
  v_issue_id uuid;
  v_reverted_result_id uuid;
begin
  -- Sin cálculo del motor JS involucrado (revertir usa match_level_results ya calculado, nunca
  -- recalcula) — alcanzable DIRECTO por authenticated vía auth.uid(), mismo criterio que
  -- hide_match_for_me/set_match_private_note (Bloque 5), sin pasar por ninguna Edge Function.
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.match_participants where match_id = p_match_id and player_id = v_caller_player_id) then
    return jsonb_build_object('ok', false, 'code', 'not_a_participant');
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    return jsonb_build_object('ok', false, 'code', 'match_not_found');
  end if;

  if v_match.status = 'validated' then
    if v_match.validated_at is null or now() > v_match.validated_at + interval '10 days' then
      return jsonb_build_object('ok', false, 'code', 'identity_window_expired');
    end if;
  elsif v_match.status = 'pending_validation' then
    -- B6-B-07: la ventana fija de 30 días (Experiencia_Inicial.md §11.2) también gobierna acá —
    -- un partido pending_validation con validation_deadline_at ya vencido deja de ser accionable,
    -- nunca se reactiva por un reporte de identidad.
    if v_match.validation_deadline_at is null or now() > v_match.validation_deadline_at then
      return jsonb_build_object('ok', false, 'code', 'match_expired');
    end if;
  else
    return jsonb_build_object('ok', false, 'code', 'match_not_actionable');
  end if;

  select * into v_slot from public.match_participants
    where match_id = p_match_id and team = p_team and position_in_team = p_position_in_team
    for update;
  if v_slot is null then
    return jsonb_build_object('ok', false, 'code', 'slot_not_found');
  end if;
  if exists (select 1 from public.match_identity_issues where match_id = p_match_id and team = p_team and position_in_team = p_position_in_team and status = 'open') then
    return jsonb_build_object('ok', false, 'code', 'identity_issue_already_open');
  end if;

  -- Alcance de reversión: EL PARTIDO COMPLETO, no solo este slot (04_Revision_ChatGPT.md §3) —
  -- la composición de los 4 determina fuerza de pareja/expectativa/disponibilidad/repetición/
  -- círculo, así que una identidad incorrecta puede invalidar todo el cálculo.
  v_reverted_result_id := public._bloque6_revert_applied_result(p_match_id);

  insert into public.match_identity_issues (
    match_id, team, position_in_team, previous_player_id, opened_by_player_id, opened_at,
    resolution_deadline_at, reverted_result_id
  ) values (
    p_match_id, p_team, p_position_in_team, v_slot.player_id, v_caller_player_id, now(),
    now() + interval '7 days', v_reverted_result_id
  ) returning issue_id into v_issue_id;

  update public.match_participants set player_id = null, display_name_snapshot = 'Por identificar'
    where match_id = p_match_id and team = p_team and position_in_team = p_position_in_team;

  -- B6-B-04: el slot recién quedó NULL — el fingerprint pasa al centinela determinístico hasta
  -- que se resuelva la incidencia (evita que una carga posterior con los 4 IDs correctos cree un
  -- duplicado, o que la identidad vieja siga siendo adjuntable).
  perform public._bloque6_refresh_participant_fingerprint(p_match_id);

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (p_match_id, 'identity_questioned', v_caller_player_id, null, jsonb_build_object('team', p_team, 'position', p_position_in_team, 'reason', p_reason));

  -- C-08: sin insert en notifications acá — get_notifications DERIVA la tarea
  -- 'identity_questioned' en lectura desde match_identity_issues.status='open', nunca la
  -- persiste como mensaje histórico (el match_actions de arriba ya conserva la auditoría).

  return jsonb_build_object('ok', true, 'code', 'identity_issue_opened', 'issueId', v_issue_id, 'resolutionDeadlineAt', now() + interval '7 days');
end;
$$;

comment on function public.report_identity_issue is
  '"No participé" / identidad incorrecta, pre o post-validación. Retira inmediatamente el
   player_id del slot y, si el partido estaba validated, suspende/revierte el efecto de Nivel
   COMPLETO del partido (los 4 jugadores conocidos, no solo el slot cuestionado). No necesita
   motor JS — revertir a "sin efecto" nunca recalcula nada. Alcanzable directo por
   authenticated: no hay cálculo del motor involucrado en abrir la incidencia.';

revoke all on function public.report_identity_issue(uuid, text, smallint, text) from public;
grant execute on function public.report_identity_issue(uuid, text, smallint, text) to authenticated;

-- ------------------------------------------------------------------
-- resolve_identity_issue
-- ------------------------------------------------------------------

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

comment on function public.resolve_identity_issue is
  'Exige que el caller siga siendo participante actual del partido (B6-B-05) y respeta la
   ventana de 30 días del partido mientras esté pending_validation, sin reiniciarla nunca
   (B6-B-07). Reemplazo: exige existencia/actividad y, si es provisional, relación con el caller
   (B6-B-05). Partido pending_validation: crea una nueva revisión append-only, copia los sets
   vigentes, reasigna el slot, refresca el fingerprint (B6-B-04) y pasa la acción a la pareja
   contraria — conversación entre parejas, nunca mutación directa (B6-B-03,
   Experiencia_Inicial.md §§7/11/12/13). Partido validated (B6-A-09): SOLO autoriza
   (needsRecompute=true) — la reasignación del slot, el refresco de fingerprint, el cierre de la
   incidencia y la reaplicación de Nivel del partido completo ocurren atómicamente dentro de
   officialize_match_validation(trigger=identity_resolved|identity_unidentified), nunca acá.
   force_unidentified=true materializa de forma idempotente el vencimiento de 7 días
   (04_Revision_ChatGPT.md §6) — nunca fabrica una identidad, nunca crea revisión (no cambia
   ningún dato oficial del partido).';

revoke all on function public.resolve_identity_issue(uuid, uuid, uuid, boolean) from public;
grant execute on function public.resolve_identity_issue(uuid, uuid, uuid, boolean) to service_role;
