# Auditoría técnica — acceso simplificado a BRAMUlab (17/10/2026)

**Estado:** diagnóstico de solo lectura completado por Central el 17/10/2026. **NO es autorización para implementar, habilitar proveedores ni modificar bases**. Central consolidó la intención de producto, la documentación maestra, la inspección del código real y una lectura estructural del backend en Staging. Lo que resta son pruebas de integración y configuración, condicionadas a una futura autorización. No se modificó Production, `main`, BRAMUlive, Supabase ni app/web.

## Objetivo de producto
Reducir fricción de registro e inicio de sesión para jugadores amateurs. El usuario pide evaluar una entrada como «Continuar con Google», «Continuar con Apple» y «Continuar con email», sin obligar a crear una contraseña ni ingresar un código propio de BRAMUlab cuando el proveedor social ya verificó/autenticó a la persona. Mantener el flujo deportivo (perfil mínimo, @usuario, estimación de Nivel, Home) y el consentimiento informado. Considerar también otras opciones solo si mejoran de modo real la simplicidad y tienen costos/operación justificables. No sobrediseñar ni multiplicar proveedores sin motivo.

## Hechos verificados en `staging` al 17/10/2026
- `docs/BRAMUlab/README.md` remite a `Producto/Experiencia_Inicial.md`, `Operacion/Backend_Infraestructura.md` y `Operacion/Privacidad_Legal.md` como autoridades.
- `Operacion/Backend_Infraestructura.md` §8.1 y `Privacidad_Legal.md` §2 definen acceso V1 email+contraseña, email confirmado antes de Home y OTP manual de 6 dígitos al terminar perfil+estimación. No consta una decisión histórica que prohíba OAuth.
- `bramulab/auth.js` usa `c.auth.signUp({email,password,...})`, `c.auth.signInWithPassword(...)`, `verifyOtp(... type:'signup')`; no integra aún `signInWithOAuth`. En `getClient()` figura `detectSessionInUrl:false`, coherente con el OTP actual, **incompatible con confiar en el retorno OAuth sin adaptar callbacks**.
- Identidad deportiva: `players.player_id` estable, vinculado a `auth_user_id`, y partido/estadísticas asociados a `player_id`. Nunca crear otra identidad deportiva por cambio de proveedor ni fusionar por nombre.
- `Privacidad_Legal.md` §16: aceptación legal explícita antes del `auth.signUp`, metadatos + evidencia server-side; `complete_profile` requiere constancia. Cualquier ruta OAuth debe preservar aceptación, trazabilidad y gate previo a operaciones; no basta decir «al continuar aceptás» si no conserva los requisitos legales/técnicos.
- `Experiencia_Inicial.md` §15 y §30: hay invitaciones/claims de identidad provisional y recuperación de partidos. OAuth debe conservar el contexto de invitación a través del ida-y-vuelta con proveedor; reclamar identidad siempre requiere confirmación explícita del jugador y no puede enlazarse por nombre.
- La app es PWA web con URL `app.bramulab.com`; hay que auditar retorno del navegador y de la app instalada en iPhone/Safari y Android/Chrome, incluyendo sesiones, state/PKCE/redirect allowlist, Staging bajo autenticación y `__BRAMU_ENV__`.
- Usuarios registrados con email/contraseña deben conservar su Auth UID, `player_id`, historial, Nivel, validaciones y grupos al sumar un proveedor. Supabase ofrece enlazado automático por email verificado bajo reglas estrictas y enlazado manual; **comprobar riesgos de duplicación y casos de email distinto, Apple Hide My Email y cuentas no verificadas**; no asumir coincidencia segura por nombre o email no verificado.

## Fuentes externas consultadas (verificar vigencia al auditar)
- Google con Supabase: https://supabase.com/docs/guides/auth/social-login/auth-google
- Apple con Supabase: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Vinculación de identidades: https://supabase.com/docs/guides/auth/auth-identity-linking
- Tarifas Supabase: https://supabase.com/pricing — Social OAuth soportado dentro de Auth; límites MAU según plan, sin tarifa obligatoria por cada clic. No confundir con «Third-party Auth» como servicio diferente.
- Apple Developer: https://developer.apple.com/programs/enroll/ — membresía normalmente USD 99/año (revisar región/condiciones); requisito de Services ID/App ID y mantenimiento de secreto web cada seis meses según guía Supabase. Apple puede ocultar el correo, y para enviar emails al relay requiere configuración específica.
- SMS/OTP telefónico: https://supabase.com/docs/guides/auth/phone-login — requiere proveedor de SMS y genera costos variables.
- AAIP: https://www.argentina.gob.ar/aaip/datospersonales/derechos — consentimiento informado; la interpretación jurídica definitiva requiere validación competente.


---

## Resultado de la auditoría (Central, 17/10/2026)

### Dictamen ejecutivo y alcance recomendado

**AGREGAR (propuesta para una etapa posterior a aprobación humana):** «Continuar con Google» como acceso/alta simplificados; usar la integración social OAuth del Supabase Auth existente. **NO TOCAR:** acceso con email+contraseña, recuperación, identidad deportiva, Nivel, partidos, invitaciones y entornos Productivos. **NO AGREGAR por ahora:** Apple, Facebook, Microsoft, teléfono/SMS o SSO empresarial. **NO REEMPLAZAR** sistema Auth ni crear un segundo backend de usuarios. El objetivo es reducir pasos reales, no acumular botones. El registro con Google normalmente no necesita el OTP de seis dígitos propio de BRAMUlab; la autenticación/confianza del email debe confirmarse mediante datos verificados del proveedor y Supabase, no simplemente por texto recibido.

**Costo:** Social OAuth está incluido en el plan Free de Supabase (50.000 MAU en el cupo gratuito; cargos/limitaciones según plan y uso por encima del cupo). No hay tarifa por cada clic de login de Google. El alta de credenciales OAuth básica en Google Cloud no requiere un servicio de pago para autenticación estándar, aunque puede requerir configuración y revisión de pantalla de consentimiento. No se ha inspeccionado el presupuesto exacto de Google Cloud conectado porque no es necesario para el diagnóstico. Apple Developer Program cuesta normalmente USD 99/año y Sign in with Apple web requiere cuenta de desarrollador, App ID + Services ID y clave; según guía de Supabase, su secreto OAuth requiere rotación semestral. Decisión expresa del responsable: **si Apple implica un costo nuevo, no incluirlo**. Apple queda fuera del alcance V1 sin necesidad de reabrirlo.

**Conclusión técnica:** factible sobre la infraestructura existente, pero NO basta con activar un proveedor o mostrar un botón. La adaptación es de complejidad **media**, principalmente por el retorno OAuth en una PWA, la aceptación legal y la convergencia correcta entre cuentas existentes, onboarding e invitaciones; no por las APIs de Google. Aún no se ha estimado esfuerzo en horas/commits de implementación ni hecho una prueba end-to-end; cualquier plazo sería especulativo.

### Evidencia de código (rama `staging`, solo lectura)

1. `bramulab/auth.js`, `getClient()`: `persistSession:true`, `autoRefreshToken:true`, `detectSessionInUrl:false` y cliente Supabase persistente; `signUp(email,password,legalVersion,activityConsent)`, `signInWithPassword` y `verifySignupOtp(type:'signup')` implementados. **No existe `signInWithOAuth` ni `linkIdentity` en este módulo.** Cambiar callback/sesión de modo explícito antes de cualquier prueba OAuth. Elegir entre callback del cliente (flujo implícito) o PKCE con intercambio de código y proteger estado de inicio, destino y tokens.
2. `bramulab/index.html` §acceso/signup: bienvenida pública con «INICIAR SESIÓN»/«CREAR CUENTA»; flujo de alta paso 1 email + contraseña + repetición + checkbox legal; paso 2 identidad mínima; paso final confirmación por OTP. La UX de Google debe convivir con estos caminos existentes sin degradarlos.
3. `bramulab/app.js` (blob SHA `d6d32d41f61277d5cf202a90d71574c21dee6ee5`, **inspeccionado por `fetch_blob`**): `initLoginScreen` llama `Auth.signInWithPassword` y luego `resumeServerSession({afterLogin:true})`; `initSignupWizard` comprueba checkbox/legal actual y llama `Auth.signUp`; `bootWithServerSession` llama `captureClaimTokenFromUrl()` ANTES de leer sesión; `resumeServerSession` decide onboarding según perfil+Nivel y abre `resumeSignupProfileStep` para cuenta incompleta; `runOfficializeAndEnter` puede abrir `enforceLegalGate` al recibir `legal_acceptance_required`. No hay aún orquestación para retorno OAuth y el estado/identidad del flujo social; adaptar esos puntos de forma acotada.
4. `Store.loadSignupDraft` y `Store.saveClaimToken` guardan borradores/contexto localmente por dispositivo. Un `claim` de invitación se retira de la URL después de persistirlo. Si el OAuth vuelve a Safari desde una PWA instalada, el estado local y los tokens podrían quedar en contenedores de navegador distintos: requiere prueba real; **no asumir que funciona automáticamente**.
5. `Producto/Experiencia_Inicial.md` §2, §15: perfil+Nivel siguen obligatorios; la identidad provisional se vincula por confirmación explícita («SOY YO»), no por nombre/email ni solo por abrir el link.
6. `Operacion/Backend_Infraestructura.md` §6.1: `players.auth_user_id` enlaza el Auth UID con `player_id`, que es la clave deportiva estable. El login social **NO debe crear ni reasignar otro `player_id`** para una cuenta que ya existe.

### Estructura real de Staging Supabase (consulta SQL de SOLO LECTURA, 17/10/2026)

Proyecto revisado: **`bramulab-staging`** (sin acceder a datos personales ni configurar proveedores). Consultas de metadatos `pg_proc/pg_get_functiondef` confirman:

- `public.handle_email_confirmed()` (trigger) se activa cuando `email_confirmed_at` deja de ser nulo: crea `players`, `profiles` y `level_states` iniciales asociados a `auth_user_id`. **Si no hay `raw_user_meta_data.legal_version`, crea la identidad, pero no una aceptación legal.** También registra el evento `signup_completed`. En OAuth la condición precisa del disparo debe validarse experimentalmente en Staging (Supabase suele entregar email ya verificado al volver del proveedor).
- `public.complete_profile(...)` busca la aceptación en `legal_acceptances` y falla con `legal_acceptance_required` cuando no existe. **Protección vigente que se conserva.**
- `public.accept_legal_version(p_version)` permite aceptar la versión vigente con sesión válida y `player_id`; guarda aceptación append-only y actualiza el snapshot en `profiles`. Es una **base real reutilizable** para presentar los términos al volver de Google, incluso si el usuario Auth ya existe, pero su integración/semántica de alta se deben validar.
- `public.get_my_legal_status()` requiere `player_id` y permite detectar falta de aceptación, por lo que debe haber jugador placeholder creado antes de abrir el gate.
- Para `legal_v2`, la aceptación está integrada con la autorización de medición de uso. El código del trigger y de `accept_legal_version` registra la decisión según esta versión; **no aceptar automáticamente, no fabricar timestamps y no iniciar métricas/presencia antes de cumplir la condición vigente**.
- La verificación de estos objetos NO equivale a verificar la configuración OAuth de Google del dashboard (no disponible en las herramientas de consulta aquí). Ningún proveedor fue habilitado ni se generaron credenciales.

### Diseño de experiencia recomendado (propuesta, sin aprobación todavía)

**Un solo acceso reconocido:** desde la bienvenida mantener «INICIAR SESIÓN» y «CREAR CUENTA»; en ambas rutas ofrecer «Continuar con Google» primero y «Continuar con email» como alternativa. La selección de Google envía a la pantalla oficial del proveedor y regresa a BRAMUlab. La misma entrada identifica a una cuenta existente o inicia el alta deportiva de una nueva, sin que el usuario tenga que elegir de antemano qué era.

- **Nuevo con Google:** Google/Supabase establece sesión con identidad verificada → resolver consentimiento informado en un paso breve y explícito (con lectura de términos/política, evidencia servidor y permiso de no continuar/cerrar sesión) → nombre, apellido y @usuario solo donde falten → estimación inicial de Nivel → Home. **Sin OTP de seis dígitos de BRAMUlab** adicional por defecto, si el proveedor entrega email verificado.
- **Existente con Google (mismo email confirmado):** Supabase puede vincular automáticamente identidades con correo coincidente y verificado. Verificar que se mantiene el Auth UID original, `player_id`, Nivel, partidos y grupos. Si hay desacuerdo/identidad no verificada, nunca decidir por una coincidencia suelta ni fusionar silenciosamente. Si Google usa **otro email**, ofrecer primero acceso existente por email+contraseña y luego vinculación explícita (posible fase posterior si aparece demanda); **no ofrecer fusión genérica de jugadores**.
- **Invitado:** preservar la intención `?claim=...` de manera segura en ida y retorno OAuth sin poner tokens en log ni redirecciones abiertas; tras entrar, mostrar el mismo «¿SOS ...?» y comprobación de participación, luego perfil/Nivel cuando corresponda. Probar especialmente PWA iOS/Android.
- **Email:** conservar el circuito vigente, incluida verificación por OTP. Eliminar la verificación extra solo para social OAuth exitoso; no degradar la verificación de cuentas tradicionales.

**Términos y privacidad:** la posición actual del checkbox es una **implementación vigente, no una restricción arquitectónica que no se pueda cambiar**. No confundir el momento de crear una identidad de autenticación técnica con habilitar un jugador deportivo y tratar sus datos. Se puede usar un gate post-Google, antes de oficializar perfil, Nivel y actividad; podría evaluarse ubicarlo justo antes de entrar a Home, pero no persistir antecedentes sensibles u otorgar operaciones de juego antes de aceptación y revisión legal. La alternativa de «Al continuar aceptás...» debe ser verificada por asesoramiento legal frente a las obligaciones de consentimiento explícito/evidencia y, muy especialmente, la medición de uso de `legal_v2`; **no asumir que una leyenda sin acción afirmativa específica es equivalente a un consentimiento registrado**. No insistir en una pantalla concreta antes de validar UX/privacidad. Diseñar la solución que menos fricción dé **sin debilitar prueba del consentimiento**.

### Riesgos priorizados y pruebas necesarias SOLO durante futura implementación en Staging

**P0 — bloquear release si falla:**
1. Cuentas existentes: email verificado coincidente, diferente, no verificado y proveedor previamente vinculado; jamás duplicar jugador ni desprender `auth_user_id`/historial/partidos. Cambio de cuenta en el mismo dispositivo.
2. Provisión legal: OAuth sin `legal_version` debe registrar aceptación explícita antes de `complete_profile`; el rechazo permite salir sin acceso a Home ni operaciones; timestamps y métricas no se fabrican. Revisar semántica de `signup_completed` en el trigger por si la cuenta técnica se crea antes de completar el alta.
3. Invitaciones: `claim` no se pierde, no se adjudica por email/nombre y no se duplica tras reintentos/retorno desde proveedor.
4. OAuth callback y sesión: credenciales de Staging únicamente, redirect allowlist exacta, sin open redirect, sin tokens/claims en logs, host esperado, recuperación de flujo cancelado/expirado/error, sin mostrar Home con una sesión ajena.
5. PWA instalada iOS/Safari y Android/Chrome: comprobar flujo real de ida/vuelta y que no se cambie a un contenedor sin estado de invitación/borrador. Dar fallback claro para abrir en navegador si se requiere, no afirmar compatibilidad antes del ensayo.

**P1 — acotadas:** regreso desde offline o refresh en mitad de alta, sesión tras logout, login email+contraseña/regresión, sesión de usuario existente/actividades oficiales sin cambio, borrador local seguro, navegador privado/cookies restringidas.

### Alcance recomendado para implementación futura

**AGREGAR:** botón Google y selector email; configuración de credenciales Google OAuth **solo en Supabase Staging** y Google Cloud con redirects exactos; callback seguro y captura de sesión; indicador de método de acceso; tracking mínimo agregado para medir si reduce fricción usando métricas **permitidas por consentimiento**.

**FUSIONAR:** retorno social con `bootWithServerSession/resumeServerSession`; reutilizar `enforceLegalGate`, `accept_legal_version`, `resumeSignupProfileStep`, `runOfficializeAndEnter`, flujo de invitación actual y `player_id` vigente, con estados explícitos que distingan email y Google.

**REEMPLAZAR solo donde corresponda:** supuesto de que todas las altas requieren contraseña y OTP; no cambiar el recorrido email de los usuarios actuales.

**NO TOCAR:** motor de Nivel, Ranking, Grupos, historial y validación, contrato de identidad provisional, Production, `main`, BRAMUlive, migraciones de datos salvo una necesidad justificada en Staging luego de aprobación. Mantener método de recuperación para contraseñas tradicionales; para Google se recupera acceso con Google, no reseteando una contraseña que nunca fue creada.

**Orden:** 1. aprobar alcance Google+email y la ubicación/semántica del gate legal; 2. preparar Staging con configuración OAuth y un único camino integrado, 3. pruebas P0 reales sobre identidades/cuenta invitada/dispositivos, 4. revisión visual del responsable, 5. nueva autorización expresa para cualquier publicación en Production. Sin un plazo estimado fiable previo a pruebas de callbacks/PWA.

### Decisiones y límites

- **CONFIRMADO POR EL RESPONSABLE:** objetivo reducir fricción y no quedar atado al diseño actual; Apple únicamente si no genera costo nuevo. Como el acceso web requiere membresía de pago, **Apple EXCLUIDO por ahora**. Prioridad Google y email.
- **PROPUESTA PENDIENTE DE APROBACIÓN:** agregar Google + email y presentar consentimiento mediante gate explícito al volver del proveedor, antes de oficializar la cuenta deportiva. La ubicación final exacta se decide con revisión de UX y respaldo legal; no es una razón para desistir de Google.
- **NO VERIFICADO:** credenciales y proveedor Google habilitado/no habilitado en dashboard Supabase; continuidad efectiva del estado de una PWA instalada; efectos exactos del callback en el trigger de Staging; comportamiento ante cuentas de correo duplicadas reales. No se consultaron datos personales ni se hicieron altas de prueba.
- **NO SE REALIZÓ:** implementación, configuración, cambios de SQL, migraciones, deployments, lectura de secretos, uso de cuentas reales.

### Fuentes públicas (consultadas 17/10/2026)

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/reference/javascript/auth-signinwithoauth
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/auth-identity-linking
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/pricing
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
- https://developer.apple.com/programs/enroll/

*El cumplimiento jurídico concreto de la secuencia y de la autorización de analítica requiere cotejo humano especializado; la auditoría identifica el contrato técnico pero no emite dictamen legal.*


---

## Actualización UX — referencia HubSpot (17/10/2026)

**Origen:** el responsable aportó capturas del alta de HubSpot: pantalla de métodos de acceso (Google, Microsoft, Apple, ChatGPT, correo), pantalla de OTP de 6 dígitos inmediatamente después de introducir el email, y pantalla posterior para crear contraseña con requisitos visibles. Desea evaluar un flujo **similar en claridad y orden**, no copiar los proveedores ni la marca. **Propuesta de UX, aún no autorizada para implementar.**

### Recorrido preferido a diseñar

1. Un único acceso claro para cuentas nuevas y existentes: **«Continuar con Google»** y **«Continuar con correo»**, más enlace contextual para quien ya tiene cuenta si aporta claridad. Apple excluido mientras requiera costo anual; Microsoft/ChatGPT descartados por ahora al no aportar prioridad para pádel amateur.
2. **Google**: autenticación verificada por proveedor; no pedir contraseña ni un código de seis dígitos adicional de BRAMUlab; si la cuenta existe, entrar al mismo `player_id`; si es nueva, resolver aceptación legal y luego completar perfil + Nivel.
3. **Correo para cuenta nueva**: ingresar email → recibir código de 6 dígitos inmediatamente → verificar email → **crear contraseña después** (con requisitos y validación visual que ya existen en BRAMUlab) → completar perfil mínimo/@usuario y Nivel → Home. Se evita que la validación del correo sorprenda al usuario después de completar todo su Nivel.
4. **Correo para cuenta existente**: conservar acceso por contraseña; estudiar opción de código OTP como alternativa sin duplicar cuentas ni revelar si un correo existe. Nunca enviar a «crear contraseña» a quien ya tiene una válida ni pisar credenciales existentes.
5. Registrar y conservar contexto de invitación entre etapas y redirecciones, y reanudar onboarding tras refresh/error.

### Factibilidad corroborada en la documentación oficial de Supabase

- `auth.signInWithOtp({email})` envía un correo **OTP** de seis dígitos si está configurada su plantilla con `{{ .Token }}`; por defecto el método puede enviar magic link si no se configura la plantilla. **Importante:** por defecto `signInWithOtp` puede CREAR usuario Auth si no existe (`shouldCreateUser:true`). Por ello la aceptación legal y el trigger de creación necesitan coordinación antes de encenderlo. https://supabase.com/docs/guides/auth/auth-email-passwordless
- `auth.verifyOtp({email,token,type:'email'})` autentica y devuelve sesión tras validación. https://supabase.com/docs/guides/auth/auth-email-passwordless
- Después de validar email y obtener sesión, `auth.updateUser({password: ...})` permite crear/actualizar contraseña; **aplicarlo solo a la nueva cuenta y nunca a una existente sin el flujo correcto**. Verificar configuración de reautenticación y política de contraseñas en Staging. https://supabase.com/docs/reference/javascript/auth-updateuser
- La app actual `auth.js` usa `auth.signUp(email,password,...)` y OTP `type:'signup'` al FINAL del onboarding. El camino nuevo `signInWithOtp`/`verifyOtp(type:'email')` es diferente; se necesitan adaptación de cliente, estados, emails y revisión de contratos backend.

### Particularidad de BRAMUlab que obliga a modificar backend con criterio

En el Staging real, `handle_email_confirmed()` se dispara cuando se confirma email y **crea `players`, `profiles`, `level_states` y un evento `signup_completed`**. Hoy registra aceptación por `raw_user_meta_data.legal_version` si esa versión se declaró en el paso 1. Mover el código al principio **sin resolver esta dependencia** generaría una cuenta/identidad deportiva parcial y un evento potencialmente prematuro antes de aceptación y onboarding. Hay que decidir si:

- se captura aceptación informada ANTES de iniciar el OTP y se pasa/evidencia correctamente, o
- la aceptación se pide DESPUÉS de autenticar por OTP, cambiando el disparador y/o semántica de «cuenta deportiva creada», bloqueando perfil/Nivel/operaciones oficiales hasta evidencia real de consentimiento.

En ambos casos, **es válida la intención de mover la pantalla**: no conservar una traba solo porque existe código heredado; adaptar código y backend primero en Staging. A nivel UX, evaluar una aceptación muy breve, visible y trazable. **NO dar por legalmente suficiente el texto «Al continuar aceptás…» por analogía con HubSpot**: en Argentina la AAIP exige consentimiento informado, por escrito u otro medio similar cuando aplica; la forma exacta requiere revisión de finalidad, documentación, mecanismos probatorios y especialmente analítica/marketing. No copiar la frase de HubSpot que acopla avisos promocionales: BRAMUlab no tiene ese objetivo. Referencia AAIP: https://www.argentina.gob.ar/aaip/datospersonales/derechos.

### Evaluación frente al flujo anterior

Este cambio no reduce necesariamente el número de pasos de la ruta de email tradicional (código+contraseña permanecen), **pero los ordena mejor**: email verificado antes de que el usuario invierta tiempo en Nivel. La ruta Google sí puede eliminar creación de contraseña y OTP propio por completo. Alternativa futura de simplificación: correo + código sin contraseña (passwordless) implica volver a usar OTP en cada nueva sesión; no implementarla sin decisión de producto ni evaluar efectos en reingreso frecuente, recuperación y correo transaccional.

**Riesgos críticos de esta variante:** cuenta existente y OTP, `shouldCreateUser`, trigger `handle_email_confirmed`, aceptación legal y métricas, contraseña creada solo por nuevos jugadores, email no verificado, duplicados/alias proveedor, invitación, PWA, rate limits y spam/abuso de envío. Ver matriz P0 anterior.

**Decisión de producto informada:** preferencia por pantalla estilo HubSpot y por OTP inmediato antes de contraseña/perfil en alta por email. Pendiente elegir forma concreta de evidencia legal (diseño sin bloqueo innecesario, pero válido) y autorizar implementación específica. No hacer deploy ni cambios de Supabase/Production ahora.


---

## Dirección de producto confirmada por el responsable (17/10/2026, segunda revisión)

**Se confirma revisar de punta a punta la experiencia de registro/inicio de sesión, y NO limitar la iniciativa al botón de Google.** La auditoría anterior describe factibilidad; esta sección consolida el encargo UX para la etapa de diseño y validación humana.

### Motivos y criterios de éxito

- **Email primero y verificación inmediata:** si el jugador escribió mal su dirección, descubrirlo antes de completar perfil y cuestionario de Nivel evita una mala experiencia. Prioridad de producto confirmada. El OTP de seis dígitos debe pedirse al principio en el camino por email para una cuenta nueva; después, recién crear contraseña, completar perfil y Nivel. El acceso con Google evita contraseña propia y OTP de BRAMUlab cuando hay identidad verificada.
- **Rediseño completo, no parche:** revisar bienvenida, elección de método, crear cuenta, ingresar, email/OTP, contraseña, errores, reintentos, confirmaciones, recuperación, invitaciones, sesión existente, perfil mínimo y Nivel. El objetivo es simple, claro, visualmente atractivo y coherente con la estética actual de BRAMUlab. El responsable percibe el acceso existente como demasiado plano.
- **Libertad creativa controlada para Claude Code:** diagnosticar si la interfaz actual necesita retoques moderados o una revisión significativa, elaborar la propuesta de recorrido/UI justificada con criterios de UX y componentes del sistema existente, sin recargar la app ni rehacer el resto. El responsable decide y aprueba UX/UI; agentes absorben ejecución. No añadir funcionalidades extras.
- **No perpetuar decisiones tempranas:** las exigencias técnicas actuales de contraseña antes de verificación y checkbox legal previo al Auth pueden rediseñarse. El producto no debe quedar condicionado por implementación previa solo por costumbre.
- **Conservar garantías materiales:** identidad deportiva, cuentas existentes, historial, invitaciones/claim, aislamiento entre Staging/Production, aceptación informada y registro server-side real. No confundir una mejora de UX con autorización para alterar consentimientos reales o modificar Production.

### Términos y privacidad: cambio de perspectiva

El responsable pide **evaluar expresamente un texto de aceptación contextual tipo «Al continuar, aceptás los Términos y Condiciones y la Política de Privacidad»**, con enlaces accesibles, en reemplazo de la casilla obligatoria actual, si puede darse validez a la acción de continuar y conservar evidencia verificable. No asumir que una casilla HTML es condición de la ley ni que una leyenda discreta por sí sola cumple todo.

**Fuentes oficiales:** Ley 25.326, art. 5(1): consentimiento libre, expreso e informado documentado por escrito o medio equiparable, destacado si se combina con otras declaraciones; art. 5(2)(d): excepción cuando los datos derivan de relación contractual y son necesarios para su ejecución; art. 6: información previa, finalidad, destinatarios, responsable, derechos. Texto: https://www.argentina.gob.ar/normativa/nacional/64790/texto . La AAIP reconoce que consentimiento puede obtenerse a través de la aceptación de términos y condiciones en una aplicación o plataforma: https://www.argentina.gob.ar/node/195420 .

**Problema a resolver por diseño y revisión jurídica acotada:** distinguir T&C/uso estrictamente necesario de la política informativa y de las finalidades adicionales (medición de actividad de \`legal_v2\` y transferencia internacional según política vigente). Registrar versión, acción inequívoca, usuario, fecha y evidencia server-side; permitir no aceptar/cancelar. No preautorizar marketing ni analítica adicional solo por mostrar enlaces. No prometer que la práctica de HubSpot o Freepik equivale a cumplimiento de ley argentina. La demora de respuesta del trámite AAIP no impide **diseñar** el recorrido ni valida automáticamente un mecanismo específico; seguimiento registral y cumplimiento del producto son frentes distintos.

### Propuesta para exploración UX (no pantalla final aprobada)

**Bienvenida reconocible → elegir Google o correo → verificar identidad en ese canal → términos/aviso bien resueltos → contraseña solo si se usa correo nuevo → perfil mínimo → estimador Nivel → Home.** El orden exacto del aviso/aceptación frente a la creación del Auth UID debe ser resuelto de manera verificable y puede variar por canal; no crear dos perfiles deportivos, no entrar a Home sin aceptación cuando sea requerida. Las cuentas existentes no deben pasar por alta nueva ni cuestionario repetido.

**Decisiones confirmadas:** revisión integral de UX/estética, verificación email temprana en nuevos registros, evaluar eliminar checkbox en favor de «Al continuar…» con evidencia real, Google y email prioritarios; Apple excluido mientras agregue costo. **Decisiones abiertas:** mecanismo legal concreto adecuado a \`legal_v2\` y analítica; detalles visuales/orden final de pantallas; arquitectura y pruebas de compatibilidad PWA, migraciones mínimas que sean necesarias. **Siguiente etapa:** propuesta UX y plan técnico en Staging, revisión del responsable, autorización separada para implementación y posterior Production. No hacer cambios de código ni Supabase a partir de este documento.
