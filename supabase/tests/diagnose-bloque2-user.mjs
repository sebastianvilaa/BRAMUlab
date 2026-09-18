#!/usr/bin/env node
// BRAMUlab — Diagnóstico DE SOLO LECTURA de una cuenta real en Supabase (Bloque 2).
//
// Herramienta reutilizable de soporte/QA para cualquier entorno (pensada para Staging, nunca
// para Production sin pedirlo explícitamente): dado un email, confirma que su cuenta de Auth,
// su `player` y su `profile` existen, están completos y no tienen duplicados/huérfanos. No
// modifica ningún dato: todas las llamadas son GET. Necesita la SERVICE ROLE KEY del proyecto
// para poder ver `auth.users` y bypassear RLS en players/profiles (con la anon key, RLS solo
// deja ver la fila propia de una sesión ya autenticada) — nunca la pegues en el chat, solo
// exportala en tu propia terminal.
//
// El email a diagnosticar es un parámetro obligatorio (nunca un default hardcodeado): este
// script se corre contra cuentas reales de personas, así que nunca debe poder ejecutarse "por
// accidente" contra una cuenta puntual sin que quien lo corre la haya tipeado a propósito.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/diagnose-bloque2-user.mjs tu-email@ejemplo.com

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetEmailArg = process.argv[2];

if (!url || !serviceRoleKey || !targetEmailArg) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno, o el email a diagnosticar como argumento.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node supabase/tests/diagnose-bloque2-user.mjs tu-email@ejemplo.com');
  process.exit(1);
}
const targetEmail = targetEmailArg.trim().toLowerCase();

const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
const restHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

async function restGet(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: restHeaders });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function line(label, ok, detail) {
  console.log(`${ok ? 'OK   ' : 'REVISAR'} ${label}${detail !== undefined ? ' -> ' + detail : ''}`);
}

async function main() {
  console.log(`=== Diagnóstico de solo lectura para ${targetEmail} ===\n`);

  // 1) auth.users — solo accesible vía Admin API (no está en /rest/v1). Se lista y filtra acá
  //    en vez de confiar en un filtro de servidor no documentado de forma estable.
  const usersRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers: adminHeaders });
  if (!usersRes.ok) throw new Error(`admin/users -> HTTP ${usersRes.status}: ${await usersRes.text()}`);
  const usersBody = await usersRes.json();
  const allUsers = Array.isArray(usersBody) ? usersBody : (usersBody.users || []);
  const matches = allUsers.filter((u) => (u.email || '').toLowerCase() === targetEmail);

  line('1) Un único usuario Auth con ese email', matches.length === 1, `${matches.length} encontrado(s)`);
  if (matches.length === 0) { console.log('\nNo se encontró ninguna cuenta con ese email — nada más para diagnosticar.'); return; }
  matches.forEach((u, i) => {
    console.log(`   [${i}] id=${u.id} email_confirmed_at=${u.email_confirmed_at || 'NULL'} created_at=${u.created_at} last_sign_in_at=${u.last_sign_in_at || 'NULL'}`);
  });
  const authUser = matches[0];
  line('2) Email confirmado (email_confirmed_at no nulo)', !!authUser.email_confirmed_at);

  // 2) players — bypass de RLS con service role.
  const players = await restGet(`players?auth_user_id=eq.${authUser.id}&select=*`);
  line('3) Un único player asociado a ese auth_user_id', players.length === 1, `${players.length} encontrado(s)`);
  players.forEach((p) => console.log(`   player_id=${p.player_id} type=${p.type} display_name=${p.display_name} is_active=${p.is_active} created_at=${p.created_at}`));
  const player = players[0] || null;
  let targetUsername = null;

  if (player) {
    // 3) profiles — join con locations para ver ubicación resuelta.
    const profiles = await restGet(`profiles?player_id=eq.${player.player_id}&select=*,locations(*)`);
    line('4) Un único profile asociado a ese player_id', profiles.length === 1, `${profiles.length} encontrado(s)`);
    profiles.forEach((p) => {
      console.log(`   username=${p.username} first_name=${p.first_name} last_name=${p.last_name} display_name=${p.display_name}`);
      console.log(`   birth_date=${p.birth_date} gender=${p.gender} dominant_hand=${p.dominant_hand} preferred_side=${p.preferred_side} competitive_branch=${p.competitive_branch} ranking_opt_in=${p.ranking_opt_in}`);
      console.log(`   location=${p.locations ? JSON.stringify(p.locations) : 'NULL'}`);
    });
    targetUsername = profiles[0] ? profiles[0].username : null;

    // 4) pilot_events — confirma que el trigger de alta corrió una sola vez para este player.
    const events = await restGet(`pilot_events?player_id=eq.${player.player_id}&select=event_name,created_at&order=created_at.asc`);
    const signupEvents = events.filter((e) => e.event_name === 'signup_completed');
    line('5) Evento signup_completed registrado exactamente una vez', signupEvents.length === 1, `${signupEvents.length} evento(s) de ${events.length} total`);
  }

  // 5) Duplicados/huérfanos a nivel de tabla completa (dataset de Staging es chico, se puede
  //    traer entero sin paginar).
  const allPlayers = await restGet('players?select=player_id,auth_user_id,display_name');
  const allProfiles = await restGet('profiles?select=player_id,username');

  const playerIds = new Set(allPlayers.map((p) => p.player_id));
  const orphanProfiles = allProfiles.filter((p) => !playerIds.has(p.player_id));
  line('6) Sin profiles huérfanos (sin player asociado)', orphanProfiles.length === 0, `${orphanProfiles.length} huérfano(s)`);

  const playersWithoutProfile = allPlayers.filter((p) => !allProfiles.some((pr) => pr.player_id === p.player_id));
  line('7) Players sin profile (perfil incompleto/abandonado)', true, `${playersWithoutProfile.length} de ${allPlayers.length} players totales (informativo, no es necesariamente un error — puede ser un alta que nunca terminó "TU PERFIL")`);
  playersWithoutProfile.forEach((p) => console.log(`   player_id=${p.player_id} auth_user_id=${p.auth_user_id} display_name=${p.display_name}`));

  if (targetUsername) {
    const sameUsername = allProfiles.filter((p) => (p.username || '').toLowerCase() === targetUsername.toLowerCase());
    line(`8) Username "${targetUsername}" usado por una única fila`, sameUsername.length === 1, `${sameUsername.length} fila(s)`);
  }

  // Listado completo, para identificar a simple vista si el resto de los players son restos de
  // pruebas anteriores (verify-bloque2.mjs) o algo real que merezca revisión aparte.
  console.log('\n--- Listado completo de players (diagnóstico visual, no es un chequeo pasa/falla) ---');
  const profileByPlayerId = new Map(allProfiles.map((p) => [p.player_id, p.username]));
  allPlayers.forEach((p) => {
    console.log(`   player_id=${p.player_id} auth_user_id=${p.auth_user_id || 'NULL'} display_name=${p.display_name} username=${profileByPlayerId.get(p.player_id) || 'NULL'}`);
  });

  console.log('\n=== Fin del diagnóstico (nada se modificó) ===');
}

main().catch((err) => { console.error('\nError durante el diagnóstico:', err); process.exit(1); });
