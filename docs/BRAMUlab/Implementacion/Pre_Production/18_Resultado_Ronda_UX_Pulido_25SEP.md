# BRAMUlab — Resultado · Ronda UX 25/09, Ronda 3 (pulido final)

**Rama:** `staging`
**Fecha:** 26/09/2026
**HEAD base (aprobado por central):** `0acf37d`
**Handoff de origen:** `13_Handoff_Implementacion_Ronda_UX_25SEP.md` §O (headers/blur), §P (Intelligence), §Q (TU MOMENTO), §4 (JUGADORES)

Central confirmó sobre Staging real: migración `preprod_ux_notification_actor_enrichment` aplicada, verify transaccional PASS, 0 fixtures remanentes, permisos `get_notifications` correctos, trigger activo, Vercel verde, 19/19 assets PWA en `04.11-h5`. Ronda 1 (funcional) y Ronda 2 (jerarquía visual) quedan **cerradas** — esta ronda no las reabrió salvo lo que se detalla abajo, y solo donde esta misma ronda podía provocar una regresión directa.

---

## Diagnóstico

Los 4 puntos de este bloque son de "pulido barato" — ninguno tocó backend, arquitectura ni reglas de negocio. Cada uno resultó ser un bug real y acotado, no una percepción:

1. **Header/blur**: los 3 headers de la app (`.analysis-header`/`.player-home-header`/`.court-header`) nunca tuvieron fondo propio — dejaban pasar el degradé de toda la vista (`--bg-gradient-app`, `--surface-1` en 0% → `--bg` recién al 40% de la altura de PANTALLA) exactamente por donde vive el logo/título, en el tramo donde ese degradé todavía está transicionando.
2. **TU MOMENTO**: 2 de los 3 mensajes de "sin señal fuerte" decían literalmente "ya cargaste" un partido, atribuyendo la carga al usuario sin evidencia — en un partido server-backed cualquiera de los 4 participantes pudo haberlo cargado.
3. **BRAMU Intelligence**: "Por qué aparece" se repetía como `<details>` independiente debajo de cada insight (hasta 3 veces: principal + 2 secundarios).
4. **JUGADORES server-backed**: la pestaña seguía resolviendo identidad **por nombre** de punta a punta (`Store.loadAddedPlayers`/`openPlayerPublicProfile(name, ...)` sin `player_id`) — un usuario server-backed que tocara una fila caía al perfil público LEGACY por nombre, la misma regresión de identidad que Backend Bloque 4 vino a corregir.

---

## Qué se hizo

### §O — Header / blur superior

Patrón transversal único (CSS, sin tocar HTML): `.analysis-header, .player-home-header, .court-header` ganan su propio degradé corto (`linear-gradient(180deg, var(--court-surface) 0%, var(--court-bg) 100%)`), **contenido enteramente dentro de su propia altura** — nunca se extiende al resto de la vista — más `position:relative; z-index:2` para stacking explícito.

Se reutilizan `--court-surface`/`--court-bg` (alias globales ya existentes de `--surface-1`/`--bg`, definidos en `:root` y redefinidos localmente un escalón más claro dentro de `.view--court`) en vez de hardcodear tokens: la MISMA regla resuelve correctamente el tono normal en Historial/Resumen/Perfil/Notificaciones/Home y el tono "cancha" un escalón más claro en Carga partido/Confirmar partido, sin duplicar valores ni crear paleta nueva. Padding y color de borde de cada header no se tocaron (`--line` vs. `--court-line` siguen intencionalmente distintos).

Verificado visualmente (viewport móvil 375×812) en las 6 pantallas pedidas: Home, Cargar partido, Historial, Perfil, Notificaciones (Resumen comparte `.analysis-header`, mismo componente ya cubierto). Sin saltos de layout, sin tocar `--safe-top`, sin tocar responsive de escritorio.

### §Q — TU MOMENTO

Auditados los 5 mensajes posibles de `PH.buildTuMomentoText` (0 partidos, 1 partido, 2 partidos, ≥3 con clausulas, ≥3 sin señal). 2 tenían el bug real:

| Antes | Ahora |
|---|---|
| `Tu historia recién empieza: ya cargaste tu primer partido. Seguí sumando resultados para descubrir patrones.` | `Tu primer partido ya forma parte de tu historia. Seguí sumando resultados para descubrir patrones.` |
| `Ya cargaste ${n} partidos. Tu historia se sigue construyendo, partido a partido.` | `Ya tenés ${n} partidos en tu historia. Se sigue construyendo, partido a partido.` |

Los otros 3 (`0 partidos`, `2 partidos`, y las cláusulas de forma reciente/compañero/actividad de `≥3`) ya eran correctos — describen la propia PARTICIPACIÓN del usuario (jugó, ganó) o son un CTA hacia el futuro ("Cargá tu primer partido"/"Seguí cargando partidos"), nunca una afirmación de autoría pasada — no se tocaron, tal como pide el handoff ("si alguno ya es correcto, no tocarlo").

No se tocó lógica de Ranking/Nivel, cuándo aparece TU MOMENTO, ni se agregó ninguna tarjeta nueva — cambio puramente de copy en 2 strings.

### §P — BRAMU Intelligence, "Por qué aparece"

`buildIntelligenceInsightHTML` deja de renderizar un `<details>` por insight. Nueva `buildIntelligenceWhyGroupHTML(insights)` arma **un único** `<details>` al final de la tarjeta ("POR QUÉ APARECEN ESTOS INSIGHTS"), listando la evidencia real (`insight.why`) de cada insight bajo su propio `insight.body` como etiqueta (siempre presente, a diferencia de `title` que solo trae el principal) — nunca fabrica un texto nuevo, reutiliza exactamente los mismos datos que el servidor ya calculó y devolvió.

Cero cambios en `intelligence-presentation.js` (claims, lógica, condiciones de aparición, cálculos) — confirmado con `node --test intelligence-presentation.test.mjs` (50/50 PASS, sin tocar). Verificado visualmente inyectando HTML de prueba con la estructura real (principal + secundario): un solo toggle, evidencia de ambos insights agrupada y legible al expandir.

### §4 — JUGADORES server-backed

Investigado el camino completo antes de decidir: `renderJugadoresList` arma filas desde `Store.loadAddedPlayers(user.id)` (lista histórica por NOMBRE) y cada click llama `openPlayerPublicProfile(btn.dataset.name, 'jugadores-tab')` — un **string plano**, nunca un `{name, playerId}`. `renderPlayerPublicProfile()` solo entra al camino server-backed cuando `playerPublicPlayerId` es real; sin él, cae al camino LOCAL/legacy que resuelve por nombre — exactamente la regresión de identidad que Bloque 4 corrigió, y la misma razón documentada por la que `AGREGAR JUGADOR` ya está oculto en el perfil público server-backed (`renderPlayerPublicProfileServerBacked`, sin cambios).

No existe hoy una infraestructura server-backed mínima por `player_id` para "jugadores agregados por mí" — construirla sería abrir un sistema social/follow nuevo, expresamente fuera de alcance. Se aplicó la recomendación del handoff: **la pestaña JUGADORES se oculta para cuentas server-backed** (`#profile-tab-jugadores.hidden = true`), con reset defensivo a MI PERFIL si el usuario ya estuviera parado en esa pestaña. El camino local/legacy (`Store.addPlayerToList`, `renderJugadoresTab`, `renderJugadoresList`, todo el markup) queda **intacto, sin una sola línea tocada** — nada se eliminó, `AGREGAR JUGADOR` legacy no se reactivó en ningún lado.

Verificado en vivo simulando `user.serverBacked = true` sobre la cuenta de prueba local (sin acceso a Supabase real en este sandbox): la pestaña desaparece, las 2 restantes (MI PERFIL/MIS DATOS) reflowean limpio a 50/50 sin romper layout; revertido a `false`, la cuenta local/legacy vuelve a mostrar las 3 pestañas exactamente como antes.

---

## Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `bramulab/app.js` | `buildIntelligenceInsightHTML`/`buildIntelligenceWhyGroupHTML`/`buildIntelligenceCardHTML` (Intelligence agrupada); `renderProfileView` oculta `#profile-tab-jugadores` para cuentas server-backed |
| `bramulab/player-home.js` | `buildTuMomentoText` — 2 strings sin atribución de carga |
| `bramulab/styles.css` | patrón transversal de header (`.analysis-header, .player-home-header, .court-header`); `.intelligence-why--grouped`/`.intelligence-why__list` |
| `bramulab/tests.html` | 2 aserciones `RONDA-UX-PUL ·` nuevas + 1 aserción existente actualizada al nuevo copy de TU MOMENTO |
| `bramulab/store.js` | `BUNDLE_VERSION` → `04.11-h6` |
| `bramulab/sw.js` | `CACHE_NAME`/`CORE_ASSETS` → `04.11-h6` |
| `bramulab/version.json` | `bundle` → `04.11-h6` |
| `bramulab/index.html` | bump de `?v=` en todos los `<script src>`/`<link>` |

Sin cambios en `supabase/` — ninguna migración nueva esta ronda (no hizo falta: los 4 puntos se resolvieron con CSS/copy/orquestación de frontend). Sin cambios en `main`, Production, BRAMUlive, Mis grupos, responsive de escritorio, Realtime/polling, backend/fórmula de Nivel, reglas de Ranking, flujos de corrección, identidad provisional/claim, P0.3, legal/privacidad, monetización/publicidad.

---

## Decisiones de implementación

- **Header**: se prefirió un degradé corto CONTENIDO en el propio header (reutilizando `--court-surface`/`--court-bg`, ya existentes) en vez de un fondo plano/sólido — mantiene la sensación de profundidad que ya tenía la app, sin dejar que el degradé de toda la pantalla atraviese el logo/título.
- **JUGADORES**: se descartó cualquier intento de "arreglar" la resolución por nombre pasando un `player_id` real — eso exigiría que `Store.loadAddedPlayers` supiera asociar cada nombre a un `player_id`, lo cual no existe hoy y equivaldría a construir la infraestructura server-backed que el handoff pide explícitamente NO construir esta ronda. Ocultar la pestaña es la única opción que no inventa arquitectura ni dejaba una promesa incumplible visible.
- **Intelligence**: se usó `insight.body` (no `insight.title`, que falta en los secundarios) como etiqueta de cada evidencia agrupada — la única propiedad garantizada en los 3 insights posibles, sin fabricar un texto nuevo.

---

## Qué NO se tocó

- Bug menor de subida de foto de perfil (§6 del handoff, "No pudimos guardar la foto"): no se investigó — no apareció naturalmente al tocar JUGADORES/Perfil, y el handoff pide explícitamente no abrir una investigación grande por esto dentro de esta ronda. Sigue pendiente de una reproducción dirigida posterior.
- Observaciones §15.23 (avatar en resultados de búsqueda, datos de Perfil QA, persistencia mano/lado/edad/género/ubicación, AGREGAR JUGADOR real, responsive): no se mezclaron, quedan para la próxima vuelta de Laboratorio, tal como indica el handoff.
- Ninguna migración nueva — no fue necesaria.

---

## Tests

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS** (sin cambios — ninguna lógica de este alcance vive ahí; incluye `intelligence-presentation.test.mjs` 50/50, confirmando que Intelligence no cambió claims/lógica).
- `bramulab/tests.html` → **1524/1524 PASS** (1522 previas + 2 nuevas `RONDA-UX-PUL ·`, más 1 aserción existente actualizada):
  - "Tu momento" con 1 partido nunca contiene "cargaste"/"cargó".
  - "Tu momento" sin patrón valioso (fallback ≥3) nunca contiene "cargaste"/"cargó".
- Boot smoke test: `index.html` con bundle `04.11-h6`, los 19 módulos versionados 200 OK, mismo único 404 preexistente (`env.generated.js`, esperado sin Supabase configurado en este entorno local).
- Verificación visual dirigida (Browser pane, viewport móvil):
  - Header sin degradé invadiendo logo/título en Home, Cargar partido, Historial, Perfil, Notificaciones — sin saltos de layout.
  - TU MOMENTO con 0/1 partido muestra el copy nuevo correctamente.
  - Intelligence agrupada: HTML de prueba con estructura real (principal+secundario) renderiza un solo toggle, evidencia completa y legible al expandir.
  - JUGADORES: simulando `serverBacked=true` sobre la cuenta de prueba, la pestaña desaparece y las 2 restantes reflowean limpio; revertido, la cuenta local/legacy sigue mostrando las 3 pestañas sin cambios.
  - Regresión mínima: Home/Historial/Perfil/Notificaciones renderizan sin errores de consola nuevos en las 6+ navegaciones realizadas.

No se hizo QA manual real de todos los escenarios — se cubrieron los riesgos concretos pedidos por el handoff.

---

## Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h5` → **`04.11-h6`** (único bump de esta ronda).
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, todos los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Header/blur sin QA en iOS Safari PWA real | El fix se razonó a partir del CSS existente (degradé de página completa atravesando el header) — el reporte original vino de uso real en iPhone, que este sandbox (Chromium) no puede reproducir 1:1 | Pendiente de QA visual real (Work/iPhone) para confirmar que el fix resuelve exactamente lo reportado |
| JUGADORES oculto sin cuenta server-backed real para probar | Verificado simulando `serverBacked=true` sobre una cuenta local (mismo mecanismo de render, sin RPCs de por medio) — el camino real con Auth/Supabase configurado no se ejecutó en este sandbox | Pendiente de confirmación en Staging real con una cuenta server-backed genuina |
| Cuenta server-backed con entradas LEGACY previas en JUGADORES | Si una cuenta se volvió server-backed DESPUÉS de haber agregado jugadores por nombre (antes de que `AGREGAR JUGADOR` se ocultara), esos datos siguen en `Store.loadAddedPlayers` — ahora simplemente inaccesibles vía UI (la pestaña que los mostraba está oculta), nunca se corrompen ni se borran | Aceptado: ocultar es reversible y no destructivo: si más adelante se construye la migración real a `player_id`, esos nombres siguen ahí para migrarlos si corresponde |

---

## Decisiones abiertas

Ninguna decisión de producto nueva — los 4 puntos se resolvieron dentro del criterio ya dado por el handoff.

---

## Ronda UX 25SEP — estado final

**Rondas 1, 2 y 3 técnicamente completadas.**

- Ronda 1 (funcional/estado): cerrada, commit `3dee37f`/`374793a`.
- Ronda 2 (jerarquía visual): cerrada, commit `0acf37d`, migración de notificaciones aplicada y verificada en Staging.
- Ronda 3 (pulido final): esta entrega.

Lo único pendiente de todo el paquete es QA física real (Work/iPhone) sobre el bundle `04.11-h6` completo — ningún punto del handoff 13 quedó sin abordar o marcado como bloqueado técnicamente.

---

## Qué debe revisar Central

1. HEAD de `staging` (diff completo + este documento).
2. Confirmar visualmente (Work/iPhone) que el fix de header/blur resuelve lo reportado originalmente en Home y Cargar partido.
3. Confirmar con una cuenta server-backed real que JUGADORES queda oculto y que ningún otro punto de entrada (deep link, notificación, etc.) puede reabrirlo.
4. Si todo queda limpio, decidir si corresponde volver a Laboratorio UX real para el paquete completo `04.11-h6`, tal como anticipa el handoff de esta ronda.
