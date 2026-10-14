// BRAMUlab — V04.41: tarjeta de vista previa con el PARTIDO REAL (bramulab-invite: api/_lib/card.js + api/og.js + RPC get_invitation_card).
// Ejecutar con: node --test bramulab-invite/tests/*.test.mjs   (el render real necesita `npm ci` en bramulab-invite/)
// El RPC se verifica contra Postgres real (PGlite) en supabase/tests/verify-v0441-invitation-card.sql (verify-clean-room.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/og.js';
import { parseCard, buildCardTree, fetchCard, renderCardPng, TOKEN_RE, brandPng } from '../api/_lib/card.js';
import { hexToCode } from '../api/_lib/token.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'a1b2c3d4'.repeat(8);
const CODE = hexToCode(TOKEN);
const CARD = { ok: true, teams: [{ names: ['Seba', 'Marcos'], sets: [6, 3, 6] }, { names: ['Esteban', 'Matu'], sets: [4, 6, 4] }] };
const hasDeps = fs.existsSync(path.join(root, 'node_modules', 'satori')) && fs.existsSync(path.join(root, 'node_modules', '@resvg', 'resvg-wasm'));

function fakeRes() {
  const r = { headers: {}, code: null, body: null, setHeader(k, v) { r.headers[k.toLowerCase()] = v; }, status(c) { r.code = c; return r; }, end(b) { r.body = b; return r; } };
  return r;
}
const fakeFetch = (impl) => async (url, init) => { fakeFetch.calls.push({ url, init }); return impl(url, init); };
fakeFetch.calls = [];

test('parseCard: acepta solo la forma esperada y limpia (2 parejas, hasta 2 nombres, games enteros 0–99, mismos sets en ambas)', () => {
  assert.deepEqual(parseCard(CARD), { teams: CARD.teams });
  for (const bad of [null, undefined, {}, { ok: false }, { ok: true }, { ok: true, teams: [] }, { ok: true, teams: [CARD.teams[0]] },
    { ok: true, teams: [{ names: [], sets: [6] }, { names: ['x'], sets: [4] }] },
    { ok: true, teams: [{ names: ['a'], sets: [] }, { names: ['b'], sets: [] }] },
    { ok: true, teams: [{ names: ['a'], sets: [6, 3] }, { names: ['b'], sets: [4] }] }]) assert.equal(parseCard(bad), null, JSON.stringify(bad));
  const dirty = parseCard({ ok: true, teams: [{ names: ['  Seba   Vila ', 'M', 'tercero'], sets: [6, 'x', 3.5, 100, 7, -1, 1, 2, 3, 4, 5] }, { names: ['Q'], sets: [1, 2, 3, 4, 5] }], extra: { id: 'x' } });
  assert.deepEqual(dirty.teams[0].names, ['Seba Vila', 'M']);
  assert.deepEqual(dirty.teams[0].sets, [6, 7, 1, 2, 3]);
  assert.equal(Object.keys(dirty).join(), 'teams', 'ningún campo extra sobrevive');
});

test('fetchCard: llama SOLO al RPC público con la clave publishable en `apikey` (nunca Bearer ni service role) y cae a null ante cualquier problema', async () => {
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_test' };
  fakeFetch.calls.length = 0;
  const ok = await fetchCard(TOKEN, env, fakeFetch(async () => ({ ok: true, json: async () => CARD })));
  assert.deepEqual(ok.teams[0].names, ['Seba', 'Marcos']);
  const c = fakeFetch.calls[0];
  assert.equal(c.url, 'https://x.supabase.co/rest/v1/rpc/get_invitation_card');
  assert.equal(c.init.method, 'POST'); assert.deepEqual(JSON.parse(c.init.body), { p_token: TOKEN });
  assert.equal(c.init.headers.apikey, 'sb_publishable_test'); assert.equal(c.init.headers.Authorization, undefined);
  assert.doesNotMatch(JSON.stringify(c), /service_role|SERVICE_ROLE/);
  // problemas → null (la tarjeta de marca cubre)
  for (const [name, impl] of [['404 (migración sin aplicar)', async () => ({ ok: false })], ['red', async () => { throw new Error('boom'); }],
    ['ok:false', async () => ({ ok: true, json: async () => ({ ok: false }) })], ['json roto', async () => ({ ok: true, json: async () => { throw new Error('x'); } })]]) {
    assert.equal(await fetchCard(TOKEN, env, fakeFetch(impl)), null, name);
  }
  fakeFetch.calls.length = 0;
  for (const badToken of ['', 'abc', TOKEN.toUpperCase(), `${TOKEN}0`, undefined]) assert.equal(await fetchCard(badToken, env, fakeFetch(async () => ({ ok: true, json: async () => CARD }))), null);
  assert.equal(fakeFetch.calls.length, 0, 'un token mal formado ni siquiera consulta la base');
  assert.equal(await fetchCard(TOKEN, {}, fakeFetch(async () => ({ ok: true, json: async () => CARD }))), null, 'sin variables de entorno');
  assert.match(TOKEN, TOKEN_RE);
});

test('diseño: logo, dos parejas (una por fila) en lima/celeste, games por set con ganador resaltado y perdedor atenuado, mensaje breve; sin guiones vacíos', () => {
  const tree = buildCardTree(parseCard(CARD), 'data:image/svg+xml;base64,AAAA');
  const flat = JSON.stringify(tree);
  for (const t of ['Seba', 'Marcos', 'Esteban', 'Matu', 'Te invitaron a', 'BRAMUlab', 'Entrá y recuperá este partido en tu historial.']) assert.ok(flat.includes(`"${t}"`), t);
  assert.ok(flat.includes('data:image/svg+xml;base64,AAAA'), 'logo oficial');
  assert.ok(flat.includes('#95FF19') && flat.includes('#199FFF'), 'lima y celeste');
  const cells = [...flat.matchAll(/"children":"([0-9])"/g)].map((m) => m[1]);
  assert.deepEqual(cells, ['6', '3', '6', '4', '6', '4'], 'games reales por set, fila a fila');
  assert.ok(!flat.includes('"–"') && !flat.includes('"-"'), 'sin marcadores vacíos');
  // ganador del set resaltado (texto claro #F8FAFC) / perdedor atenuado (#687482)
  const win6 = flat.match(/"color":"([^"]+)","fontSize":50,"fontWeight":800\},"children":"6"/);
  assert.equal(win6[1], '#F8FAFC');
  assert.match(flat, /"color":"#687482","fontSize":50,"fontWeight":800\},"children":"3"/);
});

test('handler: enlace inválido o sin RPC utilizable → 200 con la tarjeta de MARCA (mismo formato; el bot nunca ve un error ni aprende por qué)', async () => {
  const saved = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_ANON_KEY };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
  const realFetch = globalThis.fetch; let fetched = 0;
  globalThis.fetch = async () => { fetched += 1; return { ok: true, json: async () => ({ ok: false }) }; };
  try {
    for (const query of [{ c: CODE }, { c: 'basura' }, { c: `${CODE}x` }, { c: 'x' }, {}]) {
      const res = fakeRes();
      await handler({ url: '/api/og', query }, res);
      assert.equal(res.code, 200, JSON.stringify(query));
      assert.equal(res.headers['content-type'], 'image/png');
      assert.deepEqual(res.body, brandPng(), 'idéntica a la tarjeta de marca');
      assert.equal(res.headers['cache-control'], 'private, no-store');
    }
    // RPC que responde {ok:false} (vencido/rotado/usado): también la tarjeta de marca, indistinguible
    process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_ANON_KEY = 'k';
    const res = fakeRes();
    await handler({ url: '/api/og', query: { c: CODE } }, res);
    assert.deepEqual(res.body, brandPng());
    assert.equal(fetched, 1, 'solo el enlace con formato válido llega a consultar la base');
  } finally { globalThis.fetch = realFetch; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY; if (saved.u) process.env.SUPABASE_URL = saved.u; if (saved.k) process.env.SUPABASE_ANON_KEY = saved.k; }
  const brand = brandPng();
  assert.equal(brand.subarray(1, 4).toString(), 'PNG'); assert.equal(brand.readUInt32BE(16), 1200); assert.equal(brand.readUInt32BE(20), 630); assert.ok(brand.length < 300 * 1024);
});

test('render real (satori + resvg-wasm): PNG 1200×630, liviano; nombres largos y 2/3/5 sets no rompen', { skip: !hasDeps && 'faltan dependencias: correr `npm ci` en bramulab/' }, async () => {
  const check = (png) => { assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630); assert.ok(png.length > 20_000 && png.length < 300 * 1024, `tamaño ${png.length}`); };
  check(await renderCardPng(parseCard(CARD)));
  check(await renderCardPng(parseCard({ ok: true, teams: [{ names: ['Remera celeste con un apodo larguísimo de verdad', 'Marcos'], sets: [6, 3] }, { names: ['Esteban Fernández', 'Matu'], sets: [4, 6] }] })));
  check(await renderCardPng(parseCard({ ok: true, teams: [{ names: ['Ñandú Ávila'], sets: [6] }, { names: ['Zoë'], sets: [2] }] })));
  check(await renderCardPng(parseCard({ ok: true, teams: [{ names: ['A', 'B'], sets: [6, 3, 7, 4, 6] }, { names: ['C', 'D'], sets: [3, 6, 5, 6, 4] }] })));
});

test('handler con datos: imagen/png con cache privada (el enlace personal no se guarda en cachés compartidas)', { skip: !hasDeps && 'faltan dependencias' }, async () => {
  process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_ANON_KEY = 'sb_publishable_test';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => CARD });
  try {
    const res = fakeRes();
    await handler({ url: '/api/og', query: { c: CODE } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.headers['content-type'], 'image/png'); assert.equal(res.headers['cache-control'], 'private, no-store');
    assert.equal(res.body.subarray(1, 4).toString(), 'PNG');
    assert.notDeepEqual(res.body, brandPng(), 'con datos válidos NO es la tarjeta de marca');
  } finally { globalThis.fetch = realFetch; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY; }
});
