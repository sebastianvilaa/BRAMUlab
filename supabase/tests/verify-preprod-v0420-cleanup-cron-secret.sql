-- BRAMUlab — V04.20: verificación transaccional de 20260930310000_preprod_v0420_cleanup_cron_secret.sql. ROLLBACK al final.
--  C1 ensure_cleanup_cron_secret: crea UNA vez (true) y es idempotente (false); el secreto es aleatorio y largo
--  C2 verify_cleanup_cron_secret: true solo con el secreto real; false con vacío/corto/incorrecto
--  C3 schedule_cleanup_abandoned_signups: rechaza URLs ajenas; programa un job horario; el comando NO contiene el secreto
--     (lo lee de Vault en cada corrida) ni la service role key; re-programar es idempotente (1 solo job)
--  C4 unschedule; permisos (solo service_role)
begin;

create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;

do $$
declare v_secret text; v_first boolean; v_second boolean; v_job1 bigint; v_job2 bigint; v_cmd text; v_fail boolean := false; v_n integer;
begin
  delete from vault.secrets where name = 'cleanup_abandoned_signups_cron_secret';

  v_first := public.ensure_cleanup_cron_secret();
  v_second := public.ensure_cleanup_cron_secret();
  perform pg_temp._assert(v_first and not v_second, 'C1 crea una vez, idempotente');
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cleanup_abandoned_signups_cron_secret';
  perform pg_temp._assert(v_secret is not null and length(v_secret) >= 60, 'C1 secreto largo');

  perform pg_temp._assert(public.verify_cleanup_cron_secret(v_secret), 'C2 secreto real válido');
  perform pg_temp._assert(not public.verify_cleanup_cron_secret(null) and not public.verify_cleanup_cron_secret('')
    and not public.verify_cleanup_cron_secret('corto') and not public.verify_cleanup_cron_secret(v_secret || 'x')
    and not public.verify_cleanup_cron_secret(replace(v_secret, substr(v_secret, 1, 1), 'z')), 'C2 inválidos rechazados');

  begin perform public.schedule_cleanup_abandoned_signups('https://evil.example.com/functions/v1/cleanup-abandoned-signups');
  exception when others then v_fail := sqlerrm like '%invalid_function_url%'; end;
  perform pg_temp._assert(v_fail, 'C3 URL ajena rechazada');
  v_fail := false;
  begin perform public.schedule_cleanup_abandoned_signups('https://abc.supabase.co/functions/v1/otra-funcion');
  exception when others then v_fail := sqlerrm like '%invalid_function_url%'; end;
  perform pg_temp._assert(v_fail, 'C3 otra función rechazada');

  v_job1 := public.schedule_cleanup_abandoned_signups('https://abc123.supabase.co/functions/v1/cleanup-abandoned-signups');
  v_job2 := public.schedule_cleanup_abandoned_signups('https://abc123.supabase.co/functions/v1/cleanup-abandoned-signups');
  select count(*) into v_n from cron.job where jobname = 'cleanup-abandoned-signups';
  perform pg_temp._assert(v_n = 1, 'C3 idempotente: un solo job');
  select command into v_cmd from cron.job where jobname = 'cleanup-abandoned-signups';
  perform pg_temp._assert(v_cmd like '%https://abc123.supabase.co/functions/v1/cleanup-abandoned-signups%' and v_cmd like '%x-cron-secret%', 'C3 comando apunta a la función con header');
  perform pg_temp._assert(position(v_secret in v_cmd) = 0, 'C3 el secreto NO está en el comando (se lee de Vault)');
  perform pg_temp._assert(v_cmd not like '%service_role%' and v_cmd not like '%eyJ%', 'C3 sin service role key/JWT en el comando');
  perform pg_temp._assert((select schedule from cron.job where jobname = 'cleanup-abandoned-signups') = '17 * * * *', 'C3 horario: cada hora');

  perform pg_temp._assert(public.unschedule_cleanup_abandoned_signups() = 1, 'C4 unschedule');
  perform pg_temp._assert(not exists (select 1 from cron.job where jobname = 'cleanup-abandoned-signups'), 'C4 sin job');

  perform pg_temp._assert(has_function_privilege('service_role', 'public.verify_cleanup_cron_secret(text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.schedule_cleanup_abandoned_signups(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.verify_cleanup_cron_secret(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.verify_cleanup_cron_secret(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.schedule_cleanup_abandoned_signups(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.ensure_cleanup_cron_secret()', 'EXECUTE'), 'C4 permisos');
end $$;

select 'V0420_CRON_SECRET_VERIFY_OK' as result;
rollback;
