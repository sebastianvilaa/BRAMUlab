// BRAMUlab V04.25 — Grupos: Americano, top 2 semanal, ayuda/copies + scroll de Editar datos.
// Ejecutar con: node --test bramulab/tests/groups-v0423-americano-top2-scroll.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
vm.createContext(sb);
for (const f of ['engine.js', 'stats.js', 'store.js', 'player-home.js', 'groups.js']) vm.runInContext(read(f), sb, { filename: f });
const PG = sb.PLGroups;
const PH = sb.PLPlayerHome;

const THIS_MON = PH.startOfWeekMonday(new Date('2026-09-21T12:00:00'));
const iso = (day, hour = 10) => new Date(`2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
const LONG_AGO = '2026-01-05T00:00:00.000Z';
const member = (name, userId) => ({ name, userId, isAdmin: false, periods: [{ joinedAt: LONG_AGO, leftAt: null }] });
const GROUP = { id: 'g', members: [member('A', 'a'), member('B', 'b'), member('C', 'c'), member('D', 'd')] };

/** levels = [A,B,C,D] Nivel previo oficial (null = sin dato). */
function mk(id, day, formatId, sets, winnerTeam, levels, hour) {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    matchId: id, playedAt: iso(day, hour || 10), winnerTeam: winnerTeam || 'A', regulationCompleted: true, formatId,
    levelsSource: 'official',
    sets: sets.map(([gamesA, gamesB]) => ({ gamesA, gamesB })),
    players: ids.map((u, i) => ({ id: i, team: i < 2 ? 'A' : 'B', userId: u, name: u.toUpperCase(), levelBefore: levels ? levels[i] : null })),
  };
}
const pts = (m) => PG.computeMatchPointsBreakdown(m, [m]);
const flat = [3, 3, 3, 3];

/* ---------------- CLÁSICO: sin regresión ---------------- */
test('Clásico: victoria normal 5, derrota 0 para el perdedor', () => {
  const m = mk('c1', 21, 'classic', [[6, 4], [6, 4]], 'A', flat);
  assert.equal(pts(m).total, 5);
  assert.equal(PG.computePointsForPlayerInMatch(m, { name: 'C', userId: 'c' }, [m]), 0);
});
test('Clásico: sorpresa >=0.5, remontada, clara y máximo 7', () => {
  assert.equal(pts(mk('c2', 21, 'classic', [[6, 4], [6, 4]], 'A', [3, 3, 3.5, 3.5])).total, 6);
  assert.equal(pts(mk('c3', 21, 'classic', [[6, 4], [6, 4]], 'A', [3, 3, 3.49, 3.49])).total, 5);
  assert.equal(pts(mk('c4', 21, 'classic', [[4, 6], [6, 3], [6, 2]], 'A', flat)).total, 6);
  assert.equal(pts(mk('c5', 21, 'classic', [[6, 1], [6, 2]], 'A', flat)).total, 6);
  assert.equal(pts(mk('c6', 21, 'classic', [[6, 1], [6, 2]], 'A', [3, 3, 4, 4])).total, 7);
});
test('formato desconocido/ausente se comporta como Clásico (no hereda Americano)', () => {
  assert.equal(pts(mk('x1', 21, undefined, [[6, 4]], 'A', flat)).total, 5);
  assert.equal(pts(mk('x2', 21, 'to15', [[6, 4]], 'A', flat)).total, 5);
});

/* ---------------- AMERICANO ---------------- */
test('Americano: victoria normal 3, derrota 0', () => {
  const m = mk('a1', 21, 'americano', [[6, 4]], 'A', flat);
  assert.equal(pts(m).total, 3);
  assert.equal(PG.computePointsForPlayerInMatch(m, { name: 'C', userId: 'c' }, [m]), 0);
});
test('Americano: sorpresa 0.99 NO suma, 1.00 SÍ', () => {
  assert.equal(pts(mk('a2', 21, 'americano', [[6, 4]], 'A', [3, 3, 3.99, 3.99])).total, 3);
  assert.equal(pts(mk('a3', 21, 'americano', [[6, 4]], 'A', [3, 3, 4, 4])).total, 4);
  assert.equal(pts(mk('a3b', 21, 'americano', [[6, 4]], 'A', [3, 3, 4, 4])).sorpresa, true);
  assert.equal(pts(mk('a3c', 21, 'americano', [[6, 4]], 'A', [3, 3, 3.5, 3.5])).sorpresa, false);
});
test('Americano: clara solo 6-0/6-1/6-2; 6-3, 6-4, 6-5 no', () => {
  [[6, 0], [6, 1], [6, 2]].forEach((s, i) => assert.equal(pts(mk('ac' + i, 21, 'americano', [s], 'A', flat)).total, 4, s.join('-')));
  [[6, 3], [6, 4], [6, 5]].forEach((s, i) => assert.equal(pts(mk('an' + i, 21, 'americano', [s], 'A', flat)).total, 3, s.join('-')));
});
test('Americano: clara también si gana el equipo B', () => {
  assert.equal(pts(mk('ab', 21, 'americano', [[1, 6]], 'B', flat)).total, 4);
});
test('Americano: remontada nunca; clara+sorpresa = 5; nunca supera 5', () => {
  const m = mk('a5', 21, 'americano', [[6, 1]], 'A', [3, 3, 4.5, 4.5]);
  const b = pts(m);
  assert.equal(b.remontada, false);
  assert.equal(b.total, 5);
  assert.equal(PG.computeBonusRemontada(mk('a6', 21, 'americano', [[4, 6], [6, 3]], 'A', flat)), false);
  assert.equal(PG.computeBonusVictoriaClara(mk('a7', 21, 'americano', [[6, 1], [6, 1]], 'A', flat)), false, 'solo 1 set');
});
test('Americano: sin Nivel oficial no hay sorpresa (no se inventa)', () => {
  assert.equal(pts(mk('a8', 21, 'americano', [[6, 4]], 'A', null)).total, 3);
});

/* ---------------- TOP 2 SEMANAL ---------------- */
function week(matches) {
  const table = PG.computeWeeklyTable(matches, GROUP, THIS_MON);
  return { table, byId: Object.fromEntries(table.map((r) => [r.userId, r])) };
}
test('Top 2: 1 partido cuenta 1, 2 cuentan 2, 3+ solo los 2 mejores', () => {
  const m1 = mk('t1', 21, 'classic', [[6, 4], [6, 4]], 'A', flat); // 5
  assert.equal(week([m1]).byId.a.points, 5);
  assert.equal(week([m1]).byId.a.pointsMatchesCounted, 1);
  const m2 = mk('t2', 22, 'classic', [[6, 1], [6, 2]], 'A', flat); // 6
  assert.equal(week([m1, m2]).byId.a.points, 11);
  const m3 = mk('t3', 23, 'americano', [[6, 4]], 'A', flat); // 3
  const m4 = mk('t4', 24, 'classic', [[6, 1], [6, 2]], 'A', flat); // 6
  const w = week([m1, m2, m3, m4]);
  assert.equal(w.byId.a.points, 12);
  assert.equal(w.byId.a.pointsMatchesCounted, 2);
  // actividad REAL: todos los calificables
  assert.equal(w.byId.a.matchesPlayed, 4);
  assert.equal(w.byId.a.wins, 4);
  assert.equal(w.byId.c.losses, 4);
});
test('Top 2: empate en el corte — total estable sea cual sea el marcado counted', () => {
  const ms = [mk('e1', 21, 'classic', [[6, 4], [6, 4]], 'A', flat), mk('e2', 22, 'classic', [[6, 4], [6, 4]], 'A', flat), mk('e3', 23, 'classic', [[6, 4], [6, 4]], 'A', flat)];
  assert.equal(week(ms).byId.a.points, 10);
  assert.equal(week(ms.slice().reverse()).byId.a.points, 10);
});
test('Top 2: desglose muestra todos, solo 2 counted; Race suma top-2', () => {
  const ms = [mk('d1', 21, 'classic', [[6, 4], [6, 4]], 'A', flat), mk('d2', 22, 'classic', [[6, 1], [6, 2]], 'A', flat), mk('d3', 23, 'americano', [[6, 4]], 'A', flat)];
  const inWeek = PG.computeMatchesForGroupInWeek(ms, GROUP, THIS_MON);
  const bd = PG.buildPlayerWeeklyBreakdown(inWeek, { name: 'A', userId: 'a' }, ms);
  assert.equal(bd.rows.length, 3);
  assert.equal(bd.rows.filter((r) => r.counted).length, 2);
  assert.equal(bd.total, 11);
  const race = PG.computeRaceAnual(ms, GROUP, 2026);
  assert.equal(race.find((r) => r.userId === 'a').points, 11);
  assert.equal(PG.MAX_COUNTED_MATCHES_PER_WEEK, 2);
});
test('3/4: con 3 miembros entra, con 2 no', () => {
  const m = mk('q1', 21, 'classic', [[6, 4], [6, 4]], 'A', flat);
  const g3 = { id: 'g', members: [member('A', 'a'), member('B', 'b'), member('C', 'c')] };
  const g2 = { id: 'g', members: [member('A', 'a'), member('B', 'b')] };
  assert.equal(PG.doesMatchCountForGroup(m, g3), true);
  assert.equal(PG.doesMatchCountForGroup(m, g2), false);
});
test('adaptador del servidor conserva formatId', () => {
  const out = PG.adaptServerCompetitionMatches([{ matchId: 'm', playedAt: iso(21), winnerTeam: 'A', formatId: 'americano', sets: [{ gamesA: 6, gamesB: 1 }], players: [] }], {});
  assert.equal(out[0].formatId, 'americano');
});

/* ---------------- COPY ---------------- */
test('copy: ningún "3 mejores" visible; ayuda + estado cero + lobby coherentes', () => {
  const html = read('index.html'), app = read('app.js');
  assert.doesNotMatch(html, /3 mejores/);
  assert.doesNotMatch(app, /3 mejores/);
  assert.match(html, /Jugá, ganá, sumá/);
  assert.match(html, /Cada victoria suma\. Algunos resultados pueden darte puntos extra\./);
  assert.match(html, /Cuentan tus 2 mejores partidos\./);
  assert.doesNotMatch(html, /Ganá y sumá/);
  assert.doesNotMatch(app, /No entra en tus 2 mejores/);
  const sheet = html.slice(html.indexOf('id="group-points-info-sheet"'), html.indexOf('id="profile-picker-sheet-scrim"'));
  ['Jugá como siempre. BRAMU hace el resto.', 'BRAMU detecta los partidos', 'Cada semana cuentan tus 2 mejores partidos', 'Nueva semana, nueva tabla', 'Cómo sumás puntos', 'Clásico', 'Americano', 'No aplica en Americano'].forEach((t) => assert.ok(sheet.includes(t), t));
});

/* ---------------- EDITAR DATOS: scroll ---------------- */
test('Editar datos: vista acotada al viewport y .access-scroll scrolleable con safe-area + bottom-nav', () => {
  const css = read('styles.css');
  const viewRule = css.match(/#view-edit-data[^{]*\{([^}]*)\}/g).find((r) => /max-height:100dvh/.test(r));
  assert.ok(viewRule, 'regla de vista');
  assert.match(viewRule, /height:100dvh/);
  assert.match(viewRule, /min-height:0/);
  assert.match(viewRule, /overflow:hidden/);
  const scrollRule = css.match(/#view-edit-data \.access-scroll[^{]*\{([^}]*)\}/)[0];
  assert.match(scrollRule, /min-height:0/);
  assert.match(scrollRule, /overflow-y:auto/);
  assert.match(scrollRule, /-webkit-overflow-scrolling:touch/);
  assert.match(scrollRule, /--safe-bottom/);
  assert.match(scrollRule, /--bottomnav-h/);
  assert.doesNotMatch(scrollRule, /overflow:hidden/, 'el scroller nunca es overflow:hidden');
});
test('Editar datos: GUARDAR está dentro del .access-scroll', () => {
  const html = read('index.html');
  const start = html.indexOf('id="view-edit-data"');
  const end = html.indexOf('</section>', start);
  const sec = html.slice(start, end);
  const scrollAt = sec.indexOf('class="access-scroll');
  assert.ok(scrollAt > 0);
  assert.ok(sec.indexOf('>GUARDAR<') > scrollAt);
  // el cierre del scroller es lo último de la sección: no hay otro </div> de nivel del scroller antes de GUARDAR
  let depth = 0; const body = sec.slice(scrollAt - 5); const re = /<div\b|<\/div>/g; let m, saveAt = body.indexOf('>GUARDAR<'), inside = true;
  while ((m = re.exec(body)) && m.index < saveAt) { depth += m[0] === '</div>' ? -1 : 1; if (depth <= 0) { inside = false; break; } }
  assert.ok(inside, 'GUARDAR dentro del contenedor scrolleable');
});
test('Vistas con bottom-nav comparten el patrón (Completar acceso, Cambiar contraseña) y Configuración del grupo sigue igual', () => {
  const css = read('styles.css');
  ['#view-complete-access', '#view-change-password'].forEach((v) => assert.ok(css.includes(`${v} .access-scroll`), v));
  assert.match(css, /#view-group-settings\{ height:100vh; height:100dvh;/);
});
