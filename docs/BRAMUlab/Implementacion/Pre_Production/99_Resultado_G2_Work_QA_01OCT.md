# 99 — Resultado G2 Work QA — 01OCT2026

Fecha: 01/10/2026. Entorno único: BRAMUlab Staging. Issue #22: permanece abierto.
Fuente operativa: documento 98. Leídos README, 97, 98 y 96.
Baseline probada: staging, c3a2b12e90ee9b64bd64126c33cff433405d63cd, V04.20, bundle 04.20-h5.

## Resultado

**NO PASS GLOBAL.** Se ejecutaron los recorridos que permitió la sesión browser. Hay un fallo visual reproducido en Privacidad y cobertura bloqueada o no completada que no debe interpretarse como PASS. No se modificó código funcional ni copy/diseño de emails.

| Bloque del handoff 98 | Resultado | Evidencia / límite |
| --- | --- | --- |
| 1. Deployment | PASS | Vercel Ready / Preview, fuente staging y commit esperado; alias estable confirmado. V04.20 visible y scripts h5 en DOM. Protección SSO conservada. |
| 2. UX mobile + desktop | PASS parcial / cobertura pendiente | Desktop: Perfil, Mis datos, Configuración y fronteras Email/Eliminar verificadas. Mobile no validado. Apertura real de cliente de correo y algunos backs pendientes. |
| 3. Legal in-app | FAIL visual / PASS navegación | Ambos documentos cargan dentro del shell, con back y sin bottom nav. Privacidad desborda horizontalmente. Origen alta y reaceptación comprobados. |
| 4. Reaceptación legal | PASS funcional y desktop / mobile pendiente | Fixture real sin aceptación; checkbox obligatorio; back conserva selección; aceptación reaccept persistida y recarga sin gate. |
| 5. Site URL / redirects | PASS | Configuración guardada y verificada únicamente en Supabase Staging. |
| 6. Icono PWA/iOS | PASS parcial / instalación pendiente | HTML vivo: apple-touch-icon PNG embebido 180×180 y manifest use-credentials. Manifest versionado h5 inspeccionado. Instalación iOS y recursos individuales servidos no verificados. |
| 7. Network / consola | PASS parcial / consola bloqueada | Correlación de Edge y Auth con logs de servidor y correo recibido. DevTools Network no disponible; dev.logs bloqueado por protección de credenciales. No se certifica ausencia de secretos en consola. |

“Pendiente” significa falta de evidencia; no es un fallo demostrado de la app. Central mantiene el gate final.

## 1. Deployment y protección

En Vercel se verificó deployment 2Dc1gZMDjNmCC9Vtbye56jB4rgCg del proyecto bramulab, equipo bramu-lab: Ready, Preview, Source staging, commit c3a2b12. El alias estable listado es:

https://bramulab-git-staging-bramu-lab.vercel.app

No se usó el dominio efímero como Site URL. El Home muestra BRAMUlab V04.20; los scripts servidos incluyen app.js, auth.js y demás bundles con v=04.20-h5.

Una petición anónima al origen el 01/10 a las 20:33 UTC respondió 302 hacia Vercel SSO. No se abrió Staging ni se modificó su protección. El conector Vercel no tenía permisos suficientes para el detalle; el deployment se comprobó en el dashboard ya autenticado.

El HEAD seguía siendo el esperado antes de agregar este informe. El commit documental que guarda este archivo será posterior a la baseline; no representa una nueva QA del deployment que pudiera generar automáticamente.

## 2. Perfil, Mis datos y Configuración

Cuenta QA inicial: @seba_qa. Cuenta descartable creada para esta ronda: bramulab+test@gmail.com / @test_g2_01oct, sin partidos.

Desktop observado en viewport de captura 1363×936:
- Engranaje discreto arriba a la derecha de Perfil; entra a Configuración. Back vuelve a Perfil.
- Mis datos contiene identidad y datos personales/deportivos/contacto. Sin tarjetas Acceso/Legal ni botón grande Cerrar sesión.
- Edición server-backed comprobada: nombre visible Seba → Seba Qa G2, lectura del valor persistido en servidor y UI, luego restaurado a Seba y confirmado en servidor.
- Configuración compacta, con Cuenta y seguridad, Privacidad y datos, Legal, Ayuda, Sesión y zona destructiva separada. Filas y chevrons visualmente alineados; sin cards anidadas innecesarias.
- Las pantallas de Configuración y sus intermedias no muestran bottom nav.

La columna compacta dentro de un viewport desktop **no demuestra comportamiento mobile**. El navegador expuesto no ofrece cambio de viewport/emulación; el atajo probado no abrió DevTools. No se certifica QA a 390 px ni en teléfono real.

### Frontera primer tap → CTA

| Acción | Primer tap observado | CTA observado | Resultado |
| --- | --- | --- | --- |
| Email | Pantalla EMAIL con email actual y explicación. Challenges de cambio: 2 → 2; sin correo nuevo en ventana de prueba. | Cambiar email abrió OTP. Challenges: 2 → 3. OPTIONS 200 y POST 200; correo #3 recibido. | PASS |
| Eliminar | Pantalla contextual con consecuencias. En descartable: 0 challenges y 0 correos nuevos. | Continuar con la eliminación abrió OTP. 0 → 1 challenge delete_account; OPTIONS 200 y POST 200; correo #7 recibido. | PASS |
| Copia | Pantalla de categorías y canal de solicitud; no abrió mailto. | Solicitar copia intentó mailto; el navegador bloqueó el protocolo. | PASS primer tap; apertura cliente bloqueada |
| Contacto | Pantalla con canal único y botón Enviar email; no abrió cliente. | No se volvió a intentar el protocolo ya bloqueado. | PASS primer tap; CTA pendiente |

Correo #3: “Confirmá el cambio de email en BRAMUlab”, fecha 20:25:45 UTC; POST finalizó 200 a las 20:25:47.550 UTC.
Correo #7: “Confirmá la eliminación de tu cuenta”, fecha 20:42:35 UTC; POST finalizó 200 a las 20:42:37.622 UTC.
Se consultaron metadatos de entrega; no se copiaron OTPs ni cuerpos para repetir G1. No se completó cambio de email ni destrucción de cuenta.

Copia enumera cuenta/perfil, actividad deportiva y notas privadas, Nivel/Ranking, grupos, aceptaciones, notificaciones/Intelligence y datos técnicos mínimos. Se presenta como solicitud por soporte/privacidad, no como exportación automática; aclara el alcance de datos de terceros. No se observó una promesa de exportación automática inexistente.

### Backs y logout

Backs ejecutados: Configuración → Perfil; flujo OTP Email → Configuración; explicación Eliminar → Configuración; Contacto → Configuración; Términos y Privacidad → Configuración; Términos desde alta → alta; Términos desde reaceptación → reaceptación.

No se certifica “todos los backs”: back de Copia y back de la pantalla informativa Email no se ejecutaron individualmente. El back de alta se comprobó con formulario vacío; la conservación de selección se comprobó efectivamente en reaceptación.

Logout:
- La fila abre modal con Cerrar sesión / Cerrar todas las sesiones / Cancelar, manteniendo sesión hasta elegir.
- Cancelar conserva sesión y Configuración.
- Cerrar sesión retorna a acceso; POST /logout 204 a las 20:33:39 UTC.
- Cerrar todas las sesiones retorna a acceso; POST /logout 204 a las 20:53:56 UTC. auth.sessions del descartable pasó de 1 a 0.
- No se creó una segunda sesión independiente: está probada la acción y la eliminación de la sesión existente, no la expulsión simultánea en dos dispositivos.

## 3. Legal dentro del shell

Términos y Política cargaron en iframe del mismo origen, con header/back de BRAMU y sin bottom nav. Scroll interno comprobado; back regresa a Configuración.

Desde alta, Términos abrió dentro del shell y volvió al alta. Desde reaceptación, Términos abrió dentro del shell y volvió al gate conservando checkbox marcado.

**Fallo reproducido: Privacidad desborda horizontalmente.**
- Documento: /privacidad/ dentro de #legal-doc-frame.
- documentElement.clientWidth = 445 px.
- documentElement.scrollWidth = 511 px.
- Diferencia = 66 px y barra horizontal visible.
- Términos, en el mismo contexto: 445 / 445 px, sin desbordamiento.
- Reproducción: Perfil → engranaje → Política de Privacidad; observar barra horizontal y desplazar el documento.
- No se corrigió CSS ni copy en esta ronda.

También se observaron referencias de navegación anteriores en Términos: sección 4 indica “Mi perfil → Mis datos → Acceso y seguridad” y sección 10 indica “Acceso y seguridad → Eliminar mi cuenta”. La navegación actual pasa por Perfil → Configuración. Registrar para Central; no se alteraron textos legales ni decisiones de producto. Los marcadores PENDIENTE_PRODUCCION existentes tampoco se modificaron.

## 4. Reaceptación real y fixture

Para evitar cambiar app_config.legal_version o mutar evidencia legal append-only, se preparó un fixture aislado de jugador/perfil/Nivel:
1. Se conservó intacto el jugador original @test_g2_01oct y su aceptación signup.
2. Se creó @test_g2_reaccept01oct, sin aceptación, excluido del ranking, y se vinculó temporalmente al Auth de la cuenta descartable.
3. La recarga consultó el estado real del servidor y mostró el gate de aceptación.
4. Checkbox sin marcar: CTA deshabilitado. Marcado: habilitado. Volver de Términos conserva selección.
5. Sebastián realizó la aceptación legal directamente.
6. Se verificó legal_v1, source=reaccept, accepted_at=2026-10-01T20:51:59.524852Z.
7. Se recargó: Home visible, gate no reaparece.
8. Se restauró el Auth al jugador original; fixture de reaceptación archivado inactivo, sin Auth y excluido del ranking. Su registro legal se conserva como evidencia de QA.

Desktop: bloque centrado con aire entre logo, explicación, checkbox, CTA y logout; no pegado al borde superior y sin vacío inferior desproporcionado. Mobile no observado.

No se cambiaron versión legal global, funciones, triggers, migraciones ni políticas. No se borraron aceptaciones previas. La cuenta descartable original queda activa, sin sesión y sin partidos; no se destruyó, como permite el documento 98.

## 5. Supabase Auth — configuración final guardada

Proyecto: bramulab-staging, serxtivkfnptzurnvewg.
Site URL final:

https://bramulab-git-staging-bramu-lab.vercel.app

Redirect URLs:
- https://bramulab-git-staging-bramu-lab.vercel.app
- https://bramulab-git-staging-bramu-lab.vercel.app/**

Se reemplazó localhost:3000 y se añadieron los dos redirects. Dashboard confirmó guardado y total de dos URLs. Sin GitHub/raw, Production ni localhost. Sin modificaciones de SMTP, templates, asuntos, redirects de Production ni copy/diseño de mails.

## 6. PWA / iOS

HTML vivo verificado:
- apple-touch-icon embebido como data:image/png;base64.
- PNG de 180×180, sin reconstruir ni cambiar el asset.
- Manifest enlazado como manifest.webmanifest, crossorigin=use-credentials.
- Bundles DOM con 04.20-h5.

Manifest versionado del commit probado inspeccionado:
- icon-192.png, 192×192.
- icon-512.png, 512×512.
- icon-512-maskable.png, 512×512, purpose maskable.
- Los tres usan v=04.20-h5; standalone, start_url ./index.html y scope ./.

La observación del recurso manifest en otra pestaña fue bloqueada por protección de credenciales del navegador. No se certifican respuestas/dimensiones de cada asset servido ni instalación PWA sólo a partir del archivo versionado.

No hay iPhone/iOS real disponible en esta sesión. **Único residual manual iOS agrupado:** Sebastián elimina la instalación anterior, abre Staging autenticado, reinstala una vez desde Safari y confirma que aparece el isotipo correcto. Sin pedir capturas en cadena.

## 7. Network / consola y límites

La frontera de envío se comprobó combinando UI, conteos de challenges, ausencia/presencia de correo y logs function_edge_logs:
- En las ventanas de primer tap no aparecieron requests Edge antes del CTA.
- Cada CTA Email/Eliminar produjo OPTIONS 200 y POST 200.
- Ambos correos llegaron; sin 5xx en esos requests.
- Los logout observados terminaron 204.
- Los documentos legales cargaron visualmente y permitieron scroll; no se capturaron sus códigos HTTP en DevTools.

El navegador no expone Network ni cambio de viewport. dev.logs respondió bloqueo por documento con credenciales nativas, incluso al intentar obtener sólo estadísticas. No se extrajeron credenciales ni se eludió esa protección. La ausencia de secretos/OTP en consola **queda sin validar**, no se marca PASS.

También bloquea mailto: por política de protocolos. No se evitó el bloqueo con otro mecanismo ni se enviaron solicitudes de soporte.

## Cambios realizados y conservación

- Configuración hosted Auth: Site URL y dos Redirect URLs, sólo Staging.
- Datos sintéticos de QA y fixture legal aislado; restauración y archivo documentados arriba.
- Nombre visible de @seba_qa restaurado a Seba.
- Único cambio versionado de esta ronda: agregar este informe.
- No main, Production, BRAMUlive, migraciones, Edge deployments, Send Email Hook, SMTP ni templates.
- No cierre de Issue #22.

## Residuales para Central

1. Corregir/retetestar desbordamiento de Privacidad en el iframe.
2. Completar QA mobile real/emulada y los backs indicados como no ejecutados.
3. Verificar apertura de cliente por CTA de Copia y Contacto fuera del bloqueo mailto del navegador.
4. Completar revisión de consola y, si se necesita cerrar cobertura, Network de iframe y expulsión entre dos sesiones independientes.
5. Revisar referencias de navegación legal anteriores sin reabrir decisiones de producto.
6. Completar verificación de recursos PWA servidos y el único residual manual iOS indicado.

## DECISIONES ABIERTAS

No se detectó una nueva decisión de producto que corresponda resolver en esta ronda. Hay un fallo de presentación, referencias desactualizadas y límites de cobertura; no se sustituyeron por decisiones de diseño o copy.

Central debe conservar Issue #22 abierto y decidir el gate final tras corregir el fallo y completar la evidencia pendiente.
