-- BRAMUlab — Bloque 8 (Fase D): persistencia mínima de BRAMU Intelligence.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_08/15_Handoff_Fase_D_Claude.md §8/§9 y
-- 17_Revision_Central_Fase_D.md §2 (D01). Diseño ACTUAL — reemplaza directamente la primera
-- versión de esta misma migración (nunca aplicada a Supabase, así que se reemplaza en el lugar
-- en vez de arrastrar una migración compensatoria, autorizado explícitamente por la corrección
-- D01): la fuente y el handoff exigen que la memoria/generación siga `playedAt`, nunca el orden
-- de apertura/carga del usuario. Un solo blob global "memoria actual del jugador" no puede
-- garantizar eso — un partido viejo podía terminar influido por partidos futuros, y corregir el
-- partido más reciente podía autopenalizarlo contra su propia salida anterior.
--
-- Ahora existe UNA sola tabla, `intelligence_match_outputs`, con un CHECKPOINT por
-- (jugador, partido):
--
--   - `output`: la salida visible ya renderizada (Fase D) — nunca incluye la memoria interna;
--   - `memory_after`: la memoria editorial (Fase C) + de plantillas (Fase D) combinada,
--     INMEDIATAMENTE DESPUÉS de este partido — el "checkpoint" real. Nunca se envía al cliente.
--   - `audit`: snapshot de auditoría completo — TODOS los claims de Fase B (afirmados y
--     descartados), la evaluación editorial de Fase C (score/subscores/penalizaciones/motivo de
--     cada candidato) y a qué principal/secundarios/templateIds llegó la decisión final. Server-
--     only, NUNCA se envía al cliente (Revisión Central Fase D — auditoría, D06). Existe para
--     poder reconstruir por qué se tomó una decisión histórica sin volver a ejecutar las reglas
--     actuales sobre datos que pueden haber cambiado desde entonces (BRAMU_Intelligence.md §6.5).
--
-- La Edge Function `get-match-intelligence` (Fase D) camina cronológicamente desde el primer
-- partido de la historia del jugador hasta el partido pedido, reutilizando cada checkpoint cuyo
-- `source_fingerprint`+`rules_version` siga vigente y regenerando (con la memoria del checkpoint
-- INMEDIATAMENTE anterior, nunca con "la memoria actual") los que falten o hayan quedado
-- inválidos — ver `PLIntelligencePresentation.runIntelligenceReplay` (bramulab/intelligence-
-- presentation.js). Esto garantiza, por construcción:
--
--   - un partido viejo nunca puede recibir memoria de partidos posteriores (nunca se camina más
--     allá del partido pedido);
--   - corregir el partido MÁS RECIENTE nunca lo penaliza contra su propia salida anterior (su
--     memoria previa es siempre la del checkpoint de partido−1, nunca la que ya lo incluye);
--   - una carga retroactiva o una corrección en cualquier punto invalida automáticamente el
--     fingerprint de TODOS los prefijos posteriores que la incluyan (el fingerprint de cada
--     checkpoint se calcula sobre el PREFIJO completo, no solo sobre ese partido individual);
--   - un cambio de `rules_version` invalida un checkpoint aunque su fingerprint de datos no haya
--     cambiado.
--
-- "Cuatro jugadores pueden recibir Intelligence diferente sobre el mismo encuentro" (handoff
-- §8): por eso la clave sigue siendo (player_id, match_id), nunca solo match_id.
--
-- RLS: mismo criterio EXACTO que `match_level_results`/`ranking_rows` (Bloques 6/7) — deny-by-
-- default TOTAL, cero políticas para `authenticated`/`anon`, lectura y escritura exclusivas de
-- `service_role`. La Edge Function es la única vía: el cliente nunca lee ni escribe esta tabla
-- directamente, ni siquiera la suya — recibe `output` como respuesta de la función autenticada.

create table public.intelligence_match_outputs (
  player_id           uuid not null references public.players (player_id) on delete cascade,
  match_id            uuid not null references public.matches (match_id) on delete cascade,
  -- Huella determinística del prefijo de historia (hasta este partido inclusive, ordenado por
  -- `playedAt`) usado para generar este checkpoint —
  -- `PLIntelligencePresentation.computeHistoryFingerprint`. Incluye identidad real de
  -- participantes, formato, sistema de scoring y conocimiento de hora además del resultado
  -- (Revisión Central Fase D, D02) — cualquier cambio real en cualquier partido del prefijo
  -- cambia esta huella. Si al recalcularla coincide, se reutiliza este checkpoint tal cual
  -- (idempotencia real, handoff §8: "no regenerarla al abrir una pantalla"); si no coincide, se
  -- regenera y esta fila se sobreescribe.
  source_fingerprint  text not null,
  -- Versión combinada de reglas A+B+C+D vigente al generar este checkpoint — si CUALQUIERA de
  -- las 4 fases sube de versión, este checkpoint deja de considerarse reutilizable aunque el
  -- fingerprint de historia siga siendo el mismo.
  rules_version       text not null,
  -- Salida VISIBLE ya renderizada por PLIntelligencePresentation.renderIntelligence (principal,
  -- secundarios, abstención/aprendizaje, evidencia humana "why") — lista para pintar sin
  -- recalcular nada al abrir la pantalla. Nunca incluye `memoryUpdate` (ver `memory_after`).
  output              jsonb not null,
  -- Memoria editorial (Fase C) + de plantillas (Fase D) combinada, INMEDIATAMENTE DESPUÉS de
  -- este partido — el checkpoint real que D01 exige. Nunca se envía al cliente: solo lo lee la
  -- Edge Function como `memoryBefore` del SIGUIENTE partido en la caminata cronológica.
  memory_after        jsonb not null,
  -- Snapshot de auditoría completo de la decisión de ESTE partido — ver la nota de cabecera de
  -- este archivo y `PLIntelligencePresentation.buildAuditSnapshot`/`runIntelligenceReplay`
  -- (bramulab/intelligence-presentation.js). Server-only: la Edge Function nunca la incluye en
  -- su respuesta al cliente (`output` es lo único que se devuelve). Un checkpoint reutilizado
  -- (mismo fingerprint + rules_version) reutiliza este campo tal cual, sin regenerarlo.
  audit               jsonb not null,
  generated_at        timestamptz not null default now(),

  primary key (player_id, match_id)
);

comment on table public.intelligence_match_outputs is
  'Un CHECKPOINT por (jugador, partido): la salida visible de BRAMU Intelligence ya renderizada
   (`output`) + la memoria editorial/de plantillas combinada inmediatamente después de ese
   partido (`memory_after`, nunca expuesta al cliente) + el snapshot completo de auditoría
   (`audit`: claims de Fase B afirmados y descartados, evaluación editorial de Fase C con
   scores/motivos, selección final — server-only, Bloque 8 Fase D, corrección D06) + su huella de
   historia y versión de reglas (corrección D01/D02). La Edge Function get-match-intelligence
   camina cronológicamente por estos checkpoints — nunca usa un blob global de "memoria actual".
   Un mismo match_id puede tener hasta 4 filas (una por jugador con perspectiva distinta) — nunca
   se comparte entre jugadores. Escritura exclusiva de la Edge Function, service_role. No existe
   un estado "invalidated": una fila que deja de coincidir en fingerprint/rules_version simplemente
   se sobreescribe (upsert) la próxima vez que la caminata cronológica pasa por ese partido.';

create index intelligence_match_outputs_match_id_idx on public.intelligence_match_outputs (match_id);

alter table public.intelligence_match_outputs enable row level security;
-- Deny-by-default deliberado, mismo criterio que match_level_results/ranking_rows — la Edge
-- Function siempre devuelve `output` en la propia respuesta autenticada, nunca hace falta que el
-- cliente lea esta tabla por su cuenta (y `memory_after`/`audit` nunca deben llegar al cliente).

grant select, insert, update, delete on table public.intelligence_match_outputs to service_role;
