# Resultado — Grupos BRAMU · Fase A · Backend compartido

**Fecha:** 28/09/2026 · **Rama:** `staging` · **Handoff:** `65_Handoff_Grupos_Fase_A_Backend_Compartido_28SEP.md`
**Frontend:** sin cambios (0 archivos bajo `bramulab/`, bundle 04.11-h27 intacto).

## Estado: escrita y con sintaxis validada — PENDIENTE de aplicar y correr el verify en Staging

Este sandbox no tiene Supabase CLI, `psql` ni credenciales (igual que las rondas anteriores; Central aplicó siempre). Por eso:

- **NO está aplicada en Staging** y el verify **NO se ejecutó**. No declarar PASS todavía.
- Lo que sí se hizo: ambos `.sql` parsean sin errores con el parser real de PostgreSQL (pglast) — migración 61 sentencias, verify 39 sentencias (+21 bloques PL/pgSQL del verify). El cuerpo PL/pgSQL del trigger `_groups_assert_has_active_admin` no pudo volcarse con pglast (limitación de la herramienta con `TG_OP`), sin evidencia de error.

**Para cerrar la fase (Central):** aplicar `supabase/migrations/20260928120000_preprod_grupos_fase_a_backend_compartido.sql` en Staging y ejecutar `supabase/tests/verify-preprod-grupos-fase-a.sql`. Debe terminar con `GRUPOS_FASE_A_VERIFY_PASS`. El verify crea sus propios fixtures (`auth.users`+players) y termina en `ROLLBACK`; no necesita cuentas reales. Riesgo conocido: si `auth.users` exige otra columna NOT NULL en este proyecto, el fixture inicial fallará (error de fixture, no de contrato). Si el control de seguridad de la herramienta bloquea el script (como en P0.3), no se debe forzar.

## Qué se construyó

**Tablas** (RLS deny-by-default, cero políticas, sin GRANT a `anon`/`authenticated`): `groups` (borrado lógico), `group_memberships` (una fila por PERÍODO; índice único parcial = un solo período abierto por jugador/grupo; `is_admin` en el período), `group_events` (auditoría append-only).

**Invariante "nunca cero admins"** en dos capas: cada RPC bloquea el grupo (`FOR UPDATE`) y valida; además un constraint trigger *deferred* aborta cualquier transacción que deje un grupo activo sin admin activo (cubre escrituras directas y carreras).

**Decisiones:** reingreso abre período nuevo y **no hereda admin**; quitar cierra `left_at`, nunca borra; solo admins mutan; solo miembros activos leen; "no existe / eliminado / no soy miembro" devuelven el mismo `group_not_found`; mutaciones repetidas son idempotentes (`changed:false`); nombre 1–60 caracteres; máx. 100 miembros iniciales (guardia de abuso, no regla de producto).

## Contrato que debe consumir Fase B

Todas SECURITY DEFINER, `EXECUTE` solo `authenticated`. Respuestas `{ok:true,…}` o `{ok:false, code}`; sesión inválida / rate limit = excepción.

| RPC | Devuelve |
|---|---|
| `list_my_groups()` | `groups[{groupId,name,createdByPlayerId,createdAt,updatedAt,isAdmin,myJoinedAt,activeMemberCount}]` |
| `get_group_detail(group)` | `group{groupId,name,…,isAdmin, members[{playerId,isActive,isAdmin,periods[{joinedAt,leftAt}]}]}` |
| `create_group(name, member_ids[])` | `group` (creador = miembro+admin; todo o nada) |
| `rename_group` / `add_group_member` / `remove_group_member` / `promote_group_admin` / `demote_group_admin` | `group` actualizado (+`changed`) |
| `delete_group(group)` | `{ok:true}` (lógico) |
| **`get_group_competition_data(group, from?, to?)`** | `group` (con períodos históricos) + `matches[{matchId,playedAt,formatId,scoringSystem,winnerTeam,sets[{setNumber,gamesA,gamesB,tiebreakA,tiebreakB}],players[{playerId,team,position,isGroupMember,levelBefore}]}]` |

Códigos: `group_not_found`, `not_admin`, `invalid_name`, `player_not_found`, `target_not_member`, `last_admin`, `too_many_members`.

**Autoridad deportiva:** `get_group_competition_data` es *la* lectura para el motor puro `bramulab/groups.js` (Fase B lo alimenta con esto; **no hay fórmula de puntos/top3/Race en SQL**). Solo entrega partidos `validated` con ≥3 miembros activos en `played_at` (filtro de privacidad/alcance; el motor re-evalúa con los períodos recibidos), con los sets de la **revisión oficial vigente**, así que una corrección oficial se propaga sola. Un mismo partido aparece en todos los grupos donde califica.
`levelBefore` = `effective_level` del resultado de Nivel aplicado y elegible de ese partido; **NULL si no hay evidencia** → el motor no debe otorgar Sorpresa (nunca Nivel simulado ni actual).

Notas para Fase B: el contrato no incluye nombres/avatares (resolver por `player_id` con `get_players_compact`); `regulationCompleted` no existe en backend (todo `validated` cuenta como completo); Fase B deberá adaptar el shape de `groups.js` (`players[].userId`→`playerId`, `members[].periods`) y que `computeSimulatedLevelBeforeMatch` sea reemplazado por `levelBefore`. Los participantes no miembros (p. ej. el 4.º jugador) llegan solo con `playerId`.

## Cobertura del verify (riesgos del handoff)

T1 creador miembro+admin · T2 agregar · T3 reingreso = período nuevo con el anterior intacto · T4 no-admin bloqueado en las 6 mutaciones · T5 admin promueve admin · T6 `player_id` inexistente/provisional/inactivo/null rechazados · T7 último admin (RPC + backstop DB) · T8 con dos admins se puede quitar uno · T9 eliminar preserva memberships/partidos/Nivel y sale de lecturas · T10 dos miembros ven la misma definición, no miembro no lee · T11 partidos 3/4 y 4/4, mismo partido en 2 grupos, revisión vigente, filtros de fecha, exclusión de pendiente/1 miembro/anterior al ingreso · T12 sin snapshot ⇒ `levelBefore` null · permisos y RLS.

## Fuera de alcance respetado

Sin frontend/UX, sin `groups.js`, sin migrar grupos locales, sin invitaciones/notificaciones, sin tocar Nivel/Ranking/main/Production/BRAMUlive. Fase B no iniciada.
