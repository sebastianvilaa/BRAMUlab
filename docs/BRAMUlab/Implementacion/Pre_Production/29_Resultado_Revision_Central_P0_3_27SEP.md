# BRAMUlab — Resultado: revisión central P0.3 — cierre técnico antes de aplicar

**Rama:** `staging`
**Fecha:** 27/09/2026
**HEAD base:** `8652e4d` (`feat(preprod): implementar P0.3 Fase A - eliminacion/anonimizacion de cuenta`)
**Origen:** handoff [`28_Handoff_Revision_Central_P0_3_27SEP.md`](28_Handoff_Revision_Central_P0_3_27SEP.md), corrección de 3 huecos concretos encontrados por Central en `27_Resultado_P0_3_Fase_A_Eliminacion_Cuenta.md`.

**No se tocó frontend, bundle `04.11-h10`, `version.json`, Service Worker ni ningún asset.** Como ninguna de las 2 migraciones de P0.3 (la de Fase A ni esta) fue aplicada a ningún entorno todavía, la corrección se hizo directamente sobre el archivo de la Fase A en vez de crear una migración correctiva encima (handoff 28 §6). Sigue sin haber ningún deploy remoto ni migración aplicada.

---

## 1. Problema A (Auth) — encontrado y corregido

**Lo que Central encontró:** el documento de resultado anterior afirmaba que el Auth Admin API (`deleteUser`) era "el único mecanismo que invalida realmente una sesión JWT ya emitida". Es falso: la documentación vigente de Supabase confirma que borrar/banear un usuario de `auth.users` **no** invalida un access token JWT ya emitido — ese JWT sigue siendo criptográficamente válido hasta su expiración natural (~1 hora), incluso si la cuenta ya no existe.

**Auditoría hecha:** se confirmó que prácticamente **todas** las RPCs sensibles de BRAMU (23 archivos de migración usan el patrón) resuelven identidad exclusivamente vía `select player_id from players where auth_user_id = auth.uid()`, cortando con `raise exception 'no_player_for_session'` si no encuentran fila — no existe ninguna otra vía de resolución de identidad de usuario en todo el esquema.

**Corrección aplicada:** `admin_delete_player_account` ahora también pone `players.auth_user_id = null` **en la misma transacción atómica** que anonimiza el resto (opción #1 del handoff, "evaluar como primera opción"). Esto corta el acceso BRAMU de forma inmediata y síncrona — un JWT viejo criptográficamente válido deja de mapear a cualquier jugador de BRAMU apenas la función SQL confirma, sin depender de que el paso de Auth (fuera de SQL) llegue a correr ni de que tenga éxito.

**Las 3 fases quedan explícitamente distinguidas:**

| Fase | Dónde | Qué hace | Garantía |
|---|---|---|---|
| 1 — Desautorización BRAMU | SQL (`admin_delete_player_account`) | `players.auth_user_id = null` + anonimización completa, atómico | Inmediata y suficiente por sí sola — BRAMU nunca vuelve a reconocer a la persona aunque las Fases 2/3 no corran nunca |
| 2 — Baneo | Auth Admin API (`updateUserById`, `ban_duration≈876000h`) | Defensa adicional mientras se completa el resto | Best-effort, no bloqueante |
| 3 — Eliminación final | Auth Admin API (`deleteUser`) | Borra la cuenta; purga sesiones/refresh tokens asociados server-side | El `on delete set null` de la FK no tiene nada que hacer (ya es null desde la Fase 1) |

No se toca `auth.users`/`auth.sessions`/`auth.refresh_tokens` por SQL directo en ningún punto.

---

## 2. Problema B (Storage) — encontrado y corregido

**Lo que Central encontró:** la Fase A anterior ponía `profiles.avatar_url = null` pero dejaba el archivo físico en Storage "para limpieza posterior" — un objeto huérfano, y potencialmente un bloqueo para poder eliminar la cuenta de Auth (Supabase puede impedir borrar un usuario que sigue siendo propietario de objetos en Storage).

**Trazado el contrato vigente:** `bramulab/auth.js#removeAvatarFiles` ya resuelve exactamente este patrón para el propio usuario (RLS-scoped a su carpeta): bucket privado `avatars`, ruta `{playerId}/{timestamp}.jpg`, `storage.from('avatars').list(playerId)` + `.remove(paths)`.

**Corrección aplicada:** nuevo script orquestador [`supabase/scripts/admin-delete-player-account.mjs`](../../../../supabase/scripts/admin-delete-player-account.mjs) — reutiliza el **mismo** patrón `list()`+`remove()`, con el cliente `service_role` (sin sesión de usuario, así que no puede depender de RLS), ejecutado **entre** la Fase 1 (SQL) y la Fase 3 (eliminar Auth) — nunca `DELETE` directo sobre `storage.objects`.

**Orden diseñado para que un fallo parcial sea recuperable:**
1. RPC SQL (`admin_delete_player_account`) — anonimiza y captura `authUserId` **antes** de perderlo (`players.auth_user_id` queda `null` después de este paso).
2. Storage — `list(playerId)` + `remove(paths)`. Reintentable: un bucket ya vacío devuelve `[]`, `remove` nunca se invoca.
3. Auth (Fases 2/3) — banear + eliminar, usando el `authUserId` que el paso 1 devolvió (o que se recupera de la auditoría en un reintento, ver §4).
4. Verificación de post-condición (`verifyAccountDeleted`): confirma `deleted_at`/`auth_user_id=null`/`is_active=false`/Storage vacío.

**Cobertura de test del orquestador** (`supabase/scripts/admin-delete-player-account.test.mjs`, 11 tests, corridos en este sandbox — la lógica es pura, recibe un cliente Supabase ya armado, nunca importa `@supabase/supabase-js` ni lee variables de entorno salvo en el bootstrap CLI):
- cuenta **con** avatar — se listan y borran los objetos reales;
- cuenta **sin** avatar — `remove()` nunca se llama;
- Storage **ya vacío** (reintento) — no-op seguro, nunca falla;
- **reintento tras fallo parcial** — SQL ya ejecutado, `authUserId` se recupera del resultado idempotente y las Fases 2/3 igual se completan;
- Auth **ya eliminado** en un intento anterior — banear/borrar de nuevo se trata como éxito (`"User not found"` reconocido explícitamente), nunca como fallo;
- un error **real** (no "already gone") de la Auth Admin API sí hace fallar el paso, nunca se traga en silencio;
- sin `authUserId` (cuenta que nunca tuvo sesión vinculada) — Fase 3 se omite explícitamente, nunca rompe el proceso;
- la RPC devuelve un código de negocio — se propaga sin intentar Storage/Auth;
- `playerId` ausente/inválido nunca llega a llamar a la RPC;
- verificación de post-condición completa, y detección de Storage sucio como hallazgo real.

---

## 3. Problema C (Ranking) — encontrado y corregido

**Lo que Central encontró:** `get_ranking_classification` toma las posiciones de `ranking_rows` (correcto, snapshot inmutable) pero hace `JOIN profiles` para el nombre **sin pasar nunca por `players`** — nunca filtra `is_active`. Tras anonimizar, una fila ya publicada con la posición de un jugador eliminado aparece con `displayName`/`username`/`avatarUrl` en `NULL` en vez de una presentación anónima honesta.

**Auditoría exhaustiva** (agente de exploración dedicado, sobre TODAS las funciones que hacen `JOIN ranking_rows`↔`profiles` en el esquema, quedándose con la definición vigente más reciente de cada una): 3 funciones tienen el mismo hueco —

| Función | Dónde falla | Corregida |
|---|---|---|
| `get_ranking_classification` | filas finales del listado | ✅ |
| `get_my_ranking_position` | `contextWindow` (vecinos ±2 posiciones) | ✅ |
| `get_home_ranking_insight` | passthrough literal de la anterior | se corrige sola |
| `get_ranking_network` | `base_network`/`hidden_network` ("Mi red") | ✅ |

Todas las demás RPCs auditadas (`get_public_profile`, `search_players`, `get_players_compact`, `list_saved_players`, `get_profile_ranking_summary`, `get_match_detail`, `get_notifications`) **ya filtraban correctamente** o usan un mecanismo de snapshot inmune al problema (`match_participants.display_name_snapshot`, ya anonimizado por la Fase A) — no requirieron cambios.

**Corrección aplicada:** nueva migración [`20260927160000_preprod_p03_ranking_anonymous_presentation.sql`](../../../../supabase/migrations/20260927160000_preprod_p03_ranking_anonymous_presentation.sql) — `CREATE OR REPLACE` de las 3 funciones sobre **exactamente la misma firma vigente** (sin `DROP FUNCTION`), preservando el 100% del cuerpo original carácter por carácter salvo la expresión de 3 campos de presentación por fila:

```sql
'displayName', case when pl.is_active then pr.display_name else 'Jugador eliminado' end,
'username',    case when pl.is_active then pr.username    else null              end,
'avatarUrl',   case when pl.is_active then pr.avatar_url  else null              end,
```

**Regla respetada explícitamente: `ranking_rows` NUNCA se toca.** `position`/`level_public`/`level_band`/`is_eligible`/`density_status` de una edición ya publicada siguen siendo el snapshot inmutable original — el fix es 100% de presentación en tiempo de lectura. Las ediciones **futuras** ya excluyen naturalmente a un jugador eliminado por el mecanismo de elegibilidad existente (`compute_ranking_edition` ya excluye `is_active=false`, sin cambios en esta ronda).

---

## 4. Auditoría transversal de PII/nombres (handoff §4)

Revisadas nuevamente las superficies persistentes/de lectura señaladas: `match_participants.display_name_snapshot` (ya cubierto por la Fase A), `intelligence_match_outputs.output/audit` (ya cubierto — se invalida, no se reescribe), notificaciones y su contexto histórico/actor (`_bloque6_notification_match_context` usa `display_name_snapshot`, ya anonimizado — sin riesgo), `match_actions.metadata` (auditado: en la práctica actual siempre `{}` o `{matchId}`, sin nombres embebidos), `pilot_events.properties` (ahora solo `{authUserId}`, ver §5), claims/invitaciones (`provisional_claims` no contiene ningún campo de nombre, solo ids/hash de token). No se encontró ningún hueco adicional más allá de los 3 ya corregidos.

---

## 5. Auditoría administrativa — nota corregida (handoff §4)

Se **elimina por completo** el parámetro `p_admin_note text` (antes libre, con la regla "no poner PII" que Central señaló como no técnicamente exigible). Sin una necesidad real de producto/operación que lo justifique, no vale la pena el riesgo de texto libre en una operación de privacidad — no se inventó ningún catálogo de motivos alternativo.

La auditoría queda mínima y estructurada: `pilot_events(event_name='account_deleted', player_id, properties={authUserId})`. El único campo persistido es el `authUserId` capturado — un UUID técnico interno, no una nota identificatoria — necesario específicamente para que el orquestador pueda recuperar las Fases 2/3 ante un fallo parcial (ver §2). La firma de `admin_delete_player_account` pasa de `(uuid, text)` a `(uuid)`.

---

## 6. Vehículo administrativo elegido (handoff §5)

Central prefirió explícitamente **un script server-side/repo-local** sobre una Edge Function nueva. Se implementó así: `supabase/scripts/admin-delete-player-account.mjs`, invocado manualmente con `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` como variables de entorno (nunca hardcodeadas, nunca committeadas), requiere `npm install` en ese directorio (`package.json` nuevo, dependencia única `@supabase/supabase-js`). Nunca se expone `service_role` al navegador — el script corre exclusivamente del lado del operador administrativo, fuera de la app.

---

## 7. Tests

### SQL (escrito, NO ejecutado — sin Supabase CLI/credenciales en este sandbox)

`supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql` actualizado:
- firma corregida en las 4 llamadas existentes (`admin_delete_player_account(uuid)`, sin segundo parámetro);
- nueva aserción: `players.auth_user_id is null` tras la eliminación (Caso 3);
- nueva aserción: la auditoría en `pilot_events.properties` trae la clave estructurada `authUserId` (Casos 3 y 5, incluyendo que sigue presente en el resultado de un reintento);
- **nuevo Caso 7**: `get_ranking_classification`/`get_my_ranking_position` **reales** (no una réplica del JOIN), con una edición y filas de `ranking_rows` fabricadas (fechas de test en el siglo XXII para no colisionar con el `unique(period_start_at)` de una edición real), confirmando que el jugador eliminado presenta `displayName='Jugador eliminado'`/`username=null`/`avatarUrl=null` mientras su `position`/`levelPublic` permanecen exactamente los del snapshot original, y que `ranking_rows` no fue tocado.

### JS (ejecutado en este sandbox)

- `node --test supabase/scripts/admin-delete-player-account.test.mjs` → **11/11 PASS** (ver §2).
- `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs supabase/scripts/*.test.mjs` → **281/281 PASS** (270 previas + 11 nuevas), sin regresión — esta ronda no tocó ningún archivo de frontend.

---

## 8. Qué quedó sin ejecutar remotamente

- Ninguna de las 2 migraciones de P0.3 (Fase A corregida + presentación anónima de Ranking) fue aplicada a Supabase Staging.
- El verify SQL actualizado no fue ejecutado contra Postgres real.
- El script orquestador no fue ejecutado contra Supabase real (sin credenciales en este sandbox) — solo su lógica pura, con un cliente fabricado.
- No se desplegó ninguna Edge Function ni se hizo ningún deploy de frontend.

---

## 9. Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| `get_ranking_network` sin ejercitar end-to-end | Se corrigió con el mismo patrón exacto que las otras 2 funciones, pero el verify no la ejercita como RPC real — requiere fixture adicional de `match_level_result_players`/`matches` dentro de la ventana de 180 días respecto al cutoff de la edición, no armado en esta ronda por complejidad/tiempo | Central: correr manualmente contra Staging tras aplicar, con una cuenta de prueba real en "Mi red" de un jugador ya eliminado |
| Fases 2/3 (Auth) sin ejecución real | El script se probó con lógica pura/mocks, nunca contra el Auth Admin API real | Central: primera corrida real contra una cuenta de prueba en Staging, revisando el log de cada fase |
| `ban_duration` de ~100 años es una elección técnica, no una constante documentada en ningún lado | Se eligió como "permanente en la práctica" sin necesitar una duración exacta menor que pudiera vencer antes del borrado final | Sin impacto de producto — es un paso puramente defensivo intermedio, la Fase 3 (borrado) es la que realmente cierra la cuenta |
| Verify SQL de Ranking depende de que ninguna edición real tenga `period_start_at` en el siglo XXII | Prácticamente imposible en datos reales de Staging (2026) | Sin acción — riesgo teórico despreciable |

---

## 10. Decisiones abiertas

Ninguna decisión de producto nueva quedó abierta en esta ronda. Los 3 problemas señalados por Central eran correcciones técnicas concretas con una respuesta clara desde la documentación vigente (Supabase) y el propio código del repo — ninguno requirió criterio legal/de producto no cerrado.

---

## 11. Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `supabase/migrations/20260927150000_preprod_p03_fase_a_account_deletion.sql` | Corregida (no es archivo nuevo): `auth_user_id=null` agregado al UPDATE de `players`; `p_admin_note` eliminado de la firma; auditoría estructurada (`authUserId` en vez de nota libre); recuperación de `authUserId` en el camino de idempotencia; comentarios de cabecera corregidos (afirmación falsa sobre JWT retirada) |
| `supabase/migrations/20260927160000_preprod_p03_ranking_anonymous_presentation.sql` | Nueva — `CREATE OR REPLACE` de `get_ranking_classification`/`get_my_ranking_position`/`get_ranking_network` con presentación anónima, sin tocar `ranking_rows` |
| `supabase/scripts/admin-delete-player-account.mjs` | Nuevo — orquestador de las 3 fases (SQL/Storage/Auth), vehículo administrativo elegido por Central |
| `supabase/scripts/admin-delete-player-account.test.mjs` | Nuevo — 11 tests dirigidos del orquestador, con cliente Supabase fabricado |
| `supabase/scripts/package.json` | Nuevo — dependencia mínima `@supabase/supabase-js` para el script |
| `supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql` | Actualizado — firma corregida, nuevas aserciones de Auth/auditoría, nuevo Caso 7 (Ranking) |
| `docs/BRAMUlab/Implementacion/Pre_Production/29_Resultado_Revision_Central_P0_3_27SEP.md` | Este documento |

Sin cambios en `bramulab/` (frontend), `bramulab/version.json`, service worker, ni ningún archivo de `main`/Production/BRAMUlive.

---

## 12. Qué debe hacer Central

1. Revisar esta corrección (los 3 problemas señalados + auditoría transversal).
2. Aplicar `20260927150000_preprod_p03_fase_a_account_deletion.sql` y `20260927160000_preprod_p03_ranking_anonymous_presentation.sql` (en ese orden) contra Staging, y correr `verify-preprod-p03-fase-a-account-deletion.sql`.
3. `npm install` dentro de `supabase/scripts/` y correr `admin-delete-player-account.mjs` contra una cuenta de PRUEBA real en Staging (nunca una cuenta con historial real que se quiera conservar) — confirmar las 3 fases y la verificación de post-condición.
4. Ejercitar `get_ranking_network` manualmente contra Staging con una cuenta eliminada en "Mi red" de otra cuenta (riesgo residual §9).
5. Solo entonces evaluar el cierre de P0.3 — este documento, igual que el anterior, **no marca P0.3 como cerrado**.
