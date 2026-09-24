-- Pre-Production P0.1 — hotfix get_public_profile count(*) bigint -> integer (24/09/2026).
--
-- La migración bloque6_public_match_outcomes agregó matches_played/matches_won como INTEGER
-- en RETURNS TABLE, pero PostgreSQL count(*) devuelve BIGINT. En PL/pgSQL RETURN QUERY no hace
-- cast implícito de la estructura de la fila y la RPC fallaba con:
--   structure of query does not match function result type
--   Returned type bigint does not match expected type integer in column 15.
--
-- Único cambio: cast explícito de ambos conteos agregados a integer.
-- No cambia permisos, privacidad, filtros ni semántica de Perfil público.

create or replace function public.get_public_profile(p_player_id uuid)
returns table (
  player_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  competitive_branch text,
  dominant_hand text,
  preferred_side text,
  locality_label text,
  province_label text,
  level_status text,
  level_public numeric,
  rated_matches integer,
  distinct_opponents integer,
  matches_played integer,
  matches_won integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id
  from public.players p
  where p.auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'get_public_profile', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select
      pl.player_id,
      pr.username,
      pr.display_name,
      pr.first_name,
      pr.last_name,
      pr.competitive_branch,
      pr.dominant_hand,
      pr.preferred_side,
      loc.locality_label,
      loc.province_label,
      ls.status,
      round(ls.mu, 1),
      coalesce(ls.rated_matches, 0),
      coalesce(ls.distinct_opponents, 0),
      coalesce(pubstats.matches_played, 0)::integer,
      coalesce(pubstats.matches_won, 0)::integer
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.locations loc on loc.location_id = pr.location_id
    left join public.level_states ls on ls.player_id = pl.player_id
    left join lateral (
      select
        count(*) as matches_played,
        count(*) filter (where m.winner_team = mp.team) as matches_won
      from public.match_participants mp
      join public.matches m on m.match_id = mp.match_id
      where mp.player_id = pl.player_id
        and m.status = 'validated'
        and m.winner_team is not null
    ) pubstats on true
    where pl.type = 'registered'
      and pl.is_active
      and pl.player_id = p_player_id
      and pr.username is not null;
end;
$$;

comment on function public.get_public_profile is
  'Perfil público de un player_id puntual, mismas columnas/exclusiones que search_players más matches_played/matches_won (Pre-Production P0.1). Hotfix 24/09/2026: casts explícitos count(*) bigint -> integer para respetar RETURNS TABLE.';

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;
