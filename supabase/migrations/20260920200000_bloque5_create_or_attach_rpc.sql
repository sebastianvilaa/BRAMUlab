-- BRAMUlab — Bloque 5: create_or_attach_match — RPC privada, atómica e idempotente.
--
-- Depende de 20260920180000_bloque5_matches_core.sql y 20260920190000_bloque5_rpcs_read.sql.
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_05/{02_Analisis_Claude.md §5,
-- 04_Revision_ChatGPT.md §2} para el razonamiento completo.
--
-- NO se otorga a `authenticated` ni `anon`: la única vía de entrada es la Edge Function
-- `create-or-attach-match` (supabase/functions/create-or-attach-match/), que ya verificó el JWT
-- del usuario y ya revalidó formato/sets con el MISMO engine.js que usa el navegador (symlink
-- real) antes de llamar acá con la service role key — mismo patrón exacto que
-- officialize_level_onboarding en Bloque 3.
--
-- Canonicalización (02_Analisis_Claude.md §5.2): team_a/team_b se recalculan SIEMPRE desde los
-- 4 player_id de ESTA carga (la pareja cuyo par de IDs ordenado es lexicográficamente menor es
-- SIEMPRE team_a) — nunca se consulta la orientación de un partido ya existente. Es una función
-- determinística de los mismos 4 IDs + misma composición de pareja, así que dos cargas
-- independientes del mismo encuentro llegan siempre a la MISMA asignación team_a/team_b, sin
-- importar quién cargó primero ni cómo llamó "A"/"B" a su propia pareja en el formulario.
--
-- Errores de negocio esperables → jsonb {ok:false, code:...} con RETURN, nunca RAISE EXCEPTION
-- (mismo criterio que claim_provisional_player en Bloque 4: una excepción revertiría toda la
-- transacción, incluido el registro en match_submissions que necesitamos conservar incluso
-- para un resultado de error).
--
-- Concurrencia: `select ... for update` sobre la fila candidata de `matches` antes de decidir
-- crear vs. adjuntar — mismo patrón ya probado en officialize_level_onboarding/
-- claim_provisional_player.
--
-- Expiración lógica (Decisión #4): un candidato pending_validation cuyo validation_deadline_at
-- ya venció NUNCA se ofrece como candidato de create-or-attach (se trata igual que si no
-- existiera) — Bloque 5 nunca escribe status='expired' físicamente.

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
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = p_auth_user_id;
  if v_caller_player_id is null then
    raise exception 'no_player_for_user' using errcode = 'P0001';
  end if;

  -- ------------------------------------------------------------------
  -- Idempotencia (02_Analisis_Claude.md §5.5) — SIEMPRE lo primero.
  -- ------------------------------------------------------------------
  v_payload := jsonb_build_object(
    'pair1a', p_pair1_player_id_1, 'pair1b', p_pair1_player_id_2,
    'pair2a', p_pair2_player_id_1, 'pair2b', p_pair2_player_id_2,
    'playedAt', p_played_at, 'playedAtTimeKnown', p_played_at_time_known,
    'formatId', p_format_id, 'sets', p_sets,
    'disambiguationMatchId', p_disambiguation_match_id,
    'disambiguationForceNew', p_disambiguation_force_new
  );
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

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
  -- Límite de pendientes accionables (Experiencia_Inicial.md §10) — ANTES de intentar
  -- create-or-attach, sin importar si esta carga terminaría creando o adjuntando.
  -- ------------------------------------------------------------------
  v_pending_count := public.compute_pending_action_count(v_caller_player_id);
  if v_pending_count >= 5 then
    v_result := jsonb_build_object('ok', false, 'code', 'pending_action_limit_reached', 'count', v_pending_count);
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

  -- ------------------------------------------------------------------
  -- Advisory lock por huella (transaction-scoped, se libera solo al terminar la transacción).
  -- Necesario porque el caso "crear nuevo" (0 candidatos) NO tiene todavía ninguna fila de
  -- `matches` que bloquear con "for update": sin este lock, dos transacciones concurrentes que
  -- representan el MISMO encuentro nuevo podrían ambas ver "0 candidatos" antes de que
  -- cualquiera de las dos confirme su INSERT, y crear dos partidos duplicados
  -- (02_Analisis_Claude.md §5.6). Con el lock, la segunda espera a que la primera termine su
  -- transacción completa (crear o adjuntar) y entonces sí ve la fila ya committeada.
  -- hashtextextended (64 bits) en vez de hashtext (32 bits) para reducir el riesgo de colisión
  -- entre huellas distintas a un nivel despreciable para la escala del piloto.
  -- ------------------------------------------------------------------
  perform pg_advisory_xact_lock(hashtextextended(v_fingerprint, 0));

  -- ------------------------------------------------------------------
  -- Búsqueda de candidatos (Decisiones #1/#2 de 04_Revision_ChatGPT.md). Un candidato
  -- pending_validation cuyo deadline ya venció NUNCA se ofrece — se trata como si no existiera.
  -- ------------------------------------------------------------------
  if p_disambiguation_force_new then
    v_target_match_id := null;
  elsif p_disambiguation_match_id is not null then
    select match_id into v_target_match_id
    from public.matches
    where match_id = p_disambiguation_match_id
      and participant_fingerprint = v_fingerprint
      and format_id = p_format_id
      and (status = 'validated' or (status = 'pending_validation' and validation_deadline_at > now()));
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
      and (
        case
          when p_played_at_time_known and m.played_at_time_known
            then abs(extract(epoch from (m.played_at - p_played_at))) <= 10800  -- ±3 horas, Decisión #1
          else date_trunc('day', m.played_at at time zone 'America/Argentina/Buenos_Aires')
             = date_trunc('day', p_played_at at time zone 'America/Argentina/Buenos_Aires')
        end
      );

    if coalesce(v_candidate_count, 0) > 1 then
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
  -- ADJUNTAR a v_target_match_id (1 candidato, o desambiguación explícita eligiendo uno)
  -- ------------------------------------------------------------------
  select * into v_match from public.matches where match_id = v_target_match_id for update;

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

  -- status = 'pending_validation' de acá en más.
  if v_scores_match then
    if v_caller_team <> v_current_proposer_team then
      -- CONFIRMACIÓN: la declaración coincide y viene del lado que todavía no había hablado.
      update public.matches set status = 'validated', validated_at = now(), action_side = null, updated_at = now()
      where match_id = v_match.match_id;
      insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
      values (v_match.match_id, 'validated', v_caller_player_id, v_caller_team, v_match.current_revision_id, '{}'::jsonb);
      insert into public.pilot_events (event_name, player_id, properties)
      values ('match_validated', v_caller_player_id, jsonb_build_object('matchId', v_match.match_id));
      v_result := jsonb_build_object('ok', true, 'code', 'matched_confirmed', 'matchId', v_match.match_id, 'status', 'validated');
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
    -- §12.1), con la misma regla simétrica: la acción siempre pasa al lado opuesto al que
    -- acaba de declarar, sin importar cuál era el lado con la acción antes.
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

comment on function public.create_or_attach_match is
  'Única vía de creación/adjunción de un partido. SOLO service_role — la llama exclusivamente
   la Edge Function create-or-attach-match, que ya validó el JWT y ya revalidó formato/sets con
   engine.js (nunca reimplementado en SQL). Idempotente vía match_submissions; concurrency-safe
   vía "select ... for update" sobre la fila candidata. Nunca RAISE EXCEPTION para errores de
   negocio esperables (mismo criterio que claim_provisional_player en Bloque 4).';

revoke all on function public.create_or_attach_match(
  uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean, text, jsonb,
  text, text, text, numeric, numeric, uuid, boolean
) from public;
grant execute on function public.create_or_attach_match(
  uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, boolean, text, jsonb,
  text, text, text, numeric, numeric, uuid, boolean
) to service_role;
