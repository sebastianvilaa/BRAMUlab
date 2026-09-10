# BRAMUlab V03.3.2
## Informe — microparche: Recientes/Todos + bug real corregido

**Fecha:** 10/09/2026.
**Base:** BRAMUlab V03.3.1 (commit `76f4e5e`, tag `BRAMUlab_V03.3.1`).
**Origen de esta ronda:** pedido directo del usuario en el chat (sin consolidado previo,
transcripto en `BRAMUlab_V03.3.2_Consolidado.md`) — falta un pequeño título que explique de
dónde salen los nombres en Elegir compañero/rival y Buscar Jugadores.
**Estado:** publicado en producción.

---

## 1. Lo pedido

Agregar un título sutil tipo "Jugadores recientes" arriba del listado, en ambas pantallas, de
forma consistente.

## 2. Lo implementado

- **Elegir compañero / Elegir rival:** ya existía una sección "Recientes" (con su label,
  desde V02.5) seguida de un segundo listado sin ningún título — eso es lo que el usuario
  venía viendo como "un listado plano sin explicación". Se agregó el título **"Todos"** para
  ese segundo bloque, mismo componente de label que "Recientes"
  (`.load-player-sheet__section-label`).
- **Buscar Jugadores:** no tenía ninguna sección — un solo listado plano. Se le agregó el
  MISMO patrón de dos secciones (**Recientes** / **Todos**), reusando exactamente la misma
  lógica que ya arma esas dos secciones en el selector
  (`ML.computeRecentPlayers`/`ML.filterPlayerCandidates`).
- Ambos labels se ocultan mientras hay una búsqueda activa (un resultado de búsqueda ya se
  explica solo por el texto tecleado) — mismo criterio que ya tenía "Recientes" en el
  selector, extendido ahora a "Todos".
- "Sin coincidencias." en la sección Todos ya no aparece si Recientes cubrió todo lo
  conocido — antes de este ajuste ese mensaje podía quedar mostrado por debajo de una
  Recientes ya llena, leyéndose como un error que no era tal.

## 3. Bug real encontrado (no era solo un tema de copy)

Al implementar la sección Recientes en Buscar Jugadores, verificando en vivo con la cuenta de
prueba se encontró que **la sección "Recientes" nunca mostraba nada, en ninguna de las dos
pantallas**, para la cuenta real usada en todo este testing. Investigado:

`ML.computeRecentPlayers(history, playerName, excludeNames)` recibía el nombre del jugador
actual como **string plano** y lo pasaba tal cual a `PH.filterMatchesForPlayer`. Desde V03.0,
cada partido nuevo estampa `userId` en la fila del jugador logueado, con una regla de
integridad **autoritativa y exclusiva**: una fila con `userId` SOLO puede encontrarse buscando
por ese mismo `userId` — nunca cae a comparar por nombre, aunque coincida exactamente (ver
`player-home.js:findPlayerRow`). Como `computeRecentPlayers` nunca pasaba el `userId` de la
sesión, para **cualquier cuenta creada después de V03.0** esa búsqueda no encontraba jamás sus
propios partidos → `filterMatchesForPlayer` devolvía `[]` → "Recientes" quedaba **siempre
vacía**, en silencio, desde V03.0 (07/09/2026) hasta hoy.

Nunca se había detectado porque, sin "Recientes", la sección de abajo (que si mostraba a
todos, sin excluir a nadie) simplemente se veía como "la lista completa" — visualmente
correcta, solo que atribuyendo a "Todos" gente que en realidad era "Recientes". El pedido de
este microparche (agregar los títulos) fue justamente lo que expuso el bug al querer mostrar
contenido real bajo cada título.

**Fix** (`match-load.js`): `computeRecentPlayers` ahora resuelve el nombre propio con
`PH.resolveIdentityRef(playerRef).name` (para la exclusión por string) y pasa `playerRef`
intacto a `PH.filterMatchesForPlayer` — acepta tanto un string plano (compatibilidad total,
cuentas legacy sin `userId`) como `{name, userId}`. Los 2 call sites en `app.js` (selector de
compañero/rival y Buscar Jugadores) pasan ahora `currentIdentity()` en vez del string plano
`currentPlayerName`.

**Verificado en vivo, antes/después, con la misma cuenta de prueba:** antes del fix, "Elegir
compañero" nunca mostraba Recientes pese a tener un partido real jugado; después del fix,
muestra correctamente a los 3 jugadores de ese partido bajo "RECIENTES".

---

## 4. Tests

**743/743 en verde (4 nuevos)**, agregados junto a los tests ya existentes de
`ML.computeRecentPlayers`:
- Con un partido cuya fila propia tiene `userId` estampado, llamar con el nombre plano
  (string) reproduce el bug original (`[]`) — documenta el comportamiento previo.
- Llamar con `{name, userId}` correcto sí encuentra los partidos (el fix).
- Un `userId` incorrecto no "reclama" partidos de otra cuenta (la regla de exclusividad se
  respeta también desde este call site).
- Una cuenta legacy sin `userId` (string plano de siempre) sigue funcionando exactamente
  igual que antes — cero regresión para el caso ya cubierto.

## 5. QA

**Mobile (375×812, dev server local):** reutilizada la cuenta de prueba de V03.3/V03.3.1
("Vero" + Matías/Facundo/Nico, 1 partido real). Verificado en vivo:
- Buscar Jugadores: "RECIENTES" con los 3 jugadores del partido real, Nivel BRAMU correcto;
  "TODOS" ausente (no queda nadie más en el universo conocido — comportamiento correcto, no
  un error).
- Con una búsqueda activa (`fac`): ambos labels ocultos, resultado plano de siempre
  ("Facundo").
- Elegir Compañero (Cargar partido): "RECIENTES" ahora poblada con los mismos 3 jugadores
  (antes del fix, esta sección jamás mostraba nada para esta cuenta); "TODOS" oculto y sin
  "Sin coincidencias." colgando (ya no queda nadie fuera de Recientes).

Sin regresiones en el resto del selector (selección, exclusión por slot, secuencia
automática) ni en ningún otro uso de `ML.computeRecentPlayers`.

---

## 6. Qué no se tocó

Datos del perfil público, persistencia de jugadores agregados, Home fuera de Buscar
Jugadores, Perfil fuera de Buscar Jugadores/Elegir compañero-rival, Historial, Ranking,
backend, Nivel BRAMU.

## 7. PWA y versión

- `Store.VERSION`: `"BRAMUlab V03.3.1"` → **`"BRAMUlab V03.3.2"`**.
- `version.json` actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-3-1` → **`bramulab-v03-3-2`**.
- `?v=03.3.1` → **`?v=03.3.2`** en `index.html`/`sw.js`.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 8. Hash exacto y tag

- Commit de implementación (código + Consolidado): `a6870ca246db599b44fd5006b559d965d20affba`.
- Tag `BRAMUlab_V03.3.2` apunta al commit inmediatamente posterior a este informe.
