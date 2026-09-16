# BRAMUlab — Backend/Infraestructura — Informe de implementación

> Registra qué se implementó, testeó y qué queda pendiente de Sebastián para
> cada bloque de `docs/BRAMUlab/Backend_Infraestructura.md`. Ese documento
> sigue siendo la fuente maestra de decisiones; este Informe es el registro
> de ejecución, como los `..._Informe.md` de `Versiones/BRAMUlab_V03` y
> `Versiones/BRAMUlab_V04` para el producto.

No usa la numeración `V04.x` (esa numeración es de Nivel BRAMU). Backend/Infraestructura se registra por **Bloque**, según el orden de implementación de la sección 15 de `Backend_Infraestructura.md`.

---

## Bloque 1 — Fundación de backend y entornos

**Fecha:** 16 de septiembre de 2026.
**Alcance de referencia:** `Backend_Infraestructura.md` §15 "Bloque 1" y §16 "Primer handoff".

### 1. Qué se implementó

**Guarda ambiental y build por entorno**

- [`bramulab/scripts/env-guard.mjs`](../../../../bramulab/scripts/env-guard.mjs) — lógica pura que valida `BRAMU_ENV_NAME` + `SUPABASE_URL` + `SUPABASE_ANON_KEY`, y en un build de Vercel además cruza `BRAMU_ENV_NAME` contra `VERCEL_ENV`: un deploy de Production solo puede declararse `production`, y ningún deploy no-Production puede declararse `production`. Cualquier variable faltante o cruzada hace fallar el build (`process.exit(1)`), nunca genera un deploy a medias.
- [`bramulab/scripts/build-env.mjs`](../../../../bramulab/scripts/build-env.mjs) — Build Command de Vercel. Lee `.env.<entorno>` local si existe (parser propio, sin dependencias) y genera dos archivos que **no se commitean**:
  - `bramulab/env.generated.js` → `window.__BRAMU_ENV__` con `name`, `supabaseUrl`, `supabaseAnonKey`. Nunca lee ni escribe `SUPABASE_SERVICE_ROLE_KEY`.
  - `bramulab/robots.generated.txt` → `Disallow: /` en Development/Staging, `Allow: /` en Production (evita indexación accidental de Staging).
- [`bramulab/vercel.json`](../../../../bramulab/vercel.json) — declara el Build Command y reescribe `/robots.txt` → `/robots.generated.txt`.
- [`bramulab/.env.example`](../../../../bramulab/.env.example) — plantilla documentada, sin valores reales.

**Health check**

- [`bramulab/api/health.js`](../../../../bramulab/api/health.js) — función serverless de Vercel (`GET /api/health`). Confirma que el deploy tiene sus variables, que puede leer `app_config` en Supabase y que el `environment` que ese proyecto declara coincide con `BRAMU_ENV_NAME` del deploy. Si algo falla, responde `ok:false` con un `error` específico (`missing_env_vars`, `supabase_unreachable`, `supabase_rest_error`, `app_config_not_seeded`, `environment_mismatch`) — nunca oculta la causa.

**Esquema y RLS**

- [`supabase/migrations/20260916120000_bloque1_environment_guard_and_identity_seed.sql`](../../../../supabase/migrations/20260916120000_bloque1_environment_guard_and_identity_seed.sql):
  - `app_config`: fila única (`id` fijo en `1`) con `environment` (`development|staging|production`). RLS habilitada con una única política pública de `select` para `anon`/`authenticated`. Sin políticas de escritura: se administra a mano por SQL editor.
  - `players`: esqueleto mínimo (`player_id`, `type`, `auth_user_id`, `display_name`, `is_active`, timestamps). RLS habilitada, **cero políticas** — deny-by-default real, nadie puede leer ni escribir todavía. Bloque 2 agrega `profiles` y las políticas reales.
- [`supabase/tests/verify-rls.mjs`](../../../../supabase/tests/verify-rls.mjs) — script de verificación contra un proyecto Supabase real (requiere red): confirma que `players` no es legible/escribible por `anon` y que `app_config` sí es legible. **No forma parte de la suite local.**

### 2. Qué se decidió y por qué (no estaba fijado por Backend_Infraestructura.md)

- **Un solo proyecto Vercel, entornos nativos de Vercel** en vez de dos proyectos separados. `Backend_Infraestructura.md` §3.1 permite "proyectos **o configuraciones** claramente separados". Se eligió un proyecto con Root Directory `bramulab/`, usando el `Environment` nativo de Vercel: `Production` (rama `main`) y `Preview` (cualquier otra rama/PR, que en nuestro vocabulario es "Staging"). Es más simple de administrar para una sola persona y separa igual de bien las credenciales, porque cada `Environment` tiene su propio set de variables en el panel de Vercel.
- **Rama `staging` dedicada** para tener una URL de Vercel estable y predecible (`...-git-staging-....vercel.app`) en vez de depender de URLs de preview por PR. Se creó localmente y se pusheó a `origin/staging` junto con este Bloque 1.
- **`app_config` como guarda ambiental** en vez de solo confiar en las variables de Vercel: si alguien pega por error la URL de Producción en Staging, el health check lo detecta comparando lo que el proyecto Supabase dice de sí mismo (`environment`) contra lo que el deploy cree que es (`BRAMU_ENV_NAME`). Esto cubre el caso que las variables de Vercel solas no pueden cubrir (typo al copiar una URL).
- **Sin `supabase/config.toml`**: no se fabricó porque el esquema exacto depende de la versión del Supabase CLI y no había forma de verificarlo sin instalarlo. Cuando se instale el CLI, `supabase init` lo genera solo; `supabase/migrations/` ya está listo y el CLI lo reconoce.
- **`players` sí, `profiles` no**: `Backend_Infraestructura.md` autoriza para Bloque 1 el "esquema inicial de identidades". `profiles` (username, ubicación, rama competitiva) es explícitamente del Bloque 2 (§6.1, §8.2, §15 Bloque 2). Se creó solo el ancla de identidad (`players`) para no pre-decidir columnas que Bloque 2 todavía tiene que cerrar.

### 3. Variables de entorno

| Variable | Público/Secreto | Dónde se usa | Dónde se configura |
|---|---|---|---|
| `BRAMU_ENV_NAME` | Público | Build (`build-env.mjs`) y runtime (`api/health.js`) | Vercel → Settings → Environment Variables (una por Environment: Production / Preview). Local: `bramulab/.env.development` |
| `SUPABASE_URL` | Público | Build y runtime | Igual que arriba |
| `SUPABASE_ANON_KEY` | Público (protegida por RLS, no es secreta). Contiene la Publishable Key nueva de Supabase (`sb_publishable_...`), no el JWT `anon` legacy — va solo en el header `apikey`, nunca en `Authorization: Bearer` (ver §12) | Build y runtime | Igual que arriba |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta** | Todavía no se usa en ningún código de Bloque 1 | Reservada para Bloque 2+; si se necesita antes, configurarla en Vercel marcada como sensible y nunca pegarla en el chat |
| `VERCEL`, `VERCEL_ENV` | Provistas automáticamente por Vercel | Guarda cruzada en `build-env.mjs` | No se configuran a mano |

`SUPABASE_ANON_KEY` es pública por diseño de Supabase (viaja al navegador en cualquier app cliente); lo que la protege es RLS, no el secreto de la key. `SUPABASE_SERVICE_ROLE_KEY` sí es un secreto real: nunca debe llegar al frontend ni a `api/health.js`.

### 4. Procedimiento de migraciones

1. Escribir un archivo nuevo en `supabase/migrations/` con nombre `YYYYMMDDHHMMSS_descripcion.sql` (timestamp = momento en que se escribe, siempre creciente).
2. Aplicarlo primero en el proyecto Supabase de **Development** (o uno descartable).
3. Aplicarlo en **Staging**, correr `supabase/tests/verify-rls.mjs` contra Staging.
4. Recién después aplicarlo en **Production**, con el proyecto respaldado (ver Backups abajo).
5. Una migración nunca hace `DELETE`/`TRUNCATE` de datos reales ni reemplaza filas existentes; solo agrega o altera estructura. Revertir un cambio de estructura es otra migración nueva, no un `git revert` de la anterior contra una base que ya tiene datos.

Aplicación manual (sin CLI todavía): pegar el contenido del archivo `.sql` en Supabase Dashboard → SQL Editor → Run, en el proyecto correspondiente.

Aplicación con Supabase CLI (cuando esté instalado): `supabase link` al proyecto, después `supabase db push`.

### 5. Procedimiento de deploy

1. Trabajar y commitear contra `main` como siempre (o una rama de feature → PR a `main`).
2. Para probar en Staging: `git push origin main:staging` o mergear a la rama `staging` — cualquier push a `staging` dispara un Preview deploy en Vercel con las variables de Staging.
3. Verificar `https://<url-de-staging>/api/health` → `{"ok": true, "environment": "staging", ...}`.
4. Recién entonces promover a Production (push/merge a `main`), que dispara el deploy de Production con las variables de Production.
5. Verificar `https://<url-de-produccion>/api/health` de la misma forma.

Mientras Vercel no esté conectado, Production sigue siendo GitHub Pages (`https://sebastianvilaa.github.io/BRAMUlab/bramulab/`) — Bloque 1 no lo reemplaza todavía; ver "Acciones manuales" abajo.

### 6. Backups / exportación

- Supabase ofrece backups automáticos diarios (plan Free: ~7 días de retención lógica vía `pg_dump` bajo demanda; planes pagos agregan PITR). Antes de una migración en Production: Dashboard → Database → Backups → exportar manualmente, o `pg_dump` vía `supabase db dump` con el CLI.
- Exportación periódica recomendada mientras el piloto sea chico: un `pg_dump` manual mensual guardado fuera de Supabase (por ejemplo, en el mismo lugar donde se guardan las demás copias de este proyecto).

### 7. Rollback básico

- **Cambio de estructura sin datos afectados:** escribir una migración nueva que revierte la anterior (`ALTER TABLE ... DROP COLUMN ...`, etc.).
- **Datos corrompidos por un error real:** restaurar desde el backup/PITR más reciente anterior al incidente (Dashboard → Database → Backups → Restore). Es una acción destructiva sobre la base real: no se automatiza acá, se documenta como procedimiento manual para cuando haga falta.
- **Deploy de frontend roto:** Vercel guarda cada deploy anterior; "Promote to Production" sobre el deploy bueno anterior revierte el frontend sin tocar la base de datos (el código nunca es la fuente de los datos, por diseño de `Backend_Infraestructura.md` §3.2).

### 8. Cómo comprobar qué entorno está activo

- `GET /api/health` en la URL del deploy que se quiera revisar. La respuesta trae `environment` (lo que ese deploy cree que es) y, si algo no coincide con lo que el proyecto Supabase declara, devuelve `environment_mismatch` en vez de `ok:true`.
- No hay endpoint equivalente para Development porque Development no corre `api/*` sin Vercel (ver limitación abajo); para Development alcanza con mirar qué `SUPABASE_URL` tiene `bramulab/.env.development`.

### 9. Tests

- **Suite existente de la app** (`bramulab/tests.html`, engine/Nivel/stats/etc.): no se tocó ningún archivo que esa suite carga. Sigue en **1400/1400**.
- **Tests nuevos, locales y reproducibles** (sin red, corren con Node):
  - `node --test bramulab/scripts/env-guard.test.mjs` — 10/10 verdes (guarda ambiental: variables faltantes, entorno inválido, cruces Production↔no-Production).
  - `node --test bramulab/api/health.test.mjs` — 7/7 verdes (health check contra un servidor HTTP local que simula las respuestas de Supabase: ok, mismatch, tabla vacía, error 5xx, variables faltantes, servidor caído, y el caso de regresión de §12: Publishable Key solo en `apikey`).
  - Total infraestructura: **17/17 verdes**, ejecutados en esta misma máquina como parte de esta ronda.
- **Test que requiere un servicio externo real** (no local, no automático): `supabase/tests/verify-rls.mjs`. No corrió todavía contra el proyecto Supabase real (esta sesión no tiene esas credenciales). Sí se re-verificó su lógica contra el mock local después del fix de §12, con el mismo resultado. Falta correrlo contra Staging de verdad — mismo pendiente que antes del fix.

### 10. Limitación conocida: Development no tiene `/api/*` con el servidor local

`.claude/dev-server.py` es un servidor estático simple (Python) y no ejecuta funciones serverless. `api/health.js` solo corre en la infraestructura de Vercel (Production/Staging) o localmente con `vercel dev` (si se instala el CLI de Vercel). Esto es aceptable para Bloque 1: `Backend_Infraestructura.md` §11 no exige paridad completa en Development ("Falsos/locales o proyecto dev desechable"), y no se quiso agregar una dependencia nueva (Vercel CLI) sin que Sebastián la pida.

### 11. Qué NO se tocó (a propósito)

`bramulab/index.html`, `app.js`, `engine.js`, `store.js`, `level*.js`, `stats.js`, `groups.js`, `ranking.js`, `sw.js`, `manifest.webmanifest` — ningún archivo de producto/UX se modificó. `env.generated.js` no se referencia todavía desde `index.html`; eso es trabajo de Bloque 2, cuando haya algo real que leer de esa configuración (Supabase Auth).

---

### 12. Corrección post-verificación en Staging (mismo día): Publishable Key vs `Authorization: Bearer`

Al conectar el primer deploy Preview real en Vercel, `/api/health` devolvía `{"ok":false,"error":"supabase_rest_error","status":401}`.

Causa: el proyecto Supabase usa la Publishable Key nueva (prefijo `sb_publishable_...`), no el JWT `anon` legacy. `health.js` y `verify-rls.mjs` mandaban esa key en dos headers, `apikey` y `Authorization: Bearer`. PostgREST intenta validar cualquier `Authorization: Bearer` como JWT; como la Publishable Key no es un JWT, la request entera se rechaza con 401 antes de llegar a RLS.

Fix: sacar el header `Authorization` de ambos archivos. La key va solo en `apikey`, que es lo único que PostgREST necesita para autenticación anónima. `SUPABASE_ANON_KEY` sigue llamándose así (no se tocó Vercel) pero de acá en adelante hay que leerlo como "key pública de Supabase", no como "JWT anon". No se tocaron RLS, migraciones, ni ningún archivo fuera de `bramulab/api/health.js`, `supabase/tests/verify-rls.mjs` y sus tests.

Test de regresión agregado: `bramulab/api/health.test.mjs` → "manda la Publishable Key solo en apikey, nunca como Authorization Bearer" — el mock de Supabase devuelve 401 si detecta un header `Authorization`, igual que PostgREST real.

## Acciones manuales pendientes (Sebastián)

Ver la respuesta de esta ronda en el chat — sección "ACCIONES MANUALES QUE DEBE HACER SEBASTIÁN" — para el detalle paso a paso en lenguaje no técnico. Resumen de qué falta para que Bloque 1 quede operativamente cerrado (el código ya está listo para todo esto):

1. Crear el proyecto Supabase de **Staging** (y más adelante el de Production).
2. Correr la migración de Bloque 1 en ese proyecto (SQL Editor, pegar y ejecutar).
3. Insertar la fila de `app_config` de ese proyecto con su `environment` correspondiente.
4. Crear/conectar un proyecto Vercel a este repositorio, con Root Directory `bramulab`.
5. Cargar las variables de entorno en Vercel (Production y Preview, con los valores de cada proyecto Supabase).
6. Verificar `/api/health` en el deploy resultante.
7. Correr `supabase/tests/verify-rls.mjs` contra Staging.

Hasta que esto pase, Bloque 1 está **completo del lado del código** pero **no cerrado operativamente**.
