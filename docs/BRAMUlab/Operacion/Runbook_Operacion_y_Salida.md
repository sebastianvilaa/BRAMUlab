# BRAMUlab — Runbook de operación y checklist de salida (Pre-Bloque 9)

**Estado:** preparado en Staging el 30/09/2026 (V04.20 / 04.20-h3); procedimientos y backup ensayados en Bloque 9B (01/10/2026). **La Parte B se ejecutó en la salida a Production del 07/10/2026** (datos reales en `Operacion_Vercel_Staging_Production.md`, sección «Production»); queda como procedimiento de referencia y de reconstrucción. **Cualquier mutación de Production requiere autorización explícita de Sebastián.** La Parte C fija cómo se opera con usuarios reales.
Este documento no contiene secretos: las credenciales viven solo en variables de entorno / Vault / Vercel.

---

## Parte A — Operación administrativa (Staging hoy; Production igual cuando exista)

Regla: **reutilizar** scripts/RPCs existentes; no hay un segundo motor. Todo corre con `service_role` desde una máquina de confianza (variables de entorno `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; nunca pegarlas en chats/issues).

| Necesidad | Herramienta vigente | Notas |
|---|---|---|
| Salud operativa de los primeros usuarios | `select public.ops_health_snapshot();` (SQL editor / service_role) | Solo agregados: cuentas, perfiles completos, Nivel oficializado, reaceptación pendiente, altas sin confirmar > 24 h (esperado 0), partidos por estado y vencidos sin validar, eventos 7 días, partidos por día, rate limits de la última hora. Sin ids ni emails. |
| Auditar permisos | `supabase/tests/audit-live-grants.sql` + `node supabase/scripts/audit-migration-grants.mjs` | Esperado en `audit-live-grants.sql`: (1) solo `is_username_available` SECURITY DEFINER ejecutable por anon; (2) solo helpers `_group_photo_*` entre los SECURITY DEFINER internos deliberados para authenticated; (3) ninguna tabla sin RLS; (4) ningún grant directo INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER ni privilegio PostgreSQL 17 `MAINTAIN` para anon/authenticated — los SELECT intencionales quedan protegidos por RLS; (5) ningún bucket público. |
| Acceso/copia de datos de una persona | `node supabase/scripts/admin-export-player-data.mjs <playerId \| @usuario> [salida.json]` (RPC `admin_export_player_data`) | Solicitud por `bramulab@gmail.com`. El informe sale con permisos 0600; enviarlo solo al email registrado de la cuenta y borrarlo local. Terceros redactados. |
| Eliminación de cuenta | Autoservicio (`delete-my-account`) o, si hace falta administrar: `node supabase/scripts/admin-delete-player-account.mjs <playerId>` | Mismo motor (`_shared/account-deletion-core.mjs`). Sale con código 0 solo si TODAS las postcondiciones se cumplen; es reintentable. |
| Cuenta problemática / abuso | 1) `auth.admin.updateUserById(authUserId, { ban_duration })` (corta nuevos tokens); 2) si corresponde, eliminación como arriba. Restricción/cierre: Términos §8, revisión por email. | No hay panel. Documentar el motivo fuera del repo (sin PII en Issues). |
| Corrección/anulación excepcional de un partido | `admin_annul_match(match_id, actor_label, reason)` (revierte Nivel si estaba validado) y `admin_force_resolve_identity_issue` vía la Edge Function `admin-resolve-identity-issue` (service role exacta) | Actor y motivo obligatorios; quedan en `match_actions.metadata`. |
| Métricas del producto (BRAMU Metrics V1; Staging completo, **Production NO publicada**: ver Parte D) | Consola `/admin/metrics/` → Edge `admin-metrics`; análisis de Central: `select public.metrics_overview('30d');` (también `metrics_users/matches/activation/community/usage`; args `p_range` 7d·30d·90d·all, `p_compare`, `p_include_internal`) | Misma definición para panel y chat; solo agregados (umbral k=5). **Alta de administrador** (a mano, por entorno): `insert into public.metrics_admins (auth_user_id, label) select id, '<etiqueta>' from auth.users where id = '<uuid>';` — la identidad es el UUID; **baja**: `update public.metrics_admins set revoked_at = now() where auth_user_id = '<uuid>';`. Cuentas internas/de prueba excluidas por defecto: `insert into public.metrics_internal_players (player_id, reason) values ('<player_id>', 'owner');`. Presencia: tabla `player_activity_days` (sin histórico previo a su puesta en marcha). |
| Altas abandonadas | Cron `cleanup-abandoned-signups` (horario) | Verificar con `select jobname, schedule, active from cron.job;` y que `unconfirmedSignupsOver24h` ≈ 0. |
| Limpieza de contadores de rate limit | `select public.purge_old_rate_limits();` (conserva 7 días) | `api_rate_limits` crece una fila por jugador+acción+ventana. Programarla junto al cron cuando haya volumen (hoy no urge). |

### Procedimientos verificados (Bloque 9B)

Cada procedimiento fue **ensayado de punta a punta** sobre una base efímera con fixtures y el código operativo real (`supabase/scripts/ops-rehearsal.mjs`; se repite con `npm run ops-rehearsal` o dentro de `release-check.mjs`). Todos exigen **evidencia previa** (qué mirar antes) y tienen **criterio de éxito** objetivo. Los límites de lo ensayado están en `87_Resultado_Bloque_9B…`.

**1. Exportación / acceso a datos de una persona** — `node supabase/scripts/admin-export-player-data.mjs <playerId | @usuario> informe.json`
- *Previo:* solicitud por `bramulab@gmail.com` desde el email registrado; la cuenta existe y no está eliminada.
- *Éxito:* exit 0 y mensaje "permisos 0600". El informe se **valida antes de escribirse** (secciones completas, titular correcto, sin claves de secretos ni ids de otras personas); si no valida, **no se escribe nada** (exit 1, `report_invalid`). Errores de red se reintentan 3 veces; los códigos de negocio (`account_deleted`, `player_not_found`, `not_a_registered_account`) son definitivos.
- *Archivo:* escritura atómica (temporal 0600 + rename); **no pisa** un archivo existente salvo `--force` (que lo deja 0600). Enviarlo solo al email registrado y borrarlo local.
- *Redacción:* de otros participantes solo el **nombre mostrado en el partido compartido**; ids de terceros se eliminan recursivamente tanto si vienen en claves `*PlayerId/*UserId` como embebidos dentro de strings internos. `Intelligence.semanticKey` no se exporta. El generador raw/helper no tiene EXECUTE directo para `service_role`: el camino operativo único es el wrapper seguro.

**2. Cuenta problemática / abuso** — 1) (opcional) exportar evidencia (procedimiento 1); 2) `auth.admin.updateUserById(authUserId, { ban_duration: '876000h' })`; 3) si corresponde, procedimiento 3.
- *Previo:* motivo documentado fuera del repo (sin PII en Issues). *Éxito:* `banned_until` ≈ +100 años y datos intactos hasta decidir. Revisión por email (Términos §8).

**3. Eliminación de cuenta** — autoservicio (`delete-my-account`) o administrada `node supabase/scripts/admin-delete-player-account.mjs <playerId>`.
- *Previo:* confirmar `playerId`; guardar el **libro de eliminaciones** (ver Backup). *Éxito:* exit 0 **solo** si `verifyAccountDeleted` confirma todo: anonimizado, desvinculado, inactivo, Storage y fotos de grupo limpios, Auth inexistente, auditoría purgada.
- *Ensayado:* fallo parcial en Auth o Storage ⇒ el motor se detiene en esa fase **sin declarar éxito**, el acceso BRAMU ya está cortado (Fase 1 atómica) y el **retry** completa (se resuelve por la auditoría `account_deleted`); re-ejecutar es idempotente. Partidos compartidos preservados ("Jugador eliminado"), terceros intactos, grupos coherentes.

**4. Corrección / anulación excepcional de un partido** — `admin_annul_match(match_id, actor_label, reason)` (service_role); identidad: Edge Function `admin-resolve-identity-issue` (service role exacta).
- *Previo:* leer el partido y su estado; **actor y motivo obligatorios** (vacío ⇒ `actor_label_and_reason_required`). *Éxito:* `matches.status='annulled'`, `annulment_reason` y `match_actions.metadata` con actor/motivo, aviso `admin_action` a los participantes; repetir devuelve `already_annulled` sin duplicar; inexistente ⇒ `match_not_found`; también funciona sobre un partido validado.

**5. Altas abandonadas** — cron horario `cleanup-abandoned-signups` (o invocación manual con la service role / secreto de Vault).
- *Éxito:* borra solo no confirmados con ≥ 24 h; un fallo de borrado cuenta como error sin afectar al resto; el retry lo completa; tercera pasada = no-op. `ops_health_snapshot().accounts.unconfirmedSignupsOver24h` ≈ 0.

**6. Rate limits** — `select public.purge_old_rate_limits();` (7 días). *Éxito:* devuelve cuántas filas purgó y conserva las recientes; `rateLimitedLastHour` de `ops_health_snapshot()` muestra presión anómala.

### Forward-fix vs rollback de migraciones
- **Regla:** las migraciones son **append-only y se corrigen hacia adelante (forward-fix)** con una migración nueva, idempotente y con verify. **No hay rollback automático** de migraciones: casi todas incluyen DDL, grants y backfills; revertirlas a mano es más riesgoso que corregirlas. No se editan migraciones ya aplicadas en un entorno (el replay limpio exige que el archivo del repo sea un estado final equivalente; ver el caso `…232000`/`…280000` en el 84).
- **Evidencia previa a aplicar (siempre):** `node supabase/scripts/release-check.mjs` en PASS; un manifest regenerado con `--manifest` (hash por migración y por Edge Function) contrastado con lo aplicado (los manifests históricos de 9A/9B se retiraron: son regenerables y están en Git); `audit-live-grants.sql` en el entorno destino; si la migración toca privilegios, comparar la sección 7 antes de aplicar.
- **Si una migración falla a mitad:** las migraciones corren en una transacción; no se aplica parcialmente. Se corrige el archivo (todavía no aplicado) o, si ya está aplicada en otro entorno, se agrega la migración correctiva.
- **Cuándo se considera rollback de DATOS:** solo ante corrupción de datos (no de esquema): restaurar un backup **a un proyecto nuevo** (nunca encima de Production), comparar y copiar lo necesario, y **re-aplicar el libro de eliminaciones** (ver Backup). Cualquier restauración se decide con Central y se autoriza con Sebastián.
- **Edge Functions:** el rollback es redeployar el bundle anterior (el manifest guarda el hash por función); las funciones son sin estado.

### Backup — qué está demostrado y qué NO
**Demostrado (9B, backup LÓGICO de `public` sobre base efímera):** `supabase/scripts/logical-backup.mjs` vuelca las tablas de `public` con checksum por tabla; la restauración sobre un esquema replayado limpio reproduce **checksums idénticos**, deja el sistema funcional (los triggers no re-disparan efectos) y **detecta un dump alterado**. Propiedad crítica ensayada: **un backup anterior a una eliminación la "resucita"**; el procedimiento es **guardar un libro de eliminaciones fuera del backup** (`exportDeletionLedger`: solo `player_id` técnicos, sin PII) y, tras cualquier restauración, **re-aplicar `admin_delete_player_account` por cada id** del libro. Un backup posterior a la eliminación conserva la anonimización.

**NO se probó un backup gestionado de Supabase.** Quedan sin demostrar y dependen del plan/región reales de Production (decisión de Sebastián, no elegida acá): frecuencia y retención de backups, PITR, cobertura de `auth.*` (usuarios/hashes), `storage.*` (avatares/fotos) y Vault, tiempo de restauración y la restauración efectiva a un proyecto efímero. Plazos reales de backups/logs: `[[PENDIENTE_PRODUCCION:plazos_backups_logs]]` en las páginas legales.
- **Staging hoy:** datos de prueba; respaldo puntual con `supabase db dump` (requiere la contraseña de la base: tarea de Central, nunca de Sebastián) o exportaciones por tabla con `service_role`.

### Preflight (qué es automático y qué no)
Requiere `npm ci` dentro de `supabase/scripts/` (el `node_modules` no se versiona y se regenera idéntico desde `package-lock.json`, verificado el 08/10/2026; en una copia nueva hay que correrlo antes de `release-check` y de los tests que importan PGlite, p. ej. `bramulab/tests/bloque9b-ops.test.mjs`).

`node supabase/scripts/release-check.mjs [--manifest m.json] [--preflight-md p.md]` ejecuta **todo lo automatizable** (migraciones, hardcodes, Edge Functions y `verify_jwt`, builds Staging/Production/credenciales cruzadas, replay limpio ×3 ACL con regresión PG17 `MAINTAIN`, ensayo operativo A/B/C, regresión Edge service-to-service) y termina con un bloque **PREFLIGHT** que separa:
- **AUTOMÁTICO PASS/FAIL** (decide el exit code), y
- **4 gates externos que nunca se dan por cerrados**: G1 Comunicaciones/Auth-email · G2 browser/OTP humano (QA Legal/Acceso + E2E destructivo) · G3 autorización de Production (+ datos legales reales, AAIP/RNBDP) · G4 plan real de backups. Cada uno lista responsable, pendiente, evidencia automática disponible y con qué se cierra.

---

## Parte B — Checklist reproducible de salida a Production (ejecutada el 07/10/2026; **no volver a ejecutar sobre la Production existente**)

Cada paso marcado ⛔ requiere **AUTORIZACIÓN DE SEBASTIÁN** previa y explícita. Orden exacto:

1. ⛔ Autorización escrita de Sebastián para abrir Production (alcance: solo Sebastián primero, ver `Pre_Production.md`).
2. Pre-requisitos cerrados: P0.2 (legal: comunicaciones/emails, QA browser, E2E destructivo con OTP) y datos reales de las páginas legales (`[[PENDIENTE_PRODUCCION:*]]` = 0; el build de Production lo exige).
3. ⛔ Crear el proyecto Supabase Production (región y plan decididos y registrados; completar `plazos_backups_logs`, proveedor y región en las páginas legales).
4. **Antes de tocar nada:** `node supabase/scripts/release-check.mjs` (PASS obligatorio; ver `Implementacion/Pre_Production/84_Resultado_Bloque_9A_Replay_Limpio_01OCT.md`). Luego replay REAL de migraciones en orden de nombre desde `supabase/migrations/` (todas, sin editar; incluye la línea base de privilegios `20261001060000`); `audit-live-grants.sql` y los verifies `verify-preprod-*` autocontenidos (los que piden cuentas reales no aplican a una base nueva).
5. Configuración post-replay (la base nueva trae `app_config` vacío y `legal_versions` sin vigencia): sembrar `app_config` con `environment='production'` y `legal_version='legal_v1'` (+ `legal_versions.effective_at` real). La app verifica en runtime que `app_config.environment` coincida con el build (fail-closed).
6. Auth: SMTP/plantillas de Production (proyecto Comunicaciones), OTP 6 dígitos, "Secure email change", URL de sitio y redirects, rate limits de Auth.
7. Storage: buckets privados `avatars` y `group-photos` + sus políticas (vienen en migraciones); comprobar que ninguno es público.
8. Desplegar Edge Functions: `officialize-onboarding`, `create-or-attach-match`, `officialize-match`, `propose-match-correction`, `respond-match-correction`, `resolve-identity-issue`, `get-match-intelligence`, `process-identity-recovery` (V04.29, replay de Nivel de una vinculación de identidad), `admin-metrics` (BRAMU Metrics V1: JWT + administrador autorizado en `metrics_admins`; ver fila «Métricas del producto» abajo) y `delete-my-account` con `verify_jwt=true`; `admin-resolve-identity-issue` y `cleanup-abandoned-signups` con `verify_jwt=false` porque son service-to-service y validan internamente su autenticación privilegiada.
9. Cron: `select public.schedule_cleanup_abandoned_signups('https://<ref>.supabase.co/functions/v1/cleanup-abandoned-signups');` y confirmar en `cron.job`.
10. ⛔ Vercel Production: proyecto/ dominio, variables `BRAMU_ENV_NAME=production`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (nunca la service role), `ignoreCommand` vigente; el build rechaza credenciales cruzadas (`env-guard.mjs`) y páginas legales con pendientes (`legal-guard.mjs`).
11. Smoke (sin usuarios reales): alta con aceptación legal → OTP → perfil → Nivel; login/recuperación; carga de partido entre cuentas descartables; reaceptación; `ops_health_snapshot()`; E2E de eliminación con cuenta descartable (`e2e-delete-my-account.mjs`, ⛔ OTP humano); borrar las cuentas descartables.
12. ⛔ Abrir a Sebastián (primer usuario real). "Cuando entra el primer usuario real, BRAMU ya empezó": no se vuelve a resembrar Production.
13. AAIP/RNBDP y datos del responsable: ⛔ trámites personales de Sebastián; no bloquean los pasos técnicos pero sí la apertura a terceros (ver `Privacidad_Legal.md` §13).

---

## Parte C — Operación con usuarios reales (vigente desde 07/10/2026)

Consolida la política operativa que dejó el traspaso de primeros usuarios (retirado el 08/10/2026). Production es el producto real: **no es un piloto descartable**.

**Prioridad de triage** (observar el patrón antes de convertir un comentario aislado en función nueva):
1. bloqueantes de alta/login/OTP/onboarding;
2. pérdida, corrupción o mezcla de identidad/datos;
3. carga/validación/duplicados de partidos;
4. problemas visuales que impidan completar una acción;
5. recién después, mejoras de conveniencia.

**Partidos «en joda», datos incorrectos y limpieza de cuentas:**
- Carga pendiente que nadie reconoció → el autor usa **Anular carga** (`Experiencia_Inicial.md` §14.1).
- Partido ya oficial pero inventado, duplicado o incorrecto → se corrige, invalida o excluye del cómputo **preservando trazabilidad**. No borrar filas a ciegas cuando impacta a terceros, Nivel, Ranking, estadísticas o Intelligence.
- Cuenta de prueba contaminada → evaluar limpieza/eliminación administrativa **después** de inspeccionar sus relaciones; eliminar una cuenta no borra el historial compartido de terceros (`Privacidad_Legal.md` §3).
- Ante un pedido tipo «borrá estos partidos» o «limpiá esta cuenta»: primero identificar exactamente las entidades afectadas y el impacto deportivo, después ejecutar. **No construir un panel admin** solo por esta fase mientras el volumen sea bajo.

**Forma de trabajo:** Staging primero para cualquier cambio; Production solo con aprobación explícita (promoción dirigida desde el SHA aprobado de `staging`, ver `Operacion_Vercel_Staging_Production.md`); un microfix bloqueante puede resolverlo Central sin handoff intermedio; no tocar BRAMUlive; no inventar estadísticas ni estados deportivos; Nivel y Ranking son sistemas distintos. Ante un reporte de scroll/visual, verificar primero que el usuario recibió el bundle nuevo (`/version.json`, alias, caché de iOS) antes de modificar CSS.

---

## Parte D — BRAMU Metrics: publicación privada en Production y retiro (preparada el 08/10/2026, actualizada con el consentimiento el 08/10; **NO ejecutada**)

Objetivo: que solo la cuenta administradora de Sebastián en Production consulte datos reales desde celular y computadora. **Requiere autorización explícita de Sebastián, con el SHA exacto.** Evidencia y decisiones: `Implementacion/Post_Lanzamiento/149_…` §12. Texto de privacidad y diseño del consentimiento (sin publicar): `Privacidad_Legal.md` §18.

### D.1 Qué llega a Production y qué NO (verificado)
- **Frontend (Vercel):** con `bramulab/scripts/promotion-surface.mjs <SHA_PRODUCTION_ACTUAL> <SHA_A_PUBLICAR>` se construye `dist/` de Production para ambos commits y se compara. Resultado verificado contra h26 (`f1ad7d1b`): para los jugadores cambia **solo** (a) la versión del bundle, (b) la presencia diaria **condicionada al consentimiento** (V04.38: `recordActivity` + funciones de consentimiento en `auth.js`; casilla opcional del alta, pantalla única de decisión y fila «Medición de uso» en Configuración en `app.js`/`index.html`/`styles.css`), (c) 1 línea del Service Worker que deja pasar `/admin/*` directo a la red, y (d) archivos nuevos `admin/metrics/{index.html,metrics.js,metrics.css}`. **No** llegan: el icono azul de Staging (`icons-staging/`), `qa-fixture.js`, tests ni documentación. Páginas legales: hoy idénticas; **el SHA a publicar debe incluir la Política y «Eliminar cuenta» actualizadas** (`Privacidad_Legal.md` §18.4), que viajan en el mismo despliegue (las páginas son parte de `bramulab/`) y por eso aparecen como cambio esperado en `promotion-surface` (`privacidad/index.html` y `eliminar-cuenta/index.html`; `terminos/` **no** debe cambiar).
- **Base (Supabase Production):** las 6 migraciones de Metrics, **en orden**, una por una: `20261008100000` (presencia) → `20261008110000` (núcleo) → `20261008120000` (D8/Comunidad) → `20261008130000` (Explorar) → `20261008140000` (**la actividad se elimina al eliminar la cuenta**) → `20261008150000` (**consentimiento de medición**: `app_config.activity_consent_version`, tabla `activity_consents`, 4 funciones, la presencia solo se registra con consentimiento). Son aditivas: crean tablas y funciones nuevas; las **únicas** funciones existentes que cambian son `admin_export_player_data` (gana `activityDays` y `activityConsents`), `admin_delete_player_account` (idéntica salvo el borrado de la actividad; `to_regclass` evita depender de las tablas de Metrics) y `handle_email_confirmed` (idéntica salvo que registra el consentimiento del alta cuando viene en la metadata y coincide con la versión vigente). **La medición queda APAGADA** (`activity_consent_version` NULL): hasta el paso 5b nadie es consultado ni medido. Probado en `supabase/functions/_shared/metrics-promotion-rehearsal.test.mjs`: sobre una base tipo Production con datos, ninguna fila, permiso, política, trigger ni índice existente cambia; el reintento es seguro.
- **Edge Function:** desplegar `admin-metrics` (3 archivos: `admin-metrics/index.ts`, `_shared/admin-metrics-core.mjs`, `_shared/rate-limit.ts`) con **`verify_jwt = true`**. No hay secretos nuevos. Las otras 12 funciones no se tocan.
- **No se mueve `main`.** Production se publica con `create_deployment` desde el SHA de `staging` (ver `Operacion_Vercel_Staging_Production.md`). Todo commit posterior de `staging` queda afuera.

### D.2 Condiciones previas (todas)
1. **Decisiones de Sebastián:** la **decisión de consentimiento** ya está tomada (`Privacidad_Legal.md` §18.1: aceptación informada, opcional); falta la **verificación interna por escrito** del diseño (§18.6), la Política actualizada **publicada** (§18.4: Política y Eliminar cuenta) y la constancia AAIP verificada (§18.5); D2 (cuentas internas); autorización de publicación con SHA. *D4 resuelta: la única administradora es `@seba`.*
2. Staging: `metrics-access-check.mjs --target staging` con una cuenta administradora y una común reales → **0 FALLAN** (hoy sin ejecutar: requiere sesiones reales) y revisión visual en celular real.
3. Production en estado esperado (solo lectura, Central): correr `supabase/tests/preflight-metrics-production.sql` (P1 migraciones aplicadas **por nombre** —el registro de Supabase usa su propia versión—, P2 sin objetos de Metrics, P3 `environment = 'production'`, P4 una única candidata `@seba`, P5 línea base de conteos para comparar después, P6 funciones con permisos de cliente) + `audit-live-grants.sql` limpio + 12 Edge Functions ACTIVE (panel). Production hoy (08/10, GET público): `version.json` = `04.37-h26`, `/admin/metrics/` = 404, `robots.txt` sin `Disallow: /admin/`.
4. G4 (backups gestionados) sigue sin plan: no hay restauración desde panel. Mitigación: las migraciones son aditivas y están ensayadas, y el retiro D.5 está probado; **no** se promete restauración de datos.

### D.3 Orden de publicación (cada paso se verifica antes del siguiente)
1. **Congelar el SHA** y correr `promotion-surface.mjs` → «OK: solo cambia lo esperado».
2. **Base:** aplicar las 6 migraciones en orden (Central). Verificar con `supabase/tests/verify-metrics-v1-f1-f2.sql` (consultas 1–16: sin funciones ejecutables por `anon`/`authenticated`, 0 administradores, 0 días de actividad) (consultas 17–19: ninguna actividad de cuentas eliminadas, la eliminación borra actividad y la retención lo declara) (consultas 20–23: tabla de consentimiento append-only y cerrada, funciones con los permisos correctos, `activity_consent_version` = NULL, 0 actividad sin consentimiento) y que los conteos del punto D.2.3 no cambiaron. Hasta acá **nada es visible** para los jugadores.
3. **Alta de la única administradora** (`@seba`): ejecutar `supabase/scripts/metrics-grant-admin.sql` tal cual (resuelve **una sola vez** el UUID de `auth.users` por @usuario y lo inserta; **aborta sin insertar** si ya hay un administrador activo o si no hay exactamente una cuenta activa, con email confirmado, con ese @usuario; no escribe el UUID en ningún documento). Verificar: `select count(*) from public.metrics_admins where revoked_at is null` = **1** y `metrics_is_admin(<ese uuid>) = true`. Cuentas internas (D2): `metrics_internal_players`.
4. **Edge:** desplegar `admin-metrics` con `verify_jwt=true`. Correr `node supabase/scripts/metrics-access-check.mjs --target production` (sin `SITE_URL` todavía) con la administradora y **una cuenta común** (una cuenta existente no administradora, marcada como interna): esperado **0 FALLAN** (401 sin credenciales, 403 idéntico a la común, 200 a la admin en 6 secciones × 4 períodos + 55 indicadores, PostgREST directo denegado). Si algo falla: **detenerse y retirar (D.5)**; todavía no se publicó el frontend.
5. **Frontend** (el SHA ya incluye la Política y «Eliminar cuenta» actualizadas; la medición sigue apagada hasta 5b): `create_deployment` target production desde el SHA. Verificar `READY`, SHA exacto, `app.bramulab.com` apuntando al nuevo deployment **y ambos aliases** (incidente del 07/10), `/version.json` con el bundle esperado, `/robots.txt` con `Disallow: /admin/`, `/admin/metrics/` con `x-robots-tag: noindex` y `cache-control: no-store`, y que `/admin/metrics/qa-fixture.js` dé 404. Repetir `metrics-access-check.mjs --target production` con `SITE_URL=https://app.bramulab.com`.
5b. **Encender la medición** (Central, **recién ahora**): `update public.app_config set activity_consent_version = 'activity_v1' where id = 1;`. Hasta este UPDATE el jugador no ve ninguna pantalla nueva ni se registra nada. Revertible en cualquier momento volviendo a `NULL` (la presencia se detiene; lo ya consentido y registrado se conserva).
6. **Humo de no afectación a jugadores** (Sebastián/Central, sin crear datos reales): abrir la app, iniciar sesión, ver la pantalla única de consentimiento (cuenta existente), navegar Home/Perfil/Partidos/Grupos/Ranking sin errores nuevos; aceptar con la cuenta de prueba y confirmar **1** fila de actividad para esa cuenta y ninguna otra (con «NO, GRACIAS»: 0 filas y la app se usa igual); comparar los conteos de D.2.3 (deben ser iguales salvo lo que los jugadores hayan hecho); revisar logs de Edge (sin 5xx) y que las 12 funciones previas siguen ACTIVE.
7. **Primer uso de la consola:** abrir primero `app.bramulab.com` (para que el Service Worker se actualice) y recién después `/admin/metrics/` (o el acceso directo del celular). Verificar banner **PRODUCTION · datos reales**, las 7 pestañas, «Captura parcial desde dd/mm» en Uso y que Sebastián ve solo agregados.
8. **Vigilancia 72 h:** errores de la Edge (4xx/5xx), crecimiento de `player_activity_days`, y adopción por versión (Uso → «Versión de la app»): **mientras muchos jugadores tengan el bundle viejo, DAU/WAU subestiman** (solo cuentan quienes abrieron la versión nueva); se normaliza en días.

### D.4 Qué NO hay que esperar de los datos
- La medición cubre **solo a quienes consintieron** (DAU/WAU/MAU subestiman la actividad total; la consola muestra la cobertura con k=5). No hay actividad **anterior** al consentimiento: ni se reconstruye ni se estima. Las únicas medidas anteriores son las «con acción» (retroactivas, rotuladas como tales) y los hechos persistidos (altas, partidos, grupos).
- Con pocos usuarios reales casi todo porcentaje/desglose dirá «muestra insuficiente» (mínimo 5): es el comportamiento correcto.

### D.5 Retiro (rollback) — de menor a mayor impacto
Script: `supabase/scripts/metrics-rollback.sql` (SQL comentado; se ejecuta **un nivel por vez**, a mano). Ensayado: tras los niveles 2 y 3 el esquema, las funciones, los permisos y todos los datos de jugadores quedan **idénticos** a los de antes de Metrics (incluido el informe de acceso/copia).
0. **Frontend (lo primero, casi siempre alcanza):** reasignar `app.bramulab.com` al deployment anterior de Production (`dpl_2FiyCJD1eA5t7sVj27qWyaayRnCp`, h26, o el vigente antes de publicar) con Vercel; verificar `/version.json`. No toca la base. El frontend viejo no registra actividad ni sirve la consola.
1. **Apagar el acceso:** nivel 1 (revocar al administrador) → la Edge responde 403 a todos. Reversible.
2. **Retirar la Edge:** eliminar/desactivar `admin-metrics` (sin ella nadie lee métricas aunque el SQL siga).
3. **Retirar el motor:** nivel 2 (funciones y tablas de lectura; conserva la presencia ya capturada).
4. **Retiro total de la captura:** nivel 3 — **destructivo**: borra los días de actividad **y la evidencia de consentimiento** (`activity_consents`) y restaura el informe de acceso y la eliminación de cuenta a sus definiciones previas. Solo por decisión expresa de Sebastián (p. ej., si retira el consentimiento a esa medición).
Cualquier otra falla: **forward-fix** con migración nueva (regla vigente). El retiro no usa backups ni restaura datos.

### D.6 Verificadores
- `node supabase/scripts/metrics-access-check.mjs --target staging|production` — acceso y denegación contra un entorno real; credenciales por variables de entorno, jamás en chat; lo no ejecutado figura **OMITIDA**; la escritura de presencia es opt-in (`--allow-presence-write`).
- `node bramulab/scripts/promotion-surface.mjs <SHA_ACTUAL> <SHA_NUEVO>` — qué cambia para los jugadores.
- `node --test supabase/functions/_shared/metrics-promotion-rehearsal.test.mjs` — ensayo de migración y retiro sobre una base tipo Production.
- `node --test supabase/functions/_shared/metrics-deletion-anonymization.test.mjs` — demuestra que la actividad de una cuenta eliminada es seudonimizada (no anónima) y que la eliminación la borra por todas las vías.
- `node --test supabase/functions/_shared/metrics-admin-grant.test.mjs` — el alta de la administradora (solo `@seba`, una sola, aborta ante ambigüedad) y el preflight de Production sobre una base tipo Production.
- `node --test supabase/functions/_shared/metrics-player-denial.test.mjs` — un jugador común (y la propia administradora por PostgREST) no puede ejecutar ni leer nada de Metrics; 403 idéntico en todos los modos con la autorización SQL real.
- **Prueba viva de eliminación (Central, Staging):** con una cuenta de prueba que haya abierto la app (1 fila de actividad), eliminarla por el flujo normal y comprobar con la consulta 17 que no queda ninguna fila ni marca interna de esa cuenta.
