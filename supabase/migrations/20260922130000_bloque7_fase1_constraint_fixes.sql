-- BRAMUlab — Bloque 7 (Fase 1, corrección): constraints de ranking_rows + comentario de
-- location_effective_from.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{05_Revision_Central_Fase_1.md,
-- 06_Correccion_Fase_1_Claude.md}. Corrige, sobre las tablas creadas por
-- `20260922100000_bloque7_ranking_schema.sql`/`20260922110000_bloque7_ranking_profile_data.sql`
-- (ninguna aplicada a Supabase todavía):
--
--   F1-C05 — invariantes de `ranking_rows` que el propio contrato ya documentaba pero la base
--            no garantizaba: `eligibility_reason_codes` debe ser siempre un array JSON;
--            `is_eligible=true` no debe dejar códigos de motivo residuales; `position`/
--            `tie_group`, cuando existen, deben ser positivos; `tie_group` debe ser realmente
--            igual a `position` (no solo "ambos null o ambos no null"); `total_eligible >= 0`;
--            `level_internal`/`level_public`, si no son NULL, dentro de la escala 1,0-10,0 de
--            Nivel BRAMU (Ranking_BRAMU.md §2).
--   F1-C06 — el unique de `ranking_rows` permitía que, por un bug de cálculo, el mismo jugador
--            quedara dos veces en el mismo `scope_type` (p. ej. dos filas 'local' con distinto
--            `scope_key`) dentro de la misma edición. V1 no tiene "Explorar rankings": Local/
--            Provincial/País son los ámbitos PROPIOS del jugador, como mucho una fila cada uno
--            por edición.
--   F1-C07 — el comentario de `profiles.location_effective_from` (archivo anterior) afirmaba
--            que el backfill con `updated_at` era "exactamente" el instante de la única
--            ubicación fijada. Eso no es un contrato general garantizable (`updated_at` cambia
--            con cualquier escritura de `complete_profile`, no solo con la ubicación) — se
--            corrige la afirmación sin cambiar el UPDATE de backfill en sí (que hoy, contra
--            Staging real, no modifica ninguna fila: todas las cuentas actuales tienen
--            `location_id = NULL`).

-- ------------------------------------------------------------------
-- F1-C05 — invariantes reales de ranking_rows
-- ------------------------------------------------------------------

alter table public.ranking_rows
  add constraint ranking_rows_reason_codes_is_array
    check (jsonb_typeof(eligibility_reason_codes) = 'array'),
  add constraint ranking_rows_eligible_has_no_residual_reason
    check (is_eligible = false or jsonb_array_length(eligibility_reason_codes) = 0),
  add constraint ranking_rows_position_positive
    check (position is null or position > 0),
  add constraint ranking_rows_tie_group_positive
    check (tie_group is null or tie_group > 0),
  add constraint ranking_rows_total_eligible_non_negative
    check (total_eligible >= 0),
  add constraint ranking_rows_level_internal_in_scale
    check (level_internal is null or (level_internal >= 1 and level_internal <= 10)),
  add constraint ranking_rows_level_public_in_scale
    check (level_public is null or (level_public >= 1 and level_public <= 10));

-- Reemplaza ranking_rows_tie_group_matches_position (solo "ambos NULL o ambos no NULL") por la
-- regla real que el diseño de Fase 1 ya documentaba en prosa: tie_group, cuando existe, es
-- SIEMPRE igual a position (ambas columnas conviven a propósito — ver el comentario de la
-- columna en 20260922100000 — pero hasta ahora nada obligaba la igualdad).
alter table public.ranking_rows
  drop constraint ranking_rows_tie_group_matches_position,
  add constraint ranking_rows_tie_group_equals_position
    check ((position is null and tie_group is null) or tie_group = position);

comment on constraint ranking_rows_reason_codes_is_array on public.ranking_rows is
  'F1-C05: eligibility_reason_codes debe ser siempre un array JSON (incluso vacío, "[]"), nunca
   un objeto/string/número — evita una fila con un motivo mal formado que ninguna lectura futura
   pueda interpretar.';
comment on constraint ranking_rows_eligible_has_no_residual_reason on public.ranking_rows is
  'F1-C05: complementa ranking_rows_ineligible_requires_reason (20260922100000) para volverla
   una equivalencia completa — is_eligible=true SIEMPRE con reason_codes vacío, is_eligible=false
   SIEMPRE con al menos un motivo. Nunca una fila elegible con un motivo de exclusión que quedó
   de un cálculo anterior.';

-- ------------------------------------------------------------------
-- F1-C06 — unicidad real por jugador/ámbito propio/edición
-- ------------------------------------------------------------------

alter table public.ranking_rows
  drop constraint ranking_rows_unique_player_scope_per_edition,
  add constraint ranking_rows_unique_player_scope_type_per_edition
    unique (edition_id, scope_type, player_id);

comment on constraint ranking_rows_unique_player_scope_type_per_edition on public.ranking_rows is
  'F1-C06 (05_Revision_Central_Fase_1.md): a lo sumo UNA fila por jugador por scope_type por
   edición — Local/Provincial/País/Global son los ámbitos PROPIOS del jugador congelados en el
   corte (nunca "Explorar rankings", fuera de V1), así que dos filas del mismo scope_type para
   el mismo jugador en la misma edición serían siempre un bug de la función de cálculo, nunca
   un caso real válido. scope_key sigue existiendo para agrupar/leer el universo de cada fila.';

-- ------------------------------------------------------------------
-- F1-C07 — comentario corregido de profiles.location_effective_from (sin cambiar el backfill)
-- ------------------------------------------------------------------

-- COMMENT ON COLUMN reemplaza por completo el comentario anterior (20260922110000) — no hace
-- falta tocar ese archivo ni el UPDATE de backfill que ya corrió en él: contra Staging real hoy
-- (22/09/2026) todas las cuentas tienen location_id = NULL, así que ese UPDATE no modifica
-- ninguna fila — este ajuste es exclusivamente de honestidad documental, no de datos.
comment on column public.profiles.location_effective_from is
  'Instante de SERVIDOR desde el que la ubicación actual (location_id) es efectiva —
   Backend_Infraestructura.md §5.3 / Ranking_BRAMU.md §8.5: el cooldown de 30 días para un
   próximo cambio se mide desde acá. Escritura EXCLUSIVA de complete_ranking_profile_data.
   NULL = todavía sin ningún cambio de ubicación auditado por esta vía. F1-C07
   (05_Revision_Central_Fase_1.md): el backfill de 20260922110000 usa profiles.updated_at como
   aproximación conservadora para una cuenta preexistente con location_id ya establecido antes
   de esta migración — NO es un contrato garantizado de precisión histórica (updated_at también
   cambia con cualquier otra escritura de complete_profile, no solo con la ubicación). Contra
   Staging real esto hoy no modifica ninguna fila: todas las cuentas actuales tienen
   location_id = NULL. Si algún día Production nace con cuentas preexistentes con ubicación ya
   fijada antes de esta columna existir, evaluar en ese momento una estrategia de backfill
   explícita para ese caso concreto, sin asumir que updated_at la resuelve sola.';
