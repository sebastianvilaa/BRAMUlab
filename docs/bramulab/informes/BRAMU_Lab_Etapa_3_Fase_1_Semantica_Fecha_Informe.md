# BRAMU Lab
## Etapa 3 — Fase 1: semántica de fecha del partido — Informe

**Estado:** implementado, testeado, verificado y desplegado.
**Consolidado que autorizó esta fase:** `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Fase_1_Semantica_Fecha_Consolidado.md`
**Aplicación modificada:** BRAMU Lab (`bramulab/`) únicamente.
**Aplicación protegida:** BRAMU Lab Partidos (`bramulab-partidos/`) — sin ningún cambio, confirmado.

Este informe es autosuficiente: no requiere leer el chat operativo para entender qué se hizo, por qué, y con qué resultado.

---

## 1. Diagnóstico breve del estado encontrado

Antes de esta fase, todas las lecturas de "cuándo se jugó" un partido usaban `finishedAt` (el momento técnico en que se guardó el registro), no la fecha real jugada. Esto causaba exactamente el síntoma que describe el consolidado: si se cargaba hoy un partido que se jugó ayer, el orden lo trataba como "más reciente" por haberse *guardado* después, no por haberse *jugado* después.

Ubiqué con precisión los 5 puntos de lectura afectados (mismos que ya había identificado en el plan técnico de la Fase 0):
- `player-home.js`: el `.sort()` que ordena el historial del jugador (la causa raíz del bug).
- `player-home.js`: el cálculo de "partidos este mes".
- `app.js`: fecha mostrada en cada fila del Historial global.
- `app.js`: fecha mostrada en la tarjeta "Último partido" del Home.
- `app.js`: fecha en el pie de la imagen de Compartir.

También confirmé, revisando el código antes de tocar nada, que `startedAt` ya se guardaba en los tres flujos de guardado (Cargar partido jugado, Completo, Por Games) — con el significado correcto de "cuándo se jugó" en los tres casos —, así que no hizo falta ninguna migración de datos: el valor que `playedAt` necesita ya existía, solo con otro nombre.

## 2. Archivos modificados

Los 3 que el consolidado anticipaba como esperables, ninguno adicional:

| Archivo | Qué cambió |
|---|---|
| `bramulab/player-home.js` | Funciones puras nuevas (`getPlayedAt`, `comparePlayedAtDesc`), corrección del `.sort()` de `filterMatchesForPlayer` y de `computeMatchesThisMonth`. |
| `bramulab/app.js` | Los 3 flujos de guardado (`finishMatchManual`, `finishMatch`, `finishMatchGames`) ahora escriben `playedAt` (y ajustan `createdAt`, ver §4); las 3 pantallas de lectura de fecha (Historial, Último partido, Compartir) usan la fecha real jugada; el orden del Historial global también se corrigió (ver §6, es una extensión razonada, no textualmente listada en los "archivos esperables" pero sí en el alcance del consolidado). |
| `bramulab/tests.html` | 15 tests nuevos + un fixture (`mkDatedMatch`) para poder simular partidos con control independiente sobre los 4 campos de fecha. |

No hizo falta tocar `engine.js` ni `stats.js` — la corrección es enteramente de datos/orquestación, no de motor de puntuación.

## 3. Funciones creadas o reutilizadas

Todas nuevas, en `bramulab/player-home.js`, puras y sin DOM (mismo criterio que el resto del archivo):

- **`getPlayedAt(match)`** — la función central pedida por el consolidado (§4). Cadena de fallback `playedAt → startedAt → finishedAt`, defensiva: valida cada candidato con `Number.isNaN` antes de aceptarlo (una fecha inválida en un campo no rompe la cadena, simplemente se salta al siguiente), y devuelve `null` si ninguno de los tres es una fecha válida — nunca inventa una fecha.
- **`comparePlayedAtDesc(a, b)`** — comparador para `Array.prototype.sort`, implementa el orden y desempate completos del §7 (ver §7 de este informe).
- **`parseTimeOrNull`/`timeOrNegInfinity`** — helpers internos (no exportados) de conversión de fecha defensiva, usados por las dos funciones de arriba.

Se reutilizó `Store.normalizePlayerName` (ya existente) sin cambios — no tiene relación con fechas, solo lo menciono porque `filterMatchesForPlayer` lo sigue usando para el filtro por jugador, ahora combinado con el nuevo comparador para el orden.

## 4. Regla final de `playedAt`, `createdAt` y fallbacks

**Lectura (`getPlayedAt`):** `playedAt ?? startedAt ?? finishedAt ?? null` — exactamente la prioridad pedida, con validación defensiva en cada paso.

**Escritura — decisión técnica resuelta de forma conservadora (documentada, no trasladada a Sebastián):**

El consolidado define `createdAt` en su §2 como "momento técnico en que el registro fue creado o guardado en BRAMU Lab". Para Cargar partido jugado esto ya era inequívoco en el código existente (el momento de guardar, distinto de la fecha elegida por el usuario). Para Completo y Por Games había una ambigüedad real: el código anterior guardaba `createdAt: match.createdAt`, que es el momento en que el usuario tocó "EMPEZAR PARTIDO" (idéntico a `startedAt` en la práctica) — no el momento en que el *registro final* se creó.

Resolví esto interpretando `createdAt` de forma consistente en los tres flujos: **el momento en que la entrada de Historial se crea/persiste**, que para un partido en vivo es el momento de finalizar (no el de arrancar) — coherente con la definición general del consolidado y con el precedente que ya tenía Cargar partido jugado. Cambié `createdAt: match.createdAt` por `createdAt: new Date().toISOString()` (momento de finalización) en `finishMatch` y `finishMatchGames`.

**Por qué la resuelvo yo y no la traslado:** verifiqué que `match.createdAt`/`finishedSnapshot.createdAt` no se leía en ningún punto de lectura de la app antes de esta fase (ni en Home, ni en Historial, ni en Compartir) — así que este cambio no altera ningún comportamiento observable existente; solo empieza a darle a `createdAt` el significado que el propio consolidado ya le había asignado, y que ahora además se usa activamente como primer criterio de desempate (§7). No es una decisión que cambie producto, historial visible ni compatibilidad — es una decisión de implementación menor, ahora documentada.

## 5. Tratamiento de los tres flujos de guardado

| Flujo | `playedAt` | `createdAt` |
|---|---|---|
| Cargar partido jugado (`finishMatchManual`) | Fecha/hora elegida por el usuario en el formulario (ya se guardaba como `startedAt`; ahora también como `playedAt`, mismo valor) | Sin cambios — ya era el momento técnico de guardar |
| Completo (`finishMatch`) | `= startedAt` (momento en que arrancó el marcador) | Momento de finalización del partido (antes era el momento de arranque — ver §4) |
| Por Games (`finishMatchGames`) | `= startedAt` | Momento de finalización — mismo criterio que Completo |

`finishedAt` no se tocó en ningún flujo — conserva exactamente su significado y comportamiento anteriores, tal como pedía el consolidado (§5.2, §5.3).

## 6. Compatibilidad con registros históricos

No se migró ni reescribió ningún registro guardado. Un partido guardado antes de esta fase no tiene `playedAt` (campo inexistente) — `getPlayedAt` lo detecta como inválido (`parseTimeOrNull(undefined) === null`) y cae a `startedAt`; si tampoco existe, cae a `finishedAt` (que la propia capa de storage ya exige como requisito para que un registro se considere válido — `Store.loadHistory()` filtra por `m.finishedAt` truthy desde antes de esta fase). En la práctica, **todo registro histórico real tiene al menos `finishedAt`**, así que ninguno queda sin fecha resoluble.

**Extensión no listada textualmente en "archivos esperables" pero sí en el alcance (§6, ítem 4 del consolidado — "Historial"):** corregí también el orden del Historial global (`renderHistory()` en `app.js`), que antes mostraba los partidos en orden de guardado (`Store.loadHistory()` los devuelve en ese orden por diseño de `upsertHistory`). Ahora aplica `.sort(PH.comparePlayedAtDesc)` antes de renderizar. Sin este cambio, el Historial completo (a diferencia del Home del jugador) hubiera seguido mostrando el bug para cualquier partido, incluso los que no son del jugador identificado. Lo documento explícitamente porque el consolidado no lo listó dentro de "archivos esperables" §8, pero sí lo pide en su objetivo general ("la historia deportiva debe ordenarse siempre por la fecha real jugada") y en el punto 4 de §6 ("Historial"). No lo until considero una desviación de alcance, sino la lectura más directa del propio texto — lo señalo para que quede auditable.

## 7. Criterio de desempate exacto

Implementado en `comparePlayedAtDesc`, en este orden:

1. `getPlayedAt(a)` vs `getPlayedAt(b)` — descendente (más reciente jugado primero).
2. Si es idéntico: `createdAt` descendente.
3. Si también es idéntico (o ambos ausentes): `finishedAt` descendente.
4. Si también es idéntico: `matchId` como último criterio — comparación de string, determinística y estable entre corridas, aunque no tiene significado cronológico propio (`matchId` se genera con `Date.now().toString(36) + random`, así que no es estrictamente ordenable por tiempo, pero sí es 100% estable: el mismo par de partidos siempre produce el mismo orden). Esta elección específica (matchId como último desempate) es mía, documentada acá — el consolidado pedía "un último criterio estable y documentado" sin especificar cuál.

Un valor de fecha ausente/inválido en cualquier nivel se trata como `-Infinity` (va al final), nunca como error.

## 8. Tests agregados y resultados completos

**Suite completa: 349 → 364 tests (15 nuevos), todos en verde.**

Los 15 nuevos, agrupados por el caso del consolidado que cubren:

- **§9.1 (precedencia, 6 tests):** `getPlayedAt` usa `playedAt` cuando existe; cae a `startedAt`; cae a `finishedAt`; devuelve `null` si nada es válido; ignora un `playedAt` inválido y sigue la cadena; es defensivo ante un partido `null`/`undefined`.
- **§9.2 (caso central hoy-y-ayer, 2 tests):** cargar hoy y después ayer — el de hoy sigue siendo el primero; el de ayer queda segundo pese a haberse cargado después.
- **§9.3 (createdAt no altera la historia, 1 test):** un partido jugado antes pero creado mucho después no se impone sobre uno jugado después pero creado antes.
- **§9.4 (compatibilidad histórica, 2 tests):** un registro solo con `finishedAt` resuelve su fecha igual; sigue apareciendo en `filterMatchesForPlayer` sin errores.
- **§9.6 (desempate, 3 tests):** mismo `playedAt` → gana `createdAt` más reciente; mismo `playedAt`+`createdAt` → gana `finishedAt` más reciente; el resultado es determinístico en corridas repetidas.
- **Extra (1 test):** `computeMatchesThisMonth` cuenta por `playedAt`, no por `finishedAt` — reproduce directamente el bug original con un caso donde ambas fechas caen en meses distintos.

**Nota sobre un bug encontrado y corregido durante el desarrollo de los tests (nunca llegó a commitearse roto):** el primer intento del test §9.2 usaba el nombre de jugador `'TestFecha'` en el fixture, que `Store.normalizePlayerName` convierte a `'Testfecha'` al normalizar la búsqueda — el nombre guardado en el fixture (sin normalizar) y el nombre buscado (normalizado) no coincidían, así que `filterMatchesForPlayer` devolvía un array vacío y el test crasheaba al acceder a `matches[0]`. Lo detecté corriendo la suite antes de dar por terminada la fase, lo corregí usando un nombre ya normalizado (`'Sebastián'`, consistente con el resto de los fixtures del archivo) y confirmé 364/364 antes de seguir. Lo documento para que quede claro que no es un bug del código de producción — es un error de mi propio fixture de test, encontrado y corregido en el mismo ciclo.

**Suite preexistente:** las 349 assertions anteriores a esta fase siguen intactas y en verde — no se modificó ninguna.

## 9. Verificaciones manuales realizadas

Todas en navegador, sirviendo `bramulab/` localmente:

1. **Home vacío:** identificación desde cero, sin partidos — Último partido/Forma reciente en su estado vacío correcto.
2. **Caso central hoy-y-ayer, con la app real (no solo tests):** cargué un partido de HOY (6-4 · 6-3, con Martín) desde el "+", confirmé que apareció como Último Partido. Después cargué un partido de AYER (3-6 · 2-6, con Esteban, eligiendo la fecha de ayer en el formulario) desde el mismo flujo. Resultado: **el Home siguió mostrando el partido de HOY como Último Partido**, sin cambios.
3. **Historial global:** confirmé que la fila de HOY aparece primera y la de AYER segunda — orden por fecha jugada, no por orden de guardado (el de ayer se guardó *después* en el tiempo real, y aun así aparece *después* en la lista).
4. **Forma reciente:** `["Victoria", "Derrota"]` en ese orden — coincide con el resultado deportivo real de hoy y ayer respectivamente, no con el orden de guardado.
5. **BRAMU Lab Partidos sin cambios:** confirmado con `git status --short bramulab-partidos` (sin salida — cero archivos modificados) y además visualmente: título "BRAMU Lab Partidos", `PLStore.VERSION === 'v14'`, footer sin cambios.
6. **Consola sin errores nuevos:** en una pestaña limpia, el único mensaje de error presente es el ya documentado de registro de service worker bajo el servidor Python de desarrollo local (preexistente desde antes de esta fase, no relacionado con este código).

## 10. Confirmación: `bramulab-partidos/` no fue modificado

`git status --short -- bramulab-partidos` devuelve vacío antes y después de todo este trabajo. Ningún archivo dentro de esa carpeta se tocó.

## 11. Hash y mensaje del commit

**`39cb821`** — *"BRAMU Lab — Etapa 3, Fase 1: semántica de fecha del partido"* (incluye los 3 archivos de código + el consolidado + este informe).

## 12. Estado del push y despliegue

Pusheado a `main` (`e7d0a26..39cb821`). GitHub Pages completó el build para ese commit exacto (`status: built`, confirmado vía API antes de dar la verificación por cerrada).

**Hallazgo de verificación, documentado con transparencia:** al probar `bramulab/tests.html` en producción por primera vez después del deploy, el navegador de verificación mostró **349/349** en lugar de 364 — no por un problema del código desplegado, sino porque ese mismo navegador ya tenía registrado el Service Worker de `bramulab/` de una visita anterior (de la verificación de la Fase 0), con `app.js`/`player-home.js`/`tests.html` cacheados bajo `bramulab-v1` desde *antes* de este commit. Como esta fase tiene prohibido explícitamente tocar el service worker (§3 del consolidado), no se bumpeó `CACHE_NAME` — así que el Service Worker siguió sirviendo esos tres archivos desde caché (estrategia cache-first) en vez de pedirlos de nuevo a la red.

Desregistré ese Service Worker y borré esa caché puntual en el navegador de verificación (una acción de diagnóstico, no un cambio de código) y confirmé **364/364** en la recarga siguiente — el código desplegado es correcto.

**Implicancia real a tener en cuenta, no una falla de esta fase:** cualquier dispositivo que ya tuviera `bramulab/` instalado/visitado *antes* de este commit (en la práctica, hoy eso probablemente solo aplica al propio dispositivo de verificación de Claude, ya que `bramulab/` recién se creó en la Fase 0 de esta misma sesión) no va a ver el fix hasta que su Service Worker se actualice por otra vía — la app ya tiene una herramienta para eso (mantener presionado el logo ~2s → "Forzar actualización", existente desde antes, sin cambios). Si Sebastián prueba desde un dispositivo que nunca visitó `bramulab/`, no hay ningún problema: recibe la versión nueva directo de la red en la primera visita.

## 13. URL verificada

`https://sebastianvilaa.github.io/BRAMUlab/bramulab/` — confirmado con el Service Worker actualizado: 364/364 tests, caso hoy-y-ayer probado de punta a punta con la app real (cargar un partido de hoy y después uno de ayer vía el flujo real de "+" → Cargar partido jugado), Historial ordenado correctamente, Forma reciente en el orden deportivo correcto. `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` verificado sin cambios (título, `PLStore.VERSION === 'v14'`).

## 14. Desviaciones, supuestos, deuda o decisiones técnicas tomadas

- **Decisión resuelta (no escalada):** significado de `createdAt` para partidos en vivo — ver §4. Justificada por no tener ningún lector previo en la app.
- **Extensión de alcance razonada (no escalada):** orden del Historial global corregido además del Home del jugador — ver §6. Está dentro del objetivo explícito del consolidado, aunque no aparecía en la lista literal de "archivos esperables".
- **Elección del último criterio de desempate:** `matchId` (string, estable, sin significado cronológico propio) — el consolidado pedía "un criterio estable y documentado" sin especificar cuál.
- **No se agregó ningún test de integración/DOM** para los 3 flujos de guardado en sí (`finishMatchManual`/`finishMatch`/`finishMatchGames` escribiendo `playedAt`/`createdAt` correctamente) — el proyecto no tiene arnés de DOM (limitación preexistente, documentada en informes anteriores). Se cubrió con la verificación manual del §9, que ejercita el flujo real de guardado de punta a punta, no solo las funciones puras.
- **No se tocó `finishedAt` en ningún punto** — conserva su comportamiento original en los tres flujos, tal como pedía el consolidado.
- **No hubo ninguna ambigüedad que requiriera detener el trabajo y pedir una decisión de Sebastián.** Todo lo que apareció como duda técnica menor quedó resuelto y documentado arriba.

## 15. Confirmación explícita: no se avanzó a la Fase 2

No se tocó ningún archivo relacionado con la hoja de acciones del botón "+", el rediseño de "Cargar partido jugado", ni ninguna otra superficie fuera del alcance exacto de la Fase 1. El trabajo se detiene acá, a la espera de revisión.
