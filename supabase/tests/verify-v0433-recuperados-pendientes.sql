-- BRAMUlab — V04.33: verificación transaccional de 20261005200000 (Recuperados + Partidos pendientes). Fixtures propios, termina en ROLLBACK.
-- Ejecutable en Staging real (SQL editor) y en PGlite (verify-clean-room.mjs).
--
--  R1  create_claim_link guarda el partido de origen SOLO si es coherente (invitador y provisional figuran); si no, NULL y no falla
--  R2  preview_claim_link usa el partido de origen (no el más reciente) y devuelve @usuario/avatarPath de registrados, nunca ids
--  R3  sin origen (link viejo/incoherente) cae al partido más reciente; matchCount cuenta todos los partidos de la identidad
--  R4  SOY YO crea la notificación identity_recovered SOLO para el reclamante, con recoveryId/matchCount/sourceName (y la del invitador se conserva)
--  R5  get_my_recent_recoveries: solo el target; respeta la ventana (30 días) y no borra nada al vencer
--  R6  ACL: RPC nuevas solo authenticated; helper de trigger sin EXECUTE de cliente

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
  perform pg_temp._mk('NICO', 'Nico'); perform pg_temp._mk('TGT', 'Pedro Real'); perform pg_temp._mk('OTRO', 'Otro');
  perform pg_temp._prov('PEDRO', 'SEBA', 'Pedro');
  -- ORIGEN: Seba+Pedro vs Matu+Lucho (más viejo). RECIENTE: Seba+Pedro vs Nico+Lucho. OTRO_PARTIDO: sin Pedro.
  perform pg_temp._match('origen', 'SEBA', 'SEBA', 'PEDRO', 'MATU', 'LUCHO');
  perform pg_temp._match('reciente', 'SEBA', 'SEBA', 'PEDRO', 'NICO', 'LUCHO');
  perform pg_temp._match('sinpedro', 'SEBA', 'SEBA', 'NICO', 'MATU', 'LUCHO');
  update public.matches set played_at = now() - interval '9 days' where match_id = pg_temp._id('M_origen');
  update public.matches set played_at = now() - interval '1 day' where match_id = pg_temp._id('M_reciente');
  update public.profiles set avatar_url = pg_temp._id('MATU')::text || '/a.png' where player_id = pg_temp._id('MATU');
end $$;

-- ================================ R1 / R2 / R3 : link + preview ================================
do $$
declare v_tok text; v_tok_bad text; v_tok_old text; v jsonb; v_src_id uuid; v_names text; v_matu jsonb;
begin
  perform pg_temp._as('SEBA');
  -- R1: origen coherente
  v_tok := public.create_claim_link(pg_temp._id('PEDRO'), pg_temp._id('M_origen'));
  perform pg_temp._assert((select source_match_id from public.provisional_claims where token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex')) = pg_temp._id('M_origen'),
    'R1 guarda el partido de origen coherente');
  -- R1: origen sin la provisional => NULL y NO falla (el contexto nunca impide invitar)
  v_tok_bad := public.create_claim_link(pg_temp._id('PEDRO'), pg_temp._id('M_sinpedro'));
  perform pg_temp._assert((select source_match_id from public.provisional_claims where token_hash = encode(extensions.digest(v_tok_bad, 'sha256'), 'hex')) is null,
    'R1 origen incoherente => NULL (no falla)');
  perform pg_temp._assert((select status from public.provisional_claims where token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex')) = 'revoked', 'R1 rotó el link anterior del mismo invitador');
  -- R1: llamada de 1 argumento (clientes viejos) sigue funcionando
  v_tok_old := public.create_claim_link(pg_temp._id('PEDRO'));
  perform pg_temp._assert((select source_match_id from public.provisional_claims where token_hash = encode(extensions.digest(v_tok_old, 'sha256'), 'hex')) is null, 'R1 sin origen => NULL');
  -- rotamos otra vez con origen válido para R2
  v_tok := public.create_claim_link(pg_temp._id('PEDRO'), pg_temp._id('M_origen'));

  -- R2: el preview usa el partido de ORIGEN (hace 9 días), no el más reciente (ayer)
  perform pg_temp._as('TGT');
  v := public.preview_claim_link(v_tok);
  perform pg_temp._assert((v->>'ok')::boolean and v->>'code' = 'claim_valid', 'R2 preview ok');
  perform pg_temp._assert((v->>'sourceIsOrigin')::boolean, 'R2 marca que es el partido de origen');
  perform pg_temp._assert((v->>'matchCount')::int = 2, 'R2 matchCount = todos los partidos de la identidad');
  select string_agg(p->>'displayName', ',' order by (p->>'team'), (p->>'position')::int) into v_names from jsonb_array_elements(v->'sourceMatch'->'participants') p;
  perform pg_temp._assert(v_names ~ 'Matu' and v_names !~ 'Nico', 'R2 el partido mostrado es el de origen (con Matu, sin Nico): ' || v_names);
  perform pg_temp._assert(jsonb_array_length(v->'sourceMatch'->'participants') = 4, 'R2 cuatro participantes');
  select p into v_matu from jsonb_array_elements(v->'sourceMatch'->'participants') p where p->>'displayName' = 'Matu';
  perform pg_temp._assert(v_matu->>'username' is not null and v_matu->>'avatarPath' is not null, 'R2 registrados traen @usuario y ruta de avatar');
  perform pg_temp._assert((select (p->>'isInvitee')::boolean from jsonb_array_elements(v->'sourceMatch'->'participants') p where p->>'displayName' = 'Pedro'), 'R2 marca el lugar del invitado');
  perform pg_temp._assert((select p->>'username' is null and p->>'avatarPath' is null from jsonb_array_elements(v->'sourceMatch'->'participants') p where p->>'displayName' = 'Pedro'), 'R2 el provisional no trae usuario/avatar');
  perform pg_temp._assert(not (v->'sourceMatch') ? 'matchId', 'R2 no expone el id del partido');
  perform pg_temp._assert(not (v::text ~* '(token|hash|created_by|uuid)'), 'R2 sin hash/creador/uuid');

  -- R3: link sin origen => el partido más reciente
  perform pg_temp._as('SEBA');
  v_tok_old := public.create_claim_link(pg_temp._id('PEDRO'));
  perform pg_temp._as('TGT');
  v := public.preview_claim_link(v_tok_old);
  select string_agg(p->>'displayName', ',') into v_names from jsonb_array_elements(v->'sourceMatch'->'participants') p;
  perform pg_temp._assert(v_names ~ 'Nico' and not (v->>'sourceIsOrigin')::boolean, 'R3 sin origen cae al más reciente (con Nico): ' || v_names);
  -- R3: origen que ya no es vigente (anulado) => también cae al más reciente
  perform pg_temp._as('SEBA');
  v_tok := public.create_claim_link(pg_temp._id('PEDRO'), pg_temp._id('M_origen'));
  update public.matches set status = 'annulled' where match_id = pg_temp._id('M_origen');
  perform pg_temp._as('TGT');
  v := public.preview_claim_link(v_tok);
  perform pg_temp._assert(not (v->>'sourceIsOrigin')::boolean and (v->>'matchCount')::int = 1, 'R3 origen anulado: cae al reciente y no cuenta el anulado');
  update public.matches set status = 'pending_validation' where match_id = pg_temp._id('M_origen');
  perform set_config('v433.tok', v_tok, true);
end $$;

-- ================================ R4 / R5 : SOY YO, notificación y lotes recientes ================================
do $$
declare v jsonb; v_rec uuid; v_n int; v_pl jsonb; v_inviter_n int;
begin
  perform pg_temp._as('TGT');
  v := public.claim_provisional_player(current_setting('v433.tok'));
  perform pg_temp._assert((v->>'ok')::boolean, 'R4 SOY YO ok: ' || v::text);
  v_rec := (v->>'recoveryId')::uuid;

  select count(*) into v_n from public.notifications where type = 'identity_recovered' and player_id = pg_temp._id('TGT');
  perform pg_temp._assert(v_n = 1, 'R4 una notificación identity_recovered para el reclamante');
  select payload into v_pl from public.notifications where type = 'identity_recovered' and player_id = pg_temp._id('TGT');
  perform pg_temp._assert((v_pl->>'matchCount')::int = 2 and v_pl->>'sourceName' = 'Pedro' and (v_pl->>'recoveryId')::uuid = v_rec, 'R4 payload: ' || v_pl::text);
  perform pg_temp._assert(not exists (select 1 from public.notifications where type = 'identity_recovered' and player_id <> pg_temp._id('TGT')), 'R4 solo para el reclamante');
  select count(*) into v_inviter_n from public.notifications where type = 'identity_claimed' and player_id = pg_temp._id('SEBA');
  perform pg_temp._assert(v_inviter_n = 1, 'R4 la notificación al invitador se conserva');
  -- reintento idempotente: no duplica la notificación
  perform public.claim_provisional_player(current_setting('v433.tok'));
  perform pg_temp._assert((select count(*) from public.notifications where type = 'identity_recovered' and player_id = pg_temp._id('TGT')) = 1, 'R4 el reintento no duplica la notificación');
  -- get_notifications la devuelve (type persistido, sin match)
  perform pg_temp._assert(exists (select 1 from public.get_notifications(50, false) g where g.type = 'identity_recovered' and g.match_id is null), 'R4 get_notifications la entrega');

  -- R5: lotes recientes
  v := public.get_my_recent_recoveries(30);
  perform pg_temp._assert((v->>'ok')::boolean and jsonb_array_length(v->'recoveries') = 1, 'R5 un lote reciente: ' || v::text);
  perform pg_temp._assert(jsonb_array_length(v->'recoveries'->0->'matchIds') = 2 and v->'recoveries'->0->>'sourceName' = 'Pedro', 'R5 matchIds/sourceName');
  perform pg_temp._as('SEBA');
  perform pg_temp._assert(jsonb_array_length((public.get_my_recent_recoveries(30))->'recoveries') = 0, 'R5 solo el target ve el lote (el invitador no)');
  perform pg_temp._as('TGT');
  -- ventana vencida: el lote deja de listarse pero NO se borra nada
  update public.player_identity_recoveries set completed_at = now() - interval '31 days' where recovery_id = v_rec;
  perform pg_temp._assert(jsonb_array_length((public.get_my_recent_recoveries(30))->'recoveries') = 0, 'R5 vencida la ventana no se lista');
  perform pg_temp._assert(jsonb_array_length((public.get_my_recent_recoveries(60))->'recoveries') = 1, 'R5 el dato sigue intacto (otra ventana lo ve)');
  perform pg_temp._assert((select count(*) from public.match_participants where player_id = pg_temp._id('TGT')) = 2, 'R5 los partidos siguen en el historial');
end $$;

-- ================================ R6 : ACL ================================
do $$
begin
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.create_claim_link(uuid, uuid)', 'EXECUTE'), 'R6 create_claim_link: authenticated');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.create_claim_link(uuid, uuid)', 'EXECUTE'), 'R6 create_claim_link: no anon');
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.get_my_recent_recoveries(integer)', 'EXECUTE'), 'R6 get_my_recent_recoveries: authenticated');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.get_my_recent_recoveries(integer)', 'EXECUTE'), 'R6 get_my_recent_recoveries: no anon');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public._notify_target_identity_recovered()', 'EXECUTE'), 'R6 helper de trigger sin EXECUTE de cliente');
  perform pg_temp._assert(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_claim_link' and pg_get_function_arguments(p.oid) = 'p_provisional_player_id uuid'),
    'R6 no queda el overload viejo (llamada ambigua)');
end $$;

select 'V04.33 verify OK' as result;
rollback;
