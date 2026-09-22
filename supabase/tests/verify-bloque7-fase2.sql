-- BRAMUlab — Bloque 7 / Fase 2 (corrección F2-C01..F2-C07) — verificación transaccional segura
-- de compute_ranking_edition. Requiere las migraciones 20260922100000..140000 (esta última ya
-- corregida) aplicadas. No deja fixtures: toda mutación ocurre entre BEGIN/ROLLBACK. Inserta
-- fixtures directo, como owner, dentro de la transacción (handoff Fase 2 §10) — nunca vía las
-- RPCs de escritura para los ~30 jugadores sintéticos que hacen falta para cubrir cada caso.
--
-- Reemplaza por completo a la versión anterior: esa versión era internamente contradictoria
-- (declaraba Bella Vista con 2 elegibles y en el mismo fixture agregaba un tercer elegible real
-- a esa misma localidad) y no probaba nada de F2-C01/C02/C03/C04/C05 — ver
-- 10_Revision_Central_Fase_2.md §7.

begin;

-- ------------------------------------------------------------------
-- Helper de fixtures (vive en pg_temp — desaparece con el ROLLBACK final).
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
  p_profile_effective_at timestamptz default null,  -- NULL => usa p_location_effective_at
  p_recalib_trigger_at timestamptz default null       -- SOLO 'recalibrando_ok' (default: +1s)
) returns uuid language plpgsql as $fn$
declare
  v_player_id uuid;
  v_trigger_at timestamptz;
begin
  -- auth_user_id queda NULL a propósito: es UNIQUE REFERENCES auth.users(id), y estos fixtures
  -- se insertan directo (nunca vía las RPCs de Auth) — un uuid inventado violaría esa FK. Ningún
  -- paso de compute_ranking_edition depende de auth_user_id.
  insert into public.players (player_id, type, auth_user_id, display_name, is_active, ranking_excluded)
  values (gen_random_uuid(), 'registered', null, p_label, p_is_active, p_excluded)
  returning player_id into v_player_id;

  insert into public.profiles (player_id, username, first_name, last_name, display_name)
  values (v_player_id, lower(p_label), p_label, 'Fixture', p_label);

  if p_location_id is not null then
    insert into public.location_change_events (player_id, change_type, previous_location_id, new_location_id, effective_at)
    values (v_player_id, 'initial', null, p_location_id, p_location_effective_at);
  end if;

  -- F2-C03: solo se escribe ranking_profile_events cuando HAY dato real de rama+opt-in que
  -- registrar — mismo criterio que location_id (p_branch/p_opt_in NULL simula "nunca se
  -- completaron datos de Ranking", nunca un valor LIVE inventado).
  if p_branch is not null and p_opt_in is not null then
    insert into public.ranking_profile_events (player_id, competitive_branch, ranking_opt_in, effective_at)
    values (v_player_id, p_branch, p_opt_in, coalesce(p_profile_effective_at, p_location_effective_at));
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
    -- F2-C04: consolidado CALIBRADO (puede ser viejo) + evento RECALIBRANDO cuya propia
    -- actividad (lastRatedAtAfter) puede ser MUY reciente — Nivel usa el consolidado, la
    -- actividad para los 180 días usa este segundo evento, nunca el primero.
    v_trigger_at := coalesce(p_recalib_trigger_at, p_last_rated_at + interval '1 second');
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
        'statusAfter', 'RECALIBRANDO', 'lastRatedAtAfter', v_trigger_at
      ),
      v_trigger_at
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
  v_loc_bv uuid;    -- Bella Vista, AR — insuficiente (2 M + 2 F, independientes)
  v_loc_ro uuid;    -- Rosario, AR — forming M (6, con empate) + insuficiente F (2)
  v_loc_co uuid;    -- Córdoba, AR — established M (15)
  v_loc_misc uuid;  -- localidad aislada, AR — para elegibles cuyo puesto/densidad no se prueba
  v_loc_manual uuid;-- ubicación manual, NO verificada
  v_loc_cl uuid;    -- Santiago, CL — desbloquea Global SOLO para la rama M
  v_far_past timestamptz;
  v_very_far_past timestamptz;  -- 200 días antes del cutoff (para el consolidado viejo)
  v_recent timestamptz;         -- 5 días antes del cutoff (actividad reciente)
  v_inactive_past timestamptz;  -- 200 días antes del cutoff (para inactividad simple)
  v_edition1 public.ranking_editions;
  v_edition1_again public.ranking_editions;
  v_edition2 public.ranking_editions;
  v_row_count_before integer;
  v_row_count_after integer;
  v_p_bv_m1 uuid; v_p_bv_m2 uuid; v_p_bv_f1 uuid; v_p_bv_f2 uuid;
  v_p_ro_m1 uuid; v_p_ro_m2 uuid; v_p_ro_m3 uuid; v_p_ro_m4 uuid; v_p_ro_m5 uuid; v_p_ro_m6 uuid;
  v_p_ro_f1 uuid; v_p_ro_f2 uuid;
  v_p_calibrando uuid; v_p_recalib_ok uuid; v_p_recalib_bad uuid; v_p_inactive uuid;
  v_p_optout uuid; v_p_unverified uuid; v_p_nobranch uuid; v_p_excluded uuid;
  v_p_inactive_acc uuid; v_p_nolocation uuid; v_p_cl_m1 uuid;
  v_p_stable_history uuid; v_p_branch_changed uuid;
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
  v_very_far_past := v_cutoff1 - interval '200 days';
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
  values ('AR', 'georef', 'verify-b7f2-prov-misc', 'verify-b7f2-loc-misc', 'Misiones', 'Misceláneo', 'Misceláneo, Misiones', true)
  returning location_id into v_loc_misc;
  insert into public.locations (country_code, source, province_label, locality_label, display_label, verified_for_ranking)
  values ('AR', 'manual', 'ProvinciaManual', 'LocalidadManual', 'LocalidadManual, ProvinciaManual', false)
  returning location_id into v_loc_manual;
  insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
  values ('CL', 'georef', 'verify-b7f2-prov-cl', 'verify-b7f2-loc-cl', 'Metropolitana', 'Santiago', 'Santiago, Metropolitana', true)
  returning location_id into v_loc_cl;

  -- ------------------------------------------------------------------
  -- Bella Vista: 2 M + 2 F, cada rama insuficiente POR SU CUENTA (F2-C02).
  -- ------------------------------------------------------------------
  v_p_bv_m1 := pg_temp._b7t_make_player('bv_m1', v_loc_bv, 'M', true, true, false, 'calibrado', 6.0, v_recent, v_far_past);
  v_p_bv_m2 := pg_temp._b7t_make_player('bv_m2', v_loc_bv, 'M', true, true, false, 'calibrado', 5.0, v_recent, v_far_past);
  v_p_bv_f1 := pg_temp._b7t_make_player('bv_f1', v_loc_bv, 'F', true, true, false, 'calibrado', 6.0, v_recent, v_far_past);
  v_p_bv_f2 := pg_temp._b7t_make_player('bv_f2', v_loc_bv, 'F', true, true, false, 'calibrado', 5.0, v_recent, v_far_past);

  -- Resto de fixtures NO elegibles, todos en Bella Vista (nunca alteran su total_eligible=2/2).
  v_p_calibrando := pg_temp._b7t_make_player('calibrando_1', v_loc_bv, 'M', true, true, false, 'calibrando', 4.0, v_recent, v_far_past);
  v_p_recalib_bad := pg_temp._b7t_make_player('recalib_bad_1', v_loc_bv, 'M', true, true, false, 'recalibrando_bad', null, v_recent, v_far_past);
  v_p_inactive := pg_temp._b7t_make_player('inactive_1', v_loc_bv, 'M', true, true, false, 'calibrado', 5.3, v_inactive_past, v_far_past);
  v_p_optout := pg_temp._b7t_make_player('optout_1', v_loc_bv, 'M', false, true, false, 'calibrado', 5.1, v_recent, v_far_past);
  v_p_unverified := pg_temp._b7t_make_player('unverified_1', v_loc_manual, 'M', true, true, false, 'calibrado', 5.2, v_recent, v_far_past);
  v_p_nobranch := pg_temp._b7t_make_player('nobranch_1', v_loc_bv, null, null, true, false, 'calibrado', 5.4, v_recent, v_far_past);
  v_p_excluded := pg_temp._b7t_make_player('excluded_1', v_loc_bv, 'M', true, true, true, 'calibrado', 5.6, v_recent, v_far_past);
  v_p_inactive_acc := pg_temp._b7t_make_player('inactive_acc_1', v_loc_bv, 'M', true, false, false, 'calibrado', 5.8, v_recent, v_far_past);
  v_p_nolocation := pg_temp._b7t_make_player('nolocation_1', null, 'M', true, true, false, 'calibrado', 5.9, v_recent, v_far_past);

  -- ------------------------------------------------------------------
  -- Rosario: 6 M (empate incluido) + 2 F — prueba que agregar F NO altera el forming de M
  -- (F2-C02, independencia dentro del MISMO scope_key).
  -- ------------------------------------------------------------------
  v_p_ro_m1 := pg_temp._b7t_make_player('ro_m1', v_loc_ro, 'M', true, true, false, 'calibrado', 7.0, v_recent, v_far_past);
  v_p_ro_m2 := pg_temp._b7t_make_player('ro_m2', v_loc_ro, 'M', true, true, false, 'calibrado', 6.5, v_recent, v_far_past);
  v_p_ro_m3 := pg_temp._b7t_make_player('ro_m3', v_loc_ro, 'M', true, true, false, 'calibrado', 6.0, v_recent, v_far_past);
  v_p_ro_m4 := pg_temp._b7t_make_player('ro_m4', v_loc_ro, 'M', true, true, false, 'calibrado', 6.0, v_recent, v_far_past);
  v_p_ro_m5 := pg_temp._b7t_make_player('ro_m5', v_loc_ro, 'M', true, true, false, 'calibrado', 5.5, v_recent, v_far_past);
  v_p_ro_m6 := pg_temp._b7t_make_player('ro_m6', v_loc_ro, 'M', true, true, false, 'calibrado', 5.0, v_recent, v_far_past);
  v_p_ro_f1 := pg_temp._b7t_make_player('ro_f1', v_loc_ro, 'F', true, true, false, 'calibrado', 6.2, v_recent, v_far_past);
  v_p_ro_f2 := pg_temp._b7t_make_player('ro_f2', v_loc_ro, 'F', true, true, false, 'calibrado', 5.7, v_recent, v_far_past);

  -- ------------------------------------------------------------------
  -- Córdoba: 15 M — established.
  -- ------------------------------------------------------------------
  for v_rec in select i, 9.0 - (i * 0.4) as lvl from generate_series(1, 15) as i loop
    perform pg_temp._b7t_make_player('co_' || v_rec.i, v_loc_co, 'M', true, true, false, 'calibrado', v_rec.lvl, v_recent, v_far_past);
  end loop;

  -- ------------------------------------------------------------------
  -- Localidad aislada (v_loc_misc): elegibles cuyo puesto/densidad no se prueba — solo se
  -- verifican level_internal/competitive_branch/is_eligible en su fila.
  -- ------------------------------------------------------------------
  -- F2-C04: consolidado CALIBRADO de hace 200 días (5.7) + actividad RECALIBRANDO de hace 5
  -- días — Nivel usa el consolidado viejo, actividad usa la reciente → sigue elegible.
  v_p_recalib_ok := pg_temp._b7t_make_player(
    'recalib_ok_1', v_loc_misc, 'M', true, true, false, 'recalibrando_ok', 5.7,
    v_very_far_past, v_far_past, null, v_recent
  );

  -- F2-C03: historial estable — un solo evento de perfil, mucho antes del cutoff. Sirve de
  -- control (sin esto, no hay nada contra qué comparar el caso "cambia después").
  v_p_stable_history := pg_temp._b7t_make_player('stable_hist_1', v_loc_misc, 'M', true, true, false, 'calibrado', 5.3, v_recent, v_far_past);

  -- F2-C03: branch REAL cambia DESPUÉS del cutoff1 — la reconstrucción de la edición 1 debe
  -- seguir usando el valor de ANTES (M), nunca el valor LIVE actual (F).
  v_p_branch_changed := pg_temp._b7t_make_player('branch_chg_1', v_loc_misc, 'M', true, true, false, 'calibrado', 5.1, v_recent, v_far_past);
  -- effective_at DESPUÉS de cutoff1 Y de cutoff2 a propósito: este fixture prueba únicamente
  -- que un cambio real posterior a cutoff1 no se filtra hacia atrás en la edición 1 (F2-C03).
  -- Si el cambio quedara visible ya en cutoff2, contaminaría el conteo de Global de la sección
  -- 5 (que prueba una preocupación DISTINTA: desbloqueo por país) con un jugador cambiando de
  -- rama entre ediciones — se aísla a propósito más allá de ambos cutoffs de este runner.
  insert into public.ranking_profile_events (player_id, competitive_branch, ranking_opt_in, effective_at)
  values (v_p_branch_changed, 'F', true, v_cutoff2 + interval '1 day');

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
  -- 2) Edición real (cutoff1) — Global LOCKED para ambas ramas (todo AR).
  -- ==================================================================
  select * into v_edition1 from public.compute_ranking_edition(v_cutoff1);
  if v_edition1.period_start_at <> v_cutoff1 - interval '7 days' then raise exception 'period_start_wrong'; end if;

  -- F2-C02: Bella Vista M y F, cada uno insuficiente CON SU PROPIO denominador de 2.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_bv_m1 and is_eligible and position is null and total_eligible = 2
      and density_status = 'insufficient' and competitive_branch = 'M'
  ) then raise exception 'bv_m_density_wrong'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_bv_f1 and is_eligible and position is null and total_eligible = 2
      and density_status = 'insufficient' and competitive_branch = 'F'
  ) then raise exception 'bv_f_density_wrong'; end if;

  -- F2-C02: Rosario M sigue en total_eligible=6/forming AUNQUE existan 2 F en la misma
  -- localidad; Rosario F es su propio universo insuficiente de 2.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_ro_m1 and position = 1 and total_eligible = 6 and density_status = 'forming'
  ) then raise exception 'ro_m_forming_wrong_or_contaminated_by_f'; end if;
  if (select count(distinct position) from public.ranking_rows
        where edition_id = v_edition1.edition_id and scope_type = 'local' and player_id in (v_p_ro_m3, v_p_ro_m4)) <> 1
  then raise exception 'tie_not_shared'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_ro_m3 and position = 3
  ) then raise exception 'tie_position_wrong'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_ro_m5 and position = 5
  ) then raise exception 'tie_next_position_not_skipped'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_ro_f1 and total_eligible = 2 and density_status = 'insufficient' and competitive_branch = 'F'
  ) then raise exception 'ro_f_density_wrong'; end if;

  -- Established (Córdoba: 15 elegibles, una sola rama, sin contaminación que probar acá).
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

  -- F2-C04: RECALIBRANDO usa el Nivel del consolidado VIEJO (5.7, hace 200 días) pero sigue
  -- elegible porque la ACTIVIDAD (lastComputableAt) es de hace solo 5 días.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_recalib_ok and is_eligible and level_internal = 5.7 and level_status = 'RECALIBRANDO'
      and last_computable_at = v_recent and not (eligibility_reason_codes ? 'inactive_180_days')
  ) then raise exception 'recalibrando_activity_wrong'; end if;

  -- RECALIBRANDO sin consolidado previo: no elegible.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_recalib_bad and not is_eligible
      and eligibility_reason_codes ? 'recalibrating_without_consolidated'
  ) then raise exception 'recalibrando_bad_wrong'; end if;

  -- Inactividad > 180 días (caso simple, sin RECALIBRANDO).
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_inactive and not is_eligible and eligibility_reason_codes ? 'inactive_180_days'
  ) then raise exception 'inactive_180_wrong'; end if;

  -- opt-out.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_optout and not is_eligible and eligibility_reason_codes ? 'ranking_opt_in_false'
  ) then raise exception 'optout_wrong'; end if;

  -- Ubicación no verificada: NO existe fila local/provincial/pais pero SÍ la fila Global.
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

  -- cuenta inactiva (is_active=false) — SÍ genera fila auditada.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_inactive_acc and not is_eligible and eligibility_reason_codes ? 'account_inactive'
  ) then raise exception 'inactive_account_wrong'; end if;

  -- F2-C01: SIN ubicación en absoluto — nunca desaparece; sin fila territorial, SÍ fila global.
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id
      and player_id = v_p_nolocation and scope_type in ('local', 'provincial', 'pais')
  ) then raise exception 'no_location_got_territorial_row'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global'
      and player_id = v_p_nolocation and not is_eligible and eligibility_reason_codes ? 'location_missing'
  ) then raise exception 'no_location_reason_wrong_or_candidate_disappeared'; end if;

  -- F2-C03: historial estable → resuelve M en cutoff1.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_stable_history and is_eligible and competitive_branch = 'M'
  ) then raise exception 'stable_history_wrong'; end if;

  -- F2-C03: el cambio a 'F' pasa DESPUÉS del cutoff1 (cutoff1 + 1 día) — la edición 1 debe
  -- seguir reconstruyendo 'M', el valor vigente ANTES del cutoff, nunca el LIVE actual.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'local'
      and player_id = v_p_branch_changed and is_eligible and competitive_branch = 'M'
  ) then raise exception 'branch_change_after_cutoff_leaked_into_past_edition'; end if;

  -- Global LOCKED para ambas ramas (todo AR) — F2-C05: total_eligible REAL, nunca 0.
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global'
      and competitive_branch = 'M' and density_status = 'locked' and position is null and total_eligible = 26
  ) then raise exception 'global_m_should_be_locked_with_real_total'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global'
      and competitive_branch = 'F' and density_status = 'locked' and position is null and total_eligible = 4
  ) then raise exception 'global_f_should_be_locked_with_real_total'; end if;
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
  -- 4) Inmutabilidad: el Nivel LIVE de un jugador ya publicado cambia DESPUÉS → la edición 1
  --    no se mueve.
  -- ==================================================================
  insert into public.level_events (player_id, event_type, algorithm_version, result, created_at)
  values (
    v_p_bv_m1, 'match_delta', 'nivel_bramu_v1_0',
    jsonb_build_object('muAfter', 9.9, 'confidenceAfter', 0.9, 'evidenceUnitsAfter', 7, 'statusAfter', 'CALIBRADO', 'lastRatedAtAfter', now()),
    now()
  );
  perform public.compute_ranking_edition(v_cutoff1);
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and player_id = v_p_bv_m1 and level_internal = 9.9
  ) then raise exception 'published_edition_changed_after_live_update'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and player_id = v_p_bv_m1 and level_internal = 6.0
  ) then raise exception 'published_edition_lost_original_value'; end if;

  -- ==================================================================
  -- 5) Global se desbloquea con un segundo país — SOLO para la rama M (F2-C02/F2-C05). cutoff2
  --    porque cutoff1 ya está publicado e inmutable.
  -- ==================================================================
  v_p_cl_m1 := pg_temp._b7t_make_player('cl_m1', v_loc_cl, 'M', true, true, false, 'calibrado', 5.0, v_recent, v_far_past);
  select * into v_edition2 from public.compute_ranking_edition(v_cutoff2);
  if v_edition2.edition_id = v_edition1.edition_id then raise exception 'second_cutoff_reused_first_edition'; end if;

  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition2.edition_id and scope_type = 'global'
      and competitive_branch = 'M' and density_status = 'locked'
  ) then raise exception 'global_m_still_locked_with_two_countries'; end if;
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition2.edition_id and scope_type = 'global'
      and player_id = v_p_cl_m1 and is_eligible and position is not null and total_eligible = 27
  ) then raise exception 'global_m_unlocked_but_cl_player_without_position_or_wrong_total'; end if;

  -- La rama F NO se desbloquea por el país nuevo de M (F2-C02: independencia total) — sigue
  -- locked, y su total_eligible sigue siendo el real (4), nunca 0 (F2-C05).
  if not exists (
    select 1 from public.ranking_rows where edition_id = v_edition2.edition_id and scope_type = 'global'
      and competitive_branch = 'F' and density_status = 'locked' and total_eligible = 4 and position is null
  ) then raise exception 'global_f_wrongly_unlocked_by_m_country_or_wrong_total'; end if;

  -- La edición 1 sigue exactamente igual (ninguna edición previa se modifica).
  select count(*) into v_row_count_after from public.ranking_rows where edition_id = v_edition1.edition_id;
  if v_row_count_after <> v_row_count_before then raise exception 'first_edition_mutated_by_second_computation'; end if;
  if exists (
    select 1 from public.ranking_rows where edition_id = v_edition1.edition_id and scope_type = 'global' and density_status <> 'locked'
  ) then raise exception 'first_edition_global_lock_changed_retroactively'; end if;

  -- ==================================================================
  -- 6) Seguridad: PUBLIC/anon sin EXECUTE sobre las funciones service-only de Fase 2; append-
  --    only real sobre ranking_profile_events también.
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

  if has_table_privilege('service_role', 'public.ranking_editions', 'UPDATE')
     or has_table_privilege('service_role', 'public.ranking_editions', 'DELETE')
     or has_table_privilege('service_role', 'public.ranking_rows', 'UPDATE')
     or has_table_privilege('service_role', 'public.ranking_rows', 'DELETE')
     or has_table_privilege('service_role', 'public.ranking_profile_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.ranking_profile_events', 'DELETE') then
    raise exception 'append_only_privileges_weakened_by_fase2';
  end if;
end $$;

rollback;

select 'BLOQUE 7 FASE 2 (corrección F2-C01..F2-C07) OK — rollback limpio' as result;
