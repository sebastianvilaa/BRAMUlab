# BRAMUlab Web — concepto y recorrido público

**Estado (14/10/2026):** concepto y **diseño visual aprobados** por Sebastián; sitio implementado en `bramulab-web/public/` y **PUBLICADO en `https://bramulab.com`** (Vercel `bramulab-web`). La **medición web (Metrics) está ACTIVA desde el 14/10/2026**. §11 resume el estado real.  
**Fecha de consolidación del concepto:** 12/10/2026 (Argentina).  
**Ámbito:** futura web pública en `bramulab.com`, distinta de la app en `app.bramulab.com`.  
**Ubicación de esta documentación:** `bramulab-web/docs/` (separada de los archivos de la aplicación).

## 1. Propósito y criterio de éxito

Crear una **single page pública, mobile first**, que sea la presentación oficial de BRAMUlab y acompañe las llegadas desde un WhatsApp personal, Instagram o Google.

En pocos segundos, alguien que no conoce el producto debe entender qué es, para quién sirve, qué se obtiene al cargar partidos y cómo empezar. Debe reconocer una marca deportiva moderna, sentirse seguro ante un producto real y querer probarlo.

**Tesis del relato:** registrar un partido es el inicio de todo; estadísticas, compañeros, rivales, grupos, BRAMU Intelligence y Nivel surgen de partidos reales. No vender el Nivel ni el Ranking como razón principal para usar la app. La competencia amistosa, los datos propios y las rivalidades entre conocidos son el tono del producto, sin alentar trampas ni prometer precisión perfecta.

**No** campaña publicitaria, catálogo rígido de características, lenguaje corporativo, monetización o landing con falsas métricas de adopción.

## 2. Decisiones confirmadas

- Single page; primera pantalla conectada visualmente con la pantalla actual de bienvenida de la app.
- Mobile first; recorrido que se descubre naturalmente con el **scroll**, sin requerir interacciones especiales para comprender lo esencial.
- Movimiento moderno y controlado: apariciones progresivas, capas, transiciones y momentos memorables; **sliders solo complementarios** cuando evitan bloques demasiado extensos o anchos. No obligar a mover carruseles para enterarse de los beneficios centrales.
- **Atmósfera nocturna azul** de cancha en toda la página, fotografía protagonista en hero, logo oficial e identidad del producto. Lima como foco, no como relleno.
- Fotografías existentes como punto de partida para componer. La imagen actual puede servir provisionalmente aun si fue generada con IA y contiene imperfecciones; **no darla por aprobada para publicación definitiva**.
- **Nunca inventar pantallas ni estadísticas de la app.** Las capturas y tarjetas deben ser auténticas, vigentes y elegidas para explicar algo. Se obtendrán de Staging o Production con datos adecuados para exhibición pública; editar únicamente el encuadre/presentación, no fabricar interfaz o datos. Pedir la captura cuando haga falta, en vez de improvisarla.
- Jerarquía principal: **carga de partidos → beneficios/estadísticas y relaciones → competencia en grupos → BRAMU Intelligence**. Nivel BRAMU como consecuencia secundaria, sin protagonismo principal.
- **Ranking BRAMU fuera de la comunicación inicial de la web.** Esto no equivale a decidir retirarlo de la app.
- Acceso muy claro **desde el hero** para comenzar e iniciar sesión. No obligar a recorrer toda la página para entrar.
- Breve apartado personal sobre quién lo hizo, **sin fotografía y sin detallar empleo, licencia, cirugía ni momento de desarrollo**. Es relevante mencionar que una lesión de hombro lo alejó de la cancha y que de ese parate nació la idea, sin construir una narración sobre tiempo libre.
- La web debe resolver dudas prácticas: qué es, para quién, para qué sirve, cómo se carga un partido, jugadores sin cuenta, validación, instalación en iOS/Android y gratuidad vigente.
- SEO e indexación de Google bien resueltos, vista previa al compartir por WhatsApp/Open Graph, enlace a Instagram oficial (una vez configurado), presencia de información legal y vínculos claros a la app.
- Carpeta de código **separada** de la aplicación dentro del mismo repositorio. No intervenir `bramulab/` para implementar la web. Arquitectura/deploy de la web propios, a decidir durante desarrollo.
- No publicar nada hasta que Sebastián apruebe la propuesta visual y autorice el despliegue.

## 3. Hero — relato conceptual aprobado

**Marca:** logo BRAMUlab SVG oficial.  
**Claim bajo el logo:** `Donde vive tu pádel.`

**Titular principal:**
> Tus partidos no terminan cuando salís de la cancha.

**Bajada:**
> Cargá tus resultados, descubrí tus estadísticas y competí con tus amigos.

**Acciones principales propuestas:**
- `EMPEZAR EN BRAMULAB` — entrada a la app / incorporación, con guía de instalación donde corresponda. Resolver el destino verdadero sin inventar una URL interna.
- `YA TENGO CUENTA` — entrada a la app existente.
- `Descubrí cómo funciona` — ancla hacia la explicación siguiente.

Aprobado el **mensaje y orden de jerarquía**; pendientes las dimensiones y posición exactas, composición de foto, transiciones y microcopy final de botones. No presentar la PWA como descarga de App Store/Google Play.

## 4. Recorrido narrativo inicial para el boceto

Se puede compactar o combinar visualmente, sin convertir estos conceptos en seis secciones idénticas.

1. **Entrar / impactar.** Hero nocturno, logo, claim, titular, bajada y dos accesos a la app. Movimiento sutil que no entorpezca leer.
2. **Entender cómo se carga.** Introducción: `Jugaste. Cargalo. Descubrí todo lo que suma.` Secuencia visual de **seleccionar participantes → cargar resultado → validación del partido** (la confirmación depende de la contraparte). Capturas reales en los puntos que ayuden. Priorizar eliminar el temor de que el proceso sea complicado.
3. **Descubrir qué te aporta cada partido.** Historial como insumo; protagonistas: actividad, efectividad, rachas, compañeros y rivales, estadísticas basadas en datos reales. Explicar que algunos indicadores aparecen al acumular suficiente evidencia y partidos oficiales; no prometer rankings de compañeros basados en un partido.
4. **Competir entre amigos.** Grupos BRAMU, competencia privada entre conocidos; amistosa, con desafíos y rivalidades. No confundir sus puntos con Nivel o Ranking.
5. **BRAMU Intelligence.** Interpretación contextual basada en partidos realmente registrados: detalles y conclusiones útiles que el marcador aislado no explica. Evitar atribuir emociones o técnica no registrada; usar solo ejemplos respaldables por datos o claramente etiquetados como conceptuales.
6. **Nivel BRAMU como consecuencia (discreto).** Si se muestra, dejar claro que es una estimación dinámica que se calibra, no una categoría oficial garantizada. No presentar Ranking en la página.
7. **Resolver dudas + empezar.** Preguntas esenciales, cómo instalar/abrir la app, llamada a la acción final, Instagram, legal y un párrafo personal breve. Orden interno de este cierre pendiente del diseño.

**Ritmo visual:** alternar tramos inmersivos con espacios de lectura clara y capturas del producto; el scroll revela la información. Puede usarse movimiento, aparición y profundidad, con especial cuidado de rendimiento, legibilidad, accesibilidad y reducción de movimiento. Sliders solo si simplifican.

## 5. Qué decir de los jugadores sin cuenta — con precisión

BRAMUlab permite cargar un partido propio ya jugado con jugadores que todavía no se registraron, incluso con solo una cuenta registrada y tres identidades provisionales.

**Límite esencial:** el partido así cargado puede quedar **pendiente**. Para ser oficial/computable necesita la validación prevista, normalmente por la pareja rival; si no existe contraparte registrada capaz de hacerlo, no se autovalida. Un jugador que se registre más adelante puede reclamar una identidad provisional mediante el flujo controlado correspondiente. Nunca insinuar que todo lo cargado modifica automáticamente estadísticas, Nivel o grupos.

También debe quedar claro que BRAMUlab no es marcador en vivo (ese producto es BRAMUlive) y que el autor carga **partidos propios**.

La web explica el proceso de manera humana y breve, sin volcar todo el reglamento técnico.

Fuentes vigentes para revisar el copy antes de publicar:
- `docs/BRAMUlab/Producto/Cargar_Partido.md`
- `docs/BRAMUlab/Producto/Experiencia_Inicial.md`
- `docs/BRAMUlab/Producto/Grupos_BRAMU.md`
- `docs/BRAMUlab/Producto/BRAMU_Intelligence.md`
- `docs/BRAMUlab/Producto/Nivel_BRAMU.md`

## 6. Quién está detrás — tono y borrador pendiente de pulido

Objetivo: vínculo humano real, **no** protagonismo personal ni biografía. Sin foto.

**Título tentativo:** `Una idea nacida entre amigos` o `Un proyecto nacido del pádel`.

**Borrador de trabajo (no copy final aprobado):**

> Soy Sebastián, jugador amateur de pádel. Una lesión en el hombro me obligó a alejarme de las canchas por un tiempo. Quería seguir cerca del deporte y de esa competencia entre amigos, y se me ocurrió empezar a registrar nuestros partidos para descubrir qué contaban los resultados: estadísticas, compañeros, rivales y desafíos.
>
> Así nació BRAMUlab. Empezó como una idea para mi grupo y hoy me gustaría compartirla con otros jugadores.

Mantener la **causa verdadera** (lesión y alejamiento); **no** mencionar licencia laboral, empresa, cirugía, fechas de convalecencia ni que desarrolló el producto durante un tiempo libre determinado. Evitar final emotivo cursi sobre esperar volver a jugar.

## 7. Lineamientos de diseño y activos

- Fuente de autoridad de marca: `docs/BRAMUlab/Identidad_Visual/Identidad_Visual.md`; assets oficiales en `docs/BRAMUlab/Identidad_Visual/Marca/`. No modificar ni reconstruir el logotipo.
- Brief de diseño complementario ya existente en Dropbox: `/Otros Trabajos/BRAMU/Sistema grafico/BRAMUlab-Bases-de-diseno-web.md`.
- Fotografías existentes en Dropbox: `.../Sistema grafico/Archivos/BRAMUlab-Inicio.png` y `BRAMUlab-Inicio-Desk.png`. Deben evaluarse visualmente; no asumir calidad fotográfica perfecta.
- Paleta oficial: azul noche `#050A12`, lima `#95FF19`, azul eléctrico `#199FFF`, blanco `#F8FAFC`. Tipografía Inter, pesos reales.
- Diseño propio de web, pero continuidad perceptible con la app: no duplicar la bienvenida interna con sus tres tarjetas enormes.
- No usar imágenes generadas como *capturas de producto* ni datos personales reales en capturas públicas sin permiso.

## 8. Requisitos públicos desde el principio

- SEO: HTML semántico, `title`, metadescripción, headings claros, contenido renderizable e indexable, canonical, robots/sitemap, metadatos de sitio cuando correspondan, performance mobile; comprobar el dominio real antes de publicar.
- Compartir: etiquetas Open Graph y vista previa de WhatsApp cuidada, usando gráfica oficial propia (no inventar supuestas capturas ni prometer cómo se verá en cada cliente).
- Enlace a Instagram oficial cuando exista y esté listo.
- Instalación: BRAMUlab es una PWA; explicar y comprobar el camino real para iPhone/Android, sin iconos engañosos de tiendas. Acceso directo desde el hero y CTA final.
- Información práctica y legal accesible; confirmar que la gratuidad y las instrucciones continúan vigentes al publicar.
- Independencia técnica: `bramulab-web/` es un proyecto aparte de la app. Estructura vigente en §11: sitio estático en `public/`, función `api/metrics.js` y `vercel.json` propios. No tocar `bramulab/`, `main`, Production ni BRAMUlive.

## 9. Próxima fase y decisiones realmente abiertas

**Concepto general cerrado.** No seguir preguntando por requisitos ya decididos.

**Fase cumplida:** el diseño visual se iteró y aprobó (hero, Cómo funciona, Qué obtenés, Grupos, Intelligence, Nivel, instalación, Preguntas rápidas, cierre). La lista siguiente quedó resuelta en el diseño; se conserva como registro.

Solo quedan para resolver **dentro del trabajo de diseño**, no como bloqueo para avanzar:
- composición, encuadres e intensidad exacta del movimiento;
- selección/obtención de capturas reales específicas;
- pulido del párrafo personal y microcopy;
- orden y síntesis de preguntas frecuentes;
- destinos exactos de CTA, verificación de instalación y enlace oficial de Instagram;
- uso de imagen nocturna provisional y eventual reemplazo por material mejor.

**Ejecución recomendada cuando exista aprobación visual:** Claude Code implementa en carpeta propia, ChatGPT central coordina producto y consistencia, ChatGPT Work valida navegador/visual, Sebastián revisa decisiones de diseño; solicitar autorización explícita antes de publicar.

**Registro:** 12/10/2026 — consolidación del intercambio conceptual. **AGREGAR** esta documentación en `staging`; **NO TOCAR** app, lógica, Ranking interno, `main`, Production, BRAMUlive. Ningún código web creado ni despliegue autorizado por este documento.

---

## 10. Web Analytics mínimo integrado en BRAMU Metrics — implementación Staging 13/10/2026

**Decisión vigente del responsable:** medir exclusivamente «Visitas a la web» y «Clics hacia la app» dentro de BRAMU Metrics, de forma simple, sin contratar Vercel Pro ni otros servicios y **sin identificar personas**. Lo que no puede saberse sin identificadores («cuántas personas cerraron», «cuántas personas únicas hicieron clic») no se exhibe como dato cierto. Esta sección **reemplaza el plan conceptual anterior**: no se necesita Vercel Web Analytics ni su API para el módulo inicial; así también se evita depender de su ventana de 1 mes en Hobby. Vercel Analytics puede evaluarse aparte si se necesitan visitantes únicos estimados, **no está habilitado por este cambio**.

### Qué significa cada cifra

- **Visitas**: eventos `view` al cargar `bramulab.com`; una persona que entra dos veces puede sumar dos y una recarga suma otra. No son personas únicas ni sesiones.
- **Clics**: eventos `click` solamente al abrir la **entrada principal** de BRAMUlab (`https://app.bramulab.com/` o `/index.html`, con eventuales query/hash) desde la web. Otras rutas del mismo dominio, incluidos `/terminos/` y `/privacidad/`, **no se cuentan**. No confirma llegada a la app, instalación, login ni creación de cuenta.
- **Interés**: clics por cada 100 visitas, un cociente entre eventos, no tasa de usuarios convertidos. Puede superar 100 y no permite deducir de manera exacta cuántas personas «cerraron» sin tocar un botón.
- Períodos 7/30/90 días e histórico según selector de Metrics: **días completos hasta ayer en horario Buenos Aires**, más HOY rotulado parcial por separado. Sin reconstrucción retrospectiva; si no hay primer dato se muestra **«Sin medición todavía»**, no 0 ficticio. Si bloqueadores o errores impiden recibir eventos, la cuenta estará por debajo de la actividad real.
- Por ahora solo los totales; `source` queda guardado internamente (`hero`, `login`, `instalacion`, `final`, `other`) para futura distinción sin necesidad de nuevos eventos, **sin agregar paneles adicionales ahora**.

### Código preparado — solo Staging, NO PUBLICADO

| Pieza | Archivo o servicio | Estado |
|---|---|---|
| Base aislada de conteos diarios | `supabase/migrations/20261013220000_web_public_daily_analytics.sql` | Aplicada y probada en **Supabase Staging** con transacción revertida |
| RPC de incremento | `public.web_analytics_increment` | Solo `service_role`; nunca acceso directo desde navegador o `anon` |
| RPC de lectura | `public.metrics_web` | Solo `service_role`, agregados sin personas |
| Panel administrativo «Web» | `bramulab/admin/metrics/metrics.js` + `supabase/functions/_shared/admin-metrics-core.mjs` | Implementado en `staging`; `admin-metrics` desplegada en **Supabase Staging**, `verify_jwt=true`, auth y permiso `metrics_admins` conservados |
| Captura en web | `bramulab-web/js/web-metrics.js` **v1.1** | Archivo canónico en GitHub Staging. Desarrollo Web ya lo integró en su carpeta local, desactivado, pero **debe sincronizar su copia local con v1.1** antes de publicar. En la rama Staging todavía no consta `bramulab-web/index.html`. |
| Endpoint de web | `bramulab-web/api/metrics.js` | Preparado para un **futuro proyecto Vercel WEB independiente**, NO desplegado, fail-closed sin variables de entorno |

**Contrato para Desarrollo Web al implementar la single page:** agregar una sola vez `<script defer src="/js/web-metrics.js"></script>` en `bramulab-web/index.html`, **solo al tener aprobación del aviso de privacidad y decisión de activar**. Mantener los `href="https://app.bramulab.com"` auténticos: NO usar parámetro de usuario, redirecciones forzosas, cookies ni trackers de sesión. Opcionalmente etiquetar CTA con `data-bramu-cta="hero"`, `"login"`, `"instalacion"` o `"final"`; si se omite, se cuenta en `other`. El evento se envía mediante `sendBeacon` y la navegación nunca espera ni depende de él.

**Corrección puntual de enlaces (13/10/2026, listo en Staging, NO activado):** la **versión canónica v1.1** de `bramulab-web/js/web-metrics.js` es el cambio del commit `0e4fbed5ba2d15d0a4697bb7ee92a54b614f6b6c` (blob SHA `ce20d9afe600b989109385df182aa8580d824e3c`). El script anterior contaba cualquier ruta del host `app.bramulab.com`; ahora exige además la ruta `/` o `/index.html`. Por lo tanto, nunca suma documentos legales ni otras rutas: `/terminos/`, `/privacidad/`, con o sin `?query`. **Los `href` originales no cambian; `data-bramu-cta` conserva sus valores y sigue siendo opcional.** Prueba puntual `bramulab/tests/web-analytics-outbound-links.test.mjs`: **16 casos PASS** contra el script real de Staging, incluidos accesos `/` con query/hash y ausencia de conteo en enlaces legales aun si se etiquetan `hero`. No existe medición real activada por este hotfix. **Acción de coordinación:** Desarrollo Web debe traer de GitHub Staging esta misma versión del archivo a su carpeta local, **REEMPLAZAR solo su copia de `web-metrics.js`**, y no modificar ni encender el script mientras siga pendiente la autorización legal y de publicación. Un sitio local no equivale a una versión sincronizada automáticamente; verificar el contenido antes del build definitivo.

**Configuración futura del proyecto Vercel exclusivamente WEB**, por un agente con autorización de publicación y secretos gestionados fuera del chat: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` como variables **server-only**, y `WEB_METRICS_ALLOWED_ORIGIN=https://bramulab.com`. En staging usar el proyecto de base Staging; en Production no usar claves Staging. La función rechaza peticiones sin configuración, origen esperado o evento válido, sin registrar IP, user agent, cookies, URL de navegación ni registros individuales en la base BRAMU. Los logs de infraestructura del proveedor pueden procesar datos técnicos transitorios y requieren revisión en el aviso de privacidad. La comprobación de Origin no evita fraude deliberado (se puede falsificar fuera del navegador): contar con esas limitaciones en la lectura de resultados y observar abuso.

**Antes de habilitar Production:** revisión legal específica de `bramulab.com` y su proveedor, autorización para migración SQL en Supabase Production y deployment de la Edge Function protegida, preparación de entorno WEB Vercel, prueba end-to-end limitada de vista+clic real y control de fallo de telemetría sin romper CTA. No habilitar el sitio/la captura por el simple hecho de haber preparado estos archivos. El nuevo módulo de Metrics protegido tampoco se publica en Production sin permiso.

**Sin cambios:** app pública `bramulab/` funcional, historial/identidad de jugadores, BRAMUlive, `main`, base Production y destino de enlaces.

---

## 11. Estado de implementación y preparación de lanzamiento — 14/10/2026

**Sitio:** una sola página estática (HTML/CSS/JS sin frameworks ni dependencias) en `bramulab-web/public/`. Secciones: hero · Cómo funciona (4 pasos como pantalla viva) · Qué obtenés (Home en teléfono; carrusel horizontal en móvil) · Tu círculo + Grupos · BRAMU Intelligence · Nivel BRAMU · Instalación (iPhone/Android) · Preguntas rápidas · Quién está detrás · cierre. Las pantallas son recreaciones HTML/CSS/JS de la interfaz real con **datos ilustrativos** rotulados como tales. Las fotos de Esteban, Gusti, Jona, Lucho y Matu cuentan con autorización expresa **solo para esta web**; Seba es el creador; Agus y Flor son imágenes generadas; Marcos no tiene foto (representa al jugador sin cuenta).

**Estructura de publicación (proyecto Vercel independiente, aún no creado):**

```text
bramulab-web/
├── public/            # lo único que se sirve (outputDirectory): index.html, css/, js/, assets/, robots.txt, sitemap.xml, favicon.ico
├── api/metrics.js     # Vercel Function del contador (solo del proyecto WEB; nunca de la app)
├── vercel.json        # outputDirectory, redirección www → apex, cabeceras, función
├── .vercelignore      # docs/, README, .claude/ y launcher no se suben
├── docs/              # documentación interna (no pública)
└── README.md
```

**Medición (§10).** `public/js/web-metrics.js` (v1.1) y `api/metrics.js` son los archivos de Desarrollo de Metrics, **sin modificar**. CTA etiquetados con `data-bramu-cta`: `login` (Entrar, encabezado), `hero`, `instalacion` (enlace «app.bramulab.com» del paso 1 de la instalación) y `final`; los demás enlaces a la app (p. ej. «Abrir la app» del pie) cuentan como `other`. Los `href` son directos a `https://app.bramulab.com`, sin parámetros ni redirecciones. **La etiqueta `<script defer src="/js/web-metrics.js">` quedó activa al final de `index.html` el 14/10/2026.**

**Sincronización con Metrics v1.1 (14/10/2026):** `public/js/web-metrics.js` es idéntico al canónico de GitHub Staging (commit `0e4fbed5`, blob `ce20d9afe600b989109385df182aa8580d824e3c`). Cuenta clics solo hacia la entrada principal de `https://app.bramulab.com` (`/` o `/index.html`): «Términos» y «Privacidad» del pie, que viven en `app.bramulab.com/terminos/` y `/privacidad/`, **no se cuentan**. `api/metrics.js` es igual al de Staging. La medición quedó **activada** el 14/10/2026 (ver más abajo).

**Publicación (14/10/2026).** Deploy de Production del proyecto Vercel independiente `bramulab-web` (equipo `bramu-lab`) con `bramulab.com` y `www.bramulab.com` (308 a apex), HTTPS (Let's Encrypt) y DNS en Cloudflare solo-DNS (`A @`, `CNAME www`); `app.bramulab.com` y BRAMUlive no se modificaron. Sitio indexable (`robots.txt` permite, sitemap declarado, sin `noindex`). Las Previews y las URL únicas de deployment siguen protegidas por Vercel Authentication.

**Sigue pendiente (otros frentes):** activación de la medición (aviso de privacidad que la cubra, variables de servidor, migración SQL y `admin-metrics` en Production, prueba end-to-end) y precisar en la Política de Privacidad que el proveedor de alojamiento también aloja el sitio web. Detalle operativo en `README.md`.

**Activación de la medición (14/10/2026).** `web-metrics.js` v1.1 cargado en `bramulab.com` tras publicar la información de privacidad (Política «Actualizada: 14 de octubre de 2026») y dejar listos el backend de Production (migración `web_public_daily_analytics`, `admin-metrics` v2) y las variables de servidor del proyecto `bramulab-web`. Primera escritura real verificada en Supabase Production (1 vista + 1 clic `hero`, incluidos en el contador); Términos y Privacidad no cuentan. Detalle y despliegues: `../docs/BRAMUlab/README.md`.

---

## 12. Franja «Cada partido tiene una historia.» — V04.47 (Preview, 15/10/2026)

**Qué es:** puente narrativo **inmediatamente debajo del hero y antes de «Cómo funciona»** (no lo reemplaza). Que quien nunca vio BRAMUlab entienda de un vistazo el valor central: el partido que se juega, se guarda y se descubre. **Textos definitivos (Sebastián, 15/10/2026):** título *Cada partido tiene una **historia.*** (énfasis lima) y tres momentos — **La jugás** · «Todo empieza en la cancha.» → **La guardás** · «Registrás el resultado en BRAMUlab.» → **La descubrís** · «Tu historial y tus estadísticas te cuentan cómo venís jugando.» (versión inicial «Jugás. Lo cargás. Empieza a sumar.» reemplazada; no se explica la validación acá: va en la sección siguiente). Se retiró la aclaración inferior «Ilustración conceptual…» (ensuciaba la sección); las representaciones siguen siendo conceptuales, sin datos de jugadores, estadísticas ni métricas.
**Dibujos** (decorativos, `aria-hidden`; el relato está en el texto):
- *La jugás:* **cancha de pádel real** vista desde arriba, horizontal, con las proporciones reglamentarias (20 × 10 m; red al centro; líneas de saque a 6,95 m de la red; línea central entre ambas) y un **peloteo**: la pelota cruza la red cinco veces, con altura (sube/baja y se agranda) y sombra a ras de cancha. Sin jugadores ni física compleja.
- *La guardás:* celular que recibe el resultado (sets que aparecen) y queda cargado. *La descubrís:* barras, línea y una fila nueva en el historial.
- Una pelota lima recorre el conector (lima → azul) cuando termina el peloteo.
**Movimiento — bucle con pausa (V04.47-r2):** base CSS = estado **final** (se entiende sin animaciones, sin JS y con `prefers-reduced-motion`, que **no** arma ni repite nada). Con JS y movimiento permitido: secuencia (~8,3 s) → pausa ≈ 3 s con todo completo → fundido corto (0,4 s) → reinicio real de las animaciones CSS (se quitan y vuelven `is-armed`/`is-play` con reflow); **se repite mientras la sección está visible y se suspende** (sin temporizadores ni animaciones corriendo) al salir de pantalla o con la pestaña en segundo plano. Solo `transform`/`opacity`/trazo; sin dependencias.
**Tutorial «Cómo funciona» (`js/demos.js`):** las cuatro demostraciones del recorrido (*Elegí a quiénes jugaron · Cargá el resultado · lo dejás pendiente · Un rival lo confirma*) repiten con el mismo ciclo (secuencia → pausa ≈ 3 s → fundido `.is-loopfade` → reinicio) mientras están activas/visibles; `deactivate`/`finish`, la pestaña en segundo plano y el movimiento reducido cortan el ciclo (estado final). Duraciones medidas por demo en `SEQ_MS`. **No** se convirtieron en bucle las demás animaciones del sitio (Home de «Qué obtenés», Grupos, Nivel, Instalar, mini-demos de las preguntas).
**Implementación:** `public/index.html` (`#puente`), `public/css/puente.css`, `public/js/puente.js`, `public/js/demos.js` + `public/css/demos.css` (bucle). Mobile primero (tres columnas desde 320 px; sin scroll horizontal), escritorio con más aire. Hero, secciones, CTA etiquetados, SEO y `web-metrics.js` (idéntico al canónico) sin cambios. Pruebas: `bramulab-web/tests/puente.test.mjs` (textos, geometría de la cancha, peloteo, bucle con simulación de temporizadores, movimiento reducido, Metrics intacto).
**Estado:** solo en una **Preview protegida** de `bramulab-web`; **no** publicada en `bramulab.com` (requiere aprobación expresa de Sebastián y `vercel deploy --prod` desde esta carpeta).
