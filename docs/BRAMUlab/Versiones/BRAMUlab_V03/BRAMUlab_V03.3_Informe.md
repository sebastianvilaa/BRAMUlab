# BRAMUlab V03.3
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.2.2 (commit `1f4b0d6`, tag `BRAMUlab_V03.2.2`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.3_Consolidado.md` — primera experiencia de "jugadores" de BRAMU (perfil público, búsqueda, lista personal), sin implementar todavía red social completa.
**Estado:** publicado en producción.

---

## 1. Principio de producto (§1)

La única relación nueva es **"agregado o no"** — nunca amigos, seguidores, popularidad ni
reciprocidad. No se muestra en ningún lugar cuántos jugadores tiene agregados una persona,
quién agregó a quién, ni ningún número de popularidad. No se implementó nada de la lista de
exclusiones del consolidado (§11): mensajes, invitaciones, compartir, bloqueo, grupos,
notificaciones sociales, armado de partido desde perfil.

---

## 2. Pantallas agregadas

### 2.1 Perfil público de jugador (`#view-player-public`)

Pantalla pública única (sin tabs MI PERFIL/MIS DATOS), de solo lectura:

- **Cabecera** (reutiliza visualmente `.pastilla--identity`/`.player-card__level` de MI
  PERFIL): avatar, nombre visible, `@usuario`, Nivel BRAMU actual, edad, mano dominante, lado
  habitual. Nunca email, fecha de nacimiento, género, categoría declarada, datos de acceso ni
  controles de edición.
- **Nombre real** nunca protagonista — la identidad principal sigue siendo nombre visible +
  `@usuario` (§2.2).
- **Rendimiento**: misma tarjeta de Efectividad que MI PERFIL (donut + partidos
  jugados/ganados) + dos tarjetas — Mejor racha (con fecha breve) y Mejor nivel BRAMU (`ACT`
  si coincide con el actual, si no fecha `MON YY`). **Nunca** Racha actual ni Evolución del
  Nivel BRAMU — esas son datos personales, quedan solo en MI PERFIL (§2.3).
- **AGREGAR JUGADOR / JUGADOR AGREGADO** (§3): botón único que alterna estado (lima
  `.btn-start` ⇄ neutro `.btn-secondary`), sin confirmación — agregar/quitar de una lista
  personal no es una acción destructiva de datos de partido, así que no necesita el mismo
  flujo que "Eliminar partido".

**De dónde salen los datos de una persona que no tiene cuenta real:** este es un prototipo de
un solo dispositivo — no existe (todavía) un backend con las cuentas de otras personas. Si el
nombre buscado coincide con una cuenta local real (`Store.loadUsers()` — el modelo ya soporta
más de una cuenta en el mismo dispositivo, aunque en el uso típico solo exista la propia),
se muestran sus datos declarados reales (foto/edad/mano/lado). Si es solo un nombre conocido
por el historial o por selección manual (el caso normal: un rival/compañero con el que ya se
jugó), esos tres campos quedan en `—` — **nunca inventados**. Edad/mano/lado son los únicos
datos que dependen de esto; Efectividad/racha/Nivel BRAMU salen siempre del historial local
(ver §4).

### 2.2 Buscar Jugadores (`#view-player-search`)

Buscador (`Buscar jugador…`) + lista completa del universo de jugadores conocidos localmente
(`ML.buildJugadorDirectory`) cuando el campo está vacío — sirve tanto para explorar como para
buscar, sin código adicional (la misma función que filtra por texto ya devuelve todo con
`query` vacía). Busca por nombre visible/`@usuario` (ambos ya se resuelven al mismo nombre
normalizado); no hay todavía nombre real separado del visible en el modelo de datos de
"otro jugador" (solo existe para la propia cuenta), así que ese campo del §5 del consolidado
no aplicaba en este prototipo.

---

## 3. Componente único — fila de jugador (§6/§7)

`buildPlayerRowHTML(name, level)` en `app.js` es el ÚNICO lugar que arma el HTML de una fila
de jugador — reutilizado tal cual en:

- Buscar Jugadores (resultados),
- Elegir compañero / Elegir rival 1 / Elegir rival 2 (recientes y todos — ya existía desde
  V02.5, ahora suma Nivel BRAMU a la derecha),
- lista JUGADORES de Perfil (§8).

Contenido: avatar/iniciales a la izquierda, nombre + `@usuario` al centro, Nivel BRAMU
destacado + label `NIVEL BRAMU` a la derecha. Separador horizontal muy suave entre filas
(`.player-row + .player-row{ border-top: 1px solid var(--line) }`, la opacidad más baja del
sistema — 14%) — nunca en la primera fila. Toda la fila es un único `<button>` clickeable
(nunca un control anidado). La fila "Agregar a…" del selector de compañero/rival (alta de un
nombre nuevo) queda igual que antes — sin Nivel BRAMU, no tiene sentido para un nombre que
recién se está creando.

---

## 4. Datos simulados y reutilización sistémica (§9)

Nada de esto usa una fórmula nueva. `PH.filterMatchesForPlayer`, `computeEffectivenessTotal`,
`computeBestWinStreakRange`, `computeLevelEvolution` y `computePeakLevel` ya eran funciones
puras que reciben `(history, playerRef)` — hasta ahora siempre se les pasaba la identidad del
propio usuario. Esta ronda las llama con el **nombre del otro jugador**, sobre el mismo
`Store.loadHistory()` de este dispositivo: si esa persona ya jugó contra el usuario actual
(caso normal, ya que este dispositivo solo conoce SUS propios partidos), su Efectividad/mejor
racha/Nivel BRAMU salen del mismo dato real que ya usan Home/MI PERFIL para uno mismo.

**Nivel BRAMU simulado (`PH.computeSimulatedJugadorLevel`, nueva):** si el jugador tiene al
menos un partido "considerado" (mismo criterio que la Evolución real,
`isMatchConsideredForLevel`), usa `computeLevelEvolution(...).current` — el valor real. Si
nunca jugó contra el usuario actual (recién agregado por búsqueda, sin historial), no hay
ninguna fórmula real que aplicar — se asigna un valor **determinístico** (hash del nombre
normalizado, rango 3.0–7.5, nunca los extremos 1.0/10.0 de la escala real) para que la fila
nunca muestre "—" ni cambie entre renders. El mismo valor alimenta la cabecera del perfil
público **y** la tarjeta "Mejor nivel BRAMU" (que en ese caso queda `ACT`, coincidiendo con el
actual — coherente: sin historial, el único punto de datos es el simulado).

Queda claramente aislado en una función nueva y nombrada explícitamente "simulado" — cuando
exista backend real con el Nivel BRAMU verdadero de cada persona, esta función se reemplaza
sin tocar ningún call site (todos reciben ya un número, nunca una promesa/estado especial).

---

## 5. Persistencia local (§9)

`bramulab.addedPlayers.v1` en `store.js` — dict `{ [userId]: [nombresNormalizados] }`, mismo
criterio de aislamiento por cuenta que ya usan las notificaciones (V03.0.2): nunca por nombre
visible, para que dos cuentas locales del mismo dispositivo no se mezclen. 4 funciones nuevas
(`loadAddedPlayers`, `isPlayerAdded`, `addPlayerToList` — idempotente —,
`removePlayerFromList`). Queda explícitamente aislado en su propia clave/funciones para poder
reemplazarse por una relación real de backend en V04 sin tocar el resto de `store.js`.

---

## 6. Accesos al perfil público (§10)

Implementados los 3 mínimos del consolidado:

1. Desde Buscar Jugadores.
2. Desde la tab JUGADORES de Perfil.
3. Desde tarjetas del Home donde el jugador ya está individualizado (Mejor compañero / Rival
   más enfrentado) — **con una adaptación documentada**: las tarjetas del Home en sí
   **siguen** abriendo la lista completa de Compañeros/Rivales (comportamiento existente desde
   V02.1, el único punto de entrada a esa pantalla — redirigirlas directo a un perfil hubiera
   dejado esa lista completa inalcanzable, una regresión real no pedida por el consolidado).
   En cambio, **cada fila** de esa lista (que además de "el mejor" ya individualiza a
   cualquier persona real con la que se compartió cancha) ahora abre su perfil público —
   cumple la letra del punto 3 (jugador individualizado, accesible desde una tarjeta que nace
   en el Home) sin remover ningún acceso existente.

No se tocó Resumen del partido (§10, último párrafo: "no forzar acceso... si la UI actual no
lo permite naturalmente").

---

## 7. Perfil — tercera pestaña JUGADORES (§8)

`MI PERFIL` / `MIS DATOS` / **`JUGADORES`** (`PROFILE_TAB_LABELS`, mismo patrón de constante
única que ya usaban las primeras 2). Lista de agregados con el componente de fila único de
§3; tocar una fila abre el perfil público. Estado vacío reutiliza el patrón visual de
`.history-empty` ya existente: *"Todavía no agregaste jugadores."* + botón `BUSCAR JUGADORES`.
Sin contadores ni métricas.

---

## 8. Home (§4)

Tarjeta `BUSCAR JUGADORES` (ícono lupa + título + chevron), al final del contenido principal,
después de las tarjetas de compañeros/rivales — mismo componente `.pastilla--link` que ya usan
Efectividad/Mejor compañero/Rival más enfrentado (nunca un input embebido). Ninguna tarjeta
existente del Home se modificó.

---

## 9. Coherencia visual (§12)

Ningún lenguaje visual nuevo: toda la pantalla de perfil público reutiliza clases ya
existentes de MI PERFIL (`.pastilla--identity`, `.player-card__level`, `.mini-stat-grid`,
`.profile-performance-*`, `.effectiveness-donut`) con ids propios; Buscar Jugadores reutiliza
`.analysis-header`/`.player-search-field` (ya usado en el selector de compañero/rival) y el
componente de fila de §3. Las 2 clases CSS nuevas (`.pastilla-icon-label`,
`.pastilla__icon-svg--search`) son variantes chicas de patrones ya existentes
(`.pastilla__title-row`, `.pastilla__icon-svg--momento`), no un sistema paralelo. Ni
Montserrat ni ninguna tipografía nueva.

---

## 10. Tests

**17 tests nuevos, 739/739 en verde** (bloque `BRAMUlab_V03.3 — SISTEMA DE JUGADORES` en
`tests.html`, agregado solo porque esta ronda sí incorpora lógica local nueva — agregar/quitar
jugador, persistencia, búsqueda):

- `PH.computeSimulatedJugadorLevel`: determinístico (mismo nombre → mismo valor siempre),
  dentro del rango simulado, y usa el valor REAL de `computeLevelEvolution` en vez del
  simulado en cuanto hay al menos un partido considerado.
- `ML.buildJugadorDirectory`: nunca incluye al propio jugador actual, une recordados +
  historial sin duplicar, nunca incluye placeholders del sistema.
- `Store` jugadores agregados: lista vacía antes de agregar, `isPlayerAdded`/
  `loadAddedPlayers` nunca rompen sin `userId`, agregar es idempotente, aislado por `userId`
  (agregar/quitar en una cuenta nunca toca la lista de otra), comparación normalizada,
  quitar algo inexistente es no-op seguro. Mismo patrón snapshot/restore de `localStorage`
  que los bloques V03.0/V03.0.2/V03.0.3 — el dev server queda exactamente como antes de
  correr la suite.

No se agregaron tests de CSS ni de navegación entre pantallas (sin arnés de pruebas para
DOM/interacción en este proyecto, mismo criterio documentado desde Etapa 3 Fase 2) — esa parte
se verificó manualmente (§11).

---

## 11. QA

**Mobile (375×812, dev server local):** flujo completo probado en vivo con una cuenta nueva
("Vero") y un partido real cargado contra 2 rivales/1 compañero nuevos (Matías/Facundo/Nico,
creados y quedaron solo en el dev server, nunca en producción):

- Home con "BUSCAR JUGADORES" visible al final, sin alterar las tarjetas existentes.
- Buscar Jugadores: vacío en cuenta nueva ("Sin coincidencias", nunca datos inventados);
  poblado tras cargar el partido (3 resultados, Nivel BRAMU correcto por fila, filtro de texto
  funcionando).
- Elegir rival: fila con Nivel BRAMU simulado (Facundo, sin historial todavía, `5.4`) visible
  y con el acento de color correcto (azul, contexto rival).
- Perfil público de Facundo tras perder su primer partido: Nivel BRAMU `4.8` (real, derivado
  igual que el propio — base 5.0 menos 0.2 por la derrota), Efectividad 0%, Mejor racha `—`,
  Mejor nivel BRAMU `4.8 ACT` — coherentes entre sí.
- AGREGAR JUGADOR → JUGADOR AGREGADO: toggle verificado en ambos sentidos.
- Tab JUGADORES: fila de Facundo con el mismo Nivel BRAMU (`4.8`) que su perfil; estado vacío
  verificado quitándolo y volviendo a entrar a Perfil.
- Acceso desde Rivales: fila de Facundo individualizada → abre su perfil público → volver
  regresa a Rivales (origen de navegación respetado).
- Perfil público de Matías (compañero, ganó su partido): Efectividad 100%, Mejor racha
  "1 victoria · SEP 26", Mejor nivel BRAMU `5.2 ACT` — todo derivado del mismo partido real.

**Desktop (1280×900):** mismo flujo (Home → Buscar Jugadores → perfil público) re-verificado,
sin ningún desborde ni layout roto — la app ya usa un ancho máximo centrado en pantallas
grandes (sin cambios de esta ronda).

Sin regresiones detectadas en Home, MI PERFIL, MIS DATOS, Compañeros/Rivales (fuera de la
fila ahora clickeable) ni Elegir compañero/rival (selección/exclusión/secuencia automática
sin cambios).

---

## 12. PWA y versión

- `Store.VERSION`: `"BRAMUlab V03.2.2"` → **`"BRAMUlab V03.3"`**.
- `version.json` actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-2-2` → **`bramulab-v03-3`**.
- `?v=03.2.2` → **`?v=03.3`** en `index.html`/`sw.js` (los 4 puntos de la versión, ver
  [[project_bramu_lab_v03_1_6_cache_fix]]).
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 13. Hash exacto y tag

- Commit de implementación (código + Consolidado): `796f97f5e5c11073460e1fc66f6017d3f3318667`.
- Tag `BRAMUlab_V03.3` apunta al commit inmediatamente posterior a este informe.

---

## 14. Qué no se tocó

Home (salvo la nueva tarjeta al final), MI PERFIL, MIS DATOS, selector de jugadores (salvo
sumar Nivel BRAMU/separadores, sin tocar buscador/avatar/nombre/`@usuario`/lógica de
selección/navegación del partido), Resumen, motor de partido, backend. No se implementó
ningún elemento de la lista de exclusión del consolidado (§11): seguidores, amigos,
solicitudes de amistad, contadores, popularidad, mensajes, chat, invitaciones, armado de
partido desde perfil, compartir perfil, bloqueo, privacidad avanzada, recomendaciones
sociales, grupos, notificaciones sociales — todo queda futuro, como pide el consolidado.
