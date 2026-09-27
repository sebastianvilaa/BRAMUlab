# BRAMUlab — Resultado: hardening final de P0.3 antes de Staging real

**Rama:** `staging`
**Fecha:** 27/09/2026
**HEAD base:** `21fa4b4` (`fix(preprod): corregir P0.3 tras revision central - Auth/Storage/Ranking`)
**Origen:** handoff [`30_Handoff_Hardening_Final_P0_3_27SEP.md`](30_Handoff_Hardening_Final_P0_3_27SEP.md), quinto ajuste sobre P0.3 tras la segunda revisión central.

**No se tocó frontend, bundle `04.11-h10`, `version.json`, Service Worker ni ningún asset.** Ninguna migración de P0.3 fue aplicada a ningún entorno todavía, así que los 2 ajustes SQL se hicieron directamente sobre `20260927150000_preprod_p03_fase_a_account_deletion.sql` (handoff §5: "evitar migraciones correctivas innecesarias encima de archivos nunca aplicados") — sigue sin haber ningún deploy remoto, migración aplicada, ni ejecución contra una cuenta real.

---

## 1. Los 5 ajustes obligatorios

### A — `authUserId` no debe quedar retenido permanentemente

Nueva función SQL **`admin_finalize_player_account_deletion(p_player_id uuid)`**, agregada al final de la migración de Fase A (misma migración, no una nueva — no aplicada aún). SOLO `service_role`. Purga `pilot_events.properties.authUserId` con el operador jsonb `-` (idempotente: sobre una clave ya ausente es no-op, nunca falla). Rechaza con código de negocio explícito (`not_yet_deleted`) si el jugador todavía no pasó por `admin_delete_player_account`, y `player_not_found` si no existe. **Nunca borra la fila de auditoría** — conserva `event_name='account_deleted'` + `player_id` + timestamps (la evidencia mínima de que la eliminación ocurrió), solo purga el dato operativo que ya cumplió su propósito. No se reemplaza el identificador purgado por ningún otro dato identificatorio nuevo (email/hash/HMAC) — tal como pedía el handoff.

### B — La verificación final debe comprobar también Auth

`verifyAccountDeleted` ahora recibe `authUserId` como parámetro explícito (el mismo que `runAccountDeletion` ya maneja) y:
- confirma con `auth.admin.getUserById(authUserId)` que la cuenta Auth **ya no existe** (`authDeleted`);
- confirma que la auditoría **ya fue purgada** (`auditPurged`: la clave `authUserId` ya no está en `pilot_events.properties`).

`authUserId === null` se trata como trivialmente "gone" (cubre tanto "nunca tuvo sesión vinculada" como "ya se purgó tras una finalización exitosa" — son ambiguos por diseño, y da igual: en ambos casos no hay nada más que verificar).

El resultado (`ok`) ahora exige las **6** condiciones a la vez: `anonymized && authUnlinked && inactiveInBramu && storageClean && authDeleted && auditPurged`. Antes solo exigía las primeras 4.

### C — El CLI no debe salir con código 0 si la postcondición falla

El bootstrap ahora separa explícitamente 2 chequeos secuenciales:
1. `runAccountDeletion` debe devolver `ok:true` — si no, `exit 1` inmediatamente, reportando la fase que falló.
2. **Solo entonces**, `verifyAccountDeleted` se ejecuta con el `authUserId` real devuelto — si **cualquier** postcondición queda falsa, `exit 1` con un mensaje explícito ("la operación reportó éxito pero la POSTCONDICIÓN quedó incompleta — reintentar").

`exit 0` únicamente si ambos pasos confirman éxito completo.

### D — Dependencia sin pin/lockfile

Se verificó la versión estable vigente contra el registro npm oficial (`npm view @supabase/supabase-js dist-tags` → `latest: '2.117.2'`, distinto de los tags `rc`/`next`/`beta`/`canary` — confirmado que no es una prerelease). `package.json` pasa de `"@supabase/supabase-js": "^2"` a `"2.117.2"` (versión exacta, sin rango). Se corrió `npm install` en `supabase/scripts/` y se generó **`package-lock.json`** real (commiteado). `package.json` actualiza su descripción para indicar `npm ci` como comando de instalación reproducible.

### E — Endurecer detección de "Auth ya no existe"

`isAlreadyGoneError` ahora prioriza señales **estructuradas** del error (`error.status === 404`, `error.code` que matchea `/not[_-]?found/i`) sobre el texto del mensaje. El fallback de substring de mensaje **solo** se usa cuando el error no trae ninguna señal estructurada en absoluto — si el error SÍ trae `status`/`code` pero no matchea "ya no existe" (ej. un 429 de rate limit cuyo mensaje contenga por casualidad la palabra "not found"), se trata como error real, nunca se cuela como éxito por coincidencia de texto.

---

## 2. Bug real encontrado y corregido durante el hardening (no pedido explícitamente por el handoff, pero bloqueante)

Al hacer el smoke test del bootstrap CLI (`node admin-delete-player-account.mjs <playerId>` sin credenciales, para confirmar que fallaba con el mensaje esperado), el script **no imprimía nada y salía con `exit 0`** — el bootstrap nunca se activaba.

Causa: `if (import.meta.url === \`file://${process.argv[1]}\`)` compara un string construido a mano contra `import.meta.url`. El path real de este checkout contiene espacios ("Otros Trabajos") — `import.meta.url` los URL-encodea (`%20`), pero `process.argv[1]` es una ruta de filesystem cruda sin encodear. La comparación de strings nunca coincidía, así que el bootstrap quedaba **silenciosamente inerte** en cualquier checkout con caracteres especiales en la ruta.

Fix: `import.meta.url === pathToFileURL(process.argv[1]).href` (`node:url`), que aplica el mismo encoding que `import.meta.url` ya usa — forma estándar y robusta de detectar "este archivo es el punto de entrada" en Node. Verificado con un smoke test real: sin variables de entorno → imprime el mensaje esperado y `exit 1`; sin `playerId` → mensaje de uso y `exit 1`; ambos casos confirmados también invocando el script desde `cwd` distintos (raíz del repo y `supabase/scripts/`).

---

## 3. Tests

### JS (ejecutado en este sandbox)

`supabase/scripts/admin-delete-player-account.test.mjs` — reescrito con **19 tests** (8 nuevos sobre los 11 anteriores), cubriendo los 7 puntos JS del handoff §3:
1. Auth eliminado confirmado por Admin API (`getUserById` se llama y reconoce "gone").
2. Auth todavía existente → la operación se detiene en la Fase 4, **nunca** llega a finalizar la auditoría.
3. Cleanup final de `authUserId` corre **después** de confirmar Auth eliminado, nunca antes (test que falla explícitamente si `admin_finalize_player_account_deletion` se llamara antes de `getUserById`).
4. Reintento: Auth ya no existe pero todavía queda `authUserId` operativo (fallo parcial de una corrida anterior) → se limpia y cierra igual.
5. Fallo al finalizar la auditoría → la operación se reporta como NO cerrada (`ok:false`, `step:'sql_finalize'`), recuperable — el resto (Auth ya confirmado) no se repite innecesariamente en un reintento.
6. `isAlreadyGoneError`: señal estructurada (`status:404`) reconocida sin depender del texto; un error real con señal estructurada (`status:429`) nunca cae al fallback aunque el mensaje contenga palabras parecidas; sin ninguna señal estructurada, cae al fallback de substring (compatibilidad).
7. `verifyAccountDeleted`: postcondición completa exige las 6 condiciones a la vez — Auth todavía existente, o auditoría sin purgar, hacen fallar el resultado aunque BRAMU/Storage estén perfectos.

El punto §3.8 (permisos de la RPC de finalización) se cubre en SQL, no en JS — ver abajo.

`node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs supabase/scripts/*.test.mjs` → **289/289 PASS** (281 previas + 8 nuevas), sin regresión.

### SQL (escrito, NO ejecutado — sin Supabase CLI/credenciales en este sandbox)

Nuevo **Caso 8** en `verify-preprod-p03-fase-a-account-deletion.sql`:
- confirma que `authUserId` sigue presente ANTES de finalizar (precondición real, no un `properties` vacío desde siempre);
- `admin_finalize_player_account_deletion` purga la clave, pero la fila de auditoría (`event_name`/`player_id`) sigue existiendo;
- idempotencia: una segunda finalización sigue devolviendo `ok:true`;
- `not_yet_deleted` sobre un jugador que nunca fue eliminado (B, activo);
- `player_not_found` sobre un uuid inexistente;
- permisos: `anon`/`authenticated`/`public` sin `EXECUTE`, `service_role` únicamente.

---

## 4. Qué quedó sin ejecutar remotamente

- Ninguna de las 2 migraciones de P0.3 fue aplicada a Supabase Staging.
- El verify SQL actualizado (con el nuevo Caso 8) no fue ejecutado contra Postgres real.
- El script orquestador no fue ejecutado contra Supabase real ni contra ninguna cuenta — solo su lógica pura, con un cliente fabricado, y el smoke test del bootstrap (sin credenciales, confirmando el manejo de errores).
- No se instaló `@supabase/supabase-js` de forma persistente en el repo — `node_modules/` generado localmente por `npm install` para producir el lockfile queda fuera de git (ya cubierto por el `.gitignore` raíz del proyecto), solo se commitea `package.json`/`package-lock.json`.

---

## 5. Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Flujo de 5 fases nunca ejercitado contra Auth real | Toda la lógica de Fases 3/4/5 se probó con un cliente fabricado; el comportamiento real de `getUserById`/`updateUserById`/`deleteUser` de Supabase (estructura exacta de sus errores, timing) no se confirmó contra el servicio real | Central: primera corrida real contra una cuenta de PRUEBA en Staging, revisando el log de cada fase y el resultado de `verifyAccountDeleted` |
| `isAlreadyGoneError` depende de qué campos expone realmente el SDK instalado | Se diseñó para `status`/`code` como prioridad, pero no se confirmó contra una respuesta real de error 404 de `@supabase/supabase-js@2.117.2` — el fallback de mensaje sigue como red de seguridad si los campos estructurados no vienen como se esperaba | Si la primera corrida real muestra un formato de error distinto al asumido, ajustar la heurística antes de dar por cerrado el hardening |
| `package-lock.json` generado en este sandbox, no en el entorno de Central | El lockfile es reproducible por diseño (`npm ci` instala exactamente lo que declara), pero nunca se instaló ni se probó fuera de este sandbox | Sin acción esperada — es el comportamiento normal de un lockfile; Central corre `npm ci` antes de la primera ejecución real |

---

## 6. Decisiones abiertas

Ninguna decisión de producto nueva quedó abierta. Los 5 ajustes eran correcciones técnicas concretas de hardening (retención mínima de datos operativos, verificación de postcondición completa, exit code correcto, reproducibilidad de dependencias, detección robusta de errores) — ninguno requirió criterio legal/de producto.

---

## 7. Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `supabase/migrations/20260927150000_preprod_p03_fase_a_account_deletion.sql` | Agregada `admin_finalize_player_account_deletion` al final del archivo (no es migración nueva) |
| `supabase/scripts/admin-delete-player-account.mjs` | Fase 4 (verificación de Auth) y Fase 5 (finalización) agregadas al flujo; `checkAuthUserGone` compartida; `isAlreadyGoneError` con detección estructurada; `verifyAccountDeleted` exige 6 condiciones; bootstrap CLI con exit code correcto; fix del bug real de `pathToFileURL` |
| `supabase/scripts/admin-delete-player-account.test.mjs` | Reescrito — 19 tests (8 nuevos), mock extendido con `auth.admin.getUserById` y query builder genérico para `players`/`pilot_events` |
| `supabase/scripts/package.json` | Versión de `@supabase/supabase-js` fijada (`2.117.2`, verificada contra el dist-tag `latest` del registro npm), descripción actualizada a `npm ci` |
| `supabase/scripts/package-lock.json` | Nuevo — lockfile real generado con `npm install` |
| `supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql` | Nuevo Caso 8 (finalización + permisos) |
| `docs/BRAMUlab/Implementacion/Pre_Production/31_Resultado_Hardening_Final_P0_3_27SEP.md` | Este documento |

Sin cambios en `bramulab/` (frontend), `bramulab/version.json`, service worker, ni ningún archivo de `main`/Production/BRAMUlive.

---

## 8. Qué debe hacer Central

1. Revisar los 5 ajustes + el bug de `pathToFileURL` encontrado durante el hardening.
2. Aplicar `20260927150000_preprod_p03_fase_a_account_deletion.sql` (con `admin_finalize_player_account_deletion` ya incluida) y `20260927160000_preprod_p03_ranking_anonymous_presentation.sql` contra Staging, y correr el verify actualizado (con el Caso 8).
3. `npm ci` dentro de `supabase/scripts/` (nunca `npm install`, para instalación reproducible) y correr `admin-delete-player-account.mjs` contra una cuenta de PRUEBA real en Staging — confirmar las 5 fases y que `verifyAccountDeleted` reporta `ok:true` con las 6 condiciones satisfechas.
4. Si la respuesta real de la Auth Admin API trae un formato de error distinto al asumido por `isAlreadyGoneError`, ajustar la heurística antes de dar el hardening por cerrado.
5. Solo entonces evaluar el cierre de P0.3 — este documento, igual que los anteriores, **no marca P0.3 como cerrado**.
