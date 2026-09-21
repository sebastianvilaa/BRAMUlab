-- BRAMUlab — Bloque 6: match_level_results / match_level_result_players.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.3/§3.4,
-- 03_Plan_Implementacion_Claude.md §1.1}. Resumen:
--
--   1) `match_level_results` — cabecera de UN cálculo de Nivel para un partido/revisión. Cada
--      intento de oficialización/corrección/reaplicación crea una fila NUEVA (append-only,
--      nunca se pisa una fila existente); la anterior se marca `effect_status='reverted'` en vez
--      de borrarse. `eligible=false` representa un partido oficial en historial/estadísticas que
--      NO produjo efecto de Nivel (ventana de 30 días excedida — Nivel_BRAMU_Formula_V1.5.md
--      §12.2/§13 — o disponibilidad insuficiente): se guarda igual, con sus reasonCodes, para
--      que quede auditado por qué no hubo delta.
--   2) `match_level_result_players` — una fila por jugador CONOCIDO afectado por ese resultado.
--      Un invitado o un slot no identificado NUNCA tiene fila acá (nunca reciben efecto —
--      Nivel_BRAMU_Formula_V1.5.md §13/§21). Esta tabla, filtrada por effect_status='applied' en
--      match_level_results, es la fuente para derivar rated_matches/distinct_opponents por
--      CONSULTA DIRECTA en vez de contadores incrementales — una reversión los corrige sola, sin
--      lógica de "restar a mano" propensa a desincronizarse.
--
-- Único índice parcial: como máximo UN resultado 'applied' por match_id a la vez — es lo que
-- garantiza que revertir-antes-de-reaplicar (03_Plan_Implementacion_Claude.md, officialize_match_
-- validation) nunca deje dos resultados vigentes del mismo partido compitiendo por el conteo de
-- rated_matches/distinct_opponents de un jugador.
--
-- RLS deny-by-default TOTAL — mismo criterio que las 7 tablas de Bloque 5: ningún SELECT directo
-- para authenticated/anon, lectura exclusivamente vía RPC SECURITY DEFINER (get_match_detail
-- extendida, Bloque 6 checkpoint 9).

create table public.match_level_results (
  result_id                     uuid primary key default gen_random_uuid(),
  match_id                      uuid not null references public.matches (match_id) on delete cascade,
  revision_id                   uuid not null references public.match_revisions (revision_id),
  computed_at                   timestamptz not null default now(),
  -- Por qué se calculó este resultado — nunca se infiere después de los hechos.
  -- Una acción administrativa reusa uno de estos 4 triggers (nunca uno propio): actor_note
  -- documenta que fue una intervención de admin_force_resolve. admin_annul_match no pasa por
  -- acá: solo revierte (§3.11), no reaplica.
  trigger                       text not null check (trigger in (
                                   'initial', 'correction_accepted', 'identity_resolved',
                                   'identity_unidentified'
                                 )),
  algorithm_version             text not null,
  -- false = partido oficial sin efecto de Nivel (ventana de 30 días excedida, o disponibilidad
  -- insuficiente tras una identidad no resuelta) — igual se guarda para auditoría, con
  -- reason_codes explicando por qué. No existe una tercera tabla para "intentos sin efecto".
  eligible                      boolean not null,
  reason_codes                  jsonb not null default '[]'::jsonb,
  known_levels_count            smallint,
  team_strength_a               numeric,
  team_strength_b               numeric,
  expectation_a                 numeric,
  expectation_b                 numeric,
  rival_pair_confidence_avg_a   numeric,
  rival_pair_confidence_avg_b   numeric,
  margin                        numeric,
  format_factor                 numeric,
  availability_factor           numeric,
  -- Repetición/compañero son factores de EQUIPO (level-context.js#computeTeamRepetitionFactors),
  -- no individuales — viven acá una sola vez por equipo, nunca duplicados en cada jugador.
  repetition_factor_a           numeric,
  repetition_factor_b           numeric,
  companion_factor_a            numeric,
  companion_factor_b            numeric,
  -- 'applied' = vigente ahora mismo; 'reverted' = fue vigente y ya se revirtió (corrección,
  -- identidad, o anulación administrativa). Nunca se borra una fila, nunca se sobreescribe.
  effect_status                 text not null default 'applied' check (effect_status in ('applied', 'reverted')),
  reverted_at                   timestamptz,
  -- Encadenamiento explícito para poder reconstruir oficialización -> reversión -> nueva
  -- oficialización sin ambigüedad (Nivel_BRAMU_Formula_V1.5.md §12.3: "conservar ambas
  -- versiones y la causa").
  reverses_result_id            uuid references public.match_level_results (result_id),
  superseded_by_result_id       uuid references public.match_level_results (result_id),
  actor_player_id                uuid references public.players (player_id),
  actor_note                    text,
  created_at                    timestamptz not null default now()
);

comment on table public.match_level_results is
  'Cabecera append-only de un cálculo de Nivel para un partido/revisión (Bloque 6). Escritura
   EXCLUSIVA de officialize_match_validation/RPCs de identidad/RPCs admin (todas service_role).
   Como máximo un effect_status=applied por match_id a la vez (ver índice único parcial). No se
   reimplementa el motor acá: cada fila persiste un resultado YA CALCULADO por level.js/
   level-context.js en la Edge Function correspondiente.';
comment on column public.match_level_results.eligible is
  'false = el partido quedó oficial (historial/estadísticas) pero sin efecto de Nivel — ventana
   de 30 días desde played_at excedida (Nivel_BRAMU_Formula_V1.5.md §12.2/§13) o disponibilidad
   insuficiente. reason_codes documenta el motivo exacto.';

create unique index match_level_results_one_applied_per_match
  on public.match_level_results (match_id)
  where effect_status = 'applied';

create index match_level_results_match_id_idx on public.match_level_results (match_id);
create index match_level_results_reverses_idx on public.match_level_results (reverses_result_id) where reverses_result_id is not null;

alter table public.match_level_results enable row level security;
-- Deny-by-default TOTAL — sin políticas de select/insert/update/delete para authenticated/anon,
-- mismo criterio que las tablas de partidos de Bloque 5. Lectura exclusiva vía RPC SECURITY
-- DEFINER (get_match_detail extendida).

grant select, insert, update, delete on table public.match_level_results to service_role;

-- ------------------------------------------------------------------
-- match_level_result_players
-- ------------------------------------------------------------------

-- 06_Revision_Fase_A_ChatGPT.md B6-A-04/B6-A-05 + 10_Revision_Final_Pre_Staging_ChatGPT.md C-01:
-- se distinguen DOS referencias inmutables por jugador/partido (nunca cambian entre
-- correcciones del MISMO partido) y un efecto derivado —
--   - formula_mu_before / formula_confidence_before / formula_state: la referencia INMUTABLE
--     que alimentó la fórmula (expectativa, K, opponentFactor) — Nivel_BRAMU_Formula_V1.5.md
--     §12.3 "los mismos snapshots previos". Nunca se usa para revertir.
--   - original_live_mu_before / original_live_confidence_before / original_live_evidence_units_
--     before: el valor LIVE que existía la PRIMERA VEZ que este partido se calculó para este
--     jugador (trigger=initial, o el estado histórico reconstruido para una identidad recién
--     incorporada) — se PROPAGA SIN CAMBIOS en cada corrección/reaplicación posterior de este
--     mismo partido/jugador.
--   - mu_after / confidence_after: el valor ABSOLUTO que la fórmula calculó en ESTA aplicación
--     puntual, desde su propia referencia congelada — NUNCA el valor LIVE contaminado por
--     partidos posteriores (C-01: antes de este fix, revertir/reaplicar podía pisar el efecto de
--     un partido posterior intercalado entre dos correcciones del mismo partido, tanto en
--     confidence — un valor absoluto asignado directo — como en mu cerca de los clamps 1.0/10.0,
--     donde sumar el delta nominal sobre un LIVE ya desplazado re-ancla el clamp en el punto
--     equivocado). El EFECTO de una aplicación es siempre `X_after - original_live_X_before`
--     (evidence_units usa directamente `evidence_quality`, ya un incremento puro) — nunca una
--     asignación absoluta ni un delta aditivo sobre el LIVE actual. `final_live = current_live -
--     efecto_anterior + efecto_nuevo`, ambos efectos relativos a la MISMA referencia inmutable,
--     así que el efecto de cualquier partido/corrección posterior queda intacto sin importar
--     cuántas veces se corrija este partido.
create table public.match_level_result_players (
  result_id                          uuid not null references public.match_level_results (result_id) on delete cascade,
  player_id                          uuid not null references public.players (player_id),
  team                               text not null check (team in ('A', 'B')),
  formula_mu_before                  numeric not null,
  formula_confidence_before          numeric not null,
  formula_state                      text not null,
  effective_level                    numeric not null,
  k                                  numeric not null,
  opponent_factor                    numeric not null,
  -- Círculo competitivo SÍ es individual (level-context.js calcula un array por jugador dentro
  -- del equipo, dos compañeros pueden tener un círculo cerrado distinto). Repetición/compañero/
  -- disponibilidad son de equipo/partido y viven en match_level_results (cabecera), no acá.
  circle_factor                      numeric not null,
  delta_raw                          numeric not null,
  delta_capped                       numeric not null,
  evidence_quality                   numeric not null,
  original_live_mu_before            numeric not null,
  original_live_confidence_before    numeric not null,
  original_live_evidence_units_before numeric not null,
  mu_after                           numeric not null,
  confidence_after                   numeric not null,
  primary key (result_id, player_id)
);

comment on table public.match_level_result_players is
  'Una fila por jugador CONOCIDO afectado por un match_level_results (Bloque 6). Un invitado o
   un slot no identificado NUNCA tiene fila acá (Nivel_BRAMU_Formula_V1.5.md §13/§21: nunca
   reciben efecto). mu_after/confidence_after son el valor ABSOLUTO de fórmula de ESTA
   aplicación (C-01, nunca contaminado por el LIVE); original_live_*_before es la referencia
   LIVE inmutable de este partido/jugador, propagada sin cambios entre correcciones.
   formula_mu_before/formula_confidence_before/formula_state son la referencia inmutable que
   alimentó la fórmula (§12.3). Fuente para derivar rated_matches/distinct_opponents por
   consulta directa (join contra match_level_results.effect_status=applied), nunca por contador
   incremental.';

create index match_level_result_players_player_id_idx on public.match_level_result_players (player_id, result_id);

alter table public.match_level_result_players enable row level security;
-- Deny-by-default TOTAL, mismo criterio que la tabla cabecera.

grant select, insert, update, delete on table public.match_level_result_players to service_role;
