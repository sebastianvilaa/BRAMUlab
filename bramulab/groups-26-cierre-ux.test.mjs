// BRAMUlab — Grupos BRAMU §26 (cierre de producto/UX post-B2c, V04.15): pruebas focales del cliente.
// Ejecutar con: node --test bramulab/groups-26-cierre-ux.test.mjs
//
// Backend (nombre/foto de miembro activo, acciones admin-only, leave_group, Storage):
// supabase/tests/verify-preprod-grupos-26-miembros-leave.sql. app.js se cubre con guardas
// estáticas (sin DOM), igual que el resto de las suites de Grupos.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const css = read('styles.css');
function fnBody(src, sig, len = 3000) { const i = src.indexOf(sig); assert.ok(i >= 0, sig); return src.slice(i, i + len); }

/* ---------------- cliente Auth ---------------- */
test('§26.5: Auth.leaveGroup llama a la RPC leave_group con el group_id', async () => {
  const calls = [];
  const sb = { __BRAMU_ENV__: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'a' },
    supabase: { createClient: () => ({ rpc: async (name, params) => { calls.push({ name, params }); return { data: { ok: true, changed: true, groupDeleted: false }, error: null }; } }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  vm.createContext(sb);
  vm.runInContext(read('auth.js'), sb);
  const r = await sb.PLAuth.leaveGroup('g1');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ name: 'leave_group', params: { p_group_id: 'g1' } }]);
  assert.equal(r.ok, true);
});

/* ---------------- 26.1 estado cero ---------------- */
test('§26.1: estado cero — "Tus 3 mejores partidos cuentan", CTA secundario lima full-width, ejemplo "Pádel de los jueves" con recurso propio', () => {
  assert.match(indexHtml, /Tus 3 mejores partidos cuentan/);
  assert.doesNotMatch(indexHtml, /Tus 3 mejores cuentan/);
  assert.match(indexHtml, /id="groups-lobby-empty-help-btn" class="btn-secondary btn-secondary--lime groups-switch-create-btn">CÓMO FUNCIONA</);
  assert.ok(indexHtml.indexOf('id="groups-lobby-empty-create-btn"') < indexHtml.indexOf('id="groups-lobby-empty-help-btn"'), 'secundario debajo del primario');
  assert.match(css, /\.groups-switch-create-btn\{ width:100%; flex:none;/);
  const ex = fnBody(appJs, 'const GROUPS_LOBBY_EXAMPLE_ENTRY', 400);
  assert.match(ex, /name: 'Pádel de los jueves'/);
  assert.match(ex, /photoUrl: 'icons\/padel-court-example\.svg'/);
  assert.ok(fs.existsSync(path.join(__dirname, 'icons/padel-court-example.svg')), 'recurso empaquetado');
  assert.match(read('icons/padel-court-example.svg'), /<svg/);
  assert.match(read('sw.js'), /\.\/icons\/padel-court-example\.svg/, 'precacheado para uso offline');
  assert.match(css, /\.lobby-card--example\{[^}]*border-color: rgba\(149,255,25/, 'borde verde, no amarillo');
  assert.match(indexHtml, /EJEMPLO/);
  // nunca depende de la foto privada de un grupo real ni de terceros en runtime
  assert.doesNotMatch(ex, /https?:\/\//);
});

/* ---------------- 26.2 lobby ---------------- */
test('§26.2: lobby con grupos — intro compacta arriba de la lista, sin repetir los 3 bloques; Nuevo grupo al final', () => {
  const wrap = indexHtml.slice(indexHtml.indexOf('id="groups-lobby-list-wrap"'), indexHtml.indexOf('id="groups-lobby-list-wrap"') + 900);
  assert.match(wrap, /Tu competencia semanal/);
  assert.match(wrap, /Cada semana empieza de nuevo\. Cuentan tus 3 mejores partidos\./);
  assert.ok(wrap.indexOf('groups-lobby-intro') < wrap.indexOf('id="groups-lobby-list"'));
  assert.doesNotMatch(wrap, /groups-lobby-pitch/);
  assert.ok(indexHtml.indexOf('id="groups-lobby-list"') < indexHtml.indexOf('groups-lobby-create-other-btn'));
});

/* ---------------- 26.3 selector / desplegable ---------------- */
test('§26.3: foto/fallback en el selector y en "Mis grupos", firmadas en UNA llamada batch y solo en memoria', () => {
  assert.match(indexHtml, /id="groups-current-selector-avatar"/);
  assert.match(fnBody(appJs, 'function renderGroupsScreen', 1800), /groups-current-selector-avatar'\)\.innerHTML = groupMiniAvatarInnerHTML\(activeGroup\)/);
  assert.match(fnBody(appJs, 'function renderGroupsSwitchList', 1200), /groupMiniAvatarInnerHTML\(g\)/);
  const ens = fnBody(appJs, 'async function ensureGroupListPhotoUrls', 900);
  assert.equal((ens.match(/resolveGroupPhotoUrlsBatch\(/g) || []).length, 1, 'una sola llamada batch');
  assert.doesNotMatch(ens, /localStorage|Store\./);
  assert.match(fnBody(appJs, 'function groupMiniAvatarInnerHTML', 400), /groupInitials\(/, 'fallback de iniciales');
  assert.match(css, /\.groups-current-selector__avatar\{[^}]*width:28px; height:28px/, 'no agranda el selector');
});

/* ---------------- 26.4 / 26.6 Configuración para todos ---------------- */
test('§26.4: Configuración abre para cualquier miembro; agregar/eliminar/acciones sobre miembros solo admin', () => {
  assert.match(fnBody(appJs, 'function renderGroupsScreen', 1800), /groups-settings-btn'\)\.hidden = !activeGroup/);
  assert.doesNotMatch(fnBody(appJs, 'function openGroupSettingsScreen', 500), /currentIsAdminOfGroup/);
  const role = fnBody(appJs, 'function applyGroupSettingsRole', 400);
  assert.match(role, /group-settings-add-member-btn'\)\.hidden = !isAdmin/);
  assert.match(role, /group-settings-delete-btn'\)\.hidden = !isAdmin/);
  const members = fnBody(appJs, 'function renderGroupSettingsMembers', 2600);
  assert.match(members, /viewerIsAdmin = currentIsAdminOfGroup\(group\)/);
  assert.match(members, /\$\{viewerIsAdmin \? `<span class="group-settings-member__actions">/);
  // foto y nombre: sin gate de admin
  assert.doesNotMatch(fnBody(appJs, 'function exitGroupNameEditMode', 1200), /currentIsAdminOfGroup/);
});

test('§26.4: los gates de admin del cliente en acciones sobre otros miembros siguen presentes (defensa en UI; el servidor manda)', () => {
  const sw = fnBody(appJs, 'function handleGroupSettingsAction', 1800);
  assert.match(sw, /Auth\.removeGroupMember|Auth\.promoteGroupAdmin|Auth\.demoteGroupAdmin/);
});

/* ---------------- 26.5 Salir del grupo ---------------- */
test('§26.5: "Salir del grupo" confirma primero la DB y recién después limpia foto si el grupo fue eliminado', () => {
  const html = indexHtml.slice(indexHtml.indexOf('id="view-group-settings"'));
  // V04.17: jerarquía Agregar -> Salir -> Eliminar (Eliminar, admin-only, queda último)
  assert.ok(html.indexOf('id="group-settings-leave-btn"') < html.indexOf('id="group-settings-delete-btn"'));
  assert.match(html, /id="group-settings-leave-btn"[^>]*>SALIR DEL GRUPO</);
  assert.match(appJs, /group-settings-leave-btn'\)\.addEventListener\('click', handleLeaveGroup\)/);
  const leave = fnBody(appJs, 'function handleLeaveGroup', 3400);
  assert.match(leave, /Dejarás de formar parte del grupo/);
  assert.match(leave, /otro miembro pasará a ser admin para que el grupo continúe/);
  assert.match(leave, /al salir, el grupo se eliminará/);
  assert.match(leave, /Auth\.leaveGroup\(group\.id\)/);
  assert.match(leave, /r\.groupDeleted && group\.photoPath[\s\S]*removeGroupPhotoFiles\(group\.id\)/);
  assert.ok(leave.indexOf('Auth.leaveGroup') < leave.indexOf('removeGroupPhotoFiles'), 'cleanup DESPUÉS del commit lógico');
  assert.match(leave, /confirmAction\(/);
});

test('§26.5: escenario de salida — único miembro / último admin / normal (misma regla que el servidor)', () => {
  const src = fnBody(appJs, 'function groupLeaveScenario', 700);
  const PG = { isMemberActiveAt: (m) => !m.left };
  const fn = new Function('PG', 'currentMemberOfGroup', `${src.slice(0, src.indexOf('  function handleLeaveGroup'))}; return groupLeaveScenario;`);
  const mk = (members, meIdx) => fn(PG, () => members[meIdx])({ members });
  assert.equal(mk([{ isAdmin: true }], 0), 'sole');
  assert.equal(mk([{ isAdmin: true }, { isAdmin: false }], 0), 'last_admin');
  assert.equal(mk([{ isAdmin: true }, { isAdmin: true }], 0), 'normal');
  assert.equal(mk([{ isAdmin: true }, { isAdmin: false }], 1), 'normal');
  assert.equal(mk([{ isAdmin: true }, { isAdmin: false, left: true }], 0), 'sole', 'los que ya salieron no cuentan');
});

/* ---------------- migración ---------------- */
test('§26: migración — nombre/foto miembro activo, admin-only intacto, leave_group y reuso del algoritmo P0.3', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260930180000_preprod_grupos_cierre_ux_miembros_leave.sql'), 'utf8');
  assert.match(sql, /function public\.rename_group[\s\S]*?_groups_lock_and_authorize\(p_group_id, v_caller, false\)/);
  assert.match(sql, /function public\.update_group_photo[\s\S]*?_groups_lock_and_authorize\(p_group_id, v_caller, false\)/);
  // no relaja ninguna acción administrativa: no las redefine
  ['add_group_member', 'remove_group_member', 'promote_group_admin', 'demote_group_admin', 'delete_group'].forEach((fn) => {
    assert.doesNotMatch(sql, new RegExp(`function public\\.${fn}\\(`), fn);
  });
  assert.match(sql, /function public\.leave_group\(p_group_id uuid\)/);
  assert.match(sql, /grant execute on function public\.leave_group\(uuid\) to authenticated/);
  assert.match(sql, /'voluntary_leave'/);
  assert.match(sql, /order by o\.joined_at asc, o\.membership_id asc/);
  assert.match(sql, /_groups_close_membership\(v_gid, p_player_id, 'account_deletion'\)/, 'P0.3 reutiliza el mismo helper');
  // lectura normal NO se relaja; cleanup post-delete sí se amplía de forma acotada al actor
  // deleted_by para poder borrar residuos después de cerrar su propia membership.
  assert.doesNotMatch(sql, /function public\._group_photo_can_read/);
  assert.match(sql, /function public\._group_photo_can_cleanup[\s\S]*deleted_by_player_id = pl\.player_id/);
});
