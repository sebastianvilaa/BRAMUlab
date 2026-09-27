# BRAMUlab — Resultado Central: aplicación real de P0.3 en Supabase Staging

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Frontend funcional:** `04.11-h10` — sin cambios desde `7be715c3a8cd696143f6b5ca46b1e435d74513aa`  
**HEAD técnico revisado antes de aplicar:** `fc40b4bf5419e2a16116f095235797665c1be20c`

## 1. Aplicación remota

Central aplicó correctamente en **Supabase Staging**:

1. `preprod_p03_fase_a_account_deletion`
2. `preprod_p03_ranking_anonymous_presentation`

Versiones remotas registradas:

- `20260927043038` — `preprod_p03_fase_a_account_deletion`
- `20260927043042` — `preprod_p03_ranking_anonymous_presentation`

No se tocó Production ni BRAMUlive.

## 2. Verificación no destructiva en Staging real

Confirmado directamente contra la base:

- `admin_delete_player_account(uuid)` existe;
- `admin_finalize_player_account_deletion(uuid)` existe;
- ambas RPCs: `service_role = EXECUTE true`;
- ambas RPCs: `anon = false`;
- ambas RPCs: `authenticated = false`;
- `players.deleted_at` existe;
- `get_ranking_classification` contiene la presentación `Jugador eliminado` y resuelve estado contra `players`;
- `get_my_ranking_position` contiene la presentación anónima;
- `get_ranking_network` contiene la presentación anónima;
- smoke no destructivo sobre UUID inexistente devuelve `player_not_found` tanto para eliminación como para finalización.

## 3. Advisors

Se corrió Security Advisor antes y después de aplicar.

No aparecieron hallazgos nuevos atribuibles a P0.3.

Siguen existiendo findings previos del proyecto, entre ellos:

- varias tablas server-only con RLS enabled/no policy (patrón deliberado actual);
- warnings de SECURITY DEFINER para RPCs que sí son APIs autenticadas intencionales;
- dos findings previos a revisar dentro de hardening general: `_bloque6_enrich_notification_actor()` ejecutable por anon y `is_username_available` ejecutable por anon;
- leaked password protection desactivado.

Estos findings pertenecen al futuro Bloque 9 / hardening general y **no se mezclan con P0.3 en esta ronda**.

## 4. Verify SQL

Se intentó ejecutar:

`supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql`

La conexión de Central fue bloqueada por los controles de seguridad de la herramienta por tratarse de un script con operaciones destructivas, aunque el archivo esté encapsulado en `BEGIN/ROLLBACK`.

No se forzó el bypass ni se reescribió el test para engañar ese control.

Por lo tanto:

- el verify SQL sigue escrito y cubierto por revisión;
- no existe evidencia de fallo de BRAMU;
- tampoco debe declararse como ejecutado/pass en Staging.

## 5. Frontend / Laboratorio

Comparación desde el commit funcional h10:

`7be715c3a8cd696143f6b5ca46b1e435d74513aa..staging`

Resultado: **0 archivos bajo `bramulab/` modificados**.

El QA físico pendiente puede seguir tomando como referencia funcional `04.11-h10`.

## 6. Estado de P0.3

P0.3 queda en estado:

**IMPLEMENTADO + APLICADO EN STAGING + PREFLIGHT REAL PASS / E2E DESTRUCTIVO PENDIENTE**

Todavía falta una corrida controlada contra una cuenta descartable real de Staging para validar punta a punta:

1. corte de acceso BRAMU;
2. anonimización SQL;
3. limpieza de avatar Storage;
4. ban/delete Auth Admin API;
5. confirmación real de inexistencia Auth;
6. purga final de `authUserId`;
7. postcondición completa;
8. reintento/idempotencia real.

No usar una cuenta real de QA con historial que deba conservarse.

## 7. Decisiones abiertas

Ninguna decisión de producto nueva.

El pendiente es exclusivamente de validación operativa/destructiva en entorno de prueba.

## 8. Próximo paso

No seguir agregando lógica a P0.3.

Cuando exista una cuenta descartable adecuada y un vehículo autorizado con Auth Admin API/Storage API, ejecutar el orquestador real y documentar el resultado. Recién entonces Central decide el cierre definitivo de P0.3.
