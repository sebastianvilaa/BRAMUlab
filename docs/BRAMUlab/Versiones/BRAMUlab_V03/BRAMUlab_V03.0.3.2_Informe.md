# BRAMUlab V03.0.3.2
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 08/09/2026.
**Base:** BRAMUlab V03.0.3.1 (commit `344dc87`, tag `BRAMUlab_V03.0.3.1`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.2_Consolidado.md` — parche corto: recuperación de contraseña desde sesión activa + tabs visuales de modo.
**Estado:** publicado en producción.

---

## 1. Auditoría previa

Antes de tocar código se auditó el estado real:

- `#view-change-password`/`initChangePasswordScreen` (V03.0.3.1) solo tenía el "Camino A"
  (contraseña actual conocida). No existía ningún atajo hacia el flujo de recuperación.
- El wizard de recuperación (`#view-forgot-password`, V03.0.3.1) ya resolvía todo lo necesario
  para el "Camino B" — email → código `123456` → nueva contraseña — pero siempre arrancaba en
  el paso del email y siempre terminaba en Login. Reutilizarlo entero, con dos puntos de
  entrada/salida distintos, era más seguro que duplicar lógica de validación de contraseña en
  un segundo lugar.
- `#setup-mode-tabs` (V03.0.3) ya usaba dos botones con `data-value`/`wireOptionGroup` — la
  lógica de selección/persistencia (`Store.saveRecordingMode`) estaba bien, pero visualmente
  reusaba `.option-row`/`.option-col`, el mismo patrón de "botón grande" que Sistema de
  puntuación/Formato — exactamente lo que el consolidado pide dejar de parecer.
- El patrón de referencia pedido (`.profile-tab`, MI PERFIL/MIS DATOS) ya existía y es
  puramente CSS (subrayado + color, sin fondo) — no hacía falta inventar un componente nuevo.

Alcance confirmado sin contradicciones. Implementación directa, sin plan intermedio
(autorización del consolidado §8).

---

## 2. "¿No recordás tu contraseña?" desde Cambiar Contraseña

Nuevo link secundario (`#change-password-forgot-btn`, mismo `.link-btn` discreto ya usado en
Login) debajo de "Contraseña actual". Al tocarlo:

- `openForgotPasswordFromSession()` toma la cuenta directamente de `Store.getCurrentUser()` —
  **nunca** llama `Store.getUserByEmail` ni pide email en ningún punto de este camino.
- Arranca el mismo wizard de `#view-forgot-password` directo en el **Paso 2 (código)** —
  `resetForgotPasswordWizard(2)` — el Paso 1 (email) queda completamente fuera del recorrido.
- El botón "atrás" respeta el origen: `forgotPasswordOrigin` guarda si el wizard se abrió desde
  Login (`'login'`, piso = paso 1, como siempre) o desde Cambiar Contraseña con sesión
  (`'session'`, piso = paso 2 — nunca puede retroceder a un paso de email que no existe en este
  camino). Desde el código, atrás vuelve directo a Cambiar Contraseña.
- Código `123456` → Paso 3 (nueva contraseña), mismos `eye`/`eye-off`, reglas de fuerza
  (`PLI.checkPasswordStrength`) y comparación (`PLI.passwordsMatch`) que el resto de la app —
  cero validación nueva, se reutiliza tal cual.

---

## 3. Regla crítica y comportamiento de sesión

`Store.updateUserAccount(user.id, { password: next })` sigue siendo la única escritura. Al
guardar:

- Si el origen fue `'session'`: vuelve a **MIS DATOS** (`showView('profile')`) — nunca a Login,
  nunca desloguea. `SESSION`/`CURRENT_PLAYER` no se tocan en ningún punto de este camino, así
  que `Store.getCurrentUser()` sigue resolviendo exactamente la misma cuenta después de guardar
  — no hace falta volver a loguear.
- Si el origen fue `'login'` (sin sesión, comportamiento de V03.0.3.1 sin cambios): vuelve a
  Login con el email precompletado, como siempre.

Ambos caminos coexisten sin interferirse — verificado en vivo contra una cuenta de prueba real
(creada y borrada solo para este QA, sin tocar el dispositivo real): Camino A (contraseña
actual → nueva) y Camino B (`123456` → nueva) cambiaron la contraseña de la MISMA cuenta en
sucesión, conservando en todo momento `userId`, email, username, displayName, foto de perfil,
una entrada de historial y una notificación previa — exactamente iguales antes y después de
ambos caminos.

---

## 4. Tabs visuales — PUNTO A PUNTO | POR GAMES

Mismo `#setup-mode-tabs`, misma lógica (`wireOptionGroup`, `Store.saveRecordingMode`,
`data-value`) — cambia únicamente la piel visual:

- Se retiró la clase `option-row` del contenedor en el markup (index.html) — sin ella, sus
  `.option-col` hijos dejan de heredar el layout de grilla de 3 columnas y el look de tarjeta
  de `Sistema de puntuación`/`Formato`.
- Nuevo CSS **scoped a `#setup-mode-tabs .option-col`** (nunca a `.option-col` global, para no
  afectar Género/Mano hábil/Lado habitual/Formato/Sistema de puntuación en ningún otro lugar de
  la app): mismo tratamiento que `.profile-tab` — `flex:1`, sin fondo, sin borde propio,
  `border-bottom: 2px solid transparent`, texto gris (`--paper-faint`), más bajo (padding
  vertical ~9-10px en vez del `min-height: 48px` de tarjeta). Activo: texto y subrayado lima
  (`--brand-lime`), sin relleno ni glow — exactamente "elegir un modo", no "ejecutar una
  acción".
- `#setup-mode-tabs` pasa de `margin-bottom` suelto a `display:flex` + `border-bottom: 1px
  solid var(--line)` (la línea completa del grupo, con el segmento activo remarcado en lima
  encima) — mismo criterio visual que `.profile-tabs`/`.history-tabs`.

**Verificado en vivo** (mobile 375px, con captura completa): una sola línea de texto en ambas
tabs (nunca 2 líneas — "más bajas" cumplido), activa lima+subrayado, inactiva gris sin ningún
indicio de botón, cambiar de tab cambia realmente `localStorage['bramulab.recordingMode.v1']`
y el estado `is-selected`/`aria-checked` de cada botón (confirmado leyendo el valor real, no
solo el estado visual — lección de V03.0.3 aplicada de nuevo). Equipo A/B, Formato de partido y
Sistema de puntuación quedaron con su apariencia de siempre, sin tocar.

**Mismo patrón con y sin sesión** (consolidado §4): es el mismo `#setup-mode-tabs` para ambos
casos (no hay una versión distinta para invitado) — confirmado navegando el flujo de
"Registrar partido sin cuenta" hasta Setup: tabs idénticas, bottom nav oculta como corresponde
sin sesión (regla de V03.0.1, sin cambios).

---

## 5. Tests

**705/705 en verde** (693 previos + 12 nuevos de esta ronda).

Nuevo bloque `V0332-SESION` (mismo patrón snapshot/restore `AFFECTED_KEYS`, incluyendo desde el
inicio `currentPlayerName.v1`/`playerNames.v1`/`recordingMode.v1` — la fuga de esas dos
primeras claves fue el bug de higiene detectado y corregido en V03.0.3.1, esta vez protegidas
de entrada):

- la cuenta objetivo es la de la sesión activa (nunca un lookup por email);
- reemplazo de contraseña conserva `userId`;
- contraseña vieja deja de funcionar / nueva permite login;
- la sesión sigue apuntando a la misma cuenta después de guardar (nunca se desloguea);
- email/username/displayName/foto/historial/notificaciones intactos;
- Punto a punto/Por games sigue persistiendo igual que antes del cambio visual.

El arranque directo en el paso del código (sin pedir email) y la validación de `123456`/código
incorrecto son lógica de `app.js` (UI), fuera del alcance de `tests.html` — mismo límite
documentado en todos los informes de V03.0.x. Cubierto por QA manual (§6). El cambio visual de
las tabs (§4) es CSS/markup puro — no aplica a `tests.html`; se verificó que la lógica
(`wireOptionGroup`/persistencia) sigue intacta leyendo `localStorage` directamente durante el
QA, no solo el estado visual.

Suite completa corrida una sola vez al cierre, y una segunda vez para confirmar que el
dispositivo de desarrollo real queda exactamente igual antes y después (mismo chequeo que en
V03.0.3.1, ya sin fugas).

---

## 6. QA manual mobile + desktop

Checklist del consolidado §7, contra el dev server local:

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Cambio normal con contraseña actual sigue funcionando | ✅ |
| 2 | "¿No recordás tu contraseña?" aparece y es secundario | ✅ debajo de Contraseña actual, `.link-btn` discreto |
| 3 | No pide email | ✅ arranca directo en "INGRESÁ EL CÓDIGO" |
| 4 | Código incorrecto da error | ✅ "Código incorrecto." |
| 5 | `123456` avanza | ✅ a "NUEVA CONTRASEÑA" |
| 6 | Nueva contraseña guarda | ✅ |
| 7 | Misma cuenta conserva datos | ✅ `userId`/email/username/displayName/foto/historial/notificaciones intactos |
| 8 | Sesión no se rompe innecesariamente | ✅ `getCurrentUser()` sigue igual, vuelve a MIS DATOS sin pedir login |
| 9 | Tabs se ven como solapas | ✅ una línea, subrayado, sin fondo de tarjeta |
| 10 | Activa se entiende | ✅ texto+subrayado lima |
| 11 | Inactiva no parece CTA | ✅ gris, sin borde, sin fondo |
| 12 | Cambiar tab cambia realmente el modo | ✅ confirmado en `localStorage`, no solo visual |
| 13 | Setup general no cambia | ✅ Equipo A/B, Formato, Sistema de puntuación intactos |
| 14 | Invitado comparte patrón si usa la misma pantalla | ✅ mismo markup/CSS, verificado sin sesión |
| 15 | Home/Perfil/Historial/Notificaciones sin regresiones | ✅ Home baseline exacto, sin cambios |
| 16 | Suite completa verde | ✅ 705/705 |

La cuenta real del dispositivo ("Seba", 2 partidos, sin email) se dejó exactamente como
estaba — no se usó para probar Cambiar Contraseña (no tiene email, no cumple el prerrequisito
de la pantalla) — la validación de §2/§3 se hizo con una cuenta temporal creada y borrada solo
para este QA. Confirmado por comparación textual exacta del Home antes/después de toda la
ronda: mismo Nivel BRAMU (5.0, ↑0.2), mismo último partido, misma efectividad, misma racha,
mismo rival más enfrentado.

---

## 7. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.0.3.1"` → **`"BRAMUlab V03.0.3.2"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-0-3-1` → **`bramulab-v03-0-3-2`**.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 8. Hash exacto y tag

- Commit de implementación (código): `7c10cc6217d1550309cc79efe7b140cbec493b4e`.
- Commit de este informe: pendiente de completar tras su propio commit.
- Tag `BRAMUlab_V03.0.3.2` apuntará al commit inmediatamente posterior a este.

---

## 9. Diferencias justificadas respecto del consolidado

1. **Destino tras guardar desde sesión**: el consolidado permite "MIS DATOS o CAMBIAR
   CONTRASEÑA limpio" — se eligió MIS DATOS (mismo lugar de donde sale "Cambiar contraseña"),
   consistente con el destino que ya usa el botón "Cancelar" de esa misma pantalla.
2. **`forgotPasswordOrigin` como mecanismo interno**: no estaba pedido explícitamente, pero es
   la forma más simple de que el MISMO wizard sirva a los dos caminos (§3: "deben convivir")
   sin duplicar el paso de código/nueva contraseña en un segundo lugar del código.
3. **Se retiró la clase `option-row` del contenedor de tabs** en vez de sobreescribir cada
   propiedad de grilla: más simple y evita que un cambio futuro a `.option-row` (usado en
   Género/Sistema de puntuación) afecte por accidente a estas tabs.

---

## 10. Qué no se tocó

Backend, Supabase/Firebase, recuperación real de contraseña (con email real/servidor), ranking
real, social/amigos, notificaciones push, fórmula real de Nivel BRAMU, Home, MI PERFIL, MIS
DATOS (salvo el nuevo link hacia recuperación), Historial, Ranking, Notificaciones, Evolución
BRAMU, Player Intelligence, Equipo A/B, Formato de partido, Sistema de puntuación, lógica de
partidos, arquitectura de identidad (`findPlayerRow`, `userId`, `SCHEMA_VERSION` se mantiene en
3), el flujo de recuperación desde Login sin sesión (V03.0.3.1, sin cambios de comportamiento).
