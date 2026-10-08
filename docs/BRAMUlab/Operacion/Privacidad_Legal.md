# BRAMUlab — Privacidad / Legal V1

**Estado:** decisiones humanas CERRADAS · implementación técnica/G1/G2/P0.3 CERRADOS EN STAGING · cierre publicable pendiente de datos reales de Production/AAIP  
**Fecha de consolidación:** 28/09/2026  
**Entorno de trabajo:** Staging hasta autorización explícita de Production.

Este documento es la **fuente maestra vigente** de Privacidad / Legal para BRAMUlab.


## Estado operativo consolidado — 03/10/2026

La implementación técnica que este documento pedía ya fue realizada y gateada en Staging:

- aceptación legal previa al alta + evidencia append-only + reaceptación;
- cleanup de altas abandonadas;
- aislamiento owner-scoped y WhatsApp on-demand;
- páginas públicas y guard de build;
- Configuración / Acceso y seguridad;
- G1 Emails/Auth V1 **PASS final**;
- G2 Configuración/Acceso/Legal **PASS final con QA humana en iPhone**;
- eliminación autoservicio **E2E real PASS** con challenge específico, OTP, postcondiciones y comprobante posterior.

Por lo tanto, **P0.3 queda cerrado en Staging** y no debe seguir apareciendo como “falta E2E destructivo”.

P0.2 permanece abierto únicamente porque los textos públicos contienen datos que no pueden inventarse antes de crear/configurar Production: identidad/domicilio publicables del responsable, fecha de vigencia, constancia AAIP/RNBDP, proveedores/regiones y mecanismo real de transferencias, y ciclos reales de backups/logs. `scripts/legal-guard.mjs` impide construir Production mientras quede un `[[PENDIENTE_PRODUCCION:*]]`.

No completar esos campos usando datos de Staging como sustituto de Production.


No reabrir decisiones de producto cerradas salvo que:
1. una revisión jurídica profesional determine que una obligación concreta exige un cambio; o
2. aparezca una nueva función del producto con impacto legal/privacidad.

Los datos identificatorios privados del responsable (por ejemplo domicilio completo, CUIT u otros datos personales) **no se copian a este repositorio público**. Existen en la fuente privada de trabajo (en Dropbox, carpeta `Documentos privados/`, fuera del repositorio) y, antes de publicar documentos, debe definirse internamente qué corresponde exponer públicamente y qué usar solo en trámites, apoyándose en fuentes oficiales vigentes.

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

**Acepto los Términos y Condiciones, declaro haber leído la Política de Privacidad y autorizo el tratamiento de mis datos por proveedores fuera de Argentina.**

- checkbox obligatorio único;
- la autorización sobre proveedores fuera de Argentina forma parte de la misma aceptación; el detalle de proveedores, finalidades y destinos se explica en la Política de Privacidad, no se recarga el checkbox con jerga técnica;
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

## 14. Implementación técnica — cerrada en Staging / pendientes de salida

Los siguientes puntos fueron la lista de implementación de Pre-Production y **ya están implementados/verificados en Staging** salvo los datos operativos que dependen de Production:

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

- reemplazar todos los `[[PENDIENTE_PRODUCCION:*]]` con datos reales de salida, nunca supuestos;
- completar identificación/domicilio publicables del responsable desde la fuente privada correspondiente;
- completar/registrar AAIP/RNBDP cuando corresponda a la configuración real de salida;
- fijar proveedores, región, transferencias y ciclos reales de backups/logs de Production;
- definir la fecha de vigencia real de `legal_v1` y ejecutar el guard final de Production.

**No quedan decisiones humanas legales de producto abiertas ni revisión externa obligatoria. P0.2 se cierra con G3/G4 y la sustitución verificable de estos datos reales de Production.**

---

### Revisiones legales recomendadas antes de ampliar el alcance (consolidado 08/10/2026)
Pendientes no bloqueantes que vivían en la nota privada de decisiones (Dropbox, `Documentos privados/`); la revisión externa es reducción de riesgo, no un gate:
- Reevaluar GDPR u otras normas extranjeras **antes** de dirigir o promocionar deliberadamente el servicio en esos mercados.
- Antes de publicar apps móviles: correspondencia exacta entre los flujos reales, las declaraciones de privacidad de Apple, la ficha Data Safety de Google Play y las políticas públicas, incluidas las obligaciones al admitir menores sin flujo parental.
- Redacción proporcionada (no arbitraria) de las facultades de restricción/suspensión/cierre de cuentas; de las aclaraciones sobre Nivel, Ranking e Intelligence (sin excluir responsabilidades que no puedan limitarse); y de la licencia limitada sobre contenido de usuarios.
- Si una obligación legal concreta exigiera otro tratamiento por edad, aplicar el ajuste mínimo indispensable sin imponer una edad mínima ni un flujo complejo por anticipado.

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
- Los borradores `Legal/*_Borrador_V1.md` (que mencionaban 13 años, contra §6) se retiraron el 08/10/2026: el texto vigente es el de las páginas públicas `bramulab/{terminos,privacidad,eliminar-cuenta}/index.html`.

---

## 17. Implementación V04.20 (L1 operativo + L2 + L3 técnico, 01/10/2026)

### L1 operativo — cron seguro
`cleanup-abandoned-signups` ya no depende de que una persona copie la service role key. La migración `20260930310000` agrega `ensure_cleanup_cron_secret()` (genera un secreto aleatorio en Vault, server-side), `verify_cleanup_cron_secret()`, `schedule_cleanup_abandoned_signups(url)` y `unschedule_…` (solo `service_role`). El job (hourly, idempotente) lee el secreto de Vault en cada corrida y lo envía en `x-cron-secret`; la Edge Function (verify_jwt=false) acepta ese secreto o la service role key exacta, y responde 403 en otro caso. Central ejecuta una vez: `select public.schedule_cleanup_abandoned_signups('https://<ref>.supabase.co/functions/v1/cleanup-abandoned-signups');`. Verify: `supabase/tests/verify-preprod-v0420-cleanup-cron-secret.sql`.

### L2 — aislamiento y minimización
- `MATCH_OUTBOX`, `SERVER_MATCHES_CACHE` y `HISTORY_UNSEEN_CHANGES` pasan a formato v2 **owner-scoped** (`{[ownerId]: …}`, dueño = `player_id` server-backed). Los formatos globales v1 se invalidan y borran al cargar (no se migran). Cerrar sesión purga caches re-descargables del dueño y **conserva su outbox sin enviar** (aislada); eliminar la cuenta purga todo rastro local del dueño (`Store.purgeOwnerLocalData`).
- **WhatsApp on-demand** (migración `20260930300000`): `get_public_profile` ya no devuelve el teléfono, solo `whatsapp_contact_available`; `get_whatsapp_contact(player_id)` (authenticated, 10/60 s, consentimiento leído en ese instante, respuesta uniforme `unavailable`) es la única vía al número. El cliente lo pide al tocar el botón y no lo guarda. Verify: `verify-preprod-v0420-whatsapp-on-demand.sql`.

### L3 técnico
- **Páginas públicas** estáticas, sin JS ni sesión: `/terminos/`, `/privacidad/`, `/eliminar-cuenta/` (`bramulab/<slug>/index.html`), alineadas con este documento (sin 13+ ni flujo parental). Los datos aún inexistentes (responsable, AAIP, proveedores/regiones, backups, vigencia) usan el formato `[[PENDIENTE_PRODUCCION:clave]]`; `build-env.mjs` **corta el build de Production** mientras quede alguno (`scripts/legal-guard.mjs`). Enlaces desde alta, gate de reaceptación y Mi perfil → Mis datos → Legal y privacidad. Los borradores `Legal/*_Borrador_V1.md` quedaron superados y se retiraron del árbol (08/10/2026; Git los conserva).
- **Acceso y seguridad**: cambio de email autoservicio (código al email actual → nuevo email → código del nuevo; `updateUser` + `verifyOtp email_change`), cambio de contraseña con cierre de las demás sesiones, **Cerrar sesión = scope local** (antes `signOut()` era global), Cerrar todas las sesiones, y cierre de otras sesiones tras recuperación/cambio de email. Sin listado de dispositivos. **Pendiente de verificar por Central**: que «Secure email change» esté activo en Supabase para el aviso al email anterior (textos/plantillas son del proyecto de Comunicaciones).
- **Acceso/copia**: «Solicitar copia de mis datos» abre un email a `bramulab@gmail.com` (sin exportación autoservicio); el operador genera el informe con `admin_export_player_data` / `supabase/scripts/admin-export-player-data.mjs` (solo lectura, `service_role`, terceros redactados, sin internals).
- **Eliminación autoservicio**: Edge Function `delete-my-account` (JWT de sesión; `{confirm:true}` únicamente; identidad resuelta server-side vía `resolve_player_for_account_deletion`; exige reautenticación reciente ≤10 min por OTP/recovery de email, claim `amr`) sobre el **mismo motor P0.3** (`_shared/account-deletion-core.mjs`, compartido con el script administrativo). UI en Acceso y seguridad → Eliminar mi cuenta: código al email → confirmación con consecuencias (sin «escribí ELIMINAR») → ejecución → purga local del dueño → pantalla final neutra. Idempotente/reintentable.
- **E2E destructivo**: `supabase/scripts/e2e-delete-my-account.mjs` (cuentas descartables `e2e_*`): `prepare` → `negatives` (401/400/403 automáticos, sin OTP) → `send-otp` (**único gate humano**) → `delete --otp` → `verify` → `cleanup`.

### Gate Central V04.20 — resultado

**PASS técnico en Staging.** Central aplicó las migraciones V04.20, desplegó `delete-my-account` y `cleanup-abandoned-signups`, programó el cron real y ejecutó los verifies:

- `V0420_WHATSAPP_VERIFY_OK`;
- `V0420_SELF_SERVICE_VERIFY_OK`;
- `V0420_CRON_SECRET_VERIFY_OK`;
- `L1_VERIFY_OK`;
- regresión `V0418_VERIFY_OK`.

El cron respondió **200** con secreto correcto y **403** con secreto inválido. `delete-my-account` sin JWT respondió **401**. Durante el gate se corrigieron dos puntos de infraestructura: idempotencia transaccional del scheduler y `pg_net` fuera de `public`; el warning nuevo del advisor quedó eliminado.

### Pendiente externo para cerrar P0.2

- sistema de emails/configuración Auth coordinado con Comunicaciones, incluyendo distinguir correctamente el correo de una acción sensible como eliminación de cuenta;
- QA browser corto de Legal + Acceso y seguridad;
- E2E destructivo sobre cuenta descartable, con un único gate humano de OTP.

Mientras Comunicaciones trabaja, puede adelantarse **hardening de Staging previo a Bloque 9** que no dependa de emails ni de Production. No cerrar P0.2 hasta completar esos tres gates.


### G1 — Emails/Auth V1 (01/10/2026)
- La eliminación de cuenta exige un desafío específico `delete_account` (OTP del email #7, 60 min, un uso, ≤ 10 min de antigüedad al eliminar); una reautenticación genérica ya no alcanza. El comprobante #8 se envía únicamente después de las postcondiciones reales de P0.3 y no ofrece recuperación ni soporte.
- Datos temporales de los desafíos (`account_challenges`): solo hash HMAC del OTP; los emails (`target`/`previous`) se limpian al terminar el cambio, se podan a los 2 días y toda fila del usuario eliminado se purga con la eliminación. Sin acceso de cliente (RLS sin políticas, RPC `service_role`). Ver `Implementacion/Pre_Production/90_Resultado_G1_Emails_Implementacion_Tecnica_01OCT.md`.

---

## 18. Actividad básica de uso (BRAMU Metrics) — consentimiento informado, textos para revisión, SIN publicar

**Estado (09/10/2026):** `privacidad/`, `terminos/` y `eliminar-cuenta/` **no se tocaron** (siguen en `legal_v1`, vigencia 07/10/2026). Production **no captura** actividad. La solución de consentimiento (V04.38 / `04.38-h1`) está **implementada y probada solo en Staging** (migración `20261008150000`, pendiente de aplicar por Central). Esta sección fija la decisión, el diseño, los textos para revisión y lo que falta. No es asesoramiento jurídico.

### 18.1 Decisiones CONFIRMADAS por Sebastián
1. Metrics registra **únicamente actividad básica** para mejorar BRAMUlab, **sin seguimiento individual ni publicidad**.
2. **(09/10/2026, reemplaza la preferencia de «evitar una nueva aceptación»)** Se actualiza la Política de privacidad y se solicita una **aceptación informada** del registro de actividad: usuarios ya registrados → **una única pantalla breve** integrada en BRAMUlab; usuarios nuevos → la información y la aceptación **dentro del registro habitual**, sin segunda pantalla; **no se registra ninguna apertura antes del consentimiento**; quien no consiente **no se mide** y usa BRAMUlab igual; se **conserva evidencia** de la aceptación; **no se reconstruyen** aperturas previas.
3. Al eliminar una cuenta se **elimina** su actividad (migración `20261008140000`, ya aplicada y verificada por Central en Staging). La **evidencia del consentimiento** se conserva (como `legal_acceptances`).
4. La **única** cuenta administradora de Production es la cuenta real y habitual **`@seba`**.

### 18.2 Por qué consentimiento y no «aclaración» (hechos verificados)
El texto vigente (Política §2 «eventos internos de producto», §3 finalidades) no menciona medir el uso; antes de Metrics solo se persistían eventos de cuenta (`signup_completed`, `level_confirmed`, `account_deleted`), **no existía registro de uso**; Términos §13 solo prevé «correcciones editoriales» (sin nueva aceptación) o «cambio material» (nueva aceptación). Hay dato nuevo y finalidad nueva (Ley 25.326 art. 4.3, 5.1, 6: información previa, expresa y clara). El consentimiento específico, opcional y revocable resuelve la incertidumbre sin afirmar que el texto vigente ya cubría el tratamiento.

### 18.3 Diseño implementado (reutiliza el sistema legal existente)
- **Mismo patrón que `legal_versions`/`legal_acceptances`**, pero **específico y opcional**: versión vigente en `app_config.activity_consent_version` (**NULL = medición apagada**; la fija Central **solo después de publicar la Política**) y tabla append-only `activity_consents` (jugador, versión, `granted|declined`, origen `signup|prompt|settings`, versión legal vigente, fecha; sin texto). Aceptación legal obligatoria (`legal_v1`) y consentimiento de medición **no se mezclan**: rechazar la medición no bloquea nada.
- **El servidor decide.** `register_app_presence` no escribe sin `granted` vigente (`measurement_disabled` / `no_consent`); el cliente tampoco llama sin estado confirmado. **Declinar o retirar elimina** la actividad ya registrada. No hay reconstrucción: la actividad previa nunca existió y una purga idempotente elimina cualquier fila capturada sin consentimiento válido.
- **Usuarios nuevos:** casilla **opcional, desmarcada**, en el paso 1 del alta, junto a la aceptación legal; viaja como metadata y `handle_email_confirmed` registra la evidencia al confirmar el email (solo si la versión coincide con la vigente). Sin segunda pantalla.
- **Usuarios existentes:** una pantalla («Ayudanos a mejorar BRAMUlab», ACEPTAR / NO, GRACIAS) tras el gate legal, solo si el estado es «sin decidir»; quien decide no es consultado de nuevo. Si falla la lectura o el guardado no queda atrapado (salida «Decidir más tarde»; sin consentimiento no se mide).
- **Cambiar de opinión:** Configuración → «Medición de uso» (ACTIVAR / DESACTIVAR).
- **Metrics:** la consola muestra cuántas cuentas consienten (con k=5) y la retención solo cuenta cohortes que consintieron desde el día de alta. DAU/WAU/MAU son **de quienes consintieron**: subestiman la actividad total (se declara en la consola).
- **Informe de datos del jugador** (`admin_export_player_data`) incluye `activityConsents`.

### 18.4 Textos definitivos para revisión (NO publicados)
**Pantalla de decisión (usuarios existentes):** título «Ayudanos a mejorar BRAMUlab»; «¿Nos dejás registrar tu **actividad básica de uso**?»; *Qué registramos:* el día en que abrís la app, si la usás desde el navegador o instalada, el tipo de dispositivo y la versión; sin IP, ubicación ni pantallas que visitás. *Para qué:* solo conteos agregados para mejorar BRAMUlab; sin publicidad ni seguimiento individual. *Es opcional:* si no aceptás, usás BRAMUlab igual; podés cambiarlo en Configuración y, si lo retirás, eliminamos tu actividad registrada. Enlace a la Política (`#actividad-de-uso`).
**Casilla del alta (opcional, desmarcada):** «Opcional: acepto que BRAMUlab registre mi actividad básica de uso (qué día abro la app y desde qué tipo de dispositivo) para mejorarla, sin publicidad. Puedo cambiarlo cuando quiera. Más información».

**Política de privacidad** (nueva vigencia; ancla `id="actividad-de-uso"` para el enlace):
- **§2 «Datos técnicos»** — agregar: «**Actividad básica de uso (solo si lo aceptás).** Si aceptás, cada día en que abrís BRAMUlab con tu cuenta registramos, asociada a tu cuenta, la fecha (hora de Buenos Aires), si la usaste desde el navegador o como app instalada, una clasificación general del dispositivo (iPhone/iPad, Android, computadora u otro), la versión de la app y cuántas veces la abriste ese día. No incluye tu dirección IP, tu ubicación, el modelo de tu dispositivo, las pantallas que visitás ni el contenido de lo que cargás. Si no aceptás, no registramos esta actividad.»
- **§3 «Para qué los usamos»** — agregar: «**Medición de uso (solo con tu consentimiento).** Con la actividad básica de uso calculamos conteos agregados —por ejemplo, cuántas personas abrieron BRAMUlab en una semana o cuántas siguen usándola— para entender cómo se usa el servicio y decidir qué mejorar. No la usamos para publicidad, no la vendemos ni la compartimos con terceros para sus propios fines, y no hacemos seguimiento individual de personas: no elaboramos fichas, listados ni rankings de uso por persona.»
- **§6 «Conservación y eliminación»** — agregar: «Tu actividad básica de uso se conserva mientras tu cuenta esté activa y el consentimiento vigente, y **se elimina** si retirás el consentimiento o eliminás la cuenta: no la conservamos anonimizada ni seudonimizada. Conservamos la constancia de tu decisión (versión, fecha y si aceptaste o no) como prueba, igual que la de tu aceptación de estos documentos.»
- **§7 «Tus derechos»** — *Acceso y copia*: «El informe incluye tus días de actividad y tus decisiones de consentimiento.» *Supresión*: «incluye tu actividad». Agregar *Retirar el consentimiento*: «En Configuración → Medición de uso, en cualquier momento; no afecta el uso de BRAMUlab.»
- **Fecha de vigencia + «Historial de cambios»:** «<dd> de <mes> de 2026 — Se describe la medición de actividad básica de uso, opcional y con tu consentimiento (§2, §3, §6 y §7). Sin cambios en proveedores ni destinos.»

**`eliminar-cuenta/index.html`** — viñeta de datos eliminados: «…; **tu registro de actividad básica de uso**; …» y nota: «Conservamos únicamente la constancia técnica de tu decisión de consentimiento (sin datos de actividad).»

**Términos y Condiciones:** sin cambios de contenido (la medición se explica en la Política). **Versión legal:** la Política cambia de texto pero **no se exige reaceptar `legal_v1`**: la aceptación específica se pide por el consentimiento nuevo. **Esto es un punto de verificación interna (§18.6, p. 1).**

**Cuidado de redacción:** «no hacemos seguimiento individual…» es un compromiso de uso (verdadero), no «es imposible consultar la actividad de una persona»: Central con acceso a la base podría. Tampoco se afirma que el consentimiento sea condición del servicio (no lo es).

### 18.5 AAIP/RNBDP — qué falta verificar (expediente `EX-2026-97673851-APN-DNDPD#AAIP`, estado Iniciación) — **PENDIENTE EXPLÍCITO**
**Hecho (fuentes oficiales de la AAIP, consultadas 09/10):** la inscripción no vence; «deben mantener actualizada la información declarada»; modificar es gratuito y se hace por TAD con el número de registro; sin plazo fijado. Ley 25.326 art. 21.2: el registro incluye características y finalidad, **naturaleza de los datos**, destinatarios, medidas de seguridad y **tiempo de conservación**; art. 21.3 original: no poseer datos de naturaleza distinta de la declarada.
**La constancia es privada y no pude verificar su contenido.** Abrirla y comprobar: (1) ¿figuran datos de uso/actividad/navegación?; (2) ¿la finalidad alcanza «medir el uso para mejorar el servicio»?; (3) conservación coherente («mientras la cuenta esté activa y el consentimiento vigente; se elimina con ella»); (4) transferencias/destinatarios (Brasil/Supabase, EE. UU./Vercel y Google) sin cambios; (5) medidas de seguridad; (6) procedimiento: con el expediente en Iniciación, consultar a la AAIP si corresponde corregir en el trámite o modificar la inscripción luego. **No inventar el procedimiento.** Si faltan categorías o finalidades, ajustar **antes de empezar a capturar** (acción de Sebastián/Central, clave fiscal).

### 18.6 Revisión legal pendiente y orden de publicación
**Para la verificación interna de Central (§13), por escrito:** (1) ¿es suficiente publicar la nueva Política **sin** reaceptación de `legal_v1`, dado que la medición solo corre con consentimiento específico y opcional? ¿O conviene `legal_v2`? (2) ¿La casilla opcional del alta + pantalla única para existentes constituye consentimiento «libre, expreso e informado» (art. 5.1)? (3) ¿Hace falta conservar el **texto** del consentimiento además de versión + fecha (hoy se guarda `consent_version` y `legal_version`; el texto vive en Git/Política publicada)? (4) ¿El texto «sin interruptor de oposición» ya no aplica? (5) ¿Qué exige la AAIP antes de capturar (§18.5)?
**Orden:** (1) verificación interna + constancia AAIP → (2) Sebastián autoriza **con SHA** → (3) publicar la Política/Eliminar cuenta (§18.4) → (4) Central aplica la migración `20261008150000` y las del Runbook Parte D → (5) **recién entonces** Central fija `app_config.activity_consent_version = 'activity_v1'` (hasta ese UPDATE la app no muestra ni pide nada y no se mide) → (6) promoción del frontend V04.38 → (7) verificar. Nunca capturar antes de publicar el texto (art. 6: información *previa*).
