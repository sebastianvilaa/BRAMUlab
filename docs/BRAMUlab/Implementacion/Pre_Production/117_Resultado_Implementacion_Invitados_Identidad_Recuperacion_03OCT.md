# Resultado — Implementación Invitados / Identidad / Recuperación (V04.29)

**Fecha:** 03/10/2026 · **Rama:** `staging` · **Base:** `6d40c05` · **Versión visible:** BRAMUlab **V04.29** · bundle **04.29-h1**
**Fuentes:** handoffs 113 (producto cerrado) y 116 (revisión técnica de Central). Nada de producto se reabrió.
**Estado:** implementado y verificado **localmente** (PGlite = Postgres real + motor JS real). **NO** aplicado a Supabase Staging ni desplegado — espera el gate de Central.

## 1. Qué se entrega

| Frontera | Contenido |
|---|---|
| **A1 links** | Un `pending` por `(provisional, invitador)`; helper único `_can_invite_provisional`; `create_claim_link` rota solo el link propio; `preview_claim_link` (no consume). |
| **A2 recuperación** | `claim_provisional_player` reescrita (SOY YO): lock por provisional → target, relectura bajo lock, preflight de conflicto de slots, repunteo atómico, tombstone, ganador `claimed` + resto `revoked`. Tablas `player_identity_recoveries` y `level_recovery_effects`. Replay de Nivel server-side (Edge `process-identity-recovery` + `identity-recovery-core.mjs`). |
| **B frontend** | Resumen → `JUGADORES SIN CUENTA` + `INVITAR`; hoja `Invitá a {nombre} a BRAMU` + `COPIAR ENLACE`; modal `¿Sos {nombre}?` (SOY YO / NO SOY YO); retorno automático tras autenticarse; cuenta existente sin “resolución manual”; V04.29/04.29-h1. |
| **C duplicados** | `match_duplicate_candidates` (persistidos), detección con la semántica estructural de `create_or_attach_match`, `list_my_duplicate_match_candidates` / `resolve_duplicate_match_candidate`, modal `ENCONTRAMOS DOS PARTIDOS QUE PODRÍAN SER EL MISMO`. |

## 2. Migraciones nuevas (orden de aplicación)

1. `20261003100000_g3_identity_recovery_links.sql` — `players.recovered_into_player_id/recovered_at` (+ CHECK de tombstone), índice `provisional_claims_one_pending_per_inviter` (reemplaza `…_one_pending_per_player`), `revoked_at/revoked_reason`, `_can_invite_provisional`, `create_claim_link`, `preview_claim_link`, `list_my_provisional_players` y `list_related_provisional_players` (excluyen tombstones; la segunda usa la regla única).
2. `20261003110000_g3_identity_recovery_core.sql` — tablas `player_identity_recoveries`, `level_recovery_effects`, `match_duplicate_candidates`; helpers de dedupe; `claim_provisional_player`; `get_my_identity_recovery_status`; RPC server-only del replay (`get_identity_recovery_level_input`, `list_identity_recoveries_pending_level`, `acquire/release_identity_recovery_level_lease`, `record_level_recovery_skip`, `apply_level_recovery_effect`, `complete_identity_recovery_level`, `_level_recovery_counts`).
3. `20261003120000_g3_duplicate_match_resolution.sql` — `list_my_duplicate_match_candidates`, `resolve_duplicate_match_candidate`, `_fold_pending_match_into`, `_duplicate_candidate_match_json`.
4. `20261003130000_g3_identity_recovery_account_deletion.sql` — `admin_delete_player_account` idéntica a la vigente + anonimiza las provisionales que esa cuenta había recuperado.

**Edge nueva:** `process-identity-recovery` (`verify_jwt=true`; registrada en `release-check.mjs` y en el Runbook). Sin Edge modificadas. RPC modificadas: `create_claim_link`, `claim_provisional_player`, `list_my_provisional_players`, `list_related_provisional_players`, `admin_delete_player_account` (+1 sentencia).

## 3. Decisiones técnicas (no de producto)

### 3.1 Seam `legal_acceptances` → **opción B**
La **cuenta destino es siempre la identidad final** (conserva `auth_user_id`, perfil, `level_states`, `pilot_events` y su `legal_acceptances` append-only); la provisional se **reasocia hacia ella** y queda como tombstone auditable. Alta nueva y cuenta existente usan **el mismo mecanismo**. No se borra P2, no se toca el trigger, no se copia ni muta evidencia legal, no hay `DELETE` de `players`. Verificado: `legal_acceptances` idéntica antes/después y el trigger sigue rechazando `UPDATE`.

### 3.2 Referencias a `players.player_id` (37 columnas, replay PGlite) — clasificación
- **Verdad actual/reasociable (única que se repuntea):** `match_participants.player_id` + `_bloque6_refresh_participant_fingerprint` de cada partido.
- **Auditoría histórica (no se toca):** `match_actions.actor`, `match_revisions.proposed_by`, `match_submissions.submitted_by`, `matches.created_by`, `match_identity_issues.*`, `match_level_results.actor`, `provisional_claims.*`, `players.created_by`, `pilot_events`, `notifications`, `location_change_events`, `ranking_profile_events`.
- **Snapshots publicados (no se toca):** `ranking_rows`, `ranking_network_hidden`.
- **Regenerable:** `intelligence_match_outputs` (se regenera por fingerprint: composición + snapshot oficial de Nivel cambian).
- **Evidencia legal:** `legal_acceptances` (intacta).
- **No aplican a una provisional:** `level_states/events`, `group_*`, `profiles`, `player_saved_players` (solo registradas), `match_user_state`, `api_rate_limits`.

### 3.3 Serialización de claims concurrentes
`claim_provisional_player` toma `pg_advisory_xact_lock` determinístico **por provisional** y luego **por target** (jerarquía fija prov → target → filas de `matches` ordenadas por `match_id`, sin `FOR UPDATE` sobre `players` para no chocar con los `FOR KEY SHARE` de `officialize_match_validation`). Bajo lock se **relee** el claim, se valida vigencia/estado/provisional activa y se hace el preflight; recién entonces se muta. `create_claim_link` toma el mismo lock inicial. Idempotente por `(provisional, target)`. **La carrera REAL de dos conexiones no se puede ejercitar en PGlite/SQL editor** → `supabase/tests/verify-g3-identity-recovery-concurrency.mjs` (5 escenarios C1–C5) para correr contra Staging.

### 3.4 Cómo se representa la recuperación
`player_identity_recoveries` (source, target, claim ganador, actor, `status` completed|blocked_conflict, `level_status` not_needed|pending|completed, partidos recuperados, resultado, lease del replay). Una sola `completed` por provisional y por claim (índices únicos parciales). Un conflicto de slot deja `blocked_conflict` auditado **sin mutar nada ni consumir el link**.

### 3.5 Nivel recuperado — persistencia y reversión
Replay por `played_at ASC` partiendo del Nivel vigente del target, con `priorSnapshots` **históricos** del partido (nunca niveles actuales de terceros), reutilizando `PLMatchLevelEngine.computeOfficializationResult/computeLevelStateUpdates` (nivel_bramu_v1_0, sin fórmula nueva ni SQL). El efecto del **target únicamente** se persiste (a) como fila en `match_level_result_players` del resultado vigente del partido — así correcciones (netea, verificado), anulaciones, incidencias de identidad y conteos existentes lo tratan como a cualquier participante — y (b) como ledger `level_recovery_effects` `UNIQUE (recovery_id, match_id)` con `applied | skipped_ineligible | skipped_missing_snapshot | reverted_duplicate`, inputs usados y efecto (`mu/confidence/evidence_effect`). Idempotente y reanudable (lease por recuperación + lock optimista a 4 decimales). CALIBRANDO avanza/cierra 5+3; CALIBRADO nunca se descalibra por recuperar. Terceros: cero filas/eventos nuevos (test). El Nivel inicial V1.3 siempre va primero (`pending_level` espera).
*Nota:* `level_recovery_effects.status='applied'` es el estado **al aplicar**; si después un flujo estándar revierte/reaplica el resultado, la verdad vigente está en `match_level_result_players` (el ledger solo cambia a `reverted_duplicate` en la resolución de duplicados).

### 3.6 Duplicados
Detección (en el claim y re-detección idempotente en `get_my_identity_recovery_status`): misma huella + formato + ambos vivos + ventana ±3 h / mismo día BA. **NO** → `resolved_different` (no se re-pregunta). **SÍ** → canónico (validated > pending; entre validated el `validated_at` más antiguo); si ambos pending, la declaración del secundario se pliega con la semántica de `create_or_attach_match` (conformidad / mismo lado / revisión propuesta si el score difiere; el self-heal oficializa si queda listo); el secundario se **anula como duplicado** (no se borra nada), su efecto se revierte con `_bloque6_revert_applied_result` (reversión pura vigente, incluye la fila del target) y su ledger pasa a `reverted_duplicate`. Stats/Grupos/Intelligence derivan de `validated` → un solo partido; Ranking publicado no se toca.

## 4. Pruebas (todas locales; ver §6 para lo pendiente)

| Suite | Resultado |
|---|---|
| `node --test` completo (bramulab + supabase) | **867 tests · 864 pass · 3 fail** — los 3 son **preexistentes** (h19-B, h21-9, h23; idénticos en la base `6d40c05`, no relacionados). Antes: 828/825/3. |
| `supabase/functions/_shared/identity-recovery-core.test.mjs` (E2E, PGlite + motor real + `officializeMatch` real) | **20/20** |
| `bramulab/v0429-invitados-identidad.test.mjs` | **19/19** |
| `supabase/tests/verify-g3-identity-recovery.sql` (BEGIN/ROLLBACK; con canario que prueba que falla si falla) | PASS |
| `verify-clean-room.mjs` (replay ×3 ACL strict/observed/open, 35 chequeos) | PASS |
| `release-check.mjs` (+ ensayos operativos) | PASS |
| Mini-advisor local (FK sin índice, `search_path`, RLS, índices duplicados) sobre lo nuevo | limpio (única FK sin índice: `players.created_by_player_id`, preexistente) |

Cobertura de la lista 116 §10: 1–3 (cuenta nueva/existente/dos provisionales), 4–5 y 7 (links multi-invitador, rotación, revocación — SQL verify), 6 (carrera — script de concurrencia), 8 (NO SOY YO no consume — SQL + cliente), 9–10 (relación), 11 (legal), 12 (conflicto de slot, cero mutación), 13 (idempotencia), 14–18 (Nivel: snapshots históricos, skip sin snapshot, 5+3, no descalibra, terceros intactos), 19 (ranking intacto), 20 (Grupos 2/4→3/4 solo si era miembro), 21 (fingerprint Intelligence), 22–24 (duplicados SAME/DIFFERENT/doble efecto + reversión idempotente), 25 (Stats una vez), 26 (reintentos), 27 (ACL/RLS), 29–30 (create-or-attach y corrección/identidad sin regresión). Rate limits: SQL verify L12.

## 5. Archivos frontend tocados
`bramulab/{app.js, auth.js, index.html, styles.css, store.js, sw.js, version.json, manifest.webmanifest}` + tests de versionado. `store.js`: `APP_VERSION 'BRAMUlab V04.29'`, `BUNDLE_VERSION '04.29-h1'`; `sw.js`: `CACHE_NAME 'bramulab-v04-29-h1'` + query strings; `version.json`, manifest e `index.html` alineados. Se actualizó `supabase/tests/verify-bloque4.mjs` al contrato nuevo (la cuenta conserva su `player_id`; una cuenta completa puede vincular).

## 6. Qué NO se pudo ejecutar contra Staging real (para Central)
1. **Aplicar** las 4 migraciones en orden y **desplegar** la Edge `process-identity-recovery` (`verify_jwt=true`).
2. `supabase/tests/verify-g3-identity-recovery.sql` en el SQL editor (rollback) y `verify-g3-identity-recovery-concurrency.mjs` (deja filas auditables `zz_g3_conc_*`; ver cabecera).
3. **Advisors reales** de seguridad/performance después del DDL (local limpio, no sustituye).
4. Prueba de envío real: link por WhatsApp, portapapeles en iPhone/Safari (se usa `ClipboardItem` con promesa + fallback `writeText` + campo de copia manual), QA visual de Resumen → INVITAR / hoja / `¿Sos…?` / duplicado (verificado visualmente en un navegador local a 375 px con DOM sembrado).
5. Replay de Nivel con datos reales de Staging (los fixtures usan snapshots sintéticos coherentes con el motor).

## 7. Límites conocidos (honestos)
- `create_or_attach_match` conserva su chequeo inline de relación de provisionales (misma regla); no se refactorizó a `_can_invite_provisional` por no reabrir una función de 590 líneas. Misma semántica; candidato a refactor futuro.
- Si un partido recuperado se corrige/anula después, el target se trata como cualquier participante (verificado); el ledger no se resincroniza solo (ver 3.5).
- Una provisional recuperada nunca vuelve a ser seleccionable; el tombstone conserva el nombre original salvo que la cuenta se elimine (entonces se anonimiza).
- `DECISIÓN ABIERTA`: **ninguna**.
