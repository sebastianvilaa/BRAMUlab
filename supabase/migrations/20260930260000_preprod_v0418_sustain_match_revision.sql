-- BRAMUlab — V04.18 (Issue #12 / #14): "NO HAY ERROR" en la validación pre-oficial.
--
-- Problema: una pareja que recibía una corrección (R2) de la otra solo podía aceptarla; "Mantener
-- resultado cargado" no llamaba al backend y el partido quedaba trabado del mismo lado.
--
-- Solución (sin estado `rejected`, revisiones append-only): `sustain_match_revision` registra,
-- server-side y de forma auditable, que la pareja del caller SOSTIENE la última versión que ella misma
-- había propuesto (el resultado original R1). Crea una revisión NUEVA (R3) que copia los sets de R1
-- (source='sustained_revision'), la deja como revisión vigente, y pasa la acción a la pareja que había
-- propuesto R2. Esa pareja reutiliza las acciones vigentes: VALIDAR PARTIDO (confirm_match_validation,
-- oficializa R3 = R1) o REPORTAR UN ERROR (create_or_attach_match => nueva revisión). Nada se borra.
--
-- Garantías
--   * Autoridad por PAREJA: solo puede la pareja que tiene `action_side`; compañeros comparten una
--     única tarea (action_side es por pareja).
--   * `p_expected_revision_number`: si la revisión vigente ya no es la que el cliente vio ->
--     {ok:false, code:'stale_revision'} (el cliente refresca).
--   * Idempotencia: un doble tap / retry con la misma revisión esperada, cuando ya existe la
--     revisión sostenida que la reemplazó, devuelve {ok:true, changed:false} sin duplicar nada.
--   * El deadline original (`validation_deadline_at`) NO se toca.
--   * No valida nada ni toca Nivel/estadísticas/Ranking: sigue pending_validation hasta que alguien
--     confirme (confirm_match_validation) una revisión.
--   * Auditoría: match_actions 'revision_sustained' (acting_side = pareja que sostiene, revision_id =
--     la revisión nueva, metadata.supersededRevisionId / sustainedRevisionNumber).
--
-- NO aplicada desde el sandbox del agente (sin Supabase CLI ni credenciales) — la aplica y verifica
-- Central en Staging con supabase/tests/verify-preprod-v0418-sustain-revision.sql (BEGIN/ROLLBACK).

-- 1) Tipos nuevos
alter table public.match_revisions drop constraint if exists match_revisions_source_check;
alter table public.match_revisions add constraint match_revisions_source_check
  check (source in ('created', 'proposed_correction', 'sustained_revision'));

alter table public.match_actions drop constraint match_actions_action_type_check;
alter table public.match_actions add constraint match_actions_action_type_check check (action_type in (
  'created', 'declared_again_same_side', 'confirmed', 'revision_proposed',
  'validated', 'identity_questioned', 'participant_replaced',
  'correction_timeout_resolved', 'annulled',
  'correction_accepted', 'participant_unidentified',
  'revision_sustained'
));

-- 2) RPC
create or replace function public.sustain_match_revision(p_match_id uuid, p_expected_revision_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_team text;
  v_match public.matches;
  v_cur public.match_revisions;
  v_target public.match_revisions;
  v_new_number integer;
  v_new_revision_id uuid;
  v_other text;
  v_dup public.match_actions;
begin
  select pl.player_id into v_caller from public.players pl where pl.auth_user_id = auth.uid() and pl.is_active;
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_caller, 'match_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    return jsonb_build_object('ok', false, 'code', 'match_not_found');
  end if;

  select mp.team into v_team from public.match_participants mp where mp.match_id = p_match_id and mp.player_id = v_caller;
  if v_team is null then
    return jsonb_build_object('ok', false, 'code', 'not_a_participant');
  end if;
  v_other := case v_team when 'A' then 'B' else 'A' end;

  -- Retry idempotente: la revisión esperada ya fue reemplazada por una sostenida por esta pareja.
  select ma.* into v_dup
  from public.match_actions ma
  where ma.match_id = p_match_id and ma.action_type = 'revision_sustained' and ma.acting_side = v_team
    and ma.revision_id = v_match.current_revision_id
    and (ma.metadata->>'supersededRevisionNumber')::integer = p_expected_revision_number
  limit 1;
  if found then
    return jsonb_build_object('ok', true, 'changed', false, 'code', 'already_sustained',
                              'matchId', p_match_id, 'actionSide', v_match.action_side);
  end if;

  if v_match.status <> 'pending_validation' then
    return jsonb_build_object('ok', false, 'code', 'match_not_actionable', 'status', v_match.status);
  end if;
  if v_match.validation_deadline_at is null or now() > v_match.validation_deadline_at then
    return jsonb_build_object('ok', false, 'code', 'match_expired');
  end if;
  if exists (select 1 from public.match_identity_issues where match_id = p_match_id and status = 'open') then
    return jsonb_build_object('ok', false, 'code', 'identity_issue_open');
  end if;
  if v_match.action_side is distinct from v_team then
    return jsonb_build_object('ok', false, 'code', 'not_actionable_for_caller');
  end if;

  select * into v_cur from public.match_revisions where revision_id = v_match.current_revision_id;
  if v_cur.revision_number is distinct from p_expected_revision_number then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'currentRevisionNumber', v_cur.revision_number);
  end if;
  -- Solo se sostiene algo frente a una revisión PROPUESTA POR LA OTRA pareja y posterior a la original.
  -- (y solo si esa revisión fue realmente una CORRECCIÓN de resultado — `revision_proposed`: no un reemplazo
  -- de participante ni una revisión ya sostenida, para no generar un ida y vuelta de "no hay error").
  if v_cur.proposed_by_team = v_team or v_cur.revision_number < 2
     or not exists (select 1 from public.match_actions ma
                    where ma.match_id = p_match_id and ma.action_type = 'revision_proposed' and ma.revision_id = v_cur.revision_id) then
    return jsonb_build_object('ok', false, 'code', 'nothing_to_sustain');
  end if;

  -- Lo que esta pareja sostiene: la última revisión que ELLA propuso antes de la vigente.
  select * into v_target from public.match_revisions r
    where r.match_id = p_match_id and r.proposed_by_team = v_team and r.revision_number < v_cur.revision_number
    order by r.revision_number desc limit 1;
  if v_target is null then
    return jsonb_build_object('ok', false, 'code', 'nothing_to_sustain');
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_new_number from public.match_revisions where match_id = p_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at, input_submission_id)
    values (p_match_id, v_new_number, v_caller, v_team, 'sustained_revision', v_target.played_at, null)
    returning revision_id into v_new_revision_id;

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b, tiebreak_a, tiebreak_b)
    select ms.match_id, v_new_number, ms.set_number, ms.games_a, ms.games_b, ms.tiebreak_a, ms.tiebreak_b
    from public.match_sets ms
    where ms.match_id = p_match_id and ms.revision_number = v_target.revision_number;

  -- validation_deadline_at NO se toca (el deadline original no se reinicia).
  update public.matches
    set current_revision_id = v_new_revision_id, action_side = v_other, played_at = v_target.played_at, updated_at = now()
    where match_id = p_match_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
    values (p_match_id, 'revision_sustained', v_caller, v_team, v_new_revision_id,
            jsonb_build_object('sustainedRevisionNumber', v_target.revision_number,
                               'supersededRevisionNumber', v_cur.revision_number,
                               'supersededRevisionId', v_cur.revision_id));

  return jsonb_build_object('ok', true, 'changed', true, 'code', 'sustained', 'matchId', p_match_id,
                            'status', 'pending_validation', 'actionSide', v_other,
                            'currentRevisionNumber', v_new_number);
end;
$$;

comment on function public.sustain_match_revision is
  'V04.18 (Issue #12): NO HAY ERROR. La pareja con la acción sostiene la última revisión que ella
   misma propuso (crea una revisión nueva append-only con los mismos sets, source=sustained_revision),
   la acción pasa a la pareja que propuso la corrección; no valida, no toca el deadline ni Nivel.
   Idempotente; stale_revision si la revisión vigente cambió.';

revoke all on function public.sustain_match_revision(uuid, integer) from public;
revoke all on function public.sustain_match_revision(uuid, integer) from anon;
grant execute on function public.sustain_match_revision(uuid, integer) to authenticated;
