-- BRAMUlab — Grupos BRAMU Fase A: verificación transaccional de
-- 20260928120000_preprod_grupos_fase_a_backend_compartido.sql. Requiere Bloques 1-8 + esa
-- migración aplicadas. NO requiere cuentas reales: crea (dentro de la transacción) filas mínimas
-- en auth.users + players/profiles como fixtures y TERMINA EN ROLLBACK (no deja nada).
-- Sesiones simuladas con set_config('request.jwt.claim.sub', ...) — mismo patrón que
-- verify-preprod-ux-mis-jugadores.sql.
--
-- Cubre los 12 riesgos del handoff 65:
--  T1 crear grupo -> creador miembro+admin            T7 último admin no demovible/quitable
--  T2 agregar miembro                                 T8 con dos admins puede quitarse uno
--  T3 reingreso = período nuevo, el anterior intacto  T9 eliminar: lógico, historia intacta, fuera de lecturas
--  T4 no-admin bloqueado en todas las mutaciones      T10 dos miembros ven la misma definición; no miembro no lee
--  T5 admin promueve admin                            T11 partido con 3/4 y 4/4; mismo partido en 2 grupos
--  T6 player_id inexistente/no seleccionable          T12 sin snapshot de Nivel => levelBefore null (sin Sorpresa)
-- + permisos (anon/authenticated) y backstop DB-level del invariante de admins.

begin;

create temporary table _g (k text primary key, v uuid) on commit drop;

create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._g where k = p_key)), true);
end $$;

create or replace function pg_temp._id(p_key text) returns uuid language sql as $$
  select v from pg_temp._g where k = p_key
$$;

create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if;
end $$;

-- ---------- Fixtures: jugadores A,B,C,D,E,X (registrados con sesión), P (provisional), I (inactivo) ----------
do $$
declare
  v_key text;
  v_uid uuid;
  v_pid uuid;
begin
  foreach v_key in array array['A','B','C','D','E','X','I'] loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, 'grp_' || lower(v_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
    insert into public.players (display_name, auth_user_id) values ('GRP ' || v_key, v_uid) returning player_id into v_pid;
    insert into public.profiles (player_id, username, first_name, last_name, display_name)
      values (v_pid, 'grp_' || lower(v_key) || substr(v_uid::text, 1, 6), 'GRP', v_key, 'GRP ' || v_key);
    insert into pg_temp._g values (v_key, v_pid);
  end loop;
  insert into public.players (display_name, type) values ('GRP Provisional', 'provisional') returning player_id into v_pid;
  insert into pg_temp._g values ('P', v_pid);
  update public.players set is_active = false where player_id = (select v from pg_temp._g where k = 'I');
end $$;

-- ---------- T1 + T12(crear) : A crea grupo con B ----------
select pg_temp._as('A');
do $$
declare v jsonb; g jsonb;
begin
  v := public.create_group('  Grupo Test  ', array[pg_temp._id('B')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'T1 create_group ok: ' || v::text);
  g := v->'group';
  perform pg_temp._assert(g->>'name' = 'Grupo Test', 'T1 nombre trimmeado');
  perform pg_temp._assert((g->>'isAdmin')::boolean, 'T1 creador es admin');
  perform pg_temp._assert(jsonb_array_length(g->'members') = 2, 'T1 dos miembros');
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(g->'members') m
    where m->>'playerId' = pg_temp._id('A')::text and (m->>'isAdmin')::boolean and (m->>'isActive')::boolean), 'T1 A miembro activo + admin');
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(g->'members') m
    where m->>'playerId' = pg_temp._id('B')::text and not (m->>'isAdmin')::boolean and (m->>'isActive')::boolean), 'T1 B miembro activo no admin');
  insert into pg_temp._g values ('G1', (g->>'groupId')::uuid);

  -- nombre inválido y miembro no seleccionable: sin grupo a medias
  perform pg_temp._assert(public.create_group('   ', '{}')->>'code' = 'invalid_name', 'T1 nombre vacío');
  perform pg_temp._assert(public.create_group(repeat('x', 61), '{}')->>'code' = 'invalid_name', 'T1 nombre largo');
  v := public.create_group('No Debe Existir', array[pg_temp._id('P')]);
  perform pg_temp._assert(v->>'code' = 'player_not_found', 'T6 create con provisional');
  v := public.create_group('No Debe Existir', array[gen_random_uuid()]);
  perform pg_temp._assert(v->>'code' = 'player_not_found', 'T6 create con uuid inexistente');
  perform pg_temp._assert(not exists (select 1 from public.groups where name = 'No Debe Existir'), 'T6 sin grupo a medias');
end $$;

-- ---------- T10: no miembro no lee; dos miembros ven la misma definición ----------
select pg_temp._as('X');
do $$
declare v jsonb;
begin
  v := public.get_group_detail(pg_temp._id('G1'));
  perform pg_temp._assert(v->>'code' = 'group_not_found', 'T10 no miembro no lee detalle');
  v := public.get_group_competition_data(pg_temp._id('G1'));
  perform pg_temp._assert(v->>'code' = 'group_not_found', 'T10 no miembro no lee competencia');
  perform pg_temp._assert(jsonb_array_length(public.list_my_groups()->'groups') = 0, 'T10 no miembro no lo lista');
  perform pg_temp._assert(public.get_group_detail(gen_random_uuid())->>'code' = 'group_not_found', 'T10 inexistente = mismo código');
end $$;

create temporary table _det (who text, j jsonb) on commit drop;
select pg_temp._as('A');
insert into _det select 'A', public.get_group_detail(pg_temp._id('G1'))->'group';
select pg_temp._as('B');
insert into _det select 'B', public.get_group_detail(pg_temp._id('G1'))->'group';
do $$
declare a jsonb; b jsonb;
begin
  select j into a from _det where who = 'A';
  select j into b from _det where who = 'B';
  perform pg_temp._assert(a is not null and b is not null, 'T10 ambos miembros leen');
  perform pg_temp._assert((a - 'isAdmin') = (b - 'isAdmin'), 'T10 misma definición server-backed (salvo isAdmin del caller)');
  perform pg_temp._assert((a->>'isAdmin')::boolean and not (b->>'isAdmin')::boolean, 'T10 isAdmin es del caller');
  perform pg_temp._assert(jsonb_array_length(public.list_my_groups()->'groups') = 1, 'T10 B lista su grupo');
end $$;

-- ---------- T4: B (no admin) bloqueado en TODAS las mutaciones ----------
do $$
declare g uuid := pg_temp._id('G1');
begin
  perform pg_temp._assert(public.rename_group(g, 'Hack')->>'code' = 'not_admin', 'T4 rename');
  perform pg_temp._assert(public.add_group_member(g, pg_temp._id('C'))->>'code' = 'not_admin', 'T4 add');
  perform pg_temp._assert(public.remove_group_member(g, pg_temp._id('A'))->>'code' = 'not_admin', 'T4 remove');
  perform pg_temp._assert(public.promote_group_admin(g, pg_temp._id('B'))->>'code' = 'not_admin', 'T4 promote (auto-promoción)');
  perform pg_temp._assert(public.demote_group_admin(g, pg_temp._id('A'))->>'code' = 'not_admin', 'T4 demote');
  perform pg_temp._assert(public.delete_group(g)->>'code' = 'not_admin', 'T4 delete');
  perform pg_temp._assert((select name from public.groups where group_id = g) = 'Grupo Test', 'T4 nada mutó');
end $$;

-- ---------- T2 + T6 + T3: agregar, no seleccionables, reingreso ----------
select pg_temp._as('A');
do $$
declare g uuid := pg_temp._id('G1'); v jsonb; n integer;
begin
  v := public.add_group_member(g, pg_temp._id('C'));
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean, 'T2 add C');
  v := public.add_group_member(g, pg_temp._id('C'));
  perform pg_temp._assert((v->>'ok')::boolean and not (v->>'changed')::boolean, 'T2 add C idempotente');
  select count(*) into n from public.group_memberships where group_id = g and player_id = pg_temp._id('C');
  perform pg_temp._assert(n = 1, 'T2 un solo período tras add repetido');

  perform pg_temp._assert(public.add_group_member(g, pg_temp._id('P'))->>'code' = 'player_not_found', 'T6 provisional');
  perform pg_temp._assert(public.add_group_member(g, pg_temp._id('I'))->>'code' = 'player_not_found', 'T6 inactivo');
  perform pg_temp._assert(public.add_group_member(g, gen_random_uuid())->>'code' = 'player_not_found', 'T6 inexistente');
  perform pg_temp._assert(public.add_group_member(g, null)->>'code' = 'player_not_found', 'T6 null');

  -- T3: salir y reingresar
  v := public.remove_group_member(g, pg_temp._id('C'));
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean, 'T3 remove C');
  select count(*) into n from public.group_memberships where group_id = g and player_id = pg_temp._id('C') and left_at is not null;
  perform pg_temp._assert(n = 1, 'T3 período cerrado, no borrado');
  perform pg_temp._assert(not exists (select 1 from jsonb_array_elements(v->'group'->'members') m
    where m->>'playerId' = pg_temp._id('C')::text and (m->>'isActive')::boolean), 'T3 C inactivo tras salir');
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(v->'group'->'members') m
    where m->>'playerId' = pg_temp._id('C')::text), 'T3 C sigue en el detalle histórico');
  -- quitar de nuevo: idempotente
  perform pg_temp._assert(not (public.remove_group_member(g, pg_temp._id('C'))->>'changed')::boolean, 'T3 remove idempotente');

  v := public.add_group_member(g, pg_temp._id('C'));
  perform pg_temp._assert((v->>'changed')::boolean, 'T3 reingreso');
  select count(*) into n from public.group_memberships where group_id = g and player_id = pg_temp._id('C');
  perform pg_temp._assert(n = 2, 'T3 dos períodos');
  perform pg_temp._assert((select count(*) from jsonb_array_elements(
      (select m->'periods' from jsonb_array_elements(v->'group'->'members') m where m->>'playerId' = pg_temp._id('C')::text)
    ) p where p->>'leftAt' is not null) = 1, 'T3 período anterior conserva leftAt');
  perform pg_temp._assert((select count(*) from public.group_memberships where group_id = g and player_id = pg_temp._id('C') and left_at is null) = 1, 'T3 un solo período abierto');
end $$;

-- ---------- T7: último admin (RPC + backstop DB) ----------
do $$
declare g uuid := pg_temp._id('G1'); v jsonb; caught boolean := false;
begin
  perform pg_temp._assert(public.demote_group_admin(g, pg_temp._id('A'))->>'code' = 'last_admin', 'T7 demote único admin');
  perform pg_temp._assert(public.remove_group_member(g, pg_temp._id('A'))->>'code' = 'last_admin', 'T7 remove único admin');
  perform pg_temp._assert((select is_admin from public.group_memberships where group_id = g and player_id = pg_temp._id('A') and left_at is null), 'T7 A sigue admin activo');

  -- Backstop: una escritura directa (bypass de RPC) que deja cero admins aborta al cierre.
  begin
    update public.group_memberships set is_admin = false where group_id = g and player_id = pg_temp._id('A') and left_at is null;
    set constraints all immediate;
  exception when others then
    caught := true;
  end;
  set constraints all deferred;
  perform pg_temp._assert(caught, 'T7 backstop DB bloquea cero admins');
  perform pg_temp._assert((select is_admin from public.group_memberships where group_id = g and player_id = pg_temp._id('A') and left_at is null), 'T7 backstop revirtió el cambio');
end $$;

-- ---------- T5 + T8 ----------
do $$
declare g uuid := pg_temp._id('G1'); v jsonb;
begin
  perform pg_temp._assert(public.promote_group_admin(g, pg_temp._id('E'))->>'code' = 'target_not_member', 'T5 promover no miembro');
  v := public.promote_group_admin(g, pg_temp._id('B'));
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean, 'T5 A promueve a B');
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(v->'group'->'members') m
    where m->>'playerId' = pg_temp._id('B')::text and (m->>'isAdmin')::boolean), 'T5 B es admin');
  perform pg_temp._assert(not (public.promote_group_admin(g, pg_temp._id('B'))->>'changed')::boolean, 'T5 idempotente');
end $$;

select pg_temp._as('B');
do $$
declare g uuid := pg_temp._id('G1'); v jsonb;
begin
  -- T8: con dos admins, B (admin) puede quitar a A (admin).
  v := public.remove_group_member(g, pg_temp._id('A'));
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean, 'T8 dos admins: se puede quitar uno: ' || v::text);
  perform pg_temp._assert(public.remove_group_member(g, pg_temp._id('B'))->>'code' = 'last_admin', 'T8 ahora B es el único: no puede quitarse');
  perform pg_temp._assert(public.demote_group_admin(g, pg_temp._id('B'))->>'code' = 'last_admin', 'T8 ni demoverse');
end $$;

select pg_temp._as('A');
do $$
declare g uuid := pg_temp._id('G1');
begin
  -- A fue quitado: ya no lee ni muta.
  perform pg_temp._assert(public.get_group_detail(g)->>'code' = 'group_not_found', 'T8 A removido no lee');
  perform pg_temp._assert(public.add_group_member(g, pg_temp._id('E'))->>'code' = 'group_not_found', 'T8 A removido no muta');
end $$;

select pg_temp._as('B');
do $$
declare g uuid := pg_temp._id('G1'); v jsonb;
begin
  -- B reincorpora a A (período nuevo, no admin), lo promueve y luego B se demueve solo.
  perform pg_temp._assert((public.add_group_member(g, pg_temp._id('A'))->>'changed')::boolean, 'T8 reingreso de A');
  perform pg_temp._assert((select count(*) from public.group_memberships where group_id = g and player_id = pg_temp._id('A')) = 2, 'T8 A tiene 2 períodos');
  perform pg_temp._assert(not (select is_admin from public.group_memberships where group_id = g and player_id = pg_temp._id('A') and left_at is null), 'T8 reingreso NO hereda admin');
  perform public.promote_group_admin(g, pg_temp._id('A'));
  v := public.demote_group_admin(g, pg_temp._id('B'));
  perform pg_temp._assert((v->>'ok')::boolean and not (v->'group'->>'isAdmin')::boolean, 'T8 B se demueve (hay otro admin)');
  perform pg_temp._assert(public.rename_group(g, 'x')->>'code' = 'not_admin', 'T8 B ya no es admin');
end $$;

-- ---------- Rename por admin + auditoría ----------
select pg_temp._as('A');
do $$
declare g uuid := pg_temp._id('G1'); v jsonb;
begin
  v := public.rename_group(g, 'Grupo Renombrado');
  perform pg_temp._assert(v->'group'->>'name' = 'Grupo Renombrado', 'rename por admin');
  perform pg_temp._assert(public.rename_group(g, '')->>'code' = 'invalid_name', 'rename inválido');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = g and event_type = 'admin_promoted'), 'auditoría de admins');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = g and event_type = 'member_removed'), 'auditoría de bajas');
end $$;

-- ---------- Fixtures deportivos ----------
-- G2 (A admin; B,C,E miembros) y G3 (B admin; C,D,A miembros de otro grupo distinto: C,D,B).
do $$
declare v jsonb;
begin
  perform pg_temp._as('A');
  v := public.create_group('G2', array[pg_temp._id('B'), pg_temp._id('C'), pg_temp._id('E')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G2');
  insert into pg_temp._g values ('G2', (v->'group'->>'groupId')::uuid);
  perform pg_temp._as('B');
  v := public.create_group('G3', array[pg_temp._id('C'), pg_temp._id('D')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G3');
  insert into pg_temp._g values ('G3', (v->'group'->>'groupId')::uuid);
  -- Todas las membresías de estos grupos "existen desde hace 30 días" salvo C en G2, que
  -- entra hace 5 días (para el partido anterior a su ingreso).
  update public.group_memberships set joined_at = now() - interval '30 days'
    where group_id in (pg_temp._id('G2'), pg_temp._id('G3'));
  update public.group_memberships set joined_at = now() - interval '5 days'
    where group_id = pg_temp._id('G2') and player_id = pg_temp._id('C');
end $$;

-- Helper de partido validado: 4 jugadores (a1,a2 = equipo A; b1,b2 = equipo B).
create or replace function pg_temp._mk_match(
  p_tag text, p_a1 text, p_a2 text, p_b1 text, p_b2 text, p_played timestamptz, p_status text, p_winner text
) returns uuid language plpgsql as $$
declare v_match uuid; v_rev uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, winner_team,
                              validation_deadline_at, validated_at)
    values (pg_temp._id(p_a1), 'grp-fa-' || p_tag, 'classic', p_played, p_status,
            case when p_status = 'validated' then p_winner end, now() + interval '13 days',
            case when p_status = 'validated' then now() end)
    returning match_id into v_match;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match, 'A', 1, pg_temp._id(p_a1), p_a1), (v_match, 'A', 2, pg_temp._id(p_a2), p_a2),
    (v_match, 'B', 1, pg_temp._id(p_b1), p_b1), (v_match, 'B', 2, pg_temp._id(p_b2), p_b2);
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match, 1, pg_temp._id(p_a1), 'A', 'created', p_played) returning revision_id into v_rev;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_match, 1, 1, 6, 4), (v_match, 1, 2, 6, 3);
  update public.matches set current_revision_id = v_rev where match_id = v_match;
  insert into pg_temp._g values ('M_' || p_tag, v_match);
  return v_match;
end $$;

do $$
declare m1 uuid; v_rev2 uuid; v_res uuid;
begin
  -- M1: 3/4 miembros de G2 (A,B,C; D no) y de G3 (B,C,D; A no) -> elegible en AMBOS grupos.
  m1 := pg_temp._mk_match('m1', 'A', 'B', 'C', 'D', now() - interval '3 days', 'validated', 'A');
  -- Corrección oficial posterior: revisión 2 con otro score; el contrato debe leer la VIGENTE.
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (m1, 2, pg_temp._id('B'), 'B', 'proposed_correction', now() - interval '3 days') returning revision_id into v_rev2;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (m1, 2, 1, 2, 6), (m1, 2, 2, 6, 3), (m1, 2, 3, 3, 6);
  update public.matches set current_revision_id = v_rev2, winner_team = 'B' where match_id = m1;
  -- Nivel oficial previo (resultado aplicado + eligible) SOLO para A, B, C (D sin fila).
  insert into public.match_level_results (match_id, revision_id, trigger, algorithm_version, eligible)
    values (m1, v_rev2, 'initial', 'test', true) returning result_id into v_res;
  insert into public.match_level_result_players (result_id, player_id, team, formula_mu_before, formula_confidence_before, formula_state,
      effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
      original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before, mu_after, confidence_after)
    select v_res, pg_temp._id(t.k), t.team, 5, 0.5, 'CALIBRADO', t.lvl, 1, 1, 1, 0, 0, 1, 5, 0.5, 1, 5, 0.5
    from (values ('A', 'A', 5.2), ('B', 'A', 4.9), ('C', 'B', 6.1)) t(k, team, lvl);

  -- M5: 4/4 miembros de G2 (A,B,C,E), sin resultado de Nivel => sin evidencia histórica.
  perform pg_temp._mk_match('m5', 'A', 'B', 'C', 'E', now() - interval '2 days', 'validated', 'A');
  -- M2: solo 1 miembro de G2 (A) -> no elegible.
  perform pg_temp._mk_match('m2', 'A', 'X', 'D', 'I', now() - interval '2 days', 'validated', 'A');
  -- M4: jugado ANTES del ingreso de C a G2 (hace 8 días) -> en G2 solo A,B,E,... = 3? usa A,B,C,D: A,B miembros, C aún no -> 2 -> no elegible.
  perform pg_temp._mk_match('m4', 'A', 'B', 'C', 'D', now() - interval '8 days', 'validated', 'A');
  -- M6: pendiente -> nunca entra.
  perform pg_temp._mk_match('m6', 'A', 'B', 'C', 'E', now() - interval '1 day', 'pending_validation', null);
end $$;

-- ---------- T11 + T12 + T10 : contrato deportivo ----------
select pg_temp._as('A');
do $$
declare g2 jsonb; ids text[]; m1 jsonb; m5 jsonb; before_count integer;
begin
  g2 := public.get_group_competition_data(pg_temp._id('G2'));
  perform pg_temp._assert((g2->>'ok')::boolean, 'T11 lectura G2 ok');
  select array_agg(m->>'matchId' order by m->>'matchId') into ids from jsonb_array_elements(g2->'matches') m;
  perform pg_temp._assert(ids = (select array_agg(x::text order by x::text) from unnest(array[pg_temp._id('M_m1'), pg_temp._id('M_m5')]) x),
    'T11 G2 solo devuelve M1 (3/4) y M5 (4/4): ' || coalesce(ids::text, 'null'));

  select m into m1 from jsonb_array_elements(g2->'matches') m where m->>'matchId' = pg_temp._id('M_m1')::text;
  select m into m5 from jsonb_array_elements(g2->'matches') m where m->>'matchId' = pg_temp._id('M_m5')::text;

  -- 3/4: 4 jugadores por player_id, D no miembro en la fecha.
  perform pg_temp._assert(jsonb_array_length(m1->'players') = 4, 'T11 M1 tiene 4 jugadores');
  perform pg_temp._assert((select count(*) from jsonb_array_elements(m1->'players') p where (p->>'isGroupMember')::boolean) = 3, 'T11 M1: 3 miembros');
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(m1->'players') p where p->>'playerId' = pg_temp._id('D')::text and not (p->>'isGroupMember')::boolean), 'T11 D no es miembro');
  -- 4/4
  perform pg_temp._assert((select count(*) from jsonb_array_elements(m5->'players') p where (p->>'isGroupMember')::boolean) = 4, 'T11 M5: 4 miembros');

  -- Revisión oficial vigente (no la primera): 3 sets, ganador B.
  perform pg_temp._assert(m1->>'winnerTeam' = 'B' and jsonb_array_length(m1->'sets') = 3, 'T11 M1 usa la revisión oficial vigente');
  perform pg_temp._assert((m1->'sets'->0->>'gamesA')::int = 2 and (m1->'sets'->0->>'gamesB')::int = 6, 'T11 sets de la revisión 2');

  -- T12: Nivel previo oficial solo donde hay evidencia; sin fabricar.
  perform pg_temp._assert((select (p->>'levelBefore')::numeric from jsonb_array_elements(m1->'players') p where p->>'playerId' = pg_temp._id('A')::text) = 5.2, 'T12 levelBefore A = 5.2');
  perform pg_temp._assert((select p->'levelBefore' from jsonb_array_elements(m1->'players') p where p->>'playerId' = pg_temp._id('D')::text) = 'null'::jsonb, 'T12 D sin fila => null');
  perform pg_temp._assert((select count(*) from jsonb_array_elements(m5->'players') p where p->'levelBefore' <> 'null'::jsonb) = 0, 'T12 M5 sin snapshot => todos null (sin Sorpresa)');

  -- Periodos históricos incluidos para que el motor re-evalúe.
  perform pg_temp._assert(jsonb_array_length(g2->'group'->'members') = 4, 'T11 group.members con períodos');

  -- Filtro temporal.
  perform pg_temp._assert(jsonb_array_length(public.get_group_competition_data(pg_temp._id('G2'), now() - interval '2 days 12 hours', null)->'matches') = 1, 'T11 p_from filtra');
  perform pg_temp._assert(jsonb_array_length(public.get_group_competition_data(pg_temp._id('G2'), null, now() - interval '5 days')->'matches') = 0, 'T11 p_to filtra (M4 no elegible igual)');

  -- Mismo partido en más de un grupo: M1 también en G3 (B,C,D), vía B.
  perform pg_temp._as('B');
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(public.get_group_competition_data(pg_temp._id('G3'))->'matches') m
    where m->>'matchId' = pg_temp._id('M_m1')::text), 'T11 M1 elegible en G3 también');
  -- Y un miembro de G3 no lee G2 si no es miembro de G2 (D):
  perform pg_temp._as('D');
  perform pg_temp._assert(public.get_group_competition_data(pg_temp._id('G2'))->>'code' = 'group_not_found', 'T10 D (miembro de G3) no lee G2');
end $$;

-- ---------- T9: eliminación lógica ----------
select pg_temp._as('A');
do $$
declare g uuid := pg_temp._id('G2'); v jsonb; n_mem integer; n_match integer; n_res integer;
begin
  select count(*) into n_mem from public.group_memberships where group_id = g;
  select count(*) into n_match from public.matches;
  select count(*) into n_res from public.match_level_results;
  v := public.delete_group(g);
  perform pg_temp._assert((v->>'ok')::boolean, 'T9 delete ok');
  perform pg_temp._assert((select status = 'deleted' and deleted_at is not null from public.groups where group_id = g), 'T9 borrado lógico');
  perform pg_temp._assert((select count(*) from public.group_memberships where group_id = g) = n_mem, 'T9 memberships intactas');
  perform pg_temp._assert((select count(*) from public.matches) = n_match, 'T9 partidos intactos');
  perform pg_temp._assert((select count(*) from public.match_level_results) = n_res, 'T9 resultados de Nivel intactos');
  perform pg_temp._assert(public.get_group_detail(g)->>'code' = 'group_not_found', 'T9 detalle inaccesible');
  perform pg_temp._assert(public.get_group_competition_data(g)->>'code' = 'group_not_found', 'T9 competencia inaccesible');
  perform pg_temp._assert(not exists (select 1 from jsonb_array_elements(public.list_my_groups()->'groups') x where x->>'groupId' = g::text), 'T9 fuera de list_my_groups');
  perform pg_temp._assert(public.rename_group(g, 'zombie')->>'code' = 'group_not_found', 'T9 no se puede mutar');
  perform pg_temp._assert(public.delete_group(g)->>'code' = 'group_not_found', 'T9 doble delete = not_found');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = g and event_type = 'deleted'), 'T9 auditoría');
  -- Un miembro (B) tampoco lo ve.
  perform pg_temp._as('B');
  perform pg_temp._assert(public.get_group_detail(g)->>'code' = 'group_not_found', 'T9 B tampoco lo ve');
end $$;

-- ---------- Permisos ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.list_my_groups()', 'public.get_group_detail(uuid)', 'public.create_group(text, uuid[])',
    'public.rename_group(uuid, text)', 'public.add_group_member(uuid, uuid)',
    'public.remove_group_member(uuid, uuid)', 'public.promote_group_admin(uuid, uuid)',
    'public.demote_group_admin(uuid, uuid)', 'public.delete_group(uuid)',
    'public.get_group_competition_data(uuid, timestamptz, timestamptz)'] loop
    perform pg_temp._assert(has_function_privilege('authenticated', f, 'execute'), 'authenticated puede ' || f);
    perform pg_temp._assert(not has_function_privilege('anon', f, 'execute'), 'anon NO puede ' || f);
  end loop;
  foreach f in array array[
    'public._groups_caller_player_id()', 'public._groups_player_selectable(uuid)',
    'public._groups_detail_json(uuid, uuid)', 'public._groups_lock_and_authorize(uuid, uuid, boolean)'] loop
    perform pg_temp._assert(not has_function_privilege('authenticated', f, 'execute'), 'helper interno no expuesto: ' || f);
    perform pg_temp._assert(not has_function_privilege('anon', f, 'execute'), 'helper interno no expuesto a anon: ' || f);
  end loop;
  foreach f in array array['public.groups', 'public.group_memberships', 'public.group_events'] loop
    perform pg_temp._assert(not has_table_privilege('authenticated', f, 'select'), 'sin SELECT directo authenticated en ' || f);
    perform pg_temp._assert(not has_table_privilege('anon', f, 'select'), 'sin SELECT directo anon en ' || f);
    perform pg_temp._assert((select relrowsecurity from pg_class where oid = f::regclass), 'RLS habilitada en ' || f);
  end loop;
end $$;

select 'GRUPOS_FASE_A_VERIFY_PASS' as result;

rollback;
