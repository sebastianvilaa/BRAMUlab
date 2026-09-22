-- BRAMUlab — Bloque 7 / Fase 2 — verificación transaccional segura de compute_ranking_edition.
-- Requiere que las migraciones 20260922100000..140000 ya estén aplicadas.
-- No deja fixtures: toda mutación (incluidos jugadores/ubicaciones/level_events sintéticos)
-- ocurre entre BEGIN/ROLLBACK. No usa RPCs para fabricar los fixtures (serían docenas de
-- llamadas con cooldown/timing reales); inserta directamente como owner, dentro de la
-- transacción, exactamente lo que el handoff §10 autoriza ("fixtures exclusivamente dentro de
-- transacciones con ROLLBACK").

begin;

-- ------------------------------------------------------------------
-- Helper de fixtures (vive en pg_temp — desaparece solo con el ROLLBACK final, igual que todo
-- lo demás de este script). Crea players+profiles+location_change_events+level_events mínimos
-- para UN jugador de prueba y devuelve su player_id.
-- ------------------------------------------------------------------
create function pg_temp._b7t_make_player(
  p_label text,
  p_location_id uuid,
  p_branch text,
  p_opt_in boolean,
  p_is_active boolean,
  p_excluded boolean,
  p_level_kind text, -- 'none' | 'calibrando' | 'calibrado' | 'recalibrando_ok' | 'recalibrando_bad'
  p_level_internal numeric,
  p_last_rated_at timestamptz,
  p_location_effective_at timestamptz,
  p_ranking_profile_effective_at timestamptz default null -- default: usa p_location_effective_at
) returns uuid language plpgsql as $fn$
declare
  v_player_id uuid;
begin
  -- auth_user_id queda NULL a propósito: es UNIQUE REFERENCES auth.users(id), y estos fixtures
  -- se insertan directo (nunca vía las RPCs de Auth) — un uuid inventado violaría esa FK. Ningún
  -- paso de compute_ranking_edition depende de auth_user_id.
  insert into public.players (player_id, type, auth_user_id, display_name, is_active, ranking_excluded)
  values (gen_random_uuid(), 'registered', null, p_label, p_is_active, p_excluded)
  returning player_id into v_player_id;

  insert into public.profiles (
    player_id, username, first_name, last_name, display_name,
    competitive_branch, location_id, ranking_opt_in, ranking_profile_effective_from
  ) values (
    v_player_id, lower(p_label), p_label, 'Fixture', p_label,
    p_branch, p_location_id, coalesce(p_opt_in, false),
    case when p_location_id is not null or p_branch is not null or p_opt_in is not null
      then coalesce(p_ranking_profile_effective_at, p_location_effective_at) end
  );

  if p_location_id is not null then
    insert into public.location_change_events (player_id, change_type, previous_location_id, new_location_id, effective_at)
    values (v_player_id, 'initial', null, p_location_id, p_location_effective_at);
  end if;

  if p_level_kind = 'calibrando' then
    insert into public.level_events (
      player_id, event_type, algorithm_version, questionnaire_version, questionnaire_mode,
      input_context, result, created_at
    ) values (
      v_player_id, 'initial_estimate', 'nivel_bramu_v1_0', 'v1', 'quick',
      '{}'::jsonb,
      jsonb_build_object('confirmedLevel', p_level_internal, 'confidenceOrigin', 0.3),
      p_last_rated_at
    );
  elsif p_level_kind = 'calibrado' then
    insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
    values (
      v_player_id, 'match_delta', 'nivel_bramu_v1_0',
      jsonb_build_object(
        'muAfter', p_level_internal, 'confidenceAfter', 0.85, 'evidenceUnitsAfter', 6,
        'statusAfter', 'CALIBRADO', 'lastRatedAtAfter', p_last_rated_at
      ),
      p_last_rated_at
    );
  elsif p_level_kind = 'recalibrando_ok' then
    -- Primero un consolidado CALIBRADO real, después el evento que lo tira a RECALIBRANDO con
    -- un valor provisional que NUNCA debe llegar a Ranking (Fase 2, regla crítica del handoff §4).
    insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
    values (
      v_player_id, 'match_delta', 'nivel_bramu_v1_0',
      jsonb_build_object(
        'muAfter', p_level_internal, 'confidenceAfter', 0.85, 'evidenceUnitsAfter', 6,
        'statusAfter', 'CALIBRADO', 'lastRatedAtAfter', p_last_rated_at
      ),
      p_last_rated_at
    );
    insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
    values (
      v_player_id, 'identity_reassignment_delta', 'nivel_bramu_v1_0',
      jsonb_build_object(
        'muAfter', 1.1, 'confidenceAfter', 0.2, 'evidenceUnitsAfter', 1,
        'statusAfter', 'RECALIBRANDO', 'lastRatedAtAfter', p_last_rated_at
      ),
      p_last_rated_at + interval '1 second'
    );
  elsif p_level_kind = 'recalibrando_bad' then
    -- RECALIBRANDO SIN ningún CALIBRADO consolidado previo — no elegible (handoff §4).
    insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
    values (
      v_player_id, 'identity_reassignment_delta', 'nivel_bramu_v1_0',
      jsonb_build_object(
        'muAfter', 1.1, 'confidenceAfter', 0.2, 'evidenceUnitsAfter', 1,
        'statusAfter', 'RECALIBRANDO', 'lastRatedAtAfter', p_last_rated_at
      ),
      p_last_rated_at
    );
  end if;
  -- p_level_kind = 'none': ningún level_event — PENDIENTE por ausencia total.

  return v_player_id;
end;
$fn$;

do $$
declare
  v_cutoff1 timestamptz;
  v_cutoff2 timestamptz;
  v_loc_bv uuid;   -- Bella Vista, AR, verificada — densidad insuficiente (0-4)
  v_loc_ro uuid;   -- Rosario, AR, verificada — forming (6), incluye empate
  v_loc_co uuid;   -- Córdoba, AR, verificada — established (15+)
  v_loc_cl uuid;   -- Santiago, CL, verificada — desbloquea Global
  v_loc_manual uuid; -- ubicación manual, NO verificada
  v_far_past timestamptz;
  v_recent timestamptz;
  v_inactive_past timestamptz;
  v_edition1 public.ranking_editions;
  v_edition1_again public.ranking_editions;
  v_edition2 public.ranking_editions;
  v_row_count_before integer;
  v_row_count_after integer;
  v_p_basic_a uuid; v_p_basic_b uuid;
  v_p_ro1 uuid; v_p_ro2 uuid; v_p_ro3 uuid; v_p_ro4 uuid; v_p_ro5 uuid; v_p_ro6 uuid;
  v_p_calibrando uuid; v_p_recalib_ok uuid; v_p_recalib_bad uuid; v_p_inactive uuid;
  v_p_optout uuid; v_p_unverified uuid; v_p_nobranch uuid; v_p_excluded uuid;
  v_p_inactive_acc uuid; v_p_nolocation uuid; v_p_cl uuid; v_p_stale_profile uuid;
  v_rejected boolean;
  v_rec record;
begin
  -- Cutoff seguro: el lunes 00:00 (America/Argentina/Buenos_Aires) de una semana bien lejana en
  -- el futuro (nunca colisiona con una edición real) — calculado, nunca una fecha adivinada a
  -- mano, para no arriesgar un día que en realidad no sea lunes.
  v_cutoff1 := (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '520 weeks')
                 at time zone 'America/Argentina/Buenos_Aires';
  v_cutoff2 := v_cutoff1 + interval '7 days';
  v_far_past := v_cutoff1 - interval '30 days';
  v_recent := v_cutoff1 - interval '5 days';
  v_inactive_past := v_cutoff1 - interval '200 days';

  -- ------------------------------------------------------------------
  -- Ubicaciones canónicas de prueba.
  -- ------------------------------------------------------------------
  insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
  values ('AR', 'georef', 'verify-b7f2-prov-bv', 'verify-b7f2-loc-bv', 'Buenos Aires', 'Bella Vista', 'Bella Vista, Buenos Aires', true)
  returning location_id into v_loc_bv;
  insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
  values ('AR', 'georef', 'verify-b7f2-prov-sf', 'verify-b7f2-loc-ro', 'Santa Fe', 'Rosario', 'Rosario, Santa Fe', true)
  returning location_id into v_loc_ro;
  insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
  values ('AR', 'georef', 'verify-b7f2-prov-co', 'verify-b7f2-loc-co', 'Córdoba', 'Córdoba', 'Córdoba, Córdoba', true)
  returning location_id into v_loc_co;
  insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
  values ('CL', 'georef', 'verify-b7f2-prov-cl', 'verify-b7f2-loc-cl', 'Metropolitana', 'Santiago', 'Santiago, Metropolitana', true)
  returning location_id into v_loc_cl;
  insert into public.locations (country_code, source, province_label, locality_label, display_label, verified_for_ranking)
  values ('AR', 'manual', 'ProvinciaManual', 'LocalidadManual', 'LocalidadManual, ProvinciaManual', false)
  returning location_id into v_loc_manual;

  -- ------------------------------------------------------------------
  -- Fixtures. Ver pg_temp._b7t_make_player más arriba.
  -- ------------------------------------------------------------------
  v_p_basic_a := pg_temp._b7t_make_player('bv_a', v_loc_bv, 'M', true, true, false, 'calibrado', 6.0, v_recent, v_far_past);
  v_p_basic_b := pg_temp._b7t_make_player('bv_b', v_loc_bv, 'F', true, true, false, 'calibrado', 5.0, v_recent, v_far_past);

  v_p_ro1 := pg_temp._b7t_make_player('ro_1', v_loc_ro, 'M', true, true, false, 'calibrado', 7.0, v_recent, v_far_past);
  v_p_ro2 := pg_temp._b7t_make_player('ro_2', v_loc_ro, 'M', true, true, false, 'calibrado', 6.5, v_recent, v_far_past);
  v_p_ro3 := pg_temp._b7t_make_player('ro_3', v_loc_ro, 'M', true, true, false, 'calibrado', 6.0, v_recent, v_far_past);
  v_p_ro4 := pg_temp._b7t_make_player('ro_4', v_loc_ro, 'F', true, true, false, 'calibrado', 6.0, v_recent, v_far_past);
  v_p_ro5 := pg_temp._b7t_make_player('ro_5', v_loc_ro, 'F', true, true, false, 'calibrado', 5.5, v_recent, v_far_past);
  v_p_ro6 := pg_temp._b7t_make_player('ro_6', v_loc_ro, 'F', true, true, false, 'calibrado', 5.0, v_recent, v_far_past);

  for v_rec in select i, 9.0 - (i * 0.4) as lvl from generate_series(1, 15) as i loop
    perform pg_temp._b7t_make_player('co_' || v_rec.i, v_loc_co, 'M', true, true, false, 'calibrado', v_rec.lvl, v_recent, v_far_past);
  end loop;

  v_p_calibrando := pg_temp._b7t_make_player('calibrando_1', v_loc_bv, 'M', true, true, false, 'calibrando', 4.0, v_recent, v_far_past);
  v_p_recalib_ok := pg_temp._b7t_make_player('recalib_ok_1', v_loc_bv, 'M', true, true, false, 'recalibrando_ok', 5.7, v_recent, v_far_past);
  v_p_recalib_bad := pg_temp._b7t_make_player('recalib_bad_1', v_loc_bv, 'M', true, true, false, 'recalibrando_bad', null, v_recent, v_far_past);
  v_p_inactive := pg_temp._b7t_make_player('inactive_1', v_loc_bv, 'M', true, true, false, 'calibrado', 5.3, v_inactive_past, v_far_past);
  v_p_optout := pg_temp._b7t_make_player('optout_1', v_loc_bv, 'M', false, true, false, 'calibrado', 5.1, v_recent, v_far_past);
  v_p_unverified := pg_temp._b7t_make_player('unverified_1', v_loc_manual, 'M', true, true, false, 'calibrado', 5.2, v_recent, v_far_past);
  v_p_nobranch := pg_temp._b7t_make_player('nobranch_1', v_loc_bv, null, true, true, false, 'calibrado', 5.4, v_recent, v_far_past);
  v_p_excluded := pg_temp._b7t_make_player('excluded_1', v_loc_bv, 'M', true, true, true, 'calibrado', 5.6, v_recent, v_far_past);
  v_p_inactive_acc := pg_temp._b7t_make_player('inactive_acc_1', v_loc_bv, 'M', true, false, false, 'calibrado', 5.8, v_recent, v_far_past);
  v_p_nolocation := pg_temp._b7t_make_player('nolocation_1', null, 'M', true, true, false, 'calibrado', 5.9, v_recent, v_far_past);
  -- ranking_profile_effective_from DESPUÉS del cutoff (handoff §5): branch/opt-in/ubicación
  -- vigentes NO se pueden asumir válidos en ese corte — nunca se usa now()/el valor actual en
  -- silencio, se excluye con reason_code propio.
  v_p_stale_profile := pg_temp._b7t_make_player(
    'stale_profile_1', v_loc_bv, 'M', true, true, false, 'calibrado', 5.4, v_recent,
    v_far_past, v_cutoff1 + interval '1 day'
  );

  -- ==================================================================
  -- 1) Cutoff inválido — nunca lunes 00:00 arbitrario.
  -- ==================================================================
  v_rejected := false;
  begin
    perform public.compute_ranking_edition(v_cutoff1 + interval '1 hour');
  exception when others then
    if sqlerrm = 'invalid_cutoff_not_monday_midnight' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'invalid_cutoff_not_rejected'; end if;

  v_rejected := false;
  begin
    perform public.compute_ranking_edition(v_cutoff1 + interval '1 day');
  exception when others then
    if sqlerrm = 'invalid_cutoff_not_monday_midnight' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'invalid_cutoff_tuesday_not_rejected'; end if;

  -- ==================================================================
  -- 2) Edición real (cutoff1) — Global todavía LOCKED (todos los elegibles son 'AR').
  -- ==================================================================
  select * into v_edition1 from public.compute_ranking_edition(v_cutoff1);
  if v_edition1.period_start_at <> v_cutoff1 - interval '7 days' then raise exception 'period_start_wrong'; end if;

  -- Densidad insuficiente (Bella Vista: bv_a + bv_b elegibles = 2; el resto de Bella Vista NO es
  -- elegible por otros motivos, así que no suma al denominador).
  if not exists (
    select 1 from public.ranking_rows
    where edition_id = v_edition1.edition_id and scope_type = 'local' and player_id = v_p_basic_a
      and is_eligible and position is null and total_eligible = 2 and density_status = 'insufficient'
  ) then raise exception 'insufficient_density_wrong'; end if;

  -- Empate 1,1,3 (en realidad 3,3,5 dentro del grupo de 6 de Rosario) + forming.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_ro1 and position = 1 and total_eligible = 6 and density_status = 'forming'
  ) then raise exception 'forming_top_wrong'; end if;
  if (select count(distinct position) from public.ranking_rows
        where edition_id = v_edition1.edition_id and scope_type = 'local' and player_id in (v_p_ro3, v_p_ro4)) <> 1
  then raise exception 'tie_not_shared'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_ro3 and position = 3
  ) then raise exception 'tie_position_wrong'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_ro5 and position = 5
  ) then raise exception 'tie_next_position_not_skipped'; end if;

  -- Established (Córdoba: 15 elegibles).
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id in (select player_id from public.players where display_name = 'co_1')
      and total_eligible = 15 and density_status = 'established' and position = 1
  ) then raise exception 'established_density_wrong'; end if;

  -- CALIBRANDO sin puesto.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_calibrando and not is_eligible and position is null
      and eligibility_reason_codes ? 'level_not_calibrated'
  ) then raise exception 'calibrando_wrong'; end if;

  -- RECALIBRANDO usa el último consolidado (5.7), NUNCA el provisional (1.1).
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_recalib_ok and is_eligible and level_internal = 5.7 and level_status = 'RECALIBRANDO'
  ) then raise exception 'recalibrando_consolidated_wrong'; end if;

  -- RECALIBRANDO sin consolidado previo: no elegible.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_recalib_bad and not is_eligible
      and eligibility_reason_codes ? 'recalibrating_without_consolidated'
  ) then raise exception 'recalibrando_bad_wrong'; end if;

  -- Inactividad > 180 días.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_inactive and not is_eligible and eligibility_reason_codes ? 'inactive_180_days'
  ) then raise exception 'inactive_180_wrong'; end if;

  -- opt-out.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_optout and not is_eligible and eligibility_reason_codes ? 'ranking_opt_in_false'
  ) then raise exception 'optout_wrong'; end if;

  -- Ubicación no verificada: NO existe fila local/provincial/pais (scope_key inventado
  -- prohibido, handoff §7) pero SÍ existe la fila global con el motivo correcto.
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id
      and player_id = v_p_unverified and scope_type in ('local', 'provincial', 'pais')
  ) then raise exception 'unverified_location_got_territorial_row'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global'
      and player_id = v_p_unverified and not is_eligible and eligibility_reason_codes ? 'location_not_verified'
  ) then raise exception 'unverified_location_reason_wrong'; end if;

  -- rama faltante.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_nobranch and not is_eligible and eligibility_reason_codes ? 'competitive_branch_missing'
  ) then raise exception 'nobranch_wrong'; end if;

  -- cuenta excluida por integridad.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_excluded and not is_eligible and eligibility_reason_codes ? 'account_excluded'
  ) then raise exception 'excluded_account_wrong'; end if;

  -- perfil de Ranking modificado DESPUÉS del cutoff: nunca se usa el valor actual en silencio.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_stale_profile and not is_eligible
      and eligibility_reason_codes ? 'profile_data_changed_after_cutoff'
  ) then raise exception 'stale_profile_wrong'; end if;

  -- cuenta inactiva (is_active=false) — SÍ genera fila auditada (a diferencia de
  -- type<>'registered'/sin username, que ni siquiera entran al pool).
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_inactive_acc and not is_eligible and eligibility_reason_codes ? 'account_inactive'
  ) then raise exception 'inactive_account_wrong'; end if;

  -- Sin ubicación en absoluto: mismo tratamiento que no verificada (solo fila global).
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id
      and player_id = v_p_nolocation and scope_type in ('local', 'provincial', 'pais')
  ) then raise exception 'no_location_got_territorial_row'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global'
      and player_id = v_p_nolocation and not is_eligible and eligibility_reason_codes ? 'location_missing'
  ) then raise exception 'no_location_reason_wrong'; end if;

  -- Global bloqueado: un solo país ('AR') entre los elegibles.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global'
      and density_status = 'locked' and position is null
  ) then raise exception 'global_should_be_locked'; end if;
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global' and position is not null
  ) then raise exception 'global_locked_but_has_positions'; end if;

  -- ==================================================================
  -- 3) Idempotencia: mismo cutoff, segunda invocación → misma edición, ninguna fila nueva.
  -- ==================================================================
  select count(*) into v_row_count_before from public.ranking_rows where edition_id = v_edition1.edition_id;
  select * into v_edition1_again from public.compute_ranking_edition(v_cutoff1);
  select count(*) into v_row_count_after from public.ranking_rows where edition_id = v_edition1.edition_id;
  if v_edition1_again.edition_id <> v_edition1.edition_id then raise exception 'idempotency_created_new_edition'; end if;
  if v_row_count_after <> v_row_count_before then raise exception 'idempotency_changed_row_count'; end if;

  -- ==================================================================
  -- 4) Una edición no cambia si después cambia el Nivel LIVE de un jugador ya incluido.
  -- ==================================================================
  insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
  values (
    v_p_basic_a, 'match_delta', 'nivel_bramu_v1_0',
    jsonb_build_object('muAfter', 9.9, 'confidenceAfter', 0.9, 'evidenceUnitsAfter', 7, 'statusAfter', 'CALIBRADO', 'lastRatedAtAfter', now()),
    now()
  );
  perform public.compute_ranking_edition(v_cutoff1);
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and player_id = v_p_basic_a and level_internal = 9.9
  ) then raise exception 'published_edition_changed_after_live_update'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and player_id = v_p_basic_a and level_internal = 6.0
  ) then raise exception 'published_edition_lost_original_value'; end if;

  -- ==================================================================
  -- 5) Global se desbloquea con un segundo país (cutoff2 — el mismo cutoff1 ya está publicado
  --    y es inmutable, así que el desbloqueo se observa en una edición NUEVA).
  -- ==================================================================
  v_p_cl := pg_temp._b7t_make_player('cl_1', v_loc_cl, 'M', true, true, false, 'calibrado', 5.0, v_recent, v_far_past);
  select * into v_edition2 from public.compute_ranking_edition(v_cutoff2);
  if v_edition2.edition_id = v_edition1.edition_id then raise exception 'second_cutoff_reused_first_edition'; end if;
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition2.edition_id and scope_type = 'global' and density_status = 'locked'
  ) then raise exception 'global_still_locked_with_two_countries'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition2.edition_id and scope_type = 'global'
      and player_id = v_p_cl and is_eligible and position is not null
  ) then raise exception 'global_unlocked_but_cl_player_without_position'; end if;

  -- La edición 1 sigue exactamente igual (ninguna edición previa se modifica).
  select count(*) into v_row_count_after from public.ranking_rows where edition_id = v_edition1.edition_id;
  if v_row_count_after <> v_row_count_before then raise exception 'first_edition_mutated_by_second_computation'; end if;
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global' and density_status <> 'locked'
  ) then raise exception 'first_edition_global_lock_changed_retroactively'; end if;

  -- ==================================================================
  -- 6) Seguridad: PUBLIC/anon sin EXECUTE sobre las funciones service-only de Fase 2.
  -- ==================================================================
  if has_function_privilege('public', 'public.compute_ranking_edition(timestamptz)', 'EXECUTE')
     or has_function_privilege('anon', 'public.compute_ranking_edition(timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.compute_ranking_edition(timestamptz)', 'EXECUTE') then
    raise exception 'compute_ranking_edition_execute_too_broad';
  end if;
  if not has_function_privilege('service_role', 'public.compute_ranking_edition(timestamptz)', 'EXECUTE') then
    raise exception 'compute_ranking_edition_service_role_execute_missing';
  end if;
  if has_function_privilege('public', 'public._bloque7_player_ranking_snapshot_as_of(uuid,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public._bloque7_player_ranking_snapshot_as_of(uuid,timestamptz)', 'EXECUTE') then
    raise exception 'ranking_snapshot_helper_execute_too_broad';
  end if;

  -- Ningún REVOKE append-only de Fase 1 se debilitó.
  if has_table_privilege('service_role', 'public.ranking_editions', 'UPDATE')
     or has_table_privilege('service_role', 'public.ranking_editions', 'DELETE')
     or has_table_privilege('service_role', 'public.ranking_rows', 'UPDATE')
     or has_table_privilege('service_role', 'public.ranking_rows', 'DELETE') then
    raise exception 'append_only_privileges_weakened_by_fase2';
  end if;
end $$;

rollback;

select 'BLOQUE 7 FASE 2 OK — rollback limpio' as result;
