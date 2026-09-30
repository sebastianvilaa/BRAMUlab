// BRAMUlab — P0.3, tests dirigidos del orquestador administrativo (handoff 28 §7, 30 §3 —
// hardening final). Ejecutar con: node --test supabase/scripts/admin-delete-player-account.test.mjs
//
// runAccountDeletion/verifyAccountDeleted nunca importan @supabase/supabase-js ni leen
// variables de entorno (eso vive solo en el bootstrap CLI, guardado detrás de un
// `if (import.meta.url === ...)` que nunca se ejecuta al importar el módulo) — este archivo
// corre sin el paquete instalado y sin credenciales reales, con un cliente Supabase FABRICADO
// que simula fielmente el contrato de `supabase.rpc`/`supabase.storage.from(...)`/
// `supabase.auth.admin.*`/`supabase.from(...).select()...` (mismo criterio que
// match-validation.test.mjs de la ronda de fix P0 de precisión).

import test from 'node:test';
import assert from 'node:assert/strict';
import { runAccountDeletion, verifyAccountDeleted } from './admin-delete-player-account.mjs';

/** Query builder fabricado — soporta la cadena `.select().eq().eq().order().limit()` (o
 *  `.maybeSingle()` al final) que usa `verifyAccountDeleted`, resolviendo con `state.tableQuery`.
 *  Es "thenable" (implementa `.then`) para simular que un query builder de supabase-js es
 *  awaitable directamente sin necesitar `.maybeSingle()` al final (caso de `pilot_events`, que
 *  se usa como array). */
function makeQueryBuilder(resolver) {
  const builder = {
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => resolver(),
    then: (resolve, reject) => Promise.resolve(resolver()).then(resolve, reject),
  };
  return builder;
}

/** Cliente Supabase fabricado. `state` es mutable entre llamadas dentro de un mismo test para
 *  simular el efecto real de cada paso. `calls` registra qué se invocó, para asserts sobre
 *  "nunca se llamó a X" o sobre el orden real de las fases. */
function fakeSupabaseAdmin(state) {
  const calls = {
    rpc: [], storageList: [], storageRemove: [], groupStorageList: [], groupStorageRemove: [], authUpdate: [], authDelete: [], authGetUserById: [],
  };

  const admin = {
    calls,
    rpc: async (name, args) => {
      calls.rpc.push({ name, args });
      if (name === 'admin_delete_player_account') return state.rpcDeleteResponse(args.p_player_id);
      if (name === 'admin_finalize_player_account_deletion') return state.rpcFinalizeResponse(args.p_player_id);
      return { data: null, error: { message: `unexpected_rpc:${name}` } };
    },
    storage: {
      // B2c: el fake distingue el bucket — `group-photos` va a sus propios contadores/estado, así
      // los tests de avatar existentes no cambian.
      from: (bucket) => (bucket === 'group-photos' ? {
        list: async (prefix) => { calls.groupStorageList.push(prefix); return state.groupStorageList(prefix); },
        remove: async (paths) => { calls.groupStorageRemove.push(paths); return state.groupStorageRemove(paths); },
      } : {
        list: async (prefix) => { calls.storageList.push(prefix); return state.storageList(prefix); },
        remove: async (paths) => { calls.storageRemove.push(paths); return state.storageRemove(paths); },
      }),
    },
    auth: {
      admin: {
        updateUserById: async (userId, attrs) => { calls.authUpdate.push({ userId, attrs }); return state.authUpdate(userId, attrs); },
        deleteUser: async (userId) => { calls.authDelete.push(userId); return state.authDelete(userId); },
        getUserById: async (userId) => { calls.authGetUserById.push(userId); return state.authGetUserById(userId); },
      },
    },
    from: (table) => ({
      select: () => makeQueryBuilder(() => state.tableQuery(table)),
    }),
  };
  return admin;
}

/** Estado por defecto: flujo completo exitoso, cuenta con avatar, Auth confirmado eliminado,
 *  finalización exitosa. Cada test parte de esto y sobrescribe solo lo que necesita distinto. */
function baseState(overrides) {
  return Object.assign({
    rpcDeleteResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: false, authUserId: 'auth-1' }, error: null }),
    rpcFinalizeResponse: (playerId) => ({ data: { ok: true, playerId }, error: null }),
    storageList: () => ({ data: [{ name: '1700000000000.jpg' }], error: null }),
    storageRemove: () => ({ data: {}, error: null }),
    groupStorageList: () => ({ data: [], error: null }),
    groupStorageRemove: () => ({ data: {}, error: null }),
    authUpdate: () => ({ data: {}, error: null }),
    authDelete: () => ({ data: {}, error: null }),
    authGetUserById: () => ({ data: null, error: { message: 'User not found', status: 404 } }),
    tableQuery: () => ({ data: [], error: null }),
  }, overrides || {});
}

test('runAccountDeletion: flujo completo exitoso — las 5 fases corren en orden, Auth confirmado y auditoría finalizada', async () => {
  const c = fakeSupabaseAdmin(baseState());
  const result = await runAccountDeletion(c, 'p1');

  assert.equal(result.ok, true);
  assert.equal(result.avatarFilesRemoved, 1);
  assert.equal(result.authPhase, 'completed');
  assert.equal(result.auditFinalized, true);
  assert.equal(c.calls.authGetUserById[0], 'auth-1');
  assert.equal(c.calls.rpc.some((r) => r.name === 'admin_finalize_player_account_deletion'), true);
});

test('runAccountDeletion: cuenta SIN avatar — Fase 2 no llama a remove(), pero igual finaliza la auditoría', async () => {
  const c = fakeSupabaseAdmin(baseState({ storageList: () => ({ data: [], error: null }) }));
  const result = await runAccountDeletion(c, 'p2');

  assert.equal(result.ok, true);
  assert.equal(result.avatarFilesRemoved, 0);
  assert.equal(c.calls.storageRemove.length, 0);
  assert.equal(result.auditFinalized, true);
});

test('runAccountDeletion (handoff 30 §3.1): Auth eliminado confirmado por Admin API — getUserById se llama y devuelve "gone"', async () => {
  const c = fakeSupabaseAdmin(baseState());
  const result = await runAccountDeletion(c, 'p3');

  assert.equal(result.ok, true);
  assert.equal(c.calls.authGetUserById.length, 1);
});

test('runAccountDeletion (handoff 30 §3.2): Auth TODAVÍA existe tras deleteUser — la operación se detiene, NUNCA finaliza la auditoría', async () => {
  const c = fakeSupabaseAdmin(baseState({
    authGetUserById: () => ({ data: { user: { id: 'auth-1' } }, error: null }), // sigue existiendo
    rpcFinalizeResponse: () => { throw new Error('nunca debería llamarse si Auth sigue vivo'); },
  }));
  const result = await runAccountDeletion(c, 'p4');

  assert.equal(result.ok, false);
  assert.equal(result.step, 'auth_verify');
  assert.equal(c.calls.rpc.some((r) => r.name === 'admin_finalize_player_account_deletion'), false);
});

test('runAccountDeletion (handoff 30 §3.3): cleanup final de authUserId corre DESPUÉS de confirmar Auth eliminado, nunca antes', async () => {
  let finalizeCalledAfterVerify = false;
  const c = fakeSupabaseAdmin(baseState({
    authGetUserById: () => { finalizeCalledAfterVerify = true; return { data: null, error: { status: 404, message: 'not found' } }; },
    rpcFinalizeResponse: (playerId) => {
      assert.equal(finalizeCalledAfterVerify, true, 'la verificación de Auth debía haber corrido ANTES de finalizar');
      return { data: { ok: true, playerId }, error: null };
    },
  }));
  const result = await runAccountDeletion(c, 'p5');
  assert.equal(result.ok, true);
  assert.equal(result.auditFinalized, true);
});

test('runAccountDeletion (handoff 30 §3.4): reintento — Auth ya no existe pero todavía queda authUserId operativo (nunca se finalizó antes) — debe limpiarlo y cerrar', async () => {
  // Simula: una corrida anterior completó SQL+Storage+Auth pero se cortó antes de la Fase 5. El
  // reintento entra con alreadyDeleted:true (RPC idempotente) pero SIGUE trayendo authUserId
  // (recuperado de pilot_events por la propia función SQL) — debe completar Fase 4+5 igual.
  const c = fakeSupabaseAdmin(baseState({
    rpcDeleteResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: true, authUserId: 'auth-retry' }, error: null }),
    storageList: () => ({ data: [], error: null }), // Storage ya limpio de la corrida anterior
    authUpdate: () => ({ error: { status: 404, message: 'User not found' } }), // ya baneado/gone
    authDelete: () => ({ error: { status: 404, message: 'User not found' } }),
    authGetUserById: () => ({ data: null, error: { status: 404, message: 'not found' } }),
  }));
  const result = await runAccountDeletion(c, 'p6');

  assert.equal(result.ok, true, `esperaba éxito en el reintento: ${JSON.stringify(result)}`);
  assert.equal(result.authUserId, 'auth-retry');
  assert.equal(result.auditFinalized, true);
});

test('runAccountDeletion (handoff 30 §3.5): fallo al finalizar la auditoría — la operación NO se declara cerrada, queda recuperable', async () => {
  const c = fakeSupabaseAdmin(baseState({
    rpcFinalizeResponse: () => ({ data: null, error: { message: 'transient_db_error' } }),
  }));
  const result = await runAccountDeletion(c, 'p7');

  assert.equal(result.ok, false);
  assert.equal(result.step, 'sql_finalize');
  // El resto ya se completó de verdad (Auth confirmado eliminado) — un reintento debe poder
  // recuperar authUserId y solo reintentar la Fase 5, sin repetir Storage/Auth innecesariamente.
  assert.equal(result.authUserId, 'auth-1');
});

test('runAccountDeletion: sin authUserId desde el inicio (nunca tuvo sesión vinculada) — Fases 3/4 se omiten, Fase 5 corre igual (no-op) y cierra', async () => {
  const c = fakeSupabaseAdmin(baseState({
    rpcDeleteResponse: (playerId) => ({ data: { ok: true, playerId, alreadyDeleted: false, authUserId: null }, error: null }),
    authUpdate: () => { throw new Error('no debería llamarse sin authUserId'); },
    authDelete: () => { throw new Error('no debería llamarse sin authUserId'); },
    authGetUserById: () => { throw new Error('no debería llamarse sin authUserId'); },
  }));
  const result = await runAccountDeletion(c, 'p8');

  assert.equal(result.ok, true);
  assert.equal(result.authPhase, 'skipped_no_auth_user_id');
  assert.equal(result.auditFinalized, true);
  assert.equal(c.calls.authUpdate.length, 0);
  assert.equal(c.calls.authGetUserById.length, 0);
});

test('isAlreadyGoneError (handoff 30 §3.7, vía runAccountDeletion): señal ESTRUCTURADA (status 404) reconocida sin depender del texto del mensaje', async () => {
  const c = fakeSupabaseAdmin(baseState({
    authUpdate: () => ({ error: { status: 404, message: 'cualquier texto random, no debería importar' } }),
    authDelete: () => ({ error: { status: 404, message: 'cualquier texto random, no debería importar' } }),
  }));
  const result = await runAccountDeletion(c, 'p9');
  assert.equal(result.ok, true);
});

test('isAlreadyGoneError (handoff 30 §3.7): un error REAL con señal estructurada (status 429/rate-limit) nunca cae al fallback de texto, aunque el mensaje contenga palabras parecidas', async () => {
  const c = fakeSupabaseAdmin(baseState({
    // Mensaje contiene "not found" pero el status estructurado (429) indica un error real
    // distinto — no debe tratarse como "already gone".
    authUpdate: () => ({ error: { status: 429, message: 'rate limit exceeded, resource not found in cache' } }),
  }));
  const result = await runAccountDeletion(c, 'p10');
  assert.equal(result.ok, false);
  assert.equal(result.step, 'auth_ban');
});

test('isAlreadyGoneError: sin NINGUNA señal estructurada, cae al fallback de substring de mensaje (compatibilidad)', async () => {
  const c = fakeSupabaseAdmin(baseState({
    authUpdate: () => ({ error: { message: 'User not found' } }), // sin status/code
  }));
  const result = await runAccountDeletion(c, 'p11');
  assert.equal(result.ok, true);
});

test('runAccountDeletion: un error REAL (no "already gone") de la Auth Admin API sí hace fallar el paso, nunca se traga en silencio', async () => {
  const c = fakeSupabaseAdmin(baseState({
    authUpdate: () => ({ error: { message: 'internal server error' } }),
    authDelete: () => { throw new Error('no debería llegar a Fase 3b si el baneo falló con un error real'); },
  }));
  const result = await runAccountDeletion(c, 'p12');

  assert.equal(result.ok, false);
  assert.equal(result.step, 'auth_ban');
});

test('runAccountDeletion: la RPC de Fase 1 devuelve un código de negocio (player_not_found) — se propaga sin intentar Storage/Auth', async () => {
  const c = fakeSupabaseAdmin(baseState({
    rpcDeleteResponse: () => ({ data: { ok: false, code: 'player_not_found' }, error: null }),
    storageList: () => { throw new Error('no debería llamarse'); },
  }));
  const result = await runAccountDeletion(c, 'p13');

  assert.equal(result.ok, false);
  assert.equal(result.step, 'sql_phase1');
  assert.equal(result.code, 'player_not_found');
});

test('runAccountDeletion: playerId ausente/inválido nunca llega a llamar a la RPC', async () => {
  const c = fakeSupabaseAdmin(baseState({
    rpcDeleteResponse: () => { throw new Error('no debería llamarse'); },
  }));
  const result = await runAccountDeletion(c, '');
  assert.equal(result.ok, false);
  assert.equal(result.step, 'validate_input');
});

test('verifyAccountDeleted (handoff 30 §2.B): post-condición COMPLETA solo si Auth Y auditoría también están resueltos, no solo BRAMU/Storage', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => {
      if (table === 'players') return { data: { deleted_at: '2026-09-27T00:00:00Z', auth_user_id: null, is_active: false }, error: null };
      if (table === 'pilot_events') return { data: [{ properties: {} }], error: null }; // ya purgado
      return { data: null, error: null };
    },
    storageList: () => ({ data: [], error: null }),
    authGetUserById: () => ({ data: null, error: { status: 404 } }),
  }));
  const result = await verifyAccountDeleted(c, 'p14', 'auth-1');
  assert.deepEqual(result, {
    ok: true, anonymized: true, authUnlinked: true, inactiveInBramu: true,
    storageClean: true, groupStorageClean: true, authDeleted: true, auditPurged: true,
  });
});

test('verifyAccountDeleted (handoff 30 §3.2): Auth TODAVÍA existente hace fallar la postcondición completa, aunque BRAMU/Storage estén perfectos', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => {
      if (table === 'players') return { data: { deleted_at: '2026-09-27T00:00:00Z', auth_user_id: null, is_active: false }, error: null };
      if (table === 'pilot_events') return { data: [{ properties: { authUserId: 'auth-1' } }], error: null };
      return { data: null, error: null };
    },
    storageList: () => ({ data: [], error: null }),
    authGetUserById: () => ({ data: { user: { id: 'auth-1' } }, error: null }), // TODAVÍA existe
  }));
  const result = await verifyAccountDeleted(c, 'p15', 'auth-1');
  assert.equal(result.ok, false);
  assert.equal(result.authDeleted, false);
});

test('verifyAccountDeleted: auditoría SIN purgar (authUserId todavía en properties) hace fallar la postcondición completa', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => {
      if (table === 'players') return { data: { deleted_at: '2026-09-27T00:00:00Z', auth_user_id: null, is_active: false }, error: null };
      if (table === 'pilot_events') return { data: [{ properties: { authUserId: 'auth-1' } }], error: null };
      return { data: null, error: null };
    },
    storageList: () => ({ data: [], error: null }),
    authGetUserById: () => ({ data: null, error: { status: 404 } }),
  }));
  const result = await verifyAccountDeleted(c, 'p16', null);
  assert.equal(result.ok, false);
  assert.equal(result.auditPurged, false);
});

test('verifyAccountDeleted: detecta Storage sucio como una post-condición real, no la esconde', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => {
      if (table === 'players') return { data: { deleted_at: '2026-09-27T00:00:00Z', auth_user_id: null, is_active: false }, error: null };
      if (table === 'pilot_events') return { data: [{ properties: {} }], error: null };
      return { data: null, error: null };
    },
    storageList: () => ({ data: [{ name: 'leftover.jpg' }], error: null }),
    authGetUserById: () => ({ data: null, error: { status: 404 } }),
  }));
  const result = await verifyAccountDeleted(c, 'p17', null);
  assert.equal(result.storageClean, false);
  assert.equal(result.ok, false);
});

test('verifyAccountDeleted: authUserId null (nunca hubo sesión, o ya purgado) se considera trivialmente "gone" — no exige haber llamado getUserById en falso', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => {
      if (table === 'players') return { data: { deleted_at: '2026-09-27T00:00:00Z', auth_user_id: null, is_active: false }, error: null };
      if (table === 'pilot_events') return { data: [{ properties: {} }], error: null };
      return { data: null, error: null };
    },
    storageList: () => ({ data: [], error: null }),
    authGetUserById: () => { throw new Error('no debería llamarse con authUserId null'); },
  }));
  const result = await verifyAccountDeleted(c, 'p18', null);
  assert.equal(result.authDeleted, true);
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------------------------
// B2c — fotos de grupo (Issue #5: "P0.3 sole-member group -> photo_path null + Storage limpio al
// cerrar E2E"). La Fase 1 SQL ya borra lógicamente el grupo y nulifica photo_path (probado en
// supabase/tests/verify-preprod-grupos-b2c-group-photo.sql, T8); el orquestador limpia los objetos.
// ---------------------------------------------------------------------------------------------

test('B2c: Fase 2b limpia group-photos/{group_id}/* de los grupos que esta persona borró (único miembro)', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => (table === 'groups' ? { data: [{ group_id: 'g1' }, { group_id: 'g2' }], error: null } : { data: [], error: null }),
    groupStorageList: (prefix) => ({ data: prefix === 'g1' ? [{ name: 'a.jpg' }, { name: 'b.jpg' }] : [], error: null }),
  }));
  const result = await runAccountDeletion(c, 'p-b2c');
  assert.equal(result.ok, true);
  assert.deepEqual(c.calls.groupStorageList, ['g1', 'g2']);
  assert.deepEqual(c.calls.groupStorageRemove, [['g1/a.jpg', 'g1/b.jpg']], 'solo borra donde hay objetos');
});

test('B2c: sin grupos borrados por la persona no se toca el bucket group-photos', async () => {
  const c = fakeSupabaseAdmin(baseState());
  const result = await runAccountDeletion(c, 'p-b2c-none');
  assert.equal(result.ok, true);
  assert.equal(c.calls.groupStorageList.length, 0);
});

test('B2c: un fallo al limpiar fotos de grupo detiene la operación (reintentable, nunca la declara cerrada)', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => (table === 'groups' ? { data: [{ group_id: 'g1' }], error: null } : { data: [], error: null }),
    groupStorageList: () => ({ data: [{ name: 'a.jpg' }], error: null }),
    groupStorageRemove: () => ({ data: null, error: { message: 'storage_down' } }),
  }));
  const result = await runAccountDeletion(c, 'p-b2c-fail');
  assert.equal(result.ok, false);
  assert.equal(result.step, 'group_storage_remove');
  assert.equal(c.calls.authUpdate.length, 0, 'no avanza a Auth');
});

test('B2c: verifyAccountDeleted falla la postcondición si quedan objetos en group-photos de un grupo borrado', async () => {
  const c = fakeSupabaseAdmin(baseState({
    tableQuery: (table) => {
      if (table === 'players') return { data: { deleted_at: '2026-09-30T00:00:00Z', auth_user_id: null, is_active: false }, error: null };
      if (table === 'pilot_events') return { data: [{ properties: {} }], error: null };
      if (table === 'groups') return { data: [{ group_id: 'g1' }], error: null };
      return { data: null, error: null };
    },
    storageList: () => ({ data: [], error: null }),
    groupStorageList: () => ({ data: [{ name: 'residual.jpg' }], error: null }),
    authGetUserById: () => ({ data: null, error: { status: 404 } }),
  }));
  const result = await verifyAccountDeleted(c, 'p-b2c-post', 'auth-1');
  assert.equal(result.groupStorageClean, false);
  assert.equal(result.ok, false);
});
