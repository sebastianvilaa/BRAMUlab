# 88 — Gate Central Bloque 9B (Issue #20)

**Fecha:** 01/10/2026  
**Resultado final:** **PASS CENTRAL EN STAGING**.  
**No se tocó:** main, Production, BRAMUlive, emails/Auth ni OTP destructivo.

## Entrada revisada
- baseline Central 9A: `a6e13203a8d797c10d59b50e67f7d9bc4ba7e5f1`;
- entrega Claude 9B: `1102cc1b7bf8c8354322e1409f5024da65ed6dbc`;
- resultado: `87_Resultado_Bloque_9B_Rehearsal_Operativo_01OCT.md`.

## Hallazgo 1 — confirmado en Staging
Antes de aplicar la corrección de Claude, Staging tenía **106** notificaciones cuyo `payload.actorPlayerId` referenciaba a otro jugador. La fuga del export era real.

Central aplicó `20261001080000_bloque9b_export_third_party_redaction.sql`.

## Hallazgo 2 — el primer fix era insuficiente
Retest sobre un caso real:
- el raw contenía el ID ajeno;
- el wrapper eliminó la clave directa `actorPlayerId`;
- **pero el mismo player_id seguía apareciendo dentro de strings `Intelligence.output.*.semanticKey`**.

Los fixtures de Claude usaban un output Intelligence demasiado simple y no reproducían esa forma real.

## Corrección Central
**AGREGAR / forward-fix:** `20261001090000_bloque9b_export_redaction_hardening.sql`.

Sin editar la migración 080000 ya aplicada:
- `semanticKey` se elimina del informe por ser metadata interna;
- UUIDs embebidos en strings se redaccionan solo si corresponden a `players.player_id` o `players.auth_user_id` ajenos; match IDs y otros UUIDs técnicos se conservan;
- `_admin_export_player_data_raw` y `_export_redact_third_parties` dejan de tener EXECUTE directo para `service_role`;
- el único camino operativo concedido queda `admin_export_player_data(uuid)`;
- la validación cliente rechaza `semanticKey` si el backend alguna vez regresiona;
- fixtures/tests reproducen el caso real.

## Retest final de Central

Aplicadas en Staging:
- `bloque9b_export_third_party_redaction`;
- `bloque9b_export_redaction_hardening`.

Caso real que antes filtraba:
- raw contiene el identificador ajeno: **sí** (confirma que el caso ejercitado es real);
- export seguro conserva ese identificador: **no**;
- `semanticKey`: **ausente**;
- tokens UUID que corresponden a `player_id/auth_user_id` ajenos dentro de todo el JSON seguro: **0**;
- `account.playerId` propio: preservado;
- `matchId` legítimos: preservados.

Permisos:
- anon → export: **no**;
- authenticated → export: **no**;
- service_role → wrapper seguro: **sí**;
- service_role → raw/helper: **no**.

Regresión:
- `PREBLOQUE9_VERIFY_OK`;
- migraciones 08:00 y 09:00 registradas en Supabase Staging;
- advisors sin hallazgo nuevo bloqueante;
- commit funcional Central `76473a42ac35aecdec3a9f132a4fabef31f888a5`: Vercel SUCCESS.

## Cierre

**Bloque 9B / Issue #20: CERRADO con PASS Central.**

Queda demostrado en esta etapa:
- exportación segura y operable;
- procedimientos de administración/recuperación ensayados;
- backup lógico de `public` ensayado, incluida la protección contra “resucitar” cuentas eliminadas;
- preflight automático reproducible.

Siguen abiertos únicamente los gates externos definidos por el propio preflight:
- **G1:** Comunicaciones/Auth-email;
- **G2:** QA browser Legal/Acceso + E2E destructivo con OTP;
- **G3:** autorización explícita y configuración de Production;
- **G4:** plan/región/retención y restauración gestionada real de backups.

No queda otra ronda técnica independiente útil que justifique seguir agregando trabajo antes de resolver G1/G2 o tomar las decisiones de G3/G4.
