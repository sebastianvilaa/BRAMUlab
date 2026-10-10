-- BRAMUlab — V04.40 · Ronda 2 post-lanzamiento: DESCUBRIMIENTO de jugadores dentro de BUSCAR JUGADORES.
--
-- Una sola RPC de lectura, `get_player_discovery`, con dos secciones:
--   'connections'  GENTE QUE QUIZÁS CONOZCAS — conexión INDIRECTA derivada exclusivamente de partidos OFICIALES reales:
--                  yo compartí un partido `validated` con Juan; Juan compartió otro partido `validated` con Pedro; Pedro
--                  (a quien nunca vi en un partido oficial) aparece sugerido. Se cuenta cualquier participante del mismo
--                  partido (pareja o rival). Nunca se devuelve QUIÉN es el intermediario ni QUÉ partido originó la sugerencia.
--   'zone'         JUGADORES DE TU ZONA — cuentas registradas activas con el MISMO `profiles.location_id` que el caller
--                  (localidad canónica; nunca GPS, distancia ni ampliación de la zona cuando hay pocos jugadores).
--
-- Estados de partido computables/oficiales: SOLO `validated` (pending_validation / expired / annulled nunca cuentan).
-- Un slot cuyo `player_id` es NULL (incidencia de identidad abierta o «sin identificar») no genera conexión.
--
-- Elegibilidad de quien se sugiere — las MISMAS exclusiones que `search_players` / `get_players_compact`:
--   players.type = 'registered' · players.is_active · profiles.username no nulo (cuenta con perfil completo) ·
--   nunca el propio caller · nunca provisionales ni cuentas eliminadas/anonimizadas (is_active = false).
-- Además: nunca se sugiere a quien el caller ya guardó en «Mis jugadores» (`player_saved_players`), y en
-- 'connections' tampoco a quien ya compartió un partido oficial con el caller (no sería una conexión indirecta).
-- Sin duplicados entre secciones: quien aparece en 'connections' no se repite en 'zone'.
--
-- Orden (simple y determinista, sin popularidad ni puntajes artificiales):
--   connections: más conexiones en común (cantidad de personas con las que compartiste partido y que jugaron con esa
--                persona), luego @usuario ascendente. La cantidad NO se devuelve.
--   zone:        orden estable por viewer = md5(player_id || caller). Misma lista en cada llamada del mismo viewer, pero
--                distinta entre viewers, para que ningún jugador quede siempre primero ni siempre oculto.
--
-- Seguridad / resistencia a enumeración:
--   * SECURITY DEFINER, `search_path = public`, solo `authenticated` (sin EXECUTE para anon ni PUBLIC).
--   * Exige sesión con player propio (`no_player_for_session`) y rate limit (20 llamadas / 60 s por jugador, `rate_limited`).
--   * Sin parámetros de texto, sin offset ni paginación: el máximo por sección es 8 (default 5) y la lista es la misma en
--     cada llamada, así que no sirve para recorrer la tabla ni para reconstruir relaciones de terceros.
--   * Devuelve únicamente campos deportivos que `search_players` ya muestra a cualquier usuario autenticado (@usuario,
--     nombre, avatar como RUTA de Storage, estado/valor público del Nivel). Nunca fechas, equipos, resultados, ids de partido
--     ni cuántos partidos tiene una persona.
--
-- No crea tablas de relaciones sociales ni columnas nuevas. Solo agrega un índice sobre profiles(location_id) para la
-- sección de zona. NO aplicada desde esta sesión (sin Supabase CLI ni credenciales, igual que las rondas anteriores) —
-- Central la revisa y la aplica contra Supabase STAGING; nunca contra Production hasta autorización explícita.

create index if not exists profiles_location_id_idx on public.profiles (location_id) where location_id is not null;

create or replace function public.get_player_discovery(p_limit integer default 5)
returns table (
  section text,
  player_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  level_status text,
  level_public numeric,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 8);
  v_location uuid;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller, 'get_player_discovery', 20, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select pr.location_id into v_location from public.profiles pr where pr.player_id = v_caller;

  return query
  with direct as (
    -- Quienes compartieron un partido OFICIAL conmigo (pareja o rival).
    select distinct other.player_id as pid
    from public.match_participants mine
    join public.matches m on m.match_id = mine.match_id and m.status = 'validated'
    join public.match_participants other
      on other.match_id = m.match_id and other.player_id is not null and other.player_id <> v_caller
    where mine.player_id = v_caller
  ),
  saved as (
    select s.saved_player_id as pid from public.player_saved_players s where s.owner_player_id = v_caller
  ),
  indirect as (
    -- Quienes compartieron un partido OFICIAL con alguien de `direct`, sin ser yo ni estar ya en `direct`.
    select cand.player_id as pid, count(distinct d.pid) as mutuals
    from direct d
    join public.match_participants via on via.player_id = d.pid
    join public.matches m on m.match_id = via.match_id and m.status = 'validated'
    join public.match_participants cand
      on cand.match_id = m.match_id and cand.player_id is not null and cand.player_id <> v_caller
    where not exists (select 1 from direct dd where dd.pid = cand.player_id)
    group by cand.player_id
  ),
  eligible as (
    select pl.player_id as pid, pr.username as un, pr.display_name as dn, pr.first_name as fn, pr.last_name as ln,
           pr.location_id as loc, pr.avatar_url as av, ls.status as lstatus, round(ls.mu, 1) as lpublic
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.level_states ls on ls.player_id = pl.player_id
    where pl.type = 'registered'
      and pl.is_active
      and pl.player_id <> v_caller
      and pr.username is not null
      and not exists (select 1 from saved sv where sv.pid = pl.player_id)
  ),
  conn as (
    select e.*, i.mutuals
    from indirect i
    join eligible e on e.pid = i.pid
    order by i.mutuals desc, e.un asc
    limit v_limit
  ),
  zn as (
    select e.*
    from eligible e
    join public.locations lo on lo.location_id = e.loc and lo.is_active
    where v_location is not null
      and e.loc = v_location
      and not exists (select 1 from conn c where c.pid = e.pid)
    order by md5(e.pid::text || v_caller::text) asc, e.pid asc
    limit v_limit
  )
  select 'connections'::text, c.pid, c.un, c.dn, c.fn, c.ln, c.lstatus, c.lpublic, c.av from conn c
  union all
  select 'zone'::text, z.pid, z.un, z.dn, z.fn, z.ln, z.lstatus, z.lpublic, z.av from zn z;
end;
$$;

comment on function public.get_player_discovery is
  'Descubrimiento de jugadores para BUSCAR JUGADORES (Ronda 2, V04.40), authenticated-only. Dos secciones: connections
   (conexión INDIRECTA derivada solo de partidos oficiales/validated, sin revelar intermediario ni partido) y zone
   (misma profiles.location_id canónica). Mismas exclusiones que search_players (registrado, activo, con username; nunca
   provisionales, eliminados, el propio caller ni los ya guardados en Mis jugadores), sin duplicados entre secciones,
   tope 8 por sección, orden determinista, rate limit 20/60 s, sin texto libre ni paginación (no sirve para enumerar).
   avatar_url es una RUTA de Storage del bucket privado "avatars", igual que search_players.';

revoke all on function public.get_player_discovery(integer) from public;
grant execute on function public.get_player_discovery(integer) to authenticated;
