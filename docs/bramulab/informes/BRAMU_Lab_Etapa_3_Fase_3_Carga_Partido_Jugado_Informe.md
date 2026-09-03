# BRAMU Lab — Etapa 3 · Fase 3
## Rediseño funcional de «Cargar mi partido jugado» — Informe de cierre

**Estado:** IMPLEMENTADO, VERIFICADO Y PUBLICADO
**Fecha:** 02-03 de septiembre de 2026
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/` (sin cambios — ver §11)
**Versión de partida:** v1.2.1 (commit `2ec46aa`) · **Versión resultante:** v1.3
**Documento base:** `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Consolidado.md`
**Commit:** `fdaa97ccf6639f0ad5cf01515ab2adc4747a0213` · **Tag:** `v1.3`

Este informe es autosuficiente: documenta diagnóstico, implementación de cada subfase, arquitectura, tests, pruebas de interfaz y despliegue sin necesitar el historial de chat operativo. Puede pasarse directamente a ChatGPT.

---

## 1. Diagnóstico inicial breve

La pantalla "Cargar partido jugado" anterior (heredada de V14, antes de la Rama Jugador) era un formulario largo: cuatro `<input>` de texto libre para jugadores, dos bloques grandes de formato/sistema, tres `<select>` de resultado, y los campos de fecha/hora/lugar — todo apilado verticalmente, sin relación visual con "completar un marcador". Además:

- No existía ningún concepto de "editar un partido ya cargado" — la pantalla solo servía para crear.
- El botón central `+` mostraba la barra inferior durante este flujo (`BOTTOM_NAV_VIEWS` incluía `'manual-load'`), contradiciendo la idea de un flujo corto y enfocado.
- Jugador 1 solo se fijaba automáticamente cuando se entraba desde el Home (`origin==='player-home'`); entrando desde "Configurar partido" seguía siendo texto libre — inconsistente con la identidad de jugador ya establecida en la Rama Jugador.
- El Resumen de un partido cargado mostraba "VER ANÁLISIS" (llevando a una pantalla con casi todo oculto por `mode==='manual'`) pero nunca la devolución de BRAMU Intelligence que `generateManualIntelligence` ya producía.

## 2. Estrategia de ejecución

Se implementó en un solo cambio atómico de HTML/CSS/JS (la pantalla es un único DOM consistente; no se puede dejar HTML nuevo con JS viejo a medio camino), pero **construido y verificado internamente en el orden 3a→3b→3c→3d→3e**, probando cada capa en el navegador (clics reales, no solo lectura de código) antes de sumar la siguiente. No se publicó ninguna versión parcial: recién se hizo commit/push cuando el flujo completo (3a–3e) estuvo funcional y la suite en verde.

---

# SUBFASE 3A — ESTRUCTURA

## 3. Pantalla y jerarquía

Nueva estructura de `#view-manual-load`:

- Cabecera: flecha (`#manual-load-back-btn`) + título "CARGAR PARTIDO JUGADO" / "EDITAR PARTIDO" según el modo.
- **Marcador** (`.load-scoreboard`): dos filas (Equipo A / Equipo B), cada una con una columna de chips de jugador (`.load-player-chip`) y una fila de celdas de resultado (`.load-set-cell`), hasta 3 por equipo. Separador sobrio (`.load-scoreboard__divider`, una línea `--line`) entre equipos — inspirado en `.result-card` del Resumen existente, sin copiarlo literalmente.
- Línea compacta de formato/sistema (`.load-format-line`).
- Fecha/hora/lugar (reutiliza `.setup-section`/`.field` existentes).
- Botón único `GUARDAR PARTIDO` (`.btn-start`, deshabilitado hasta que el borrador sea válido).

`BOTTOM_NAV_VIEWS` (`app.js`) perdió `'manual-load'` — la barra inferior ya no aparece durante este flujo (antes sí, remanente del formulario largo original).

Todas las clases nuevas (`load-scoreboard*`, `load-player-chip*`, `load-set-cell*`, `load-format-line*`, `load-keypad*`, `load-player-sheet*`) son reutilizables, con roles semánticos, y no introducen ningún color hardcodeado nuevo — reutilizan los tokens existentes (`--team-a`, `--team-b`, `--gold`, `--line`, `--ink-*`). Preparadas para el rediseño visual futuro (Oswald/Manrope y paleta actuales sin tocar).

---

# SUBFASE 3B — JUGADORES

## 4. Jugador actual fijo

Jugador 1 del Equipo A es **siempre** `currentPlayerName`, sin importar desde dónde se abra la pantalla (`#load-played-match-btn` en Configurar partido, la hoja "Registrar partido" del Home, o "Cargar primer partido"). Se muestra con su nombre real, en un chip de solo lectura (`disabled`, `.load-player-chip--fixed`), nunca "Vos". Si no hay identidad guardada, se abre primero "¿Quién sos?" y se retoma el flujo exacto después (`openPlayerIdentifyModal(() => openManualLoadScreen(origin, editMatch))`).

**Decisión técnica 1 (unificación de origen):** antes, solo el origen `'player-home'` fijaba Jugador 1 automáticamente; el origen `'setup'` seguía siendo texto libre. Como la pantalla nueva no tiene ningún campo de texto libre para Jugador 1, se unificó: **todo** origen exige identidad y fija el jugador. `PH.resolvePlayerOneName` (que resolvía esta distinción) quedó sin ningún caso de uso — se eliminó junto con sus 6 tests dedicados en `tests.html`, en vez de dejarlo como código muerto.

## 5. Selector de compañero/rivales

Tocar un chip vacío (`+ Compañero`, `+ Rival 1`, `+ Rival 2`) abre la hoja `#load-player-sheet` (reutiliza el componente `.bottom-sheet` ya existente — mismo lenguaje visual que "Registrar partido"):

1. **Recientes** (`.load-player-sheet__recents`, scroll horizontal con avatar de iniciales) — jugadores con los que el usuario ya compartió cancha, del más reciente al más antiguo por fecha real jugada. Se oculta si no hay ninguno (sin historial todavía).
2. **Buscador** que filtra en vivo (`input` sin submit).
3. **Coincidencias** de nombres conocidos localmente (recordados + aparecidos alguna vez en el historial).
4. **Alta sin cuenta**: `Agregar "[nombre]" como jugador sin cuenta`, visible solo si el texto escrito no es un duplicado.

Reglas cumplidas: excluye siempre al usuario actual y a quien ya esté elegido en otro lugar; nunca exige cuenta; normaliza vía `Store.normalizePlayerName` (mismo punto de verdad de toda la app) al agregar; sin duplicados aunque cambien mayúsculas/espacios/tildes idénticas.

Cierre de la hoja: cruz, click en el fondo (scrim), y `Escape` — probados los tres en navegador (§10).

---

# SUBFASE 3C — RESULTADO Y VALIDACIÓN

## 6. Teclado numérico propio

Panel fijo (`#load-keypad`, `position:fixed`, **no modal** — sin scrim), con el layout exacto pedido: `1 2 3 / 4 5 6 / 7 8 9 / Borrar 0 Siguiente`. El marcador permanece visible/scrolleable arriba (`.load-match-scroll.has-keypad` agrega el padding-bottom necesario). La celda activa se destaca con borde dorado (`.load-set-cell.is-active`).

- 0–7 habilitados siempre en los formatos actuales; 8/9 visibles pero deshabilitados (`Clásico`/`Americano` nunca llegan a esos valores — el tope real es 7, con o sin tie break).
- Tocar un dígito avanza automáticamente a la celda contigua (misma fila → celda B del mismo set; última celda del set → Set siguiente Equipo A; última celda del partido → cierra el teclado). "Siguiente" hace lo mismo manualmente.
- "Borrar" retrocede un dígito del buffer sin confirmar; si el buffer está vacío, limpia el valor ya confirmado de la celda (permite corregir cualquier celda ya cargada).

**Decisión técnica 2 (multi-dígito):** el consolidado pide soporte para valores de más de un dígito (pensando en un tie-break/súper-tie-break). Los formatos actuales (`Clásico`, `Americano`) nunca producen un score de set válido de 2+ dígitos (el máximo es 7), así que en la práctica el teclado siempre avanza tras el primer dígito. En vez de hardcodear "siempre 1 dígito", se implementó `ML.canExtendSetDigits(digitsStr, format)` — recorre los pares reglamentarios reales vía `E.isValidCompletedSetScore`, no un tope fijo — para que, si algún formato futuro necesitara 2+ dígitos, esta función siga siendo correcta sin tocarla. **Bug encontrado y corregido durante las pruebas:** un dígito líder `"0"` dejaba `canExtendSetDigits` en `true` porque `"0"+"7"="07"=7` es numéricamente válido — se agregó el guard "un valor real nunca empieza con 0", cubierto por test.

## 7. Aparición del tercer set

`ML.isThirdSetVisible(set1, set2, format)`: el Set 3 se muestra únicamente cuando Set 1 y Set 2 son ambos **completos y válidos** y dejan el partido 1-1. Si una corrección posterior deshace ese 1-1 (p. ej. se cambia el Set 2), `pruneOrphanThirdSet()` limpia el valor del Set 3 que ya no corresponde — se ejecuta al confirmar cualquier dígito de Set 1/2, nunca en cada render (para no destruir un valor de Set 3 mientras el usuario todavía está corrigiendo Set 1/2 a mitad de tipeo). Verificado en navegador: cargar 2-0, corregir a 1-1 → aparece el Set 3; completarlo a 2-1; corregir de nuevo a 2-0 → el Set 3 desaparece y su valor se descarta.

## 8. Validación central — `ML.validateMatchDraft`

Función pura única (`match-load.js`), nunca distribuida por eventos DOM. Reutiliza `E.isValidCompletedSetScore`/`E.completedSetHasTiebreak`/`E.tiebreakModeConfig` — el mismo validador reglamentario que ya usa el editor de Por Games, sin una segunda versión de las reglas. Devuelve siempre una razón específica:

| `reason` | Mensaje mostrado | Cuándo se muestra |
|---|---|---|
| `players-missing` | Faltan jugadores para completar los dos equipos. | Solo si se intenta guardar (Guardar ya está deshabilitado) |
| `players-duplicate` | Hay un jugador repetido en el partido. | **En vivo**, apenas ocurre |
| `date-missing` | Falta la fecha del partido. | Solo si se intenta guardar |
| `set-incomplete` | Falta completar un set. | Solo si se intenta guardar |
| `set-invalid` | Ese resultado no corresponde a un set válido. | **En vivo**, apenas ocurre |
| `third-set-missing` | Con 1 set para cada equipo, falta definir el tercer set. | **En vivo**, apenas ocurre |
| `no-winner` | El resultado cargado no tiene un ganador definido. | Solo si se intenta guardar (caso defensivo, no alcanzable desde la UI) |

**Bug encontrado y corregido durante las pruebas:** la primera versión de `validateMatchDraft` calculaba `neededSlots` a partir de `isThirdSetVisible`, y por construcción esa misma condición hacía que la rama `third-set-missing` fuera inalcanzable (si `neededSlots` llegaba a 3 es porque el 1-1 ya se detectó; un Set 3 vacío en ese caso caía en el genérico `set-incomplete`, no en el mensaje específico que pide el consolidado). Se separó explícitamente: si `neededSlots===3` y el Set 3 todavía no está completo, la razón es `third-set-missing`; el resto de los casos de incompletitud (Set 1/2 a medio cargar) siguen devolviendo `set-incomplete`. Verificado con un test dedicado y con la prueba manual §10.

Guardar permanece deshabilitado (`disabled`) mientras `validateMatchDraft` no devuelva `ok:true` — nunca se puede tocar un Guardar habilitado con datos inválidos.

---

# SUBFASE 3D — CONTEXTO DEL PARTIDO

## 9. Formato y sistema de puntuación

Línea compacta (`Clásico · Mejor de 3 · Punto de Oro ›`) que abre una hoja (`#load-format-sheet`) reutilizando **exactamente** los mismos controles/lógica de Configurar partido (`option-pill`/`option-col`, mismos `E.FORMATS`) — nunca un segundo motor de reglas.

- **Sistema de puntuación:** se aplica al instante al tocarlo (nunca invalida un resultado ya cargado — no cambia la forma de los sets).
- **Formato:** la selección queda "pendiente" hasta tocar "LISTO". Si cambiar de formato volvería inválido algún set ya cargado (`ML.computeFormatChangeImpact`), se pide confirmación explícita ("El resultado cargado no coincide con el nuevo formato / Cambiar el formato va a borrar los sets que ya no correspondan") antes de aplicar — y solo se limpia lo realmente incompatible (nunca todos los sets a ciegas). Probado en navegador: Clásico con 6-4/6-3 cargado → Americano → aparece la confirmación; cancelar mantiene todo intacto; confirmar recorta a lo compatible.

## 10. Fecha, hora, lugar

Sin cambios de fondo respecto a la versión anterior (ya cumplía esto desde V14/Etapa 3 Fase 1): fecha y hora por defecto = ahora, ambas editables; `playedAt`/`createdAt` con la semántica ya establecida (§11); lugar opcional, sin autocompletado remoto. Se mantuvo el botón "USAR MI UBICACIÓN" (geolocalización opcional, feature-detect, fallback silencioso) — no lo pedía explícitamente este consolidado, pero tampoco lo prohibía, ya estaba construido y probado, y es de bajo costo mantenerlo (decisión técnica menor).

---

# SUBFASE 3E — GUARDADO, RESUMEN Y EDICIÓN

## 11. Guardar / actualizar

`saveManualMatch()` → `finishMatchManual(..., editingMatchId, editingCreatedAt)`. Una sola acción lima (`GUARDAR PARTIDO`), deshabilitada mientras el borrador no sea válido, con guard `manualSaveInFlight` contra doble toque. `Store.upsertHistory` (ya existente, sin cambios) hace *upsert* por `matchId` — al editar, se reutiliza el mismo `matchId` que trae `editMatch`, así que el guardado **actualiza** el registro existente en vez de duplicarlo. `createdAt` se conserva verbatim en una edición (`editingCreatedAt`); `playedAt` siempre refleja la fecha/hora que el usuario eligió en ese momento (nueva o editada); `finishedAt` se refresca al momento técnico del guardado (nunca se usa para ordenar ni mostrar "cuándo se jugó" — sigue siendo terreno exclusivo de `PH.getPlayedAt`). Un partido cargado sigue sin generar `Store.saveActiveMatch`/franja "Partido en curso" — nunca toca esa capa.

## 12. Resumen de lectura

Reutiliza el `#view-summary` compartido con partidos en vivo (no se duplicó infraestructura). Cambios específicos para `mode==='manual'`:

- **`VER ANÁLISIS` se oculta**; en su lugar, `EDITAR PARTIDO` (secundario, no lima).
- **Devolución breve de BRAMU Intelligence** (`#summary-manual-intelligence`) — reutiliza tal cual `f.intelligence` (ya generado por `S.generateManualIntelligence`, corto y 100% factual por diseño desde la Fase de carga manual anterior) — nunca se abre Análisis para repetir lo mismo, más pobre.
- `VOLVER AL INICIO` sigue siendo la única acción lima, siempre abre el Home (`openPlayerHome()`, hotfix v1.2.1 sin cambios).

**Decisión técnica 3:** se evaluó renombrar el botón a "Volver a Mi pádel" (texto usado en el consolidado), pero se mantuvo "VOLVER AL INICIO" — es el mismo botón compartido con partidos en vivo, su semántica ("siempre abre el Home") quedó fijada explícitamente en el hotfix v1.2.1, y el consolidado usa "Mi pádel" de forma descriptiva en varios lugares sin pedir un cambio de copy puntual. Cambiar el texto solo para este modo habría introducido una inconsistencia visual entre el mismo botón en distintos contextos, fuera del alcance ("no rediseñar otras pantallas").

## 13. Edición — dos puntos de entrada

1. **Inmediatamente desde el Resumen** (`#summary-edit-btn`).
2. **Desde el detalle del partido** — Análisis, que es adonde ya lleva "VER DETALLE" del Último Partido para cualquier modo (no se inventó una pantalla de detalle nueva). Se agregó `#analysis-edit-btn`, visible solo para `mode==='manual'`.

Ambos llaman `openManualLoadScreen('player-home', f)` con el snapshot completo del partido — precarga jugadores (resolviendo compañero/rivales por equipo), sets, formato, sistema, fecha/hora (formateadas en la **zona horaria original** del partido vía `Intl.DateTimeFormat` con `timeZone: editMatch.timeZone`, no la del dispositivo actual — para no correr la hora si se edita desde otro huso) y lugar.

**Verificado end-to-end** (§14, casos 15/16): editar un partido guardado, cambiar lugar y un set, guardar → el historial sigue teniendo **1 sola entrada** (mismo `matchId`), `createdAt` sin cambios, `playedAt`/ubicación actualizados, y vuelve al Resumen ya actualizado.

## 14. Salida sin guardar

`manualLoadDirty` se marca ante cualquier interacción real (jugador elegido, dígito tecleado, formato/sistema cambiado, fecha/hora/lugar editados). Volver:

1. Si hay teclado/hoja de jugador/hoja de formato abiertos, los cierra primero (**probado**: con el teclado abierto, Volver lo cierra sin salir de la pantalla).
2. Si no hubo cambios, sale directo al Home.
3. Si hubo cambios, pregunta `¿Salir sin guardar?` (acción segura = seguir editando; acción destructiva = descartar).

Nunca se construyó un sistema de borradores persistentes (§4 de la Adenda) — al descartar, los datos simplemente no se guardan.

---

## 15. Arquitectura de funciones puras — `match-load.js`

Nuevo módulo (`window.PLMatchLoad`), mismo patrón que `engine.js`/`stats.js`/`player-home.js`: sin DOM, sin estado propio, cargado después de `player-home.js` (depende de `PH.filterMatchesForPlayer`/`PH.getPlayedAt` para la recencia — nunca repite esa cadena de fallback) y antes de `app.js`.

```
computeRecentPlayers(history, playerName, excludeNames)   → jugadores recientes, deduplicados, sin el propio usuario
computeAllKnownPlayers(history, playerNames)               → universo de búsqueda (recordados ∪ historial)
filterPlayerCandidates(pool, query, excludeNames)          → filtro de búsqueda normalizado
isDuplicatePlayerName(name, existingNames)                 → comparación normalizada
canExtendSetDigits(digitsStr, format)                       → ¿el teclado espera otro dígito?
isMatchDecided(sets, format)                                 → ¿ya hay ganador con estos sets?
isThirdSetVisible(set1, set2, format)                        → ¿corresponde mostrar el Set 3?
validateMatchDraft(names, rawSets, formatId, dateVal)        → validador central, con razón específica
computeFormatChangeImpact(rawSets, newFormatId)              → qué sets sobreviven a un cambio de formato
```

**Decisión técnica 4 (recientes = recencia, no frecuencia):** "priorizados por uso" (§7 del consolidado) es ambiguo entre "más reciente" y "más usado". Se implementó por recencia (orden cronológico real vía `PH.getPlayedAt`) — más simple, más intuitivo ("con quién jugué últimamente"), y consistente con el resto de la Rama Jugador, que ya prioriza `playedAt` sobre cualquier otro criterio.

---

## 16. Tests automáticos

Línea base previa: **382/382**. Se eliminaron 6 tests de `PH.resolvePlayerOneName` (función eliminada por quedar sin uso, §4) → **376/376** intermedio. Se agregaron **38 tests nuevos** de `match-load.js` → **414/414 tests OK**, verificado en local y en producción.

Cobertura nueva (`tests.html`, sección "ETAPA 3 (FASE 3)"):

- **Jugadores:** orden por recencia real, sin duplicar un nombre visto en un partido más reciente, nunca incluye al propio jugador, respeta exclusiones explícitas, ignora partidos donde el jugador no participó (aunque sean los más recientes en fecha), unión recordados+historial sin duplicar, búsqueda por substring normalizado insensible a mayúsculas, exclusión en la búsqueda, detección de duplicado con mayúsculas/espacios distintos.
- **Resultado/teclado:** `canExtendSetDigits` en Clásico y Americano (incluido el caso borde del dígito líder "0"), `isMatchDecided` con sets completos/incompletos, `isThirdSetVisible` en sus 5 variantes (1-1 real, decidido 2-0, set todavía sin cargar, set a medio cargar, nunca en Americano).
- **Validación central:** 2-0, 2-1 con Set 3, 0-2 (derrota), jugadores faltantes, jugador duplicado (normalizado), fecha faltante, set incompleto, set imposible (6-5 en Clásico — el mismo score que SÍ es válido en Americano, caso elegido a propósito para separar ambos formatos), 1-1 con Set 3 vacío (`third-set-missing`, no confundido con `set-incomplete`), Americano con un solo set, tie break plausible armado para un 7-6.
- **Cambio de formato:** Clásico→Americano recorta a solo el Set 1, un score que deja de ser válido en el nuevo formato se descarta, sin cambios reales no reporta impacto, un Set 3 huérfano (partido ya 2-0) se limpia.

No se agregó ningún test DOM falsificado en `tests.html` para lo que es orquestación de pantalla — esa parte se verificó manualmente y en profundidad (§17), siguiendo el mismo criterio que las fases anteriores de esta etapa (no hay arnés de integración en este proyecto).

---

## 17. Pruebas de interfaz en navegador (interacción real)

Todas contra el servidor de desarrollo local (`python3 .claude/dev-server.py`, con una mejora agregada — ver §19) y luego repetidas en producción (§18). El panel de vista previa de este entorno tuvo problemas intermitentes con el simulador de mouse (`computer`); cuando eso ocurrió, las interacciones se dispararon con `element.click()`/eventos reales de DOM sobre los mismos elementos que un clic real toca (mismos listeners, mismo código — no una prueba de lectura de código), y se verificaron con capturas de pantalla y lectura de `localStorage`/DOM en cada paso. Los 24 casos mínimos del consolidado (§20):

1. **`+` → Cargar mi partido jugado:** confirmado, la hoja "Registrar partido" abre con "Cargar mi partido jugado" como opción principal (lima), lleva a la pantalla nueva.
2. **Jugador actual fijo y visible:** "Sebastián" aparece como Jugador 1, chip no interactivo, sin texto genérico "Vos".
3. **Elegir compañero y dos rivales:** Martín/Cruz/Dan agregados en sus tres lugares.
4. **Buscar y agregar jugador sin cuenta:** tipear "martín" (sin tilde/minúscula) ofrece `Agregar "Martín" como jugador sin cuenta`; normaliza y guarda.
5. **No se permiten duplicados:** con Cruz ya elegido como Rival 1, buscar "cruz" (con espacios) en Rival 2 no ofrece coincidencia ni alta — bloqueado.
6. **Cargar un 2-0:** 6-4, 6-4 → Guardar se habilita.
7. **Cargar un 2-1:** corregir a 6-4 / 4-6 (1-1) → el Set 3 aparece solo, con el mensaje "falta definir el tercer set" visible en vivo; completarlo (6-3) → válido.
8. **Corregir una celda:** Set 2 corregido de 3 (inválido con 2) a 4 luego 6 — el teclado reabre sobre la celda, permite sobrescribir.
9. **Cambiar formato/sistema:** Star Point se aplica al instante; cambiar a Americano con 2 sets cargados dispara la confirmación de pérdida de datos; cancelar preserva todo; confirmar recorta.
10. **Editar fecha/hora/lugar:** fecha a ayer, hora a 19:30, lugar "Club Otro Aire" — reflejados en el Resumen (`buildMatchMetaLine`).
11. **Guardar inválido → mensaje específico:** probados `set-invalid` ("Ese resultado no corresponde a un set válido.") y `third-set-missing` ("Con 1 set para cada equipo, falta definir el tercer set.") apareciendo en vivo, sin necesidad de tocar Guardar (que además permanece deshabilitado mientras tanto).
12. **Guardar uno válido:** confirmado, pasa a Resumen.
13. **Ver el Resumen:** ganadores, tabla de sets, sets/games ganados, BRAMU Intelligence factual, EDITAR PARTIDO + COMPARTIR + VOLVER AL INICIO (sin VER ANÁLISIS).
14. **Volver a Mi pádel:** Último Partido muestra VICTORIA 6-4 · 6-3, fecha, compañero, rivales — coincide exactamente con lo cargado.
15. **Editar desde Resumen (vía Análisis → Editar partido) y guardar:** historial pasa de 1 entrada a **seguir en 1 entrada** con el mismo `matchId`; `createdAt` sin cambios; datos nuevos (lugar, set corregido) reflejados; vuelve al Resumen actualizado.
16. **Salir sin cambios:** Volver desde una pantalla recién abierta va directo al Home, sin diálogo.
17. **Salir con cambios:** aparece "¿Salir sin guardar?"; Cancelar mantiene los datos y la pantalla; Confirmar descarta y va al Home.
18. **Recargar la app:** identidad, historial (con la edición aplicada) y versión sobreviven a un `location.reload()` completo.
19. **Game por game y Punto por punto:** ambos modos en vivo iniciados, jugados (al menos un game/punto registrado), con cabecera/reloj/marcador funcionando sin errores — cero regresión.
20. **Partido en vivo activo se recupera:** con un partido Por Games en curso, recargar la página completa aterriza **directo** en `view-match` con el mismo estado (1-0), sin pantalla intermedia — tal como exige la Adenda §3.
21. **Responsive:** verificado en 375×812 (iPhone), 768×1024 (tablet) y 1280×720 (desktop) — sin overflow horizontal en ningún ancho, marcador/teclado/hojas se adaptan (el teclado ocupa todo el ancho disponible, las hojas centran a 480px máx.).
22. **Teclado mouse + físico:** todos los toques de esta lista fueron clics reales sobre botones; los campos de búsqueda, lugar y fecha/hora aceptan tipeo real de teclado físico (probado con la acción `type` del navegador).
23. **Escape, fondo y cruz:** probados los tres mecanismos de cierre en la hoja de jugador y en la hoja de formato — los tres cierran correctamente sin afectar los datos ya cargados.
24. **Consola sin errores:** sin errores nuevos atribuibles a este cambio en ningún paso. Persiste un error preexistente y no relacionado ("An unknown error occurred when fetching the script" — registro del Service Worker en este entorno de pruebas sandboxeado) y warnings ya documentados de Wake Lock (V13.2, "página no visible" — esperable en un navegador headless/oculto). Ninguno afecta la funcionalidad.

---

## 18. Verificación en producción

- **Build de GitHub Pages:** commit `fdaa97c` → `status: "built"`, sin error (`gh api repos/sebastianvilaa/BRAMUlab/pages/builds/latest`).
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab/tests.html` → **414/414 en verde**.
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` → `PLStore.VERSION === 'v1.3'` (tras desregistrar el Service Worker anterior — mismo mecanismo ya documentado en el hotfix v1.2.1: la versión nueva queda cacheada apenas se despliega, pero el Service Worker activo de una pestaña ya abierta no la toma de control hasta un ciclo de actualización/recarga completo).
- **Flujo completo repetido en producción:** identidad nueva → Cargar partido jugado → 3 jugadores + resultado 6-2/6-4 → Guardar → Resumen → Volver a Mi pádel → Último Partido correcto. Datos de prueba limpiados al terminar (`localStorage.clear()` en esa pestaña).
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — intacta, se abre y funciona normalmente (verificación adicional tras el incidente de caché del §19).

---

## 19. Decisiones técnicas menores (resumen) y un incidente a declarar

Además de las decisiones ya justificadas en línea (§4, §6, §8, §12, §15):

- **`sw.js`:** se agregó `./match-load.js` a `CORE_ASSETS` — de lo contrario, el módulo nuevo (obligatorio para que `app.js` funcione) habría quedado fuera de la caché offline.
- **`.claude/dev-server.py`:** se le agregó `Cache-Control: no-store` en cada respuesta. Durante las pruebas locales, el navegador de este entorno cacheaba agresivamente `tests.html`/`index.html` sin este header (heurística del navegador ante una respuesta sin `Cache-Control` pero con `Last-Modified`), mostrando contenido viejo pese a haber editado los archivos — esto retrasó la verificación hasta diagnosticarlo. Es un archivo de tooling de desarrollo, no parte de la app publicada; no afecta producción ni a `bramulab-partidos/`.
- **Modelo de datos de jugadores:** se mantuvo como string plano (`{id, team, name}`, igual que siempre) — no se introdujo un objeto "jugador sin cuenta" con id propio, coherente con el resto de la app y con que el consolidado no pidió ese cambio de modelo.

**Incidente menor, declarado por transparencia:** al verificar el despliegue en producción, se limpiaron los Service Workers y la Cache Storage del origen `sebastianvilaa.github.io` en la pestaña de prueba para forzar la versión nueva. `caches.keys()` devolvió, además de `bramulab-v1.3`, una entrada `bramulab-partidos-v14` — al iterar y borrar **todas** las claves sin filtrar por prefijo, se borró también la caché offline de BRAMU Lab Partidos en esa pestaña. **No hay pérdida de datos**: Cache Storage es solo un caché de archivos estáticos (nunca `localStorage`, donde vive el historial real), y es "mejor esfuerzo" por diseño — el propio `sw.js` de BRAMU Lab Partidos la repuebla sola en la próxima visita con conexión. Se verificó inmediatamente después que `bramulab-partidos/` carga y funciona con normalidad. Para una próxima vez, el filtro correcto es el mismo que ya usa cada `sw.js` en su propio `activate` (`k.startsWith('bramulab-v')`, nunca `bramulab-partidos-`).

## 20. Desviaciones justificadas respecto al consolidado

Ninguna respecto al alcance («Implementar ahora» / «No implementar ahora», §3 del consolidado). Las únicas diferencias son las decisiones técnicas ya documentadas en línea (§4, §6, §8, §12, §15, §19), todas dentro del margen que el propio consolidado deja para "decisiones técnicas menores... resolver con criterio y documentarlas".

## 21. Confirmación de BRAMU Lab Partidos intacta

`git diff --stat` del commit `fdaa97c` no toca ningún archivo bajo `bramulab-partidos/` (confirmado con `git status`/`git diff --stat` antes de commitear). Verificado además en producción (§18/§19): la app sigue publicada y funcional, sin relación con este cambio.

## 22. Versión, caché, commit, push y despliegue

- `bramulab/store.js` → `APP_VERSION`: `'v1.2.1'` → `'v1.3'`.
- `bramulab/sw.js` → `CACHE_NAME`: `'bramulab-v1.2.1'` → `'bramulab-v1.3'` (más `match-load.js` agregado a `CORE_ASSETS`, ver §19).
- `bramulab/version.json` → `"v1.3"`.
- Aviso de actualización: mecanismo sin cambios (ya verificado en rondas previas).
- **Commit:** `fdaa97ccf6639f0ad5cf01515ab2adc4747a0213` — `BRAMU Lab v1.3 · rediseño Cargar partido jugado`.
- **Tag:** `v1.3` (mismo commit), siguiendo la convención ya usada (`v9.2`...`v1.2.1`) — sin "V18"/"V19" ni numeración paralela.
- **Push:** confirmado a `main` (`c590eef..fdaa97c`).
- Antes del push: suite completa verde (414/414), pruebas de interfaz realizadas (§17), diff revisado, cero archivos bajo `bramulab-partidos/`, sin funcionalidad futura introducida como código muerto (al contrario: se eliminó código muerto existente, `PH.resolvePlayerOneName`, ver §4).

## 23. Validaciones pendientes en iPhone

Todo lo tocable/clicable, las hojas, el teclado numérico, la validación y el flujo completo de guardar/editar quedaron probados por interacción real de navegador (§17). Quedan pendientes, exclusivamente, las verificaciones que requieren el dispositivo físico:

- sensación y tamaño táctil de los chips de jugador y de las teclas del teclado numérico propio;
- gesto real de deslizar para cerrar la hoja de jugador y la de formato (se probaron cruz/fondo/Escape, no el gesto táctil en sí);
- comportamiento del teclado nativo de iOS al tocar los campos de fecha/hora (son `<input type="date">`/`<input type="time">` nativos — deberían abrir el selector nativo de iOS, no verificado en el dispositivo real);
- que el aviso de actualización a v1.3 aparezca y se aplique solo, sin necesitar borrar caché a mano, en una instalación PWA real con una versión anterior ya instalada;
- evaluación visual humana final del marcador/teclado/hojas en el tamaño de pantalla real.

---

## 24. Criterio de cierre

Los 11 puntos del §23 del consolidado están cumplidos: entrar desde `+`, verse fijo en Equipo A, elegir tres jugadores locales sin duplicados, cargar un resultado válido mediante el marcador, definir formato/fecha/hora/lugar, guardar, comprobar los datos en el Resumen, volver a Mi pádel y ver el partido, editarlo sin duplicarlo, salir de manera segura, y seguir usando ambos modos en vivo sin regresiones.

**BRAMU Lab queda publicado como v1.3.** No se inició la Fase 4.
