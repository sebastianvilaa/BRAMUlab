# BRAMUlab V02.9.1
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.9 (commit `825d104`, tag `BRAMUlab_V02.9`).
**Origen de esta ronda:** instrucciones detalladas dadas directamente en el chat (micro-ronda de ajuste visual sobre 3 detalles finos detectados en la revisión de V02.9) — sin `Consolidado` propio, documentadas en este mismo Informe.
**Estado:** publicado en producción.

Tres correcciones puntuales, exclusivamente visuales: el aro de Efectividad recupera presencia, el encabezado de Último partido se reordena en 2 líneas, y la línea de jugadores de Historial baja de jerarquía frente al resultado. Nada de lógica funcional tocado; ningún archivo fuera de `bramulab/app.js`/`styles.css` (más `store.js`/`sw.js`/`version.json` de versión).

---

## 1. Matriz requisito → implementación → prueba

| # | Requisito | Implementación | Prueba |
|---|---|---|---|
| 1 | Efectividad: aro demasiado fino; mantener animación y halo nítido/sutil sin blur; engrosar apenas el trazo principal; no volver pesado ni difuso | Trazo principal y aro de fondo `1.5px→2px`. El halo sube en la misma proporción (`2.2px→2.7px`) para conservar el mismo margen (~0.35px por lado) que ya tenía sobre el trazo anterior — si se hubiera dejado en 2.2px, el trazo más grueso lo habría tapado casi por completo. Opacidad del halo sin cambios (0.16): el pedido era el trazo, no el halo. Mismo mecanismo de 2 círculos concéntricos sin filtro y misma animación de V02.9, sin tocar | Computed style confirma `stroke-width` 2px (trazo/track) y 2.7px (halo), `opacity` 0.16 (halo) sin cambios. Visual real a 0% y 50% (mobile 375px y desktop 1024px): aro con más presencia, sin leerse pesado ni difuso |
| 2 | Último partido: reordenar encabezado — línea 1 título+fecha/hora, línea 2 forma+VICTORIA/DERROTA; mantener resto de la tarjeta (resultado protagonista, jugadores abajo-izquierda, formato/sistema abajo-derecha) | `.player-home-lastmatch__top` pasa de layout de 2 columnas (izquierda: forma+título+badge / derecha: fecha) a 2 filas apiladas: `__row1` (título + fecha/hora) y `__row2` (forma + badge). Se retira la clase `.player-home-lastmatch__heading` (ya no aplica, sustituida por las 2 filas nuevas). Nada más de la tarjeta (score, teamsrow, meta de formato/sistema, chevron) se tocó | Manual (mobile 375px y desktop 1024px): "ÚLTIMO PARTIDO 07SEP · 17:28" en la línea 1, puntitos de forma + "VICTORIA"/"DERROTA" en la línea 2, resultado/jugadores/CLÁSICO·PUNTO DE ORO idénticos a V02.9. Sin overflow horizontal |
| 3 | Historial: bajar jerarquía de la línea de jugadores (menos peso/contraste); resultado sigue protagonista; pareja propia puede seguir destacada pero más sutil; rivales más suaves | `.history-item__teams` baja de `font-weight:800` (heredando color blanco pleno del body) a `font-weight:700` + `color:var(--paper-dim)` como base — esto ya suaviza al rival sin regla aparte. En partidos PROPIOS, se deja de colorear al equipo GANADOR (`m.winnerTeam`, redundante con el badge VICTORIA/DERROTA de arriba) y pasa a colorearse la pareja PROPIA (`PH.getPlayerTeam`) con los mismos tokens de equipo (verde/azul) — sigue "destacada" pero ya no duplica la señal del badge. En Observados (sin badge propio) se mantiene sin cambios: sigue coloreando al equipo ganador junto con "GANÓ", único lugar donde vive ese dato | Manual: 2 partidos cargados (una victoria, una derrota) — en AMBAS cards "Seba / Fernan" (pareja propia) queda en lima y "Gusti / Esteban" (rival) en gris apagado, sin importar quién ganó cada partido — confirma que el color ahora sigue a "propia", no al ganador. Resultado (score 20px/800) sigue siendo claramente el elemento más protagonista de la card |

---

## 2. Verificación visual real

- **Efectividad**: `getComputedStyle` de trazo/halo antes y después del cambio (2px/2.7px, opacidad de halo sin cambios), más comparación visual en 0% (solo track) y 50% (arco real) — en ambos casos mobile (375px) y desktop (1024px, no solo el ancho angosto por defecto del panel de previsualización).
- **Último partido**: recorrido real completo (cargar partido → Home) en mobile y desktop, confirmando las 2 líneas del encabezado y que el resto de la tarjeta (score, teams, meta CLÁSICO/PUNTO DE ORO, chevron) no cambió respecto de V02.9.
- **Historial**: 2 partidos reales cargados por la UI (uno ganado, uno perdido) contra los mismos rivales, para aislar el efecto sin depender de qué equipo ganó cada uno — confirmado que "propia" se mantiene coloreada en ambos casos y "rival" se ve uniformemente más apagada.
- **Regresión**: `document.body.scrollWidth === window.innerWidth` en 375px sin overflow nuevo; sin errores de consola atribuibles a esta ronda.

---

## 3. Tests automáticos

**571/571 tests OK — todo verde** (`tests.html`), sin cambios respecto de la base V02.9. Ronda exclusivamente de CSS + reordenamiento de markup/clases en `app.js` (`renderPlayerLastMatchCard`, `renderHistory`) — ninguna función de `engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js` tiene cambios de lógica, salvo el string `APP_VERSION` de `store.js`.

---

## 4. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.9"` → **`"BRAMUlab V02.9.1"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v02-9` → **`bramulab-v02-9-1`**.
- **Commit de implementación (código):** `0d2f6c82b0c3e58812495e49b6dcc00868e3656e`.
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 5. Hash exacto y tag

- Commit de implementación (código): `0d2f6c82b0c3e58812495e49b6dcc00868e3656e`.
- Commit de este informe: PENDIENTE_HASH_INFORME.
- Tag `BRAMUlab_V02.9.1` apuntará al commit inmediatamente posterior a este, que registra ambos hashes de arriba.

---

## 6. Qué no se tocó

Nivel BRAMU, Actividad, Tu Momento, métricas pequeñas, BRAMU Intelligence, Ranking, Perfil, Compañeros/Rivales, alta de jugador sin cuenta, Resumen (Eliminar partido incluido), arquitectura CSS, lógica funcional de partidos/estadísticas — todo lo shippeado en V02.9 queda exactamente igual salvo los 3 puntos de esta matriz.
