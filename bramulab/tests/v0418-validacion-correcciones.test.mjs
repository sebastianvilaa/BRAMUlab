// BRAMUlab — V04.18 (Issue #14: circuito de validación/correcciones = #12 NO HAY ERROR + #13 Set 3 huérfano).
// Ejecutar con: node --test bramulab/tests/v0418-validacion-correcciones.test.mjs
// Backend (sostener revisión, idempotencia, concurrencia, deadline, pareja única): supabase/tests/verify-preprod-v0418-sustain-revision.sql.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const css = read('styles.css');
const indexHtml = read('index.html');
function fnBody(src, sig, len = 3000) { const i = src.indexOf(sig); assert.ok(i >= 0, sig); return src.slice(i, i + len); }

/* ================= #13 — editor de corrección (lógica REAL de app.js, sin DOM) ================= */
function makeEditor() {
  const a = appJs.indexOf('  function b6CorrectionNeededSlots()');
  const b = appJs.indexOf('  function openProposeCorrection(f, sourceOutboxDraftId)');
  const code = appJs.slice(a, b);
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(read('engine.js'), sb);
  vm.runInContext(read('match-load.js'), sb);
  sb.E = sb.PLEngine || sb.E; sb.ML = sb.PLMatchLoad;
  const els = {};
  const el = (k) => els[k] || (els[k] = { hidden: false, disabled: false, textContent: '', innerHTML: '', classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {} });
  sb.$ = el; sb.$all = () => [];
  sb.S = { teamLabel: () => 'X' };
  sb.prompts = [];
  sb.confirmAction = (title, text, ok, cancel) => { sb.prompts.push({ title, text, ok, cancel }); };
  vm.runInContext(`
    let b6CorrectionMatch = { players: [] }; let b6CorrectionFormat = null; let b6CorrectionSets = [null, null, null];
    let b6CorrectionDraftSet = { a: undefined, b: undefined }; let b6CorrectionActiveSetIndex = 0; let b6CorrectionDraftActiveTeam = 'A';
    let b6CorrectionKeypadOpen = false; let b6CorrectionKeypadDigits = ''; let b6CorrectionDecided = false; let b6CorrectionSideEntered = { a: false, b: false };
    ${code}
    globalThis.__api = {
      press: pressProposeCorrectionKeypadKey, openKeypad: openProposeCorrectionKeypad, reopen: reopenProposeCorrectionSet,
      state: () => ({ sets: JSON.parse(JSON.stringify(b6CorrectionSets)), decided: b6CorrectionDecided, active: b6CorrectionActiveSetIndex, draft: { ...b6CorrectionDraftSet }, keypadOpen: b6CorrectionKeypadOpen }),
      init: (sets) => { b6CorrectionFormat = E.FORMATS.classic; b6CorrectionSets = sets; const n = ML.resolveActiveSetIndex(b6CorrectionSets, b6CorrectionFormat);
        b6CorrectionDecided = n === null; b6CorrectionActiveSetIndex = n === null ? Math.max(0, b6CorrectionNeededSlots() - 1) : n;
        const ae = b6CorrectionSets[b6CorrectionActiveSetIndex]; b6CorrectionDraftSet = ae ? { a: ae.a, b: ae.b } : { a: undefined, b: undefined };
        b6CorrectionSideEntered = { a: false, b: false }; renderProposeCorrectionScoreboard(); },
    };`, sb);
  const api = sb.__api;
  const strip = (st) => JSON.parse(JSON.stringify(st));
  return { api, sb, els, state: () => strip(api.state()) };
}
const set = (a, b) => ({ a, b });
const type = (ed, team, digit) => { ed.api.openKeypad(team); ed.api.press(digit); };

test('#13 BO3 6-4 / 0-6 / 6-4 → Set 2 a 6-4: el aviso aparece INMEDIATO; confirmar descarta el Set 3, decide el resultado y habilita ENVIAR', () => {
  const ed = makeEditor();
  ed.api.init([set(6, 4), set(0, 6), set(6, 4)]);
  assert.equal(ed.els['#propose-correction-submit'].disabled, false, 'estado inicial 3 sets decidido');
  ed.api.reopen(1);
  assert.equal(ed.els['#propose-correction-submit'].disabled, true, 'reabrir un set: no se puede enviar un estado a medio editar');
  type(ed, 'A', '6');
  assert.equal(ed.sb.prompts.length, 0, 'todavía (6,6) inválido: sin aviso');
  type(ed, 'B', '4');
  assert.equal(ed.sb.prompts.length, 1, 'aviso en el MOMENTO de consolidar el set que vuelve huérfano al tercero');
  assert.equal(ed.sb.prompts[0].title, 'Este cambio ya no necesita un tercer set');
  assert.equal(ed.sb.prompts[0].text, 'El resultado que ya cargaste en el Set 3 se va a descartar.');
  assert.deepEqual(ed.state().sets, [set(6, 4), set(0, 6), set(6, 4)], 'hasta confirmar NADA se consolidó');
  ed.sb.prompts[0].ok();
  const st = ed.state();
  assert.deepEqual(st.sets, [set(6, 4), set(6, 4), null], 'Set 2 consolidado y Set 3 descartado');
  assert.equal(st.decided, true, 'resultado decidido');
  assert.equal(st.keypadOpen, false, 'teclado cerrado');
  assert.equal(ed.els['#propose-correction-submit'].disabled, false, 'ENVIAR CORRECCIÓN habilitado');
  assert.equal(ed.els['#propose-correction-hint'].hidden, false);
  assert.equal(ed.sb.prompts.length, 1, 'sin avisos repetidos');
});

test('#13 cancelar: el Set 3 se conserva, el cambio no se consolida y ENVIAR no acepta un estado inconsistente', () => {
  const ed = makeEditor();
  ed.api.init([set(6, 4), set(0, 6), set(6, 4)]);
  ed.api.reopen(1);
  type(ed, 'A', '6'); type(ed, 'B', '4');
  assert.equal(ed.sb.prompts.length, 1);
  ed.sb.prompts[0].cancel();
  const st = ed.state();
  assert.deepEqual(st.sets, [set(6, 4), set(0, 6), set(6, 4)], 'Set 2 y Set 3 intactos');
  assert.equal(st.decided, false);
  assert.equal(ed.els['#propose-correction-submit'].disabled, true, 'submit deshabilitado');
  // sigue editable: puede volver a un resultado que sí necesita Set 3 (6-4 / 0-6 / 6-4 con Set 2 → 1-6)
  type(ed, 'A', '1');
  assert.equal(ed.state().draft.a, 1);
});

test('#13 editar el Set 1 de modo que el Set 3 quede huérfano aplica la misma regla', () => {
  const ed = makeEditor();
  ed.api.init([set(4, 6), set(6, 4), set(6, 3)]);   // 1-1 → Set 3
  ed.api.reopen(0);
  type(ed, 'A', '6'); type(ed, 'B', '3');           // Set 1 → 6-3: Seba gana ambos
  assert.equal(ed.sb.prompts.length, 1, 'aviso inmediato');
  ed.sb.prompts[0].ok();
  assert.deepEqual(ed.state().sets, [set(6, 3), set(6, 4), null]);
  assert.equal(ed.state().decided, true);
});

test('#13 1-1 real sigue exigiendo Set 3; un cambio que no altera la necesidad de Set 3 NO pregunta', () => {
  const ed = makeEditor();
  ed.api.init([set(6, 4), set(4, 6), null]);
  const st0 = ed.state();
  assert.equal(st0.decided, false, '1-1 sin Set 3 => no decidido');
  assert.equal(st0.active, 2, 'pide el Set 3');
  assert.equal(ed.els['#propose-correction-submit'].disabled, true);
  // 1-1 con Set 3 cargado: editar Set 2 de 4-6 a 3-6 mantiene el 1-1 => sin prompt
  const ed2 = makeEditor();
  ed2.api.init([set(6, 4), set(4, 6), set(6, 3)]);
  ed2.api.reopen(1);
  type(ed2, 'A', '3');                               // B sigue en 6 (valor existente): 3-6 sigue siendo 1-1
  assert.equal(ed2.sb.prompts.length, 0, 'no hace falta preguntar: el Set 3 sigue siendo necesario');
  assert.deepEqual(ed2.state().sets, [set(6, 4), set(3, 6), set(6, 3)]);
  assert.equal(ed2.state().decided, true);
});

test('#13 reabrir un set preexistente y modificar UN solo lado sigue funcionando; A→B y B→A convergen al mismo estado', () => {
  const ed = makeEditor();
  ed.api.init([set(6, 4), set(6, 2), null]);
  assert.equal(ed.state().decided, true);
  ed.api.reopen(1);
  type(ed, 'B', '3');                                // solo cambia el lado B: 6-3
  assert.deepEqual(ed.state().sets, [set(6, 4), set(6, 3), null]);
  assert.equal(ed.state().decided, true);
  assert.equal(ed.sb.prompts.length, 0);
  const x = makeEditor(); x.api.init([set(6, 4), set(0, 6), set(6, 4)]); x.api.reopen(1);
  type(x, 'A', '6'); type(x, 'B', '4'); x.sb.prompts[0].ok();
  const y = makeEditor(); y.api.init([set(6, 4), set(0, 6), set(6, 4)]); y.api.reopen(1);
  type(y, 'B', '4'); type(y, 'A', '6'); y.sb.prompts[0].ok();
  assert.deepEqual(x.state(), y.state(), 'mismo estado final sin importar el orden de los lados');
});

test('#13 "Listo" explícito y el auto-avance convergen: ambos pasan por commitProposeCorrectionSetIfValid', () => {
  const press = fnBody(appJs, '  function pressProposeCorrectionKeypadKey', 1800);
  assert.match(press, /key === 'done'[\s\S]*?closeProposeCorrectionKeypad\(\);\s*commitProposeCorrectionSetIfValid\(\);/);
  assert.match(fnBody(appJs, '  function advanceProposeCorrectionDraftSide', 900), /closeProposeCorrectionKeypad\(\);\s*commitProposeCorrectionSetIfValid\(\);/);
});

test('#13 cerrar el modal NUNCA es el disparador del pruning', () => {
  const close = fnBody(appJs, '  function closeProposeCorrection()', 600);
  assert.doesNotMatch(close, /PruneOrphanThirdSet|commitProposeCorrectionSetIfValid|confirmAction/);
  const closeKp = fnBody(appJs, '  function closeProposeCorrectionKeypad', 400);
  assert.doesNotMatch(closeKp, /PruneOrphanThirdSet|commitProposeCorrectionSetIfValid|confirmAction/);
});

test('#13 RAÍZ: el modal de confirmación queda por ENCIMA de cualquier bottom-sheet (antes se abría detrás del editor)', () => {
  const z = (re) => Number((css.match(re) || [])[1]);
  const sheet = z(/\.sheet-scrim\{\s*position: fixed; inset: 0; z-index: (\d+);/);
  const confirm = z(/#confirm-overlay\{ z-index: (\d+); \}/);
  assert.ok(Number.isFinite(sheet) && Number.isFinite(confirm), 'ambos z-index definidos');
  assert.ok(confirm > sheet, `confirm (${confirm}) > sheet (${sheet})`);
  // y el propio scrim de la corrección es un .sheet-scrim (comparte z-index con los demás sheets)
  assert.match(indexHtml, /id="propose-correction-scrim" class="sheet-scrim"/);
});

/* ================= #12 — NO HAY ERROR ================= */
test('#12 UI: ACEPTAR CORRECCIÓN / NO HAY ERROR; "No hay error" confirma y llama al backend (nunca solo vuelve al Home)', () => {
  assert.match(indexHtml, /id="b6-pre-keep-btn">No hay error</);
  assert.match(indexHtml, /id="b6-pre-accept-btn">Aceptar corrección</);
  assert.doesNotMatch(indexHtml.match(/id="b6-pre-actions"[\s\S]*?<\/div>/)[0], /Mantener resultado cargado/);
  const h = fnBody(appJs, "    $('#b6-pre-keep-btn').addEventListener", 1600);
  assert.match(h, /confirmAction\(\s*'¿Confirmás que no hay error\?'/);
  assert.match(h, /Vas a indicar que el resultado original estaba bien cargado\. La otra pareja tendrá que confirmarlo o proponer otro cambio\./);
  assert.match(h, /MV\.sustainMatchRevision\(matchId, revision\)/);
  assert.match(h, /analysisCurrent\.currentRevisionNumber/, 'revisión esperada (concurrencia)');
  assert.match(h, /Indicamos que el resultado original está bien\. Esperando respuesta de la otra pareja\./);
  assert.match(h, /stale_revision/);
  assert.doesNotMatch(h, /openPlayerHome\(\)/);
  assert.doesNotMatch(h, /No confirmaste la corrección/);
});

test('#12 clasificación: revision_sustained => sustained_original (y revision_proposed / participant_replaced siguen igual)', () => {
  const sb = {}; vm.createContext(sb);
  vm.runInContext(read('engine.js'), sb); vm.runInContext(read('match-load.js'), sb);
  const ML = sb.PLMatchLoad;
  const c = (types) => ML.classifyPendingRevisionEvent(types.map((t) => ({ actionType: t })));
  assert.equal(c(['created', 'revision_proposed']), 'result_correction');
  assert.equal(c(['created', 'revision_proposed', 'revision_sustained']), 'sustained_original');
  assert.equal(c(['created', 'revision_proposed', 'revision_sustained', 'revision_proposed']), 'result_correction', 'REPORTAR UN ERROR posterior (R4) vuelve a ser corrección');
  assert.equal(c(['created', 'participant_replaced']), 'identity_replacement');
  assert.equal(c(['created']), 'original');
  assert.equal(ML.classifyPendingRevisionEvent(null), 'original');
});

test('#12 UI de la pareja que propuso la corrección: banner con el score original y las acciones YA conocidas (Validar partido / Reportar un error)', () => {
  const act = fnBody(appJs, "        } else if (pendingEventType === 'sustained_original') {", 1400);
  assert.match(act, /b6LastActorForActionType\(f, 'revision_sustained'\)/);
  assert.match(act, /indicó que no hay error en el resultado original\./);
  assert.match(act, /paintPendingInResultCard\(f, 'act', null, \{ titleText: noErrorText \}\)/, 'mismo componente: Validar partido + Reportar un error sobre el resultado vigente');
  const wait = fnBody(appJs, "        } else if (pendingEventType === 'sustained_original') {\n          const sustainedText", 700);
  assert.match(wait, /Indicamos que el resultado original está bien\. Esperando respuesta de la otra pareja\./);
  // no se crea otra familia de botones: los data-pv validate/report los da paintPendingInResultCard
  assert.match(fnBody(appJs, '  function paintPendingInResultCard', 1500), /data-pv="report">Reportar un error[\s\S]*?data-pv="validate">Validar partido/);
});

test('#12 cliente: MV.sustainMatchRevision llama a la RPC con la revisión esperada y normaliza errores', async () => {
  const mk = (resp) => {
    const sb = { __BRAMU_ENV__: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'a' },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      supabase: { createClient: () => ({ rpc: async (n, p) => { sb.__call = { n, p }; return resp; } }) } };
    vm.createContext(sb); vm.runInContext(read('auth.js'), sb); vm.runInContext(read('match-validation.js'), sb); return sb;
  };
  let sb = mk({ data: { ok: true, changed: true, actionSide: 'B' }, error: null });
  const r = await sb.PLMatchValidation.sustainMatchRevision('m1', 2);
  assert.deepEqual(JSON.parse(JSON.stringify(sb.__call)), { n: 'sustain_match_revision', p: { p_match_id: 'm1', p_expected_revision_number: 2 } });
  assert.equal(r.ok, true);
  sb = mk({ data: { ok: false, code: 'stale_revision' }, error: null });
  assert.equal((await sb.PLMatchValidation.sustainMatchRevision('m1', 2)).code, 'stale_revision');
  sb = mk({ data: null, error: { message: 'boom' } });
  assert.deepEqual(JSON.parse(JSON.stringify(await sb.PLMatchValidation.sustainMatchRevision('m1', 2))), { ok: false, code: 'boom' });
});

test('#12 backend (estático): revisión append-only, deadline intacto, pareja única, idempotente, sin efectos de Nivel; post-validación intacta', () => {
  const sql = read('../supabase/migrations/20260930260000_preprod_v0418_sustain_match_revision.sql').replace(/--.*$/gm, '');
  assert.match(sql, /'sustained_revision'/);
  assert.match(sql, /'revision_sustained'/);
  assert.match(sql, /v_match\.action_side is distinct from v_team/, 'autoridad por pareja');
  assert.match(sql, /p_expected_revision_number/);
  assert.match(sql, /'stale_revision'/);
  assert.match(sql, /'already_sustained'/);
  assert.doesNotMatch(sql, /validation_deadline_at\s*=/, 'el deadline original no se reinicia');
  assert.doesNotMatch(sql, /status\s*=\s*'validated'|match_level|level_events|ranking/i, 'no valida ni toca Nivel/estadísticas');
  assert.doesNotMatch(sql, /delete from|update public\.match_sets|update public\.match_revisions/i, 'append-only');
  assert.doesNotMatch(sql, /rejected/, 'sin estado rejected');
  // no redefine nada del flujo post-validación
  ['propose_post_validation_correction', 'respond_post_validation_correction', 'confirm_match_validation', 'create_or_attach_match'].forEach((fn) => {
    assert.doesNotMatch(sql, new RegExp(`function public\\.${fn}\\(`), fn);
  });
  // "Mantener resultado actual" post-validación sigue igual
  assert.match(appJs, /'¿Mantener el resultado cargado\?'/);
});
