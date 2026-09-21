-- BRAMUlab — Bloque 6: evidencia acumulada persistida en level_states.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §4 Riesgo 6,
-- 03_Plan_Implementacion_Claude.md §1.2} para el razonamiento completo. Resumen:
--
-- Nivel_BRAMU_Formula_V1.5.md §2/§19 exige conservar `evidence_units` (evidencia acumulada
-- ponderada) como parte del estado de cada jugador. Bloque 3 no la persistió porque solo
-- necesitaba el resultado del cuestionario inicial (evidence_units=0 en ese momento, para
-- TODOS los jugadores). Bloque 6 la necesita para que revertir/reaplicar `confidence` tras una
-- corrección sea una diferencia neta EXACTA, igual que `mu`, en vez de una aproximación:
--
--   confidence = confidence_origin + (0.95 - confidence_origin) × (1 - exp(-evidence_units/5.5))
--
-- (Formula V1.5 §10.2 — la forma "de a poco"/incremental y la forma "desde evidencia total" son
-- equivalentes; se elige la segunda porque hace que revertir sea aritmética pura sobre
-- evidence_units, sin necesidad de reconstruir una cadena de confidence intermedios.)
--
-- Backfill seguro: al cierre de Bloque 3, ningún jugador tenía todavía ningún partido
-- computado, así que evidence_units era 0 para todos y por lo tanto confidence == confidence_origin
-- (b) en ese momento — completar confidence_origin desde confidence actual no pierde información
-- ni inventa un valor.
--
-- C-09 (10_Revision_Final_Pre_Staging_ChatGPT.md): además, esta migración inicia el reloj de
-- inactividad (§10.3) desde el cuestionario — backfill de last_rated_at para estados ya
-- inicializados (desde su propio evento initial_estimate) + officialize_level_onboarding
-- extendida para fijarlo en nuevos Nivel iniciales.

alter table public.level_states
  add column if not exists evidence_units numeric not null default 0,
  add column if not exists confidence_origin numeric;

comment on column public.level_states.evidence_units is
  'Evidencia acumulada ponderada (Nivel_BRAMU_Formula_V1.5.md §10.1). Se acumula de forma
   ADITIVA con cada partido validado (calidad_evidencia del partido). Permite revertir/reaplicar
   confidence con diferencia neta exacta — nunca se recalcula en cascada todo el historial.';
comment on column public.level_states.confidence_origin is
  'La "b" de origen (0.10 camino rápido; 0.12/0.15/0.18 camino completo según §3.4) fijada una
   sola vez al oficializar el onboarding. Junto con evidence_units determina confidence de forma
   pura: confidence = confidence_origin + (0.95-confidence_origin)×(1-exp(-evidence_units/5.5)).';

update public.level_states
  set confidence_origin = confidence
  where confidence_origin is null and confidence is not null;

-- C-09 (10_Revision_Final_Pre_Staging_ChatGPT.md): Bloque 3 dejaba last_rated_at=NULL después del
-- cuestionario — B6-A-05 interpreta NULL como "sin decay posible todavía", así que un jugador
-- podía crear su Nivel inicial, no jugar durante meses, y su primer partido no aplicaba ninguna
-- reducción de confidence por inactividad (Nivel_BRAMU_Formula_V1.5.md §10.3). El cuestionario ES
-- el primer instante que establece un estado de Nivel: desde ahí arranca el reloj. Backfill para
-- estados ya inicializados (nunca se modifica la migración histórica de Bloque 3): toma el
-- created_at de su propio evento initial_estimate.
update public.level_states ls
  set last_rated_at = le.created_at
  from public.level_events le
  where le.player_id = ls.player_id
    and le.event_type = 'initial_estimate'
    and ls.last_rated_at is null
    and ls.status <> 'PENDIENTE';

-- ------------------------------------------------------------------
-- officialize_level_onboarding (Bloque 3) — agregado mínimo, misma firma, mismo comportamiento
-- observable: además de lo que ya persistía, fija confidence_origin/evidence_units en el mismo
-- UPDATE que ya existía. No cambia ninguna validación, ninguna rama de idempotencia, ningún
-- parámetro — ver 03_Plan_Implementacion_Claude.md §2 ("FUSIONAR", no reabrir Bloque 3).
-- ------------------------------------------------------------------

create or replace function public.officialize_level_onboarding(
  p_auth_user_id uuid,
  p_algorithm_version text,
  p_questionnaire_version text,
  p_questionnaire_mode text,
  p_mu numeric,
  p_confidence numeric,
  p_declared_category text,
  p_category_context_key text,
  p_input_context jsonb,
  p_result jsonb
)
returns public.level_states
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_existing public.level_states;
  v_updated public.level_states;
begin
  select player_id into v_player_id from public.players where auth_user_id = p_auth_user_id;
  if v_player_id is null then
    raise exception 'no_player_for_user' using errcode = 'P0001';
  end if;

  select * into v_existing from public.level_states where player_id = v_player_id for update;
  if v_existing is null then
    raise exception 'no_level_state_for_player' using errcode = 'P0001';
  end if;

  if v_existing.status <> 'PENDIENTE' then
    return v_existing;
  end if;

  update public.level_states set
    status = 'CALIBRANDO',
    mu = p_mu,
    confidence = p_confidence,
    -- Bloque 6: origen de confianza + evidencia inicial (siempre 0 en este punto: es la
    -- oficialización del cuestionario, todavía no hay ningún partido computado).
    confidence_origin = p_confidence,
    evidence_units = 0,
    -- C-09: el cuestionario ES el primer instante que establece un estado de Nivel — el reloj de
    -- inactividad (§10.3) arranca acá, nunca queda NULL hasta el primer partido computado.
    last_rated_at = now(),
    declared_category = p_declared_category,
    category_context_key = p_category_context_key,
    algorithm_version = p_algorithm_version,
    questionnaire_version = p_questionnaire_version,
    questionnaire_mode = p_questionnaire_mode,
    updated_at = now()
  where player_id = v_player_id and status = 'PENDIENTE'
  returning * into v_updated;

  if v_updated is null then
    select * into v_updated from public.level_states where player_id = v_player_id;
    return v_updated;
  end if;

  insert into public.level_events (
    player_id, event_type, algorithm_version, questionnaire_version, questionnaire_mode,
    input_context, result
  ) values (
    v_player_id, 'initial_estimate', p_algorithm_version, p_questionnaire_version, p_questionnaire_mode,
    coalesce(p_input_context, '{}'::jsonb), coalesce(p_result, '{}'::jsonb)
  )
  on conflict do nothing;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('level_confirmed', v_player_id, jsonb_build_object('mode', p_questionnaire_mode));

  return v_updated;
end;
$$;

comment on function public.officialize_level_onboarding is
  'Única vía de escritura de level_states/level_events para el onboarding. SOLO service_role.
   Bloque 6 (20260921200000): agrega confidence_origin/evidence_units=0 al mismo UPDATE, sin
   cambiar firma ni comportamiento observable de Bloque 3. Ver 03_Revision_ChatGPT.md (Bloque 3)
   §2/§9 para el resto del contrato, sin cambios.';
