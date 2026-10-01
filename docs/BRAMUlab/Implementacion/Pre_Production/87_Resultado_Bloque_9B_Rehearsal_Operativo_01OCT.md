# 87 — Resultado Bloque 9B: rehearsal operativo no destructivo (Issue #20)

**Fecha:** 01/10/2026 · **Entorno:** solo local/efímero (cero contacto con Staging, Production, BRAMUlive, emails/Auth ni OTP) · **Bundle:** sin cambios (`04.20-h3`; no se tocó código de cliente).
Mecanismo: el de 9A (PGlite + shim de plataforma) **fusionado**, no duplicado: `release-check.mjs` ahora incluye el ensayo operativo y el preflight.

## Veredicto
| Parte | Resultado |
|---|---|
| **A** Exportación / acceso a datos | **PASS** (19 comprobaciones; 1 defecto real corregido) |
| **B** Operación / recuperación | **PASS** (30 comprobaciones) |
| **C** Backup | **PASS** del mecanismo **lógico** (9); backup **gestionado** de Supabase: **NO probado** (gate G4) |
| **D** Preflight | **PASS** automático + 4 gates externos listados como **PENDIENTE EXTERNO** |

Comando único: `node supabase/scripts/release-check.mjs [--manifest m.json] [--preflight-md p.md]` (exit 0 = todo lo automático pasa). Solo el ensayo: `npm run ops-rehearsal` en `supabase/scripts`.

## Defectos reales y correcciones
1. **Fuga de PII de terceros en el informe de acceso (A).** `admin_export_player_data` incluía `notifications[].payload` crudo, con `actorPlayerId` = `player_id` de **otra persona**. Hallado ensayando con 3 terceros con PII propia. **Corrección:** migración `20261001080000_bloque9b_export_third_party_redaction.sql` (**sin aplicar**): la función existente pasa a generador interno `_admin_export_player_data_raw` (solo `service_role`) y `admin_export_player_data` es un envoltorio que elimina recursivamente toda clave `…playerId(s)/…userId/…authUserId` que no sea el titular. Idempotente; un test demuestra que el generador crudo filtraba y el envoltorio no.
2. **Script de exportación (A):** `writeFileSync(..., {mode:0o600})` **no cambia permisos de un archivo preexistente** (podía quedar 0644) y podía dejar salidas parciales/pisar informes. **Corrección:** escritura atómica (temporal exclusivo 0600 + rename), no pisa sin `--force`, `--force` deja 0600, destino inválido falla limpio sin temporales; **validación del informe antes de escribir** (secciones completas, titular correcto, sin claves de secretos ni referencias a otras personas ⇒ `report_invalid`, exit 1, nada escrito); reintentos solo para errores transitorios de transporte (3), códigos de negocio definitivos.
3. **Preflight (D):** el escáner de hardcodes marcaba como violación el código de ensayo (`INSERT app_config` en scripts efímeros) y su propio test; ahora la regla de seed aplica solo a `migrations/` y `functions/`, y los archivos que siembran violaciones a propósito están exentos de su propio escaneo.

## A — Exportación (ensayada con fixtures)
Titular A + terceros B/C/D con email, teléfono, nacimiento y username propios, partido compartido de 4, notificación con id de tercero, grupos, avatar, Intelligence (con memoria/auditoría internas), hash de contraseña en Auth. Verificado: ningún dato ni id de B/C/D (solo el **nombre mostrado** en el partido), sin hash/memoria/auditoría/rate limits, y datos propios completos (email, teléfono, nacimiento, nota privada, aceptación legal, sets, grupos, notificaciones, Intelligence); `validateReport` rechaza un informe manipulado; reintentos y errores definitivos; referencia inválida / inexistente / provisional; archivo 0600/atómico; permisos SQL solo `service_role`.

## B — Operación / recuperación (procedimientos en el Runbook, ya verificables)
- **Eliminación** con el motor P0.3 **real** y fallos inyectados: Auth falla ⇒ se detiene en `auth_delete` sin declarar éxito, el acceso BRAMU ya está cortado, el retry se resuelve por la auditoría y completa; Storage falla ⇒ `storage_remove` y retry completa; re-ejecutar es idempotente; las 7 postcondiciones P0.3 verdaderas; partido compartido preservado ("Jugador eliminado", `player_id` estructural, 3 terceros intactos); perfil anonimizado; notificaciones/notas/Intelligence/listas eliminadas; grupo solo-de-A borrado lógicamente y compartido coherente con B; Storage limpio; evidencia legal conservada; perfil público y WhatsApp de A inexistentes para otros; cuenta de B intacta.
- **Cuenta problemática:** baneo ~100 años sin tocar datos.
- **Anulación excepcional:** exige actor+motivo; deja estado, actor/motivo y aviso a participantes; idempotente; `match_not_found`; también sobre partido validado.
- **Altas abandonadas:** fallo inyectado contado como error sin afectar a nadie más, retry borra solo la ≥24 h, quedan jóvenes y confirmadas, tercera pasada no-op; secreto de cron en Vault sin exponerse.
- **Rate limits:** bloqueo en la 4.ª llamada de ventana 3; purga conserva lo reciente; `ops_health_snapshot` coherente y sin PII.
- **Forward-fix vs rollback** definido en el Runbook: migraciones append-only con corrección hacia adelante; evidencia previa obligatoria (`release-check`, manifest, `audit-live-grants.sql`); rollback solo de **datos**, a un proyecto nuevo y con re-aplicación del libro de eliminaciones; Edge Functions por redeploy del bundle anterior (hash en el manifest). Sin DR enterprise.

## C — Backup: demostrado vs no demostrado
**Demostrado (lógico, `public`):** dump con checksum por tabla (33 tablas) → restauración sobre un esquema replayado limpio con checksums idénticos y sistema funcional (triggers sin re-disparo) → un dump alterado se **detecta**. **Riesgo demostrado:** restaurar un backup *anterior* a una eliminación **resucita** los datos personales de la cuenta; **procedimiento verificado:** guardar el **libro de eliminaciones** (solo ids técnicos) fuera del backup y re-aplicar `admin_delete_player_account` por id tras restaurar; un backup posterior conserva la anonimización.
**NO probado / no afirmado:** ningún backup gestionado de Supabase; `auth.*`, `storage.*` y Vault fuera del dump; frecuencia, retención, PITR, región, tiempos de restauración. No se eligió plan ni retención.

## D — Preflight fusionado
Se agregaron a `release-check.mjs`: el ensayo operativo A/B/C, la regresión **Edge service-to-service** (`admin-resolve-identity-issue` y `cleanup-abandoned-signups` con `verify_jwt=false` y auth interna; las 8 funciones de usuario con `verify_jwt=true` y `getUser`) y se **conserva** la regresión **PG17 `MAINTAIN`** del replay limpio. La salida termina con **PREFLIGHT**: veredicto automático + 4 gates externos con responsable, pendiente, evidencia automática disponible y cómo se cierran: **G1** Comunicaciones/Auth-email · **G2** browser/OTP humano · **G3** autorización de Production · **G4** plan real de backups. Un gate externo nunca se marca cerrado.

## Pruebas ejecutadas
`release-check.mjs` completo: PASS (migraciones, hardcodes, 10 Edge Functions, cliente, builds, Edge service-to-service, replay ×3 ACL, ensayo A/B/C). `bramulab/bloque9b-ops.test.mjs` (7) + regresión: Node 683 tests, 680 OK (las 3 fallas `h19-B`, `h21-9`, `h23` son preexistentes). `tests.html` no se re-ejecutó: no hay cambios de cliente. Test existente actualizado: un informe incompleto ahora es fallo.

## Límites (no probado)
GoTrue/Auth real, Storage API real, Edge runtime/deploy, pg_cron/pg_net/Vault reales (shim), Vercel real, Advisors, estado vivo de Staging, envío real de emails, backups gestionados. El ensayo usa un **cliente falso respaldado por la base efímera** (misma forma que `supabase-js`): valida la lógica operativa y el SQL reales, no la red ni la plataforma.

## Qué hace falta de Central
Aplicar `20261001080000` en Staging y correr: `select public.admin_export_player_data(<player de prueba>)` verificando que ningún `notifications[].payload` contenga ids ajenos; contrastar `87_release_manifest.json` (hashes) con lo aplicado/desplegado. No hay Edge Functions nuevas ni modificadas.

## Pendiente por gates externos
G1 Comunicaciones/Auth-email · G2 QA browser Legal/Acceso + E2E destructivo con OTP · G3 autorización de Production (+ datos legales reales, AAIP/RNBDP) · G4 elección de plan/región/retención de backups y prueba de restauración gestionada.

## DECISIONES ABIERTAS
Ninguna que bloquee. (Dependiente de Sebastián, ya contemplada como G4: elegir plan/región/retención de backups de Production.)
