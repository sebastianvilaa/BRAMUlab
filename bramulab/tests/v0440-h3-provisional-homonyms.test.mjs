// V04.40-h3: dos jugadores pueden compartir nombre visible sin compartir identidad.
// node --test bramulab/tests/v0440-h3-provisional-homonyms.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
function between(from, to) {
  const begin = app.indexOf(from);
  const end = app.indexOf(to, begin + from.length);
  assert.ok(begin >= 0 && end > begin, 'source method boundaries exist');
  return app.slice(begin, end);
}
const builder = between('  function buildAddPlayerRowHTML(trimmed, isSameName = false) {', '  // Backend Bloque 5 (§4');
const renderer = between('  async function renderManualPlayerSheetContentServerBacked(query) {', '  /** Backend Bloque 4 — `create_provisional_player`');
const select = between('  function selectManualPlayer(name, playerId, kind) {', '  /** V02.2 (Bloque C, §8)');

function prepare(query, registered = [], provisional = []) {
  const elements = new Map();
  const $ = (key) => {
    if (!elements.has(key)) elements.set(key, {
      value: key === '#load-player-sheet-search' ? query : '',
      hidden: false, innerHTML: '',
      addEventListener(_event, handler) { this.handler = handler; },
    });
    return elements.get(key);
  };
  const created = [];
  const deps = {
    manualActiveSheetSlot: 'a2',
    manualExcludedPlayerIdsForSlot: () => [],
    $, $all: () => [],
    Matches: { listRelatedProvisionalPlayers: async () => ({ ok: true, players: provisional }) },
    Auth: {
      listMyProvisionalPlayers: async () => ({ ok: true, players: [] }),
      searchPlayers: async () => ({ ok: true, players: registered }),
    },
    normalizePlayerName: (str) => str.trim(),
    stashManualCompact: () => {},
    buildProvisionalRowHTML: (p) => '<button data-player-id="' + p.player_id + '">provisional:' + p.display_name + '</button>',
    buildPlayerRowHTMLFromServerRow: (p) => '<button data-player-id="' + p.player_id + '">registrado:' + p.display_name + '</button>',
    escapeHtml: (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    createManualProvisionalAndSelect: (name) => created.push(name),
    PH: { computeRecentRealPlayers: () => [] },
    getDisplayHistory: () => [], currentIdentity: () => null,
  };
  const run = new Function('deps', 'with (deps) {\n' + builder + '\n' + renderer + '\nreturn renderManualPlayerSheetContentServerBacked;\n}')(deps);
  return { run: () => run(query), $, created };
}

for (const sample of [
  { title: 'homónimo registrado', registered: [{ player_id: 'registered-1', display_name: 'Esteban' }], provisional: [] },
  { title: 'homónimo provisional', registered: [], provisional: [{ player_id: 'provisional-1', display_name: 'Esteban' }] },
  { title: 'ambas identidades existentes', registered: [{ player_id: 'registered-1', display_name: 'Esteban' }], provisional: [{ player_id: 'provisional-1', display_name: 'Esteban' }] },
]) {
  test('Permite agregar otro Esteban aunque exista ' + sample.title, async () => {
    const { run, $, created } = prepare('Esteban', sample.registered, sample.provisional);
    await run();
    const html = $('#load-player-sheet-list').innerHTML;
    assert.match(html, /id="load-player-sheet-add"/);
    assert.match(html, /Agregar a “Esteban”/);
    assert.match(html, /Otra persona sin cuenta/);
    for (const r of sample.registered) assert.match(html, new RegExp('registrado:' + r.display_name));
    for (const p of sample.provisional) assert.match(html, new RegExp('provisional:' + p.display_name));
    $('#load-player-sheet-add').handler();
    assert.deepEqual(created, ['Esteban']);
  });
}

test('El alta sigue visible sin coincidencias y oculta con menos de 2 caracteres', async () => {
  const enough = prepare('Esteba');
  await enough.run();
  assert.match(enough.$('#load-player-sheet-list').innerHTML, /id="load-player-sheet-add"/);
  assert.doesNotMatch(enough.$('#load-player-sheet-list').innerHTML, /Otra persona sin cuenta/);
  const short = prepare('E');
  await short.run();
  assert.doesNotMatch(short.$('#load-player-sheet-list').innerHTML, /id="load-player-sheet-add"/);
});

test('La selección sigue deduplicando por player_id, no por nombre visible', () => {
  const ids = { a2: null }, names = { a2: null }, toasts = [];
  const deps = {
    manualActiveSheetSlot: 'a2', manualServerBacked: true,
    manualPlayerIds: ids, manualPlayers: names,
    manualExcludedPlayerIdsForSlot: () => ['already-selected-id'],
    normalizePlayerName: (name) => name.trim(),
    showToast: (message) => toasts.push(message),
    ML: { isDuplicatePlayerName: () => true },
    closeManualPlayerSheet: () => {}, markManualLoadDirty: () => {},
    renderManualPlayers: () => {}, renderManualScoreboard: () => {},
    ensureManualPlayerCompact: () => {}, advanceManualSelectionSequence: () => {},
  };
  const selectPlayer = new Function('deps', 'with (deps) {\n' + select + '\nreturn selectManualPlayer;\n}')(deps);
  selectPlayer('Esteban', 'new-provisional-id', 'provisional');
  assert.equal(ids.a2.playerId, 'new-provisional-id');
  assert.equal(ids.a2.kind, 'provisional');
  assert.equal(names.a2, 'Esteban');
  selectPlayer('Esteban', 'already-selected-id', 'registered');
  assert.equal(ids.a2.playerId, 'new-provisional-id');
  assert.equal(toasts.length, 1);
});
