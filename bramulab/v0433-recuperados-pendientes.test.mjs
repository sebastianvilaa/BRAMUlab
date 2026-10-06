// BRAMUlab — V04.33: Rediseño de Recuperados + Validación rápida + Partidos pendientes (handoff 129, Issue #29), lado CLIENTE.
// Ejecutar con: node --test bramulab/v0433-recuperados-pendientes.test.mjs
// Backend (source_match_id, preview con origen, get_my_recent_recoveries, notificación identity_recovered): supabase/tests/verify-v0433-recuperados-pendientes.sql
// (corre en PGlite dentro de `supabase/scripts/verify-clean-room.mjs` / release-check).

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
const authJs = read('auth.js');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261005200000_v0433_recuperados_pendientes.sql'), 'utf8');

function between(src, start, end) {
  const a = src.indexOf(start); assert.ok(a >= 0, `no se encontró: ${start.slice(0, 70)}`);
  const b = src.indexOf(end, a + start.length); assert.ok(b >= 0, `no se encontró fin: ${end.slice(0, 70)}`);
  return src.slice(a, b);
}
/** Cuerpo completo (con llaves balanceadas) de `function name(` / `async function name(`. */
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
const PH = loadModule('player-home.js', { PLStore: { normalizePlayerName: (r) => String(r || '').trim().toLowerCase() } }).PLPlayerHome;
const NOW = new Date('2026-10-05T12:00:00.000Z');
const row = (matchId, extra) => Object.assign({ matchId, serverBacked: true, status: 'validated', hidden: false }, extra || {});

/* ============ Derivación ÚNICA de categorías (POR VALIDAR / POR RESOLVER / ESPERANDO) ============ */
test('Pendientes · classifyPendingCategory deriva POR VALIDAR / POR RESOLVER / ESPERANDO de la autoridad server-side (sin estados duplicados)', () => {
  const c = (m) => PH.classifyPendingCategory(m, NOW);
  assert.equal(c(row('a', { status: 'pending_validation', isActionMine: true })), 'por_validar');
  assert.equal(c(row('b', { status: 'pending_validation', isActionMine: false, actionSide: 'B' })), 'esperando');
  // incidencia de identidad abierta (JUGADOR POR IDENTIFICAR) manda sobre el resto, también en un partido ya validado
  assert.equal(c(row('c', { status: 'pending_validation', isActionMine: true, hasOpenIdentityIssue: true })), 'por_resolver');
  assert.equal(c(row('d', { status: 'validated', hasOpenIdentityIssue: true })), 'por_resolver');
  // corrección post-validación activa (3 días) = POR RESOLVER; vencida = nada
  assert.equal(c(row('e', { status: 'validated', pendingCorrectionRevisionId: 'r', validatedAt: '2026-10-04T12:00:00.000Z' })), 'por_resolver');
  assert.equal(c(row('f', { status: 'validated', pendingCorrectionRevisionId: 'r', validatedAt: '2026-09-01T12:00:00.000Z' })), null);
  // lo que NO es una tarea
  assert.equal(c(row('g', { status: 'validated' })), null);
  assert.equal(c(row('h', { status: 'expired' })), null);
  assert.equal(c(row('i', { status: 'annulled' })), null);
  assert.equal(c(row('j', { status: 'sync_pending', isActionMine: true })), null, 'borrador local de outbox');
  assert.equal(c(row('k', { status: 'pending_validation', isActionMine: true, hidden: true })), null);
  assert.equal(c({ matchId: 'l', status: 'pending_validation', isActionMine: true, serverBacked: false }), null);
});

test('Pendientes · computePendingBuckets agrupa en el orden de pantalla y cuenta exactamente lo que ve la card de Home', () => {
  const list = [
    row('w1', { status: 'pending_validation', isActionMine: false, actionSide: 'B' }),
    row('v1', { status: 'pending_validation', isActionMine: true }),
    row('r1', { status: 'validated', hasOpenIdentityIssue: true }),
    row('w2', { status: 'pending_validation', isActionMine: false, actionSide: 'B' }),
    row('v2', { status: 'pending_validation', isActionMine: true }),
    row('ok', { status: 'validated' }),
  ];
  const b = PH.computePendingBuckets(list, NOW);
  assert.equal(JSON.stringify(b.porValidar.map((m) => m.matchId)), JSON.stringify(['v1', 'v2']));
  assert.equal(JSON.stringify(b.porResolver.map((m) => m.matchId)), JSON.stringify(['r1']));
  assert.equal(JSON.stringify(b.esperando.map((m) => m.matchId)), JSON.stringify(['w1', 'w2']), 'se conserva el orden recibido dentro de cada sección');
  assert.equal(JSON.stringify(b.counts), JSON.stringify({ porValidar: 2, porResolver: 1, esperando: 2, total: 5 }));
  assert.equal(PH.computePendingBuckets([], NOW).counts.total, 0, 'total 0 => la card de Home no se muestra');
  // Historial > Pendientes usa la MISMA derivación: la pestaña cuenta exactamente el total de las tres secciones
  const counts = PH.computeHistoryStatusTabCounts(list.map((m) => Object.assign({ players: [] }, m)), { userId: 'me', name: 'Yo' }, NOW);
  assert.equal(counts.pendientes, 5);
});

test('Home · el carrusel superior solo muestra lo accionable (POR VALIDAR / identidad / corrección); ESPERANDO VALIDACIÓN queda fuera', () => {
  const items = PH.computeHomePendingCarouselItems([
    row('w', { status: 'pending_validation', isActionMine: false, actionSide: 'B' }),
    row('c', { status: 'validated', pendingCorrectionRevisionId: 'r', validatedAt: '2026-10-04T12:00:00.000Z' }),
    row('i', { status: 'validated', hasOpenIdentityIssue: true }),
    row('a', { status: 'pending_validation', isActionMine: true }),
  ], NOW);
  assert.equal(JSON.stringify(items.map((x) => `${x.matchId}:${x.kind}`)), JSON.stringify(['a:accionable', 'i:identidad', 'c:correccion']));
  const carousel = fnSrc('renderPlayerHomeCarousel');
  assert.doesNotMatch(carousel, /REVISÁ TUS PARTIDOS RECUPERADOS|isRecoveredReviewPending|data-recovered/, 'la tarjeta de recuperados del carrusel se reemplaza por la card + notificación');
  assert.match(carousel, /label = 'JUGADOR POR IDENTIFICAR'/);
  assert.match(carousel, /Revisá este partido para confirmar quién jugó\./);
});

test('Home · card PARTIDOS PENDIENTES: 3 columnas (POR VALIDAR / ESPERANDO / POR RESOLVER), ámbar, antes de BUSCAR JUGADORES, abre Historial > Pendientes, oculta con total 0', () => {
  const card = between(indexHtml, 'id="player-home-pending-card"', 'id="player-home-search-players-card"');
  assert.ok(indexHtml.indexOf('id="player-home-pending-card"') < indexHtml.indexOf('id="player-home-search-players-card"'));
  const order = ['POR VALIDAR', 'ESPERANDO', 'POR RESOLVER'].map((t) => card.indexOf(`>${t}<`));
  assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], 'orden de columnas');
  assert.match(card, /PARTIDOS PENDIENTES/);
  assert.match(cssText, /\.pending-matches-card__icon\{[^}]*stroke: var\(--gold\)/, 'icono de atención ámbar, no rojo de error');
  const render = fnSrc('renderPlayerHomePendingCard');
  assert.match(render, /PH\.computePendingBuckets\(displayMatches \|\| \[\], new Date\(\)\)\.counts/);
  assert.match(render, /card\.hidden = counts\.total === 0/);
  // ejecución real con DOM mínimo
  const els = {};
  const $ = (sel) => (els[sel] = els[sel] || { hidden: true, textContent: '', setAttribute() {} });
  new Function('$', 'PH', `${render}\nrenderPlayerHomePendingCard([{matchId:'1',serverBacked:true,status:'pending_validation',isActionMine:true},{matchId:'2',serverBacked:true,status:'pending_validation',isActionMine:false,actionSide:'B'},{matchId:'3',serverBacked:true,status:'pending_validation',isActionMine:false,actionSide:'B'},{matchId:'4',serverBacked:true,status:'validated',hasOpenIdentityIssue:true}]);`)($, PH);
  assert.equal(els['#player-home-pending-card'].hidden, false);
  assert.equal(els['#player-home-pending-validar'].textContent, '1');
  assert.equal(els['#player-home-pending-esperando'].textContent, '2');
  assert.equal(els['#player-home-pending-resolver'].textContent, '1');
  new Function('$', 'PH', `${render}\nrenderPlayerHomePendingCard([]);`)($, PH);
  assert.equal(els['#player-home-pending-card'].hidden, true, 'total 0: no se muestra');
  // V04.34: abre la pantalla PROPIA de Partidos pendientes (ya no Historial)
  assert.match(appJs, /const openPending = \(\) => openPendingScreen\(\);\s*\n\s*\$\('#player-home-pending-card'\)\.addEventListener\('click', openPending\)/);
});

/* ============ Lenguaje unificado de estados ============ */
test('Copy · POR VALIDAR / ESPERANDO VALIDACIÓN / JUGADOR POR IDENTIFICAR reemplazan TU TURNO: CONFIRMAR / IDENTIDAD CUESTIONADA / PENDIENTE DE VALIDACIÓN', () => {
  const label = fnSrc('serverMatchStatusLabel');
  const lbl = new Function(`${label}\nreturn serverMatchStatusLabel;`)();
  assert.equal(lbl({ serverBacked: true, status: 'pending_validation', isActionMine: true }), 'POR VALIDAR');
  assert.equal(lbl({ serverBacked: true, status: 'pending_validation', isActionMine: false }), 'ESPERANDO VALIDACIÓN');
  assert.equal(lbl({ serverBacked: true, status: 'pending_validation', hasOpenIdentityIssue: true }), 'JUGADOR POR IDENTIFICAR');
  assert.equal(lbl({ serverBacked: true, status: 'validated', pendingCorrectionRevisionId: 'r' }), 'CORRECCIÓN PROPUESTA');
  assert.doesNotMatch(appJs.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'), /'TU TURNO: CONFIRMAR'|'IDENTIDAD CUESTIONADA'|'PENDIENTE DE VALIDACIÓN'/);
  assert.match(appJs, /JUGADOR POR IDENTIFICAR<\/p><p class="b6-identity__text">Revisá este partido/);
});

/* ============ VALIDACIÓN RÁPIDA (componente reutilizable) ============ */
function makeCardEnv({ officialize, onChangedLog }) {
  const log = { toasts: [], officialize: [], refresh: [], collapse: 0, events: [] };
  const buttons = [{ disabled: false }, { disabled: false }];
  const actions = { className: 'qv-card__actions', innerHTML: '<buttons>', querySelectorAll: () => buttons };
  const stateBadge = { removed: false, remove() { this.removed = true; } };
  const wrap = { isConnected: true, querySelector: (sel) => (sel === '.qv-card__actions' ? actions : sel === '.qv-card__state .history-item__badge' ? stateBadge : null) };
  const sb = {
    qvBusyIds: new Set(), QV_DONE_MS: 0, qvSleep: () => Promise.resolve(),
    qvRefreshAfterValidate: async (id) => { log.refresh.push(id); log.events.push('refresh'); },
    qvCollapse: async () => { log.collapse += 1; log.events.push('collapse'); },
    MV: { officializeMatch: async (id) => { log.officialize.push(id); return officialize(id); } },
    b6ErrorMessage: (code) => `ERR:${code}`, showToast: (t) => log.toasts.push(t),
  };
  const f = new Function(...Object.keys(sb), `${fnSrc('qvValidate')}\nreturn qvValidate;`)(...Object.values(sb));
  const o = { mode: 'collapse', onChanged: (w, m, kind) => { log.events.push(`changed:${kind}`); if (onChangedLog) onChangedLog(kind); } };
  return { f, wrap, actions, buttons, stateBadge, log, o, sb };
}
test('Validación rápida · VALIDAR oficializa EXACTAMENTE ese match, muestra ✓ PARTIDO VALIDADO inline (sin modal), refresca y recién ahí contrae la card', async () => {
  const env = makeCardEnv({ officialize: async () => ({ ok: true, code: 'officialized' }) });
  await env.f({ matchId: 'M-1' }, env.wrap, env.o);
  assert.deepEqual(env.log.officialize, ['M-1']);
  assert.match(env.actions.innerHTML, /✓ PARTIDO VALIDADO/);
  assert.match(env.actions.innerHTML, /role="status"/);
  assert.equal(env.stateBadge.removed, true, 'el badge POR VALIDAR deja de mostrarse');
  assert.deepEqual(env.log.toasts, [], 'sin toast ni modal de éxito: el feedback es la propia card');
  assert.deepEqual(env.log.refresh, ['M-1']);
  assert.deepEqual(env.log.events, ['refresh', 'collapse', 'changed:collapsed'], 'refresca, contrae y recién después actualiza contadores/secciones');
  assert.equal(env.sb.qvBusyIds.size, 0);
});
test('Validación rápida · doble tap / idempotencia: mientras responde, un segundo toque NO vuelve a oficializar', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const env = makeCardEnv({ officialize: async () => { await gate; return { ok: true, code: 'officialized' }; } });
  const first = env.f({ matchId: 'M-2' }, env.wrap, env.o);
  assert.equal(env.buttons.every((b) => b.disabled), true, 'los botones se bloquean mientras responde');
  await env.f({ matchId: 'M-2' }, env.wrap, env.o); // segundo tap en vuelo
  release(); await first;
  assert.deepEqual(env.log.officialize, ['M-2'], 'una sola oficialización');
  // un partido ya validado (already_validated) también cierra bien: el servidor es idempotente
  const again = makeCardEnv({ officialize: async () => ({ ok: true, code: 'already_validated' }) });
  await again.f({ matchId: 'M-2' }, again.wrap, again.o);
  assert.match(again.actions.innerHTML, /✓ PARTIDO VALIDADO/);
});
test('Validación rápida · un error REAL conserva la card (botones habilitados) y muestra el motivo; nunca finge éxito', async () => {
  const env = makeCardEnv({ officialize: async () => ({ ok: false, code: 'not_actionable_for_caller' }) });
  await env.f({ matchId: 'M-3' }, env.wrap, env.o);
  assert.deepEqual(env.log.toasts, ['ERR:not_actionable_for_caller']);
  assert.equal(env.buttons.every((b) => b.disabled === false), true);
  assert.equal(env.log.collapse, 0, 'la card no se contrae');
  assert.doesNotMatch(env.actions.innerHTML, /VALIDADO/);
  assert.deepEqual(env.log.refresh, []);
  assert.equal(env.sb.qvBusyIds.size, 0, 'se puede reintentar');
  // falla de red (excepción) = mismo tratamiento
  const boom = makeCardEnv({ officialize: async () => { throw new Error('offline'); } });
  await boom.f({ matchId: 'M-4' }, boom.wrap, boom.o);
  assert.deepEqual(boom.log.toasts, ['ERR:network_error']);
  assert.equal(boom.log.collapse, 0);
  // confirmación registrada pero partido todavía no oficializado: no se finge "validado"
  const nr = makeCardEnv({ officialize: async () => ({ ok: true, code: 'confirmed_not_ready' }) });
  await nr.f({ matchId: 'M-5' }, nr.wrap, nr.o);
  assert.doesNotMatch(nr.actions.innerHTML, /✓ PARTIDO VALIDADO/);
  assert.equal(nr.log.collapse, 0);
  assert.deepEqual(nr.log.events, ['refresh', 'changed:refresh']);
});
test('Validación rápida · anatomía: REPORTAR UN ERROR (outline rojo, izquierda) / VALIDAR PARTIDO (verde, derecha); sin SÍ, LO JUGUÉ; borde nunca verde; cuerpo abre el Resumen', () => {
  const card = fnSrc('buildQuickMatchCard');
  // V04.34: mismos botones y casing que el Resumen (sentence case, clases .b6-correction-choice*)
  assert.ok(card.indexOf('b6-correction-choice--report" data-qv="report">Reportar un error') < card.indexOf('b6-correction-choice--accept" data-qv="validate">Validar partido'), 'rojo a la izquierda, verde a la derecha');
  assert.doesNotMatch(card, /REPORTAR UN ERROR|VALIDAR PARTIDO/, 'sin mayúsculas integrales en estos CTAs');
  assert.match(card, /b6-correction-choice--review" data-qv="open">Revisar partido/, 'CTA general de POR RESOLVER: azul, no verde');
  assert.doesNotMatch(card, /SÍ, LO JUGUÉ|NO, NO LO JUGUÉ/, 'no hay tercera capa de participación en esta superficie');
  assert.match(card, /buildHistoryItemElement\(m, \{ omitStateBadges: true \}\)/, 'misma card de Historial');
  assert.match(card, /qvOpenResumen\(m, o\.origin, false\)/, 'tocar el cuerpo abre el Resumen completo');
  assert.match(card, /ESPERANDO VALIDACIÓN|qvStateBadge/);
  // ESPERANDO: informativa, sin botones ni párrafo redundante
  assert.doesNotMatch(card, /está esperando validación/);
  assert.match(card, /if \(cat === 'por_validar'\)[\s\S]*else if \(cat === 'por_resolver'\)/, 'solo POR VALIDAR y POR RESOLVER llevan acciones');
  assert.match(cssText, /\.qv-card__actions \.b6-correction-choice--report\{[^}]*border: 1\.5px solid var\(--danger\)/);
  assert.doesNotMatch(cssText.slice(cssText.indexOf('.qv-card{'), cssText.indexOf('/* Historial > Pendientes: secciones')), /border:[^;]*(brand-lime|green)/, 'nunca se pinta el borde de la card de verde');
  const open = fnSrc('qvOpenResumen');
  assert.match(open, /openCanonicalResumen\(m, origin\)/);
  assert.match(open, /\$\('#b6-report-error-btn'\)\.click\(\)/, 'REPORTAR UN ERROR reutiliza el circuito existente del Resumen');
  assert.match(fnSrc('qvValidate'), /MV\.officializeMatch\(m\.matchId\)/, 'misma validación canónica que el Resumen');
});
test('Validación rápida · navegación Resumen ↔ lista: vuelve a la lista de origen y restaura el scroll', () => {
  const resumen = fnSrc('openCanonicalResumen');
  assert.match(resumen, /openedFrom === 'history' \|\| openedFrom === 'pending'[\s\S]*listScrollTops\[openedFrom\] = sc\.scrollTop/);
  const back = between(appJs, "$('#analysis-back-btn').addEventListener('click'", "else openPlayerHome(); // 'live'");
  assert.match(back, /analysisOpenedFrom === 'history' \|\| analysisOpenedFrom === 'pending'[\s\S]*sc\.scrollTop = listScrollTops\[from\]/);
  assert.match(back, /if \(from === 'pending'\) renderPendingScreen\(\); else renderHistory\(\)/);
  assert.match(back, /analysisOpenedFrom === 'recovered' && recoveredScreenState[\s\S]*renderRecoveredMatchesScreen\(\); showView\('recovered'\)/);
  // el estado de pestaña (Pendientes/Recuperados) persiste mientras se mira el Resumen: se vuelve a la MISMA lista
  assert.match(appJs, /let historyStatusFilter = 'todos'/);
});

/* ============ Historial > Pendientes ============ */
test('Historial > Pendientes · tres secciones POR VALIDAR → POR RESOLVER → ESPERANDO VALIDACIÓN, con la misma card; el gate abre esta lista', () => {
  const idx = (t) => appJs.indexOf(`title: '${t}'`);
  assert.ok(idx('POR VALIDAR') > 0 && idx('POR VALIDAR') < idx('POR RESOLVER') && idx('POR RESOLVER') < idx('ESPERANDO VALIDACIÓN'));
  const sections = fnSrc('renderPendingSections');
  assert.match(sections, /PH\.computePendingBuckets\(list, new Date\(\)\)/, 'misma derivación que la card de Home');
  assert.match(sections, /buildQuickMatchCard\(m, \{ category: sec\.cat/);
  assert.match(fnSrc('renderPendingScreen'), /renderPendingSections\(wrap, PH\.filterMatchesForPlayer\(getDisplayHistory\(\), currentIdentity\(\)\), 'pending'\)/);
  assert.doesNotMatch(appJs.match(/const HISTORY_STATUS_TABS = \[[\s\S]*?\];/)[0], /pendientes/, 'Pendientes ya no es una pestaña de Historial');
  const gate = between(appJs, '  function showPendingLimitGate(state, onSkip) {', '  function openManualLoadScreen(');
  assert.match(gate, /const goToPending = \(\) => openPendingScreen\(\)/, 'VER PARTIDOS PENDIENTES abre la pantalla propia de Partidos pendientes');
  // 5 → bloquea; validar uno → 4 → solo avisa y puede cargar
  assert.equal(PH.pendingGateLevel(5, 5), 'block');
  const five = Array.from({ length: 5 }, (_, i) => row(`p${i}`, { status: 'pending_validation', isActionMine: true }));
  assert.equal(PH.countActionablePending(five), 5);
  five[0].status = 'validated'; five[0].isActionMine = false;
  assert.equal(PH.countActionablePending(five), 4);
  assert.equal(PH.pendingGateLevel(4, 5), 'warn', 'queda en 4: puede volver a cargar (con aviso omitible)');
  assert.equal(PH.pendingGateLevel(2, 5), 'none');
  // el claim NUNCA queda bloqueado por el gate de 5
  const claim = fnSrc('afterIdentityLinked') + fnSrc('openRecoveredMatchesScreen');
  assert.doesNotMatch(claim, /getPendingGateState|showPendingLimitGate/);
  // tras validar, secciones y contadores se actualizan sin repintar toda la lista
  const sync = fnSrc('syncPendingListChrome');
  assert.match(sync, /sec\.remove\(\)/); assert.match(sync, /\$\('#pending-empty'\)\.hidden = listEl\.children\.length !== 0/);
});
test('Historial · pestaña temporal Recuperados: existe solo con lote dentro de la ventana; los partidos NO salen del historial al vencer', () => {
  const env = (recoveries, history) => {
    const sb = {
      recentRecoveries: recoveries, HISTORY_STATUS_TABS: [{ key: 'todos' }, { key: 'pendientes' }, { key: 'victorias' }],
      getDisplayHistory: () => history,
    };
    return new Function(...Object.keys(sb), `${fnSrc('recoveredMatchIdSet')}\n${fnSrc('hasRecoveredTab')}\n${fnSrc('getHistoryTabs')}\nreturn { getHistoryTabs, hasRecoveredTab, recoveredMatchIdSet };`)(...Object.values(sb));
  };
  const hist = [{ matchId: 'a' }, { matchId: 'b' }, { matchId: 'z' }];
  const within = env([{ recoveryId: 'r', sourceName: 'Pedro', matchIds: ['a', 'b'] }], hist);
  assert.equal(within.getHistoryTabs().map((t) => t.key).join(','), 'todos,recuperados,pendientes,victorias', 'Recuperados después de Todos');
  // ventana vencida (el servidor ya no devuelve el lote): sin pestaña, pero los partidos siguen en el historial normal
  const expired = env([], hist);
  assert.equal(expired.getHistoryTabs().map((t) => t.key).join(','), 'todos,pendientes,victorias');
  assert.equal(hist.length, 3, 'el historial no cambia');
  // lote cuyos partidos están ocultos/ausentes => sin pestaña
  assert.equal(env([{ recoveryId: 'r', matchIds: ['q'] }], hist).hasRecoveredTab(), false);
  assert.equal(env([{ recoveryId: 'r', matchIds: ['a'] }], [{ matchId: 'a', hidden: true }]).hasRecoveredTab(), false);
  // render: filtro de ORIGEN sobre el historial visible; no es un estado nuevo
  const rh = fnSrc('renderHistory');
  assert.match(rh, /historyStatusFilter === 'recuperados' && !hasRecoveredTab\(\)\)\) historyStatusFilter = 'todos'/);
  assert.match(rh, /renderRecoveredTabList\(wrap, list\)/);
  assert.match(fnSrc('renderRecoveredTabList'), /Esta pestaña estará disponible durante 30 días\./, 'texto corto (V04.34)');
  // el servidor fija la ventana (30 días) — no hay reloj local
  assert.match(fnSrc('refreshRecentRecoveries'), /Auth\.getMyRecentRecoveries\(30\)/);
  assert.match(fnSrc('refreshServerMatches'), /refreshRecentRecoveries\(false\)/);
  assert.match(fnSrc('replaceRecoveredCardAfterValidate'), /wrap\.replaceWith\(item\)/, 'en Recuperados una card validada no desaparece');
});

/* ============ Pantalla completa post-claim ============ */
test('Post-claim · pantalla COMPLETA (sin barra), RECUPERAMOS N PARTIDOS, sin checklist; accionables con la validación rápida; OMITIR siempre disponible', () => {
  const view = between(indexHtml, '<section id="view-recovered"', '</section>');
  assert.match(view, /id="recovered-title"/); assert.match(view, /Ya forman parte de tu historial\./);
  assert.match(view, /id="recovered-enter-btn" class="btn-start" hidden>ENTRAR A BRAMU</);
  assert.match(view, /id="recovered-skip-btn" class="link-btn" hidden>OMITIR</);
  assert.match(view, /id="recovered-view-btn" class="btn-secondary">VER LOS RECUPERADOS</);
  assert.doesNotMatch(view, /SÍ, LO JUGUÉ|NO, NO LO JUGUÉ|TERMINAR REVISIÓN|Revisar después/, 'sin revisión obligatoria partido por partido');
  assert.doesNotMatch(appJs.match(/const BOTTOM_NAV_VIEWS = \[[^\]]*\]/)[0], /'recovered'/, 'pantalla completa: sin barra inferior');
  const screen = fnSrc('renderRecoveredMatchesScreen');
  assert.match(screen, /RECUPERAMOS \$\{n\} PARTIDO\$\{n === 1 \? '' : 'S'\}/);
  assert.match(screen, /NECESITAN\} TU RESPUESTA|S NECESITAN'\} TU RESPUESTA|NECESITAN' \} TU RESPUESTA|' NECESITA' : 'S NECESITAN'\}\s*TU RESPUESTA/);
  assert.match(screen, /rows\.forEach\(\(f\) => list\.appendChild\(buildQuickMatchCard\(f, \{ category: 'por_validar'/, 'TODOS los accionables, sin tope de 3');
  assert.doesNotMatch(screen, /slice\(0, ?3\)|\.slice\(/);
  assert.match(screen, /VER LOS \$\{n\} RECUPERADOS/);
  // footer: OMITIR mientras queden accionables; sin ellos, ENTRAR A BRAMU
  const footer = fnSrc('syncRecoveredFooter');
  assert.match(footer, /skip-btn'\)\.hidden = pendingCards === 0/);
  assert.match(footer, /enter-btn'\)\.hidden = pendingCards !== 0/);
  const fEnv = (cards) => {
    const els = {};
    const $ = (sel) => (els[sel] = els[sel] || { hidden: false, textContent: '', querySelectorAll: () => new Array(cards) });
    new Function('$', `${footer}\nsyncRecoveredFooter();`)($);
    return els;
  };
  const withPending = fEnv(8); // 5, 8 o más: OMITIR sigue disponible
  assert.equal(withPending['#recovered-skip-btn'].hidden, false); assert.equal(withPending['#recovered-enter-btn'].hidden, true);
  assert.match(withPending['#recovered-needs-title'].textContent, /^8 PARTIDOS NECESITAN TU RESPUESTA$/);
  const none = fEnv(0);
  assert.equal(none['#recovered-skip-btn'].hidden, true); assert.equal(none['#recovered-enter-btn'].hidden, false);
  // solo se listan los POR VALIDAR del lote: los esperando/validados quedan en su estado normal
  assert.match(fnSrc('recoveredActionableRows'), /classifyPendingCategory\(f, now\) === 'por_validar'/);
  // VER LOS N RECUPERADOS → Historial > Recuperados; ENTRAR/OMITIR → Home; ambos cierran la intención y disparan Nivel/duplicados
  const close = fnSrc('closeRecoveredScreen');
  assert.match(close, /clearRecoveredReview\(\)/); assert.match(close, /openRecoveredHistory\(\)/); assert.match(close, /openPlayerHome\(\)/); assert.match(close, /syncIdentityRecovery\(\)/);
});
test('Claim · SÍ, SOY YO recupera todo sin checklist; las ramas de recuperación siguen idénticas (NO SOY YO no consume el link, alta nueva difiere la pantalla)', () => {
  const link = fnSrc('afterIdentityLinked');
  assert.match(link, /saveRecoveredReview\(\{ recoveryId: result\.recoveryId \}\)/);
  assert.match(link, /onboardingDone === false\) return;/);
  assert.match(link, /openRecoveredMatchesScreen\(\)/);
  for (const dead of ['recoveredAnswerOf', 'isRecoveredReviewPending', 'onRecoveredAction', 'refreshRecoveredRows', 'validatedHere']) assert.doesNotMatch(appJs, new RegExp(dead), `${dead} (checklist V04.30-32) debe haber desaparecido`);
  const no = between(appJs, 'no.onclick = () =>', 'yes.onclick');
  assert.doesNotMatch(no, /claimProvisionalPlayer/);
  assert.match(no, /Store\.clearClaimToken\(\)/);
  // mínimo 1 cuenta + 3 provisionales: sin cambios de validación server-side
  assert.doesNotMatch(migration, /create_or_attach_match|min_registered|one_account/);
});

/* ============ ¿SOS X? con el partido que originó la invitación ============ */
test('¿SOS X? · muestra el partido de ORIGEN como MINI-PARTIDO (parejas con foto/nombre/@usuario, score a la derecha) y "+ N partidos más asociados"', () => {
  const sb = { escapeHtml: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;'), playerInitials: (n) => String(n).slice(0, 2).toUpperCase() };
  const build = new Function(...Object.keys(sb), `${fnSrc('formatMatchWhenBA')}\n${fnSrc('buildMiniMatchHTML')}\n${fnSrc('buildInvitationContextHTML')}\nreturn buildInvitationContextHTML;`)(...Object.values(sb));
  const src = {
    playedAt: '2026-10-01T22:00:00Z', playedAtTimeKnown: true, sets: [{ setNumber: 1, gamesA: 3, gamesB: 6 }, { setNumber: 2, gamesA: 4, gamesB: 6 }, { setNumber: 3, gamesA: 7, gamesB: 6 }],
    participants: [
      { team: 'A', position: 1, displayName: 'Seba', username: 'seba', avatarPath: 'u1/a.png' },
      { team: 'A', position: 2, displayName: 'Matu con un nombre muy largo para probar', username: 'matu', avatarPath: null },
      { team: 'B', position: 1, displayName: 'Mariano', username: null, avatarPath: null, isInvitee: true },
      { team: 'B', position: 2, displayName: 'Lucho', username: 'lucho', avatarPath: null },
    ],
  };
  const html = build(src, { sourceIsOrigin: true, matchCount: 18 }, 'Mariano');
  assert.match(html, /Te invitaron desde este partido · 01\/10\/2026/);
  assert.match(html, /\+ 17 partidos más asociados a Mariano/);
  assert.match(html, /@seba/); assert.match(html, /@matu/); assert.match(html, /@lucho/);
  assert.match(html, /data-avatar-path="u1\/a\.png"/, 'foto si existe (ruta de Storage, se firma en lote)');
  assert.match(html, /mini-match__name mini-match__name--invitee">Mariano/, 'el lugar de la identidad invitada va resaltado');
  assert.ok(html.indexOf('Mariano') < html.indexOf('Seba'), 'la pareja de la identidad invitada va primero (arriba, verde)');
  assert.match(html, /mini-match__team--first[\s\S]*mini-match__divider[\s\S]*mini-match__team--second/, 'dos filas de pareja con divisor, sin VS grande ni cuatro cajas');
  // score por set alineado a la derecha, orientado desde la pareja de arriba (B): 6-3, 6-4, 6-7 → ganó 2 sets
  const firstRow = html.slice(html.indexOf('mini-match__team--first'), html.indexOf('mini-match__divider'));
  assert.deepEqual([...firstRow.matchAll(/mini-match__set(?: mini-match__set--win)?">(\d)/g)].map((m) => m[1]), ['6', '6', '6']);
  assert.equal([...firstRow.matchAll(/mini-match__set--win/g)].length, 2, 'ganó 2 de 3 sets');
  assert.doesNotMatch(html, /@Mariano|@null|@undefined/, 'sin @usuario para quien no tiene cuenta (fallback normal)');
  assert.doesNotMatch(html, /invite-ctx__vs|VS/, 'sin VS grande');
  // sin origen (link viejo): copy anterior, y sin partidos extra no hay línea "+ N"
  const old = build(src, { sourceIsOrigin: false, matchCount: 1 }, 'Mariano');
  assert.match(old, /registró este partido con ese nombre/); assert.doesNotMatch(old, /más asociado/);
  assert.match(build(src, { sourceIsOrigin: true, matchCount: 2 }, 'X'), /\+ 1 partido más asociado a X/);
  // el layout soporta nombres largos (ellipsis) y 3 sets
  assert.match(cssText, /\.mini-match__name\{[^}]*text-overflow: ellipsis/);
  assert.match(cssText, /\.mini-match__team\{[^}]*grid-template-columns: minmax\(0,1fr\) auto/);
  assert.match(indexHtml, />SÍ, SOY YO</); assert.match(indexHtml, />NO, NO SOY YO</);
  assert.match(fnSrc('askInvitationConfirmation'), /buildInvitationContextHTML\(src, preview, displayName\)/);
});
test('Invitación · el link recuerda el partido desde el que se invita (INVITAR en el Resumen); el cliente solo lo envía, el servidor lo valida', async () => {
  assert.match(fnSrc('renderAnalysisGuests'), /data-source-match-id="\$\{escapeHtml\(f\.matchId \|\| ''\)\}"/);
  assert.match(appJs, /openInviteSheet\(btn\.dataset\.guestId, btn\.dataset\.guestName, btn\.dataset\.sourceMatchId\)/);
  assert.match(fnSrc('createInviteUrl'), /Auth\.createClaimLink\(playerId, sourceMatchId\)/);
  assert.match(fnSrc('copyInviteLink'), /createInviteUrl\(cur\.playerId, cur\.sourceMatchId\)/);
  // auth.js: el argumento es opcional (clientes sin origen llaman igual que antes)
  const calls = [];
  const sandbox = { console, window: {} }; sandbox.window = sandbox;
  assert.match(authJs, /if \(sourceMatchId\) args\.p_source_match_id = sourceMatchId;/);
  void calls; void sandbox;
  // Orden de despliegue: sin la migración (firma vieja) el cliente reintenta SIN el origen; el contexto nunca impide invitar.
  const fn = new Function('getClient', `${authJs.slice(authJs.indexOf('  async function createClaimLink('), authJs.indexOf('  /** V04.29 — "SOY YO": vincula'))}\nreturn createClaimLink;`);
  const rpcCalls = [];
  const client = { rpc: async (name, args) => { rpcCalls.push(args); return 'p_source_match_id' in args ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.create_claim_link(p_provisional_player_id, p_source_match_id)' } } : { data: 'tok', error: null }; } };
  const result = await fn(() => client)('prov-1', 'match-1');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: true, token: 'tok' });
  assert.equal(rpcCalls.length, 2); assert.ok(!('p_source_match_id' in rpcCalls[1]));
  // un error real (p. ej. rate limit) NO se reintenta
  const rl = []; const c2 = { rpc: async (n, a) => { rl.push(a); return { data: null, error: { message: 'rate_limited' } }; } };
  assert.equal((await fn(() => c2)('prov-1', 'match-1')).code, 'rate_limited'); assert.equal(rl.length, 1);
  assert.match(authJs, /sourceIsOrigin: !!data\.sourceIsOrigin/);
  assert.match(authJs, /rpc\('get_my_recent_recoveries', \{ p_days: days \|\| 30 \}\)/);
});

/* ============ Notificación de recuperación ============ */
test('Notificación · RECUPERAMOS N PARTIDOS para el propio reclamante; abre Historial > Recuperados; la del invitador se conserva', () => {
  const copy = between(appJs, '  const B6_NOTIF_COPY = {', '  };\n  /** Ronda UX 25/09 (§I)') + '  };';
  const sb = {
    Store: { getCurrentUser: () => ({ id: 'me' }), loadServerMatchesCache: () => ({ matches: [] }) },
    b6MatchContextSuffix: () => '', resolvePlayerNameFromMatchesCache: () => null,
    B6_NOTIF_ACTOR_TITLE: {}, B6_NOTIF_SELF_REPORT_TITLE: (n) => n,
  };
  const f = new Function(...Object.keys(sb), `${copy}\n${fnSrc('mapB6Notification')}\nreturn { mapB6Notification, B6_NOTIF_COPY };`)(...Object.values(sb));
  const base = { id: 'n1', createdAt: '2026-10-05T10:00:00Z', readAt: null, matchId: null };
  const m18 = f.mapB6Notification({ ...base, type: 'identity_recovered', payload: { matchCount: 18, sourceName: 'Mariano' } });
  assert.equal(m18.title, 'RECUPERAMOS 18 PARTIDOS');
  assert.equal(m18.body, 'Los partidos que estaban registrados como Mariano ya están en tu historial.');
  assert.equal(m18.category, 'positive'); assert.equal(m18.type, 'identity_recovered');
  const m1 = f.mapB6Notification({ ...base, type: 'identity_recovered', payload: { matchCount: 1, sourceName: 'Mariano' } });
  assert.equal(m1.title, 'RECUPERAMOS 1 PARTIDO');
  // la existente al invitador no cambia
  const inv = f.mapB6Notification({ ...base, type: 'identity_claimed', payload: { claimedByName: 'Mariano' } });
  assert.equal(inv.title, 'Mariano ya se sumó a BRAMU y recuperó sus partidos.');
  // al tocarla abre Recuperados (puede marcarse leída; sigue en el historial de notificaciones)
  assert.match(appJs, /cached && cached\.type === 'identity_recovered'\) \{ await openRecoveredHistory\(\); return; \}/);
  assert.match(appJs, /async function openRecoveredHistory\(\) \{\s*await refreshRecentRecoveries\(true\);\s*openHistoryScreen\('player-home', null, 'recuperados'\)/);
});

/* ============ Backend (estático; la ejecución real corre en PGlite con verify-v0433…sql) ============ */
test('Backend · migración V04.33 forward-only y mínima: no toca Nivel, Ranking, Team A/B ni deduplicación; ACL cerradas', () => {
  assert.doesNotMatch(migration, /\b(drop|alter|delete from|truncate)\b[^;]*\b(level_states|level_events|ranking_|match_level_|matches_ranking|match_revisions|match_sets|level_recovery_effects)/i);
  assert.doesNotMatch(migration, /update public\.matches|team_a|team_b|winner_team/i, 'Team A/B y ganador canónicos intactos');
  assert.match(migration, /add column if not exists source_match_id uuid references public\.matches/);
  assert.match(migration, /drop function if exists public\.create_claim_link\(uuid\);\s*\n\s*\ncreate or replace function public\.create_claim_link\(p_provisional_player_id uuid, p_source_match_id uuid default null\)/);
  assert.match(migration, /revoke all on function public\.create_claim_link\(uuid, uuid\) from public, anon;\s*\ngrant execute on function public\.create_claim_link\(uuid, uuid\) to authenticated;/);
  assert.match(migration, /revoke all on function public\.get_my_recent_recoveries\(integer\) from public, anon;\s*\ngrant execute on function public\.get_my_recent_recoveries\(integer\) to authenticated;/);
  assert.match(migration, /revoke all on function public\._notify_target_identity_recovered\(\) from public, anon, authenticated;/);
  assert.match(migration, /'identity_claimed', 'identity_recovered'/, 'el tipo nuevo se suma sin quitar los existentes');
  assert.match(migration, /_can_invite_provisional\(v_caller_player_id, p_provisional_player_id\)/, 'autorización de invitar intacta');
  assert.match(migration, /_duplicate_candidate_match_json\(v_source_match_id, null\) - 'matchId' - 'myTeam'/, 'la vista previa sigue sin exponer ids de partido');
  assert.ok(fs.existsSync(path.join(__dirname, '../supabase/tests/verify-v0433-recuperados-pendientes.sql')));
});

/* ============ Regresiones ============ */
test('Regresión · mi equipo verde sigue siendo SOLO presentación; Team A/B canónicos y deduplicación no se tocan', () => {
  const pres = between(appJs, '    // V04.32 — SOLO presentación', '\n', ).length > 0;
  assert.ok(pres);
  const qv = fnSrc('buildQuickMatchCard') + fnSrc('qvValidate') + fnSrc('renderPendingSections') + fnSrc('renderRecoveredMatchesScreen');
  assert.doesNotMatch(qv, /winnerTeam =|\.team = |myTeam =|swapTeams|team-swap/, 'la validación rápida no reescribe equipos/ganador');
  assert.doesNotMatch(appJs, /resolveDuplicateMatchCandidate\([^)]*\)\s*\/\/ V04\.33/);
  assert.match(fnSrc('syncIdentityRecovery'), /promptDuplicateCandidates\(\)/, 'Nivel recuperado + duplicados se ofrecen igual después de la pantalla');
});
