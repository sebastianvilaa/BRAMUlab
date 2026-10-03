-- BRAMUlab — V04.29 · FRONTERA C (posibles duplicados revelados por la vinculación).
--
-- Detección: ya ocurre dentro de claim_provisional_player (_detect_duplicate_candidates, misma semántica estructural que
-- create_or_attach_match: huella de participantes + formato + ventana temporal; nunca nombres) y se re-ejecuta de forma
-- idempotente al listar (cubre la carrera con una carga concurrente de create_or_attach_match).
--
-- Resolución (solo la persona recuperada = target del candidato):
--   NO, SON DISTINTOS -> status=resolved_different; ambos partidos intactos; el par no se vuelve a ofrecer.
--   SÍ, ES EL MISMO  -> queda UN encuentro efectivo y se preserva toda la historia de ambas cargas:
--     * canónico: si uno solo está validated, ese; si ambos, el de validated_at más antiguo; si ambos pending, el más
--       antiguo (created_at, match_id).
--     * ambos pending: la última declaración del secundario se pliega al canónico con la MISMA semántica de
--       create_or_attach_match (conformidad rival / redeclaración del mismo lado / revisión propuesta si el score
--       difiere) — no se inventa una conversación nueva; si queda listo para validar, el self-heal del cliente
--       oficializa por el camino vigente.
--     * el secundario se ANULA como duplicado (status=annulled, annulment_reason.kind='duplicate'), nunca se borra:
--       submissions, revisiones, acciones y actores quedan. Si estaba validated se revierte su efecto con
--       _bloque6_revert_applied_result (la reversión pura vigente: no recalcula historia de terceros; incluye la fila del
--       target recuperada) y su ledger level_recovery_effects pasa a reverted_duplicate (estrecho, idempotente).
--     * Grupos/Stats/Intelligence derivan de matches validated -> un solo partido; Ranking publicado no se toca.

-- ------------------------------------------------------------------
-- 1) _fold_pending_match_into — pliega la última declaración de un pending en otro pending
-- ------------------------------------------------------------------

create or replace function public._fold_pending_match_into(
  p_secondary_match_id uuid, p_canonical_match_id uuid, p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.matches;
  v_c public.matches;
  v_srev public.match_revisions;
  v_crev public.match_revisions;
  v_same_orientation boolean;
  v_prop_team_c text;
  v_scores_match boolean;
  v_revision_number integer;
  v_revision_id uuid;
  v_s_count integer;
  v_c_count integer;
  v_meta jsonb := jsonb_build_object('viaDuplicateResolution', p_candidate_id, 'foldedFromMatchId', p_secondary_match_id);
begin
  select * into v_s from public.matches where match_id = p_secondary_match_id;
  select * into v_c from public.matches where match_id = p_canonical_match_id;
  select * into v_srev from public.match_revisions where revision_id = v_s.current_revision_id;
  select * into v_crev from public.match_revisions where revision_id = v_c.current_revision_id;
  if v_srev is null or v_crev is null then
    return jsonb_build_object('folded', false, 'reason', 'no_current_revision');
  end if;

  -- ¿la pareja A del secundario es la pareja A del canónico? (la huella igual garantiza que las parejas coinciden)
  select (count(*) = 2) into v_same_orientation
    from public.match_participants sa
    join public.match_participants ca on ca.match_id = p_canonical_match_id and ca.player_id = sa.player_id and ca.team = 'A'
    where sa.match_id = p_secondary_match_id and sa.team = 'A';

  select team into v_prop_team_c from public.match_participants
    where match_id = p_canonical_match_id and player_id = v_srev.proposed_by_player_id;
  if v_prop_team_c is null then
    return jsonb_build_object('folded', false, 'reason', 'proposer_not_in_canonical');
  end if;

  select count(*) into v_s_count from public.match_sets where match_id = p_secondary_match_id and revision_number = v_srev.revision_number;
  select count(*) into v_c_count from public.match_sets where match_id = p_canonical_match_id and revision_number = v_crev.revision_number;

  if v_s_count <> v_c_count then
    v_scores_match := false;
  else
    select not exists (
      select 1
      from public.match_sets ss
      join public.match_sets cs
        on cs.match_id = p_canonical_match_id and cs.revision_number = v_crev.revision_number and cs.set_number = ss.set_number
      where ss.match_id = p_secondary_match_id and ss.revision_number = v_srev.revision_number
        and (case when v_same_orientation then ss.games_a else ss.games_b end is distinct from cs.games_a
          or case when v_same_orientation then ss.games_b else ss.games_a end is distinct from cs.games_b)
    ) into v_scores_match;
  end if;

  if v_scores_match then
    if v_c.action_side is null then
      return jsonb_build_object('folded', true, 'outcome', 'already_confirmed');
    elsif v_prop_team_c <> v_crev.proposed_by_team then
      update public.matches set action_side = null, updated_at = now() where match_id = p_canonical_match_id;
      insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
        values (p_canonical_match_id, 'confirmed', v_srev.proposed_by_player_id, v_prop_team_c, v_c.current_revision_id, v_meta);
      return jsonb_build_object('folded', true, 'outcome', 'confirmed', 'readyForValidation', true);
    else
      insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
        values (p_canonical_match_id, 'declared_again_same_side', v_srev.proposed_by_player_id, v_prop_team_c, v_c.current_revision_id, v_meta);
      return jsonb_build_object('folded', true, 'outcome', 'same_side');
    end if;
  end if;

  -- Score distinto: revisión propuesta (mismo mecanismo que create_or_attach_match). La acción pasa al lado opuesto.
  select coalesce(max(revision_number), 0) + 1 into v_revision_number from public.match_revisions where match_id = p_canonical_match_id;
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (p_canonical_match_id, v_revision_number, v_srev.proposed_by_player_id, v_prop_team_c, 'proposed_correction', v_c.played_at)
    returning revision_id into v_revision_id;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b, tiebreak_a, tiebreak_b)
    select p_canonical_match_id, v_revision_number, ss.set_number,
           case when v_same_orientation then ss.games_a else ss.games_b end,
           case when v_same_orientation then ss.games_b else ss.games_a end,
           case when v_same_orientation then ss.tiebreak_a else ss.tiebreak_b end,
           case when v_same_orientation then ss.tiebreak_b else ss.tiebreak_a end
      from public.match_sets ss
      where ss.match_id = p_secondary_match_id and ss.revision_number = v_srev.revision_number;
  update public.matches
    set current_revision_id = v_revision_id, action_side = case v_prop_team_c when 'A' then 'B' else 'A' end, updated_at = now()
    where match_id = p_canonical_match_id;
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
    values (p_canonical_match_id, 'revision_proposed', v_srev.proposed_by_player_id, v_prop_team_c, v_revision_id, v_meta);
  return jsonb_build_object('folded', true, 'outcome', 'revised', 'actionSide', case v_prop_team_c when 'A' then 'B' else 'A' end);
end;
$$;

revoke all on function public._fold_pending_match_into(uuid, uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- 2) list_my_duplicate_match_candidates
-- ------------------------------------------------------------------

create or replace function public.list_my_duplicate_match_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller, 'list_duplicate_match_candidates', 60, 60) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'candidates', '[]'::jsonb);
  end if;

  -- Re-detección idempotente sobre los partidos de MIS recuperaciones recientes (misma que get_my_identity_recovery_status).
  perform public._redetect_duplicate_candidates_for_player(v_caller);

  return jsonb_build_object('ok', true, 'candidates', coalesce((
    select jsonb_agg(jsonb_build_object(
      'candidateId', c.candidate_id,
      'evidence', c.evidence,
      'detectedAt', c.created_at,
      'matches', (
        select jsonb_agg(public._duplicate_candidate_match_json(t.mid, v_caller) order by m.played_at, m.match_id)
          from unnest(array[c.match_low_id, c.match_high_id]) as t(mid)
          join public.matches m on m.match_id = t.mid
      )
    ) order by c.created_at, c.candidate_id)
    from public.match_duplicate_candidates c
    where c.target_player_id = v_caller and c.status = 'open'
      and exists (select 1 from public.matches m where m.match_id = c.match_low_id and m.status <> 'annulled')
      and exists (select 1 from public.matches m where m.match_id = c.match_high_id and m.status <> 'annulled')
  ), '[]'::jsonb));
end;
$$;

/** Resumen de UN partido para la pantalla de duplicados: jugadores, fecha/hora, resultado vigente y lugar. */
create or replace function public._duplicate_candidate_match_json(p_match_id uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'matchId', m.match_id,
    'status', m.status,
    'playedAt', m.played_at,
    'playedAtTimeKnown', m.played_at_time_known,
    'formatId', m.format_id,
    'locationName', m.location_name,
    'validatedAt', m.validated_at,
    'myTeam', (select mp.team from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = p_viewer),
    'participants', (
      select jsonb_agg(jsonb_build_object(
        'team', mp.team, 'position', mp.position_in_team,
        'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
      ) order by mp.team, mp.position_in_team)
      from public.match_participants mp where mp.match_id = m.match_id),
    'sets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = m.match_id
        and ms.revision_number = (select mr.revision_number from public.match_revisions mr where mr.revision_id = m.current_revision_id))
  )
  from public.matches m where m.match_id = p_match_id;
$$;

revoke all on function public._duplicate_candidate_match_json(uuid, uuid) from public, anon, authenticated;

comment on function public.list_my_duplicate_match_candidates is
  'Candidatos de duplicado ABIERTOS donde el caller es la persona recuperada (target). Devuelve, por candidato, los dos
   partidos con jugadores, fecha/hora, resultado vigente y lugar. Sin ids de terceros más allá de los partidos propios.';

revoke all on function public.list_my_duplicate_match_candidates() from public, anon;
grant execute on function public.list_my_duplicate_match_candidates() to authenticated;

-- ------------------------------------------------------------------
-- 3) resolve_duplicate_match_candidate
-- ------------------------------------------------------------------

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
  v_reverted uuid;
  v_ledger integer := 0;
  v_canonical_status text;
  v_ready boolean := false;
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

  -- Lectura sin lock solo para tomar el lock de la huella (mismo advisory que create_or_attach_match, semilla 0).
  select * into v_peek from public.match_duplicate_candidates where candidate_id = p_candidate_id;
  if v_peek.candidate_id is null or v_peek.target_player_id <> v_caller then
    return jsonb_build_object('ok', false, 'code', 'candidate_not_found');
  end if;
  select * into v_low from public.matches where match_id = v_peek.match_low_id;
  perform pg_advisory_xact_lock(hashtextextended(v_low.participant_fingerprint, 0));

  select * into v_cand from public.match_duplicate_candidates where candidate_id = p_candidate_id for update;

  -- Idempotencia: misma decisión -> mismo resultado; decisión opuesta -> estado de negocio.
  if v_cand.status in ('resolved_same', 'resolved_different') then
    if (v_cand.status = 'resolved_same') = (p_decision = 'same') then
      return coalesce(v_cand.resolution, '{}'::jsonb) || jsonb_build_object('ok', true, 'idempotentReturn', true);
    end if;
    return jsonb_build_object('ok', false, 'code', 'already_resolved');
  end if;
  if v_cand.status = 'void' then
    return jsonb_build_object('ok', false, 'code', 'candidate_stale');
  end if;

  -- Filas de los dos partidos en orden determinístico.
  perform 1 from public.matches where match_id in (v_cand.match_low_id, v_cand.match_high_id) order by match_id for update;
  select * into v_low from public.matches where match_id = v_cand.match_low_id;
  select * into v_high from public.matches where match_id = v_cand.match_high_id;

  if p_decision = 'different' then
    v_resolution := jsonb_build_object('decision', 'different');
    update public.match_duplicate_candidates
      set status = 'resolved_different', resolution = v_resolution, resolved_by_player_id = v_caller, resolved_at = now(), updated_at = now()
      where candidate_id = v_cand.candidate_id;
    return v_resolution || jsonb_build_object('ok', true, 'code', 'kept_both');
  end if;

  -- SAME: el candidato debe seguir siendo válido (misma huella, ambos vivos, ventana vigente).
  if v_low.participant_fingerprint <> v_high.participant_fingerprint
     or v_low.participant_fingerprint like 'bloque6_unidentified:%'
     or not public._match_is_live_for_dedupe(v_low.status, v_low.validation_deadline_at)
     or not public._match_is_live_for_dedupe(v_high.status, v_high.validation_deadline_at)
     or not exists (select 1 from public.match_participants where match_id = v_low.match_id and player_id = v_caller)
     or not exists (select 1 from public.match_participants where match_id = v_high.match_id and player_id = v_caller) then
    update public.match_duplicate_candidates set status = 'void', updated_at = now() where candidate_id = v_cand.candidate_id;
    return jsonb_build_object('ok', false, 'code', 'candidate_stale');
  end if;

  -- Canónico: validated sobre pending; entre dos validated, el más antiguo; entre dos pending, el más antiguo.
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

  if v_canonical.status = 'pending_validation' and v_secondary.status = 'pending_validation' then
    v_fold := public._fold_pending_match_into(v_secondary.match_id, v_canonical.match_id, v_cand.candidate_id);
  end if;

  -- Quitar SOLO el efecto duplicado: reversión pura vigente del secundario (incluye la fila del target recuperada).
  if v_secondary.status = 'validated' then
    v_reverted := public._bloque6_revert_applied_result(v_secondary.match_id);
  end if;

  update public.level_recovery_effects
    set status = 'reverted_duplicate', reverted_at = now(),
        reverted_reason = 'duplicate_of:' || v_canonical.match_id::text, resolution_candidate_id = v_cand.candidate_id
    where match_id = v_secondary.match_id and status = 'applied';
  get diagnostics v_ledger = row_count;

  update public.matches
    set status = 'annulled', annulled_at = now(), action_side = null,
        annulment_reason = jsonb_build_object('kind', 'duplicate', 'canonicalMatchId', v_canonical.match_id, 'candidateId', v_cand.candidate_id),
        updated_at = now()
    where match_id = v_secondary.match_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (v_secondary.match_id, 'annulled', v_caller, null,
          jsonb_build_object('reason', 'duplicate', 'canonicalMatchId', v_canonical.match_id, 'candidateId', v_cand.candidate_id));

  -- Fuera del feed por defecto (queda auditable con "mostrar ocultos"): el partido sigue existiendo, no se borra nada.
  insert into public.match_user_state (match_id, player_id, hidden, hidden_at)
    select v_secondary.match_id, mp.player_id, true, now()
      from public.match_participants mp where mp.match_id = v_secondary.match_id and mp.player_id is not null
    on conflict (match_id, player_id) do update set hidden = true, hidden_at = coalesce(public.match_user_state.hidden_at, now()), updated_at = now();

  select status, (status = 'pending_validation' and action_side is null and validation_deadline_at > now())
    into v_canonical_status, v_ready
    from public.matches where match_id = v_canonical.match_id;

  v_resolution := jsonb_build_object(
    'decision', 'same', 'canonicalMatchId', v_canonical.match_id, 'annulledMatchId', v_secondary.match_id,
    'fold', v_fold, 'revertedResultId', v_reverted, 'ledgerReverted', v_ledger,
    'canonicalStatus', v_canonical_status, 'readyForValidation', v_ready
  );
  update public.match_duplicate_candidates
    set status = 'resolved_same', resolution = v_resolution, canonical_match_id = v_canonical.match_id,
        resolved_by_player_id = v_caller, resolved_at = now(), updated_at = now()
    where candidate_id = v_cand.candidate_id;

  -- Cualquier otro candidato abierto que involucre al secundario deja de tener sentido.
  update public.match_duplicate_candidates
    set status = 'void', updated_at = now()
    where status = 'open' and candidate_id <> v_cand.candidate_id
      and (match_low_id = v_secondary.match_id or match_high_id = v_secondary.match_id);

  return v_resolution || jsonb_build_object('ok', true, 'code', 'merged');
end;
$$;

comment on function public.resolve_duplicate_match_candidate is
  'SÍ, ES EL MISMO / NO, SON DOS PARTIDOS DISTINTOS. Solo la persona recuperada (target). Idempotente. Serializa con el mismo
   advisory lock por huella que create_or_attach_match. same: un único encuentro efectivo, historia preservada, doble efecto
   revertido de forma estrecha (reversión vigente + ledger reverted_duplicate), sin recalcular terceros ni tocar Ranking.';

revoke all on function public.resolve_duplicate_match_candidate(uuid, text) from public, anon;
grant execute on function public.resolve_duplicate_match_candidate(uuid, text) to authenticated;
