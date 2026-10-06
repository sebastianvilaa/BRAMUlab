# 145 — Resultado · Hotfix V04.37-h2 · Evolución (trazo) + avatares de Ranking

**Fecha:** 06/10/2026 · **Rama:** `staging` · **Base:** `1ddbe99` · **Bundle:** `04.37-h2` (APP_VERSION sigue `BRAMUlab V04.37`) · **Sin migración.**  
**SHA final:** el del commit que contiene este archivo (se informa al cerrar).  
**No tocado:** `main`, Production, BRAMUlive, cálculo/serie/Intelligence de Evolución, puntos/movimiento/posiciones/filtros del Ranking.

## 1. Evolución del Nivel — trazo
- La línea pasa a **celeste BRAMU** (`.evolution-chart__line { stroke: var(--accent-cyan) }`, `#199FFF`).
- El path ahora es una **curva suavizada**: `buildSmoothLinePath` (spline cúbico de Hermite con tangentes monotónicas, Fritsch–Carlson/PCHIP) en lugar de la polilínea. **Pasa exactamente por cada punto real**, no sale del rango de sus dos puntos vecinos (**sin overshoot**: no inventa máximos ni mínimos), los tramos planos quedan planos y un pico/valle real conserva su extremo; con 2 puntos es una recta.
- Sin cambios en puntos, ejes, `change30`, mejor Nivel, Intelligence, animación de entrada (`animateEvolutionLine` sobre el mismo `<path>`) ni dots/tooltips (no se agregó ninguno). El mismo estilo aplica al gráfico legacy (es la misma tarjeta).

## 2. Ranking — avatares reales
- **Causa confirmada:** `buildRankingRowHTML`/`buildUnrankedRowHTML` llamaban `buildGroupAvatarHTML(name)` **sin `playerId`**: resolvía contra el cache de Grupos (o por nombre) y siempre caía a iniciales.
- **Fix:** nuevo `buildRankingAvatarHTML(name, playerId)` + cache propio por cuenta (`rankingAvatars`, TTL 30 min; las URLs firmadas duran 24 h) y `resolveRankingAvatars()`: junta los `data-player-id` de las filas ya pintadas (clasificación territorial, Mi red y secciones sin posición), pide **UNA sola** llamada `Auth.getPlayersCompact(ids únicos faltantes)` (contrato batch vigente; nunca N+1; lo ya resuelto —incluso "sin foto"— no se vuelve a pedir) y reemplaza **solo el avatar** de esas filas en el DOM (no re-renderiza la lista: sin parpadeo, búsqueda/paginación intactas). Foto firmada real cuando existe; iniciales solo como fallback real (sin foto o sin `playerId`). **No depende de haber visitado Mis Grupos** (no usa `groupsServer`).
- Se dispara desde `wireRankingRowClicks`, que ya se ejecuta tras pintar cada lista de Ranking (incluye "cargar más" y búsqueda).

## 3. Tests
| Prueba | Resultado |
|---|---|
| **Nuevo** `bramulab/v0437-h2-evolucion-avatares.test.mjs`: trazo pasa por los puntos y conserva extremos/orden · **sin overshoot (300 series aleatorias, tramos de 40 muestras)** · bordes (2 puntos, planos, pico) · color cyan y línea limpia · `<img>` con URL real / iniciales sin foto · **batch: 50 filas con repetidos = 1 llamada, cache y no re-pedir sin foto** · cache por cuenta y TTL · cableado sin Grupos ni N+1 · versionado | **9/9** |
| Suite Node completa | **1073 tests · 1066 pass · 1 fail · 6 skip** (base 1064 · 1057 · 1 · 6) |
| `release-check.mjs` completo | **PASS** |

Única falla: `h23` (preexistente y ajena).

## 4. QA humano real — PASS

Captura real de Staging posterior al deploy h2:
- **Evolución:** línea celeste BRAMU visible; trazo suavizado aplicado; datos/Intelligence sin cambios.
- **Ranking:** avatares reales visibles para Seba, Esteban, Matu y Gusti; Pablito/Jona conservan iniciales como fallback donde no hay foto.
- **Race anual:** movimiento ↑/↓ ya había sido validado en la pasada anterior.
- **Actividad histórica:** validada en la pasada anterior.

**V04.37 queda CERRADA EN STAGING / PASS CENTRAL.**

Nota visual: la serie real de Nivel tiene oscilaciones frecuentes entre valores cercanos; por eso, aun con spline suave, conserva una silueta con muchos picos reales. Suavizar más exigiría dejar de pasar por cada valor registrado y convertir la línea en una tendencia aproximada, decisión que no se adopta en esta ronda para no distorsionar evidencia.
