// BRAMUlab — V04.29: invitados / invitación / vinculación de identidad / posibles duplicados (cliente).
// Ejecutar con: node --test bramulab/v0429-invitados-identidad.test.mjs
// Backend: supabase/tests/verify-g3-identity-recovery.sql (+ .mjs de concurrencia) y
// supabase/functions/_shared/identity-recovery-core.test.mjs (E2E con motor real).
//
// app.js no es cargable tal cual (DOM + IIFE): el bloque V04.29 se EJECUTA extraído por marcadores, con un DOM/Auth/Store falsos
// (mismo método que v0418/v0419), más guardas estáticas de orden/estructura y de copy visible.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const authJs = read('auth.js');
const indexHtml = read('index.html');
const cssText = read('styles.css');

function between(src, start, end) {
  const a = src.indexOf(start); assert.ok(a >= 0, `no se encontró: ${start.slice(0, 70)}`);
  const b = src.indexOf(end, a + start.length); assert.ok(b >= 0, `no se encontró fin: ${end.slice(0, 70)}`);
  return src.slice(a, b);
}

/* ================= 1. copy y estructura (HTML) ================= */
test('Resumen: sección JUGADORES SIN CUENTA con fila + INVITAR (oculta por defecto, nunca en un borrador local)', () => {
  assert.match(indexHtml, /<section class="analysis-section guests-section" id="analysis-guests" hidden>[\s\S]*?JUGADORES SIN CUENTA[\s\S]*?id="analysis-guests-list"/);
  const fn = between(appJs, '  async function renderAnalysisGuests(f) {', '  /** B2 — hoja');
  assert.match(fn, /INVITAR/);
  assert.match(fn, /f\.serverBacked/);
  assert.match(fn, /sync_pending/);
  assert.match(fn, /listRelatedProvisionalPlayers/);
});

test('Hoja de invitar: título "INVITÁ A {NOMBRE} A BRAMU", texto aprobado, CTA COPIAR INVITACIÓN, sin botón de WhatsApp', () => {
  const sheet = between(indexHtml, '<div id="invite-sheet-scrim"', 'V04.29 — RECEPTOR DE UNA INVITACIÓN');
  assert.match(sheet, />COPIAR INVITACIÓN</);
  assert.doesNotMatch(sheet, /whatsapp/i, 'sin botón específico de WhatsApp');
  const open = between(appJs, '  function openInviteSheet(playerId, name, sourceMatchId) {', '  function closeInviteSheet() {');
  assert.match(open, /INVITÁ A \$\{cleanName\.toLocaleUpperCase\('es-AR'\)\} A BRAMU/);
  assert.match(open, /Compartile esta invitación para que pueda sumarse a BRAMU y recuperar sus partidos\. La invitación es personal: enviásela solo a \$\{cleanName\}\./);
  assert.match(appJs, /Invitación copiada\. Enviásela a \$\{cur\.name\}\./);
});

test('Receptor: "¿SOS {NOMBRE}?" con SOY YO / NO SOY YO y el texto aprobado; duplicados con los dos CTA aprobados', () => {
  const recv = between(indexHtml, '<div id="invitation-confirm-overlay"', 'V04.29 — POSIBLE PARTIDO DUPLICADO');
  assert.match(recv, />SÍ, SOY YO</);
  assert.match(recv, />NO, NO SOY YO</);
  assert.match(recv, /Hay partidos registrados con esta identidad\. Si sos vos, podés vincularlos a tu cuenta\./);
  assert.match(appJs, /`¿SOS \$\{String\(displayName \|\| 'este jugador'\)\.toLocaleUpperCase\('es-AR'\)\}\?`/);
  const dup = between(indexHtml, '<div id="duplicate-match-overlay"', 'id="confirm-overlay"');
  assert.match(dup, /ENCONTRAMOS DOS PARTIDOS QUE PODRÍAN SER EL MISMO/);
  assert.match(dup, />SÍ, ES EL MISMO</);
  assert.match(dup, />NO, SON DOS PARTIDOS DISTINTOS</);
});

test('Copy visible: nunca "reclamar"/"resolución manual"/"fusionar" (el término técnico claim solo vive en código)', () => {
  const visible = (src) => src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const html = visible(indexHtml);
  assert.doesNotMatch(html, /reclam|fusion|resoluci[oó]n manual/i);
  const app = visible(appJs);
  assert.doesNotMatch(app, /showToast\([^)]*(reclam|manualmente|fusion)/i);
  assert.doesNotMatch(app, /se resuelve manualmente durante el piloto/);
  assert.doesNotMatch(app, /Reclamaste la invitaci/);
  assert.doesNotMatch(app, /account_already_registered|account_already_claimed_identity/, 'la cuenta existente ya NO se envía a resolución manual');
});

/* ================= 2. flujos (código real con DOM/Auth/Store falsos) ================= */
function makeEnv({ token = 'a'.repeat(64), auth = {}, store = {}, matches = {}, serverBacked = true } = {}) {
  const els = {};
  const mkEl = () => ({
    hidden: false, textContent: '', innerHTML: '', value: '', disabled: false, dataset: {}, onclick: null, _l: {},
    classList: { add() {}, remove() {}, toggle() {} }, addEventListener(t, f) { this._l[t] = f; }, querySelectorAll() { return []; }, focus() {}, select() {},
  });
  const $ = (sel) => (els[sel] = els[sel] || mkEl());
  const log = { toasts: [], calls: [], cleared: 0 };
  const Store = Object.assign({ _token: token, loadClaimToken() { return this._token; }, clearClaimToken() { this._token = null; log.cleared += 1; }, cacheServerUser() { log.calls.push('cacheServerUser'); } }, store);
  const Auth = Object.assign({
    isConfigured: () => true,
    previewClaimLink: async () => ({ ok: true, displayName: 'Pedro' }),
    claimProvisionalPlayer: async () => ({ ok: true, recoveryId: 'r1', matchCount: 2, levelPending: true, duplicateCandidates: 0 }),
    createClaimLink: async () => ({ ok: true, token: 'tok123' }),
    getIdentityRecoveryStatus: async () => ({ ok: true, pendingLevelRecoveries: 0, openDuplicateCandidates: 0 }),
    processIdentityRecovery: async () => ({ ok: true, results: [{ status: 'completed', applied: 2 }] }),
    listDuplicateMatchCandidates: async () => ({ ok: true, candidates: [] }),
    resolveDuplicateMatchCandidate: async () => ({ ok: true }),
    fetchOwnProfile: async () => ({ levelState: { status: 'CALIBRANDO' } }),
  }, auth);
  const Matches = Object.assign({ isConfigured: () => true, listRelatedProvisionalPlayers: async () => ({ ok: true, players: [] }) }, matches);
  const sb = {
    $, Store, Auth, Matches, log, console,
    showToast: (m) => log.toasts.push(m),
    escapeHtml: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    refreshServerMatches: async () => { log.calls.push('refreshServerMatches'); },
    renderPlayerHome() { log.calls.push('renderPlayerHome'); }, renderHistory() { log.calls.push('renderHistory'); },
    syncServerLevelState() { log.calls.push('syncServerLevelState'); },
    isServerBackedSession: () => serverBacked, analysisCurrent: null, currentUserId: 'me', MSync: null,
    window: { location: { origin: 'https://app.test', pathname: '/bramulab/' } },
    navigator: {}, requestAnimationFrame: (f) => f(), setTimeout, Promise, Map, Set, String, Array, Intl, Date, Blob, JSON, Math,
  };
  const code = between(appJs, '  const INVITATION_ERROR_TEXT = {', '  function initInvitationFlow() {');
  const fnNames = ['renderAnalysisGuests', 'openInviteSheet', 'copyInviteLink', 'handlePendingInvitation', 'syncIdentityRecovery', 'promptDuplicateCandidates', 'buildDuplicateMatchCardHTML', 'refreshAfterIdentityChange'];
  const factory = new Function(...Object.keys(sb), `${code}\nreturn { ${fnNames.join(', ')}, setAnalysis(v) { analysisCurrent = v; } };`);
  const fns = factory(...Object.values(sb));
  sb.setAnalysis = fns.setAnalysis;
  return { fns, els, $, log, Store, Auth, sb };
}

test('JUGADORES SIN CUENTA: lista solo a los invitados invitables de ESTE partido; nada si es local/outbox/sin invitados', async () => {
  const f = { matchId: 'm1', serverBacked: true, status: 'validated', players: [{ userId: 'prov1', name: 'Pedro' }, { userId: 'u2', name: 'Seba' }, { userId: null, name: 'Por identificar' }] };
  const env = makeEnv({ matches: { listRelatedProvisionalPlayers: async () => ({ ok: true, players: [{ player_id: 'prov1', display_name: 'Pedro' }, { player_id: 'otro', display_name: 'Otro' }] }) } });
  env.fns.setAnalysis(f);
  await env.fns.renderAnalysisGuests(f);
  assert.equal(env.$('#analysis-guests').hidden, false);
  const html = env.$('#analysis-guests-list').innerHTML;
  assert.match(html, /Pedro/); assert.match(html, />INVITAR A PEDRO</);
  assert.doesNotMatch(html, /Seba|Otro/);
  for (const bad of [{ ...f, serverBacked: false }, { ...f, status: 'sync_pending' }, { ...f, status: 'necesita_revision' }]) {
    env.fns.setAnalysis(bad);
    await env.fns.renderAnalysisGuests(bad);
    assert.equal(env.$('#analysis-guests').hidden, true);
  }
  const none = makeEnv();
  none.fns.setAnalysis(f);
  await none.fns.renderAnalysisGuests(f);
  assert.equal(none.$('#analysis-guests').hidden, true, 'sin invitados relacionados no se muestra nada');
});

test('INVITAR: abre la hoja con el nombre en mayúsculas; COPIAR INVITACIÓN genera el link personal, lo copia y confirma por nombre', async () => {
  const written = [];
  const env = makeEnv();
  env.sb.navigator.clipboard = { write: async (items) => { written.push(await items[0]._p); }, writeText: async (t) => written.push(t) };
  env.sb.window.ClipboardItem = undefined;
  // El código usa window.ClipboardItem: se prueba primero el camino writeText.
  env.fns.openInviteSheet('prov1', 'Pedro');
  assert.equal(env.$('#invite-sheet-title').textContent, 'INVITÁ A PEDRO A BRAMU');
  assert.match(env.$('#invite-sheet-text').textContent, /enviásela solo a Pedro\.$/);
  await env.fns.copyInviteLink();
  assert.deepEqual(written, ['https://app.test/bramulab/?claim=tok123']);
  assert.equal(env.$('#invite-sheet-feedback').textContent, 'Invitación copiada. Enviásela a Pedro.');
  assert.equal(env.$('#invite-sheet-feedback').hidden, false);
  assert.equal(env.$('#invite-sheet-link').hidden, true);
});

test('COPIAR ENLACE: sin portapapeles muestra el enlace para copia manual; errores del servidor se explican sin romper', async () => {
  const manual = makeEnv();
  manual.fns.openInviteSheet('prov1', 'Pedro');
  await manual.fns.copyInviteLink();
  assert.equal(manual.$('#invite-sheet-link').hidden, false);
  assert.equal(manual.$('#invite-sheet-link').value, 'https://app.test/bramulab/?claim=tok123');
  assert.match(manual.$('#invite-sheet-feedback').textContent, /Copiá la invitación y enviásela a Pedro\./);

  for (const [code, re] of [['rate_limited', /muchas invitaciones seguidas/], ['provisional_not_found', /ya no está disponible/], ['unknown', /No pudimos generar la invitación/]]) {
    const env = makeEnv({ auth: { createClaimLink: async () => ({ ok: false, code }) } });
    env.fns.openInviteSheet('prov1', 'Pedro');
    await env.fns.copyInviteLink();
    assert.match(env.$('#invite-sheet-feedback').textContent, re);
    // V04.31: si la identidad ya no está disponible, la CTA queda deshabilitada (no parece válida); el resto permite reintentar.
    assert.equal(env.$('#invite-sheet-copy-btn').disabled, code === 'provisional_not_found');
  }
});

test('¿Sos {nombre}?: preview inválido/vencido/revocado/usado limpia la intención y avisa; preview transitorio la CONSERVA', async () => {
  for (const code of ['claim_invalid', 'claim_expired', 'claim_revoked', 'claim_already_used']) {
    const env = makeEnv({ auth: { previewClaimLink: async () => ({ ok: false, code }) } });
    const r = await env.fns.handlePendingInvitation({ onboardingDone: true });
    assert.equal(r.outcome, 'invalid');
    assert.equal(env.Store._token, null);
    assert.equal(env.log.toasts.length, 1);
  }
  const transient = makeEnv({ auth: { previewClaimLink: async () => ({ ok: false, code: 'rate_limited' }) } });
  const r = await transient.fns.handlePendingInvitation({ onboardingDone: true });
  assert.equal(r.outcome, 'transient');
  assert.equal(transient.Store._token, 'a'.repeat(64), 'la intención no se pierde ante un fallo transitorio');
  const none = makeEnv({ token: null });
  assert.equal((await none.fns.handlePendingInvitation({})).outcome, 'none');
});

test('NO SOY YO: solo limpia la intención local — NO llama a claim_provisional_player (no consume ni revoca el enlace)', async () => {
  let claimCalls = 0;
  const env = makeEnv({ auth: { claimProvisionalPlayer: async () => { claimCalls += 1; return { ok: true }; } } });
  const p = env.fns.handlePendingInvitation({ onboardingDone: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(env.$('#invitation-confirm-overlay').hidden, false, 'se muestra el modal');
  assert.equal(env.$('#invitation-confirm-title').textContent, '¿SOS PEDRO?');
  env.$('#invitation-confirm-no').onclick();
  const r = await p;
  assert.equal(r.outcome, 'declined');
  assert.equal(claimCalls, 0, 'NO SOY YO jamás consume el enlace');
  assert.equal(env.Store._token, null);
  assert.equal(env.$('#invitation-confirm-overlay').hidden, true);
});

test('SOY YO: vincula, limpia la intención y, con la cuenta completa, refresca partidos/Nivel y procesa el Nivel recuperado', async () => {
  const env = makeEnv({ auth: { getIdentityRecoveryStatus: async () => ({ ok: true, pendingLevelRecoveries: 1, openDuplicateCandidates: 0 }) } });
  let processed = 0;
  env.Auth.processIdentityRecovery = async () => { processed += 1; return { ok: true, results: [{ status: 'completed', applied: 2 }] }; };
  const p = env.fns.handlePendingInvitation({ onboardingDone: true });
  await new Promise((r) => setTimeout(r, 0));
  await env.$('#invitation-confirm-yes').onclick();
  const r = await p;
  assert.equal(r.outcome, 'linked');
  assert.equal(env.Store._token, null);
  assert.equal(processed, 1, 'dispara el replay de Nivel server-side');
  assert.ok(env.log.calls.includes('refreshServerMatches'));
  assert.ok(env.log.toasts.some((t) => /Vinculamos tus partidos/.test(t)));
  assert.ok(env.log.toasts.some((t) => /Sumamos tus partidos recuperados a tu Nivel/.test(t)));
});

test('SOY YO en un alta nueva (onboardingDone:false): vincula sin refrescar partidos/Nivel (eso pasa al oficializar el Nivel)', async () => {
  const env = makeEnv();
  const p = env.fns.handlePendingInvitation({ onboardingDone: false });
  await new Promise((r) => setTimeout(r, 0));
  await env.$('#invitation-confirm-yes').onclick();
  assert.equal((await p).outcome, 'linked');
  assert.ok(!env.log.calls.includes('refreshServerMatches'));
});

test('SOY YO con identity_conflict (V04.31): estado corto "No podés vincular…" con ENTENDIDO — el modal ya no queda atrapado en SÍ/NO; la intención local se limpia', async () => {
  const env = makeEnv({ auth: { claimProvisionalPlayer: async () => ({ ok: false, code: 'identity_conflict', conflicts: [{ matchId: 'm1' }] }) } });
  const p = env.fns.handlePendingInvitation({ onboardingDone: true });
  await new Promise((r) => setTimeout(r, 0));
  await env.$('#invitation-confirm-yes').onclick();
  assert.equal(env.$('#invitation-confirm-error').hidden, false);
  assert.match(env.$('#invitation-confirm-error').textContent, /No podés vincular esta identidad porque ya figurás en uno de sus partidos\./);
  assert.equal(env.$('#invitation-confirm-actions').hidden, true, 'SÍ/NO desaparecen');
  assert.equal(env.$('#invitation-confirm-conflict-actions').hidden, false, 'queda ENTENDIDO');
  assert.equal(env.Store._token, 'a'.repeat(64), 'hasta tocar ENTENDIDO no se tocó nada');
  env.$('#invitation-confirm-conflict-ok').onclick();
  assert.equal((await p).outcome, 'conflict');
  assert.equal(env.Store._token, null);
});

test('SOY YO con error definitivo (usado/vencido) limpia y avisa; con error transitorio deja reintentar dentro del modal', async () => {
  const def = makeEnv({ auth: { claimProvisionalPlayer: async () => ({ ok: false, code: 'claim_already_used' }) } });
  const p1 = def.fns.handlePendingInvitation({ onboardingDone: true });
  await new Promise((r) => setTimeout(r, 0));
  await def.$('#invitation-confirm-yes').onclick();
  assert.equal((await p1).outcome, 'invalid');
  assert.equal(def.Store._token, null);

  let n = 0;
  const tr = makeEnv({ auth: { claimProvisionalPlayer: async () => (++n === 1 ? { ok: false, code: 'unknown' } : { ok: true, matchCount: 0 }) } });
  const p2 = tr.fns.handlePendingInvitation({ onboardingDone: false });
  await new Promise((r) => setTimeout(r, 0));
  await tr.$('#invitation-confirm-yes').onclick();
  assert.equal(tr.$('#invitation-confirm-error').hidden, false);
  assert.equal(tr.Store._token, 'a'.repeat(64));
  await tr.$('#invitation-confirm-yes').onclick();
  assert.equal((await p2).outcome, 'linked');
});

test('Un segundo disparo concurrente reutiliza el mismo flujo (nunca dos modales a la vez)', async () => {
  const env = makeEnv();
  const a = env.fns.handlePendingInvitation({ onboardingDone: true });
  const b = env.fns.handlePendingInvitation({ onboardingDone: true });
  assert.equal(a, b);
  await new Promise((r) => setTimeout(r, 0));
  env.$('#invitation-confirm-no').onclick();
  await a;
});

test('Posibles duplicados: pregunta uno por uno, SÍ/NO resuelven server-side y refrescan; un error permite "Decidir después"', async () => {
  const cand = { candidateId: 'c1', matches: [
    { matchId: 'm1', playedAt: '2026-09-20T22:30:00.000Z', playedAtTimeKnown: true, locationName: 'Club Norte', participants: [{ team: 'A', position: 1, displayName: 'Seba' }, { team: 'A', position: 2, displayName: 'Pedro' }, { team: 'B', position: 1, displayName: 'Matu' }, { team: 'B', position: 2, displayName: 'Lucho' }], sets: [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 3 }] },
    { matchId: 'm2', playedAt: '2026-09-20T22:45:00.000Z', playedAtTimeKnown: false, participants: [], sets: [] },
  ] };
  const queue = [[cand], []];
  const resolved = [];
  const env = makeEnv({ auth: {
    getIdentityRecoveryStatus: async () => ({ ok: true, pendingLevelRecoveries: 0, openDuplicateCandidates: 1 }),
    listDuplicateMatchCandidates: async () => ({ ok: true, candidates: queue.shift() || [] }),
    resolveDuplicateMatchCandidate: async (id, d) => { resolved.push([id, d]); return { ok: true }; },
  } });
  const p = env.fns.syncIdentityRecovery();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(env.$('#duplicate-match-overlay').hidden, false);
  const cards = env.$('#duplicate-match-list').innerHTML;
  assert.match(cards, /Seba y Pedro vs Matu y Lucho/);
  assert.match(cards, /6-4  ·  6-3/);
  assert.match(cards, /Club Norte/);
  await env.$('#duplicate-match-same-btn').onclick();
  await p;
  assert.deepEqual(resolved, [['c1', 'same']]);
  assert.ok(env.log.calls.includes('refreshServerMatches'));
  assert.equal(env.$('#duplicate-match-overlay').hidden, true);
  assert.ok(env.log.toasts.some((t) => /Unificamos los dos partidos en uno/.test(t)));

  // NO conserva ambos; y un error muestra "Decidir después" sin trampa.
  let fail = true;
  const q2 = [[cand], [cand]];
  const env2 = makeEnv({ auth: {
    getIdentityRecoveryStatus: async () => ({ ok: true, pendingLevelRecoveries: 0, openDuplicateCandidates: 1 }),
    listDuplicateMatchCandidates: async () => ({ ok: true, candidates: q2.shift() || [] }),
    resolveDuplicateMatchCandidate: async () => (fail ? { ok: false, code: 'unknown' } : { ok: true }),
  } });
  const p2 = env2.fns.syncIdentityRecovery();
  await new Promise((r) => setTimeout(r, 5));
  await env2.$('#duplicate-match-different-btn').onclick();
  assert.equal(env2.$('#duplicate-match-error').hidden, false);
  assert.equal(env2.$('#duplicate-match-later-btn').hidden, false);
  env2.$('#duplicate-match-later-btn').onclick();
  await p2;
  assert.equal(env2.$('#duplicate-match-overlay').hidden, true);
  fail = false;
});

test('syncIdentityRecovery: sin sesión server-backed o con otro sync en curso no hace nada; un fallo de red nunca lanza', async () => {
  const off = makeEnv({ serverBacked: false });
  await off.fns.syncIdentityRecovery();
  assert.equal(off.log.calls.length, 0);
  const boom = makeEnv({ auth: { getIdentityRecoveryStatus: async () => { throw new Error('red'); } } });
  await boom.fns.syncIdentityRecovery(); // no lanza
});

/* ================= 3. contrato de auth.js ================= */
function loadAuth(rpcImpl, fnImpl) {
  const sb = { console, Object, Array, String, Number, Promise, JSON, Math };
  sb.window = sb; sb.globalThis = sb; sb.location = { hostname: 'localhost' };
  sb.__BRAMU_ENV__ = { name: 'staging', supabaseUrl: 'https://x.test', supabaseAnonKey: 'anon' };
  sb.supabase = { createClient: () => ({ auth: {}, rpc: async (n, a) => rpcImpl(n, a), functions: { invoke: async (n, o) => fnImpl(n, o) }, from: () => ({}) }) };
  vm.createContext(sb); vm.runInContext(authJs, sb);
  return sb.PLAuth;
}

test('auth.js: previewClaimLink/claimProvisionalPlayer/status/process/duplicados mapean el contrato del servidor', async () => {
  const calls = [];
  const A = loadAuth(async (name, args) => {
    calls.push([name, args]);
    switch (name) {
      case 'preview_claim_link': return { data: args.p_token === 'ok' ? { ok: true, code: 'claim_valid', displayName: 'Pedro' } : { ok: false, code: 'claim_expired' }, error: null };
      case 'claim_provisional_player': return args.p_token === 'ok'
        ? { data: { ok: true, code: 'recovered', recoveryId: 'r1', matchCount: 3, levelPending: true, duplicateCandidates: 1 }, error: null }
        : { data: { ok: false, code: 'identity_conflict', conflicts: [{ matchId: 'm1' }] }, error: null };
      case 'get_my_identity_recovery_status': return { data: { pendingLevelRecoveries: 2, openDuplicateCandidates: 1 }, error: null };
      case 'list_my_duplicate_match_candidates': return { data: { ok: true, candidates: [{ candidateId: 'c1' }] }, error: null };
      case 'resolve_duplicate_match_candidate': return { data: { ok: true, code: 'merged' }, error: null };
      default: return { data: null, error: { message: 'boom' } };
    }
  }, async (name) => (name === 'process-identity-recovery' ? { data: { ok: true, results: [{ status: 'completed' }] }, error: null } : { data: null, error: { message: 'x' } }));
  assert.deepEqual(JSON.parse(JSON.stringify(await A.previewClaimLink('ok'))), { ok: true, displayName: 'Pedro', matchCount: 0, sourceIsOrigin: false, sourceMatch: null });
  assert.deepEqual(JSON.parse(JSON.stringify(await A.previewClaimLink('bad'))), { ok: false, code: 'claim_expired' });
  const ok = JSON.parse(JSON.stringify(await A.claimProvisionalPlayer('ok')));
  assert.deepEqual(ok, { ok: true, recoveryId: 'r1', matchCount: 3, levelPending: true, duplicateCandidates: 1, idempotentReturn: false });
  const conflict = JSON.parse(JSON.stringify(await A.claimProvisionalPlayer('bad')));
  assert.equal(conflict.ok, false); assert.equal(conflict.code, 'identity_conflict'); assert.equal(conflict.conflicts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(await A.getIdentityRecoveryStatus())), { ok: true, pendingLevelRecoveries: 2, openDuplicateCandidates: 1 });
  assert.equal((await A.listDuplicateMatchCandidates()).candidates.length, 1);
  assert.equal((await A.resolveDuplicateMatchCandidate('c1', 'same')).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find((c) => c[0] === 'resolve_duplicate_match_candidate')[1])), { p_candidate_id: 'c1', p_decision: 'same' });
  assert.equal((await A.processIdentityRecovery()).results.length, 1);
  // el cliente nunca elige al jugador de la recuperación: el body va vacío (el servidor lo deriva del JWT)
});

/* ================= 4. orden del flujo en app.js ================= */
test('Auth y retorno: la invitación se confirma con sesión real DESPUÉS de autenticarse (login y alta) y ya no hay camino manual', () => {
  const rs = between(appJs, '  async function resumeServerSession(opts) {', '  /** Backend Bloque 4 — captura');
  assert.match(rs, /handlePendingInvitation\(\{ onboardingDone: true \}\)/);
  assert.match(rs, /syncIdentityRecovery\(\)/);
  assert.ok(rs.indexOf('enforceLegalGate') < rs.indexOf('handlePendingInvitation({ onboardingDone: true })'), 'primero Legal, después la invitación');
  assert.match(rs, /handlePendingInvitation\(\{ onboardingDone: false \}\)/, 'cuenta con sesión todavía armando su alta también ve la invitación');
  const run = between(appJs, '  async function runOfficializeAndEnter() {', '  /** Backend Bloque 3 — cachea `user.levelState`');
  assert.ok(run.indexOf('handlePendingInvitation') < run.indexOf('Auth.completeProfile'), 'la invitación se resuelve ANTES de complete_profile/Nivel');
  assert.match(run, /outcome === 'transient'[\s\S]{0,120}signupStep = 'verify'[\s\S]{0,120}return;/, 'un fallo transitorio no avanza (conserva token y borrador)');
  assert.ok(run.indexOf('syncIdentityRecovery()') > run.indexOf('Auth.officializeLevel'), 'el Nivel recuperado se procesa DESPUÉS del Nivel base');
  const boot = between(appJs, '  async function bootWithServerSession() {', '  document.addEventListener(\'DOMContentLoaded\'');
  // V04.30 — el aviso fugaz se reemplazó por una card contextual persistente en Acceso (renderAccessInvitationCard).
  assert.match(appJs, /function renderAccessInvitationCard\(\)/);
  assert.match(indexHtml, /id="access-invitation-card"/);
  assert.doesNotMatch(boot, /NO agregar campo manual/);
  // no hay campo manual de token en Perfil
  assert.doesNotMatch(indexHtml, /id="[a-z-]*claim[a-z-]*-input"/);
});

test('Resumen y arranque: renderAnalysis pinta Jugadores sin cuenta; initInvitationFlow se cablea en el boot', () => {
  assert.match(between(appJs, '  function renderAnalysis(f) {', '  /** Bloque S2/V5'), /renderAnalysisGuests\(f\);/);
  assert.match(appJs, /initB6ActionsSection\(\);\n    initInvitationFlow\(\);/);
  assert.match(cssText, /\.guests-row__btn\{/);
});

/* ================= 5. V04.29-h2 — duplicados con score distinto ================= */
test('h2 · SÍ con score distinto NO afirma "Unificamos": avisa que el resultado quedó pendiente de la otra pareja; con merged sí unifica', async () => {
  const cand = { candidateId: 'c1', matches: [{ matchId: 'm1', playedAt: '2026-09-20T22:30:00.000Z', participants: [], sets: [] }, { matchId: 'm2', playedAt: '2026-09-20T22:45:00.000Z', participants: [], sets: [] }] };
  for (const [code, re, notRe] of [['merge_pending_confirmation', /pendiente de confirmación de la otra pareja/, /Unificamos/], ['merged', /Unificamos los dos partidos en uno/, /pendiente de confirmación/]]) {
    const queue = [[cand], []];
    const env = makeEnv({ auth: {
      getIdentityRecoveryStatus: async () => ({ ok: true, pendingLevelRecoveries: 0, openDuplicateCandidates: 1 }),
      listDuplicateMatchCandidates: async () => ({ ok: true, candidates: queue.shift() || [] }),
      resolveDuplicateMatchCandidate: async () => ({ ok: true, code }),
    } });
    const p = env.fns.syncIdentityRecovery();
    await new Promise((r) => setTimeout(r, 5));
    await env.$('#duplicate-match-same-btn').onclick();
    await p;
    const toast = env.log.toasts.join(' | ');
    assert.match(toast, re); assert.doesNotMatch(toast, notRe);
  }
});

test('h2 · errores de negocio del ancla (corrección/identidad pendiente) se explican y dejan "Decidir después"', async () => {
  const cand = { candidateId: 'c1', matches: [] };
  const env = makeEnv({ auth: {
    getIdentityRecoveryStatus: async () => ({ ok: true, pendingLevelRecoveries: 0, openDuplicateCandidates: 1 }),
    listDuplicateMatchCandidates: async () => ({ ok: true, candidates: [cand] }),
    resolveDuplicateMatchCandidate: async () => ({ ok: false, code: 'correction_already_pending' }),
  } });
  const p = env.fns.syncIdentityRecovery();
  await new Promise((r) => setTimeout(r, 5));
  await env.$('#duplicate-match-same-btn').onclick();
  assert.match(env.$('#duplicate-match-error').textContent, /corrección o una identidad pendiente/);
  assert.equal(env.$('#duplicate-match-later-btn').hidden, false);
  env.$('#duplicate-match-later-btn').onclick();
  await p;
});

test('h2 · una corrección de origen duplicado no vence a los 3 días (cliente) y la ordinaria conserva exactamente la ventana', () => {
  const win = between(appJs, '  function b6CorrectionWindowOpen(f) {', '  function b6IdentityReportWindowOpen');
  assert.match(win, /b6WindowStillOpen\(f\.validatedAt, 3\)/);
  assert.match(win, /pendingCorrectionOrigin === 'duplicate' && !!f\.pendingCorrectionRevisionId/);
  const sandbox = { window: {}, console };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  sandbox.PLStore = {}; sandbox.PLEngine = {};
  vm.createContext(sandbox);
  vm.runInContext(read('player-home.js'), sandbox);
  const PH = sandbox.PLPlayerHome;
  const old = new Date(Date.now() - 20 * 86400000).toISOString();
  assert.equal(PH.hasActiveCorrectionWindow({ status: 'validated', pendingCorrectionRevisionId: 'r', validatedAt: old, pendingCorrectionOrigin: 'duplicate' }), true);
  assert.equal(PH.hasActiveCorrectionWindow({ status: 'validated', pendingCorrectionRevisionId: 'r', validatedAt: old, pendingCorrectionOrigin: null }), false);
  assert.equal(PH.hasActiveCorrectionWindow({ status: 'validated', pendingCorrectionRevisionId: 'r', validatedAt: new Date().toISOString() }), true);
});

test('h2 · matches.js y match-sync.js propagan pendingCorrectionOrigin desde get_my_matches y get_match_detail', () => {
  assert.match(read('matches.js'), /pendingCorrectionOrigin: row\.pending_correction_origin \|\| null/);
  assert.match(read('match-sync.js'), /pendingCorrectionOrigin: row\.pendingCorrectionOrigin \|\| null/);
  assert.match(read('version.json'), /04\.36-h1/);
});
