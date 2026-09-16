# BRAMUlab — Backend e Infraestructura

**Estado:** fuente maestra consolidada para cierre de producto previo al diseño técnico  
**Actualización:** 14 de septiembre de 2026  
**Etapa del roadmap:** posterior a BRAMUlab V04 — Nivel BRAMU  

---

## 0. Autoridad y alcance

Este documento es la fuente maestra vigente para Backend/Infraestructura de BRAMUlab.

Integra:

- las decisiones originales de `Backend_Infraestructura.md` que siguen vigentes;
- el diagnóstico preservado en `Backend_Infraestructura_Informe.md`;
- las definiciones vigentes de Nivel BRAMU, Ranking BRAMU y BRAMU Intelligence;
- las decisiones posteriores sobre infraestructura real, entornos, lanzamiento e identidades provisionales.

`Backend_Infraestructura_Informe.md` permanece como registro histórico del diagnóstico original. No es fuente normativa y no debe reescribirse para reflejar esta consolidación.

Este documento:

- define decisiones confirmadas y límites de producto;
- registra dependencias ya resueltas;
- identifica las decisiones que todavía bloquean el diseño técnico;
- separa pendientes no bloqueantes y funciones postergadas;
- no diseña todavía las tablas definitivas;
- no autoriza implementación.

### Precedencia de fuentes relacionadas

1. Este documento, para Backend/Infraestructura.
2. `Nivel_BRAMU_Formula_V1.4.md`, para fórmula, elegibilidad y comportamiento de Nivel.
3. `Nivel_BRAMU_Implementacion.md` y la implementación documentada en `Versiones/BRAMUlab_V04/`, para el contrato técnico ya construido de Nivel.
4. `Ranking_BRAMU.md`, para Ranking semanal, universos, elegibilidad y snapshots.
5. `BRAMU_Intelligence.md` y `BRAMU_Intelligence_Implementacion.md`, para claims, evidencia, caché y recálculo de Intelligence.
6. `Backend_Infraestructura_Informe.md`, únicamente como trazabilidad del diagnóstico anterior.

Si dos fuentes vigentes se contradicen, la contradicción debe cerrarse explícitamente antes de implementar el bloque afectado. Desarrollo no debe resolverla por interpretación.

---

# DECISIONES CONFIRMADAS

## 1. Infraestructura real y escala esperada

- La primera infraestructura no será descartable ni una simulación técnica.
- Producción nace como la base real y permanente de BRAMU.
- Los amigos y conocidos de la primera ola utilizan las mismas cuentas y datos de Producción que cualquier usuario posterior.
- No existe una migración futura desde una “base piloto” hacia una “base real”.
- La solución debe funcionar correctamente aunque ingresen personas que Sebastián no conoce.
- Debe soportar con comodidad un lanzamiento inicial de cientos de usuarios y crecer hacia aproximadamente 1.000 sin rehacer la arquitectura.
- No se diseña para 100.000 usuarios ni para necesidades comerciales todavía inexistentes.
- Se mantiene el criterio de costo cero mientras exista una alternativa razonable, segura y estable.
- Si para operar correctamente aparece un costo inevitable, debe evaluarse antes de contratarlo. No debe reemplazarse la arquitectura por una solución descartable solo para evitar un costo futuro pequeño.

## 2. Arquitectura mínima vigente

La base técnica prevista continúa siendo:

- la aplicación web/PWA actual, sin migración de framework como requisito;
- GitHub como repositorio e historial del código;
- Vercel para publicar las versiones online de Staging y Producción;
- Supabase Auth para cuentas, sesiones y recuperación;
- Supabase Postgres para datos persistentes y compartidos;
- Row Level Security y funciones server-side para permisos y operaciones oficiales;
- almacenamiento local acotado para partido en curso y cola de sincronización;
- proveedor de correo compatible con recuperación real, sujeto a prueba operativa.

No forman parte de la infraestructura mínima:

- microservicios;
- un servidor propio administrado manualmente;
- Kubernetes;
- una migración a React u otro framework solo por incorporar backend;
- una segunda base provisional;
- componentes “enterprise” sin necesidad real.

## 3. Desarrollo, Staging y Producción

BRAMU trabaja con tres conceptos separados.

### 3.1 Desarrollo

- Es el entorno donde se modifica el código.
- Puede estar incompleto o roto.
- Nunca utiliza datos reales de Producción.
- Puede usar datos locales o un backend de desarrollo/pruebas; la configuración exacta se define en el diseño técnico.

### 3.2 Staging

- Es una versión online e instalable destinada a pruebas y aceptación.
- Debe reproducir la experiencia visual y funcional prevista para Producción.
- Utiliza usuarios y datos de prueba.
- Su backend y base de datos están separados de Producción.
- Nunca puede apuntar a la base de Producción.
- Puede utilizar un ícono o marca visual diferenciada para evitar confusiones.
- Es el lugar donde Sebastián realiza la aceptación antes de publicar.

### 3.3 Producción

- Es BRAMU real.
- Contiene cuentas, perfiles, partidos y datos reales.
- Un despliegue de código no reemplaza, reinicia ni sobrescribe los datos de usuarios.
- Todo cambio de estructura de datos se aplica mediante migraciones controladas, versionadas y verificables.
- Los datos deben poder respaldarse y recuperarse.

La separación es lógica y operativa. No obliga por sí sola a contratar tres proyectos pagos: como mínimo Staging y Producción deben tener bases hospedadas distintas, y Desarrollo nunca debe usar Producción.

## 4. Lanzamiento

El orden previsto es:

1. pruebas internas en Staging;
2. apertura de Producción real;
3. primera ola de amigos y conocidos en Producción;
4. difusión pública mediante Instagram y otros canales cuando el sistema sea estable;
5. posible publicidad paga solo si el producto demuestra funcionar.

El dominio propio puede evaluarse antes de la difusión pública. Su compra no está confirmada todavía.

La app continúa como web app/PWA. App Store y Google Play no forman parte de esta etapa.

## 5. Cuentas, perfiles e identidad real

Cada cuenta real debe tener:

- un identificador técnico estable;
- autenticación real;
- una relación estable con su identidad de jugador;
- un `@usuario` único;
- nombre para mostrar;
- nombre real y apellido real;
- correo privado para autenticación y recuperación.

Decisiones vigentes:

- las contraseñas son administradas por Supabase Auth;
- BRAMU no guarda contraseñas en `localStorage` ni en tablas propias;
- la recuperación utiliza un código aleatorio de seis dígitos, de un solo uso;
- la vigencia inicial prevista es de 60 minutos;
- deben existir límites de reintentos y de correos;
- los errores no deben revelar si un correo pertenece a una cuenta;
- el correo no es público ni se utiliza para buscar jugadores;
- la primera base real comienza sin importar cuentas, sesiones ni partidos simulados de V03.

La intención anterior de hacer públicos y buscables `@usuario`, nombre para mostrar, nombre y apellido continúa como base, pero su relación exacta con la opción “perfil privado” permanece abierta y se detalla en los bloqueantes.

## 6. Identidades provisionales de jugadores invitados

Un invitado no es un texto descartable dentro de un partido.

### 6.1 Identidad persistente

- Cada invitado existe como una identidad provisional persistente con ID interno propio.
- La misma identidad puede participar en múltiples partidos.
- Puede acumular historial y estadísticas aunque todavía no tenga cuenta.
- Al volver a jugar con esa persona debe ser posible reutilizar el mismo ID provisional.
- Puede aparecer en recientes, Mi red, compañeros, rivales y otras relaciones derivadas de partidos.
- No participa del Ranking BRAMU competitivo mientras no tenga una cuenta y un Nivel que lo hagan elegible.
- Nunca se le asigna un Nivel permanente estimado por terceros.

### 6.2 Datos mínimos

Para crear una identidad provisional no se exige:

- teléfono;
- correo;
- DNI;
- apellido;
- otros datos personales adicionales.

El nombre o apodo ingresado no es prueba de identidad y nunca habilita una fusión automática.

### 6.3 Invitación y reclamo

- Cada identidad provisional puede tener un link único de invitación/reclamo.
- El link pertenece a la identidad, no a un partido.
- “Invitar a BRAMU” puede aparecer en Perfil provisional, Mi red, Resumen de partido, compañero/rival u otras superficies.
- Todas las superficies comparten el mismo reclamo de identidad.
- La invitación utiliza el sistema normal para compartir del dispositivo, incluido WhatsApp.
- Cuando la persona se registra mediante ese link, reclama la identidad provisional.
- Todos los partidos que ya utilizaban ese ID quedan vinculados; no se asocian uno por uno.
- Una cuenta real puede reclamar más de una identidad provisional cuando la misma persona fue creada por separado en redes diferentes.
- Si se confirma que dos identidades provisionales representan a la misma persona, pueden unificarse o vincularse a la misma identidad real.
- BRAMU nunca fusiona automáticamente identidades por coincidencia de nombre o apodo.

Siguen abiertas la verificación exacta del reclamo, la detección de duplicados y las consecuencias retroactivas sobre Nivel y Ranking.

## 7. Partido compartido, historial y validación

- Un partido real existe una sola vez en la base de datos.
- Los historiales relacionados consultan ese mismo objeto compartido.
- BRAMU modela pádel de dobles: dos parejas y hasta cuatro participantes.
- Se distingue autor del registro, participantes, parejas, identidades reales, identidades provisionales y observadores.
- Un participante registrado que carga un partido oficial deja el resultado pendiente de validación rival.
- Alcanza la confirmación de un solo rival registrado.
- Quien cargó el partido no puede confirmarse a sí mismo.
- Su compañero no reemplaza la confirmación rival.
- Modificar un dato relevante vuelve a dejar el partido pendiente.
- Los partidos pendientes, disputados, observados, anulados, duplicados o con score inválido no afectan Nivel ni Ranking, salvo las reglas específicas de invitados computables que todavía deben armonizarse entre Nivel y Ranking.
- Nadie puede eliminar unilateralmente un partido compartido.
- Cada usuario puede ocultarlo solamente de su propio historial.
- La eliminación global se representa como anulación lógica y auditable.
- Las notas privadas pertenecen exclusivamente al usuario que las escribió.

Todavía deben cerrarse la máquina completa de estados, correcciones, disputas, anulación y visibilidad de partidos observados.

## 8. Conexión inestable y sincronización

- El partido en curso se conserva localmente para evitar perder el tanteo.
- Si no hay conexión al finalizar, se guarda una operación pendiente.
- La aplicación reintenta al recuperar conexión.
- Debe mostrar estado pendiente de sincronizar, sincronizado o error.
- Los reintentos utilizan un identificador estable para no crear duplicados.
- Los datos ya sincronizados no deben depender de `localStorage` como fuente de verdad.

La política exacta de conflictos entre dispositivos y la retención de la cola local se define durante el diseño técnico.

## 9. Seguridad y autoridad

- El navegador no es autoridad para validar resultados oficiales ni modificar Nivel, Ranking o Intelligence.
- Las operaciones oficiales se autorizan y ejecutan del lado servidor.
- Las credenciales administrativas y claves de proveedores nunca se incluyen en el JavaScript público.
- Cada usuario solo puede modificar los datos que le corresponden según reglas explícitas.
- Las notas privadas no son accesibles para otros participantes.
- Staging y Producción utilizan bases y secretos distintos.
- Antes de abrir Producción deben probarse accesos indebidos entre cuentas, no solamente el recorrido normal de la interfaz.
- Las operaciones críticas deben ser idempotentes y auditables.

La matriz concreta de permisos y los límites operativos se cierran en el diseño técnico, una vez resueltos los bloqueantes de producto.

---

# DEPENDENCIAS YA RESUELTAS

## 10. Nivel BRAMU

La dependencia conceptual y matemática de Nivel está cerrada.

Además, BRAMUlab V04 ya implementó como módulos puros y testeados:

- motor determinístico y parámetros V1;
- `algorithm_version = nivel_bramu_v1_0`;
- cálculo de nivel efectivo, fuerza, expectativa, factores, delta y confianza;
- snapshots anteriores y posteriores;
- `reasonCodes` y salida auditable;
- elegibilidad y estados computable, pendiente, excluido, corregido, anulado y duplicado dentro del contexto de Nivel;
- invitados e imputación neutral 1,00 / 0,80 / 0,60;
- repetición, compañero y círculo competitivo;
- cuestionario rápido y completo;
- ajuste inicial;
- calibración y recalibración.

Reglas vigentes relevantes para backend:

- Nivel cambia inmediatamente cuando el partido se vuelve válido y confirmado.
- La precisión interna es de cuatro decimales; la presentación pública usa uno.
- Calibración requiere cinco partidos computables y tres rivales distintos.
- Recalibración conserva separado el valor provisional del consolidado.
- Ranking utiliza el último consolidado válido hasta cerrar la recalibración.
- Un partido manual debe completar carga, asociación y validación dentro de 30 días para modificar Nivel y Ranking.
- Fuera de esa ventana puede permanecer en el historial, pero no modifica Nivel ni Ranking.
- Una corrección debe revertir la variación anterior, recalcular con los mismos snapshots previos y aplicar la diferencia neta.
- No se recalcula silenciosamente todo el historial con niveles actuales.

Lo que todavía falta no es rediseñar la fórmula, sino integrar esos contratos con persistencia, eventos y operaciones multiusuario.

## 11. Ranking BRAMU

Ranking ya no es continuo en vivo. Su cadencia vigente es semanal.

### 11.1 Regla de publicación

- Ordena por Nivel BRAMU consolidado interno exacto.
- No tiene puntos propios.
- Semana: lunes 00:00:00 a domingo 23:59:59.
- Zona horaria V1: `America/Argentina/Buenos_Aires`.
- La nueva edición queda constituida el lunes 00:00:00.
- La materialización técnica puede terminar segundos o minutos después, pero conserva ese instante efectivo.
- Nivel puede cambiar durante la semana; la posición publicada y el Nivel del corte permanecen estables hasta la siguiente edición.
- Un partido validado después del cierre impacta en la edición siguiente.
- No se reescribe retroactivamente una edición publicada por cargas tardías o correcciones ordinarias.

### 11.2 Elegibilidad y snapshots

Ranking ya definió:

- cuenta activa e identidad estable;
- perfil público;
- opt-in habilitado;
- ubicación estructurada completa;
- Nivel calibrado o recalibrando con consolidado anterior;
- actividad dentro de 180 días;
- ausencia de exclusión de integridad;
- universos Local, Provincial, País, Global y Mi red;
- umbrales de densidad 0–4, 5–14 y 15+;
- contrato mínimo del estado del jugador;
- contenido mínimo del snapshot semanal;
- fecha efectiva, fecha de publicación, timezone y versión de reglas.

### 11.3 Mi red

`Mi red` reemplazó el nombre anterior `Mis jugadores` dentro de Ranking.

- Es una vista de vínculos deportivos, no una lista manual de contactos ni Mis grupos.
- Incluye al propio usuario y relaciones derivadas de partidos dentro de la ventana de 180 días.
- Permite ocultar o restaurar una persona sin afectar partidos, Nivel ni Ranking oficial.
- La decisión posterior sobre identidades provisionales amplía su alcance: los invitados persistentes también deben poder aparecer en Mi red, aunque no tengan posición competitiva.

Esta última decisión todavía debe armonizarse en `Ranking_BRAMU.md`, que actualmente excluye invitados no reclamados de Mi red.

## 12. BRAMU Intelligence

La dependencia conceptual de Intelligence está cerrada.

Ya están definidos:

- datos mínimos de entrada por partido;
- perspectiva del jugador;
- separación entre historia personal, Nivel y Ranking;
- objeto mínimo de insight;
- claims, evidencia, alcance, muestra, confianza, relevancia y versiones;
- memoria editorial y cooldowns;
- caché por hash de datos, claims, perspectiva, versión y modelo;
- recálculo de derivados afectados por correcciones o anulaciones;
- conservación del texto y evidencia que el usuario vio;
- marcado de textos dependientes como obsoletos;
- núcleo determinístico y plantillas como funcionamiento completo;
- generación externa opcional, reversible y posterior al benchmark;
- Cloudflare/Qwen como primera evaluación y Groq/GPT-OSS como contingencia.

La IA generativa no es requisito para abrir Producción. No puede calcular Nivel, Ranking, resultado ni hechos nuevos.

---

# DECISIONES ABIERTAS BLOQUEANTES

Estas decisiones deben cerrarse antes de diseñar el esquema definitivo y el plan completo de implementación. No impiden estudiar herramientas ni preparar un entorno vacío, pero sí impiden considerar Backend listo.

## 13. Alcance funcional de la primera Producción

Debe confirmarse qué funciones actuales entran en la primera versión con backend real:

- Jugadores agregados manualmente;
- Mi red;
- Mis grupos;
- ranking semanal de grupos;
- Intelligence grupal;
- partidos observados;
- bandeja de notificaciones y solicitudes;
- BRAMU Intelligence postpartido;
- “Tu momento”.

Mi red y Jugadores agregados ya son conceptos diferentes. Falta decidir si ambos sobreviven y se persisten desde la primera Producción.

## 14. Privacidad, perfil y búsqueda

Debe definirse:

1. qué significa exactamente “perfil privado”;
2. qué identidad continúa visible o buscable cuando el perfil es privado;
3. cuáles son los campos deportivos públicos, privados o configurables;
4. si el historial de partidos puede ser público y bajo qué regla;
5. qué campos usa cada buscador:
   - búsqueda global;
   - selección de compañero/rival;
   - Jugadores agregados;
   - Mi red;
   - Ranking.

La intención vigente de hacer públicos `@usuario`, nombre para mostrar, nombre y apellido no alcanza para resolver todos estos permisos.

## 15. Cuenta, `@usuario` y acceso

Antes de cerrar autenticación y perfiles debe definirse:

- caracteres y longitud de `@usuario`;
- normalización de mayúsculas, tildes y espacios;
- palabras reservadas;
- posibilidad y frecuencia de cambio;
- comportamiento de referencias antiguas;
- si el correo debe verificarse antes de cargar o validar partidos;
- si se permiten cuentas de menores de edad;
- qué ocurre con datos compartidos cuando una cuenta se elimina.

## 16. Reclamo, duplicados y Nivel de identidades provisionales

La identidad provisional persistente está confirmada. Siguen abiertos:

- qué comprobación adicional, si alguna, necesita el reclamo mediante link;
- cómo se revoca o reemplaza un link comprometido;
- quién puede impugnar un reclamo incorrecto;
- cómo se confirma que dos identidades provisionales representan a la misma persona;
- cómo se resuelve una cuenta que reclama identidades incompatibles;
- cómo detectar duplicados sin producir falsas fusiones;
- qué ocurre con Nivel, calibración y Ranking al reclamar una identidad provisional;
- si algún cálculo se vuelve retroactivo y bajo qué límite temporal.

No debe inventarse retroactividad. La respuesta debe cruzarse con la ventana de 30 días de Nivel y con la regla de que el invitado imputado no recibe delta ni Nivel permanente.

## 17. Máquina completa de estados del partido

La capa de Nivel ya reconoce estados útiles, pero no sustituye el flujo multiusuario completo.

Debe cerrarse una máquina canónica que contemple, cuando corresponda:

- borrador;
- pendiente de sincronización;
- sincronizado;
- pendiente de validación;
- validado;
- corrección propuesta;
- disputado;
- observado;
- vencido para cómputo;
- corregido;
- anulado;
- duplicado.

Para cada transición debe definirse:

- quién puede iniciarla;
- quién debe aprobarla;
- qué dato cambia;
- qué eventos genera;
- si afecta historia personal, estadísticas, Nivel, Ranking o Intelligence.

## 18. Correcciones, disputas y anulación

Debe definirse:

- qué acciones tiene el rival además de confirmar;
- quién puede proponer una corrección;
- quién aprueba cambios de participantes, parejas, fecha, formato o resultado;
- qué ocurre si una disputa nunca se resuelve;
- cuántas aprobaciones requiere anular un partido validado;
- quién representa a la contraparte cuando existen cuatro cuentas;
- qué ocurre con un partido duplicado cargado independientemente por dos usuarios;
- cómo se ven los partidos observados en los historiales de los supuestos participantes.

## 19. Vencimiento de 30 días y reclamos posteriores

Nivel ya resolvió que un partido cargado, asociado o validado fuera de 30 días no modifica Nivel ni Ranking.

Falta definir:

- si todavía puede validarse socialmente después del vencimiento;
- si puede corregirse;
- si una identidad provisional puede reclamarlo como parte de su historial;
- qué estado visible adopta;
- cómo se explica que existe en el historial pero no computa;
- si el reclamo de identidad posterior cambia estadísticas personales no competitivas.

## 20. Ubicación estructurada internacional

Ranking exige país, provincia/estado y localidad estructurados, pero todavía debe definirse:

- fuente canónica de ubicaciones;
- alcance inicial Argentina o internacional;
- identificadores persistentes;
- tratamiento de localidades no encontradas;
- equivalentes de provincia/estado fuera de Argentina;
- relación entre GeoRef como fuente argentina y los universos País/Global.

Esto afecta el modelo de perfil y los snapshots, por lo que debe cerrarse antes del esquema definitivo.

## 21. Ranking semanal e Intelligence

Existe una contradicción nueva que debe resolverse:

- `Ranking_BRAMU.md` §4 y §17 establecen publicaciones semanales congeladas.
- `BRAMU_Intelligence_Implementacion.md` §10 todavía describe movimientos “al procesar el evento actual”, heredados del modelo anterior.

Debe definirse que los insights de movimiento de Ranking se disparan al publicar la edición semanal o establecer otro contrato explícito compatible con snapshots semanales.

También debe cerrarse:

- para qué participantes se genera Intelligence;
- si se genera al cargar, al validar o en ambos momentos;
- qué historia personal puede usar un partido pendiente u observado;
- qué versión ve el usuario cuando un insight anterior queda obsoleto.

## 22. Invitados computables: Nivel y Ranking

Existe otra contradicción que requiere corrección explícita:

- Nivel V1.4 §13 y §21 permite que un partido con tres niveles conocidos, o con dos conocidos —uno por pareja—, aporte Nivel mediante imputación neutral y disponibilidad reducida.
- `Ranking_BRAMU.md` §16 incluye “invitados sin identidad elegible” dentro de los casos que no impactan en Nivel.

Debe aclararse si esa frase se refiere únicamente al invitado —que no recibe Nivel ni posición— o si pretende excluir el partido completo. Backend no debe interpretar esta diferencia por su cuenta.

---

# DECISIONES ABIERTAS NO BLOQUEANTES

Estas decisiones deben resolverse antes de abrir el bloque correspondiente o Producción, pero no cambian por sí solas el modelo central de producto.

## 23. Operación y seguridad

- matriz completa de permisos Row Level Security;
- rate limits de registro, login, recuperación, reclamos y validaciones;
- proveedor SMTP y prueba real de entrega;
- política de backups y ejercicio de recuperación;
- retención y anonimización de logs;
- monitoreo de errores y procesos fallidos;
- operaciones administrativas mínimas para disputas, duplicados y bloqueos;
- procedimiento de rotación de secretos;
- política de pausa o límites de planes gratuitos vigente al momento de configurar.

## 24. Sincronización

- resolución de ediciones concurrentes desde dos dispositivos;
- prioridad entre una revisión online y otra offline;
- tiempo de retención de operaciones pendientes;
- cantidad y frecuencia de reintentos;
- limpieza de la copia local después de sincronizar;
- recuperación manual cuando el envío no puede completarse.

## 25. Ranking

- valor inicial de `ranking_opt_in`: automático al calibrar o activación manual;
- política de retención de snapshots semanales;
- autoridad para establecer o levantar estados de integridad;
- tratamiento operativo de una edición semanal que falle o se publique tarde.

## 26. BRAMU Intelligence generativa

- consentimiento exacto para el piloto opt-in;
- tratamiento de textos generados si se retira el consentimiento;
- política de retención de datos técnicos de generación;
- revisión de privacidad y transferencias internacionales antes de enviar datos reales;
- presupuesto y cuotas operativas antes de activar el proveedor.

La generación externa permanece apagada hasta completar benchmark, modo sombra, validación y revisión de privacidad.

## 27. Datos y administración

- formatos definitivos de imagen y tamaño de foto de perfil;
- interfaz de administración: scripts internos o panel mínimo;
- nombres concretos de proyectos, ramas y variables de cada entorno;
- estrategia técnica de migraciones y rollback;
- retención final de auditorías y eventos históricos.

---

# FUNCIONES POSTERGADAS

## 28. Fuera del primer backend real

Salvo decisión posterior explícita, no forman parte del primer alcance:

- App Store y Google Play;
- aplicación nativa;
- smartwatch, Live Activities o Isla Dinámica;
- microservicios o infraestructura autoalojada;
- arquitectura para 100.000 usuarios;
- temporadas o Race BRAMU oficial;
- premios y torneos;
- clubes verificados;
- matchmaking;
- seguidores, chat o red social completa;
- fotos y recuerdos asociados a partidos;
- IA para recomendaciones técnicas o análisis de notas privadas;
- exploración de rankings de otras ciudades, provincias o países;
- dominio propio hasta que se evalúe para la difusión pública;
- publicidad paga hasta validar el producto;
- notificaciones push, si el flujo inicial puede resolverse con bandeja interna y/o correo.

No se importan cuentas, sesiones ni partidos simulados de V03 a Producción.

---

# TRAZABILIDAD DEL INFORME ANTERIOR

## 29. Estado de cada pregunta de `Backend_Infraestructura_Informe.md`

### 29.1 Nivel BRAMU

| ID | Estado actual | Resultado de consolidación |
|---|---|---|
| N1 | **RESUELTO** | V04.1–V04.3 implementó contratos puros, estados, versión y salidas auditables. Backend debe integrarlos, no rediseñarlos. |
| N2 | **SUPERADO EN PARTE** | Los módulos ya producen `reasonCodes`, snapshots y trazabilidad. Sigue pendiente diseñar el registro persistente de eventos server-side. Es una decisión técnica, salvo correcciones/anulaciones. |
| N3 | **RESUELTO** | V04.3 separó consolidado y provisional y fijó el ciclo de recalibración. |
| N4 | **ABIERTO** | La reversión matemática está definida, pero faltan efectos exactos sobre contadores, evidencia, actividad y progreso de calibración/recalibración. |
| N5 | **CAMBIÓ DE ALCANCE** | El invitado ahora tiene identidad provisional persistente. Sigue abierta la consecuencia de reclamarla y cualquier retroactividad. |

### 29.2 Ranking BRAMU

| ID | Estado actual | Resultado de consolidación |
|---|---|---|
| R1 | **RESUELTO** | Ranking §6 y §17 cierran elegibilidad y contrato mínimo. |
| R2 | **ABIERTO** | Falta la fuente y representación internacional de ubicaciones. |
| R3 | **ABIERTO NO BLOQUEANTE** | Ranking exige opt-in, pero no quedó cerrado su valor inicial. |
| R4 | **RESUELTO** | Corte semanal lunes 00:00, timezone `America/Argentina/Buenos_Aires`. |
| R5 | **CAMBIÓ DE ALCANCE** | Ranking dejó de actualizar posiciones en vivo y pasó a edición semanal. Falta armonizar el disparador de Intelligence. |
| R6 | **ABIERTO NO BLOQUEANTE** | Falta política de retención de snapshots. |
| R7 | **RESUELTO EN CONCEPTO** | “Mi red” es automática y distinta de Jugadores agregados. Falta decidir si ambos módulos se persisten en la primera Producción e incorporar identidades provisionales. |
| R8 | **ABIERTO NO BLOQUEANTE** | Falta autoridad y procedimiento de integridad. |

### 29.3 BRAMU Intelligence

| ID | Estado actual | Resultado de consolidación |
|---|---|---|
| I1 | **ABIERTO** | Falta definir qué superficies de Intelligence entran en la primera Producción. |
| I2 | **ABIERTO** | Falta definir para qué participantes se genera cada perspectiva. |
| I3 | **ABIERTO** | Falta cerrar los disparadores según estado de partido. |
| I4 | **RESUELTO EN CONCEPTO** | Se recalculan derivados afectados y se marcan textos dependientes como obsoletos. |
| I5 | **ABIERTO** | Falta decidir qué versión histórica ve el usuario después de una corrección. |
| I6 | **RESUELTO** | El objeto mínimo está definido en `BRAMU_Intelligence_Implementacion.md` §5 y §13. |
| I7 | **RESUELTO** | La generación externa no se activa antes de benchmark y modo sombra. |
| I8 | **ABIERTO NO BLOQUEANTE** | Falta granularidad y revocación del consentimiento. |

### 29.4 Identidad, cuentas y perfiles

| ID | Estado actual | Resultado de consolidación |
|---|---|---|
| U1 | **ABIERTO** | Falta definición operativa de perfil privado. |
| U2 | **ABIERTO** | Falta lista cerrada de campos deportivos públicos. |
| U3 | **SUPERADO EN PARTE** | Ranking y Mi red ya tienen alcances propios; falta cerrar búsqueda global y selección de jugadores. |
| U4 | **ABIERTO** | Faltan reglas definitivas de `@usuario`. |
| U5 | **ABIERTO** | Falta definir qué puede hacer una cuenta sin correo verificado. |
| U6 | **RESUELTO EN CONCEPTO** | Cuenta real, identidad de jugador e identidad provisional son objetos diferenciados. Una cuenta puede reclamar más de una identidad provisional. |
| U7 | **SUPERADO EN PARTE** | Se prohibió la fusión automática y se permitió reclamar múltiples IDs; falta el flujo de verificación y unificación. |
| U8 | **ABIERTO** | Falta política de eliminación de cuenta y conservación de datos compartidos. |
| U9 | **ABIERTO** | Falta decidir si se admiten menores. |
| U10 | **POSTERGADO** | Foto real no bloquea; puede usarse avatar/iniciales. |

### 29.5 Partidos y validación

| ID | Estado actual | Resultado de consolidación |
|---|---|---|
| M1 | **SUPERADO EN PARTE** | Nivel implementó estados de computabilidad, pero falta la máquina multiusuario completa. |
| M2 | **SUPERADO EN PARTE** | Existen formatos y criterios de Nivel; faltan enums definitivos compartidos de origen, carácter y elegibilidad. |
| M3 | **RESUELTO EN SU NÚCLEO** | Link por identidad provisional y asociación de todos sus partidos están confirmados. Falta verificación, disputas de reclamo y retroactividad. |
| M4 | **ABIERTO** | Faltan acciones exactas del rival. |
| M5 | **ABIERTO** | Falta flujo y aprobación de correcciones. |
| M6 | **ABIERTO** | Falta resolución de disputa sin acuerdo. |
| M7 | **ABIERTO** | Falta regla de aprobación de anulación. |
| M8 | **SUPERADO EN PARTE** | Nivel cierra la no computabilidad después de 30 días; falta el comportamiento social e histórico. |
| M9 | **ABIERTO** | Falta visibilidad y aceptación de partidos observados. |
| M10 | **ABIERTO** | Falta resolución de duplicados cargados por personas distintas. |
| M11 | **ABIERTO TÉCNICO** | Falta política de conflicto offline entre dispositivos. |
| M12 | **SUPERADO EN PARTE** | V04.2 mapea formatos actuales; mini sets no tienen camino real y los casos especiales requieren contrato final. |
| M13 | **ABIERTO** | Falta canal mínimo para solicitudes de validación/corrección/anulación. |

### 29.6 Backend/Infraestructura

| ID | Estado actual | Resultado de consolidación |
|---|---|---|
| B1 | **ABIERTO** | Falta el alcance funcional de la primera Producción. |
| B2 | **RESUELTO** | Operaciones oficiales y secretos viven del lado servidor. |
| B3 | **SUPERADO EN PARTE** | Se confirma atomicidad e idempotencia como principios; el límite exacto de cada transacción pertenece al diseño técnico y depende de la máquina de estados. |
| B4 | **ABIERTO TÉCNICO** | La matriz RLS se diseña después de cerrar privacidad y permisos. |
| B5 | **SUPERADO EN PARTE** | Nivel es inmediato, Ranking semanal e IA generativa asíncrona; falta el disparador de Intelligence. |
| B6 | **ABIERTO TÉCNICO** | Falta seleccionar y probar SMTP. |
| B7 | **ABIERTO TÉCNICO** | Falta política y prueba de recuperación. |
| B8 | **ABIERTO TÉCNICO** | Falta retención y privacidad de logs. |
| B9 | **RESUELTO EN PRINCIPIO** | Datos, algoritmos y reglas deben versionarse; Producción cambia mediante migraciones controladas. La herramienta exacta se elige en diseño técnico. |
| B10 | **ABIERTO NO BLOQUEANTE** | Falta alcance de administración interna. |
| B11 | **SUPERADO EN PARTE** | Outbox, reintentos e idempotencia están confirmados; faltan conflictos y retención local. |
| B12 | **RESUELTO EN CONCEPTO** | Desarrollo, Staging y Producción están separados; Staging nunca usa Producción. Falta configuración técnica concreta. |

---

## 30. Contradicciones vigentes que deben corregirse al cerrar los bloqueantes

1. **Invitados en Mi red:** la decisión posterior exige que identidades provisionales aparezcan en Mi red; `Ranking_BRAMU.md` §9 todavía excluye invitados no reclamados.
2. **Partidos con invitados y Nivel:** Nivel §13/§21 permite cómputo reducido con invitados; Ranking §16 puede leerse como exclusión del partido completo.
3. **Intelligence de movimientos:** Intelligence §10 conserva un disparador ligado al evento actual; Ranking ahora se publica semanalmente.

Las contradicciones anteriores de Backend sobre actualización quincenal, dos decimales públicos, Ranking futuro, invitados como texto y Backend llamado V04 quedan superadas por esta consolidación.

---

## 31. Estado de cierre

Backend/Infraestructura todavía no está listo para diseñar la implementación completa.

Necesita una ronda puntual de decisiones, limitada a:

1. alcance funcional de la primera Producción;
2. privacidad, perfil y búsquedas;
3. reglas de cuenta, username, correo y menores;
4. reclamo/unificación de identidades provisionales y efectos sobre Nivel;
5. máquina de estados, correcciones, disputas y anulación;
6. ubicación internacional;
7. disparadores y perspectivas de Intelligence;
8. armonización de invitados entre Nivel, Ranking y Mi red.

Una vez cerrados esos ocho puntos, puede diseñarse:

- arquitectura de datos definitiva;
- contratos server-side;
- permisos RLS;
- migraciones;
- sincronización;
- plan de implementación por etapas;
- pruebas de seguridad y aceptación;
- apertura de Staging y Producción.

Hasta entonces no corresponde implementar Backend ni convertir decisiones técnicas pendientes en supuestos de producto.
