# Backend Bloque 5 — Validación de backend real en Staging
## ChatGPT central

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**Baseline de implementación revisado:** `190e62f`  
**Estado:** backend de Bloque 5 aplicado y probado en Supabase Staging; frontend todavía no cableado.

---

## 1. Qué se aplicó en Supabase Staging

Proyecto: `bramulab-staging`.

Migraciones aplicadas con éxito:

1. `bloque5_matches_core`
2. `bloque5_rpcs_read`
3. `bloque5_create_or_attach_rpc`
4. hotfix `bloque5_defer_submission_fk`
5. hotfix `bloque5_conformity_guard`

La Edge Function:

`create-or-attach-match`

quedó desplegada en Staging, estado **ACTIVE**, versión 1, con JWT obligatorio.

El bundle desplegado contiene:

- `create-or-attach-match/index.ts`
- `_shared/engine.js`
- `_shared/match-load.js`

---

## 2. Bug real encontrado al primer intento contra Postgres

La primera ejecución real de `create_or_attach_match` detectó un problema que no podía aparecer en revisión estática:

`match_revisions.input_submission_id` tenía una FK inmediata hacia `match_submissions.idempotency_key`, pero la RPC crea primero la revisión y recién al final persiste el resultado definitivo en `match_submissions`.

Postgres rechazó correctamente la escritura por FK.

### Corrección

Se agregó:

`supabase/migrations/20260921003000_bloque5_defer_submission_fk.sql`

La FK se mantiene, pero pasa a:

`DEFERRABLE INITIALLY DEFERRED`

De esta forma la integridad se verifica al final de la transacción, cuando la submission ya existe.

Hotfix aplicado correctamente a Staging.

---

## 3. Segundo bug detectado durante validación real

Después de una conformidad rival correcta, si el otro integrante de esa misma pareja cargaba también el mismo partido, la RPC registraba una segunda acción `confirmed`.

La validación es por pareja: una vez que cualquiera de los dos integrantes resolvió la acción de ese lado, la conformidad de pareja debe existir una sola vez.

### Corrección

Se agregó una guardia:

- si `action_side IS NULL` y el score coincide;
- la carga converge al mismo `match_id`;
- responde `matched_already_confirmed`;
- mantiene `pending_validation` + `readyForValidation=true`;
- NO inserta otra acción `confirmed`.

Se actualizó el test para exigir exactamente una conformidad de pareja.

Hotfix:

`supabase/migrations/20260921004000_bloque5_conformity_guard.sql`

Aplicado correctamente a Staging.

---

## 4. Validaciones reales ejecutadas contra Postgres Staging

Se realizaron pruebas transaccionales reales, con rollback cuando correspondía, usando cuentas QA ya existentes y sin tocar `@sebas`.

### Identidad / create-or-attach

PASS:

- crear partido nuevo → `pending_validation`;
- misma pareja vuelve a declarar → mismo `match_id`, sigue pendiente;
- pareja rival declara el mismo score → mismo `match_id`;
- se registra una única conformidad;
- Bloque 5 NO cambia a `validated`;
- `validated_at` sigue null;
- `action_side` queda null después de conformidad;
- `readyForValidation=true`;
- segunda persona de la pareja rival no duplica conformidad.

### Nivel

PASS:

- cargar/confirmar en Bloque 5 no modifica `level_states`;
- `rated_matches` permanece sin cambios.

### Idempotencia

PASS:

- reintento secuencial con misma key + mismo payload → mismo resultado;
- misma key con payload distinto → rechazo;
- cambiar solo location también altera el payload hash;
- **dos requests realmente concurrentes** con la misma idempotency key + payload fijo → mismo `match_id`, una sola fila, una sola acción `created`.

Nota: una primera prueba concurrente usó `now()` en dos conexiones distintas y correctamente fue tratada como payload diferente por microsegundos; se repitió con timestamp fijo para probar la carrera real.

### Concurrencia / deduplicación

PASS:

- dos transacciones concurrentes, con distintas idempotency keys y cargadores de lados opuestos, sobre el mismo encuentro → un único `match_id`;
- una crea;
- la otra se adjunta y registra conformidad;
- advisory lock por fingerprint funcionando.

### Provisionales relacionadas

PASS:

- provisional creada por A;
- aparece en partido compartido con B;
- B la recupera mediante `list_related_provisional_players`;
- B puede reutilizar exactamente el mismo `player_id` en otro partido.

### Ambigüedad

PASS:

- se crean deliberadamente dos encuentros plausibles con `force new`;
- una tercera declaración recibe `ambiguous_candidates`;
- nunca se fusiona silenciosamente.

### Desambiguación

PASS:

- `disambiguation_match_id` fuera de la ventana temporal compatible → `disambiguation_match_id_invalid`.

### Pendientes

PASS en prueba aislada:

- jugador F acumula 5 pendientes accionables;
- contador devuelve exactamente 5;
- intentar iniciar un sexto encuentro nuevo → `pending_action_limit_reached`;
- responder/adjuntarse a uno ya existente aun estando en 5 → permitido.

### Historial privado / estados

PASS:

- `get_match_detail` devuelve detalle para participante;
- nota privada persiste mediante RPC;
- ocultar para mí no elimina el partido;
- oculto desaparece del feed por defecto;
- puede incluirse explícitamente;
- deadline vencido se presenta lógicamente como `expired`.

### Seguridad

PASS:

- `authenticated` no tiene SELECT directo sobre `matches` ni `match_participants`;
- lectura del producto pasa por RPC;
- `create_or_attach_match` es ejecutable por `service_role`, no por `authenticated` ni `anon`;
- RLS permanece habilitado deny-by-default.

Los avisos `RLS enabled/no policy` para las 7 tablas de partidos son **intencionales** bajo este diseño RPC-only.

Los warnings previos del proyecto sobre funciones SECURITY DEFINER autorizadas y leaked-password protection no fueron introducidos por Bloque 5.

---

## 5. Limpieza

Después de las pruebas:

- `matches`: 0
- `match_participants`: 0
- `match_revisions`: 0
- `match_sets`: 0
- `match_actions`: 0
- `match_submissions`: 0
- `match_user_state`: 0

No quedaron fixtures de Bloque 5 en Staging.

Las cuentas QA preservadas de Bloque 4 no se borraron ni alteraron como datos de producto.

---

## 6. Qué NO se pudo verificar todavía

El script completo:

`supabase/tests/verify-bloque5.mjs`

no se ejecutó end-to-end vía REST con service-role + JWT reales desde esta sesión porque el conector central no expone la service-role key como secreto utilizable por un proceso externo.

Esto NO impidió ejecutar la lógica crítica directamente contra el Postgres real, incluida concurrencia real entre conexiones.

La Edge Function está desplegada y ACTIVE y el bundle contiene correctamente sus dependencias, pero el **camino exitoso HTTP con un JWT de usuario real** se probará al conectar el frontend y hacer la validación real de navegador.

---

## 7. Decisión de avance

El backend real de Bloque 5 tiene evidencia suficiente para avanzar al wiring de frontend.

No hace falta repetir todas las pruebas SQL nuevamente durante el wiring salvo que se modifique:

- esquema;
- RPC;
- Edge Function;
- idempotencia;
- deduplicación;
- seguridad.

La siguiente ronda debe concentrarse en:

- integrar `matches.js`;
- outbox/`sync_pending`;
- selector server-backed de participantes;
- `getEffectiveHistory()`;
- historial compartido;
- estados/badges;
- ocultar para mí;
- ambigüedad;
- mantener intacto el camino local/legacy.

Después se hará validación de navegador real en Staging.

---

## 8. Alcance

- `staging`: tocado y validado.
- `main`: NO tocado.
- Production: NO tocada.
- BRAMUlive: NO tocada.
- Bloque 6: NO iniciado.
