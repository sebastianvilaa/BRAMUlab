-- BRAMUlab — Bloque 4: Jugadores, búsqueda e invitados provisionales.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_04/03_Revision_ChatGPT.md para las
-- decisiones cerradas que esta migración implementa. Resumen:
--
--   1) `pgcrypto` — ya instalada en Staging en el schema `extensions` (Decisión 3 de la
--      revisión); igual se declara acá de forma idempotente para que un futuro entorno de
--      Producción sea reproducible sin un paso manual en el Dashboard;
--   2) `provisional_claims` — hash del token (nunca el token crudo), expiración a 30 días
--      (Decisión 1), un único link `pending` por identidad provisional (índice único parcial),
--      RLS deny-by-default TOTAL — cero políticas, solo alcanzable vía las RPCs de abajo;
--   3) `api_rate_limits` — rate limiting mínimo server-only (§4/Decisión 4 de la revisión:
--      "NO se aprueba omitirlo"), tabla de contadores + helper `consume_rate_limit`, sin
--      infraestructura externa (Redis/Edge rate limiter);
--   4) `search_players`/`get_public_profile` — RPCs SECURITY DEFINER, únicamente
--      `authenticated` (nunca `anon`), columnas declaradas explícitamente (nunca `select *`),
--      excluyen provisionales, cuentas sin perfil completo todavía y al propio caller;
--   5) `create_provisional_player` — SIEMPRE un UUID nuevo, SIN deduplicación por nombre (§3 de
--      la revisión, corrección obligatoria sobre el análisis original: "nombres iguales nunca
--      se fusionan solos", ni siquiera dentro del mismo creador);
--   6) `list_my_provisional_players` — RPC acotada; NUNCA una policy de SELECT directo sobre
--      `players` (§4 de la revisión, corrección obligatoria: expondría `auth_user_id` de una
--      identidad ya reclamada). Dueño de la tabla ve solo sus provisionales AÚN no reclamadas;
--   7) `create_claim_link` — genera/rota el token (256 bits, hash sha256 vía pgcrypto),
--      devuelto crudo una sola vez;
--   8) `claim_provisional_player` — consumo atómico. PRESERVA `pilot_events` (§5 de la
--      revisión, corrección obligatoria: reasignar, nunca borrar — `pilot_events.player_id` NO
--      tiene `ON DELETE CASCADE`, y `signup_completed` es evidencia válida del alta); agrega
--      `'provisional_claimed'` al CHECK de `pilot_events.event_name` para poder emitirlo.
--
-- Deliberadamente FUERA de esta migración (no le corresponde a Bloque 4):
--   - `matches`/`match_participants` reales: Bloque 5.
--   - reutilización de una provisional DENTRO de la carga de un partido (selector de
--     participantes): Bloque 5 — acá solo quedan listas `create_provisional_player` +
--     `list_my_provisional_players` como contrato que ese bloque va a consumir.
--   - Ranking real / BRAMU Intelligence: Bloques 7/8.
--   - `canonical_player_id` (Backend_Infraestructura.md §6.1): mecanismo DISTINTO, reservado
--     para una unificación administrativa futura — esta migración no lo usa ni depende de él.
--
-- NO se aplica todavía a Supabase real (Staging/Producción): queda pendiente de un paso
-- explícito posterior, fuera de esta ronda (instrucción expresa: "no apliques nada a Supabase
-- real todavía").
--
-- Hotfix (2026-09-20, docs/BRAMUlab/Implementacion/Backend/Bloque_04/
-- 05_Revision_Post_Implementacion_ChatGPT.md) — correcciones obligatorias plegadas DIRECTO en
-- esta misma migración (nunca se llegó a aplicar en ningún entorno, así que no hace falta un
-- archivo de follow-up separado, a diferencia de los hotfixes de Bloque 3):
--   §1 — search_players: la búsqueda pasa a ser substring LITERAL vía `position(...)`, nunca
--        `ilike` con un patrón armado desde el input (`%%`/`__` ya no actúan como wildcard);
--        acepta un `@` inicial para @usuario; longitud máxima de query;
--   §3 — claim_provisional_player cambia su contrato a un resultado estructurado (`jsonb`
--        `{ok, code, player_id}`) para los errores de negocio esperables (`claim_invalid`,
--        `claim_expired`, `claim_already_used`, `account_already_registered`,
--        `account_already_claimed_identity`, `rate_limited`) — un `raise exception` sin capturar
--        revierte TODA la transacción de la función, incluido el incremento de
--        `consume_rate_limit` ya ejecutado antes; con un `return` normal ese incremento persiste;
--   §5 — longitud máxima de `p_display_name` en `create_provisional_player`; formato del token
--        de claim (64 hex) validado DESPUÉS de consumir cuota, para que un token con formato
--        inválido también cuente como intento real.

-- ------------------------------------------------------------------
-- 1) pgcrypto (Decisión 3)
-- ------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------
-- 2) pilot_events — agrega 'provisional_claimed' al CHECK existente (Bloque 2, §6.8)
-- ------------------------------------------------------------------

alter table public.pilot_events drop constraint if exists pilot_events_event_name_check;
alter table public.pilot_events add constraint pilot_events_event_name_check check (event_name in (
  'signup_started', 'signup_completed', 'level_started', 'level_confirmed',
  'match_created', 'match_validated', 'match_rejected',
  'calibration_1_5', 'calibration_3_5', 'calibration_5_5', 'daily_active',
  'provisional_claimed'
));

-- ------------------------------------------------------------------
-- 3) provisional_claims (Backend_Infraestructura.md §6.2/§9)
-- ------------------------------------------------------------------

create table public.provisional_claims (
  claim_id uuid primary key default gen_random_uuid(),
  provisional_player_id uuid not null references public.players (player_id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'expired', 'revoked')),
  created_by_player_id uuid not null references public.players (player_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by_player_id uuid references public.players (player_id)
);

comment on table public.provisional_claims is
  'Link de invitación/reclamo de una identidad provisional. Solo se guarda el hash del token
   (sha256), nunca el token crudo. RLS deny-by-default TOTAL: cero políticas, únicamente
   accesible mediante create_claim_link/claim_provisional_player (SECURITY DEFINER).';

alter table public.provisional_claims enable row level security;
-- Deny-by-default deliberado, mismo criterio que reserved_usernames/pilot_events: ni anon ni
-- authenticated pueden leer/escribir esta tabla directo.

-- Un único link ACTIVO por identidad provisional a la vez (Backend_Infraestructura.md §6.2:
-- "el link pertenece a la identidad provisional"). create_claim_link ya expira/revoca cualquier
-- 'pending' anterior antes de insertar uno nuevo — este índice es defensa en profundidad, no el
-- mecanismo principal.
create unique index provisional_claims_one_pending_per_player
  on public.provisional_claims (provisional_player_id)
  where status = 'pending';

create index provisional_claims_provisional_player_id_idx
  on public.provisional_claims (provisional_player_id);

-- ------------------------------------------------------------------
-- 4) api_rate_limits — rate limiting mínimo server-only (§4/Decisión 4 de la revisión)
-- ------------------------------------------------------------------

create table public.api_rate_limits (
  player_id uuid not null references public.players (player_id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  primary key (player_id, action, window_started_at)
);

comment on table public.api_rate_limits is
  'Contador de rate limiting server-only por jugador+acción+ventana fija. Sin RLS legible desde
   el cliente: solo lo usa consume_rate_limit (SECURITY DEFINER), llamado desde las RPCs de
   este archivo. No es infraestructura externa (sin Redis/Edge rate limiter) — alcanza para la
   escala del piloto (§4 de la revisión).';

alter table public.api_rate_limits enable row level security;
-- Deny-by-default: cero políticas para anon/authenticated.

/** Cuenta+registra un intento dentro de la ventana fija [floor(now()/window)*window, +window)
 *  para p_player_id+p_action. Ventana fija ancladas al epoch (no sliding window exacto) —
 *  simple y suficiente para la escala del piloto. Devuelve false si esta llamada ya superó
 *  p_max_requests dentro de la ventana vigente (la llamada igual queda contada: un intento que
 *  se rechaza por rate limit sigue siendo un intento). SECURITY DEFINER: la tabla no es legible
 *  ni escribible directo por el cliente. */
create or replace function public.consume_rate_limit(
  p_player_id uuid,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.api_rate_limits (player_id, action, window_started_at, request_count)
  values (p_player_id, p_action, v_window_start, 1)
  on conflict (player_id, action, window_started_at) do update
    set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_max_requests;
end;
$$;

comment on function public.consume_rate_limit is
  'Helper interno de rate limiting. Nunca se otorga EXECUTE a authenticated/anon: solo lo
   llaman las RPCs SECURITY DEFINER de este archivo.';

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public;

-- ------------------------------------------------------------------
-- 5) search_players / get_public_profile (§6 de la revisión, Backend_Infraestructura.md
--    §8.4/§10.2/§10.4)
-- ------------------------------------------------------------------

/** Búsqueda acotada de cuentas REGISTRADAS con perfil ya completo (nunca provisionales, nunca
 *  una cuenta a mitad de onboarding) por @usuario/nombre/apellido/display name.
 *  `authenticated` únicamente (nunca `anon`). Rate limit 30 req/60s por jugador (valores de la
 *  revisión §4). Query < 2 caracteres útiles devuelve vacío (nunca todo el universo); acepta un
 *  `@` inicial para @usuario (`@sebastian` encuentra el username `sebastian`, el símbolo nunca
 *  forma parte de la columna). Límite server-side fijo de 25 filas y longitud máxima de 40
 *  caracteres de query (hotfix §1/§5 de 05_Revision_Post_Implementacion_ChatGPT.md: una query
 *  absurdamente larga se trata igual que una corta, vacío controlado). Coincidencia por
 *  substring LITERAL vía `position(...)`, NUNCA `ilike` con un patrón armado desde el input —
 *  antes de este hotfix, `%%`/`__` actuaban como wildcard SQL y podían devolver el universo
 *  entero pese al mínimo de 2 caracteres, anulando la protección anti-enumeración. Nunca
 *  `select *`: cada columna pública se declara explícita (Backend_Infraestructura.md §5.1) —
 *  nunca email, auth_user_id, birth_date, género personal, terms_*, ni mu sin redondear. */
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
  distinct_opponents integer
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
      ls.status, round(ls.mu, 1), coalesce(ls.rated_matches, 0), coalesce(ls.distinct_opponents, 0)
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
  'Búsqueda pública acotada de cuentas registradas con perfil completo, authenticated-only.
   Nunca devuelve provisionales ni campos privados. Ver Backend_Infraestructura.md §8.4/§10.4.';

revoke all on function public.search_players(text, integer) from public;
grant execute on function public.search_players(text, integer) to authenticated;

/** Perfil público de un `player_id` puntual — mismas columnas/exclusiones que search_players,
 *  más localidad (etiquetas, nunca el location_id interno). Devuelve 0 filas para una
 *  provisional, un player_id inexistente o una cuenta sin perfil completo todavía — nunca
 *  confirma/niega la existencia de una provisional por esta vía. */
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
  distinct_opponents integer
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

  if not public.consume_rate_limit(v_caller_player_id, 'get_public_profile', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select
      pl.player_id, pr.username, pr.display_name, pr.first_name, pr.last_name,
      pr.competitive_branch, pr.dominant_hand, pr.preferred_side,
      loc.locality_label, loc.province_label,
      ls.status, round(ls.mu, 1), coalesce(ls.rated_matches, 0), coalesce(ls.distinct_opponents, 0)
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.locations loc on loc.location_id = pr.location_id
    left join public.level_states ls on ls.player_id = pl.player_id
    where pl.type = 'registered'
      and pl.is_active
      and pl.player_id = p_player_id
      and pr.username is not null;
end;
$$;

comment on function public.get_public_profile is
  'Perfil público de un player_id puntual, mismas columnas/exclusiones que search_players. 0
   filas para provisional/inexistente/perfil sin username todavía — nunca confirma ni niega
   la existencia de una provisional por esta vía.';

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 6) create_provisional_player — SIEMPRE un UUID nuevo (§3 de la revisión, corrección
--    obligatoria: "no reutilizar provisionales automáticamente por nombre")
-- ------------------------------------------------------------------

create or replace function public.create_provisional_player(p_display_name text)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_result public.players;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if v_display_name = '' then
    raise exception 'display_name_required' using errcode = 'P0001';
  end if;
  -- Hotfix §5 — longitud máxima razonable: nunca se restringe formato/acentos/caracteres
  -- humanos normales, solo se impide un payload absurdamente largo.
  if length(v_display_name) > 40 then
    raise exception 'display_name_too_long' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'create_provisional_player', 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.players (type, display_name, created_by_player_id)
  values ('provisional', v_display_name, v_caller_player_id)
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.create_provisional_player is
  'Crea SIEMPRE una nueva identidad provisional (UUID nuevo) — nunca reutiliza por nombre, ni
   siquiera dentro del mismo creador (03_Revision_ChatGPT.md §3: "nombres iguales nunca se
   fusionan solos"). Reutilizar una ya existente es una selección explícita por player_id,
   responsabilidad de Bloque 5 (selector de participantes de un partido).';

revoke all on function public.create_provisional_player(text) from public;
grant execute on function public.create_provisional_player(text) to authenticated;

-- ------------------------------------------------------------------
-- 7) list_my_provisional_players — RPC acotada (§4 de la revisión, corrección obligatoria:
--    NUNCA una policy de SELECT directo sobre `players`)
-- ------------------------------------------------------------------

create or replace function public.list_my_provisional_players()
returns table (
  player_id uuid,
  display_name text,
  created_at timestamptz,
  has_pending_claim boolean
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

  return query
    select
      pl.player_id, pl.display_name, pl.created_at,
      exists (
        select 1 from public.provisional_claims pc
        where pc.provisional_player_id = pl.player_id and pc.status = 'pending' and pc.expires_at > now()
      )
    from public.players pl
    where pl.type = 'provisional'
      and pl.created_by_player_id = v_caller_player_id
    order by pl.created_at desc;
end;
$$;

comment on function public.list_my_provisional_players is
  'Único camino de lectura de las provisionales propias — nunca una policy de SELECT directo
   sobre players, que expondría auth_user_id de una identidad ya reclamada (03_Revision_
   ChatGPT.md §4). Deja de listar una identidad en cuanto deja de ser type=provisional (fue
   reclamada).';

revoke all on function public.list_my_provisional_players() from public;
grant execute on function public.list_my_provisional_players() to authenticated;

-- ------------------------------------------------------------------
-- 8) create_claim_link — genera/rota el token de reclamo (Decisión 1: 30 días, rotación libre)
-- ------------------------------------------------------------------

create or replace function public.create_claim_link(p_provisional_player_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_provisional public.players;
  v_token text;
  v_token_hash text;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'create_claim_link', 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v_provisional from public.players where player_id = p_provisional_player_id for update;
  if v_provisional is null or v_provisional.type <> 'provisional' or v_provisional.created_by_player_id <> v_caller_player_id then
    raise exception 'provisional_not_found' using errcode = 'P0001';
  end if;

  -- Rotar: cualquier link 'pending' anterior de esta misma identidad queda 'revoked' antes de
  -- crear el nuevo (Decisión 1: "rotar invalida el token pendiente anterior").
  update public.provisional_claims
    set status = 'revoked'
    where provisional_player_id = p_provisional_player_id and status = 'pending';

  -- Token de 256 bits (pgcrypto), devuelto CRUDO una sola vez acá — nunca más recuperable; en
  -- la tabla solo se guarda su hash sha256.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.provisional_claims (
    provisional_player_id, token_hash, status, created_by_player_id, expires_at
  ) values (
    p_provisional_player_id, v_token_hash, 'pending', v_caller_player_id, now() + interval '30 days'
  );

  return v_token;
end;
$$;

comment on function public.create_claim_link is
  'Genera/rota el link de reclamo de una provisional propia. Devuelve el token crudo UNA sola
   vez — solo se persiste su hash. 30 días de vigencia (Decisión 1 de 03_Revision_ChatGPT.md),
   rotable en cualquier momento (rotar invalida el pendiente anterior).';

revoke all on function public.create_claim_link(uuid) from public;
grant execute on function public.create_claim_link(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 9) claim_provisional_player — consumo atómico, PRESERVANDO pilot_events (§5 de la revisión,
--    corrección obligatoria)
-- ------------------------------------------------------------------

/** Funde la identidad provisional (P1, la del token) en la cuenta que reclama (P2 — ya creada
 *  por handle_email_confirmed apenas confirmó su email). Debe llamarse ANTES de
 *  complete_profile/officialize_level_onboarding para esa cuenta, mientras P2 sigue sin perfil
 *  completo todavía (03_Revision_ChatGPT.md §2/Decisión 2: "antes de persistir/oficializar el
 *  onboarding en servidor"). Atómico vía `for update` sobre la fila del claim — dos intentos
 *  simultáneos del mismo token: solo uno gana. PRESERVA pilot_events (reasigna, nunca borra:
 *  pilot_events.player_id no tiene ON DELETE CASCADE y signup_completed es evidencia válida
 *  del alta) — mismo criterio se extiende, por seguridad, a cualquier fila que P2 pudiera haber
 *  creado como creador (players.created_by_player_id/provisional_claims.created_by_player_id),
 *  para que el DELETE de P2 nunca falle por una referencia huérfana.
 *
 *  Hotfix §3 (05_Revision_Post_Implementacion_ChatGPT.md) — CAMBIO DE CONTRATO: devuelve
 *  `jsonb` (`{ok, code, player_id}`) en vez de `public.players` + `raise exception` para los
 *  errores de negocio ESPERABLES (`claim_invalid`/`claim_expired`/`claim_already_used`/
 *  `account_already_registered`/`account_already_claimed_identity`/`rate_limited`). Un `raise
 *  exception` sin capturar aborta TODA la transacción de la función — incluido el incremento de
 *  `consume_rate_limit` ya ejecutado antes de la excepción — así que la versión anterior
 *  dejaba sin contar exactamente los intentos que más interesa limitar (tokens inválidos/
 *  vencidos/ya usados). Con un `return` normal ese incremento persiste. `no_player_for_session`
 *  sigue siendo una excepción real: es una violación de invariante de sesión (ni siquiera hay
 *  player_id con el que rate-limitar), no un resultado de negocio esperable — mismo criterio
 *  que el resto de las RPCs de este archivo. */
create or replace function public.claim_provisional_player(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_token text := trim(coalesce(p_token, ''));
  v_token_hash text;
  v_claim public.provisional_claims;
  v_p2_has_profile boolean;
  v_already_claimed_identity boolean;
  v_p1 public.players;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'claim_provisional_player', 10, 900) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  -- Hotfix §5 — formato del token (64 hex: sha256 de 32 bytes) validado DESPUÉS de consumir
  -- cuota, para que un token con formato inválido cuente igual como intento real (mismo motivo
  -- que el cambio de contrato de arriba: es exactamente el tipo de intento que interesa contar).
  if v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;

  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  select * into v_claim from public.provisional_claims where token_hash = v_token_hash for update;
  if v_claim is null then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;
  if v_claim.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;
  if v_claim.expires_at <= now() then
    update public.provisional_claims set status = 'expired' where claim_id = v_claim.claim_id;
    return jsonb_build_object('ok', false, 'code', 'claim_expired');
  end if;

  -- 03_Revision_ChatGPT.md §7/Decisión 2 — "antes de complete_profile Y de oficializar Nivel":
  -- el caller (P2) debe seguir sin perfil completo NI Nivel oficializado todavía. Cubre también
  -- el caso límite de una llamada directa a la Edge Function fuera del orden normal de la UI
  -- (oficializar Nivel sin haber llamado complete_profile antes) — sin este segundo chequeo,
  -- borrar P2 más abajo perdería silenciosamente un level_events ya oficializado (cascada).
  select exists (
    select 1 from public.profiles where player_id = v_caller_player_id and username is not null
  ) or exists (
    select 1 from public.level_states where player_id = v_caller_player_id and status <> 'PENDIENTE'
  ) into v_p2_has_profile;
  if v_p2_has_profile then
    return jsonb_build_object('ok', false, 'code', 'account_already_registered');
  end if;

  -- Análisis §C — "qué ocurre si una cuenta ya está asociada a otro player_id": si esta MISMA
  -- sesión ya adoptó una identidad reclamada antes (aunque todavía no haya llamado
  -- complete_profile), un segundo reclamo encadenado tampoco es automático — se resuelve a
  -- mano, igual que una cuenta ya completa (Backend_Infraestructura.md §9.2/§15.5).
  select exists (
    select 1 from public.provisional_claims where claimed_by_player_id = v_caller_player_id
  ) into v_already_claimed_identity;
  if v_already_claimed_identity then
    return jsonb_build_object('ok', false, 'code', 'account_already_claimed_identity');
  end if;

  select * into v_p1 from public.players where player_id = v_claim.provisional_player_id for update;
  if v_p1 is null or v_p1.type <> 'provisional' then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;

  -- Preservar identidad de P2 antes de borrarlo (§5 de la revisión + extensión defensiva):
  -- pilot_events (nunca tiene cascada) y cualquier fila donde P2 figure como creador.
  update public.pilot_events set player_id = v_p1.player_id where player_id = v_caller_player_id;
  update public.players set created_by_player_id = v_p1.player_id where created_by_player_id = v_caller_player_id;
  update public.provisional_claims set created_by_player_id = v_p1.player_id where created_by_player_id = v_caller_player_id;

  -- P2 queda vacío (bootstrap del trigger, sin perfil ni Nivel oficializados todavía) — se
  -- elimina de forma segura, cascada a sus profiles/level_states vacíos.
  delete from public.players where player_id = v_caller_player_id;

  -- P1 adopta el auth_user_id del caller y pasa a 'registered'.
  update public.players
    set auth_user_id = auth.uid(), type = 'registered', updated_at = now()
    where player_id = v_p1.player_id
    returning * into v_p1;

  -- Bootstrap mínimo para P1 (nunca pasó por handle_email_confirmed): mismas 2 filas que ese
  -- trigger ya sabe crear (Decisión 2: duplicación mínima acá, sin tocar el trigger de Bloque 3).
  insert into public.profiles (player_id) values (v_p1.player_id)
    on conflict (player_id) do nothing;
  insert into public.level_states (player_id, status) values (v_p1.player_id, 'PENDIENTE')
    on conflict (player_id) do nothing;

  update public.provisional_claims
    set status = 'claimed', claimed_at = now(), claimed_by_player_id = v_p1.player_id
    where claim_id = v_claim.claim_id;

  insert into public.pilot_events (event_name, player_id, properties)
    values ('provisional_claimed', v_p1.player_id, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'player_id', v_p1.player_id);
end;
$$;

comment on function public.claim_provisional_player is
  'Único camino de consumo de un claim. Devuelve jsonb {ok, code, player_id} — nunca raise
   exception para errores de negocio esperables (hotfix §3: eso revertía el incremento del rate
   limiter). Debe llamarse ANTES de complete_profile/officialize_level_onboarding (P2 sin
   perfil todavía) — una cuenta ya completa, o una que ya adoptó otra identidad reclamada antes,
   recibe {ok:false, code:account_already_registered/account_already_claimed_identity} (nunca
   fusión automática, política manual del piloto). Preserva pilot_events y cualquier fila donde
   P2 figure como creador (reasigna, nunca borra). Atómico vía for update sobre la fila del
   claim.';

revoke all on function public.claim_provisional_player(text) from public;
grant execute on function public.claim_provisional_player(text) to authenticated;
