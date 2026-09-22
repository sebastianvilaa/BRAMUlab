-- BRAMUlab — Bloque 7 / Fase 3 — verificación transaccional segura de las RPCs de lectura.
-- Requiere las migraciones 20260922100000..150000 aplicadas. No deja fixtures: toda mutación
-- (jugadores/ubicaciones/level_events/partido sintético/ediciones) ocurre entre BEGIN/ROLLBACK.
--
-- Para las RPCs que resuelven auth.uid() (todas las públicas de Fase 3) se necesita una sesión
-- real impersonada — mismo mecanismo que verify-bloque7-fase1.sql: se toma en préstamo UNA
-- cuenta YA registrada de Staging (username real, auth_user_id real) como "el caller" durante
-- toda la corrida, y se le fabrican fixtures de Ranking directo (nunca vía RPC de escritura,
-- para no depender de cooldowns/tiempos reales). El resto de los jugadores (compañeros de Mi
-- red, jugadores de fondo de la clasificación) son fixtures simples sin auth_user_id, porque
-- nunca son quienes llaman a una RPC — solo se los lee.

begin;

create temporary table _b7f3_caller on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _b7f3_caller) <> 1 then
    raise exception 'verify_b7f3_requires_one_registered_profile';
  end if;
end $$;

-- Helper de fixtures (vive en pg_temp — desaparece con el ROLLBACK final). Mismo criterio que
-- verify-bloque7-fase2.sql: auth_user_id NULL para todo jugador que nunca llama una RPC.
create function pg_temp._b7t_make_player(
  p_label text,
  p_location_id uuid,
  p_branch text,
  p_opt_in boolean,
  p_level_internal numeric,
  p_last_rated_at timestamptz,
  p_location_effective_at timestamptz
) returns uuid language plpgsql as $fn$
declare
  v_player_id uuid;
begin
  insert into public.players (player_id, type, auth_user_id, display_name, is_active, ranking_excluded)
  values (gen_random_uuid(), 'registered', null, p_label, true, false)
  returning player_id into v_player_id;

  insert into public.profiles (player_id, username, first_name, last_name, display_name)
  values (v_player_id, lower(p_label), p_label, 'Fixture', p_label);

  if p_location_id is not null then
    insert into public.location_change_events (player_id, change_type, previous_location_id, new_location_id, effective_at)
    values (v_player_id, 'initial', null, p_location_id, p_location_effective_at);
  end if;

  if p_branch is not null and p_opt_in is not null then
    insert into public.ranking_profile_events (player_id, competitive_branch, ranking_opt_in, effective_at)
    values (v_player_id, p_branch, p_opt_in, p_location_effective_at);
  end if;

  if p_level_internal is not null then
    insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
    values (
      v_player_id, 'match_delta', 'nivel_bramu_v1_0',
      jsonb_build_object(
        'muAfter', p_level_internal, 'confidenceAfter', 0.85, 'evidenceUnitsAfter', 6,
        'statusAfter', 'CALIBRADO', 'lastRatedAtAfter', p_last_rated_at
      ),
      p_last_rated_at
    );
  end if;

  return v_player_id;
end;
$fn$;

-- Da de alta un evento de Nivel adicional para un jugador YA existente (usado para el caller,
-- que sube de Nivel entre las dos ediciones para probar movimiento semanal).
create function pg_temp._b7t_add_level_event(p_player_id uuid, p_level_internal numeric, p_at timestamptz)
returns void language sql as $fn$
  insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
  values (
    p_player_id, 'match_delta', 'nivel_bramu_v1_0',
    jsonb_build_object(
      'muAfter', p_level_internal, 'confidenceAfter', 0.85, 'evidenceUnitsAfter', 6,
      'statusAfter', 'CALIBRADO', 'lastRatedAtAfter', p_at
    ),
    p_at
  );
$fn$;

do $$
declare
  v_caller_id uuid := (select player_id from _b7f3_caller limit 1);
  v_caller_auth text := (select auth_user_id::text from _b7f3_caller limit 1);
  v_cutoff_prev timestamptz;
  v_cutoff_curr timestamptz;
  v_loc_main uuid;
  v_loc_net uuid;
  v_far_past timestamptz;
  v_between timestamptz;
  v_recent timestamptz;
  v_edition_prev public.ranking_editions;
  v_edition_curr public.ranking_editions;
  v_bg1 uuid; v_bg2 uuid; v_bg3 uuid; v_bg4 uuid; v_bg5 uuid; v_bg6 uuid; v_bg7 uuid;
  v_f1 uuid; v_f2 uuid;
  v_net1 uuid; v_net2 uuid;
  v_match_id uuid;
  v_revision_id uuid;
  v_result_id uuid;
  v_resp jsonb;
  v_rejected boolean;
begin
  v_cutoff_curr := (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '520 weeks')
                     at time zone 'America/Argentina/Buenos_Aires';
  v_cutoff_prev := v_cutoff_curr - interval '7 days';
  v_far_past := v_cutoff_prev - interval '30 days';
  v_between := v_cutoff_prev + interval '2 days';
  v_recent := v_cutoff_curr - interval '2 days';

  -- ------------------------------------------------------------------
  -- Ubicaciones + fixtures.
  -- ------------------------------------------------------------------
  insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
  values ('AR', 'georef', 'verify-b7f3-prov-main', 'verify-b7f3-loc-main', 'Buenos Aires', 'Bella Vista', 'Bella Vista, Buenos Aires', true)
  returning location_id into v_loc_main;
  insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
  values ('AR', 'georef', 'verify-b7f3-prov-net', 'verify-b7f3-loc-net', 'Córdoba', 'Córdoba', 'Córdoba, Córdoba', true)
  returning location_id into v_loc_net;

  -- 7 M de fondo en Bella Vista, estables en AMBAS ediciones. Banda 7: bg1(7.9)/bg2(7.6)/
  -- bg3(7.5)/bg4(7.0)/bg5(7.0, empatado con bg4) = 5 → forming, con empate real. Banda 5:
  -- bg6(5.5)/bg7(5.0) = 2 → insuficiente dentro de esa banda.
  v_bg1 := pg_temp._b7t_make_player('bg1', v_loc_main, 'M', true, 7.9, v_far_past, v_far_past);
  v_bg2 := pg_temp._b7t_make_player('bg2', v_loc_main, 'M', true, 7.6, v_far_past, v_far_past);
  v_bg3 := pg_temp._b7t_make_player('bg3', v_loc_main, 'M', true, 7.5, v_far_past, v_far_past);
  v_bg4 := pg_temp._b7t_make_player('bg4', v_loc_main, 'M', true, 7.0, v_far_past, v_far_past);
  v_bg5 := pg_temp._b7t_make_player('bg5', v_loc_main, 'M', true, 7.0, v_far_past, v_far_past);
  v_bg6 := pg_temp._b7t_make_player('bg6', v_loc_main, 'M', true, 5.5, v_far_past, v_far_past);
  v_bg7 := pg_temp._b7t_make_player('bg7', v_loc_main, 'M', true, 5.0, v_far_past, v_far_past);
  -- 2 F de fondo — nunca deben mezclarse con la clasificación M.
  v_f1 := pg_temp._b7t_make_player('bf1', v_loc_main, 'F', true, 6.3, v_far_past, v_far_past);
  v_f2 := pg_temp._b7t_make_player('bf2', v_loc_main, 'F', true, 5.9, v_far_past, v_far_past);
  -- 2 compañeros de Mi red, en OTRA localidad (Mi red no usa umbrales/territorio).
  v_net1 := pg_temp._b7t_make_player('net1', v_loc_net, 'M', true, 4.5, v_far_past, v_far_past);
  v_net2 := pg_temp._b7t_make_player('net2', v_loc_net, 'M', true, 4.2, v_far_past, v_far_past);

  -- El caller: Bella Vista, M, opt-in, Nivel 6.0 ANTES del cutoff previo (banda 6 → único en
  -- esa banda) — sube a 8.0 ENTRE ambos cutoffs (banda 8, por encima incluso de bg1) para
  -- probar movimiento semanal real.
  insert into public.location_change_events (player_id, change_type, previous_location_id, new_location_id, effective_at)
  values (v_caller_id, 'initial', null, v_loc_main, v_far_past);
  insert into public.ranking_profile_events (player_id, competitive_branch, ranking_opt_in, effective_at)
  values (v_caller_id, 'M', true, v_far_past);
  insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
  values (
    v_caller_id, 'match_delta', 'nivel_bramu_v1_0',
    jsonb_build_object('muAfter', 6.0, 'confidenceAfter', 0.85, 'evidenceUnitsAfter', 6, 'statusAfter', 'CALIBRADO', 'lastRatedAtAfter', v_far_past),
    v_far_past
  );

  -- ------------------------------------------------------------------
  -- Partido sintético (caller + net1 + net2) para Mi red — 180 días antes del cutoff vigente.
  -- ------------------------------------------------------------------
  insert into public.matches (
    match_id, created_by_player_id, participant_fingerprint, format_id, played_at,
    status, validation_deadline_at, validated_at
  ) values (
    gen_random_uuid(), v_caller_id, 'verify-b7f3-fingerprint', 'classic', v_recent,
    'validated', v_recent + interval '30 days', v_recent
  ) returning match_id into v_match_id;

  insert into public.match_revisions (
    revision_id, match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at
  ) values (
    gen_random_uuid(), v_match_id, 1, v_caller_id, 'A', 'created', v_recent
  ) returning revision_id into v_revision_id;

  insert into public.match_level_results (
    result_id, match_id, revision_id, trigger, algorithm_version, eligible, reason_codes, effect_status
  ) values (
    gen_random_uuid(), v_match_id, v_revision_id, 'initial', 'nivel_bramu_v1_0', true, '[]'::jsonb, 'applied'
  ) returning result_id into v_result_id;

  insert into public.match_level_result_players (
    result_id, player_id, team, formula_mu_before, formula_confidence_before, formula_state,
    effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
    original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before,
    mu_after, confidence_after
  ) values
    (v_result_id, v_caller_id, 'A', 6.0, 0.8, 'CALIBRADO', 6.0, 0.3, 1.0, 1.0, 0.1, 0.1, 1.0, 6.0, 0.8, 6, 6.1, 0.81),
    (v_result_id, v_net1,      'B', 4.5, 0.8, 'CALIBRADO', 4.5, 0.3, 1.0, 1.0, 0.1, 0.1, 1.0, 4.5, 0.8, 6, 4.6, 0.81),
    (v_result_id, v_net2,      'B', 4.2, 0.8, 'CALIBRADO', 4.2, 0.3, 1.0, 1.0, 0.1, 0.1, 1.0, 4.2, 0.8, 6, 4.3, 0.81),
    (v_result_id, v_f1,        'A', 6.3, 0.8, 'CALIBRADO', 6.3, 0.3, 1.0, 1.0, 0.1, 0.1, 1.0, 6.3, 0.8, 6, 6.4, 0.81);

  -- ------------------------------------------------------------------
  -- Ediciones.
  -- ------------------------------------------------------------------
  select * into v_edition_prev from public.compute_ranking_edition(v_cutoff_prev);
  perform pg_temp._b7t_add_level_event(v_caller_id, 8.0, v_between);
  select * into v_edition_curr from public.compute_ranking_edition(v_cutoff_curr);
  if v_edition_curr.edition_id = v_edition_prev.edition_id then raise exception 'editions_did_not_differ'; end if;

  -- ------------------------------------------------------------------
  -- Impersonar al caller (mismo mecanismo que verify-bloque7-fase1.sql).
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_caller_auth, true);

  -- 1) Edición vigente — no vacía.
  v_resp := public.get_current_ranking_edition();
  if (v_resp->'edition'->>'editionId') <> v_edition_curr.edition_id::text then
    raise exception 'get_current_ranking_edition_wrong: %', v_resp;
  end if;

  -- 2) Clasificación Local — scope propio resuelto server-side, sin filtro de banda: total=8
  --    (7 bg + caller), forming, caller en posición 1 (subió a 8.0, por encima de bg1=7.9).
  v_resp := public.get_ranking_classification('local', 'M', null, null, 50, 0);
  if (v_resp->>'totalEligible')::int <> 8 or (v_resp->>'densityStatus') <> 'forming' then
    raise exception 'classification_local_totals_wrong: %', v_resp;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_resp->'rows') r
    where (r->>'playerId') = v_caller_id::text and (r->>'position')::int = 1
  ) then raise exception 'classification_local_caller_position_wrong: %', v_resp; end if;
  if not exists (
    select 1 from jsonb_array_elements(v_resp->'rows') r
    where (r->>'playerId') = v_caller_id::text
      and (r->'movement'->>'status') = 'movimiento'
      and (r->'movement'->>'delta')::int = 5
  ) then raise exception 'classification_row_movement_missing_or_wrong: %', v_resp; end if;

  -- 3) Rama F totalmente independiente de la clasificación M consultada arriba.
  v_resp := public.get_ranking_classification('local', 'F', null, null, 50, 0);
  if (v_resp->>'totalEligible')::int <> 2 then
    raise exception 'classification_local_f_contaminated_by_m: %', v_resp;
  end if;

  -- 4) Filtro de Nivel recalcula dentro de la banda 7 (bg1,bg2,bg3,bg4,bg5 = 5, forming) con
  --    empate real bg4=bg5.
  v_resp := public.get_ranking_classification('local', 'M', 7, null, 50, 0);
  if (v_resp->>'totalEligible')::int <> 5 or (v_resp->>'densityStatus') <> 'forming' then
    raise exception 'classification_band7_totals_wrong: %', v_resp;
  end if;
  if (select count(distinct r->>'position') from jsonb_array_elements(v_resp->'rows') r
        where (r->>'playerId') in (v_bg4::text, v_bg5::text)) <> 1 then
    raise exception 'classification_band7_tie_wrong: %', v_resp;
  end if;

  -- 5) Búsqueda dentro de la clasificación activa.
  v_resp := public.get_ranking_classification('local', 'M', null, 'bg3', 50, 0);
  if jsonb_array_length(v_resp->'rows') <> 1 or (v_resp->'rows'->0->>'playerId') <> v_bg3::text then
    raise exception 'classification_search_wrong: %', v_resp;
  end if;
  if (v_resp->>'matchedTotal')::int <> 1 then
    raise exception 'classification_search_matched_total_wrong: %', v_resp;
  end if;
  v_rejected := false;
  begin
    perform public.get_ranking_classification('local', 'M', 11, null, 50, 0);
  exception when others then
    if sqlerrm = 'invalid_level_band' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'classification_invalid_band_not_rejected'; end if;

  -- 6) Global M — locked (todo AR, una sola rama a la vez) pero total_eligible real: 7 bg +
  --    caller (Bella Vista) + net1 + net2 (Córdoba, también AR y también M) = 10.
  v_resp := public.get_ranking_classification('global', 'M', null, null, 50, 0);
  if (v_resp->>'densityStatus') <> 'locked' or jsonb_array_length(v_resp->'rows') <> 0 then
    raise exception 'global_should_be_locked: %', v_resp;
  end if;
  if (v_resp->>'totalEligible')::int <> 10 then
    raise exception 'global_locked_total_eligible_wrong: %', v_resp;
  end if;

  -- 7) Tu posición — Local, con puesto + movimiento. Edición anterior (caller a 6.0): bg1(7.9)
  --    =1, bg2(7.6)=2, bg3(7.5)=3, bg4=bg5(7.0)=4,4, caller(6.0)=6 (salta el 5), bg6=7, bg7=8.
  --    Edición vigente (caller a 8.0): caller=1. Movimiento esperado: 6 → 1, delta=+5.
  v_resp := public.get_my_ranking_position('local', null);
  if not (v_resp->>'hasPosition')::boolean or (v_resp->>'position')::int <> 1 then
    raise exception 'my_position_local_wrong: %', v_resp;
  end if;
  if (v_resp->'movement'->>'status') <> 'movimiento' or (v_resp->'movement'->>'delta')::int <> 5 then
    raise exception 'my_position_movement_wrong_expected_up_5: %', v_resp;
  end if;

  -- 8) Tu posición — banda 8 (edición actual): el caller es el único en banda 8 → sin puesto
  --    (insuficiente), y comparado contra la edición anterior (donde estaba en banda 6, sin
  --    fila en banda 8) debe dar 'nuevo' — cambio de banda rompe comparabilidad.
  v_resp := public.get_my_ranking_position('local', 8);
  if (v_resp->>'hasPosition')::boolean then
    raise exception 'my_position_band8_should_have_no_position: %', v_resp;
  end if;
  if (v_resp->'movement'->>'status') <> 'nuevo' then
    raise exception 'my_position_band_change_should_be_nuevo: %', v_resp;
  end if;

  -- 9) Tu posición — Global: sin puesto (locked), pero con estado propio, nunca inventado.
  v_resp := public.get_my_ranking_position('global', null);
  if (v_resp->>'hasPosition')::boolean then
    raise exception 'my_position_global_should_be_locked_no_position: %', v_resp;
  end if;

  -- 10) Home / TU MOMENTO reusa exactamente el mismo contrato que Local sin banda.
  v_resp := public.get_home_ranking_insight();
  if (v_resp->>'position')::int <> 1 then raise exception 'home_insight_wrong: %', v_resp; end if;

  -- 11) Mi red — partido dentro de los 7 días finales de la edición. NULL usa la rama propia M,
  --     por lo que v_f1 (F) no se mezcla. Propio + net1 + net2 = 3 elegibles → puesto.
  v_resp := public.get_ranking_network(null);
  if (v_resp->>'competitiveBranch') <> 'M' or (v_resp->>'total')::int <> 3 then
    raise exception 'network_total_or_default_branch_wrong: %', v_resp;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_resp->'rows') r where (r->>'playerId') = v_caller_id::text and (r->>'isSelf')::boolean
  ) then raise exception 'network_missing_self: %', v_resp; end if;
  if exists (select 1 from jsonb_array_elements(v_resp->'rows') r where (r->>'position') is null) then
    raise exception 'network_3_plus_should_have_positions: %', v_resp;
  end if;
  v_resp := public.get_ranking_network('F');
  if (v_resp->>'competitiveBranch') <> 'F' or (v_resp->>'total')::int <> 1
     or jsonb_array_length(v_resp->'rows') <> 1
     or (v_resp->'rows'->0->>'playerId') <> v_f1::text then
    raise exception 'network_branch_selector_wrong: %', v_resp;
  end if;

  -- 12) Ocultar a net2 → Mi red pasa a 2 (propio + net1) → 1-2 SIN puesto.
  perform public.set_ranking_network_hidden(v_net2, true);
  v_resp := public.get_ranking_network(null);
  if (v_resp->>'total')::int <> 2 or (v_resp->>'hiddenCount')::int <> 1
     or jsonb_array_length(v_resp->'hiddenRows') <> 1
     or (v_resp->'hiddenRows'->0->>'playerId') <> v_net2::text then
    raise exception 'network_hide_wrong: %', v_resp;
  end if;
  if exists (select 1 from jsonb_array_elements(v_resp->'rows') r where (r->>'position') is not null) then
    raise exception 'network_1_2_should_have_no_position: %', v_resp;
  end if;

  -- 13) Restaurar → vuelve a 3.
  perform public.set_ranking_network_hidden(v_net2, false);
  v_resp := public.get_ranking_network(null);
  if (v_resp->>'total')::int <> 3 or (v_resp->>'hiddenCount')::int <> 0
     or jsonb_array_length(v_resp->'hiddenRows') <> 0 then
    raise exception 'network_unhide_wrong: %', v_resp;
  end if;

  -- 14) No puede ocultarse a sí mismo.
  v_rejected := false;
  begin
    perform public.set_ranking_network_hidden(v_caller_id, true);
  exception when others then
    if sqlerrm = 'cannot_hide_self' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'network_hide_self_not_rejected'; end if;

  -- 15) Ocultar/restaurar NO tocó partidos/Nivel/Ranking oficial: la fila oficial del caller
  --     en la edición vigente sigue igual (misma posición que antes de ocultar/restaurar).
  v_resp := public.get_my_ranking_position('local', null);
  if (v_resp->>'position')::int <> 1 then raise exception 'hide_restore_leaked_into_official_ranking: %', v_resp; end if;

  -- 16) Perfil — resumen territorial del jugador OBJETIVO (bg3), nunca del que consulta.
  v_resp := public.get_profile_ranking_summary(v_bg3);
  if ((v_resp->'local')->>'position') is null or ((v_resp->'local')->>'scopeKey') is null
     or ((v_resp->'local')->>'location') is null then
    raise exception 'profile_summary_missing_position_or_territory: %', v_resp;
  end if;

  -- 17) Columnas privadas no expuestas — level_internal/reason_codes/email/auth_user_id nunca
  --     aparecen en ninguna fila pública devuelta hasta acá.
  v_resp := public.get_ranking_classification('local', 'M', null, null, 50, 0);
  if v_resp::text ilike '%levelInternal%' or v_resp::text ilike '%reasonCode%'
     or v_resp::text ilike '%authUserId%' or v_resp::text ilike '%email%' then
    raise exception 'classification_leaked_private_column: %', v_resp;
  end if;

  -- 18) Movimiento compara solo contra la semana inmediatamente anterior. Con una semana
  --     faltante, debe ser Nuevo y no delta contra una edición vieja.
  select * into v_edition_curr from public.compute_ranking_edition(v_cutoff_curr + interval '14 days');
  v_resp := public.get_my_ranking_position('local', null);
  if (v_resp->'movement'->>'status') <> 'nuevo' then
    raise exception 'movement_across_missing_week_should_be_nuevo: %', v_resp;
  end if;

  -- 19) Seguridad: PUBLIC/anon sin EXECUTE; authenticated SÍ.
  if has_function_privilege('public', 'public.get_ranking_classification(text,text,integer,text,integer,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_ranking_classification(text,text,integer,text,integer,integer)', 'EXECUTE') then
    raise exception 'classification_execute_too_broad';
  end if;
  if not has_function_privilege('authenticated', 'public.get_ranking_classification(text,text,integer,text,integer,integer)', 'EXECUTE') then
    raise exception 'classification_authenticated_execute_missing';
  end if;
  if has_function_privilege('public', 'public._bloque7_scope_rows(uuid,text,text,text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public._bloque7_scope_rows(uuid,text,text,text,integer)', 'EXECUTE') then
    raise exception 'scope_rows_helper_execute_too_broad';
  end if;
  if has_table_privilege('service_role', 'public.ranking_network_hidden', 'UPDATE') then
    raise exception 'ranking_network_hidden_update_should_not_exist';
  end if;

  -- 20) Sin edición (no aplica acá porque ya publicamos — se deja como caso estático: el
  --     código de get_current_ranking_edition/get_ranking_classification para "sin edición"
  --     ya se revisó por lectura, no hay forma de simular "0 ediciones en la tabla" sin
  --     borrar las reales de Staging, lo cual está fuera de alcance de este runner).
end $$;

rollback;

select 'BLOQUE 7 FASE 3 OK — rollback limpio' as result;
