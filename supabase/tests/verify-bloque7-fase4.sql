-- BRAMUlab — Bloque 7 / Fase 4 — verificación transaccional de publicación automática semanal.
--
-- Pensado para el mismo mecanismo de dry-run que Fase 2/Fase 3 (B7_F2_REPO_DRYRUN_OK /
-- B7_F3_REPO_DRYRUN_OK): correr el contenido de 20260922160000_bloque7_fase4_weekly_publication
-- .sql seguido de este archivo dentro de un único BEGIN/ROLLBACK, o ejecutarlo solo contra
-- Staging ya con esa migración aplicada. No deja ninguna edición ni job persistente: toda
-- mutación (incluida la edición histórica de control) ocurre entre BEGIN y ROLLBACK.
--
-- El wrapper público (`publish_current_ranking_edition`) siempre calcula su cutoff a partir de
-- `now()` real — a diferencia de `compute_ranking_edition`, no se le puede pasar un cutoff de
-- prueba desplazado. Por eso la edición de control que fabrica este runner para probar "no
-- modifica ediciones previas" se crea 520 semanas (~10 años) ANTES de la semana real vigente,
-- llamando directamente a compute_ranking_edition (nunca al wrapper) — mismo truco de
-- verify-bloque7-fase3.sql para nunca colisionar con datos reales de Staging.

begin;

do $$
declare
  v_old_cutoff      timestamptz;
  v_old_edition      public.ranking_editions;
  v_expected_cutoff  timestamptz;
  v_edition_1        public.ranking_editions;
  v_edition_2        public.ranking_editions;
  v_local_ts         timestamp;
  v_job              cron.job;
  v_jobid_before      bigint;
  v_jobid_after       bigint;
begin
  -- ------------------------------------------------------------------
  -- 0) Edición de control muy alejada de la semana real vigente — sirve para probar que el
  --    wrapper (que solo opera sobre la semana real actual) nunca toca ediciones previas.
  -- ------------------------------------------------------------------
  v_old_cutoff := (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') - interval '520 weeks')
                    at time zone 'America/Argentina/Buenos_Aires';
  select * into v_old_edition from public.compute_ranking_edition(v_old_cutoff);
  if v_old_edition.edition_id is null then
    raise exception 'setup_old_edition_failed';
  end if;

  -- ------------------------------------------------------------------
  -- 1) El wrapper calcula exactamente el cutoff lógico vigente: lunes 00:00:00 en
  --    America/Argentina/Buenos_Aires, con la misma fórmula literal del handoff §3.
  -- ------------------------------------------------------------------
  v_expected_cutoff := date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
                          at time zone 'America/Argentina/Buenos_Aires';

  select * into v_edition_1 from public.publish_current_ranking_edition();

  if v_edition_1.edition_id is null then
    raise exception 'publish_wrapper_returned_no_edition';
  end if;
  -- compute_ranking_edition(cutoff) publica la semana QUE TERMINÓ en ese cutoff:
  -- period_start_at = cutoff - 7 días; period_end_at = cutoff - 1 microsegundo.
  if v_edition_1.period_start_at <> v_expected_cutoff - interval '7 days'
     or v_edition_1.period_end_at <> v_expected_cutoff - interval '1 microsecond' then
    raise exception 'publish_wrapper_period_mismatch: got [% - %] expected [% - %]',
      v_edition_1.period_start_at, v_edition_1.period_end_at,
      v_expected_cutoff - interval '7 days', v_expected_cutoff - interval '1 microsecond';
  end if;

  v_local_ts := v_expected_cutoff at time zone 'America/Argentina/Buenos_Aires';
  if extract(dow from v_local_ts) <> 1 or v_local_ts::time <> '00:00:00'::time then
    raise exception 'publish_wrapper_cutoff_not_monday_midnight: %', v_local_ts;
  end if;

  -- ------------------------------------------------------------------
  -- 2) Segunda invocación dentro de la misma transacción: misma edición, nunca duplica.
  -- ------------------------------------------------------------------
  select * into v_edition_2 from public.publish_current_ranking_edition();
  if v_edition_2.edition_id <> v_edition_1.edition_id then
    raise exception 'publish_wrapper_duplicated_edition: % vs %', v_edition_1.edition_id, v_edition_2.edition_id;
  end if;
  if (select count(*) from public.ranking_editions where period_start_at = v_expected_cutoff - interval '7 days') <> 1 then
    raise exception 'publish_wrapper_created_more_than_one_edition_for_cutoff';
  end if;

  -- ------------------------------------------------------------------
  -- 3) La edición de control (semana muy anterior) sigue intacta.
  -- ------------------------------------------------------------------
  if not exists (
    select 1 from public.ranking_editions
    where edition_id = v_old_edition.edition_id
      and period_start_at = v_old_cutoff - interval '7 days'
      and period_end_at = v_old_cutoff - interval '1 microsecond'
  ) then
    raise exception 'publish_wrapper_altered_previous_edition';
  end if;

  -- ------------------------------------------------------------------
  -- 4) Seguridad: PUBLIC/anon/authenticated sin EXECUTE sobre el wrapper; service_role sí.
  -- ------------------------------------------------------------------
  if has_function_privilege('public', 'public.publish_current_ranking_edition()', 'EXECUTE')
     or has_function_privilege('anon', 'public.publish_current_ranking_edition()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.publish_current_ranking_edition()', 'EXECUTE') then
    raise exception 'publish_wrapper_execute_too_broad';
  end if;
  if not has_function_privilege('service_role', 'public.publish_current_ranking_edition()', 'EXECUTE') then
    raise exception 'publish_wrapper_service_role_execute_missing';
  end if;

  -- ------------------------------------------------------------------
  -- 5) pg_cron: job único y estable, con el schedule y el comando correctos (handoff §5: lunes
  --    00:05 Buenos Aires = 03:05 UTC = '5 3 * * 1').
  -- ------------------------------------------------------------------
  if (select count(*) from cron.job where jobname = 'bramu_weekly_ranking_publish') <> 1 then
    raise exception 'bramu_cron_job_missing_or_duplicated';
  end if;

  select * into v_job from cron.job where jobname = 'bramu_weekly_ranking_publish';
  if v_job.schedule <> '5 3 * * 1' then
    raise exception 'bramu_cron_job_wrong_schedule: %', v_job.schedule;
  end if;
  if v_job.command not ilike '%publish_current_ranking_edition%' then
    raise exception 'bramu_cron_job_wrong_command: %', v_job.command;
  end if;
  v_jobid_before := v_job.jobid;

  -- ------------------------------------------------------------------
  -- 6) Reaplicar la MISMA lógica idempotente de registro que usa la migración (chequeo previo
  --    contra cron.job, nunca un cron.schedule() ciego) no debe duplicar el job ni cambiar su
  --    jobid — simula una segunda corrida de la migración sin depender de que la versión de
  --    pg_cron instalada soporte upsert nativo por nombre.
  -- ------------------------------------------------------------------
  declare
    v_job_name text := 'bramu_weekly_ranking_publish';
    v_schedule text := '5 3 * * 1';
    v_command  text := 'select public.publish_current_ranking_edition();';
    v_existing cron.job;
  begin
    select * into v_existing from cron.job where jobname = v_job_name;
    if v_existing.jobid is null then
      perform cron.schedule(v_job_name, v_schedule, v_command);
    elsif v_existing.schedule is distinct from v_schedule or v_existing.command is distinct from v_command then
      perform cron.unschedule(v_existing.jobid);
      perform cron.schedule(v_job_name, v_schedule, v_command);
    end if;
  end;

  if (select count(*) from cron.job where jobname = 'bramu_weekly_ranking_publish') <> 1 then
    raise exception 'bramu_cron_job_duplicated_on_reapply';
  end if;
  select jobid into v_jobid_after from cron.job where jobname = 'bramu_weekly_ranking_publish';
  if v_jobid_after <> v_jobid_before then
    raise exception 'bramu_cron_job_jobid_changed_on_reapply: % vs %', v_jobid_before, v_jobid_after;
  end if;
end $$;

rollback;

select 'BLOQUE 7 FASE 4 OK — rollback limpio' as result;
