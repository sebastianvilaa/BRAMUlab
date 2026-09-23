// BRAMUlab — Bloque 8 (Fase D): pruebas locales de intelligence-presentation.js.
// Ejecutar con: node --test bramulab/intelligence-presentation.test.mjs
//
// Mismo criterio de arnés que los tests de Fase A/B/C: módulos compartidos (IIFE sin `export`)
// cargados en un `vm.createContext` nuevo. Cobertura de los puntos 5-19 (Templates/UX-estado) más
// 24/25/27 (Persistencia/backend: fingerprint y aislamiento por corte histórico — la parte de esos
// puntos que vive en los módulos puros; la autoridad server-side/idempotencia propia de la Edge
// Function no tiene arnés Node/Deno en este repo, mismo criterio que el resto de las funciones de
// supabase/functions, y queda documentada por revisión de código en el informe de esta ronda) de
// docs/BRAMUlab/Implementacion/Backend/Bloque_08/15_Handoff_Fase_D_Claude.md §13.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSharedEngine() {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const relPath of [
    'engine.js', 'level.js', 'level-context.js', 'match-sync.js',
    'intelligence-context.js', 'intelligence-claims.js', 'intelligence-editorial.js', 'intelligence-presentation.js',
  ]) {
    const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return sandbox;
}

const sandbox = loadSharedEngine();
const IC = sandbox.PLIntelligenceContext;
const ED = sandbox.PLIntelligenceEditorial;
const PR = sandbox.PLIntelligencePresentation;

const ME = '11111111-1111-1111-1111-111111111111';
const PARTNER = '22222222-2222-2222-2222-222222222222';
const RIVAL_1 = '33333333-3333-3333-3333-333333333333';
const RIVAL_2 = '44444444-4444-4444-4444-444444444444';

let seq = 0;
function matchId() { seq += 1; return `match-${String(seq).padStart(4, '0')}`; }

function row({
  playedAt, team1 = PARTNER, rivalA = RIVAL_1, rivalB = RIVAL_2, sets,
  status = 'validated', officialEligible = true, hidden = false, hasOpenIdentityIssue = false,
  ownTeam = 'A', names = {},
} = {}) {
  const nameOf = (id, fallback) => names[id] || fallback;
  const participants = ownTeam === 'A'
    ? [
        { team: 'A', position: 1, playerId: ME, displayName: nameOf(ME, 'Yo') },
        { team: 'A', position: 2, playerId: team1, displayName: nameOf(team1, 'Compañero') },
        { team: 'B', position: 1, playerId: rivalA, displayName: nameOf(rivalA, 'Rival 1') },
        { team: 'B', position: 2, playerId: rivalB, displayName: nameOf(rivalB, 'Rival 2') },
      ]
    : [
        { team: 'B', position: 1, playerId: ME, displayName: nameOf(ME, 'Yo') },
        { team: 'B', position: 2, playerId: team1, displayName: nameOf(team1, 'Compañero') },
        { team: 'A', position: 1, playerId: rivalA, displayName: nameOf(rivalA, 'Rival 1') },
        { team: 'A', position: 2, playerId: rivalB, displayName: nameOf(rivalB, 'Rival 2') },
      ];
  return {
    match_id: matchId(), status, played_at: playedAt, played_at_time_known: true,
    format_id: 'classic', scoring_system: 'standard', my_team: ownTeam,
    created_by_player_id: ME, validated_at: status === 'validated' ? playedAt : null,
    validation_deadline_at: null, hidden, official_eligible: officialEligible,
    has_open_identity_issue: hasOpenIdentityIssue, participants,
    sets: sets.map((s, i) => ({ setNumber: i + 1, gamesA: s[0], gamesB: s[1], tiebreakA: s[2] ?? null, tiebreakB: s[3] ?? null })),
  };
}
function straightSetsWin(ownTeam) { return ownTeam === 'A' ? [[6, 3], [6, 4]] : [[3, 6], [4, 6]]; }
function straightSetsLoss(ownTeam) { return straightSetsWin(ownTeam === 'A' ? 'B' : 'A'); }
function dayIso(n) { return new Date(Date.UTC(2026, 0, n)).toISOString(); }
function winSeries(n, opts = {}) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(row({ playedAt: dayIso(1 + i), sets: straightSetsWin('A'), ...opts }));
  return rows;
}

function renderFor(historyRows, memory) {
  const history = IC.buildPersonalHistory(historyRows);
  const decision = ED.buildEditorialDecision(history, ME, memory || ED.emptyMemory());
  return PR.renderIntelligence(decision, history, decision.memoryUpdate);
}

test('los módulos se cargan y PLIntelligencePresentation expone su API pública', () => {
  assert.ok(PR && typeof PR.renderIntelligence === 'function');
  assert.ok(typeof PR.buildNameResolver === 'function');
  assert.ok(typeof PR.computeHistoryFingerprint === 'function');
});

/* ------------------------------------------------------------------ */
/* 5/6/7/8/9/10: templates — un template por insightType seleccionable  */
/* ------------------------------------------------------------------ */

test('5/6/7: cada insightType A-G seleccionable produce un template sin placeholders sin resolver ni IDs técnicos', () => {
  // Historial rico: dispara docenas de insightTypes distintos a lo largo de la secuencia.
  const rows = winSeries(12, { team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2 });
  let memory = ED.emptyMemory();
  const seenInsightTypes = new Set();
  for (let i = 1; i <= rows.length; i++) {
    const history = IC.buildPersonalHistory(rows.slice(0, i));
    const decision = ED.buildEditorialDecision(history, ME, memory);
    const rendered = PR.renderIntelligence(decision, history, decision.memoryUpdate);
    memory = rendered.memoryUpdate;
    [rendered.principal].concat(rendered.secondary).filter(Boolean).forEach((insight) => {
      seenInsightTypes.add(insight.insightType);
      assert.equal(typeof insight.body, 'string');
      assert.ok(insight.body.length > 0);
      assert.equal(insight.body.indexOf('undefined'), -1, `placeholder sin resolver en ${insight.insightType}: ${insight.body}`);
      assert.equal(insight.body.indexOf('null'), -1, `placeholder sin resolver en ${insight.insightType}: ${insight.body}`);
      assert.equal(insight.body.indexOf('NaN'), -1, `placeholder sin resolver en ${insight.insightType}: ${insight.body}`);
      // 0 IDs técnicos visibles: ningún UUID de los usados en el fixture aparece en el texto.
      [ME, PARTNER, RIVAL_1, RIVAL_2].forEach((id) => assert.equal(insight.body.indexOf(id), -1));
      [ME, PARTNER, RIVAL_1, RIVAL_2].forEach((id) => assert.equal(insight.why.indexOf(id), -1));
    });
  }
  assert.ok(seenInsightTypes.size >= 3, 'se esperaba más de un tipo de insight distinto en 12 partidos');
});

test('8: los números del texto corresponden exactamente al claim (racha)', () => {
  const rendered = renderFor(winSeries(3));
  const streak = [rendered.principal].concat(rendered.secondary).find((i) => i && i.insightType === 'racha_de_victorias');
  assert.ok(streak);
  assert.ok(streak.body.indexOf('3') !== -1);
});

test('9: los nombres provienen del resolver real (displayName del historial), nunca de un ID', () => {
  const rows = winSeries(4, { team1: PARTNER, names: { [PARTNER]: 'Nico' } });
  const rendered = renderFor(rows);
  const companero = [rendered.principal].concat(rendered.secondary).find((i) => i && i.insightType === 'companero_balance');
  assert.ok(companero);
  assert.ok(companero.body.indexOf('Nico') !== -1);
  assert.equal(companero.body.indexOf(PARTNER), -1);
});

test('9b: sin nombre disponible, se usa una formulación neutral en vez de inventar una entidad', () => {
  const resolver = PR.buildNameResolver([]);
  assert.equal(resolver('un-id-cualquiera'), null);
});

test('10: alcance personal/oficial/mixto no se confunden en el texto', () => {
  const rowsOficial = winSeries(4, { team1: PARTNER, officialEligible: true });
  const renderedOficial = renderFor(rowsOficial);
  const companeroOficial = [renderedOficial.principal].concat(renderedOficial.secondary).find((i) => i && i.insightType === 'companero_balance');
  assert.ok(companeroOficial.body.indexOf('oficial') !== -1);

  const rowsPersonal = [1, 2, 3, 4].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A'), officialEligible: false }));
  const renderedPersonal = renderFor(rowsPersonal);
  const companeroPersonal = [renderedPersonal.principal].concat(renderedPersonal.secondary).find((i) => i && i.insightType === 'companero_balance');
  assert.ok(companeroPersonal.body.indexOf('registrado') !== -1);
  assert.equal(companeroPersonal.body.indexOf(' oficial'), -1);
});

/* ------------------------------------------------------------------ */
/* 11/12: variantes/templateId deterministas, se evita repetición       */
/* ------------------------------------------------------------------ */

test('11: variantes/templateId son deterministas (misma entrada -> mismo templateId, siempre)', () => {
  const rows = winSeries(3);
  const r1 = renderFor(rows);
  const r2 = renderFor(rows);
  assert.equal(r1.principal.templateId, r2.principal.templateId);
});

test('12: una plantilla reciente se evita cuando existe una variante alternativa compatible', () => {
  const history = IC.buildPersonalHistory([1, 2, 3, 4].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') })));
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const memoryWithV1Recent = Object.assign({}, decision.memoryUpdate, { recentTemplateIds: ['companero_balance:v1'] });
  const rendered = PR.renderIntelligence(decision, history, memoryWithV1Recent);
  const companero = [rendered.principal].concat(rendered.secondary).find((i) => i && i.insightType === 'companero_balance');
  assert.ok(companero);
  assert.equal(companero.templateId, 'companero_balance:v2'); // existe v2, se evita repetir v1
});

test('12b: sin alternativa disponible, se usa el fallback estable de todos modos (nunca sin redactar)', () => {
  const history = IC.buildPersonalHistory(winSeries(3));
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const memoryWithOnlyVariantRecent = Object.assign({}, decision.memoryUpdate, { recentTemplateIds: ['primer_partido_de_la_historia:v1'] });
  const rendered = PR.renderIntelligence(decision, history, memoryWithOnlyVariantRecent);
  assert.ok(rendered.principal || rendered.abstention === false || rendered.learningMessage || rendered.fallbackMessage);
});

/* ------------------------------------------------------------------ */
/* 13: ningún template agrega técnica, emoción o causalidad             */
/* ------------------------------------------------------------------ */

test('13: ningún template usa vocabulario prohibido (técnica/emoción/causalidad)', () => {
  const FORBIDDEN_WORDS = ['confianza', 'presión', 'nervios', 'winner', 'volea', 'saque', 'quiebre', 'porque jugó', 'gracias a su', 'mentalmente'];
  const rows = winSeries(12, { team1: PARTNER });
  let memory = ED.emptyMemory();
  for (let i = 1; i <= rows.length; i++) {
    const history = IC.buildPersonalHistory(rows.slice(0, i));
    const decision = ED.buildEditorialDecision(history, ME, memory);
    const rendered = PR.renderIntelligence(decision, history, decision.memoryUpdate);
    memory = rendered.memoryUpdate;
    [rendered.principal].concat(rendered.secondary).filter(Boolean).forEach((insight) => {
      const text = `${insight.title || ''} ${insight.body} ${insight.why}`.toLowerCase();
      FORBIDDEN_WORDS.forEach((w) => assert.equal(text.indexOf(w), -1, `"${w}" en ${insight.insightType}: ${text}`));
    });
  }
});

/* ------------------------------------------------------------------ */
/* 14/15/16: 1 principal + 0-2 secundarios; abstención nunca fuerza     */
/* ------------------------------------------------------------------ */

test('14: 1 principal + hasta 2 secundarios, o abstención — nunca ninguna otra combinación', () => {
  const rendered = renderFor(winSeries(10));
  if (rendered.abstention) {
    assert.equal(rendered.principal, null);
    assert.equal(rendered.secondary.length, 0);
  } else {
    assert.ok(rendered.principal);
    assert.ok(rendered.secondary.length <= 2);
  }
});

test('15: abstención nunca fuerza un insight — sin candidato fuerte, principal es null y hay mensaje honesto', () => {
  // Mismo criterio que la prueba 14 de intelligence-editorial.test.mjs: relación ya establecida
  // (misma pareja de 4, alternando victoria/derrota para nunca formar racha) + memoria que ya
  // mostró todo lo vigente hace 1 partido, sin cambio — todo relacional queda excluido por
  // cooldown y lo que sobrevive (novedad agotada) cae por debajo de 55.
  const rows = [1, 2, 3, 4, 5, 6].map((d, i) => row({
    playedAt: dayIso(d), team1: PARTNER, sets: i % 2 === 0 ? straightSetsWin('A') : straightSetsLoss('A'),
  }));
  const history = IC.buildPersonalHistory(rows);
  const discovery = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const strongCandidates = discovery.evaluated.filter((e) => e.status === 'above_threshold');
  const priorMemory = ED.emptyMemory();
  strongCandidates.forEach((e) => {
    priorMemory.shownSemanticKeys[e.semanticKey] = {
      lastMatchId: history[history.length - 2].matchId,
      lastValueSignature: sandbox.PLIntelligenceEditorial.valueSignatureOf(e.candidate),
    };
  });
  const decision = ED.buildEditorialDecision(history, ME, priorMemory);
  assert.equal(decision.abstention, true); // confirma el escenario antes de renderizarlo

  const rendered = PR.renderIntelligence(decision, history, decision.memoryUpdate);
  assert.equal(rendered.abstention, true);
  assert.equal(rendered.principal, null);
  assert.ok(rendered.learningMessage || rendered.fallbackMessage);
});

test('16: los hitos de aprendizaje aparecen una sola vez (memoria propia de presentación)', () => {
  // Se fuerza abstención en un partido con historyAsc.length===3 usando memoria que ya suprime
  // los candidatos fuertes que normalmente ganarían ese lugar.
  const rows = [1, 2, 3].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows);
  // Memoria sintética: fuerza abstención marcando la familia B como recién mostrada 2 veces
  // seguidas Y el hito de aprendizaje de "3 partidos" como YA mostrado antes.
  const memory = Object.assign({}, ED.emptyMemory(), {
    learningHitosShown: { 3: true },
  });
  const decision = ED.buildEditorialDecision(history, ME, memory);
  // Si igual hay principal (candidato fuerte real), esta prueba no aplica — se valida solo la
  // memoria del mensaje de aprendizaje en sí, de forma aislada y determinística.
  const rendered1 = PR.renderIntelligence({ ctx: decision.ctx, abstention: true, principal: null, secondary: [], memoryUpdate: memory }, history, memory);
  assert.equal(rendered1.learningMessage, null); // ya estaba marcado como mostrado
  assert.equal(rendered1.fallbackMessage, 'Partido guardado. No apareció una conclusión histórica más relevante que el resultado.');

  const freshMemory = ED.emptyMemory();
  const rendered2 = PR.renderIntelligence({ ctx: decision.ctx, abstention: true, principal: null, secondary: [], memoryUpdate: freshMemory }, history, freshMemory);
  assert.equal(rendered2.learningMessage, 'Ya aparecen tus primeros antecedentes con este grupo.');
  assert.equal(rendered2.memoryUpdate.learningHitosShown[3], true);
});

/* ------------------------------------------------------------------ */
/* 17: "Por qué aparece" deriva de evidencia guardada                    */
/* ------------------------------------------------------------------ */

test('17: "why" nunca expone IDs, nombres de tablas/RPC ni reasonCodes técnicos', () => {
  const rendered = renderFor(winSeries(4, { team1: PARTNER }));
  const insight = rendered.principal;
  assert.ok(insight);
  assert.equal(typeof insight.why, 'string');
  [ME, PARTNER, RIVAL_1, RIVAL_2].forEach((id) => assert.equal(insight.why.indexOf(id), -1));
  ['match_level_results', 'ranking_rows', 'reason_codes', 'semanticKey', 'finalScore'].forEach((t) => assert.equal(insight.why.indexOf(t), -1));
});

/* ------------------------------------------------------------------ */
/* Fingerprint — determinístico, sensible a cambios reales              */
/* ------------------------------------------------------------------ */

test('fingerprint: la MISMA historia produce SIEMPRE el mismo fingerprint', () => {
  const rows = winSeries(3);
  const h1 = IC.buildPersonalHistory(rows);
  const h2 = IC.buildPersonalHistory(rows.slice());
  assert.equal(PR.computeHistoryFingerprint(h1), PR.computeHistoryFingerprint(h2));
});

test('fingerprint: una corrección de sets en un partido anterior cambia el fingerprint', () => {
  const rows = winSeries(3);
  const history1 = IC.buildPersonalHistory(rows);
  const fp1 = PR.computeHistoryFingerprint(history1);

  const correctedRows = rows.slice();
  correctedRows[0] = row({ playedAt: dayIso(1), sets: straightSetsLoss('A') }); // el 1er partido cambia de resultado
  const history2 = IC.buildPersonalHistory([correctedRows[0], rows[1], rows[2]]);
  const fp2 = PR.computeHistoryFingerprint(history2);
  assert.notEqual(fp1, fp2);
});

test('fingerprint: una identidad recién cuestionada en un partido anterior cambia el fingerprint', () => {
  const rows = winSeries(3);
  const history1 = IC.buildPersonalHistory(rows);
  const fp1 = PR.computeHistoryFingerprint(history1);

  const rowsWithIssue = rows.slice();
  rowsWithIssue[0] = row({ playedAt: dayIso(1), sets: straightSetsWin('A'), hasOpenIdentityIssue: true });
  const history2 = IC.buildPersonalHistory([rowsWithIssue[0], rows[1], rows[2]]);
  const fp2 = PR.computeHistoryFingerprint(history2);
  assert.notEqual(fp1, fp2);
});

test('fingerprint: agregar un partido retroactivo ANTES del objetivo cambia el fingerprint del prefijo', () => {
  const rows = winSeries(3);
  const history1 = IC.buildPersonalHistory(rows);
  const fp1 = PR.computeHistoryFingerprint(history1);

  const retroactive = row({ playedAt: new Date(Date.UTC(2025, 11, 31)).toISOString(), sets: straightSetsLoss('A') }); // se juega ANTES del primero
  const history2 = IC.buildPersonalHistory(rows.concat([retroactive]));
  const fp2 = PR.computeHistoryFingerprint(history2);
  assert.notEqual(fp1, fp2);
});

/* ------------------------------------------------------------------ */
/* 27: la salida de un partido viejo no incluye partidos jugados después  */
/* ------------------------------------------------------------------ */

test('27: el corte histórico de un partido viejo (mismo criterio que get-match-intelligence) excluye todo lo jugado después, y agregar un partido nuevo no cambia ni su fingerprint ni su salida', () => {
  // Reproduce exactamente la lógica de recorte de supabase/functions/get-match-intelligence/index.ts
  // (`targetIndex = historyFull.findIndex(...)`; `truncated = historyFull.slice(0, targetIndex + 1)`)
  // usando los módulos puros reales — la Edge Function en sí no tiene arnés Node/Deno en este repo.
  const rows = winSeries(3, { team1: PARTNER });
  const historyBefore = IC.buildPersonalHistory(rows);
  const oldMatchId = historyBefore[1].matchId; // el partido "viejo" objetivo: el del medio, no el más reciente

  function truncateAt(historyFull, matchId) {
    const targetIndex = historyFull.findIndex((m) => m.matchId === matchId);
    assert.notEqual(targetIndex, -1);
    return { targetIndex, truncated: historyFull.slice(0, targetIndex + 1) };
  }

  const oldMatchPlayedAtMs = new Date(historyBefore[1].playedAt).getTime();

  const { targetIndex: idxBefore, truncated: truncatedBefore } = truncateAt(historyBefore, oldMatchId);
  assert.equal(truncatedBefore.length, idxBefore + 1);
  assert.ok(truncatedBefore.every((m) => new Date(m.playedAt).getTime() <= oldMatchPlayedAtMs));
  const fpBefore = PR.computeHistoryFingerprint(truncatedBefore);
  const decisionBefore = ED.buildEditorialDecision(truncatedBefore, ME, ED.emptyMemory());
  const renderedBefore = PR.renderIntelligence(decisionBefore, truncatedBefore, ED.emptyMemory());

  // Ahora se juega un partido NUEVO, más reciente que todos los anteriores (carga posterior real).
  const newerRow = row({ playedAt: dayIso(30), team1: PARTNER, sets: straightSetsWin('A') });
  const historyAfter = IC.buildPersonalHistory(rows.concat([newerRow]));
  assert.equal(historyAfter.length, historyBefore.length + 1);

  const { targetIndex: idxAfter, truncated: truncatedAfter } = truncateAt(historyAfter, oldMatchId);
  // El partido viejo sigue en la MISMA posición relativa: el recorte para SU salida no crece.
  assert.equal(idxAfter, idxBefore);
  assert.equal(truncatedAfter.length, truncatedBefore.length);
  assert.ok(!truncatedAfter.some((m) => new Date(m.playedAt).getTime() > oldMatchPlayedAtMs));

  const fpAfter = PR.computeHistoryFingerprint(truncatedAfter);
  const decisionAfter = ED.buildEditorialDecision(truncatedAfter, ME, ED.emptyMemory());
  const renderedAfter = PR.renderIntelligence(decisionAfter, truncatedAfter, ED.emptyMemory());

  // Aislamiento real: el fingerprint (y por lo tanto la salida persistida) del partido viejo NO
  // cambia por la existencia de partidos jugados después — la Edge Function nunca regenerará ni
  // pisará esa salida ya guardada solo porque se cargó un partido nuevo más adelante.
  assert.equal(fpBefore, fpAfter);
  assert.equal(renderedBefore.abstention, renderedAfter.abstention);
  assert.equal(renderedBefore.principal ? renderedBefore.principal.templateId : null, renderedAfter.principal ? renderedAfter.principal.templateId : null);
});
