# BRAMUlab — Runbook de operación y checklist de salida (Pre-Bloque 9)

**Estado:** preparado en Staging el 30/09/2026 (V04.20 / 04.20-h2). **Nada de la Parte B se ejecuta sin autorización explícita de Sebastián.**
Este documento no contiene secretos: las credenciales viven solo en variables de entorno / Vault / Vercel.

---

## Parte A — Operación administrativa (Staging hoy; Production igual cuando exista)

Regla: **reutilizar** scripts/RPCs existentes; no hay un segundo motor. Todo corre con `service_role` desde una máquina de confianza (variables de entorno `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; nunca pegarlas en chats/issues).

| Necesidad | Herramienta vigente | Notas |
|---|---|---|
| Salud operativa de los primeros usuarios | `select public.ops_health_snapshot();` (SQL editor / service_role) | Solo agregados: cuentas, perfiles completos, Nivel oficializado, reaceptación pendiente, altas sin confirmar > 24 h (esperado 0), partidos por estado y vencidos sin validar, eventos 7 días, partidos por día, rate limits de la última hora. Sin ids ni emails. |
| Auditar permisos | `supabase/tests/audit-live-grants.sql` + `node supabase/scripts/audit-migration-grants.mjs` | Esperado en `audit-live-grants.sql`: (1) solo `is_username_available` SECURITY DEFINER ejecutable por anon; (2) solo helpers `_group_photo_*` entre los SECURITY DEFINER internos deliberados para authenticated; (3) ninguna tabla sin RLS; (4) ningún grant directo INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER para anon/authenticated — los SELECT intencionales quedan protegidos por RLS; (5) ningún bucket público. |
| Acceso/copia de datos de una persona | `node supabase/scripts/admin-export-player-data.mjs <playerId \| @usuario> [salida.json]` (RPC `admin_export_player_data`) | Solicitud por `bramulab@gmail.com`. El informe sale con permisos 0600; enviarlo solo al email registrado de la cuenta y borrarlo local. Terceros redactados. |
| Eliminación de cuenta | Autoservicio (`delete-my-account`) o, si hace falta administrar: `node supabase/scripts/admin-delete-player-account.mjs <playerId>` | Mismo motor (`_shared/account-deletion-core.mjs`). Sale con código 0 solo si TODAS las postcondiciones se cumplen; es reintentable. |
| Cuenta problemática / abuso | 1) `auth.admin.updateUserById(authUserId, { ban_duration })` (corta nuevos tokens); 2) si corresponde, eliminación como arriba. Restricción/cierre: Términos §8, revisión por email. | No hay panel. Documentar el motivo fuera del repo (sin PII en Issues). |
| Corrección/anulación excepcional de un partido | `admin_annul_match(match_id, actor_label, reason)` (revierte Nivel si estaba validado) y `admin_force_resolve_identity_issue` vía la Edge Function `admin-resolve-identity-issue` (service role exacta) | Actor y motivo obligatorios; quedan en `match_actions.metadata`. |
| Altas abandonadas | Cron `cleanup-abandoned-signups` (horario) | Verificar con `select jobname, schedule, active from cron.job;` y que `unconfirmedSignupsOver24h` ≈ 0. |
| Limpieza de contadores de rate limit | `select public.purge_old_rate_limits();` (conserva 7 días) | `api_rate_limits` crece una fila por jugador+acción+ventana. Programarla junto al cron cuando haya volumen (hoy no urge). |

### Backup / exportación — qué se puede hoy y qué no
- **Staging:** datos de prueba. Para respaldo lógico puntual: `supabase db dump` (requiere la contraseña de la base: tarea de Central, nunca de Sebastián) o exportaciones por tabla con `service_role`.
- **Production (futuro):** la política real (frecuencia, retención, PITR, región) **depende del plan de Supabase elegido y NO está definida**: no se inventa acá. Es una entrada obligatoria del checklist B y de `Privacidad_Legal.md` §8 (`plazos_backups_logs` en las páginas legales).
- Los respaldos no se restauran sobre datos de cuentas ya eliminadas sin un procedimiento que reaplique las eliminaciones (la anonimización es la fuente de verdad).

---

## Parte B — Checklist reproducible de salida a Production (**NO EJECUTAR AHORA**)

Cada paso marcado ⛔ requiere **AUTORIZACIÓN DE SEBASTIÁN** previa y explícita. Orden exacto:

1. ⛔ Autorización escrita de Sebastián para abrir Production (alcance: solo Sebastián primero, ver `Pre_Production.md`).
2. Pre-requisitos cerrados: P0.2 (legal: comunicaciones/emails, QA browser, E2E destructivo con OTP) y datos reales de las páginas legales (`[[PENDIENTE_PRODUCCION:*]]` = 0; el build de Production lo exige).
3. ⛔ Crear el proyecto Supabase Production (región y plan decididos y registrados; completar `plazos_backups_logs`, proveedor y región en las páginas legales).
4. Replay de migraciones en orden de nombre desde `supabase/migrations/` (todas, sin editar); luego `audit-live-grants.sql` y los verifies `verify-preprod-*.sql` aplicables.
5. Sembrar `app_config` con `environment='production'` y `legal_version='legal_v1'` (+ `legal_versions.effective_at` real). La app verifica en runtime que `app_config.environment` coincida con el build (fail-closed).
6. Auth: SMTP/plantillas de Production (proyecto Comunicaciones), OTP 6 dígitos, "Secure email change", URL de sitio y redirects, rate limits de Auth.
7. Storage: buckets privados `avatars` y `group-photos` + sus políticas (vienen en migraciones); comprobar que ninguno es público.
8. Desplegar Edge Functions: `officialize-onboarding`, `create-or-attach-match`, `officialize-match`, `propose-match-correction`, `respond-match-correction`, `resolve-identity-issue`, `admin-resolve-identity-issue`, `get-match-intelligence`, `delete-my-account` (verify_jwt=true) y `cleanup-abandoned-signups` (verify_jwt=false; se autentica sola).
9. Cron: `select public.schedule_cleanup_abandoned_signups('https://<ref>.supabase.co/functions/v1/cleanup-abandoned-signups');` y confirmar en `cron.job`.
10. ⛔ Vercel Production: proyecto/ dominio, variables `BRAMU_ENV_NAME=production`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (nunca la service role), `ignoreCommand` vigente; el build rechaza credenciales cruzadas (`env-guard.mjs`) y páginas legales con pendientes (`legal-guard.mjs`).
11. Smoke (sin usuarios reales): alta con aceptación legal → OTP → perfil → Nivel; login/recuperación; carga de partido entre cuentas descartables; reaceptación; `ops_health_snapshot()`; E2E de eliminación con cuenta descartable (`e2e-delete-my-account.mjs`, ⛔ OTP humano); borrar las cuentas descartables.
12. ⛔ Abrir a Sebastián (primer usuario real). "Cuando entra el primer usuario real, BRAMU ya empezó": no se vuelve a resembrar Production.
13. AAIP/RNBDP y datos del responsable: ⛔ trámites personales de Sebastián; no bloquean los pasos técnicos pero sí la apertura a terceros (ver `Privacidad_Legal.md` §13).
