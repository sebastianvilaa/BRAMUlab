# Backend Bloque 8 — Corrección de Fase C (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Corrige:** `12_Revision_Central_Fase_C.md` — puntos **C01, C02, C03, C04 y C05** (bloqueantes antes de cerrar Fase C).
**Alcance ejecutado:** únicamente C01–C05. No se avanzó a Fase D. No se tocó Fase A, Fase B, Supabase, UI, plantillas, Nivel ni Ranking. La tabla de subpuntajes por `insightType` (DECISIÓN ABIERTA #1 del informe anterior) **no se reabrió**: la revisión central la aceptó explícitamente como parámetro V1.

Todos los cambios viven en `bramulab/intelligence-editorial.js` (y su test) — cero cambios en `intelligence-context.js`/`intelligence-claims.js`, cero cambios en ninguna migración de Supabase.

---

## C01 — "últimos 2 partidos" estaba implementado como "últimos 2 principales"

**Antes:** `memory.recentPrincipalFamilies` solo agregaba una entrada cuando HUBO principal — una abstención "desaparecía" de la ventana en vez de ocupar su lugar, dejando la penalización −15 activa más partidos de los que corresponde.

**Ahora:** `memory.recentMatches` — hasta los últimos 5 **partidos procesados**, cada uno `{matchId, principalFamily}` (`null` en abstención). `buildEditorialDecision` agrega SIEMPRE una entrada, haya o no principal. La penalización −15 mira exactamente `recentMatches.slice(-2)`.

**Además (mismo punto, "memoria de templates"):** `emptyMemory()` ahora declara `recentTemplateIds: []` y `memoryUpdate` lo preserva intacto — el camino de la penalización −10 (§6.1) ya existía en `scoreCandidate`, pero el contrato de memoria no lo declaraba ni lo conservaba. Fase D podrá usarlo sin reabrir este módulo solo para agregar el campo.

## C02 — La racha simple quedaba prohibida en longitud 4+ aunque nunca hubiera sido mostrada

**Antes:** `cooldownReason` excluía `racha_de_victorias`/`racha_de_derrotas` siempre que `length !== 3` — una racha de 4/5/6 nunca podía mostrarse si la de 3 no fue seleccionada por existir una historia más fuerte ese partido.

**Ahora:** el gate es de **memoria**, no de longitud fija. Nueva bandera `memory.rachaSimpleYaMostrada`: se excluye solo si esta MISMA racha continua ya fue mostrada (principal o secundario) en algún partido anterior sin haberse cortado desde entonces. La bandera se resetea a `false` en cuanto `ctx.streakForThisMatch` indica que la racha se reinició este partido (`before.type !== after.type`, o no había racha antes) — un quiebre real nunca deja "contaminada" la racha nueva. Récord/empate de récord/corte siguen sin este gate, exactamente como antes (siguen "sus reglas").

## C03 — La deduplicación racha/forma reciente no cubría el ejemplo literal de la fuente, y corría en el orden equivocado

**Dos problemas, una corrección:**

1. **Umbral insuficiente:** la condición anterior (`racha.length >= ventana.sampleSize`, típicamente ≥5) nunca cubría "4 victorias seguidas + 4 de los últimos 5" — exactamente el ejemplo que `BRAMU_Intelligence.md` pide evitar. Ahora: racha con longitud ≥4 **y** la cantidad de resultados de su mismo signo dentro de la ventana de `forma_reciente` es exactamente `mín(longitud, tamañoVentana)` — la racha explica TODOS los resultados de ese signo en la ventana, sin inventar un porcentaje de solapamiento.
2. **Orden de aplicación:** la fusión de `semanticKey` corría DESPUÉS de puntuar — `forma_reciente` podía recibir "novedad = 10 (nunca mostrada)" bajo su propia clave y solo después heredar la clave de la racha, permitiendo que una racha ya mostrada reapareciera disfrazada de forma reciente. Ahora la clave final se resuelve ANTES de cooldown/score/novedad (`mergeStreakAndRecentFormWhenFullyOverlapping` corre sobre `withKeys`, antes de `cooldownReason`/`scoreCandidate`).

## C04 — El semanticKey de "primer encuentro" usaba timestamp, no identidad del partido

**Antes:** `primer_encuentro_rival:${candidate.dataAsOf}` — dos partidos reales distintos con el mismo `playedAt` técnico (frecuente con `playedAtTimeKnown=false`) podían colisionar en la misma clave.

**Ahora:** `primer_encuentro_rival:${candidate.evidenceMatchIds[0]}` — el `matchId` fuente real, nunca una fecha/hora.

## C05 — Contrato de memoria/auditoría perdía cambios semánticos reales y motivos de no selección

**A. Firma de "mejor compañero":** `valueSignatureOf` para `companero_mejor_balance` ahora incluye `companionPlayerId` + balance + estado de empate (`isUnique`/`tiedWith`), no solo `wins-losses`. Un cambio de protagonista con el mismo marcador numérico ya no se confunde con "sin cambio".

**B. Motivo editorial final:** cada entrada de `evaluated` ahora lleva `editorialStatus`, más específico que `status`. Para un candidato por encima de 55 que no llegó a mostrarse: `not_selected_duplicate_semantic`, `not_selected_family_already_used` o `not_selected_capacity` — además de `selected_principal`/`selected_secondary` para los que sí se mostraron, y `below_threshold`/`excluded_by_cooldown` sin cambios para el resto. La decisión completa queda reconstruible sin adivinar por qué un candidato fuerte no apareció.

---

## Tests

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs bramulab/intelligence-editorial.test.mjs` — **94/94 PASS** (29 Fase A + 35 Fase B, sin cambios, + 30 de Fase C: 19 previos —3 de ellos actualizados a la memoria/semántica corregida— + 11 nuevos focales de C01–C05).

Cobertura de las 10 pruebas mínimas de `12_Revision_Central_Fase_C.md` §8:

1. −15 depende de los 2 partidos reales anteriores, incluidas abstenciones — ✔ (`6b`)
2. `recentTemplateIds` existe y se preserva — ✔
3. racha de 4 elegible si la de 3 nunca fue mostrada — ✔ (`10b`)
4. racha de 4 simple suprimida si la de 3 ya fue mostrada, sin evento material nuevo — ✔ (`10c`, + `10d` extremo a extremo con corte/reinicio real)
5. 4 victorias seguidas + 4/5 comparten historia — ✔
6. 4 derrotas seguidas + 4/5 comparten historia (caso simétrico) — ✔
7. semanticKey racha/forma resuelta antes de score/cooldown, respeta memoria previa — ✔
8. dos partidos distintos con el mismo `playedAt` no comparten milestone de "primer encuentro" — ✔
9. cambio de protagonista de "mejor compañero" con el mismo W-L es un cambio real — ✔
10. todo candidato >55 no seleccionado conserva un motivo editorial final — ✔

---

## Confirmación de entornos

- `staging`: única rama tocada. `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**.
- Fase A, Fase B, Supabase: **intactos**, cero regresión (29+35 tests sin cambios).
- Tabla de subpuntajes por `insightType`: **no reabierta**, aceptada como parámetro V1 explícito por la revisión central.
- Decisión abierta sobre partidos ocultos: sigue sin resolverse, no bloqueó esta corrección.

---

## Próximo gate

Sin cambios respecto de `12_Revision_Central_Fase_C.md` §9: revisión central de este commit → si pasa, cerrar Fase C → recién entonces preparar D — Plantillas y UX. No se avanza automáticamente a Fase D.
