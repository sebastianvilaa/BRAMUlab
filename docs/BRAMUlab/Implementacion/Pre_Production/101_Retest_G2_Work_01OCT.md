# 101 — Retest puntual G2 Work

**Fecha:** 01/10/2026  
**Producto / entorno:** BRAMUlab, exclusivamente Staging  
**Repo / rama:** `sebastianvilaa/BRAMUlab` / `staging`  
**HEAD de código verificado antes de guardar este informe:** `e5084e518997813ed2a23a2215eee52db3121a2a`  
**Issue:** #22; no se cierra.  
**Fuentes operativas leídas:** `100_Fix_Central_G2_Privacidad_01OCT.md` y `99_Resultado_G2_Work_QA_01OCT.md`.

## Resultado

**PASS del fix de Privacidad en el marco disponible**, Términos sin regresión, tres referencias editoriales correctas y backs Email/Copia completados. No se reprodujo ningún fallo visual nuevo. **Mobile independiente queda sin ejecutar** por la limitación de viewport del Cloud Browser; no se lo declara PASS.

## Acceso del Cloud Browser: diagnóstico y recuperación

El documento inicial de acceso mostraba “No pudimos conectar con el servidor. Probá de nuevo más tarde.” y controles deshabilitados. El problema observado pertenecía al navegador de Work; no se extrapola a la PWA/iPhone de Sebastián.

La navegación explícita en la misma pestaña al origen canónico `https://bramulab-git-staging-bramu-lab.vercel.app/` recuperó la pantalla de acceso y habilitó sus controles. Luego Sebastián completó el inicio de sesión mediante takeover; se verificó el Home autenticado y se ejecutaron los recorridos del shell.

**Causa exacta no confirmada.** La evidencia es compatible con un estado transitorio de carga/runtime/recursos del documento inicial. No se demostró pérdida de autorización Vercel ni una interceptación persistente de recursos en la pestaña autorizada. No corresponde atribuirlo a credenciales BRAMU o a una caída de Supabase. Console/Network no pudieron obtenerse: la observación de logs fue bloqueada por la protección nativa de credenciales del navegador.

Comprobaciones de recursos realizadas durante el diagnóstico:

| Recurso | Evidencia en la misma pestaña del Cloud Browser |
|---|---|
| `env.generated.js` | Se mostró el archivo esperado: asignación de `__BRAMU_ENV__`, entorno `staging` y configuración Supabase; sin publicar valores sensibles. |
| `icons/logo.png` | Imagen renderizada, dimensiones naturales 915 × 139. El logo roto no se reprodujo en la inspección; las imágenes del acceso también tenían carga completa y ancho natural 915. |
| `manifest.webmanifest` | JSON válido, nombre BRAMUlab y tres entradas de iconos. |
| `auth.js?v=04.20-h5` / `app.js?v=04.20-h5` | Código esperado servido, incluidas las referencias a `isBackendUnavailable` y Configuración. |
| Librería Supabase desde jsDelivr | Comprobación HTTP anónima: 200, `application/javascript; charset=utf-8`. Su observación directa en el navegador fue bloqueada por protección nativa; el Home autenticado aporta evidencia funcional del runtime. |

Las cinco comprobaciones HTTP anónimas de los recursos de Staging devolvieron **302 / text/plain**, coherentes con el acceso protegido. En la pestaña autorizada se mostraron los archivos en sus URLs esperadas sin redirección a login Vercel observable. **No se obtuvo el status HTTP de esas respuestas del navegador**, ni se comprobó autorización compartida entre pestañas.

El evaluador DOM no permite usar sus resultados sobre globals como evidencia fiable de `window.__BRAMU_ENV__`, `window.supabase` o del flag interno de Auth. Por eso no se declara una lectura directa válida de esos globals ni de `Auth.isBackendUnavailable()`; se separa la configuración servida de la evidencia funcional: pantalla recuperada, login y shell operativos.

No se modificaron Supabase, Auth, secrets, Vercel ni protección de Staging para recuperar el acceso.

## Medidas y shell legal

Se abrió cada documento desde **Perfil → engranaje → Configuración**, dentro del shell autenticado. Medición sobre `documentElement` del documento del iframe, no sobre la ventana exterior.

Viewport exterior disponible: **1363 × 936 CSS px**. Marco legal: **460 px**; ancho útil del documento, descontando scrollbar: **445 px**.

| Documento / cobertura | clientWidth | scrollWidth | Overflow horizontal | Scroll vertical | Estado |
|---|---:|---:|---:|---|---|
| Privacidad, desktop con marco legal angosto | 445 px | 445 px | 0 px | clientHeight 881; scrollHeight 4869; scrollTop observado 2808 tras scroll | PASS |
| Términos, mismo marco | 445 px | 445 px | 0 px | clientHeight 881; scrollHeight 5082; scrollTop observado 3276 tras scroll | PASS |
| Viewport mobile independiente / más angosto que 445 px útiles | — | — | — | No disponible con las APIs expuestas | SIN EJECUTAR |

Privacidad antes: **445 / 511**, overflow 66 px (informe 99). Ahora: **445 / 445**, sin overflow. Los placeholders largos se parten visualmente dentro del marco.

Ambos documentos conservaron header y back visibles, ausencia de bottom nav, scroll vertical normal y retorno correcto a Configuración por el back del shell.

Se intentó una vez el zoom estándar del navegador para obtener un viewport CSS más angosto; no tuvo efecto (exterior 1363 × 936 y marco 460 antes/después). No se alteraron estilos ni DOM para simular mobile. El marco de 445 px es el ancho más angosto efectivamente validado, no una prueba de dispositivo mobile.

## Referencias editoriales y backs pendientes

Verificados en texto renderizado y visualmente, desplazando el documento a las secciones correspondientes:

| Comprobación | Resultado |
|---|---|
| Términos §4: `Perfil → Configuración` | PASS |
| Términos §10: `Perfil → Configuración → Eliminar mi cuenta` | PASS |
| Privacidad §7: `Perfil → Configuración → Solicitar copia de mis datos` | PASS |
| Pantalla Email → back → Configuración | PASS |
| Pantalla Copia de mis datos → back → Configuración | PASS |

En Email y Copia solo se abrió la pantalla informativa y se pulsó back. No se pulsó ninguno de sus CTA ni se repitieron sus flujos transaccionales.

## Residuales reales y alcance

- Falta una medición independiente en viewport mobile más angosto: cobertura disponible limitada al marco legal de 445 px.
- La causa raíz del estado inicial del Cloud Browser queda indeterminada por falta de Network/Console accesibles; el acceso y los recorridos solicitados quedaron recuperados.
- El residual humano del icono iOS ya indicado en 100 se conserva; no se repite ni se declara validado en esta ronda.
- No hay nuevas decisiones de producto abiertas detectadas por este retest.

No se modificó código de aplicación. La única escritura de esta ronda es este informe en `staging`. No se repitieron G1, cambio de email, eliminación, reaceptación, logout, Site URL/redirects, fixtures, SMTP, migraciones ni Edge Functions. Sin cambios en main, Production o BRAMUlive. El cierre final de #22 queda para Central.
