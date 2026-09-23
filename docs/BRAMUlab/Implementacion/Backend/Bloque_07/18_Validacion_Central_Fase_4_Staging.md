# Backend Bloque 7 — Validación central de Fase 4 en Staging

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Base de Claude:** `c9c0482b7f3eb6fa04b0ab22e425086ef48caaaf`  
**Proyecto:** Supabase `bramulab-staging`  
**Resultado:** **FASE 4 VALIDADA Y APLICADA EN STAGING**

## 1. Estado real de pg_cron

Antes de aplicar:

- `pg_cron` estaba disponible en Supabase Staging;
- versión disponible: 1.6.4;
- todavía no estaba instalada.

La migración pudo habilitarla directamente por SQL. No hizo falta intervención manual en Dashboard.

Después de aplicar:

- extensión instalada: `pg_cron 1.6.4`;
- job: `bramu_weekly_ranking_publish`;
- schedule: `5 3 * * 1`;
- comando: `select public.publish_current_ranking_edition();`;
- usuario del job: `postgres`;
- estado: activo.

## 2. Wrapper

`publish_current_ranking_edition()`:

- calcula el lunes 00:00:00 de Buenos Aires como cutoff lógico;
- delega íntegramente en `compute_ranking_edition(cutoff)`;
- no reimplementa reglas de Ranking;
- es idempotente por el contrato de Fase 2;
- PUBLIC/anon/authenticated no tienen EXECUTE;
- service_role sí.

## 3. Corrección del runner

La implementación de Claude fue válida, pero el runner original confundía dos conceptos:

- cutoff lógico = lunes 00:00 BA;
- período publicado por `compute_ranking_edition` = semana que TERMINÓ en ese cutoff.

Por contrato de Fase 2:

- `period_start_at = cutoff - 7 días`;
- `period_end_at = cutoff - 1 microsegundo`.

La primera prueba real falló con:

`publish_wrapper_cutoff_mismatch`

Se corrigió únicamente la expectativa del runner. La migración/wrapper no requirieron cambios.

Runner corregido post-aplicación:

`BLOQUE 7 FASE 4 OK — rollback limpio`

## 4. Persistencia

La prueba del wrapper se ejecutó dentro de transacción con rollback.

Estado final:

- `ranking_editions`: 0;
- `ranking_rows`: 0;
- no quedó edición QA persistente;
- el job cron real sí quedó instalado y activo, que es el objetivo de Fase 4.

No hace falta esperar al próximo lunes para cerrar la fase: schedule, wrapper, permisos e invocación manual ya quedaron validados.

## 5. Incidente Vercel paralelo

Durante Bloque 7 aparecieron fallos de Vercel en commits que no tocaban las apps.

Causa confirmada por log:

`fatal: bad object 98a548...`

El `ignoreCommand` usaba `VERCEL_GIT_PREVIOUS_SHA`; ese SHA histórico podía no existir dentro del clon superficial del deployment.

Se reemplazó en ambos proyectos por:

`git diff --quiet HEAD^ HEAD ./`

El commit de corrección construyó correctamente bramulab y bramulive. La validación final del Ignored Build Step se realiza con este mismo commit documental/supabase de cierre de Fase 4.

## 6. Estado

**Fase 4 queda CERRADA dentro de Bloque 7.**

Fases 1–4 de Backend Ranking están aplicadas y validadas en Staging.

Siguiente:

**Fase 5 — conectar frontend real de Ranking a las RPCs de Fase 3 y retirar el prototipo/mock local.**

Todavía NO:

- Production;
- main;
- BRAMUlive;
- Intelligence.
