-- BRAMUlab — V04.40 · Ronda 2 — verificación transaccional segura de 20261009120000_discovery_get_player_discovery.sql
-- (Supabase STAGING). Requiere las migraciones aplicadas y al menos UNA cuenta real con sesión (auth_user_id no nulo, perfil
-- con username), igual que los verify-preprod-ux-*. No deja fixtures: todo ocurre entre BEGIN/ROLLBACK.
--
-- Cubre: A) conexión indirecta real (y solo ella)  B) pendiente/anulado NO conecta  C) exclusiones (provisional, inactivo,
-- sin username, ya guardado)  D) zona por location_id  E) sin duplicados entre secciones  F) columnas exactas (sin partido ni
-- intermediario)  G) permisos (authenticated sí; anon no)  H) sin sesión de jugador -> no_player_for_session.

begin;

create temporary table _gpd_caller on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl join public.profiles pr using (player_id)
where pl.auth_user_id is not null and pr.username is not null
order by pr.created_at limit 1;

do $$ begin
  if (select count(*) from _gpd_caller) <> 1 then raise exception 'verify_discovery_requires_one_registered_account_with_session'; end if;
end $$;

create temporary table _gpd (k text primary key, v uuid) on commit drop;

-- Fixtures: J (compartió partido oficial con el caller), P/X (compartieron partido oficial con J, nunca con el caller),
-- Q (solo partido PENDIENTE con J), Z (misma localidad que el caller, sin partidos), I (inactivo), N (sin username), S (provisional).
do $$
declare
  v_caller uuid := (select player_id from _gpd_caller);
  v_loc uuid;
  j uuid; r uuid; p uuid; x uuid; q uuid; z uuid; i uuid; n uuid; s uuid; m uuid;
  v_i integer;
begin
  insert into public.locations (source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
    values ('georef', 'gpd_prov', 'gpd_loc_' || gen_random_uuid()::text, 'GPD', 'GPD Localidad', 'GPD Localidad, GPD', true) returning location_id into v_loc;
  update public.profiles set location_id = v_loc where player_id = v_caller;

  for v_i in 1..9 loop
    insert into public.players (display_name, type) values ('GPD ' || v_i, case when v_i = 9 then 'provisional' else 'registered' end)
      returning player_id into m;
    insert into _gpd values ((array['j','r','p','x','q','z','i','n','s'])[v_i], m);
    if v_i <> 9 then
      insert into public.profiles (player_id, username, first_name, last_name, display_name, location_id)
        values (m, case when v_i = 8 then null else 'gpd_' || (array['j','r','p','x','q','z','i','n'])[v_i] end, 'GPD', v_i::text, 'GPD ' || v_i,
                case when v_i = 6 then v_loc else null end);
    end if;
  end loop;
  update public.players set is_active = false where player_id = (select v from _gpd where k = 'i');

  select v into j from _gpd where k = 'j'; select v into r from _gpd where k = 'r'; select v into p from _gpd where k = 'p';
  select v into x from _gpd where k = 'x'; select v into q from _gpd where k = 'q';

  -- partido oficial: caller + J vs R + (relleno)
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, validated_at, validation_deadline_at)
    values (v_caller, 'gpd-1', 'classic', now() - interval '2 days', 'validated', now(), now() + interval '30 days') returning match_id into m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (m, 'A', 1, v_caller, 'Yo'), (m, 'A', 2, j, 'J'), (m, 'B', 1, r, 'R'), (m, 'B', 2, (select v from _gpd where k = 'z'), 'Z');
  -- partido oficial: J + P vs X + (relleno)  -> P y X son conexiones indirectas del caller
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, validated_at, validation_deadline_at)
    values (j, 'gpd-2', 'classic', now() - interval '3 days', 'validated', now(), now() + interval '30 days') returning match_id into m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (m, 'A', 1, j, 'J'), (m, 'A', 2, p, 'P'), (m, 'B', 1, x, 'X'), (m, 'B', 2, (select v from _gpd where k = 'i'), 'I');
  -- partido PENDIENTE: J + Q ... (Q no debe conectar) ; con N (sin username) y S (provisional) en un partido oficial de J
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, validation_deadline_at)
    values (j, 'gpd-3', 'classic', now() - interval '1 day', 'pending_validation', now() + interval '30 days') returning match_id into m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (m, 'A', 1, j, 'J'), (m, 'A', 2, q, 'Q'), (m, 'B', 1, r, 'R'), (m, 'B', 2, p, 'P');
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, validated_at, validation_deadline_at)
    values (j, 'gpd-4', 'classic', now() - interval '4 days', 'validated', now(), now() + interval '30 days') returning match_id into m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (m, 'A', 1, j, 'J'), (m, 'A', 2, (select v from _gpd where k = 'n'), 'N'), (m, 'B', 1, (select v from _gpd where k = 'r'), 'R'), (m, 'B', 2, (select v from _gpd where k = 's'), 'S');
end $$;

select set_config('request.jwt.claim.sub', (select auth_user_id::text from _gpd_caller), true);

-- A/B/C/D/E/F
do $$
declare
  v_conn uuid[]; v_zone uuid[];
  g record;
begin
  select coalesce(array_agg(player_id), '{}') into v_conn from public.get_player_discovery() where section = 'connections';
  select coalesce(array_agg(player_id), '{}') into v_zone from public.get_player_discovery() where section = 'zone';

  if not ((select v from _gpd where k = 'p') = any (v_conn)) then raise exception 'A_FAILED_P_should_be_indirect_connection'; end if;
  if not ((select v from _gpd where k = 'x') = any (v_conn)) then raise exception 'A_FAILED_X_should_be_indirect_connection'; end if;
  if (select v from _gpd where k = 'j') = any (v_conn) or (select v from _gpd where k = 'r') = any (v_conn) then raise exception 'A_FAILED_direct_players_must_not_be_suggested'; end if;
  if (select player_id from _gpd_caller) = any (v_conn || v_zone) then raise exception 'A_FAILED_caller_must_not_appear'; end if;
  if (select v from _gpd where k = 'q') = any (v_conn) then raise exception 'B_FAILED_pending_match_must_not_connect'; end if;
  if (select v from _gpd where k = 'i') = any (v_conn || v_zone) then raise exception 'C_FAILED_inactive_must_be_excluded'; end if;
  if (select v from _gpd where k = 'n') = any (v_conn || v_zone) then raise exception 'C_FAILED_without_username_must_be_excluded'; end if;
  if (select v from _gpd where k = 's') = any (v_conn || v_zone) then raise exception 'C_FAILED_provisional_must_be_excluded'; end if;
  -- Z es DIRECTO (jugó con el caller) pero misma localidad: puede aparecer en la zona, nunca en conexiones
  if (select v from _gpd where k = 'z') = any (v_conn) then raise exception 'A_FAILED_direct_player_in_connections'; end if;
  if not ((select v from _gpd where k = 'z') = any (v_zone)) then raise exception 'D_FAILED_same_location_player_missing_from_zone'; end if;
  if v_conn && v_zone then raise exception 'E_FAILED_duplicate_between_sections'; end if;

  for g in select * from public.get_player_discovery() limit 1 loop
    if to_jsonb(g) ?| array['match_id','played_at','team','via','mutuals'] then raise exception 'F_FAILED_leaks_match_data'; end if;
  end loop;
end $$;

-- G) permisos
do $$ begin
  if not has_function_privilege('authenticated', 'public.get_player_discovery(integer)', 'execute') then raise exception 'G_FAILED_not_executable_by_authenticated'; end if;
  if has_function_privilege('anon', 'public.get_player_discovery(integer)', 'execute') then raise exception 'G_FAILED_executable_by_anon'; end if;
end $$;

-- C) guardado: se retira del resultado
insert into public.player_saved_players (owner_player_id, saved_player_id) select player_id, (select v from _gpd where k = 'p') from _gpd_caller;
do $$ begin
  if (select v from _gpd where k = 'p') = any (select player_id from public.get_player_discovery()) then raise exception 'C_FAILED_saved_player_must_be_excluded'; end if;
end $$;

-- H) sin jugador asociado a la sesión
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$ begin
  begin
    perform * from public.get_player_discovery();
    raise exception 'H_FAILED_expected_no_player_for_session';
  exception when others then
    if sqlerrm <> 'no_player_for_session' then raise; end if;
  end;
end $$;

rollback;
