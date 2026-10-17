# Auditoría técnica — acceso simplificado a BRAMUlab (17/10/2026)

**Estado:** diagnóstico de solo lectura completado por Central el 17/10/2026. **NO es autorización para implementar, habilitar proveedores ni modificar bases**. Central consolida aquí la intención de producto, la revisión preliminar de documentación y los riesgos a investigar. Claude Code debe completar el diagnóstico con evidencia del repositorio y, si tiene acceso seguro, configuración de Staging de solo lectura. Trabajar exclusivamente en `staging`. No modificar Production, `main`, BRAMUlive, Supabase ni app/web durante esta auditoría.

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
