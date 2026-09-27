// BRAMUlab — P0.3, tests dirigidos del orquestador administrativo (handoff 28 §7.8/§7.9).
// Ejecutar con: node --test supabase/scripts/admin-delete-player-account.test.mjs
//
// runAccountDeletion/verifyAccountDeleted nunca importan @supabase/supabase-js ni leen
// variables de entorno (eso vive solo en el bootstrap CLI, guardado detrás de un
// `if (import.meta.url === ...)` que nunca se ejecuta al importar el módulo) — este archivo
// corre sin el paquete instalado y sin credenciales reales, con un cliente Supabase FABRICADO
// que simula fielmente el contrato de `supabase.rpc`/`supabase.storage.from(...)`/
// `supabase.auth.admin.*` (mismo criterio que match-validation.test.mjs de la ronda de fix P0
// de precisión).

import test from 'node:test';
import assert from 'node:assert/strict';
import { runAccountDeletion, verifyAccountDeleted } from './admin-delete-player-account.mjs';

/** Cliente Supabase fabricado. `state` es mutable entre llamadas dentro de un mismo test para
 *  simular el efecto real de cada paso (ej. remove() vacía la lista que list() devuelve
 *  después). `calls` registra qué se invocó, para asserts sobre "nunca se llamó a X". */
function fakeSupabaseAdmin(state) {
  const calls = { rpc: [], storageList: [], storageRemove: [], authUpdate: [], authDelete: [] };

  const admin = {
    calls,
    rpc: async (name, args) => {
      calls.rpc.push({ name, args });
      if (name !== 'admin_delete_player_account') return { data: null, error: { message: 'unexpected_rpc' } };
      return state.rpcResponse(args.p_player_id);
    },
    storage: {
      from: (bucket) => ({
        list: async (prefix) => {
          calls.storageList.push(prefix);
          return state.storageList(prefix);
        },
        remove: async (paths) => {
          calls.storageRemove.push(paths);
          return state.storageRemove(paths);
        },
      }),
    },
    auth: {
      admin: {
        updateUserById: async (userId, attrs) => {
          calls.authUpdate.push({ userId, attrs });
          return state.authUpdate(userId, attrs);
        },
        deleteUser: async (userId) => {
          calls.authDelete.push(userId);
          return state.authDelete(userId);
        },
      },
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => state.playerRow(table),
        }),
      }),
    }),
  };
  return admin;
}

test('runAccountDeletion: cuenta CON avatar — Fase 2 lista y borra los objetos reales', async () => {
  const state = {
    rpcResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: false, authUserId: 'auth-1' }, error: null }),
    storageList: () => ({ data: [{ name: '1700000000000.jpg' }], error: null }),
    storageRemove: () => ({ data: {}, error: null }),
    authUpdate: () => ({ data: {}, error: null }),
    authDelete: () => ({ data: {}, error: null }),
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p1');

  assert.equal(result.ok, true);
  assert.equal(result.avatarFilesRemoved, 1);
  assert.equal(result.authPhase, 'completed');
  assert.deepEqual(c.calls.storageRemove[0], ['p1/1700000000000.jpg']);
});

test('runAccountDeletion: cuenta SIN avatar — Fase 2 no llama a remove() en absoluto', async () => {
  const state = {
    rpcResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: false, authUserId: 'auth-2' }, error: null }),
    storageList: () => ({ data: [], error: null }),
    storageRemove: () => { throw new Error('remove() nunca debería llamarse si list() ya vino vacía'); },
    authUpdate: () => ({ data: {}, error: null }),
    authDelete: () => ({ data: {}, error: null }),
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p2');

  assert.equal(result.ok, true);
  assert.equal(result.avatarFilesRemoved, 0);
  assert.equal(c.calls.storageRemove.length, 0);
});

test('runAccountDeletion: Storage YA vacío (reintento) — no-op seguro, nunca falla', async () => {
  const state = {
    rpcResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: true, authUserId: 'auth-3' }, error: null }),
    storageList: () => ({ data: [], error: null }),
    storageRemove: () => { throw new Error('no debería llamarse'); },
    authUpdate: () => ({ error: { message: 'User not found' } }), // ya baneado/eliminado antes
    authDelete: () => ({ error: { message: 'User not found' } }),
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p3');

  assert.equal(result.ok, true, `esperaba éxito incluso con Storage/Auth ya limpios: ${JSON.stringify(result)}`);
  assert.equal(result.alreadyDeleted, true);
  assert.equal(result.authPhase, 'completed');
});

test('runAccountDeletion: reintento tras fallo parcial — SQL ya ejecutado, authUserId se recupera del resultado idempotente y las Fases 2/3 igual se completan', async () => {
  // Simula: una primera corrida completó la Fase 1 (SQL) pero se cortó antes de Storage/Auth. El
  // reintento llama de nuevo al script completo; la RPC responde alreadyDeleted:true pero SIGUE
  // devolviendo authUserId (recuperado de pilot_events por la propia función SQL, ver esa
  // migración) — sin eso, este reintento no podría completar las Fases 2/3 en absoluto.
  const state = {
    rpcResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: true, authUserId: 'auth-recovered' }, error: null }),
    storageList: () => ({ data: [{ name: 'old.jpg' }], error: null }),
    storageRemove: () => ({ data: {}, error: null }),
    authUpdate: () => ({ data: {}, error: null }),
    authDelete: () => ({ data: {}, error: null }),
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p4');

  assert.equal(result.ok, true);
  assert.equal(result.authUserId, 'auth-recovered');
  assert.equal(result.authPhase, 'completed');
  assert.equal(c.calls.authDelete[0], 'auth-recovered');
});

test('runAccountDeletion: Auth ya eliminado en un intento anterior — banear/borrar de nuevo se trata como éxito, nunca como fallo', async () => {
  const state = {
    rpcResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: true, authUserId: 'auth-gone' }, error: null }),
    storageList: () => ({ data: [], error: null }),
    storageRemove: () => { throw new Error('no debería llamarse'); },
    authUpdate: () => ({ error: { message: 'User not found', status: 404 } }),
    authDelete: () => ({ error: { message: 'User not found', status: 404 } }),
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p5');

  assert.equal(result.ok, true, `un usuario Auth ya inexistente debe tratarse como objetivo cumplido: ${JSON.stringify(result)}`);
});

test('runAccountDeletion: un error REAL (no "already gone") de la Auth Admin API sí hace fallar el paso, nunca se traga en silencio', async () => {
  const state = {
    rpcResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: false, authUserId: 'auth-6' }, error: null }),
    storageList: () => ({ data: [], error: null }),
    storageRemove: () => { throw new Error('no debería llamarse'); },
    authUpdate: () => ({ error: { message: 'rate limit exceeded' } }),
    authDelete: () => { throw new Error('no debería llegar a Fase 3 si la Fase de baneo falló con un error real'); },
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p6');

  assert.equal(result.ok, false);
  assert.equal(result.step, 'auth_ban');
});

test('runAccountDeletion: sin authUserId (nunca tuvo sesión vinculada) — Fase 3 se omite explícitamente, nunca falla el proceso', async () => {
  const state = {
    rpcResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: false, authUserId: null }, error: null }),
    storageList: () => ({ data: [], error: null }),
    storageRemove: () => { throw new Error('no debería llamarse'); },
    authUpdate: () => { throw new Error('no debería llamarse sin authUserId'); },
    authDelete: () => { throw new Error('no debería llamarse sin authUserId'); },
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p7');

  assert.equal(result.ok, true);
  assert.equal(result.authPhase, 'skipped_no_auth_user_id');
  assert.equal(c.calls.authUpdate.length, 0);
  assert.equal(c.calls.authDelete.length, 0);
});

test('runAccountDeletion: la RPC devuelve un código de negocio (player_not_found) — se propaga sin intentar Storage/Auth', async () => {
  const state = {
    rpcResponse: () => ({ data: { ok: false, code: 'player_not_found' }, error: null }),
    storageList: () => { throw new Error('no debería llamarse'); },
    storageRemove: () => { throw new Error('no debería llamarse'); },
    authUpdate: () => { throw new Error('no debería llamarse'); },
    authDelete: () => { throw new Error('no debería llamarse'); },
  };
  const c = fakeSupabaseAdmin(state);
  const result = await runAccountDeletion(c, 'p8');

  assert.equal(result.ok, false);
  assert.equal(result.step, 'sql_phase1');
  assert.equal(result.code, 'player_not_found');
});

test('runAccountDeletion: playerId ausente/inválido nunca llega a llamar a la RPC', async () => {
  const c = fakeSupabaseAdmin({
    rpcResponse: () => { throw new Error('no debería llamarse'); },
    storageList: () => { throw new Error('no debería llamarse'); },
    storageRemove: () => { throw new Error('no debería llamarse'); },
    authUpdate: () => { throw new Error('no debería llamarse'); },
    authDelete: () => { throw new Error('no debería llamarse'); },
  });
  const result = await runAccountDeletion(c, '');
  assert.equal(result.ok, false);
  assert.equal(result.step, 'validate_input');
});

test('verifyAccountDeleted: post-condición completa (anonimizado + desvinculado + inactivo + Storage limpio)', async () => {
  const c = fakeSupabaseAdmin({
    playerRow: () => ({ data: { deleted_at: '2026-09-27T00:00:00Z', auth_user_id: null, is_active: false }, error: null }),
    storageList: () => ({ data: [], error: null }),
  });
  const result = await verifyAccountDeleted(c, 'p9');
  assert.deepEqual(result, {
    ok: true, anonymized: true, authUnlinked: true, inactiveInBramu: true, storageClean: true,
  });
});

test('verifyAccountDeleted: detecta Storage sucio como una post-condición real, no la esconde', async () => {
  const c = fakeSupabaseAdmin({
    playerRow: () => ({ data: { deleted_at: '2026-09-27T00:00:00Z', auth_user_id: null, is_active: false }, error: null }),
    storageList: () => ({ data: [{ name: 'leftover.jpg' }], error: null }),
  });
  const result = await verifyAccountDeleted(c, 'p10');
  assert.equal(result.storageClean, false);
});
