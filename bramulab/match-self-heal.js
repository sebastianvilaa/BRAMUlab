/* ==========================================================================
   BRAMU Lab — match-self-heal.js (hotfix validación atascada, bundle 04.11-h11)
   Ver docs/BRAMUlab/Implementacion/Pre_Production/37_Handoff_Hotfix_Validacion_Self_Healing_27SEP.md.

   Implementa el contrato que ya estaba documentado (pero nunca consumido) en
   supabase/functions/officialize-match/index.ts: "el reintento silencioso que el cliente
   dispara al detectar readyForValidation=true en una lectura". Extraído como módulo puro/UMD
   (mismo criterio que match-validation.js/match-level-engine.js) para poder testearlo con
   node --test sin depender de document/window — refreshServerMatches (app.js) es el único
   caller real, y sigue siendo el único choke point de lectura server-backed (nunca polling ni
   un intervalo de fondo: este módulo no programa timers, no reintenta más de una vez por
   partido por ciclo, y no se llama a sí mismo).

   Candidato elegible: status==='pending_validation' && readyForValidation===true &&
   !hasOpenIdentityIssue — EXACTAMENTE el estado que confirm_match_validation ya devuelve como
   {ok:true, code:'already_confirmed'|'confirmed_not_ready' nunca, readyForValidation:true,
   idempotentReturn:true} cuando ambas parejas ya confirmaron pero la oficialización inicial no
   llegó a correr. Nunca toca `status==='validated'` (esa fila ya no necesita nada) ni una fila
   con identidad cuestionada (correr ahí sería fabricar una identidad, prohibido explícitamente
   por el propio backend). */
(function (global) {
  'use strict';

  function warn(message, detail) {
    // vm.createContext (tests) no trae `console` real — typeof la protege sin lanzar.
    if (typeof console !== 'undefined' && typeof console.warn === 'function') console.warn(message, detail);
  }

  /** Único criterio de elegibilidad — reutilizado tanto para filtrar candidatos como para que
   *  un test pueda verificar el criterio en aislamiento sin correr ninguna llamada de red. */
  function isSelfHealCandidate(match) {
    return !!match
      && match.status === 'pending_validation'
      && match.readyForValidation === true
      && !match.hasOpenIdentityIssue;
  }

  function findSelfHealCandidateIds(matches) {
    if (!Array.isArray(matches)) return [];
    return matches.filter(isSelfHealCandidate).map((m) => m.matchId);
  }

  /** Ejecuta como máximo UN intento de `officializeMatch(matchId)` por candidato de este ciclo.
   *  `inFlightMatchIds` es un Set persistido por el caller (mismo patrón que justActedMatchIds
   *  en app.js) — sirve de guardia contra dos refreshServerMatches() superpuestos intentando
   *  oficializar el mismo partido a la vez (test #7 del handoff): el check-and-add de cada
   *  candidato ocurre de forma síncrona, ANTES del primer `await` de su propio intento, así que
   *  ninguna otra invocación concurrente de runSelfHeal puede intercalarse en el medio.
   *
   *  Nunca relee el estado canónico ni se reinvoca a sí mismo — eso es responsabilidad del
   *  caller (paso 5 del handoff: "si alguno oficializa con éxito, hacer UNA relectura canónica
   *  con self-heal desactivado para esa reentrada"), quien decide con `healedAny` si vale la
   *  pena una relectura. Un fallo queda solo en consola (nunca un throw, nunca un toast) —
   *  permite un intento futuro en una lectura posterior, sin loop dentro de este ciclo. */
  async function runSelfHeal(matches, options) {
    const opts = options || {};
    const officializeMatch = opts.officializeMatch;
    const inFlightMatchIds = opts.inFlightMatchIds;
    const candidateIds = findSelfHealCandidateIds(matches);
    if (!candidateIds.length || typeof officializeMatch !== 'function' || !inFlightMatchIds) {
      return { healedAny: false, healedMatchIds: [] };
    }

    const attempts = candidateIds.map(async (matchId) => {
      if (inFlightMatchIds.has(matchId)) return null;
      inFlightMatchIds.add(matchId);
      try {
        const result = await officializeMatch(matchId);
        if (result && result.ok) return matchId;
        warn('[match-self-heal] intento automático no confirmó éxito', { matchId, code: result && result.code });
        return null;
      } catch (err) {
        warn('[match-self-heal] intento automático lanzó una excepción', { matchId, message: err && err.message });
        return null;
      } finally {
        inFlightMatchIds.delete(matchId);
      }
    });

    const settled = await Promise.all(attempts);
    const healedMatchIds = settled.filter(Boolean);
    return { healedAny: healedMatchIds.length > 0, healedMatchIds };
  }

  global.PLMatchSelfHeal = { isSelfHealCandidate, findSelfHealCandidateIds, runSelfHeal };
})(typeof window !== 'undefined' ? window : globalThis);
