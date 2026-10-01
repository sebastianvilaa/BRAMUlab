// BRAMUlab — Bloque 9B: fixtures DESCARTABLES (solo para bases efímeras de ensayo; nunca se ejecutan contra Staging).
// Usuario sujeto A con datos propios sensibles + 3 terceros con PII propia (que NUNCA debe filtrarse a A), un partido compartido
// de 4 jugadores, notificaciones con ids de terceros, grupo compartido y grupo solo-de-A, avatar en Storage y outputs de Intelligence.

export const THIRD_PARTY_PII = {
  B: { email: 'tercero.b@example.test', phone: '+5491100000002', birth: '1991-02-02', username: 'tercero_b' },
  C: { email: 'tercero.c@example.test', phone: '+5491100000003', birth: '1992-03-03', username: 'tercero_c' },
  D: { email: 'tercero.d@example.test', phone: '+5491100000004', birth: '1993-04-04', username: 'tercero_d' },
};
const U = (n) => `00000000-0000-4000-8000-0000000000${n}`;
export const IDS = { A: U('a1'), B: U('b1'), C: U('c1'), D: U('d1') };

export async function seedOpsFixtures(db) {
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging') on conflict do nothing`);
  const mkUser = async (key, email, username, first, phone, birth) => {
    await db.query(`insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) values ($1, $2, 'HASH_SECRETO_NO_DEBE_SALIR', now() - interval '3 days', '{"legal_version":"legal_v1"}'::jsonb)`, [IDS[key], email]);
    await db.query(`update public.profiles set username=$2, first_name=$3, last_name='Fixture', display_name=$3, phone=$4, birth_date=$5, allow_whatsapp_contact=true where player_id=(select player_id from public.players where auth_user_id=$1)`, [IDS[key], username, first, phone, birth]);
    return (await db.query(`select player_id from public.players where auth_user_id=$1`, [IDS[key]])).rows[0].player_id;
  };
  const pid = {};
  pid.A = await mkUser('A', 'sujeto.a@example.test', 'sujeto_a', 'Sujeto', '+5491100000001', '1990-01-01');
  pid.B = await mkUser('B', THIRD_PARTY_PII.B.email, THIRD_PARTY_PII.B.username, 'TerceroB', THIRD_PARTY_PII.B.phone, THIRD_PARTY_PII.B.birth);
  pid.C = await mkUser('C', THIRD_PARTY_PII.C.email, THIRD_PARTY_PII.C.username, 'TerceroC', THIRD_PARTY_PII.C.phone, THIRD_PARTY_PII.C.birth);
  pid.D = await mkUser('D', THIRD_PARTY_PII.D.email, THIRD_PARTY_PII.D.username, 'TerceroD', THIRD_PARTY_PII.D.phone, THIRD_PARTY_PII.D.birth);

  // partido compartido (pending) A+B vs C+D con 2 sets
  const m = (await db.query(`insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, action_side, validation_deadline_at)
     values ($1, 'ops-fp-1', 'classic', now() - interval '1 day', 'pending_validation', 'B', now() + interval '20 days') returning match_id`, [pid.A])).rows[0].match_id;
  for (const [team, pos, who, name] of [['A', 1, 'A', 'Sujeto'], ['A', 2, 'B', 'TerceroB'], ['B', 1, 'C', 'TerceroC'], ['B', 2, 'D', 'TerceroD']]) {
    await db.query(`insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values ($1,$2,$3,$4,$5)`, [m, team, pos, pid[who], name]);
  }
  const rev = (await db.query(`insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at) values ($1,1,$2,'A','created', now() - interval '1 day') returning revision_id`, [m, pid.A])).rows[0].revision_id;
  await db.query(`insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values ($1,1,1,6,2),($1,1,2,6,3)`, [m]);
  await db.query(`update public.matches set current_revision_id = $2 where match_id = $1`, [m, rev]);
  await db.query(`insert into public.match_user_state (match_id, player_id, hidden, private_note) values ($1,$2,false,'nota privada de A')`, [m, pid.A]);
  // notificaciones de A cuyo payload referencia a terceros por id (actorPlayerId) y nombre
  await db.query(`insert into public.notifications (player_id, type, match_id, payload) values ($1,'match_validated',$2,$3::jsonb)`, [pid.A, m, JSON.stringify({ actorPlayerId: pid.B, matchContext: { opponentNames: ['TerceroC', 'TerceroD'], myTeam: 'A' }, note: 'x' })]);
  // listas personales
  await db.query(`insert into public.player_saved_players (owner_player_id, saved_player_id) values ($1,$2),($3,$1)`, [pid.A, pid.B, pid.C]);
  // Intelligence: output visible + memoria/auditoría interna que NO debe exportarse
  await db.query(`insert into public.intelligence_match_outputs (player_id, match_id, source_fingerprint, rules_version, output, memory_after, audit) values ($1,$2,'fp','rv','{"headline":"Ganaste"}'::jsonb,'{"SECRETO_MEMORIA":1}'::jsonb,'{"SECRETO_AUDIT":1}'::jsonb)`, [pid.A, m]);
  // grupos: compartido A+B y solo-de-A
  const g1 = (await db.query(`insert into public.groups (name, created_by_player_id) values ('Grupo compartido', $1) returning group_id`, [pid.A])).rows[0].group_id;
  await db.query(`insert into public.group_memberships (group_id, player_id, is_admin) values ($1,$2,true),($1,$3,false)`, [g1, pid.A, pid.B]);
  const g2 = (await db.query(`insert into public.groups (name, created_by_player_id) values ('Grupo solo de A', $1) returning group_id`, [pid.A])).rows[0].group_id;
  await db.query(`insert into public.group_memberships (group_id, player_id, is_admin) values ($1,$2,true)`, [g2, pid.A]);
  // avatar + foto del grupo solo de A
  await db.query(`update public.profiles set avatar_url = $2 where player_id = $1`, [pid.A, `${pid.A}/avatar.jpg`]);
  await db.query(`insert into storage.objects (bucket_id, name) values ('avatars', $1), ('group-photos', $2)`, [`${pid.A}/avatar.jpg`, `${g2}/foto.jpg`]);
  await db.query(`update public.groups set photo_path = $2 where group_id = $1`, [g2, `${g2}/foto.jpg`]).catch(() => {});
  // un alta abandonada (>24 h, sin confirmar) y una joven; una cuenta confirmada vieja
  await db.exec(`insert into auth.users (id, email, created_at) values ('00000000-0000-4000-8000-0000000000f1','abandonada@example.test', now() - interval '30 hours'), ('00000000-0000-4000-8000-0000000000f2','joven@example.test', now() - interval '2 hours')`);
  return { pid, matchId: m, groupShared: g1, groupSolo: g2, abandoned: '00000000-0000-4000-8000-0000000000f1', young: '00000000-0000-4000-8000-0000000000f2' };
}
