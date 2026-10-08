// BRAMUlab — Grupos BRAMU B2c (foto de grupo server-backed): pruebas focales del lado cliente.
// Ejecutar con: node --test bramulab/tests/groups-b2c-foto-grupo.test.mjs
//
// Backend/RLS/permisos/P0.3 SQL: supabase/tests/verify-preprod-grupos-b2c-group-photo.sql
// (BEGIN/ROLLBACK, corrido también contra un Postgres local — ver el informe de la ronda).
// Orquestador P0.3: supabase/scripts/admin-delete-player-account.test.mjs.
// app.js no tiene cobertura unitaria por diseño (necesita DOM completo): su wiring se cubre con
// guardas estáticas, igual que groups-b1-server-backed/groups-b2b-lobby-desglose.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const j = (x) => JSON.parse(JSON.stringify(x));
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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

/** Cliente Supabase fabricado con Storage + RPC. `st` permite forzar fallos por operación. */
function makeAuth(st) {
  const state = Object.assign({
    rpc: async () => ({ data: { ok: true, group: { groupId: 'g', photoPath: null } }, error: null }),
    upload: async () => ({ error: null }),
    list: async () => ({ data: [], error: null }),
    remove: async () => ({ error: null }),
    signMany: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}?t=1`, error: null })), error: null }),
    signOne: async (p) => ({ data: { signedUrl: `https://signed/${p}?t=1` }, error: null }),
  }, st || {});
  const log = { rpc: [], upload: [], list: [], remove: [], signMany: [], signOne: [], buckets: [] };
  const client = {
    rpc: async (name, params) => { log.rpc.push({ name, params }); return state.rpc(name, params); },
    storage: {
      from: (bucket) => {
        log.buckets.push(bucket);
        return {
          upload: async (p, blob, opts) => { log.upload.push({ p, opts }); return state.upload(p); },
          list: async (prefix) => { log.list.push(prefix); return state.list(prefix); },
          remove: async (paths) => { log.remove.push(paths); return state.remove(paths); },
          createSignedUrls: async (paths, ttl) => { log.signMany.push({ paths, ttl }); return state.signMany(paths); },
          createSignedUrl: async (p, ttl) => { log.signOne.push({ p, ttl }); return state.signOne(p); },
        };
      },
    },
  };
  const sb = makeSandbox({
    __BRAMU_ENV__: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' },
    supabase: { createClient: () => client },
  });
  load(sb, ['auth.js']);
  return { Auth: sb.PLAuth, log };
}

const G = '11111111-1111-4111-8111-111111111111';

/* ---------------- TTL corto, batch, sin persistir ---------------- */

test('B2c: TTL de la signed URL de foto de grupo es corto (10 min) e independiente del avatar (24h)', async () => {
  const { Auth, log } = makeAuth();
  assert.equal(Auth.GROUP_PHOTO_SIGNED_URL_TTL_SECONDS, 600);
  await Auth.resolveGroupPhotoUrl(`${G}/1.jpg`);
  assert.equal(log.signOne[0].ttl, 600);
  await Auth.resolveGroupPhotoUrlsBatch([`${G}/1.jpg`]);
  assert.equal(log.signMany[0].ttl, 600);
  assert.ok(log.buckets.every((b) => b === 'group-photos'), 'siempre el bucket privado group-photos');
  const src = read('auth.js');
  assert.match(src, /AVATAR_SIGNED_URL_TTL_SECONDS = 60 \* 60 \* 24/, 'el TTL del avatar no cambió');
  assert.match(src, /GROUP_PHOTO_SIGNED_URL_TTL_SECONDS = 60 \* 10/);
});

test('B2c: firma en BATCH — una sola llamada para N grupos, sin duplicados ni nulls; falla parcial => fallback', async () => {
  const { Auth, log } = makeAuth({
    signMany: async (paths) => ({ data: [
      { path: paths[0], signedUrl: 'https://s/a', error: null },
      { path: paths[1], signedUrl: null, error: 'boom' },
    ], error: null }),
  });
  const map = await Auth.resolveGroupPhotoUrlsBatch([`${G}/a.jpg`, `${G}/b.jpg`, `${G}/a.jpg`, null, undefined]);
  assert.equal(log.signMany.length, 1, 'UNA sola llamada de firma');
  assert.deepEqual(j(log.signMany[0].paths), [`${G}/a.jpg`, `${G}/b.jpg`]);
  assert.equal(map.get(`${G}/a.jpg`), 'https://s/a');
  assert.equal(map.has(`${G}/b.jpg`), false, 'la que no se pudo firmar cae a iniciales');
  const empty = makeAuth();
  assert.equal((await empty.Auth.resolveGroupPhotoUrlsBatch([null, undefined])).size, 0);
  assert.equal(empty.log.signMany.length, 0, 'sin rutas no hay request');
});

test('B2c: la signed URL nunca se persiste (ni localStorage ni Store)', async () => {
  const { Auth } = makeAuth();
  await Auth.resolveGroupPhotoUrl(`${G}/1.jpg`);
  const auth = read('auth.js');
  const app = read('app.js');
  const block = auth.slice(auth.indexOf('const GROUP_PHOTO_BUCKET'), auth.indexOf('global.PLAuth'));
  assert.doesNotMatch(stripComments(block), /localStorage|sessionStorage|Store\./);
  const settings = app.slice(app.indexOf('function renderGroupSettingsPhoto'), app.indexOf('async function handleGroupPhotoRemove'));
  assert.doesNotMatch(stripComments(settings), /localStorage|Store\./);
  assert.doesNotMatch(stripComments(app.slice(app.indexOf('async function refreshGroupsLobby'), app.indexOf('function groupInitials'))), /localStorage/);
});

/* ---------------- Reemplazo seguro ---------------- */

test('B2c: upload nuevo FALLA => foto vieja intacta (no hay RPC ni borrado)', async () => {
  const { Auth, log } = makeAuth({ upload: async () => ({ error: { message: 'quota' } }) });
  const r = await Auth.changeGroupPhoto(G, {}, `${G}/old.jpg`);
  assert.equal(r.ok, false);
  assert.equal(r.step, 'upload');
  assert.equal(log.rpc.length, 0);
  assert.equal(log.remove.length, 0, 'no se borra nada: la foto vieja sigue válida');
  assert.equal(log.list.length, 0);
});

test('B2c: RPC update FALLA => se borra el archivo NUEVO y se conserva el viejo', async () => {
  const { Auth, log } = makeAuth({ rpc: async () => ({ data: { ok: false, code: 'not_admin' }, error: null }) });
  const r = await Auth.changeGroupPhoto(G, {}, `${G}/old.jpg`);
  assert.equal(r.ok, false);
  assert.equal(r.step, 'rpc');
  assert.equal(r.code, 'not_admin');
  const newPath = log.upload[0].p;
  assert.match(newPath, new RegExp(`^${G}/\\d+\\.jpg$`));
  assert.deepEqual(j(log.remove), [[newPath]], 'solo el archivo nuevo se limpia');
  assert.equal(log.list.length, 0, 'nunca listó/borró la carpeta (la foto vieja queda)');
});

test('B2c: RPC OK + cleanup del viejo FALLA => sigue ok:true (DB/nueva foto correctas), cleanupOk:false', async () => {
  const { Auth, log } = makeAuth({
    list: async () => ({ data: [{ name: 'old.jpg' }, { name: 'new.jpg' }], error: null }),
    remove: async () => ({ error: { message: 'storage_down' } }),
    rpc: async (n, p) => ({ data: { ok: true, changed: true, group: { groupId: G, photoPath: p.p_photo_path } }, error: null }),
  });
  const r = await Auth.changeGroupPhoto(G, {}, `${G}/old.jpg`);
  assert.equal(r.ok, true);
  assert.equal(r.cleanupOk, false);
  assert.equal(r.group.photoPath, r.path);
});

test('B2c: orden correcto — upload -> RPC -> recién después borra lo viejo (nunca al revés), conservando la nueva', async () => {
  const order = [];
  const { Auth, log } = makeAuth({
    upload: async () => { order.push('upload'); return { error: null }; },
    rpc: async (n, p) => { order.push('rpc'); return { data: { ok: true, group: { photoPath: p.p_photo_path } }, error: null }; },
    list: async () => { order.push('list'); return { data: [{ name: 'old.jpg' }, { name: 'zz-new.jpg' }], error: null }; },
    remove: async () => { order.push('remove'); return { error: null }; },
  });
  const r = await Auth.changeGroupPhoto(G, {}, `${G}/old.jpg`);
  assert.deepEqual(order, ['upload', 'rpc', 'list', 'remove']);
  assert.equal(r.ok, true);
  assert.ok(!log.remove[0].includes(r.path), 'la foto nueva nunca se borra');
  assert.equal(log.rpc[0].name, 'update_group_photo');
  assert.equal(log.upload[0].opts.upsert, false);
});

test('B2c: primera foto (sin foto vieja) no dispara cleanup', async () => {
  const { Auth, log } = makeAuth();
  const r = await Auth.changeGroupPhoto(G, {}, null);
  assert.equal(r.ok, true);
  assert.equal(log.list.length, 0);
  assert.equal(log.remove.length, 0);
});

test('B2c: quitar foto — RPC null primero, cleanup después; un cleanup fallido no revierte', async () => {
  const order = [];
  const { Auth, log } = makeAuth({
    rpc: async () => { order.push('rpc'); return { data: { ok: true, changed: true, group: { photoPath: null } }, error: null }; },
    list: async () => { order.push('list'); return { data: [{ name: 'a.jpg' }], error: null }; },
    remove: async () => { order.push('remove'); return { error: { message: 'x' } }; },
  });
  const r = await Auth.removeGroupPhoto(G);
  assert.deepEqual(order, ['rpc', 'list', 'remove']);
  assert.equal(log.rpc[0].params.p_photo_path, null);
  assert.equal(r.ok, true);
  assert.equal(r.cleanupOk, false);
  const failed = makeAuth({ rpc: async () => ({ data: { ok: false, code: 'not_admin' }, error: null }) });
  const r2 = await failed.Auth.removeGroupPhoto(G);
  assert.equal(r2.ok, false);
  assert.equal(failed.log.list.length, 0, 'si el RPC falla no se toca Storage');
});

/* ---------------- adaptador puro ---------------- */

test('B2c: adaptServerGroup transporta photoPath crudo (nunca una URL) sin tocar puntos ni membresía', () => {
  const sb = load(makeSandbox(), ['engine.js', 'stats.js', 'store.js', 'player-home.js', 'groups.js']);
  const withPhoto = j(sb.PLGroups.adaptServerGroup({ groupId: G, name: 'X', photoPath: `${G}/1.jpg`, isAdmin: true }, new Map()));
  assert.equal(withPhoto.photoPath, `${G}/1.jpg`);
  const without = j(sb.PLGroups.adaptServerGroup({ groupId: G, name: 'X' }, new Map()));
  assert.equal(without.photoPath, null);
});

/* ---------------- wiring estático (app.js / index.html) ---------------- */

const appJs = read('app.js');
const indexHtml = read('index.html');
const css = read('styles.css');
function fnBody(src, sig, len = 3000) { const i = src.indexOf(sig); assert.ok(i >= 0, sig); return src.slice(i, i + len); }

test('B2c lobby: resolución BATCH única de fotos (nunca una firma por tarjeta) + fallback de iniciales', () => {
  const body = fnBody(appJs, 'async function refreshGroupsLobby', 2600);
  const end = body.indexOf('groupsLobby.loaded = true');
  const scope = body.slice(0, end);
  assert.equal((scope.match(/resolveGroupPhotoUrlsBatch\(/g) || []).length, 1);
  assert.doesNotMatch(scope, /resolveGroupPhotoUrl\(/, 'sin firma individual');
  assert.match(scope, /photoUrl: g\.photoPath \? \(photoUrls\.get\(g\.photoPath\) \|\| null\) : null/);
  const card = fnBody(appJs, 'function buildLobbyCardHTML', 2200);
  assert.match(card, /entry\.photoUrl/);
  assert.match(card, /lobby-card__avatar lobby-card__avatar--photo/);
  assert.match(card, /groupInitials\(entry\.name\)/, 'fallback de iniciales intacto');
  assert.match(css, /\.lobby-card__avatar--photo\{ overflow:hidden; padding:0; \}/);
});

test('B2c lobby: @usuario secundario solo si existe (identidad ya cargada, sin RPC) y fallback verde sin foto', () => {
  const row = fnBody(appJs, 'function buildLobbyCardRowHTML', 1400);
  assert.match(row, /c && c\.username/);
  assert.match(row, /lobby-card__row-handle/);
  assert.doesNotMatch(row, /Auth\.|await |fetch\(/, 'sin requests por fila');
  assert.match(css, /\.lobby-card__row-avatar\{[^}]*color: var\(--brand-lime\)/);
  assert.match(css, /\.lobby-card__row-avatar\{\s*flex:none; width:45px; height:45px;/, 'tamaño jugador 45');
  assert.match(css, /\.lobby-card__avatar\{\s*flex:none; width:50px; height:50px;/, 'tamaño grupo 50');
});

test('B2c Configuración: editor de foto (miembro activo, server-backed), orden exacto y control "Quitar foto" condicional', () => {
  const html = indexHtml.slice(indexHtml.indexOf('id="view-group-settings"'));
  const iPhoto = html.indexOf('id="group-settings-photo-block"');
  const iName = html.indexOf('class="group-name-edit"');
  const iMembers = html.indexOf('>MIEMBROS<');
  const iAdd = html.indexOf('id="group-settings-add-member-btn"');
  const iDelete = html.indexOf('id="group-settings-delete-btn"');
  assert.ok(iPhoto > 0 && iPhoto < iName && iName < iMembers && iMembers < iAdd && iAdd < iDelete, 'foto > nombre > MIEMBROS > agregar > eliminar');
  assert.match(html, /id="group-settings-photo-edit-btn" class="avatar-edit-badge"/, 'reusa el badge de cámara del Perfil');
  assert.match(html, /id="group-settings-photo-input" accept="image\/\*" hidden/);
  const render = fnBody(appJs, 'function renderGroupSettingsPhoto', 1500);
  assert.match(render, /block\.hidden = !serverBacked/);
  assert.match(render, /remove-btn'\)\.hidden = !group\.photoPath/);
  // §26.4/§26.6: Configuración y la foto ya no son admin-only; el servidor impone "miembro activo".
  assert.doesNotMatch(fnBody(appJs, 'function openGroupSettingsScreen', 500), /currentIsAdminOfGroup/);
  assert.doesNotMatch(fnBody(appJs, 'async function handleGroupPhotoSelected', 500), /currentIsAdminOfGroup/);
  assert.doesNotMatch(fnBody(appJs, 'async function handleGroupPhotoRemove', 500), /currentIsAdminOfGroup/);
});

test('B2c: reutiliza el pipeline de Perfil (downscale 256/0.7 JPEG, toast, input reseteado) y refresca lobby+detalle', () => {
  const sel = fnBody(appJs, 'async function handleGroupPhotoSelected', 1400);
  assert.match(sel, /downscaleImageFileToDataUrl\(file, 256, 0\.7\)/);
  assert.match(sel, /Auth\.changeGroupPhoto\(group\.id, blob, group\.photoPath\)/);
  assert.match(sel, /finally \{\s*groupsBusy = false;/);
  const after = fnBody(appJs, 'async function afterGroupPhotoMutation', 500);
  assert.match(after, /resetGroupsLobbyCache\(\)/);
  assert.match(after, /await refreshGroupsFromServer\(\)/);
  assert.match(appJs, /photoInput\.value = ''/, 'input file reseteado al terminar');
  assert.match(fnBody(appJs, 'async function handleGroupPhotoRemove', 700), /Auth\.removeGroupPhoto\(group\.id\)/);
});

test('B2c: la foto NO es requisito de creación (la hoja "Crear grupo" no tiene input de foto)', () => {
  const sheet = fnBody(indexHtml, 'id="create-group-sheet-scrim"', 3500);
  assert.doesNotMatch(sheet, /type="file"|foto/i);
  const submit = fnBody(appJs, 'async function submitCreateGroupServer', 2500);
  assert.doesNotMatch(submit, /[Pp]hoto/);
});

test('B2c delete: el borrado lógico ocurre primero; el cleanup de Storage es best-effort DESPUÉS y no revierte', () => {
  const del = fnBody(appJs, 'function handleDeleteGroup', 1700);
  const iDelete = del.indexOf('Auth.deleteGroup(group.id)');
  const iCleanup = del.indexOf('Auth.removeGroupPhotoFiles(group.id)');
  assert.ok(iDelete > 0 && iCleanup > iDelete);
  assert.match(del, /if \(group\.photoPath\) Auth\.removeGroupPhotoFiles\(group\.id\)\.catch\(\(\) => \{\}\)/);
});

test('B2c: quitar/cambiar foto no toca la lógica deportiva (puntos, Race, Nivel, Ranking)', () => {
  const block = fnBody(appJs, 'function renderGroupSettingsPhoto', 4200);
  assert.doesNotMatch(block, /computeWeeklyTable|computeRaceAnual|Nivel|Ranking/);
});
