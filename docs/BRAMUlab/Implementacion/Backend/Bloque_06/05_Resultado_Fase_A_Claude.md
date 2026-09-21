# Backend Bloque 6 — Resultado de Fase A (Claude Code)

**Fecha:** 21/09/2026
**Rama:** `staging`
**Depende de:** `02_Analisis_Claude.md`, `03_Plan_Implementacion_Claude.md`, `04_Revision_ChatGPT.md`
**Estado:** código completo en `staging`. **NO aplicado a Supabase real, NO desplegado.** Fase central debe revisar, aplicar migraciones y desplegar Edge Functions.

---

## 1. Alcance ejecutado

Los 10 checkpoints internos del plan (§5 de `03_Plan_Implementacion_Claude.md`) se completaron en una sola pasada, sin detenerse a pedir aprobación entre ellos — no apareció ninguna decisión abierta nueva y material, ningún bloqueo técnico real, ni ninguna acción que requiriera autorización sensible fuera del alcance ya dado.

---

## 2. Archivos creados

### Migraciones SQL (orden de aplicación)

1. `supabase/migrations/20260921200000_bloque6_level_state_evidence.sql` — `evidence_units`/`confidence_origin` en `level_states`; toque mínimo a `officialize_level_onboarding`.
2. `supabase/migrations/20260921203000_bloque6_match_level_results.sql` — `match_level_results` (cabecera) + `match_level_result_players` (por jugador conocido), normalizadas.
3. `supabase/migrations/20260921210000_bloque6_identity_and_matches_schema.sql` — `matches.pending_correction_revision_id`; extensión de los CHECK de `match_actions.action_type`/`level_events.event_type`; `level_events.match_id`/`match_level_result_id`; tabla `match_identity_issues`.
4. `supabase/migrations/20260921213000_bloque6_notifications.sql` — tabla `notifications` + `get_notifications`/`mark_notification_read`/`mark_all_notifications_read`.
5. `supabase/migrations/20260921220000_bloque6_read_rpcs.sql` — `get_match_officialization_snapshot`, `get_player_match_history_for_level_engine`, `get_player_level_state_as_of`; extensión de `get_my_matches`/`get_match_detail`.
6. `supabase/migrations/20260921223000_bloque6_officialize_rpc.sql` — `officialize_match_validation` (núcleo atómico).
7. `supabase/migrations/20260921230000_bloque6_correction_and_identity_rpcs.sql` — `_bloque6_revert_applied_result` (interno), `propose_post_validation_correction`, `respond_post_validation_correction`, `report_identity_issue`, `resolve_identity_issue`.
8. `supabase/migrations/20260921233000_bloque6_admin_rpcs.sql` — `admin_annul_match`, `admin_force_resolve_identity_issue`.

### Motor JS compartido (pure, cero DOM/localStorage — mismo criterio que `level.js`/`level-context.js`)

- `bramulab/match-level-engine.js` — Etapa C de Nivel BRAMU: ventana de 30 días (Decisión Abierta #1 resuelta), mapeo de estados, referencia sintética para slots no identificados + saneamiento antes de tocar el motor, y el cálculo de diferencia neta entre un resultado anterior y uno nuevo (revert+reapply). Expone `computeOfficializationResult`/`computeLevelStateUpdates` como único punto de entrada.
- `bramulab/match-level-engine.test.mjs` — 17 pruebas locales (`node --test`), incluida la pipeline completa `match-sync.js → match-level-engine.js → level-context.js → level.js` con filas con forma real `get_my_matches`.

### Símlinks nuevos (mismo mecanismo que los 4 ya existentes en Bloques 3/5)

- `supabase/functions/_shared/level-context.js` → `bramulab/level-context.js`
- `supabase/functions/_shared/match-sync.js` → `bramulab/match-sync.js`
- `supabase/functions/_shared/match-level-engine.js` → `bramulab/match-level-engine.js`

### Deno / Edge Functions

- `supabase/functions/_shared/match-officialize-core.ts` — rutina compartida única (fetch snapshot + historial, adaptación vía `match-sync.js`, cálculo vía `match-level-engine.js`/`level-context.js`, escritura con reintento acotado ante `stale_level_snapshot`). Importada, nunca llamada por HTTP.
- `supabase/functions/officialize-match/index.ts` — "Confirmar" explícito.
- `supabase/functions/propose-match-correction/index.ts` — "Proponer corrección" post-validación.
- `supabase/functions/respond-match-correction/index.ts` — aceptar/rechazar la corrección propuesta.
- `supabase/functions/resolve-identity-issue/index.ts` — resolver o vencer una incidencia de identidad.

### Tests

- `supabase/tests/verify-bloque6.mjs` — script de verificación real contra Staging, mismo patrón que `verify-bloque{2,3,4,5}.mjs`. **Entregado sin ejecutar** (sin autorización para tocar Supabase real esta ronda).

## 3. Archivos modificados

- `supabase/functions/create-or-attach-match/index.ts` — agregado acotado de 23 líneas al final: cuando el resultado trae `readyForValidation: true`, importa e invoca la rutina compartida de oficialización antes de responder. **La lógica de deduplicación/concurrencia/idempotencia de Bloque 5 no se tocó.**
- `docs/BRAMUlab/Implementacion/Backend/Bloque_06/02_Analisis_Claude.md` — actualizado para reflejar `04_Revision_ChatGPT.md` (ver commit previo a esta ronda).
- `docs/BRAMUlab/Implementacion/Backend/Bloque_06/03_Plan_Implementacion_Claude.md` — ídem.

---

## 4. Cómo quedaron resueltos los 9 ajustes obligatorios de `04_Revision_ChatGPT.md`

1. **Ventana de 30 días** — `match-level-engine.js#isWithinNivelWindow` + `officialize_match_validation.eligible`: un partido validado más de 30 días después de `played_at` queda oficial en historial/estadísticas (`matches.status='validated'`) pero sin fila en `match_level_result_players` — `match_level_results.eligible=false` con `reasonCode='fuera_de_ventana_30_dias_desde_partido'` documenta por qué.
2. **Reversión de partido completo** — `report_identity_issue` llama a `_bloque6_revert_applied_result(match_id)`, que revierte los 4 jugadores conocidos del resultado vigente, nunca solo el del slot cuestionado.
3. **Snapshot histórico al resolver identidad** — `get_player_level_state_as_of` reconstruye con orden determinístico `(created_at, event_id)`; `match-officialize-core.ts` lo usa exclusivamente para un jugador SIN fila previa en `priorSnapshots` de este partido (uno que ya tenía fila previa siempre reutiliza esa fila, inmutable a través de correcciones).
4. **Vencimiento de identidad sin resolver** — `resolve_identity_issue(force_unidentified=true)` materializa `status='unidentified'` de forma idempotente (rechaza si la ventana de 7 días todavía no venció) y, si `needsRecompute`, la Edge Function reaplica el partido completo tratando ese slot como invitado sin nivel conocido (mismo motor, sin regla nueva).
5. **Hide no afecta lo computable** — confirmado en el análisis: `get_my_matches`/`get_match_detail` extendidas no tocan el filtro de `hidden` existente; ninguna RPC nueva de Bloque 6 lo introduce. La separación display/computable sigue siendo exclusivamente `buildDisplayHistory`/`buildComputableHistory` (`match-sync.js`, Bloque 5), sin cambios.
6. **Reutilización antes que vía nueva** — no se agregó `p_only_validated` ni ninguna RPC de estadísticas: `buildComputableHistory` ya wireada en `app.js` empieza a incluir partidos `validated` automáticamente en cuanto `officialize_match_validation` corre.
7. **Corrección bloqueada con identidad abierta** — `propose_post_validation_correction` rechaza con `identity_issue_open` si existe una fila `open` en `match_identity_issues` para ese `match_id`.
8. **Expiraciones/notificaciones lazy** — sin cron en ningún lado: expiración de corrección (`respond_post_validation_correction`) y de identidad (`resolve_identity_issue force_unidentified`) se materializan en la primera acción posterior al vencimiento; notificaciones se escriben inline dentro de la misma transacción de la RPC de negocio que las origina (mismo patrón que `pilot_events`).
9. **Admin para agentes autorizados** — `admin_annul_match`/`admin_force_resolve_identity_issue` son `service_role`-only, pensadas para invocarse desde un script/agente autorizado (mismo patrón que `verify-*.mjs`), nunca desde la app ni pidiéndole a Sebastián que maneje la `service role key`.

---

## 5. Diseño técnico no anticipado en el plan (surgido durante la implementación)

Ninguno de estos cambia ninguna regla de producto ni reabre Bloques 1–5 — son refinamientos técnicos dentro del alcance ya aprobado, documentados acá por transparencia:

- **`match_level_results`/`match_level_result_players` quedó normalizada** (cabecera + tabla hija), no como un único `jsonb`, específicamente para poder derivar `rated_matches`/`distinct_opponents` por `COUNT` directo (recalculado en cada oficialización) en vez de un contador incremental que podría desincronizarse con una reversión.
- **`level_states.evidence_units`/`confidence_origin`** se agregaron (no estaban en el plan explícitamente, sí en el análisis como Riesgo 6) porque son indispensables para que revertir/reaplicar `confidence` sea una diferencia neta EXACTA — igual que `mu` — en vez de una aproximación. `confidence` sigue sin recalcularse jamás en SQL: la Edge Function la computa con `Level.computeConfidenceFromEvidence` y la RPC solo la persiste.
- **Reutilización de `match-sync.js` (Bloque 5) para adaptar filas server → forma local del motor**, en vez de escribir un adaptador nuevo desde cero — reduce significativamente el Riesgo 1 del análisis. Se sumó `sanitizeUnidentifiedPlayers` (nuevo, en `match-level-engine.js`) porque `match-sync.js` copia el `displayName` tal cual, y un slot no identificado siempre tiene el mismo string compartido (`'Por identificar'`) en `match_participants` — sin sanear, dos slots sin identidad de partidos distintos podrían agruparse como "la misma persona" en la lógica de repetición/círculo de `level-context.js`. Cubierto con test dedicado.
- **`officialize_match_validation` no recibe deltas a aplicar, recibe valores finales absolutos** (`finalMu`/`finalConfidence`/`finalEvidenceUnits` ya calculados por `computeLevelStateUpdates` en JS) — la RPC solo verifica optimistamente que el estado actual coincida con lo que el cálculo asumió, y escribe. Evita cualquier aritmética de negocio en SQL, incluso la resta simple de un delta.
- **`officialize-match` (Edge Function) también sabe registrar la conformidad del caller** vía `create_or_attach_match` cuando el turno todavía es suyo (no solo cuando `action_side` ya es `NULL`) — así "Confirmar" funciona como botón único sin que el cliente tenga que reenviar el score manualmente.

---

## 6. Verificación local ejecutada

| Verificación | Resultado |
|---|---|
| `node --check` en los 6 archivos `.ts` nuevos/tocados | Sin errores de sintaxis (revisión manual línea por línea además, sin Deno CLI disponible en este entorno para type-check real — ver limitación §7) |
| `node --check` en todos los `bramulab/*.js` (9 archivos, incluido el nuevo) | Sin errores |
| `node --test bramulab/match-level-engine.test.mjs` | **17/17 OK** — incluye ventana de 30/44 días, mapeo de estados, diferencia neta (alta inicial/corrección/identidad), invitados nunca reciben delta, saneamiento de slots no identificados |
| `node --test` regresión (`env-guard.test.mjs` + `health.test.mjs` + `match-level-engine.test.mjs`) | **34/34 OK** |
| Suite de navegador (`tests.html`, servidor local ya corriendo) | **1448/1448 OK — todo verde**, mismo baseline exacto del cierre de Bloque 5, 0 errores de consola. Ningún archivo existente fue tocado en su lógica — la suite no ejercita ningún módulo nuevo de Bloque 6 todavía (eso llega con los tests de Bloque 6 en `tests.html`, fuera de esta ronda por decisión de foco: los módulos nuevos ya están cubiertos por `match-level-engine.test.mjs`) |

## 7. Qué NO se verificó esta ronda (limitación explícita, no oculta)

- **`supabase/tests/verify-bloque6.mjs` no se ejecutó** — necesita `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` reales de Staging y las 8 migraciones + 4 Edge Functions nuevas ya aplicadas/desplegadas, ninguna de las dos cosas autorizada esta ronda.
- **Las migraciones SQL no se aplicaron contra ningún Postgres real** (ni Staging ni local) — no hay `psql`/Supabase CLI local en este entorno para un dry-run. La revisión de SQL fue manual: coherencia de columnas entre `CREATE TABLE`/`INSERT`/`SELECT`, consistencia de tipos entre cada `CREATE FUNCTION` y su `REVOKE`/`GRANT`, valores de `CHECK` usados vs. declarados. Fase central debe tratar la primera aplicación en Staging como la verificación real de sintaxis SQL.
- **Los 4 archivos `.ts` no pasaron por un compilador/linter de Deno** (no disponible en este entorno) — se revisaron manualmente contra el patrón exacto de `officialize-onboarding`/`create-or-attach-match` (Bloques 3/5) ya desplegados y funcionando.

---

## 8. DECISIONES ABIERTAS nuevas encontradas durante la implementación

**Ninguna material.** Un par de decisiones de implementación NO elevadas a "decisión abierta" (narrow, técnicas, reversibles sin costo de producto, documentadas en el código):

- **Estado `CALIBRADO` es monotónico**: una suspensión temporal de Nivel (incidencia de identidad abierta) que baje `rated_matches`/`distinct_opponents` por debajo de 5/3 nunca hace retroceder `status` de `CALIBRADO` a `CALIBRANDO`. Justificación en el código (`officialize_match_validation`/`_bloque6_revert_applied_result`): evita parpadeo de UI y es consistente con "calibrado no significa permanente" referido a evolución continua, no a reversibilidad del badge.
- **Un rival invitado nunca cuenta como "rival distinto"** para `distinct_opponents`: solo un jugador con fila propia en `match_level_result_players` (conocido) cuenta — no hay identidad persistente contra la cual comparar "distinto" para un invitado.
- **Corrección post-validación de Bloque 6 queda acotada a resultado/sets**, nunca fecha ni participantes — un cambio de participante post-validación pasa exclusivamente por la incidencia de identidad, nunca por `propose_post_validation_correction`. Separación de responsabilidades ya implícita en cómo el propio handoff distingue §6.4 de §6.5.

Si Fase central no está de acuerdo con alguno de estos tres, son cambios acotados (no reabren el diseño general).

---

## 9. Confirmación de alcance

No se tocó Supabase real, Vercel, `main`, Production ni BRAMUlive. No se implementó Ranking ni Intelligence. No se hizo la pasada de UI/UX de las acciones en navegador (Fase B, explícitamente fuera de esta ronda) — `bramulab/app.js`, `index.html` y `styles.css` no fueron modificados.

---

*Fin de Fase A. Pendiente: revisión de Fase central, aplicación de migraciones y despliegue de Edge Functions en Staging, `verify-bloque6.mjs` real, y recién después Fase B (frontend/wiring).*
