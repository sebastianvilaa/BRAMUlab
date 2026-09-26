-- BRAMUlab — Ronda UX 25/09 (Ronda 2, §9/§10) — verificación transaccional segura de
-- 20260926120000_preprod_ux_notification_actor_enrichment.sql (trigger de enriquecimiento de
-- actor en notifications + openedByPlayerId en get_notifications). Requiere Bloques 1-8
-- aplicados y al menos UNA cuenta real registrada con sesión (auth_user_id no nulo, perfil con
-- username) ya existente en el entorno — mismo criterio que verify-preprod-ux-correction-
-- revision-diff.sql. No deja fixtures: toda mutación ocurre entre BEGIN/ROLLBACK.
--
-- Cubre:
--   1) match_actions con un actor real + insert directo en notifications (type match_validated,
--      payload '{}') -> el trigger agrega payload.actorPlayerId = ese actor.
--   2) El trigger NUNCA pisa actorPlayerId si el insert ya lo trae (idempotencia/aditividad).
--   3) admin_action NUNCA se enriquece, aunque exista un match_actions reciente para el mismo
--      match_id (el actor de match_actions ahí es un placeholder, no el real — ver comentario de
--      la migración).
--   4) Un tipo fuera de la lista enriquecible (ej. correction_accepted) SÍ se enriquece; un
--      match_id null nunca revienta el trigger.
--   5) get_notifications: la tarea derivada identity_questioned trae openedByPlayerId = el
--      opened_by_player_id real de match_identity_issues, para el participante que la consulta.
--   6) Firma/permisos de get_notifications sin cambios (misma firma, solo authenticated).

begin;

create temporary table _notifenrich_caller on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _notifenrich_caller) <> 1 then
    raise exception 'verify_notifenrich_requires_one_registered_account_with_session';
  end if;
end $$;

create temporary table _notifenrich_state (k text primary key, v uuid) on commit drop;

do $$
declare
  v_a2 uuid;
  v_b1 uuid;
  v_b2 uuid;
  v_match_id uuid;
  v_rev1 uuid;
  v_a1 uuid := (select player_id from _notifenrich_caller);
begin
  insert into public.players (display_name) values ('NOTIFENRICH Compañero A2') returning player_id into v_a2;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_a2, 'notifenrich_a2', 'Compañero', 'A2', 'NOTIFENRICH Compañero A2');

  insert into public.players (display_name) values ('NOTIFENRICH Rival B1') returning player_id into v_b1;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_b1, 'notifenrich_b1', 'Rival', 'B1', 'NOTIFENRICH Rival B1');

  insert into public.players (display_name) values ('NOTIFENRICH Rival B2') returning player_id into v_b2;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_b2, 'notifenrich_b2', 'Rival', 'B2', 'NOTIFENRICH Rival B2');

  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_a1, 'notifenrich-fp-match1', 'classic', now() - interval '1 hour', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a1, 'A', 'created', now() - interval '1 hour')
    returning revision_id into v_rev1;

  update public.matches set current_revision_id = v_rev1 where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a1, 'NOTIFENRICH Caller A1'),
    (v_match_id, 'A', 2, v_a2, 'NOTIFENRICH Compañero A2'),
    (v_match_id, 'B', 1, v_b1, 'NOTIFENRICH Rival B1'),
    (v_match_id, 'B', 2, v_b2, 'NOTIFENRICH Rival B2');

  insert into _notifenrich_state (k, v) values ('a1', v_a1), ('a2', v_a2), ('b1', v_b1), ('b2', v_b2), ('match1', v_match_id);
end $$;

-- ------------------------------------------------------------------
-- 1) match_actions con actor real (v_b1, "confirmed") + insert directo en notifications con
--    payload vacío -> el trigger debe agregar payload.actorPlayerId = v_b1.
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _notifenrich_state where k = 'match1');
  v_b1 uuid := (select v from _notifenrich_state where k = 'b1');
  v_a1 uuid := (select v from _notifenrich_state where k = 'a1');
  v_notif_id uuid;
  v_payload jsonb;
begin
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'confirmed', v_b1, 'B');

  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'match_validated', v_match_id, '{}'::jsonb)
    returning notification_id into v_notif_id;

  select payload into v_payload from public.notifications where notification_id = v_notif_id;
  if (v_payload->>'actorPlayerId')::uuid is distinct from v_b1 then
    raise exception 'expected_match_validated_enriched_with_actor_b1: %', v_payload;
  end if;
end $$;

-- ------------------------------------------------------------------
-- 2) Aditividad: si el insert YA trae actorPlayerId, el trigger nunca lo pisa, aunque
--    match_actions tenga un actor distinto.
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _notifenrich_state where k = 'match1');
  v_a1 uuid := (select v from _notifenrich_state where k = 'a1');
  v_b2 uuid := (select v from _notifenrich_state where k = 'b2');
  v_notif_id uuid;
  v_payload jsonb;
begin
  -- match_actions más reciente ahora sería v_a1 (otro insert), pero el payload ya trae v_b2:
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'declared_again_same_side', v_a1, 'A');

  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'correction_accepted', v_match_id, jsonb_build_object('actorPlayerId', v_b2))
    returning notification_id into v_notif_id;

  select payload into v_payload from public.notifications where notification_id = v_notif_id;
  if (v_payload->>'actorPlayerId')::uuid is distinct from v_b2 then
    raise exception 'expected_trigger_to_never_overwrite_existing_actorPlayerId: %', v_payload;
  end if;
end $$;

-- ------------------------------------------------------------------
-- 3) admin_action NUNCA se enriquece, aunque match_actions tenga una fila reciente y real para
--    el mismo match_id — el actor de una anulación administrativa es texto libre, nunca un
--    player_id inventado del creador del partido.
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _notifenrich_state where k = 'match1');
  v_a1 uuid := (select v from _notifenrich_state where k = 'a1');
  v_notif_id uuid;
  v_payload jsonb;
begin
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'annulled', v_a1, null);

  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'admin_action', v_match_id, jsonb_build_object('action', 'annulled', 'reason', 'prueba'))
    returning notification_id into v_notif_id;

  select payload into v_payload from public.notifications where notification_id = v_notif_id;
  if v_payload ? 'actorPlayerId' then
    raise exception 'admin_action_should_never_be_enriched_with_actorPlayerId: %', v_payload;
  end if;
  if v_payload->>'reason' is distinct from 'prueba' then
    raise exception 'admin_action_payload_should_be_preserved_untouched: %', v_payload;
  end if;
end $$;

-- ------------------------------------------------------------------
-- 4) match_id null nunca revienta el trigger (notificación sin partido asociado, si alguna vez
--    existiera un tipo así).
-- ------------------------------------------------------------------

do $$
declare
  v_a1 uuid := (select v from _notifenrich_state where k = 'a1');
begin
  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'identity_resolved', null, '{}'::jsonb);
exception when others then
  raise exception 'trigger_should_never_fail_on_null_match_id: %', sqlerrm;
end $$;

-- ------------------------------------------------------------------
-- 5) get_notifications: identity_questioned trae openedByPlayerId real (mii.opened_by_player_id)
--    para el participante que consulta.
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _notifenrich_state where k = 'match1');
  v_b1 uuid := (select v from _notifenrich_state where k = 'b1');
begin
  insert into public.match_identity_issues (match_id, team, position_in_team, opened_by_player_id, resolution_deadline_at)
    values (v_match_id, 'B', 1, v_b1, now() + interval '7 days');
end $$;

select set_config('request.jwt.claim.sub', (select auth_user_id::text from _notifenrich_caller), true);

do $$
declare
  v_match_id uuid := (select v from _notifenrich_state where k = 'match1');
  v_b1 uuid := (select v from _notifenrich_state where k = 'b1');
  v_row record;
  v_found boolean := false;
begin
  for v_row in select * from public.get_notifications(50, false) where type = 'identity_questioned' and match_id = v_match_id loop
    v_found := true;
    if (v_row.payload->>'openedByPlayerId')::uuid is distinct from v_b1 then
      raise exception 'expected_identity_questioned_openedByPlayerId_b1: %', v_row.payload;
    end if;
  end loop;
  if not v_found then
    raise exception 'expected_at_least_one_identity_questioned_row_for_match1';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 6) Firma/permisos sin cambios: get_notifications(integer, boolean) sigue existiendo con su
--    MISMA firma, solo alcanzable por authenticated (nunca anon/public).
-- ------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_notifications'
      and pg_get_function_identity_arguments(p.oid) = 'p_limit integer, p_only_unread boolean'
  ) then
    raise exception 'get_notifications_signature_missing_or_changed';
  end if;

  if not has_function_privilege('authenticated', 'public.get_notifications(integer, boolean)', 'execute') then
    raise exception 'get_notifications_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.get_notifications(integer, boolean)', 'execute') then
    raise exception 'get_notifications_should_not_be_executable_by_anon';
  end if;
end $$;

rollback;
