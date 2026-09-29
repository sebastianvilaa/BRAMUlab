# Resultado — Grupos BRAMU · B2b · Lobby, cierre de creación y desglose de puntos

**Fecha:** 28/09/2026 · **Rama:** `staging` · **Handoff:** `79_Handoff_Grupos_B2b_Lobby_UX_Desglose_28SEP.md`
**Bundle:** `04.11-h33`. **No se declara PASS visual** — Vercel está rate-limited (24 h) y no se reintentó deploy ni se hicieron microcommits para forzarlo, tal como pidió el handoff. Central disparará/validará un único deploy del HEAD cuando se libere la cuota.

## A — Lobby como entrada única

Bottom-nav "Mis grupos" abre siempre `GRUPOS BRAMU` (`#view-groups-lobby`, vista nueva), incluso con un solo grupo. El detalle existente (`#view-groups`) no se tocó: solo cambié cómo se entra y se sale. `Auth.getGroupsLobby(weekFrom, weekTo)` (wrapper nuevo sobre `get_groups_lobby`, B2a) trae TODOS los grupos en un solo viaje; las identidades se resuelven en batch con el mismo cache efímero que ya usa el detalle. `weekFrom`/`weekTo` se construyen con `PG.weekStartBA`, nunca con el huso del dispositivo. Sin `localStorage` como autoridad: el cache (`groupsLobby`) es solo memoria, se reconstruye desde el servidor en cada apertura.

Navegación: bottom-nav → lobby · tarjeta → detalle (reuso de `openGroupsScreen`, que ahora acepta el `groupId` a abrir) · back del detalle → lobby (antes iba a Home) · selector rápido dentro del detalle: intacto.

## B — Tarjeta real

`PG.buildLobbyCardSummary` (nueva, pura) decide qué mostrar a partir de una `weeklyTable` YA calculada por `PG.computeWeeklyTable` sobre el `weekMatches` del payload del lobby — **la misma función que ya usa Semana actual**, nunca una segunda regla. Hasta 3 filas reales respetando el empate `1,1,3`; si el primer grupo de posición ya tiene más de 3 integrantes se comprime (`"N jugadores comparten la punta"`); `Vos · #N · pts` solo aparece si el caller no quedó ya visible individualmente. Los 3 estados sin puntos (1 miembro / 2 miembros / 3+ sin actividad) usan el copy cerrado del handoff. El orden de las tarjetas es exactamente el que devuelve `get_groups_lobby` (`lastActivityAt`) — nunca se recalcula ni se reordena en cliente.

## C/D/E/F — estado cero, ayuda, creación, CTA

- Estado cero: claim + subcopy + 3 módulos + preview **EJEMPLO** con `buildLobbyCardHTML` (la MISMA función que las tarjetas reales, datos completamente fabricados y separados).
- Ayuda: la hoja "¿Cómo se suman los puntos?" se **fusionó** (mismo `id`/mecanismo) en "Cómo funcionan los Grupos BRAMU", con contenido ampliado a 3/4, semana lunes-domingo y Race. Accesible desde el `?` del header del lobby y desde el link equivalente al pie del detalle.
- Creación: flujo y selector intactos (incluida la validación contextual C1). Después de un create exitoso (server y legacy) se agregó la hoja **"Tu grupo está listo"** con nombre/cantidad de jugadores y CTA **Ir al grupo**, antes de entrar al detalle. En el lobby con grupos, el CTA es **Crear otro grupo**.
- CTA "+ Agregar jugador" (detalle y Configuración): pasó de `.btn-start` (lima macizo) a `.btn-secondary.btn-secondary--lime` (familia secundaria ya vigente). Sin cambios de función/permisos.

## G — Desglose de puntos y resumen de Race (decisión cerrada)

**Refactor para no duplicar lógica:** extraje `PG.computePlayerScoredMatches(matches, playerRef, fullHistory)` de `computeWeeklyTable` — ahora es el ÚNICO punto que decide, para un jugador, sus resultados de la semana y cuáles entran en el top 3. `computeWeeklyTable` lo consume tal cual (mismo comportamiento, cero cambio de contrato); `PG.buildPlayerWeeklyBreakdown` (nuevo) lo consume también, así que el total del sheet es SIEMPRE la suma exacta de las filas marcadas `counted` de la fila real de la tabla — nunca puede haber un top-3 distinto en dos lugares.

- **Semana actual/pasada:** tocar una fila abre el sheet de desglose (cabecera con avatar/nombre/@usuario/actividad real/puntos totales; filas compactas fecha·compañero·rivales·resultado·bonus, puntos a la derecha; una derrota muestra `0 pts`, una victoria fuera del top 3 muestra `No entra en tus 3 mejores`, nunca escondida). "Ver perfil" es la acción secundaria al pie.
- **Race anual:** tocar una fila abre un resumen semana por semana (`PG.buildRaceWeeklySummary`, misma enumeración de semanas que `computeRaceAnual` vía el nuevo `computeGroupYearWeekStarts` compartido — la suma coincide siempre con el total de Race). V1 sin desplegar los partidos de cada semana. "Ver perfil" también disponible.
- La fila de las 3 pestañas **ya no abre Perfil directo** — solo el botón "Ver perfil" dentro de cada sheet (mismo criterio de identidad real: propia fila → Mi Perfil, otra → perfil público por `player_id`).

## No tocado

Detalle aprobado (tabla, tabs, Intelligence, gear, selector interno, lógica de admins, reglas de baja), fórmula de puntos/bonus, Nivel, Ranking, C1-C4 ya cerrados, foto/Storage (B2c). No se inició B2c.

## Tests

Nuevo `bramulab/groups-b2b-lobby-desglose.test.mjs`: **22/22 PASS** — `buildLobbyCardSummary` (1/2/3+ miembros, top 3, empate 1,1,3, compresión con y sin corte de grupo, `Vos` solo cuando corresponde), `buildPlayerWeeklyBreakdown` (10 partidos·6V·4D·17 pts sin esconder los otros 7, total = suma exacta de los `counted`, derrota=0, victoria fuera de top3 marcada, bonus real coincide con `computeMatchPointsBreakdown`, compañero/rivales reales), `buildRaceWeeklySummary` (suma al total de `computeRaceAnual`, orden más-reciente-primero), y guardas estáticas de navegación/wiring (bottom-nav→lobby, back→lobby, tarjeta→detalle, un solo viaje de red sin loop de `Auth` por grupo, filas ya no abren Perfil directo, EJEMPLO reusa `.lobby-card`, CTA secundario, ayuda fusionada).

Actualicé una guarda preexistente (`groups-b2a-frontera-semanal-ba.test.mjs`) para el refactor de `computeGroupYearWeekStarts`.

Regresión: `groups-b1-server-backed.test.mjs` (24), `groups-b1-cierre-membresia-baja.test.mjs` (19), `groups-b2a-frontera-semanal-ba.test.mjs` (10) — **69/69 en conjunto**, todos re-corridos. Suite general `node --test bramulab/*.test.mjs`: **441/442** — el único fallo, `h23`, es preexistente y no relacionado (ya documentado en rondas anteriores).

## No verificado (honesto)

No se probó en navegador (sin Supabase CLI/sesión real en este sandbox, mismo límite de siempre). **No hay PASS visual** ni confirmación de que el lobby, las tarjetas o los sheets se vean/comporten bien en pantalla real — eso queda para cuando Vercel libere la cuota y Central/Sebastián puedan revisar el deploy del HEAD.
