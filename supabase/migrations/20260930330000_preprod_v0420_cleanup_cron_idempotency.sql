-- BRAMUlab — V04.20 gate Central: idempotencia real del cron de altas abandonadas.
--
-- pg_cron ya soporta actualizar un job existente por nombre con cron.schedule(name,...).
-- La versión 20260930310000 hacía unschedule + schedule; eso funciona entre transacciones
-- separadas, pero repetirlo dentro de una misma transacción puede terminar la conexión.
--
-- Esta corrección elimina el unschedule previo y usa la semántica nativa de nombre estable.
-- Resultado: una o varias llamadas, incluso en la misma transacción, dejan exactamente un job.

-- Las extensiones se aseguran UNA VEZ al aplicar esta migración. Repetir CREATE EXTENSION dentro
-- de una función invocada dos veces en la misma transacción puede terminar la conexión.
create extension if not exists pg_cron;
create extension if not exists pg_net;

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
  if p_function_url is null
     or p_function_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/cleanup-abandoned-signups$' then
    raise exception 'invalid_function_url' using errcode = 'P0001';
  end if;

  perform public.ensure_cleanup_cron_secret();

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

  -- cron.schedule(jobname, ...) reemplaza el job de igual nombre si ya existe.
  -- No hacer unschedule previo: así también es idempotente dentro de una misma transacción.
  select cron.schedule('cleanup-abandoned-signups', '17 * * * *', v_command) into v_job;
  return v_job;
end;
$$;

comment on function public.schedule_cleanup_abandoned_signups is
  'V04.20 Central gate: programa/reprograma por nombre el cron horario hacia cleanup-abandoned-signups. Idempotente incluso dentro de una misma transacción. Solo service_role.';

revoke all on function public.schedule_cleanup_abandoned_signups(text) from public, anon, authenticated;
grant execute on function public.schedule_cleanup_abandoned_signups(text) to service_role;
