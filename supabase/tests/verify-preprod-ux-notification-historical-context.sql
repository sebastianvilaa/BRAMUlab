-- BRAMUlab — Corrección post-QA (Notificaciones históricas + contexto de partido) —
-- verificación transaccional segura de
-- 20260927110000_preprod_ux_notification_historical_context.sql. Requiere Bloques 1-8 +
-- `preprod_ux_notification_actor_enrichment` aplicados, y al menos UNA cuenta real registrada
-- con sesión (auth_user_id no nulo, perfil con username) ya existente en el entorno — mismo
-- criterio que verify-preprod-ux-notification-actor-enrichment.sql. No deja fixtures: toda
-- mutación ocurre entre BEGIN/ROLLBACK.
--
-- Cubre (letras del handoff de corrección):
--   A. fila histórica match_validated (payload '{}') + acción validated de un tercero =>
--      payload devuelto trae actorPlayerId real del tercero.
--   B. la misma fila devuelve matchContext con opponentNames + score (caller Team A, sin
--      invertir).
--   C. caller Team B => score se invierte correctamente.
--   D. fila histórica causada por el propio caller => actorPlayerId = caller (para que el
--      frontend pueda clasificar selfCaused).
--   E. fila que YA trae actorPlayerId (simulando el trigger de Ronda 2 sobre un insert futuro)
--      se conserva sin pisar, aunque exista match_actions con un actor distinto.
--   F. sin evidencia inequívoca (0 filas, o 2+ filas ambiguas del mismo action_type) => NUNCA
--      inventa actor.
--   G. p_only_unread y límite siguen funcionando.

begin;

create temporary table _histctx_caller on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _histctx_caller) <> 1 then
    raise exception 'verify_histctx_requires_one_registered_account_with_session';
  end if;
end $$;

create temporary table _histctx_state (k text primary key, v uuid) on commit drop;

do $$
declare
  v_partner uuid;
  v_rival1 uuid;
  v_rival2 uuid;
begin
  insert into public.players (display_name) values ('HISTCTX Compañero') returning player_id into v_partner;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_partner, 'histctx_partner', 'HISTCTX', 'Compañero', 'HISTCTX Compañero');

  insert into public.players (display_name) values ('HISTCTX Rival Uno') returning player_id into v_rival1;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_rival1, 'histctx_rival1', 'HISTCTX', 'Rival Uno', 'HISTCTX Rival Uno');

  insert into public.players (display_name) values ('HISTCTX Rival Dos') returning player_id into v_rival2;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_rival2, 'histctx_rival2', 'HISTCTX', 'Rival Dos', 'HISTCTX Rival Dos');

  insert into _histctx_state (k, v) values ('partner', v_partner), ('rival1', v_rival1), ('rival2', v_rival2);
end $$;

-- Helper local: arma un partido validated con 2 sets, revisión 1, 4 participantes, y devuelve
-- match_id — reutilizado por los escenarios A/B/C/D/E/F con distinta orientación/actor.
create temporary table _histctx_matches (k text primary key, v uuid) on commit drop;

-- ------------------------------------------------------------------
-- A/B) Match 1 — caller Team A + compañero, rivales Team B. Acción validated de un TERCERO
--      (rival1). Sets 6-3 / 6-4 (orientados a A, sin invertir).
-- ------------------------------------------------------------------

do $$
declare
  v_a1 uuid := (select player_id from _histctx_caller);
  v_a2 uuid := (select v from _histctx_state where k = 'partner');
  v_b1 uuid := (select v from _histctx_state where k = 'rival1');
  v_b2 uuid := (select v from _histctx_state where k = 'rival2');
  v_match_id uuid;
  v_rev1 uuid;
  v_notif_id uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, validated_at, action_side)
    values (v_a1, 'histctx-fp-match-a', 'classic', now() - interval '2 hour', now() + interval '13 days', 'validated', now() - interval '1 hour', null)
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a1, 'A', 'created', now() - interval '2 hour')
    returning revision_id into v_rev1;

  update public.matches set current_revision_id = v_rev1 where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a1, 'HISTCTX Caller'),
    (v_match_id, 'A', 2, v_a2, 'HISTCTX Compañero'),
    (v_match_id, 'B', 1, v_b1, 'HISTCTX Rival Uno'),
    (v_match_id, 'B', 2, v_b2, 'HISTCTX Rival Dos');

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 1, 1, 6, 3),
    (v_match_id, 1, 2, 6, 4);

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'validated', v_b1, null);

  -- Fila HISTÓRICA: payload vacío, como las 5 encontradas por QA (anterior a la migración de
  -- enriquecimiento por trigger).
  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'match_validated', v_match_id, '{}'::jsonb)
    returning notification_id into v_notif_id;

  insert into _histctx_matches (k, v) values ('match_a', v_match_id);
  insert into _histctx_state (k, v) values ('notif_a', v_notif_id);
end $$;

-- ------------------------------------------------------------------
-- C) Match 2 — caller Team B esta vez. Sets crudos 7-5 / 6-4 (orientados a A) deben devolver
--    5–7 / 4–6 desde la perspectiva del caller.
-- ------------------------------------------------------------------

do $$
declare
  v_a1 uuid := (select v from _histctx_state where k = 'rival1');
  v_a2 uuid := (select v from _histctx_state where k = 'rival2');
  v_b1 uuid := (select player_id from _histctx_caller);
  v_b2 uuid := (select v from _histctx_state where k = 'partner');
  v_match_id uuid;
  v_rev1 uuid;
  v_notif_id uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, validated_at, action_side)
    values (v_a1, 'histctx-fp-match-c', 'classic', now() - interval '2 hour', now() + interval '13 days', 'validated', now() - interval '1 hour', null)
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a1, 'A', 'created', now() - interval '2 hour')
    returning revision_id into v_rev1;

  update public.matches set current_revision_id = v_rev1 where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a1, 'HISTCTX Rival Uno'),
    (v_match_id, 'A', 2, v_a2, 'HISTCTX Rival Dos'),
    (v_match_id, 'B', 1, v_b1, 'HISTCTX Caller'),
    (v_match_id, 'B', 2, v_b2, 'HISTCTX Compañero');

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 1, 1, 7, 5),
    (v_match_id, 1, 2, 6, 4);

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'validated', v_a1, null);

  insert into public.notifications (player_id, type, match_id, payload)
    values (v_b1, 'match_validated', v_match_id, '{}'::jsonb)
    returning notification_id into v_notif_id;

  insert into _histctx_matches (k, v) values ('match_c', v_match_id);
  insert into _histctx_state (k, v) values ('notif_c', v_notif_id);
end $$;

-- ------------------------------------------------------------------
-- D) Match 3 — el propio caller ejecutó la validación (selfCaused histórico).
-- ------------------------------------------------------------------

do $$
declare
  v_a1 uuid := (select player_id from _histctx_caller);
  v_a2 uuid := (select v from _histctx_state where k = 'partner');
  v_b1 uuid := (select v from _histctx_state where k = 'rival1');
  v_b2 uuid := (select v from _histctx_state where k = 'rival2');
  v_match_id uuid;
  v_rev1 uuid;
  v_notif_id uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, validated_at, action_side)
    values (v_a1, 'histctx-fp-match-d', 'classic', now() - interval '2 hour', now() + interval '13 days', 'validated', now() - interval '1 hour', null)
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a1, 'A', 'created', now() - interval '2 hour')
    returning revision_id into v_rev1;

  update public.matches set current_revision_id = v_rev1 where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a1, 'HISTCTX Caller'),
    (v_match_id, 'A', 2, v_a2, 'HISTCTX Compañero'),
    (v_match_id, 'B', 1, v_b1, 'HISTCTX Rival Uno'),
    (v_match_id, 'B', 2, v_b2, 'HISTCTX Rival Dos');

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 1, 1, 4, 6),
    (v_match_id, 1, 2, 3, 6);

  -- El caller mismo confirmó/validó — mismo patrón que match_actions.actor_player_id ya usa.
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'validated', v_a1, null);

  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'match_validated', v_match_id, '{}'::jsonb)
    returning notification_id into v_notif_id;

  insert into _histctx_matches (k, v) values ('match_d', v_match_id);
  insert into _histctx_state (k, v) values ('notif_d', v_notif_id);
end $$;

-- ------------------------------------------------------------------
-- E) Match 4 — fila que YA trae actorPlayerId (simula un insert futuro post-trigger), con
--    match_actions apuntando a un actor DISTINTO — debe conservarse el valor del payload, nunca
--    pisarlo con la reconstrucción histórica.
-- ------------------------------------------------------------------

do $$
declare
  v_a1 uuid := (select player_id from _histctx_caller);
  v_a2 uuid := (select v from _histctx_state where k = 'partner');
  v_b1 uuid := (select v from _histctx_state where k = 'rival1');
  v_b2 uuid := (select v from _histctx_state where k = 'rival2');
  v_match_id uuid;
  v_rev1 uuid;
  v_notif_id uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, validated_at, action_side)
    values (v_a1, 'histctx-fp-match-e', 'classic', now() - interval '2 hour', now() + interval '13 days', 'validated', now() - interval '1 hour', null)
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a1, 'A', 'created', now() - interval '2 hour')
    returning revision_id into v_rev1;

  update public.matches set current_revision_id = v_rev1 where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a1, 'HISTCTX Caller'),
    (v_match_id, 'A', 2, v_a2, 'HISTCTX Compañero'),
    (v_match_id, 'B', 1, v_b1, 'HISTCTX Rival Uno'),
    (v_match_id, 'B', 2, v_b2, 'HISTCTX Rival Dos');

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 1, 1, 6, 2),
    (v_match_id, 1, 2, 6, 1);

  -- match_actions dice rival2 -- si el reconstructor histórico se ejecutara acá, devolvería
  -- rival2. El payload YA trae rival1: debe ganar rival1.
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'validated', v_b2, null);

  -- payload ya trae actorPlayerId = rival1 (simula un insert futuro post-trigger) — ese es el
  -- valor que get_notifications debe devolver sin tocarlo, nunca el rival2 de match_actions.
  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'match_validated', v_match_id, jsonb_build_object('actorPlayerId', v_b1))
    returning notification_id into v_notif_id;

  insert into _histctx_matches (k, v) values ('match_e', v_match_id);
  insert into _histctx_state (k, v) values ('notif_e', v_notif_id), ('actor_e_expected', v_b1);
end $$;

-- ------------------------------------------------------------------
-- F) Match 5 — sin evidencia inequívoca: DOS acciones correction_accepted para el mismo match
--    (ambiguo) + una fila histórica correction_accepted con payload vacío. Y un segundo caso
--    (0 evidencia): identity_unidentified sin ningún match_actions de ese tipo.
-- ------------------------------------------------------------------

do $$
declare
  v_a1 uuid := (select player_id from _histctx_caller);
  v_a2 uuid := (select v from _histctx_state where k = 'partner');
  v_b1 uuid := (select v from _histctx_state where k = 'rival1');
  v_b2 uuid := (select v from _histctx_state where k = 'rival2');
  v_match_id uuid;
  v_rev1 uuid;
  v_notif_ambiguous uuid;
  v_notif_no_evidence uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, validated_at, action_side)
    values (v_a1, 'histctx-fp-match-f', 'classic', now() - interval '2 hour', now() + interval '13 days', 'validated', now() - interval '1 hour', null)
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a1, 'A', 'created', now() - interval '2 hour')
    returning revision_id into v_rev1;

  update public.matches set current_revision_id = v_rev1 where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a1, 'HISTCTX Caller'),
    (v_match_id, 'A', 2, v_a2, 'HISTCTX Compañero'),
    (v_match_id, 'B', 1, v_b1, 'HISTCTX Rival Uno'),
    (v_match_id, 'B', 2, v_b2, 'HISTCTX Rival Dos');

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 1, 1, 6, 4),
    (v_match_id, 1, 2, 6, 4);

  -- Dos eventos correction_accepted a lo largo de la vida del partido -> ambiguo a propósito.
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'correction_accepted', v_b1, null);
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side)
    values (v_match_id, 'correction_accepted', v_b2, null);

  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'correction_accepted', v_match_id, '{}'::jsonb)
    returning notification_id into v_notif_ambiguous;

  -- Sin ningún match_actions 'participant_unidentified' para este match -> 0 evidencia.
  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a1, 'identity_unidentified', v_match_id, '{}'::jsonb)
    returning notification_id into v_notif_no_evidence;

  insert into _histctx_matches (k, v) values ('match_f', v_match_id);
  insert into _histctx_state (k, v) values ('notif_f_ambiguous', v_notif_ambiguous);
  insert into _histctx_state (k, v) values ('notif_f_no_evidence', v_notif_no_evidence);
end $$;

-- ------------------------------------------------------------------
-- Sesión del caller real, y verificación de todos los casos vía get_notifications.
-- ------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select auth_user_id::text from _histctx_caller), true);

-- A/B: actor real de un tercero + matchContext sin invertir (caller Team A).
do $$
declare
  v_row record;
  v_rival1 uuid := (select v from _histctx_state where k = 'rival1');
begin
  select * into v_row from public.get_notifications(200, false)
  where notification_id = (select v from _histctx_state where k = 'notif_a');
  if not found then raise exception 'match_a_notification_not_found_in_get_notifications'; end if;
  if (v_row.payload->>'actorPlayerId')::uuid is distinct from v_rival1 then
    raise exception 'A_FAILED_expected_actorPlayerId_rival1: %', v_row.payload;
  end if;
  if v_row.payload->'matchContext'->>'myTeam' is distinct from 'A' then
    raise exception 'B_FAILED_expected_myTeam_A: %', v_row.payload;
  end if;
  if v_row.payload->'matchContext'->'opponentNames' <> '["HISTCTX Rival Uno", "HISTCTX Rival Dos"]'::jsonb then
    raise exception 'B_FAILED_expected_opponentNames: %', v_row.payload->'matchContext'->'opponentNames';
  end if;
  if v_row.payload->'matchContext'->'score' <> '["6–3", "6–4"]'::jsonb then
    raise exception 'B_FAILED_expected_score_not_inverted: %', v_row.payload->'matchContext'->'score';
  end if;
end $$;

-- C: caller Team B -> score invertido.
do $$
declare
  v_row record;
begin
  select * into v_row from public.get_notifications(200, false)
  where notification_id = (select v from _histctx_state where k = 'notif_c');
  if not found then raise exception 'match_c_notification_not_found'; end if;
  if v_row.payload->'matchContext'->>'myTeam' is distinct from 'B' then
    raise exception 'C_FAILED_expected_myTeam_B: %', v_row.payload;
  end if;
  if v_row.payload->'matchContext'->'score' <> '["5–7", "4–6"]'::jsonb then
    raise exception 'C_FAILED_expected_score_inverted: %', v_row.payload->'matchContext'->'score';
  end if;
end $$;

-- D: selfCaused histórico -> actorPlayerId = caller.
do $$
declare
  v_row record;
  v_caller uuid := (select player_id from _histctx_caller);
begin
  select * into v_row from public.get_notifications(200, false)
  where notification_id = (select v from _histctx_state where k = 'notif_d');
  if not found then raise exception 'match_d_notification_not_found'; end if;
  if (v_row.payload->>'actorPlayerId')::uuid is distinct from v_caller then
    raise exception 'D_FAILED_expected_actorPlayerId_equals_caller: %', v_row.payload;
  end if;
end $$;

-- E: payload ya enriquecido nunca se pisa.
do $$
declare
  v_row record;
  v_expected uuid := (select v from _histctx_state where k = 'actor_e_expected');
begin
  select * into v_row from public.get_notifications(200, false)
  where notification_id = (select v from _histctx_state where k = 'notif_e');
  if not found then raise exception 'match_e_notification_not_found'; end if;
  if (v_row.payload->>'actorPlayerId')::uuid is distinct from v_expected then
    raise exception 'E_FAILED_existing_actorPlayerId_was_overwritten: % (expected %)', v_row.payload, v_expected;
  end if;
end $$;

-- F: sin evidencia inequívoca (ambigua o inexistente) -> nunca inventa actor.
do $$
declare
  v_row_ambiguous record;
  v_row_no_evidence record;
begin
  select * into v_row_ambiguous from public.get_notifications(200, false)
  where notification_id = (select v from _histctx_state where k = 'notif_f_ambiguous');
  if not found then raise exception 'match_f_ambiguous_notification_not_found'; end if;
  if v_row_ambiguous.payload ? 'actorPlayerId' then
    raise exception 'F_FAILED_ambiguous_evidence_should_never_produce_actorPlayerId: %', v_row_ambiguous.payload;
  end if;

  select * into v_row_no_evidence from public.get_notifications(200, false)
  where notification_id = (select v from _histctx_state where k = 'notif_f_no_evidence');
  if not found then raise exception 'match_f_no_evidence_notification_not_found'; end if;
  if v_row_no_evidence.payload ? 'actorPlayerId' then
    raise exception 'F_FAILED_missing_evidence_should_never_produce_actorPlayerId: %', v_row_no_evidence.payload;
  end if;
end $$;

-- G: p_only_unread y límite siguen funcionando (todas las filas de este fixture están sin leer).
do $$
declare
  v_count_all integer;
  v_count_unread integer;
  v_count_limited integer;
begin
  select count(*) into v_count_all from public.get_notifications(200, false)
    where notification_id in (
      select v from _histctx_state where k in ('notif_a', 'notif_c', 'notif_d', 'notif_e', 'notif_f_ambiguous', 'notif_f_no_evidence')
    );
  if v_count_all <> 6 then
    raise exception 'G_FAILED_expected_6_fixture_rows_visible: %', v_count_all;
  end if;

  select count(*) into v_count_unread from public.get_notifications(200, true)
    where notification_id in (
      select v from _histctx_state where k in ('notif_a', 'notif_c', 'notif_d', 'notif_e', 'notif_f_ambiguous', 'notif_f_no_evidence')
    );
  if v_count_unread <> 6 then
    raise exception 'G_FAILED_only_unread_should_still_include_unread_fixture_rows: %', v_count_unread;
  end if;

  select count(*) into v_count_limited from public.get_notifications(1, false);
  if v_count_limited <> 1 then
    raise exception 'G_FAILED_p_limit_1_should_return_exactly_1_row: %', v_count_limited;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Firma/permisos sin cambios.
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
  if has_function_privilege('authenticated', 'public._bloque6_notification_historical_actor(uuid, text)', 'execute') then
    raise exception 'historical_actor_helper_should_not_be_directly_executable_by_authenticated';
  end if;
  if has_function_privilege('authenticated', 'public._bloque6_notification_match_context(uuid, uuid)', 'execute') then
    raise exception 'match_context_helper_should_not_be_directly_executable_by_authenticated';
  end if;
end $$;

rollback;
