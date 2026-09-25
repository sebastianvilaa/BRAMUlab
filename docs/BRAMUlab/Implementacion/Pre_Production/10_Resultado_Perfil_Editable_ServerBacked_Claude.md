# Pre-Production — Resultado P0.1C Perfil editable server-backed — Claude Code

**Fecha:** 24 de septiembre de 2026
**Rama:** `staging`
**Handoff ejecutado:** `09_Handoff_Perfil_Editable_ServerBacked_Claude.md`.
**Estado:** implementación completa, testeada localmente (dentro de lo que esta sesión puede
ejecutar sin Supabase real) y pusheada a `origin/staging`. Sin `main`, Production ni BRAMUlive
tocados. No se reabrió P0.1 ni Ranking automático.

**⚠️ Revisión central 2 (misma fecha, ANTES de aplicar la migración en Staging) — ver §17.** La
revisión central encontró dos problemas reales en esta primera versión: el bucket de avatares
había quedado **público** (contradice Backend_Infraestructura.md §5.1) y la validación de ruta de
avatar tenía un agujero real (aceptaba URLs de dominios externos). Además se separó la categoría
"declarada"/"actual" en dos campos reales. **Las secciones §6/§7/§11/§13/§14 de abajo describen la
ronda 1 y quedaron parcialmente desactualizadas — §17 tiene el estado final correcto y prevalece
sobre cualquier contradicción con lo que sigue.**

---

## 1. Resumen de una línea

`Editar Datos` deja de bloquear el guardado para cuentas `serverBacked`: nombre/apellido/nombre
visible/fecha/género/mano/lado siguen usando `complete_profile` (sin tocar); localidad/rama pasan
a guardarse con `complete_ranking_profile_data` (misma RPC que ya usa el gate de Ranking, ahora
también disponible desde Editar Datos); teléfono/WhatsApp y avatar son enteramente nuevos
(columnas + 2 RPCs + bucket de Storage). `@usuario` queda fijo y `Categoría actual` queda de solo
lectura (DECISIÓN ABIERTA no bloqueante, ver §6).

---

## 2. Problema real y qué se trazó antes de tocar código

`openProfileEditModal()` deshabilitaba el botón GUARDAR por completo para `user.serverBacked`,
con un aviso fijo. El propio comentario en código explicaba que varios campos (teléfono/
WhatsApp, avatar) "ni siquiera existen todavía en `Backend_Infraestructura.md` §6.1".

Se trazó el estado real (lectura de código, no supuestos) antes de escribir nada:

- `complete_profile` (Bloque 2/3, endurecida en Bloque 7 F1-C03) **ya ignora**
  `p_competitive_branch`/`p_location_*` a propósito desde Bloque 7 — esos dos campos son
  responsabilidad exclusiva de `complete_ranking_profile_data` (cooldown de 30 días + auditoría
  en `location_change_events`). Cualquier intento de reactivarlos en `complete_profile` habría
  sido exactamente la regresión que Bloque 7 vino a cerrar.
- `profiles.avatar_url` **ya existe** desde Bloque 2 (`avatar_url text`), documentado
  explícitamente como "sin ninguna vía para setearlo". No hacía falta una columna nueva, solo la
  RPC de escritura que nunca se creó.
- `bramulab/auth.js#fetchOwnProfile` ya hacía `select('*')` sobre `profiles` (protegido por RLS
  `profiles_select_own`) pero **mapeaba a mano** `profilePhoto: null`, `phone: null`,
  `allowWhatsAppContact: false` como constantes — la lectura estaba lista para recibir columnas
  reales apenas existieran, solo faltaba escribirlas.
- `Editar Datos` **nunca tuvo una fila de "Rama competitiva"** en su UI (solo el gate de Ranking
  la tenía) — se agregó una, reusando el mismo componente de fila/hoja que ya usan Género/Mano/
  Lado/Categoría en esa misma pantalla (`PROFILE_PICKER_FIELDS`), en vez de inventar un control
  nuevo.
- `level_states.declared_category` se escribe **una única vez**, dentro de
  `officialize_level_onboarding` (Bloque 3/6), en la transición `PENDIENTE -> CALIBRANDO`.
  Ninguna oficialización de partido (`officialize_match_validation`) lo vuelve a tocar jamás — no
  hay riesgo de "editar categoría rompe Nivel" en el sentido de recalcular `mu`/`confidence`.
  Pero se encontró un gap **preexistente y separado**: la Edge Function
  `officialize-onboarding/index.ts` today envía `p_declared_category: null` hardcodeado (línea
  122), así que en la práctica **ninguna cuenta real tiene hoy un valor real en ese campo**. Ver
  §6 para la decisión tomada al respecto.

---

## 3. Arquitectura elegida — reutilizar, no duplicar

**RPC por concern, nunca una RPC gorda con semántica ambigua de "reemplazo total":**

| Dato | RPC | Estado |
|---|---|---|
| nombre/apellido/nombre visible/fecha/género/mano/lado | `complete_profile` | **Sin cambios** (Bloque 2/3) |
| localidad + rama competitiva | `complete_ranking_profile_data` | **Sin cambios** de contrato (Bloque 7) — nuevo *caller* desde Editar Datos |
| teléfono + consentimiento WhatsApp | `complete_contact_profile_data` | **NUEVA** |
| avatar (referencia, nunca el archivo) | `update_profile_avatar` | **NUEVA** |
| categoría declarada | — | **Sin RPC nueva** — solo lectura, ver §6 |

`complete_ranking_profile_data` siempre escribe rama **y** ubicación juntas (nunca una
actualización parcial) — si el usuario cambia solo una de las dos desde Editar Datos y la otra
todavía no existe, el frontend avisa sin bloquear el resto del guardado (ver §9).

---

## 4. Campos persistidos — detalle

### `profiles` (columnas nuevas)

- `phone text` — privado.
- `allow_whatsapp_contact boolean not null default false`.

`avatar_url` ya existía (Bloque 2) — solo se le agregó vía de escritura.

### `complete_contact_profile_data(p_phone text, p_allow_whatsapp_contact boolean)`

- Valida servidor-side el mismo criterio simple que ya usa el cliente
  (`PLIdentity.isValidWhatsAppPhone`: 8-15 dígitos, sin resolver telefonía internacional real) —
  nunca confía solo en el formulario.
- Desactivar el consentimiento **nunca** exige teléfono válido (revocar siempre debe ser
  posible, handoff §5) — el chequeo de formato solo corre cuando `p_allow_whatsapp_contact=true`.
- Única vía de escritura de ambas columnas.

### `update_profile_avatar(p_avatar_url text default null)`

- Persiste la URL pública **ya subida** a Storage — nunca sube el archivo por SQL.
- Defensa en profundidad: rechaza (`avatar_path_invalid`) cualquier URL que no contenga
  `/avatars/{player_id_propio}/` — más allá de que RLS en `storage.objects` ya impide subir fuera
  de la carpeta propia, esta RPC evita que alguien pegue a mano la URL de otro jugador o un
  dominio arbitrario como su propio avatar.
- `null` (quitar foto) siempre permitido, sin ese chequeo.

---

## 5. `@usuario` — fijo, sin excepción

Igual que ya hacía `complete_profile` (`username_locked` si el valor cambia), Editar Datos ahora
además **deshabilita el input** (`#profile-edit-username`) para cuentas `serverBacked` — nunca se
ofrece como editable si el servidor lo va a rechazar. Siempre se envía el username actual sin
cambios en el payload de `complete_profile`, así que la excepción `username_locked` nunca debería
dispararse desde este flujo (queda como fallback defensivo en `COMPLETE_PROFILE_ERROR_TEXT`, sin
cambios).

---

## 6. Categoría declarada — DECISIÓN ABIERTA no bloqueante

**Estado: solo lectura para cuentas server-backed en esta ronda.**

Razonamiento:

- No hay ningún camino donde editar `declared_category` toque `mu`/`confidence`/`evidence_units`
  ni reescriba eventos históricos — el campo es puramente contextual/de auditoría del
  cuestionario inicial, aislado del resto del motor.
- Pero **hoy no existe ninguna vía real que ESCRIBA un valor real ahí**: el Edge Function de
  onboarding manda `null` hardcodeado (gap de Bloque 3, no de esta ronda). Agregar una RPC de
  edición para un campo que ninguna cuenta real tiene poblado no tendría ningún efecto
  observable — sería trabajo sin valor verificable hasta que ese gap de Bloque 3 se cierre
  aparte.
- El handoff ofrece explícitamente la opción de dejarlo solo lectura si no hay una vía
  semánticamente limpia ya definida "por decisión de producto" (no técnica) para qué debería
  pasar al editar la categoría de alguien que ya jugó partidos reales con un Nivel ya calibrado
  parcialmente sobre esa categoría inicial.

**Se marca como DECISIÓN ABIERTA para que ChatGPT central/Sebastián decidan, cuando corresponda:**
1. si vale la pena cerrar primero el gap de Bloque 3 (Edge Function onboarding) para que
   `declared_category` empiece a poblarse de verdad, y
2. recién entonces, si además debería ser editable después, y bajo qué regla de producto.

No bloqueó el resto de la ronda — todo lo demás quedó completo.

---

## 7. Storage / avatar — decisión de diseño

**Bucket `avatars`: público de LECTURA, RLS estricta de ESCRITURA por carpeta propia.**

Por qué, en vez de un bucket totalmente privado:

- Backend_Infraestructura.md §5.1 ya lista el avatar como visible para cualquier usuario
  autenticado, igual que nombre/localidad/rama — no es un dato sensible en este producto.
- La app entera renderiza avatares con `<img src="...">` directo (`setAvatarPreview`) en al menos
  6 lugares (Home, Mi Perfil, Editar Datos, Perfil público local y server-backed, filas de
  Ranking). Un bucket privado exigiría reescribir todos esos `<img>` a un flujo async de blob/URL
  firmada — muy por encima del alcance de "una corrección de Perfil".
- La ESCRITURA sigue exactamente tan restringida como cualquier otro dato del proyecto: RLS en
  `storage.objects` limita insert/update/delete/select a la carpeta `{player_id}` propia
  (`storage.foldername(name)[1] = player_id del caller`), y `update_profile_avatar` agrega una
  segunda validación de la URL persistida.
- Límites server-side reales en el bucket: `file_size_limit=2MB`,
  `allowed_mime_types=['image/jpeg','image/png','image/webp']` (handoff §11 "validar MIME/tamaño
  razonable").

**Flujo de subida** (`bramulab/auth.js#uploadAvatar`): limpia cualquier archivo previo de la
carpeta propia (`removeAvatarFiles`, evita huérfanos), sube el nuevo a
`{playerId}/{timestamp}.jpg`, obtiene la URL pública real vía `getPublicUrl` (nunca un dominio
hardcodeado — siempre correcta para el entorno activo), y solo entonces persiste esa URL con
`update_profile_avatar`. Reusa `downscaleImageFileToDataUrl` (256px, JPEG 0.7) ya existente —
nunca sube el archivo original sin comprimir.

---

## 8. WhatsApp / consentimiento — contrato cerrado

- `phone` privado; cargarlo nunca activa `allow_whatsapp_contact` por sí solo.
- Activar el consentimiento exige un teléfono con formato válido (8-15 dígitos), validado en el
  propio switch (UX ya existente de V03.6, sin cambios) **y ahora también server-side**
  (`complete_contact_profile_data`).
- Revocar el consentimiento siempre está permitido, sin condición.
- `get_public_profile` expone `whatsapp_phone` — **nunca** `phone` crudo — y ese campo es `NULL`
  salvo `allow_whatsapp_contact=true`, filtrado dentro del propio `SELECT` (nunca confía en que
  el cliente decida no mostrarlo). `renderPlayerPublicProfileServerBacked` revela el botón
  `CONTACTAR POR WHATSAPP` únicamente cuando ese campo llega no nulo, reusando
  `PLI.isValidWhatsAppPhone`/`PLI.buildWhatsAppContactUrl` — mismas funciones que el camino
  local, nunca una segunda regla.

---

## 9. Frontend — qué cambió exactamente

- `bramulab/app.js`:
  - `BRANCH_LABELS` nuevo (`{F: 'Femenina', M: 'Masculina'}`), reusa los mismos valores que el
    gate de Ranking.
  - `PROFILE_PICKER_FIELDS.branch` nuevo — misma hoja de selección que Género/Mano/Lado/
    Categoría, sin componente nuevo.
  - `openProfileEditModal()`: ya no bloquea el guardado; precarga rama; deshabilita
    `#profile-edit-username` y `#profile-edit-category-row` para `serverBacked`.
  - `initProfileEditModal()`: el submit se bifurca — cuentas locales/legacy siguen exactamente
    igual que siempre (cero cambios en esa rama de código); cuentas `serverBacked` llaman a la
    nueva `submitServerBackedProfileEdit(user)`.
  - `submitServerBackedProfileEdit(user)` (nueva): valida los mismos campos mínimos que el
    camino local (nombre/nombre visible/teléfono si el consentimiento está activo), llama a
    `complete_profile` (núcleo, siempre), a `complete_ranking_profile_data` solo si rama o
    ubicación cambiaron, a `complete_contact_profile_data` solo si teléfono/consentimiento
    cambiaron, y sube/borra el avatar solo si cambió. Cada paso es independiente — un error en
    uno (p. ej. cooldown de ubicación) no impide que el resto se guarde. Al final siempre
    refresca el perfil real desde el servidor (`Auth.fetchOwnProfile` + `Store.cacheServerUser`)
    antes de volver a Mi Perfil — nunca un cache optimista como única verdad.
  - `renderPlayerPublicProfileServerBacked`: avatar real (`p.avatar_url`) y CTA de WhatsApp
    (`p.whatsapp_phone`) dejan de estar forzados a vacío/oculto.
- `bramulab/auth.js`: mapeo real de `phone`/`allowWhatsAppContact`/`profilePhoto` en
  `fetchOwnProfile` (antes constantes); `completeContactProfileData`, `updateProfileAvatar`,
  `uploadAvatar`, `removeAvatarFiles` nuevas, exportadas en `PLAuth`.
- `bramulab/index.html`: fila nueva "Rama competitiva" en Editar Datos (entre Categoría y
  Ubicación), mismo patrón visual que las 4 filas existentes — sin CSS nuevo más allá de dos
  reglas `:disabled` mínimas.
- `bramulab/styles.css`: `.profile-select-row:disabled` y `.field__input:disabled` (opacidad +
  cursor, mismo criterio que `.btn-start:disabled` ya existente).

No se rediseñó la pantalla — mismos componentes, misma jerarquía visual, solo estados
disabled/loading nuevos donde el handoff los pedía.

---

## 10. Privacidad pública — verificado contra el checklist del handoff

- fecha de nacimiento/edad: nunca en `get_public_profile` (no está en su `RETURNS TABLE`).
- género personal: nunca en `get_public_profile`.
- email: nunca en `get_public_profile`.
- teléfono crudo: nunca — solo `whatsapp_phone`, filtrado por consentimiento.
- mano/lado: se muestran como antes, sin cambios.
- localidad/rama: mismos contratos ya vigentes, sin cambios.
- avatar: visible si existe (nuevo).
- Nivel/Ranking: sin cambios.

---

## 11. Migraciones — no ejecutadas desde esta sesión (mismo bloqueo operativo de siempre)

`supabase/migrations/20260924130000_preprod_p01c_profile_editable.sql` (nueva) incluye:

1. `alter table profiles add column phone/allow_whatsapp_contact`.
2. `complete_contact_profile_data` (nueva RPC).
3. `update_profile_avatar` (nueva RPC).
4. Bucket `avatars` (`storage.buckets`, público de lectura, límite 2MB, MIME jpeg/png/webp) + 4
   políticas RLS sobre `storage.objects` (insert/update/delete/select, todas scoped a la carpeta
   `{player_id}` propia).
5. `get_public_profile` — `DROP FUNCTION` + `CREATE OR REPLACE` (cambia el tipo de retorno,
   agrega `avatar_url`/`whatsapp_phone`) — mismo patrón ya usado dos veces esta semana para esta
   misma función.

Esta sesión de Claude Code sigue sin `psql`/CLI/credenciales de Supabase (mismo bloqueo
estructural documentado en cada ronda de Backend anterior). La migración quedó escrita y
revisada, pero **no se ejecutó** contra Staging ni contra ningún Postgres real.

**Acción manual pendiente para quien tenga acceso a Supabase Staging:**

1. aplicar `20260924130000_preprod_p01c_profile_editable.sql`;
2. correr `supabase/tests/verify-preprod-p01c-profile-editable.sql` completo (transaccional,
   `ROLLBACK`) y confirmar que pasa entero — **requiere que ya exista al menos una cuenta real
   registrada con sesión en el entorno** (mismo requisito que `verify-bloque7-fase1.sql`, ya
   satisfecho hoy por las cuentas sintéticas de QA);
3. QA visual sugerida (no bloqueante): desde una cuenta real de Staging, abrir Editar Datos,
   cambiar teléfono + activar WhatsApp, subir una foto, cambiar rama/ubicación, guardar, recargar
   la página y confirmar que todo persistió; abrir el Perfil público de esa cuenta desde otra
   sesión y confirmar avatar + botón de WhatsApp.

No es una `DECISIÓN ABIERTA` — es la misma limitación de acceso técnico ya documentada en rondas
anteriores.

---

## 12. Edge Functions

**Ninguna tocada.** Las 3 RPCs que este flujo usa (`complete_profile`, `complete_ranking_profile_
data`, y las 2 nuevas) se llaman directo desde el cliente (`c.rpc(...)`, mismo patrón que ya
usaban `completeProfile`/`completeRankingProfileData`) — no pasan por ninguna Edge Function.

---

## 13. Tests

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS** (regresión de
  control; ninguno de esos módulos fue tocado por esta ronda).
- `bramulab/tests.html` (navegador local, sin Supabase configurado) → **1478/1478 PASS**, corrido
  después del bump de bundle.
- QA visual manual en el navegador embebido, cuenta local/legacy (sin backend real):
  - Editar Datos: fila nueva "Rama competitiva" visible entre Categoría y Ubicación, hoja de
    selección funcional (Femenina/Masculina), valor persiste al Guardar vía el camino local sin
    cambios (`Store.updateUserAccount`) — confirma que la rama local NO se rompió al agregar el
    campo nuevo.
  - `@usuario` sigue editable para cuentas locales (el `disabled` solo se aplica a
    `serverBacked`, confirmado leyendo `openProfileEditModal`).
- `supabase/tests/verify-preprod-p01c-profile-editable.sql` (nuevo, transaccional): escrito y
  revisado línea por línea contra el cuerpo real de las RPCs, pero **no ejecutado** desde esta
  sesión (§11). Cubre: escritura válida de teléfono+consentimiento; rechazo de teléfono inválido
  con consentimiento activo; que desactivar el consentimiento nunca se bloquea aunque el teléfono
  sea inválido; `update_profile_avatar` acepta la ruta propia y rechaza una ajena; `NULL` quita la
  foto sin el chequeo de ruta; `get_public_profile` expone `avatar_url` y filtra `whatsapp_phone`
  por consentimiento en ambos sentidos (con y sin); conteo de columnas para descartar una fuga de
  campo privado nuevo; permisos/firmas de las 2 RPCs nuevas (`authenticated` únicamente); bucket
  `avatars` existe con los límites configurados; las 4 políticas RLS de esa bucket existen.
- No se pudo ejecutar QA de navegador contra Supabase/Vercel Staging real desde esta sesión (sin
  acceso, igual que toda validación real de Staging en rondas anteriores).

---

## 14. Bundle final

`04.10-h29` (bump desde `04.10-h28`). `app.js`/`index.html`/`styles.css` cambiaron — bump
obligatorio para que un cliente con la PWA ya instalada no siga sirviendo desde caché la versión
que bloqueaba el guardado. `Store.VERSION`/`version.json` siguen en `"BRAMUlab V04.10"` (ronda de
Backend/Infraestructura, no una ronda nueva de Nivel BRAMU).

---

## 15. Commit

Un único commit lógico, autocontenido: migración + frontend + test + este informe. Push final a
`origin/staging`.

**Commit SHA:** el HEAD de `origin/staging` inmediatamente después de este push (este mismo
commit — revisar `git log -1` sobre `origin/staging`).

---

## 16. Condición de finalización

- Implementación completa (todos los campos listados en el handoff §3, salvo categoría — ver
  §6). ✅
- Tests focalizados corridos localmente: 255/255 (`node --test`) + 1478/1478 (`tests.html`). ✅
- QA visual del camino local (no roto por los campos nuevos), verificado en el navegador. ✅
- Staging real: **no aplicable desde esta sesión** — migración y test SQL escritos y revisados,
  pendientes de aplicación/ejecución por quien tenga acceso a Supabase (§11). Bloqueo operativo
  explícito, no un pendiente silencioso.
- Commit final + push a `origin/staging`: ✅ (este commit).
- `DECISIÓN ABIERTA` real: **categoría declarada** (§6) — no bloqueó el resto de la ronda.
  **Superada por §17**: se resolvió con la separación categoría histórica/actual.
- P0.1/P0.1B: no reabiertos, sin cambios sobre lo ya validado en Staging real.

---

## 17. Revisión central 2 (24/09/2026) — corrección ANTES de aplicar nada en Staging

La migración de la ronda 1 (§1-16) **nunca llegó a ejecutarse** contra ningún Supabase real — la
revisión central la auditó todavía en ese estado y encontró dos problemas reales, ambos corregidos
en el mismo archivo (sin ningún problema de compatibilidad de datos: no hay avatares ni categorías
reales persistidas todavía). Alcance de esta revisión: **solo** lo que sigue — no se reabrió P0.1,
P0.1B, Ranking automático, ni la fórmula de Nivel BRAMU.

### 17.1 Problema 1 — bucket de avatares público (violación de privacidad real)

**Lo que decía §7:** "Bucket `avatars`: público de LECTURA" — justificado en su momento por evitar
reescribir ~6 call sites de `<img src>` a un flujo async.

**Por qué estaba mal:** `Backend_Infraestructura.md §5.1` es explícito: los perfiles deportivos
(avatar incluido) son visibles **únicamente para usuarios autenticados de BRAMU**, nunca objetos
públicos de Internet accesibles sin sesión. Un bucket público de lectura significa que cualquiera
con la URL —sin login, sin ser jugador de BRAMU— puede abrir el archivo directo. Eso contradice la
fuente maestra de forma directa, no es un matiz de interpretación.

**Corrección aplicada** (misma migración, `supabase/migrations/20260924130000_preprod_p01c_profile_
editable.sql`):

- Bucket `avatars` pasa a `public = false`.
- La política de SELECT de `storage.objects` para esta bucket deja de estar scoped a la carpeta
  propia (`avatars_select_own`, retirada) y pasa a ser amplia para **cualquier** rol
  `authenticated` (`avatars_select_authenticated`, sin restricción de carpeta) — necesario para que
  Perfil público pueda mostrar el avatar de OTRO jugador, no solo el propio. Las 3 políticas de
  escritura (insert/update/delete) siguen exactamente igual: scoped a la carpeta `{player_id}`
  propia, sin cambios.
- `avatar_url` cambia de contrato semántico: pasa a guardar una **ruta** de Storage
  (`"{player_id}/archivo.jpg"`), nunca una URL completa — con bucket privado no existe una "URL
  pública" que tenga sentido persistir. El nombre de columna **no se cambió** a propósito: un
  `RENAME COLUMN` no es rastreado por Postgres dentro de cuerpos `plpgsql`, y esa misma columna ya
  la lee `get_ranking_classification` (Bloque 7 Fase 3, ya aplicado en Staging) — renombrarla
  hubiera arriesgado romper esa RPC en tiempo de ejecución sin que ningún `DROP`/`CREATE` lo
  advirtiera en el momento de aplicar la migración.
- `bramulab/auth.js` agrega `resolveAvatarUrl(avatarPath)` — resuelve esa ruta a una **URL firmada
  temporal** (`createSignedUrl`, 24h) usando la sesión real de quien la pide. Se resuelve de nuevo
  en cada `fetchOwnProfile()`/`getPublicProfile()` — nunca se persiste la URL firmada en ningún
  lado (ni en `profiles`, ni en `Store`, ni en caché). `fetchOwnProfile().profilePhoto` y
  `getPublicProfile().profile.avatar_signed_url` ya llegan resueltos — ningún call site de
  renderizado (`setAvatarPreview` en Home/Mi Perfil/Editar Datos/Perfil público) tuvo que cambiar
  su forma de consumir el dato, solo qué propiedad lee.
- `bramulab/auth.js#uploadAvatar` deja de llamar a `getPublicUrl` (no tiene sentido en un bucket
  privado — devolvería una URL que un `GET` anónimo rechaza) y devuelve la ruta cruda
  (`{ok:true, path}`), que `update_profile_avatar` persiste tal cual.

**Lo que esto logra, punto por punto contra lo pedido:**

- Bucket privado: ✅ (`public=false`, catálogo verificable).
- Solo el dueño puede subir/reemplazar/borrar: ✅ (sin cambios — ya era así).
- Cualquier usuario autenticado de BRAMU puede leer/resolver cualquier avatar: ✅
  (`avatars_select_authenticated`, sin scope de carpeta, rol `authenticated` únicamente).
- Un usuario NO autenticado no puede abrir el archivo directo: ✅ **estructuralmente** — ninguna de
  las 4 políticas de esta bucket incluye los roles `anon`/`public`, y Postgres RLS deniega por
  defecto cualquier acceso sin una política que lo permita explícitamente. (Lo que esta revisión
  **no puede** verificar desde una sesión sin Supabase real: que un `GET` HTTP anónimo real
  devuelva 400 — eso es comportamiento de la API REST de Storage, no alcanzable desde SQL ni desde
  este entorno. Queda como QA manual pendiente, §17.6.)
- Se evita persistir base64/data-URL en la tabla: ✅ (sin cambios — nunca se hizo así).
- Límites de tamaño/MIME razonables: ✅ (sin cambios — 2MB, jpeg/png/webp).
- Se corrige la validación de ruta débil: ✅ — ver 17.2.

### 17.2 Problema 2 — validación de ruta de avatar con agujero real

**Lo que hacía `update_profile_avatar` (ronda 1):**

```sql
if p_avatar_url is not null
   and p_avatar_url not like ('%/avatars/' || v_player_id::text || '/%') then
  raise exception 'avatar_path_invalid' ...
```

Es un chequeo de **substring**, no de origen: cualquier URL que **contenga** en algún punto
`/avatars/{tu_propio_player_id}/` pasa el chequeo, sin importar el dominio real. Un valor como
`https://dominio-ajeno.evil/avatars/{tu_player_id}/x.jpg` —un dominio arbitrario, no Supabase—
hubiera sido aceptado igual, porque el `LIKE` solo mira si esa porción de texto aparece en algún
lado de la cadena.

**Corrección aplicada:** con el cambio de contrato a "ruta pura, nunca URL" (17.1), el chequeo pasa
a ser un regex **anclado** de principio a fin:

```sql
if p_avatar_path is not null
   and p_avatar_path !~ ('^' || v_player_id::text || '/[A-Za-z0-9._-]+$') then
  raise exception 'avatar_path_invalid' ...
```

Esto rechaza estructuralmente, no por lista de casos: cualquier esquema/dominio (la cadena no
empieza con el player_id propio → no matchea desde el carácter 1), cualquier carpeta ajena, y
cualquier path traversal o segmento anidado (el segundo tramo no admite `/`). Verificado con 4
casos reales en el test (§17.5): ruta propia válida, carpeta ajena, URL completa de dominio
externo que contiene el propio player_id como substring (el caso exacto que la versión anterior
aceptaba mal), y traversal dentro de la carpeta propia.

### 17.3 Categoría — separación histórica (A) vs. actual (B)

**El pedido:** separar "categoría del contexto histórico del Nivel inicial" (nunca debe cambiar
retroactivamente) de "categoría actual de Perfil" (debe ser editable, sin tocar Nivel).

**Lo que YA era cierto y se conservó sin tocar:** `level_states.declared_category` se escribe una
única vez, dentro de `officialize_level_onboarding`, en la transición `PENDIENTE -> CALIBRANDO`.
Ninguna oficialización de partido la vuelve a tocar. Sigue siendo así — **cero cambios** en esa
garantía.

**Lo nuevo — `profiles.current_category` / `profiles.current_category_at`:**

- Dos columnas nuevas en `profiles`, con el mismo `CHECK` de valores permitidos que
  `level_states.declared_category` conceptualmente usa (`'1'..'9','no-se','no-compito'`).
- Nueva RPC `update_current_category(p_current_category text)` — única vía de escritura. No
  referencia `level_states` en absoluto (verificable leyendo su cuerpo: no hay ningún `update
  public.level_states` ni `select` sobre esa tabla) — estructuralmente no puede tocar
  `mu`/`confidence`/`evidence_units`/eventos/Ranking.
- `officialize_level_onboarding` (mismo `CREATE OR REPLACE`, misma firma exacta — conserva los
  GRANTs existentes automáticamente) gana una única línea nueva: dentro del mismo bloque
  idempotente que ya existía, inicializa `profiles.current_category`/`current_category_at` con el
  mismo valor que se acaba de confirmar como `declared_category`. Se ejecuta como máximo una vez
  por jugador (la guarda `status = 'PENDIENTE'` ya existente lo garantiza) — nunca se vuelve a
  tocar desde ahí.
- El timestamp `current_category_at` solo se re-estampa cuando el valor realmente cambia (mismo
  criterio que ya usaba el camino local/legacy en `app.js`) — guardar el mismo valor de nuevo
  conserva la fecha de declaración original.

**Frontend (`bramulab/auth.js`/`app.js`):** `fetchOwnProfile()` ahora expone `currentCategory`/
`currentCategoryAt` además de `declaredCategory`/`declaredCategoryAt` (que sigue de solo lectura).
Mi Perfil → Mis Datos, el checklist de "perfil incompleto" y `openProfileEditModal()` pasan a leer
`user.currentCategory` en vez de `user.declaredCategory` **solo para cuentas `serverBacked`** — las
cuentas locales/legacy (sin este split) siguen leyendo `declaredCategory` exactamente como
siempre, rama de código sin ningún cambio. La fila "Categoría actual" en Editar Datos, que la
ronda 1 había dejado deshabilitada para `serverBacked` (§6/§5, ese `DECISIÓN ABIERTA`), **se
reactivó**: `submitServerBackedProfileEdit` ahora llama a `Auth.updateCurrentCategory(...)` cuando
el valor cambió, igual que el resto de los campos independientes de esa función.

**Resultado de la separación A/B, punto por punto:**

- Categoría inicial del Nivel (A): se persiste correctamente al oficializar (ver 17.4 para el
  hallazgo relacionado del Edge Function), se conserva para auditoría, y no cambia jamás al editar
  Perfil — verificado explícitamente en el test (§17.5, sección 5: edita `current_category` y
  confirma que `level_states.declared_category` no se movió).
- Categoría actual del Perfil (B): editable libremente desde Editar Datos, inicializada una vez
  con el mismo valor de A al completar el onboarding, nunca reescribe `level_events` ni
  recalibra Nivel ni toca Ranking — verificado explícitamente en el test (§17.5, sección 4: ninguna
  escritura de `current_category` mueve `mu`/`confidence`/`evidence_units`/`status` de
  `level_states`).

**No se agregó** `current_category` al `RETURNS TABLE` de `get_public_profile` — el pedido fue
explícito en no inventar una tarjeta visual nueva en Perfil público sin decisión de Laboratorio UX.
Si más adelante se decide mostrar la categoría actual en el perfil público de otro jugador, agregar
esa columna es un cambio aislado y de bajo riesgo (mismo patrón que `avatar_url`/`whatsapp_phone`
ya usado dos veces) — queda documentado acá como **DECISIÓN ABIERTA de producto/diseño**, no
técnica.

### 17.4 Edge Function — `p_declared_category`/`p_category_context_key` dejan de hardcodearse

`supabase/functions/officialize-onboarding/index.ts` mandaba `p_declared_category: null,
p_category_context_key: null` hardcodeado, en vez de reenviar lo que el motor realmente calculó.
Se corrigió a `confirmResult.origin.declaredCategory` / `confirmResult.origin.categoryContextKey`.

**Caveat honesto, para no generar una falsa sensación de "gap cerrado":** el estimador universal
V1.2 (`confirmInitialLevelV1_2`, `bramulab/level-calibration.js`) construye a propósito un paso
neutral — llama internamente a `computeCategoryStep(rawResult, null, null)` — porque **el
cuestionario de onboarding actual no le pide categoría al usuario en absoluto**. Es una decisión de
producto ya cerrada y documentada (`README.md`: "V1.2 retira categoría local del onboarding/
cálculo"), no un bug de este Edge Function. Como consecuencia, aunque el fix es correcto y
necesario (elimina un hardcode engañoso y deja el código robusto ante cualquier cambio futuro del
motor), **`level_states.declared_category` va a seguir en `NULL` para toda cuenta real** hasta que
exista una decisión de producto aparte de reintroducir esa pregunta en el cuestionario — eso
reabriría el onboarding de Nivel (Bloque 3), fuera de alcance de una corrección de "Perfil
editable". Consecuencia práctica: `profiles.current_category` seguirá siendo, en la práctica, la
**única** vía real hoy para que una cuenta declare y vea reflejada una categoría — que es
exactamente por lo que la separación A/B de 17.3 importa aunque A quede vacío por ahora.

**DECISIÓN ABIERTA de producto** (no bloqueante, para ChatGPT central/Sebastián): si/cuándo
reintroducir una pregunta de categoría en el onboarding de Nivel V1.2/V1.3.

### 17.5 Tests — reescritos

`supabase/tests/verify-preprod-p01c-profile-editable.sql` fue reescrito por completo. Nuevas
verificaciones agregadas (todo transaccional, `ROLLBACK` final, cero fixtures permanentes):

1. `update_profile_avatar`: ruta propia aceptada; carpeta ajena rechazada; **URL completa de un
   dominio externo que contiene el propio player_id como substring, rechazada** (el caso exacto
   que motivó la corrección — con el chequeo viejo esto pasaba); traversal/segmento anidado
   rechazado; `NULL` sigue quitando la foto sin el chequeo.
2. `get_public_profile`: expone la ruta de avatar y filtra `whatsapp_phone` por consentimiento
   (sin cambios de ronda 1) + **nueva** subverificación de visibilidad cruzada (un segundo usuario
   autenticado puede resolver la ruta de avatar de otro jugador vía la RPC) — corre solo si el
   entorno tiene una segunda cuenta real registrada disponible; si no, se saltea con
   `RAISE NOTICE` explícito, nunca falla el script por eso.
3. `update_current_category`: escritura válida; el timestamp NO se re-estampa si el valor no
   cambió (usando un timestamp inyectado deliberadamente 10 días atrás como base, porque `now()`
   queda fijo para toda la transacción en Postgres y no sirve para distinguir "se re-estampó" de
   "no se re-estampó" comparando dos llamadas dentro del mismo script); SÍ se re-estampa si el
   valor cambió; valor fuera del conjunto permitido rechazado; ninguna de estas escrituras toca
   `level_states` (`mu`/`confidence`/`evidence_units`/`declared_category`/`status` comparados
   antes/después, deben ser idénticos).
4. `officialize_level_onboarding`: manipula `level_states.status` a `'PENDIENTE'` de forma
   controlada y temporal (revertido por el `ROLLBACK` final) para poder ejercitar de verdad la
   transición sin depender de que la cuenta elegida esté hoy, por casualidad, en ese estado exacto.
   Verifica que `declared_category` llega y se persiste, que `profiles.current_category` se
   inicializa con ese mismo valor, que una segunda llamada (idempotencia ya existente) no
   sobrescribe nada, y que editar la categoría actual desde Perfil después NO mueve
   `level_states.declared_category` (inmutabilidad real, no solo documentada).
5. Storage: bucket `avatars` privado con los límites configurados; exactamente 4 políticas RLS
   scoped a esa bucket; la política de SELECT ya no está scoped por carpeta (`ilike '%foldername%'`
   ausente en su `qual`); ninguna de las 4 políticas incluye los roles `anon`/`public`.
6. Permisos: `update_current_category` solo `authenticated` (ni `public` ni `anon`); resto de
   funciones sin cambios de grants respecto de la ronda 1.

**Lo que este test SQL no puede probar** (documentado con honestidad en su propia cabecera, no una
omisión): que un `GET` HTTP anónimo real contra el objeto de Storage devuelva 400/403, y que
`createSignedUrl` resuelva de verdad una URL utilizable cross-usuario en un navegador real — ambos
son comportamiento de la API REST de Storage, no alcanzable desde una función SQL. Lo que el test
SÍ verifica es el contrato de catálogo que estructuralmente implica ambas cosas (bucket privado +
exactamente las políticas esperadas, sin `anon`/`public` en ningún rol). Queda como QA manual final
contra Staging real (§17.6).

### 17.6 QA manual pendiente contra Staging real (una vez aplicada la migración)

1. Desde una cuenta real: subir avatar, confirmar que se ve en Home/Mi Perfil/Editar Datos.
2. Desde una SEGUNDA cuenta real distinta: abrir el Perfil público de la primera y confirmar que
   el avatar se ve (prueba real de `createSignedUrl` cross-usuario, no alcanzable desde este
   entorno).
3. Copiar la URL firmada resuelta (inspeccionar el `src` del `<img>`) y abrirla en una pestaña
   sin sesión (o `curl` sin cookies/headers) — debe fallar (bucket privado). Esperar unos segundos
   más allá de las 24h de vigencia (o simplemente confirmar que la URL trae un parámetro de
   expiración) para confirmar que no queda accesible para siempre.
4. Editar "Categoría actual" desde Editar Datos, guardar, recargar y confirmar que persiste — y
   que el Nivel BRAMU (banda/estado) no se movió ni un poco.
5. Confirmar que `officialize-onboarding` (cuestionario nuevo) sigue funcionando de punta a punta
   sin errores tras el `CREATE OR REPLACE` y el cambio del Edge Function.

### 17.7 Bundle y commit

Bundle `04.10-h30` (bump desde `04.10-h29`, mismo criterio de siempre — `app.js`/`auth.js`
cambiaron). `Store.VERSION`/`version.json` siguen en `"BRAMUlab V04.10"`.

Regresión local corrida de nuevo tras esta revisión: `node --test` 255/255 PASS;
`bramulab/tests.html` 1478/1478 PASS; QA manual en el navegador embebido con una cuenta
local/legacy confirmando que la fila "Categoría actual" de Editar Datos sigue funcionando
exactamente igual que antes (picker abre, selecciona, guarda, persiste con fecha) — la rama de
código local (`declaredCategory`/`declaredCategoryAt`, líneas ~10248-10259 de `app.js`) no fue
tocada por esta revisión.

Un único commit lógico adicional (migración corregida + Edge Function + frontend + test + este
informe), push a `origin/staging`. Sin `main`, sin Production, sin BRAMUlive.
