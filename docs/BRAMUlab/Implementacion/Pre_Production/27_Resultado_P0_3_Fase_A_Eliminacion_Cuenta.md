# BRAMUlab — Resultado: P0.3 Fase A — eliminación/anonimización de cuenta

**Rama:** `staging`
**Fecha:** 27/09/2026
**HEAD base:** `0d54988` (`docs(preprod): preparar P0.3 Fase A eliminación de cuenta`)
**Origen:** handoff [`26_Handoff_P0_3_Fase_A_Eliminacion_Cuenta_27SEP.md`](26_Handoff_P0_3_Fase_A_Eliminacion_Cuenta_27SEP.md), tarea independiente ejecutada mientras la validación física de `04.11-h10` seguía pendiente.

**No se tocó frontend, bundle `04.11-h10`, `version.json`, Service Worker ni ningún asset.** Esta ronda es exclusivamente backend/SQL, sin ninguna migración aplicada a Staging ni ningún deploy remoto.

---

## 1. Auditoría del esquema (handoff §3.1)

Se auditaron las 28 tablas reales del esquema (`players`, `profiles` y las 26 restantes que referencian `player_id` directa o indirectamente) para identificar PII, snapshots de nombre y constraints que condicionan una anonimización segura. Resumen:

### Núcleo de identidad
- `players`: `player_id`, `type` (`registered`/`provisional`), `auth_user_id` (**FK a `auth.users`, `on delete set null`** — clave para el diseño en 2 pasos, ver §2), `display_name`, `is_active`.
- `profiles` (1:1 con `players`): `username`, `first_name`, `last_name`, `display_name`, `avatar_url` (ruta de Storage, nunca URL pública), `birth_date`, `gender`, `dominant_hand`, `preferred_side`, `competitive_branch`, `location_id`, `phone`, `allow_whatsapp_contact`, `current_category`, `terms_version`/`terms_accepted_at`, `ranking_opt_in`.

### Columnas de texto libre que pueden contener/embeber un nombre (en orden de relevancia real)
1. **`match_participants.display_name_snapshot`** (`not null`) — el snapshot de nombre más reutilizado del esquema, leído por ~8 RPCs de lectura distintas (`get_my_matches`, `get_match_detail`, `feed_metadata`, historial de Intelligence, etc.). Se resetea a `'Por identificar'`/al nombre del reemplazo en varios flujos de identidad ya existentes, pero **nada lo actualiza automáticamente cuando cambia `players.display_name`**.
2. **`intelligence_match_outputs.output` / `.audit`** (jsonb) — confirmado por lectura de código (`supabase/functions/_shared/intelligence-presentation.js#buildNameResolver`, líneas 68-78) que la narrativa persistida puede embeber el `displayName` de un jugador y sus compañeros/rivales dentro de texto libre (ej. "tu compañero X..."). Es un **output derivado/regenerable**, nunca la fuente de verdad.
3. `match_user_state.private_note` — texto libre tipeado por el propio jugador, 100% privado (una fila por `(match_id, player_id)`, nunca compartida).
4. `notifications.payload` — solo códigos/ids en la práctica actual (auditado en todos los `INSERT` existentes); son 100% privadas de cada jugador de todos modos.

Todo el resto de columnas de texto libre auditadas (`ranking_rows.location_display_label`, `match_actions.reason_code`, `match_actions.metadata`, `pilot_events.properties`, `match_submissions.result_payload`) resultaron ser, en el código actual, códigos fijos/ids o construidas exclusivamente a partir de `player_id`, sin nombre de jugador embebido.

### FKs a `players.player_id`
- **Con `on delete cascade`** (se limpiarían solas si se hiciera un `DELETE` físico de `players`): `notifications`, `player_saved_players` (ambas direcciones), `intelligence_match_outputs`, `provisional_claims.provisional_player_id`, `api_rate_limits`.
- **Sin `on delete`** (bloquean un `DELETE` físico de `players` mientras exista historial — confirman por qué el diseño correcto es ANONIMIZAR, nunca borrar la fila de `players`): `match_participants.player_id`, `match_actions.actor_player_id`, `match_submissions.submitted_by_player_id`, `match_user_state.player_id`, `ranking_network_hidden` (ambas direcciones), `ranking_rows.player_id`, `ranking_profile_events.player_id`, `location_change_events.player_id`, `pilot_events.player_id`, `match_identity_issues` (hasta 3 columnas de `player_id` por fila), `provisional_claims.created_by_player_id`/`claimed_by_player_id`.

### Búsqueda transversal en todo el repo (migraciones + Edge Functions)
- `auth.admin`/Auth Admin API: **0 ocurrencias**. No existe hoy ningún camino que invoque el Auth Admin API de Supabase.
- `UPDATE`/`DELETE` directo sobre `auth.users`: **0 ocurrencias**. El único contacto con ese esquema es la FK `players.auth_user_id references auth.users(id) on delete set null` y 2 triggers de solo lectura (`AFTER INSERT/UPDATE OF email_confirmed_at`).
- "GDPR"/"anonimiz*" en código (no docs): **0 ocurrencias**. P0.3 se diseña desde cero en este sentido — no había ningún mecanismo previo, ni parcial.

---

## 2. Diseño del procedimiento — 2 pasos deliberadamente separados

Tal como pedía el handoff (§3.2: "separación entre borrar/desactivar Auth y anonimizar identidad deportiva"):

### Paso 1 — Auth (DISEÑADO, NO implementado como código en esta fase)

Cortar el acceso real de la cuenta (`auth.users`). La vía correcta y soportada es el **Auth Admin API** de Supabase (`supabase.auth.admin.deleteUser(userId)` o un baneo equivalente), invocable únicamente con la `service_role` key — nunca SQL directo sobre `auth.users`: aunque técnicamente una función `security definer` podría alcanzar privilegios suficientes para tocar esa tabla, Supabase desaconseja explícitamente escribir en el esquema `auth` a mano porque puede romper invariantes internas de GoTrue (sesiones activas, `auth.identities`, refresh tokens) que no son públicas ni están documentadas. El Admin API es, además, el único mecanismo que invalida realmente una sesión JWT ya emitida — un `UPDATE` directo sobre la fila no lo haría.

Como invocar el Admin API requiere una Edge Function o un script con la `service_role` key, y el handoff prohíbe explícitamente desplegar Edge Functions en esta fase (§3 NO HACER), **este paso queda documentado como procedimiento operativo manual para Central** (dashboard de Supabase → Authentication → eliminar/banear usuario, o un script administrativo aparte fuera de esta migración) — no es una "decisión de producto abierta" (el contrato de "desactivar acceso" ya está cerrado en `Pre_Production.md`), es una limitación de herramientas de esta ronda puntual.

Gracias a `players.auth_user_id ... on delete set null`, ejecutar este paso (borrar la fila de `auth.users`) deja automáticamente `players.auth_user_id = NULL` sin necesitar tocar `players` para ese campo — los dos pasos son independientes en cualquier orden, aunque se recomienda ejecutar primero el Paso 1 (corta el acceso de inmediato) y después el Paso 2 (anonimiza los datos), para minimizar la ventana en la que una sesión todavía válida podría seguir usando la app mientras sus propios datos ya se están limpiando.

### Paso 2 — Anonimización de identidad deportiva (IMPLEMENTADO completo en SQL)

Nueva migración aditiva: [`supabase/migrations/20260927150000_preprod_p03_fase_a_account_deletion.sql`](../../../../supabase/migrations/20260927150000_preprod_p03_fase_a_account_deletion.sql).

Agrega:
- `players.deleted_at timestamptz` — marca de anonimización real, deliberadamente separada de `is_active` (que ya se reutiliza como filtro de "cuenta visible" en `search_players`/`get_public_profile`): `deleted_at` es la única fuente de verdad de idempotencia.
- `'account_deleted'` al `CHECK` existente de `pilot_events.event_name` (mismo patrón ya usado para `'provisional_claimed'` en Bloque 4).
- **`admin_delete_player_account(p_player_id uuid, p_admin_note text default null)`** — `SECURITY DEFINER`, **exclusivamente `service_role`** (revoke explícito de `public`/`anon`/`authenticated`). Idempotente, atómica (una función = una transacción), bajo `for update` de la fila de `players` para serializar reintentos/ejecuciones concurrentes.

Recorrido completo de tablas dentro de la función:

| Tabla | Tratamiento |
|---|---|
| `players` | `display_name = 'Jugador eliminado'`, `is_active = false`, `deleted_at = now()` |
| `profiles` | `username`/`first_name`/`last_name`/`display_name`/`avatar_url`/`birth_date`/`gender`/`dominant_hand`/`preferred_side`/`competitive_branch`/`location_id`/`location_effective_from`/`phone`/`current_category`/`current_category_at` → `null`; `allow_whatsapp_contact`/`ranking_opt_in` → `false` |
| `match_participants` | `display_name_snapshot = 'Jugador eliminado'` en TODAS sus filas — `player_id` se **preserva** (estructura intacta) |
| `intelligence_match_outputs` | **DELETE** de todas las filas de todos los partidos donde participó (propias y de compañeros/rivales) — output regenerable, se recalcula limpio en la próxima lectura |
| `match_user_state` | **DELETE** (nota privada + ocultamiento personal, sin valor para terceros) |
| `notifications` | **DELETE** (100% privadas de ese jugador) |
| `player_saved_players` | **DELETE** como `owner` y como `saved` (sale de su lista y de las de otros) |
| `ranking_network_hidden` | **DELETE** como `player` y como `hidden_player` |
| `pilot_events` | **INSERT** de auditoría (`event_name='account_deleted'`, `player_id`, `properties.adminNote` — nunca PII del jugador eliminado) |
| `matches`, `match_sets`, `match_revisions`, `match_actions`, `match_identity_issues`, `match_level_results`, `match_level_result_players`, `level_states`, `level_events`, `ranking_rows`, `ranking_editions`, `ranking_profile_events`, `location_change_events`, `provisional_claims`, `api_rate_limits` | **NUNCA TOCADAS** — preservan la estructura deportiva/histórica (`player_id`, cifras, posiciones) que Nivel/Ranking/Intelligence de terceros necesitan; ninguna tiene una columna de nombre libre, así que el nombre que eventualmente se muestre para ese `player_id` siempre se resuelve contra `profiles`/`players`, ya anonimizados |

Un `player_id` con `type='provisional'` devuelve `{ok:false, code:'not_a_registered_account'}` sin tocar nada — no es una cuenta real en el sentido de este procedimiento.

---

## 3. Riesgos cubiertos por tests (handoff §5)

| # | Riesgo | Cobertura |
|---|---|---|
| 1 | Usuario eliminado no vuelve a autenticarse | **Fuera de alcance de este verify** — depende del Paso 1 (Auth), no implementado como código en esta fase (ver §2). El verify sí confirma la consecuencia del lado de datos: `is_active=false` + `username=null` dejan al jugador estructuralmente inutilizable por cualquier RPC de sesión/búsqueda |
| 2 | Nombre/email/teléfono/avatar/PII no disponibles en superficies ordinarias | Caso 3 (anonimización completa de `profiles`) + Caso 4 (`search_players`/`get_public_profile` reales, con sesión simulada, ya no devuelven al jugador) |
| 3 | Partidos compartidos de B/C/D permanecen | Caso 3 (`matches.status='validated'` intacto, nombre de B intacto) |
| 4 | Participantes históricos siguen estructuralmente válidos | Caso 3 (`match_participants.player_id` de A se preserva) |
| 5 | Nivel/Ranking/Intelligence históricos de terceros no se corrompen | Caso 3 (`level_states` de A y de B, tercero, exactamente intactos — nunca tocados) |
| 6 | Búsquedas no devuelven al jugador eliminado como activo | Caso 4 |
| 7 | Relaciones personales/listas dejan de tratarlo como activo | Caso 3 (`player_saved_players`/`ranking_network_hidden`, ambas direcciones) |
| 8 | Repetición no duplica ni rompe nada | Caso 5 (segunda llamada, `alreadyDeleted=true`, `deleted_at` no cambia, sin segundo evento de auditoría) |
| 9 | Usuario común no puede ejecutar la operación | Caso 6 (`has_function_privilege` para `anon`/`authenticated`/`public`/`service_role`) |
| 10 | No quedan fixtures al terminar | `BEGIN`/`ROLLBACK` en todo el archivo |

Verify completo: [`supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql`](../../../../supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql). Fixture: 4 jugadores reales (A se elimina; B es su compañero de equipo, con listas personales cruzadas; C/D son los rivales, C también guarda a A en su lista y lo oculta de Mi red) + 1 provisional, un partido oficializado entre A+B vs C+D, notificación/nota privada/Intelligence de A, Intelligence de B sobre el mismo partido (para confirmar que se invalida para ambos).

**No se ejecutó contra Postgres real** — sin Supabase CLI/credenciales en este sandbox, mismo patrón que todas las rondas anteriores (revisado por balance de paréntesis/bloques `do $$...end $$` en vez de ejecución real).

---

## 4. Qué quedó solo diseñado (no implementado como código)

- **Paso 1 (Auth)**: ver §2. Requiere Auth Admin API desde una Edge Function o script administrativo — explícitamente fuera de esta fase.
- **Limpieza del archivo de Storage del avatar**: `admin_delete_player_account` anula `profiles.avatar_url` (deja de mostrarse), pero **no puede borrar el objeto real del bucket `avatars`** — SQL puro no tiene acceso al Storage API de Supabase. El archivo queda huérfano en Storage hasta una limpieza operativa separada (un script/Edge Function que liste objetos sin referencia activa, fuera del alcance de esta fase).
- **UI administrativa**: no existe ningún panel para que Central invoque `admin_delete_player_account` — hoy se ejecutaría directo desde el SQL editor de Supabase con la `service_role`, o un script. El handoff confirma que "no hace falta autoservicio" pero no pidió una UI administrativa tampoco, así que se deja fuera de alcance.
- **`provisional_claims` creados por el jugador eliminado**: no se tocan (siguen con `created_by_player_id`/`claimed_by_player_id` apuntando al player ya anonimizado — estructuralmente válido, mismo criterio que el resto de las tablas de auditoría). No se marcó como riesgo por el handoff, no se inventó una regla nueva.

---

## 5. Decisiones técnicas menores resueltas sin marcar como abiertas

- `terms_version`/`terms_accepted_at` en `profiles` se **conservan** tras la anonimización (no se anulan): no son PII identificable por sí solas (no incluyen nombre) y sirven de evidencia de que la persona aceptó los términos vigentes en su momento — coherente con "conservar únicamente la estructura mínima necesaria", aplicado acá a evidencia de cumplimiento legal en vez de estructura deportiva.
- `intelligence_match_outputs` se **borra** (no se intenta reescribir el `output`/`audit` jsonb in-place) porque el nombre está embebido dentro de texto narrativo variable — reescribirlo de forma confiable con SQL puro (sin volver a correr el motor de Intelligence) arriesgaría dejar frases incoherentes o corromper el JSON; al ser un output 100% regenerable (nunca la fuente de verdad), borrar y dejar que se recalcule con el nombre ya anonimizado es la opción segura.
- `ranking_opt_in`/`allow_whatsapp_contact` se fuerzan a `false` (en vez de dejarlos como estaban) por prolijidad — el jugador ya no participa (`is_active=false` lo excluye de cualquier cálculo de todos modos), pero dejar un `true` residual en un campo de consentimiento explícito se sintió más honesto en `false`.

Ninguna decisión de producto nueva quedó abierta — no apareció ninguna decisión humana real (legal o de producto) que no estuviera ya cerrada en `Pre_Production.md §P0.3` / `02_Borrador_Legal_Privacidad_V1.md §5`.

---

## 6. Tests

- Migración + verify SQL: escritos, revisados por balance de paréntesis/bloques (no ejecutables en este sandbox, sin Supabase CLI/credenciales).
- `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs` → **270/270 PASS** (sin cambios — esta ronda no tocó ningún archivo JS de frontend ni de Edge Functions, confirmado corriendo la suite completa igual para tener evidencia formal de cero regresión).
- No se tocó `bramulab/tests.html` ni ningún archivo bajo `bramulab/` — cero cambios frontend, tal como pedía el handoff como preferencia explícita.

---

## 7. Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `supabase/migrations/20260927150000_preprod_p03_fase_a_account_deletion.sql` | Nueva — `players.deleted_at`, `pilot_events.event_name` +`'account_deleted'`, `admin_delete_player_account` |
| `supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql` | Nueva — verify transaccional (6 casos, cubre los 10 riesgos del handoff) |
| `docs/BRAMUlab/Implementacion/Pre_Production/27_Resultado_P0_3_Fase_A_Eliminacion_Cuenta.md` | Este documento |
| `docs/BRAMUlab/Pre_Production.md` | Estado de P0.3 actualizado (ver §8) — **no marcado como cerrado** |

Sin cambios en `bramulab/` (frontend), `bramulab/version.json`, service worker, ni ningún archivo de `main`/Production/BRAMUlive.

---

## 8. Qué debe hacer Central

1. Revisar el diseño en 2 pasos (§2) — en particular, confirmar/decidir el mecanismo exacto del Paso 1 (Auth Admin API vía qué vehículo: Edge Function nueva, script administrativo separado, o proceso manual por dashboard) antes de que este procedimiento sea realmente operable de punta a punta.
2. Aplicar `20260927150000_preprod_p03_fase_a_account_deletion.sql` contra Staging y correr `verify-preprod-p03-fase-a-account-deletion.sql`.
3. Decidir dónde/cómo se invoca `admin_delete_player_account` en la práctica (SQL editor manual vs. un futuro panel administrativo) — no bloqueante para cerrar la Fase A, sí para un procedimiento operativo completo.
4. Cuando el Paso 1 esté resuelto, correr un ciclo real de punta a punta (cuenta de prueba en Staging: crear, jugar un partido compartido con otra cuenta, eliminar, confirmar que la otra cuenta sigue viendo `Jugador eliminado` y su propio historial intacto).
5. Solo entonces evaluar si corresponde marcar P0.3 como cerrado en `Pre_Production.md` (este documento deliberadamente NO lo marca como cerrado — falta UI/operación remota/revisión central, tal como pedía el handoff §3.5).
