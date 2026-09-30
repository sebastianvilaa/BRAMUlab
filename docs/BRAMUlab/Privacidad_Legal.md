# BRAMUlab — Privacidad / Legal V1

**Estado:** decisiones humanas de producto CERRADAS · sin revisión jurídica externa obligatoria · implementación/verificación técnica PENDIENTE  
**Fecha de consolidación:** 28/09/2026  
**Entorno de trabajo:** Staging hasta autorización explícita de Production.

Este documento es la **fuente maestra vigente** de Privacidad / Legal para BRAMUlab.

No reabrir decisiones de producto cerradas salvo que:
1. una revisión jurídica profesional determine que una obligación concreta exige un cambio; o
2. aparezca una nueva función del producto con impacto legal/privacidad.

Los datos identificatorios privados del responsable (por ejemplo domicilio completo, CUIT u otros datos personales) **no se copian a este repositorio público**. Existen en la fuente privada de trabajo y, antes de publicar documentos, debe definirse internamente qué corresponde exponer públicamente y qué usar solo en trámites, apoyándose en fuentes oficiales vigentes.

---

## 1. Alcance territorial V1

- BRAMUlab se lanza, comunica y opera inicialmente desde **Argentina**.
- V1 se diseña bajo normativa y jurisdicción argentina aplicable.
- **No hay geobloqueo:** una persona de otro país puede registrarse y usar el servicio.
- Durante V1 no habrá promoción deliberada, campañas segmentadas ni localización comercial dirigida a mercados extranjeros.
- La comunicación inicial será orgánica/informativa, principalmente mediante Instagram y enlaces de acceso.
- Antes de una expansión internacional deliberada deberá revisarse el impacto jurídico del mercado objetivo.

Esto no debe redactarse como una afirmación de cumplimiento global irrestricto.

---

## 2. Cuenta, acceso y soporte

### Acceso

- Login V1: email + contraseña.
- Recuperación: email + OTP.
- `@usuario` es identidad pública, no credencial de acceso V1.
- El email es privado frente a otros jugadores.

### Canal único V1

- Canal de soporte/privacidad: `bramulab@gmail.com`.
- No habrá sistema de tickets en V1.
- Puede existir acuse automático de recepción, pero las solicitudes reales que lo requieran deberán revisarse/responderse.

### Acceso / copia / rectificación

- Solicitudes de acceso o copia de datos: por email.
- Sin exportación autoservicio V1.
- La respuesta debe generarse con un formato estandarizado alimentado por datos reales de la cuenta.
- Rectificación ordinaria: desde Perfil.
- Casos no corregibles desde la app: por el mismo canal.

---

## 3. Eliminación de cuenta

Decisión V1:

- autoservicio;
- verificación de control del email por código;
- el correo explica consecuencias principales;
- ejecución solo después de ingresar correctamente el código;
- una vez ejecutada, es definitiva y sin período adicional de arrepentimiento;
- si la persona perdió acceso al email, debe recuperarlo por su cuenta;
- V1 no ofrece verificación manual alternativa.

Consecuencias:

- la inactividad **nunca** elimina una cuenta constituida;
- eliminar cuenta no borra partidos compartidos ni historia de terceros;
- la identidad visible histórica pasa a `Jugador eliminado`;
- datos personales activos se eliminan o anonimizan según corresponda;
- backups pueden conservar temporalmente datos durante su ciclo técnico normal, sin reuso ni reaparición en el servicio activo;
- reingreso V1 crea identidad nueva desde cero, sin relink, cooldown ni huella antifraude.

Los plazos reales de backups/logs deben documentarse desde infraestructura real y validarse jurídicamente; no inventarlos.

---

## 4. Alta abandonada

- OTP vigente: 60 minutos, con posibilidad de reenvío al vencer.
- Un alta que nunca verificó email ni terminó de constituirse se conserva durante 24 horas desde el inicio.
- Cumplidas 24 horas, el alta abandonada se elimina y su `@usuario` se libera.
- Si vuelve, inicia registro desde cero.
- Una cuenta verificada/constituida nunca se elimina por inactividad.

---

## 5. Cambio de email, contraseña y sesiones

### Email

- autoservicio;
- requiere acceso al email actual;
- verificación de identidad;
- confirmación del email nuevo;
- aviso al email anterior;
- sin vía manual alternativa V1 si perdió acceso al actual.

### Contraseña

- usuario autenticado puede cambiarla con nueva verificación de identidad;
- aviso por email;
- cierre de las demás sesiones.

### Sesiones

- cerrar sesión actual;
- cerrar todas las sesiones;
- recuperación de contraseña, cambio de email y eliminación deben revocar las demás sesiones;
- V1 no necesita listado avanzado de dispositivos/IP/ubicaciones.

---

## 6. Menores

**Decisión de producto cerrada:**

- BRAMUlab V1 no impone por decisión de producto una edad mínima específica;
- el registro previsto es el mismo para mayores y menores;
- se solicita fecha de nacimiento declarada;
- no se exige DNI;
- no se diseña por anticipado un email de adulto responsable, autorización parental separada ni verificación de parentesco/identidad.

### Regla de implementación

**NO implementar un flujo parental o restricción por edad adicional por anticipación.** Antes de Production, Central debe contrastar esta decisión contra fuentes oficiales vigentes y requisitos reales de Apple/Google si correspondieran. Si surge una obligación concreta incompatible con la decisión actual, se implementará el ajuste mínimo necesario y se marcará como decisión reabierta solo por esa obligación.

No presentar la decisión de producto como una certificación jurídica.

---

## 7. Consentimiento y documentos legales

En alta:

**Acepto los Términos y Condiciones y declaro haber leído la Política de Privacidad.**

- checkbox obligatorio único;
- Términos y Privacidad enlazados;
- registrar fecha, hora y versión aceptada;
- nueva aceptación solo ante cambios relevantes/materiales;
- no mezclar con marketing;
- no mezclar con participación en Ranking, que es automática.

Términos y Privacidad deben:
- ser públicos sin login;
- estar disponibles en registro y Configuración;
- mostrar versión y fecha de vigencia;
- mostrar el canal de contacto;
- tener redacción final coherente con las decisiones cerradas y contrastada contra fuentes oficiales vigentes antes de Production.

Para futura publicación móvil, preparar además la URL pública de eliminación y los enlaces exigidos por tiendas.

---

## 8. Retención y anonimización

Principios cerrados:

- conservar únicamente lo necesario para finalidades reales del producto, seguridad y cumplimiento;
- preservar historial deportivo compartido sin mantener identidad personal visible cuando la cuenta fue eliminada;
- no reutilizar datos de backups;
- no inventar plazos.

Pendiente de verificación interna contra infraestructura real y fuentes oficiales:
- categorías de datos;
- fundamento y plazos;
- backups;
- logs;
- registros mínimos de seguridad/cumplimiento.

Desarrollo debe documentar el comportamiento real de infraestructura antes de cerrar la Política.

---

## 9. Nivel, Ranking e Intelligence

- Nivel BRAMU, Ranking BRAMU y BRAMU Intelligence son sistemas propios del producto.
- No representan clasificaciones oficiales de federaciones/asociaciones/circuitos profesionales.
- Dependen de los datos disponibles y no se promete exactitud absoluta.
- BRAMU puede corregir errores y modificar metodologías hacia adelante.
- Ediciones históricas publicadas se conservan como registro del momento y solo se corrigen retrospectivamente ante errores técnicos, datos falsos o fraude comprobado.

La redacción definitiva de estas aclaraciones/limitaciones debe contrastarse internamente contra fuentes oficiales vigentes.

---

## 10. Contenido, marca y datos deportivos

Decisiones de producto:

- BRAMU conserva derechos sobre marca, identidad visual, aplicación, diseño, textos, metodologías, fórmulas y sistemas propios.
- El usuario conserva la propiedad de sus fotografías/contenido, otorgando la autorización operativa necesaria para almacenarlo/procesarlo/mostrarlo dentro del servicio.
- No usar fotos de usuarios en publicidad externa sin autorización adicional.
- Cada usuario debe tener derecho suficiente para usar imágenes/información que carga.
- Quien carga un partido declara participación y veracidad de jugadores/resultado/datos.
- Está prohibido inventar partidos, participantes o resultados o manipular datos para alterar Nivel/Ranking/estadísticas/Intelligence.
- BRAMU puede corregir, invalidar o excluir del cómputo un partido ante error, fraude, conflicto o información falsa, preservando trazabilidad.

La redacción definitiva sobre contenido y las facultades de moderación/corrección debe contrastarse internamente contra fuentes oficiales vigentes.

---

## 11. Restricción / suspensión / cierre por abuso

Causas previstas, entre otras:

- falsificación de partidos/resultados;
- manipulación de Nivel o Ranking;
- suplantación;
- acoso;
- fraude;
- abuso;
- riesgos de seguridad;
- incumplimiento legal o de Términos.

La medida puede ser temporal o definitiva según gravedad. En casos graves puede aplicarse sin aviso previo.

El usuario puede pedir revisión por email, sin sistema formal de apelaciones/tickets V1.

La redacción final debe revisarse internamente para evitar facultades abusivas o arbitrarias.

---

## 12. Disponibilidad y evolución del producto

- BRAMUlab puede evolucionar, agregar, modificar o retirar funciones.
- Puede existir mantenimiento, errores o indisponibilidad.
- V1 es gratuito, sin promesa de gratuidad perpetua.
- Una función paga futura requiere información previa y nunca genera cargos retroactivos.
- Cambios materiales que afecten derechos/privacidad/condiciones deben notificarse y, cuando corresponda, requerir nueva aceptación.

---

## 13. Cierre legal interno antes de Production

**No existe una revisión jurídica externa obligatoria en el plan de BRAMUlab V1.** La ausencia de abogado externo no bloquea por sí sola Production.

Antes de cerrar P0.2, Central debe hacer una verificación final interna apoyada en fuentes oficiales vigentes y en los datos reales de la infraestructura, especialmente sobre:

1. menores y cualquier obligación concreta por edad;
2. identificación pública del responsable y datos que efectivamente deban publicarse;
3. AAIP y bases reales operadas;
4. retención, anonimización, backups y logs;
5. solicitudes de acceso/copia/rectificación;
6. transferencias internacionales y proveedores reales;
7. redacción territorial Argentina + acceso internacional sin geobloqueo;
8. coherencia final de Términos y Política de Privacidad;
9. suspensión/cierre de cuentas;
10. aclaraciones de Nivel/Ranking/Intelligence;
11. licencia operativa sobre contenido aportado por usuarios;
12. requisitos de Apple/Google solo si se publica en esas tiendas.

Si esa verificación detecta una obligación concreta que contradiga una decisión cerrada, se documenta la obligación y se reabre únicamente ese punto. No se mantiene una revisión externa genérica como gate.

---

## 14. Implementación técnica pendiente

Desarrollo deberá implementar/verificar, según prioridad de Pre-Production:

- flujo autoservicio de eliminación con OTP y revocación de sesiones;
- generación estandarizada del informe de acceso/copia;
- limpieza automática de altas abandonadas a 24 h + liberación de username;
- cambio de email autoservicio con verificaciones y avisos;
- cambio de contraseña autenticado + aviso;
- cerrar sesión actual / todas las sesiones;
- revocación de sesiones en eventos sensibles;
- aceptación versionada y reaceptación por cambios materiales;
- páginas legales públicas + enlaces en alta/Configuración;
- URL pública de eliminación para futura Google Play;
- procedimiento mínimo/auditable para corregir o invalidar partidos excepcionales;
- inventario real de proveedores, regiones, backups, logs, retención, subencargados y DPA;
- identificación real del proveedor de correo transaccional y su tratamiento de datos.

Algunas piezas ya tienen trabajo previo en Staging (por ejemplo eliminación de cuenta); no rehacerlas: verificar contra esta fuente maestra y completar únicamente lo faltante.

---

## 15. Estado de cierre

### Confirmado

- **No quedan decisiones humanas relevantes abiertas** para el taller de producto Legal/Privacidad.
- Argentina es el mercado inicial.
- No hay geobloqueo.
- No hay promoción deliberada en mercados extranjeros V1.

### Pendiente

- definición final/publicable de Términos y Política a partir de las decisiones ya cerradas;
- verificación interna con fuentes oficiales vigentes;
- implementación/verificación técnica;
- datos operativos reales de infraestructura/proveedores.

**No quedan decisiones humanas legales abiertas ni revisión externa obligatoria. P0.2 se cierra cuando estos pendientes de implementación/verificación estén completos.**

---

## 16. Implementación L1 (V04.19 / 04.19-h1, 30/09/2026)

Primera de las rondas L1/L2/L3 de Pre-Production (Issue #10). **Sin restricción 13+ ni flujo parental** (§6).

### Qué quedó implementado

- **Aceptación ANTES de crear el usuario Auth.** El checkbox legal único está en el Paso 1 del alta; `Auth.signUp(email, password, legalVersion)` rechaza (sin tocar Supabase) cualquier llamada sin versión legal válida, y el handler no la invoca con el checkbox sin marcar. La versión se lee SIEMPRE del servidor (`app_config.legal_version`), nunca se hardcodea en el cliente.
- **Evidencia server-side, append-only.** `legal_acceptances` (UNIQUE `player_id + legal_version`, trigger que rechaza UPDATE/DELETE, sin acceso directo del cliente). El `signUp` transporta `legal_version` como metadata (declaración del usuario, no autoridad); `handle_email_confirmed` registra la fila con `accepted_at = auth.users.created_at` (reloj del servidor). `complete_profile` exige una aceptación previa (`legal_acceptance_required`) y deriva el snapshot `profiles.terms_version/terms_accepted_at` de esa fila: un retry ya no mueve la fecha. No se guarda IP/User-Agent/texto de documentos.
- **Reaceptación (base).** `get_my_legal_status()` + `accept_legal_version(p_version)`: solo acepta la versión VIGENTE, idempotente (devuelve el `accepted_at` original), append-only (una versión nueva = fila nueva). El cliente bloquea con una pantalla de aceptación en login/boot y al volver a foreground cuando `requiresAcceptance`; permite aceptar o cerrar sesión. Cambiar `app_config.legal_version` (previo alta en `legal_versions`) = cambio material; una errata editorial no la cambia. Las cuentas históricas de Staging sin fila NO se retro-inventan: pasan por reaceptación.
- **Contraseña fuera del storage.** Vive solo en el DOM hasta `Auth.signUp` y se borra después; nunca entra a `signupDraft`. `Store.saveSignupDraft` filtra claves secretas y `loadSignupDraft` purga la contraseña de borradores legados. El borrador persiste solo datos no sensibles (email, versión legal, `startedAt`, `authSignUpDone`, perfil mínimo) y permite reanudar sin recuperar ninguna contraseña.
- **Fail-closed.** `PLAuth.getBackendMode()`: `server` | `local-dev` (solo host local explícito sin env staging/production) | `unavailable`. En `unavailable` (host desplegado o env staging/production sin credenciales/librería) alta, login, recuperación y arranque frenan con aviso; nunca se crean ni continúan cuentas locales en silencio.
- **Alta abandonada > 24 h.** Cliente: un borrador sin sesión con `startedAt` ≥ 24 h se descarta al arrancar (con sesión real nunca). Servidor: Edge Function `cleanup-abandoned-signups` (service role exacta, hourly por cron) + `list_abandoned_signups` / `release_abandoned_signup_username`. Candidato = usuario Auth sin email/teléfono confirmado, sin sesión, ≥ 24 h; **una cuenta con email confirmado jamás es candidata**. Revalida antes de borrar, borra por Auth Admin API (nunca DELETE SQL), idempotente, sin emails en logs. El @usuario no se reserva server-side antes de confirmar el email (`complete_profile` exige sesión confirmada); `release_abandoned_signup_username` lo libera igualmente si apareciera atado a un alta abandonada.

### Pendiente (Central / rondas siguientes)

- Aplicar la migración `20260930280000_preprod_l1_legal_acceptance_abandoned_signups.sql` en Staging, correr `supabase/tests/verify-preprod-l1-legal-cleanup.sql`, desplegar `cleanup-abandoned-signups` y programar el cron con `supabase/scripts/schedule-cleanup-abandoned-signups.sql` (service role key en Vault, nunca en el repo).
- L2: WhatsApp on-demand y caches owner-scoped. L3: páginas legales públicas finales (`/legal/terminos/`, `/legal/privacidad/` — los links del alta ya apuntan ahí y no resuelven hasta L3), delete-my-account.
- Los borradores `Legal/*_Borrador_V1.md` que mencionan 13 años están desfasados respecto de §6 y deben corregirse en el cierre legal publicable.

---

## 17. Implementación V04.20 (L1 operativo + L2 + L3 técnico, 01/10/2026)

### L1 operativo — cron seguro
`cleanup-abandoned-signups` ya no depende de que una persona copie la service role key. La migración `20260930310000` agrega `ensure_cleanup_cron_secret()` (genera un secreto aleatorio en Vault, server-side), `verify_cleanup_cron_secret()`, `schedule_cleanup_abandoned_signups(url)` y `unschedule_…` (solo `service_role`). El job (hourly, idempotente) lee el secreto de Vault en cada corrida y lo envía en `x-cron-secret`; la Edge Function (verify_jwt=false) acepta ese secreto o la service role key exacta, y responde 403 en otro caso. Central ejecuta una vez: `select public.schedule_cleanup_abandoned_signups('https://<ref>.supabase.co/functions/v1/cleanup-abandoned-signups');`. Verify: `supabase/tests/verify-preprod-v0420-cleanup-cron-secret.sql`.

### L2 — aislamiento y minimización
- `MATCH_OUTBOX`, `SERVER_MATCHES_CACHE` y `HISTORY_UNSEEN_CHANGES` pasan a formato v2 **owner-scoped** (`{[ownerId]: …}`, dueño = `player_id` server-backed). Los formatos globales v1 se invalidan y borran al cargar (no se migran). Cerrar sesión purga caches re-descargables del dueño y **conserva su outbox sin enviar** (aislada); eliminar la cuenta purga todo rastro local del dueño (`Store.purgeOwnerLocalData`).
- **WhatsApp on-demand** (migración `20260930300000`): `get_public_profile` ya no devuelve el teléfono, solo `whatsapp_contact_available`; `get_whatsapp_contact(player_id)` (authenticated, 10/60 s, consentimiento leído en ese instante, respuesta uniforme `unavailable`) es la única vía al número. El cliente lo pide al tocar el botón y no lo guarda. Verify: `verify-preprod-v0420-whatsapp-on-demand.sql`.

### L3 técnico
- **Páginas públicas** estáticas, sin JS ni sesión: `/terminos/`, `/privacidad/`, `/eliminar-cuenta/` (`bramulab/<slug>/index.html`), alineadas con este documento (sin 13+ ni flujo parental). Los datos aún inexistentes (responsable, AAIP, proveedores/regiones, backups, vigencia) usan el formato `[[PENDIENTE_PRODUCCION:clave]]`; `build-env.mjs` **corta el build de Production** mientras quede alguno (`scripts/legal-guard.mjs`). Enlaces desde alta, gate de reaceptación y Mi perfil → Mis datos → Legal y privacidad. Los borradores `Legal/*_Borrador_V1.md` quedan superados.
- **Acceso y seguridad**: cambio de email autoservicio (código al email actual → nuevo email → código del nuevo; `updateUser` + `verifyOtp email_change`), cambio de contraseña con cierre de las demás sesiones, **Cerrar sesión = scope local** (antes `signOut()` era global), Cerrar todas las sesiones, y cierre de otras sesiones tras recuperación/cambio de email. Sin listado de dispositivos. **Pendiente de verificar por Central**: que «Secure email change» esté activo en Supabase para el aviso al email anterior (textos/plantillas son del proyecto de Comunicaciones).
- **Acceso/copia**: «Solicitar copia de mis datos» abre un email a `bramulab@gmail.com` (sin exportación autoservicio); el operador genera el informe con `admin_export_player_data` / `supabase/scripts/admin-export-player-data.mjs` (solo lectura, `service_role`, terceros redactados, sin internals).
- **Eliminación autoservicio**: Edge Function `delete-my-account` (JWT de sesión; `{confirm:true}` únicamente; identidad resuelta server-side vía `resolve_player_for_account_deletion`; exige reautenticación reciente ≤10 min por OTP/recovery de email, claim `amr`) sobre el **mismo motor P0.3** (`_shared/account-deletion-core.mjs`, compartido con el script administrativo). UI en Acceso y seguridad → Eliminar mi cuenta: código al email → confirmación con consecuencias (sin «escribí ELIMINAR») → ejecución → purga local del dueño → pantalla final neutra. Idempotente/reintentable.
- **E2E destructivo**: `supabase/scripts/e2e-delete-my-account.mjs` (cuentas descartables `e2e_*`): `prepare` → `negatives` (401/400/403 automáticos, sin OTP) → `send-otp` (**único gate humano**) → `delete --otp` → `verify` → `cleanup`.

### Pendiente
Central: aplicar migraciones, verifies, advisors, desplegar `delete-my-account` (verify_jwt=true) y `cleanup-abandoned-signups` (verify_jwt=false), programar el cron, validar el claim `amr` del OTP en una sesión real. Gate humano: QA visual corto de Legal/Acceso + OTP de la cuenta descartable.

