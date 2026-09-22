-- BRAMUlab — Bloque 7 (Fase 2): función server-side de cálculo de una edición semanal de
-- Ranking, atómica e idempotente, invocable manualmente en Staging.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{08_Handoff_Fase_2_Claude.md,
-- 10_Revision_Central_Fase_2.md, 11_Correccion_Fase_2_Claude.md}. Todavía NO incluye: pg_cron,
-- RPCs de lectura para frontend, frontend, eliminación de mocks, Production. NO recalcula
-- Nivel BRAMU — lee exclusivamente el ledger ya cerrado de Bloque 3/6 (level_events vía
-- get_player_level_state_as_of, extendido acá) y los datos de perfil/ubicación de Fase 1.
--
-- Esta migración NUNCA fue aplicada a ningún entorno (10_Revision_Central_Fase_2.md §10), así
-- que la corrección REEMPLAZA este mismo archivo en vez de agregar parches — no existe ningún
-- estado real que preservar.
--
-- Resumen de lo que agrega, en orden:
--   1) `ranking_rows.density_status` admite un cuarto valor `'locked'` — Global bloqueado
--      (por rama, menos de 2 países elegibles DE ESA RAMA) es un estado DISTINTO de
--      `'insufficient'`. Constraint: `'locked'` solo puede aparecer en `scope_type='global'`.
--   2) `ranking_profile_events` — historial append-only mínimo de `competitive_branch`/
--      `ranking_opt_in` (10_Revision_Central_Fase_2.md F2-C03). Un evento nuevo únicamente
--      cuando alguno de los dos valores CAMBIA de verdad respecto del último evento del
--      jugador (o es la primera vez) — un reenvío idéntico nunca crea un evento nuevo.
--      Reemplaza por completo a `profiles.ranking_profile_effective_from`, que nunca llegó a
--      existir en Supabase y no alcanzaba para reconstruir el estado as-of-cutoff (F2-C03).
--   3) `get_player_level_state_as_of` (Bloque 6) se extiende para devolver también
--      `algorithmVersion` (03_Revision_Central_Analisis.md C-08). Mismo `create or replace`,
--      misma firma, ningún GRANT se pierde.
--   4) `complete_ranking_profile_data` (Fase 1) se extiende para escribir un evento en
--      `ranking_profile_events` solo cuando branch/opt-in cambian de verdad (F2-C03) — ya NO
--      toca `ranking_profile_effective_from` (columna eliminada de este diseño).
--   5) `_bloque7_player_ranking_snapshot_as_of(player_id, cutoff)` — helper service-only:
--      RECALIBRANDO usa el Nivel del último CALIBRADO consolidado, pero la actividad
--      (`lastComputableAt`) del estado LIVE as-of-cutoff — nunca la fecha vieja del evento
--      consolidado (F2-C04: alguien puede seguir jugando partidos computables mientras
--      recalibra, y eso debe contar para la regla de 180 días).
--   6) `compute_ranking_edition(p_cutoff)` — la función de Fase 2. Toda autoridad de
--      denominador/RANK/densidad/desbloqueo Global se calcula por
--      `scope_type + scope_key + competitive_branch` (F2-C02): M y F son clasificaciones
--      totalmente independientes, ninguna altera a la otra. La ubicación as-of-cutoff y el
--      branch/opt-in as-of-cutoff usan `LEFT JOIN LATERAL ... ON true` (F2-C01): un candidato
--      sin ningún evento previo al cutoff NUNCA desaparece de `_b7_candidates` — sigue
--      recibiendo su fila Global auditada con el motivo real (`location_missing`,
--      `competitive_branch_missing`, etc.), nunca una fila Local/Provincial/País inventada.
--
-- RLS/privilegios: ningún cambio a las políticas de Fase 1. `ranking_profile_events` sigue el
-- mismo criterio append-only que `location_change_events` — deny-by-default, `service_role`
-- con SELECT/INSERT únicamente (nunca UPDATE/DELETE, ni siquiera por GRANT explícito esta vez,
-- así no hace falta un REVOKE posterior como en F1-C02). Las funciones nuevas/extendidas son
-- service-only (revoke all from public, grant execute solo a service_role).

-- ------------------------------------------------------------------
-- 1) ranking_rows.density_status admite 'locked' (Global bloqueado por rama)
-- ------------------------------------------------------------------

alter table public.ranking_rows
  drop constraint ranking_rows_density_status_check,
  add constraint ranking_rows_density_status_check
    check (density_status in ('insufficient', 'forming', 'established', 'locked')),
  add constraint ranking_rows_locked_density_only_global
    check (density_status <> 'locked' or scope_type = 'global');

comment on column public.ranking_rows.density_status is
  'Densidad del UNIVERSO (scope_type+scope_key+competitive_branch) en esta edición, no del
   jugador individual (Ranking_BRAMU.md §10/§11): insufficient (0-4, sin puestos), forming
   (5-14, "N de total" sin podio), established (15+). locked (Fase 2, F2-C05) es EXCLUSIVO de
   scope_type=''global'' cuando esa RAMA todavía no tiene elegibles de 2+ países — distinto de
   insufficient: puede haber muchos elegibles de esa rama y seguir locked mientras sean todos
   del mismo país. Un jugador is_eligible=true en un universo insufficient o locked igual tiene
   position=NULL, pero total_eligible siempre refleja el conteo REAL de esa rama (F2-C05).';

-- ------------------------------------------------------------------
-- 2) ranking_profile_events — historial append-only de branch/opt-in (F2-C03)
-- ------------------------------------------------------------------

create table public.ranking_profile_events (
  event_id            uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.players (player_id),
  competitive_branch  text not null check (competitive_branch in ('F', 'M')),
  ranking_opt_in      boolean not null,
  -- Timestamp de SERVIDOR únicamente (complete_ranking_profile_data usa now()), igual criterio
  -- que location_change_events.effective_at.
  effective_at        timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

comment on table public.ranking_profile_events is
  'Historial append-only de competitive_branch/ranking_opt_in (Bloque 7, F2-C03 —
   10_Revision_Central_Fase_2.md: "una sola fecha no es historial"). Escritura EXCLUSIVA de
   complete_ranking_profile_data, y SOLO cuando branch u opt-in cambian de verdad respecto del
   último evento del jugador (o es la primera vez) — un reenvío idéntico nunca inserta una fila
   nueva. compute_ranking_edition reconstruye el estado as-of-cutoff tomando el último evento
   con effective_at <= cutoff; sin ningún evento anterior al cutoff, el jugador queda no
   elegible con motivo real (competitive_branch_missing/ranking_opt_in_false), nunca se usa el
   valor LIVE en silencio. La ubicación sigue resolviéndose aparte, vía location_change_events
   (Fase 1), que ya tiene su propio historial correcto.';

create index ranking_profile_events_player_idx
  on public.ranking_profile_events (player_id, effective_at desc);

alter table public.ranking_profile_events enable row level security;
-- Deny-by-default, mismo criterio que location_change_events: uso interno exclusivo de
-- complete_ranking_profile_data (SECURITY DEFINER) y de compute_ranking_edition (lectura).

-- SELECT + INSERT únicamente — nunca se otorga UPDATE/DELETE ni siquiera de entrada (a
-- diferencia de las tablas de Fase 1, que lo otorgaron por error y hubo que revocarlo en
-- F1-C02): append-only real desde el primer día.
grant select, insert on table public.ranking_profile_events to service_role;

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
   ningún evento antes de esa fecha. Devuelve el estado LIVE (provisional si RECALIBRANDO;
   lastRatedAt siempre es actividad computable real, B6-A-13/B6-A-12) — Ranking usa
   _bloque7_player_ranking_snapshot_as_of para el valor de Nivel CONSOLIDADO en RECALIBRANDO.
   SOLO service_role.';

-- ------------------------------------------------------------------
-- 4) complete_ranking_profile_data — escribe ranking_profile_events solo ante cambio real
--    (F2-C03), mantiene FOR UPDATE (F1-C04) y el resto del contrato de Fase 1 sin cambios.
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
  v_player_id             uuid;
  v_profile               public.profiles;
  v_source                text;
  v_verified              boolean;
  v_location_id           uuid;
  v_previous_location_id  uuid;
  v_change_type           text;
  v_result                public.profiles;
  v_last_profile_event    record;
  v_profile_data_changed  boolean;
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
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_change_type is not null then
    insert into public.location_change_events (player_id, change_type, previous_location_id, new_location_id, effective_at)
    values (v_player_id, v_change_type, v_previous_location_id, v_location_id, now());
  end if;

  -- F2-C03: evento de branch/opt-in SOLO ante un cambio real respecto del último evento de
  -- este jugador (o si nunca hubo ninguno) — un reenvío idéntico (mismo branch, mismo opt_in)
  -- nunca crea una fila nueva en ranking_profile_events.
  select competitive_branch, ranking_opt_in into v_last_profile_event
    from public.ranking_profile_events
    where player_id = v_player_id
    order by effective_at desc, event_id desc
    limit 1;

  v_profile_data_changed := (
    v_last_profile_event is null
    or v_last_profile_event.competitive_branch is distinct from p_competitive_branch
    or v_last_profile_event.ranking_opt_in is distinct from p_ranking_opt_in
  );

  if v_profile_data_changed then
    insert into public.ranking_profile_events (player_id, competitive_branch, ranking_opt_in, effective_at)
    values (v_player_id, p_competitive_branch, p_ranking_opt_in, now());
  end if;

  return v_result;
end;
$$;

comment on function public.complete_ranking_profile_data is
  'Única vía de escritura de localidad deportiva/competitive_branch/ranking_opt_in. FOR UPDATE
   serializa llamadas concurrentes del mismo jugador (F1-C04). Cooldown de 30 días únicamente
   ante un cambio real de ubicación (location_change_events, Fase 1). F2-C03: además inserta un
   evento en ranking_profile_events, pero SOLO si branch/opt-in cambiaron de verdad respecto del
   último evento del jugador — un reenvío idéntico no genera historial nuevo.';

-- ------------------------------------------------------------------
-- 5) _bloque7_player_ranking_snapshot_as_of — Nivel consolidado, actividad LIVE (F2-C04)
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
    -- Regla crítica (handoff §4 / Ranking_BRAMU.md §6.2): el Nivel provisional de v_live NUNCA
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
      -- F2-C04: la ACTIVIDAD (para la regla de 180 días) es la del estado LIVE as-of-cutoff,
      -- nunca la fecha del evento consolidado (que puede ser mucho más vieja) — un jugador
      -- puede seguir jugando partidos computables reales mientras recalibra, y eso cuenta.
      'lastComputableAt', (v_live->>'lastRatedAt')::timestamptz,
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
  'Nivel que Ranking debe usar as-of cutoff (Bloque 7 Fase 2, handoff §4, F2-C04): CALIBRADO usa
   el valor LIVE reconstruido; RECALIBRANDO usa el NIVEL del último CALIBRADO consolidado
   anterior al cutoff (nunca el provisional) pero la ACTIVIDAD (lastComputableAt) del estado
   LIVE as-of-cutoff, nunca la fecha del consolidado — alguien puede seguir jugando partidos
   computables reales mientras recalibra. Sin consolidado anterior, sin Nivel utilizable.
   CALIBRANDO/PENDIENTE siempre sin Nivel. lastRatedAt/lastComputableAt siempre es actividad de
   partido real (B6-A-13/B6-A-12), nunca timestamp de cuestionario ni hora de escritura. SOLO
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
  v_local_ts     timestamp;
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_edition      public.ranking_editions;
  v_rules_version text := 'ranking_v1';
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
  -- Candidatos: cuentas registradas, con perfil mínimo completo (handoff §6). is_active/
  -- ranking_excluded se leen EN VIVO a propósito (F2-C07): ninguna RPC existente los escribe
  -- todavía (verificado por grep antes de Fase 1 y de nuevo en esta corrección), así que no
  -- hay drift real que reconstruir hoy — documentado en 11_Correccion_Fase_2_Claude.md §7. No
  -- filtran el pool: se convierten en reason_codes auditables más abajo.
  -- ------------------------------------------------------------------
  -- `IF NOT EXISTS` + TRUNCATE (en vez de un CREATE TEMPORARY TABLE liso): esta función puede
  -- invocarse más de una vez dentro de la MISMA transacción (p. ej. el runner de Fase 2 prueba
  -- varios cutoffs/fixtures dentro de un único BEGIN/ROLLBACK) — `ON COMMIT DROP` recién limpia
  -- al terminar esa transacción, así que una segunda invocación necesita encontrar la tabla
  -- vacía, nunca un CREATE que falle por "ya existe" ni datos residuales de la corrida anterior.
  create temporary table if not exists _b7_candidates (
    player_id               uuid primary key,
    is_active                boolean,
    ranking_excluded         boolean,
    competitive_branch       text,
    ranking_opt_in           boolean,
    location_id              uuid,
    location_verified        boolean,
    location_country_code    text,
    location_province_id     text,
    location_locality_id     text,
    location_display_label   text,
    level_status             text,
    level_internal            numeric,
    level_public              numeric,
    level_band                smallint,
    level_algorithm_version   text,
    last_computable_at        timestamptz,
    is_eligible               boolean,
    reason_codes              jsonb
  ) on commit drop;
  truncate _b7_candidates;

  insert into _b7_candidates (
    player_id, is_active, ranking_excluded, competitive_branch, ranking_opt_in,
    location_id, location_verified, location_country_code, location_province_id,
    location_locality_id, location_display_label,
    level_status, level_internal, level_public, level_band, level_algorithm_version, last_computable_at
  )
  select
    pl.player_id,
    pl.is_active,
    pl.ranking_excluded,
    rpe_hist.competitive_branch,
    rpe_hist.ranking_opt_in,
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
    -- Función escalar: SIEMPRE devuelve exactamente una fila (aunque el jsonb interno sea
    -- NULL) — CROSS JOIN nunca puede descartar al candidato acá, a diferencia de los dos LEFT
    -- JOIN LATERAL de abajo, que sí consultan una tabla real y pueden dar 0 filas.
    select public._bloque7_player_ranking_snapshot_as_of(pl.player_id, p_cutoff) as snap
  ) s
  -- F2-C01: LEFT JOIN ... ON true — un candidato SIN ningún evento de ubicación antes del
  -- cutoff no puede desaparecer de _b7_candidates. Antes era CROSS JOIN LATERAL (0 filas =
  -- candidato descartado por completo, ni siquiera con fila Global) — exactamente el bug real
  -- que dejó 0 filas en Staging con 7 perfiles reales sin ubicación (10_Revision_Central_Fase_2
  -- .md §1/§2).
  left join lateral (
    select lce.new_location_id as location_id_as_of
    from public.location_change_events lce
    where lce.player_id = pl.player_id
      and lce.effective_at <= p_cutoff
    order by lce.effective_at desc, lce.event_id desc
    limit 1
  ) loc_hist on true
  left join public.locations loc on loc.location_id = loc_hist.location_id_as_of
  -- F2-C01 + F2-C03: mismo criterio para branch/opt-in — un candidato sin ningún
  -- ranking_profile_events antes del cutoff sigue en el pool, con competitive_branch/
  -- ranking_opt_in NULL (nunca el valor LIVE de profiles), lo que dispara sus reason_codes
  -- reales (competitive_branch_missing/ranking_opt_in_false) más abajo.
  left join lateral (
    select rpe.competitive_branch, rpe.ranking_opt_in
    from public.ranking_profile_events rpe
    where rpe.player_id = pl.player_id
      and rpe.effective_at <= p_cutoff
    order by rpe.effective_at desc, rpe.event_id desc
    limit 1
  ) rpe_hist on true
  where pl.type = 'registered'
    and pr.username is not null;

  -- Motivos de no elegibilidad (handoff §6, "no inventar elegibilidad" + F1-C02 "no son
  -- opcionales") — se acumulan TODOS los que aplican, nunca solo el primero.
  update _b7_candidates set reason_codes = (
    select coalesce(jsonb_agg(code), '[]'::jsonb)
    from (values
      (case when not coalesce(is_active, false) then 'account_inactive' end),
      (case when coalesce(ranking_excluded, false) then 'account_excluded' end),
      (case when competitive_branch is null then 'competitive_branch_missing' end),
      (case when competitive_branch is not null and not coalesce(ranking_opt_in, false) then 'ranking_opt_in_false' end),
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
  -- "no inventar un scope_key"). F2-C02: denominador/RANK/densidad SIEMPRE particionados
  -- también por competitive_branch — M y F son clasificaciones independientes, ninguna puede
  -- alterar puesto/densidad de la otra.
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
  -- LEFT JOIN a propósito: un (scope_key, competitive_branch) sin NINGÚN elegible no debe
  -- descartar silenciosamente a los candidatos no elegibles de ese grupo (F1-C02). Cuando
  -- u.competitive_branch es NULL (rama faltante), esta comparación nunca matchea — coalesce a 0
  -- más abajo, nunca se inventa un elegible que no existe.
  left join (
    select scope_type, scope_key, competitive_branch, count(*) as total_eligible
    from (
      select 'local' as scope_type, c.location_id::text as scope_key, c.competitive_branch
        from _b7_candidates c where c.location_verified and c.is_eligible
      union all
      select 'provincial', c.location_country_code || ':' || c.location_province_id, c.competitive_branch
        from _b7_candidates c where c.location_verified and c.is_eligible
      union all
      select 'pais', c.location_country_code, c.competitive_branch
        from _b7_candidates c where c.location_verified and c.is_eligible
    ) e
    group by scope_type, scope_key, competitive_branch
  ) d on d.scope_type = u.scope_type and d.scope_key = u.scope_key and d.competitive_branch = u.competitive_branch
  left join (
    select 'local' as scope_type, c.location_id::text as scope_key, c.player_id,
      rank() over (partition by c.location_id, c.competitive_branch order by c.level_internal desc) as rnk
      from _b7_candidates c where c.location_verified and c.is_eligible
    union all
    select 'provincial', c.location_country_code || ':' || c.location_province_id, c.player_id,
      rank() over (partition by c.location_country_code, c.location_province_id, c.competitive_branch order by c.level_internal desc)
      from _b7_candidates c where c.location_verified and c.is_eligible
    union all
    select 'pais', c.location_country_code, c.player_id,
      rank() over (partition by c.location_country_code, c.competitive_branch order by c.level_internal desc)
      from _b7_candidates c where c.location_verified and c.is_eligible
  ) r on r.scope_type = u.scope_type and r.scope_key = u.scope_key and r.player_id = u.player_id;

  -- ------------------------------------------------------------------
  -- Global — TODOS los candidatos (scope_key='GLOBAL' nunca depende de datos del jugador,
  -- handoff §7). F2-C02/F2-C05: desbloqueo (2+ países), densidad y total_eligible se calculan
  -- POR RAMA — dos países de ramas distintas nunca desbloquean mutuamente Global, y total_
  -- eligible siempre es el conteo real de esa rama, incluso mientras está locked.
  -- ------------------------------------------------------------------
  insert into public.ranking_rows (
    edition_id, player_id, scope_type, scope_key, is_eligible, position, tie_group,
    total_eligible, density_status, level_internal, level_public, level_band, level_status,
    level_algorithm_version, last_computable_at, location_id, location_country_code,
    location_province_id, location_locality_id, location_display_label, competitive_branch,
    eligibility_reason_codes, ranking_rules_version
  )
  select
    v_edition.edition_id, c.player_id, 'global', 'GLOBAL', c.is_eligible,
    case when coalesce(gu.unlocked, false) and coalesce(gd.total_eligible, 0) > 4 then gr.rnk end,
    case when coalesce(gu.unlocked, false) and coalesce(gd.total_eligible, 0) > 4 then gr.rnk end,
    coalesce(gd.total_eligible, 0),
    case when not coalesce(gu.unlocked, false) then 'locked'
         when coalesce(gd.total_eligible, 0) <= 4 then 'insufficient'
         when gd.total_eligible <= 14 then 'forming' else 'established' end,
    c.level_internal, c.level_public, c.level_band, c.level_status, c.level_algorithm_version,
    c.last_computable_at, c.location_id, c.location_country_code, c.location_province_id,
    c.location_locality_id, c.location_display_label, c.competitive_branch, c.reason_codes, v_rules_version
  from _b7_candidates c
  left join (
    -- Desbloqueo por rama (F2-C02): 2+ países DISTINTOS entre los elegibles de ESA rama.
    select competitive_branch, count(distinct location_country_code) >= 2 as unlocked
    from _b7_candidates where is_eligible group by competitive_branch
  ) gu on gu.competitive_branch = c.competitive_branch
  left join (
    -- Total elegible real por rama (F2-C05) — se guarda SIEMPRE, locked o no.
    select competitive_branch, count(*) as total_eligible
    from _b7_candidates where is_eligible group by competitive_branch
  ) gd on gd.competitive_branch = c.competitive_branch
  left join (
    select player_id, competitive_branch,
      rank() over (partition by competitive_branch order by level_internal desc) as rnk
    from _b7_candidates where is_eligible
  ) gr on gr.player_id = c.player_id;

  return v_edition;
end;
$$;

comment on function public.compute_ranking_edition is
  'Fase 2 de Bloque 7 (08_Handoff_Fase_2_Claude.md, 10_Revision_Central_Fase_2.md): construye
   de forma atómica e idempotente una edición semanal completa (ranking_editions + todas sus
   ranking_rows) para un cutoff dado (debe ser lunes 00:00:00 America/Argentina/Buenos_Aires
   exacto). Nunca recalcula Nivel; usa _bloque7_player_ranking_snapshot_as_of para el valor
   consolidado correcto en RECALIBRANDO (Nivel consolidado, actividad LIVE — F2-C04). Toda
   autoridad de denominador/RANK/densidad/desbloqueo Global se calcula por scope+scope_key+
   competitive_branch (F2-C02): M y F son clasificaciones totalmente independientes. Local/
   Provincial/País requieren ubicación canónica verificada; Global evalúa a TODOS los
   candidatos (F2-C01: nunca desaparecen por falta de ubicación/branch) y queda ''locked'' por
   rama mientras esa rama no tenga elegibles de 2+ países, conservando siempre el total_eligible
   real (F2-C05). Una segunda invocación con el mismo cutoff devuelve la edición ya existente
   sin tocarla. SOLO service_role.';

revoke all on function public.compute_ranking_edition(timestamptz) from public;
grant execute on function public.compute_ranking_edition(timestamptz) to service_role;
