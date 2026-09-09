# BRAMUlab V03.1
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.0.3.2 (commit `8e31b70`, tag `BRAMUlab_V03.0.3.2`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1_Consolidado.md` — rediseño de MI PERFIL como ficha deportiva + compactación de MIS DATOS.
**Estado:** publicado en producción.

---

## 1. Auditoría previa

- MI PERFIL ya reusaba el lenguaje de la Tarjeta del Home (`.player-card__level*`) para
  avatar/nombre/@usuario/Nivel BRAMU, pero tenía un bloque separado "DATOS DECLARADOS" (Edad/
  Mano/Lado/**Categoría**) y un "RENDIMIENTO" puramente textual (5 mini-stats en grilla, sin
  jerarquía visual entre ellos).
- El componente donut de Efectividad (`.effectiveness-donut`, `renderPlayerEffectiveness`)
  ya existía en el Home — reusable tal cual para MI PERFIL con ids propios, sin inventar un
  segundo componente visual.
- La cuenta (`store.js`) tenía `declaredCategory` pero ningún campo de fecha — había que
  agregar `declaredCategoryAt` (única extensión de esquema de esta ronda, autorizada
  explícitamente por el consolidado §25).
- El gráfico de Evolución ya tenía escala Y adaptativa (V03.0.3) y densidad de eje X limitada
  (V03.0.2), pero con lógica distinta a la pedida acá: paso de grilla variable (no fijo en
  0.25) y dibujaba un punto clickeable por partido con detalle emergente — exactamente lo que
  el consolidado pide retirar (§12).
- `requestLogout` ya distinguía cuentas sin email (advertencia fuerte existente) de cuentas
  con acceso completo — estas últimas cerraban sesión con un solo toque, sin confirmación.

Sin contradicciones de producto ni necesidad de salir del alcance. Implementación directa
(consolidado §26).

---

## 2. MI PERFIL — cabecera de ficha deportiva

Misma tarjeta de siempre (`.pastilla--identity`): foto (mismo tamaño), Nombre visible como
único nombre mostrado (nunca nombre/apellido legal), Nivel BRAMU a la derecha sin cambios de
lógica. Dos ajustes:

- **`@usuario` gana presencia**: nueva clase `.pastilla-identity__handle--strong` (13px/
  `--paper-dim`, antes 12px/`--paper-faint`) — sigue sin competir con el nombre (18px).
- **Edad / Mano dominante / Lado habitual pasan a vivir DENTRO de esta misma tarjeta**: nueva
  fila `.pastilla-identity__meta` (`flex-basis:100%` dentro del `flex-wrap` ya existente de
  `.pastilla--identity`, con línea separadora) en vez del bloque "DATOS DECLARADOS" aparte.
  Misma fuente de datos (`user.birthDate`/`dominantHand`/`preferredSide`), sin fórmula nueva.

---

## 3. Categoría retirada de MI PERFIL

El bloque "DATOS DECLARADOS" (título + tarjeta de 4 mini-stats) se eliminó por completo.
`#mi-perfil-category` ya no existe. La categoría nunca vuelve a mostrarse en MI PERFIL — Nivel
BRAMU queda como el único dato de nivel/desempeño en la cabecera.

---

## 4. Categoría declarada + fecha — solo en MIS DATOS

Nuevo campo `declaredCategoryAt` en el registro de usuario (`store.js`, `createUserAccount`).
Reglas:

- **Signup**: se estampa junto con `declaredCategory` en el paso 3 del wizard (categoría es
  obligatoria para crear la cuenta, así que siempre queda fechada desde el arranque).
- **Editar Datos**: se reestampa a "ahora" **solo si el valor cambia** respecto al ya guardado
  (`nextCategory !== user.declaredCategory`); si se guarda sin tocar el campo, la fecha
  original se conserva intacta. Si se limpia el campo, la fecha vuelve a `null`.

En MIS DATOS se muestra como una sola línea: `5ª · declarada el 08 SEP 26` (formato exacto del
consolidado). Cuentas ya existentes con categoría pero sin fecha (todo lo creado antes de esta
ronda) muestran solo la categoría, sin fecha — nunca se inventa una.

No se agregó ninguna lógica automática de actualización de categoría (consolidado §4, "no
inventar").

---

## 5. RENDIMIENTO — Efectividad como KPI protagonista

Reemplaza la grilla plana de 5 mini-stats por una composición de dos niveles:

- **Fila hero**: el mismo donut de Efectividad del Home (`.effectiveness-donut`, agrandado a
  96px vía `.effectiveness-donut--lg`, sin caption interna para no repetir "X/Y") en una
  columna fija a la izquierda, con Partidos jugados/Partidos ganados apilados y centrados
  verticalmente en la columna vecina — su altura combinada equilibra la del donut.
- **Fila secundaria** (separada por una línea): Racha actual + Mejor racha, en grilla de 2
  columnas.

Mismos 5 KPIs de siempre (`PH.computeEffectivenessTotal`, `matches.length`, `eff.wins`,
`PH.computeCurrentStreak`, `PH.computeBestWinStreak`) — ninguna fórmula nueva, solo
composición visual y una función pura nueva para el contexto de "Mejor racha" (§9, ver
más abajo). Nunca se muestran derrotas como KPI.

---

## 6. Racha actual — principio de datos positivos

`#profile-kpi-streak` deja de mostrar "Sin racha en curso" (texto neutro pero igual centrado
en la ausencia) y pasa a mostrar directamente `—` cuando no hay racha positiva en curso —sea
por una derrota reciente o por no tener partidos todavía—, sin ningún texto sobre la derrota.

---

## 7. Mejor racha — contexto temporal

Nueva función pura `PH.computeBestWinStreakRange(matches, playerName)` (player-home.js): mismo
criterio que `computeBestWinStreak`, pero además devuelve `{count, startDate, endDate}` del
tramo real que definió esa racha (`null` si nunca hubo racha). En empate de longitud, se queda
con la **primera** cronológica — determinístico, documentado.

`formatStreakRangeLabel` (app.js) construye el label pedido: mismo mes → `SEP 26`, cruza meses
→ `SEP–OCT 26` (mismo criterio de fechas que el resto de la app — tabla propia de 3 letras,
nunca `Intl` directo por variabilidad de locale).

---

## 8. Evolución del Nivel BRAMU — simplificada

Cabecera reducida a 2 datos (antes 4): **Nivel actual** y **Cambio últimos 30 días** — se
retiran "Cambio acumulado desde la base"/"Partidos considerados"/"Mejor nivel" de esta tarjeta
(sus cálculos siguen intactos y usados en otras partes, solo dejan de mostrarse acá).

Nueva función pura `PH.computeLevelChangeLast30Days(evolution, nowDate)`: nivel actual menos el
nivel que el jugador tenía en el último punto anterior al corte de 30 días (o `base` si todos
los partidos considerados caen dentro de la ventana, incluido el caso sin partidos → 0).
Cuando da 0, el valor pasa a `—` y el label cambia a "sin cambios en los últimos 30 días"
(texto completo pedido por el consolidado), en vez de un `↑0.0` ambiguo.

---

## 9. Gráfico — línea limpia, sin puntos

Se retiran por completo: los círculos por punto (`.evolution-chart__dot*`), su animación de
pulso, y el detalle de texto al tocar un punto (`showLevelPointDetail`, `#evolution-point-
detail`, los listeners de click/teclado en `initProfileScreen`). Queda solo la línea + los
ejes — "línea limpia, lectura rápida, sin tooltips por partido" (consolidado §12).

---

## 10. Eje Y — pasos fijos de 0.25

Reemplaza el paso variable anterior (`niceLevelAxisStep`, candidatos 0.1/0.2/0.5/1/2/5) por
`computeLevelYAxis`: paso **siempre** 0.25, rango mínimo de 1.25 (6 líneas) cuando la serie
real entra holgada, y crece en pasos de 0.25 cuando la variación real lo requiere (verificado
en vivo: una serie de 0.8 de rango generó 7 líneas, de 4.75 a 6.25 — nunca aplasta la curva).
0.25 es exacto en binario (IEEE754), así que no hace falta redondeo de presentación como antes.

---

## 11. Eje X — densidad y formato adaptativos

Techo de etiquetas sube de 5 a 7 (dentro del rango "4 a 8" pedido). El **formato** de cada
etiqueta pasa a depender del rango real cubierto:

- ≤ 14 días: día+mes (`08 SEP`).
- 15-45 días: semana relativa al primer punto mostrado (`SEM 1`, `SEM 2`...).
- 46-200 días: día+mes (misma resolución, ya con menos etiquetas por la densidad).
- \> 200 días: solo mes (`SEP`, tabla propia de 3 letras).

Verificado en vivo con series reales de ~87 días (día+mes) y ~280 días (solo mes, con
repetición esperada cuando 2 partidos caen en el mismo mes).

---

## 12. MIS DATOS — Identidad compacta

`.profile-identity-compact` reemplaza el bloque anterior (foto centrada arriba, sola, seguida
de 4 filas label/valor apiladas — ~9 líneas de alto). Ahora: foto a la izquierda (nunca
centrada), 3 líneas cortas a la derecha (Nombre Apellido / @usuario / "Nombre visible: X").
Nombre y Apellido siguen siendo 2 campos reales/editables por separado en Editar Datos — acá
solo se muestran juntos para ahorrar espacio, nunca se fusionan en el dato guardado. Foto
sigue editable tocándola, sin "Quitar foto" (sin cambios respecto a V03.0.3.1).

---

## 13. MIS DATOS — Datos personales/deportivos agrupados

Antes: 5 filas `label` (chico, arriba) / `valor` (debajo) apiladas una tras otra. Ahora,
agrupadas en filas:

- Fila 1 (2 columnas): Fecha de nacimiento + **Edad** (nueva como campo propio, antes solo
  aparecía entre paréntesis pegada a la fecha).
- Fila 2 (3 columnas): Género + Mano dominante + Lado habitual.
- Fila 3 (ancho completo): Categoría declarada + fecha, combinada en una línea (§4).

Mismo componente `.mini-stat`/`.mini-stat-grid` ya usado en MI PERFIL (nueva variante
`.mini-stat-grid--3col` para la fila de 3), sin inventar un componente nuevo.

---

## 14. Cambiar contraseña — touch target corregido

`.profile-row-action` pasa de `padding: 12px 0 0` (sin aire abajo, bastante por debajo del
mínimo táctil) a `min-height: 48px` + `padding: 14px 0` — mismo mínimo que usa `.option-col`
en el resto de la app. Sin cambios de lógica (`openChangePasswordScreen` intacta).

---

## 15. Cerrar sesión — separado + confirmación

- **Separado visualmente**: "CERRAR SESIÓN" sale de la tarjeta "ACCESO Y SEGURIDAD" (donde
  competía directamente con "Cambiar contraseña") y pasa a su propia tarjeta debajo — el `gap`
  normal entre `.pastilla` de `.profile-panel` ya da el aire pedido, sin inventar un margen
  especial.
- **Confirmación**: nuevo modal `#logout-confirm-modal` (`¿CERRAR SESIÓN?` / "Vas a tener que
  volver a ingresar con tu email y contraseña para acceder a tu cuenta." / CANCELAR · CERRAR
  SESIÓN). `requestLogout` ahora abre este modal para cuentas con acceso completo — el modal
  de advertencia fuerte existente (`#logout-warning-modal`, cuentas sin email) no cambia, sigue
  teniendo prioridad cuando corresponde (es un riesgo real de quedar afuera, distinto de "evitar
  un toque de más"). `doLogout()` solo se ejecuta tras confirmar.

Verificado en vivo: CANCELAR mantiene la sesión y vuelve a Perfil; CERRAR SESIÓN sí desloguea
y lleva a Acceso. Cuenta sin email sigue viendo el modal de advertencia fuerte de siempre, no
el nuevo.

---

## 16. Tests

**716/716 en verde** (705 previos + 11 nuevos).

Nuevo bloque `V031-EVO30D`/`V031-RACHA` (sin `AFFECTED_KEYS` — no tocan `localStorage`, son
funciones puras de `player-home.js`):

- `computeLevelChangeLast30Days`: sin partidos → 0; partido reciente dentro de la ventana →
  cambio = su delta; partido viejo fuera de ventana + uno reciente → cambio = solo el
  reciente; único partido muy viejo → 0.
- `computeBestWinStreakRange`: sin partidos → `null`; encuentra la racha correcta (no la
  victoria suelta más reciente) con sus fechas de inicio/fin reales; empate de longitud se
  resuelve con la racha cronológicamente **primera**.

El resto de la ronda (cabecera de MI PERFIL, compactación de MIS DATOS, composición de
Rendimiento, eje Y/X del gráfico, modal de confirmación de logout) es UI/DOM de `app.js`,
fuera del alcance de `tests.html` — mismo límite documentado en todos los informes de V03.0.x.
Cubierto por QA manual (§17).

---

## 17. QA manual mobile + desktop

Contra el dev server local, con una cuenta de prueba real (fecha de nacimiento, género, mano,
lado, categoría con fecha, y 6 partidos con mezcla de victorias/derrotas para ejercitar
Efectividad/rachas/gráfico en distintos escenarios):

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Cabecera compacta y legible | ✅ |
| 2 | Foto conserva tamaño suficiente | ✅ sin cambios de tamaño |
| 3 | `@usuario` tiene mejor presencia | ✅ |
| 4 | Edad/Mano dominante/Lado habitual entran correctamente | ✅ dentro de la misma tarjeta |
| 5 | No aparece categoría en MI PERFIL | ✅ |
| 6 | Desaparece bloque "Datos declarados" | ✅ |
| 7 | Rendimiento se siente visual | ✅ donut + stack |
| 8 | Efectividad es protagonista | ✅ 83% grande, donut de 96px |
| 9 | Partidos jugados/ganados equilibran el bloque | ✅ |
| 10 | Racha actual positiva | ✅ "4 victorias seguidas" |
| 11 | Racha actual neutral tras derrota | ✅ "—" (verificado agregando una derrota real) |
| 12 | Mejor racha muestra fecha breve | ✅ "JUL–SEP 26" (racha real cruzando meses) |
| 13 | Gráfico sin puntos | ✅ confirmado por DOM (`querySelector('circle')` → ninguno) |
| 14 | Eje Y legible y adaptativo | ✅ 7 líneas de 0.25 con una serie de 0.8 de rango real |
| 15 | Eje X no se sobrecarga | ✅ día+mes (~87 días) y solo mes (~280 días) verificados |
| 16 | MIS DATOS ocupa menos alto | ✅ Identidad de ~9 líneas a 3 |
| 17 | Foto editable en ambos lugares | ✅ MI PERFIL y MIS DATOS |
| 18 | Cambiar contraseña touch target correcto | ✅ 48px medido en vivo |
| 19 | Cerrar sesión separado | ✅ tarjeta propia |
| 20 | Modal de cierre funciona | ✅ cancelar mantiene sesión, confirmar desloguea |
| 21 | Home sin regresiones | ✅ verificado (Nivel BRAMU, Último partido, Efectividad, Tu Momento intactos) |
| 22 | Historial/Notificaciones sin regresiones | No revisados directamente (consolidado §25: sin cambios compartidos que los afecten — ninguna función/CSS que ellos usan fue tocada) |
| 23 | Suite completa verde | ✅ 716/716 |

Mobile (375×812) y desktop verificados en las pantallas tocadas (MI PERFIL, MIS DATOS, modal
de logout); Home revisado una vez como chequeo de regresión compartida. Sin errores de consola
ni requests fallidos atribuibles a la app.

---

## 18. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.0.3.2"` → **`"BRAMUlab V03.1"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-0-3-2` → **`bramulab-v03-1`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 19. Hash exacto y tag

- Commit de implementación (código): `3a3dc89bceb777f6d224375048c3f00b20e8109d`.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.1` apuntará al commit inmediatamente posterior a este.

---

## 20. Diferencias justificadas respecto del consolidado

1. **Nombre y apellido combinados en MIS DATOS**: el consolidado pide compactar "en filas de 2
   o 3 columnas"; para Identidad se optó por una sola línea de texto ("Juan Pérez") en vez de
   una fila de 2 columnas, porque Nombre/Apellido junto a foto+@usuario+nombre visible en una
   grilla se sentía más denso/tabular que una ficha de identidad — el dato sigue siendo 2
   campos reales y editables por separado, solo cambia cómo se muestran juntos.
2. **CTA "VALIDAR CÓDIGO" no aplica a esta ronda** (mención solo para descartar: no se tocó
   nada del flujo de recuperación de V03.0.3.1/V03.0.3.2 en V03.1).
3. **Formato de eje X con bandas de 14/45/200 días**: el consolidado da ejemplos ("pocos días",
   "~1 mes", "2-3 meses", "varios meses") sin umbrales numéricos exactos — se eligieron cortes
   concretos y documentados (14/45/200) que producen los mismos formatos de ejemplo dados
   (`08 SEP`, `SEM 1`, `SEP`) sin necesitar una clasificación de calendario más compleja
   (semana-de-mes real, quincenas).
4. **Empate de longitud en "Mejor racha"**: no especificado por el consolidado — se documentó
   un criterio determinístico (primera racha cronológica) en el código y los tests.

---

## 21. Qué no se tocó

Home, widgets del Home, Últimos partidos, Tu Momento, navegación, sistema de Nivel BRAMU real
(`computeLevelEvolution`/`computeLevelDeltaForMatch` sin cambios), Historial, Ranking (sin
ranking real, sin puntos/títulos/posiciones), Notificaciones, flujo de registro de partido,
tabs Punto a punto/Por games (V03.0.3.2), Player Intelligence, lógica de scoring, backend,
social, recuperación de contraseña (V03.0.3.1/V03.0.3.2, sin cambios de comportamiento),
arquitectura de identidad (`findPlayerRow`, `userId`, `SCHEMA_VERSION` se mantiene en 3) salvo
el único campo nuevo `declaredCategoryAt`, explícitamente autorizado.
