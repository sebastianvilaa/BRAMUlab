-- BRAMUlab — V04.30 · B2 (QA 04/10): replay idempotente de create_or_attach_match.
--
-- Bug: `v_existing_submission is not null` evalúa un RECORD COMPUESTO — en PostgreSQL `ROW(...) IS NOT NULL` es verdadero solo si TODAS las
-- columnas son no-nulas. Un submission con error de negocio (p. ej. pending_action_limit_reached) guarda result_match_id = NULL, así que el
-- chequeo daba falso, la función seguía y volvía a insertar el mismo idempotency_key → SQLSTATE 23505 → Edge `persist_failed`/500 → el
-- frontend lo mostraba como "Sin conexión". Fix: chequear una columna NOT NULL (idempotency_key). Resto de la función idéntico al vigente
-- (20261003140000). Forward-only; los grants de la función se conservan con CREATE OR REPLACE.

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
  if v_existing_submission.idempotency_key is not null then
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

-- ------------------------------------------------------------------
-- B3 — candidatos de duplicado stale (el caller ya no figura en alguno de los dos partidos)
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
      -- V04.30 (B3) — candidato STALE: si el caller ya no figura en alguno de los dos partidos (p. ej. se desligó vía
      -- "No participé"/identidad cuestionada), la pregunta ya no le corresponde.
      and exists (select 1 from public.match_participants mp where mp.match_id = c.match_low_id and mp.player_id = v_caller)
      and exists (select 1 from public.match_participants mp where mp.match_id = c.match_high_id and mp.player_id = v_caller)
  ), '[]'::jsonb));
end;
$$;

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
                                   and exists (select 1 from public.matches m where m.match_id = c.match_high_id and m.status <> 'annulled')
                                   -- V04.30 (B3) — sin candidatos stale: el caller debe seguir figurando en ambos partidos.
                                   and exists (select 1 from public.match_participants mp where mp.match_id = c.match_low_id and mp.player_id = v_player_id)
                                   and exists (select 1 from public.match_participants mp where mp.match_id = c.match_high_id and mp.player_id = v_player_id))
  );
end;
$$;

-- ------------------------------------------------------------------
-- Notificación identity_questioned: bandera selfReported (self-report de identidad)
-- ------------------------------------------------------------------

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
          -- V04.30 — la persona señaló SU PROPIO lugar ("No participé"): copy en primera persona, sin hablar de "un jugador cargado".
          'selfReported', coalesce(mii.previous_player_id = mii.opened_by_player_id, false),
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

-- ------------------------------------------------------------------
-- preview_claim_link con contexto del partido fuente (V04.30)
-- ------------------------------------------------------------------

create or replace function public.preview_claim_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_token text := trim(coalesce(p_token, ''));
  v_claim public.provisional_claims;
  v_prov public.players;
  v_match_count integer;
  v_source_match_id uuid;
  v_source jsonb;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'preview_claim_link', 30, 900) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  if v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;

  select * into v_claim from public.provisional_claims
    where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
  if v_claim is null then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;
  if v_claim.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'claim_revoked');
  end if;
  if v_claim.status = 'claimed' then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;
  if v_claim.status = 'expired' or v_claim.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'claim_expired');
  end if;

  select * into v_prov from public.players where player_id = v_claim.provisional_player_id;
  if v_prov is null or v_prov.type <> 'provisional' or not v_prov.is_active or v_prov.recovered_into_player_id is not null then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;

  -- V04.30 — contexto para reducir errores humanos en "¿Sos {nombre}?": cuántos partidos vigentes tiene la provisional y UNO compacto
  -- (el más reciente: quién lo cargó, parejas, score, fecha). Solo para el receptor YA autenticado; nunca ids de partido ni de terceros.
  select count(*)::int, (array_agg(m.match_id order by m.played_at desc, m.match_id))[1]
    into v_match_count, v_source_match_id
    from public.matches m
   where m.status <> 'annulled'
     and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = v_prov.player_id);

  if v_source_match_id is not null then
    v_source := public._duplicate_candidate_match_json(v_source_match_id, null) - 'matchId' - 'myTeam';
    v_source := v_source || jsonb_build_object('loaderName', (
      select coalesce(nullif(btrim(lp.display_name), ''), 'Jugador')
        from public.matches m join public.players lp on lp.player_id = m.created_by_player_id
       where m.match_id = v_source_match_id));
  end if;

  return jsonb_build_object(
    'ok', true, 'code', 'claim_valid',
    'displayName', coalesce(nullif(btrim(v_prov.display_name), ''), 'Jugador'),
    'matchCount', coalesce(v_match_count, 0),
    'sourceMatch', v_source
  );
end;
$$;

-- ------------------------------------------------------------------
-- get_my_recovered_match_ids — partidos recuperados por UNA vinculación propia (pantalla post-SOY YO)
-- ------------------------------------------------------------------

/** Solo el TARGET de la recuperación (el propio caller) puede leerla. Devuelve únicamente ids de partido + el nombre con el que
 *  figuraba la identidad provisional; los datos del partido se leen con get_my_matches (que ya filtra por participación real). */
create or replace function public.get_my_recovered_match_ids(p_recovery_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_ids uuid[];
  v_src text;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  select r.recovered_match_ids, nullif(btrim(sp.display_name), '')
    into v_ids, v_src
    from public.player_identity_recoveries r
    join public.players sp on sp.player_id = r.source_provisional_player_id
   where r.recovery_id = p_recovery_id and r.target_player_id = v_caller and r.status = 'completed';
  if v_ids is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'matchIds', to_jsonb(v_ids), 'sourceName', coalesce(v_src, 'Jugador'));
end;
$$;

revoke all on function public.get_my_recovered_match_ids(uuid) from public, anon;
grant execute on function public.get_my_recovered_match_ids(uuid) to authenticated;
