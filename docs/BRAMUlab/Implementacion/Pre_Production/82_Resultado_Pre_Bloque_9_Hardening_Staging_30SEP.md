# 82 — Resultado Pre-Bloque 9: hardening de Staging (Issue #17)

**Fecha:** 30/09/2026 · **Entorno:** solo Staging · **Versión:** V04.20, bundle `04.20-h2` (único cambio frontend: sw.js/auth.js/app.js).
Migración nueva **sin aplicar** (la aplica Central): `20260930340000_preprod_prebloque9_hardening.sql`. No se tocó emails/SMTP/Secure Email Change, E2E con OTP, main, Production ni BRAMUlive, ni reglas deportivas.

## 1. Qué se auditó
- **Permisos / RPC:** inventario estático de las 115 funciones de `public` (`supabase/scripts/audit-migration-grants.mjs`, convertido en test de regresión) + consulta viva para Central (`supabase/tests/audit-live-grants.sql`).
- **Rate limits:** los 17 límites existentes y todas las RPC/Edge Functions de escritura o cómputo pesado.
- **Caché / SW / entornos:** `sw.js`, `env-guard.mjs`, `build-env.mjs`, `env.generated.js`, claves de `store.js`.
- **Métricas:** eventos reales de `pilot_events`; **operación:** scripts/RPCs administrativos existentes.

## 2. Riesgos reales encontrados → corrección
| # | Riesgo | Evidencia | Corrección |
|---|---|---|---|
| 1 | `env.generated.js` (URL/anon key/entorno) podía servirse **cache-first** por el SW tras un redeploy de solo-configuración → app apuntando a un proyecto viejo/ajeno | `sw.js`: el handler solo exceptuaba `version.json`; el runtime cacheaba todo GET same-origin | SW: `env.generated.js` siempre red + `no-store`; sin red queda sin backend (fail-closed) |
| 2 | Credenciales cruzadas no detectables en runtime (solo en build) | `app_config.environment` no se comparaba con el env del bundle | `Auth.verifyBackendEnvironment()` en el boot: si `app_config.environment ≠ __BRAMU_ENV__.name` ⇒ backend `unavailable` (fail-closed); sin lectura de red no bloquea |
| 3 | 3 funciones **trigger** `SECURITY DEFINER` con EXECUTE implícito para PUBLIC (`_bloque6_enrich_notification_actor`, `_groups_assert_has_active_admin`, `legal_acceptances_reject_mutation`) | inventario | `revoke … from public, anon, authenticated` (los triggers no necesitan EXECUTE del cliente) |
| 4 | RPC de escritura de `authenticated` sin límite con riesgo concreto: `report_identity_issue` (genera incidencias/notificaciones a otros jugadores ⇒ spam), `update_profile_avatar`, `complete_contact_profile_data` (teléfono), `update_current_category`, `set_match_private_note`, `hide_match_for_me`, `set_ranking_network_hidden` | inventario de `consume_rate_limit` | guard `consume_auth_rate_limit(auth.uid(), …)` al inicio (mismos cuerpos vigentes; `CREATE OR REPLACE` conserva grants) |
| 5 | Las 7 Edge Functions de usuario (create-or-attach-match, officialize-match/onboarding, propose/respond correction, resolve-identity-issue, get-match-intelligence — esta última y officialize-onboarding ejecutan motores pesados) sin límite por cuenta | grep | `consume_auth_rate_limit` (service_role) + `_shared/rate-limit.ts`; 429 `rate_limited` (el cliente ya lo trata como transitorio en el outbox); fail-open ante falla del propio limitador |
| 6 | `api_rate_limits` crece sin purga | esquema | `purge_old_rate_limits()` (service_role, conserva 7 días) |

## 3. Clasificado como intencional / sin cambio (con evidencia)
- `is_username_available` ejecutable por **anon**: decisión de producto de Bloque 3 (feedback previo a la confirmación del email; migración `20260919153500`). Riesgo residual: enumeración de @usuario sin límite por cuenta (no hay identidad previa). Mitigación disponible solo a nivel de gateway/WAF — **fuera de alcance** de esta ronda.
- Helpers `_group_photo_*` ejecutables por `authenticated`: los usan las políticas RLS de Storage evaluadas como el usuario (Advisor lo marca; es intencional y están acotados por `auth.uid()`).
- ~54 RPC `SECURITY DEFINER` de `authenticated`: todas resuelven al llamador con `auth.uid()` (directo o vía `_groups_caller_player_id`) o son de lectura pública de datos no sensibles (`get_current_ranking_edition`). Las de Grupos/Ranking/Perfil ya tenían límite.
- Match/corrección/onboarding **no** son alcanzables por el cliente: sus RPC son `service_role` y las invocan Edge Functions que verifican el JWT.
- Separación Staging/Production: `localStorage` y Cache Storage son **por origen** (cada deploy es otro dominio); no hay claves de store ligadas a un entorno; la service role no existe en el frontend ni en el build (test). `env-guard.mjs` ya cortaba el build ante variables faltantes o cruzadas (test ampliado).

## 4. Métricas mínimas
`select public.ops_health_snapshot();` (solo `service_role`, solo agregados). Fuentes **reales**: `players/profiles/level_states/legal_acceptances/matches/api_rate_limits` y los eventos que el backend efectivamente emite en `pilot_events` (`signup_completed`, `level_confirmed`, `match_created`, `match_validated`, `provisional_claimed`, `account_deleted`). No se inventaron KPIs ni se integró analítica externa. Los eventos declarados pero nunca emitidos (`signup_started`, `level_started`, `match_rejected`, `calibration_*`, `daily_active`) **no** se usan.

## 5. Operación y salida
`docs/BRAMUlab/Runbook_Operacion_y_Salida.md`: Parte A (exportación, cuenta problemática, corrección/anulación excepcional, eliminación, altas abandonadas, purga) reutilizando scripts/RPCs existentes; Parte B (checklist de creación de Production, con ⛔ en cada paso que requiere autorización de Sebastián). **No se ejecutó ningún paso.**

## 6. Pruebas
- Node (focal): `bramulab/prebloque9-hardening.test.mjs` (inventario de grants, rate limits en SQL/Edge, SW con fetch real simulado, env cruzado/runtime, métricas, runbook) y regresión completa de `bramulab/*.test.mjs`, `bramulab/scripts`, `supabase/**` (resultado en el commit).
- SQL (para Central, BEGIN/ROLLBACK): `supabase/tests/verify-preprod-prebloque9-hardening.sql` y `supabase/tests/audit-live-grants.sql`. **No ejecutados** (sin Supabase acá).
- Advisors: no consultables desde este entorno; Central los corre tras aplicar la migración (esperado: desaparecen las 3 funciones trigger; permanecen `is_username_available` y `_group_photo_*` como advertencias intencionales).

## 7. Pendiente exclusivamente por terceros
- **Central:** aplicar la migración, correr verify + `audit-live-grants.sql` + advisors, desplegar las 7 Edge Functions modificadas (`create-or-attach-match`, `officialize-match`, `officialize-onboarding`, `propose-match-correction`, `respond-match-correction`, `resolve-identity-issue`, `get-match-intelligence`; **requieren la migración aplicada primero**: llaman a `consume_auth_rate_limit`, aunque fail-open si falta), y revisar el deploy Vercel.
- **Comunicaciones / Work / OTP:** emails, SMTP, Secure Email Change, QA browser, E2E destructivo.
- **Production (autorización de Sebastián):** todo lo de la Parte B del runbook, política real de backups, AAIP/RNBDP.

## 8. DECISIONES ABIERTAS
Ninguna. (Nota informativa: ¿se quiere un límite adicional en gateway/WAF para `is_username_available` anónima? Hoy es riesgo aceptado/documentado, no bloquea.)
