# Backend Bloque 8 — Corrección E07-E09 (Claude Code)

**Fecha:** 23/09/2026. **Rama:** `staging`. **Corrige:** `29_Revision_Final_Fase_E.md`.

## E07 — no marcar visto si TU MOMENTO no llegó a pintarlo
`app.js` (renderPlayerHome): antes de marcar, se calcula `buildTuMomentoText` con `insight=null` y con el insight real; solo si difieren se pinta y se marca `markRankingMilestoneSeen`. Cubre el caso <3 partidos (ignorado por `buildTuMomentoText`) y cualquier caso donde otras cláusulas ya llenan el cupo de 2.

## E08 — "why" de evidencia limitada no atribuye falsamente a un tercero
`intelligence-presentation.js`, `nivel_evidencia_limitada.why` (rama `callerCalibrating=false`): reemplazado "de otro participante, no el tuyo" por copy genérico y factual: "Uno o más Niveles BRAMU previos de este partido no tenían evidencia suficiente para clasificar la dificultad con confianza." Rama `callerCalibrating=true` intacta.

## E09 — cambio de banda nunca renderiza "—" como Nivel
`ranking.js`, `classifyHomeRankingMilestone`: el caso `cambio_de_banda` ahora exige además `Number.isFinite(levelPublic)` y `Number.isFinite(previousLevelPublic)`, no solo las bandas. El fallback `—` de `player-home.js` queda como defensa inaccesible (no se tocó ese archivo — no hacía falta).

## Tests focales (nuevos, todos PASS)
- `ranking-home-milestone.test.mjs`: E09.1/E09.2/E09.3 (banda distinta + Nivel público faltante → sin hito / ambos presentes → hito) y E07.1/E07.2 (réplica exacta de la decisión de `app.js`: <3 partidos → nunca marcado; 3+ con texto distinto → marcado).
- `intelligence-presentation.test.mjs`: E08.1/E08.2 (`callerCalibrating=false` por confianza propia baja o fila propia ausente → nunca "otro participante") y E08.3 (rama `callerCalibrating=true` sin cambios).

## Suites ejecutadas
Solo las dos afectadas por los archivos tocados — `ranking-home-milestone.test.mjs`: **32/32 PASS**. `intelligence-presentation.test.mjs`: **50/50 PASS**. No se repitió el resto de A+B+C+D (sin cambios en esas capas).

## Alcance
No se tocó SQL (migración ya aplicada en Supabase Staging, sin cambios). No se tocó `get-match-intelligence`. No se avanzó a Fase F. No se tocó `main`, Production, BRAMUlive ni Mis Grupos. `player-home.js` no requirió cambios.

Bundle: `04.10-h25 → 04.10-h26` (`index.html`, `sw.js` — quartet + `CACHE_NAME`), único bump.
