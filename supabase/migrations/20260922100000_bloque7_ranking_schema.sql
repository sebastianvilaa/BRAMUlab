-- BRAMUlab — Bloque 7 (Fase 1): esquema de Ranking real semanal.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{02_Analisis_Claude.md,
-- 03_Revision_Central_Analisis.md, 04_Resultado_Fase_1_Claude.md}. Resumen de lo que esta
-- migración agrega:
--
--   1) `ranking_editions` — una fila por edición semanal publicada (Ranking_BRAMU.md §4/§17.3).
--      Inmutable una vez insertada: no hay UPDATE previsto sobre una edición ya escrita.
--   2) `ranking_rows` — una fila por jugador candidato por ámbito por edición, append-only
--      (Ranking_BRAMU.md §17.2/§16 — "una edición semanal publicada nunca se reescribe").
--      Incluye EXPLÍCITAMENTE a los candidatos no elegibles y su motivo — no son opcionales
--      (03_Revision_Central_Analisis.md C-02).
--
-- Fuera de esta migración a propósito (Fase 2/3/4, no Fase 1):
--   - la función de cálculo que puebla estas tablas para un corte dado;
--   - las RPCs de lectura que las exponen al cliente (03_Revision_Central_Analisis.md C-03: el
--     cliente NUNCA debe poder pedir un scope_key arbitrario — eso sería "Explorar rankings",
--     fuera de V1 — así que ninguna RPC de lectura se crea todavía);
--   - `pg_cron`/publicación automática;
--   - "Mi red": decisión ya cerrada (C-01) de NO materializarla como tabla — se calcula en
--     lectura, en Fase 3, usando el corte de la edición vigente. Por eso `scope_type` de
--     `ranking_rows` NO incluye 'red' — el CHECK de más abajo lo excluye a propósito.
--
-- RLS: mismo criterio *deny-by-default* que `match_level_results`/`match_level_result_players`
-- (Bloque 6) — RLS habilitada, CERO políticas para `authenticated`/`anon`, lectura y escritura
-- exclusivas de `service_role` (la función de cálculo de Fase 2 corre como `service_role` o
-- como una función `SECURITY DEFINER` propiedad del owner de las tablas, que por eso mismo
-- nunca necesita una política propia para escribir).

-- ------------------------------------------------------------------
-- 1) ranking_editions
-- ------------------------------------------------------------------

create table public.ranking_editions (
  edition_id           uuid primary key default gen_random_uuid(),
  -- Instantes reales (no strings) del corte — Ranking_BRAMU.md §4.1: lunes 00:00:00 a domingo
  -- 23:59:59.999, siempre en America/Argentina/Buenos_Aires para V1 (columna `timezone` de más
  -- abajo documenta con qué huso se calcularon, nunca se recalculan con el huso del servidor).
  period_start_at      timestamptz not null,
  period_end_at         timestamptz not null,
  -- Momento real en que la función de cálculo de Fase 2 corrió, no necesariamente exactamente
  -- lunes 00:00:00 (Ranking_BRAMU.md §17.3: "la infraestructura puede materializar el snapshot
  -- segundos/minutos después"; el instante EFECTIVO de corte sigue siendo period_start_at).
  published_at          timestamptz not null default now(),
  timezone              text not null default 'America/Argentina/Buenos_Aires',
  -- Versión de las reglas de Ranking aplicadas a ESTA edición (independiente de
  -- `algorithm_version` de Nivel, que vive por fila en `ranking_rows` porque puede variar entre
  -- jugadores de la misma edición). 'ranking_v1' hasta que exista una revisión de reglas.
  ranking_rules_version text not null default 'ranking_v1',
  created_at             timestamptz not null default now(),
  -- Idempotencia (Backend_Infraestructura.md Bloque 7 "Terminado cuando"/handoff §Restricciones):
  -- un segundo disparo del job semanal para el MISMO corte nunca duplica la edición — la función
  -- de cálculo de Fase 2 debe hacer SELECT antes de INSERT, y este constraint es la defensa en
  -- profundidad si de todos modos llegaran dos INSERT concurrentes.
  constraint ranking_editions_period_start_unique unique (period_start_at),
  constraint ranking_editions_period_valid check (period_end_at > period_start_at)
);

comment on table public.ranking_editions is
  'Una fila por edición semanal de Ranking BRAMU publicada (Bloque 7, Fase 1 — solo esquema).
   Inmutable: la función de cálculo de Fase 2 únicamente hace INSERT, nunca UPDATE sobre una
   edición ya escrita (Ranking_BRAMU.md §4/§16 — "una edición semanal publicada nunca se
   reescribe"). Sin columna de estado draft/published a propósito: la fila se crea recién cuando
   la edición completa (con todas sus ranking_rows) ya está lista, dentro de la misma transacción
   — su sola existencia YA significa "publicada".';
comment on column public.ranking_editions.published_at is
  'Instante real de ejecución del cálculo, siempre por timestamp de servidor — nunca enviado por
   un cliente. Puede ser minutos después de period_start_at; el corte EFECTIVO sigue siendo
   period_start_at (Ranking_BRAMU.md §17.3).';

alter table public.ranking_editions enable row level security;
-- Deny-by-default deliberado: sin políticas para authenticated/anon. Fase 3 agrega la RPC de
-- lectura (`get_current_ranking_edition` u equivalente, 02_Analisis_Claude.md §5) — hasta
-- entonces esta tabla no es alcanzable desde el cliente por ningún camino.

grant select, insert, update, delete on table public.ranking_editions to service_role;

-- ------------------------------------------------------------------
-- 2) ranking_rows
-- ------------------------------------------------------------------

create table public.ranking_rows (
  row_id                     uuid primary key default gen_random_uuid(),
  edition_id                 uuid not null references public.ranking_editions (edition_id) on delete cascade,
  player_id                  uuid not null references public.players (player_id),
  -- 'red' (Mi red) NO está en esta lista a propósito — decisión cerrada (C-01): se calcula en
  -- lectura sobre el corte de la edición vigente, nunca se materializa acá.
  scope_type                 text not null check (scope_type in ('local', 'provincial', 'pais', 'global')),
  -- Canónico, nunca un label libre (03_Revision_Central_Analisis.md C-07/C-08 y
  -- Backend_Infraestructura.md §5.3): 'local' → `locations.location_id::text` (ya es la clave
  -- de deduplicación real entre perfiles de la MISMA localidad GeoRef, ver
  -- `locations_georef_unique`); 'provincial' → `country_code || ':' || georef_province_id`;
  -- 'pais' → `country_code`; 'global' → literal fijo 'GLOBAL' (nunca NULL — un scope_key nulo
  -- rompería el unique de más abajo, que depende de que NULL nunca se repita como "distinto").
  scope_key                  text not null,
  -- Elegibilidad INDIVIDUAL del jugador (Ranking_BRAMU.md §6, las 7 condiciones), independiente
  -- de cuántos otros jugadores haya en su universo. La densidad del universo (columna
  -- `density_status`) decide si un elegible además recibe `position`, nunca decide
  -- `is_eligible` en sí.
  is_eligible                 boolean not null,
  -- NULL cuando: no elegible, O elegible pero el universo no alcanza densidad para publicar
  -- puestos (0-4, Ranking_BRAMU.md §10). Nunca hay `position` sobre una fila no elegible — ver
  -- el CHECK de más abajo.
  position                    integer,
  -- Igual a `position` para toda fila que comparte puesto en un empate exacto ("1, 1, 3") —
  -- columna separada, no solo derivada, para que una lectura de auditoría pueda agrupar
  -- empates sin tener que reinterpretar `position` con dos significados a la vez
  -- (03_Revision_Central_Analisis.md C-02: "tie_group... o representación equivalente
  -- persistida"). NULL exactamente cuando `position` es NULL.
  tie_group                   integer,
  total_eligible               integer not null,
  density_status              text not null check (density_status in ('insufficient', 'forming', 'established')),
  -- Nivel interno EXACTO del corte (4 decimales, mismo criterio que level_states.mu) — nunca el
  -- Nivel "vivo" al momento de leer. NULL solo si el jugador nunca tuvo ningún Nivel calculado.
  level_internal               numeric,
  level_public                 numeric,
  level_band                   smallint check (level_band is null or (level_band between 1 and 10)),
  level_status                 text check (level_status is null or level_status in ('PENDIENTE', 'CALIBRANDO', 'CALIBRADO', 'RECALIBRANDO')),
  -- Versión del algoritmo de Nivel usada para calcular ESTE valor, no necesariamente igual entre
  -- todas las filas de la misma edición (03_Revision_Central_Analisis.md C-08). NULL hasta que
  -- Fase 2 resuelva cómo obtenerlo (ver 04_Resultado_Fase_1_Claude.md §RECALIBRANDO/versionado).
  level_algorithm_version       text,
  -- Último partido computable válido, congelado al corte — nunca recalculado después con
  -- partidos posteriores (insumo de la regla de inactividad de 180 días, Ranking_BRAMU.md §7).
  last_computable_at            timestamptz,
  -- Ubicación congelada por IDs canónicos, nunca por label libre (C-07/C-08). `location_id`
  -- referencia la fila de `locations` vigente en el momento del corte — esa fila es inmutable
  -- por diseño (Bloque 2: un cambio de ubicación siempre crea/reutiliza OTRA fila, nunca la
  -- edita), así que esta referencia sigue siendo válida y estable para siempre.
  location_id                   uuid references public.locations (location_id),
  location_country_code         text,
  location_province_id          text,
  location_locality_id          text,
  -- Solo para mostrar en UI (Fase 5) sin un join adicional — nunca participa de scope_key ni de
  -- ningún agrupamiento (C-07: "no agrupar por labels libres").
  location_display_label        text,
  competitive_branch            text check (competitive_branch is null or competitive_branch in ('F', 'M')),
  -- Array de códigos, mismo criterio que `match_level_results.reason_codes` (Bloque 6): jsonb
  -- libre, sin ENUM en la base — Fase 2 decide el vocabulario exacto sin necesitar otra
  -- migración. Vocabulario esperado (no exhaustivo, documentado en
  -- 04_Resultado_Fase_1_Claude.md): 'ranking_opt_in_false', 'location_missing',
  -- 'location_not_verified', 'competitive_branch_missing', 'level_not_calibrated',
  -- 'recalibrating_without_consolidated', 'inactive_180_days', 'account_excluded',
  -- 'account_inactive'.
  eligibility_reason_codes      jsonb not null default '[]'::jsonb,
  -- Copia por fila de `ranking_editions.ranking_rules_version` — denormalizado a propósito
  -- (Ranking_BRAMU.md §17.2 lo pide como campo de la fila, no solo de la edición): permite leer
  -- una fila de auditoría sin JOIN para saber bajo qué reglas se evaluó.
  ranking_rules_version          text not null,
  created_at                    timestamptz not null default now(),

  constraint ranking_rows_position_requires_eligible check (position is null or is_eligible),
  constraint ranking_rows_tie_group_matches_position check (
    (position is null and tie_group is null) or (position is not null and tie_group is not null)
  ),
  -- 03_Revision_Central_Analisis.md C-02: un candidato no elegible SIEMPRE debe traer al menos
  -- un motivo — nunca una fila `is_eligible=false` con `eligibility_reason_codes='[]'`.
  constraint ranking_rows_ineligible_requires_reason check (
    is_eligible or jsonb_array_length(eligibility_reason_codes) > 0
  ),
  -- Como máximo una fila por jugador por ámbito por edición (un jugador SÍ puede tener varias
  -- filas en la misma edición: una por cada scope_type en el que es candidato — local,
  -- provincial, país — nunca dos filas para el mismo scope_type+scope_key).
  constraint ranking_rows_unique_player_scope_per_edition unique (edition_id, scope_type, scope_key, player_id)
);

comment on table public.ranking_rows is
  'Una fila por jugador candidato por ámbito por edición de Ranking (Bloque 7, Fase 1 — solo
   esquema). Append-only: la función de cálculo de Fase 2 únicamente INSERTA filas nuevas para la
   edición que está construyendo, nunca UPDATE sobre una fila de una edición ya publicada.
   Incluye SIEMPRE a los candidatos no elegibles con su motivo (03_Revision_Central_Analisis.md
   C-02) — nunca se omite una fila para "ahorrar espacio".';
comment on column public.ranking_rows.is_eligible is
  'Elegibilidad INDIVIDUAL (Ranking_BRAMU.md §6): cuenta activa e identidad estable,
   ranking_opt_in, ubicación estructurada verificada, competitive_branch declarado, Nivel
   CALIBRADO o RECALIBRANDO-con-consolidado, actividad dentro de 180 días, sin exclusión de
   integridad. Independiente de la densidad del universo — ver `density_status`.';
comment on column public.ranking_rows.density_status is
  'Densidad del UNIVERSO (scope_type+scope_key) en esta edición, no del jugador individual
   (Ranking_BRAMU.md §10): insufficient (0-4, sin puestos), forming (5-14, "N de total" sin
   podio), established (15+). Un jugador is_eligible=true en un universo insufficient igual
   tiene position=NULL.';

create index ranking_rows_scope_position_idx
  on public.ranking_rows (edition_id, scope_type, scope_key, position);
create index ranking_rows_edition_player_idx
  on public.ranking_rows (edition_id, player_id);

alter table public.ranking_rows enable row level security;
-- Deny-by-default deliberado, mismo criterio que match_level_results — ninguna RPC de lectura
-- existe todavía en Fase 1 (eso es Fase 3), así que esta tabla es hoy inalcanzable desde el
-- cliente por cualquier camino.

grant select, insert, update, delete on table public.ranking_rows to service_role;
