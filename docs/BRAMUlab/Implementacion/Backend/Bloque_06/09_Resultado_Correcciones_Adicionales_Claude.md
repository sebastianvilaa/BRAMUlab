# Backend Bloque 6 — Resultado de correcciones adicionales (B6-B-01 a B6-B-07)

Corrige `08_Revision_Central_Adicional.md` sobre el HEAD `acf44eb`. Migraciones de Bloque 6 editadas en el lugar (todavía no aplicadas a Supabase real).

## Correcciones

- **B6-B-01** (`bramulab/match-level-engine.js#computeLevelStateUpdates`): `confidence_before`/`confidence_after` (LIVE) dejan de mezclar la base decayeada con el valor real. `confidence_before` es ahora el valor LIVE tal cual antes de esta aplicación (`confidenceAfterRevert`); `confidence_after` es exactamente `newP.confidenceAfter` (lo que el motor ya calculó desde la referencia de fórmula congelada, sin recalcular ni re-decaer acá). `referenceIso` se elimina del módulo — la decisión de decay queda enteramente en quien arma `playerStates` para el motor.
- **B6-B-02**: `_bloque6_revert_applied_result` y `officialize_match_validation` escriben `level_events.result` con snapshot post-evento completo (`muAfter/confidenceAfter/evidenceUnitsAfter/statusAfter/lastRatedAtAfter`) en todos los casos; se eliminó el evento bare `{revertedResultId}` que `officialize_match_validation` escribía antes de reaplicar (redundante y riesgoso: mismo `created_at` de transacción que el evento final). `get_player_level_state_as_of` usa `created_at < cutoff` (antes `<=`), exige snapshot completo, y devuelve `lastRatedAt`.
- **B6-B-03**: `resolve_identity_issue` sobre un partido `pending_validation` ya no muta directo — crea una revisión `proposed_correction` append-only, copia los sets vigentes, reasigna el slot y pasa `action_side` a la pareja contraria, sin reiniciar `validation_deadline_at`.
- **B6-B-04**: nuevo helper `_bloque6_refresh_participant_fingerprint(match_id)` (mismo hash que Bloque 5), invocado atómicamente en `report_identity_issue`, `resolve_identity_issue` (ambos caminos) y `admin_force_resolve_identity_issue`.
- **B6-B-05**: `resolve_identity_issue` exige que el caller sea participante actual del partido, y que el reemplazo exista/esté activo/no duplique, con la misma regla de provisional-relacionado que Bloque 5.
- **B6-B-06**: en `officialize_match_validation`, la reasignación de `match_participants` para `identity_resolved` se movió ANTES del recálculo de `rated_matches`/`distinct_opponents`.
- **B6-B-07**: `report_identity_issue` y `resolve_identity_issue` rechazan con `match_expired` sobre un partido `pending_validation` con `validation_deadline_at` vencido.
- Ajustes secundarios: `_bloque6_revert_applied_result` bloquea jugadores en orden determinístico por `player_id`; `respond_post_validation_correction` responde `correction_already_accepted` (idempotente) en vez de `no_pending_correction` si un reintento llega después de que la aceptación ya se aplicó.

## Tests

- `node --test bramulab/match-level-engine.test.mjs` → **27/27 OK** (nuevo: reversión exacta de confidence tras >60 días de inactividad, decay aplicado una sola vez; ajustados los 2 tests que asumían la semántica vieja de `confidenceBefore`).
- Combinado con `env-guard`/`health` → **44/44 OK**.
- `node --check` limpio en todo el JS/TS tocado.
- `supabase/tests/verify-bloque6.mjs` ampliado (identidad pre-validación, autorización negativa, fingerprint, ventana vencida) — no ejecutado (sin acceso a Supabase real esta ronda).
- No se tocó ningún archivo cargado por `tests.html`; no fue necesario re-verificarlo.

## Bloqueos solo verificables contra Supabase real

Aplicar las migraciones editadas, compilar los `.ts` con Deno real, y ejecutar `verify-bloque6.mjs` completo.

## DECISIONES ABIERTAS

Ninguna — los 7 puntos eran correcciones técnicas.
