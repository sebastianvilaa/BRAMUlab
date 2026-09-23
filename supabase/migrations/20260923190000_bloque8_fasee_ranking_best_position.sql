-- BRAMUlab — Bloque 8 (Fase E): extensión mínima de `get_my_ranking_position` para exponer
-- `bestPositionBefore`, `ownLevelBand`, `previousLevelPublic` y `previousLevelBand`.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_08/25_Handoff_Fase_E_Claude.md §8 (Ranking —
-- hitos materiales cerrados) y 27_Revision_Central_Fase_E.md §5/§8 (E04 — 5to hito cerrado:
-- cambio de banda pública de Nivel BRAMU; ajuste de "solo ediciones publicadas"). Dos de los 5
-- hitos cerrados ("nueva mejor posición" y "cambio de banda pública de Nivel") no son derivables
-- de lo que la RPC ya devolvía (`position`/`movement.delta` solo comparan contra la edición
-- INMEDIATAMENTE anterior, nunca contra el histórico completo; y el `levelBand` que la función
-- ya devolvía era el PARÁMETRO de filtro `p_level_band` — casi siempre `null` para Home — nunca
-- la banda propia del jugador). El handoff/la revisión autorizan explícitamente esta extensión:
-- "si para detectar top 10/mejor posición/cambio de banda hace falta ampliar el contrato
-- server-side, hacerlo mínimamente sobre las tablas/RPC actuales, sin recalcular la
-- clasificación."
--
-- Por qué los campos nuevos NO reusan la clave `levelBand` ya existente: esa clave es el eco del
-- PARÁMETRO `p_level_band` (el filtro de banda que el caller pidió, casi siempre `null` para
-- `get_home_ranking_insight`), nunca la banda propia del jugador — aunque `v_own.level_band` ya
-- se seleccionaba internamente, nunca se exponía. Reusar el mismo nombre para dos cosas
-- distintas habría sido un contrato ambiguo; se agregan `ownLevelBand`/`previousLevelBand` como
-- claves nuevas y sin ambigüedad, sin tocar el significado de `levelBand` para quien ya lo
-- consuma como filtro.
--
-- Esta migración NO recalcula ni cambia ninguna clasificación existente: agrega dos
-- subconsultas de solo lectura (mejor posición histórica; banda/nivel de la edición
-- COMPARABLE inmediatamente anterior, vía `_bloque7_previous_edition_id` — la MISMA función que
-- ya usa `_bloque7_compute_movement`, nunca una fórmula paralela) y 4 campos nuevos al jsonb de
-- salida en el único camino que ya devolvía `hasPosition:true`. El resto de la función es una
-- copia EXACTA de `get_my_ranking_position` tal como quedó en
-- supabase/migrations/20260922150000_bloque7_fase3_read_rpcs.sql — ningún otro comportamiento
-- cambia. Ambas subconsultas nuevas filtran explícitamente `ranking_editions.published_at is not
-- null` (Revisión Central Fase E §8) — hoy esa columna es `not null default now()` en todas las
-- filas (nunca existe una edición "borrador"), así que el filtro es una defensa explícita y
-- documentada, no un cambio de comportamiento real; tampoco leen nunca una edición futura
-- (`_bloque7_previous_edition_id` busca exactamente 7 días atrás; la subconsulta de mejor
-- posición filtra `period_start_at < v_edition.period_start_at`).
--
-- `get_home_ranking_insight()` (misma migración de Bloque 7) es un passthrough literal a
-- `get_my_ranking_position('local', null)` — no necesita cambios propios: reenvía los 4 campos
-- nuevos automáticamente en cuanto esta función los devuelve.
--
-- IMPORTANTE (mismo criterio que toda migración de Bloque 8 hasta ahora): preparada y testeada
-- localmente (ver bramulab/ranking-home-milestone.test.mjs, que ya asume estos campos cuando
-- están presentes y nunca los asume cuando faltan), NO aplicada a Supabase desde este entorno.
-- Sin aplicar, los 4 campos nuevos simplemente no existen en la respuesta — el detector de hitos
-- (`PLRanking.classifyHomeRankingMilestone`) ya trata su ausencia como "este caso puntual no
-- dispara todavía", nunca como un error ni un valor inventado.

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
    select coalesce(jsonb_agg(jsonb_build_object(
        'playerId', sr.player_id, 'displayName', pr.display_name, 'username', pr.username,
        'position', sr.rank_position, 'levelPublic', sr.level_public, 'isSelf', sr.player_id = v_caller_player_id
      ) order by sr.rank_position), '[]'::jsonb) into v_window
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, v_branch, p_level_band) sr
    join public.profiles pr on pr.player_id = sr.player_id
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
   Nunca inventa un puesto para un caller CALIBRANDO/sin ubicación/sin rama.';
