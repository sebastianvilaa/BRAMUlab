-- BRAMUlab — G1 Emails V1 (Issue #21): VERIFY de la migración 20261001100000_g1_emails_account_challenges.sql.
-- Se corre en Supabase Staging (SQL editor / MCP) DESPUÉS de aplicar la migración. No deja datos: todo ocurre dentro de una
-- transacción que termina en ROLLBACK, con un auth_user_id sintético. Si algo falla, lanza una excepción con el motivo.
--
-- Cubre: tabla server-only (RLS sin políticas, sin privilegios de cliente), RPC solo service_role, y el comportamiento de negocio:
-- aislamiento de propósito, segundo paso bloqueado, hash-only, expiración, un solo uso, intentos, reenvío >= 60 s, tope por hora,
-- prueba delete_account, claim idempotente de recibos y purga.

begin;

do $$
declare
  u   uuid := gen_random_uuid();
  u2  uuid := gen_random_uuid();
  h1  text := repeat('a', 64);
  h2  text := repeat('b', 64);
  r   jsonb;
  n   integer;
  cid uuid;
  fn  text;
begin
  -- 1) tabla server-only
  if not (select relrowsecurity from pg_class where oid = 'public.account_challenges'::regclass) then raise exception 'RLS desactivada'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'account_challenges') then raise exception 'la tabla no debe tener políticas'; end if;
  if has_table_privilege('anon', 'public.account_challenges', 'select') or has_table_privilege('authenticated', 'public.account_challenges', 'select')
     or has_table_privilege('authenticated', 'public.account_challenges', 'insert') or has_table_privilege('anon', 'public.account_challenges', 'insert')
     or has_table_privilege('authenticated', 'public.account_challenges', 'update') or has_table_privilege('authenticated', 'public.account_challenges', 'delete') then
    raise exception 'anon/authenticated tienen privilegios sobre account_challenges';
  end if;

  -- 2) RPC solo service_role
  foreach fn in array array[
    'account_challenge_issue(uuid,text,text,text,text)', 'account_challenge_verify(uuid,text,text)', 'account_challenge_revoke(uuid,uuid)',
    'account_email_change_prepare(uuid)', 'account_email_change_finalize(uuid,uuid)', 'account_delete_proof_check(uuid,integer)',
    'account_receipt_claim(uuid,uuid)', 'account_receipt_release(uuid,uuid)', 'account_challenge_scrub(uuid,uuid)', 'account_challenges_purge_user(uuid)'
  ] loop
    if has_function_privilege('anon', 'public.' || fn, 'execute') or has_function_privilege('authenticated', 'public.' || fn, 'execute') then
      raise exception 'RPC % ejecutable por anon/authenticated', fn;
    end if;
    if not has_function_privilege('service_role', 'public.' || fn, 'execute') then raise exception 'RPC % no ejecutable por service_role', fn; end if;
  end loop;

  -- 3) segundo paso BLOQUEADO sin primer paso verificado
  r := public.account_challenge_issue(u, 'change_email_new', h1, 'nuevo@example.test', 'actual@example.test');
  if r->>'code' is distinct from 'current_verification_required' then raise exception 'change_email_new debe exigir change_email_current verificado: %', r; end if;

  -- 4) emisión + hash-only + 60 min
  r := public.account_challenge_issue(u, 'change_email_current', h1);
  if (r->>'ok')::boolean is not true then raise exception 'issue current falló: %', r; end if;
  cid := (r->>'challengeId')::uuid;
  if (select expires_at - created_at from public.account_challenges where challenge_id = cid) <> interval '60 minutes' then raise exception 'vencimiento != 60 min'; end if;
  if (select code_hash from public.account_challenges where challenge_id = cid) is distinct from h1 then raise exception 'se esperaba solo el hash'; end if;

  -- 5) reenvío < 60 s rechazado
  r := public.account_challenge_issue(u, 'change_email_current', h2);
  if r->>'code' is distinct from 'resend_too_soon' then raise exception 'reenvío inmediato debe rechazarse: %', r; end if;

  -- 6) aislamiento de propósito y de usuario
  r := public.account_challenge_verify(u, 'delete_account', h1);
  if r->>'code' is distinct from 'code_invalid' then raise exception 'un código de otro propósito no debe verificar: %', r; end if;
  r := public.account_challenge_verify(u2, 'change_email_current', h1);
  if r->>'code' is distinct from 'code_invalid' then raise exception 'otro usuario no debe verificar: %', r; end if;

  -- 7) verificación correcta + un solo uso
  r := public.account_challenge_verify(u, 'change_email_current', h1);
  if (r->>'ok')::boolean is not true then raise exception 'verify correcto falló: %', r; end if;
  if (select code_hash from public.account_challenges where challenge_id = cid) is not null then raise exception 'el hash debe borrarse al verificar'; end if;
  r := public.account_challenge_verify(u, 'change_email_current', h1);
  if (r->>'ok')::boolean is true then raise exception 'un código no puede usarse dos veces'; end if;

  -- 8) segundo paso habilitado + validaciones
  r := public.account_challenge_issue(u, 'change_email_new', h2, 'actual@example.test', 'actual@example.test');
  if r->>'code' is distinct from 'same_email' then raise exception 'mismo email debe rechazarse: %', r; end if;
  r := public.account_challenge_issue(u, 'change_email_new', h2, 'no-es-email', 'actual@example.test');
  if r->>'code' is distinct from 'invalid_email' then raise exception 'email inválido debe rechazarse: %', r; end if;
  r := public.account_challenge_issue(u, 'change_email_new', h2, ' Nuevo@Example.test ', 'actual@example.test');
  if (r->>'ok')::boolean is not true then raise exception 'segundo paso debía habilitarse: %', r; end if;
  if (select target_email from public.account_challenges where challenge_id = (r->>'challengeId')::uuid) <> 'nuevo@example.test' then raise exception 'email nuevo debe normalizarse'; end if;
  if (public.account_email_change_prepare(u)->>'code') is distinct from 'new_verification_required' then raise exception 'prepare sin segundo código verificado debe fallar'; end if;

  -- 9) intentos: 5 errores => invalidado
  r := public.account_challenge_issue(u2, 'delete_account', h1);
  for n in 1..4 loop
    r := public.account_challenge_verify(u2, 'delete_account', h2);
    if r->>'code' is distinct from 'code_invalid' then raise exception 'intento % debía ser code_invalid: %', n, r; end if;
  end loop;
  r := public.account_challenge_verify(u2, 'delete_account', h2);
  if r->>'code' is distinct from 'too_many_attempts' then raise exception 'el 5.º error debe invalidar: %', r; end if;
  r := public.account_challenge_verify(u2, 'delete_account', h1);
  if (r->>'ok')::boolean is true then raise exception 'tras agotar intentos el código correcto no debe servir'; end if;

  -- 10) prueba delete_account + claim idempotente + purga
  update public.account_challenges set resend_available_at = now() - interval '1 second' where auth_user_id = u2;
  r := public.account_challenge_issue(u2, 'delete_account', h1);
  if (public.account_delete_proof_check(u2, 600)->>'ok')::boolean is true then raise exception 'sin verificar no hay prueba'; end if;
  r := public.account_challenge_verify(u2, 'delete_account', h1);
  if (r->>'ok')::boolean is not true then raise exception 'verify delete_account falló: %', r; end if;
  r := public.account_delete_proof_check(u2, 600);
  if (r->>'ok')::boolean is not true then raise exception 'la prueba delete_account debía existir: %', r; end if;
  cid := (r->>'challengeId')::uuid;
  update public.account_challenges set verified_at = now() - interval '11 minutes' where challenge_id = cid;
  if (public.account_delete_proof_check(u2, 600)->>'ok')::boolean is true then raise exception 'la prueba vencida (>10 min) no debe valer'; end if;
  update public.account_challenges set verified_at = now() where challenge_id = cid;
  if (public.account_receipt_claim(u2, cid)->>'claimed')::boolean is not true then raise exception 'primer claim debía ganar'; end if;
  if (public.account_receipt_claim(u2, cid)->>'claimed')::boolean is true then raise exception 'el recibo no puede reclamarse dos veces'; end if;
  if public.account_challenges_purge_user(u2) < 1 then raise exception 'purga debía borrar filas'; end if;
  if exists (select 1 from public.account_challenges where auth_user_id = u2) then raise exception 'quedaron filas del usuario purgado'; end if;

  raise notice 'G1 verify: OK';
end $$;

rollback;
