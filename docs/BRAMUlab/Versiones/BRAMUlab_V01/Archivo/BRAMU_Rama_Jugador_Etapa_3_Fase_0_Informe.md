# BRAMU Lab — Rama Jugador
## Etapa 3 — Informe de la Fase 0 (separación de rutas)

Implementación y verificación local de la Fase 0 del plan aprobado. **Sin commit ni push todavía** — a la espera de que se revise este informe antes de subir nada.

---

## 1. Verificación previa del commit congelado

Antes de tocar nada, verifiqué que `5c46337` (tag `v14`) es una versión completa y estable, no un commit a mitad de camino:

- Lo llevé a un `git worktree` aislado (sin tocar el working tree principal) y lo serví localmente.
- **323/323 tests OK** — coincide exactamente con el número registrado al momento del release original de v14.
- Verificación visual: header con "Historial" · "MODO COMPLETO ▾" (sin barra inferior ni Home del jugador), "Cargar partido jugado" presente, footer "v14" — el marcador completo tal cual lo conocen los primeros testers, sin nada de la Rama Jugador.
- Confirmado con `git diff --stat` que es el corte exacto: el primer commit de la Rama Jugador (`0e3a132`) es su hijo directo, y no hay ninguna mezcla parcial.

Con esto confirmado, procedí con la Fase 0.

---

## 2. Qué se hizo

### `bramu-lab/` — restaurado al marcador congelado
- `git checkout 5c46337 -- bramu-lab/...` sobre los 7 archivos que la Rama Jugador había modificado, y `git rm bramu-lab/player-home.js` (no existía en esa versión).
- Confirmado con `git diff 5c46337 -- bramu-lab`: **vacío** antes del ajuste de caché — la carpeta quedó byte a byte idéntica a la versión congelada.
- **Único cambio aplicado después, el ajuste de caché aprobado en el punto 4:**
  - `CACHE_NAME` pasó de `'bramulab-v13.4'` (quedaba desactualizado desde antes, un desfasaje que ya existía) a `'bramulab-v14'`, alineado con `PLStore.VERSION`/`version.json`, que ya decían "v14".
  - El filtro de limpieza de caché del `activate` ahora solo borra cachés que empiecen con `bramulab-` — antes borraba cualquier caché cuyo nombre no fuera el propio, sin distinguir de qué app era. Sin este cambio, en cuanto alguien visite las dos rutas desde el mismo navegador, cualquiera de los dos service workers terminaría borrándole la caché al otro.
  - Es la única modificación de `bramu-lab/sw.js` respecto de la versión congelada — confirmado con diff, 23 líneas de cambio en total, nada más se tocó.

### `bramu-player/` — carpeta nueva, copia + separación completa
- Copia literal del `bramu-lab/` actual (con toda la Rama Jugador) a `bramu-player/`.
- **Storage completamente separado** (reemplaza la recomendación original de compartirlo, según lo pedido): en `bramu-player/store.js`, todas las claves pasaron de `padellab.*` a `bramuplayer.*` (`activeMatch`, `history`, `playerNames`, `recordingMode`, `currentPlayerName`). No hay ninguna lectura, escritura ni migración desde `padellab.*` — verifiqué con `grep` que ningún otro archivo de `bramu-player/` referencia esas claves viejas directamente. La app arranca sin ningún dato existente.
- `manifest.webmanifest`: `name` → "BRAMU Jugador", `short_name` → "Mi pádel" (start_url/scope quedan relativos, se resuelven solos a `bramu-player/`).
- `<title>` de `index.html` → "BRAMU Jugador" (para distinguir la pestaña/ventana).
- `sw.js`: `CACHE_NAME` → `'bramuplayer-v1'` (esquema de versión propio, separado del `vN`/`vN.M` del marcador), y el mismo tipo de filtro de limpieza acotado a `bramuplayer-`.
- `version.json` / `PLStore.VERSION` → `'player-v1'`, arrancando el esquema de versiones propio de la Rama Jugador que quedó propuesto en el plan.
- `engine.js`, `stats.js` y los íconos quedaron **byte a byte idénticos** entre las dos carpetas — confirmado con `diff -rq`, no aparecen en la lista de archivos que difieren.

---

## 3. Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Suite completa de `bramu-lab/` (congelado) | **323/323 OK** |
| Suite completa de `bramu-player/` | **349/349 OK** — sin cambios respecto de antes de la Fase 0 (el rename de claves no afecta ninguna función pura testeada) |
| Ambas rutas servidas desde el **mismo origen** (`localhost:4176/bramu-lab/` y `.../bramu-player/`, replicando cómo van a convivir en GitHub Pages) | Confirmado — no usé puertos distintos para esto, porque hubiera ocultado el problema real de origen compartido |
| Cargar un partido real en `bramu-player/` y confirmar que **no aparece** en `bramu-lab/` | Confirmado: `bramu-lab/` mostró Historial vacío pese a que `Object.keys(localStorage)` en esa misma pestaña sí veía las claves `bramuplayer.*` (el navegador comparte el storage por origen, como era de esperar — pero la lógica de cada app solo lee su propio namespace) |
| Guardar un partido simulado directamente en la clave vieja `padellab.history.v1` y confirmar que **no aparece** en `bramu-player/` | Confirmado: Historial y Último Partido de `bramu-player/` siguieron mostrando únicamente su propio partido, sin ver el de `bramu-lab/` |
| Lógica de limpieza de caché de ambos `sw.js` (simulada directamente, ver limitación abajo) | Confirmado por simulación: ninguna de las dos apps borra cachés de la otra; cada una sigue limpiando correctamente sus propias versiones viejas |
| Revisión visual mobile de `bramu-player/` con datos reales | Home, Forma reciente, Último partido y widgets se ven y funcionan correctamente, sin ningún cambio visual respecto de antes de esta fase |

**Limitación del entorno, no del código:** no pude registrar en vivo los `service worker` de ninguna de las dos apps en este entorno de desarrollo local (servidor Python + navegador de automatización) — aparece el mismo error ("An unknown error occurred when fetching the script") que ya quedó documentado en informes anteriores de este proyecto, presente desde antes de esta etapa y no relacionado con estos cambios. Por eso verifiqué la lógica del filtro de limpieza de caché de forma aislada (con arrays de nombres de caché simulados) en vez de observar un service worker real activándose. Recomiendo una verificación final directa sobre GitHub Pages (HTTPS real) antes de dar por cerrada la separación de caché — es el único punto de este informe que no pude confirmar de punta a punta en local.

---

## 4. Riesgos y limitaciones detectados

1. **No probado en HTTPS real todavía.** Todo lo anterior corrió contra `http://localhost`. El comportamiento de `Cache Storage`/`localStorage` que verifiqué es el mismo por especificación en cualquier origen, pero el registro efectivo de los dos service workers en GitHub Pages queda pendiente de confirmar después del deploy.
2. **`bramu-player/` no tiene commit propio.** Como carpeta nueva no trackeada, si algo se interrumpe antes del commit se perdería (mitigado: no hay nada más para perder, es una copia — se puede rehacer desde `bramu-lab/` actual en cualquier momento).
3. **El storage separado significa que `bramu-player/` arranca sin el historial real ya existente** (fue una decisión explícita del punto 3 de la aprobación, no un olvido) — la primera vez que se pruebe en el celular, el Home va a verse vacío hasta cargar partidos nuevos ahí. Es esperado, lo dejo anotado para que no sorprenda al probarlo.
4. Nada de lo demás cambia el diagnóstico de riesgos ya presentado en el plan original (compatibilidad de `engine.js`/`stats.js`, vida útil del marcador congelado, etc.) — sigue vigente sin novedades.

---

## 5. Estado actual de ambas rutas

| | `bramu-lab/` (marcador) | `bramu-player/` (Rama Jugador) |
|---|---|---|
| Contenido | Idéntico a `5c46337` (v14) + 1 ajuste de caché | Copia completa de la Rama Jugador actual, con storage/versión/identidad propios |
| Tests | 323/323 | 349/349 |
| Storage | `padellab.*` (el de siempre) | `bramuplayer.*` (nuevo, vacío) |
| Versión | `v14` (sin cambios funcionales; no debería volver a tocarse) | `player-v1` (arranca su propio esquema) |
| Caché | `bramulab-v14`, limpieza acotada a su familia | `bramuplayer-v1`, limpieza acotada a su familia |
| Git | Cambios hechos en el working tree, **sin commitear** | Carpeta nueva, **sin trackear ni commitear** |
| Publicado | No — sigue publicado el HEAD actual (con Rama Jugador) hasta que se apruebe el commit/push | No — no existe todavía en GitHub Pages |

---

## 6. Qué falta para cerrar la Fase 0

Nada más de implementación — está lista para revisión. Falta únicamente:
1. Que se pruebe el resultado (localmente y/o revisando este informe).
2. Confirmación explícita para hacer commit y push.
3. Después del deploy, una verificación puntual en el celular real de que ambos service workers se registran correctamente en HTTPS (el único punto que no pude cerrar en local).

**No avancé a la Fase 1** ni a ninguna fase posterior — me detuve exactamente donde se pidió.
