# BRAMUlab V02.8.3
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.8.2 (commit `9a6c414`, tag `BRAMUlab_V02.8.2`).
**Origen de esta ronda:** feedback directo en el chat sobre lo publicado en V02.8.2 ("todo bien salvo el grosor del verde de Efectividad, sigue estando muy grande"). Sin `Consolidado` propio.
**Estado:** publicado en producción.

Corrección puntual de un solo componente: el donut de Efectividad. Nada más se tocó.

---

## 1. Qué se corrigió

### 1.1 Bug real encontrado (no solo un ajuste de valores)

Al investigar por qué el ajuste de V02.8.2 (afinar trazo y halos, subir su opacidad) no había resuelto la sensación de "grosor", se encontró que `renderPlayerEffectiveness` (`app.js`) forzaba `style.opacity = '1'` inline sobre los TRES círculos del donut por igual — incluidos los dos halos, que tienen su propia opacidad baja definida en CSS (`.effectiveness-donut__glow-inner/-outer`). Un estilo inline siempre gana sobre una regla de clase, así que **los halos venían renderizando a opacidad TOTAL desde que existen (V02.8.1)**, nunca a la opacidad sutil que describían los informes de V02.8.1/V02.8.2 — el "brillo bajo" documentado en esas rondas nunca llegó a verse así en pantalla. Esta es la causa real de que el ring se sintiera pesado pese a los dos ajustes de valores anteriores: cualquier valor de opacidad puesto en CSS quedaba anulado.

**Corrección:** el trazo principal sigue forzado a `opacity:1` (siempre opaco por diseño); los dos halos se limpian a `style.opacity = ''` en vez de `'1'`, dejando que su propia opacidad de CSS se aplique de verdad.

### 1.2 Valores finales, ahora sí con la opacidad correcta

Con el bug corregido, se recalibraron trazo y halos partiendo de cero (los valores de V02.8.2 habían sido elegidos mientras el bug seguía activo, así que no eran representativos):

| Elemento | V02.8.2 (con el bug) | V02.8.3 (final) |
|---|---|---|
| Trazo principal / aro de fondo | 2.5px | **1.5px** |
| Halo interno | 4px / opacidad .30 (pero renderizaba a 1) | **2.5px / opacidad .38** |
| Halo externo | 6px / opacidad .18 (pero renderizaba a 1) | **3.5px / opacidad .24** |

Subir la opacidad al angostar los halos compensa que un halo más fino emite menos luz — el resultado es un aro fino y nítido con un brillo que se nota, sin volver a sentirse pesado. Mismo mecanismo sin filtros de V02.8.1/V02.8.2 (tres círculos concéntricos, mismo `stroke-dasharray`/`stroke-dashoffset`, misma animación por Web Animations API) — nada de esto se tocó.

---

## 2. Verificación

- **Computed style real** (no solo el valor en CSS): confirmado que `getComputedStyle` de los halos ahora informa `opacity: 0.38` y `0.24` respectivamente (antes de este fix, con el bug activo, informaba `1` sin importar qué se pusiera en CSS).
- **Visual real** en 402px y 360px, con un partido al 67% de efectividad: aro visiblemente fino, brillo perceptible y contenido, sin ningún indicio de caja/rectángulo.
- **Tests:** 571/571 OK, sin cambios respecto de la base (ronda exclusivamente de CSS + un ajuste de 3 líneas en `app.js`, sin lógica nueva).
- **Regresión:** sin overflow horizontal nuevo, sin errores de consola nuevos atribuibles a esta ronda.

---

## 3. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.8.2"` → **`"BRAMUlab V02.8.3"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v02-8-2` → **`bramulab-v02-8-3`**.
- **Commit de implementación (código):** ver §4.
- **Push:** a `main` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 4. Hash exacto y tag

- Commit de implementación (código): `db00447a4411339c232314a9aa2399275e839b0a`.
- Commit de este informe: `73e3e0ba9f9d7df4afac1230c864ec1799d25065`.
- Tag `BRAMUlab_V02.8.3` apunta al commit inmediatamente posterior a este.

---

## 5. Qué no se tocó

Todo lo demás de la app — Nivel BRAMU, Actividad, Último partido, hito, botones de Resumen, CTA de jugador sin cuenta, aviso de actualización, Historial, Ranking, Perfil, BRAMU Intelligence, arquitectura CSS. Esta ronda tocó exclusivamente el donut de Efectividad (2 archivos, ~15 líneas).
