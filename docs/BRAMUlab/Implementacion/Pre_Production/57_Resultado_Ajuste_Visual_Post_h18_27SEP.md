# BRAMUlab — Resultado del ajuste visual final post-h18

**Fecha:** 27/09/2026
**Rama:** `staging`
**Baseline previa:** BRAMUlab V04.11 / bundle `04.11-h18`
**Bundle resultante:** BRAMUlab V04.11 / bundle `04.11-h19`
**Fuente operativa:** `57_Handoff_Ajuste_Visual_Final_Post_h18_27SEP.md` (única tanda, sin releer Laboratorio).

---

## 1. Qué cambió

### A. Sistema único de estados — Último partido

h18 había acotado el cambio de h17 solo a `CORRECCIÓN PENDIENTE`, devolviendo el resto de los estados (`PENDIENTE DE VALIDACIÓN`, `IDENTIDAD CUESTIONADA`, etc.) a vivir apilados bajo fecha/hora. Se deshizo ese acotamiento: **todos** los estados operativos ahora viven en la misma columna de `row2` (a la derecha de forma+resultado), como texto compacto (`font-size:10px`, `white-space:nowrap`, sin fondo/borde/padding — nunca una píldora), coloreado según semántica (`serverMatchStatusBadgeModifier`). Copies específicos de esta tarjeta: `TU TURNO: CONFIRMAR` → **CONFIRMAR PARTIDO**; `PENDIENTE DE VALIDACIÓN` → **ESPERANDO VALIDACIÓN**; el resto conserva el wording de `serverMatchStatusLabel` (compartido con Historial/Resumen, sin ampliar alcance ahí).

### B. Slot/carrusel único del Home

Se fusionó el carrusel de pendientes (`#player-home-pending-carousel`) con la tarjeta TU MOMENTO (antes una `.pastilla--momento` separada, más abajo en el Home) en **un único carrusel**. Orden: accionables → correcciones → espera → TU MOMENTO (siempre última, nunca vacía). Se sumó un tercer tipo de tarjeta, `correccion`: un partido `validated` con corrección post-validación activa (mismo criterio de ventana de 3 días que ya usa Último partido) ahora también aparece en el carrusel — sin distinguir proponente/respondedor a este nivel (esa distinción real solo la resuelve el Resumen). Copies actualizados: `PARTIDO POR CONFIRMAR` (con actor real vía `createdByPlayerId` cuando es resoluble, nunca inventado), `CORRECCIÓN PENDIENTE`, `ESPERANDO CONFIRMACIÓN`. `computeHomePendingCarouselItems` (player-home.js, pura) ganó un segundo parámetro `now` para permitir tests deterministas.

### C. Resumen — tarjeta oficial

`RESULTADO OFICIAL ACTUAL` dejó de ser un `<p>` hermano de `#analysis-result`, alternado por `paintB6Actions` tras `get_match_detail`. Ahora se calcula **sincrónicamente** en `renderAnalysis` (los datos que hacen falta —`pendingCorrectionRevisionId`/`validatedAt`— ya vienen en el `f` liviano de `get_my_matches`, a diferencia de `proposedByTeam`, que sí necesita detalle) y se renderiza como **primer hijo** de la tarjeta oficial (`buildScoreCardHTML`, orden: título → ganadores → grilla → sets/games). Sin tarjeta extra alrededor.

### D/E/F. Resumen — tarjeta de corrección como unidad completa

Una única `.b6-correction-card` (borde + halo ámbar, mismos valores de glow ya tuneados de `.player-home-lastmatch` — 18px/.12 en reposo, 25px/.24 en el pico, 3.6s, `prefers-reduced-motion` respetado) contiene, en orden: rótulo+propuesta+explicación (`.b6-correction-compare`), estado de espera si corresponde (reordenado: antes vivía *antes* de la propuesta, ahora va después), y acciones. La grilla interna (`.result-card`) perdió su propio borde/fondo para no quedar "caja dentro de caja".

Aceptar/Rechazar: vuelven a estar **lado a lado incluso en móvil** (grid `1fr 1fr`, mismo lenguaje que los selectores Clásico/Americano de Cargar partido), estilo outline — `Aceptar corrección` con borde/texto verde, `Rechazar` con borde neutro/texto claro, ninguno lima macizo, sentence case real (no más `.btn-start`/`.btn-secondary` en este par puntual). "Reportar un error" se reubica **dentro** de la tarjeta de corrección solo mientras hay una activa (mismo elemento único, vía `confirmBlock.after(...)`/`respondBlock.appendChild(...)` en `paintB6Actions`; su disponibilidad real la sigue decidiendo únicamente `b6ReportErrorAvailability`) — el resto del tiempo vuelve a su posición de siempre.

### H. Barra de Nivel — investigación de la regresión

Se investigó con `git log -S`/`git show` antes de tocar nada. Confirmado: `301d3b3` ("cierre UX h13") arregló el bug del relleno fijo al 100% para cuentas Nivel V1 calibradas, pero al hacerlo agregó `barEl.classList.remove('is-animating')` **sin volver a agregarla** — a diferencia del branch legacy (cuentas migradas), que sí conserva el patrón completo (`remove` → reflow forzado → `add` si `shouldAnimate`). Esa rama V1-calibrada es hoy el camino vigente para casi todas las cuentas reales, lo que explica por qué Sebastián dejó de ver la animación. Se restauró el mismo patrón exacto (sin inventar una animación ni intensidad nueva) únicamente en ese branch. No se tocó fórmula, porcentaje ni ningún dato de Nivel.

---

## 2. Tests

- **Suite Node completa:** `node --test bramulab/*.test.mjs` → **349/349 OK**. Incluye 16 tests nuevos focales (`h19-visual-final-adjustment.test.mjs`) cubriendo A/B/C/D/E/F/H, más 3 tests preexistentes actualizados (`h17-visual-regression.test.mjs` x2, `revision-central-h12.test.mjs` x1) para reflejar decisiones explícitamente revertidas por esta ronda, con nota de supersedencia en cada uno.
- **`tests.html`** (batería de módulos puros, navegador): **1565/1565 OK** — incluye la extensión del caso de `computeHomePendingCarouselItems` (nuevo kind `correccion` + ventana de 3 días).
- **Smoke boot:** `index.html` local carga sin errores nuevos de consola/red; bundle `04.11-h19` confirmado en la petición real de `app.js`. Único error observado (`env.generated.js → 404`) es preexistente/ambiental (Supabase no configurado en el dev server local), no relacionado con esta ronda.
- Los tests estructurales cubren markup/CSS/lógica de reubicación — **no reemplazan** una revisión visual real, como pide el documento.

---

## 3. Commit / deploy

- Commit único lógico sobre `staging` (ver hash real del commit de esta ronda).
- Push a `origin/staging`.
- El push dispara el `ignoreCommand` de `bramulab/vercel.json` (compara `HEAD^`↔`HEAD` dentro de `bramulab/`); como esta ronda modifica archivos de `bramulab/`, dispara el único deploy intencional de BRAMUlab Staging.

---

## 4. Desvíos / limitaciones técnicas reales

1. **Punto G (Historial — estado relativo al actor) NO implementado tal como está escrito, por bloqueo técnico real confirmado contra la fuente SQL.** El documento pide distinguir en Historial `CORRECCIÓN PENDIENTE` (quien debe responder) de `ESPERANDO RESPUESTA` (quien propuso). Se verificó contra la migración real (`supabase/migrations/20260921220000_bloque6_read_rpcs.sql`) que `is_action_mine`/`action_side` en `get_my_matches` se calculan **únicamente** para `status = 'pending_validation'` — para un partido `validated` con corrección activa, esos campos no distinguen proponente de respondedor, y `actionsRaw` (que sí lo permitiría) no viaja en esa lista liviana (solo en `get_match_detail`, por partido). Historial lista muchos partidos a la vez: pedir detalle por cada uno para decidir un texto no es viable sin tocar backend, explícitamente fuera de alcance. Se dejó Historial con su copy actual (`CORRECCIÓN PROPUESTA`, actor-neutro pero siempre verdadero, con su propio modificador de color `correction` ya distinto de `waiting`) en vez de inventar una distinción no verificable. Confirmado además, sin necesidad de cambio: Historial **nunca** usa `NECESITA REVISIÓN` para una corrección (ese texto es exclusivo de `status = 'necesita_revision'`, un estado de sync/outbox completamente distinto) — ese punto del documento ya estaba resuelto.
2. **El resto de los puntos (A, B, C, D, E, F, H) se implementaron tal como están escritos, sin reinterpretación.**
3. Punto I (fuera de alcance) respetado: no se tocó Mis grupos, backend, Supabase, main, Production, BRAMUlive, Ranking, Intelligence, lógica de validación/corrección (RPCs, `MV.respondMatchCorrection`, etc. sin cambios — solo posición/estilo/copy de sus botones), datos reales ni el editor de sets.

---

**PENDIENTE DE REVISIÓN VISUAL DIRECTA DE SEBASTIÁN**
