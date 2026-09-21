# Backend Bloque 6 — Correcciones de Fase A (Claude Code)

**Fecha:** 21/09/2026
**Rama:** `staging`
**Depende de:** `05_Resultado_Fase_A_Claude.md`, `06_Revision_Fase_A_ChatGPT.md`
**Estado:** los 13 bloqueantes/consistencia de `06_Revision_Fase_A_ChatGPT.md` corregidos en las migraciones/módulos originales de Fase A (no se agregaron migraciones parche — ninguna se había aplicado a Supabase real todavía). **NO aplicado a Supabase real, NO desplegado.**

---

## 1. Corrección por punto

### B6-A-01 — `level_events` NOT NULL

`supabase/migrations/20260921210000_bloque6_identity_and_matches_schema.sql`: `questionnaire_version`/`questionnaire_mode` pasan a nullable (`alter column ... drop not null`), con un CHECK nuevo (`level_events_questionnaire_required_for_initial_estimate`) que preserva la obligatoriedad exclusivamente para `event_type='initial_estimate'`.

### B6-A-02 — parámetros JSONB como string

`supabase/functions/_shared/match-officialize-core.ts`: se eliminó todo `JSON.stringify(...)` en la llamada a `officialize_match_validation` — `p_reason_codes`/`p_result_players`/`p_level_state_updates` ahora reciben los arrays/objetos JS directamente (supabase-js los serializa correctamente para parámetros `jsonb`).

### B6-A-03 — reversión de `confidence` incompleta

`_bloque6_revert_applied_result` (`20260921230000_bloque6_correction_and_identity_rpcs.sql`) ahora revierte `confidence` con el mismo criterio de movimiento real que `mu` (ver B6-A-04): `confidence = confidence - (mu_row.confidence_after - mu_row.confidence_before)`. Cubre incidencia de identidad y anulación administrativa (ambas pasan por este mismo helper).

### B6-A-04 — reversión con `deltaCapped` en vez de movimiento real

Rediseño en `bramulab/match-level-engine.js`: `match_level_result_players` distingue ahora dos pares "antes/después" —

- `formula_mu_before`/`formula_confidence_before`/`formula_state`: la referencia INMUTABLE que alimentó la fórmula (expectativa/K/opponentFactor), nunca usada para revertir;
- `mu_before`/`mu_after`/`confidence_before`/`confidence_after`/`evidence_units_before`/`evidence_units_after`: los valores LIVE realmente escritos en `level_states` por esa aplicación puntual.

`computeLevelStateUpdates` revierte con `oldP.muAfter - oldP.muBefore` (el movimiento REAL, correcto incluso cuando el clamp de escala 1.0/10.0 recortó el `deltaCapped` nominal) y aplica el delta nuevo sobre el valor LIVE ya revertido, nunca sobre la referencia de fórmula. `_bloque6_revert_applied_result` (SQL) usa el mismo criterio. Tests nuevos: reversión exacta cerca de 10.0 y de 1.0 con un `deltaCapped` nominal que el clamp habría recortado.

### B6-A-05 — inactividad V1.5 §10.3 no integrada

- `get_match_officialization_snapshot` (`20260921220000_bloque6_read_rpcs.sql`) ahora incluye `lastRatedAt` por jugador.
- `bramulab/match-level-engine.js` agrega `computeEffectiveConfidence(rawConfidence, lastRatedAtIso, referenceIso)` (wrapper directo de `Level.computeEffectiveConfidenceAfterInactivity`, referencia = `playedAt` del partido, nunca "ahora") y `buildPlayerStatesDict` la aplica automáticamente.
- `computeLevelStateUpdates` aplica esa misma confianza efectiva como base de `Level.computeConfidenceAfterMatch` **únicamente** para un jugador sin aplicación previa de este partido (primera vez) — un jugador que ya tenía una aplicación previa (corrección) deriva su base por resta exacta del valor LIVE actual, que ya incorporó cualquier decay por construcción (aplicar decay dos veces sería incorrecto).
- `officialize_match_validation` usa `v_match.played_at` (nunca `now()`) para `last_rated_at`, con `greatest(...)` para nunca regresarlo en el tiempo.
- Test nuevo que reproduce exactamente el bug que esta corrección encontró en mi propio test inicial: sin el fix, la confianza posterior "recuperaba de golpe" el valor previo a la inactividad.

### B6-A-06 — Confirmar mezclaba sets de todas las revisiones

`supabase/functions/officialize-match/index.ts`: la reconstrucción del envío ahora resuelve primero `matches.current_revision_id` → `match_revisions.revision_number` y filtra `match_sets` por ese `revision_number` exacto, nunca `match_sets` sin filtrar por `match_id` solo.

### B6-A-07 — sin protección de revisión stale

`officialize_match_validation` ahora exige, bajo el mismo lock de `matches`, que `p_revision_id` coincida con `matches.current_revision_id` (trigger `initial`/`identity_*`) o con `matches.pending_correction_revision_id` (trigger `correction_accepted`) — mismatch devuelve `stale_match_revision` sin escribir nada. `match-officialize-core.ts` reintenta (acotado a 3 intentos) releyendo el snapshot ante este código, igual que ante `stale_level_snapshot`.

### B6-A-08 — aceptación de corrección no atómica

`respond_post_validation_correction` ya NO mueve `current_revision_id`/`pending_correction_revision_id` al aceptar — solo autoriza (`code:'correction_authorized'`) y devuelve `pendingRevisionId`. El movimiento del puntero de revisión ahora ocurre **dentro** de `officialize_match_validation(trigger='correction_accepted')`, en la misma transacción que revierte/reaplica Nivel. Un fallo del cálculo deja el partido exactamente como estaba (propuesta todavía pendiente), nunca a medias.

### B6-A-09 — resolución de identidad no atómica

Mismo criterio que B6-A-08: `resolve_identity_issue`, cuando el partido está `validated`, ya NO reasigna `match_participants` ni cierra `match_identity_issues` — solo autoriza (`identity_resolved_authorized`/`identity_unidentified_authorized`, con `team`/`positionInTeam` para que el orquestador pueda simular el cambio). `officialize_match_validation` recibió los parámetros `p_identity_issue_id`/`p_identity_replacement_player_id`: bajo el mismo lock que aplica Nivel, vuelve a verificar que la incidencia siga `open`, reasigna el slot (o marca `unidentified`), cierra la incidencia y aplica/reaplica Nivel — todo en una única transacción. Si el partido sigue `pending_validation` (sin Nivel involucrado), la reasignación sigue siendo directa, sin cambios.

### B6-A-10 — `officialize-match` no idempotente

`officialize-match/index.ts` ya no corta con `match_not_actionable` cuando `matches.status='validated'` — ese es exactamente el camino de reintento idempotente que el propio contrato promete. Solo rechaza estados genuinamente no accionables (`expired`/`annulled`).

### B6-A-11 — `distinct_opponents` excluía rivales sin Nivel propio

Tanto `officialize_match_validation` como `_bloque6_revert_applied_result` cuentan ahora `distinct_opponents` uniendo `match_participants` del equipo rival (cualquier `player_id` no nulo, registrado o provisional) contra partidos con `match_level_results` `applied`+`eligible` — ya no exige que el rival tenga su propia fila en `match_level_result_players`.

### B6-A-12 — `CALIBRADO` monotónico

Se quitó la rama `when status='CALIBRADO' then 'CALIBRADO'` en ambos lugares (`officialize_match_validation`, `_bloque6_revert_applied_result`): el estado se deriva siempre de `rated_matches`/`distinct_opponents` vigentes (`RECALIBRANDO` sigue siendo la única excepción, fuera del alcance de Bloque 6).

### B6-A-13 — `last_rated_at` = hora de escritura

Ambos lugares usan ahora `matches.played_at` (nunca `now()`) para un jugador con una fila nueva en este resultado, con `greatest()` para no retroceder. Para un jugador cuya contribución a este partido se retira sin reemplazo, se recompone como el `max(played_at)` de sus resultados `applied`+`eligible` restantes (`NULL` si no le queda ninguno).

---

## 2. Bug real encontrado durante la propia corrección (no estaba en la lista de 13)

Al escribir el test de inactividad (B6-A-05), mi primera versión de `computeLevelStateUpdates` aplicaba la confianza efectiva por decay solo al construir el `playerStates` que alimenta la FÓRMULA, pero seguía usando la confianza cruda (sin decay) como base de la escritura LIVE en `level_states` — el test falló, reveló el bug, y quedó corregido antes de continuar (ver commit; el propio test que lo encontró quedó en la suite). Documentado acá por transparencia, no es un punto nuevo del documento de revisión.

Durante la misma pasada encontré y corregí un segundo problema no listado explícitamente: la reconstrucción histórica de Decisión Abierta #2 (`get_player_level_state_as_of`) se había perdido en la primera versión de la reescritura de `match-officialize-core.ts` — un participante recién asignado por una incidencia de identidad estaba usando su Nivel ACTUAL en vez de su snapshot a `validated_at`. Restaurado explícitamente, acotado al caso `trigger='identity_resolved'` con `identityAction.replacementPlayerId`.

---

## 3. Tests agregados/reforzados (§4 del documento de revisión)

`bramulab/match-level-engine.test.mjs` pasó de 17 a **26 casos locales**, cubriendo directamente los ítems 1, 3, 4, 5 (parcial — el resto de §4 son escenarios SQL/Edge Function que solo pueden verificarse contra Supabase real, ver §4 abajo): reversión con movimiento real en los bordes 1.0/10.0, reversión exacta de `confidence`, inactividad 59/60/>60 días, corrección con confianza incremental real, identidad reemplazada, `formulaState` persistido en formato `level_states`.

`supabase/tests/verify-bloque6.mjs` (no ejecutado esta ronda) se amplió con: rechazo de `officialize_match_validation` con un `revision_id` inventado (B6-A-07), `distinct_opponents` reconociendo un rival reemplazado como identidad distinta (B6-A-11), y "ocultar no cambia `rated_matches`" (capa computable vs. display).

---

## 4. Verificación local ejecutada esta ronda

| Verificación | Resultado |
|---|---|
| `node --test bramulab/match-level-engine.test.mjs` | **26/26 OK** |
| `node --test` combinado (env-guard + health + motor) | **43/43 OK** |
| `node --check` en todo `bramulab/*.js`, `*.mjs` nuevos/tocados y `supabase/tests/*.mjs` | Limpio |
| Los 6 archivos `.ts` de Edge Functions | Revisión manual línea por línea contra el patrón ya desplegado de Bloques 3/5 — sin Deno CLI disponible en este entorno para compilar/type-check (misma limitación ya señalada en `05_Resultado_Fase_A_Claude.md`) |
| Suite de navegador (`tests.html`) | Verificada **1448/1448, 0 errores de consola** al inicio de esta ronda (antes de las correcciones). No se pudo re-verificar en vivo al cierre: el servidor de desarrollo local dejó de responder por un error de permisos del entorno (`.claude/dev-server.py`, ajeno a este cambio) y no pudo reiniciarse. Ningún archivo que `tests.html`/`index.html` cargan fue tocado en esta ronda (los cambios son exclusivos de `bramulab/match-level-engine.js` — no referenciado por esos HTML — y de `supabase/`), así que no hay mecanismo plausible de regresión, pero se documenta la limitación en vez de asumir un resultado no confirmado |

---

## 5. Bloqueos que solo pueden comprobarse contra Supabase real

- Aplicar las 8 migraciones de Bloque 6 en orden y confirmar que no hay errores de sintaxis/dependencia reales (revisadas manualmente, sin `psql`/Supabase CLI local disponible en este entorno).
- Los 6 archivos `.ts` de Edge Functions no pasaron por un compilador/linter de Deno real.
- Todo lo que `verify-bloque6.mjs` ejercita (incluidas las 3 verificaciones nuevas de esta ronda) — necesita el proyecto de Staging con las migraciones aplicadas y las Edge Functions desplegadas.
- La atomicidad real de B6-A-08/B6-A-09 (que un fallo a mitad de camino no deje estado inconsistente) solo es demostrable con una prueba de fallo forzado contra Postgres real — la revisión de código confirma que el diseño es correcto (todo ocurre en una única función `plpgsql`, una única transacción implícita), pero no reemplaza una prueba real.

---

## 6. DECISIONES ABIERTAS nuevas

**Ninguna.** Todos los 13 puntos eran correcciones técnicas inequívocas sobre una arquitectura ya aprobada — ninguno requirió una decisión de producto nueva. Las 3 decisiones de implementación menores ya documentadas en `05_Resultado_Fase_A_Claude.md` §8 (estado CALIBRADO monotónico, rival invitado no cuenta para diversidad, corrección post-validación acotada a resultado) siguen vigentes sin cambios — **con la excepción del propio B6-A-12**, que corrigió explícitamente la primera de esas tres (CALIBRADO ya no es monotónico, según la revisión central). Las otras dos permanecen como estaban.

---

## 7. Confirmación de alcance

No se tocó Supabase real, Vercel, `main`, Production ni BRAMUlive. No se aplicó ninguna migración ni se desplegó ninguna Edge Function. No se implementó Ranking ni Intelligence. No se hizo la pasada de UI/UX en navegador — `bramulab/app.js`, `index.html` y `styles.css` siguen sin modificar.

---

*Pendiente: nueva revisión de Fase central del diff corregido; recién si queda verde, aplicación de migraciones y despliegue de Edge Functions en Staging.*
