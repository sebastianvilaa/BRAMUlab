# Backend Bloque 8 — Resultado de Fase D: Plantillas, persistencia mínima y UX (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `7a66ee3` (`15_Handoff_Fase_D_Claude.md`, tras Fase A, Fase B y Fase C cerradas en Staging).
**Alcance ejecutado:** dos partes en una sola intervención, exactamente como pidió el handoff: **H01** (hardening de identidad estable, único motivo autorizado para tocar A/B/C esta ronda) y **D — Plantillas, persistencia mínima y UX**. No se avanzó a Fase E. No se integró Nivel ni Ranking. No se implementó capa generativa. No se tocó `main`, Production, BRAMUlive ni Mis Grupos. No se aplicó ninguna migración ni se deployó la Edge Function a Supabase Staging (ver §6).

---

## 1. H01 — hardening de identidad estable

**Problema (handoff §2):** un partido con `hasOpenIdentityIssue=true` no tiene identidad confiable en sus 4 posiciones — antes de esta ronda, ese booleano no se consultaba en ningún punto de A/B, así que un partido con una incidencia abierta podía seguir alimentando agregados relacionales (compañero/rival/pareja/cruce) y aportar evidencia sobre una persona que podría no ser la correcta.

**Corrección, en dos puntos, nunca tres — nunca se "elimina" el partido:**

1. **`intelligence-context.js` → `computeRelationshipSummary`** (único agregador compartido por los 4 tipos de relación, Fase A): agrega `if (match.hasOpenIdentityIssue) return;` al inicio del `forEach`. Cubre todo partido **histórico** con incidencia abierta, para cualquier llamador presente o futuro — se puso en el agregador compartido, no en cada constructor, para no depender de que cada llamador lo recuerde por separado.
2. **`intelligence-claims.js` → `buildClaimsForMatch`** (Fase B): si el partido **evaluado ahora mismo** (`ctx.hasOpenIdentityIssue`) tiene la incidencia, los 4 constructores relacionales (`buildCompanionClaims`/`buildIndividualRivalClaims`/`buildRivalPairClaims`/`buildExactPairCrossingClaims`) y `buildBestCompanionClaim` no se llaman. `buildContextClaims` mezcla un hecho relacional (compañero nuevo/dificultad previa) con uno que no lo es (regreso tras inactividad) — se filtra su resultado en vez de duplicar su lógica interna, dejando pasar únicamente `contexto_regreso_tras_inactividad`.

**Lo que sigue disponible sin cambios, con identidad abierta:** estructura de score, hitos, racha propia, forma reciente, formato comparable extremo, balance de perder el primer set, regreso tras inactividad — ninguno depende de la identidad de otro jugador.

**Tests (handoff §13, 4/4):**

1. partido con identidad abierta no entra en agregado relacional — `H01.1` (`intelligence-context.test.mjs`);
2. current match con identidad abierta no produce claims relacionales — `H01.2`/`H01.3` (`intelligence-claims.test.mjs`);
3. claims no relacionales verificables siguen disponibles — cubierto en el mismo test `H01.2`/`H01.3` (se afirma explícitamente qué SÍ sigue presente);
4. identidad estable/resuelta conserva comportamiento normal — `H01.4` en ambos archivos (regresión byte a byte contra el comportamiento previo a esta ronda).

---

## 2. Fase D — Plantillas, persistencia mínima y UX

### 2.1 Módulo de presentación (`bramulab/intelligence-presentation.js`, nuevo)

`PLIntelligencePresentation`, construido por composición sobre `PLIntelligenceEditorial` (Fase C, nunca reabierta salvo H01) — no recalcula evidencia ni relevancia, solo redacta y persiste memoria de plantillas.

- **`TEMPLATES`** — registro de plantillas determinísticas por `insightType` (≈31 tipos, familias A–G del handoff), cada una con `templateId` estable y versionado y hasta 2 variantes de redacción para el mismo hecho (evita repetir literalmente la misma frase en partidos consecutivos cuando hay alternativa — `pickVariant`, punto 12). Vocabulario auditado (punto 13): ninguna plantilla usa técnica, emoción o causalidad — solo hechos con nombres, números y fechas reales.
- **`buildNameResolver(historyAsc)`** — usa siempre el `displayName` más reciente visto para cada `playerId` recorriendo la historia; sin nombre disponible, formulación neutral en vez de inventar una entidad (punto 9/9b).
- **Aprendizaje/abstención (handoff §6):** hitos fijos en 1/3/5 partidos con memoria propia de presentación (`learningHitosShown`, nunca se repiten — punto 16); sin candidato fuerte, abstención honesta con `fallbackMessage` fijo, nunca un principal inventado (punto 15).
- **"Por qué aparece" (handoff §7):** cada insight lleva `why`, texto factual humano derivado de la evidencia ya guardada por B/C — auditado para no exponer IDs, nombres de tabla/RPC ni `reasonCodes` (punto 17).
- **`computeHistoryFingerprint(historyAsc)`** — hash FNV-1a (no criptográfico, simplicidad explícita del handoff) sobre los campos que determinan la salida de cada partido del prefijo (`matchId`, `playedAt`, `status`, `officialEligible`, `hasOpenIdentityIssue`, `hidden`, `winnerTeam`, `sets`). Determinístico ante el mismo input (punto 11); sensible a corrección de sets, identidad recién cuestionada, y partido retroactivo insertado antes del objetivo (puntos 24/25).
- **`renderIntelligence(decision, historyAsc, priorMemory)`** — combina todo: nunca más de 1 principal + 2 secundarios o abstención (punto 14).

`RULES_VERSION` propia, nunca hardcodeada por separado en la Edge Function (se compone junto a la de B/C en `RULES_VERSION_COMBINED`).

### 2.2 Persistencia mínima (handoff §8) — `supabase/migrations/20260923180000_bloque8_fased_intelligence_persistence.sql` (nuevo, NO aplicada — ver §6)

Dos tablas, mismo criterio RLS deny-by-default que `match_level_results`/`ranking_rows` (Bloques 6/7): RLS activado, cero políticas para `authenticated`/`anon`, lectura/escritura exclusiva de `service_role`.

- **`intelligence_player_memory(player_id PK, memory jsonb, rules_version, updated_at)`** — un blob "como de ahora" por jugador (memoria editorial de C + memoria de plantillas de D combinadas), nunca un historial por partido.
- **`intelligence_match_outputs(player_id, match_id, source_fingerprint, rules_version, output jsonb, generated_at, PK(player_id, match_id))`** + índice sobre `match_id` — una fila por (jugador, partido); la clave es compuesta porque "cuatro jugadores pueden recibir Intelligence diferente sobre el mismo encuentro" (handoff §8).

### 2.3 Autoridad server-side (handoff §9) — `supabase/functions/get-match-intelligence/index.ts` (nuevo Edge Function, NO deployada — ver §6)

Mismo patrón exacto que `officialize-match`/`create-or-attach-match`: importa los 4 módulos puros vía side-effect import desde `_shared/` (symlinks reales a `bramulab/*.js`, verificados — nunca copias).

Flujo: (1) JWT verificado con cliente **anon** (`userClient.auth.getUser`) — nunca con service role para autenticar; (2) `callerPlayerId` derivado por `service_role` desde `players.auth_user_id` — **el body nunca acepta un `playerId`**, ni siquiera para depurar; (3) historia real del caller vía `get_player_intelligence_history` (Fase A) llamada con el cliente del usuario, que resuelve `auth.uid()` sola; (4) `targetIndex = historyFull.findIndex(matchId)` + `truncated = historyFull.slice(0, targetIndex + 1)` — trunca por `playedAt` (Fase A ya ordena así), nunca por orden de llegada; si el `matchId` no aparece, `404 match_not_available` sin distinguir "no participa" de "no existe" de "está oculto" (mismo criterio de no-filtración que `get_match_detail`); (5) fingerprint del prefijo truncado — si ya existe una salida guardada con el MISMO fingerprint y la MISMA `RULES_VERSION_COMBINED`, se devuelve tal cual (`regenerated:false`), sin tocar memoria ni elegir otra plantilla (idempotencia real, punto 20/21); (6) si no coincide, se corre A→B→C→D con la memoria actual, se persiste la salida SIEMPRE, y la memoria del jugador se persiste **solo si el partido objetivo es el más reciente de su historia**.

**Por qué ese último guardado es condicional (documentado también en la cabecera del archivo):** la memoria es un blob único "como de ahora". Si un jugador reabre el Resumen de un partido viejo después de que partidos más nuevos ya avanzaron su memoria, recalcularlo con la memoria ACTUAL y guardarla de nuevo regresaría la memoria del jugador a un estado anterior — un bug real de continuidad, no una simplificación aceptable. Este es un bug que yo mismo detecté y corregí antes de escribirlo en el código final (nunca llegó a existir en una versión commiteada). La salida de ese partido viejo sí se calcula y persiste igual, usando la memoria actual como mejor aproximación disponible — ver DECISIÓN ABIERTA §4.2.

**Escritura de service_role, nunca del cliente:** todo `upsert` corre con `serviceClient` (creado con `SUPABASE_SERVICE_ROLE_KEY`); el cliente solo recibe la salida ya renderizada como respuesta de la función autenticada — nunca escribe `intelligence_match_outputs`/`intelligence_player_memory` directamente (puntos 22/23, garantizado por el mismo deny-by-default de §2.2).

### 2.4 Cliente (`bramulab/intelligence-client.js`, nuevo)

`PLIntelligenceClient.getMatchIntelligence(matchId)` — mismo patrón exacto que `match-validation.js`: única bisagra de red del dominio, reutiliza `PLAuth.isConfigured()`/`getClient()`, nunca expone `SUPABASE_SERVICE_ROLE_KEY`, manda como máximo `matchId` — nunca un `playerId` elegido por el navegador.

### 2.5 Integración con la UI existente (handoff §10) — `bramulab/app.js` (modificado)

**REEMPLAZO explícito, en el camino real server-backed:** dentro de `renderAnalysis(f)`, la línea que pintaba `f.intelligence` (legacy) fue reemplazada por `renderIntelligenceCard(f)`, que llama a la Edge Function real y pinta su salida. `f.intelligence`/`S.generateManualIntelligence` **dejan de ser la fuente de BRAMU Intelligence V1** en ese camino. La única referencia legacy que queda intencionalmente intacta es la captura de compartir (`share-capture`, bloque oculto/no usado por ningún flujo activo) — se deja como compatibilidad descriptiva para ese consumidor legacy, nunca se mezcla con el camino real.

Se integró dentro de la sección `#analysis-intelligence`/`#analysis-intelligence-text` **ya existente** — no se creó ninguna pantalla nueva.

- **`buildIntelligenceInsightHTML(insight, isPrincipal)`** — un insight (principal con título, o secundario sin él) a HTML, con "Por qué aparece" como `<details>` nativo plegado por defecto — sin JS propio de expandir/contraer.
- **`buildIntelligenceCardHTML(output)`** — traduce la salida completa (`abstention`/`learningMessage`/`fallbackMessage`/`principal`/`secondary`) a HTML; nunca redacta ni recalcula nada, solo pinta lo que el servidor ya decidió.
- **`renderIntelligenceCard(f)`** (async) — **offline/outbox (punto 18):** si el partido no es `serverBacked` o su `status` es `sync_pending`/`necesita_revision`, muestra un estado breve y honesto ("se completa cuando la carga quede sincronizada") en vez de fingir Intelligence histórica. **Async seguro (punto 19):** mismo criterio exacto que `renderB6Actions` — tras el `await` a la Edge Function, si `analysisCurrent.matchId` ya cambió (el usuario navegó a otro partido mientras se esperaba), la respuesta tardía se descarta sin pintar nada.

`bramulab/styles.css` (modificado): clases nuevas para el insight principal/secundario (separador fino entre ambos), el `<details>` "Por qué aparece" (colapsado, tipografía de nota al pie) y los 3 estados de texto (cargando/no disponible/offline) — reutilizan tokens de color existentes (`--paper`, `--paper-faint`, `--line`), sin paleta nueva. La superficie contenedora (`.intelligence-card`/`.intelligence-text`) ya existía y no se tocó.

### 2.6 Versión (bump único de la ronda)

`04.10-h22` → `04.10-h23` en `bramulab/index.html` (18 ocurrencias) y `bramulab/sw.js` (`CACHE_NAME` + 18 ocurrencias en `CORE_ASSETS`, más la entrada nueva de `intelligence-client.js`) — la "cuatrilla" completa de golpe, como manda la convención del proyecto. `Store.VERSION`/`version.json` (numeración de Nivel BRAMU V04.x) no se tocaron: no son parte de este contrato.

---

## 3. Tests y resultado

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs bramulab/intelligence-editorial.test.mjs bramulab/intelligence-presentation.test.mjs` — **118/118 PASS** (30 Fase A + 39 Fase B + 30 Fase C, las tres con sus H01 agregados y sin ninguna otra regresión, + 19 nuevos de Fase D en `intelligence-presentation.test.mjs`).

Cobertura de los 28 puntos mínimos del handoff §13:

**H01 (4/4):** ✔ todos — ver §1.

**Templates (5–13, 9/9):** ✔ todos, en `intelligence-presentation.test.mjs` — template determinístico sin placeholders/IDs por `insightType` (5/6/7), números exactos al claim (8), nombres del resolver real (9/9b), personal/oficial/mixto no se confunden (10), variantes/templateId deterministas (11), plantilla reciente evitada con alternativa / fallback estable sin alternativa (12/12b), 0 vocabulario prohibido (13).

**UX/estado (14–19, 6/6):** ✔ 14 (1 principal + 0–2 secundarios), 15 (abstención no fuerza insight — reutiliza la misma técnica de doble pasada con cooldown que la prueba de abstención de Fase C), 16 (hitos de aprendizaje una sola vez), 17 ("why" sin IDs/tablas/reasonCodes) — los 4 en `intelligence-presentation.test.mjs`; 18 (pending sync no muestra Intelligence falsa) y 19 (respuesta async vieja no pisa el partido abierto) verificados por revisión de código directa en `renderIntelligenceCard` (`app.js`), mismo criterio exacto que el precedente `renderB6Actions` — **`app.js` no tiene arnés de tests unitarios en este repo (decisión de diseño ya documentada en rondas anteriores)**, así que estos dos puntos se verifican leyendo el guard explícito en el código, no con un test Node.

**Persistencia/backend (20–28, 9/9):** la Edge Function (`supabase/functions/get-match-intelligence/index.ts`, Deno/TS) no tiene arnés de test en este repo — **ninguna** de las otras funciones existentes (`officialize-match`, `create-or-attach-match`, etc.) lo tiene tampoco; es el mismo criterio de todo Bloque 8 hacia atrás. Los puntos se verifican así:
- **20/21** (misma fuente → misma salida; reabrir no cambia template ni memoria) — implementado como comparación `existingOutput.source_fingerprint === fingerprint && existingOutput.rules_version === RULES_VERSION_COMBINED` antes de tocar memoria o plantilla (index.ts líneas 152-156); verificado por revisión de código.
- **22/23** (caller no puede pedir/generar como otro jugador; cliente no puede escribir outputs/memoria) — `callerPlayerId` siempre derivado server-side desde el JWT (nunca del body); ambas tablas son deny-by-default con escritura exclusiva `service_role` (§2.2) — verificado por revisión de código + la migración misma.
- **24/25** (historia retroactiva/fingerprint distinto invalida; corrección/identidad cambia fuente) — la parte que vive en los módulos puros (sensibilidad del fingerprint) está probada directamente: `intelligence-presentation.test.mjs`, pruebas "fingerprint: una corrección de sets…", "…identidad recién cuestionada…", "…partido retroactivo…". La parte de la Edge Function (que un fingerprint distinto efectivamente dispara regeneración) es la misma comparación de 20/21, verificada por revisión de código.
- **26** (historia ordenada por `playedAt`, no `createdAt`) — probado en `intelligence-context.test.mjs` ("buildPersonalHistory ordena por playedAt real aunque las filas lleguen en otro orden", prueba de Fase A, sigue verde).
- **27** (salida de un partido viejo no incluye partidos jugados después) — **test nuevo agregado esta ronda**, `intelligence-presentation.test.mjs` ("27: el corte histórico…"), que reproduce exactamente la lógica de recorte de la Edge Function (`findIndex` + `slice(0, targetIndex+1)`) sobre los módulos puros reales y prueba dos cosas: el recorte de un partido viejo nunca incluye nada con `playedAt` posterior, y agregar un partido nuevo más adelante no cambia ni el fingerprint ni la salida ya calculada de ese partido viejo (aislamiento real, no solo aritmética de índice).
- **28** (0 claims/números/entidades inventados) — heredado íntegro de A/B/C (nunca reabierto) + el propio módulo de presentación nunca agrega datos: solo redacta lo que el `claim`/`evidence` ya traían.

Se corrió además la regresión completa de A+B+C (incluida en el mismo comando arriba): sin cambios de comportamiento fuera de H01.

No se corrió ninguna batería de navegador real (Playwright/etc. no existen en este repo); la verificación de `app.js`/`index.html`/`styles.css`/`sw.js` fue por lectura completa del diff y de los guards de código, siguiendo el precedente ya establecido de que `app.js` no tiene tests unitarios por diseño.

---

## 4. Decisiones abiertas

### 4.1 Heredadas, no reabiertas esta ronda

- **`p_include_hidden=false` por defecto** (Fase A) — sigue sin resolver, sigue sin bloquear nada.
- **Tabla de subpuntaje por `insightType`** (Fase C, DECISIÓN ABIERTA #1) — aceptada como parámetro V1 por la revisión central; no se tocó.

### 4.2 Nueva de esta ronda

**Regeneración de un partido viejo con la memoria actual (§2.3):** cuando se reabre/regenera la salida de un partido que NO es el más reciente de la historia del jugador (por ejemplo, tras una corrección que invalida su fingerprint), el pipeline usa la memoria editorial **actual** del jugador como insumo — no la memoria "como estaba en ese momento del pasado", que no se conserva en ningún lado. Es la mejor aproximación disponible sin construir un historial de snapshots de memoria por partido (explícitamente desaconsejado por el handoff, §8: "elegir la opción más simple"). Se documenta como limitación V1 aceptada, no oculta; la salida de ese partido viejo se persiste igual, solo que la memoria compartida del jugador nunca se pisa hacia atrás (ver §2.3 para el mecanismo exacto que lo evita).

Ninguna de las decisiones abiertas bloqueó el cierre de esta ronda.

---

## 5. Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**. Mis Grupos: **no tocado**. Nivel/Ranking: **no integrados** (fuera de alcance, tal como pidió el handoff).
- Fase A/B/C: intactas salvo H01, cero regresión (99 tests previos + H01 siguen verdes).

---

## 6. Supabase — preparado, NO aplicado

Este entorno no tiene credenciales de Supabase Staging ni autorización para aplicar cambios ahí, igual que todas las rondas anteriores de este Bloque. Quedan preparados y documentados para que ChatGPT central los revise y aplique:

1. **Migración** `supabase/migrations/20260923180000_bloque8_fased_intelligence_persistence.sql` — crea `intelligence_player_memory` e `intelligence_match_outputs`, ambas RLS deny-by-default, `service_role` únicamente.
2. **Edge Function** `supabase/functions/get-match-intelligence/` — nueva, requiere deploy (`supabase functions deploy get-match-intelligence`) tras aplicar la migración anterior (depende de ambas tablas).

Sin estos dos pasos aplicados en Staging, `IntelClient.getMatchIntelligence` devolverá error de red/función inexistente — `renderIntelligenceCard` ya maneja ese caso mostrando el estado "no disponible en este momento", nunca rompe la pantalla de Resumen.

---

## 7. Siguiente paso recomendado

Ninguno automático: el handoff pide explícitamente no avanzar a Fase E. Antes de cualquier próxima fase corresponde: (a) revisión central de este informe + del diff completo, (b) aplicación de la migración y deploy de la Edge Function en Staging por ChatGPT central, (c) una verificación manual real end-to-end (crear un partido, abrir Resumen, ver la tarjeta real) — imposible desde este entorno sin Supabase Staging conectado.
