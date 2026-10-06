// BRAMUlab — V04.34: corrección final post QA humano de V04.33 (handoff 131, Issue #29), lado CLIENTE.
// Ejecutar con: node --test bramulab/v0434-cierre-qa.test.mjs
// Backend (decisión durable "ES OTRO PARTIDO"): supabase/functions/_shared/v0434-duplicados.test.mjs (PGlite, todas las migraciones).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const cssText = read('styles.css');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261006100000_v0434_persist_different_duplicate_decision.sql'), 'utf8');

function fnSrc(name) {
  const re = new RegExp(`(?:async )?function ${name}\\(`);
  const m = re.exec(appJs); assert.ok(m, `no existe function ${name}`);
  let i = appJs.indexOf('{', appJs.indexOf(')', m.index)); let depth = 0; let k = i;
  for (; k < appJs.length; k += 1) { if (appJs[k] === '{') depth += 1; else if (appJs[k] === '}') { depth -= 1; if (!depth) break; } }
  return appJs.slice(m.index, k + 1);
}
function loadModule(file, global) {
  const sandbox = { console }; sandbox.window = sandbox; Object.assign(sandbox, global || {});
  vm.createContext(sandbox); vm.runInContext(read(file), sandbox, { filename: file }); return sandbox;
}
const MSync = loadModule('match-sync.js', {}).PLMatchSync;
const NOW = new Date('2026-10-06T15:00:00.000Z');

/* ============ 1. Partidos pendientes = pantalla propia (fuera de Historial) ============ */
test('Pendientes · ya NO es una pestaña de Historial: pantalla propia con las 3 secciones; Home, gate y CTAs la abren', () => {
  const tabs = appJs.match(/const HISTORY_STATUS_TABS = \[([\s\S]*?)\];/)[1];
  assert.deepEqual([...tabs.matchAll(/key:\s*'([a-z]+)'/g)].map((m) => m[1]), ['todos', 'victorias', 'derrotas', 'ocultos'], 'Historial conserva Todos/Victorias/Derrotas/Ocultos');
  // Recuperados sigue siendo un filtro temporal válido DENTRO de Historial
  assert.match(fnSrc('getHistoryTabs'), /key: 'recuperados', label: 'Recuperados'/);
  const view = indexHtml.slice(indexHtml.indexOf('<section id="view-pending"'), indexHtml.indexOf('</section>', indexHtml.indexOf('<section id="view-pending"')));
  assert.match(view, /PARTIDOS PENDIENTES/); assert.match(view, /id="pending-list"/); assert.match(view, /No tenés partidos pendientes\./);
  assert.match(appJs, /'recovered', 'pending'\]/, 'la vista se registra en showView');
  assert.match(appJs.match(/const BOTTOM_NAV_VIEWS = \[[^\]]*\]/)[0], /'pending'/);
  const render = fnSrc('renderPendingScreen');
  assert.match(render, /renderPendingSections\(wrap, PH\.filterMatchesForPlayer\(getDisplayHistory\(\), currentIdentity\(\)\), 'pending'\)/);
  const sections = fnSrc('renderPendingSections');
  assert.match(sections, /PH\.computePendingBuckets\(list, new Date\(\)\)/, 'misma derivación única que Home');
  const order = ["title: 'POR VALIDAR'", "title: 'POR RESOLVER'", "title: 'ESPERANDO VALIDACIÓN'"].map((t) => appJs.indexOf(t));
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], 'POR VALIDAR → POR RESOLVER → ESPERANDO VALIDACIÓN');
  // entradas: card de Home, gate de 5, y ningún CTA viejo hacia la pestaña
  assert.match(appJs, /const openPending = \(\) => openPendingScreen\(\);/);
  assert.match(appJs, /const goToPending = \(\) => openPendingScreen\(\);/);
  assert.doesNotMatch(appJs, /openHistoryScreen\('player-home', null, 'pendientes'\)/);
  assert.match(fnSrc('openPendingScreen'), /showView\('pending'\)/);
  // volver → origen normal (Home) y el Resumen vuelve a ESTA lista con su scroll
  assert.match(fnSrc('initPendingScreen'), /pending-back-btn'\)\.addEventListener\('click', \(\) => openPlayerHome\(\)\)/);
  assert.match(fnSrc('openCanonicalResumen'), /openedFrom === 'pending'/);
  assert.match(appJs, /if \(from === 'pending'\) renderPendingScreen\(\); else renderHistory\(\)/);
});

/* ============ 2. Quick card: sin badge redundante, mismos botones que el Resumen ============ */
function buildCardWith(cat, o, m) {
  const inserted = [];
  const fakeEl = () => ({ className: '', dataset: {}, children: [], appendChild(c) { this.children.push(c); }, insertAdjacentHTML(_p, h) { inserted.push(h); }, addEventListener() {}, querySelectorAll: () => [] });
  const sb = {
    document: { createElement: fakeEl }, PH: { classifyPendingCategory: () => cat },
    buildHistoryItemElement: () => fakeEl(), qvStateBadge: (mm, c) => ({ po: { label: 'POR VALIDAR', mod: 'action' }, es: { label: 'ESPERANDO VALIDACIÓN', mod: 'waiting' } }[c === 'por_validar' ? 'po' : c === 'esperando' ? 'es' : 'x'] || { label: 'JUGADOR POR IDENTIFICAR', mod: 'identity' }),
    qvOpenResumen() {}, qvValidate() {},
  };
  new Function(...Object.keys(sb), 'm', 'o', `${fnSrc('buildQuickMatchCard')}\nbuildQuickMatchCard(m, o);`)(...Object.values(sb), m || {}, o);
  return inserted.join('');
}
test('Quick card · dentro de POR VALIDAR / ESPERANDO el badge redundante se quita; POR RESOLVER conserva su descriptor; Recuperados puede conservarlo', () => {
  const pv = buildCardWith('por_validar', { hideBadge: true }); assert.doesNotMatch(pv, /history-item__badge/);
  const es = buildCardWith('esperando', { hideBadge: true }); assert.doesNotMatch(es, /history-item__badge/); assert.doesNotMatch(es, /data-qv/, 'ESPERANDO: sin acciones');
  const pr = buildCardWith('por_resolver', { hideBadge: true }, { hasOpenIdentityIssue: true });
  assert.match(pr, /JUGADOR POR IDENTIFICAR/); assert.match(pr, /Revisá este partido para confirmar quién jugó\./);
  assert.match(buildCardWith('por_validar', {}), /POR VALIDAR<\/span>/, 'Recuperados (sin hideBadge) puede conservarlo');
});
test('Quick card · mismos botones y casing que el Resumen; POR RESOLVER usa "Revisar partido" azul; el verde macizo es solo el feedback ✓', () => {
  const pv = buildCardWith('por_validar', { hideBadge: true });
  assert.match(pv, /b6-correction-choice b6-correction-choice--report" data-qv="report">Reportar un error</);
  assert.match(pv, /b6-correction-choice b6-correction-choice--accept" data-qv="validate">Validar partido</);
  assert.doesNotMatch(pv, /REPORTAR|VALIDAR/, 'sin mayúsculas integrales');
  const pr = buildCardWith('por_resolver', {}, { hasOpenIdentityIssue: false });
  assert.match(pr, /b6-correction-choice--review" data-qv="open">Revisar partido</);
  assert.doesNotMatch(pr, /RESOLVER/, 'la lista no promete una acción específica');
  assert.match(cssText, /\.b6-correction-choice--review\{[^}]*var\(--accent-cyan\)/);
  assert.match(cssText, /\.qv-card__actions \.b6-correction-choice\{[^}]*min-height: 48px; font-size: 13px; font-weight: 700/, 'misma altura/tipografía que .pv-foot');
  assert.match(cssText, /\.qv-card__done\{[^}]*background: var\(--brand-lime\)/, 'el verde sólido queda reservado al feedback transitorio');
  assert.match(fnSrc('renderRecoveredMatchesScreen'), /hideBadge: true/, 'la pantalla post-claim ya dice N PARTIDOS NECESITAN TU RESPUESTA');
});

/* ============ 3. Resumen: mi equipo SIEMPRE arriba y verde (desde ambos lados), sin tocar Team A/B ============ */
test('Resumen · mi pareja arriba y verde desde AMBOS lados del mismo partido; GANADORES sigue siendo la pareja ganadora real; datos A/B intactos', () => {
  const sb = { S: { teamLabel: (players, t) => players.filter((p) => p.team === t).map((p) => p.name).join(' / ') }, escapeHtml: (x) => String(x) };
  const rows = new Function(...Object.keys(sb), `${fnSrc('buildResultRowsHTML')}\nreturn buildResultRowsHTML;`)(...Object.values(sb));
  const players = [{ team: 'A', name: 'Seba' }, { team: 'A', name: 'Matu' }, { team: 'B', name: 'Lucho' }, { team: 'B', name: 'Nico' }];
  const sets = [{ gamesA: 6, gamesB: 2 }, { gamesA: 6, gamesB: 4 }];
  const order = (html) => [...html.matchAll(/data-team="([AB])"/g)].map((m) => m[1]);
  // Usuario Team A (Seba): A arriba. Usuario Team B (Lucho): B arriba — el MISMO partido.
  assert.deepEqual(order(rows(players, sets, null, 'A')), ['A', 'B']);
  assert.deepEqual(order(rows(players, sets, null, 'B')), ['B', 'A']);
  assert.deepEqual(order(rows(players, sets, null, undefined)), ['A', 'B'], 'sin dato: orden canónico (share/otros usos intactos)');
  // los números de cada fila siguen siendo los de SU equipo (no se invierte score/winner)
  const nums = (html, team) => { const seg = html.slice(html.indexOf(`data-team="${team}"`)); return [...seg.slice(0, seg.indexOf('</div>')).matchAll(/result-card__set[^"]*">(\d)/g)].map((m) => m[1]).join(''); };
  const asB = rows(players, sets, null, 'B');
  assert.equal(nums(asB, 'A'), '66'); assert.equal(nums(asB, 'B'), '24');
  // presentación: firstTeam solo sale de mi pareja; los colores salen de la clase team-mine-b (A↔B variables), no de datos
  const first = new Function('PH', 'currentIdentity', `${fnSrc('presentationFirstTeam')}\nreturn presentationFirstTeam;`)({ getPlayerTeam: (f) => f.mine }, () => ({}));
  assert.equal(first({ players: [], mine: 'A' }), 'A'); assert.equal(first({ players: [], mine: 'B' }), 'B'); assert.equal(first({ players: [], mine: null }), 'A');
  assert.match(cssText, /#view-analysis\.team-mine-b\{ --team-a: var\(--accent-cyan\)[^}]*--team-b: var\(--brand-lime\)/);
  assert.match(fnSrc('buildResultBlockHTML'), /firstTeam: opts\.mineFirst \? presentationFirstTeam\(f\) : null/);
  assert.match(fnSrc('buildWinnersBannerHTML'), /f\.winnerTeam === 'A' \? nameA : nameB/, 'GANADORES = la pareja ganadora canónica');
  assert.match(fnSrc('renderAnalysis'), /buildResultBlockHTML\(f, \{ officialLabelHTML, mineFirst: true \}\)/);
  assert.doesNotMatch(fnSrc('buildResultRowsHTML'), /winnerTeam|myTeam/, 'la primitiva de filas no toca ganador ni Team A/B');
});

/* ============ 4. Resumen: título de estado, validación inline ============ */
function paintCard(mode, opts) {
  const html = [];
  const card = { classList: { add() {} }, insertAdjacentHTML: (_p, h) => html.push(h), querySelector: () => null };
  const sb = {
    $: () => card, b6ReportErrorAvailability: () => ({ result: true, participant: true }), escapeHtml: (x) => x, resumenValidateInline() {},
  };
  new Function(...Object.keys(sb), 'o', `${fnSrc('paintPendingInResultCard')}\npaintPendingInResultCard({}, '${mode}', 'Lucho / Nico', o);`)(...Object.values(sb), opts);
  return html.join('');
}
test('Resumen · PARTIDO POR VALIDAR / ESPERANDO VALIDACIÓN ocupan el mismo lugar arriba de GANADORES; la espera ya no repite un párrafo', () => {
  const act = paintCard('act', {}); assert.match(act, /^<p class="pv-title">PARTIDO POR VALIDAR<\/p>/);
  const wait = paintCard('wait', {}); assert.match(wait, /^<p class="pv-title">ESPERANDO VALIDACIÓN<\/p>/);
  assert.doesNotMatch(wait, /está esperando validación|pv-foot|pv-divider/, 'sin párrafo ni divisor redundante');
  assert.match(paintCard('wait', { waitText: 'Participante corregido. Esperando que X confirme el partido.' }), /Participante corregido/, 'un contexto específico sí se conserva');
  // ambos títulos se insertan 'afterbegin' (antes de ganadores/grilla)
  const body = fnSrc('paintPendingInResultCard');
  assert.equal([...body.matchAll(/insertAdjacentHTML\('afterbegin'/g)].length, 2);
  // la línea meta no repite el estado del pendiente
  assert.doesNotMatch(fnSrc('buildAnalysisMetaLines'), /Por validar|Esperando validación|Pendiente de validación/);
});
test('Resumen · VALIDAR PARTIDO usa el feedback inline ✓ PARTIDO VALIDADO (sin modal/toast); error real o confirmed_not_ready no fingen éxito', async () => {
  const run = async (officialize) => {
    const log = { toasts: [], after: [], strip: null, events: [] };
    const buttons = [{ disabled: false }, { disabled: false }];
    const foot = { isConnected: true, className: 'pv-foot b6-correction-choices', querySelectorAll: () => buttons, set innerHTML(v) { log.strip = v; log.events.push('strip'); } };
    const sb = {
      analysisCurrent: { matchId: 'M1' }, document: { querySelector: () => foot }, MV: { officializeMatch: async () => officialize() },
      showToast: (t) => log.toasts.push(t), b6ErrorMessage: (c) => `ERR:${c}`, qvSleep: async () => { log.events.push('sleep'); }, qvReducedMotion: () => false, QV_DONE_MS: 0,
      afterB6Action: async (id) => { log.after.push(id); log.events.push('after'); },
    };
    const f = new Function(...Object.keys(sb), `let resumenValidating = false;\n${fnSrc('resumenValidateInline')}\nreturn resumenValidateInline;`)(...Object.values(sb));
    await f(); await f(); // doble tap secuencial: el segundo no debe disparar otra oficialización si el primero sigue en vuelo (aquí ya terminó)
    return { log, buttons };
  };
  const ok = await run(() => ({ ok: true, code: 'officialized' }));
  assert.match(ok.log.strip, /✓ PARTIDO VALIDADO/); assert.deepEqual(ok.log.toasts, [], 'sin toast ni modal de éxito');
  assert.deepEqual(ok.log.events.slice(0, 3), ['strip', 'sleep', 'after'], 'franja → pausa → relee y repinta el Resumen ya validado');
  const err = await run(() => ({ ok: false, code: 'not_actionable_for_caller' }));
  assert.equal(err.log.strip, null); assert.deepEqual(err.log.after, []); assert.ok(err.log.toasts.every((t) => t === 'ERR:not_actionable_for_caller'));
  assert.equal(err.buttons.every((b) => b.disabled === false), true, 'acciones intactas ante un error real');
  const nr = await run(() => ({ ok: true, code: 'confirmed_not_ready' }));
  assert.equal(nr.log.strip, null, 'no se finge validado'); assert.ok(nr.log.after.length >= 1);
  // el botón del Resumen delega en la validación inline (no en #b6-confirm-btn con toast)
  assert.match(fnSrc('paintPendingInResultCard'), /validateBtn\.addEventListener\('click', \(\) => resumenValidateInline\(\)\)/);
  assert.match(cssText, /\.pv-foot > \.qv-card__done/);
});

/* ============ 5. Identidad en el Resumen ============ */
test('Resumen · incidencia de identidad: JUGADOR POR IDENTIFICAR + texto breve + CTA azul IDENTIFICAR JUGADOR (sin "Por identificar" + "Jugador por identificar" + RESOLVER)', () => {
  const paint = fnSrc('paintB6Actions');
  assert.match(paint, /<p class="b6-identity__title">JUGADOR POR IDENTIFICAR<\/p><p class="b6-identity__text">Revisá este partido para confirmar quién jugó\.<\/p>/);
  assert.match(paint, /b6-correction-choice--review b6-identity-cta[^`]*>IDENTIFICAR JUGADOR/);
  assert.doesNotMatch(paint, /btn-mini|b6-identity-row|>RESOLVER<|<small>Jugador por identificar<\/small>/);
  assert.match(paint, /openIdentityResolveSheet\(\{\s*issueId: btn\.dataset\.issueId/, 'abre el mismo flujo de identificación existente');
  assert.match(cssText, /\.b6-action-block--identity\{[^}]*rgba\(255,201,61/, 'atención/pendiente (ámbar), no rojo de error');
  assert.match(cssText, /\.b6-identity__title\{[^}]*color: var\(--gold\)/);
});

/* ============ 6. Home ============ */
test('Home · carrusel con altura fija (título 1 línea, cuerpo máx. 2 con ellipsis); card PARTIDOS PENDIENTES ámbar unificada', () => {
  assert.match(cssText, /\.player-home-carousel-card--accionable, \.player-home-carousel-card--correccion\{ height: 84px; box-sizing: border-box; overflow: hidden; \}/);
  assert.match(cssText, /carousel-card__label\{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
  assert.match(cssText, /-webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;/);
  assert.match(cssText, /\.pending-matches-card \.pastilla__title\{ color: var\(--gold\); \}/);
  assert.match(cssText, /\.pending-matches-card__num\{[^}]*color: var\(--gold\)/, 'los tres números ámbar');
  assert.doesNotMatch(cssText, /pending-matches-card__num--(validar|resolver)/, 'sin semáforo');
  assert.match(cssText, /\.pending-matches-card__label\{[^}]*color: var\(--paper-dim\)/, 'labels en gris claro');
  assert.match(cssText, /\.pending-matches-card\{[^}]*border-color: rgba\(255,201,61/);
});

/* ============ 7. Recuperados / Intelligence ============ */
test('Recuperados · texto introductorio corto; BRAMU Intelligence pendiente con la misma jerarquía sutil que su subtítulo', () => {
  assert.match(fnSrc('renderRecoveredTabList'), /Estos partidos llegaron a tu cuenta al vincular a \$\{names\.length \? names\.join\(' y '\) : 'tu identidad'\}\. Esta pestaña estará disponible durante 30 días\./);
  assert.doesNotMatch(fnSrc('renderRecoveredTabList'), /Reportar un error/);
  assert.match(cssText, /\.intelligence-text p\.intelligence-frame--pending[^{]*\{[^}]*font-size: 12px[^}]*color: var\(--paper-faint\)[^}]*font-style: italic/);
  assert.match(cssText, /\.intelligence-frame\{ font-size: 12px; color: var\(--paper-faint\); font-style: italic;/, 'el subtítulo de referencia no cambió');
});

/* ============ 8. Duplicados: pre-check temprano + modal ============ */
const base = { formatId: 'classic', validationDeadlineAt: '2026-10-20T00:00:00Z', playedAtTimeKnown: true };
const row = (id, o) => Object.assign({ matchId: id, status: 'validated', playedAt: '2026-10-06T12:00:00Z', participants: [
  { playerId: 'e', team: 'A', position: 1 }, { playerId: 'g', team: 'A', position: 2 }, { playerId: 's', team: 'B', position: 1 }, { playerId: 'l', team: 'B', position: 2 }] }, base, o || {});
const draft = { pair1PlayerIds: ['s', 'l'], pair2PlayerIds: ['e', 'g'], playedAtIso: '2026-10-06T13:00:00Z', playedAtTimeKnown: true, formatId: 'classic' };
test('Pre-check · findPossibleDuplicateCandidates: mismas 4 personas y MISMAS parejas (en cualquier lado/orden), formato, estado vivo y ventana temporal', () => {
  const ids = (rows, d) => MSync.findPossibleDuplicateCandidates(rows, d || draft, NOW).map((r) => r.matchId).join(',');
  assert.equal(ids([row('m1')]), 'm1', 'el caso real: parejas invertidas respecto del existente');
  assert.equal(ids([row('m1', { status: 'pending_validation' })]), 'm1');
  assert.equal(ids([row('m1', { status: 'pending_validation', validationDeadlineAt: '2026-10-01T00:00:00Z' })]), '', 'pendiente vencido: nunca candidato');
  assert.equal(ids([row('m1', { status: 'expired' }), row('m2', { status: 'annulled' })]), '');
  assert.equal(ids([row('m1', { formatId: 'americano' })]), '', 'otro formato');
  assert.equal(ids([row('m1', { playedAt: '2026-10-06T17:00:01Z' })]), '', 'fuera de ±3 h con horas conocidas');
  assert.equal(ids([row('m1', { playedAt: '2026-10-06T16:00:00Z' })]), 'm1', 'justo en el borde (±3 h)');
  assert.equal(ids([row('m1', { playedAt: '2026-10-06T22:00:00Z', playedAtTimeKnown: false })]), 'm1', 'hora desconocida: mismo día en Buenos Aires');
  assert.equal(ids([row('m1', { playedAt: '2026-10-07T12:00:00Z', playedAtTimeKnown: false })]), '', 'otro día');
  // otras parejas con las mismas 4 personas = otro encuentro (no candidato)
  assert.equal(ids([row('m1', { participants: [{ playerId: 'e', team: 'A' }, { playerId: 's', team: 'A' }, { playerId: 'g', team: 'B' }, { playerId: 'l', team: 'B' }] })]), '');
  // slot por identificar / jugadores distintos
  assert.equal(ids([row('m1', { participants: [{ playerId: 'e', team: 'A' }, { playerId: null, team: 'A' }, { playerId: 's', team: 'B' }, { playerId: 'l', team: 'B' }] })]), '');
  assert.equal(ids([row('m1')], Object.assign({}, draft, { pair2PlayerIds: ['e', 'x'] })), '');
  assert.equal(ids([row('m1')], Object.assign({}, draft, { playedAtIso: null })), '');
  // más reciente primero
  assert.equal(ids([row('old', { playedAt: '2026-10-06T11:00:00Z' }), row('new', { playedAt: '2026-10-06T13:00:00Z' })]), 'new,old');
});
function precheckEnv(o) {
  const log = { modal: null, discard: 0, resumen: [], closed: 0 };
  const sb = {
    manualServerBacked: true, manualEditingMatchId: null, MSync, Matches: {}, isServerBackedSession: () => true, manualForceNewKey: o.key || null,
    manualPlayerIds: { a1: { playerId: 's' }, a2: { playerId: 'l' }, b1: { playerId: 'e' }, b2: { playerId: 'g' } },
    manualSelectedFormatId: 'classic', ML: { buildPlayedAtFromLocalFields: () => ({ iso: '2026-10-06T13:00:00Z', timeKnown: true }) },
    $: () => ({ value: 'x' }), refreshServerMatches: async () => {}, qvSleep: () => new Promise(() => {}),
    Store: { loadServerMatchesCache: () => ({ matches: o.rows || [] }) },
    openDuplicateDecisionModal: (m) => { log.modal = m; }, closeAmbiguousMatchModal: () => { log.closed += 1; }, discardManualDraft: () => { log.discard += 1; },
    openServerMatchResumen: async (id) => { log.resumen.push(id); },
  };
  const f = new Function(...Object.keys(sb), `${fnSrc('manualRosterKey')}\n${fnSrc('manualDuplicatePrecheck')}\nreturn { manualDuplicatePrecheck, manualRosterKey, getKey: () => manualForceNewKey };`)(...Object.values(sb));
  return { f, log };
}
test('Pre-check · sin candidato sigue normal; con candidato: ES ESTE PARTIDO abre el existente y descarta la carga; ES OTRO PARTIDO continúa y queda recordado; CANCELAR no avanza', async () => {
  const none = precheckEnv({ rows: [] });
  assert.equal(await none.f.manualDuplicatePrecheck(), true); assert.equal(none.log.modal, null);
  // ES ESTE PARTIDO
  const same = precheckEnv({ rows: [row('m1')] });
  const p1 = same.f.manualDuplicatePrecheck(); await new Promise((r) => setTimeout(r, 0));
  assert.equal(same.log.modal.existingMatchId, 'm1');
  await same.log.modal.onSame(); assert.equal(await p1, false);
  assert.equal(same.log.discard, 1); assert.deepEqual(same.log.resumen, ['m1']);
  // ES OTRO PARTIDO: sigue al resultado y recuerda la decisión para ESTE plantel
  const other = precheckEnv({ rows: [row('m1')] });
  const p2 = other.f.manualDuplicatePrecheck(); await new Promise((r) => setTimeout(r, 0));
  other.log.modal.onOther(); assert.equal(await p2, true);
  assert.equal(other.f.getKey(), other.f.manualRosterKey(), 'decisión ligada al plantel');
  // CANCELAR
  const cancel = precheckEnv({ rows: [row('m1')] });
  const p3 = cancel.f.manualDuplicatePrecheck(); await new Promise((r) => setTimeout(r, 0));
  cancel.log.modal.onCancel(); assert.equal(await p3, false); assert.equal(cancel.log.discard, 0);
  // ya decidido para este plantel: no vuelve a preguntar
  const decided = precheckEnv({ rows: [row('m1')], key: 's|l|e|g' });
  assert.equal(await decided.f.manualDuplicatePrecheck(), true); assert.equal(decided.log.modal, null);
  // no aplica a ediciones ni a cuentas sin backend
  const sbOff = precheckEnv({ rows: [row('m1')] });
  assert.match(fnSrc('manualDuplicatePrecheck'), /!manualServerBacked \|\| manualEditingMatchId \|\| !MSync \|\| !Matches \|\| !isServerBackedSession\(\)\) return true/);
  void sbOff;
});
test('Pre-check · el flujo pasa por él ANTES del resultado, la decisión viaja como disambiguationForceNew y el gate backend final NO se quita', () => {
  assert.match(appJs, /\$\('#manual-go-result-btn'\)\.addEventListener\('click', onManualGoResult\)/);
  assert.match(fnSrc('onManualGoResult'), /manualDuplicatePrecheck\(\)[\s\S]*goToManualResultStep\(\)/);
  assert.match(fnSrc('submitManualMatchServerBacked'), /if \(manualForceNewKey && manualForceNewKey === manualRosterKey\(\)\) payload\.disambiguationForceNew = true;/);
  // gate final: el servidor sigue respondiendo validated_match_needs_bloque6_correction / ambiguous_candidates y el cliente los maneja igual
  const outcome = fnSrc('handleCreateOrAttachOutcome');
  assert.match(outcome, /code === 'validated_match_needs_bloque6_correction'[\s\S]*openPossibleDuplicateModal\(entry, existingMatchId\)/);
  assert.match(outcome, /code === 'ambiguous_candidates'[\s\S]*openAmbiguousMatchModal/);
  assert.match(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261006100000_v0434_persist_different_duplicate_decision.sql'), 'utf8'), /validated_match_needs_bloque6_correction/);
  assert.match(fnSrc('forceNewFromAmbiguous'), /disambiguationForceNew: true/);
});
test('Modal de posible duplicado · copy corto, mini-partido, ES ESTE / ES OTRO como decisiones principales y CANCELAR terciario; ES ESTE tras otro score = propuesta de corrección (no sobrescribe)', () => {
  const modal = indexHtml.slice(indexHtml.indexOf('<div id="ambiguous-match-overlay"'), indexHtml.indexOf('</div>\n  </div>\n', indexHtml.indexOf('id="ambiguous-match-cancel"')));
  assert.match(modal, />POSIBLE PARTIDO DUPLICADO</);
  assert.match(modal, /Ya hay un partido cargado con estos jugadores y parejas\. ¿Es este mismo partido\?/);
  const order = ['ambiguous-match-same', 'ambiguous-match-force-new', 'ambiguous-match-cancel'].map((id) => modal.indexOf(`id="${id}"`));
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2]);
  assert.match(modal, /id="ambiguous-match-same" class="btn-start btn-start--overlay"[^>]*>ES ESTE PARTIDO</);
  assert.match(modal, /id="ambiguous-match-force-new" class="btn-secondary"[^>]*>ES OTRO PARTIDO</);
  assert.match(modal, /id="ambiguous-match-cancel" class="link-btn"[^>]*>CANCELAR</, 'terciario/discreto');
  assert.match(fnSrc('openDuplicateDecisionModal'), /buildMiniMatchHTML\(row, row\.myTeam === 'B' \? 'B' : 'A'\)/, 'mismo mini-partido que ¿SOS X?');
  // al guardar con otro score sobre un validado: ES ESTE PARTIDO → corrección propuesta (flujo vigente), nunca sobrescritura silenciosa
  assert.match(fnSrc('openPossibleDuplicateModal'), /onSame: \(\) => resolveSameMatchAsCorrection\(existingMatchId\)/);
  assert.match(fnSrc('resolveSameMatchAsCorrection'), /openProposeCorrection\(/);
  assert.doesNotMatch(fnSrc('resolveSameMatchAsCorrection'), /createOrAttach/);
});

/* ============ 9. Backend: decisión durable "different" (estático; la ejecución real está en supabase/functions/_shared/v0434-duplicados.test.mjs) ============ */
test('Backend · create_or_attach_match persiste resolved_different (par ordenado) reutilizando match_duplicate_candidates; sin tablas nuevas ni cambios de Nivel/Team A-B', () => {
  assert.match(migration, /if p_disambiguation_force_new then\s*\n\s*insert into public\.match_duplicate_candidates/);
  assert.match(migration, /least\(m\.match_id, v_target_match_id\), greatest\(m\.match_id, v_target_match_id\)/, 'simétrico: no depende del orden');
  assert.match(migration, /'resolved_different'/);
  assert.match(migration, /on conflict \(match_low_id, match_high_id\) do update[\s\S]*where public\.match_duplicate_candidates\.status = 'open'/, 'no pisa resolved_same');
  // el ÚNICO cambio respecto de la función vigente (V04.30) es el bloque de persistencia: el resto es idéntico (Nivel, Team A/B, ranking intactos)
  const v0430 = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261004100000_v0430_create_or_attach_idempotent_replay.sql'), 'utf8');
  const fnOf = (sql) => sql.slice(sql.indexOf('create or replace function public.create_or_attach_match('), sql.indexOf('\n$$;\n', sql.indexOf('create or replace function public.create_or_attach_match(')) + 5);
  const patchStart = migration.indexOf('    -- V04.34 — DECISIÓN DURABLE');
  const patchEnd = migration.indexOf('    v_result := jsonb_build_object(\n      \'ok\', true, \'code\', \'created\'');
  const patch = migration.slice(patchStart, patchEnd);
  assert.ok(patchStart > 0 && patchEnd > patchStart);
  assert.equal(fnOf(migration).replace(patch, ''), fnOf(v0430), 'solo se agregó el bloque de persistencia');
  assert.doesNotMatch(patch, /level_states|ranking_|winner_team|team_a|team_b|update public\.matches/i);
  assert.doesNotMatch(migration.slice(0, migration.indexOf('create or replace function public.create_or_attach_match(')) + migration.slice(migration.lastIndexOf('\n$$;\n')), /create table|alter table|drop /i);
  assert.match(migration, /create or replace function public\.create_or_attach_match\(/);
  assert.ok(fs.existsSync(path.join(__dirname, '../supabase/functions/_shared/v0434-duplicados.test.mjs')));
});
