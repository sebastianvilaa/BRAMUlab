import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function fnBody(name) {
  const i = app.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `falta ${name}`);
  const end = app.indexOf('\n  }\n', i);
  return app.slice(i, end);
}

test('handoff 63: código de validado+score distinto muestra POSIBLE PARTIDO DUPLICADO, no NECESITA REVISIÓN', () => {
  const body = fnBody('serverMatchStatusLabel');
  assert.match(body, /isPossibleDuplicateEntry\(f\) \? 'POSIBLE PARTIDO DUPLICADO' : 'NECESITA REVISIÓN'/);
  const pd = fnBody('isPossibleDuplicateEntry');
  assert.match(pd, /validated_match_needs_bloque6_correction/);
});

test('handoff 63: el outcome abre el modal con un único candidato y conserva matchId en lastError', () => {
  const body = fnBody('handleCreateOrAttachOutcome');
  const i = body.indexOf("code === 'validated_match_needs_bloque6_correction'");
  const j = body.indexOf('MATCH_BUSINESS_ERROR_CODES.has(code)');
  assert.ok(i >= 0 && j > i, 'la rama del duplicado va ANTES del error de negocio genérico');
  assert.match(body.slice(i, j), /openPossibleDuplicateModal\(entry, existingMatchId\)/);
  assert.match(body.slice(i, j), /lastError: \{ code, matchId: existingMatchId \}/);
});

test('handoff 63: "Es el mismo partido" deriva a la corrección vigente sin crear partido; "Es otro partido" usa disambiguationForceNew', () => {
  const same = fnBody('resolveSameMatchAsCorrection');
  assert.match(same, /removeMatchOutboxEntry/);
  assert.match(same, /openProposeCorrection\(/);
  assert.doesNotMatch(same, /createOrAttach/);
  assert.match(fnBody('forceNewFromAmbiguous'), /disambiguationForceNew: true/);
  assert.match(app, /\$\('#ambiguous-match-force-new'\)\.addEventListener\('click', forceNewFromAmbiguous\)/);
});

test('handoff 63: múltiples candidatos conserva el copy y flujo de desambiguación existente', () => {
  const body = fnBody('openAmbiguousMatchModal');
  assert.match(body, /AMBIGUOUS_MODAL_COPY\.multiple\.title/);
  assert.match(body, /resolveAmbiguousMatch\(btn\.dataset\.matchId\)/);
  assert.match(html, /id="ambiguous-match-title"/);
  assert.match(html, /id="ambiguous-match-text"/);
});

test('handoff 63: el banner del Resumen ofrece Revisar para el duplicado', () => {
  assert.match(app, /outboxActionBtn\.textContent = 'Revisar';[\s\S]{0,300}openPossibleDuplicateModal/);
});
