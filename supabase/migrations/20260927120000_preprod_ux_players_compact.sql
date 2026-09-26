-- BRAMUlab — Ronda correctiva QA 26SEP (§15.24 "Fila compacta server-backed de jugador").
--
-- HALLAZGOS REALES (QA física sobre 04.11-h7):
--   - BUSCAR JUGADORES (search_players): username y Nivel reales, pero el avatar SIEMPRE muestra
--     inicial aunque el Perfil público de la MISMA persona sí tenga foto (§15.23). Causa real:
--     search_players nunca seleccionó profiles.avatar_url — a diferencia de get_public_profile,
--     que sí lo agregó en P0.1C (ver 20260924130000_preprod_p01c_profile_editable.sql §8). No es
--     un fallo de almacenamiento: la foto existe, la RPC de búsqueda simplemente nunca la trae.
--   - RECIENTES (Cargar partido): identidad real por player_id (PH.computeRecentRealPlayers), con
--     subtítulo redundante "Jugaron juntos antes" en vez de @username/Nivel, porque la única
--     fuente disponible hoy es el HISTORIAL LOCAL (match-sync.js#buildLocalPlayers) — trae
--     {player_id, nombre} nada más, nunca username/Nivel/avatar (esos campos server-backed nunca
--     se leyeron para esas filas).
--
-- SOLUCIÓN (instrucción explícita: nunca N llamadas get_public_profile por fila):
--   1) search_players gana avatar_url — misma semántica que get_public_profile: RUTA de Storage
--      del bucket privado "avatars" (nunca una URL pública ni ya resuelta), el cliente la resuelve
--      a firma temporal con su propia sesión (auth.js#resolveAvatarUrl), igual que ya hace con
--      get_public_profile.
--   2) get_players_compact(p_player_ids uuid[]) — RPC batch NUEVA: una sola llamada de red para
--      resolver player_id/username/display_name/level_status/level_public/avatar_url de una lista
--      de IDs que el CALLER ya conoce (nunca acepta texto libre — no es un mecanismo de
--      descubrimiento como search_players). Pensada para RECIENTES hoy; el mismo contrato sirve
--      para Mis Jugadores (handoff punto 5) sin otra migración. Mismas exclusiones que
--      search_players/get_public_profile (registrado, activo, con username) y mismo criterio de
--      "0 filas ⇒ no existe/no visible, nunca se inventa un valor". Tope de 50 IDs por llamada:
--      ninguna lista real (Recientes, Mis Jugadores) se acerca a ese tamaño — evita que esto sirva
--      como forma indirecta de volcar la tabla completa de a poco.
--
-- NO se toca get_public_profile (ya correcto desde P0.1C), NO se persiste ninguna URL firmada
-- (se resuelve de nuevo en cada lectura, mismo criterio que el resto del archivo), NO se altera
-- ninguna otra RPC/tabla. NO aplicada desde esta sesión (sin Supabase CLI ni credenciales en este
-- sandbox, igual que todas las rondas anteriores) — Central la revisará y aplicará contra Staging
-- real.

-- ------------------------------------------------------------------
-- 1) search_players — suma avatar_url (misma RUTA de Storage que get_public_profile). CREATE OR
--    REPLACE puro sobre la MISMA firma de columnas de siempre + una nueva al final (aditivo,
--    ningún cliente que lea por posición se rompe distinto de como ya podría romperse hoy;
--    auth.js#searchPlayers ya traduce por nombre de columna, nunca por índice).
-- ------------------------------------------------------------------

drop function if exists public.search_players(text, integer);

create or replace function public.search_players(p_query text, p_limit integer default 20)
returns table (
  player_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  competitive_branch text,
  dominant_hand text,
  preferred_side text,
  level_status text,
  level_public numeric,
  rated_matches integer,
  distinct_opponents integer,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 25);
  v_query_lower text;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'search_players', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if left(v_query, 1) = '@' then
    v_query := substring(v_query from 2);
  end if;
  v_query := trim(v_query);

  if length(v_query) < 2 or length(v_query) > 40 then
    return;
  end if;

  v_query_lower := lower(v_query);

  return query
    select
      pl.player_id, pr.username, pr.display_name, pr.first_name, pr.last_name,
      pr.competitive_branch, pr.dominant_hand, pr.preferred_side,
      ls.status, round(ls.mu, 1), coalesce(ls.rated_matches, 0), coalesce(ls.distinct_opponents, 0),
      pr.avatar_url
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.level_states ls on ls.player_id = pl.player_id
    where pl.type = 'registered'
      and pl.is_active
      and pl.player_id <> v_caller_player_id
      and pr.username is not null
      and (
        position(v_query_lower in lower(pr.username)) > 0
        or position(v_query_lower in lower(pr.display_name)) > 0
        or position(v_query_lower in lower(pr.first_name)) > 0
        or position(v_query_lower in lower(pr.last_name)) > 0
      )
    order by pr.username asc
    limit v_limit;
end;
$$;

comment on function public.search_players is
  'Búsqueda pública acotada de cuentas registradas con perfil completo, authenticated-only. Nunca
   devuelve provisionales ni campos privados. Ronda correctiva QA 26SEP: suma avatar_url (RUTA de
   Storage del bucket privado "avatars", el cliente la resuelve a firma temporal) — antes ausente,
   causaba que la fila de búsqueda mostrara inicial aunque el Perfil público de la misma persona sí
   tuviera foto. Ver Backend_Infraestructura.md §8.4/§10.4.';

revoke all on function public.search_players(text, integer) from public;
grant execute on function public.search_players(text, integer) to authenticated;

-- ------------------------------------------------------------------
-- 2) get_players_compact — batch por player_ids YA conocidos por el caller (RECIENTES hoy,
--    reutilizable por Mis Jugadores). NUNCA acepta texto libre — a diferencia de search_players,
--    no es un mecanismo de descubrimiento; solo resuelve identidad/Nivel/avatar para IDs que el
--    cliente ya trae de su propio historial o de una lista propia.
-- ------------------------------------------------------------------

create or replace function public.get_players_compact(p_player_ids uuid[])
returns table (
  player_id uuid,
  username text,
  display_name text,
  level_status text,
  level_public numeric,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_ids uuid[];
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'get_players_compact', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Dedupe primero, LIMIT de 50 después — nunca al revés (evita descartar un id real solo porque
  -- venía duplicado antes de la posición 50 en el array de entrada).
  select array_agg(x) into v_ids
  from (
    select distinct unnest(coalesce(p_player_ids, array[]::uuid[])) as x
    limit 50
  ) dedup;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return;
  end if;

  return query
    select
      pl.player_id, pr.username, pr.display_name,
      ls.status, round(ls.mu, 1), pr.avatar_url
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.level_states ls on ls.player_id = pl.player_id
    where pl.type = 'registered'
      and pl.is_active
      and pr.username is not null
      and pl.player_id = any(v_ids);
end;
$$;

comment on function public.get_players_compact is
  'Batch de identidad/Nivel/avatar por player_ids YA conocidos por el caller (RECIENTES, Mis
   Jugadores) — NUNCA búsqueda por texto libre, mismas exclusiones que search_players/
   get_public_profile (registrado, activo, con username). avatar_url es una RUTA de Storage del
   bucket privado "avatars" — el cliente la resuelve a firma temporal (auth.js#resolveAvatarUrl),
   igual que search_players/get_public_profile; nunca se persiste esa firma. Sin orden garantizado
   ni columna "no encontrado": un player_id ausente en el resultado significa que no es una cuenta
   registrada activa visible (provisional, inactiva, o sin perfil completo) — el cliente arma su
   propio Map(player_id -> fila) y decide el estado honesto para los que falten, nunca inventa
   username/Nivel. Tope de 50 IDs distintos por llamada.';

revoke all on function public.get_players_compact(uuid[]) from public;
grant execute on function public.get_players_compact(uuid[]) to authenticated;
