# BRAMUlab — Segunda corrección post-QA 26SEP

**Rama:** `staging`
**Fecha:** 26/09/2026
**HEAD base:** `f101c35edcdd258ac90574c36bc06b81bfcbcc2a`
**Origen:** handoff [`21_Handoff_Correccion_Adicional_QA_26SEP.md`](21_Handoff_Correccion_Adicional_QA_26SEP.md), a partir de la revisión de Central sobre la Ronda 1 (`20_Resultado_Correccion_QA_26SEP.md`) ya aplicada e integrada en Staging.

No se reabrió el Laboratorio. Esta ronda ataca primero el P0 compartido (§2 del handoff) y después implementa completa la batería de 6 ítems de UX (§3-§9), en el orden del handoff.

---

## 1. P0 — fallo compartido de oficialización / corrección / identidad

### Evidencia de partida (dada por Central, ver handoff §2)

- `POST 500 /functions/v1/officialize-match` repetido (17:06-17:11 UTC) sobre el partido `aa41e8d9-6d16-4c47-8928-187c5fad5ccd`, secuencia real: `created → confirmed(Seba) → revision_proposed(Seba) → confirmed(Esteban)`, resultado: el partido queda trabado en `pending_validation`.
- `POST 200 /functions/v1/resolve-identity-issue` con la UI recibiendo `ok:false`, sobre la incidencia `6cd9cd16-5450-4496-a9c4-6491403047ed` (partido `20a3dbd1-7cae-4e13-9b6d-efe69f653bf8`). Central ya había confirmado, corriendo la RPC de autorización dentro de un `BEGIN/ROLLBACK`, que `resolve_identity_issue` autoriza correctamente (`identity_resolved_authorized`, `needsRecompute:true`) — la falla es posterior, en la recomputación/oficialización compartida.
- Las tres Edge Functions (`officialize-match`, `respond-match-correction`, `resolve-identity-issue`) convergen en `match-officialize-core.ts` → `officialize_match_validation`.

### Causa encontrada (por lectura de código, confirmada línea a línea en las 3 Edge Functions)

No se pudo reproducir el error real de Postgres desde este sandbox (sin credenciales de Supabase Staging), pero la lectura de código expone **dos bugs reales y concretos**, ambos en el manejo de errores compartido — exactamente donde el handoff señalaba (`match-officialize-core.ts`):

1. **Miscategorización HTTP sistemática.** Las tres Edge Functions trataban *cualquier* `!result.ok` como una falla de servidor: `officialize-match` devolvía **siempre HTTP 500**, sin distinguir un estado de negocio esperable (partido ya validado, ventana vencida, incidencia ya cerrada, revisión/snapshot obsoleto por una carrera de concurrencia) de una falla real. `resolve-identity-issue` y `respond-match-correction` devolvían **siempre HTTP 200 con `ok:false`** para el mismo abanico de códigos — que es exactamente el síntoma reportado ("Log real: POST 200 ... pero la UI recibió `ok:false`"). Esto por sí solo explica por qué una situación de negocio normal (ej. una carrera entre las dos confirmaciones de la pareja) se leía como "el servidor se rompió" o como un fallo silencioso sin ninguna pista.
2. **Carrera real no idempotente.** Cuando dos llamadas de oficialización concurrentes (los dos integrantes de una pareja confirmando casi a la vez, o el reintento "self-healing" que el propio cliente dispara al detectar `readyForValidation=true`) compiten por el lock `for update` de `officialize_match_validation`, la que gana la carrera oficializa con éxito; la que llega segunda —con `trigger='initial'`— encuentra el partido **ya** `validated` y la RPC responde `already_validated`. Antes de esta ronda ese código de negocio (el resultado que esa segunda llamada buscaba **ya es cierto** en ese momento) se trataba como cualquier otro `ok:false`: un fallo. Esto coincide con la secuencia real reportada, donde hubo confirmaciones casi simultáneas de Seba y Esteban.

Adicionalmente, se confirmó por lectura de código el punto que el handoff señalaba explícitamente ("hoy `match-officialize-core.ts` aplasta `rpcError` a `persist_failed`"): el error real de Postgres devuelto por `officialize_match_validation` (mensaje, código, detail, hint) se descartaba por completo — nunca quedaba rastro técnico en ningún lado, ni cliente ni servidor. Si existe una tercera causa real distinta de las dos de arriba (ej. una violación de constraint en el payload calculado por el motor), hoy es **imposible de diagnosticar** sin ese rastro, incluso con acceso a Staging.

### Fix

- **Logging técnico real, nunca expuesto al cliente.** `match-officialize-core.ts` ahora loguea con `console.error`/`console.warn` (mensaje, código, detail, hint de Postgres + `matchId`/`trigger`/`attempt`, y el payload completo `rpcParams` enviado a la RPC) en cada punto donde antes se perdía la información: fallo de snapshot, fallo de historial, fallo de la RPC de persistencia (el punto exacto que "aplastaba" el error), reintento por snapshot obsoleto, rechazo de negocio, y agotamiento de reintentos. El cliente sigue recibiendo únicamente el código genérico (`persist_failed`, etc.) — nunca datos sensibles de servidor. Lo mismo se aplicó en las 3 Edge Functions donde antes se devolvía `detail: xxxError.message` directo al cliente (`officialize-match`, `resolve-identity-issue`) — ese campo se elimina de la respuesta y el mensaje real pasa a los logs.
- **Mapeo HTTP único y compartido.** Nueva función exportada `officializeErrorHttpStatus(code)` en `match-officialize-core.ts`, con un `Set` (`BUSINESS_STATE_CODES`) de los códigos de negocio esperables documentados (`already_validated`, `match_not_actionable`, `not_ready_for_validation`, `match_expired`, `identity_issue_open`, `stale_match_revision`, `stale_level_snapshot`, `identity_issue_not_open`, `no_pending_correction`, `no_current_revision`, `missing_validated_at_for_reapplication`, `match_not_found`) → **409** (Conflict, el cliente puede releer/reintentar). Cualquier otro código (motor no disponible, snapshot/historial/persistencia ilegibles, reintentos agotados, o un código nuevo no reconocido) → **500**, nunca se asume benigno por default. Las 3 Edge Functions (`officialize-match`, `resolve-identity-issue`, `respond-match-correction`) importan y usan esta **misma** función — nunca 3 parches locales distintos, como pedía explícitamente el handoff.
- **`already_validated` en `trigger='initial'` se resuelve como éxito idempotente.** Antes de llegar al chequeo genérico de fallo, `officializeMatch` detecta este caso puntual, releé el snapshot fresco (`get_match_officialization_snapshot`) y devuelve `{ok:true, resultId, eligible}` con el resultado que ya se aplicó — en vez de un código de error que las 3 Edge Functions convertían en un toast genérico. Este caso es el único tratado como éxito; cualquier otro `ok:false` sigue devolviendo el código real, ahora con el status HTTP correcto.
- **Mensajes honestos al usuario.** `app.js#B6_ERROR_MESSAGES` gana entradas para los códigos que antes caían todos al genérico "No se pudo completar la acción" (`confirm_failed`, `persist_failed`, `officialize_failed`, `identity_recompute_failed`, `correction_recompute_failed`, `stale_snapshot_retries_exhausted`, `engine_unavailable`, `snapshot_fetch_failed`, `history_fetch_failed`, `no_current_revision`, `missing_validated_at_for_reapplication`) — "probá de nuevo" para lo transitorio real, un mensaje más claro para lo que conviene reportar si se repite.

### Validación realizada en este sandbox

Sin credenciales de Supabase Staging no fue posible reproducir el HTTP 500 real ni correr `officialize_match_validation` contra Postgres real. Se validó lo que sí es verificable sin backend:

- 6 tests Node nuevos (`supabase/functions/_shared/match-officialize-core.test.mjs`) que **ejecutan realmente** `officializeErrorHttpStatus`/`BUSINESS_STATE_CODES` (extraídos del `.ts` fuente y evaluados como JS — el archivo es Deno, no cargable directo en Node) y hacen guardas estáticas sobre el código fuente: confirman que el `rpcError` real se loguea con `console.error` antes de devolver `persist_failed` (nunca en silencio), que `already_validated`+`trigger=initial` se resuelve como éxito **antes** del chequeo genérico de fallo, y que las 3 Edge Functions importan y usan el mismo `officializeErrorHttpStatus` compartido y ya no exponen `detail: xxxError.message` al cliente.
- Reproducción manual con un harness Node cargando los archivos reales del motor (`level.js`/`level-context.js`) para descartar hipótesis alternativas antes de fijar la causa: se revisó específicamente si `circleFactor` (numérico, no booleano) o el nombre del campo `confidenceOrigin` (genuinamente numérico, no una etiqueta de categoría mal tipada) podían ser la causa real — ambas hipótesis se descartaron por lectura directa de `level.js`/`officialize-onboarding/index.ts`, no se encontró ningún bug ahí.
- Revisión de balance de llaves del diff en `match-officialize-core.ts` (20 aperturas / 20 cierres, sin desbalance nuevo respecto del archivo base) como chequeo de sanidad adicional, ante la imposibilidad de correr `deno check` en este sandbox (`deno` no está instalado).

### Riesgo residual real

**No hay confirmación de que estos sean los ÚNICOS bugs causando el HTTP 500 real.** Sin logs reales de Staging ni forma de ejecutar `officialize_match_validation` contra Postgres real desde este sandbox, es posible que exista una tercera causa (ej. una violación de constraint en el payload calculado por el motor para este partido específico) que el logging nuevo revelará en el próximo intento real, pero que hoy sigue sin diagnóstico exacto. La mitigación explícita para esto es la razón de ser del punto más importante del fix: **el logging técnico está en su lugar ahora**, así que la próxima vez que ocurra (en Staging real, con las Edge Functions redesplegadas) el mensaje real de Postgres va a quedar en los logs de la función, en vez de perderse. No se mutó ningún dato de los partidos reales mencionados en el handoff.

### Qué debe hacer Central

- **No requiere migración de base de datos** — el fix es enteramente de las Edge Functions (lógica de manejo de errores/HTTP, sin tocar ninguna RPC ni tabla).
- **Redeploy manual requerido** (este sandbox no tiene permisos ni herramientas de deploy): `supabase functions deploy officialize-match`, `supabase functions deploy resolve-identity-issue`, `supabase functions deploy respond-match-correction` (las 3 comparten `_shared/match-officialize-core.ts`, así que las 3 deben redesplegarse juntas para que el símbolo `officializeErrorHttpStatus` se resuelva).
- Después del redeploy, reproducir el caso real (reintentar `officialize-match` sobre el partido `aa41e8d9-...` si sigue en `pending_validation`, o el `resolve-identity-issue` sobre la incidencia `6cd9cd16-...` si sigue abierta) y revisar los logs de la función en el dashboard de Supabase — el `console.error` va a mostrar el mensaje/código/detail/hint real de Postgres si la causa es una tercera distinta de las dos ya corregidas.

---

## 2. Notificaciones — título actor + acción

`mapB6Notification` (`app.js`) se reescribe: el actor real ahora vive en el **título** (`"Esteban confirmó tu partido"`), nunca repetido en el body. El body pasa a ser **solo** el contexto que identifica el partido (`"vs Esteban + Gusti · 6–4 · 3–6 · 6–2"`, el mismo `ctxSuffix` de siempre recortado, sin la frase de acción). Nueva tabla `B6_NOTIF_ACTOR_TITLE` con los 6 tipos que tienen un actor resoluble: `match_validated`, `correction_accepted`, `identity_resolved`, `identity_unidentified`, `correction_proposed`, `identity_questioned`. Sin actor resoluble (contrato viejo sin `actorPlayerId`, o el nombre no está en el cache local de partidos), el título cae al evento neutro de `B6_NOTIF_COPY` — nunca se inventa un actor. `admin_action` queda deliberadamente afuera (su actor real es texto libre en `payload.adminActorLabel`, nunca un `player_id`). `selfCaused`, read/unread, click al partido, `matchContext` y "nunca N+1" no se tocaron.

---

## 3. Header / degradé — iPhone

Causa real: `overscroll-behavior:none` (ya presente) tiene soporte históricamente parcial en Safari/iOS para el *scroller del documento* (a diferencia de un `div` interno con su propio `overflow`). El documento (`html`/`body`) podía "rebotar" (elastic bounce) si su contenido excedía el viewport por cualquier motivo (redondeo de sub-píxel, notch/safe-area), revelando por un instante el fondo plano de `html`/`body` detrás del header durante ese rebote — el "blur/degradé que invade logo/título" reportado, exclusivo de iPhone/Safari.

Fix: `overflow: hidden` en la regla `html,body`. Cada vista real ya scrollea internamente por su propio contenedor (`.analysis-scroll`, `.player-home-header` + hermano con `flex:1`+`overflow-y:auto`, etc.) — el documento nunca necesitaba scrollear por sí mismo; este cambio fuerza esa arquitectura ya vigente, así que no hay nada que rebotar/revelar a nivel documento en ningún motor. Verificado estructuralmente en este sandbox (viewport móvil 375×812: `document.body` con `overflow` computado `hidden`, `scrollHeight === innerHeight`) — la confirmación real en iPhone físico queda para Sebastián, según pide el propio handoff ("validar al menos conceptualmente en viewport iPhone").

---

## 4. CTA central "+" de Cargar partido

Causa real del "no perfectamente centrado": el FAB era el **único** ítem de la barra inferior (de 5) que usaba un glifo de texto (`<span>+</span>`) en vez de un ícono SVG como los otros 4 — el centrado óptico de un carácter depende de la métrica de la fuente (cap-height/baseline), nunca es geométricamente exacto dentro de un círculo centrado por flexbox.

Fix:
- El glifo de texto se reemplaza por un SVG (`<path d="M12 5v14M5 12h14"/>`, mismo trazo redondeado que el resto del set de íconos de la app), centrado real por `viewBox`.
- Diámetro `52px → 58px` (más presencia, "acción primaria de la app", sin volverse desproporcionado) con `margin-top` reajustado de `-22px` a `-24px` para conservar la misma proporción de elevación sobre la barra (antes ≈42% de su propio alto por encima del borde superior de los demás ítems, ahora ≈41% — prácticamente idéntico).
- Verificado visualmente en viewport móvil (375×812): ícono geométricamente centrado, sin tapar contenido ni el resto de la barra de navegación.

---

## 5. Cargar partido — metadata crítica antes del resultado

Antes, formato/puntuación/fecha-hora vivían **después** del bloque de resultado (marcador acumulado + set actual) — el usuario podía empezar a cargar sets con un formato incorrecto y descubrirlo recién al final.

Fix: ambas líneas (`#load-format-line`, `#manual-meta-line`) se mueven a una nueva área compacta (`.court-meta-compact`) ubicada **inmediatamente después de los equipos y siempre antes del primer set**, sin duplicación (se retiraron del lugar donde vivían antes). Formato a la izquierda, fecha/hora a la derecha, ambas dentro de un contenedor `flex-wrap`: si alguna de las dos líneas no entra a mitad de ancho (fecha/hora/lugar largo, o un nombre de formato extenso), esa fila pasa a ocupar el ancho completo en su propia línea — nunca overlap, nunca scroll horizontal (verificado visualmente forzando un nombre de formato largo en viewport móvil: "Clásico · Mejor de 3 · Punto de Oro" pasa a 2 líneas limpias dentro de su propia celda, sin invadir la celda de fecha/hora). Cada botón sigue abriendo exactamente la misma hoja de edición vigente (`openManualFormatSheet`/`openManualMetaSheet`), sin cambios de lógica — solo reposicionamiento de markup. No se inventó soporte de "americano" ni ningún formato no soportado hoy.

---

## 6. Historial — resultado y estado en columna derecha

Antes, el badge de estado (`PENDIENTE DE VALIDACIÓN`, `IDENTIDAD CUESTIONADA`, etc.) vivía suelto al final de la tarjeta, alineado a la izquierda por comportamiento de bloque por defecto — lejos de `VICTORIA`/`DERROTA` pese a ser el mismo tipo de dato ("qué pasó con este partido").

Fix: nueva columna `.history-item__result-col` (flex, `align-items:flex-end`) dentro del `top-row`, que agrupa `VICTORIA`/`DERROTA` y el/los badge(s) de estado, apilados y alineados a la derecha. El estado queda siempre debajo del resultado, nunca a la izquierda.

Adicional (mismo punto del handoff): el punto de "cambios no vistos" del ícono de Historial en la barra inferior pasa de cian a rojo (`var(--danger)`) — el cian se perdía contra el fondo oscuro en un ícono tan chico. El acento cian de la **fila** cambiada (`.history-item--unseen`, inset box-shadow) se mantiene intacto, tal como pedía explícitamente el handoff ("no reestructurar el sistema").

---

## 7. Home — Último partido

Mismo criterio que el punto 6: antes `VICTORIA`/`DERROTA` y el badge de estado podían convivir en la misma línea (`row2`), compitiendo por el mismo renglón angosto. Fix: el badge de estado se muda a la columna `.player-home-lastmatch__datetime` (la misma columna de fecha/hora, ya alineada a la derecha), quedando **debajo** de fecha/hora. `VICTORIA`/`DERROTA` queda sola en `row2`, junto a la forma reciente — sigue siendo el dato prominente de esa fila, nunca comparte renglón con el estado. Consistente con el punto 6 (Historial).

---

## 8. Editor de corrección — claridad de equipos

Revisión contra la queja específica del handoff (más allá de "tener un court/keypad parecido", ya resuelto en la Ronda 1): "qué pareja corresponde a cada lado", "qué números pertenecen a quién", "quién ganó cada set", "score actual prellenado", "orientación consistente con el Resumen", "usar nombres reales", "no obligar a deducir izquierda=A/derecha=B".

Estado encontrado al revisar (ya resuelto, sin necesidad de cambios): el editor ya tiene una referencia de equipos **siempre visible** (`.b6-correction-teams`, con `team-dot` lima=A/celeste=B + nombre real de cada pareja, fija al abrir el editor — la composición de pareja no cambia durante una corrección de resultado), el bloque de set en edición ya muestra el nombre real de cada equipo debajo de su número (`court-score__name`), y `openProposeCorrection` ya prellena `b6CorrectionSets` desde `f.sets` (el resultado existente del partido) — nada de esto quedaba pendiente.

Lo que **sí** faltaba, y se corrigió en esta ronda: los chips de sets ya confirmados (`.court-accumulated__set`, ej. "SET 1 · 6–4") mostraban el score en un único color, sin ninguna señal de qué lado ganó ese set. Fix: mismo criterio de contraste que el Resumen (`buildScoreCardHTML`: "ganador 100% contraste, perdedor atenuado", `.result-card__set--win`/`--lose`) — el número de cada equipo pasa a dos `<span>` propios (`.court-accumulated__set-num`), el que ganó ese set en blanco pleno, el que perdió atenuado (un set empatado en games, solo posible en el segmento extraordinario, no marca a ninguno como ganador). Esto es explícitamente "orientación consistente con el Resumen", tal como pedía el handoff — nunca un componente nuevo. Cambio acotado a `renderProposeCorrectionAccumulated`/CSS nuevo scoped a este editor — el chip de Cargar partido (mismo componente base) sigue exactamente igual.

Verificado visualmente (inyección de DOM con datos reales en viewport móvil): referencia de equipos legible arriba, chips de sets confirmados con el número ganador claramente más brillante que el perdedor, bloque de set en edición con nombres reales prellenado con el score existente.

---

## Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `supabase/functions/_shared/match-officialize-core.ts` | `BUSINESS_STATE_CODES`/`officializeErrorHttpStatus` (mapeo HTTP compartido), logging técnico real en cada punto de error (nunca al cliente), `already_validated`+`trigger=initial` como éxito idempotente |
| `supabase/functions/officialize-match/index.ts` | usa `officializeErrorHttpStatus`, retira `detail: confirmError.message` del cliente, logea el error real |
| `supabase/functions/resolve-identity-issue/index.ts` | ídem |
| `supabase/functions/respond-match-correction/index.ts` | ídem |
| `supabase/functions/_shared/match-officialize-core.test.mjs` | Nuevo — 6 tests (mapeo HTTP real + guardas estáticas de logging/idempotencia/uso compartido) |
| `bramulab/app.js` | `B6_ERROR_MESSAGES` (11 códigos nuevos), `mapB6Notification`/`B6_NOTIF_ACTOR_TITLE` reescritos, `renderHistory` (columna resultado/estado), `renderPlayerLastMatchCard` (ídem Home), `renderProposeCorrectionAccumulated` (contraste ganador/perdedor) |
| `bramulab/index.html` | `.court-meta-compact` (formato+fecha/hora antes del primer set), FAB con SVG en vez de texto, bump `?v=` en todos los `<script>`/`<link>` |
| `bramulab/styles.css` | `overflow:hidden` en `html,body`, `.bottom-nav__item--fab` 52→58px + `.bottom-nav__fab-icon`, `.bottom-nav__unseen-dot` cian→rojo, `.history-item__result-col`, `.player-home-lastmatch__datetime .player-home-lastmatch__badge`, `.court-meta-compact`, `.court-accumulated__set-num`/`-sep` |

Sin migraciones nuevas en esta ronda — el P0 se resolvió enteramente en las Edge Functions, y los 6 ítems de UX son cambios de frontend puro.

---

## Tests

- `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs` → **253/253 PASS** (247 previas + 6 nuevas del P0 compartido).
- `bramulab/tests.html` → **1564/1564 PASS**, sin regresión sobre la Ronda 1 (login sin falso onboarding, alineación del Resumen, avatar de búsqueda, fila compacta, recientes con @username/Nivel, Mis Jugadores server-backed, identidad por `player_id`).
- Boot smoke test: `index.html` con bundle `04.11-h9`, sin errores de consola nuevos (único 404 preexistente: `env.generated.js`, esperado sin backend configurado en este sandbox).
- Verificación visual dirigida en el Browser pane (viewport móvil 375×812, sin backend real disponible en este sandbox):
  - CTA "+": ícono SVG centrado, diámetro mayor, sin tapar navegación.
  - Cargar partido: formato+fecha/hora en área compacta antes del primer set, wrap limpio con texto largo.
  - Historial: 4 combinaciones (resultado+estado, solo estado, solo resultado, ninguno) — columna derecha apilada, sin overlap.
  - Home Último partido: fecha/hora arriba-derecha, estado debajo, resultado solo en su propia fila junto a la forma reciente.
  - Editor de corrección: referencia de equipos siempre visible, chips con contraste ganador/perdedor, set en edición prellenado con nombres reales.
- **No cubierto por tests automáticos ni por este sandbox**: el P0 real contra Postgres/Staging (sin credenciales de Supabase en este entorno); el header/degradé en iPhone físico real (Safari real, no emulable con certeza desde este sandbox).

---

## Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h8` → **`04.11-h9`** (único bump de esta ronda).
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| P0: sin confirmación de causa única | Ver §1 arriba — es posible que exista una tercera causa real todavía no diagnosticada, además de las 2 corregidas | El logging técnico nuevo va a exponerla en el próximo intento real contra Staging con las Edge Functions redesplegadas |
| P0: sin reproducción de punta a punta | No se pudo ejercitar `officialize-match`/`resolve-identity-issue`/`respond-match-correction` contra Supabase real desde este sandbox | Central: redeploy de las 3 funciones + reintento real sobre los 2 casos del handoff (partido `aa41e8d9-...`, incidencia `6cd9cd16-...`) |
| Header/degradé: sin confirmación en iPhone físico | El fix es conceptualmente correcto para la clase de bug descripta (rebote del documento en Safari/iOS), pero este sandbox no puede emular Safari/iOS real con certeza | Sebastián: revisión visual corta en iPhone real, como ya pedía el propio handoff |
| UX (Historial/Home/Cargar partido/editor/CTA): sin QA de navegador real con backend | Todo verificado por inyección de DOM con `styles.css`/`app.js` reales en el Browser pane, nunca contra una cuenta Staging real con partidos reales en cada estado | Central: pasada corta de navegador contra Staging antes de que Sebastián valide |

---

## Qué quedó fuera (según §11 del handoff, sin cambios)

`main`, Production, BRAMUlive, Mis grupos, fórmula de Nivel, reglas de Ranking, legal/P0.2, eliminación/P0.3, Realtime/polling, monetización.

---

## Decisiones técnicas menores resueltas sin marcar como abiertas

- Diámetro del FAB: 58px (el handoff pedía "moderadamente mayor" sin un valor — se eligió +6px/+11.5% sobre el original, visualmente notorio sin desproporcionar la barra de 5 ítems).
- Título de notificación para `correction_proposed`/`identity_questioned`: se usó el mismo criterio de "actor + acción" que los otros 4 tipos (`"Seba propuso una corrección"`/`"Seba cuestionó un participante"`), tal como el propio handoff ejemplificaba explícitamente en §3.
- Contraste ganador/perdedor en los chips del editor de corrección (punto 8): no estaba pedido literalmente como una tarea nueva, pero es la lectura directa de "quién ganó cada set" + "orientación consistente con el Resumen" del handoff §9 — se resolvió reutilizando el criterio visual exacto ya validado en el Resumen, sin inventar un tratamiento nuevo.

Ninguna decisión de producto nueva quedó abierta.

---

## Qué debe revisar Central

1. HEAD de `staging` (diff completo + este documento).
2. **Redeploy manual de las 3 Edge Functions** (`officialize-match`, `resolve-identity-issue`, `respond-match-correction`) — comparten `_shared/match-officialize-core.ts`, deben desplegarse juntas. Sin migración de base de datos.
3. Después del redeploy: reintentar el partido `aa41e8d9-6d16-4c47-8928-187c5fad5ccd` (si sigue `pending_validation`) y la incidencia `6cd9cd16-5450-4496-a9c4-6491403047ed` (si sigue abierta); revisar los logs de las funciones en el dashboard de Supabase para confirmar si el `console.error` expone una causa adicional.
4. Deploy a Staging (Vercel) con bundle `04.11-h9`.
5. Pasada corta de navegador contra Staging real de los 6 puntos de UX (§3-§9 del handoff).
6. Si todo queda limpio, Sebastián hace una validación física corta — empezando por el P0 (crear/confirmar/corregir un partido real de punta a punta) y el header/degradé en iPhone, que son los 2 puntos que este sandbox no pudo confirmar directamente.
