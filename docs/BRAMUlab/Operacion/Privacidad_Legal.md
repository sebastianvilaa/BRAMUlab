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

## 18. Actividad básica de uso (BRAMU Metrics) — análisis y textos para revisión, SIN publicar

**Estado (09/10/2026):** `privacidad/`, `terminos/` y `eliminar-cuenta/` **no se tocaron** (siguen en `legal_v1`, vigencia 07/10/2026). Production **todavía no captura** actividad. Esta sección fija lo confirmado, el análisis de si basta una aclaración, los textos listos para revisión y lo que falta verificar ante la AAIP. No es asesoramiento jurídico: la conclusión sobre «aclaración vs. nueva aceptación» **queda abierta** (§18.2).

### 18.1 Decisiones CONFIRMADAS por Sebastián
1. Metrics registra **únicamente actividad básica** para mejorar BRAMUlab, **sin seguimiento individual ni publicidad**.
2. La medición se explica con claridad en la Política de privacidad.
3. Se prefiere **evitar una nueva aceptación** de todos los jugadores **solo si la revisión legal confirma que es adecuado**. No se asume.
4. Al eliminar una cuenta se **elimina** su actividad (no se conserva seudonimizada: verificado que no se puede garantizar el anonimato; migración `20261008140000`, ya aplicada y verificada por Central en Staging).
5. La **única** cuenta administradora de Production es la cuenta real y habitual **`@seba`** (identidad ya comprobada por Central).

### 18.2 ¿Aclaración o cambio material? — **NO CONFIRMADO** (incertidumbre legal identificada)
**Hechos verificados (repositorio, 09/10):**
- *Qué dice el texto vigente:* Política §2 «Datos técnicos»: «contadores anti-abuso y un conjunto mínimo de eventos internos de producto…». Política §3 (finalidades): crear/proteger la cuenta, identificar, registrar y compartir partidos, calcular Nivel/Ranking, generar Intelligence, prevenir abuso y dar soporte — **no menciona medir el uso para mejorar el producto**.
- *Qué existía en la práctica:* los únicos «eventos internos» persistidos antes de Metrics son `signup_completed`, `level_confirmed` y `account_deleted` (eventos de cuenta). **No existía ningún registro de uso/apertura.** La actividad diaria es un dato nuevo, no la descripción de algo que ya se hacía.
- *Qué prometen los Términos (§13) y la Política (§9):* «Si un cambio es **material para tus derechos, tu privacidad** o las condiciones esenciales, te lo informaremos y te pediremos aceptar de nuevo… Las **correcciones editoriales que no cambian el sentido** no requieren una nueva aceptación.» **No existe una tercera categoría** («cambio informativo sin aceptación»).
- *Cómo se prueba lo aceptado:* `legal_acceptances` guarda **versión + fecha** (no el texto; decisión de minimización). Mecanismo de reaceptación ya construido y probado: si `app_config.legal_version` ≠ última aceptada, pantalla bloqueante antes de Home.
- *Marco legal (Ley 25.326, texto original; verificar vigente):* art. 4.1 datos adecuados y no excesivos; **art. 4.3** no usar los datos para finalidades distintas o incompatibles con las que motivaron su obtención; **art. 5.1** consentimiento libre, expreso e informado (**5.2.d**: no se exige cuando los datos derivan de una relación contractual y son **necesarios para su desarrollo o cumplimiento**); **art. 6** informar **previamente**, en forma expresa y clara, finalidad, destinatarios, existencia del archivo y responsable, carácter facultativo u obligatorio, consecuencias y derechos de acceso/rectificación/supresión; **art. 21.3** (versión original) no poseer datos de naturaleza distinta de la declarada en el registro.

**Criterios de materialidad (según el propio texto de BRAMUlab):**
| Criterio | Resultado | Lectura |
|---|---|---|
| ¿Nueva categoría de dato personal? | **Sí** (actividad diaria asociada a la cuenta) | Empuja a «material» |
| ¿Nueva finalidad? | **Sí** (medir uso para mejorar el producto; no figura en §3) | Empuja a «material» (art. 4.3) |
| ¿Nuevos destinatarios, transferencias o proveedores? | No (mismo Supabase São Paulo; sin terceros de analítica) | Empuja a «aclaración» |
| ¿Dato sensible, contenido, ubicación, IP, pantallas? | No | Empuja a «aclaración» |
| ¿Más intrusivo para el usuario? | Bajo: automático, mínimo, sin perfil individual, se elimina con la cuenta | Empuja a «aclaración» |
| ¿Hay forma de oponerse sin eliminar la cuenta? | **No** (no existe interruptor) | Punto a revisar |
| ¿Cambia derechos/obligaciones? | No; **sí** agrega un dato al informe de acceso | Neutro |

**Conclusión de esta revisión técnica:** el cambio **no es** una «corrección editorial que no cambia el sentido» (agrega un dato y una finalidad). Solo podría tratarse como aclaración si la verificación interna concluye que el texto vigente («eventos internos de producto») ya cubría este tratamiento —lo que choca con que antes no existía ningún registro de uso— o que la medición cae en la excepción del art. 5.2.d (que parece forzada: la medición para mejorar el producto no es estrictamente necesaria para prestar el servicio). **No puedo confirmar que sea adecuado omitir la nueva aceptación; con los hechos de arriba el riesgo de que se la considere material no es trivial.** Esa decisión corresponde a la verificación interna de Central (§13) y a Sebastián; si no se puede confirmar, rige la regla confirmada: **no asumirla**.

**Opciones (sin recomendar saltear el análisis):**
- **A — Aclaración sin nueva aceptación.** Solo si la verificación interna concluye por escrito que es adecuado. Se publica el texto (§18.3) con nueva fecha de vigencia, **manteniendo `legal_v1`** y agregando «Historial de cambios» fechado (la prueba de qué texto estaba vigente al aceptar sale de `accepted_at` + ese historial + Git). Riesgos: contradice la lectura literal de Términos §13 si luego se la considera material; evidencia menos nítida (dos textos bajo un mismo id).
- **B — `legal_v2` con nueva aceptación.** Es la opción **sin ambigüedad** y hoy es **barata**: con ≈ 6 cuentas reales la pantalla de reaceptación ya construida se muestra una vez a cada una; cuantos más usuarios haya, más costosa. Implica: insertar `legal_v2` en `legal_versions`, `app_config.legal_version = 'legal_v2'`, publicar las 3 páginas con `legal_v2`, y actualizar las pruebas que fijan `legal_v1`. La captura de actividad puede empezar recién cuando los usuarios acepten (o aceptando que la actividad de quien aún no aceptó se registra sin esa aceptación: decisión de la verificación interna).
- **C — Reducir el alcance** (solo si ni A está confirmada ni B es aceptable): contar aperturas **sin identidad** (agregados por día/plataforma/versión). Elimina la cuestión de dato personal pero **pierde** usuarios activos distintos (DAU/WAU/MAU) y retención: implica rediseñar F1 (**función nueva**, fuera del alcance actual).
- **En cualquiera:** el texto debe estar **publicado antes** de que empiece la captura (art. 6: información *previa*).

**Preguntas concretas para la verificación interna (Central, §13)** — responder por escrito:
1. ¿«Eventos internos de producto» (§2) cubría un registro diario de apertura asociado a la cuenta? ¿Con qué fundamento, dado que antes solo existían eventos de cuenta?
2. ¿La mejora del producto es una finalidad compatible con las del §3 (art. 4.3) o una finalidad nueva a informar?
3. ¿Aplica el art. 5.2.d (necesidad para la relación) o se requiere consentimiento expreso para este dato? ¿Alcanza el consentimiento ya prestado al aceptar la Política vigente?
4. ¿La ausencia de un mecanismo de oposición específico es aceptable para un dato mínimo, agregado y eliminado con la cuenta?
5. ¿Requiere el cambio una modificación del registro ante la AAIP **antes** de empezar a capturar (§18.4)?

### 18.3 Textos definitivos para revisión (NO publicados)
*Redacción para la Política de privacidad; igual para A y B. Va junto con la fecha de vigencia nueva y, en A, el «Historial de cambios».*

**§2 «Datos técnicos»** — reemplazar por:
> Contadores anti-abuso y un conjunto mínimo de eventos internos de producto, sin contraseñas, tokens ni contenido de notas.
> **Actividad básica de uso.** Cada día en que abrís BRAMUlab con tu cuenta registramos, asociada a tu cuenta, la fecha (hora de Buenos Aires), si la usaste desde el navegador o como app instalada, una clasificación general del dispositivo (iPhone/iPad, Android, computadora u otro), la versión de la app y cuántas veces la abriste ese día. Este registro no incluye tu dirección IP, tu ubicación, el modelo de tu dispositivo, las pantallas que visitás ni el contenido de lo que cargás. Se registra automáticamente mientras usás la app con tu cuenta.

**§3 «Para qué los usamos»** — agregar al final:
> **Medición de uso.** Con la actividad básica de uso calculamos conteos agregados —por ejemplo, cuántas personas abrieron BRAMUlab en una semana o cuántas siguen usándola— para entender cómo se usa el servicio y decidir qué mejorar. No usamos esta información para publicidad, no la vendemos ni la compartimos con terceros para sus propios fines, y no hacemos seguimiento individual de personas: no elaboramos fichas, listados ni rankings de uso por persona.

**§6 «Conservación y eliminación»** — agregar:
> Tu actividad básica de uso se conserva mientras tu cuenta esté activa y **se elimina junto con ella**: no la conservamos anonimizada ni seudonimizada.

**§7 «Tus derechos»** — en *Acceso y copia* agregar «El informe incluye tus días de actividad.»; en *Supresión* agregar «incluye tu actividad».

**Historial de cambios** (solo opción A; al final de la Política): «<dd> de <mes> de 2026 — Se describe el registro de actividad básica de uso (§2, §3, §6 y §7). Sin cambios en proveedores ni destinos.»

**`eliminar-cuenta/index.html`** — en «Qué pasa cuando eliminás tu cuenta», viñeta de datos eliminados: «Se eliminan o anonimizan tus datos personales: nombre, @usuario, foto, fecha de nacimiento, género, mano/lado, rama, localidad, teléfono y categoría; **tu registro de actividad básica de uso**; también tus notas privadas, notificaciones, listas personales y las observaciones de Intelligence asociadas a tus partidos.»

**Términos y Condiciones:** sin cambios de contenido (la medición se explica en la Política). En B solo cambian la versión y la vigencia. **Pantalla de reaceptación y textos dentro de la app:** sin cambios necesarios (genéricos y ya correctos: «se eliminan o anonimizan tus datos personales…»).

**Cuidado de redacción (para no prometer de más):** el texto dice «no hacemos seguimiento individual… no elaboramos fichas, listados ni rankings por persona» (compromiso de uso, verdadero), **no** «es imposible consultar la actividad de una persona»: Central/administración con acceso a la base técnicamente podría. Tampoco se afirma que haya interruptor de oposición.

### 18.4 AAIP/RNBDP — qué falta verificar (expediente `EX-2026-97673851-APN-DNDPD#AAIP`, estado Iniciación)
**Hecho (fuentes oficiales de la AAIP, consultadas 09/10):** la inscripción no vence; «deben mantener actualizada la información declarada» y el incumplimiento «puede ocasionar sanciones»; modificar es gratuito y se hace por TAD («Modificación de Datos Registro de Bases de Datos Privadas») con el número de registro de la base. No fijan un plazo. La Ley 25.326 (art. 21.2) exige que el registro incluya características y finalidad, **naturaleza de los datos**, destinatarios, medidas de seguridad y **tiempo de conservación**; el art. 21.3 original veda poseer datos de naturaleza distinta de la declarada.
**No pude verificar el contenido de lo presentado (la constancia es privada).** Abrir la constancia/expediente presentado el 07/10 y comprobar:
1. **Tipos o categorías de datos declarados:** ¿figuran datos de uso/actividad/navegación, o solo identificación, perfil, deportivos y de contacto?
2. **Finalidades declaradas:** ¿alcanzan «medir el uso para mejorar el servicio» o solo prestación del servicio, seguridad y soporte?
3. **Conservación declarada:** coherente con «mientras la cuenta esté activa; se elimina con ella».
4. **Transferencias y destinatarios:** Brasil (Supabase) y Estados Unidos (Vercel, Google) ya declarados; sin cambios.
5. **Medidas de seguridad:** coherentes con acceso restringido y agregación.
6. **Procedimiento:** al estar el expediente en Iniciación, consultar a la AAIP si corresponde **corregir dentro del expediente en trámite** o modificar la inscripción una vez asignado el número. No inventar el procedimiento.
**Si faltan categorías o finalidades:** ajustar el registro **antes de empezar a capturar** (el art. 21.3 y el deber de mantener actualizado el registro lo aconsejan). Es una acción de Sebastián/Central (clave fiscal), no de desarrollo.

### 18.5 Orden de publicación
1. Verificación interna (§18.2) y verificación de la constancia AAIP (§18.4) **→ decisión A o B**.
2. Publicar el texto de §18.3 (3 páginas; en B, además `legal_v2` + `app_config`) **antes o en la misma ventana** que la promoción de Metrics, nunca después.
3. Recién entonces el procedimiento de `Runbook_Operacion_y_Salida.md` Parte D.
