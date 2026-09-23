# Backend Bloque 8 — Resultado de Fase C: Relevancia y memoria editorial (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `b5bb890` (`10_Handoff_Fase_C_Claude.md`, tras Fase A y Fase B cerradas en Staging).
**Alcance ejecutado:** únicamente **C — Relevancia y memoria editorial**. No se avanzó a D. No se tocó UI, plantillas finales, Nivel, Ranking, capa generativa, ni Fase A/B. No se tocó Supabase (ver §5).

---

## 1. Qué se implementó

Un módulo nuevo, `bramulab/intelligence-editorial.js` (IIFE, `global.PLIntelligenceEditorial`, simlinkeado en `supabase/functions/_shared/`), construido por **composición** sobre `PLIntelligenceClaims` (Fase B, cerrada) — nunca la reabre, nunca recalcula evidencia.

`buildEditorialDecision(historyAsc, callerPlayerId, priorMemory)` devuelve, para el partido puntual evaluado (el último de `historyAsc`, mismo contrato de Fase A/B):

- `evaluated`: TODOS los candidatos afirmados por Fase B, cada uno con su desglose de puntaje completo (`dimensions`, `rawScore`, `penalties`, `finalScore`) o su motivo de exclusión por cooldown — nunca omitido en silencio;
- `principal` / `secondary[]` (hasta 2);
- `abstention` (booleano explícito, nunca un principal inventado);
- `memoryUpdate`: la memoria editorial propuesta, lista para persistir (ver §5);
- `rulesVersion`.

### 1.1 Puntaje (§6.1, pesos y penalizaciones CERRADOS por la fuente)

Implementado literalmente: 25/20/15/20/10/10 = 100; penalizaciones −30/−20/−15/−10; umbral de publicación 55/100.

**DECISIÓN ABIERTA #1 (marcada explícitamente, no oculta — handoff §6):** la fuente fija los pesos MÁXIMOS de cada dimensión pero no da una fórmula exhaustiva de cuánto vale cada subtipo de claim dentro de cada dimensión. Este módulo resuelve eso con una única tabla explícita y versionada, `EDITORIAL_PROFILE_BY_INSIGHT_TYPE`, que clasifica cada `insightType` en la categoría de prioridad de §6.2 más 2 atributos (`exceptionality`, `representsChange`) — reutilizando siempre datos ya cerrados de Fase A/B (`confidenceTier`, `officialScope`, presencia de una entidad relacional) para todo lo derivable sin autoría nueva. Es un parámetro de Fase C, no un número tomado literalmente de `BRAMU_Intelligence.md`. No bloquea la fase (el handoff autoriza explícitamente parametrizar), pero su calibración exacta queda abierta a revisión/ajuste una vez que exista uso real. Un solo criterio de esa tabla es reseñable: los balances estables (`companero_balance`, `rival_balance`, `pareja_rival_balance`, `cruce_exacto_balance`, `forma_reciente`, `contexto_dificultad_previa_rival`, `balance_perdiendo_primer_set`) se clasificaron con excepcionalidad **baja** — son hechos que existen independientemente de este partido, no "quiebres/hitos" (la pregunta literal de esa dimensión, §6.1) — mientras que los "primer encuentro"/"primer triunfo tras derrotas"/récords sí la llevan alta. Esta distinción también es lo que hace posible la abstención real (ver prueba #14): sin ella, cualquier relación ya establecida (compañero + 2 rivales, presentes en TODO partido) puntuaría por encima de 55 de forma casi incondicional, y "abstención" nunca sería alcanzable.

`confianza de evidencia` (20) reutiliza directamente `confidenceTier`/`officialScope` de Fase B. `especificidad relacional` (15) se deriva de si `claim.claim` trae una entidad relacional (`companionPlayerId`/`rivalPlayerId`/`scopeKey`). `novedad editorial` (10) reutiliza las MISMAS ventanas ya cerradas por la fuente (2 y 4 partidos) en vez de inventar una tercera.

### 1.2 Prioridad ante empate (§6.2)

La misma tabla `EDITORIAL_PROFILE_BY_INSIGHT_TYPE` aporta `priorityRank` (1–8, las 8 categorías literales de §6.2). Empate exacto de puntaje → `priorityRank` → ID estable (`insightType|comparisonScope|evidenceMatchIds` ordenados) — nunca azar. Verificado con un empate real (récord de racha vs. hito de victorias, prueba #11).

### 1.3 Deduplicación semántica (§7, handoff §7)

`semanticKeyOf` agrupa por HISTORIA, nunca por texto ni por el ID técnico de desempate. Cubre los 3 ejemplos literales del handoff:

1. **"primer partido con X" + "compañero nuevo X"** (y su análogo "primer partido de la historia" + "primera victoria registrada" en el debut) → mismo `semanticKey`.
2. **Racha + forma reciente cuando dicen lo mismo** → **DECISIÓN ABIERTA #2**: la fuente no fija un umbral numérico de "cuándo se solapan lo suficiente". Se implementó una condición estructural verificable (no oculta): si la longitud de la racha vigente cubre por completo la ventana de 5 de `forma_reciente` (`racha.length >= ventana.sampleSize`), comparten `semanticKey`; si la racha es más corta, quedan como historias distintas (mismo criterio que §5.3 usa para separar ambos conceptos). Probado en ambos sentidos (pruebas 5b/5c).
3. **Múltiples scopes de rival respondiendo la misma pregunta de debut** → los `_primer_enfrentamiento` de rival individual/pareja rival/cruce exacto de UN MISMO partido comparten `semanticKey` (agrupados por `dataAsOf`, el propio partido) — los `_balance` de esos mismos 3 alcances SIGUEN separados, porque ahí sí son historias genuinamente distintas (`BRAMU_Intelligence.md` §5.5: "no deben mezclarse").

Operacionalmente, la penalización −20 de §6.1 ("otro candidato SELECCIONADO ya cuenta la misma historia") se implementó como exclusión dura durante la selección (nunca se elige un segundo candidato del mismo `semanticKey` que uno ya elegido) en vez de una resta de puntos — es estrictamente más correcto para un contrato binario "aparece o no aparece": una resta parcial podría dejar una historia redundante todavía por encima de 55.

### 1.4 Cooldowns / memoria editorial (§7.3)

- **Racha, "no en cada extensión":** la variante simple (`racha_de_victorias`/`racha_de_derrotas`) solo es candidata exactamente en longitud 3; extensiones posteriores sin récord quedan excluidas (`racha_no_en_cada_extension`) — récord/empate/corte siguen siendo candidatos propios, sin gating adicional (probado en la prueba #10).
- **Mismo hecho relacional, sin cambio antes de 4 partidos:** exclusión dura comparando la firma de valor actual (`wins-losses`, etc.) contra la última mostrada en memoria (pruebas #7/#8).
- **Mismo hito, una sola aparición:** memoria permanente (`shownMilestoneKeys`) — defensa explícita en profundidad, ya que Fase B hace estructuralmente casi imposible que un hito genuino se repita por sí solo (probado directamente contra la función en la prueba #9).
- **−10 misma plantilla:** el camino de código existe (`candidate.templateId`) pero nunca se dispara en esta ronda — Fase D todavía no asigna `templateId` (handoff §8).

### 1.5 Forma reciente — sin inventar "mejoró/empeoró" (handoff §6)

`forma_reciente` se puntúa y puede seleccionarse como cualquier otro candidato factual, pero su `claim` nunca se toca: sigue siendo exactamente `{current, previousWindow}` tal cual lo entrega Fase B, sin ningún campo de juicio agregado (`mejoro`/`empeoro`/`esMaterial`). Verificado byte a byte contra la salida de Fase B (prueba #15).

---

## 2. Persistencia (handoff §5)

**No se creó ninguna tabla ni RPC.** La memoria editorial (`emptyMemory()`/`memoryUpdate`) es un objeto plano JSON-serializable, listo para persistir, pero sin consumidor real todavía (no existe Fase D). Crear esquema ahora hubiera sido "por anticipación", explícitamente desaconsejado por el handoff §5. Cuando Fase D necesite guardar/leer memoria entre partidos, el contrato ya está definido y documentado en este archivo — la migración correspondiente puede escribirse en ese momento con el consumidor real delante.

---

## 3. Archivos

**Nuevos (3):**

- `bramulab/intelligence-editorial.js`
- `bramulab/intelligence-editorial.test.mjs`
- `supabase/functions/_shared/intelligence-editorial.js` (symlink)

**Modificados:** ninguno. `intelligence-context.js`, `intelligence-claims.js` (Fase A/B) y sus tests quedan exactamente como los cerró `09_Validacion_Central_Fase_B.md`.

---

## 4. Tests y resultado

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs bramulab/intelligence-editorial.test.mjs` — **83/83 PASS** (29 Fase A + 35 Fase B, ambas sin cambios, + 19 nuevos de Fase C).

Cobertura de las 16 pruebas mínimas del handoff §9 — todas presentes y verificadas explícitamente, más 3 pruebas adicionales (carga de módulo, desglose de puntaje reconstruible, y el ejemplo de dedup racha+forma reciente en ambos sentidos):

1. candidato bajo 55 nunca seleccionado — ✔
2. candidato fuerte (debut) → principal, determinístico — ✔
3/4. máximo 1+2, familias y semanticKeys distintas — ✔
5. duplicado "primer partido"/"compañero nuevo" — ✔ (+5b/5c: racha↔forma reciente)
6. −15 misma familia principal últimos 2 — ✔
7/8. hecho relacional: cooldown sin cambio / reaparece con cambio — ✔
9. mismo hito nunca vuelve — ✔
10. racha no en cada extensión — ✔
11. empate resuelto por prioridad + ID estable, nunca azar — ✔
12. memoria vacía vs. previa, cada una determinística — ✔
13. ningún descartado por B revive en C — ✔
14. sin candidatos >55 → abstención real (no inventada) — ✔
15. forma reciente nunca gana semántica de mejora/empeora — ✔
16. 0 claims/números/entidades nuevos — ✔

No se corrió la batería de navegador: esta ronda no modificó ningún archivo que esa batería cubra, y Fase C todavía no tiene UI.

---

## 5. Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**.
- Supabase: **nada aplicado, ninguna migración nueva** (ver §2 — decisión explícita de no crear persistencia por anticipación).
- Fase A y Fase B: **intactas**, cero regresión (29+35 tests sin cambios).

---

## 6. DECISIONES ABIERTAS

1. **Fórmula exacta de subpuntaje por `insightType`** (§1.1) — parametrizada, documentada, no bloqueante; candidata a recalibración con datos reales de uso.
2. **Umbral numérico de solapamiento racha/forma reciente** (§1.3, ejemplo 2) — condición estructural (longitud de racha ≥ tamaño de ventana) elegida por ausencia de un número explícito en la fuente; documentada y con prueba en ambos sentidos.
3. Se **preserva sin resolver**, y sin bloquear esta ronda, la decisión heredada de Fase A/B: ¿un partido oculto por el usuario puede alimentar BRAMU Intelligence personal? (`p_include_hidden` sigue en `false` por defecto; esta fase no la tocó ni la resolvió implícitamente).

Ninguna de las 3 impidió cerrar Fase C: las dos primeras son parametrizaciones explícitas y auditables (exactamente lo que el handoff autoriza), la tercera es una decisión de producto que sigue esperando a Sebastián/ChatGPT central sin bloquear nada más.

---

## 7. Siguiente paso recomendado

**D — Plantillas y UX** (`Implementacion.md` §10), consumiendo `PLIntelligenceEditorial.buildEditorialDecision` sin reabrir A/B/C salvo regresión concreta: asignación de `templateId`, redacción determinística por `insightType`/familia, estados de aprendizaje/abstención visibles, "Por qué aparece". Recién ahí correspondería revisar si la DECISIÓN ABIERTA #1 necesita recalibrarse con casos reales. No avanzar automáticamente a D.
