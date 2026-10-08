# BRAMU Metrics V1 — auditoría técnica completa (fuentes, definiciones, consultas y eventos)

**Fecha:** 08/10/2026 · **Estado:** AUDITORÍA DE LECTURA Y DEFINICIONES. No hay código funcional, migraciones ni cambios en Production.
**Autoridad de producto:** `BRAMU_Metrics.md` y su marco confirmado por Central/Sebastián: `BRAMU_Metrics_UX_V1.md` (paneles + Explorar), `BRAMU_Metrics_Privacidad_V1.md` (agregados, sin fichas individuales) y `BRAMU_Metrics_Comparaciones_V1.md` (período anterior por defecto). Este documento **completa** `BRAMU_Metrics_Auditoria_V1.md` (que fijó el semáforo inicial) contrastándolo con el repositorio real; la arquitectura y las fases viven en `Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md`.

## 0. Método y límites de esta auditoría

- **Fuente de verdad del esquema:** las 84 migraciones de `supabase/migrations/` reconstruidas desde cero en PGlite local (`supabase/scripts/replay-migrations.mjs`, mismo motor que usa `release-check.mjs`). Eso es el esquema *que el repo crea*, no una lectura en vivo.
- **No se consultó Supabase Staging ni Production** en esta ronda. Lo que dependa del estado vivo (grants reales, filas, versión de cada Edge Function desplegada) queda marcado **«verificar en vivo»**.
- **Las 16 consultas del Apéndice A se ejecutaron en PGlite** contra un fixture sintético (5 cuentas, 2 provisionales, 7 partidos en todos los estados, grupos, claims, presencia ficticia). Cada resultado se contrastó a mano contra lo esperado (tabla del Apéndice B). Siguen siendo **borradores**: la versión definitiva será SQL de migración con su propio test (Fase 2 del plan).
- La foto de Production citada en `BRAMU_Metrics.md` §4 (6 cuentas, 0 partidos…) es una observación histórica; no se usa como fixture ni como valor esperado.

## 1. Hallazgos que corrigen o precisan la auditoría preliminar

Ordenados por impacto sobre las cifras. Los marcados **(!)** habrían producido números falsos si se programaba sin esta auditoría.

1. **(!) `matches.status = 'expired'` nunca se escribe.** El código lo declara explícitamente (`bloque5…`, «Bloque 5 nunca escribe status='expired' físicamente»). Un partido vencido sigue como `pending_validation` con `validation_deadline_at < now()`. **Vencido = estado derivado.** Cualquier conteo por `status` subcuenta vencidos y sobrecuenta pendientes.
2. **(!) Trampa de NULL en las anulaciones.** `annulment_reason ->> 'kind'` vale `'duplicate'` o `'author_retracted'` solo para anulaciones de usuario/sistema; la anulación **administrativa** guarda `{actorLabel, reason}` sin `kind` → `NULL`. El filtro natural `not (status='annulled' and annulment_reason->>'kind' in (...))` evalúa a NULL para esas filas y **las descarta en silencio** (apareció en el ensayo: `matches_real` daba 4 en vez de 5). Regla adoptada: «partido real» = `status <> 'annulled'`; las anulaciones se reportan aparte, siempre con `coalesce(kind,'admin')`.
3. **(!) Partidos con una sola cuenta nunca se validan solos** (V04.31, `Experiencia_Inicial.md` línea «mínimo: 1 cuenta por partido»). La tasa de validación global mezclaría partidos *validables* con partidos *esperando contraparte*. Se separan (consulta M5): ambas parejas con al menos una cuenta registrada = validable.
4. **(!) `players` de tipo `registered` nace al confirmar el email**, no al empezar el alta (`handle_email_confirmed`). El alta no confirmada vive solo en `auth.users` y el cron `cleanup-abandoned-signups` la borra a las 24 h. Consecuencia: **no existe embudo «inició alta → confirmó»**; solo se ve el pendiente de las últimas 24 h (`ops_health_snapshot().unconfirmedSignupsOver24h`). `signup_started` figura en el CHECK de `pilot_events` pero **nunca se emite**.
5. **Los eventos emitidos de verdad en `pilot_events` son 6:** `signup_completed`, `level_confirmed`, `match_created`, `match_validated`, `provisional_claimed`, `account_deleted`. Quedan declarados y **sin emisor**: `signup_started`, `level_started`, `match_rejected`, `calibration_1_5/3_5/5_5`, **`daily_active`**. Ninguno sirve como fuente primaria de partidos o de Nivel (hay tablas de hechos mejores, ver §3). `pilot_events` no tiene unicidad por (jugador, día) ni evento de presencia.
6. **Eliminar cuenta anonimiza, no borra.** `players` queda con `deleted_at`, `is_active=false`, `auth_user_id=null`; `match_participants.player_id` se preserva; `pilot_events` se conserva (se purga solo `properties.authUserId`). Toda cuenta «actual» debe filtrar `deleted_at is null`; los históricos de altas/partidos son **brutos** (incluyen cuentas luego eliminadas) y la UI debe rotularlo.
7. **Provisionales recuperados no son invitados.** Tras un claim, el provisional queda con `recovered_into_player_id` y `is_active=false`; contarlo como invitado duplica personas. Invitados vigentes = `type='provisional' and recovered_into_player_id is null and deleted_at is null`.
8. **`provisional_claims.status = 'expired'` solo se escribe al intentar consumir el link.** Invitaciones vencidas = `status='pending' and expires_at < corte` (derivado, igual que el punto 1).
9. **La presencia no existe en ninguna tabla.** `auth.users.last_sign_in_at` es lo único parecido y la auditoría preliminar ya lo descarta; además la app mantiene la sesión con `autoRefreshToken` y el refresco de *foreground* (`refreshServerStateOnForeground`) dispara sin acción del usuario más allá de abrir/volver a la app. Hace falta un registro propio (§5).
10. **Fecha de juego vs. fecha de carga.** La carga retroactiva admite hasta 14 días: la serie «jugados por semana» de las **últimas 2 semanas siempre está incompleta** y crece después. El dashboard debe anotarlo. `played_at_time_known=false` ⇒ no usar la hora para distribuciones horarias.
11. **`level_states.rated_matches`** no es el total de partidos del jugador (coincide con la advertencia previa), y `mu` es privado del propio jugador (Política de privacidad §2). Para distribuciones de Nivel usar estados de `level_states` (conteos) y **valores públicos redondeados** de `ranking_rows.level_public / level_band`, no `mu`.
12. **«Nivel inicial completado»** se mide mejor con `level_events` (`event_type='initial_estimate'`, único por jugador por índice parcial) que con `pilot_events.level_confirmed` o con `level_states.status` (ambos válidos, pero `level_events` es el hecho auditable con timestamp propio).
13. **`ops_health_snapshot()` ya es el precedente** de agregados server-only (`service_role`, sin datos sensibles) y fija la definición de cuenta activa: `type='registered' and is_active and deleted_at is null`. Su campo `activeByDay` en realidad cuenta **partidos creados** por día (nombre engañoso): no reutilizar ese nombre en Metrics.
14. **Restricciones de seguridad ya vigentes en el repo** que condicionan la arquitectura (detalle en el plan §3):
    - El modelo admin actual es **solo `service_role`** (`admin_annul_match`, `admin-resolve-identity-issue`, `ops_health_snapshot`, `admin_export_player_data`). No existe rol admin de usuario ni lista de administradores.
    - `supabase/tests/audit-live-grants.sql` consulta 2 espera **cero** funciones `SECURITY DEFINER` ejecutables por `authenticated` cuyo nombre empiece por `admin_` o `_` (salvo helpers `_group_photo_*`).
    - `release-check.mjs` fija `EXPECTED_VERIFY_JWT` por función y afirma que hay **exactamente 10** funciones orientadas a usuario con `verify_jwt=true` + `auth.getUser`.
    - `build-dist.mjs` publica solo una allowlist de archivos; `api/` y `scripts/` no llegan a `dist/`. El Service Worker intercepta toda navegación de su scope.
15. **Las 37 tablas de `public` tienen RLS activo** en el replay. `pilot_events`, `players`, `profiles` y las de partidos conservan `GRANT SELECT` a `authenticated` bajo el ACL «observed» del replay, pero sin políticas que habiliten filas ajenas: **verificar en vivo** (`audit-live-grants.sql`) que un autenticado común obtiene 0 filas de `pilot_events`.

## 2. Mapa de fuentes reales (verificado contra el esquema del repo)

| Dominio | Tabla / fuente | Columnas relevantes | Notas de uso |
|---|---|---|---|
| Cuentas | `players` | `type`, `is_active`, `deleted_at`, `created_at`, `auth_user_id`, `recovered_into_player_id`, `ranking_excluded` | `created_at` = confirmación de email. `ranking_excluded` es integridad de Ranking: **no** reutilizar para «cuenta interna». |
| Perfil / ubicación | `profiles` + `locations` | `username` (completo si no es NULL), `location_id`, `province_label`, `locality_label`, `competitive_branch`, `current_category` | Sin `location_id` ⇒ «sin localidad» (≠ otra localidad). |
| Partidos | `matches` | `created_at` (carga), `played_at`, `status` (`pending_validation`·`validated`·`expired`*·`annulled`), `validated_at`, `annulled_at`, `annulment_reason`, `validation_deadline_at`, `format_id`, `winner_team`, `created_by_player_id` | *`expired` no se escribe (hallazgo 1). |
| Participantes | `match_participants` | `match_id`, `team`, `player_id` (NULL = sin identificar), `display_name_snapshot` | `player_id` preservado tras eliminación de cuenta. |
| Intentos de carga | `match_submissions` | `idempotency_key`, `result_code`, `created_at` | Un partido ↔ varios intentos (reintentos/adjuntos). **No** usar para contar partidos. |
| Acciones | `match_actions` | `action_type` (12 valores), `actor_player_id`, `occurred_at`, `metadata` | Acciones admin llevan `metadata.adminActorLabel` y `actor` = autor del partido: excluirlas como actividad de usuario. |
| Nivel | `level_states`, `level_events`, `match_level_results` | `status` (4 estados), `rated_matches`, `event_type` | Ver hallazgos 11–12. |
| Ranking | `ranking_editions`, `ranking_rows` | `published_at`, `is_eligible`, `level_public`, `scope_type`, `density_status`, `eligibility_reason_codes` | Job semanal lunes 00:05 BA (`bramu_weekly_ranking_publish`, cron `5 3 * * 1` UTC). |
| Grupos | `groups`, `group_memberships`, `group_events` | `status`, `left_at`, `event_type` (8 valores), `occurred_at` | Los puntos de grupo se *derivan* de partidos (no hay tabla): ver §6, «Comunidad». |
| Invitaciones | `provisional_claims`, `player_identity_recoveries`, `match_duplicate_candidates` | `status`, `expires_at`, `claimed_at`, `status` de candidatos | Hallazgos 7–8. |
| Legal | `legal_acceptances` | `legal_version`, `accepted_at` | Reaceptación ≠ presencia (solo al cambiar versión). |
| Eventos de producto | `pilot_events` | `event_name` (CHECK de 13), `player_id`, `properties`, `created_at` | Hallazgo 5. |
| Notificaciones | `notifications` | `type`, `read_at` | `read_at` es acción deliberada del usuario (señal de actividad retroactiva). Se borran al eliminar cuenta. |
| Operación | `api_rate_limits`, `app_config` | `environment` | `app_config.environment` identifica el proyecto (usado para el rótulo Staging/Production). |

## 3. Matriz final de medibilidad (reemplaza el semáforo preliminar)

Leyenda: **✅ medible hoy** (hechos persistidos) · **🟡 medible con reglas** (derivación con trampas conocidas, ya resueltas arriba) · **🔴 requiere instrumentar** · **⚪ no medible / no medir**.

| # | Indicador | Estado | Fuente / definición corta | Consulta |
|---|---|---|---|---|
| U1 | Cuentas registradas actuales | ✅ | `players` registered, activa, no eliminada | U1 |
| U2 | Altas por semana (brutas y vigentes) | ✅ | `players.created_at` (= confirmación) | U2 |
| U3 | Invitados vigentes | 🟡 | provisional no recuperado (hallazgo 7) | U3 |
| U4 | Perfil completo, localidad/provincia, faltantes | ✅ | `profiles` + `locations` | U4 |
| U5 | Embudo «inició alta → confirmó» | ⚪ | No persistido; el no confirmado se borra a las 24 h | — |
| U6 | DAU / WAU / MAU | 🔴 | Tabla de presencia nueva (plan §4) | P1 |
| U7 | Retención W1 y D1/D7/D30 | 🔴 | Presencia + cohorte de alta | P2 |
| U8 | «Con acción» retroactivo (proxy) | 🟡 | `match_actions` (acciones de usuario) ∪ `group_events` ∪ `level_events` ∪ `notifications.read_at` | R1 |
| A1 | Embudo de activación (alta → Nivel → 1.er partido cargado / participado / validado → 3.º → 5.º) | 🟡 | `players`, `level_events`, `matches`, `match_participants` | A1 |
| A2 | Retorno en otra semana | 🔴 / 🟡 | Presencia (preciso) o acciones (proxy retroactivo) | P2 / R1 |
| M1 | Partidos creados por bucket de estado | 🟡 | estado actual + vencido derivado + anuladas por tipo | M1 |
| M2 | Tiempo de validación (p50/p90) | ✅ | `validated_at − created_at`, mínimo n=5 | M2 |
| M3 | Autores y participantes únicos | ✅ | partidos no anulados | M3 |
| M4 | Cargados vs. jugados por semana | ✅ | `created_at` / `played_at` (anotar 14 d de carga tardía) | M4 |
| M5 | Pendientes validables vs. esperando contraparte vs. vencidos | 🟡 | cuentas por pareja (hallazgo 3) | M5 |
| G1 | Grupos vigentes/creados, membresías actuales | ✅ | `groups`, `group_memberships` | G1 |
| G2 | Actividad de grupos (partidos entre miembros, eventos) | 🟡 | reutilizar la regla de `Grupos_BRAMU.md`/RPCs de grupos; diseñar en Fase 4 | (Fase 4) |
| L1 | Estados de Nivel (PENDIENTE/CALIBRANDO/CALIBRADO/RECALIBRANDO) | ✅ | `level_states` | L1 |
| L2 | Distribución de Nivel público | 🟡 | `ranking_rows.level_public` por edición; abstenerse con n<10 calibrados | (Fase 4) |
| K1 | Ediciones publicadas, elegibles, motivos de no elegibilidad, cobertura localidad/rama | ✅ | `ranking_editions/rows`; ausencia de edición ≠ 0 simulado | (Fase 4) |
| I1 | Invitaciones: creadas, canjeadas, vencidas, abiertas | 🟡 | `provisional_claims` (vencida derivada) | I1 |
| I2 | Recuperaciones de identidad y duplicados (fricción) | ✅ | `player_identity_recoveries`, `match_duplicate_candidates` por `status` | (Fase 4) |
| X1 | Uso desde app instalada (standalone) | 🔴 | `display_mode` en la presencia. **Es uso, no instalaciones** | P1 (+col.) |
| X2 | Adopción de versión (bundle) entre activos | 🔴 | `app_bundle` en la presencia; mide el problema histórico de PWA desactualizada | P1 (+col.) |
| X3 | Pantallas más vistas / abandono de flujos | ⚪ en V1 | Sin instrumentación; **no recomendado** hasta que una pregunta de producto lo justifique (plan §4.4) | — |
| X4 | Errores y latencia de cliente | ⚪ en V1 | Sin fuente consistente; usar logs de Vercel/Supabase fuera del dashboard | — |
| X5 | Instalaciones PWA reales | ⚪ | No verificable por plataforma; no afirmar | — |
| X6 | Atribución de adquisición | 🟡 parcial | Solo «alta vinculada a invitación» si se puede probar con `provisional_claims`/recoveries; definir en Fase 4, sin inferir por localidad | — |
| Z | Tiempo en cancha, golpes, calorías, estadística técnica | ⚪ | La app no los registra | — |

## 4. Contrato de cada indicador (lo que el dashboard y Central deben mostrar igual)

Cada KPI se devuelve como objeto con estos campos (el mismo contrato para el dashboard y para las consultas de Central):

```json
{
  "id": "matches.validation_p50_hours",
  "label": "Mediana de validación",
  "kind": "duration",
  "definition": "Horas entre carga y validación, partidos validados en la ventana",
  "population": "partidos validados con validated_at en [from,to)",
  "value": 7.5,
  "n": 2,
  "previous": { "value": null, "n": 0 },
  "delta": { "abs": null, "pct": null, "note": "sin_base_previa" },
  "availability": "ok | no_evidence | not_instrumented | insufficient_sample | immature",
  "since": null
}
```

`id` es la **clave del catálogo de métricas auditadas**: el panel preparado, la vista de detalle del KPI y el futuro Explorar usan exactamente la misma definición. `kind` ∈ `stock` (saldo al corte: cuentas actuales, grupos vigentes), `flow` (eventos en la ventana: altas, partidos cargados), `ratio`, `duration`.

Reglas fijas:

- **Zona horaria:** `America/Argentina/Buenos_Aires` (Argentina no usa horario de verano; se usa el nombre IANA igualmente). Semana = **lunes a domingo BA**, igual que Ranking y Grupos.
- **Ventana:** semiabierta `[from, to)`. Rango «últimos N días» = N **días completos** BA terminando a las 00:00 de hoy, es decir **hasta ayer** (decisión D8, `BRAMU_Metrics_Comparaciones_V1.md`; antes terminaba hoy, parcial); la comparación es la ventana inmediatamente anterior de igual longitud, también completa. Lo de hoy viaja aparte (`today`, rotulado parcial). «Histórico» no tiene comparación.
- **Corte:** toda respuesta lleva `generatedAt` y `asOf`; los estados (`status`, vencido derivado, `expires_at`) se evalúan *a esa fecha*. Los estados son del momento, no una foto histórica: las series temporales de transiciones usan `created_at`, `validated_at`, `annulled_at`.
- **Disponibilidad:** `no_evidence` (ventana vacía real, se muestra 0 con rótulo), `not_instrumented` (nunca 0: se muestra «Todavía no medible» + `since`), `insufficient_sample` (razones y percentiles con n < 5, Nivel público con n < 10), `immature` (cohortes que todavía no cumplieron su ventana).
- **Comparación (`BRAMU_Metrics_Comparaciones_V1.md`):** activa por defecto y desactivable; período inmediatamente anterior de igual duración. `delta.abs` siempre que ambos lados existan; `delta.pct` **solo** si la base previa es > 0 y de muestra suficiente (si no, `null` + nota; nunca un porcentaje engañoso). Los **stock** se muestran como saldo actual y se comparan por su flujo asociado (cuentas actuales ↔ altas del período), nunca como si el saldo fuera un flujo. Series incompletas, cohortes inmaduras o no instrumentadas ⇒ «Sin datos suficientes» / «No disponible», sin inventar crecimiento.
- **Brutos vs. vigentes:** altas y partidos históricos son brutos (incluyen cuentas luego eliminadas); poblaciones «actuales» filtran `deleted_at is null`. La UI rotula cuál es cuál.
- **Cuentas internas:** todas las consultas aplican la exclusión de cuentas internas/de prueba (mecanismo del plan §4.3) con un único interruptor «incluir internas». Hasta que Sebastián defina la lista (decisión abierta D2) el conjunto excluido es vacío y el rótulo lo dice.
- **Privacidad (`BRAMU_Metrics_Privacidad_V1.md`):** solo agregados; ningún UUID, email, @usuario ni nombre sale de las funciones de métricas (test de regresión en Fase 2); sin buscador ni listado de actividad identificable. **Umbral técnico propuesto (cierra el pendiente de ese documento): k = 5 personas distintas por segmento.** Cualquier desglose (localidad, estado de Nivel, rama, cohorte…) cuyo segmento tenga menos de 5 personas se agrupa en «Otros (n<5)» o se oculta; si tras agrupar el residuo sigue siendo < 5 se oculta también (para que no se pueda restar del total). Un filtro cruzado de dos o más dimensiones solo devuelve valor si el resultado tiene ≥ 5 personas. Los totales sin segmentar nunca se suprimen. Con la población actual de Production casi todo desglose por localidad caerá en «Otros»: es el comportamiento correcto, no un error. Constante única en SQL (`metrics_min_cell() = 5`). Decisión D7 del plan.

## 5. Eventos y registros necesarios (mínimo viable)

### 5.1 Único registro nuevo recomendado para V1: presencia diaria

Una tabla `player_activity_days` (diseño completo en el plan §4.2): **una fila por jugador y día BA**, escrita solo por una RPC server-side que toma el jugador de `auth.uid()` y la fecha del servidor. Responde DAU/WAU/MAU, retención, retorno y —con dos columnas de baja sensibilidad— uso desde app instalada y adopción de versión.

**Definición de «usuario activo (abrió)»:** sesión autenticada real que abre la app o vuelve a primer plano **al menos una vez en el día BA**, con tope de una escritura cada 30 min por dispositivo y 5 min en servidor. **No** cuentan: refresco de token en segundo plano, `last_sign_in_at`, ni el chequeo de versión (`version.json`).
**«Activo con acción»** (segundo nivel, ya derivable hoy hacia atrás): presencia del día **o** cualquier acción de usuario persistida en esa semana (R1). Mostrar ambos niveles con sus fechas de inicio; el de presencia **no tiene histórico anterior a su puesta en marcha** y el dashboard dice desde cuándo.

### 5.2 Ningún otro evento nuevo en V1

Criterio de `BRAMU_Metrics.md` §5: un evento nuevo solo si responde una pregunta de producto y no duplica un hecho persistido. Hoy no hay una pregunta que justifique más; todo lo demás sale de tablas de hechos. Queda **diferido con condición de reapertura** (plan §4.4): vistas de pantalla y abandono de flujos, si tras 4–8 semanas de presencia Sebastián necesita saber *qué se usa*, no *si se usa*.

### 5.3 Qué no se instrumenta (y por qué)

- **Embudo previo a la confirmación (`signup_started`):** exigiría un endpoint de escritura anónimo, es decir una superficie de abuso nueva, para una cifra de poco valor con el volumen actual.
- **Clics, scroll, sesiones con duración, IP, user-agent completo, geolocalización:** innecesarios, aumentan el dato personal tratado y chocan con «minimización» de la Política.

## 6. Cobertura de la política de privacidad y de eliminación de cuenta

- La Política vigente (`bramulab/privacidad/index.html` §2, «Datos técnicos») declara «contadores anti-abuso y un conjunto mínimo de eventos internos de producto». Un registro de **día de actividad** encaja, pero conviene nombrarlo (decisión D3 del plan; es texto legal/AAIP, lo decide Sebastián/Central).
- **Eliminación de cuenta:** `admin_delete_player_account` no cascada a una tabla nueva porque `players` se anonimiza, no se borra. Decisión por defecto: **conservar** las filas de presencia pseudonimizadas (mismo criterio que `pilot_events`, `match_participants.player_id`) y excluir `deleted_at` de las poblaciones «actuales». Alternativa: borrarlas (mismo criterio que `notifications`/`match_user_state`), con costo de tocar el motor de eliminación y sus postcondiciones testeadas. Decisión D3.
- **Exportación de datos (`admin_export_player_data`):** debe incluir la tabla nueva (derecho de acceso). Tarea explícita de Fase 1, con su test de redacción (`bloque9b`).

## 7. Qué sale distinto de lo que supone la definición de producto

| Pedido de `BRAMU_Metrics.md` | Resultado de la auditoría |
|---|---|
| «Activos: no equiparar con último login» | Confirmado; además `daily_active` existe en el CHECK pero no tiene emisor: no hay nada que reutilizar, se crea un registro dedicado. |
| «Distinguir autor de carga y participante» | Posible: `matches.created_by_player_id` vs `match_participants.player_id`; ambos en A1. |
| «Tiempo de validación» | Medible, pero con la advertencia de partidos de 1 cuenta (nunca validan) y vencidos derivados. |
| «Localidad/provincia declarada y datos faltantes» | Medible (U4); sin geolocalización, solo lo declarado. |
| «Grupos vigentes, actividad en grupos» | Vigentes y membresías: directo. Actividad real exige la regla de puntos de `Grupos_BRAMU.md` (Fase 4). |
| «Eventos de producto, páginas usadas, abandonos solo si se instrumentan» | No se instrumentan en V1 (justificado en 5.2). |
| «Latencia/errores agregados donde existan fuentes fiables» | No existen fuentes fiables dentro de la base; fuera de alcance V1. |
| «Retención D1/D7/D30 requiere definir cohorte, ventana y actividad» | Definida en P2: cohorte = día BA de alta; actividad = día de presencia; cohortes inmaduras fuera del denominador; **W1/W4 como lectura principal** (decisión D5), D1/D7/D30 secundarias. |

---

## Apéndice A — Consultas borrador (validadas en PGlite local, NO ejecutadas en Staging/Production)

Parámetros: `:from` y `:to` (timestamptz, ventana `[from,to)`), `:asof` (corte). En la implementación pasan a ser argumentos de funciones `metrics_*` (`p_from`, `p_to`, `p_asof`). Las exclusiones de cuentas internas (plan §4.3) se agregan a cada CTE de jugadores en la versión definitiva. Las consultas P1–P2 usan la tabla propuesta `player_activity_days`, que **no existe todavía** (se creó solo en el ensayo).

#### U1 — Cuentas registradas actuales (activas, no eliminadas)

```sql
select count(*) as registered_now
  from public.players
 where type = 'registered' and is_active and deleted_at is null;
```

#### U2 — Altas confirmadas por semana BA (brutas: incluye cuentas luego eliminadas)

```sql
select date_trunc('week', created_at at time zone 'America/Argentina/Buenos_Aires')::date as week_ba,
       count(*) as signups_gross,
       count(*) filter (where deleted_at is null) as still_active
  from public.players
 where type = 'registered' and created_at >= :from and created_at < :to
 group by 1 order by 1;
```

#### U3 — Invitados provisionales vigentes (excluye los ya recuperados en una cuenta)

```sql
select count(*) as provisional_open
  from public.players
 where type = 'provisional' and recovered_into_player_id is null and deleted_at is null;
```

#### U4 — Perfil completo y localidad declarada (cuentas actuales)

```sql
select coalesce(l.province_label, '(sin localidad)') as province,
       coalesce(l.locality_label, '(sin localidad)') as locality,
       count(*) as accounts,
       count(*) filter (where pr.username is not null) as profile_complete
  from public.players pl
  join public.profiles pr on pr.player_id = pl.player_id
  left join public.locations l on l.location_id = pr.location_id
 where pl.type = 'registered' and pl.is_active and pl.deleted_at is null
 group by 1, 2 order by 3 desc;
```

#### M1 — Partidos creados en la ventana, por bucket de estado (estado ACTUAL; vencido derivado)

```sql
select case
         when status = 'annulled' then 'annulled_' || coalesce(annulment_reason ->> 'kind', 'admin')
         when status = 'validated' then 'validated'
         when status = 'expired' or (status = 'pending_validation' and validation_deadline_at < :asof) then 'expired_derived'
         else 'pending'
       end as bucket,
       count(*) as matches
  from public.matches
 where created_at >= :from and created_at < :to
 group by 1 order by 1;
```

#### M2 — Tiempo de validación (por fecha de validación) en horas

```sql
select count(*) as n,
       round((percentile_cont(0.5) within group (order by extract(epoch from validated_at - created_at) / 3600))::numeric, 2) as p50_hours,
       round((percentile_cont(0.9) within group (order by extract(epoch from validated_at - created_at) / 3600))::numeric, 2) as p90_hours
  from public.matches
 where status = 'validated' and validated_at >= :from and validated_at < :to;
```

#### M3 — Autores y participantes únicos (partidos no anulados)

```sql
with rm as (
  select * from public.matches
   where status <> 'annulled'
     and created_at >= :from and created_at < :to
)
select (select count(distinct created_by_player_id) from rm) as authors,
       (select count(distinct mp.player_id) from public.match_participants mp join rm using (match_id)
          join public.players p on p.player_id = mp.player_id and p.type = 'registered') as registered_participants,
       (select count(*) from rm) as matches_real;
```

#### M4 — Dos ejes temporales: cargados por semana vs. jugados por semana (BA)

```sql
select coalesce(c.w, p.w) as week_ba, coalesce(c.n, 0) as loaded, coalesce(p.n, 0) as played
  from (select date_trunc('week', created_at at time zone 'America/Argentina/Buenos_Aires')::date w, count(*) n
          from public.matches where created_at >= :from and created_at < :to
           and status <> 'annulled' group by 1) c
  full join (select date_trunc('week', played_at at time zone 'America/Argentina/Buenos_Aires')::date w, count(*) n
          from public.matches where played_at >= :from and played_at < :to
           and status <> 'annulled' group by 1) p on p.w = c.w
 order by 1;
```

#### M5 — Pendientes vigentes: validables hoy vs. esperando contraparte; vencidos derivados aparte

```sql
with rm as (
  select m.match_id, m.status, m.validation_deadline_at from public.matches m
   where m.created_at >= :from and m.created_at < :to and m.status <> 'annulled'
), teams as (
  select mp.match_id, mp.team, count(*) filter (where p.type = 'registered' and p.deleted_at is null) as accounts
    from public.match_participants mp left join public.players p on p.player_id = mp.player_id
   group by 1, 2
), pend as (
  select r.match_id,
         (select count(*) from teams t where t.match_id = r.match_id and t.accounts > 0) as teams_with_account
    from rm r where r.status = 'pending_validation' and r.validation_deadline_at >= :asof
)
select (select count(*) from rm where status = 'validated') as validated,
       (select count(*) from pend where teams_with_account = 2) as pending_validable,
       (select count(*) from pend where teams_with_account < 2) as pending_waiting_counterpart,
       (select count(*) from rm where status = 'expired' or (status = 'pending_validation' and validation_deadline_at < :asof)) as expired_derived;
```

#### A1 — Embudo de activación por cohorte de alta (se excluyen cohortes inmaduras en la capa de aplicación)

```sql
with cohort as (
  select player_id, created_at as signup_at from public.players
   where type = 'registered' and created_at >= :from and created_at < :to
), rm as (
  select * from public.matches
   where status <> 'annulled'
), lvl as (
  select player_id, min(created_at) as at from public.level_events where event_type = 'initial_estimate' group by 1
), authored as (
  select created_by_player_id as player_id, min(created_at) as at from rm group by 1
), part as (
  select mp.player_id, rm.created_at as at, rm.status,
         row_number() over (partition by mp.player_id order by rm.created_at) as n
    from public.match_participants mp join rm using (match_id) where mp.player_id is not null
), part_n as (
  select player_id,
         min(at) filter (where n = 1) as first_at, min(at) filter (where n = 3) as third_at, min(at) filter (where n = 5) as fifth_at,
         min(at) filter (where status = 'validated') as first_validated_at
    from part group by 1
)
select count(*) as signups,
       count(l.at) as level_initial,
       count(a.at) as loaded_first,
       count(p.first_at) as participated_first,
       count(p.first_validated_at) as participated_validated,
       count(p.third_at) as third,
       count(p.fifth_at) as fifth,
       round((percentile_cont(0.5) within group (order by extract(epoch from a.at - c.signup_at) / 86400))::numeric, 2) as median_days_to_first_load
  from cohort c
  left join lvl l using (player_id) left join authored a using (player_id) left join part_n p using (player_id);
```

#### R1 — Señales de acción retroactivas (acción de usuario registrada por semana BA; NO es presencia)

```sql
with act as (
  select actor_player_id as player_id, occurred_at as at from public.match_actions
   where action_type in ('created', 'declared_again_same_side', 'confirmed', 'revision_proposed', 'validated', 'identity_questioned', 'correction_accepted')
     and not (metadata ? 'adminActorLabel')
  union all select actor_player_id, occurred_at from public.group_events
  union all select player_id, created_at from public.level_events where event_type = 'initial_estimate'
  union all select player_id, read_at from public.notifications where read_at is not null
)
select date_trunc('week', at at time zone 'America/Argentina/Buenos_Aires')::date as week_ba,
       count(distinct player_id) as players_with_action
  from act where at >= :from and at < :to group by 1 order by 1;
```

#### G1 — Grupos: vigentes, creados, membresías actuales, tamaño

```sql
select (select count(*) from public.groups where status = 'active') as groups_active,
       (select count(*) from public.groups where created_at >= :from and created_at < :to) as groups_created,
       (select count(*) from public.group_memberships gm join public.groups g using (group_id) join public.players p using (player_id)
         where g.status = 'active' and gm.left_at is null and p.deleted_at is null) as active_memberships;
```

#### L1 — Nivel: estados de calibración de cuentas actuales

```sql
select ls.status, count(*) as players
  from public.level_states ls join public.players p using (player_id)
 where p.type = 'registered' and p.deleted_at is null and p.is_active group by 1 order by 1;
```

#### I1 — Invitaciones (claims): creadas, canjeadas, vencidas derivadas (status 'expired' no se escribe sola)

```sql
select count(*) filter (where created_at >= :from and created_at < :to) as created,
       count(*) filter (where status = 'claimed' and claimed_at >= :from and claimed_at < :to) as claimed,
       count(*) filter (where status = 'pending' and expires_at < :asof) as expired_derived,
       count(*) filter (where status = 'pending' and expires_at >= :asof) as open
  from public.provisional_claims;
```

#### P1 — DAU / WAU / MAU móviles al corte (presencia; tabla propuesta)

```sql
with d as (select (:asof::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date as day)
select (select count(distinct player_id) from public.player_activity_days, d where activity_date = d.day) as dau,
       (select count(distinct player_id) from public.player_activity_days, d where activity_date > d.day - 7 and activity_date <= d.day) as wau,
       (select count(distinct player_id) from public.player_activity_days, d where activity_date > d.day - 30 and activity_date <= d.day) as mau,
       (select min(first_seen_at) from public.player_activity_days) as tracking_started_at;
```

#### P2 — Retención semanal W1 y diaria D1/D7 por cohorte de alta (solo cohortes maduras y alta posterior al inicio del tracking)

```sql
with t as (select min(first_seen_at) as started from public.player_activity_days),
cohort as (
  select pl.player_id, (pl.created_at at time zone 'America/Argentina/Buenos_Aires')::date as signup_day
    from public.players pl, t
   where pl.type = 'registered' and pl.created_at >= greatest(:from::timestamptz, t.started - interval '1 day') and pl.created_at < :to
),
r as (
  select c.player_id, c.signup_day,
         bool_or(a.activity_date = c.signup_day + 1) as d1,
         bool_or(a.activity_date = c.signup_day + 7) as d7,
         bool_or(date_trunc('week', a.activity_date::timestamp) = date_trunc('week', c.signup_day::timestamp) + interval '1 week') as w1
    from cohort c left join public.player_activity_days a on a.player_id = c.player_id group by 1, 2
)
select count(*) filter (where signup_day + 1 <= (:asof::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date - 1) as d1_denominator,
       count(*) filter (where d1 and signup_day + 1 <= (:asof::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date - 1) as d1_returned,
       count(*) filter (where signup_day + 7 <= (:asof::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date - 1) as d7_denominator,
       count(*) filter (where d7 and signup_day + 7 <= (:asof::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date - 1) as d7_returned,
       count(*) filter (where date_trunc('week', signup_day::timestamp) + interval '2 weeks' <= date_trunc('week', (:asof::timestamptz at time zone 'America/Argentina/Buenos_Aires')::timestamp)) as w1_denominator,
       count(*) filter (where w1 and date_trunc('week', signup_day::timestamp) + interval '2 weeks' <= date_trunc('week', (:asof::timestamptz at time zone 'America/Argentina/Buenos_Aires')::timestamp)) as w1_returned
  from r;
```

## Apéndice B — Fixture sintético y resultados esperados (especificación del test de Fase 2)

Ventana `[2026-09-01 00:00 BA, 2026-10-08 00:00 BA)`, corte `2026-10-08 12:00Z`. El fixture se arma sobre el replay limpio de las 84 migraciones (el trigger `handle_email_confirmed` crea `players/profiles/level_states/pilot_events`):

- Cuentas confirmadas: a1 (01/09), a2 (02/09), a3 (10/09), a4 (20/09), a5 (01/10, **luego eliminada**: `deleted_at`, `is_active=false`, `auth_user_id=null`). Una cuenta sin confirmar (no genera `players`).
- Provisionales: P1 vigente; P2 recuperado en a2 (`recovered_into_player_id`).
- Localidades: a1, a2 → Bella Vista; a3 → San Miguel; a4 sin localidad. Nivel inicial (`level_events`) para a1–a3.
- Partidos: m1 validado (a1+a2 vs a3+P1, 12/09, validado en 13 h) · m2 pendiente con una sola cuenta (a1 + 3 sin cuenta, 30/09) · m3 pendiente **vencido** (a2 vs a3, 14/09) · m4 anulado `duplicate` · m5 anulado `author_retracted` · m6 anulado **admin** (sin `kind`) · m7 validado (a1+a3 vs a2+a4, 02/10, validado en 2 h).
- Grupos: uno activo (a1 admin, a2 miembro, a3 con `left_at`), uno eliminado. Claims: uno canjeado, uno pendiente vencido, uno pendiente vigente.
- Presencia ficticia (10 filas) para validar P1/P2.

| Consulta | Resultado esperado y observado |
|---|---|
| U1 | `registered_now = 4` |
| U2 | semanas BA: 31/08 → 2 brutas/2 vigentes · 07/09 → 1/1 · 14/09 → 1/1 · 28/09 → 1/0 |
| U3 | `provisional_open = 1` |
| U4 | Bella Vista 2 (2 completos) · sin localidad 1 · San Miguel 1 |
| M1 | validated 2 · pending 1 · expired_derived 1 · annulled_duplicate 1 · annulled_author_retracted 1 · annulled_admin 1 (suma 7 = partidos creados) |
| M2 | n=2, p50 = 7,50 h, p90 = 11,90 h |
| M3 | authors 2 · registered_participants 4 · matches_real 4 |
| M4 | cargados/jugados por semana: 07/09 1/1 · 14/09 1/1 · 28/09 2/2 |
| M5 | validated 2 · pending_validable 0 · pending_waiting_counterpart 1 · expired_derived 1 |
| A1 | signups 5 · level_initial 3 · loaded_first 2 · participated_first 4 · participated_validated 4 · third 3 · fifth 0 · mediana 11,83 días hasta 1.ª carga |
| R1 | jugadores con acción por semana: 31/08 → 2 · 07/09 → 3 |
| G1 | groups_active 1 · groups_created 2 · active_memberships 2 |
| L1 | PENDIENTE 4 |
| I1 | created 3 · claimed 1 · expired_derived 1 · open 1 |
| P1 | dau 0 · wau 2 · mau 4 · inicio de tracking 01/09 15:00 BA |
| P2 | D1 2/5 · D7 1/4 (a5 inmadura) · W1 2/4 (a5 inmadura) |

**Lo que este ensayo NO demuestra:** performance con volumen real (con <10 k partidos las consultas son triviales; revisar índices si `matches` supera ~50 k filas), comportamiento de RLS/grants vivos, ni coherencia con datos reales de Production. Eso corresponde a los gates de Central descritos en el plan §6.
