# BRAMUlab V03.1.2
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.1.1 (commit `9f31155`, tag `BRAMUlab_V03.1.1`).
**Origen de esta ronda:** consolidado pegado directamente en el chat ("BRAMUlab V03.1.2 — Microparche de composición en Perfil"), guardado como `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1.2_Consolidado.md` para mantener el mismo historial documental de las rondas anteriores.
**Estado:** publicado en producción.

---

## 1. Auditoría previa

- La composición de V03.1.1 (Efectividad + Partidos jugados + Partidos ganados en 3 tarjetas
  separadas) ya tenía la jerarquía correcta, pero el consolidado pide fusionarlas en una sola
  tarjeta — 3 bordes/paddings independientes ocupaban más espacio que uno solo.
- **Bug real de espaciado confirmado con medición, no solo a ojo**: `.pastilla` trae de base
  `margin-bottom: 12px`, y `.profile-panel{ gap: 14px }` (el contenedor flex de MI PERFIL/MIS
  DATOS) NO hace colapsar ese margin con su propio `gap` — se suman. Medido con
  `getBoundingClientRect()`: 26px entre la tarjeta de identidad y el bloque de rendimiento en
  MI PERFIL, y 26px entre cada uno de los 4 bloques de MIS DATOS (identidad, datos personales/
  deportivos, acceso y seguridad, cerrar sesión) — el mismo bug en los dos lugares que el
  consolidado señala por separado (§2 y §3), con una única causa raíz.

Sin contradicciones de producto. Implementación directa.

---

## 2. Tarjeta de Efectividad fusionada

`.profile-performance-card--effectiveness` + `.profile-performance-stack` (2 mini-tarjetas,
V03.1.1) se reemplazan por una única `.pastilla.profile-performance-card--merged`:

- **Izquierda**: mismo donut de Efectividad (`.effectiveness-donut--lg`, sin cambios) + % +
  label `EFECTIVIDAD` — sigue siendo el dato protagonista.
- **Derecha**: Partidos jugados / Partidos ganados apilados, con sus valores en **24px**
  (`.profile-performance-matches__value`, mismo peso visual que los widgets de KPI del Home,
  `.pastilla-widget__value`) — antes 15px (`.mini-stat__value`), "agrandar visualmente los
  números" (consolidado §1).

Racha actual y Mejor racha **sin cambios**: siguen siendo 2 tarjetas independientes, en su
propia fila debajo. Ninguna fórmula tocada — mismos ids (`#mi-perfil-effectiveness-value`,
`#mi-perfil-played`, `#mi-perfil-won`, `#profile-kpi-streak`, `#mi-perfil-best-streak`), mismas
llamadas (`renderProfileEffectivenessDonut`, `PH.computeEffectivenessTotal`,
`PH.computeCurrentStreak`, `PH.computeBestWinStreakRange`) sin ningún cambio de `app.js`.

---

## 3. Espaciado — fix de raíz único para MI PERFIL y MIS DATOS

`.profile-panel > .pastilla{ margin-bottom: 0; }`: dentro de `.profile-panel` (usado por MI
PERFIL y MIS DATOS), el `gap: 14px` del contenedor pasa a ser la ÚNICA fuente de espaciado
entre tarjetas — se elimina el margin-bottom propio de `.pastilla` que se sumaba. Mismo
principio aplicado también dentro del bloque de Rendimiento (`.profile-performance
.pastilla{ margin-bottom: 0; }`), que tiene su propio `gap: 10px` y sufría el mismo problema
entre la tarjeta fusionada de Efectividad y la fila de Racha actual/Mejor racha.

Resultado medido: MI PERFIL (identidad → rendimiento) pasa de 26px a **14px**; MIS DATOS (los
4 bloques entre sí) pasa de 26px a **14px** uniforme en los 3 espacios. No se tocó el valor del
`gap` en sí (ya era el ritmo correcto del resto de la pantalla) — solo se eliminó la suma
accidental.

---

## 4. Tests

**716/716 en verde** (sin tests nuevos). Ronda puramente visual/markup — ninguna función de
`player-home.js`/`store.js` fue tocada, y la única fórmula involucrada
(`PH.computeEffectivenessTotal` y el resto de los KPIs de Rendimiento) se sigue llamando
exactamente igual desde `app.js`, sin cambios. Suite completa corrida una sola vez al cierre.

---

## 5. QA manual mobile + desktop

Contra el dev server local (mobile 375px y un chequeo rápido a ~560px), con la misma cuenta de
prueba de rondas anteriores (6 partidos, categoría con fecha):

- ✅ Efectividad + Partidos jugados/ganados en una sola tarjeta, donut a la izquierda, números
  de Partidos visiblemente más grandes.
- ✅ Racha actual y Mejor racha siguen siendo 2 tarjetas independientes, sin cambios.
- ✅ Espaciado MI PERFIL (identidad → rendimiento) verificado en 14px vía
  `getBoundingClientRect` (antes 26px).
- ✅ Espaciado MIS DATOS (los 4 bloques) verificado en 14px uniforme vía
  `getBoundingClientRect` (antes 26px).
- ✅ Cabecera principal de MI PERFIL, Acceso y seguridad, Cerrar sesión/modal: sin cambios,
  sin regresiones.
- ✅ Gráfico de Evolución: sin cambios (línea limpia, eje Y en pasos de 0.25, eje X con fechas/
  meses de V03.1.1).
- ✅ Suite completa verde (716/716).

Sin errores de consola ni requests fallidos atribuibles a la app. No se revisaron Home/
Historial/Ranking/Notificaciones/Login/Crear cuenta/recuperación de contraseña (fuera de
alcance explícito del consolidado, sin cambios compartidos que pudieran afectarlos).

---

## 6. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.1.1"` → **`"BRAMUlab V03.1.2"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-1-1` → **`bramulab-v03-1-2`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 7. Hash exacto y tag

- Commit de implementación (código): `89814ca46362d7baf715cd0be2f359a1bf789b8e`.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.1.2` apuntará al commit inmediatamente posterior a este.

---

## 8. Diferencias justificadas respecto del consolidado

1. **Fix de espaciado a nivel de regla base compartida** (`.profile-panel > .pastilla`), en vez
   de ajustar el margin de cada tarjeta puntualmente: el consolidado pedía "reducir y
   normalizar" en dos secciones distintas (MI PERFIL §2, MIS DATOS §3) que en el código
   comparten exactamente el mismo contenedor/bug — corregirlo en la raíz resuelve ambos pedidos
   con una sola regla, en vez de 5 ajustes de margin repetidos y potencialmente inconsistentes.
2. **Números de Partidos jugados/ganados en 24px**: el consolidado pide "agrandar" sin dar un
   valor — se reutilizó el tamaño ya establecido en la app para "número protagonista de una
   tarjeta chica" (`.pastilla-widget__value` del Home, 22px, redondeado a 24px para distinguirlo
   levemente dentro de esta tarjeta más ancha), en vez de inventar una escala nueva.

---

## 9. Qué no se tocó

Cabecera principal de MI PERFIL, Racha actual, Mejor racha, gráfico de Evolución, Acceso y
seguridad, Notificaciones, Home, Historial, Ranking, Login, Crear cuenta, recuperación de
contraseña, lógica de negocio, backend. Ninguna fórmula de Efectividad/rachas/Nivel BRAMU fue
modificada.
