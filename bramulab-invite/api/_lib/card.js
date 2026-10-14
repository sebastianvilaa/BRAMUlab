// V04.41 — Tarjeta de vista previa de la invitación con el PARTIDO REAL (servicio público `bramulab-invite`).
//
// Decisión de producto (Sebastián, 14/10/2026): quien posea un enlace personal VÁLIDO ve, sin sesión, un resumen mínimo del partido que
// originó la invitación: nombres de los cuatro participantes + games por set (la pareja de la identidad invitada primero). La RPC
// `get_invitation_card` (anon, por token de 256 bits) no devuelve ids, usuarios, fotos, fechas ni estado, y responde `{ok:false}` idéntico para
// cualquier enlace inválido, vencido, rotado, usado o sin partido vigente.
//
// Render: `satori` (árbol → SVG con Inter) + `@resvg/resvg-wasm` (SVG → PNG, WebAssembly: sin binarios nativos). Solo usa SUPABASE_URL y
// SUPABASE_ANON_KEY (la clave publishable que ya viaja en el bundle de la app); nunca una clave de servicio.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TOKEN_RE = /^[0-9a-f]{64}$/;
const W = 1200;
const H = 630;
const C = { bg: '#050A12', surface: '#0D1A2A', text: '#F8FAFC', dim: '#9AA7B5', faint: '#687482', lime: '#95FF19', cyan: '#199FFF', line: 'rgba(183,211,235,0.20)' };

/** Valida y limpia la respuesta del RPC. Devuelve `{teams:[{names:[…],sets:[n…]}, …]}` o null si no es utilizable (nunca confía en el formato). */
export function parseCard(json) {
  if (!json || json.ok !== true || !Array.isArray(json.teams) || json.teams.length !== 2) return null;
  const teams = json.teams.map((t) => {
    const names = (Array.isArray(t && t.names) ? t.names : []).map((n) => String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean).slice(0, 2);
    const sets = (Array.isArray(t && t.sets) ? t.sets : []).map((g) => Number(g)).filter((g) => Number.isInteger(g) && g >= 0 && g <= 99).slice(0, 5);
    return { names, sets };
  });
  const n = teams[0].sets.length;
  if (teams.some((t) => t.names.length === 0) || n === 0 || teams[1].sets.length !== n) return null;
  return { teams };
}

/** Árbol de elementos (formato de satori) de la tarjeta 1200×630 (V04.42): el PARTIDO es el protagonista — dos parejas (una por fila, nombres grandes
 *  a la izquierda, games por set grandes a la derecha) — y debajo «Te invitaron a [logo oficial]» + una frase. El logo aparece UNA vez, integrado en el
 *  título. Con `card === null` dibuja la tarjeta de MARCA (barras neutras, sin nombres ni números: nunca se inventan datos); `og/marca.png` sale de ahí. */
export function buildCardTree(card, logoDataUri) {
  const el = (type, style, children, props) => ({ type, props: { ...(props || {}), style, children } });
  const demo = !card;
  const teams = card ? card.teams : [{ names: [null, null], sets: [null, null, null] }, { names: [null, null], sets: [null, null, null] }];
  const n = teams[0].sets.length;
  const cellW = n > 3 ? 100 : 128;
  const cellH = n > 3 ? 100 : 112;
  const gap = n > 3 ? 12 : 16;
  const row = (team, idx) => {
    const other = teams[idx === 0 ? 1 : 0].sets;
    const accent = idx === 0 ? C.lime : C.cyan;
    const cells = team.sets.map((g, i) => {
      const win = !demo && g > other[i];
      const lose = !demo && g < other[i];
      return el('div', {
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: cellW, height: cellH, borderRadius: 24,
        border: `3px solid ${win ? accent : 'rgba(183,211,235,0.22)'}`, background: win ? 'rgba(255,255,255,0.09)' : 'rgba(3,7,13,0.55)',
        color: win ? C.text : (lose ? C.faint : C.dim), fontSize: n > 3 ? 62 : 78, fontWeight: 800,
      }, demo ? '' : String(g));
    });
    const names = demo
      ? team.names.map((_, k) => el('div', { display: 'flex', height: 26, width: k === 0 ? 330 : 250, borderRadius: 13, background: accent, opacity: k === 0 ? 0.85 : 0.5, marginTop: k === 0 ? 0 : 16 }, ''))
      : team.names.map((nm) => el('div', { display: 'block', maxWidth: 600, color: accent, fontSize: 54, fontWeight: 800, lineHeight: 1.12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, nm));
    return el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 164, width: '100%' }, [
      el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0, paddingRight: 24 }, names),
      el('div', { display: 'flex', gap }, cells),
    ]);
  };
  return el('div', {
    display: 'flex', flexDirection: 'column', justifyContent: 'center', width: W, height: H, padding: '0 56px', color: C.text, fontFamily: 'Inter',
    backgroundColor: C.bg,
    backgroundImage: 'radial-gradient(circle at 88% 4%, rgba(25,159,255,0.24), rgba(25,159,255,0) 50%), radial-gradient(circle at 4% 100%, rgba(149,255,25,0.11), rgba(149,255,25,0) 46%)',
  }, [
    // ARRIBA, centrado: «Te invitaron a [logo oficial]» (la única presencia de marca)
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, fontSize: 56, fontWeight: 800, letterSpacing: -1 }, [
      el('span', { color: C.text, marginRight: -4 }, 'Te invitaron a'),
      el('img', { width: 270, height: 62 }, undefined, { src: logoDataUri, width: 270, height: 62 }),
    ]),
    // EN EL CENTRO: el partido (protagonista)
    el('div', {
      display: 'flex', flexDirection: 'column', padding: '0 44px', background: 'rgba(13,26,42,0.90)',
      border: `3px solid ${C.line}`, borderRadius: 32, width: '100%',
    }, [
      row(teams[0], 0),
      el('div', { display: 'flex', height: 3, background: C.line, width: '100%' }, ''),
      row(teams[1], 1),
    ]),
    // ABAJO: una sola frase
    el('div', { display: 'flex', justifyContent: 'center', marginTop: 26, fontSize: 31, fontWeight: 400, color: C.dim }, 'Entrá y recuperá este partido en tu historial.'),
  ]);
}

/** Consulta la RPC pública. Devuelve la tarjeta limpia o null ante CUALQUIER problema (nunca lanza). */
export async function fetchCard(token, env = process.env, fetchImpl = globalThis.fetch) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/get_invitation_card`, {
      method: 'POST',
      // La clave publishable va SOLO en `apikey` (como api/health.js): como Bearer no es un JWT válido.
      headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_token: token }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return parseCard(await res.json());
  } catch (e) {
    return null;
  }
}

let assets = null;
function loadAssets() {
  if (assets) return assets;
  const dir = new URL('../../og/', import.meta.url);
  const font = (f) => { const b = fs.readFileSync(new URL(f, dir)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  assets = {
    fonts: [
      { name: 'Inter', data: font('Inter-400.woff'), weight: 400, style: 'normal' },
      { name: 'Inter', data: font('Inter-700.woff'), weight: 700, style: 'normal' },
      { name: 'Inter', data: font('Inter-800.woff'), weight: 800, style: 'normal' },
    ],
    logo: `data:image/svg+xml;base64,${fs.readFileSync(new URL('logo.svg', dir)).toString('base64')}`,
  };
  return assets;
}

let resvgReady = null;
/** resvg compilado a WebAssembly (sin binarios nativos: corre igual en cualquier plataforma de Vercel). Se inicializa una sola vez por instancia. */
function initResvg(mod) {
  if (!resvgReady) {
    const wasm = fs.readFileSync(fileURLToPath(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm')));
    resvgReady = mod.initWasm(wasm).catch((e) => { resvgReady = null; throw e; });
  }
  return resvgReady;
}

/** PNG (Buffer) de la tarjeta: con `card` el partido real; con `null` la tarjeta de MARCA. satori (árbol → SVG con Inter) + resvg (SVG → PNG). */
export async function renderCardPng(card) {
  const [{ default: satori }, resvg] = await Promise.all([import('satori'), import('@resvg/resvg-wasm')]);
  const a = loadAssets();
  await initResvg(resvg);
  const svg = await satori(buildCardTree(card, a.logo), { width: W, height: H, fonts: a.fonts });
  return Buffer.from(new resvg.Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng());
}

/** Tarjeta de MARCA estática (sin datos): la que sale cuando el enlace no sirve o algo falla. Nunca lanza: si faltara el archivo, devuelve null. */
export function brandPng() {
  try { return fs.readFileSync(new URL('../../og/marca.png', import.meta.url)); } catch (e) { return null; }
}
