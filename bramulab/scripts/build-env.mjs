// Bloque 1 — Fundación de backend y entornos.
//
// Genera bramulab/env.generated.js a partir de variables de entorno.
// Se ejecuta como Build Command en Vercel (una vez por deploy) y también
// puede correrse en Development leyendo un archivo .env.<nombre> local.
//
// Nunca lee ni escribe SUPABASE_SERVICE_ROLE_KEY: ese secreto es exclusivo
// de funciones server-side futuras y no debe poder llegar al frontend.
//
// Uso:
//   node scripts/build-env.mjs                    (usa process.env tal cual, p. ej. en Vercel)
//   BRAMU_ENV_NAME=development node scripts/build-env.mjs   (carga .env.development si existe)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateEnv } from './env-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAMULAB_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(BRAMULAB_DIR, 'env.generated.js');
const ROBOTS_FILE = path.join(BRAMULAB_DIR, 'robots.generated.txt');

// Parser mínimo de archivos .env (sin dependencias). Solo asigna variables
// que todavía no estén definidas en process.env, igual que dotenv.
function loadDotEnvIfPresent(envName) {
  if (!envName) return;
  const dotEnvPath = path.join(BRAMULAB_DIR, `.env.${envName}`);
  if (!existsSync(dotEnvPath)) return;

  const contents = readFileSync(dotEnvPath, 'utf8');
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function main() {
  // BRAMU_ENV_NAME puede venir ya seteado (Vercel) o hace falta leerlo antes
  // de saber qué archivo .env.<nombre> cargar localmente.
  loadDotEnvIfPresent(process.env.BRAMU_ENV_NAME);

  const envName = process.env.BRAMU_ENV_NAME;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const vercelEnv = process.env.VERCEL_ENV;
  const isVercelBuild = process.env.VERCEL === '1';

  const result = validateEnv({ envName, supabaseUrl, supabaseAnonKey, vercelEnv, isVercelBuild });

  if (!result.ok) {
    console.error('[build-env] Build detenido: ' + result.reason);
    process.exit(1);
  }

  const fileContents =
    '// Generado por scripts/build-env.mjs — no editar a mano ni commitear.\n' +
    'window.__BRAMU_ENV__ = Object.freeze({\n' +
    `  name: ${JSON.stringify(envName)},\n` +
    `  supabaseUrl: ${JSON.stringify(supabaseUrl)},\n` +
    `  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},\n` +
    '});\n';

  writeFileSync(OUTPUT_FILE, fileContents, 'utf8');
  console.log(`[build-env] OK — entorno "${envName}" escrito en ${path.relative(BRAMULAB_DIR, OUTPUT_FILE)}`);

  // Staging/Development nunca deben indexarse; evita difusión accidental
  // (Backend_Infraestructura.md §11). Production mantiene un robots.txt normal.
  const robotsContents =
    envName === 'production' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
  writeFileSync(ROBOTS_FILE, robotsContents, 'utf8');
  console.log(`[build-env] robots.txt (${envName === 'production' ? 'indexable' : 'no-index'}) escrito en ${path.relative(BRAMULAB_DIR, ROBOTS_FILE)}`);
}

main();
