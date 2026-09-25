// BRAMUlab — Backend Bloque 3: oficialización server-side de Nivel BRAMU.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_03/03_Revision_ChatGPT.md §2.
//
// Reutiliza el MISMO motor JS que usa el navegador para la vista previa local
// (level.js/level-calibration.js), importado acá como side-effect import desde
// supabase/functions/_shared/ — esos dos archivos son SYMLINKS reales a
// bramulab/level.js y bramulab/level-calibration.js (ver el propio directorio _shared/),
// nunca una copia manual: editar el motor en bramulab/ cambia automáticamente lo que corre
// acá, sin un segundo lugar que mantener sincronizado ni riesgo de divergencia.
//
// El navegador nunca es autoridad: solo junta las respuestas del cuestionario y muestra una
// estimación local antes de confirmar el email. Esta función es la que corre el motor real
// (a partir de esas MISMAS respuestas crudas, nunca de un nivel ya calculado por el cliente)
// y pide la persistencia atómica a `officialize_level_onboarding` (RPC privada, ver la
// migración `20260919120000_bloque3_nivel_persistente.sql`), alcanzable EXCLUSIVAMENTE con la
// service role key — el cliente nunca puede llamar esa RPC directo, así que nunca puede
// inyectar un mu/confidence arbitrario sin pasar antes por el motor real de acá.
//
// Body esperado (JSON), enviado con el access token del usuario en el header Authorization:
//   { mode: 'quick'|'full', quickSeedKey?: string, quizAnswers?: object }
// Nivel inicial V1.2: país/rama/categoría local NO forman parte del payload ni del cálculo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import '../_shared/level.js';
import '../_shared/level-calibration.js';

// deno-lint-ignore no-explicit-any
const LV = (globalThis as any).PLLevel;
// deno-lint-ignore no-explicit-any
const LVC = (globalThis as any).PLLevelCalibration;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  if (!LV || !LVC) {
    // No debería pasar nunca: level.js/level-calibration.js son el MISMO archivo que usa el
    // navegador (symlink, ver supabase/functions/_shared/). Si esto dispara, el import
    // compartido se rompió — nunca cae a una reimplementación local del motor acá.
    return jsonResponse({ ok: false, error: 'engine_unavailable' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return jsonResponse({ ok: false, error: 'missing_authorization' }, 401);

  // Verifica el JWT del usuario con el cliente ANON (nunca con la service role acá): esto es
  // lo que impide que cualquiera invoque esta función a nombre de otro usuario.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData || !userData.user) {
    return jsonResponse({ ok: false, error: 'invalid_session' }, 401);
  }
  const authUserId = userData.user.id;

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_payload' }, 400);
  }

  const mode = payload && payload.mode;

  if (mode !== 'quick' && mode !== 'full') {
    return jsonResponse({ ok: false, error: 'invalid_questionnaire_mode' }, 400);
  }

  // Respuestas CRUDAS del cuestionario, nunca un Nivel ya calculado por el cliente — el motor
  // corre acá de nuevo, sobre exactamente los mismos datos que el navegador usó para su vista
  // previa local (Nivel_BRAMU_Formula_V1.5.md §3, sin cambios de fórmula).
  const rawResult = mode === 'quick'
    ? LVC.computeQuickLevel(payload.quickSeedKey)
    : LVC.computeFullEstimate(payload.quizAnswers || {});

  if (!rawResult) {
    return jsonResponse({ ok: false, error: 'invalid_questionnaire_answers' }, 400);
  }

  const confirmedAt = new Date().toISOString();
  // V1.2 — mismo estimador universal que el navegador: la categoría local no participa del
  // alta ni del número oficial. La autoridad sigue siendo este recálculo server-side.
  const confirmResult = LVC.confirmInitialLevelV1_2(rawResult, confirmedAt);
  if (!confirmResult || !confirmResult.ok) {
    return jsonResponse({ ok: false, error: 'engine_confirmation_failed' }, 400);
  }

  const mu = confirmResult.origin.confirmedLevel;
  const confidence = confirmResult.origin.confidenceOrigin;
  const inputContext = mode === 'quick'
    ? { quickSeedKey: payload.quickSeedKey }
    : { quizAnswers: payload.quizAnswers };

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: levelState, error: rpcError } = await serviceClient.rpc('officialize_level_onboarding', {
    p_auth_user_id: authUserId,
    p_algorithm_version: LV.ALGORITHM_VERSION,
    p_questionnaire_version: LVC.QUESTIONNAIRE_VERSION,
    p_questionnaire_mode: mode,
    p_mu: mu,
    p_confidence: confidence,
    // Pre-Production P0.1C (revisión 2, 24/09/2026): reenvía el valor REAL del motor en vez de
    // hardcodear null — pero el estimador universal V1.2 (confirmInitialLevelV1_2, ver
    // level-calibration.js) construye a propósito un paso neutral (`computeCategoryStep(rawResult,
    // null, null)`): el cuestionario actual no le pide categoría al usuario, así que estos dos
    // campos van a seguir evaluando null en la práctica hasta que exista una decisión de producto
    // aparte de reabrir esa pregunta en el onboarding (fuera de alcance acá). Este fix elimina el
    // hardcode engañoso y deja el código correcto ante cualquier cambio futuro del motor.
    p_declared_category: confirmResult.origin.declaredCategory,
    p_category_context_key: confirmResult.origin.categoryContextKey,
    p_input_context: inputContext,
    p_result: confirmResult.origin,
  });

  if (rpcError) {
    return jsonResponse({ ok: false, error: rpcError.message || 'persist_failed' }, 500);
  }

  return jsonResponse({ ok: true, levelState });
});
