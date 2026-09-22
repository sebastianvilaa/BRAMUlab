-- BRAMUlab — Bloque 7 (Fase 4): publicación automática semanal de Ranking vía pg_cron.
-- NO conecta frontend, NO elimina mocks, NO toca Production. Fase 5 (frontend/QA) sigue
-- dependiendo exclusivamente de las RPCs de lectura ya cerradas en Fase 3.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{16_Handoff_Fase_4_Claude.md,
-- 17_Resultado_Fase_4_Claude.md}.
--
-- Piezas nuevas, en orden:
--   1) `create extension if not exists pg_cron` — habilitación idempotente de la extensión.
--   2) `publish_current_ranking_edition()` — wrapper mínimo server-only: calcula el cutoff
--      lógico vigente (handoff §3, misma fórmula literal exigida por el handoff) e invoca
--      `compute_ranking_edition(cutoff)` de Fase 2. No reimplementa Ranking ni recalcula nada:
--      toda la autoridad de cálculo/idempotencia sigue siendo de Fase 2 (constraint unique
--      sobre `period_start_at` + catch de `unique_violation`). Por eso el wrapper NO necesita
--      `security definer`: no toca ninguna tabla directamente, solo delega en una función que
--      ya es `security definer` desde Fase 2 — únicamente necesita que su propio EXECUTE quede
--      restringido a `service_role`, igual que `compute_ranking_edition`.
--   3) Registro idempotente del job `bramu_weekly_ranking_publish` — comprobación explícita
--      contra `cron.job` ANTES de llamar `cron.schedule`/`cron.unschedule` (handoff §5): no
--      depende de que la versión de pg_cron instalada en Staging soporte upsert nativo por
--      nombre de job, nunca duplica el job si ya existe con la definición correcta, lo
--      reemplaza explícitamente si existe con una definición distinta, y nunca toca jobs con
--      otro nombre.
--
-- Contrato temporal (handoff §3 / Ranking_BRAMU.md §4.1): semana lunes 00:00:00 → domingo
-- 23:59:59.999999 en America/Argentina/Buenos_Aires. Cron: lunes 00:05 Buenos Aires = 03:05 UTC
-- en el huso vigente de Argentina (`5 3 * * 1`) — la publicación puede materializarse minutos
-- después del cutoff lógico (Ranking_BRAMU.md §17.3), pero el cutoff pasado a
-- `compute_ranking_edition` sigue siendo exactamente el lunes 00:00:00 lógico, nunca
-- "ahora menos cinco minutos".

-- ------------------------------------------------------------------
-- 1) pg_cron
-- ------------------------------------------------------------------
-- Idempotente: si la extensión ya está habilitada en Staging (a verificar por quien aplique
-- esta migración — 17_Resultado_Fase_4_Claude.md documenta que Claude no tuvo acceso directo
-- a Supabase en esta ronda para confirmarlo de antemano, tal como pide el handoff §2), este
-- CREATE no hace nada. Los objetos de pg_cron (esquema `cron`, tabla `cron.job`, funciones
-- `cron.schedule`/`cron.unschedule`) los crea la extensión misma, no dependen del esquema en el
-- que quede instalada.
create extension if not exists pg_cron;

-- ------------------------------------------------------------------
-- 2) publish_current_ranking_edition — wrapper de publicación
-- ------------------------------------------------------------------
create or replace function public.publish_current_ranking_edition()
returns public.ranking_editions
language plpgsql
set search_path = public
as $$
declare
  v_cutoff timestamptz;
begin
  -- Fórmula exacta exigida por el handoff §3 — nunca hardcodear "ahora menos cinco minutos".
  -- `date_trunc('week', ...)` en PostgreSQL siempre usa semana ISO (lunes es el primer día),
  -- sin depender de configuración regional. El primer `at time zone` interpreta `now()` (una
  -- timestamptz) como hora de pared en Buenos Aires; el segundo reinterpreta ese lunes 00:00:00
  -- de pared como Buenos Aires para devolver la timestamptz real correspondiente.
  v_cutoff := date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
                at time zone 'America/Argentina/Buenos_Aires';

  -- Toda la autoridad de cálculo e idempotencia es de Fase 2. Una segunda invocación para el
  -- mismo cutoff (mismo lunes) devuelve la edición ya existente sin recalcular ni duplicar
  -- nada — no hace falta ningún chequeo adicional acá.
  return public.compute_ranking_edition(v_cutoff);
end;
$$;

comment on function public.publish_current_ranking_edition is
  'Fase 4 de Bloque 7 (16_Handoff_Fase_4_Claude.md): wrapper mínimo invocado por el job de
   pg_cron. Calcula el cutoff lógico vigente (lunes 00:00:00 America/Argentina/Buenos_Aires,
   fórmula exacta del handoff §3) e invoca compute_ranking_edition(cutoff) — nunca recalcula
   Ranking ni reimplementa idempotencia propia, delega ambas en Fase 2. SOLO service_role.';

revoke all on function public.publish_current_ranking_edition() from public;
grant execute on function public.publish_current_ranking_edition() to service_role;

-- ------------------------------------------------------------------
-- 3) pg_cron — job semanal estable
-- ------------------------------------------------------------------
-- Chequeo explícito contra cron.job antes de programar (handoff §5): no duplica un job BRAMU
-- equivalente, reemplaza explícitamente uno con definición incorrecta, nunca toca jobs ajenos
-- (el WHERE siempre filtra por el nombre exacto de BRAMU).
do $$
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
  -- Si ya existe con schedule y command correctos: no hacer nada (idempotencia real, sin
  -- tocar cron.job innecesariamente).
end;
$$;
