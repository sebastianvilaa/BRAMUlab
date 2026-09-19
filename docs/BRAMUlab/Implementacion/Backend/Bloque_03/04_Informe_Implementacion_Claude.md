# Backend Bloque 3 — Informe de implementación (Claude)

**Fecha:** 19/09/2026
**Rama:** `staging` (HEAD antes de esta ronda: `a48d469`, fast-forward desde `998eac5`)
**Estado del bloque:** **implementado y regresionado localmente. No cerrado todavía** — falta que Sebastián aplique la migración, despliegue la Edge Function y corra la verificación real contra Supabase Staging (mismo procedimiento que cerró Bloques 1 y 2). No se tocó `main`. No se tocó `bramulive/`, `docs/BRAMUlive/`, ni ningún archivo de BRAMUlive.

Este documento es el registro operativo de esta ronda (no una fuente maestra de producto). Los documentos maestros actualizados como consecuencia de esta implementación son: `docs/BRAMUlab/README.md`, `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` (nueva sección "Bloque 3"), `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md` y `docs/BRAMUlab/BRAMUlab_Backlog.md`.

---

## 0. Reconfirmación de baseline (antes de tocar código)

Siguiendo `03_Revision_ChatGPT.md` §11 ("no uses el conteo por grep"), abrí `bramulab/tests.html` con el runner real (dev server local + Browser tool) **antes** de modificar nada:

```
1408/1408 tests OK — todo verde
```

Coincide exactamente con el baseline esperado. No hizo falta frenar por este punto.

---

## 1. Sobre la contradicción arquitectónica que la revisión pidió reportar si aparecía

`03_Revision_ChatGPT.md` §2 pidió frenar y reportar **antes de caer en PL/pgSQL** si aparecía una limitación técnica real del bundling/deploy de Supabase Edge Functions que obligara a duplicar el motor.

**No encontré una limitación que obligue a eso**, pero sí hay un punto de incertidumbre real que quiero dejar explícito en vez de asumirlo en silencio:

- El diseño implementado usa **symlinks reales** (`supabase/functions/_shared/level.js` → `../../../bramulab/level.js`, y lo mismo para `level-calibration.js`) — no una copia manual. Un symlink no es contenido duplicado: `cat`/`git show`/cualquier lectura de esos dos archivos siempre refleja el archivo real de `bramulab/`, byte a byte. Verifiqué que ambos symlinks resuelven correctamente y que el contenido es el mismo (`readlink` + lectura de las primeras líneas).
- Verifiqué además, **en Node** (sin ninguna dependencia de Supabase), que `bramulab/level.js` y `bramulab/level-calibration.js` se pueden cargar tal cual — sin modificarlos ni envolverlos — en un entorno que no es el navegador, usando el módulo `vm` de Node para ejecutar el mismo IIFE que ya usa `index.html`. Los resultados (`ALGORITHM_VERSION`, `QUESTIONNAIRE_VERSION`, un cálculo de camino rápido y uno de camino completo) salieron coherentes. Esto no prueba que el deploy de Supabase vaya a resolver el import igual que Node, pero sí prueba que **el mecanismo de fondo** (cargar el mismo archivo IIFE fuera de un navegador) funciona sin fricción — la arquitectura no depende de una característica exclusiva del navegador.
- Lo que **no pude verificar yo mismo** es si `supabase functions deploy officialize-onboarding` (o `supabase functions serve` en local) resuelve sin problema un import relativo (`../_shared/level.js`) que a su vez es un symlink apuntando fuera de `supabase/`. No tengo Supabase CLI vinculado a ningún proyecto real, ni credenciales, ni acceso de red al API de despliegue de Supabase desde este entorno — exactamente la misma limitación que ya existía en Bloques 1 y 2 (Sebastián aplicó las migraciones y corrió los scripts de verificación con sus propias credenciales; yo nunca tuve acceso a Staging real).

**Por eso no frené**: no es una limitación real y confirmada, es una verificación pendiente que le corresponde a quien tiene las credenciales — igual que "aplicar la migración en Staging" ya era, en Bloques 1 y 2, un paso que yo no podía ejecutar. Dejo la contingencia documentada por si el deploy falla:

> **Contingencia si `supabase functions deploy` no resuelve el symlink:** reemplazar los dos symlinks de `supabase/functions/_shared/` por copias reales de `bramulab/level.js`/`level-calibration.js`, y agregar `supabase/tests/verify-nivel-parity.mjs` (ya escrito en esta ronda) a una rutina que se corra en cada release para detectar divergencia — es exactamente la mitigación "motor único versionado + tests de paridad" que ya prevé `Backend_Infraestructura.md` §17. Si esto pasa, avisar antes de aplicarlo: es un cambio de arquitectura, aunque menor.

Si el deploy funciona con el symlink (lo esperable, dado que Deno sigue symlinks del filesystem igual que cualquier proceso Unix), no hace falta ningún cambio.

---

## 2. Qué se implementó

### 2.1 Migración SQL — `supabase/migrations/20260919120000_bloque3_nivel_persistente.sql`

Aditiva en su totalidad (nada destructivo, nada que rompa Bloque 2 en su comportamiento probado):

1. **`profiles`**: `terms_version text`, `terms_accepted_at timestamptz` (nullable).
2. **`complete_profile` (CREATE OR REPLACE)**: se agregó `p_terms_version text default null` al final de la firma (compatible con las llamadas existentes de Bloque 2, que no lo mandan). Se relajaron **únicamente** las dos validaciones obligatorias que bloqueaban el perfil mínimo: `competitive_branch_invalid` ya no se dispara si el valor es `null` (sigue validando el formato F/M si se manda algo), y la ubicación ya no es obligatoria (`location_required` solo se dispara si se manda una de las dos etiquetas sin la otra — el resto de la lógica de `locations`/GeoRef no cambió una línea). **No se generalizó a `COALESCE` parcial** en ningún campo de Bloque 2, tal como pidió la revisión — el `UPDATE` sigue sobreescribiendo por completo los campos que recibe. `terms_version`/`terms_accepted_at` sí usan una lógica mínima (conserva el valor anterior si no se manda uno nuevo; fija `terms_accepted_at = now()` — timestamp de SERVIDOR, nunca del cliente — cuando sí se manda), acotada a estas 2 columnas nuevas, no al resto de la función.
3. **`is_username_available`**: sin cambios de código, se agregó `grant execute ... to anon` además del `to authenticated` ya existente — feedback real de disponibilidad antes de que exista sesión.
4. **`level_states`** (nueva): `player_id` PK/FK a `players`, `status text check in ('PENDIENTE','CALIBRANDO','CALIBRADO','RECALIBRANDO')` (**PENDIENTE es un valor explícito de columna**, no ausencia de fila — ver §3 más abajo), `mu`/`confidence` (numeric, sin escala fija — el motor ya redondea a 4 decimales antes de mandar el valor), contadores de calibración, categoría declarada/contexto, versiones de algoritmo/cuestionario/modo, timestamps. RLS: select-own únicamente, deny-by-default para el resto (igual que `profiles`).
5. **`level_events`** (nueva): append-only, `event_type` con un único valor declarado por ahora (`'initial_estimate'` — el resto de tipos documentados en `Backend_Infraestructura.md` §6.5 se agregan cuando el bloque que los emite exista de verdad). `input_context`/`result` en `jsonb` (respuestas crudas y snapshot completo del resultado). **Índice único parcial** `(player_id) where event_type = 'initial_estimate'` — impide más de una oficialización inicial por jugador a nivel de base de datos.
6. **`handle_email_confirmed` (trigger de Bloque 2, CREATE OR REPLACE)**: se agregó un tercer `insert ... on conflict do nothing` para crear `level_states(player_id, status='PENDIENTE')` en el mismo momento que `players`/`profiles`. Decisión de la revisión (§3): "el contrato backend vigente define PENDIENTE explícitamente... el hecho de que el prototipo local lo representara como ausencia de estado no debe modificar el contrato productivo". Con esto, confirmar el email temprano (antes de terminar perfil/Nivel) ya deja una identidad server-side completa, sin oficializar Nivel todavía.
7. **`officialize_level_onboarding`** (RPC nueva, `SECURITY DEFINER`): única vía de escritura de `level_states`/`level_events`. Recibe `p_auth_user_id` + los datos YA CALCULADOS (versión de algoritmo/cuestionario/modo, `mu`, `confidence`, categoría, contexto crudo, resultado) — **nunca recalcula nada en SQL**. Idempotente: `select ... for update` sobre la fila de `level_states` del jugador, y si el status ya no es `PENDIENTE` devuelve el estado existente sin tocar nada (ni recalcula, ni duplica evento, ni sobreescribe con el payload nuevo). **`revoke all from public` + `grant execute ... to service_role` únicamente** — ni `authenticated` ni `anon` pueden llamarla: la única vía de entrada es la Edge Function, que ya validó el JWT del usuario antes de invocarla con la service role key.

### 2.2 Motor server-side — Edge Function + symlinks (no PL/pgSQL)

- `supabase/functions/_shared/level.js` y `level-calibration.js`: **symlinks** a `bramulab/level.js`/`bramulab/level-calibration.js` (verificado con `readlink`, no son copias).
- `supabase/functions/officialize-onboarding/index.ts`: recibe `{mode, quickSeedKey|quizAnswers, categoryContextKey, declaredCategory}` del cliente (respuestas CRUDAS, nunca un Nivel ya calculado); valida el JWT del usuario con un cliente Supabase armado con la **anon key** (nunca la service role para esto); corre `LVC.computeQuickLevel`/`computeFullEstimate` → `computeCategoryStep` → `confirmInitialLevelV1_1` (el mismo camino exacto que ya recorre `app.js` para la vista previa local, mismo criterio de `confirmDespiteCoherence = categoryStep.coherenceFlag`); llama a `officialize_level_onboarding` con un cliente armado con la **service role key**. Devuelve `{ok, levelState}` o `{ok:false, error}`.
- Por qué Edge Function y no un puerto a PL/pgSQL (ver también §1 de este informe y `03_Revision_ChatGPT.md` §2): es la única forma de que el servidor ejecute el **mismo archivo** que el navegador, sin mantener una segunda implementación de la fórmula en otro lenguaje.
- Por qué la RPC de persistencia no acepta el token del propio usuario: si `authenticated` pudiera llamar `officialize_level_onboarding` directo, podría mandar cualquier `mu`/`confidence` sin pasar por el motor real — la separación Edge Function (compute, con JWT del usuario) / RPC privada (persist, solo service_role) es lo que sostiene "el navegador nunca es autoridad" también dentro del propio backend.

### 2.3 Frontend

| Archivo | Cambio |
|---|---|
| `bramulab/auth.js` | `officializeLevel(payload)` (invoca la Edge Function vía `client.functions.invoke`, que adjunta solo el access token de la sesión activa); `completeProfile` manda `p_terms_version`; `fetchOwnProfile` ahora también trae `level_states` (`levelState`, o `null` en el caso excepcional de que no exista fila) y deriva `declaredCategory`/`declaredCategoryAt` de ahí en vez de `null` fijo. |
| `bramulab/store.js` | Nueva ranura de borrador local device-only: `SIGNUP_DRAFT` + `saveSignupDraft`/`loadSignupDraft`/`clearSignupDraft`. |
| `bramulab/app.js` | Wizard de alta reordenado: `SIGNUP_STEP_ORDER` pasa de `[1, 'verify', 2]` a `[1, 2, 'verify']` — el email se confirma al FINAL, no justo después de crear la cuenta. Paso 2 ("TU PERFIL") reducido al perfil mínimo (nombre/apellido/@usuario/checkbox de términos); rama/ubicación/avatar/fecha de nacimiento/género/mano/lado quedan ocultos (no eliminados). Nuevo botón "Confirmar email ahora" (solo con backend real) para adelantar el OTP sin perder el resto del borrador. El onboarding de Nivel BRAMU (sin tocar su lógica interna) gana un modo `'draft'` que opera sobre `signupDraft` en vez de `Store.getCurrentUser()` cuando corre como parte de un alta real en curso — el modo `'account'` (cuentas locales, "Crear usuario de prueba", "Resetear Nivel BRAMU") queda **exactamente igual que antes**. `resumeDraftFlow()` es el único punto que decide, a partir del borrador, si falta perfil/Nivel/oficializar — se llama tras cualquier OTP verificado y al arrancar la app si queda un borrador sin terminar. `runOfficializeAndEnter()` es el comando idempotente completo (llama `complete_profile` y después la Edge Function). Controles de laboratorio (ícono de matraz, long-press, "Crear usuario de prueba") ocultos cuando `window.__BRAMU_ENV__.name === 'production'`; "Resetear Nivel BRAMU" rechaza actuar sobre una cuenta `serverBacked`. |
| `bramulab/index.html` | Paso 2 del alta: campos que salen del perfil mínimo quedan `hidden` (no borrados); checkbox nuevo de términos; botón "Confirmar email ahora". `verify` se reordena al final del wizard en el DOM/comentarios. |
| `bramulab/styles.css` | Estilo mínimo para el checkbox de términos (`.field--checkbox`/`.field-checkbox-label`), único control booleano nativo de la app hasta ahora. |
| `bramulab/sw.js` | `CACHE_NAME` y todo `CORE_ASSETS` de `04.10-h2` a `04.10-h3` (mismo patrón que el bump de Bloque 2 — `version.json`/`Store.VERSION` NO cambian, Backend no usa la numeración `V04.x`). |

### 2.4 Scripts de verificación nuevos

- `supabase/tests/verify-bloque3.mjs`: contra Supabase Staging real (no ejecutable por mí, sin credenciales). Cubre: `level_states` nace `PENDIENTE` apenas se confirma el email (antes de tocar perfil/Nivel); `complete_profile` con perfil mínimo sin rama/ubicación; que `officialize_level_onboarding` rechaza el token del propio usuario; oficialización real por Edge Function (rápido y completo); idempotencia (mismo payload repetido, payload muy distinto después de oficializar, exactamente 1 `level_event`); carrera de `@usuario` (username ocupado durante la oficialización no toca Nivel, el resto del borrador sigue disponible); RLS cruzada de `level_states`/`level_events`; `is_username_available` con `anon`. A diferencia de `verify-bloque2.mjs`, la limpieza de este script **sí revisa** el resultado de cada borrado (mejora que el propio backlog pedía para Bloque 2, aplicada acá desde el origen).
- `supabase/tests/verify-nivel-parity.mjs`: compara, para las mismas respuestas crudas, el resultado de Node (cargando `bramulab/level.js`/`level-calibration.js` directamente, vía `vm`) contra el de la Edge Function ya desplegada — si divergen, el problema es el symlink/import compartido, no la fórmula (esa ya la cubre `tests.html`).

Ambos scripts pasaron `node --check` (sintaxis válida). El mecanismo de carga del motor compartido (`vm.createContext` + `vm.runInContext` sobre los archivos reales) lo verifiqué de forma aislada y funciona — ver §1.

---

## 3. Tests y verificación

| Verificación | Cómo | Resultado |
|---|---|---|
| Baseline antes de tocar código | `tests.html` en navegador real (dev server local) | **1408/1408** |
| Regresión después de implementar | `tests.html` en navegador real, releído sin caché | **1408/1408** (sin cambios — no se tocó ninguna fórmula) |
| Sintaxis de todo el JS modificado | `node --check` sobre `app.js`/`auth.js`/`store.js` | OK |
| Sintaxis de los scripts nuevos | `node --check` sobre `verify-bloque3.mjs`/`verify-nivel-parity.mjs` | OK |
| Carga del motor compartido fuera del navegador | Node + `vm`, mismo mecanismo que usará la Edge Function | Carga y calcula correctamente (`nivel_bramu_v1_0`/`nivel_inicial_v1_1`, valores coherentes) |
| Camino sin backend (`!Auth.isConfigured()`), manual en navegador | Alta completa: email/contraseña → perfil mínimo (nombre/apellido/@usuario, autosugerencia de username funcionando, checkbox de términos) → cuenta local creada → Home Estado Cero | Sin errores de consola nuevos (el único error observado, `env.generated.js` 404, es preexistente y esperado en dev local sin build real) |
| Modo `'account'` del onboarding de Nivel (sin tocar), manual en navegador | "Crear usuario de prueba" → "DEFINIR MI NIVEL" → camino rápido → categoría → nota de coherencia real → "CONFIRMAR MI NIVEL" → Home con Nivel 4.5, CALIBRANDO · 0/5 | Funciona exactamente igual que antes de este bloque |
| Controles de laboratorio (sin tocar su lógica, solo su visibilidad) | Ícono de matraz → activa preview → long-press → modal Herramientas → "Resetear Nivel BRAMU" sobre la cuenta local | Funciona igual que antes; el guard `serverBacked` no interfiere con cuentas locales |

**Lo que NO pude verificar yo (requiere credenciales reales de Supabase, igual que en Bloques 1 y 2):**

- Aplicar la migración en Staging.
- Desplegar la Edge Function y confirmar que el symlink se resuelve en el deploy real (ver §1).
- Correr `verify-bloque2.mjs` sin modificar (debe seguir dando 16/16 — no debería verse afectado, ya que sigue mandando `competitive_branch`/ubicación en todos sus casos).
- Correr `verify-bloque3.mjs` y `verify-nivel-parity.mjs` contra Staging real.
- El camino completo con backend real (signup real → OTP real → perfil mínimo → Nivel → confirmación → oficialización real → Home), confirmación anticipada del email, y refresh a mitad de alta con sesión real — la lógica está implementada (`resumeDraftFlow`, `bootWithServerSession`, `resumeServerSession`) pero solo se ejercita cuando `Auth.isConfigured()` es `true`, que requiere `window.__BRAMU_ENV__` (generado por un build real de Vercel) y un proyecto Supabase real.

---

## 4. Checklist contra `03_Revision_ChatGPT.md`

| # | Punto de la revisión | Estado |
|---|---|---|
| 1 | Precisión: 1 decimal público / 4 interno, sin cambios de fórmula | ✅ No se tocó ninguna fórmula ni constante de precisión |
| 2 | Motor server-side vía Edge Function + motor compartido, no PL/pgSQL | ✅ Symlinks reales, ver §1/§2.2 |
| 3 | `level_states.status` con `PENDIENTE` explícito | ✅ Columna con el valor, creada por el trigger extendido |
| 4 | `complete_profile` sin `COALESCE` genérico | ✅ Solo se relajaron las 2 validaciones imprescindibles |
| 5 | Ranking no se adelanta | ✅ No se construyó la pantalla "Completar datos para Ranking" |
| 6 | `is_username_available` abierta a `anon`, sigue revalidando al oficializar | ✅ Grant agregado; `complete_profile` (llamado desde `runOfficializeAndEnter`) revalida siempre |
| 7 | Controles de laboratorio: conservados, ocultos en Production | ✅ `isProductionEnv()`; "Resetear Nivel" no toca cuentas `serverBacked` |
| 8 | Confirmación anticipada ≠ onboarding terminado | ✅ Trigger crea identidad mínima temprano; `resumeServerSession` exige perfil + Nivel no-PENDIENTE antes de Home |
| 9 | Idempotencia reforzada a nivel DB + tests explícitos | ✅ PK + índice único parcial + `for update` + `verify-bloque3.mjs` con los 4 casos pedidos |
| 10 | Términos: solo soporte técnico, persistido server-side | ✅ `terms_version`/`terms_accepted_at`, timestamp de servidor |
| 11 | Reconfirmar baseline con el runner real antes de tocar código | ✅ 1408/1408, ver §0 |
| 12 | Resto del plan (borrador local, perfil mínimo, respuestas crudas, no tocar BRAMUlive/Bloques 4+/main/fórmula) | ✅ |

---

## 5. Observaciones no bloqueantes (para tener en cuenta, no requieren acción ahora)

1. **Degradación esperada del ajuste por categoría para cuentas nuevas reales:** el perfil mínimo ya no pregunta género/localidad durante el alta (Experiencia_Inicial.md §2.2), así que `categoryContextKey` sale `null` para todo alta nueva hasta que la persona complete esos datos más adelante desde Perfil. Esto es un comportamiento YA PREVISTO por la propia fórmula ("queda sin mapa compatible... nunca ajusta el nivel", Nivel_BRAMU_Formula_V1.5.md §3.3) — no es un bug ni requiere cambio de código, pero vale que quede documentado: el único mapa de categoría activo hoy (`ar_masculino_v1`) va a dejar de aplicarse en la práctica hasta que exista una forma de completar género/localidad después del alta real.
2. **`complete_profile` sigue sin merge parcial** (decisión explícita de esta ronda, ver §2.1 punto 2) — anotado en `BRAMUlab_Backlog.md` para cuando exista una segunda pantalla que llame a esta función.
3. **CORS de la Edge Function** (`Access-Control-Allow-Origin: '*'`) — razonable para el piloto (la función igual exige JWT válido), anotado en el backlog para acotarlo cuando existan dominios definitivos.
4. **`officialize_level_onboarding` no exige que el perfil ya tenga `@usuario`** antes de oficializar Nivel — en el flujo real esto nunca pasa porque `runOfficializeAndEnter` siempre llama primero a `complete_profile`, pero no hay una restricción a nivel de base de datos que lo obligue. No lo agregué por no introducir una validación cruzada nueva sin necesidad real comprobada; queda anotado acá por si en algún momento se detecta un cliente que se salte el orden.
5. **UX menor:** el botón "atrás" desde el paso final de confirmación de email (`verify`) vuelve siempre al paso 2 (perfil mínimo), incluso si se llegó ahí después de terminar el cuestionario de Nivel — no reconstruye el paso de Nivel. Es un caso de borde de navegación, no de datos (el borrador de Nivel ya confirmado no se pierde, solo no se ofrece un atajo directo de vuelta a esa pantalla).

---

## 6. Qué falta para cerrar Bloque 3 (acción de Sebastián)

1. Aplicar `supabase/migrations/20260919120000_bloque3_nivel_persistente.sql` en Supabase Staging (SQL Editor).
2. `supabase functions deploy officialize-onboarding` (necesita Supabase CLI vinculado al proyecto de Staging). Si falla por el symlink, ver la contingencia de §1.
3. Correr, contra Staging real:
   - `SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/tests/verify-bloque2.mjs` (sin modificar — debe seguir en 16/16).
   - `SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/tests/verify-bloque3.mjs`
   - `SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/tests/verify-nivel-parity.mjs`
4. Validación manual con una cuenta real en la app de Staging: alta completa (perfil mínimo + Nivel + confirmación al final), confirmación anticipada del email (paso 2 → "Confirmar email ahora" → retoma el perfil/Nivel), refresh a mitad de alta (antes y después de confirmar el email), username ocupado durante la oficialización.
5. Con todo lo anterior en verde, actualizar `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` (sección "Bloque 3" ya creada en esta ronda) marcando el bloque como CERRADO, con la misma evidencia que se documentó para Bloques 1 y 2.

---

## 7. Commit

Un solo commit con todo lo de esta ronda (migración, Edge Function, symlinks, frontend, scripts de verificación, documentación), pusheado únicamente a `staging`. Nunca a `main`. `bramulive/`/`docs/BRAMUlive/` no se tocaron.
