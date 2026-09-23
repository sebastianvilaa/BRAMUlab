# Backend Bloque 8 — Corrección de Fase D (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Corrige:** `17_Revision_Central_Fase_D.md` — puntos **D01, D02, D03, D04 y D05** (bloqueantes/ajustes antes de aplicar Supabase Staging).
**Alcance ejecutado:** únicamente D01–D05. H01 quedó **aprobado** por la revisión y no se reabrió. No se avanzó a Fase E. No se tocó Nivel, Ranking, capa generativa, Mis Grupos, `main`, Production ni BRAMUlive. No se aplicó ninguna migración ni se deployó la Edge Function a Supabase Staging.

Todos los cambios viven en 4 archivos: `bramulab/intelligence-presentation.js` (+ su test), la migración de persistencia (todavía no aplicada, así que se **reemplazó su diseño directamente** en vez de agregar una migración compensatoria — autorizado explícitamente para esta corrección) y la Edge Function `get-match-intelligence`. Cero cambios en `intelligence-context.js`/`intelligence-claims.js`/`intelligence-editorial.js` — nada de A/B/C se reabrió. Cero cambios en `app.js`/`index.html`/`styles.css`/`sw.js`: ninguno de los 4 módulos puros de Intelligence (A/B/C/D) se carga en el navegador (solo el cliente de red `intelligence-client.js`, sin cambios), así que esta corrección no tiene nada observable en el frontend y **no requiere bump de versión**.

---

## D01 — memoria editorial dependiente del orden de apertura, no de la cronología real

**Bloqueante — el más importante de esta corrección.**

**Antes:** una sola fila `intelligence_player_memory` (memoria "actual" del jugador) se reutilizaba para generar cualquier partido solicitado, sin importar su posición cronológica. Dos bugs reales de eso: (A) un partido viejo podía recibir memoria acumulada de partidos posteriores si esos ya se habían generado antes; (B) corregir el partido MÁS RECIENTE podía autopenalizarlo, porque la "memoria actual" usada para regenerarlo ya lo incluía a él mismo (un hito de una sola aparición que él mismo mostró podía figurar como "ya mostrado" y desaparecer).

**Ahora — reemplazo directo del diseño, no una migración compensatoria (la anterior nunca se aplicó a Supabase):**

- **`intelligence_player_memory` se eliminó por completo** de la migración `20260923180000_bloque8_fased_intelligence_persistence.sql`. Solo queda `intelligence_match_outputs`, ahora con una columna nueva **`memory_after jsonb not null`**: el checkpoint de memoria editorial+plantillas combinada inmediatamente DESPUÉS de ese partido. `output` sigue siendo la salida visible, pero ahora **nunca incluye `memoryUpdate`** (ver `publicOutputOf` más abajo) — la memoria interna vive exclusivamente en su propia columna, nunca duplicada ni expuesta al cliente.
- **Nueva función pura, `PLIntelligencePresentation.runIntelligenceReplay(historyAsc, targetIndex, callerPlayerId, existingCheckpoints, rulesVersion)`** (`bramulab/intelligence-presentation.js`): camina cronológicamente desde el primer partido de la historia hasta el partido objetivo. En cada paso calcula el fingerprint del prefijo; si existe un checkpoint con el MISMO fingerprint y la MISMA `rulesVersion`, lo reutiliza tal cual; si no, regenera ese partido usando **la memoria del checkpoint INMEDIATAMENTE anterior** (nunca la de un partido posterior, nunca la de sí mismo) y sigue caminando con la memoria recién producida.
- Esto garantiza, **por construcción y no por casos especiales**:
  - un partido viejo nunca puede recibir memoria del futuro (el bucle nunca camina más allá del objetivo);
  - corregir el partido más reciente nunca lo penaliza contra sí mismo (su memoria previa es siempre la de partido−1);
  - una carga retroactiva o una corrección en cualquier punto invalida automáticamente el fingerprint de TODOS los prefijos posteriores que la incluyan, porque el fingerprint de cada paso se calcula sobre el PREFIJO completo — sin lógica de cascada separada (ver D02 más abajo, la extensión del fingerprint es lo que hace esto watertight);
  - un cambio de `rulesVersion` invalida un checkpoint aunque su fingerprint de datos no cambie.
- **La Edge Function `get-match-intelligence`** se reescribió para usar exactamente este flujo: (1) historia completa vía `get_player_intelligence_history`; (2) localizar el partido objetivo; (3) **UNA sola consulta** a `intelligence_match_outputs` trayendo TODOS los checkpoints existentes del jugador (nunca una consulta por partido); (4) `runIntelligenceReplay`; (5) `upsert` en batch únicamente de los pasos con `reused:false`; (6) responder con `steps[targetIndex].output`.

**Tests (obligatorios, todos en `intelligence-presentation.test.mjs`):**

1. **D01.1** — el checkpoint de un partido viejo es idéntico (fingerprint, `output`, `memoryAfter`) calculado con `targetIndex` corto o con `targetIndex` largo (caminando mucho más allá de él) — prueba directa de "nunca recibe memoria del futuro".
2. **D01.2** — regenerar el partido más reciente tras una corrección (mismo resultado, distinto score) conserva su propio hito de una sola aparición, en vez de perderlo por encontrarse "ya mostrado contra sí mismo".
3. **D01.3** — insertar un partido retroactivo antes de todos los existentes hace que los 4 partidos (el nuevo + los 3 viejos) queden `reused:false` — ningún checkpoint viejo sobrevive stale.
4. **8 (reutilización)** — con historia sin cambios, una segunda pasada de `runIntelligenceReplay` reutiliza los 4 checkpoints (`reused:true`, mismo fingerprint, mismo `output`) y confirma que `output` nunca incluye `memoryUpdate`.

---

## D02 — el fingerprint no incluía identidad de participantes ni formato/scoring/hora

**Bloqueante.**

**Antes:** `computeHistoryFingerprint` incluía `matchId/playedAt/status/officialEligible/hasOpenIdentityIssue/hidden/winnerTeam/sets` — nunca identidad real de participantes, formato, sistema de scoring ni conocimiento de hora. Una sustitución real de participante que dejara `hasOpenIdentityIssue=false` antes y después (por ejemplo, una identidad que termina resuelta señalando a una persona distinta de la registrada originalmente) podía conservar el mismo fingerprint — la fuente exige exactamente lo contrario ("identidad resuelta/cambiada que cambia la fuente produce fingerprint distinto").

**Ahora:** se agregaron, por cada partido del prefijo: `timeKnown` (equivalente local exacto de `playedAtTimeKnown`, que ya llega como tal desde `PLMatchSync.translateServerMatchToLocalShape`), `formatId`, `scoringSystem`, y la composición ESTABLE de participantes (`{team, userId}` por cada slot, en el mismo orden ya estable por team+position que entrega Fase A/Bloque 5 — nunca se reordena en este módulo). `createdAt` sigue explícitamente fuera.

**Tests:**

4. **D02.1** — reemplazar al compañero real por otra persona (`hasOpenIdentityIssue=false` en ambos casos) cambia el fingerprint.
5. **D02.2** — cambiar el `formatId` de un partido (mismo resultado, mismos jugadores) cambia el fingerprint.

Las 4 pruebas de fingerprint ya existentes de la ronda anterior (misma historia → mismo fingerprint; corrección de sets; identidad cuestionada; carga retroactiva) siguen verdes sin modificación — la extensión de campos nunca les quitó sensibilidad, solo se la agregó a casos nuevos.

---

## D03 — la memoria propia de D se perdía al atravesar Fase C

**Bloqueante.**

**Antes:** la Edge Function llamaba `PR.renderIntelligence(decision, truncated, decision.memoryUpdate)` — le pasaba a D el `memoryUpdate` que C acaba de construir (un objeto NUEVO con solo los campos que C declara: `recentMatches/shownSemanticKeys/shownMilestoneKeys/rachaSimpleYaMostrada/recentTemplateIds`), en vez de la memoria previa REAL. `learningHitosShown` (un campo que solo D conoce) nunca sobrevivía de un partido a otro por ese camino — un hito de aprendizaje ya mostrado podía volver a dispararse.

**Ahora, en dos niveles:**

1. **La causa raíz ya no puede repetirse:** `runIntelligenceReplay` es ahora el ÚNICO punto que decide qué memoria es "la anterior", y le pasa exactamente lo mismo (`memoryBefore`) tanto a `ED.buildEditorialDecision` como a `PR.renderIntelligence` — nunca dos valores distintos, nunca `decision.memoryUpdate` en su lugar.
2. **Defensa en profundidad dentro de `renderIntelligence` mismo:** la memoria final ahora se construye `Object.assign({}, memory, decision.memoryUpdate, {...campos propios de D...})` — antes partía SOLO de `decision.memoryUpdate`. Cualquier campo propio de D presente en `memory` (la memoria anterior real) sobrevive por defecto aunque C nunca lo reenvíe, sin que C tenga que conocer los campos de D uno por uno — D solo declara explícitamente los que él mismo actualiza (`recentTemplateIds`, `learningHitosShown`).
3. Nueva función `PR.emptyMemory()` — memoria combinada C+D vacía, compuesta explícitamente sobre `ED.emptyMemory()` (nunca un literal propio duplicado), usada como el checkpoint "cero" antes del primer partido de cualquier jugador.

**Tests:**

6. **D03.1** — se construye `decision` con `ED.buildEditorialDecision` a partir de una memoria previa que ya tiene `learningHitosShown` poblado; se confirma explícitamente que `decision.memoryUpdate` (la salida real de C, sin ningún cambio en C) **no** declara ese campo (`hasOwnProperty` false); y se confirma que `renderIntelligence` igual lo conserva intacto en su memoria final.
7. **D03.2** — a través de un `runIntelligenceReplay` real de 6 partidos, cada `recentTemplateIds` de un paso está contenido (más lo nuevo de ese paso) en el `recentTemplateIds` del paso siguiente — nunca se resetea de un partido a otro.

---

## D04 — copy de "sets corridos" ahora aclara "en games"

**Ajuste de UX.** El número que se mostraba (`12-5`, por ejemplo) es el total agregado de games de todo el partido, no el marcador de un set — podía leerse como tal. Texto nuevo: *"El resultado se resolvió en dos sets, con 12-5 en games."* (antes: *"...en dos sets, 12-5."*). Los números siguen derivándose exactamente del claim (`gamesWonByWinner`/`gamesTotal`), nunca inventados.

**Test 9 (D04):** construye un claim sintético (`gamesWonByWinner:12, gamesTotal:17`) y confirma que el body contiene tanto "en games" como "12-5".

---

## D05 — "Por qué aparece" de forma reciente en la primera lectura (ventana previa incompleta)

**Ajuste de UX.** Con exactamente 5 partidos decididos (la primera vez que `forma_reciente` es elegible, `RECENT_FORM_MIN_SAMPLE=5`), la ventana previa (`previousWindow.sampleSize`) da 4 — nunca menos, según la aritmética real de `buildRecentFormClaim` — y el texto anterior decía "comparada con los 4 inmediatamente anteriores", editorialmente engañoso como si fuera una comparación equivalente a la ventana móvil real de 5.

**Ahora:** si `previousWindow.sampleSize < 5`, el texto dice que es la primera lectura posible, sin mencionar una ventana previa incompleta; si `previousWindow.sampleSize === 5` (a partir del siguiente partido), mantiene la redacción original mencionando la ventana móvil anterior completa. Nunca se introdujo "mejoró/empeoró" (sigue fuera de esta fase, sin umbral material definido).

**Test 9 (D05):** confirma ambas ramas con claims sintéticos (`previousWindow.sampleSize` en 4 y en 5).

---

## Tests y resultado

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs bramulab/intelligence-editorial.test.mjs bramulab/intelligence-presentation.test.mjs` — **128/128 PASS** (99 de A+B+C+H01, sin cambios, + 29 de D: 19 de la ronda anterior + 10 nuevos de esta corrección).

Los 9 puntos focales pedidos explícitamente quedan cubiertos:

1. partido viejo nunca recibe memoria del futuro — **D01.1** ✔
2. corrección del último partido no se penaliza contra sí mismo — **D01.2** ✔
3. carga retroactiva invalida los checkpoints posteriores — **D01.3** ✔
4. cambio real de participante cambia fingerprint con `hasOpenIdentityIssue` falso antes/después — **D02.1** ✔
5. cambio de formato relevante cambia fingerprint — **D02.2** ✔
6. `learningHitosShown` sobrevive entre partidos — **D03.1** ✔
7. `recentTemplateIds` conserva continuidad cronológica — **D03.2** ✔
8. output válido se reutiliza sin regenerar — **8 (D01)** ✔
9. D04 y D05 producen el copy correcto — **9 (D04)** / **9 (D05)** ✔

No se corrió batería de frontend: ningún archivo que esa batería cubra (`app.js`/`index.html`/`styles.css`/`sw.js`) fue tocado en esta corrección (ver nota de alcance al inicio).

---

## Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**. Mis Grupos: **no tocado**. Nivel/Ranking: **no integrados**.
- H01: **no reabierto** (aprobado por la revisión central; ningún cambio de esta corrección lo afecta — A/B/C permanecen sin tocar).
- Fase A/B/C: intactas, cero regresión (99 tests sin cambios).

---

## Supabase — sigue sin aplicarse

Igual que en la ronda anterior: este entorno no tiene credenciales de Supabase Staging. Quedan preparados y documentados para que ChatGPT central los revise y aplique, ahora con el diseño corregido:

1. **Migración** `supabase/migrations/20260923180000_bloque8_fased_intelligence_persistence.sql` — **reemplazada en el lugar** (mismo archivo, mismo timestamp, nunca aplicada todavía): ya NO crea `intelligence_player_memory`; crea únicamente `intelligence_match_outputs` con la columna nueva `memory_after`.
2. **Edge Function** `supabase/functions/get-match-intelligence/` — reescrita para el flujo de checkpoints/replay. Requiere deploy tras aplicar la migración anterior.

Sin estos dos pasos aplicados, el comportamiento de fallback ya documentado en la ronda anterior sigue vigente (`renderIntelligenceCard` muestra "no disponible en este momento" sin romper el Resumen).

---

## Siguiente paso recomendado

Ninguno automático. Según `17_Revision_Central_Fase_D.md` §8: revisión central de esta corrección → recién entonces ChatGPT central aplica la migración y deploya la Edge Function en Supabase Staging → verificación real end-to-end → QA visual/manual del Resumen en Preview → cerrar D → recién después preparar E.
