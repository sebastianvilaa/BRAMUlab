# BRAMUlab — Resultado del sistema visual unificado post-h20

**Fecha:** 27-28/09/2026
**Rama:** `staging`
**Baseline previa:** BRAMUlab V04.11 / bundle `04.11-h20`
**Bundle resultante:** BRAMUlab V04.11 / bundle `04.11-h21`
**Fuente operativa:** `59_Handoff_Sistema_Visual_Unificado_h21_27SEP.md` (única tanda).

---

## 1. Cambios

### Principio de sistema / color único
Ámbar = pendiente de resolver, verde = victoria/acción afirmativa, rojo = derrota/error, neutro = mantener/secundario. Aplicado de forma consistente en Home, Último partido, carrusel, Historial y Resumen (ver detalle por punto abajo).

### Punto 2 — Home, carrusel superior
Se deshizo la fusión de h19/57: **TU MOMENTO ya no vive en el carrusel** — vuelve a su tarjeta propia debajo de Último partido. El carrusel queda exclusivo para acciones/correcciones/espera reales, oculto por completo sin ningún item. Las tarjetas pasan a ancho parcial (60% móvil / 40% ≥480px, mismo criterio de tamaño que `.player-home-hitos__chip`, la tarjeta celeste histórica), dejando asomar la siguiente para comunicar que hay carrusel.

### Punto 3 — Home, Último partido
Los tres estados operativos (`CONFIRMAR PARTIDO`, `ESPERANDO VALIDACIÓN`, `CORRECCIÓN...`) pasan a ámbar (antes `CONFIRMAR PARTIDO` usaba el acento lima de "accionable"). El resultado deportivo (VICTORIA/DERROTA) conserva su verde/rojo propio, sin mezclarse con el estado operativo.

### Punto 4 — Home, Nivel BRAMU (investigado antes de tocar código)
La animación de entrada de la barra (restaurada en h19) sigue intacta. Se investigó el delta de Nivel con `git log -S`/`git show`: **no existe hoy un lector client-side de `level_events`** para una cuenta V1 calibrada — el mismo hallazgo ya documentado dos veces antes (Ronda UX 25/09 §M, ronda h11). No se fabricó ni infirió ningún delta; el chip sigue oculto (`--flat`) hasta que exista esa fuente real, tal como pide el documento ("sin cambio real disponible: no mostrar nada").

### Punto 5 — Resumen, metadata
Cabecera reducida a exactamente 2 líneas: línea 1 autoría/estado (`Cargado por X · Confirmado por Y` / `· Por confirmar` / `· Te toca confirmar`), línea 2 fecha+partido en un solo estilo tipográfico (`27 SEP 26 · 20:28 · Clásico · Punto de Oro`, formato/sistema en sentence/title case, no mayúscula sostenida).

### Punto 6 — Resumen, partido nuevo pendiente
`#b6-status-banner` pasa a compartir el mismo patrón `.b6-correction-card` (borde/halo ámbar) que la corrección post-validación — "validar un partido nuevo" y "responder una corrección" son la misma familia. La fila de acciones (`Reportar un error` izquierda, `Confirmar resultado` derecha, mismo tamaño, outline) queda DENTRO de la tarjeta en vez de un botón suelto aparte.

### Punto 7 — Resumen, corrección sobre partido oficial
Orden de botones invertido: `Mantener resultado actual` (izquierda, neutro) / `Aceptar corrección` (derecha, verde) — "Rechazar" retirado de todo el copy visible (el diálogo de confirmación y el toast de éxito también se actualizaron).

### Punto 8 — Resumen, partido oficial sin pendiente
Se retiraron `VOLVER AL INICIO` (redundante con la bottom nav) y la opción `OCULTAR PARTIDO` del Resumen. `Reportar un error` pasa a vivir, por defecto, al final del contenido principal (después de Notas privadas, antes del logo de cierre) y se reubica dinámicamente dentro de la tarjeta de confirmación o de corrección cuando corresponde — mismo elemento único en los tres casos, nunca duplicado.

### Punto 9 — Historial, pestañas
Se recuperaron las pestañas visibles (`#history-tabs`, antes forzadas a `hidden`), ahora con la taxonomía **Todos / Pendientes / Victorias / Derrotas / Ocultos** y conteos reales. Nuevas funciones puras en `player-home.js` (`classifyHistoryStatusTab`, `filterHistoryByStatusTab`, `computeHistoryStatusTabCounts`), compuestas sobre helpers ya existentes (`getPlayerTeam`, `matchResultForPlayer`) y sobre `hasActiveCorrectionWindow` (extraída de `computeHomePendingCarouselItems` para no duplicar la fórmula de ventana de 3 días). El swipe horizontal entre pestañas (`initHistorySwipe`, deshabilitado desde que las pestañas viejas se ocultaron) queda **re-habilitado**, apuntando a la taxonomía nueva.

### Punto 10 — Historial, ocultar / volver a mostrar
Sin backend nuevo: se reutiliza `Matches.hideMatchForMe` (el mismo RPC `hide_match_for_me` que antes vivía en el botón de Resumen, ahora retirado de ahí). Tap corto sigue abriendo Resumen; **long press** (touch, con cancelación si el dedo se desplaza más de 10px, y supresión del click sintético posterior) o **click derecho** en desktop ofrece `Ocultar partido` / `Volver a mostrar` según `m.hidden`. Solo disponible para partidos server-backed ya sincronizados (nunca un borrador de outbox, que no tiene todavía un match real del lado del servidor). `getDisplayHistory`/`buildDisplayHistory` ganaron un parámetro opt-in `includeHidden` (default `false`, cero cambio para cualquier otro llamador) para que la pestaña Ocultos tenga datos reales.

### Punto 11 — Historial, badges
`.history-item__badge--action` deja de ser lima sólido y pasa a ámbar, alineado con la regla única del sistema.

---

## 2. Tests

- **Suite Node completa:** `node --test bramulab/*.test.mjs` → **365/365 OK**. Incluye el nuevo `h21-sistema-visual-unificado.test.mjs` (16 tests focales en puntos 9/10: taxonomía de pestañas pura vía vm, render de `#history-tabs`, `includeHidden` opt-in, swipe re-habilitado, long press/click derecho, retiro de "Ocultar partido" de Resumen, quartet de bundle) y actualizaciones de supersedencia en `h16`/`h17`/`h19`/`h20` para las decisiones que esta ronda revierte explícitamente (fusión del carrusel con TU MOMENTO, apilado de Aceptar/Rechazar, wording "Rechazar", clases `.btn-secondary` en Reportar un error).
- **`tests.html`** (batería de módulos puros, navegador): **1565/1565 OK**, sin regresión (no carga app.js/index.html, no ejercita directamente los cambios de esta ronda).
- **Smoke boot:** `index.html` local carga sin errores nuevos de consola/red; bundle `04.11-h21` confirmado en la petición real de `app.js`. Único error observado (`env.generated.js → 404`) es preexistente/ambiental.
- Los tests estructurales verifican markup/lógica/reubicación — **no reemplazan** una revisión visual real.

---

## 3. Commit / deploy

- Se sincronizó `staging` con varios commits de Central llegados durante la ronda (`a1491fa` hotfix h20 de copy, `ad33421` cierre de decisiones legales V1, y una cadena documental de "Grupos BRAMU" hasta `fed7d3a`) — ninguno con conflicto real contra este trabajo (todos documentales o de copy, sin tocar los mismos archivos de código).
- Commit único lógico sobre `staging`: `5d52bc5` (rebaseado sobre `fed7d3a`).
- Push a `origin/staging` (`fed7d3a..5d52bc5`).
- El push dispara el `ignoreCommand` de `bramulab/vercel.json` (compara `HEAD^`↔`HEAD` dentro de `bramulab/`); esta ronda modifica archivos de `bramulab/`, así que dispara el único deploy intencional de BRAMUlab Staging. **No se pudo confirmar el resultado del build en vivo desde acá** (mismo bloqueo ya documentado en la ronda anterior): el alias de Staging redirige a un login de Vercel (Deployment Protection), y este agente no tiene ni debe usar credenciales de Vercel del usuario. Confirmar el deploy verde queda para Central/Work.

---

## 4. Desvíos / decisiones explícitas

1. **Punto 4 (delta de Nivel):** no implementado, por falta de dato real (tercera investigación negativa, ver arriba) — no es un desvío de alcance, es exactamente lo que el propio documento pide hacer ante esa situación.
2. Ningún otro punto (2, 3, 5-11) se desvió del texto del documento 59.
3. Punto 13 (fuera de alcance) respetado: no se tocó Mis grupos, backend/Supabase, main, Production, BRAMUlive, Ranking, Intelligence, fórmula de Nivel, lógica de ocultar partido (se reutilizó tal cual) ni la semántica compartida de los partidos.

---

**PENDIENTE DE REVISIÓN VISUAL DIRECTA DE SEBASTIÁN**
