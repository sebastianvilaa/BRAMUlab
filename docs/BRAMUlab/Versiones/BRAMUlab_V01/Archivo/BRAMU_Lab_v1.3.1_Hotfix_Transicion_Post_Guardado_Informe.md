# BRAMU Lab — Hotfix v1.3.1 · Transición post-guardado y ancho del teclado
## Informe de cierre

**Estado:** IMPLEMENTADO Y VERIFICADO
**Fecha:** 03 de septiembre de 2026
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/` (sin cambios — ver §6)
**Versión de partida:** v1.3 (commit `fdaa97c`) · **Versión resultante:** v1.3.1
**Origen:** revisión externa (ChatGPT) sobre la Fase 3 recién publicada, con dos hallazgos puntuales.

Este informe es autosuficiente: documenta causa real (verificada, no asumida), corrección, pruebas y despliegue sin necesitar el historial de chat operativo.

---

## 1. Qué reportó la revisión externa, y qué se confirmó al verificar

La revisión señaló dos problemas sobre "Cargar partido jugado" recién publicado en v1.3:

1. **Bloqueante:** al guardar, `#view-manual-load` seguía con `hidden=false`/`display=flex` igual que `#view-summary`, y "la pantalla de carga permanece encima y tapa el Resumen".
2. **Responsive:** `#load-keypad` (el teclado numérico) usa `position:fixed; left:0; right:0`, así que en escritorio ocupa todo el ancho del viewport en vez del ancho máximo (768px) del resto de la app.

Antes de tocar código se verificó cada afirmación por separado, con `getComputedStyle` real en el navegador (no solo lectura de código):

- **El diagnóstico literal (`hidden=false` en ambas vistas) era correcto**, pero la conclusión ("la carga tapa el Resumen") **no**: `.view--summary` tiene `position:fixed; inset:0; z-index:25` (confirmado en `styles.css:590`) — es un overlay que cubre toda la pantalla sin importar qué haya "debajo" con `hidden=false`. Se comprobó con una captura de pantalla del flujo de guardado tal cual estaba en v1.3: el Resumen se veía perfectamente, sin ningún rastro de la pantalla de carga. Este mismo patrón (no ocultar la vista de fondo al mostrar el Resumen) ya existe desde antes en `finishMatch`/`finishMatchGames` para partidos en vivo, sin que nunca haya causado un problema visible — por el mismo motivo.
- **El bug real, sí reproducido:** `#load-keypad` es el único overlay de esta pantalla **sin scrim** (a propósito — el marcador debe seguir visible mientras se carga el resultado, §8 del consolidado de la Fase 3) y tiene `z-index:32`, **mayor** que el del Resumen (`25`). Reabrir una celda ya cargada (para revisarla, sin necesariamente cambiar nada) no invalida el borrador ni cierra el teclado solo — así que **si el teclado queda abierto en el momento de tocar Guardar, su panel permanece visible por encima del Resumen** después de guardar. Se reprodujo exactamente así: cargar 6-4/6-3, volver a tocar la celda del Set 1 Equipo A sin cambiar el valor, tocar Guardar → el panel del teclado (`1 2 3 / 4 5 6 / 7 8 9 / Borrar 0 Siguiente`) quedaba clavado en la mitad inferior de la pantalla, tapando "BRAMU Intelligence" y los tres botones de acción del Resumen.
- **El problema de ancho del teclado en escritorio/tablet era real y se confirmó tal cual**, sin matices.

En síntesis: el síntoma visual que describió la revisión es real y se reprodujo — el diagnóstico exacto de "qué elemento" causaba la superposición era impreciso (el teclado, no toda la pantalla de carga), pero eso no cambia que había que corregirlo. Se corrigieron ambos puntos.

---

## 2. Corrección — transición post-guardado

`attemptSaveManualMatch()` (`bramulab/app.js`) ahora, antes de delegar en `saveManualMatch`/`finishMatchManual`:

```js
closeAllManualOverlays();     // cierra teclado + hoja de jugador + hoja de formato, si alguna sigue abierta
showView('player-home');      // deja el Home como única vista de fondo (oculta view-manual-load y el resto)
$('#bottom-nav').hidden = true; // ver nota abajo
```

- **`closeAllManualOverlays()`** (función nueva): a diferencia de `closeAnyManualOverlay()` (ya existente, cierra UNA capa por toque de "Volver", §16 del consolidado), esta cierra **todas** las que sigan abiertas de una sola vez — necesario porque el teclado puede quedar abierto sin que el usuario haya tocado "Volver".
- **`showView('player-home')`**: dado que `showView` oculta explícitamente todas las vistas trackeadas (incluida `view-manual-load`) y dejaba el Home como fondo real, no un remanente de la pantalla de carga — exactamente lo pedido ("Dejar el Home del jugador como pantalla de fondo. Renderizar y mostrar únicamente el Resumen como overlay").
- **Efecto secundario encontrado y corregido en el mismo cambio:** `showView('player-home')` deja la barra inferior visible (el Home la usa) — pero la barra tiene `z-index:35`, **mayor** que el del Resumen (`25`), así que asomaba por debajo de la tarjeta del Resumen. Se oculta explícitamente (`$('#bottom-nav').hidden = true`) inmediatamente después; vuelve a aparecer sola cuando "VOLVER AL INICIO" llama a `openPlayerHome()` → `showView('player-home')` de nuevo (ese flujo no cambió).

El resultado, verificado con `getComputedStyle` después de guardar (con el teclado deliberadamente reabierto para forzar el peor caso):

| Elemento | `hidden` | `display` |
|---|---|---|
| `#view-summary` | `false` | `flex` |
| `#view-manual-load` | `true` | `none` |
| `#load-keypad` | `true` | `none` |
| `#load-player-sheet-scrim` | `true` | `none` |
| `#load-format-sheet-scrim` | `true` | `none` |
| `#bottom-nav` | `true` | `none` |
| `#view-player-home` | `false` (fondo intencional, cubierto por el overlay del Resumen) | `flex` |

## 3. Corrección — ancho del teclado en tablet/escritorio

`.load-keypad` (fijo, `left:0; right:0`) no hereda el `max-width` de ningún ancestro por ser `position:fixed`. Se agregó, dentro del mismo bloque `@media (min-width:720px)` que ya limita `.view--history`/`.view--analysis` a 768px:

```css
.load-keypad{ max-width: 768px; margin: 0 auto; }
```

En celular (`<720px`, fuera de ese media query) el teclado sigue ocupando todo el ancho disponible, sin cambios.

---

## 4. Verificación — repro exacto + regresión de 11 pasos

Todo contra `python3 .claude/dev-server.py` (local) y luego repetido en producción. En cada paso se leyó el estado real con `getComputedStyle`/`localStorage`, no solo capturas.

1. **Repro exacto del bug** (reabrir una celda ya cargada sin cambiarla, tocar Guardar): antes del fix, `#load-keypad` quedaba `hidden:false` con `z-index:32` sobre el Resumen — reproducido y fotografiado. Después del fix, `#load-keypad` queda `hidden:true` — confirmado y fotografiado (ambas capturas, antes/después, tomadas en esta sesión).
2. **Entrar al Home → Cargar partido jugado → elegir 3 jugadores → 6-4/6-3 → Guardar:** `view-summary` visible, `view-manual-load` oculta, teclado oculto, barra inferior oculta — un único elemento visualmente perceptible en pantalla (confirmado por captura).
3. **Editar el partido desde el Resumen** (`EDITAR PARTIDO` → reabre precargado): funciona igual, con el mismo cierre de capas al volver a guardar.
4. **Cambiar un resultado (Set 2: 6-3 → 6-1) y guardar:** el historial pasa de 1 entrada a **seguir en 1 entrada**, mismo `matchId`, mismo `createdAt`, `sets` actualizado — sin duplicar.
5. **Volver al Home:** "Último partido" refleja el resultado editado (6-4 · 6-1).
6. **Historial:** muestra la misma entrada única, ya actualizada.
7. **Teclado en ancho móvil (375px):** ocupa el ancho completo disponible, sin cambios respecto a v1.3.
8. **Teclado en ancho escritorio (1280px):** ahora queda centrado a 768px de ancho máximo, alineado con el resto del contenido — confirmado con `getBoundingClientRect().width === 768`.

**Suite automática:** 414/414 sin cambios (el bug era de orquestación de pantalla — qué vista queda de fondo y qué overlay sigue abierto — no de las funciones puras de `match-load.js`, así que no había ningún test que pudiera haberlo cubierto sin un arnés de DOM real).

### Por qué no se agregó un test automático de este caso puntual

Se evaluó agregar una prueba de regresión dedicada al estado de las vistas, tal como pidió la revisión. `tests.html` carga únicamente los módulos puros (`engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js`) — nunca `app.js` ni el DOM real de `index.html` — porque ese es, deliberadamente, el único arnés de este proyecto (documentado desde antes de esta fase: sin Node.js instalado, sin framework de integración). Reproducir este bug automáticamente requeriría cargar la aplicación real dentro de la propia página de tests (por ejemplo, un `<iframe>` a `index.html`).

Se descartó esa opción por un motivo de seguridad de datos, no de esfuerzo: `tests.html` se abre históricamente también **en producción** para confirmar que "todo está en verde" (así lo pide el propio flujo de trabajo de este proyecto, y así se hizo en el hotfix v1.2.1 y en la Fase 3). Un `<iframe>` a `index.html` en producción comparte el **mismo origen** (`sebastianvilaa.github.io`) que la app real — y `localStorage` se comparte por origen, no por ruta. Un test así, corriendo en producción, leería y escribiría sobre el historial y la identidad **reales** de Sebastián. El riesgo de contaminar o perder datos reales por un test automático no vale el beneficio frente a la alternativa: verificación manual rigurosa, con aserciones exactas sobre `getComputedStyle`/`hidden`/`localStorage` en cada paso (§4), que es lo que se hizo acá y lo que ya viene documentando cada informe de esta etapa.

Si en el futuro se instala Node y se arma un arnés real (Playwright, por ejemplo, con su propio perfil de navegador aislado del origen de producción), ahí sí tendría sentido automatizar este tipo de prueba — queda anotado como pendiente de infraestructura, no como algo evitado por comodidad.

---

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `bramulab/app.js` | `closeAllManualOverlays()` (nueva); `attemptSaveManualMatch()` cierra capas + `showView('player-home')` + oculta la barra inferior antes de guardar. |
| `bramulab/styles.css` | `.load-keypad{ max-width:768px; margin:0 auto; }` dentro de `@media (min-width:720px)`. |
| `bramulab/store.js` | `APP_VERSION`: `'v1.3'` → `'v1.3.1'`. |
| `bramulab/sw.js` | `CACHE_NAME`: `'bramulab-v1.3'` → `'bramulab-v1.3.1'`. |
| `bramulab/version.json` | `"v1.3.1"`. |

`bramulab/match-load.js` y `bramulab/tests.html` — **sin cambios** (el bug no estaba en la validación pura).

## 6. Confirmación de BRAMU Lab Partidos intacta

`git diff --stat` del commit `0f04fd5` no toca ningún archivo bajo `bramulab-partidos/`. Verificado también en producción: la app sigue publicada y funcional sin relación con este cambio (ver §7).

## 7. Versión, commit, tag, push y despliegue

- **Commit:** `0f04fd5cb14ddf43df98ef0c3707fae2265a2668` — `BRAMU Lab v1.3.1 · hotfix transición post-guardado y ancho del teclado`.
- **Tag:** `v1.3.1` (mismo commit).
- **Push:** confirmado a `main` (`f42713b..0f04fd5`).
- **Build de GitHub Pages:** commit `0f04fd5` → `status: "built"`, sin error.
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab/tests.html` → **414/414 en verde**.
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` → `PLStore.VERSION === 'v1.3.1'`; repro exacto del bug (reabrir celda + Guardar) ejecutado en producción → `view-manual-load`/`load-keypad`/`bottom-nav` ocultos, solo el Resumen visible (con captura de pantalla). Datos de prueba limpiados al terminar.
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — intacta, se abre y funciona con normalidad.

**Nota sobre limpieza de caché durante la verificación:** al desregistrar el Service Worker viejo para forzar la versión nueva, esta vez se filtró explícitamente por prefijo (`k.startsWith('bramulab-v')`) antes de borrar cachés — corrigiendo el descuido señalado en el informe de la Fase 3 (§19), donde un borrado sin filtrar había limpiado de más la caché offline de BRAMU Lab Partidos en una pestaña de prueba (sin pérdida de datos, ya que se repobló sola).

---

## 8. Estado final

BRAMU Lab queda publicado como **v1.3.1**. La Fase 3 (Etapa 3) queda cerrada con este hotfix incorporado. No se avanzó a la Fase 4.
