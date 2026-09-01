# BRAMU Lab — Rama Jugador
## Etapa 1: análisis del proyecto y plan de integración (respuesta de Claude Code)

Este documento responde al análisis solicitado en `BRAMU_Rama_Jugador_Etapa_1_Contexto.md`, después de leerlo completo e inspeccionar el repositorio real de BRAMU Lab. No se programó ni modificó ningún archivo del proyecto para producir este análisis.

---

## A. Resumen ejecutivo

El giro de producto se entiende así: BRAMU pasa de ser "una herramienta para seguir un partido" a ser "el lugar donde vive tu historia de pádel", con el registro de partido como *insumo* (la causa) y el Home del jugador como la *consecuencia* que se muestra. Esto convive bien con el BRAMU actual porque el producto de hoy ya es, en el fondo, una máquina de generar partidos con datos ricos (resultado, jugadores, duración, Intelligence) que hoy se muestran uno por uno y se olvidan en una lista plana — la Rama Jugador no reemplaza nada, agrega una capa de lectura agregada sobre datos que ya se están guardando.

El punto de fricción real no es de UI sino de modelo de datos: hoy no existe la noción de "jugador" como entidad persistente, solo nombres de texto libre por partido. Eso es suficiente para una beta con datos ficticios en un solo teléfono (como pide la Sección 6 del documento de contexto), pero es la primera decisión de fondo a tomar antes de programar nada.

---

## B. Estado real del proyecto

**Framework y organización:** cero frameworks, cero build step. Un solo `index.html` (834 líneas) con seis `<section id="view-*">` (setup, match, summary, analysis, timeline, history, + manual-load agregada en V14) que se muestran/ocultan por CSS (`hidden`), sin router ni URLs por vista. Cuatro `<script>` planos en orden de dependencia: `engine.js` (motor de puntuación), `stats.js` (BRAMU Intelligence + estadísticas), `store.js` (persistencia), `app.js` (DOM/orquestación, ~4900 líneas). Cada archivo es un IIFE que expone un objeto global (`PLEngine`, `PLStats`, `PLStore`). Sin Node en esta Mac; se sirve con `python3 -m http.server` y se testea con `tests.html` (motor + stats en navegador, sin DOM/app.js).

**Navegación existente:** `showView(name)` (`app.js:131`) es literalmente un `forEach` que oculta todas las vistas menos una, de una lista hardcodeada (`['setup','match','analysis','history','timeline','manual-load']`). No hay historial de navegación del browser ni back real — cada vista guarda "adónde volver" en variables JS (ej. `analysisOpenedFrom`). El header de "Home" (`view-setup`) hoy tiene dos links: **Historial** y **MODO COMPLETO ▾** (selector de modo de registro). No existe ninguna barra de navegación inferior.

**Componentes reutilizables:** hay un lenguaje visual consistente ya construido — `option-pill`/`option-col` (selectores tipo chip), `team-block` (bloque de equipo con inputs), `overlay`/`menu-sheet` (modales y sheets), `history-item` (tarjeta de partido en la lista), `stat-row` (fila de estadística comparada A/B), `summary-card`/`analysis-section` (tarjetas de resultado). Todo corre sobre superficies oscuras (`--ink-soft`, `--ink-softer`), bordes sutiles (`--line`) y `border-radius` entre 10-20px — es literalmente el lenguaje que el documento de contexto describe como "tarjeta pastilla", ya construido y probado en producción.

**Sistema de estilos y variables:** `styles.css` (1001 líneas) con `:root` centralizando color (`--ink`, `--paper`, `--team-a`/`--team-a-deep`, `--team-b`/`--team-b-deep`, `--gold`), tipografía (`--font-display`: Oswald condensada para números/títulos; `--font-body`: Manrope) y safe-areas (`--safe-top`/`--safe-bottom` para notch/home indicator). Media queries mobile-first con ensanches en `min-width:720px` y ajustes de `landscape`.

**Almacenamiento y estructuras de datos:** todo en `localStorage`, sin backend, namespace `padellab.*` (`store.js:16`): `activeMatch` (partido en curso, con `schemaVersion`), `history` (array plano, máx. 200 partidos, cada uno con `matchId` estable), `playerNames` (lista de nombres autocompletados, no perfiles), `recordingMode` (preferencia de Home). **Dato clave:** los jugadores son `{id: 0-3 (local al partido), team: 'A'|'B', name: string}` (`app.js:258-263`). No hay ID de jugador estable entre partidos, solo texto libre normalizado a Title Case (`normalizePlayerName`, `app.js:247`) para que el mismo nombre escrito dos veces coincida como string.

**Historial y carga de partidos:** el Historial (`renderHistory`, `app.js:4441`) es una lista plana, global, cronológica — no hay ningún filtro ni agrupación por jugador hoy. Existen tres formas de generar una entrada de Historial, todas conviven en la misma estructura vía `mode: 'complete'|'games'|'manual'`: registro punto por punto en vivo, registro "Por Games" (un toque = un game), y "Cargar partido jugado" (V14, sin motor en vivo, solo resultado final + fecha/lugar).

**Jugadores, estadísticas e Intelligence:** confirmado que `stats.js` es **100% de alcance por-partido** — cada función (`computeStats`, `generateBramuIntelligence`, `computeManualStats`, etc.) recibe eventos/sets de un solo partido y devuelve narrativa/números de ese partido. No hay ninguna función que agregue across matches (rachas, historial de enfrentamientos, evolución en el tiempo). El "hueco" para ranking/perfil está previsto conceptualmente pero no construido.

**Responsive/mobile:** ya resuelto y maduro — viewport con `viewport-fit=cover`, manifest PWA standalone/portrait, service worker con cacheo de assets, safe-area insets aplicados en header/footer, breakpoints para tablet/desktop y landscape ya probados en varias vistas.

---

## C. Qué puede reutilizarse

- **Todo el sistema visual**: variables CSS, `option-pill`, `overlay`/`menu-sheet`, `history-item`, `stat-row`, tipografía y paleta — es exactamente el lenguaje "tarjeta pastilla" que pide el documento de contexto, sin inventar nada nuevo.
- **`showView`**: extender el array hardcodeado con nuevos nombres de vista (`'player-home'`, etc.) es un cambio de una línea, mismo patrón que ya se usó para sumar `manual-load` en V14.
- **`Store.loadHistory()`**: ya trae todos los partidos con `players[]`, `sets`, `winnerTeam`, `finishedAt`, `mode` — es la fuente de datos completa para construir "Forma reciente", "Último partido", rachas, etc. Solo falta *filtrar* esa lista por nombre de jugador, no rehacer el guardado.
- **`teamLabel(players, team)`** (`stats.js`) y el criterio cromático equipo A/B ya resuelto en Historial — reutilizable para pintar "vos" vs. "rival" en las tarjetas del Home.
- **El flujo de "Cargar partido jugado" (V14)** es, conceptualmente, el candidato más natural para el botón **"+"**: ya resuelve exactamente "registrar un resultado sin fricción de seguimiento en vivo", con validación reglamentaria de sets.
- **`normalizePlayerName`**: da una normalización consistente que hace viable, aunque frágil, agrupar partidos "del mismo jugador" por coincidencia exacta de string en la beta.
- **BRAMU Intelligence por partido**: no se reutiliza el texto en sí, pero sí el *patrón* (bancos de frases, detección de patrones, nunca inventar sobre datos ausentes) para el futuro módulo "Tu momento" a nivel histórico.

---

## D. Propuesta de integración

**Ubicación de la nueva vista:** una nueva `<section id="view-player-home">` junto a las demás, siguiendo el patrón existente al pie de `index.html`, con su propio bloque en `app.js` (`initPlayerHomeScreen`/`renderPlayerHome`) — mismo molde que se usó para sumar `view-manual-load` en V14. No hace falta router: es un nombre más en el array de `showView`.

**Acceso vía "Mi perfil":** cambiar el link **Historial** del header de `view-setup` por **Mi perfil**, que llama a `showView('player-home')`. El acceso a Historial no se pierde — puede vivir dentro del nuevo Home (como uno de sus widgets/atajos) o quedar accesible desde ahí mismo, a definir en la Etapa 2.

**Convivencia con la barra inferior nueva:** dado que hoy no existe navegación inferior, sumarla no rompe nada estructuralmente — es agregar un `<nav>` fijo (posición similar al `control-bar` que ya existe en `view-match`) visible solo en las vistas "nuevas" (Home del jugador, Historial, Ranking, Perfil), y ausente en el flujo de partido en vivo (`view-match`) para no competir con los controles del marcador, que ya usan la franja inferior para otra cosa.

**Relación "+" con los flujos actuales:** en la primera beta, el "+" puede apuntar directo a `view-manual-load` (ya existe y ya guarda al mismo Historial), sin bifurcación. Diferir el menú de alternativas ("cargar partido" vs. "iniciar en vivo") a una segunda pasada, tal como sugiere el propio documento de contexto.

**Estrategia de datos ficticios:** dado que hoy no hay identidad de jugador persistente, la ruta de menor impacto es introducir un concepto liviano **"jugador actual del dispositivo"** (un nombre string guardado en localStorage, ej. `padellab.currentPlayerName.v1`) contra el cual se filtra `Store.loadHistory()` por coincidencia de nombre en `players[]`. Esto no toca el modelo de partido existente ni compromete la futura migración a cuentas reales — cuando exista backend/IDs, ese filtro por nombre se reemplaza por filtro por ID sin tocar la capa visual del Home.

---

## E. Plan incremental sugerido

1. Definir y guardar "jugador actual" (nombre elegido/ingresado una vez, sin pantalla de auth) — paso mínimo, comprobable con localStorage.
2. Nueva vista vacía `view-player-home` accesible desde "Mi perfil" en el header, con solo la tarjeta de identidad (nombre) — confirma que el enrutado por `showView` funciona sin romper nada.
3. Sumar "Último partido" y "Forma reciente" leyendo `Store.loadHistory()` filtrado por jugador actual — primer valor real visible, con partidos ficticios cargados vía el flujo V14 ya existente.
4. Sumar barra inferior de 5 posiciones (Inicio/Historial/+/Ranking/Perfil) solo en las vistas fuera de partido en vivo, con Ranking y Perfil como placeholders no funcionales todavía.
5. Conectar "+" al flujo de carga manual existente.
6. Iterar widgets adicionales (racha, compañeros, rivales) uno por vez, cada uno como una función pura que recibe el historial filtrado — mismo criterio de aislamiento que ya usa `stats.js` por modo.

Cada paso es reversible (agrega vista/función nueva, no modifica las existentes) y comprobable en el celular real antes de seguir.

---

## F. Riesgos y decisiones técnicas

- **Identidad de jugador por string, no por ID:** es la decisión de fondo. Funciona para la beta con datos ficticios en un solo dispositivo, pero es deuda deliberada — dos jugadores con el mismo nombre, o el mismo jugador escrito con variantes, romperían la agregación. Aceptable ahora, bloqueante el día que haya multi-dispositivo/cuentas reales.
- **Ranking/categoría no existen en ningún lado del código actual** — cualquier tarjeta de "ranking" en el Home de la beta necesariamente muestra un valor inventado o placeholder; hay que decidir explícitamente cómo se presenta eso sin violar el principio de "no inventar profundidad que los datos no permiten" (que el documento de contexto aplica a Intelligence, pero aplica igual acá).
- **`showView` no tiene concepto de "vista por defecto al abrir la app"** más allá de siempre arrancar en `setup` — si "Inicio" pasa a ser el Home del jugador, hay que decidir si el arranque de la app cambia (hoy siempre abre en la pantalla de configurar partido) o si esa pantalla se reencuadra como la acción del "+".
- **Acoplamiento con seguimiento en vivo:** Evolución del partido y Momentos Clave dependen de eventos punto por punto/game, y ya están condicionalmente ocultos para partidos `mode:'manual'` — ese mismo patrón (ocultar, no fabricar) es el que hay que replicar para cualquier widget del Home que dependa de datos que un partido cargado manualmente no tiene.
- **Riesgo de duplicación bajo** si se respeta "un archivo por capa" (agregar funciones a `app.js`/`stats.js`, no crear módulos paralelos) — es el patrón que V13/V14 ya vienen siguiendo con éxito.
- **Sin test harness de DOM:** cualquier vista nueva se verifica a mano en el navegador, no hay forma de automatizarlo hoy — no es bloqueante pero conviene tenerlo presente en el plan de verificación de la Etapa 2.

---

## G. Preguntas o bloqueos

1. Para el "jugador actual" de la beta: ¿alcanza con un input simple ("¿Quién sos?") la primera vez que se entra a "Mi perfil", o preferís que se elija desde la lista de `known-players` ya autocompletada?
2. El link "Historial" del header actual: ¿se reemplaza por "Mi perfil" y el acceso al Historial tradicional queda solo dentro del nuevo Home, o preferís mantener ambos accesos visibles en esta primera beta para no perder el atajo directo?
3. ¿La pantalla de arranque de la app sigue siendo "configurar partido" (como hoy) durante la beta, o pasa a abrir directamente el Home del jugador y "configurar partido" queda solo detrás del "+"?
