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

function extractFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

/* ---- Punto A: Último partido — estructura estable normal vs corrección ---- */

// SUPERSEDIDO en el ajuste visual final post-h18 (doc 57, punto A): h18 había vuelto a apilar
// PENDIENTE DE VALIDACIÓN/IDENTIDAD CUESTIONADA/etc. bajo fecha/hora — Sebastián pidió
// explícitamente generalizar TODOS los estados al status-slot de row2 ("No volver a la solución
// h18"). Ver h19-visual-regression.test.mjs para la guarda vigente.
test('h17-A/h19: TODOS los estados operativos viven en el status-slot de row2 (nunca bajo fecha/hora)', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerLastMatchCard');
  const row2Idx = body.indexOf('player-home-lastmatch__row2"');
  const statusSlotIdx = body.indexOf('player-home-lastmatch__status-slot');
  assert.ok(row2Idx !== -1 && statusSlotIdx > row2Idx, 'el status-slot debe vivir dentro de row2');
  assert.doesNotMatch(body, /player-home-lastmatch__badge-slot/, 'ningún estado debe seguir viviendo bajo fecha/hora');
});

test('h17-A: row2 mantiene los dos grupos (forma+resultado / status) en el mismo renglón, sin wrap', () => {
  assert.match(stylesCss, /\.player-home-lastmatch__row2\{[^}]*justify-content:\s*space-between[^}]*flex-wrap:\s*nowrap/, 'row2 debe repartir sus dos grupos en el mismo renglón, sin permitir que se apilen');
  assert.match(stylesCss, /\.player-home-lastmatch__row2-left\{/, 'forma+resultado deben vivir agrupados en su propio wrapper dentro de row2');
});

/* ---- Punto A: CORRECCIÓN PENDIENTE sin píldora ---- */

test('h17-A: CORRECCIÓN PENDIENTE se pinta como texto ámbar liso, nunca como .player-home-lastmatch__badge (píldora)', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerLastMatchCard');
  assert.match(body, /hasActiveCorrectionOnLastMatch\s*\n\s*\? 'CORRECCIÓN PENDIENTE'/, 'el caso de corrección activa debe seguir generando el texto CORRECCIÓN PENDIENTE');
  assert.match(body, /player-home-lastmatch__status-text player-home-lastmatch__status-text--\$\{lastMatchStatusModifier\}/, 'el status-slot debe usar la clase de texto plano, no el badge compartido');
});

test('h17-A: .status-text no lleva fondo/borde/radio propios (sin cápsula/píldora/contenedor)', () => {
  const rule = stylesCss.match(/\.player-home-lastmatch__status-text\{([^}]*)\}/);
  assert.ok(rule, 'debe existir la regla .player-home-lastmatch__status-text');
  assert.doesNotMatch(rule[1], /background|border-radius|padding|border:/, 'no debe llevar ninguna propiedad de cápsula/píldora');
  assert.match(rule[1], /white-space:\s*nowrap/, 'no debe poder wrappear en el ancho móvil de referencia');
});

// SUPERSEDIDO en el ajuste visual final post-h18 (doc 57, punto E): Sebastián pidió
// explícitamente volver a lado a lado TAMBIÉN en móvil, con estilo outline inspirado en los
// selectores Clásico/Americano de Cargar partido (nunca más apilado full-width ni botón lima
// macizo) — `.b6-action-row`/`.b6-action-row__btn` ya no existen. Ver
// h19-visual-regression.test.mjs para la guarda vigente (`.b6-correction-choices`/
// `.b6-correction-choice`).

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

// SUPERSEDIDO en el ajuste visual final post-h18 (doc 57, puntos D/F): el acento ámbar de h17
// vivía en la tarjeta INTERNA (.b6-correction-compare .result-card); Sebastián pidió una única
// tarjeta con borde/halo ámbar envolviendo TODO el bloque (rótulo+propuesta+explicación+espera+
// acciones) — la interna pierde su borde propio para no quedar "caja dentro de caja". Ver
// h19-visual-final-adjustment.test.mjs (h19-F) para la guarda vigente (.b6-correction-card).

/* ---- Regresión h16: Reportar un error (fuera de alcance, debe seguir intacto) ---- */

// SUPERSEDIDO en el sistema visual unificado h21 (doc 59): el override puntual de
// #b6-report-error-btn se retiró junto con `.btn-secondary` (ver h16-report-error-cta.test.mjs
// para la guarda de sentence case vigente sobre `.b6-correction-choice`).
test('h17/h21: Reportar un error sigue en sentence case, secundario, rojo suave', () => {
  assert.match(indexHtml, /id="b6-report-error-btn"[^>]*>Reportar un error<\/button>/);
  assert.match(stylesCss, /\.b6-correction-choice--report\{[^}]*color:\s*var\(--danger\);?\s*\}/);
});

// El quartet de bundle/cache hardcodeado a "04.11-h17" quedó superseded por el de la ronda
// vigente — ver h19-visual-regression.test.mjs para el quartet de la ronda actual.
