# BRAMU Lab — Etapa 4
## v2.0 · Experiencia integral del jugador — Informe de entrega

**Estado:** implementado, commiteado, tagueado y verificado en producción. **No cerrado por cuenta propia** — pendiente de revisión externa de ChatGPT (código, informe y producción) y de la evaluación de Sebastián sobre la experiencia completa.
**Fecha:** 03 de septiembre de 2026
**Documento de origen:** `docs/bramulab/consolidados/BRAMU_Lab_Etapa_4_v2_Experiencia_Integral_Consolidado.md`
**Versión de partida:** v1.3.1 (commit `0f04fd5`)
**Versión entregada:** v2.0 (commit `9fcad8ca7221148268c4bcb7aa3b075f7cbd03d6`, tag `v2.0`)
**Aplicación tocada:** `bramulab/` únicamente. `bramulab-partidos/` permanece intacta en v14 (verificado, ver §14).

---

## 1. Resumen ejecutivo

La Etapa 4 reconstruye el Home del jugador ("Mi pádel") como un conjunto coherente en vez de una suma de piezas beta. Se eliminó la identidad demo vieja (categoría/ranking/tendencia/badge "DATOS DEMO · BETA") y la tarjeta independiente "Forma reciente"; en su lugar hay una **Tarjeta de jugador** con Nivel BRAMU (demo, centralizado), una franja de **Hitos personales** determinísticos, una tarjeta de **Último partido** rediseñada (con la forma reciente integrada como volanta), **Actividad** y **Efectividad** de los últimos 30 días con visual propio (barras y donut), y las 4 métricas pequeñas actualizadas (Racha actual, Partidos totales, Mejor compañero, Rival más enfrentado).

Se refinó visualmente (sin tocar su lógica de validación) el teclado numérico de "Cargar partido jugado" y el ancho de las hojas inferiores en tablet/escritorio. Se reemplazaron los emojis de interfaz del Home por SVG propios, y se retiró la acción COMPARTIR del Resumen (capacidad técnica conservada, sin exponerse).

Toda la lógica nueva vive en funciones puras y testeadas (`player-home.js`): 18 tests nuevos, suite completa en **432/432 verde**. Se verificó manualmente en mobile (390×844), tablet (834×1112) y escritorio (1366×768), incluyendo un recorrido real de principio a fin (identificar → cargar partido con selector de jugadores y teclado → Resumen sin Compartir → Home actualizado → editar sin duplicar → Historial ordenado → partido en vivo con franja de continuación → Punto por punto y Game por game sin regresiones).

Se publicó en producción (GitHub Pages) y se confirmó en vivo que la PWA detecta v2.0 disponible, actualiza y sirve la versión nueva correctamente.

---

## 2. Comparación antes (v1.3.1) / después (v2.0)

| Aspecto | v1.3.1 | v2.0 |
|---|---|---|
| Identidad del jugador | Pastilla con Categoría/Ranking/Tendencia demo + badge "DATOS DEMO · BETA" | **Tarjeta de jugador**: avatar más grande, nombre, cantidad real de partidos, bloque NIVEL BRAMU (demo) con variación y barra de progreso a todo el ancho |
| Forma reciente | Tarjeta independiente con 5 puntos V/D | Integrada como volanta dentro de "Último partido"; el último punto tiene un glow sutil de victoria/derrota |
| Último partido | Resultado + meta + compañero/rival en texto + link "VER DETALLE" | Volanta de forma + fecha `02SEP · 22:30` + lugar arriba; título + badge VICTORIA/DERROTA; resultado protagonista; parejas secundarias; chevron; toda la tarjeta es tocable |
| Hitos personales | No existían | Franja horizontal, máximo 2, solo si hay algo justificable por el historial real; oculta por completo si no hay ninguno |
| Actividad | "Partidos este mes" (mes calendario) como métrica chica | Tarjeta propia: ventana móvil de 30 días, 4 bloques cronológicos, lima=victorias/apagado=derrotas, muestra total |
| Efectividad | No existía | Tarjeta propia: donut con % de victorias sobre partidos considerados en 30 días, `67% · 6 de 9` |
| Métricas pequeñas | Partidos este mes, Mejor racha, Compañero frecuente, Rival más enfrentado | Racha actual (consecutiva, no la mejor histórica), Partidos totales, **Mejor** compañero (por efectividad con muestra mínima, no el más repetido), Rival más enfrentado |
| Header del Home | "Configurar partido" + campana emoji 🔔 | Sin "Configurar partido" (acceso redundante); campana SVG propia |
| Ícono "Tu Momento" | Emoji ✨ | SVG propio |
| Selector de jugadores (hoja) | Ancho fijo 480px en cualquier pantalla | Hasta 640px en tablet/escritorio; avatares/espaciado más generosos |
| Teclado numérico (Cargar partido) | Teclas grandes, ancho completo del panel (768px en desktop), Borrar/Siguiente con el mismo peso visual que los números | Grid interno acotado a 360px centrado, teclas más compactas, Borrar/Siguiente sin fondo/borde (secundarias), foco propio (`:focus-visible`) en vez del aro azul del navegador |
| Resumen (Compartir) | Visible en partidos manuales y en vivo | Retirado en ambos casos (botón queda en el markup, oculto, capacidad técnica intacta) |
| Versión | v1.3.1 | v2.0 |

---

## 3. Archivos creados y modificados

No se creó ningún archivo/módulo nuevo — toda la lógica nueva se apoya en los módulos puros existentes, según pide el consolidado (§20).

**Modificados:**
- `bramulab/player-home.js` — 6 funciones puras nuevas (§6 de este informe).
- `bramulab/app.js` — reescritura de la orquestación del Home (`renderPlayerHome` y sub-renders), nuevo formateador de fecha compacta, wiring de la tarjeta de Último partido, `LEVEL_DEMO` reemplaza a `PLAYER_PROFILE_DEMO`.
- `bramulab/index.html` — Home reestructurado, íconos SVG del header, botón Compartir del Resumen oculto.
- `bramulab/styles.css` — componentes nuevos (Hitos, Tarjeta de jugador, Último partido, Actividad, Efectividad), refinamiento de teclado y hojas inferiores; se restauraron 4 reglas (`.pastilla--identity` y afines) que Perfil todavía necesita (ver §10, hallazgo corregido durante esta misma etapa).
- `bramulab/tests.html` — 18 tests nuevos para las agregaciones de Etapa 4.
- `bramulab/store.js`, `bramulab/version.json`, `bramulab/sw.js` — versión `v1.3.1` → `v2.0` (los tres archivos, en conjunto, como exige el propio comentario del service worker).

**Sin cambios:** `engine.js`, `match-load.js`, `stats.js`, y todo `bramulab-partidos/`.

---

## 4. Componentes eliminados, fusionados y reemplazados

**Eliminados:**
- Pastilla de identidad demo (Categoría/Ranking/Tendencia/badge "DATOS DEMO · BETA").
- Tarjeta independiente "Forma reciente".
- Link "Configurar partido" del header del Home.
- Botón visible "COMPARTIR" del Resumen (capacidad técnica conservada oculta).
- Emojis de interfaz del Home (campana 🔔, chispa ✨ de "Tu Momento").
- Widget "Partidos este mes" y "Mejor racha" (reemplazados, ver abajo).

**Fusionados:**
- Los 5 indicadores de forma reciente pasaron de la tarjeta independiente a la volanta de "Último partido".

**Reemplazados:**
- Identidad demo → Tarjeta de jugador (Nivel BRAMU).
- "Partidos este mes" → Actividad (30 días móviles).
- "Mejor racha" (histórica) → "Racha actual" (consecutiva desde el partido más reciente).
- "Compañero frecuente" (el más repetido) → "Mejor compañero" (el de mayor efectividad, con muestra mínima de 3).

---

## 5. Decisiones visuales tomadas (sin especificación cerrada)

El consolidado autoriza resolver decisiones visuales menores eligiendo la alternativa más coherente y documentarla. Se tomaron estas:

1. **Ancho de las hojas inferiores en tablet/escritorio:** 640px (entre los 480px "compactos" de Inicio/Resumen y los 768px "de contenido" de Análisis/Historial) — son listas de acciones cortas, no pantallas de lectura larga.
2. **Bloques de Actividad:** 4 bloques de ~7.5 días cada uno dentro de la ventana móvil de 30 días (30/4), mostrados de izquierda a derecha del más antiguo al más reciente.
3. **Cálculo de "Mejor compañero":** efectividad = victorias / partidos jugados juntos (no solo partidos con resultado decidido) — simplifica y evita doble contabilidad; empate de efectividad se resuelve por más partidos juntos y, si persiste, alfabéticamente.
4. **Hitos personales:** 3 reglas deterministas, evaluadas en este orden, máximo 2 a la vez: (a) estar a una victoria de igualar la mejor racha histórica; (b) buena forma reciente (≥66% en una ventana de hasta 5 partidos, mínimo 3) con el compañero más frecuente; (c) el período de 30 días actual supera estrictamente a todos los períodos de 30 días anteriores (nunca en empate, y solo si existe al menos un período previo con el que comparar).
5. **Nivel BRAMU demo:** `5.3` con variación `↑ 0.2` y barra de progreso al 62% — valores fijos, documentados como reemplazables en un único objeto (`LEVEL_DEMO` en `app.js`), igual criterio que ya usaba `PLAYER_PROFILE_DEMO`.
6. **Glow del indicador actual en "Último partido":** brillo que respira (`filter: brightness`), no cambio de color ni parpadeo — mismo lenguaje que Punto de Oro/Star Point. Respeta `prefers-reduced-motion`.
7. **Teclado numérico:** ante la disyuntiva de cuánto reducir, se priorizó marcador visible, una mano y poco peso vertical (consolidado §15) — grid interno acotado a 360px, teclas de 10px de padding vertical (antes 14px), Borrar/Siguiente sin fondo ni borde.
8. **Toda la tarjeta de "Último partido" es un `<div>` clickeable** (no un `<button>`), igual patrón que `.history-item` ya existente — evita anidar un botón real dentro (el estado vacío muestra un CTA visual, no un control interactivo separado).

---

## 6. Reglas de datos implementadas (player-home.js)

Todas puras, sin DOM, documentadas con comentarios inline y cubiertas por tests:

- `computeCurrentStreak(matches, playerName)` — racha de victorias consecutivas contando desde el partido más reciente hacia atrás (se corta en la primera derrota o partido sin definición).
- `computeBestPartner(matches, playerName, minSample=3)` — compañero de mayor efectividad con muestra mínima; `null` si nadie la alcanza.
- `computeActivity30d(matches, playerName, nowDate)` — 4 bloques cronológicos de la ventana móvil de 30 días, con conteo de victorias/derrotas por bloque.
- `computeEffectiveness30d(matches, playerName, nowDate)` — % de victorias sobre partidos con resultado definido en los últimos 30 días; `pct: null` sin muestra.
- `computeThirtyDayPeriodCounts(matches, nowDate)` — conteo por períodos de 30 días sin solapar, anclado a "ahora" (helper interno del hito de período más activo).
- `computeHitos(matches, playerName)` — hasta 2 hitos deterministas (ver §5.4).

---

## 7. Tests automáticos y resultado

- Suite completa: **432/432 en verde** (414 preexistentes + 18 nuevos de Etapa 4).
- Los 18 tests nuevos cubren: racha actual (con y sin racha activa), mejor compañero (muestra mínima, desempate por efectividad y por cantidad), actividad y efectividad de 30 días (ventana fija con fecha explícita, para no depender de cuándo corre el test), períodos de 30 días sin solapar (incluida una fecha futura, que nunca debe contarse), y las 3 reglas de Hitos por separado (cada una aislada para no disparar las otras dos) más el tope de 2.
- Se corrió el arnés en `tests.html` sirviendo `bramulab/` con un servidor HTTP local (`.claude/dev-server.py`, ya existente en el repo) — necesario porque `file://` no ejecuta JavaScript en el entorno de verificación.

---

## 8. Pruebas manuales por viewport

Con datos sintéticos aislados (sembrados directamente en `localStorage` de un perfil de navegador separado, nunca en el dispositivo de Sebastián), se verificó:

**Mobile (390×844):**
- Estado con 7-8 partidos: Hitos, Tarjeta de jugador, Último partido (volanta + fecha + lugar + glow), Tu Momento, Actividad/Efectividad y las 4 métricas — todos con datos reales y coherentes entre sí.
- Estado vacío (0 partidos): Hitos oculto, Último partido con CTA, Actividad con 4 barras planas, Efectividad con donut vacío (sin punto residual), Racha actual "—", Partidos totales "0".
- Estado con 1 partido, sin hora cargada y con nombres largos: fecha sin hora inventada, volanta de 1 solo punto, nombres largos ajustan el layout sin romperlo.
- Recorrido real completo: `+` → Registrar partido → Cargar mi partido jugado → selector de jugadores (recientes + alta sin cuenta) → teclado numérico (2 sets) → Guardar → Resumen sin Compartir → Volver al inicio → Home actualizado inmediatamente (Hitos, racha, mejor compañero y actividad recalculados).
- Editar partido: cambiar un resultado y guardar — el Historial y el Home reflejan el cambio sin duplicar (`matchId` estable, mismo criterio que v1.3).
- Partido en vivo (Punto por punto): iniciado, se registraron puntos, se volvió al Home tocando el logo del header — la franja "PARTIDO EN CURSO" aparece con prioridad sobre Hitos, como pide el consolidado.
- Game por game: iniciado y con games registrados, sin errores de consola.

**Tablet (834×1112):** Home centrado a 768px con margen simétrico (verificado por `getComputedStyle`, no solo visualmente); hoja "Registrar partido" y selector de jugadores centrados a 640px; teclado numérico con grid acotado a 360px (ya no ocupa el ancho completo del panel).

**Escritorio (1366×768):** mismo layout de tablet, usable, sin desbordes horizontales.

**Historial:** orden por `playedAt` descendente confirmado con 7 partidos de fechas dispersas (incluye "cargar hoy con hora antes que otro de hoy mismo con hora más tarde" — el orden usa fecha+hora completa, no solo el día).

**Perfil / Ranking:** sin regresiones (ver hallazgo corregido en §10).

**Consola:** sin errores propios de la app en ningún viewport (los únicos mensajes observados fueron `504` de recursos externos bloqueados por la sandbox de verificación — Google Fonts y el chequeo de versión offline — y un rechazo esperado de Wake Lock por pestaña no visible; ninguno es atribuible al código de Etapa 4).

---

## 9. Comprobación de los 19 criterios de aceptación (§24 del consolidado)

1. ✅ Abrir BRAMU Lab lleva al Home correcto (`bootDefaultScreen` → partido activo o `openPlayerHome`).
2. ✅ El Home ya no muestra la composición beta vieja.
3. ✅ La tarjeta de jugador responde a la nueva jerarquía.
4. ✅ Forma reciente dejó de ser tarjeta independiente.
5. ✅ Último partido muestra el partido correcto con la jerarquía definida.
6. ✅ Actividad, Efectividad y las 4 métricas usan datos reales (verificado con historial sintético variado).
7. ✅ Hitos y Tu Momento no inventan (umbral de 3 partidos, reglas deterministas, tests dedicados).
8. ✅ Las hojas inferiores se sienten parte de la misma aplicación (ancho 640px en tablet/escritorio).
9. ✅ El selector de jugadores no aparece como modal angosto desconectado.
10. ✅ El teclado dejó de verse como bloque genérico sobredimensionado.
11. ✅ El Resumen no muestra Compartir.
12. ✅ Guardar y editar actualizan Home e Historial sin duplicados (confirmado con un guardado y una edición reales).
13. ✅ El partido en curso se recupera y se representa correctamente (franja con prioridad, confirmado con Punto por punto).
14. ✅ La iconografía del Home no depende de emojis.
15. ✅ Mobile, tablet y escritorio son utilizables.
16. ✅ No hay regresiones en Punto por punto ni Game por game (ambos probados tras los cambios).
17. ✅ La suite está en verde (432/432) y la consola no presenta errores propios.
18. ✅ La actualización PWA ofrece y carga v2.0 — **verificado en producción real**, no solo en el entorno local: el navegador de verificación tenía una copia cacheada de v1.3.1, la app detectó v2.0 disponible, se tocó "ACTUALIZAR" y el footer pasó a mostrar `v2.0` correctamente.
19. ✅ BRAMU Lab Partidos v14 permanece intacta (ver §14).

---

## 10. Limitaciones reales y deuda técnica

- **Hallazgo propio corregido durante esta misma etapa:** al reescribir el CSS del Home se habían borrado por error 4 reglas (`.pastilla--identity`, `.pastilla--identity-compact`, `.pastilla-identity__info`, `.pastilla-identity__name`) que la pantalla **Perfil** todavía usa (esa pantalla no fue tocada por el consolidado). Se detectó con una auditoría cruzada de clases/IDs entre HTML/CSS/JS antes de cerrar la etapa, se restauraron esas 4 reglas con un comentario explicando que ahora son exclusivas de Perfil, y se verificó visualmente que Perfil vuelve a verse correctamente. No llegó a publicarse roto.
- El botón "Volver" del Historial sigue yendo a la pantalla tradicional de Configurar partido (`showView('setup')`), no al Home — comportamiento preexistente a esta etapa (Historial se abre tanto desde el Home como desde el menú de Configurar partido, y no hay todavía un registro de "desde dónde se abrió" para decidir el destino de vuelta). No se tocó por estar fuera del alcance explícito del consolidado y para no arriesgar una regresión en el otro punto de entrada.
- El chequeo automático de versión (`version.json` con `cache:'no-store'`) y Google Fonts no pudieron probarse con red real dentro del entorno de verificación (sandbox sin acceso a internet general); sí se verificó el mecanismo completo contra la producción real de GitHub Pages (ver §9, criterio 18), que es la prueba que importa.
- Nivel BRAMU (`5.3 ↑ 0.2`, barra al 62%) sigue siendo enteramente demo, tal como exige el consolidado — no hay algoritmo real todavía.
- No se implementó nada de la sección "Fuera de alcance" del consolidado (cuentas, `@username`, QR, validación entre participantes, pestañas del Historial, rediseño global, etc.) — se respetó el límite explícito.

---

## 11. Commit final y tag

- Commit: `9fcad8ca7221148268c4bcb7aa3b075f7cbd03d6` — *"BRAMU Lab v2.0 · Home integral del jugador"*.
- Tag: `v2.0`, apuntando exactamente a ese commit.
- Rama: `main`, pusheada a `origin/main`.

---

## 12. Estado del deploy de GitHub Pages

- El push disparó el workflow `pages build and deployment`, verificado con `gh run list`: pasó de `in_progress` a `completed / success`.
- Se navegó la URL de producción real después del deploy y se confirmó `v2.0` en el footer, sin errores de consola.

---

## 13. URLs verificadas

- App: `https://sebastianvilaa.github.io/BRAMUlab/bramulab/` — v2.0 confirmada en producción.
- Marcador congelado (no tocado): `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/` — v14 confirmada, intacta.
- Repositorio: `https://github.com/sebastianvilaa/BRAMUlab` (commit y tag arriba).

---

## 14. Confirmación explícita — `bramulab-partidos/` intacta

- `git status` y `git diff --stat` confirman **cero archivos modificados** dentro de `bramulab-partidos/` en todo el trabajo de esta etapa.
- Se navegó la URL de producción de `bramulab-partidos/` después del deploy: sigue mostrando `v14` en el footer, con su propia pantalla de Configurar partido intacta.
- Las cachés de ambas aplicaciones son independientes por diseño (prefijos `bramulab-vN` vs `bramulab-partidos-...` en Cache Storage) — no se tocó esa separación.

---

## 15. Instrucciones de prueba para Sebastián (recorrido de ~10 minutos)

No hace falta entender nada técnico — con abrir la app alcanza. Si tenías la app instalada como acceso directo, puede pedirte actualizar solo: aceptá "ACTUALIZAR" cuando aparezca.

1. Abrí BRAMU Lab. Deberías caer directo en tu Home ("Mi pádel"), con tu nombre e historia real.
2. Mirá arriba de todo: si tenés algo justificado por tu historia (una racha, un buen momento con alguien, tu período más activo), vas a ver una franja chica con esa frase. Si no hay nada que justifique un hito, esa franja no aparece — está bien así.
3. Revisá la tarjeta con tu nombre: debería mostrar cuántos partidos tenés cargados en total, y a la derecha un número de Nivel BRAMU (ese número todavía es de prueba, no es tu nivel real).
4. Debajo, "Último partido" tiene que mostrar tu partido más reciente de verdad, con el resultado grande y quién jugó. Tocá toda la tarjeta — te tiene que llevar al detalle del partido.
5. Segui bajando: "Actividad" (barras de los últimos 30 días) y "Efectividad" (el círculo con el porcentaje) — fijate que los números tengan sentido con lo que jugaste últimamente.
6. Cargá un partido nuevo con `+` → "Cargar mi partido jugado". Elegí compañero y rivales, cargá el resultado con el teclado nuevo (debería sentirse más chico y prolijo que antes) y guardá. En el Resumen ya no debería aparecer el botón "Compartir".
7. Volvé al inicio y confirmá que tu Home se actualizó con el partido nuevo al toque.
8. Si tenés un partido en vivo pendiente en otro momento, probá volver al Home tocando el logo (no el menú) — tiene que aparecer una franja verde arriba de todo para continuarlo, sin perder el progreso.

Si algo se ve raro, mandame captura y en qué paso pasó — no hace falta que lo describas técnicamente.

---

## 16. ¿Lista para revisión externa?

**Sí.** El código está commiteado, tagueado como `v2.0`, pusheado a `main`, y verificado en producción real de GitHub Pages (incluyendo el propio mecanismo de actualización de la PWA). `bramulab-partidos/` quedó confirmada intacta en v14. Este informe queda a la espera de:

1. La revisión de ChatGPT sobre este documento, el código y la producción.
2. La evaluación de Sebastián sobre la experiencia completa siguiendo el recorrido de §15.

No se avanza a Etapa 5 hasta esa doble aprobación.
