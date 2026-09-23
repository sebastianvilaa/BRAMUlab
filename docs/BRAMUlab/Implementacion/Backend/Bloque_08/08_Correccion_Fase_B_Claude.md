# Backend Bloque 8 — Corrección de Fase B (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Corrige:** `07_Revision_Central_Fase_B.md` — puntos **C01, C02, C03 y C04** (bloqueantes antes de cerrar Fase B).
**Alcance ejecutado:** únicamente C01–C04. No se avanzó a Fase C. No se tocó Fase A, `matches.js`, migraciones/RPCs de Supabase, Nivel, Ranking, UI, plantillas ni relevancia/cooldowns. No se aplicó nada a Supabase.

Todos los cambios viven en `bramulab/intelligence-claims.js` (y su test) — cero cambios en `intelligence-context.js`, cero cambios en la migración de Bloque 8, cero cambios en `matches.js`.

---

## C01 — `evidenceMatchIds` incompleto en claims históricos/comparativos

Corregido en 7 puntos concretos:

| Claim | Antes | Ahora |
|---|---|---|
| `racha_cortada` | `[ctx.matchId]` | Los `before.length` partidos de la racha previa + el partido que la corta |
| `racha_nuevo_record_personal` / `racha_iguala_record_personal` | Solo los partidos de la racha actual | Todo el universo comparable (`decidedSequence` completo) contra el que se demuestra el récord |
| `hito_de_victorias` | `[ctx.matchId]` | Las victorias efectivamente contadas hasta ese hito |
| `primera_victoria_registrada` | `[ctx.matchId]` | Todo el historial decidido hasta ese punto (demuestra que no había victoria previa) |
| `forma_reciente` | Solo los IDs de la ventana actual | Unión de ambas ventanas (actual + inmediatamente anterior) |
| `companero_mejor_balance` | Solo los partidos del compañero elegido | Unión de los partidos de TODOS los candidatos realmente comparados |
| `contexto_regreso_tras_inactividad` | `[ctx.matchId]`, `sampleSize:1` | Partido actual + hasta 10 antecedentes (misma ventana que usa Fase A para el gap/mediana), `sampleSize` coherente con esa evidencia |

`buildMilestoneClaims` y `buildContextClaims` ahora reciben `decidedSequence`/`historyAsc` respectivamente para poder construir esta evidencia — sin necesitar ningún dato nuevo de Fase A.

## C02 — Ventana móvil de forma reciente calculada incorrectamente

- La ventana "inmediatamente anterior" pasó de un bloque no superpuesto (`slice(windowEnd-5, windowEnd)`, que con 6 decididos daba "solo el partido 1") a la ventana móvil correcta: los hasta 5 partidos que terminan justo antes del partido actual (`slice(n-6, n-1)`) — con 6 decididos, actual = partidos 2–6, anterior = partidos 1–5, exactamente el ejemplo de la revisión.
- `forma_reciente` ya **no se afirma con 1–4 partidos decididos**: por debajo de 5 se descarta explícitamente (`discardReasonCodes: ['muestra_insuficiente_para_forma_reciente']`), consistente con "Forma de 5" recién desde 5 previos (§8.1 de la fuente).
- `claim.current`/`claim.previousWindow` ahora incluyen sus propios `matchIds`, y `evidenceMatchIds` es la unión sin duplicados de ambas ventanas.

## C03 — Empates en "el más/mejor" no se distinguían

- `score_excepcional_formato_comparable`: el claim ahora incluye `isUnique` y `tiedCount` (cuántos partidos del universo comparable, incluido el actual, comparten el mismo extremo). `current === min`/`max` ya no se traduce automáticamente en "único" — Fase D decide si redacta "el más ajustado" o "iguala tu marca" según estos campos.
- `companero_mejor_balance`: el claim ahora incluye `isUnique`, `tiedWith` (ids empatados con el elegido) y `candidates` (wins/losses/sampleSize de TODOS los comparados, no solo el elegido). El orden por `id` sigue existiendo solo como desempate TÉCNICO para fijar `candidates[0]`, nunca como afirmación semántica de "el mejor" cuando hay empate real.

## C04 — Partido pendiente cortaba incorrectamente la búsqueda de "primer triunfo tras derrotas"

Reescrita `buildFirstWinAfterLossesClaim`: en vez de recorrer hacia atrás y `break`-ear ante cualquier resultado que no fuera `'loss'` (lo que confundía un partido pendiente con una victoria y además no garantizaba ausencia de victoria previa en todo el alcance), ahora:

1. toma toda la participación previa en el alcance (`summary.matches` sin el partido actual);
2. cuenta victorias previas (`priorWins`) — si hay al menos una, **no** es "primer triunfo" y la función devuelve `null` sin importar qué tan reciente sea una racha de derrotas;
3. si `priorWins === 0`, cuenta las derrotas previas ignorando los partidos sin resultado definido (pendientes) — nunca los trata como si cortaran la secuencia.

Esto resuelve exactamente los dos escenarios de la revisión: `derrota + pendiente + derrota + victoria` produce el claim con `priorLosses:2` y evidencia de 3 partidos (2 derrotas + el actual, el pendiente nunca es evidencia); `derrota + victoria previa + derrota + victoria` no produce ningún claim de este tipo.

---

## Tests

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs` — **64/64 PASS** (29 de Fase A, sin cambios, + 35 de Fase B: 28 previos, todos revisados para verificar evidencia completa, + 7 nuevos focales de C01–C04 pedidos explícitamente en `07_Revision_Central_Fase_B.md` §7).

Cobertura de las 9 pruebas mínimas de §7:

1. racha cortada: evidencia = racha previa + partido actual (5 partidos) — verificado;
2. récord de racha: evidencia = universo comparable completo (11 partidos) — verificado;
3. hito 10: evidencia = las 10 victorias contadas — verificado;
4. forma reciente: 4 descartada, 5 primera válida, 6 → actual 2-6 vs. previa 1-5, evidencia de ambas ventanas — verificado (3 tests);
5. mejor compañero empatado (60% vs. 60%) — verificado;
6. score extremo empatado (mismo margen exacto en 2 partidos) — verificado;
7. inactividad: evidencia (8 partidos) + `sampleSize` coherente con esa evidencia — verificado;
8. derrota + pendiente + derrota + primera victoria → claim válido — verificado;
9. victoria previa real en el alcance → nunca "primer triunfo" — verificado.

---

## Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**.
- Fase A, `matches.js`, migraciones/RPCs de Supabase, Nivel, Ranking, UI, plantillas, relevancia/cooldowns de Fase C: **todos intactos**.
- Supabase: **nada aplicado**.
- Decisión abierta sobre partidos ocultos: sigue sin resolverse, no bloqueó esta corrección.

---

## Próximo gate

Sin cambios respecto de `07_Revision_Central_Fase_B.md` §8: revisión central de este commit → si pasa, cerrar Fase B → recién entonces autorizar C — Relevancia y memoria editorial. No se avanza automáticamente a Fase C.
