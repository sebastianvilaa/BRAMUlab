# Backend Bloque 7 — Validación central de Fase 1 en Staging

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**HEAD de código probado:** `7437452f37b527679f10e721b5799896669e6d40`  
**Proyecto Supabase:** `bramulab-staging`  
**Resultado:** **FASE 1 VALIDADA Y APLICADA EN STAGING**

## 1. Qué se aplicó

Se aplicaron, en orden, las cuatro migraciones de Fase 1:

1. `20260922100000_bloque7_ranking_schema.sql`
2. `20260922110000_bloque7_ranking_profile_data.sql`
3. `20260922120000_bloque7_fase1_security_hardening.sql`
4. `20260922130000_bloque7_fase1_constraint_fixes.sql`

Todas fueron aceptadas por Supabase Staging.

## 2. Pre-validación con rollback

Antes de aplicar, las cuatro migraciones completas se ejecutaron juntas contra el esquema real dentro de `BEGIN ... ROLLBACK`.

PASS:

- compilación SQL completa;
- PUBLIC/anon sin EXECUTE sobre `complete_ranking_profile_data`;
- authenticated con EXECUTE;
- tablas append-only sin UPDATE/DELETE para `service_role`;
- RLS habilitada y sin políticas de cliente en las tablas nuevas;
- `complete_profile` conserva su contrato de acceso autenticado;
- alta inicial de datos de Ranking;
- bypass de ubicación/rama por `complete_profile` cerrado;
- cooldown de ubicación;
- reenvío idempotente de ubicación canónica;
- `FOR UPDATE` presente;
- unicidad por `scope_type`;
- constraints principales de eligibility/tie/escala.

## 3. Aplicación real

Las cuatro migraciones se aplicaron con el mecanismo de migraciones de Supabase.

Estado estructural posterior:

- `public.ranking_editions`: existe;
- `public.ranking_rows`: existe;
- `public.location_change_events`: existe;
- `profiles.location_effective_from`: existe;
- `players.ranking_excluded`: existe;
- `complete_ranking_profile_data(...)`: existe.

Seguridad posterior:

- PUBLIC EXECUTE: **NO**;
- anon EXECUTE: **NO**;
- authenticated EXECUTE: **SÍ**;
- tablas nuevas server-only: RLS deny-by-default;
- `service_role`: sin UPDATE/DELETE sobre las tres tablas append-only.

## 4. Prueba funcional post-aplicación

Después de aplicar se repitió la prueba funcional dentro de una transacción y se hizo `ROLLBACK`.

PASS:

- escritura inicial de localidad/rama/opt-in;
- evento inicial de ubicación único;
- `complete_profile` no puede modificar la ubicación/rama competitiva;
- segundo cambio real dentro de 30 días devuelve `location_change_cooldown`;
- reenvío de la misma ubicación canónica no crea otro evento;
- fila válida de snapshot acepta Nivel/puesto;
- duplicar scope propio del mismo tipo se rechaza;
- elegible con motivo residual se rechaza;
- empate inconsistente se rechaza;
- Nivel fuera de escala se rechaza.

La prueba de concurrencia no abrió dos conexiones reales; se verificó el mecanismo de serialización `SELECT ... FOR UPDATE` y el caso secuencial de cooldown. Una prueba concurrente real podrá hacerse cuando exista un runner que pueda limpiar por owner sin debilitar las tablas append-only.

## 5. Limpieza

La prueba post-aplicación fue transaccional.

Después del rollback:

- ranking_editions: **0**;
- ranking_rows: **0**;
- location_change_events: **0**;
- perfiles alterados por QA con location_effective_from: **0**.

No quedaron fixtures.

## 6. Runner corregido

Claude había agregado `supabase/tests/verify-bloque7-fase1.mjs`, pero no llegó a ejecutarse.

La revisión central detectó que su limpieza usaba DELETE vía `service_role` precisamente sobre las tablas a las que F1-C02 les revoca DELETE. Podía dejar fixtures.

Por seguridad queda retirado y reemplazado por:

`supabase/tests/verify-bloque7-fase1.sql`

El runner nuevo reproduce los checks seguros dentro de `BEGIN/ROLLBACK` y no deja residuos.

## 7. Supabase Advisors

Después de aplicar se revisaron advisors de seguridad y performance.

Nuevos avisos relevantes:

- `RLS enabled / no policy` en las tablas nuevas: **intencional**, porque son server-only y la lectura futura será por RPC;
- `complete_ranking_profile_data` SECURITY DEFINER ejecutable por authenticated: **intencional**, porque el caller se resuelve con `auth.uid()` y PUBLIC/anon están revocados;
- FKs sin índices dedicados: aviso informativo de performance; se decidirán índices cuando existan las queries reales de Fase 2/3, evitando sobrearquitectura.

No apareció un bloqueo de seguridad nuevo para Fase 1.

## 8. Estado

**Fase 1 queda CERRADA dentro de Bloque 7.**

Bloque 7 completo todavía NO está cerrado.

Siguiente paso:

**Fase 2 — función server-side de cálculo de una edición semanal para un cutoff dado, invocable manualmente en Staging.**

Todavía no se implementan:

- pg_cron;
- RPCs de lectura del Ranking;
- frontend;
- eliminación de mocks;
- Production.
