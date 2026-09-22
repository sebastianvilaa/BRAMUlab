# Backend Bloque 7 — Corrección de Fase 1 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `cd819a0976aa6db37b2a348d2e2b57f7eb8d967b` (`05_Revision_Central_Fase_1.md`).
**Alcance ejecutado:** corregir únicamente F1-C01…F1-C07 sobre la Fase 1 ya escrita. No se aplicó nada a Supabase, no se empezó Fase 2, no se tocó frontend, cron, Vercel, `main`, Production ni BRAMUlive.

Este documento deja `04_Resultado_Fase_1_Claude.md` como evidencia histórica de la primera versión de Fase 1 (la que el dry-run de la revisión central encontró con los 7 problemas). Las dos migraciones originales (`20260922100000`/`20260922110000`) **no se modificaron** — ninguna de las dos llegó a aplicarse a Supabase, así que las correcciones se agregan como migraciones nuevas que corren después, siguiendo el mismo criterio que Bloque 6 ya usó para sus propias correcciones pre-Staging (`..._fix_applied_result_detection.sql`, `..._fix_fingerprint_uuid.sql`, etc.).

---

## Archivos nuevos

- `supabase/migrations/20260922120000_bloque7_fase1_security_hardening.sql` — F1-C03, F1-C04, F1-C01, F1-C02.
- `supabase/migrations/20260922130000_bloque7_fase1_constraint_fixes.sql` — F1-C05, F1-C06, F1-C07.
- `supabase/tests/verify-bloque7-fase1.mjs` — script de verificación real (entregado sin ejecutar, ver §Validación).

---

## F1-C01 — `complete_ranking_profile_data` ejecutable por PUBLIC/anon

**Causa real:** Postgres otorga `EXECUTE` a `PUBLIC` por defecto al crear cualquier función; el archivo original (`20260922110000`) solo agregaba `grant execute ... to authenticated`, sin el `revoke all ... from public` que **todas** las demás ~40 RPC de este repositorio sí tienen (confirmado por grep contra las migraciones de Bloques 2-6). Es exactamente el mismo patrón que ya falló una vez en Bloque 6 (`_bloque6_refresh_participant_fingerprint`/`_bloque6_revert_applied_result`, corregido en `20260921235000_bloque6_internal_helper_grants.sql`).

**Corrección:** `revoke all on function public.complete_ranking_profile_data(...) from public;` en el archivo de hardening. `authenticated` conserva su `grant execute` original (independiente del revoke sobre `PUBLIC`); `anon` pierde el acceso que heredaba de `PUBLIC`.

---

## F1-C02 — tablas "append-only" mutables por `service_role`

**Causa real:** el archivo original otorgaba explícitamente `select, insert, update, delete to service_role`, y además el proyecto ya tiene *default privileges* que conceden CRUD a `service_role` sobre toda tabla nueva de `public` en el momento de crearla — antes de que la propia migración pueda evitarlo. Ninguna política RLS ayuda acá: `service_role` en Supabase corre con `BYPASSRLS`, así que la única barrera real contra `UPDATE`/`DELETE` es el sistema de privilegios SQL, no las políticas de RLS.

**Corrección:** `revoke update, delete on table ... from service_role;` para las tres tablas (`ranking_editions`, `ranking_rows`, `location_change_events`), después de crearlas. `SELECT`/`INSERT` quedan intactos — es lo único que la función de cálculo de Fase 2 va a necesitar. Una limpieza excepcional de fixtures de QA queda, como ya documentaba Fase 1, para owner/SQL editor (nunca sujeto a estos `GRANT`/`REVOKE`).

---

## F1-C03 — `complete_profile` como vía alternativa para cambiar ubicación/rama

**Inspección real hecha antes de elegir el fix** (tal como pidió esta ronda):

- **Callers reales:** `bramulab/auth.js:completeProfile` (único wrapper del cliente) y `bramulab/app.js:runOfficializeAndEnter` (único punto que lo invoca, dentro del flujo de signup). El payload real que se manda **nunca incluye `location`/`competitiveBranch`** — se confirmó leyendo ambos archivos línea por línea antes de tocar nada.
- **Tests reales:** `supabase/tests/verify-bloque2/3/4/5/6.mjs` llaman a `complete_profile` siempre con esos dos campos en `null` (mismo patrón que la app real).
- **Reintentos:** el comentario de `runOfficializeAndEnter` documenta explícitamente que reintentar la función entera "es siempre seguro" porque `complete_profile` es idempotente — esto depende de que los reintentos manden EXACTAMENTE el mismo payload (username/nombre/apellido/display/términos), nunca ubicación.

**Por qué esta es la solución más pequeña:** dado que ningún llamador real pasa location/branch hoy, y que el propio comentario de Bloque 3 ya reservaba "un futuro 'completar datos para Ranking' con su propio contrato" para esos dos campos, la corrección mínima es dejar de escribirlos desde `complete_profile` — sin cambiar su firma (no hace falta `DROP FUNCTION` ni volver a `GRANT`), sin tocar ninguna de sus validaciones/columnas reales (username/nombre/apellido/display_name/fecha de nacimiento/género/mano/lado/términos quedan carácter por carácter iguales), y sin rehacer Bloque 2/3.

**Corrección:** `create or replace function public.complete_profile(...)` con el mismo cuerpo, MENOS: el bloque find-or-create de `locations`, las validaciones de formato de `p_competitive_branch`/`p_location_*`, y las dos líneas del `UPDATE ... SET` que escribían `competitive_branch`/`location_id`. Al quedar fuera del `SET`, esas dos columnas **conservan siempre** su valor actual, sin importar qué mande el llamador — `complete_ranking_profile_data` queda como única vía real.

**Efecto colateral corregido de paso (no pedido explícitamente, pero necesario para que el fix sea real):** antes de esta corrección, `complete_profile` además **nuleaba** `location_id` cada vez que se llamaba sin datos de ubicación (rama "perfil mínimo sin ubicación todavía" del código original) — es decir, ni siquiera hacía falta un intento malicioso de "cambiar" la ubicación: un simple reintento normal del flujo de onboarding, ejecutado DESPUÉS de que el usuario ya hubiera completado su ubicación vía Ranking, la habría borrado en silencio. Al sacar `location_id`/`competitive_branch` del `SET` por completo, este efecto colateral desaparece junto con el bypass — un único cambio resuelve ambos.

---

## F1-C04 — falta de serialización en `complete_ranking_profile_data`

**Corrección:** el `SELECT` inicial del perfil pasa a `select * into v_profile from public.profiles where player_id = v_player_id for update;`. Bloquea la fila hasta que termina la transacción de esa llamada (COMMIT o ROLLBACK), así que una segunda llamada concurrente del MISMO jugador queda esperando en ese `SELECT` en vez de leer el mismo `location_effective_from` todavía no actualizado. Cooldown + `UPDATE` + `INSERT` en `location_change_events` quedan dentro de la misma función, ya en una sola transacción implícita — no hizo falta ningún mecanismo adicional de lock.

**Verificado por diseño (no ejecutado esta ronda, ver §Validación):** con dos llamadas concurrentes de alta inicial para el mismo jugador con ubicaciones distintas, la segunda en tomar el lock ve `location_id` ya no-nulo (lo que puso la primera) y `location_effective_from` recién puesto a `now()` — cae directo en `location_change_cooldown`. Resultado esperado: exactamente 1 éxito, exactamente 1 bloqueo por cooldown, exactamente 1 fila en `location_change_events` — nunca dos altas silenciosas.

---

## F1-C05 — constraints que documentaban pero no garantizaban

Agregadas sobre `ranking_rows` (todas ya estaban documentadas en prosa en Fase 1, ninguna es nueva en el diseño — solo pasan de comentario a `CHECK` real):

| Constraint | Invariante |
|---|---|
| `ranking_rows_reason_codes_is_array` | `eligibility_reason_codes` siempre `jsonb_typeof(...) = 'array'` |
| `ranking_rows_eligible_has_no_residual_reason` | `is_eligible=true` ⇒ `eligibility_reason_codes` vacío (complementa la constraint ya existente en sentido inverso) |
| `ranking_rows_position_positive` | `position` NULL o `> 0` |
| `ranking_rows_tie_group_positive` | `tie_group` NULL o `> 0` |
| `ranking_rows_tie_group_equals_position` (reemplaza la anterior, más débil) | `tie_group` NULL exactamente cuando `position` es NULL, y **igual** a `position` en cualquier otro caso |
| `ranking_rows_total_eligible_non_negative` | `total_eligible >= 0` |
| `ranking_rows_level_internal_in_scale` / `..._level_public_in_scale` | NULL o dentro de 1,0–10,0 (Ranking_BRAMU.md §2) |

No se agregó ninguna constraint fuera de esta lista — la revisión central pidió explícitamente no convertir esto en una colección enorme.

---

## F1-C06 — un jugador no puede tener dos filas del mismo `scope_type` en una edición

**Corrección:** se reemplaza `unique (edition_id, scope_type, scope_key, player_id)` por `unique (edition_id, scope_type, player_id)`. `scope_key` sigue existiendo como columna (la usan los índices de lectura para agrupar el universo), pero ya no participa de la unicidad — Local/Provincial/País/Global son los ámbitos PROPIOS del jugador, congelados en el corte; dos filas del mismo `scope_type` para el mismo jugador en la misma edición serían siempre un bug de la función de cálculo, nunca un caso real (V1 no tiene "Explorar rankings"). No se encontró ningún caso real que justifique mantener la restricción anterior.

---

## F1-C07 — precisión histórica no garantizable del backfill

**Corrección:** no se tocó el `UPDATE` de backfill de `20260922110000` (sigue siendo correcto y, contra Staging real, no modifica ninguna fila porque todas las cuentas actuales tienen `location_id = NULL`). Se corrigió únicamente el `COMMENT ON COLUMN` de `profiles.location_effective_from` (un `COMMENT ON COLUMN` nuevo reemplaza por completo al anterior sin necesidad de tocar el archivo original): ya no afirma que `updated_at` es "exactamente" el instante de la única ubicación fijada — se documenta como una aproximación conservadora, válida solo mientras `complete_profile` sea el único escritor previo de `profiles` y no se demuestre lo contrario, y se deja explícito que hoy no aplica a ninguna fila real de Staging.

---

## Validación

**Estático/local, ejecutado realmente esta ronda:**

- lectura completa de `bramulab/auth.js` y de `runOfficializeAndEnter` en `bramulab/app.js` para confirmar el payload real de `complete_profile` antes de decidir el fix de F1-C03 (§F1-C03 arriba);
- grep de las ~40 RPC existentes en Bloques 2-6 para confirmar el patrón `revoke all ... from public` como convención universal antes de aplicarlo (F1-C01);
- verificación de balance de paréntesis/comillas/bloques `$$...$$` de los 2 archivos SQL nuevos, con el mismo script usado en la primera versión de Fase 1 (elimina comentarios `--` y literales antes de contar) — balance 0 en ambos;
- comparación campo a campo de cada nombre de constraint que se `DROP`/referencia contra los nombres exactos creados en `20260922100000` (grep directo), para no fallar por un typo de nombre;
- `node --check` sobre `supabase/tests/verify-bloque7-fase1.mjs` — sintaxis JS válida.

**Contra Supabase real: nada ejecutado esta ronda** (no autorizado). `supabase/tests/verify-bloque7-fase1.mjs` queda escrito y listo, con la misma disciplina que `verify-bloque6.mjs` en su momento ("ENTREGADO SIN EJECUTAR"), cubriendo exactamente F1-C01 (anon sin EXECUTE), F1-C02 (SELECT/INSERT sí, UPDATE/DELETE no, en las 3 tablas), F1-C03 (bypass cerrado + control positivo de que el onboarding real sigue funcionando), F1-C04 (cooldown simple + concurrencia real con `Promise.all`, verificando el conteo exacto de filas en `location_change_events`), F1-C05/F1-C06 (una fila válida positiva + 8 inserts negativos, uno por invariante, más el caso de unicidad y su control positivo). No se declara ningún resultado de este script como validado contra un proyecto real.

---

## Bloqueos reales

Ninguno.

---

**Fin de la corrección de Fase 1. No se aplicó nada a Supabase. No se empezó Fase 2.**
