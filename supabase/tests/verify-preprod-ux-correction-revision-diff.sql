-- BRAMUlab — Ronda correctiva (revisión central, 25/09/2026) — verificación transaccional segura
-- de 20260925150000_preprod_ux_correction_revision_diff.sql (get_match_detail: agrega
-- previousRevisionSets/pendingCorrectionSets). Requiere Bloques 1-8 + esa migración aplicados, y
-- al menos UNA cuenta real registrada con sesión (auth_user_id no nulo, perfil con username) ya
-- existente en el entorno — mismo criterio exacto que verify-preprod-p01c-profile-editable.sql
-- (nunca fabrica una fila de auth.users: se simula la sesión con
-- set_config('request.jwt.claim.sub', ...), técnica ya usada en ese mismo archivo). Los otros 3
-- participantes del partido de prueba se fabrican directos (insert into players/profiles, sin
-- auth_user_id) — mismo criterio que verify-bloque6-public-match-outcomes.sql, no hace falta que
-- sean cuentas reales para lo que se prueba acá. No deja fixtures: toda mutación ocurre entre
-- BEGIN/ROLLBACK, incluida la cuenta real elegida (nunca se le crea ni deja un partido real).
--
-- Cubre:
--   1) PRE-VALIDACIÓN — currentRevisionNumber=1 (carga original, sin revisión anterior):
--      previousRevisionSets es null.
--   2) PRE-VALIDACIÓN — corrección propuesta se vuelve la revisión vigente (revision_number 2,
--      agrega un Set 3): sets = la corrección (3 sets), previousRevisionSets = la original
--      (2 sets), currentRevisionNumber=2. Cubre "tercer set agregado" a nivel de datos crudos.
--   3) PRE-VALIDACIÓN — nueva corrección que ELIMINA el Set 3 (revision_number 3, vuelve a 2
--      sets): sets = 2 sets, previousRevisionSets = la anterior (3 sets). Cubre "tercer set
--      eliminado" a nivel de datos crudos.
--   4) POST-VALIDACIÓN — partido validado (current_revision_id sigue en la revisión oficial),
--      con una corrección propuesta y todavía pendiente (pending_correction_revision_id):
--      sets = oficial, pendingCorrectionSets = la propuesta, distintos entre sí.
--   5) Sin corrección pendiente (pending_correction_revision_id = null): pendingCorrectionSets
--      es null — nunca inventa un diff.
--
-- NO cubierto acá (requiere QA de navegador real, ver documento de resultado): que
-- ML.buildCorrectionDiffLines (bramulab/match-load.js) reciba exactamente estos jsonb ya
-- traducidos por match-sync.js#translateServerMatchToLocalShape y arme las líneas de texto
-- correctas en pantalla — eso está cubierto por separado en bramulab/tests.html
-- (aserciones "CORR-DIFF ·", 100% pura, sin necesitar Supabase).

begin;

create temporary table _uxdiff_caller on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _uxdiff_caller) <> 1 then
    raise exception 'verify_uxdiff_requires_one_registered_account_with_session';
  end if;
end $$;

create temporary table _uxdiff_state (k text primary key, v uuid) on commit drop;

-- ------------------------------------------------------------------
-- Fixtures: la cuenta real elegida ocupa A1; B1/B2 y el compañero A2 son players fabricados
-- (sin auth_user_id, no hace falta para lo que se prueba acá).
-- ------------------------------------------------------------------

do $$
declare
  v_a2 uuid;
  v_b1 uuid;
  v_b2 uuid;
begin
  insert into public.players (display_name) values ('UXDIFF Compañero A2') returning player_id into v_a2;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_a2, 'uxdiff_a2', 'Compañero', 'A2', 'UXDIFF Compañero A2');

  insert into public.players (display_name) values ('UXDIFF Rival B1') returning player_id into v_b1;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_b1, 'uxdiff_b1', 'Rival', 'B1', 'UXDIFF Rival B1');

  insert into public.players (display_name) values ('UXDIFF Rival B2') returning player_id into v_b2;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_b2, 'uxdiff_b2', 'Rival', 'B2', 'UXDIFF Rival B2');

  insert into _uxdiff_state (k, v) values ('a2', v_a2), ('b1', v_b1), ('b2', v_b2);
end $$;

-- ------------------------------------------------------------------
-- 1) Partido pending_validation, revisión 1 (original, 2 sets) — PRE-VALIDACIÓN sin corrección
--    todavía: previousRevisionSets debe ser null.
-- ------------------------------------------------------------------

do $$
declare
  v_a1 uuid := (select player_id from _uxdiff_caller);
  v_a2 uuid := (select v from _uxdiff_state where k = 'a2');
  v_b1 uuid := (select v from _uxdiff_state where k = 'b1');
  v_b2 uuid := (select v from _uxdiff_state where k = 'b2');
  v_match_id uuid;
  v_rev1 uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_a1, 'uxdiff-fp-match1', 'classic', now() - interval '1 hour', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a1, 'A', 'created', now() - interval '1 hour')
    returning revision_id into v_rev1;

  update public.matches set current_revision_id = v_rev1 where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a1, 'UXDIFF Caller A1'),
    (v_match_id, 'A', 2, v_a2, 'UXDIFF Compañero A2'),
    (v_match_id, 'B', 1, v_b1, 'UXDIFF Rival B1'),
    (v_match_id, 'B', 2, v_b2, 'UXDIFF Rival B2');

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 1, 1, 6, 4),
    (v_match_id, 1, 2, 6, 3);

  insert into _uxdiff_state (k, v) values ('match1', v_match_id), ('match1_rev1', v_rev1);
end $$;

select set_config('request.jwt.claim.sub', (select auth_user_id::text from _uxdiff_caller), true);

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_detail jsonb;
begin
  v_detail := public.get_match_detail(v_match_id);
  if v_detail is null then
    raise exception 'match1_get_match_detail_null_for_participant';
  end if;
  if (v_detail->>'currentRevisionNumber')::int is distinct from 1 then
    raise exception 'match1_expected_currentRevisionNumber_1: %', v_detail->>'currentRevisionNumber';
  end if;
  if jsonb_array_length(v_detail->'sets') is distinct from 2 then
    raise exception 'match1_expected_2_sets: %', v_detail->'sets';
  end if;
  if v_detail->'previousRevisionSets' is not null and v_detail->'previousRevisionSets' <> 'null'::jsonb then
    raise exception 'match1_expected_previousRevisionSets_null_no_prior_revision: %', v_detail->'previousRevisionSets';
  end if;
  if v_detail->'pendingCorrectionSets' is not null and v_detail->'pendingCorrectionSets' <> 'null'::jsonb then
    raise exception 'match1_expected_pendingCorrectionSets_null_no_pending_correction: %', v_detail->'pendingCorrectionSets';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 2) Rival propone una corrección PRE-VALIDACIÓN que agrega un Set 3 (revision_number 2, pasa a
--    ser la vigente) — previousRevisionSets debe traer la revisión 1 (2 sets); sets, la 2 (3).
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_b1 uuid := (select v from _uxdiff_state where k = 'b1');
  v_rev2 uuid;
begin
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 2, v_b1, 'B', 'proposed_correction', now() - interval '1 hour')
    returning revision_id into v_rev2;

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 2, 1, 6, 4),
    (v_match_id, 2, 2, 4, 6),
    (v_match_id, 2, 3, 6, 2);

  update public.matches set current_revision_id = v_rev2 where match_id = v_match_id;

  insert into _uxdiff_state (k, v) values ('match1_rev2', v_rev2);
end $$;

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_detail jsonb;
begin
  v_detail := public.get_match_detail(v_match_id);
  if (v_detail->>'currentRevisionNumber')::int is distinct from 2 then
    raise exception 'match1_rev2_expected_currentRevisionNumber_2: %', v_detail->>'currentRevisionNumber';
  end if;
  if jsonb_array_length(v_detail->'sets') is distinct from 3 then
    raise exception 'match1_rev2_expected_3_sets_after_correction: %', v_detail->'sets';
  end if;
  if v_detail->'previousRevisionSets' is null or jsonb_array_length(v_detail->'previousRevisionSets') is distinct from 2 then
    raise exception 'match1_rev2_expected_previousRevisionSets_with_2_sets: %', v_detail->'previousRevisionSets';
  end if;
  -- El Set 2 cambió (6-3 -> 4-6 desde la perspectiva A) y se agregó un Set 3: confirmar que el
  -- valor crudo devuelto es exactamente el de la revisión 1 (2-2, no una copia mutada).
  if (v_detail->'previousRevisionSets'->1->>'gamesA')::int is distinct from 6
     or (v_detail->'previousRevisionSets'->1->>'gamesB')::int is distinct from 3 then
    raise exception 'match1_rev2_previousRevisionSets_set2_mismatch: %', v_detail->'previousRevisionSets';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 3) Nueva corrección PRE-VALIDACIÓN que ELIMINA el Set 3 (revision_number 3, vuelve a 2 sets) —
--    previousRevisionSets debe traer ahora la revisión 2 (3 sets); sets, la 3 (2).
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_a1 uuid := (select player_id from _uxdiff_caller);
  v_rev3 uuid;
begin
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 3, v_a1, 'A', 'proposed_correction', now() - interval '1 hour')
    returning revision_id into v_rev3;

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 3, 1, 6, 4),
    (v_match_id, 3, 2, 6, 2);

  update public.matches set current_revision_id = v_rev3 where match_id = v_match_id;

  insert into _uxdiff_state (k, v) values ('match1_rev3', v_rev3);
end $$;

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_detail jsonb;
begin
  v_detail := public.get_match_detail(v_match_id);
  if jsonb_array_length(v_detail->'sets') is distinct from 2 then
    raise exception 'match1_rev3_expected_2_sets_after_removing_third: %', v_detail->'sets';
  end if;
  if v_detail->'previousRevisionSets' is null or jsonb_array_length(v_detail->'previousRevisionSets') is distinct from 3 then
    raise exception 'match1_rev3_expected_previousRevisionSets_with_3_sets: %', v_detail->'previousRevisionSets';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 4) POST-VALIDACIÓN: el partido queda validado con la revisión 3 como OFICIAL
--    (current_revision_id no se mueve), y se abre una corrección post-validación pendiente
--    (revision_number 4, todavía no aceptada) — sets debe seguir siendo la oficial (revisión 3),
--    pendingCorrectionSets debe traer la revisión 4.
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_b1 uuid := (select v from _uxdiff_state where k = 'b1');
  v_rev4 uuid;
begin
  update public.matches
    set status = 'validated', validated_at = now(), action_side = null
    where match_id = v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 4, v_b1, 'B', 'proposed_correction', now())
    returning revision_id into v_rev4;

  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values
    (v_match_id, 4, 1, 6, 4),
    (v_match_id, 4, 2, 7, 5);

  -- current_revision_id NUNCA se mueve por una corrección post-validación todavía sin aceptar
  -- (Backend_Infraestructura.md §12.3) — sigue en la revisión 3 (oficial); solo se anota el
  -- puntero de la propuesta pendiente.
  update public.matches set pending_correction_revision_id = v_rev4 where match_id = v_match_id;

  insert into _uxdiff_state (k, v) values ('match1_rev4', v_rev4);
end $$;

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_detail jsonb;
begin
  v_detail := public.get_match_detail(v_match_id);
  if v_detail->>'status' is distinct from 'validated' then
    raise exception 'match1_expected_status_validated: %', v_detail->>'status';
  end if;
  -- Oficial (sets) sigue siendo la revisión 3 (2-6/2-2), nunca la 4 propuesta.
  if (v_detail->'sets'->1->>'gamesB')::int is distinct from 2 then
    raise exception 'match1_post_validation_sets_should_stay_official_rev3: %', v_detail->'sets';
  end if;
  if v_detail->'pendingCorrectionSets' is null or jsonb_array_length(v_detail->'pendingCorrectionSets') is distinct from 2 then
    raise exception 'match1_expected_pendingCorrectionSets_with_2_sets: %', v_detail->'pendingCorrectionSets';
  end if;
  if (v_detail->'pendingCorrectionSets'->1->>'gamesA')::int is distinct from 7
     or (v_detail->'pendingCorrectionSets'->1->>'gamesB')::int is distinct from 5 then
    raise exception 'match1_pendingCorrectionSets_set2_mismatch: %', v_detail->'pendingCorrectionSets';
  end if;
  -- official (sets) y pending deben ser estructuralmente DISTINTOS (esto es lo que arma el diff
  -- del lado del cliente) — nunca la misma revisión duplicada por error.
  if v_detail->'sets' = v_detail->'pendingCorrectionSets' then
    raise exception 'match1_official_and_pending_sets_should_differ';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 5) Sin corrección pendiente (pending_correction_revision_id vuelve a null) —
--    pendingCorrectionSets debe volver a null, nunca inventar un diff con datos viejos.
-- ------------------------------------------------------------------

do $$
declare
  v_match_id uuid := (select v from _uxdiff_state where k = 'match1');
  v_detail jsonb;
begin
  update public.matches set pending_correction_revision_id = null where match_id = v_match_id;

  v_detail := public.get_match_detail(v_match_id);
  if v_detail->'pendingCorrectionSets' is not null and v_detail->'pendingCorrectionSets' <> 'null'::jsonb then
    raise exception 'match1_expected_pendingCorrectionSets_null_after_clearing_pointer: %', v_detail->'pendingCorrectionSets';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 6) Firma/permisos sin cambios: get_match_detail(uuid) sigue existiendo con su MISMA firma,
--    solo alcanzable por `authenticated` (nunca anon/public) — la migración es CREATE OR REPLACE
--    puro, nunca debió tocar GRANT/REVOKE.
-- ------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_match_detail'
      and pg_get_function_identity_arguments(p.oid) = 'p_match_id uuid'
  ) then
    raise exception 'get_match_detail_signature_missing_or_changed';
  end if;

  if not has_function_privilege('authenticated', 'public.get_match_detail(uuid)', 'execute') then
    raise exception 'get_match_detail_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.get_match_detail(uuid)', 'execute') then
    raise exception 'get_match_detail_should_not_be_executable_by_anon';
  end if;
end $$;

rollback;
