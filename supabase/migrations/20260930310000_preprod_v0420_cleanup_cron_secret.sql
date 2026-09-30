-- BRAMUlab — V04.20 (Pre-Production, cierre operativo de L1): cron seguro para `cleanup-abandoned-signups`.
--
-- Problema: el script de V04.19 exigía guardar la SERVICE ROLE KEY en Vault a mano (un humano copiando un
-- secreto). Solución: un secreto ALEATORIO DEDICADO, generado server-side, que solo sirve para esa función.
--
--   cron (pg_cron) --POST + header x-cron-secret--> Edge Function cleanup-abandoned-signups
--                                                     └─ valida con verify_cleanup_cron_secret (service_role)
--
--   * El secreto se genera dentro de Postgres (ensure_cleanup_cron_secret) y vive SOLO en Supabase Vault: no
--     está en el repo, no lo ve ninguna persona, no es la service role key, y filtrarlo solo permitiría
--     invocar la limpieza (idempotente, que jamás toca cuentas confirmadas).
--   * El job lee el secreto de Vault en CADA ejecución (rotarlo = borrar el secreto y volver a correr
--     ensure_cleanup_cron_secret; el job no cambia).
--   * La Edge Function sigue aceptando la service role key exacta (uso administrativo manual).
--   * Se despliega con verify_jwt=false: el cron no tiene JWT; la función se autentica ella misma (403 si
--     ninguna de las dos credenciales coincide).
--   * Cron horario, idempotente (`schedule_...` reemplaza el job), y cada corrida es reintentable: el núcleo es
--     idempotente y revalida cada candidato (ver supabase/functions/_shared/abandoned-signups-core.mjs).
--
-- Central aplica esta migración y luego ejecuta UNA vez por entorno:
--     select public.ensure_cleanup_cron_secret();
--     select public.schedule_cleanup_abandoned_signups('https://<project-ref>.supabase.co/functions/v1/cleanup-abandoned-signups');
-- (ambas solo service_role). Sin secretos de por medio.

create or replace function public.ensure_cleanup_cron_secret()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from vault.secrets where name = 'cleanup_abandoned_signups_cron_secret') then
    return false;
  end if;
  perform vault.create_secret(
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    'cleanup_abandoned_signups_cron_secret',
    'Secreto cron -> Edge Function cleanup-abandoned-signups (generado server-side; no es la service role key)'
  );
  return true;
end;
$$;

create or replace function public.verify_cleanup_cron_secret(p_secret text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_expected text;
begin
  if p_secret is null or length(p_secret) < 32 then
    return false;
  end if;
  select decrypted_secret into v_expected from vault.decrypted_secrets
   where name = 'cleanup_abandoned_signups_cron_secret';
  return v_expected is not null and v_expected = p_secret;
end;
$$;

create or replace function public.schedule_cleanup_abandoned_signups(p_function_url text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job bigint;
  v_command text;
begin
  -- Solo la URL de ESTA función en un proyecto Supabase: nunca un destino arbitrario.
  if p_function_url is null or p_function_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/cleanup-abandoned-signups$' then
    raise exception 'invalid_function_url' using errcode = 'P0001';
  end if;

  perform public.ensure_cleanup_cron_secret();
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-abandoned-signups';

  v_command := format($cmd$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_abandoned_signups_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cmd$, p_function_url);

  -- cada hora, minuto 17: el contrato es "después de 24 h", no "al segundo 86400".
  select cron.schedule('cleanup-abandoned-signups', '17 * * * *', v_command) into v_job;
  return v_job;
end;
$$;

create or replace function public.unschedule_cleanup_abandoned_signups()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from cron.job where jobname = 'cleanup-abandoned-signups';
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-abandoned-signups';
  return v_count;
end;
$$;

comment on function public.ensure_cleanup_cron_secret is
  'V04.20: genera (una vez) el secreto aleatorio cron->Edge en Vault. Idempotente. Solo service_role.';
comment on function public.verify_cleanup_cron_secret is
  'V04.20: valida el header x-cron-secret contra Vault. Solo service_role (la llama la Edge Function).';
comment on function public.schedule_cleanup_abandoned_signups is
  'V04.20: programa el cron horario idempotente hacia la Edge Function cleanup-abandoned-signups. Solo service_role.';

revoke all on function public.ensure_cleanup_cron_secret() from public, anon, authenticated;
revoke all on function public.verify_cleanup_cron_secret(text) from public, anon, authenticated;
revoke all on function public.schedule_cleanup_abandoned_signups(text) from public, anon, authenticated;
revoke all on function public.unschedule_cleanup_abandoned_signups() from public, anon, authenticated;
grant execute on function public.ensure_cleanup_cron_secret() to service_role;
grant execute on function public.verify_cleanup_cron_secret(text) to service_role;
grant execute on function public.schedule_cleanup_abandoned_signups(text) to service_role;
grant execute on function public.unschedule_cleanup_abandoned_signups() to service_role;
