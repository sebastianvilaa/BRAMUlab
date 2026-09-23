# Backend Bloque 8 — Corrección de Fase A (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Corrige:** `03_Revision_Central_Fase_A.md` — único punto **C01** (bloqueante antes de aplicar la migración).
**Alcance ejecutado:** únicamente C01. No se avanzó a Fase B. No se aplicó nada a Supabase. No se tocó `main`, Production ni BRAMUlive. No se tocó `bramulab/matches.js` ni ningún contrato cerrado de Bloques 5–7.

---

## 1. Qué decía C01

`get_player_intelligence_history` es un RPC `returns table (...)`. Supabase/PostgREST serializa las columnas top-level de ese tipo de retorno en **snake_case** (`match_id`, `played_at`, `played_at_time_known`, `format_id`, `scoring_system`, `my_team`, `official_eligible`, `has_open_identity_issue`, etc.) — nunca camelCase. Esto ya está resuelto para `get_my_matches` mediante `normalizeMyMatchesRow()` en `bramulab/matches.js`.

`translateForIntelligence(row)` (Fase A original) pasaba `row` directo a `PLMatchSync.translateServerMatchToLocalShape`, asumiendo camelCase. Los 27 tests originales construían fixtures camelCase a mano, así que ninguno cubría la forma real de red — `row.matchId`, `row.playedAt`, `row.formatId`, `row.officialEligible`, etc. habrían llegado `undefined` si algo hubiera consumido la RPC real.

## 2. Corrección aplicada

Todo el cambio vive dentro de `bramulab/intelligence-context.js` (symlink en `supabase/functions/_shared/`) — **cero cambios en `matches.js`, cero cambios en Bloques 5–7, cero cambios en la migración SQL**.

1. Nueva función `normalizeIntelligenceHistoryRow(row)`: traduce las columnas top-level reales (snake_case) a camelCase, mismo criterio exacto que `normalizeMyMatchesRow` de `matches.js` pero replicado en la frontera de Intelligence (comentario en el propio código explica por qué no se reusa/importa esa función: Bloque 5 cerrado, y hoy no existe otro consumidor de esta RPC que justifique moverla a un lugar compartido). `participants`/`sets` no se tocan: son objetos jsonb que la propia función SQL arma ya en camelCase (`jsonb_build_object('playerId', ..., 'gamesA', ...)`), nunca columnas top-level.
2. `translateForIntelligence(row)` ahora llama primero a `normalizeIntelligenceHistoryRow`, después a `PLMatchSync.translateServerMatchToLocalShape` sobre el resultado ya normalizado, y por último anota `officialEligible` desde el valor ya normalizado (antes lo leía de `row.officialEligible`, que en la fila real es `row.official_eligible`).
3. `normalizeIntelligenceHistoryRow` se agregó a la API pública del módulo (`PLIntelligenceContext.normalizeIntelligenceHistoryRow`) para poder probarla de forma aislada, además de a través de `translateForIntelligence`.

## 3. Corrección de los tests

En vez de agregar una única prueba de regresión aislada y dejar las otras 27 corriendo sobre una forma camelCase que nunca existe en la realidad, se corrigió el fixture compartido `row()` de `bramulab/intelligence-context.test.mjs` para que devuelva la forma real snake_case (`match_id`, `played_at`, `played_at_time_known`, `format_id`, `scoring_system`, `my_team`, `created_by_player_id`, `validated_at`, `validation_deadline_at`, `hidden`, `has_open_identity_issue`, `official_eligible`, `participants`, `sets`) — así los 27 escenarios originales (rachas, forma reciente, hitos, relaciones, inactividad, orquestador) quedan probados sobre el contrato real de red, no sobre una idealización.

Se agregaron además 2 pruebas explícitas pedidas por la revisión:

- `C01: normalizeIntelligenceHistoryRow traduce la forma real snake_case de la RPC a camelCase` — confirma uno por uno los 11 campos que pidió `03_Revision_Central_Fase_A.md`: `matchId`, `playedAt`, `playedAtTimeKnown`, `formatId`, `scoringSystem`, `myTeam`, `hidden`, `hasOpenIdentityIssue`, `officialEligible`, `participants`, `sets`.
- `C01: translateForIntelligence (el punto de entrada real) también sobrevive la forma snake_case` — confirma que el pipeline completo (normalización + traducción + Engine derivando `winnerTeam`/`players`) funciona de punta a punta sobre la fila real, no solo la función de normalización aislada.

## 4. Resultado

`node --test bramulab/intelligence-context.test.mjs` — **29/29 PASS** (27 originales, ahora sobre la forma real, + 2 nuevas de regresión C01).

## 5. Qué NO se tocó

- `bramulab/matches.js` — intacto.
- Contratos de Bloques 5, 6 y 7 (SQL, RPCs, Edge Functions) — intactos.
- La migración `20260923100000_bloque8_fasea_intelligence_history_rpc.sql` — intacta, sin aplicar a Supabase real todavía.
- UI, `index.html`, `tests.html` — intactos.
- Fase B — no iniciada.
- `main`, Production, BRAMUlive — no tocados.

## 6. Nota no bloqueante (§3 de la revisión)

`03_Revision_Central_Fase_A.md` §3 señala que `matchId` como desempate estable nunca debe convertirse en evidencia narrativa de "antes/después" cuando la hora real es desconocida. No requería cambios en esta corrección: `playedAtTimeKnown` ya viaja intacto desde la RPC hasta `buildPersonalHistory`/`buildMatchDerivedContext` (confirmado por la prueba C01 de `normalizeIntelligenceHistoryRow`). Queda como responsabilidad de Fase B/C al construir claims secuenciales — no de Fase A, que solo preserva el dato.

## 7. Siguiente paso

Sin cambios respecto de `02_Resultado_Fase_A_Claude.md` §6: aplicar la migración a Supabase Staging real y confirmar con una llamada real que la forma serializada coincide con lo que ahora asume `normalizeIntelligenceHistoryRow` — recién entonces cerrar Fase A y preparar B. No avanzar automáticamente a B.
