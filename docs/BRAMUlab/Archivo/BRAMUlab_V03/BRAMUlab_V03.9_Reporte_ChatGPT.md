# Reporte BRAMUlab V03.9 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto
operativo de esta ronda. No repite la especificación completa — eso vive en
`BRAMUlab_V03.9_Handoff_Ajustes_Cierre_V03.md` y en `BRAMUlab_V03.9.md`, en esta misma carpeta —
solo resume qué se hizo realmente y en qué estado quedó publicado.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit:** [`cd217bb`](https://github.com/sebastianvilaa/BRAMUlab/commit/cd217bb)
**Tag:** `BRAMUlab_V03.9`
**Base:** `BRAMUlab_V03.8` (commit `abb2cd3`)

---

## 1. Qué se corrigió

### 1.1 TU MOMENTO — framing de forma reciente (`bramulab/player-home.js`)

**Bug real:** con un balance reciente negativo (ej. 2 victorias / 3 derrotas en los últimos 5
partidos), el texto decía "Venís de ganar 2 de tus últimos 5 partidos" — un dato verdadero
presentado en positivo sobre un balance real negativo.

**Corrección:** el framing ahora sigue el balance real (`wins` vs. `losses`, ambos ya
calculados desde `computeRecentForm`, nunca un cálculo nuevo):

- victorias > derrotas → `Ganaste X de tus últimos N partidos`
- derrotas > victorias → `Perdiste Y de tus últimos N partidos`
- empate → `En tus últimos N partidos: X victorias y Y derrotas`

Mismo umbral de muestra suficiente (`withResult.length >= 3`, sin cambios) y mismo tratamiento
de partidos neutrales/sin resultado (siguen sin contar para el umbral ni para `wins`/`losses`).
La prioridad de `TU MOMENTO` **no cambió**: forma reciente > Ranking semanal Local > compañero
frecuente > actividad del mes — el nuevo framing solo afecta el TEXTO de la cláusula de forma
reciente, no su posición ni su condición de activación.

### 1.2 RANKING > MI RED — TU POSICIÓN con 1–2 elegibles (`bramulab/app.js`)

**Bug real:** con Mi red en densidad "simple" (1–2 elegibles), la tarjeta `TU POSICIÓN` usaba un
markup distinto y más pobre que el caso general (una sola línea "Nivel BRAMU X" sin la
estructura `__main`/`__rank`/`__level`), dejando el Nivel visualmente "flotando" y mostrando
"Comparación entre 1 jugadores" (singular roto).

**Corrección:** la rama de densidad "simple" ahora reutiliza EXACTAMENTE la misma estructura
HTML/CSS del caso general (`.ranking-my-position__main` con `__rank`/`__level`, cero clases
nuevas) con `—` en la zona de puesto en vez de un número inventado, y el contexto pasa a
`Comparación simple · N jugador · Mi red` (singular) / `Comparación simple · N jugadores · Mi
red` (plural). La regla deportiva vigente **no cambió**: 1–2 elegibles siguen sin puesto oficial
(nunca se inventa `#1 de 1`); 3+ elegibles siguen usando la clasificación `N de total` normal —
verificado que esa rama general no se tocó y sigue funcionando igual.

### 1.3 Rollover semanal — prueba determinística (`bramulab/tests.html`)

Se agregó un test puro que fija el reloj en dos instantes exactos alrededor del corte real
(domingo 13/09/2026 23:59:59 y lunes 14/09/2026 00:00:00, ambos hora de Buenos Aires,
`UTC-3` fijo sin DST) y confirma que `RK.formatRankingWeekRangeLabel(RK.computePreviousRankingWeekPeriod(...))`
— la misma función que ya usa la pantalla Ranking para identificar la edición vigente — pasa de
`"Lun 31 ago — Dom 06 sep"` a `"Lun 07 sep — Dom 13 sep"` exactamente en ese instante, con un
milisegundo de margen a cada lado del corte. **No se tocó ninguna lógica temporal** — la prueba
confirma que las funciones puras ya existentes (`computeRankingWeekPeriod`/
`computePreviousRankingWeekPeriod`/`formatRankingWeekRangeLabel`) ya resuelven el rollover
correctamente.

## 2. Qué NO se tocó

Geografía del Ranking (Local/Provincial/País), `Explorar rankings`, Nivel BRAMU, cuestionario,
calibración real, BRAMU Intelligence, Backend, validación de partidos, historial multiusuario/
localStorage, login/autocomplete, WhatsApp, Mis grupos, registro de partidos, diseño global,
prioridad de `TU MOMENTO`, reglas de elegibilidad/densidad/snapshot de Ranking.

**Hallazgo menor documentado, sin tocar (fuera del alcance explícito de esta ronda):** el
título "CLASIFICACIÓN" de Mi red usa `Comparación entre ${totalCount} jugadores` (`app.js:8026`),
con el MISMO bug de singular/plural que tenía `TU POSICIÓN` — pero el handoff acotó el arreglo
específicamente a la tarjeta `TU POSICIÓN`, así que esta otra línea no se modificó. Queda como
candidato simple para una futura ronda si se decide corregirlo.

## 3. Tests focales

`bramulab/tests.html`, 2 bloques nuevos (9 aserciones) + 2 aserciones existentes actualizadas:

- **TU MOMENTO**: 3W/2L → `/^Ganaste 3 de tus últimos 5 partidos\./`; 2W/3L → `/^Perdiste 3 de
  tus últimos 5 partidos\./` y nunca contiene "ganaste"/"venís de ganar"; empate 2W/2L →
  `/^En tus últimos 4 partidos: 2 victorias y 2 derrotas\./`; partidos neutrales (sin
  `winnerTeam`) siguen sin activar ningún framing; Ranking conserva su prioridad vigente incluso
  con balance negativo (la frase de forma reciente sigue en primer lugar, el insight de Ranking
  se suma como 2º dato, nunca la desplaza).
- **Rollover**: domingo 23:59:59 BA → edición anterior; lunes 00:00:00 BA → edición nueva; 1ms
  antes/después del corte exacto confirman el límite exacto.
- **Actualizadas** (no eran de esta ronda, pero dependían del texto anterior): el test de "Rama
  Jugador" que verificaba el texto completo de `TU MOMENTO` (3W/1L/1neutral →
  "Venís de ganar 3...") y una aserción de V03.8 sobre el mismo texto — ambas actualizadas al
  nuevo copy ("Ganaste 3...").

No se agregó ningún test para el punto 1.2 (`TU POSICIÓN` en Mi red): es un cambio de DOM puro
en `app.js`, que `tests.html` no carga (límite ya documentado en rondas anteriores) — verificado
por QA manual real (ver §4).

## 4. Suite completa

**1052/1052 tests OK** (1043 de V03.8 + 9 nuevas), corrida una sola vez al final.

## 5. QA manual (mobile 375px primero)

Con cuentas de prueba reales fabricadas por consola:

- **Home, balance 2W/3L**: `TU MOMENTO` mostró "Perdiste 3 de tus últimos 5 partidos. Entraste
  al Ranking de Bella Vista: #10 de 21." — nunca "ganaste"/"venís de ganar" con balance negativo,
  Ranking sigue apareciendo como segundo dato.
- **Mi red, 1 elegible** (self + 0 compañeros elegibles, solo rivales calibrando): tarjeta
  `TU POSICIÓN` con `—` en la zona de puesto, Nivel BRAMU balanceado a la derecha, "Comparación
  simple · 1 jugador · Mi red" (singular correcto).
- **Mi red, 2 elegibles** (self + 1 compañero real independientemente calibrado): misma
  composición, "Comparación simple · 2 jugadores · Mi red" (plural correcto).
- **Mi red, 3 elegibles** (self + 2 compañeros): regresión confirmada — vuelve a la
  clasificación normal `#3 de 3`, con movimiento semanal (`↓ 1`) y "EN FORMACIÓN" donde
  corresponde, sin tocar la rama general.
- **Ranking territorial (Local)**: `TU POSICIÓN` normal (`#8 de 21`, "Mismo puesto que la semana
  anterior") sin cambios — confirma que el ajuste de Mi red no afectó la rama general.
- **Tablet (768px)**: Home con el nuevo framing, sin desbordes.

## 6. Commit, tag, deploy

- **Commit:** [`cd217bb`](https://github.com/sebastianvilaa/BRAMUlab/commit/cd217bb) — incluye
  únicamente los archivos de este frente. No se tocaron los archivos ya modificados/sin
  seguimiento de otros frentes presentes en `git status` al empezar (`BRAMU_Intelligence.md`,
  `Referencias/`, `Backup/`, `BRAMU_Intelligence_IA_Generativa_...md`,
  `BRAMU_Ranking_Handoff_Exploracion_Geografica.md`, `BRAMUlab_V03.5.1_Reporte_ChatGPT.md`,
  `BRAMUlab_V03.8_Handoff_Cierre_Ranking.md`, `Logo.ai`) — quedan intactos.
- **Tag:** `BRAMUlab_V03.9`, en el mismo commit.
- **Cache-bust:** `03.9` — `CACHE_NAME`/`CORE_ASSETS` (`sw.js`) y los 11 `?v=` de `index.html`.
- **Deploy:** push a `origin/main` + tag; GitHub Pages completó en unos segundos. Verificado en
  el origen: `version.json` responde `"BRAMUlab V03.9"`, `index.html` sirve `?v=03.9`.
- **Verificación funcional en producción real:** cuenta descartable (`Prod Check V039`, Bella
  Vista/Buenos Aires/Argentina, balance 2W/3L) confirmó el footer "BRAMUlab V03.9" y `TU MOMENTO`
  mostrando "Perdiste 3 de tus últimos 5 partidos...". Cuenta eliminada
  (`localStorage.clear()`) al terminar.

## 7. Limitaciones reales / hallazgos pendientes

- El bug de singular/plural en el título "CLASIFICACIÓN" de Mi red (`app.js:8026`) NO se corrigió
  — fuera del alcance explícito de esta ronda (ver §2). Es un cambio trivial y aislado si se
  decide incluirlo en una futura ronda.
- Ninguna limitación nueva de datos/identidad. Se mantiene la ya conocida de
  localStorage/multi-cuenta (documentada desde V03.6), sin cambios en esta ronda.

**Próximo paso:** esta ronda cierra los tres ajustes mínimos pedidos para V03.9. No se avanza a
V04. La siguiente decisión la toma ChatGPT después de auditar este reporte.
