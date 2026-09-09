# BRAMUlab V03.1.1
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.1 (commit `0d326ff`, tag `BRAMUlab_V03.1`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1.1_Consolidado.md` — pulido visual de Perfil: alineación de cabecera, KPIs como tarjetas independientes, eje X de Evolución sin "SEM X", MIS DATOS sin títulos redundantes.
**Estado:** publicado en producción.

---

## 1. Auditoría previa

- **Bug real de alineación confirmado** (no solo percibido): a 320px de ancho, "Mano dominante"
  envuelve a 2 líneas mientras "Edad"/"Lado habitual" quedan en 1 — medido con
  `getBoundingClientRect()`, los 3 valores arrancaban en `top` distintos (240.5 vs 255.5 en
  columnas sin wrap, corrido a 333 en la que sí envolvía). Causa: el label más corto no
  reservaba el mismo alto que uno que envuelve.
- El bloque RENDIMIENTO de V03.1 ya tenía la composición correcta (Efectividad protagonista +
  Partidos jugados/ganados apilados + Racha actual/Mejor racha) pero como UN solo `.pastilla`
  con divisores internos, no como 5 tarjetas independientes — el consolidado pide
  explícitamente 5 `.pastilla` separadas.
- El eje X de Evolución (V03.1) usaba `SEM 1`/`SEM 2` para rangos de 15-45 días — en uso real
  se leía como un número sin relación directa con el calendario, exactamente lo que este
  consolidado pide retirar.
- MIS DATOS tenía "TUS DATOS" (en un `.profile-data-header` separado, con el lápiz de edición)
  e "IDENTIDAD" (título de la tarjeta) — ambos redundantes con la pestaña "MIS DATOS" ya
  visible arriba.

Sin contradicciones de producto. Implementación directa (consolidado §15).

---

## 2. MI PERFIL — cabecera alineada

`.mini-stat-grid--3col .mini-stat__label` gana `min-height: 26px` (alto de 2 líneas a 11px)
— el label reserva siempre ese espacio, envuelva o no. Efecto: los 3 valores (Edad/Mano
dominante/Lado habitual) arrancan SIEMPRE en la misma Y, sin importar cuál de los 3 labels
envuelve en un ancho dado. Mismo fix aplica automáticamente a la fila equivalente de MIS DATOS
(Género/Mano dominante/Lado habitual), que comparte la misma clase. Sin cambios de grid
(columnas ya eran de igual ancho — `1fr 1fr 1fr` — el problema era solo vertical). Foto y
cabecera general sin cambios de tamaño/estructura.

---

## 3. RENDIMIENTO — 5 tarjetas independientes, sin título

Se retira el título `RENDIMIENTO` y el contenedor único `.profile-performance-card` (con
`.profile-performance-hero`/`.profile-performance-divider` internos) se reemplaza por 5
`.pastilla` separadas, agrupadas en 2 filas:

- **Fila 1**: Efectividad (tarjeta propia, ancho fijo por el contenido del donut — "más grande
  que las demás") + una columna con Partidos jugados/Partidos ganados en 2 tarjetas apiladas
  (`flex:1` cada una dentro de la columna, `align-items:stretch` en la fila) — su altura
  combinada equilibra la de Efectividad.
- **Fila 2**: Racha actual + Mejor racha, cada una en su propia tarjeta, ancho igual (`flex:1`).

Mismo donut de Efectividad (`.effectiveness-donut--lg`, sin cambios) y mismas clases de texto
(`.mini-stat__label`/`__value`/`__sub`) — solo cambia el contenedor visual. Ninguna fórmula
tocada (`PH.computeEffectivenessTotal`, `computeCurrentStreak`, `computeBestWinStreak`,
`computeBestWinStreakRange` sin cambios).

---

## 4. Evolución — eje X sin `SEM X`

`formatLevelAxisLabel` pierde la banda intermedia de "semana relativa" (15-45 días → `SEM N`)
y queda con 2 bandas simples:

- rango ≤ 200 días: fecha real día+mes (`27 AGO`, `03 SEP`...).
- rango > 200 días: solo mes (`SEP`).

El umbral de 200 días es el mismo que V03.1 ya usaba para el corte fecha/mes — se reutiliza sin
cambios, solo se elimina la banda intermedia que generaba `SEM X`.

Además, **deduplicación de etiquetas consecutivas**: si dos posiciones mostradas caerían con el
mismo texto (típico del rango "solo mes", donde varios partidos comparten mes), se omite la
repetida — excepto en los extremos (primero/último), que siempre se muestran para anclar el
rango visible. Cantidad de etiquetas sin cambios (techo de 7, ya introducido en V03.1). Línea
limpia, sin puntos, eje Y en pasos de 0.25 — sin cambios (fuera de alcance, consolidado §13).

**Verificado en vivo**: rango de ~28 días (el que antes disparaba `SEM 1`/`SEM 2`/`SEM 3`/`SEM
4`) ahora muestra `27 AGO · 03 SEP · 10 SEP · 17 SEP` — el ejemplo exacto del consolidado.
Rango de ~87 días y ~280 días siguen mostrando día+mes y solo-mes respectivamente, como ya
funcionaba en V03.1.

---

## 5. MIS DATOS — sin títulos redundantes, lápiz integrado

- Se retiran **"TUS DATOS"** (título del `.profile-data-header` que envolvía a la tarjeta de
  Identidad) e **"IDENTIDAD"** (título interno de esa misma tarjeta) — la pestaña ya dice "MIS
  DATOS", ningún título nuevo los reemplaza.
- El botón de edición (lápiz, `#profile-edit-btn`) se mueve DENTRO de la tarjeta de Identidad,
  esquina superior derecha (`.profile-identity-card{ position:relative }` +
  `.profile-identity-card__edit{ position:absolute; top:14px; right:14px }`) — antes vivía
  suelto arriba de la tarjeta. Misma acción de siempre (`openProfileEditModal`), sin cambios de
  lógica.
- **Bug encontrado y corregido durante el QA de esta misma ronda** (no reportado por el
  consolidado): con un nombre/apellido largo ("Sebastián Villanueva Gutiérrez"), el texto corría
  por debajo del botón recién movido. Corregido reservando su ancho
  (`.profile-identity-compact__info{ padding-right: 40px }`) — verificado que el texto ahora
  envuelve a 3 líneas sin tocar el botón.
- "DATOS PERSONALES / DEPORTIVOS" se conserva (consolidado §11 lo permite explícitamente) —
  compactación de V03.1 sin cambios. Foto sigue editable en ambos lugares (MI PERFIL/MIS
  DATOS), sin "Quitar foto" (sin cambios).

---

## 6. Acceso y seguridad — sin cambios

Email, Cambiar contraseña (touch target de 48px), recuperación desde sesión, separación de
Cerrar sesión y su modal de confirmación: todo de V03.1, verificado que sigue intacto (no se
tocó ningún archivo/función de esa parte).

---

## 7. Tests

**716/716 en verde** (sin tests nuevos — consolidado §14: "tests focalizados solo si se toca
lógica"). Esta ronda es visual/markup (CSS, estructura de tarjetas, formato de etiquetas del
eje X) — la única función de `app.js` tocada (`formatLevelAxisLabel`) es UI, fuera del alcance
de `tests.html` (mismo límite documentado en todos los informes de V03.x). Ninguna función pura
de `player-home.js`/`store.js` fue modificada esta ronda. Suite completa corrida UNA sola vez
al cierre, sin necesidad de repetirla.

---

## 8. QA manual mobile + desktop

Contra el dev server local (320px — el ancho donde se reprodujo el bug de alineación — y
"desktop" ~560px), con la misma cuenta de prueba de V03.1 (6 partidos, categoría con fecha):

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Columnas Edad/Mano/Lado alineadas | ✅ verificado con `getBoundingClientRect` a 320px: los 3 valores en la misma Y aunque "Mano dominante" envuelva |
| 2 | No aparece RENDIMIENTO | ✅ |
| 3 | Efectividad protagonista | ✅ tarjeta más grande, donut 96px |
| 4 | Partidos jugados/ganados son tarjetas propias | ✅ |
| 5 | Racha actual/Mejor racha son tarjetas propias | ✅ |
| 6 | Layout soporta valores largos | ✅ probado con nombre largo (MIS DATOS) |
| 7 | Eje X usa fechas o meses | ✅ `27 AGO · 03 SEP · 10 SEP · 17 SEP` (rango corto), `10 JUN...05 SEP` (rango medio), solo mes (rango largo) |
| 8 | No aparece `SEM X` | ✅ confirmado leyendo el DOM del SVG |
| 9 | Labels no se pisan | ✅ |
| 10 | MIS DATOS sin `TUS DATOS` | ✅ |
| 11 | MIS DATOS sin `IDENTIDAD` | ✅ |
| 12 | Lápiz dentro de tarjeta de identidad | ✅ esquina superior derecha, funcional |
| 13 | Datos personales/deportivos compactos | ✅ sin cambios de V03.1 |
| 14 | Acceso y seguridad sin regresiones | ✅ |
| 15 | Cerrar sesión/modal sin regresiones | ✅ |
| — | Suite completa verde | ✅ 716/716 |

Sin errores de consola ni requests fallidos atribuibles a la app. No se revisaron Home/
Historial/Ranking/Notificaciones (consolidado §13: fuera de alcance, sin cambios compartidos
que pudieran afectarlos — el único componente compartido tocado, `.effectiveness-donut`, solo
recibió una variante de tamaño ya existente desde V03.1, no un cambio a su regla base).

---

## 9. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.1"` → **`"BRAMUlab V03.1.1"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-1` → **`bramulab-v03-1-1`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 10. Hash exacto y tag

- Commit de implementación (código): `bab6c3e4b9d54dc9a9cdeb16fd568e46c029a2ba`.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.1.1` apuntará al commit inmediatamente posterior a este.

---

## 11. Diferencias justificadas respecto del consolidado

1. **Fix de alineación vía `min-height` en el label, no un rediseño del grid**: el consolidado
   pedía "mismo ancho visual, buena alineación y spacing equilibrado" sin especificar la
   técnica — las 3 columnas ya eran de igual ancho (grid `1fr 1fr 1fr`); el problema real era
   vertical (labels de distinta altura por wrap), así que el fix mínimo fue reservar 2 líneas
   de alto en el label, no tocar las columnas.
2. **Bug de superposición nombre/lápiz corregido dentro de esta misma ronda**: no estaba en el
   consolidado — apareció al mover el botón de edición dentro de la tarjeta (§10) y probarlo
   con un nombre largo real durante el QA. Corregido de inmediato por ser consecuencia directa
   del cambio pedido en esta ronda, documentado en §5.
3. **Umbral único de 200 días para fecha vs. mes** (en vez de introducir una tercera banda):
   el consolidado autoriza explícitamente "Claude puede ajustar el umbral exacto... pero nunca
   volver a SEM X" — se optó por la solución más simple que cumple el pedido (2 bandas, reusar
   el umbral que V03.1 ya tenía) en vez de agregar una clasificación de calendario más fina.

---

## 12. Qué no se tocó

Home, Historial, Ranking, Notificaciones, Login, Crear cuenta, Olvidé mi contraseña, Splash,
Registrar partido, tabs Punto a punto/Por games, scoring, Player Intelligence, backend, social,
fórmula Nivel BRAMU, lógica de rachas/efectividad, eje Y de Evolución (pasos de 0.25 sin
cambios), arquitectura de identidad (`findPlayerRow`, `userId`, `SCHEMA_VERSION` se mantiene
en 3, sin campos nuevos esta ronda).
