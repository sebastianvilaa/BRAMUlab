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

  if v_match.status = 'validated' then
    -- C-05 (10_Revision_Final_Pre_Staging_ChatGPT.md): STAGED, igual que resolve_identity_issue
    -- normal (B6-A-09) — solo AUTORIZA (actor+motivo ya validados, ignora deliberadamente
    -- resolution_deadline_at: es el "corregir excepcionalmente" del handoff §6.11), nunca muta
    -- match_participants ni cierra la incidencia todavía. La Edge Function
    -- admin-resolve-identity-issue (alcanzable SOLO con la service role key exacta, nunca un JWT
    -- de usuario) llama inmediatamente después a officialize_match_validation(trigger=
    -- identity_resolved), que hace la reasignación + el refresco de fingerprint + la
    -- reaplicación de Nivel + el cierre de la incidencia en UNA sola transacción atómica. Antes
    -- de este fix, un fallo/interrupción entre la mutación directa y el recálculo separado podía
    -- dejar la identidad ya reasignada con Nivel todavía suspendido, y sin camino idempotente
    -- para completarlo (officialize_match_validation exige la incidencia todavía open).
    return jsonb_build_object(
      'ok', true, 'code', 'identity_resolved_authorized', 'issueId', p_issue_id, 'matchId', v_issue.match_id,
      'team', v_issue.team, 'positionInTeam', v_issue.position_in_team,
      'replacementPlayerId', p_replacement_player_id, 'needsRecompute', true
    );
  end if;

  -- Partido todavía pending_validation: sin efecto de Nivel que atomizar, se reasigna directo
  -- (ignora deliberadamente resolution_deadline_at, es el "corregir excepcionalmente" del
  -- handoff §6.11).
  update public.match_participants set
    player_id = p_replacement_player_id,
    display_name_snapshot = coalesce((select display_name from public.players where player_id = p_replacement_player_id), 'Jugador')
  where match_id = v_issue.match_id and team = v_issue.team and position_in_team = v_issue.position_in_team;

  -- B6-B-04: mantiene participant_fingerprint sincronizado también en la vía administrativa.
  perform public._bloque6_refresh_participant_fingerprint(v_issue.match_id);

  update public.match_identity_issues set status = 'resolved', resolved_player_id = p_replacement_player_id, resolved_at = now(), updated_at = now()
    where issue_id = p_issue_id;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata)
  values (
    v_issue.match_id, 'participant_replaced', v_issue.opened_by_player_id, null,
    jsonb_build_object('issueId', p_issue_id, 'replacementPlayerId', p_replacement_player_id, 'adminActorLabel', p_actor_label, 'reason', p_reason)
  );

  return jsonb_build_object(
    'ok', true, 'code', 'identity_resolved', 'issueId', p_issue_id, 'matchId', v_issue.match_id, 'needsRecompute', false
  );
end;
$$;

comment on function public.admin_force_resolve_identity_issue is
  'Resolución administrativa excepcional de una incidencia de identidad, incluso fuera de la
   ventana normal de 7 días. Actor + motivo obligatorios. Partido validated (C-05): SOLO
   autoriza (needsRecompute=true) — la reasignación, el refresco de fingerprint, el cierre de la
   incidencia y la reaplicación de Nivel ocurren atómicamente dentro de
   officialize_match_validation(trigger=identity_resolved), invocado por la Edge Function
   admin-resolve-identity-issue (SOLO alcanzable con la service role key exacta). Partido
   pending_validation: sin efecto de Nivel que atomizar, se reasigna directo. SOLO service_role.';

revoke all on function public.admin_force_resolve_identity_issue(uuid, uuid, text, text) from public;
grant execute on function public.admin_force_resolve_identity_issue(uuid, uuid, text, text) to service_role;
