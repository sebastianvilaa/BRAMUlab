// BRAMUlab — V04.41: rediseño de la invitación a jugadores sin cuenta (hoja + animación + WhatsApp/compartir + mensaje + enlace
// /invitacion/{token} + vista previa de marca + «Sin cuenta» en el Resumen + pregunta neutral del destinatario).
// Ejecutar con: node --test bramulab/tests/v0441-invitacion-rediseno.test.mjs
// El flujo de la hoja (WhatsApp/compartir/copia/errores) se prueba en v0429-invitados-identidad.test.mjs con el código real extraído.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { resolveOrigin, buildInvitationHtml } from '../api/invitacion.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const css = read('styles.css');
const TOKEN = 'a1b2c3d4'.repeat(8); // 64 hex

function between(src, start, end) {
  const a = src.indexOf(start); assert.ok(a >= 0, `no se encontró: ${start.slice(0, 70)}`);
  const b = src.indexOf(end, a + start.length); assert.ok(b >= 0, `no se encontró fin: ${end.slice(0, 70)}`);
  return src.slice(a, b);
}

/* ================= Enlace personal + vista previa de marca ================= */
test('origen de las URLs absolutas: solo hosts propios (Production, *.vercel.app de Staging, localhost); cualquier otro cae a Production', () => {
  assert.equal(resolveOrigin('app.bramulab.com'), 'https://app.bramulab.com');
  assert.equal(resolveOrigin('bramulab-git-staging-bramu-lab.vercel.app'), 'https://bramulab-git-staging-bramu-lab.vercel.app');
  assert.equal(resolveOrigin('localhost:3000'), 'http://localhost:3000');
  for (const bad of ['evil.com', 'app.bramulab.com.evil.com', 'x.vercel.app.evil.com', '', undefined, 'a b.vercel.app']) assert.equal(resolveOrigin(bad), 'https://app.bramulab.com', String(bad));
});

test('metadatos Open Graph: título genérico; imagen dinámica /invitacion/{token}/og.png solo con token válido (si no, la de marca); og:url a la raíz; nada del partido en texto', () => {
  const generic = buildInvitationHtml('https://app.bramulab.com');
  assert.match(generic, /<meta property="og:image" content="https:\/\/app\.bramulab\.com\/assets\/invitacion-og\.png\?v=\d+">/, 'sin token: tarjeta de marca');
  for (const bad of ['abc', 'g'.repeat(64), `${TOKEN}0`, '../x', '<script>']) assert.match(buildInvitationHtml('https://app.bramulab.com', bad), /assets\/invitacion-og\.png/, `token inválido ${bad}`);
  const html = buildInvitationHtml('https://app.bramulab.com', TOKEN);
  assert.match(html, /<meta property="og:title" content="Te invitaron a BRAMUlab">/);
  assert.match(html, new RegExp(`<meta property="og:image" content="https://app\\.bramulab\\.com/invitacion/${TOKEN}/og\\.png">`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="https://app\\.bramulab\\.com/invitacion/${TOKEN}/og\\.png">`));
  assert.match(html, /<meta property="og:image:width" content="1200">/); assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/app\.bramulab\.com\/">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  // el token solo vive en la URL de la imagen (la misma credencial del enlace): ni en og:url, ni en texto, ni en el script de redirección
  const tokenAt = [...html.matchAll(new RegExp(TOKEN, 'g'))].length;
  assert.equal(tokenAt, 2, 'solo og:image y twitter:image');
  assert.doesNotMatch(html.replace(/<meta (property="og:image"|name="twitter:image")[^>]*>/g, ''), new RegExp(TOKEN));
  assert.doesNotMatch(html, /claim=[0-9a-f]/i);
  // el HTML no lleva nombres ni resultados: eso solo sale en la imagen
  assert.doesNotMatch(html, /Seba|Marcos|Esteban|Remera/);
});

test('handler: lee el token de ?t= (reescritura de Vercel); sin caché compartida ni referrer; el Host decide el origen', () => {
  const run = (query, host) => {
    const h = {}; let body = null; let status = null;
    const res = { setHeader: (k, v) => { h[k.toLowerCase()] = v; }, status(c) { status = c; return this; }, send(b) { body = b; } };
    handler({ url: '/api/invitacion', query, headers: { host } }, res);
    return { h, body, status };
  };
  const a = run({ t: TOKEN }, 'app.bramulab.com');
  assert.equal(a.status, 200);
  assert.match(a.body, new RegExp(`/invitacion/${TOKEN}/og\\.png`));
  assert.equal(run({ t: TOKEN.toUpperCase() }, 'app.bramulab.com').body, a.body, 'el token se normaliza a minúsculas');
  assert.match(run({}, 'app.bramulab.com').body, /assets\/invitacion-og\.png/);
  assert.match(a.h['content-type'], /text\/html/); assert.equal(a.h['cache-control'], 'private, no-store');
  assert.equal(a.h['referrer-policy'], 'no-referrer'); assert.match(a.h['x-robots-tag'], /noindex/);
  assert.match(run({ t: TOKEN }, 'bramulab-git-staging-bramu-lab.vercel.app').body, /og:image" content="https:\/\/bramulab-git-staging-bramu-lab\.vercel\.app\/invitacion\//);
});

test('redirección del navegador: /invitacion/{64 hex} → /?claim={token en minúsculas}; formato inválido → /, sin intención ni parámetros raros', () => {
  const script = buildInvitationHtml('https://x').match(/<script>([\s\S]*?)<\/script>/)[1];
  const go = (pathname) => {
    const out = { replaced: null, href: null };
    const el = { setAttribute: (k, v) => { out.href = v; } };
    vm.runInNewContext(script, { location: { pathname, replace: (u) => { out.replaced = u; } }, document: { getElementById: () => el } });
    return out;
  };
  assert.equal(go(`/invitacion/${TOKEN}`).replaced, `/?claim=${TOKEN}`);
  assert.equal(go(`/invitacion/${TOKEN.toUpperCase()}/`).replaced, `/?claim=${TOKEN}`);
  for (const bad of ['/invitacion/', '/invitacion/abc', `/invitacion/${TOKEN}0`, `/invitacion/${TOKEN}/x`, `/invitacion/${TOKEN.slice(1)}z`, '/otra/ruta']) assert.equal(go(bad).replaced, '/', bad);
});

test('Vercel: /invitacion/:token y /invitacion/:token/og.png → funciones; el Service Worker no intercepta; la imagen de marca (respaldo) existe (1200×630, liviana) y viaja en dist', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.deepEqual(v.rewrites.find((r) => r.source === '/invitacion/:token'), { source: '/invitacion/:token', destination: '/api/invitacion?t=:token' });
  assert.deepEqual(v.rewrites.find((r) => r.source === '/invitacion/:token/og.png'), { source: '/invitacion/:token/og.png', destination: '/api/invitacion-og?t=:token' });
  assert.match(v.functions['api/invitacion-og.mjs'].includeFiles, /og\/\*\*/);
  assert.match(v.functions['api/invitacion-og.mjs'].includeFiles, /resvg-wasm\/index_bg\.wasm/);
  assert.match(v.functions['api/invitacion-og.mjs'].includeFiles, /harfbuzzjs/, 'hb.wasm de satori: sin esto el render falla en Vercel (verificado en un deployment real)');
  assert.match(read('sw.js'), /pathname\.indexOf\('\/invitacion\/'\) === 0\) return;/);
  const png = fs.readFileSync(path.join(root, 'assets', 'invitacion-og.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.length < 300 * 1024, 'WhatsApp recorta vistas previas pesadas');
  assert.match(read('scripts/build-dist.mjs'), /'assets'/);
});

test('el cliente genera {origen}/invitacion/{token} (mismo token, ruta solo de presentación) y los ?claim= anteriores siguen capturándose', () => {
  assert.match(between(appJs, '  async function createInviteUrl(', '  /** Prepara (una sola vez'), /`\$\{window\.location\.origin\}\/invitacion\/\$\{created\.token\}`/);
  assert.match(between(appJs, '  function captureClaimTokenFromUrl() {', 'if (!cleanToken) return;'), /get\('claim'\)/);
});

/* ================= Hoja + animación ================= */
test('hoja: pop-up (bottom-sheet) que crece sin pantalla completa y scrollea en teléfonos bajos; animación con estado final base y reduced-motion', () => {
  assert.match(css, /#invite-sheet\{ max-height: 92dvh; overflow-y: auto;[^}]*touch-action: pan-y;/);
  const anim = between(css, '.invite-anim{ width:100%', '@media (prefers-reduced-motion: reduce){\n  .invite-anim');
  // El estado BASE de cada paso es el final: las animaciones solo cuelgan de `.is-playing`.
  assert.doesNotMatch(anim.replace(/\.invite-anim\.is-playing[^{]*\{[^}]*\}/g, ''), /animation\s*:/, 'sin .is-playing no hay animaciones');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\n  \.invite-anim\.is-playing \*\{ animation: none !important; \}/);
  assert.match(indexHtml, /id="invite-anim"[^>]*aria-hidden="true"/);
  for (const label of ['Sin cuenta', 'Invitación', 'Entra', 'Recupera']) assert.match(indexHtml, new RegExp(`>${label}</text>`));
  // ~3,5 s: el último paso termina antes de ~4 s.
  const ends = [...css.matchAll(/\.invite-anim\.is-playing [^{]*\{ animation: [\w-]+ ([\d.]+)s [^;]*? ([\d.]+)s both;/g)].map((m) => Number(m[1]) + Number(m[2]));
  assert.ok(Math.max(...ends) >= 3.2 && Math.max(...ends) <= 4, `duración total ${Math.max(...ends)}s`);
});

test('la animación se reproduce una vez por apertura y NO hay contador de «primeras invitaciones» ni lógica para ocultarla', () => {
  const open = between(appJs, '  function openInviteSheet(', '  function closeInviteSheet() {');
  assert.match(open, /anim\.classList\.remove\('is-playing'\);[\s\S]*anim\.classList\.add\('is-playing'\)/);
  const invite = between(appJs, '  function buildInviteMessage(', '  /** B3/B4 — punto único');
  assert.doesNotMatch(invite, /localStorage|sessionStorage|inviteCount|firstInvit|primeras|15\b/);
  assert.doesNotMatch(css.match(/\.invite-anim[\s\S]{0,6000}/)[0], /animation-iteration-count:\s*(infinite|[2-9])/);
});

test('la hoja no promete validación automática: nada de «validado/validar» en la animación ni en el texto', () => {
  const sheet = between(indexHtml, '<div id="invite-sheet-scrim"', 'V04.29 — RECEPTOR DE UNA INVITACIÓN');
  assert.doesNotMatch(sheet.replace(/<!--[\s\S]*?-->/g, ''), /validad|validar|validaci/i);
});

/* ================= «Sin cuenta» en el Resumen + destinatario ================= */
function resultRowsFn(pendingIds) {
  const code = between(appJs, '  function buildResultRowsHTML(players, sets, currentPartial, firstTeam) {', '  /** Bloque M2/M3/M4/M5');
  const sb = { escapeHtml: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), provisionalIdSet: new Set(pendingIds) };
  return new Function(...Object.keys(sb), `${code}\nreturn buildResultRowsHTML;`)(...Object.values(sb));
}
const PLAYERS = [
  { team: 'A', name: 'Seba', userId: 'u1' }, { team: 'A', name: 'Remera celeste', userId: 'prov1' },
  { team: 'B', name: 'Juan', userId: 'u3' }, { team: 'B', name: 'Pedro', userId: null },
];
const SETS = [{ gamesA: 6, gamesB: 4 }];

test('Resumen: SOLO el nombre de la identidad sin cuenta va en amarillo; el resto de la pareja, la fila y el marcador conservan su estructura/color de equipo', () => {
  const html = resultRowsFn(['prov1'])(PLAYERS, SETS, null, null);
  assert.match(html, /<span class="player-name--pending" title="Sin cuenta" data-player-id="prov1">Remera celeste<\/span>/);
  assert.doesNotMatch(html, /player-name--pending[^>]*>(Seba|Juan|Pedro)</);
  assert.match(html, /<div class="result-card__row" data-team="A"><span class="result-card__name">/, 'misma fila/clase: el color de pareja sigue viniendo de data-team');
  assert.match(html, /<span class="result-card__set result-card__set--win">6<\/span>/);
  // sin provisionales conocidos nada cambia visualmente (el marcado llega después, al responder listRelatedProvisionalPlayers)
  assert.doesNotMatch(resultRowsFn([])(PLAYERS, SETS, null, null), /player-name--pending/);
  // nombres escapados (un apodo no inyecta HTML)
  assert.match(resultRowsFn([])([{ team: 'A', name: '<b>x</b>', userId: 'z' }], SETS, null, null), /&lt;b>x&lt;\/b>/);
  assert.match(css, /\.result-card__name \.player-name--pending\{ color: var\(--gold\); \}/);
});

test('Resumen: el marcado posterior (async) y la leyenda «Sin cuenta» existen y son idempotentes; la sección JUGADORES SIN CUENTA conserva su etiqueta', () => {
  const fn = between(appJs, '  function markPendingNamesInResult() {', '  /** B1 — "JUGADORES SIN CUENTA"');
  assert.match(fn, /classList\.toggle\('player-name--pending', pending\)/);
  assert.match(fn, /analysis-result-legend/);
  assert.match(fn, /legend\.remove\(\)/);
  assert.match(between(appJs, '  async function renderAnalysisGuests(f) {', '  /** B2'), /markPendingNamesInResult\(\);/);
  assert.match(between(appJs, '  function renderAnalysis(f) {', 'renderB6Actions(f);'), /markPendingNamesInResult\(\);/);
  assert.match(appJs, /<span class="guests-row__tag">Sin cuenta<\/span>/);
});

test('mini-partido del destinatario: la identidad invitada va en amarillo con «Sin cuenta» (sin @usuario inventado); las cuentas registradas conservan su @usuario', () => {
  const sb = { escapeHtml: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;'), playerInitials: (n) => String(n).slice(0, 2).toUpperCase() };
  const build = new Function(...Object.keys(sb), `${between(appJs, '  function buildMiniMatchHTML(m, firstTeam) {', '  /** V04.35')}\nreturn buildMiniMatchHTML;`)(...Object.values(sb));
  const html = build({ participants: [
    { team: 'A', position: 1, displayName: 'Seba', username: 'seba' }, { team: 'A', position: 2, displayName: 'Remera celeste', isInvitee: true },
    { team: 'B', position: 1, displayName: 'Juan', username: 'juan' }, { team: 'B', position: 2, displayName: 'Pedro' },
  ], sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }] }, 'A');
  assert.match(html, /mini-match__name--invitee">Remera celeste<\/span><span class="mini-match__handle mini-match__handle--pending">Sin cuenta<\/span>/);
  assert.match(html, /@seba/); assert.match(html, /@juan/);
  assert.equal((html.match(/Sin cuenta/g) || []).length, 1, 'solo la identidad invitada se marca (Pedro no es invitado)');
  assert.match(css, /\.mini-match__who \.mini-match__name--invitee\{ color: var\(--gold\)/);
  assert.match(css, /\.mini-match__who \.mini-match__handle--pending\{ color: var\(--gold\)/);
});

test('destinatario: pregunta NEUTRAL (nunca «¿SOS REMERA CELESTE?»), explicación fiel de recuperar varios partidos, lógica de vinculación explícita intacta', () => {
  const fn = between(appJs, '  function askInvitationConfirmation(displayName, token, preview) {', '  /** Tras un SOY YO exitoso');
  assert.doesNotMatch(fn, /¿SOS/);
  assert.match(fn, /'¿JUGASTE ESTE PARTIDO\?' : '¿JUGASTE ESTOS PARTIDOS\?'/);
  assert.match(fn, /Si ese lugar es el tuyo, confirmalo: este partido y \$\{more\} más asociado/);
  assert.match(fn, /Si ese lugar es el tuyo, confirmalo y este partido pasa a tu historial\./);
  // lógica segura sin cambios: SÍ llama claim_provisional_player; NO solo limpia la intención local
  assert.match(fn, /Auth\.claimProvisionalPlayer\(token\)/);
  assert.match(between(fn, 'no.onclick = () =>', 'yes.onclick'), /Store\.clearClaimToken\(\); close\(\); resolve\(\{ outcome: 'declined' \}\);/);
  assert.match(indexHtml, /id="access-invitation-card"[\s\S]*?Creá tu cuenta o iniciá sesión: después te mostramos el partido para que confirmes si jugaste/);
});

test('privacidad: el mensaje compartido no incluye el nombre del invitado; la función HTML no consulta datos; la única lectura pública es get_invitation_card (anon, solo con token)', () => {
  const invite = between(appJs, '  function buildInviteMessage(', '  /** B2 — hoja');
  assert.doesNotMatch(invite, /cleanName|displayName|\.name\b/);
  assert.doesNotMatch(read('api/invitacion.js'), /supabase|createClient|rpc\(|fetch\(/i, 'la función HTML no consulta datos');
  const migs = fs.readdirSync(path.join(root, '..', 'supabase', 'migrations')).filter((f) => f >= '20261014');
  assert.deepEqual(migs, ['20261014190000_v0441_invitation_public_card.sql']);
  const sql = fs.readFileSync(path.join(root, '..', 'supabase', 'migrations', migs[0]), 'utf8');
  assert.match(sql, /revoke all on function public\.get_invitation_card\(text\) from public, anon, authenticated;\ngrant execute on function public\.get_invitation_card\(text\) to anon;/);
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ''), /grant\s+select|create\s+policy|alter\s+table/i, 'ningún permiso de tablas');
});

test('versionado V04.41 / 04.41-h1 en cuarteto + referencias ?v=', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.41', bundle: '04.41-h1' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.41'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.41-h1'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-41-h1'/);
  assert.match(indexHtml, /app\.js\?v=04\.41-h1/); assert.match(read('sw.js'), /app\.js\?v=04\.41-h1/);
  assert.doesNotMatch(indexHtml, /\?v=04\.40-h3/);
});
