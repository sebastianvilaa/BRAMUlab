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
//   { mode: 'full', questionnaireVersion?: 'nivel_inicial_v1_3',
//     quizAnswers: { panorama, ritmo, ataque, defensa, decisiones }  // enteros 0..9 (posición del slider) }
// Nivel inicial V1.3 (BRAMUlab V04.28): único cuestionario adaptativo de 5 preguntas. No existe
// camino rápido, ni autoetiqueta, años, frecuencia, entrenamiento, categoría o género en el payload
// ni en el cálculo. `mode` se conserva como 'full' solo por compatibilidad con la restricción
// quick|full de la base; el discriminador normativo es `questionnaire_version`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withinRateLimit } from '../_shared/rate-limit.ts';
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

  // Pre-Bloque 9 — límite por cuenta (anti-abuso; ver _shared/rate-limit.ts).
  if (!(await withinRateLimit(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, authUserId, 'edge_officialize_onboarding', 10, 600))) {
    return jsonResponse({ ok: false, code: 'rate_limited' }, 429);
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_payload' }, 400);
  }

  const mode = payload && payload.mode;

  // V1.3: único modo admitido. 'quick' (y cualquier otro valor) se rechaza: el camino rápido ya
  // no existe en ninguna capa.
  if (mode !== LVC.QUESTIONNAIRE_MODE) {
    return jsonResponse({ ok: false, error: 'invalid_questionnaire_mode' }, 400);
  }
  if (payload.questionnaireVersion != null && payload.questionnaireVersion !== LVC.QUESTIONNAIRE_VERSION) {
    return jsonResponse({ ok: false, error: 'invalid_questionnaire_version' }, 400);
  }

  // Respuestas CRUDAS (posiciones 0..9 del slider), nunca un Nivel ya calculado por el cliente: el
  // motor corre acá de nuevo, sobre exactamente los mismos datos que usó la vista previa local
  // (handoff 111 §8). Las ramas se derivan acá de las respuestas — el cliente no las dicta.
  const rawResult = LVC.computeInitialEstimateV13(payload.quizAnswers);

  if (!rawResult) {
    return jsonResponse({ ok: false, error: 'invalid_questionnaire_answers' }, 400);
  }

  const confirmedAt = new Date().toISOString();
  const confirmResult = LVC.confirmInitialLevelV13(rawResult, confirmedAt);
  if (!confirmResult || !confirmResult.ok) {
    return jsonResponse({ ok: false, error: 'engine_confirmation_failed' }, 400);
  }

  const mu = confirmResult.origin.confirmedLevel;
  const confidence = confirmResult.origin.confidenceOrigin;
  const inputContext = { quizAnswers: rawResult.positions };

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: levelState, error: rpcError } = await serviceClient.rpc('officialize_level_onboarding', {
    p_auth_user_id: authUserId,
    p_algorithm_version: LV.ALGORITHM_VERSION,
    p_questionnaire_version: LVC.QUESTIONNAIRE_VERSION,
    p_questionnaire_mode: LVC.QUESTIONNAIRE_MODE,
    p_mu: mu,
    p_confidence: confidence,
    // V1.3 no tiene categoría local: el motor devuelve siempre null en estos dos campos.
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
