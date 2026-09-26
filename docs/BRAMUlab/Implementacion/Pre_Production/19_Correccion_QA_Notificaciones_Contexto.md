# BRAMUlab — Corrección post-QA · Notificaciones históricas + contexto de partido

**Rama:** `staging`
**Fecha:** 27/09/2026
**HEAD base (aprobado por central):** `329307d`
**Origen:** corrección puntual sobre el paquete Ronda UX 25/09 (Rondas 1-3 ya cerradas), a partir de un hallazgo real de QA (Work, cuenta Seba / @seba_qa) sobre Supabase Staging real.

No se reabrieron las Rondas 1-3 completas — esta es una corrección acotada a Notificaciones.

---

## Hallazgo de Work

La bandeja de Notificaciones de Seba mostraba **5 filas `match_validated` idénticas**: título "Partido oficial", body "Tu partido ya quedó validado.", fecha "25-sept" — sin rival, resultado, ni ningún dato que permitiera distinguir una de otra.

## Evidencia real de Staging (auditada por central)

Las 5 filas son históricas, persistidas **antes** de `preprod_ux_notification_actor_enrichment` (Ronda 2): su `payload` quedó `{}` para siempre, porque el trigger `bloque6_enrich_notification_actor` de esa migración solo dispara `BEFORE INSERT` — nunca reescribe filas ya persistidas.

Segundo bug real: de las 5, **2 fueron causadas por el propio Seba** (`match_actions.actor_player_id = Seba` para su `validated`). Sin `payload.actorPlayerId`, `selfCaused` (Ronda 2, §9) no tenía cómo saber que eran un eco de su propia acción — seguían mostrándose como informativas de un tercero.

`player_id` de Seba y los 5 `match_id` de evidencia real quedan documentados en el handoff de esta corrección (no se reproducen acá ni se tocaron — son datos reales de Staging).

---

## Causa

`mapB6Notification` solo podía mostrar actor/filtrar `selfCaused` cuando `payload.actorPlayerId` ya existía (enriquecido por el trigger de Ronda 2, solo en inserts futuros). Además, ninguna notificación ligada a un `matchId` traía contexto del partido (rivales, resultado), aunque `get_notifications` ya conoce esos datos en la misma lectura. Resultado: 5 filas históricas indistinguibles, 2 de ellas además redundantes con la propia acción del usuario.

---

## Solución

Extensión **aditiva** de `get_notifications` — reconstrucción **en lectura**, cero backfill/UPDATE sobre la tabla `notifications`, cero llamadas nuevas del cliente (todo sale de la misma lectura que ya existía).

### Actor histórico

Nueva función `_bloque6_notification_historical_actor(match_id, notification_type)`: mapea el tipo de notificación al `action_type` **real** que la RPC productora registra en `match_actions` (verificado leyendo el código, nunca asumido):

| notification.type | match_actions.action_type |
|---|---|
| `match_validated` | `validated` |
| `correction_accepted` | `correction_accepted` |
| `identity_resolved` | `participant_replaced` |
| `identity_unidentified` | `participant_unidentified` |

Devuelve el actor **solo cuando existe exactamente UNA fila** de `match_actions` con ese `match_id`+`action_type` (usando `count(*) over ()` — 0 filas = sin evidencia, 2+ filas = ambiguo). `match_validated` es inherentemente único por partido (solo se inserta una vez, trigger `initial`); los otros 3 tipos pueden repetirse a lo largo de la vida de un partido (múltiples correcciones/incidencias de identidad) — el mismo criterio de unicidad los cubre a todos sin necesitar un caso especial: con evidencia ambigua, el actor queda ausente, nunca se adivina.

### Contexto de partido

Nueva función `_bloque6_notification_match_context(match_id, caller_player_id)` → `{myTeam, opponentNames, score}`:
- `opponentNames`: `display_name_snapshot` de la pareja rival (nunca resuelve identidad por nombre en vivo).
- `score`: sets de la revisión **vigente** (`matches.current_revision_id`, mismo patrón que `get_match_detail`), orientados al caller — invertidos si su equipo es B (`match_sets.games_a/games_b` están siempre fijos a team=A/B, nunca a "quién mira").
- Sin sets: `score` queda `null`, nunca inventado.

### `get_notifications`

`CREATE OR REPLACE` sobre la misma firma/permisos. Las 4 tareas derivadas (`pending_review`/`correction_proposed`/`identity_questioned`) **y** las persistidas informativas ganan `payload.matchContext` — extendido a las 3 derivadas porque el helper reutilizable lo hacía trivial, sin duplicar consultas grandes (handoff §5). Las persistidas informativas además reconstruyen `actorPlayerId` **solo cuando `payload` todavía no lo trae** — un `LATERAL` calcula ambos helpers una sola vez por fila; el payload ya enriquecido de una fila futura (trigger de Ronda 2) tiene prioridad absoluta, nunca se pisa.

### Frontend (`app.js`)

`mapB6Notification` arma el body con prioridad: **actor real > pareja rival > resultado**, nunca información inventada:

- Con actor + contexto: `"{Actor} confirmó tu partido vs {Rivales} · {Score}."`
- Sin actor, con contexto (histórico sin evidencia inequívoca): `"Tu partido vs {Rivales} · {Score} ya quedó oficial."`
- Sin contexto (fallback, contrato viejo): copy genérico de siempre, sin cambios.

Misma cascada aplicada a `correction_accepted`/`identity_resolved`/`identity_unidentified`, y el sufijo de contexto se suma también a `correction_proposed`/`identity_questioned` (ya tenían actor real desde Ronda 2).

Nueva función **pura** `PH.computeMatchContextSuffix(matchContext)` (`player-home.js`) — construye `" vs Rival1 + Rival2 · 6–3 · 6–4"` desde el `matchContext` ya orientado por el servidor; se extrajo de `app.js` deliberadamente para poder testearla sin Store/DOM/una cuenta server-backed real (app.js no tiene cobertura de tests por diseño). `mapB6Notification` la usa vía `PH.computeMatchContextSuffix`.

`selfCaused` (mecanismo ya cerrado en Ronda 2, sin cambios de código) ahora también funciona sobre filas históricas: en cuanto `get_notifications` reconstruye `actorPlayerId = caller`, la MISMA comparación `actorPlayerId === myPlayerId` que ya filtraba filas futuras filtra también las históricas — sin tocar una línea de esa lógica.

---

## Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `bramulab/app.js` | `mapB6Notification` arma body con actor+contexto+prioridades; `B6_NOTIF_ACTOR_BODY`/`B6_NOTIF_CONTEXT_ONLY_BODY` (plantillas); `b6MatchContextSuffix` pasa a ser un alias de `PH.computeMatchContextSuffix` |
| `bramulab/player-home.js` | `computeMatchContextSuffix` (nueva, pura) |
| `bramulab/tests.html` | 10 aserciones nuevas `RONDA-UX-HIST ·` |
| `bramulab/store.js` | `BUNDLE_VERSION` → `04.11-h7` |
| `bramulab/sw.js` | `CACHE_NAME`/`CORE_ASSETS` → `04.11-h7` |
| `bramulab/version.json` | `bundle` → `04.11-h7` |
| `bramulab/index.html` | bump de `?v=` en todos los `<script src>`/`<link>` |
| `supabase/migrations/20260927110000_preprod_ux_notification_historical_context.sql` | Nueva, aditiva — 2 helpers + `get_notifications` extendido |
| `supabase/tests/verify-preprod-ux-notification-historical-context.sql` | Nueva — verify transaccional (BEGIN/ROLLBACK), casos A-G |

Sin cambios en `styles.css`, Nivel, Ranking, Perfil, JUGADORES, header, Intelligence, correcciones de resultado, identidad, Mis grupos, responsive, legal/P0.2/P0.3 — ni en la migración de notificaciones ya aplicada (`preprod_ux_notification_actor_enrichment`, intacta, su trigger sigue enriqueciendo inserts futuros sin cambios).

---

## Migración pendiente de aplicar

**`20260927110000_preprod_ux_notification_historical_context.sql`** — NO aplicada por mí (sin credenciales de Supabase en este sandbox, igual que todas las rondas anteriores).

- **Contrato viejo**: `payload` de una fila histórica sin enriquecer es `{}` o sin `actorPlayerId`; ninguna fila trae `matchContext`.
- **Contrato nuevo (aditivo)**: toda fila ligada a un `matchId` gana `payload.matchContext` (o `null` sin evidencia); las 4 persistidas informativas ganan además `actorPlayerId` reconstruido cuando la evidencia es inequívoca. Un frontend que todavía no lea `matchContext` sigue funcionando igual.
- **Impacto**: sin `UPDATE`/backfill sobre `notifications`; el trigger de Ronda 2 queda intacto. `get_notifications` es `CREATE OR REPLACE` puro sobre la misma firma/permisos.
- **Rollback**: `drop function public._bloque6_notification_historical_actor(uuid, text); drop function public._bloque6_notification_match_context(uuid, uuid);` y reaplicar la definición de `get_notifications` de `preprod_ux_notification_actor_enrichment` si hiciera falta — el frontend sigue funcionando igual sin `matchContext`/actor reconstruido (fallback ya implementado).
- **Verify**: `supabase/tests/verify-preprod-ux-notification-historical-context.sql` (casos A-G + firma/permisos, transaccional, sin dejar fixtures).

---

## Tests

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS** (sin cambios).
- `bramulab/tests.html` → **1534/1534 PASS** (1524 previas + 10 nuevas `RONDA-UX-HIST ·`):
  - dos `matchContext` distintos producen sufijos distintos (el bug real de QA: 5 tarjetas indistinguibles);
  - incluye rivales unidos con "+" y score completo unido con "·";
  - perspectiva Team A / Team B: usa el score tal cual llega ya orientado (la inversión ocurre en SQL, cubierta por el verify transaccional, caso C);
  - sin score: rivales solamente, nunca inventa un resultado;
  - fallback contrato viejo: `undefined`/`null`/sin `opponentNames`/`opponentNames` vacío → `''`, nunca revienta.
- Boot smoke test: `index.html` con bundle `04.11-h7`, los 19 módulos versionados 200 OK, mismo único 404 preexistente (`env.generated.js`).
- **No cubierto por tests automáticos** (app.js sin cobertura por diseño, mismo criterio de todas las rondas anteriores): `mapB6Notification` completo (Store/DOM), `selfCaused` filtrando filas históricas en vivo, click abre `matchId` correcto, read/unread sin cambios, tareas accionables no se resuelven al leer — estos 5 puntos son código **sin cambios** de Ronda 2 (la lógica de filtrado/click/read no se tocó, solo de dónde puede venir `actorPlayerId`), verificados por lectura de código; central los confirma junto con el verify SQL contra Staging real.

---

## Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h6` → **`04.11-h7`** (único bump de esta corrección).
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, todos los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Migración sin aplicar/verificar contra Staging real | Los 2 helpers + `get_notifications` extendido están escritos y cubiertos por un verify transaccional con 7 casos (A-G), pero nunca corrieron contra Postgres real (sin credenciales en este sandbox) | Central aplica + corre el verify antes de que Work retome QA |
| `correction_accepted`/`identity_resolved`/`identity_unidentified` sin evidencia real de QA que los haya ejercitado | El mapeo tipo→`action_type` se verificó leyendo el código de las RPCs productoras (no asumido), y el criterio de unicidad es el mismo para los 4 tipos — pero solo `match_validated` tiene evidencia real de Staging (los 5 fixtures de QA) probando el camino end-to-end | Cubierto en el verify SQL (caso F usa `correction_accepted` deliberadamente ambiguo); pendiente de que Work encuentre/confirme un caso real de los otros 3 tipos en una vuelta de QA futura |
| Frontend sin QA visual real sobre las 5 filas de Seba | El body con actor+contexto se armó y testeó en aislamiento (`computeMatchContextSuffix`, puro); no se pudo ver renderizado contra las 5 filas reales de Staging desde este sandbox | Pendiente de que Work vea las 5 notificaciones reales de Seba después de que central aplique la migración |

---

## Decisiones abiertas

Ninguna decisión de producto nueva — la corrección se resolvió dentro del criterio ya dado por el handoff de esta corrección puntual.

---

## Qué debe revisar Central

1. HEAD de `staging` (diff completo + este documento).
2. Aplicar `20260927110000_preprod_ux_notification_historical_context.sql` contra Staging y correr `verify-preprod-ux-notification-historical-context.sql` — casos A-G, transaccional.
3. Confirmar contra las 5 filas reales de Seba (evidencia del handoff de esta corrección) que: las 3 causadas por terceros ahora muestran actor+rivales+resultado reales y distintos entre sí; las 2 causadas por el propio Seba dejan de aparecer en su bandeja.
4. Si todo queda limpio, Work retoma QA exactamente desde Notificaciones.
