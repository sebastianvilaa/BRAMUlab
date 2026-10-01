# 86 — Handoff Bloque 9B: rehearsal operativo no destructivo

**Fecha:** 01/10/2026  
**Entorno:** repo/local/efímero; Staging solo lectura cuando alcance.  
**NO tocar:** main, Production, BRAMUlive, Comunicaciones/email/Auth ni OTP destructivo.

## Entrada
V04.20 / `04.20-h3`; Issue #17 PASS; Issue #19/9A PASS Central; replay limpio y ACL final cerrados. Production no está autorizada. P0.2 sigue esperando Comunicaciones + QA browser + E2E OTP.

## Objetivo
Cerrar lo máximo posible de **backups/exportación/procedimientos operativos** de P0.5 sin abrir Production ni repetir 9A.

Leer: README → Metodo_Trabajo → Pre_Production P0.5 → Backend_Infraestructura Bloque 9 → Runbook → `85_Gate_Central_Bloque_9A_01OCT.md` → este handoff.

## A — Exportación/acceso a datos
Auditar y probar con fixtures/entorno descartable `admin_export_player_data` + `admin-export-player-data.mjs`: redacción de terceros, ausencia de secretos, permisos del archivo, errores/reintentos y ausencia de outputs parciales engañosos. Reutilizar lo existente.

## B — Operación/recuperación
Convertir el Runbook en procedimiento verificable para cuenta problemática, corrección/anulación admin, eliminación, cleanup y rate limits. Definir claramente forward-fix vs rollback de migraciones y evidencia previa. No diseñar DR enterprise.

## C — Backup
Separar lo demostrable hoy de lo que depende del plan/región de Supabase Production. Probar el mecanismo lógico más fuerte disponible con fixtures/replay; **no afirmar que se probó un backup gestionado de Supabase si no fue así**. No elegir plan ni retención.

## D — Preflight
**FUSIONAR** con tooling 9A, no crear otro sistema. La salida debe separar PASS automático de: gate Comunicaciones/Auth, gate browser/OTP, autorización Production y decisión dependiente del plan de backups. Conservar regresión PG17 `MAINTAIN` y Edge service-to-service.

## Límites
Sin secretos reales; sin eliminación destructiva en cuentas reales; sin SMTP/templates/Secure Email Change; sin UX/reglas deportivas; sin optimizar warnings sin riesgo; sin Production.

## Salida
Guardar `docs/BRAMUlab/Implementacion/Pre_Production/87_Resultado_Bloque_9B_Rehearsal_Operativo_01OCT.md` con PASS/FAIL A–D, defectos/correcciones, pruebas, límites, gates externos y DECISIONES ABIERTAS reales.

## Git
Solo `staging`. Una ronda/commit/push. Revisar diff completo. Sin microcommits. Si una decisión humana no bloquea, marcarla y continuar. Central hará un gate único.
