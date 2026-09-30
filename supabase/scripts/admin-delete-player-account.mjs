// BRAMUlab — P0.3, vehículo administrativo mínimo (handoff 28 §5, 30 §2 — hardening final,
// 27/09/2026).
//
// Script server-side/repo-local, NUNCA una Edge Function — Central prefirió explícitamente este
// vehículo. Orquesta las fases reales del procedimiento completo de eliminación/anonimización de
// cuenta:
//
//   FASE 1 (SQL, síncrona y atómica) — RPC `admin_delete_player_account`: corta el acceso BRAMU
//     de inmediato (players.auth_user_id=null) y anonimiza toda la identidad deportiva/PII en
//     una sola transacción Postgres. Devuelve/persiste el `authUserId` capturado — dato
//     OPERATIVO mínimo, necesario solo mientras el resto del procedimiento sigue incompleto (ver
//     FASE 5).
//   FASE 2 (Storage API) — borra los objetos reales del avatar en el bucket privado "avatars"
//     (`{playerId}/*`), mismo patrón que bramulab/auth.js#removeAvatarFiles pero con el cliente
//     service_role. Un usuario de Auth puede no poder eliminarse mientras siga siendo propietario
//     de objetos en Storage — por eso esta fase corre ANTES de la Fase 3.
//   FASE 2b (Storage API, B2c) — la Fase 1 borra lógicamente los grupos donde la persona era el
//     ÚNICO miembro activo (photo_path=null en la misma transacción); acá se consultan los grupos
//     `status='deleted'` con `deleted_by_player_id = playerId` y se limpia
//     `group-photos/{group_id}/*` (mismo cliente service_role). Postcondición: ninguno de esos
//     grupos conserva objetos en el bucket.
//   FASE 3 (Auth Admin API) — banea inmediatamente la cuenta (defensa adicional mientras se
//     completa el resto) y después la elimina. NUNCA se toca `auth.users`/`auth.sessions`/
//     `auth.refresh_tokens` por SQL directo.
//   FASE 4 (Auth Admin API, verificación — handoff 30 §2.B) — confirma con `getUserById` que la
//     cuenta REALMENTE ya no existe antes de considerar segura la Fase 5. Si por cualquier motivo
//     `getUserById` todavía la encuentra, la operación se detiene ACÁ, sin purgar el
//     `authUserId` — nunca se declara Auth cerrado sin haberlo verificado de vuelta.
//   FASE 5 (SQL, `admin_finalize_player_account_deletion` — handoff 30 §2.A) — SOLO después de
//     que la Fase 4 confirma que Auth ya no existe: purga `authUserId` de la auditoría
//     (`pilot_events.properties`). Ya cumplió su único propósito (permitir un retry); no
//     corresponde conservarlo indefinidamente — es un identificador técnico de la identidad
//     eliminada, y P0.3 ya decidió minimizar/eliminar identificadores personales.
//
// Corrección de una afirmación incorrecta de una ronda anterior (handoff 28 §3.A): la
// documentación vigente de Supabase confirma que borrar/banear un usuario de `auth.users` NO
// invalida automáticamente un access token JWT ya emitido — ese JWT puede seguir siendo
// criptográficamente válido hasta su expiración natural (~1h). El corte de acceso REAL a BRAMU
// (Fase 1) nunca depende de que este script llegue a correr, ni de que tenga éxito.
//
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node admin-delete-player-account.mjs <playerId>
// Requiere `npm ci` en este directorio (@supabase/supabase-js, versión fijada + package-lock.json
// commiteado — handoff 30 §2.D, "para un script administrativo destructivo esto es demasiado
// abierto") antes de la primera corrida. NUNCA commitear credenciales — se leen exclusivamente de
// variables de entorno.
//
// Criterio de éxito del CLI (handoff 30 §2.C): exit 0 SOLO si la operación Y TODAS las
// postcondiciones requeridas quedan confirmadas — nunca solo por que runAccountDeletion() haya
// completado sus pasos sin error. Ver verifyAccountDeleted() y el bootstrap al final del archivo.
//
// Idempotencia de cada fase, pensada para que la operación completa sea reintentable después de
// un fallo parcial en cualquier punto:
//   - Fase 1: idempotente por `players.deleted_at`. El `authUserId` capturado en la corrida
//     original se relee desde `pilot_events` si el reintento llega después de que
//     `players.auth_user_id` ya quedó NULL — MIENTRAS esa clave siga existiendo (ver Fase 5).
//   - Fase 2: `list(playerId)` sobre un bucket ya vacío devuelve `[]` — no-op seguro.
//   - Fase 3: banear/eliminar una cuenta que ya no existe en Auth se reconoce por señal
//     ESTRUCTURADA primero (status/code — handoff 30 §2.E), mensaje solo como fallback cuando no
//     hay ninguna señal estructurada disponible — se trata como éxito, nunca como fallo.
//   - Fase 4: re-verificable en cualquier momento, nunca muta nada.
//   - Fase 5: idempotente (operador jsonb `-` sobre una clave ausente es no-op). Un retry donde
//     Auth ya no existe pero todavía queda `authUserId` operativo simplemente la limpia y cierra
//     (handoff 30 §3.4).

import { pathToFileURL } from 'node:url';
import { runAccountDeletion, verifyAccountDeleted } from '../functions/_shared/account-deletion-core.mjs';

// El núcleo vive en functions/_shared/account-deletion-core.mjs (compartido con la Edge Function delete-my-account);
// se re-exporta acá para conservar la API histórica (y su test).
export { runAccountDeletion, verifyAccountDeleted };

// ------------------------------------------------------------------
// Bootstrap CLI — SOLO corre cuando el archivo se invoca directamente como script (nunca al
// importar runAccountDeletion/verifyAccountDeleted desde un test). Único punto de este archivo
// que lee variables de entorno o importa @supabase/supabase-js.
//
// Handoff 30 §2.C — exit code: 0 ÚNICAMENTE si la operación completó Y la verificación de
// postcondición confirma TODO (anonymized/authUnlinked/inactiveInBramu/storageClean/
// authDeleted/auditPurged). `runAccountDeletion` devolviendo `ok:true` ya no alcanza por sí solo
// para decidir el exit code — antes era el único criterio, lo que podía dar exit 0 aunque la
// postcondición real quedara incumplida.
//
// `pathToFileURL` (no un template literal `file://${...}`) — un path con espacios/caracteres
// especiales (real en este repo: "Otros Trabajos") se URL-encodea distinto en `import.meta.url`
// que en `process.argv[1]` crudo; comparar los strings directo hacía que este bootstrap NUNCA se
// activara en checkouts con esos caracteres, silenciosamente (el proceso terminaba con exit 0
// sin correr nada). `pathToFileURL` (importado arriba) aplica el mismo encoding que usa
// `import.meta.url`.
// ------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const playerId = process.argv[2];
  if (!playerId) {
    console.error('Uso: node admin-delete-player-account.mjs <playerId>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno. Nunca hardcodear estas credenciales.');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const result = await runAccountDeletion(supabaseAdmin, playerId, { log: (msg) => console.log(msg) });
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    console.error(`[account-deletion] FALLÓ en la fase "${result.step}" — reintentable, no se declara la operación cerrada.`);
    process.exit(1);
  }

  const postcondition = await verifyAccountDeleted(supabaseAdmin, playerId, result.authUserId);
  console.log('[account-deletion] Verificación post-condición:', JSON.stringify(postcondition, null, 2));

  if (!postcondition.ok) {
    console.error('[account-deletion] La operación reportó éxito pero la POSTCONDICIÓN quedó incompleta — reintentar.');
    process.exit(1);
  }

  process.exit(0);
}
