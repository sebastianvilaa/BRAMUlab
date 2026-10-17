# Auditoría propuesta — acceso simplificado a BRAMUlab (17/10/2026)

**Estado:** pedido de auditoría de solo lectura; **NO es una decisión de implementación ni autorización para habilitar proveedores o modificar bases**. Central consolida aquí la intención de producto, la revisión preliminar de documentación y los riesgos a investigar. Claude Code debe completar el diagnóstico con evidencia del repositorio y, si tiene acceso seguro, configuración de Staging de solo lectura. Trabajar exclusivamente en `staging`. No modificar Production, `main`, BRAMUlive, Supabase ni app/web durante esta auditoría.

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

## Preguntas que debe resolver la auditoría
1. Inventario exacto de Auth/UX: login, signup, recuperación, OTP, legal, sesiones, arranque, email change y permisos; identificar archivos, funciones y contratos.
2. Elegir arquitectura mínima para Google primero y evaluar Apple en segunda fase; presupuesto real/configuración de ambos y otros proveedores opcionales. Evitar confundir social OAuth con SSO empresarial.
3. Diseñar recorridos nuevos/existentes/invitados: al volver de proveedor, cuándo mostrar aceptación legal y cómo grabar evidencia, nombre/@usuario/estimador, evitar OTP propio solo si la identidad del proveedor es confiable, fallback email intacto.
4. Integridad de cuentas existentes y de `player_id`: email igual/diferente, email sin verificar, Apple relay, usuario cancelando OAuth, proveedor desconectado, sesiones revocadas, borrado de cuenta/reautenticación. Sin migraciones no justificadas.
5. Redirect + callback técnico de Supabase, manejo de tokens y estado de invitaciones sin filtrarlos a logs ni redirigir a URLs no confiables, PWA instalada iOS y Android, separación Staging/Production y secretos.
6. Efecto del consentimiento vigente de métricas en onboarding OAuth; no registrar consentimiento implícito ni inventar aceptaciones.
7. UX sugerida sin duplicar pantallas; qué campos deja de pedir Google/Apple y qué pasos siguen siendo obligatorios.
8. Riesgos priorizados, esfuerzo aproximado, componentes AGREGAR/FUSIONAR/REEMPLAZAR/NO TOCAR, dependencias externas, costos únicos y recurrentes.
9. Plan de implementación por etapas SOLO si Central lo aprueba después: Staging primero, pruebas de riesgo focalizadas (identidad, cuenta doble, invitación, legal, sesión PWA) y criterio de reversión sin daño a cuentas existentes.
10. Diferenciar hechos comprobados, hipótesis, límites por accesos y DECISIONES ABIERTAS. **No implementar, no configurar OAuth, no desplegar ni hacer migraciones en esta auditoría**.

## Entrega esperada de Claude Code
Actualizar esta ficha con auditoría sustentada, recomendación de alcance V1 y siguiente paso técnicamente ejecutable; resumen final de una página en castellano para Central. No subir código ni activar OAuth. Si hay credenciales/OTP/secretos, nunca exponerlos ni copiarlos al chat o al documento. No modificar otras fuentes maestras por este diagnóstico.
