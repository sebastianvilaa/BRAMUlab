# 149 — Resultado · BRAMU Metrics V1 · F1 (presencia) + F2 (núcleo protegido) + F3 (dashboard) — 08OCT26

> Documento de trabajo ÚNICO de Metrics V1 (se actualiza por ronda, no se crea uno nuevo): §1–§5 = F1/F2; §6 = F3; §7 = cierre de F3 (verificación del 08/10/2026); **§8 = F4 (implementación del 08/10/2026); §9 = verificación de F4 por Central; **§10 = F6 Explorar (implementación del 08/10/2026)**.

**Estado (actualizado 08/10/2026):** implementado en el repo y probado localmente (PGlite = Postgres real + Node). F1/F2 **aplicados en Supabase Staging** y `admin-metrics` **desplegada** por Central; F3 (`04.37-h29`) desplegada en Staging. Estado del cierre de F3: §7. (Los §1–§5 describen lo entregado en la ronda original; sus «pendientes de Central» ya se ejecutaron salvo lo que §7 deja abierto.) Solo Staging; Production y BRAMUlive intactos; sin cambios en lógica deportiva ni en el panel visual (F3+).
**Plan y contratos:** `148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md` · `BRAMU_Metrics_Auditoria_Tecnica_V1.md` · UX/Privacidad/Comparaciones V1.
**Bundle:** `04.37-h28` (`APP_VERSION` sin cambio: ronda invisible).

## 1. Qué se implementó

### F1 — Presencia diaria
| Pieza | Archivo | Qué hace |
|---|---|---|
| Migración | `supabase/migrations/20261008100000_metrics_f1_player_activity.sql` | Tabla `player_activity_days` (1 fila por jugador y día BA; RLS sin políticas; sin grants de cliente), RPC `register_app_presence(modo, plataforma, bundle)` y `admin_export_player_data` ampliado con `activityDays`. |
| RPC | idem | Jugador **siempre** de `auth.uid()`, día fijado por el servidor (BA); valida enums/formato (si no cumple, no escribe); idempotente por día; no re-escribe dentro de 5 min; `standalone` es pegajoso en el día; solo cuentas registradas no eliminadas; `authenticated` sí, `anon` no. |
| Cliente | `bramulab/auth.js` (`recordActivity`), `bramulab/app.js` (2 llamadas) | Se dispara **solo** al reanudar sesión real y al volver a primer plano con sesión viva. Throttle 30 min por dispositivo (persistido). Pestaña oculta/sin backend: no hace nada. Nunca lanza ni bloquea UI. Solo viajan modo, plataforma gruesa y bundle público. |
| Bundle | `index.html`, `sw.js`, `store.js`, `version.json` | `04.37-h27` → `04.37-h28` (cuarteto sincronizado) + tests de versión al día. |

### F2 — Núcleo protegido
| Pieza | Archivo | Qué hace |
|---|---|---|
| Migración | `supabase/migrations/20261008110000_metrics_f2_core.sql` | `metrics_admins` (UUID de `auth.users`, revocable), `metrics_internal_players` (exclusión de cuentas internas con interruptor), `metrics_is_admin`, catálogo cerrado de 49 KPIs, ventanas BA, umbral k=5 (`_metrics_apply_k`), comparación (`_metrics_kpi`), series, y las 6 secciones `metrics_overview/users/matches/activation/community/usage` → `{meta, kpis, series, breakdowns}`. |
| Permisos | idem | **Todo** `revoke … from public, anon, authenticated` + `grant execute … to service_role` (patrón `ops_health_snapshot`). Ningún helper concedido. Central usa las MISMAS funciones desde su conector. |
| Edge Function | `supabase/functions/admin-metrics/index.ts` + `_shared/admin-metrics-core.mjs` | `verify_jwt=true` + `auth.getUser`; luego `metrics_is_admin`; luego rate limit (`edge_admin_metrics` 60/min); luego validación del body; sección → función SQL por **mapa fijo**; 403 idéntico para no-admin/revocado/inexistente; `Cache-Control: no-store`; sin PII en logs; `custom` reservado. |
| Release/Runbook | `supabase/scripts/release-check.mjs`, `Runbook_Operacion_y_Salida.md` | `admin-metrics: true` en `EXPECTED_VERIFY_JWT`; aserción «11 funciones de usuario»; fila de operación con alta/baja de administrador y de cuentas internas. |
| Verify Staging | `supabase/tests/verify-metrics-v1-f1-f2.sql` | Solo lectura (8 consultas con resultado esperado). Ejecutada en PGlite: corre completa. |

Decisiones técnicas tomadas (compatibles con el plan):
- **Nombre `register_app_presence`** (no `record_*`): los controles de grants del repo (`prebloque9-hardening`, `bloque9a-release`, `verify-clean-room`, `audit-live-grants.sql`) tratan toda `record_*` ejecutable por `authenticated` como administrativa. Se renombró en lugar de relajar tres controles.
- **FK `on delete cascade`** en la presencia: `players` se anonimiza (no se borra), así que la presencia se conserva pseudonimizada (D3 por defecto); el cascade es solo red de seguridad.
- **Cuenta interna** = jugador (métricas por persona) o autor del partido (métricas de partidos). Documentado en la migración.
- **Sin muestra suficiente no se expone el numerador**: con `insufficient_sample`/`immature`/`not_instrumented` tanto `value` como `count` salen `null` (`n` es el total de la población). Consecuencia: con la base actual casi todo porcentaje saldrá «muestra insuficiente» (correcto con k=5).
- **Hallazgo adicional durante F2:** `count` (numerador) en un KPI con muestra insuficiente reintroducía justo lo que k=5 oculta; corregido y testeado.

## 2. Pruebas ejecutadas (resultado real)

| Suite | Resultado |
|---|---|
| `supabase/functions/_shared/metrics-f1-activity.test.mjs` (12) | **12/12** — privilegios (ACL observed+open), RPC sin parámetros de jugador/fecha, sin sesión, día BA del servidor, idempotencia/anti-ráfaga, standalone pegajoso, entradas inválidas sin escritura, provisional/eliminada rechazadas, aislamiento entre sesiones, roles reales `authenticated`/`anon` denegados, informe de acceso con `activityDays`, eliminación de cuenta. |
| `supabase/functions/_shared/metrics-f2-core.test.mjs` (23) | **23/23** — permisos con ACL strict/observed/open y roles reales; `metrics_is_admin` (revocado/ajeno/nulo/cascade); ventanas BA; catálogo = salida; **k=5 con propiedad aleatoria (200 casos)**; reglas de comparación; fixture del Apéndice B (usuarios, partidos con NULL de anulaciones y vencido derivado, 1 cuenta, activación con cohorte inmadura, comunidad, presencia, retención madura); **concordancia 7/30/90 d contra consultas crudas independientes**; cuentas internas; **no fuga** (sin UUID/emails/nombres/usernames en 6 secciones × 4 rangos × con/sin internas); rol real `service_role`; ninguna función `VOLATILE`. |
| `supabase/functions/_shared/admin-metrics-core.test.mjs` (9) | **9/9** — orden JWT→admin→rate limit→validación, 403 idéntico, body cerrado (`__proto__`, SQL, claves extra, `custom`), 500 genérico, estática de `index.ts`, contrato contra el SQL real (6 funciones × 4 rangos). |
| `bramulab/metrics-f1-presencia-h28.test.mjs` (9) | **9/9** — `auth.js#recordActivity` real en `vm` (payload mínimo, throttle persistido, oculto/sin backend, best-effort con storage bloqueado) + garantías estáticas de dónde se dispara y dónde no. |
| `supabase/functions/_shared/*.test.mjs` completo | **141/141** (antes 97). |
| `bramulab/*.test.mjs` + `scripts` + `api` | 984 tests: **953 pass / 31 fail — las 31 son idénticas a la línea base** (tests de versión/legal de rondas previas, hardcode del host de Staging en `app.js`, placeholders legales de Production). **Cero fallos nuevos**; +9 pass. |
| `release-check.mjs` | Mismos 3 chequeos fallidos que antes (hardcode `vercel-host` preexistente + 2 de build Production con placeholders legales); **PASS** en Edge Functions (`admin-metrics` verify_jwt=true), «11 funciones de usuario», replay ×3 ACL, grants. |

## 3. Acciones pendientes de Central (frontera externa — en este orden)

1. **Aplicar en Supabase Staging**, en orden: `20261008100000_metrics_f1_player_activity.sql` y luego `20261008110000_metrics_f2_core.sql`. (Aditivas; no tocan datos existentes.)
2. **Correr** `supabase/tests/verify-metrics-v1-f1-f2.sql` (solo lectura) y `supabase/tests/audit-live-grants.sql`: esperado según los comentarios de cada consulta (en particular consulta 2 = 0 filas; consultas 1, 3 y 4 de grants sin hallazgos nuevos).
3. **Desplegar** `admin-metrics` con `verify_jwt=true`. No hay secretos nuevos (usa `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` del entorno de Functions).
4. **Alta del administrador de Staging** (a mano, UUID — **DECISIÓN D4 abierta: confirmar qué cuenta**): `insert into public.metrics_admins (auth_user_id, label) select id, 'Sebastián (Staging)' from auth.users where id = '<uuid>';`. Ubicar la cuenta una sola vez; el runtime usa solo el UUID.
5. **Negativos reales contra la función desplegada** (cuentas reales de Staging; no requieren dar secretos al agente):
   - sin `Authorization` → 401; token inválido/vencido → 401;
   - **cuenta común (no admin) → 403 `forbidden`** y, con cuerpo inválido, el mismo 403 (no se puede sondear);
   - admin con `revoked_at` → 403;
   - admin → 200 por cada sección y rango (`7d/30d/90d/all`) y body con `custom`/claves extra → 400;
   - PostgREST directo como usuario común: `rpc('metrics_users')`, `rpc('metrics_is_admin')`, `select` sobre `metrics_admins`/`player_activity_days`/`pilot_events` → denegado o 0 filas; `rpc('register_app_presence')` **sí** funciona y solo escribe la fila propia.
6. **Presencia en Staging:** abrir la app Staging (bundle h28) con una cuenta real y verificar **1 fila** en `player_activity_days` para hoy BA; recargar/volver a primer plano → no suma otra fila (throttle/5 min). Confirmar en la consulta 8 del verify que no hay duplicados.
7. **Concordancia:** comparar `select public.metrics_overview('30d')` (conector de solo lectura) contra SQL manual sobre las mismas ventanas (consulta 7 del verify cubre cuentas y partidos).
8. **Deploy del frontend h28 a Staging** (un solo push ya incluye `bramulab/`): Vercel Staging construye `04.37-h28`. Si la migración F1 aún no está aplicada, la llamada falla en silencio (best-effort) sin efecto visible.

## 4. Decisiones abiertas (ninguna bloqueó F1/F2)

| ID | Estado |
|---|---|
| **D1** Promoción temprana SOLO de la presencia a Production (migración aditiva + h28) | **ABIERTA — Sebastián.** Esta ronda no toca Production. Recomendado: sí, para empezar el reloj de DAU/retención. |
| **D2** Qué cuentas de Production son internas/de prueba | **ABIERTA — Sebastián.** El mecanismo existe y está vacío; el rótulo `internalExcluded` lo informa. |
| **D3** Texto de la Política de privacidad para «día de actividad» + tratamiento al eliminar cuenta | **ABIERTA — Sebastián/Central.** No se tocó `privacidad/index.html` (texto legal/AAIP). Por defecto: conservar pseudonimizado y excluir eliminados de poblaciones «actuales». **Conviene resolverla antes de D1/Production.** |
| **D4** Cuenta que recibe acceso en cada entorno | **ABIERTA — Sebastián** (Central la inserta). |
| **D7** Umbral k=5 | **Implementado como propuesta** (constante `metrics_min_cell()`); pendiente de confirmación. |
| D5 (retención semanal como lectura principal) / D6 (MFA admin) | D5 aplicado por defecto (W1/W4 + D1/D7/D30 secundarias); D6 sigue opcional. |

## 5. Qué NO se verificó
- Estado vivo de Staging (migraciones, grants reales, versión de la función, filas) y comportamiento del Edge desplegado (Deno): solo su núcleo en Node y su estática.
- Rendimiento con volumen real (sin índices extra: la PK y `player_activity_days_date_idx` cubren F1; revisar si `matches` supera ~50 k filas).
- Que `visibilitychange`/standalone se comporten igual en iPhone/Android reales (la clasificación está probada con user-agents sintéticos).
- Nada del panel visual (F3+). `Ranking` (elegibilidad/cobertura), duplicados/recuperaciones y Nivel público siguen para F4 (el desglose de estados de Nivel ya sale con k).

---

## 6. F3 — Dashboard visual `/admin/metrics` (Staging, bundle `04.37-h29`)

**Estado:** implementado y probado localmente; **sin publicar en Production**. F1/F2 ya aplicados por Central en Staging (confirmado); `admin-metrics` desplegada; cuenta `@seba_qa` autorizada.

### 6.1 Qué se agregó
| Pieza | Archivo | Detalle |
|---|---|---|
| Página privada | `bramulab/admin/metrics/index.html` + `metrics.js` + `metrics.css` | Estática, **sin datos propios**, no es PWA (sin manifest ni SW propio), `noindex`. Reusa `env.generated.js` y el mismo `supabase-js` fijado con el mismo SRI que la app; **comparte la sesión** de la app (mismo origen). Sin sesión → pantalla «Iniciá sesión en BRAMUlab» (no hay formulario de login propio). |
| Vistas | Inicio · Usuarios · Partidos + **detalle de cada KPI** (`#/kpi/<id>`) | Inicio: 6 KPI ancla, 3 gráficos (altas, partidos, activos por presencia), embudo de activación y «estado de la recolección». Usuarios: 6 KPI, altas, desglose por localidad (k=5). Partidos: 12 KPI en 4 grupos, 3 gráficos (cargados / jugados / validados), desglose de estados. Detalle: valor, comparación, estado de disponibilidad, gráfico + tabla de datos, definición/población/muestra. |
| Controles | período 7/30/90 d · Histórico; **«Comparar con período anterior» (activo por defecto, apagable)**; «Incluir cuentas internas» (apagado) | Se guardan solo estas 3 preferencias en `localStorage` (nunca datos). La comparación apagada se pide al servidor (`compare:false`) y desaparece de chips, «Anterior», leyendas y barras. |
| Gráficos | SVG propio (sin librerías) | Barras por día/semana BA con la serie previa superpuesta e identificada (barra azul + leyenda con fechas), tooltips por puntero/táctil, ticks enteros, estado vacío. |
| Estados | carga (skeleton), sin registros, **muestra insuficiente (n y mínimo)**, no medible (+ «desde» cuando existe), cohorte inmadura, captura parcial, error de red/servidor/429, sesión vencida, acceso no autorizado | Cada estado tiene rótulo propio; **nunca** se muestra 0 para algo no instrumentado. Un 403 muestra un mensaje genérico (el servidor no revela por qué). |
| Seguridad | Edge `admin-metrics` (sin cambios) | La autorización es **solo del backend** (UUID en `metrics_admins`); la página no mira @usuario/email/metadatos. Si `meta.environment` ≠ entorno de la página se niega a renderizar. Sin `innerHTML`, sin datos en storage, sin fichas ni búsqueda de personas. |
| Publicación | `build-dist.mjs` (+`admin/` en la allowlist, valida referencias), `sw.js` (bypass `/admin/*`), `vercel.json` (`X-Robots-Tag`, `no-store`, `no-referrer` en `/admin/*`), `build-env.mjs` (robots de Production con `Disallow: /admin/`) | El **fixture de QA** (`qa-fixture.js`, datos inventados) solo se publica en un build de **Staging**; el de Production lo retira. |
| Bundle | `04.37-h29` (APP_VERSION sin cambio: invisible) | Cuarteto sincronizado; tests de versión al día. La app **no** enlaza a la consola. |

Decisión de alcance: la **vista detallada** reutiliza el contrato real de las secciones (definición, población, n, previo, delta y, donde existe, la serie: altas, cargados y validados). Una serie por KPI arbitrario (`metric`/`metrics_series`) y el **Explorar** con filtros quedan para **F6** (requieren backend nuevo: catálogo de series + Edge); no se simuló en el cliente.

### 6.2 Pruebas ejecutadas
| Suite | Resultado |
|---|---|
| `bramulab/metrics-f3-dashboard.test.mjs` | **17/17** — formato/estados/deltas con TODAS las notas del contrato; ventanas en hora BA; geometría de gráficos; ruteo y errores; **catálogo del fixture = catálogo de la migración**; **fixture ↔ `_metrics_kpi` del SQL real** (13 casos en PGlite); estática de seguridad (HTML/JS: SRI idéntico a la app, sin innerHTML/eval/secretos/decisión por nombre, storage solo de preferencias, sin fichas); build (allowlist; fixture solo en Staging); **Service Worker real**: `/admin/*` sin `respondWith` ni caché y la app intacta; headers y robots. |
| Resto de `bramulab/*.test.mjs` | 1001 tests: **970 pass / 31 fail — las 31 son idénticas a la línea base; 0 nuevas** (+26 pass). Un test de rondas previas (ST-4, «bundle Staging idéntico al de Production») se actualizó para admitir que el fixture de QA exista solo en Staging. |
| `supabase/functions/_shared` | 141/141 (sin cambios de backend en F3). |
| `release-check` | Mismos 3 chequeos fallidos de siempre (hardcode del host Staging en `app.js`, 2 de build Production con placeholders legales); sin nuevos. |
| Verificación visual local (Browser pane, `?qa=1`) | Inicio/Usuarios/Partidos/detalle en escritorio y móvil 375 px (sin scroll horizontal); estados `empty`, `sparse`, `nopresence`, `error`, `forbidden`, `nosession`; toggles y rangos. **Camino REAL** probado con un cliente Supabase simulado: pedido `admin-metrics` con `{section,range,compare,includeInternal}`, banner de entorno, 403 → «Acceso no autorizado», 401 → «Tu sesión venció», 500/red → error con reintento, entorno inconsistente → bloqueo. |

### 6.3 QA de Central (instrucciones mínimas)
**Requisito:** el deploy de Staging con bundle `04.37-h29` (este commit). URL: `https://bramulab-git-staging-bramu-lab.vercel.app/admin/metrics/` (también sin la barra final).

1. **Sin sesión** (ventana privada): pantalla «Iniciá sesión en BRAMUlab»; no hace ningún pedido a `admin-metrics`.
2. **Con `@seba_qa`** (inicia sesión en la app y abrir la URL): carga Inicio con banner **STAGING · datos de prueba**. En Network: solo `POST …/functions/v1/admin-metrics` (200) y `supabase-js` del CDN; ninguna llamada a tablas/RPC; respuesta con `meta.environment = "staging"`.
3. **Cuenta común** (otra cuenta real de Staging): «Acceso no autorizado» (403 de la función), sin números en pantalla.
4. **Concordancia** (la verificación de fondo): con el conector de solo lectura, `select public.metrics_overview('30d'), public.metrics_users('30d'), public.metrics_matches('30d');` y comparar contra lo que muestra el panel (mismas ventanas; «Corte de datos» está en Inicio → «Estado de la recolección»). Repetir con 7 d y Histórico y con «Comparar» apagado (el panel no debe mostrar «Anterior»).
5. **Estados reales esperables hoy en Staging:** porcentajes con «Muestra insuficiente» (k=5), desglose de localidad suprimido, presencia «desde dd/mm» si ya hay filas de F1, retención «inmadura».
6. **Headers/indexación:** `curl -sI <url>/admin/metrics/` → `x-robots-tag: noindex…`, `cache-control: no-store`; `<url>/robots.txt` (Staging) = `Disallow: /`.
7. **QA visual sin backend** (opcional, para revisar diseño/estados): `<url>/admin/metrics/?qa=1` (banner rojo **DATOS DE PRUEBA (QA) · NO PRODUCTION**) y `&qastate=empty|sparse|nopresence|error|forbidden|nosession|loading`. Solo existe en Staging; en Production el fixture no se publica y el parámetro se ignora.
8. **App sin regresión:** abrir la app normal (`/`) y navegar un par de pantallas: el SW ignora `/admin/*` y no cambió nada más.

### 6.4 Pendiente / no verificado
- Camino real contra el backend desplegado y con la sesión real de `@seba_qa` (lo cubre el QA de arriba): no tengo credenciales.
- iPhone/Android reales (tooltips táctiles, área segura); revisión visual final de Sebastián (tokens y layout se tomaron de `Identidad_Visual.md`; los colores del wireframe conceptual no se usaron).
- **DECISIÓN ABIERTA (no bloqueó F3):** D1–D4 y D7 de §4 siguen igual; **D3** (texto de privacidad por el «día de actividad») sigue siendo previa a cualquier promoción de la presencia a Production.
- Production: sin tocar. La promoción de la consola exige autorización explícita (F5).


---

## 7. Cierre de F3 — verificación del 08/10/2026 (Claude, sin acceso vivo)

**Veredicto:** el **código de F3 queda cerrado** (cero defectos de seguridad o de coherencia encontrados en la revisión; 3 observaciones de menor riesgo y 1 decisión de semántica, abajo). El **QA vivo queda PARCIAL**: lo que Central ya confirmó está registrado como tal; lo que no tiene evidencia escrita y exige una sesión real figura como **pendiente de ejecución humana**. No se declara aprobada ninguna prueba que no se ejecutó.

### 7.1 Confirmado por Central (dato recibido, no re-ejecutado acá)
Backend F1/F2 instalado en Staging · `admin-metrics` desplegada · `@seba_qa` única administradora autorizada · dashboard `04.37-h29` desplegado · **los seis indicadores de Inicio coinciden con las consultas del motor en Staging** · dirección visual general aprobada por Sebastián.

### 7.2 Ejecutado en esta ronda (resultado real)
| Verificación | Resultado |
|---|---|
| Suites de Metrics: `metrics-f1-activity` 12 + `metrics-f2-core` 23 + `admin-metrics-core` 9 + `metrics-f1-presencia-h28` 9 + `metrics-f3-dashboard` 17 | **70/70** |
| `supabase/functions/_shared/*.test.mjs` (todo el backend compartido) | **141/141** |
| `bramulab/tests/*` + `bramulab/*.test.mjs` | 1001 tests: **970 pass / 31 fail = idéntico a la línea base**. Las 31 son pruebas de rondas viejas (pin de versión `04.37-h2`/`V04.30`…, ST/legal con placeholders de Production, hardcode del host de Staging). **Ninguna toca Metrics.** |
| `node docs/check-docs.mjs` | OK, 0 errores |
| Revisión estática del acceso administrativo (`admin-metrics/index.ts`, `admin-metrics-core.mjs`, migración F2, `metrics.js`, `vercel.json`) | Sin hallazgos de seguridad: orden JWT → administrador → rate limit → validación; la identidad sale solo de `auth.getUser` (cliente ANON) y de `metrics_is_admin` (UUID); 403 idéntico para no-admin/revocado/inexistente; las 27 funciones `metrics_*`/`_metrics_*` revocadas de `public/anon/authenticated`; solo `service_role` ejecuta 7 (`metrics_is_admin` + las 6 secciones), ningún helper; las dos tablas con RLS sin políticas y sin grants de cliente; la página no decide por @usuario/email; entorno de la respuesta ≠ entorno de la página ⇒ no renderiza; sin `innerHTML` con datos. La página y la app comparten sesión (mismo `storageKey` por defecto en `auth.js` y en `metrics.js`). |
| Sondeo HTTP público de Staging (`curl`, sin credenciales) | `/admin/metrics/`, `/robots.txt`, `/version.json` y `/admin/metrics/qa-fixture.js` responden **302 → `vercel.com/sso-api`**: el preview de Staging está detrás de **Vercel Authentication**. Es bueno para el aislamiento, pero impide probar headers/robots/fixture sin una sesión de Vercel. El navegador integrado tampoco tiene sesión de Vercel (no se intentó iniciarla). |

### 7.3 Observaciones de la revisión (ninguna bloquea el cierre de F3)
| # | Observación | Riesgo | Propuesta |
|---|---|---|---|
| O1 | **(RESUELTA en F4 con D8)** **Ventana actual parcial vs. previa completa.** `7d/30d/90d` = N días calendario BA terminando **hoy (parcial, hasta el corte)**; la previa son N días **completos**. Con flujos (altas, cargados, validados) el delta tiende a verse más bajo cuanto más temprano es el día; `usage.dau` mide el «último día de la ventana» (hoy, parcial) contra el último día completo de la previa. El rótulo «hasta hoy» lo insinúa pero no lo explica. | **Medio** (afecta la lectura de comparaciones, no los totales) | **DECISIÓN D8** (abajo). Recomendado: ventana actual = últimos N días **completos** (hasta ayer) o comparar contra la previa recortada a la misma hora; mientras se decide, rotular «incluye hoy (parcial)». Es un cambio de SQL ⇒ va en la migración de F4. |
| O2 | Si la RPC `metrics_is_admin` falla (error de base, no «no es admin»), el Edge responde **403 `forbidden`** y la consola muestra «Acceso no autorizado» a la propia administradora. Falla cerrado (seguro), pero confunde. | Bajo | Responder 503 `metrics_unavailable` ante error de la RPC (no ante `false`); sin oráculo nuevo. Requiere redeploy de `admin-metrics` ⇒ agrupar con la próxima ronda que ya la toque. |
| O3 | CORS de `admin-metrics` es `*` (el plan §5.1 pedía restringir al origen del entorno). Con Bearer y sin cookies no es explotable, y un no-admin recibe 403 sin datos. | Bajo | Restringir al origen del entorno junto con O2. |
| O4 | El limitador de tasa falla abierto si el limitador mismo cae (patrón vigente en todas las funciones; posterior a la autorización). | Muy bajo | Sin acción. |
| O5 | `metrics_overview` calcula 5 secciones × 2 ventanas por pedido. Hoy trivial. | Bajo (a escala) | Revisar al pasar ~50 k partidos o si Inicio supera ~1 s. |

### 7.4 Pendiente de ejecución humana (qué falta exactamente y por qué)
**Falta:** una sesión real (token) de `@seba_qa` y de **una cuenta común** de Staging, la URL/anon key de Supabase Staging (públicas, están en `env.generated.js`) y una sesión de Vercel para ver el preview protegido. **Yo no tengo ninguna** (Staging está tras Vercel Authentication; las credenciales no se comparten con el agente ni se escriben en el repo). Lo que sigue **no tiene evidencia escrita** en la documentación; si Central ya lo hizo, basta registrarlo acá.

| # | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| 1 | `POST …/functions/v1/admin-metrics` **sin** `Authorization` | 401 (gateway) | **EJECUTADA por Claude el 08/10/2026 contra Staging: 401 `UNAUTHORIZED_NO_AUTH_HEADER`** (también GET → 401; OPTIONS → 200) |
| 2 | Con `Authorization: Bearer <anon key>` | 401 `invalid_session` | pendiente |
| 3 | Con token inválido/vencido | 401 | **EJECUTADA (token malformado) el 08/10/2026 contra Staging: 401 `UNAUTHORIZED_INVALID_JWT_FORMAT`**; falta un token válido pero vencido (necesita sesión) |
| 4 | **Cuenta común** → cualquier sección | **403 `forbidden`**; con cuerpo inválido (`{"foo":1}`) el **mismo** 403; en la consola «Acceso no autorizado» sin números | pendiente |
| 5 | Administradora con `revoked_at` (opcional, en Staging con una cuenta de prueba) | 403 idéntico | pendiente |
| 6 | Administradora → 200 en las 6 secciones × `7d/30d/90d/all`; cuerpo con `custom` → 400 `range_not_supported`; clave extra → 400 | según columna | pendiente (Inicio ya visto por Central) |
| 7 | PostgREST directo con token de cuenta común: `rpc/metrics_overview`, `rpc/metrics_is_admin`, `select` sobre `metrics_admins`, `player_activity_days`, `pilot_events` | denegado (42501) o 0 filas | pendiente |
| 8 | `supabase/tests/audit-live-grants.sql` y `verify-metrics-v1-f1-f2.sql` en Staging | consulta 2 = 0 filas; sin hallazgos nuevos | pendiente (Central dice «instalado»; falta el resultado escrito) |
| 9 | **Presencia:** abrir la app de Staging (h28+) con cuenta real → **1** fila en `player_activity_days` del día BA; recargar/volver a primer plano → no suma | 1 fila | pendiente |
| 10 | **Concordancia ampliada:** Usuarios y Partidos (no solo Inicio) × `7d/90d/all` y con «Comparar» apagado (sin «Anterior» en pantalla) | panel = consulta | pendiente |
| 11 | Headers y robots de Staging con sesión de Vercel: `x-robots-tag: noindex…`, `cache-control: no-store`, `robots.txt` = `Disallow: /` | según columna | pendiente |
| 12 | Regresión de la app: abrir `/` y navegar un par de pantallas (el SW ignora `/admin/*`) | sin cambios | pendiente (cubierto en pruebas con SW real; falta un vistazo humano) |
| 13 | iPhone/Android reales: tooltips táctiles, área segura | legible, sin scroll horizontal | pendiente |

Plantilla para 1–7 (variables de Staging; **no pegar tokens en chats ni en el repo**):
```bash
F="$SUPABASE_URL/functions/v1/admin-metrics"; H='Content-Type: application/json'
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$F" -H "apikey: $ANON" -H "$H" -d '{"section":"overview"}'                                   # 1 → 401
curl -s -w ' %{http_code}\n' -X POST "$F" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "$H" -d '{"section":"overview"}'                # 2 → 401 invalid_session
curl -s -w ' %{http_code}\n' -X POST "$F" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_COMUN" -H "$H" -d '{"section":"overview"}'        # 4 → 403 forbidden
curl -s -w ' %{http_code}\n' -X POST "$F" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_COMUN" -H "$H" -d '{"foo":1}'                      # 4 → el MISMO 403
curl -s -w ' %{http_code}\n' -X POST "$F" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_ADMIN" -H "$H" -d '{"section":"users","range":"custom"}'  # 6 → 400 range_not_supported
curl -s -w ' %{http_code}\n' -X POST "$SUPABASE_URL/rest/v1/rpc/metrics_overview" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_COMUN" -H "$H" -d '{}'  # 7 → permission denied
```
**Truco de concordancia exacta (10):** el panel muestra «Corte de datos» (`meta.asOf`). Consultar con ese mismo corte para evitar diferencias por el reloj: `select public.metrics_users('30d', true, false, '<asOf del panel>'::timestamptz);` (y `metrics_matches`, idem 7d/90d/all; con `false` en el 2.º argumento para «Comparar» apagado).

### 7.5 Decisiones y estado
| ID | Estado |
|---|---|
| **D8** (nueva) — Semántica de la ventana actual (O1): ¿«últimos N días completos» o «incluye hoy parcial» con rótulo? | **CONFIRMADA por Sebastián (08/10/2026): días completos, hasta ayer.** Implementada en F4 (§8). |
| D1–D4, D7 | Sin cambios respecto de §4. **D1 + D3 son ahora lo más urgente** (ver `148` §11.5): sin ellos Production no registra presencia y el reloj de DAU/retención no corre. |

**Estado de F3:** código ✔ · pruebas locales ✔ · concordancia de Inicio ✔ (Central) · acceso administrativo ✔ (revisión estática + Central) · **negativos con sesiones reales ⏳ · concordancia Usuarios/Partidos ⏳ · headers/robots ⏳ · iPhone/Android ⏳**. Production: sin tocar.

---

## 8. F4 — Activación · Comunidad · Uso, D8 y «hoy parcial» (08/10/2026, bundle `04.37-h30`)

**Estado:** implementado en el repo y probado localmente (PGlite + Node + navegador con el fixture de QA). **NO aplicada la migración en ningún Supabase, NO desplegado** (lo hace Central). Solo Staging; Production, `main` y BRAMUlive intactos; sin cambios en la app de jugadores ni en lógica deportiva (el bump `h30` toca `store.js`/`sw.js`/`version.json`/`index.html` solo por versión). Alcance definido en `148` §11.

### 8.1 Verificación previa de la reorganización (sin cambios necesarios)
Rutas, imports y pruebas de Metrics siguen funcionando tras mover docs y tests: las suites de Metrics (`bramulab/metrics-*.test.mjs`, que permanecen en la raíz de `bramulab/`) y las de `supabase/functions/_shared` corren sin tocar rutas; `check-docs` OK; ningún enlace de `docs/` a Metrics/Implementación está roto (los 10 enlaces rotos que existen son de `Versiones/` históricas hacia carpetas retiradas, ajenos a Metrics); el código que cita `docs/BRAMUlab/BRAMU_Metrics_*.md` se refiere a los archivos de `Metrics/` (se corrigió la cita en `metrics.js` y la nueva migración cita las rutas vigentes; las migraciones F1/F2 ya aplicadas conservan su texto original porque se versionan por hash). Único ajuste necesario: un test viejo (`v0429-invitados-identidad`) fijaba el bundle con el regex `04.37-h2` (coincidía con `h29` por casualidad) y se relajó a `04.37-h\d+`; ese es el único cambio en pruebas ajenas, más los pines de versión de `icon-staging-h27` y `nivel-onboarding-scroll-h24` (`h29` → `h30`).

### 8.2 Qué se implementó
| Pieza | Archivo | Detalle |
|---|---|---|
| **Migración aditiva** | `supabase/migrations/20261008120000_metrics_f4_d8_comunidad.sql` | Sin tablas nuevas. `create or replace` de `_metrics_window`, `_metrics_meta`, `_metrics_series`, `_metrics_kpi`, `_metrics_catalog`, `_metrics_community_core`, `_metrics_run`, `metrics_overview` (conservan ACL) + 2 helpers nuevos (`_metrics_today`, `_metrics_community_breakdowns`, revocados de clientes). |
| **D8** | idem | Ventana actual = N días **completos** hasta ayer (`to` = 00:00 de hoy BA); previa de igual longitud; `Histórico` también termina ayer. DAU/WAU/MAU miran hasta ayer. Sin cambios en el Edge. |
| **Hoy (parcial)** | idem | Objeto `today` (`date`, `partial:true`, `asOf`, altas, partidos cargados/validados, jugadores activos o `null` + `not_instrumented`) en **todas** las secciones; nunca se compara. `meta.completeDaysOnly` y `meta.today`. |
| **+6 KPIs `community.*`** | idem | `groups_with_match` (usa `_groups_candidate_matches_exact`, fuente única del criterio de Grupos), `groups_avg_members` (n = grupos, mín. 5), `level_calibrated_share`, `ranking_days_since_edition`, `ranking_eligible_players`, `ranking_eligibility_rate`. Catálogo: 49 → **55** KPIs. |
| **Desgloses y series** | idem | `group_size`, `level_band` (**n ≥ 10 calibrados** + k=5 por banda; si no, oculto), `ranking_density` (cuenta **universos**, no personas); series `groups_created` e `invites_created`; `level_status` pasa al helper. |
| **Fix de coherencia (`snapshot`)** | idem | Los ratios que son **foto del estado actual** (`users.profile_complete_rate`, `users.with_location_rate`, `community.level_calibrated_share`, `community.ranking_eligibility_rate`) no se comparan: antes el período previo repetía el mismo estado y la consola mostraba un «Sin cambios» falso. Nuevo campo `snapshot` en cada KPI. |
| **Cliente** | `bramulab/admin/metrics/metrics.js`, `metrics.css`, `qa-fixture.js` | 3 pestañas nuevas. **Activación** (cohorte; embudo del alta al 5.º partido; primeros pasos, primer partido —cargó ≠ participó—, participación, retorno). **Comunidad** con **Grupos · Nivel · Ranking en bloques separados** (color propio) + Invitaciones. **Uso** (DAU/WAU/MAU/promedio, hoy parcial, serie, retención W1/W4/D1/D7/D30, app instalada, plataforma, versión, acciones retroactivas, estado de la recolección). Rótulos D8 en toda la consola («08/09 – 07/10 · días completos, hasta ayer»), franja «HOY · PARCIAL» en Inicio/Usuarios/Partidos/Uso, detalle de KPI para los nuevos (series de grupos, invitaciones y activos diarios). Sin `innerHTML`, sin fichas individuales. |
| **Bundle** | `store.js`, `sw.js`, `version.json`, `index.html` | `04.37-h29` → `04.37-h30` (cuarteto sincronizado; `APP_VERSION` sin cambio, ronda invisible). |
| **Verify de Central** | `supabase/tests/verify-metrics-v1-f1-f2.sql` | Consulta 7 ajustada a D8 y consultas 9–12 nuevas (ventana, Comunidad, concordancia, snapshots). Ejecutada en PGlite: corre completa. |

### 8.3 Pruebas ejecutadas (resultado real)
| Suite | Resultado |
|---|---|
| `metrics-f2-core.test.mjs` (SQL real) | **32/32** (23 de F2 ajustadas a D8 + 9 nuevas): ventana D8 (fin = 00:00 de hoy, igual longitud, estable durante el día); lo de hoy **no** entra en flujos/series/comparaciones y sí en `today`; hoy respeta cuentas internas y presencia no instrumentada = `null`; `snapshot` sin comparación; Grupos (con partido calificable, promedio solo con ≥ 5 grupos, tamaño con k); Nivel (% calibrado, estados con k); Ranking (sin ediciones = «sin registros», con edición: antigüedad, elegibles, tasa sobre cuentas actuales, universos por densidad); banda de Nivel solo con ≥ 10 calibrados y k=5 por banda (también tras excluir internas); permisos de las funciones nuevas con ACL strict/observed/open; catálogo = 55 con +6 `community.*`. La prueba de **no fuga** (6 secciones × 4 rangos × con/sin internas) corre sobre las salidas nuevas. |
| `metrics-f3-dashboard.test.mjs` | **25/25** (17 + 8 nuevas): rutas/pestañas ↔ mapa fijo del Edge, series de detalle nuevas, `snapshot`, estados de Ranking, `todayView`, fixture D8, **claves de `today`/desgloses/series/meta del fixture = las del SQL real**, estática de seguridad de las vistas; catálogo del fixture = catálogo de la migración F4 (55). |
| `metrics-f1-presencia-h28` · `admin-metrics-core` · `metrics-f1-activity` | sin cambios, verdes. |
| `supabase/functions/_shared/*.test.mjs` | **150/150** (antes 141). |
| `bramulab/tests/*` + `bramulab/*.test.mjs` | 1009 tests: **978 pass / 31 fail = idéntico a la línea base** (0 nuevas; +8 pass). |
| `release-check` | Replay limpio de **87 migraciones** ×3 ACL ✔; `admin-metrics verify_jwt=true` ✔; mismos 3 chequeos fallidos de siempre (host de Staging hardcodeado y 2 de build Production con placeholders legales). |
| Navegador (fixture QA `?qa=1`, escritorio y móvil 375 px) | Las 6 pestañas + 2 detalles nuevos sin errores de consola ni scroll horizontal; estados `nopresence` (Uso: «Todavía no medible», hoy «Todavía no medible», retención inmadura) y vista de Comunidad con los tres sistemas diferenciados. |

### 8.4 Qué NO se hizo / límites
- **No se aplicó nada remoto** (ni migración, ni deploy): sin credenciales; tampoco se probó contra el Edge/Supabase vivos.
- Explorador libre **F6** no implementado. Tendencia temporal del Nivel agregado, eventos de pantallas/funciones, errores/latencia y atribución: siguen diferidos (`148` §11.3).
- La distribución por banda usa el `level_band` del **snapshot de la última edición de Ranking** (solo jugadores con edición); no recalcula Nivel.
- Con la base actual casi todo porcentaje/desglose saldrá «muestra insuficiente» (k=5, n≥10): es lo correcto.

### 8.5 Qué debe verificar Central en Staging (en este orden)
1. **Aplicar** `20261008120000_metrics_f4_d8_comunidad.sql` (aditiva; después de F1/F2) y correr `supabase/tests/verify-metrics-v1-f1-f2.sql`: consulta 2 = 0 filas; **9** → las 4 columnas `true`; **10** → `kpis=15`, `breakdown_keys = group_size, level_band, level_status, ranking_density`, `has_uuid=false`; **11** → pares raw = metrics (sin ediciones: elegibles `NULL`); **12** → 4 filas con `snapshot=true`, `previous_is_null=true`; consulta 7 raw = metrics. Más `audit-live-grants.sql` sin hallazgos nuevos.
2. **Deploy** del frontend `04.37-h30` (un push ya incluye `bramulab/`; **no** hay que redeployar `admin-metrics`: el mapa de secciones no cambió).
3. **Con `@seba_qa`**: las 6 pestañas cargan; rótulo «días completos, hasta ayer» y fechas del período (el último día es AYER); franja «HOY · PARCIAL» con hora; en **Uso** «Todavía no medible»/«desde dd/mm» coherente con `presenceSince` de Staging.
4. **Concordancia** con el conector de solo lectura, usando el **mismo corte** (`meta.asOf` como 4.º argumento): `select public.metrics_community('30d', true, false, '<asOf>'::timestamptz)` (y activation/usage), comparando KPIs, `today` y desgloses con lo que muestra cada pestaña; repetir con 7d, 90d, histórico y «Comparar» apagado.
5. **Comunidad**: tres sistemas separados; «Distribución por banda» oculta si hay < 10 calibrados en la última edición; con ediciones de Ranking publicadas, «universos por densidad» cuenta localidades, no personas; los 4 ratios `snapshot` no muestran «Anterior» ni variación.
6. **Pendientes de F3 §7.4** (negativos 401/403, headers/robots con sesión de Vercel, presencia, iPhone/Android): siguen abiertos y no dependen de F4.


---

## 9. Central — aplicación y comprobación de F4 en Supabase Staging (08/10/2026)

**CONFIRMADO / ejecutado por Central** con autorización explícita de Sebastián:

- Aplicada correctamente en **Supabase Staging** (`serxtivkfnptzurnvewg`) la migración aditiva `20261008120000_metrics_f4_d8_comunidad.sql`. **Production, main y BRAMUlive intactos**.
- Consultadas en vivo las seis funciones: `metrics_overview` (6 KPI), `metrics_users` (6), `metrics_matches` (12), `metrics_activation` (10), `metrics_community` (15), `metrics_usage` (12). Todas devolvieron `ok=true`, `meta.environment=staging`, `completeDaysOnly=true` y `today.partial=true`.
- Comprobación independiente con tablas crudas (incluyendo cuentas internas): usuarios registrados **32 = 32**, partidos cargados en 30 días completos **74 = 74**, grupos activos **2 = 2**.
- Seguridad comprobada en base real: **0 funciones de métricas ejecutables por anon/authenticated**, **0 tablas Metrics con SELECT abierto o sin RLS**, **1 admin activo**.
- D8: ventana termina a las 00:00 de hoy BA (incluye hasta ayer), ambas ventanas tienen la misma duración. Los **4** indicadores `snapshot` no presentan comparación anterior. Comunidad: 15 KPIs, los cuatro desgloses esperados y ningún UUID encontrado en su respuesta.
- Verificado previamente por Central: Vercel Staging h30 `dpl_4qQUVBwfdqyGxxNqPG8U7fUGGoTz` en estado READY para commit `a5f8335`. No se reasignaron alias.

**Aún pendiente (no afirmar PASS total):** recorrido de las seis pestañas con sesión real `@seba_qa`, pruebas negativas HTTP 401/403 de Edge con cuentas reales y de headers bajo Vercel Authentication, concordancia visual completa por períodos, QA de móvil y registro efectivo de presencia con sesión. La implementación y comprobación de SQL no equivalen al QA integral del navegador.


---

## 10. F6 — Explorar (08/10/2026, bundle `04.37-h31`)

**Estado:** implementado en el repo y probado localmente (PGlite + Node + navegador con el fixture de QA). **NO aplicada la migración y NO redeployada la Edge** (lo hace Central). Solo Staging; Production, `main` y BRAMUlive intactos; sin cambios en la app de jugadores ni en lógica deportiva (el bump `h31` toca `store.js`/`sw.js`/`version.json`/`index.html` solo por versión). Criterios de producto: `Metrics/BRAMU_Metrics.md` §11. Diseño y alcance: `148` §12.

### 10.1 Qué se construyó
| Pieza | Archivo | Detalle |
|---|---|---|
| **Migración aditiva** | `supabase/migrations/20261008130000_metrics_f6_explorar.sql` | Sin tablas nuevas. 2 funciones públicas (`metrics_explore_catalog`, `metrics_explore`; solo `service_role`) + 5 helpers internos revocados (`_metrics_explore_spec`, `_metrics_match_bucket`, `_metrics_explore_cells`, `_metrics_explore_visible`, `_metrics_explore_series`). Reutiliza `_metrics_run` (el KPI del Explorador es **idéntico** al del panel), `_metrics_window` (D8), `_metrics_kpi` y `_metrics_apply_k`. |
| **Edge `admin-metrics`** | `supabase/functions/_shared/admin-metrics-core.mjs` (+ comentario en `index.ts`) | Nuevos modos del MISMO endpoint y MISMA cadena JWT → administrador → rate limit → validación: `{catalog:true}` y `{metric, range?, compare?, includeInternal?, filter?:{id,value}}`. Validación cerrada (patrones de id, valor ≤ 120 sin caracteres de control, claves extra rechazadas, modos no mezclables). Errores de negocio del SQL (`invalid_metric/_filter/_filter_value`) → 400 con código acotado; todo lo demás 500 genérico. **Requiere REDESPLEGAR `admin-metrics`.** |
| **Pantalla Explorar** | `bramulab/admin/metrics/metrics.js`, `metrics.css` | Pestaña 7.ª. Selector nativo agrupado (Usuarios · Partidos · Activación · Comunidad · Uso) con los 55 indicadores del catálogo; valor, unidad, comparación, disponibilidad, definición/población/muestra; gráfico solo si el servidor mandó serie; filtros contextuales (un `<select>` por filtro, **uno por vez**); la selección vive en la URL (`#/explorar?m=…&f=…&v=…`, apta como marcador); enlace «Explorar este indicador» desde la ficha de cada KPI. Móvil: controles de ancho completo ≥ 46 px, fuente 16 px (sin zoom en iOS), apilado; escritorio: 2 columnas. |
| **Fixture QA** | `bramulab/admin/metrics/qa-fixture.js` | Soporta `catalog` y `metric`; su especificación es copia exacta de `_metrics_explore_spec()`. |
| **Verify de Central** | `supabase/tests/verify-metrics-v1-f1-f2.sql` | Consultas 13–16 nuevas (ver 10.4). |

### 10.2 Qué se puede explorar (todo declarado; nada inventado)
- **Series** (solo donde hay hechos persistidos y la suma de la serie = el KPI): altas, partidos cargados / reales / anulados / validados, grupos creados, invitaciones creadas y canjeadas, ediciones de Ranking y jugadores activos por día (null —«Sin captura»— antes de que existiera la presencia, nunca 0). El resto: «Evolución temporal no disponible» (ratios, medianas, retención, WAU/MAU, saldos).
- **Filtros** (un filtro por vez, sin cruces): **Localidad**, **Estado de Nivel** (sobre `users.registered_now`, `users.signups`, `users.profile_complete`); **Plataforma** (sobre `usage.dau/wau/mau`, por la **última** apertura de cada jugador: partición exacta); **Estado del partido** (sobre `matches.created`, cuenta partidos, con serie).
- **Período y comparación**: los globales (7 / 30 / 90 días / Histórico; comparación activada por defecto), con **D8** (días completos hasta ayer; lo de hoy no entra).

### 10.3 Privacidad (k = 5 EN SQL) y pruebas ejecutadas
- Una opción de filtro solo se **ofrece y devuelve valor** si es visible bajo la misma regla de los desgloses (`_metrics_apply_k`: segmento < 5 → «Otros»; residuo chico se absorbe; si no alcanza, todo oculto). Pedir una opción oculta, inexistente o hostil responde «muestra insuficiente» (sin oráculo y sin cantidad). **Inferencia por sustracción**: con localidades 9 / 6 / 2 / 2 (total 19), San Miguel (6) no se ofrece porque 19 − 9 − 6 = 4 delataría a las dos chicas; test dedicado + propiedad aleatoria (200 casos): toda opción visible ≥ 5 y el complemento visible nunca queda entre 1 y 4. Con filtros de personas **no se grafica serie** (celdas diarias chicas). Las cuentas internas se excluyen también de las celdas; las eliminadas figuran aparte.
- Límite conocido (no se afirma lo contrario): k se aplica **por consulta**; restar entre períodos distintos (p. ej. 7 d vs 30 d) del mismo filtro no está cubierto. El Explorador no ofrece rango personalizado ni cruces, que son los vectores prácticos; queda anotado como riesgo residual.

| Suite | Resultado |
|---|---|
| `metrics-f2-core.test.mjs` (SQL real) | **46/46** (+14 de F6): catálogo cerrado (55) y spec ⊂ catálogo; **KPI del Explorador idéntico al del panel para los 55 indicadores × 7d/90d/all × con/sin comparación**; Σ serie = KPI (actual y previa) para los 9 indicadores aditivos y D8 (la serie termina ayer); `usage.dau` null antes de la presencia; estado del partido (Σ buckets = cargados, valores inválidos rechazados, inyección inerte); localidad (sustracción), Nivel, plataforma (última apertura, partición suma el total, hoy no entra, < 5 oculto), presencia no instrumentada; no fuga (todos los indicadores × filtros × rangos); permisos con ACL strict/observed/open y rol real `anon`/`authenticated`/`service_role`; solo lectura. |
| `admin-metrics-core.test.mjs` | **14/14** (+5): validación cerrada del Explorador, modos no mezclables, no-admin no puede sondear, mapeo 400 acotado, contrato contra el SQL real. |
| `metrics-f3-dashboard.test.mjs` | **34/34** (+9): URL ↔ selección, etiquetas, null ≠ 0 en el gráfico, spec y catálogo del fixture = SQL, **forma de las respuestas del fixture = SQL real** (7 indicadores/filtros), reglas del fixture, estática de seguridad (solo `<select>`, sin SQL ni storage de selección), UX móvil. |
| `supabase/functions/_shared/*.test.mjs` | **169/169** (antes 150). |
| `bramulab/tests/*` + `bramulab/*.test.mjs` | 1018 tests: **987 pass / 31 fail = idéntico a la línea base** (0 nuevas). |
| `release-check` | Replay limpio de **88 migraciones** ×3 ACL ✔; `admin-metrics verify_jwt=true` ✔; mismos 3 chequeos fallidos de siempre. |
| Navegador (fixture `?qa=1`) | Escritorio 1200 px y móvil 375 px: selección de indicador, filtro de localidad / estado de partido / plataforma, quitar filtro, indicador sin serie, indicador inválido en la URL → vuelve al predeterminado; sin errores de consola ni scroll horizontal; selects de 46 × 309 px. |
| **Comprobación viva autónoma** | Ver §7.4 filas 1 y 3: pedidos **sin credenciales** a la Edge de Staging → **401** sin `Authorization` y **401** con token malformado (el gateway aplica `verify_jwt`). |

### 10.4 Qué debe verificar Central en Staging (en este orden)
1. **Aplicar** `20261008130000_metrics_f6_explorar.sql` y **REDESPLEGAR `admin-metrics`** (`verify_jwt=true`; el núcleo cambió). Correr `supabase/tests/verify-metrics-v1-f1-f2.sql`: consultas **13** (2 públicas ejecutables por `service_role`, 0 por anon/authenticated), **14** (catálogo = 55 con series/filtros), **15** (KPI del Explorador = KPI de la sección, para un indicador por sección) y **16** (sin UUID). Más `audit-live-grants.sql`.
2. **Negativos del Explorador con cuentas reales** (como en §7.4, mismo endpoint): cuenta común → 403 idéntico también para `{catalog:true}` y para un cuerpo inválido; `{metric:'nada.x'}` con admin → 400 `invalid_metric`; filtro no declarado → 400 `invalid_filter`; `{metric, filter}` con valor > 120 caracteres → 400.
3. **Con `@seba_qa`** (celular y computadora): pestaña **Explorar**; elegir un indicador de cada sección; cambiar 7 / 30 / 90 / Histórico y apagar «Comparar»; aplicar un filtro (con la base real la mayoría de las opciones dirá «sin segmentos con muestra suficiente»: es lo correcto); el gráfico aparece solo en los indicadores con serie; `usage.dau` muestra «Sin captura» antes de la presencia; el marcador de la URL reabre la misma selección.
4. **Concordancia** con el conector de solo lectura y el **mismo corte**: `select public.metrics_explore('matches.created','30d',true,false,'match_status','validated','<asOf>'::timestamptz)` contra la pantalla; y `metrics_explore('users.signups','30d',…)` contra el KPI de la pestaña Usuarios (deben ser idénticos).
5. Pendientes ya existentes que no dependen de F6 (`§7.4`: negativos con sesión real, headers/robots bajo Vercel Authentication, presencia, iPhone/Android).

### 10.5 DECISIONES ABIERTAS (ninguna bloqueó F6)
| ID | Decisión | Estado |
|---|---|---|
| **D9** | **Rama competitiva** (F/M) como filtro de usuarios: la fuente existe (`profiles.competitive_branch`) pero su semántica para altas históricas y «no declarada» no está validada con producto. Se dejó **fuera de V1**. | ABIERTA — Sebastián/Central |
| **D10** | **Serie móvil de WAU/MAU** y **saldos reconstruidos** (cuentas registradas en el tiempo): derivables pero con supuestos (`is_active` no tiene historia). Hoy dicen «Evolución temporal no disponible». | ABIERTA — se retoma si Sebastián los necesita |
| **D11** | **Cruces de dos filtros** y **rango personalizado**: excluidos a propósito (inferencia por celdas e intersecciones). Cualquier ampliación exige revisión de privacidad y pruebas de sustracción nuevas. | ABIERTA — no recomendada para V1 |
| D3 / D1 | Sin cambios: texto de privacidad de la presencia → promoción de la presencia a Production. Siguen siendo previos a cualquier promoción de la consola. | ABIERTAS |
