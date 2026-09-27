# BRAMUlab — Resultado: P0.2 Fase A — preparación legal/técnica para revisión profesional

**Rama:** `staging`
**Fecha:** 27/09/2026
**HEAD base:** `4434eac` (`docs(preprod): preparar P0.2 Fase A legal tecnica`)
**Origen:** handoff [`33_Handoff_P0_2_Fase_A_Preparacion_Legal_27SEP.md`](33_Handoff_P0_2_Fase_A_Preparacion_Legal_27SEP.md), tarea independiente ejecutada mientras el resto de P0.3 sigue con su validación end-to-end pendiente.

**Cero cambios en `bramulab/` (frontend), bundle `04.11-h10`, `TERMS_VERSION`, `version.json`, migraciones ni deploy.** Esta fase es exclusivamente de preparación documental: 2 borradores legales completos + un mapa técnico de lo que haría falta integrar cuando el texto quede aprobado — nada de eso se implementó todavía, tal como pedía el handoff.

**Este documento, ni los 2 borradores, constituyen asesoramiento legal ni cierran P0.2.** Ambos borradores están marcados explícitamente como `BORRADOR DE PRODUCTO — REQUIERE REVISIÓN LEGAL ANTES DE PUBLICARSE`, con `[REVISIÓN LEGAL NECESARIA]` y `[DECISIÓN ABIERTA]` en cada punto que lo exige.

> **Corrección 27/09/2026 (misma fecha, ronda posterior):** Central encontró 4 contradicciones concretas entre este documento/los borradores y las fuentes maestras vigentes (Ranking descrito como opt-in, "Categoría actual" descrita como pública, separación técnica/legal de BRAMUlive no confirmada, envío de email atribuido directamente a Supabase). Las 4 quedaron corregidas en este mismo documento y en ambos borradores — ver [`36_Resultado_Correccion_P0_2_Fase_A_27SEP.md`](36_Resultado_Correccion_P0_2_Fase_A_27SEP.md) para el detalle completo de cada corrección y su fuente.

---

## 1. Qué se creó

- [`docs/BRAMUlab/Legal/Privacidad_Borrador_V1.md`](../../Legal/Privacidad_Borrador_V1.md) — borrador completo de Política de Privacidad.
- [`docs/BRAMUlab/Legal/Terminos_Borrador_V1.md`](../../Legal/Terminos_Borrador_V1.md) — borrador completo de Términos y Condiciones.
- Este documento de resultado.

Ambos borradores se redactaron **después** de una auditoría exhaustiva del código y esquema real (no de intenciones de producto) — ver §2. Cada afirmación sobre qué datos se tratan, quién los ve y qué se hace al eliminar una cuenta está respaldada por una función/tabla/RLS real, nunca inventada.

---

## 2. Auditoría real de datos y finalidades (handoff §4.A)

Resumen de los hallazgos más relevantes para el contenido legal (detalle completo — archivo:línea de cada función/tabla citada — disponible en la transcripción de esta sesión; los borradores mismos ya incorporan el contenido verificado):

### Alta / autenticación
Solo email + contraseña, gestionados por Supabase Auth. Confirmación y recuperación por **código de 6 dígitos enviado por email**, nunca un enlace mágico. Sin login social/OAuth, sin teléfono/SMS en el alta.

### Aceptación de Términos
`TERMS_VERSION = 'piloto_v1'` vive en `bramulab/app.js` (constante), se copia a `signupDraft.termsVersion` en el paso 2 del wizard de alta y se persiste vía la RPC `complete_profile` en `profiles.terms_version`/`profiles.terms_accepted_at` (timestamp de **servidor**, nunca del cliente). El checkbox de aceptación en `bramulab/index.html` **no tiene ningún link** a un texto de Términos ni de Privacidad — es texto plano ("Acepto los Términos y Condiciones de BRAMU (versión piloto)") sin `href`. Confirmado explícitamente: no existe hoy ninguna página dentro de la app que muestre el texto completo de Términos o Privacidad.

### Perfil (`profiles`, 24 columnas confirmadas)
`@usuario`, nombre y nombre para mostrar son obligatorios; el resto (apellido, avatar, fecha de nacimiento, género, mano/lado, rama competitiva, localidad, teléfono, categoría actual) es opcional. Confirmado columna por columna contra las 3 funciones de lectura pública (`get_public_profile`/`search_players`/`get_players_compact`): **`gender`, `birth_date`, `phone` crudo y `current_category` nunca se exponen a otro jugador bajo ninguna circunstancia** — el teléfono solo se muestra (como botón de WhatsApp, nunca como texto) si hay consentimiento explícito activo (`allow_whatsapp_contact=true`). "Categoría actual" (`profiles.current_category`) es un dato declarativo del propio jugador, confirmado que vive únicamente en la sección "Mis datos" del código (`bramulab/app.js`) — nunca en Mi Perfil/Perfil público, y distinto de `level_states.declared_category` (contexto histórico e inmutable del onboarding de Nivel, tampoco público).

### Ubicación
Localidad elegida por nombre contra la API pública GeoRef de Argentina — nunca geolocalización del dispositivo para el perfil. No es necesaria para el resto de la app; se pide cuando empieza a hacer falta para ubicar al jugador en el Ranking territorial (que es automático, ver más abajo — nunca "si elige participar").

**Matiz real encontrado y reflejado en el borrador de Privacidad:** existe un botón opcional "Usar mi ubicación" en la pantalla de carga de un partido, que sí usa `navigator.geolocation` del dispositivo — pero adjunta coordenadas al **partido puntual**, nunca al perfil, y esas coordenadas son visibles solo a los 4 participantes de ese partido. Se declaró explícitamente en el borrador para no dejar un hueco de exactitud.

### Avatar
Bucket de Storage privado, resuelto por URL firmada de 24h — nunca una URL pública ni indexable.

### Partidos
Visibles **únicamente** para los 4 participantes de cada partido (RLS deny-by-default total en las 7 tablas de partidos; toda lectura pasa por RPCs `SECURITY DEFINER` que filtran por el caller real). Nunca visibles a un jugador ajeno.

### Nivel BRAMU / Ranking BRAMU / Intelligence
Nivel: valor interno privado, versión pública redondeada visible a otros. Ranking: **corrección tras revisión central** — la auditoría original de esta ronda describió la participación como opt-in explícito (`ranking_opt_in`); eso era incorrecto. La fuente maestra vigente (`docs/BRAMUlab/Ranking_BRAMU.md`, actualización del 24/09/2026) define la participación como **automática**: todo jugador activo entra al universo de Ranking al cumplir elegibilidad (localidad, rama, Nivel/actividad/integridad), sin opt-in/opt-out ordinario; `ranking_opt_in` queda como campo legacy de compatibilidad que ya no decide elegibilidad. Cuando el jugador es elegible, su posición semanal es visible entre jugadores autenticados del mismo ámbito — es una clasificación pública dentro de BRAMU, no restringida a "amigos". Un jugador `CALIBRANDO` puede explorar el Ranking sin ocupar posición propia todavía. Intelligence: estrictamente privado por jugador, **ni siquiera los compañeros/rivales del mismo partido ven las observaciones ajenas** (confirmado en la Edge Function `get-match-intelligence`, filtra por el `player_id` del JWT verificado).

### Eliminación de cuenta (P0.3, ya implementado y aplicado en Staging)
Lista exacta confirmada contra `admin_delete_player_account`/`admin_finalize_player_account_deletion` — coincide con lo ya descrito en `Pre_Production.md §P0.3`, incorporada al borrador de Privacidad §5 sin inventar nada adicional.

### Integraciones externas reales
- **Supabase**: base de datos, gestión de autenticación (alta, confirmación, recuperación), Storage. **Corrección tras revisión central**: la redacción original de esta ronda atribuía directamente a Supabase el "envío" de los correos de confirmación/recuperación — eso afirma más de lo que el código confirma. Lo que sí puede afirmarse con certeza: BRAMUlab usa Supabase Auth para gestionar el flujo de autenticación/confirmación/recuperación; la entrega efectiva de esos correos depende de la configuración de email (SMTP) del entorno, que no está fijada de forma estable en el código (puede variar entre Staging y Production) — no se nombra ningún proveedor SMTP específico en este documento ni en los borradores.
- **Vercel**: hosting/build del frontend.
- **Sin analítica de terceros** (sin Google Analytics/Sentry/similares en `index.html`), **sin pagos/monetización real** (la única mención de "Mercado Pago" en el código es un comentario de referencia de diseño UX, no una integración), **sin chat entre usuarios**, **sin compartir en redes sociales**.
- BRAMUlive es un producto/repositorio separado — confirmado explícitamente en comentarios del propio código ("se retira el registro/marcador en vivo, separado a BRAMUlive como producto propio").

---

## 3. Mapa de integración técnica futura (handoff §4.E)

Sin implementar todavía — mapa para cuando el texto legal quede aprobado.

### AGREGAR

- 2 páginas/vistas dentro de la app que muestren el texto completo de Privacidad y de Términos (hoy no existe ninguna) — accesibles tanto desde el alta como desde la app ya logueada (ej. Perfil/Configuración).
- Links reales (`<a href>`) desde el checkbox de alta hacia esas 2 páginas — hoy el texto es plano, sin ningún enlace.
- Un mecanismo de re-aceptación cuando la versión de Términos que el usuario aceptó (`profiles.terms_version`) sea distinta de la vigente — hoy `complete_profile` solo escribe la aceptación una vez en el alta; no existe ningún chequeo de versión en logins posteriores. Necesario para cumplir "si cambia materialmente una versión, definir cómo se solicita nueva aceptación" (ya señalado como pendiente en `02_Borrador_Legal_Privacidad_V1.md §8`).
- Un canal de contacto/soporte visible desde la app (email o formulario) para los derechos de acceso/rectificación/supresión — hoy no existe ninguno.

### FUSIONAR

- El copy del checkbox de alta (`bramulab/index.html`, línea del `signup-terms-checkbox`): reemplazar "(versión piloto)" por el texto real y agregar los 2 links — cambio acotado de markup + copy, sin tocar la lógica de validación del wizard (`recomputeSignupStepValidity` ya exige el checkbox marcado, eso no cambia).

### REEMPLAZAR

- `TERMS_VERSION = 'piloto_v1'` en `bramulab/app.js` por la versión real acordada — **solo** en el momento en que el texto legal quede aprobado y listo para publicarse. Explícitamente NO en esta fase (handoff §5: "NO modificar `TERMS_VERSION` todavía").

### NO TOCAR

- El contrato server-side ya existente: columnas `profiles.terms_version`/`profiles.terms_accepted_at` y la RPC `complete_profile` que las escribe con timestamp de servidor — ya soportan correctamente el flujo de versionado, no necesitan ningún cambio de esquema.
- Toda la lógica de Nivel/Ranking/Intelligence/P0.3 — sin relación con esta fase.
- El resto del flujo de alta (pasos del wizard) más allá del checkbox puntual de Términos.

---

## 4. Matriz de decisiones abiertas para Sebastián / abogado (handoff §4.D)

Solo las que realmente bloquean publicación — no se abrió ninguna decisión técnica ya cerrada:

| # | Decisión | Bloquea |
|---|---|---|
| 1 | Titular/responsable legal del servicio (razón social, domicilio, CUIT, representante) | Sección "Quiénes somos" de ambos documentos; base para jurisdicción |
| 2 | Email/canal de contacto legal-soporte público | Ejercicio de derechos (acceso/rectificación/supresión) y canal de aceptación/consultas |
| 3 | Edad mínima de usuarios (menores) | Elegibilidad de cuenta en Términos; tratamiento de datos de menores en Privacidad |
| 4 | Jurisdicción / ley aplicable | Cláusula final de Términos, depende de la decisión #1 |
| 5 | Plazos exactos de conservación de cada categoría de dato (más allá de los criterios cualitativos ya definidos en producto) | Sección de retención de la Política de Privacidad |
| 6 | Si corresponde inscripción del responsable ante la AAIP | Cumplimiento formal antes de Production |
| 7 | País/región de procesamiento de datos de Supabase/Vercel, y si constituye transferencia internacional bajo normativa argentina | Sección de proveedores de la Política de Privacidad |
| 8 | Redacción final de propiedad intelectual, limitación de responsabilidad y consecuencias de incumplimiento | Secciones 12-14 de Términos — deliberadamente dejadas sin contenido específico en este borrador para no inventar cláusulas sin respaldo legal |

Ninguna de estas 8 decisiones se resolvió unilateralmente en este borrador — todas quedan marcadas `[DECISIÓN ABIERTA]`/`[REVISIÓN LEGAL NECESARIA]` en el texto correspondiente.

---

## 5. Otros archivos actualizados

- `docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md` — se agregó una nota de estado al encabezado apuntando a los 2 borradores nuevos y a este documento, **sin borrar ningún contenido existente** (las fuentes consultadas, la decisión cerrada de reingreso, y el análisis de retención siguen siendo la base de trazabilidad de esta ronda — no se duplicó ese contenido en los borradores nuevos, se citó).
- `docs/BRAMUlab/Pre_Production.md §P0.2` — estado actualizado de forma objetiva: los 2 borradores completos ya existen, **P0.2 sigue explícitamente ABIERTO** hasta que se resuelvan las 8 decisiones de §4, haya revisión legal real, se integren técnicamente (mapa de §3) y pase QA.

---

## 6. Qué NO se hizo (fuera de alcance explícito de esta fase)

- No se tocó ningún archivo de `bramulab/` (frontend).
- No se cambió `TERMS_VERSION` ni el bundle `04.11-h10`.
- No se aplicó ninguna migración ni se desplegó nada.
- No se redactó ningún texto legal definitivo — ambos documentos son borradores de producto.
- No se inventó razón social, domicilio, CUIT, jurisdicción, plazos legales concretos ni ninguna decisión no cerrada — todo lo que dependía de eso quedó marcado explícitamente.
- No se abrió Bloque 9 ni se mezcló con monetización/publicidad/funciones futuras.

---

## 7. Decisiones abiertas reales

Las 8 listadas en §4 — todas son decisiones de producto/legal genuinas, ninguna es una duda técnica resoluble leyendo el repo.

---

## 8. Próximo paso de Central

1. Revisar ambos borradores por coherencia de producto (¿reflejan correctamente lo que BRAMUlab hace hoy?).
2. Resolver o escalar a Sebastián las 8 decisiones de la matriz (§4) — en particular las #1/#2 (titular y canal de contacto), que condicionan gran parte del resto del texto.
3. Enviar ambos borradores a revisión legal profesional real (protección de datos + derecho del consumidor en Argentina).
4. Con el texto ya aprobado, implementar el mapa técnico de §3 (páginas de Términos/Privacidad, links desde el alta, mecanismo de re-aceptación, canal de contacto) — recién ahí reemplazar `TERMS_VERSION`.
5. QA del flujo completo de aceptación/enlaces antes de considerar P0.2 cerrado.

Esta fase cierra la **preparación** de P0.2 (auditoría + borradores + mapa técnico), nunca P0.2 completo — coherente con `Pre_Production.md`, que sigue marcándolo como abierto.
