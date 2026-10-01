# 91 — Gate Central G1 antes de Work

**Fecha:** 01/10/2026  
**Issue:** #21  
**Entrega Claude:** `3c1999f441de007d6ab3c0892dd119c7c096b2cd` · bundle `04.20-h4`  
**Resultado:** **PASS TÉCNICO PRE-WORK EN STAGING**. G1 completo todavía NO está cerrado.

## Alcance revisado

- diff completo contra `a7178a9caaef251d743c035a8e6b306552595b65`;
- migración de desafíos sensibles;
- aislamiento de propósito/usuario y permisos;
- Edge `account-challenge`;
- actualización de `delete-my-account`;
- integración cliente de cambio de email/eliminación;
- templates/copy versionados;
- configuración preparada para hosted Auth;
- regresión de hardening anterior.

## Supabase Staging — ejecutado por Central

Proyecto confirmado: `bramulab-staging` / `serxtivkfnptzurnvewg`.

1. Migración G1 ejecutada primero con `BEGIN/ROLLBACK`: **PASS**.
2. Migración aplicada como `g1_emails_account_challenges`, versión registrada `20261001162823`.
3. `verify-g1-emails-account-challenges.sql`: **PASS / rollback limpio**.
4. Estado post:
   - `account_challenges` vacía;
   - RLS: ON;
   - policies de cliente: 0;
   - SELECT anon/authenticated: NO;
   - PostgreSQL 17 `MAINTAIN` anon/authenticated: NO;
   - 10 RPC G1: anon/authenticated EXECUTE = NO; service_role = SÍ.
5. Edge Functions:
   - `account-challenge` ACTIVE v1, `verify_jwt=true`;
   - `delete-my-account` ACTIVE v2, `verify_jwt=true`.
6. Regresión: `PREBLOQUE9_VERIFY_OK`.
7. Advisors: sin hallazgo nuevo bloqueante. El nuevo `RLS enabled / no policy` es intencional para la tabla server-only.
8. Commit funcional Claude: Vercel SUCCESS.

## Revisión de contrato

La arquitectura respeta las 8 comunicaciones cerradas:

- signup/recovery/password-changed nativos;
- cambio de email BRAMU con exactamente 2 verificaciones server-side;
- eliminación con prueba específica `delete_account`;
- Email #8 únicamente después de postcondiciones reales;
- no se reutiliza recovery para cambio de email ni eliminación;
- no se tocó main, Production ni BRAMUlive.

## Corrección absorbida por Central

El manifest generado omitía Email #4 de la lista `custom` porque también tiene `native: email_change` como fallback. El flujo real sí lo envía por Edge+SMTP.

**FUSIONAR:** #4 debe aparecer:
- en `custom`: mecanismo real BRAMU;
- en `native`: fallback defensivo de plataforma.

No implica dos emails en el flujo normal.

## Qué NO está hecho todavía

Las funciones están desplegadas pero **fail-closed** hasta que Work termine configuración:

- `BRAMU_CHALLENGE_PEPPER`;
- secrets SMTP para las Edge;
- `BRAMU_PUBLIC_BASE_URL`;
- templates/asuntos hosted de Auth;
- password-changed notification ON;
- email-changed notification OFF;
- Secure Email Change ON;
- OTP 6 dígitos / 3600 s;
- verificación de Site URL/logo/sender;
- QA real de emails y secuencias.

No intentar cerrar Issue #21 antes de esa pasada.

## Gate

**Backend/versionado G1 → PASS para pasar a Work.**  
**G1 global → PENDIENTE Work + QA.**

Fuente de la siguiente ronda:
`92_Handoff_G1_Work_Supabase_QA_01OCT.md`.
