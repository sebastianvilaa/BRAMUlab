# BRAMU Lab — Rama Jugador
## Auditoría funcional: por qué un partido cargado por el "+" puede no aparecer en el Home

Análisis únicamente. No se modificó código, estilos ni comportamiento para producir este documento.

---

## 1. Resumen del hallazgo

**Causa raíz:** el formulario de "Cargar partido jugado" nunca estuvo conectado con la identidad del jugador actual. Los cuatro campos de nombre (`Jugador 1`–`Jugador 4`) son texto libre, vacíos por default, sin ningún vínculo programático con `currentPlayerName`. Si la persona que carga el partido no vuelve a escribir su propio nombre exactamente igual a como quedó guardado al identificarse en "Mi pádel" (mismo texto, mismas tildes), el partido se guarda igual —aparece en Historial sin problema— pero `player-home.js` nunca lo va a asociar al jugador actual, porque el filtro depende de una coincidencia exacta de string.

Es un problema de **flujo de datos**, no de lógica de filtrado: el filtro (`filterMatchesForPlayer`) funciona correctamente con los datos que recibe; el problema es que nada garantiza que esos datos alguna vez contengan el nombre correcto en el lugar correcto.

Esto no es una sorpresa aislada: ya estaba señalado como deuda deliberada en el análisis de la Etapa 1 (`BRAMU_Rama_Jugador_Etapa_1_Analisis.md`, sección F) — "identidad de jugador por string, no por ID" — pero ese documento no había llegado a la consecuencia concreta y diaria que esto tiene: **cargar tu propio partido y no verlo reflejado en tu propio Home**, que es exactamente el síntoma reportado.

---

## 2. Cómo se identifica al jugador actual

- El nombre se guarda una sola vez, en `padellab.currentPlayerName.v1` (`bramu-lab/store.js`, `saveCurrentPlayerName`), a través del modal "¿Quién sos?" (`openPlayerIdentifyModal`/`initPlayerIdentifyModal`, `bramu-lab/app.js:4589-4611`).
- Se normaliza con `Store.normalizePlayerName` (`bramu-lab/store.js`): colapsa espacios y aplica Title Case en español (`sebastián vila` → `Sebastián Vila`). **No** normaliza tildes/diacríticos ni corrige errores de tipeo — ver sección 4.
- `renderPlayerHome()` (`bramu-lab/app.js:4618-4634`) relee `Store.loadCurrentPlayerName()` cada vez que se abre el Home, así que el nombre en sí siempre está actualizado. El problema no es que el Home lea mal el nombre — es que nunca lo usa para completar el formulario de carga.

---

## 3. Cómo (no) se vincula esa identidad con Jugador 1

Este es el corazón del hallazgo. Tanto el formulario de partido en vivo como el de carga manual tratan a "Jugador 1" igual que a cualquier otro jugador: un campo de texto vacío, sin relación con quién está usando la app.

- **Carga manual** (`bramu-lab/index.html:713`): `<input id="manual-player-1" ... placeholder="Jugador 1" />` — mismo placeholder genérico que Jugador 2/3/4, ningún indicio visual de que ahí "debería" ir el propio nombre.
- **`openManualLoadScreen()`** (`bramu-lab/app.js:516-537`), que se ejecuta cada vez que se abre esta pantalla —incluido desde el "+" del Home del jugador (`origin === 'player-home'`)— nunca lee `currentPlayerName` ni completa ningún campo. Solo resetea el formulario, formato y sistema de puntuación por default.
- **`saveManualMatch()`** (`bramu-lab/app.js:539-565`) arma los 4 jugadores así:
  ```js
  const nameOrDefault = (id, fallback) => { const v = normalizePlayerName($(`#${id}`).value); return v || fallback; };
  const players = [
    { id: 0, team: 'A', name: nameOrDefault('manual-player-1', 'Jugador 1') },
    ...
  ];
  ```
  Si el campo Jugador 1 queda vacío, el nombre guardado es literalmente el string `"Jugador 1"` — que nunca va a coincidir con `currentPlayerName` (p. ej. `"Sebastián"`).
- El mismo patrón exacto existe en el formulario de partido en vivo (`bramu-lab/index.html:89`, `#player-1`, y `startNewMatch()` en `bramu-lab/app.js`) — no es específico de la carga manual, es un vacío estructural de **ambos** puntos de entrada de partidos.

En otras palabras: hoy, la única forma de que un partido "cuente" para el Home del jugador es que la persona, cada vez que carga un partido, vuelva a tipear su propio nombre a mano en uno de los cuatro campos, sin ninguna ayuda ni confirmación de que lo hizo bien.

---

## 4. Por qué el nombre puede no coincidir aunque se escriba "a mano"

Incluso si el usuario SÍ se acuerda de escribir su propio nombre, hay maneras razonables de que no coincida con `currentPlayerName`:

1. **Campo vacío** (el caso más probable): la persona completa Compañero/Rival 1/Rival 2 y dejar "Jugador 1" en blanco es un error muy fácil de cometer — sobre todo viniendo de "Mi pádel", donde ya se identificó, es intuitivo asumir que la app "ya sabe quién sos" y no hace falta repetirlo.
2. **Tildes/diacríticos**: `Store.normalizePlayerName` no los toca. `"Sebastian"` (sin tilde) y `"Sebastián"` (con tilde) normalizan a strings distintos — `filterMatchesForPlayer` los trata como personas distintas.
3. **Apodos o variantes**: `"Sebas"` vs. `"Sebastián"`, o nombre + apellido en un lado y solo nombre en el otro — normalización de mayúsculas/espacios no resuelve esto, porque son strings genuinamente distintos, no una cuestión de formato.
4. **Autocompletado engañoso**: el campo usa `list="known-players"` (mismo `<datalist>` compartido por todos los formularios), que sugiere nombres ya usados alguna vez — incluyendo variantes previas mal escritas del propio jugador, si las hubo. El autocompletado ayuda a *repetir* un nombre existente, pero no distingue "vos" del resto de la lista.

Ítems 2 y 3 son secundarios frente al ítem 1, pero conviene tenerlos presentes porque **la solución de autocompletar Jugador 1 (sección 8) los resuelve a todos de una vez** — si el nombre nunca se re-tipea, ninguna de estas variantes puede aparecer.

---

## 5. Qué datos persiste el flujo manual

Confirmado en `finishMatchManual()` (`bramu-lab/app.js:572-608`): el snapshot guardado (`Store.upsertHistory`) incluye, entre otros campos, `matchId`, `players` (el array de 4 `{id, team, name}` recién armado), `mode: 'manual'`, `sets`, `winnerTeam`, `finishedAt`. Es la MISMA estructura que usan los partidos Completo/Por Games — no hay una segunda tabla ni un campo separado para "quién soy yo en este partido". El vínculo con el jugador actual es puramente posicional/por nombre, nunca explícito (no existe, por ejemplo, un `ownerId` o `loggedInAs` en el snapshot).

---

## 6. Cómo filtra `player-home.js`

`filterMatchesForPlayer(history, playerName)` (`bramu-lab/player-home.js`):
```js
const target = Store.normalizePlayerName(playerName);
return (history || [])
  .filter((m) => m && Array.isArray(m.players) && m.players.some((p) => p && p.name === target));
```
Es una comparación exacta (`===`) contra el nombre normalizado. **Esto es correcto y esperable dado el modelo actual** — no hay ningún bug en el filtro en sí. El problema, confirmado, está 100% aguas arriba: en qué termina guardado en `m.players[].name` al momento de cargar el partido (sección 3).

---

## 7. Por qué aparece en Historial pero no en el Home

`renderHistory()` (`bramu-lab/app.js`, sección Historial) llama a `Store.loadHistory()` y muestra **todos** los partidos, sin ningún filtro por jugador — es, a propósito, la vista global de todo lo cargado en el dispositivo. El Home del jugador, en cambio, siempre pasa ese mismo array por `filterMatchesForPlayer` antes de mostrar nada. Un partido guardado con `players: [{name:"Jugador 1"}, {name:"Martín"}, ...]` va a aparecer en Historial (que no le importa quién jugó) pero desaparece del Home apenas se filtra por `"Sebastián"` — exactamente el síntoma reportado, y consistente en el 100% de los casos donde Jugador 1 no coincide con `currentPlayerName`.

---

## 8. Propuesta: autocompletar Jugador 1 con el jugador logueado

No implementado todavía — queda documentado para la próxima etapa.

**Idea central:** cuando existe un `currentPlayerName`, el formulario de carga (y, por consistencia, también el de partido en vivo) debería completar Jugador 1 automáticamente con ese nombre, dejando que la persona solo complete compañero y rivales.

Puntos a resolver en la especificación de esa etapa (no decisiones tomadas acá, solo lo que hay que definir):

- **Dónde se pre-completa:** en `openManualLoadScreen(origin)` (`bramu-lab/app.js:516`), leyendo `Store.loadCurrentPlayerName()` y asignando el valor a `#manual-player-1` antes de mostrar la pantalla — el hook natural, porque ya se ejecuta cada vez que se abre esta vista.
- **¿Editable o fijo?** Lo más seguro para no comprometer la beta con datos ficticios (Etapa 2, §6) es dejarlo pre-completado pero editable, no bloqueado — mismo criterio de "no candar" que ya usa el resto de la app. Fijarlo del todo es una decisión de producto para más adelante, cuando "jugador" deje de ser un nombre libre (ver sección 9).
- **Indicación visual:** hoy Jugador 1 se ve igual que los otros 3 campos. Convendría alguna marca (etiqueta "Vos", badge, o simplemente que venga completo y los otros no) para que quede claro qué pasó y por qué ese campo ya tiene texto.
- **Qué pasa sin jugador identificado:** si todavía no existe `currentPlayerName` (alguien entra a cargar un partido desde el flujo tradicional de `view-setup`, sin haber pasado por "Mi pádel"), el campo se comporta exactamente igual que hoy — vacío, sin cambios. El fix es aditivo, no afecta ese camino.
- **Alcance a decidir:** ¿se aplica solo a `view-manual-load` (que es donde se reportó el problema), o también al formulario de partido en vivo (`view-setup`, `#player-1`)? Estructuralmente el mismo problema existe en ambos — lo señalo para que la próxima etapa decida el alcance con conocimiento de causa, no lo doy por resuelto acá.
- **Consecuencia esperada:** con esto, el problema descrito en la sección 4 (tildes, apodos, campo vacío) desaparece casi por completo, porque el nombre deja de re-tipearse — se copia tal cual quedó guardado en la identificación.

---

## 9. Nota aparte: "Cambiar jugador" no representa el modelo futuro

Señalado explícitamente para que quede documentado, sin implementar ningún cambio ahora.

Hoy "Cambiar jugador" (tarjeta de identidad del Home y vista Perfil, `bramu-lab/app.js`, `openPlayerIdentifyModal(true)`) trata al jugador actual como una preferencia liviana y libremente reemplazable — coherente con el modelo de texto libre de esta beta, pero **no** con hacia dónde va el producto. El propio documento de Etapa 1 (sección "Rol de BRAMU Intelligence" y roadmap en memoria del proyecto) ya anticipa una identidad más parecida a una cuenta/sesión real.

Cuando el jugador deje de ser "un nombre que se puede cambiar en cualquier momento" y pase a ser una sesión/cuenta:
- "Cambiar jugador" debería dejar de existir con ese nombre y ese significado (cambiar de identidad libremente ya no tendría sentido como acción casual).
- Correspondería un flujo de **"Cerrar sesión"** (y, en algún momento, inicio de sesión real) en su lugar, separado conceptualmente de "elegir quién sos la primera vez".
- Esto afecta dos lugares hoy: la tarjeta de identidad del Home y la vista Perfil — ambos reutilizan el mismo modal "¿Quién sos?" tanto para la primera identificación como para "cambiar", lo cual es razonable para la beta pero dejaría de serlo con cuentas reales (identificarse por primera vez y cerrar sesión son acciones distintas).

No se propone una solución todavía — es una nota de diseño para que la próxima etapa la tenga en cuenta al momento de decidir alcance, no una tarea abierta.

---

## 10. Resumen de lo que queda pendiente para la próxima etapa (nada de esto está implementado)

1. Autocompletar Jugador 1 con `currentPlayerName` en `openManualLoadScreen` (sección 8), decidiendo editable/fijo, indicación visual, y si también aplica al formulario de partido en vivo.
2. Evaluar si conviene además una advertencia o confirmación cuando se guarda un partido manual sin que ningún jugador coincida con `currentPlayerName` (para no repetir este síntoma en otro escenario no cubierto por el autocompletado, p. ej. alguien cargando el partido de otra persona a propósito).
3. Reemplazar "Cambiar jugador" por un modelo de sesión/cuenta con "Cerrar sesión" cuando exista esa capa (sección 9) — no antes.
4. Considerar, a más largo plazo, si vale la pena algún tipo de normalización de diacríticos en `Store.normalizePlayerName` como red de seguridad adicional — de valor menor una vez resuelto el punto 1, porque deja de depender de que alguien retipee el nombre.
