# BRAMU Lab — Hotfix v1.2.1 · Navegación «Volver al inicio»
## Informe de cierre

**Estado:** IMPLEMENTADO Y VERIFICADO
**Fecha:** 02 de septiembre de 2026
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/` (sin cambios — ver §7)
**Versión de partida:** v1.2 (commit `e59d363`) · **Versión resultante:** v1.2.1
**Documento base:** `docs/bramulab/consolidados/BRAMU_Lab_v1.2.1_Hotfix_Volver_al_Inicio_Consolidado.md`

Este informe es autosuficiente: documenta causa, cambios, tests, verificación manual y despliegue sin necesitar el historial de chat operativo.

---

## 1. Causa encontrada

Tres controles de la app usan el texto «Volver al inicio»/«VOLVER AL INICIO». Al auditarlos (`grep` de "volver al inicio" en `index.html`/`app.js`) aparecieron exactamente tres, y los tres tenían el mismo defecto de fondo — resolvían su destino con lógica vieja, previa a que el Home del jugador existiera como pantalla principal (Etapa 2):

1. **`#summary-new-btn`** ("VOLVER AL INICIO" en Resumen) — solo abría el Home si el partido era uno **manual, cargado desde el Home** (`manualLoadOrigin === 'player-home' && finishedSnapshot.mode === 'manual'`); para cualquier otro caso —que es la inmensa mayoría: **todo** partido Completo o Por Games— caía en `showView('setup')`.
2. **`#analysis-home-btn`** ("VOLVER AL INICIO" en Análisis) — mismo defecto, con la misma condición.
3. **`#menu-home`** (☰ → "Volver al inicio", dentro del partido en vivo — descarta el partido) — su handler, `goHome()`, terminaba incondicionalmente en `showView('setup')`, sin ninguna rama hacia el Home.

La causa raíz es la misma en los tres: son remanentes de cuando `view-setup` era la pantalla "de inicio" de la app (antes de la Etapa 2/Rama Jugador). El hotfix de Fase 2 · Correcciones postprueba ya había corregido **el arranque** de la app (`bootDefaultScreen`), pero no había tocado estos tres controles — que usan el mismo texto «Volver al inicio» y, por definición canónica (§2 del consolidado de este hotfix), deben significar exactamente lo mismo: ir al Home.

---

## 2. Acciones/handlers corregidos

| Control | Antes | Ahora |
|---|---|---|
| `#summary-new-btn` (Resumen) | `if (manualLoadOrigin==='player-home' && finishedSnapshot?.mode==='manual') openPlayerHome(); else showView('setup');` | `openPlayerHome();` — siempre, sin condición. |
| `#analysis-home-btn` (Análisis) | `if (manualLoadOrigin==='player-home' && f===finishedSnapshot && f.mode==='manual') openPlayerHome(); else showView('setup');` | `openPlayerHome();` — siempre, sin condición, sin importar si `f` es el partido recién terminado o uno viejo abierto desde Historial. |
| `#menu-home` → `goHome()` (☰, en vivo) | `discardActiveMatchState(); checkForActiveMatch(); showView('setup');` | `discardActiveMatchState(); checkForActiveMatch(); openPlayerHome();` |

`openPlayerHome()` es la única función canónica que abre el Home en toda la app (ya la usan, sin cambios en esta ronda, el logo del header de partido, el link "Configurar partido" y la reapertura de la hoja tras un descarte) — no se creó ninguna función nueva ni se duplicó lógica de navegación, tal como pedía el consolidado.

**Sobre `#menu-home`:** el consolidado (§1) describe el hallazgo específicamente para flujos posteriores a un partido terminado, pero su §2 ("Definición canónica de pantallas") establece sin condicionar: *"cualquier acción cuyo texto sea «Volver al inicio» debe abrir el Home del jugador"*. Como `#menu-home` usa exactamente ese texto, se interpretó que también estaba alcanzado y se corrigió — decisión razonada en la sección de decisiones técnicas (§8, decisión 1).

**Sin tocar:** `exitManualLoadScreen()` (el "Cancelar"/"←" de Cargar partido jugado) sigue usando `manualLoadOrigin` para decidir su destino — ese control no dice «Volver al inicio», es una cancelación de un formulario sin guardar, un caso distinto y fuera del alcance de este hotfix.

---

## 3. Archivos modificados

| Archivo | Cambio |
|---|---|
| `bramulab/app.js` | Los tres handlers de §2; comentario actualizado junto a `manualLoadOrigin` (ya no tiene ese segundo uso). |
| `bramulab/store.js` | `APP_VERSION`: `'v1.2'` → `'v1.2.1'`. |
| `bramulab/sw.js` | `CACHE_NAME`: `'bramulab-v1.2'` → `'bramulab-v1.2.1'` (el filtro de limpieza no necesitó cambios). |
| `bramulab/version.json` | `"version": "v1.2.1"`. |

`bramulab/tests.html` — **sin cambios** (ver §4: este hotfix no introduce ninguna lógica pura nueva que testear).

`bramulab-partidos/` — **cero archivos tocados** (ver §7).

---

## 4. Tests agregados y resultado

Este hotfix es, de punta a punta, una corrección de **destino de navegación** — no introduce ningún cálculo, formato ni regla nueva que pueda vivir como función pura en `player-home.js` (a diferencia de fases anteriores, donde sí había lógica extraíble como `formatLiveScoreLabel`/`getPlayedAt`). Los 12 casos mínimos que pide el consolidado (§5) son, sin excepción, de interacción/DOM (finalizar un partido de tal modo, tocar tal botón, verificar tal pantalla) — no hay arnés de pruebas de integración en este proyecto (limitación documentada desde antes de este hotfix). Agregar aserciones a `tests.html` para esto habría significado simular DOM completo dentro de un archivo que hoy solo carga `engine.js`/`stats.js`/`store.js`/`player-home.js`, sin `app.js` ni el documento real — no es el patrón de este proyecto y se descartó como cobertura artificial.

En su lugar, se mantuvo en verde la suite existente (**382/382**, sin cambios — confirma que esta corrección no tocó ninguna función pura) y se verificaron manualmente, en el navegador, los 12 casos exactos del consolidado (detalle completo en §5).

---

## 5. Verificaciones manuales

Todas contra el servidor de desarrollo local (`python3 .claude/dev-server.py`, `http://localhost:4173`), simulando interacción real (clicks/`requestSubmit` sobre los mismos elementos que toca un usuario) para no depender de capturas visuales:

1. **Partido Game por game finalizado (natural) → "Volver al inicio":** 12 puntos de un partido `+` → Registrar en vivo → Game por game hasta el cierre natural (6-0, 6-0) → Resumen → `#summary-new-btn` → **Home**, con "Último partido" = `VICTORIA 6-0 · 6-0 · POR GAMES`.
2. **Partido Punto por punto finalizado (natural) → "Volver al inicio":** 48 clics de zona (2 sets limpios de Punto de Oro) → Resumen → `#summary-new-btn` → **Home**, "Último partido" = `VICTORIA 6-0 · 6-0 · COMPLETO`.
3. **Finalización natural → Home:** cubierto por los casos 1 y 2 (ambos son cierres naturales, no manuales).
4. **Finalización manual → Home:** partido Completo cortado a mano vía ☰ → "Finalizar partido" → ganador Equipo A → Resumen → (además, desde ahí se probó el camino más largo del caso 6) → **Home**.
5. **Acceso desde Resumen → Home:** `#summary-new-btn`, cubierto en los casos 1/2/4.
6. **Acceso desde Análisis → Home:** dos variantes probadas — (a) desde el Resumen del partido recién finalizado manualmente (caso 4), "VER ANÁLISIS" → `#analysis-home-btn` → **Home**; (b) desde el **Historial**, abriendo el Análisis de un partido viejo (no el recién terminado) y tocando "VOLVER AL INICIO" ahí → **también Home** — confirma que quitar la condición `f === finishedSnapshot` no rompió nada: antes esa rama solo cubría el caso manual-desde-Home, ahora cubre absolutamente todos por igual.
7. **"Último partido" refleja el finalizado:** confirmado en cada uno de los casos 1/2/4 — el texto de la tarjeta coincide exactamente con el resultado recién jugado.
8. **Sin partido activo ni franja tras volver:** `Store.loadActiveMatch() === null` y `#active-match-banner.hidden === true` verificados después de cada "Volver al inicio" (los 4 casos de partido en vivo, más el descarte de ☰).
9. **Sin duplicado en Historial:** se comparó `Store.loadHistory().length` inmediatamente antes y después de tocar "Volver al inicio" en cada caso — siempre igual (el guardado ocurre una sola vez, al finalizar el partido; el botón nunca vuelve a guardarlo).
10. **"Configurar partido" sigue abriendo desde el `+`:** verificado en los 3 arranques de partido de este informe (`+` → Registrar en vivo → Game por game/Punto por punto → `view-setup` con el modo correcto) y además el link explícito "Configurar partido" del header del Home, probado por separado.
11. **Recarga posterior → Home, conserva identidad e historial:** con 3 partidos ya en el Historial y la identidad "Sebastián" guardada, `location.reload()` completo → aterriza directo en el Home, con el nombre y los 3 partidos intactos.
12. **BRAMU Lab Partidos intacta:** ver §7.

**Caso adicional probado (☰ → "Volver al inicio", discarding):** partido en vivo con un punto registrado → ☰ → "Volver al inicio" → confirmar → **Home** (antes: Setup), partido descartado y **sin** agregarse al Historial (comportamiento destructivo preservado, solo cambió el destino final).

Consola del navegador sin errores en ningún punto de las pruebas.

---

## 6. Confirmación del estado del historial y partido activo

En cada uno de los 5 flujos de cierre probados (natural×2, manual, descarte por menú, y el paso por Análisis desde Historial) se verificó explícitamente:

- el partido finalizado queda guardado **exactamente una vez** en `Store.loadHistory()`;
- `Store.loadActiveMatch()` devuelve `null` inmediatamente después;
- la franja `#active-match-banner` queda `hidden`;
- la identidad local (`Store.loadCurrentPlayerName()`) nunca se toca ni se pierde;
- no aparece el modal "¿Quién sos?" en ningún momento de estos flujos (la identidad ya existe siempre en este punto — Setup y el marcador en vivo solo son alcanzables habiendo pasado antes por el Home, que ya la exige).

---

## 7. Versión, caché y confirmación de que BRAMU Lab Partidos no cambió

`APP_VERSION` (store.js), `CACHE_NAME` (sw.js) y `version.json` actualizados juntos a `v1.2.1`, mismo mecanismo que las dos rondas anteriores (el filtro de limpieza `k.startsWith('bramulab-v')` no necesitó cambios). El aviso de nueva versión no se tocó — mismo mecanismo ya verificado.

`git status --porcelain` antes de este commit muestra únicamente archivos bajo `bramulab/` (más el consolidado nuevo en `docs/`) — **cero archivos bajo `bramulab-partidos/`**. Confirmado también manualmente en producción (ver §9): sigue publicada en `v14`, sin ningún cambio.

---

## 8. Decisiones técnicas menores

1. **Se incluyó `#menu-home` (☰ → "Volver al inicio") en el alcance**, aunque el §1 del consolidado (el "hallazgo") describe el problema solo para flujos posteriores a un partido terminado. Se decidió así porque el §2 ("Definición canónica de pantallas") es explícito y sin condicionar: cualquier acción con ese texto debe abrir el Home. Es además exactamente lo que pidió el mensaje de esta tarea: *"Corregir **todos** los accesos 'Volver al inicio'"*. Riesgo bajo: es la misma función `goHome()` de siempre, con un único cambio de destino final; el descarte del partido (la parte realmente delicada) no se tocó.
2. **Se retiró por completo la rama `manualLoadOrigin === 'player-home' && ... mode === 'manual'`** en vez de dejarla como caso especial dentro de una condición más amplia — ya no aporta nada: con la corrección, *todos* los casos van al Home, así que mantener la distinción solo agregaba código muerto. Coincide con la instrucción explícita del consolidado de "no duplicar lógica de navegación".
3. **Sin tests nuevos en `tests.html`** — justificado en detalle en §4: no hay ninguna función pura nueva que extraer; toda la corrección es de destino de navegación DOM. Se compensó con una verificación manual exhaustiva de los 12 casos (§5), incluyendo un caso adicional no listado explícitamente (el descarte por ☰) que comparte el texto exacto «Volver al inicio».
4. **Sin desvíos de alcance:** no se tocó ninguna pantalla de configuración, no se rediseñó nada, no se avanzó a la Fase 3, `bramulab-partidos/` permanece intacta.

---

## 9. Commit, push y despliegue

- **Commit:** `2ec46aa2173d2fd5e8b70a9fdab72b2fc84263be` — `BRAMU Lab v1.2.1 · hotfix navegación Volver al inicio` (nomenclatura nueva, sin "V17" ni numeración paralela, según lo pedido).
- **Push:** confirmado a `main` (`d410f20..2ec46aa`).
- **GitHub Pages:** build del commit `2ec46aa` con estado `built` (verificado vía `gh api repos/sebastianvilaa/BRAMUlab/pages/builds/latest`), sin errores.
- **Verificación en producción:**
  - `https://sebastianvilaa.github.io/BRAMUlab/bramulab/tests.html` — 382/382 en verde (tras limpiar Service Worker/caché de una pestaña con la versión anterior — mismo mecanismo ya documentado en rondas previas).
  - `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` — `PLStore.VERSION === 'v1.2.1'`; se jugó y finalizó un partido Completo real y se confirmó que "VOLVER AL INICIO" abre el Home con el partido recién terminado visible en "Último partido" (no "Configurar partido").
  - `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — intacta, `v14`.
  - Se limpió el `localStorage` de prueba usado para esta verificación antes de terminar.

---

## 10. Validaciones pendientes en iPhone

Después de esta corrección, antes de cerrar definitivamente la Fase 2 (criterio de cierre del consolidado), conviene confirmar en el dispositivo real:

- que "VOLVER AL INICIO" desde el Resumen de un partido Completo y de uno Por Games abre el Home con tarjetas (no "Configurar partido"), para los tres cierres típicos: natural, cortado manualmente, y desde Análisis;
- que la tarjeta "Último partido" del Home muestra el resultado recién jugado apenas se vuelve;
- que no aparece la franja "Partido en curso" después de volver.

No hay otras validaciones táctiles pendientes de rondas anteriores más allá de las ya conocidas (deslizar la hoja hacia abajo para cerrarla), que quedan fuera del alcance de este hotfix puntual.

Con esta corrección verificada en iPhone, el consolidado da por cerrada la Fase 2; el próximo desarrollo funcional (v1.3) debe iniciarse en un chat nuevo con Claude.
