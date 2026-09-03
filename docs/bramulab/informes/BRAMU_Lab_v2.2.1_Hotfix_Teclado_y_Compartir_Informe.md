# BRAMU Lab — Hotfix v2.2.1 · Validación preventiva del teclado y COMPARTIR en Análisis
## Informe de cierre

**Estado:** IMPLEMENTADO Y VERIFICADO
**Fecha:** 03 de septiembre de 2026
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/` (sin cambios — ver §6)
**Versión de partida:** v2.2 (commit `e45eb35`, tag `v2.2`) · **Versión resultante:** v2.2.1 (commit `910975fe350a3eec9494f2be29f644a520c7f6a4`, tag `v2.2.1`)
**Origen:** revisión externa (ChatGPT) sobre v2.2 recién publicada en producción, con dos incumplimientos puntuales del consolidado de Etapa 4.2.

Este informe es autosuficiente: documenta causa real, corrección, pruebas y despliegue sin necesitar el historial de chat operativo.

---

## 1. Qué reportó la revisión externa

1. **Validación preventiva incompleta (§7.2 del consolidado):** en Clásico, después de ingresar `2` para un equipo, el teclado del segundo equipo seguía permitiendo seleccionar `3` y formar `2-3`. `Continuar` quedaba deshabilitado correctamente, pero el requisito era impedir el valor imposible ANTES de poder tocarlo — no limitarse a bloquear la confirmación después.
2. **COMPARTIR visible en Análisis:** el control ya estaba retirado de Resumen (desde Etapa 4, v2.0) pero seguía visible en la pantalla Análisis del partido.

Ambos se verificaron reproducidos antes de tocar código.

---

## 2. Causa real — validación del teclado

`updateManualKeypadKeysState()` (`bramulab/app.js`) solo deshabilitaba dígitos por encima de un tope fijo del formato (`Math.max(setWinTarget+1, tiebreakTriggerAt+1)` → 7 en Clásico), **sin ninguna noción del valor ya confirmado del lado opuesto**. Por eso, con el Equipo A ya en `2`, el teclado del Equipo B mostraba 0-7 habilitados por igual — incluido el `3`, que no puede cerrar ningún set válido junto a un `2` (`2-3` no es un resultado de set terminado bajo ninguna regla).

La función `ML.canExtendSetDigits(digitsStr, format)` (usada para decidir si seguir aceptando dígitos durante la carga) tenía el mismo problema de fondo: nunca conocía el valor del otro lado, así que no podía usarse tampoco para el paso de habilitar/deshabilitar teclas antes del primer toque.

---

## 3. Corrección — reutilizando la regla canónica, sin pares hardcodeados

Se agregó una función pura nueva en `bramulab/match-load.js`, **`computeValidNextDigits(digitsStr, format, otherValue)`**: dado lo tecleado hasta ahora y, si ya se conoce, el valor confirmado del lado opuesto, devuelve exactamente los dígitos 0-9 que todavía podrían cerrar un set válido — consultando en cada caso `Engine.isValidCompletedSetScore` (la misma fuente de verdad que ya usa el resto de la carga manual) contra cada candidato posible, nunca una lista de pares aislada. Cuando el lado opuesto todavía no tiene valor (primer lado del set), se comporta exactamente como antes: cualquier dígito que pueda formar parte de ALGÚN resultado válido para el formato.

`ML.canExtendSetDigits(digitsStr, format, otherValue)` pasa a ser un envoltorio booleano de esa misma función (backward-compatible: sin el tercer argumento se comporta igual que en v2.2, verificado con los 3 tests preexistentes que siguen pasando sin cambios).

`updateManualKeypadKeysState()` y `pressManualKeypadKey()` (`bramulab/app.js`) ahora calculan `otherValue` (el valor ya confirmado del equipo que NO está tecleando en ese momento, tomado de `manualDraftSet`) y se lo pasan a ambas funciones. Ningún caso aislado hardcodeado: la regla se resuelve siempre contra el motor central, así que cualquier formato futuro (Americano, Punto de Oro/Con ventaja/Star Point, tie-breaks) queda cubierto automáticamente sin tocar esta lógica.

**Ejemplo real, verificado en pantalla:** con Equipo A en `2`, el teclado del Equipo B queda con el `6` como única tecla habilitada (todas las demás, incluido `del`/`done` sin contar, deshabilitadas) — porque `2-6` es el único resultado que cierra un set válido junto a un `2` en Clásico. Con A en `6`, quedan habilitados `0,1,2,3,4,7` (nunca `5` ni `6`: `6-5` y `6-6` no son sets terminados).

---

## 4. Corrección — COMPARTIR en Análisis

`#analysis-share-btn` (`bramulab/index.html`) nunca tuvo el atributo `hidden` que sí tiene desde Etapa 4 su equivalente en Resumen (`#summary-share-btn`) — un descuido de una ronda anterior, no introducido en v2.2. Se agregó `hidden` directamente en el markup, con el mismo criterio ya documentado para Resumen: la capacidad técnica (`shareResult`) se conserva sin exponerse en la interfaz hasta definir un contexto de compartir más claro. El botón `EDITAR PARTIDO`/`VOLVER AL INICIO` de esa misma sección no se tocó.

---

## 5. Pruebas

**Automáticas — 9 tests nuevos (483/483 en verde, 474 preexistentes + 9 de este hotfix):**
- `computeValidNextDigits('', classic, 2)` es exactamente `['6']` (impide `2-3` y cualquier otro par imposible).
- `computeValidNextDigits('', classic, 2).indexOf('3') === -1` — verificación explícita del caso reportado.
- `Engine.isValidCompletedSetScore(2, 3, classic) === false` — confirma la regla canónica subyacente.
- `computeValidNextDigits('', classic, 6)` es `['0','1','2','3','4','7']` (nunca `5` ni `6`).
- `computeValidNextDigits('', classic, 5)` es `['7']` (solo `7-5`).
- `computeValidNextDigits('', americano, 6)` es `['0','1','2','3','4','5']` (nunca `7` — Americano no llega a 7).
- `computeValidNextDigits('', classic, undefined)` sin lado opuesto conocido: `0-7`, igual que antes de este hotfix (sin regresión en el primer lado del set).
- `canExtendSetDigits('3', classic, 2) === false` y `canExtendSetDigits('6', classic, 2) === false` — defensivo, aunque la tecla ya esté deshabilitada en la interfaz.

No se agregó un test automático para "COMPARTIR no aparece en Resumen/Análisis": es un hecho de marcado (atributo `hidden` en el DOM), y `tests.html` — por decisión ya documentada desde el hotfix v1.3.1 — carga únicamente los módulos puros, nunca `index.html`/`app.js` ni un DOM real, precisamente para poder seguir corriendo con seguridad también contra producción sin arriesgar `localStorage` real. Se verificó en su lugar de forma manual y explícita (ver §5, pruebas manuales), consistente con cómo se viene verificando todo el comportamiento visual/DOM de este proyecto.

**Manuales, en el entorno de verificación local:**
- Reproducción exacta del reporte: Equipo A en `2` → teclado de Equipo B con únicamente `6` habilitado (capturado con `disabled` real de cada tecla, no solo visualmente) → se completa `2-6` → `Continuar` se habilita → partido se guarda correctamente.
- Caso inverso (Equipo B tecleado primero, sin restricción — 0-7 habilitados como antes) y luego Equipo A restringido por el valor ya cargado de B — ambos sentidos probados.
- Verificado en mobile (390×844) y tablet (834×1112) con capturas de pantalla — mismas teclas deshabilitadas, mismo resultado, sin cambios de layout.
- `#analysis-share-btn.hidden === true` en la pantalla Análisis de un partido cargado, con `EDITAR PARTIDO`/`VOLVER AL INICIO` intactos; `#summary-share-btn.hidden === true` en Resumen del mismo partido (sin regresión).
- Sin errores nuevos de consola en ningún paso.

---

## 6. Confirmación de BRAMU Lab Partidos intacta

`git diff --stat` del commit de este hotfix no toca ningún archivo bajo `bramulab-partidos/` — el diff completo se limita a `bramulab/app.js`, `bramulab/index.html`, `bramulab/match-load.js`, `bramulab/tests.html` y los tres archivos de versión.

---

## 7. Archivos modificados

| Archivo | Cambio |
|---|---|
| `bramulab/match-load.js` | `computeValidNextDigits(digitsStr, format, otherValue)` (nueva); `canExtendSetDigits` extendida con `otherValue` opcional, backward-compatible. |
| `bramulab/app.js` | `updateManualKeypadKeysState()` y `pressManualKeypadKey()` calculan y pasan `otherValue` (el lado ya confirmado del equipo opuesto). |
| `bramulab/index.html` | `#analysis-share-btn` con `hidden`. |
| `bramulab/tests.html` | 9 tests nuevos. |
| `bramulab/store.js`, `bramulab/version.json`, `bramulab/sw.js` | versión `v2.2` → `v2.2.1`. |

`bramulab/engine.js` y `bramulab/stats.js` — sin cambios.

---

## 8. Versión, commit, tag, push y despliegue

- **Commit:** `910975fe350a3eec9494f2be29f644a520c7f6a4` — *"BRAMU Lab v2.2.1 · hotfix validación preventiva del teclado y COMPARTIR en Análisis"*.
- **Tag:** `v2.2.1`, apuntando exactamente a ese commit.
- **Rama:** `main`, pusheada a `origin/main` (`c478aea..910975f`).
- **Build de GitHub Pages:** run `33795493508`, `success` (verificado con `gh run watch --exit-status`).
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab/tests.html` → 483/483 en verde.
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` → footer confirmando `v2.2.1` (tras un reload, esperable en el ciclo de vida normal de un Service Worker: la pestaña ya abierta sigue con los archivos con los que cargó hasta recargar), Cache Storage únicamente `bramulab-v2.2.1` (la vieja `bramulab-v2.2` ya no aparece), `version.json` sirviendo `{"version":"v2.2.1"}` con `no-store`.
- `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — intacta, `v14`, caché `bramulab-partidos-v14` sin tocar.

---

## 9. Estado final

BRAMU Lab queda publicado como **v2.2.1**. Etapa 4.2 queda cerrada con este hotfix incorporado. No se avanzó a ninguna etapa siguiente.
