# Backend Bloque 4 — Validación final en Staging

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**Preview final validado:** commit `877069c`, assets `h11`  
**Entorno:** Supabase `bramulab-staging` (`serxtivkfnptzurnvewg`) + Vercel Preview/Staging  
**Resultado:** **PASS**

Este documento consolida la evidencia automática y manual de Backend Bloque 4 — Jugadores, búsqueda e invitados provisionales. No inicia Bloque 5.

---

## 1. Verificación automática contra Supabase Staging

Corrida real desde Terminal con credenciales de Staging cargadas solo en la sesión local:

- `node supabase/tests/verify-bloque2.mjs` → **BLOQUE 2 OK**
- `node supabase/tests/verify-bloque3.mjs` → **BLOQUE 3 OK**
- `node supabase/tests/verify-bloque4.mjs` → **BLOQUE 4 OK**
- limpieza final del verificador → **sin advertencias**

`verify-bloque4.mjs` cubre:

- RPCs de Bloque 4 rechazadas para `anon`;
- tablas server-only no legibles directamente por `anon` ni `authenticated`;
- búsqueda por `@username`, exclusión de self, mínimo/máximo de query y protección contra wildcards SQL;
- ausencia de campos privados en resultados;
- provisionales excluidos de búsqueda y Perfil público;
- creación repetida con mismo nombre → UUIDs distintos, nunca merge automático;
- listado acotado de provisionales propios;
- rotación/revocación de link;
- claim exitoso preservando `player_id`, `signup_completed` y registrando `provisional_claimed`;
- continuación de `complete_profile` + `officialize-onboarding` después del claim;
- token usado/vencido y cuenta ya registrada;
- concurrencia: un solo ganador;
- rate limiting de búsqueda y claim;
- limpieza de fixtures.

La limpieza del verificador tuvo un bug de orden de FK en la primera corrida; fue corregido en `63a0511`, se limpió el único leftover y la segunda corrida terminó limpia.

---

## 2. Hardening de tablas server-only

Migraciones aplicadas en Staging:

- `bloque4_jugadores_busqueda_provisional`
- `bloque4_server_only_table_grants`

La segunda revoca todos los privilegios directos de `anon` y `authenticated` sobre:

- `public.provisional_claims`
- `public.api_rate_limits`

ACL final: acceso directo únicamente para owner/postgres + `service_role`; los usuarios autenticados operan mediante RPCs acotadas.

Los avisos del Security Advisor sobre RLS habilitado sin policies en tablas server-only son intencionales (deny-by-default). Los warnings de funciones `SECURITY DEFINER` autenticadas corresponden a las RPCs públicas acotadas del bloque. No son blockers del piloto.

---

## 3. Buscar jugadores — prueba manual

Validado en Vercel Preview/Staging con cuenta real:

- búsqueda real por `@usuario` → **PASS**;
- búsqueda por nombre → **PASS**;
- el propio usuario no aparece → **PASS**;
- resultados provenientes del backend real, sin mocks → **PASS**;
- `Recientes` queda oculto/vacío mientras no existan partidos compartidos reales de Bloque 5 → **PASS**.

La RPC desplegada también busca explícitamente sobre `last_name`; esa parte queda cubierta por contrato server-side y el verificador automático.

---

## 4. Perfil público server-backed — prueba manual

Desde un resultado real de Buscar jugadores:

- identidad y `@usuario` correctos → **PASS**;
- Nivel/estado reales → **PASS**;
- Mano/Lado solo cuando existen → **PASS**;
- Edad no expuesta → **PASS**;
- Efectividad/Partidos no expuestos sin partidos reales compartidos → **PASS**;
- Mejor racha no expuesta → **PASS**;
- Mejor Nivel histórico no inventado → **PASS**;
- Ranking local/simulado no expuesto como dato real → **PASS**;
- `AGREGAR JUGADOR` local no aparece en la rama server-backed → **PASS**;
- no se exponen campos privados → **PASS**.

### Regresión de estado visual server-backed → local/legacy/mock

Se había corregido que los atributos `hidden` aplicados por la rama server-backed podían quedar pegados al abrir luego un perfil local.

Prueba manual final, sin recargar la app:

1. perfil server-backed abierto: `@claimb4h11`; módulos no soportados ocultos;
2. luego Ranking BRAMU → jugador local/mock **Tomás Aguirre (`@tomas`)**;
3. reaparecieron correctamente:
   - bloque meta;
   - Edad;
   - Mano;
   - Lado;
   - Efectividad;
   - Rendimiento (Mejor racha / Mejor nivel BRAMU);
   - `AGREGAR JUGADOR`.

Resultado: **PASS**.

---

## 5. Username canónico en Home — hotfix y revalidación

Hallazgo inicial:

- Home mostraba `@sebastian`;
- Mi Perfil / Mis Datos mostraban `@sebas`.

Causa: Home seguía derivando un handle legacy desde el nombre visible mediante `buildPlayerHandle(currentPlayerName)`.

Hotfix: Home usa `Store.getCurrentUser().username` cuando existe y conserva el fallback legacy solo para identidades sin username real. Cache bump `h9 → h10`.

Revalidación manual:

- Home → `@sebas`
- Mi Perfil → `@sebas`
- Mis Datos → `@sebas`

Resultado: **PASS**.

---

## 6. Claim — primera prueba fallida y diagnóstico

Identidad provisional usada:

- nombre: `Invitado de prueba mua40lea`
- `player_id`: `44c94e30-268f-4ad1-95d1-081e8b0f0a7d`

Primera cuenta creada:

- `@claim_mualea_20`
- `player_id`: `0a7abbaf-ee87-4090-8772-0ffc2d50399b`
- Nivel: `CALIBRANDO`

La UI reconoció la intención de claim, pero el claim permaneció `pending`. La cuenta nueva siguió como identidad separada.

Evidencia clave: esa cuenta no dejó ninguna entrada de rate limit para claim. Como `claim_provisional_player` consume rate limit al entrar, la RPC nunca había sido invocada.

Causa frontend: `captureClaimTokenFromUrl()` borraba `?claim=` aun si `Store.saveClaimToken()` no había logrado persistir en `localStorage`.

Hotfix:

- fallback volátil en memoria para CLAIM_TOKEN;
- si la persistencia falla, `?claim=` permanece en URL;
- si Auth todavía no está configurado, la intención tampoco se descarta;
- `clearClaimToken()` limpia persistencia + fallback;
- assets `h10 → h11`.

Test agregado:

`node supabase/tests/verify-claim-token-storage.mjs` → **CLAIM TOKEN STORAGE OK**

Además:

- `node --check` de `store.js`, `app.js`, `sw.js` y el test nuevo → OK;
- suite local `tests.html` → **1408/1408**.

---

## 7. Claim — prueba manual final

Preview: `877069c`, assets `h11`.

Cuenta nueva usada:

- username: `@claimb4h11`

Resultado:

- reclamó la identidad provisional existente → **PASS**;
- conservó exactamente el `player_id` provisional:
  `44c94e30-268f-4ad1-95d1-081e8b0f0a7d` → **PASS**;
- la identidad pasó a `registered` con Auth real → **PASS**;
- claim pasó a `claimed` → **PASS**;
- `claimed_by_player_id` = mismo `player_id` adoptado → **PASS**;
- `signup_completed` preservado → **PASS**;
- `provisional_claimed` exactamente una vez → **PASS**;
- `level_confirmed` exactamente una vez → **PASS**;
- llegó a Home → **PASS**;
- no pidió un segundo OTP → **PASS**.

Estado confirmado directamente en Supabase tras la prueba.

### Segundo uso del enlace

Reabrir el mismo link:

- no produjo otra fusión;
- no creó otra identidad adoptada;
- el claim siguió siendo de un solo uso.

Resultado: **PASS**.

---

## 8. Alta normal sin claim

Cuenta:

- `@normalb4h11`
- `player_id`: `02e511e6-99f7-45a4-9a89-063affd7c4be`

Pruebas:

- alta normal sin `?claim=` → PASS;
- refresh → PASS;
- login → PASS;
- `player_id` distinto del provisional reclamado → PASS;
- cero claims asociados → PASS.

Confirma que el hotfix de claim no altera el flujo normal de Bloques 2–3.

---

## 9. Datos de QA preservados deliberadamente

No se limpian en este cierre para conservar evidencia reproducible en Staging:

- `@claim_mualea_20`: evidencia del fallo previo a h11;
- `@claimb4h11`: evidencia del claim exitoso h11;
- `@normalb4h11`: control de alta normal sin claim.

No son seeds de Production. Una limpieza posterior de Staging debe ser explícita y controlada.

---

## 10. Nota sobre “mismo provisional en varios partidos”

`Backend_Infraestructura.md` expresa como criterio final que un provisional mantenga el mismo ID en varios partidos.

Bloque 4 deja resuelto el **contrato de identidad** necesario:

- provisional persistente con UUID;
- reutilización explícita por `player_id`;
- nunca auto-merge por nombre;
- claim conserva el mismo ID.

La prueba literal “varios partidos comparten ese ID” no puede ejecutarse todavía porque el modelo de partidos compartidos pertenece a Bloque 5. No se considera un faltante de implementación de Bloque 4; es una prueba de integración que deberá formar parte de Bloque 5.

---

## 11. Resultado

**Backend Bloque 4: VALIDACIÓN FINAL PASS.**

No quedan comprobaciones funcionales pendientes dentro del alcance implementable del bloque.

Bloque 5 no se inicia desde este documento.
