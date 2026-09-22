# Backend Bloque 7 — Handoff Fase 4: publicación automática semanal

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Fases 1–3 aplicadas y validadas en Supabase Staging.  
**Evidencia:** `15_Validacion_Central_Fase_3_Staging.md`

## 1. Objetivo único

Implementar y dejar validada en **Staging** la publicación automática semanal de Ranking mediante `pg_cron`.

Esta fase NO toca frontend.

## 2. Fuentes

Leer:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Ranking_BRAMU.md`
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/12_Validacion_Central_Fase_2_Staging.md`
5. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/15_Validacion_Central_Fase_3_Staging.md`

Inspeccionar además el estado real de `pg_cron` en Supabase Staging antes de escribir la migración.

## 3. Contrato temporal

Ranking V1:

- timezone de producto: `America/Argentina/Buenos_Aires`;
- cutoff lógico: lunes 00:00:00 BA;
- publicación puede materializarse unos minutos después;
- frecuencia: una vez por semana;
- edición publicada representa la semana que acaba de cerrar;
- nunca reescribir ediciones históricas.

La programación recomendada para V1 es:

**lunes 00:05 Buenos Aires**

En el entorno actual de Buenos Aires esto corresponde a **03:05 UTC**.

No hardcodear el cutoff como “ahora menos cinco minutos”.

La función invocada por cron debe calcular explícitamente:

`date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'`

y pasarlo a `compute_ranking_edition(cutoff)`.

## 4. Wrapper de publicación

Crear una función server-only mínima, por ejemplo:

`publish_current_ranking_edition()`

Responsabilidades:

1. calcular el cutoff lógico actual de Buenos Aires;
2. invocar `compute_ranking_edition(cutoff)`;
3. devolver/registrar el edition_id resultante;
4. no duplicar edición si se invoca dos veces;
5. no recalcular ni reimplementar Ranking.

Seguridad:

- `SECURITY DEFINER` solo si hace falta;
- `search_path` fijo;
- PUBLIC/anon/authenticated sin EXECUTE;
- service_role/owner únicamente.

## 5. pg_cron

Preferencia:

- `create extension if not exists pg_cron`;
- job con nombre estable de BRAMU;
- schedule semanal `5 3 * * 1`;
- comando que invoque el wrapper server-side.

La migración debe ser idempotente:

- si ya existe un job BRAMU equivalente, no duplicarlo;
- si hay que reemplazar una definición incorrecta anterior, hacerlo de forma explícita y segura;
- no borrar jobs ajenos.

No introducir Vercel Cron ni Edge Function para este problema.

## 6. Qué validar ANTES de aplicar

Crear un runner SQL de Fase 4 que pueda ejecutarse con rollback donde sea posible y cubra:

- wrapper calcula un cutoff válido de lunes 00:00 BA;
- invocación manual dentro de transacción produce una edición completa;
- segunda invocación devuelve la misma edición;
- no modifica ediciones previas;
- PUBLIC/anon/authenticated no ejecutan wrapper;
- service_role sí;
- migración no duplica jobs;
- definición del job apunta al wrapper correcto;
- cron expression correcta.

No dejar una edición QA persistente para probar el wrapper.

## 7. Aplicación en Staging

En esta ronda Claude **NO debe aplicar todavía** la migración a Supabase.

Debe preparar:

- migración;
- runner;
- documentación.

ChatGPT central hará:

1. dry-run/validación contra Staging;
2. aplicación real;
3. inspección de `cron.job`;
4. invocación manual transaccional del wrapper;
5. confirmación de que no quedó edición QA.

No hace falta esperar hasta el próximo lunes para cerrar la fase si:

- el job está registrado correctamente;
- el wrapper fue ejecutado manualmente con el mismo contrato temporal;
- la schedule fue verificada.

El primer disparo natural podrá observarse después como evidencia adicional, no como bloqueo.

## 8. No hacer

- NO frontend;
- NO eliminar mocks;
- NO Work/browser QA;
- NO Intelligence;
- NO Vercel;
- NO main;
- NO Production;
- NO BRAMUlive;
- NO crear manualmente una edición persistente de prueba;
- NO cambiar reglas de Ranking.

## 9. Entrega

Preparar:

- migración Fase 4;
- runner SQL transaccional;
- `docs/BRAMUlab/Implementacion/Backend/Bloque_07/17_Resultado_Fase_4_Claude.md`.

Un único commit lógico en `staging`.

Al terminar:

- HEAD;
- archivos;
- mecanismo pg_cron;
- pruebas realmente ejecutadas;
- bloqueos reales.

Después detenerse.

NO aplicar Supabase.
NO empezar frontend.
