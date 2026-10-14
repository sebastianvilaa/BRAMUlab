# BRAMUlab Web — concepto y recorrido público

**Estado:** concepto y jerarquía narrativa aprobados por Sebastián; pendiente diseño visual y revisión de textos finales.  
**Fecha de consolidación:** 12/10/2026 (Argentina).  
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
- Independencia técnica prevista: `bramulab-web/` con `index.html`, `css/`, `js/`, `assets/` y configuración específica. **Ruta propuesta, todavía no creada.** No tocar `bramulab/`, `main`, Production ni BRAMUlive.

## 9. Próxima fase y decisiones realmente abiertas

**Concepto general cerrado.** No seguir preguntando por requisitos ya decididos.

**Próxima fase: diseño visual**, empezando por el hero mobile y su adaptación a escritorio; después recorrido de carga y resultados/beneficios. Revisar juntos el prototipo y ajustarlo hasta aprobarlo.

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

## 10. Medición de la web pública y relación con BRAMU Metrics (PROPUESTA, 13/10/2026)

**Estado: ANÁLISIS / PLAN, NO IMPLEMENTAR NI PUBLICAR SIN AUTORIZACIÓN.** La web sigue sin código ni proyecto Vercel propio. No alterar `bramulab/`, Metrics protegido, bases de Production, `main` ni BRAMUlive. La medición será exclusivamente de visitantes anónimos de `bramulab.com`, sin vincularlos con `player_id`, cuenta, Nivel ni actividad registrada en la app.

### Objetivo y vocabulario honesto

1. **Vistas de página** (`pageviews`): carga/navegación medida por Vercel Web Analytics, incluyendo recargas; para una single page NO equivale a sesiones.
2. **Visitantes estimados** (`visitors`): métrica agregada de Vercel, basada en un hash efímero que rota cada día; no es persona individual identificada. Consultar agregados exactos del período desde la API cuando estén disponibles, nunca sumar los visitantes diarios y etiquetarlos «únicos en 90 días».
3. **Clics hacia la app**: intentos de clic en enlaces directos a `https://app.bramulab.com`, registrados por envío de evento liviano desde la web, separados por `hero`, `login`, `instalacion`, `final` y futuros CTA autorizados. Contadores aproximados de clics recibidos, **no personas, instalaciones, llegadas confirmadas ni sesiones iniciadas**.
4. **Relación de interés**: `clics_de_salida / vistas_de_página * 100`, rotulada «Clics hacia la app por cada 100 vistas de la web». Puede superar 100; no es una tasa de personas convertidas. Si una fuente está interrumpida/desactualizada, mostrar cobertura/incompleto antes que un porcentaje inventado.
5. Ventanas: últimos 7, 30 y 90 días; serie diaria con día UTC común entre fuentes (o la misma zona de fecha documentada para ambas). De no existir datos suficientes, mostrar «desde la activación» sin reconstrucción.

### Resultado de la investigación Vercel (documentación oficial consultada 13/10/2026)

- En **Hobby**: Web Analytics incluye **50.000 eventos/mes compartidos por equipo**, sin pago extra, **1 mes de reportes** y **sin eventos personalizados**. Por ello **Vercel Analytics por sí solo NO entrega clics por CTA en Hobby ni garantiza 90 días consultables**.
- En **Pro**: eventos personalizados permitidos y 12 meses de ventana; plan base anunciado desde USD 20/mes y eventos por uso. **No se pudo confirmar el plan de facturación efectivo de la cuenta BRAMUlab** con el conector actual. No autorizar upgrade por defecto.
- Desde mayo de 2026 Vercel dispone de una **Web Analytics API oficial**: `visits/count`, `visits/aggregate`, `events/count` y `events/aggregate`, que consulta los datos agregados del panel; requiere token server-side. Verificar en el proyecto nuevo las cuotas/permisos y horizonte real antes de prometer 90 días.
- Vercel Analytics usa estadísticas agregadas y no cookies de seguimiento; su estimación de visitante no identifica de manera permanente a una persona. Bloqueadores de scripts, tráfico automatizado que supere filtros y recargas pueden alterar las cifras.
- Vercel Cron está disponible en Hobby una vez al día, con hora de ejecución aproximada: alcanza para guardar resúmenes diarios.

**Fuentes Vercel:** https://vercel.com/docs/analytics/limits-and-pricing · https://vercel.com/docs/analytics/privacy-policy · https://vercel.com/docs/analytics/web-analytics-api · https://vercel.com/docs/cron-jobs/usage-and-pricing .

### Solución propuesta para no depender de pagar Pro

**Una integración sencilla de dos entradas y un historial agregado, ejecutada en la futura WEB separada:**

- **A. Visitas:** habilitar Web Analytics en el proyecto independiente de Vercel para `bramulab-web/` al publicar, exclusivamente entorno/domino público. Verificar que una visita real nueva genere el evento de página; no contar tráfico QA de Staging/Preview como público.
- **B. Clics por CTA:** los enlaces siguen siendo **enlaces directos nativos** a `https://app.bramulab.com`, sin redirección intermedia obligatoria. Al hacer clic se intenta enviar de forma asincrónica un evento mínimo `{source: hero|login|instalacion|final}` con `navigator.sendBeacon()` (o `fetch(..., {keepalive:true})` como alternativa) a una Vercel Function **propia de la web**, que valida una lista cerrada de orígenes, verifica que procede de la web e incrementa **atómicamente** el contador del día y CTA. **El clic nunca espera la medición para abrir la app:** si el beacon se bloquea/falla, la navegación funciona y se registra una subcuenta no recuperable. Evitar duplicar handlers, no enviar URLs completas, no guardar eventos individuales, IP, cookies, fingerprints, tokens ni sesiones. Anti-bot y controles de abuso compatibles con privacidad; sin garantía de excluir absolutamente todo tráfico automático. Fuente técnica del beacon: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon .
- **C. Persistencia aislada:** una tabla mínima de agregados diarios `fecha + origen + cantidad` para clics, y `fecha + pageviews + visitantes_diarios_estimados + fecha_captura/estado` para las vistas. Reutilizar almacenamiento existente **solo si se autoriza explícitamente** una migración aislada en Supabase Staging/Production (preferir esquema/capas específicas de web, sin permisos directos del navegador). Si requiere tocar esquema protegido, cambiar arquitectura o contratar servicio, volver a decisión humana antes de avanzar. Secretos solo del servidor; nunca en código público.
- **D. Retención 90 días:** una tarea programada diaria server-side consulta la API de Vercel del **día anterior y eventualmente los días recientes** para actualizar/sobrescribir de manera idempotente los resúmenes diarios **antes** de vencer la ventana Hobby. No sumar snapshot contra snapshot. Si falla algún día, reintentar mientras esté dentro de la ventana y dejar estado de cobertura. Verificar API de visitas y plan antes de activarla.
- **E. Métricas:** futura pestaña **«Web»** dentro de Metrics, lectura agregada solo-admin de esa fuente aislada (sin exponer token Vercel ni conexión del navegador a datos brutos). 7/30/90, tendencia, salidas por CTA y relación claramente rotulada. **No implementarla en la etapa del lanzamiento de la web** si requiere intervenir el núcleo protegido de Metrics.

**Ruta futura condicionada:** si se verifica que el equipo ya tiene Vercel **Pro**, se puede simplificar el apartado B enviando eventos personalizados `app_outbound_click` con una propiedad `source` y consultar estos datos por la API de Vercel, sin contador propio. La decisión de arquitectura se confirma con el plan real antes de escribir código. No contratar Pro solo para analítica en esta etapa.

### Privacidad y salida

- Redactar aviso de privacidad **propio de `bramulab.com`**, enlazado visiblemente, aclarando proveedor Vercel, finalidades de conteo, categorías mínimas, datos temporales que el proveedor pueda procesar, plazo de consulta/retención, transferencias aplicables y derechos del visitante. La Política de la app y su consentimiento de actividad registrada NO cubren automáticamente esta web. Confirmar encuadre AAIP/local antes de activar; no afirmar exención de consentimiento por el solo hecho de no usar cookies.
- No vincular datos de web con cuentas de la app ni enviar identificadores a `app.bramulab.com`; no usar Google Analytics/píxeles publicitarios, perfiles ni seguimiento entre dominios.
- Tras aprobación: probar 1 visita, 1 CTA de cada origen, doble clic, navegador que bloquea beacon, período de datos y fallo controlado del contador en **Staging**; comprobar que el enlace directo a la app funciona incluso con analítica bloqueada. Después autorizar por separado el proyecto Vercel público y, de ser necesarias, las escrituras estrictamente acotadas en backend Production. Mantener contadores/producto sin datos fabricados.

**Decisiones antes de implementar (no exigirlas ahora):** (1) confirmar plan Vercel efectivo y acceso a la Web Analytics API; (2) autorizar ubicación aislada de agregados y cambios backend correspondientes; (3) aprobar aviso legal web. Este plan no crea cuenta con proveedores, ni escribe datos, ni habilita analítica, ni modifica las funciones existentes.
