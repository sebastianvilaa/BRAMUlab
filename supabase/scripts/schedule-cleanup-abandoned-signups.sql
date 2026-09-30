-- BRAMUlab — V04.19 (L1): programación horaria de la Edge Function `cleanup-abandoned-signups`.
--
-- NO forma parte de la migración a propósito: depende de (a) la función ya desplegada en el proyecto y (b) la
-- service role key guardada en Supabase Vault — ninguna de las dos existe al aplicar el esquema. Lo ejecuta
-- Central UNA vez por entorno, después de desplegar la función. NUNCA pegar la service role key en este archivo
-- ni en el repo: se guarda en Vault desde el SQL editor del proyecto (vault.create_secret) y acá solo se lee.
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'cleanup_abandoned_signups_key');   -- una vez, fuera del repo
--
-- Idempotente: re-ejecutar reemplaza el job existente.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-abandoned-signups';

select cron.schedule(
  'cleanup-abandoned-signups',
  '17 * * * *', -- cada hora, minuto 17 (el contrato es "después de 24 h", no "al segundo 86400")
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-abandoned-signups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_abandoned_signups_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
