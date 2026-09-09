# BRAMUlab V03.1.5
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.1.4 (commit `eda10d7`, tag `BRAMUlab_V03.1.4`).
**Origen de esta ronda:** feedback directo del usuario en el chat, mirando la V03.1.4 ya
publicada en vivo — transcripto como
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1.5_Consolidado.md`.
**Estado:** publicado en producción.

---

## 1. Diagnóstico

`.evolution-summary` (la cabecera de la tarjeta de Evolución) tenía `flex-wrap: wrap`, una
regla heredada de V03.0.3 cuando esa fila mostraba 4 valores (comentario original: "pasa de 3
a 4 valores... flex-wrap para que en mobile angosto pase a 2 filas de 2"). Esa razón ya no
existía — V03.1 la simplificó a 2 valores, y V03.1.4 agregó un tercero ("Mejor nivel BRAMU",
`flex: 0 0 auto` + `margin-left: auto`) sin revisar si el `wrap` seguía haciendo falta.

Confirmado con `getBoundingClientRect()`: a 375px y 320px de ancho, "Nivel actual"/"Cambio
últimos 30 días" quedaban en `top: 643.5` (o `433` a 320px) mientras "Mejor nivel BRAMU" caía a
una fila aparte más abajo — exactamente el bug reportado.

---

## 2. Corrección

`.evolution-summary{ flex-wrap: wrap }` → **`flex-wrap: nowrap`** (se retira también `row-gap`,
sin sentido ya sin múltiples filas). Con `nowrap`, los 3 ítems quedan forzados a una sola fila
siempre: si el ancho aprieta, son los labels de "Nivel actual"/"Cambio últimos 30 días"
(`flex: 1 1 38%`, con `flex-shrink`) los que ceden envolviendo su propio texto a 2-3 líneas —
nunca la fila entera salta de renglón. "Mejor nivel BRAMU" (`flex: 0 0 auto`) nunca se achica,
así que su valor/label/contexto (`5.8`/`Mejor nivel BRAMU`/`ACT`) siempre se leen completos,
anclados a la derecha.

---

## 3. Tests

**722/722 en verde** (sin tests nuevos). Corrección puramente de CSS — ninguna lógica tocada.
Suite completa corrida una sola vez al cierre.

---

## 4. QA manual mobile + desktop

Verificado con `getBoundingClientRect()` (no solo a ojo, misma disciplina que rondas
anteriores) en los dos anchos ya usados como referencia en esta serie de ajustes:

- ✅ **375px**: los 3 ítems en `top` idéntico — misma fila.
- ✅ **320px** (el más angosto probado hasta ahora): los 3 ítems siguen en la misma fila; el
  label "Cambio últimos 30 días" envuelve a 3 líneas cortas, sin overlap ni corte de texto.
- ✅ Resto de la tarjeta de Evolución (línea, ejes, animación) y el resto de la pantalla (según
  el propio usuario, "el resto quedó todo bien"): sin cambios, sin regresiones.
- ✅ Suite completa verde (722/722).

---

## 5. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.1.4"` → **`"BRAMUlab V03.1.5"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-1-4` → **`bramulab-v03-1-5`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 6. Hash exacto y tag

- Commit de implementación (código): `52589c1f3770d2cef167b033fa4657eb8d6cfa2a`.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.1.5` apuntará al commit inmediatamente posterior a este.

---

## 7. Diferencias justificadas

Ninguna — el fix implementado es exactamente el pedido por el usuario, sin decisiones de
diseño adicionales de por medio.

## 8. Qué no se tocó

Todo el resto de V03.1.4 (composición de Efectividad, espaciado de MI PERFIL/MIS DATOS, tamaño
del donut, lógica de Efectividad/rachas/Nivel BRAMU, eje X/Y de Evolución, animación de
entrada), MIS DATOS, Acceso y seguridad, Cerrar sesión, Home, Historial, Ranking,
Notificaciones, Login, backend.
