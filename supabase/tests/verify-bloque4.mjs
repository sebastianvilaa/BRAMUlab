#!/usr/bin/env node
// BRAMUlab — Bloque 4: verificación contra un proyecto Supabase REAL
// (búsqueda de jugadores, perfil público, identidades provisionales, link/claim, rate limiting).
//
// Igual que verify-bloque2.mjs/verify-bloque3.mjs, esto NO es parte de la suite local
// (tests.html): necesita red y las migraciones de Bloque 1-3 + la migración
// 20260920120000_bloque4_jugadores_busqueda_provisional.sql aplicadas en ese orden.
//
// Necesita SUPABASE_URL, SUPABASE_ANON_KEY (Publishable Key) y SUPABASE_SERVICE_ROLE_KEY —
// misma nota de seguridad que los scripts anteriores: nunca las pegues en el chat, se leen
// solo de variables de entorno de esta terminal.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/verify-bloque4.mjs
//
// Qué comprueba (ver docs/BRAMUlab/Implementacion/Backend/Bloque_04/03_Revision_ChatGPT.md y el
// hotfix 05_Revision_Post_Implementacion_ChatGPT.md):
//   §10.4/RLS — anon no puede llamar ninguna RPC nueva ni leer provisional_claims/
//               api_rate_limits directo;
//   §6        — search_players/get_public_profile: coincidencia por @usuario/nombre/apellido,
//               el caller nunca aparece en sus propios resultados, query corta devuelve vacío,
//               una provisional NUNCA aparece en ninguna de las dos, shape sin campos privados;
//   hotfix §1 — búsqueda LITERAL: `@usuario` encuentra el username sin el @; `%%`/`__` NO
//               enumeran el universo (ya no son wildcard SQL); una query demasiado larga
//               devuelve vacío controlado;
//   §3        — create_provisional_player SIEMPRE crea un UUID nuevo, incluso con el mismo
//               nombre y el mismo creador (nunca se fusiona por nombre);
//   hotfix §5 — create_provisional_player rechaza un display_name absurdamente largo;
//   §4        — rate limiting real (búsqueda) rechaza por encima del límite configurado;
//   hotfix §3 — claim_provisional_player devuelve un resultado jsonb estructurado
//               ({ok,code,player_id}) para errores de negocio esperables, NUNCA una excepción
//               que revertiría el incremento del rate limiter; se verifica explícitamente que
//               los intentos INVÁLIDOS (formato de token roto) SÍ consumen cuota — más de 10 en
//               15 min con la misma cuenta terminan en rate_limited;
//   §5/§7     — claim feliz: pilot_events (signup_completed) se preserva y se reasigna, el
//               player_id adoptado es el de la provisional (nunca uno nuevo), complete_profile/
//               officialize-onboarding posteriores funcionan sin cambios sobre ese ID;
//   §7        — token vencido, ya usado, y cuenta ya registrada intentando reclamar: todos
//               rechazados explícitamente (código estructurado), nunca fusión automática;
//   §7        — dos reclamos simultáneos del mismo token: solo uno gana (concurrencia real).
//
// Hotfix §2 (claim transitorio no debe dejar avanzar a complete_profile/officializeLevel) es
// lógica de `bramulab/app.js` (orquestación del flujo de signup), no de estas RPCs — este
// script no lo ejercita: app.js no tiene cobertura de tests automatizados en este proyecto (por
// diseño, ver memoria del repo); se verificó por inspección de código + el informe de
// implementación documenta el razonamiento y la garantía exacta.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx SUPABASE_SERVICE_ROLE_KEY=xxxx node supabase/tests/verify-bloque4.mjs');
  process.exit(1);
}

const results = [];
function report(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${detail ? ' -> ' + detail : ''}`);
  return ok;
}

async function restAuthed(path, accessToken, init) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
}

async function rpcAs(accessToken, apiKeyForHeader, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: apiKeyForHeader, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { res, json };
}

// anon real (sin sesión): apikey + Authorization con la MISMA anon key, como haría un cliente
// nunca logueado — nunca con una cuenta de prueba, para probar de verdad "sin sesión".
async function rpcAsAnon(fn, body) {
  return rpcAs(anonKey, anonKey, fn, body);
}

async function callEdgeFunction(accessToken, body) {
  const res = await fetch(`${url}/functions/v1/officialize-onboarding`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { res, json };
}

async function adminCreateConfirmedUser(email, password) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`adminCreateConfirmedUser(${email}) -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function adminDeleteUser(id) {
  if (!id) return true;
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  return res.ok;
}

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function serviceDelete(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Prefer: 'return=minimal' },
  });
  return res.ok;
}

async function servicePatch(path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function serviceGet(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  return res.ok ? res.json() : null;
}

const stamp = Date.now().toString(36);
const cleanup = { authIds: [], playerIds: [] };

/** Alta completa hasta perfil+Nivel oficializados (mismo camino que un usuario real). Devuelve
 *  {authId, token, playerId}. */
async function createOnboardedAccount(tag, username) {
  const email = `bramu-verify-b4-${tag}-${stamp}@example.com`;
  const password = 'Verificar#Bloque4!';
  const created = await adminCreateConfirmedUser(email, password);
  cleanup.authIds.push(created.id);
  const session = await signIn(email, password);
  const token = session.access_token;
  const ownProfileRes = await restAuthed('profiles?select=player_id', token);
  const ownProfileRows = ownProfileRes.ok ? await ownProfileRes.json() : null;
  const playerId = Array.isArray(ownProfileRows) && ownProfileRows[0] ? ownProfileRows[0].player_id : null;
  if (playerId) cleanup.playerIds.push(playerId);

  await rpcAs(token, anonKey, 'complete_profile', {
    p_username: username, p_first_name: 'Verificacion', p_last_name: `B4${tag}`,
    p_display_name: `Verificacion B4 ${tag}`, p_birth_date: null, p_gender: null,
    p_dominant_hand: null, p_preferred_side: null, p_competitive_branch: null,
    p_location_country_code: null, p_location_province_label: null, p_location_locality_label: null,
    p_terms_version: 'piloto_v1',
  });
  await callEdgeFunction(token, { mode: 'quick', quickSeedKey: 'intermedio' });
  return { authId: created.id, email, password, token, playerId, username };
}

/** Alta SIN completar perfil (recién confirmó el email, todavía en la ventana en la que un
 *  claim puede adoptar su player_id — 03_Revision_ChatGPT.md §2/Decisión 2). */
async function createFreshUnfinishedAccount(tag) {
  const email = `bramu-verify-b4-${tag}-${stamp}@example.com`;
  const password = 'Verificar#Bloque4!';
  const created = await adminCreateConfirmedUser(email, password);
  cleanup.authIds.push(created.id);
  const session = await signIn(email, password);
  const token = session.access_token;
  const ownProfileRes = await restAuthed('profiles?select=player_id', token);
  const ownProfileRows = ownProfileRes.ok ? await ownProfileRes.json() : null;
  const playerId = Array.isArray(ownProfileRows) && ownProfileRows[0] ? ownProfileRows[0].player_id : null;
  // Nota: NO se agrega a cleanup.playerIds acá a propósito en los casos de claim exitoso — el
  // player_id original desaparece (lo funde el claim); se limpia por su cuenta más abajo donde
  // corresponda.
  return { authId: created.id, email, password, token, playerId };
}

async function main() {
  // --- 0) dos cuentas reales, completas, para búsqueda/perfil público ---
  const userA = await createOnboardedAccount('a', `vb4a_${stamp}`);
  const userB = await createOnboardedAccount('b', `vb4b_${stamp}`);

  // --- 1) RLS/seguridad: anon no puede llamar ninguna RPC nueva ---
  const anonSearch = await rpcAsAnon('search_players', { p_query: 'vb4' });
  report('seguridad: search_players rechaza anon', !anonSearch.res.ok, `status ${anonSearch.res.status}`);
  const anonProfile = await rpcAsAnon('get_public_profile', { p_player_id: userA.playerId });
  report('seguridad: get_public_profile rechaza anon', !anonProfile.res.ok, `status ${anonProfile.res.status}`);
  const anonCreateProv = await rpcAsAnon('create_provisional_player', { p_display_name: 'X' });
  report('seguridad: create_provisional_player rechaza anon', !anonCreateProv.res.ok, `status ${anonCreateProv.res.status}`);
  const anonClaimLink = await rpcAsAnon('create_claim_link', { p_provisional_player_id: userA.playerId });
  report('seguridad: create_claim_link rechaza anon', !anonClaimLink.res.ok, `status ${anonClaimLink.res.status}`);
  const anonClaim = await rpcAsAnon('claim_provisional_player', { p_token: 'x' });
  report('seguridad: claim_provisional_player rechaza anon', !anonClaim.res.ok, `status ${anonClaim.res.status}`);
  const anonListMine = await rpcAsAnon('list_my_provisional_players', {});
  report('seguridad: list_my_provisional_players rechaza anon', !anonListMine.res.ok, `status ${anonListMine.res.status}`);

  const anonReadClaims = await fetch(`${url}/rest/v1/provisional_claims?select=claim_id`, { headers: { apikey: anonKey } });
  const anonReadClaimsRows = anonReadClaims.ok ? await anonReadClaims.json() : null;
  const anonReadClaimsBlocked = !anonReadClaims.ok || (Array.isArray(anonReadClaimsRows) && anonReadClaimsRows.length === 0);
  report('RLS: anon no puede leer provisional_claims', anonReadClaimsBlocked, `status ${anonReadClaims.status}`);

  // --- 2) búsqueda ---
  // Hotfix §1 — el test tiene que probar de verdad que escribir "@sebastian" funciona, no solo
  // el username sin el @.
  const searchForB = await rpcAs(userA.token, anonKey, 'search_players', { p_query: `@${userB.username}` });
  const searchForBRow = searchForB.res.ok && Array.isArray(searchForB.json) ? searchForB.json.find((r) => r.player_id === userB.playerId) : null;
  report('búsqueda: A encuentra a B escribiendo "@" + @usuario', !!searchForBRow, JSON.stringify(searchForB.json));
  const searchForBShapeOk = searchForBRow && !('email' in searchForBRow) && !('auth_user_id' in searchForBRow) && !('birth_date' in searchForBRow) && !('gender' in searchForBRow);
  report('búsqueda: la fila nunca incluye campos privados (email/auth_user_id/birth_date/gender)', !!searchForBShapeOk, JSON.stringify(searchForBRow));

  const searchForSelf = await rpcAs(userA.token, anonKey, 'search_players', { p_query: userA.username });
  const selfInOwnResults = searchForSelf.res.ok && Array.isArray(searchForSelf.json) && searchForSelf.json.some((r) => r.player_id === userA.playerId);
  report('búsqueda: el caller nunca aparece en sus propios resultados', searchForSelf.res.ok && !selfInOwnResults, JSON.stringify(searchForSelf.json));

  const searchShort = await rpcAs(userA.token, anonKey, 'search_players', { p_query: 'v' });
  report('búsqueda: query < 2 caracteres devuelve vacío (nunca todo el universo)', searchShort.res.ok && Array.isArray(searchShort.json) && searchShort.json.length === 0, JSON.stringify(searchShort.json));

  // Hotfix §1 — corrección obligatoria: antes de este hotfix, `search_players` armaba
  // `'%' || p_query || '%'` y usaba `ilike`, así que un query de "%%" o "__" actuaba como
  // wildcard SQL real y podía devolver el universo entero pese al mínimo de 2 caracteres.
  const searchPercent = await rpcAs(userA.token, anonKey, 'search_players', { p_query: '%%' });
  report('búsqueda: "%%" NO enumera usuarios (substring literal, no wildcard SQL)', searchPercent.res.ok && Array.isArray(searchPercent.json) && searchPercent.json.length === 0, JSON.stringify(searchPercent.json));
  const searchUnderscore = await rpcAs(userA.token, anonKey, 'search_players', { p_query: '__' });
  report('búsqueda: "__" NO enumera usuarios (substring literal, no wildcard SQL)', searchUnderscore.res.ok && Array.isArray(searchUnderscore.json) && searchUnderscore.json.length === 0, JSON.stringify(searchUnderscore.json));
  const searchTooLong = await rpcAs(userA.token, anonKey, 'search_players', { p_query: 'x'.repeat(80) });
  report('búsqueda: query demasiado larga devuelve vacío de forma controlada (nunca un error)', searchTooLong.res.ok && Array.isArray(searchTooLong.json) && searchTooLong.json.length === 0, JSON.stringify(searchTooLong.json));

  // --- 3) provisionales: SIEMPRE un UUID nuevo, nunca se fusionan por nombre ---
  const DUP_NAME = `Invitado Duplicado ${stamp}`;
  const prov1 = await rpcAs(userA.token, anonKey, 'create_provisional_player', { p_display_name: DUP_NAME });
  const prov1Dup = await rpcAs(userA.token, anonKey, 'create_provisional_player', { p_display_name: DUP_NAME });
  const prov1Id = prov1.res.ok ? prov1.json.player_id : null;
  const prov1DupId = prov1Dup.res.ok ? prov1Dup.json.player_id : null;
  if (prov1Id) cleanup.playerIds.push(prov1Id);
  if (prov1DupId) cleanup.playerIds.push(prov1DupId);
  report('provisional: crear dos veces con el MISMO nombre desde el MISMO creador da IDs distintos (nunca se fusiona)', prov1.res.ok && prov1Dup.res.ok && !!prov1Id && !!prov1DupId && prov1Id !== prov1DupId, `${prov1Id} vs ${prov1DupId}`);

  // Hotfix §5 — longitud máxima razonable de display_name.
  const provNameTooLong = await rpcAs(userA.token, anonKey, 'create_provisional_player', { p_display_name: 'X'.repeat(80) });
  report('provisional: display_name absurdamente largo se rechaza', !provNameTooLong.res.ok && provNameTooLong.json && provNameTooLong.json.message === 'display_name_too_long', JSON.stringify(provNameTooLong.json));

  const provNeverInSearch = await rpcAs(userA.token, anonKey, 'search_players', { p_query: DUP_NAME.slice(0, 10) });
  report('búsqueda: una identidad provisional NUNCA aparece en search_players', provNeverInSearch.res.ok && Array.isArray(provNeverInSearch.json) && provNeverInSearch.json.length === 0, JSON.stringify(provNeverInSearch.json));

  const provNeverInPublicProfile = await rpcAs(userA.token, anonKey, 'get_public_profile', { p_player_id: prov1Id });
  report('perfil público: get_public_profile nunca devuelve una provisional', provNeverInPublicProfile.res.ok && Array.isArray(provNeverInPublicProfile.json) && provNeverInPublicProfile.json.length === 0, JSON.stringify(provNeverInPublicProfile.json));

  const listMineBeforeClaim = await rpcAs(userA.token, anonKey, 'list_my_provisional_players', {});
  const bothListed = listMineBeforeClaim.res.ok && Array.isArray(listMineBeforeClaim.json) && [prov1Id, prov1DupId].every((id) => listMineBeforeClaim.json.some((r) => r.player_id === id));
  report('list_my_provisional_players: el creador ve ambas provisionales propias', bothListed, JSON.stringify(listMineBeforeClaim.json));

  // --- 4) rotación: un link viejo queda muerto al generar uno nuevo ---
  const link1 = await rpcAs(userA.token, anonKey, 'create_claim_link', { p_provisional_player_id: prov1Id });
  const token1 = link1.res.ok ? link1.json : null;
  const link2 = await rpcAs(userA.token, anonKey, 'create_claim_link', { p_provisional_player_id: prov1Id });
  const token2 = link2.res.ok ? link2.json : null;
  report('create_claim_link: rotar genera un token nuevo y distinto', link1.res.ok && link2.res.ok && !!token1 && !!token2 && token1 !== token2, '');

  // --- 5) claim feliz: preserva pilot_events, adopta el MISMO player_id, onboarding normal después ---
  const accC = await createFreshUnfinishedAccount('c');
  const originalPlayerIdC = accC.playerId;
  const pilotEventsBeforeClaim = await serviceGet(`pilot_events?select=event_name&player_id=eq.${originalPlayerIdC}`);
  const hadSignupCompleted = Array.isArray(pilotEventsBeforeClaim) && pilotEventsBeforeClaim.some((e) => e.event_name === 'signup_completed');
  report('setup: la cuenta nueva tiene su signup_completed original antes de reclamar', hadSignupCompleted, JSON.stringify(pilotEventsBeforeClaim));

  // Hotfix §3 — claim_provisional_player ahora devuelve jsonb {ok, code, player_id} en vez de
  // la fila de players + raise exception (ver la migración).
  const claimHappy = await rpcAs(accC.token, anonKey, 'claim_provisional_player', { p_token: token2 });
  const claimHappyOk = claimHappy.res.ok && claimHappy.json && claimHappy.json.ok === true && claimHappy.json.player_id === prov1Id;
  report('claim feliz: adopta el MISMO player_id de la provisional (nunca uno nuevo)', claimHappyOk, JSON.stringify(claimHappy.json));

  const oldP2Gone = await serviceGet(`players?select=player_id&player_id=eq.${originalPlayerIdC}`);
  report('claim feliz: el player_id original de la cuenta nueva (P2) fue eliminado', Array.isArray(oldP2Gone) && oldP2Gone.length === 0, JSON.stringify(oldP2Gone));

  const pilotEventsAfterClaim = await serviceGet(`pilot_events?select=event_name&player_id=eq.${prov1Id}`);
  const preservedSignup = Array.isArray(pilotEventsAfterClaim) && pilotEventsAfterClaim.some((e) => e.event_name === 'signup_completed');
  const gotProvisionalClaimed = Array.isArray(pilotEventsAfterClaim) && pilotEventsAfterClaim.some((e) => e.event_name === 'provisional_claimed');
  report('claim feliz: signup_completed se PRESERVA (reasignado, nunca borrado)', preservedSignup, JSON.stringify(pilotEventsAfterClaim));
  report('claim feliz: se registra provisional_claimed sobre el player_id adoptado', gotProvisionalClaimed, JSON.stringify(pilotEventsAfterClaim));

  // Onboarding normal DESPUÉS del claim, sin ningún cambio de código — complete_profile/
  // officialize-onboarding resuelven player_id dinámicamente desde auth.uid(), que ahora
  // apunta al player_id adoptado.
  const claimedUsername = `vb4c_${stamp}`;
  const completeAfterClaim = await rpcAs(accC.token, anonKey, 'complete_profile', {
    p_username: claimedUsername, p_first_name: 'Reclamado', p_last_name: 'B4',
    p_display_name: 'Reclamado B4', p_birth_date: null, p_gender: null, p_dominant_hand: null,
    p_preferred_side: null, p_competitive_branch: null, p_location_country_code: null,
    p_location_province_label: null, p_location_locality_label: null, p_terms_version: 'piloto_v1',
  });
  report('claim feliz: complete_profile funciona después del claim, sin cambios', completeAfterClaim.res.ok, JSON.stringify(completeAfterClaim.json));
  const officializeAfterClaim = await callEdgeFunction(accC.token, { mode: 'quick', quickSeedKey: 'intermedio' });
  const officializeAfterClaimOk = officializeAfterClaim.res.ok && officializeAfterClaim.json && officializeAfterClaim.json.ok && officializeAfterClaim.json.levelState && officializeAfterClaim.json.levelState.status === 'CALIBRANDO';
  report('claim feliz: officialize-onboarding funciona después del claim, sin cambios', officializeAfterClaimOk, JSON.stringify(officializeAfterClaim.json));

  const finalProfileC = await restAuthed('profiles?select=player_id,username', accC.token);
  const finalProfileCRows = finalProfileC.ok ? await finalProfileC.json() : null;
  const finalPlayerIdMatchesAdopted = Array.isArray(finalProfileCRows) && finalProfileCRows[0] && finalProfileCRows[0].player_id === prov1Id;
  report('claim feliz: el perfil terminado de C vive sobre el player_id ADOPTADO (prov1), no uno nuevo', finalPlayerIdMatchesAdopted, JSON.stringify(finalProfileCRows));
  cleanup.playerIds.push(prov1Id); // limpiar acá (adoptado por C) en vez de bajo su nombre original

  // --- 6) token ya usado: reintentar el MISMO token2 debe rechazarse ---
  const accD = await createFreshUnfinishedAccount('d');
  const reuseUsedToken = await rpcAs(accD.token, anonKey, 'claim_provisional_player', { p_token: token2 });
  const reuseUsedTokenRejected = reuseUsedToken.res.ok && reuseUsedToken.json && reuseUsedToken.json.ok === false && reuseUsedToken.json.code === 'claim_already_used';
  report('claim: reusar un token ya reclamado se rechaza (claim_already_used)', reuseUsedTokenRejected, JSON.stringify(reuseUsedToken.json));
  if (accD.playerId) cleanup.playerIds.push(accD.playerId);

  // --- 7) token vencido ---
  const prov2 = await rpcAs(userA.token, anonKey, 'create_provisional_player', { p_display_name: `Invitado Vencido ${stamp}` });
  const prov2Id = prov2.res.ok ? prov2.json.player_id : null;
  if (prov2Id) cleanup.playerIds.push(prov2Id);
  const link3 = await rpcAs(userA.token, anonKey, 'create_claim_link', { p_provisional_player_id: prov2Id });
  const token3 = link3.res.ok ? link3.json : null;
  const expirePatchOk = await servicePatch(`provisional_claims?provisional_player_id=eq.${prov2Id}&status=eq.pending`, { expires_at: '2000-01-01T00:00:00Z' });
  report('setup: se pudo forzar el vencimiento del claim vía service_role (para el test)', expirePatchOk, '');
  const accE = await createFreshUnfinishedAccount('e');
  const claimExpired = await rpcAs(accE.token, anonKey, 'claim_provisional_player', { p_token: token3 });
  const claimExpiredRejected = claimExpired.res.ok && claimExpired.json && claimExpired.json.ok === false && claimExpired.json.code === 'claim_expired';
  report('claim: un token vencido se rechaza (claim_expired)', claimExpiredRejected, JSON.stringify(claimExpired.json));
  if (accE.playerId) cleanup.playerIds.push(accE.playerId);

  // --- 8) cuenta ya registrada intentando reclamar: nunca fusión automática ---
  const prov3 = await rpcAs(userA.token, anonKey, 'create_provisional_player', { p_display_name: `Invitado Rechazado ${stamp}` });
  const prov3Id = prov3.res.ok ? prov3.json.player_id : null;
  if (prov3Id) cleanup.playerIds.push(prov3Id);
  const link4 = await rpcAs(userA.token, anonKey, 'create_claim_link', { p_provisional_player_id: prov3Id });
  const token4 = link4.res.ok ? link4.json : null;
  // userB YA tiene perfil completo (creado en el paso 0) — intenta reclamar de todos modos.
  const claimByAlreadyRegistered = await rpcAs(userB.token, anonKey, 'claim_provisional_player', { p_token: token4 });
  const claimByAlreadyRegisteredRejected = claimByAlreadyRegistered.res.ok && claimByAlreadyRegistered.json && claimByAlreadyRegistered.json.ok === false && claimByAlreadyRegistered.json.code === 'account_already_registered';
  report('claim: una cuenta YA con perfil completo no puede reclamar automáticamente (account_already_registered)', claimByAlreadyRegisteredRejected, JSON.stringify(claimByAlreadyRegistered.json));

  // --- 9) concurrencia: dos reclamos simultáneos del MISMO token, solo uno gana ---
  const prov4 = await rpcAs(userA.token, anonKey, 'create_provisional_player', { p_display_name: `Invitado Concurrencia ${stamp}` });
  const prov4Id = prov4.res.ok ? prov4.json.player_id : null;
  const link5 = await rpcAs(userA.token, anonKey, 'create_claim_link', { p_provisional_player_id: prov4Id });
  const token5 = link5.res.ok ? link5.json : null;
  const accF = await createFreshUnfinishedAccount('f');
  const accG = await createFreshUnfinishedAccount('g');
  const [raceF, raceG] = await Promise.all([
    rpcAs(accF.token, anonKey, 'claim_provisional_player', { p_token: token5 }),
    rpcAs(accG.token, anonKey, 'claim_provisional_player', { p_token: token5 }),
  ]);
  // Hotfix §3 — con el contrato jsonb, AMBAS respuestas llegan con HTTP 200 (nunca una
  // excepción); el ganador se distingue por json.ok === true, no por res.ok.
  const raceFWon = raceF.res.ok && raceF.json && raceF.json.ok === true;
  const raceGWon = raceG.res.ok && raceG.json && raceG.json.ok === true;
  const winners = [raceFWon, raceGWon].filter(Boolean);
  report('concurrencia: dos reclamos simultáneos del mismo token -> exactamente uno gana', winners.length === 1, `F=${JSON.stringify(raceF.json)} G=${JSON.stringify(raceG.json)}`);
  if (winners.length === 1) {
    cleanup.playerIds.push(prov4Id); // el ganador adoptó prov4Id
    const loserAcc = raceFWon ? accG : accF;
    if (loserAcc.playerId) cleanup.playerIds.push(loserAcc.playerId); // el perdedor sigue en su P2 original
  } else {
    if (prov4Id) cleanup.playerIds.push(prov4Id);
    if (accF.playerId) cleanup.playerIds.push(accF.playerId);
    if (accG.playerId) cleanup.playerIds.push(accG.playerId);
  }

  // --- 10) rate limiting real: search_players (30 req/60s por jugador, ver la revisión §4) ---
  const rateLimitCalls = await Promise.all(
    Array.from({ length: 35 }, () => rpcAs(userA.token, anonKey, 'search_players', { p_query: 'ratelimit' }))
  );
  const rateLimitedCount = rateLimitCalls.filter((r) => !r.res.ok && r.json && r.json.message === 'rate_limited').length;
  const succeededCount = rateLimitCalls.filter((r) => r.res.ok).length;
  report('rate limiting: 35 búsquedas rápidas seguidas -> al menos una rechazada por rate_limited', rateLimitedCount > 0, `ok=${succeededCount} rate_limited=${rateLimitedCount}`);
  report('rate limiting: nunca deja pasar más de 30 dentro de la ventana', succeededCount <= 30, `ok=${succeededCount}`);

  // --- 11) rate limiting del CLAIM: los intentos INVÁLIDOS también deben contar (hotfix §3) ---
  // Antes del hotfix, cada `claim_invalid` era un `raise exception` que revertía el incremento
  // de `consume_rate_limit` de esa misma llamada — así que reintentar un token roto NUNCA
  // llegaba a `rate_limited`, sin importar cuántas veces se probara. Secuencial (no
  // Promise.all): necesitamos que la llamada #11, específicamente, sea la que consuma el
  // décimo-primer lugar de la ventana.
  const accH = await createFreshUnfinishedAccount('h');
  const invalidClaimAttempts = [];
  for (let i = 0; i < 11; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    invalidClaimAttempts.push(await rpcAs(accH.token, anonKey, 'claim_provisional_player', { p_token: 'no-es-un-token-valido' }));
  }
  const firstTenAllInvalid = invalidClaimAttempts.slice(0, 10).every((r) => r.res.ok && r.json && r.json.ok === false && r.json.code === 'claim_invalid');
  report('rate limiting del claim: los primeros 10 intentos con token inválido responden claim_invalid (y consumen cuota)', firstTenAllInvalid, JSON.stringify(invalidClaimAttempts.slice(0, 10).map((r) => r.json)));
  const eleventh = invalidClaimAttempts[10];
  const eleventhRateLimited = !!eleventh && eleventh.res.ok && eleventh.json && eleventh.json.ok === false && eleventh.json.code === 'rate_limited';
  report('rate limiting del claim: el intento #11 (misma ventana de 15 min) devuelve rate_limited — los inválidos SÍ consumieron cuota', eleventhRateLimited, JSON.stringify(eleventh && eleventh.json));
  if (accH.playerId) cleanup.playerIds.push(accH.playerId);

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(allPassed
    ? 'BLOQUE 4 OK: búsqueda/perfil público/provisionales/claim/rate limiting se comportan como espera 03_Revision_ChatGPT.md.'
    : 'BLOQUE 4: hay fallas — revisar antes de cerrar el bloque.');
  return allPassed;
}

async function cleanupAll() {
  console.log('\nLimpiando cuentas y filas de prueba...');
  const uniquePlayerIds = [...new Set(cleanup.playerIds.filter(Boolean))];
  for (const id of uniquePlayerIds) {
    const okClaimsCreated = await serviceDelete(`provisional_claims?created_by_player_id=eq.${id}`);
    const okClaimsProv = await serviceDelete(`provisional_claims?provisional_player_id=eq.${id}`);
    const okRateLimits = await serviceDelete(`api_rate_limits?player_id=eq.${id}`);
    const okEvents = await serviceDelete(`level_events?player_id=eq.${id}`);
    const okStates = await serviceDelete(`level_states?player_id=eq.${id}`);
    const okPilot = await serviceDelete(`pilot_events?player_id=eq.${id}`);
    const okPlayers = await serviceDelete(`players?player_id=eq.${id}`);
    if (!okClaimsCreated || !okClaimsProv || !okRateLimits || !okEvents || !okStates || !okPilot || !okPlayers) {
      console.warn(`ATENCIÓN: la limpieza de player_id=${id} pudo no haberse completado del todo (claims_creator=${okClaimsCreated} claims_prov=${okClaimsProv} rate=${okRateLimits} events=${okEvents} states=${okStates} pilot=${okPilot} players=${okPlayers}) — revisar a mano en Staging.`);
    }
  }
  for (const id of cleanup.authIds) {
    const ok = await adminDeleteUser(id);
    if (!ok) console.warn(`ATENCIÓN: no se pudo borrar la cuenta de Auth ${id} — revisar a mano en Staging.`);
  }
  console.log('Limpieza terminada.');
}

let exitCode = 1;
try {
  exitCode = (await main()) ? 0 : 1;
} catch (err) {
  console.error('\nError durante la verificación:', err);
  exitCode = 1;
} finally {
  await cleanupAll();
}
process.exit(exitCode);
