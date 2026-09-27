-- BRAMUlab — P0.3 corrección central (handoff 28 §3.C, 27/09/2026): presentación anónima segura
-- de Ranking para una identidad ya eliminada.
--
-- Ver docs/BRAMUlab/Implementacion/Pre_Production/29_Resultado_Revision_Central_P0_3_27SEP.md.
--
-- Hallazgo (auditoría exhaustiva de toda función que hace JOIN de `ranking_rows`/`profiles` para
-- resolver nombre): `get_ranking_classification`, `get_my_ranking_position` (de la que
-- `get_home_ranking_insight` es un passthrough literal, se corrige sola) y `get_ranking_network`
-- hacen `join public.profiles pr on pr.player_id = ...` SIN pasar nunca por `public.players` —
-- nunca filtran por `is_active`. Tras `admin_delete_player_account`, esas filas quedan con
-- `pr.display_name`/`pr.username`/`pr.avatar_url` en NULL: un jugador con su posición YA
-- PUBLICADA en una edición semanal (snapshot inmutable, `ranking_rows` nunca se reescribe)
-- aparece en Ranking/Mi red con identidad vacía en vez de una presentación anónima honesta.
--
-- Regla (handoff §3.C): NO TOCAR ni reescribir `ranking_rows` — la inmutabilidad semanal sigue
-- siendo obligatoria; nada de esta migración cambia `position`/`level_public`/`level_band`/
-- `is_eligible`/`density_status`/ninguna otra columna de esa tabla. El fix es EXCLUSIVAMENTE de
-- PRESENTACIÓN en tiempo de lectura: cuando el `player_id` de una fila ya publicada resuelve a un
-- jugador con `players.is_active = false` (hoy el único motivo real de `is_active=false` en todo
-- el esquema es `admin_delete_player_account` — no existe ningún otro código que lo desactive),
-- las 3 funciones devuelven `displayName: 'Jugador eliminado'` y `username`/`avatarUrl: null` en
-- vez de los valores reales de `profiles` — nunca se revela username/avatar de una cuenta
-- eliminada, tal como pide el handoff.
--
-- Las 3 funciones se corrigen con `CREATE OR REPLACE` sobre exactamente la MISMA firma vigente
-- (ningún parámetro nuevo/quitado) — no hace falta `DROP FUNCTION`. El resto de cada cuerpo se
-- preserva carácter por carácter: fórmula/posiciones/densidad/movimiento/elegibilidad no cambian
-- en absoluto, solo la expresión de 3 campos de presentación por fila.
--
-- Ediciones FUTURAS ya excluyen naturalmente al jugador eliminado por el mecanismo existente de
-- elegibilidad (compute_ranking_edition ya excluye is_active=false al armar cada edición nueva,
-- sin cambios en esta migración) — este fix cubre específicamente la edición YA PUBLICADA que
-- congeló su posición antes de la eliminación.

-- ------------------------------------------------------------------
-- 1) get_ranking_classification — filas finales (nunca el total/matchedTotal, que son conteos,
--    no presentación).
-- ------------------------------------------------------------------

create or replace function public.get_ranking_classification(
  p_scope_type text,
  p_competitive_branch text,
  p_level_band integer default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_edition public.ranking_editions;
  v_scope_key text;
  v_total integer;
  v_matched_total integer;
  v_total_eligible integer;
  v_density_status text;
  v_rows jsonb;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_caller_player_id, 'get_ranking_classification', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_scope_type not in ('local', 'provincial', 'pais', 'global') then
    raise exception 'invalid_scope_type' using errcode = 'P0001';
  end if;
  if p_competitive_branch not in ('F', 'M') then
    raise exception 'invalid_competitive_branch' using errcode = 'P0001';
  end if;
  if p_level_band is not null and (p_level_band < 1 or p_level_band > 10) then
    raise exception 'invalid_level_band' using errcode = 'P0001';
  end if;
  if p_limit is null or p_limit <= 0 or p_limit > 100 then p_limit := 50; end if;
  if p_offset is null or p_offset < 0 then p_offset := 0; end if;

  select * into v_edition from public.ranking_editions order by period_start_at desc limit 1;
  if v_edition is null then
    return jsonb_build_object('edition', null, 'scopeType', p_scope_type, 'ownScope', false, 'total', 0, 'rows', '[]'::jsonb);
  end if;

  if p_scope_type = 'global' then
    v_scope_key := 'GLOBAL';
  else
    -- Regla crítica (handoff §4): el scope_key SIEMPRE se resuelve server-side desde la fila
    -- propia del caller en la edición vigente — nunca desde un parámetro del cliente.
    select scope_key into v_scope_key
      from public.ranking_rows
      where edition_id = v_edition.edition_id and player_id = v_caller_player_id and scope_type = p_scope_type
      limit 1;
    if v_scope_key is null then
      return jsonb_build_object(
        'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
        'scopeType', p_scope_type, 'ownScope', false, 'total', 0, 'rows', '[]'::jsonb
      );
    end if;
  end if;

  select count(*) into v_total
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, p_competitive_branch, p_level_band)
    where rank_position is not null;

  -- Densidad/total real de la rama+scope+banda (handoff §10 Ranking_BRAMU §10: "0-4/Comunidad
  -- insuficiente", "locked" de Global): se necesita AUNQUE `rows` quede vacío, para no perder
  -- el motivo por el que no hay puestos. Uniforme en todas las filas de este grupo — basta 1.
  select sr.total_eligible, sr.density_status into v_total_eligible, v_density_status
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, p_competitive_branch, p_level_band) sr
    limit 1;

  select count(*) into v_matched_total
  from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, p_competitive_branch, p_level_band) sr
  join public.profiles pr on pr.player_id = sr.player_id
  where sr.rank_position is not null
    and (
      coalesce(trim(p_search), '') = ''
      or pr.display_name ilike '%' || trim(p_search) || '%'
      or pr.username ilike '%' || trim(p_search) || '%'
    );

  -- P0.3 (handoff 28 §3.C) — join a `players` SOLO para resolver presentación anónima; nunca
  -- toca ranking_rows/densidad/posición. Un jugador eliminado (`not pl.is_active`) nunca matchea
  -- una búsqueda por `p_search` de todos modos (su pr.display_name/username ya son NULL) — el
  -- `case when` acá abajo es lo que evita que, cuando SÍ aparece en un listado sin búsqueda de
  -- texto, se muestre con identidad vacía en vez de "Jugador eliminado".
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'playerId', sr.player_id,
      'displayName', case when pl.is_active then pr.display_name else 'Jugador eliminado' end,
      'username', case when pl.is_active then pr.username else null end,
      'avatarUrl', case when pl.is_active then pr.avatar_url else null end,
      'position', sr.rank_position, 'total', sr.total_eligible,
      'densityStatus', sr.density_status, 'levelPublic', sr.level_public, 'levelBand', sr.level_band,
      'competitiveBranch', sr.competitive_branch, 'location', sr.location_display_label,
      'movement', public._bloque7_compute_movement(
        sr.player_id, v_edition.edition_id, p_scope_type, v_scope_key, p_competitive_branch, p_level_band
      )
    ) as row_data
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, p_competitive_branch, p_level_band) sr
    join public.profiles pr on pr.player_id = sr.player_id
    join public.players pl on pl.player_id = sr.player_id
    where sr.rank_position is not null
      and (
        coalesce(trim(p_search), '') = ''
        or pr.display_name ilike '%' || trim(p_search) || '%'
        or pr.username ilike '%' || trim(p_search) || '%'
      )
    order by sr.rank_position asc, sr.player_id asc
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object(
    'edition', jsonb_build_object(
      'editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at,
      'periodEndAt', v_edition.period_end_at, 'publishedAt', v_edition.published_at,
      'timezone', v_edition.timezone, 'rankingRulesVersion', v_edition.ranking_rules_version
    ),
    'scopeType', p_scope_type, 'scopeKey', v_scope_key, 'ownScope', true,
    'competitiveBranch', p_competitive_branch, 'levelBand', p_level_band,
    'total', v_total, 'matchedTotal', coalesce(v_matched_total, 0),
    'totalEligible', coalesce(v_total_eligible, 0),
    'densityStatus', coalesce(v_density_status, 'insufficient'), 'rows', v_rows
  );
end;
$$;

comment on function public.get_ranking_classification is
  'Clasificación paginada/buscable de Local/Provincial/País/Global (handoff §4/§5/§6/§11).
   scope_key SIEMPRE resuelto server-side desde la fila propia del caller (nunca un parámetro
   del cliente — "Explorar rankings" queda fuera de V1). Solo filas con position IS NOT NULL se
   listan (Ranking_BRAMU.md §6/handoff §6: los no elegibles no aparecen como jugadores
   rankeados). Nunca expone level_internal ni reason_codes. P0.3 (handoff 28 §3.C, 27/09/2026):
   una fila cuyo player_id ya fue anonimizado (players.is_active=false) presenta
   displayName=''Jugador eliminado'' y username/avatarUrl=null, SIN tocar ranking_rows — la
   posición/Nivel/densidad de esa fila siguen siendo el snapshot inmutable original.';

-- ------------------------------------------------------------------
-- 2) get_my_ranking_position — ventana de contexto (contextWindow) alrededor de la fila propia.
--    get_home_ranking_insight es un passthrough literal de esta función (select public.
--    get_my_ranking_position('local', null);) — se corrige solo, sin tocarlo.
-- ------------------------------------------------------------------

create or replace function public.get_my_ranking_position(
  p_scope_type text,
  p_level_band integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_edition public.ranking_editions;
  v_scope_key text;
  v_branch text;
  v_own record;
  v_raw_own record;
  v_fallback_own record;
  v_movement jsonb;
  v_window jsonb;
  v_best_position_before integer;
  v_prev_edition_id uuid;
  v_previous_level_public numeric;
  v_previous_level_band smallint;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_caller_player_id, 'get_my_ranking_position', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if p_scope_type not in ('local', 'provincial', 'pais', 'global') then
    raise exception 'invalid_scope_type' using errcode = 'P0001';
  end if;
  if p_level_band is not null and (p_level_band < 1 or p_level_band > 10) then
    raise exception 'invalid_level_band' using errcode = 'P0001';
  end if;

  select * into v_edition from public.ranking_editions order by period_start_at desc limit 1;
  if v_edition is null then
    return jsonb_build_object('edition', null, 'hasPosition', false);
  end if;

  select rr.level_public, rr.level_band, rr.level_status, rr.competitive_branch,
         rr.is_eligible, rr.eligibility_reason_codes
    into v_fallback_own
  from public.ranking_rows rr
  where rr.edition_id = v_edition.edition_id
    and rr.player_id = v_caller_player_id
    and rr.scope_type = 'global'
  limit 1;

  if p_scope_type = 'global' then
    v_scope_key := 'GLOBAL';
    select competitive_branch into v_branch from public.ranking_rows
      where edition_id = v_edition.edition_id and player_id = v_caller_player_id limit 1;
  else
    select scope_key, competitive_branch into v_scope_key, v_branch
      from public.ranking_rows
      where edition_id = v_edition.edition_id and player_id = v_caller_player_id and scope_type = p_scope_type
      limit 1;
  end if;

  if v_scope_key is null or v_branch is null then
    return jsonb_build_object(
      'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
      'scopeType', p_scope_type, 'hasPosition', false,
      'competitiveBranch', v_fallback_own.competitive_branch,
      'isEligible', coalesce(v_fallback_own.is_eligible, false),
      'levelPublic', v_fallback_own.level_public,
      'levelBand', v_fallback_own.level_band,
      'levelStatus', v_fallback_own.level_status,
      'reasonCodes', coalesce(v_fallback_own.eligibility_reason_codes, '[]'::jsonb),
      'movement', jsonb_build_object('status', 'nuevo', 'delta', null),
      'contextWindow', '[]'::jsonb
    );
  end if;

  select rr.level_public, rr.level_band, rr.level_status, rr.is_eligible, rr.eligibility_reason_codes
    into v_raw_own
  from public.ranking_rows rr
  where rr.edition_id = v_edition.edition_id and rr.player_id = v_caller_player_id
    and rr.scope_type = p_scope_type and rr.scope_key = v_scope_key
  limit 1;

  select rank_position, total_eligible, density_status, level_public, level_band, is_eligible
    into v_own
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, v_branch, p_level_band)
    where player_id = v_caller_player_id;

  if v_own is null then
    return jsonb_build_object(
      'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
      'scopeType', p_scope_type, 'scopeKey', v_scope_key, 'competitiveBranch', v_branch,
      'levelBandFilter', p_level_band, 'hasPosition', false,
      'isEligible', coalesce(v_raw_own.is_eligible, false),
      'levelPublic', coalesce(v_raw_own.level_public, v_fallback_own.level_public),
      'levelBand', coalesce(v_raw_own.level_band, v_fallback_own.level_band),
      'levelStatus', coalesce(v_raw_own.level_status, v_fallback_own.level_status),
      'reasonCodes', coalesce(v_raw_own.eligibility_reason_codes, v_fallback_own.eligibility_reason_codes, '[]'::jsonb),
      'movement', jsonb_build_object('status', 'nuevo', 'delta', null),
      'contextWindow', '[]'::jsonb
    );
  end if;

  v_movement := public._bloque7_compute_movement(v_caller_player_id, v_edition.edition_id, p_scope_type, v_scope_key, v_branch, p_level_band);

  if v_own.rank_position is not null then
    -- P0.3 (handoff 28 §3.C) — join a `players` SOLO para la ventana de contexto, nunca cambia
    -- rank_position/total/densidad (eso viene de _bloque7_scope_rows, intacto).
    select coalesce(jsonb_agg(jsonb_build_object(
        'playerId', sr.player_id,
        'displayName', case when pl.is_active then pr.display_name else 'Jugador eliminado' end,
        'username', case when pl.is_active then pr.username else null end,
        'position', sr.rank_position, 'levelPublic', sr.level_public, 'isSelf', sr.player_id = v_caller_player_id
      ) order by sr.rank_position), '[]'::jsonb) into v_window
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, v_branch, p_level_band) sr
    join public.profiles pr on pr.player_id = sr.player_id
    join public.players pl on pl.player_id = sr.player_id
    where sr.rank_position is not null and sr.rank_position between v_own.rank_position - 2 and v_own.rank_position + 2;
  else
    v_window := '[]'::jsonb;
  end if;

  -- Adición 1 (D01 original): mejor posición histórica del jugador en el MISMO scope_type/
  -- scope_key/competitive_branch, en cualquier edición PUBLICADA anterior a la vigente (nunca la
  -- propia edición actual, nunca una edición futura). `null` sin antecedente elegible previo —
  -- nunca se inventa un valor ni se compara contra `level_band` (el filtro por banda es una
  -- vista derivada, no una dimensión propia de la fila histórica).
  select min(rr2.position) into v_best_position_before
  from public.ranking_rows rr2
  join public.ranking_editions ed2 on ed2.edition_id = rr2.edition_id
  where rr2.player_id = v_caller_player_id
    and rr2.scope_type = p_scope_type
    and rr2.scope_key = v_scope_key
    and rr2.competitive_branch = v_branch
    and rr2.is_eligible
    and rr2.position is not null
    and ed2.published_at is not null
    and ed2.period_start_at < v_edition.period_start_at;

  -- Adición 2 (Revisión Central Fase E, E04/E08): Nivel público/banda del jugador en la edición
  -- COMPARABLE inmediatamente anterior — MISMA resolución de "edición anterior" que ya usa
  -- `_bloque7_compute_movement` (`_bloque7_previous_edition_id`, exactamente 7 días atrás, nunca
  -- una fórmula paralela), filtrada al MISMO scope_key/branch (si el jugador cambió de
  -- territorio/rama entre ediciones, no hay comparación válida y ambos quedan `null`, igual
  -- criterio que la ruptura de comparabilidad de `_bloque7_compute_movement`). `null` sin
  -- edición anterior o sin fila comparable — nunca se inventa un valor.
  v_prev_edition_id := public._bloque7_previous_edition_id(v_edition.edition_id);
  if v_prev_edition_id is not null then
    select rr3.level_public, rr3.level_band into v_previous_level_public, v_previous_level_band
    from public.ranking_rows rr3
    join public.ranking_editions ed3 on ed3.edition_id = rr3.edition_id
    where rr3.player_id = v_caller_player_id
      and rr3.edition_id = v_prev_edition_id
      and rr3.scope_type = p_scope_type
      and rr3.scope_key = v_scope_key
      and rr3.competitive_branch = v_branch
      and ed3.published_at is not null
    limit 1;
  end if;

  return jsonb_build_object(
    'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
    'scopeType', p_scope_type, 'scopeKey', v_scope_key, 'competitiveBranch', v_branch, 'levelBand', p_level_band,
    'hasPosition', v_own.rank_position is not null,
    'position', v_own.rank_position, 'total', v_own.total_eligible, 'densityStatus', v_own.density_status,
    'isEligible', coalesce(v_raw_own.is_eligible, v_own.is_eligible, false),
    'levelPublic', v_own.level_public, 'levelStatus', v_raw_own.level_status,
    'reasonCodes', coalesce(v_raw_own.eligibility_reason_codes, '[]'::jsonb),
    'movement', v_movement, 'contextWindow', v_window,
    'bestPositionBefore', v_best_position_before,
    'ownLevelBand', v_own.level_band,
    'previousLevelPublic', v_previous_level_public,
    'previousLevelBand', v_previous_level_band
  );
end;
$$;

comment on function public.get_my_ranking_position is
  '"Tu posición" (handoff §8): estado propio, puesto/total si existe, movimiento vs. edición
   anterior comparable, ventana de contexto alrededor de la fila propia, y (Bloque 8 Fase E,
   corrección E01/E04) `bestPositionBefore` — mejor posición histórica previa en el mismo
   ámbito — y `ownLevelBand`/`previousLevelPublic`/`previousLevelBand` — Nivel/banda propios de
   la edición comparable anterior — para que Intelligence pueda detectar "primera entrada real",
   "nueva mejor posición" y "cambio de banda pública de Nivel" sin recalcular la clasificación.
   Nunca inventa un puesto para un caller CALIBRANDO/sin ubicación/sin rama. P0.3 (handoff 28
   §3.C, 27/09/2026): un vecino de la ventana de contexto cuyo player_id ya fue anonimizado
   presenta displayName=''Jugador eliminado''/username=null, sin tocar su rank_position/
   levelPublic (ranking_rows intacto).';

-- ------------------------------------------------------------------
-- 3) get_ranking_network — "Mi red" (visible + oculta).
-- ------------------------------------------------------------------

create or replace function public.get_ranking_network(p_competitive_branch text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_edition public.ranking_editions;
  v_related uuid[];
  v_rows jsonb;
  v_hidden_rows jsonb;
  v_hidden_count integer;
  v_visible_count integer;
  v_total_eligible integer;
  v_branch text;
  v_cutoff timestamptz;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_caller_player_id, 'get_ranking_network', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if p_competitive_branch is not null and p_competitive_branch not in ('F', 'M') then
    raise exception 'invalid_competitive_branch' using errcode = 'P0001';
  end if;

  select * into v_edition from public.ranking_editions order by period_start_at desc limit 1;
  if v_edition is null then
    return jsonb_build_object('edition', null, 'total', 0, 'visibleCount', 0, 'rows', '[]'::jsonb, 'hiddenCount', 0, 'hiddenRows', '[]'::jsonb);
  end if;

  v_cutoff := v_edition.period_end_at + interval '1 microsecond';

  if p_competitive_branch is null then
    select rr.competitive_branch into v_branch
    from public.ranking_rows rr
    where rr.edition_id = v_edition.edition_id and rr.player_id = v_caller_player_id
      and rr.scope_type = 'global'
    limit 1;
  else
    v_branch := p_competitive_branch;
  end if;

  if v_branch is null then
    return jsonb_build_object(
      'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
      'competitiveBranch', null, 'total', 0, 'visibleCount', 0, 'rows', '[]'::jsonb,
      'hiddenCount', 0, 'hiddenRows', '[]'::jsonb
    );
  end if;

  -- Relaciones computables AS-OF el cutoff de la edición (handoff §9: "180 días anteriores al
  -- cutoff de la edición, no a now()") — misma fuente que Fase 2 (match_level_results elegibles
  -- y aplicados + matches.played_at), nunca la ubicación/Nivel en vivo.
  select array_agg(distinct mp.player_id) into v_related
  from public.match_level_result_players mlrp0
  join public.match_level_results mlr0
    on mlr0.result_id = mlrp0.result_id and mlr0.eligible
  join public.matches m on m.match_id = mlr0.match_id
  join public.match_level_result_players mp
    on mp.result_id = mlrp0.result_id and mp.player_id <> v_caller_player_id
  where mlrp0.player_id = v_caller_player_id
    and mlr0.computed_at < v_cutoff
    and (mlr0.reverted_at is null or mlr0.reverted_at >= v_cutoff)
    and m.played_at < v_cutoff
    and m.played_at >= v_cutoff - interval '180 days';

  v_related := array_append(coalesce(v_related, array[]::uuid[]), v_caller_player_id);

  -- Mi red usa la fila Global congelada y una sola rama por vista. P0.3 (handoff 28 §3.C) — join
  -- a `players` SOLO para presentación (is_hidden/level_public/is_eligible/competitive_branch
  -- siguen viniendo intactos de ranking_rows).
  with base_network as (
    select rr.player_id, rr.competitive_branch, rr.level_public, rr.level_internal, rr.is_eligible,
           case when pl.is_active then pr.display_name else 'Jugador eliminado' end as display_name,
           case when pl.is_active then pr.username else null end as username,
           exists (
             select 1 from public.ranking_network_hidden h
             where h.player_id = v_caller_player_id and h.hidden_player_id = rr.player_id
           ) as is_hidden
    from public.ranking_rows rr
    join public.profiles pr on pr.player_id = rr.player_id
    join public.players pl on pl.player_id = rr.player_id
    where rr.edition_id = v_edition.edition_id
      and rr.scope_type = 'global'
      and rr.player_id = any(v_related)
      and rr.competitive_branch = v_branch
  ),
  visible_network as (
    select * from base_network where not is_hidden
  ),
  eligible_count as (
    select count(*)::integer as n from visible_network where is_eligible
  ),
  ranked as (
    select player_id, rank() over (order by level_internal desc) as rnk
    from visible_network where is_eligible
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'playerId', n.player_id, 'displayName', n.display_name, 'username', n.username,
      'competitiveBranch', n.competitive_branch, 'levelPublic', n.level_public,
      'isSelf', n.player_id = v_caller_player_id,
      'position', case when (select ec.n from eligible_count ec) <= 2 then null else r.rnk end,
      'total', (select ec.n from eligible_count ec)
    ) order by coalesce(r.rnk, 999999), n.level_public desc nulls last), '[]'::jsonb),
    count(*)::integer,
    count(*) filter (where n.is_eligible)::integer
  into v_rows, v_visible_count, v_total_eligible
  from visible_network n
  left join ranked r on r.player_id = n.player_id;

  with hidden_network as (
    select rr.player_id, rr.competitive_branch, rr.level_public,
           case when pl.is_active then pr.display_name else 'Jugador eliminado' end as display_name,
           case when pl.is_active then pr.username else null end as username
    from public.ranking_rows rr
    join public.profiles pr on pr.player_id = rr.player_id
    join public.players pl on pl.player_id = rr.player_id
    where rr.edition_id = v_edition.edition_id
      and rr.scope_type = 'global'
      and rr.player_id = any(v_related)
      and rr.competitive_branch = v_branch
      and exists (
        select 1 from public.ranking_network_hidden h
        where h.player_id = v_caller_player_id and h.hidden_player_id = rr.player_id
      )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'playerId', h.player_id, 'displayName', h.display_name, 'username', h.username,
      'competitiveBranch', h.competitive_branch, 'levelPublic', h.level_public
    ) order by h.display_name, h.player_id), '[]'::jsonb),
    count(*)::integer
  into v_hidden_rows, v_hidden_count
  from hidden_network h;

  return jsonb_build_object(
    'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
    'competitiveBranch', v_branch,
    'total', coalesce(v_total_eligible, 0), 'visibleCount', coalesce(v_visible_count, 0),
    'rows', v_rows, 'hiddenCount', coalesce(v_hidden_count, 0), 'hiddenRows', v_hidden_rows
  );
end;
$$;

comment on function public.get_ranking_network is
  '"Mi red" V1 (handoff §9): propio usuario + relaciones de partido computable/validado dentro
   de 180 días ANTERIORES al cutoff de la edición (nunca now()). Umbral propio 1-2/3+ (distinto
   del territorial). Nunca materializa otra edición ni recalcula Nivel; usa la fila Global ya
   congelada de cada miembro. Excluye lo que el caller ocultó (ranking_network_hidden),
   presentación pura. P0.3 (handoff 28 §3.C, 27/09/2026): un miembro de la red (visible u
   oculta) cuyo player_id ya fue anonimizado presenta displayName=''Jugador eliminado''/
   username=null, sin tocar su level_public/is_eligible (ranking_rows intacto) — sigue contando
   para total/visibleCount/hiddenCount como corresponde a su fila real.';
