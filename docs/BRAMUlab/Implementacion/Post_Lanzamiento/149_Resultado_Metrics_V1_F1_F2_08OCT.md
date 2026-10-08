# 149 — Resultado · BRAMU Metrics V1 · F1 (presencia) + F2 (núcleo protegido) — 08OCT26

**Estado:** implementado en el repo, probado localmente (PGlite = Postgres real + Node). **NO aplicado en ningún Supabase, NO desplegado.** Solo Staging; Production y BRAMUlive intactos; sin cambios en lógica deportiva ni en el panel visual (F3+).
**Plan y contratos:** `148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md` · `BRAMU_Metrics_Auditoria_Tecnica_V1.md` · UX/Privacidad/Comparaciones V1.
**Bundle:** `04.37-h28` (`APP_VERSION` sin cambio: ronda invisible).

## 1. Qué se implementó

### F1 — Presencia diaria
| Pieza | Archivo | Qué hace |
|---|---|---|
| Migración | `supabase/migrations/20261008100000_metrics_f1_player_activity.sql` | Tabla `player_activity_days` (1 fila por jugador y día BA; RLS sin políticas; sin grants de cliente), RPC `register_app_presence(modo, plataforma, bundle)` y `admin_export_player_data` ampliado con `activityDays`. |
| RPC | idem | Jugador **siempre** de `auth.uid()`, día fijado por el servidor (BA); valida enums/formato (si no cumple, no escribe); idempotente por día; no re-escribe dentro de 5 min; `standalone` es pegajoso en el día; solo cuentas registradas no eliminadas; `authenticated` sí, `anon` no. |
| Cliente | `bramulab/auth.js` (`recordActivity`), `bramulab/app.js` (2 llamadas) | Se dispara **solo** al reanudar sesión real y al volver a primer plano con sesión viva. Throttle 30 min por dispositivo (persistido). Pestaña oculta/sin backend: no hace nada. Nunca lanza ni bloquea UI. Solo viajan modo, plataforma gruesa y bundle público. |
| Bundle | `index.html`, `sw.js`, `store.js`, `version.json` | `04.37-h27` → `04.37-h28` (cuarteto sincronizado) + tests de versión al día. |

### F2 — Núcleo protegido
| Pieza | Archivo | Qué hace |
|---|---|---|
| Migración | `supabase/migrations/20261008110000_metrics_f2_core.sql` | `metrics_admins` (UUID de `auth.users`, revocable), `metrics_internal_players` (exclusión de cuentas internas con interruptor), `metrics_is_admin`, catálogo cerrado de 49 KPIs, ventanas BA, umbral k=5 (`_metrics_apply_k`), comparación (`_metrics_kpi`), series, y las 6 secciones `metrics_overview/users/matches/activation/community/usage` → `{meta, kpis, series, breakdowns}`. |
| Permisos | idem | **Todo** `revoke … from public, anon, authenticated` + `grant execute … to service_role` (patrón `ops_health_snapshot`). Ningún helper concedido. Central usa las MISMAS funciones desde su conector. |
| Edge Function | `supabase/functions/admin-metrics/index.ts` + `_shared/admin-metrics-core.mjs` | `verify_jwt=true` + `auth.getUser`; luego `metrics_is_admin`; luego rate limit (`edge_admin_metrics` 60/min); luego validación del body; sección → función SQL por **mapa fijo**; 403 idéntico para no-admin/revocado/inexistente; `Cache-Control: no-store`; sin PII en logs; `custom` reservado. |
| Release/Runbook | `supabase/scripts/release-check.mjs`, `Runbook_Operacion_y_Salida.md` | `admin-metrics: true` en `EXPECTED_VERIFY_JWT`; aserción «11 funciones de usuario»; fila de operación con alta/baja de administrador y de cuentas internas. |
| Verify Staging | `supabase/tests/verify-metrics-v1-f1-f2.sql` | Solo lectura (8 consultas con resultado esperado). Ejecutada en PGlite: corre completa. |

Decisiones técnicas tomadas (compatibles con el plan):
- **Nombre `register_app_presence`** (no `record_*`): los controles de grants del repo (`prebloque9-hardening`, `bloque9a-release`, `verify-clean-room`, `audit-live-grants.sql`) tratan toda `record_*` ejecutable por `authenticated` como administrativa. Se renombró en lugar de relajar tres controles.
- **FK `on delete cascade`** en la presencia: `players` se anonimiza (no se borra), así que la presencia se conserva pseudonimizada (D3 por defecto); el cascade es solo red de seguridad.
- **Cuenta interna** = jugador (métricas por persona) o autor del partido (métricas de partidos). Documentado en la migración.
- **Sin muestra suficiente no se expone el numerador**: con `insufficient_sample`/`immature`/`not_instrumented` tanto `value` como `count` salen `null` (`n` es el total de la población). Consecuencia: con la base actual casi todo porcentaje saldrá «muestra insuficiente» (correcto con k=5).
- **Hallazgo adicional durante F2:** `count` (numerador) en un KPI con muestra insuficiente reintroducía justo lo que k=5 oculta; corregido y testeado.

## 2. Pruebas ejecutadas (resultado real)

| Suite | Resultado |
|---|---|
| `supabase/functions/_shared/metrics-f1-activity.test.mjs` (12) | **12/12** — privilegios (ACL observed+open), RPC sin parámetros de jugador/fecha, sin sesión, día BA del servidor, idempotencia/anti-ráfaga, standalone pegajoso, entradas inválidas sin escritura, provisional/eliminada rechazadas, aislamiento entre sesiones, roles reales `authenticated`/`anon` denegados, informe de acceso con `activityDays`, eliminación de cuenta. |
| `supabase/functions/_shared/metrics-f2-core.test.mjs` (23) | **23/23** — permisos con ACL strict/observed/open y roles reales; `metrics_is_admin` (revocado/ajeno/nulo/cascade); ventanas BA; catálogo = salida; **k=5 con propiedad aleatoria (200 casos)**; reglas de comparación; fixture del Apéndice B (usuarios, partidos con NULL de anulaciones y vencido derivado, 1 cuenta, activación con cohorte inmadura, comunidad, presencia, retención madura); **concordancia 7/30/90 d contra consultas crudas independientes**; cuentas internas; **no fuga** (sin UUID/emails/nombres/usernames en 6 secciones × 4 rangos × con/sin internas); rol real `service_role`; ninguna función `VOLATILE`. |
| `supabase/functions/_shared/admin-metrics-core.test.mjs` (9) | **9/9** — orden JWT→admin→rate limit→validación, 403 idéntico, body cerrado (`__proto__`, SQL, claves extra, `custom`), 500 genérico, estática de `index.ts`, contrato contra el SQL real (6 funciones × 4 rangos). |
| `bramulab/metrics-f1-presencia-h28.test.mjs` (9) | **9/9** — `auth.js#recordActivity` real en `vm` (payload mínimo, throttle persistido, oculto/sin backend, best-effort con storage bloqueado) + garantías estáticas de dónde se dispara y dónde no. |
| `supabase/functions/_shared/*.test.mjs` completo | **141/141** (antes 97). |
| `bramulab/*.test.mjs` + `scripts` + `api` | 984 tests: **953 pass / 31 fail — las 31 son idénticas a la línea base** (tests de versión/legal de rondas previas, hardcode del host de Staging en `app.js`, placeholders legales de Production). **Cero fallos nuevos**; +9 pass. |
| `release-check.mjs` | Mismos 3 chequeos fallidos que antes (hardcode `vercel-host` preexistente + 2 de build Production con placeholders legales); **PASS** en Edge Functions (`admin-metrics` verify_jwt=true), «11 funciones de usuario», replay ×3 ACL, grants. |

## 3. Acciones pendientes de Central (frontera externa — en este orden)

1. **Aplicar en Supabase Staging**, en orden: `20261008100000_metrics_f1_player_activity.sql` y luego `20261008110000_metrics_f2_core.sql`. (Aditivas; no tocan datos existentes.)
2. **Correr** `supabase/tests/verify-metrics-v1-f1-f2.sql` (solo lectura) y `supabase/tests/audit-live-grants.sql`: esperado según los comentarios de cada consulta (en particular consulta 2 = 0 filas; consultas 1, 3 y 4 de grants sin hallazgos nuevos).
3. **Desplegar** `admin-metrics` con `verify_jwt=true`. No hay secretos nuevos (usa `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` del entorno de Functions).
4. **Alta del administrador de Staging** (a mano, UUID — **DECISIÓN D4 abierta: confirmar qué cuenta**): `insert into public.metrics_admins (auth_user_id, label) select id, 'Sebastián (Staging)' from auth.users where id = '<uuid>';`. Ubicar la cuenta una sola vez; el runtime usa solo el UUID.
5. **Negativos reales contra la función desplegada** (cuentas reales de Staging; no requieren dar secretos al agente):
   - sin `Authorization` → 401; token inválido/vencido → 401;
   - **cuenta común (no admin) → 403 `forbidden`** y, con cuerpo inválido, el mismo 403 (no se puede sondear);
   - admin con `revoked_at` → 403;
   - admin → 200 por cada sección y rango (`7d/30d/90d/all`) y body con `custom`/claves extra → 400;
   - PostgREST directo como usuario común: `rpc('metrics_users')`, `rpc('metrics_is_admin')`, `select` sobre `metrics_admins`/`player_activity_days`/`pilot_events` → denegado o 0 filas; `rpc('register_app_presence')` **sí** funciona y solo escribe la fila propia.
6. **Presencia en Staging:** abrir la app Staging (bundle h28) con una cuenta real y verificar **1 fila** en `player_activity_days` para hoy BA; recargar/volver a primer plano → no suma otra fila (throttle/5 min). Confirmar en la consulta 8 del verify que no hay duplicados.
7. **Concordancia:** comparar `select public.metrics_overview('30d')` (conector de solo lectura) contra SQL manual sobre las mismas ventanas (consulta 7 del verify cubre cuentas y partidos).
8. **Deploy del frontend h28 a Staging** (un solo push ya incluye `bramulab/`): Vercel Staging construye `04.37-h28`. Si la migración F1 aún no está aplicada, la llamada falla en silencio (best-effort) sin efecto visible.

## 4. Decisiones abiertas (ninguna bloqueó F1/F2)

| ID | Estado |
|---|---|
| **D1** Promoción temprana SOLO de la presencia a Production (migración aditiva + h28) | **ABIERTA — Sebastián.** Esta ronda no toca Production. Recomendado: sí, para empezar el reloj de DAU/retención. |
| **D2** Qué cuentas de Production son internas/de prueba | **ABIERTA — Sebastián.** El mecanismo existe y está vacío; el rótulo `internalExcluded` lo informa. |
| **D3** Texto de la Política de privacidad para «día de actividad» + tratamiento al eliminar cuenta | **ABIERTA — Sebastián/Central.** No se tocó `privacidad/index.html` (texto legal/AAIP). Por defecto: conservar pseudonimizado y excluir eliminados de poblaciones «actuales». **Conviene resolverla antes de D1/Production.** |
| **D4** Cuenta que recibe acceso en cada entorno | **ABIERTA — Sebastián** (Central la inserta). |
| **D7** Umbral k=5 | **Implementado como propuesta** (constante `metrics_min_cell()`); pendiente de confirmación. |
| D5 (retención semanal como lectura principal) / D6 (MFA admin) | D5 aplicado por defecto (W1/W4 + D1/D7/D30 secundarias); D6 sigue opcional. |

## 5. Qué NO se verificó
- Estado vivo de Staging (migraciones, grants reales, versión de la función, filas) y comportamiento del Edge desplegado (Deno): solo su núcleo en Node y su estática.
- Rendimiento con volumen real (sin índices extra: la PK y `player_activity_days_date_idx` cubren F1; revisar si `matches` supera ~50 k filas).
- Que `visibilitychange`/standalone se comporten igual en iPhone/Android reales (la clasificación está probada con user-agents sintéticos).
- Nada del panel visual (F3+). `Ranking` (elegibilidad/cobertura), duplicados/recuperaciones y Nivel público siguen para F4 (el desglose de estados de Nivel ya sale con k).
