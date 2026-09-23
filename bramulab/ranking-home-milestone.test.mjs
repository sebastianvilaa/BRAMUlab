// BRAMUlab — Backend Bloque 8 (Fase E): pruebas locales de los hitos materiales de Ranking en
// TU MOMENTO/Home (`bramulab/ranking.js` → `classifyHomeRankingMilestone`/
// `buildRankingMilestoneKey`, y `bramulab/store.js` → `hasSeenRankingMilestone`/
// `markRankingMilestoneSeen`).
// Ejecutar con: node --test bramulab/ranking-home-milestone.test.mjs
//
// Mismo criterio de arnés que el resto de Bloque 8: módulos IIFE cargados en un
// `vm.createContext` nuevo. `ranking.js`/`player-home.js`/`store.js` leen algunos globales a
// nivel de módulo (`PLStore`, `PLPlayerHome`, `PLGroups`, `PLLocations`, `PLEngine`); `engine.js`
// alcanza para que `buildTuMomentoText`/`matchResultForPlayer` funcionen. `store.js` usa
// `localStorage`, que no existe en Node — se provee un shim mínimo en memoria en el propio
// sandbox para poder probar la escritura/lectura real, no solo que la función no explote.
//
// Corrección Revisión Central Fase E (docs/.../27_Revision_Central_Fase_E.md): cobertura de los
// puntos 1-7 y 11-13 de §10 (los puntos 8-10/14-16, sobre Familia H de Nivel, viven en
// intelligence-official.test.mjs/intelligence-presentation.test.mjs; el 17, sobre la migración
// SQL, no es verificable en este arnés — ver el informe de esta ronda).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadModules() {
  const sandbox = {
    // Shim mínimo de localStorage en memoria — solo lo que store.js usa (getItem/setItem/
    // removeItem). Nunca persiste entre tests: cada `loadModules()` arranca un objeto nuevo.
    localStorage: (() => {
      const data = {};
      return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; },
      };
    })(),
  };
  vm.createContext(sandbox);
  for (const relPath of ['engine.js', 'store.js', 'ranking.js', 'player-home.js']) {
    const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return sandbox;
}

let sandbox = loadModules();
let RK = sandbox.PLRanking;
let PH = sandbox.PLPlayerHome;
let Store = sandbox.PLStore;

test.beforeEach(() => {
  sandbox = loadModules();
  RK = sandbox.PLRanking;
  PH = sandbox.PLPlayerHome;
  Store = sandbox.PLStore;
});

test('los módulos se cargan y exponen la API de Fase E (corrección E01-E06)', () => {
  assert.ok(RK && typeof RK.classifyHomeRankingMilestone === 'function');
  assert.ok(typeof RK.buildRankingMilestoneKey === 'function');
  assert.ok(Store && typeof Store.hasSeenRankingMilestone === 'function');
  assert.ok(typeof Store.markRankingMilestoneSeen === 'function');
});

/* ------------------------------------------------------------------ */
/* E01 — "Nuevo" no equivale a "primera entrada", y el gate de 15        */
/* corre ANTES que cualquier hito, incluida la primera entrada           */
/* §10 puntos 1-4                                                        */
/* ------------------------------------------------------------------ */

test('1: isNew con total<15 -> ningún hito (el gate de universo corre ANTES de cualquier hito)', () => {
  const insight = { position: 3, total: 12, isNew: true, delta: null, bestPositionBefore: null };
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('2: isNew + total>=15 + bestPositionBefore===null (nunca hubo posición previa) -> primera entrada', () => {
  const insight = { position: 8, total: 21, isNew: true, delta: null, bestPositionBefore: null, editionId: 'ed-1', scopeType: 'local', scopeKey: 'bella-vista' };
  const milestone = RK.classifyHomeRankingMilestone(insight);
  assert.ok(milestone);
  assert.equal(milestone.type, 'primera_entrada');
});

test('3: isNew=true pero bestPositionBefore es un número (reingreso/ruptura de comparabilidad) -> NUNCA "primera entrada"', () => {
  const insight = { position: 8, total: 21, isNew: true, delta: null, bestPositionBefore: 5 };
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('4: isNew=true y bestPositionBefore AUSENTE (undefined, migración todavía no aplicada) -> nunca afirma primera entrada', () => {
  const insight = { position: 8, total: 21, isNew: true, delta: null }; // bestPositionBefore undefined
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('18: entrar al top 10 (antes >10, ahora <=10) sigue siendo material aunque la mejora sea de solo 1 puesto', () => {
  const insight = { position: 10, total: 30, isNew: false, delta: 1 }; // previousPosition = 10+1 = 11
  const milestone = RK.classifyHomeRankingMilestone(insight);
  assert.ok(milestone);
  assert.equal(milestone.type, 'top10');
});

test('18b: quedarse DENTRO del top 10 (ya estaba en el top 10) no es "entrada al top 10" por sí solo', () => {
  const insight = { position: 5, total: 30, isNew: false, delta: 1 }; // previousPosition = 6, ya estaba en el top 10
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('19: una mejora de 1 o 2 puestos, lejos del top 10 y sin mejor posición histórica, nunca es material', () => {
  assert.equal(RK.classifyHomeRankingMilestone({ position: 40, total: 100, isNew: false, delta: 1 }), null);
  assert.equal(RK.classifyHomeRankingMilestone({ position: 40, total: 100, isNew: false, delta: 2 }), null);
});

test('19b: una caída de posición (delta negativo) nunca es un hito, sin importar la magnitud (los 5 casos cerrados son todos mejoras)', () => {
  assert.equal(RK.classifyHomeRankingMilestone({ position: 45, total: 100, isNew: false, delta: -10 }), null);
});

test('20: nueva mejor posición histórica, con mejora de al menos 3 puestos, es material cuando se provee bestPositionBefore', () => {
  const insight = { position: 20, total: 100, isNew: false, delta: 1, bestPositionBefore: 24 };
  const milestone = RK.classifyHomeRankingMilestone(insight);
  assert.ok(milestone);
  assert.equal(milestone.type, 'nueva_mejor_posicion');
});

test('20b: sin bestPositionBefore (migración todavía no aplicada), el caso "nueva mejor posición" simplemente nunca dispara', () => {
  const insight = { position: 20, total: 100, isNew: false, delta: 1 };
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('21a: ascenso de exactamente 3 puestos en un universo chico (5% < 3) es material', () => {
  const insight = { position: 47, total: 50, isNew: false, delta: 3 }; // max(3, ceil(2.5))=3
  assert.equal(RK.classifyHomeRankingMilestone(insight).type, 'ascenso_material');
});

test('21b: en un universo grande, un ascenso menor al 5% del universo NO alcanza aunque supere 3 puestos', () => {
  const insight = { position: 380, total: 500, isNew: false, delta: 4 }; // umbral = max(3, ceil(25))=25
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('21c: en ese mismo universo grande, un ascenso que sí alcanza el 5% es material', () => {
  const insight = { position: 350, total: 500, isNew: false, delta: 25 };
  assert.equal(RK.classifyHomeRankingMilestone(insight).type, 'ascenso_material');
});

test('23: sin delta numérico (edición anterior no comparable) y sin isNew, nunca es material', () => {
  assert.equal(RK.classifyHomeRankingMilestone({ position: 5, total: 100, isNew: false, delta: null }), null);
  assert.equal(RK.classifyHomeRankingMilestone({ position: 5, total: 100, isNew: false, delta: undefined }), null);
});

/* ------------------------------------------------------------------ */
/* E04 — 5to hito cerrado: cambio de banda pública de Nivel BRAMU        */
/* §10 puntos 11-13                                                      */
/* ------------------------------------------------------------------ */

test('11: cambio de banda pública de Nivel BRAMU entre snapshots semanales publicados -> hito válido', () => {
  const insight = { position: 40, total: 100, isNew: false, delta: 0, levelBand: 7, previousLevelBand: 6, levelPublic: 6.1, previousLevelPublic: 5.8 };
  const milestone = RK.classifyHomeRankingMilestone(insight);
  assert.ok(milestone);
  assert.equal(milestone.type, 'cambio_de_banda');
});

test('12: sin cambio de banda (misma banda en ambos snapshots) -> no hito de banda (puede seguir habiendo otro hito, o ninguno)', () => {
  const insight = { position: 40, total: 100, isNew: false, delta: 1, levelBand: 6, previousLevelBand: 6, levelPublic: 5.9, previousLevelPublic: 5.8 };
  const milestone = RK.classifyHomeRankingMilestone(insight);
  assert.equal(milestone, null); // delta=1 tampoco alcanza ningún otro hito en este fixture
});

test('12b: sin levelBand/previousLevelBand (migración todavía no aplicada) -> el caso de banda nunca dispara, nunca se inventa', () => {
  const insight = { position: 40, total: 100, isNew: false, delta: 0 };
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('13: el copy de cambio de banda usa Niveles BRAMU, nunca "categoría" ni puntos ni causalidad de partido', () => {
  const insight = {
    milestoneType: 'cambio_de_banda', previousLevelPublic: 5.8, levelPublic: 6.1, territory: 'Bella Vista', total: 100, position: 40,
  };
  const text = PH.buildTuMomentoText([{}, {}, {}], 'Sebastian', insight);
  assert.match(text, /Tu Nivel BRAMU pasó de 5\.8 a 6\.1/);
  assert.equal(/categoría|puntos|este partido|por este resultado/i.test(text), false);
});

/* ------------------------------------------------------------------ */
/* E09 (Revisión Final Fase E) — cambio de banda exige además que ambos  */
/* Niveles públicos sean numéricos: nunca renderizar "—" como Nivel      */
/* ------------------------------------------------------------------ */

test('E09.1: bandas distintas pero levelPublic ausente -> nunca hito de cambio de banda', () => {
  const insight = { position: 40, total: 100, isNew: false, delta: 0, levelBand: 7, previousLevelBand: 6, previousLevelPublic: 5.8 }; // levelPublic undefined
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('E09.2: bandas distintas pero previousLevelPublic null -> nunca hito de cambio de banda', () => {
  const insight = { position: 40, total: 100, isNew: false, delta: 0, levelBand: 7, previousLevelBand: 6, levelPublic: 6.1, previousLevelPublic: null };
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

test('E09.3: bandas distintas + ambos Niveles públicos numéricos -> hito válido (contrato completo)', () => {
  const insight = { position: 40, total: 100, isNew: false, delta: 0, levelBand: 7, previousLevelBand: 6, levelPublic: 6.1, previousLevelPublic: 5.8 };
  assert.equal(RK.classifyHomeRankingMilestone(insight).type, 'cambio_de_banda');
});

/* ------------------------------------------------------------------ */
/* Universo insuficiente aplica también al cambio de banda (E01, mismo   */
/* gate para los 5 casos cerrados)                                       */
/* ------------------------------------------------------------------ */

test('universo <15 elegibles bloquea también el cambio de banda (el gate aplica a los 5 casos cerrados por igual)', () => {
  const insight = { position: 5, total: 10, isNew: false, delta: 0, levelBand: 7, previousLevelBand: 6 };
  assert.equal(RK.classifyHomeRankingMilestone(insight), null);
});

/* ------------------------------------------------------------------ */
/* buildRankingMilestoneKey                                              */
/* ------------------------------------------------------------------ */

test('buildRankingMilestoneKey: combina editionId+scopeType+scopeKey+type; null sin milestone', () => {
  assert.equal(RK.buildRankingMilestoneKey(null), null);
  const key = RK.buildRankingMilestoneKey({ type: 'top10', editionId: 'ed-7', scopeType: 'local', scopeKey: 'bella-vista' });
  assert.equal(key, 'ranking:ed-7:local:bella-vista:top10');
});

/* ------------------------------------------------------------------ */
/* E02 — el mismo hito semanal se muestra una sola vez, por usuario +    */
/* edición + scope + tipo. §10 puntos 5-7                                */
/* ------------------------------------------------------------------ */

test('5: mismo usuario + misma edición + mismo tipo -> la segunda "visita" ya no vuelve a pintarlo (hasSeenRankingMilestone true tras marcar)', () => {
  const key = RK.buildRankingMilestoneKey({ type: 'top10', editionId: 'ed-1', scopeType: 'local', scopeKey: 'bella-vista' });
  assert.equal(Store.hasSeenRankingMilestone('user-1', key), false);
  Store.markRankingMilestoneSeen('user-1', key);
  assert.equal(Store.hasSeenRankingMilestone('user-1', key), true);
});

test('6: una edición nueva genera una clave distinta -> puede mostrar un hito nuevo aunque el tipo se repita', () => {
  const keyEdicion1 = RK.buildRankingMilestoneKey({ type: 'ascenso_material', editionId: 'ed-1', scopeType: 'local', scopeKey: 'bella-vista' });
  const keyEdicion2 = RK.buildRankingMilestoneKey({ type: 'ascenso_material', editionId: 'ed-2', scopeType: 'local', scopeKey: 'bella-vista' });
  Store.markRankingMilestoneSeen('user-1', keyEdicion1);
  assert.equal(Store.hasSeenRankingMilestone('user-1', keyEdicion1), true);
  assert.equal(Store.hasSeenRankingMilestone('user-1', keyEdicion2), false); // edición nueva: nunca visto todavía
});

test('7: la memoria de "ya visto" está separada por userId -- dos cuentas en el mismo navegador nunca comparten el mismo hito', () => {
  const key = RK.buildRankingMilestoneKey({ type: 'primera_entrada', editionId: 'ed-1', scopeType: 'local', scopeKey: 'bella-vista' });
  Store.markRankingMilestoneSeen('user-A', key);
  assert.equal(Store.hasSeenRankingMilestone('user-A', key), true);
  assert.equal(Store.hasSeenRankingMilestone('user-B', key), false);
});

test('hasSeenRankingMilestone/markRankingMilestoneSeen: sin milestoneKey (null) nunca marcan ni afirman nada', () => {
  assert.equal(Store.hasSeenRankingMilestone('user-1', null), false);
  assert.equal(Store.markRankingMilestoneSeen('user-1', null), false);
});

/* ------------------------------------------------------------------ */
/* 24: "Nuevo" no se convierte en subida inventada                       */
/* ------------------------------------------------------------------ */

test('24: el texto de una entrada nueva nunca menciona una cantidad de puestos subidos (nunca inventa un delta)', () => {
  const text = PH.buildTuMomentoText([{}, {}, {}], 'Sebastian', { isNew: true, position: 8, total: 21, territory: 'Bella Vista' });
  assert.match(text, /Entraste al Ranking de Bella Vista: #8 de 21/);
  assert.equal(/↑|↓|puestos/i.test(text), false);
});

/* ------------------------------------------------------------------ */
/* 22: lenguaje nunca causal — el texto factual ya existente nunca       */
/* atribuye el movimiento a "este partido"                              */
/* ------------------------------------------------------------------ */

test('22: el texto de un ascenso material nunca atribuye el movimiento a un partido puntual (siempre "esta semana", nunca "este partido")', () => {
  const insight = { position: 40, total: 100, isNew: false, delta: 25, territory: 'Bella Vista' }; // lejos del top 10, a propósito
  assert.equal(RK.classifyHomeRankingMilestone(insight).type, 'ascenso_material');
  const text = PH.buildTuMomentoText([{}, {}, {}], 'Sebastian', insight);
  assert.match(text, /#40 de 100 en Bella Vista/);
  assert.equal(/este partido|por este resultado|jugaste mejor/i.test(text), false);
});

/* ------------------------------------------------------------------ */
/* E07 (Revisión Final Fase E) — un hito de Ranking solo se marca como   */
/* "visto" si realmente modificó el texto visible de TU MOMENTO.         */
/* Réplica exacta de la decisión que toma `app.js` (buildTuMomentoText   */
/* con `null` vs con el insight; nunca marca si el texto es idéntico).   */
/* app.js no tiene arnés propio por diseño — esta prueba fija el         */
/* contrato entre `classifyHomeRankingMilestone`/`buildTuMomentoText`/   */
/* `markRankingMilestoneSeen` que app.js consume tal cual.                */
/* ------------------------------------------------------------------ */

function simulateHomeMilestoneDecision(userId, matches, insight) {
  const milestone = RK.classifyHomeRankingMilestone(insight);
  if (!milestone) return { milestone: null, marked: false };
  const milestoneKey = RK.buildRankingMilestoneKey(milestone);
  if (Store.hasSeenRankingMilestone(userId, milestoneKey)) return { milestone, marked: false };
  insight.milestoneType = milestone.type;
  const baseText = PH.buildTuMomentoText(matches, 'Sebastian', null);
  const textWithInsight = PH.buildTuMomentoText(matches, 'Sebastian', insight);
  if (textWithInsight === baseText) return { milestone, marked: false, painted: false };
  Store.markRankingMilestoneSeen(userId, milestoneKey);
  return { milestone, marked: true, painted: true };
}

test('E07.1: con menos de 3 partidos, buildTuMomentoText ignora el insight -> el hito real NUNCA se marca como visto', () => {
  const insight = { isNew: true, position: 8, total: 21, territory: 'Bella Vista', bestPositionBefore: null, editionId: 'ed-1', scopeType: 'local', scopeKey: 'bv' };
  const matches = [{}, {}]; // 2 partidos: buildTuMomentoText tiene un retorno temprano que ignora rankingInsight
  const result = simulateHomeMilestoneDecision('user-1', matches, insight);
  assert.ok(result.milestone); // el hito SÍ es material según classifyHomeRankingMilestone
  assert.equal(result.marked, false); // pero nunca llegó a pintarse -> nunca se marca como visto
  const key = RK.buildRankingMilestoneKey(result.milestone);
  assert.equal(Store.hasSeenRankingMilestone('user-1', key), false);
});

test('E07.2: con 3+ partidos y sin otras cláusulas que lo desplacen, el hito SÍ se incorpora al texto -> se marca como visto', () => {
  const insight = { isNew: true, position: 8, total: 21, territory: 'Bella Vista', bestPositionBefore: null, editionId: 'ed-1', scopeType: 'local', scopeKey: 'bv' };
  const matches = [{}, {}, {}];
  const result = simulateHomeMilestoneDecision('user-1', matches, insight);
  assert.ok(result.milestone);
  assert.equal(result.marked, true);
  const key = RK.buildRankingMilestoneKey(result.milestone);
  assert.equal(Store.hasSeenRankingMilestone('user-1', key), true);
});
