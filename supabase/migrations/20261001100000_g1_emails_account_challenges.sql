-- BRAMUlab — G1 Emails/Auth V1 (Issue #21, handoff 89): desafíos sensibles SERVER-SIDE para cambio de email y eliminación.
--
-- Contexto: el cambio de email dejaba de poder expresarse con `updateUser({email})` (Secure Email Change nativo no admite la
-- secuencia aprobada "email actual -> email nuevo" sin un tercer mensaje) y la eliminación aceptaba cualquier reautenticación
-- genérica reciente (recovery/otp/magiclink/email_change). Esta migración agrega la fuente de verdad de los desafíos
-- por PROPÓSITO (`change_email_current`, `change_email_new`, `delete_account`) con código de 6 dígitos / 60 min.
--
--   * tabla `account_challenges`: server-only. RLS activada SIN políticas + REVOKE ALL a anon/authenticated. Solo la tocan las
--     RPC SECURITY DEFINER de abajo, ejecutables ÚNICAMENTE por service_role (las llama la Edge Function `account-challenge` /
--     `delete-my-account` después de validar el JWT con Auth getUser; el auth_user_id NUNCA viene del body).
--   * el OTP NO se guarda: solo `code_hash` (HMAC-SHA256 con un secreto de la Edge Function, calculado en la Edge). Se borra
--     (NULL) al consumir/invalidar.
--   * un solo uso (`verified_at`/`consumed_at`), 60 min (`expires_at`), 5 intentos, reenvío >= 60 s, tope 5 envíos/hora por
--     propósito, reenvío invalida los desafíos previos del mismo propósito.
--   * `change_email_new` solo se emite si hay un `change_email_current` VERIFICADO (y vigente) del mismo usuario; el email nuevo
--     se valida/normaliza acá (formato, distinto del actual, no ocupado) y el actual lo aporta el servidor (Auth), no el cliente.
--   * `delete_account`: la prueba verificada es lo que exige `delete-my-account` (reemplaza a la reautenticación genérica).
--   * recibos idempotentes (#5 email cambiado / #8 cuenta eliminada) con `receipt_claimed_at` (claim atómico).
--   * sin FK a auth.users ni a players: los emails temporales (target/previous) se limpian al terminar y la fila se purga al
--     eliminar la cuenta (`account_challenges_purge_user`); las filas > 2 días se podan oportunistamente al emitir.
--
-- NO aplicada desde el sandbox del agente (sin credenciales de Supabase) — la aplica Central/Work. Verify:
-- supabase/tests/verify-g1-emails-account-challenges.sql. Replay + pruebas: supabase/scripts/g1-account-challenges.test.mjs.

create table public.account_challenges (
  challenge_id        uuid primary key default gen_random_uuid(),
  auth_user_id        uuid not null,
  purpose             text not null check (purpose in ('change_email_current', 'change_email_new', 'delete_account')),
  code_hash           text,
  target_email        text,
  previous_email      text,
  parent_challenge_id uuid references public.account_challenges (challenge_id) on delete set null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  resend_available_at timestamptz not null,
  attempts            smallint not null default 0 check (attempts >= 0),
  max_attempts        smallint not null default 5 check (max_attempts between 1 and 10),
  verified_at         timestamptz,
  consumed_at         timestamptz,
  invalidated_at      timestamptz,
  receipt_claimed_at  timestamptz,
  constraint account_challenges_target_only_for_new check (purpose = 'change_email_new' or (target_email is null and previous_email is null))
);

create index account_challenges_user_purpose_idx on public.account_challenges (auth_user_id, purpose, created_at desc);

comment on table public.account_challenges is
  'G1 Emails V1: desafíos sensibles server-only (cambio de email actual/nuevo, eliminación). Solo hash del OTP (HMAC calculado en la Edge Function). Sin acceso de cliente: RLS sin políticas + REVOKE ALL; solo RPC service_role.';

alter table public.account_challenges enable row level security;
-- Deny-by-default: cero políticas para anon/authenticated.
revoke all on table public.account_challenges from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------------------------
-- Emisión (request). El código y el hash los genera la Edge; acá se validan reglas de negocio y se persiste SOLO el hash.
-- ------------------------------------------------------------------------------------------------------------------
create or replace function public.account_challenge_issue(
  p_auth_user_id  uuid,
  p_purpose       text,
  p_code_hash     text,
  p_target_email  text default null,
  p_previous_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now        timestamptz := now();
  v_target     text;
  v_prev       text;
  v_parent     uuid;
  v_retry      integer;
  v_issued     integer;
  v_oldest     timestamptz;
  v_id         uuid;
  v_expires    timestamptz := v_now + interval '60 minutes';
  v_resend     timestamptz := v_now + interval '60 seconds';
begin
  if p_auth_user_id is null
     or p_purpose is null or p_purpose not in ('change_email_current', 'change_email_new', 'delete_account')
     or p_code_hash is null or length(p_code_hash) < 32 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  -- Serializa las emisiones del mismo usuario (reenvíos en carrera no duplican desafíos activos).
  perform pg_advisory_xact_lock(hashtextextended('account_challenge:' || p_auth_user_id::text, 0));

  -- GC oportunista: nada de lo temporal sobrevive más de 2 días.
  delete from public.account_challenges where created_at < v_now - interval '2 days';

  if p_purpose = 'change_email_new' then
    v_target := lower(btrim(coalesce(p_target_email, '')));
    v_prev := lower(btrim(coalesce(p_previous_email, '')));
    if v_target = '' or length(v_target) > 254 or v_target !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_email');
    end if;
    if v_prev = '' then
      return jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    if v_target = v_prev then
      return jsonb_build_object('ok', false, 'code', 'same_email');
    end if;
    -- Segundo paso BLOQUEADO si no pasó el primero (vigente: verificado hace <= 60 min, sin consumir ni invalidar).
    select c.challenge_id into v_parent
      from public.account_challenges c
     where c.auth_user_id = p_auth_user_id and c.purpose = 'change_email_current'
       and c.verified_at is not null and c.verified_at > v_now - interval '60 minutes'
       and c.consumed_at is null and c.invalidated_at is null
     order by c.created_at desc limit 1;
    if v_parent is null then
      return jsonb_build_object('ok', false, 'code', 'current_verification_required');
    end if;
    if exists (select 1 from auth.users u where lower(u.email) = v_target and u.id <> p_auth_user_id) then
      return jsonb_build_object('ok', false, 'code', 'email_taken');
    end if;
  elsif p_target_email is not null or p_previous_email is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  -- Reenvío mínimo 60 s (por propósito; un envío fallido se revoca y libera el cupo).
  select max(c.resend_available_at) into v_oldest
    from public.account_challenges c where c.auth_user_id = p_auth_user_id and c.purpose = p_purpose;
  if v_oldest is not null and v_oldest > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_oldest - v_now)))::integer);
    return jsonb_build_object('ok', false, 'code', 'resend_too_soon', 'retryAfterSeconds', v_retry);
  end if;

  -- Tope de envíos por hora y propósito.
  select count(*), min(c.created_at) into v_issued, v_oldest
    from public.account_challenges c
   where c.auth_user_id = p_auth_user_id and c.purpose = p_purpose and c.created_at > v_now - interval '1 hour';
  if v_issued >= 5 then
    v_retry := greatest(1, ceil(extract(epoch from (v_oldest + interval '1 hour' - v_now)))::integer);
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'retryAfterSeconds', v_retry);
  end if;

  -- Invalida lo previo del mismo propósito. Reiniciar el primer paso invalida también el segundo (depende de él).
  update public.account_challenges c
     set invalidated_at = v_now, code_hash = null, target_email = null, previous_email = null
   where c.auth_user_id = p_auth_user_id and c.invalidated_at is null and c.consumed_at is null
     and (c.purpose = p_purpose or (p_purpose = 'change_email_current' and c.purpose = 'change_email_new'));

  insert into public.account_challenges (auth_user_id, purpose, code_hash, target_email, previous_email, parent_challenge_id, expires_at, resend_available_at)
  values (p_auth_user_id, p_purpose, p_code_hash, v_target, v_prev, v_parent, v_expires, v_resend)
  returning challenge_id into v_id;

  return jsonb_build_object('ok', true, 'challengeId', v_id, 'expiresAt', v_expires, 'resendAvailableAt', v_resend);
end;
$$;

-- ------------------------------------------------------------------------------------------------------------------
-- Verificación. Compara hashes (el de la Edge contra el almacenado). Cuenta intentos ANTES de comparar; agotados => invalida.
-- ------------------------------------------------------------------------------------------------------------------
create or replace function public.account_challenge_verify(
  p_auth_user_id uuid,
  p_purpose      text,
  p_code_hash    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_c   public.account_challenges;
begin
  if p_auth_user_id is null or p_purpose is null or p_purpose not in ('change_email_current', 'change_email_new', 'delete_account')
     or p_code_hash is null or length(p_code_hash) < 32 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('account_challenge:' || p_auth_user_id::text, 0));

  select * into v_c
    from public.account_challenges c
   where c.auth_user_id = p_auth_user_id and c.purpose = p_purpose
     and c.invalidated_at is null and c.consumed_at is null and c.verified_at is null
   order by c.created_at desc limit 1
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'code_invalid');
  end if;

  -- vencido: no se muta (consistente en cada reintento); el hash ya no se compara jamás y el GC lo poda
  if v_c.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'code_expired');
  end if;

  -- el segundo paso exige que el primero siga vigente (defensa en profundidad además de la emisión)
  if v_c.purpose = 'change_email_new' and not exists (
       select 1 from public.account_challenges p
        where p.challenge_id = v_c.parent_challenge_id and p.purpose = 'change_email_current' and p.auth_user_id = p_auth_user_id
          and p.verified_at is not null and p.consumed_at is null and p.invalidated_at is null) then
    update public.account_challenges set invalidated_at = v_now, code_hash = null, target_email = null, previous_email = null where challenge_id = v_c.challenge_id;
    return jsonb_build_object('ok', false, 'code', 'current_verification_required');
  end if;

  if v_c.attempts >= v_c.max_attempts then
    update public.account_challenges set invalidated_at = v_now, code_hash = null, target_email = null, previous_email = null where challenge_id = v_c.challenge_id;
    return jsonb_build_object('ok', false, 'code', 'too_many_attempts');
  end if;

  if v_c.code_hash is not null and v_c.code_hash = p_code_hash then
    update public.account_challenges set attempts = attempts + 1, verified_at = v_now, code_hash = null where challenge_id = v_c.challenge_id;
    return jsonb_build_object('ok', true, 'challengeId', v_c.challenge_id);
  end if;

  if v_c.attempts + 1 >= v_c.max_attempts then
    update public.account_challenges
       set attempts = attempts + 1, invalidated_at = v_now, code_hash = null, target_email = null, previous_email = null
     where challenge_id = v_c.challenge_id;
    return jsonb_build_object('ok', false, 'code', 'too_many_attempts');
  end if;
  update public.account_challenges set attempts = attempts + 1 where challenge_id = v_c.challenge_id;
  return jsonb_build_object('ok', false, 'code', 'code_invalid', 'attemptsLeft', v_c.max_attempts - (v_c.attempts + 1));
end;
$$;

-- Un envío que falló NO deja un desafío "fantasma" ni consume el cupo de reenvío: se borra (solo si nunca se verificó).
create or replace function public.account_challenge_revoke(p_auth_user_id uuid, p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.account_challenges
   where challenge_id = p_challenge_id and auth_user_id = p_auth_user_id and verified_at is null and consumed_at is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ------------------------------------------------------------------------------------------------------------------
-- Cambio de email: ¿están las DOS verificaciones? (no muta). Devuelve lo necesario para que la Edge haga el cambio real.
-- ------------------------------------------------------------------------------------------------------------------
create or replace function public.account_email_change_prepare(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_n   public.account_challenges;
begin
  if p_auth_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  select * into v_n
    from public.account_challenges c
   where c.auth_user_id = p_auth_user_id and c.purpose = 'change_email_new'
     and c.verified_at is not null and c.consumed_at is null and c.invalidated_at is null
   order by c.created_at desc limit 1;
  -- ventana de finalización tras verificar el segundo paso (reintento seguro de un cambio que quedó a medias)
  if not found or v_n.verified_at < v_now - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'code', 'new_verification_required');
  end if;
  if not exists (
       select 1 from public.account_challenges p
        where p.challenge_id = v_n.parent_challenge_id and p.purpose = 'change_email_current' and p.auth_user_id = p_auth_user_id
          and p.verified_at is not null and p.consumed_at is null and p.invalidated_at is null) then
    return jsonb_build_object('ok', false, 'code', 'current_verification_required');
  end if;
  return jsonb_build_object('ok', true, 'challengeId', v_n.challenge_id, 'newEmail', v_n.target_email, 'previousEmail', v_n.previous_email);
end;
$$;

-- Consume (un solo uso) el segundo paso y su primer paso. Idempotente: segunda llamada => false.
create or replace function public.account_email_change_finalize(p_auth_user_id uuid, p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_parent uuid;
  v_n integer;
begin
  update public.account_challenges
     set consumed_at = v_now, code_hash = null
   where challenge_id = p_challenge_id and auth_user_id = p_auth_user_id and purpose = 'change_email_new'
     and verified_at is not null and consumed_at is null and invalidated_at is null
  returning parent_challenge_id into v_parent;
  get diagnostics v_n = row_count;
  if v_n = 0 then return false; end if;
  update public.account_challenges
     set consumed_at = v_now, code_hash = null
   where challenge_id = v_parent and auth_user_id = p_auth_user_id and consumed_at is null;
  return true;
end;
$$;

-- ------------------------------------------------------------------------------------------------------------------
-- Eliminación: prueba específica `delete_account`, verificada y reciente. NO muta (el reintento tras un fallo parcial usa la
-- misma prueba mientras siga reciente).
-- ------------------------------------------------------------------------------------------------------------------
create or replace function public.account_delete_proof_check(p_auth_user_id uuid, p_max_age_seconds integer default 600)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_c   public.account_challenges;
begin
  if p_auth_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'delete_challenge_required');
  end if;
  select * into v_c
    from public.account_challenges c
   where c.auth_user_id = p_auth_user_id and c.purpose = 'delete_account'
     and c.verified_at is not null and c.invalidated_at is null and c.consumed_at is null
   order by c.verified_at desc limit 1;
  if not found or v_c.verified_at < v_now - make_interval(secs => greatest(coalesce(p_max_age_seconds, 600), 1)) then
    return jsonb_build_object('ok', false, 'code', 'delete_challenge_required');
  end if;
  return jsonb_build_object('ok', true, 'challengeId', v_c.challenge_id);
end;
$$;

-- ------------------------------------------------------------------------------------------------------------------
-- Recibos idempotentes (#5 y #8): claim atómico; solo el primero que reclama envía. Si el envío falla se libera el claim.
-- ------------------------------------------------------------------------------------------------------------------
create or replace function public.account_receipt_claim(p_auth_user_id uuid, p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.account_challenges;
begin
  update public.account_challenges
     set receipt_claimed_at = now()
   where challenge_id = p_challenge_id and auth_user_id = p_auth_user_id and receipt_claimed_at is null
     and invalidated_at is null
     and ((purpose = 'change_email_new' and consumed_at is not null)
          or (purpose = 'delete_account' and verified_at is not null))
  returning * into v_c;
  if not found then
    return jsonb_build_object('claimed', false);
  end if;
  return jsonb_build_object('claimed', true, 'previousEmail', v_c.previous_email, 'newEmail', v_c.target_email);
end;
$$;

create or replace function public.account_receipt_release(p_auth_user_id uuid, p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update public.account_challenges set receipt_claimed_at = null
   where challenge_id = p_challenge_id and auth_user_id = p_auth_user_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Termina un desafío: borra los emails temporales y el hash. La fila queda (cuenta para el tope por hora) hasta el GC.
create or replace function public.account_challenge_scrub(p_auth_user_id uuid, p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update public.account_challenges set target_email = null, previous_email = null, code_hash = null
   where challenge_id = p_challenge_id and auth_user_id = p_auth_user_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Tras una eliminación confirmada: no queda NADA del usuario eliminado (ni su auth id) en esta tabla.
create or replace function public.account_challenges_purge_user(p_auth_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.account_challenges where auth_user_id = p_auth_user_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Solo service_role (Edge Functions). Sentencias explícitas por función (auditables estáticamente por audit-migration-grants.mjs).
revoke all on function public.account_challenge_issue(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.account_challenge_issue(uuid, text, text, text, text) to service_role;
revoke all on function public.account_challenge_verify(uuid, text, text) from public, anon, authenticated;
grant execute on function public.account_challenge_verify(uuid, text, text) to service_role;
revoke all on function public.account_challenge_revoke(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_challenge_revoke(uuid, uuid) to service_role;
revoke all on function public.account_email_change_prepare(uuid) from public, anon, authenticated;
grant execute on function public.account_email_change_prepare(uuid) to service_role;
revoke all on function public.account_email_change_finalize(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_email_change_finalize(uuid, uuid) to service_role;
revoke all on function public.account_delete_proof_check(uuid, integer) from public, anon, authenticated;
grant execute on function public.account_delete_proof_check(uuid, integer) to service_role;
revoke all on function public.account_receipt_claim(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_receipt_claim(uuid, uuid) to service_role;
revoke all on function public.account_receipt_release(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_receipt_release(uuid, uuid) to service_role;
revoke all on function public.account_challenge_scrub(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_challenge_scrub(uuid, uuid) to service_role;
revoke all on function public.account_challenges_purge_user(uuid) from public, anon, authenticated;
grant execute on function public.account_challenges_purge_user(uuid) to service_role;

comment on function public.account_challenge_issue(uuid, text, text, text, text) is
  'G1: emite un desafío (hash del OTP) por propósito. service_role únicamente (Edge Function account-challenge).';
comment on function public.account_delete_proof_check(uuid, integer) is
  'G1: prueba específica delete_account verificada y reciente; la exige delete-my-account. service_role únicamente.';
