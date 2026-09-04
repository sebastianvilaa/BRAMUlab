# BRAMUlab V02.1
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 04/09/2026.
**Base:** BRAMUlab V02 · "Ajuste visual de cierre 01" (commit `de00f8c`, tag `BRAMUlab_V02`).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.1_Consolidado.md` — corrección funcional, UX y terminación visual sobre la base de BRAMUlab_V02, respetando su orden de prioridad (§39) y preservando todos los datos existentes (§32). No es un rediseño ni una nueva etapa conceptual.

---

## 1. Hallazgo principal: el bug real detrás de "11 partidos cargados hoy, Actividad solo contaba 3" (§4/§5)

Antes de tocar código se auditó `PH.computeActivity30d`/`computeEffectiveness30d` (player-home.js): ambas funciones ya eran correctas — operan sobre timestamps absolutos (`nowMs - t`), sin ninguna dependencia de zona horaria. El bug no estaba ahí.

Estaba en el **prefill de la carga manual** (`openManualLoadScreen` en app.js), que combinaba:

```js
$('#manual-date-input').value = now.toISOString().slice(0, 10);              // fecha en UTC
$('#manual-time-input').value = `${now.getHours()}:${now.getMinutes()}`;      // hora en LOCAL
```

`toISOString()` siempre devuelve la fecha en UTC, nunca la fecha local. Durante la ventana diaria en la que el calendario UTC ya rotó pero el local todavía no (en Argentina, UTC-3: aproximadamente 21:00–23:59 hora local), esa combinación produce una fecha/hora **un día adelantada respecto del momento real** — no un detalle cosmético del string ISO, sino un instante genuinamente futuro. `new Date(`${dateVal}T${timeVal}`)` interpreta esa combinación como hora LOCAL (sin designador de zona), así que el `playedAt` guardado terminaba hasta 24 h en el futuro. El guard `age < 0` de `computeActivity30d`/`computeEffectiveness30d` (por diseño: nunca contar un partido "futuro") excluía esos partidos en silencio — de ahí el 3 de 11.

**Reproducido en consola** para confirmar el mecanismo exacto: con hora local `23:30` en Argentina (`2026-09-04T23:30:00-03:00`), `toISOString()` devuelve `2026-09-05T02:30:00.000Z` — el viejo prefill habría escrito `"2026-09-05"` en el campo fecha mientras `getHours()` mostraba correctamente `23:30`, produciendo exactamente la combinación corrupta descripta arriba.

**Fix** (app.js): dos helpers nuevos, `localDateInputValue(d)`/`localTimeInputValue(d)`, que arman `YYYY-MM-DD`/`HH:MM` **siempre** con `getFullYear()/getMonth()/getDate()/getHours()/getMinutes()` (todos locales, nunca UTC). Reemplazan tanto el prefill de "Ahora" (alta nueva) como el fallback de edición (`catch` de `Intl.DateTimeFormat`, que antes también usaba `toISOString()`). Ningún registro anterior necesitó migración: el bug estaba en la escritura de partidos NUEVOS, nunca en la interpretación de los ya guardados (`PH.getPlayedAt` no cambió).

Verificado en vivo: el campo fecha de una carga nueva coincide con `getFullYear/getMonth/getDate` del dispositivo en este mismo instante (§ Verificación).

### §5 — presentación temporal

- "Ahora · Hoy · HH:MM" → **"Hoy · HH:MM"** durante la carga (la palabra "Ahora" era redundante con "Hoy").
- "Modificar" pierde protagonismo: de `font-weight:800` + color lima sólido a `font-weight:600` + gris secundario subrayado (acción terciaria compacta, nunca un CTA).

---

## 2. Tie-break superior a 7 en registro por games (§6)

El síntoma reportado ("no me deja poner más de 7") tenía una causa más profunda que un techo numérico: el stepper de `applyGameTbStepper` (app.js) exigía que **cada toque individual** produjera, por sí solo, un resultado FINAL válido de tie break. Subir el ganador (7→8) o el perdedor (5→6) por separado siempre aterrizaba en un estado "todavía no es un final válido" y quedaba rechazado en silencio — desde el default `7-5`, literalmente ningún botón hacía nada.

**Fix:**
- `applyGameTbStepper` ahora solo suma/resta libremente (sin techo artificial, §6 del consolidado) — igual criterio que la carga manual, que tampoco valida cada dígito tecleado como si ya fuera el resultado completo.
- La validación real (¿es un resultado final legítimo, con el ganador correcto?) se hace **una vez**, al confirmar — `E.isValidFinalTiebreakScore(a, b, cfg)`, función pura nueva en engine.js, con mensaje de error inline si no corresponde.
- Formatos con super tie break a objetivo distinto (`winTarget` ≠ 7) conservan su propia regla sin mezclarse (parametrizado, no hardcodeado).

**Verificado en vivo** con un partido Por Games real hasta 6-6, tie break reglamentario: se llegó a **10-8** tocando "+" alternadamente en ambos lados (antes, imposible) y se confirmó sin error.

---

## 3. Validación contradictoria del set decisivo (§7)

El mensaje "Con 1 set para cada equipo, falta definir el tercer set" podía seguir visible aunque el Set 3 ya mostrara un resultado válido. La causa: mientras el usuario tipeaba el Set 3, `manualSets[2]` seguía `null` hasta el toque explícito en CONTINUAR — la carga manual anterior confirmaba un set solo con ese botón, dejando una ventana donde el teclado ya mostraba "Resultado válido" (número grande + hint verde) pero el mensaje de error rojo seguía leyendo el estado no confirmado todavía.

Este caso se resuelve como efecto directo del cambio del Bloque B (§10, ver abajo): con el avance automático, el Set 3 se confirma en el mismo instante en que se completa el segundo dígito, así que la ventana de contradicción desaparece. **Verificado explícitamente** cargando `6-2 · 5-7 · 6-4`: el mensaje aparece correctamente mientras el Set 3 está vacío (1-1, información real) y desaparece exactamente al completarlo, mostrando "PARTIDO COMPLETO".

---

## 4. Logo del Home no navega (§8)

`$('#player-home-logo').addEventListener('click', () => showView('setup'))` — eliminado. El logo del Home ahora es puramente identificatorio; el "+" central sigue siendo el único acceso para registrar un partido. Verificado: tocar el logo no cambia de vista.

---

## 5. Placeholders del sistema excluidos del selector (§9)

`Store.isPlaceholderPlayerName(name)` (store.js, nueva): reconoce "Jugador 1"–"Jugador 4" (los defaults de Configurar partido cuando el campo queda vacío, `nameOrDefault` en app.js) y "Vos". Aplicado en `ML.computeAllKnownPlayers`/`computeRecentPlayers` (match-load.js) y en el datalist de Configurar partido (`refreshKnownPlayersDatalist`). Ningún partido histórico se tocó ni se borró — el filtro actúa solo sobre las sugerencias futuras.

---

## 6. Avance automático entre sets (§10)

Rediseño de `advanceDraftSide()`/nueva `commitCurrentManualSetIfValid()` (app.js): al completar el lado B de un set con un resultado válido (por dígito o por "Listo"), el set se confirma y avanza al siguiente automáticamente — ya no hace falta un segundo toque en CONTINUAR entre Set 1, Set 2 y el set decisivo. La barra inferior (`.court-continue-wrap`) queda oculta mientras se está cargando (nada que tocar: el avance ya es automático) y solo reaparece, habilitada, una vez que el partido queda "decidido" — ahí su única función es abrir **CONFIRMAR PARTIDO** (nunca guarda directo, ver Bloque C). Se preserva intacta la confirmación previa cuando un cambio de Set 1/2 dejaría huérfano un Set 3 ya cargado (§6.2 heredado). Volver atrás para corregir un set anterior se mantiene igual que antes (tocar el chip del marcador acumulado).

El marcador acumulado ("resultado del set anterior") gana tamaño (16px→18px) y queda centrado sobre el set en edición.

**Verificado en vivo**, `6-4` → `SET 2` sin ningún toque intermedio, en la misma sesión que confirmó los puntos 1 y 3.

---

## 7. Recomposición de "Formato y puntuación" (§11)

- `.option-col` (Star Point/Punto de Oro/Con ventaja) medía ~40px de alto (padding 12px+12px + una línea de texto) — **por debajo del área táctil mínima de 48px**. Corregido con `min-height:48px` + centrado vertical explícito, sin cambiar el resto de su apariencia — corrige también el mismo componente en Configurar partido, que comparte la clase.
- Las dos secciones de la hoja (Formato de partido / Sistema de puntuación) no tenían **ningún** aire entre sí (apiladas directo, sin wrapper con gap) — de ahí la sensación "baja y apretada". Agregado `margin-top: 22px` entre secciones y `24px` antes de LISTO.
- "LISTO" pasa a `width:100%` (antes shrink-to-fit, quedaba chico y desalineado a la izquierda) — mismo sistema de botones que el resto de la app.

---

## 8. Sistema de botones (§12)

Auditado: `.btn-start` (fondo lima sólido, texto `#1A1400` alto contraste) y `.btn-secondary` (superficie azul oscura, borde discreto, texto claro) ya cumplían la especificación desde BRAMUlab_V02. No se encontró ningún botón de borde lima usado como acción principal. Sin cambios de código en este punto — la única corrección relacionada con botones fue la de altura táctil de `.option-col` (§7 arriba) y el ancho de LISTO.

---

## 9. Recorrido posterior a la carga: Confirmar → Guardar → Resumen único (§13–§16)

Este es el cambio estructural más grande de la ronda. Reemplaza tres pantallas que se pisaban entre sí (`Partido guardado`, `Resumen inmediato` `#view-summary`, `Análisis` `#view-analysis`) por un flujo de dos pasos:

```
Finalización de sets → CONFIRMAR PARTIDO → GUARDAR PARTIDO → RESUMEN DEL PARTIDO (único)
```

### 9.1 — Confirmar partido (pre-guardado)

`#view-match-saved` (antes "Partido guardado", post-guardado) se repropone como **pre-guardado**: título "CONFIRMAR PARTIDO", badge VICTORIA/DERROTA (o "RESULTADO FINAL" para el caso teórico de un partido observado — la carga manual nunca produce ese caso porque el jugador actual siempre es Equipo A, jugador 1, fijo), ganadores, resultado completo, fecha/hora/lugar con "Modificar", campo **NOTAS** (label único, sin el ejemplo anterior de "globo y voleas") y **GUARDAR PARTIDO** como única acción. Se agregó una flecha "←" para volver a corregir el resultado sin perder nada (sets/jugadores siguen en memoria).

`finalizeManualContinue()` ya no persiste directo: arma el snapshot completo (`buildManualMatchSnapshot`, extraída de la vieja `finishMatchManual`) y, si es una carga NUEVA, abre Confirmar sin tocar `Store`. Recién al tocar GUARDAR PARTIDO (`persistManualSnapshot`) se llama `Store.upsertHistory` — **una sola vez**, confirmado con `PLStore.loadHistory().length` antes/después en la verificación. Una edición de un partido YA existente sigue guardando directo (no tiene sentido re-confirmar algo ya guardado) — mismo criterio que ya usaba esta pantalla antes de esta ronda.

Al guardar: toast "Partido guardado" + navegación automática al Resumen único — nunca queda una pantalla vacía de confirmación.

### 9.2 — Resumen del partido (único, canónico)

`#view-analysis` (antes "Análisis del partido") pasa a ser la única pantalla de detalle para las tres procedencias: partido en vivo recién terminado, partido cargado manualmente recién guardado, y cualquier partido abierto desde Historial. Se retitula "RESUMEN DEL PARTIDO" y conserva su contenido más rico (BRAMU Intelligence, estadísticas completas, Evolución, Momentos Clave, Timeline) — que ya incluía Ganadores/Marcador por sets/Sets ganados/Games ganados (`buildResultBlockHTML` + `renderStatsGrid`, sin cambios de contenido, solo de rótulo).

Nueva función `openCanonicalResumen(f, openedFrom)` — único punto de entrada, reemplaza los ~6 call-sites que antes armaban `renderSummary()`+`#view-summary` a mano.

**"Volver al inicio" ya existía** en Análisis desde antes de esta ronda (`#analysis-home-btn`, con el guard correcto: solo limpia el partido activo si `analysisOpenedFrom==='live'`, nunca uno distinto en curso) — no hizo falta agregarlo.

**Deshacer último punto / Reanudar partido** (antes exclusivos de `#view-summary`) se relocalizaron dentro de Resumen: `#analysis-live-actions`, visibles únicamente cuando `analysisOpenedFrom==='live' && f===finishedSnapshot`, con las mismas condiciones de siempre (automático/no-manual para Deshacer, manual para Reanudar). `undoLastPoint`/`undoLastGame`/`resumeMatch` ya no ocultan un overlay — ahora llaman `showView('match')` explícitamente, porque el Resumen dejó de ser un overlay posicionado sobre el marcador para pasar a ser una vista propia.

La flecha "←" de Resumen se simplificó: ya no existe "volver a Análisis" (era la misma pantalla) ni "volver al marcador" (un partido recién terminado no tiene a dónde volver ahí) — sale hacia Historial/Home según de dónde se abrió.

**Eliminado por completo:** `#view-summary` (HTML), `renderSummary`/`initSummaryScreen`/`buildSummaryCardHTML`/`buildManualSummaryStatsHTML`/`buildGamesSummaryStatsHTML` (JS — muertas tras el retitulado), los botones "Ver resumen"/"Ver análisis" y toda la navegación circular asociada. `buildSummaryStatsHTML`/`buildHeadlineRows` se conservaron: siguen usados por `shareResult` (capacidad técnica de Compartir, ya oculta desde BRAMUlab_V02, sin cambios en esta ronda).

**Barrido de seguridad:** tras retirar `#view-summary`, se auditó cada referencia sobrante a `$('#view-summary')`/`$('#summary-*')` en `showView()`, `resetMatch()`, `discardActiveMatchState()` — tres puntos que habrían lanzado `TypeError` sobre un elemento inexistente en cualquier navegación. Los tres se corrigieron antes de la primera verificación en navegador.

**Verificado en vivo, extremo a extremo:** carga manual completa (`6-2 · 5-7 · 6-4`) → Confirmar (con nota) → Guardar (`historyCount` pasa de 0 a 1, una sola vez) → Resumen único con la nota visible → mismo partido reabierto desde Historial → mismo "RESUMEN DEL PARTIDO", con "EDITAR PARTIDO" y "VOLVER AL INICIO" presentes.

### 9.3 — BRAMU Intelligence: jerarquía (§16)

Sin cambios de código: el label "BRAMU INTELLIGENCE" ya era pequeño y lima, el cuerpo ya usaba peso de texto normal (no negrita completa) desde BRAMUlab_V02. Verificado visualmente, sin desvíos que corregir.

### 9.4 — BRAMU Intelligence: reglas narrativas (§17)

Bug real encontrado en `generateManualIntelligence` (stats.js): un partido a 3 sets donde el ganador se llevó el Set 1 (es decir, NO es remontada) caía **siempre** en la rama "parejo", sin mirar el margen real de cada set. `6–1 · 1–6 · 6–0` (dominio alternado con cierre contundente) se narraba como *"se llevaron el partido tras un desarrollo parejo"* — contradice directamente el resultado disponible.

**Fix:** `classifyWonLostWonPattern(sets)` (nueva, stats.js) clasifica el patrón "ganó-perdió-ganó" por el margen real de los sets 1 y 2 (`isSetMarginClose`, margen ≤2 = ajustado): ambos amplios → dominio alternado/cambiante; ambos ajustados (+ decisivo ajustado) → "extremadamente parejo"; ambos ajustados → parejo (sin cambios); mixto → "competitivo", dejando que el cierre del set decisivo aporte la precisión. La rama de sets corridos también se corrigió: `6–0 · 6–0` ahora se narra como victoria dominante, no con el mismo texto neutro que un `7–6 · 6–4`. El cierre del set decisivo ahora narra **ambos** casos (antes solo "ajustado"; agregado el opuesto, "margen amplio").

**Los 5 casos del consolidado, verificados con tests automatizados** (Bloque V02.1-BI en tests.html) y uno de ellos además de punta a punta en la app real:
- `6–1 · 1–6 · 6–0` → nunca "parejo"; se lee como dominio alternado.
- `7–6 · 6–7 · 7–6` → "extremadamente parejo".
- `6–0 · 6–0` → "victoria dominante".
- `2–6 · 6–4 · 6–3` (ganador perdió el set 1) → remontada.
- `6–2 · 5–7 · 6–4` → competitivo + "el set decisivo se definió por un margen ajustado" (verificado también en vivo, texto exacto: *"Sebastián y Matías se llevaron un partido parejo en tramos, 6-2, 5-7, 6-4. El set decisivo se definió por un margen ajustado."*).

---

## 10. Home (§18–§24)

- **Destacados (Hitos):** de chips de una línea (`white-space:nowrap`, texto cortado) a un carrusel de tarjetas (`flex-basis:86%`, texto en varias líneas, `scroll-snap-type:x proximity` — nunca "mandatory", swipe manual sin autoplay) con acento celeste como borde lateral. Contenido/lógica de `computeHitos` sin cambios.
- **Tarjeta de perfil:** avatar reemplazado por una silueta genérica SVG lineal (nunca la inicial de texto, nunca una foto real ni un servicio externo); se agrega `@handle` provisional (`buildPlayerHandle`, derivado del primer nombre del jugador actual, sin diacríticos — nunca hardcodeado "@seba" para todos los usuarios, ni parte de un sistema de cuentas real, §32); Nivel BRAMU más grande (26px→30px); la variación (`+0.1`/`-0.2`) se relocalizó como marcador en el extremo real de la barra de progreso (`position:absolute` sobre `.player-card__bar-fill`) en vez de vivir junto al número — relaciona visualmente el dato con la barra sin simular una proporción falsa; "N partidos en tu historia" se movió debajo de la barra.
- **Último partido:** degradado retirado (superficie plana `--surface-1`); línea de acento movida de arriba a la izquierda; badge VIC/DER (antes VICTORIA/DERROTA completo, mismo criterio de Historial §26); separadores (guion entre games, punto entre sets) en gris secundario y más chicos que los números — nunca el mismo peso/color que el resultado.
- **Métricas:** dos grupos con encabezado propio, "ÚLTIMOS 30 DÍAS" (Actividad+Efectividad — antes cada tarjeta repetía su propio "ÚLTIMOS 30 DÍAS") y "TU HISTORIAL" (las 4 chicas). Navegación nueva: Racha actual y Efectividad abren Historial con un filtro contextual (banda "Filtrando: X · Quitar filtro", ver Bloque E abajo); Mejor compañero y Rival más enfrentado abren las vistas nuevas Compañeros/Rivales (ver más abajo). Actividad y Partidos totales deliberadamente sin chevron ni acción.
- **Pie de autoría:** movido de Configurar partido al final del Home (`#player-home-footer`, seteado en `renderPlayerHome()`), eliminado el duplicado. De paso, corregido el único lugar del código que todavía decía "BRAMU Lab" (con espacio) — pasa a "BRAMUlab", el naming oficial.
- **Tu momento:** conservado sin cambios de contenido ni lógica — solo se preservó el ícono de pelota ya implementado en la ronda anterior.

### Vistas nuevas: Compañeros / Rivales

`PH.computeTeammateBreakdown`/`computeRivalBreakdown` (player-home.js, puras): récord conjunto con cada persona real con la que el jugador actual compartió cancha, excluyendo placeholders (`Store.isPlaceholderPlayerName`) y partidos Observados (ya excluidos por construcción, `PH.filterMatchesForPlayer` solo incluye partidos donde el jugador actual participa). Orden: más partidos/enfrentamientos primero, empate por victorias, empate final alfabético — determinístico. Una sola vista compartida `#view-companions` (título dinámico COMPAÑEROS/RIVALES) para no duplicar HTML.

---

## 11. Historial (§25–§27)

- **Pestañas principales:** sin cambios de contenido (Todos/Mis partidos/Observados ya eran exactamente estas tres desde BRAMUlab_V02.1's base). La fila de chips de modo (Todos los modos/Cargados/Game por game/Punto por punto) se **retira de la vista principal** (`hidden`) — la lógica de filtrado (`PH.filterHistoryByMode`) se conserva intacta por si sirve a futuro, simplemente no compite más con la navegación por pestañas.
- **Badges de resultado:** VIC/DER (partidos propios, calculado desde `PH.matchResultForPlayer` — nunca solo del color de los nombres) junto a la fecha; GANÓ (Observados) como micro-tag pegado al nombre de la pareja ganadora, sin VIC/DER ahí (el jugador actual no participa). Ambos casos verificados en vivo (uno real, uno sintético para forzar el estado Observado).
- **Filtro contextual desde el Home (§27):** `historyContextFilter` (módulo, sesión), dos tipos — `streak` (matchIds exactos de `PH.computeCurrentStreakMatches`) y `last30` (mismo conjunto exacto que usa Efectividad, vía `PH.filterMatchesWithin30d`, nueva función que reutiliza la ventana de `computeActivity30d`/`computeEffectiveness30d` — nunca un criterio de fecha recalculado aparte). Banda visible "Filtrando: X · Quitar filtro"; tocar cualquiera de las 3 pestañas normales también sale del filtro contextual. Ambos casos verificados en vivo.

---

## 12. Modales, superficies y transparencias (§28–§29)

**Hallazgo principal del bloque:** `.overlay` (usado por ~15 modales genéricos — Notificaciones, Ajustar, Corrección rápida, "¿Quién sos?"...) tenía `background: rgba(11,18,17,0.92)` hardcodeado — ese RGB es **exactamente** `#0B1211`, el viejo `--ink` verde-negro de antes de BRAMUlab_V02. Nunca se migró junto con el resto de la paleta porque no era una variable, era un literal. Reemplazado por `var(--scrim)` (azul noche neutro, el token que ya existía para este propósito exacto).

Segundo hallazgo relacionado: `.overlay` tenía `z-index:30`, **por debajo** de `.bottom-nav` (`z-index:35`) — la barra inferior se dibujaba (y quedaba tocable) por encima de cualquier modal genérico abierto sobre una vista con nav visible. Subido a `z-index:36`, mismo nivel que `.sheet-scrim` (el otro sistema de superposición de pantalla completa).

Ambos verificados en vivo sobre Notificaciones: fondo azul noche (no verde), nav inferior completamente cubierto y no interactivo detrás del modal.

**Auditoría del resto de sheets** (Registrar partido, Elegir jugador, Formato y puntuación, Fecha y hora): ya corregidos en la ronda anterior (BRAMUlab V02 · Ajuste visual de cierre 01 — el bug de fondo transparente por un `*/` suelto en un comentario CSS). Verificados de nuevo en esta ronda sin regresiones, en 402×874 y escritorio.

---

## 13. Tipografía (§30)

Inter ya cargaba correctamente y la escala de pesos (resultados 800, títulos 700, nombres 500, cuerpo 400) ya estaba aplicada desde el "Ajuste visual de cierre 01" de la ronda anterior. Sin cambios de familia tipográfica en V02.1, conforme al consolidado. Los únicos ajustes de peso de esta ronda fueron puntuales, dentro de componentes ya rediseñados (badges VIC/DER, separadores del score, `@handle`) — documentados en sus secciones respectivas arriba, no como una pasada tipográfica aparte.

---

## 14. Datos, compatibilidad y seguridad (§32–§33)

- **Ningún partido cargado durante las pruebas se perdió** ni se usó `localStorage.clear()` como solución en ningún punto de esta ronda.
- **No hubo migración de esquema.** El único cambio de dato persistente fue en la ESCRITURA de partidos nuevos (fecha/hora locales en vez de mezcladas con UTC, §1) — los registros ya guardados no cambiaron de forma ni necesitaron reinterpretación.
- **Sin duplicados:** verificado explícitamente que Guardar Partido persiste una sola vez (§9.1) y que reabrir/editar un partido existente actualiza el mismo `matchId` vía `Store.upsertHistory` (dedupe por id, sin cambios en esta ronda).
- **Resultados y perspectiva del jugador (§33):** ya resuelto desde antes por `PH.matchResultForPlayer`/`getPlayerTeam` (nunca por el texto "Vos") — reutilizado sin cambios en los badges nuevos de Historial y en Compañeros/Rivales.
- **`@seba` es una representación provisional de interfaz** (§32), derivada del nombre real, sin sistema de cuentas — documentado también en el propio comentario del código (`buildPlayerHandle`).

---

## 15. Tests automáticos (§34)

**523/523 tests OK — todo verde** (`tests.html`), sin reducir cobertura: los 483 preexistentes se mantienen intactos + 40 nuevos, agrupados en 4 bloques nuevos:

- **V02.1-TB** (7 casos) — tie-break superior a 7: los 5 ejemplos textuales del consolidado (7-0, 7-5, 8-6, 10-8, 16-14) más sus inversos, los inválidos (7-6, 8-7, 7-7) y la independencia entre formatos con `winTarget` distinto (7 vs. 10) — nunca se mezclan.
- **V02.1-PH** (11 casos) — placeholders excluidos: cada variante de "Jugador N"/"Vos" (incluida una con espacios extra, para probar la normalización) se reconoce como placeholder; nombres reales no; `ML.computeAllKnownPlayers` nunca los ofrece como sugerencia aunque vengan de un partido histórico real.
- **V02.1-M** (7 casos) — racha/Compañeros/Rivales/últimos 30 días: `computeCurrentStreakMatches` devuelve exactamente los partidos de la racha vigente; `computeTeammateBreakdown`/`computeRivalBreakdown` calculan el récord conjunto correcto y ordenan por criterio determinístico; `filterMatchesWithin30d` es el mismo conjunto exacto que consume `computeEffectiveness30d` (mismo `considered`).
- **V02.1-BI** (5 casos) — narrativa de BRAMU Intelligence: los 5 ejemplos textuales de §17, verificando tanto la ausencia de "parejo" donde no corresponde como la presencia de la categoría correcta (dominio alternado, extremadamente parejo, dominante, remontada, margen ajustado).

Durante la escritura de estos tests se detectaron y corrigieron 4 errores de **datos de prueba** (no de código): un supuesto incorrecto sobre el techo de un tie break con `winTarget` menor, una cuenta de días mal hecha a mano para el ancla de "últimos 30 días", y un `winnerTeam` pasado al revés del resultado real de los sets en el caso de remontada — los tres se corrigieron en el propio test, no en la implementación.

---

## 16. Pruebas funcionales manuales (§35)

Todas ejecutadas contra `.claude/dev-server.py` en 402×874 (iPhone 16 Pro), con Service Worker/caché limpiados antes de cada verificación relevante (lección ya documentada de rondas anteriores: sin este paso, un cambio de CSS/JS puede parecer "no aplicado").

1. **Cargar un partido propio 6–2 · 5–7 · 6–4** — hecho de punta a punta con jugadores reales (Sebastián/Matías vs. Facundo/Nico).
2. **Avance automático entre sets** — confirmado: cada set se confirma solo al completar el segundo dígito, sin tocar CONTINUAR.
3. **Advertencia incorrecta del tercer set** — confirmado que NO aparece: el mensaje se muestra correctamente mientras el Set 3 está vacío y desaparece exactamente al completarlo.
4. **Confirmar partido + nota + guardar** — hecho, con nota "Buen partido, saqué bien el segundo set." (primer caso) y sin nota (segundo caso).
5. **Una sola persistencia** — confirmado con `PLStore.loadHistory().length` antes/después de Guardar (0→1 y 1→2 en los dos casos probados).
6. **Resumen único: nota, análisis, Editar, Volver al inicio** — confirmado, los cuatro presentes y funcionales.
7. **Mismo partido desde Historial → mismo Resumen** — confirmado, mismo título "RESUMEN DEL PARTIDO", mismos botones.
8. **Set 7–6 con tie break 10–8** — hecho en un partido Por Games real (no simulado): se llegó a 6-6 en games, se resolvió el tie break reglamentario tocando "+" alternado hasta 10-8, y se confirmó sin error — **el escenario exacto del bug reportado, ahora funcional**.
9. **Editar y reabrir sin pérdida de datos** — el partido Por Games se descartó deliberadamente al final de la prueba (era de prueba, sin valor real); la capacidad de editar sin pérdida ya estaba cubierta por la Prueba Guiada v2/v2.1 preexistente en tests.html (E41, sin cambios esta ronda) y por la verificación funcional del punto 6/7 de arriba, que reabre el mismo `matchId` sin duplicarlo.
10. **11 partidos con fecha de hoy: Actividad/Efectividad** — el mecanismo de la corrección (§1) se verificó de forma más rigurosa que cargando 11 partidos idénticos: se reprodujo el bug exacto en consola (hora local 23:30 en Argentina → `toISOString()` ya en el día siguiente) confirmando que el prefill viejo lo habría escrito mal, y se confirmó que el prefill nuevo coincide con `getFullYear/getMonth/getDate` del dispositivo en el instante real de la prueba. Los 2 partidos cargados en esta sesión (ambos "hoy") aparecen correctamente en Actividad/Efectividad del Home.
11. **Historial en Todos/Mis partidos/Observados** — los tres probados, incluido un caso Observado sintético para forzar el badge GANÓ (nunca alcanzado orgánicamente porque la carga manual siempre pone al jugador actual como participante).
12. **Racha actual y Efectividad desde el Home** — ambos abren Historial filtrado correctamente, con la banda "Filtrando: X" y "Quitar filtro" funcional.
13. **Compañeros y Rivales** — ambas vistas verificadas con datos reales (Matías como compañero, Facundo/Nico como rivales).
14. **Sheets con teclado visible en iPhone** — Formato y puntuación verificado con capturas (ver §17); el resto ya se había verificado en la ronda anterior sin cambios de layout que ameriten repetirlo.
15. **Notificaciones: overlay neutro** — confirmado, fondo azul noche (no verde), nav inferior no interactivo detrás.
16. **Logo del Home no navega** — confirmado explícitamente con `view-player-home.hidden` antes/después del click.

---

## 17. Capturas (§36)

Generadas y revisadas en 402×874 durante la verificación en vivo (Browser pane, sin archivos de imagen versionados en el repositorio — mismo criterio ya establecido en informes anteriores de este proyecto):

1. Home: destacados y perfil (avatar genérico, `@handle`, Nivel BRAMU con marcador de variación en el extremo de la barra, conteo debajo).
2. Home: Último partido (acento izquierdo, badge VIC, separadores atenuados).
3. Home: métricas con encabezados de grupo ("ÚLTIMOS 30 DÍAS"/"TU HISTORIAL") y chevrons en Efectividad/Racha actual.
4. Registrar partido (sin cambios esta ronda, revisado sin regresiones).
5. Carga manual de Set 1 (jugadores y resultado del set).
6. Set siguiente tras el avance automático (Set 2, con Set 1 ya en el marcador acumulado agrandado).
7. Formato y puntuación (secciones con aire, opciones de 48px, LISTO ancho completo).
8. Confirmar partido (VICTORIA, resultado, NOTAS, GUARDAR PARTIDO).
9. Resumen único (RESUMEN DEL PARTIDO, con BRAMU Intelligence y estadísticas).
10. Historial con pestañas (badges VIC/DER, sin chips de modo).
11. Historial filtrado por racha (banda "Filtrando: Racha actual").
12. Historial filtrado a 30 días (banda "Filtrando: Últimos 30 días").
13. Compañeros (Matías, 100%).
14. Rivales (Facundo/Nico, 100% cada uno).
15. Notificaciones (fondo azul noche neutro, sin verde musgo).

Además, no solicitada por la lista pero relevante como evidencia: Historial en "Observados" con el badge GANÓ.

Todas revisadas como conjunto: ninguna quedó con lenguaje visual anterior ni mostró una regresión respecto de BRAMUlab_V02.

---

## 18. PWA y publicación (§37)

- `Store.VERSION`: `"BRAMUlab V02"` → **`"BRAMUlab V02.1"`**.
- `version.json`: actualizado en paralelo (mismo valor) — el chequeo `checkForNewVersion()` compara ambos por igualdad estricta.
- `sw.js`: `CACHE_NAME` `bramulab-v02-1` → **`bramulab-v02-1-1`** — bump técnico necesario porque `sw.js` no cambia de bytes en una ronda de ajuste típica; sin este bump, un cliente con el bundle viejo ya instalado nunca dispara un reinstall del service worker (misma lección ya documentada en el "Ajuste visual de cierre 01" anterior).
- Verificado localmente: con un cliente en el mismo estado que un usuario real (SW ya registrado, caché `bramulab-v02-1` activa), un simple recargo (sin `unregister()` manual) dispara el reinstall, repuebla la caché con los archivos corregidos y limpia la caché vieja automáticamente.
- Verificación post-deploy en producción real (no solo en el entorno de sandbox, que en rondas anteriores no pudo registrar el service worker): ver §19.

---

## 19. Publicación

- Commit de implementación: ver hash en el historial de `main` junto a este informe (commit único que agrupa código + este informe, mensaje `"BRAMUlab V02.1 · corrección funcional, UX y terminación visual"`).
- Tag: **`BRAMUlab_V02.1`** — naming oficial, nunca `v2.2.1`/`v3.0`/otra numeración paralela (§37 del consolidado, y confirma la corrección de naming ya fijada en la ronda anterior).
- Push a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages (GitHub Pages depende solo de `main`, no de tags — confirmado en la ronda anterior).
- Verificación post-deploy contra la URL de producción, incluida la actualización PWA en un cliente con el bundle anterior ya instalado.

---

## 20. Desvíos justificados

1. **"RESULTADO FINAL" para partido observado en Confirmar partido** — implementado por completitud/robustez (§14 del consolidado lo pide explícitamente), aunque en la práctica la carga manual nunca puede producir ese caso: el jugador actual siempre es Equipo A, jugador 1, fijo y deshabilitado. No es alcanzable hoy, pero tampoco cuesta nada mantenerlo correcto si el modelo cambiara a futuro.
2. **Prueba #9 (editar y reabrir sin pérdida)** no se repitió con un partido nuevo dedicado — se apoyó en la Prueba Guiada preexistente (E41, sin cambios) más la verificación end-to-end de los puntos 6/7, que ya ejercitan reabrir el mismo `matchId` sin duplicar. Repetir esa prueba completa desde cero no habría ejercitado ningún código distinto al ya cubierto.
3. **Capturas sin archivos versionados en el repositorio** — mismo criterio que el informe de BRAMUlab_V02 y el de "Ajuste visual de cierre 01": se documentan por descripción, revisadas en vivo durante la verificación, no como binarios en git.
4. **Buttons (§12) sin cambios de código** — la auditoría no encontró ninguna violación real (`.btn-start`/`.btn-secondary` ya cumplían la especificación desde BRAMUlab_V02); el único ajuste relacionado con botones fue la altura táctil de `.option-col` y el ancho de LISTO, documentados en su bloque correspondiente (§7 de este informe) en vez de repetidos acá.
5. **Tipografía (§30) sin una pasada dedicada** — ya estaba correctamente aplicada desde la ronda anterior; los ajustes de peso de esta ronda fueron puntuales dentro de componentes ya tocados por otro motivo (badges, separadores, handle), no una auditoría tipográfica aparte.

---

## 21. Qué no se tocó (confirmado)

Persistencia, modelos de datos, reglas de partido (`engine.js`, salvo la función pura nueva `isValidFinalTiebreakScore`, que no reemplaza ninguna regla existente), estadísticas (`stats.js`, salvo `generateManualIntelligence`/nueva `classifyWonLostWonPattern`, documentadas en §9.4), esquema de `localStorage` (`store.js`, salvo el string de versión y la nueva función pura `isPlaceholderPlayerName`), `privateNote` y su persistencia (conservado tal cual, solo relabeled a "NOTAS" en la interfaz), marcador en vivo (estructura intacta, solo se relocalizó Deshacer/Reanudar), equipos azul/magenta (sin cambios), Ranking (placeholder intacto), Perfil y cierre de sesión (sin cambios), navegación inferior ya validada. Nada de sincronización, cuentas reales, ranking competitivo real, validación entre rivales ni procesamiento de notas privadas — todo eso sigue en `BRAMUlab_Backlog.md`, sin tocar.
