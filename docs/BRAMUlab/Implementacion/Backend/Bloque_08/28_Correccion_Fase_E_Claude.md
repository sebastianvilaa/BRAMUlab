# Backend Bloque 8 — Corrección de Fase E (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Corrige:** `27_Revision_Central_Fase_E.md` — puntos **E01, E02, E03, E04, E05 y E06**.
**Alcance ejecutado:** únicamente E01–E06. La arquitectura general de Fase E queda aprobada (no se reabrió). A–D no se reauditaron; Nivel BRAMU y Ranking BRAMU no se recalcularon en ningún punto. No se avanzó a Fase F. No se tocó `main`, Production, BRAMUlive ni Mis Grupos. No se aplicó ninguna migración ni se deployó ninguna Edge Function.

La migración de Ranking todavía NO estaba aplicada a Supabase Staging — se modificó el MISMO archivo existente (`20260923190000_bloque8_fasee_ranking_best_position.sql`), sin crear una migración compensatoria, tal como pedía la revisión.

---

## E01 — "Nuevo" de Ranking no equivale a "primera entrada", y el gate de 15 saltaba primera entrada

**Bloqueante.**

**Antes:** `if (insight.isNew) return true;` corría ANTES del gate `total>=15` — una primera entrada en un universo de 12 elegibles se afirmaba como hito. Además, `isNew`/`movement.status==='nuevo'` se traducía directo a "primera entrada", cuando en Bloque 7 esa condición solo significa "sin edición anterior comparable" (puede ser reingreso tras inactividad, cambio de territorio, o ruptura de comparabilidad — nunca necesariamente "nunca estuviste en este ranking").

**Ahora:** el gate `total>=15` es la PRIMERA condición evaluada, sin excepción, para cualquiera de los 5 hitos (incluido el nuevo de banda, E04). "Primera entrada" ya no se afirma solo con `isNew`: exige además `bestPositionBefore === null` explícito (el dato histórico agregado por la migración de Fase E, que dice literalmente "nunca hubo una posición previa elegible en este scope/branch"). Si el campo llega ausente (`undefined`, migración todavía no aplicada) o es un número real (sí hubo posición previa), nunca se afirma primera entrada.

La función se renombró de `isHomeRankingMilestoneMaterial` (boolean) a `classifyHomeRankingMilestone` (devuelve `null` o `{type, editionId, scopeType, scopeKey}`) — necesario también para E02 (memoria de "ya mostrado", que necesita saber QUÉ tipo de hito fue, no solo si hubo alguno).

**Tests (§10, 1-4):** `ranking-home-milestone.test.mjs` — `isNew+total<15→null`; `isNew+total≥15+bestPositionBefore===null→primera_entrada`; `isNew+bestPositionBefore numérico→null`; `bestPositionBefore ausente→null`.

---

## E02 — el mismo hito semanal se repetía en cada visita al Home

**Bloqueante.**

**Decisión V1 de la revisión, implementada tal cual:** el hito material se muestra una sola vez por `usuario + edición + scope + tipo`. Memoria de PRESENTACIÓN pura (nunca autoridad deportiva), en `localStorage` vía `Store` — mismo patrón exacto que el resto de `store.js` (`KEYS.RANKING_MILESTONE_SEEN`, `hasSeenRankingMilestone(userId, milestoneKey)`/`markRankingMilestoneSeen(userId, milestoneKey)`).

- `RK.buildRankingMilestoneKey(milestone)` arma `ranking:<editionId>:<scopeType>:<scopeKey>:<type>`.
- `app.js` marca como visto SOLO después de pintar realmente el texto en TU MOMENTO — nunca antes, y nunca si la RPC falló (el `return` temprano de `!result.ok` ya cumple esto por construcción, sin necesitar un `try/catch` adicional).
- Separado por `userId` real (`homeUser.id`) dentro de una clave compuesta, nunca un objeto anidado — dos cuentas en el mismo navegador nunca comparten el mismo "ya visto".
- Sin sincronización multi-dispositivo (no exigida para V1).

**Tests (§10, 5-7):** `ranking-home-milestone.test.mjs`, con un shim mínimo de `localStorage` en memoria (Node no tiene uno real) — mismo hito/edición se marca y queda visto; una edición nueva genera otra clave y vuelve a estar disponible; dos `userId` distintos nunca comparten el "ya visto".

---

## E03 — "evidencia limitada" podía afirmar falsamente que TU Nivel sigue calibrando

**Bloqueante factual.**

**Antes:** `nivel_evidencia_limitada` siempre decía "tu Nivel BRAMU sigue calibrando", incluso cuando el CALLER ya estaba `CALIBRADO` y la limitación real venía de un tercero (pareja/rival calibrando, o con confianza insuficiente).

**Ahora:** el claim declara explícitamente `callerCalibrating` (derivado del propio `callerRow.formulaState`, nunca de `anyCalibrating`, que mezcla a los cuatro jugadores). La plantilla de Fase D bifurca:

- `callerCalibrating=true` → mensaje cerrado sin cambios: *"Este partido suma evidencia; tu Nivel BRAMU sigue calibrando."*
- `callerCalibrating=false` → *"Los Niveles disponibles todavía no alcanzan para clasificar con confianza la dificultad de este partido."* — nunca le atribuye la calibración al caller.

"Por qué aparece" también distingue ambos casos, explicando que la limitación puede venir de otro participante sin nombrarlo (identidad de terceros no se expone).

**Tests (§10, 8-10):** `intelligence-official.test.mjs` (E03.1/E03.2/E03.3 — tercero calibrando con caller calibrado, caller calibrando, confianza baja de un rival ya `CALIBRADO`) + `intelligence-presentation.test.mjs` (E03/E03b — el copy real bifurca correctamente).

---

## E04 — faltaba el quinto hito cerrado: cambio de banda pública de Nivel

**Bloqueante de alcance.**

**Decisión de implementación V1 de la revisión, seguida tal cual:** se trata como evento semanal de TU MOMENTO (nunca causalidad de un partido), usando snapshots publicados de Ranking — no un claim de Familia H, no pasa por el pipeline de Intelligence.

- `classifyHomeRankingMilestone` evalúa el cambio de banda ANTES que los hitos de puesto (no depende de `isNew`/`delta`): `insight.levelBand !== insight.previousLevelBand` (ambos deben ser números reales — sin ellos, nunca dispara).
- `player-home.js` gana una rama nueva en `buildRankingMomentoClause`, condicionada a `insight.milestoneType==='cambio_de_banda'`: *"Tu Nivel BRAMU pasó de 5.8 a 6.1 en el último corte semanal."* — nunca "categoría", nunca puntos, nunca causalidad de partido. (Formato numérico con punto decimal, `toFixed(1)`, igual criterio que el resto de la app — no la coma del ejemplo en prosa de la fuente.)
- Migración: se agregó `ownLevelBand`/`previousLevelPublic`/`previousLevelBand` a `get_my_ranking_position`, reusando `_bloque7_previous_edition_id` (la MISMA resolución de "edición comparable anterior" que ya usa `_bloque7_compute_movement` — nunca una fórmula paralela). Ver §"Migración" más abajo para el detalle de por qué NO se reutilizó la clave `levelBand` ya existente.

**Tests (§10, 11-13):** `ranking-home-milestone.test.mjs` — cambio de banda real → hito válido; misma banda → sin hito; campos ausentes → nunca dispara; universo <15 bloquea también este caso; el copy nunca usa "categoría"/puntos/causalidad.

---

## E05 — "resultado esperable" existía pero nunca podía influir la salida visible

**Corrección de contrato.**

**Antes:** `nivel_resultado_esperable` (perfil `genericScoreOnly`) estructuralmente nunca superaba el umbral 55, mientras `nivel_variacion` sí podía ganar solo — mostrando el delta sin explicar el contexto favorable previo, exactamente el uso que la fuente define para esta situación.

**Ahora, sin inventar un umbral nuevo de "delta chico":** `nivel_variacion` se enriquece con `wasExpectedResult`/`expectationOwn`, calculados con la MISMA condición ya cerrada de "resultado esperable" (victoria + expectativa ≥65%). Cuando `wasExpectedResult=true`, su plantilla combina el delta exacto con el contexto: *"Tu Nivel BRAMU varió +0.04; los Niveles BRAMU previos marcaban una diferencia favorable para tu pareja."* — el porcentaje exacto solo en "Por qué aparece", nunca en el cuerpo principal. `nivel_resultado_esperable` sigue generándose (auditable, reconstruible), documentado explícitamente como nunca-decisivo-por-diseño — nunca dos historias H visibles a la vez (misma familia, C ya limita a 1 principal + secundarios de familias distintas).

**Tests (§10, 14-15):** `intelligence-official.test.mjs` (E05.1/E05.2 — el claim trae los campos correctos en ambos casos) + `intelligence-presentation.test.mjs` (E05/E05b — el copy visible real combina contexto+delta solo cuando corresponde, porcentaje nunca en el cuerpo).

---

## E06 — rulesVersions mezclaba B con E en el output

**Corrección de contrato, pequeña.**

**Antes:** `b: candidate.rulesVersion || 'bramu_intelligence_v1'` — para un claim de Familia H, `candidate.rulesVersion` es `bramu_intelligence_official_v1`, así que quedaba mal rotulado bajo la clave `b`.

**Ahora:** `b` es SIEMPRE `CL.RULES_VERSION` (la constante real de Fase B, nunca derivada del candidato); se agregó `e: IO.RULES_VERSION`, siempre, para CUALQUIER familia (A–H) — el pipeline combinado ya corre en versión E sin importar de qué familia sea el insight, no hace falta condicionar.

**Tests (§10, 16):** `intelligence-presentation.test.mjs` (E06/E06b) — un insight H persistido conserva `rulesVersions.b===CL.RULES_VERSION` (nunca el de E) y `rulesVersions.e===IO.RULES_VERSION`; un insight A-G también trae `rulesVersions.e`.

---

## Migración — ajustes adicionales (§8 de la revisión)

Se modificó el MISMO archivo (`20260923190000_bloque8_fasee_ranking_best_position.sql`), sin migración compensatoria, todavía NO aplicado:

- **`ownLevelBand`/`previousLevelPublic`/`previousLevelBand`** (nuevos, para E04): la clave `levelBand` YA EXISTENTE en el jsonb de salida resultó ser el ECO del parámetro de filtro `p_level_band` (casi siempre `null` para Home) — NUNCA la banda propia del jugador, aunque `v_own.level_band` ya se seleccionaba internamente sin exponerse. Reusar ese nombre para dos cosas distintas habría sido un contrato ambiguo; se agregaron claves nuevas y sin ambigüedad. `app.js` lee `pos.ownLevelBand` (nunca `pos.levelBand`) para construir `insight.levelBand`.
- El nivel/banda de la edición anterior se obtiene reusando `_bloque7_previous_edition_id` (la misma función que ya usa `_bloque7_compute_movement`, Bloque 7 cerrado) — nunca una fórmula paralela, tal como exigía la revisión.
- **"Solo ediciones publicadas"**: ambas subconsultas nuevas (mejor posición histórica; banda/nivel anterior) filtran explícitamente `ranking_editions.published_at is not null`. Nota honesta: hoy esa columna es `not null default now()` en el esquema real — nunca existe una edición "borrador" — así que el filtro es una defensa explícita y documentada, no un cambio de comportamiento real observable todavía.
- Ninguna subconsulta lee una edición futura (period_start_at estrictamente anterior a la vigente; `_bloque7_previous_edition_id` busca exactamente 7 días atrás).
- **Test 17 (§10, "migración compila sobre esquema real con rollback"):** no verificable en este entorno (sin credenciales de Supabase) — queda para el dry-run con `ROLLBACK` que ChatGPT central ya viene haciendo antes de aplicar cada migración de este bloque (ver `21_Validacion_Tecnica_Fase_D_Staging.md`).

---

## Tests y resultado

Suite completa del repo — **237/237 PASS**, cero regresiones:

| Archivo | Tests |
|---|---:|
| `intelligence-context.test.mjs` | 31 (sin cambios) |
| `intelligence-claims.test.mjs` | 38 (sin cambios) |
| `intelligence-editorial.test.mjs` | 34 (sin cambios — E01-E06 no tocó Fase C) |
| `intelligence-official.test.mjs` | 26 (5 nuevos: E03.1-3, E05.1-2) |
| `intelligence-presentation.test.mjs` | 47 (6 nuevos: E03/E03b, E05/E05b, E06/E06b) |
| `ranking-home-milestone.test.mjs` | 27 (reescrito: E01 1-4, E04 11-13, E02 5-7, más los ya existentes 18-24 adaptados a la nueva API) |
| `match-level-engine.test.mjs` | 30 (sin cambios, Bloque 6) |
| `b6-identity-resolve-sheet.test.mjs` | 4 (sin cambios) |

No se pudo verificar Home en un navegador real esta ronda (mismo motivo que la ronda anterior: el servidor de desarrollo local falla al iniciar por un error de permisos del sistema operativo de este entorno, no relacionado con el código). Verificación vía `node --check` + la suite pura nueva/actualizada + revisión manual del diff — mismo criterio ya establecido para `app.js`/`ranking.js`/`player-home.js`/`store.js` (sin arnés de tests unitarios por diseño para el propio `app.js`).

---

## Archivos

**Modificados:** `bramulab/intelligence-official.js` (+test), `bramulab/intelligence-presentation.js` (+test), `bramulab/ranking.js`, `bramulab/player-home.js`, `bramulab/store.js`, `bramulab/app.js`, `bramulab/ranking-home-milestone.test.mjs` (reescrito), `supabase/migrations/20260923190000_bloque8_fasee_ranking_best_position.sql` (mismo archivo, ampliado).

**No tocados:** `bramulab/intelligence-context.js`, `bramulab/intelligence-claims.js`, `bramulab/intelligence-editorial.js`, `bramulab/level.js`, `bramulab/level-context.js`, `bramulab/match-level-engine.js`, `supabase/functions/get-match-intelligence/index.ts` — ninguna decisión cerrada de A–D, del motor de Nivel ni de la Edge Function se reabrió.

Bump único de bundle `04.10-h24` → `04.10-h25` (`app.js`/`ranking.js`/`player-home.js`/`store.js` se sirven al navegador) — sin micro-bumps adicionales.

---

## Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**. Mis Grupos: **no tocado**.
- Nivel BRAMU: **nunca recalculado**. Ranking BRAMU: **nunca recalculado** — la migración agrega lecturas de solo consulta, ninguna clasificación existente cambia.
- A–D: intactas, cero regresión (159 tests de esos módulos, sin cambios).
- H01/D01-D06 de rondas anteriores: no reabiertos.

---

## Supabase — sigue sin aplicarse

Este entorno sigue sin credenciales de Supabase Staging. Queda preparado y documentado para ChatGPT central:

1. **Migración** `supabase/migrations/20260923190000_bloque8_fasee_ranking_best_position.sql` — ahora agrega `bestPositionBefore` + `ownLevelBand`/`previousLevelPublic`/`previousLevelBand` a `get_my_ranking_position`.
2. **Edge Function** `get-match-intelligence` — sin cambios en esta corrección (E01-E06 no tocó Nivel/la Edge Function); sigue pendiente el redeploy ya solicitado en la ronda anterior.

---

## Siguiente paso recomendado

Según el gate de la propia revisión (§11): revisión central corta de esta corrección → dry-run + aplicación de la migración de Ranking → redeploy de `get-match-intelligence` → QA real con el partido de QA conservado (`4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`, todavía sin tocar) → recién entonces cerrar Fase E → Fase F generativa sigue opcional y no arranca automáticamente.
