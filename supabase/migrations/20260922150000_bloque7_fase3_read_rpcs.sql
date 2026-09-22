-- BRAMUlab — Bloque 7 (Fase 3): RPCs de lectura server-side de Ranking real sobre las ediciones
-- ya publicadas por Fase 2. NO conecta frontend todavía — deja el contrato estable para que
-- Fase 5 solo consuma datos, sin volver a calcular autoridad competitiva en el navegador.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{13_Handoff_Fase_3_Claude.md,
-- 14_Resultado_Fase_3_Claude.md}. Todavía NO incluye: pg_cron, frontend, eliminación de mocks,
-- Production, "Explorar rankings", Ranking de Grupos, Race, matchmaking, Intelligence.
--
-- Regla crítica seguida en TODAS las RPCs de acá (handoff §4): el cliente nunca envía un
-- scope_key/territorio arbitrario. Para Local/Provincial/País, el servidor resuelve el
-- scope_key propio del caller (o del jugador objetivo en Perfil) desde su propia fila
-- congelada de la edición vigente — nunca desde un parámetro. Global usa el literal fijo
-- 'GLOBAL', igual que en Fase 2.
--
-- Piezas nuevas, en orden:
--   1) `ranking_network_hidden` — estado personal mínimo para "Ocultar de Mi red"/"Volver a
--      mostrar" (handoff §9) — presentación pura, nunca toca partidos/Nivel/Ranking oficial.
--      Mismo criterio de tabla mutable (no append-only) que `match_user_state` (Bloque 5):
--      SELECT/INSERT/DELETE vía service_role, deny-by-default para el cliente.
--   2) `_bloque7_scope_rows(edition, scope_type, scope_key, branch, band)` — helper interno
--      compartido: SIN filtro de banda devuelve exactamente lo que Fase 2 ya congeló (nunca
--      recalcula); CON filtro de banda recalcula posición/denominador/densidad DENTRO de la
--      banda sobre `level_internal` congelado (handoff §5), preservando 'locked' de Global si
--      el universo sin filtro ya estaba locked (el desbloqueo es diversidad de país de TODA la
--      rama, una banda no lo cambia). Única fuente de verdad para listar/leer una clasificación
--      — todas las RPCs públicas de abajo la reusan, nunca reimplementan el ranking.
--   3) `_bloque7_previous_edition_id` / `_bloque7_compute_movement` — movimiento semanal
--      (handoff §7): compara la MISMA scope_key+rama+banda contra la edición anterior; territorio
--      o banda distintos (o sin fila anterior) → 'nuevo', nunca se fabrica un delta de 0.
--   4) RPCs públicas `authenticated`: `get_current_ranking_edition`, `get_ranking_classification`
--      (Local/Provincial/País/Global + filtro de Nivel + búsqueda + paginación + ventana propia),
--      `get_my_ranking_position` (Tu posición, con y sin puesto), `get_ranking_network` (Mi red,
--      180 días as-of-cutoff, umbrales 1-2/3+, oculta lo personalmente escondido),
--      `set_ranking_network_hidden` (ocultar/restaurar), `get_profile_ranking_summary` (tarjeta
--      territorial de Perfil propio/público, siempre del jugador objetivo, nunca de quien mira),
--      `get_home_ranking_insight` (TU MOMENTO, ámbito Local por defecto).
--
-- Ninguna fila pública expone level_internal, reason_codes de terceros, email, auth_user_id,
-- efectividad, W/L, rachas ni confianza (handoff §6) — solo columnas ya listadas en
-- Ranking_BRAMU.md §15 y el propio handoff.

-- ------------------------------------------------------------------
-- 1) ranking_network_hidden — Ocultar/restaurar de Mi red (presentación personal)
-- ------------------------------------------------------------------

create table public.ranking_network_hidden (
  player_id        uuid not null references public.players (player_id),
  hidden_player_id uuid not null references public.players (player_id),
  hidden_at        timestamptz not null default now(),
  primary key (player_id, hidden_player_id)
);

comment on table public.ranking_network_hidden is
  'Estado personal mínimo de "Ocultar de Mi red"/"Volver a mostrar" (Bloque 7 Fase 3, handoff
   §9) — presentación pura: nunca borra partidos, nunca modifica Nivel ni Ranking oficial, nunca
   afecta al otro jugador. NO confundir con match_user_state/hide_match_for_me (Bloque 5), que es
   sobre partidos, no sobre la vista de Mi red. Escritura EXCLUSIVA de
   set_ranking_network_hidden; mutable (no append-only) a propósito, mismo criterio que
   match_user_state.';

alter table public.ranking_network_hidden enable row level security;
-- Deny-by-default: toda lectura/escritura pasa por get_ranking_network/
-- set_ranking_network_hidden (SECURITY DEFINER), nunca SELECT/INSERT/DELETE directo del cliente.

revoke update, delete, truncate, references, trigger
  on table public.ranking_network_hidden
  from service_role;
grant select, insert, delete on table public.ranking_network_hidden to service_role;

-- ------------------------------------------------------------------
-- 2) _bloque7_scope_rows — fuente única de lectura de una clasificación (con/sin filtro banda)
-- ------------------------------------------------------------------

create or replace function public._bloque7_scope_rows(
  p_edition_id uuid,
  p_scope_type text,
  p_scope_key text,
  p_competitive_branch text,
  p_level_band smallint
)
returns table (
  player_id uuid,
  position integer,
  tie_group integer,
  total_eligible integer,
  density_status text,
  level_public numeric,
  level_band smallint,
  level_status text,
  competitive_branch text,
  location_display_label text,
  is_eligible boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  select exists (
    select 1 from public.ranking_rows rr
    where rr.edition_id = p_edition_id and rr.scope_type = p_scope_type and rr.scope_key = p_scope_key
      and rr.competitive_branch = p_competitive_branch and rr.density_status = 'locked'
    limit 1
  ) into v_locked;

  if p_level_band is null then
    -- Sin filtro de banda: exactamente lo que Fase 2 ya congeló, nunca recalculado acá.
    return query
      select rr.player_id, rr.position, rr.tie_group, rr.total_eligible, rr.density_status,
             rr.level_public, rr.level_band, rr.level_status, rr.competitive_branch,
             rr.location_display_label, rr.is_eligible
      from public.ranking_rows rr
      where rr.edition_id = p_edition_id and rr.scope_type = p_scope_type and rr.scope_key = p_scope_key
        and rr.competitive_branch = p_competitive_branch and rr.is_eligible;
    return;
  end if;

  -- Con filtro de Nivel (handoff §5): recalcular puesto/denominador/densidad DENTRO de la
  -- banda sobre level_internal congelado — nunca reusar position/total_eligible del universo
  -- sin filtro. Si esa rama ya estaba 'locked' en Global (diversidad de país insuficiente),
  -- sigue 'locked' dentro de cualquier banda: el desbloqueo no es una propiedad de banda.
  return query
    with base as (
      select rr.player_id, rr.level_internal, rr.level_public, rr.level_band, rr.level_status,
             rr.competitive_branch, rr.location_display_label, rr.is_eligible
      from public.ranking_rows rr
      where rr.edition_id = p_edition_id and rr.scope_type = p_scope_type and rr.scope_key = p_scope_key
        and rr.competitive_branch = p_competitive_branch and rr.is_eligible and rr.level_band = p_level_band
    ),
    ranked as (
      select b.*,
        (rank() over (order by b.level_internal desc))::integer as rnk,
        (count(*) over ())::integer as total_n
      from base b
    )
    select r.player_id,
      case when v_locked or r.total_n <= 4 then null else r.rnk end,
      case when v_locked or r.total_n <= 4 then null else r.rnk end,
      r.total_n,
      case when v_locked then 'locked'
           when r.total_n <= 4 then 'insufficient'
           when r.total_n <= 14 then 'forming' else 'established' end,
      r.level_public, r.level_band, r.level_status, r.competitive_branch, r.location_display_label, r.is_eligible
    from ranked r;
end;
$$;

comment on function public._bloque7_scope_rows is
  'Fuente única de lectura de UNA clasificación (Bloque 7 Fase 3, handoff §5). Sin banda: pasa
   tal cual lo que compute_ranking_edition ya congeló. Con banda: recalcula puesto/denominador/
   densidad dentro de esa banda sobre level_internal, preservando el lock de Global. Toda RPC de
   lectura pública reusa esto — nunca hay una segunda implementación del ranking. SOLO
   invocable por el owner (otras funciones SECURITY DEFINER); revocado de PUBLIC.';

revoke all on function public._bloque7_scope_rows(uuid, text, text, text, smallint) from public;

-- ------------------------------------------------------------------
-- 3) Movimiento semanal
-- ------------------------------------------------------------------

create or replace function public._bloque7_previous_edition_id(p_edition_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e2.edition_id
  from public.ranking_editions e1
  join public.ranking_editions e2 on e2.period_start_at < e1.period_start_at
  where e1.edition_id = p_edition_id
  order by e2.period_start_at desc
  limit 1;
$$;

revoke all on function public._bloque7_previous_edition_id(uuid) from public;

create or replace function public._bloque7_compute_movement(
  p_player_id uuid,
  p_current_edition_id uuid,
  p_scope_type text,
  p_scope_key text,
  p_competitive_branch text,
  p_level_band smallint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prev_edition_id uuid;
  v_prev_scope_key text;
  v_current_position integer;
  v_prev_position integer;
begin
  v_prev_edition_id := public._bloque7_previous_edition_id(p_current_edition_id);
  if v_prev_edition_id is null then
    return jsonb_build_object('status', 'nuevo', 'delta', null);
  end if;

  -- Territorio distinto (o sin fila) en la edición anterior rompe comparabilidad (handoff §7)
  -- — se compara SIEMPRE contra la fila propia de esa edición anterior, nunca contra el
  -- scope_key vigente hoy.
  select scope_key into v_prev_scope_key
    from public.ranking_rows
    where edition_id = v_prev_edition_id and player_id = p_player_id and scope_type = p_scope_type
    limit 1;

  if v_prev_scope_key is null or v_prev_scope_key <> p_scope_key then
    return jsonb_build_object('status', 'nuevo', 'delta', null);
  end if;

  select position into v_current_position
    from public._bloque7_scope_rows(p_current_edition_id, p_scope_type, p_scope_key, p_competitive_branch, p_level_band)
    where player_id = p_player_id;
  -- Cambio de banda entre ediciones también rompe comparabilidad: si el jugador no estaba en
  -- esta banda la edición anterior, _bloque7_scope_rows (filtrado por banda) simplemente no
  -- devuelve fila para él — v_prev_position queda NULL sin necesitar un caso especial.
  select position into v_prev_position
    from public._bloque7_scope_rows(v_prev_edition_id, p_scope_type, p_scope_key, p_competitive_branch, p_level_band)
    where player_id = p_player_id;

  if v_prev_position is null or v_current_position is null then
    return jsonb_build_object('status', 'nuevo', 'delta', null);
  end if;

  return jsonb_build_object('status', 'movimiento', 'delta', v_prev_position - v_current_position);
end;
$$;

revoke all on function public._bloque7_compute_movement(uuid, uuid, text, text, text, smallint) from public;

-- ------------------------------------------------------------------
-- 4) RPCs públicas (authenticated)
-- ------------------------------------------------------------------

create or replace function public.get_current_ranking_edition()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('edition',
    (select jsonb_build_object(
      'editionId', e.edition_id, 'periodStartAt', e.period_start_at, 'periodEndAt', e.period_end_at,
      'publishedAt', e.published_at, 'timezone', e.timezone, 'rankingRulesVersion', e.ranking_rules_version
    ) from public.ranking_editions e order by e.period_start_at desc limit 1)
  );
$$;

comment on function public.get_current_ranking_edition is
  'Última edición de Ranking publicada, o {"edition": null} explícito si todavía no existe
   ninguna (handoff §3) — nunca inventa una edición.';

revoke all on function public.get_current_ranking_edition() from public;
grant execute on function public.get_current_ranking_edition() to authenticated;

create or replace function public.get_ranking_classification(
  p_scope_type text,
  p_competitive_branch text,
  p_level_band smallint default null,
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
    where position is not null;

  -- Densidad/total real de la rama+scope+banda (handoff §10 Ranking_BRAMU §10: "0-4/Comunidad
  -- insuficiente", "locked" de Global): se necesita AUNQUE `rows` quede vacío, para no perder
  -- el motivo por el que no hay puestos. Uniforme en todas las filas de este grupo — basta 1.
  select sr.total_eligible, sr.density_status into v_total_eligible, v_density_status
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, p_competitive_branch, p_level_band) sr
    limit 1;

  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'playerId', sr.player_id, 'displayName', pr.display_name, 'username', pr.username,
      'avatarUrl', pr.avatar_url, 'position', sr.position, 'total', sr.total_eligible,
      'densityStatus', sr.density_status, 'levelPublic', sr.level_public, 'levelBand', sr.level_band,
      'competitiveBranch', sr.competitive_branch, 'location', sr.location_display_label
    ) as row_data
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, p_competitive_branch, p_level_band) sr
    join public.profiles pr on pr.player_id = sr.player_id
    where sr.position is not null
      and (
        coalesce(trim(p_search), '') = ''
        or pr.display_name ilike '%' || trim(p_search) || '%'
        or pr.username ilike '%' || trim(p_search) || '%'
      )
    order by sr.position asc, sr.player_id asc
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
    'total', v_total, 'totalEligible', coalesce(v_total_eligible, 0),
    'densityStatus', coalesce(v_density_status, 'insufficient'), 'rows', v_rows
  );
end;
$$;

comment on function public.get_ranking_classification is
  'Clasificación paginada/buscable de Local/Provincial/País/Global (handoff §4/§5/§6/§11).
   scope_key SIEMPRE resuelto server-side desde la fila propia del caller (nunca un parámetro
   del cliente — "Explorar rankings" queda fuera de V1). Solo filas con position IS NOT NULL se
   listan (Ranking_BRAMU.md §6/handoff §6: los no elegibles no aparecen como jugadores
   rankeados). Nunca expone level_internal ni reason_codes.';

revoke all on function public.get_ranking_classification(text, text, smallint, text, integer, integer) from public;
grant execute on function public.get_ranking_classification(text, text, smallint, text, integer, integer) to authenticated;

create or replace function public.get_my_ranking_position(
  p_scope_type text,
  p_level_band smallint default null
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
  v_movement jsonb;
  v_window jsonb;
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

  select * into v_edition from public.ranking_editions order by period_start_at desc limit 1;
  if v_edition is null then
    return jsonb_build_object('edition', null, 'hasPosition', false);
  end if;

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
    -- Caller CALIBRANDO/no elegible/sin fila en este scope: estado propio sin inventar puesto
    -- (handoff §8).
    return jsonb_build_object(
      'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
      'scopeType', p_scope_type, 'hasPosition', false
    );
  end if;

  select position, total_eligible, density_status, level_public, level_band, is_eligible
    into v_own
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, v_branch, p_level_band)
    where player_id = v_caller_player_id;

  if v_own is null then
    return jsonb_build_object(
      'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
      'scopeType', p_scope_type, 'scopeKey', v_scope_key, 'competitiveBranch', v_branch, 'hasPosition', false
    );
  end if;

  v_movement := public._bloque7_compute_movement(v_caller_player_id, v_edition.edition_id, p_scope_type, v_scope_key, v_branch, p_level_band);

  if v_own.position is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'playerId', sr.player_id, 'displayName', pr.display_name, 'username', pr.username,
        'position', sr.position, 'levelPublic', sr.level_public, 'isSelf', sr.player_id = v_caller_player_id
      ) order by sr.position), '[]'::jsonb) into v_window
    from public._bloque7_scope_rows(v_edition.edition_id, p_scope_type, v_scope_key, v_branch, p_level_band) sr
    join public.profiles pr on pr.player_id = sr.player_id
    where sr.position is not null and sr.position between v_own.position - 2 and v_own.position + 2;
  else
    v_window := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
    'scopeType', p_scope_type, 'scopeKey', v_scope_key, 'competitiveBranch', v_branch, 'levelBand', p_level_band,
    'hasPosition', v_own.position is not null,
    'position', v_own.position, 'total', v_own.total_eligible, 'densityStatus', v_own.density_status,
    'levelPublic', v_own.level_public, 'movement', v_movement, 'contextWindow', v_window
  );
end;
$$;

comment on function public.get_my_ranking_position is
  '"Tu posición" (handoff §8): estado propio, puesto/total si existe, movimiento vs. edición
   anterior comparable, ventana de contexto alrededor de la fila propia. Nunca inventa un
   puesto para un caller CALIBRANDO/sin ubicación/sin rama.';

revoke all on function public.get_my_ranking_position(text, smallint) from public;
grant execute on function public.get_my_ranking_position(text, smallint) to authenticated;

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
  v_hidden_count integer;
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
    return jsonb_build_object('edition', null, 'total', 0, 'rows', '[]'::jsonb, 'hiddenCount', 0);
  end if;

  -- Relaciones computables AS-OF el cutoff de la edición (handoff §9: "180 días anteriores al
  -- cutoff de la edición, no a now()") — misma fuente que Fase 2 (match_level_results elegibles
  -- y aplicados + matches.played_at), nunca la ubicación/Nivel en vivo.
  select array_agg(distinct mp.player_id) into v_related
  from public.match_level_result_players mlrp0
  join public.match_level_results mlr0
    on mlr0.result_id = mlrp0.result_id and mlr0.effect_status = 'applied' and mlr0.eligible
  join public.matches m on m.match_id = mlr0.match_id
  join public.match_level_result_players mp on mp.result_id = mlrp0.result_id and mp.player_id <> v_caller_player_id
  where mlrp0.player_id = v_caller_player_id
    -- Defensa en profundidad, mismo criterio que get_player_match_history_for_level_engine
    -- (Bloque 6): match_level_results.effect_status='applied' ya implica un partido validado,
    -- pero se re-chequea matches.status explícitamente igual.
    and m.status = 'validated'
    and m.played_at < v_edition.period_start_at
    and m.played_at >= v_edition.period_start_at - interval '180 days';

  v_related := array_append(coalesce(v_related, array[]::uuid[]), v_caller_player_id);

  select count(*) into v_hidden_count from public.ranking_network_hidden where player_id = v_caller_player_id;

  -- Mi red usa siempre la fila Global (nunca depende de que cada miembro comparta el mismo
  -- territorio, Ranking_BRAMU.md §9/§10: "no usa umbrales territoriales"). Umbral propio:
  -- 1-2 elegibles → sin puesto; 3+ → posiciones reales (distinto del 0-4/5-14/15+ territorial).
  with network as (
    select rr.player_id, rr.competitive_branch, rr.level_public, rr.level_internal, rr.is_eligible,
           pr.display_name, pr.username
    from public.ranking_rows rr
    join public.profiles pr on pr.player_id = rr.player_id
    where rr.edition_id = v_edition.edition_id
      and rr.scope_type = 'global'
      and rr.player_id = any(v_related)
      and (p_competitive_branch is null or rr.competitive_branch = p_competitive_branch)
      and not exists (
        select 1 from public.ranking_network_hidden h
        where h.player_id = v_caller_player_id and h.hidden_player_id = rr.player_id
      )
  ),
  eligible_count as (select count(*) as n from network where is_eligible),
  ranked as (
    select player_id, rank() over (order by level_internal desc) as rnk from network where is_eligible
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'playerId', n.player_id, 'displayName', n.display_name, 'username', n.username,
      'competitiveBranch', n.competitive_branch, 'levelPublic', n.level_public,
      'isSelf', n.player_id = v_caller_player_id,
      'position', case when (select ec.n from eligible_count ec) <= 2 then null else r.rnk end
    ) order by coalesce(r.rnk, 999999), n.level_public desc nulls last), '[]'::jsonb)
    into v_rows
  from network n
  left join ranked r on r.player_id = n.player_id;

  return jsonb_build_object(
    'edition', jsonb_build_object('editionId', v_edition.edition_id, 'periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
    'total', jsonb_array_length(v_rows), 'rows', v_rows, 'hiddenCount', v_hidden_count
  );
end;
$$;

comment on function public.get_ranking_network is
  '"Mi red" V1 (handoff §9): propio usuario + relaciones de partido computable/validado dentro
   de 180 días ANTERIORES al cutoff de la edición (nunca now()). Umbral propio 1-2/3+ (distinto
   del territorial). Nunca materializa otra edición ni recalcula Nivel; usa la fila Global ya
   congelada de cada miembro. Excluye lo que el caller ocultó (ranking_network_hidden),
   presentación pura.';

revoke all on function public.get_ranking_network(text) from public;
grant execute on function public.get_ranking_network(text) to authenticated;

create or replace function public.set_ranking_network_hidden(p_hidden_player_id uuid, p_hidden boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if p_hidden_player_id is null then
    raise exception 'hidden_player_id_required' using errcode = 'P0001';
  end if;
  if p_hidden_player_id = v_caller_player_id then
    raise exception 'cannot_hide_self' using errcode = 'P0001';
  end if;
  if p_hidden is null then
    raise exception 'hidden_flag_required' using errcode = 'P0001';
  end if;

  if p_hidden then
    insert into public.ranking_network_hidden (player_id, hidden_player_id)
    values (v_caller_player_id, p_hidden_player_id)
    on conflict (player_id, hidden_player_id) do nothing;
  else
    delete from public.ranking_network_hidden
    where player_id = v_caller_player_id and hidden_player_id = p_hidden_player_id;
  end if;

  return true;
end;
$$;

comment on function public.set_ranking_network_hidden is
  'Ocultar/restaurar de Mi red (handoff §9) — idempotente (ON CONFLICT DO NOTHING / DELETE
   condicional): presentación personal pura, nunca toca partidos/Nivel/Ranking oficial ni
   afecta al otro jugador. No confundir con hide_match_for_me.';

revoke all on function public.set_ranking_network_hidden(uuid, boolean) from public;
grant execute on function public.set_ranking_network_hidden(uuid, boolean) to authenticated;

create or replace function public.get_profile_ranking_summary(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_edition public.ranking_editions;
  v_scopes jsonb;
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_caller_player_id, 'get_profile_ranking_summary', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Mismo criterio de existencia que get_public_profile (Bloque 4): cuenta registrada, activa,
  -- con username ya completo. 0 filas para provisional/inexistente/perfil incompleto.
  if not exists (
    select 1 from public.players pl
    join public.profiles pr using (player_id)
    where pl.player_id = p_player_id and pl.type = 'registered' and pl.is_active and pr.username is not null
  ) then
    return jsonb_build_object('edition', null, 'local', null, 'provincial', null, 'pais', null);
  end if;

  select * into v_edition from public.ranking_editions order by period_start_at desc limit 1;
  if v_edition is null then
    return jsonb_build_object('edition', null, 'local', null, 'provincial', null, 'pais', null);
  end if;

  -- SIEMPRE los ámbitos propios del jugador OBJETIVO, congelados en la edición vigente —
  -- nunca un territorio elegido por quien mira (handoff §10/Ranking_BRAMU.md §15.1: misma
  -- fuente/lógica en Perfil propio y público).
  select coalesce(jsonb_object_agg(scope_type, jsonb_build_object(
      'position', position, 'total', total_eligible, 'densityStatus', density_status
    )), '{}'::jsonb) into v_scopes
  from public.ranking_rows
  where edition_id = v_edition.edition_id and player_id = p_player_id and scope_type in ('local', 'provincial', 'pais');

  return jsonb_build_object(
    'edition', jsonb_build_object('periodStartAt', v_edition.period_start_at, 'periodEndAt', v_edition.period_end_at),
    'local', v_scopes -> 'local', 'provincial', v_scopes -> 'provincial', 'pais', v_scopes -> 'pais'
  );
end;
$$;

comment on function public.get_profile_ranking_summary is
  'Tarjeta territorial semanal de Perfil (propio o público, misma fuente — Ranking_BRAMU.md
   §15.1). Usa los ámbitos propios del jugador OBJETIVO (p_player_id), congelados en la edición
   vigente, nunca el territorio de quien consulta ni el Nivel en vivo.';

revoke all on function public.get_profile_ranking_summary(uuid) from public;
grant execute on function public.get_profile_ranking_summary(uuid) to authenticated;

create or replace function public.get_home_ranking_insight()
returns jsonb
language sql
-- Nunca `stable`: get_my_ranking_position hace consume_rate_limit (escritura real). Marcar esto
-- stable sería una mentira de volatilidad aunque Postgres no lo rechace al crear la función.
security definer
set search_path = public
as $$
  -- TU MOMENTO (handoff §10): ámbito principal = Local, sin filtro de banda. Reusa
  -- get_my_ranking_position tal cual — nunca una segunda implementación del estado propio.
  select public.get_my_ranking_position('local', null);
$$;

comment on function public.get_home_ranking_insight is
  'Insight de Ranking para TU MOMENTO en Home (handoff §10) — ámbito Local por defecto, sin
   filtro de banda. Redacción/plantillas de Intelligence quedan fuera de esta fase.';

revoke all on function public.get_home_ranking_insight() from public;
grant execute on function public.get_home_ranking_insight() to authenticated;
