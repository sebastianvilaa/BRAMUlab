# BRAMUlab V02.8.2
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.8.1 (commit `bd39a49`, tag `BRAMUlab_V02.8.1`).
**Origen de esta ronda:** instrucciones detalladas dadas directamente en el chat (calibración visual muy puntual sobre lo publicado en V02.8.1) — sin `Consolidado` propio, documentadas en este mismo Informe.
**Estado:** publicado en producción.

Ronda de 5 correcciones puntuales: una regresión real (Actividad dejó de animar), un refinamiento visual (Efectividad en estado estático), un tamaño (hito), un tracking residual (botón del modal de actualización) — y la confirmación explícita de que Último partido, los botones de Resumen y el CTA "jugador sin cuenta" quedan sin tocar. No se reabrió la auditoría, no se tocó BRAMU Intelligence/Historial/Ranking/Perfil, no se modularizó CSS, no se cambió lógica funcional ni estadísticas.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

### Home — Actividad, recuperar la animación (§1)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | Actividad dejó de animar (regresión); recuperarla, perceptible y suave; mantener duración/stagger de V02.8.1 si estaban bien; disparo en cada entrada/vuelta al Home | **Causa real** (ver §2 de este informe): la técnica heredada desde V02.7 (transición de `height` disparada por "0% + reflow + valor final") es la MISMA clase de mecanismo frágil que ya había fallado para Nivel BRAMU en V02.8 y se corrigió en V02.8.1 — en Actividad no se había tocado todavía porque en la prueba de V02.8.1 sí se percibía. Dejó de hacerlo. Se reemplaza por el mismo patrón ya validado: `@keyframes activityBarGrow` (`transform: scaleY(0→1)`, `transform-origin:bottom`) aplicado vía una clase `.is-animating` — más simple que en Nivel BRAMU porque cada barra es un elemento NUEVO en cada render (`wrap.innerHTML` las recrea siempre), así que la clase viaja incluida desde el HTML inicial, sin necesitar la danza de sacar/reflow/volver a poner que sí necesita el elemento persistente de Nivel. Duración (750ms) y stagger (100ms, ahora vía `animation-delay`) sin cambios respecto de V02.8.1 | `styles.css:.activity-bar/.is-animating/@keyframes activityBarGrow`, `app.js:renderPlayerActivity` | **Determinístico**: `getAnimations()` sobre cada una de las 4 barras devuelve ahora exactamente 1 `Animation` (antes devolvía 0), con `duration:750, delay:{0,100,200,300}` — confirma que las 4 tienen su propia animación configurada y escalonada. Scrubbing de la 3ª barra (`currentTime` a distintas fracciones): `scaleY` pasó por `0.000 → 0.000 → 0.355 → 0.667 → 0.895`, progresión monótona y suave. **Visual real** (no solo DOM/computed style): captura en secuencia Home→Ranking→Home mostró un primer frame con las 4 barras prácticamente colapsadas y un segundo frame con las 4 en su altura final — la diferencia se ve a simple vista (ver §3) |

### Home — Efectividad, estado estático (§2)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 2 | La animación ya funciona (sin tocarla); el estado FINAL se ve tosco/pesado, brillo casi imperceptible; refinar sin volver al cuadrado/glow incorrecto; trazo principal menos grueso; halo sutil pero visible; sin efecto rectangular | Se mantiene exactamente el mismo mecanismo de V02.8.1 (3 círculos concéntricos sin ningún `filter`, mismo `stroke-dasharray`/`stroke-dashoffset`/animación WAAPI) — el ajuste es puramente de valores: trazo principal y aro de fondo `3px→2.5px` (más fino/nítido); halo interno `5px→4px` de grosor con opacidad `.22→.30`; halo externo `8px→6px` con opacidad `.10→.18`. Al angostar los halos y subirles la opacidad a la vez, el brillo se nota más sin que el conjunto se vea más ancho que antes — el problema no era que faltara opacidad sola, sino que el grosor de los halos sumado al trazo leía como un solo aro grueso y borroso | `styles.css:.effectiveness-donut__track/__fill/__glow-inner/__glow-outer` | Captura real a 67% (402px y 360px): aro visiblemente más fino y nítido, brillo verde perceptible pegado al trazo sin extenderse en un halo ancho — comparado directamente contra la captura de V02.8.1 tomada antes del cambio |

### Home — Último partido (§3)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 3 | Mantener sin cambios (estructura/altura/pulso/glow) | Sin ningún diff en `.player-home-lastmatch*`/`@keyframes lastMatchGlowPulse` | — | `git diff` confirma cero cambios en estas reglas |

### Home — hito, tamaño (§4)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 4 | Reducir ~15% el ancho visual; seguir permitiendo 2 líneas; mismo estilo aprobado (texto blanco/surface-2/borde y glow azul); sin tocar contenido/lógica | `flex-basis`: `70%→60%` en celular (reducción del 14.3%, ≈15% pedido) y `48%→40%` en pantallas ≥480px (reducción del 16.7%). Angostar el ancho no perjudica el wrap a 2 líneas — al contrario, lo favorece. Color/fondo/borde/glow/radio/padding: sin cambios | `styles.css:.player-home-hitos__chip` | Captura real en 402px y 360px: tarjeta claramente menos dominante, wrap a 2 líneas conservado con el mismo hito de prueba de rondas anteriores |

### Aviso de actualización — tracking (§5)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 5 | Normalizar el tracking del componente de actualización, alineado con el resto de overlays ya corregidos en V02.8; sin rediseñar | **Diagnóstico primero, no asumido**: se verificó por computed style que `.overlay__title` de este modal YA estaba en el valor correcto (0.03em, fijado en V02.8) — el elemento realmente "abierto" era el botón "ACTUALIZAR" (`#update-now-btn`), que hereda `.btn-start{ letter-spacing: 0.08em }`, un valor nunca tocado en las rondas de tracking anteriores (que corrigieron `.overlay__title`, no los botones). Se agrega un override acotado por ID, `#update-now-btn{ letter-spacing: 0.03em }` — nunca la clase compartida `.btn-start` (que sigue en 0.08em en Setup/Resumen/el resto de overlays con `.btn-start--overlay`, todos fuera de alcance de esta ronda) | `styles.css` (nueva regla junto a `.overlay__actions--stacked`) | Computed style antes/después: `letter-spacing` de `#update-now-btn` pasó de `1.36px` (0.08em×17px) a `0.51px` (0.03em×17px) — misma proporción que el título del mismo modal (`0.6px` = 0.03em×20px). Captura real del modal confirma título y botón visualmente consistentes |

### Resumen — botones (§6) / CTA jugador sin cuenta (§7)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 6 | Mantener sin cambios los botones de Resumen (aprobados) | Sin ningún diff en la regla `#analysis-share-section .btn-secondary, #analysis-share-section .btn-start` | — | `git diff` confirma cero cambios |
| 7 | No seguir ajustando el CTA "Agregar jugador sin cuenta" en esta ronda (queda como en V02.8.1) | Sin ningún diff en `#load-player-sheet-add.sheet-option--primary`/`.sheet-add-player-dot` ni en `renderManualPlayerSheetContent` | — | `git diff` confirma cero cambios |

---

## 2. Por qué Actividad dejó de animar (causa real, no solo "se rompió")

Las tres microanimaciones de entrada del Home (Nivel BRAMU, Actividad, Efectividad) nacieron en V02.7 con la MISMA técnica: poner el valor animado en 0, forzar un reflow (`void el.offsetWidth`), y recién ahí asignar el valor final — confiando en que una transición CSS anime automáticamente ese salto. Esa técnica depende de que el navegador efectivamente **pinte** el estado en 0 como un frame real antes de aplicar el valor final; forzar un reflow solo garantiza el CÁLCULO de layout, no la pintura — en ciertas condiciones (variables según motor/dispositivo/carga) el navegador puede saltarse ese frame intermedio y aplicar directamente el valor final, sin transición visible.

En V02.8.1 esto ya se había detectado y corregido para Nivel BRAMU y Efectividad (que dejaron de percibirse) — se reemplazaron por técnicas que no dependen de ese registro de frame (`@keyframes`/Web Animations API). En ese momento, Actividad SÍ se seguía percibiendo en la prueba real, así que se dejó sin tocar por instrucción explícita ("mantener la técnica actual si no hay un motivo técnico real para cambiarla"). El propio informe de V02.8.1 dejó registrada una observación: en el entorno de test de esa ronda, `getAnimations()` ya devolvía una lista vacía para la transición de Actividad — una señal de la misma fragilidad, no concluyente en ese momento porque el usuario reportaba que sí funcionaba en dispositivo real.

Esta ronda confirma que esa fragilidad SÍ se manifestó en uso real. La corrección aplica exactamente el mismo principio que ya funcionó para Nivel BRAMU: reemplazar la transición condicionada por una animación `@keyframes` explícita, que corre sobre su propia línea de tiempo sin depender de que se registre ningún frame de partida.

---

## 3. Verificación visual real

Cumpliendo el punto expreso de esta ronda ("no aceptar como válido solo que cambien valores en el DOM"):

1. **Determinístico** (`getAnimations()` + scrubbing de `currentTime`): confirma que las 4 barras de Actividad tienen ahora una `Animation` real, correctamente configurada y escalonada, con interpolación monótona y suave a lo largo de todo su recorrido — método inmune a cualquier limitación de temporización de esta herramienta de navegador.
2. **Captura de pantalla en secuencia real** (disparo Home→Ranking→Home, captura inmediata + una segunda captura): la primera mostró las 4 barras de Actividad y la barra de Nivel BRAMU visiblemente colapsadas (solo un margen mínimo visible); la segunda las mostró en su altura/ancho final — un antes/después real, no una lectura de estilos computados.
3. **Comparación visual directa** del donut de Efectividad (67%, 402px y 360px) entre el estado previo (V02.8.1) y el nuevo: aro visiblemente más fino, brillo más presente y pegado al trazo, sin ningún indicio de caja o rectángulo en ningún punto del arco.

**Regresión:** recorrido de Home (402px/360px), aviso de actualización — sin overflow horizontal nuevo, sin errores de consola nuevos atribuibles a esta ronda (el único error observado, por Google Fonts sin red, es la misma limitación de entorno ya documentada desde V02.3).

---

## 4. Tests automáticos

**571/571 tests OK — todo verde** (`tests.html`), sin cambios respecto de la base V02.8.1. Ningún test nuevo: ronda exclusivamente visual (CSS + wiring de animación en `app.js`) — ninguno de los archivos que carga `tests.html` (`engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js`) tiene cambios de lógica, salvo el string `APP_VERSION` de `store.js`.

---

## 5. Validación visual — desktop y mobile

Confirmado en 402px y 360px:

- Actividad: barras claramente perceptibles levantándose al entrar/volver al Home (ver §3).
- Nivel y Efectividad: siguen animando (sin cambios de mecanismo respecto de V02.8.1).
- Efectividad en estado final: aro más fino, brillo más presente, sin cuadrado/rectángulo en ningún ángulo del arco.
- Último partido: idéntico a V02.8.1 (sin diffs).
- Hito: visiblemente más chico, sigue partiéndose en 2 líneas con el mismo estilo aprobado.
- Aviso de actualización: título y botón "ACTUALIZAR" con tracking consistente entre sí.
- Sin overflow horizontal nuevo en 360px.

---

## 6. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.8.1"` → **`"BRAMUlab V02.8.2"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-8-1` → **`bramulab-v02-8-2`**.
- **Commit de implementación (código):** ver §7 (hash registrado en el commit siguiente, un commit no puede citar su propio hash).
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 7. Hash exacto y tag (registro final)

- Commit de implementación (código): `a71d2f5ee14daf73e2f662acf7286bd635936201`.
- Commit de este informe: PENDIENTE_HASH_INFORME.
- Tag `BRAMUlab_V02.8.2` apunta al commit inmediatamente posterior a este, que registra ambos hashes de arriba — el código funcional completo de V02.8.2 es íntegramente el del primer commit; ese tercer commit no modifica ningún archivo de `bramulab/`.

---

## 8. Qué no se tocó (confirmado, §3/§6/§7 de las instrucciones de esta ronda, más las protegidas de siempre)

Último partido (estructura/altura/pulso/glow, sin diffs), botones de Resumen (sin diffs), CTA "jugador sin cuenta" (sin diffs), Historial, Ranking, Perfil, BRAMU Intelligence, colores de marca (`#95FF19`/`#199FFF`, sin cambios de valor), Inter, arquitectura CSS (`styles.css` sigue siendo un solo archivo, sin modularizar), lógica de Actividad (4 semanas)/Efectividad (histórica total) — solo cambió la técnica de animación y los valores de presentación estática de Efectividad, nunca el cálculo.
