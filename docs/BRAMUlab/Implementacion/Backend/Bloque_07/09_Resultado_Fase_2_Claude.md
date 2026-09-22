# Backend Bloque 7 — Resultado de Fase 2 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `60f5686a74a0ead3b4524612cd099f37942281fc` (`08_Handoff_Fase_2_Claude.md`).
**Alcance ejecutado:** función server-side de cálculo de una edición semanal (atómica, idempotente, invocable manualmente), su runner SQL transaccional, y esta documentación. No se aplicó nada a Supabase. No se tocó frontend, `pg_cron`, ni ninguna RPC de lectura para el cliente. No se empezó Fase 3.

---

## 1. Archivo

`supabase/migrations/20260922140000_bloque7_fase2_ranking_calculation.sql` — una sola migración lógica, en orden:

1. `ranking_rows.density_status` admite un cuarto valor, `'locked'` (Global bloqueado por menos de 2 países elegibles — distinto de `'insufficient'`, que es sobre cantidad de gente, no sobre diversidad de país). Constraint nueva: `'locked'` solo puede aparecer en `scope_type='global'`.
2. `profiles.ranking_profile_effective_from` — columna nueva (ver §3).
3. `get_player_level_state_as_of` (Bloque 6) extendida para devolver también `algorithmVersion` (cierra 03_Revision_Central_Analisis.md C-08, ya anunciado en `04_Resultado_Fase_1_Claude.md §7`).
4. `complete_ranking_profile_data` (Fase 1) extendida para escribir `ranking_profile_effective_from = now()` en cada llamada exitosa — mismo cuerpo con `FOR UPDATE` de F1-C04, una línea nueva en el `UPDATE` final.
5. `_bloque7_player_ranking_snapshot_as_of(player_id, cutoff)` — helper nuevo, service-only.
6. `compute_ranking_edition(p_cutoff)` — la función de Fase 2.

`supabase/tests/verify-bloque7-fase2.sql` — runner transaccional (`BEGIN...ROLLBACK`), sin residuos.

---

## 2. Nivel congelado — nunca el provisional en RECALIBRANDO

`get_player_level_state_as_of` sigue siendo la única reconstrucción del ledger; se le agregó `algorithmVersion` porque ya existía como columna de `level_events` y el helper no la exponía. Es `create or replace` sobre la misma firma — ningún `GRANT` se pierde, y el único caller real (`match-officialize-core.ts`) lee campos por nombre, así que un campo nuevo en el jsonb es aditivo.

`_bloque7_player_ranking_snapshot_as_of` resuelve la regla crítica del handoff §4:

- `CALIBRADO` → usa el valor LIVE reconstruido (ya es correcto).
- `RECALIBRANDO` → busca, dentro del mismo `level_events`, el último evento anterior al cutoff cuyo `statusAfter = 'CALIBRADO'`, y usa SU `muAfter`/`lastRatedAtAfter`/`algorithm_version` — nunca el valor provisional del evento RECALIBRANDO. Sin consolidado anterior → sin Nivel utilizable (no elegible).
- `CALIBRANDO`/`PENDIENTE` → sin Nivel utilizable.

`lastComputableAt` (para la regla de 180 días) se lee de `lastRatedAtAfter`, que Bloque 6 (`20260921223000_bloque6_officialize_rpc.sql:310`, comentario `B6-A-13`) ya documenta como "actividad deportiva computable (`played_at` del partido), nunca hora de escritura" — confirmado leyendo ese código antes de reutilizarlo, no asumido. Nunca se lee de un evento `initial_estimate` (ahí sería tiempo de cuestionario, exactamente lo que el handoff pide evitar).

---

## 3. Estado de perfil as-of cutoff (handoff §5)

Verificado antes de decidir, campo por campo:

- **Ubicación**: Fase 1 ya construyó el historial real (`location_change_events`). `compute_ranking_edition` reconstruye la ubicación AS-OF cutoff buscando la última fila con `effective_at <= cutoff` — nunca `profiles.location_id` en vivo.
- **`competitive_branch`/`ranking_opt_in`**: sin historial dedicado en Fase 1 (se escriben juntos, sin auditoría de cambio, a diferencia de la ubicación). Se agregó el contrato mínimo que pedía el handoff: `profiles.ranking_profile_effective_from`, actualizada en **toda** llamada exitosa de `complete_ranking_profile_data` (a diferencia de `location_effective_from`, que solo se mueve ante un cambio real de ubicación). Si `ranking_profile_effective_from` es NULL o posterior al cutoff, la fila queda excluida con `profile_data_changed_after_cutoff` en vez de asumir en silencio el valor actual — probado en el runner (`stale_profile_1`).
- **`players.is_active`/`ranking_excluded`**: sin ningún RPC que los escriba todavía (confirmado por grep antes de Fase 1 y de nuevo acá) — no hay drift que reconstruir. Se leen en vivo, pero **no** filtran el pool de candidatos: se convirtieron en `reason_codes` auditables (`account_inactive`/`account_excluded`) para que "cuenta excluida"/"cuenta inactiva" produzcan una fila con motivo, tal como pide el handoff §12, en vez de desaparecer silenciosamente.
- **`username`/`type='registered'`**: sí siguen filtrando el pool (nunca generan fila) — no tienen `reason_code` en el vocabulario del master, y no tiene sentido auditar "Ranking" para una identidad que ni siquiera completó el perfil mínimo o es provisional.

No se creó una arquitectura genérica de eventos: una sola columna (`ranking_profile_effective_from`) alcanza porque `competitive_branch`/`ranking_opt_in`/`location_id` siempre se escriben juntos, en la misma transacción, desde el único punto de escritura.

---

## 4. Candidatos, elegibilidad y scopes

Elegibilidad individual (`is_eligible`), evaluada por jugador, con **todos** los motivos que aplican acumulados en `eligibility_reason_codes` (nunca solo el primero): `account_inactive`, `account_excluded`, `ranking_opt_in_false`, `profile_data_changed_after_cutoff`, `competitive_branch_missing`, `location_missing`, `location_not_verified`, `level_not_calibrated`, `recalibrating_without_consolidated`, `inactive_180_days`, `no_computable_activity`.

Scopes (handoff §7): `local`/`provincial`/`pais` se construyen **solo** para candidatos con ubicación canónica verificada al cutoff — sin ubicación verificada, esos 3 `scope_type` no se generan (nunca un `scope_key` inventado). `global` es la excepción: su `scope_key` es el literal fijo `'GLOBAL'`, nunca depende del jugador, así que **todo** candidato del pool recibe una fila global — es el mecanismo que asegura auditabilidad de la exclusión por ubicación sin inventar territorio.

Orden/empate/densidad: `RANK() OVER (PARTITION BY scope_key ORDER BY level_internal DESC)` sobre los elegibles de cada scope — es exactamente "1, 1, 3" nativo de SQL, sin reimplementar `PG.assignPositions`. Densidad (0-4/5-14/15+) sobre el conteo de elegibles de ese universo. Global además tiene su propio candado: `locked` mientras los elegibles globales no cubran 2+ países (`density_status='locked'`, distinto de `insufficient`); una vez desbloqueado, aplica la misma densidad 0-4/5-14/15+.

---

## 5. Atomicidad e idempotencia

- El `INSERT` de `ranking_editions` se intenta **antes** de calcular ninguna fila. El `unique(period_start_at)` de Fase 1 es el único mecanismo de exclusión: dos llamadas concurrentes para el mismo cutoff se serializan por el propio índice único de Postgres (la segunda espera, después falla con `unique_violation`, y devuelve la edición ya creada por la primera sin tocar nada) — no hizo falta ningún `pg_advisory_lock` aparte.
- Toda la construcción de una edición (candidatos + filas de los 4 scopes) vive dentro de la misma llamada de función = la misma transacción implícita del caller; cualquier error revierte todo, nunca queda una edición sin todas sus filas.
- Segunda invocación con el mismo cutoff: devuelve la edición existente tal cual, sin recalcular ni una fila — probado explícitamente en el runner, incluyendo el caso donde el Nivel LIVE de un jugador ya incluido cambia DESPUÉS de publicada la edición (la fila publicada no se mueve).

---

## 6. Seguridad

`compute_ranking_edition` y `_bloque7_player_ranking_snapshot_as_of`: `revoke all from public`, `grant execute` únicamente a `service_role` (ninguna a `authenticated` — a diferencia de `complete_ranking_profile_data`, esta función nunca la llama un usuario final). Ningún `REVOKE` append-only de Fase 1 se tocó: la función solo hace `INSERT` sobre `ranking_editions`/`ranking_rows`. `search_path` fijo en las tres funciones nuevas/extendidas. Ningún parámetro acepta `player_id`/`scope_key` del cliente — el único parámetro es el `cutoff`, y se valida contra el calendario real de Buenos Aires antes de aceptarlo.

---

## 7. Validación estática realmente ejecutada

- lectura completa de `get_player_level_state_as_of`/`officialize_match_validation` (comentario `B6-A-13`) antes de decidir que `lastRatedAtAfter` ya es `played_at`-based y reutilizable sin cambios;
- grep de todo caller real de `get_player_level_state_as_of` (`match-officialize-core.ts`) para confirmar que agregar `algorithmVersion` al jsonb es aditivo, no rompe nada;
- verificación de balance de paréntesis/comillas/bloques `$$…$$` y `$fn$…$fn$` de ambos archivos SQL nuevos, con un script que primero elimina comentarios y literales — balance 0 en los dos;
- verificación manual, columna por columna, de que cada `INSERT ... SELECT` hacia `ranking_rows` (3 variantes: local/provincial/país, global desbloqueado, global bloqueado) tiene exactamente 23 columnas en la misma posición que el `INSERT INTO (...)`;
- dos bugs reales encontrados y corregidos en esta misma ronda, antes de terminar: (1) un `CROSS JOIN LATERAL` duplicado que dejaba `snap` ambiguo; (2) un `JOIN` normal (en vez de `LEFT JOIN`) contra la densidad agregada de cada `scope_key`, que hubiera **descartado silenciosamente** a los candidatos no elegibles de un `scope_key` sin ningún elegible — exactamente el caso real de hoy en Staging (handoff §10) — y además violaba el `NOT NULL` de `total_eligible`, haciendo fallar la función en su primera invocación real.

**Nada se ejecutó contra Supabase real** (no autorizado esta ronda). No se declara PASS de ninguna prueba que dependa de aplicar la migración.

---

## 8. Qué queda expresamente para fases siguientes

- `pg_cron`/publicación automática (Fase 4).
- RPCs de lectura para el cliente — el filtro de Nivel dentro de cada banda (handoff §8) se resuelve ahí, sobre este mismo snapshot, sin crear snapshots separados por banda.
- Frontend, eliminación de mocks.
- El vocabulario completo de `eligibility_reason_codes` puede crecer si Fase 3 encuentra un motivo real no cubierto acá — la columna es `jsonb` libre a propósito (F1-C05), no hace falta otra migración para agregar un código nuevo.

---

## 9. Bloqueos reales

Ninguno.

## 10. Decisiones abiertas

Ninguna — el master (`Ranking_BRAMU.md` + `03_Revision_Central_Analisis.md` + `05_Revision_Central_Fase_1.md`) ya resolvía todo lo que hacía falta para esta fase.

---

**Fin de Fase 2. No se aplicó nada a Supabase. No se empezó Fase 3.**
