-- BRAMUlab — Grupos BRAMU · cierre B1 tras QA real · regla A (handoff 71 §A, 28/09/2026).
--
-- QA real: Esteban+Matu vs Seba+Pablito ya era oficial con Esteban+Matu+Seba en el grupo (3/4,
-- ya contaba). Pablito se agregó DESPUÉS, misma semana BRAMU — producto cerró: el alta/reingreso
-- de un jugador vale, para el CÓMPUTO DEPORTIVO de Grupos, desde el LUNES 00:00 (hora local) de
-- la semana en que ocurrió, nunca desde semanas anteriores. Puede convertir retroactivamente un
-- partido 2/4 en 3/4 dentro de esa misma semana.
--
-- La fórmula/motor NO se duplica en SQL (sigue siendo bramulab/groups.js, ver su función nueva
-- `isMemberDeportivamenteActiveAt` en el mismo commit): esta migración solo AMPLÍA el umbral de
-- candidatos de `get_group_competition_data` para que el SQL nunca EXCLUYA un partido que el
-- motor JS consideraría válido (la única dirección prohibida por el handoff — "no puede ocurrir
-- que SQL excluya un partido que JS consideraría válido"). El límite exacto del lunes depende de
-- la zona horaria LOCAL del dispositivo (PH.startOfWeekMonday ya funciona así desde Etapa 3 —
-- Backend_Infraestructura.md nunca fijó una zona horaria única de servidor para "semana BRAMU"),
-- así que replicar ese cálculo exacto acá dividiría la autoridad en dos calendarios que podrían
-- divergir por husos horarios. En cambio, el SQL amplía el umbral en 7 días (cota segura: el
-- lunes de cualquier semana está, como mucho, 6 días y pico antes de cualquier instante de esa
-- semana, en cualquier huso horario razonable) y groups.js sigue siendo la ÚNICA autoridad que
-- decide, con el piso exacto por semana local, si un partido realmente cuenta — mismo patrón ya
-- documentado en la Fase A original ("el motor JS sigue siendo la autoridad y la re-evalúa con
-- los períodos que también recibe"). Devolver de más nunca es un problema (el motor lo descarta);
-- devolver de menos sí lo sería (el motor nunca vería el partido).
--
-- Consecuencia esperada y ya cubierta en `supabase/tests/verify-preprod-grupos-fase-a.sql` (T11,
-- comentario actualizado en este mismo commit): con este hotfix, el SQL puede devolver como
-- candidato algún partido que el motor JS igual descarta (p. ej. jugado antes del lunes de la
-- semana real de alta) — la aserción de ese test se amplió para reflejarlo, sin dejar de probar
-- que sigue excluyendo lo que nunca puede calificar (miembro ajeno al grupo, partido pendiente).
--
-- `leftAt` (baja) NO se toca: la regla nueva es solo sobre altas/reingresos. Eliminar un miembro
-- sigue sin des-contar retroactivamente partidos ya contados (handoff 71 §B) — ver también el fix
-- de visibilidad (ocultamiento total del miembro eliminado), que es enteramente client-side
-- (groups.js#membersRelevantForWeek), sin cambios de esquema/RPC.

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
  v_matches jsonb;
begin
  if p_group_id is null or not exists (
    select 1 from public.groups g
    join public.group_memberships gm on gm.group_id = g.group_id and gm.player_id = v_caller and gm.left_at is null
    where g.group_id = p_group_id and g.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'group_not_found');
  end if;

  with mem as (
    select gm.player_id, gm.joined_at, gm.left_at,
           -- Cota segura de "lunes de la semana de joined_at" en cualquier huso horario: nunca
           -- excluye un candidato que el piso semanal EXACTO (calculado en groups.js) aceptaría.
           gm.joined_at - interval '7 days' as effective_from
    from public.group_memberships gm where gm.group_id = p_group_id
  ),
  cand as (
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
        join mem on mem.player_id = mp.player_id
                and mem.effective_from <= m.played_at
                and (mem.left_at is null or m.played_at < mem.left_at)
        where mp.match_id = m.match_id
      ) >= 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'matchId', c.match_id,
    'playedAt', c.played_at,
    'playedAtTimeKnown', c.played_at_time_known,
    'formatId', c.format_id,
    'scoringSystem', c.scoring_system,
    'winnerTeam', c.winner_team,
    'sets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
               'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b) order by ms.set_number)
      from public.match_sets ms
      join public.match_revisions mr on mr.match_id = ms.match_id and mr.revision_number = ms.revision_number
      where mr.revision_id = c.current_revision_id
    ), '[]'::jsonb),
    'players', (
      select jsonb_agg(jsonb_build_object(
               'playerId', mp.player_id,
               'team', mp.team,
               'position', mp.position_in_team,
               'isGroupMember', exists (
                 select 1 from mem
                 where mem.player_id = mp.player_id and mem.effective_from <= c.played_at
                   and (mem.left_at is null or c.played_at < mem.left_at)),
               'levelBefore', (
                 select mlrp.effective_level
                 from public.match_level_results mlr
                 join public.match_level_result_players mlrp on mlrp.result_id = mlr.result_id
                 where mlr.match_id = c.match_id and mlr.effect_status = 'applied' and mlr.eligible
                   and mlrp.player_id = mp.player_id)
             ) order by mp.team, mp.position_in_team)
      from public.match_participants mp where mp.match_id = c.match_id
    )
  ) order by c.played_at, c.match_id), '[]'::jsonb)
  into v_matches
  from cand c;

  return jsonb_build_object(
    'ok', true,
    'group', public._groups_detail_json(p_group_id, v_caller),
    'matches', v_matches
  );
end;
$$;

comment on function public.get_group_competition_data(uuid, timestamptz, timestamptz) is
  'Lectura deportiva de un grupo (solo miembros activos; group_not_found si no). Devuelve datos
   normalizados para el motor puro bramulab/groups.js — NO calcula puntos. El umbral de
   participantes candidatos (>=3) amplía el alta/reingreso en 7 días (cota segura de "lunes de esa
   semana" en cualquier huso horario) — el piso semanal EXACTO y la decisión final de qué partido
   realmente cuenta siguen siendo autoridad exclusiva de groups.js (handoff 71 §A, 28/09/2026).
   matches: sets de la revisión OFICIAL vigente, los 4 participantes por player_id, isGroupMember
   (misma ampliación) y levelBefore (Nivel oficial previo al partido, NULL si no hay evidencia =>
   sin bonus Sorpresa). group.members trae los períodos históricos de pertenencia.';

-- Permisos sin cambios (mismo GRANT que Fase A, CREATE OR REPLACE los conserva) — se repite
-- explícito por si algún entorno recreó la función a mano sin conservar el GRANT original.
revoke all on function public.get_group_competition_data(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_group_competition_data(uuid, timestamptz, timestamptz) to authenticated;
