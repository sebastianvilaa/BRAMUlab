// BRAMUlab — V04.19 (L1): núcleo PURO del cleanup de altas abandonadas (> 24 h).
//
// Sin dependencias de Deno/Supabase: todo el I/O entra por `deps` (inyectado por la Edge Function
// `cleanup-abandoned-signups`, y por fakes en abandoned-signups-core.test.mjs).
//
// Política (Privacidad_Legal.md §4): un alta que NUNCA verificó el email se elimina al cumplir 24 h desde su
// inicio (auth.users.created_at) y su @usuario se libera; una cuenta con email confirmado — constituida o
// incompleta — JAMÁS se elimina por inactividad.
//
// Garantías de este núcleo
//   * REVALIDA cada candidato contra el estado real del usuario Auth (getAuthUser) inmediatamente antes de
//     borrar: confirmado / con sesión / más joven de 24 h => se omite, nunca se borra.
//   * Libera el @usuario (RPC release_abandoned_signup_username, que revalida bajo FOR UPDATE) ANTES del borrado
//     Auth: si el borrado falla, el estado queda consistente y un reintento lo completa.
//   * Idempotente: un usuario que ya no existe cuenta como `alreadyGone`, nunca como error; correr dos veces (o
//     dos ejecuciones concurrentes) no duplica ni rompe nada.
//   * Aislamiento de errores: el fallo de un usuario no detiene al resto.
//   * El resumen devuelto NO contiene emails ni ids de usuario (solo contadores): es lo único que se loguea.

export const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_BATCHES = 5;

function isAbandoned(user, nowMs, minAgeMs) {
  if (!user) return false;
  if (user.email_confirmed_at || user.phone_confirmed_at || user.last_sign_in_at) return false;
  const created = Date.parse(user.created_at);
  if (!Number.isFinite(created)) return false;
  return nowMs - created >= minAgeMs;
}

/**
 * @param {object} deps
 * @param {(limit:number)=>Promise<Array<{user_id:string}>>} deps.listCandidates  RPC list_abandoned_signups
 * @param {(userId:string)=>Promise<{eligible:boolean,usernameReleased:boolean}>} deps.releaseUsername  RPC release_abandoned_signup_username
 * @param {(userId:string)=>Promise<object|null>} deps.getAuthUser  auth.admin.getUserById (null si no existe)
 * @param {(userId:string)=>Promise<{ok:boolean, notFound?:boolean}>} deps.deleteAuthUser  auth.admin.deleteUser
 * @param {()=>number} [deps.now]
 */
export async function cleanupAbandonedSignups(deps, opts = {}) {
  const now = deps.now || (() => Date.now());
  const limit = opts.limit || DEFAULT_LIMIT;
  const maxBatches = opts.maxBatches || DEFAULT_MAX_BATCHES;
  const minAgeMs = Math.max(opts.minAgeMs || MIN_AGE_MS, MIN_AGE_MS); // nunca por debajo de 24 h
  const summary = { candidates: 0, deleted: 0, alreadyGone: 0, skipped: 0, usernamesReleased: 0, errors: 0 };
  const seen = new Set();

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = (await deps.listCandidates(limit)) || [];
    const fresh = rows.filter((r) => r && r.user_id && !seen.has(r.user_id));
    if (!fresh.length) break;

    for (const row of fresh) {
      seen.add(row.user_id);
      summary.candidates += 1;
      try {
        const user = await deps.getAuthUser(row.user_id);
        if (!user) { summary.alreadyGone += 1; continue; }
        if (!isAbandoned(user, now(), minAgeMs)) { summary.skipped += 1; continue; }

        const released = await deps.releaseUsername(row.user_id);
        if (!released || !released.eligible) { summary.skipped += 1; continue; }
        if (released.usernameReleased) summary.usernamesReleased += 1;

        // Última revalidación pegada al borrado: estrecha la ventana contra una confirmación concurrente.
        const again = await deps.getAuthUser(row.user_id);
        if (!again) { summary.alreadyGone += 1; continue; }
        if (!isAbandoned(again, now(), minAgeMs)) { summary.skipped += 1; continue; }

        const del = await deps.deleteAuthUser(row.user_id);
        if (del && del.ok) summary.deleted += 1;
        else if (del && del.notFound) summary.alreadyGone += 1;
        else summary.errors += 1;
      } catch (_e) {
        summary.errors += 1;
      }
    }
    if (rows.length < limit) break;
  }
  return summary;
}
