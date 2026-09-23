// BRAMUlab — Backend Bloque 8 (Fase E): pruebas locales de los hitos materiales de Ranking en
// TU MOMENTO/Home (`bramulab/ranking.js` → `isHomeRankingMilestoneMaterial`).
// Ejecutar con: node --test bramulab/ranking-home-milestone.test.mjs
//
// Mismo criterio de arnés que el resto de Bloque 8: módulos IIFE cargados en un
// `vm.createContext` nuevo. `ranking.js`/`player-home.js` leen algunos globales a nivel de
// módulo (`PLStore`, `PLPlayerHome`, `PLGroups`, `PLLocations`, `PLEngine`); `engine.js`/
// `store.js` (sin dependencias propias a nivel de módulo) alcanzan para que
// `buildTuMomentoText`/`matchResultForPlayer` funcionen — nunca hace falta cargar toda la app
// para probar estas funciones puras.
//
// Cobertura de los puntos 16-24 (Ranking) de docs/BRAMUlab/Implementacion/Backend/Bloque_08/
// 25_Handoff_Fase_E_Claude.md §12 que son verificables de forma pura (25-27 quedan documentados
// como no implementados/estructuralmente triviales en el informe de esta ronda).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadModules() {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const relPath of ['engine.js', 'store.js', 'ranking.js', 'player-home.js']) {
    const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return sandbox;
}

const sandbox = loadModules();
const RK = sandbox.PLRanking;
const PH = sandbox.PLPlayerHome;

test('los módulos se cargan y exponen isHomeRankingMilestoneMaterial', () => {
  assert.ok(RK && typeof RK.isHomeRankingMilestoneMaterial === 'function');
});

/* ------------------------------------------------------------------ */
/* 16: <15 elegibles -> no insight de puesto                            */
/* ------------------------------------------------------------------ */

test('16: universo con menos de 15 elegibles nunca es material, aunque el delta sea grande', () => {
  const insight = { position: 2, total: 12, isNew: false, delta: 5 };
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), false);
});

/* ------------------------------------------------------------------ */
/* 17: primera entrada a ranking establecido -> hito válido             */
/* ------------------------------------------------------------------ */

test('17: primera entrada (isNew) es material sin importar el universo o el delta', () => {
  assert.equal(RK.isHomeRankingMilestoneMaterial({ position: 40, total: 12, isNew: true, delta: null }), true);
  assert.equal(RK.isHomeRankingMilestoneMaterial({ position: 40, total: 50, isNew: true, delta: 0 }), true);
});

/* ------------------------------------------------------------------ */
/* 18: entrada al Top 10 -> hito válido                                  */
/* ------------------------------------------------------------------ */

test('18: entrar al top 10 (antes >10, ahora <=10) es material aunque la mejora sea de solo 1 puesto', () => {
  const insight = { position: 10, total: 30, isNew: false, delta: 1 }; // previousPosition = 10+1 = 11
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), true);
});

test('18b: quedarse DENTRO del top 10 (ya estaba en el top 10) no es "entrada al top 10" por sí solo', () => {
  const insight = { position: 5, total: 30, isNew: false, delta: 1 }; // previousPosition = 6, ya estaba en el top 10
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), false); // 1 puesto < umbral de ascenso (3) y no cruza el top 10
});

/* ------------------------------------------------------------------ */
/* 19: mejora de 1-2 puestos -> no insight                               */
/* ------------------------------------------------------------------ */

test('19: una mejora de 1 o 2 puestos, lejos del top 10 y sin mejor posición histórica, nunca es material', () => {
  assert.equal(RK.isHomeRankingMilestoneMaterial({ position: 40, total: 100, isNew: false, delta: 1 }), false);
  assert.equal(RK.isHomeRankingMilestoneMaterial({ position: 40, total: 100, isNew: false, delta: 2 }), false);
});

test('19b: una caída de posición (delta negativo) nunca es un hito, sin importar la magnitud (los 5 casos cerrados son todos mejoras)', () => {
  assert.equal(RK.isHomeRankingMilestoneMaterial({ position: 45, total: 100, isNew: false, delta: -10 }), false);
});

/* ------------------------------------------------------------------ */
/* 20: nueva mejor posición con >=3 -> válido (requiere bestPositionBefore) */
/* ------------------------------------------------------------------ */

test('20: nueva mejor posición histórica, con mejora de al menos 3 puestos, es material cuando se provee bestPositionBefore', () => {
  const insight = { position: 20, total: 100, isNew: false, delta: 1, bestPositionBefore: 24 };
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), true);
});

test('20b: sin bestPositionBefore (migración todavía no aplicada), el caso "nueva mejor posición" simplemente nunca dispara — nunca se inventa', () => {
  const insight = { position: 20, total: 100, isNew: false, delta: 1 }; // bestPositionBefore undefined
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), false);
});

/* ------------------------------------------------------------------ */
/* 21: ascenso >= max(3, 5% universo) -> válido                          */
/* ------------------------------------------------------------------ */

test('21a: ascenso de exactamente 3 puestos en un universo chico (5% < 3) es material', () => {
  const insight = { position: 47, total: 50, isNew: false, delta: 3 }; // max(3, ceil(2.5))=3
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), true);
});

test('21b: en un universo grande, un ascenso menor al 5% del universo NO alcanza aunque supere 3 puestos', () => {
  const insight = { position: 380, total: 500, isNew: false, delta: 4 }; // umbral = max(3, ceil(25))=25
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), false);
});

test('21c: en ese mismo universo grande, un ascenso que sí alcanza el 5% es material', () => {
  const insight = { position: 350, total: 500, isNew: false, delta: 25 };
  assert.equal(RK.isHomeRankingMilestoneMaterial(insight), true);
});

/* ------------------------------------------------------------------ */
/* 23: edición no comparable -> no delta                                 */
/* ------------------------------------------------------------------ */

test('23: sin delta numérico (edición anterior no comparable) y sin isNew, nunca es material', () => {
  assert.equal(RK.isHomeRankingMilestoneMaterial({ position: 5, total: 100, isNew: false, delta: null }), false);
  assert.equal(RK.isHomeRankingMilestoneMaterial({ position: 5, total: 100, isNew: false, delta: undefined }), false);
});

/* ------------------------------------------------------------------ */
/* 24: "Nuevo" no se convierte en subida inventada                       */
/* ------------------------------------------------------------------ */

test('24: el texto de una entrada nueva nunca menciona una cantidad de puestos subidos (nunca inventa un delta)', () => {
  // `buildRankingMomentoClause` es privada de player-home.js — se prueba a través de
  // `buildTuMomentoText`, su único punto de entrada real.
  const text = PH.buildTuMomentoText([{}, {}, {}], 'Sebastian', { isNew: true, position: 8, total: 21, territory: 'Bella Vista' });
  assert.match(text, /Entraste al Ranking de Bella Vista: #8 de 21/);
  assert.equal(/↑|↓|puestos/i.test(text), false);
});

/* ------------------------------------------------------------------ */
/* 22 (parcial): lenguaje nunca causal — el texto factual ya existente   */
/* nunca atribuye el movimiento a "este partido"                        */
/* ------------------------------------------------------------------ */

test('22: el texto de un ascenso material nunca atribuye el movimiento a un partido puntual (siempre "esta semana", nunca "este partido")', () => {
  const insight = { position: 8, total: 21, isNew: false, delta: 4, territory: 'Bella Vista' };
  assert.ok(RK.isHomeRankingMilestoneMaterial(insight));
  const text = PH.buildTuMomentoText([{}, {}, {}], 'Sebastian', insight);
  assert.match(text, /#8 de 21 en Bella Vista/);
  assert.equal(/este partido|por este resultado|jugaste mejor/i.test(text), false);
});
