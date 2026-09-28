# Resultado — Retest B1: actividad visible real vs. top 3 de puntos

**Fecha:** 28/09/2026 · **Rama:** `staging` · **Fuente:** `72_Resultado_Cierre_B1_Membresia_Semanal_Baja_y_Ajustes_QA_28SEP.md` (sección "Retest real — actividad visible vs top 3") + `Grupos_BRAMU.md` actualizado.
**Bundle:** `04.11-h31`. Sin migraciones ni cambios de backend (ajuste 100% de presentación/cálculo en el motor puro `groups.js` + su lectura en `app.js`).

**No se declara B1 cerrado.** Sigue pendiente el retest visual final de Central/Sebastián (incluye este ajuste + C1-C4).

## Bug real (confirmado en Staging)

La segunda línea de la tabla semanal/Race reutilizaba el mismo subconjunto **top 3** que ya computa los puntos, tanto para "partidos" como para V/D. Caso real: Seba (10 partidos calificables, 6V/4D) y Esteban (10, 4V/6D) se veían como `3 partidos · 3 V · 0 D` — una lectura falsa de invicto.

## Qué se cambió

Separación de dos conceptos que antes compartían un solo dato en `groups.js`:

- **`points`** (sin cambios): suma de los 3 mejores partidos puntuables de la semana. `pointsMatchesCounted` (renombre de la vieja `matchesCounted`, mismo cálculo) sigue documentando cuántos de esos partidos aportaron.
- **`matchesPlayed`/`wins`/`losses`** (nuevos, REALES): sobre **todos** los partidos que calificaron para el grupo esa semana, no solo los 3 que puntuaron.

Aplicado en `computeWeeklyTable` (Semana actual/pasada) y `computeRaceAnual` (acumula `matchesPlayed`/`wins`/`losses` reales semana a semana, además de `points`). `app.js#buildGroupTableRowHTML` (única superficie que pinta la fila de la tabla del grupo) pasa de `row.matchesCounted` a `row.matchesPlayed`.

**Sin tocar:** fórmula de puntos, bonus, regla 3/4, membresía semanal, Nivel, Ranking, backend. `points` es idéntico byte a byte a como salía antes.

## Tests

Extendí `groups-b1-cierre-membresia-baja.test.mjs` (+3 tests, ahora 19/19 PASS):
- reproduce exactamente el ejemplo del handoff — 10 partidos · 6 V · 4 D · **17 pts**, demostrando que los puntos siguen saliendo de solo 3 partidos (`pointsMatchesCounted=3`) mientras la actividad visible es la real;
- la misma distinción en Race anual;
- guarda estática: `buildGroupTableRowHTML` usa `row.matchesPlayed`, nunca `row.matchesCounted`/`row.pointsMatchesCounted`.

Actualicé 2 aserciones preexistentes que dependían del nombre/semántica vieja (`groups-b1-server-backed.test.mjs`, test B1-5 — ahora también verifica que perder 5 partidos da `losses:5` con `points:0`).

Suite general `node --test bramulab/*.test.mjs`: **409/410** — el único fallo, `h23`, es preexistente (no relacionado, ver rondas anteriores) y sigue sin tocarse por estar fuera de alcance.

## No verificado (honesto)

No se probó en navegador (mismo límite de siempre en este sandbox: sin Supabase CLI/psql/sesión real). Sin PASS visual declarado — falta que Central/Sebastián confirmen en Staging que la fila de un grupo real (Seba/Esteban) muestra ahora `10 partidos · 6 V · 4 D · N pts` en vez de `3 partidos · 3 V · 0 D`.

El push a `origin/staging` dispara el deploy automático de Vercel BRAMUlab Staging; no hay forma de confirmar su resultado desde este sandbox.


## Revisión Central posterior

Central revisó el commit funcional `033a49b552ff487636c7d46a56c3407efeabff43`.

- Diff acotado al motor/UI de Grupos + tests/versionado.
- No hay cambios de backend ni migraciones en esta ronda.
- `points` conserva el top 3; `matchesPlayed/wins/losses` pasan a actividad real.
- Race acumula la misma separación sin alterar puntos.
- No quedaron referencias funcionales de UI a `matchesCounted`/semántica vieja.
- Vercel BRAMUlab: **SUCCESS / Deployment has completed**.
- BRAMUlive: **Canceled by Ignored Build Step**, correcto.

**Estado:** listo para retest visual final. B1 todavía no se declara cerrado hasta confirmar en navegador la fila real y C1-C4.
