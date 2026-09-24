-- Pre-Production P0.1B — Ranking con participación automática (24/09/2026).
--
-- Decisión de producto cerrada (docs/BRAMUlab/Pre_Production.md §"P0.1B", Ranking_BRAMU.md
-- "Actualización del 24 de septiembre de 2026", Experiencia_Inicial.md §2.2): todo jugador
-- activo participa AUTOMÁTICAMENTE del Ranking BRAMU cuando cumple el resto de la elegibilidad
-- vigente (rama competitiva declarada, ubicación verificada, Nivel CALIBRADO/RECALIBRANDO con
-- consolidado, actividad <180 días, sin exclusión de integridad). Ya no existe un opt-in/opt-out
-- ordinario: `ranking_opt_in` deja de decidir elegibilidad y queda como campo legacy de
-- compatibilidad (no se borra ni se migra destructivamente — handoff §3 "no borrar la columna
-- ranking_opt_in si conservarla como legacy reduce riesgo").
--
-- Único cambio real: `public.compute_ranking_edition` (Bloque 7, Fase 2 —
-- 20260922140000_bloque7_fase2_ranking_calculation.sql) ya no agrega el reason_code
-- 'ranking_opt_in_false' cuando `ranking_opt_in` es false/null. Se reemplaza la función COMPLETA
-- vía CREATE OR REPLACE (mismo cuerpo exacto de Fase 2, ver ese archivo, con esa única línea
-- quitada) porque plpgsql no permite parchear una sola expresión dentro de un cuerpo existente.
-- Nada más cambia: candidatos, ubicación, rama, Nivel, actividad de 180 días, densidad,
-- desbloqueo Global, RANK y unicidad de snapshot quedan idénticos a Fase 2.
--
-- `complete_ranking_profile_data` (misma migración de Fase 2) NO se toca: sigue exigiendo
-- `p_ranking_opt_in` no nulo y sigue escribiendo lo que reciba en `profiles.ranking_opt_in` — el
-- frontend simplemente deja de ofrecer un toggle y envía siempre `true` (ver app.js
-- submitRankingGateModal). Preferible a romper una firma ya validada en Staging sin una razón
-- concreta y testeada (handoff §7: "preferir compatibilidad segura sobre ruptura de firma").
--
-- Inmutabilidad de ediciones ya publicadas: `compute_ranking_edition` solo INSERTA
-- `ranking_editions`/`ranking_rows` nuevas (nunca UPDATE de una edición existente, ver el guard
-- de idempotencia al principio de la función) — reemplazar la función no toca ni recalcula
-- ninguna fila ya publicada. Solo las ediciones calculadas DESPUÉS de aplicar esta migración
-- dejan de producir el reason_code 'ranking_opt_in_false'.
--
-- No se agregan RPCs ni tablas nuevas. No se toca `complete_ranking_profile_data`,
-- `_bloque7_player_ranking_snapshot_as_of`, las RPCs de lectura de Fase 3 ni el wrapper de
-- publicación semanal de Fase 4 — todos siguen funcionando exactamente igual, ahora sobre una
-- elegibilidad que ya no excluye por `ranking_opt_in=false`.

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
  -- ranking_opt_in NULL (nunca el valor LIVE de profiles). `ranking_opt_in` se sigue guardando
  -- en el candidato (auditoría/histórico) aunque ya no dispare ningún reason_code por sí solo
  -- (P0.1B, 24/09/2026) — solo `competitive_branch_missing` sigue siendo real acá.
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
  -- P0.1B (24/09/2026) — se retira el brazo 'ranking_opt_in_false': la participación es
  -- automática, `ranking_opt_in` (legacy) ya no excluye a nadie. Una cuenta con
  -- `ranking_opt_in=false` histórico que cumpla el resto de la elegibilidad queda EXACTAMENTE
  -- igual que una con `ranking_opt_in=true` — ninguna otra condición de este bloque cambia.
  update _b7_candidates set reason_codes = (
    select coalesce(jsonb_agg(code), '[]'::jsonb)
    from (values
      (case when not coalesce(is_active, false) then 'account_inactive' end),
      (case when coalesce(ranking_excluded, false) then 'account_excluded' end),
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
  'Fase 2 de Bloque 7 + P0.1B (24/09/2026, participación automática): construye de forma atómica
   e idempotente una edición semanal completa (ranking_editions + todas sus ranking_rows) para un
   cutoff dado (debe ser lunes 00:00:00 America/Argentina/Buenos_Aires exacto). Nunca recalcula
   Nivel; usa _bloque7_player_ranking_snapshot_as_of para el valor consolidado correcto en
   RECALIBRANDO (Nivel consolidado, actividad LIVE — F2-C04). Toda autoridad de denominador/
   RANK/densidad/desbloqueo Global se calcula por scope+scope_key+competitive_branch (F2-C02): M
   y F son clasificaciones totalmente independientes. Local/Provincial/País requieren ubicación
   canónica verificada; Global evalúa a TODOS los candidatos (F2-C01: nunca desaparecen por falta
   de ubicación/branch) y queda ''locked'' por rama mientras esa rama no tenga elegibles de 2+
   países, conservando siempre el total_eligible real (F2-C05). `ranking_opt_in` (legacy) ya NO
   excluye a ningún candidato — la participación es automática para todo el que cumpla el resto
   de la elegibilidad. Una segunda invocación con el mismo cutoff devuelve la edición ya existente
   sin tocarla — ediciones ya publicadas antes de esta migración conservan intacto cualquier
   reason_code ''ranking_opt_in_false'' histórico (snapshot inmutable, nunca se recalcula). SOLO
   service_role.';

revoke all on function public.compute_ranking_edition(timestamptz) from public;
grant execute on function public.compute_ranking_edition(timestamptz) to service_role;
