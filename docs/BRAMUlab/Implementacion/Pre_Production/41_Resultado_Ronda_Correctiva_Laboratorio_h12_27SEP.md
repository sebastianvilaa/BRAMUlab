# BRAMUlab — Resultado: ronda correctiva consolidada de Laboratorio h11 → h12

**Rama:** `staging`
**Fecha:** 27/09/2026
**Bundle:** `04.11-h11` → `04.11-h12`
**Origen:** handoff [`40_Handoff_Ronda_Correctiva_Laboratorio_h11_27SEP.md`](40_Handoff_Ronda_Correctiva_Laboratorio_h11_27SEP.md), evidencia real de Laboratorio físico (`05_Laboratorio_UX_Uso_Real.md` §15.31–§15.33).

---

## 1. P1 — Bug de identidad canónica de Matu

### Causa raíz (confirmada por código)

El mismo jugador (`Matu`, `@matu_qa`) se veía distinto según la superficie porque **Compañeros/Rivales nunca resolvía por `player_id`**:

- la fila llamaba a `resolvePersonAccount(p)`, que para un `p.userId` real hacía `Store.getUserById(p.userId)` — pero `Store.getUserById` busca en `Store.loadUsers()`, la lista **local** de cuentas del prototipo previo al backend (V03.0), vacía/irrelevante para una cuenta real de Supabase Staging. Resultado: la fila nunca mostraba avatar real (siempre iniciales) ni podía resolver el `@username` de forma confiable.
- al tocar la fila, `openPersonListScreen` llamaba `openPlayerPublicProfile(el.dataset.name, 'companions')` — un **string plano**, no `{name, playerId}`. Sin `playerId`, `openPlayerPublicProfile` cae al camino local/legacy de `renderPlayerPublicProfile`, que vuelve a resolver por **nombre** contra `Store.loadUsers()` (mismo problema) y, si no encuentra nada, cae a un Nivel **simulado por hash** (`PH.computeSimulatedJugadorLevel`) y a un `@username` **fabricado** (`buildPlayerHandle`) — de ahí el `@matu`/Nivel 6.3 en vez de `@matu_qa`/Nivel 5.9 reales.

`Buscar jugadores` nunca tuvo este bug: ya resolvía por `search_players`/`player_id` real (server-backed) desde una ronda anterior — por eso era la única superficie correcta y sirvió de referencia.

**No se fusionó ni se borró ninguna cuenta.** No hay dos `player_id` distintos para dos Matu — hay UN solo `player_id` real, mal resuelto por rutas que nunca deberían haber dependido del nombre.

### Corrección

`bramulab/app.js#openPersonListScreen` (Compañeros/Rivales, misma función para ambas pantallas):

1. junta los `p.userId` reales de la lista y pide `Auth.getPlayersCompact(ids)` — **una sola llamada batch**, la misma RPC (`get_players_compact`) que ya usan RECIENTES (Cargar partido) e identity-resolve;
2. la fila muestra avatar real (foto firmada) y `@username` real cuando existen — nunca inventados;
3. el click pasa `{name, playerId}` a `openPlayerPublicProfile` cuando hay `player_id` real, forzando siempre el camino server-backed (`get_public_profile`) — nunca el fallback local por nombre.

Se agregó una guarda de respuesta tardía (`companionsRequestId`, mismo patrón que `b6IdentityResolveRequestId`) para que una llamada vieja no pise una pantalla más nueva.

`resolvePersonAccount` quedó retirada (dead code tras el fix).

---

## 2. P2 — Editor de corrección de sets

### Causa raíz

`updateProposeCorrectionKeypadKeysState`/`advanceProposeCorrectionDraftSide` (Proponer corrección) y sus mellizas `updateManualKeypadKeysState`/`advanceDraftSide` (Cargar partido — **mismo bug, nunca reportado ahí pero con el mismo patrón de código exacto**) siempre trataban el valor **ya cargado** del lado contrario como una restricción dura, sin distinguir si ese valor era:

- recién confirmado en esta misma pasada de edición (correcto tratarlo como fijo), o
- un valor **viejo**, precargado al reabrir un set ya completo (incorrecto tratarlo como fijo — el usuario puede estar a punto de cambiarlo también).

Caso A (`2–6 → 3–6`, un solo lado): al terminar de tipear el lado tocado, el código siempre forzaba abrir el teclado del otro lado en vez de reconocer que ya tenía un valor válido — `ENVIAR CORRECCIÓN` no habilitaba hasta re-tocar manualmente el 6.
Caso B (`3–6 → 6–4`, empezando por el lado que tenía el 3): el teclado deshabilitaba el dígito `6` porque el lado contrario todavía tenía el 6 viejo fijado como restricción.

### Corrección

Se agregó `b6CorrectionSideEntered`/`manualSideEntered` (`{a,b}` booleano) que distingue "valor mostrado" (siempre `b6CorrectionDraftSet`/`manualDraftSet`, única fuente para UI y validación — sin segunda copia de estado) de "¿el usuario ya reafirmó este lado en esta pasada de edición?":

- el teclado solo usa el valor del lado contrario como restricción si ese lado fue reafirmado en la sesión actual;
- al confirmar un lado, si el contrario ya tiene un valor real (reafirmado o preexistente), se intenta cerrar el set completo directamente en vez de forzar la reentrada del otro lado — `commitProposeCorrectionSetIfValid`/`commitCurrentManualSetIfValid` siguen siendo la única fuente de validación final (par completo real, nunca solo lo tocado);
- se reinicia en cada reapertura de un set (`reopenProposeCorrectionSet`/`reopenManualSet`) y cada vez que el editor pasa a un set distinto.

Aplicado **igual, en espejo**, a ambos editores (Proponer corrección y Cargar partido) por ser el mismo bug con el mismo código.

---

## 3. P3 — Corrección post-validación: oficial vs. propuesta

**Semántica sin cambios** (`Experiencia_Inicial.md` §12.3): la última versión validada sigue siendo oficial hasta que la otra pareja acepta.

Lo que cambió es la presentación, para la pareja que debe responder:

- la tarjeta de resultado ya existente (`#analysis-result`) se rotula `Resultado oficial actual` **solo** mientras hay una corrección esperando respuesta (nunca se duplica la tarjeta);
- debajo, `#b6-respond-correction-block` muestra `Corrección propuesta por [nombre real]` con una tarjeta de resultado **completa** (parejas + sets propuestos + ganador resultante) — nuevo helper `buildCorrectionPreviewCardHTML`, mismo lenguaje visual que `buildScoreCardHTML` (clases `.result-card__*` reales) pero sin duración/estadísticas/finalización manual (una propuesta no tiene esos datos);
- el delta (`#b6-respond-correction-diff`) baja a trazabilidad secundaria debajo de las dos tarjetas, nunca sustituye a la propuesta completa;
- `Aceptar corrección`/`Rechazar` sin cambios estructurales (ya eran `flex:1` con la misma altura, primaria/secundaria).

Para quien propuso, y en Home/Historial: sin cambios de esta ronda (ya mostraban el oficial vigente + estado `CORRECCIÓN PROPUESTA` en ámbar, tratamiento ya alineado con "waiting").

---

## 4. P4 — Identidad incorrecta: copy + flujo continuo + componente único

### Copy

`¿Confirmás que no participó?` / `Sí, no participó` → `¿Estás seguro de que no fue [nombre real]?` / `Sí, no fue` (nombre dinámico, nunca hardcodeado).

### Flujo continuo

Antes: confirmar dejaba `Identidad cuestionada` en pantalla y obligaba a tocar `RESOLVER` para recién ahí buscar el reemplazo.
Ahora: al confirmar, se abre **directo** el mismo sheet de reemplazo (`openIdentityResolveSheet`) con el `issueId` que la propia RPC `report_identity_issue` ya devuelve (`{ok:true, issueId}`) — nunca una segunda llamada. `afterB6Action` sigue corriendo antes para que `analysisCurrent` (la `f` que el sheet necesita para excluir a los otros 3 participantes reales) quede sincronizado.

"Por identificar si no lo sabe" ya estaba cubierto sin cambios: `report_identity_issue` deja el slot como `Por identificar` inmediatamente al reportar, y el sheet se puede cerrar sin elegir reemplazo (la ventana real de 7 días para completar la identidad — `Experiencia_Inicial.md` §13.4 — es una regla de servidor cerrada, no se tocó ni se abrió una vía de abandono inmediato).

### Componente único de jugador

El sheet de reemplazo mostraba nombre + `@username` correctos (única superficie de identidad correcta en `@username` de esa ronda) pero **sin avatar ni Nivel** — era un componente de fila propio (`buildIdentityResolveRowHTML`), deliberadamente recortado en una ronda anterior. `search_players` ya trae `avatar_url`/`level_status`/`level_public` reales desde una migración previa — ya no hace falta esa limitación.

Se reemplazó por los mismos componentes que ya arman correctamente Buscar Jugadores/Elegir compañero-rival: `buildProvisionalRowHTML` para invitados, `buildPlayerRowHTMLFromServerRow` (→ `buildCompactPlayerRowHTML`) para cuentas reales — identidad siempre por `player_id`.

Se agregó una sección `Recientes` (jugadores reales con partido compartido, excluyendo a los ya presentes/invitados) reutilizando `PH.computeRecentRealPlayers` + `Auth.getPlayersCompact` — la misma función/patrón que ya usa RECIENTES de Cargar partido, sin ningún sistema nuevo.

---

## 5. P5 — Ajustes visuales

| Punto | Antes | Ahora |
|---|---|---|
| Home — barra bajo el Nivel calibrado | oculta siempre para cuentas V1 reales | recuperada (visible), **sin delta fabricado** — ver nota de producto abajo |
| Home — padding de Último partido | `22px 20px` | `16px` (unificado con el resto del sistema) |
| Resumen — grilla de nombres/sets | `align-items:center` desalineaba el borde entre parejas (celdas de alto distinto) | `align-items:stretch` + `.result-card__name` como flex centrado — bordes alineados |
| Reportar un error (CTA) | `REPORTAR UN ERROR`, `.btn-secondary` | `Reportar un error`, `.btn-secondary--danger` (rojo suave existente) |
| Hoja ¿Qué está mal? | 2 tarjetas pesadas (fondo+borde) | opciones livianas, sin card, con divisor simple entre ellas |
| Botón + | `stroke-width:2.5` | `stroke-width:3.2`, círculo intacto |

### Nota de producto — barra de Nivel sin delta (no es un bug, es una limitación real ya documentada)

Se investigó si existe una fuente real de "delta reciente" para una cuenta V1 calibrada (mu antes/después) y **no existe hoy del lado del cliente** — ya se había investigado esto mismo en la Ronda UX 25/09 (§M, ver el módulo EVOLUCIÓN DEL NIVEL BRAMU de Mi Perfil, que por el mismo motivo se oculta completo para cuentas calibradas en vez de simular). Fabricar un delta acá habría violado tanto "no fabricar una lectura sin evidencia" como "no reabrir fórmula/fuente de Nivel" (ambos del handoff). Se optó por: barra visible (relleno fijo, sin semántica de progreso-hacia-el-próximo-nivel) + píldora de delta oculta.

**Esto es una decisión visual que conviene validar con Sebastián en la próxima pasada física** — si el tratamiento no es el esperado, es un ajuste de producto, no requiere reabrir el motor de Nivel ni backend nuevo.

---

## 6. Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `bramulab/app.js` | Compañeros/Rivales (P1), editor de sets ×2 (P2), tarjeta comparativa oficial/propuesta (P3), identidad continua + sheet unificado (P4), barra de Nivel (P5) |
| `bramulab/index.html` | rótulo oficial/propuesta, bloque comparativo, sección Recientes del sheet de identidad, copy/clases de Reportar un error, trazo del +, cuarteto de versión |
| `bramulab/styles.css` | alineación de `.result-card__rows`, padding de Último partido, rótulos oficial/propuesta, opciones livianas de Reportar un error |
| `bramulab/store.js` | `BUNDLE_VERSION` bumpeado |
| `bramulab/sw.js` | `CACHE_NAME` bumpeado |
| `bramulab/version.json` | `bundle` bumpeado |
| `bramulab/propose-correction-editor.test.mjs` | **Nuevo.** 12 tests (guarda estática + simulación dinámica contra `ML`/`E` reales) para el editor de sets ×2 |

No se tocó `match-self-heal.js`, `match-validation.js` (fuera de un consumo ya existente), fórmula de Nivel/Ranking/Intelligence, Mis grupos, ni ningún archivo fuera de `staging`.

---

## 7. Tests

- **Suite Node completa:** `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs supabase/scripts/*.test.mjs` → **315/315 OK** (303 previas + 12 nuevas de esta ronda).
- **`tests.html`:** **1564/1564 tests OK — todo verde**, sin cambios respecto de la baseline (ninguna función pura de `match-load.js`/`engine.js` se modificó; solo se consumieron distinto desde `app.js`, que ese harness no carga).
- **Smoke boot de `index.html`:** sin errores de consola nuevos; `PLStore.BUNDLE_VERSION === '04.11-h12'`; pantalla de login renderiza normal. El único 404 observado (`env.generated.js`) es el mismo artefacto de build esperado en entorno local sin build, ya documentado en rondas anteriores.
- **Inspección de CSS real (DOM sintético en el navegador):** confirmado que `.result-card__name` queda `flex`+`center`, `.result-card__rows` en `stretch`, `.player-home-lastmatch` en `padding:16px`, `.report-error-option` sin fondo/borde con divisor entre opciones, `.btn-secondary--danger` con el rojo suave esperado, y el ícono `+` con `stroke-width="3.2"`.
- **Editor de sets:** los dos casos reportados del Laboratorio (§15.33) + una regresión de alta nueva de cero + un score final inválido real siguen bloqueado — los 4 en `propose-correction-editor.test.mjs`, contra las funciones puras reales de `match-load.js`/`engine.js` (nunca mocks).

No se repitieron pruebas manuales ya demostradas (h11 self-healing, tercer set, cambio de ganador) porque esta ronda no tocó esos caminos.

---

## 8. Bundle, commit y deploy

- **Bundle:** `04.11-h11` → `04.11-h12`, cuarteto completo (`index.html` 20 tags `?v=`, `sw.js` `CACHE_NAME`, `store.js` `BUNDLE_VERSION`, `version.json`), bumpeado una sola vez, al final.
- **Commit:** único, lógico, con causa raíz/archivos/tests en el mensaje.
- **Push:** `origin/staging`.
- **Deploy:** Vercel Staging — esta ronda toca `bramulab/`, dispara build real.

---

## 9. Riesgos residuales reales

- La barra de Nivel calibrado (P5) queda sin delta reciente por una limitación real de datos, no por decisión de diseño cerrada — ver nota de producto en §5. Puede necesitar un segundo ajuste visual tras la pasada física.
- El fix del editor de sets se aplicó también al editor de Cargar partido (mismo bug, no reportado en el Laboratorio) por prudencia — no se validó físicamente ese camino en esta ronda, solo por tests.
- La sección Recientes nueva del sheet de identidad depende de que existan partidos reales compartidos con jugadores registrados — con historial insuficiente, simplemente no aparece (comportamiento esperado, no un bug).

Ningún cambio de esta ronda tocó tablas/RPCs de Supabase — todo el trabajo fue frontend (`bramulab/`).

---

## 10. Decisiones abiertas

Ninguna decisión bloqueante. La única nota que amerita revisión de producto (no técnica) es la barra de Nivel sin delta — documentada en §5, no frenó el resto de la ronda.

---

## 11. Batería física para la próxima pasada — máximo 5 bloques

1. **Identidad canónica / Matu** — abrir a un mismo jugador real desde Buscar Jugadores, Compañeros y Rivales: avatar, `@usuario` y Nivel deben coincidir siempre.
2. **Corrección de resultado** — reabrir un set ya cargado (editor de sets o Proponer corrección) y modificar un solo lado, y por separado invertir ambos lados empezando por cualquiera; revisar que la pantalla de respuesta muestre oficial vs. propuesta con las dos tarjetas completas.
3. **Identidad incorrecta continua** — reportar que alguien no participó y confirmar que el flujo pasa directo a buscar/reemplazar sin tener que reabrir el partido.
4. **Home/Resumen/Reportar error** — revisar la barra bajo el Nivel calibrado (foto para la nota de producto §5), el padding de Último partido, la alineación del Resumen, y el nuevo tratamiento de Reportar un error.
5. **Regresión visual rápida del + y navegación principal** — confirmar que el botón central se ve igual de tamaño con el trazo más grueso, y que la navegación normal no se vio afectada.
