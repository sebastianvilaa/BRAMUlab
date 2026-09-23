-- BRAMUlab — Bloque 8 (Fase D): persistencia mínima de BRAMU Intelligence.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_08/15_Handoff_Fase_D_Claude.md §8/§9. Resumen:
--
--   1) `intelligence_player_memory` — UNA fila por jugador con la memoria editorial (Fase C) +
--      de plantillas (Fase D) más reciente. Handoff §8: "la memoria editorial puede
--      persistirse... en una estructura separada por jugador" — se elige esta opción, la más
--      simple, en vez de un snapshot por fila de salida (evita encadenar dependencias hacia
--      atrás en la historia solo para poder generar la salida de un partido).
--   2) `intelligence_match_outputs` — UNA fila por (jugador, partido): la salida ya renderizada
--      (Fase D) + el `source_fingerprint` (huella determinística del prefijo de historia usado,
--      `PLIntelligencePresentation.computeHistoryFingerprint`) que decide si esa fila sigue
--      siendo válida o hay que regenerarla. Nunca hay dos filas vigentes para el mismo
--      (jugador, partido): un reintento simplemente sobreescribe (upsert) — no existe un estado
--      "invalidated" separado, la propia comparación de fingerprint en la Edge Function decide
--      cuándo regenerar y sobreescribir.
--
-- "Cuatro jugadores pueden recibir Intelligence diferente sobre el mismo encuentro" (handoff
-- §8): por eso la clave es (player_id, match_id), nunca solo match_id.
--
-- RLS: mismo criterio EXACTO que `match_level_results`/`ranking_rows` (Bloques 6/7) — deny-by-
-- default TOTAL, cero políticas para `authenticated`/`anon`, lectura y escritura exclusivas de
-- `service_role`. La Edge Function `get-match-intelligence` (Fase D) es la única vía: el cliente
-- nunca lee ni escribe estas tablas directamente, ni siquiera la suya — recibe la salida como
-- respuesta de la función autenticada (handoff §9: "preferir devolver la salida desde la función
-- autenticada si eso mantiene el contrato más simple").

-- ------------------------------------------------------------------
-- 1) intelligence_player_memory
-- ------------------------------------------------------------------

create table public.intelligence_player_memory (
  player_id     uuid primary key references public.players (player_id) on delete cascade,
  -- Memoria combinada Fase C (`PLIntelligenceEditorial.emptyMemory()`/`memoryUpdate`) + Fase D
  -- (`recentTemplateIds`, `learningHitosShown`) — un solo blob, ver §8 del handoff: "elegir la
  -- opción más simple que permita reproducibilidad y continuidad". Nunca se interpreta acá
  -- dentro de SQL: la Edge Function la lee/escribe tal cual, siempre a través de los módulos
  -- compartidos (`intelligence-editorial.js`/`intelligence-presentation.js`).
  memory        jsonb not null,
  rules_version text not null,
  updated_at    timestamptz not null default now()
);

comment on table public.intelligence_player_memory is
  'Una fila por jugador con la memoria editorial (Fase C) + de plantillas (Fase D) más
   reciente — refleja el estado "como de ahora", nunca un historial por partido (Bloque 8 Fase D,
   handoff §8). Escritura exclusiva de la Edge Function get-match-intelligence, service_role.';

alter table public.intelligence_player_memory enable row level security;
-- Deny-by-default deliberado: ninguna política para authenticated/anon. La Edge Function nunca
-- expone esta fila directamente al cliente — solo la usa como insumo para generar la salida.

grant select, insert, update, delete on table public.intelligence_player_memory to service_role;

-- ------------------------------------------------------------------
-- 2) intelligence_match_outputs
-- ------------------------------------------------------------------

create table public.intelligence_match_outputs (
  player_id           uuid not null references public.players (player_id) on delete cascade,
  match_id            uuid not null references public.matches (match_id) on delete cascade,
  -- Huella determinística del prefijo de historia (hasta este partido inclusive, ordenado por
  -- `playedAt`) usado para generar esta salida — `PLIntelligencePresentation.
  -- computeHistoryFingerprint`. Si al reabrir el Resumen la huella recalculada coincide, se
  -- devuelve esta fila tal cual (idempotencia real, handoff §8: "no regenerarla al abrir una
  -- pantalla"); si no coincide (corrección, identidad resuelta, partido retroactivo insertado
  -- antes de este), se regenera y esta fila se sobreescribe.
  source_fingerprint  text not null,
  -- Versión combinada de reglas A+B+C+D vigente al generar esta salida (no solo D) — si CUALQUIERA
  -- de las 4 fases sube de versión, esta fila deja de considerarse reutilizable aunque el
  -- fingerprint de historia siga siendo el mismo.
  rules_version       text not null,
  -- Salida completa ya renderizada por PLIntelligencePresentation.renderIntelligence: principal,
  -- secundarios, abstención/aprendizaje, evidencia humana ("why") — lista para pintar sin
  -- recalcular nada al abrir la pantalla (handoff §7: "la evidencia visible se deriva del
  -- objeto guardado").
  output              jsonb not null,
  generated_at        timestamptz not null default now(),

  primary key (player_id, match_id)
);

comment on table public.intelligence_match_outputs is
  'Una fila por (jugador, partido): la salida de BRAMU Intelligence ya renderizada + su huella
   de historia y versión de reglas (Bloque 8 Fase D). Un mismo match_id puede tener hasta 4 filas
   (una por jugador con perspectiva distinta) — nunca se comparte entre jugadores. Escritura
   exclusiva de la Edge Function get-match-intelligence, service_role. No existe un estado
   "invalidated": una fila que deja de coincidir en fingerprint/rules_version simplemente se
   sobreescribe (upsert) la próxima vez que se pide.';

create index intelligence_match_outputs_match_id_idx on public.intelligence_match_outputs (match_id);

alter table public.intelligence_match_outputs enable row level security;
-- Deny-by-default deliberado, mismo criterio que match_level_results/ranking_rows — la Edge
-- Function siempre devuelve la salida en la propia respuesta autenticada, nunca hace falta que
-- el cliente lea esta tabla por su cuenta.

grant select, insert, update, delete on table public.intelligence_match_outputs to service_role;
