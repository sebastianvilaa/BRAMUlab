# Backend Bloque 6 — Resultado de la corrección final pre-Staging (C-01 a C-10)

Corrige `10_Revision_Final_Pre_Staging_ChatGPT.md` sobre el HEAD `a30c9ab`. Migraciones editadas en el lugar (todavía no aplicadas a Supabase real).

## C-01 a C-10

- **C-01**: `match_level_result_players` reemplaza `mu_before/confidence_before/evidence_units_before/evidence_units_after` por `original_live_{mu,confidence,evidence_units}_before` (baseline LIVE inmutable por partido/jugador, se propaga entre correcciones) + `mu_after/confidence_after` redefinidos como el valor ABSOLUTO de fórmula (nunca el LIVE contaminado). `computeLevelStateUpdates` calcula todo como `efecto = X_after - baseline`, nunca una asignación absoluta ni un movimiento LIVE-a-LIVE — el efecto de un partido/corrección posterior intercalado queda intacto. `_bloque6_revert_applied_result` (que seguía referenciando las columnas viejas) corregida para el nuevo modelo — bug real encontrado durante esta misma corrección, no listado en el documento C.
- **C-02**: nueva RPC `confirm_match_validation` (autoridad por pareja real vía `action_side`, deadline, sin issue open) reemplaza el hack de re-enviar por `create_or_attach_match`; `officialize_match_validation` gana un guard adicional (`action_side IS NULL`) para `trigger=initial`.
- **C-03**: `create_or_attach_match` gana una guardia previa a crear — si 3 de los 4 IDs entrantes coinciden con un partido con incidencia open/`unidentified`, devuelve `identity_resolution_required` en vez de duplicar.
- **C-04**: en el camino de adjuntar a un match existente, la orientación A/B se lee de `match_participants` ya almacenada, nunca se recalcula por orden léxico de los IDs entrantes.
- **C-05**: `admin_force_resolve_identity_issue` queda STAGED para partidos `validated` (solo autoriza); nueva Edge Function `admin-resolve-identity-issue` (exige la service role key exacta como bearer) completa reasignación+Nivel atómicamente.
- **C-06**: nueva `computeOfficializationResultFrozenContext` — para `correction_accepted`, reutiliza repetición/compañero/círculo/disponibilidad del resultado vigente anterior en vez de recalcularlos del historial actual.
- **C-07**: resuelto como efecto directo de C-02 — `confirm_match_validation` no exige 4 IDs no nulos, así que un slot "Jugador no identificado" terminal ya no bloquea Confirmar.
- **C-08/C-10**: `get_notifications` deriva `pending_review`/`correction_proposed`/`identity_questioned` en lectura desde el estado real (nunca persistidas); desaparecen solas al resolverse; la ventana de 3 días de una corrección se evalúa en la propia consulta, sin cron.
- **C-09**: `officialize_level_onboarding` fija `last_rated_at=now()`; backfill para estados ya inicializados; `get_player_level_state_as_of` devuelve `lastRatedAt` real para `initial_estimate`.

## Tests

- `node --test bramulab/match-level-engine.test.mjs` → **30/30 OK** (nuevos: interleaving C-01, frozen-context C-06; reescritos los que asumían el esquema viejo).
- Combinado con env-guard/health → **47/47 OK**.
- `node --check` limpio en todo el JS/TS tocado; barrido completo por referencias colgantes a las columnas eliminadas (encontró y corrigió el bug de `_bloque6_revert_applied_result`).
- `supabase/tests/verify-bloque6.mjs` ampliado con casos dirigidos a C-02/03/04/05/07/08/09/10 — no ejecutado (sin Supabase real esta ronda). C-01/C-06 cubiertos localmente en match-level-engine.test.mjs.

## Bloqueos solo verificables contra Supabase real

Aplicar las migraciones editadas, compilar los `.ts` (incluida la nueva `admin-resolve-identity-issue`) con Deno real, y ejecutar `verify-bloque6.mjs` completo.

## DECISIONES ABIERTAS

Ninguna — los 10 puntos eran correcciones técnicas.
