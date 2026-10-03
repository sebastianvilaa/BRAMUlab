// BRAMUlab — V04.29 · Replay de Nivel de una recuperación de identidad (server-side, motor JS COMPARTIDO).
//
// Contexto (116 §4): la provisional nunca tuvo delta propio. Cuando una cuenta recupera una identidad, los partidos
// recuperados que cumplen las reglas vigentes de Nivel aportan evidencia SOLO al jugador recuperado, en orden `played_at`
// ASC, partiendo de su Nivel vigente al iniciar el replay y usando los snapshots HISTÓRICOS reales de compañero/rivales
// (priorSnapshots del propio partido) — nunca niveles actuales de terceros. NO hay fórmula nueva: se reutiliza
// PLMatchLevelEngine.computeOfficializationResult / computeLevelStateUpdates (nivel_bramu_v1_0), el mismo motor que
// officialize-match, importado como global por la Edge Function (symlinks reales a bramulab/*.js).
//
// La persistencia atómica la hace SQL (apply_level_recovery_effect / record_level_recovery_skip); acá solo se decide y se
// calcula. Idempotente y reanudable: un partido con fila de ledger (aplicado u omitido) nunca se reprocesa; un lease por
// recuperación evita dos procesadores a la vez; cada aplicación verifica el estado del target de forma optimista y, si
// otro proceso lo movió, relee y reintenta (acotado).
//
// Si falta evidencia histórica NO se inventa: el partido queda en Historial/Stats sin efecto de Nivel (skipped_*).

const MAX_STALE_RETRIES = 3;
const LEASE_TTL_SECONDS = 300;

function engines() {
  const g = globalThis;
  return { LV: g.PLLevel, MS: g.PLMatchSync, MLE: g.PLMatchLevelEngine };
}

/** Procesa el Nivel de UNA recuperación. Devuelve `{ok, status, applied, skipped, errors}`:
 *   status: 'completed' | 'pending_level' (el target todavía no tiene Nivel base) | 'busy' (otro procesador) |
 *           'partial' (quedaron partidos por reintentar) | 'not_found'. */
export async function processIdentityRecoveryLevel(serviceClient, recoveryId) {
  const { LV, MS, MLE } = engines();
  if (!LV || !MS || !MLE) return { ok: false, code: 'engine_unavailable' };

  const first = await serviceClient.rpc('get_identity_recovery_level_input', { p_recovery_id: recoveryId });
  if (first.error) return { ok: false, code: 'input_fetch_failed', detail: first.error.message };
  if (!first.data || first.data.ok === false) return { ok: true, status: 'not_found' };
  if (first.data.levelStatus !== 'pending') return { ok: true, status: 'completed', idempotentReturn: true, applied: 0, skipped: 0 };
  if (first.data.target.status === 'PENDIENTE' || !Number.isFinite(first.data.target.mu)) {
    return { ok: true, status: 'pending_level', applied: 0, skipped: 0 };
  }

  const lease = await serviceClient.rpc('acquire_identity_recovery_level_lease', { p_recovery_id: recoveryId, p_ttl_seconds: LEASE_TTL_SECONDS });
  if (lease.error) return { ok: false, code: 'lease_failed', detail: lease.error.message };
  if (!lease.data) return { ok: true, status: 'busy', applied: 0, skipped: 0 };
  const leaseToken = lease.data;

  const summary = { ok: true, status: 'partial', applied: 0, skipped: 0, errors: [] };
  let releaseError = null;
  try {
    const targetPlayerId = first.data.targetPlayerId;
    // Lista fresca de partidos pendientes (ledger vacío), ya ordenada por played_at ASC.
    const input = await serviceClient.rpc('get_identity_recovery_level_input', { p_recovery_id: recoveryId });
    const pending = (input.data && input.data.pendingMatches) || [];

    for (const m of pending) {
      let outcome = null;
      for (let attempt = 0; attempt < MAX_STALE_RETRIES; attempt += 1) {
        outcome = await processOneMatch(serviceClient, { LV, MS, MLE }, { recoveryId, leaseToken, targetPlayerId, matchId: m.matchId });
        if (outcome.retry) continue;
        break;
      }
      if (!outcome || outcome.retry) { summary.errors.push({ matchId: m.matchId, code: 'stale_retries_exhausted' }); break; }
      if (outcome.error) { summary.errors.push({ matchId: m.matchId, code: outcome.error }); break; }
      if (outcome.applied) summary.applied += 1; else summary.skipped += 1;
    }

    if (!summary.errors.length) {
      const done = await serviceClient.rpc('complete_identity_recovery_level', { p_recovery_id: recoveryId, p_lease: leaseToken });
      if (done.error || !done.data || done.data.ok !== true) {
        summary.errors.push({ code: (done.data && done.data.code) || 'complete_failed' });
      } else {
        summary.status = 'completed';
      }
    }
    if (summary.errors.length) releaseError = summary.errors.map((e) => e.code).join(',');
  } catch (e) {
    summary.ok = false;
    summary.errors.push({ code: 'exception', detail: String((e && e.message) || e) });
    releaseError = 'exception';
  } finally {
    // complete_identity_recovery_level ya limpia el lease cuando termina bien; si no, se libera con el error registrado.
    await serviceClient.rpc('release_identity_recovery_level_lease', { p_recovery_id: recoveryId, p_lease: leaseToken, p_error: releaseError });
  }
  return summary;
}

/** Procesa los pendientes de un target (reintento silencioso). */
export async function processPendingRecoveriesForPlayer(serviceClient, targetPlayerId) {
  const { data, error } = await serviceClient.rpc('list_identity_recoveries_pending_level', { p_target_player_id: targetPlayerId });
  if (error) return { ok: false, code: 'list_failed', results: [] };
  const results = [];
  for (const row of data || []) {
    results.push({ recoveryId: row.recovery_id, ...(await processIdentityRecoveryLevel(serviceClient, row.recovery_id)) });
  }
  return { ok: true, results };
}

async function recordSkip(serviceClient, ctx, status, reasonCodes, snapshots) {
  const r = await serviceClient.rpc('record_level_recovery_skip', {
    p_recovery_id: ctx.recoveryId, p_lease: ctx.leaseToken, p_match_id: ctx.matchId,
    p_status: status, p_reason_codes: reasonCodes, p_snapshots: snapshots || null,
  });
  if (r.error || !r.data || r.data.ok !== true) return { error: (r.data && r.data.code) || 'record_skip_failed' };
  return { applied: false };
}

async function processOneMatch(serviceClient, { LV, MS, MLE }, ctx) {
  const T = ctx.targetPlayerId;
  const snap = await serviceClient.rpc('get_match_officialization_snapshot', { p_match_id: ctx.matchId });
  if (snap.error) return { error: 'snapshot_fetch_failed' };
  const snapshot = snap.data;
  if (!snapshot) return recordSkip(serviceClient, ctx, 'skipped_ineligible', ['partido_no_encontrado']);

  if (snapshot.status !== 'validated' || !snapshot.validatedAt) {
    return recordSkip(serviceClient, ctx, 'skipped_ineligible', ['partido_no_validado']);
  }
  if (!MLE.isWithinNivelWindow(snapshot.playedAt, snapshot.validatedAt)) {
    return recordSkip(serviceClient, ctx, 'skipped_ineligible', [MLE.REASON_OUTSIDE_NIVEL_WINDOW]);
  }
  const applied = snapshot.currentAppliedResult || null;
  if (!applied) return recordSkip(serviceClient, ctx, 'skipped_missing_snapshot', ['sin_resultado_de_nivel_vigente']);
  if (!applied.eligible) {
    return recordSkip(serviceClient, ctx, 'skipped_ineligible', ['resultado_original_no_elegible'].concat(applied.reasonCodes || []));
  }
  if ((applied.players || []).some((p) => p.playerId === T)) {
    return recordSkip(serviceClient, ctx, 'skipped_ineligible', ['target_ya_tiene_efecto_en_el_partido']);
  }
  const participants = snapshot.participants || [];
  if (!participants.some((p) => p.playerId === T)) {
    return recordSkip(serviceClient, ctx, 'skipped_ineligible', ['target_no_participa']);
  }

  // Referencias de fórmula HISTÓRICAS reales de los demás (las mismas que alimentaron el cálculo original del partido).
  const priorByPlayerId = {};
  (snapshot.priorSnapshots || []).forEach((p) => { priorByPlayerId[p.playerId] = p; });
  const playerStates = {};
  const othersUsed = [];
  participants.forEach((p) => {
    if (!p.playerId || p.playerId === T) return;
    const prior = priorByPlayerId[p.playerId];
    if (!prior) return; // sin Nivel al momento del partido => invitado/imputado, igual que en el cálculo original.
    playerStates[p.playerId] = { mu: prior.muBefore, confidence: prior.confidenceBefore, state: MLE.mapLevelStateStatusToEngineState(prior.state) };
    othersUsed.push({ playerId: p.playerId, muBefore: prior.muBefore, confidenceBefore: prior.confidenceBefore, state: prior.state });
  });

  // Estado del target AHORA (parte de su Nivel vigente / base) — fresco en cada partido.
  const ls = (snapshot.levelStates || []).find((x) => x.playerId === T);
  if (!ls || !Number.isFinite(ls.mu) || ls.status === 'PENDIENTE') return { error: 'level_pending' };
  const liveT = { mu: ls.mu, confidence: ls.confidence, evidenceUnits: Number(ls.evidenceUnits) || 0, lastRatedAt: ls.lastRatedAt, status: ls.status };

  const matchForEngine = Object.assign({}, snapshot, { sets: snapshot.sets, participants });
  const localMatch = MS.translateServerMatchToLocalShape(matchForEngine);
  const dict = MLE.buildPlayerStatesDict([{ playerId: T, mu: liveT.mu, confidence: liveT.confidence, status: liveT.status, lastRatedAt: liveT.lastRatedAt }], localMatch.playedAt);
  if (dict[T]) playerStates[T] = dict[T];

  const knownIds = participants.map((p) => p.playerId).filter((id) => typeof id === 'string');
  let history = [];
  if (knownIds.length) {
    const h = await serviceClient.rpc('get_player_match_history_for_level_engine', { p_player_ids: knownIds, p_before_played_at: snapshot.playedAt });
    if (h.error) return { error: 'history_fetch_failed' };
    history = (h.data || []).map((row) => MS.translateServerMatchToLocalShape(row));
  }

  const officialization = MLE.computeOfficializationResult({ localMatch, history, playerStates, validatedAtIso: snapshot.validatedAt });
  if (!officialization.eligible) {
    return recordSkip(serviceClient, ctx, 'skipped_ineligible', officialization.reasonCodes || [], { others: othersUsed });
  }

  // Efecto SOLO del target: únicamente su estado LIVE se informa, así terceros nunca reciben fila ni delta.
  const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult: null,
    engineOutput: officialization.engineOutput,
    guestPlayerIds: officialization.guestPlayerIds || [],
    currentLevelStatesByPlayerId: { [T]: liveT },
  });
  const resultPlayer = resultPlayers.find((p) => p.playerId === T);
  const update = levelStateUpdates.find((u) => u.playerId === T);
  if (!resultPlayer || !update) {
    return recordSkip(serviceClient, ctx, 'skipped_ineligible', ['target_sin_efecto_en_el_motor'], { others: othersUsed });
  }

  const r = await serviceClient.rpc('apply_level_recovery_effect', {
    p_recovery_id: ctx.recoveryId, p_lease: ctx.leaseToken, p_match_id: ctx.matchId, p_expected_result_id: applied.resultId,
    p_result_player: resultPlayer, p_level_state_update: update, p_algorithm_version: LV.ALGORITHM_VERSION,
    p_reason_codes: officialization.reasonCodes || [],
    p_snapshots: { others: othersUsed, target: { mu: liveT.mu, confidence: liveT.confidence, evidenceUnits: liveT.evidenceUnits, status: liveT.status }, sourceResultId: applied.resultId, validatedAt: snapshot.validatedAt },
  });
  if (r.error) return { error: 'apply_failed' };
  const d = r.data || {};
  if (d.ok === true) return { applied: d.status === 'applied' };
  if (d.code === 'stale_level_snapshot' || d.code === 'stale_match_state') return { retry: true };
  if (d.code === 'target_already_in_result') return recordSkip(serviceClient, ctx, 'skipped_ineligible', ['target_ya_tiene_efecto_en_el_partido']);
  return { error: d.code || 'apply_rejected' };
}
