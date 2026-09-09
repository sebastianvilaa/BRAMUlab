# BRAMUlab V03.1.4
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.1.3 (commit `d6aa7c8`, tag `BRAMUlab_V03.1.3`).
**Origen de esta ronda:** feedback directo del usuario en el chat, mirando la V03.1.3 ya
publicada en vivo (no un documento formal) — transcripto como
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1.4_Consolidado.md` para mantener el mismo
historial documental de las rondas anteriores.
**Estado:** publicado en producción.

---

## 1. Auditoría previa — confirmando el feedback con medición

Antes de tocar nada se midió (`getBoundingClientRect`) para confirmar cada observación:

- **Espaciado real en MI PERFIL**: 14px entre la tarjeta de identidad y el bloque de
  Rendimiento, pero 10px entre la tarjeta de Efectividad y la fila de Racha actual/Mejor
  racha — dos valores de "ritmo vertical" distintos en la misma pantalla, exactamente lo que
  el usuario percibió a simple vista.
- **Espaciado real de Home** (tomado como referencia, "sabemos que está bien"): sus tarjetas
  apiladas usan siempre `.pastilla{ margin-bottom: 12px }` — un tercer valor, ni 14 ni 10.
- El componente `.evolution-summary` (Nivel actual / Cambio 30 días) ya era un `display:flex`
  con `flex-wrap`, así que agregar un tercer ítem anclado a la derecha era una extensión
  directa del mismo componente, no uno nuevo.

Sin contradicciones de producto. Implementación directa.

---

## 2. "Mejor nivel BRAMU" — mudado a la tarjeta de Evolución

Se eliminó la tarjeta propia `#mi-perfil-peak-card` del bloque de Rendimiento. El mismo dato
(mismos ids `#mi-perfil-peak-level`/`#mi-perfil-peak-level-context`, sin ningún cambio de
`app.js` más que remover un `hidden` que ya no hacía falta) se movió dentro de
`#evolution-numeric` → `.evolution-summary`, como un tercer ítem:

- **Izquierda** (sin cambios entre sí): Nivel actual, Cambio últimos 30 días.
- **Derecha, anclado**: Mejor nivel BRAMU (`.evolution-summary__item--peak`, `flex:0 0 auto` +
  `margin-left:auto` — empuja SOLO este ítem al borde derecho de la fila, sin repartir el
  espacio parejo entre los 3 como haría `justify-content`).

Al vivir ahora dentro de `#evolution-numeric`, el KPI queda gateado gratis por el mismo
`hidden` que ya oculta toda la Evolución numérica para cuentas en calibración — se pudo borrar
la línea `$('#mi-perfil-peak-card').hidden = !isLegacy` que antes hacía ese trabajo por
separado.

---

## 3. Espaciado — un solo ritmo vertical (12px), igual que Home

- `.profile-panel{ gap: 14px }` → **`12px`**.
- `.profile-performance{ gap: 10px }` → **`12px`**.

Con esto, MI PERFIL y MIS DATOS quedan con el mismo ritmo vertical (12px) en todos sus
espacios, igual al que ya usa Home. No se tocó `.profile-performance-row{ gap: 10px }` (el
espacio HORIZONTAL entre Racha actual/Mejor racha, o entre el donut y la columna de Partidos)
— ese valor sí coincide con el propio gap horizontal de Home (`.player-home-metrics-row{ gap:
10px }`), así que ya estaba alineado a la referencia.

---

## 4. Donut de Efectividad — achicado

`.effectiveness-donut--lg`: 128px → **112px** (valor central 28px → 25px, misma proporción).
Sigue siendo notablemente más grande que el tamaño de V03.1.2 (96px) — no una vuelta atrás
completa, solo la corrección "un pelín" pedida.

---

## 5. Tests

**722/722 en verde** (sin tests nuevos). Ronda puramente visual/markup: ningún cálculo tocado
(`PH.computePeakLevel` sigue exactamente igual, solo cambia DÓNDE se pinta su resultado en el
DOM) — no había lógica real que testear. Suite completa corrida una sola vez al cierre.

---

## 6. QA manual mobile + desktop

Contra el dev server local (mobile 375px, desktop ~560px), con la misma cuenta de prueba de
rondas anteriores:

- ✅ "Mejor nivel BRAMU" dentro de la tarjeta de Evolución, anclado a la derecha; Nivel
  actual/Cambio a la izquierda, sin cambios entre sí.
- ✅ Probado el caso "no coincide con el actual" (agregando un partido perdido más reciente):
  `5.8` / `SEP 26` a la derecha, `5.6` / `↑0.2` a la izquierda — correcto, revertido después.
- ✅ Espaciado MI PERFIL verificado en **12px uniforme** vía `getBoundingClientRect` (antes 14
  y 10 mezclados).
- ✅ Espaciado MIS DATOS verificado en **12px uniforme** en los 3 espacios entre sus 4 bloques.
- ✅ Donut de Efectividad visiblemente más chico que V03.1.3, sigue siendo el KPI protagonista.
- ✅ Racha actual/Mejor racha, gráfico de Evolución (línea/ejes/animación), MIS DATOS, Acceso y
  seguridad, Cerrar sesión: sin cambios, sin regresiones.
- ✅ Suite completa verde (722/722).

Sin errores de consola ni requests fallidos atribuibles a la app. No se revisaron Home/
Historial/Ranking/Notificaciones/Login/backend (sin cambios compartidos que pudieran
afectarlos).

---

## 7. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.1.3"` → **`"BRAMUlab V03.1.4"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-1-3` → **`bramulab-v03-1-4`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 8. Hash exacto y tag

- Commit de implementación (código): `8ec715063f8270f7248d157227b29544559e26a3`.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.1.4` apuntará al commit inmediatamente posterior a este.

---

## 9. Diferencias justificadas respecto del feedback

1. **Ritmo unificado en 12px, no en 14px ni en 10px**: el usuario pidió "tomar de referencia el
   Home" sin dar un número — se midió el valor real que usa Home (12px, el `margin-bottom`
   base de `.pastilla`) en vez de promediar o elegir arbitrariamente entre los dos valores que
   ya había en Perfil.
2. **Tamaño exacto del donut (112px)**: "un pelín" no es un valor — se achicó un paso
   proporcionalmente similar al que lo había agrandado en V03.1.3 (16px), verificando en vivo
   que se siguiera leyendo como el KPI protagonista.

---

## 10. Qué no se tocó

Fórmulas de Efectividad/rachas/Nivel BRAMU (`PH.computeEffectivenessTotal`,
`computeCurrentStreak`, `computeBestWinStreakRange`, `computePeakLevel`, sin cambios), eje X/Y
de Evolución, animación de entrada del gráfico, MIS DATOS (contenido), Acceso y seguridad,
Cerrar sesión, Home, Historial, Ranking, Notificaciones, Login, backend.
