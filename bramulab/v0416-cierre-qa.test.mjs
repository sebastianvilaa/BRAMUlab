// BRAMUlab — V04.16 (ronda acumulada cierre QA general, Issue #9): pruebas focales.
// Ejecutar con: node --test bramulab/v0416-cierre-qa.test.mjs
//
// Identidad por player_id (Issue #8) y delta real de Nivel (Issue #7) se verifican contra Postgres en
// supabase/tests/verify-preprod-v0416-identidad-nivel.sql. app.js se cubre con guardas estáticas y
// extracción de funciones puras (sin DOM), igual que el resto de las suites.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const css = read('styles.css');
const indexHtml = read('index.html');
function fnBody(src, sig, len = 3000) { const i = src.indexOf(sig); assert.ok(i >= 0, sig); return src.slice(i, i + len); }
function extract(sig, endSig) { const i = appJs.indexOf(sig); const j = appJs.indexOf(endSig, i); assert.ok(i >= 0 && j > i, sig); return appJs.slice(i, j); }

/* ---------------- Grupos: scroll de Configuración ---------------- */
test('Grupos: Configuración acota la vista al viewport y scrollea el área interna reservando la bottom-nav', () => {
  assert.match(css, /#view-group-settings\{[^}]*height:100dvh;[^}]*min-height:0;[^}]*max-height:100dvh;[^}]*overflow:hidden;/);
  const scroller = css.match(/#view-group-settings \.access-scroll\{\s*flex:1 1 auto; min-height:0; overflow-y:auto;[^}]*padding-bottom: calc\(28px \+ var\(--safe-bottom\) \+ var\(--bottomnav-h, 0px\)\);/);
  assert.ok(scroller, 'scroller interno con overflow y despeje de bottom-nav sin hardcodear alturas');
  // "SALIR DEL GRUPO" es el último elemento dentro de ese scroller
  const html = indexHtml.slice(indexHtml.indexOf('id="view-group-settings"'));
  assert.ok(html.indexOf('class="access-scroll') < html.indexOf('id="group-settings-leave-btn"'));
  assert.ok(html.indexOf('id="group-settings-leave-btn"') < html.indexOf('</section>'));
});

/* ---------------- Grupos: tabs ---------------- */
test('Grupos: las 3 pestañas se reparten el ancho (sin scroll horizontal) y "Race anual" entra completa', () => {
  assert.match(css, /#groups-view-tabs\{ display:flex; \}/);
  assert.match(css, /#groups-view-tabs \.history-tab\{ flex:1 1 0; min-width:0;/);
  assert.match(indexHtml, /data-view="race" role="tab" aria-selected="false">Race anual</);
});

/* ---------------- Grupos: < 3 miembros ---------------- */
test('Grupos <3: estado contextual (1 o 2 miembros activos, sin puntos) en vez de ranking 0 pts; con 3+ o con puntos reales, contenido competitivo', () => {
  const fnSrc = fnBody(appJs, '  function applyGroupBelowThreeState', 1600);
  const end = fnSrc.indexOf('\n  }\n') + 4;
  const body = fnSrc.slice(0, end);
  const els = {};
  const mkEl = () => ({ hidden: true, innerHTML: '', classes: new Set(), classList: { toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, _s: null } });
  ['actual', 'anterior', 'race'].forEach((k) => {
    const panel = mkEl(); panel.classList._s = panel.classes;
    els[`#groups-panel-${k}`] = panel; els[`#groups-state-${k}`] = mkEl();
  });
  const PG = { isMemberActiveAt: (m) => !m.left };
  const run = (members, tables) => {
    const fn = new Function('PG', '$', 'buildLobbyCardStateHTML', 'buildBelowThreeMembersHTML', `${body}; return applyGroupBelowThreeState;`)(PG, (s) => els[s], (st) => `<state:${st}>`, () => '');
    fn({ members }, tables);
  };
  const noPts = [{ points: 0 }, { points: 0 }];
  const withPts = [{ points: 7 }, { points: 0 }];
  // 2 miembros, sin puntos: las 3 superficies muestran el estado "Ya son 2"
  run([{}, {}], { actual: noPts, anterior: [], race: noPts });
  ['actual', 'anterior', 'race'].forEach((k) => {
    assert.equal(els[`#groups-state-${k}`].hidden, false, k);
    assert.equal(els[`#groups-state-${k}`].innerHTML, '<state:two_members>');
    assert.ok(els[`#groups-panel-${k}`].classes.has('is-below-three'));
  });
  // 1 miembro
  run([{}], { actual: noPts, anterior: [], race: [] });
  assert.equal(els['#groups-state-actual'].innerHTML, '<state:one_member>');
  // 2 miembros pero con puntos reales esa semana (el grupo bajó a 2): se conserva la tabla real
  run([{}, {}], { actual: withPts, anterior: [], race: withPts });
  assert.equal(els['#groups-state-actual'].hidden, true);
  assert.ok(!els['#groups-panel-actual'].classes.has('is-below-three'));
  assert.equal(els['#groups-state-anterior'].hidden, false, 'sin puntos la semana pasada => estado contextual');
  // al llegar a 3 miembros vuelve automáticamente al contenido competitivo
  run([{}, {}, {}], { actual: noPts, anterior: [], race: noPts });
  ['actual', 'anterior', 'race'].forEach((k) => {
    assert.equal(els[`#groups-state-${k}`].hidden, true, `3 miembros: ${k} vuelve a lo competitivo`);
    assert.ok(!els[`#groups-panel-${k}`].classes.has('is-below-three'));
  });
  // los que ya salieron no cuentan
  run([{}, {}, { left: true }], { actual: noPts, anterior: [], race: noPts });
  assert.equal(els['#groups-state-actual'].hidden, false);
});

test('Grupos <3: copy real reutilizada del lobby y las tablas/Intelligence se ocultan por CSS sin tocar puntos ni Race', () => {
  assert.match(fnBody(appJs, '  function buildLobbyCardStateHTML', 700), /Ya son 2\. Falta uno para empezar a sumar\./);
  assert.match(css, /\.groups-panel\.is-below-three \.groups-intel-card,[\s\S]*?\.groups-race-title\{ display:none !important; \}/);
  ['actual', 'anterior', 'race'].forEach((k) => assert.match(indexHtml, new RegExp(`id="groups-state-${k}" hidden`)));
  assert.match(fnBody(appJs, '  function clearGroupPanelsWhileLoading', 600), /groups-state-\$\{key\}/);
  // la decisión vive en render; no toca PG.compute*
  const fn = fnBody(appJs, '  function applyGroupBelowThreeState', 1600);
  assert.doesNotMatch(fn, /computeWeeklyTable|computeRaceAnual|computePlayerScoredMatches/);
});

/* ---------------- Home: delta real de Nivel ---------------- */
test('Home: el chip ↑/↓ sale SOLO del delta real server-backed; sin evidencia (o ±0.0) queda oculto', () => {
  const src = extract('  function homeLevelDeltaValue', '  function renderPlayerCard');
  const make = (user, last) => new Function('Store', 'lastLevelDeltaV1', `${src}; return homeLevelDeltaValue;`)({ getCurrentUser: () => user }, last)();
  assert.equal(make({ id: 'u1' }, { userId: 'u1', delta: null }), 0, 'sin evidencia => 0');
  assert.equal(make({ id: 'u1' }, { userId: 'u1', delta: 0.04 }), 0, 'redondea a 0.0 => sin chip');
  assert.equal(make({ id: 'u1' }, { userId: 'u1', delta: 0.31 }), 0.3);
  assert.equal(make({ id: 'u1' }, { userId: 'u1', delta: -0.26 }), -0.3);
  assert.equal(make({ id: 'u1' }, { userId: 'u2', delta: 0.5 }), 0, 'el delta de otro usuario nunca se muestra');
  assert.equal(make(null, { userId: 'u1', delta: 0.5 }), 0);
});

test('Home: la barra V1 calibrada usa homeLevelDeltaValue (real) y NUNCA PH.computeLevelEvolution (simulado) para el chip', () => {
  const branch = fnBody(appJs, '        // V04.16 (Issue #7) — chip ↑/↓', 1200);
  assert.match(branch, /homeLevelDeltaValue\(\)/);
  assert.match(branch, /formatLevelDelta\(realDelta\)/);
  assert.doesNotMatch(branch, /computeLevelEvolution/);
  // se alimenta desde el choke point de refresh server-backed, con evidencia real
  assert.match(fnBody(appJs, 'async function refreshLastLevelDelta', 600), /Auth\.getMyLastLevelDelta\(\)/);
  assert.match(fnBody(appJs, '    updateHistoryUnseenDot();\n    await refreshLastLevelDelta();', 120), /refreshLastLevelDelta/);
});

test('Auth.getMyLastLevelDelta: parsea delta real y null sin evidencia', async () => {
  const mk = (data, error) => {
    const sb = { __BRAMU_ENV__: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'a' },
      supabase: { createClient: () => ({ rpc: async (name) => { sb.__name = name; return { data, error: error || null }; } }) },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
    vm.createContext(sb); vm.runInContext(read('auth.js'), sb); return sb;
  };
  let sb = mk({ ok: true, delta: 0.3 });
  assert.deepEqual(JSON.parse(JSON.stringify(await sb.PLAuth.getMyLastLevelDelta())), { ok: true, delta: 0.3 });
  assert.equal(sb.__name, 'get_my_last_level_delta');
  sb = mk({ ok: true, delta: null });
  assert.deepEqual(JSON.parse(JSON.stringify(await sb.PLAuth.getMyLastLevelDelta())), { ok: true, delta: null });
  sb = mk(null, { message: 'boom' });
  assert.equal((await sb.PLAuth.getMyLastLevelDelta()).ok, false, 'un error nunca fabrica un delta');
});

/* ---------------- Home: carrusel ---------------- */
test('Home: una sola tarjeta => full-width; 2+ conserva el carrusel; nunca se inventa un insight', () => {
  const fn = fnBody(appJs, '  function renderPlayerHomeCarousel', 6500);
  assert.match(fn, /classList\.toggle\('player-home-carousel--single', track\.querySelectorAll\('\.player-home-carousel-card'\)\.length === 1\)/);
  assert.match(css, /\.player-home-carousel\.player-home-carousel--single \.player-home-carousel-card\{ flex-basis: 100%; \}/);
  assert.match(css, /\.player-home-carousel-card\{\s*flex: 0 0 60%;/, 'la geometría de carrusel (60%) se conserva');
  assert.doesNotMatch(fn, /Math\.random|genérico|placeholder/i);
});

/* ---------------- Identidad (backend) ---------------- */
test('Identidad: la migración resuelve SOLO por player_id, nunca por nombre, y no reescribe snapshots', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260930220000_preprod_v0416_identidad_nivel.sql'), 'utf8');
  const code = sql.replace(/--.*$/gm, '');
  assert.equal((code.match(/_match_participant_display_name\(mp2?\.player_id, mp2?\.display_name_snapshot\)/g) || []).length, 3, 'get_my_matches + get_match_detail + matchContext');
  assert.match(code, /pl\.type = 'registered'\s+and pl\.is_active\s+and pl\.deleted_at is null/);
  assert.doesNotMatch(code, /update\s+public\.match_participants/i, 'sin reescritura de snapshots');
  assert.doesNotMatch(code, /where[^;]*display_name\s*=\s*mp/i, 'nunca join por nombre');
  assert.match(code, /function public\.get_my_last_level_delta/);
  assert.match(code, /r\.effect_status = 'applied'\s+and r\.eligible/);
  assert.doesNotMatch(code, /computeLevelEvolution|simulad/i);
});

/* ---------------- Notificaciones: sin cambios ---------------- */
test('Notificaciones: el comportamiento vigente no se toca (abrir la bandeja no marca todo como leído)', () => {
  const before = appJs.indexOf('function openNotificationsScreen');
  assert.ok(before > 0);
  const body = fnBody(appJs, 'function openNotificationsScreen', 1500);
  const own = body.slice(0, body.indexOf('\n  }\n'));
  assert.doesNotMatch(own, /markAllNotificationsRead|markAllRead\(|markAllAsRead/);
});
