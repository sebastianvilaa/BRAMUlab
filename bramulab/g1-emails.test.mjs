// BRAMUlab — G1 Emails/Auth V1 (Issue #21, handoff 89): pruebas dirigidas a riesgos reales.
//   node --test bramulab/g1-emails.test.mjs        (usa PGlite: requiere `npm ci` en supabase/scripts)
//
// A. Desafíos sensibles contra la base REAL replayada (RPC + núcleo de la Edge Function con mailer/Auth inyectados).
// B. Eliminación P0.3 + prueba delete_account + Email #8 (motor real contra la base efímera).
// C. Templates/asuntos/copy exactos (handoff 89 §2/§3), logo, email-safety, nativos versionados == generados.
// D. Estáticos: seguridad de grants/RLS, secretos, Production/BRAMUlive, Edge Functions, regresiones de signup/recovery.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../supabase/scripts/replay-migrations.mjs';
import { seedOpsFixtures, IDS } from '../supabase/scripts/ops-fixtures.mjs';
import { makePgliteAdminClient } from '../supabase/scripts/pglite-admin-client.mjs';
import { handleAccountChallenge, finishDeletionReceipt, validateBody, withRetries } from '../supabase/functions/_shared/account-challenge-core.mjs';
import { handleSelfDeletion } from '../supabase/functions/_shared/self-delete-core.mjs';
import { runAccountDeletion, verifyAccountDeleted } from '../supabase/functions/_shared/account-deletion-core.mjs';
import { EMAIL_TEMPLATES, renderEmail, renderEmailText, subjectFor, NATIVE_TEMPLATES, BRAND, TOKENS } from '../supabase/functions/_shared/email-templates.mjs';
import { checkAll, generate } from '../supabase/scripts/build-email-templates.mjs';
import { buildAuthConfigPayload, diffAgainst } from '../supabase/scripts/sync-auth-email-templates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const PEPPER = 'p'.repeat(48);
const hmac = async (m) => crypto.createHmac('sha256', PEPPER).update(m).digest('hex');

/* ====================================================================================================================== */
/* Mundo efímero compartido: UN replay (es lo caro) + fixtures de 9B (A,B,C,D con players) + usuarios sueltos.            */
/* ====================================================================================================================== */
let W = null;
async function world() {
  if (W) return W;
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok, 'el replay de migraciones (incluida la de G1) debe aplicar desde cero');
  const fx = await seedOpsFixtures(r.db);
  W = { db: r.db, fx, client: makePgliteAdminClient(r.db) };
  return W;
}
let seq = 0;
async function newUser(w, prefix) {
  seq += 1;
  const id = crypto.randomUUID();
  const email = `${prefix}${seq}@example.test`;
  await w.db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, email]);
  return { id, email };
}
const rows = async (w, userId) => (await w.db.query(`select * from public.account_challenges where auth_user_id = $1 order by created_at, purpose`, [userId])).rows;
const allowResend = (w, userId) => w.db.query(`update public.account_challenges set resend_available_at = now() - interval '1 second' where auth_user_id = $1`, [userId]);

/** Arnés del núcleo de la Edge Function sobre la base real: Auth/mailer/limiter inyectados y observables. */
function harness(w, opts = {}) {
  const outbox = []; const logs = []; const signedOut = []; const updates = []; const rl = [];
  const queue = [...(opts.codes || [])];
  const rpcClient = opts.rpcWrap ? opts.rpcWrap(w.client) : w.client;
  const base = {
    getUser: async (jwt) => {
      const id = String(jwt).replace(/^jwt:/, '');
      const r = (await w.db.query(`select id, email from auth.users where id::text = $1`, [id])).rows[0];
      return r || null;
    },
    rpc: (n, a) => rpcClient.rpc(n, a),
    hmac,
    randomCode: () => (queue.length ? queue.shift() : String(crypto.randomInt(0, 1000000)).padStart(6, '0')),
    sendMail: async (m) => {
      if (opts.failMail && opts.failMail(m)) return { ok: false, code: 'EAUTH' };
      outbox.push({ ...m });
      return { ok: true };
    },
    rateLimit: async (...a) => { rl.push(a); return opts.rateLimit ? opts.rateLimit(...a) : true; },
    updateAuthEmail: async (id, email) => {
      updates.push([id, email]);
      if (opts.failUpdate) return { ok: false, code: 'auth_error' };
      try { await w.db.query(`update auth.users set email = $2 where id = $1`, [id, email]); return { ok: true }; } catch (_e) { return { ok: false, code: 'email_taken' }; }
    },
    signOutOthers: async (jwt) => { signedOut.push(jwt); return opts.signOutFails ? false : true; },
    log: (c) => logs.push(c),
    sleep: async () => {},
  };
  const call = (userId, body) => handleAccountChallenge({ ...base, jwt: `jwt:${userId}`, body });
  return { call, outbox, logs, signedOut, updates, rl, base };
}
const body = (r) => JSON.stringify(r.body);
/** Último código que el mailer falso recibió para ese email (los pedidos rechazados NO generan envío). */
const codeOf = (h, emailId) => h.outbox.filter((m) => m.emailId === emailId).at(-1).code;

/* ============================ A. desafíos sensibles ============================ */

test('A1 · aislamiento de propósito: un código de un propósito NO verifica otro (ni siquiera con el mismo valor)', async () => {
  const w = await world(); const u = await newUser(w, 'iso');
  const h = harness(w, { codes: ['111111', '222222'] });
  assert.equal((await h.call(u.id, { action: 'request', purpose: 'change_email_current' })).status, 200);
  assert.equal((await h.call(u.id, { action: 'request', purpose: 'delete_account' })).status, 200);
  // el código de change_email_current NO sirve para delete_account ni para change_email_new
  let r = await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '111111' });
  assert.equal(r.status, 400); assert.equal(r.body.code, 'code_invalid');
  r = await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '111111' });
  assert.equal(r.body.code, 'code_invalid');
  // y no quedó ninguna prueba delete_account
  assert.equal((await w.client.rpc('account_delete_proof_check', { p_auth_user_id: u.id, p_max_age_seconds: 600 })).data.ok, false);
  // cada propósito sí verifica con SU código
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '222222' })).status, 200);
  assert.equal((await w.client.rpc('account_delete_proof_check', { p_auth_user_id: u.id, p_max_age_seconds: 600 })).data.ok, true);
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: '111111' })).body.next, 'new_email');
});

test('A2 · el usuario A no puede verificar ni consumir el desafío de B (mismo código, otra identidad)', async () => {
  const w = await world(); const a = await newUser(w, 'a'); const b = await newUser(w, 'b');
  const h = harness(w, { codes: ['424242', '424242'] }); // mismo código para ambos: el hash está atado al usuario
  await h.call(a.id, { action: 'request', purpose: 'delete_account' });
  // B no tiene desafío: con el código de A (o el mismo valor) no verifica nada
  let r = await h.call(b.id, { action: 'verify', purpose: 'delete_account', code: '424242' });
  assert.equal(r.body.code, 'code_invalid');
  // B emite el suyo con el MISMO valor; el hash difiere por usuario => los hashes almacenados son distintos
  await h.call(b.id, { action: 'request', purpose: 'delete_account' });
  const [ha, hb] = [(await rows(w, a.id))[0].code_hash, (await rows(w, b.id))[0].code_hash];
  assert.notEqual(ha, hb);
  // verificar el de B no toca el de A
  assert.equal((await h.call(b.id, { action: 'verify', purpose: 'delete_account', code: '424242' })).status, 200);
  assert.equal((await rows(w, a.id))[0].verified_at, null);
  assert.equal((await w.client.rpc('account_delete_proof_check', { p_auth_user_id: a.id, p_max_age_seconds: 600 })).data.ok, false);
  // el receipt/finalize de A tampoco se puede disparar con el challengeId de B
  const cidB = (await rows(w, b.id))[0].challenge_id;
  assert.equal((await w.client.rpc('account_receipt_claim', { p_auth_user_id: a.id, p_challenge_id: cidB })).data.claimed, false);
  assert.equal((await w.client.rpc('account_email_change_finalize', { p_auth_user_id: a.id, p_challenge_id: cidB })).data, false);
});

test('A3 · el email ACTUAL/destino se deriva server-side: el body no puede traerlo y el mail va al email de Auth', async () => {
  const w = await world(); const u = await newUser(w, 'tgt');
  const h = harness(w);
  for (const extra of [{ email: 'victima@example.test' }, { to: 'victima@example.test' }, { userId: u.id }, { previousEmail: 'x@example.test' }, { playerId: 'x' }]) {
    const r = await h.call(u.id, { action: 'request', purpose: 'change_email_current', ...extra });
    assert.equal(r.status, 400, Object.keys(extra)[0]); assert.equal(r.body.code, 'invalid_payload');
  }
  assert.equal(h.outbox.length, 0);
  // newEmail solo en change_email_new
  assert.equal((await h.call(u.id, { action: 'request', purpose: 'delete_account', newEmail: 'x@example.test' })).status, 400);
  assert.equal((await h.call(u.id, { action: 'request', purpose: 'change_email_new' })).status, 400, 'sin newEmail');
  assert.equal(validateBody({ action: 'verify', purpose: 'delete_account', code: '12345' }).ok, false);
  assert.equal(validateBody({ action: 'verify', purpose: 'delete_account', code: '12345a' }).ok, false);
  // el email #3 sale al email de Auth del JWT
  assert.equal((await h.call(u.id, { action: 'request', purpose: 'change_email_current' })).status, 200);
  assert.equal(h.outbox.length, 1);
  assert.equal(h.outbox[0].to, u.email); assert.equal(h.outbox[0].emailId, 3);
  // sin JWT válido / sin sesión => 401 y nada se envía
  const before = h.outbox.length;
  assert.equal((await handleAccountChallenge({ ...h.base, jwt: '', body: { action: 'request', purpose: 'delete_account' } })).status, 401);
  assert.equal((await h.call(crypto.randomUUID(), { action: 'request', purpose: 'delete_account' })).status, 401);
  assert.equal(h.outbox.length, before);
});

test('A4 · change_email_new BLOQUEADO si no pasó change_email_current; solo entonces se acepta newEmail (normalizado/validado)', async () => {
  const w = await world(); const u = await newUser(w, 'blk'); const other = await newUser(w, 'taken');
  const h = harness(w);
  const req = (newEmail) => h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail });
  let r = await req('nuevo.a@example.test');
  assert.equal(r.status, 403); assert.equal(r.body.code, 'current_verification_required');
  // pedir el primero NO alcanza: hay que verificarlo
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' });
  r = await req('nuevo.a@example.test');
  assert.equal(r.body.code, 'current_verification_required');
  // complete_email_change tampoco puede saltearse nada
  r = await h.call(u.id, { action: 'complete_email_change' });
  assert.equal(r.body.code, 'new_verification_required'); assert.equal(h.updates.length, 0);
  await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: codeOf(h, 3) });
  // validaciones del email nuevo
  assert.equal((await req('no-es-email')).body.code, 'invalid_email');
  assert.equal((await req(u.email.toUpperCase())).body.code, 'same_email');
  assert.equal((await req(other.email)).body.code, 'email_taken'); assert.equal((await req(other.email)).status, 409);
  assert.equal(h.outbox.filter((m) => m.emailId === 4).length, 0, 'ningún #4 salió por pedidos inválidos');
  r = await req('  Nuevo.A@Example.TEST ');
  assert.equal(r.status, 200);
  const sent4 = h.outbox.find((m) => m.emailId === 4);
  assert.equal(sent4.to, 'nuevo.a@example.test', '#4 va al email NUEVO normalizado');
  assert.equal(h.updates.length, 0, 'el email de Auth no cambia todavía');
  const stored = (await rows(w, u.id)).find((x) => x.purpose === 'change_email_new');
  assert.equal(stored.target_email, 'nuevo.a@example.test'); assert.equal(stored.previous_email, u.email);
  // reiniciar el primer paso invalida el segundo (depende de él)
  await allowResend(w, u.id);
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' });
  assert.equal((await rows(w, u.id)).find((x) => x.purpose === 'change_email_new').invalidated_at != null, true);
});

test('A5 · expiración (60 min), uso único e intentos', async () => {
  const w = await world(); const u = await newUser(w, 'exp');
  const h = harness(w, { codes: ['300001', '300002', '300003'] });
  const res = await h.call(u.id, { action: 'request', purpose: 'delete_account' });
  assert.deepEqual([res.body.expiresInSeconds, res.body.resendAfterSeconds], [3600, 60]);
  let row = (await rows(w, u.id))[0];
  assert.equal((new Date(row.expires_at) - new Date(row.created_at)) / 60000, 60, 'vence a los 60 minutos');
  // vencido
  await w.db.query(`update public.account_challenges set expires_at = now() - interval '1 second' where challenge_id = $1`, [row.challenge_id]);
  let r = await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '300001' });
  assert.equal(r.status, 410); assert.equal(r.body.code, 'code_expired');
  assert.equal((await w.client.rpc('account_delete_proof_check', { p_auth_user_id: u.id, p_max_age_seconds: 600 })).data.ok, false);
  // uso único
  await allowResend(w, u.id);
  await h.call(u.id, { action: 'request', purpose: 'delete_account' });
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '300002' })).status, 200);
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '300002' })).body.code, 'code_invalid', 'el mismo código no se reusa');
  // intentos: 5 errores invalidan; después ni el correcto sirve
  await allowResend(w, u.id);
  await h.call(u.id, { action: 'request', purpose: 'delete_account' }); // 300003
  const left = [];
  for (let i = 0; i < 4; i += 1) { r = await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '999999' }); assert.equal(r.body.code, 'code_invalid'); left.push(r.body.attemptsLeft); }
  assert.deepEqual(left, [4, 3, 2, 1]);
  r = await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '999999' });
  assert.equal(r.status, 429); assert.equal(r.body.code, 'too_many_attempts');
  r = await h.call(u.id, { action: 'verify', purpose: 'delete_account', code: '300003' });
  assert.notEqual(r.status, 200, 'agotados los intentos el código correcto ya no sirve');
});

test('A6 · reenvío >= 60 s, reenvío invalida el anterior, tope de 5 envíos/hora y rate limit del endpoint', async () => {
  const w = await world(); const u = await newUser(w, 'rsd');
  const h = harness(w);
  assert.equal((await h.call(u.id, { action: 'request', purpose: 'change_email_current' })).status, 200);
  let r = await h.call(u.id, { action: 'request', purpose: 'change_email_current' });
  assert.equal(r.status, 429); assert.equal(r.body.code, 'resend_too_soon');
  assert.ok(r.body.retryAfterSeconds >= 1 && r.body.retryAfterSeconds <= 60);
  assert.equal(h.outbox.length, 1, 'el reenvío prematuro no envía otro mail');
  const first = codeOf(h, 3);
  await allowResend(w, u.id);
  assert.equal((await h.call(u.id, { action: 'request', purpose: 'change_email_current' })).status, 200);
  assert.notEqual(codeOf(h, 3), first);
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: first })).body.code, 'code_invalid', 'el código anterior quedó invalidado por el reenvío');
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: codeOf(h, 3) })).status, 200);
  // tope por hora (5): ya hay 2; 3 más y el 6.º se frena
  const u2 = await newUser(w, 'cap'); const h2 = harness(w);
  for (let i = 0; i < 5; i += 1) { assert.equal((await h2.call(u2.id, { action: 'request', purpose: 'delete_account' })).status, 200, `envío ${i + 1}`); await allowResend(w, u2.id); }
  r = await h2.call(u2.id, { action: 'request', purpose: 'delete_account' });
  assert.equal(r.status, 429); assert.equal(r.body.code, 'rate_limited'); assert.equal(h2.outbox.length, 5);
  // rate limit del endpoint (limitador por cuenta, fail-open propio): si niega => 429 y no se emite nada
  const u3 = await newUser(w, 'rl'); const h3 = harness(w, { rateLimit: async () => false });
  r = await h3.call(u3.id, { action: 'request', purpose: 'delete_account' });
  assert.equal(r.status, 429); assert.equal(r.body.code, 'rate_limited');
  assert.equal(h3.outbox.length, 0); assert.equal((await rows(w, u3.id)).length, 0);
  assert.deepEqual(h3.rl[0].slice(1), ['account_challenge_request', 10, 3600]);
  const h4 = harness(w); await h4.call(u3.id, { action: 'verify', purpose: 'delete_account', code: '123456' });
  assert.deepEqual(h4.rl[0].slice(1), ['account_challenge_verify', 30, 3600]);
});

test('A7 · el OTP se guarda SOLO como hash y no aparece en respuestas, logs ni filas; los emails tampoco se loguean', async () => {
  const w = await world(); const u = await newUser(w, 'hsh');
  const CODE = '738204';
  const h = harness(w, { codes: [CODE, '555555'], failMail: (m) => m.emailId === 4 });
  const seen = [];
  seen.push(body(await h.call(u.id, { action: 'request', purpose: 'change_email_current' })));
  const row = (await rows(w, u.id))[0];
  assert.match(row.code_hash, /^[0-9a-f]{64}$/);
  assert.equal(row.code_hash, await hmac(`change_email_current:${u.id}:${CODE}`), 'HMAC atado a propósito + usuario');
  assert.ok(!JSON.stringify(row).includes(CODE), 'ninguna columna contiene el OTP en claro');
  seen.push(body(await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: CODE })));
  assert.equal((await rows(w, u.id))[0].code_hash, null, 'verificado => hash borrado');
  // fallo de envío del #4: se loguea solo un código, sin email ni OTP; y el desafío se revoca (sin fantasma)
  const r = await h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'oculto@example.test' });
  seen.push(body(r));
  assert.equal(r.status, 502); assert.equal(r.body.code, 'send_failed'); assert.equal(r.body.retryable, true);
  assert.equal((await rows(w, u.id)).filter((x) => x.purpose === 'change_email_new').length, 0, 'envío fallido => sin desafío fantasma');
  const blob = [...seen, ...h.logs].join('|');
  for (const secret of [CODE, '555555', 'oculto@example.test', u.email, PEPPER]) assert.ok(!blob.includes(secret), `no debe filtrarse ${secret.slice(0, 4)}…`);
  assert.deepEqual(h.logs, ['send_failed:EAUTH']);
  // el envío fallido libera el cupo: reintento inmediato permitido (no resend_too_soon)
  const h2 = harness(w, { codes: ['666666'] });
  assert.equal((await h2.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'oculto@example.test' })).status, 200);
});

test('A8 · el email cambia SOLO tras las dos verificaciones; luego revoca otras sesiones, avisa al anterior (#5) y limpia PII', async () => {
  const w = await world(); const u = await newUser(w, 'chg');
  const h = harness(w, { codes: ['500001', '500002'] });
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' });
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: '500001' })).body.next, 'new_email');
  assert.equal(h.updates.length, 0, 'verificar el actual NO cambia el email');
  await h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'despues@example.test' });
  assert.equal(h.updates.length, 0, 'pedir el nuevo NO cambia el email');
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '000000' })).status, 400);
  assert.equal(h.updates.length, 0, 'un código incorrecto NO cambia el email');
  const r = await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '500002' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, emailChanged: true, othersSignedOut: true, notice: 'sent' });
  assert.deepEqual(h.updates, [[u.id, 'despues@example.test']]);
  assert.equal((await w.db.query(`select email from auth.users where id = $1`, [u.id])).rows[0].email, 'despues@example.test');
  assert.deepEqual(h.signedOut, [`jwt:${u.id}`], 'cierra las DEMÁS sesiones con el JWT de la sesión actual');
  // #3, #4 y UN solo #5 al email ANTERIOR con anterior/nuevo
  assert.deepEqual(h.outbox.map((m) => m.emailId), [3, 4, 5]);
  assert.deepEqual(h.outbox[2], { emailId: 5, to: u.email, previousEmail: u.email, newEmail: 'despues@example.test' });
  assert.ok(!body(r).includes('example.test'), 'la respuesta no trae emails');
  // PII temporal limpia, desafíos consumidos
  const rs = await rows(w, u.id);
  assert.ok(rs.every((x) => x.consumed_at && x.code_hash === null && x.target_email === null && x.previous_email === null));
  // repetir no re-cambia ni re-avisa
  assert.equal((await h.call(u.id, { action: 'complete_email_change' })).body.code, 'new_verification_required');
  assert.equal((await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '500002' })).body.code, 'code_invalid');
  assert.equal(h.updates.length, 1); assert.equal(h.outbox.filter((m) => m.emailId === 5).length, 1);
});

test('A9 · cambio a medias (Auth cambió, faltó consumir) es reintentable e idempotente: un solo #5 aunque haya reintentos concurrentes', async () => {
  const w = await world(); const u = await newUser(w, 'par');
  let failFinalize = 1;
  const h = harness(w, { codes: ['600001', '600002'], rpcWrap: (c) => ({ rpc: async (n, a) => (n === 'account_email_change_finalize' && failFinalize-- > 0 ? { data: null, error: { message: 'boom' } } : c.rpc(n, a)) }) });
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' });
  await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: '600001' });
  await h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'parcial@example.test' });
  let r = await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '600002' });
  assert.equal(r.status, 502); assert.equal(r.body.code, 'change_incomplete'); assert.equal(r.body.retryable, true);
  assert.equal(h.outbox.filter((m) => m.emailId === 5).length, 0, 'sin #5 hasta completar');
  // dos reintentos CONCURRENTES: ambos terminan ok, pero el aviso sale una sola vez y Auth no se vuelve a tocar
  const [r1, r2] = await Promise.all([h.call(u.id, { action: 'complete_email_change' }), h.call(u.id, { action: 'complete_email_change' })]);
  assert.ok([r1, r2].some((x) => x.status === 200 && x.body.notice === 'sent'));
  assert.ok([r1, r2].every((x) => x.status === 200 || x.body.code === 'new_verification_required'));
  assert.equal(h.outbox.filter((m) => m.emailId === 5).length, 1, 'idempotencia del aviso #5');
  assert.equal(h.updates.length, 1, 'Auth actualizado una sola vez (el reintento ve el email ya cambiado)');
  assert.equal((await w.db.query(`select email from auth.users where id = $1`, [u.id])).rows[0].email, 'parcial@example.test');
});

test('A10 · fallos controlados: Auth rechaza el cambio, email ocupado en carrera, #5 no se puede enviar (el cambio igual vale y el claim se libera)', async () => {
  const w = await world();
  // Auth falla: no se consume nada, reintentable
  let u = await newUser(w, 'f1');
  let h = harness(w, { codes: ['700001', '700002'], failUpdate: true });
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' }); await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: '700001' });
  await h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'x1@example.test' });
  let r = await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '700002' });
  assert.equal(r.body.code, 'change_incomplete'); assert.equal((await rows(w, u.id)).filter((x) => x.consumed_at).length, 0);
  assert.equal(h.outbox.filter((m) => m.emailId === 5).length, 0);
  // email tomado entre el pedido y la verificación => 409 sin consumir
  u = await newUser(w, 'f2'); const rival = await newUser(w, 'f2rival');
  h = harness(w, { codes: ['710001', '710002'] });
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' }); await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: '710001' });
  await h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'carrera@example.test' });
  await w.db.query(`update auth.users set email = 'carrera@example.test' where id = $1`, [rival.id]);
  r = await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '710002' });
  assert.equal(r.status, 409); assert.equal(r.body.code, 'email_taken');
  // #5 no sale: el cambio es efectivo igual, se informa notice:'failed' y se libera el claim
  u = await newUser(w, 'f3');
  h = harness(w, { codes: ['720001', '720002'], failMail: (m) => m.emailId === 5 });
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' }); await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: '720001' });
  await h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'sinaviso@example.test' });
  r = await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '720002' });
  assert.equal(r.status, 200); assert.equal(r.body.notice, 'failed'); assert.equal(r.body.emailChanged, true);
  assert.equal((await rows(w, u.id)).find((x) => x.purpose === 'change_email_new').receipt_claimed_at, null);
  assert.deepEqual(h.logs, ['changed_notice_failed:EAUTH']);
  // si el servidor no pudo cerrar otras sesiones lo informa (el cliente hace el fallback)
  u = await newUser(w, 'f4'); h = harness(w, { codes: ['730001', '730002'], signOutFails: true });
  await h.call(u.id, { action: 'request', purpose: 'change_email_current' }); await h.call(u.id, { action: 'verify', purpose: 'change_email_current', code: '730001' });
  await h.call(u.id, { action: 'request', purpose: 'change_email_new', newEmail: 'sesiones@example.test' });
  r = await h.call(u.id, { action: 'verify', purpose: 'change_email_new', code: '730002' });
  assert.equal(r.body.othersSignedOut, false);
});

test('A11 · reintentos de envío acotados (withRetries) y mailer no configurado => error limpio sin desafío fantasma', async () => {
  let n = 0;
  const ok = await withRetries(async () => (++n < 3 ? { ok: false } : { ok: true }), { attempts: 3, sleep: async () => {} });
  assert.equal(ok.ok, true); assert.equal(n, 3);
  n = 0; const bad = await withRetries(async () => { n += 1; throw new Error('x'); }, { attempts: 2, sleep: async () => {} });
  assert.equal(bad.ok, false); assert.equal(n, 2);
  const w = await world(); const u = await newUser(w, 'nc');
  const h = harness(w);
  h.base.sendMail = async () => ({ ok: false, code: 'mailer_not_configured' });
  const r = await handleAccountChallenge({ ...h.base, jwt: `jwt:${u.id}`, body: { action: 'request', purpose: 'delete_account' } });
  assert.equal(r.status, 503); assert.equal(r.body.code, 'mailer_not_configured');
  assert.equal((await rows(w, u.id)).length, 0);
});

/* ============================ B. eliminación (P0.3) ============================ */

function deletionDeps(w, h, userId, client = w.client, jwtUser = userId) {
  return {
    jwt: `jwt:${jwtUser}`, body: { confirm: true },
    getUser: h.base.getUser,
    checkDeleteProof: async (id) => (await client.rpc('account_delete_proof_check', { p_auth_user_id: id, p_max_age_seconds: 600 })).data,
    resolvePlayer: async (id) => (await client.rpc('resolve_player_for_account_deletion', { p_auth_user_id: id })).data,
    runDeletion: (pid) => runAccountDeletion(client, pid, {}),
    verifyDeletion: (pid, aid) => verifyAccountDeleted(client, pid, aid),
    finishReceipt: (m) => finishDeletionReceipt({ rpc: (n, a) => client.rpc(n, a), sendMail: h.base.sendMail, log: h.base.log, sleep: async () => {} }, m),
  };
}

test('B1 · eliminación bloqueada sin delete_account verificado (desafío pedido pero no verificado, o de otro propósito, o vencido) — nada se borra', async () => {
  const w = await world(); const A = IDS.A;
  const h = harness(w, { codes: ['810001', '810002'] });
  const player = async () => (await w.db.query(`select is_active, deleted_at from public.players where auth_user_id = $1`, [A])).rows[0];
  let r = await handleSelfDeletion(deletionDeps(w, h, A));
  assert.equal(r.status, 403); assert.equal(r.body.code, 'delete_challenge_required');
  await h.call(A, { action: 'request', purpose: 'delete_account' });
  r = await handleSelfDeletion(deletionDeps(w, h, A));
  assert.equal(r.status, 403, 'pedido pero NO verificado');
  // una prueba de OTRO propósito (cambio de email) no habilita la eliminación
  await h.call(A, { action: 'request', purpose: 'change_email_current' });
  await h.call(A, { action: 'verify', purpose: 'change_email_current', code: '810002' });
  r = await handleSelfDeletion(deletionDeps(w, h, A));
  assert.equal(r.status, 403, 'change_email_current verificado no es delete_account');
  // prueba vieja (> 10 min) no vale
  await h.call(A, { action: 'verify', purpose: 'delete_account', code: '810001' });
  await w.db.query(`update public.account_challenges set verified_at = now() - interval '11 minutes' where auth_user_id = $1 and purpose = 'delete_account'`, [A]);
  r = await handleSelfDeletion(deletionDeps(w, h, A));
  assert.equal(r.status, 403, 'prueba vencida');
  assert.equal((await player()).is_active, true); assert.equal((await player()).deleted_at, null);
  assert.equal(h.outbox.filter((m) => m.emailId === 8).length, 0);
  // restaurar la prueba para B2
  await w.db.query(`update public.account_challenges set verified_at = now() where auth_user_id = $1 and purpose = 'delete_account'`, [A]);
});

test('B2 · Email #8 solo tras postcondiciones OK: fallo del motor => sin mail y reintentable con la MISMA prueba; éxito => un solo #8, sin código, y se purga todo', async () => {
  const w = await world(); const B = IDS.B;
  const h = harness(w, { codes: ['820001'] });
  const failing = makePgliteAdminClient(w.db, { failOn: { 'auth.delete': 1 } });
  await h.call(B, { action: 'request', purpose: 'delete_account' });
  assert.equal((await h.call(B, { action: 'verify', purpose: 'delete_account', code: '820001' })).body.next, 'confirm_delete');
  let r = await handleSelfDeletion(deletionDeps(w, h, B, failing));
  assert.equal(r.status, 500); assert.equal(r.body.code, 'deletion_incomplete'); assert.equal(r.body.retryable, true);
  assert.equal(h.outbox.filter((m) => m.emailId === 8).length, 0, 'sin #8 si la eliminación no terminó');
  assert.ok((await rows(w, B)).length > 0, 'la prueba se conserva para el reintento');
  // reintento con la misma prueba y el motor real: éxito + postcondiciones + #8
  r = await handleSelfDeletion(deletionDeps(w, h, B));
  assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.receipt, 'sent');
  assert.ok(Object.values(r.body.postconditions).every((v) => v === true), 'postcondiciones P0.3 reales');
  const m8 = h.outbox.filter((m) => m.emailId === 8);
  assert.equal(m8.length, 1);
  assert.deepEqual(m8[0], { emailId: 8, to: 'tercero.b@example.test' }, 'email capturado ANTES de borrar Auth; sin código ni datos extra');
  assert.ok(!JSON.stringify(r.body).includes('example.test'));
  assert.equal((await rows(w, B)).length, 0, 'purga total del usuario eliminado en account_challenges');
  assert.equal((await w.db.query(`select count(*)::int n from auth.users where id = $1`, [B])).rows[0].n, 0);
  // repetir con el mismo JWT: la cuenta ya no existe => 401, sin segundo #8
  r = await handleSelfDeletion(deletionDeps(w, h, B));
  assert.equal(r.status, 401); assert.equal(h.outbox.filter((m) => m.emailId === 8).length, 1);
  // P0.3 sigue anonimizando
  const p = (await w.db.query(`select display_name, is_active, auth_user_id from public.players where player_id = $1`, [w.fx.pid.B])).rows[0];
  assert.deepEqual([p.display_name, p.is_active, p.auth_user_id], ['Jugador eliminado', false, null]);
});

test('B3 · el #8 es idempotente (claim) y un fallo de SMTP no revierte la eliminación', async () => {
  const w = await world(); const C = IDS.C;
  const h = harness(w, { codes: ['830001'], failMail: (m) => m.emailId === 8 });
  await h.call(C, { action: 'request', purpose: 'delete_account' });
  await h.call(C, { action: 'verify', purpose: 'delete_account', code: '830001' });
  const proof = (await w.client.rpc('account_delete_proof_check', { p_auth_user_id: C, p_max_age_seconds: 600 })).data;
  const deps = { rpc: (n, a) => w.client.rpc(n, a), sendMail: h.base.sendMail, log: h.base.log, sleep: async () => {} };
  // claim doble (concurrente): solo uno intenta enviar
  const [x, y] = await Promise.all([
    finishDeletionReceipt({ ...deps, sendMail: async (m) => { h.outbox.push({ ...m, probe: true }); return { ok: true }; } }, { authUserId: C, challengeId: proof.challengeId, email: 'c@example.test' }),
    finishDeletionReceipt({ ...deps, sendMail: async (m) => { h.outbox.push({ ...m, probe: true }); return { ok: true }; } }, { authUserId: C, challengeId: proof.challengeId, email: 'c@example.test' }),
  ]);
  assert.deepEqual([x, y].sort(), ['duplicate', 'sent']);
  assert.equal(h.outbox.filter((m) => m.probe).length, 1);
  // SMTP caído en la eliminación real de C: 200 + receipt:'failed', cuenta eliminada igual
  const h2 = harness(w, { failMail: (m) => m.emailId === 8 });
  const w2 = await newUser(w, 'smtp');
  // (C ya consumió su recibo arriba; verificamos el contrato de "failed" con un usuario descartable + el núcleo)
  await h2.call(w2.id, { action: 'request', purpose: 'delete_account' });
  await h2.call(w2.id, { action: 'verify', purpose: 'delete_account', code: codeOf(h2, 7) });
  const pr = (await w.client.rpc('account_delete_proof_check', { p_auth_user_id: w2.id, p_max_age_seconds: 600 })).data;
  const st = await finishDeletionReceipt({ ...deps, sendMail: h2.base.sendMail, log: h2.base.log }, { authUserId: w2.id, challengeId: pr.challengeId, email: w2.email });
  assert.equal(st, 'failed'); assert.deepEqual(h2.logs.filter((l) => l.startsWith('deletion_receipt')), ['deletion_receipt_failed:EAUTH']);
  assert.equal((await rows(w, w2.id)).length, 0, 'aun con fallo de envío no queda PII del usuario');
  assert.equal(await finishDeletionReceipt({ ...deps }, { authUserId: w2.id, challengeId: pr.challengeId, email: '' }), 'skipped');
});

/* ============================ A+. seguridad de tabla / grants ============================ */

test('A12 · account_challenges es server-only: RLS sin políticas, cero privilegios de cliente; RPC solo service_role (también en la práctica: authenticated recibe permission denied)', async () => {
  const w = await world();
  const t = (await w.db.query(`select c.relrowsecurity rls, (select count(*)::int from pg_policies where tablename = 'account_challenges') pol,
    has_table_privilege('anon', c.oid, 'select') a1, has_table_privilege('authenticated', c.oid, 'select') a2, has_table_privilege('authenticated', c.oid, 'insert') a3,
    has_table_privilege('authenticated', c.oid, 'update') a4, has_table_privilege('authenticated', c.oid, 'delete') a5, has_table_privilege('anon', c.oid, 'insert') a6
    from pg_class c where c.relname = 'account_challenges'`)).rows[0];
  assert.equal(t.rls, true); assert.equal(t.pol, 0);
  assert.deepEqual([t.a1, t.a2, t.a3, t.a4, t.a5, t.a6], [false, false, false, false, false, false]);
  const fns = (await w.db.query(`select p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u,
    has_function_privilege('public', p.oid, 'execute') pub, has_function_privilege('service_role', p.oid, 'execute') s
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ~ '^account_(challenge|challenges|email_change|delete_proof|receipt)'`)).rows;
  assert.equal(fns.length, 10);
  assert.ok(fns.every((f) => f.prosecdef && !f.a && !f.u && !f.pub && f.s), JSON.stringify(fns.filter((f) => f.a || f.u || f.pub || !f.s)));
  for (const role of ['authenticated', 'anon']) {
    await w.db.exec(`set role ${role}`);
    try {
      await assert.rejects(() => w.db.query(`select public.account_challenge_issue(gen_random_uuid(), 'delete_account', repeat('a', 64))`), /permission denied/);
      await assert.rejects(() => w.db.query(`select * from public.account_challenges`), /permission denied/);
    } finally { await w.db.exec('reset role'); }
  }
});

/* ============================ C. templates ============================ */

// Copy EXACTO del handoff 89 §2 (tipeado aparte del módulo: si alguien cambia el copy, este test rompe).
const COPY = {
  1: { subject: 'Confirmá tu cuenta en BRAMUlab', cat: 'CUENTA', lines: ['Confirmá tu cuenta', 'Este es tu código para terminar de crear tu cuenta en BRAMUlab.', 'El código vence en 60 minutos.', 'Ingresalo en BRAMUlab y listo.', 'Nos vemos en la cancha. 🎾', 'Si no fuiste vos quien inició este registro, podés ignorar este email.'] },
  2: { subject: 'Recuperá tu contraseña en BRAMUlab', cat: 'ACCESO', lines: ['Recuperá tu contraseña', 'Recibimos una solicitud para cambiar la contraseña de tu cuenta.', 'Usá este código para continuar:', 'El código vence en 60 minutos.', 'Ingresalo en BRAMUlab y elegí una nueva contraseña.', 'Si no pediste este cambio, podés ignorar este email. Tu contraseña actual seguirá funcionando.'] },
  3: { subject: 'Confirmá el cambio de email en BRAMUlab', cat: 'SEGURIDAD', lines: ['Confirmá el cambio de email', 'Pediste cambiar el email asociado a tu cuenta de BRAMUlab.', 'Antes de continuar, necesitamos confirmar que fuiste vos.', 'El código vence en 60 minutos.', 'Ingresalo en BRAMUlab para continuar con el cambio.', 'Si no solicitaste modificar tu email, no ingreses el código y contactanos.'] },
  4: { subject: 'Confirmá tu nuevo email en BRAMUlab', cat: 'CUENTA', lines: ['Confirmá tu nuevo email', 'Ya casi terminamos el cambio.', 'Usá este código para confirmar que esta es la nueva dirección que querés asociar a tu cuenta de BRAMUlab.', 'El código vence en 60 minutos.', 'Ingresalo en BRAMUlab para completar el cambio.', 'Si no reconocés esta solicitud, no ingreses el código y contactanos.'] },
  5: { subject: 'El email de tu cuenta fue cambiado', cat: 'SEGURIDAD', lines: ['Tu email fue cambiado', 'El email asociado a tu cuenta de BRAMUlab fue actualizado.', 'Email anterior', 'anterior@example.test', 'Email nuevo', 'nuevo@example.test', 'Si fuiste vos, no tenés que hacer nada.', 'Si no reconocés este cambio, contactanos cuanto antes.'] },
  6: { subject: 'La contraseña de tu cuenta fue cambiada', cat: 'SEGURIDAD', lines: ['Tu contraseña fue cambiada', 'La contraseña de tu cuenta de BRAMUlab fue actualizada correctamente.', 'Si fuiste vos, no tenés que hacer nada.', 'Si no reconocés este cambio, recuperá tu contraseña y contactanos cuanto antes.'] },
  7: { subject: 'Confirmá la eliminación de tu cuenta', cat: 'CUENTA', lines: ['Confirmá la eliminación de tu cuenta', 'Estás por eliminar definitivamente tu cuenta de BRAMUlab.', 'Usá este código para confirmar la acción:', 'El código vence en 60 minutos.', 'Antes de continuar, tené en cuenta que:', 'tu cuenta y tus datos personales activos serán eliminados o anonimizados según corresponda;', 'los partidos compartidos con otros jugadores permanecerán en sus historiales;', 'tu identidad en esos registros pasará a mostrarse como Jugador eliminado;', 'si volvés a registrarte en BRAMUlab, empezarás con una identidad nueva.', 'La eliminación es definitiva.', 'Si no fuiste vos quien inició esta acción, no ingreses el código y contactanos.'] },
  8: { subject: 'Tu cuenta de BRAMUlab fue eliminada', cat: 'CUENTA', lines: ['Tu cuenta fue eliminada', 'La eliminación de tu cuenta de BRAMUlab se completó correctamente.', 'La acción es definitiva y la cuenta ya no puede recuperarse.', 'No necesitás hacer nada más.'] },
};
const OPTS = { mode: 'custom', code: '482913', previousEmail: 'anterior@example.test', newEmail: 'nuevo@example.test', baseUrl: 'https://staging.example.test' };

test('C1 · los 8 emails: asunto, categoría y copy EXACTOS y en orden (HTML y texto plano)', () => {
  assert.deepEqual(Object.keys(EMAIL_TEMPLATES).map(Number), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(Object.values(COPY).map((c) => c.subject)).size, 8);
  for (const [id, c] of Object.entries(COPY)) {
    assert.equal(subjectFor(Number(id)), c.subject, `asunto #${id}`);
    const html = renderEmail(Number(id), OPTS); const text = renderEmailText(Number(id), OPTS);
    assert.ok(html.includes(`<title>${c.subject}</title>`), `title #${id}`);
    assert.ok(html.includes(`>${c.cat}<`), `categoría #${id}`);
    let at = 0; let atT = 0;
    for (const line of c.lines) {
      const i = html.indexOf(line, at); const j = text.indexOf(line, atT);
      assert.ok(i >= 0, `#${id} falta/desordenado en HTML: ${line}`); assert.ok(j >= 0, `#${id} falta/desordenado en texto: ${line}`);
      at = i; atT = j;
    }
    if (id === '5') assert.ok(html.indexOf('Email anterior') < html.indexOf('anterior@example.test') && html.indexOf('anterior@example.test') < html.indexOf('Email nuevo') && html.indexOf('Email nuevo') < html.indexOf('nuevo@example.test'));
  }
});

test('C2 · footer: estándar con soporte (#1–#7); #8 SOLO marca; #8 sin soporte, sin "si no fuiste vos", sin recuperación; único emoji 🎾 en #1', () => {
  for (let id = 1; id <= 7; id += 1) {
    const html = renderEmail(id, OPTS);
    assert.ok(html.includes('Donde vive tu p&aacute;del.') || html.includes(BRAND.tagline), `tagline #${id}`);
    assert.ok(html.includes('&iquest;Necesit&aacute;s ayuda?') && html.includes('bramulab@gmail.com'), `soporte #${id}`);
    assert.ok(renderEmailText(id, OPTS).includes('¿Necesitás ayuda? · bramulab@gmail.com'));
  }
  const h8 = renderEmail(8, OPTS) + renderEmailText(8, OPTS);
  assert.ok(h8.includes('BRAMUlab') && h8.includes('Donde vive tu pádel.'));
  assert.ok(!/bramulab@gmail|ayuda|soporte|contactanos|si no fuiste vos|recuper(á|a)|mailto/i.test(h8.replaceAll('La acción es definitiva y la cuenta ya no puede recuperarse.', '')), '#8 sin soporte ni promesa de recuperación');
  for (let id = 1; id <= 8; id += 1) assert.equal(/🎾/.test(renderEmail(id, OPTS)), id === 1, `emoji #${id}`);
  assert.ok(!/instagram/i.test(Object.keys(EMAIL_TEMPLATES).map((i) => renderEmail(Number(i), OPTS)).join('')));
});

test('C3 · diseño email-safe: tablas + estilos inline, sin flex/grid/webfonts/scripts, código como texto copiable, tokens Night Card, logo REAL con alt', () => {
  for (let id = 1; id <= 8; id += 1) {
    const html = renderEmail(id, OPTS);
    assert.ok(/<table role="presentation"/.test(html) && /max-width:560px/.test(html), `tabla central #${id}`);
    assert.ok(!/display\s*:\s*(flex|grid|inline-flex)|@font-face|@import|<link|<script|<style|<svg|<canvas|<iframe|<form|url\(/i.test(html), `construcciones prohibidas #${id}`);
    assert.ok(html.includes('font-family:Inter, Arial, Helvetica, sans-serif'));
    for (const c of [TOKENS.outer, TOKENS.bg, TOKENS.surface1, TOKENS.surface3, TOKENS.text]) assert.ok(html.toLowerCase().includes(c.toLowerCase()), `token ${c} #${id}`);
    assert.ok(/<img src="https:\/\/staging\.example\.test\/icons\/logo\.png" alt="BRAMUlab" height="30"/.test(html), `logo real #${id}`);
    assert.ok(/<meta name="viewport"/.test(html) && /<meta name="color-scheme" content="dark"/.test(html));
    assert.ok(!/href="https?:/.test(html), 'sin CTA/links externos (el soporte es mailto)');
  }
  // el código es TEXTO real, un único nodo (copiable), con tracking; lima normal / danger en eliminación
  for (const id of [1, 2, 3, 4]) { const h = renderEmail(id, OPTS); assert.ok(/>482913</.test(h) && /letter-spacing:10px/.test(h)); assert.ok(h.includes(`color:${TOKENS.lime};"><span style="color:${TOKENS.lime};">482913`)); }
  const h7 = renderEmail(7, OPTS);
  assert.ok(h7.includes(`<span style="color:${TOKENS.danger};">482913</span>`));
  assert.ok(!renderEmail(3, OPTS).includes(TOKENS.danger));
  assert.ok(!/<img[^>]*482913/.test(renderEmail(1, OPTS)), 'el código no es una imagen');
  // el logo declarado existe y es un PNG real (no reconstruido con texto)
  const logo = fs.readFileSync(path.join(__dirname, 'icons', 'logo.png'));
  assert.deepEqual([...logo.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(BRAND.logoPath, '/icons/logo.png');
  // inyección: los valores dinámicos se escapan
  const evil = renderEmail(5, { ...OPTS, previousEmail: '"><script>x</script>@e.test', newEmail: 'a<b@e.test' });
  assert.ok(!evil.includes('<script>') && evil.includes('&lt;script&gt;'));
  assert.throws(() => renderEmail(1, { ...OPTS, code: '12345' }), /6 dígitos/);
  assert.throws(() => renderEmail(1, { ...OPTS, code: '12345<' }), /6 dígitos/);
  assert.throws(() => renderEmail(5, { ...OPTS, previousEmail: '' }), /requiere/);
});

test('C4 · nativos de Supabase Auth (#1 #2 #4 #6): HTML standalone versionado == generado, con variables Go-template y sin códigos reales', () => {
  assert.deepEqual(NATIVE_TEMPLATES, { confirmation: 1, recovery: 2, email_change: 4, password_changed_notification: 6 });
  assert.deepEqual(checkAll(), [], 'lo versionado en supabase/email-templates coincide con lo generado desde la fuente única');
  const dir = path.join(__dirname, '..', 'supabase', 'email-templates');
  for (const [name, id] of Object.entries(NATIVE_TEMPLATES)) {
    const html = fs.readFileSync(path.join(dir, 'auth', `${name}.html`), 'utf8');
    assert.ok(html.includes('{{ .SiteURL }}/icons/logo.png'), `${name}: logo por SiteURL estable`);
    assert.ok(html.includes(`<title>${COPY[id].subject}</title>`));
    assert.equal(html.includes('{{ .Token }}'), id !== 6, `${name}: {{ .Token }} solo donde hay código`);
    assert.ok(!/\b[0-9]{6}\b/.test(html.replace(/#[0-9A-Fa-f]{6}\b/g, '')), `${name}: sin código de ejemplo embebido`);
    assert.ok(!/\{\{[^}]*\}\}/.test(html.replace(/\{\{ \.(Token|SiteURL) \}\}/g, '')), `${name}: solo variables conocidas`);
  }
  // previews de los 8 + manifest
  const g = generate();
  assert.equal(Object.keys(g).filter((k) => k.startsWith('previews/')).length, 8);
  const manifest = JSON.parse(g['manifest.json']);
  assert.deepEqual(manifest.native.map((n) => n.emailId), [1, 2, 4, 6]); assert.deepEqual(manifest.custom.map((n) => n.emailId), [3, 5, 7, 8]);
  assert.ok(/NO depende/.test(manifest.native.find((n) => n.emailId === 4).note));
  assert.ok(!JSON.stringify(manifest).match(/supabase\.co|vercel\.app|sb_(secret|publishable)|eyJ/));
});

test('C5 · sincronización hosted (manifest para Work): payload exacto, #5 nativo apagado (no duplicar), Secure Email Change ON, sin red en dry-run', () => {
  const p = buildAuthConfigPayload();
  assert.equal(p.mailer_subjects_confirmation, COPY[1].subject); assert.equal(p.mailer_subjects_recovery, COPY[2].subject);
  assert.equal(p.mailer_subjects_email_change, COPY[4].subject); assert.equal(p.mailer_subjects_password_changed_notification, COPY[6].subject);
  assert.equal(p.mailer_notifications_password_changed_enabled, true);
  assert.equal(p.mailer_notifications_email_changed_enabled, false, 'el aviso #5 es custom: el nativo queda apagado');
  assert.equal(p.mailer_secure_email_change_enabled, true);
  assert.deepEqual([p.mailer_otp_exp, p.mailer_otp_length], [3600, 6]);
  assert.ok(p.mailer_templates_confirmation_content.includes('{{ .Token }}') && p.mailer_templates_recovery_content.includes('{{ .Token }}'));
  assert.deepEqual(diffAgainst(p, { ...p }), []);
  assert.deepEqual(diffAgainst(p, { ...p, mailer_otp_exp: 60 }), ['mailer_otp_exp']);
  const src = repo('supabase/scripts/sync-auth-email-templates.mjs');
  assert.match(src, /process\.env\.SUPABASE_ACCESS_TOKEN/); assert.match(src, /--env staging|`--env staging`/);
  assert.ok(!/SUPABASE_ACCESS_TOKEN\s*=\s*['"]/.test(src));
});

/* ============================ D. estáticos: seguridad, secretos, regresiones ============================ */

const NEW_FILES = [
  'supabase/migrations/20261001100000_g1_emails_account_challenges.sql',
  'supabase/functions/_shared/account-challenge-core.mjs', 'supabase/functions/_shared/email-templates.mjs', 'supabase/functions/_shared/mailer.ts',
  'supabase/functions/account-challenge/index.ts', 'supabase/functions/delete-my-account/index.ts', 'supabase/functions/_shared/self-delete-core.mjs',
  'supabase/scripts/build-email-templates.mjs', 'supabase/scripts/sync-auth-email-templates.mjs', 'supabase/tests/verify-g1-emails-account-challenges.sql',
  'supabase/email-templates/README.md', 'supabase/email-templates/manifest.json',
];

test('D1 · sin secretos, sin Production/BRAMUlive y sin hosts reales en los archivos nuevos', () => {
  for (const f of NEW_FILES) {
    const txt = repo(f);
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(txt), `JWT literal en ${f}`);
    assert.ok(!/sb_secret_|sbp_[a-z0-9]{20}|SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]{10}/.test(txt), `secreto en ${f}`);
    assert.ok(!/BRAMU_SMTP_PASS\s*[:=]\s*['"]|BRAMU_CHALLENGE_PEPPER\s*[:=]\s*['"][^'"]/.test(txt), `credencial SMTP/pepper literal en ${f}`);
    assert.ok(!/[a-z]{20}\.supabase\.co|\.vercel\.app/.test(txt), `host real en ${f}`);
    assert.ok(!/bramulive/i.test(txt), `referencia a BRAMUlive en ${f}`);
    assert.ok(!/\bproduction\b|producci[oó]n/i.test(txt.replace(/^\s*(--|\/\/|\*).*$/gm, '')), `referencia a Production en CÓDIGO de ${f}`);
  }
  const mailer = repo('supabase/functions/_shared/mailer.ts');
  for (const env of ['BRAMU_SMTP_HOST', 'BRAMU_SMTP_PORT', 'BRAMU_SMTP_USER', 'BRAMU_SMTP_PASS', 'BRAMU_SMTP_FROM', 'BRAMU_SMTP_FROM_NAME', 'BRAMU_PUBLIC_BASE_URL']) assert.ok(mailer.includes(`'${env}'`), env);
  assert.match(mailer, /npm:nodemailer@6\.9\.16'/, 'dependencia pinneada a versión exacta');
  assert.ok(!/console\./.test(mailer), 'el mailer no loguea');
  assert.match(mailer, /replyTo: BRAND\.supportEmail/);
});

test('D2 · Edge Functions: JWT por Auth getUser, identidad nunca del body, OTP/PII fuera de logs; delete-my-account exige la prueba específica y envía #8 solo vía finishReceipt', () => {
  const ac = repo('supabase/functions/account-challenge/index.ts');
  assert.match(ac, /admin\.auth\.getUser\(token\)/); assert.match(ac, /BRAMU_CHALLENGE_PEPPER/); assert.match(ac, /pepper\.length < 32/);
  assert.match(ac, /crypto\.getRandomValues/); assert.ok(!/Math\.random/.test(ac), 'OTP criptográfico');
  assert.match(ac, /email_confirm: true/); assert.match(ac, /admin\.signOut\(token, 'others'\)/);
  assert.ok(!/user_metadata|raw_user_meta/.test(ac + repo('supabase/functions/_shared/account-challenge-core.mjs')), 'user_metadata nunca es autoridad');
  assert.ok(!/body\.(email|to|userId|user_id|playerId)/.test(ac));
  const core = repo('supabase/functions/_shared/account-challenge-core.mjs');
  assert.ok(!/console\./.test(core));
  const logCalls = [...core.matchAll(/log\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(logCalls.length >= 4 && logCalls.every((c) => /^`(send_failed|auth_email_update_failed|changed_notice_failed|deletion_receipt_failed):\$\{/.test(c)), `solo códigos en logs: ${logCalls}`);
  const del = repo('supabase/functions/delete-my-account/index.ts');
  assert.match(del, /account_delete_proof_check/); assert.match(del, /finishDeletionReceipt/); assert.match(del, /runAccountDeletion\(admin, playerId/);
  const sdc = repo('supabase/functions/_shared/self-delete-core.mjs');
  assert.ok(!/isRecentEmailReauth|EMAIL_PROOF_METHODS|amr/.test(sdc.replace(/^\s*\/\/.*$/gm, '')), 'la reautenticación genérica ya no habilita la eliminación');
  // la prueba se exige ANTES de resolver/borrar y el recibo viene DESPUÉS de verifyDeletion
  assert.ok(sdc.indexOf('checkDeleteProof') < sdc.indexOf('resolvePlayer(') && sdc.indexOf('verifyDeletion(') < sdc.indexOf('finishReceipt('));
  // ningún otro lugar manda el #8
  for (const f of ['supabase/functions/account-challenge/index.ts', 'supabase/functions/_shared/account-challenge-core.mjs']) {
    assert.equal((repo(f).match(/emailId: 8/g) || []).length, f.endsWith('core.mjs') ? 1 : 0);
  }
});

test('D3 · migración: sin columna de OTP en claro, hash-only, 60 min, intentos y propósitos cerrados; grants explícitos solo service_role', () => {
  const sql = repo('supabase/migrations/20261001100000_g1_emails_account_challenges.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.match(code, /code_hash\s+text/); assert.ok(!/\b(otp|code|token)\s+(text|varchar|integer)/i.test(code), 'no hay columna con el código en claro');
  assert.match(code, /check \(purpose in \('change_email_current', 'change_email_new', 'delete_account'\)\)/);
  assert.match(code, /interval '60 minutes'/); assert.match(code, /interval '60 seconds'/); assert.match(code, /max_attempts\s+smallint not null default 5/);
  assert.match(code, /enable row level security/); assert.match(code, /revoke all on table public\.account_challenges from public, anon, authenticated/);
  assert.ok(!/create policy/i.test(code));
  const defs = [...code.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
  assert.equal(defs.length, 10);
  for (const f of defs) {
    assert.match(code, new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated;`), `revoke ${f}`);
    assert.match(code, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role;`), `grant ${f}`);
  }
  assert.equal((code.match(/security definer/g) || []).length, 10);
  assert.equal((code.match(/set search_path = public/g) || []).length, 10);
  assert.ok(!/\bto (anon|authenticated|public)\b/.test(code.replace(/revoke[^;]*;/g, '')), 'ningún GRANT a clientes');
});

test('D4 · regresiones: signup y recuperación NATIVOS siguen intactos en el cliente; password changed cierra otras sesiones; eliminación sigue purgando local', () => {
  const auth = repo('bramulab/auth.js'); const app = repo('bramulab/app.js');
  assert.match(auth, /c\.auth\.verifyOtp\(\{ email, token, type: 'signup' \}\)/); assert.match(auth, /c\.auth\.resend\(\{ type: 'signup', email \}\)/);
  assert.match(auth, /c\.auth\.resetPasswordForEmail\(email\)/); assert.match(auth, /c\.auth\.verifyOtp\(\{ email, token, type: 'recovery' \}\)/);
  assert.match(app, /Auth\.verifyRecoveryOtp\(forgotPasswordEmail, code\)/);
  assert.match(app, /Auth\.sendRecoveryOtp/);
  assert.match(app, /const result = await Auth\.updatePassword\(next\);[\s\S]{0,400}Auth\.signOutOthers\(\)/);
  assert.match(app, /function finishAccountDeletion\(ownerId\)[\s\S]{0,300}Store\.purgeOwnerLocalData\(ownerId\)/);
  // recovery solo para recuperar contraseña: cambio de email y eliminación ya no lo usan
  const flow = app.slice(app.indexOf('function accountFlowPurpose()'), app.indexOf('function initAccountFlow()'));
  assert.ok(!/RecoveryOtp|requestEmailChange|verifyEmailChange|updateUser/.test(flow));
  assert.match(flow, /requestAccountChallenge\(purpose/); assert.match(flow, /verifyAccountChallenge\(accountFlowPurpose\(\)/);
  // el hosted Secure Email Change queda como defensa documentada
  assert.match(repo('supabase/scripts/sync-auth-email-templates.mjs'), /mailer_secure_email_change_enabled = true/);
});
