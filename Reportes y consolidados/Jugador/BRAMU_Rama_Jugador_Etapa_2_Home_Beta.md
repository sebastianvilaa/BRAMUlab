# BRAMU Lab — Rama Jugador
## Etapa 2: implementación del primer Home beta

## Instrucción principal para Claude Code

Leé completos, en este orden:

1. `BRAMU_Rama_Jugador_Etapa_1_Contexto.md`
2. `BRAMU_Rama_Jugador_Etapa_1_Analisis.md`
3. este documento.

Esta etapa **sí autoriza la implementación**, pero únicamente dentro del alcance definido acá.

Antes de modificar archivos, resumí en pocas líneas el plan concreto que vas a ejecutar. Después implementalo sin esperar una aprobación adicional, salvo que aparezca un bloqueo real o una contradicción importante con el repositorio.

No reescribas el proyecto, no cambies de framework, no agregues backend y no avances sobre funciones futuras que no estén incluidas en este documento.

---

## 1. Objetivo de esta etapa

Construir una primera versión funcional del **Home del jugador** dentro del BRAMU Lab actual.

Debe poder abrirse desde la pantalla inicial existente, funcionar en un celular y mostrar la historia de un jugador utilizando los partidos que ya existen en `localStorage`, aunque sean partidos ficticios cargados para esta beta.

El principio de producto es:

> **BRAMU — Donde vive tu pádel.**

Y la separación central es:

> Registrar un partido es la causa. El Home muestra las consecuencias.

El objetivo de esta etapa no es completar el ecosistema. Es obtener una primera experiencia visible y comprobable para iterar su UX.

---

## 2. Decisiones cerradas después del análisis

Estas decisiones no necesitan volver a consultarse:

1. La Rama Jugador se implementa dentro de la aplicación y el repositorio actuales.
2. Durante esta beta, la aplicación sigue abriendo en la pantalla actual de configuración de partido (`view-setup`).
3. El acceso **Historial** no se elimina ni se reemplaza.
4. La cabecera actual se reorganiza mediante un menú desplegable compacto que reúna **Mi pádel**, **Historial** y **Modo de registro**.
5. **Mi pádel** abre el nuevo Home del jugador.
6. **Modo de registro** conserva la lógica existente para elegir **Completo** o **Por Games**; no crear un segundo selector ni duplicar su estado.
7. El Historial continúa accesible tanto desde ese menú como desde la nueva navegación inferior.
8. El jugador actual se define una sola vez mediante un input simple de nombre.
9. Ese input debe reutilizar, como sugerencias o autocompletado, la lista de jugadores conocidos que ya existe. No obligar a elegir uno: también debe poder escribirse un nombre nuevo.
10. El nombre se normaliza con el mismo criterio existente y se persiste localmente con una clave versionada, por ejemplo `padellab.currentPlayerName.v1`.
11. En esta beta, la identidad entre partidos se resuelve por coincidencia de nombre normalizado. Es deuda deliberada y no debe convertirse ahora en un sistema de cuentas.
12. El botón central **+** lleva directamente al flujo existente de **Cargar partido jugado**.
13. La posibilidad futura de elegir entre “Cargar partido” e “Iniciar seguimiento en vivo” queda fuera de esta etapa.
14. La campana de notificaciones se ubica arriba y no ocupa un destino de la barra inferior.
15. La personalización y el reordenamiento de widgets quedan fuera de esta etapa.

---

## 3. Alcance funcional

### 3.1 Acceso desde la pantalla actual

En el header de `view-setup`, conservar el wordmark y reorganizar los accesos actuales mediante un menú desplegable compacto, reutilizando preferentemente los patrones `overlay`/`menu-sheet` ya existentes.

El menú debe incluir:

- **Mi pádel:** abre `view-player-home`;
- **Historial:** abre la vista existente de Historial;
- **Modo de registro:** muestra el valor actual y permite elegir **Completo** o **Por Games** mediante la lógica que ya existe.

No llamar “Modo jugador” a la nueva experiencia en esta etapa, para no confundirla con Completo/Por Games. El nombre provisional de navegación es **Mi pádel**.

El modo de registro actual debe seguir siendo reconocible antes de iniciar un partido. El menú no debe ocultar de manera confusa si se está en Completo o Por Games.

No duplicar el selector de modo, su estado ni sus handlers. No modificar destructivamente el Historial ni el resto del flujo actual.

### 3.2 Primera identificación del jugador

Al entrar por primera vez a **Mi pádel**, si todavía no existe un jugador actual:

- mostrar una instancia simple y coherente con los overlays/sheets existentes;
- título sugerido: **¿Quién sos?**;
- texto breve: **Elegí tu nombre para encontrar tus partidos y empezar a construir tu historia.**;
- input de nombre con sugerencias provenientes de los jugadores conocidos;
- acción principal: **Continuar**;
- validar que el nombre no quede vacío;
- normalizar y guardar el nombre;
- renderizar el Home después de confirmar.

No crear registro, contraseña, email, avatar obligatorio ni onboarding extenso.

Debe existir una forma sencilla de cambiar el jugador actual desde la vista mínima de Perfil o desde la tarjeta de identidad, sin borrar partidos.

### 3.3 Fuente de datos

Usar `Store.loadHistory()` como fuente única de partidos.

Para el Home del jugador:

- filtrar los partidos donde el nombre normalizado del jugador actual aparezca dentro de `players[]`;
- ordenar por fecha del partido, del más reciente al más antiguo;
- utilizar solamente datos realmente presentes en cada entrada;
- respetar las diferencias entre `complete`, `games` y `manual`;
- no fabricar estadísticas que requieran eventos punto por punto cuando el partido no los tenga.

No crear un segundo historial ni duplicar partidos en otra clave de almacenamiento.

---

## 4. Navegación de la Rama Jugador

Crear una barra inferior fija y mobile-first con cinco posiciones:

1. **Inicio**
2. **Historial**
3. **+** — acción central destacada
4. **Ranking**
5. **Perfil**

### Comportamiento en esta beta

- **Inicio:** abre `view-player-home`.
- **Historial:** abre el Historial existente. En esta primera beta puede mantener su funcionamiento global actual; no rehacer todavía toda esa vista. Asegurar que exista un camino claro para volver al Home del jugador.
- **+:** abre directamente `view-manual-load`.
- **Ranking:** abre una vista placeholder coherente y explícita, no un botón muerto.
- **Perfil:** abre una vista mínima que muestra el nombre actual y permite cambiarlo.

La barra debe:

- mostrar estado activo;
- respetar `safe-area`;
- no aparecer durante el seguimiento de un partido ni competir con `control-bar`;
- no tapar contenido;
- utilizar iconos simples sin agregar una librería pesada;
- reutilizar la paleta y las variables existentes.

El botón **+** debe ser el elemento central destacado. Usar el color de acción ya existente en BRAMU; no introducir una nueva paleta.

En el Home del jugador, el wordmark o un control claro del header debe permitir volver a `view-setup`, para que la nueva rama no deje al usuario atrapado.

---

## 5. Header del Home

El nuevo Home debe tener una cabecera compacta con:

- wordmark BRAMU Lab o continuidad clara de la marca existente;
- campana de notificaciones a la derecha;
- correcta separación del notch/safe-area.

La campana no necesita notificaciones reales. Al tocarla debe abrir un pequeño estado vacío usando un overlay o sheet existente:

> **Todavía no tenés notificaciones.**

No dejar un control visible sin respuesta.

---

## 6. Arquitectura del Home

El Home se construye como una columna de **tarjetas pastilla** con una jerarquía clara. No mostrar todo con el mismo peso.

Orden inicial:

1. Tarjeta de identidad y estado.
2. Tu momento.
3. Forma reciente.
4. Último partido.
5. Primer grupo de widgets personales.

### 6.1 Tarjeta de identidad y estado

Debe incluir:

- avatar simple con iniciales, sin implementar carga de foto todavía;
- nombre del jugador actual;
- categoría actual;
- posición de ranking;
- tendencia reciente.

El ranking, la categoría y la tendencia todavía no existen en el modelo. Para poder evaluar visualmente la tarjeta en esta beta:

- utilizar valores de demostración centralizados y fáciles de reemplazar;
- marcarlos discretamente como **BETA** o **DEMO**;
- no calcularlos a partir de una fórmula improvisada;
- no presentarlos como una lógica definitiva.

Ejemplo solamente orientativo:

- categoría: `5ª`;
- ranking: `#12`;
- tendencia: `↑ 3`.

No hardcodear estos valores dispersos en el DOM. Deben estar centralizados como datos temporales de perfil.

### 6.2 Tu momento

Tarjeta narrativa con:

- título: **TU MOMENTO**;
- microetiqueta posible: **BRAMU LEE TU HISTORIA**;
- un ícono o pequeño indicador visual;
- un párrafo breve.

No usar una API de inteligencia artificial en esta etapa. Construir el texto de manera determinística con los datos disponibles.

Estados mínimos:

- **Sin partidos:** “Tu historia empieza acá. Cargá tu primer partido para empezar a descubrir tu pádel.”
- **Uno o dos partidos:** reconocer que la historia empezó y mencionar la actividad sin extraer conclusiones fuertes.
- **Tres o más partidos:** combinar como máximo dos datos útiles, por ejemplo partidos del mes, victorias en los últimos cinco o compañero más frecuente.

Ejemplo:

> Venís de ganar cuatro de tus últimos cinco partidos. Martín es el compañero con el que más jugaste este mes.

Reglas:

- nunca inventar;
- evitar textos largos;
- no insistir negativamente sobre derrotas;
- si no existe un patrón valioso, priorizar actividad, constancia o acumulación de historia;
- no repetir tres widgets completos dentro del párrafo.

### 6.3 Forma reciente

Mostrar hasta los últimos cinco partidos mediante indicadores compactos:

- victoria: verde/lima;
- derrota: rojo semántico o tono equivalente claramente distinguible;
- partido sin definición válida: neutro.

Agregar texto accesible o etiquetas para que el color no sea la única forma de interpretar el resultado.

La tarjeta debe mostrar también un resumen corto, por ejemplo `3 victorias en los últimos 5`, cuando los datos lo permitan.

### 6.4 Último partido

Si existe un partido reciente del jugador, mostrar:

- resultado completo por sets;
- estado victoria/derrota;
- compañero;
- rivales;
- fecha o referencia temporal;
- modo de registro si aporta contexto;
- acción para abrir el detalle existente del partido, siempre que pueda reutilizarse sin duplicar lógica.

Si no hay partidos, mostrar un estado vacío y una acción clara para cargar el primero.

No mostrar estadísticas punto por punto en un partido manual.

### 6.5 Primeros widgets personales

Implementar inicialmente cuatro widgets pequeños, derivados del historial filtrado:

1. **Partidos este mes**
2. **Mejor racha de victorias**
3. **Compañero más frecuente**
4. **Rival más enfrentado**

Reglas:

- si no hay datos suficientes, mostrar `—` y un microtexto honesto;
- no rellenar con números simulados;
- usar singular/plural correctamente;
- evitar porcentajes con muestras demasiado pequeñas;
- no implementar todavía el gráfico de Evolución histórica;
- no implementar personalización, ocultamiento ni reordenamiento.

---

## 7. Lenguaje visual: tarjeta pastilla

Tomar como base el sistema visual existente y la referencia conceptual ya compartida.

Una tarjeta pastilla puede combinar:

- superficie oscura;
- borde sutil;
- radio coherente con BRAMU;
- título corto;
- microetiqueta;
- ícono, sparkline o indicador pequeño;
- uno o dos valores protagonistas;
- poco texto;
- separación clara entre niveles de información.

Reutilizar:

- variables CSS actuales;
- Manrope y Oswald;
- colores existentes;
- radios, sombras y bordes;
- patrones de `summary-card`, `history-item`, `option-pill`, overlays y sheets cuando corresponda.

No copiar literalmente VIBERO. Su valor como referencia es la jerarquía, el uso de widgets, los títulos con iconos y la presentación compacta de datos.

No hacer todavía una refinación visual completa de BRAMU. La prioridad es que la pantalla sea coherente, clara, responsive y fácil de iterar.

---

## 8. Arquitectura y organización del código

Preservar la arquitectura actual y mantener los cambios acotados.

Sin embargo, `app.js` ya tiene aproximadamente 4.900 líneas. No agregar automáticamente toda la lógica de agregación histórica dentro de ese archivo.

Preferencia:

- aislar las funciones puras de la Rama Jugador —filtrado, forma reciente, rachas, compañero y rival— en un módulo pequeño compatible con el patrón IIFE actual, por ejemplo `player-home.js` exponiendo un único objeto global;
- dejar en `app.js` solamente la orquestación DOM, navegación e integración necesarias;
- agregar los estilos en una sección claramente delimitada de `styles.css`;
- no crear un framework paralelo, un store duplicado ni una arquitectura nueva.

Si después de inspeccionar las dependencias considerás más seguro otro reparto mínimo, explicalo en el informe final. No uses esta preferencia como excusa para una refactorización amplia.

Si se agrega un asset o script:

- incorporarlo correctamente en `index.html`;
- revisar y actualizar el service worker/cache para evitar que el celular cargue una versión anterior;
- mantener el orden correcto de dependencias.

---

## 9. Estados que deben funcionar

Verificar al menos:

1. Primera entrada sin jugador actual.
2. Jugador actual sin partidos.
3. Jugador con uno o dos partidos.
4. Jugador con cinco o más partidos.
5. Historial con partidos `manual`, `games` y `complete` mezclados.
6. Cambio de jugador actual.
7. Recarga de la aplicación conservando el jugador.
8. Apertura desde un celular instalado o en modo standalone/PWA.

No hace falta crear automáticamente una base de 20 o 30 partidos demo. El usuario cargará partidos ficticios mediante el flujo existente. No agregar un botón que ensucie el historial con datos demo en esta etapa.

---

## 10. Fuera de alcance

No implementar ahora:

- login, contraseña o cuentas reales;
- backend;
- IDs persistentes de jugadores entre dispositivos;
- validación de resultados;
- algoritmo de ranking;
- ranking real;
- grupos o comunidad;
- feed social;
- notificaciones reales;
- foto de perfil real;
- edición/reordenamiento de widgets;
- gráfico histórico de evolución;
- coach técnico;
- cambios profundos en BRAMU Intelligence;
- menú de alternativas detrás del `+`;
- rediseño integral del producto existente;
- cambios al motor de puntuación.

---

## 11. Criterios de aceptación

La etapa está completa cuando:

1. BRAMU sigue abriendo y funcionando como antes.
2. El header actual permite abrir un menú compacto con **Mi pádel**, **Historial** y el selector existente de **Modo de registro**.
3. Al entrar por primera vez se puede elegir o escribir el nombre del jugador.
4. El nombre queda persistido después de recargar.
5. El nuevo Home funciona en mobile y no rompe safe-areas.
6. La tarjeta de identidad se ve completa y distingue claramente sus valores demo.
7. Tu momento cambia honestamente según los partidos disponibles.
8. Forma reciente muestra correctamente victorias y derrotas del jugador actual.
9. Último partido identifica compañero, rivales, resultado y fecha.
10. Los cuatro widgets calculan datos del historial filtrado.
11. La barra inferior funciona, tiene estado activo y no aparece durante el partido en vivo.
12. El `+` abre **Cargar partido jugado**.
13. Ranking y Perfil no son botones muertos.
14. La campana responde con un estado vacío.
15. El flujo actual de partido, resumen, análisis, historial y carga manual continúa funcionando.
16. La PWA no queda sirviendo assets viejos por caché.

---

## 12. Verificación solicitada

Antes de terminar:

- ejecutar los tests existentes;
- agregar tests unitarios para las funciones puras de agregación histórica si el harness actual permite cargarlas sin forzar una refactorización;
- verificar manualmente los estados principales en viewport mobile;
- comprobar que el contenido no quede tapado por la barra inferior;
- probar el regreso desde la Rama Jugador a la pantalla actual;
- probar Historial y Cargar partido jugado desde la nueva navegación;
- revisar consola por errores;
- comprobar recarga y persistencia local;
- verificar que el service worker entregue la versión nueva.

---

## 13. Entrega esperada

Al terminar, devolvé un informe con:

1. resumen de lo implementado;
2. archivos creados y modificados;
3. decisiones técnicas tomadas;
4. tests ejecutados y resultados;
5. verificación manual realizada;
6. limitaciones conocidas;
7. pasos exactos para que el usuario lo pruebe en su celular;
8. capturas o descripción precisa de las pantallas resultantes, si tu entorno lo permite.

No avances por tu cuenta hacia ranking real, autenticación, comunidad u otras etapas futuras.
