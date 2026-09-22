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

## Bloque 2 — Auth, perfil, username, ubicación y recuperación — CERRADO

**Fecha de implementación:** 16 de septiembre de 2026. **Fecha de cierre:** 18 de septiembre de 2026.
**Estado: CERRADO.** Toda la lógica de servidor (migración, RLS, trigger, RPCs) y el recorrido real de una persona en el navegador (alta, confirmación, perfil, logout/login, segunda sesión limpia, recuperación de contraseña, username duplicado) quedaron validados contra Supabase Staging real, con la cuenta real `sebas_lp873@yahoo.com.ar`. Ver §6 para el detalle exacto de esa validación del 18/09.
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

- **Suite local** (`bramulab/tests.html`): **1408/1408 verdes** (1400 previos − 4 assertions de formato de `@usuario` desactualizadas, reemplazadas por 12 nuevas: formato 3–24/`[a-z0-9._]`, reservados, `slugifyUsername`/`suggestUsername` con `_`). Verificado abriendo `tests.html` en el navegador contra el dev server local (`.claude/dev-server.py`), y de nuevo tras el fix de §4bis sin ningún cambio de resultado.
- **Smoke test manual en el navegador** (sin backend real): alta completa de una cuenta 100% local hasta "TU PERFIL ESTÁ LISTO" y Home, incluyendo el campo nuevo de Rama competitiva y una búsqueda real contra GeoRef. Sin errores nuevos en consola. Confirma que el camino sin backend real sigue intacto.
- **`supabase/tests/verify-bloque2.mjs` contra Supabase Staging REAL** (16/09/2026, corrido por Sebastián con las credenciales de ese proyecto — nunca compartidas en el chat): **16/16 checks OK**, salida final `BLOQUE 2 OK: Auth/perfil/username/ubicación se comportan como espera Backend_Infraestructura.md.` Confirmado contra el servicio real:
  - lectura anónima de `profiles`/`locations`/`reserved_usernames`/`pilot_events` → denegada;
  - el trigger `handle_email_confirmed` arma `players`+`profiles` (incompleto) apenas el email queda verificado;
  - `PATCH` directo sobre `profiles` → rechazado (RLS, sin política de update);
  - `is_username_available`: `"admin"` (reservado) → `false`; un username libre → `true`;
  - `complete_profile` con ubicación manual → OK, y esa ubicación queda `verified_for_ranking=false`;
  - `username_locked` al intentar cambiar el username ya fijado;
  - repetir el mismo username es idempotente (no falla);
  - `username_taken` cuando otra cuenta intenta usar el mismo username;
  - RLS: una cuenta no puede leer el `profile` de otra;
  - `complete_profile` con ubicación GeoRef (IDs canónicos) → OK, y esa ubicación queda `verified_for_ranking=true`.

  Primera corrida real: 2 FALLA (`username_invalid_format` en vez de `username_locked`/en el alta GeoRef) — bug del propio script, no del backend: los usernames de prueba (`verify_b2_${stamp}` con `stamp=Date.now()`, 13 dígitos decimales) superaban el límite de 24 caracteres una vez agregado el sufijo `_otro` o el prefijo `_geo_`. Corregido acortando `stamp` a base36 (~8 caracteres) y los prefijos (`vb2_`/`vb2geo_`) — sin tocar la migración ni relajar ninguna validación. Segunda corrida: **16/16 OK**.

### 5. Configuración manual ya completada por Sebastián (16/09/2026)

1. Migración `20260916180000_bloque2_auth_profile_username_location.sql` aplicada en Supabase Staging.
2. SMTP custom de Staging configurado con Gmail (Authentication → Settings).
3. Plantilla "Confirm signup" usando `{{ .Token }}` (código de 6 dígitos, no link).
4. Plantilla "Reset Password" usando `{{ .Token }}`.
5. `verify-bloque2.mjs` corrido contra ese proyecto real → 16/16 OK (§4).

### 6. Validación real de UX/Auth — 18/09/2026

Sesión de validación guiada paso a paso contra la app real de Staging (`https://bramulab-git-staging-bramu-lab.vercel.app`), con la cuenta real `sebas_lp873@yahoo.com.ar` (nombre visible `Sebas`, username `sebas`). Continuación del handoff `Temporales/HANDOFF_BRAMUlab_Bloque2_Continuacion.md` (signup/confirmación/onboarding ya habían quedado probados el día anterior, ver ese handoff).

**Bug real encontrado y corregido durante esta validación — permiso faltante de `service_role`:**

- Al consultar `players` con la service role key (para el diagnóstico de datos), Postgres devolvió `permission denied for table players` (SQLSTATE 42501), con el hint `GRANT SELECT ON public.players TO service_role;`.
- Causa: mismo problema de dos capas que Bloque 1 §13 (GRANT y RLS son independientes), esta vez del lado de `service_role` en vez de `anon`/`authenticated`. Con "Automatically expose new tables" desactivado, ningún rol recibe GRANT automático sobre una tabla nueva — la migración de Bloque 2 le había dado `select` a `authenticated`, pero nunca a `service_role`. Los flujos de producto (trigger/`complete_profile`, ambos SECURITY DEFINER, dueños de la tabla) nunca se vieron afectados; solo las consultas directas con la service role key.
- Fix: [`supabase/migrations/20260918120000_bloque2_grant_service_role_access.sql`](../../../../supabase/migrations/20260918120000_bloque2_grant_service_role_access.sql) — GRANT explícito a `service_role` sobre `players`/`profiles`/`locations`/`pilot_events`/`reserved_usernames`, más un `ALTER DEFAULT PRIVILEGES` para que las tablas de bloques futuros ya vengan con ese acceso sin repetir el hallazgo. No toca `anon`/`authenticated` (deny-by-default se mantiene igual). Aplicada por Sebastián en el SQL Editor de Staging (`Success`) y confirmada corriendo el diagnóstico de nuevo.
- Efecto colateral descubierto: como consecuencia del mismo permiso faltante, la limpieza de `supabase/tests/verify-bloque2.mjs` (que también usa `service_role` para borrar sus cuentas de prueba) venía fallando en silencio en sus dos corridas reales anteriores — quedaron 4 filas de prueba (`verify_b2_...`/`vb2_...`/`vb2geo_...`, una de ellas sin ningún dato) en `players`/`profiles`, todas con `auth_user_id=NULL` (sus cuentas de Auth sí se habían borrado bien). Identificadas de forma inequívoca por los nombres/usernames literales del propio script y por no tener ninguna relación con `sebas_lp873@yahoo.com.ar`; **eliminadas** por Sebastián vía SQL directo (`delete from pilot_events/players where player_id in (...)`, los 4 IDs exactos) tras confirmar el origen. Confirmado por diagnóstico posterior: 1 solo `player` en toda la tabla, el real. Ver `docs/BRAMUlab/BRAMUlab_Backlog.md` §2 para la mejora pendiente en `verify-bloque2.mjs` (que su limpieza revise si el borrado tuvo éxito).
- Nuevo script reutilizable: [`supabase/tests/diagnose-bloque2-user.mjs`](../../../../supabase/tests/diagnose-bloque2-user.mjs) — diagnóstico de solo lectura de una cuenta real por email (Auth único, email confirmado, player/profile únicos, sin huérfanos, username sin duplicar, evento de alta único). El email es un parámetro obligatorio, sin default hardcodeado; no imprime ni usa la service role key más que para las requests. Usado repetidas veces contra Staging real durante esta sesión.

**Resultado de la validación (los 10 puntos pedidos):**

| Validación | Estado | Evidencia | Observaciones |
|---|---|---|---|
| Signup real | APROBADO | Cuenta real creada, confirmada por `diagnose-bloque2-user.mjs` | — |
| SMTP personalizado | APROBADO | Gmail SMTP (Staging), emails de alta y recuperación recibidos realmente | — |
| OTP de 6 dígitos | APROBADO | Corregido de 8→6 en Supabase (ver handoff); funcionó en alta y en recuperación | — |
| Confirmación de email | APROBADO | `email_confirmed_at` no nulo, confirmado contra Staging real | — |
| Perfil/onboarding persistido | APROBADO | `username=sebas`, `display_name=Sebas`, `first_name=sebastian`, `last_name=Vila`, `birth_date=1989-07-07`, `gender=masculino`, `dominant_hand=derecha`, `preferred_side=reves`, `competitive_branch=M`, ubicación GeoRef verificada (Bella Vista, Buenos Aires, `verified_for_ranking=true`) | — |
| Logout/login | APROBADO | Prueba manual + mismo `player_id` antes/después, `last_sign_in_at` avanzó | — |
| Segunda sesión limpia | APROBADO | Prueba manual en incógnito + mismo `player_id`/profile completo, confirmado por diagnóstico | Vercel protege el Preview de Staging con su propio login — esperado, no es un bug de la app |
| Recuperación de contraseña | APROBADO | Código real, contraseña nueva funciona, la vieja quedó rechazada (probado explícitamente) + `last_sign_in_at` avanzó, mismo `player_id` | — |
| Username duplicado | APROBADO | Rechazo `username_taken` confirmado 2 veces contra Staging real (`verify-bloque2.mjs`) + mensaje en pantalla verificado por código (`Ese @usuario ya está en uso.`) | No se repitió en vivo en la UI por decisión explícita de Sebastián (evidencia ya suficiente) |
| Ausencia de duplicados/huérfanos | APROBADO | Cuenta real: 1 usuario, 1 player, 1 profile, 1 evento de alta, sin huérfanos; las 4 filas de prueba identificadas y eliminadas (ver arriba) | — |

Con esto, todos los criterios de "Terminado cuando" de `Backend_Infraestructura.md` §15 Bloque 2 quedan cumplidos sobre Staging real. **Bloque 2 queda CERRADO.**

### 7. Commits / push

- `f8a6058` — implementación completa (migración, `auth.js`, wiring de `index.html`/`app.js`/`store.js`/`player-identity.js`/`locations.js`/`sw.js`, `verify-bloque2.mjs`, Informe).
- `2e340a8` — fix de los usernames de prueba de `verify-bloque2.mjs` que superaban 24 caracteres.
- `059a979` — doc: registrar la validación server-side real (16/16 OK) previa a esta ronda.
- `8e3d560` — fix del permiso faltante de `service_role` (migración `20260918120000_...`).
- Commit de esta ronda — cierre documental de Bloque 2, script `diagnose-bloque2-user.mjs`, nota de backlog sobre `verify-bloque2.mjs`.

Pusheados **únicamente a `staging`** (`git push origin main:staging`) — nunca a `main`, y sin tocar Production (que todavía no existe como proyecto Supabase/Vercel).

## Alineación conceptual posterior al Bloque 2 — 17/09/2026

Sin cambiar código de Bloques 1–2 ni su estado de validación, producto cerró la definición del ciclo de partido en `Experiencia_Inicial.md` y se alineó `Backend_Infraestructura.md`.

Reglas que desarrollo debe tomar como vigentes antes de Bloques 4–6:

- validación por pareja, no cuatro aprobaciones;
- acciones: `Confirmar / Proponer corrección / No participé`;
- carga retroactiva máxima: 14 días;
- pendiente nunca validado: 30 días desde la carga original;
- corrección normal post-validación: 3 días desde `validated_at`;
- incidencia de identidad: 10 días desde `validated_at`;
- límite personal de 5 pendientes accionables antes de iniciar una carga nueva;
- revisiones append-only y control de concurrencia por versión;
- un error de identidad no invalida automáticamente un partido real;
- Ranking semanal publicado permanece inmutable y las correcciones impactan hacia adelante.

## Bloque 3 — Nivel productivo y persistente — CERRADO

**Fecha de implementación y cierre:** 19 de septiembre de 2026. **Estado: CERRADO** — migraciones, Edge Function, verificación automática y validación manual real completadas en Supabase/Vercel Staging.
**Alcance de referencia:** `Backend_Infraestructura.md` §15 "Bloque 3". Revisión y autorización de arquitectura: `docs/BRAMUlab/Implementacion/Backend/Bloque_03/03_Revision_ChatGPT.md`. Informe operativo completo de esta ronda: `docs/BRAMUlab/Implementacion/Backend/Bloque_03/04_Informe_Implementacion_Claude.md`.

### 1. Qué se implementó (resumen — detalle completo en el informe operativo de Bloque 3)

**Migración SQL** — `supabase/migrations/20260919120000_bloque3_nivel_persistente.sql`:

- `profiles`: agrega `terms_version`/`terms_accepted_at` (server-side, nunca solo el borrador local).
- `complete_profile`: `competitive_branch` y ubicación dejan de ser obligatorios (perfil mínimo = nombre + apellido + `@usuario` + términos); el resto de la función (formato/reservado/único/`username_locked`) no cambia — sin generalizar a un merge parcial con `COALESCE`.
- `is_username_available`: se agrega `grant ... to anon` (acotada a disponibilidad booleana) para dar feedback antes de que exista sesión.
- `level_states`/`level_events` (nuevas): estado y eventos append-only de Nivel BRAMU. `level_states.status` incluye `PENDIENTE` como valor explícito de columna (no como ausencia de fila, a diferencia del prototipo local histórico).
- `handle_email_confirmed` (trigger de Bloque 2): extendido idempotentemente para crear también `level_states` en `PENDIENTE` apenas existe `player_id` — cubre la confirmación anticipada del email sin oficializar Nivel todavía.
- `officialize_level_onboarding` (RPC nueva, `SECURITY DEFINER`): única vía de escritura de `level_states`/`level_events`. **Otorgada exclusivamente a `service_role`** (nunca `authenticated`/`anon`): el cliente no puede llamarla directo ni inyectar un `mu`/`confidence` arbitrario. Idempotente por estado (`PENDIENTE` -> `CALIBRANDO` una sola vez, con `for update` + índice único parcial sobre `level_events` como defensa adicional).

**Motor server-side — Edge Function, no PL/pgSQL** (decisión cerrada en `03_Revision_ChatGPT.md` §2): `supabase/functions/officialize-onboarding/index.ts` verifica el JWT del usuario, corre el estimador a partir de las respuestas CRUDAS del cuestionario (nunca un Nivel ya calculado por el cliente) y llama a `officialize_level_onboarding` con la service role key. El motor que corre ahí es el **mismo archivo** que usa el navegador: `supabase/functions/_shared/level.js` y `level-calibration.js` son **symlinks reales** a `bramulab/level.js`/`bramulab/level-calibration.js` — nunca una copia manual que pueda divergir. Verificado localmente que ambos archivos se cargan y ejecutan sin cambios fuera del navegador (Node, vía `vm`).

**Frontend** (`bramulab/`):

- `auth.js`: `officializeLevel(payload)` (invoca la Edge Function con la sesión activa); `completeProfile` manda `p_terms_version`; `fetchOwnProfile` ahora también trae `level_states` (`levelState`).
- `store.js`: borrador de alta local device-only (`SIGNUP_DRAFT`, `saveSignupDraft`/`loadSignupDraft`/`clearSignupDraft`).
- `app.js`/`index.html`: wizard de alta reordenado (`[1, 2, 'verify']` en vez de `[1, 'verify', 2]` — el email se confirma al final, no al principio); paso 2 ("TU PERFIL") reducido al perfil mínimo con checkbox de términos; el onboarding de Nivel BRAMU (reutilizado sin tocar su lógica) corre contra el borrador antes de tener cuenta confirmada; comando idempotente completo (`runOfficializeAndEnter`) que llama `complete_profile` y luego la Edge Function; `resumeDraftFlow` retoma el paso exacto tras confirmar el email (temprano o al final) o al reabrir la app con un borrador sin terminar; controles de laboratorio ocultos en Production (`window.__BRAMU_ENV__.name`), visibles en Development/Staging; "Resetear Nivel BRAMU" ya no actúa sobre una cuenta `serverBacked`.

### 2. Decisiones de alcance (qué quedó deliberadamente afuera)

- Pantalla "Completá tus datos para el Ranking": no se implementa (`03_Revision_ChatGPT.md` §5) — el modelo ya admite localidad/rama/`ranking_opt_in` incompletos sin bloquear Nivel/Home.
- `match_level_results` y el resto de `event_type` de `level_events` (variación por partido, recalibración, corrección): quedan para los bloques que los necesiten (5/6) — nunca se declaró estructura sin uso todavía.
- Edición de perfil competitivo (rama/ubicación) después del alta: sigue sin UI/contrato propio, igual que en Bloque 2.

### 3. Tests

- Baseline reconfirmado con el runner real (`tests.html` en navegador, no conteo por grep) **antes** de tocar código: **1408/1408**.
- Después de implementar: **1408/1408 sin cambios** (no se tocó ninguna fórmula ni archivo del motor de Nivel).
- Verificación manual en el navegador (camino sin backend, `!Auth.isConfigured()`): alta completa con perfil mínimo (nombre/apellido/@usuario/términos, sin rama/ubicación/avatar), creación de cuenta local, entrada a Home; "Crear usuario de prueba" → onboarding de Nivel BRAMU en modo cuenta existente (rápido, con pregunta de categoría, nota de coherencia real) → confirmación → Home con Nivel real; "Resetear Nivel BRAMU" desde Herramientas. Sin errores nuevos en consola.
- **Verificación final contra Supabase Staging real — 19/09/2026, HEAD funcional `7b24979a`:** `verify-bloque2.mjs` → **BLOQUE 2 OK**; `verify-bloque3.mjs` → **BLOQUE 3 OK**; `verify-nivel-parity.mjs` → **PARIDAD OK**. La corrida final ya valida `nivel_inicial_v1_2` en caminos rápido y completo, idempotencia, un único `initial_estimate`, carrera de `@usuario`, RLS y paridad exacta Node↔Edge Function.

### 4. Configuración y validación manual completadas

1. Migraciones de Bloque 3 aplicadas en Supabase Staging.
2. Edge Function `officialize-onboarding` desplegada y activa con el motor V1.2 compartido.
3. Tres verificadores reales corridos sin modificar sobre HEAD funcional `7b24979a`: **BLOQUE 2 OK**, **BLOQUE 3 OK**, **PARIDAD OK**.
4. Camino rápido V1.2 validado con confirmación anticipada + refresh: terminó en Home sin segundo OTP; backend persistió `CALIBRANDO`, `mu=5.5`, `questionnaire_mode=quick`, un único `initial_estimate`.
5. Camino completo V1.2 validado con 6 preguntas + confirmación final por OTP: terminó en Home; backend persistió `CALIBRANDO`, `mu=5.6675` (5.7 público), `questionnaire_mode=full`, un único `initial_estimate`.

Detalle operativo y evidencia final: `docs/BRAMUlab/Implementacion/Backend/Bloque_03/12_Cierre_Bloque_03.md`.

**Bloque 3 CERRADO.**

Impacto por roadmap:

- Bloque 3: no cambia su alcance conceptual; solo debe preservar consistencia de Nivel ante revisiones oficiales futuras.
- Bloque 4: claim de provisional puede habilitar capacidad de actuar por su pareja en un pendiente vigente.
- Bloque 5: debe preparar revisiones, lado accionable, deadlines y contador de pendientes.
- Bloque 6: implementa el flujo completo de confirmación/corrección/identidad.

Queda un único detalle menor de producto antes de cerrar el subflujo de identidad post-validación: plazo adicional exacto para completar el participante correcto una vez abierta esa incidencia. No bloquea Bloques 2–3.



## Bloque 4 — Jugadores, búsqueda e invitados provisionales — CERRADO

**Fecha de implementación y cierre:** 20 de septiembre de 2026.  
**Estado: CERRADO en Staging.**  
**Alcance de referencia:** `Backend_Infraestructura.md` §15 "Bloque 4".  
**Evidencia final:** `docs/BRAMUlab/Implementacion/Backend/Bloque_04/08_Validacion_Final_Staging.md`.  
**Cierre formal:** `docs/BRAMUlab/Implementacion/Backend/Bloque_04/09_Cierre_Bloque_04.md`.

### 1. Implementación cerrada

Bloque 4 incorpora:

- búsqueda real autenticada de jugadores registrados por `@username`, display name, nombre y apellido;
- Perfil público server-backed por `player_id`, sin exposición de datos privados ni estadísticas todavía inexistentes;
- identidad provisional persistente con UUID;
- creación de provisional siempre nueva, sin deduplicación automática por nombre;
- reutilización explícita por `player_id`;
- listado acotado de provisionales del creador;
- links de claim de alta entropía, almacenamiento server-side solo del hash, vigencia de 30 días, rotación/revocación y consumo de un solo uso;
- claim atómico que conserva el `player_id` provisional y reasigna/preserva eventos de la cuenta recién confirmada;
- rate limiting para búsqueda y claim;
- tablas internas de claims/rate limits sin acceso directo de `anon`/`authenticated`;
- integración de frontend para consumir el claim antes de `complete_profile` y de oficializar Nivel;
- retry seguro ante errores transitorios;
- preservación de intención de claim si `localStorage` no puede persistir.

### 2. Migraciones Staging

Aplicadas al proyecto `bramulab-staging`:

- `20260920162203` — `bloque4_jugadores_busqueda_provisional`;
- `20260920162333` — `bloque4_server_only_table_grants`.

La segunda migración revoca privilegios directos de `anon` y `authenticated` sobre
`provisional_claims` y `api_rate_limits`.

### 3. Verificación automática

Contra Supabase Staging real:

- `verify-bloque2.mjs` → **BLOQUE 2 OK**;
- `verify-bloque3.mjs` → **BLOQUE 3 OK**;
- `verify-bloque4.mjs` → **BLOQUE 4 OK**, limpieza final sin advertencias;
- `verify-claim-token-storage.mjs` → **CLAIM TOKEN STORAGE OK**;
- suite local `tests.html` → **1408/1408**;
- `node --check` de los JS tocados → OK.

### 4. Validación manual real

Sobre Vercel Preview/Staging:

- búsqueda real y Perfil público server-backed → **PASS**;
- fix de username canónico en Home/Mi Perfil/Mis Datos → **PASS**;
- regresión visual server-backed → local/mock sin contaminación de `hidden` → **PASS**;
- claim final sobre assets h11:
  - `@claimb4h11` adoptó el `player_id` provisional
    `44c94e30-268f-4ad1-95d1-081e8b0f0a7d`;
  - claim quedó `claimed`;
  - `provisional_claimed` exactamente una vez;
  - `level_confirmed` exactamente una vez;
  - Home sin segundo OTP;
  - reabrir el link no produjo una segunda fusión;
- alta normal `@normalb4h11` sin `?claim=` → **PASS**, identidad independiente y sin claim asociado.

### 5. Fallo manual intermedio y hotfix

La primera prueba de claim produjo la cuenta separada `@claim_mualea_20` mientras el claim
seguía `pending`. El backend mostró que la RPC de claim nunca había sido invocada.

Causa: el frontend eliminaba `?claim=` aunque la escritura en `localStorage` hubiera fallado.

Corrección:

- fallback volátil en memoria;
- conservar `?claim=` cuando no se pudo persistir;
- no descartar intención si Auth todavía no está configurado;
- limpieza conjunta de storage + fallback;
- cache bump a h11.

La revalidación posterior fue exitosa. `@claim_mualea_20` se conserva en Staging como evidencia
del fallo previo, sin intentar auto-fusionarla.

### 6. Alcance deliberadamente diferido

Bloque 4 no implementa partidos compartidos, historial compartido, validación de partidos ni
"Recientes" derivados de encuentros reales. Eso pertenece a Bloque 5+.

El criterio conceptual "un provisional mantiene el mismo ID en varios partidos" queda preparado
por contrato de identidad (UUID persistente + reutilización explícita + claim conservando ID),
pero su prueba literal multi-partido se realizará al existir partidos reales en Bloque 5.

**Bloque 4 CERRADO.**


## Bloque 5 — Partidos e Historial — CERRADO

**Fecha de implementación y cierre:** 21 de septiembre de 2026.  
**Estado: CERRADO en Staging.**  
**Alcance de referencia:** `Backend_Infraestructura.md` §15 "Bloque 5".  
**Evidencia backend:** `docs/BRAMUlab/Implementacion/Backend/Bloque_05/08_Validacion_Backend_Staging_ChatGPT.md`.  
**QA navegador:** `12_Validacion_Navegador_Work.md` + `15_Revalidacion_Dirigida_Work.md`.  
**Cierre formal:** `docs/BRAMUlab/Implementacion/Backend/Bloque_05/16_Cierre_Bloque_05.md`.

### 1. Implementación cerrada

Bloque 5 incorpora:

- tablas server-backed para partidos, participantes, sets, revisiones, acciones, estado privado e idempotencia;
- carga retroactiva máxima de 14 días;
- `pending_validation` + deadline fijo de 30 días;
- create-or-attach por identidades reales, parejas, fecha/hora y formato, nunca por nombre;
- advisory locks para idempotencia y fingerprint de encuentro;
- convergencia de cargas inequívocas en un único `match_id`;
- ambigüedad explícita sin fusiones silenciosas;
- revisiones append-only;
- provisionales relacionadas reutilizables por el mismo `player_id`;
- límite de 5 pendientes accionables que bloquea solo iniciar un partido nuevo;
- expiración lógica;
- outbox local, `sync_pending` y retry con idempotency key estable;
- historial compartido server-backed;
- ocultamiento individual y nota privada;
- separación de historial visible vs. partidos computables;
- pending/sync_pending/expired fuera de Nivel, stats y métricas oficiales;
- wiring real de Home, Historial, Resumen y selector de jugadores.

La segunda declaración coincidente del lado rival **no oficializa** el partido en Bloque 5:
registra conformidad, mantiene `pending_validation` y puede dejar
`readyForValidation=true`. La oficialización atómica pertenece a Bloque 6.

### 2. Supabase Staging

Migraciones aplicadas:

- `bloque5_matches_core`;
- `bloque5_rpcs_read`;
- `bloque5_create_or_attach_rpc`;
- `bloque5_defer_submission_fk`;
- `bloque5_conformity_guard`;
- `bloque5_feed_metadata`.

Edge Function desplegada y activa:

- `create-or-attach-match` con JWT obligatorio.

El acceso directo de `authenticated` a las tablas de partidos permanece denegado; la lectura
del producto pasa por RPCs acotadas.

### 3. Verificación backend real

Contra Postgres Staging se validó:

- create-or-attach;
- idempotencia secuencial y concurrente;
- concurrencia por fingerprint;
- una sola conformidad por pareja;
- ausencia de efectos de Nivel antes de validar;
- provisionales relacionadas;
- ambigüedad;
- desambiguación temporal;
- límite de pendientes;
- ocultamiento;
- nota privada;
- expiración lógica;
- RLS / RPC-only.

Durante la primera prueba real aparecieron y se corrigieron dos bugs de integridad:

1. FK de revisión→submission necesitaba ser diferible;
2. el segundo integrante de una pareja ya conforme podía duplicar la acción `confirmed`.

### 4. Wiring frontend y suite

Bundle final de Bloque 5:

- `04.10-h15`.

Suite final:

- **1448/1448 OK**;
- 0 fallas;
- 0 errores de consola;
- `node --check` limpio en los JS relevantes.

Se preservó el camino local/legacy y no se migró historial viejo automáticamente.

### 5. QA real de navegador

La primera QA en Vercel Staging confirmó el flujo principal y detectó:

- usuarios reales distintos con mismo display name tratados como duplicados;
- `00:00` mostrado en Historial cuando la hora era desconocida;
- falta de estado pendiente en Último partido;
- copy visible `Eliminar partido` aunque la acción server-backed era ocultar.

Los cuatro puntos fueron corregidos.

Revalidación dirigida final sobre `04.10-h15`:

- homónimos reales por `player_id` → **PASS**;
- hora desconocida sin `00:00` → **PASS**;
- Último partido con `PENDIENTE DE VALIDACIÓN` → **PASS**;
- botón server-backed `OCULTAR PARTIDO` → **PASS**.

No surgieron bugs nuevos.

### 6. Limpieza

Los dos partidos creados exclusivamente por Work para QA fueron eliminados de Staging de forma
controlada después de preservar la evidencia documental.

Resultado final:

- fixtures `QA B5 Work%` restantes: **0**;
- submissions QA asociadas restantes: **0**.

Las identidades QA de Bloques anteriores se conservaron.

### 7. Cobertura deliberadamente no repetida

Work no pudo simular offline de forma fiable y no se forzó una prueba falsa. El outbox,
`sync_pending` y retry quedan cubiertos por implementación + suite local.

Tampoco se repitieron en navegador carreras de idempotencia, RLS, concurrencia, ambigüedad y
límite de 5 porque ya tenían evidencia suficiente en backend real/tests.

**Bloque 5 CERRADO en Staging.**

## Bloque 6 — Validación y actualización oficial — CERRADO EN STAGING

**Inicio:** 21 de septiembre de 2026.  
**Cierre:** 22 de septiembre de 2026.  
**Estado:** **CERRADO en Staging**.  
**HEAD funcional final validado:** `58b765d328fcd927abb599d0a4cb64d7973276df`.  
**Bundle final validado:** `04.10-h19`.  
**Cierre formal:** `docs/BRAMUlab/Implementacion/Backend/Bloque_06/20_Cierre_Bloque_06.md`.

### 1. Alcance cerrado

Bloque 6 deja operativo el paso de partido compartido pendiente a partido oficial, con autoridad server-side y actualización coherente de Nivel/derivados.

Quedó implementado y validado:

- autoridad por pareja para `Confirmar`;
- oficialización atómica e idempotente;
- correcciones pre/post validación bajo las ventanas vigentes;
- reversión y reaplicación exacta preservando efectos posteriores y factores contextuales congelados;
- `No participé` como incidencia de identidad, sin borrar el partido;
- reemplazo por jugador real/provisional o terminal `Jugador no identificado`;
- notificaciones internas y tareas accionables derivadas del estado real;
- suspensión/restauración de derivados personales mientras una identidad está abierta;
- guardas de seguridad para helpers internos y comando administrativo service-role-only;
- refresco inmediato de Home/Historial/Nivel/Resumen después de mutaciones;
- hojas de `Resolver identidad` y `Proponer corrección` visibles e interactuables;
- preservación del copy server-backed `OCULTAR PARTIDO` y ausencia de duplicados.

### 2. Backend real validado

La validación directa en Supabase Staging cubrió C-01…C-10 y corrigió cuatro fallos reales encontrados durante la implementación:

1. EXECUTE público heredado en helpers SECURITY DEFINER;
2. ambigüedad PL/pgSQL de `read_at` en notificaciones;
3. chequeo incorrecto de composite NULL que bloqueaba una corrección aceptada;
4. uso de `max(uuid)` en refresco de fingerprint.

También quedaron validados idempotencia, orientación A/B estable, corrección con contexto congelado, terminal no identificado, notificaciones derivadas, reloj de inactividad y vencimientos lógicos.

Evidencia: `12_Validacion_Backend_Staging_ChatGPT.md`.

### 3. Frontend y hotfixes dirigidos

Fase B conectó Confirmar, correcciones, identidad, Notificaciones y refresh de proyecciones.

La primera QA real de navegador encontró dos incidencias visuales/locales, sin pérdida ni corrupción de datos:

- el Resumen quedaba con snapshot viejo después de aceptar una corrección o resolver identidad;
- dos `.sheet-scrim` de Bloque 6 se abrían con `hidden=false` pero sin `is-open`, por lo que quedaban invisibles.

Se corrigieron de forma acotada:

- refresh canónico del Resumen → bundle h17;
- apertura/cierre de `identity-resolve-scrim` → h18;
- apertura/cierre de `propose-correction-scrim` → h19.

No se modificó backend, reglas de producto, Supabase ni Edge Functions en esos hotfixes visuales.

### 4. QA final de navegador

Revalidación final sobre:

- HEAD `58b765d328fcd927abb599d0a4cb64d7973276df`;
- bundle `04.10-h19`.

Resultado:

- Resolver identidad → **PASS**;
- Proponer corrección → **PASS**;
- regresión mínima → **PASS**;
- operaciones persistidas una sola vez;
- sin segundo partido;
- Notificaciones correcto;
- `OCULTAR PARTIDO` correcto;
- sin incidencias nuevas.

La falta de sesión autenticada para comprobar visualmente un segundo integrante del mismo lado accionable queda como deuda de cobertura manual no bloqueante: la autoridad por pareja y la idempotencia fueron validadas directamente en backend y el camino real de un integrante accionable quedó probado en navegador.

### 5. Limpieza QA al cierre

Se eliminaron de Staging los dos partidos creados exclusivamente para la QA de navegador:

- `e452fec7-1bd3-4d3a-b29c-20f05644bf51`;
- `9ed80346-cc61-4b5c-b01b-fb5390d0b42e`.

El segundo había producido correcciones, incidencias de identidad y efectos temporales de Nivel. Antes de eliminar su trazabilidad se restauraron los jugadores afectados a su último `initial_estimate`.

Verificación posterior:

- matches: **0**;
- participants/submissions/revisions/sets/actions: **0**;
- match_level_results / players: **0**;
- incidencias de identidad: **0**;
- notificaciones ligadas a partidos: **0**;
- level_events ligados a partidos: **0**;
- pilot_events ligados a partidos: **0**;
- los Level states afectados quedaron con `rated_matches=0`, `distinct_opponents=0`, `evidence_units=0` y valores de mu/confidence coincidentes con su estimación inicial.

Las cuentas QA se preservaron.

### 6. Decisión de cierre

Los criterios de terminado de Bloque 6 están cubiertos con evidencia suficiente y sin bloqueos abiertos.

**Backend Bloque 6 queda formalmente CERRADO en Staging.**

Siguiente bloque del roadmap:

**Bloque 7 — Ranking real semanal.**

No se inició Bloque 7 durante este cierre.

### 7. Entornos

- `staging`: tocado y validado;
- `main`: NO tocado;
- Production: NO tocada;
- BRAMUlive: NO modificado por este cierre.

