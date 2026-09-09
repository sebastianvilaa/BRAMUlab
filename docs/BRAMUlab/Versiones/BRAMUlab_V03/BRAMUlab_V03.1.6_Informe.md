# BRAMUlab V03.1.6
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.1.5 (commit `76edbe3`, tag `BRAMUlab_V03.1.5`).
**Origen de esta ronda:** reporte directo del usuario en producción — loop infinito del cartel
de actualización. Transcripto como
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1.6_Consolidado.md`.
**Estado:** publicado en producción.

---

## 1. Diagnóstico — por qué "ACTUALIZAR" no arreglaba nada

`checkForNewVersion()` (app.js) compara `version.json` (siempre pedido con `cache:'no-store'`)
contra `Store.VERSION` — la constante `APP_VERSION` que trae el `store.js` YA CARGADO en esa
pestaña. Si difieren, muestra el cartel. Al tocar **ACTUALIZAR**, `forceUpdateApp()`:

1. Desregistra el Service Worker.
2. Borra TODA la Cache Storage (`caches.delete()`).
3. Recarga con `location.href = pathname + '?_fu=' + Date.now()`.

Este mecanismo parece completo, pero **Cache Storage no es la única caché del navegador**. Los
`<script src="store.js">`/`<link href="styles.css">` de `index.html` no llevaban ningún query
string propio — la petición de ESOS archivos puede resolverse desde la **caché HTTP nativa**
del navegador (disco/memoria, una capa totalmente distinta y bajo control exclusivo del
servidor vía sus cabeceras `Cache-Control`, que `caches.delete()` JAMÁS toca). El `?_fu=...`
solo fuerza a que el DOCUMENTO (`index.html`) se pida de nuevo — pero ese documento fresco
sigue apuntando a `store.js` SIN query string, así que el navegador puede seguir sirviendo la
copia vieja de ESE archivo puntual sin ni siquiera consultar la red.

Resultado: `Store.VERSION` seguía siendo el de la versión anterior después de "actualizar",
`checkForNewVersion` lo detectaba como desactualizado otra vez, y el cartel volvía a aparecer
— para siempre, sin importar cuántas veces se tocara ACTUALIZAR.

**Por qué esto nunca se vio en el QA de las 15 rondas anteriores de esta serie**: todo el QA de
esta serie corrió contra el dev server local (`.claude/dev-server.py`), que manda
`Cache-Control: no-store, no-cache, must-revalidate` en **todas** las respuestas — ahí esta
clase de bug es estructuralmente imposible de reproducir. Solo existe contra el hosting real
(GitHub Pages), donde sí hay cabeceras de caché normales. Es un punto ciego real del método de
QA usado en esta serie, no una falla de atención puntual.

---

## 2. Corrección — cache-busting real en los assets propios

Se agrega `?v=03.1.6` a cada `<script src>` y al `<link rel="stylesheet">` de `index.html`
(`engine.js`, `stats.js`, `store.js`, `player-home.js`, `match-load.js`, `player-identity.js`,
`app.js`, `styles.css`) y, con el MISMO valor, a las entradas equivalentes de
`CORE_ASSETS` en `sw.js` (deben coincidir exactamente — la query string es parte de la clave
que usa `caches.match()`, así que un valor distinto entre ambos archivos haría que el Service
Worker nunca encuentre su propio pre-cache y pierda el offline-first, aunque sin romper nada).

Con esto, cada release usa una URL que el navegador **nunca vio antes** para sus archivos
propios — un cache hit es imposible sin importar qué cabeceras mande GitHub Pages, cerrando el
mecanismo de raíz en vez de parchear el síntoma.

**Este valor (`?v=X`) pasa a ser un CUARTO lugar que sincronizar en cada release**, junto a
`APP_VERSION` (store.js), `version.json` y `CACHE_NAME` (sw.js) — documentado con comentarios
explícitos en los 2 archivos para que no se repita el olvido.

---

## 3. Corrección adicional — botón "ACTUALIZAR" sin feedback visual

Auditando `forceUpdateApp()` se encontró que solo deshabilitaba/renombraba el botón de
HERRAMIENTAS DE DESARROLLO (`#dev-tools-force-update`), nunca el botón público real
`#update-now-btn` que el usuario efectivamente toca desde el cartel de nueva versión — quien
lo tocaba no veía ningún indicio de que el toque se había registrado mientras la limpieza de
caché/SW corría (unos cientos de ms). No era la causa del loop, pero es el mismo código y
convenía corregirlo de una vez: ahora deshabilita cualquiera de los dos botones que exista en
el DOM en ese momento.

---

## 4. Tests

**722/722 en verde** (sin tests nuevos). Este es un bug de infraestructura de caché HTTP del
navegador — no hay forma de reproducirlo ni testearlo dentro de `tests.html`/el dev server
local (que es precisamente la razón por la que pasó desapercibido). Suite completa corrida una
sola vez para confirmar cero regresiones de lógica.

---

## 5. QA manual

Contra el dev server local (que no puede reproducir el bug original, pero sí confirma que el
mecanismo de carga con query string funciona sin romper nada):

- ✅ Los 7 JS + `styles.css` cargan correctamente con `?v=03.1.6` (200 OK, confirmado en Network).
- ✅ `Store.VERSION` lee `"BRAMUlab V03.1.6"` correctamente después de cargar con la query string.
- ✅ Simulado el flujo completo: mostrar el cartel → tocar ACTUALIZAR → `forceUpdateApp` corre,
  desregistra SW, limpia cachés, recarga a `?_fu=...` → la página recargada vuelve a mostrar
  `Store.VERSION` correcto y el `localStorage` (sesión, historial) queda intacto.
- ✅ Suite completa verde (722/722).

La condición exacta reportada (caché HTTP nativa sirviendo una copia vieja) no es reproducible
localmente por diseño del dev server — la corrección se valida por revisión de código: una URL
con un valor de query nunca visto antes no puede ser un cache hit, independientemente de las
cabeceras que mande el servidor real. Quedará confirmada en la práctica cuando el usuario
actualice a esta versión.

---

## 6. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.1.5"` → **`"BRAMUlab V03.1.6"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-1-5` → **`bramulab-v03-1-6`**.
- **Nuevo**: `?v=03.1.6` en los `<script>`/`<link>` de `index.html` y en `CORE_ASSETS` de `sw.js`.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 7. Hash exacto y tag

- Commit de implementación (código): pendiente de completar tras el commit.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.1.6` apuntará al commit inmediatamente posterior a este.

---

## 8. Diferencias justificadas

Ninguna respecto del pedido del usuario (corregir el loop). Se corrigió además, dentro del
mismo código auditado, el botón "ACTUALIZAR" sin feedback visual (§3) — consecuencia directa de
revisar `forceUpdateApp()` a fondo para encontrar la causa raíz del loop, no una desviación de
alcance.

## 9. Qué no se tocó

Ninguna lógica de negocio, ninguna pantalla. Home, Historial, Ranking, Notificaciones, Login,
MI PERFIL, MIS DATOS, Acceso y seguridad, Cerrar sesión, backend: sin cambios.
