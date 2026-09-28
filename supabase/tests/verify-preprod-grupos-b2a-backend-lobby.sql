-- BRAMUlab — Grupos BRAMU B2a: verificación transaccional de
-- 20260928190000_preprod_grupos_b2a_backend_lobby.sql. Requiere Fase A + hotfix de membresía
-- semanal (B1) + esta migración aplicados. No requiere cuentas reales: crea sus propios fixtures
-- (auth.users+players+profiles) y termina en ROLLBACK. No repite la cobertura amplia ya
-- verificada por verify-preprod-grupos-fase-a.sql/verify-preprod-grupos-b1-membresia-semanal-
-- hotfix.sql — Central debe re-correr ambos después de aplicar esta migración (test #15, no
-- reproducible acá sin duplicar esos archivos; en su lugar, T-consistencia abajo prueba
-- directamente que el refactor no forkeó el comportamiento de get_group_competition_data).
--
-- Cubre los 15 tests del handoff 75 §7:
--  T1  solo mis grupos activos               T9  'validated' mueve lastActivityAt
--  T2  1/2/3+ miembros                        T10 'correction_accepted' calificable mueve actividad
--  T3  payload de membresías/períodos         T11 corrección/partido NO calificable no mueve nada
--  T4  semana trae candidatos (compat B1)     T12 member add/remove/reentry/admin/rename/creación
--  T5  alta misma semana no excluye           T13 orden final + empate estable
--  T6  alta de semana posterior no habilita   T14 caller ajeno no obtiene el grupo
--  T7  2/4 no produce actividad deportiva     T15 (ver nota arriba) T-consistencia con Fase A
--  T8  3/4 sí produce actividad
--
-- + microfix frontera semanal (handoff 77, 28/09/2026) — "T-borde", antes de Permisos:
-- _groups_week_start_ba contra instantes conocidos (mismos que groups-b2a-frontera-semanal-
-- ba.test.mjs del lado JS); domingo anterior a la semana del alta NO califica (el bug real que
-- corrige este handoff: antes usaba el umbral amplio de 7 días como si fuera exacto); mismo
-- lunes antes de la hora exacta del alta SÍ califica; alta domingo + partido lunes de esa misma
-- semana SÍ califica; validated/correction_accepted sobre el partido no calificable no mueven
-- lastActivityAt; correction_accepted sobre el partido sí calificable sí lo mueve.

begin;

create temporary table _b2a (k text primary key, v uuid) on commit drop;

create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._b2a where k = p_key)), true);
end $$;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$
  select v from pg_temp._b2a where k = p_key
$$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if;
end $$;

-- ---------- Fixtures: jugadores A..F (registrados con sesión) ----------
do $$
declare v_key text; v_uid uuid; v_pid uuid;
begin
  foreach v_key in array array['A','B','C','D','E','F'] loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, 'b2a_' || lower(v_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
    insert into public.players (display_name, auth_user_id) values ('B2A ' || v_key, v_uid) returning player_id into v_pid;
    insert into public.profiles (player_id, username, first_name, last_name, display_name)
      values (v_pid, 'b2a_' || lower(v_key) || substr(v_uid::text, 1, 6), 'B2A', v_key, 'B2A ' || v_key);
    insert into pg_temp._b2a values (v_key, v_pid);
  end loop;
end $$;

-- ---------- T1/T2/T14 — 3 grupos: G1 (1 miembro: A), G2 (2: A,B), G3 (3: A,B,C). F ajeno a todos. ----------
select pg_temp._as('A');
do $$
declare v jsonb;
begin
  v := public.create_group('B2A Solo', '{}');
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G1: ' || v::text);
  insert into pg_temp._b2a values ('G1', (v->'group'->>'groupId')::uuid);

  v := public.create_group('B2A Dos', array[pg_temp._id('B')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G2: ' || v::text);
  insert into pg_temp._b2a values ('G2', (v->'group'->>'groupId')::uuid);

  v := public.create_group('B2A Tres', array[pg_temp._id('B'), pg_temp._id('C')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G3: ' || v::text);
  insert into pg_temp._b2a values ('G3', (v->'group'->>'groupId')::uuid);

  -- Membresías "de siempre" salvo donde el test necesite un alta puntual (T5/T6).
  update public.group_memberships set joined_at = now() - interval '60 days'
    where group_id in (pg_temp._id('G1'), pg_temp._id('G2'), pg_temp._id('G3'));
end $$;

-- ---------- Helper de partido validado ----------
create or replace function pg_temp._mk_match(
  p_tag text, p_a1 text, p_a2 text, p_b1 text, p_b2 text, p_played timestamptz, p_winner text
) returns uuid language plpgsql as $$
declare v_match uuid; v_rev uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, winner_team,
                              validation_deadline_at, validated_at)
    values (pg_temp._id(p_a1), 'b2a-fp-' || p_tag, 'classic', p_played, 'validated', p_winner,
            now() + interval '13 days', now())
    returning match_id into v_match;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match, 'A', 1, pg_temp._id(p_a1), p_a1), (v_match, 'A', 2, pg_temp._id(p_a2), p_a2),
    (v_match, 'B', 1, pg_temp._id(p_b1), p_b1), (v_match, 'B', 2, pg_temp._id(p_b2), p_b2);
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match, 1, pg_temp._id(p_a1), 'A', 'created', p_played) returning revision_id into v_rev;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_match, 1, 1, 6, 4), (v_match, 1, 2, 6, 3);
  update public.matches set current_revision_id = v_rev where match_id = v_match;
  insert into public.match_actions (match_id, action_type, actor_player_id, revision_id, occurred_at)
    values (v_match, 'validated', pg_temp._id(p_a1), v_rev, now());
  insert into pg_temp._b2a values ('M_' || p_tag, v_match);
  return v_match;
end $$;

-- M_g3: partido real de G3 (A,B,C = 3 miembros; D ajeno), semana actual.
-- M_g2: partido con 2 miembros de G2 (A,B) + 2 ajenos (D,E) -> nunca puede llegar a 3/4 en G2.
-- M_prev: mismo elenco que M_g3 pero de la SEMANA PASADA (control T6).
do $$
begin
  perform pg_temp._mk_match('g3', 'A', 'B', 'C', 'D', date_trunc('week', now()) + interval '1 day 10 hours', 'A');
  perform pg_temp._mk_match('g2', 'A', 'B', 'D', 'E', date_trunc('week', now()) + interval '1 day 11 hours', 'A');
  perform pg_temp._mk_match('prev', 'A', 'B', 'D', 'E', date_trunc('week', now()) - interval '6 days 10 hours', 'A');
end $$;

-- ---------- T1: solo mis grupos activos ----------
select pg_temp._as('A');
do $$
declare lobby jsonb; ids text[];
begin
  lobby := public.get_groups_lobby(null, null);
  perform pg_temp._assert((lobby->>'ok')::boolean, 'T1 lobby ok: ' || lobby::text);
  select array_agg(g->>'groupId' order by g->>'groupId') into ids from jsonb_array_elements(lobby->'groups') g;
  perform pg_temp._assert(ids = (select array_agg(x::text order by x::text) from unnest(array[pg_temp._id('G1'), pg_temp._id('G2'), pg_temp._id('G3')]) x),
    'T1 A ve exactamente sus 3 grupos: ' || coalesce(ids::text, 'null'));
end $$;

-- ---------- T2 + T3: 1/2/3+ miembros, payload de membresías/períodos ----------
do $$
declare lobby jsonb; g1 jsonb; g2 jsonb; g3 jsonb;
begin
  lobby := public.get_groups_lobby(null, null);
  select g into g1 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G1')::text;
  select g into g2 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G2')::text;
  select g into g3 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G3')::text;
  perform pg_temp._assert((g1->>'activeMemberCount')::int = 1, 'T2 G1 = 1 miembro');
  perform pg_temp._assert((g2->>'activeMemberCount')::int = 2, 'T2 G2 = 2 miembros');
  perform pg_temp._assert((g3->>'activeMemberCount')::int = 3, 'T2 G3 = 3 miembros');
  perform pg_temp._assert((g1->>'isAdmin')::boolean, 'T2 A es admin de su propio grupo');
  -- T3: payload de membresías/períodos.
  perform pg_temp._assert(jsonb_array_length(g3->'members') = 3, 'T3 G3.members trae 3 filas');
  perform pg_temp._assert(exists (
    select 1 from jsonb_array_elements(g3->'members') m
    where m->>'playerId' = pg_temp._id('C')::text and (m->>'isActive')::boolean
      and jsonb_array_length(m->'periods') = 1 and (m->'periods'->0->>'leftAt') is null
  ), 'T3 período de C bien formado (joinedAt/leftAt)');
end $$;

-- ---------- T4 + T5 + T6: candidatos de la semana, alta misma semana, sin retroactividad ----------
do $$
declare lobby jsonb; g3 jsonb; ids text[]; weekFrom timestamptz; weekTo timestamptz;
begin
  weekFrom := date_trunc('week', now());
  weekTo := weekFrom + interval '7 days';
  lobby := public.get_groups_lobby(weekFrom, weekTo);
  select g into g3 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G3')::text;
  select array_agg(m->>'matchId') into ids from jsonb_array_elements(g3->'weekMatches') m;
  perform pg_temp._assert(ids = array[pg_temp._id('M_g3')::text], 'T4 weekMatches trae M_g3, no M_prev: ' || coalesce(ids::text, 'null'));

  -- T5: D se agrega a G3 a mitad de ESTA semana, DESPUÉS de M_g3 (que ya jugó D real, ajeno al
  -- grupo hasta ahora) -> el candidato de M_g3 debe seguir siéndolo (ya era 3/4 con A,B,C; esto
  -- además prueba que agregar a D no lo excluye ni lo duplica).
  perform public.add_group_member(pg_temp._id('G3'), pg_temp._id('D'));
  lobby := public.get_groups_lobby(weekFrom, weekTo);
  select g into g3 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G3')::text;
  perform pg_temp._assert(
    jsonb_array_length(g3->'weekMatches') = 2
    and exists (select 1 from jsonb_array_elements(g3->'weekMatches') m where m->>'matchId' = pg_temp._id('M_g3')::text)
    and exists (select 1 from jsonb_array_elements(g3->'weekMatches') m where m->>'matchId' = pg_temp._id('M_g2')::text),
    'T5 alta de D convierte M_g2 de 2/4 a 3/4 en ESTA semana y conserva M_g3'
  );
  perform pg_temp._assert((
    select (p->>'isGroupMember')::boolean from jsonb_array_elements(
      (select m from jsonb_array_elements(g3->'weekMatches') m where m->>'matchId' = pg_temp._id('M_g3')::text)->'players'
    ) p where p->>'playerId' = pg_temp._id('D')::text
  ), 'T5 isGroupMember de D ahora true (piso semanal ampliado)');

  -- T6: el mismo alta de D NO vuelve calificable un 2/4 de la semana anterior.
  -- weekMatches es deliberadamente un transporte AMPLIO y puede traer falsos positivos; la
  -- afirmación deportiva exacta se prueba sobre el helper exacto que gobierna lastActivityAt.
  perform pg_temp._assert(not exists (
    select 1 from public._groups_candidate_matches_exact(
      pg_temp._id('G3'), weekFrom - interval '7 days', weekFrom
    ) cm where cm.match_id = pg_temp._id('M_prev')
  ), 'T6 alta actual NO habilita M_prev de la semana anterior');
end $$;

-- ---------- T7 + T8: 2/4 no produce actividad; 3/4 sí ----------
do $$
declare before2 timestamptz; after2 timestamptz; before3 timestamptz; after3 timestamptz; lobby jsonb;
begin
  lobby := public.get_groups_lobby(null, null);
  select (g->>'lastActivityAt')::timestamptz into before2 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G2')::text;
  select (g->>'lastActivityAt')::timestamptz into before3 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G3')::text;

  -- T7: M_g2 (2/4 en G2) ya tiene un match_actions 'validated' desde su creación (_mk_match) —
  -- si YA hubiera movido lastActivityAt, before2 sería posterior a la creación del grupo; en
  -- cambio, un 'validated' NUEVO de M_g2 tampoco debe mover nada (partido no calificable).
  insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at)
    values (pg_temp._id('M_g2'), 'validated', pg_temp._id('A'), clock_timestamp());
  lobby := public.get_groups_lobby(null, null);
  select (g->>'lastActivityAt')::timestamptz into after2 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G2')::text;
  perform pg_temp._assert(after2 = before2, 'T7 partido 2/4 no mueve lastActivityAt de G2');

  -- T8: un 'validated' NUEVO de M_g3 (partido 3/4 real de G3) SÍ mueve lastActivityAt.
  insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at)
    values (pg_temp._id('M_g3'), 'validated', pg_temp._id('A'), clock_timestamp());
  lobby := public.get_groups_lobby(null, null);
  select (g->>'lastActivityAt')::timestamptz into after3 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G3')::text;
  perform pg_temp._assert(after3 > before3, 'T8/T9 partido 3/4 validated mueve lastActivityAt de G3: before=% after=%', before3, after3);
end $$;

-- ---------- T10 + T11: correction_accepted calificable mueve; no calificable no mueve ----------
do $$
declare before3 timestamptz; after3 timestamptz; before2 timestamptz; after2 timestamptz; lobby jsonb;
begin
  lobby := public.get_groups_lobby(null, null);
  select (g->>'lastActivityAt')::timestamptz into before3 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G3')::text;
  select (g->>'lastActivityAt')::timestamptz into before2 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G2')::text;

  insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at)
    values (pg_temp._id('M_g3'), 'correction_accepted', pg_temp._id('B'), clock_timestamp());
  insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at)
    values (pg_temp._id('M_g2'), 'correction_accepted', pg_temp._id('B'), clock_timestamp());

  lobby := public.get_groups_lobby(null, null);
  select (g->>'lastActivityAt')::timestamptz into after3 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G3')::text;
  select (g->>'lastActivityAt')::timestamptz into after2 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G2')::text;
  perform pg_temp._assert(after3 > before3, 'T10 correction_accepted calificable mueve lastActivityAt de G3');
  perform pg_temp._assert(after2 = before2, 'T11 correction_accepted NO calificable no mueve lastActivityAt de G2');
end $$;

-- ---------- T12: member add/remove/reentry, admin, rename y creación mueven actividad ----------
do $$
declare t0 timestamptz; t1 timestamptz; t2 timestamptz; t3 timestamptz; t4 timestamptz; t5 timestamptz; g uuid := pg_temp._id('G1');
  la timestamptz;
begin
  select public._groups_last_activity_at(g) into t0; -- ya incluye 'created'
  perform pg_temp._assert(t0 is not null, 'T12 creación ya generó actividad (created)');

  perform public.add_group_member(g, pg_temp._id('E'));
  select public._groups_last_activity_at(g) into t1;
  perform pg_temp._assert(t1 > t0, 'T12 alta de E mueve actividad');

  perform public.rename_group(g, 'B2A Solo Renombrado');
  select public._groups_last_activity_at(g) into t2;
  perform pg_temp._assert(t2 > t1, 'T12 rename mueve actividad');

  perform public.promote_group_admin(g, pg_temp._id('E'));
  select public._groups_last_activity_at(g) into t3;
  perform pg_temp._assert(t3 > t2, 'T12 promover admin mueve actividad');

  perform public.remove_group_member(g, pg_temp._id('E'));
  select public._groups_last_activity_at(g) into t4;
  perform pg_temp._assert(t4 > t3, 'T12 quitar miembro mueve actividad');

  perform public.add_group_member(g, pg_temp._id('E')); -- reingreso
  select public._groups_last_activity_at(g) into t5;
  perform pg_temp._assert(t5 > t4, 'T12 reingreso mueve actividad');
end $$;

-- ---------- T13: orden final por actividad, con desempate estable ----------
do $$
declare lobby jsonb; ids text[];
begin
  -- Tras T8-T12: G3 es el más reciente (correction_accepted más el resto de esta sección),
  -- G1 acaba de recibir un reingreso -> también reciente; G2 sigue con su creación original,
  -- el más antiguo de los tres.
  lobby := public.get_groups_lobby(null, null);
  select array_agg(g->>'groupId' order by ordinality) into ids
  from jsonb_array_elements(lobby->'groups') with ordinality g;
  perform pg_temp._assert(ids[array_length(ids, 1)] = pg_temp._id('G2')::text, 'T13 G2 (sin actividad reciente) queda último: ' || ids::text);
  -- El orden es determinístico: repetir la llamada da EXACTAMENTE el mismo array (desempate estable).
  perform pg_temp._assert((
    select array_agg(g->>'groupId' order by ordinality) from jsonb_array_elements(public.get_groups_lobby(null, null)->'groups') with ordinality g
  ) = ids, 'T13 el orden es estable entre llamadas');
end $$;

-- ---------- T14: caller ajeno no obtiene ninguno de estos grupos ----------
select pg_temp._as('F');
do $$
declare lobby jsonb;
begin
  lobby := public.get_groups_lobby(null, null);
  perform pg_temp._assert((lobby->>'ok')::boolean, 'T14 lobby ok para F');
  perform pg_temp._assert(jsonb_array_length(lobby->'groups') = 0, 'T14 F (ajeno) no ve ninguno de estos grupos: ' || lobby::text);
end $$;

-- ---------- T15 (consistencia) — get_groups_lobby.weekMatches == get_group_competition_data.matches ----------
select pg_temp._as('A');
do $$
declare weekFrom timestamptz; weekTo timestamptz; fromLobby jsonb; fromDetail jsonb;
begin
  weekFrom := date_trunc('week', now());
  weekTo := weekFrom + interval '7 days';
  select m into fromLobby from jsonb_array_elements(
    (select g from jsonb_array_elements(public.get_groups_lobby(weekFrom, weekTo)->'groups') g where g->>'groupId' = pg_temp._id('G3')::text)->'weekMatches'
  ) m where m->>'matchId' = pg_temp._id('M_g3')::text;
  select m into fromDetail from jsonb_array_elements(
    public.get_group_competition_data(pg_temp._id('G3'), weekFrom, weekTo)->'matches'
  ) m where m->>'matchId' = pg_temp._id('M_g3')::text;
  perform pg_temp._assert(fromLobby = fromDetail, 'T15 mismo partido, MISMO JSON en lobby y en get_group_competition_data (refactor sin fork): ' || fromLobby::text || ' vs ' || fromDetail::text);
end $$;

-- ---------- T-borde (handoff 77) — frontera semanal canónica de Buenos Aires ----------
-- Instantes FIJOS (no relativos a now()) para que el test no dependa del día en que se corre.
-- Referencia ya usada en groups-b2a-frontera-semanal-ba.test.mjs (frontend): el lunes 00:00 de
-- Buenos Aires de la semana que empieza el 2026-09-21 es EXACTAMENTE 2026-09-21T03:00:00Z.

-- _groups_week_start_ba en sí — debe coincidir con PLGroups.weekStartBA (mismos instantes).
do $$
begin
  perform pg_temp._assert(public._groups_week_start_ba('2026-09-20T23:59:00Z'::timestamptz) = '2026-09-14T03:00:00Z'::timestamptz,
    'week_start_ba: domingo 23:59 UTC (20:59 BA) -> lunes de la semana ANTERIOR');
  perform pg_temp._assert(public._groups_week_start_ba('2026-09-21T02:59:00Z'::timestamptz) = '2026-09-14T03:00:00Z'::timestamptz,
    'week_start_ba: lunes 02:59 UTC = domingo 23:59 BA -> TODAVÍA la semana anterior (el caso trampa "ya es lunes en UTC pero no en BA")');
  perform pg_temp._assert(public._groups_week_start_ba('2026-09-21T03:00:00Z'::timestamptz) = '2026-09-21T03:00:00Z'::timestamptz,
    'week_start_ba: lunes 03:00 UTC = lunes 00:00 BA exacto -> el propio instante');
  perform pg_temp._assert(public._groups_week_start_ba('2026-09-27T23:59:00Z'::timestamptz) = '2026-09-21T03:00:00Z'::timestamptz,
    'week_start_ba: domingo de la MISMA semana (BA) -> el lunes con el que empezó');
end $$;

do $$
declare v jsonb;
begin
  v := public.create_group('B2A Borde Lunes', array[pg_temp._id('B')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G4: ' || v::text);
  insert into pg_temp._b2a values ('G4', (v->'group'->>'groupId')::uuid);
  v := public.create_group('B2A Borde Domingo', array[pg_temp._id('B')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G5: ' || v::text);
  insert into pg_temp._b2a values ('G5', (v->'group'->>'groupId')::uuid);
  update public.group_memberships set joined_at = '2026-01-05T00:00:00Z'
    where group_id in (pg_temp._id('G4'), pg_temp._id('G5'));
  -- F entra a G4 el LUNES 15:00 UTC (lunes en cualquier huso); a G5 el DOMINGO 20:00 UTC (misma
  -- semana BA que el lunes 2026-09-21).
  perform public.add_group_member(pg_temp._id('G4'), pg_temp._id('F'));
  update public.group_memberships set joined_at = '2026-09-21T15:00:00Z'
    where group_id = pg_temp._id('G4') and player_id = pg_temp._id('F');
  perform public.add_group_member(pg_temp._id('G5'), pg_temp._id('F'));
  update public.group_memberships set joined_at = '2026-09-27T20:00:00Z'
    where group_id = pg_temp._id('G5') and player_id = pg_temp._id('F');
end $$;

do $$
begin
  -- M4_sun: DOMINGO anterior a la semana del alta de F en G4 -> F NO cuenta (A,B=2) -> no califica.
  perform pg_temp._mk_match('g4sun', 'A', 'B', 'F', 'D', '2026-09-20T20:00:00Z'::timestamptz, 'A');
  -- M4_mon: mismo LUNES del alta de F, pero HORAS ANTES de su alta exacta (15:00) -> SÍ cuenta
  -- (piso = lunes 00:00 BA = 03:00 UTC, y 05:00 UTC >= 03:00 UTC) -> A,B,F=3 -> califica.
  perform pg_temp._mk_match('g4mon', 'A', 'B', 'F', 'D', '2026-09-21T05:00:00Z'::timestamptz, 'A');
  -- M5_mon: mismo partido/horario que M4_mon, pero para G5 (F entró el DOMINGO de esa MISMA
  -- semana BA) -> también debe calificar.
  perform pg_temp._mk_match('g5mon', 'A', 'B', 'F', 'D', '2026-09-21T05:00:00Z'::timestamptz, 'A');
end $$;

select pg_temp._as('A');
do $$
declare weekFrom timestamptz; weekTo timestamptz; lobby jsonb; g4 jsonb; g5 jsonb;
begin
  weekFrom := '2026-09-21T03:00:00Z'::timestamptz; -- lunes 00:00 BA
  weekTo := weekFrom + interval '7 days';
  lobby := public.get_groups_lobby(weekFrom, weekTo);
  select g into g4 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G4')::text;
  select g into g5 from jsonb_array_elements(lobby->'groups') g where g->>'groupId' = pg_temp._id('G5')::text;

  -- weekMatches sigue con el umbral AMPLIO (nunca excluye de más) — M4_sun puede seguir
  -- apareciendo acá como candidato de transporte; lo que NO puede pasar es que mueva actividad
  -- (verificado abajo). Lo que sí debe cumplirse siempre: M4_mon/M5_mon están presentes.
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(g4->'weekMatches') m where m->>'matchId' = pg_temp._id('M_g4mon')::text),
    'T-borde: M4_mon (lunes, antes de la hora exacta del alta) es candidato de G4');
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(g5->'weekMatches') m where m->>'matchId' = pg_temp._id('M_g5mon')::text),
    'T-borde: M5_mon (alta domingo, partido lunes de la misma semana) es candidato de G5');

  -- El bug real: antes del fix, _groups_last_activity_at usaba el umbral AMPLIO como si fuera
  -- exacto — M4_sun (domingo ANTERIOR a la semana del alta) hubiera movido lastActivityAt. Con
  -- el fix, un 'validated'/'correction_accepted' NUEVO sobre M4_sun no debe mover nada.
  declare before4 timestamptz; after4 timestamptz; after4b timestamptz;
  begin
    select (g->>'lastActivityAt')::timestamptz into before4 from jsonb_array_elements(public.get_groups_lobby(null, null)->'groups') g where g->>'groupId' = pg_temp._id('G4')::text;
    insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at)
      values (pg_temp._id('M_g4sun'), 'validated', pg_temp._id('A'), clock_timestamp());
    insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at)
      values (pg_temp._id('M_g4sun'), 'correction_accepted', pg_temp._id('A'), clock_timestamp());
    select (g->>'lastActivityAt')::timestamptz into after4 from jsonb_array_elements(public.get_groups_lobby(null, null)->'groups') g where g->>'groupId' = pg_temp._id('G4')::text;
    perform pg_temp._assert(after4 = before4, 'T-borde: partido de la semana ANTERIOR a la efectiva del alta (M4_sun) NO mueve lastActivityAt, ni con validated ni con correction_accepted');

    -- Control positivo: un 'correction_accepted' sobre M4_mon (SÍ calificable) sí mueve.
    insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at)
      values (pg_temp._id('M_g4mon'), 'correction_accepted', pg_temp._id('A'), clock_timestamp());
    select (g->>'lastActivityAt')::timestamptz into after4b from jsonb_array_elements(public.get_groups_lobby(null, null)->'groups') g where g->>'groupId' = pg_temp._id('G4')::text;
    perform pg_temp._assert(after4b > after4, 'T-borde: correction_accepted sobre un partido SÍ calificable de la semana efectiva mueve lastActivityAt');
  end;
end $$;

-- ---------- Permisos ----------
do $$
begin
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.get_groups_lobby(timestamptz, timestamptz)', 'execute'), 'authenticated puede get_groups_lobby');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.get_groups_lobby(timestamptz, timestamptz)', 'execute'), 'anon NO puede get_groups_lobby');
  declare f text;
  begin
    foreach f in array array[
      'public._groups_candidate_matches(uuid, timestamptz, timestamptz)',
      'public._groups_is_member_at(uuid, uuid, timestamptz)',
      'public._groups_match_sets_json(uuid)',
      'public._groups_match_players_json(uuid, uuid, timestamptz)',
      'public._groups_week_matches_json(uuid, timestamptz, timestamptz)',
      'public._groups_members_json(uuid)',
      'public._groups_last_activity_at(uuid)',
      'public._groups_week_start_ba(timestamptz)',
      'public._groups_candidate_matches_exact(uuid, timestamptz, timestamptz)'] loop
      perform pg_temp._assert(not has_function_privilege('authenticated', f, 'execute'), 'helper interno no expuesto: ' || f);
      perform pg_temp._assert(not has_function_privilege('anon', f, 'execute'), 'helper interno no expuesto a anon: ' || f);
    end loop;
  end;
end $$;

select 'GRUPOS_B2A_BACKEND_LOBBY_VERIFY_PASS' as result;

rollback;
