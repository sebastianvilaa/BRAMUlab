# 84 — Resultado Bloque 9A: replay limpio y rehearsal de salida (Issue #19)

> **Nota de mantenimiento (08/10/2026):** los documentos intermedios que este texto cita por nombre (handoffs, validaciones, gates, revisiones y manifests) se retiraron del árbol activo al consolidarse; siguen en Git: `git log --diff-filter=D --name-only -- docs/BRAMUlab/Implementacion/` y `git show <commit>^:<ruta>`.

**Fecha:** 01/10/2026 · **Entorno:** solo local/efímero (cero contacto con Staging, Production ni BRAMUlive) · **Bundle:** `04.20-h3`.

## 1. Veredicto
**PASS del replay limpio** (tras corregir 1 defecto real de orden de migraciones y fijar 1 dependencia de ACL por defecto). Comando único y repetible: `node supabase/scripts/release-check.mjs` (exit 0 = PASS; `npm run release-check` dentro de `supabase/scripts`, previo `npm ci`).

## 2. Mecanismo de replay
No hay Docker, Supabase CLI ni Postgres local. Se usó **PGlite** (Postgres 17 real compilado a WASM, devDependency fijada en `supabase/scripts`) con un **shim mínimo de plataforma Supabase** (`replay-migrations.mjs`): roles `anon/authenticated/service_role`, schemas `auth` (users + `auth.uid()`), `storage` (buckets/objects/foldername), `vault`, `cron`, `net`, `rls_auto_enable()` y las ACL por defecto, en **tres escenarios** (`strict` = sin defaults, `observed` = lo visto en Staging, `open` = peor caso: todo objeto nuevo concedido a anon/authenticated). Es REAL: el motor SQL, el orden/DDL/RLS/GRANT/triggers/plpgsql de las **70 migraciones**, pgcrypto. Es SHIM: la plataforma (pg_cron/pg_net son tablas/funciones falsas).

## 3. Hallazgos reales
| # | Hallazgo | Evidencia | Acción |
|---|---|---|---|
| 1 | **El replay limpio FALLABA**: `20260930232000_…legal_acceptance_hardening` ordena **antes** de `20260930280000_…`, que es la que crea `legal_acceptances` y `legal_acceptances_reject_mutation()` (`function … does not exist`). Habría roto cualquier proyecto nuevo (Production) o `db reset`. | replay | El estado final (search_path + índice) se incluye en `280000`; `232000` quedó **condicional** (no-op en base vacía, idéntico efecto en Staging, donde ya está aplicada: no se renombra). Test de regresión. |
| 2 | **Los privilegios finales dependían de las ACL por defecto del proyecto.** Con defaults abiertos (peor caso) quedaban INSERT/UPDATE/DELETE/TRUNCATE en tablas para anon/authenticated y EXECUTE para anon y para authenticated sobre RPC administrativas/internas (`admin_annul_match`, `consume_rate_limit`, `_groups_*`…). Staging está bien por sus defaults; un proyecto Production nuevo puede traer otros. | `ACL=open` | Migración **`20261001060000_bloque9a_baseline_privileges.sql`** (idempotente, sin cambio de producto): tablas sin DML/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN para anon/authenticated; anon solo SELECT de `app_config`/`legal_versions`; funciones: anon solo `is_username_available`, authenticated solo las **58** RPC/helpers de Storage re-concedidas explícitamente; default privileges revocados. Los 3 escenarios convergen al mismo estado final (chequeado) y un test prueba que **sin** la migración el escenario `open` falla. |
| 3 | Laboratorio/Herramientas ocultos en Production solo por botón: el handler `createLabTestUserAndOpenOnboarding`/`setLevelV1Preview`/`resetLevelV1ForLabAccount` y el flag `LEVEL_V1_PREVIEW` (localStorage) seguían operativos. Impacto bajo (cuentas locales, no server-backed). | lectura de código | Guardas en handler + `Store.isLevelV1PreviewEnabled()` devuelve `false` en Production (cambio frontend, bundle `04.20-h3`). Test. |
| 4 | `prebloque9-hardening.test.mjs` apuntaba a la migración renombrada por Central (`…340000` → `…350000`): 3 tests fallaban en HEAD. | node --test | Ruta corregida. |

**Sin hallazgo (verificado):** project refs, URLs de Supabase, hosts Vercel/GitHub Pages en código ejecutable, JWT/keys, emails de QA, `environment='staging'` sembrado, UUID de fixtures en migraciones, seeds/mocks: **ninguno** (los `*.github.io` aparecen solo en comentarios históricos; el escáner ignora comentarios). Migraciones: 70 archivos, versiones únicas, sin intervención manual intermedia.

## 4. Estado inicial real que deja el replay (= Production nueva, antes de configurar)
Verificado automáticamente en `verify-clean-room.mjs` (31 chequeos × 3 escenarios):
- **Sin filas** en ninguna tabla de `public` salvo referencia: `reserved_usernames` (sembrada) y `legal_versions = [legal_v1]` **sin** fecha de vigencia. Ranking sin ediciones, Nivel sin usuarios, Intelligence sin outputs, Grupos sin fixtures, sin cuentas/perfiles/partidos/eventos/aceptaciones; `auth.users`, `storage.objects` y Vault vacíos.
- **`app_config` SIN fila**: no viene `staging` de las migraciones; es un paso de configuración.
- **Buckets** `avatars` y `group-photos`, ambos **privados**. **RLS** habilitada en todas las tablas.
- **Cron**: queda programado **solo** `bramu_weekly_ranking_publish` (`5 3 * * 1`, sin URL ni secretos; publica la primera edición real el primer lunes). El de altas abandonadas **no** se programa solo.
- Triggers de alta en `auth.users` presentes; privilegios = línea base del punto 2.
- **Humo post-configuración** (base descartable): con `app_config` sembrada, un alta confirmada con metadata legal crea 1 player + 1 profile + 1 `level_states` PENDIENTE + 1 aceptación; `get_my_legal_status`, `complete_profile`, `ops_health_snapshot`, secreto de cron (una sola vez) y schedule idempotente funcionan.

### Pasos de configuración que DEBEN hacerse tras el replay y antes del primer smoke (no ejecutados)
1. `insert into public.app_config (id, environment) values (1, 'production');` (el cliente verifica en runtime que coincida con el build).
2. `update public.legal_versions set effective_at = <fecha real> where legal_version = 'legal_v1';` (cuando exista).
3. `select public.schedule_cleanup_abandoned_signups('https://<ref>.supabase.co/functions/v1/cleanup-abandoned-signups');`
4. Auth (SMTP/plantillas/OTP/Secure email change/redirects) — proyecto Comunicaciones.
5. Desplegar las 10 Edge Functions con el `verify_jwt` de la tabla del punto 5.

## 5. Edge Functions (verificadas estáticamente; `deno` no disponible, no se pudo hacer `deploy --dry-run`)
Cada función resuelve **recursivamente** todos sus imports locales (incl. `_shared`), sin imports remotos salvo `esm.sh/@supabase/supabase-js@2`, sin secretos ni refs literales; entorno leído solo con `Deno.env.get`. `verify_jwt` esperado (el check falla si una función no tiene política declarada):

| función | verify_jwt | archivos | env |
|---|---|---|---|
| `admin-resolve-identity-issue` | **false** (service role exacta, auth propia) | 7 | – |
| `cleanup-abandoned-signups` | **false** (se autentica sola: secreto de Vault o service role) | 2 | – |
| `create-or-attach-match` | true | 9 | – |
| `delete-my-account` | true | 3 | – |
| `get-match-intelligence` | true | 11 | – |
| `officialize-match` | true | 8 | – |
| `officialize-onboarding` | true | 4 | – |
| `propose-match-correction` | true | 4 | – |
| `resolve-identity-issue` | true | 8 | – |
| `respond-match-correction` | true | 8 | – |

`84_release_manifest.json` guarda **sha256 por migración** y **hash del bundle (clausura de imports) por función**: Central lo contrasta con lo desplegado/aplicado en Staging para detectar deriva sin redeployar por rutina. *No se consultó Staging.*

## 6. Builds y guardas (ejecutados contra una copia temporal, sin tocar el repo)
Staging válido (exit 0, `env.generated.js` solo con `name/supabaseUrl/supabaseAnonKey`, robots no-index) · **Production con los placeholders legales actuales FALLA a propósito** (exit 1, "las páginas legales tienen datos pendientes", lista `nombre_legal_responsable`, …) y no deja `env.generated.js` de Production · Vercel Production con credenciales de Staging FALLA · Vercel Preview con credenciales de Production FALLA · faltan `BRAMU_ENV_NAME`/`SUPABASE_URL`/`SUPABASE_ANON_KEY` FALLA · Production con páginas legales completas (simuladas en la copia) construye e indexa. Service role ausente de todo script cliente y del SW (código sin comentarios); único CDN = supabase-js; `env.generated.js` nunca cacheado por el SW; bundle coherente (`store.js` = `version.json` = `CACHE_NAME` = `?v=`).

## 7. Qué se cambió
Migraciones: `20260930280000` (+ hardening incluido) y `20260930232000` (condicional) corregidas · **nueva** `20261001060000_bloque9a_baseline_privileges.sql` (**aplicada por Central en Staging durante el gate**) · `app.js`/`store.js` (guardas de laboratorio) + bundle `04.20-h3` · `supabase/scripts/{replay-migrations,verify-clean-room,release-check}.mjs` (+ PGlite devDependency) · `supabase/tests/audit-live-grants.sql` (sección 7) · `bramulab/bloque9a-release.test.mjs` (13) · test de prebloque9 corregido · Runbook y README.

**Gate Central ejecutado:** las **58/58** funciones ejecutables por `authenticated` en Staging coincidieron exactamente con las 58 re-concedidas. Central detectó además que PostgreSQL 17 introduce el privilegio de tabla `MAINTAIN`, no visible en `information_schema.role_table_grants`: 27 tablas públicas lo heredaban para `anon/authenticated`. Se incorporó `MAINTAIN` a la revocación actual y por defecto antes de aplicar la migración. Post-aplicación: 0 tablas con `MAINTAIN` cliente, superficie RPC 58/58 intacta y `PREBLOQUE9_VERIFY_OK`.

## 8. Pruebas ejecutadas
`release-check.mjs`: PASS (migraciones · hardcodes · 10 Edge Functions · cliente · 11 guardas de build · replay ×3 ACL). Verifies SQL del repo sobre la base replayada (escenario `observed`, con `app_config` sembrada): **14 OK**; **9 requieren cuentas reales de Staging** (`verify-bloque7-fase1/3`, `p01c`, `p03`, `ux-*`: fallan por diseño con `…requires_one_registered…`; se siguen corriendo en Staging); **3 no evaluables** acá (`grupos-26`, `grupos-b2a`, `grupos-b2c`: comparan `clock_timestamp()` consecutivos y el reloj de PGlite/WASM es grueso — medido: 6 valores distintos en 2000 inserts; PASS en Staging real según Central). Suite Node completa y `tests.html`: ver el commit (mismas fallas preexistentes de línea base: `h19-B`, `h21-9`, `h23`; 5 de calendario en `tests.html`).

## 9. NO se pudo probar (límites exactos)
GoTrue/Auth real (OTP, `email_change`, `amr`), Storage API real, runtime Deno y `functions deploy`, pg_cron/pg_net/Vault reales (solo shim), Vercel build real, Supabase Advisors, estado vivo de Staging (ACL por defecto reales, versiones de Edge Functions activas), `verify_jwt` realmente configurado, plan/región/backups. Ninguno bloquea 9A; los cubre el gate de Central.

## 10. Pendientes por responsable
- **Central:** **CERRADO/PASS**. Migración aplicada; permisos/RLS/cron/entorno/Edge Functions/advisors y Vercel contrastados contra Staging real.
- **Comunicaciones / Work / OTP:** emails, SMTP, Secure Email Change, QA browser, E2E destructivo con OTP.
- **Solo con autorización de Sebastián para Production:** todo el checklist B del Runbook (crear proyecto, replay real, variables Vercel, Edge Functions, cron, smoke, apertura), datos legales reales (`[[PENDIENTE_PRODUCCION:*]]`), AAIP/RNBDP, política de backups.

## 11. DECISIONES ABIERTAS
Ninguna. (Informativo: los 9 verifies que dependen de cuentas de Staging podrían reescribirse con fixtures propios para correr también en una base limpia; no se hizo por no ser riesgo de salida.)


## 12. Addendum — Gate Central real de Staging (01/10/2026)

**PASS.** Baseline previo: `5caf15318a19eb4cd279825360312f979adbb2a5`; entrega Claude: `a5ef575fef493bcbce38447d387c10cd29a6f1da` (Vercel SUCCESS).

- superficie `authenticated`: 58 funciones reales = 58 re-concedidas, sin faltantes/extras;
- hallazgo Central: PostgreSQL 17 `MAINTAIN` heredado por `anon/authenticated` en 27 tablas; corregido antes de aplicar y agregado a auditorías/verifies;
- `bloque9a_baseline_privileges` aplicada en Supabase Staging;
- post: 0 tablas con `MAINTAIN` cliente; anon solo SELECT `app_config`/`legal_versions`; anon solo EXECUTE `is_username_available`; 58 RPC autenticadas intactas; 0 tablas public sin RLS; 0 buckets públicos;
- `app_config.environment = staging`; cron Ranking + cleanup activos; `PREBLOQUE9_VERIFY_OK`;
- Edge runtime: ocho funciones de usuario con `verify_jwt=true`; `admin-resolve-identity-issue` y `cleanup-abandoned-signups` con `false` y autenticación propia;
- advisors: solo warnings conocidos/intencionales o de optimización; ninguno nuevo bloqueante.

No se tocó main, Production, BRAMUlive ni Comunicaciones.
