-- Pre-Production P0.1 — Revisión central posterior (24/09/2026): Perfil público server-backed
-- seguía ocultando Efectividad/rendimiento de forma incondicional porque no existía ningún dato
-- oficial agregado y seguro para calcularlos sin exponer historial detallado de otro jugador.
--
-- Traza de qué existía antes de esta migración (por qué hacía falta un cambio real, no solo de
-- frontend):
--   - `matches`/`match_participants`/`match_sets` (Bloque 5) tienen el resultado estructurado de
--     cada set, pero NUNCA un "winner_team" persistido — deriveWinnerTeam (match-sync.js) lo
--     calcula SIEMPRE client-side, a propósito, "para no tener una TERCERA copia de la regla de
--     victoria" (ver el comentario de cabecera de match-sync.js). Reimplementar esa regla en SQL
--     acá sería justamente esa tercera/cuarta copia — se descarta.
--   - `match_level_results`/`match_level_result_players` (Bloque 6) SÍ tienen margin/team_
--     strength por partido, pero son estrictamente de Nivel (RLS deny-all, service_role,
--     "no se reimplementa el motor acá"), excluyen partidos `eligible=false` (partido oficial sin
--     efecto de Nivel) y no tienen un booleano ganó/perdió directo — no son una fuente segura ni
--     completa para "partidos jugados/ganados" de rendimiento público.
--   - `officialize_match_validation` (núcleo único de oficialización, Bloque 6) SÍ recibe
--     `localMatch.winnerTeam` ya calculado por el MISMO motor compartido (match-sync.js vía
--     symlink real en la Edge Function, ver supabase/functions/_shared/match-officialize-core.ts)
--     en cada trigger (initial/correction_accepted/identity_resolved/identity_unidentified), pero
--     nunca lo persistía — se recalculaba y se descartaba.
--
-- Solución elegida (mínima, sin duplicar la regla de victoria, sin tocar Nivel/Ranking/
-- Intelligence): persistir ese mismo valor YA CALCULADO en una columna nueva de `matches`,
-- escrita por el ÚNICO lugar que ya lo calcula. Un agregado nuevo y seguro en `get_public_profile`
-- (conteo, nunca partidos individuales) lo consume para Efectividad/jugados/ganados público.
--
-- Alcance explícito de esta migración:
--   1) `matches.winner_team` — columna nueva, nullable, 'A'|'B'. NULL mientras el partido no está
--      validated. Se escribe/actualiza DENTRO de `officialize_match_validation`, en el mismo
--      punto para los 4 triggers (initial Y correction_accepted, que puede cambiar el resultado;
--      identity_resolved/identity_unidentified no cambian el score pero reciben el mismo valor
--      sin costo, siempre consistente con la revisión vigente).
--   2) `officialize_match_validation` — CREATE OR REPLACE con un parámetro nuevo al final,
--      `p_winner_team text default null` (compatible: cualquier caller que no lo pase sigue
--      funcionando exactamente igual, sin tocar `matches.winner_team`). Como Postgres identifica
--      una función por su lista de TIPOS de parámetros, agregar uno nuevo crea un OVERLOAD
--      adicional en vez de reemplazar el existente — se hace `drop function` de la firma vieja
--      primero para no dejar dos versiones coexistiendo con permisos propios.
--   3) `get_public_profile` — CREATE OR REPLACE (mismo motivo de DROP primero: cambia el tipo de
--      retorno) agregando `matches_played integer, matches_won integer`: conteo de partidos
--      `status='validated'` con `winner_team` ya resuelto en los que participó el jugador
--      consultado, y cuántos de ellos ganó su equipo. Nunca devuelve match_id, fecha, rival ni
--      ningún dato por partido — solo los dos conteos agregados.
--
-- Deliberadamente NO incluido (para mantener esta corrección acotada):
--   - Backfill de `winner_team` para partidos YA validated antes de esta migración: reconstruirlo
--     retroactivamente exigiría leer `match_sets` y aplicar el umbral de sets según formatId
--     (classic=2 de 3, americano=1 de 1) — exactamente la regla que se decidió no duplicar en SQL,
--     y esta vez además como operación de datos, no de lógica en vivo. Esos partidos simplemente
--     no cuentan todavía en Efectividad/jugados-ganados público hasta que se corrijan/reapliquen
--     (lo que sí pasa por este camino nuevo) o hasta que se decida explícitamente un backfill
--     aparte. Pre-Production: sin usuarios reales todavía (README.md §1.1), impacto práctico nulo.
--   - "Mejor racha"/"Mejor nivel BRAMU" en Perfil público server-backed: quedan fuera de esta
--     ronda (ver informe). "Mejor racha" pediría un agregado de rachas más complejo sobre esta
--     misma fuente; "Mejor nivel BRAMU" (pico histórico) viviría en datos de Nivel
--     (level_events.result->>'muAfter'), que se prefiere no tocar en esta corrección acotada.
--   - `ranking_opt_in`/Ranking automático: sin cambios, ya validado en Staging (ver informe §11).

-- ------------------------------------------------------------------
-- 1) matches.winner_team
-- ------------------------------------------------------------------

alter table public.matches
  add column if not exists winner_team text check (winner_team is null or winner_team in ('A', 'B'));

comment on column public.matches.winner_team is
  'Equipo ganador ("A"|"B"), NULL mientras el partido no está validated. Escrito EXCLUSIVAMENTE
   por officialize_match_validation, con el MISMO valor que match-sync.js#deriveWinnerTeam ya
   calculó para ese partido/revisión (nunca una segunda derivación en SQL). Se re-escribe en cada
   trigger de oficialización/corrección para no quedar desactualizado si una corrección cambia el
   resultado. Fuente única de "quién ganó" para agregados públicos (get_public_profile) — nunca
   se expone junto a datos de otro partido, solo se cuenta.';

-- ------------------------------------------------------------------
-- 2) officialize_match_validation — agrega p_winner_team (default null, compatible)
--
-- Cuerpo idéntico a 20260921235700_bloque6_fix_applied_result_detection.sql salvo DOS cambios
-- reales, marcados explícitamente más abajo con "Pre-Production P0.1": el parámetro nuevo al
-- final de la lista, y el UPDATE que lo persiste (después del bookkeeping de trigger, antes de
-- match_actions/notifications). Todo lo demás — validaciones, idempotencia, reversión/reaplicación
-- de Nivel, bookkeeping de corrección/identidad — se preserva sin tocar una sola línea.
-- ------------------------------------------------------------------

drop function if exists public.officialize_match_validation(
  uuid, uuid, text, uuid, text, boolean, jsonb, text, integer,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid
);

create or replace function public.officialize_match_validation(
  p_match_id uuid,
  -- La revisión que ESTE cálculo asume vigente — B6-A-07: bajo lock, debe coincidir con
  -- matches.current_revision_id (initial/identity_*) o matches.pending_correction_revision_id
  -- (correction_accepted). Mismatch => stale_match_revision, cero escritura.
  p_revision_id uuid,
  p_trigger text,
  p_actor_player_id uuid,
  p_actor_note text,
  p_eligible boolean,
  p_reason_codes jsonb,
  p_algorithm_version text,
  p_known_levels_count integer,
  p_team_strength_a numeric,
  p_team_strength_b numeric,
  p_expectation_a numeric,
  p_expectation_b numeric,
  p_rival_pair_confidence_avg_a numeric,
  p_rival_pair_confidence_avg_b numeric,
  p_margin numeric,
  p_format_factor numeric,
  p_availability_factor numeric,
  p_repetition_factor_a numeric,
  p_repetition_factor_b numeric,
  p_companion_factor_a numeric,
  p_companion_factor_b numeric,
  -- [{playerId,team,formulaMuBefore,formulaConfidenceBefore,formulaState,effectiveLevel,k,
  --   opponentFactor,circleFactor,deltaRaw,deltaCapped,evidenceQuality,
  --   muBefore,muAfter,confidenceBefore,confidenceAfter,evidenceUnitsBefore,evidenceUnitsAfter}]
  -- — salida de PLMatchLevelEngine.computeLevelStateUpdates().resultPlayers. Vacío si !p_eligible.
  p_result_players jsonb,
  -- [{playerId,finalMu,finalConfidence,finalEvidenceUnits,currentMuForLock,
  --   currentConfidenceForLock,currentEvidenceUnitsForLock}] — .levelStateUpdates. Incluye TODO
  -- jugador afectado (viejo ∪ nuevo), incluso uno que ya no participa del resultado nuevo
  -- (reversión pura, ver computeLevelStateUpdates).
  p_level_state_updates jsonb,
  -- Bookkeeping atómico específico de trigger (B6-A-08/B6-A-09) — NULL salvo que corresponda.
  -- team/position_in_team del slot NO se reciben como parámetro: se leen de la propia fila de
  -- match_identity_issues (ya bajo lock acá abajo) para que nunca puedan desalinearse de la
  -- incidencia real que se está resolviendo.
  p_identity_issue_id uuid default null,
  p_identity_replacement_player_id uuid default null,
  -- Pre-Production P0.1 (revisión central 24/09/2026) — MISMO winnerTeam que la Edge Function ya
  -- calculó vía match-sync.js#deriveWinnerTeam para localMatch (nunca recalculado acá). Default
  -- null: un caller que todavía no lo pase deja matches.winner_team intacto, nunca lo pisa con
  -- NULL — ver el guard `if p_winner_team is not null` más abajo.
  p_winner_team text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_existing_applied public.match_level_results;
  v_existing_player_ids uuid[];
  v_new_result_player_ids uuid[];
  v_identity_issue public.match_identity_issues;
  v_result_id uuid;
  v_update jsonb;
  v_player_id uuid;
  v_has_new_row boolean;
  v_current_level_state public.level_states;
  v_new_rated_matches integer;
  v_new_distinct_opponents integer;
  v_new_status text;
  v_new_last_rated_at timestamptz;
  v_event_type text;
  v_action_type text;
  v_notification_type text;
  v_result jsonb;
begin
  if p_trigger not in ('initial', 'correction_accepted', 'identity_resolved', 'identity_unidentified') then
    raise exception 'invalid_trigger' using errcode = 'P0001';
  end if;
  if p_trigger in ('identity_resolved', 'identity_unidentified') and p_identity_issue_id is null then
    raise exception 'identity_issue_id_required' using errcode = 'P0001';
  end if;
  if p_trigger = 'identity_resolved' and p_identity_replacement_player_id is null then
    raise exception 'identity_replacement_player_id_required' using errcode = 'P0001';
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;

  -- ------------------------------------------------------------------
  -- C-02 — defensa en profundidad para la PRIMERA oficialización.
  -- Solo un partido pending_validation puede crear un resultado initial nuevo. Un partido ya
  -- validated es un estado terminal para este trigger: el reintento de Confirmar se resuelve en
  -- la Edge Function como NO-OP y, aun si algún caller service-role invoca este núcleo directo,
  -- acá nunca se permite que un trigger='initial' pise un resultado posterior de corrección o
  -- identidad. Tampoco estados annulled/expired/etc. pueden oficializarse por accidente.
  -- ------------------------------------------------------------------
  if p_trigger = 'initial' then
    if v_match.status = 'validated' then
      return jsonb_build_object('ok', false, 'code', 'already_validated');
    end if;
    if v_match.status <> 'pending_validation' then
      return jsonb_build_object('ok', false, 'code', 'match_not_actionable');
    end if;
    if v_match.action_side is not null then
      return jsonb_build_object('ok', false, 'code', 'not_ready_for_validation');
    end if;
    if v_match.validation_deadline_at is null or now() > v_match.validation_deadline_at then
      return jsonb_build_object('ok', false, 'code', 'match_expired');
    end if;
    if exists (select 1 from public.match_identity_issues where match_id = p_match_id and status = 'open') then
      return jsonb_build_object('ok', false, 'code', 'identity_issue_open');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- B6-A-07 — verificación de REVISIÓN esperada, distinta y adicional a la de snapshots de
  -- Nivel: protege contra oficializar/reaplicar sobre una revisión que ya dejó de ser la
  -- correcta para este trigger (p. ej. una nueva corrección pre-validación se coló entre que la
  -- Edge Function leyó el snapshot y llamó acá).
  -- ------------------------------------------------------------------
  if p_trigger = 'correction_accepted' then
    if v_match.pending_correction_revision_id is null or v_match.pending_correction_revision_id <> p_revision_id then
      return jsonb_build_object('ok', false, 'code', 'stale_match_revision');
    end if;
  else
    if v_match.current_revision_id is null or v_match.current_revision_id <> p_revision_id then
      return jsonb_build_object('ok', false, 'code', 'stale_match_revision');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- B6-A-09 — para triggers de identidad, la incidencia debe seguir open bajo lock: protege
  -- contra una resolución concurrente duplicada o una ya vencida/materializada por otro camino.
  -- ------------------------------------------------------------------
  if p_trigger in ('identity_resolved', 'identity_unidentified') then
    select * into v_identity_issue from public.match_identity_issues where issue_id = p_identity_issue_id for update;
    if v_identity_issue is null or v_identity_issue.status <> 'open' then
      return jsonb_build_object('ok', false, 'code', 'identity_issue_not_open');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- Idempotencia por estado (mismo criterio que officialize_level_onboarding, Bloque 3): si YA
  -- existe un resultado applied para exactamente esta revisión/trigger/composición de
  -- jugadores conocidos, se devuelve tal cual — nunca se recalcula ni se duplica.
  -- ------------------------------------------------------------------
  select * into v_existing_applied
  from public.match_level_results
  where match_id = p_match_id and effect_status = 'applied'
  for update;

  if v_existing_applied.result_id is not null and v_existing_applied.revision_id = p_revision_id and v_existing_applied.trigger = p_trigger then
    select array_agg(player_id order by player_id) into v_existing_player_ids
    from public.match_level_result_players where result_id = v_existing_applied.result_id;

    select array_agg((elem->>'playerId')::uuid order by (elem->>'playerId')::uuid)
      into v_new_result_player_ids
      from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) elem;

    if coalesce(v_existing_player_ids, array[]::uuid[]) = coalesce(v_new_result_player_ids, array[]::uuid[]) then
      return jsonb_build_object(
        'ok', true, 'resultId', v_existing_applied.result_id, 'eligible', v_existing_applied.eligible,
        'idempotentReturn', true
      );
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- Verificación optimista: el mu/confidence/evidence_units ACTUAL de level_states (bajo lock,
  -- en orden determinístico por player_id para no producir deadlocks entre dos oficializaciones
  -- concurrentes que comparten jugadores) debe coincidir con el que el motor usó como base del
  -- neto. Si no coincide, otra oficialización concurrente ya movió ese jugador primero: se
  -- rechaza sin escribir nada — el llamador relee y recalcula sobre el estado fresco.
  -- ------------------------------------------------------------------
  for v_player_id in
    select (elem->>'playerId')::uuid
    from jsonb_array_elements(coalesce(p_level_state_updates, '[]'::jsonb)) elem
    order by (elem->>'playerId')::uuid
  loop
    select * into v_current_level_state from public.level_states where player_id = v_player_id for update;
    v_update := (
      select elem from jsonb_array_elements(p_level_state_updates) elem where (elem->>'playerId')::uuid = v_player_id limit 1
    );
    if v_current_level_state is null
       or v_current_level_state.mu is distinct from (v_update->>'currentMuForLock')::numeric
       or v_current_level_state.confidence is distinct from (v_update->>'currentConfidenceForLock')::numeric
       or coalesce(v_current_level_state.evidence_units, 0) is distinct from coalesce((v_update->>'currentEvidenceUnitsForLock')::numeric, 0)
    then
      return jsonb_build_object('ok', false, 'code', 'stale_level_snapshot', 'playerId', v_player_id);
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- Revertir el resultado anterior vigente (si existe) — nunca se borra, se marca reverted.
  --
  -- B6-B-02: acá NO se escribe un level_events por jugador. Todo jugador del resultado anterior
  -- (viejo ∪ nuevo, ver PLMatchLevelEngine.computeLevelStateUpdates) recibe MÁS ABAJO, en la
  -- MISMA transacción, un evento único con el snapshot post-operación COMPLETO — un segundo
  -- evento acá, con el mismo `created_at` de transacción (now() es fijo por transacción en
  -- Postgres) y solo `{revertedResultId}`, competía por el desempate de
  -- get_player_level_state_as_of y podía devolver un estado roto. El resultado revertido sigue
  -- siendo auditable por match_level_results.reverses_result_id/superseded_by_result_id.
  -- ------------------------------------------------------------------
  if v_existing_applied.result_id is not null then
    update public.match_level_results
      set effect_status = 'reverted', reverted_at = now()
      where result_id = v_existing_applied.result_id;
  end if;

  -- ------------------------------------------------------------------
  -- Nuevo match_level_results (cabecera) — siempre se inserta, eligible o no, para auditoría.
  -- ------------------------------------------------------------------
  insert into public.match_level_results (
    match_id, revision_id, trigger, algorithm_version, eligible, reason_codes,
    known_levels_count, team_strength_a, team_strength_b, expectation_a, expectation_b,
    rival_pair_confidence_avg_a, rival_pair_confidence_avg_b, margin, format_factor,
    availability_factor, repetition_factor_a, repetition_factor_b, companion_factor_a, companion_factor_b,
    reverses_result_id, actor_player_id, actor_note
  ) values (
    p_match_id, p_revision_id, p_trigger, p_algorithm_version, coalesce(p_eligible, false), coalesce(p_reason_codes, '[]'::jsonb),
    p_known_levels_count, p_team_strength_a, p_team_strength_b, p_expectation_a, p_expectation_b,
    p_rival_pair_confidence_avg_a, p_rival_pair_confidence_avg_b, p_margin, p_format_factor,
    p_availability_factor, p_repetition_factor_a, p_repetition_factor_b, p_companion_factor_a, p_companion_factor_b,
    case when v_existing_applied.result_id is not null then v_existing_applied.result_id else null end,
    p_actor_player_id, p_actor_note
  ) returning result_id into v_result_id;

  if v_existing_applied.result_id is not null then
    update public.match_level_results set superseded_by_result_id = v_result_id where result_id = v_existing_applied.result_id;
  end if;

  if coalesce(p_eligible, false) then
    -- C-01: original_live_*_before es el baseline LIVE INMUTABLE de este partido/jugador
    -- (se propaga sin cambios entre correcciones); mu_after/confidence_after son el valor
    -- ABSOLUTO de fórmula de ESTA aplicación puntual (nunca el LIVE contaminado por partidos
    -- posteriores) — ver PLMatchLevelEngine.computeLevelStateUpdates.
    insert into public.match_level_result_players (
      result_id, player_id, team,
      formula_mu_before, formula_confidence_before, formula_state,
      effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
      original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before,
      mu_after, confidence_after
    )
    select
      v_result_id, (rp->>'playerId')::uuid, rp->>'team',
      (rp->>'formulaMuBefore')::numeric, (rp->>'formulaConfidenceBefore')::numeric, rp->>'formulaState',
      (rp->>'effectiveLevel')::numeric, (rp->>'k')::numeric, (rp->>'opponentFactor')::numeric, (rp->>'circleFactor')::numeric,
      (rp->>'deltaRaw')::numeric, (rp->>'deltaCapped')::numeric, (rp->>'evidenceQuality')::numeric,
      (rp->>'originalLiveMuBefore')::numeric, (rp->>'originalLiveConfidenceBefore')::numeric, (rp->>'originalLiveEvidenceUnitsBefore')::numeric,
      (rp->>'muAfter')::numeric, (rp->>'confidenceAfter')::numeric
    from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) rp;
  end if;

  -- ------------------------------------------------------------------
  -- B6-B-06 — para identity_resolved, el reemplazo de participante debe quedar escrito ANTES de
  -- recalcular rated_matches/distinct_opponents (loop de abajo): si no, el conteo de los propios
  -- RIVALES del jugador reemplazado podía leer ese slot todavía NULL/con el jugador viejo. Ocurre
  -- en la MISMA transacción que todo lo demás — si algo falla después, Postgres revierte todo.
  -- B6-B-04: el fingerprint se actualiza inmediatamente después, atómicamente.
  -- ------------------------------------------------------------------
  if p_trigger = 'identity_resolved' then
    update public.match_participants set
      player_id = p_identity_replacement_player_id,
      display_name_snapshot = coalesce((select display_name from public.players where player_id = p_identity_replacement_player_id), 'Jugador')
    where match_id = p_match_id and team = v_identity_issue.team and position_in_team = v_identity_issue.position_in_team;

    perform public._bloque6_refresh_participant_fingerprint(p_match_id);
  end if;

  -- ------------------------------------------------------------------
  -- Escribir los valores YA CALCULADOS en level_states. B6-A-11: distinct_opponents cuenta
  -- CUALQUIER player_id rival de match_participants (registrado o provisional, nunca un slot
  -- NULL) de partidos con resultado applied+eligible — no exige que el rival tenga su propia
  -- fila en match_level_result_players. B6-A-12: status se deriva de la evidencia oficial
  -- VIGENTE, nunca monotónico (una corrección/incidencia que retira evidencia puede devolver
  -- CALIBRADO -> CALIBRANDO; RECALIBRANDO conserva su semántica propia, fuera de Bloque 6).
  -- B6-A-13: last_rated_at es actividad deportiva computable (played_at del partido), nunca
  -- hora de escritura — y para un jugador cuya contribución a ESTE partido se retira sin
  -- reemplazo (reversión pura dentro de esta misma operación), se recompone como el máximo
  -- played_at de sus resultados applied+eligible restantes.
  -- ------------------------------------------------------------------
  v_event_type := case p_trigger
    when 'initial' then 'match_delta'
    when 'correction_accepted' then 'match_correction_reapply'
    else 'identity_reassignment_delta'
  end;

  for v_update in select * from jsonb_array_elements(coalesce(p_level_state_updates, '[]'::jsonb))
  loop
    v_player_id := (v_update->>'playerId')::uuid;
    select * into v_current_level_state from public.level_states where player_id = v_player_id;

    v_has_new_row := exists (
      select 1 from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) rp
      where (rp->>'playerId')::uuid = v_player_id
    );

    select count(distinct mlr.match_id) into v_new_rated_matches
    from public.match_level_result_players mlrp
    join public.match_level_results mlr on mlr.result_id = mlrp.result_id
    where mlrp.player_id = v_player_id and mlr.effect_status = 'applied' and mlr.eligible;

    select count(distinct opp.player_id) into v_new_distinct_opponents
    from public.match_participants self_p
    join public.match_participants opp
      on opp.match_id = self_p.match_id and opp.team <> self_p.team and opp.player_id is not null
    join public.match_level_results mlr
      on mlr.match_id = self_p.match_id and mlr.effect_status = 'applied' and mlr.eligible
    where self_p.player_id = v_player_id;

    v_new_status := case
      when v_current_level_state.status = 'RECALIBRANDO' then 'RECALIBRANDO'
      when coalesce(v_new_rated_matches, 0) >= 5 and coalesce(v_new_distinct_opponents, 0) >= 3 then 'CALIBRADO'
      else 'CALIBRANDO'
    end;

    if v_has_new_row then
      v_new_last_rated_at := greatest(coalesce(v_current_level_state.last_rated_at, v_match.played_at), v_match.played_at);
    else
      -- Reversión pura sin reemplazo en esta misma operación (p. ej. identidad retirada):
      -- last_rated_at nunca puede caer por debajo del ancla inicial del cuestionario (C-09).
      -- Se recompone con la actividad computable restante y, como piso temporal real, el
      -- initial_estimate que creó el primer Nivel del jugador.
      select greatest(
        (
          select max(m.played_at)
          from public.match_level_result_players mlrp
          join public.match_level_results mlr on mlr.result_id = mlrp.result_id and mlr.effect_status = 'applied' and mlr.eligible
          join public.matches m on m.match_id = mlr.match_id
          where mlrp.player_id = v_player_id
        ),
        (
          select max(le.created_at)
          from public.level_events le
          where le.player_id = v_player_id and le.event_type = 'initial_estimate'
        )
      ) into v_new_last_rated_at;
    end if;

    update public.level_states set
      mu = (v_update->>'finalMu')::numeric,
      confidence = (v_update->>'finalConfidence')::numeric,
      evidence_units = (v_update->>'finalEvidenceUnits')::numeric,
      rated_matches = coalesce(v_new_rated_matches, 0),
      distinct_opponents = coalesce(v_new_distinct_opponents, 0),
      status = v_new_status,
      algorithm_version = p_algorithm_version,
      last_rated_at = v_new_last_rated_at,
      updated_at = now()
    where player_id = v_player_id;

    insert into public.level_events (player_id, event_type, algorithm_version, match_id, match_level_result_id, result)
    values (
      v_player_id, v_event_type, p_algorithm_version, p_match_id, v_result_id,
      jsonb_build_object(
        'muAfter', (v_update->>'finalMu')::numeric,
        'confidenceAfter', (v_update->>'finalConfidence')::numeric,
        'evidenceUnitsAfter', (v_update->>'finalEvidenceUnits')::numeric,
        'statusAfter', v_new_status,
        -- B6-B-02: imprescindible para que get_player_level_state_as_of pueda devolver lastRatedAt.
        'lastRatedAtAfter', v_new_last_rated_at
      )
    );
  end loop;

  -- ------------------------------------------------------------------
  -- B6-A-08/B6-A-09 — bookkeeping atómico específico de trigger, en la MISMA transacción que
  -- ya aplicó/revirtió Nivel: nunca queda un estado a medias entre "el resultado/participante ya
  -- cambió" y "Nivel todavía no". La reasignación de match_participants de identity_resolved ya
  -- ocurrió ARRIBA (B6-B-06, antes de recalcular distinct_opponents) — acá solo cierra la
  -- incidencia, enlazando el resultado recién calculado.
  -- ------------------------------------------------------------------
  if p_trigger = 'correction_accepted' then
    update public.matches set
      current_revision_id = p_revision_id,
      pending_correction_revision_id = null,
      updated_at = now()
    where match_id = p_match_id;
  elsif p_trigger = 'identity_resolved' then
    update public.match_identity_issues set
      status = 'resolved', resolved_player_id = p_identity_replacement_player_id, resolved_at = now(),
      reapplied_result_id = v_result_id, updated_at = now()
    where issue_id = p_identity_issue_id;
  elsif p_trigger = 'identity_unidentified' then
    update public.match_identity_issues set
      status = 'unidentified', resolved_at = now(), reapplied_result_id = v_result_id, updated_at = now()
    where issue_id = p_identity_issue_id;
  end if;

  -- ------------------------------------------------------------------
  -- Pre-Production P0.1 (revisión central 24/09/2026) — único agregado real de esta migración:
  -- persiste el winnerTeam que la Edge Function ya calculó (nunca lo recalcula), para los 4
  -- triggers por igual. `is not null` protege contra un caller viejo que todavía no lo pase: deja
  -- matches.winner_team exactamente como estaba, nunca lo pisa con NULL por omisión.
  -- ------------------------------------------------------------------
  if p_winner_team is not null then
    update public.matches set winner_team = p_winner_team, updated_at = now() where match_id = p_match_id;
  end if;

  -- ------------------------------------------------------------------
  -- match_actions / notifications / pilot_events
  -- ------------------------------------------------------------------
  v_action_type := case p_trigger
    when 'initial' then 'validated'
    when 'correction_accepted' then 'correction_accepted'
    when 'identity_resolved' then 'participant_replaced'
    else 'participant_unidentified'
  end;
  v_notification_type := case p_trigger
    when 'initial' then 'match_validated'
    when 'correction_accepted' then 'correction_accepted'
    when 'identity_resolved' then 'identity_resolved'
    else 'identity_unidentified'
  end;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
  values (p_match_id, v_action_type, coalesce(p_actor_player_id, v_match.created_by_player_id), null, p_revision_id, coalesce(p_reason_codes, '[]'::jsonb));

  insert into public.notifications (player_id, type, match_id, payload)
  select mp.player_id, v_notification_type, p_match_id, '{}'::jsonb
  from public.match_participants mp
  where mp.match_id = p_match_id and mp.player_id is not null;

  if p_trigger = 'initial' then
    update public.matches set
      status = 'validated',
      validated_at = coalesce(validated_at, now()),
      action_side = null,
      updated_at = now()
    where match_id = p_match_id;

    insert into public.pilot_events (event_name, player_id, properties)
    values ('match_validated', v_match.created_by_player_id, jsonb_build_object('matchId', p_match_id));
  end if;

  select jsonb_build_object('ok', true, 'resultId', v_result_id, 'eligible', coalesce(p_eligible, false)) into v_result;
  return v_result;
end;
$$;

comment on function public.officialize_match_validation is
  'Núcleo único de oficialización/corrección/identidad de Bloque 6. No recalcula nada — toda la
   matemática (motor JS compartido, incluida la diferencia neta y el winnerTeam) ya la hizo la
   Edge Function con bramulab/match-level-engine.js/match-sync.js. SOLO service_role. Idempotente
   por (match_id, revision_id, trigger, composición de jugadores). Verifica revisión esperada
   (B6-A-07) y hace atómico el bookkeeping de corrección/identidad con la aplicación de Nivel
   (B6-A-08/B6-A-09). Para identity_resolved, reasigna el participante + refresca el fingerprint
   ANTES de recalcular distinct_opponents (B6-B-06/B6-B-04). Pre-Production P0.1 (24/09/2026)
   agrega `p_winner_team` (default null, compatible): persiste en matches.winner_team el mismo
   valor ya calculado por match-sync.js#deriveWinnerTeam, para los 4 triggers por igual — nunca
   una segunda regla de victoria. Ver 02_Analisis_Claude.md §3.1-§3.3, 06_Revision_Fase_A_
   ChatGPT.md, 08_Revision_Central_Adicional.md y el informe de Pre-Production P0.1/P0.1B
   (08_Resultado_P0_1_Ranking_Automatico_Claude.md).';

revoke all on function public.officialize_match_validation(
  uuid, uuid, text, uuid, text, boolean, jsonb, text, integer,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text
) from public;
grant execute on function public.officialize_match_validation(
  uuid, uuid, text, uuid, text, boolean, jsonb, text, integer,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text
) to service_role;

-- ------------------------------------------------------------------
-- 3) get_public_profile — agrega matches_played/matches_won (agregado, nunca partidos crudos)
-- ------------------------------------------------------------------

drop function if exists public.get_public_profile(uuid);

create or replace function public.get_public_profile(p_player_id uuid)
returns table (
  player_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  competitive_branch text,
  dominant_hand text,
  preferred_side text,
  locality_label text,
  province_label text,
  level_status text,
  level_public numeric,
  rated_matches integer,
  distinct_opponents integer,
  -- Pre-Production P0.1 (revisión central 24/09/2026) — agregados públicos de rendimiento:
  -- conteo de partidos oficiales (status='validated', winner_team ya resuelto) y cuántos ganó el
  -- equipo del jugador consultado. Nunca match_id, fecha, rival ni ningún otro dato por partido —
  -- ver el LEFT JOIN LATERAL más abajo, que solo puede devolver dos enteros.
  matches_played integer,
  matches_won integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'get_public_profile', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select
      pl.player_id, pr.username, pr.display_name, pr.first_name, pr.last_name,
      pr.competitive_branch, pr.dominant_hand, pr.preferred_side,
      loc.locality_label, loc.province_label,
      ls.status, round(ls.mu, 1), coalesce(ls.rated_matches, 0), coalesce(ls.distinct_opponents, 0),
      coalesce(pubstats.matches_played, 0), coalesce(pubstats.matches_won, 0)
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.locations loc on loc.location_id = pr.location_id
    left join public.level_states ls on ls.player_id = pl.player_id
    left join lateral (
      -- Solo dos conteos, nunca filas de match_participants/matches individuales. `status=
      -- 'validated'` excluye pending_validation/expired/annulled (pendientes NO cuentan, sin
      -- distinguirlos por reason). `winner_team is not null` excluye partidos validated ANTES de
      -- esta migración (todavía sin backfill, ver comentario de cabecera) — se cuentan solos, no
      -- hay reason_codes que exponer acá porque no es un cálculo de elegibilidad, es un conteo.
      select
        count(*) as matches_played,
        count(*) filter (where m.winner_team = mp.team) as matches_won
      from public.match_participants mp
      join public.matches m on m.match_id = mp.match_id
      where mp.player_id = pl.player_id
        and m.status = 'validated'
        and m.winner_team is not null
    ) pubstats on true
    where pl.type = 'registered'
      and pl.is_active
      and pl.player_id = p_player_id
      and pr.username is not null;
end;
$$;

comment on function public.get_public_profile is
  'Perfil público de un player_id puntual, mismas columnas/exclusiones que search_players más
   matches_played/matches_won (Pre-Production P0.1, 24/09/2026): agregado seguro de rendimiento
   oficial, nunca historial de partidos individual. 0 filas para provisional/inexistente/perfil
   sin username todavía — nunca confirma ni niega la existencia de una provisional por esta vía.';

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;
