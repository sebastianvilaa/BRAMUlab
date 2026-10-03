-- BRAMUlab — V04.29 · Invitados / vinculación de identidad / recuperación — FRONTERA A1 (links).
--
-- Fuentes: docs/BRAMUlab/Implementacion/Pre_Production/113_* y 116_* (decisiones de producto CERRADAS) +
-- Backend_Infraestructura.md §9. Esta migración es la PRIMERA de tres (A1 links · A2 recuperación · C duplicados).
--
-- Qué cambia respecto del Bloque 4:
--   1) Varios links PENDING simultáneos hacia la misma provisional, uno por invitador:
--        UNIQUE (provisional_player_id, created_by_player_id) WHERE status = 'pending'
--      (reemplaza provisional_claims_one_pending_per_player: un solo pending por provisional).
--   2) Puede invitar quien creó la provisional O cualquier registrado que compartió un partido real con ella —
--      UNA sola regla server-side (`_can_invite_provisional`), reutilizada por create_claim_link, preview_claim_link,
--      list_related_provisional_players y claim_provisional_player (frontera A2). Conocer el UUID nunca alcanza.
--   3) create_claim_link rota SOLO el pending del mismo invitador (los de otros invitadores siguen vivos hasta que
--      un vínculo exitoso los revoque a todos, en la misma transacción — frontera A2).
--   4) preview_claim_link: lectura segura de un token SIN consumirlo (nombre visible + estado utilizable).
--   5) Tombstone de provisional recuperada: players.recovered_into_player_id/recovered_at. La provisional origen no se
--      borra (auditoría); deja de ser seleccionable/invitable como identidad activa.
--
-- Seguridad: token de 256 bits, solo su sha256 persiste, token crudo devuelto una única vez; expiración 30 días;
-- rate limits; RLS deny-by-default de provisional_claims intacta; helpers internos sin EXECUTE para cliente.

-- ------------------------------------------------------------------
-- 1) players — tombstone de provisional recuperada
-- ------------------------------------------------------------------

alter table public.players
  add column if not exists recovered_into_player_id uuid references public.players (player_id),
  add column if not exists recovered_at timestamptz;

alter table public.players drop constraint if exists players_recovered_tombstone_check;
alter table public.players add constraint players_recovered_tombstone_check check (
  recovered_into_player_id is null
  or (
    type = 'provisional' and is_active = false and recovered_at is not null
    and recovered_into_player_id <> player_id
  )
);

comment on column public.players.recovered_into_player_id is
  'Tombstone de una identidad provisional ya recuperada por una cuenta registrada (V04.29). La fila NO se borra
   (auditoría de player_identity_recoveries/provisional_claims/match_identity_issues): queda type=provisional,
   is_active=false y apunta a la cuenta destino. Nunca es seleccionable/invitable otra vez.';
comment on column public.players.recovered_at is 'Instante de servidor de la recuperación (junto con recovered_into_player_id).';

create index if not exists players_recovered_into_player_id_idx on public.players (recovered_into_player_id);

-- ------------------------------------------------------------------
-- 2) provisional_claims — un pending por (provisional, invitador)
-- ------------------------------------------------------------------

drop index if exists public.provisional_claims_one_pending_per_player;

create unique index if not exists provisional_claims_one_pending_per_inviter
  on public.provisional_claims (provisional_player_id, created_by_player_id)
  where status = 'pending';

alter table public.provisional_claims
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_reason text;

alter table public.provisional_claims drop constraint if exists provisional_claims_revoked_reason_check;
alter table public.provisional_claims add constraint provisional_claims_revoked_reason_check
  check (revoked_reason is null or revoked_reason in ('rotated', 'recovered_elsewhere', 'provisional_inactive'));

create index if not exists provisional_claims_created_by_player_id_idx on public.provisional_claims (created_by_player_id);
create index if not exists provisional_claims_claimed_by_player_id_idx on public.provisional_claims (claimed_by_player_id);

comment on index public.provisional_claims_one_pending_per_inviter is
  'Máximo un link pending por (provisional, invitador). Regenerar rota solo el propio; el primer vínculo exitoso
   revoca los demás pending de la provisional en la misma transacción (claim_provisional_player).';

-- ------------------------------------------------------------------
-- 3) _can_invite_provisional — ÚNICA regla de autorización de invitación
-- ------------------------------------------------------------------

/** Verdadero solo si el caller es una cuenta registrada activa Y la provisional está activa/no recuperada Y
 *  (el caller la creó O existe al menos un match_id real donde aparecen ambos en match_participants).
 *  Nunca por nombre, nunca por conocer el UUID. */
create or replace function public._can_invite_provisional(p_caller_player_id uuid, p_provisional_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_caller_player_id is not null
    and p_provisional_player_id is not null
    and exists (
      select 1 from public.players c
      where c.player_id = p_caller_player_id and c.type = 'registered' and c.is_active and c.deleted_at is null
    )
    and exists (
      select 1 from public.players pl
      where pl.player_id = p_provisional_player_id
        and pl.type = 'provisional'
        and pl.is_active
        and pl.recovered_into_player_id is null
        and (
          pl.created_by_player_id = p_caller_player_id
          or exists (
            select 1
            from public.match_participants mp_prov
            join public.match_participants mp_self
              on mp_self.match_id = mp_prov.match_id and mp_self.player_id = p_caller_player_id
            where mp_prov.player_id = pl.player_id
          )
        )
    );
$$;

comment on function public._can_invite_provisional is
  'Regla única de relación para invitar a una provisional: creador O compartió un partido real. Interna (sin EXECUTE
   para anon/authenticated); la usan las RPC SECURITY DEFINER de invitación/vinculación.';

revoke all on function public._can_invite_provisional(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- 4) create_claim_link — multi-invitador (misma firma/retorno que Bloque 4)
-- ------------------------------------------------------------------

create or replace function public.create_claim_link(p_provisional_player_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
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

  if p_provisional_player_id is null then
    raise exception 'provisional_not_found' using errcode = 'P0001';
  end if;

  -- Serializa contra un vínculo en curso sobre la MISMA provisional (claim_provisional_player toma este mismo lock
  -- como primer paso): un link nuevo nunca nace "pending" mientras otro ya está ganando, ni después de que la
  -- provisional quedó recuperada.
  perform pg_advisory_xact_lock(hashtextextended('bramu:identity_recovery:prov:' || p_provisional_player_id::text, 7));

  if not public._can_invite_provisional(v_caller_player_id, p_provisional_player_id) then
    -- Mismo código para "no existe", "no relacionada" o "ya recuperada": nunca confirma qué UUID existe.
    raise exception 'provisional_not_found' using errcode = 'P0001';
  end if;

  -- Rotar SOLO el pending de este mismo invitador. Los links de otros invitadores relacionados siguen vigentes.
  update public.provisional_claims
    set status = 'revoked', revoked_at = now(), revoked_reason = 'rotated'
    where provisional_player_id = p_provisional_player_id
      and created_by_player_id = v_caller_player_id
      and status = 'pending';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.provisional_claims (provisional_player_id, token_hash, status, created_by_player_id, expires_at)
  values (p_provisional_player_id, v_token_hash, 'pending', v_caller_player_id, now() + interval '30 days');

  return v_token;
end;
$$;

comment on function public.create_claim_link is
  'Genera/rota el link personal de invitación de una provisional. Autorizado por _can_invite_provisional (creador o
   partido compartido). Rota solo el pending del mismo invitador. Devuelve el token crudo UNA sola vez; solo se
   persiste su sha256. 30 días de vigencia. Serializa por provisional con el mismo advisory lock que el vínculo.';

revoke all on function public.create_claim_link(uuid) from public, anon;
grant execute on function public.create_claim_link(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 5) preview_claim_link — lectura segura, NO consume
-- ------------------------------------------------------------------

/** Para la pantalla "¿Sos {nombre}?". Solo `authenticated` (el receptor ya tiene sesión: sin sesión el cliente
 *  conserva la intención y muestra el acceso normal). Devuelve el MÍNIMO: {ok, code, displayName}. Nunca token_hash,
 *  ids, creador ni datos de otros jugadores. No escribe estado de claims (ni siquiera marca 'expired'): solo cuenta
 *  intentos en el rate limit — se cuenta antes de validar formato, como claim_provisional_player (hotfix §3/§5). */
create or replace function public.preview_claim_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_token text := trim(coalesce(p_token, ''));
  v_claim public.provisional_claims;
  v_prov public.players;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'preview_claim_link', 30, 900) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  if v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;

  select * into v_claim from public.provisional_claims
    where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
  if v_claim is null then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;
  if v_claim.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'claim_revoked');
  end if;
  if v_claim.status = 'claimed' then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;
  if v_claim.status = 'expired' or v_claim.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'claim_expired');
  end if;

  select * into v_prov from public.players where player_id = v_claim.provisional_player_id;
  if v_prov is null or v_prov.type <> 'provisional' or not v_prov.is_active or v_prov.recovered_into_player_id is not null then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;

  return jsonb_build_object(
    'ok', true, 'code', 'claim_valid',
    'displayName', coalesce(nullif(btrim(v_prov.display_name), ''), 'Jugador')
  );
end;
$$;

comment on function public.preview_claim_link is
  'Vista previa de una invitación sin consumirla: {ok, code, displayName}. Rate limit 30/15 min por cuenta. No expone
   token_hash, ids ni datos del invitador u otros jugadores.';

revoke all on function public.preview_claim_link(text) from public, anon;
grant execute on function public.preview_claim_link(text) to authenticated;

-- ------------------------------------------------------------------
-- 6) Listados de provisionales — misma regla de relación; las recuperadas desaparecen
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
      and pl.is_active
      and pl.recovered_into_player_id is null
      and pl.created_by_player_id = v_caller_player_id
    order by pl.created_at desc;
end;
$$;

comment on function public.list_my_provisional_players is
  'Provisionales propias ACTIVAS (excluye las ya recuperadas por una cuenta: tombstone). Único camino de lectura —
   nunca una policy de SELECT directo sobre players.';

revoke all on function public.list_my_provisional_players() from public, anon;
grant execute on function public.list_my_provisional_players() to authenticated;

create or replace function public.list_related_provisional_players()
returns table (
  player_id uuid,
  display_name text,
  created_at timestamptz,
  relation text
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

  -- La relación (creador O partido compartido) vive en UN solo lugar: _can_invite_provisional.
  return query
    select
      pl.player_id, pl.display_name, pl.created_at,
      case when pl.created_by_player_id = v_caller_player_id then 'created_by_me' else 'played_with' end as relation
    from public.players pl
    where pl.type = 'provisional'
      and pl.is_active
      and pl.recovered_into_player_id is null
      and public._can_invite_provisional(v_caller_player_id, pl.player_id)
    order by pl.created_at desc;
end;
$$;

comment on function public.list_related_provisional_players is
  'Provisionales que el caller puede reutilizar/invitar (creó o compartió partido), activas y no recuperadas. La regla
   es _can_invite_provisional (única). Nunca globalmente buscable ni por nombre.';

revoke all on function public.list_related_provisional_players() from public, anon;
grant execute on function public.list_related_provisional_players() to authenticated;
