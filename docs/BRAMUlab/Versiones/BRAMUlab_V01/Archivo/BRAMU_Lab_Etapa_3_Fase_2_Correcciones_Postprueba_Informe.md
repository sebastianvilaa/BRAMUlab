# BRAMU Lab
## Etapa 3 — Fase 2 · Correcciones postprueba
### Informe de cierre

**Estado:** IMPLEMENTADO Y VERIFICADO
**Fecha:** 02 de septiembre de 2026
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/` (sin cambios — ver §7)
**Versión de partida:** v1.1 (commit `087634e`) · **Versión resultante:** v1.2
**Documento base:** `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Fase_2_Correcciones_Postprueba_Consolidado.md`

Este informe es autosuficiente: documenta las cuatro correcciones, decisiones técnicas, archivos, tests, verificación manual y despliegue sin necesitar el historial de chat operativo.

---

## 1. Resumen de lo implementado

Cuatro correcciones puntuales sobre la Fase 2 ya desplegada (v1.1), detectadas en la prueba real en iPhone:

1. **Entrada correcta a la app** — arranca en el Home del jugador (o directo en el marcador si hay un partido en vivo activo, o en "¿Quién sos?" si todavía no hay identidad); "Configurar partido" pasa a ser una pantalla de acceso secundario.
2. **Franja compacta** — la franja de partido en curso del Home se rediseñó a un layout horizontal y bajo (latido + texto a la izquierda, "Continuar ›" compacto a la derecha), eliminando el botón lima grande "CONTINUAR" y con nombres largos que truncan en vez de crecer en altura.
3. **Resultado parcial completo** — la franja y la tarjeta contextual de la hoja ahora muestran todos los sets terminados más el actual (ej. `6-0 · 0-3`), no solo el set en curso, vía un helper puro y central reutilizado en ambas superficies.
4. **Sin título duplicado en la hoja** — el encabezado de la hoja dice "REGISTRAR PARTIDO" en los tres niveles (antes decía "PARTIDO EN CURSO" con partido activo); "PARTIDO EN CURSO" aparece una sola vez, dentro de la tarjeta contextual.

Todo lo validado en la prueba real de v1.1 (§2 del consolidado) se preservó: se reverificó explícitamente (§8) que el flujo del `+`, la reanudación automática y la navegación intencional al Home siguen funcionando exactamente igual.

---

## 2. Archivos modificados

| Archivo | Cambio |
|---|---|
| `bramulab/index.html` | Franja del Home reestructurada (indicador + columna de texto + CTA compacta); título del nivel "activo" de la hoja cambiado a "REGISTRAR PARTIDO". |
| `bramulab/styles.css` | `.active-match-banner` reescrito (layout horizontal, `flex`, truncado con ellipsis, latido en forma de punto con anillo animado en vez de glow en todo el contenedor); se eliminó el keyframe anterior (`activeMatchPulse`), reemplazado por `activeMatchPulseRing`. |
| `bramulab/player-home.js` | `formatFinishedSetSegment(s)` y `formatLiveScoreLabel(state)` — nuevo helper puro y central para el resultado parcial completo; `summarizeActiveMatchSnapshot` actualizado para usarlo. |
| `bramulab/app.js` | `tryAutoResumeActiveMatch()` reemplazada por `bootDefaultScreen()` (decide Home vs. marcador activo al arrancar). |
| `bramulab/store.js` | `APP_VERSION`: `'v1.1'` → `'v1.2'`. |
| `bramulab/sw.js` | `CACHE_NAME`: `'bramulab-v1.1'` → `'bramulab-v1.2'` (el filtro de limpieza no necesitó cambios). |
| `bramulab/version.json` | `"version": "v1.2"`. |
| `bramulab/tests.html` | 2 aserciones existentes actualizadas (nuevo formato de `scoreLabel`) + 9 tests nuevos para `formatLiveScoreLabel`. |

`bramulab-partidos/` — **cero archivos tocados** (ver §7).

---

## 3. Corrección 1 — Entrada correcta a BRAMU Lab

`tryAutoResumeActiveMatch()` (que solo reanudaba un partido activo, dejando la app en Setup en cualquier otro caso) se reemplazó por `bootDefaultScreen()`:

```js
function bootDefaultScreen() {
  const snap = Store.loadActiveMatch();
  if (snap && snap.match && !snap.finished) { continueActiveMatch(); return; }
  openPlayerHome();
}
```

`openPlayerHome()` ya resolvía el caso "sin identidad todavía" (abre "¿Quién sos?" y, al completarlo, entra al Home) — se reutilizó tal cual, sin duplicar esa lógica. Los tres casos de arranque:

- **Partido en vivo activo:** reanuda directo en el marcador (sin cambios respecto a v1.1).
- **Sin partido activo, con identidad:** entra directo al Home del jugador.
- **Sin partido activo, sin identidad:** muestra "¿Quién sos?" primero; al completarlo, entra al Home.

"Configurar partido" (la pantalla de jugadores/formato/puntuación, antes la entrada por defecto) ahora se alcanza únicamente por accesos explícitos: `+` → "Registrar partido en vivo" → "Game por game"/"Punto por punto" (ya existente desde la Fase 2 original), o el link "Configurar partido" del header del Home (ya existía desde la Etapa 2, sin cambios). No se rompió ningún acceso existente.

---

## 4. Corrección 2 — Franja compacta del Home

Layout horizontal (`display:flex`) en vez de la tarjeta vertical anterior:

- **Izquierda:** un punto lima de 8px con un anillo animado que se expande y se desvanece (`activeMatchPulseRing`, 2.4s) — más perceptible que el glow muy sutil de la versión anterior, a la misma velocidad, sin volverse invasivo — seguido de la etiqueta "PARTIDO EN CURSO", los equipos y el resultado parcial + modo, en una columna angosta.
- **Derecha:** "Continuar ›" en texto lima, sin fondo ni padding — reemplaza el botón lima grande de ancho completo que existía antes.
- Toda la franja sigue siendo un único `<button>` tocable (nada cambió en ese aspecto).
- Nombres largos: `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` en las líneas de equipos y de resultado/modo, con `min-width:0` en la columna de texto (necesario para que el truncado funcione dentro de un hijo flex) — la altura de la franja queda **fija** sin importar el largo de los nombres, en vez de crecer envolviendo el texto como en la versión anterior.
- `prefers-reduced-motion`: el anillo animado se anula por completo (`animation:none`), igual que antes.

---

## 5. Corrección 3 — Resultado parcial completo

Nuevo helper puro en `player-home.js`:

```js
function formatFinishedSetSegment(s) { /* mismo criterio que formatSetSegmentLabel de app.js */ }
function formatLiveScoreLabel(state) {
  const finished = (state.sets || []).map(formatFinishedSetSegment);
  const current = `${state.gamesA || 0}-${state.gamesB || 0}`;
  return finished.concat(current).join(' · ');
}
```

`formatFinishedSetSegment` replica exactamente el criterio ya existente en `formatSetSegmentLabel` (app.js, usado en Historial/Último partido/Compartir): un set extraordinario (Resolver con Tie break) agrega su propio resultado de TB aparte (`4-4 · TB 10-5`); un set reglamentario —incluso si terminó en tie break normal (ej. `7-6`)— muestra solo `gamesA-gamesB`, sin desglose redundante. No se creó ninguna regla deportiva nueva: el `state` viene siempre de `Engine.computeStateFromEvents`/`computeGameStateFromEvents`, la misma fuente de verdad que ya usa el marcador en vivo.

`summarizeActiveMatchSnapshot` pasó a usar `formatLiveScoreLabel(state)` en vez del anterior `\`Set ${state.sets.length + 1} · ${gamesA}-${gamesB}\`` (que solo mostraba el set actual). Como ambas superficies (franja del Home y tarjeta contextual de la hoja) leen `scoreLabel` de esa misma función, el helper queda genuinamente único y central — exactamente lo que pide §3.3.

El modo de registro se sigue concatenando aparte en cada superficie (`\`${scoreLabel} · ${modeLabel}\``), tal como exige el consolidado ("El modo de registro se mantiene separado del resultado").

**Nota de consistencia tipográfica:** los ejemplos del consolidado usan guion medio "–" en la prosa (`6–4`); se mantuvo el guion simple "-" que ya usa el resto de la app en TODOS los demás lugares que muestran un resultado de set (Historial, Último partido, marcador compacto, `formatSetSegmentLabel`). Cambiarlo solo acá habría introducido una inconsistencia tipográfica nueva — se interpreta como una convención de escritura del documento, no como un requisito de producto.

---

## 6. Corrección 4 — Sin título duplicado en la hoja

Único cambio: el `<span class="bottom-sheet__title">` del nivel "con partido activo" pasó de "PARTIDO EN CURSO" a "REGISTRAR PARTIDO" — ahora coincide con el título de los otros dos niveles (sin partido activo / elegir modo en vivo), que ya decían "REGISTRAR PARTIDO". "PARTIDO EN CURSO" quedó como una única etiqueta, dentro de la tarjeta contextual (`sheet-active-card__label`), junto con equipos, resultado parcial completo, modo y "CONTINUAR PARTIDO" — sin tocar nada de esa tarjeta ni de "Registrar partido nuevo"/la confirmación de descarte, que se conservan intactas.

---

## 7. Versión, caché y confirmación de que BRAMU Lab Partidos no cambió

`APP_VERSION` (store.js), `CACHE_NAME` (sw.js) y `version.json` se actualizaron juntos a `v1.2`, siguiendo el mismo mecanismo ya usado en Fase 1/Fase 2 (el filtro de limpieza de cachés `k.startsWith('bramulab-v')` no necesitó cambios: ya cubre cualquier nombre `bramulab-v*` futuro). El aviso de nueva versión (`checkForNewVersion`/popup "HAY UNA NUEVA VERSIÓN") no se tocó — mismo mecanismo, ya verificado en producción en la fase anterior.

`git status --porcelain` antes de este commit muestra únicamente archivos bajo `bramulab/` (más el consolidado nuevo en `docs/`) — **cero archivos bajo `bramulab-partidos/`**. Confirmado también manualmente: no se abrió, editó ni desplegó ningún archivo de esa carpeta durante esta ronda.

---

## 8. Tests agregados y resultado

Se actualizaron 2 aserciones existentes (el formato de `scoreLabel` cambió de `"Set 1 · 0-0"` a `"0-0"`) y se agregaron 9 tests nuevos, cubriendo exactamente los casos mínimos pedidos en §3.3 del consolidado:

1. Completo — set 1 en curso (sin sets terminados).
2. Completo — set 2 con el primero terminado.
3. Completo — set 3 con dos sets terminados.
4. Por Games — set 1 en curso.
5. Por Games — set 2 con el primero terminado.
6. Por Games — set 3 con dos sets terminados.
7. Set extraordinario (tie break) — muestra su propio resultado de TB aparte.
8. Set reglamentario con tie break normal — no repite el desglose (`7-6` solo).
9. `formatLiveScoreLabel` defensivo ante `state` nulo.

Los casos 1-6 se probaron con event-replay REAL a través del motor (`E.computeStateFromEvents`/`computeGameStateFromEvents`, construyendo secuencias de puntos/games "limpias" sin ambigüedad de deuce), no con estados inventados a mano — confirma que el helper funciona sobre la salida real del motor en ambos modos. Los casos 7-8 usan un `state` construido a mano (misma forma que ya produce el motor) para no reconstruir la mecánica completa de un tie break extraordinario solo para el test.

**Resultado: 382/382 tests en verde** (373 de la línea base de v1.1 + 9 nuevos), confirmado localmente (`python3 .claude/dev-server.py`, `http://localhost:4173`) y en producción tras el despliegue (ver §11).

---

## 9. Verificaciones manuales

Todo lo siguiente se verificó en el navegador contra el servidor de desarrollo local sirviendo `bramulab/` directamente (sin arnés de pruebas de interacción — limitación documentada desde antes de esta fase):

- **Arranque sin identidad:** `localStorage.clear()` + recarga → muestra "¿Quién sos?" primero; al completarlo, entra al Home con la barra inferior visible.
- **Arranque con identidad, sin partido activo:** recarga → entra directo al Home (antes entraba a "Configurar partido").
- **Arranque con partido activo:** sembrado un partido en vivo (multi-set, ambos modos probados por separado) vía `Store.saveActiveMatch` + recarga completa → reanuda directo en el marcador exacto, sin pantalla intermedia (sin regresión respecto a v1.1).
- **Franja compacta:** con el partido activo sembrado, navegación al Home vía el logo del header (no destructiva, sin cambios respecto a v1.1) → franja mostrada en una sola fila compacta (~66.5px de alto, medido con `getBoundingClientRect`), con el punto de latido, "Continuar ›" a la derecha y sin el botón lima grande anterior.
- **Nombres largos:** mismo partido con nombres de pareja muy largos (`"Bartolomé Fernández-Larrañaga"`, etc.) → el texto trunca con ellipsis (`scrollWidth > clientWidth` confirmado), la franja mantiene la MISMA altura (66.5px, sin crecer), sin desborde horizontal del body.
- **Resultado parcial completo:** franja y tarjeta contextual de la hoja mostrando correctamente `6-0 · 0-3 · Punto por punto` (Completo, 1 set terminado) y `0-6 · 6-0 · 0-3 · Game por game` (Por Games, 2 sets terminados) — coincide exactamente con el estado real sembrado en el motor.
- **Hoja sin título duplicado:** con partido activo, texto completo de la hoja verificado como `"REGISTRAR PARTIDO ✕ PARTIDO EN CURSO [equipos] [resultado] CONTINUAR PARTIDO Registrar partido nuevo"` — "PARTIDO EN CURSO" aparece exactamente una vez.
- **Accesos a "Configurar partido" preservados:** `+` → "Registrar partido en vivo" → "Game por game" aterriza en `view-setup` con el modo preseteado; el link "Configurar partido" del header del Home también lleva a `view-setup` — ambos verificados tras esta corrección.
- **Descarte y reapertura de la hoja:** re-verificado que "Registrar partido nuevo" → confirmar descarte → la hoja reabre en nivel 1, sin comportamiento distinto al de v1.1.
- **Ciclo completo sin regresión:** un partido Por Games sembrado, reanudado, finalizado manualmente vía ☰ → "Finalizar partido" con ganador declarado → la franja desaparece del Home y "Último partido" refleja correctamente el resultado — confirma que el motor de puntuación y el flujo de finalización no sufrieron ningún efecto secundario por estos cambios.
- **Responsive:** verificado a 375px (ancho tipo iPhone) y 768px (tablet) — sin desborde horizontal en ningún caso; a 375px los nombres largos truncan, a 768px entran sin truncar (más espacio disponible), la franja mantiene su altura compacta en ambos anchos.
- Consola del navegador sin errores en ningún punto de las pruebas.

**Limitación de esta ronda (igual que en la Fase 2 original):** no se pudo tomar capturas visuales completas ni simular gestos táctiles reales porque el panel visual del navegador quedó oculto del lado del host durante buena parte de esta verificación — se compensó con lecturas estructurales directas (`getBoundingClientRect`, `getComputedStyle`, contenido de texto) en vez de inspección visual humana. Es una verificación real y precisa, pero no reemplaza un vistazo humano ni una prueba táctil genuina en un dispositivo.

---

## 10. Decisiones técnicas menores

1. **`bootDefaultScreen()` reemplaza a `tryAutoResumeActiveMatch()`** en vez de agregarse como una función paralela — su responsabilidad creció de "solo reanudar" a "decidir toda la pantalla de arranque", así que se renombró para que el nombre siga describiendo lo que hace.
2. **Guion simple, no guion medio, en el resultado parcial** — ver nota de consistencia en §5. Se prioriza no romper la convención tipográfica ya establecida en el resto de la app.
3. **El "latido" pasó de un glow en todo el contenedor a un punto con anillo animado** — interpretación de "hacerlo un poco más perceptible mediante contraste o amplitud, sin acelerarlo": mismo timing (2.4s), pero un indicador puntual y contrastado (patrón común de "en vivo") en vez de una sombra difusa que era fácil de no notar.
4. **No se tocó `checkForActiveMatch()`/`#continue-banner`** (el banner "de repuesto" de `view-setup`, de la Fase 0) — sigue funcionando igual, sin unificarlo con el nuevo helper central. Es una pieza de UI cada vez menos alcanzable ahora que el arranque por defecto ya no pasa por Setup, pero seguía fuera del alcance explícito de este consolidado (que habla de "la franja del Home" y "la hoja contextual" específicamente) y tocar código ya verificado sin necesidad real no se justificaba.
5. **Sin desvíos del alcance protegido:** no se rediseñaron otras tarjetas del Home, no se avanzó a la Fase 3, no se agregó ninguna funcionalidad nueva más allá de las cuatro correcciones.

---

## 11. Commit, push y despliegue

- **Commit:** `e59d363410d4103f8551053a24c29df56d202c46` — `V16 · Etapa 3, Fase 2 (BRAMU Lab): correcciones postprueba, v1.2`.
- **Push:** confirmado a `main` (`ef7418b..e59d363`).
- **GitHub Pages:** build del commit `e59d363` con estado `built` (verificado vía `gh api repos/sebastianvilaa/BRAMUlab/pages/builds/latest`), sin errores.
- **Verificación en producción:**
  - `https://sebastianvilaa.github.io/BRAMUlab/bramulab/tests.html` — 382/382 tests en verde (tras limpiar el Service Worker/caché de una pestaña que ya había visitado la versión anterior, mismo mecanismo de detección de actualización ya documentado en la fase anterior).
  - `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` — `PLStore.VERSION === 'v1.2'`; primer arranque sin identidad muestra "¿Quién sos?"; tras identificarse entra al Home; una segunda visita (identidad ya guardada, sin partido activo) entra directo al Home sin pasar por "Configurar partido".
  - `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — intacta, `v14`, sin ningún rastro de esta corrección.
  - Se limpió el `localStorage` de prueba usado para esta verificación (nombre de jugador de prueba) antes de terminar, sin dejar datos residuales.

---

## 12. Validaciones pendientes en iPhone

Esta corrección responde directamente a hallazgos de una prueba real en iPhone, así que vale la pena que la siguiente prueba real confirme puntualmente:

- que la app abre directo en el Home (o en el marcador, si había un partido en curso) al tocar el ícono, sin pasar por "Configurar partido";
- que la franja se ve claramente compacta y no compite visualmente con el resto del Home, con el latido perceptible pero no invasivo;
- que el resultado parcial de dos o tres sets se lee bien en el ancho real de pantalla, sin que el texto se corte de forma confusa;
- el deslizamiento hacia abajo para cerrar la hoja (gesto táctil real — no se pudo simular con las herramientas de esta sesión, como ya se documentó en el informe anterior).

No hay otras limitaciones táctiles pendientes más allá de las ya conocidas de la Fase 2 original.
