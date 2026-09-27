# BRAMUlab — Resultado: cierre UX tras QA físico h13

**Rama:** `staging`
**Fecha:** 27/09/2026
**Bundle:** `04.11-h13` → `04.11-h14`
**Origen:** [`45_Handoff_Cierre_UX_h13_27SEP.md`](45_Handoff_Cierre_UX_h13_27SEP.md) (especificación de producto/UX) + [`46_Plan_Implementacion_Cierre_UX_h13_27SEP.md`](46_Plan_Implementacion_Cierre_UX_h13_27SEP.md) (plan técnico consolidado de Central).

No se reabrió identidad de Matu (ya cerrada), backend de validación, self-healing h11, fórmula de Nivel, Ranking ni Intelligence. No se tocó Mis grupos, BRAMUlive, `main` ni Production.

---

## Tabla 1–11 (criterios literales del documento 45)

| # | Criterio (45) | Implementado | Archivos | Test técnico | Evidencia visual propia | Desvíos |
|---|---|---|---|---|---|---|
| 1 | Nivel BRAMU — barra decimal real (5.8→~80%, 6.0→0%, 6.1→~10%; delta solo si hay evidencia real) | Sí | `app.js` (`renderPlayerCard`) | `cierre-ux-h13.test.mjs` (guarda estática: usa `PH.levelProgressPct`, nunca 100% fijo) + `PH.levelProgressPct` ya exhaustivamente testeada en `tests.html` (sin cambios) | No pude fabricar una cuenta V1 **calibrada server-backed** real en este entorno (requiere Supabase real) — no hay captura de pantalla propia de este punto puntual. Ver §"Limitaciones" | Ninguno en el criterio; limitación de entorno para la captura visual, no de implementación |
| 2 | Último partido con corrección activa: VICTORIA/DERROTA y forma NUNCA se mueven; ámbar discreto; copy corto tipo "CORRECCIÓN PENDIENTE" | Sí | `app.js` (`renderPlayerLastMatchCard`), `styles.css` (`.player-home-lastmatch__badge-slot--reserved`) | `cierre-ux-h13.test.mjs` (P0-B, 2 tests) | **Sí** — verifiqué con DOM real (mismo markup/CSS de la app) que `row2` (forma + VICTORIA/DERROTA) queda a **exactamente la misma distancia del borde superior** (40.5px) con y sin el badge de corrección; screenshot comparativo tomado en 375px | Ninguno |
| 3 | Resumen — grilla del resultado: una fila por pareja, divisor continuo, 2 y 3 sets sin deformación | Sí | `app.js` (nueva primitiva compartida `buildResultRowsHTML`), `styles.css` (`.result-card__divider-row`) | `cierre-ux-h13.test.mjs` (P0-C, 2 tests: primitiva única + divisor `grid-column:1/-1`, nunca border-top por celda) | **Sí** — armé el mismo HTML/CSS real con 2 y 3 sets y confirmé visualmente el divisor como una sola línea continua en ambos casos (mobile 375px) | Ninguno |
| 4 | Oficial vs. propuesta: rótulos centrados, misma grilla del punto 3, explicación humana como lectura principal, botones con misma altura/composición | Sí | `app.js` (`buildCorrectionHumanSummary` nuevo en `match-load.js`, `paintB6Actions`), `index.html`, `styles.css` | `cierre-ux-h13.test.mjs` (P0-D, 8 tests: 6 dinámicos contra la función pura real vía `vm`, 2 estáticos) | **Sí** — Resumen completo simulado con datos reales de ejemplo (oficial + propuesta con 3 sets, resumen humano, botones) en 375px; rótulos centrados, grilla compartida, frase humana visible como texto principal | Ninguno |
| 5 | Reportar un error: sentence case, secundario/rojo suave, sheet liviano | Ya cumplía (h11) | — | `cierre-ux-h13.test.mjs` (P1-I, guarda de regresión) | Verificado por DOM (clases/copy reales); sin cambios visuales de esta ronda porque ya cumplía | Ninguno |
| 6 | Identidad incorrecta: copy "¿Seguro que no fue [Nombre]?", flujo continuo, búsqueda canónica, "No sé · dejar Por identificar" | Sí (copy actualizado; el resto ya cumplía desde h11/h12) | `app.js` (`confirmReportIdentity`) | `cierre-ux-h13.test.mjs` (P1-J) | No requería nueva evidencia visual (solo cambio de copy sobre un flujo ya validado) | Ninguno |
| 7 | Patrón único de jugador por `player_id` en las 7 superficies enumeradas | Auditado — sin código nuevo, salvo Jugadores tab | `app.js` | `cierre-ux-h13.test.mjs` (P0-G: guarda que enumera y fija TODAS las líneas de nombre-plano hoy existentes — cualquier línea nueva fuera de esa lista hace fallar el test) | No aplica (es una auditoría, no una pantalla nueva) | Ver §"Auditoría P0-G" abajo — ninguna superficie server-backed navega por nombre plano hoy |
| 8 | Mi Perfil → Jugadores: buscador SIEMPRE visible arriba, sin pantalla puente, agregar desde el mismo espacio | Sí | `app.js` (`renderJugadoresListServerBacked` rehecha), `index.html`, `styles.css` | `cierre-ux-h13.test.mjs` (P1-H, 2 tests) | **Sí** — capturé el estado vacío (buscador visible, hint corto debajo) y el estado con resultados globales ("RESULTADOS" con fila canónica avatar+nombre+@usuario+Nivel) en 375px | Ninguno |
| 9 | Cargar partido: metadata (formato/sets/sistema/fecha/hora) ANTES de Equipo A/B, sin duplicar | Sí | `index.html` (bloque movido, no duplicado) | `cierre-ux-h13.test.mjs` (P0-E: orden en el documento + sin duplicado) | **Sí** — capturé la pantalla completa en 375px y 1440×900; metadata queda arriba, sin superposición | Ninguno |
| 10 | Historial/Resumen — sync_pending y necesita_revision comprensibles, con acción contextual (Reintentar/Elegir partido/Corregir carga/Descartar carga) | Sí | `app.js` (`retryOneOutboxEntry` nuevo, `paintB6Actions`, `handleCreateOrAttachOutcome`), `index.html` | `cierre-ux-h13.test.mjs` (P0-F, 4 tests) | No pude fabricar un borrador de outbox real con estado `necesita_revision`/`sync_pending` en este entorno sin backend — no hay captura propia. Ver §"Limitaciones" | Ver §"Desvío P0-F" abajo: la etiqueta de Historial para `necesita_revision` se mantiene "NECESITA REVISIÓN" (categoría), la explicación específica vive "al abrir" (Resumen), no en la fila compacta de la lista |
| 11 | Notificaciones en lenguaje de pádel, nunca técnico | Sí | `app.js` (`B6_NOTIF_COPY`, `B6_NOTIF_ACTOR_TITLE`) | `cierre-ux-h13.test.mjs` (P1-K, 2 tests) | No pude fabricar notificaciones reales en este entorno sin backend — no hay captura propia. Ver §"Limitaciones" | `identity_questioned` nunca nombra al jugador cuestionado (el payload real solo trae `team`/`positionInTeam`, no nombre — ver comentario en el código); se usa la formulación neutra que el propio handoff autoriza para este caso exacto |

---

## Auditoría P0-G (patrón único de jugador)

Se revisaron las 7 superficies del §7 del documento 45. Estado real encontrado (sin cambios de código salvo Jugadores, que ya se cubre en el punto 8):

- **Buscar jugadores** (server-backed): ya resuelve por `player_id` real (`search_players`), referencia correcta.
- **Selector compañero/rival** (Elegir jugador en Cargar partido, server-backed): ya guarda `{playerId, kind}` por slot, nunca por nombre.
- **Reemplazo de identidad**: ya usa `buildProvisionalRowHTML`/`buildPlayerRowHTMLFromServerRow` (unificado en la ronda h11).
- **Compañeros / Rivales**: ya resuelven por `player_id` vía `Auth.getPlayersCompact` (unificado en la ronda h11).
- **Mis Jugadores**: ya usaba `player_id` real (`list_saved_players`); esta ronda además agrega búsqueda global sin tocar la resolución de identidad.
- **Perfil público**: es el destino común, ya server-backed por `player_id`.

Las únicas líneas de `openPlayerPublicProfile(nombrePlano, ...)` que quedan en el código son:

1. la propia declaración de la función;
2. Mis Grupos (`'groups'`) — explícitamente fuera de alcance de esta ronda;
3. las 3 ramas LOCAL/LEGACY (sin backend configurado) de Jugadores/Buscar Jugadores — cada una gateada por `if (user && user.serverBacked) return;` antes de esa línea, código muerto en la práctica en Staging/Production.

El nuevo test `cierre-ux-h13.test.mjs` (P0-G) fija esta lista exacta como guarda de regresión — cualquier línea nueva de nombre-plano fuera de esa lista hará fallar la suite.

## Desvío P0-F (Historial — etiqueta de `necesita_revision`)

El documento 45 pide "Historial debe usar una etiqueta que represente el estado real... para revisión, un copy específico, no solo NECESITA REVISIÓN sin explicación **al abrir**". Se interpretó literalmente: la ETIQUETA compacta de la fila de Historial permanece "NECESITA REVISIÓN" (categoría del estado, espacio limitado para el motivo específico — que además varía por partido), y la explicación específica real (`lastError.code` mapeado a un mensaje humano) se agregó donde el handoff dice que faltaba: **al abrir** el Resumen del partido. No se consideró necesario ni se intentó variar el texto de la fila compacta de Historial por partido, para no arriesgar una segunda fuente de verdad de copy divergente de la de Resumen.

---

## Limitaciones de la revisión visual (honestas, según lo pedido)

Este entorno no tiene una sesión real de Supabase Staging ni credenciales — no puedo fabricar de forma fiable: una cuenta V1 **calibrada** real (punto 1), un borrador de outbox real en `sync_pending`/`necesita_revision` (punto 10), ni notificaciones reales del servidor (punto 11). Para esos tres puntos hice:

- verificación técnica completa (tests dinámicos/estáticos contra el código real, sin mocks de comportamiento);
- inspección de código línea por línea contra el criterio literal del handoff;
- pero **no** una captura de pantalla propia del componente renderizado con datos reales.

Para los puntos 2, 3, 4, 8 y 9 **sí pude hacer inspección visual real** (DOM/CSS reales de la app, en viewport ~375×812 y ~1440×900), incluyendo una medición geométrica exacta para el punto 2 (invariancia de posición confirmada en píxeles, no solo "se ve bien").

**No declaro esta ronda apta para Laboratorio.** Los puntos 1, 10 y 11 necesitan revisión visual real de Central (o de Sebastián) contra Staging antes de esa determinación, tal como exige el documento 45 §13.

---

## Tests

- **Nuevo:** `bramulab/cierre-ux-h13.test.mjs` — 24 tests (guardas estáticas sobre `app.js`/`index.html`/`styles.css` reales + 6 dinámicos contra `ML.buildCorrectionHumanSummary`, función pura real vía `vm`, sin mocks).
- **Suite Node completa:** `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs supabase/scripts/*.test.mjs` → **349/349 OK** (325 previas + 24 nuevas).
- **`tests.html`:** **1564/1564 OK — todo verde**, sin cambios (ninguna función pura existente se modificó; `buildCorrectionHumanSummary` es aditiva).
- **Smoke boot de `index.html`:** sin errores de consola nuevos (el único 404, `env.generated.js`, es el artefacto de build ya documentado); `PLStore.BUNDLE_VERSION === '04.11-h14'`.

---

## Bundle, commit y deploy

- **Bundle:** `04.11-h13` → `04.11-h14` (h13 ya estaba desplegado, cuarteto completo bumpeado para invalidar cache).
- **Commit:** único, lógico, con el detalle de los 11 puntos en el mensaje.
- **Push:** `origin/staging`.
- **Deploy:** Vercel Staging — un único deploy intencional.

---

## Riesgos residuales reales

- Los puntos 1/10/11 quedan con verificación técnica completa pero sin captura visual propia (ver limitaciones arriba) — es el riesgo más real de esta ronda.
- La invariancia geométrica del punto 2 se reservó (`--reserved`) solo para partidos `status==='validated'`; otros estados (`pending_validation`, etc.) mantienen su comportamiento anterior sin cambios, ya que nunca alternan entre "con badge" y "sin badge" para el mismo partido.
- El residual ya documentado por Central en `44_Revision_Central_Final_h13_27SEP.md` (badge de Historial sin chequear la ventana de 3 días) sigue existiendo, sin empeorar ni mejorar en esta ronda — fuera de alcance explícito.

Ningún cambio de esta ronda tocó tablas/RPCs de Supabase — todo el trabajo fue frontend (`bramulab/`).

---

**PENDIENTE DE GATE CENTRAL TÉCNICO + VISUAL**
