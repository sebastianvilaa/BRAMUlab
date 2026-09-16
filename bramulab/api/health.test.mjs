// Bloque 1 — pruebas locales del health check.
// Simula la API REST de Supabase con un servidor HTTP en localhost, así la
// prueba es reproducible sin depender de un proyecto Supabase real.
// Ejecutar con: node --test bramulab/api/health.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import handler from './health.js';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function startFakeSupabase(respond) {
  const server = http.createServer((req, res) => {
    respond(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test('ok=true cuando Supabase responde y el entorno declarado coincide', async () => {
  const { server, url } = await startFakeSupabase((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([{ environment: 'staging', updated_at: '2026-09-16T00:00:00Z' }]));
  });

  process.env.BRAMU_ENV_NAME = 'staging';
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_ANON_KEY = 'fake-anon-key';

  const res = fakeRes();
  await handler({}, res);
  server.close();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.environment, 'staging');
});

test('ok=false por environment_mismatch cuando Supabase declara otro entorno', async () => {
  const { server, url } = await startFakeSupabase((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([{ environment: 'production', updated_at: '2026-09-16T00:00:00Z' }]));
  });

  process.env.BRAMU_ENV_NAME = 'staging';
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_ANON_KEY = 'fake-anon-key';

  const res = fakeRes();
  await handler({}, res);
  server.close();

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'environment_mismatch');
});

test('ok=false por app_config_not_seeded cuando la tabla está vacía', async () => {
  const { server, url } = await startFakeSupabase((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([]));
  });

  process.env.BRAMU_ENV_NAME = 'staging';
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_ANON_KEY = 'fake-anon-key';

  const res = fakeRes();
  await handler({}, res);
  server.close();

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'app_config_not_seeded');
});

test('ok=false por supabase_rest_error cuando Supabase responde con error', async () => {
  const { server, url } = await startFakeSupabase((req, res) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'unavailable' }));
  });

  process.env.BRAMU_ENV_NAME = 'staging';
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_ANON_KEY = 'fake-anon-key';

  const res = fakeRes();
  await handler({}, res);
  server.close();

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'supabase_rest_error');
});

test('ok=false por missing_env_vars cuando falta configuración', async () => {
  delete process.env.BRAMU_ENV_NAME;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  const res = fakeRes();
  await handler({}, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'missing_env_vars');
});

test('ok=false por supabase_unreachable cuando no hay servidor escuchando', async () => {
  process.env.BRAMU_ENV_NAME = 'staging';
  process.env.SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.SUPABASE_ANON_KEY = 'fake-anon-key';

  const res = fakeRes();
  await handler({}, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'supabase_unreachable');
});
