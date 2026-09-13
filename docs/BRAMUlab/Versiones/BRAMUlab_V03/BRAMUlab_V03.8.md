# BRAMUlab V03.8 — cierre UX de Ranking BRAMU

**Estado:** implementada y publicada.
**Base:** BRAMUlab V03.7 (commit `24dc7b8`, tag `BRAMUlab_V03.7`, 1020/1020 tests).
**Fuente:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.8_Handoff_Cierre_Ranking.md`.
**Objetivo:** cerrar el frente UX de Ranking BRAMU dentro de V03, incorporando solo decisiones ya validadas por el análisis especializado. No abre V04, no toca Nivel BRAMU/BRAMU Intelligence/Backend/exploración geográfica.

---

## 1. Objetivo

1. Actualizar `Ranking_BRAMU.md` con las decisiones normativas de esta ronda.
2. Replicar la tarjeta territorial de Ranking (Local/Provincia/País) en Mi Perfil.
3. Reforzar la jerarquía tipográfica de los puestos en esa tarjeta (Perfil público y Mi Perfil).
4. Confirmar/formalizar que `TU POSICIÓN` lleva al contexto cercano a la fila propia.
5. Integrar Ranking en Home únicamente dentro de `TU MOMENTO`, sin tarjeta territorial duplicada.
6. Dejar `Explorar rankings` documentado como evolución futura, fuera de V1.

## 2. Decisiones

- **Normativa primero**: `Ranking_BRAMU.md` se actualiza antes de tocar código (§8.6 Explorar
  rankings, §13.3 Tu posición → contexto cercano, §13.6 Home vía Tu momento, §15.1 tarjeta
  territorial en Perfil público y Mi Perfil, además de las reglas §19/§22 correspondientes).
- **Misma fuente en los dos perfiles**: Mi Perfil y Perfil público comparten literalmente la
  misma función de resumen (`RK.computeProfileRankingSummary`) y el mismo componente visual —
  nunca una segunda implementación de Ranking.
- **Tipografía**: el puesto (`#N`) sube de 17px a 22px; `de N` baja a 10px; territorio se
  mantiene discreto — sin aumentar la altura de la tarjeta.
- **`TU POSICIÓN`**: al auditar el código existente, la función ya cumplía el comportamiento
  pedido (carga el bloque de paginación que contiene la fila propia y hace scroll centrado,
  dejando vecinos visibles) — se formalizó en la normativa, no se reescribió código que ya
  funcionaba correctamente (confirmado con QA real).
- **Home / `TU MOMENTO`**: Ranking se suma como candidato nuevo al mecanismo de prioridad ya
  existente (forma reciente > Ranking semanal Local > compañero frecuente > actividad del mes),
  nunca una tarjeta territorial nueva ni un motor editorial paralelo. Sin movimiento real, no se
  fuerza ningún mensaje de Ranking.
- **`Explorar rankings`**: definido conceptualmente en `Ranking_BRAMU.md` §8.6, explícitamente
  fuera de V1. No se implementa código.

## 3. Alcance

- `docs/BRAMUlab/Ranking_BRAMU.md` — actualización normativa (§8.6, §13.3, §13.6, §15.1, §19,
  §22).
- `bramulab/ranking.js` — `computeHomeRankingInsight` (insight de Ranking para Home, siempre
  ámbito Local).
- `bramulab/player-home.js` — `buildRankingMomentoClause` + `buildTuMomentoText` acepta un 3er
  parámetro opcional (`rankingInsight`).
- `bramulab/app.js` — tarjeta compartida (`renderRankingCardForAccount`) reutilizada por Perfil
  público y Mi Perfil; `renderPlayerHome` calcula e inyecta el insight de Ranking en `TU
  MOMENTO`.
- `bramulab/index.html` / `bramulab/styles.css` — markup de la tarjeta en Mi Perfil; ajuste
  tipográfico compartido.
- Tests focales nuevos en `bramulab/tests.html`.

## 4. Fuera de alcance

`Explorar rankings`, selector geográfico, búsqueda de otra ciudad/provincia/país, Nivel BRAMU
real, cuestionario, BRAMU Intelligence, Backend, validación de partidos, historial
multiusuario/localStorage, login/autocomplete, nuevas reglas de Ranking, Race/temporadas.

## 5. QA esperado

Mobile 375px primero: Mi Perfil con cuenta elegible muestra la tarjeta con 3 columnas y puestos
más protagonistas; Perfil público mantiene el mismo ajuste visual y sus acciones (WhatsApp/
Agregar) intactas; cuenta calibrando no recibe posiciones inventadas en ninguno de los dos
perfiles; Ranking (Local/Provincial/País) sigue correcto y tocar `TU POSICIÓN` lleva a la zona
propia con vecinos visibles; Home puede mostrar un insight de Ranking dentro de `TU MOMENTO` sin
duplicar tarjeta territorial. Chequeo rápido en tablet/desktop.
