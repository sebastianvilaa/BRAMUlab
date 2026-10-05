-- BRAMUlab — V04.29: verificación transaccional de 20261003100000/110000/120000 (invitados, vinculación de identidad, recuperación,
-- duplicados). Crea sus propios fixtures y termina en ROLLBACK. Requiere Bloques 1-9 + G1 aplicados. Ejecutable en Staging real
-- (SQL editor) y en PGlite (verify-clean-room.mjs). El replay de NIVEL y los duplicados con motor real se prueban en
-- supabase/functions/_shared/identity-recovery-core.test.mjs; la carrera REAL de dos links en
-- supabase/tests/verify-g3-identity-recovery-concurrency.mjs (necesita dos conexiones: PGlite/SQL editor son de una sola).
--
--  L1  create_claim_link: el creador puede; solo persiste el sha256 (el token crudo NO está en la base)
--  L2  un registrado que COMPARTIÓ un partido real con la provisional también puede; los dos links coexisten (multi-invitador)
--  L3  un no relacionado NO puede (mismo código que "no existe": nunca confirma UUIDs); nombre idéntico no relaciona
--  L4  regenerar rota SOLO el link propio; el del otro invitador sigue vigente
--  L5  preview_claim_link: devuelve solo {ok,code,displayName}; NO consume; códigos invalid/revoked/expired/used
--  L6  SOY YO con el link de uno gana: consume SU link, revoca los demás pending de esa provisional (misma transacción)
--  L7  reintento por el mismo target es idempotente; otro usuario con link revocado/usado recibe claim_revoked/claim_already_used
--  L8  vencido: claim_expired y marca expired; NO SOY YO (solo preview) deja el link intacto
--  L9  legal_acceptances no se pierde ni muta (la cuenta destino conserva su bootstrap); el trigger append-only sigue vigente
--  L10 la provisional recuperada es tombstone: no listable, no invitable, match_participants reasociados, huella refrescada,
--      historial del actor/proposer/submission intacto; otro provisional homónimo NO se toca (nunca por nombre)
--  L11 ACL/RLS: tablas nuevas server-only; RPC de cliente solo authenticated; internas/replay solo service_role
--  L12 rate limits: preview (30/15 min) y claim (10/15 min) cuentan también tokens inválidos

begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;
create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = pg_temp._id(p_key)), true);
end $$;
create or replace function pg_temp._mk(p_key text, p_name text) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    values (v_uid, 'g3_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test', now(), '{"legal_version":"legal_v1"}'::jsonb);
  select player_id into v_pid from public.players where auth_user_id = v_uid;
  update public.players set display_name = p_name where player_id = v_pid;
  update public.profiles set username = 'g3_' || lower(p_key) || substr(v_uid::text, 1, 5), first_name = p_name, last_name = 'G3', display_name = p_name where player_id = v_pid;
  insert into pg_temp._t values (p_key, v_pid);
end $$;
create or replace function pg_temp._prov(p_key text, p_creator text, p_name text) returns void language plpgsql as $$
declare v_pid uuid;
begin
  insert into public.players (type, display_name, created_by_player_id) values ('provisional', p_name, pg_temp._id(p_creator)) returning player_id into v_pid;
  insert into pg_temp._t values (p_key, v_pid);
end $$;
create or replace function pg_temp._match(p_tag text, p_creator text, p_a1 text, p_a2 text, p_b1 text, p_b2 text) returns uuid language plpgsql as $$
declare v_m uuid; v_rev uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, action_side, validation_deadline_at)
    values (pg_temp._id(p_creator), 'g3-seed-' || p_tag, 'classic', now() - interval '2 days', 'pending_validation', 'B', now() + interval '20 days') returning match_id into v_m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_m, 'A', 1, pg_temp._id(p_a1), (select display_name from public.players where player_id = pg_temp._id(p_a1))),
    (v_m, 'A', 2, pg_temp._id(p_a2), (select display_name from public.players where player_id = pg_temp._id(p_a2))),
    (v_m, 'B', 1, pg_temp._id(p_b1), (select display_name from public.players where player_id = pg_temp._id(p_b1))),
    (v_m, 'B', 2, pg_temp._id(p_b2), (select display_name from public.players where player_id = pg_temp._id(p_b2)));
  perform public._bloque6_refresh_participant_fingerprint(v_m);
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_m, 1, pg_temp._id(p_creator), 'A', 'created', now() - interval '2 days') returning revision_id into v_rev;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_m, 1, 1, 6, 3), (v_m, 1, 2, 6, 4);
  update public.matches set current_revision_id = v_rev where match_id = v_m;
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id) values (v_m, 'created', pg_temp._id(p_creator), 'A', v_rev);
  insert into pg_temp._t values ('M_' || p_tag, v_m);
  return v_m;
end $$;

do $$ begin
  insert into public.app_config (id, environment) values (1, 'staging') on conflict do nothing;
  perform pg_temp._mk('SEBA', 'Seba'); perform pg_temp._mk('MATU', 'Matu'); perform pg_temp._mk('LUCHO', 'Lucho');
  perform pg_temp._mk('NICO', 'Nico'); perform pg_temp._mk('ZOE', 'Zoe'); perform pg_temp._mk('TGT', 'Pedro Real'); perform pg_temp._mk('OTRO', 'Otro');
  perform pg_temp._prov('PEDRO', 'SEBA', 'Pedro');
  perform pg_temp._prov('HOMONIMO', 'SEBA', 'Pedro');           -- OTRA persona con el mismo nombre
  -- M1: Seba+Pedro vs Matu+Lucho (Matu y Seba comparten partido con la provisional). M2: el homónimo juega con Seba+Nico.
  perform pg_temp._match('m1', 'SEBA', 'SEBA', 'PEDRO', 'MATU', 'LUCHO');
  perform pg_temp._match('m2', 'SEBA', 'SEBA', 'HOMONIMO', 'NICO', 'LUCHO');
end $$;

-- ================================ L1 / L2 / L3 / L4 : links ================================
do $$
declare v_seba_tok text; v_matu_tok text; v_matu_tok2 text; v_ok boolean; v_n int;
begin
  perform pg_temp._as('SEBA');
  v_seba_tok := public.create_claim_link(pg_temp._id('PEDRO'));
  perform pg_temp._assert(v_seba_tok ~ '^[0-9a-f]{64}$', 'L1 token de 256 bits (64 hex)');
  perform pg_temp._assert(not exists (select 1 from public.provisional_claims where token_hash = v_seba_tok), 'L1 el token crudo NO se persiste como hash');
  perform pg_temp._assert(exists (select 1 from public.provisional_claims where token_hash = encode(extensions.digest(v_seba_tok, 'sha256'), 'hex')), 'L1 solo se guarda el sha256');
  perform pg_temp._assert(not exists (select 1 from public.provisional_claims where token_hash = v_seba_tok or token_hash like '%' || v_seba_tok || '%'), 'L1 sin token crudo');

  perform pg_temp._as('MATU');
  v_matu_tok := public.create_claim_link(pg_temp._id('PEDRO'));
  perform pg_temp._assert((select count(*) from public.provisional_claims where provisional_player_id = pg_temp._id('PEDRO') and status = 'pending') = 2,
    'L2 dos links pending de invitadores distintos coexisten');

  -- L3: no relacionado
  perform pg_temp._as('ZOE');
  begin perform public.create_claim_link(pg_temp._id('PEDRO')); v_ok := true; exception when others then v_ok := false; perform pg_temp._assert(sqlerrm = 'provisional_not_found', 'L3 código genérico: ' || sqlerrm); end;
  perform pg_temp._assert(v_ok = false, 'L3 un no relacionado NO puede generar link');
  begin perform public.create_claim_link(pg_temp._id('SEBA')); v_ok := true; exception when others then v_ok := false; end;
  perform pg_temp._assert(v_ok = false, 'L3 un registrado NO es invitable');
  -- Matu NO está relacionado con el homónimo creado por Seba? Sí comparte m2? No: Matu está solo en m1.
  perform pg_temp._as('MATU');
  begin perform public.create_claim_link(pg_temp._id('HOMONIMO')); v_ok := true; exception when others then v_ok := false; end;
  perform pg_temp._assert(v_ok = false, 'L3 el nombre idéntico NO relaciona: Matu no compartió partido con el homónimo');

  -- L4: regenerar rota solo el propio
  v_matu_tok2 := public.create_claim_link(pg_temp._id('PEDRO'));
  perform pg_temp._assert(v_matu_tok2 <> v_matu_tok, 'L4 token nuevo');
  perform pg_temp._assert((select count(*) from public.provisional_claims where provisional_player_id = pg_temp._id('PEDRO') and status = 'pending') = 2, 'L4 siguen 2 pending (uno por invitador)');
  perform pg_temp._assert((select status from public.provisional_claims where token_hash = encode(extensions.digest(v_matu_tok, 'sha256'), 'hex')) = 'revoked', 'L4 el link anterior de Matu quedó revocado');
  perform pg_temp._assert((select revoked_reason from public.provisional_claims where token_hash = encode(extensions.digest(v_matu_tok, 'sha256'), 'hex')) = 'rotated', 'L4 motivo rotated');
  perform pg_temp._assert((select status from public.provisional_claims where token_hash = encode(extensions.digest(v_seba_tok, 'sha256'), 'hex')) = 'pending', 'L4 el link de Seba NO se tocó');
  perform set_config('g3.seba_tok', v_seba_tok, true);
  perform set_config('g3.matu_tok', v_matu_tok2, true);
  perform set_config('g3.matu_old_tok', v_matu_tok, true);
end $$;

-- ================================ L5 : preview ================================
do $$
declare v jsonb; v_status text;
begin
  perform pg_temp._as('TGT');
  v := public.preview_claim_link(current_setting('g3.matu_tok'));
  -- V04.30: el preview suma matchCount + sourceMatch (partido fuente compacto, SIN ids de partido/jugador).
  perform pg_temp._assert((v - 'matchCount' - 'sourceMatch') = jsonb_build_object('ok', true, 'code', 'claim_valid', 'displayName', 'Pedro'), 'L5 preview devuelve ok/code/displayName + contexto: ' || v::text);
  perform pg_temp._assert(not (v::text ~* '(token|hash|player|created|uuid|[0-9a-f]{8}-[0-9a-f]{4})'), 'L5 sin ids/hash/creador');
  perform pg_temp._assert(not (coalesce(v->'sourceMatch', '{}'::jsonb) ? 'matchId'), 'L5 el partido fuente no expone su id');
  select status into v_status from public.provisional_claims where token_hash = encode(extensions.digest(current_setting('g3.matu_tok'), 'sha256'), 'hex');
  perform pg_temp._assert(v_status = 'pending', 'L5/L8 NO SOY YO (solo preview) no consume ni invalida');
  perform pg_temp._assert((public.preview_claim_link(repeat('a', 64)))->>'code' = 'claim_invalid', 'L5 token desconocido');
  perform pg_temp._assert((public.preview_claim_link('zz'))->>'code' = 'claim_invalid', 'L5 formato inválido');
  perform pg_temp._assert((public.preview_claim_link(current_setting('g3.matu_old_tok')))->>'code' = 'claim_revoked', 'L5 revocado');
end $$;

-- ================================ L6 / L7 / L9 / L10 : SOY YO ================================
do $$
declare
  v jsonb; v_legal_before jsonb; v_legal_after jsonb; v_fp_before text; v_fp text; v_rec uuid; v_ok boolean; v_sub_before int;
begin
  v_legal_before := (select coalesce(jsonb_agg(to_jsonb(la) order by la.acceptance_id), '[]'::jsonb) from public.legal_acceptances la where la.player_id = pg_temp._id('TGT'));
  perform pg_temp._assert(jsonb_array_length(v_legal_before) = 1, 'L9 la cuenta destino tiene su aceptación legal de bootstrap');
  select participant_fingerprint into v_fp_before from public.matches where match_id = pg_temp._id('M_m1');
  select count(*) into v_sub_before from public.match_actions where match_id = pg_temp._id('M_m1');

  perform pg_temp._as('TGT');
  v := public.claim_provisional_player(current_setting('g3.matu_tok'));   -- gana el link de MATU
  perform pg_temp._assert((v->>'ok')::boolean and v->>'code' = 'recovered', 'L6 SOY YO ok: ' || v::text);
  v_rec := (v->>'recoveryId')::uuid;
  perform pg_temp._assert((v->>'matchCount')::int = 1 and (v->>'levelPending')::boolean, 'L6 1 partido recuperado, Nivel pendiente');

  perform pg_temp._assert((select status from public.provisional_claims where token_hash = encode(extensions.digest(current_setting('g3.matu_tok'), 'sha256'), 'hex')) = 'claimed', 'L6 el link ganador queda claimed');
  perform pg_temp._assert((select status from public.provisional_claims where token_hash = encode(extensions.digest(current_setting('g3.seba_tok'), 'sha256'), 'hex')) = 'revoked', 'L6 el otro pending quedó revoked');
  perform pg_temp._assert((select revoked_reason from public.provisional_claims where token_hash = encode(extensions.digest(current_setting('g3.seba_tok'), 'sha256'), 'hex')) = 'recovered_elsewhere', 'L6 motivo recovered_elsewhere');
  perform pg_temp._assert(not exists (select 1 from public.provisional_claims where provisional_player_id = pg_temp._id('PEDRO') and status = 'pending'), 'L6 ningún pending queda');

  -- L10 reasociación + tombstone + historial intacto
  perform pg_temp._assert((select player_id from public.match_participants where match_id = pg_temp._id('M_m1') and team = 'A' and position_in_team = 2) = pg_temp._id('TGT'), 'L10 el slot pasó a la cuenta');
  perform pg_temp._assert((select display_name_snapshot from public.match_participants where match_id = pg_temp._id('M_m1') and team = 'A' and position_in_team = 2) = 'Pedro', 'L10 el snapshot histórico no se reescribe');
  select participant_fingerprint into v_fp from public.matches where match_id = pg_temp._id('M_m1');
  perform pg_temp._assert(v_fp <> v_fp_before and v_fp ~ '^[0-9a-f]{64}$', 'L10 huella refrescada (hash real)');
  perform pg_temp._assert((select proposed_by_player_id from public.match_revisions where match_id = pg_temp._id('M_m1') and revision_number = 1) = pg_temp._id('SEBA'), 'L10 proposer histórico intacto');
  perform pg_temp._assert((select count(*) from public.match_actions where match_id = pg_temp._id('M_m1')) = v_sub_before, 'L10 acciones/actores históricos intactos (no se reescriben)');
  perform pg_temp._assert((select is_active from public.players where player_id = pg_temp._id('PEDRO')) = false
    and (select recovered_into_player_id from public.players where player_id = pg_temp._id('PEDRO')) = pg_temp._id('TGT'), 'L10 tombstone auditable');
  perform pg_temp._assert((select player_id from public.match_participants where match_id = pg_temp._id('M_m2') and team = 'A' and position_in_team = 2) = pg_temp._id('HOMONIMO'), 'L10 el homónimo NO se toca (nunca por nombre)');
  perform pg_temp._assert((select is_active from public.players where player_id = pg_temp._id('HOMONIMO')), 'L10 el homónimo sigue activo');

  -- L9 legal
  v_legal_after := (select coalesce(jsonb_agg(to_jsonb(la) order by la.acceptance_id), '[]'::jsonb) from public.legal_acceptances la where la.player_id = pg_temp._id('TGT'));
  perform pg_temp._assert(v_legal_before = v_legal_after, 'L9 legal_acceptances idéntica (ni perdida ni mutada)');
  perform pg_temp._assert((select count(*) from public.legal_acceptances where player_id = pg_temp._id('PEDRO')) = 0, 'L9 no se fabricó evidencia para la provisional');
  begin update public.legal_acceptances set source = 'reaccept' where player_id = pg_temp._id('TGT'); v_ok := true; exception when others then v_ok := false; end;
  perform pg_temp._assert(v_ok = false, 'L9 el trigger append-only sigue activo');
  perform pg_temp._assert((select auth_user_id from public.players where player_id = pg_temp._id('TGT')) is not null, 'L9 la cuenta conserva su auth_user_id');

  -- L7 idempotencia / tokens inválidos para otros
  v := public.claim_provisional_player(current_setting('g3.matu_tok'));
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'idempotentReturn')::boolean and (v->>'recoveryId')::uuid = v_rec, 'L7 reintento del mismo target idempotente');
  v := public.claim_provisional_player(current_setting('g3.seba_tok'));
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'recoveryId')::uuid = v_rec, 'L7 el otro link ya revocado, abierto por la MISMA cuenta que ya recuperó, no asusta: idempotente');
  perform pg_temp._assert((select count(*) from public.player_identity_recoveries where source_provisional_player_id = pg_temp._id('PEDRO') and status = 'completed') = 1, 'L7 una sola recuperación exitosa por provisional');

  perform pg_temp._as('OTRO');
  v := public.claim_provisional_player(current_setting('g3.seba_tok'));
  perform pg_temp._assert(v->>'code' = 'claim_already_used', 'L7 otro usuario con link de una provisional ya recuperada: ' || v::text);
  v := public.claim_provisional_player(current_setting('g3.matu_tok'));
  perform pg_temp._assert(v->>'code' = 'claim_already_used', 'L7 link ya usado');

  -- L10 listados
  perform pg_temp._as('SEBA');
  perform pg_temp._assert(not exists (select 1 from public.list_related_provisional_players() where player_id = pg_temp._id('PEDRO')), 'L10 la recuperada deja de listarse (related)');
  perform pg_temp._assert(not exists (select 1 from public.list_my_provisional_players() where player_id = pg_temp._id('PEDRO')), 'L10 la recuperada deja de listarse (mías)');
  perform pg_temp._assert(exists (select 1 from public.list_related_provisional_players() where player_id = pg_temp._id('HOMONIMO')), 'L10 el homónimo sigue listado');
  begin perform public.create_claim_link(pg_temp._id('PEDRO')); v_ok := true; exception when others then v_ok := false; end;
  perform pg_temp._assert(v_ok = false, 'L10 una provisional recuperada ya no es invitable');
end $$;

-- ================================ L8 : vencido ================================
do $$
declare v jsonb; v_tok text; v_status text;
begin
  perform pg_temp._prov('EXP', 'SEBA', 'Vencida');
  perform pg_temp._as('SEBA');
  v_tok := public.create_claim_link(pg_temp._id('EXP'));
  update public.provisional_claims set expires_at = now() - interval '1 minute' where token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex');
  perform pg_temp._as('OTRO');
  perform pg_temp._assert((public.preview_claim_link(v_tok))->>'code' = 'claim_expired', 'L8 preview de un link vencido');
  v := public.claim_provisional_player(v_tok);
  perform pg_temp._assert(v->>'code' = 'claim_expired', 'L8 claim_expired: ' || v::text);
  select status into v_status from public.provisional_claims where token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex');
  perform pg_temp._assert(v_status = 'expired', 'L8 queda marcado expired');
  perform pg_temp._assert((select is_active from public.players where player_id = pg_temp._id('EXP')), 'L8 un link vencido no mueve nada');
end $$;

-- ================================ L11 : ACL / RLS ================================
do $$
declare v_fn text; v_tbl text;
begin
  foreach v_fn in array array[
    'public._can_invite_provisional(uuid,uuid)', 'public._detect_duplicate_candidates(uuid,uuid,uuid)',
    'public._fold_pending_match_into(uuid,uuid,uuid)', 'public._duplicate_candidate_match_json(uuid,uuid)',
    'public._level_recovery_counts(uuid)', 'public._redetect_duplicate_candidates_for_player(uuid)',
    'public._level_evidence_counts(uuid,uuid)', 'public._lock_provisional_for_assignment(uuid)', 'public._lock_provisionals_for_assignment(uuid[])',
    'public._pending_correction_is_duplicate_origin(uuid)', 'public._secondary_sets_oriented(uuid,uuid)', 'public._duplicate_scores_differ(uuid,uuid)',
    'public._annul_match_as_duplicate(uuid,uuid,uuid,uuid)', 'public._finalize_duplicate_reconciliation(uuid,uuid,text)', 'public._match_time_window_equivalent(timestamptz,boolean,timestamptz,boolean)',
    'public._match_is_live_for_dedupe(text,timestamptz)',
    'public.get_identity_recovery_level_input(uuid)', 'public.list_identity_recoveries_pending_level(uuid)',
    'public.acquire_identity_recovery_level_lease(uuid,integer)', 'public.release_identity_recovery_level_lease(uuid,uuid,text)',
    'public.record_level_recovery_skip(uuid,uuid,uuid,text,jsonb,jsonb)',
    'public.apply_level_recovery_effect(uuid,uuid,uuid,uuid,jsonb,jsonb,text,jsonb,jsonb)',
    'public.complete_identity_recovery_level(uuid,uuid)'
  ] loop
    perform pg_temp._assert(not has_function_privilege('anon', v_fn, 'EXECUTE') and not has_function_privilege('authenticated', v_fn, 'EXECUTE'), 'L11 sin EXECUTE de cliente: ' || v_fn);
    perform pg_temp._assert(not has_function_privilege('public', v_fn, 'EXECUTE'), 'L11 sin EXECUTE para PUBLIC: ' || v_fn);
  end loop;
  foreach v_fn in array array[
    'public.get_identity_recovery_level_input(uuid)', 'public.list_identity_recoveries_pending_level(uuid)',
    'public.acquire_identity_recovery_level_lease(uuid,integer)', 'public.release_identity_recovery_level_lease(uuid,uuid,text)',
    'public.record_level_recovery_skip(uuid,uuid,uuid,text,jsonb,jsonb)',
    'public.apply_level_recovery_effect(uuid,uuid,uuid,uuid,jsonb,jsonb,text,jsonb,jsonb)', 'public.complete_identity_recovery_level(uuid,uuid)'
  ] loop
    perform pg_temp._assert(has_function_privilege('service_role', v_fn, 'EXECUTE'), 'L11 service_role ejecuta: ' || v_fn);
  end loop;
  foreach v_fn in array array[
    'public.create_claim_link(uuid)', 'public.preview_claim_link(text)', 'public.claim_provisional_player(text)',
    'public.get_my_identity_recovery_status()', 'public.list_my_duplicate_match_candidates()', 'public.resolve_duplicate_match_candidate(uuid,text)',
    'public.list_my_provisional_players()', 'public.list_related_provisional_players()', 'public.get_my_matches(integer,boolean)', 'public.get_match_detail(uuid)', 'public.get_notifications(integer,boolean)'
  ] loop
    perform pg_temp._assert(has_function_privilege('authenticated', v_fn, 'EXECUTE') and not has_function_privilege('anon', v_fn, 'EXECUTE'), 'L11 RPC de cliente solo authenticated: ' || v_fn);
  end loop;
  foreach v_tbl in array array['player_identity_recoveries', 'level_recovery_effects', 'match_duplicate_candidates', 'provisional_claims'] loop
    perform pg_temp._assert((select relrowsecurity from pg_class where oid = ('public.' || v_tbl)::regclass), 'L11 RLS habilitada: ' || v_tbl);
    perform pg_temp._assert(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tbl), 'L11 cero políticas (deny-by-default): ' || v_tbl);
    perform pg_temp._assert(not has_table_privilege('anon', ('public.' || v_tbl)::regclass, 'SELECT') and not has_table_privilege('authenticated', ('public.' || v_tbl)::regclass, 'SELECT')
      and not has_table_privilege('authenticated', ('public.' || v_tbl)::regclass, 'INSERT') and not has_table_privilege('authenticated', ('public.' || v_tbl)::regclass, 'UPDATE')
      and not has_table_privilege('authenticated', ('public.' || v_tbl)::regclass, 'DELETE'), 'L11 sin acceso directo del cliente: ' || v_tbl);
  end loop;
  perform pg_temp._assert(exists (select 1 from pg_indexes where indexname = 'provisional_claims_one_pending_per_inviter'), 'L11 índice por invitador');
  perform pg_temp._assert(not exists (select 1 from pg_indexes where indexname = 'provisional_claims_one_pending_per_player'), 'L11 el índice viejo (un pending por provisional) ya no existe');
  perform pg_temp._assert(exists (select 1 from pg_indexes where indexname = 'player_identity_recoveries_one_completed_per_source'), 'L11 una sola recuperación exitosa por provisional');
  perform pg_temp._assert((select count(*) from pg_constraint where conrelid = 'public.level_recovery_effects'::regclass and conname = 'level_recovery_effects_recovery_match_key') = 1, 'L11 UNIQUE (recovery_id, match_id)');
  perform pg_temp._assert(exists (select 1 from pg_indexes where indexname = 'match_participants_one_slot_per_player'), 'L11 H3 unicidad (match_id, player_id) como defensa en profundidad');
  perform pg_temp._assert(pg_get_constraintdef((select oid from pg_constraint where conname = 'match_duplicate_candidates_status_check')) like '%awaiting_confirmation%', 'L11 H1 estado awaiting_confirmation');
end $$;

-- ================================ L12 : rate limits ================================
do $$
declare v jsonb; i int;
begin
  perform pg_temp._as('ZOE');
  for i in 1..30 loop
    v := public.preview_claim_link('not-a-token-' || i);
    perform pg_temp._assert(v->>'code' = 'claim_invalid', 'L12 preview #' || i || ' cuenta aunque el token sea inválido');
  end loop;
  v := public.preview_claim_link(repeat('b', 64));
  perform pg_temp._assert(v->>'code' = 'rate_limited', 'L12 preview #31 => rate_limited: ' || v::text);
  for i in 1..10 loop
    v := public.claim_provisional_player('x' || i);
    perform pg_temp._assert(v->>'code' = 'claim_invalid', 'L12 claim #' || i);
  end loop;
  v := public.claim_provisional_player(repeat('c', 64));
  perform pg_temp._assert(v->>'code' = 'rate_limited', 'L12 claim #11 => rate_limited: ' || v::text);
end $$;

rollback;
