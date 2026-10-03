#!/usr/bin/env node
// BRAMUlab — V04.29: verificación de CONCURRENCIA REAL del vínculo de identidad contra un proyecto Supabase real (Staging).
//
// Por qué existe: PGlite y el SQL editor son de UNA sola conexión, así que la carrera de dos links distintos sobre la misma
// provisional (el riesgo CRÍTICO de 116 §3.2) solo se puede ejercitar con dos requests simultáneos de verdad. Las demás
// garantías están en verify-g3-identity-recovery.sql (transaccional) e identity-recovery-core.test.mjs (E2E con motor real).
//
// Necesita SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (solo variables de entorno de esta terminal; nunca en el
// chat) y las migraciones 20261003100000..130000 aplicadas. SOLO Staging.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/tests/verify-g3-identity-recovery-concurrency.mjs
//
// Escenarios (cada uno con provisional/links propios):
//   C1  dos CUENTAS distintas consumen simultáneamente DOS links distintos de la misma provisional -> un ÚNICO ganador, el otro
//       recibe claim_already_used, 1 sola recuperación completed, 0 links pending, los slots quedan con el ganador;
//   C2  la MISMA cuenta consume simultáneamente los DOS links -> una sola recuperación (el segundo es idempotente);
//   C3  una cuenta recupera DOS provisionales distintas a la vez -> ambas ok (sin deadlock), 2 recuperaciones;
//   C4  dos create_claim_link simultáneos del MISMO invitador -> exactamente 1 pending (el otro quedó rotated);
//   C5  create_claim_link de un segundo invitador en carrera con el vínculo -> nunca queda un pending sobre una provisional recuperada.
//
// Deja filas auditables en Staging (no se pueden borrar: tablas de auditoría sin DELETE para service_role). Todas llevan el prefijo
// `zz_g3_conc_` en display_name; las cuentas Auth se eliminan al final. Limpieza opcional de las filas por SQL editor (postgres).

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const stamp = Date.now().toString(36);
const authIds = [];
let failures = 0;
const check = (label, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${detail ? ' -> ' + detail : ''}`); };

const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
async function rest(method, path, body, prefer = 'return=representation') {
  const res = await fetch(`${url}/rest/v1/${path}`, { method, headers: { ...svcHeaders, Prefer: prefer }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
async function rpc(token, fn, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { json = text; }
  return { ok: res.ok, status: res.status, json };
}
async function mkAccount(tag) {
  const email = `bramu-g3-conc-${tag}-${stamp}@example.com`;
  const password = 'Verificar#G3Conc!';
  const created = await (await fetch(`${url}/auth/v1/admin/users`, { method: 'POST', headers: svcHeaders, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { legal_version: 'legal_v1' } }) })).json();
  if (!created.id) throw new Error(`no se pudo crear ${tag}: ${JSON.stringify(created)}`);
  authIds.push(created.id);
  const session = await (await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
  const [row] = await rest('GET', `players?select=player_id&auth_user_id=eq.${created.id}`);
  await rest('PATCH', `players?player_id=eq.${row.player_id}`, { display_name: `zz_g3_conc_${tag}` }, 'return=minimal');
  return { tag, token: session.access_token, playerId: row.player_id };
}
async function mkProvisional(creator, name) {
  const [p] = await rest('POST', 'players', { type: 'provisional', display_name: `zz_g3_conc_${name}`, created_by_player_id: creator.playerId });
  return p.player_id;
}
/** Partido pending con 4 slots (solo para la relación "compartió un partido"; sin Nivel). */
async function mkMatch(creator, slots) {
  const [m] = await rest('POST', 'matches', {
    created_by_player_id: creator.playerId, participant_fingerprint: `g3conc-${stamp}-${Math.random().toString(36).slice(2)}`, format_id: 'classic',
    played_at: new Date(Date.now() - 86400000).toISOString(), status: 'pending_validation', action_side: 'B', validation_deadline_at: new Date(Date.now() + 20 * 86400000).toISOString(),
  });
  const pos = [['A', 1], ['A', 2], ['B', 1], ['B', 2]];
  await rest('POST', 'match_participants', slots.map((s, i) => ({ match_id: m.match_id, team: pos[i][0], position_in_team: pos[i][1], player_id: s.playerId || s, display_name_snapshot: 'x' })), 'return=minimal');
  return m.match_id;
}
const claim = (acc, token) => rpc(acc.token, 'claim_provisional_player', { p_token: token });
const link = async (acc, prov) => (await rpc(acc.token, 'create_claim_link', { p_provisional_player_id: prov })).json;
const db = {
  recoveries: async (prov) => rest('GET', `player_identity_recoveries?select=recovery_id,target_player_id,status&source_provisional_player_id=eq.${prov}&status=eq.completed`),
  claims: async (prov) => rest('GET', `provisional_claims?select=status,revoked_reason,created_by_player_id&provisional_player_id=eq.${prov}`),
  slots: async (matchId) => rest('GET', `match_participants?select=player_id&match_id=eq.${matchId}`),
};

try {
  const seba = await mkAccount('seba'); const matu = await mkAccount('matu'); const t1 = await mkAccount('t1'); const t2 = await mkAccount('t2');
  const filler = await mkAccount('filler'); const filler2 = await mkAccount('filler2');

  // C1 — dos cuentas, dos links de invitadores distintos, a la vez.
  {
    const prov = await mkProvisional(seba, 'c1');
    const m = await mkMatch(seba, [seba, prov, matu, filler]);               // Matu comparte partido con la provisional => puede invitar
    const tokS = await link(seba, prov); const tokM = await link(matu, prov);
    check('C1 setup: dos links pending de invitadores distintos', (await db.claims(prov)).filter((c) => c.status === 'pending').length === 2);
    const [a, b] = await Promise.all([claim(t1, tokS), claim(t2, tokM)]);
    const oks = [a, b].filter((x) => x.json && x.json.ok === true);
    const losers = [a, b].filter((x) => !(x.json && x.json.ok === true));
    check('C1 exactamente UN ganador', oks.length === 1, JSON.stringify([a.json, b.json]));
    check('C1 el perdedor recibe claim_already_used', losers.length === 1 && losers[0].json && losers[0].json.code === 'claim_already_used', JSON.stringify(losers.map((x) => x.json)));
    const cl = await db.claims(prov);
    check('C1 un claimed y NINGÚN pending', cl.filter((c) => c.status === 'claimed').length === 1 && cl.filter((c) => c.status === 'pending').length === 0, JSON.stringify(cl));
    const rec = await db.recoveries(prov);
    check('C1 una sola recuperación completed', rec.length === 1);
    const winnerId = rec[0] && rec[0].target_player_id;
    check('C1 el slot quedó con el ganador (nunca dos dueños)', (await db.slots(m)).filter((s) => s.player_id === winnerId).length === 1);
  }

  // C2 — misma cuenta, ambos links.
  {
    const prov = await mkProvisional(seba, 'c2');
    await mkMatch(seba, [seba, prov, matu, filler]);
    const tokS = await link(seba, prov); const tokM = await link(matu, prov);
    const [a, b] = await Promise.all([claim(t1, tokS), claim(t1, tokM)]);
    check('C2 ambos devuelven ok (uno recupera, el otro idempotente)', a.json.ok === true && b.json.ok === true, JSON.stringify([a.json, b.json]));
    check('C2 una sola recuperación', (await db.recoveries(prov)).length === 1);
    check('C2 mismo recoveryId en ambas respuestas', a.json.recoveryId === b.json.recoveryId);
  }

  // C3 — una cuenta, dos provisionales a la vez (sin deadlock).
  {
    const p1 = await mkProvisional(seba, 'c3a'); const p2 = await mkProvisional(seba, 'c3b');
    await mkMatch(seba, [seba, p1, matu, filler]); await mkMatch(seba, [seba, p2, matu, filler2]);
    const [k1, k2] = [await link(seba, p1), await link(seba, p2)];
    const [a, b] = await Promise.all([claim(t2, k1), claim(t2, k2)]);
    check('C3 ambas ok sin deadlock', a.json.ok === true && b.json.ok === true, JSON.stringify([a.json, b.json]));
    check('C3 dos recuperaciones independientes', a.json.recoveryId !== b.json.recoveryId && (await db.recoveries(p1)).length === 1 && (await db.recoveries(p2)).length === 1);
  }

  // C4 — dos create_claim_link simultáneos del mismo invitador.
  {
    const prov = await mkProvisional(seba, 'c4');
    await mkMatch(seba, [seba, prov, matu, filler]);
    const [x, y] = await Promise.all([link(seba, prov), link(seba, prov)]);
    const pend = (await db.claims(prov)).filter((c) => c.status === 'pending' && c.created_by_player_id === seba.playerId);
    check('C4 exactamente 1 pending por (provisional, invitador)', pend.length === 1, JSON.stringify([typeof x, typeof y, pend.length]));
  }

  // C5 — create_claim_link de otro invitador en carrera con el vínculo.
  {
    const prov = await mkProvisional(seba, 'c5');
    await mkMatch(seba, [seba, prov, matu, filler]);
    const tokS = await link(seba, prov);
    const [c, l] = await Promise.all([claim(t1, tokS), link(matu, prov)]);
    const cl = await db.claims(prov);
    check('C5 el vínculo ganó', c.json.ok === true || (c.json.code === 'claim_already_used'), JSON.stringify(c.json));
    check('C5 jamás queda un pending sobre una provisional recuperada', cl.filter((x) => x.status === 'pending').length === 0 || (await db.recoveries(prov)).length === 0, JSON.stringify([cl, typeof l]));
  }
} catch (e) {
  failures += 1;
  console.error('ERROR de ejecución:', e.message);
} finally {
  for (const id of authIds) await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svcHeaders }).catch(() => {});
}
console.log(failures === 0 ? '\nPASS: concurrencia verificada' : `\nFAIL: ${failures} verificación(es)`);
process.exit(failures === 0 ? 0 : 1);
