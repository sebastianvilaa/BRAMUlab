# 93 — Resultado G1 Work: configuración hosted y QA real

**Fecha:** 01/10/2026. **Producto:** BRAMUlab. **Entorno:** Staging exclusivamente.

**Proyecto confirmado visualmente:** `bramulab-staging` / `serxtivkfnptzurnvewg`.
**Repo/rama:** `sebastianvilaa/BRAMUlab` / `staging`.
**HEAD funcional/documental al iniciar y antes de guardar este informe:** `0a639d67325f880a651418867ccb62b9e880b797`, bundle `04.20-h4`.
**Fuente operativa:** documento 92, gate 91, entrega 90 y templates/manifest versionados. La autorización posterior del usuario habilitó configuración y QA; la instrucción posterior sobre el logo prevalece sobre la propuesta inicial de hosting.

## Resultado para Central

**G1 global: FAIL de cobertura para cierre; permanece PENDIENTE de gate Central.** Los ocho emails V1 fueron recibidos realmente y los flujos críticos de backend pasaron por API. Esto no certifica una pasada integral de interfaz: faltan onboarding/reanudación en navegador, purga local, fixture de partido compartido y cobertura visual mobile/imágenes efectivamente bloqueadas. También existe una discrepancia de Site URL que se dejó sin modificar por la instrucción explícita final del usuario.

**Configuración SMTP/Edge y recorrido de cambio de email por API: PASS. Eliminación por API y postcondiciones verificadas: PASS dentro de la cobertura detallada abajo.** No se detectó un bug funcional confirmado que requiera cambiar código.

Issue #21 no fue cerrado. Central conserva el gate final. No se repitieron migraciones, deploys, advisors ni regresiones ya realizadas por Central. No se modificaron código, main, Production ni BRAMUlive. La única escritura al repo de esta ronda es este informe en staging.

## Configuración realizada/verificada

Secrets de Edge confirmados por existencia, sin registrar sus valores:

| Secret | Estado |
|---|---|
| `BRAMU_CHALLENGE_PEPPER` | Presente; generado criptográficamente con 32 bytes aleatorios, representados en 64 caracteres; conservado sin rotación posterior |
| `BRAMU_SMTP_USER` | Presente |
| `BRAMU_SMTP_PASS` | Presente; App Password dedicada introducida directamente por el usuario en la web |
| `BRAMU_SMTP_FROM` | Presente |
| `BRAMU_PUBLIC_BASE_URL` | Presente; base del asset público detallada abajo |
| `BRAMU_SMTP_HOST` | Presente |
| `BRAMU_SMTP_PORT` | Presente |
| `BRAMU_SMTP_FROM_NAME` | Presente |

Se reutilizó Gmail SMTP, mismo proveedor e identidad del SMTP Auth existente. Host/puerto efectivos: `smtp.gmail.com:465`. Custom SMTP de Auth siguió activo. Remitente observado en emails nativos y custom: **BRAMUlab <bramulab@gmail.com>**. Reply-To custom observado: **bramulab@gmail.com**. La App Password dedicada quedó identificada en Google como `BRAMUlab Edge Staging G1 01-10-2026`; su valor no forma parte del informe.

| Auth hosted | Resultado |
|---|---|
| Confirm signup | Asunto y HTML versionado aplicados, con única adaptación del src del logo |
| Reset password | Asunto y HTML versionado aplicados, con única adaptación del src del logo |
| Change email | Asunto y HTML versionado aplicados como fallback exclusivamente, con adaptación del src del logo |
| Password changed notification | Asunto/HTML aplicados; ON |
| Email changed notification nativo | OFF; #5 custom evita duplicación |
| Secure Email Change | ON |
| Secure Password Change | OFF; sin paso visible adicional |
| Require current password | OFF |
| Email OTP | 6 dígitos, 3600 segundos |
| Confirm email / proveedor email | ON / habilitado |
| Otras notificaciones de seguridad | OFF |
| Send Email Hook | No configurado |

Las funciones `account-challenge` y `delete-my-account` se observaron ACTIVE con `verify_jwt=true`. El inventario hosted devuelve versiones 9 y 10 respectivamente; son los contadores hosted observados, no una afirmación de nuevos despliegues realizados por Work.

## Logo, Vercel y Site URL

**Vercel Staging permanece protegido.** No se agregó excepción pública ni se desactivó la protección de `bramulab-git-staging-bramu-lab.vercel.app`.

**URL absoluta usada para el logo real:**

`https://raw.githubusercontent.com/sebastianvilaa/BRAMUlab/0a639d67325f880a651418867ccb62b9e880b797/bramulab/icons/logo.png`

**Base pública de asset usada por el renderer custom:**

`https://raw.githubusercontent.com/sebastianvilaa/BRAMUlab/0a639d67325f880a651418867ccb62b9e880b797/bramulab`

Verificación anónima, sin cookies/login: **HTTP 200 / Content-Type image/png**. Es el archivo `bramulab/icons/logo.png` del repositorio público fijado al commit, sin reconstrucción ni sustitución. En Gmail real cargó con tamaño natural **915 × 139** y tamaño visual **197,47 × 30 px**.

En los cuatro templates nativos se reemplazó únicamente `src="{{ .SiteURL }}/icons/logo.png"` por esa URL absoluta. No se cambiaron redirects ni variables de enlaces. En el mailer custom, la base pública funciona para construir el logo; no se convirtió en origen de autenticación.

**Discrepancia importante encontrada:** la Site URL hosted observada era **`http://localhost:3000`**, no el dominio HTTPS de Staging que el usuario suponía. La lista de redirect URLs observada estaba vacía. Se dejó sin cambios por la instrucción final explícita de no cambiar Site URL ni redirects. **Nunca se apuntó Auth a GitHub.** Los OTP probados por API funcionan, pero esto no valida enlaces/redirects desde el frontend hospedado. Central debe conciliar esta configuración con el origen de Staging antes de cerrar el gate.

**Diferencia hosted/repo intencional pendiente de sincronización:** los cuatro archivos `supabase/email-templates/auth/{confirmation,recovery,email_change,password_changed_notification}.html` todavía versionan el src basado en SiteURL; hosted utiliza la URL absoluta anterior. Central debe sincronizar esa diferencia y los hashes/README/generación asociados sin alterar el copy o redirects. No bloqueó la configuración ni la QA independiente.

## QA A–F: evidencia y límites

Se utilizaron cuatro aliases descartables del inbox controlado. Los identificamos aquí como A, B, C y D, sin publicar contraseñas, tokens ni códigos. Las acciones funcionales se ejecutaron contra APIs reales de Supabase Staging con las mismas rutas usadas por el frontend, no mediante un mock. Los correos se comprobaron en Gmail real y mediante MIME recibido. **No se presenta esta cobertura como navegación integral de la UI de BRAMUlab.**

| Área | Evidencia real | Estado / límite |
|---|---|---|
| A. Signup | Alta real; email #1 recibido; código de seis dígitos como texto; verify signup HTTP 200 y sesión establecida; complete_profile HTTP 200 en las cuentas con perfil | PASS API/recepción; reanudación de onboarding en UI pendiente |
| B. Recovery | #2 recibido; verify recovery 200; update password 200; #6 recibido tras el cambio; logout scope=others 204; refresh de otra sesión rechazado 400 | PASS API/recepción; revocación se solicitó explícitamente como hace el cliente; no prueba automática de ejecución de la UI |
| C. Cambio de email | #3 al email actual → verificación → #4 al nuevo → segunda verificación; resultado 200 con notice sent; refresh actual 200 con email actualizado; otra sesión rechazada; #5 al email anterior | PASS API crítico: exactamente dos verificaciones; ningún email_change nativo adicional observado |
| C. Negativos | Código incorrecto: 400 code_invalid. Reenvío inmediato: 429 resend_too_soon, con espera informada de 48 s | PASS; no se esperaron 60 minutos para duplicar pruebas de expiración ya cubiertas |
| D. Eliminación | Sin prueba específica: 403 delete_challenge_required. #7 contextual recibido; verify delete_account 200; delete 200 con receipt sent; login posterior 400; #8 único recibido | PASS API y backend descrito abajo; historial de partidos/avatar/purga local pendientes |
| E. Visual | Gmail web desktop, tema original y tema Oscuro, imágenes cargadas: Night Card legible, proporción correcta del logo, sin desborde visible en #6; códigos de seis dígitos presentes como texto en MIME | PARCIAL: viewport mobile no disponible en la API de navegador expuesta; no se verificó selección/copiar en UI ni render visual de todos los OTP |
| F. Seguridad/red | Ambas funciones ACTIVE/JWT; solicitudes reales y logs de plataforma revisados; 17 solicitudes de funciones en la ventana 17:45–18:41 UTC, sin 5xx | PARCIAL: no captura integral de Network del frontend ni inspección completa del cuerpo de logs de aplicación |

**Postcondiciones de eliminación de A verificadas por SQL de solo lectura:**

- Usuario Auth ausente y desafíos de la cuenta purgados.
- Player inactivo, deleted_at presente, auth_user_id nulo y display_name `Jugador eliminado`.
- Username, nombre, apellido y teléfono nulos; WhatsApp y participación en ranking desactivados; listas privadas guardadas vacías.
- Aceptación legal conservada conforme al contrato observado.
- Grupo compartido con B preservado activo; membresía de A cerrada y de B abierta.
- Grupo individual de A marcado eliminado.

**Límite:** el fixture compartido fue un grupo, no un partido con historial de resultados. No se subió avatar ni se probó purga del estado privado local en navegador. No inferir esos PASS a partir de los checks de grupo. El E2E existente requiere service-role; no se ejecutó ni se obtuvo esa credencial.

**Imágenes bloqueadas:** se probó temporalmente la preferencia Gmail “Preguntar antes de mostrar imágenes externas”, pero el mensaje del propio remitente continuó mostrando el logo. Por lo tanto, no se certifica render efectivamente sin imágenes. El contenido/código/footer está implementado como texto y el custom incluye text/plain, pero esa revisión de MIME no reemplaza el requisito visual. Se restauraron el tema Predeterminado, imágenes externas ON y correo dinámico ON; guardado final comprobado.

**Dark mode:** PASS en el tema oscuro de Gmail web para #6. No equivale al comportamiento de inversión automática del Gmail móvil. **Apple Mail/Outlook:** no disponibles para QA real; un único residual manual agrupado, sin cadena de capturas solicitada al usuario.

**Logs:** se consultaron `function_edge_logs` y `function_logs`. Las 17 respuestas de funciones fueron 200/400/403/429, con los 400/403/429 esperados por negativos. Los atributos de aplicación disponibles eran de arranque/cierre y nivel log/info; no se obtuvo un campo completo de mensaje de aplicación, por lo que no se certifica un barrido exhaustivo de OTP/PII en logs. La plataforma incluye metadatos de IP/usuario/sesión; no se copiaron esos valores al informe. Las respuestas resumidas de Edge no necesitaron devolver OTP. Los tokens normales de Auth necesarios para la QA no se incluyeron en evidencias públicas.

## Emails realmente recibidos

| # | Asunto exacto | Destinatario relativo | Mecanismo / recepción |
|---|---|---|---|
| 1 | Confirmá tu cuenta en BRAMUlab | Nuevo usuario de prueba | Auth confirmation; retest final D: un solo mensaje, HTML aprobado exacto con src adaptado |
| 2 | Recuperá tu contraseña en BRAMUlab | A, email vigente antes del cambio | Auth recovery; un mensaje, HTML aprobado exacto con src adaptado |
| 3 | Confirmá el cambio de email en BRAMUlab | A, email actual/anterior | account-challenge + SMTP; un mensaje contextual |
| 4 | Confirmá tu nuevo email en BRAMUlab | A, email nuevo | account-challenge + SMTP; un mensaje; fallback nativo no utilizado |
| 5 | El email de tu cuenta fue cambiado | A, email anterior | Custom; un mensaje tras éxito, con email anterior/nuevo correctos |
| 6 | La contraseña de tu cuenta fue cambiada | A, email vigente al cambiar contraseña | Auth password_changed_notification; un mensaje, HTML aprobado exacto con src adaptado |
| 7 | Confirmá la eliminación de tu cuenta | A, email nuevo/vigente | Custom delete_account; un mensaje contextual con consecuencias, sin recovery |
| 8 | Tu cuenta de BRAMUlab fue eliminada | A, último email vigente | Custom tras eliminación; un comprobante, footer mínimo sin soporte ni recuperación |

El inventario final de A después de iniciar el cambio mostró exactamente #3, #4, #5, #7 y #8. Ningún tercer desafío ni notificación nativa de cambio de email adicional. Las pruebas de limpieza de B/C/D generaron sus propios #7/#8 de forma intencional; no son duplicados del recorrido A.

## Incidentes y resolución

1. **HTML concatenado en el editor hosted:** en pruebas iniciales de confirmación, el editor conservó contenido previo junto al nuevo HTML; un retest intermedio tuvo dos documentos HTML. Se corrigió reemplazando toda la fuente, pegando una sola vez y comprobando guardado antes de navegar. El email final D tiene una única instancia del documento y coincide con el template aprobado salvo src del logo/normalización de saltos de línea. Recovery y password notification también fueron contrastados con MIME recibido. El fallback se guardó pero no se disparó artificialmente.
2. **Dos mensajes de confirmación en el primer alta de A:** dos Message-ID diferentes separados por unos segundos ante una solicitud registrada. Causa no determinada. No se reprodujo en el alta final D, que entregó un solo mensaje. Registrar como observación no resuelta, sin atribuirla a un bug concreto. El reenvío deliberado de C sí genera un segundo mensaje esperado y se distingue de este caso.
3. **Timeout de cliente durante limpieza:** la eliminación de C y la solicitud de desafío de D excedieron el timeout local. Se verificó el efecto antes de repetir acciones: C ya estaba eliminado y D había recibido el desafío. Se continuó sin repetir esas solicitudes. Los logs posteriores no mostraron 5xx funcionales.
4. **OTP extraído incorrectamente en limpieza B:** una búsqueda genérica en HTML podía tomar un número de CSS; produjo code_invalid. Se restringió la extracción al span del código y la verificación posterior pasó. Es un incidente del helper de QA, no del producto.

## Limpieza y próximos pasos de Central

Las cuatro cuentas descartables A/B/C/D se eliminaron con el flujo propio, sin purgas administrativas. SQL final: **0 usuarios Auth restantes con los aliases de esta ronda**. Los registros anonimizados/legales retenidos y grupos eliminados son residuos esperados del contrato, no cuentas activas. La limpieza de B ocurrió después de verificar la preservación del grupo compartido de A; ese grupo luego puede quedar eliminado al no tener miembros activos.

Para cerrar G1, Central necesita:

1. Conciliar Site URL localhost con el dominio Staging protegido; mantener separados origen Auth y base pública del logo.
2. Sincronizar src absoluto del logo y hashes/documentación en repo.
3. Completar UI real de onboarding/reanudación, recovery/cambio de email y eliminación con purga local; complementar la eliminación con partido compartido/avatar si el gate los exige.
4. Completar Gmail mobile y bloqueo efectivo de imágenes, incluyendo OTP; revisar Apple Mail/Outlook como residual agrupado.
5. Cerrar la inspección de cuerpo de logs/Network y decidir si la observación de doble confirmación inicial exige una reproducción dirigida.

**DECISIONES ABIERTAS:** ninguna nueva decisión de producto/diseño/copy resuelta o propuesta por Work. Los puntos anteriores son configuración, sincronización y cobertura pendientes. La protección de Vercel y el uso del logo real fijado a commit ya fueron decididos explícitamente por el usuario.

## Mapa de handoff

| COMUNICACIÓN | ESTADO | TEMPLATE/MECANISMO | QUÉ PODEMOS PERSONALIZAR | RIESGO/PENDIENTE |
|---|---|---|---|---|
| Confirmación | Recibida; PASS API | confirmation nativo | HTML/asunto versionados; src absoluto hosted | UI onboarding y observación inicial de duplicado |
| Recuperación | Recibida; PASS API | recovery nativo | HTML/asunto aprobados | QA de interfaz |
| Confirmación email actual | Recibida; PASS API | account-challenge custom #3 | Renderer aprobado | QA de interfaz/mobile |
| Confirmación email nuevo | Recibida; PASS API | account-challenge custom #4; email_change nativo solo fallback | Renderer + fallback aprobado | Sin tercer desafío; sync src fallback |
| Aviso cambio email | Recibido una vez | Custom #5; nativo OFF | Renderer aprobado | QA visual adicional |
| Aviso cambio contraseña | Recibido una vez | password_changed_notification ON | HTML/asunto aprobados | Gmail desktop/oscuro pasó; resto pendiente |
| Confirmación eliminación | Recibida; PASS API | Desafío específico delete_account + custom #7 | Renderer contextual aprobado | Partido compartido/avatar/local/UI pendientes |
| Comprobante eliminación | Recibido tras éxito | Custom #8 | Renderer mínimo aprobado | Completar evidencia UI, sin recovery/soporte |

## INFORMACIÓN QUE CENTRAL NECESITA PARA DISEÑAR

El diseño y copy de G1 ya están cerrados: esta ronda no requiere propuestas nuevas. Para conservarlos al sincronizar, Central necesita la URL exacta del asset fijado a commit, la separación entre base de logo y Site URL, la diferencia hosted/repo limitada al src y los residuales de render de clientes enumerados arriba. No diseñar otro email ni introducir un tercer desafío para resolver estos pendientes.
