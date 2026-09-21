-- BRAMUlab — Bloque 6: comando administrativo mínimo.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.11,
-- 03_Plan_Implementacion_Claude.md §1.4, 04_Revision_ChatGPT.md §8}.
--
-- Sin panel. SOLO service_role (mismo criterio que officialize_level_onboarding), invocable
-- exclusivamente desde un script/agente autorizado con la service role key en un entorno
-- seguro — NUNCA pensado para que Sebastián maneje esa key o pegue secretos en el chat
-- (04_Revision_ChatGPT.md §8: "no planificar que Sebastián lo ejecute manualmente").
--
-- match_actions.actor_player_id es NOT NULL desde Bloque 5 (no se reabre esa columna acá): una
-- acción administrativa usa created_by_player_id del partido / opened_by_player_id de la
-- incidencia como valor de la columna, y dice quién actuó realmente en metadata.adminActorLabel
-- + metadata.reason (ambos obligatorios).

create or replace function public.admin_annul_match(p_match_id uuid, p_actor_label text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  if coalesce(trim(p_actor_label), '') = '' or coalesce(trim(p_reason), '') = '' then
    raise exception 'actor_label_and_reason_required' using errcode = 'P0001';
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    return jsonb_build_object('ok', false, 'code', 'match_not_found');
  end if;
  if v_match.status = 'annulled' then
    return jsonb_build_object('ok', true, 'code', 'already_annulled', 'idempotentReturn', true);
  end if;

  if v_match.status = 'validated' then
    perform public._bloque6_revert_applied_result(p_match_id);
  end if;

  update public.matches set
    status = 'annulled',
    annulled_at = now(),
    annulment_reason = jsonb_build_object('actorLabel', p_actor_label, 'reason', p_reason),
    updated_at = now()
  where match_id = p_match_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (p_match_id, 'annulled', v_match.created_by_player_id, null, jsonb_build_object('adminActorLabel', p_actor_label, 'reason', p_reason));

  insert into public.notifications (player_id, type, match_id, payload)
  select mp.player_id, 'admin_action', p_match_id, jsonb_build_object('action', 'annulled', 'reason', p_reason)
  from public.match_participants mp where mp.match_id = p_match_id and mp.player_id is not null;

  return jsonb_build_object('ok', true, 'code', 'annulled', 'matchId', p_match_id);
end;
$$;

comment on function public.admin_annul_match is
  'Anulación administrativa excepcional. Revierte el efecto de Nivel si el partido estaba
   validated (reversión pura, sin motor JS), nunca reaplica nada. Actor + motivo obligatorios,
   quedan en match_actions.metadata. SOLO service_role.';

revoke all on function public.admin_annul_match(uuid, text, text) from public;
grant execute on function public.admin_annul_match(uuid, text, text) to service_role;

-- ------------------------------------------------------------------
-- admin_force_resolve_identity_issue
-- ------------------------------------------------------------------

create or replace function public.admin_force_resolve_identity_issue(
  p_issue_id uuid,
  p_replacement_player_id uuid,
  p_actor_label text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.match_identity_issues;
  v_match public.matches;
begin
  if coalesce(trim(p_actor_label), '') = '' or coalesce(trim(p_reason), '') = '' then
    raise exception 'actor_label_and_reason_required' using errcode = 'P0001';
  end if;

  select * into v_issue from public.match_identity_issues where issue_id = p_issue_id for update;
  if v_issue is null then
    return jsonb_build_object('ok', false, 'code', 'issue_not_found');
  end if;
  if v_issue.status <> 'open' then
    return jsonb_build_object('ok', true, 'code', 'already_resolved', 'status', v_issue.status, 'idempotentReturn', true);
  end if;

  select * into v_match from public.matches where match_id = v_issue.match_id for update;

  if exists (select 1 from public.match_participants where match_id = v_issue.match_id and player_id = p_replacement_player_id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_participant');
  end if;

  -- A diferencia de resolve_identity_issue, esta vía IGNORA deliberadamente resolution_deadline_at
  -- (es el "corregir excepcionalmente" del handoff §6.11) — por eso exige actor + motivo, nunca
  -- disponible al cliente normal.
  update public.match_participants set
    player_id = p_replacement_player_id,
    display_name_snapshot = coalesce((select display_name from public.players where player_id = p_replacement_player_id), 'Jugador')
  where match_id = v_issue.match_id and team = v_issue.team and position_in_team = v_issue.position_in_team;

  update public.match_identity_issues set status = 'resolved', resolved_player_id = p_replacement_player_id, resolved_at = now(), updated_at = now()
    where issue_id = p_issue_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (
    v_issue.match_id, 'participant_replaced', v_issue.opened_by_player_id, null,
    jsonb_build_object('issueId', p_issue_id, 'replacementPlayerId', p_replacement_player_id, 'adminActorLabel', p_actor_label, 'reason', p_reason)
  );

  return jsonb_build_object(
    'ok', true, 'code', 'identity_resolved', 'issueId', p_issue_id, 'matchId', v_issue.match_id,
    'needsRecompute', (v_match.status = 'validated')
  );
end;
$$;

comment on function public.admin_force_resolve_identity_issue is
  'Resolución administrativa excepcional de una incidencia de identidad, incluso fuera de la
   ventana normal de 7 días. Actor + motivo obligatorios. needsRecompute=true indica que la
   Edge Function debe reaplicar Nivel vía officialize_match_validation. SOLO service_role.';

revoke all on function public.admin_force_resolve_identity_issue(uuid, uuid, text, text) from public;
grant execute on function public.admin_force_resolve_identity_issue(uuid, uuid, text, text) to service_role;
