# Backend Bloque 7 — Validación central de Fase 2 en Staging

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**HEAD funcional validado:** `f950595959cc192f394278f52775609d0d28b2ca`  
**Proyecto:** Supabase `bramulab-staging`  
**Resultado:** **FASE 2 VALIDADA Y APLICADA EN STAGING**

## 1. Qué se validó

Fase 2 implementa:

- `ranking_profile_events` append-only para rama/opt-in as-of-cutoff;
- extensión de `get_player_level_state_as_of(...)` con `algorithmVersion`;
- `_bloque7_player_ranking_snapshot_as_of(...)`;
- `compute_ranking_edition(cutoff)`;
- separación M/F en denominadores, puestos, densidad y Global;
- RECALIBRANDO con último Nivel consolidado y actividad computable LIVE as-of-cutoff;
- Local/Provincial/País solo con ubicación canónica;
- Global auditable aun sin ubicación;
- atomicidad/idempotencia por edición;
- runner SQL transaccional de Fase 2.

## 2. Primera prueba central

La versión inicial de Fase 2 falló en Staging con rollback:

`insufficient_density_wrong`

La revisión central detectó y devolvió F2-C01…F2-C07.

Claude corrigió en el mismo archivo todavía no aplicado:

`20260922140000_bloque7_fase2_ranking_calculation.sql`

La corrección resolvió:

- candidatos sin ubicación que desaparecían;
- mezcla M/F;
- falta de historial real para rama/opt-in;
- actividad incorrecta en RECALIBRANDO;
- `total_eligible=0` artificial en Global locked;
- fixtures/expectativas contradictorias;
- limitación explícita de `is_active/ranking_excluded` mientras no exista writer real.

## 3. Último defecto absorbido por revisión central

El runner corregido detectó un último defecto:

`append_only_privileges_weakened_by_fase2`

Causa:

- el proyecto tiene DEFAULT PRIVILEGES históricos que conceden CRUD a `service_role`;
- crear `ranking_profile_events` y luego hacer solo `GRANT SELECT, INSERT` no revoca permisos heredados.

Corrección central mínima:

- `REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` explícito sobre `ranking_profile_events`;
- luego `GRANT SELECT, INSERT`.

Commit funcional final:

`f950595959cc192f394278f52775609d0d28b2ca`

Con ese cambio, migración + runner completo pasaron contra Staging dentro de `BEGIN/ROLLBACK`:

`B7_F2_REPO_DRYRUN_OK`

## 4. Aplicación real

La migración corregida se aplicó a Supabase Staging mediante el mecanismo de migraciones.

Resultado:

- aplicación: **PASS**;
- `ranking_profile_events`: existe;
- `compute_ranking_edition(timestamptz)`: existe;
- helper de snapshot: existe;
- `compute_ranking_edition` ejecutable por `service_role`;
- NO ejecutable por `authenticated` ni `anon`;
- `service_role` sin UPDATE/DELETE sobre `ranking_profile_events`.

## 5. Runner post-aplicación

Se ejecutó directamente desde repo:

`supabase/tests/verify-bloque7-fase2.sql`

Resultado:

`BLOQUE 7 FASE 2 (corrección F2-C01..F2-C07) OK — rollback limpio`

Cobertura principal:

- cutoff inválido;
- candidatos sin ubicación;
- ramas M/F independientes;
- densidad 0–4 / 5–14 / 15+;
- empate competitivo;
- Global locked/unlocked por rama;
- total elegible real durante lock;
- CALIBRANDO fuera;
- RECALIBRANDO con consolidado;
- RECALIBRANDO con actividad reciente;
- inactividad >180d;
- opt-out;
- ubicación no verificada;
- rama faltante;
- cuenta/integridad excluida;
- reconstrucción histórica de branch/opt-in;
- idempotencia;
- edición publicada inmutable;
- seguridad de funciones y tablas append-only.

## 6. Prueba con datos reales actuales de Staging

Se ejecutó `compute_ranking_edition` dentro de una transacción con rollback usando los datos actuales, sin fabricar población.

Estado real:

- perfiles registrados con username: **7**;
- todos carecen todavía de datos de Ranking/ubicación persistidos;
- la función generó exactamente **7 filas Global**;
- 0 filas territoriales;
- las 7 quedaron con `location_missing`;
- las 7 quedaron con `competitive_branch_missing`.

Resultado:

`B7_F2_REAL_DATA_7_GLOBAL_ROWS_OK`

Esto confirma que el bug anterior de “7 perfiles → 0 filas” quedó cerrado.

## 7. Limpieza

Después de todas las pruebas:

- `ranking_editions`: **0**;
- `ranking_rows`: **0**;
- `ranking_profile_events`: **0**.

No quedó ninguna edición publicada de QA ni fixtures.

## 8. Advisors

Después de aplicar:

- `RLS enabled / no policy` en tablas server-only de Ranking: **intencional**;
- las funciones de Fase 2 service-only NO aparecen expuestas a anon/authenticated;
- los avisos de performance existentes no bloquean esta fase y se revisarán con queries reales de lectura.

## 9. Estado

**Fase 2 queda CERRADA dentro de Bloque 7.**

Bloque 7 completo sigue EN CURSO.

Siguiente paso:

**Fase 3 — RPCs de lectura server-side sobre snapshots reales.**

Todavía NO:

- pg_cron;
- frontend real;
- eliminación de mocks;
- Production.
