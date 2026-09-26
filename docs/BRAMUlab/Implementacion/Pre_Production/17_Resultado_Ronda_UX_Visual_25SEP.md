# BRAMUlab — Resultado · Ronda UX 25/09, Ronda 2 (jerarquía visual)

**Rama:** `staging`
**Fecha:** 26/09/2026
**HEAD base (aprobado por central):** `374793a`
**Handoff de origen:** `13_Handoff_Implementacion_Ronda_UX_25SEP.md` §B/§C/§D/§E/§H/§I/§J/§K

Central declaró la Ronda 1 (funcional/estado) **cerrada** en `16_Cierre_Ronda_UX_Funcional_Eventos.md` y autorizó esta Ronda 2 sobre jerarquía visual. No se reabrió nada de la Ronda 1 salvo lo que esta ronda pudiera afectar directamente (badge VALIDADO, colores de estado — ambos explícitamente dentro del alcance de Ronda 2).

---

## Diagnóstico

El problema de fondo de la Ronda 1 no era funcional (eso ya quedó cerrado): era que **resultado** (quién ganó) y **estado** (qué falta hacer) compartían el mismo lenguaje visual — lima para "victoria" Y para "requiere tu acción" a la vez, un badge VALIDADO que nunca se apagaba, un solo banner de Home que mezclaba pendientes propios y ajenos, y un Resumen con demasiados puntos de entrada para "algo está mal" (Proponer corrección + No participé como acciones separadas, sueltas). Esta ronda es puramente de **presentación y jerarquía** — ninguna regla de negocio server-backed se tocó.

---

## Qué se implementó

### §B — Badge VALIDADO retirado
Ya no existe un badge persistente "VALIDADO" en Home/Historial/Resumen. Queda únicamente el toast transitorio "Partido confirmado." (ya existía desde Ronda 1) — nunca se lo reemplazó por un badge equivalente en ningún lado.

### §C — Resultado vs. Estado, colores separados
- **Resultado** (irreversible, propio del marcador): victoria = verde (`--confirm-green`, primer uso real de ese token en la app — antes existía pero nunca se usaba), derrota = rojo (`--danger`).
- **Estado** (transitorio, de flujo): accionable = lima (`--brand-lime`, ahora EXCLUSIVO de "te toca actuar"), espera-a-terceros = ámbar (`--gold`, mismo tono que CALIBRANDO — nunca naranja distinto), informativo/secundario = neutro/gris.
- `serverMatchStatusLabel`/`serverMatchStatusBadgeModifier` (app.js) siguen siendo el único punto de verdad para ambos ejes en Home/Historial/Resumen.
- Home — tarjeta de Último Partido: nuevas variables CSS `--lastmatch-accent`/`--lastmatch-accent-rgb` (antes hardcodeado a lima) + modificadores `.player-home-lastmatch--win/--loss/--action/--waiting`. `--loss` quita el pulso y baja la intensidad del glow a propósito (nunca un glow rojo agresivo, pedido explícito del handoff).
- Historial: `.history-item__result-badge--win` pasa de lima a verde; nuevo `.history-item__badge--waiting` en ámbar para "esperando a la otra pareja" (antes solo existía el lima de "accionable").

### §D — Home: banner único → carrusel
`#player-home-pending-banner` (una sola tarjeta, agregado "tenés N partidos") se reemplaza por `#player-home-pending-carousel`: **una tarjeta por partido real**, nunca un agregado inventado. Nueva función pura `PH.computeHomePendingCarouselItems(displayMatches)` (`player-home.js`) decide qué entra y en qué orden — accionables primero, espera después; nunca clasifica un pendiente sin `actionSide` como "espera" (evita inventar estado cuando no hay dato).
- CSS: `display:flex; overflow-x:auto; scroll-snap-type:x mandatory`, cada tarjeta `flex:0 0 100%` — con 1 pendiente se ve estática (nada para desplazar), con 2+ scroll horizontal nativo. Sin librería nueva.
- Sin CTA suelto tipo "REVISAR": la tarjeta entera es el blanco de toque (click + teclado, mismo patrón que las filas de identidad de Ronda 1).
- Altura reducida a propósito: solo microlabel + una línea de copy (antes tenía título+texto+botón).
- Categoría "informativos/tips" (3° tipo del handoff) queda **sin implementar deliberadamente**: hoy no existe ninguna fuente real de contenido informativo temporal en Home fuera de TU MOMENTO (NO TOCAR, §13) — inventar contenido para llenar esa categoría violaría "nunca inventar actores/eventos". Documentado como decisión, no como pendiente técnico (ver Decisiones abiertas).

### §D — Resumen: alineación del score card
`.result-card__sets` (grid de celdas de sets) no tenía `align-items` explícito: por default de CSS Grid (`stretch`), cuando una fila mezcla una celda normal (una línea) con una celda de tie break extraordinario (dos líneas, más alta), las celdas normales se estiran a la altura de la más alta pero su texto queda anclado arriba (sin mecanismo de centrado vertical propio) — el efecto exacto de "fila ópticamente corrida" reportado en QA real. Fix: `align-items:center` en `.result-card__sets`. Un solo selector, sin tocar el layout de nombres/columnas. Verificado sin regresión con un partido de 2 sets reales (screenshot + inspección de `getComputedStyle`); **no se pudo reproducir una celda de tie break real en este sandbox** (la carga manual no captura el score puntual del tie break, solo el resultado del set) — ver Riesgos residuales.

### §D — Resumen: metadata de trazabilidad
Nuevas `buildAnalysisMetaLines(f)`/`renderAnalysisMeta(f)` (app.js) reemplazan la línea única de fecha+formato por hasta 3 líneas, **solo con evidencia real**:
- `Cargado por {nombre} · {fecha} · {hora}` — `createdByPlayerId` ya viaja en `get_my_matches`/`get_match_detail` desde Ronda 1.
- `{Formato} · {Sistema}`.
- `Confirmado por {nombre}` — solo cuando `status === 'validated'` y hay un actor real resoluble (`b6LastActorForActionType(f, 'validated')`); si no hay evidencia, la línea simplemente no aparece (nunca "Confirmado por alguien").
- Se retiró la línea "TU TURNO: CONFIRMAR" de la metadata y el banner permanente "Partido oficial." — ambos eran ruido redundante con el CTA/estado ya visibles más abajo.
- El banner contextual "Te toca confirmar este resultado." se retira ÚNICAMENTE cuando el CTA primario (CONFIRMAR PARTIDO) ya comunica lo mismo por sí solo; los banners de corrección/reemplazo/incidencia (que explican QUÉ pasó, no solo que "falta algo") se mantienen intactos — ninguno de esos textos se tocó.

### §E — Resumen: acciones unificadas
- Primario: `CONFIRMAR PARTIDO` o `ACEPTAR CORRECCIÓN` (sin cambios de Ronda 1 — la clasificación por evento real sigue intacta).
- Secundario: un único botón **"REPORTAR UN ERROR"** reemplaza los dos accesos sueltos (Proponer corrección + No participé). Abre un bottom sheet (`#report-error-scrim`) con las opciones que el partido realmente admite ahora mismo (mismo cálculo `b6ReportErrorAvailability` que ya decidía mostrar/ocultar los botones viejos — nunca ofrece algo que el backend rechazaría):
  - **A) El resultado** → abre el editor de corrección existente (`openProposeCorrection`, sin tocar su lógica).
  - **B) Un participante** → abre el selector de "no participé" existente (`openReportIdentityPicker`, sin tocar su lógica) — vive DENTRO del picker, no como acción de primer nivel.
  - **C) Otros datos** → **no implementada**: no existe hoy ningún camino de backend para editar otro dato del partido; el handoff pide explícitamente no construir arquitectura nueva solo para ofrecerla.

### §F — Anti-CTA-falso durante la ventana sin `actionsRaw`
`paintB6Actions` ya distinguía por tipo de evento real (Ronda 1); esta ronda agrega el gate de **timing**: mientras `f.actionsRaw` todavía no llegó (pintura snapshot-only de `get_my_matches`, antes de que `get_match_detail` resuelva), el banner muestra "Revisando este partido…" en vez de asumir `CONFIRMAR PARTIDO`/`ACEPTAR CORRECCIÓN` sobre un evento todavía sin clasificar. Sin spinner invasivo, sin RPC nueva (usa el mismo `get_match_detail` que ya se pedía) — el resto del Resumen se pinta normal mientras tanto.

### §G — Identidad incorrecta (sin tocar lógica cerrada)
- Cada fila de incidencia (`#b6-identity-list .b6-identity-row`) es tappable entera (click + teclado), no solo el botón RESOLVER — mismo patrón que el resto de la app.
- `buildIdentityResolveRowHTML` ahora muestra `@usuario` para candidatos registrados (antes solo el nombre) — sin pedir el avatar, que exigiría N requests nuevas.
- "REPORTAR UN ERROR → Un participante" nunca ofrece al **autor original** del partido como candidato a "no participó" (`createdByPlayerId` se excluye explícitamente del selector) — la autoría sigue existiendo como dato de trazabilidad aparte, nunca se tocó esa columna.

### §H — Historial
- Pestañas "Todos"/"Mis partidos" (`#history-tabs`) se ocultan (redundantes en el uso real de hoy) con el MISMO criterio que Ronda anterior ya usó para los chips de modo (`#history-mode-chips`, V02.1 §25): se siguen pintando/instrumentando por si hace falta reactivarlas, `historyOwnershipFilter` queda fijo en `'all'`. `HISTORY_TABS`/`PH.filterHistoryCombined`/`PH.computeHistoryTabCounts` no se tocaron — protegen compatibilidad histórica intacta.
- Como consecuencia directa de ocultar la pestaña, se desactivó también `initHistorySwipe()` (swipe horizontal que cambiaba `historyOwnershipFilter` sin ningún indicador visible ahora que la pestaña está oculta) — la función se conserva, solo se dejó de invocar.
- **Cambios externos no vistos**: nuevo mecanismo client-side.
  - `PH.computeExternalHistoryChanges(prevRows, nextRows, excludeIds)` (pura, `player-home.js`): compara dos snapshots consecutivos de `get_my_matches` y devuelve los `matchId` cuyo fingerprint (`status`, `isActionMine`, `actionSide`, `pendingCorrectionRevisionId`, `hasOpenIdentityIssue`, `validatedAt`, `hidden`, `sets`, `participants`) cambió. **Definición exacta de "cambio externo"**: un partido que YA existía en el snapshot anterior y cuyo estado observable cambió — nunca un partido recién aparecido (eso no es un cambio a algo ya conocido; si además es accionable, ya lo destaca el carrusel de Home con más fuerza).
  - `markSelfActedMatch(matchId)` + `justActedMatchIds` (app.js, guardia de un solo uso): cualquier acción propia (`afterB6Action`, y la materialización automática de incidencias vencidas) excluye ESE partido del diff del refresco inmediatamente siguiente — el propio confirmar/corregir/resolver nunca se marca como "cambio externo".
  - `refreshServerMatches()` (único choke point que ya actualizaba el cache) ahora también calcula el diff y persiste los IDs nuevos vía `Store.addHistoryUnseenChanges`.
  - Indicador: punto cian discreto (mismo token que `.notif-item--info`, nunca lima/ámbar/verde/rojo — no compite con los colores de resultado/estado) en el ícono de Historial del bottom-nav (`#history-unseen-dot`), sin número — "hay algo nuevo", no un contador.
  - "Abrir Historial = visto": `openHistoryScreen` captura el snapshot para resaltar filas (borde izquierdo cian sutil, `.history-item--unseen`, `box-shadow` inset — nunca un borde completo/blanco) y limpia el storage + apaga el punto del nav de inmediato, sin exigir abrir cada partido.
  - Sin polling ni Realtime nuevos: todo corre sobre refrescos que ya existían.

### §I — Distinción de eventos en Notificaciones
Ver Bloque de notificaciones abajo — se extendió a `identity_questioned` (actor real cuando el backend lo da) y a los 4 tipos persistidos informativos (`match_validated`/`correction_accepted`/`identity_resolved`/`identity_unidentified`).

### §J — Notificaciones (presentación + backend mínimo)
El modelo funcional (tareas derivadas vs. informativas persistidas, C-08/C-10) **no se tocó** — ya era correcto. Se trabajó presentación + un enriquecimiento de backend mínimo y aditivo:

**Auditoría del contrato actual** (leyendo las migraciones ya aplicadas, sin acceso a Staging):
- `notifications.payload` ya existía, documentado desde el origen como "quién actuó, qué cambió" — pero solo `correction_proposed` (derivada) lo llenaba con un actor real.
- `pending_review` nunca lleva actor (no tiene sentido: es sobre la propia acción pendiente del caller, no de un tercero).
- `identity_questioned` (derivada) ya joinea `match_identity_issues`, que YA tiene `opened_by_player_id` — solo faltaba proyectarlo.
- Los 4 tipos persistidos (`match_validated`/`correction_accepted`/`identity_resolved`/`identity_unidentified`) se insertan con `payload` vacío en 3 archivos de migración distintos, **pese a que el actor real ya está en una variable local usada un statement antes** para `match_actions.actor_player_id` en los 3 casos.
- `admin_action` usa `match_actions.actor_player_id = created_by_player_id` como PLACEHOLDER documentado (el actor real es texto libre en `payload.adminActorLabel`) — enriquecerlo con ese valor mostraría al creador del partido como si hubiera anulado él mismo. Se excluyó a propósito.
- `match_expired` está declarado en el `CHECK` de tipos pero **ningún camino lo inserta hoy** (verificado con grep sobre todas las migraciones) — solo existe como código de error de RPC. No se tocó (nada que enriquecer).

**Decisión**: en vez de reescribir a mano las ~500 líneas de `officialize_match_validation` (y las otras dos funciones productoras) solo para agregar una clave al payload — alto riesgo de reproducir mal un cuerpo tan grande sin poder ejecutarlo en este sandbox — se escribió un **trigger `BEFORE INSERT` sobre `notifications`**, aditivo y aislado, que enriquece `payload.actorPlayerId` desde el `match_actions.actor_player_id` más reciente del mismo `match_id`, solo para los 4 tipos donde ese actor es real. Nunca pisa una clave que el productor ya hubiera puesto. Ver migración nueva abajo.

**Frontend** (`app.js`):
- `mapB6Notification` arma copy con nombre real para `identity_questioned` (`openedByPlayerId`) y para los 4 tipos enriquecidos (`actorPlayerId`, vía `B6_NOTIF_ACTOR_BODY`), reutilizando `resolvePlayerNameFromMatchesCache` (sin llamadas de red nuevas). Si el campo todavía no llega (Staging sin la migración aplicada, o una fila anterior a ella), cae al copy genérico de siempre — **tolera ambos contratos a la vez**, como pide el handoff.
- **Nunca notificación redundante al propio actor**: `mapB6Notification` marca `selfCaused: true` únicamente cuando `payload.actorPlayerId` llegó Y coincide con el jugador actual (nunca se afirma esto sin ese dato). `b6VisibleServerNotifications()` (nuevo, único punto que traduce+filtra `b6NotificationsCache`) descarta esas filas tanto en la lista como en el badge — la propia acción ya la cubrió el toast de esa pantalla.
- "Tapping abre el partido" y "Marcar todas como leídas solo afecta informativas" ya eran correctos desde Ronda 1 (verificado por lectura de código, sin cambios).

### §K — NO TOCAR (verificado)
`git diff` revisado línea por línea: cero cambios en `main`, `bramulive/`, `Mis grupos` (`groups.js` intacto, solo su `?v=` en `index.html` por el bump general), responsive de escritorio, Realtime/polling, fórmula de Nivel (`level*.js` intactos), reglas de Ranking (`ranking.js` intacto), JUGADORES legacy/AGREGAR JUGADOR, avatar/perfil de §15.23, TU MOMENTO (se lee, nunca se modifica), Intelligence, monetización.

---

## Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `bramulab/app.js` | Carrusel de Home (render+wiring), `paintB6Actions` (gate de timing + REPORTAR UN ERROR unificado), metadata de Resumen (`buildAnalysisMetaLines`/`renderAnalysisMeta`), identidad (fila tappable, `@usuario`, exclusión de autor), Historial (tabs ocultas, swipe desactivado, cambios no vistos, `refreshServerMatches` con diff), Notificaciones (`mapB6Notification` con actor real + `selfCaused`, `b6VisibleServerNotifications`) |
| `bramulab/player-home.js` | `computeHomePendingCarouselItems` (nueva, pura), `computeExternalHistoryChanges` (nueva, pura) |
| `bramulab/store.js` | `loadHistoryUnseenChanges`/`addHistoryUnseenChanges`/`clearHistoryUnseenChanges` (nuevas); `BUNDLE_VERSION` → `04.11-h5` |
| `bramulab/styles.css` | Carrusel de Home, resultado/estado separados (Home+Historial), fix de alineación del score card, metadata del Resumen, punto de "no visto" en el nav, borde de fila no vista en Historial |
| `bramulab/index.html` | Markup del carrusel, sheet de REPORTAR UN ERROR, punto de Historial en el nav, `#analysis-meta` a `<div>`, bump de `?v=` en todos los `<script src>`/`<link>` |
| `bramulab/sw.js` | `CACHE_NAME`/`CORE_ASSETS` → `04.11-h5` |
| `bramulab/version.json` | `bundle` → `04.11-h5` |
| `bramulab/tests.html` | 16 aserciones nuevas `RONDA-UX-VIS ·` (7 para el carrusel, 9 para cambios externos) |
| `supabase/migrations/20260926120000_preprod_ux_notification_actor_enrichment.sql` | Nueva, aditiva — trigger de enriquecimiento de actor + `get_notifications` con `openedByPlayerId` |
| `supabase/tests/verify-preprod-ux-notification-actor-enrichment.sql` | Nueva — verify transaccional (BEGIN/ROLLBACK) |

---

## Migración pendiente de aplicar

**`20260926120000_preprod_ux_notification_actor_enrichment.sql`** — NO aplicada por mí (sin credenciales de Supabase en este sandbox, igual que todas las rondas anteriores). Contrato viejo → nuevo, ambos tolerados simultáneamente por el frontend:

- **Viejo**: `payload` de `match_validated`/`correction_accepted`/`identity_resolved`/`identity_unidentified` llega vacío; `identity_questioned` (derivada) no trae `openedByPlayerId`.
- **Nuevo**: esos 4 tipos ganan `payload.actorPlayerId` (trigger `BEFORE INSERT`, nunca pisa un valor que el productor ya hubiera puesto); `identity_questioned` gana `openedByPlayerId`. `admin_action` y `match_expired` quedan explícitamente afuera (ver Diagnóstico/§J arriba).
- **Impacto**: ninguna función productora existente se modificó (CREATE OR REPLACE solo en `get_notifications`, que ya se había reaplicado en la ronda anterior — mismo cuerpo + una clave). El trigger es una tabla/función nuevas, sin tocar RLS ni GRANT existentes.
- **Rollback**: `drop trigger bloque6_enrich_notification_actor on public.notifications; drop function public._bloque6_enrich_notification_actor();` y volver a aplicar la definición anterior de `get_notifications` (la de `20260921235500_bloque6_fix_notifications_ambiguity.sql`) si hiciera falta — el frontend sigue funcionando igual sin ninguna de las dos claves nuevas (fallback ya implementado).
- Verify: `supabase/tests/verify-preprod-ux-notification-actor-enrichment.sql` (6 bloques, transaccional, sin dejar fixtures).

---

## Tests

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS** (sin cambios — ninguna lógica de este alcance vive ahí).
- `bramulab/tests.html` → **1522/1522 PASS** (1506 previas + 16 nuevas `RONDA-UX-VIS ·`):
  - `computeHomePendingCarouselItems`: solo entran `pending_validation` server-backed con `isActionMine`/`actionSide` real; accionables antes que espera con orden interno preservado; `validated` nunca entra; nunca inventa "espera" sin `actionSide`; partido local nunca entra; casos vacíos/undefined.
  - `computeExternalHistoryChanges`: detecta cambio de lado (`isActionMine`/`actionSide`), detecta corrección propuesta post-validación sin cambiar `status`, detecta cambio en `sets`/`participants`; sin cambios no marca; partido nuevo nunca es "cambio"; `excludeIds` saca lo recién auto-mutado; casos vacíos/undefined.
- Boot smoke test: `index.html` con bundle `04.11-h5`, los 19 módulos versionados 200 OK, mismo único 404 preexistente (`env.generated.js`).
- Verificación visual en Browser pane (cuenta local, no server-backed — sin acceso a Staging desde este sandbox):
  - Score card del Resumen con `align-items:center` aplicado, sin regresión visible en un partido de 2 sets reales.
  - Carrusel/Historial/Home renderizan sin errores de consola tras el cambio; Historial sin pestañas Todos/Mis partidos; badge VICTORIA en verde; tarjeta de Último Partido con `--lastmatch-accent` = `--confirm-green` en una victoria real.
  - Pantalla de Notificaciones vacía renderiza sin errores (cuenta local sin notificaciones server-backed que probar).

---

## Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h4` → **`04.11-h5`** (un único bump para toda esta ronda, incluida la migración pendiente).
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, todos los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Fix de alineación del score card sin un tie break real de prueba | La carga manual (única disponible en este sandbox sin backend) no captura el score puntual del tie break — no se pudo reproducir visualmente el caso exacto reportado en QA (mezcla de celda normal + celda TB en la misma fila). El fix está justificado por mecánica de CSS Grid (`align-items:stretch` por default + celdas de distinta altura), no por reproducción pixel a pixel | Pendiente de QA visual real (Work/iPhone) contra un partido con tie break extraordinario real |
| Migración de notificaciones sin aplicar/verificar contra Staging real | El trigger y `get_notifications` están escritos y cubiertos por un verify transaccional, pero nunca corrieron contra Postgres real (sin credenciales en este sandbox, mismo motivo de todas las rondas anteriores) | Central aplica + corre el verify antes de dar por buena esta pieza |
| Carrusel/Historial "no visto" sin QA con datos server-backed reales | Verificado por lectura de código + tests puros + boot smoke; el flujo completo (dos cuentas reales, un rival actuando mientras el otro mira Historial) no se pudo ejecutar en este sandbox | Pendiente de QA física |
| Categoría "informativos/tips" del carrusel sin contenido | Decisión deliberada (ver §D arriba), no un olvido — no hay hoy una fuente real de tips temporales fuera de TU MOMENTO (NO TOCAR) | Ninguna — documentado como decisión, revisar si contradice la intención original del handoff |

---

## Decisiones abiertas

1. **Carrusel — categoría "informativos/tips" sin implementar**: el handoff pedía que el carrusel "pueda contener" 3 categorías; esta ronda solo pobló 2 (accionables/espera) porque la 3ª no tiene hoy ninguna fuente real de contenido sin inventar copy. Si central quiere esa categoría poblada, hace falta decidir PRIMERO de dónde sale ese contenido real (¿un evento nuevo? ¿reciclar algo de TU MOMENTO sin tocarlo?) — eso sí sería una decisión de producto, no de presentación.
2. **Score card — fix de alineación sin validación con tie break real**: aceptar el fix basado en análisis de CSS + QA visual pendiente, o pedir que se prioricen credenciales/acceso para reproducirlo exacto antes de dar la pieza por cerrada.

---

## Qué debe revisar ChatGPT central

1. HEAD de `staging` (diff completo + este documento).
2. Aplicar `20260926120000_preprod_ux_notification_actor_enrichment.sql` contra Staging y correr `verify-preprod-ux-notification-actor-enrichment.sql` — 6 bloques, transaccional.
3. Confirmar que el criterio de exclusión de `admin_action`/`match_expired` del enriquecimiento de actor es correcto (documentado en la propia migración y en este documento).
4. Decidir las dos Decisiones abiertas de arriba.
5. Si todo queda limpio, recién ahí decidir la validación física (iPhone/Work) — no se le pidió nada a Sebastián.
