# 148 — Plan de implementación · BRAMU Metrics V1 (`/admin/metrics`) — 08OCT26

**Estado:** PLAN. Nada de esto está implementado. No autoriza Production. Rama de trabajo: `staging`.
**Leer antes:** `README.md`, `Metodo_Trabajo.md`, `BRAMU_Metrics.md` (producto) y su marco confirmado — `BRAMU_Metrics_UX_V1.md` (paneles + Explorar), `BRAMU_Metrics_Privacidad_V1.md`, `BRAMU_Metrics_Comparaciones_V1.md` — y `BRAMU_Metrics_Auditoria_Tecnica_V1.md` (fuentes, definiciones, consultas, hallazgos).
**No se toca en ninguna fase:** `main`, Vercel Production, Supabase Production (salvo lecturas autorizadas por Central y, **solo tras autorización explícita**, la promoción de la Fase 5), BRAMUlive, fórmula de Nivel, lógica deportiva oficial, datos de usuarios.

---

## 1. Resumen ejecutivo

- **Qué se construye:** un endpoint estrecho de solo lectura, autorizado en servidor para **un único administrador**, que devuelve indicadores agregados calculados por funciones SQL server-only; y una página `/admin/metrics` que los muestra. Sin servicios nuevos, sin base nueva, sin clave privilegiada en el navegador.
- **Lo que ya se puede medir sin tocar nada:** cuentas, altas, invitados, perfil/localidad, partidos (por estado, autores, participantes, tiempo de validación, cargados vs. jugados), embudo de activación hasta el 5.º partido, grupos, estados de Nivel, Ranking, invitaciones. 16 consultas borrador validadas (Auditoría, Apéndice A).
- **Lo único que hay que instrumentar:** **presencia diaria** (DAU/WAU/MAU, retención, retorno, uso desde app instalada, adopción de versión). Es una tabla de una fila por jugador y día. **Cada día sin ese registro es dato que no se puede recuperar**, por eso se propone adelantarlo (Fase 1) al dashboard.
- **Decisión de arquitectura:** *Edge Function `admin-metrics` + funciones SQL `metrics_*` ejecutables solo por `service_role` + tabla `metrics_admins` con la lista de autorizados.* Es la única opción compatible con las invariantes de seguridad ya vigentes del repo (§3.3).
- **Marco ya confirmado por Central/Sebastián e incorporado:** dos modos (paneles preparados + Explorar gradual sobre un catálogo de métricas auditadas, sin SQL libre), agregados sin fichas individuales, comparación automática con período anterior, estética oscura deportiva.
- **Decisiones de producto pendientes de Sebastián:** 5 (D1–D4 y D7, §8). Ninguna bloquea las Fases 2–3.

## 2. Alcance de V1 y alcance explícitamente fuera

| Dentro de V1 | Fuera de V1 (diferido o descartado) |
|---|---|
| Secciones: Inicio, Usuarios, Partidos, Activación, Comunidad (Grupos/Nivel/Ranking/Invitaciones), Uso | Análisis por jugador individual / drill-down (V1 = agregados; si se pide luego: justificar, limitar y auditar) |
| Filtros 7d/30d/90d/histórico + comparación con período anterior (por defecto, desactivable) | Rango personalizado en la UI (el endpoint lo reserva; la UI llega en fase posterior, según Central) |
| Vista de detalle de cada KPI + **Explorar** incremental sobre un catálogo cerrado de métricas | SQL libre o constructor de consultas arbitrarias; registros individuales; rankings de uso por persona |
| Rótulo de entorno y de disponibilidad en cada KPI | Pantallas más vistas, abandono de flujos, clics (diferido, §4.4) |
| Presencia diaria como único registro nuevo | Instalaciones PWA «reales» (no verificables), atribución de adquisición por inferencia |
| Acceso para un administrador (su cuenta habitual) | Panel multiusuario, roles, edición de datos desde el panel; errores/latencia de cliente (sin fuente fiable) |
| Exclusión configurable de cuentas internas/de prueba | Alertas, notificaciones, exportaciones, caché persistente |

## 3. Arquitectura mínima

### 3.1 Componentes

```
Navegador (Sebastián, sesión BRAMU ya iniciada)
  └─ https://app.bramulab.com/admin/metrics/   (página estática, SIN datos; mismo origen que la app)
        │  Authorization: Bearer <JWT de la sesión>  ── POST {section | metric, range, compare, includeInternal}
        ▼
Supabase Edge Function  admin-metrics   (verify_jwt = true)
  1. auth.getUser(jwt)                                    → identidad real (nunca del body)
  2. service client: select … from metrics_admins
        where auth_user_id = <uuid> and revoked_at is null  → si no: 403 genérico idéntico
  3. section → función por MAPA FIJO; metric → entrada del CATÁLOGO cerrado (nunca concatenar nombres)
  4. rpc('metrics_<section>' | 'metrics_series', {p_from, p_to, p_asof, p_include_internal, …}) con service_role
  5. responde {meta, kpis…} con Cache-Control: no-store
        ▼
Postgres:  public.metrics_*()   SECURITY DEFINER, search_path=public,
           revoke all … from public, anon, authenticated;  grant execute … to service_role;
           (patrón idéntico a ops_health_snapshot)
```

Central (ChatGPT) consulta **las mismas funciones** `select public.metrics_matches(…)` con su conector de solo lectura: una sola definición para el dashboard y para el análisis, sin sesión de navegador.

### 3.2 Por qué esta arquitectura y no las otras

| Alternativa | Decisión | Motivo |
|---|---|---|
| **RPC SQL llamada por el navegador** (`authenticated` + chequeo interno de admin) | Descartada | Rompe la invariante de `audit-live-grants.sql` (consulta 2: cero `SECURITY DEFINER` ejecutables por `authenticated` con prefijo `admin_`/`_`) y deja los agregados a un solo `if` de autorización de distancia de cualquier usuario logueado: un único error en ese chequeo expone todo. |
| **API route de Vercel** (`bramulab/api/`) | Descartada | Exigiría `SUPABASE_SERVICE_ROLE_KEY` como variable de Vercel; hoy **no existe** ahí (`api/health.js` documenta que nunca la lee). Sumar un secreto privilegiado a la plataforma de hosting amplía la superficie sin necesidad. |
| **Edge Function + SQL server-only** | **Elegida** | Reutiliza el patrón vigente (funciones de usuario con `verify_jwt=true` + `getUser`, escritura/lectura privilegiada con `service_role` dentro de Supabase), no agrega secretos, y los agregados nunca son alcanzables por PostgREST desde un cliente. |
| Servicio externo de analítica / base nueva | Descartada | Va contra `BRAMU_Metrics.md` §2 y suma tratamiento de datos de terceros. |

### 3.3 Invariantes del repo que el diseño debe respetar (y los archivos que hay que tocar por ello)

- `supabase/scripts/release-check.mjs`: `EXPECTED_VERIFY_JWT` debe incluir `'admin-metrics': true`, y la aserción «las 10 funciones orientadas a usuario» pasa a **11**. Sin este cambio el release-check falla (correcto: obliga a declarar la función nueva).
- `Runbook_Operacion_y_Salida.md`: lista de Edge Functions a desplegar (paso 8) y tabla de operaciones: agregar `admin-metrics` y el alta/baja de administrador de métricas.
- `supabase/tests/audit-live-grants.sql`: sin cambios; las `metrics_*` son server-only. `record_app_activity` (presencia) es ejecutable por `authenticated` **a propósito** y no empieza con `admin_`/`_`.
- `bramulab/scripts/build-dist.mjs`: la página nueva debe entrar en la allowlist (`DIST_DIRS` + verificación de referencias) y los tests de `h2-hardening-exposicion.test.mjs` se ajustan.
- `bramulab/sw.js`: ver §5.3.

## 4. Piezas de datos

### 4.1 Identidad del administrador — `metrics_admins`

```sql
-- DISEÑO (no implementado)
create table public.metrics_admins (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  label        text not null,                 -- p. ej. 'Sebastián (Production)'
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
alter table public.metrics_admins enable row level security;     -- cero políticas
revoke all on table public.metrics_admins from public, anon, authenticated;
grant select on table public.metrics_admins to service_role;
```

- **La identidad es el UUID de `auth.users`**, inmutable. Nunca el @usuario, el email (modificable) ni `user_metadata` (editable por el propio usuario).
- **No se siembra en la migración** (el UUID difiere entre Staging y Production y no debe vivir en el repo): Central inserta la fila a mano en cada proyecto, igual que la fila de `app_config`. Para ubicar la cuenta se usa una búsqueda puntual por email/@usuario **una sola vez**; el chequeo en runtime usa solo el UUID.
- Eliminar la cuenta del admin borra la fila (cascade). Revocar = `revoked_at`. No hay UI para administrar administradores (V1: una fila).
- Recomendación (no bloqueante, D6): activar MFA/TOTP de Supabase en la cuenta admin y, más adelante, exigir `aal2` en el Edge. La app hoy no usa MFA.

### 4.2 Presencia diaria — `player_activity_days` + `record_app_activity()`

```sql
-- DISEÑO (no implementado)
create table public.player_activity_days (
  player_id     uuid not null references public.players (player_id),
  activity_date date not null,                          -- día BA, lo calcula el servidor
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  opens         smallint not null default 1,
  display_mode  text not null check (display_mode in ('standalone','browser')),
  platform      text not null check (platform in ('ios','android','desktop','other')),
  app_bundle    text check (app_bundle ~ '^[0-9]{2}\.[0-9]{2}-h[0-9]{1,3}$'),
  primary key (player_id, activity_date)
);
alter table public.player_activity_days enable row level security;   -- cero políticas
revoke all on table public.player_activity_days from public, anon, authenticated;
grant select on table public.player_activity_days to service_role;

-- RPC: security definer, search_path=public, execute SOLO authenticated (revoke public/anon).
--  · jugador = el de auth.uid() (type='registered', deleted_at is null); nunca un parámetro.
--  · fecha = (now() at time zone 'America/Argentina/Buenos_Aires')::date; el cliente no manda fecha/hora.
--  · upsert por (player_id, activity_date): si ya existe, actualiza last_seen_at/opens SOLO si
--    last_seen_at < now() - interval '5 minutes' (evita amplificación de escritura).
--  · valida enums y formato de bundle; ante valor inválido, rechaza sin escribir.
--  · retorno mínimo {ok:true}; el cliente ignora fallas (best-effort, nunca bloquea UI).
```

- **Disparo en el cliente (≈15 líneas en `auth.js` + 2 llamadas en `app.js`):** (a) al terminar `resumeServerSession` con sesión real; (b) en `refreshServerStateOnForeground` **después** de confirmar sesión viva (es el camino de «el usuario volvió a la app»). Throttle local de 30 min (`localStorage`, con try/catch). **No** se dispara desde el refresco de token, `version.json`, ni timers.
- `display_mode` sale de `matchMedia('(display-mode: standalone)')` / `navigator.standalone`; `platform` es una clasificación gruesa de 4 valores (no se guarda el user-agent); `app_bundle` es el `BUNDLE_VERSION` ya público. Son las únicas dimensiones: no hay IP, geolocalización, ni pantalla.
- **Por qué tabla dedicada y no `pilot_events.daily_active`:** `pilot_events` no tiene unicidad por día (habría que agregar índice parcial sobre JSON), mezclaría un volumen alto con una tabla de auditoría de eventos de cuenta, y `daily_active` nunca tuvo emisor ni semántica definida. Queda reservado sin usar.
- **Tareas colaterales obligatorias de la Fase 1:** incluir la tabla en `admin_export_player_data` (+ test de redacción de terceros), decidir su tratamiento al eliminar cuenta (D3; por defecto se conserva pseudonimizada) y dejar constancia en la Política (D3). Índice: la PK cubre DAU por día y retención por jugador; sumar `(activity_date)` solo si hiciera falta.
- Volumen: ≤ 1 fila/jugador/día ⇒ 10 mil usuarios activos diarios serían ~3,6 M filas/año; sin problema para Postgres. Retención de datos: sin purga en V1.

### 4.3 Cuentas internas / de prueba — exclusión con interruptor

Production tiene pocas cuentas (la foto del 08/10 era de 6) y es probable que varias sean del propio equipo o de prueba: sin exclusión, las primeras semanas medirían al propio equipo.

```sql
-- DISEÑO (no implementado)
create table public.metrics_internal_players (
  player_id uuid primary key references public.players (player_id),
  reason    text not null,                 -- 'owner' | 'test' | …
  created_at timestamptz not null default now()
);
-- RLS on, cero políticas, grant select solo a service_role. Alta/baja manual por Central.
```

Cada función `metrics_*` recibe `p_include_internal boolean default false` y filtra jugadores con `not exists (select 1 from metrics_internal_players …)`. `meta.internalExcluded` informa cuántas cuentas hay excluidas. **No se reutiliza `players.ranking_excluded`** (es integridad de Ranking). Hasta definir la lista (D2) la tabla queda vacía y el rótulo lo explicita.

### 4.4 Eventos diferidos (con condición de reapertura)

| Candidato | Pregunta que respondería | Se retoma si… |
|---|---|---|
| `screen_day` (jugador, día, pantalla, contador) | ¿Qué partes de la app se usan? | tras 4–8 semanas de presencia, Sebastián necesita decidir qué mejorar/retirar y la presencia + hechos no alcanzan |
| `match_load_started` / abandono | ¿Dónde se abandona la carga? | `match_submissions` + tasa de pendientes no explican la fricción observada |
| Error/latencia de cliente | ¿Hay fallas silenciosas? | exista una fuente con política de datos (hoy: logs de Vercel/Supabase, fuera del dashboard) |
| `signup_started` | Fuga previa a confirmación | no se retoma sin endpoint anónimo con rate limit y justificación |

## 5. Contrato del endpoint y de la página

### 5.1 Request / response

```jsonc
// POST /functions/v1/admin-metrics        (dos modos, mismo endpoint y misma autorización)
// 1) Panel preparado
{ "section": "overview | users | matches | activation | community | usage",
  "range": "7d | 30d | 90d | all",           // "custom" reservado: la UI llega en fase posterior
  "compare": true,                           // por defecto true; el usuario puede apagarlo
  "includeInternal": false }
// 2) Detalle de un KPI / Explorar (catálogo cerrado; el id viene de la respuesta del panel)
{ "metric": "matches.created", "range": "30d", "compare": true,
  "granularity": "day | week_ba", "filters": { "branch": "M" } }   // filtros SOLO los que el catálogo declare para esa métrica
```
```jsonc
{ "ok": true,
  "meta": { "environment": "staging|production", "generatedAt": "…", "asOf": "…",
            "tz": "America/Argentina/Buenos_Aires",
            "window": ["…","…"], "previousWindow": ["…","…"],
            "presenceSince": "…|null", "internalExcluded": 0, "minCell": 5 },
  "kpis": [ /* objetos del contrato de la Auditoría §4 (kind, previous, delta, availability) */ ],
  "series": { /* actual y previousWindow alineadas para superponer: por día o por semana BA */ } }
```

- **Catálogo de métricas:** lista cerrada y versionada en SQL (`metrics_catalog()`): id, etiqueta, `kind`, definición, denominador, dimensiones/filtros admitidos y granularidades. El Explorar solo puede elegir ids del catálogo y filtros declarados para ese id; al cambiar de métrica el cliente resetea los filtros incompatibles explícitamente. Una métrica entra al catálogo **solo** cuando tiene consulta validada (Auditoría, Apéndice A) y test.
- Errores: `401` sin/inválido JWT (gateway), `403 {ok:false,code:'forbidden'}` **idéntico** para no-admin, admin revocado y cuenta inexistente (sin oráculo de existencia), `400` body inválido (id de métrica o filtro fuera del catálogo incluido), `429` rate limit (60/min; reutilizar `consume_rate_limit` con el `player_id` del admin **si** `service_role` puede ejecutarlo —hoy es un helper interno, verificar en F2— o un contador acotado propio).
- Respuestas ≤ ~50 KB; sin UUIDs, emails, @usuarios ni nombres (test de regresión).
- CORS: se restringe al origen del entorno (las funciones existentes usan `*`; aquí el costo de restringir es nulo).

### 5.2 Página `/admin/metrics`

- Archivos nuevos: `bramulab/admin/metrics/index.html` + `metrics.js` + `metrics.css`, **independientes de `app.js`** (no carga las 16 mil líneas ni la lógica de la app). Usa `env.generated.js` (mismo proyecto Supabase que la app del entorno) y el mismo `supabase-js` fijado con SRI. Crea el cliente con las mismas opciones que `auth.js` ⇒ **comparte la sesión** guardada del origen; supabase-js coordina el refresco entre pestañas.
- **Sin sesión:** muestra un enlace a la app para iniciar sesión (no se duplica un formulario de login ni se maneja contraseña acá).
- **Rótulo de entorno** desde `meta.environment`; si difiere de `__BRAMU_ENV__.name` la página se niega a renderizar. Banner permanente **STAGING — datos de prueba** en Staging.
- **Modo QA:** `?qa=1` carga datos de fixture rotulados «DATOS DE PRUEBA — NO PRODUCTION»; ignorado y con test en builds de Production.
- Gráficos: SVG en línea sin librerías (consistente con el gauge/charts actuales); estética **oscura deportiva, sobria y analítica** bajo `Identidad_Visual.md` (los colores del wireframe conceptual no son tokens oficiales), responsive móvil y escritorio. Home = resumen ejecutivo (KPI ancla + series de usuarios y partidos + embudo + estado de recolección, con comparación superpuesta e identificada); el resto por secciones. **Cada KPI/gráfico abre su vista de detalle** (serie, definición, denominador) con la misma definición del catálogo. Estados: cargando, sin registros, no instrumentada, no disponible, error. **Tokens, layout definitivo y formatos de gráfico se diseñan y aprueban con Sebastián antes de construir la Fase 3.**
- Sin PWA propia: marcador o acceso directo.

### 5.3 Ruta, Service Worker y buscadores

- Vercel sirve `dist/admin/metrics/index.html` en `/admin/metrics/` **sin rewrite**; el slash final redirige solo. No requiere cambiar `vercel.json` salvo los headers de abajo.
- `sw.js` intercepta toda navegación de su scope: se agrega un `return` temprano para `pathname.startsWith('/admin/')` (red directa, nunca caché) y se evita así servir una copia vieja o caer a `index.html` sin aviso.
- `<meta name="robots" content="noindex,nofollow">` + `X-Robots-Tag: noindex` y `Cache-Control: no-store` por `headers` de `vercel.json` para `/admin/(.*)`; robots de Production con `Disallow: /admin/` (hoy `Allow: /` solo; cambio en `build-env.mjs`). Ruta oculta **no** es control de acceso: el control es el Edge.

### 5.4 Umbral de privacidad (propuesta que cierra el pendiente de `BRAMU_Metrics_Privacidad_V1.md`)

- **k = 5 personas distintas** por segmento y por celda de filtro cruzado (constante `metrics_min_cell()`), aplicado **dentro de las funciones SQL** —no en la UI— para que el panel, el Explorar y Central vean exactamente lo mismo.
- Segmentos < 5 → «Otros (n<5)»; si el residuo sigue < 5 se oculta también (evita la resta contra el total). Totales sin segmentar nunca se suprimen. Razones y percentiles requieren n ≥ 5; distribución de Nivel público n ≥ 10 calibrados.
- Con la base actual casi todo desglose por localidad quedará agrupado: es lo esperado y se muestra como tal.
- Sin buscador de personas, sin listados de actividad, sin rankings individuales. Cualquier drill-down individual futuro exige nueva decisión y revisión de privacidad.

## 6. Seguridad y gates

### 6.1 Tests automáticos (Claude)

1. **SQL de métricas** (Fase 2): test `node:test` que replica el Apéndice B de la Auditoría sobre PGlite (replay completo) y afirma cada número; corre con los 3 ACL (`strict/observed/open`) y comprueba que ninguna `metrics_*` es ejecutable por `anon`/`authenticated`.
2. **No fuga y umbral:** regex sobre todas las respuestas del fixture (sin UUID, email, `@`, nombres); desgloses y filtros cruzados con segmentos < 5 (y con residuo < 5) nunca devuelven el valor; `metric`/filtro fuera del catálogo se rechaza sin llegar a SQL.
3. **Edge:** pruebas unitarias del handler con clientes simulados: sin Authorization, JWT inválido, usuario no admin, admin revocado, admin válido, section desconocida (no llega al RPC), custom range inválido.
4. **release-check** en PASS con la función nueva declarada; **build-dist** con la página en la allowlist; `h2-hardening-exposicion` actualizado.
5. **Cliente:** el helper de presencia nunca se dispara en el refresco de token ni por timers; throttle; falla silenciosa; no se llama sin sesión.

### 6.2 Gates externos (Central — fronteras previstas desde ya)

Ordenados según `Metodo_Trabajo.md` (una sola revisión completa por fase, no relevos parciales):

1. Aplicar migraciones en **Supabase Staging**, desplegar `admin-metrics` (`verify_jwt=true`), insertar la fila de `metrics_admins` de Staging.
2. **Negativos con cuentas reales en Staging:** sin token; token vencido/inválido; **otra cuenta normal** → `403`; cuenta admin revocada → `403`; RPC `metrics_*` y `record_app_activity` de otro jugador por PostgREST directo (permission denied / no escribe ajeno); `select` sobre `metrics_admins`, `player_activity_days`, `pilot_events` como autenticado común → 0 filas o denegado; `audit-live-grants.sql` limpio.
3. **Concordancia:** para al menos 3 ventanas (incluyendo bordes de medianoche BA y la semana en curso), cada KPI del dashboard = resultado de la misma función `metrics_*` ejecutada por el conector de solo lectura = SQL manual independiente.
4. **Entorno:** el dashboard servido por el origen de Staging no llama al Supabase de Production y viceversa; ningún `service_role` en `dist/`.
5. **QA visual** de Sebastián solo sobre la pantalla (lo único no automatizable).

## 7. Fases

Presupuesto de deploys (`Metodo_Trabajo.md`): **1 push funcional por fase**; las fases 1 y 3 son invisibles al usuario ⇒ solo suben `hN` (bundle `04.37-h28…`), `APP_VERSION` no cambia.

| Fase | Contenido | Toca `bramulab/` (deploy) | Ejecuta | Gate de salida |
|---|---|---|---|---|
| **F0** | Este plan + Auditoría técnica | No | Claude (hecho) | Revisión de Central |
| **F1 — Presencia** | Migración `player_activity_days` + `record_app_activity`; helper en `auth.js` + 2 disparos en `app.js`; export de datos; test cliente + SQL; bump `hN` | Sí (mínimo) | Claude → Central aplica en Staging | Presencia escribe 1 fila/día en Staging con cuenta real; negativos del punto 6.2.2 aplicables a esta tabla; **decisión D1** para promoción temprana |
| **F2 — Núcleo seguro** | Migración `metrics_admins` + `metrics_internal_players` + funciones `metrics_*` (overview, users, matches, activation-acciones) + Edge `admin-metrics` + `release-check`/Runbook; tests 6.1.1–6.1.4 | No (solo `supabase/` y `docs/`) | Claude → Central despliega y corre gates 6.2.1–6.2.3 | Negativos PASS + concordancia de las secciones disponibles |
| **F3 — Dashboard v1** | Página `/admin/metrics` con Inicio, Usuarios y Partidos, comparación superpuesta, **vista de detalle por KPI** (`metric` + `metrics_catalog`/`metrics_series`); SW bypass, headers, allowlist; modo QA | Sí | Claude (tras aprobar diseño con Sebastián) | Gate 6.2.4 + QA visual de Sebastián |
| **F4 — Secciones restantes** | Activación (con presencia: retorno, retención W1/W4 y D1/D7/D30), Comunidad (Grupos con regla de puntos, Nivel público, Ranking, Invitaciones, duplicados) y Uso (presencia, standalone, versiones, estado de recolección) | Sí | Claude | Concordancia de las secciones nuevas; las de retención se marcan «inmaduro» hasta tener cohortes |
| **F6 — Explorar v1** (post-F4, incremental) | Pantalla Explorar: métrica del catálogo + rango + comparación, serie/barras, definición y denominador; filtros por localidad, estado de partido, rama y estado de Nivel **solo** donde el catálogo los declare y con umbral k=5; sin SQL libre | Sí | Claude | Mismos gates; revisión de privacidad de cada filtro nuevo |
| **F5 — Cierre y salida** | Gate integral (seguridad + regresión de la app), documentación en `README`/`Runbook`, checklist de promoción | No | Central | **Autorización explícita de Sebastián** para tocar Production (migraciones aditivas, función, fila de admin, promoción del bundle, smoke de riesgo) |

Orden de numeración vs. de ejecución: F5 (cierre/salida) es el gate de Production y puede ejecutarse sobre el alcance ya construido; F6 no bloquea la salida de V1 y se construye después, sobre métricas ya confiables.

Orden recomendado para minimizar dato perdido: **F1 antes que F3** (F2 y F1 pueden ir en paralelo; ambos tocan archivos distintos). La retención útil necesita semanas de presencia: por eso F4 puede construirse antes de que haya cohortes maduras y mostrarlas como «Todavía no medible, desde dd/mm».

### Qué queda listo para implementar hoy (sin esperar decisiones)

- **F1:** diseño y reglas completos (§4.2). Solo D1 condiciona *cuándo* promoverlo a Production, no su construcción en Staging.
- **F2:** funciones, contrato, Edge y tests completos (§3–§6, Auditoría Apéndices A/B). El mecanismo de exclusión (§4.3) se construye vacío.
- **F3:** técnicamente listo; **espera el wireframe aprobado por Sebastián**.

## 8. Decisiones abiertas (marcadas, ninguna bloquea F1–F2)

| ID | Decisión | Recomendación | Quién |
|---|---|---|---|
| **D1** | Autorizar una promoción **temprana** a Production solo del registro de presencia (migración aditiva + hook de cliente, invisible), sin esperar al dashboard | Sí: empieza el reloj de DAU/retención y es de bajo riesgo. Si no, DAU/retención arrancan recién con el dashboard | Sebastián (autoriza), Central (ejecuta) |
| **D2** | Qué cuentas de Production son internas/de prueba (para excluirlas por defecto) | Excluir las del propio equipo y de prueba, con interruptor «incluir» visible; basta con confirmar los @usuario | Sebastián |
| **D3** | Texto de la Política de privacidad para «día de actividad» y tratamiento al eliminar cuenta | Una frase en §2 «Datos técnicos»; conservar pseudonimizado (como `pilot_events`) y excluir eliminados de poblaciones «actuales». Es texto legal ligado a la inscripción AAIP | Sebastián + Central |
| **D4** | Confirmar a qué cuenta de cada entorno se le da acceso (UUID) | La cuenta habitual de Sebastián en Production y la de Staging; Central las ubica una vez | Sebastián (confirma cuáles) |
| **D7** | Confirmar el umbral técnico **k = 5** y la regla de agrupar/ocultar segmentos chicos (§5.4), que es el punto que `BRAMU_Metrics_Privacidad_V1.md` dejó pendiente | Aprobar k=5 (estándar razonable para agregados con ≥ 5 personas; ajustable en una constante) | Sebastián + Central |
| D5 (defecto razonable) | Retención: lectura principal **semanal W1/W4**, D1/D7/D30 secundaria | Aplicar salvo objeción: el pádel es de uso semanal | Central/Sebastián |
| D6 (opcional) | MFA para la cuenta admin | Evaluarlo antes de Production | Sebastián |

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cifras falsas por NULL de `annulment_reason`, vencido derivado, 1 cuenta por partido, provisionales recuperados | Reglas ya fijadas y probadas en la Auditoría; el test de F2 las afirma una por una |
| Dashboard y Central divergen | Una sola definición: funciones `metrics_*` compartidas; gate de concordancia 6.2.3 |
| Confundir Staging con Production | Rótulo `meta.environment`, verificación contra `__BRAMU_ENV__`, modo QA bloqueado en Production |
| Presencia inflada por refrescos automáticos | Disparo solo en inicio con sesión y vuelta a primer plano; throttle doble; tests de no-disparo |
| Presencia declarada por el propio cliente (falsificable por el propio usuario) | Es análisis de producto, no control de acceso; la fecha la fija el servidor y solo afecta su propia fila |
| Agregado identifica a alguien con muestras diminutas | Umbral k=5 aplicado en SQL (§5.4), `insufficient_sample` (n<5; Nivel público n<10), sin listados ni buscador |
| Regresión de la app (se toca `auth.js`/`app.js`/`sw.js`) | Cambios mínimos; `app.js` no tiene cobertura unitaria por diseño ⇒ prueba dirigida en navegador real + suites existentes; bump técnico `hN` |
| Cuota de Vercel | 1 push por fase, F2/F5 sin tocar `bramulab/` |
| Costo de consultas al crecer | Hoy trivial; revisar índices (`matches(created_at)`, `match_participants(player_id)` ya existe) si `matches` > ~50 k filas |

## 10. Cierre de esta ronda (F0)

Tras el último pull se incorporaron los documentos de decisión de Central/Sebastián (UX, Privacidad, Comparaciones); ninguno contradice la arquitectura. Entregado: `BRAMU_Metrics_Auditoria_Tecnica_V1.md` (hallazgos, mapa de fuentes, matriz de medibilidad, contrato de KPIs, eventos, 16 consultas validadas y fixture esperado) y este plan. Verificación ejecutada: replay limpio de 84 migraciones + 16 consultas sobre fixture sintético en PGlite local. **No verificado:** estado vivo de Staging/Production, grants reales, comportamiento del Edge, volumen real, nada visual.
