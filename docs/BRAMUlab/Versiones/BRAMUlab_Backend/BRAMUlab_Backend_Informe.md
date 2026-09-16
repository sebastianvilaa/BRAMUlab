# BRAMUlab — Backend/Infraestructura — Informe de implementación

> Registra qué se implementó, testeó y qué queda pendiente de Sebastián para
> cada bloque de `docs/BRAMUlab/Backend_Infraestructura.md`. Ese documento
> sigue siendo la fuente maestra de decisiones; este Informe es el registro
> de ejecución, como los `..._Informe.md` de `Versiones/BRAMUlab_V03` y
> `Versiones/BRAMUlab_V04` para el producto.

No usa la numeración `V04.x` (esa numeración es de Nivel BRAMU). Backend/Infraestructura se registra por **Bloque**, según el orden de implementación de la sección 15 de `Backend_Infraestructura.md`.

---

## Bloque 1 — Fundación de backend y entornos — CERRADO

**Fecha:** 16 de septiembre de 2026.
**Estado: CERRADO.** Código implementado y verificado en el Staging real de Supabase + Vercel (ver §14). Production queda preparado conceptualmente (misma estructura de migraciones/guarda ambiental, sin datos ni credenciales compartidas con Staging) pero su proyecto todavía no existe — se crea siguiendo el mismo procedimiento ya validado, cuando corresponda antes del lanzamiento real (no bloquea Bloque 2).
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
- [`supabase/migrations/20260916150000_bloque1_grant_app_config_select.sql`](../../../../supabase/migrations/20260916150000_bloque1_grant_app_config_select.sql) — agregada el mismo día tras verificar Staging (ver §13): `grant select on table public.app_config to anon, authenticated;`. Sin este GRANT la policy de arriba existe pero nunca se evalúa, porque el proyecto se creó con "Automatically expose new tables" desactivado.
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
- **Test que requiere un servicio externo real**: `supabase/tests/verify-rls.mjs` corrió contra el proyecto Supabase de Staging REAL el 16/09/2026 (lo ejecutó Sebastián con las credenciales de ese proyecto). Resultado: `RLS OK: deny-by-default se cumple.` — lectura pública de `app_config` en 200, lectura y escritura anónima de `players` denegadas (401). Ver §14.

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

### 13. Segunda corrección post-verificación en Staging (mismo día): falta GRANT en `app_config`

Con el fix de §12 aplicado, `/api/health` seguía devolviendo `{"ok":false,"error":"supabase_rest_error","status":401}`.

Causa: GRANT y RLS son dos capas separadas en Postgres. La policy `app_config_public_read` (de `20260916120000_...sql`) solo se evalúa para operaciones que el rol ya tiene permitidas por GRANT — sin GRANT, Postgres deniega el acceso a nivel de tabla antes de llegar a evaluar la policy. El proyecto Supabase de este piloto se creó con **"Automatically expose new tables" desactivado** (decisión correcta para no exponer nada por default), así que las tablas nuevas no reciben el GRANT automático que Supabase aplicaría si esa opción estuviera prendida. La migración original nunca declaró el GRANT explícito, asumiendo que Supabase lo aplicaba solo — esa suposición era la que estaba mal, no la policy.

Fix: nueva migración [`20260916150000_bloque1_grant_app_config_select.sql`](../../../../supabase/migrations/20260916150000_bloque1_grant_app_config_select.sql) — un único `grant select on table public.app_config to anon, authenticated;`. No modifica la migración anterior (ya aplicada), no toca `players` (sigue sin GRANT ni policy — deny-by-default real, a propósito) y no otorga insert/update/delete sobre `app_config`.

`supabase/tests/verify-rls.mjs`: no necesitó cambios de lógica. `expectDenied()` ya trataba "vacío" y "401/403" como equivalentes (ambos son "denegado" visto desde afuera), así que el mismo test que hoy exige `app_config` legible ya habría detectado este problema si hubiera corrido contra Staging antes que `/api/health`. Se agregó un comentario explicando el modelo de dos capas (GRANT + RLS) y se ajustó el label de `players` a "vacía o rechazada" para reflejar que cualquiera de las dos capas puede producir la denegación. Verificado con un mock local que reproduce el síntoma exacto (401 en `app_config` sin el grant) y confirma que el script falla correctamente en ese caso, y pasa una vez que `app_config` responde 200.

### 14. Cierre operativo real (16 de septiembre de 2026)

Sebastián completó las acciones manuales y verificó Bloque 1 contra servicios reales:

1. Proyecto Supabase de **Staging** creado.
2. Las dos migraciones de Bloque 1 aplicadas en orden (`20260916120000_...` y `20260916150000_...`).
3. `app_config` de ese proyecto seteado en `environment = 'staging'`.
4. Proyecto Vercel conectado al repositorio, Preview de la rama `staging` desplegado (`READY`).
5. `GET /api/health` en ese deploy → `{"ok":true,"environment":"staging","supabase":"reachable",...}`.
6. `node supabase/tests/verify-rls.mjs` corrido contra ese proyecto Supabase real → `RLS OK: deny-by-default se cumple.` (`app_config` legible en 200; `players` denegado en 401 para lectura y escritura anónima, como se esperaba).

Con esto, todos los criterios de "Terminado cuando" de `Backend_Infraestructura.md` §15 Bloque 1 quedan cumplidos sobre Staging real. **Bloque 1 queda CERRADO.**

**Pendiente real, no bloqueante para Bloque 2:** el proyecto Supabase de **Production** y su conexión en Vercel todavía no existen — se crean más adelante, antes del lanzamiento real, con el mismo procedimiento ya validado en Staging (mismas migraciones, misma guarda ambiental, sin copiar datos ni credenciales de Staging). `Backend_Infraestructura.md` §15 Bloque 2 depende solo de Bloque 1, no de que Production ya exista.

---

## Bloque 2 — Auth, perfil, username, ubicación y recuperación — CÓDIGO COMPLETO, PENDIENTE DE VALIDACIÓN

**Fecha:** 16 de septiembre de 2026.
**Estado: CÓDIGO COMPLETO, PENDIENTE DE VALIDACIÓN.** Todo lo de esta sección está escrito y pasa la suite local (1408/1408), pero nada corrió todavía contra el Supabase/Vercel de Staging reales — a diferencia de Bloque 1, esta ronda no tuvo credenciales de un proyecto real disponibles para verificar en vivo. Ver §14 más abajo para la lista exacta de lo que falta confirmar y cómo.
**Alcance de referencia:** `Backend_Infraestructura.md` §15 "Bloque 2".

### 1. Qué se implementó

**Migración SQL** — [`supabase/migrations/20260916180000_bloque2_auth_profile_username_location.sql`](../../../../supabase/migrations/20260916180000_bloque2_auth_profile_username_location.sql):

- `players`: agrega `created_by_player_id` (reservado para Bloque 4) y la política `players_select_own` (lectura de la propia fila por `auth_user_id = auth.uid()`). Sigue sin insert/update/delete para el cliente — la única fila la crea el trigger de abajo.
- `locations`: `location_id`, `country_code`, `source` (`georef`/`manual`), `georef_province_id`/`georef_locality_id`, labels, `verified_for_ranking`. El CHECK `locations_verified_matches_source` hace IMPOSIBLE insertar una fila `georef` sin `verified_for_ranking=true` o una `manual` con `verified_for_ranking=true` — el invariante de §5.3 ("una ubicación manual nunca habilita Ranking") es una restricción de base, no una promesa de la aplicación. RLS: solo `select` para `authenticated`; ninguna escritura directa del cliente.
- `reserved_usernames`: tabla + 33 nombres reservados sembrados (admin, root, bramu, soporte, etc.). RLS deny-by-default total, incluso para `authenticated` — solo la leen las funciones de abajo.
- `profiles`: `username` (`unique`, `check` de formato), `first_name`/`last_name`/`display_name`/`avatar_url`/`birth_date`/`gender`/`dominant_hand`/`preferred_side`/`competitive_branch`/`location_id`/`ranking_opt_in`. RLS: solo `select` de la propia fila (`profiles_select_own`) — **cero políticas de insert/update/delete para el cliente**, toda escritura pasa por `complete_profile` (§10.3: "no puede cambiar por API directa username, ubicación, rama... usa comandos server-side").
- `pilot_events`: esquema completo de §6.8 (los 11 `event_name` documentados), pero Bloque 2 solo emite `signup_completed` (server-side, desde el trigger). Deny-by-default total, ni siquiera lectura para `authenticated` — es auditoría interna, no dato de producto.
- **Trigger `handle_email_confirmed`** sobre `auth.users` (dos triggers: `after insert` y `after update of email_confirmed_at`, misma función) — crea `players`+`profiles` (incompleto) y registra `signup_completed` la primera vez que `email_confirmed_at` pasa a no-nulo. Cubre tanto el alta normal (insert con `email_confirmed_at` nulo, luego update al confirmar) como un alta ya confirmada en el mismo insert (Admin API con `email_confirm:true`, el caso que usa el script de verificación de §13). Idempotente: `on conflict do nothing` en ambos inserts.
- **RPC `is_username_available(p_username)`** — formato + reservados + unicidad, restringida a `authenticated`.
- **RPC `complete_profile(...)`** — única vía de escritura de perfil. Username: formato/reservado/único, y **queda fijo tras el primer set** (`username_locked` si se intenta cambiar; repetir el mismo valor es idempotente). `competitive_branch` obligatorio (`competitive_branch_invalid` si falta o no es `F`/`M`). Ubicación: hace *find-or-create* de `locations` en la MISMA transacción — con ambos IDs de GeoRef es `georef`/verificada, sin alguno de los dos es `manual`/no verificada, **sin importar lo que mande el cliente** (el `source`/`verified_for_ranking` los decide la función, no un parámetro). Excepciones con nombre claro (`username_taken`, `username_locked`, `username_reserved`, `username_invalid_format`, `competitive_branch_invalid`, `location_required`, etc.) para que el cliente arme el mensaje.

**Frontend** (`bramulab/`):

- [`auth.js`](../../../../bramulab/auth.js) (nuevo) — único módulo que habla con Supabase Auth + las RPCs de arriba. `PLAuth.isConfigured()` es la única bisagra: sin `window.__BRAMU_ENV__` (Bloque 1, generado solo en un build real de Vercel) o sin el CDN de `supabase-js`, todo el resto de la app sigue funcionando exactamente igual que antes de este bloque — nunca rompe el desarrollo local sin backend.
- `index.html` — agrega el CDN `@supabase/supabase-js@2` + `env.generated.js` + `auth.js?v=04.10-h1`; nuevo paso "verify" en `#view-signup` (código de 6 dígitos) entre "CREAR CUENTA" y "TU PERFIL"; nuevo campo **Rama competitiva** (F/M) en el paso "TU PERFIL", mismo patrón visual que Mano hábil/Lado habitual; nuevo botón "Reenviar código" en `#view-forgot-password` paso 2; `@usuario` pasa de `maxlength="20"` a `24` en signup y Editar Datos.
- `app.js` — reescribe el wizard de alta (`initSignupWizard`/`renderSignupStep`/`recomputeSignupStepValidity`) para el flujo real: paso 1 llama `Auth.signUp`, paso "verify" llama `Auth.verifySignupOtp` (código de 6 dígitos, **nunca un link con redirect** — ver más abajo), paso 2 llama `Auth.completeProfile` y cachea el resultado con `Store.cacheServerUser`. Login (`initLoginScreen`), logout (`doLogout`), recuperación (`initForgotPasswordScreen`) y cambio de contraseña (`initChangePasswordScreen`) pasan por las mismas funciones de `auth.js` cuando hay backend configurado; sin backend, siguen exactamente el camino 100% local de siempre (nada se borró). Nuevo `bootWithServerSession()` reemplaza el `bootDefaultScreen()` directo del arranque: si hay una sesión real persistida (Supabase la guarda sola), la reconoce sin pedir login de nuevo — "entrar desde otro dispositivo"/entre recargas.
- `store.js` — nueva función `cacheServerUser(user)`: upsert por `id` (no genera uno nuevo, a diferencia de `createUserAccount`) en la MISMA lista local de `USERS` y deja la sesión activa. Esto es lo que permite que el resto de la app (Home, Grupos, Notificaciones, Nivel V1 simulado, Ranking simulado — todos leen `Store.getCurrentUser()` de forma síncrona) siga funcionando **sin ningún cambio**: el "userId" que usan pasa a ser el `player_id` real de Supabase en vez de un id local `u_...`, pero sigue siendo un string opaco para esos módulos.
- `player-identity.js` — formato de `@usuario` actualizado al vigente de Bloque 2 (3–24 caracteres, `[a-z0-9._]`, reemplaza el `[a-z0-9-]` 3–20 de V03.0); `slugifyUsername`/`suggestUsername` ahora separan con `_` en vez de `-`; nueva `isUsernameReserved` (espejo cliente de la tabla `reserved_usernames`, para feedback instantáneo — nunca la autoridad).
- `locations.js` — `searchLocationsRemote` ahora pide también `id` a GeoRef (`campos=id,nombre,provincia`) y expone `localityId`/`provinceId` en cada resultado; verificado en vivo contra la API real (`apis.datos.gob.ar/georef/api/localidades?...&campos=id,nombre,provincia` devuelve `{id, nombre, provincia:{id,nombre}}`). Sin esto, el backend no podría distinguir una ubicación GeoRef real de una manual. `searchLocations` (fallback local) y `buildManualLocation` no cambian — nunca tuvieron ni van a tener esos IDs, así que una ubicación elegida por esos dos caminos siempre llega a `complete_profile` como `manual`/no verificada, tal como corresponde.
- `sw.js` — bump `-h1` (mismo patrón que los hotfixes de V03.5.2/V03.6): `CACHE_NAME`/`?v=` pasan a `04.10-h1`, agrega `auth.js` a `CORE_ASSETS`. **`Store.VERSION`/`version.json` NO cambian** (siguen en "BRAMUlab V04.10") — esto es un bloque de Backend/Infraestructura, no una ronda nueva de Nivel BRAMU (`docs/BRAMUlab/README.md` §6: Backend no usa la numeración `V04.x`). `env.generated.js` y el CDN de `supabase-js` NO se agregan a `CORE_ASSETS` a propósito: el primero no existe fuera de un build de Vercel (rompería `cache.addAll`, que es atómico) y el segundo es de otro origen.

### 2. Por qué el email se confirma con un código de 6 dígitos, nunca con un link

`Backend_Infraestructura.md` §8.1 solo exige el código de 6 dígitos para "olvidé mi contraseña"; para la confirmación de alta no fija el mecanismo. Se eligió el mismo patrón para las dos (`verifyOtp` con `type:'signup'`/`type:'recovery'`, ambos vía código tipeado a mano) en vez de un link de confirmación con redirect, por varias razones concretas de esta app:

- `#view-forgot-password` YA tenía exactamente esta UX (código de 3 pasos) desde V03.0.3.1 — reusarla para la confirmación de alta es cero pantallas nuevas de verdad, solo un paso más en el mismo wizard.
- Un link de confirmación exige configurar `redirectTo`/dominios permitidos en Supabase y manejar la vuelta a la app (¿nueva pestaña? ¿la misma? ¿qué pasa si el link se abre en el navegador del teléfono en vez de donde se hizo el alta?) — la PWA no tenía ninguna lógica de deep-link/redirect hasta ahora.
- Con código, la persona nunca sale de la pantalla de alta: pega o tipea el código y sigue en el mismo lugar. `auth.js` inicializa el cliente con `detectSessionInUrl:false` — nunca se intenta leer un token de la URL.

**Consecuencia operativa (acción manual, ver §14):** para que el email de confirmación y el de recuperación traigan un código en vez de un link, hay que editar las plantillas "Confirm signup" y "Reset Password" en el dashboard de Supabase (Authentication → Email Templates) reemplazando `{{ .ConfirmationURL }}` por `{{ .Token }}`. Sin ese cambio, ambos emails van a seguir trayendo el link por defecto y el código que la persona tipee en la app nunca va a coincidir.

### 3. Decisiones de alcance (qué quedó deliberadamente afuera)

- **`level_state` inicial:** `Backend_Infraestructura.md` §8.1.3 menciona crear un `level_state` inicial junto con `player`/`profile` al verificar el email, pero §15 Bloque 2 "Incluye" no lo lista (es Bloque 3). El trigger de esta migración crea `players`+`profiles`, **no** `level_states` — Bloque 3 va a tener que extender ese mismo trigger (o agregar uno propio) cuando defina el esquema de Nivel.
- **`ranking_opt_in`:** la columna existe (`default false`, nunca opt-in implícito) pero no hay ningún checkbox de consentimiento en el alta todavía — §8.2 punto 5 lo menciona como parte de "completar perfil", pero agregar esa UI no es indispensable mientras Ranking productivo (Bloque 7) no exista. Queda en `false` para todas las cuentas hasta que se agregue esa pantalla.
- **Teléfono/WhatsApp, avatar real, categoría declarada/Nivel:** `Backend_Infraestructura.md` §6.1 no define columnas para nada de esto en `profiles`. El frontend YA tiene estos campos (V03.6/V04.x) pero siguen sin persistir server-side — no se inventó ninguna columna nueva sin que el documento maestro la pida. `PLAuth.fetchOwnProfile()` los deja en `null`/`false` a propósito.
- **Editar Datos (`#view-edit-data`) sigue sin conectar:** esa pantalla escribe hoy SOLO en el caché local (`Store.updateUserAccount`). Para una cuenta real, dejarla guardar así habría sido peor que no tocarla: parecería que funcionó pero se perdería en el próximo login (`Auth.fetchOwnProfile` pisa el caché con lo que de verdad hay en el servidor) — silenciosamente, sin ningún aviso. En vez de eso, `openProfileEditModal` detecta `user.serverBacked` y deshabilita **GUARDAR** con un aviso explícito ("la edición de perfil para cuentas reales todavía no está conectada al servidor"); el submit handler tiene el mismo guard como defensa en profundidad. Wiring completo de esa pantalla (reusando `complete_profile`, ya listo para eso) queda para una ronda aparte — varios de sus campos (teléfono, avatar) ni siquiera tienen columna todavía, ver el punto anterior.
- **Búsqueda/lectura de perfiles ajenos:** no hay ninguna política de `select` para leer el `profile`/`players` de otra persona — cada cuenta solo lee la suya. Es exactamente lo que pide Bloque 2 ("un usuario no puede leer... datos privados ajenos"); la lectura de perfiles públicos es Bloque 4 (búsqueda de jugadores), que va a agregar su propia política/vista sobre esta misma base.
- **Bug preexistente encontrado de paso (no es de este bloque):** probando el alta real se encontró que el Home (`renderPlayerCard`, `#player-home-handle`) muestra un `@usuario` FABRICADO desde el nombre en vez del real (`buildPlayerHandle(currentPlayerName)` en vez de `account.username`) — bug de V03.0, no introducido acá, pero más visible ahora porque el formato vigente usa `_` en vez de `-`. Quedó anotado como tarea aparte, no se tocó en esta ronda (fuera del alcance de Backend/Auth).

### 4. Tests

- **Suite local** (`bramulab/tests.html`): **1408/1408 verdes** (1400 previos − 4 assertions de formato de `@usuario` desactualizadas, reemplazadas por 12 nuevas: formato 3–24/`[a-z0-9._]`, reservados, `slugifyUsername`/`suggestUsername` con `_`). Verificado abriendo `tests.html` en el navegador contra el dev server local (`.claude/dev-server.py`).
- **Smoke test manual en el navegador** (sin backend real — ver §13 sobre por qué): alta completa de una cuenta 100% local (sin `window.__BRAMU_ENV__`/CDN, mismo camino que desarrollo local siempre tuvo) hasta "TU PERFIL ESTÁ LISTO" y Home, incluyendo el campo nuevo de Rama competitiva y una búsqueda real contra GeoRef (`Palermo, Ciudad Autónoma De Buenos Aires`, con id `0209801001`/provincia `02` confirmados). Sin errores nuevos en consola (los únicos dos son esperados: `env.generated.js` 404 porque no existe fuera de un build de Vercel, y el CDN de `supabase-js` bloqueado por la política de red de este entorno de desarrollo). Confirma que el camino sin backend real sigue intacto — **no** confirma los caminos reales de Supabase (ver §13/§14).
- **`supabase/tests/verify-bloque2.mjs`** (nuevo, sigue el patrón de `verify-rls.mjs` de Bloque 1) — requiere red y `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` de un proyecto real con esta migración aplicada. **No corrió todavía** (ver §13/§14): crea 2 cuentas de prueba ya confirmadas vía Admin API, verifica RLS anónima, que el trigger arma `players`+`profiles`, que no se puede escribir `profiles` directo, `is_username_available` (reservado/libre), `complete_profile` (alta con ubicación manual → `verified_for_ranking=false`, `username_locked` al intentar cambiar el username, idempotencia, `username_taken` entre cuentas distintas, ubicación GeoRef → `verified_for_ranking=true`, RLS entre cuentas), y limpia las 2 cuentas y sus filas al final.

### 5. Commit / push

Ver el commit de esta ronda en el historial de `main` (mensaje `feat(BRAMUlab Backend Bloque 2): ...`) — incluye la migración, `auth.js`, los cambios de `index.html`/`app.js`/`store.js`/`player-identity.js`/`locations.js`/`sw.js`, `supabase/tests/verify-bloque2.mjs` y esta actualización del Informe.

### 6. Limitación real de esta ronda: sin credenciales de un proyecto Supabase real

A diferencia de Bloque 1 (donde Sebastián corrió `verify-rls.mjs`/`/api/health` contra Staging real el mismo día), esta ronda no tuvo acceso a un proyecto Supabase/Vercel real para verificar en vivo — ni el `SUPABASE_URL`/`SUPABASE_ANON_KEY` de Staging, ni mucho menos la `SUPABASE_SERVICE_ROLE_KEY` (que nunca debe pegarse en un chat de todos modos). Todo lo de este bloque está escrito siguiendo al pie de la letra la API documentada de Supabase Auth/PostgREST (`signUp`/`verifyOtp`/`signInWithPassword`/`resetPasswordForEmail`/`updateUser`/`.rpc(...)`, todas estables desde hace años) y probado exhaustivamente donde se pudo (suite local, GeoRef real, camino sin backend), pero **la integración real con Supabase — la parte más importante de este bloque — todavía no se ejecutó ni una sola vez contra un servicio real.**

### 7. Cómo verificar esto contra Staging real, paso a paso

1. Aplicar la migración `20260916180000_bloque2_auth_profile_username_location.sql` en el proyecto Supabase de Staging (SQL Editor, después de las dos de Bloque 1).
2. En el dashboard de Supabase, Authentication → Email Templates: editar "Confirm signup" y "Reset Password" para que usen `{{ .Token }}` en vez de `{{ .ConfirmationURL }}` (ver §2).
3. Confirmar que Staging tiene un proveedor SMTP real configurado (Authentication → Settings) — sin esto, ningún email sale y ni el alta ni la recuperación se pueden probar de punta a punta.
4. Correr `SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/tests/verify-bloque2.mjs` (las tres variables son las de ESE proyecto de Staging, la service role key nunca se pega en el chat) — confirma toda la lógica de servidor (RLS, trigger, RPCs) sin necesitar un email real.
5. Con el deploy de Staging (Vercel) ya actualizado con este código: probar a mano, en el navegador real, el recorrido completo — crear cuenta con un email real, recibir el código de 6 dígitos, confirmarlo, completar "TU PERFIL" (incluida una ubicación real y una manual), cerrar sesión, iniciar sesión de nuevo, "olvidé mi contraseña" con el email real, y entrar desde un segundo dispositivo/navegador para confirmar que la sesión y el perfil persisten.
6. Confirmar que un `@usuario` duplicado falla mostrando el mensaje en español correcto (no un error crudo de Postgres) y que una cuenta no puede ver el perfil de otra ni siquiera pidiéndolo directo a la API REST.

### 8. Acciones manuales pendientes de Sebastián

1. Aplicar la migración de esta ronda en Staging (y, más adelante, en Production cuando exista).
2. Editar las 2 plantillas de email en el dashboard de Supabase (§2/§7 punto 2).
3. Confirmar SMTP real en Staging si todavía no está (§7 punto 3) — sin esto no se puede probar nada de punta a punta.
4. Correr `verify-bloque2.mjs` contra Staging con la service role key (§7 punto 4).
5. Hacer el recorrido manual completo en el navegador (§7 punto 5) y avisar si algo no se comporta como este Informe describe — especialmente los mensajes de error en español (`SIGNUP_STEP1_ERROR_TEXT`/`SIGNUP_VERIFY_ERROR_TEXT`/`COMPLETE_PROFILE_ERROR_TEXT`/`LOGIN_ERROR_TEXT` en `app.js`), que se armaron mapeando los códigos de error documentados de Supabase/las excepciones de `complete_profile` sin poder ver una respuesta real todavía.

**Bloque 2 NO queda cerrado hasta que los puntos 1-5 se confirmen contra Staging real.**
