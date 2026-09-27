// BRAMUlab — Corrección de regresiones visuales h17
// (docs/.../53_Auditoria_Central_Reapertura_h16_y_Plan_h17_27SEP.md): guarda técnica de los dos
// FAIL reales de §15.36 (Último partido con corrección activa / Aceptar-Rechazar) más el bloque
// de corrección del Resumen (punto B) y el quartet de bundle/cache de esta ronda.
// Ejecutar con: node --test bramulab/h17-visual-regression.test.mjs
//
// Guarda estática sobre el código fuente real (mismo límite que cierre-ux-h13.test.mjs: app.js
// es un único IIFE que asume `document`/`window` reales desde la primera línea).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const versionJson = fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8');

function extractFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

/* ---- Punto A: Último partido — estructura estable normal vs corrección ---- */

test('h17-A: el status-slot vive DENTRO de row2 (nunca en .datetime/row1) — invariancia geométrica real', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerLastMatchCard');
  const datetimeIdx = body.indexOf('player-home-lastmatch__datetime');
  const row2Idx = body.indexOf('player-home-lastmatch__row2"');
  const statusSlotIdx = body.indexOf('player-home-lastmatch__status-slot');
  assert.ok(datetimeIdx !== -1 && row2Idx !== -1 && statusSlotIdx !== -1, 'deben existir los tres bloques');
  assert.ok(row2Idx > datetimeIdx, 'row2 debe venir después de .datetime en el marcado');
  assert.ok(statusSlotIdx > row2Idx, 'el status-slot debe vivir dentro de row2, nunca antes/dentro de .datetime');
});

test('h17-A: el viejo badge-slot reservado por altura mínima (causa real del FAIL h16) queda retirado', () => {
  assert.doesNotMatch(appJs, /player-home-lastmatch__badge-slot/, 'app.js no debe seguir generando el badge-slot viejo');
  assert.doesNotMatch(stylesCss, /player-home-lastmatch__badge-slot/, 'styles.css no debe conservar la regla del badge-slot viejo (dead code)');
});

test('h17-A: row2 mantiene los dos grupos (forma+resultado / status) en el mismo renglón, sin wrap', () => {
  assert.match(stylesCss, /\.player-home-lastmatch__row2\{[^}]*justify-content:\s*space-between[^}]*flex-wrap:\s*nowrap/, 'row2 debe repartir sus dos grupos en el mismo renglón, sin permitir que se apilen');
  assert.match(stylesCss, /\.player-home-lastmatch__row2-left\{/, 'forma+resultado deben vivir agrupados en su propio wrapper dentro de row2');
});

/* ---- Punto A: CORRECCIÓN PENDIENTE sin píldora ---- */

test('h17-A: CORRECCIÓN PENDIENTE se pinta como texto ámbar liso, nunca como .player-home-lastmatch__badge (píldora)', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerLastMatchCard');
  assert.match(body, /hasActiveCorrectionOnLastMatch\s*\n\s*\? `<span class="player-home-lastmatch__status-text player-home-lastmatch__status-text--correction">/, 'el caso de corrección activa debe usar la clase de texto plano, no el badge compartido');
});

test('h17-A: .status-text no lleva fondo/borde/radio propios (sin cápsula/píldora/contenedor)', () => {
  const rule = stylesCss.match(/\.player-home-lastmatch__status-text\{([^}]*)\}/);
  assert.ok(rule, 'debe existir la regla .player-home-lastmatch__status-text');
  assert.doesNotMatch(rule[1], /background|border-radius|padding|border:/, 'no debe llevar ninguna propiedad de cápsula/píldora');
  assert.match(rule[1], /white-space:\s*nowrap/, 'no debe poder wrappear en el ancho móvil de referencia');
});

/* ---- Punto C: Aceptar / Rechazar — apilados full width en móvil ---- */

test('h17-C: en móvil, Aceptar/Rechazar quedan apilados a ancho completo (nunca lado a lado)', () => {
  assert.match(stylesCss, /\.b6-action-row\{[^}]*flex-direction:\s*column/, 'móvil (default, sin media query) debe apilar verticalmente');
  assert.match(stylesCss, /\.b6-action-row__btn\{[^}]*width:\s*100%/, 'cada botón debe ocupar el ancho completo en móvil');
});

test('h17-C: se resetea el margin-top asimétrico heredado de .btn-start, SOLO dentro de este par', () => {
  assert.match(stylesCss, /\.b6-action-row__btn\{[^}]*margin-top:\s*0/, 'debe neutralizar el margin-top:10px de .btn-start dentro del par Aceptar/Rechazar');
  // El sistema global de botones no cambia: .btn-start sigue trayendo su margin-top propio.
  assert.match(stylesCss, /\.btn-start\{[^}]*margin-top:\s*10px/, 'no debe tocarse el margin-top global de .btn-start');
});

test('h17-C: desktop puede volver a horizontal, con paridad de ancho real (flex:1 en ambos)', () => {
  assert.match(stylesCss, /@media \(min-width:\s*720px\)\{\s*\.b6-action-row\{[^}]*flex-direction:\s*row/, 'desktop debe poder volver a fila horizontal');
  assert.match(stylesCss, /@media \(min-width:\s*720px\)\{\s*\.b6-action-row__btn\{[^}]*flex:\s*1/, 'en desktop ambos botones deben repartir el ancho por igual');
});

/* ---- Punto B: Resumen — bloque de corrección como una sola unidad ---- */

test('h17-B: se retira el texto blanco introductorio redundante para quien debe responder', () => {
  const body = extractFunctionBody(appJs, 'paintB6Actions');
  assert.doesNotMatch(body, /respondText\.textContent = isResponder\s*\n\s*\? `\$\{proposerName\} propuso/, 'la frase redundante "[Nombre] propuso una corrección del resultado." ya no debe asignarse a respondText');
  assert.match(body, /respondText\.hidden = isResponder/, 'debe ocultar el texto introductorio cuando la pareja debe responder (ya cubierto por rótulo + explicación humana)');
  assert.match(body, /respondText\.textContent = isResponder \? '' : 'Esperando respuesta de la otra pareja\.'/, 'para quien propuso, el texto de espera debe seguir existiendo (no es redundante)');
});

test('h17-B: se retira el diff técnico redundante del bloque POST-validación, sin tocar el de PRE-validación', () => {
  assert.doesNotMatch(appJs, /renderCorrectionDiff\('b6-respond-correction-diff'/, 'el diff técnico del bloque de respuesta ya no debe pintarse');
  assert.doesNotMatch(indexHtml, /id="b6-respond-correction-diff"/, 'el <ul> del diff técnico ya no debe existir en el marcado');
  assert.match(appJs, /renderCorrectionDiff\('b6-status-banner-diff'/, 'el diff PRE-validación (fuera de alcance de h17) debe seguir intacto');
});

test('h17-B: rótulo + propuesta + explicación + acciones se agrupan como una sola unidad visual (acento ámbar en la propuesta, sin caja nueva por encima)', () => {
  assert.match(stylesCss, /\.b6-correction-compare \.result-card\{[^}]*border-color:\s*rgba\(255,201,61/, 'la tarjeta de la propuesta debe llevar acento ámbar propio');
  // "sin caja nueva por encima": no debe aparecer un wrapper --correction con su propio
  // border+padding envolviendo TODO el bloque (eso sería una segunda caja sobre la ya existente).
  assert.doesNotMatch(stylesCss, /\.b6-action-block--correction\{/, 'no debe agregarse una segunda caja pesada envolviendo todo el bloque');
});

/* ---- Regresión h16: Reportar un error (fuera de alcance, debe seguir intacto) ---- */

test('h17: Reportar un error no se reabre (sigue en sentence case, secundario, rojo suave)', () => {
  assert.match(indexHtml, /id="b6-report-error-btn"[^>]*>Reportar un error<\/button>/);
  assert.match(stylesCss, /#b6-report-error-btn\s*\{[^}]*text-transform:\s*none;[^}]*font-weight:\s*600;[^}]*letter-spacing:\s*0\.01em;/s);
});

/* ---- Bundle/cache quartet de esta ronda ---- */

test('h17: bundle/cache quartet queda alineado', () => {
  assert.match(indexHtml, /app\.js\?v=04\.11-h17/);
  assert.match(indexHtml, /styles\.css\?v=04\.11-h17/);
  assert.match(storeJs, /BUNDLE_VERSION = '04\.11-h17'/);
  assert.match(swJs, /CACHE_NAME = 'bramulab-v04-11-h17'/);
  assert.match(swJs, /app\.js\?v=04\.11-h17/);
  assert.match(swJs, /styles\.css\?v=04\.11-h17/);
  assert.match(versionJson, /"bundle":\s*"04\.11-h17"/);
});
