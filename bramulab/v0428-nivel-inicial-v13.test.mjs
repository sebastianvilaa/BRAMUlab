// BRAMUlab V04.28 — Nivel BRAMU inicial V1.3 (`nivel_inicial_v1_3`, motor posterior `nivel_bramu_v1_0` sin cambios).
// Fuente: docs/BRAMUlab/Implementacion/Pre_Production/111_Handoff_Implementacion_Nivel_V13_02OCT.md
// Ejecutar con: node --test bramulab/v0428-nivel-inicial-v13.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const app = read('app.js'), html = read('index.html'), css = read('styles.css');
const edge = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'officialize-onboarding', 'index.ts'), 'utf8');

function loadEngine(files, extra = {}) {
  const sb = Object.assign({ localStorage: { getItem: () => null, setItem() {}, removeItem() {} } }, extra);
  sb.window = sb; vm.createContext(sb);
  files.forEach((f) => vm.runInContext(read(f), sb, { filename: f }));
  return sb;
}
const eng = loadEngine(['level.js', 'level-calibration.js']);
const LV = eng.PLLevel, L = eng.PLLevelCalibration;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const est = (p) => L.computeInitialEstimateV13(p);
const plain = (x) => JSON.parse(JSON.stringify(x)); // el motor corre en un contexto vm: sus arrays no son del realm del test
const noComments = (src) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/* ======================= MOTOR — fórmula (1–14) ======================= */

test('1) fórmula exacta: anclas del handoff 111 §8 y banco de textos EXACTOS (sin A/B/C/D)', () => {
  assert.equal(L.QUESTIONNAIRE_VERSION, 'nivel_inicial_v1_3');
  assert.equal(L.QUESTIONNAIRE_MODE, 'full');
  assert.deepEqual(JSON.parse(JSON.stringify(L.ANCHORS.panorama.common)), [1.8, 3.8, 5.8, 7.2]);
  ['ritmo', 'ataque', 'defensa', 'decisiones'].forEach((id) => {
    assert.deepEqual(JSON.parse(JSON.stringify(L.ANCHORS[id].low)), [1.5, 2.8, 3.8, 4.6]);
    assert.deepEqual(JSON.parse(JSON.stringify(L.ANCHORS[id].mid)), [3.3, 4.2, 5.2, 6.2]);
    assert.deepEqual(JSON.parse(JSON.stringify(L.ANCHORS[id].high)), [5.7, 6.3, 7.0, 8.8]);
  });
  // Cada pregunta/rama trae EXACTAMENTE 4 textos; el banco es el del documento (se re-extrae del .md).
  const md = fs.readFileSync(path.join(__dirname, '..', 'docs/BRAMUlab/Implementacion/Pre_Production/111_Handoff_Implementacion_Nivel_V13_02OCT.md'), 'utf8');
  let count = 0;
  L.QUESTION_IDS.forEach((id) => Object.values(L.QUESTION_BANK[id].texts).forEach((arr) => {
    assert.equal(arr.length, 4);
    arr.forEach((t) => { assert.ok(md.includes(`**${'ABCD'[arr.indexOf(t)]}:** ${t}`), t); count += 1; });
  }));
  assert.equal(count, 4 * (1 + 3 * 4)); // P1 común (1 rama) + 4 preguntas × 3 ramas
  assert.equal(L.QUESTION_BANK.panorama.prompt, '¿Qué describe mejor tu juego durante un partido habitual?');
});

test('2) interpolación 0…9 exacta en cada vector de anclas (p=9 → D; 2 intermedios entre anclas)', () => {
  const vectors = [L.ANCHORS.panorama.common, L.ANCHORS.ritmo.low, L.ANCHORS.ritmo.mid, L.ANCHORS.ritmo.high];
  vectors.forEach((a) => {
    const out = []; for (let p = 0; p <= 9; p += 1) out.push(L.interpolateAnchor(a, p));
    assert.ok(near(out[0], a[0]) && near(out[3], a[1]) && near(out[6], a[2]) && near(out[9], a[3]));
    assert.ok(near(out[1], a[0] + (a[1] - a[0]) / 3) && near(out[2], a[0] + 2 * (a[1] - a[0]) / 3));
    assert.ok(near(out[4], a[1] + (a[2] - a[1]) / 3) && near(out[5], a[1] + 2 * (a[2] - a[1]) / 3));
    assert.ok(near(out[7], a[2] + (a[3] - a[2]) / 3) && near(out[8], a[2] + 2 * (a[3] - a[2]) / 3));
  });
  [-1, 10, 1.5, NaN, '3', null, undefined].forEach((bad) => assert.equal(L.interpolateAnchor(vectors[0], bad), null));
});

test('3) monotonicidad: cada pregunta, con las demás fijas, nunca baja al subir el slider 0→9', () => {
  const bases = [[3, 3, 3, 3, 3], [6, 6, 6, 6, 6], [8, 7, 7, 7, 7], [0, 0, 0, 0, 0]];
  bases.forEach((base) => {
    for (let q = 0; q < 5; q += 1) {
      let prevValue = -Infinity;
      for (let p = 0; p <= 9; p += 1) {
        const v = base.slice(); v[q] = p;
        // Valor de la propia dimensión (la rama de las SIGUIENTES puede cambiar; la propia no).
        const e = est(v);
        assert.ok(e.values[q] >= prevValue - 1e-9, `q${q} p${p}`);
        prevValue = e.values[q];
      }
    }
  });
});

test('4) umbral exacto 4,1 y 5) umbral exacto 6,4 (comparación a 4 decimales, sin ruido de coma flotante)', () => {
  assert.equal(L.branchForRunningMean(4.0999), 'low');
  assert.equal(L.branchForRunningMean(4.1), 'mid');
  assert.equal(L.branchForRunningMean(6.3999), 'mid');
  assert.equal(L.branchForRunningMean(6.4), 'high');
  assert.equal(L.branchForRunningMean(0), 'low');
  assert.equal(L.branchForRunningMean(9), 'high');
  // Vectores REALES cuyo promedio acumulado cae exactamente en 4,1 / 6,4 (hallados por búsqueda exhaustiva).
  assert.equal(L.branchForIndex([3, 9, 2], 3), 'mid');   // media de las 3 primeras = 4,1
  assert.equal(L.branchForIndex([2, 7, 9, 9], 4), 'mid'); // media de las 4 primeras = 4,1
  assert.equal(L.branchForIndex([8, 5, 0], 3), 'high');   // media de las 3 primeras = 6,4
  assert.equal(L.branchForIndex([9, 0, 6, 0], 4), 'high'); // media de las 4 primeras = 6,4
});

test('6/7) todos mínimos y todos máximos: dentro de [1,9], sin NaN', () => {
  const lo = est([0, 0, 0, 0, 0]), hi = est([9, 9, 9, 9, 9]);
  assert.equal(lo.initialLevel, 1.56); assert.equal(hi.initialLevel, 8.48);
  [lo, hi].forEach((e) => {
    assert.ok(Number.isFinite(e.initialLevel) && e.initialLevel >= 1 && e.initialLevel <= 9);
    assert.ok(e.values.every(Number.isFinite) && Number.isFinite(e.spread));
  });
});

test('8/9) clamp 1,0–9,0 sobre las 10^5 combinaciones posibles; precisión 4 decimales; sin NaN', () => {
  let min = Infinity, max = -Infinity;
  for (let a = 0; a < 10; a += 1) for (let b = 0; b < 10; b += 1) for (let c = 0; c < 10; c += 1) for (let d = 0; d < 10; d += 1) for (let e5 = 0; e5 < 10; e5 += 1) {
    const e = est([a, b, c, d, e5]);
    assert.ok(Number.isFinite(e.initialLevel) && Number.isFinite(e.originConfidence));
    assert.equal(e.initialLevel, Math.round(e.initialLevel * 10000) / 10000);
    min = Math.min(min, e.initialLevel); max = Math.max(max, e.initialLevel);
  }
  assert.ok(min >= 1.0 && max <= 9.0);
});

test('10/11) confianza: spread 1,9999 → 0,15; spread 2,0000 → 0,10 (y casos reales en el borde)', () => {
  assert.equal(L.computeOriginConfidence(1.9999), 0.15);
  assert.equal(L.computeOriginConfidence(2.0), 0.10);
  assert.equal(L.computeOriginConfidence(0), 0.15);
  assert.equal(L.computeOriginConfidence(5), 0.10);
  // Vectores reales: la dispersión cae de cada lado del umbral.
  const spreads = []; for (let a = 0; a < 10; a += 1) for (let b = 0; b < 10; b += 1) for (let c = 0; c < 10; c += 1) { const e = est([a, b, c, 5, 5]); spreads.push([e.spread, e.originConfidence, e.reviewSuggested]); }
  assert.ok(spreads.every(([s, c, r]) => (s < 2 ? c === 0.15 && r === false : c === 0.10 && r === true)));
  assert.ok(spreads.some(([s]) => s < 2) && spreads.some(([s]) => s >= 2));
  // Spread EXACTO 2,0000 alcanzable: P1 B (3,8) con ritmo 5,8… (verificado por barrido)
  let exact = null;
  for (let a = 0; a < 10 && !exact; a += 1) for (let b = 0; b < 10 && !exact; b += 1) for (let c = 0; c < 10 && !exact; c += 1) for (let d = 0; d < 10 && !exact; d += 1) for (let e5 = 0; e5 < 10; e5 += 1) { const e = est([a, b, c, d, e5]); if (e.spread === 2) { exact = e; break; } }
  if (exact) assert.equal(exact.originConfidence, 0.10);
});

test('12) un paso intermedio del slider produce un cambio acotado en el resultado final (nunca ~1 punto)', () => {
  let worst = 0;
  for (let q = 0; q < 5; q += 1) {
    for (const base of [[3, 3, 3, 3, 3], [6, 6, 6, 6, 6], [7, 7, 7, 7, 7], [4, 5, 4, 5, 4]]) {
      for (let p = 0; p < 9; p += 1) {
        const a = base.slice(); a[q] = p; const b = base.slice(); b[q] = p + 1;
        const ea = est(a), eb = est(b);
        // Si el paso NO cruza un umbral de rama, el movimiento es el de una sola dimensión (<= 0,13 de 5).
        if (JSON.stringify(Object.values(ea.branches)) === JSON.stringify(Object.values(eb.branches))) worst = Math.max(worst, Math.abs(eb.initialLevel - ea.initialLevel));
      }
    }
  }
  assert.ok(worst <= 0.1335, `cambio máximo sin cambio de rama: ${worst}`);
  assert.ok(worst > 0.03);
});

test('13) años/frecuencia/entrenamiento/género/categoría/autoevaluación NO alteran el nivel (no son entradas del motor)', () => {
  const base = est({ panorama: 6, ritmo: 6, ataque: 5, defensa: 6, decisiones: 6 });
  const noisy = est({ panorama: 6, ritmo: 6, ataque: 5, defensa: 6, decisiones: 6, anos: 'mas_5', frecuencia: 'tres_mas_semana', entrenamiento: 'regular_actual',
    genero: 'f', gender: 'f', categoria: '1', declaredCategory: '1', autoevaluacion: 'profesional', quickSeedKey: 'profesional' });
  assert.equal(noisy.initialLevel, base.initialLevel);
  assert.deepEqual(plain(noisy.positions), plain(base.positions));
  assert.equal(L.confirmInitialLevelV13(noisy).origin.declaredCategory, null);
  assert.equal(L.confirmInitialLevelV13(noisy).origin.categoryContextKey, null);
  const src = read('level-calibration.js');
  assert.doesNotMatch(src, /ANCHOR_AUTOEVALUACION|TRAINING_MODIFIERS|COMPETITION_MODIFIERS|YEARS_POINTS|FREQUENCY_POINTS|CATEGORY_CONTEXT_MAPS|computeCategoryAdjustment|computeCategoryStep/);
  assert.doesNotMatch(src, /gender\s*[:=]|genero\s*[:=]/);
});

test('14) no existe camino rápido accesible: ni motor, ni UI, ni payload del servidor, ni estado previo', () => {
  ['computeQuickLevel', 'computeFullEstimate', 'confirmInitialLevelV1_1', 'confirmInitialLevelV1_2', 'QUICK_SEEDS'].forEach((n) => assert.equal(L[n], undefined, n));
  assert.doesNotMatch(html, /nivel-path-quick-btn|nivel-path-full-btn|nivel-step-quick|nivel-quick-list|Elegir mi nivel|RECOMENDADO/);
  assert.doesNotMatch(app, /nivelPathType|nivelQuickSeedKey|NIVEL_QUICK_SEED_COPY|computeQuickLevel|data-seed=/);
  assert.match(edge, /mode !== LVC\.QUESTIONNAIRE_MODE/);
  assert.doesNotMatch(edge, /computeQuickLevel|quickSeedKey|computeFullEstimate|confirmInitialLevelV1_2/);
  // Un payload 'quick' no tiene forma de llegar a un resultado: el motor solo acepta 5 enteros 0..9.
  assert.equal(est({ quickSeedKey: 'avanzado' }), null);
  assert.equal(est(null), null);
});

/* ======================= ADAPTATIVIDAD (15–19) ======================= */

test('15) la pregunta 1 es común (misma para todos, sin rama)', () => {
  const v = L.questionView(L.createQuestionnaireState(), 0);
  assert.deepEqual(plain(v.texts), plain(L.QUESTION_BANK.panorama.texts.common));
  assert.equal(L.branchForIndex([null, null, null, null, null], 0), 'common');
  assert.equal(L.questionView(L.createQuestionnaireState(), 1), null, 'la pregunta 2 no existe hasta responder la 1');
});

test('16) rama correcta para P2–P5 según la media acumulada', () => {
  const low = L.answerQuestion(L.createQuestionnaireState(), 0, 0);       // 1,8 → baja
  const mid = L.answerQuestion(L.createQuestionnaireState(), 0, 6);       // 5,8 → media
  const high = L.answerQuestion(L.createQuestionnaireState(), 0, 9);      // 7,2 → alta
  assert.equal(L.questionView(low, 1).texts[0], L.QUESTION_BANK.ritmo.texts.low[0]);
  assert.equal(L.questionView(mid, 1).texts[0], L.QUESTION_BANK.ritmo.texts.mid[0]);
  assert.equal(L.questionView(high, 1).texts[0], L.QUESTION_BANK.ritmo.texts.high[0]);
  // P3–P5 usan la media de TODAS las respuestas previas.
  let s = L.createQuestionnaireState();
  [9, 0, 0].forEach((p, i) => { s = L.answerQuestion(s, i, p); }); // 7,2 ; 5,7 ; 5,7 → media 6,2 → media
  assert.equal(L.branchForIndex(s.positions, 3), 'mid');
  assert.equal(L.questionView(s, 3).texts[1], L.QUESTION_BANK.defensa.texts.mid[1]);
});

test('17) volver atrás sin cambiar la rama conserva todas las respuestas posteriores', () => {
  let s = L.createQuestionnaireState();
  [6, 6, 6, 6, 6].forEach((p, i) => { s = L.answerQuestion(s, i, p); });
  assert.ok(L.isQuestionnaireComplete(s));
  const s2 = L.answerQuestion(s, 1, 7); // cambia el valor pero la rama de P3–P5 sigue siendo 'mid'
  assert.deepEqual(plain(s2.positions), [6, 7, 6, 6, 6]);
  assert.ok(L.isQuestionnaireComplete(s2));
});

test('18) cambiar una respuesta anterior de modo que cambie la rama invalida las posteriores afectadas', () => {
  let s = L.createQuestionnaireState();
  [6, 6, 6, 6, 6].forEach((p, i) => { s = L.answerQuestion(s, i, p); });
  const s2 = L.answerQuestion(s, 0, 0); // media pasa a baja: P2–P5 eran 'mid' → se descartan TODAS
  assert.deepEqual(plain(s2.positions), [0, null, null, null, null]);
  assert.equal(L.isQuestionnaireComplete(s2), false);
  assert.equal(L.firstUnansweredIndex(s2), 1);
  // Cambio en P3 que no altera la rama de P4–P5 → se conservan.
  const s3 = L.answerQuestion(s, 2, 5);
  assert.deepEqual(plain(s3.positions), [6, 6, 5, 6, 6]);
  // Cambio en P2 que baja la media acumulada por debajo de 4,1: P3 pasa de 'mid' a 'low' → se descartan P3–P5, se conserva P2.
  let t = L.createQuestionnaireState();
  [4, 4, 4, 4, 4].forEach((p, i) => { t = L.answerQuestion(t, i, p); });
  assert.deepEqual(plain(t.branches), ['common', 'mid', 'mid', 'mid', 'mid']);
  const t2 = L.answerQuestion(t, 1, 0);
  assert.deepEqual(plain(t2.positions), [4, 0, null, null, null]);
});

test('19) nunca reutiliza el valor de un slider de una rama vieja con textos de otra', () => {
  let s = L.createQuestionnaireState();
  [6, 6, 6, 6, 6].forEach((p, i) => { s = L.answerQuestion(s, i, p); });
  const stale = { version: s.version, positions: s.positions.slice(), branches: s.branches.slice() };
  stale.positions[0] = 0; // alguien edita P1 en el almacenamiento sin tocar el resto
  const r = L.reconcileQuestionnaireState(stale);
  assert.deepEqual(plain(r.positions), [0, null, null, null, null]);
  // Un estado cuyas ramas guardadas no coinciden con las recalculadas se trunca desde la discrepancia.
  const bad = { version: s.version, positions: s.positions.slice(), branches: [null, 'high', 'mid', 'mid', 'mid'] };
  assert.deepEqual(plain(L.reconcileQuestionnaireState(bad).positions), [6, null, null, null, null]);
  // No se puede responder una pregunta saltando una anterior.
  assert.deepEqual(plain(L.answerQuestion(L.createQuestionnaireState(), 3, 4).positions), [null, null, null, null, null]);
  // Versión distinta → estado vacío.
  assert.deepEqual(plain(L.reconcileQuestionnaireState({ version: 'nivel_inicial_v1_2', positions: [1, 2, 3, 4, 5], branches: [] }).positions), [null, null, null, null, null]);
});

/* ======================= UI (20–27) ======================= */

function fnSource(name) {
  let i = app.indexOf(`  function ${name}(`); if (i < 0) i = app.indexOf(`  async function ${name}(`); assert.ok(i >= 0, name);
  const j = app.indexOf('\n  }\n', i); return app.slice(i, j + 5);
}
function makeSliderHarness() {
  const els = {};
  const mk = () => ({ innerHTML: '', textContent: '', hidden: false, disabled: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, removeAttribute() {}, querySelector: () => mk(), querySelectorAll: () => [], getBoundingClientRect: () => ({ top: 100 }) });
  const ctx = { LVC: L, $: (s) => (els[s] = els[s] || mk()), $all: () => [] };
  vm.createContext(ctx);
  vm.runInContext(`
    var nivelDraftPosition = null; var nivelStep = 'quiz'; var NIVEL_SLIDER_MAX = LVC.PARAMS.SLIDER_POSITIONS - 1;
    var painted = 0;
    function paintNivelSlider() { painted += 1; }
    function nivelSliderPositionsPx() { return [10, 20, 30, 45, 55, 65, 85, 95, 105, 120]; }
    ${fnSource('setNivelDraftPosition')}
    ${fnSource('nivelPositionFromClientY')}
  `, ctx);
  return { ctx, get: (n) => vm.runInContext(n, ctx), run: (c) => vm.runInContext(c, ctx) };
}

test('20/21) nada preseleccionado: estado inicial sin valor, thumb oculto, CONTINUAR disabled', () => {
  assert.match(app, /let nivelDraftPosition = null/);
  assert.match(html, /<button type="button" class="btn-start btn-save" id="nivel-quiz-continue-btn" disabled>CONTINUAR<\/button>/);
  assert.match(html, /id="nivel-slider-rail"/);
  const paint = fnSource('paintNivelSlider');
  assert.match(paint, /const hasValue = p != null/);
  assert.match(paint, /thumb\.hidden = !hasValue/);
  assert.match(paint, /\$\('#nivel-quiz-continue-btn'\)\.disabled = !hasValue/);
  // Al entrar a cada pregunta el valor activo es el CONFIRMADO de esa pregunta (null si no hay): nunca una posición media por defecto.
  const render = fnSource('renderNivelQuizStep');
  assert.match(render, /nivelDraftPosition = view\.position/);
  assert.equal(L.questionView(L.createQuestionnaireState(), 0).position, null);
  assert.doesNotMatch(render, /nivelDraftPosition = (4|5)\b/);
  // El thumb nace `hidden` y el CSS lo oculta explícitamente.
  assert.match(render, /nivel-slider__thumb" hidden/);
  assert.match(css, /\.nivel-slider__thumb\[hidden\]\{ display:none; \}/);
  // CONTINUAR solo actúa con una interacción real.
  assert.match(app, /if \(nivelDraftPosition == null\) return;/);
});

test('22) tap en una descripción → posición 0/3/6/9 (toda la tarjeta es un <button> tappable)', () => {
  const render = fnSource('renderNivelQuizStep');
  assert.match(render, /<button type="button" class="nivel-slider__card" data-anchor="\$\{i\}">/);
  assert.match(render, /setNivelDraftPosition\(Number\(card\.dataset\.anchor\) \* 3\)/);
  const h = makeSliderHarness();
  [0, 1, 2, 3].forEach((anchor, i) => { h.run(`setNivelDraftPosition(${anchor * 3})`); assert.equal(h.get('nivelDraftPosition'), [0, 3, 6, 9][i]); });
  assert.match(css, /\.nivel-slider__card\{[^}]*cursor:pointer/);
});

test('23/24) slider discreto: exactamente 10 posiciones, snap al checkpoint más cercano, nunca valores continuos', () => {
  const h = makeSliderHarness();
  assert.equal(h.get('NIVEL_SLIDER_MAX'), 9);
  assert.equal(L.PARAMS.SLIDER_POSITIONS, 10);
  const px = [10, 20, 30, 45, 55, 65, 85, 95, 105, 120];
  // railTop = 100 → clientY = 100 + y. Cada y cae en su checkpoint más cercano.
  px.forEach((y, i) => { assert.equal(h.run(`nivelPositionFromClientY(${100 + y})`), i); assert.equal(h.run(`nivelPositionFromClientY(${100 + y + 2.4})`), i); });
  assert.equal(h.run('nivelPositionFromClientY(100 - 500)'), 0, 'arrastrar más arriba del riel → primer checkpoint');
  assert.equal(h.run('nivelPositionFromClientY(100 + 900)'), 9, 'arrastrar más abajo → último checkpoint');
  for (let y = -20; y < 160; y += 0.7) { const p = h.run(`nivelPositionFromClientY(${100 + y})`); assert.ok(Number.isInteger(p) && p >= 0 && p <= 9); }
  // Solo enteros 0..9 llegan al estado.
  h.run('setNivelDraftPosition(4.5)'); assert.equal(h.get('nivelDraftPosition'), null);
  h.run('setNivelDraftPosition(12)'); assert.equal(h.get('nivelDraftPosition'), null);
  h.run('setNivelDraftPosition(7)'); assert.equal(h.get('nivelDraftPosition'), 7);
  // 10 checkpoints en el DOM: 4 anclas (más grandes) + 6 intermedios, dos entre cada par.
  assert.match(fnSource('renderNivelQuizStep'), /for \(let p = 0; p <= NIVEL_SLIDER_MAX; p \+= 1\) railHtml \+= `<span class="nivel-slider__dot\$\{p % 3 === 0 \? ' nivel-slider__dot--anchor' : ''\}"/);
  assert.match(css, /\.nivel-slider__dot--anchor\{ width: 12px; height: 12px;/);
  // Posiciones en px: anclas en el centro de cada tarjeta; intermedios a 1/3 y 2/3.
  assert.match(fnSource('nivelSliderPositionsPx'), /\(p % 3\) \/ 3\) \* \(c\[seg \+ 1\] - c\[seg\]\)/);
});

test('25) touch usable: riel de 44px, touch-action none, pointer events con captura, teclado equivalente', () => {
  assert.match(css, /\.nivel-slider__rail\{[^}]*flex: 0 0 44px; width: 44px;/);
  assert.match(css, /\.nivel-slider__rail\{[^}]*touch-action: none;/);
  const init = fnSource('initNivelSlider');
  assert.match(init, /addEventListener\('pointerdown'/); assert.match(init, /setPointerCapture/);
  assert.match(init, /addEventListener\('pointermove'/); assert.match(init, /addEventListener\('pointercancel'/);
  assert.match(init, /ArrowDown/); assert.match(init, /ArrowUp/); assert.match(init, /Home/); assert.match(init, /End/);
  assert.match(html, /id="nivel-slider-rail" role="slider" tabindex="0"[^>]*aria-valuemin="0" aria-valuemax="9"/);
  // Sin valor previo, el teclado nunca sugiere el medio: entra por un extremo.
  assert.match(init, /cur == null\) next = inc \? 0 : NIVEL_SLIDER_MAX/);
});

test('26) reload conserva el progreso V1.3 (Store versionado) y descarta lo inconsistente', () => {
  const store = {};
  const sb = loadEngine(['level.js', 'level-calibration.js', 'store.js'], { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } });
  const S = sb.PLStore, LC = sb.PLLevelCalibration;
  let st = LC.createQuestionnaireState();
  [6, 5, 4].forEach((p, i) => { st = LC.answerQuestion(st, i, p); });
  S.saveNivelProgress({ version: LC.QUESTIONNAIRE_VERSION, context: 'draft', positions: st.positions, branches: st.branches });
  const back = S.loadNivelProgress();
  assert.equal(back.version, 'nivel_inicial_v1_3'); assert.equal(back.context, 'draft');
  assert.deepEqual(plain(LC.reconcileQuestionnaireState(back).positions), [6, 5, 4, null, null]);
  assert.equal(LC.firstUnansweredIndex(back), 3, 'retoma en la primera pregunta pendiente');
  // clearSignupDraft arrastra el progreso (mismo plazo de vida que el alta).
  S.clearSignupDraft(); assert.equal(S.loadNivelProgress(), null);
  // La app lo guarda con cada CONTINUAR y lo restaura al abrir.
  assert.match(fnSource('persistNivelProgress'), /Store\.saveNivelProgress\(/);
  assert.match(fnSource('restoreNivelProgress'), /saved\.version !== LVC\.QUESTIONNAIRE_VERSION \|\| saved\.context !== nivelOnboardingContext/);
  assert.match(fnSource('openNivelOnboardingIntro'), /restoreNivelProgress\(\)/);
  assert.match(app, /nivelQuestionnaire = LVC\.answerQuestion\(nivelQuestionnaire, nivelQuizIndex, nivelDraftPosition\);\s*persistNivelProgress\(\);/);
});

test('27) A/B/C/D, valores internos, rama y categorías NUNCA son visibles en el cuestionario ni en el resultado', () => {
  const render = noComments(fnSource('renderNivelQuizStep'));
  assert.doesNotMatch(render, /'ABCD'|\bA\)|\bB\)|branch|rama|\.value\b|anchor value|toFixed/);
  assert.doesNotMatch(render, /view\.branch/);
  const section = html.slice(html.indexOf('id="view-nivel-onboarding"'), html.indexOf('</section>', html.indexOf('id="view-nivel-onboarding"')));
  assert.doesNotMatch(section, /Principiante|Intermedio|Avanzado|Recreativo|Iniciación|Profesional|Competición/);
  assert.match(section, /id="nivel-result-category">CALIBRANDO</);
  assert.doesNotMatch(app, /categorizeLevel\(/);
  // Copy aprobado, sin mensajes dinámicos de selección y sin gradiente verde→naranja→rojo.
  assert.match(section, /Pensá en cómo jugás habitualmente, no en tu mejor ni en tu peor partido\. Cuanto más realista seas, mejor será tu punto de partida\./);
  assert.match(section, /Tocá una descripción\. Si estás entre dos opciones, usá el control para ajustar tu respuesta\./);
  assert.doesNotMatch(app, /Elegiste una de las descripciones|quedó entre dos descripciones/);
  const slider = css.slice(css.indexOf('.nivel-slider-hint'), css.indexOf('/* Progreso del cuestionario completo'));
  assert.doesNotMatch(slider.replace(/linear-gradient\(rgba\(25,159,255,[^;]*?\), var\(--ink-soft\)/g, ''), /gradient|#ff|--gold|--brand-lime|--red|--green|--orange|--danger/i);
  assert.match(slider, /--accent-cyan/);
  // Cuatro tarjetas con texto completo (sin truncar) y en orden de menor a mayor dominio.
  assert.doesNotMatch(slider, /text-overflow|line-clamp|white-space:\s*nowrap/);
});

/* ======================= BACKEND / PARIDAD (28–32) ======================= */

test('28/29) cliente y servidor comparten EL MISMO archivo del motor y el servidor recalcula desde las posiciones crudas', () => {
  const shared = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'level-calibration.js');
  assert.equal(fs.realpathSync(shared), fs.realpathSync(path.join(__dirname, 'level-calibration.js')));
  assert.match(edge, /import '\.\.\/_shared\/level-calibration\.js'/);
  assert.match(edge, /LVC\.computeInitialEstimateV13\(payload\.quizAnswers\)/);
  assert.match(edge, /LVC\.confirmInitialLevelV13\(rawResult, confirmedAt\)/);
  assert.doesNotMatch(edge, /payload\.(mu|level|confidence|nivel|initialLevel|values|branches)\b/, 'el servidor nunca toma un nivel/rama del cliente');
  // El cliente manda SOLO posiciones crudas + versión + modo.
  const send = app.slice(app.indexOf('Auth.officializeLevel({'), app.indexOf('Auth.officializeLevel({') + 260);
  assert.match(send, /mode: LVC\.QUESTIONNAIRE_MODE/); assert.match(send, /questionnaireVersion: LVC\.QUESTIONNAIRE_VERSION/); assert.match(send, /quizAnswers: signupDraft\.nivelAnswers/);
  // Paridad numérica: vista previa local del navegador === lo que calcula el servidor (misma función, mismo payload JSON).
  const cases = [[0, 0, 0, 0, 0], [3, 3, 3, 3, 3], [6, 5, 6, 5, 6], [8, 7, 5, 9, 2], [9, 9, 9, 9, 9], [4, 7, 5, 8, 2]];
  cases.forEach((c) => {
    const local = est(c);
    const wire = JSON.parse(JSON.stringify({ mode: 'full', questionnaireVersion: 'nivel_inicial_v1_3', quizAnswers: local.positions }));
    const server = L.confirmInitialLevelV13(L.computeInitialEstimateV13(wire.quizAnswers), '2026-10-02T00:00:00.000Z').origin;
    const client = L.confirmInitialLevelV13(local, '2026-10-02T00:00:00.000Z').origin;
    assert.deepEqual(plain(server), plain(client));
  });
  // Entradas inválidas → el servidor responde 400 (motor devuelve null): cualquier no-entero, fuera de rango, faltante o string.
  [{}, { panorama: 3 }, { panorama: 3, ritmo: 3, ataque: 3, defensa: 3, decisiones: 10 }, { panorama: 3, ritmo: 3, ataque: 3, defensa: 3, decisiones: '3' },
    { panorama: 3.5, ritmo: 3, ataque: 3, defensa: 3, decisiones: 3 }, [3, 3, 3, 3], [1, 2, 3, 4, 5, 6][0], 'x', 7].forEach((bad) => assert.equal(est(bad), null));
});

test('30/31) se persiste questionnaire_version=nivel_inicial_v1_3 con mode "full" y algorithm_version=nivel_bramu_v1_0', () => {
  assert.match(edge, /p_algorithm_version: LV\.ALGORITHM_VERSION/);
  assert.match(edge, /p_questionnaire_version: LVC\.QUESTIONNAIRE_VERSION/);
  assert.match(edge, /p_questionnaire_mode: LVC\.QUESTIONNAIRE_MODE/);
  assert.equal(LV.ALGORITHM_VERSION, 'nivel_bramu_v1_0');
  assert.equal(L.QUESTIONNAIRE_VERSION, 'nivel_inicial_v1_3');
  assert.equal(L.QUESTIONNAIRE_MODE, 'full'); // única razón: la base restringe questionnaire_mode a quick|full → SIN migración
  // Sin migración nueva para V1.3: ninguna migración menciona la versión nueva.
  const mdir = path.join(__dirname, '..', 'supabase', 'migrations');
  fs.readdirSync(mdir).forEach((f) => assert.doesNotMatch(fs.readFileSync(path.join(mdir, f), 'utf8'), /nivel_inicial_v1_3/, f));
  // Un payload con otra versión de cuestionario se rechaza.
  assert.match(edge, /invalid_questionnaire_version/);
  const built = L.buildInitialCalibrationState('full', L.confirmInitialLevelV13(est([6, 6, 6, 6, 6]), 'x'), est([6, 6, 6, 6, 6]).positions);
  assert.equal(built.algorithmVersion, 'nivel_bramu_v1_0');
  assert.equal(built.state, LV.STATES.CALIBRATING);
  assert.equal(built.mu, 5.32); assert.equal(built.confidence, 0.15);
  assert.equal(built.ratedMatches, 0); assert.equal(built.origin.questionnaireVersion, 'nivel_inicial_v1_3');
});

test('32) idempotencia vigente: la RPC solo oficializa PENDIENTE y el servidor no la reimplementa', () => {
  const mig = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260924130000_preprod_p01c_profile_editable.sql'), 'utf8');
  assert.match(mig, /if v_existing\.status <> 'PENDIENTE' then\s+return v_existing;/);
  assert.match(edge, /rpc\('officialize_level_onboarding'/);
  assert.doesNotMatch(edge, /\.from\('level_(states|events)'\)\s*\.(update|insert|upsert|delete)/);
});

/* ======================= REGRESIÓN (33–34) ======================= */

test('33) nivel_bramu_v1_0 conserva resultados idénticos (level.js y match-level-engine.js sin cambios + fixture pineado)', () => {
  // Hashes del motor posterior de partidos EN EL HEAD ANTERIOR (3d44444): V1.3 no los toca.
  const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, f))).digest('hex');
  assert.equal(h('level.js'), '12aa1dbe49deae59642ed185767af2e0dda5a01c18e33cc5728c82148fff6050');
  assert.equal(h('match-level-engine.js'), 'a5677f73e73af9adf6cd5231953d4364422ca24254243d0fe9101d854c6bda74');
  const mk = (id, mu, c, st) => ({ id, mu, confidence: c, state: st });
  const side = (a, b) => ({ players: [a, b], repetitionFactor: 1, companionFactor: 1, circleFactors: [false, false] });
  const out = LV.computeMatchUpdate({
    matchId: 'm1',
    teamA: side(mk('a1', 5.405, 0.15, LV.STATES.CALIBRATING), mk('a2', 5.9, 0.7, LV.STATES.CALIBRATED)),
    teamB: side(mk('b1', 6.0, 0.6, LV.STATES.CALIBRATED), mk('b2', 5.5, 0.2, LV.STATES.CALIBRATING)),
    winnerTeam: 'B', score: { setsWonByWinner: 2, setsPlayed: 2, gamesWonByWinner: 12, gamesTotal: 16 }, formatKey: 'bestOf3', knownLevelsCount: 4,
  });
  const pick = (id) => [out.players[id].muAfter, out.players[id].confidenceAfter];
  assert.deepEqual(pick('a1'), [5.26, 0.2494]); assert.deepEqual(pick('a2'), [5.8224, 0.7311]);
  assert.deepEqual(pick('b1'), [6.0913, 0.6441]); assert.deepEqual(pick('b2'), [5.641, 0.2946]);
  assert.equal(out.algorithmVersion, 'nivel_bramu_v1_0');
  // Condición de cierre de calibración: 5 partidos + 3 rivales (sin cambios).
  assert.equal(L.PARAMS.CALIBRATION_MIN_MATCHES, 5); assert.equal(L.PARAMS.CALIBRATION_MIN_DISTINCT_RIVALS, 3);
  const calibrando = { state: LV.STATES.CALIBRATING };
  assert.equal(L.computeCalibrationTransition(calibrando, 5, 3).transition, true);
  assert.equal(L.computeCalibrationTransition(calibrando, 5, 2).transition, false);
  assert.equal(L.computeCalibrationTransition(calibrando, 4, 3).transition, false);
});

test('34) cuentas V1.2 intactas: ningún código recalcula/migra/backfillea level_states existentes', () => {
  const mdir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(mdir);
  assert.ok(!files.some((f) => /v13|v1_3|nivel_inicial/i.test(f)), 'ninguna migración nueva de Nivel');
  // El único escritor del estado inicial sigue siendo la RPC idempotente (solo PENDIENTE).
  assert.doesNotMatch(edge, /update\s+public\.level_states|from\('level_states'\)\.update/i);
  // Un jugador V1.2 ya calibrando/consolidado nunca pasa por el cuestionario: el motor posterior lee mu/confidence existentes.
  assert.equal(L.stripLegacyNivelDraft({ email: 'a@b.c', username: 'x' }).removed, false);
  // La app NO reescribe el Nivel de cuentas con estado: el onboarding solo se abre si no hay estado.
  assert.match(fnSource('nivelOnboardingPending'), /!Store\.loadLevelV1State\(user\.id\)/);
});

test('34b) borrador V1.2 (incompleto o confirmado sin oficializar) → se reinicia SOLO Nivel; cuenta/email/perfil/username intactos', () => {
  const draft = { email: 'a@b.c', firstName: 'Ana', lastName: 'Gómez', username: 'ana', displayName: 'Ana', legalVersion: 'v1', authSignUpDone: true, startedAt: 123, dominantHand: 'derecha', location: { country: 'AR' },
    nivelPathType: 'full', nivelQuizAnswers: { autoevaluacion: 'intermedio_alto', red: 'c' }, nivelQuickSeedKey: null, nivelState: { mu: 5.4, origin: { questionnaireVersion: 'nivel_inicial_v1_2' } } };
  const r = L.stripLegacyNivelDraft(draft);
  assert.equal(r.removed, true);
  ['nivelPathType', 'nivelQuizAnswers', 'nivelQuickSeedKey', 'nivelState'].forEach((k) => assert.equal(k in r.draft, false, k));
  ['email', 'firstName', 'lastName', 'username', 'displayName', 'legalVersion', 'authSignUpDone', 'startedAt', 'dominantHand', 'location'].forEach((k) => assert.deepEqual(r.draft[k], draft[k], k));
  assert.ok('nivelState' in draft, 'no muta el borrador original');
  // Un borrador V1.3 válido se conserva.
  const v13 = { email: 'a@b.c', nivelQuestionnaireVersion: 'nivel_inicial_v1_3', nivelAnswers: est([6, 6, 6, 6, 6]).positions, nivelState: { mu: 5.32 } };
  assert.equal(L.stripLegacyNivelDraft(v13).removed, false);
  // La app lo aplica al retomar el alta y al arrancar.
  assert.match(fnSource('resumeDraftFlow'), /sanitizeLegacyNivelDraft\(\)/);
  assert.match(fnSource('sanitizeLegacyNivelDraft'), /Store\.saveSignupDraft\(signupDraft\)/);
});

/* ======================= RECALIBRACIÓN (35–39) ======================= */

test('35–39) recalibración: usa el cuestionario V1.3 con peso 25 %, ±0,5, cierre 3+2, cooldown 90 y ventana 120', () => {
  const e = est([6, 7, 6, 7, 6]);
  const confirmed = L.confirmRecalibrationQuestionnaire(e, 0, '2026-10-02T00:00:00.000Z');
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.origin.confirmedLevel, e.initialLevel);
  assert.equal(confirmed.origin.questionnaireVersion, 'nivel_inicial_v1_3'); // 35
  const current = { mu: 4.0, confidence: 0.6, state: LV.STATES.CALIBRATED };
  const started = L.startRecalibration(current, confirmed.origin.confirmedLevel, '2026-10-02T00:00:00.000Z');
  const expected = 0.75 * 4.0 + 0.25 * e.initialLevel; // 36: 25 %
  assert.ok(near(started.muProvisional, Math.min(4.5, expected), 1e-4));
  // 37: movimiento provisional máximo ±0,5, en ambos sentidos.
  const up = L.startRecalibration({ mu: 3.0, confidence: 0.6 }, 9.0, '2026-10-02T00:00:00.000Z'); assert.equal(up.muProvisional, 3.5);
  const down = L.startRecalibration({ mu: 8.0, confidence: 0.6 }, 1.0, '2026-10-02T00:00:00.000Z'); assert.equal(down.muProvisional, 7.5);
  assert.equal(L.PARAMS.RECALIBRATION_MU_WEIGHT_NEW, 0.25); assert.equal(L.PARAMS.RECALIBRATION_MU_MAX_SHIFT, 0.5);
  // 38: cierre con 3 partidos + 2 rivales distintos.
  const state = L.startRecalibration(current, 4.4, '2026-10-02T00:00:00.000Z');
  const now = '2026-11-01T00:00:00.000Z';
  assert.equal(L.computeRecalibrationClosure(state, 3, 2, now).closed, true);
  assert.equal(L.computeRecalibrationClosure(state, 2, 2, now).closed, false);
  assert.equal(L.computeRecalibrationClosure(state, 3, 1, now).closed, false);
  assert.equal(L.PARAMS.RECALIBRATION_CLOSE_MIN_MATCHES, 3); assert.equal(L.PARAMS.RECALIBRATION_CLOSE_MIN_DISTINCT_RIVALS, 2);
  // 39: cooldown 90 días y ventana 120 días sin cambios.
  const last = '2026-01-01T00:00:00.000Z';
  assert.equal(L.computeRecalibrationEligibility(last, new Date(Date.parse(last) + 89 * 86400000).toISOString()).eligible, false);
  assert.equal(L.computeRecalibrationEligibility(last, new Date(Date.parse(last) + 90 * 86400000).toISOString()).eligible, true);
  assert.equal(L.computeRecalibrationClosure(state, 9, 9, new Date(Date.parse('2026-10-02T00:00:00.000Z') + 121 * 86400000).toISOString()).expired, true);
  assert.equal(L.PARAMS.RECALIBRATION_COOLDOWN_DAYS, 90); assert.equal(L.PARAMS.RECALIBRATION_WINDOW_MAX_DAYS, 120);
});

/* ======================= CONTRAFACTUALES / PERFILES ======================= */

test('contrafactuales: perfiles representativos (desidentificados) mantienen el orden y el rango esperados', () => {
  // NOTA: el handoff 111 §9 publica solo la REFERENCIA y el RESULTADO de cada perfil, no sus posiciones de slider.
  // Estos vectores son arquetipos coherentes con esas descripciones (NO las respuestas originales de esas personas).
  const profiles = [
    ['principiante', [3, 3, 3, 3, 3], 2.5, 3.5],
    ['caso #25 (se describe C en panorama, B en el resto)', [6, 3, 3, 3, 3], 4.0, 5.0],
    ['desarrollo medio', [4, 4, 4, 4, 4], 4.2, 5.2],
    ['intermedio competitivo 1', [6, 6, 6, 6, 6], 5.0, 5.8],
    ['intermedio competitivo 2', [6, 7, 6, 7, 6], 5.2, 6.1],
    ['avanzado amateur', [8, 6, 6, 6, 6], 6.5, 7.2],
  ];
  const levels = profiles.map(([, p, lo, hi]) => { const e = est(p); assert.ok(e.initialLevel >= lo && e.initialLevel <= hi, `${e.initialLevel} fuera de ${lo}–${hi}`); return e.initialLevel; });
  assert.ok(levels[0] < levels[1] && levels[1] <= levels[2] + 0.5 && levels[2] < levels[3] && levels[3] <= levels[4] && levels[4] < levels[5], levels.join(' < '));
  // El caso que disparó #25: ya no hay una autoetiqueta capaz de aportar ~1 punto; una sola descripción más alta mueve < 0,5.
  const base = est([6, 3, 3, 3, 3]).initialLevel, step = est([6, 4, 3, 3, 3]).initialLevel;
  assert.ok(Math.abs(step - base) < 0.2);
});

test('versionado V04.28 / 04.28-h4 coherente (store, version.json, sw, index, manifest)', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.28', bundle: '04.28-h4' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.28'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.28-h4'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-28-h4'/);
  assert.match(html, /level-calibration\.js\?v=04\.28-h4/); assert.match(read('sw.js'), /level-calibration\.js\?v=04\.28-h4/);
  assert.match(read('manifest.webmanifest'), /v=04\.28-h4/);
  assert.doesNotMatch(read('sw.js') + html + read('manifest.webmanifest'), /04\.27-h/);
});

/* ======================= V04.28-h4 — progreso aislado por alta/cuenta ======================= */
function makeProgressHarness(store) {
  const sb = loadEngine(['level.js', 'level-calibration.js', 'store.js'], { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } });
  const ctx = { Store: sb.PLStore, LVC: sb.PLLevelCalibration, window: { crypto: { randomUUID: (() => { let n = 0; return () => `uuid-${++n}-${Math.random()}`; })() } }, crypto: undefined };
  ctx.crypto = ctx.window.crypto;
  vm.createContext(ctx);
  vm.runInContext(`
    var nivelOnboardingContext = 'draft'; var signupDraft = {}; var currentUser = null;
    var nivelQuestionnaire = LVC.createQuestionnaireState();
    Store = Object.assign({}, Store, { getCurrentUser: () => currentUser });
    ${fnSource('nivelProgressScopeKey')}
    ${fnSource('persistNivelProgress')}
    ${fnSource('restoreNivelProgress')}
  `, ctx);
  const run = (c) => vm.runInContext(c, ctx);
  return { run, answer: (ps) => run(`nivelQuestionnaire = LVC.createQuestionnaireState(); ${JSON.stringify(ps)}.forEach((p, i) => { nivelQuestionnaire = LVC.answerQuestion(nivelQuestionnaire, i, p); }); persistNivelProgress();`),
    restore: () => { run('nivelQuestionnaire = LVC.createQuestionnaireState()'); const ok = run('restoreNivelProgress()'); return { ok, positions: plain(run('nivelQuestionnaire.positions')) }; } };
}

test('h2-1/2/3) draft A guarda y restaura tras reload; un draft B distinto NO hereda el progreso de A', () => {
  const store = {};
  const a = makeProgressHarness(store);
  a.run("signupDraft = { email: 'a@x.com' }"); a.answer([6, 5, 4]);
  assert.match(plain(JSON.parse(store['bramulab.nivelProgress.v13'])).scopeKey, /^draft:/);
  assert.ok(a.run('signupDraft.nivelProgressScope'), 'el scope vive en el borrador persistido (sin secretos)');
  const savedDraft = a.run('JSON.stringify(signupDraft)');
  // reload de A: mismo borrador (rehidratado) → restaura
  const reloadA = makeProgressHarness(store); reloadA.run(`signupDraft = ${savedDraft}`);
  assert.deepEqual(reloadA.restore(), { ok: true, positions: [6, 5, 4, null, null] });
  // alta B nueva (borrador vacío → scope propio) → no restaura
  const b = makeProgressHarness(store); b.run("signupDraft = { email: 'b@x.com' }");
  assert.deepEqual(b.restore(), { ok: false, positions: [null, null, null, null, null] });
  // mismo email pero otro borrador/alta → tampoco
  const b2 = makeProgressHarness(store); b2.run("signupDraft = { email: 'a@x.com' }");
  assert.equal(b2.restore().ok, false);
});

test('h2-4/5/6) account A guarda y restaura tras reload; account B NO hereda el progreso de A', () => {
  const store = {};
  const a = makeProgressHarness(store);
  a.run("nivelOnboardingContext = 'account'; currentUser = { id: 'user-A' }"); a.answer([8, 6]);
  const reload = makeProgressHarness(store); reload.run("nivelOnboardingContext = 'account'; currentUser = { id: 'user-A' }");
  assert.deepEqual(reload.restore(), { ok: true, positions: [8, 6, null, null, null] });
  const b = makeProgressHarness(store); b.run("nivelOnboardingContext = 'account'; currentUser = { id: 'user-B' }");
  assert.equal(b.restore().ok, false);
  const none = makeProgressHarness(store); none.run("nivelOnboardingContext = 'account'; currentUser = null");
  assert.equal(none.restore().ok, false);
  // un progreso 'account' tampoco se restaura en contexto 'draft' y viceversa
  const cross = makeProgressHarness(store); cross.run("signupDraft = {}");
  assert.equal(cross.restore().ok, false);
  // sin scopeKey (progreso de h1) no se restaura
  store['bramulab.nivelProgress.v13'] = JSON.stringify({ version: 'nivel_inicial_v1_3', context: 'account', positions: [8, 6, null, null, null], branches: ['common', 'high', null, null, null] });
  assert.equal(reload.restore().ok, false);
});

test('h2-7/8) limpiar el borrador y completar Nivel limpian el progreso', () => {
  const store = {};
  const a = makeProgressHarness(store); a.run("signupDraft = {}"); a.answer([6, 6]);
  assert.ok(store['bramulab.nivelProgress.v13']);
  a.run('Store.clearSignupDraft()'); assert.equal(store['bramulab.nivelProgress.v13'], undefined);
  a.answer([6, 6]); assert.ok(store['bramulab.nivelProgress.v13']);
  a.run('Store.clearNivelProgress()'); assert.equal(store['bramulab.nivelProgress.v13'], undefined);
  // la app limpia el progreso al confirmar (ambos contextos)
  const confirm = fnSource('confirmNivelOnboarding');
  assert.equal((confirm.match(/Store\.clearNivelProgress\(\)/g) || []).length, 2);
  // borrar una cuenta local limpia lo correspondiente
  assert.match(read('store.js'), /safeRemove\(KEYS\.SIGNUP_DRAFT\);\s*safeRemove\(KEYS\.NIVEL_PROGRESS\);/);
});

/* ======================= V04.28-h4 — pulido post-QA ======================= */
const css3 = read('styles.css');
const fn3 = (n) => fnSource(n);

test('h3-1/2/3) intro: copy intacto, más legible (casi blanco, 16px, interlineado), sin estructura nueva', () => {
  const intro = html.slice(html.indexOf('id="nivel-step-intro"'), html.indexOf('id="nivel-step-quiz"'));
  assert.match(intro, /Pensá en cómo jugás habitualmente, no en tu mejor ni en tu peor partido\. Cuanto más realista seas, mejor será tu punto de partida\./);
  assert.match(css3, /#nivel-step-intro \.access-subtitle\{ color: var\(--paper\); font-size: 16px; line-height: 1\.6;/);
  assert.match(css3, /\.nivel-intro-meta\{ font-size: 13px;[^}]*color: var\(--paper-dim\)/);
  assert.equal((intro.match(/<(p|button)\b/g) || []).length, 3); // subtítulo + meta + EMPEZAR: sin elementos nuevos
});

test('h3-4..12) slider: vertical, 10 posiciones funcionales, 4 anclas visibles, thumb con pico y táctil intacto, nada preseleccionado', () => {
  assert.match(html, /Tocá una descripción\. Si estás entre dos opciones, usá el control para ajustar tu respuesta\./);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(css3, /\.nivel-slider__dot:not\(\.nivel-slider__dot--anchor\)\{ visibility:hidden; \}/);
  assert.match(fn3('renderNivelQuizStep'), /for \(let p = 0; p <= NIVEL_SLIDER_MAX; p \+= 1\) railHtml/); // los 10 siguen en el DOM
  assert.match(css3, /\.nivel-slider__thumb::after\{[^}]*left: 100%[^}]*border-left-color|\.nivel-slider__thumb::after\{[^}]*border-color: transparent transparent transparent var\(--accent-cyan\)/);
  assert.match(css3, /\.nivel-slider__rail\{[^}]*width: 44px;/); // hit area intacta
  assert.match(css3, /\.nivel-slider__thumb\{[^}]*width: 26px; height: 26px;/);
  assert.match(fn3('renderNivelQuizStep'), /setNivelDraftPosition\(Number\(card\.dataset\.anchor\) \* 3\)/);
  assert.match(app, /let nivelDraftPosition = null/);
  assert.match(html, /id="nivel-quiz-continue-btn" disabled/);
  const rail = css3.slice(css3.indexOf('.nivel-slider__line'), css3.indexOf('.nivel-slider__cards'));
  assert.doesNotMatch(rail, /gradient|--brand-lime|--gold/);
});

function paintWeights(p) {
  const out = [];
  const ctx = { $: () => ({ dataset: {}, querySelectorAll: () => [], querySelector: () => ({ hidden: false, style: {} }), setAttribute() {}, removeAttribute() {}, style: {}, disabled: false }), LVC: L,
    $all: (sel) => (sel === '#nivel-slider-cards .nivel-slider__card' ? [0, 1, 2, 3].map((i) => ({ style: { setProperty: (k, v) => { out[i] = Number(v); } }, classList: { toggle() {} }, setAttribute() {} })) : []),
    nivelSliderPositionsPx: () => [] };
  vm.createContext(ctx);
  vm.runInContext(`var nivelDraftPosition = ${p};\n${fn3('paintNivelSlider')}\npaintNivelSlider();`, ctx);
  return out;
}
test('h3-13..16) intermedios: énfasis ponderado 100/0, 67/33, 33/67, 0/100 sin tocar la opacidad del texto', () => {
  const r = (a) => a.map((x) => Math.round(x * 100));
  assert.deepEqual(r(paintWeights(0)), [100, 0, 0, 0]);
  assert.deepEqual(r(paintWeights(1)), [67, 33, 0, 0]);   // primer intermedio: más la izquierda
  assert.deepEqual(r(paintWeights(2)), [33, 67, 0, 0]);   // segundo intermedio: más la derecha
  assert.deepEqual(r(paintWeights(3)), [0, 100, 0, 0]);
  assert.deepEqual(r(paintWeights(7)), [0, 0, 67, 33]);
  assert.deepEqual(r(paintWeights(8)), [0, 0, 33, 67]);
  assert.deepEqual(r(paintWeights(9)), [0, 0, 0, 100]);
  assert.deepEqual(r(paintWeights(null)), [0, 0, 0, 0]);
  assert.match(css3, /\.nivel-slider__card\{ background: linear-gradient\(rgba\(25,159,255,calc\(var\(--w, 0\) \* 0\.16\)\)/);
  const cardRules = css3.slice(css3.indexOf('.nivel-slider__card{'), css3.indexOf('/* Progreso del cuestionario completo'));
  assert.doesNotMatch(cardRules, /opacity/);
  assert.match(fn3('paintNivelSlider'), /card\.classList\.toggle\('is-selected', exact\)/);
});

test('h3-17..20) adaptatividad intacta (P1 común, ramas, invalidación, sin reutilizar otra rama)', () => {
  let s = L.createQuestionnaireState();
  [6, 6, 6, 6, 6].forEach((p, i) => { s = L.answerQuestion(s, i, p); });
  assert.equal(plain(L.branchForIndex([6], 1)), 'mid');
  assert.deepEqual(plain(L.answerQuestion(s, 0, 0).positions), [0, null, null, null, null]);
  assert.equal(est([6, 6, 6, 6, 6]).initialLevel, 5.32);
});

test('h3-21..23) resultado: número ámbar mientras CALIBRANDO, arco azul, valor sin cambios', () => {
  assert.match(css3, /\.nivel-gauge__value\{[^}]*color: var\(--gold\)/);
  assert.match(css3, /\.nivel-gauge__fill\{[^}]*stroke: var\(--accent-cyan\)/);
  assert.match(css3, /\.nivel-gauge-card__category\{[^}]*color: var\(--gold\)/);
  assert.equal(est([6, 6, 6, 6, 6]).initialLevel, 5.32);
});

test('h3-24..33) volver desde OTP: el Nivel ya confirmado en el borrador se recupera sin repetir las 5 preguntas', () => {
  const answers = est([6, 6, 6, 6, 6]).positions;
  const store = {};
  const sb = loadEngine(['level.js', 'level-calibration.js', 'store.js'], { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } });
  const ctx = { Store: sb.PLStore, LVC: sb.PLLevelCalibration, window: {}, crypto: undefined, rendered: 0, $: () => ({}), $all: () => [], showView() {}, renderNivelOnboardingStep() { ctx.rendered += 1; } };
  vm.createContext(ctx);
  vm.runInContext(`
    var nivelOnboardingContext = 'draft'; var nivelStep = 'intro'; var nivelQuizIndex = 0; var nivelDraftPosition = null; var nivelEstimate = null;
    var nivelQuestionnaire = LVC.createQuestionnaireState();
    var signupDraft = { email: 'a@x.com', username: 'ana', nivelQuestionnaireVersion: 'nivel_inicial_v1_3', nivelAnswers: ${JSON.stringify(answers)}, nivelState: { mu: 5.32 } };
    ${fn3('nivelProgressScopeKey')}\n${fn3('restoreNivelProgress')}\n${fn3('confirmedDraftNivelAnswers')}\n${fn3('openNivelOnboardingIntro')}
  `, ctx);
  // NIVEL_PROGRESS limpio (como tras CONFIRMAR MI NIVEL) → igual muestra el resultado
  vm.runInContext('openNivelOnboardingIntro()', ctx);
  assert.equal(vm.runInContext('nivelStep', ctx), 'result');
  assert.equal(vm.runInContext('nivelEstimate.initialLevel', ctx), 5.32);
  assert.deepEqual(plain(vm.runInContext('nivelQuestionnaire.positions', ctx)), [6, 6, 6, 6, 6]);
  // Revisar respuestas: pregunta 1 con respuestas conservadas; cambiar rama usa la invalidación vigente
  const st = vm.runInContext('nivelQuestionnaire', ctx);
  assert.deepEqual(plain(L.answerQuestion(st, 0, 0).positions), [0, null, null, null, null]);
  assert.deepEqual(plain(L.answerQuestion(st, 2, 5).positions), [6, 6, 5, 6, 6]);
  // sin Nivel confirmado en el borrador → comportamiento anterior (intro); borrador V1.2 → no se reutiliza
  vm.runInContext("signupDraft = { email: 'a@x.com', nivelState: { mu: 5 } }; openNivelOnboardingIntro();", ctx);
  assert.equal(vm.runInContext('nivelStep', ctx), 'intro');
  vm.runInContext("nivelOnboardingContext = 'account'; signupDraft = { nivelQuestionnaireVersion: 'nivel_inicial_v1_3', nivelAnswers: " + JSON.stringify(answers) + ", nivelState: {} }; openNivelOnboardingIntro();", ctx);
  assert.equal(vm.runInContext('nivelStep', ctx), 'intro', 'solo aplica al contexto draft');
  // oficialización final limpia borrador + progreso como antes
  assert.match(fnSource('runOfficializeAndEnter'), /Store\.clearSignupDraft\(\);\s*signupDraft = \{\};/);
  assert.match(read('store.js'), /function clearSignupDraft\(\) \{ safeRemove\(KEYS\.NIVEL_PROGRESS\);/);
  // Auth/OTP intactos: el flujo sigue usando el mismo verify/resend
  assert.match(app, /Auth\.verifySignupOtp\(signupDraft\.email/);
});

test('h3-34..39) Home Estado Cero: tarjeta aprobada solo sin partidos; con partido real se muestra el partido', () => {
  const fn = fnSource('renderPlayerLastMatchCard');
  const empty = fn.slice(0, fn.indexOf("card.classList.remove('is-empty')"));
  assert.match(empty, /if \(!matches\.length\)/);
  ['PRIMER PARTIDO', 'CARGÁ TU PRIMER PARTIDO', 'Registrá el resultado y empezá a construir tu historial en BRAMU\.', 'CARGAR PARTIDO'].forEach((t) => assert.match(empty, new RegExp(t)));
  assert.match(empty, /<button type="button" class="btn-start player-home-lastmatch__empty-cta">/);
  assert.doesNotMatch(fn.slice(fn.indexOf("card.classList.remove('is-empty')")), /CARGÁ TU PRIMER PARTIDO|empty-cta/);
  // el click de la tarjeta abre Cargar partido solo sin partidos; con partido abre el Resumen
  assert.match(fnSource('initPlayerHomeLastMatchCard'), /if \(!matches\.length\) \{ openManualLoadScreen\('player-home'\); return; \}\s*openCanonicalResumen\(matches\[0\]/);
  // TU MOMENTO / Buscar jugadores / Nivel no se tocan en esta ronda
  assert.match(css3, /\.player-home-lastmatch__empty-cta\{ width:100%; \}/);
});

test('h3-40..42) V1.3 persiste la versión correcta, motor posterior sin cambios, versionado h3', () => {
  assert.equal(L.QUESTIONNAIRE_VERSION, 'nivel_inicial_v1_3');
  const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, f))).digest('hex');
  assert.equal(h('level.js'), '12aa1dbe49deae59642ed185767af2e0dda5a01c18e33cc5728c82148fff6050');
  assert.equal(h('match-level-engine.js'), 'a5677f73e73af9adf6cd5231953d4364422ca24254243d0fe9101d854c6bda74');
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.28', bundle: '04.28-h4' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.28'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.28-h4'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-28-h4'/);
});

/* ======================= V04.28-h4 — tarjeta Estado Cero con foto ======================= */
test('h4-1..4) tarjeta Estado Cero: asset correcto (copia web optimizada), copy exacto, CTA abre Cargar partido', () => {
  const css4 = read('styles.css');
  const jpg = fs.readFileSync(path.join(__dirname, 'assets', 'home-primer-partido.jpg'));
  assert.ok(jpg.length < 300 * 1024, `foto web liviana (${jpg.length} B)`);
  assert.equal(jpg[0], 0xff); assert.equal(jpg[1], 0xd8);
  // es la copia optimizada de "Pelota en cancha azul dramática" (original intacto en docs/identidad-visual)
  const orig = path.join(__dirname, '..', 'docs', 'identidad-visual', 'referencias-premier-padel', 'Pelota en cancha azul dramática.png');
  if (fs.existsSync(orig)) assert.ok(fs.statSync(orig).size > 2 * 1024 * 1024);
  assert.match(css4, /\.player-home-lastmatch\.is-empty\{[\s\S]*url\('assets\/home-primer-partido\.jpg\?v=04\.28-h4'\) 100% 30% \/ cover no-repeat/);
  assert.match(css4, /\.player-home-lastmatch\.is-empty\{[\s\S]*linear-gradient\(180deg, rgba\(5,12,22/); // oscurece detrás del texto
  assert.match(read('sw.js'), /'\.\/assets\/home-primer-partido\.jpg\?v=04\.28-h4'/);
  const fn = fnSource('renderPlayerLastMatchCard');
  const empty = fn.slice(0, fn.indexOf("card.classList.remove('is-empty')"));
  ['PRIMER PARTIDO', 'CARGÁ TU PRIMER PARTIDO', 'Registrá el resultado y empezá a construir tu historial en BRAMU\\.', 'CARGAR PARTIDO'].forEach((t) => assert.match(empty, new RegExp(t)));
  assert.doesNotMatch(empty, /Todo empieza acá|Primer resultado|Empezá tu historia|Resultados reales/);
  assert.equal((empty.match(/<(div|p|button)\b/g) || []).length, 4); // eyebrow + título + bajada + CTA, nada más
  // sin handlers nuevos: el CTA reutiliza el click de la tarjeta (openManualLoadScreen)
  assert.match(fnSource('initPlayerHomeLastMatchCard'), /if \(!matches\.length\) \{ openManualLoadScreen\('player-home'\); return; \}/);
  assert.doesNotMatch(empty, /addEventListener|onclick/);
});

test('h4-5..9) con partido (pendiente u oficial) NO aparece la tarjeta; el resto de Home intacto', () => {
  const fn = fnSource('renderPlayerLastMatchCard');
  const after = fn.slice(fn.indexOf("card.classList.remove('is-empty')"));
  assert.doesNotMatch(after, /empty-cta|CARGÁ TU PRIMER PARTIDO/);
  assert.match(fn, /card\.classList\.remove\('is-empty'\)/); // el fondo con foto solo existe bajo .is-empty
  assert.doesNotMatch(read('styles.css').replace(/\.player-home-lastmatch\.is-empty\{[\s\S]*?\n\}/, ''), /home-primer-partido\.jpg/);
  assert.match(html, /id="player-home-last-match-card"/);
});

test('h4-10..12) layout móvil sin overflow, legibilidad y versionado h4', () => {
  const css4 = read('styles.css');
  assert.match(css4, /\.player-home-lastmatch__empty-cta\{ width:100%; \}/);
  assert.match(css4, /\.player-home-lastmatch__empty-title\{[^}]*text-shadow/);
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.28', bundle: '04.28-h4' });
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.28-h4'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-28-h4'/);
});
