# Backend Bloque 7 — Resultado de Fase 1 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `3558bf25567dba146e5e5fdea1df8ee54f68f3f4` (`02_Analisis_Claude.md` + `03_Revision_Central_Analisis.md`).
**Alcance ejecutado:** únicamente **Fase 1 — esquema + contratos mínimos de datos de Ranking**, siguiendo `03_Revision_Central_Analisis.md` donde corrige a `02_Analisis_Claude.md`.

No se aplicó nada a Supabase real. No se creó ningún snapshot. No se implementó la función de cálculo semanal, ningún cron, ninguna RPC de lectura de Ranking, ni un cambio de frontend.

---

## 1. Esquema agregado

Dos migraciones nuevas, en orden:

### `20260922100000_bloque7_ranking_schema.sql`

- **`ranking_editions`** — una fila por edición semanal, inmutable. `edition_id`, `period_start_at`/`period_end_at`, `published_at`, `timezone`, `ranking_rules_version`, `created_at`. `unique (period_start_at)` para idempotencia (un segundo disparo del job semanal para el mismo corte nunca duplica la edición). Sin columna de estado draft/published: la fila se crea recién cuando la edición completa —con todas sus filas— ya está lista, dentro de una sola transacción (decisión de Fase 2, documentada acá para que no se reabra).
- **`ranking_rows`** — una fila por jugador candidato por ámbito por edición, append-only. Campos: `player_id`, `scope_type` (`local|provincial|pais|global` — **sin `'red'`**, ver §4), `scope_key` (canónico, nunca label libre), `is_eligible`, `position` (nullable), `tie_group` (nullable, espejo de `position` para empates), `total_eligible`, `density_status`, `level_internal`/`level_public`/`level_band`/`level_status`, `level_algorithm_version`, `last_computable_at`, ubicación congelada por IDs (`location_id`, `location_country_code`, `location_province_id`, `location_locality_id`, `location_display_label` solo para UI), `competitive_branch`, `eligibility_reason_codes` (jsonb, mismo criterio que `match_level_results.reason_codes`), `ranking_rules_version` (copia por fila). Constraints: `position` nunca sin `is_eligible`; `tie_group` nunca sin `position` y viceversa; **una fila `is_eligible=false` siempre debe traer al menos un código de motivo** (`ranking_rows_ineligible_requires_reason` — hace cumplir literalmente C-02 a nivel de base de datos, no solo por convención de la función que la escriba); `unique (edition_id, scope_type, scope_key, player_id)`.
- RLS *deny-by-default* en ambas tablas (habilitada, cero políticas), grants completos solo a `service_role` — mismo patrón que `match_level_results`/`match_level_result_players` de Bloque 6.

### `20260922110000_bloque7_ranking_profile_data.sql`

- `profiles.location_effective_from timestamptz` — estado actual del cooldown. Backfill con `updated_at` para las cuentas que ya tienen `location_id` (ver §3, por qué es exacto y no inventado).
- **`location_change_events`** — historial append-only (`player_id`, `change_type` `initial|update`, `previous_location_id`/`new_location_id`, `effective_at` de servidor). Constraints: `initial` nunca trae `previous_location_id`, `update` siempre lo trae y siempre es distinto del nuevo. RLS *deny-by-default*, `service_role` únicamente.
- `players.ranking_excluded boolean not null default false` — exclusión de integridad mínima (§5). Sin ninguna vía de escritura nueva: hoy solo se toca a mano con `service_role`.
- **`complete_ranking_profile_data(...)`** — RPC nueva, `SECURITY DEFINER`, `grant execute` a `authenticated` (ver §4).

---

## 2. Contratos agregados

Un solo contrato de escritura nuevo, expuesto a `authenticated`:

```
complete_ranking_profile_data(
  p_competitive_branch text,        -- 'F' | 'M', obligatorio
  p_ranking_opt_in boolean,         -- obligatorio (no admite NULL)
  p_location_country_code text,
  p_location_province_label text,   -- obligatorio junto con locality
  p_location_locality_label text,   -- obligatorio junto con province
  p_location_georef_province_id text default null,
  p_location_georef_locality_id text default null
) returns public.profiles
```

Errores (`errcode P0001`, mismo estilo que `complete_profile`): `no_player_for_session`, `no_profile_for_player`, `profile_incomplete` (sin `@usuario` todavía), `ranking_opt_in_required`, `competitive_branch_invalid`, `location_required`, `location_change_cooldown`.

Ninguna RPC de lectura de Ranking existe todavía — es explícitamente Fase 3, no esta ronda (`03_Revision_Central_Analisis.md` C-03: el cliente nunca debe poder pedir un `scope_key` arbitrario).

---

## 3. Decisiones técnicas

- **No se refactorizó `complete_profile`.** El find-or-create de `locations` (bloque `georef`/`manual`, `on conflict (source, georef_province_id, georef_locality_id)`) se **copió** dentro de `complete_ranking_profile_data`, no se extrajo a un helper compartido. Motivo: `complete_profile` es de Bloque 2/3, ya cerrado y validado en Staging real; tocar su cuerpo para extraer un helper agrega riesgo de regresión a una pieza que no pidió esta ronda, mientras que el invariante real (`verified_for_ranking` coherente con `source`) lo sigue garantizando el `CHECK` de la tabla `locations`, no la función que escribe. Si en el futuro se detecta drift entre las dos copias, ahí sí conviene unificarlas — no antes.
- **`complete_ranking_profile_data` exige los 3 datos completos en cada llamada** (sin `COALESCE` parcial) — mismo criterio que `03_Revision_ChatGPT.md` de Bloque 3 §4 ya fijó para `complete_profile` ("no generalizar a COALESCE"). Se prefirió coherencia con el precedente sobre un update parcial más conveniente para un futuro toggle aislado de `ranking_opt_in`.
- **Backfill de `location_effective_from` con `profiles.updated_at`, no con `NULL` ni con una fecha inventada.** Hasta esta migración, `complete_profile` es el ÚNICO escritor de `profiles` después de la fila vacía que crea `handle_email_confirmed`, y no existe ninguna función de "cambiar ubicación" todavía — así que para cualquier cuenta que ya tiene `location_id`, `updated_at` es exactamente el instante de la única vez que se fijó esa ubicación. No es una aproximación: es el dato real, solo que hasta ahora vivía en una columna genérica.
- **`scope_type` de `ranking_rows` excluye `'red'` a nivel de `CHECK`**, no solo de convención — refuerza a nivel de esquema la decisión ya cerrada de no materializar Mi red (`03_Revision_Central_Analisis.md` C-01).
- **`tie_group` como columna propia, no solo un alias de lectura de `position`.** Aunque para el ranking de competición ("1, 1, 3") ambos valores coinciden siempre para las filas empatadas, mantenerlos como columnas separadas evita que una futura lectura de auditoría tenga que reinterpretar `position` con dos significados (rango Y identidad del grupo de empate) a la vez.
- **`ranking_excluded` vive en `players`, no en `profiles`**, por simetría con `players.is_active` (ambas son condiciones de "cuenta", no de "perfil deportivo") — mismo criterio de separación que ya usa el esquema existente.

---

## 4. Seguridad / RLS

- `ranking_editions`, `ranking_rows`, `location_change_events`: RLS habilitada, **cero políticas** para `authenticated`/`anon` (deny-by-default total, mismo patrón que `match_level_results`/`match_submissions` de Bloques 5-6). `grant select, insert, update, delete` únicamente a `service_role`. Ninguna de las tres es alcanzable desde el cliente por ningún camino — no hace falta, porque Fase 1 no crea ninguna RPC de lectura.
- `complete_ranking_profile_data` es `SECURITY DEFINER`, resuelve `player_id` desde `auth.uid()` (nunca confía en un `player_id` recibido como parámetro), y escribe `location_change_events`/`profiles` como propietario de las tablas — el mismo mecanismo por el que `complete_profile`/`officialize_level_onboarding` ya escriben sobre tablas con RLS sin política de cliente. `grant execute` a `authenticated` únicamente (no a `anon`).
- `players.ranking_excluded`: sin ningún `GRANT` de escritura para `authenticated`/`anon` y ninguna RPC de esta ronda la toca — solo alcanzable con `service_role`/SQL editor a mano, igual que la fila única de `app_config` (Bloque 1).
- Ninguna tabla nueva expone datos de un jugador a OTRO jugador — todo lo agregado es o bien server-only (`ranking_editions`/`ranking_rows`/`location_change_events`), o bien una escritura del propio jugador sobre su propio perfil (`complete_ranking_profile_data`).

---

## 5. Mapeo explícito de visibilidad/integridad (C-06, sin abrir función nueva)

Documentado en vez de implementado, tal como pidió la revisión central:

- **Perfil deportivo visible:** sigue la política ya cerrada de `Backend_Infraestructura.md §5.1` — visible para cualquier usuario autenticado, sin control de privacidad campo por campo. No se agregó `public_profile_enabled`.
- **Consentimiento específico de Ranking:** `profiles.ranking_opt_in` — ahora, por primera vez, tiene una vía real de escritura (`complete_ranking_profile_data`). Antes de esta migración era un campo con default `false` que ningún RPC podía cambiar.
- **Cuenta activa:** `players.is_active`, sin cambios — sigue siendo la condición general de cuenta.
- **Exclusión de integridad separada:** `players.ranking_excluded`, default `false` (elegible), sin ninguna herramienta administrativa nueva — exactamente el "estado server-only mínimo" que pidió C-06, nada más.

---

## 6. Ubicación canónica — sin duda pendiente (C-07)

Confirmado contra el esquema real, no como decisión nueva: `locations.verified_for_ranking` es `false` para toda fila `source='manual'` por el `CHECK locations_verified_matches_source` de Bloque 2 — una ubicación manual **nunca** habilita Ranking territorial, para ningún ámbito (Local/Provincial/País). `complete_ranking_profile_data` hereda ese mismo find-or-create tal cual, así que el invariante sigue siendo imposible de violar desde esta RPC nueva.

IDs canónicos que usará `ranking_rows.scope_key` (Fase 2, documentado ahora para no reabrirlo): `local` → `locations.location_id` (ya es la clave de deduplicación real entre perfiles de la misma localidad GeoRef); `provincial` → `country_code || ':' || georef_province_id`; `pais` → `country_code`; `global` → literal fijo `'GLOBAL'`. Nunca un label libre.

---

## 7. RECALIBRANDO y versionado — verificación técnica, sin reabrir Nivel (C-08)

Inspeccionado (sin modificar) `get_player_level_state_as_of` (`20260921220000_bloque6_read_rpcs.sql:276`) y el `CHECK` de `event_type` de `level_events` (`20260921210000_bloque6_identity_and_matches_schema.sql:64`).

**Hallazgo:** el ledger (`level_events`) es una secuencia lineal de snapshots (`mu_after`/`confidence_after`/`status_after` dentro de `result` jsonb, o los campos equivalentes de `initial_estimate`). `get_player_level_state_as_of(player_id, cutoff)` devuelve el ÚLTIMO evento estrictamente anterior a `cutoff` — si ese evento dejó al jugador en `RECALIBRANDO`, la función devuelve el valor **provisional** de ese momento, no el "último Nivel consolidado válido" que exige `Ranking_BRAMU.md §6.2`. El helper actual **no distingue** consolidado de provisional.

**Extensión necesaria para Fase 2 (no implementada esta ronda):** un segundo helper de lectura, por ejemplo `get_player_last_consolidated_level_as_of(player_id, cutoff)`, que busque —dentro del mismo ledger, sin recalcular Nivel— el último `level_event` estrictamente anterior a `cutoff` cuyo `result->>'statusAfter' = 'CALIBRADO'` (o `event_type = 'initial_estimate'` nunca cuenta como consolidado, porque ese estado es `CALIBRANDO` por definición). Cuando `get_player_level_state_as_of` devuelva `RECALIBRANDO` para el corte, Fase 2 debe usar el resultado de este segundo helper para `level_internal`/`level_public`, no el valor provisional.

**Versionado del algoritmo:** `level_events.algorithm_version` existe como columna de la tabla, pero `get_player_level_state_as_of` **no la incluye** en el jsonb que devuelve (confirmado leyendo las dos ramas de su `case`). Fase 2 necesita que ese helper (o uno nuevo) también devuelva `algorithm_version` para poder poblar `ranking_rows.level_algorithm_version` sin una segunda consulta separada al ledger.

Ninguna cuenta real está hoy en `RECALIBRANDO` (Bloque 6 cerró restaurando las cuentas de QA a `initial_estimate`), así que esto no bloquea Fase 1 ni el arranque de Fase 2 — solo debe resolverse antes de que Fase 2 se considere completa.

---

## 8. `pg_cron` — solo información, nada habilitado (C-09)

No se tocó Supabase esta ronda. Se deja registrado, tal como confirmó la revisión central: `pg_cron` 1.6.4 está disponible como extensión en el proyecto de Staging, actualmente no instalada/habilitada. Habilitarla queda para Fase 4, intentando primero por migración/automatización antes de pedir intervención humana. No es un bloqueo de ninguna fase anterior.

---

## 9. Qué queda expresamente para Fase 2 (no implementado, a propósito)

- La función de cálculo que puebla `ranking_editions`/`ranking_rows` para un corte dado.
- El segundo helper de lectura de Nivel consolidado + `algorithm_version` (§7).
- Cualquier query de "Mi red" (se calcula en lectura, Fase 3, sobre el corte de la edición vigente — no es una tabla).
- Las RPCs de lectura (`get_current_ranking_edition`, `get_ranking_scope` reescrito para NO aceptar un `scope_key` arbitrario del cliente per C-03, `get_my_ranking_position`, `get_my_network_ranking`, `get_profile_ranking_summary`, `get_home_ranking_insight`).
- `pg_cron` / publicación automática (Fase 4).
- Frontend: reemplazo de la sección mock de `ranking.js` (Fase 5) — no se tocó `app.js` ni `ranking.js` en esta ronda.

---

## 10. Verificación realmente ejecutada esta ronda

**Ninguna ejecución contra una base real** — no autorizada esta ronda. Lo que sí se hizo, estático:

- lectura completa de ambos archivos de migración después de escribirlos, cruzando cada nombre de tabla/columna/constraint contra las migraciones reales de Bloques 1-6 (`players`, `profiles`, `locations`, `level_states`, `level_events`, `match_level_results`) para confirmar que nada contradice el esquema vigente;
- verificación de balance de paréntesis y de bloques `$$...$$`/comillas simples de ambos archivos con un script que primero elimina comentarios `--` y literales de cadena (para no confundir paréntesis dentro de prosa con paréntesis de SQL real) — balance 0 en ambos archivos;
- comparación campo a campo del bloque `find-or-create` de `locations` copiado en `complete_ranking_profile_data` contra el de `complete_profile` (Bloque 2/3), incluyendo el target exacto del `ON CONFLICT`, para confirmar que es una copia fiel del código ya validado.

**No se declara PASS de ninguna prueba que requiera aplicar la migración.** La compilación real dentro de una transacción con rollback contra Supabase Staging queda, como pidió esta ronda, para ChatGPT central antes de autorizar la aplicación.

---

## 11. Bloqueos reales

Ninguno. Fase 1 queda lista para revisión central del diff y, si se aprueba, para la compilación/prueba con rollback contra Staging.

---

**Fin de Fase 1. No se implementó Fase 2. No se aplicó nada a Supabase.**
