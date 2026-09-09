# BRAMUlab V03.1.3
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.1.2 (commit `3848343`, tag `BRAMUlab_V03.1.2`).
**Origen de esta ronda:** consolidado pegado directamente en el chat ("BRAMUlab V03.1.3 — Microparche final de MI PERFIL"), guardado como `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1.3_Consolidado.md` para mantener el mismo historial documental de las rondas anteriores.
**Estado:** publicado en producción.

---

## 1. Auditoría previa

- No existía ningún "Mejor ranking BRAMU" en el código (`grep` sin resultados) — el pedido es
  agregar un KPI nuevo, no renombrar uno existente. Se interpreta como pedido explícito de
  agregar el pico histórico del propio nivel, con un nombre que nunca sugiera ranking
  comunitario (consolidado §5, criterio de producto explícito).
- La tarjeta de Efectividad fusionada (V03.1.2) ya tenía el donut+% a la izquierda y Partidos
  jugados/ganados a la derecha, pero el label `EFECTIVIDAD` competía por espacio vertical junto
  al donut en la misma columna — subirlo a un título de tarjeta real libera esa fila entera
  para agrandar el donut.
- El gráfico de Evolución (línea, eje Y en pasos de 0.25, eje X con fechas/meses) quedó
  cerrado en V03.1.1/V03.1.2 sin ninguna animación de entrada — se dibuja siempre completo,
  de una.
- `PH.computeBestWinStreak`/`computeBestWinStreakRange` (V03.1) ya establecen el patrón de
  "pico + contexto temporal" — se reutiliza el mismo criterio para el nuevo KPI, sin inventar
  un enfoque distinto.

Sin contradicciones de producto. Implementación directa.

---

## 2. "Mejor nivel BRAMU" — nuevo KPI, nunca ranking

Nueva función pura `PH.computePeakLevel(evolution)` (player-home.js): toma el pico histórico
de la MISMA serie que ya dibuja el gráfico de Evolución (`evolution.points`) — nunca compara
contra otros usuarios. Devuelve `{ value, isCurrent, date }`:

- `isCurrent = true` cuando el pico coincide con el nivel actual (incluido el caso sin
  partidos, donde el pico es la base) → la UI muestra **`ACT`**.
- Si no coincide, `date` es la fecha del **último** partido que alcanzó ese pico (el más
  reciente, ante empates de nivel) → la UI muestra mes+año abreviado (`formatPeakLevelDate`,
  misma tabla de 3 letras que el resto de la app: `SEP 26`, `OCT 26`).

Se muestra como una tarjeta propia (**"Mejor nivel BRAMU"**, nombre elegido de la recomendación
del consolidado — evita "ranking" por completo) asociada al bloque de Rendimiento, debajo de
Racha actual/Mejor racha — no dentro de la tarjeta de Efectividad, para no competir por el
espacio recién ganado ahí (consolidado §2, último punto). Mismo gate que el resto de la
Evolución numérica: oculta para cuentas en calibración (la fórmula real todavía no existe para
esas cuentas — mismo criterio ya usado en `#evolution-numeric`).

---

## 3. Tarjeta de Efectividad — composición renovada

- El label `EFECTIVIDAD` sube a un título de tarjeta real (`.pastilla__title-row`/
  `.pastilla__title`, el mismo patrón que usa el resto de la app — incluida la propia tarjeta
  de Efectividad del Home) en vez de un label chico junto al donut.
- El donut crece de 96px a **128px** (el valor central de 22px a 28px) — verificado que sigue
  entrando cómodo junto a la columna de Partidos incluso a 320px de ancho.
- Partidos jugados/Partidos ganados suben de 24px a **26px** — el espacio que libera el título
  arriba permite un paso más sin apretar el layout.
- Composición final: título arriba (ancho completo), donut + Partidos jugados/ganados en una
  fila debajo. Ninguna fórmula tocada.

---

## 4. Evolución — animación de entrada

`animateEvolutionLine(pathEl)` (app.js): mismo mecanismo que ya usa la Efectividad
(`animateEffectivenessCircle`) — `stroke-dasharray`/`stroke-dashoffset` vía Web Animations API,
con la MISMA duración y curva (`EFFECTIVENESS_ANIM_MS` = 950ms, `--home-anim-ease`) en vez de
inventar un ritmo nuevo. La línea usa `path.getTotalLength()` (en vez de la circunferencia
conocida de un círculo) para saber cuánto "dibujar". Respeta `prefers-reduced-motion` (deja el
trazo completo, sin animar, cuando el sistema lo pide). Sin puntos, sin tooltips, sin
interacción nueva — se anima solo la curva ya existente.

Se dispara cada vez que se reconstruye el gráfico (mismo criterio ya usado para el donut de
Efectividad de MI PERFIL desde V03.1: siempre anima al renderizar, sin lógica de "una vez por
sesión" — Perfil no es una pantalla que se repinte en cada tick como el Home).

---

## 5. Tests

**722/722 en verde** (716 previos + 6 nuevos). Nuevo bloque `V0313-PICO` (sin
`AFFECTED_KEYS` — función pura, no toca `localStorage`):

- sin partidos: el pico es la base y coincide con el actual (`ACT`);
- nivel siempre en ascenso: el pico ES el actual (`ACT`);
- subió y después bajó: el pico NO coincide con el actual, y su fecha es la del partido que lo
  alcanzó (no la del último partido jugado);
- empate de nivel en 2 partidos distintos: se queda con la fecha del **más reciente** — mismo
  criterio determinístico ya documentado para `computeBestWinStreakRange`.

La composición visual de la tarjeta de Efectividad y la animación de entrada del gráfico son
UI/DOM de `app.js`, fuera del alcance de `tests.html` (mismo límite de siempre) — verificadas
en el QA manual (§6): confirmado con `getAnimations().length === 1` que la animación
efectivamente se registra sobre el `<path>` en cada render.

---

## 6. QA manual mobile + desktop

Contra el dev server local (mobile 375px, desktop ~560px), con la misma cuenta de prueba de
rondas anteriores (6 partidos, nivel actual 5.8 = pico histórico):

- ✅ "Mejor nivel BRAMU" muestra `5.8` / `ACT` (el pico coincide con el actual).
- ✅ Agregado un partido perdido más reciente (nivel baja a 5.6): "Mejor nivel BRAMU" pasa a
  mostrar `5.8` / `SEP 26` — la fecha real del partido que alcanzó ese pico.
- ✅ Tarjeta de Efectividad: título arriba, donut visiblemente más grande (128px), números de
  Partidos jugados/ganados más grandes y legibles.
- ✅ Racha actual/Mejor racha sin cambios, tarjetas independientes.
- ✅ Gráfico de Evolución: línea limpia, sin puntos, eje Y/X sin cambios (V03.1.2), animación de
  entrada verificada (`stroke-dasharray` seteado al largo real del trazo + 1 animación activa
  registrada en el `<path>`).
- ✅ Cabecera principal de MI PERFIL, MIS DATOS, Acceso y seguridad, Cerrar sesión: sin cambios.
- ✅ Suite completa verde (722/722).

Sin errores de consola ni requests fallidos atribuibles a la app. No se revisaron Home/
Historial/Ranking/Notificaciones/Login/backend (fuera de alcance explícito, sin cambios
compartidos que pudieran afectarlos — la única pieza compartida tocada,
`EFFECTIVENESS_ANIM_MS`/`--home-anim-ease`, se lee sin modificarla).

---

## 7. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.1.2"` → **`"BRAMUlab V03.1.3"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-1-2` → **`bramulab-v03-1-3`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 8. Hash exacto y tag

- Commit de implementación (código): `62359325ca29e18729b7bf09ba8843e0c8fba507`.
- Commit de este informe: `3a98ca77a11365019e8a603e4ab7ef8289d72308`.
- Tag `BRAMUlab_V03.1.3` apuntará al commit inmediatamente posterior a este.

---

## 9. Diferencias justificadas respecto del consolidado

1. **Nombre elegido: "Mejor nivel BRAMU"** (la primera de las 2 recomendaciones del
   consolidado, sobre "Pico de nivel BRAMU") — mismo patrón de nombrado que "Mejor racha" ya
   usa en la misma pantalla, consistencia de lenguaje dentro del mismo bloque.
2. **"Mejor nivel BRAMU" asociado al bloque de Rendimiento, no dentro de la tarjeta de
   Efectividad**: el consolidado dejaba la decisión explícitamente abierta ("evaluar si...");
   se eligió la opción que no compite por el espacio que la propia ronda pide liberar dentro de
   esa tarjeta (donut más grande, números más grandes).
3. **Tamaños exactos (donut 128px, números 26px)**: el consolidado pide "agrandar todo lo que
   razonablemente permita el layout" sin un valor — se verificó en vivo a 320px de ancho (el
   más angosto ya probado en rondas anteriores) que ambos valores entran sin recortes ni
   superposición antes de fijarlos.

---

## 10. Qué no se tocó

Cabecera principal de MI PERFIL, Racha actual, Mejor racha, lógica de Efectividad, lógica de
Nivel BRAMU, eje Y y eje X de Evolución (tal como quedaron en V03.1.2), MIS DATOS, Acceso y
seguridad, Cerrar sesión, Home, Historial, Ranking, Notificaciones, Login, backend. Ninguna
fórmula de negocio fue modificada — `PH.computePeakLevel` es una lectura adicional de datos ya
calculados, no un cálculo nuevo de Nivel BRAMU.
