# BRAMUlab — Bases de diseño web

**Versión:** 1.0  
**Fecha:** 11/10/2026, Argentina  
**Estado:** base de trabajo para diseño; propuestas de web pendientes de revisión visual de Sebastián.  
**Ubicación vigente:** `bramulab-web/docs/Bases_Diseno_Web.md` (repositorio).  
**Origen:** documento de diseño elaborado en Dropbox, `/Otros Trabajos/BRAMU/Sistema grafico/BRAMUlab-Bases-de-diseno-web.md`, pendiente de limpieza de copia anterior tras sincronizar la carpeta.

## 1. Para qué sirve

Traducir la identidad de BRAMUlab a criterios concretos para diseñar una web coherente, deportiva, clara y fácil de usar. Sirve a Sebastián y a los agentes que colaboren en diseño o implementación.

El PDF del manual explica la marca visualmente. Este MD agrega criterios de aplicación web, componentes, adaptación a pantallas y una estructura inicial propuesta. No es un rediseño de marca ni una especificación técnica aprobada.

**AGREGAR:** esta base al material de diseño.  
**FUSIONAR:** las decisiones finales aprobadas con la documentación maestra del sistema afectado cuando corresponda implementarlas.  
**NO TOCAR:** originales de Illustrator, SVG maestros, lógica deportiva, main, Production o BRAMUlive por el solo hecho de leer este archivo.

## 2. Fuentes y precedencia

La autoridad sigue en la documentación vigente del repositorio `sebastianvilaa/BRAMUlab`:

1. `docs/BRAMUlab/README.md`: entrada y mapa de fuentes.
2. `docs/BRAMUlab/Identidad_Visual/Identidad_Visual.md`: fuente maestra visual.
3. Documentos maestros de `Producto/`: qué hace realmente cada función.
4. SVG oficiales: autoridad de geometría y color de los assets.

Se revisaron README e Identidad Visual de **staging** el 11/10/2026. La identidad coincide con el material de marca compartido en este chat. No se realizó una auditoría funcional completa ni se verificó cada pantalla de la app para redactar esta base.

Este archivo es un **brief de diseño complementario**. No reemplaza fuentes maestras ni mantiene una copia del estado operativo del proyecto. Si una regla de marca o producto cambia, prevalece su fuente maestra vigente y se ajusta este brief.

El manual `BRAMUlab-Manual-de-marca-basico.pdf` es su referencia visual complementaria. Los posteos anteriores son exploraciones de comunicación, no una nueva autoridad de color o componentes.

## 3. Alcance y decisión abierta

**ALCANCE CERRADO (12/10/2026):** “web de BRAMUlab” significa la **single page pública** en `bramulab.com`, independiente del producto en `app.bramulab.com`. La estructura inicial de la sección 10 fue superada por el concepto y recorrido confirmados en [`BRAMUlab_Web.md`](BRAMUlab_Web.md). Las medidas de este brief siguen siendo propuestas de diseño, no especificaciones aprobadas. No autoriza reorganizar el interior de la app.

Dominios, plataforma de construcción, rutas y publicación no se deciden en este documento. El acceso conocido a la app es `https://app.bramulab.com`.

## 4. Objetivo y experiencia

BRAMUlab es una app para jugadores amateurs. Convierte partidos ya jugados en una historia deportiva propia: resultados, historial, Nivel BRAMU, grupos, compañeros, rivales y análisis.

**Concepto rector:** Donde vive tu pádel.

La experiencia debe sentirse deportiva, moderna, nocturna, personal y competitiva, con precisión y claridad. La tecnología acompaña al jugador.

En una web de presentación, el visitante debería entender rápidamente:

1. Qué es BRAMUlab.
2. Qué valor obtiene al cargar sus partidos.
3. Cómo empezar a usarla.

Priorizar la experiencia central y el interés de volver. No agregar planes pagos, publicidad, promesas comerciales o funciones avanzadas sin una decisión real de producto.

## 5. Identidad confirmada

### Marca y archivos

Nombre escrito: **BRAMUlab**. Claim: **Donde vive tu pádel.**

Los originales viven en:

`/Otros Trabajos/BRAMU/Sistema grafico/BRAMUlab-SistemaGrafico.ai`

SVG oficiales externos:

`/Otros Trabajos/BRAMU/Sistema grafico/Archivos/Marca/SVG/`

| Asset | Uso |
|---|---|
| `BRAMUlab-Logo.svg` | Logotipo completo; encabezado y comunicación principal. |
| `BRAMUlab-Isotipo.svg` | Símbolo independiente; usos donde la marca ya se reconoce. |
| `BRAMUlab-IconoApp.svg` | Iconos digitales de la aplicación; no sustituye automáticamente al isotipo. |

Conservar proporciones y colores. BRAMU es blanco `#FFFFFF`; lab es lima `#95FF19`. No reconstruir el logo con Inter ni agregar efectos, sombras pesadas o símbolos nuevos. No usar la variante azul ST de Staging como marca pública.

### Paleta principal

| Color | HEX | Función |
|---|---|---|
| Azul noche | `#050A12` | Fondo y atmósfera predominante. |
| Lima BRAMU | `#95FF19` | Foco principal, acción y dato relevante. |
| Azul eléctrico | `#199FFF` | Contrapunto, información y energía secundaria. |
| Blanco principal | `#F8FAFC` | Texto e información sobre oscuro. |

**Profundidad:** `#03070D`, `#050A12`, `#09131F`, `#0D1A2A`, `#112238`, `#152B43`.

**Apoyos:** lima profundo `#66B30F`, azul profundo `#0D6FCC`, texto secundario `#9AA7B5`, texto tenue `#687482`, bordes `#B7D3EB` generalmente a baja opacidad.

**Colores funcionales:** dorado `#FFC93D` para estados especiales/Punto de Oro; naranja `#FFA93D` para Star Point; coral `#FF5B61` para error o acción destructiva; verde `#2ECC71` para confirmación. No son acentos generales intercambiables ni colores para asignar arbitrariamente a cada sección.

### Tipografía

**Inter** en producto y comunicación. El logo conserva su geometría propia.

| Peso | Aplicación confirmada |
|---|---|
| 400–500 | Lectura y secundarios. |
| 600–700 | Interfaz general. |
| 700–800 | Títulos, etiquetas y botones. |
| 800–900 | Nivel, Ranking y números protagonistas. |

En Illustrator y SVG editables, preferir variantes estáticas y comprobar el estilo al abrir. En una futura implementación web, cargar y declarar explícitamente los pesos usados para evitar sustituciones y pesos simulados.

## 6. Traducción a diseño web — recomendaciones iniciales

Los valores de esta sección son **propuestas de partida**, no tokens verificados del código ni decisiones previamente aprobadas. Ajustarlos mediante diseño visual; si se trabaja sobre la app, revisar primero sus componentes y estilos existentes.

### Composición y ritmo

- Un mensaje principal por sección y una acción dominante cuando haga falta.
- Alternar fotografía, capturas reales, tipografía y datos; no repetir una tarjeta idéntica en todos los bloques.
- Conservar aire y contraste entre secciones. La profundidad surge de superficies y luz contenida.
- Dar protagonismo a la historia del jugador; evitar aspecto de dashboard empresarial.
- Evitar que la web parezca una pila de posteos: diseñar un recorrido continuo.

### Medidas de partida

| Recurso | Escritorio | Celular |
|---|---|---|
| Contenedor principal | Máximo orientativo 1200 px | Ancho disponible con márgenes de 20–24 px |
| Título hero | 56–72 px | 36–44 px |
| Título de sección | 32–40 px | 26–32 px |
| Texto de lectura | 16–18 px | 16–18 px |
| Espacio entre secciones | 80–112 px | 48–64 px |

Interlineado inicial: 1,1–1,2 en titulares y 1,45–1,6 en lectura. Líneas de texto cómodas; no extender párrafos a todo el ancho de escritorio.

Espaciado orientativo: 4, 8, 12, 16, 24, 32, 48, 64 y 96 px. Radios orientativos: controles 12 px, tarjetas 16 px, hero 18 px; chips con forma píldora. Adaptarlos a escala y contenido sin generar tarjetas excesivamente blandas.

### Color y lectura

- Botón principal propuesto: fondo lima y texto azul noche.
- Azul eléctrico como apoyo; evitar que varios colores pidan atención a la vez.
- No usar texto tenue para información esencial si pierde legibilidad.
- Verificar cada combinación de texto, fondo y tamaño en la composición real.
- Sobre foto, usar una zona limpia o un degradado oscuro localizado; no depender únicamente de una sombra del texto.

## 7. Componentes de partida — propuesta

| Componente | Criterio |
|---|---|
| Encabezado público | Logo oficial, navegación breve y acceso claro a la app. |
| Hero | Claim, explicación concreta, acción principal y una imagen con intención. |
| Botón principal | Verbo claro, contraste alto y estados reconocibles. |
| Acción secundaria | Menor protagonismo que la principal; vínculo o botón sobrio. |
| Bloque de beneficio | Un beneficio concreto, texto breve y evidencia visual cuando exista. |
| Captura de producto | Pantalla real, recorte legible y contexto de uso. |
| Dato protagonista | Dato real contextualizado; no una cifra decorativa que parezca de usuarios. |
| Ayuda / preguntas | Lenguaje simple, apertura y cierre claros, contenido legible. |
| Pie público | Marca, acceso a la app y enlaces legales vigentes. |

Documentar estados de los componentes que efectivamente se diseñen: normal, interacción, foco, deshabilitado y carga si aplica. No dibujar una biblioteca enorme antes de probar el recorrido principal.

En la app, conservar el significado de cada estado: sin datos, pendiente, confirmado, error y éxito. Un cero no siempre significa ausencia de datos. No transformar la falta de evidencia en una estadística ni en un insight.

## 8. Fotografía, capturas e iconografía

### Fotografías

Cancha real bajo iluminación artificial, contraste alto, sombras profundas y luz focal. Alternar cancha, jugadores y detalles según el contenido.

Revisar coherencia de red, accesos junto a los extremos de la red, vidrios, rejas, líneas y proporciones. Si hay una foto real adecuada, priorizarla sobre una cancha inventada.

Evitar filtros lima generales, cyberpunk, circuitos decorativos y neón aplicado a todo. Las referencias fotográficas compartidas orientan el clima; confirmar permisos de uso antes de elegir una imagen para publicación.

Material existente localizado en Dropbox:

- `Archivos/BRAMUlab-Inicio.png`
- `Archivos/BRAMUlab-Inicio-Desk.png`

Son candidatos visuales disponibles; no se inspeccionaron sus bytes en esta tarea y no se declaran aprobados para un nuevo uso web.

### Capturas de la app

Usar pantallas reales y vigentes. No redibujar la interfaz libremente ni fabricar datos que aparenten ser reales. Elegir recortes que se entiendan en celular. Evitar datos personales de terceros en material público sin autorización.

### Íconos

Lineales, precisos, geométricos y con terminaciones suaves. Mantener el mismo criterio de grosor y escala. Referencias deportivas abstractas cuando aporten significado. Sin escudos, coronas, rayos gratuitos o clichés de inteligencia artificial.

## 9. Adaptación, accesibilidad y movimiento — recomendaciones

- Diseñar el recorrido en celular desde el comienzo y ampliar a escritorio con intención.
- Reordenar bloques, cambiar encuadres y ajustar tipografía; no reducir todo proporcionalmente.
- Preservar la legibilidad de capturas y la visibilidad de la acción principal.
- Evitar scroll horizontal involuntario y superposición con barras fijas.
- No depender del hover ni exclusivamente del color para explicar una acción o un estado.
- Definir áreas táctiles cómodas; referencia inicial de diseño: 44–48 px para controles principales.
- Prever foco visible, lectura con teclado, etiquetas claras y contraste suficiente.
- Proponer movimiento breve y discreto. Respetar reducción de movimiento y evitar videos de fondo que dificulten leer.

Antes de implementar, comprobar la solución elegida en tamaños representativos. No abrir una batería de pruebas de backend por un cambio puramente de composición.

## 10. Web pública — estructura propuesta para revisar

Esta estructura es una recomendación de diseño. No es arquitectura aprobada ni una lista de funcionalidades verificadas pantalla por pantalla.

| Orden | Bloque | Qué debe lograr |
|---|---|---|
| 1 | Hero: “Donde vive tu pádel.” | Entender qué es BRAMUlab y encontrar cómo entrar. |
| 2 | “Cargá tus partidos.” | Mostrar cómo resultados, compañeros y rivales construyen un historial. |
| 3 | “Competí con tus amigos.” | Explicar el valor de compartir una competencia en grupos. |
| 4 | “Construí tu Nivel BRAMU.” | Explicar que el nivel es una estimación que evoluciona. |
| 5 | BRAMU Intelligence | Mostrar el valor de interpretar datos reales, con un ejemplo verificable si existe. |
| 6 | Cómo empezar / agregar al inicio | Llevar a la app y explicar la instalación según el dispositivo. |
| 7 | Preguntas breves y cierre | Resolver dudas esenciales y repetir la acción principal. |

Puede comenzar como una única página. Integrar o quitar bloques si el recorrido resulta largo. No incluir todos por obligación.

**Propuesta de acción principal:** “Empezá tu historia”, con destino a `https://app.bramulab.com`. Alternativa secundaria: “Ya tengo cuenta”, solo si aporta claridad y su destino está resuelto. No inventar rutas de registro o login.

Para instalar: usar una ayuda breve con instrucciones actuales verificadas antes de publicar. No prometer App Store o Google Play ni usar badges de descarga si no existe esa distribución.

## 11. Copy y veracidad

Voseo argentino, claridad y cercanía: “Cargá”, “Jugá”, “Construí”, “Competí”. Evitar tecnicismos y promesas grandilocuentes.

Mensajes disponibles para explorar:

- “Donde vive tu pádel.”
- “Cargá tus partidos. Construí tu historia.”
- “Jugá como siempre. BRAMU hace el resto.”
- “Tu nivel evoluciona con tus partidos.”

Reglas de significado:

- **Nivel BRAMU:** estimación dinámica de capacidad; no categoría oficial garantizada.
- **Ranking BRAMU:** posición competitiva dentro de un universo elegible; no sinónimo de Nivel. Su publicación vigente es semanal según el README consultado.
- **BRAMU Intelligence:** interpretación de datos que la app realmente registra. No prometer análisis de técnica, golpes o video sin evidencia de esa función.
- **BRAMUlab:** partidos ya jugados. El marcador y seguimiento en vivo pertenecen a BRAMUlive.

Antes de publicar un bloque, verificar sus afirmaciones contra la fuente maestra correspondiente. No comunicar un concepto simulado o futuro como una función activa. No inventar testimonios, cantidad de usuarios, porcentajes de mejora ni cifras de adopción.

## 12. Forma simple de avanzar

1. Confirmar el alcance pendiente de la sección 3.
2. Diseñar hero y un bloque de beneficio en celular y escritorio.
3. Revisar clima, jerarquía, claridad y color con Sebastián.
4. Extender el sistema aprobado al resto del recorrido.
5. Preparar assets, estilos y estados necesarios para implementación.

El usuario decide producto y evalúa el diseño. Los agentes absorben preparación técnica, adaptación y comprobaciones necesarias. No pedirle operaciones técnicas que una herramienta pueda resolver.

La implementación deberá reutilizar lo que funciona. Los cambios de la app nacen en staging; publicar o tocar Production requiere autorización expresa. Este brief no autoriza una publicación ni un rediseño funcional.

## 13. Criterio de revisión

Una propuesta está lista para revisión cuando:

- Se reconoce el universo BRAMU y utiliza el logo original.
- El lima tiene un motivo; azul y colores funcionales no compiten sin necesidad.
- Inter muestra los pesos correctos y el contenido se lee en celular.
- Existe una acción y un mensaje principal claros.
- Fotografía, capturas e información son creíbles y pertinentes.
- El recorrido explica la utilidad de BRAMU sin sobrecargarlo.
- Las propuestas y decisiones abiertas están diferenciadas de lo confirmado.

## 14. Registro y mantenimiento

**11/10/2026:** creación solicitada por Sebastián después de revisar favorablemente el manual básico PDF. Se agregó esta base de diseño, respetando la identidad maestra. Estructura pública, componentes y medidas quedan como recomendaciones iniciales. Alcance final abierto. No se modificaron marca, código, documentación maestra, main ni Production.

Actualizar este mismo archivo cuando se aprueben decisiones de diseño. No generar versiones paralelas del brief por cada revisión. Si cambia una regla maestra de marca o producto, registrar primero la decisión en su fuente correspondiente y ajustar luego esta aplicación web.

