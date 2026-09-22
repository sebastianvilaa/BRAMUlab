# Backend Bloque 7 — Corrección de Fase 2 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `779a9a23879d36788f45a800bbeab99267fdc37d` (`10_Revision_Central_Fase_2.md`).
**Alcance ejecutado:** corregir exclusivamente F2-C01…F2-C07 sobre Fase 2. No se aplicó nada a Supabase, no se empezó Fase 3, no se tocó frontend, `pg_cron`, Vercel, `main`, Production ni BRAMUlive.

Este documento deja `09_Resultado_Fase_2_Claude.md` como evidencia histórica de la primera versión de Fase 2 (la que el dry-run real de la revisión central encontró con `insufficient_density_wrong` y 6 problemas más). Como `20260922140000_bloque7_fase2_ranking_calculation.sql` **nunca llegó a aplicarse a ningún entorno**, esta corrección **reemplaza ese mismo archivo** en vez de agregar migraciones de parche — no existe ningún estado real que preservar (10_Revision_Central_Fase_2.md §11). Mismo criterio para `supabase/tests/verify-bloque7-fase2.sql`, reescrito por completo.

---

## F2-C01 — Candidato sin ubicación desaparecía antes de poder auditarse

**Causa real:** la resolución de ubicación as-of-cutoff usaba `CROSS JOIN LATERAL (... location_change_events ... LIMIT 1)`. Un candidato sin ningún evento de ubicación hace que esa subconsulta devuelva 0 filas, y `CROSS JOIN` descarta la fila externa completa — el candidato desaparecía de `_b7_candidates` sin dejar ningún rastro, ni siquiera en Global. Confirmado en Staging real: 7 perfiles registrados, ninguno con ubicación, 0 filas de Ranking producidas.

**Corrección:** `LEFT JOIN LATERAL (...) loc_hist ON true`. Mismo cambio aplicado por simetría a la nueva resolución de branch/opt-in as-of-cutoff (`ranking_profile_events`, ver F2-C03), que tiene exactamente el mismo riesgo. La función escalar `_bloque7_player_ranking_snapshot_as_of` seguía usando `CROSS JOIN LATERAL` sin peligro porque una función escalar siempre devuelve una fila — se documentó la diferencia en el propio archivo para que no se "corrija" ese `CROSS JOIN` por error en el futuro.

---

## F2-C02 — Masculino y Femenino mezclados en una sola clasificación

**Causa real:** `total_eligible`, `RANK()`, densidad y desbloqueo de Global se calculaban agrupando solo por territorio, nunca por `competitive_branch` — una cuenta de una rama podía alterar el denominador/puesto/densidad/desbloqueo de la otra.

**Corrección:** toda esa autoridad ahora se calcula por `scope_type + scope_key + competitive_branch`:

- Local/Provincial/País: la densidad (`GROUP BY scope_type, scope_key, competitive_branch`) y el `RANK() OVER (PARTITION BY <territorio>, competitive_branch ...)` incluyen la rama.
- Global: desbloqueo (2+ países), densidad y `RANK()` se calculan con `GROUP BY`/`PARTITION BY competitive_branch` — dos países de ramas distintas nunca desbloquean mutuamente Global.
- Un candidato con `competitive_branch = NULL` (rama faltante) nunca matchea contra ningún agregado real (la comparación `NULL = NULL` nunca es verdadera en SQL) — su fila queda con `total_eligible = 0`, sin necesidad de un caso especial.

Probado explícitamente en el runner: Bella Vista y Rosario tienen candidatos M y F simultáneos en la misma localidad, y Global se desbloquea con un segundo país **solo para la rama que efectivamente tiene ese país**.

---

## F2-C03 — `ranking_profile_effective_from` no alcanzaba para reconstrucción histórica

**Causa real:** una sola columna, actualizada en cada llamada (incluso reenvíos idénticos), no es historial — no permite saber cuál era el valor de `competitive_branch`/`ranking_opt_in` en un cutoff pasado si el valor cambió después, y penalizaba con `profile_data_changed_after_cutoff` a un reenvío idéntico posterior al cutoff que en realidad no cambiaba nada.

**Corrección:** se elimina `profiles.ranking_profile_effective_from` de esta migración (nunca llegó a existir en Supabase, así que no hace falta ningún `DROP COLUMN`) y se reemplaza por una tabla append-only nueva:

```
ranking_profile_events(event_id, player_id, competitive_branch, ranking_opt_in, effective_at, created_at)
```

`complete_ranking_profile_data` inserta un evento nuevo **solo** cuando `competitive_branch`/`ranking_opt_in` difieren del último evento del jugador (comparación con `IS DISTINCT FROM`, que maneja el caso "primera vez" correctamente) — un reenvío idéntico no crea fila. `compute_ranking_edition` reconstruye el estado tomando el último evento con `effective_at <= cutoff`; sin ningún evento así, el jugador queda no elegible con motivo real (`competitive_branch_missing`, y `ranking_opt_in_false` solo cuando sí se conoce la rama — evita reportar dos motivos por un mismo hecho de "nunca completó datos de Ranking"). Ubicación sigue usando `location_change_events` de Fase 1, sin cambios — ya resolvía esto correctamente.

RLS: mismo criterio append-only que `location_change_events`, pero esta vez el `GRANT` inicial ya es solo `SELECT, INSERT` — nunca se otorgó `UPDATE`/`DELETE` para tener que revocarlo después (a diferencia de Fase 1, F1-C02).

---

## F2-C04 — RECALIBRANDO usaba mal la fecha de actividad

**Causa real:** `_bloque7_player_ranking_snapshot_as_of` tomaba `lastComputableAt` del mismo evento CALIBRADO consolidado que da el Nivel — si ese consolidado es viejo, un jugador que sigue jugando partidos computables reales mientras recalibra podía marcarse como inactivo (>180 días) aunque hubiera jugado la semana pasada.

**Corrección:** para RECALIBRANDO, `levelInternal`/`levelPublic`/`algorithmVersion` siguen viniendo del último CALIBRADO consolidado (sin cambios — la regla de Nivel no se reabre), pero `lastComputableAt` ahora viene del estado LIVE as-of-cutoff (`v_live->>'lastRatedAt'`, ya reconstruido al principio de la función). Confirmado por lectura de código (no solo supuesto) que `lastRatedAt`/`lastRatedAtAfter` es actividad de partido real para **cualquier** tipo de evento del ledger, incluida la reasignación de identidad (`20260921230000_bloque6_correction_and_identity_rpcs.sql:93-111`: se recompone desde `max(played_at)` de partidos computables restantes, con el `initial_estimate` como piso — nunca hora de escritura).

Probado en el runner: consolidado de hace 200 días (5.7) + evento RECALIBRANDO con actividad de hace 5 días → sigue elegible, usa 5.7 para el Nivel y la fecha de 5 días para la regla de 180 días.

---

## F2-C05 — Global locked guardaba `total_eligible = 0`

**Causa real:** las dos ramas del `IF v_global_unlocked` insertaban por separado; la rama `ELSE` (locked) hardcodeaba `total_eligible = 0` en vez de calcular el conteo real.

**Corrección:** al unificar el cálculo por rama (F2-C02), `total_eligible` ahora es siempre `coalesce(gd.total_eligible, 0)` — el conteo real de elegibles de esa rama en Global, calculado de la misma manera estando locked o no. Solo `density_status`/`position`/`tie_group` cambian según el estado de desbloqueo. Probado explícitamente: Global de la rama F queda `locked` con `total_eligible = 4` (nunca 0) tanto en la edición 1 como en la edición 2, mientras M se desbloquea con `total_eligible = 27`.

---

## F2-C06 — Runner reescrito

El runner anterior declaraba Bella Vista con 2 elegibles y en el mismo fixture agregaba un tercer elegible real (`recalib_ok_1`) a esa misma localidad — el fallo `insufficient_density_wrong` era del propio test, no (solo) del código. Se reescribió por completo:

- ubicaciones/fixtures reorganizados para que cada aserción de densidad tenga un denominador verificable a mano (Bella Vista 2M+2F, Rosario 6M con empate + 2F, Córdoba 15M, una localidad aislada para elegibles cuyo puesto no importa);
- candidato sin ubicación → verifica que NO desaparece, tiene fila Global con `location_missing`, sin fila territorial;
- M/F independientes: Bella Vista y Rosario prueban que agregar candidatos de la otra rama no cambia denominador/puesto de la rama que ya se estaba probando;
- Global lock/desbloqueo por rama: `cl_m1` desbloquea Global solo para M; F sigue `locked` con su `total_eligible` real;
- reenvío idéntico / cambio real después del cutoff: `stable_hist_1` (un solo evento, estable) y `branch_chg_1` (branch cambia a `F` después de cutoff2, deliberadamente más allá de ambos cutoffs del runner para no contaminar la prueba de desbloqueo de Global) prueban que la edición 1 reconstruye el valor de ANTES del cutoff, nunca el LIVE;
- RECALIBRANDO con consolidado viejo + actividad reciente (F2-C04);
- idempotencia, inmutabilidad ante un cambio de Nivel LIVE posterior, cutoff inválido (dos variantes: hora incorrecta y día incorrecto), seguridad (`PUBLIC`/`anon`/`authenticated` sin `EXECUTE`, `service_role` sin `UPDATE`/`DELETE` en las tres tablas append-only, incluida `ranking_profile_events`).

Todo dentro de un único `BEGIN...ROLLBACK`, sin residuos.

---

## F2-C07 — `is_active`/`ranking_excluded` as-of-cutoff

Se documenta explícitamente, sin sobrearquitecturar:

- `players.is_active` y `players.ranking_excluded` se leen **en vivo** dentro de `compute_ranking_edition` — confirmado de nuevo por grep en esta ronda que ningún RPC existente los escribe (Fase 1 los introdujo/documentó como server-only sin vía de escritura; nada cambió desde entonces);
- esto es aceptable únicamente porque hoy no existe ningún mecanismo real que los cambie — no es una reconstrucción histórica genuina, es una lectura en vivo de un dato que hoy nunca varía;
- no se inventa historial retroactivo para estos dos campos, y no se construye ningún sistema administrativo nuevo en esta ronda;
- **queda establecido** (en el comentario de la migración y acá) que cualquier vía futura que efectivamente modifique `is_active`/`ranking_excluded` deberá registrar su propio effective-time (mismo patrón que `location_change_events`/`ranking_profile_events`) antes de que exista el primer usuario real en Production — no después.

---

## Validación estática/local realmente ejecutada

- lectura de `officialize_match_validation`/`resolve_identity_issue` (comentarios `B6-A-13`, líneas 93-111 de `20260921230000_bloque6_correction_and_identity_rpcs.sql`) para confirmar, antes de aplicar el fix de F2-C04, que `lastRatedAtAfter` es actividad real para todo tipo de evento del ledger, no solo `match_delta`;
- verificación de balance de paréntesis/comillas/bloques `$$…$$`/`$fn$…$fn$` de la migración reescrita y del runner reescrito — balance 0 en ambos;
- recomputación manual, por escrito, de cada denominador de densidad esperado en el runner (Bella Vista 2/2, Rosario 6/2, Córdoba 15, Global M=26→27, Global F=4) antes de fijar las aserciones, específicamente para no repetir el error que originó `insufficient_density_wrong`;
- verificación columna por columna de que los `INSERT INTO ranking_rows (...)` (local/provincial/país y Global, ahora unificado en un solo `INSERT` por bloque) siguen teniendo 23 columnas en la misma posición que su `SELECT`;
- verificación de que un fixture introducido en la sección 5 (desbloqueo de Global) no contaminaba retroactivamente la sección de branch-history de la sección 2 — se encontró y corrigió una interacción real entre `branch_chg_1` y el cutoff2 antes de cerrar esta ronda (el cambio de rama se movió a después de AMBOS cutoffs del runner).

**Nada se ejecutó contra Supabase real** (no autorizado esta ronda). No se declara PASS de ninguna prueba que dependa de aplicar la migración. ChatGPT central repetirá la migración + runner contra Staging real con `ROLLBACK` antes de decidir si Fase 2 queda apta.

---

## Bloqueos reales

Ninguno.

---

**Fin de la corrección de Fase 2. No se aplicó nada a Supabase. No se empezó Fase 3.**
