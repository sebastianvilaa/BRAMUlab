# Backend Bloque 5 — Resultado de esta ronda de implementación

**Fecha:** 20/09/2026
**Rama:** `staging`
**HEAD de partida:** `c4485d2` (autorización de ChatGPT)
**Documentos seguidos, en orden de precedencia:** `01_Handoff_Inicio_Bloque_05.md` → `02_Analisis_Claude.md` → `03_Plan_Implementacion_Claude.md` → `04_Revision_ChatGPT.md` (precedencia sobre el plan de Claude cuando hubo diferencia).

**Estado de Bloque 5 al cierre de esta ronda: IMPLEMENTADO Y REVISADO, NO VERIFICADO CONTRA SUPABASE REAL.** No se cierra formalmente el bloque en este documento — eso requiere la corrida real de `verify-bloque5.mjs` contra Staging, que esta sesión no pudo ejecutar (ver §2, bloqueo de credenciales).

> **Nota posterior (20/09/2026):** `06_Revision_Pre_Staging_ChatGPT.md` encontró correcciones obligatorias sobre la implementación descrita acá abajo antes del primer intento real contra Supabase — ver `07_Correccion_Pre_Staging_Claude.md` para el detalle exacto de qué cambió (en particular: Bloque 5 ya NO marca un partido `validated`, §1 de esa revisión). Este documento queda como registro histórico de esa ronda; el comportamiento real y vigente del código es el que describe `07_Correccion_Pre_Staging_Claude.md`.

---

## 1. Qué se implementó

### 1.1 Esquema (3 migraciones nuevas, sin aplicar)

- `supabase/migrations/20260920180000_bloque5_matches_core.sql` — las 7 tablas (`matches`, `match_participants`, `match_sets`, `match_revisions`, `match_submissions`, `match_actions`, `match_user_state`), RLS deny-by-default, policies de participante, GRANTs (`authenticated`/`service_role`) e índices, exactamente como se especificó en `02_Analisis_Claude.md` §3/§10.
- `supabase/migrations/20260920190000_bloque5_rpcs_read.sql` — `compute_pending_action_count` (interno), `get_pending_action_count`, `get_my_matches`, `get_match_detail`, `hide_match_for_me`, `set_match_private_note`, `list_related_provisional_players` (Decisión #3 de ChatGPT).
- `supabase/migrations/20260920200000_bloque5_create_or_attach_rpc.sql` — `create_or_attach_match`, la RPC central.

### 1.2 Edge Function

- `supabase/functions/create-or-attach-match/index.ts` — mismo patrón exacto que `officialize-onboarding` (Bloque 3): verifica JWT con el cliente anon, revalida sets/formato con el motor JS compartido, llama a la RPC con la service role key.
- `supabase/functions/_shared/engine.js` y `supabase/functions/_shared/match-load.js` — symlinks reales a `bramulab/engine.js`/`bramulab/match-load.js` (nunca copias), mismo mecanismo que `level.js`/`level-calibration.js` de Bloque 3.

### 1.3 Refactor de código de producto (comportamiento preservado, verificado)

- `bramulab/match-load.js` — se extrajo `validateMatchSets(rawSets, formatId)` de `validateMatchDraft` (la mitad "sets → resultado", sin tocar la validación de nombres/fecha). `validateMatchDraft` ahora llama a esta función nueva. Es la pieza que la Edge Function reutiliza vía symlink — nunca se reimplementó la regla de set/formato en SQL.
- `bramulab/tests.html` — se agregaron 6 tests directos para `validateMatchSets` (llamando la función tal como la va a llamar la Edge Function, sin pasar por `validateMatchDraft`).

### 1.4 Frontend nuevo — escrito, revisado, **sin wiring todavía**

- `bramulab/matches.js` (nuevo módulo) — cliente de las RPCs/Edge Function de Bloque 5, mismo patrón que `auth.js`: `isConfigured()`, `createOrAttach`, `getMyMatches`, `getMatchDetail`, `hideMatchForMe`, `setMatchPrivateNote`, `getPendingActionCount`, `listRelatedProvisionalPlayers`.
- `bramulab/store.js` — agregado el outbox local (`bramulab.matchOutbox.v1` + `loadMatchOutbox`/`saveMatchOutboxEntry`/`removeMatchOutboxEntry`/`getMatchOutboxEntry`), sin tocar ninguna función existente.

**Deliberadamente NO se tocó** `app.js`/`index.html`/`sw.js`: el checkpoint acordado en `04_Revision_ChatGPT.md` §4 exige detenerse antes de una integración frontend amplia si el backend real de Staging no queda verde, y esta ronda no pudo verificar nada contra Staging (§2). `matches.js`/el outbox de `store.js` son código nuevo e inerte — no los llama nadie todavía, cero riesgo de regresión sobre lo que ya funciona — pero la bifurcación real (`buildManualMatchSnapshot`, `getEffectiveHistory`, el botón "Eliminar partido") queda para la próxima ronda, una vez confirmado el backend.

---

## 2. Bloqueo real: sin acceso a Supabase/Deno en este entorno

Esta sesión **no tiene** en ningún momento:

- variables de entorno `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (confirmado: `env | grep -i supabase` vacío);
- Supabase CLI instalado (`which supabase` → no encontrado);
- Vercel CLI, `op` (1Password CLI) ni ningún otro gestor de credenciales instalado;
- Docker ni PostgreSQL local (`which docker`/`psql`/`pg_ctl`/`initdb` → ninguno encontrado) — tampoco pude levantar una base descartable para ejecutar el SQL de verdad;
- Deno CLI (`which deno` → no encontrado) — tampoco pude tipar/ejecutar la Edge Function localmente.

Consecuencia directa: **no pude aplicar ninguna migración, no pude desplegar la Edge Function, y no pude correr `verify-bloque5.mjs` ni una sola vez contra un Postgres real.** Todo el SQL y el TypeScript de esta ronda están escritos siguiendo al pie de la letra los patrones ya validados de Bloques 1-4 (mismo estilo de RLS/GRANT, mismo patrón Edge Function + RPC `service_role`, mismo contrato de error `jsonb {ok,code}`), y revisados a mano línea por línea (trace manual de los casos crear/confirmar/redeclarar/revisar/ambiguo, balance de `if/end if`/`loop/end loop`, verificación de que `extensions.digest`/`gen_random_uuid` se llaman igual que en las migraciones ya aplicadas de Bloque 4) — pero **"revisado a mano" no es lo mismo que "verificado contra Postgres real"**. No afirmo que el backend esté verde: afirmo que está listo para el primer intento real.

Esto **no es una decisión de producto** que alguien deba resolver — es una limitación de entorno de esta sesión. No requiere que Sebastián piense nada; requiere que alguien (Sebastián, u otra sesión de Claude Code con las credenciales de Supabase Staging ya configuradas en su entorno) ejecute los pasos de la §5 de este documento.

### Un bug real que encontré y corregí gracias a la revisión manual (sin haber podido ejecutarlo)

Durante la revisión manual encontré una condición de carrera real en el diseño original de `02_Analisis_Claude.md`: el caso "0 candidatos → crear partido nuevo" no tiene ninguna fila de `matches` que bloquear con `for update` todavía, así que dos transacciones concurrentes que representan el MISMO encuentro nuevo podrían ambas ver "0 candidatos" y crear dos filas duplicadas. Lo corregí agregando un **advisory lock transaccional por huella** (`pg_advisory_xact_lock(hashtextextended(v_fingerprint, 0))`) antes de la búsqueda de candidatos — documentado en el propio SQL (`20260920200000_bloque5_create_or_attach_rpc.sql`). El test de concurrencia de `verify-bloque5.mjs` (§10 del script) ejercita exactamente este camino.

---

## 3. Ajustes de diseño hechos durante la implementación (no estaban en 02_Analisis_Claude.md tal cual)

Ninguno de estos cambia el modelo de datos ni las 4 decisiones ya cerradas por ChatGPT — son detalles de implementación que solo aparecen al escribir el SQL de verdad:

1. **Canonicalización siempre recalculada, nunca consultada contra el partido existente.** El diseño original consideraba "mirar cómo quedó orientado el partido ya creado" para decidir team_a/team_b de una carga nueva. Al escribir el SQL noté que eso es innecesario: como la canonicalización (la pareja cuyo par de IDs ordenado es lexicográficamente menor es `team_a`) es una función puramente determinística de los mismos 4 `player_id` + misma composición de pareja, dos cargas independientes del mismo encuentro llegan siempre, por construcción, a la MISMA asignación team_a/team_b — sin necesitar ninguna consulta a `match_participants` del partido existente. Esto simplificó bastante el SQL y elimina una clase entera de bugs de orientación.
2. **`matches` no guarda `winner_team`.** El ganador es 100% derivable de `sets` (games por equipo) — guardarlo aparte hubiera sido una tercera copia de la regla de victoria (navegador, Edge Function, y ahora una columna), exactamente lo que Bloque 3 enseñó a evitar. Se dejó fuera; el cliente lo deriva con el mismo `Engine` que ya usa.
3. **Comparación de "¿el score coincide?" vía conteo + `IS DISTINCT FROM`, no igualdad de `jsonb`.** Más verbosa que comparar dos blobs `jsonb` con `=`, pero evita un riesgo real de falso-negativo por diferencia de tipo (string vs número) al construir el `jsonb` de cada lado — dado que no pude ejecutar el SQL para confirmar empíricamente que la comparación por igualdad de `jsonb` se comporta como se espera, preferí la forma más explícita y auditable a simple vista.
4. **`extensions.digest(...)` en vez de `digest(...)` a secas.** `pgcrypto` está instalado `with schema extensions` desde Bloque 4; las funciones `SECURITY DEFINER` de Bloque 5 fijan `search_path = public`, así que un `digest()` sin calificar habría fallado en tiempo de ejecución. Se corrigió antes de terminar, siguiendo el mismo criterio que ya usa `create_claim_link`/`claim_provisional_player` en Bloque 4.
5. **Expiración lógica también en la búsqueda de candidatos de `create_or_attach_match`**, no solo en las RPC de lectura. `02_Analisis_Claude.md` ya pedía expiración perezosa para `get_my_matches`/`get_pending_action_count`, pero al escribir el SQL noté que si no se aplicaba también al `WHERE` de la búsqueda de candidatos, una carga nueva podría "revivir" un partido `pending_validation` lógicamente vencido en vez de tratarlo como si no existiera. Corregido.

---

## 4. Qué quedó validado (y con qué método)

| Qué | Método | Resultado |
|---|---|---|
| Suite local completa | `tests.html` en navegador real (dev server del proyecto) | **1414/1414** (1408 previos + 6 tests nuevos de `validateMatchSets`) |
| Tests de infraestructura Node | `node --test bramulab/scripts/env-guard.test.mjs bramulab/api/health.test.mjs` | **17/17**, sin cambios |
| Sintaxis de todo el JS tocado/nuevo | `node --check` sobre los 9 módulos de `bramulab/*.js` + `matches.js` + `verify-bloque5.mjs` | Sin errores |
| Refactor de `match-load.js` no cambió comportamiento | Suite completa antes/después del refactor | Idéntico (1408/1408 → sigue en 1408 antes de sumar los 6 tests nuevos) |
| Lógica de `create_or_attach_match` (SQL) | Revisión manual línea por línea + trace de los 6 escenarios (crear, confirmar, redeclaración mismo lado, revisión nueva, ambiguo, validado) | Sin inconsistencias encontradas — **no ejecutado contra Postgres real** |
| Edge Function (TypeScript) | Revisión manual comparando contra `officialize-onboarding/index.ts` ya funcionando | Estructuralmente equivalente — **no tipado/ejecutado con Deno** |
| `verify-bloque5.mjs` | Sintaxis + revisión de contaminación cruzada entre cuentas de prueba (se encontró y corrigió una: `E` aparecía en 2 partidos antes de su propio test negativo de "provisional no relacionada") | Listo para correr — **no ejecutado contra Supabase real** |

**No se corrió ningún test contra Supabase Staging real.** Esta es la brecha central de esta ronda.

---

## 5. Qué falta — pasos exactos para quien tenga credenciales

1. `supabase link` al proyecto `bramulab-staging` (o pegar el SQL a mano en el SQL Editor, mismo procedimiento ya usado en Bloques 1-4).
2. Aplicar en orden: `20260920180000_bloque5_matches_core.sql` → `20260920190000_bloque5_rpcs_read.sql` → `20260920200000_bloque5_create_or_attach_rpc.sql`.
3. `supabase functions deploy create-or-attach-match`.
4. Correr `SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/tests/verify-bloque5.mjs` contra ese proyecto.
5. Si aparece alguna falla: es información real sobre un bug en el SQL/Edge Function de esta ronda — no hay ningún resultado "esperado en verde de antemano" que yo pueda garantizar sin haberlo corrido.
6. Recién con `verify-bloque5.mjs` en verde, continuar con la Fase D del plan (`03_Plan_Implementacion_Claude.md` §1): wiring de `app.js`/`index.html`/`sw.js` (bifurcar la carga manual, `getEffectiveHistory`, el botón "Eliminar partido").

---

## 6. Decisiones abiertas reales que quedaron pendientes

Ninguna decisión de producto nueva — las 4 de `02_Analisis_Claude.md` ya fueron cerradas por `04_Revision_ChatGPT.md` y esta ronda las implementó tal cual (ventana ±3h/mismo día, buscar también contra `validated`, `list_related_provisional_players` incluida, expiración perezosa). Los 5 ajustes de la §3 de este documento son detalles técnicos de implementación, no decisiones de producto — no requieren intervención de Sebastián/ChatGPT.

La única pregunta abierta real es operativa, no de producto: **¿quién/qué sesión tiene acceso a Supabase Staging para ejecutar la §5?** Eso es exactamente el bloqueo de la §2, no algo que se resuelva con más análisis.

---

## 7. Confirmación de alcance respetado

- **No** se aplicó ninguna migración a Supabase (imposible sin credenciales — nunca se intentó tampoco).
- **No** se tocó ninguna configuración de Vercel.
- **No** se desplegó la Edge Function a ningún entorno real.
- **No** se modificó `main`.
- **No** se modificó Production.
- **No** se tocó BRAMUlive.
- **No** se generaron secretos ni se pidieron credenciales a Sebastián.
- **No** se implementó ningún comportamiento de Bloque 6 (`Confirmar`/`Proponer corrección`/`No participé`, actualización de Nivel, incidencias de identidad) — los valores de `match_actions.action_type` y las columnas `annulled_at`/`annulment_reason` quedan declarados pero sin ningún emisor en Bloque 5, exactamente como especifica `02_Analisis_Claude.md`.
- **No** se migró historial local legacy.
- Los únicos archivos de código de producto modificados son `bramulab/match-load.js` (refactor puro, verificado sin cambio de comportamiento) y `bramulab/store.js` (agregado puro, sin tocar funciones existentes) — ambos ya cubiertos por la suite local en verde.
- `bramulab/app.js`, `bramulab/index.html` y `bramulab/sw.js` **no se tocaron** — el checkpoint de `04_Revision_ChatGPT.md` §4 así lo pedía mientras el backend no esté verde en Staging.
