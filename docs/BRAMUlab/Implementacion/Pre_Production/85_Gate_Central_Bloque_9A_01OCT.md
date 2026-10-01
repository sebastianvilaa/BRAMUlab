# 85 — Gate Central Bloque 9A (Issue #19)

**Fecha:** 01/10/2026 · **Resultado:** **PASS en Staging**.

No se tocó main, Production, BRAMUlive, Comunicaciones/email ni OTP destructivo.

## Entrada
- baseline: `5caf15318a19eb4cd279825360312f979adbb2a5`;
- Claude: `a5ef575fef493bcbce38447d387c10cd29a6f1da`;
- resultado: `84_Resultado_Bloque_9A_Replay_Limpio_01OCT.md`;
- replay limpio de 70 migraciones + release-check.

## Gate vivo
Antes del baseline: **58** funciones `public` ejecutables por `authenticated`; la migración re-concedía exactamente **58**. Faltantes 0, extras 0.

### Hallazgo Central — PostgreSQL 17 `MAINTAIN`
`information_schema.role_table_grants` no expone este privilegio. Staging tenía **27 tablas public** con `MAINTAIN` heredado para `anon/authenticated`. No forma parte del contrato del cliente.

**Corrección absorbida:** revocación actual + default privileges incluyen `MAINTAIN`; audits/verifies lo controlan explícitamente.

Post-aplicación:
- tablas con `MAINTAIN` cliente: **0**;
- DML/TRUNCATE/REFERENCES/TRIGGER directos: **0**;
- anon SELECT: `app_config`, `legal_versions`;
- anon EXECUTE: `is_username_available`;
- authenticated EXECUTE: **58** previstas;
- tablas public sin RLS: **0**;
- buckets públicos: **0**;
- environment: `staging`;
- cron Ranking + cleanup: activos;
- `PREBLOQUE9_VERIFY_OK`.

La migración quedó aplicada como `bloque9a_baseline_privileges`.

## Edge Functions
Runtime Staging:
- `verify_jwt=true`: las 8 funciones orientadas a usuario;
- `verify_jwt=false`: `admin-resolve-identity-issue` y `cleanup-abandoned-signups`.

`admin-resolve-identity-issue` exige internamente la service role exacta. El expected estático decía `true`; Central corrigió check/manifest/docs sin redeploy innecesario.

## Advisors / Vercel
Advisors: solo warnings conocidos/intencionales o de optimización; ninguno nuevo bloqueante. `ops_health_snapshot()` operativo. Commit Claude: Vercel SUCCESS.

## Cierre
**Issue #19 puede cerrarse.** No quedan decisiones humanas abiertas en 9A.

Siguen fuera de 9A: Comunicaciones/Auth, QA browser Legal/Acceso, E2E OTP, Production y política real de backups.
