// BRAMUlab V04.40 · Ronda 2 — descubrimiento en BUSCAR JUGADORES (frontend). Las reglas de datos se prueban en SQL real:
// supabase/functions/_shared/v0440-descubrimiento.test.mjs. Acá: guardas ESTÁTICAS del cliente (app.js es un IIFE sin DOM aislable).
// Ejecutar con: node --test bramulab/tests/v0440-descubrimiento-frontend.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'); const css = read('styles.css'); const appJs = read('app.js'); const authJs = read('auth.js');
const section = (id) => { const s = html.indexOf(`<section id="${id}"`); return html.slice(s, html.indexOf('</section>', s)); };
function fnBody(name) {
  const m = appJs.match(new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(m, `no se encontró ${name}`);
  const from = m.index + m[0].length;
  return appJs.slice(from, appJs.indexOf('\n  }\n', from));
}

test('estructura: dos secciones con los títulos pedidos, ocultas por defecto, dentro de BUSCAR JUGADORES y después del campo', () => {
  const v = section('view-player-search');
  assert.ok(v.indexOf('id="player-search-input"') < v.indexOf('id="player-discovery"'), 'el campo queda arriba');
  assert.match(v, /id="player-discovery" class="player-discovery" hidden/);
  assert.match(v, /id="player-discovery-connections"[^>]*hidden>\s*<div class="player-discovery__label">GENTE QUE QUIZÁS CONOZCAS</);
  assert.match(v, /id="player-discovery-zone"[^>]*hidden>\s*<div class="player-discovery__label">JUGADORES DE TU ZONA</);
  assert.match(v, /id="player-discovery-empty"[^>]*hidden>Todavía no tenemos sugerencias/);
  assert.match(v, /id="player-discovery-error"[^>]*hidden>No pudimos cargar las sugerencias/);
  assert.match(v, /id="player-search-empty"/, 'se conserva el estado «Sin coincidencias.» del buscador');
});

test('cliente: una sola RPC get_player_discovery, sin texto libre, avatares en UN batch', () => {
  const fn = authJs.slice(authJs.indexOf('async function getPlayerDiscovery'), authJs.indexOf('async function getPlayersCompact'));
  assert.match(fn, /c\.rpc\('get_player_discovery', \{ p_limit: limit \|\| 5 \}\)/);
  assert.match(fn, /resolveAvatarUrlsBatch\(rows\.map/);
  assert.match(fn, /connections: rows\.filter\(\(r\) => r\.section === 'connections'\), zone: rows\.filter\(\(r\) => r\.section === 'zone'\)/);
  assert.match(authJs, /searchPlayers, getPlayerDiscovery, getPlayersCompact/);
  assert.doesNotMatch(appJs, /\.from\('(matches|match_participants|player_saved_players|profiles)'\)[\s\S]{0,40}discovery/);
});

test('teclado: al entrar NO se enfoca el campo (queda cerrado y el campo listo para tocar)', () => {
  const open = fnBody('openPlayerSearchScreen');
  assert.doesNotMatch(open, /\.focus\(\)/, 'sin focus automático');
  assert.match(open, /playerDiscoveryCache = null/);
  assert.match(open, /renderPlayerSearchResults\(''\)/);
});

test('campo vacío -> sugerencias; texto -> ceden el lugar a search_players; error -> nunca «Sin coincidencias.»', () => {
  const body = fnBody('renderPlayerSearchResultsServerBacked');
  const emptyBranch = body.slice(body.indexOf('if (!trimmed)'), body.indexOf('setPlayerDiscoveryVisible(false);\n    if (trimmed.length < 2)'));
  assert.match(emptyBranch, /loadPlayerDiscovery\(\)/);
  assert.match(emptyBranch, /emptyEl\.hidden = true/, 'con el campo vacío no se muestra «Sin coincidencias.»');
  assert.match(body, /setPlayerDiscoveryVisible\(false\);\n    if \(trimmed\.length < 2\)/, 'al escribir se retira el bloque');
  const load = fnBody('loadPlayerDiscovery');
  const errIdx = load.indexOf('if (!result.ok)');
  assert.ok(errIdx > 0 && /player-discovery-error'\)\.hidden = false/.test(load.slice(errIdx, errIdx + 160)), 'error de conexión -> aviso propio');
  assert.doesNotMatch(load.slice(errIdx, load.indexOf('renderPlayerDiscoveryRows')), /player-discovery-empty'\)\.hidden = false|player-search-empty/, 'error != vacío');
  assert.match(load, /\$\('#player-discovery-empty'\)\.hidden = result\.connections\.length \+ result\.zone\.length > 0/, 'vacío honesto solo con respuesta exitosa sin filas');
  assert.match(load, /requestId !== playerDiscoveryRequestId \|\| \(\$\('#player-search-input'\)\.value \|\| ''\)\.trim\(\)/, 'respuesta tardía descartada');
  assert.match(appJs, /if \(value\.trim\(\)\) setPlayerDiscoveryVisible\(false\)/, 'las sugerencias ceden apenas se escribe (sin esperar el debounce)');
});

test('filas: mismo componente compacto, abren el Perfil público existente; Agregar/Quitar sigue siendo del perfil', () => {
  const rows = fnBody('renderPlayerDiscoveryRows');
  assert.match(rows, /buildPlayerRowHTMLFromServerRow/);
  assert.match(rows, /openPlayerPublicProfile\(\{ name: btn\.dataset\.name, playerId: btn\.dataset\.playerId \}, 'search'\)/);
  assert.match(rows, /section\.hidden = rows\.length === 0/, 'cada sección solo existe con resultados');
  assert.doesNotMatch(rows, /savePlayer|save_player|addPlayerTo/i, 'no agrega/quita desde la lista de sugerencias');
});

test('invitación: sigue condicionada a una búsqueda exitosa sin resultados y NO aparece junto a las sugerencias', () => {
  const body = fnBody('renderPlayerSearchResultsServerBacked');
  assert.match(body, /setGenericInviteVisible\(isEmpty\)/);
  assert.match(body.slice(body.indexOf('if (!trimmed)'), body.indexOf('if (trimmed.length < 2)')), /return;/);
});

test('alcance: sin nuevas tablas sociales en el cliente ni pantallas de seguidores/amistades', () => {
  assert.doesNotMatch(html, /Seguidores|Seguir a|Solicitud de amistad|follow/i);
  const sql = read('../supabase/migrations/20261009120000_discovery_get_player_discovery.sql');
  assert.doesNotMatch(sql, /create table/i);
  assert.match(sql, /revoke all on function public\.get_player_discovery\(integer\) from public;\s*grant execute on function public\.get_player_discovery\(integer\) to authenticated;/);
  assert.match(sql, /security definer\s*set search_path = public/i);
  assert.match(sql, /consume_rate_limit\(v_caller, 'get_player_discovery', 20, 60\)/);
  assert.match(sql, /m\.status = 'validated'/);
  assert.match(sql, /pl\.type = 'registered'[\s\S]*pl\.is_active[\s\S]*pr\.username is not null/);
});
