// BRAMUlab — V04.19 (L1): pruebas del núcleo de cleanup de altas abandonadas.
// Ejecutar con: node --test supabase/functions/_shared/abandoned-signups-core.test.mjs
// Usa un "servidor" en memoria (auth.users + profiles) que implementa el MISMO contrato que las RPC SQL
// (list_abandoned_signups / release_abandoned_signup_username) y la Auth Admin API, para ejercitar la lógica real.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAbandonedSignups, MIN_AGE_MS } from './abandoned-signups-core.mjs';

const HOUR = 3600 * 1000;
const NOW = Date.parse('2026-10-01T12:00:00Z');

function makeServer(users, { failDeleteFor = new Set(), onBeforeDelete } = {}) {
  const auth = new Map(users.map((u) => [u.id, { ...u }]));
  const usernames = new Map(); // userId -> username (profiles.username atado)
  for (const u of users) if (u.username) usernames.set(u.id, u.username);
  const calls = { deleteCalls: 0 };
  const abandoned = (u) => !u.email_confirmed_at && !u.phone_confirmed_at && !u.last_sign_in_at && NOW - Date.parse(u.created_at) >= MIN_AGE_MS;
  const deps = {
    now: () => NOW,
    listCandidates: async (limit) => [...auth.values()].filter(abandoned).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, limit).map((u) => ({ user_id: u.id })),
    releaseUsername: async (id) => {
      const u = auth.get(id);
      if (!u) return { eligible: false, usernameReleased: false };
      if (!abandoned(u)) return { eligible: false, usernameReleased: false };
      const had = usernames.delete(id);
      return { eligible: true, usernameReleased: had };
    },
    getAuthUser: async (id) => auth.get(id) || null,
    deleteAuthUser: async (id) => {
      calls.deleteCalls += 1;
      if (onBeforeDelete) onBeforeDelete(id, auth);
      if (failDeleteFor.has(id)) return { ok: false };
      if (!auth.has(id)) return { ok: false, notFound: true };
      auth.delete(id);
      return { ok: true };
    },
  };
  return { auth, usernames, calls, deps };
}

const u = (id, hoursAgo, extra = {}) => ({ id, created_at: new Date(NOW - hoursAgo * HOUR).toISOString(), email_confirmed_at: null, phone_confirmed_at: null, last_sign_in_at: null, ...extra });

test('borra solo altas NO confirmadas con >= 24 h; nunca toca confirmadas ni jóvenes', async () => {
  const s = makeServer([
    u('old-unconf', 30),
    u('exactly-24h', 24),
    u('young', 23),
    u('old-confirmed', 500, { email_confirmed_at: new Date(NOW - 400 * HOUR).toISOString() }),
    u('old-signed-in', 500, { last_sign_in_at: new Date(NOW - 10 * HOUR).toISOString() }),
  ]);
  const r = await cleanupAbandonedSignups(s.deps);
  assert.equal(r.deleted, 2);
  assert.ok(!s.auth.has('old-unconf') && !s.auth.has('exactly-24h'));
  assert.ok(s.auth.has('young') && s.auth.has('old-confirmed') && s.auth.has('old-signed-in'));
  assert.equal(r.errors, 0);
});

test('libera el @usuario atado a un alta abandonada y NO el de una cuenta constituida', async () => {
  const s = makeServer([
    u('abandoned-with-name', 40, { username: 'reservado_1' }),
    u('constituted', 400, { email_confirmed_at: new Date(NOW - 399 * HOUR).toISOString(), username: 'vivo_1' }),
  ]);
  const r = await cleanupAbandonedSignups(s.deps);
  assert.equal(r.usernamesReleased, 1);
  assert.ok(!s.usernames.has('abandoned-with-name'), '@usuario liberado');
  assert.equal(s.usernames.get('constituted'), 'vivo_1', 'la cuenta constituida conserva su @usuario');
});

test('idempotente: una segunda pasada no borra nada más ni falla', async () => {
  const s = makeServer([u('a', 30), u('b', 50)]);
  const r1 = await cleanupAbandonedSignups(s.deps);
  const r2 = await cleanupAbandonedSignups(s.deps);
  assert.equal(r1.deleted, 2);
  assert.deepEqual({ c: r2.candidates, d: r2.deleted, e: r2.errors }, { c: 0, d: 0, e: 0 });
});

test('retry tras fallo de borrado: el @usuario ya quedó liberado y el reintento completa el borrado', async () => {
  const fail = new Set(['a']);
  const s = makeServer([u('a', 30, { username: 'x_1' })], { failDeleteFor: fail });
  const r1 = await cleanupAbandonedSignups(s.deps);
  assert.equal(r1.errors, 1);
  assert.equal(r1.deleted, 0);
  assert.ok(s.auth.has('a'));
  assert.ok(!s.usernames.has('a'), 'el @usuario se libera antes del borrado Auth');
  fail.clear();
  const r2 = await cleanupAbandonedSignups(s.deps);
  assert.equal(r2.deleted, 1);
  assert.ok(!s.auth.has('a'));
});

test('concurrencia: el usuario confirma justo antes del borrado => se omite y NO se borra', async () => {
  let confirmed = false;
  const s = makeServer([u('racer', 30)], {
    onBeforeDelete: () => { throw new Error('no debería llegar a borrar'); },
  });
  // Simula la confirmación concurrente entre el listado y la 2ª revalidación.
  const realGet = s.deps.getAuthUser;
  let getCount = 0;
  s.deps.getAuthUser = async (id) => {
    getCount += 1;
    if (getCount === 2 && !confirmed) { confirmed = true; s.auth.get(id).email_confirmed_at = new Date(NOW).toISOString(); }
    return realGet(id);
  };
  const r = await cleanupAbandonedSignups(s.deps);
  assert.equal(r.deleted, 0);
  assert.equal(r.skipped, 1);
  assert.equal(s.calls.deleteCalls, 0);
  assert.ok(s.auth.has('racer'));
});

test('dos ejecuciones concurrentes: el segundo borrado "not found" cuenta como alreadyGone, no como error', async () => {
  const s = makeServer([u('dup', 30)]);
  const [r1, r2] = await Promise.all([cleanupAbandonedSignups(s.deps), cleanupAbandonedSignups(s.deps)]);
  assert.equal(r1.deleted + r2.deleted, 1);
  assert.equal(r1.errors + r2.errors, 0);
  assert.ok(!s.auth.has('dup'));
});

test('un error en un usuario no detiene al resto', async () => {
  const s = makeServer([u('bad', 50), u('good', 30)], { failDeleteFor: new Set(['bad']) });
  const r = await cleanupAbandonedSignups(s.deps);
  assert.equal(r.deleted, 1);
  assert.equal(r.errors, 1);
  assert.ok(!s.auth.has('good'));
});

test('minAge nunca baja de 24 h aunque el llamador lo pida', async () => {
  const s = makeServer([u('young', 2)]);
  const r = await cleanupAbandonedSignups(s.deps, { minAgeMs: 1000 });
  assert.equal(r.deleted, 0);
  assert.ok(s.auth.has('young'));
});

test('paginación por lotes sin repetir ids ni loops infinitos aun con fallos persistentes', async () => {
  const many = Array.from({ length: 7 }, (_, i) => u(`u${i}`, 30 + i));
  const fail = new Set(['u0', 'u1']);
  const s = makeServer(many, { failDeleteFor: fail });
  const r = await cleanupAbandonedSignups(s.deps, { limit: 3, maxBatches: 10 });
  assert.equal(r.deleted, 5);
  assert.equal(r.errors, 2);
});

test('el resumen no contiene emails ni ids de usuario', async () => {
  const s = makeServer([{ ...u('secret-id-123', 30), email: 'persona@example.com' }]);
  const r = await cleanupAbandonedSignups(s.deps);
  const flat = JSON.stringify(r);
  assert.ok(!flat.includes('persona@example.com') && !flat.includes('secret-id-123'));
  assert.deepEqual(Object.keys(r).sort(), ['alreadyGone', 'candidates', 'deleted', 'errors', 'skipped', 'usernamesReleased']);
});
