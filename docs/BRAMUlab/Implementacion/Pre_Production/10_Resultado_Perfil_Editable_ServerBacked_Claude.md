# Pre-Production — Resultado P0.1C Perfil editable server-backed — Claude Code

**Fecha:** 24 de septiembre de 2026
**Rama:** `staging`
**Handoff ejecutado:** `09_Handoff_Perfil_Editable_ServerBacked_Claude.md`.
**Estado:** implementación completa, testeada localmente (dentro de lo que esta sesión puede
ejecutar sin Supabase real) y pusheada a `origin/staging`. Sin `main`, Production ni BRAMUlive
tocados. No se reabrió P0.1 ni Ranking automático.

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
- P0.1/P0.1B: no reabiertos, sin cambios sobre lo ya validado en Staging real.
