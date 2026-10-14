-- BRAMUlab — V04.41: verificación transaccional de 20261014190000 (get_invitation_card, vista previa de WhatsApp con el partido real).
-- Fixtures propios, termina en ROLLBACK. Ejecutable en Staging real (SQL editor) y en PGlite (verify-clean-room.mjs).
--
--  C1  token válido → {ok, teams[2]}: la pareja de la identidad invitada PRIMERO, nombres en orden, games por set de ESA pareja
--  C2  payload MÍNIMO: solo ok/teams/names/sets; sin ids, usuario, avatar, fecha, lugar, estado, token ni hash
--  C3  cualquier fallo devuelve EXACTAMENTE {ok:false} (mal formado, desconocido, rotado, usado, vencido, partido anulado) — sin oráculo
--  C4  link sin origen cae al partido más reciente; origen anulado cae al más reciente
--  C5  ACL: ejecutable por anon; PUBLIC y authenticated no; tras SOY YO el enlace consumido deja de mostrar datos
--  C6  un anon real (rol anon) puede llamarla y NO puede leer las tablas

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
    values (v_uid, 'c41_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test', now(), '{"legal_version":"legal_v1"}'::jsonb);
  select player_id into v_pid from public.players where auth_user_id = v_uid;
  update public.players set display_name = p_name where player_id = v_pid;
  update public.profiles set username = 'c41_' || lower(p_key) || substr(v_uid::text, 1, 5), first_name = p_name, last_name = 'C41', display_name = p_name where player_id = v_pid;
  insert into pg_temp._t values (p_key, v_pid);
end $$;
create or replace function pg_temp._prov(p_key text, p_creator text, p_name text) returns void language plpgsql as $$
declare v_pid uuid;
begin
  insert into public.players (type, display_name, created_by_player_id) values ('provisional', p_name, pg_temp._id(p_creator)) returning player_id into v_pid;
  insert into pg_temp._t values (p_key, v_pid);
end $$;
-- partido con Team A = (a1,a2), Team B = (b1,b2) y los sets indicados (games A / games B por set)
create or replace function pg_temp._match(p_tag text, p_creator text, p_a1 text, p_a2 text, p_b1 text, p_b2 text, p_ga int[], p_gb int[]) returns uuid language plpgsql as $$
declare v_m uuid; v_rev uuid; i int;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, action_side, validation_deadline_at)
    values (pg_temp._id(p_creator), 'c41-seed-' || p_tag, 'classic', now() - interval '2 days', 'pending_validation', 'B', now() + interval '20 days') returning match_id into v_m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_m, 'A', 1, pg_temp._id(p_a1), (select display_name from public.players where player_id = pg_temp._id(p_a1))),
    (v_m, 'A', 2, pg_temp._id(p_a2), (select display_name from public.players where player_id = pg_temp._id(p_a2))),
    (v_m, 'B', 1, pg_temp._id(p_b1), (select display_name from public.players where player_id = pg_temp._id(p_b1))),
    (v_m, 'B', 2, pg_temp._id(p_b2), (select display_name from public.players where player_id = pg_temp._id(p_b2)));
  perform public._bloque6_refresh_participant_fingerprint(v_m);
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_m, 1, pg_temp._id(p_creator), 'A', 'created', now() - interval '2 days') returning revision_id into v_rev;
  for i in 1 .. array_length(p_ga, 1) loop
    insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_m, 1, i, p_ga[i], p_gb[i]);
  end loop;
  update public.matches set current_revision_id = v_rev where match_id = v_m;
  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id) values (v_m, 'created', pg_temp._id(p_creator), 'A', v_rev);
  insert into pg_temp._t values ('M_' || p_tag, v_m);
  return v_m;
end $$;

do $$ begin
  insert into public.app_config (id, environment) values (1, 'staging') on conflict do nothing;
  perform pg_temp._mk('SEBA', 'Seba'); perform pg_temp._mk('MARCOS', 'Marcos'); perform pg_temp._mk('ESTEBAN', 'Esteban'); perform pg_temp._mk('MATU', 'Matu');
  perform pg_temp._mk('TGT', 'Pedro Real');
  perform pg_temp._prov('REMERA', 'SEBA', 'Remera celeste');
  -- ORIGEN: Team A = Marcos + Seba, Team B = Remera celeste + Esteban  → el invitado juega en Team B: 4-6 6-3 4-6 (A gana 6-4 3-6 6-4)
  perform pg_temp._match('origen', 'SEBA', 'MARCOS', 'SEBA', 'REMERA', 'ESTEBAN', array[6, 3, 6], array[4, 6, 4]);
  -- RECIENTE: sin origen explícito; el invitado en Team A
  perform pg_temp._match('reciente', 'SEBA', 'REMERA', 'SEBA', 'ESTEBAN', 'MATU', array[6, 6], array[1, 2]);
  update public.matches set played_at = now() - interval '9 days' where match_id = pg_temp._id('M_origen');
  update public.matches set played_at = now() - interval '1 day' where match_id = pg_temp._id('M_reciente');
end $$;

do $$
declare v_tok text; v_tok_old text; v jsonb; v_none jsonb := '{"ok": false}'::jsonb; v_id text;
begin
  perform pg_temp._as('SEBA');
  v_tok := public.create_claim_link(pg_temp._id('REMERA'), pg_temp._id('M_origen'));

  -- C1: pareja invitada primero (Team B del origen) con SUS games por set
  v := public.get_invitation_card(v_tok);
  perform pg_temp._assert((v->>'ok')::boolean and jsonb_array_length(v->'teams') = 2, 'C1 ok + dos parejas: ' || v::text);
  perform pg_temp._assert(v->'teams'->0->'names' = '["Remera celeste", "Esteban"]'::jsonb, 'C1 pareja invitada primero, nombres por posición: ' || (v->'teams'->0->'names')::text);
  perform pg_temp._assert(v->'teams'->1->'names' = '["Marcos", "Seba"]'::jsonb, 'C1 pareja rival después: ' || (v->'teams'->1->'names')::text);
  perform pg_temp._assert(v->'teams'->0->'sets' = '[4, 6, 4]'::jsonb and v->'teams'->1->'sets' = '[6, 3, 6]'::jsonb, 'C1 games por set de cada pareja (reales): ' || (v->'teams')::text);

  -- C2: payload mínimo
  perform pg_temp._assert((select array_agg(k order by k) from jsonb_object_keys(v) k) = array['ok', 'teams'], 'C2 claves de primer nivel');
  perform pg_temp._assert((select bool_and((select array_agg(k order by k) from jsonb_object_keys(t) k) = array['names', 'sets']) from jsonb_array_elements(v->'teams') t), 'C2 claves por pareja');
  for v_id in select v::text loop
    perform pg_temp._assert(v_id !~* '(token|hash|created_by|username|avatar|played|location|status|valid)', 'C2 sin metadatos: ' || v_id);
    perform pg_temp._assert(v_id !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'C2 sin ningún uuid');
    perform pg_temp._assert(position(v_tok in v_id) = 0, 'C2 el token no vuelve en la respuesta');
  end loop;

  -- C3: todos los fallos son EXACTAMENTE {ok:false}
  perform pg_temp._assert(public.get_invitation_card(null) = v_none, 'C3 null');
  perform pg_temp._assert(public.get_invitation_card('') = v_none, 'C3 vacío');
  perform pg_temp._assert(public.get_invitation_card('abc') = v_none, 'C3 mal formado');
  perform pg_temp._assert(public.get_invitation_card(upper(v_tok)) = v_none, 'C3 mayúsculas (formato estricto)');
  perform pg_temp._assert(public.get_invitation_card(repeat('0', 64)) = v_none, 'C3 desconocido');
  v_tok_old := v_tok;
  v_tok := public.create_claim_link(pg_temp._id('REMERA'), pg_temp._id('M_origen'));   -- rota: el anterior queda revocado
  perform pg_temp._assert(public.get_invitation_card(v_tok_old) = v_none, 'C3 rotado/revocado');
  perform pg_temp._assert((public.get_invitation_card(v_tok)->>'ok')::boolean, 'C3 el nuevo sí responde');
  update public.provisional_claims set expires_at = now() - interval '1 minute' where token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex');
  perform pg_temp._assert(public.get_invitation_card(v_tok) = v_none, 'C3 vencido');
  update public.provisional_claims set expires_at = now() + interval '10 days' where token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex');
  update public.matches set status = 'annulled' where match_id = pg_temp._id('M_origen');
  -- C4: origen anulado → cae al más reciente (el invitado en Team A: 6-1 6-2)
  v := public.get_invitation_card(v_tok);
  perform pg_temp._assert((v->>'ok')::boolean and v->'teams'->0->'names' = '["Remera celeste", "Seba"]'::jsonb and v->'teams'->0->'sets' = '[6, 6]'::jsonb, 'C4 origen anulado cae al reciente: ' || v::text);
  update public.matches set status = 'annulled' where match_id = pg_temp._id('M_reciente');
  perform pg_temp._assert(public.get_invitation_card(v_tok) = v_none, 'C3 sin ningún partido vigente');
  update public.matches set status = 'pending_validation' where match_id in (pg_temp._id('M_origen'), pg_temp._id('M_reciente'));
  -- C4: link sin origen → más reciente
  v_tok_old := public.create_claim_link(pg_temp._id('REMERA'));
  v := public.get_invitation_card(v_tok_old);
  perform pg_temp._assert(v->'teams'->0->'sets' = '[6, 6]'::jsonb, 'C4 sin origen cae al más reciente: ' || v::text);
  v_tok := public.create_claim_link(pg_temp._id('REMERA'), pg_temp._id('M_origen'));
  perform set_config('v441.tok', v_tok, true);
end $$;

-- C5: SOY YO consume el enlace → deja de mostrar datos
do $$
declare v_tok text := current_setting('v441.tok'); v jsonb;
begin
  perform pg_temp._as('TGT');
  v := public.claim_provisional_player(v_tok);
  perform pg_temp._assert((v->>'ok')::boolean, 'C5 SOY YO ok: ' || v::text);
  perform pg_temp._assert(public.get_invitation_card(v_tok) = '{"ok": false}'::jsonb, 'C5 enlace consumido ya no muestra el partido');
end $$;

-- C5/C6: ACL y rol anon real
do $$
begin
  perform pg_temp._assert(has_function_privilege('anon', 'public.get_invitation_card(text)', 'EXECUTE'), 'C5 anon ejecuta');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public.get_invitation_card(text)', 'EXECUTE'), 'C5 authenticated no');
  perform pg_temp._assert(not has_function_privilege('public', 'public.get_invitation_card(text)', 'EXECUTE'), 'C5 PUBLIC no');
end $$;
set local role anon;
do $$
declare v jsonb; v_n int;
begin
  v := public.get_invitation_card(repeat('0', 64));
  if v <> '{"ok": false}'::jsonb then raise exception 'ASSERT_FAILED: C6 anon real: %', v; end if;
  begin
    select count(*) into v_n from public.provisional_claims;
    raise exception 'ASSERT_FAILED: C6 anon no debería leer provisional_claims';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into v_n from public.match_sets;
    raise exception 'ASSERT_FAILED: C6 anon no debería leer match_sets';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'V04.41 verify OK' as result;
rollback;
