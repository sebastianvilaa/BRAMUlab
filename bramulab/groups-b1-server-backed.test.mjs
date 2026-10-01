// BRAMUlab — Grupos BRAMU Fase B1 (wiring server-backed): pruebas focales.
// Ejecutar con: node --test bramulab/groups-b1-server-backed.test.mjs
//
// groups.js/auth.js/player-home.js son IIFE sin `export`: se cargan tal cual en un
// `vm.createContext` con un localStorage falso. app.js no tiene cobertura unitaria por diseño
// (necesita DOM completo): sus garantías de wiring (sin autoridad local, request guard, sin
// doble submit) se cubren con guardas estáticas sobre el código fuente, mismo mecanismo que
// refresh-server-matches-self-heal.test.mjs/login-resume-session.test.mjs.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Objetos creados dentro del vm.Context tienen otro realm: se normalizan para deepEqual.
const j = (x) => JSON.parse(JSON.stringify(x));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

function makeSandbox(extra) {
  const store = {};
  const sandbox = Object.assign({
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  }, extra || {});
  vm.createContext(sandbox);
  sandbox.__store = store;
  return sandbox;
}
function load(sandbox, files) {
  for (const f of files) vm.runInContext(read(f), sandbox, { filename: f });
  return sandbox;
}

const sb = load(makeSandbox(), ['engine.js', 'stats.js', 'store.js', 'player-home.js', 'groups.js']);
const PG = sb.PLGroups;

/* ---------------- fixtures ---------------- */
const ID = { A: 'pa', B: 'pb', C: 'pc', D: 'pd', E: 'pe' };
const identities = new Map(Object.entries(ID).map(([k, id]) => [id, { displayName: `Jugador ${k}`, username: `u_${k.toLowerCase()}` }]));
const JOIN = '2026-01-01T00:00:00.000Z';

function serverGroupDetail(overrides) {
  return Object.assign({
    groupId: 'g1', name: 'Los Pibes', createdByPlayerId: ID.A, createdAt: JOIN, updatedAt: JOIN, isAdmin: true,
    members: [
      { playerId: ID.A, isActive: true, isAdmin: true, periods: [{ joinedAt: JOIN, leftAt: null }] },
      { playerId: ID.B, isActive: true, isAdmin: false, periods: [{ joinedAt: JOIN, leftAt: '2026-02-01T00:00:00.000Z' }, { joinedAt: '2026-03-01T00:00:00.000Z', leftAt: null }] },
      { playerId: ID.C, isActive: true, isAdmin: true, periods: [{ joinedAt: JOIN, leftAt: null }] },
      { playerId: ID.D, isActive: true, isAdmin: false, periods: [{ joinedAt: JOIN, leftAt: null }] },
    ],
  }, overrides || {});
}

// Partido de servidor: A+B (equipo A) vs C+D (equipo B).
function serverMatch({ id, playedAt, sets, winnerTeam, levels }) {
  const lv = levels || {};
  return {
    matchId: id, playedAt, winnerTeam, formatId: 'classic', scoringSystem: null,
    sets: sets.map((s, i) => ({ setNumber: i + 1, gamesA: s[0], gamesB: s[1], tiebreakA: null, tiebreakB: null })),
    players: [
      { playerId: ID.A, team: 'A', position: 1, isGroupMember: true, levelBefore: lv.A ?? null },
      { playerId: ID.B, team: 'A', position: 2, isGroupMember: true, levelBefore: lv.B ?? null },
      { playerId: ID.C, team: 'B', position: 1, isGroupMember: true, levelBefore: lv.C ?? null },
      { playerId: ID.D, team: 'B', position: 2, isGroupMember: true, levelBefore: lv.D ?? null },
    ],
  };
}
const adaptMatches = (ms) => PG.adaptServerCompetitionMatches(ms, identities);
const MON = '2026-09-21'; // lunes
const at = (day, hour = 12) => new Date(`2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`).toISOString();

/* ---------------- 1) adaptador de grupo ---------------- */
test('B1-1: adaptServerGroup conserva player_id, períodos exactos y admins; nombres por player_id', () => {
  const g = PG.adaptServerGroup(serverGroupDetail(), identities);
  assert.equal(g.id, 'g1');
  assert.equal(g.createdBy, ID.A);
  assert.equal(g.isAdmin, true);
  assert.equal(g.serverBacked, true);
  const b = g.members.find((m) => m.userId === ID.B);
  assert.equal(b.name, 'Jugador B');
  assert.deepEqual(j(b.periods), [{ joinedAt: JOIN, leftAt: '2026-02-01T00:00:00.000Z' }, { joinedAt: '2026-03-01T00:00:00.000Z', leftAt: null }]);
  assert.deepEqual(j(g.members.filter((m) => m.isAdmin).map((m) => m.userId)), [ID.A, ID.C]);
  // la pertenencia temporal del motor funciona sobre la forma adaptada (hueco entre períodos)
  assert.equal(PG.isMemberActiveAt(b, '2026-02-15T00:00:00.000Z'), false);
  assert.equal(PG.isMemberActiveAt(b, '2026-06-01T00:00:00.000Z'), true);
});

test('B1-1b: sin identidad resuelta se muestra "Jugador" (nunca un nombre inventado); item de lista sin members', () => {
  const g = PG.adaptServerGroup(serverGroupDetail(), new Map());
  assert.ok(g.members.every((m) => m.name === 'Jugador'));
  const item = PG.adaptServerGroup({ groupId: 'g2', name: 'X', createdByPlayerId: ID.A, createdAt: JOIN, updatedAt: JOIN, isAdmin: false, activeMemberCount: 3 }, identities);
  assert.equal(item.members, null);
  assert.equal(item.activeMemberCount, 3);
});

/* ---------------- 2/3) Sorpresa: solo levelBefore oficial ---------------- */
test('B1-2: Sorpresa server-backed usa SOLO levelBefore (sin historial local) y respeta el umbral 0,5', () => {
  // ganan A+B (2.0 y 2.4 = 2.2) contra C+D (3.0 y 2.8 = 2.9): diff 0,7 -> Sorpresa
  const [m] = adaptMatches([serverMatch({ id: 'm', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A', levels: { A: 2.0, B: 2.4, C: 3.0, D: 2.8 } })]);
  assert.equal(PG.computeBonusSorpresa(m, []), true);
  // diff exacta 0,5 -> cuenta (>=)
  const [m2] = adaptMatches([serverMatch({ id: 'm2', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A', levels: { A: 2.0, B: 2.0, C: 2.5, D: 2.5 } })]);
  assert.equal(PG.computeBonusSorpresa(m2, []), true);
  // diff 0,4 -> no
  const [m3] = adaptMatches([serverMatch({ id: 'm3', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A', levels: { A: 2.0, B: 2.0, C: 2.4, D: 2.4 } })]);
  assert.equal(PG.computeBonusSorpresa(m3, []), false);
  // la pareja favorita ganando no es sorpresa
  const [m4] = adaptMatches([serverMatch({ id: 'm4', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'B', levels: { A: 2.0, B: 2.0, C: 3.5, D: 3.5 } })]);
  assert.equal(PG.computeBonusSorpresa(m4, []), false);
});

test('B1-2b: el camino server-backed nunca consulta el estimador simulado', () => {
  const [m] = adaptMatches([serverMatch({ id: 'm', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A', levels: { A: 2.0, B: 2.4, C: 3.0, D: 2.8 } })]);
  // historial "trampa": si se usara el simulado con estos partidos previos, el resultado cambiaría
  const trap = new Proxy([], { get() { throw new Error('legacy_simulated_level_used'); } });
  assert.doesNotThrow(() => PG.computeBonusSorpresa(m, trap));
  assert.doesNotThrow(() => PG.computeMatchPointsBreakdown(m, trap));
});

test('B1-3: falta Nivel oficial de CUALQUIER jugador => sin Sorpresa (nunca se fabrica)', () => {
  for (const missing of ['A', 'B', 'C', 'D']) {
    const levels = { A: 2.0, B: 2.0, C: 4.0, D: 4.0 };
    delete levels[missing];
    const [m] = adaptMatches([serverMatch({ id: 'm', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A', levels })]);
    assert.equal(PG.computeBonusSorpresa(m, []), false, `sin nivel de ${missing}`);
  }
  const [none] = adaptMatches([serverMatch({ id: 'm', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A' })]);
  assert.equal(PG.computeBonusSorpresa(none, []), false);
  // un levelBefore no numérico (NaN/string) tampoco cuenta
  const [bad] = adaptMatches([serverMatch({ id: 'm', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A', levels: { A: 2.0, B: 2.0, C: 4.0, D: 4.0 } })]);
  bad.players[0].levelBefore = 'x';
  assert.equal(PG.computeBonusSorpresa(bad, []), false);
});

/* ---------------- 4) 5/6/7, nunca 8 ---------------- */
test('B1-4: base 5, +1 por bonus, máximo 7; Remontada y Victoria clara nunca coinciden', () => {
  const pts = (o) => PG.computeMatchPointsBreakdown(adaptMatches([serverMatch(o)])[0], []).total;
  // normal 6-4 4-6 6-4 (ganó tras perder... no: ganó el 1º) -> 5
  assert.equal(pts({ id: 'n', playedAt: at(22), sets: [[6, 4], [4, 6], [6, 4]], winnerTeam: 'A' }), 5);
  // Victoria clara 6-1 6-2 -> 6
  assert.equal(pts({ id: 'c', playedAt: at(22), sets: [[6, 1], [6, 2]], winnerTeam: 'A' }), 6);
  // Remontada 4-6 6-3 6-2 -> 6
  assert.equal(pts({ id: 'r', playedAt: at(22), sets: [[4, 6], [6, 3], [6, 2]], winnerTeam: 'A' }), 6);
  // Clara + Sorpresa -> 7
  assert.equal(pts({ id: 'cs', playedAt: at(22), sets: [[6, 1], [6, 2]], winnerTeam: 'A', levels: { A: 2, B: 2, C: 4, D: 4 } }), 7);
  // Remontada + Sorpresa -> 7
  assert.equal(pts({ id: 'rs', playedAt: at(22), sets: [[4, 6], [6, 3], [6, 2]], winnerTeam: 'A', levels: { A: 2, B: 2, C: 4, D: 4 } }), 7);
  // exhaustivo: ningún combo supera 7 ni tiene remontada+clara a la vez
  const setsOpts = [[[6, 0], [6, 0]], [[0, 6], [6, 0], [6, 0]], [[6, 4], [6, 4]], [[3, 6], [6, 1], [6, 1]]];
  for (const sets of setsOpts) for (const lv of [undefined, { A: 1, B: 1, C: 5, D: 5 }]) {
    const b = PG.computeMatchPointsBreakdown(adaptMatches([serverMatch({ id: 'x', playedAt: at(22), sets, winnerTeam: 'A', levels: lv })])[0], []);
    assert.ok(b.total >= 5 && b.total <= 7);
    assert.ok(!(b.remontada && b.claraVictoria));
  }
});

/* ---------------- 5) top 3 / empates / Race con datos del servidor ---------------- */
function groupAndMatches(matchRows) {
  return { group: PG.adaptServerGroup(serverGroupDetail(), identities), history: adaptMatches(matchRows) };
}

test('B1-5: tabla semanal cuenta 3 mejores partidos, 3 de 4 miembros y comparte posición en empate (1,1,3)', () => {
  const week = sb.PLPlayerHome.startOfWeekMonday(new Date(`${MON}T12:00:00`));
  // 5 partidos de A+B vs C+D esa semana, ganan A+B: puntos 7,6,6,5,5 (Sorpresa/Clara/Remontada) -> cuentan 7+6+6 = 19
  const rows = [
    serverMatch({ id: 'w1', playedAt: at(22), sets: [[6, 1], [6, 2]], winnerTeam: 'A', levels: { A: 2, B: 2, C: 4, D: 4 } }), // 7
    serverMatch({ id: 'w2', playedAt: at(23), sets: [[4, 6], [6, 3], [6, 2]], winnerTeam: 'A' }), // 6
    serverMatch({ id: 'w3', playedAt: at(24), sets: [[6, 1], [6, 2]], winnerTeam: 'A' }), // 6
    serverMatch({ id: 'w4', playedAt: at(25), sets: [[6, 4], [6, 4]], winnerTeam: 'A' }), // 5
    serverMatch({ id: 'w5', playedAt: at(26), sets: [[6, 4], [6, 4]], winnerTeam: 'A' }), // 5
  ];
  const { group, history } = groupAndMatches(rows);
  const table = PG.computeWeeklyTable(history, group, week);
  const byId = Object.fromEntries(table.map((r) => [r.userId, r]));
  assert.equal(byId[ID.A].points, 19);
  assert.equal(byId[ID.B].points, 19);
  // Cierre B1, retest real (handoff 72) — pointsMatchesCounted sigue siendo el top-3 que
  // aportó a `points`; matchesPlayed/wins son la actividad REAL (los 5 partidos, todos ganados).
  assert.equal(byId[ID.A].pointsMatchesCounted, 3);
  assert.equal(byId[ID.A].matchesPlayed, 5);
  assert.equal(byId[ID.A].wins, 5);
  assert.equal(byId[ID.A].losses, 0);
  assert.equal(byId[ID.C].points, 0);
  assert.equal(byId[ID.C].matchesPlayed, 5);
  assert.equal(byId[ID.C].losses, 5, 'C perdió los 5, aunque points=0 (perder no puntúa)');
  assert.deepEqual(j(table.map((r) => r.position)), [1, 1, 3, 3]); // A,B empatan; C,D empatan en 0
});

test('B1-5b: un partido con solo 2 miembros activos en su fecha no cuenta; los períodos históricos deciden', () => {
  const week = sb.PLPlayerHome.startOfWeekMonday(new Date(`${MON}T12:00:00`));
  // B estaba FUERA del grupo entre feb y mar; un partido de febrero (A,C,D miembros + B fuera) = 3/4 cuenta;
  // pero si además D no fuera miembro, 2/4. Aquí: fecha dentro del hueco de B -> A,C,D = 3 -> cuenta.
  const g = PG.adaptServerGroup(serverGroupDetail(), identities);
  const gap = adaptMatches([serverMatch({ id: 'gap', playedAt: '2026-02-10T12:00:00.000Z', sets: [[6, 4], [6, 4]], winnerTeam: 'A' })])[0];
  assert.equal(PG.doesMatchCountForGroup(gap, g), true);
  // sacamos también a D del grupo en ese momento: 2/4 -> no cuenta
  g.members.find((m) => m.userId === ID.D).periods = [{ joinedAt: '2026-05-01T00:00:00.000Z', leftAt: null }];
  assert.equal(PG.doesMatchCountForGroup(gap, g), false);
  assert.equal(PG.computeWeeklyTable([gap], g, week).every((r) => r.points === 0), true);
});

test('B1-5c: Race anual suma los puntos semanales efectivos (top 3 por semana) de datos del servidor', () => {
  const rows = [];
  // semana del 21: 4 victorias de A+B (7,6,6,5) -> efectivo 19; semana del 28: 1 victoria (5)
  rows.push(serverMatch({ id: 'r1', playedAt: at(22), sets: [[6, 1], [6, 2]], winnerTeam: 'A', levels: { A: 2, B: 2, C: 4, D: 4 } }));
  rows.push(serverMatch({ id: 'r2', playedAt: at(23), sets: [[4, 6], [6, 3], [6, 2]], winnerTeam: 'A' }));
  rows.push(serverMatch({ id: 'r3', playedAt: at(24), sets: [[6, 1], [6, 2]], winnerTeam: 'A' }));
  rows.push(serverMatch({ id: 'r4', playedAt: at(25), sets: [[6, 4], [6, 4]], winnerTeam: 'A' }));
  rows.push(serverMatch({ id: 'r5', playedAt: '2026-09-29T12:00:00', sets: [[6, 4], [6, 4]], winnerTeam: 'A' }));
  const { group, history } = groupAndMatches(rows);
  const race = PG.computeRaceAnual(history, group, 2026);
  assert.equal(race.find((r) => r.userId === ID.A).points, 19 + 5);
  assert.equal(race[0].position, 1);
});

test('B1-5d: Intelligence usa nombres resueltos por player_id y no inventa Sorpresa sin Nivel', () => {
  const week = sb.PLPlayerHome.startOfWeekMonday(new Date(`${MON}T12:00:00`));
  const { group, history } = groupAndMatches([serverMatch({ id: 'i', playedAt: at(22), sets: [[6, 4], [6, 4]], winnerTeam: 'A' })]);
  const table = PG.computeWeeklyTable(history, group, week);
  const current = PG.computeMatchesForGroupInWeek(history, group, week);
  const out = PG.buildGroupIntelligence({ currentTable: table, previousTable: [], raceTable: table, currentMatches: current, fullHistory: history });
  assert.ok(out.length >= 1);
  assert.ok(out.every((t) => !/sorpresa/i.test(t)), 'sin Nivel oficial no hay insight de sorpresa');
});

/* ---------------- 6) cliente RPC ---------------- */
function makeAuth(rpcImpl) {
  const calls = [];
  const auth = makeSandbox({
    __BRAMU_ENV__: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' },
    supabase: { createClient: () => ({ rpc: async (name, params) => { calls.push({ name, params }); return rpcImpl(name, params); } }) },
  });
  load(auth, ['auth.js']);
  return { Auth: auth.PLAuth, calls };
}

test('B1-6: el cliente llama al contrato correcto (nombre + parámetros) y mapea errores a {ok:false, code}', async () => {
  const { Auth, calls } = makeAuth(async (name) => ({ data: { ok: true, group: { groupId: 'g' }, groups: [], matches: [] }, error: null }));
  await Auth.listMyGroups();
  await Auth.getGroupDetail('g1');
  await Auth.createGroup('Nombre', ['p1', 'p2']);
  await Auth.renameGroup('g1', 'Otro');
  await Auth.addGroupMember('g1', 'p3');
  await Auth.removeGroupMember('g1', 'p3');
  await Auth.promoteGroupAdmin('g1', 'p3');
  await Auth.demoteGroupAdmin('g1', 'p3');
  await Auth.deleteGroup('g1');
  await Auth.getGroupCompetitionData('g1');
  assert.deepEqual(j(calls.map((c) => c.name)), ['list_my_groups', 'get_group_detail', 'create_group', 'rename_group', 'add_group_member',
    'remove_group_member', 'promote_group_admin', 'demote_group_admin', 'delete_group', 'get_group_competition_data']);
  assert.deepEqual(j(calls[2].params), { p_name: 'Nombre', p_member_player_ids: ['p1', 'p2'] });
  assert.deepEqual(j(calls[4].params), { p_group_id: 'g1', p_player_id: 'p3' });
  assert.deepEqual(j(calls[9].params), { p_group_id: 'g1', p_from: null, p_to: null });

  const biz = makeAuth(async () => ({ data: { ok: false, code: 'last_admin' }, error: null }));
  assert.deepEqual(j(await biz.Auth.demoteGroupAdmin('g', 'p')), { ok: false, code: 'last_admin' });
  const transport = makeAuth(async () => ({ data: null, error: { message: 'rate_limited' } }));
  assert.deepEqual(j(await transport.Auth.createGroup('x', [])), { ok: false, code: 'rate_limited' });
  const thrown = makeAuth(async () => { throw new Error('offline'); });
  assert.deepEqual(j(await thrown.Auth.listMyGroups()), { ok: false, code: 'network_error' });
  const none = makeAuth(async () => ({ data: null, error: null }));
  assert.deepEqual(j(await none.Auth.listMyGroups()), { ok: false, code: 'unknown' });
});

test('B1-6b: sin backend configurado el cliente responde not_configured (camino legacy intacto)', async () => {
  const bare = load(makeSandbox(), ['auth.js']);
  assert.deepEqual(j(await bare.PLAuth.listMyGroups()), { ok: false, code: 'not_configured' });
});

/* ---------------- 7) guardas estáticas del wiring en app.js ---------------- */
const appJs = read('app.js');
const groupsBlock = appJs.slice(appJs.indexOf('/* BRAMUlab_V03.4 — MIS GRUPOS'), appJs.indexOf('V02.1 (§22) — VISTAS "COMPAÑEROS"'));

test('B1-7a: ninguna mutación de grupo server-backed escribe en Store/localStorage', () => {
  const serverFns = ['submitCreateGroupServer', 'runGroupMutation', 'refreshGroupsFromServer', 'loadGroupServerData', 'renderCreateGroupPlayerListServer'];
  for (const fn of serverFns) {
    const start = groupsBlock.indexOf(`function ${fn}`);
    assert.ok(start > 0, fn);
    const body = groupsBlock.slice(start, groupsBlock.indexOf('\n  }\n', start));
    assert.doesNotMatch(body, /Store\.(createGroup|renameGroup|addGroupMember|removeGroupMember|promoteGroupAdmin|demoteGroupAdmin|deleteGroup|saveGroupsList|loadGroups)/, fn);
    assert.doesNotMatch(body, /localStorage/, fn);
  }
  // el camino server-backed de listado/lectura nunca lee la lista local
  assert.match(groupsBlock, /function myActiveGroups\(\) \{\n    if \(groupsUseServer\(\)\) return groupsServer\.list;/);
  assert.match(groupsBlock, /function getGroupForUI\(id\) \{[\s\S]*?if \(groupsUseServer\(\)\) return groupsServer\.details\.get/);
});

test('B1-7b: cada CRUD server-backed llama al contrato correcto y el servidor decide el último admin', () => {
  assert.match(groupsBlock, /Auth\.createGroup\(/);
  assert.match(groupsBlock, /Auth\.addGroupMember\(/);
  assert.match(groupsBlock, /Auth\.renameGroup\(/);
  assert.match(groupsBlock, /Auth\.removeGroupMember\(/);
  assert.match(groupsBlock, /Auth\.promoteGroupAdmin\(/);
  assert.match(groupsBlock, /Auth\.demoteGroupAdmin\(/);
  assert.match(groupsBlock, /Auth\.deleteGroup\(/);
  assert.match(groupsBlock, /Auth\.getGroupCompetitionData\(/);
  // la fuente deportiva del grupo server-backed es get_group_competition_data, no el historial personal
  assert.match(groupsBlock, /const fullHistory = server \? groupsServer\.competition\.get\(group\.id\) : getComputableHistory\(\);/);
  // admin: el servidor decide (group.isAdmin), no el cache de membresías local
  assert.match(groupsBlock, /if \(group\.serverBacked\) return !!group\.isAdmin;/);
});

test('B1-7c: guardas de respuesta tardía y doble submit', () => {
  assert.match(groupsBlock, /groupsListRequestId/);
  assert.match(groupsBlock, /groupPickerRequestId/);
  assert.match(groupsBlock, /if \(groupsBusy\) return/);
  // datos por grupo indexados por groupId + repintado solo si sigue siendo el grupo activo
  assert.match(groupsBlock, /if \(groupId && groupId !== activeGroupId\) return;/);
  // no se muestra ninguna tabla mientras el grupo activo no tiene sus datos compartidos
  assert.match(groupsBlock, /groupsServer\.competition\.has\(activeGroupId\)/);
});

test('B1-7d: el camino server-backed no usa el Nivel simulado ni fabrica @usuario', () => {
  assert.doesNotMatch(groupsBlock.slice(groupsBlock.indexOf('function loadGroupServerData')), /computeSimulatedLevelBeforeMatch/);
  assert.match(groupsBlock, /ident\.serverBacked \? null : buildPlayerHandle/);
});

test('B1-8: bundle consistente en los cuatro puntos', () => {
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.20-h5'/);
  assert.match(read('version.json'), /"bundle":\s*"04\.20-h5"/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-20-h5'/);
  assert.match(read('index.html'), /groups\.js\?v=04\.20-h5/);
  assert.match(read('index.html'), /auth\.js\?v=04\.20-h5/);
});


test('B1-h29: al cambiar a un grupo todavía no cargado se limpian los paneles anteriores', () => {
  assert.match(appJs, /function clearGroupPanelsWhileLoading\(\)/);
  assert.match(appJs, /if \(server && \(!group\.members \|\| !groupsServer\.competition\.has\(group\.id\)\)\) \{[\s\S]*clearGroupPanelsWhileLoading\(\);[\s\S]*return;/);
  assert.match(appJs, /groups-intel-actual-title'\)\.textContent = group\.name/);
});
