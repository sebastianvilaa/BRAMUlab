-- BRAMUlab — Ronda correctiva QA 26SEP (§15.24 punto 5 del handoff — "Mis Jugadores / Agregar
-- Jugador — terminar migración server-backed").
--
-- CONTEXTO: la pestaña JUGADORES y el botón AGREGAR JUGADOR se ocultaron para cuentas
-- server-backed en la Ronda UX 25/09 porque la implementación legacy (Store.loadAddedPlayers/
-- addPlayerToList, store.js) persiste la lista por NOMBRE en localStorage — exactamente la misma
-- identidad-por-nombre que Backend Bloque 4 ya había corregido en el resto de la app. Ese camino
-- legacy queda INTACTO acá (nunca se toca ni se migra automáticamente) para cuentas locales/sin
-- backend. Esta migración construye el equivalente real server-backed, por player_id.
--
-- PRODUCTO CONFIRMADO (mismo criterio que store.js ya documenta para la versión legacy, ver su
-- comentario de cabecera "Relación simple... nunca amistad/seguimiento recíproco"):
--   - lista privada personal, unilateral (el otro jugador NUNCA se entera, sin notificación);
--   - no afecta Nivel BRAMU, Ranking ni Mi red;
--   - agregar/quitar es reversible, sin confirmación (no es una acción destructiva de datos de
--     partido);
--   - solo jugadores REGISTRADOS reales (nunca un provisional, nunca una cuenta inactiva/sin
--     perfil completo — mismas exclusiones que search_players/get_public_profile);
--   - no puede agregarse a sí mismo;
--   - orden: más recientemente agregado primero.
--
-- DISEÑO:
--   1) player_saved_players — tabla mínima (owner_player_id, saved_player_id, created_at), clave
--      primaria compuesta (ya garantiza "agregar dos veces no duplica", sin un unique aparte).
--      RLS habilitada, CERO políticas (deny-by-default, mismo patrón que public.players desde
--      Bloque 1) — todo acceso real pasa por las 4 RPCs de abajo, SECURITY DEFINER.
--   2) save_player(p_saved_player_id) — agrega, idempotente. Rechaza auto-agregado y cualquier
--      player_id que no sea una cuenta registrada/activa/con perfil completo visible (mismas
--      exclusiones de siempre) con un código de negocio estructurado (`{ok:false, code}`, nunca
--      una excepción sin capturar para un caso esperable — mismo criterio que
--      claim_provisional_player).
--   3) remove_saved_player(p_saved_player_id) — quita, idempotente (nunca falla si ya no estaba).
--   4) list_saved_players() — lista compacta completa del caller, más reciente primero. Mismas
--      exclusiones que search_players/get_public_profile aplicadas EN LA LECTURA: si un jugador
--      guardado se dio de baja o quedó inactivo después de agregarlo, la relación en la tabla NO
--      se borra (privada, reversible, nunca se pierde sin que el usuario la quite a propósito)
--      pero esa fila simplemente no aparece en la lista — nunca se inventa un jugador inactivo.
--   5) is_player_saved(p_player_id) — para que Perfil público sepa si mostrar AGREGAR JUGADOR o
--      la acción de quitar, con UNA sola llamada liviana (índice, no un table scan del listado
--      completo).
--
-- NUNCA se toca store.js/localStorage ni se migra ningún nombre guardado por coincidencia — eso
-- es responsabilidad explícita del frontend (fuera de esta migración) y está prohibido por el
-- handoff ("NO migrar automáticamente... No borrar esos datos legacy").
--
-- NO aplicada desde esta sesión (sin Supabase CLI ni credenciales en este sandbox, igual que
-- todas las rondas anteriores) — Central la revisará y aplicará contra Staging real.

-- ------------------------------------------------------------------
-- 1) player_saved_players
-- ------------------------------------------------------------------

create table public.player_saved_players (
  owner_player_id uuid not null references public.players (player_id) on delete cascade,
  saved_player_id uuid not null references public.players (player_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_player_id, saved_player_id),
  constraint player_saved_players_no_self check (owner_player_id <> saved_player_id)
);

comment on table public.player_saved_players is
  'Lista privada personal "agregué a este jugador para tenerlo a mano" — NUNCA amistad/follow ni
   relación recíproca (mismo producto que la versión legacy de store.js#addPlayerToList, ahora por
   player_id). Unilateral: el jugador guardado nunca se entera. No afecta Nivel/Ranking/Mi red. La
   clave primaria compuesta ya garantiza que agregar dos veces no duplica. Deny-by-default: RLS
   habilitada, cero políticas — todo acceso real vía save_player/remove_saved_player/
   list_saved_players/is_player_saved (SECURITY DEFINER), mismo patrón que public.players desde
   Bloque 1.';

alter table public.player_saved_players enable row level security;

create index player_saved_players_owner_idx on public.player_saved_players (owner_player_id, created_at desc);

-- ------------------------------------------------------------------
-- 2) save_player — agrega, idempotente.
-- ------------------------------------------------------------------

create or replace function public.save_player(p_saved_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_target_visible boolean;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'save_player', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_saved_player_id is null then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  if p_saved_player_id = v_caller_player_id then
    return jsonb_build_object('ok', false, 'code', 'cannot_save_self');
  end if;

  -- Mismas exclusiones que search_players/get_public_profile/get_players_compact: solo una
  -- cuenta registrada, activa, con perfil completo es "visible" para este camino.
  select exists(
    select 1 from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    where pl.player_id = p_saved_player_id
      and pl.type = 'registered'
      and pl.is_active
      and pr.username is not null
  ) into v_target_visible;

  if not v_target_visible then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  insert into public.player_saved_players (owner_player_id, saved_player_id)
  values (v_caller_player_id, p_saved_player_id)
  on conflict (owner_player_id, saved_player_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.save_player is
  'Agrega p_saved_player_id a la lista privada del caller. Idempotente (on conflict do nothing).
   {ok:false, code:cannot_save_self} para auto-agregado, {ok:false, code:player_not_found} para un
   player_id que no es una cuenta registrada/activa/con perfil completo visible — nunca una
   excepción sin capturar para estos dos casos esperables (mismo criterio que
   claim_provisional_player).';

revoke all on function public.save_player(uuid) from public;
grant execute on function public.save_player(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 3) remove_saved_player — quita, idempotente.
-- ------------------------------------------------------------------

create or replace function public.remove_saved_player(p_saved_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'remove_saved_player', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  delete from public.player_saved_players
  where owner_player_id = v_caller_player_id and saved_player_id = p_saved_player_id;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.remove_saved_player is
  'Quita p_saved_player_id de la lista privada del caller. Idempotente: {ok:true} incluso si no
   estaba guardado (nunca falla por "ya no está").';

revoke all on function public.remove_saved_player(uuid) from public;
grant execute on function public.remove_saved_player(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 4) list_saved_players — lista compacta completa, más reciente primero.
-- ------------------------------------------------------------------

create or replace function public.list_saved_players()
returns table (
  player_id uuid,
  username text,
  display_name text,
  level_status text,
  level_public numeric,
  avatar_url text,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'list_saved_players', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select
      pl.player_id, pr.username, pr.display_name,
      ls.status, round(ls.mu, 1), pr.avatar_url,
      psp.created_at
    from public.player_saved_players psp
    join public.players pl on pl.player_id = psp.saved_player_id
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.level_states ls on ls.player_id = pl.player_id
    where psp.owner_player_id = v_caller_player_id
      and pl.type = 'registered'
      and pl.is_active
      and pr.username is not null
    order by psp.created_at desc;
end;
$$;

comment on function public.list_saved_players is
  'Lista privada del caller, más reciente agregado primero. Mismas exclusiones que
   search_players/get_public_profile aplicadas EN LA LECTURA: la relación en player_saved_players
   nunca se borra sola, pero un jugador que se dio de baja/quedó inactivo/sin perfil completo
   después de agregarse simplemente no aparece acá — nunca se inventa una fila para él.
   avatar_url es una RUTA de Storage del bucket privado "avatars" — el cliente la resuelve a firma
   temporal (auth.js#resolveAvatarUrlsBatch), igual que search_players/get_players_compact.';

revoke all on function public.list_saved_players() from public;
grant execute on function public.list_saved_players() to authenticated;

-- ------------------------------------------------------------------
-- 5) is_player_saved — lookup liviano puntual para Perfil público.
-- ------------------------------------------------------------------

create or replace function public.is_player_saved(p_player_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'is_player_saved', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return exists(
    select 1 from public.player_saved_players
    where owner_player_id = v_caller_player_id and saved_player_id = p_player_id
  );
end;
$$;

comment on function public.is_player_saved is
  'true si p_player_id ya está en la lista privada del caller — lookup por índice, para que
   Perfil público decida AGREGAR JUGADOR vs. la acción de quitar sin traer la lista completa.';

revoke all on function public.is_player_saved(uuid) from public;
grant execute on function public.is_player_saved(uuid) to authenticated;
