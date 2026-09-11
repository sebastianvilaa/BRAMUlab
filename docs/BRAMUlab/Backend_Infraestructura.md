# BRAMUlab V04.0 — Consolidado maestro para usuarios reales e infraestructura

**Estado:** definición de producto y arquitectura. No implementar todavía.  
**Objetivo:** pasar del prototipo local V03 a una primera versión real de BRAMU, con usuarios, acceso, perfiles y partidos compartidos, manteniendo una infraestructura sencilla y sin costo durante el piloto.

> Este documento es la fuente maestra de decisiones. Cuando comience la implementación, no debe entregarse a Claude Code como una única tarea gigante. Debe dividirse en bloques pequeños de trabajo y validación.

## 1. Punto de partida confirmado

La versión actual de BRAMUlab es una aplicación web instalable (PWA) hecha con HTML, CSS y JavaScript, publicada mediante GitHub Pages.

- URL actual: `https://sebastianvilaa.github.io/BRAMUlab/bramulab/`
- La información vive hoy en `localStorage`, es decir, dentro de cada navegador o dispositivo.
- Los usuarios, contraseñas, sesiones y partidos actuales son simulaciones locales.
- Los flujos de UX de registro, ingreso, recuperación de contraseña y perfil ya fueron diseñados y probados como experiencia.
- Los partidos actuales son de prueba. No hay que migrar ningún usuario ni partido a la versión real.
- La V03 pública debe seguir funcionando mientras la V04 se construye y prueba por separado.

## 2. Glosario mínimo, en lenguaje simple

| Término | Qué significa para BRAMU |
|---|---|
| GitHub | El lugar donde se guarda el código del proyecto y se registran sus cambios. Se conserva como hasta ahora. |
| GitHub Pages | El servicio que publica actualmente la V03. La V03 se conserva allí mientras se construye la nueva versión. |
| Vercel | El servicio recomendado para publicar la V04 con usuarios reales. Toma el código desde GitHub y publica automáticamente cada cambio aprobado. |
| PWA | Una página web que también puede instalarse en el teléfono como si fuera una app. No requiere App Store ni Google Play. |
| Supabase | El servicio en internet que guardará usuarios, perfiles y partidos reales. También manejará el acceso y los permisos. |
| Base de datos / Postgres | Las tablas donde quedará guardada la información, como una planilla muy organizada que relaciona usuarios y partidos. |
| Auth | El sistema de registro, ingreso, cierre de sesión y recuperación de contraseña. |
| RLS | Las reglas de seguridad que determinan qué datos puede ver o modificar cada usuario. Por ejemplo, impiden que cualquiera edite un partido ajeno. |
| SMTP | El servicio que efectivamente envía los correos de acceso o recuperación. Supabase prepara el mensaje, pero para usuarios reales necesita un remitente adecuado. |
| OTP | Un código de un solo uso. En BRAMU será el código de seis dígitos que llega por correo. |
| Sincronización | Enviar al servidor un partido guardado provisoriamente en el dispositivo cuando vuelve la conexión. |

## 3. Decisiones de producto confirmadas

### 3.1 Piloto y costos

- El piloto será de aproximadamente 100 usuarios como máximo inicial.
- El requisito es costo cero mientras exista una alternativa razonable y segura.
- No se comprará dominio durante el piloto.
- Si en el futuro aparece un costo pequeño inevitable, debe consultarse antes de contratar o pagar nada.
- La app seguirá siendo una web app/PWA; no se publicará todavía en App Store ni Google Play.

### 3.2 Publicación

- GitHub se conserva como lugar del código y del historial del proyecto.
- GitHub Pages se conserva para la V03 actual mientras se desarrolla y prueba la V04.
- Para la V04 con usuarios y contraseñas reales se recomienda **Vercel**, conectado al mismo repositorio de GitHub.
- La razón es de adecuación y seguridad: la documentación de GitHub Pages advierte que no está pensado para sitios que manejan operaciones sensibles como el envío de contraseñas. Vercel está orientado a publicar aplicaciones web y despliega automáticamente cada cambio enviado a GitHub.
- El flujo de trabajo no cambia en lo esencial: Claude Code modifica el proyecto, se guarda en GitHub y Vercel publica la versión correspondiente.
- Vercel ofrece un plan Hobby gratuito para proyectos personales y no comerciales. Es adecuado para este piloto sin monetización; si BRAMU pasa a ser comercial, habrá que revisar el plan antes de continuar.
- Durante el piloto se utilizará la dirección gratuita asignada por Vercel.
- Un dominio propio podrá agregarse más adelante: funcionará como una dirección más fácil de recordar apuntando a la misma aplicación. No hace falta construir un “proxy”. Comprar el dominio es un costo separado y queda postergado.

### 3.3 Identidad y perfiles

Cada persona real tendrá:

- un identificador técnico interno único, que el sistema administra y el usuario no necesita conocer;
- un `@usuario` único elegido para ser encontrado;
- un nombre para mostrar;
- nombre real;
- apellido real;
- correo privado utilizado para autenticación y recuperación.

Son públicos y buscables:

- `@usuario`;
- nombre para mostrar;
- nombre real;
- apellido real.

El correo electrónico no es público ni debe utilizarse como dato de búsqueda entre jugadores.

Al abrir el perfil de otra persona podrán mostrarse su nombre y apellido reales, además de los datos deportivos que BRAMU defina como públicos.

La pantalla “perfil visto por otro jugador” puede diseñarse y probarse antes del backend, utilizando un amigo simulado y datos locales. Una vez validada visualmente, la infraestructura solo reemplazará esos datos simulados por datos reales, sin tener que rediseñar la pantalla.

### 3.4 Acceso y recuperación

- El registro y el ingreso serán reales, no simulados localmente.
- Las contraseñas serán gestionadas por Supabase Auth. BRAMU nunca debe guardar contraseñas en `localStorage` ni en tablas propias.
- La recuperación de contraseña enviará al correo un código aleatorio de seis dígitos y de un solo uso.
- Vigencia inicial: **60 minutos**. Es la duración predeterminada actual de Supabase para códigos y enlaces de correo, resulta más cómoda que 30 minutos y sigue siendo razonable para recuperación de cuenta.
- Deben existir límites de reintentos y de cantidad de correos para evitar abuso.
- Los mensajes de error no deben revelar si una dirección pertenece o no a una cuenta.

### 3.5 Datos iniciales

- La V04 real comienza vacía.
- No se importan usuarios, contraseñas, sesiones ni partidos de V03.
- Al entrar por primera vez, cada persona crea su cuenta real desde cero.

### 3.6 Usuarios de prueba

Se necesitan al menos diez usuarios de prueba permanentes para probar distintos casos sin crear casillas de correo falsas.

Decisión recomendada:

- usar un entorno de pruebas separado del entorno real;
- crear allí `Test 01` a `Test 10` mediante una herramienta privada de preparación;
- esas cuentas quedan confirmadas sin enviar correos;
- no existen en la app real ni aparecen en búsquedas, historiales o rankings reales;
- las claves administrativas que permiten crearlas nunca se incluyen en el código público de la web.

Supabase permite actualmente dos proyectos en su plan gratuito. La propuesta es utilizar uno para pruebas y otro para el piloto real, siempre que las condiciones continúen vigentes al momento de configurarlos.

## 4. Partidos, jugadores e historial

### 4.1 Una sola fuente compartida

Un partido real debe existir una sola vez en la base de datos. Cada jugador asociado ve ese mismo partido desde su historial, en vez de tener copias independientes en cada teléfono.

BRAMU modelará el pádel como un deporte de dobles: dos parejas y hasta cuatro jugadores. No se contempla una modalidad individual de singles.

El sistema debe distinguir:

- quién cargó el partido;
- quiénes participaron;
- si cada participante es un usuario registrado o un invitado sin cuenta;
- qué participantes deben validar el resultado;
- qué estado de validación tiene el partido.

### 4.2 Invitados

- Se puede guardar un jugador invitado mediante un nombre escrito.
- Puede haber uno o varios invitados dentro de un partido.
- Un invitado no se asocia automáticamente a una cuenta futura aunque el nombre coincida.
- Una asociación posterior requerirá una acción explícita y un flujo específico todavía no incluido en el piloto.

### 4.3 Validación del partido

Para los partidos que deban ser oficiales:

- si un participante carga el resultado, queda pendiente de confirmación del rival;
- alcanza la confirmación de **un solo rival registrado** para validar el resultado;
- la persona que cargó el partido no puede confirmarse a sí misma y su compañero no reemplaza la confirmación rival;
- si se modifica un resultado ya enviado, vuelve a quedar pendiente;
- si el rival no está de acuerdo, puede quedar en estado disputado;
- los partidos observados por un espectador no afectan ranking ni métricas oficiales;
- solo los partidos validados podrán alimentar el Ranking BRAMU en el futuro.

Si la única persona con cuenta es quien carga el partido, puede guardarlo y verlo en su historial, pero queda pendiente y no oficial porque todavía no existe un rival registrado que pueda confirmarlo. La forma de vincular más adelante a uno de esos invitados deberá ser explícita y coordinada con las reglas definitivas del Ranking BRAMU.

### 4.4 Eliminación y ocultamiento

No se permite que una persona elimine unilateralmente un partido compartido.

Flujo definido:

1. Un participante solicita eliminar el partido y explica, si corresponde, que fue cargado por error.
2. El otro participante o la contraparte requerida recibe la solicitud.
3. Si confirma, el partido se elimina o anula para todos de forma controlada.
4. Si no confirma, el partido permanece.

Por separado, cada usuario puede **ocultar** un partido únicamente de su propio historial. Ocultarlo no modifica ni borra el partido para los demás y no altera por sí mismo su validez deportiva.

Por seguridad y trazabilidad, durante el piloto conviene implementar la eliminación global como anulación lógica: el registro queda marcado como anulado y deja de mostrarse o computarse, pero puede auditarse si hay un problema.

### 4.5 Notas privadas

Si existe una nota privada sobre un partido, debe pertenecer al usuario que la escribió. No puede formar parte del contenido compartido visible para los otros jugadores.

### 4.6 Conexión inestable

- Si no hay conexión al terminar un partido, la app guarda localmente una copia pendiente.
- Cuando vuelve internet, reintenta enviarla.
- Debe mostrarse claramente si el partido está “pendiente de sincronizar”, “sincronizado” o tiene un error.
- El sistema debe evitar crear dos partidos iguales por reintentar el envío.
- La pantalla del partido en curso debe conservarse localmente para no perder el tanteo ante un cierre o una caída de conexión.

## 5. Dependencias con el Ranking BRAMU

La fórmula definitiva se está trabajando por separado y no debe bloquear esta infraestructura. Sin embargo, los datos deben quedar preparados para usarla después.

Decisiones ya existentes que condicionan el modelo:

- el Nivel BRAMU pertenece a la persona, no a la pareja;
- el resultado de dobles es grupal, pero una futura variación de nivel será individual;
- solo cuentan partidos oficiales y validados;
- se contemplan cinco partidos de calibración;
- la escala será tipo UTR: un número más alto representa mejor nivel;
- el cálculo puede conservar cuatro decimales internos y mostrar dos;
- la variación podría calcularse por períodos de quince días y no necesariamente después de cada partido;
- los partidos mixtos se conservan, pero inicialmente no entran en rankings separados por género;
- la posición depende de categoría y territorio, mientras que el nivel es individual.

No se implementa todavía:

- la fórmula final;
- una tabla materializada de ranking;
- puntos, premios o gamificación;
- relaciones de amistad o grupos;
- notificaciones completas;
- el reclamo automático de jugadores invitados.

Sí debe guardarse desde el inicio:

- identidad estable de cada participante;
- modalidad y formato;
- fecha, zona horaria y estado del partido;
- sets y resultado;
- ganador;
- condición de participante, invitado u observador;
- validaciones y disputas;
- revisiones o anulaciones;
- una versión del formato de datos, para poder evolucionarlo.

## 6. Arquitectura mínima recomendada

### Se conserva

- la aplicación actual en HTML, CSS y JavaScript;
- el motor de partido y la interfaz que ya funcionan;
- la posibilidad de instalarla como PWA;
- GitHub como repositorio del proyecto;
- GitHub Pages para mantener disponible la V03 durante la transición;
- el flujo de implementación con Claude Code.

### Se reemplaza

- usuarios y contraseñas simulados en el navegador;
- sesión local como única validación de identidad;
- historial guardado solamente en cada dispositivo;
- copias independientes del mismo partido para jugadores distintos.

### Se agrega

- Vercel como publicación gratuita de la V04 durante el piloto personal y no comercial;
- Supabase Auth para cuentas, sesiones y recuperación;
- Supabase Postgres para perfiles, partidos y relaciones;
- reglas RLS para permisos;
- un servicio gratuito de correo compatible con Supabase para el piloto;
- una cola local sencilla para partidos pendientes de sincronización;
- dos configuraciones separadas: pruebas y piloto real.

No se recomienda:

- reescribir la app en React u otro framework;
- construir un servidor propio;
- contratar hosting pago durante el piloto;
- crear microservicios;
- publicar en tiendas móviles;
- implementar Firebase/Firestore para este caso, porque las relaciones entre usuarios, participantes, confirmaciones, partidos y ranking encajan mejor en una base relacional y algunas condiciones gratuitas de Firebase requieren más cuidado con facturación.

## 7. Modelo mínimo de información

Los nombres técnicos pueden ajustarse al programar. Lo importante es la responsabilidad de cada conjunto de datos.

| Conjunto | Para qué sirve |
|---|---|
| Usuarios de autenticación | Correo, contraseña cifrada y sesión. Lo administra Supabase. |
| Perfiles | `@usuario`, nombre para mostrar, nombre, apellido y futuros datos deportivos. |
| Partidos | Fecha, modalidad, formato, estado, creador, resultado general y versión del formato. |
| Participantes | Une cada partido con sus jugadores registrados o invitados y su rol. |
| Sets | Guarda los marcadores necesarios para reconstruir el resultado. |
| Validaciones | Registra quién confirmó, rechazó o dejó pendiente un partido y cuándo. |
| Revisiones | Conserva cambios relevantes y permite auditar correcciones. |
| Solicitudes de anulación | Registra quién pidió eliminar/anular y quién aceptó o rechazó. |
| Partidos ocultos | Guarda que un usuario no quiere ver un partido en su propio historial. |
| Notas privadas | Nota de un usuario sobre un partido, invisible para el resto. |

Los eventos detallados del tanteo pueden conservarse en un bloque de datos versionado, mientras que usuarios, participantes, resultado, estados y validaciones deben quedar estructurados para poder consultar y calcular el ranking correctamente.

## 8. Seguridad mínima obligatoria

- Nunca guardar contraseñas propias ni claves administrativas en el navegador, GitHub o el repositorio.
- La clave pública de Supabase puede estar en la app; la clave administrativa secreta, nunca.
- Toda tabla accesible desde la app debe tener reglas RLS definidas y probadas.
- Un usuario solo puede editar lo permitido por su relación con el partido.
- El correo de una cuenta no debe exponerse a otros jugadores.
- Los códigos de recuperación deben vencer, ser de un solo uso y tener límites de reintentos.
- La creación de usuarios de prueba debe ejecutarse fuera de la app pública.
- Pruebas y producción deben usar bases de datos separadas.
- Antes del piloto deben probarse intentos de leer o modificar datos ajenos, no solamente el recorrido feliz de la interfaz.

## 9. Capacidad y plan gratuito

Para un piloto de alrededor de 100 personas, el plan gratuito propuesto tiene margen amplio según sus límites actuales. Como referencia, una base de 500 MB puede contener miles de partidos incluso si cada partido detallado ocupara decenas de kilobytes.

Esto debe medirse con datos reales antes de abrir el piloto:

1. generar al menos diez partidos representativos, incluidos partidos largos;
2. medir cuánto ocupa cada registro completo;
3. calcular el promedio y el peor caso;
4. verificar cuánto margen queda para perfiles, índices e historial.

No deben guardarse imágenes grandes dentro de las tablas. Si luego hay fotos de perfil, se usaría almacenamiento de archivos y límites de tamaño.

Riesgo operativo conocido: los proyectos gratuitos de Supabase pueden tener políticas de pausa por inactividad. Antes de abrir el piloto se verifican las condiciones vigentes y el procedimiento de reactivación o respaldo.

## 10. Correo sin costo durante el piloto

El envío de prueba incluido por Supabase no alcanza para usuarios reales. Se necesita conectar un proveedor SMTP gratuito.

Camino propuesto:

1. evaluar en la etapa de infraestructura un proveedor gratuito compatible, como Brevo o Mailjet;
2. utilizar un remitente dedicado al proyecto;
3. comprobar entrega, carpeta de spam, límites diarios y funcionamiento sin dominio propio;
4. no comprar un dominio ni activar un plan pago sin aprobación;
5. si ninguna alternativa gratuita resulta confiable, detener esa decisión y presentar el costo mínimo real antes de continuar.

El proveedor no queda confirmado hasta realizar esa prueba. Supabase sí queda como recomendación principal para autenticación y datos.

## 11. Plan de migración por etapas

No habrá migración de datos: “migración” significa aquí transformar la aplicación de local a real de manera controlada.

### Etapa 0 — Cierre de decisiones

- Diseñar y validar con datos simulados la pantalla del perfil vista por otro jugador.
- Coordinar con el trabajo de Ranking BRAMU cuándo un partido pendiente con invitados puede volverse oficial.
- Confirmar qué campos deportivos serán públicos en el primer perfil.
- Confirmar el comportamiento exacto de una disputa no resuelta.
- Mantener la fórmula de ranking fuera del alcance.

### Etapa 1 — Cimientos y entorno de pruebas

- Crear una cuenta gratuita en Vercel y conectarla con el repositorio existente de GitHub.
- Crear dos proyectos gratuitos de Supabase: pruebas y piloto.
- Definir tablas y reglas de seguridad.
- Preparar una versión V04 separada de la V03 pública.
- Crear los diez usuarios sintéticos en pruebas.
- Verificar que ningún dato de prueba pueda mezclarse con producción.

### Etapa 2 — Acceso y perfil reales

- Conectar registro, ingreso, cierre de sesión y persistencia de sesión.
- Crear y editar perfiles.
- Implementar búsqueda por `@usuario`, nombre para mostrar, nombre y apellido.
- Conectar correo real y recuperación mediante código de seis dígitos.
- Probar errores, vencimiento, reintentos y privacidad.

### Etapa 3 — Partido persistente de un solo usuario

- Guardar partidos reales en la base de datos.
- Mostrar historial por usuario.
- Mantener recuperación local del partido en curso.
- Implementar pendiente de sincronización y reintentos sin duplicados.
- Comenzar con la base real vacía.

### Etapa 4 — Partido compartido

- Asociar participantes registrados e invitados.
- Mostrar un mismo partido en los historiales relacionados.
- Implementar estados pendiente, validado y disputado.
- Implementar notas privadas por usuario.
- Implementar ocultamiento individual.
- Implementar solicitud y confirmación de anulación global.

### Etapa 5 — Prueba piloto y publicación estable

- Hacer pruebas completas con los diez usuarios sintéticos.
- Revisar permisos y ataques básicos entre cuentas.
- Probar teléfonos y computadoras, conexión lenta y modo sin conexión.
- Probar entrega real de correos.
- Preparar respaldo y recuperación.
- Publicar la V04 en Vercel, manteniendo la V03 en GitHub Pages durante la transición.
- Invitar primero a un grupo pequeño y ampliar hasta aproximadamente 100 usuarios si funciona correctamente.

### Etapa 6 — Ranking BRAMU, más adelante

- Incorporar la fórmula cuando quede cerrada.
- Calcular únicamente sobre partidos válidos y compatibles.
- Agregar categorías, territorios, calibración y evolución sin cambiar las identidades históricas de jugadores o partidos.

## 12. Cómo encargar el trabajo a Claude Code

Cada etapa debe dividirse en encargos pequeños de aproximadamente tres o cuatro cambios relacionados. Cada encargo debe incluir:

- archivos o módulo afectados;
- comportamiento esperado;
- qué no debe tocarse;
- pruebas que debe ejecutar;
- criterios visibles para aceptar el resultado;
- actualización del consolidado correspondiente.

Orden recomendado de trabajo:

1. infraestructura y seguridad;
2. usuarios y perfiles;
3. partidos persistentes y sincronización;
4. partidos compartidos y validación;
5. prueba piloto y publicación.

No pedir “implementá toda la V04” en un único chat o cambio.

## 13. Decisiones que todavía faltan

Estas preguntas sí pueden modificar el comportamiento del producto y deben resolverse antes de programar el bloque correspondiente:

1. Si un partido queda disputado y nadie cede, ¿permanece visible pero no oficial indefinidamente o existe una resolución manual?
2. ¿Qué datos deportivos exactos aparecen en el perfil público durante el piloto, además de la identidad?
3. ¿Quién puede iniciar una corrección del resultado y qué participantes deben aprobarla?
4. ¿La anulación de un partido ya validado requiere la misma cantidad de aprobaciones que su validación inicial?
5. Cuando un partido se cargó con rivales invitados, ¿qué flujo permite asociar posteriormente a un rival registrado para que pueda validarlo?

Las elecciones de proveedor SMTP, configuración exacta del código OTP y condiciones vigentes del plan gratuito son validaciones técnicas, no decisiones de producto. Deben investigarse al comenzar la etapa correspondiente.

## 14. Criterio de éxito de la primera versión real

La primera V04 está lista para piloto cuando una persona puede:

- crear una cuenta real y recuperarla por correo;
- completar y encontrar perfiles públicos según las reglas definidas;
- iniciar y terminar un partido sin perderlo por falta momentánea de conexión;
- guardar el partido en una base persistente;
- asociarlo a jugadores registrados o invitados;
- verlo como un único partido compartido en los historiales correctos;
- validarlo, disputarlo, ocultarlo individualmente o solicitar su anulación;
- hacerlo desde la PWA publicada en Vercel;
- sin exponer contraseñas, correos privados ni datos de otros usuarios;
- sin costo para el piloto.

## 15. Recomendación cerrada

Para esta etapa, la solución mínima recomendada es:

**BRAMUlab actual + GitHub como repositorio + Vercel para publicar la V04 + Supabase Auth/Postgres/RLS + SMTP gratuito validado + sincronización local sencilla.**

Es suficiente para un piloto real, conserva el trabajo existente y deja los datos preparados para Ranking BRAMU sin construir infraestructura innecesaria.
