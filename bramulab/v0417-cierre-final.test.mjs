// BRAMUlab — V04.17 (Issue #11, cierre correctivo final de QA general): pruebas focales.
// Ejecutar con: node --test bramulab/v0417-cierre-final.test.mjs
// El delta público se verifica contra Postgres en supabase/tests/verify-preprod-v0417-delta-publico.sql.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const css = read('styles.css');
const indexHtml = read('index.html');
function fnBody(src, sig, len = 3000) { const i = src.indexOf(sig); assert.ok(i >= 0, sig); return src.slice(i, i + len); }
function extract(sig, endSig) { const i = appJs.indexOf(sig); const j = appJs.indexOf(endSig, i); assert.ok(i >= 0 && j > i, sig); return appJs.slice(i, j); }
const stripSqlComments = (s) => s.replace(/--.*$/gm, '');

/* ---------------- 1. Home: delta público ---------------- */
test('Delta público (backend): último cambio REAL que movió el Nivel visible a 1 decimal; sin cambio público => null', () => {
  const sql = stripSqlComments(read('../supabase/migrations/20260930240000_preprod_v0417_delta_publico_nivel.sql'));
  assert.match(sql, /and round\(rp\.formula_mu_before, 1\) <> round\(rp\.mu_after, 1\)/);
  assert.match(sql, /r\.effect_status = 'applied'\s+and r\.eligible/);
  assert.match(sql, /'delta', v_row\.public_after - v_row\.public_before/, 'delta = diferencia de niveles públicos, nunca el microdelta interno');
  assert.match(sql, /jsonb_build_object\('ok', true, 'delta', null\)/);
  assert.doesNotMatch(sql, /computeLevelEvolution|simulad/i, 'nunca el motor legacy');
});

test('Delta público (cliente): 6.0→5.9 = ↓0.1; 5.8→5.9 = ↑0.1; nunca ±0.0; sin delta no hay chip', () => {
  const src = extract('  function homeLevelDeltaValue', '  function renderPlayerCard');
  const fmt = extract('  function formatLevelDelta', '  // V02.4 (Bloque A, §3.2)');
  const make = (last) => new Function('Store', 'lastLevelDeltaV1', `${src}; return homeLevelDeltaValue;`)({ getCurrentUser: () => ({ id: 'u1' }) }, last)();
  const format = new Function(`${fmt}; return formatLevelDelta;`)();
  // valores tal cual los devuelve el RPC (múltiplos de 0.1)
  assert.deepEqual(format(make({ userId: 'u1', delta: -0.1 })), { label: '↓ 0.1', direction: 'down' });
  assert.deepEqual(format(make({ userId: 'u1', delta: 0.1 })), { label: '↑ 0.1', direction: 'up' });
  assert.equal(make({ userId: 'u1', delta: null }), 0);
  assert.equal(make({ userId: 'u1', delta: 0 }), 0, 'nunca +0.0 / -0.0');
  assert.equal(make({ userId: 'u2', delta: 0.2 }), 0, 'solo del usuario actual');
  const chipAll = fnBody(appJs, '        // V04.16 (Issue #7) — chip', 1300);
  const chip = chipAll.slice(0, chipAll.indexOf('      } else {'));
  assert.match(chip, /homeLevelDeltaValue\(\)/);
  assert.doesNotMatch(chip, /computeLevelEvolution/);
});

/* ---------------- 2. Grupos <3: miembros reales ---------------- */
test('Grupos <3 (detalle): muestra los integrantes reales (avatar/fallback + nombre + @usuario) sin ranking/medalla/puntos; 3+ vuelve a lo competitivo', () => {
  const box = fnBody(appJs, '  function applyGroupBelowThreeState', 1500);
  assert.match(box, /buildLobbyCardStateHTML\(state\) \+ buildBelowThreeMembersHTML\(group\)/, 'mensaje vigente + miembros');
  const fn = fnBody(appJs, '  function buildBelowThreeMembersHTML', 1200);
  assert.match(fn, /buildGroupAvatarHTML\(m\.name, m\.userId\)/);
  assert.match(fn, /ident\.username \? `@\$\{ident\.username\}`/, '@usuario solo si existe');
  assert.doesNotMatch(fn, /points|medal|position|pts|Auth\.|await /i, 'sin ranking ni requests por fila');
  // 3+ miembros: el estado se apaga (comportamiento V04.16 ya cubierto en v0416-cierre-qa.test.mjs)
  assert.match(box, /count < 3 && !hasPoints/);
  // lógica ejecutable de la lista: solo activos
  const src = fnBody(appJs, '  function buildBelowThreeMembersHTML', 1200);
  const build = new Function('PG', 'groupRowIdentity', 'buildPlayerHandle', 'buildGroupAvatarHTML', 'escapeHtml', `${src.slice(0, src.indexOf('\n  }\n') + 4)}; return buildBelowThreeMembersHTML;`)(
    { isMemberActiveAt: (m) => !m.left },
    (name, id) => ({ username: id === 'u1' ? 'seba' : null, serverBacked: true }),
    () => '@x', (n) => `<av:${n}>`, (t) => t);
  const html = build({ members: [{ name: 'Seba', userId: 'u1' }, { name: 'Lucho', userId: 'u2' }, { name: 'Ya salió', userId: 'u3', left: true }] });
  assert.match(html, /Seba/); assert.match(html, /@seba/); assert.match(html, /Lucho/);
  assert.doesNotMatch(html, /Ya salió/, 'solo miembros activos');
  assert.doesNotMatch(html, /@x|@lucho/, 'nunca un @usuario inventado en server-backed');
});

test('Grupos <3 (lobby): miembros reales en la tarjeta con 1–2 miembros, sin posición/medalla/pts; identidad ya cargada (sin N+1)', () => {
  const card = fnBody(appJs, '  function buildLobbyCardHTML', 2200);
  assert.match(card, /s\.state === 'one_member' \|\| s\.state === 'two_members'/);
  assert.match(card, /entry\.members\.map\(buildLobbyMemberRowHTML\)/);
  const row = fnBody(appJs, '  function buildLobbyMemberRowHTML', 900);
  assert.doesNotMatch(row, /lobbyMedal|row\.position|points|pts|Auth\.|await |fetch\(/);
  assert.match(row, /groupsServer\.identities\.get\(m\.userId\)/);
  assert.match(row, /c && c\.username/);
  const refresh = fnBody(appJs, 'async function refreshGroupsLobby', 3200);
  assert.match(refresh, /members: \(adaptedGroup\.members \|\| \[\]\)\.filter\(\(m\) => PG\.isMemberActiveAt/);
  assert.equal((refresh.match(/Auth\.getPlayersCompact|ensureGroupIdentities\(/g) || []).length, 1, 'una sola resolución batch de identidades');
});

/* ---------------- 3. Configuración: jerarquía ---------------- */
test('Configuración: Agregar (admin) · Salir (destructivo secundario, todo miembro) · Eliminar (texto, admin, más abajo)', () => {
  const html = indexHtml.slice(indexHtml.indexOf('id="view-group-settings"'));
  const iAdd = html.indexOf('id="group-settings-add-member-btn"');
  const iLeave = html.indexOf('id="group-settings-leave-btn"');
  const iDelete = html.indexOf('id="group-settings-delete-btn"');
  assert.ok(iAdd < iLeave && iLeave < iDelete);
  assert.match(html, /id="group-settings-leave-btn" class="btn-secondary btn-secondary--danger group-settings-leave-btn">SALIR DEL GRUPO</);
  assert.match(html, /id="group-settings-delete-btn" class="analysis-delete-btn group-settings-delete-btn">ELIMINAR GRUPO</);
  assert.match(css, /#view-group-settings \.group-settings-leave-btn\{ width:100%; flex:none; margin-top: 32px; \}/);
  assert.match(css, /#view-group-settings \.group-settings-delete-btn\{ margin-top: 28px; \}/);
  assert.match(css, /\.btn-secondary--danger\{ background: rgba\(255,91,84,0\.10\); border-color: rgba\(255,91,84,0\.45\); color: var\(--danger\); \}/);
});

test('Configuración: permisos y lógica de Salir/Eliminar sin regresión', () => {
  const role = fnBody(appJs, '  function applyGroupSettingsRole', 400);
  assert.match(role, /group-settings-add-member-btn'\)\.hidden = !isAdmin/);
  assert.match(role, /group-settings-delete-btn'\)\.hidden = !isAdmin/);
  assert.doesNotMatch(role, /leave-btn/, 'Salir nunca se oculta a un miembro');
  assert.match(appJs, /group-settings-leave-btn'\)\.addEventListener\('click', handleLeaveGroup\)/);
  assert.match(appJs, /group-settings-delete-btn'\)\.addEventListener\('click', handleDeleteGroup\)/);
  assert.match(fnBody(appJs, 'function handleLeaveGroup', 3000), /Auth\.leaveGroup\(group\.id\)/);
  assert.match(fnBody(appJs, 'function handleDeleteGroup', 1500), /Auth\.deleteGroup\(group\.id\)/);
});

/* ---------------- 4. Branding PWA ---------------- */
test('Branding: manifest, título, metadata y alt dicen BRAMUlab (BRAMU mayúsculas + lab minúsculas, sin espacio)', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'BRAMUlab');
  assert.equal(manifest.short_name, 'BRAMUlab');
  assert.match(indexHtml, /<title>BRAMUlab<\/title>/);
  assert.match(indexHtml, /<meta name="application-name" content="BRAMUlab" \/>/);
  assert.match(indexHtml, /<meta name="apple-mobile-web-app-title" content="BRAMUlab" \/>/);
  assert.doesNotMatch(indexHtml, /alt="BRAMU Lab"/);
  assert.doesNotMatch(indexHtml.replace(/<!--[\s\S]*?-->/g, ''), /BRAMU Lab/);
  assert.match(appJs, /title: 'BRAMUlab', text:/, 'título del share');
});

test('Branding: iconos PWA referenciados existen, con tamaño correcto, y vienen del asset aprobado (icono2)', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const sizeOf = (f) => { const b = fs.readFileSync(path.join(__dirname, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  manifest.icons.forEach((ic) => {
    const file = ic.src.split('?')[0];
    assert.ok(fs.existsSync(path.join(__dirname, file)), file);
    const [w, h] = sizeOf(file);
    assert.equal(`${w}x${h}`, ic.sizes, file);
    assert.match(ic.src, /\?v=04\.30-h1$/, 'cache-busting coherente con el bundle');
  });
  assert.deepEqual(manifest.icons.map((i) => i.purpose), ['any', 'any', 'maskable']);
  assert.deepEqual(sizeOf('icons/apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(sizeOf('icons/favicon-64.png'), [64, 64]);
  // G2: el apple-touch-icon va incrustado (data:) con los MISMOS bytes del archivo real (iOS lo pide sin credenciales).
  const atiMatch = indexHtml.match(/rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(atiMatch, 'apple-touch-icon incrustado');
  assert.ok(Buffer.from(atiMatch[1], 'base64').equals(fs.readFileSync(path.join(__dirname, 'icons/apple-touch-icon.png'))));
  assert.match(indexHtml, /rel="icon" href="icons\/favicon-64\.png\?v=04\.30-h1"/);
  // sw precachea exactamente las mismas URLs con ?v=
  const sw = read('sw.js');
  ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png', 'favicon-64.png'].forEach((n) => {
    assert.match(sw, new RegExp(`'\\./icons/${n.replace('.', '\\.')}\\?v=04\\.30-h1'`), n);
  });
  // la fuente aprobada está en el repo junto con el script reproducible
  assert.ok(fs.existsSync(path.join(__dirname, '../docs/identidad-visual/BRAMULab icono2.png')));
  assert.match(fs.readFileSync(path.join(__dirname, '../docs/identidad-visual/generar-iconos-pwa.py'), 'utf8'), /BRAMULab icono2\.png/);
});

test('Versión: V04.30 / 04.30-h1 coherentes y el modal muestra V04.19 (nunca h1)', () => {
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.30'/);
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.30-h1'/);
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.30', bundle: '04.30-h1' });
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-30-h1'/);
  assert.match(fnBody(appJs, 'async function checkForNewVersion', 1400), /`\$\{remoteVersion \|\| Store\.VERSION\} está disponible\.`/);
});
