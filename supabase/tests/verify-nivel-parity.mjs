#!/usr/bin/env node
// BRAMUlab — Bloque 3: paridad del motor compartido de Nivel BRAMU.
//
// Compara, para las MISMAS respuestas crudas del cuestionario:
//   (a) Node, cargando localmente bramulab/level.js + bramulab/level-calibration.js (oráculo
//       de referencia — los mismos archivos que ya carga el navegador);
//   (b) la Edge Function `officialize-onboarding` ya desplegada en Supabase, que importa esos
//       MISMOS archivos vía symlink (ver supabase/functions/_shared/level.js y
//       level-calibration.js — no son copias, son el mismo archivo real de bramulab/).
//
// Si esto encuentra una diferencia, el problema NO es la fórmula (eso ya lo cubre
// bramulab/tests.html con su propia batería) — es que el deploy resolvió mal el symlink/
// import compartido y terminó ejecutando otra cosa. Ver
// docs/BRAMUlab/Implementacion/Backend/Bloque_03/03_Revision_ChatGPT.md §2.
//
// Necesita la Edge Function ya desplegada (`supabase functions deploy officialize-onboarding`)
// y una cuenta confirmada con sesión (crea y borra una propia, igual que verify-bloque3.mjs).
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/verify-nivel-parity.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno de esta terminal.');
  process.exit(1);
}

// level.js/level-calibration.js son scripts de navegador (IIFE que asignan a
// `window`/`globalThis`, sin `export`) — se cargan tal cual en un contexto vm nuevo, sin
// tocarlos ni envolverlos en ningún formato de módulo distinto al que ya usa index.html.
function loadSharedEngine() {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const relPath of ['level.js', 'level-calibration.js']) {
    const code = fs.readFileSync(path.join(__dirname, '..', '..', 'bramulab', relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return { LV: sandbox.PLLevel, LVC: sandbox.PLLevelCalibration };
}

const { LV, LVC } = loadSharedEngine();

function computeLocalOfficial(payload) {
  const rawResult = payload.mode === 'quick'
    ? LVC.computeQuickLevel(payload.quickSeedKey)
    : LVC.computeFullEstimate(payload.quizAnswers);
  const confirmResult = LVC.confirmInitialLevelV1_2(rawResult, new Date().toISOString());
  return { mu: confirmResult.origin.confirmedLevel, confidence: confirmResult.origin.confidenceOrigin };
}

const results = [];
function report(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${detail ? ' -> ' + detail : ''}`);
  return ok;
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

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) -> HTTP ${res.status}: ${await res.text()}`);
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

async function serviceDelete(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Prefer: 'return=minimal' },
  });
  return res.ok;
}

// Un caso por cada camino — no son los fixtures NOMBRADOS de
// Nivel_BRAMU_Implementacion.md §6 (Esteban/Seba/Lucho/Agustín): esos ya están cubiertos como
// paridad motor-JS-consigo-mismo en bramulab/tests.html. Acá el objetivo es otro: probar que
// el símlink/import compartido realmente trajo el MISMO archivo a la Edge Function, así que
// cualquier combinación fija y determinística alcanza.
const CASES = [
  { name: 'camino rápido', payload: { mode: 'quick', quickSeedKey: 'avanzado' } },
  {
    name: 'camino completo',
    payload: {
      mode: 'full',
      quizAnswers: {
        autoevaluacion: 'avanzado', anos: 'mas_5', entrenamiento: 'regular_actual',
        frecuencia: 'tres_mas_semana', red: 'd', paredes: 'e',
      },
    },
  },
];

async function main() {
  const stamp = Date.now().toString(36);
  const authIds = [];
  const playerIds = [];

  // Una cuenta nueva por caso: level_states solo puede oficializarse UNA vez por jugador
  // (PENDIENTE -> CALIBRANDO es de un solo sentido) — reutilizar la misma cuenta para el
  // segundo caso solo probaría idempotencia (ya cubierta en profundidad por
  // verify-bloque3.mjs), no paridad del motor para ese camino.
  for (let i = 0; i < CASES.length; i += 1) {
    const { name, payload } = CASES[i];
    const email = `bramu-verify-parity-${i}-${stamp}@example.com`;
    const password = 'Verificar#Paridad3!';
    const created = await adminCreateConfirmedUser(email, password);
    authIds.push(created.id);
    const session = await signIn(email, password);
    const token = session.access_token;

    const ownProfileRes = await fetch(`${url}/rest/v1/profiles?select=player_id`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    const ownProfileRows = ownProfileRes.ok ? await ownProfileRes.json() : null;
    const playerId = Array.isArray(ownProfileRows) && ownProfileRows[0] ? ownProfileRows[0].player_id : null;
    if (playerId) playerIds.push(playerId);

    const local = computeLocalOfficial(payload);
    const remoteRes = await fetch(`${url}/functions/v1/officialize-onboarding`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const remoteJson = remoteRes.ok ? await remoteRes.json() : null;
    const remoteOk = remoteRes.ok && remoteJson && remoteJson.ok && remoteJson.levelState;
    report(`${name}: la Edge Function respondió OK`, remoteOk, JSON.stringify(remoteJson));
    if (remoteOk) {
      const muMatches = Math.abs(remoteJson.levelState.mu - local.mu) < 1e-9;
      const confidenceMatches = Math.abs(remoteJson.levelState.confidence - local.confidence) < 1e-9;
      report(`${name}: mu de la Edge Function === mu de Node (mismo motor)`, muMatches, `local=${local.mu} remoto=${remoteJson.levelState.mu}`);
      report(`${name}: confidence de la Edge Function === confidence de Node`, confidenceMatches, `local=${local.confidence} remoto=${remoteJson.levelState.confidence}`);
    }
  }

  console.log('\nLimpiando cuentas de prueba...');
  for (const playerId of playerIds) {
    await serviceDelete(`level_events?player_id=eq.${playerId}`);
    await serviceDelete(`level_states?player_id=eq.${playerId}`);
    await serviceDelete(`pilot_events?player_id=eq.${playerId}`);
    await serviceDelete(`players?player_id=eq.${playerId}`);
  }
  for (const authId of authIds) {
    const deleted = await adminDeleteUser(authId);
    if (!deleted) console.warn(`ATENCIÓN: no se pudo borrar la cuenta de Auth ${authId} — revisar a mano en Staging.`);
  }

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(allPassed ? 'PARIDAD OK: la Edge Function usa el mismo motor que el navegador.' : 'PARIDAD: hay diferencias — revisar el symlink/import compartido antes de cerrar el bloque.');
  return allPassed;
}

let exitCode = 1;
try {
  exitCode = (await main()) ? 0 : 1;
} catch (err) {
  console.error('\nError durante la verificación de paridad:', err);
  exitCode = 1;
}
process.exit(exitCode);
