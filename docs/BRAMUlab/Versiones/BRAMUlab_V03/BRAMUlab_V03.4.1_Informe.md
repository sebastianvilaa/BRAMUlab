# BRAMUlab V03.4.1 — Informe (microparche sobre Mis grupos)

Microparche directo sobre V03.4: sin cambios a la lógica general de MIS GRUPOS (puntos,
regla 3 de 4, top 3 semanal, semanas, Race anual, admins) — solo UX/jerarquía visual, un bug
real de empates, y el campo de ubicación pendiente en MIS DATOS.

## 1. Bug real — empates (§5)

**Causa:** `computeWeeklyTable`/`computeRaceAnual` asignaban posición como `índice + 1` tras
ordenar — dos jugadores con el mismo puntaje terminaban en posiciones consecutivas distintas
(1, 2) en vez de compartir la 1. La propia BRAMU Intelligence heredaba el error ("Esteban
lidera" / "Seba le pisa los talones... por los mismos puntos" — contradiciendo el empate real).

**Fix:** nueva función pura `PLGroups.assignPositions(rows)` — posición "estilo competencia":
dos filas con el mismo puntaje comparten posición, la siguiente distinta salta al índice real
(`1, 1, 3`, nunca `1, 1, 2`). Reemplaza el `.map((r,i)=>{position:i+1})` suelto en
`computeWeeklyTable` y `computeRaceAnual` — un solo punto de verdad para ambas tablas.

**BRAMU Intelligence** ahora reconoce el empate en las 3 funciones que hablan de "quién va
primero": `insightLeader` (`topTiedNames` — junta TODOS los nombres empatados en la cima),
`insightGapOrParity` (compara el primer grupo de puntaje contra el SEGUNDO GRUPO DISTINTO, no
contra la fila[1] del array — que si están empatadas en la cima daría un gap de 0 falso y el
texto prohibido) e `insightRaceLeader`. Nunca más "le pisa los talones"/"está segundo" cuando el
puntaje es idéntico — verificado con un caso de doble empate simultáneo en QA real (Esteban/Seba
empatados en 6, Bartolome/Wal empatados en 5): "La semana está muy pareja: Bartolome Alejandro
Fernandez y Wal le pisan los talones a Esteban y Seba por 1 punto." (plural correcto en ambos
lados de la frase).

## 2. MIS GRUPOS — jerarquía visual (§1/§2/§3/§4/§7)

- **Empty state:** `CREAR GRUPO` pasa de `.btn-mini` (píldora chica) a `.btn-start.btn-save`
  (mismo CTA de ancho completo que el resto de la app).
- **Selector de grupos vs. tabs de contenido:** el selector pasa de `.history-tab` (mismo
  tratamiento que ACTUAL/ANTERIOR/RACE ANUAL, "competían visualmente") a `.history-mode-chip`
  (chips redondeados — mismo componente que ya usaban los chips de modo de Historial para esa
  misma distinción jerárquica), con un label `GRUPO` arriba. Las tabs de contenido quedan
  intactas.
- **Nombre del grupo en Intelligence:** el título pasa de "EL MOMENTO DEL GRUPO" a "EL MOMENTO ·
  {nombre del grupo}" (ACTUAL y ANTERIOR), seteado en `renderActiveGroupPanels`.
- **Spacing de Intelligence:** bug real encontrado — los insights son `<p>`, que traen margen
  vertical propio del navegador (~1em) SUMADO al `gap` del flex; eso, no el `gap` solo, era la
  separación excesiva. Fix: `margin:0` en `.groups-intel-item` + `gap` bajado de 9px a 6px.
- **"+" del header:** gana el acento lima de las acciones de alta (antes gris, igual que el
  engranaje al lado — "parecía una acción sobre el grupo abierto"). Sigue siendo EXCLUSIVAMENTE
  crear grupo nuevo.
- **"+ AGREGAR JUGADOR" en el contenido principal:** nuevo botón (solo admins) al final de la
  pantalla de MIS GRUPOS, además del que ya existía en Configuración — misma acción
  (`openAddMembersToGroupSheet`), dos entradas.

## 3. Tabla del grupo — identidad (§6)

- **Bug real:** la fila siempre mostraba la inicial aunque el jugador tuviera una cuenta local
  real con foto de perfil. Fix: `buildGroupRowAccount(name)` busca la cuenta por nombre visible
  normalizado (mismo criterio que `renderPlayerPublicProfile`) y `buildGroupAvatarHTML` usa la
  foto si existe (`.person-list__avatar--photo`, con `overflow:hidden` — la clase base nunca lo
  tenía porque hasta ahora solo contenía 2 letras).
- **`· @usuario`:** en la misma línea que el nombre cuando entra (`.group-table__toprow`,
  `flex-wrap`), baja solo a una línea propia cuando no hay lugar — sin JS midiendo texto,
  verificado en vivo con un nombre largo ("Bartolome Alejandro Fernandez"): el nombre se trunca
  con elipsis y el handle cae a la línea de abajo.
- Nivel BRAMU sigue sin aparecer en la tabla (sin cambios, ya cumplía §11 desde V03.4).

## 4. Configuración del grupo — botones (§8)

`+ AGREGAR JUGADOR` pasa de `.btn-mini` a `.btn-start.btn-save`. `GUARDAR NOMBRE` ya usaba
`.btn-secondary.btn-save` desde V03.4 (sin cambios). Ambos comparten ahora exactamente el mismo
sistema — ninguna variante de ancho/altura arbitraria.

## 5. MIS DATOS — ubicación (§9)

**Nuevo módulo puro `locations.js`** (`window.PLLocations`): dataset local de ~180 localidades
argentinas (CABA por barrio + AMBA con foco en dónde se concentra el pádel + capitales/ciudades
principales de las 24 provincias) y `searchLocations(query)` (substring normalizado sin acentos/
mayúsculas, sobre "localidad región" combinadas — así buscar por cualquiera de las dos partes
encuentra la fila). Sin geocoding real: una lista curada para que el usuario ELIJA una opción
normalizada, nunca texto libre — reemplazable por una API real el día que exista backend.

**Campo único "¿De dónde sos?"** en Editar Datos: fila compacta que abre una hoja con buscador
(`#profile-location-sheet`, reutiliza `.player-search-field`) — tocar un resultado selecciona Y
cierra. Guarda 3 campos separados en la cuenta (`locality`, `region`, `country`) más
`rankingLocalZone` (siempre `null` en esta ronda — nadie lo calcula todavía, preparado para el
futuro Ranking BRAMU local). `Store.createUserAccount` ahora declara estos 4 campos por defecto
en `null`; `updateUserAccount` ya los persistía gratis (merge genérico). MIS DATOS (lectura)
suma una fila "Ubicación" en la tarjeta de datos personales/deportivos, formato
`Store.location → "Bella Vista, Buenos Aires"`.

Ranking BRAMU oficial sigue sin implementarse (§9 in fine, §11) — este campo solo guarda el dato.

## 6. MIS DATOS — selectores compactos (§10)

Género/Mano dominante/Lado habitual/Categoría pasan de `.option-row` (botones grandes) a filas
compactas `.profile-select-row` (label arriba, valor abajo, chevron) — mismas opciones/valores
de siempre (`GENDER_LABELS`/`HAND_LABELS`/`SIDE_LABELS`/`CATEGORY_LABELS`, sin cambios). Una
sola hoja reutilizada para las 4 (`#profile-picker-sheet` + `PROFILE_PICKER_FIELDS`, un mapa
`{title, labels, get, set}` por campo) — tocar una opción la selecciona y cierra la hoja en el
mismo toque. El `<select>` nativo de Categoría se retira (reemplazado por el picker). Fecha de
nacimiento no se tocó (sigue siendo el `<input type="date">` de siempre).

## 7. QA manual (mobile 375px + desktop 1200px, `javascript_tool` + `computer` sobre server HTTP local)

Verificado en vivo con datos reales: estado vacío MIS GRUPOS (CTA ancho completo) · 2 grupos
(selector de chips, aislados entre sí) · ACTUAL con caso de empate real (Esteban/Seba 6 pts c/u,
posición 1 compartida; Diegote/Wal 0 pts, posición 3) · ANTERIOR/RACE ANUAL con la misma lógica
de empate (verificado con `computeWeeklyTable`/`computeRaceAnual` directo + en pantalla) · foto/
@usuario en filas de tabla (cuenta real vs. sin cuenta) · wrap de nombre largo + handle · "+ AGREGAR
JUGADOR" (contenido principal y Configuración) · Configuración (botones anchos correctos) ·
Editar Datos (Género/Mano/Lado/Categoría por hoja, selección y cierre inmediato) · Ubicación
(buscador, "bella vista" → 1 resultado exacto, selección, guardado, reflejado en MIS DATOS de
lectura) · chequeo visual en desktop (1200px, layout centrado, sin overflow).

## 8. Tests (`tests.html`)

**11 tests nuevos de empates** (`V0341-EMPATE`): `assignPositions` puro (sin empates, empate
simple, empate múltiple en dos niveles) + integración real sobre `computeWeeklyTable`/
`computeRaceAnual` con el caso exacto del reporte (Seba/Esteban 6 pts, Diegote 0) + BRAMU
Intelligence (anuncia "comparten el liderazgo"/"comparten la punta", nunca "le pisa los
talones"/"segundo" ante empate real).

**10 tests nuevos de ubicación** (`V0341-UBIC`): `formatLocationLabel`, `searchLocations` (vacío
devuelve lista no vacía, encuentra por localidad exacta, insensible a acentos/mayúsculas,
matchea por región, sin resultados nunca inventa) + persistencia real vía
`Store.createUserAccount`/`updateUserAccount` (campos en `null` por defecto, guardado correcto,
round-trip por `localStorage`, `rankingLocalZone` nunca se toca de rebote).

Sin tests de spacing/CSS/jerarquía visual (no son lógica).

**Suite completa, una sola corrida al cierre: 814/814 OK** (era 793/793 al cierre de V03.4).

## 9. Qué NO se tocó (§11, verificado)

Sistema de puntos de grupos (base 5 + bonuses), regla 3 de 4, top 3 semanal, semanas lunes-
domingo (cálculo, no el fix de posición), Race anual (acumulación, no el fix de posición),
lógica de admins (guardrails intactos), perfil público, búsqueda de jugadores, Home, Historial,
scoring, Nivel BRAMU, Ranking BRAMU oficial (no implementado), backend (sigue 100% local).

## 10. Versionado

`Store.VERSION`: `BRAMUlab V03.4.1`. Quartet completo: `version.json`, `sw.js` (`CACHE_NAME` +
`CORE_ASSETS`, incluye el nuevo `locations.js`), `index.html` (`?v=03.4.1`).

## 11. Commit / tag / deploy

Tag `BRAMUlab_V03.4.1`. Push a `main` → GitHub Pages redeploya automáticamente
(https://sebastianvilaa.github.io/BRAMUlab/bramulab/).
