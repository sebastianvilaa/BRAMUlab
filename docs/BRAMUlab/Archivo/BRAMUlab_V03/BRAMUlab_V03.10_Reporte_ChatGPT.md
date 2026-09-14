# Reporte BRAMUlab V03.10 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto
operativo de esta ronda. No repite la especificación completa — eso vive en
`BRAMUlab_V03.10_Handoff_Cierre_V03.md` (el handoff vigente; SUPERA a
`BRAMUlab_V03.10_Handoff_Cierre_Editorial_Tu_Momento.md`, ignorado por instrucción explícita) y
en `BRAMUlab_V03.10.md`, en esta misma carpeta — solo resume qué se hizo realmente y en qué
estado quedó publicado.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit:** [`baf8453`](https://github.com/sebastianvilaa/BRAMUlab/commit/baf8453)
**Tag:** `BRAMUlab_V03.10`
**Base:** `BRAMUlab_V03.9` (commit `cd217bb`)

---

## 1. Cambio exacto de TU MOMENTO

**Problema real:** con un balance reciente muy negativo (ej. 0 victorias / 5 derrotas), Home
mostraba "Perdiste 5 de tus últimos 5 partidos" — correcto como dato, pero V03.10 decide que
`TU MOMENTO` no debe destacar una mala racha como insight editorial principal, sin convertirse
en un motor de análisis (eso queda para BRAMU Intelligence, V05).

**Antes (V03.9):** victorias > derrotas → "Ganaste..."; derrotas > victorias → "Perdiste...";
empate → "En tus últimos N partidos: X victorias y Y derrotas".

**Ahora (V03.10, `bramulab/player-home.js`):**

```js
if (withResult.length >= 3) {
  const losses = form.filter((f) => f.result === 'loss').length;
  if (wins > losses) {
    clauses.push(`ganaste ${wins} de tus últimos ${form.length} partidos`);
  }
  // victorias <= derrotas -> NO se genera cláusula (nunca "perdiste"/neutro)
}
```

Con empate o mayoría de derrotas, la cláusula se omite por completo y `buildTuMomentoText`
sigue con el siguiente candidato de la MISMA prioridad ya cerrada (sin tocarla):

`forma reciente positiva > Ranking semanal Local > compañero frecuente > actividad del mes`

El insight de Ranking **no se modificó**: sigue pudiendo mostrar movimiento negativo (`#5 de 21
en Bella Vista · ↓ 3 esta semana`) porque es un hecho contextual de posición, no una
interpretación del rendimiento — verificado con test focal y QA real.

## 2. Cómo se resolvió identidad en Compañeros/Rivales

**Problema real:** las filas de Compañeros/Rivales (`bramulab/app.js`, `openPersonListScreen`)
mostraban solo el nombre, sin `@username`, generando ambigüedad si dos jugadores comparten
nombre visible. La agregación de datos (`PH.computeTeammateBreakdown`/`computeRivalBreakdown`,
`bramulab/player-home.js`) además agrupaba por STRING de nombre — dos cuentas reales
distintas con el mismo `displayName` se habrían fusionado en una sola fila.

**Solución en dos capas:**

### 2.1 Capa de datos (`player-home.js`) — agregar por identidad, no por nombre

- `getPartnerName`/`getOpponentNames` se reescribieron sobre dos funciones nuevas,
  `getPartnerRow`/`getOpponentRows`, que devuelven la fila cruda de `players[]` (con `userId`
  si el partido ya está estampado, V03.0) en vez de solo el string de nombre — sin duplicar la
  lógica de equipo/self ya existente.
- `buildPersonBreakdown` (usada solo por `computeTeammateBreakdown`/`computeRivalBreakdown` —
  se confirmó que no tiene otros consumidores) ahora agrupa por clave `id:<userId>` cuando la
  fila trae `userId`, o `name:<nombreNormalizado>` para filas legacy sin `userId` — exactamente
  el mismo criterio de autoridad que ya usa `findPlayerRow` en todo el proyecto. Cada entrada
  agregada conserva su `userId` (o `null`).

### 2.2 Capa de presentación (`app.js`) — `resolvePersonAccount`

```js
function resolvePersonAccount(p) {
  if (p.userId) return Store.getUserById(p.userId);
  const norm = Store.normalizePlayerName(p.name);
  const candidates = Store.loadUsers().filter((u) => u && Store.normalizePlayerName(u.displayName) === norm);
  return candidates.length === 1 ? candidates[0] : null;
}
```

- Con `userId`: resolución directa y autoritativa, nunca se sustituye por nombre.
- Sin `userId` (legacy): cae al mismo fallback de nombre que ya usa el resto del proyecto
  (`buildGroupRowAccount`), pero SOLO se considera seguro si resuelve a **exactamente una**
  cuenta real — con nombre ambiguo (2+ cuentas), se prefiere no mostrar `@username` antes que
  arriesgar el equivocado.
- `openPersonListScreen` pinta `Nombre · @username` (tokens `.group-table__toprow`/`__name`/
  `__handle`, MISMOS que ya usa Mis Grupos — tomado como referencia VISUAL) cuando hay handle
  resoluble, o solo el nombre cuando no lo hay. **Nunca** se usó `buildPlayerHandle` (el
  generador de handles sintéticos que sí usa Mis Grupos) — esa función deriva un `@usuario` del
  nombre cuando no hay cuenta real, exactamente lo que este pedido prohíbe explícitamente.

## 3. ¿Fue necesario conservar/agregar `userId` en algún agregado?

Sí — antes de esta ronda, `computeTeammateBreakdown`/`computeRivalBreakdown` perdían el
`userId` en el camino (agregaban solo por nombre, vía `getPartnerName`/`getOpponentNames`, que
ya devolvían strings). Se agregó el dato mínimo necesario: las nuevas `getPartnerRow`/
`getOpponentRows` (fila completa) y el campo `userId` en cada entrada agregada de
`buildPersonBreakdown`. No se creó una segunda lógica de usuarios — se reutilizó `findPlayerRow`
(vía `getPlayerTeam`) y el mismo criterio de autoridad de `userId` que ya rige todo el proyecto
desde V03.0.

## 4. Archivos tocados

- `bramulab/player-home.js` — framing de `buildTuMomentoText` (§1); `getPartnerRow`/
  `getOpponentRows`; `buildPersonBreakdown`/`computeTeammateBreakdown`/`computeRivalBreakdown`
  agregan por identidad.
- `bramulab/app.js` — `resolvePersonAccount`; `openPersonListScreen` pinta `Nombre ·
  @username`.
- `bramulab/styles.css` — reutiliza `.group-table__toprow`/`__name`/`__handle` dentro de
  `.person-list__info`; se retiró `.person-list__name` (quedó sin ningún uso tras el cambio).
- `bramulab/tests.html` — 14 tests focales nuevos; 2 aserciones de V03.9 actualizadas (ya no
  esperan "Perdiste..."/framing neutro).
- Versionado: `bramulab/store.js`, `bramulab/version.json`, `bramulab/sw.js`,
  `bramulab/index.html`.

No se tocó geografía, lógica semanal de Ranking, Mi red, tarjeta territorial de Perfil,
`Explorar rankings`, Nivel BRAMU, BRAMU Intelligence, Backend, validación de partidos, historial
multiusuario, WhatsApp, ni el diseño de Mis Grupos (solo se leyeron sus tokens visuales).

## 5. Tests focales

`bramulab/tests.html`, 2 bloques nuevos (14 aserciones):

- **TU MOMENTO**: 3W/2L → sí genera cláusula ("Ganaste..."); 2W/3L → NO genera cláusula (nunca
  "ganaste"/"perdiste"/"victorias"/"derrotas" en el texto); 0W/5L (el caso real reportado) → NO
  genera cláusula; empate 2W/2L → NO genera cláusula; partidos neutrales sin resultado siguen
  sin activar el framing (regresión); sin forma reciente y con insight de Ranking (incluso
  negativo, `↓ 3`), Ranking ocupa el primer lugar disponible; sin forma reciente y sin Ranking,
  cae a compañero frecuente + actividad del mes (mecanismo de prioridad intacto).
- **Identidad en Compañeros/Rivales**: compañero con `userId` conserva ESE id al agregar; DOS
  cuentas reales con el MISMO `displayName` pero `userId` distinto producen DOS filas separadas
  (nunca fusionadas), cada una con su propio récord de victorias/derrotas; compañero legacy sin
  `userId` sigue agrupando por nombre normalizado con `userId: null` explícito (nunca
  inventado); el mismo criterio aplica a Rivales, no solo a Compañeros; los placeholders del
  sistema ("Jugador 2") siguen excluidos (regresión).

Se corrigieron 2 bugs de test propios durante el desarrollo (no de producto): nombres de cuenta
de prueba con una mayúscula interna tras el primer carácter de una "palabra" (ej. "Jugador
3W2L V0310") caían en el mismo problema de `normalizePlayerName` ya documentado en rondas
anteriores — se renombraron a palabras sin mayúsculas internas; y una aserción asumía que solo
se generaría una cláusula de fallback cuando en realidad el mecanismo de "hasta 2 candidatos"
agrega compañero Y actividad del mes cuando ambos califican.

No se agregó ningún test para la resolución de `@username` en sí (`resolvePersonAccount`): es
una función de `app.js`, que `tests.html` no carga (límite ya documentado en rondas
anteriores) — verificada por QA manual real (ver §7), incluyendo el caso de dos cuentas con el
mismo nombre visible.

## 6. Suite completa

**1060/1060 tests OK** (1052 de V03.9 + 14 nuevas − 2 actualizadas), corrida una sola vez al
final.

## 7. QA manual (mobile 375px primero)

Con cuentas de prueba reales fabricadas por consola:

- **Home, balance 0W/7L** (7 partidos, todos derrota, incluidos 2 contra un rival ambiguo):
  `TU MOMENTO` mostró "Compa Real V0310 es tu compañero más frecuente. jugaste 3 partidos este
  mes." — nunca "Perdiste 7 de tus últimos...".
- **Home, balance 3W/2L**: `TU MOMENTO` mostró "Ganaste 3 de tus últimos 5 partidos. Compa Pos
  V0310 es tu compañero más frecuente." — confirma que el caso positivo sigue funcionando.
- **Compañeros**, cuenta real con username: fila "Compa Real V0310 · @compa-real-v0310",
  estadísticas y efectividad intactas.
- **Rivales**, jugador legacy sin cuenta: "Rival Legacy Uno/Dos V0310" — solo nombre, sin
  handle.
- **Rivales, identidad ambigua real**: dos cuentas reales distintas con el MISMO displayName
  ("Ana Duplicada V0310", `userId` distinto), cada una enfrentada a self en un partido separado
  → aparecieron como DOS filas independientes, cada una con su PROPIO `@username`
  (`@ana-a-v0310` / `@ana-b-v0310`) — nunca fusionadas, nunca cruzadas.
- Sin overflow a 375px en ninguna de las pantallas.
- **Tablet (768px)**: Rivales con 4 filas (2 legacy + 2 cuentas reales), sin desbordes, nombre +
  handle en una sola línea.
- Verificación repetida en producción real (cuenta descartable `Prod Check V0310` +
  `Compa Prod V0310`): footer "BRAMUlab V03.10", Compañeros mostró "Compa Prod V0310 ·
  @compa-prod-v0310", `TU MOMENTO` sin "Perdiste...". Cuenta eliminada al terminar.

## 8. Limitaciones reales

- La resolución de identidad legacy (fallback por nombre) depende de que el nombre visible
  esté escrito EXACTAMENTE igual (tras normalización) entre el partido y la cuenta — esto no es
  nuevo de esta ronda, es el mismo criterio que ya usa todo el proyecto desde V03.0.
- No se tocó la navegación al Perfil público desde estas listas (`data-name`, por nombre): sigue
  siendo un comportamiento preexistente fuera del alcance de este pedido, que solo cubría la
  IDENTIDAD MOSTRADA en la lista, no la navegación.
- Ninguna limitación nueva de datos. Se mantiene la ya conocida de localStorage/multi-cuenta
  (documentada desde V03.6), sin cambios en esta ronda.

**Próximo paso:** esta ronda cierra los dos ajustes finales pedidos para V03.10. No se consolida
V03 todavía ni se avanza a V04. La siguiente decisión la toma ChatGPT después de auditar este
reporte.
