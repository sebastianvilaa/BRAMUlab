-- BRAMUlab — Grupos BRAMU · B2a · Backend del lobby (handoff 75, 28/09/2026).
--
-- Fase A + B1 server-backed cerrados en Staging (docs/BRAMUlab/Implementacion/Pre_Production/
-- 74_Cierre_Grupos_B1_28SEP.md). Esta migración agrega ÚNICAMENTE el contrato de lectura que
-- necesita el lobby (B2b, todavía sin implementar): una RPC resumida que evita una cadena N+1
-- de lecturas por grupo. SIN frontend, SIN foto/Storage, SIN tocar la UI del detalle ya validado.
--
-- REFACTOR (handoff 75 §5): `get_group_competition_data` (Fase A, con el hotfix de membresía
-- semanal de 20260928140000) construía inline el criterio "qué partidos califican para el
-- grupo" — la misma pregunta que ahora necesita también el lobby. En vez de copiar/pegar ese
-- criterio una segunda vez (riesgo real de que las dos consultas diverjan), se extrae a
-- funciones internas compartidas. El contrato/JSON de salida de `get_group_competition_data` NO
-- cambia — mismas claves, mismo criterio de candidatos (umbral ampliado 7 días, cota segura de
-- "lunes de esa semana" en cualquier huso; el piso EXACTO sigue siendo autoridad de groups.js,
-- igual que desde la Fase A original) — es un refactor de implementación, no de contrato.
--
-- Nuevas funciones internas (SECURITY DEFINER, sin GRANT a `authenticated`/`anon` — mismo patrón
-- que `_groups_detail_json`/`_groups_player_selectable` desde la Fase A):
--   1) `_groups_candidate_matches(group_id, from, to)` — tabla de partidos candidatos (>=3
--      miembros con el umbral ampliado), antes la CTE `cand` inline de `get_group_competition_data`.
--   2) `_groups_is_member_at(group_id, player_id, at)` — mismo umbral ampliado, para el flag
--      `isGroupMember` por jugador (antes un `exists` inline repetido).
--   3) `_groups_match_sets_json(current_revision_id)` — sets de la revisión oficial vigente.
--   4) `_groups_match_players_json(match_id, group_id, played_at)` — los 4 participantes con
--      `isGroupMember`/`levelBefore`.
--   5) `_groups_week_matches_json(group_id, from, to)` — arma el array `matches`/`weekMatches`
--      completo (matchId/playedAt/.../sets/players) — ÚNICO punto que arma esa forma, reusado por
--      `get_group_competition_data` (Fase A) y `get_groups_lobby` (nuevo, abajo). No hay
--      fórmula de puntos/bonus/top-3 acá — eso sigue siendo groups.js en el cliente.
--   6) `_groups_members_json(group_id)` — el array `members` con períodos (antes inline dentro de
--      `_groups_detail_json`), reusado también por `get_groups_lobby`.
--   7) `_groups_last_activity_at(group_id)` — actividad significativa AUTORITATIVA del GRUPO
--      (nunca del caller): el máximo entre `group_events.occurred_at` (creación/rename/alta/
--      baja/admin — TODOS los tipos que ya registra `_groups_log` desde Fase A, incluida la
--      creación misma) y `match_actions.occurred_at` con `action_type in ('validated',
--      'correction_accepted')` SOLO de partidos EXACTAMENTE calificables para el grupo (ver
--      microfix de frontera semanal, abajo) — un partido que nunca calificó (2/4, o candidato de
--      OTRO grupo) nunca mueve el orden de este grupo. Foto queda reservada a B2c
--      (`photo_changed`, todavía no existe ese evento).
--
-- MICROFIX — frontera semanal canónica (handoff 77, 28/09/2026, revisión Central antes de
-- aplicar): decisión de producto cerrada en `Grupos_BRAMU.md` §"Zona horaria canónica V1" —
-- Grupos BRAMU V1 usa SIEMPRE `America/Argentina/Buenos_Aires` (lunes 00:00 → domingo
-- 23:59:59.999 de Buenos Aires) para toda frontera semanal, nunca el huso del dispositivo ni de
-- la sesión de Postgres. `_groups_candidate_matches` SIGUE usando el umbral ampliado de 7 días
-- (cota segura de transporte — nunca excluye de más lo que `groups.js` podría aceptar; eso está
-- bien para `weekMatches`, que el cliente vuelve a filtrar con el piso exacto). Pero
-- `_groups_last_activity_at` NO tiene un filtrado posterior del lado del cliente — usaba ese
-- mismo umbral ampliado como si fuera el criterio DEFINITIVO, así que un partido de la semana
-- anterior (todavía dentro de la cota de 7 días) podía mover `lastActivityAt` con una acción
-- posterior aunque no perteneciera a la semana deportiva efectiva del alta. Se agrega:
--   8) `_groups_week_start_ba(at)` — lunes 00:00 de Buenos Aires de la semana que contiene `at`,
--      vía `AT TIME ZONE 'America/Argentina/Buenos_Aires'` (determinístico; Argentina no tiene
--      horario de verano desde 2009, así que esto equivale exactamente a restar 3h fijas —
--      mismo criterio que el helper JS `PLGroups.weekStartBA`, groups.js).
--   9) `_groups_candidate_matches_exact(group_id, from, to)` — mismo criterio de
--      `_groups_candidate_matches` pero con el piso EXACTO (`_groups_week_start_ba`) en vez del
--      umbral ampliado. Usada ÚNICAMENTE por `_groups_last_activity_at` — `weekMatches`/`matches`
--      siguen usando la versión amplia (`_groups_candidate_matches`), sin cambios de contrato.
-- `_groups_last_activity_at` pasa a unirse contra `_groups_candidate_matches_exact` en vez de la
-- amplia — un partido que no es realmente candidato bajo el piso exacto nunca mueve la actividad,
-- sin importar cuántos días de margen le diera el umbral de transporte.
--
-- `get_groups_lobby(p_week_from, p_week_to)` — nueva RPC pública (`authenticated` únicamente):
-- por cada grupo activo donde el caller es miembro activo, devuelve groupId/name/createdAt/
-- activeMemberCount/isAdmin/lastActivityAt/members[]/weekMatches[], ordenados por
-- `lastActivityAt DESC, createdAt DESC, groupId` (desempate estable, nunca visible). `members`/
-- `weekMatches` tienen EXACTAMENTE la misma forma que ya devuelven `get_group_detail`/
-- `get_group_competition_data` — B2b podrá reusar el mismo adaptador de groups.js sin un segundo
-- shape. No se calculan puntos/top-3/posiciones acá: ese payload solo le da a groups.js lo que
-- necesita para calcularlo, igual que B1.
--
-- Seguridad: mismo patrón Fase A/B1 — tablas server-only sin política directa (sin cambios en
-- esta migración), SECURITY DEFINER + search_path fijo, GRANT únicamente a `authenticated`, sin
-- rate limit (lectura, mismo criterio que list_my_groups/get_group_detail/
-- get_group_competition_data, que tampoco lo tienen). No se amplía ningún GRANT de tabla.
--
-- NO aplicada desde este sandbox (sin Supabase CLI/credenciales) — Central la aplica y verifica
-- en Staging (supabase/tests/verify-preprod-grupos-b2a-backend-lobby.sql).

-- ------------------------------------------------------------------
-- 1) _groups_candidate_matches — antes la CTE `cand` inline de get_group_competition_data
-- ------------------------------------------------------------------

create or replace function public._groups_candidate_matches(
  p_group_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  match_id uuid, played_at timestamptz, played_at_time_known boolean,
  format_id text, scoring_system text, winner_team text, current_revision_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select m.match_id, m.played_at, m.played_at_time_known, m.format_id, m.scoring_system,
         m.winner_team, m.current_revision_id
  from public.matches m
  where m.status = 'validated'
    and m.winner_team is not null
    and m.current_revision_id is not null
    and (p_from is null or m.played_at >= p_from)
    and (p_to is null or m.played_at < p_to)
    and (
      select count(distinct mp.player_id)
      from public.match_participants mp
      join public.group_memberships gm
        on gm.group_id = p_group_id
       and gm.player_id = mp.player_id
       -- Cota segura de "lunes de la semana de joined_at" en cualquier huso horario (handoff 71
       -- §A / 75 §2) — nunca excluye un candidato que el piso semanal EXACTO (groups.js) aceptaría.
       and gm.joined_at - interval '7 days' <= m.played_at
       and (gm.left_at is null or m.played_at < gm.left_at)
      where mp.match_id = m.match_id
    ) >= 3;
$$;

revoke all on function public._groups_candidate_matches(uuid, timestamptz, timestamptz) from public;

comment on function public._groups_candidate_matches(uuid, timestamptz, timestamptz) is
  'Partidos candidatos de un grupo (>=3 miembros con el umbral ampliado de 7 días). Fuente única
   compartida por get_group_competition_data y get_groups_lobby (handoff 75 §5) — nunca duplicar
   este criterio en otra RPC. El piso semanal EXACTO sigue siendo autoridad de groups.js.';

-- ------------------------------------------------------------------
-- 2) _groups_is_member_at — antes el exists() inline de isGroupMember
-- ------------------------------------------------------------------

create or replace function public._groups_is_member_at(p_group_id uuid, p_player_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_memberships gm
    where gm.group_id = p_group_id and gm.player_id = p_player_id
      and gm.joined_at - interval '7 days' <= p_at
      and (gm.left_at is null or p_at < gm.left_at)
  );
$$;

revoke all on function public._groups_is_member_at(uuid, uuid, timestamptz) from public;

-- ------------------------------------------------------------------
-- 3) _groups_match_sets_json / 4) _groups_match_players_json
-- ------------------------------------------------------------------

create or replace function public._groups_match_sets_json(p_current_revision_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
             'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b) order by ms.set_number)
    from public.match_sets ms
    join public.match_revisions mr on mr.match_id = ms.match_id and mr.revision_number = ms.revision_number
    where mr.revision_id = p_current_revision_id
  ), '[]'::jsonb);
$$;

revoke all on function public._groups_match_sets_json(uuid) from public;

create or replace function public._groups_match_players_json(p_match_id uuid, p_group_id uuid, p_played_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select (
    select jsonb_agg(jsonb_build_object(
             'playerId', mp.player_id,
             'team', mp.team,
             'position', mp.position_in_team,
             'isGroupMember', public._groups_is_member_at(p_group_id, mp.player_id, p_played_at),
             'levelBefore', (
               select mlrp.effective_level
               from public.match_level_results mlr
               join public.match_level_result_players mlrp on mlrp.result_id = mlr.result_id
               where mlr.match_id = p_match_id and mlr.effect_status = 'applied' and mlr.eligible
                 and mlrp.player_id = mp.player_id)
           ) order by mp.team, mp.position_in_team)
    from public.match_participants mp where mp.match_id = p_match_id
  );
$$;

revoke all on function public._groups_match_players_json(uuid, uuid, timestamptz) from public;

-- ------------------------------------------------------------------
-- 5) _groups_week_matches_json — ÚNICO armador del array de partidos (matches/weekMatches)
-- ------------------------------------------------------------------

create or replace function public._groups_week_matches_json(p_group_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'matchId', c.match_id,
    'playedAt', c.played_at,
    'playedAtTimeKnown', c.played_at_time_known,
    'formatId', c.format_id,
    'scoringSystem', c.scoring_system,
    'winnerTeam', c.winner_team,
    'sets', public._groups_match_sets_json(c.current_revision_id),
    'players', public._groups_match_players_json(c.match_id, p_group_id, c.played_at)
  ) order by c.played_at, c.match_id), '[]'::jsonb)
  from public._groups_candidate_matches(p_group_id, p_from, p_to) c;
$$;

revoke all on function public._groups_week_matches_json(uuid, timestamptz, timestamptz) from public;

comment on function public._groups_week_matches_json(uuid, timestamptz, timestamptz) is
  'Array de partidos candidatos de un grupo en la forma que ya lee el adaptador B1
   (bramulab/groups.js#adaptServerCompetitionMatches). Sin fórmula de puntos/bonus/top-3 — solo
   datos normalizados. Reusado por get_group_competition_data (matches) y get_groups_lobby
   (weekMatches, handoff 75) — nunca dos armadores distintos del mismo shape.';

-- ------------------------------------------------------------------
-- 6) _groups_members_json — extraído de _groups_detail_json (mismo shape, sin cambios)
-- ------------------------------------------------------------------

create or replace function public._groups_members_json(p_group_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(m.j order by m.first_joined, m.player_id)
    from (
      select gm.player_id,
             min(gm.joined_at) as first_joined,
             jsonb_build_object(
               'playerId', gm.player_id,
               'isActive', bool_or(gm.left_at is null),
               'isAdmin', bool_or(gm.left_at is null and gm.is_admin),
               'periods', jsonb_agg(jsonb_build_object('joinedAt', gm.joined_at, 'leftAt', gm.left_at)
                                    order by gm.joined_at)
             ) as j
      from public.group_memberships gm
      where gm.group_id = p_group_id
      group by gm.player_id
    ) m
  ), '[]'::jsonb);
$$;

revoke all on function public._groups_members_json(uuid) from public;

-- Fase A original: mismo output exacto, ahora delega el bloque `members` al helper de arriba.
create or replace function public._groups_detail_json(p_group_id uuid, p_caller uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'groupId', g.group_id,
    'name', g.name,
    'createdByPlayerId', g.created_by_player_id,
    'createdAt', g.created_at,
    'updatedAt', g.updated_at,
    'isAdmin', exists (
      select 1 from public.group_memberships c
      where c.group_id = g.group_id and c.player_id = p_caller and c.left_at is null and c.is_admin),
    'members', public._groups_members_json(g.group_id)
  )
  from public.groups g
  where g.group_id = p_group_id;
$$;

revoke all on function public._groups_detail_json(uuid, uuid) from public;

-- ------------------------------------------------------------------
-- 7) get_group_competition_data — MISMO contrato/salida, ahora vía los helpers de arriba
-- ------------------------------------------------------------------

create or replace function public.get_group_competition_data(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
begin
  if p_group_id is null or not exists (
    select 1 from public.groups g
    join public.group_memberships gm on gm.group_id = g.group_id and gm.player_id = v_caller and gm.left_at is null
    where g.group_id = p_group_id and g.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'group_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'group', public._groups_detail_json(p_group_id, v_caller),
    'matches', public._groups_week_matches_json(p_group_id, p_from, p_to)
  );
end;
$$;

comment on function public.get_group_competition_data(uuid, timestamptz, timestamptz) is
  'Lectura deportiva de UN grupo (solo miembros activos; group_not_found si no). Mismo contrato
   desde Fase A — B2a (handoff 75) solo refactorizó su implementación interna para compartir
   candidatos/armado de partidos con get_groups_lobby, sin cambiar el JSON de salida.';

revoke all on function public.get_group_competition_data(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_group_competition_data(uuid, timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------------
-- 8) _groups_week_start_ba / _groups_candidate_matches_exact — microfix frontera semanal (h77)
-- ------------------------------------------------------------------

create or replace function public._groups_week_start_ba(p_at timestamptz)
returns timestamptz
language sql
stable
as $$
  -- Lunes 00:00:00.000 de Buenos Aires de la semana que contiene p_at. AT TIME ZONE con un
  -- nombre de zona IANA convierte correctamente sin asumir un offset fijo "a mano" — Postgres
  -- resuelve America/Argentina/Buenos_Aires con su propia tzdata (hoy UTC-3 todo el año, sin
  -- DST desde 2009). Debe coincidir siempre con el helper JS PLGroups.weekStartBA (groups.js).
  select date_trunc('week', p_at at time zone 'America/Argentina/Buenos_Aires')
         at time zone 'America/Argentina/Buenos_Aires';
$$;

comment on function public._groups_week_start_ba(timestamptz) is
  'Lunes 00:00 de Buenos Aires (America/Argentina/Buenos_Aires, decisión cerrada V1) de la
   semana que contiene p_at. Fuente única de frontera semanal canónica del lado SQL — debe
   coincidir siempre con PLGroups.weekStartBA (bramulab/groups.js) del lado del cliente.';

-- Pura (sin tocar tablas, sin SECURITY DEFINER necesario) pero revocada igual, mismo criterio de
-- mínimo privilegio que el resto de los helpers internos de este archivo.
revoke all on function public._groups_week_start_ba(timestamptz) from public;

create or replace function public._groups_candidate_matches_exact(
  p_group_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (match_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  -- Mismo criterio que _groups_candidate_matches (>=3 miembros), pero con el piso semanal BA
  -- EXACTO en vez del umbral ampliado de 7 días — únicamente para decidir actividad real
  -- (_groups_last_activity_at). weekMatches/matches siguen usando la versión amplia sin cambios.
  select m.match_id
  from public.matches m
  where m.status = 'validated'
    and m.winner_team is not null
    and m.current_revision_id is not null
    and (p_from is null or m.played_at >= p_from)
    and (p_to is null or m.played_at < p_to)
    and (
      select count(distinct mp.player_id)
      from public.match_participants mp
      join public.group_memberships gm
        on gm.group_id = p_group_id
       and gm.player_id = mp.player_id
       and public._groups_week_start_ba(gm.joined_at) <= m.played_at
       and (gm.left_at is null or m.played_at < gm.left_at)
      where mp.match_id = m.match_id
    ) >= 3;
$$;

revoke all on function public._groups_candidate_matches_exact(uuid, timestamptz, timestamptz) from public;

comment on function public._groups_candidate_matches_exact(uuid, timestamptz, timestamptz) is
  'Partidos REALMENTE calificables para un grupo bajo el piso semanal BA exacto (handoff 77) —
   uso exclusivo de _groups_last_activity_at. Nunca usar para weekMatches/matches (esas siguen
   con el umbral ampliado de _groups_candidate_matches, que el cliente vuelve a filtrar).';

-- ------------------------------------------------------------------
-- 9) _groups_last_activity_at — actividad significativa AUTORITATIVA del grupo
-- ------------------------------------------------------------------

create or replace function public._groups_last_activity_at(p_group_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    -- Mutaciones del grupo: creación (siempre logueada, ver _groups_log en create_group),
    -- rename, alta/baja de miembro, promoción/democión de admin (handoff 75 §4, puntos 3-6).
    coalesce((select max(ge.occurred_at) from public.group_events ge where ge.group_id = p_group_id), '-infinity'::timestamptz),
    -- Partido oficial validado O corrección oficial aceptada, SOLO si ese partido es
    -- REALMENTE candidato de ESTE grupo bajo el piso semanal BA exacto (handoff 77 — nunca el
    -- umbral ampliado de transporte) — un partido que nunca calificó (2/4, semana anterior a la
    -- efectiva del alta, o candidato de otro grupo) nunca mueve el orden.
    coalesce((
      select max(ma.occurred_at)
      from public.match_actions ma
      join public._groups_candidate_matches_exact(p_group_id, null, null) cm on cm.match_id = ma.match_id
      where ma.action_type in ('validated', 'correction_accepted')
    ), '-infinity'::timestamptz)
  );
$$;

revoke all on function public._groups_last_activity_at(uuid) from public;

comment on function public._groups_last_activity_at(uuid) is
  'Actividad significativa autoritativa del GRUPO (nunca del caller): máximo entre
   group_events.occurred_at (creación/rename/alta/baja/admin) y match_actions.occurred_at
   (validated/correction_accepted) de partidos REALMENTE calificables bajo el piso semanal BA
   exacto (_groups_candidate_matches_exact, handoff 77 — nunca el umbral ampliado de
   _groups_candidate_matches). Foto reservada a B2c (photo_changed, todavía no existe). Usada
   para ordenar get_groups_lobby.';

-- ------------------------------------------------------------------
-- 10) get_groups_lobby — nueva RPC (handoff 75 §3)
-- ------------------------------------------------------------------

create or replace function public.get_groups_lobby(p_week_from timestamptz default null, p_week_to timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
begin
  return jsonb_build_object('ok', true, 'groups', coalesce((
    select jsonb_agg(jsonb_build_object(
             'groupId', g.group_id,
             'name', g.name,
             'createdAt', g.created_at,
             'activeMemberCount', (select count(*) from public.group_memberships x where x.group_id = g.group_id and x.left_at is null),
             'isAdmin', me.is_admin,
             'lastActivityAt', la.last_activity_at,
             'members', public._groups_members_json(g.group_id),
             'weekMatches', public._groups_week_matches_json(g.group_id, p_week_from, p_week_to)
           )
           -- Desempate estable y NUNCA visible (handoff 75 §4): lastActivityAt desc, createdAt
           -- desc, groupId — mismo criterio para todo caller, no depende de su propia actividad.
           order by la.last_activity_at desc, g.created_at desc, g.group_id)
    from public.group_memberships me
    join public.groups g on g.group_id = me.group_id and g.status = 'active'
    cross join lateral (select public._groups_last_activity_at(g.group_id) as last_activity_at) la
    where me.player_id = v_caller and me.left_at is null
  ), '[]'::jsonb));
end;
$$;

comment on function public.get_groups_lobby(timestamptz, timestamptz) is
  'Lectura resumida de TODOS los grupos activos del caller, para el futuro lobby (B2b, todavía
   sin frontend). Por grupo: identidad básica, membresías con períodos (members) y partidos
   candidatos de [p_week_from, p_week_to) (weekMatches) — misma forma exacta que
   get_group_detail/get_group_competition_data, para que groups.js siga siendo la única
   autoridad de puntos/top-3/posiciones. Ordenado por actividad significativa real del grupo,
   nunca por actividad del caller.';

revoke all on function public.get_groups_lobby(timestamptz, timestamptz) from public;
grant execute on function public.get_groups_lobby(timestamptz, timestamptz) to authenticated;
