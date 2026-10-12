# BRAMUlab Web — concepto y recorrido público

**Estado:** concepto y jerarquía narrativa aprobados por Sebastián; pendiente diseño visual y revisión de textos finales.  
**Fecha de consolidación:** 12/10/2026 (Argentina).  
**Ámbito:** futura web pública en `bramulab.com`, distinta de la app en `app.bramulab.com`.  
**Rama de trabajo documental:** `staging`.

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
