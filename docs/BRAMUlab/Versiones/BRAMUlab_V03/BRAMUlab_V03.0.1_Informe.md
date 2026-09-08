# BRAMUlab V03.0.1
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V03.0 (commit `f1b4b37`, tag `BRAMUlab_V03.0`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.1_Consolidado.md` — ronda de UX, jerarquía y corrección de bugs sobre la identidad ya publicada en V03.0, validada en uso real. No reabre esa arquitectura.
**Estado:** publicado en producción.

---

## 1. Auditoría previa (obligatoria por el propio consolidado, §13)

Antes de tocar código se auditó el estado real de Perfil, Acceso y sesión (`app.js`,
`index.html`, `styles.css`) contra la implementación efectiva de V03.0. Tres hallazgos
determinaron el plan:

1. **Historial/Ranking/Perfil no estaban gateados por sesión** — `openHistoryScreen` y el
   handler de Ranking en `initBottomNav` nunca chequeaban `currentPlayerName`; solo
   `openPlayerHome`/`openManualLoadScreen` lo hacían. Tras `doLogout()`, la app volvía a
   `showView('setup')` — una vista que SÍ está en `BOTTOM_NAV_VIEWS`, así que la barra
   inferior reaparecía y esas pantallas quedaban alcanzables. Este era el bug real detrás del
   §7 del consolidado.
2. **Riesgo de partido de invitado ya existente, no hipotético** — `selectRegisterMode` lleva
   a `showView('setup')` sin ningún gate de identidad, y ese camino ya era alcanzable desde
   las pantallas ungateadas del punto anterior. `finishMatch`/`finishMatchGames` llamaban
   `Store.upsertHistory` incondicionalmente; un partido sin `userId` cae, por la regla de
   exclusividad de `findPlayerRow` (`player-home.js`, sin tocar), a comparación por nombre —
   es decir, un invitado con el mismo nombre visible que una cuenta real ya podía terminar
   apareciendo en el historial de esa cuenta por coincidencia.
3. **Home nunca leía `profilePhoto`** — `.player-card__avatar` era un SVG genérico hardcodeado
   sin ningún `<img>`; `renderPlayerCard` no lo consultaba, aunque Perfil/Editar Datos ya
   guardaban y mostraban la foto correctamente.

Plan presentado y aprobado antes de escribir código, con una corrección del usuario sobre el
borrador inicial: el ocultamiento de la navegación personal sin sesión debía ser **visual y
principal** (ocultar la barra inferior completa, incluso durante el flujo de invitado en
`setup`/`analysis`), no solo un gate interno por click. Los gates internos se mantuvieron
como protección adicional, tal como se pidió.

---

## 2. PERFIL — dos pestañas (MI PERFIL / MIS DATOS)

`#view-profile` (antes una sola pantalla larga) pasa a dos pestañas (`.profile-tabs`, mismo
patrón visual que `.history-tabs` de Historial):

- **MI PERFIL** (apertura por defecto, también al tocar la tarjeta del Home): identidad
  (avatar/nombre visible/@usuario, sin cambios), KPIs ya existentes reutilizados sin nueva
  lógica (`PH.computeEffectivenessTotal`, `PH.computeCurrentStreak` — las mismas funciones que
  ya usa el Home), y la tarjeta "Evolución del Nivel BRAMU" completa (movida tal cual, sin
  tocar `computeLevelEvolution`/`buildLevelEvolutionSvgHTML`).
- **MIS DATOS**: tres grupos (`.profile-group`) — Identidad (nombre/apellido/@usuario/nombre
  visible), Datos personales/deportivos (fecha nacimiento/género/mano/lado/categoría —
  mismos ids que antes, solo reagrupados), Acceso y seguridad (email, Cambiar contraseña,
  Cerrar sesión). Banner discreto "Completá tus datos" (chequeo de presencia simple sobre
  `firstName`/`birthDate`/`gender`/`dominantHand`/`preferredSide`/`declaredCategory`, sin
  campana ni lógica de notificaciones — eso queda para V03.0.2).

Nombres de pestaña centralizados en `PROFILE_TAB_LABELS` (`app.js`) para poder renombrarlos
sin tocar lógica, tal como pedía el consolidado. Único punto de entrada nuevo,
`openProfileScreen(tab)`, reemplaza el handler inline que tenía `initBottomNav` y se reusa
desde el tap en la tarjeta del Home.

---

## 3. EDITAR DATOS — pantalla completa (reemplaza el modal)

`#profile-edit-modal` se convirtió en `#view-edit-data`, mismo shell `.view--access` que
Login/Signup (header con volver, scroll natural, sin overlay). Cambios de contenido:

- Label visible y persistente arriba de cada campo (antes placeholder-only): Nombre,
  Apellido, @usuario, Nombre visible (+ texto auxiliar "Así te va a mostrar BRAMU en
  partidos, rankings y grupos"), Fecha de nacimiento, Categoría.
- **Género** pasó de `<select>` nativo a un control segmentado de 4 opciones
  (`option-row option-row--2col`), reutilizando exactamente el mismo mecanismo
  (`wireOptionGroup`/`resetOptionGroup`/`.option-col`) que ya usaban Mano hábil/Lado
  habitual — mismos `data-value` (femenino/masculino/otro/prefiero-no-decir), cero lógica
  nueva.
- Mano dominante y Lado habitual ganan un label explícito arriba del grupo (la lógica de
  selección no cambió).
- @usuario: `renderUsernameFeedback` (compartida con el signup) ahora dice "✓ Disponible" /
  "! Ya está en uso" en vez de "Disponible."/"Ya está en uso." — mejora pedida puntualmente
  para esta pantalla, pero como la función es compartida también se ve en el signup (paso 2);
  diferencia justificada, documentada acá.
- Botón "GUARDAR" con el tamaño estándar de la app (`.btn-secondary`), no el CTA grande de
  `.btn-start`.
- Al guardar: vuelve a Perfil → MIS DATOS y muestra el toast "Datos guardados" (antes solo
  cerraba el modal sin ninguna confirmación visible).

Verificado en vivo contra el dato real del dev server: edición completa (apellido, fecha de
nacimiento, género, mano, lado, categoría) persistió correctamente y el banner "Completá tus
datos" desapareció al completarse todos los campos.

---

## 4. Bug — foto del jugador en Home

`renderPlayerCard` ahora lee `Store.getCurrentUser().profilePhoto`: si existe, muestra un
`<img>` nuevo (`#player-home-avatar-img`) dentro de `.player-card__avatar`; si no, deja el
SVG genérico existente sin tocar. Misma fuente que el resto de la app — no se duplicó
almacenamiento ni se creó una segunda fuente de la imagen. Verificado en vivo: al setear
`profilePhoto` en la cuenta activa, la foto apareció de inmediato en el Home sin recargar.

La tarjeta del Home (`.player-card`, ahora `#player-home-card`, `role="button"`) es tappable
por mouse/teclado y lleva a Perfil → MI PERFIL.

---

## 5. COMPLETAR ACCESO — pantalla completa

Mismo tratamiento que Editar Datos: `#complete-access-modal` → `#view-complete-access`.
Se agregó botón mostrar/ocultar contraseña (◎) en Contraseña y Repetir contraseña, mediante
un helper nuevo y genérico `wirePasswordToggle(inputId, btnId)` (reusado también en Login y
Cambiar contraseña — alterna `type` entre `password`/`text`, nunca persiste ni valida nada
distinto). Validaciones sin cambios. Al guardar: vuelve a MIS DATOS y muestra el toast
"Acceso guardado". Mismo `userId`, confirmado en vivo (el registro conservó su `id` original
tras completar acceso).

---

## 6. Cambiar contraseña (nuevo)

Pantalla completa nueva `#view-change-password`, accesible desde MIS DATOS → Acceso y
seguridad (visible solo cuando la cuenta ya tiene email — mientras el acceso está pendiente,
esa acción no tiene sentido y se muestra en su lugar el banner de Completar Acceso).
Prototipo local sin backend, tal como pide el consolidado: valida la contraseña actual por
comparación directa contra `user.password` (mismo criterio que ya usa
`Store.loginWithEmail`), verifica que las nuevas coincidan y cumplan el mismo checklist de
requisitos que signup/Completar Acceso, y guarda con
`Store.updateUserAccount(user.id, { password })` — conserva `userId`/sesión/historial.
Verificado en vivo: contraseña incorrecta se rechaza sin tocar el dato guardado; contraseña
correcta actualiza el registro y el login posterior con la contraseña vieja falla mientras
que con la nueva funciona.

---

## 7. Cerrar sesión — reubicación

El botón se movió de MI PERFIL (donde vivía como link suelto) a MIS DATOS → Acceso y
seguridad, como botón secundario/destructivo (`.btn-secondary--danger`, clase ya existente en
la app, reutilizada). Comportamiento sin cambios: `requestLogout`/`doLogout`/advertencia de
acceso incompleto (`#logout-warning-modal`) intactos — verificado en vivo con una cuenta con
acceso pendiente (muestra la advertencia) y con una cuenta con acceso completo (cierra
sesión directo).

---

## 8. Estado sin sesión — ocultamiento visual de la navegación

Cambio central de esta ronda, corregido por el usuario tras revisar el plan inicial: el
mecanismo **principal** para no exponer navegación personal sin sesión es ocultar la barra
inferior completa, no solo gatear clicks.

- `showView(name)` (`app.js`) calcula la visibilidad de `#bottom-nav` con
  `BOTTOM_NAV_VIEWS.indexOf(name) !== -1 && !!Store.getCurrentUser()` — antes solo miraba si
  la vista pertenecía a `BOTTOM_NAV_VIEWS`. Se usa una lectura fresca de Store
  (`Store.getCurrentUser()`), no la variable de módulo `currentPlayerName`: esa variable
  solo se sincroniza en puntos puntuales y queda en su valor inicial `null` tras un cold
  boot que resume un partido activo vía `continueActiveMatch()` (que nunca la sincroniza) —
  de haber usado la variable cacheada, un usuario CON sesión que reabre la app con un
  partido en curso hubiera visto la barra incorrectamente oculta al llegar a Análisis.
- `doLogout()` ahora llama `openAccessFlow()` en vez de `showView('setup')` — vuelve directo a
  "BIENVENIDO A BRAMU".
- Gates internos (protección adicional, no sustituto): `openHistoryScreen` y un nuevo
  `openRankingScreen()` ganan el mismo chequeo `if (!currentPlayerName) { openAccessFlow();
  return; }` que ya tenían `openPlayerHome`/`openManualLoadScreen`.
- `#view-access` ("BIENVENIDO A BRAMU") queda con exactamente 3 acciones, tal como pide el
  consolidado tras la corrección: INICIAR SESIÓN, CREAR CUENTA, **REGISTRAR PARTIDO SIN
  CUENTA** — se quitó el link "Cancelar" (sin sesión, esta pantalla es la raíz pública, no
  hay una pantalla personal a la que volver).

Verificado en vivo end-to-end: tras cerrar sesión, la barra inferior desaparece y la app
muestra "BIENVENIDO A BRAMU"; tocando "REGISTRAR PARTIDO SIN CUENTA" se llega a la
configuración de partido en vivo con la barra inferior **oculta durante todo el flujo**
(setup → partido → Resumen), a diferencia del comportamiento anterior donde la barra
reaparecía en esas mismas vistas.

---

## 9. Partido de invitado — no se vincula ni se persiste

`selectRegisterMode`/`setup` no ganaron ningún gate nuevo (`setup` nunca leyó
`currentPlayerName`, arma nombres desde sus propios campos de texto — ya soportaba este caso
antes, solo faltaba ofrecerlo explícitamente y proteger las pantallas personales alrededor).

El cambio real está en `finishMatch`/`finishMatchGames`: **si no hay sesión activa
(`Store.getCurrentUser()` falsy), el partido no se persiste en `Store.upsertHistory`** — el
invitado sigue viendo el Resumen de esa sesión desde el snapshot en memoria
(`openCanonicalResumen` ya lo recibía como parámetro, nunca dependió de que estuviera
guardado), pero el partido no sobrevive a un recierre de la app. Es la solución más simple y
segura que el propio consolidado pedía preferir si evitaba una vinculación falsa, y evita por
completo el riesgo descripto en el punto 1 de este informe (un invitado con nombre coincidente
nunca puede terminar en el historial de una cuenta real, porque nunca llega a existir esa fila
compartida). No se tocó `findPlayerRow` ni la regla de exclusividad de `userId`.

No se implementó "reclamar" un partido de invitado ni convertirlo en partido de cuenta —
explícitamente fuera de alcance de esta ronda.

**Verificado en vivo, extremo a extremo:** se jugó un partido completo como invitado
("Invitado Uno/Dos" vs "Rival Uno/Dos", finalizado manualmente), se vio el Resumen completo
(BRAMU Intelligence, estadísticas, evolución) con la barra inferior oculta durante todo el
recorrido, y se confirmó por `localStorage` que `bramulab.history.v1` conservó exactamente 2
entradas (las mismas de antes de jugar el partido de invitado) — el partido de invitado nunca
se escribió.

---

## 10. Login — pulido visual

Mismo shell, mismas reglas de autenticación (`Store.loginWithEmail`, sin cambios). Se
agregaron labels persistentes sobre Email/Contraseña, el mismo ojo mostrar/ocultar de
Completar Acceso/Cambiar contraseña, CTA con el tamaño estándar de la app en vez del CTA
grande, y el mensaje de error ("Revisá tu email y contraseña.") queda inmediatamente debajo
del campo de contraseña. Verificado en vivo (desktop y mobile): credenciales incorrectas
muestran el error pegado al formulario; el ojo alterna el campo entre oculto/visible.

---

## 11. Toasts

No se creó infraestructura nueva — `showToast(message, durationMs)` ya existía (usado, por
ejemplo, en Historial) y solo se agregaron las 3 llamadas pedidas: "Datos guardados" (Editar
Datos), "Acceso guardado" (Completar Acceso), "Contraseña actualizada" (Cambiar contraseña).
Los tres casos fueron verificados en vivo.

---

## 12. Espaciado y jerarquía

Ajustes puntuales de CSS sobre las secciones tocadas: separación consistente entre grupos de
MIS DATOS (`.profile-group`), botón Editar/Cambiar contraseña/Cerrar sesión con ancho
completo pero sin CTA sobredimensionado (`.btn-secondary`, no `.btn-start`), targets táctiles
cómodos en el control segmentado de Género. Sin rediseño de Home/Historial.

---

## 13. Tests

661/661 verdes (650 existentes + 11 nuevos), sin ninguna regresión. Los 11 nuevos casos
(`tests.html`, bloque "V03.0.1") siguen el mismo patrón de snapshot/restore de
`localStorage` que el bloque V03.0 (único otro punto de la suite que toca Store real) y
cubren lo que es testeable a nivel `Store` (puro, sin DOM):

- Cambio de contraseña: comparación de la actual, actualización, mismo `userId` e historial
  conservados, contraseña vieja deja de autenticar, contraseña nueva funciona.
- `logoutSession` NO toca `USERS` (extiende la cobertura V03.0, que ya confirmaba
  `HISTORY`/`PLAYER_NAMES` pero no `USERS`).
- Precondición exacta que usa el gate de persistencia de invitado
  (`Store.getCurrentUser()` truthy/falsy con y sin sesión).

Las conductas de navegación/UI (ocultamiento de la barra, pestañas de Perfil, pantallas
completas, el flujo de invitado de punta a punta) **no tienen test automatizado nuevo** —
`app.js` no expone sus funciones internas (`showView`, `openProfileScreen`,
`finishMatch`...) fuera de su IIFE, y ninguna pantalla de V03.0 (Acceso/Signup/Perfil) tiene
tampoco tests de DOM en este archivo; el resto de la suite es deliberadamente puro
(`Store`/`PH`/`PLI`/`stats`/`engine`). Se verificaron en su lugar con QA manual en vivo
contra el dev server real (detallado en cada sección de arriba), incluyendo el escenario de
punta a punta del punto 9.

---

## 14. Validación mobile/desktop

Checklist A-N del consolidado §12, ejecutada contra el dev server local (`preview_start` +
Browser pane, desktop 1280×720 y mobile 375×812):

| # | Caso | Resultado |
|---|---|---|
| A | Perfil abre en MI PERFIL | ✅ |
| B | Cambio a MIS DATOS | ✅ |
| C | Editar Datos abre como pantalla completa | ✅ |
| D | Labels visibles con campos ya cargados | ✅ |
| E | Editar y guardar (apellido/fecha/género/mano/lado/categoría) | ✅ |
| F | Foto aparece también en Home | ✅ |
| G | Guardar muestra toast | ✅ (3 toasts: datos, acceso, contraseña) |
| H | Cambiar contraseña y volver a iniciar sesión | ✅ |
| I | Cerrar sesión | ✅ (con y sin acceso completo) |
| J | Sin sesión no se puede acceder a Historial/Perfil personal | ✅ (barra oculta) |
| K | Registrar partido sin cuenta | ✅ |
| L | Historial personal no contaminado tras partido invitado | ✅ (2/2 entradas, sin cambios) |
| M | Home → tocar avatar/nombre → MI PERFIL | ✅ |
| N | 0 regresiones en los tests existentes + nuevos | ✅ (661/661) |

Los datos reales del dev server (cuenta "Seba", 2 partidos legacy-migrados) se usaron para
la validación y se restauraron a su estado exacto previo al cierre de la sesión de trabajo.

---

## 15. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.0"` → **`"BRAMUlab V03.0.1"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-0` → **`bramulab-v03-0-1`**.
- **Commit de implementación (código):** `c499103`.
- **Push:** a `main` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 16. Hash exacto y tag

- Commit de implementación (código): `c499103eb8d76219388b0386e91820d9fcd52fb0`.
- Commit de este informe: se registra en un commit de documentación inmediatamente
  posterior a este (mismo patrón que V03.0), agregado ahí una vez conocido su propio hash.
- Tag `BRAMUlab_V03.0.1` apunta al commit inmediatamente posterior a este informe.

---

## 17. Diferencias justificadas respecto del consolidado

1. **`renderUsernameFeedback` mejorada también afecta al signup** (paso 2) porque es una
   función compartida — el consolidado solo pedía el cambio para Editar Datos. Consistencia
   visual, sin lógica nueva, mismo criterio que V03.0 usó para extender el gate de Evolución
   a Perfil.
2. **Género usa el mismo control segmentado que Mano hábil/Lado habitual** (`option-row`,
   variante 2×2) en vez de un componente nuevo — el consolidado pedía "un control visual
   coherente con BRAMU" sin especificar cuál; se reusó el patrón ya validado en la misma
   pantalla en vez de introducir uno nuevo.
3. **"Cancelar" del Acceso se removió por completo** (no se ocultó condicionalmente) porque,
   tras la corrección del usuario sobre el ocultamiento visual de la navegación, ya no existe
   una pantalla personal "de vuelta" a la que ese link pudiera llevar sin sesión.
4. **Tests nuevos cubren solo la capa `Store`**, no la capa de navegación/UI de `app.js` —
   ver razón en la sección 13. Es el mismo límite que ya tenía la suite antes de esta ronda.

---

## 18. Qué no se tocó

`findPlayerRow` y la regla de exclusividad de `userId` (`player-home.js`), el modelo de datos
de `User`, la migración legacy, `SCHEMA_VERSION` (se mantiene en 3 — ningún campo nuevo),
Ranking (placeholder sin cambios funcionales más allá del gate de sesión), Historial,
BRAMU Intelligence, backend/Supabase/Firebase, fórmula real de Nivel BRAMU, sistema de
Notificaciones (reservado para BRAMUlab V03.0.2), amigos/partidos compartidos/sistema
social, "reclamar" un partido invitado.
