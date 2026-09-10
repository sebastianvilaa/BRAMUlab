# BRAMUlab V03.3.3
## Informe — microparche: buscador dentro de JUGADORES

**Fecha:** 10/09/2026.
**Base:** BRAMUlab V03.3.2 (commit `a6870ca`, tag `BRAMUlab_V03.3.2`).
**Origen de esta ronda:** pedido directo del usuario en el chat (sin consolidado previo,
transcripto en `BRAMUlab_V03.3.3_Consolidado.md`) — a la pestaña JUGADORES de Perfil le falta
un buscador para cuando esa lista crezca ("el día de mañana, si tengo cien jugadores").
**Estado:** publicado en producción.

---

## 1. Aclaración de alcance (antes de implementar)

El usuario planteó la duda explícitamente: no tenía claro si este buscador debía mostrar lo
mismo que Buscar Jugadores. Se aclaró y confirmó la distinción antes de tocar código:

- **Buscar Jugadores** (Home): universo completo de jugadores conocidos localmente
  (`ML.buildJugadorDirectory`) — sirve para descubrir/agregar gente nueva.
- **JUGADORES → buscador nuevo**: filtra SOLO la lista que el usuario ya agregó
  (`Store.loadAddedPlayers`) — sirve para encontrar a alguien puntual dentro de una lista
  personal que puede crecer con el tiempo. Nunca el universo completo.

## 2. Implementación

- Campo de búsqueda (`#jugadores-search-input`) arriba de la lista, mismo componente visual
  `.player-search-field` que ya usan Buscar Jugadores y Elegir compañero/rival.
- Filtra con `ML.filterPlayerCandidates(allNames, query, [])` — la MISMA función pura de
  substring normalizado que ya usan esas dos pantallas, aplicada al pool de agregados en vez
  del directorio completo. Ninguna función nueva.
- Solo aparece si hay al menos un jugador agregado (`renderJugadoresTab`) — lista vacía sigue
  mostrando exactamente el estado "Todavía no agregaste jugadores" de siempre, sin buscador
  (nada que buscar todavía).
- Nuevo estado "Sin coincidencias." (`#jugadores-search-empty`) — distinto del estado de lista
  vacía: aparece solo cuando SÍ hay jugadores agregados pero la búsqueda no encuentra a
  ninguno.
- El campo se resetea cada vez que se entra a la pestaña (mismo criterio que
  `openPlayerSearchScreen`), nunca conserva una búsqueda de una visita anterior.

## 3. Tests

**743/743 sin cambios** — ninguna función pura nueva, reutiliza `ML.filterPlayerCandidates`
tal cual ya estaba probada. Sin tests nuevos (política del proyecto: solo si se toca lógica).

## 4. QA

**Mobile (375×812, dev server local):** simulados 100 jugadores agregados vía consola (más
Facundo/Matías de rondas anteriores, 102 en total) para probar el escenario real que motivó
el pedido:
- Buscador visible, lista completa de 102 con separadores y Nivel BRAMU correcto.
- Búsqueda por texto ("facundo") filtra a 1 resultado.
- Búsqueda sin coincidencias muestra "Sin coincidencias.", lista oculta.
- Tocar un resultado abre su perfil público correctamente; volver regresa a JUGADORES con el
  buscador limpio y la lista completa de nuevo.
- Con la lista de agregados vacía (los 102 quitados), el buscador desaparece y vuelve el
  estado "Todavía no agregaste jugadores."

Se restauró la lista de prueba a su estado anterior (Facundo + Matías) al terminar.

**Desktop (1280×900):** mismo flujo, sin desborde ni layout roto.

---

## 5. Qué no se tocó

Buscar Jugadores (Home), Elegir compañero/rival, datos del perfil público, persistencia
(`Store.addPlayerToList`/`removePlayerFromList`/`isPlayerAdded` sin cambios), Historial,
Ranking, backend, Nivel BRAMU.

## 6. PWA y versión

- `Store.VERSION`: `"BRAMUlab V03.3.2"` → **`"BRAMUlab V03.3.3"`**.
- `version.json` actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-3-2` → **`bramulab-v03-3-3`**.
- `?v=03.3.2` → **`?v=03.3.3`** en `index.html`/`sw.js`.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 7. Hash exacto y tag

- Commit de implementación (código + Consolidado): `093925975902793de36e4140bc9d9fac52715340`.
- Tag `BRAMUlab_V03.3.3` apunta al commit inmediatamente posterior a este informe.
