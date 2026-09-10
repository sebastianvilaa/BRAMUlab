# BRAMUlab V03.4.2 — Informe (microparche sobre Mis grupos + ubicación)

Microparche directo sobre V03.4.1: sin cambios a puntos, bonuses, empates, regla 3 de 4, top 3
semanal, Race anual ni admins — solo navegación de MIS GRUPOS, edición/eliminación de grupo, y
la fuente de datos de ubicación en MIS DATOS.

## 1. Selector de grupo único (§1)

Reemplaza los chips horizontales de V03.4.1 (`.history-mode-chip`, todavía "competían" con las
tabs de abajo) por una sola fila `groups-current-selector` ("{Nombre del grupo} ▾"), siempre
visible — incluso con un solo grupo, porque ahora también funciona como "acá estás parado".
Tocarla abre `#groups-switch-sheet-scrim`: lista de todos los grupos del usuario (check en el
activo) más una última fila "+ CREAR GRUPO" con acento lima (`.picker-sheet-option--action`) —
mismo componente de fila que ya usaba la hoja de selección genérica de MIS DATOS, ninguna pieza
visual nueva. Elegir un grupo cambia `activeGroupId` y cierra; "+ CREAR GRUPO" cierra esta hoja
y abre la de siempre.

## 2. Header — el "+" desaparece (§2)

`#groups-create-btn` se elimina del header (HTML + su listener en `initCreateGroupSheet`). El
engranaje sigue siendo el único ícono del lado derecho y **siempre** abre la configuración del
grupo activo — nunca más ambigüedad entre "configurar" y "crear".

## 3. Tabs ACTUAL/ANTERIOR/RACE ANUAL = tabs de Historial, al byte (§3)

La clase `.history-tab` ya era compartida desde V03.4 — la diferencia real estaba en el
**contenedor**: Historial envuelve sus tabs en `.history-filters` (padding `8px 18px 0` +
`border-bottom`); MIS GRUPOS tenía un override propio (`#groups-view-tabs{margin-bottom:16px;
border-bottom:...}`) que no era idéntico. Fix: se retira ese override y `#groups-view-tabs` se
envuelve en el mismo `.history-filters` — mismo padding/borde al byte, verificado visualmente
lado a lado con Historial en QA.

## 4. BRAMU Intelligence — encabezado (§4)

"EL MOMENTO DEL GRUPO"/"EL MOMENTO · {grupo}" (V03.4/V03.4.1) se reemplaza por la estructura
`.pastilla__icon` (la misma pelotita de pádel de "TU MOMENTO" en el Home,
`.pastilla__icon-svg--momento`, sin ícono nuevo) + título fijo "BRAMU INTELLIGENCE" +
`.pastilla__microlabel` con el nombre del grupo como segunda jerarquía — mismo rol tipográfico
que "BRAMU LEE TU HISTORIA" en esa misma tarjeta del Home. `renderActiveGroupPanels` ahora solo
pinta el nombre del grupo (el título ya es texto fijo en el HTML). El spacing entre insights
(ya corregido en V03.4.1) no se tocó.

## 5. Crear grupo — placeholder (§5)

`placeholder="Ej. Los martes"` se retira del input de nombre (el `<label>` "Nombre del grupo"
ya resuelve la función) — queda un campo limpio, sin sugerir que ya hay algo cargado.

## 6. Configuración — edición inline del nombre (§6)

`.field` + `<button>GUARDAR NOMBRE</button>` se reemplaza por `.group-name-edit`: nombre +
lápiz (`.pencil-icon`/`.profile-edit-icon-btn`, mismo componente que ya usa MIS DATOS). Tocar el
lápiz oculta el nombre y muestra un `<input>` enfocado y seleccionado; blur o Enter confirman
(`Store.renameGroup` solo si el valor cambió y no quedó vacío — nunca pierde el nombre real por
un blur accidental, revierte al que ya estaba si el campo queda vacío); Escape cancela sin
guardar. Sin CTA grande ni pantalla de error dedicada (el elemento `#group-settings-error`,
ya sin ningún escritor, se retiró del HTML).

## 7. Configuración — eliminar grupo (§7)

Nuevo `Store.deleteGroup(id)`: saca al grupo de `bramulab.groups.v1`, **nunca** toca `HISTORY`
— los partidos que alguna vez contaron para ese grupo siguen intactos en el historial de cada
jugador. Botón `ELIMINAR GRUPO` al final de Configuración, mismo tratamiento que "Eliminar
partido" (`.analysis-delete-btn`). Confirmación vía el modal estándar (`confirmAction`) con el
texto exacto pedido. Al confirmar: `activeGroupId` se limpia y `renderGroupsScreen()` elige otro
grupo del usuario (o el estado vacío si no queda ninguno) — verificado en vivo.

## 8. Ubicación — GeoRef reemplaza al dataset local como fuente principal (§8)

**El hallazgo que motivó esta ronda:** "General Las Heras" no estaba en el dataset curado de
~180 localidades de V03.4.1. `locations.js` gana `searchLocationsRemote(query, {signal})` —
`fetch` real contra `apis.datos.gob.ar/georef/api/localidades` (API pública, sin auth, CORS
abierto), con `toTitleCaseEs` para pasar de "GENERAL LAS HERAS" (GeoRef siempre devuelve
mayúsculas) a "General Las Heras", y deduplicado por `localidad+región` normalizada (GeoRef
puede repetir filas). El dataset local (`searchLocations`, síncrona) baja de rango: ahora es
**fallback mínimo**, usado solo si GeoRef falla.

`app.js` (`searchProfileLocation`): debounce de 300ms (nunca un fetch por tecla) +
`AbortController` (cancela una búsqueda vieja si el usuario ya tipeó algo más nuevo — nunca
pinta una respuesta fuera de orden). Con menos de 2 caracteres se muestra el dataset local como
punto de partida para "explorar" sin pegarle a la red. Estados: "Buscando…" mientras espera,
"No pudimos conectar con el buscador. Mostrando resultados locales." si falla (HTTP no-2xx o
red caída) — nunca confundido con "Sin coincidencias" (una búsqueda que sí respondió pero no
encontró nada, ya existía desde V03.4.1).

**Verificado contra la API real en QA** (no solo mockeado en tests): `searchLocationsRemote
('general las heras')` devuelve `[{locality:'General Las Heras', region:'Buenos Aires'},
{locality:'Villa General Juan G. Las Heras', region:'Buenos Aires'}]` — el caso real que
faltaba, resuelto. `searchLocationsRemote('bella vista')` devuelve las 3 localidades reales con
ese nombre en el país (Buenos Aires, Corrientes, Tucumán) más un barrio de San Juan — mejor
cobertura que el dataset local, que solo tenía la de Buenos Aires. Flujo completo probado en la
UI real: buscar → seleccionar → guardar → persistido en la cuenta. Fallback ante red caída
simulada (`window.fetch` reemplazado temporalmente) probado y confirmado. Localidad inexistente
("zzzznoexistetal") confirma "Sin coincidencias", nunca inventa una fila.

## 9. QA manual (mobile 375px + desktop 1200px)

Un grupo · 2 grupos (selector, switch real entre ambos, tabla/Intelligence recalculando para el
grupo correcto) · crear grupo desde el selector · engranaje abre Configuración del grupo activo
· tabs ACTUAL/ANTERIOR/RACE ANUAL comparadas pixel a pixel contra Historial · BRAMU Intelligence
con ícono + nombre del grupo · renombrar grupo (inline, persistido, reflejado en el selector) ·
eliminar grupo (confirmación con el texto exacto, cancelación no borra nada, confirmación borra
el grupo y preserva el partido en el historial) · ubicación con GeoRef real (Bella Vista,
General Las Heras, localidad inexistente, fallo de red simulado).

## 10. Tests (`tests.html`)

**5 tests nuevos `V0342-DELGRP`:** `Store.deleteGroup` — borra un grupo real, nunca toca
`HISTORY`, no-op seguro sobre un id inexistente o ya borrado dos veces.

**9 tests nuevos `V0342-GEOREF`** (con `window.fetch` mockeado temporalmente, restaurado en un
`finally` — no dependen de la red real para pasar, la red real se verificó aparte en QA):
`toTitleCaseEs`, armado correcto de la URL del endpoint, encuentra "General Las Heras" con el
formato esperado, dedupea filas repetidas de la propia API, un HTTP no-2xx sube el error (nunca
se traga en silencio), un fallo de red también sube el error, y una query vacía nunca llega a
pegarle a la red.

**Suite completa, una sola corrida al cierre: 828/828 OK** (era 814/814 al cierre de V03.4.1).

## 11. Qué NO se tocó (§9, verificado)

Puntos, bonuses, empates (lógica de V03.4.1 intacta — solo cambió DÓNDE se muestra el título de
Intelligence, no cómo se calculan los insights), tabla, regla 3 de 4, top 3 semanal, semanas,
Race anual, lógica de admins (promover/degradar/quitar sin cambios), perfil público, Home,
Historial, Nivel BRAMU, Ranking BRAMU oficial (no implementado), backend.

## 12. Versionado

`Store.VERSION`: `BRAMUlab V03.4.2`. Quartet completo: `version.json`, `sw.js` (`CACHE_NAME` +
`CORE_ASSETS`), `index.html` (`?v=03.4.2`).

## 13. Commit / tag / deploy

Tag `BRAMUlab_V03.4.2`. Push a `main` → GitHub Pages redeploya automáticamente
(https://sebastianvilaa.github.io/BRAMUlab/bramulab/).
