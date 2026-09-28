-- BRAMUlab — Grupos BRAMU · cierre B1 (handoff 71 §A) — verificación transaccional del hotfix
-- 20260928140000_preprod_grupos_b1_membresia_semanal_hotfix.sql. Requiere Fase A + este hotfix
-- aplicados. No requiere cuentas reales (mismo patrón que verify-preprod-grupos-fase-a.sql:
-- fixtures propios en auth.users+players, termina en ROLLBACK).
--
-- ALCANCE: esto prueba SOLO lo que es responsabilidad del SQL — que el umbral de candidatos se
-- amplió (nunca excluye de más) y que permisos/RLS quedaron intactos tras el CREATE OR REPLACE.
-- El piso semanal EXACTO (lunes 00:00 local) y la decisión final de qué partido realmente cuenta
-- son autoridad exclusiva de groups.js — cubierto en
-- bramulab/groups-b1-cierre-membresia-baja.test.mjs (regla A, tests 1-6), no acá (no repetir
-- pruebas equivalentes, Método de trabajo). No repite tampoco el contrato general ya cubierto por
-- verify-preprod-grupos-fase-a.sql (RLS de tablas, CRUD, último admin, etc.).

begin;

create temporary table _h (k text primary key, v uuid) on commit drop;

create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._h where k = p_key)), true);
end $$;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$
  select v from pg_temp._h where k = p_key
$$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if;
end $$;

do $$
declare v_key text; v_uid uuid; v_pid uuid;
begin
  foreach v_key in array array['A','B','C'] loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, 'hf_' || lower(v_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
    insert into public.players (display_name, auth_user_id) values ('HF ' || v_key, v_uid) returning player_id into v_pid;
    insert into public.profiles (player_id, username, first_name, last_name, display_name)
      values (v_pid, 'hf_' || lower(v_key) || substr(v_uid::text, 1, 6), 'HF', v_key, 'HF ' || v_key);
    insert into pg_temp._h values (v_key, v_pid);
  end loop;
end $$;

-- Grupo G con A,B,C — C se agrega HACE 2 DÍAS (alta "reciente", dentro de la ventana ampliada de
-- 7 días pero fuera del umbral exacto anterior). D no existe: el partido usa solo 3 slots reales
-- + un cuarto jugador cualquiera (A de nuevo no puede, se reusa C dos veces no tiene sentido) —
-- se arma un partido de 3 miembros del grupo (A,B,C) + 1 jugador AJENO (E), que ya alcanza el
-- umbral de 3 sin ambigüedad: lo que se prueba acá es si C (alta reciente) CUENTA para ese
-- umbral, no si el cuarto jugador es del grupo.
do $$
declare v_e uuid; v_uid uuid;
begin
  v_uid := gen_random_uuid();
  insert into auth.users (id, email) values (v_uid, 'hf_e_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('HF E', v_uid) returning player_id into v_e;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_e, 'hf_e' || substr(v_uid::text, 1, 6), 'HF', 'E', 'HF E');
  insert into pg_temp._h values ('E', v_e);
end $$;

select pg_temp._as('A');
do $$
declare v jsonb;
begin
  v := public.create_group('Hotfix G', array[pg_temp._id('B'), pg_temp._id('C')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture create_group: ' || v::text);
  insert into pg_temp._h values ('G', (v->'group'->>'groupId')::uuid);
  -- A y B, miembros "de siempre"; C se agregó hace 2 días (alta reciente, PRE-hotfix el umbral
  -- exacto lo habría excluido de cualquier partido jugado antes de ese instante).
  update public.group_memberships set joined_at = now() - interval '30 days'
    where group_id = pg_temp._id('G') and player_id in (pg_temp._id('A'), pg_temp._id('B'));
  update public.group_memberships set joined_at = now() - interval '2 days'
    where group_id = pg_temp._id('G') and player_id = pg_temp._id('C');
end $$;

create or replace function pg_temp._mk_match(p_tag text, p_played timestamptz) returns uuid language plpgsql as $$
declare v_match uuid; v_rev uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, winner_team,
                              validation_deadline_at, validated_at)
    values (pg_temp._id('A'), 'grp-hf-' || p_tag, 'classic', p_played, 'validated', 'A', now() + interval '13 days', now())
    returning match_id into v_match;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match, 'A', 1, pg_temp._id('A'), 'A'), (v_match, 'A', 2, pg_temp._id('B'), 'B'),
    (v_match, 'B', 1, pg_temp._id('C'), 'C'), (v_match, 'B', 2, pg_temp._id('E'), 'E');
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match, 1, pg_temp._id('A'), 'A', 'created', p_played) returning revision_id into v_rev;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_match, 1, 1, 6, 4), (v_match, 1, 2, 6, 3);
  update public.matches set current_revision_id = v_rev where match_id = v_match;
  insert into pg_temp._h values ('M_' || p_tag, v_match);
  return v_match;
end $$;

do $$
begin
  -- M_recent: jugado hace 1 día — DESPUÉS del alta de C (hace 2 días). Ya contaba 3/4 (A,B,C)
  -- incluso con el umbral exacto viejo: control (debe seguir siendo candidato con o sin hotfix).
  perform pg_temp._mk_match('recent', now() - interval '1 day');
  -- M_before: jugado hace 4 días — ANTES del alta exacta de C (hace 2 días), pero DENTRO de la
  -- ventana ampliada de 7 días. Con el umbral viejo (exacto) NO era candidato (solo A,B = 2).
  -- Con el hotfix, SÍ debe serlo (A,B,C = 3) — es justo la ampliación que existe para nunca
  -- excluir de más lo que groups.js podría considerar válido según el piso semanal real.
  perform pg_temp._mk_match('before', now() - interval '4 days');
  -- M_old: jugado hace 9 días — fuera incluso de la ventana ampliada de 7 días. Debe seguir
  -- excluido (control negativo: la ampliación tiene un límite, no es "todo cuenta siempre").
  perform pg_temp._mk_match('old', now() - interval '9 days');
end $$;

do $$
declare res jsonb; ids text[];
begin
  res := public.get_group_competition_data(pg_temp._id('G'));
  perform pg_temp._assert((res->>'ok')::boolean, 'lectura ok: ' || res);
  select array_agg(m->>'matchId' order by m->>'matchId') into ids from jsonb_array_elements(res->'matches') m;
  perform pg_temp._assert(ids = (select array_agg(x::text order by x::text) from unnest(array[pg_temp._id('M_recent'), pg_temp._id('M_before')]) x),
    'hotfix: M_recent y M_before candidatos, M_old fuera de la ventana ampliada: ' || coalesce(ids::text, 'null'));

  -- isGroupMember de C (alta reciente) refleja el mismo umbral ampliado en M_before.
  perform pg_temp._assert(
    (select (p->>'isGroupMember')::boolean from jsonb_array_elements(
      (select m from jsonb_array_elements(res->'matches') m where m->>'matchId' = pg_temp._id('M_before')::text)->'players'
    ) p where p->>'playerId' = pg_temp._id('C')::text),
    'isGroupMember de C refleja el umbral ampliado en M_before');
end $$;

-- Permisos: el CREATE OR REPLACE del hotfix no debe haber ampliado ni perdido grants.
do $$
begin
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.get_group_competition_data(uuid, timestamptz, timestamptz)', 'execute'), 'authenticated conserva EXECUTE');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.get_group_competition_data(uuid, timestamptz, timestamptz)', 'execute'), 'anon sigue sin EXECUTE');
end $$;

select 'GRUPOS_B1_MEMBRESIA_SEMANAL_HOTFIX_VERIFY_PASS' as result;

rollback;
