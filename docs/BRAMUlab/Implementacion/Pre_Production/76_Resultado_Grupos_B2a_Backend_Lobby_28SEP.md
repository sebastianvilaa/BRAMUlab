# Resultado — Grupos BRAMU · B2a · Backend del lobby

**Fecha:** 28/09/2026 · **Rama:** `staging` · **Handoff:** `75_Handoff_Grupos_B2a_Backend_Lobby_28SEP.md`
**Sin frontend, sin foto/Storage.** B1 (server-backed, cerrado en `74_Cierre_Grupos_B1_28SEP.md`) queda intacto: 0 archivos bajo `bramulab/` tocados, ningún cambio de bundle. Un deploy de BRAMUlab puede ser ignorado por Vercel sin problema (tal como anticipaba el handoff).

**Estado:** implementado y con sintaxis verificada; **NO aplicado en Supabase Staging desde este sandbox** (sin Supabase CLI/psql/credenciales, mismo límite que todas las rondas anteriores de Grupos). Falta que Central aplique la migración y corra el verify. **No se declara B2 completo** — falta B2a aplicado+verificado en Staging, revisión de Central, y recién después B2b/B2c.

## Qué se construyó

Migración [20260928190000_preprod_grupos_b2a_backend_lobby.sql](../../../../supabase/migrations/20260928190000_preprod_grupos_b2a_backend_lobby.sql):

### Refactor (handoff §5) — sin cambiar el contrato de B1
`get_group_competition_data` armaba inline el criterio "qué partidos califican para el grupo" (el mismo umbral ampliado de 7 días del hotfix de B1). Se extrajo a helpers internos compartidos, reusados ahora también por el lobby:

- `_groups_candidate_matches(group, from, to)` — antes la CTE `cand` inline;
- `_groups_is_member_at(group, player, at)` — antes el `exists()` del flag `isGroupMember`;
- `_groups_match_sets_json`/`_groups_match_players_json`/`_groups_week_matches_json` — arman el array `matches`/`weekMatches` en la forma que ya lee `bramulab/groups.js#adaptServerCompetitionMatches` (B1), un único punto que lo construye;
- `_groups_members_json` — extraído de `_groups_detail_json` (mismo output, ahora reusado también por el lobby).

`get_group_competition_data` queda con el **mismo JSON de salida** (verificado con un test de consistencia directo en el verify nuevo, ver T15 abajo) — es un refactor de implementación, no de contrato.

### `get_groups_lobby(p_week_from, p_week_to)` — nueva RPC
Por cada grupo activo donde el caller es miembro activo: `groupId/name/createdAt/activeMemberCount/isAdmin/lastActivityAt/members[]/weekMatches[]`. `members`/`weekMatches` tienen exactamente la misma forma que `get_group_detail`/`get_group_competition_data` — B2b podrá reusar el adaptador de B1 sin un segundo shape. **Sin puntos/top-3/bonus/posiciones en SQL**: eso sigue siendo `groups.js`.

### `lastActivityAt` — actividad significativa autoritativa (`_groups_last_activity_at`)
Máximo entre `group_events.occurred_at` (creación, rename, alta/baja de miembro, promoción/democión de admin — todos los tipos que `_groups_log` ya registra desde Fase A) y `match_actions.occurred_at` con `action_type in ('validated','correction_accepted')`, **solo de partidos candidatos de ESE grupo** (`_groups_candidate_matches` sin acotar por fecha). Un partido que no calificó nunca mueve el orden. Foto queda para B2c (`photo_changed`, no existe todavía). Orden final: `lastActivityAt DESC, createdAt DESC, groupId` — desempate estable, nunca actividad del caller.

### Regla heredada de B1 — no hay regresión
El umbral de candidatos sigue ampliado (`joined_at - 7 días`), nunca `joined_at <= played_at` exacto. El piso semanal EXACTO sigue siendo autoridad de `groups.js` (sin cambios ahí). Un alta a mitad de semana sigue pudiendo convertir un partido en candidato esa misma semana; nunca habilita semanas anteriores.

## Seguridad

Mismo patrón Fase A/B1: todos los helpers nuevos son `SECURITY DEFINER` con `search_path` fijo, `revoke all ... from public`, **sin GRANT a `authenticated`/`anon`** (uso interno exclusivo, llamados desde dentro de otras funciones `SECURITY DEFINER`). `get_groups_lobby` — `GRANT EXECUTE` únicamente a `authenticated`. Ningún GRANT de tabla se amplió; las tablas de Grupos siguen server-only sin política directa. Sin rate limit (lectura, mismo criterio que `list_my_groups`/`get_group_detail`/`get_group_competition_data`, que tampoco lo tienen).

## Verify SQL nuevo

[verify-preprod-grupos-b2a-backend-lobby.sql](../../../../supabase/tests/verify-preprod-grupos-b2a-backend-lobby.sql) — transaccional (`BEGIN`/`ROLLBACK`), fixtures propios (6 cuentas reales, 3 grupos de 1/2/3 miembros). Cubre los 15 tests del handoff §7: solo-mis-grupos, 1/2/3+ miembros, payload de membresías/períodos, candidatos de la semana, alta misma-semana no excluye, alta no habilita semana anterior, 2/4 nunca produce actividad, 3/4 sí, `validated`/`correction_accepted` calificables mueven `lastActivityAt` y los no calificables no, member add/remove/reentry/admin/rename/creación mueven actividad, orden final + estabilidad del desempate, caller ajeno no ve nada, y permisos de los 8 objetos nuevos. El test #15 del handoff ("verify Fase A/B1 sigue PASS") no se reproduce completo acá (evita duplicar esos archivos) — en su lugar hay una prueba de **consistencia directa**: el mismo partido devuelto por `get_groups_lobby().weekMatches` y por `get_group_competition_data().matches` debe ser **JSON idéntico**, prueba concreta de que el refactor no forkeó el comportamiento.

**No ejecutado contra una base real** (sin Postgres/Supabase CLI en este sandbox) — solo validada la sintaxis con un parser real de PostgreSQL (pglast: migración 27 sentencias, verify 25 sentencias + 17 bloques PL/pgSQL, ambos sin errores).

## Pendiente para Central

1. Aplicar `20260928190000_preprod_grupos_b2a_backend_lobby.sql` en Supabase Staging.
2. Correr `verify-preprod-grupos-b2a-backend-lobby.sql` (debe terminar en `GRUPOS_B2A_BACKEND_LOBBY_VERIFY_PASS`).
3. Re-correr `verify-preprod-grupos-fase-a.sql` y `verify-preprod-grupos-b1-membresia-semanal-hotfix.sql` para confirmar que el refactor no rompió el contrato ya validado.
4. Revisar Security Advisor después del DDL.
5. Recién con eso en verde, habilitar B2b (frontend del lobby) — no iniciado en esta ronda.

No se tocó `main`, Production ni BRAMUlive. No se rediseñó ni se tocó el detalle/selector/motor de puntos ya validados.


## Revisión Central — bloqueo antes de aplicar en Staging

Central revisó el SQL antes de aplicarlo y detectó un punto que el verify actual no cubre.

`_groups_candidate_matches` usa deliberadamente la cota amplia `joined_at - 7 days` para **no excluir candidatos** que después `groups.js` decide con el lunes exacto de la semana. Eso es correcto para `weekMatches`/B1.

Pero `_groups_last_activity_at` reutiliza ese conjunto amplio como si ya fueran partidos **calificables definitivos**. En un borde de semana puede ocurrir:

- un jugador entra/reingresa esta semana;
- existe un partido suyo de la semana anterior dentro de la ventana amplia de 7 días;
- ese partido no debe contar para el grupo;
- una `correction_accepted` posterior podría, sin embargo, mover `lastActivityAt` y ordenar el grupo como si el partido hubiera calificado.

Esto contradice la regla cerrada de lobby: **un partido que no califica para el grupo no mueve la actividad**.

El problema expone además una diferencia preexistente: la semana de Grupos se calcula hoy en hora local del dispositivo en `PH.startOfWeekMonday`, mientras que un orden autoritativo server-side necesita una frontera semanal única.

**Estado:** B2a todavía NO se aplica en Supabase Staging. Primero hay que cerrar la frontera semanal autoritativa para Grupos V1 y corregir `_groups_last_activity_at` + verify de borde de semana. El resto del refactor/payload se mantiene.
