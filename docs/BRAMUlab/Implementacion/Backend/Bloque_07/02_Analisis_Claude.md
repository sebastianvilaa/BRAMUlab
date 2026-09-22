# Backend Bloque 7 — Análisis técnico (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Alcance de esta ronda:** análisis técnico únicamente. No se implementó código, no se creó ni aplicó ninguna migración, no se tocó Supabase, no se desplegó ninguna Edge Function, no se tocó Vercel, no se modificó `Ranking_BRAMU.md` ni ningún otro documento maestro.

---

## 1. Método

Leído en el orden que exige `01_Handoff_Inicio_Bloque_07.md`:

1. `docs/BRAMUlab/README.md`.
2. `docs/BRAMUlab/Metodo_Trabajo.md`.
3. `docs/BRAMUlab/Ranking_BRAMU.md` (completo).
4. Únicamente la sección **Bloque 7 — Ranking real semanal** de `docs/BRAMUlab/Backend_Infraestructura.md` (línea 1046).
5. La sección final **Bloque 6 — CERRADO EN STAGING** de `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` (línea 573 en adelante), solo para el estado real de entrada.

Inspección de repo, acotada a lo que el handoff §4 autoriza — nunca una auditoría general:

- las 27 migraciones de `supabase/migrations/` (por nombre/fecha, sin abrir las que no tocan `profiles`/`locations`/`level_states`/partidos/Nivel);
- en detalle: `20260916180000_bloque2_auth_profile_username_location.sql` (`locations`, `profiles`), `20260919120000_bloque3_nivel_persistente.sql` (`level_states`, `level_events`), `20260920180000_bloque5_matches_core.sql` (`matches`, `match_participants`), `20260921203000_bloque6_match_level_results.sql` (`match_level_results`, `match_level_result_players`), `20260921220000_bloque6_read_rpcs.sql` (`get_player_level_state_as_of`, `get_player_match_history_for_level_engine`, `get_my_matches`), `20260920120000_bloque4_jugadores_busqueda_provisional.sql` (`get_public_profile`);
- `bramulab/ranking.js` completo (798 líneas — el módulo entero del Ranking simulado);
- puntos de integración en `bramulab/app.js` (grep de `PLRanking`/`RK.`, sin leer el archivo completo): línea 409 (alias `RK`), 5782 (Home), 6520–6710 (pantalla Ranking), 7028–7167 (búsqueda/paginación), 8395–8410 y 8629 (Perfil propio/público);
- `bramulab/vercel.json` / `bramulive/vercel.json` (para el punto de mecanismo de publicación — confirmar que no hay cron ya configurado);
- `supabase/functions/` (estructura, sin leer cada Edge Function completa) y `supabase/tests/` (convención de nombres de verificación).

No se leyó `Archivo/`, `Backup/` ni handoffs consumidos.

---

## 2. Diagnóstico del estado actual

### 2.1 El Ranking hoy es 100 % simulado en el cliente, pero su lógica pura ya es correcta

`bramulab/ranking.js` documenta esto explícitamente en su propio encabezado (líneas 1–26): "todo lo que este archivo genera (nombres/universo territorial) es EXPLÍCITAMENTE simulado" y aísla qué parte es mock de qué parte es "lógica reutilizable con datos reales también". Verificado leyendo el archivo:

**Reutilizable sin tocar (ya implementa exactamente las reglas de `Ranking_BRAMU.md`):**

- `computeRankingWeekPeriod`/`computePreviousRankingWeekPeriod`/`formatRankingWeekRangeLabel` (líneas 61–102): semana lunes 00:00:00–domingo 23:59:59, timezone Buenos Aires vía offset fijo −180 min (correcto: Argentina no tiene DST desde 2009, igual que anota el propio comentario).
- `rankEntries` (línea 397): ranking de competición "1, 1, 3" reutilizando `PG.assignPositions` — la misma regla que ya usa Mis Grupos, sin duplicar lógica.
- `bandForLevel`, `computeWeeklyMovement`, `computeTerritorialDensity` (0–4/5–14/15+), `computeNetworkDensity` (0/1–2/3+), `blockForPosition`, `paginate`, `filterEntriesBySearch`.
- `computeParticipantStatus`/`computeSelfStatus` (líneas 579–638): calibración (5 partidos + 3 rivales distintos, a la vez — nunca solo el conteo), inactividad a 180 días, `Nuevo` para fin-de-calibración/reingreso. Reglas correctas, pero **calculadas sobre historial local**, no sobre `level_states`/`match_level_results` reales.
- `computeProfileRankingSummary`/`computeHomeRankingInsight` (líneas 706–797): ya son exactamente los contratos que consumen Perfil (§15.1) y `TU MOMENTO` (§13.6).

**Exclusivamente mock, a eliminar (nunca adaptar):** `MOCK_FIRST_NAMES`/`MOCK_LAST_NAMES`/`MOCK_SCOPE_CONFIG`/`mockNameAt`/`mockGenderForName`/`buildScopeUniverseNames`/`mockLocalityAt`/`resolveMockLocalityPool`/`buildRankingEntries` (versión mock) y `sortNudge` — esta última existe solo porque `PH.computeSimulatedJugadorLevel` no guarda los 4 decimales reales que la ordenación necesita; con Nivel real (`level_states.mu`) esa función entera deja de tener sentido, tal como el propio comentario del código anticipa (líneas 364–387).

**Por qué el mock no puede evolucionar a real sin backend:** todo esto se alimenta de `getComputableHistory()` (`app.js:4032`), que combina `Store.loadHistory()` (local) con el cache de `get_my_matches` — es decir, **solo ve los partidos de la cuenta propia**. Nunca puede construir un universo real de *otros* jugadores. Esto no es una limitación de implementación menor: confirma por qué Ranking real requiere necesariamente cálculo server-side, exactamente como dice el handoff.

**Puntos de integración a preservar (mismos 3 lugares, mismos contratos, sin tocar UX):**

- Home: `RK.computeHomeRankingInsight(...)` en `app.js:5782`.
- Pantalla Ranking: construcción de universo/movimiento/densidad en `app.js:6520–6710`; búsqueda/paginación/scroll-a-mi-posición en `app.js:7028–7167`.
- Perfil (propio y público): `RK.computeProfileRankingSummary(...)` en `app.js:8410` y `8629`.

### 2.2 Lo que ya existe server-side y resuelve la mitad del problema sin escribir nada nuevo

- **`profiles`** (Bloque 2) ya tiene `competitive_branch` (`'F'|'M'`), `location_id`, `ranking_opt_in` — exactamente lo que `Ranking_BRAMU.md` §17.1 pide, ya poblado por `complete_profile`.
- **`locations`** (Bloque 2) ya tiene `country_code`, `province_label`, `locality_label` y, sobre todo, `verified_for_ranking` — con un `CHECK` de tabla que hace *imposible* insertar una fila `manual` con `verified_for_ranking=true` (`locations_verified_matches_source`). Esa es exactamente la invariante que Ranking necesita para "ubicación estructurada completa" (§6 punto 4) sin volver a decidir nada de producto.
- **`level_states`** (Bloque 3) ya tiene `status` (`PENDIENTE|CALIBRANDO|CALIBRADO|RECALIBRANDO`), `mu`/`confidence` a precisión completa (el motor ya redondea a 4 decimales antes de persistir), `rated_matches`, `distinct_opponents`, `last_rated_at` — autoridad server-side real, RLS de solo-lectura-propia.
- **`match_level_results` + `match_level_result_players`** (Bloque 6): registro append-only de cada cálculo de Nivel aplicado a un partido/revisión, con como máximo un `effect_status='applied'` vigente por partido (índice único parcial) y `eligible=false` auditado con `reason_codes` cuando un partido oficial no tuvo efecto. **Esta es, sin necesidad de tabla nueva, la fuente correcta de "partido computable y validado"** que pide `Ranking_BRAMU.md` §16 para decidir actividad/elegibilidad/Mi red.
- **`get_player_level_state_as_of(player_id, cutoff)`** (`20260921220000_bloque6_read_rpcs.sql:276`, `service_role`): reconstruye `mu`/`confidence`/`status`/`evidenceUnits`/`lastRatedAt` **estrictamente anterior** a cualquier instante, leyendo `level_events` (ledger append-only). Este es el hallazgo central de esta ronda: el "Nivel consolidado congelado al cierre del domingo" que pide `Ranking_BRAMU.md` §4.2 **es literalmente una llamada a esta función con `cutoff = próximo lunes 00:00:00 BA`**, jugador por jugador. No hace falta inventar un mecanismo nuevo de snapshot de Nivel — ya existe, ya está probado (Bloque 6), y ya es `service_role`-only, coherente con que Ranking tampoco debe calcular Nivel.
- **`get_player_match_history_for_level_engine(player_ids[], before_played_at)`** (línea 199 del mismo archivo): ya filtra partidos `validated` + Nivel-elegibles (join contra `match_level_results.eligible=true`/`effect_status='applied'`) de los **180 días anteriores** a un instante, con participantes incluidos. Es directamente la fuente para construir "Mi red" (§9): solo hace falta leer qué otros `player_id` aparecen como participantes de esos partidos, no reimplementar la ventana de 180 días ni la definición de "computable".
- **Patrón arquitectónico consistente en los 6 bloques cerrados**, y que Bloque 7 debe seguir sin excepción: RLS *deny-by-default* en toda tabla nueva, cero `SELECT` directo de `authenticated` sobre datos de terceros, toda lectura cruzada vía RPC `SECURITY DEFINER` con `consume_rate_limit` (ver `get_public_profile`, `search_players`). Ranking nunca debe exponer `profiles`/`level_states`/`locations` de otros jugadores directamente al cliente.

### 2.3 Gaps reales (no inventados, verificados por grep negativo)

- **No existe ningún mecanismo de cron/scheduler en el repo**: sin `pg_cron`, sin GitHub Actions, sin Vercel Cron configurado en `bramulab/vercel.json`/`bramulive/vercel.json`. Bloque 7 es el primer bloque que necesita ejecución periódica no disparada por una acción de usuario.
- **`ranking_integrity_status`, `public_profile_enabled`, `level_band_key`, `location_effective_from`** — los cuatro campos que `Ranking_BRAMU.md` §17.1 lista como "contrato mínimo de backend" — **no existen en ningún lado del esquema ni del código actual** (grep sin resultados). En concreto:
  - "Perfil público" como toggle independiente de `ranking_opt_in` **no existe**: hoy `get_public_profile` solo exige `username is not null`. El propio `ranking.js` (líneas 619–627) ya documenta esto: *"`user.rankingOptOut`/`user.isPublicProfile` TODAVÍA NO existen en el modelo de cuenta... ninguno de los dos estados es alcanzable desde la UI real todavía"*. No es un hallazgo nuevo, es un gap ya conocido y explícitamente diferido.
  - **Cooldown de 30 días por cambio de ubicación (§8.5) no está implementado**: revisado `complete_profile` (Bloque 2/3) — sobrescribe `location_id` sin registrar cuándo cambió ni bloquear un cambio reciente. No hay ninguna columna que juegue el rol de `location_effective_from`.
  - `ranking_integrity_status`: no existe ningún flag de exclusión por integridad en ningún lado. Con la escala actual (cuentas de Sebastián + conocidos), no es bloqueante para arrancar, pero debe declararse explícitamente como ausente, no asumirse.
- **`RECALIBRANDO` nunca fue disparado por ningún RPC real todavía.** Confirmado por grep: Bloque 6 solo *preserva* el valor si ya estaba puesto ("`RECALIBRANDO` conserva su semántica propia, fuera de Bloque 6" — comentarios en `20260921223000_bloque6_officialize_rpc.sql` y `20260921230000_bloque6_correction_and_identity_rpcs.sql`), y el motor (`level.js`/`match-level-engine.js`) sí define el estado (`Level.STATES.RECALIBRATING`) pero como pieza de Nivel, no de Ranking. `Ranking_BRAMU.md` §6.2 exige que Ranking lea "el último Nivel consolidado válido" mientras alguien recalibra, distinto de un valor provisional en curso. **No verificado en esta ronda** (correspondería reabrir Nivel, fuera de alcance) si `level_states.mu` ya es ese valor consolidado por diseño del motor o si hay que reconstruirlo buscando el último `level_event` con `statusAfter='CALIBRADO'`. Se deja como verificación técnica de Fase 1, no como bloqueo de arranque — hoy no hay ninguna cuenta real en `RECALIBRANDO`.
- **Estado real de datos en Staging:** Bloque 6 cerró restaurando las cuentas de QA a su `initial_estimate` (`CALIBRANDO`), y no hay evidencia de ninguna cuenta `CALIBRADO` hoy. La primera edición real de Ranking, aplicando las reglas tal cual, muy probablemente publicará "0–4 elegibles" (sin puestos) en todos los ámbitos territoriales. Esto es el comportamiento **correcto y esperado** del propio documento maestro (§10, caso 9) — no es un bug a corregir con datos de prueba, y no se fabrica población ficticia para evitarlo (`Método_Trabajo.md`: Testing usa datos de prueba reales, nunca simulados para maquillar densidad).

---

## 3. Propuesta técnica concreta

Principio: máxima reutilización de lo que ya existe (§2.2), mínima superficie nueva, sin sobrearquitectura para la escala actual.

1. **Cálculo del Nivel congelado:** para cada jugador candidato, una sola llamada a `get_player_level_state_as_of(player_id, corte)` (ya existe, ya validado). Ranking nunca vuelve a calcular ni a leer `level_states.mu` "vivo" para ordenar.
2. **Selección de candidatos:** `profiles` con `ranking_opt_in = true`, `location_id` no nulo, `competitive_branch` no nulo, join `players` (`type='registered'`, `is_active`) — mismo patrón exacto de filtros que ya usa `get_public_profile`.
3. **Elegibilidad territorial:** del estado congelado, `status in ('CALIBRADO','RECALIBRANDO con consolidado')`, `lastRatedAt` congelado dentro de 180 días del corte, `locations.verified_for_ranking = true` para el ámbito territorial (Local exige localidad verificada; Provincial/País pueden aceptar `manual` si el maestro lo permite — a confirmar en Fase 2 releyendo §6/§8 sin reabrirlo, no es una decisión nueva sino una lectura literal).
4. **Ordenamiento:** la misma regla de `rankEntries` (`PG.assignPositions`, "1, 1, 3"), ahora sobre el `mu` congelado real — **sin `sortNudge`**, que deja de tener sentido con precisión real de 4 decimales.
5. **Persistencia:** una fila inmutable por jugador/ámbito en una tabla nueva de snapshot (§4) — nunca se actualiza una fila de una edición ya publicada, solo se insertan filas nuevas en la siguiente edición.
6. **Lectura del frontend:** RPCs nuevas (§5) devuelven directamente filas ya ordenadas; el cliente deja de "rankear" nada, solo pagina/filtra/busca sobre lo que llega — reutilizando `paginate`/`filterEntriesBySearch`/`blockForPosition` tal cual están.
7. **Mi red:** no requiere materialización aparte (ver Decisión Abierta, §10) — se resuelve en el momento de la consulta con `get_player_match_history_for_level_engine` (o una copia mínima adaptada) + el `mu` ya congelado de la edición vigente para cada participante encontrado.

---

## 4. Modelo de datos propuesto (conceptual — sin migración en esta ronda)

**`ranking_editions`** — una fila por edición semanal publicada.

- `edition_id` uuid pk
- `period_start_at` / `period_end_at` timestamptz (lunes 00:00:00 / domingo 23:59:59, ya como instantes UTC reales)
- `published_at` timestamptz
- `timezone` text (`'America/Argentina/Buenos_Aires'`)
- `ranking_rules_version` text (p. ej. `'ranking_v1'`, mismo criterio que `algorithm_version` en Nivel)
- `created_at`
- constraint unique sobre `period_start_at` — garantiza que un segundo disparo del job (reintento de cron) nunca duplica la edición.

**`ranking_snapshot_rows`** — una fila por jugador por ámbito por edición, **append-only, nunca se actualiza**.

- `row_id` uuid pk
- `edition_id` fk → `ranking_editions`
- `scope_type` text check in (`'local'`, `'provincial'`, `'pais'`, `'global'`)
- `scope_key` text (p. ej. `locality_id`/`province_id`/`country_code` según `scope_type`)
- `player_id` fk → `players`
- `position` int (ya expresado en ranking de competición, "1, 1, 3")
- `total_eligible` int
- `density_status` text (`'insufficient'|'forming'|'established'`)
- `level_internal` numeric (4 decimales, valor exacto del corte)
- `level_public` numeric(1 decimal)
- `level_band` smallint (derivado, no se guarda en `level_states`)
- `level_status` text (`'CALIBRADO'|'RECALIBRANDO'`)
- `last_rated_at` timestamptz (congelado)
- `location_snapshot` jsonb (`locality_label`/`province_label`/`country_code` — copia congelada, para que un cambio de ubicación posterior no reescriba una edición ya publicada)
- `competitive_branch` text
- `created_at`
- índices: `(edition_id, scope_type, scope_key, position)`, `(edition_id, player_id)`.
- filas de jugadores **no elegibles pero candidatos** (con `eligibility_reason`) son opcionales para V1 — el propio §16 del maestro solo exige auditabilidad de quién *fue* elegible, no un registro de cada exclusión; se puede diferir sin reabrir la decisión.
- RLS: *deny-by-default* total, igual criterio que `match_level_results` — cero `SELECT` directo de `authenticated`/`anon`, lectura exclusiva vía las RPC de §5.

**No se propone tabla nueva para "Mi red"** — ver §3 punto 7 y Decisión Abierta §10.

**Adición mínima fuera de estas dos tablas, dentro del propio alcance de Ranking (no de Nivel):** `profiles.location_effective_from timestamptz`, escrita por `complete_profile` únicamente cuando `location_id` efectivamente cambia — es el único dato que falta para poder aplicar el cooldown de 30 días de §8.5, que es una regla de Ranking, no de Nivel ni de Auth. Sin esta columna, el cooldown queda descrito en el maestro pero sin ningún dato server-side que lo sustente.

---

## 5. Contratos server/frontend

RPCs nuevas, todas `SECURITY DEFINER`, todas con `consume_rate_limit` (mismo patrón que `get_public_profile`/`search_players`), ninguna expone `profiles`/`level_states`/`locations` de terceros directo:

- `get_current_ranking_edition()` → `period_start_at`/`period_end_at`/`published_at`/`timezone`/`ranking_rules_version` de la edición vigente.
- `get_ranking_scope(p_scope_type, p_scope_key, p_gender_filter, p_band_filter, p_limit, p_offset)` → filas de `ranking_snapshot_rows` ya ordenadas y paginadas (columnas de fila pública, §15: posición, movimiento, nombre/`@usuario`/avatar via join liviano a `profiles`/`players`, Nivel público del corte, ubicación mínima — nunca efectividad/W-L/rachas).
- `get_my_ranking_position(p_scope_type, p_scope_key)` → fila propia + contexto inmediato (para el scroll garantizado de §13.3, sin traer todo el bloque).
- `get_my_network_ranking()` → calculado en el momento (§3 punto 7), nunca desde `ranking_snapshot_rows`.
- `get_profile_ranking_summary(p_player_id)` → Local/Provincia/País del jugador de *ese* perfil — reemplaza `computeProfileRankingSummary` del lado servidor, misma fuente para Perfil propio y público (§15.1, "nunca una segunda implementación").
- `get_home_ranking_insight()` → movimiento propio vs. edición anterior equivalente, para `TU MOMENTO`.

**Frontend (`bramulab/app.js`/`ranking.js`):** los tres puntos de integración de §2.1 no cambian de lugar ni de forma visible. `ranking.js` pierde toda la sección mock (§2.1) y las funciones de RPC de arriba reemplazan a `buildScopeUniverseNames`/`buildRankingEntries`. `rankEntries`/`bandForLevel`/`computeWeeklyMovement`/`paginate`/`filterEntriesBySearch`/`blockForPosition` se conservan tal cual — decidir en Fase 5 si el movimiento se sigue recalculando en cliente (dos ediciones ya traídas) o si `get_home_ranking_insight`/`get_my_ranking_position` ya lo devuelven resuelto es un detalle de implementación, no de esta ronda.

---

## 6. Estrategia de publicación semanal

- **Mecanismo recomendado:** `pg_cron` dentro del propio proyecto Supabase, programado para las 00:05 hora Buenos Aires del lunes (03:05 UTC), ejecutando una función `SECURITY DEFINER` que calcula y escribe la edición completa (`ranking_editions` + todas sus `ranking_snapshot_rows`) en una sola transacción. No agrega infraestructura nueva (la extensión vive dentro de Supabase) y evita depender de una llamada HTTP externa con su propio timeout.
- **Alternativa descartada por ahora:** Vercel Cron Job disparando una Edge Function — se preferiría solo si el cálculo necesitara reusar lógica JS compleja que no valga la pena portar a SQL/PL-pgSQL; con `get_player_level_state_as_of` ya en SQL, no parece necesario.
- Ambas alternativas requieren **una acción real sobre el proyecto Supabase** (habilitar `pg_cron`) que esta ronda de análisis no ejecuta y que tampoco debería ejecutarse sin pasar primero por Fase 1/2 probadas a mano.
- **Idempotencia:** el `unique (period_start_at)` de `ranking_editions` (§4) garantiza que un segundo disparo accidental del mismo corte nunca duplica la edición — la función verifica existencia antes de insertar.
- **Ejecución manual/backfill:** la misma función queda invocable a mano desde el SQL editor (`service_role`) para el primer arranque real o un backfill puntual, sin depender de que el cron ya esté configurado — necesario porque Fase 2 se prueba así, antes de llegar a Fase 4.

---

## 7. Plan de implementación por fases pequeñas

- **Fase 1 — Esquema.** Migración de `ranking_editions` + `ranking_snapshot_rows` + `profiles.location_effective_from`, RLS *deny-by-default*, sin lógica de cálculo todavía. En paralelo (sin tocar código de Nivel): confirmar cómo leer el "último consolidado" de `RECALIBRANDO`.
- **Fase 2 — Función de cálculo.** SQL/PL-pgSQL invocable a mano que construye una edición completa para un corte dado. Verificación directa contra Staging con los datos reales existentes (probablemente 0–4 elegibles en todo — resultado esperado).
- **Fase 3 — RPCs de lectura** (§5), con rate limiting y las mismas exclusiones de columnas que `get_public_profile`/§15.
- **Fase 4 — Publicación automática.** Habilitar `pg_cron` en Staging, programar el job, probar disparo manual y, si el calendario lo permite, un disparo real de lunes.
- **Fase 5 — Frontend.** Reemplazar la sección mock de `ranking.js` por las RPCs nuevas, conservando intacta la sección pura y los tres puntos de integración de §2.1.
- **Fase 6 — QA dirigida** (matriz de §8) + cierre, con la misma disciplina de limpieza post-QA que usó Bloque 6.

---

## 8. Matriz de pruebas por riesgo

| Riesgo | Cómo probarlo |
|---|---|
| Snapshot no permanece estable durante la semana | Automático: cambiar `level_states.mu` después de publicar, confirmar que la fila de `ranking_snapshot_rows` no cambia. |
| Validación/corrección tardía reescribe una edición ya publicada | Automático: partido computable después del corte, la edición publicada queda intacta; aparece recién en la siguiente. |
| Empate exacto no produce "1, 1, 2" | Automático (lógica ya existente en `rankEntries`/`PG.assignPositions`, re-testear con datos reales del corte). |
| Elegibilidad CALIBRANDO/RECALIBRANDO/inactividad/densidad mal resuelta | Automático, con fixtures reales de Staging — nunca mocks en Production (`Método_Trabajo.md`). |
| Job semanal duplica una edición ante doble disparo | Automático: invocar la función de cálculo dos veces para el mismo corte, confirmar constraint `unique(period_start_at)`. |
| "Mi red" trae relaciones incorrectas o fuera de los 180 días | Automático, reusando `get_player_match_history_for_level_engine` con fixtures de partidos dentro/fuera de la ventana. |
| RLS permite lectura directa de las tablas nuevas | Automático, mismo patrón que `supabase/tests/verify-rls.mjs` — proponer `supabase/tests/verify-bloque7.mjs` siguiendo la convención de nombres ya usada (`verify-bloque2..6.mjs`). |
| Cooldown de 30 días por cambio de ubicación | Automático una vez exista `location_effective_from` (Fase 1). |
| Ejecución real del cron un lunes / Global con 2+ países real | QA manual puntual en Staging — no automatizable sin esperar tiempo real o fabricar un segundo país real, que hoy no existe. |

---

## 9. Bloqueos

- Ninguno para empezar **Fase 1** (esquema) y **Fase 2** (función de cálculo probada a mano).
- Bloqueo real antes de **Fase 4**: habilitar `pg_cron` es una acción sobre el proyecto Supabase de Staging, fuera del alcance de esta ronda y de cualquier ronda de solo-análisis.
- Verificación pendiente, no bloqueante para arrancar pero necesaria antes de cerrar Fase 2 completa: representación exacta del "último Nivel consolidado" durante `RECALIBRANDO` (§2.3) — hoy no hay ninguna cuenta real en ese estado, así que no impide avanzar con el resto del esquema/cálculo.

---

## 10. DECISIÓN ABIERTA

**¿"Mi red" se materializa como parte de la edición semanal (mismo criterio congelado que los ámbitos territoriales) o se calcula en vivo en cada consulta, usando siempre el `mu` ya congelado de la edición vigente para ordenar?**

`Ranking_BRAMU.md` §3 abre con una regla general ("cada edición semanal se ordena por Nivel...") que sugiere que toda la clasificación —incluida Mi red— usa el Nivel congelado de la edición vigente. Pero §9 describe Mi red como una "vista personal de vínculos deportivos" con acciones siempre en vivo (`Ocultar`/`Volver a mostrar`) y una ventana de "los últimos 180 días" que se lee más naturalmente como rodante desde *ahora*, no desde el corte semanal. El documento no dice explícitamente si la *membresía* de Mi red también se congela el lunes o se recalcula cada vez.

Recomendación de esta ronda: **calcular Mi red en vivo** (§3 punto 7) — es más simple, no requiere materializar una segunda dimensión de la edición semanal para un ámbito que ya no usa umbrales de densidad territorial, y es coherente con que ocultar/restaurar ya es una acción en vivo sin noción de "edición". El **Nivel usado para ordenar dentro de Mi red sí sería el ya congelado** de la edición vigente (consistencia con el resto del Ranking). Queda marcada como decisión de producto real porque el maestro no la resuelve textualmente — no se continúa con Mi red más allá de este diseño conceptual hasta que se confirme o se corrija.

---

**Fin del análisis. No implementar sin handoff explícito de la fase siguiente.**
