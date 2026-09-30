-- BRAMUlab — V04.18 (Issue #12): verificación transaccional de
-- 20260930260000_preprod_v0418_sustain_match_revision.sql (NO HAY ERROR pre-validación).
-- Fixtures propios, termina en ROLLBACK.
--
--  S1  R1(A) -> R2(B) -> aceptar R2: confirm_match_validation valida/deja lista R2 (camino vigente intacto)
--  S2  R1 -> R2 -> NO HAY ERROR: nueva revisión R3 = sets de R1, vigente; la acción vuelve a la pareja de R2
--  S3  luego confirmar (VALIDAR PARTIDO) deja lista R3 (= R1) — sin tocar Nivel
--  S4  luego REPORTAR UN ERROR (create_or_attach con otro score) => R4; la acción vuelve al otro lado
--  S5  compañeros: una única tarea (action_side por pareja); el compañero puede actuar, el rival no
--  S6  doble tap / retry => idempotente (sin revisiones ni acciones duplicadas)
--  S7  revisión vieja (stale) / no es tu turno / nadie propuso nada que sostener => conflicto
--  S8  el deadline original NO se extiende
--  S9  nada de esto oficializa ni crea efectos de Nivel; el flujo post-validación no se toca
--  S10 permisos de ejecución

begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._t where k = p_key)), true);
end $$;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;
create or replace function pg_temp._mk(p_key text) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email) values (v_uid, 'v418_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('V418 ' || p_key, v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_pid, 'v418_' || lower(p_key) || substr(v_uid::text, 1, 6), 'V418', p_key, 'V418 ' || p_key);
  insert into pg_temp._t values (p_key, v_pid);
end $$;
create or replace function pg_temp._sets(p_match uuid, p_rev int) returns text language sql as $$
  select string_agg(games_a || '-' || games_b, ' ' order by set_number) from public.match_sets where match_id = p_match and revision_number = p_rev
$$;
-- Partido pendiente: R1 (created por equipo A), R2 (proposed_correction por equipo B), acción en A.
create or replace function pg_temp._mk_pending(p_tag text) returns uuid language plpgsql as $$
declare v_m uuid; v_r1 uuid; v_r2 uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, action_side, validation_deadline_at)
    values (pg_temp._id('A1'), 'v418-fp-' || p_tag, 'classic', now() - interval '1 day', 'pending_validation', 'B', now() + interval '20 days')
    returning match_id into v_m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_m, 'A', 1, pg_temp._id('A1'), 'A1'), (v_m, 'A', 2, pg_temp._id('A2'), 'A2'),
    (v_m, 'B', 1, pg_temp._id('B1'), 'B1'), (v_m, 'B', 2, pg_temp._id('B2'), 'B2');
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_m, 1, pg_temp._id('A1'), 'A', 'created', now() - interval '1 day') returning revision_id into v_r1;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_m, 1, 1, 6, 2), (v_m, 1, 2, 6, 2);
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id) values (v_m, 'created', pg_temp._id('A1'), 'A', v_r1);
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_m, 2, pg_temp._id('B1'), 'B', 'proposed_correction', now() - interval '1 day') returning revision_id into v_r2;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_m, 2, 1, 2, 6), (v_m, 2, 2, 3, 6);
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id) values (v_m, 'revision_proposed', pg_temp._id('B1'), 'B', v_r2);
  -- R2 la propuso B => la acción es de A
  update public.matches set current_revision_id = v_r2, action_side = 'A' where match_id = v_m;
  insert into pg_temp._t values ('M_' || p_tag, v_m);
  return v_m;
end $$;

do $$
begin
  perform pg_temp._mk('A1'); perform pg_temp._mk('A2'); perform pg_temp._mk('B1'); perform pg_temp._mk('B2');
  perform pg_temp._mk_pending('s1'); perform pg_temp._mk_pending('s2');
end $$;

-- ---------- S1 aceptar R2 (camino vigente) ----------
do $$
declare r jsonb; m uuid := pg_temp._id('M_s1');
begin
  r := public.confirm_match_validation((select auth_user_id from public.players where player_id = pg_temp._id('A1')), m);
  perform pg_temp._assert((r->>'ok')::boolean and (r->>'readyForValidation')::boolean, 'S1 aceptar R2 deja la revisión vigente lista para oficializar: ' || r::text);
  perform pg_temp._assert((select action_side is null from public.matches where match_id = m), 'S1 acción liberada');
  perform pg_temp._assert(pg_temp._sets(m, (select revision_number from public.match_revisions where revision_id = (select current_revision_id from public.matches where match_id = m))) = '2-6 3-6', 'S1 vigente = R2');
end $$;

-- ---------- S2 NO HAY ERROR ----------
do $$
declare r jsonb; m uuid := pg_temp._id('M_s2'); dl timestamptz;
begin
  select validation_deadline_at into dl from public.matches where match_id = m;
  perform pg_temp._as('A1');
  r := public.sustain_match_revision(m, 2);
  perform pg_temp._assert((r->>'ok')::boolean and (r->>'changed')::boolean and r->>'actionSide' = 'B' and (r->>'currentRevisionNumber')::int = 3, 'S2 sostener: ' || r::text);
  perform pg_temp._assert(pg_temp._sets(m, 3) = '6-2 6-2', 'S2 R3 = sets de R1 (copia)');
  perform pg_temp._assert(pg_temp._sets(m, 1) = '6-2 6-2' and pg_temp._sets(m, 2) = '2-6 3-6', 'S2 R1 y R2 intactas (append-only)');
  perform pg_temp._assert((select count(*) from public.match_revisions where match_id = m) = 3, 'S2 tres revisiones');
  perform pg_temp._assert((select source = 'sustained_revision' and proposed_by_team = 'A' from public.match_revisions where match_id = m and revision_number = 3), 'S2 R3 source/propietaria');
  perform pg_temp._assert((select status = 'pending_validation' and action_side = 'B' and validated_at is null from public.matches where match_id = m), 'S2 sigue pendiente, acción a la pareja que propuso R2');
  perform pg_temp._assert(exists (select 1 from public.match_actions where match_id = m and action_type = 'revision_sustained' and acting_side = 'A'
      and revision_id = (select current_revision_id from public.matches where match_id = m) and (metadata->>'supersededRevisionNumber')::int = 2 and (metadata->>'sustainedRevisionNumber')::int = 1), 'S2 acción auditable');
  -- S8 deadline
  perform pg_temp._assert((select validation_deadline_at = dl from public.matches where match_id = m), 'S8 el deadline original NO se extiende');
end $$;

-- ---------- S5 / S7 turno y compañeros ----------
do $$
declare r jsonb; m uuid := pg_temp._id('M_s2');
begin
  perform pg_temp._as('A2');   -- compañero de quien sostuvo: ya no es su turno
  perform pg_temp._assert(public.sustain_match_revision(m, 3)->>'code' = 'not_actionable_for_caller', 'S5 A ya no tiene la acción');
  perform pg_temp._as('B2');   -- COMPAÑERO de quien propuso R2: comparte la misma tarea
  r := public.sustain_match_revision(m, 3);
  -- la revisión vigente (R3) es una revisión SOSTENIDA, no una corrección: no hay un "no hay error" de vuelta (sin ida y vuelta)
  perform pg_temp._assert(r->>'code' = 'nothing_to_sustain', 'S5 B (cualquiera de la pareja) no puede re-sostener una revisión sostenida: ' || r::text);
  perform pg_temp._assert((select count(*) from public.match_revisions where match_id = m) = 3, 'S5 no se creó nada');
  perform pg_temp._as('B1');
  perform pg_temp._assert(public.sustain_match_revision(m, 2)->>'code' = 'stale_revision', 'S7 revisión esperada vieja => stale_revision');
end $$;

-- S5 (compañeros): en R1->R2 con la acción en A, el COMPAÑERO A2 (no quien cargó) puede sostener y eso cuenta para toda la pareja
do $$
declare m uuid := pg_temp._mk_pending('s5'); r jsonb;
begin
  perform pg_temp._as('B2');
  perform pg_temp._assert(public.sustain_match_revision(m, 2)->>'code' = 'not_actionable_for_caller', 'S5 la pareja que propuso R2 (B) no puede sostener: la acción es de A');
  perform pg_temp._as('A2');
  r := public.sustain_match_revision(m, 2);
  perform pg_temp._assert((r->>'ok')::boolean and (r->>'changed')::boolean, 'S5 el compañero A2 actúa por toda la pareja: ' || r::text);
  perform pg_temp._as('A1');
  r := public.sustain_match_revision(m, 2);
  perform pg_temp._assert((r->>'ok')::boolean and not (r->>'changed')::boolean, 'S5 A1 ve la tarea ya resuelta (una única resolución por pareja)');
  perform pg_temp._assert((select count(*) from public.match_actions where match_id = m and action_type = 'revision_sustained') = 1, 'S5 una sola acción');
end $$;

-- ---------- S6 doble tap / retry ----------
do $$
declare r jsonb; m uuid := pg_temp._id('M_s2');
begin
  perform pg_temp._as('A1');
  r := public.sustain_match_revision(m, 2);
  perform pg_temp._assert((r->>'ok')::boolean and not (r->>'changed')::boolean and r->>'code' = 'already_sustained', 'S6 retry idempotente: ' || r::text);
  perform pg_temp._as('A2');   -- el compañero con la misma pantalla vieja también es idempotente
  r := public.sustain_match_revision(m, 2);
  perform pg_temp._assert((r->>'ok')::boolean and not (r->>'changed')::boolean, 'S6 compañero con pantalla vieja: idempotente');
  perform pg_temp._assert((select count(*) from public.match_revisions where match_id = m) = 3 and (select count(*) from public.match_actions where match_id = m and action_type = 'revision_sustained') = 1, 'S6 sin duplicados');
end $$;

-- ---------- S3 VALIDAR PARTIDO sobre R3 ----------
do $$
declare r jsonb; m uuid := pg_temp._id('M_s2');
begin
  -- B (pareja que propuso R2) valida la revisión sostenida (= R1)
  r := public.confirm_match_validation((select auth_user_id from public.players where player_id = pg_temp._id('B1')), m);
  perform pg_temp._assert((r->>'ok')::boolean and (r->>'readyForValidation')::boolean, 'S3 VALIDAR PARTIDO: ' || r::text);
  perform pg_temp._assert(pg_temp._sets(m, (select revision_number from public.match_revisions where revision_id = (select current_revision_id from public.matches where match_id = m))) = '6-2 6-2', 'S3 lo que se oficializa = R1');
  -- S9: nada oficializado ni efectos de Nivel todavía
  perform pg_temp._assert((select status = 'pending_validation' and validated_at is null from public.matches where match_id = m), 'S9 sigue pending hasta oficializar');
  perform pg_temp._assert(not exists (select 1 from public.match_level_results where match_id = m), 'S9 sin efectos de Nivel');
  -- y una vez lista, ya no hay nada que sostener
  perform pg_temp._as('A1');
  perform pg_temp._assert(public.sustain_match_revision(m, 3)->>'code' in ('not_actionable_for_caller', 'already_sustained'), 'S9 sin acción pendiente no se puede sostener');
end $$;

-- ---------- S4 REPORTAR UN ERROR tras un NO HAY ERROR (R4) ----------
do $$
declare m uuid; r1 uuid; r2 uuid; rs jsonb; rc record;
begin
  m := pg_temp._mk_pending('s4');
  -- huella REAL del encuentro (create_or_attach_match lo busca por huella de participantes)
  update public.matches set participant_fingerprint = encode(extensions.digest(
      least(least(pg_temp._id('A1')::text, pg_temp._id('A2')::text) || ':' || greatest(pg_temp._id('A1')::text, pg_temp._id('A2')::text),
            least(pg_temp._id('B1')::text, pg_temp._id('B2')::text) || ':' || greatest(pg_temp._id('B1')::text, pg_temp._id('B2')::text))
      || '|' ||
      greatest(least(pg_temp._id('A1')::text, pg_temp._id('A2')::text) || ':' || greatest(pg_temp._id('A1')::text, pg_temp._id('A2')::text),
               least(pg_temp._id('B1')::text, pg_temp._id('B2')::text) || ':' || greatest(pg_temp._id('B1')::text, pg_temp._id('B2')::text)), 'sha256'), 'hex')
    where match_id = m;
  perform pg_temp._as('A1');
  rs := public.sustain_match_revision(m, 2);
  perform pg_temp._assert((rs->>'ok')::boolean, 'S4 prerequisito: sostener');
  -- B "reporta un error": nueva revisión vía el mecanismo vigente de corrección pre-validación (create_or_attach_match)
  perform public.create_or_attach_match(
    (select auth_user_id from public.players where player_id = pg_temp._id('B1')), gen_random_uuid(),
    pg_temp._id('B1'), pg_temp._id('B2'), pg_temp._id('A1'), pg_temp._id('A2'),
    now() - interval '1 day', true, 'classic',
    '[{"gamesA":6,"gamesB":3,"tiebreakA":null,"tiebreakB":null},{"gamesA":6,"gamesB":4,"tiebreakA":null,"tiebreakB":null}]'::jsonb);
  perform pg_temp._assert((select count(*) from public.match_revisions where match_id = m) = 4, 'S4 nace R4');
  perform pg_temp._assert((select action_side = 'A' from public.matches where match_id = m), 'S4 la acción vuelve al otro lado (A)');
  perform pg_temp._assert(pg_temp._sets(m, 4) = '3-6 4-6' or pg_temp._sets(m, 4) = '6-3 6-4', 'S4 R4 con el score propuesto: ' || coalesce(pg_temp._sets(m, 4), 'null'));
end $$;

-- ---------- S7 nada que sostener ----------
do $$
declare m uuid;
begin
  -- partido con SOLO R1: nadie propuso una corrección
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, action_side, validation_deadline_at)
    values (pg_temp._id('A1'), 'v418-fp-solo', 'classic', now() - interval '1 day', 'pending_validation', 'B', now() + interval '20 days') returning match_id into m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (m, 'A', 1, pg_temp._id('A1'), 'A1'), (m, 'A', 2, pg_temp._id('A2'), 'A2'), (m, 'B', 1, pg_temp._id('B1'), 'B1'), (m, 'B', 2, pg_temp._id('B2'), 'B2');
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (m, 1, pg_temp._id('A1'), 'A', 'created', now() - interval '1 day');
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (m, 1, 1, 6, 2), (m, 1, 2, 6, 2);
  update public.matches set current_revision_id = (select revision_id from public.match_revisions where match_id = m and revision_number = 1) where match_id = m;
  perform pg_temp._as('B1');
  perform pg_temp._assert(public.sustain_match_revision(m, 1)->>'code' = 'nothing_to_sustain', 'S7 sin corrección previa => nothing_to_sustain');
  -- no participante
  perform pg_temp._mk('X');
  perform pg_temp._as('X');
  perform pg_temp._assert(public.sustain_match_revision(m, 1)->>'code' = 'not_a_participant', 'S7 no participante');
  -- vencido
  update public.matches set validation_deadline_at = now() - interval '1 hour' where match_id = pg_temp._id('M_s4');
  perform pg_temp._as('A1');
  perform pg_temp._assert(public.sustain_match_revision(pg_temp._id('M_s4'), 3)->>'code' in ('match_expired', 'not_actionable_for_caller'), 'S7 vencido => match_expired');
end $$;

-- ---------- S10 permisos ----------
do $$
begin
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.sustain_match_revision(uuid,integer)', 'execute'), 'S10 authenticated ejecuta');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.sustain_match_revision(uuid,integer)', 'execute'), 'S10 anon NO');
end $$;

select 'V0418_VERIFY_OK' as result;
rollback;
