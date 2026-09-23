# Backend Bloque 8 — Resultado de Fase E: Integración Nivel + Ranking (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Handoff ejecutado:** `25_Handoff_Fase_E_Claude.md`.
**Alcance ejecutado:** únicamente **E — Integración Nivel + Ranking**. Fases A–D quedan intactas (no se reabrió ninguna decisión cerrada; A/B/C/D solo se EXTENDIERON en los puntos que el propio handoff autoriza explícitamente). No se avanzó a Fase F. No se implementó capa generativa. No se tocó `main`, Production, BRAMUlive ni Mis Grupos. No se aplicó ninguna migración a Supabase.

---

## 1. Nivel BRAMU — Familia H

### 1.1 Módulo nuevo: `bramulab/intelligence-official.js`

Mismo patrón exacto que Fase B (`intelligence-claims.js`): módulo puro, sin DOM/red/SQL, que reproduce el CONTRATO de claim de Fase B (nunca lo importa ni lo reabre — `makeClaim`/`makeDiscarded` son privados a ese módulo, así que este archivo tiene su propia envoltura equivalente).

- `buildLevelSnapshot(resultRow, playerRows)` — traduce 1 a 1 una fila de `match_level_results` + sus filas de `match_level_result_players` (snake_case, tal cual las devuelve Supabase) a un objeto camelCase. `null` si no hay fila (nunca inventa un snapshot vacío).
- `buildLevelClaims(snapshot, match, callerPlayerId)` — las 6 reglas V1 de la fuente, cada una afirma o descarta explícitamente (nunca omite en silencio):
  - `nivel_por_encima_expectativa` — victoria, expectativa propia ≤35%, 4 niveles conocidos, confianza ≥0,60 en los cuatro.
  - `nivel_pareja_por_debajo` — mismo victoria/evidencia, expectativa 36%-44%.
  - `nivel_tres_niveles_pareja_por_debajo` — solo 3 niveles conocidos, expectativa ≤44%: lenguaje acotado, nunca "sorpresa"/"batacazo" (lo garantiza la plantilla, este claim solo entrega el dato).
  - `nivel_evidencia_limitada` — 2 niveles conocidos, o 4 conocidos pero con confianza <0,60 o alguno todavía `CALIBRANDO`: nunca clasifica dificultad.
  - `nivel_resultado_esperable` — expectativa ≥65%: solo explica por qué el Nivel cambió poco, `genericScoreOnly` (nunca festejo principal por sí solo).
  - `nivel_variacion` — el delta oficial exacto del caller (`delta_capped`/`mu_after`), siempre disponible si hay fila propia, sin importar expectativa/resultado.
  - Equilibrado (45%-55%): **nunca genera un claim afirmado** — se registra como descarte explícito (`nivel_pareja_equilibrada`, `discardReasonCodes:['expectativa_equilibrada_sin_insight']`) para que la decisión siga siendo auditable, igual que Fase B.
- `fingerprintFieldsOf(snapshot)` — subconjunto mínimo para el fingerprint de Fase D (nunca el snapshot completo, nunca el estado en vivo).
- `isCallerCalibratingIn(snapshot, callerPlayerId)` — para el mensaje de aprendizaje cerrado de abstención.

**Bug real que encontré y corregí yo mismo antes de escribir la versión final** (documentado en el propio código): una primera versión con ramas paralelas por rango de expectativa dejaba sin cubrir la combinación "4 niveles conocidos, ninguno formalmente `CALIBRANDO`, pero confianza mínima igual por debajo de 0,60" — esa combinación no calzaba en ninguna rama y desaparecía en silencio en vez de caer en `nivel_evidencia_limitada`. La versión final usa una cascada ÚNICA y excluyente por `knownLevelsCount`, sin ese hueco. Detectado por mis propios tests antes de cualquier commit.

**"Nuevo mejor Nivel BRAMU" (§4.8) — DECISIÓN ABIERTA, no implementado:** el backend real (`match_level_results`/`match_level_result_players`) no persiste un historial de picos de Nivel del jugador — solo el valor `mu`/confianza vigentes. Inferirlo desde el estado EN VIVO violaría la regla de nunca usar Nivel actual para un partido antiguo. La fuente autoriza explícitamente esta omisión. "Estabilidad de Nivel" (mismo §4.8) tampoco es un claim separado: `nivel_resultado_esperable` + `nivel_variacion` ya cubren exactamente ese caso sin duplicar la historia (§6.3, diversidad).

### 1.2 Extensión de contrato en Fase C (`intelligence-editorial.js`)

`buildEditorialDecision(historyAsc, callerPlayerId, priorMemory, extraClaims)` — 4to parámetro OPCIONAL (backward-compatible: las 3 llamadas de 3 argumentos existentes siguen funcionando idénticas). `extraClaims` se concatena con los de Fase B ANTES de filtrar afirmados/descartados y participa de scoring/selección/cooldowns con la MISMA lógica — nunca un segundo selector paralelo, exactamente como pedía el handoff §5. `EDITORIAL_PROFILE_BY_INSIGHT_TYPE` gana las 6 entradas de Familia H, en **categoría de prioridad 2** (§6.2: "resultado por encima/debajo de expectativa confiable de Nivel BRAMU", segunda solo después de "hito excepcional") — verificado con un test real: una historia deliberadamente pobre en candidatos de Fase B deja que `nivel_por_encima_expectativa` gane como principal por su propio puntaje, sin ninguna excepción manual.

### 1.3 Extensión de Fase D (`intelligence-presentation.js`)

- **Fingerprint** — `computeHistoryFingerprint` incluye ahora, por partido, `IO.fingerprintFieldsOf(m.officialLevelSnapshot)`: `{hasOfficialSnapshot:false}` explícito sin snapshot, o el subconjunto mínimo con snapshot. Un partido `pending`→`validated` cambia de fingerprint automáticamente; una corrección del resultado oficial (nueva fila `applied`) también.
- **6 templates nuevos**, respetando línea por línea las reglas de copy de la fuente: nunca porcentaje en `body`/`title` (solo en `why`), nunca "sorpresa"/"batacazo"/psicología/técnica.
- **Mensaje de aprendizaje nuevo**: "Este partido suma evidencia; tu Nivel BRAMU sigue calibrando." — se muestra en abstención cuando el Nivel oficial del caller para ESE partido está `CALIBRANDO`, DESPUÉS de los hitos 1/3/5 (que tienen prioridad). A diferencia de esos hitos (una sola vez), este es un ESTADO — puede repetirse mientras el jugador siga calibrando, nunca marca `learningHitosShown`.
  - **Bug real que encontré y corregí antes de escribir el código final**: el mecanismo existente de Fase D determinaba qué hito marcar como "ya mostrado" buscando en `LEARNING_MESSAGES` el texto que coincidiera con el mensaje — mi mensaje nuevo no está en ese mapa, así que esa búsqueda hubiera devuelto `undefined` y terminado escribiendo una clave literal `"undefined": true` dentro de `learningHitosShown`. Lo resolví con una variable explícita (`learningThresholdReached`) que solo se completa cuando el mensaje viene realmente de un hito 1/3/5 — más simple y más robusto que el mecanismo anterior, sin cambiar su comportamiento visible.
- **`runIntelligenceReplay`** calcula `extraClaims = IO.buildLevelClaims(currentMatch.officialLevelSnapshot, currentMatch, callerPlayerId)` para el partido de CADA paso (nunca para el prefijo completo) y los pasa a `ED.buildEditorialDecision`.
- **`buildAuditSnapshot`** agrega `rulesVersions.e` — la auditoría de Familia H sale gratis (los claims/evaluados de Fase E ya viajan dentro de `decision.allClaims`/`decision.evaluated`, que `buildAuditSnapshot` ya recorría genéricamente).

### 1.4 Edge Function (`get-match-intelligence/index.ts`)

Nueva sección: UNA consulta batched a `match_level_results` (filtrada a `effect_status='applied'`, nunca una revertida) por todos los `matchId` de la historia, y UNA consulta batched a `match_level_result_players` por los `result_id` encontrados — nunca una consulta por partido. El snapshot resultante se adjunta como `officialLevelSnapshot` sobre una copia NUEVA de cada partido (`historyWithOfficial`, `Object.assign` — `historyFull`/Fase A nunca se muta). `RULES_VERSION_COMBINED` ahora incluye `IO.RULES_VERSION`. `historyWithOfficial` reemplaza a `historyFull` en el resto del flujo. La respuesta al cliente no cambia de forma: sigue siendo únicamente `output`.

Symlink nuevo: `supabase/functions/_shared/intelligence-official.js` → `../../../bramulab/intelligence-official.js` (mismo patrón que los otros 4).

---

## 2. Ranking BRAMU — hitos materiales en TU MOMENTO

**Decisión de arquitectura, siguiendo el handoff literalmente:** Ranking NO pasa por el pipeline A→B→C→D/la Edge Function. `TU MOMENTO` (Home) es un mecanismo YA EXISTENTE, previo a BRAMU Intelligence (Bloque 7, `Ranking_BRAMU.md` §13.6) — el handoff pide explícitamente "reusar/ajustar ese camino server-backed en vez de crear una fuente paralela". Toda la integración de Ranking vive en `bramulab/ranking.js`/`bramulab/app.js`, nunca en los módulos de Intelligence.

### 2.1 `bramulab/ranking.js` — nueva función pura `isHomeRankingMilestoneMaterial(insight)`

Implementa los 4 (de los 5) hitos materiales cerrados que son detectables con los datos hoy disponibles:

1. **primera entrada** (`isNew`) — siempre material.
2. **entrada al top 10** — `position≤10` y la posición anterior (`position + delta`) era >10.
3. **nueva mejor posición**, mejora ≥3 puestos — requiere `bestPositionBefore` (ver §2.3).
4. **ascenso material** — `delta ≥ máx(3, 5% del universo)`.
- Gate previo: universo con menos de 15 elegibles → nunca material, sin importar el resto.
- **Ninguna caída de posición es un hito** — los 5 casos cerrados de la fuente son todos MEJORAS; esto REFINA, para esta decisión puntual de "qué es un hito dentro de TU MOMENTO", la nota de UX más permisiva de `Ranking_BRAMU.md` §13.6 ("movimiento negativo, tono neutro, siempre visible") — esa nota sigue vigente para la tarjeta territorial completa de Ranking (no se tocó nada ahí); lo que cambia acá es específicamente qué cuenta como insight-worthy. Documentado explícitamente en el código para que quede trazable si alguien quiere revisar esta interpretación.
- El 5to caso cerrado ("cambio de banda pública de Nivel") es un hito de NIVEL, no de Ranking — queda fuera de este detector a propósito.

### 2.2 `bramulab/app.js` — `renderPlayerHome`

Antes de pintar el `insight` de Ranking sobre TU MOMENTO, se filtra con `RK.isHomeRankingMilestoneMaterial(insight)`. Sin hito material, el texto conserva lo que `buildTuMomentoText` ya pintó (forma reciente/compañero/actividad) — nunca se fuerza un mensaje de Ranking solo para llenar espacio, exactamente como ya exigía §13.6. `player-home.js` (el renderizador de texto en sí, `buildRankingMomentoClause`) **no se tocó** — su texto ya era compatible con los 4 hitos (todos se describen con el mismo formato "#pos de total en territory · ↑ delta esta semana" / "Entraste al Ranking de...").

### 2.3 Migración preparada, NO aplicada: `bestPositionBefore`

`supabase/migrations/20260923190000_bloque8_fasee_ranking_best_position.sql` — extiende `get_my_ranking_position` (que `get_home_ranking_insight` ya reenvía como passthrough) con una sola subconsulta nueva: la mejor posición histórica del jugador en el mismo scope/branch, en cualquier edición PUBLICADA anterior a la vigente. Es una copia exacta de la función tal como quedó en Bloque 7, más esa única adición — nunca recalcula la clasificación existente. Preparada y testeada localmente (el detector ya sabe usar el campo cuando existe y lo ignora sin inventar nada cuando no); **no aplicada** — mientras no se aplique, el caso "nueva mejor posición" simplemente nunca dispara.

### 2.4 DECISIÓN ABIERTA — persistencia anti-repetición del mismo hito

El handoff (§9) autoriza explícitamente dejar esto abierto "solo si realmente bloquea mostrarlo una vez en Home". `TU MOMENTO` HOY (desde Bloque 7, sin cambios de esta ronda) no tiene NINGÚN mecanismo de memoria entre visitas para NINGUNO de sus candidatos (forma reciente, compañero frecuente, actividad del mes, Ranking) — se recalcula fresco en cada render. Agregar persistencia solo para el candidato de Ranking sería una arquitectura nueva y desproporcionada (`no sobrearquitecturar`, mismo handoff) para un comportamiento que ya es consistente con el resto del mecanismo: un hito material sigue siendo cierto durante toda la semana de la edición, y mostrarlo en cada visita durante esa semana es el mismo criterio que ya usa cualquier otro candidato de TU MOMENTO. No implementado, documentado, no bloqueante.

---

## 3. Archivos

**Nuevos:**
- `bramulab/intelligence-official.js` (+ `bramulab/intelligence-official.test.mjs`)
- `bramulab/ranking-home-milestone.test.mjs`
- `supabase/functions/_shared/intelligence-official.js` (symlink)
- `supabase/migrations/20260923190000_bloque8_fasee_ranking_best_position.sql` (preparada, no aplicada)

**Modificados:** `bramulab/intelligence-editorial.js` (+test), `bramulab/intelligence-presentation.js` (+test), `bramulab/ranking.js`, `bramulab/app.js`, `supabase/functions/get-match-intelligence/index.ts`, `bramulab/index.html`/`bramulab/sw.js` (bump único `04.10-h23`→`04.10-h24`, `app.js`/`ranking.js` sí se sirven al navegador).

**No tocados:** `bramulab/intelligence-context.js`, `bramulab/intelligence-claims.js`, `bramulab/player-home.js`, `bramulab/level.js`, `bramulab/level-context.js`, `bramulab/match-level-engine.js` — ninguna decisión cerrada de A–D ni del motor de Nivel/Ranking se reabrió.

---

## 4. Tests y resultado

Suite completa del repo, archivo por archivo — **214/214 PASS**, cero regresiones:

| Archivo | Tests |
|---|---:|
| `intelligence-context.test.mjs` | 31 |
| `intelligence-claims.test.mjs` | 38 |
| `intelligence-editorial.test.mjs` | 34 (3 nuevos: E.1/E.2/E.3) |
| `intelligence-official.test.mjs` | 21 (nuevo) |
| `intelligence-presentation.test.mjs` | 41 (5 nuevos: puntos 11-15 de Nivel) |
| `ranking-home-milestone.test.mjs` | 15 (nuevo) |
| `match-level-engine.test.mjs` | 30 (sin cambios, Bloque 6) |
| `b6-identity-resolve-sheet.test.mjs` | 4 (sin cambios) |

Cobertura de los 27 puntos mínimos del handoff §12:

**Nivel (1-15):** los 10 primeros + el 15 en `intelligence-official.test.mjs` (reglas de Familia H en aislamiento); 11-14 en `intelligence-presentation.test.mjs` (fingerprint/checkpoint/audit integrados con el replay real).

**Ranking (16-27):** 16-21 y 23 en `ranking-home-milestone.test.mjs` (materialidad pura); 22 y 24 verificados sobre el texto real de `buildTuMomentoText` (lenguaje no causal, "Nuevo" nunca inventa un delta); 25 (anti-repetición) documentado como DECISIÓN ABIERTA no implementada (§2.4); 26 (0 puntos propios) es estructural — Ranking nunca expone ni computa un campo de puntos, nada que testear; 27 (0 claims/entidades inventadas) se sostiene por construcción — el detector nunca fabrica un número, solo clasifica lo que la RPC ya devuelve.

No se pudo verificar Home en un navegador real esta ronda: el servidor de desarrollo local (`.claude/dev-server.py`) falló al iniciar por un error de permisos del sistema operativo de este entorno (`Operation not permitted`), no relacionado con el código de esta ronda. La verificación de `app.js`/`ranking.js` se apoyó en: `node --check` (sintaxis), la suite de tests puros nueva (`ranking-home-milestone.test.mjs`, que ejercita `buildTuMomentoText` real con los `insight` exactos que produce el detector) y revisión manual del diff — mismo criterio ya establecido en el proyecto para cambios de `app.js` (sin arnés de tests unitarios por diseño).

---

## 5. Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**. Mis Grupos: **no tocado**.
- Nivel BRAMU: **nunca recalculado** — solo se leen `match_level_results`/`match_level_result_players` ya persistidos (`effect_status='applied'`).
- Ranking BRAMU: **nunca recalculado** — solo se lee `get_my_ranking_position`/`get_home_ranking_insight` ya existentes; la migración nueva agrega una lectura, no cambia ninguna clasificación.
- A–D: intactas, cero regresión (159 tests previos de esos 4 módulos, todos sin cambios de comportamiento salvo las extensiones de contrato explícitamente autorizadas).

---

## 6. Supabase — preparado, NO aplicado

Este entorno sigue sin credenciales de Supabase Staging. Queda preparado y documentado para ChatGPT central:

1. **Migración** `supabase/migrations/20260923190000_bloque8_fasee_ranking_best_position.sql` — agrega `bestPositionBefore` a `get_my_ranking_position`.
2. **Edge Function** `get-match-intelligence` — ahora también lee `match_level_results`/`match_level_result_players` (RLS deny-by-default, `service_role` únicamente — nunca se pide una política nueva de cliente).

Sin aplicar ninguna de las dos, el comportamiento es honesto por defecto: sin la Edge Function redeployada, Familia H simplemente nunca aparece (0 claims H, exactamente como si no hubiera snapshot); sin la migración de Ranking, "nueva mejor posición" nunca dispara. Ningún camino rompe ni inventa datos mientras tanto.

---

## 7. Siguiente paso recomendado

Según el propio handoff: no avanzar a Fase F automáticamente. Antes de esta próxima fase corresponde: (1) revisión central de este informe + diff completo; (2) aplicación de las dos piezas de Supabase (migración de Ranking + redeploy de la Edge Function) por ChatGPT central; (3) una QA real de navegador para Familia H — usando el MISMO partido de QA de Fase D (`4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`, todavía `pending_validation`, conservado sin tocar esta ronda), llevándolo por el flujo real de validación para observar la transición completa: Intelligence personal (ya probado) → validación real → snapshot oficial de Nivel → regeneración determinística del mismo partido con fingerprint de Fase E → aparición u abstención honesta de Familia H, exactamente como pedía el handoff §11 — nunca fabricando el resultado oficial por SQL.
