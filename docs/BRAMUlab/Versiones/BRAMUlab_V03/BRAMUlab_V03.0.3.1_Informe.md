# BRAMUlab V03.0.3.1
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 08/09/2026.
**Base:** BRAMUlab V03.0.3 (commit `3ca1357`, tag `BRAMUlab_V03.0.3`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.1_Consolidado.md` — parche corto: recuperación simulada de contraseña + 3 ajustes menores de Perfil.
**Estado:** publicado en producción.

---

## 1. Auditoría previa

Antes de tocar código se auditó el estado real contra V03.0.3:

- No existía ningún flujo de "olvidé mi contraseña" — `initLoginScreen` solo manejaba el submit
  de login. El único camino para cambiar una contraseña era "Cambiar contraseña" (requiere ya
  estar logueado y saber la actual) — no servía para el caso "no puedo entrar".
- `Store.getUserByEmail`/`Store.getUserById`/`Store.updateUserAccount` ya existían y exportados
  (V03.0), suficientes para toda la lógica del parche sin tocar `store.js`.
- La cabecera de MI PERFIL (`renderProfileEvolution`) ya calculaba `change`/`change.direction` y
  los pintaba en `#mi-perfil-level-delta` — el dato correcto, en el lugar equivocado según el
  consolidado.
- "Quitar foto" vivía en 3 lugares: MI PERFIL, MIS DATOS y Editar Datos. El consolidado (§5)
  nombra solo los primeros dos — Editar Datos queda fuera de alcance, no se tocó.
- "SIMULADO" en UI aparecía en un único punto: el badge de la tarjeta de Evolución
  (`SIMULADO · BETA`). Ranking no la mostraba (ya decía "el ranking no está listo", sin esa
  palabra) — nada que quitar ahí.

Alcance confirmado sin contradicciones ni necesidad de salir de lo pedido. Implementación
directa, sin plan intermedio (autorización del consolidado §11).

---

## 2. Flujo "¿Olvidaste tu contraseña?"

### Entrada
En **INICIAR SESIÓN**, nuevo link secundario `¿Olvidaste tu contraseña?` debajo del CTA
principal — mismo `.link-btn` discreto que usa el resto de la app (nunca compite visualmente
con "INICIAR SESIÓN").

### 3 pasos en una sola vista
Nueva `#view-forgot-password`, mismo patrón que el wizard de signup: una vista, el paso lo
maneja un `forgotPasswordStep` de módulo (sin pasar por `showView` entre pasos).

1. **Email** → `Store.getUserByEmail(email)`. Si no existe: "No encontramos una cuenta con ese
   email." (no avanza). Si existe: guarda `userId`/email en variables de módulo y pasa a Paso 2.
2. **Código** → compara contra la constante `FORGOT_PASSWORD_CODE = '123456'`. Cualquier otro
   valor: "Código incorrecto." (no avanza). `123456` pasa a Paso 3.
3. **Nueva contraseña** → mismo checklist de fuerza (`PLI.checkPasswordStrength`) y comparación
   (`PLI.passwordsMatch`) que Cambiar contraseña/Completar Acceso/Signup. Ambos campos con el
   mismo ojo mostrar/ocultar (`wirePasswordToggle`) que el resto de la app.

Al guardar: `Store.updateUserAccount(user.id, { password: next })` — el único campo que cambia.
Vuelve a **INICIAR SESIÓN** con el email precompletado, toast **"Contraseña actualizada"**.

### La simulación queda en la lógica, no en la interfaz (consolidado §2, IMPORTANTE)
No hay ningún texto "Simulado"/"Código de prueba"/"Demo"/aviso de "no se envía email real" en
las 3 pantallas — verificado leyendo el texto visible completo de cada paso durante el QA. El
código fijo y la ausencia de envío real viven únicamente en la constante `FORGOT_PASSWORD_CODE`
del código y en los comentarios técnicos que la documentan.

---

## 3. Regla crítica — misma cuenta, un solo campo cambia

`Store.updateUserAccount(user.id, { password: next })` es la ÚNICA escritura del flujo
completo. Nunca se llama `createUserAccount`/`signUpAndLogin` en ningún punto de la
recuperación — no hay forma de que termine creando una cuenta nueva por error.

Verificado en vivo contra una cuenta de prueba con email/contraseña real (la cuenta fija
"Seba" del dispositivo no tiene email, así que no sirve para probar login — se usó una cuenta
temporal creada y borrada solo para este QA, sin tocar los datos reales del dispositivo):
`userId`, email, username, displayName, foto de perfil, una entrada de historial y una
notificación previa de esa cuenta quedaron exactamente iguales antes/después de cambiar la
contraseña. La contraseña vieja quedó rechazada por `Store.loginWithEmail`; la nueva permitió
loguear con normalidad y llegar al Home de esa misma cuenta.

---

## 4. MI PERFIL — Nivel BRAMU más limpio

Cabecera de MI PERFIL (`renderProfileEvolution`) ahora muestra únicamente el Nivel BRAMU
actual (ej. `6.5`). Se retira de ahí `+X`/última subida/variación reciente:
`#mi-perfil-level-delta` deja de recibir texto y clase de color, queda siempre en su variante
`--flat` (oculta por CSS).

No se borró ningún cálculo: `change`/`change.direction` (el mismo dato que antes se mostraba
ahí) se siguen calculando exactamente igual y se siguen usando, sin cambios, en
`#evolution-change-value` (tarjeta de Evolución, más abajo) y en la Tarjeta del Home
(`renderPlayerCard`, elemento aparte, nunca tocado). Un solo dato, dos lugares de lectura —
uno de ellos deja de mostrar la variación, el otro sigue igual.

---

## 5. "Quitar foto" — retirado de MI PERFIL y MIS DATOS

Se quitaron los botones `#mi-perfil-avatar-remove-btn` y `#mis-datos-avatar-remove-btn` del
markup, y su wiring correspondiente en `wireInlineAvatarEdit` (el parámetro `removeLinkId` ya
no existe — la función solo abre el selector de archivo al tocar el avatar o su badge).

Se mantiene intacto: foto tappable, ícono cámara/lápiz, reemplazar foto (mismo
`downscaleImageFileToDataUrl` + `Store.updateUserAccount` de siempre). Verificado en vivo que
tocar el avatar sigue abriendo el selector de archivo correctamente en ambas pantallas.

**Editar Datos** (`view-edit-data`, la pantalla completa de edición) conserva su propio
"Quitar foto" — el consolidado (§5) nombra explícitamente solo MI PERFIL y MIS DATOS, y pide
"no agregar otro control de eliminación en esta ronda"; tocar una tercera pantalla no listada
habría sido salir del alcance sin necesidad real.

---

## 6. "SIMULADO" retirado de la UI

El badge de la tarjeta de Evolución pasó de `SIMULADO · BETA` a `BETA`. Es el único lugar
donde la palabra era visible (Ranking, Perfil y el resto de la UI no la mostraban). La lógica
subyacente (el gráfico sigue siendo una serie simulada, no una fórmula real) no cambia — solo
se retiró la palabra. Los comentarios técnicos que documentan que es simulado se mantienen sin
tocar, tal como autoriza el consolidado.

---

## 7. Historial / Ranking / Evolución

Sin cambios — ninguno de los tres requería ajuste (Historial no fue tocado en absoluto; Ranking
no mostraba "SIMULADO"; Evolución no recibió más cambios de gráfico que los del propio §4, que
son de MI PERFIL, no del gráfico en sí).

---

## 8. Tests

**693/693 en verde** (611 previos a V03.0.3 + 71 de V03.0.2/V03.0.3 + 11 nuevos de esta ronda).

Nuevo bloque `V03031-RECUPERAR` (10 casos, mismo patrón snapshot/restore `AFFECTED_KEYS` que
los bloques anteriores): email existente permite avanzar · email inexistente bloquea ·
reemplazo de contraseña conserva `userId` · contraseña vieja deja de funcionar (`loginWithEmail`)
· contraseña nueva permite login · email/username/displayName intactos · foto de perfil intacta
· historial de partidos intacto · notificaciones intactas · otra cuenta local del mismo
dispositivo no se modifica.

El código fijo `123456` y el avance visual paso 1→2→3 son lógica de `app.js` (UI/DOM), fuera
del alcance de `tests.html` — mismo límite documentado en los informes V03.0.1/V03.0.2/V03.0.3
(`app.js` no se carga ahí). Cubierto por QA manual (§9).

### Bug de higiene de tests detectado y corregido (no es un bug de producto)
Al validar el bloque nuevo contra el dispositivo de desarrollo real, se detectó que
`Store.signUpAndLogin` también escribe `bramulab.currentPlayerName.v1` y
`bramulab.playerNames.v1` (vía `saveCurrentPlayerName`/`rememberPlayerNames`) — dos claves que
el bloque `V0303-AVATAR` (heredado de V03.0.3) y el bloque nuevo de esta ronda no tenían
protegidas en su `AFFECTED_KEYS`. Efecto real observado: nombres de prueba ("Foto", "Recu",
"Otra") quedaban filtrados en el dispositivo real después de correr la suite, aunque
`users.v1`/`session.v1` sí se restauraban bien. Corregido agregando ambas claves al
`AFFECTED_KEYS` de los dos bloques que usan `signUpAndLogin`. Verificado corriendo la suite
completa dos veces seguidas contra el dispositivo real: el dispositivo queda exactamente igual
antes y después en ambos casos.

---

## 9. QA manual mobile + desktop

Checklist del consolidado §10, contra el dev server local:

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Login muestra "¿Olvidaste tu contraseña?" | ✅ |
| 2 | Email válido → código | ✅ |
| 3 | Email inválido → error | ✅ "No encontramos una cuenta con ese email." |
| 4 | Código incorrecto → error | ✅ "Código incorrecto." |
| 5 | `123456` → Nueva contraseña | ✅ |
| 6 | Eye icon funciona | ✅ alterna `type="password"`/`"text"` |
| 7 | Guardar funciona | ✅ contraseña débil y no coincidente bloquean; válida guarda |
| 8 | Login con clave vieja falla | ✅ |
| 9 | Login con clave nueva funciona | ✅ llega al Home de la misma cuenta |
| 10 | La cuenta conserva todos los datos | ✅ `userId`/email/username/displayName/foto/historial/notificaciones intactos |
| 11 | MI PERFIL muestra solo Nivel BRAMU actual | ✅ sin `+X` en la cabecera |
| 12 | No aparece "Quitar foto" | ✅ en MI PERFIL y MIS DATOS |
| 13 | Tocar foto sigue permitiendo cambiarla | ✅ abre selector de archivo |
| 14 | No aparece "SIMULADO" | ✅ badge ahora dice solo "BETA" |
| 15 | Home/Historial/Notificaciones sin regresiones | ✅ Home baseline exacto, sin cambios |
| 16 | Suite completa verde | ✅ 693/693 |

Mobile (375×812): pantalla de recuperación paso 1 verificada con captura completa (título,
subtítulo, campo, CTA); login verificado con `getComputedStyle` (link centrado, sin superponer
al botón principal — `top` del link 8px por debajo del `bottom` del CTA). Sin errores de
consola ni requests fallidos atribuibles a la app (los únicos 404 registrados vienen de una
URL de prueba propia del proceso de QA, no de la app en uso).

La cuenta real del dispositivo ("Seba", 2 partidos, sin email) se dejó exactamente como
estaba: mismo Nivel BRAMU (5.0, ↑0.2), mismo último partido (6-1 · 6-2, 07SEP · 17:28), misma
efectividad (50%), misma racha (1 victoria seguida), mismo rival más enfrentado (Gusti · 2
enfrentamientos) — confirmado por comparación textual exacta antes/después de todo el QA.

---

## 10. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.0.3"` → **`"BRAMUlab V03.0.3.1"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-0-3` → **`bramulab-v03-0-3-1`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 11. Hash exacto y tag

- Commit de implementación (código): `2e7852ff079aa5f661a594b2b19e821253e82ebb`.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.0.3.1` apuntará al commit inmediatamente posterior a este.

---

## 12. Diferencias justificadas respecto del consolidado

1. **CTA del Paso 2 ("VALIDAR CÓDIGO")**: el consolidado no especifica el texto del botón de
   ese paso (solo da los textos de Paso 1 y Paso 3). Se usó un verbo imperativo en mayúsculas
   consistente con el resto de los CTA de la app, sin agregar ningún paso ni campo nuevo.
2. **Bug de higiene de tests corregido junto con el bloque nuevo** (§8): no estaba en el
   consolidado — apareció al validar el bloque nuevo contra el dispositivo real y afecta al
   mismo patrón `AFFECTED_KEYS` que este mismo parche introduce, así que se corrigió de una
   vez en vez de dejarlo pendiente para otra ronda.
3. **Limpieza de CSS muerta**: `.profile-avatar-remove-link` (estilo exclusivo de los botones
   "Quitar foto" retirados en §5) se eliminó de `styles.css` por quedar sin ningún selector que
   la usara — no una regla nueva, la baja de una que perdió su único uso.

---

## 13. Qué no se tocó

Backend, Supabase/Firebase, recuperación real de contraseña (con email real/servidor), envío
de emails, ranking real, social/amigos, compartir partidos, notificaciones push, fórmula real
de Nivel BRAMU (`computeLevelEvolution` sin cambios), gráfico de Evolución (mismo SVG/escala
de V03.0.3), Historial, flujo invitado, tabs Punto a punto/Por games, modelo de Notificaciones
(V03.0.2), Player Intelligence, arquitectura de identidad (`findPlayerRow`, `userId`,
`SCHEMA_VERSION` se mantiene en 3), Editar Datos (conserva su propio "Quitar foto").
