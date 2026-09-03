# BRAMU Lab — Etapa 4.2
## v2.2 · Carga manual centrada en el marcador y nueva jerarquía visual — Informe de entrega

**Estado:** implementado, commiteado, tagueado y verificado en producción. **No cerrado por cuenta propia** — pendiente de revisión externa de ChatGPT y de la evaluación de Sebastián.
**Fecha:** 03 de septiembre de 2026
**Documentos de origen:** `docs/bramulab/consolidados/BRAMU_Lab_Etapa_4_2_v2_2_Carga_Manual_y_Jerarquia_Consolidado.md` (fuente funcional y de producto), `docs/bramulab/consolidados/BRAMU_Direccion_Visual_Moodboard_Analisis.md` y `docs/bramulab/consolidados/BRAMU_Rama_Jugador_Auditoria_Visual.md` (contexto visual obligatorio), informe de v2.1.
**Versión de partida:** v2.1 (commit `e5b28700f947e5a7d62c6ff757d9cc64374d8169`, tag `v2.1`) — verificado con working tree limpio antes de empezar.
**Versión entregada:** v2.2 (commit `e45eb35d28cb0a61cc7054939d017d1cac127c39`, tag `v2.2`).
**Aplicación tocada:** `bramulab/` únicamente. `bramulab-partidos/` permanece intacta en v14 (verificado, ver §12).

---

## 1. Resumen ejecutivo

Esta ronda rehace **Cargar mi partido jugado** de punta a punta: deja de ser un formulario administrativo (fecha/hora arriba, marcador plano, "Guardar" al final) y pasa a ser una carga deportiva donde el resultado es el elemento dominante en cada pantalla. Se aplicó la misma dirección visual, con alcance acotado, a los otros 4 puntos que pedía el consolidado: la hoja Registrar partido, el teclado numérico propio, la nueva pantalla Partido guardado, y la tarjeta Último partido del Home.

**Cambios funcionales principales:**
- **Marcador acumulado + set actual como protagonista:** cabecera compacta (`SET 1` / `SET 2` / `SET DECISIVO` / `PARTIDO COMPLETO`), sets ya confirmados como chips pequeños arriba, y el set en edición mostrado con números grandes tocables (`#court-score-a`/`#court-score-b`).
- **Teclado numérico BRAMU propio:** aparece desde abajo, deshabilita dinámicamente los valores que no pueden cerrar un set válido para el formato activo — reutilizando `ML.canExtendSetDigits`, sin duplicar reglas.
- **Modelo de borrador:** cada set se escribe en un draft (`manualDraftSet`) que solo se confirma en `manualSets` al tocar `Continuar` — nunca hay commit instantáneo por celda.
- **Edición de un set ya confirmado:** tocar un chip lo reabre; si el cambio deja obsoleto un Set 3 ya cargado, pide confirmación explícita antes de descartarlo.
- **Guardado en dos momentos:** el partido se guarda apenas queda decidido (sin pedir nada más), y una pantalla nueva "Partido guardado" permite editar fecha/hora/lugar y agregar una nota privada opcional — sin un segundo botón "Guardar".
- **Nota privada (`privateNote`):** opcional, autoguardada, visible solo en Partido guardado y en el detalle de Análisis de ese partido — verificado que no aparece en ningún otro lugar.

Se agregaron 9 tests nuevos (474/474 en verde). Se verificó con mouse real en escritorio (1366×768) y táctil simulado en los otros tres viewports pedidos. Durante la propia verificación encontré y corregí **dos errores de implementación** antes de publicar nada (detallados en §5) — ninguno llegó a producción.

---

## 2. Decisiones visuales (moodboard + auditoría como contexto obligatorio)

El consolidado pide una "cancha nocturna": oscuridad azulada (no negro genérico), superficies separadas por luz/contraste (no por sombras pesadas), resultado y números como protagonistas, lima como foco único de acción muy moderado, glow solo funcional, jerarquías tipográficas reales, sin estética gamer/sci-fi/multi-neón/glassmorphism.

**Tokens nuevos, agregados a `:root` en `styles.css` y usados ÚNICAMENTE por las superficies en alcance:**

```css
--court-bg: #060B14;            /* fondo de pantalla completa, azul casi negro */
--court-surface: #0D1626;       /* tarjetas y hojas */
--court-surface-2: #142238;     /* superficie elevada (teclas, chips activos) */
--court-line: rgba(148,178,226,0.16);   /* bordes — luz, no sombra */
--court-text-dim: rgba(223,231,245,0.62);
--court-text-faint: rgba(223,231,245,0.38);
--court-glow: rgba(59,130,246,0.28);    /* glow funcional (foco activo), no decorativo */
```

Deliberadamente **no** se reemplazaron los tokens globales existentes (`--ink`, `--ink-soft`, con tinte verdoso) — el resto de BRAMU Lab sigue con su paleta actual. Esto es a propósito: el consolidado pide una intervención acotada a 5 puntos, no un rediseño integral, así que un token nuevo con su propio namespace (`--court-*`) evita cualquier fuga visual hacia pantallas fuera de alcance.

**Cómo se resolvió cada regla del consolidado (§3):**
- **Resultado dominante:** en la pantalla de carga, el resultado del set ocupa el bloque central en blanco a 34–40px; en Partido guardado, el resultado final ocupa esa misma jerarquía. En la tarjeta Último partido del Home, el score pasó de 24px a 34px y el título "ÚLTIMO PARTIDO" bajó a 11px — el número manda, el rótulo se retira.
- **Lima con moderación:** aparece solo en el borde/glow del campo activo del teclado, el botón Continuar cuando el resultado es válido, "Modificar", y el acento del equipo propio (`TU EQUIPO`) — nunca como color de fondo general ni en texto informativo.
- **Sin mayúsculas generalizadas:** los títulos de estado (`SET 1`, `PARTIDO GUARDADO`) van en mayúscula por ser rótulos de estado corto, pero los nombres de jugadores, la nota privada y los textos largos van en Sentence case.
- **Glow funcional:** el único glow persistente es el del campo de puntaje activo dentro del marcador (comunica "acá estoy escribiendo"); no hay glow decorativo en tarjetas estáticas.
- **Sin glassmorphism/multi-neón:** las superficies usan `background` sólido (`--court-surface`) + `border: 1px solid --court-line`, sin `backdrop-filter` ni gradientes multicolor.

---

## 3. Reglas de validación reutilizadas (no reinventadas)

Por pedido explícito del consolidado (§7.2: "la validez no debe hardcodearse de forma aislada"), toda la lógica de validez sigue viviendo en `match-load.js`/`engine.js`, sin duplicarse en la nueva interfaz:

- **Deshabilitar teclas imposibles:** `pressManualKeypadKey()` (app.js) llama a `ML.canExtendSetDigits(manualKeypadDigits, format)` — la misma función pura de v1.3, sin cambios. Por eso 8 y 9 aparecen deshabilitados en Clásico automáticamente, y el mismo teclado funciona sin cambios para Americano o cualquier formato futuro.
- **Habilitar Continuar / mostrar "Resultado válido":** `E.isValidCompletedSetScore(a, b, format)` — la función central de `engine.js`, sin cambios.
- **Qué set mostrar grande y cuáles pasaron al marcador acumulado:** función pura **nueva**, `ML.resolveActiveSetIndex(sets, format)` — recorre los slots que corresponden según `isThirdSetVisible` (nunca pide un Set 3 que no corresponde) y devuelve el índice del primer set incompleto o inválido, o `null` si el partido ya está decidido. Es el único criterio: app.js nunca recalcula esto por su cuenta.
- **Recalcular al editar un set anterior:** reutiliza `ML.computeFormatChangeImpact` (existente desde v1.3, sin cambios) para decidir si el Set 3 ya cargado queda huérfano tras el cambio.

**Decisión técnica menor — teclado 0–9 en vez de 0–7:** el consolidado sugiere "el teclado puede presentar 0–7 en los casos habituales", dejando explícitamente abierto que la lógica no debe impedir más valores. Se optó por mostrar siempre 0–9 y dejar que `canExtendSetDigits` deshabilite dinámicamente lo que no aplica — un único layout de teclado para cualquier formato presente o futuro, en vez de dos variantes de teclado a mantener. Documentado acá por ser una decisión de implementación, no de producto.

---

## 4. Guardado en dos momentos y nota privada

**Momento 1 (§8.1):** `attemptManualContinue()` → al confirmar el último set necesario, `finishMatchManual()` llama a `Store.upsertHistory(finishedSnapshot)` de inmediato — antes de mostrar cualquier pantalla de enriquecimiento. Fecha/hora por defecto: el momento de guardado (`new Date()`); lugar vacío si no se indicó.

**Momento 2 (§8.2):** pantalla nueva `#view-match-saved` (`openMatchSavedScreen`) — resultado resumido, badge Victoria/Derrota, meta-línea `Ahora · Hoy · HH:MM[ · Lugar]` con acción `Modificar`, campo de nota, y una única acción principal `VER RESUMEN`. No existe un segundo botón "Guardar partido" en ningún punto de este flujo.

**`Store.patchHistoryEntry(matchId, patch)`** — primitiva nueva de lectura-fusión-escritura para actualizaciones parciales (fecha/hora/lugar desde Modificar, nota desde blur) sin reconstruir el registro completo ni duplicar el `matchId`.

**Nota privada (`privateNote`):**
- Campo opcional de texto libre, candado + "SENSACIONES DEL PARTIDO · SOLO VOS", autoguardado al perder foco (`blur`).
- Visible en exactamente dos lugares: Partido guardado (`#match-saved-note`) y Análisis, solo si `mode==='manual'` (`#analysis-note-textarea`, sección `#analysis-note-section`).
- **Verificado explícitamente** (no solo por inspección de código) que NO aparece en: Historial (lista), Home (tarjeta Último partido ni ningún otro bloque), Resumen del partido — ni siquiera cuando se llega a Resumen desde Análisis del mismo partido con la nota cargada. Método: se guardó un partido con una nota-marcador única (`SECRETO_NO_DEBE_APARECER_EN_HISTORIAL`) y se verificó, vía `document.body.innerText`, que el string no aparece en ninguna de esas pantallas — solo en el `.value` de los dos textareas correspondientes.
- Compatibilidad con partidos anteriores sin el campo: probado cargando un registro de historial sin `privateNote` (`delete hist[0].privateNote`) — Análisis lo abre sin error, el campo se muestra vacío (`f.privateNote || ''`).

**Decisión técnica menor — reabrir un partido ya guardado salta Partido guardado:** al editar un partido existente (`EDITAR PARTIDO` desde Análisis), guardar lleva directo a Resumen, no a Partido guardado — esa pantalla comunica "se acaba de guardar por primera vez", lo cual sería engañoso al reeditar. Documentado en el código (`app.js`, rama `wasNewLoad` de `attemptSaveManualMatch`).

---

## 5. Dos errores encontrados y corregidos durante la propia verificación

Ninguno de los dos llegó a publicarse — se detectaron en el entorno de verificación local, antes del commit.

### 5.1 — `Engine is not defined` (bloqueante: Continuar nunca se habilitaba)

Al escribir `updateManualContinueState()` y `attemptManualContinue()` copié por error el nombre interno que usa `match-load.js` (`Engine`) en vez del alias real de `app.js` (`const E = window.PLEngine`). Resultado: cualquier resultado de set, por válido que fuera, tiraba `ReferenceError: Engine is not defined` en consola y `Continuar` quedaba deshabilitado para siempre. Se detectó probando en vivo (6-4 marcado como inválido pese a que `PLEngine.isValidCompletedSetScore(6,4,classic)` daba `true` de forma independiente) y se corrigió cambiando ambas referencias a `E.`. Verificado con `grep -n "\bEngine\." app.js` que no queda ninguna otra ocurrencia.

### 5.2 — Volver desde Resumen crasheaba si se llegaba desde Partido guardado

El botón `Ver resumen` de la pantalla Partido guardado llamaba a `renderSummary(f, 'live')`, pero `f` nunca es `=== finishedSnapshot` (se relee de `Store` para reflejar la nota/lugar recién editados ahí mismo) — así que la condición interna `isLiveMatch = source==='live' && f===finishedSnapshot` daba `false`, el botón Volver quedaba visible, y al tocarlo llamaba a `renderAnalysis(analysisCurrent)` con `analysisCurrent` todavía `null` (nunca se había pasado por Análisis en esa sesión) → `TypeError: Cannot read properties of null (reading 'startedAt')`.

**Corrección:** antes de `renderSummary`, el handler ahora fija `analysisCurrent = f` y `analysisOpenedFrom = 'player-home'` — el mismo patrón que ya usa `initPlayerHomeLastMatchCard()` para "Ver detalle" desde el Home. Con eso, Volver desde este Resumen abre correctamente el Análisis de ese mismo partido, en vez de crashear. Reproducido y verificado el flujo completo después del fix: Cargar partido → Partido guardado → Ver resumen → Volver → Análisis del partido correcto, sin errores de consola.

---

## 6. Edición de un set anterior que descarta un Set 3 huérfano

Flujo nuevo (§6.2 del consolidado), probado con datos reales en escritorio (mouse):

1. Partido guardado con Set 1 `6-2`, Set 2 `4-6`, Set 3 `6-4` (A gana 2-1).
2. Se reabre para editar, se toca el chip `SET 1` y se cambia a `2-6` (invierte el ganador del set).
3. Al tocar Continuar aparece el modal: **"Este cambio ya no necesita un tercer set" / "El resultado que ya cargaste en el Set 3 se va a descartar."**, con `Cancelar`/`Confirmar`.
4. **Cancelar:** el modal se cierra, el draft del Set 1 queda editable tal cual estaba (`2-6`, sin confirmar todavía) — se restauró manualmente a `6-2` y se confirmó sin volver a disparar el modal (no hay falso positivo cuando el valor final coincide con el original).
5. **Confirmar** (repetido desde cero): el partido pasa a Resumen mostrando ganador `Cruz / Dan`, `2 sets a 0`, Set 3 completamente descartado — stats e "Intelligence" recalculados de forma consistente.

`confirmAction()` se extendió con un parámetro `onCancel` opcional para soportar este caso, sin alterar ningún llamado preexistente (todos los usos anteriores de `confirmAction` siguen funcionando sin pasar ese parámetro).

---

## 7. Archivos modificados

Ningún archivo nuevo de código — toda la lógica pura nueva vive en el módulo existente `match-load.js`.

- **`bramulab/match-load.js`** — 1 función pura nueva: `ML.resolveActiveSetIndex(sets, format)`.
- **`bramulab/store.js`** — 1 función nueva: `Store.patchHistoryEntry(matchId, patch)`; `APP_VERSION` `v2.1` → `v2.2`.
- **`bramulab/app.js`** — reescritura del flujo de carga manual completo: estado de draft, render del marcador acumulado y del set actual, teclado, guardado en dos momentos, pantalla Partido guardado, hoja Modificar, nota privada, edición de set anterior con confirmación, `confirmAction`/`initConfirmModal` extendidos con `onCancel`, ajustes en `renderAnalysis`/`initAnalysisScreen` (nota) y `renderPlayerLastMatchCard` (puntos de forma sin letras).
- **`bramulab/index.html`** — reconstrucción de `#view-manual-load` (cabecera, marcador acumulado, resultado del set, teclado, meta-línea), sección de nota nueva en Análisis, pantalla nueva `#view-match-saved`, hoja nueva `#manual-meta-sheet-scrim` (fecha/hora/lugar reubicados).
- **`bramulab/styles.css`** — tokens `--court-*`, estilos de las 5 superficies en alcance (hoja Registrar partido, pantalla de carga, marcador/teclado, Partido guardado, tarjeta Último partido del Home), breakpoint de 768px extendido a las nuevas clases.
- **`bramulab/tests.html`** — 9 tests nuevos (`resolveActiveSetIndex`).
- **`bramulab/version.json`**, **`bramulab/sw.js`** — versión `v2.1` → `v2.2`.
- **`docs/bramulab/consolidados/BRAMU_Lab_Etapa_4_2_v2_2_Carga_Manual_y_Jerarquia_Consolidado.md`** — agregado al repositorio (documento fuente de esta ronda).

No se tocó `bramulab/engine.js` ni `bramulab/stats.js`.

---

## 8. Tests automáticos y resultado

- Suite completa: **474/474 en verde** (465 preexistentes de v2.1 + 9 nuevos de Etapa 4.2).
- Cobertura de los 9 nuevos (`resolveActiveSetIndex`): partido vacío (Set 1 activo), Set 1 completo → Set 2 activo, Set 1 con score que no cierra un set real → sigue activo, partido decidido 2-0 → `null` (nunca pide un Set 3 de más), 1-1 → Set 3 activo, 2-1 ya cerrado → `null`, Americano (un solo set, activo hasta cerrarlo, luego `null`), y manejo defensivo de `sets` vacío/`undefined`.
- Las reglas de validez por formato (Clásico, Americano, Punto de Oro/Con ventaja/Star Point, tie-breaks) no se retestearon de cero porque la interfaz nueva reutiliza exactamente las mismas funciones puras ya cubiertas por la suite preexistente — no se duplicó código de validación, así que tampoco se duplicó su cobertura.
- Se corrió sirviendo `bramulab/` con `.claude/dev-server.py` (ya existente en el repo).

---

## 9. Pruebas manuales

**Flujo completo de integración (§16 del consolidado), verificado en el entorno local:**
- `+` → Cargar mi partido jugado → 4 jugadores → carga de `6-2, 4-6, 6-4` solo con el teclado BRAMU → marcador acumulado actualizándose en vivo → teclas imposibles (8/9 en Clásico) deshabilitadas → borrar y corregir ambos lados → `Continuar` nunca se habilita con un resultado inválido → partido guardado y persistido (confirmado releyendo `localStorage` directamente) → `Modificar` edita fecha/hora/lugar y persiste → nota privada agregada, autoguardada, editable desde el detalle en Análisis → nota confirmada ausente de Home/Historial/Resumen (marcador único, ver §4) → `Ver resumen` abre el partido correcto sin duplicar registros → Home actualiza Último partido, Nivel BRAMU, Efectividad y Racha → edición posterior de `playedAt` (movido fuera de la ventana de 30 días) recalcula Actividad 30 días correctamente (de "1 partido" a "Sin partidos") → edición de un set anterior con descarte de Set 3 huérfano, cancelar y confirmar (§6) → registro en vivo Punto por punto (puntos 30/15 sin error) y Game por game (1 game sin error) sin regresiones ni errores de consola nuevos.
- Partido sin `privateNote` (registro simulando datos anteriores a esta ronda): abre en Análisis sin error, campo vacío.

**Mouse real en escritorio (1366×768):** todo el flujo de "+" → Cargar mi partido jugado → selección de 4 jugadores (búsqueda + alta como invitado) → carga de dos sets vía clicks reales del mouse sobre el teclado → confirmación de Set decisivo → guardado y transición a Partido guardado — sin recurrir a eventos sintéticos de JS para ninguna interacción del usuario en este recorrido.

**Viewports (táctil simulado):** 390×844, 402×874, 834×1112 (tablet), y 1366×768 (además del mouse, arriba) — la pantalla de carga y el teclado se ven completos, sin scroll interno forzado durante la carga de un set, y el shell de contenido respeta el ancho de 768px en tablet/escritorio (heredado de v2.1, no regresionado).

**Consola:** sin errores propios de la app en ningún recorrido después de los dos fixes de §5 (los únicos mensajes observados en el entorno de verificación fueron "unknown error fetching script", recursos externos bloqueados por la sandbox del navegador de verificación — no relacionados con el código de esta ronda).

**Producción real (post-deploy):** identidad nueva, footer confirmando v2.2 — no se cargaron partidos de prueba ahí para no ensuciar el dispositivo real de Sebastián.

---

## 10. Comprobación de los 14 criterios de aceptación (§18 del consolidado)

1. ✅ La carga manual deja de ser un formulario plano — resultado protagonista en cada paso (§2, §6).
2. ✅ El marcador superior refleja en tiempo real los sets cargados (chips `SET N` acumulados).
3. ✅ El teclado BRAMU evita combinaciones imposibles antes de confirmar (`canExtendSetDigits`, §3).
4. ✅ `Continuar` permanece visible inmediatamente arriba del teclado en todo momento.
5. ✅ El partido se guarda antes de pedir fecha, lugar o notas (§4, Momento 1).
6. ✅ Cerrar la app después del guardado no pierde el partido — persiste en `localStorage` de inmediato.
7. ✅ Fecha, hora y lugar parten de `Ahora` y se modifican después vía `Modificar` (§4, §9 del consolidado).
8. ✅ La nota privada es opcional, editable, y verificada ausente fuera del detalle personal (§4).
9. ✅ `Ver resumen` sustituye a un segundo `Guardar partido` — no existe ese botón en Partido guardado.
10. ✅ La tarjeta Último partido muestra resultado, estado, participantes y metadatos con jerarquía clara (§2).
11. ✅ Home, Historial, Perfil y Evolución permanecen consistentes tras guardar/editar (probado con edición de `playedAt`, §9).
12. ✅ Sin regresiones en registro en vivo (Punto por punto y Game por game probados) ni pérdida de datos anteriores (compatibilidad sin `privateNote` probada).
13. ✅ `bramulab-partidos/` permanece intacta (§12).
14. ✅ Publicado como v2.2 solo después de que la suite completa y las pruebas manuales estuvieran en verde, incluidos los dos fixes de §5.

---

## 11. Limitaciones y deuda técnica

- La Auditoría Visual y el Moodboard se usaron como contexto para el criterio de diseño de esta ronda, tal como pidió el consolidado — no se ejecutó ninguna otra deuda técnica de esa auditoría que sea ajena al alcance de estos 5 puntos.
- El teclado BRAMU siempre muestra 0–9 (decisión documentada en §3); si en el futuro un formato necesitara un rango distinto, `canExtendSetDigits` sigue siendo el único lugar a tocar.
- La regla de movimiento del Nivel BRAMU y el resto de BRAMU Intelligence no se tocaron — fuera de alcance explícito de esta ronda (§17 del consolidado).
- No se probó un escenario real de "usuario con v2.1 previamente instalada recibe el prompt de actualización a v2.2" más allá de confirmar que `version.json`, el nombre de caché y `PLStore.VERSION` quedaron consistentes en `v2.2` y que la caché vieja (`bramulab-v2.1`) ya no aparece en Cache Storage tras el deploy — mismo nivel de verificación que se usó en el informe de v2.1.

---

## 12. Confirmación explícita — `bramulab-partidos/` intacta

- `git status`/`git diff --stat` confirmaron **cero archivos modificados** dentro de `bramulab-partidos/` en todo el trabajo de esta etapa (verificado antes del commit).
- Se navegó la URL de producción de `bramulab-partidos/` después del deploy: sigue mostrando `v14`, con su pantalla de Configurar partido intacta.

---

## 13. Commit final y tag

- Commit: `e45eb35d28cb0a61cc7054939d017d1cac127c39` — *"BRAMU Lab v2.2 · Carga manual centrada en el marcador y nueva jerarquía visual"*.
- Tag: `v2.2`, apuntando exactamente a ese commit.
- Rama: `main`, pusheada a `origin/main`.

---

## 14. Estado del deploy de GitHub Pages

El workflow `pages build and deployment` (run `33787219047`) completó con `success` en 38s (`gh run watch --exit-status`). Deploy real confirmado.

---

## 15. URLs verificadas

- App: `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` — v2.2 confirmada en producción (footer, `version.json` sirviendo `{"version":"v2.2"}` con `no-store`, Cache Storage únicamente `bramulab-v2.2`, service worker activo).
- Marcador congelado (no tocado): `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — v14 confirmada, intacta.
- Repositorio: `https://github.com/sebastianvilaa/BRAMUlab`.

---

## 16. ¿Lista para revisión externa?

**Sí.** El código está commiteado, tagueado como `v2.2`, pusheado a `main`, y verificado en producción real de GitHub Pages, incluida la actualización de la caché de v2.1 a v2.2. `bramulab-partidos/` permanece intacta en v14. No quedó ninguna ambigüedad de producto sin resolver — todas las decisiones tomadas por cuenta propia fueron técnicas menores (documentadas en §3, §4) y ninguna cambió materialmente la experiencia pedida por el consolidado.

No avanzo a ninguna etapa siguiente hasta la revisión de ChatGPT y la evaluación de Sebastián.
