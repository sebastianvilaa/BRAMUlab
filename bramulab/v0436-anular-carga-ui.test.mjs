// BRAMUlab V04.36 — "Anular carga" (cliente): wrapper de red, traducción de `canAnnulSubmission`, markup, copy y flujo del modal.
// El contrato server-side (elegibilidad, invisibilidad, idempotencia, sin notificaciones) lo prueba
// supabase/functions/_shared/v0436-anular-carga.test.mjs sobre Postgres real (PGlite). Ejecutar con: node --test bramulab/v0436-anular-carga-ui.test.mjs
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const app = read('app.js'); const html = read('index.html'); const css = read('styles.css');
const MATCH_ID = '8d1f3c1e-0a53-4a6e-9b7d-2f0f4c0a9e11';

function loadMatches(rpc) {
  const sb = {};
  sb.window = sb; vm.createContext(sb);
  sb.PLAuth = { isConfigured: () => true, getClient: () => ({ rpc }) };
  vm.runInContext(read('matches.js'), sb, { filename: 'matches.js' });
  return sb.PLMatches;
}
function loadSync() { const sb = {}; sb.window = sb; vm.createContext(sb); for (const f of ['engine.js', 'match-sync.js']) vm.runInContext(read(f), sb, { filename: f }); return sb.PLMatchSync; }

test('UI-1) Matches.annulMySubmission: llama a la RPC con el id, devuelve lo que decide el servidor y no inventa éxito ante errores', async () => {
  const calls = [];
  const M = loadMatches(async (fn, args) => { calls.push([fn, args]); return { data: { ok: true, code: 'annulled', matchId: args.p_match_id }, error: null }; });
  assert.deepEqual(JSON.parse(JSON.stringify(await M.annulMySubmission(MATCH_ID))), { ok: true, code: 'annulled', matchId: MATCH_ID });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['annul_my_match_submission', { p_match_id: MATCH_ID }]]);
  // Un borrador de outbox (`m_…`) nunca viaja a una RPC que espera UUID.
  assert.equal((await M.annulMySubmission('m_123')).code, 'invalid_match_id'); assert.equal(calls.length, 1);
  const rejected = loadMatches(async () => ({ data: { ok: false, code: 'recognized_by_other' }, error: null }));
  assert.equal((await rejected.annulMySubmission(MATCH_ID)).ok, false);
  assert.equal((await rejected.annulMySubmission(MATCH_ID)).code, 'recognized_by_other');
  const boom = loadMatches(async () => ({ data: null, error: { message: 'network' } }));
  assert.deepEqual(JSON.parse(JSON.stringify(await boom.annulMySubmission(MATCH_ID))), { ok: false, code: 'network' });
  const weird = loadMatches(async () => ({ data: 'x', error: null }));
  assert.equal((await weird.annulMySubmission(MATCH_ID)).ok, false);
});

test('UI-2) match-sync traduce canAnnulSubmission SOLO cuando el servidor lo manda en true (las filas de lista nunca lo habilitan)', () => {
  const S = loadSync();
  const base = {
    matchId: MATCH_ID, status: 'pending_validation', playedAt: '2026-10-05T20:00:00Z', formatId: 'classic',
    myTeam: 'A', createdByPlayerId: 'p1', participants: [{ team: 'A', position: 1, playerId: 'p1', displayName: 'Autor' }, { team: 'A', position: 2, playerId: 'p2', displayName: 'C' }, { team: 'B', position: 1, playerId: 'p3', displayName: 'R1' }, { team: 'B', position: 2, playerId: 'p4', displayName: 'R2' }],
    sets: [{ setNumber: 1, gamesA: 6, gamesB: 4 }, { setNumber: 2, gamesA: 6, gamesB: 3 }],
  };
  assert.equal(S.translateServerMatchToLocalShape({ ...base, canAnnulSubmission: true }).canAnnulSubmission, true);
  assert.equal(S.translateServerMatchToLocalShape({ ...base, canAnnulSubmission: false }).canAnnulSubmission, false);
  assert.equal(S.translateServerMatchToLocalShape(base).canAnnulSubmission, false);
  assert.equal(S.translateServerMatchToLocalShape({ ...base, canAnnulSubmission: 'true' }).canAnnulSubmission, false);
});

test('UI-3) markup: "Anular carga" vive DEBAJO de "Reportar un error", con menor jerarquía (texto destructivo rojo, sin botón lleno) y oculto por defecto', () => {
  const iReport = html.indexOf('id="b6-report-error-block"'); const iAnnul = html.indexOf('id="b6-annul-block"');
  assert.ok(iReport > 0 && iAnnul > iReport, 'el bloque de anular viene justo después del de reportar');
  assert.match(html, /<div class="b6-annul-block" id="b6-annul-block" hidden>\s*<button type="button" class="b6-annul-btn" id="b6-annul-btn">Anular carga<\/button>\s*<\/div>/);
  assert.match(html, /id="b6-report-error-btn" style="width:100%">Reportar un error<\/button>/); // se mantiene
  assert.match(css, /\.b6-annul-block\[hidden\]\{ display:none; \}/);
  assert.match(css, /\.b6-annul-btn\{[^}]*background:none;[^}]*border:none;[^}]*color: var\(--danger\);[^}]*font-size: 13px;/);
  assert.doesNotMatch(css, /\.b6-annul-btn\{[^}]*(background: ?var|border: ?1px)/);
});

test('UI-4) paintB6Actions: el botón solo se ofrece en el pending con canAnnulSubmission (servidor) y siempre se reubica debajo de Reportar un error', () => {
  const paint = app.slice(app.indexOf('function paintB6Actions(f)'), app.indexOf("if (f.status === 'validated') {", app.indexOf('function paintB6Actions(f)')));
  assert.match(paint, /const annulBlock = \$\('#b6-annul-block'\);/);
  assert.match(paint, /annulBlock\.hidden = true;/); // reset por render: nunca queda visible de un partido anterior
  assert.match(paint, /\$\('#analysis-share-section'\)\.after\(reportErrorBlock\);\s*reportErrorBlock\.after\(annulBlock\);/);
  assert.match(paint, /annulBlock\.hidden = !\(f\.canAnnulSubmission === true && f\.serverBacked && Matches && Matches\.isServerMatchId\(f\.matchId\)\);\s*reportErrorBlock\.after\(annulBlock\);\s*return;/);
  // Nada de inferir elegibilidad en el cliente: no se mira createdByPlayerId/acciones para decidirlo.
  assert.doesNotMatch(app.slice(app.indexOf('annulBlock.hidden = !('), app.indexOf('annulBlock.hidden = !(') + 200), /createdByPlayerId|actionsRaw/);
  // No aparece en estados que no son pending (validated/expired/annulled/outbox): solo hay UNA asignación visible.
  assert.equal((app.match(/annulBlock\.hidden = !\(/g) || []).length, 1);
});

test('UI-5) modal y flujo: copy exacto, acción destructiva en rojo, éxito → refresca el feed y sale al Home; rechazo del servidor → explica y relee', () => {
  const fn = app.slice(app.indexOf('function openAnnulSubmissionConfirm()'), app.indexOf('/* ---- Reportar un error (§5)'));
  assert.match(fn, /'¿Anular esta carga\?',\s*'El partido dejará de estar pendiente y no tendrá efectos en BRAMU\.'/);
  assert.match(fn, /null, 'Anular carga', 'Cancelar', true\s*\);/); // aceptar = "Anular carga" (rojo), cancelar = "Cancelar"
  assert.match(fn, /Matches\.annulMySubmission\(f\.matchId\)/);
  assert.match(fn, /if \(result && result\.ok\) \{\s*markSelfActedMatch\(f\.matchId\);\s*await refreshServerMatches\(\);\s*showToast\('Carga anulada'\);\s*openPlayerHome\(\);\s*return;/);
  assert.match(fn, /recognized_by_other' \|\| code === 'not_pending' \|\| code === 'not_author'[\s\S]*await afterB6Action\(f\.matchId\)/);
  assert.match(fn, /annulInFlight/); // doble toque no dispara dos veces
  assert.match(app, /\$\('#b6-annul-btn'\)\.addEventListener\('click', openAnnulSubmissionConfirm\);/);
  // No crea ninguna notificación local ni toca estadísticas/Nivel desde el cliente.
  assert.doesNotMatch(fn, /Store\.(addNotification|saveMatch|removeFromHistory)|notifications?\.push|level/i);
});

test('UI-6) la lista del feed pide ocultos pero el servidor ya excluye las cargas retiradas: refreshServerMatches sigue usando includeHidden y el modal no depende de ello', () => {
  assert.match(app, /Matches\.getMyMatches\(\{ limit: 200, includeHidden: true \}\)/);
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261006200000_v0436_annul_own_submission.sql'), 'utf8');
  assert.match(migration, /and not public\._match_is_author_retracted\(m\.match_id\)/);
});
