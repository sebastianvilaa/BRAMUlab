// BRAMUlab — V04.20 (L3): pruebas del núcleo de eliminación AUTOSERVICIO.
// node --test supabase/functions/_shared/self-delete-core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSelfDeletion, validateSelfDeleteBody, isRecentEmailReauth, decodeJwtPayload, REAUTH_MAX_AGE_SECONDS } from './self-delete-core.mjs';
import { runAccountDeletion, verifyAccountDeleted } from './account-deletion-core.mjs';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const nowSec = Math.floor(NOW / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwtWith = (payload) => `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
const otpJwt = (ageSec = 30, method = 'otp') => jwtWith({ sub: 'u1', amr: [{ method, timestamp: nowSec - ageSec }] });
const pwdJwt = () => jwtWith({ sub: 'u1', amr: [{ method: 'password', timestamp: nowSec - 5 }] });

function deps(over = {}) {
  const calls = { run: [], verify: [], resolve: [] };
  const base = {
    jwt: otpJwt(), body: { confirm: true }, now: () => NOW,
    getUser: async () => ({ id: 'auth-user-1' }),
    resolvePlayer: async (id) => { calls.resolve.push(id); return { ok: true, playerId: 'player-1' }; },
    runDeletion: async (pid) => { calls.run.push(pid); return { ok: true, authUserId: 'auth-user-1' }; },
    verifyDeletion: async (pid, aid) => { calls.verify.push([pid, aid]); return { ok: true, anonymized: true, authUnlinked: true, inactiveInBramu: true, storageClean: true, groupStorageClean: true, authDeleted: true, auditPurged: true }; },
  };
  return { d: { ...base, ...over }, calls };
}

test('validateSelfDeleteBody: solo {confirm:true}; player_id/email/userId u otra clave => invalid_payload', () => {
  assert.equal(validateSelfDeleteBody({ confirm: true }).ok, true);
  assert.equal(validateSelfDeleteBody({}).code, 'confirmation_required');
  assert.equal(validateSelfDeleteBody({ confirm: false }).code, 'confirmation_required');
  for (const k of ['player_id', 'playerId', 'email', 'userId', 'auth_user_id', 'x']) assert.equal(validateSelfDeleteBody({ confirm: true, [k]: 'z' }).code, 'invalid_payload', k);
  for (const b of [null, undefined, 'x', 1, []]) assert.equal(validateSelfDeleteBody(b).code, 'invalid_payload');
});

test('reautenticación reciente: OTP/recovery dentro de 10 min sí; password, vieja, futura o ausente no', () => {
  assert.equal(isRecentEmailReauth(decodeJwtPayload(otpJwt(30)), NOW), true);
  assert.equal(isRecentEmailReauth(decodeJwtPayload(otpJwt(30, 'recovery')), NOW), true);
  assert.equal(isRecentEmailReauth(decodeJwtPayload(otpJwt(REAUTH_MAX_AGE_SECONDS)), NOW), true);
  assert.equal(isRecentEmailReauth(decodeJwtPayload(otpJwt(REAUTH_MAX_AGE_SECONDS + 1)), NOW), false);
  assert.equal(isRecentEmailReauth(decodeJwtPayload(otpJwt(-3600)), NOW), false, 'timestamp en el futuro');
  assert.equal(isRecentEmailReauth(decodeJwtPayload(pwdJwt()), NOW), false);
  assert.equal(isRecentEmailReauth(decodeJwtPayload(jwtWith({ sub: 'u' })), NOW), false);
  assert.equal(isRecentEmailReauth(decodeJwtPayload('basura'), NOW), false);
  assert.equal(isRecentEmailReauth({ amr: [{ method: 'otp', timestamp: 'x' }] }, NOW), false);
});

test('camino feliz: resuelve el player SERVER-SIDE desde el JWT, corre el motor UNA vez y responde solo booleanos', async () => {
  const { d, calls } = deps();
  const r = await handleSelfDeletion(d);
  assert.equal(r.status, 200);
  assert.deepEqual(calls.resolve, ['auth-user-1']);
  assert.deepEqual(calls.run, ['player-1']);
  assert.deepEqual(calls.verify, [['player-1', 'auth-user-1']]);
  assert.equal(r.body.ok, true);
  const flat = JSON.stringify(r.body);
  assert.ok(!flat.includes('player-1') && !flat.includes('auth-user-1'), 'la respuesta no contiene ids');
  assert.ok(Object.values(r.body.postconditions).every((v) => v === true));
});

test('el body NUNCA elige la identidad: player_id en el body => 400 y nada se ejecuta', async () => {
  const { d, calls } = deps({ body: { confirm: true, player_id: 'victima' } });
  const r = await handleSelfDeletion(d);
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'invalid_payload');
  assert.deepEqual([calls.resolve.length, calls.run.length], [0, 0]);
});

test('sin JWT / JWT inválido => 401 y nada se ejecuta', async () => {
  for (const over of [{ jwt: '' }, { getUser: async () => null }]) {
    const { d, calls } = deps(over);
    const r = await handleSelfDeletion(d);
    assert.equal(r.status, 401);
    assert.equal(calls.run.length, 0);
  }
});

test('sin reautenticación reciente (login por contraseña o sesión vieja) => 403 y NO resuelve ni borra', async () => {
  for (const jwt of [pwdJwt(), otpJwt(REAUTH_MAX_AGE_SECONDS + 60)]) {
    const { d, calls } = deps({ jwt });
    const r = await handleSelfDeletion(d);
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'recent_reauth_required');
    assert.deepEqual([calls.resolve.length, calls.run.length], [0, 0]);
  }
});

test('cuenta no resoluble => 404 sin ejecutar el motor', async () => {
  const { d, calls } = deps({ resolvePlayer: async () => ({ ok: false, code: 'player_not_found' }) });
  const r = await handleSelfDeletion(d);
  assert.equal(r.status, 404);
  assert.equal(calls.run.length, 0);
});

test('fallo parcial del motor => 500 retryable con la fase, sin ids; el reintento vuelve a correr el mismo motor', async () => {
  let attempt = 0;
  const { d, calls } = deps({ runDeletion: async (pid) => { attempt += 1; return attempt === 1 ? { ok: false, step: 'auth_delete', authUserId: 'auth-user-1' } : { ok: true, authUserId: 'auth-user-1' }; } });
  const r1 = await handleSelfDeletion(d);
  assert.equal(r1.status, 500);
  assert.deepEqual({ code: r1.body.code, step: r1.body.step, retryable: r1.body.retryable }, { code: 'deletion_incomplete', step: 'auth_delete', retryable: true });
  assert.ok(!JSON.stringify(r1.body).includes('auth-user-1'));
  const r2 = await handleSelfDeletion(d);
  assert.equal(r2.status, 200);
  assert.equal(attempt, 2);
  assert.equal(calls.verify.length, 1, 'solo verifica tras un éxito del motor');
});

test('postcondición incumplida => 500 retryable (nunca se declara éxito sin verificar)', async () => {
  const { d } = deps({ verifyDeletion: async () => ({ ok: false, authDeleted: false, storageClean: true }) });
  const r = await handleSelfDeletion(d);
  assert.equal(r.status, 500);
  assert.equal(r.body.code, 'postcondition_failed');
  assert.equal(r.body.postconditions.authDeleted, false);
});

/* ---- integración con el motor P0.3 REAL (cliente fabricado): mismo motor, sin segundo motor ---- */
function fakeAdmin() {
  const log = [];
  const client = {
    rpc: async (name, args) => { log.push(['rpc', name]); if (name === 'admin_delete_player_account') return { data: { ok: true, alreadyDeleted: false, authUserId: 'auth-1' }, error: null }; if (name === 'admin_finalize_player_account_deletion') return { data: { ok: true }, error: null }; return { data: null, error: { message: 'x' } }; },
    storage: { from: (b) => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ error: null }) }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ data: [], error: null }) }) }) }),
    auth: { admin: { updateUserById: async () => ({ error: null }), deleteUser: async () => ({ error: null }), getUserById: async () => ({ data: { user: null }, error: { status: 404, message: 'User not found' } }) } },
  };
  return { client, log };
}

test('el motor compartido (account-deletion-core) es el de P0.3: fases SQL→Storage→Auth→verificación→finalize', async () => {
  const { client, log } = fakeAdmin();
  const r = await runAccountDeletion(client, 'p1', {});
  assert.equal(r.ok, true);
  assert.equal(r.authPhase, 'completed');
  assert.deepEqual(log.map((l) => l[1]).filter((n) => n.startsWith('admin_')), ['admin_delete_player_account', 'admin_finalize_player_account_deletion']);
  assert.equal(typeof verifyAccountDeleted, 'function');
});
