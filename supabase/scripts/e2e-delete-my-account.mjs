// BRAMUlab — V04.20 (L3): harness E2E de la eliminación AUTOSERVICIO contra Staging con CUENTAS DESCARTABLES.
//
// Todo lo que NO necesita a una persona se ejecuta solo (prepare / negatives / verify / cleanup). El ÚNICO paso
// humano es el OTP: `send-otp` dispara el código al email de la cuenta descartable A y `delete --otp <código>` lo
// consume (verifyOtp recovery => JWT con amr reciente => delete-my-account).
//
//   node e2e-delete-my-account.mjs prepare --email-a <inbox del gate humano>   # crea A (sujeto) y B (contraparte)
//   node e2e-delete-my-account.mjs negatives                                    # 401/400/403 automáticos, sin OTP
//   node e2e-delete-my-account.mjs send-otp                                     # ÚNICO gate humano: llega el código a A
//   node e2e-delete-my-account.mjs delete --otp 123456                          # elimina A por el flujo real + verify
//   node e2e-delete-my-account.mjs verify                                       # postcondiciones (re-ejecutable)
//   node e2e-delete-my-account.mjs cleanup                                      # elimina B y borra el estado local
//
// Variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (del entorno; nunca al repo). El estado
// (ids, contraseñas aleatorias de las cuentas descartables) vive en un archivo 0600 FUERA del repo
// (E2E_STATE_FILE o $TMPDIR/bramu-e2e-delete.json). Solo opera sobre cuentas que ESTE script creó (usernames e2e_*).

import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { runAccountDeletion, verifyAccountDeleted } from '../functions/_shared/account-deletion-core.mjs';

const STATE_FILE = process.env.E2E_STATE_FILE || path.join(os.tmpdir(), 'bramu-e2e-delete.json');
const rand = (n) => crypto.randomBytes(n).toString('hex');

export function loadState() { return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : null; }
function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), { mode: 0o600 }); }

/** Acumula checks {name, ok, detail}; el CLI sale con 1 si alguno falla. */
export function makeReporter() {
  const checks = [];
  return {
    check(name, ok, detail) { checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); return !!ok; },
    get checks() { return checks; },
    get ok() { return checks.every((c) => c.ok); },
  };
}

async function callDeleteFunction(env, token, body) {
  const res = await fetch(`${env.url}/functions/v1/delete-my-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

async function createDisposableUser(admin, anonClient, email, label) {
  const password = `E2e-${rand(8)}!aA1`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { legal_version: 'legal_v1' } });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  const signIn = await anonClient.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn(${label}): ${signIn.error.message}`);
  const username = `e2e_${label}_${rand(3)}`;
  const { error: cpErr } = await anonClient.rpc('complete_profile', {
    p_username: username, p_first_name: `E2E ${label}`, p_last_name: 'Descartable', p_display_name: `E2E ${label}`,
    p_birth_date: null, p_gender: null, p_dominant_hand: null, p_preferred_side: null, p_competitive_branch: null,
    p_location_country_code: 'AR', p_location_province_label: null, p_location_locality_label: null,
  });
  if (cpErr) throw new Error(`complete_profile(${label}): ${cpErr.message}`);
  const { data: player } = await admin.from('players').select('player_id').eq('auth_user_id', data.user.id).maybeSingle();
  return { email, password, authUserId: data.user.id, playerId: player && player.player_id, username };
}

export async function cmdPrepare({ admin, makeAnon, env, emailA }) {
  if (loadState()) throw new Error(`Ya existe un estado E2E (${STATE_FILE}). Corré cleanup primero.`);
  if (!emailA) throw new Error('Falta --email-a (el inbox que recibirá el OTP en el gate humano).');
  const tag = rand(3);
  const emailB = `e2e-b-${tag}@example.test`;
  const a = await createDisposableUser(admin, makeAnon(), emailA, 'a');
  const b = await createDisposableUser(admin, makeAnon(), emailB, 'b');

  // Como A: avatar (Storage privado) + grupo compartido con B + grupo solo de A (se borra lógicamente al eliminar).
  const clientA = makeAnon();
  await clientA.auth.signInWithPassword({ email: a.email, password: a.password });
  const avatarPath = `${a.playerId}/e2e-${tag}.jpg`;
  const up = await clientA.storage.from('avatars').upload(avatarPath, new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), { contentType: 'image/jpeg' });
  const shared = await clientA.rpc('create_group', { p_name: `E2E compartido ${tag}`, p_member_player_ids: [b.playerId] });
  const solo = await clientA.rpc('create_group', { p_name: `E2E solo ${tag}`, p_member_player_ids: [] });
  const state = {
    createdAt: new Date().toISOString(), a, b, avatarPath,
    avatarUploaded: !up.error,
    sharedGroupId: shared.data && shared.data.group && shared.data.group.group_id || (shared.data && shared.data.groupId) || null,
    soloGroupId: solo.data && solo.data.group && solo.data.group.group_id || (solo.data && solo.data.groupId) || null,
  };
  saveState(state);
  return { ok: true, stateFile: STATE_FILE, usernames: [a.username, b.username], avatarUploaded: state.avatarUploaded, sharedGroupId: state.sharedGroupId, soloGroupId: state.soloGroupId };
}

export async function cmdNegatives({ makeAnon, env }) {
  const st = loadState(); if (!st) throw new Error('Sin estado: corré prepare.');
  const r = makeReporter();
  // 1) sin Authorization
  const noAuth = await callDeleteFunction(env, null, { confirm: true });
  r.check('sin JWT => rechazado (401/403)', noAuth.status === 401 || noAuth.status === 403, noAuth.status);
  // 2) sesión por CONTRASEÑA (amr=password) => no cuenta como reautenticación reciente
  const clientA = makeAnon();
  const { data: s } = await clientA.auth.signInWithPassword({ email: st.a.email, password: st.a.password });
  const token = s.session.access_token;
  const pwd = await callDeleteFunction(env, token, { confirm: true });
  r.check('login por contraseña => 403 recent_reauth_required', pwd.status === 403 && pwd.json && pwd.json.code === 'recent_reauth_required', `${pwd.status} ${pwd.json && pwd.json.code}`);
  // 3) el body NUNCA elige player/email
  const tamper1 = await callDeleteFunction(env, token, { confirm: true, player_id: st.b.playerId });
  const tamper2 = await callDeleteFunction(env, token, { confirm: true, email: st.b.email });
  r.check('body con player_id => 400 invalid_payload', tamper1.status === 400 && tamper1.json.code === 'invalid_payload', tamper1.status);
  r.check('body con email => 400 invalid_payload', tamper2.status === 400 && tamper2.json.code === 'invalid_payload', tamper2.status);
  const noConfirm = await callDeleteFunction(env, token, {});
  r.check('sin confirm => 400 confirmation_required', noConfirm.status === 400 && noConfirm.json.code === 'confirmation_required', noConfirm.status);
  return { ok: r.ok, checks: r.checks };
}

export async function cmdSendOtp({ makeAnon }) {
  const st = loadState(); if (!st) throw new Error('Sin estado: corré prepare.');
  const { error } = await makeAnon().auth.resetPasswordForEmail(st.a.email);
  return { ok: !error, detail: error ? error.message : 'Código enviado al email de la cuenta descartable A' };
}

export async function verifyDeletedState({ admin, makeAnon, st }) {
  const r = makeReporter();
  const aPlayer = st.a.playerId;
  const post = await verifyAccountDeleted(admin, aPlayer, st.a.authUserId);
  r.check('P0.3 postcondiciones (anonimizado, desvinculado, inactivo, storage, auth, auditoría)', post.ok, JSON.stringify(post));
  const { data: prof } = await admin.from('profiles').select('username, first_name, phone, allow_whatsapp_contact, ranking_opt_in').eq('player_id', aPlayer).maybeSingle();
  r.check('profile anonimizado (username/nombre/teléfono nulos, sin consentimiento, fuera de Ranking)', prof && !prof.username && !prof.first_name && !prof.phone && prof.allow_whatsapp_contact === false && prof.ranking_opt_in === false, JSON.stringify(prof));
  const { data: pl } = await admin.from('players').select('display_name, is_active, deleted_at, auth_user_id').eq('player_id', aPlayer).maybeSingle();
  r.check('player "Jugador eliminado", inactivo, sin auth', pl && pl.display_name === 'Jugador eliminado' && pl.is_active === false && !!pl.deleted_at && pl.auth_user_id === null, JSON.stringify(pl));
  const { data: au } = await admin.auth.admin.getUserById(st.a.authUserId);
  r.check('Auth user inexistente', !au || !au.user, au && au.user ? 'todavía existe' : 'ok');
  const { data: acc } = await admin.from('legal_acceptances').select('legal_version').eq('player_id', aPlayer);
  r.check('evidencia de aceptación legal conservada (append-only)', Array.isArray(acc) && acc.length >= 1, acc && acc.length);
  const { data: saved } = await admin.from('player_saved_players').select('owner_player_id').or(`owner_player_id.eq.${aPlayer},saved_player_id.eq.${aPlayer}`);
  r.check('listas personales sin rastro', Array.isArray(saved) && saved.length === 0, saved && saved.length);
  if (st.soloGroupId) {
    const { data: g } = await admin.from('groups').select('status').eq('group_id', st.soloGroupId).maybeSingle();
    r.check('grupo solo-de-A eliminado lógicamente', g && g.status === 'deleted', g && g.status);
  }
  if (st.sharedGroupId) {
    const { data: gs } = await admin.from('groups').select('status').eq('group_id', st.sharedGroupId).maybeSingle();
    r.check('grupo compartido con B sigue activo', gs && gs.status === 'active', gs && gs.status);
    const { data: mem } = await admin.from('group_memberships').select('player_id, left_at').eq('group_id', st.sharedGroupId);
    const aOpen = (mem || []).some((m) => m.player_id === aPlayer && m.left_at === null);
    const bOpen = (mem || []).some((m) => m.player_id === st.b.playerId && m.left_at === null);
    r.check('memberships coherentes: A sin período abierto, B activo', !aOpen && bOpen, JSON.stringify(mem));
  }
  // Como B (contraparte): el perfil público de A no existe y WhatsApp no se entrega.
  const clientB = makeAnon();
  await clientB.auth.signInWithPassword({ email: st.b.email, password: st.b.password });
  const pub = await clientB.rpc('get_public_profile', { p_player_id: aPlayer });
  r.check('perfil público de A ya no existe para otros', !pub.error && Array.isArray(pub.data) && pub.data.length === 0, pub.error ? pub.error.message : pub.data && pub.data.length);
  const wa = await clientB.rpc('get_whatsapp_contact', { p_player_id: aPlayer });
  r.check('WhatsApp de A no se entrega', !wa.error && wa.data && wa.data.ok === false, JSON.stringify(wa.data));
  // Retry seguro: el motor es idempotente.
  const again = await runAccountDeletion(admin, aPlayer, {});
  r.check('retry del motor idempotente (alreadyDeleted)', again.ok === true && again.alreadyDeleted === true, JSON.stringify({ ok: again.ok, step: again.step }));
  return { ok: r.ok, checks: r.checks };
}

export async function cmdDelete({ admin, makeAnon, env, otp }) {
  const st = loadState(); if (!st) throw new Error('Sin estado: corré prepare.');
  if (!/^[0-9]{6}$/.test(String(otp || ''))) throw new Error('Falta --otp (6 dígitos).');
  const clientA = makeAnon();
  const v = await clientA.auth.verifyOtp({ email: st.a.email, token: String(otp), type: 'recovery' });
  if (v.error) return { ok: false, detail: `verifyOtp falló: ${v.error.message}` };
  const token = v.data.session.access_token;
  const r = makeReporter();
  const res = await callDeleteFunction(env, token, { confirm: true });
  r.check('delete-my-account => 200 ok', res.status === 200 && res.json && res.json.ok === true, `${res.status} ${JSON.stringify(res.json)}`);
  // Retry con el MISMO JWT: nunca debe fallar destructivamente (401/404 por cuenta inexistente o 200 idempotente).
  const retry = await callDeleteFunction(env, token, { confirm: true });
  r.check('retry con el mismo JWT es seguro (200/401/404, nunca 5xx destructivo)', [200, 401, 404].includes(retry.status), retry.status);
  const verification = await verifyDeletedState({ admin, makeAnon, st });
  return { ok: r.ok && verification.ok, checks: [...r.checks, ...verification.checks] };
}

export async function cmdVerify({ admin, makeAnon }) {
  const st = loadState(); if (!st) throw new Error('Sin estado: corré prepare.');
  return verifyDeletedState({ admin, makeAnon, st });
}

export async function cmdCleanup({ admin }) {
  const st = loadState(); if (!st) return { ok: true, detail: 'Sin estado.' };
  const out = {};
  for (const who of ['a', 'b']) {
    const acc = st[who];
    if (!acc.username.startsWith('e2e_')) continue; // solo cuentas creadas por este script
    out[who] = await runAccountDeletion(admin, acc.playerId, {});
  }
  rmSync(STATE_FILE, { force: true });
  return { ok: Object.values(out).every((x) => x.ok), out };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
  const env = { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
  if (!env.url || !env.anonKey || !env.serviceKey) { console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno.'); process.exit(1); }
  const { createClient } = await import('@supabase/supabase-js');
  const opts = { auth: { autoRefreshToken: false, persistSession: false } };
  const admin = createClient(env.url, env.serviceKey, opts);
  const makeAnon = () => createClient(env.url, env.anonKey, opts);
  const cmds = {
    prepare: () => cmdPrepare({ admin, makeAnon, env, emailA: arg('email-a') }),
    negatives: () => cmdNegatives({ makeAnon, env }),
    'send-otp': () => cmdSendOtp({ makeAnon }),
    delete: () => cmdDelete({ admin, makeAnon, env, otp: arg('otp') }),
    verify: () => cmdVerify({ admin, makeAnon }),
    cleanup: () => cmdCleanup({ admin }),
  };
  if (!cmds[cmd]) { console.error('Comandos: prepare | negatives | send-otp | delete --otp N | verify | cleanup'); process.exit(1); }
  try {
    const result = await cmds[cmd]();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok === false ? 1 : 0);
  } catch (e) { console.error(`[e2e] ${e.message}`); process.exit(1); }
}
