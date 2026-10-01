# 88 — Gate Central Bloque 9B (Issue #20)

**Fecha:** 01/10/2026  
**Estado durante este commit:** corrección Central preparada; falta aplicar/retest final en Staging.  
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

## Criterio de cierre
Después de aplicar 090000 en Staging, Central debe comprobar:
1. un caso real que antes filtraba: raw sí contiene el tercero, export seguro no;
2. `semanticKey` ausente;
3. ningún player/auth UUID ajeno embebido en strings;
4. playerId del titular y matchIds legítimos preservados;
5. wrapper solo service_role; raw/helper sin EXECUTE de service_role/anon/authenticated;
6. migraciones registradas y Vercel del commit Central en SUCCESS;
7. advisors sin hallazgo nuevo bloqueante.

Si todo pasa: **Issue #20 = PASS Central**. No queda otra ronda técnica independiente útil antes de G1–G4.
