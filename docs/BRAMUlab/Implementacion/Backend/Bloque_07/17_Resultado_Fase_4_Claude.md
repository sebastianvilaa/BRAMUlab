# Backend Bloque 7 — Resultado de Fase 4 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `710b77785c2c935f2bcb6dca0fd61cf290301c8e` (`16_Handoff_Fase_4_Claude.md`).
**Alcance ejecutado:** migración de Fase 4 (`pg_cron` + wrapper de publicación + registro idempotente del job) y su runner SQL transaccional, más esta documentación. **No se aplicó nada a Supabase.** No se tocó frontend, Vercel, `main`, Production ni BRAMUlive. No se empezó Fase 5.

---

## 1. Archivos

- `supabase/migrations/20260922160000_bloque7_fase4_weekly_publication.sql` — `create extension if not exists pg_cron`, wrapper `publish_current_ranking_edition()` y registro idempotente del job `bramu_weekly_ranking_publish`.
- `supabase/tests/verify-bloque7-fase4.sql` — runner transaccional (`BEGIN...ROLLBACK`).

---

## 2. Contrato temporal aplicado

Fórmula literal del handoff §3, sin variación:

```sql
date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
  at time zone 'America/Argentina/Buenos_Aires'
```

`date_trunc('week', ...)` en PostgreSQL siempre usa semana ISO (lunes primer día) independientemente de configuración regional — mismo criterio ya validado en `compute_ranking_edition` (Fase 2) y en `verify-bloque7-fase3.sql`. El resultado es exactamente el lunes 00:00:00 lógico de Buenos Aires de la semana que se está cerrando/publicando; nunca "ahora menos cinco minutos".

Cron: `5 3 * * 1` (lunes 03:05 UTC = lunes 00:05 Buenos Aires, huso vigente sin horario de verano). Job con nombre estable `bramu_weekly_ranking_publish`.

---

## 3. `publish_current_ranking_edition()` — wrapper mínimo

Responsabilidades exactas del handoff §4, sin agregar nada:

1. calcula el cutoff con la fórmula anterior;
2. invoca `compute_ranking_edition(cutoff)`;
3. devuelve la fila completa (`edition_id` incluido);
4. no duplica en una segunda invocación — delegado enteramente en el `unique(period_start_at)` + catch de `unique_violation` que ya implementa Fase 2, el wrapper no agrega ninguna verificación propia;
5. no recalcula ni reimplementa Ranking — una sola línea de negocio: `return public.compute_ranking_edition(v_cutoff);`.

**No es `security definer`.** El handoff pide `security definer` "solo si hace falta" (§4). No hace falta: el wrapper no toca ninguna tabla directamente, y `compute_ranking_edition` ya es `security definer` desde Fase 2 — el trabajo con privilegios elevados ocurre ahí, no en el wrapper. `search_path` queda fijo por consistencia/defensa en profundidad, aunque el cuerpo ya usa nombres completamente calificados.

`revoke all ... from public` + `grant execute ... to service_role` — mismo patrón exacto que `compute_ranking_edition`.

**Nota sobre quién ejecuta realmente el job:** el rol bajo el que corre el disparo semanal real de `pg_cron` es el que quedó registrado en `cron.job.username` al momento de `cron.schedule(...)` — típicamente el rol con el que se aplican las migraciones (`postgres` u otro rol elevado de Supabase), no `service_role`. Ese rol normalmente es superusuario o dueño de las funciones, así que los `GRANT`/`REVOKE` de arriba no lo afectan (los bypassa). Lo que sí garantizan esos `GRANT`/`REVOKE` es que **ningún llamado vía PostgREST/RPC con `anon` o `authenticated` pueda disparar una publicación manual** — que es la superficie que importa proteger. `service_role` en el runner se prueba porque es el rol de referencia usado en toda la suite de Bloque 7 para "acceso server-only", no porque sea necesariamente el rol real del cron job.

---

## 4. Registro idempotente del job

En vez de depender de que la versión de `pg_cron` instalada en Staging soporte upsert nativo por `job_name` en `cron.schedule(job_name, schedule, command)` (soportado desde pg_cron 1.4, pero no verificable esta ronda — ver §7), la migración hace el chequeo explícito ella misma:

1. `select * into v_existing from cron.job where jobname = 'bramu_weekly_ranking_publish';`
2. si no existe (`v_existing.jobid is null`) → `cron.schedule(...)`;
3. si existe pero con `schedule`/`command` distintos → `cron.unschedule(jobid)` explícito y después `cron.schedule(...)`;
4. si ya existe idéntico → no toca nada.

El `WHERE jobname = ...` siempre filtra por el nombre exacto de BRAMU — nunca puede tocar un job de otro sistema que conviva en el mismo `cron.job`. El runner reproduce la misma lógica una segunda vez dentro de la transacción para probar que reaplicarla no duplica el job ni cambia su `jobid`.

---

## 5. Seguridad

- `publish_current_ranking_edition()`: `revoke all from public`, `grant execute` únicamente a `service_role`.
- `create extension if not exists pg_cron`: no otorga privilegios nuevos sobre el esquema `cron` a ningún rol de la aplicación (`anon`/`authenticated`/`service_role`) — solo lo usa el rol que aplica la migración para registrar el job.
- No se creó ninguna tabla nueva ni se tocó RLS existente.

---

## 6. Validación estática/local realmente ejecutada

- verificación de balance de `$$…$$`, comillas simples y bloques `begin/end`/`if…end if` de ambos archivos, línea por línea — balance correcto en los dos (migración: 2 pares `$$`, 16 comillas simples en 8 pares autocontenidos por línea, 1 `if`/`end if`; runner: 1 par `$$`, 92 comillas simples en pares autocontenidos por línea, 15 `if`/`elsif` con sus 15 `end if` correspondientes, más el `begin/end` anidado del paso 6);
- relectura completa de `compute_ranking_edition` (Fase 2) y de las RPCs de Fase 3 para confirmar que el wrapper reutiliza exactamente la misma fórmula de cutoff, el mismo criterio de idempotencia y el mismo patrón de `GRANT`/`REVOKE` ya validados contra Staging real;
- reconstrucción manual del propósito del `unique(period_start_at)` de `ranking_editions` (Fase 1) para confirmar que el wrapper no necesita ninguna defensa de concurrencia propia.

**Nada se ejecutó contra Supabase real ni contra ningún Postgres local** (no hay `psql`, CLI de Supabase ni credenciales/variables de entorno de conexión disponibles en esta sesión). No se declara ningún resultado como validado contra un proyecto real — a diferencia de Fase 2/3, esta ronda no produce un marcador `B7_F4_REPO_DRYRUN_OK`; ese paso queda para ChatGPT central junto con la aplicación real (handoff §7).

---

## 7. Bloqueos reales

El handoff §2 pide explícitamente "Inspeccionar además el estado real de `pg_cron` en Supabase Staging antes de escribir la migración". **Esta sesión de Claude Code no tiene acceso a Supabase** (sin `psql`, sin CLI de Supabase instalada, sin variables de entorno de conexión ni credenciales) y no pudo ejecutar esa inspección. Esto es consistente con el resto de Bloque 7: las validaciones contra Staging real siempre las ejecuta y documenta ChatGPT central (`0_Validacion_Central_*`), nunca esta sesión.

La migración está escrita para ser correcta sin depender de ese estado previo:

- `create extension if not exists pg_cron` no falla ni duplica nada si la extensión ya está habilitada;
- el registro del job hace su propio chequeo contra `cron.job` en vez de asumir una versión de `pg_cron` con upsert nativo por nombre.

Punto concreto que ChatGPT central debe confirmar durante el dry-run/aplicación real (no es una decisión de producto, es verificación técnica):

- si el rol con el que se aplican migraciones en el proyecto de Supabase (`bramulab-staging`) tiene privilegio para `CREATE EXTENSION pg_cron` directamente por SQL, o si requiere habilitarla primero desde el panel de Supabase (Database → Extensions) antes de correr esta migración.

---

## 8. Qué queda expresamente para fases siguientes

- inspección real de `pg_cron` en Staging, dry-run de esta migración + runner dentro de `BEGIN/ROLLBACK`, aplicación real, inspección de `cron.job`, invocación manual transaccional del wrapper y confirmación de que no queda ninguna edición QA persistente (handoff §7) — todo a cargo de ChatGPT central;
- Fase 5: frontend real de Ranking y eliminación del prototipo simulado;
- QA final de Bloque 7;
- BRAMU Intelligence V1, endurecimiento/salida — fuera de alcance de Bloque 7.

---

## 9. DECISIÓN ABIERTA

Ninguna decisión de producto pendiente. El único punto abierto es la verificación técnica de §7 (privilegios de `CREATE EXTENSION pg_cron` en Staging), que no bloquea preparar esta fase pero sí bloquea aplicarla.

---

**Fin de Fase 4 (preparación). No se aplicó nada a Supabase. No se empezó Fase 5.**
