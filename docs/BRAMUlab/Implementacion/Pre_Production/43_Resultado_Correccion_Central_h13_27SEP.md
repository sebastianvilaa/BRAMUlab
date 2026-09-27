# BRAMUlab — Resultado: corrección de alcance de h12 (4 puntos de la revisión Central)

**Rama:** `staging`
**Fecha:** 27/09/2026
**Bundle:** `04.11-h12` → `04.11-h13`
**Origen:** [`42_Revision_Central_h12_Completar_Alcance_27SEP.md`](42_Revision_Central_h12_Completar_Alcance_27SEP.md), revisión de código de Central sobre `b229d23` (HEAD de h12).

No se reabrió la investigación de identidad de Matu (Central ya confirmó en Supabase Staging que hay una sola identidad real) ni se tocó backend, Nivel, Ranking, Intelligence, self-healing h11, la lógica de aceptación/rechazo, ni el editor de sets.

---

## A — Quien propuso ve su propuesta completa

`paintB6Actions` distinguía `proposedByTeam !== f.myTeam` para decidir si mostraba el bloque completo, pero la rama `else if (proposedByTeam)` (quien propuso) solo mostraba un banner genérico ("Tu propuesta... esperando respuesta") sin la tarjeta completa que el handoff 40 pedía explícitamente.

**Corrección:** el mismo `#b6-respond-correction-block` (mismos datos, mismo `buildCorrectionPreviewCardHTML`, nunca una segunda representación) ahora se abre para las dos partes de una corrección activa:

- `isResponder = proposedByTeam !== f.myTeam`;
- para quien responde: sin cambios (label `Corrección propuesta por [nombre]`, fila `Aceptar/Rechazar` visible);
- para quien propuso: label `Tu corrección propuesta`, texto `Esperando respuesta de la otra pareja.`, fila de acciones oculta (`#b6-respond-action-row`, nuevo id agregado solo para poder ocultarla sin tocar el resto del bloque) — nunca puede aceptar/rechazar su propia propuesta.

La tarjeta oficial de arriba (`#analysis-result-official-label`) se rotula igual para ambos casos.

---

## B — `CORRECCIÓN PROPUESTA` elevada en Home/Historial

El informe 41 decía "sin cambios" en Home/Historial; el código confirmó que el badge seguía siendo el mismo pill de 10px que cualquier estado neutro, y que un partido `validated` con corrección activa seguía usando el acento win/loss normal en Último partido.

**Corrección, sin tocar VICTORIA/DERROTA oficial:**

- `serverMatchStatusBadgeModifier` devuelve ahora un modificador propio, `'correction'` (antes reusaba `'waiting'`), para `status==='validated' && pendingCorrectionRevisionId` — separado del `'waiting'` genérico de "esperando que confirmen un pendiente", para poder darle su propio peso sin afectar ese otro caso.
- `.history-item__badge--correction` / `.player-home-lastmatch__badge--correction` (CSS nuevo, mismo tono ámbar `--gold` que ya usa `--waiting`): `font-size` 10px→11px y `font-weight:800` explícito — más presencia sin volverse una alerta agresiva ni un color nuevo.
- `renderPlayerLastMatchCard`: la tarjeta de Último partido adopta el acento `--waiting` (ámbar) cuando hay una corrección activa (`status==='validated' && pendingCorrectionRevisionId && b6CorrectionWindowOpen(m)` — misma ventana de 3 días que usa el resto de la app), evaluado ANTES que el acento win/loss, para que tenga precedencia visual. El texto `VICTORIA`/`DERROTA` (dato deportivo oficial) no se toca.

---

## C — Nivel BRAMU real en Compañeros/Rivales

`openPersonListScreen` ya pedía `Auth.getPlayersCompact` (batch, agregado en la ronda h12) para avatar/`@username`, pero nunca leía `levelStatus`/`levelPublic` de esa misma respuesta, aunque el handoff 40 pedía explícitamente Nivel BRAMU vigente en esas filas.

**Corrección:** se agrega el Nivel real usando el `compactById` YA obtenido — **sin ninguna llamada de red nueva** (verificado: sigue habiendo una única `Auth.getPlayersCompact` en la función). Mismo gate que ya usa `buildCompactPlayerRowHTML` (`levelStatus` distinto de `'PENDIENTE'` y `levelPublic` numérico — no solo `CALIBRADO`, para no inventar una segunda regla de validación); sin dato real, el chip completo se omite (nunca un `—` que le reste protagonismo a la efectividad, que sigue siendo el dato principal de la fila). Se muestra como `· Nivel BRAMU X.X` junto al nombre/`@usuario`, reutilizando el token visual `.group-table__handle` ya existente — sin destruir ni mover partidos/victorias/derrotas/efectividad.

---

## D — Salida explícita "Por identificar"

El backend ya dejaba el slot como `Por identificar` apenas se reportaba la incidencia (`report_identity_issue`), pero la única forma de "confirmar" esa decisión era cerrar el sheet con la X y descubrir por accidente que el estado se conservaba — nunca una acción visible.

**Corrección, sin backend nuevo:**

- título del sheet: `¿QUIÉN JUGÓ REALMENTE?` → `¿SABÉS QUIÉN JUGÓ?`;
- nuevo botón secundario `No sé · dejar Por identificar` (`.link-btn`, mismo tratamiento discreto que "No encuentro mi ubicación"), debajo de la lista de búsqueda/reemplazo, que sigue siendo el camino principal;
- `confirmIdentityUnresolved()`: **no llama a ninguna RPC** (verificado por test) — solo cierra el sheet y confirma con un toast (`Este lugar queda como Por identificar.`). La incidencia sigue abierta dentro de su ventana de 7 días y puede completarse después desde el mismo partido, exactamente igual que si se hubiera cerrado con la X.

---

## Tests

- **Nuevos:** `bramulab/revision-central-h12.test.mjs` — 10 tests estáticos, uno o más por cada punto A–D (incluye verificar que `openPersonListScreen` sigue haciendo una única llamada a `getPlayersCompact`, y que `confirmIdentityUnresolved` nunca invoca `MV.`/`Auth.`/`Matches.`).
- **Suite Node completa:** `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs supabase/scripts/*.test.mjs` → **325/325 OK** (315 previas + 10 nuevas).
- **`tests.html`:** **1564/1564 OK — todo verde**, sin cambios (ninguna función pura de `match-load.js`/`engine.js` se tocó).
- **Smoke boot de `index.html`:** sin errores de consola nuevos (el único 404, `env.generated.js`, es el artefacto de build ya documentado); `PLStore.BUNDLE_VERSION === '04.11-h13'`; verificado en DOM real que `#b6-respond-action-row` existe, el botón `No sé · dejar Por identificar` y el título `¿SABÉS QUIÉN JUGÓ?` están presentes, y que `.history-item__badge--correction`/`.player-home-lastmatch__badge--correction` renderizan `font-size:11px`/`font-weight:800` con el tono ámbar esperado.

No se repitieron pruebas manuales de h11/h12 (self-healing, editor de sets, identidad canónica de Matu).

---

## Bundle, commit y deploy

- **Bundle:** `04.11-h12` → `04.11-h13`, cuarteto completo (invalidación de cache obligatoria porque h12 ya estaba desplegado).
- **Commit:** único, correctivo, con el detalle de los 4 puntos en el mensaje.
- **Push:** `origin/staging`.
- **Deploy:** Vercel Staging — un único deploy intencional.

---

## Riesgos residuales

- El badge `--correction` reutiliza el mismo criterio de ventana física ya existente (`pendingCorrectionRevisionId` sin chequear la ventana de 3 días, igual que `serverMatchStatusLabel`/`serverMatchStatusBadgeModifier` ya hacían antes de esta ronda) — es un comportamiento preexistente, no introducido acá, y fuera del alcance de los 4 puntos pedidos.
- Ninguno de los 4 puntos tocó tablas/RPCs de Supabase — todo el trabajo fue frontend (`bramulab/`).

Sin decisiones abiertas nuevas.

---

## Batería física — se mantiene la misma de 5 bloques (41), ajustada a h13

1. **Identidad canónica / Matu** — sin cambios de esta ronda.
2. **Corrección de resultado** — además de lo ya pedido en h12, revisar ahora la vista de QUIEN PROPUSO la corrección (debe ver su propuesta completa, sin botones de aceptar/rechazar).
3. **Identidad incorrecta continua** — además de lo ya pedido en h12, probar el botón `No sé · dejar Por identificar` dentro del sheet.
4. **Home/Resumen/Reportar error** — agregar: con una corrección activa, la tarjeta de Último partido y la fila de Historial deben notarse claramente distintas de un partido cerrado sin novedad; Compañeros/Rivales deben mostrar Nivel cuando exista.
5. **Regresión visual rápida del + y navegación principal** — sin cambios de esta ronda.
