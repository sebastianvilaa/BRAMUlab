# Backend Bloque 7 — Resultado de Fase 3 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `fb91f9801d9ec174a61b6fbe1be305e3c4e7a42e` (`13_Handoff_Fase_3_Claude.md`).
**Alcance ejecutado:** RPCs de lectura server-side sobre las ediciones ya publicadas por Fase 2, su runner SQL transaccional, y esta documentación. No se aplicó nada a Supabase. No se tocó frontend, `pg_cron`, Vercel, `main`, Production ni BRAMUlive. No se empezó Fase 4.

---

## 1. Archivos

- `supabase/migrations/20260922150000_bloque7_fase3_read_rpcs.sql` — esquema (`ranking_network_hidden`), helpers internos y las 7 RPCs públicas.
- `supabase/tests/verify-bloque7-fase3.sql` — runner transaccional (`BEGIN...ROLLBACK`).

---

## 2. Regla crítica seguida en todo: el cliente nunca envía un territorio arbitrario

Para Local/Provincial/País, `get_ranking_classification`/`get_my_ranking_position` resuelven el `scope_key` **server-side**, desde la fila propia del caller en la edición vigente — el cliente solo elige `scope_type` (y rama, y banda opcional). `get_profile_ranking_summary` usa siempre los ámbitos propios del jugador **objetivo** (nunca de quien mira), leyendo directo de `ranking_rows`. Ningún parámetro de ninguna RPC acepta un `scope_key`/localidad/provincia/país libre — "Explorar rankings" queda fuera de V1 tal como pide el handoff.

---

## 3. `_bloque7_scope_rows` — fuente única de lectura

Toda RPC pública lee a través de este helper, nunca reimplementa el ranking:

- **Sin filtro de banda:** devuelve exactamente lo que `compute_ranking_edition` (Fase 2) ya congeló — nunca recalcula.
- **Con filtro de banda (handoff §5):** filtra por `level_band`, recalcula `RANK()`/denominador/densidad **dentro** de esa banda sobre `level_internal` congelado. Si el universo sin filtro ya estaba `locked` (Global sin 2+ países de esa rama), la banda **hereda** ese lock — el desbloqueo es una propiedad de diversidad de país de toda la rama, no de una banda, así que filtrar por Nivel nunca "desbloquea" nada.

`_bloque7_compute_movement` compara la misma `scope_key`+rama+banda contra la edición anterior (`_bloque7_previous_edition_id`, por `period_start_at`). Territorio distinto, banda distinta o sin fila anterior → `'nuevo'`, nunca un delta fabricado — esto sale gratis de la propia semántica de `_bloque7_scope_rows` (si el jugador no estaba en esa banda/scope la edición anterior, simplemente no hay fila que leer).

---

## 4. RPCs creadas

| RPC | Rol | Qué hace |
|---|---|---|
| `get_current_ranking_edition()` | `authenticated` | Última edición publicada, o `{"edition": null}` explícito. |
| `get_ranking_classification(scope_type, branch, band?, search?, limit?, offset?)` | `authenticated` | Clasificación paginada/buscable. `scope_key` resuelto server-side. Devuelve también `totalEligible`/`densityStatus` del universo aunque `rows` quede vacío (insuficiente/locked) — para no perder el motivo. |
| `get_my_ranking_position(scope_type, band?)` | `authenticated` | "Tu posición": estado propio, puesto/total si existe, movimiento, ventana de ±2 filas de contexto. Nunca inventa puesto para CALIBRANDO/sin ubicación/sin rama. |
| `get_ranking_network(branch?)` | `authenticated` | "Mi red": propio + relaciones de partido computable/validado y elegible dentro de 180 días **antes del cutoff de la edición** (nunca `now()`). Umbral propio 1-2 sin puesto / 3+ con puesto (distinto del territorial). Excluye lo oculto personalmente. |
| `set_ranking_network_hidden(hidden_player_id, hidden)` | `authenticated` | Ocultar/restaurar de Mi red — idempotente, presentación pura, nunca toca partidos/Nivel/Ranking oficial. Rechaza ocultarse a sí mismo. |
| `get_profile_ranking_summary(player_id)` | `authenticated` | Tarjeta territorial de Perfil (propio o público, misma fuente — Ranking_BRAMU.md §15.1). Siempre los ámbitos del jugador objetivo. |
| `get_home_ranking_insight()` | `authenticated` | TU MOMENTO — reusa `get_my_ranking_position('local', null)` tal cual, sin redacción de Intelligence. |

Ninguna fila pública expone `level_internal`, `eligibility_reason_codes`, email ni `auth_user_id` — solo las columnas de `Ranking_BRAMU.md §15`/handoff §6.

---

## 5. Mi red — de dónde sale la membresía

Reusa exactamente la misma fuente que Fase 2 (`match_level_results` con `effect_status='applied'` y `eligible=true`, `matches.status='validated'`, con el mismo doble-chequeo de `matches.status` que ya usa `get_player_match_history_for_level_engine` de Bloque 6). El Nivel de cada miembro se lee de su fila `scope_type='global'` ya congelada de la edición vigente — nunca se recalcula ni depende de que cada miembro comparta el mismo territorio (Ranking_BRAMU.md §9/§10: "no usa umbrales territoriales"). `ranking_network_hidden` es una tabla mutable (no append-only) nueva, mismo criterio de RLS/grants que `match_user_state` (Bloque 5) — deny-by-default para el cliente, `SELECT/INSERT/DELETE` (nunca `UPDATE`, no hace falta) para `service_role`.

---

## 6. Seguridad

Las 7 RPCs públicas: `revoke all from public`, `grant execute` únicamente a `authenticated` (nunca `anon`). Las de lectura pesada (`get_ranking_classification`, `get_my_ranking_position`, `get_ranking_network`, `get_profile_ranking_summary`) llaman a `consume_rate_limit` (mismo patrón de Bloque 4). Los tres helpers internos (`_bloque7_scope_rows`, `_bloque7_previous_edition_id`, `_bloque7_compute_movement`) están `revoke all from public` sin ningún `grant` — solo alcanzables desde otra función `SECURITY DEFINER` del mismo owner. `search_path` fijo en las 10 funciones nuevas.

---

## 7. Validación estática/local realmente ejecutada

- verificación de balance de paréntesis/comillas/bloques `$$…$$` de la migración y del runner — balance 0 en ambos;
- recomputación manual de cada número usado en las aserciones del runner ANTES de fijarlas (densidad/empate por banda, movimiento exacto, total real de Global locked) — se encontraron y corrigieron dos imprecisiones reales antes de cerrar: (1) el total de Global M no era 9 como decía un comentario a mano, sino 10 (7 de fondo + caller + 2 compañeros de Mi red, todos AR); (2) faltaba `PERFORM` delante de una llamada a función que descarta su resultado (`_b7t_add_level_event`), que habría sido un error de sintaxis PL/pgSQL real;
- verificación columna-por-columna de los `INSERT` sintéticos de `matches`/`match_revisions`/`match_level_results`/`match_level_result_players` contra los `NOT NULL` reales de Bloque 5/6 (sin default), para no fallar por una columna faltante;
- confirmación de que `RANK()`/`COUNT(*) OVER()` (tipo `bigint`) se castean explícitamente a `integer` antes de salir por `_bloque7_scope_rows` (`RETURNS TABLE` declarado en `integer`) — evita depender del cast de asignación implícito de Postgres sin poder probarlo.

**Nada se ejecutó contra Supabase real** (no autorizado esta ronda). El runner usa el mismo mecanismo de `verify-bloque7-fase1.sql` (tomar en préstamo una cuenta real ya registrada de Staging, impersonada vía `set_config('request.jwt.claim.sub', ...)`, con fixtures de Ranking fabricados directo) para poder ejercitar las RPCs que resuelven `auth.uid()` — no se declara ningún resultado como validado contra un proyecto real.

---

## 8. Qué queda expresamente para fases siguientes

- `pg_cron`/publicación automática (Fase 4).
- Frontend real, eliminación de mocks.
- Redacción/plantillas de `TU MOMENTO` vía BRAMU Intelligence (explícitamente fuera de esta fase).
- `Explorar rankings`, Ranking de Grupos, Race, matchmaking — fuera de V1, no tocados.

---

## 9. Bloqueos reales

Ninguno.

## 10. DECISIÓN ABIERTA

Ninguna — el master (`Ranking_BRAMU.md` + `13_Handoff_Fase_3_Claude.md`) resolvía todo lo necesario para esta fase.

---

**Fin de Fase 3. No se aplicó nada a Supabase. No se empezó Fase 4.**
