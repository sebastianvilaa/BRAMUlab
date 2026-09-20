import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const storePath = fileURLToPath(new URL('../../bramulab/store.js', import.meta.url));
const storeCode = fs.readFileSync(storePath, 'utf8');

function makeStorage(shared, failWrites) {
  return {
    getItem(key) { return shared.has(key) ? shared.get(key) : null; },
    setItem(key, value) {
      if (failWrites.value) throw new Error('storage_blocked_for_test');
      shared.set(key, String(value));
    },
    removeItem(key) { shared.delete(key); },
  };
}

function loadStore(storage) {
  const context = {
    localStorage: storage,
    console: { log() {}, warn() {}, error() {} },
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Set,
    Map,
    Intl,
  };
  vm.createContext(context);
  vm.runInContext(storeCode, context, { filename: 'store.js' });
  assert.ok(context.PLStore, 'PLStore debe exportarse');
  return context.PLStore;
}

const shared = new Map();
const failWrites = { value: true };
const storage = makeStorage(shared, failWrites);
const Store = loadStore(storage);

const tokenA = 'a'.repeat(64);
const persistedA = Store.saveClaimToken(tokenA);
assert.equal(persistedA, false, 'la escritura bloqueada debe reportar false');
assert.equal(Store.loadClaimToken(), tokenA, 'el fallback volátil debe conservar el token en la misma página');

Store.clearClaimToken();
assert.equal(Store.loadClaimToken(), null, 'clearClaimToken debe limpiar también el fallback volátil');

failWrites.value = false;
const tokenB = 'b'.repeat(64);
const persistedB = Store.saveClaimToken(tokenB);
assert.equal(persistedB, true, 'la escritura disponible debe reportar true');
assert.equal(Store.loadClaimToken(), tokenB, 'el token persistido debe leerse normalmente');

// Simula un reload: nuevo módulo Store, mismo localStorage.
const StoreAfterReload = loadStore(storage);
assert.equal(StoreAfterReload.loadClaimToken(), tokenB, 'un token persistido debe sobrevivir un reload');

StoreAfterReload.clearClaimToken();
assert.equal(StoreAfterReload.loadClaimToken(), null, 'la limpieza final debe dejar el token en null');

console.log('CLAIM TOKEN STORAGE OK');
