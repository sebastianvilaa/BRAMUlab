# BRAMUlab V02.9.2
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.9.1 (commit `73cd4bb`, tag `BRAMUlab_V02.9.1`).
**Origen de esta ronda:** Sebastián probó el valor en vivo con el inspector de Chrome (DevTools) sobre la app publicada y confirmó que un trazo más grueso se veía mejor — sin `Consolidado` propio, un solo ajuste puntual.
**Estado:** publicado en producción.

Ajuste de un solo valor: el trazo principal del donut de Efectividad sube un paso más, de 2px a 3px.

---

## 1. Qué se cambió

| Elemento | V02.9.1 | V02.9.2 |
|---|---|---|
| Trazo principal / aro de fondo | 2px | **3px** |
| Halo | 2.7px / opacidad 0.16 | **3.7px** / opacidad 0.16 (sin cambios) |

El halo se reescala en la misma proporción que el trazo (mismo margen de ~0.35px por lado que viene manteniéndose desde V02.9.1) para que no quede tapado por un trazo más grueso — mismo criterio ya aplicado en la ronda anterior. La opacidad del halo no se tocó: el pedido era pura presencia del trazo, no del brillo. Mismo mecanismo sin filtros, mismos dos círculos concéntricos, misma animación de siempre.

---

## 2. Verificación

- **Computed style real**: `stroke-width` de trazo/aro de fondo confirmado en `3px`, halo en `3.7px`/`opacidad 0.16`, sin ningún `filter`.
- **Visual real** en mobile (375px), con un partido al 50% de efectividad: aro con más presencia, nítido, sin leerse pesado.
- **Tests:** 571/571 OK, sin cambios respecto de la base (un solo valor de CSS).
- **Regresión:** sin overflow horizontal nuevo (`document.body.scrollWidth === window.innerWidth`).

---

## 3. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.9.1"` → **`"BRAMUlab V02.9.2"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v02-9-1` → **`bramulab-v02-9-2`**.
- **Commit de implementación (código):** `c9bbbd0a10a871560dc1c8d863765e98a7eb540a`.
- **Push:** a `main` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 4. Hash exacto y tag

- Commit de implementación (código): `c9bbbd0a10a871560dc1c8d863765e98a7eb540a`.
- Commit de este informe: PENDIENTE_HASH_INFORME.
- Tag `BRAMUlab_V02.9.2` apuntará al commit inmediatamente posterior a este.

---

## 5. Qué no se tocó

Todo lo demás de la app — Último partido, Historial, Resumen, alta de jugador sin cuenta, Nivel BRAMU, Actividad, BRAMU Intelligence, Ranking, Perfil, arquitectura CSS. Esta ronda tocó exclusivamente 2 valores en `styles.css`.
