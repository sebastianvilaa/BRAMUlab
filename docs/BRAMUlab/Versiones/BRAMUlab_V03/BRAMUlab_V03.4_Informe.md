# BRAMUlab V03.4 — Informe (Mis grupos)

Implementación directa sobre `BRAMUlab_V03.4_Consolidado.md`. Sin backend: todo vive local en
este dispositivo (`localStorage`), aislado y reemplazable cuando exista backend real (§15 del
consolidado).

## 1. Bottom nav

`RANKING` sale de la barra inferior, reemplazado por `MIS GRUPOS` (ícono de dos personas
superpuestas, mismo peso visual sólido que Inicio/Perfil). La barra queda:

`INICIO · HISTORIAL · + · MIS GRUPOS · PERFIL`

`view-ranking`/`openRankingScreen()` quedan intactos en el código (sin ningún botón que los
abra) — el consolidado es explícito en que el Ranking BRAMU oficial "se trabaja por separado"
más adelante, así que no se borró ese scaffolding.

## 2. Modelo local (nuevo módulo `groups.js`)

Un nuevo archivo, `groups.js` (`window.PLGroups`), concentra TODA la lógica pura de la
competencia por grupos — mismo criterio de separación que ya usa el resto de la app
(`player-home.js`/`match-load.js` puros, `store.js` persiste). `app.js` solo orquesta DOM sobre
lo que estas funciones devuelven.

```
group = {
  id, name, createdAt, createdBy,
  members: [
    { name, userId|null, isAdmin,
      periods: [ { joinedAt, leftAt|null }, ... ] },
    ...
  ]
}
```

**Persistencia:** `Store` gana una clave nueva, `bramulab.groups.v1` — una lista **global** (no
aislada por `userId`, a diferencia de `addedPlayers`/`notifications`): un grupo es una entidad
compartida entre varios jugadores, mismo criterio que ya usa `HISTORY`. "MIS GRUPOS" en pantalla
es el subconjunto de esa lista donde la identidad activa resuelve como miembro activo.

**Desviación deliberada del modelo mínimo pedido (`periods[]` en vez de un único
`joinedAt`/`leftAt`):** el consolidado (§6/§15) pide "guardar fecha de ingreso y, si
corresponde, fecha de salida". Implementarlo como un único par de fechas por miembro rompía la
propia regla de éxito §22 ("los históricos no se reescriben al agregar/quitar miembros") en el
caso de un reingreso: sin períodos, volver a entrar pisaría el `joinedAt` original y excluiría
del cálculo los partidos que sí contaron durante la primera etapa como miembro. Con un array de
períodos, cada etapa de pertenencia queda registrada por separado y ningún partido pasado deja
de contar — verificado en vivo (ver §7 QA).

## 3. Reglas de pertenencia y detección automática (§6/§7)

- `PLGroups.isMemberActiveAt(member, iso)` — activo si `iso` cae dentro de algún período.
- `PLGroups.findActiveMemberForPlayerRow(row, members, iso)` — único punto de "¿esta fila de
  `players[]` de un partido es este miembro del grupo?". Mismo principio de exclusividad que
  `PH.findPlayerRow` (V03.0), en la dirección inversa: un miembro con `userId` guardado SOLO
  puede resolverse por ese `userId` exacto (nunca por nombre); un miembro sin cuenta real detrás
  resuelve por nombre normalizado.
- `PLGroups.doesMatchCountForGroup(match, group)` — partido válido (ganador definido,
  `regulationCompleted !== false`, mismo umbral que ya usa Nivel BRAMU) **y** al menos 3 de los
  4 jugadores eran miembros activos en la fecha real del partido. Sin selector, sin
  confirmación — automático.
- Un mismo partido se evalúa independiente por cada grupo: puede contar para varios a la vez
  (verificado con 2 grupos que comparten 3 de 4 jugadores).

## 4. Puntos por partido (§9)

- Base: victoria = 5 pts, derrota = 0.
- **Sorpresa de nivel** (+1): promedio de Nivel BRAMU de la pareja ganadora, **antes del
  partido**, al menos 0,5 inferior al promedio rival. "Antes del partido" se calcula recortando
  el historial completo a los partidos con fecha real anterior y pasando ese recorte a
  `PH.computeSimulatedJugadorLevel` (la misma fuente de siempre — nunca una segunda fórmula).
- **Remontada** (+1): la pareja ganadora perdió el Set 1 (comparado contra el score real del
  set, `gamesA > gamesB`, nunca un campo `winner` opcional que podría faltar).
- **Victoria clara** (+1): gana en exactamente 2 sets y el rival suma menos de la mitad de los
  games totales de la ganadora.
- **Exclusión estructural** (no un chequeo aparte): ganar 2-0 implica no haber perdido el Set 1,
  así que Remontada y Victoria clara nunca pueden ser `true` en el mismo partido — verificado
  con 5 fixtures distintos en tests.html.
- Máximo por partido: 5 + 1 + 1 = 7.

## 5. Tabla semanal — top 3 (§8) y semana lunes-domingo (§4)

`PLGroups.computeWeeklyTable(fullHistory, group, weekStart)`: para cada miembro relevante de la
semana (activo en algún momento dentro de `[weekStart, weekStart+7d)`, aunque hoy ya no lo sea),
junta sus partidos contables de esa semana, ordena por puntos y toma el top 3 — 1 o 2 jugados
cuentan todos, 4+ solo los 3 mejores puntajes (verificado: un jugador con 4 partidos, uno de
ellos una derrota de 0 puntos, termina con `matchesCounted:3, wins:3, losses:0` — la derrota
queda afuera del top 3, no infla la segunda línea). La semana usa `PH.startOfWeekMonday`, la
misma fuente que ya usa Actividad del Home desde V02.7 — nunca una segunda noción de "semana".

## 6. ANTERIOR y RACE ANUAL (§10)

- **ANTERIOR:** la misma `computeWeeklyTable` con `weekStart` corrido 7 días atrás — resultados
  ya congelados (no se recalculan al mirar, pero tampoco cambian: la fuente es el historial real
  + la membresía histórica).
- **RACE ANUAL:** `PLGroups.computeRaceAnual(fullHistory, group, year)` recorre solo las semanas
  del año calendario que tuvieron al menos un partido contable, suma los puntos YA recortados al
  top 3 de cada semana (nunca un top 3 del año completo) y acumula por jugador. Se reinicia
  únicamente al cambiar de año (parámetro `year`); nunca semanalmente.

## 7. BRAMU Intelligence grupal (§12) — "EL MOMENTO DEL GRUPO"

`PLGroups.buildGroupIntelligence(ctx)` prueba 6 candidatas puras e independientes, en orden de
prioridad, y devuelve las primeras 2-3 que tengan algo real que decir (nunca relleno genérico):
líder de la semana, punto destacado de bonus (sorpresa > remontada > clara), quién subió más
puestos vs. la semana anterior, si la semana está pareja o alguien se despegó, líder de la Race
anual, cantidad de partidos jugados. Probado en vivo: con 1 partido real cargado, el bloque
mostró 3 insights reales y distintos ("Ana Test lidera la semana con 6 puntos" / "Ana Test y
Matu se impusieron con autoridad esta semana" / "La semana está muy pareja: Matu le pisa los
talones a Ana Test por los mismos puntos") — nunca una frase pobre ni inventada.

## 8. Administradores (§5)

`Store.createGroup/addGroupMember/removeGroupMember/promoteGroupAdmin/demoteGroupAdmin` — el
creador queda admin único inicial. `promoteGroupAdmin` no tiene límite. `demoteGroupAdmin` y
`removeGroupMember` comparten el mismo guardrail (`activeAdminCountExcluding`): bloqueados si la
acción dejaría al grupo sin ningún admin activo, devolviendo `{ok:false, reason:'last-admin'}` —
nunca falla en silencio. La etiqueta `ADMIN` es discreta y **vive solo en Configuración del
grupo** (fila de miembro), no en la tabla principal — ver §9 más abajo (bug real encontrado y
corregido).

## 9. UI — pantallas y componentes nuevos

- **`view-groups`** (MIS GRUPOS): selector de grupos como chips (`.history-tab`, solo si hay
  ≥2), pestañas ACTUAL/ANTERIOR/RACE ANUAL, tarjeta de BRAMU Intelligence, tabla del grupo,
  enlace "¿Cómo se suman los puntos?" (bottom sheet corto, sin legal permanente en pantalla).
- **`view-group-settings`**: solo alcanzable si la identidad activa es admin (engranaje oculto
  si no) — nombre editable, lista de miembros con acciones inline (Hacer/Quitar admin, Quitar
  del grupo — deshabilitadas con `title` explicativo sobre el único admin), "+ Agregar jugador".
- **Hoja "Crear grupo" / "Agregar jugadores"**: una sola hoja reutilizada en 2 modos (título,
  campo de nombre y texto del botón cambian) — selección múltiple con un nuevo componente,
  `.group-picker-row` (extiende `.player-row`, nunca lo duplica: mismo avatar/nombre/@usuario/
  Nivel BRAMU, solo agrega un círculo de check).
- Fila de tabla (`buildGroupTableRowHTML`): posición, avatar, nombre, segunda línea
  partidos/V/D, puntos grandes — nunca Nivel BRAMU/efectividad/mano/lado (§11). Tocar una fila
  abre el perfil público del jugador tocado, **excepto la propia fila** (ver bug §10.3).

Todo reutiliza lenguaje visual existente: `.history-tab` (selector y pestañas), `.pastilla`
(Intelligence), `.person-list__avatar`, `.bottom-sheet`/`.player-row`, `confirmAction` (mismo
modal de "Eliminar partido" para "Quitar del grupo"), `showToast`. Cero componentes visuales
nuevos fuera de lo estrictamente necesario para la tabla/picker.

## 10. Bugs reales encontrados y corregidos en QA (no en el consolidado — hallazgos de esta ronda)

1. **Wrap roto en la fila de tabla:** `.group-table__name`/`.group-table__caption` eran
   `<span>` sin `display:block` — en pantallas angostas, "0 partidos" partía a mitad de palabra
   entre la línea del nombre y la de abajo. Corregido agregando `display:block` a ambas clases
   (mismo patrón que ya usan `.person-list__name`/`__caption`, que son `<div>`).
2. **Botón "GUARDAR NOMBRE" gigante (216px de alto) en Configuración del grupo:**
   `.btn-secondary` trae `flex:1` (pensado para vivir junto a otro botón en una fila) y el padre
   ahí es `.access-scroll` (`display:flex;flex-direction:column`) — sin resetear el flex, el
   botón crecía para llenar todo el alto restante de la pantalla. Corregido agregando
   `flex:none` a `.btn-save` (el modificador que ya se usa junto a `.btn-secondary`/`.btn-start`
   para botones de acción sueltos en formularios verticales) — beneficia a cualquier uso futuro
   de esa combinación, no solo a este.
3. **Tocar la propia fila en la tabla del grupo mostraba "0 partidos" / efectividad vacía:**
   `openPlayerPublicProfile` busca partidos por nombre plano
   (`PH.filterMatchesForPlayer(history, name)`); un partido propio ya estampado con `userId`
   (regla de exclusividad de V03.0) nunca se encuentra por nombre solo. Antes de V03.4 esto
   nunca pasaba — Buscar Jugadores/JUGADORES excluyen siempre al propio jugador
   (`ML.buildJugadorDirectory`) — la tabla de un grupo es el primer lugar de la app donde la
   propia fila puede aparecer en una lista tocable. Corregido: la fila propia (comparada por
   `userId` autoritativo, con fallback a nombre — mismo criterio que el resto de la app) abre
   MI PERFIL en vez del perfil público.
4. **Decisión de producto, no bug:** el consolidado (§11) sugería una etiqueta ADMIN discreta
   también en la tabla principal; se retiró de ahí durante QA porque en pantallas angostas
   truncaba el nombre ("ADM…") y porque el propio §5 ya aclara que esa etiqueta "puede
   mostrarse en Configuración" — se dejó únicamente ahí, coherente con "no mostrar privilegios
   administrativos como parte del ranking deportivo".

## 11. QA manual (mobile, `computer`+`javascript_tool` sobre un server HTTP local temporal)

Verificado en vivo, con datos reales (no solo síntesis por consola):
bottom nav con MIS GRUPOS · estado sin grupos · crear grupo (nombre + selección múltiple) ·
agregar jugadores desde Configuración · cambiar de grupo (selector de chips, 2 grupos con
distintos miembros, aislados entre sí) · Configuración (nombre, promover, degradar, bloqueo del
último admin en ambos botones, quitar miembro con confirmación, reingreso reabre período) ·
semana ACTUAL con partido real (base 5 + bonus victoria clara = 6, BRAMU Intelligence con 3
insights reales) · ANTERIOR vacía con su propio estado explicado · RACE ANUAL acumulando · "¿Cómo
se suman los puntos?" · perfil público desde una fila ajena · MI PERFIL desde la fila propia ·
chequeo visual rápido en desktop (1200px, layout centrado a 768px, sin overflow).

## 12. Tests (`tests.html`, funciones puras de `groups.js`/`Store`)

50 tests nuevos (prefijo `V034-*`): pertenencia temporal (períodos múltiples, reingreso, límites
inclusivo/exclusivo) · detección 3-de-4 (incluye partido sin ganador y cortado manualmente) ·
múltiples grupos sobre el mismo partido · base 5 · sorpresa de nivel (con calibración de Nivel
BRAMU real, no solo el hash simulado) y su umbral exacto de 0,5 · remontada · victoria clara con
los 3 ejemplos textuales del consolidado (6-3/6-3 no suma, 6-3/6-2 sí, 6-2/6-1 sí) · exclusión
estructural de bonuses · top 3 mejores partidos de la semana · límites lunes 00:00–domingo 23:59
· semana anterior sin mezclarse con la actual · Race anual (acumulación entre semanas, año
aparte, respeta el tope semanal dentro de la Race) · persistencia y admins (Store: crear,
renombrar, agregar/quitar miembro con reingreso, promover/degradar con bloqueo del último
admin). Sin tests de CSS, como pide el consolidado.

**Suite completa, una sola corrida al cierre: 793/793 OK.**

## 13. Versionado

`Store.VERSION`: `BRAMUlab V03.4`. Quartet completo bumpeado: `version.json`, `sw.js`
(`CACHE_NAME` + `CORE_ASSETS`, incluye el nuevo `groups.js`), `index.html` (`?v=03.4` en todos
los `<script>`/`<link>` locales).

## 14. Qué NO se implementó (a propósito, por alcance)

Ranking BRAMU oficial, ciudad/provincia/país, backend real, seguidores/amigos, mensajería,
invitaciones a partido, armado de partido desde el grupo, push notifications, premios/medallas —
todo explícitamente fuera de esta ronda (§17 del consolidado). Home no suma ningún botón "RANKING
BRAMU" todavía (§18).

## 15. Commit / tag / deploy

Tag `BRAMUlab_V03.4`. Push a `main` → GitHub Pages redeploya automáticamente
(https://sebastianvilaa.github.io/BRAMUlab/bramulab/).
