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

/* ================= Enlace personal (lado app) ================= */
test('app: /invitacion/{token} (enlaces V04.41-h1) redirige a la captura de siempre /?claim=; la app ya NO contiene funciones ni dependencias de imagen; el SW no intercepta esa ruta', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.deepEqual(v.redirects, [{ source: '/invitacion/:token', destination: '/?claim=:token', permanent: false }]);
  assert.equal(v.functions, undefined);
  assert.deepEqual(v.rewrites, [{ source: '/robots.txt', destination: '/robots.generated.txt' }]);
  assert.match(read('sw.js'), /pathname\.indexOf\('\/invitacion\/'\) === 0\) return;/);
  assert.ok(!fs.existsSync(path.join(root, 'api', 'invitacion.js')) && !fs.existsSync(path.join(root, 'api', 'invitacion-og.mjs')) && !fs.existsSync(path.join(root, 'package.json')), 'la tarjeta vive en bramulab-invite');
  assert.ok(!fs.existsSync(path.join(root, 'assets', 'invitacion-og.png')));
});

function linkBuilder(env) {
  const code = between(appJs, '  function buildInviteLinkUrl(token) {', '  /** Prepara (una sola vez');
  const sb = { window: { location: { origin: 'https://app.test' }, __BRAMU_ENV__: env }, btoa: (x) => Buffer.from(x, 'latin1').toString('base64') };
  return new Function(...Object.keys(sb), `${code}\nreturn buildInviteLinkUrl;`)(...Object.values(sb));
}
test('enlace compartible: con inviteBase → {base}/invitacion/{43 base64url} (recodificación SIN pérdida del MISMO token); sin base → {origen}/invitacion/{hex}', () => {
  const hex = 'a1b2c3d4'.repeat(8);
  const withBase = linkBuilder({ inviteBase: 'https://bramu-i.vercel.app/' })(hex);
  assert.match(withBase, /^https:\/\/bramu-i\.vercel\.app\/invitacion\/[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(withBase.split('/invitacion/')[1], 'base64url').toString('hex'), hex, 'mismo token, solo recodificado');
  assert.ok(withBase.length < 90, `largo ${withBase.length} (antes ~117)`);
  assert.equal(linkBuilder({})(hex), `https://app.test/invitacion/${hex}`);
  assert.equal(linkBuilder(undefined)(hex), `https://app.test/invitacion/${hex}`);
  // un token que no es el formato real nunca se recodifica
  assert.equal(linkBuilder({ inviteBase: 'https://bramu-i.vercel.app' })('xyz'), 'https://app.test/invitacion/xyz');
  // todos los bytes: la recodificación es lossless
  for (const t of ['00'.repeat(32), 'ff'.repeat(32), '0123456789abcdef'.repeat(4)]) assert.equal(Buffer.from(linkBuilder({ inviteBase: 'https://x.vercel.app' })(t).split('/invitacion/')[1], 'base64url').toString('hex'), t);
});

test('build-env: BRAMU_INVITE_BASE es opcional, solo origen https sin ruta; valores raros frenan el build (nada arbitrario llega al bundle)', () => {
  const src = read('scripts/build-env.mjs');
  assert.match(src, /process\.env\.BRAMU_INVITE_BASE/);
  assert.match(src, /\^https:\\\/\\\/\[a-z0-9\]\[a-z0-9\.-\]\*\(:\\d\{1,5\}\)\?\$/);
  assert.match(src, /inviteBase \? `  inviteBase: \$\{JSON\.stringify\(inviteBase\)\},\\n` : ''/);
});

test('el cliente arma el enlace con buildInviteLinkUrl y los ?claim= anteriores siguen capturándose', () => {
  assert.match(between(appJs, '  async function createInviteUrl(', '  /** V04.41 — enlace compartible'), /buildInviteLinkUrl\(created\.token\)/);
  assert.match(between(appJs, '  function captureClaimTokenFromUrl() {', 'if (!cleanToken) return;'), /get\('claim'\)/);
});

/* ================= Hoja + animación ================= */
test('hoja (V04.46): pop-up que crece sin pantalla completa; microhistoria con el componente REAL, estado final como base, sin rótulos por etapa, reduced-motion y ≤ 4 s', () => {
  assert.match(css, /#invite-sheet\{ max-height: 92dvh; overflow-y: auto;[^}]*touch-action: pan-y;/);
  const sheet = between(indexHtml, '<div id="invite-sheet-scrim"', 'V04.29 — RECEPTOR DE UNA INVITACIÓN');
  assert.match(sheet, /<div class="result-card result-card--compact"><div class="result-card__rows" id="invite-anim-rows">/, 'la tarjeta es el componente real .result-card');
  assert.doesNotMatch(sheet.replace(/<!--[\s\S]*?-->/g, ''), />(Sin cuenta|Invitación|Entra|Recupera)</, 'sin cuatro íconos con rótulos ni subtítulos por etapa');
  assert.doesNotMatch(sheet, /class="ia-node|<text[ >]/);
  assert.match(sheet, /id="invite-anim"[^>]*aria-hidden="true"/);
  const anim = between(css, '.invite-anim{ width:100%; }', '@media (prefers-reduced-motion: reduce){\n  .invite-anim.is-playing *');
  // El estado BASE de cada pieza es el final: las animaciones solo cuelgan de `.is-playing`.
  assert.doesNotMatch(anim.replace(/\.invite-anim\.is-playing[^{]*\{[^}]*\}/g, ''), /(^|[{;\s])animation\s*:/, 'sin .is-playing no hay animaciones');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\n  \.invite-anim\.is-playing \*, \.invite-anim\.is-playing \*::before\{ animation: none !important; \}/);
  assert.match(css, /\.ia2-card\{[^}]*box-shadow: 0 0 0 1\.5px rgba\(149,255,25,0\.55\)/, 'estado final: la tarjeta con el aro lima en el historial');
  const durations = [...css.matchAll(/\.invite-anim\.is-playing \.ia2-(?:hist|card|wabig|badge)\{ animation: [\w-]+ ([\d.]+)s/g)].map((m) => Number(m[1]));
  assert.ok(durations.length >= 4 && Math.max(...durations) >= 4 && Math.max(...durations) <= 4.6, `duración ${durations} (breve: ~4,4 s)`);
  // V04.46: UNA sola tarjeta, siempre centrada, tres momentos (partido → WhatsApp verde → historial lima + check); sin avioncito, estela ni desplazamientos
  const card = css.match(/@keyframes ia2-card \{([\s\S]*?)\}\n@keyframes ia2-ring/)[1];
  assert.doesNotMatch(card, /translate\(/, 'la tarjeta no se desplaza lateralmente (solo escala sutil)');
  assert.deepEqual([...card.matchAll(/opacity:(\d(?:\.\d+)?)/g)].map((m) => m[1]).filter((v, i) => i > 0 && v !== '1'), [], 'la tarjeta nunca desaparece ni reaparece: solo aparece al inicio');
  const scales = [...card.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...scales) >= 0.94 && Math.max(...scales) <= 1.05, `escalas ${scales}: sin achicar ni agrandar de más`);
  assert.doesNotMatch(css, /ia2-plane|ia2-trail|ia2-dot|\.ia2-chip/, 'sin avioncito, estela ni píldora');
  assert.doesNotMatch(sheet, /ia2-plane|ia2-trail/);
  assert.match(sheet, /<div class="ia2-card" id="invite-anim-card">[\s\S]*<span class="ia2-wa">\s*<span class="ia2-wabig"><svg viewBox="0 0 24 24"[^>]*aria-hidden="true"><path d="M17\.472 14\.382/, 'la capa de WhatsApp vive DENTRO de la misma tarjeta');
  assert.match(css, /\.ia2-wa\{[^}]*position:absolute; inset:0;[^}]*opacity:0;[^}]*rgba\(9,66,40/, 'tratamiento verde que cubre la tarjeta (estado final sin él)');
  assert.match(css, /\.ia2-wa::before\{[^}]*rgba\(37,211,102,0\.55\)/, 'barrido verde WhatsApp');
  assert.match(css, /\.ia2-wabig\{[^}]*width:46px; height:46px;[^}]*background:#25D366;/, 'ícono oficial de WhatsApp, grande y centrado');
  assert.match(css, /\.invite-anim\.is-playing \.ia2-wa\{ animation: ia2-wa 4\.4s ease-in-out/, 'el verde se disuelve gradualmente');
  assert.match(css, /@keyframes ia2-ring[\s\S]*?rgba\(37,211,102,0\.95\)[\s\S]*?rgba\(149,255,25,0\.95\)/, 'borde: verde WhatsApp → lima BRAMUlab');
  assert.match(css, /@keyframes ia2-hist \{ 0%,56%\{opacity:0;/, 'el entorno del historial se revela alrededor');
  assert.doesNotMatch(sheet.replace(/<!--[\s\S]*?-->/g, '').replace(/<path[^>]*>/g, ''), />\s*(WhatsApp|Enviado|Enviando|Entregado)/i, 'sin textos ni confirmación funcional de envío');
  // lenguaje de movimiento de la web: el mismo ease
  assert.match(css, /cubic-bezier\(\.22,\.8,\.24,1\)/);
});

test('hoja (V04.46): composición limpia — todo centrado, WhatsApp principal, «Compartir de otra manera» como texto discreto y aclaración chica al pie', () => {
  assert.match(css, /\.invite-sheet__body\{ align-items: stretch; text-align: center;/);
  assert.match(css, /\.invite-sheet__more\{[^}]*background:none; border:0;[^}]*text-decoration: underline;/);
  assert.match(css, /\.invite-sheet__note\{[^}]*font-size: 11\.5px;[^}]*text-align: center;/);
  const sheet = between(indexHtml, '<div id="invite-sheet-scrim"', 'V04.29 — RECEPTOR DE UNA INVITACIÓN');
  const order = ['id="invite-anim"', 'id="invite-sheet-text"', 'id="invite-sheet-wa-btn"', 'id="invite-sheet-share-btn"', 'id="invite-sheet-note"'].map((k) => sheet.indexOf(k));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'título → animación → frase → WhatsApp → secundaria → aclaración');
  assert.ok(order.every((i) => i > 0));
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
  assert.match(indexHtml, /id="access-invitation-card"[\s\S]*?Hay un partido esperando para sumarse a tu historial\. Entrá y confirmá si jugaste para recuperarlo/);
});

test('privacidad: el mensaje compartido no incluye el nombre del invitado; la función HTML no consulta datos; la única lectura pública es get_invitation_card (anon, solo con token)', () => {
  const invite = between(appJs, '  function buildInviteMessage(', '  /** B2 — hoja');
  assert.doesNotMatch(invite, /cleanName|displayName|\.name\b/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, '..', 'bramulab-invite', 'api', 'invitacion.js'), 'utf8'), /supabase|createClient|rpc\(|fetch\(/i, 'la función HTML no consulta datos');
  const migs = fs.readdirSync(path.join(root, '..', 'supabase', 'migrations')).filter((f) => f >= '20261014');
  assert.deepEqual(migs, ['20261014190000_v0441_invitation_public_card.sql']);
  const sql = fs.readFileSync(path.join(root, '..', 'supabase', 'migrations', migs[0]), 'utf8');
  assert.match(sql, /revoke all on function public\.get_invitation_card\(text\) from public, anon, authenticated;\ngrant execute on function public\.get_invitation_card\(text\) to anon;/);
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ''), /grant\s+select|create\s+policy|alter\s+table/i, 'ningún permiso de tablas');
});

test('versionado V04.50 en cuarteto (número de producto simple, sin sufijos h1/h2) + referencias ?v=', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.50', bundle: '04.50' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.50'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.50'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-50'/);
  assert.match(indexHtml, /app\.js\?v=04\.50"/); assert.match(read('sw.js'), /app\.js\?v=04\.50'/);
  assert.doesNotMatch(indexHtml, /\?v=04\.4[01]-h\d/);
});
