# Resultado — B2a · Frontera semanal canónica (Buenos Aires) + lastActivityAt exacto

**Fecha:** 28/09/2026 · **Rama:** `staging` · **Handoff:** `77_Handoff_B2a_Frontera_Semanal_Canonica_28SEP.md`
**Bundle:** `04.11-h32`. **No aplicado en Supabase Staging desde este sandbox** (sin Supabase CLI/psql/credenciales) — Central aplica después de revisar, tal como pidió el handoff.

## El bug real que corrige

`_groups_last_activity_at` (B2a) usaba `_groups_candidate_matches` — el umbral **amplio** de 7 días pensado solo para nunca excluir datos de transporte (`weekMatches`) — como si fuera el criterio **definitivo** de qué partido cuenta. Un partido de la semana BA anterior a la efectiva de un alta, todavía dentro de esa cota de 7 días, podía mover `lastActivityAt` con un `validated`/`correction_accepted` posterior aunque no perteneciera a la semana deportiva real. No se había aplicado a Staging — Central lo encontró en revisión.

## Qué se cambió

Decisión de producto ya cerrada en `Grupos_BRAMU.md` ("Zona horaria canónica V1"): Grupos BRAMU V1 usa siempre `America/Argentina/Buenos_Aires` (lunes 00:00 → domingo 23:59:59.999 BA) para toda frontera semanal — nunca el huso del dispositivo ni de la sesión de Postgres.

**Backend** (misma migración B2a, todavía no aplicada — se corrigió en el archivo, no se agregó una migración correctiva aparte, porque el handoff lo permitía explícitamente):
- `_groups_week_start_ba(at)` — lunes 00:00 BA vía `AT TIME ZONE 'America/Argentina/Buenos_Aires'` (Postgres resuelve la tzdata real).
- `_groups_candidate_matches_exact(group, from, to)` — mismo criterio de 3/4 que `_groups_candidate_matches`, pero con el piso EXACTO en vez del umbral ampliado. **Uso exclusivo** de `_groups_last_activity_at`.
- `_groups_candidate_matches` (la amplia) **se mantiene sin cambios** — sigue alimentando `weekMatches`/`matches` (B1/B2a), que el cliente vuelve a filtrar con el piso exacto. Ningún contrato JSON de B1/B2a cambió.
- `_groups_last_activity_at` ahora se une contra la versión **exacta**.

**Frontend** (`bramulab/groups.js`/`app.js`) — el motor dejó de depender del huso del dispositivo para Grupos:
- `PG.weekStartBA(input)` (nuevo, puro): mismo cálculo que el SQL — Argentina no tiene horario de verano desde 2009, así que restar 3h fijas es matemáticamente equivalente a la conversión de zona con nombre que usa Postgres.
- `effectiveMembershipStartAt` (regla A de B1) pasa a usar `weekStartBA` en vez de `PH.startOfWeekMonday` (local).
- `computeRaceAnual` agrupa semanas con `weekStartBA`, no con `PH.startOfWeekMonday`.
- `app.js#renderActiveGroupPanels` (Semana actual/pasada del detalle de grupo, ya validado en B1) construye `weekStart` con `PG.weekStartBA(now)` en vez de `PH.startOfWeekMonday(now)`.
- `PH.startOfWeekMonday` (Actividad/Ranking/Home) **no se tocó** — sigue intencionalmente local a cada dispositivo; es un producto distinto y queda fuera de esta decisión.

Sin cambios de fórmula de puntos/bonus, sin duplicarla en SQL, sin tocar el detalle/selector ya validados, sin foto/Storage.

## Tests

Nuevo `bramulab/groups-b2a-frontera-semanal-ba.test.mjs` — **10/10 PASS**: `weekStartBA` contra los instantes límite exactos (incluido el caso trampa "ya es lunes en UTC pero todavía es domingo en Buenos Aires"), los 3 bordes de calificación 3/4 pedidos por el handoff (alta lunes + domingo anterior → no califica; alta lunes + mismo lunes antes de la hora exacta → sí; alta domingo + lunes de esa misma semana → sí), y guardas estáticas de que `app.js`/`computeRaceAnual` usan `weekStartBA`, nunca `PH.startOfWeekMonday`.

`supabase/tests/verify-preprod-grupos-b2a-backend-lobby.sql` — sección nueva "T-borde": `_groups_week_start_ba` contra los MISMOS instantes que el test JS (evidencia de paridad backend/frontend, ya que no pueden ejecutarse uno contra el otro en este sandbox); reproduce el bug real (un partido del domingo anterior a la semana de una alta lunes, bajo el umbral amplio viejo, habría contado — con el fix, un `validated`/`correction_accepted` nuevo sobre ese partido no mueve `lastActivityAt`); control positivo de que un `correction_accepted` sobre un partido sí calificable de la semana efectiva sí lo mueve; permisos de las 2 funciones nuevas.

Re-corridos y en verde: `groups-b1-server-backed.test.mjs` (24), `groups-b1-cierre-membresia-baja.test.mjs` (19), `h21-sistema-visual-unificado.test.mjs`, `cierre-ux-h13.test.mjs`. Suite general `node --test bramulab/*.test.mjs`: **419/420** — el único fallo, `h23`, es preexistente y no relacionado (confirmado en rondas anteriores).

## No verificado (honesto)

**No aplicado en Supabase Staging.** No se corrió el verify SQL contra una base real (sin Postgres/Supabase CLI en este sandbox) — solo sintaxis validada con un parser real de PostgreSQL (pglast: migración 33 sentencias, verify 30 sentencias, sin errores de DDL; el chequeo de cuerpo PL/pgSQL de `get_groups_lobby` da un falso positivo ya presente ANTES de esta ronda — limitación conocida del parser con `cross join lateral`, no un error real). No se probó en navegador.

## Pendiente para Central

1. Aplicar `20260928190000_preprod_grupos_b2a_backend_lobby.sql` (ya corregida) en Supabase Staging.
2. Correr `verify-preprod-grupos-b2a-backend-lobby.sql` (`GRUPOS_B2A_BACKEND_LOBBY_VERIFY_PASS`, incluida la sección "T-borde").
3. Re-correr `verify-preprod-grupos-fase-a.sql` y `verify-preprod-grupos-b1-membresia-semanal-hotfix.sql`.
4. Revisar Security Advisor después del DDL.
5. Con eso en verde, recién ahí habilitar B2b.

No se tocó `main`, Production ni BRAMUlive. No se inició B2b ni foto/Storage. No se abrió ninguna decisión de producto nueva.


## Revisión Central y aplicación real en Staging

Central revisó y aplicó B2a en Supabase Staging.

### Correcciones detectadas durante aplicación real

La ejecución contra Postgres real encontró defectos del SQL/verify que el parser local no había detectado:

1. `get_groups_lobby` tenía un paréntesis faltante alrededor de `jsonb_build_object(...) ORDER BY ...`.
2. El verify concatenaba `jsonb` con texto sin `::text` en varios mensajes.
3. T5 asumía que agregar D no podía volver calificable otro partido de esa misma semana; en realidad M_g2 pasa correctamente de 2/4 a 3/4 para G3.
4. T6 intentaba exigir exactitud sobre `weekMatches`, aunque ese payload es deliberadamente un conjunto amplio de transporte. Se movió la afirmación al helper exacto que gobierna actividad.
5. Un `_assert` usaba firma de 4 argumentos inexistente.
6. El uso de `WITH ORDINALITY` no tenía alias de columnas correcto.

Estas correcciones quedaron limitadas a sintaxis/fixtures/expectativas del verify y al paréntesis real de la RPC; no cambian la decisión de producto ni la fórmula deportiva.

### Estado real

- Migración `preprod_grupos_b2a_backend_lobby`: **APLICADA en Supabase Staging**.
- Versión registrada: `20260928235454`.
- Verify B2a: **GRUPOS_B2A_BACKEND_LOBBY_VERIFY_PASS**.
- Regresión B1: **GRUPOS_B1_MEMBRESIA_SEMANAL_HOTFIX_VERIFY_PASS**.
- Regresión Fase A: **GRUPOS_FASE_A_VERIFY_PASS**.
- Todos los runners terminan en rollback.
- Security Advisor detectó un único warning nuevo `function_search_path_mutable` sobre `_groups_week_start_ba`; se corrigió con migración separada `preprod_grupos_b2a_week_start_search_path` fijando `search_path = pg_catalog`.
- Advisor posterior: ese warning desapareció. Los warnings restantes son los ya conocidos/esperados (RPCs SECURITY DEFINER autenticadas, tablas server-only con RLS sin policy directa, leaked-password protection pendiente de Bloque 9).
- No aparecieron hallazgos de performance nuevos atribuibles a B2a.

### Deploy frontend h32

El commit h32 toca `bramulab/` para alinear el motor cliente con la semana BA, pero Vercel respondió **Deployment rate limited — retry in 24 hours** para BRAMUlab y BRAMUlive. No se reintentó para no gastar cuota.

Esto no bloquea el backend B2a aplicado: el contrato nuevo es backward-compatible. El código h32 queda en `staging` y deberá entrar en el próximo deploy disponible junto con la siguiente ronda frontend.

**Conclusión Central: B2a backend queda CERRADO EN STAGING.**
