// BRAMUlab — V04.41: servicio público bramulab-invite — enlace compacto, página de invitación (OG + redirección) y configuración de Vercel.
// Ejecutar con: node --test bramulab-invite/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import handler, { resolveOrigin, buildTarget, buildInvitationHtml } from '../api/invitacion.js';
import { codeToHex, hexToCode } from '../api/_lib/token.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const HEX = 'a1b2c3d4'.repeat(8);
const CODE = hexToCode(HEX);
const APP = 'https://bramulab-git-staging-bramu-lab.vercel.app';

test('token compacto: 64 hex ↔ 43 base64url SIN pérdida (mismos 256 bits); solo formatos canónicos; nada se adivina ni se completa', () => {
  assert.equal(CODE.length, 43);
  assert.equal(codeToHex(CODE), HEX);
  assert.equal(codeToHex(HEX), HEX, 'los enlaces anteriores (64 hex) siguen valiendo');
  assert.equal(codeToHex(HEX.toUpperCase()), HEX);
  for (const t of ['00'.repeat(32), 'ff'.repeat(32), '0123456789abcdef'.repeat(4)]) assert.equal(codeToHex(hexToCode(t)), t);
  for (const bad of [undefined, null, '', 'abc', CODE.slice(1), `${CODE}A`, `${CODE.slice(0, 42)}!`, `${HEX}0`, HEX.slice(1), ' '.repeat(43), '../'.repeat(15), `${CODE.slice(0, 42)}R`]) {
    assert.equal(codeToHex(bad), null, String(bad));
  }
  assert.equal(codeToHex(CODE.slice(0, 42) + 'R'), null, 'bits sobrantes distintos de cero: no canónico');
  assert.equal(hexToCode('xyz'), null);
});

test('origen de las URLs absolutas: solo *.vercel.app, *.bramulab.com y localhost; cualquier otro host → null (404)', () => {
  assert.equal(resolveOrigin('bramu-i.vercel.app'), 'https://bramu-i.vercel.app');
  assert.equal(resolveOrigin('i.bramulab.com'), 'https://i.bramulab.com');
  assert.equal(resolveOrigin('localhost:3000'), 'http://localhost:3000');
  for (const bad of ['evil.com', 'bramu-i.vercel.app.evil.com', 'bramulab.com.evil.com', '', undefined, 'a b.vercel.app']) assert.equal(resolveOrigin(bad), null, String(bad));
});

test('destino de las personas: solo un origen https sin ruta de BRAMU_APP_URL (servidor); con token válido lleva ?claim= (la captura existente)', () => {
  assert.equal(buildTarget(APP, HEX), `${APP}/?claim=${HEX}`);
  assert.equal(buildTarget(APP, null), `${APP}/`);
  for (const bad of [undefined, '', 'http://x.vercel.app', 'https://x.vercel.app/ruta', 'javascript:alert(1)', 'https://x.vercel.app?a=1', '//x.com']) assert.equal(buildTarget(bad, HEX), null, String(bad));
});

test('HTML: título genérico; og:image = /i/{código}/og.png; og:url a la raíz; sin nombres ni resultados; token solo en la imagen y en el destino', () => {
  const html = buildInvitationHtml({ origin: 'https://bramu-i.vercel.app', code: CODE, hex: HEX, appUrl: APP });
  assert.match(html, /<meta property="og:title" content="Te invitaron a BRAMUlab">/);
  assert.match(html, new RegExp(`<meta property="og:image" content="https://bramu-i\\.vercel\\.app/i/${CODE}/og\\.png">`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="https://bramu-i\\.vercel\\.app/i/${CODE}/og\\.png">`));
  assert.match(html, /<meta property="og:url" content="https:\/\/bramu-i\.vercel\.app\/">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/); assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(html, new RegExp(`location\\.replace\\("${APP}/\\?claim=${HEX}"\\)`));
  assert.doesNotMatch(html, /Seba|Marcos|Esteban|Remera/);
  // el hex solo aparece en el destino de la redirección (el código compacto, en la URL de la imagen)
  assert.ok(!html.replace(/location\.replace\([^)]*\)/, '').replace(/<a id="go"[^>]*>/, '').includes(HEX), 'el hex no está en metadatos ni texto');
  // enlace inválido: imagen de marca por la misma ruta, sin redirección con token
  const bad = buildInvitationHtml({ origin: 'https://bramu-i.vercel.app', code: '', hex: null, appUrl: APP });
  assert.match(bad, /og:image" content="https:\/\/bramu-i\.vercel\.app\/i\/x\/og\.png"/);
  assert.doesNotMatch(bad, /claim=/);
  // sin BRAMU_APP_URL válido: sin redirección (nunca un destino inventado)
  assert.doesNotMatch(buildInvitationHtml({ origin: 'https://x.vercel.app', code: CODE, hex: HEX, appUrl: undefined }), /location\.replace|claim=/);
});

test('HTML: el destino se inserta seguro (sin romper el script ni el atributo)', () => {
  const html = buildInvitationHtml({ origin: 'https://x.vercel.app', code: CODE, hex: HEX, appUrl: APP });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const out = { to: null };
  vm.runInNewContext(script, { location: { replace: (u) => { out.to = u; } } });
  assert.equal(out.to, `${APP}/?claim=${HEX}`);
});

test('handler: acepta el código compacto y el hex; hosts ajenos → 404; sin caché compartida, noindex y sin referrer', () => {
  const run = (query, host, appUrl = APP) => {
    process.env.BRAMU_APP_URL = appUrl;
    const h = {}; let body = null; let status = null;
    handler({ query, headers: { host } }, { setHeader: (k, v) => { h[k.toLowerCase()] = v; }, status(c) { status = c; return this; }, send(b) { body = b; } });
    return { h, body, status };
  };
  try {
    const a = run({ c: CODE }, 'bramu-i.vercel.app');
    assert.equal(a.status, 200);
    assert.equal(run({ c: HEX }, 'bramu-i.vercel.app').body.includes(`claim=${HEX}`), true);
    assert.match(a.body, new RegExp(`/i/${CODE}/og\\.png`));
    assert.equal(a.h['cache-control'], 'private, no-store'); assert.equal(a.h['referrer-policy'], 'no-referrer'); assert.match(a.h['x-robots-tag'], /noindex/);
    assert.equal(run({ c: CODE }, 'evil.com').status, 404);
    const inv = run({ c: 'basura' }, 'bramu-i.vercel.app');
    assert.equal(inv.status, 200); assert.doesNotMatch(inv.body, /claim=/); assert.match(inv.body, /\/i\/x\/og\.png/);
  } finally { delete process.env.BRAMU_APP_URL; }
});

test('Vercel: SOLO /i/:c y /i/:c/og.png → funciones; sin otras rutas públicas; noindex global; includeFiles completo; sin Git, sin secretos en el repo', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.deepEqual(v.rewrites, [{ source: '/i/:c', destination: '/api/invitacion?c=:c' }, { source: '/i/:c/og.png', destination: '/api/og?c=:c' }]);
  assert.equal(v.outputDirectory, 'public');
  assert.deepEqual(fs.readdirSync(path.join(root, 'public')), ['robots.txt'], 'la carpeta pública no tiene más que robots.txt');
  assert.match(read('public/robots.txt'), /Disallow: \//);
  const inc = v.functions['api/og.js'].includeFiles;
  for (const f of ['og/**', 'resvg-wasm/index_bg.wasm', 'harfbuzzjs']) assert.ok(inc.includes(f), f);
  assert.ok(v.headers.some((h) => h.source === '/(.*)' && h.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value))));
  const apis = fs.readdirSync(path.join(root, 'api')).filter((f) => !f.startsWith('_')).sort();
  assert.deepEqual(apis, ['invitacion.js', 'og.js'], 'solo dos funciones públicas');
  const all = ['api/invitacion.js', 'api/og.js', 'api/_lib/card.js', 'api/_lib/token.js', 'vercel.json', 'package.json'].map(read).join('\n');
  assert.doesNotMatch(all, /service_role|SERVICE_ROLE|eyJ[A-Za-z0-9_-]{20,}|sb_secret_/);
  assert.doesNotMatch(read('api/_lib/card.js').replace(/\/\/[^\n]*/g, ''), /Authorization/, 'la clave publishable solo viaja en apikey');
  assert.ok(fs.existsSync(path.join(root, 'og', 'marca.png')) && fs.existsSync(path.join(root, 'og', 'Inter-800.woff')));
});
