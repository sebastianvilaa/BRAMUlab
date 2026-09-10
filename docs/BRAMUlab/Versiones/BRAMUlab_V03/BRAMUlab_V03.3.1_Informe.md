# BRAMUlab V03.3.1
## Informe — microparche visual/UX sobre V03.3

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.3 (commit `643098a`, tag `BRAMUlab_V03.3`).
**Origen de esta ronda:** pedido directo del usuario en el chat (sin consolidado previo,
transcripto en `BRAMUlab_V03.3.1_Consolidado.md`) — 6 ajustes puntuales sobre Home, el
componente de fila de jugador y Perfil público, sin tocar datos/lógica.
**Estado:** publicado en producción.

---

## 1. Home — BUSCAR JUGADORES

- `.pastilla--search-players{ margin-top: 10px }` — separación propia respecto de la grilla
  de métricas de arriba (antes pegada). Tamaño/estructura de la tarjeta sin cambios.
- Texto del título → `var(--paper-dim)` (el mismo tono secundario que ya usan
  `.mini-stat__label`/`.evolution-summary__label` en el resto de la app), en vez de
  `var(--paper)` (blanco, el mismo peso que un título real como ACTIVIDAD/EFECTIVIDAD) —
  baja su protagonismo sin tocar tamaño/peso/mayúsculas. Ícono lupa (lima) y chevron sin
  cambios.

## 2. Componente compartido `.player-row`

`border-radius: 12px` → **`0`** — un solo cambio en el componente único de §6 de V03.3, así
que se ve igual en los 4 lugares que ya lo usan: Buscar Jugadores, JUGADORES, Elegir
compañero y Elegir rival 1/2. Los separadores (`.player-row + .player-row`, ya existentes)
quedan rectos de punta a punta en vez de recortados por la esquina redondeada del estado
`:active`. Verificado en vivo en los 4 usos — sin regresiones (ver §5).

## 3. Perfil público — header

Título del header pasa de dinámico (nombre del jugador) a fijo: **`PERFIL DE JUGADOR`**
(`index.html`, se retira la línea `$('#player-public-header-title').textContent = name` de
`app.js`). El nombre visible sigue siendo protagonista dentro de la tarjeta de identidad,
sin ningún cambio ahí.

## 4. Agregar jugador — feedback

`showToast(message, durationMs, variant)` — nuevo tercer parámetro opcional, mismo toast
único de siempre (`#toast`), nunca un componente nuevo. Al tocar AGREGAR JUGADOR: se agrega
igual que antes + `showToast('Jugador agregado')` (toast normal, sin modal).

## 5. Jugador ya agregado → ELIMINAR DE JUGADORES

- El botón deja de alternar entre `.btn-start` (lima) y `.btn-secondary` (neutro): ahora
  alterna entre `.btn-start` (AGREGAR JUGADOR) y **`.analysis-delete-btn`** — la misma clase
  que ya usa "Eliminar partido" en Resumen (texto rojo, sin fondo/pastilla, centrado, mucho
  más chico que el resto — reutiliza `--danger`, nunca un rojo nuevo). Texto: `ELIMINAR DE
  JUGADORES`.
- Al tocar: quita al jugador (mismo `Store.removePlayerFromList` de siempre, sin cambios) +
  `showToast('Jugador eliminado', undefined, 'danger')`.
- Toast rojo nuevo: `.toast.is-danger{ background: var(--danger); color: var(--paper) }` —
  variante mínima del mismo componente (no existía ninguna variante de color todavía en
  `showToast`), coherente con el resto del sistema de color destructivo.
- Sin confirmación: agregar/quitar de esta lista personal sigue siendo una acción reversible
  de bajísimo riesgo (no es "Eliminar partido"), consistente con la decisión ya tomada en
  V03.3.

## 6. Perfil > JUGADORES

Sin cambios de código — nunca hubo swipe implementado. El flujo para quitar un jugador sigue
siendo, como pide el consolidado: JUGADORES → tocar la fila (abre el perfil público) →
ELIMINAR DE JUGADORES.

---

## 7. Qué no se tocó

Datos mostrados en el perfil público, Efectividad, Mejor racha, Mejor nivel BRAMU, lógica de
búsqueda (`ML.buildJugadorDirectory`/`filterPlayerCandidates`), persistencia
(`Store.loadAddedPlayers`/`isPlayerAdded`/`addPlayerToList`/`removePlayerFromList`, sin
cambios en su firma ni su comportamiento), Home fuera de la tarjeta BUSCAR JUGADORES, Perfil
fuera de la pestaña JUGADORES, Historial, Ranking, backend, Nivel BRAMU (ni el real ni el
simulado). Ninguna función pura nueva ni modificada — microparche 100% visual/UX/copy.

---

## 8. Tests

**739/739 en verde, sin tests nuevos** — ningún cambio toca lógica pura
(`player-home.js`/`match-load.js`/`store.js` sin diffs). `showToast` (nueva firma con
`variant`) es orquestación de DOM, no una función pura — mismo criterio ya documentado para
el resto de `app.js` (sin arnés de pruebas para DOM/interacción en este proyecto). Suite
completa corrida una sola vez al cierre.

## 9. QA

**Mobile (375×812, dev server local):** reutilizada la cuenta de prueba de V03.3 ("Vero" +
Matías/Facundo/Nico). Verificado en vivo:
- Home: "BUSCAR JUGADORES" con aire visible respecto de "Mejor compañero"/"Rival más
  enfrentado" arriba, texto en gris, ícono lima, chevron intacto.
- Buscar Jugadores: separadores rectos entre Matías/Facundo/Nico.
- Elegir Compañero (Cargar partido): mismo componente, mismos separadores rectos, Nivel
  BRAMU y acento de color (verde compañero) intactos.
- Perfil público de Facundo: header "PERFIL DE JUGADOR" (antes decía "Facundo"), nombre
  visible intacto en la tarjeta de identidad.
- AGREGAR JUGADOR → toast "Jugador agregado" (`classList` sin `is-danger`) → botón pasa a
  "ELIMINAR DE JUGADORES" con la clase `analysis-delete-btn` (rojo, sin fondo).
- ELIMINAR DE JUGADORES → toast "Jugador eliminado" con `is-danger` → botón vuelve a
  "AGREGAR JUGADOR"/`btn-start`.
- Pestaña JUGADORES: separadores rectos entre 2 jugadores agregados, Nivel BRAMU coincide
  con el de cada perfil.

**Desktop (1280×900):** re-verificado el mismo Home — sin desborde ni layout roto.

Sin regresiones detectadas en el resto de Elegir compañero/rival (selección, exclusión,
secuencia automática) ni en ningún otro uso de `.player-row`.

---

## 10. PWA y versión

- `Store.VERSION`: `"BRAMUlab V03.3"` → **`"BRAMUlab V03.3.1"`**.
- `version.json` actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-3` → **`bramulab-v03-3-1`**.
- `?v=03.3` → **`?v=03.3.1`** en `index.html`/`sw.js`.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 11. Hash exacto y tag

- Commit de implementación (código + Consolidado): `991fc13873a68be838e721a7d8369cabfd4a0c8c`.
- Tag `BRAMUlab_V03.3.1` apunta al commit inmediatamente posterior a este informe.
