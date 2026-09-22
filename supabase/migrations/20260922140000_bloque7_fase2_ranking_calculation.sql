-- BRAMUlab — Bloque 7 (Fase 2): función server-side de cálculo de una edición semanal de
-- Ranking, atómica e idempotente, invocable manualmente en Staging.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{08_Handoff_Fase_2_Claude.md,
-- 09_Resultado_Fase_2_Claude.md}. Todavía NO incluye: pg_cron, RPCs de lectura para frontend,
-- frontend, eliminación de mocks, Production. NO recalcula Nivel BRAMU — lee exclusivamente el
-- ledger ya cerrado de Bloque 3/6 (level_events vía get_player_level_state_as_of, extendido
-- acá) y los datos de perfil/ubicación ya cerrados de Fase 1.
--
-- Resumen de lo que agrega, en orden:
--   1) `ranking_rows.density_status` admite un cuarto valor `'locked'` — Global bloqueado
--      (menos de 2 países elegibles) es un estado DISTINTO de `'insufficient'` (handoff §8:
--      "Global bloqueado con un solo país" es un caso de prueba separado de densidad 0-4).
--      Constraint nueva: `'locked'` solo puede aparecer en `scope_type='global'`.
--   2) `profiles.ranking_profile_effective_from` — instante de servidor desde el que la
--      COMBINACIÓN vigente de `competitive_branch`/`ranking_opt_in`/`location_id` es conocida
--      (handoff §5: "no usar silenciosamente now() para reconstruir un cutoff pasado si el dato
--      pudo haber cambiado después"). `location_effective_from` (Fase 1) solo se actualiza
--      cuando la UBICACIÓN cambia de verdad; esta columna nueva se actualiza en CADA llamada
--      exitosa de `complete_ranking_profile_data`, así que sirve para decidir si la rama/opt-in
--      VIGENTES ya eran ciertos al cutoff o pudieron haber sido distintos.
--   3) `get_player_level_state_as_of` (Bloque 6) se extiende para devolver también
--      `algorithmVersion` — ya existía como columna de `level_events`, pero el helper no la
--      exponía (03_Revision_Central_Analisis.md C-08, confirmado en
--      04_Resultado_Fase_1_Claude.md §7). Mismo `create or replace`, misma firma, ningún GRANT
--      se pierde. Único caller real (`match-officialize-core.ts`) lee campos por nombre — un
--      campo nuevo en el jsonb es aditivo, no rompe nada.
--   4) `complete_ranking_profile_data` (Fase 1) se extiende para escribir
--      `ranking_profile_effective_from = now()` en cada llamada exitosa — mismo cuerpo que
--      `20260922120000_bloque7_fase1_security_hardening.sql` (con su `FOR UPDATE` de F1-C04),
--      más esa única columna nueva en el UPDATE final.
--   5) `_bloque7_player_ranking_snapshot_as_of(player_id, cutoff)` — helper NUEVO, service-only,
--      que resuelve la "regla crítica" del handoff §4: si el estado as-of-cutoff es
--      RECALIBRANDO, usa el último Nivel CONSOLIDADO (statusAfter='CALIBRADO') anterior al
--      cutoff, nunca el valor provisional; si no existe consolidado anterior, no es elegible.
--   6) `compute_ranking_edition(p_cutoff)` — la función de Fase 2 en sí.
--
-- RLS/privilegios: ningún cambio a las políticas de Fase 1. Las dos funciones nuevas son
-- service-only (revoke all from public, grant execute solo a service_role) — igual criterio que
-- get_player_level_state_as_of. No se debilita ningún REVOKE append-only de Fase 1: esta función
-- solo hace INSERT sobre ranking_editions/ranking_rows, nunca UPDATE/DELETE.

-- ------------------------------------------------------------------
-- 1) ranking_rows.density_status admite 'locked' (Global bloqueado)
-- ------------------------------------------------------------------

alter table public.ranking_rows
  drop constraint ranking_rows_density_status_check,
  add constraint ranking_rows_density_status_check
    check (density_status in ('insufficient', 'forming', 'established', 'locked')),
  add constraint ranking_rows_locked_density_only_global
    check (density_status <> 'locked' or scope_type = 'global');

comment on column public.ranking_rows.density_status is
  'Densidad del UNIVERSO (scope_type+scope_key) en esta edición, no del jugador individual
   (Ranking_BRAMU.md §10): insufficient (0-4, sin puestos), forming (5-14, "N de total" sin
   podio), established (15+). locked (Fase 2, handoff §8) es EXCLUSIVO de scope_type=''global''
   cuando todavía no hay elegibles de 2+ países — distinto de insufficient: puede haber muchos
   elegibles y seguir locked mientras sean todos del mismo país. Un jugador is_eligible=true en
   un universo insufficient o locked igual tiene position=NULL.';

-- ------------------------------------------------------------------
-- 2) profiles.ranking_profile_effective_from
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists ranking_profile_effective_from timestamptz;

comment on column public.profiles.ranking_profile_effective_from is
  'Instante de SERVIDOR de la última escritura exitosa de complete_ranking_profile_data para
   este jugador (Fase 2, handoff §5) — se actualiza en TODA llamada exitosa, incluida la que
   reenvía la misma ubicación/rama/opt-in sin cambios reales (a diferencia de
   location_effective_from, que solo se mueve ante un cambio de UBICACIÓN real). Sirve para que
   compute_ranking_edition sepa si competitive_branch/ranking_opt_in VIGENTES ya eran ciertos al
   cutoff de una edición (ranking_profile_effective_from <= cutoff) o pudieron haber sido
   distintos en ese instante (> cutoff, o NULL si nunca se completaron) — en ese segundo caso la
   fila queda excluida con reason_code profile_data_changed_after_cutoff en vez de asumir
   silenciosamente el valor actual. NULL = todavía no se completó ningún dato de Ranking.';

-- ------------------------------------------------------------------
-- 3) get_player_level_state_as_of — agrega algorithmVersion (C-08)
-- ------------------------------------------------------------------

create or replace function public.get_player_level_state_as_of(p_player_id uuid, p_cutoff timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when le.event_type = 'initial_estimate' then jsonb_build_object(
      'mu', (le.result->>'confirmedLevel')::numeric,
      'confidence', (le.result->>'confidenceOrigin')::numeric,
      'evidenceUnits', 0,
      'status', 'CALIBRANDO',
      'lastRatedAt', le.created_at,
      'algorithmVersion', le.algorithm_version
    )
    else jsonb_build_object(
      'mu', (le.result->>'muAfter')::numeric,
      'confidence', (le.result->>'confidenceAfter')::numeric,
      'evidenceUnits', (le.result->>'evidenceUnitsAfter')::numeric,
      'status', le.result->>'statusAfter',
      'lastRatedAt', le.result->>'lastRatedAtAfter',
      'algorithmVersion', le.algorithm_version
    )
  end
  from public.level_events le
  where le.player_id = p_player_id
    and le.created_at < p_cutoff
    and (
      le.event_type = 'initial_estimate'
      or (
        le.result ? 'muAfter' and le.result ? 'confidenceAfter'
        and le.result ? 'evidenceUnitsAfter' and le.result ? 'statusAfter'
        and le.result ? 'lastRatedAtAfter'
      )
    )
  order by le.created_at desc, le.event_id desc
  limit 1;
$$;

comment on function public.get_player_level_state_as_of is
  'Reconstrucción determinística del estado de un jugador ESTRICTAMENTE ANTERIOR a p_cutoff.
   Bloque 7 Fase 2 (03_Revision_Central_Analisis.md C-08): agrega algorithmVersion al jsonb
   devuelto — ya era columna de level_events, faltaba exponerla. NULL si el jugador no tenía
   ningún evento antes de esa fecha. Devuelve el estado LIVE (provisional si RECALIBRANDO) —
   Ranking usa _bloque7_player_ranking_snapshot_as_of para el valor CONSOLIDADO. SOLO
   service_role.';

-- ------------------------------------------------------------------
-- 4) complete_ranking_profile_data — agrega ranking_profile_effective_from (mismo cuerpo de
--    F1-C04, un único UPDATE nuevo)
-- ------------------------------------------------------------------

create or replace function public.complete_ranking_profile_data(
  p_competitive_branch text,
  p_ranking_opt_in boolean,
  p_location_country_code text,
  p_location_province_label text,
  p_location_locality_label text,
  p_location_georef_province_id text default null,
  p_location_georef_locality_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id            uuid;
  v_profile              public.profiles;
  v_source               text;
  v_verified             boolean;
  v_location_id          uuid;
  v_previous_location_id uuid;
  v_change_type          text;
  v_result               public.profiles;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where player_id = v_player_id for update;
  if v_profile is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;
  if v_profile.username is null then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  if p_ranking_opt_in is null then
    raise exception 'ranking_opt_in_required' using errcode = 'P0001';
  end if;

  if p_competitive_branch is null or p_competitive_branch not in ('F', 'M') then
    raise exception 'competitive_branch_invalid' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_location_province_label), '') = '' or coalesce(trim(p_location_locality_label), '') = '' then
    raise exception 'location_required' using errcode = 'P0001';
  end if;

  if p_location_georef_province_id is not null and p_location_georef_locality_id is not null then
    v_source := 'georef';
    v_verified := true;
    select location_id into v_location_id
      from public.locations
      where source = 'georef'
        and georef_province_id = p_location_georef_province_id
        and georef_locality_id = p_location_georef_locality_id;
  else
    v_source := 'manual';
    v_verified := false;
    v_location_id := null;
  end if;

  if v_location_id is null then
    insert into public.locations (
      country_code, source, georef_province_id, georef_locality_id,
      province_label, locality_label, display_label, verified_for_ranking
    ) values (
      coalesce(p_location_country_code, 'AR'), v_source, p_location_georef_province_id, p_location_georef_locality_id,
      trim(p_location_province_label), trim(p_location_locality_label),
      trim(p_location_locality_label) || ', ' || trim(p_location_province_label), v_verified
    )
    on conflict (source, georef_province_id, georef_locality_id) do update
      set updated_at = now()
    returning location_id into v_location_id;
  end if;

  v_previous_location_id := v_profile.location_id;

  if v_previous_location_id is null then
    v_change_type := 'initial';
  elsif v_location_id <> v_previous_location_id then
    if v_profile.location_effective_from is not null
       and now() < v_profile.location_effective_from + interval '30 days' then
      raise exception 'location_change_cooldown' using errcode = 'P0001';
    end if;
    v_change_type := 'update';
  else
    v_change_type := null;
  end if;

  update public.profiles set
    competitive_branch = p_competitive_branch,
    ranking_opt_in = p_ranking_opt_in,
    location_id = v_location_id,
    location_effective_from = case when v_change_type is not null then now() else location_effective_from end,
    -- Fase 2 (handoff §5): SIEMPRE se actualiza, a diferencia de location_effective_from —
    -- refleja "desde cuándo es cierta la combinación vigente de branch/opt-in/ubicación",
    -- incluido un reenvío idempotente que no cambió ninguna de las tres.
    ranking_profile_effective_from = now(),
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_change_type is not null then
    insert into public.location_change_events (player_id, change_type, previous_location_id, new_location_id, effective_at)
    values (v_player_id, v_change_type, v_previous_location_id, v_location_id, now());
  end if;

  return v_result;
end;
$$;

comment on function public.complete_ranking_profile_data is
  'Única vía de escritura de localidad deportiva/competitive_branch/ranking_opt_in. FOR UPDATE
   serializa llamadas concurrentes del mismo jugador (F1-C04). Cooldown de 30 días únicamente
   ante un cambio real de ubicación. Fase 2: además escribe ranking_profile_effective_from=now()
   en cada llamada exitosa, para que compute_ranking_edition pueda decidir si branch/opt-in
   vigentes ya eran ciertos en un cutoff pasado.';

-- ------------------------------------------------------------------
-- 5) _bloque7_player_ranking_snapshot_as_of — Nivel consolidado, nunca provisional
-- ------------------------------------------------------------------

create or replace function public._bloque7_player_ranking_snapshot_as_of(
  p_player_id uuid,
  p_cutoff timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_live jsonb;
  v_status text;
  v_consolidated record;
begin
  v_live := public.get_player_level_state_as_of(p_player_id, p_cutoff);

  if v_live is null then
    -- Sin ningún level_event antes del cutoff (players.type='provisional', o cuenta recién
    -- confirmada sin cuestionario todavía) — nunca se inventa un estado.
    return jsonb_build_object(
      'status', 'PENDIENTE', 'levelInternal', null, 'levelPublic', null,
      'algorithmVersion', null, 'lastComputableAt', null, 'usesConsolidatedFallback', false
    );
  end if;

  v_status := v_live->>'status';

  if v_status = 'CALIBRADO' then
    return jsonb_build_object(
      'status', v_status,
      'levelInternal', (v_live->>'mu')::numeric,
      'levelPublic', round((v_live->>'mu')::numeric, 1),
      'algorithmVersion', v_live->>'algorithmVersion',
      'lastComputableAt', (v_live->>'lastRatedAt')::timestamptz,
      'usesConsolidatedFallback', false
    );
  end if;

  if v_status = 'RECALIBRANDO' then
    -- Regla crítica (handoff §4 / Ranking_BRAMU.md §6.2): el valor provisional de v_live NUNCA
    -- entra al Ranking — se busca el último evento anterior al cutoff cuyo statusAfter ya haya
    -- sido CALIBRADO, mismo ledger append-only, sin recalcular Nivel.
    select le.result, le.algorithm_version
      into v_consolidated
      from public.level_events le
      where le.player_id = p_player_id
        and le.created_at < p_cutoff
        and le.event_type <> 'initial_estimate'
        and le.result->>'statusAfter' = 'CALIBRADO'
      order by le.created_at desc, le.event_id desc
      limit 1;

    if v_consolidated is null then
      -- Sin consolidado anterior: no elegible (handoff §4: "si no existe consolidado anterior,
      -- no es elegible").
      return jsonb_build_object(
        'status', v_status, 'levelInternal', null, 'levelPublic', null,
        'algorithmVersion', null, 'lastComputableAt', null, 'usesConsolidatedFallback', false
      );
    end if;

    return jsonb_build_object(
      'status', v_status,
      'levelInternal', (v_consolidated.result->>'muAfter')::numeric,
      'levelPublic', round((v_consolidated.result->>'muAfter')::numeric, 1),
      'algorithmVersion', v_consolidated.algorithm_version,
      'lastComputableAt', (v_consolidated.result->>'lastRatedAtAfter')::timestamptz,
      'usesConsolidatedFallback', true
    );
  end if;

  -- CALIBRANDO o PENDIENTE: sin Nivel consolidado utilizable para Ranking.
  return jsonb_build_object(
    'status', v_status, 'levelInternal', null, 'levelPublic', null,
    'algorithmVersion', null, 'lastComputableAt', null, 'usesConsolidatedFallback', false
  );
end;
$$;

comment on function public._bloque7_player_ranking_snapshot_as_of is
  'Nivel que Ranking debe usar as-of cutoff (Bloque 7 Fase 2, handoff §4): CALIBRADO usa el
   valor LIVE reconstruido; RECALIBRANDO usa el último CALIBRADO consolidado anterior al cutoff
   (nunca el provisional) o queda sin Nivel si no existe consolidado; CALIBRANDO/PENDIENTE
   siempre sin Nivel. lastComputableAt es actividad de partido real (B6-A-13:
   last_rated_at/lastRatedAtAfter ya es played_at del partido, nunca hora de escritura ni
   timestamp de cuestionario) — nunca se lee de un evento initial_estimate para esto. SOLO
   service_role.';

revoke all on function public._bloque7_player_ranking_snapshot_as_of(uuid, timestamptz) from public;
grant execute on function public._bloque7_player_ranking_snapshot_as_of(uuid, timestamptz) to service_role;

-- ------------------------------------------------------------------
-- 6) compute_ranking_edition — Fase 2
-- ------------------------------------------------------------------

create or replace function public.compute_ranking_edition(p_cutoff timestamptz)
returns public.ranking_editions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_ts           timestamp;
  v_period_start        timestamptz;
  v_period_end           timestamptz;
  v_edition              public.ranking_editions;
  v_rules_version        text := 'ranking_v1';
  v_distinct_countries   integer;
  v_global_unlocked      boolean;
begin
  -- Contrato temporal (handoff §3): el cutoff recibido debe ser EXACTAMENTE lunes 00:00:00 en
  -- America/Argentina/Buenos_Aires — nunca se acepta un timestamp arbitrario como edición
  -- oficial. `AT TIME ZONE` con el nombre real de la zona (no un offset fijo a mano) para que
  -- Postgres resuelva la conversión desde su propia base de datos de zonas horarias.
  v_local_ts := p_cutoff at time zone 'America/Argentina/Buenos_Aires';
  if extract(dow from v_local_ts) <> 1 or v_local_ts::time <> '00:00:00'::time then
    raise exception 'invalid_cutoff_not_monday_midnight' using errcode = 'P0001';
  end if;

  v_period_start := p_cutoff - interval '7 days';
  v_period_end := p_cutoff - interval '1 microsecond';

  -- Idempotencia/concurrencia (handoff §9): se intenta el INSERT primero, antes de calcular
  -- ninguna fila. El unique (period_start_at) ya existente de Fase 1 es el único mecanismo de
  -- exclusión que hace falta — Postgres serializa dos INSERT concurrentes para el mismo valor
  -- único a nivel de índice (el segundo espera al primero y después falla con
  -- unique_violation), así que no hace falta un lock explícito aparte. Si ya existe, se
  -- devuelve la edición existente TAL CUAL, sin tocar ni recalcular ninguna fila — una edición
  -- histórica nunca se reescribe.
  begin
    insert into public.ranking_editions (period_start_at, period_end_at, ranking_rules_version)
    values (v_period_start, v_period_end, v_rules_version)
    returning * into v_edition;
  exception when unique_violation then
    select * into v_edition from public.ranking_editions where period_start_at = v_period_start;
    return v_edition;
  end;

  -- ------------------------------------------------------------------
  -- Candidatos: cuentas registradas, activas, con perfil mínimo completo y sin exclusión de
  -- integridad (handoff §6). is_active/ranking_excluded se leen EN VIVO a propósito: ninguna
  -- RPC existente los escribe todavía (verificado por grep antes de Fase 1/Fase 2), así que no
  -- hay drift posible que reconstruir — documentado en 09_Resultado_Fase_2_Claude.md §5.
  -- ------------------------------------------------------------------
  -- `IF NOT EXISTS` + TRUNCATE (en vez de un CREATE TEMPORARY TABLE liso): esta función puede
  -- invocarse más de una vez dentro de la MISMA transacción (p. ej. el runner de Fase 2 prueba
  -- varios cutoffs/fixtures dentro de un único BEGIN/ROLLBACK) — `ON COMMIT DROP` recién limpia
  -- al terminar esa transacción, así que una segunda invocación necesita encontrar la tabla
  -- vacía, nunca un CREATE que falle por "ya existe" ni datos residuales de la corrida anterior.
  create temporary table if not exists _b7_candidates (
    player_id                   uuid primary key,
    is_active                   boolean,
    ranking_excluded             boolean,
    competitive_branch          text,
    ranking_opt_in              boolean,
    profile_stable              boolean,
    location_id                 uuid,
    location_verified           boolean,
    location_country_code       text,
    location_province_id        text,
    location_locality_id        text,
    location_display_label      text,
    level_status                text,
    level_internal               numeric,
    level_public                 numeric,
    level_band                   smallint,
    level_algorithm_version      text,
    last_computable_at           timestamptz,
    is_eligible                  boolean,
    reason_codes                 jsonb
  ) on commit drop;
  truncate _b7_candidates;

  -- Nota de alcance (handoff §6/§12 "cuenta excluida con reason code correcto"): `is_active`/
  -- `ranking_excluded` NO filtran el pool acá — se llevan como columnas y se convierten en
  -- reason_codes auditables ('account_inactive'/'account_excluded') más abajo, igual que
  -- ranking_opt_in/competitive_branch/ubicación/Nivel. Lo que SÍ sigue filtrando el pool
  -- (nunca genera fila, ni siquiera para auditar) es `type<>'registered'` (provisionales, que
  -- no son cuentas reales) y `username is null` (perfil mínimo ni siquiera completado todavía,
  -- previo a que exista cualquier noción de Ranking) — ninguno de los dos tiene un reason_code
  -- en el vocabulario del master.
  insert into _b7_candidates (
    player_id, is_active, ranking_excluded, competitive_branch, ranking_opt_in, profile_stable,
    location_id, location_verified, location_country_code, location_province_id,
    location_locality_id, location_display_label,
    level_status, level_internal, level_public, level_band, level_algorithm_version, last_computable_at
  )
  select
    pl.player_id,
    pl.is_active,
    pl.ranking_excluded,
    pr.competitive_branch,
    pr.ranking_opt_in,
    (pr.ranking_profile_effective_from is not null and pr.ranking_profile_effective_from <= p_cutoff),
    loc_hist.location_id_as_of,
    loc.verified_for_ranking,
    loc.country_code,
    loc.georef_province_id,
    loc.georef_locality_id,
    loc.display_label,
    s.snap->>'status',
    (s.snap->>'levelInternal')::numeric,
    (s.snap->>'levelPublic')::numeric,
    case when (s.snap->>'levelPublic') is not null
      then least(10, greatest(1, floor((s.snap->>'levelPublic')::numeric)))::smallint
    end,
    s.snap->>'algorithmVersion',
    (s.snap->>'lastComputableAt')::timestamptz
  from public.players pl
  join public.profiles pr using (player_id)
  cross join lateral (
    select public._bloque7_player_ranking_snapshot_as_of(pl.player_id, p_cutoff) as snap
  ) s
  cross join lateral (
    -- Ubicación AS-OF cutoff, nunca la ubicación VIVA: la última fila de location_change_events
    -- con efecto en o antes del cutoff (Fase 1 la audita en cada alta/cambio real, nunca en un
    -- reenvío idempotente) — si nunca hubo un cambio efectivo antes del cutoff, no hay
    -- ubicación conocida para ESE corte, aunque el jugador tenga una ubicación distinta hoy.
    select lce.new_location_id as location_id_as_of
    from public.location_change_events lce
    where lce.player_id = pl.player_id
      and lce.effective_at <= p_cutoff
    order by lce.effective_at desc, lce.event_id desc
    limit 1
  ) loc_hist
  left join public.locations loc on loc.location_id = loc_hist.location_id_as_of
  where pl.type = 'registered'
    and pr.username is not null;

  -- Motivos de no elegibilidad (handoff §6, "no inventar elegibilidad" + F1-C02 "no son
  -- opcionales") — se acumulan TODOS los que aplican, nunca solo el primero.
  update _b7_candidates set reason_codes = (
    select coalesce(jsonb_agg(code), '[]'::jsonb)
    from (values
      (case when not coalesce(is_active, false) then 'account_inactive' end),
      (case when coalesce(ranking_excluded, false) then 'account_excluded' end),
      (case when not coalesce(ranking_opt_in, false) then 'ranking_opt_in_false' end),
      (case when not profile_stable then 'profile_data_changed_after_cutoff' end),
      (case when competitive_branch is null then 'competitive_branch_missing' end),
      (case when location_id is null then 'location_missing' end),
      (case when location_id is not null and not coalesce(location_verified, false) then 'location_not_verified' end),
      (case when level_status is null or level_status not in ('CALIBRADO', 'RECALIBRANDO') then 'level_not_calibrated' end),
      (case when level_status = 'RECALIBRANDO' and level_internal is null then 'recalibrating_without_consolidated' end),
      (case when level_internal is not null and last_computable_at is not null
              and (p_cutoff - last_computable_at) > interval '180 days' then 'inactive_180_days' end),
      (case when level_internal is not null and last_computable_at is null then 'no_computable_activity' end)
    ) as t(code)
    where code is not null
  );
  update _b7_candidates set is_eligible = (jsonb_array_length(reason_codes) = 0);

  -- ------------------------------------------------------------------
  -- Local / Provincial / País — solo candidatos con ubicación canónica verificada (handoff §7:
  -- "no inventar un scope_key" — sin ubicación verificada, esos 3 scope_type no se construyen).
  -- ------------------------------------------------------------------
  insert into public.ranking_rows (
    edition_id, player_id, scope_type, scope_key, is_eligible, position, tie_group,
    total_eligible, density_status, level_internal, level_public, level_band, level_status,
    level_algorithm_version, last_computable_at, location_id, location_country_code,
    location_province_id, location_locality_id, location_display_label, competitive_branch,
    eligibility_reason_codes, ranking_rules_version
  )
  select
    v_edition.edition_id, u.player_id, u.scope_type, u.scope_key, u.is_eligible,
    case when coalesce(d.total_eligible, 0) <= 4 then null else r.rnk end,
    case when coalesce(d.total_eligible, 0) <= 4 then null else r.rnk end,
    coalesce(d.total_eligible, 0),
    case when coalesce(d.total_eligible, 0) <= 4 then 'insufficient'
         when d.total_eligible <= 14 then 'forming' else 'established' end,
    u.level_internal, u.level_public, u.level_band, u.level_status, u.level_algorithm_version,
    u.last_computable_at, u.location_id, u.location_country_code, u.location_province_id,
    u.location_locality_id, u.location_display_label, u.competitive_branch, u.reason_codes, v_rules_version
  from (
    select c.*, 'local' as scope_type, c.location_id::text as scope_key from _b7_candidates c where c.location_verified
    union all
    select c.*, 'provincial' as scope_type, c.location_country_code || ':' || c.location_province_id as scope_key
      from _b7_candidates c where c.location_verified
    union all
    select c.*, 'pais' as scope_type, c.location_country_code as scope_key from _b7_candidates c where c.location_verified
  ) u
  -- LEFT JOIN a propósito: un scope_key sin NINGÚN elegible (0 de N, p. ej. hoy en Staging,
  -- handoff §10) no debe existir en la subconsulta `d` (su GROUP BY no produce esa fila) — un
  -- JOIN normal descartaría silenciosamente a los candidatos NO elegibles de ese scope_key,
  -- violando F1-C02 ("candidatos no elegibles... no son opcionales"). coalesce(...,0) cubre
  -- ese caso sin inventar un elegible que no existe.
  left join (
    select scope_type, scope_key, count(*) as total_eligible
    from (
      select 'local' as scope_type, c.location_id::text as scope_key from _b7_candidates c where c.location_verified and c.is_eligible
      union all
      select 'provincial', c.location_country_code || ':' || c.location_province_id from _b7_candidates c where c.location_verified and c.is_eligible
      union all
      select 'pais', c.location_country_code from _b7_candidates c where c.location_verified and c.is_eligible
    ) e
    group by scope_type, scope_key
  ) d on d.scope_type = u.scope_type and d.scope_key = u.scope_key
  left join (
    select 'local' as scope_type, c.location_id::text as scope_key, c.player_id,
      rank() over (partition by c.location_id order by c.level_internal desc) as rnk
      from _b7_candidates c where c.location_verified and c.is_eligible
    union all
    select 'provincial', c.location_country_code || ':' || c.location_province_id, c.player_id,
      rank() over (partition by c.location_country_code, c.location_province_id order by c.level_internal desc)
      from _b7_candidates c where c.location_verified and c.is_eligible
    union all
    select 'pais', c.location_country_code, c.player_id,
      rank() over (partition by c.location_country_code order by c.level_internal desc)
      from _b7_candidates c where c.location_verified and c.is_eligible
  ) r on r.scope_type = u.scope_type and r.scope_key = u.scope_key and r.player_id = u.player_id;

  -- ------------------------------------------------------------------
  -- Global — TODOS los candidatos (scope_key='GLOBAL' nunca depende de datos del jugador,
  -- handoff §7); densidad solo se evalúa si el desbloqueo de 2+ países ya ocurrió (handoff §8).
  -- ------------------------------------------------------------------
  select count(distinct location_country_code) into v_distinct_countries
  from _b7_candidates where is_eligible;
  v_global_unlocked := coalesce(v_distinct_countries, 0) >= 2;

  if v_global_unlocked then
    insert into public.ranking_rows (
      edition_id, player_id, scope_type, scope_key, is_eligible, position, tie_group,
      total_eligible, density_status, level_internal, level_public, level_band, level_status,
      level_algorithm_version, last_computable_at, location_id, location_country_code,
      location_province_id, location_locality_id, location_display_label, competitive_branch,
      eligibility_reason_codes, ranking_rules_version
    )
    select
      v_edition.edition_id, c.player_id, 'global', 'GLOBAL', c.is_eligible,
      case when d.total_eligible <= 4 then null else r.rnk end,
      case when d.total_eligible <= 4 then null else r.rnk end,
      coalesce(d.total_eligible, 0),
      case when coalesce(d.total_eligible, 0) <= 4 then 'insufficient'
           when d.total_eligible <= 14 then 'forming' else 'established' end,
      c.level_internal, c.level_public, c.level_band, c.level_status, c.level_algorithm_version,
      c.last_computable_at, c.location_id, c.location_country_code, c.location_province_id,
      c.location_locality_id, c.location_display_label, c.competitive_branch, c.reason_codes, v_rules_version
    from _b7_candidates c
    left join (select count(*) as total_eligible from _b7_candidates where is_eligible) d on true
    left join (
      select player_id, rank() over (order by level_internal desc) as rnk
      from _b7_candidates where is_eligible
    ) r on r.player_id = c.player_id;
  else
    insert into public.ranking_rows (
      edition_id, player_id, scope_type, scope_key, is_eligible, position, tie_group,
      total_eligible, density_status, level_internal, level_public, level_band, level_status,
      level_algorithm_version, last_computable_at, location_id, location_country_code,
      location_province_id, location_locality_id, location_display_label, competitive_branch,
      eligibility_reason_codes, ranking_rules_version
    )
    select
      v_edition.edition_id, c.player_id, 'global', 'GLOBAL', c.is_eligible,
      null, null, 0, 'locked',
      c.level_internal, c.level_public, c.level_band, c.level_status, c.level_algorithm_version,
      c.last_computable_at, c.location_id, c.location_country_code, c.location_province_id,
      c.location_locality_id, c.location_display_label, c.competitive_branch, c.reason_codes, v_rules_version
    from _b7_candidates c;
  end if;

  return v_edition;
end;
$$;

comment on function public.compute_ranking_edition is
  'Fase 2 de Bloque 7 (08_Handoff_Fase_2_Claude.md): construye de forma atómica e idempotente
   una edición semanal completa (ranking_editions + todas sus ranking_rows) para un cutoff dado
   (debe ser lunes 00:00:00 America/Argentina/Buenos_Aires exacto). Nunca recalcula Nivel; usa
   _bloque7_player_ranking_snapshot_as_of para el valor consolidado correcto en RECALIBRANDO.
   Local/Provincial/País requieren ubicación canónica verificada; Global evalúa a TODOS los
   candidatos y queda ''locked'' (sin posiciones) mientras no haya elegibles de 2+ países. Una
   segunda invocación con el mismo cutoff devuelve la edición ya existente sin tocarla. SOLO
   service_role.';

revoke all on function public.compute_ranking_edition(timestamptz) from public;
grant execute on function public.compute_ranking_edition(timestamptz) to service_role;
