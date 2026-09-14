# BRAMUlab V03.9 — microajustes de cierre de V03

**Estado:** implementada y publicada.
**Base:** BRAMUlab V03.8 (commit `abb2cd3`, tag `BRAMUlab_V03.8`, 1043/1043 tests).
**Fuente:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.9_Handoff_Ajustes_Cierre_V03.md`.
**Objetivo:** ronda mínima y focal — corregir dos problemas reales detectados en QA visual y agregar una verificación determinística del rollover semanal. No abre nuevos frentes, no rediseña Home/Ranking/Perfil, no avanza a V04.

---

## 1. Objetivo

1. Corregir el framing de forma reciente en `TU MOMENTO`: un balance negativo ya no se presenta como "venís de ganar".
2. Corregir la composición/copy de `TU POSICIÓN` en Mi red con 1–2 elegibles (sin inventar puesto).
3. Agregar una prueba determinística del rollover semanal de Ranking alrededor del lunes 00:00 de Buenos Aires.

## 2. Decisiones

- **Framing por balance real, no por conteo de victorias**: más victorias que derrotas → "Ganaste X de tus últimos N partidos"; más derrotas → "Perdiste Y de tus últimos N partidos"; empate → "En tus últimos N partidos: X victorias y Y derrotas". Mismo umbral de muestra suficiente (≥3 resultados no neutrales) y mismo tratamiento de partidos sin resultado definido. La prioridad de `TU MOMENTO` (forma reciente > Ranking semanal Local > compañero frecuente > actividad del mes) **no cambia**.
- **`TU POSICIÓN` en Mi red con 1–2 elegibles**: se mantiene la regla deportiva vigente (NUNCA `#1 de 1`). La tarjeta reutiliza la misma estructura visual del caso general (`—` en la zona de puesto, Nivel BRAMU balanceado a la derecha) con singular/plural correcto ("1 jugador" / "2 jugadores"). Sin cambios de elegibilidad, densidad ni reglas de Ranking.
- **Rollover semanal**: se verificó que la lógica temporal existente (`computeRankingWeekPeriod`/`computePreviousRankingWeekPeriod`/`formatRankingWeekRangeLabel`) ya resuelve el corte exacto — se agregó únicamente el test, sin tocar la lógica.

## 3. Alcance

- `bramulab/player-home.js` — framing de `buildTuMomentoText` según balance real.
- `bramulab/app.js` — composición/copy de `TU POSICIÓN` en Mi red, densidad "simple" (1–2 elegibles).
- `bramulab/tests.html` — tests focales de framing + rollover semanal; 2 aserciones existentes actualizadas al nuevo copy ("Ganaste"/"ganaste" en vez de "Venís de ganar"/"venís de ganar").
- Versionado: `bramulab/store.js`, `bramulab/version.json`, `bramulab/sw.js`, `bramulab/index.html`.

## 4. Fuera de alcance

Geografía del Ranking, `Explorar rankings`, Nivel BRAMU, BRAMU Intelligence, Backend, historial multiusuario, validación de partidos, WhatsApp, Mis grupos, diseño global. Tampoco se tocó el mismo bug de singular/plural presente en el título "CLASIFICACIÓN" de Mi red (`Comparación entre N jugadores`, `app.js`) — no estaba en el alcance de esta ronda (solo `TU POSICIÓN`); queda documentado como hallazgo menor para una futura ronda.

## 5. QA esperado

Mobile 375px primero: Home con balance reciente 2W/3L muestra "Perdiste...", nunca "ganaste"/"venís de ganar"; Mi red con 1 elegible muestra composición balanceada con "—" y "1 jugador"; con 2 elegibles, "2 jugadores"; con 3+ elegibles, la clasificación `N de total` sigue intacta; Ranking territorial (Local/Provincial/País) sin cambios. Chequeo rápido en tablet.
