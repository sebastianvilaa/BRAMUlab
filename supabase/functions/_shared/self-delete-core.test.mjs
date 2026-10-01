// BRAMUlab — V04.20 (L3): pruebas del núcleo de eliminación AUTOSERVICIO.
// node --test supabase/functions/_shared/self-delete-core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSelfDeletion, validateSelfDeleteBody, DELETE_PROOF_MAX_AGE_SECONDS } from './self-delete-core.mjs';
import { runAccountDeletion, verifyAccountDeleted } from './account-deletion-core.mjs';

const NOW = Date.parse('2026-10-01T12:00:00Z');

function deps(over = {}) {
  const calls = { run: [], verify: [], resolve: [], proof: [], receipt: [] };
  const base = {
    jwt: 'jwt-opaco', body: { confirm: true }, now: () => NOW,
    getUser: async () => ({ id: 'auth-user-1', email: 'Jugador@Example.test' }),
    checkDeleteProof: async (id) => { calls.proof.push(id); return { ok: true, challengeId: 'ch-1' }; },
    finishReceipt: async (m) => { calls.receipt.push(m); return 'sent'; },
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
  assert.equal(r.body.receipt, 'sent');
  assert.ok(!flat.includes('example.test'), 'la respuesta no contiene el email');
});

test('Email #8: se captura el email ANTES de borrar, se envía SOLO tras postcondiciones OK y después de la eliminación', async () => {
  const order = [];
  const { d, calls } = deps({
    runDeletion: async () => { order.push('delete'); return { ok: true, authUserId: 'auth-user-1' }; },
    verifyDeletion: async () => { order.push('verify'); return { ok: true, authDeleted: true }; },
    finishReceipt: async (m) => { order.push('receipt'); calls.receipt.push(m); return 'sent'; },
  });
  const r = await handleSelfDeletion(d);
  assert.equal(r.status, 200);
  assert.deepEqual(order, ['delete', 'verify', 'receipt']);
  assert.deepEqual(calls.receipt, [{ authUserId: 'auth-user-1', challengeId: 'ch-1', email: 'jugador@example.test' }]);
});

test('Email #8: NO se envía si el motor falla, si fallan las postcondiciones, ni si falta la prueba/identidad', async () => {
  for (const over of [
    { runDeletion: async () => ({ ok: false, step: 'auth_delete' }) },
    { verifyDeletion: async () => ({ ok: false, authDeleted: false }) },
    { checkDeleteProof: async () => ({ ok: false }) },
    { resolvePlayer: async () => ({ ok: false }) },
    { body: { confirm: true, email: 'x@y.test' } },
    { getUser: async () => null },
  ]) {
    const { d, calls } = deps(over);
    const r = await handleSelfDeletion(d);
    assert.notEqual(r.status, 200);
    assert.equal(calls.receipt.length, 0);
  }
});

test('Email #8: un fallo (o excepción) del envío NUNCA revierte ni falla la eliminación', async () => {
  for (const finishReceipt of [async () => 'failed', async () => { throw new Error('smtp'); }]) {
    const { d } = deps({ finishReceipt });
    const r = await handleSelfDeletion(d);
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.receipt, 'failed');
  }
  const { d: d2 } = deps({ finishReceipt: undefined });
  assert.equal((await handleSelfDeletion(d2)).body.receipt, 'skipped');
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

test('sin prueba delete_account (login por contraseña, recovery/otp genérico, vencida) => 403 delete_challenge_required y NO resuelve ni borra', async () => {
  const { d, calls } = deps({ checkDeleteProof: async (id) => { calls0.push(id); return { ok: false, code: 'delete_challenge_required' }; } });
  const calls0 = [];
  const r = await handleSelfDeletion(d);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'delete_challenge_required');
  assert.deepEqual([calls.resolve.length, calls.run.length], [0, 0]);
  assert.deepEqual(calls0, ['auth-user-1'], 'la prueba se busca por la identidad del JWT, nunca del body');
  assert.equal(DELETE_PROOF_MAX_AGE_SECONDS, 600);
});

test('una reautenticación genérica en el JWT (amr otp/recovery reciente) YA NO alcanza sin la prueba específica', async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', amr: [{ method: 'recovery', timestamp: Math.floor(NOW / 1000) - 5 }] })}.sig`;
  const { d, calls } = deps({ jwt, checkDeleteProof: async () => ({ ok: false }) });
  const r = await handleSelfDeletion(d);
  assert.equal(r.status, 403);
  assert.equal(calls.run.length, 0);
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
