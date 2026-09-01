# BRAMU Lab — Rama Jugador
## Etapa 1: contexto, análisis del proyecto y plan de integración

## Instrucción principal para Claude Code

Leé este documento completo y después inspeccioná el proyecto actual de BRAMU Lab en el repositorio.

**En esta etapa no programes ni modifiques ningún archivo.**

No implementes componentes, rutas, estilos, datos de prueba ni cambios de navegación. No hagas commits. El objetivo es que comprendas el contexto, analices lo que ya existe y devuelvas un plan de integración concreto. La implementación llegará en un segundo documento, después de revisar tu análisis.

No propongas una reescritura general ni un cambio de tecnología salvo que encuentres un impedimento real y verificable. La intención es preservar lo construido, reutilizarlo y sumar una nueva rama de experiencia dentro del mismo producto.

---

## 1. Qué es BRAMU Lab actualmente

BRAMU Lab es una aplicación de pádel en desarrollo. Nació como una herramienta para registrar un partido y transformar los datos registrados en una devolución útil al terminar.

El proyecto actual ya contiene una base funcional y visual valiosa. Entre otras cosas, puede incluir —según el estado actual del repositorio—:

- configuración de jugadores y equipos;
- distintos formatos y sistemas de puntuación;
- seguimiento de partidos;
- un modo de registro completo o punto por punto;
- modos de menor carga, como el registro por games;
- carga de partidos ya jugados;
- historial;
- resultado y resumen del partido;
- estadísticas;
- gráfico de evolución o dominio del partido;
- BRAMU Intelligence, que interpreta los datos disponibles;
- identidad visual, componentes, estilos CSS y comportamiento responsive ya trabajados.

Esta lista es contexto, no una descripción técnica autoritativa. Verificá en el repositorio qué existe realmente, cómo está resuelto y cuál es su estado actual.

### Aprendizaje principal de las pruebas

El seguimiento punto por punto puede producir estadísticas e interpretaciones profundas, pero exige demasiada atención durante un partido social. Por eso probablemente sea una modalidad especial para situaciones puntuales, no la forma habitual en que un jugador construya su historial.

Nada de lo anterior se descarta. El producto actual, sus resultados, estilos y formas de registrar partidos deben considerarse activos reutilizables.

---

## 2. El giro conceptual

BRAMU está ampliando su centro de gravedad. La nueva dirección se concentra primero en la experiencia personal del jugador, no en el espectador ni exclusivamente en el seguimiento en vivo.

El territorio conceptual que guía esta rama es:

> **BRAMU — Donde vive tu pádel.**

No es obligatorio tratar esta frase como claim definitivo o mostrarla todavía en la interfaz. Debe funcionar como principio de producto.

Otra idea interna importante es:

> **Cada partido suma a tu historia.**

La promesa principal empieza a ser construir, conservar y mostrar la historia de pádel de cada jugador.

### Loop principal propuesto

1. El jugador juega.
2. Registra el partido.
3. Su historia se actualiza.
4. Descubre cómo viene jugando, cómo evolucionó y qué relaciones o patrones aparecen.
5. Vuelve después del siguiente partido para seguir construyendo esa historia.

Registrar un partido es la causa. El Home del jugador muestra las consecuencias.

---

## 3. Qué debería construir esa historia

Con el tiempo, BRAMU debería poder organizar y mostrar:

- historial de partidos;
- resultados recientes;
- ranking o categoría;
- evolución;
- rachas;
- actividad por período;
- compañeros habituales;
- rendimiento con distintos compañeros;
- rivales frecuentes;
- enfrentamientos directos;
- mejores y peores períodos;
- hitos y tendencias del recorrido.

El valor no está solamente en comprender un partido aislado. Está en transformar muchos partidos dispersos en un recorrido personal que pueda verse, compararse y entenderse.

---

## 4. Rol de BRAMU Intelligence

BRAMU Intelligence no se elimina, pero deja de ser el loop central de esta nueva rama.

Su función debería ser leer la historia del jugador y comunicar patrones reales derivados de los datos disponibles. Por ejemplo:

- “Venís de ganar cuatro de tus últimos cinco partidos”.
- “Este fue tu mejor mes hasta ahora”.
- “Con este compañero conseguiste tu mejor porcentaje de victorias”.
- “Es el rival al que más enfrentaste”.
- “Venís jugando contra jugadores de mayor nivel”.

Una primera expresión posible dentro del Home es un módulo llamado provisionalmente **Tu momento**: un texto breve que responda “¿Cómo está mi pádel hoy?”.

BRAMU nunca debe inventar profundidad que los datos no permiten. Con resultados básicos puede describir recorrido, actividad, relaciones y tendencias. No puede diagnosticar fallas técnicas específicas —por ejemplo, una mala volea— si esa información nunca fue registrada.

El seguimiento punto por punto podrá aportar mayor profundidad cuando exista, pero no debe ser requisito para que la historia personal tenga valor.

---

## 5. Relación con el producto existente

Esta rama **no es otra aplicación, otro repositorio ni un reemplazo del BRAMU actual**.

Es una nueva experiencia dentro del mismo producto. Debe reutilizar, siempre que tenga sentido:

- identidad y marca BRAMU Lab;
- componentes existentes;
- estilos y variables CSS;
- tarjetas, botones y controles;
- resultados e historial;
- modelos o estructuras de datos ya disponibles;
- flujos de carga de partidos;
- pantallas de análisis y estadísticas;
- comportamiento mobile ya resuelto.

La conexión definitiva entre todas las modalidades todavía no está cerrada. Sin embargo, el concepto general es que distintas formas de registrar un partido puedan terminar alimentando una misma historia del jugador.

---

## 6. Primera beta que se quiere explorar

El usuario está lesionado y actualmente no puede jugar al pádel. La primera validación se hará en un único celular, utilizando partidos y jugadores ficticios para simular un recorrido real.

Esto permitirá evaluar:

- la jerarquía del Home;
- la claridad de los datos;
- el atractivo de los widgets;
- la fricción de cargar un partido;
- cómo cambia el valor de la experiencia al acumular partidos;
- si BRAMU consigue contar una historia y no solamente listar resultados.

En esta beta no es necesario resolver todavía:

- autenticación definitiva;
- backend social real;
- algoritmo final de ranking;
- validación de resultados entre usuarios;
- notificaciones reales;
- personalización o reordenamiento de widgets;
- integración definitiva entre todos los modos de registro;
- monetización.

Estos temas deben quedar contemplados como futuras extensiones, pero no bloquear la primera experiencia.

---

## 7. Acceso provisional desde el BRAMU actual

Como hipótesis de integración para la primera beta, se está considerando reemplazar provisionalmente el acceso **Historial** de la cabecera actual por **Mi perfil**.

Ese acceso llevaría al nuevo Home del jugador.

“Mi perfil” funciona como nombre inicial y no debe discutirse o reemplazarse en esta etapa salvo que exista una razón de UX importante. Más adelante podrían evaluarse nombres como “Mi BRAMU” o “Mi pádel”.

Dentro de la nueva experiencia, **Inicio** sería el Home del jugador. La pantalla que actualmente inicia o configura un partido no debería confundirse conceptualmente con ese Home; sería una pantalla de acción, como “Nuevo partido” o “Registrar partido”.

---

## 8. Navegación inferior propuesta

La hipótesis actual es una barra inferior con cinco posiciones:

1. **Inicio**
2. **Historial**
3. **+** — acción central destacada
4. **Ranking**
5. **Perfil**

El “+” sirve para registrar un partido. En una primera beta podría llevar directamente al flujo existente de carga de un partido jugado. Más adelante podría desplegar alternativas como:

- cargar un partido ya jugado;
- iniciar seguimiento en vivo;
- otras formas futuras de sumar actividad.

Las notificaciones se imaginan como una campana en la cabecera, no como uno de los destinos inferiores. En esta etapa no hace falta implementar notificaciones reales.

La navegación todavía es una hipótesis de producto. Analizá cómo podría integrarse sin romper los flujos existentes, pero no la implementes.

---

## 9. Primera arquitectura de información del Home

La pantalla todavía debe terminar de diseñarse, pero la jerarquía de contenido está bastante encaminada:

### 9.1 Identidad y estado del jugador

Una tarjeta principal podría mostrar:

- foto;
- nombre y apellido;
- ranking;
- categoría actual;
- tendencia o variación reciente.

### 9.2 Tu momento

Una tarjeta narrativa con un párrafo breve generado a partir del recorrido. Es BRAMU leyendo la historia del jugador, sin presentarse necesariamente como un chat o una función aislada de inteligencia artificial.

### 9.3 Forma reciente

Representación visual compacta de los últimos resultados. Por ejemplo, una secuencia de puntos o indicadores verdes y rojos.

### 9.4 Último partido

Tarjeta con:

- resultado;
- compañero;
- rivales;
- fecha u otra referencia temporal;
- acceso al detalle del partido.

### 9.5 Widgets personales

Posibles módulos futuros:

- actividad;
- racha;
- partidos del mes;
- compañeros;
- rivales;
- enfrentamientos;
- evolución;
- ranking;
- hitos o descubrimientos.

No deben aparecer todos necesariamente en la primera pantalla. La selección y jerarquía definitivas llegarán en el documento de implementación.

---

## 10. Lenguaje visual: “tarjetas pastilla”

El proyecto actual ya posee un lenguaje basado en superficies oscuras, bordes, radios, tarjetas y controles compactos. No se busca rediseñar toda la aplicación en esta etapa.

Internamente se está usando el nombre **tarjeta pastilla** para describir un componente visual flexible como el observado en las referencias:

- fondo oscuro;
- borde sutil;
- esquinas redondeadas;
- título corto;
- posible microetiqueta;
- ícono, indicador o pequeño gráfico;
- uno o dos datos protagonistas;
- poco texto y una jerarquía clara.

No todas las tarjetas deben tener el mismo tamaño. Se necesita jerarquía:

- tarjeta principal de identidad;
- tarjeta narrativa horizontal;
- tarjeta completa de partido;
- widgets pequeños de datos;
- gráficos más anchos cuando el contenido lo requiera.

La referencia visual principal es VIBERO por su organización, navegación, uso de widgets y presentación de datos. Padellog, PadelMob, Playtomic, DUPR y otras aplicaciones se toman principalmente como referencias funcionales o de estructura de datos. No se busca copiar interfaces literalmente.

BRAMU todavía no tiene una ejecución visual superior. La oportunidad es construirla progresivamente, reutilizando la base existente y dejando los componentes preparados para una afinación visual posterior. En la primera beta importan más la jerarquía, la coherencia y la utilidad que el pulido final.

---

## 11. Principios y restricciones que deben respetarse

1. No descartar ni romper el producto existente.
2. No crear una segunda aplicación ni un segundo repositorio.
3. No reescribir el proyecto sin una causa técnica real.
4. Reutilizar componentes, estilos y estructuras existentes siempre que sea razonable.
5. Mantener una experiencia mobile-first.
6. Tratar esta primera versión como beta y permitir datos ficticios.
7. Priorizar la experiencia del jugador y el valor acumulado de su historia.
8. No convertir el registro de un partido en el protagonista visual del Home.
9. El “+” representa la causa; el Home muestra las consecuencias.
10. No inventar información en BRAMU Intelligence.
11. No resolver ahora ranking, validaciones, comunidad, personalización o monetización.
12. No copiar visualmente a VIBERO ni a otro competidor.

---

## 12. Análisis solicitado

Después de leer este documento, inspeccioná el repositorio completo y devolvé un informe con la siguiente estructura:

### A. Resumen ejecutivo

Explicá en pocas líneas cómo entendés el giro de producto y cómo podría convivir con el BRAMU actual.

### B. Estado real del proyecto

Identificá:

- framework y organización general;
- pantallas o vistas actuales;
- navegación existente;
- componentes reutilizables;
- sistema de estilos y variables;
- almacenamiento y estructuras de datos;
- historial y carga de partidos;
- lógica relacionada con jugadores, resultados, estadísticas e Intelligence;
- comportamiento responsive/mobile.

No te limites a repetir este documento: contrastalo con el código real.

### C. Qué puede reutilizarse

Enumerá concretamente qué componentes, estilos, flujos y datos existentes podrían utilizarse para construir la Rama Jugador.

### D. Propuesta de integración

Proponé cómo sumar esta experiencia dentro del mismo producto con el menor impacto posible. Incluí:

- posible ubicación de la nueva vista o ruta;
- forma provisional de acceder mediante “Mi perfil”;
- convivencia entre la navegación existente y la nueva barra inferior;
- relación posible entre el “+” y los flujos actuales de carga;
- estrategia para utilizar datos ficticios sin comprometer la futura conexión con datos reales.

No escribas código.

### E. Plan incremental sugerido

Dividí la primera implementación en pasos pequeños, comprobables y reversibles. El primer objetivo será ver el Home funcionando en un celular con datos ficticios, no completar todo el ecosistema.

### F. Riesgos y decisiones técnicas

Señalá:

- posibles conflictos con la arquitectura actual;
- deuda técnica que pueda afectar esta rama;
- datos o componentes que hoy estén demasiado acoplados al seguimiento en vivo;
- riesgos de duplicación;
- cualquier decisión que convenga tomar antes de implementar.

### G. Preguntas o bloqueos

Preguntá solamente aquello que sea necesario para preparar una implementación segura. No abras debates sobre ranking, monetización o funciones futuras que no afectan el primer Home.

---

## 13. Entrega esperada en esta etapa

Entregá únicamente el análisis y el plan.

**No programes. No modifiques archivos. No hagas commits. No implementes todavía el Home.**

Después de revisar tu respuesta se preparará el documento:

`BRAMU_Rama_Jugador_Etapa_2_Home_Beta.md`

Ese segundo documento contendrá la especificación visual y funcional exacta para la primera implementación.
