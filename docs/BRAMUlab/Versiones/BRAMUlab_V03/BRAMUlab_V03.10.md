# BRAMUlab V03.10 — cierre final de V03

**Estado:** implementada y publicada.
**Base:** BRAMUlab V03.9 (commit `cd217bb`, tag `BRAMUlab_V03.9`, 1052/1052 tests).
**Fuente:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.10_Handoff_Cierre_V03.md` (supera al handoff `BRAMUlab_V03.10_Handoff_Cierre_Editorial_Tu_Momento.md`, ignorado).
**Objetivo:** micro-ronda final sobre V03.9 con dos ajustes reales de QA. No abre nuevos frentes, no rediseña Home, no avanza a V04, no consolida V03 todavía.

---

## 1. Objetivo

1. Cerrar de forma conservadora el comportamiento editorial de `TU MOMENTO` antes de BRAMU Intelligence.
2. Mejorar la identificación de jugadores en las listas de Compañeros/Rivales abiertas desde Home.

## 2. Decisiones

- **TU MOMENTO — forma reciente solo si es positiva**: la cláusula de forma reciente entra ÚNICAMENTE cuando victorias > derrotas (`Ganaste X de tus últimos N partidos`). Con empate o mayoría de derrotas, la cláusula se OMITE por completo — nunca se reemplaza por "Perdiste..." ni por un framing neutro (esa era la solución de V03.9, ahora superada). El mecanismo sigue con el siguiente candidato disponible (Ranking / compañero / actividad), sin cambiar la prioridad vigente. El insight de Ranking sigue pudiendo mostrar movimiento negativo (`↓ N esta semana`) — es un hecho de posición, no una interpretación del rendimiento. Interpretar rachas/tendencias queda deliberadamente para BRAMU Intelligence (V05); `TU MOMENTO` se mantiene como superficie liviana y determinística.
- **Compañeros/Rivales — identidad segura**: las filas muestran `Nombre · @username` cuando existe una cuenta BRAMU real resoluble. `userId` (guardado en `match.players[]` desde V03.0) es autoritativo y exclusivo: se resuelve por ese ID, nunca se sustituye por coincidencia de nombre. Para registros legacy sin `userId`, se usa el mismo fallback de resolución por nombre ya existente en el proyecto, pero solo se considera "seguro" (y por lo tanto se muestra `@username`) si resuelve a EXACTAMENTE una cuenta real — con nombre ambiguo (dos o más cuentas), se prefiere mostrar solo el nombre antes que arriesgar un username incorrecto. Nunca se inventa ni deriva un `@username` del nombre. Aplica igual a Compañeros y a Rivales. Se tomó Mis Grupos como referencia VISUAL (tokens `.group-table__toprow`/`__name`/`__handle`), no como referencia de resolución de identidad — Mis Grupos hoy sí deriva un handle sintético cuando no hay cuenta real (`buildPlayerHandle`), comportamiento que esta ronda explícitamente no replica.

## 3. Alcance

- `bramulab/player-home.js` — framing de `buildTuMomentoText`; `getPartnerRow`/`getOpponentRows` (variantes de fila cruda); `buildPersonBreakdown`/`computeTeammateBreakdown`/`computeRivalBreakdown` agregan por identidad (`userId` autoritativo).
- `bramulab/app.js` — `resolvePersonAccount` (identidad segura); `openPersonListScreen` pinta `Nombre · @username`.
- `bramulab/styles.css` — reutiliza `.group-table__toprow`/`__name`/`__handle` en las tarjetas de `person-list`; retira `.person-list__name`, que quedó sin uso.
- `bramulab/tests.html` — tests focales nuevos; 2 aserciones de V03.9 actualizadas al nuevo comportamiento (ya no generan "Perdiste...").
- Versionado: `bramulab/store.js`, `bramulab/version.json`, `bramulab/sw.js`, `bramulab/index.html`.

## 4. Fuera de alcance

BRAMU Intelligence (interpretación de rachas/tendencias — queda para V05), lógica semanal de Ranking, geografía, Mi red, tarjeta territorial de Perfil, `Explorar rankings`, Nivel BRAMU, Backend, validación de partidos, historial multiusuario, WhatsApp, rediseño de Mis Grupos (usado solo como referencia visual), diseño global.

## 5. QA esperado

Mobile 375px primero: Home con balance 0W/5L nunca muestra "Perdiste 5 de tus últimos 5 partidos" (Ranking o el siguiente candidato ocupan su lugar); Home con balance 3W/2L sigue mostrando "Ganaste 3 de tus últimos 5 partidos"; Compañeros/Rivales muestran `@username` para cuentas reales y solo el nombre para jugadores sin cuenta; dos cuentas con el mismo nombre visible y `userId` distinto nunca se funden en una fila ni muestran el username de la otra; estadísticas/efectividad intactas; sin overflow. Chequeo rápido en tablet.
