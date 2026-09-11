# Ranking BRAMU

**Estado:** V1 cerrada y lista para handoff de producto, UX y desarrollo.  
**Alcance:** Ranking BRAMU individual para pádel amateur de dobles. No redefine Nivel BRAMU, no crea matchmaking y no incluye rankings privados de grupos.  
**Fecha:** 11 de septiembre de 2026.

## Resumen ejecutivo

Ranking BRAMU debe representar **la posición relativa, actual y contextual de un jugador con Nivel BRAMU consolidado dentro de un universo elegible**. El Nivel BRAMU responde “qué capacidad competitiva estima BRAMU para este jugador”; el Ranking BRAMU responde “en qué puesto se encuentra hoy frente a estos jugadores”. Mis grupos sigue siendo un producto privado diferente.

Ranking BRAMU V1 **no tiene una fórmula propia de puntos**. Ordena a los jugadores elegibles por el valor interno exacto de su Nivel BRAMU consolidado. La lógica adicional del ranking determina quién participa, dentro de qué territorio y banda de Nivel, y cuándo el universo es suficientemente grande para publicar puestos. Esto evita tener dos números deportivos que puedan contradecirse y reduce nuevas superficies de manipulación.

Es un ranking **continuo**: no empieza de cero cada semana ni cada año. Se actualiza cuando cambia el Nivel, la elegibilidad o la ubicación de un jugador. La variación semanal es solamente una comparación entre la posición actual y la del último corte semanal. Las temporadas no forman parte de V1: en el futuro pueden existir como una “Race” anual separada, sin reiniciar el Nivel ni reemplazar el ranking continuo.

Solo ocupan puestos los jugadores con Nivel BRAMU calibrado —o que estén recalibrando pero conserven un nivel consolidado anterior— y perfil público habilitado para ranking. Los niveles estimados y en calibración pueden verse en Mis jugadores y en perfiles, pero no ocupan posiciones oficiales. Después de 180 días sin un partido computable validado, el jugador deja temporalmente de ocupar puesto sin perder ni reducir su Nivel.

Para no fabricar prestigio con universos diminutos se fijan tres estados de densidad:

| Jugadores elegibles en el universo consultado | Tratamiento |
|---:|---|
| 0–4 | **Sin posiciones.** Se informa cuántos faltan para habilitar la clasificación y se ofrece el territorio superior o quitar el filtro de Nivel. |
| 5–14 | **Clasificación en formación.** Se muestran puestos, siempre como “N de total”, sin podio, coronas ni logros compartibles de número 1. |
| 15 o más | **Ranking establecido.** Se muestran puestos y movimientos con tratamiento normal. |

Durante el piloto, la entrada principal debe ser **Mis jugadores**, porque puede ser útil aun con una comunidad territorial pequeña. Local, Provincial, País y Global deben existir, pero respetar los umbrales anteriores. Global permanece bloqueado hasta que haya jugadores elegibles en al menos dos países diferentes. Nunca se agrupan automáticamente localidades cercanas.

## 1. Fuentes y autoridad documental

Este consolidado toma como normativa de Nivel BRAMU, en este orden:

1. `Nivel_BRAMU_Formula_V1_4_Cerrada.md` — fórmula, parámetros y elegibilidad congelados para el piloto.[^1]
2. `Nivel_BRAMU_Handoff_Desarrollo_V1.md` — contrato de implementación y versionado.[^2]
3. `Nivel_BRAMU_Consolidado_Base.md` — contexto funcional y estados de producto, solo cuando no contradice V1.4.[^3]
4. `BRAMUlab_Backlog.md`, sección 1 — preserva íntegramente el contenido del documento original `BRAMU_Backlog_Futuro_Validacion_Partidos.md`.[^4]

**Nota documental:** el archivo independiente `BRAMU_Backlog_Futuro_Validacion_Partidos.md` no se encontraba como hijo de la carpeta de documentación al momento de esta revisión. Su contenido figura explícitamente preservado en `BRAMUlab_Backlog.md`, sección 1, y se utilizó desde allí. Esta ausencia no cambia ninguna decisión de producto.

La fórmula V1.4 prevalece sobre advertencias anteriores que todavía describen la fórmula como pendiente. Este documento no modifica ningún cálculo del Nivel BRAMU.

## 2. Tres conceptos que no deben mezclarse

| Concepto | Qué representa | Unidad | Qué lo modifica | Alcance |
|---|---|---|---|---|
| **Nivel BRAMU** | Estimación de capacidad competitiva individual | 1,0–10,0 | Partidos computables y reglas de Nivel V1.4 | Universal |
| **Ranking BRAMU** | Posición relativa dentro de un universo elegible | Puesto “N de total” | Nivel, cambios de otros jugadores, elegibilidad y territorio | Contextual |
| **Mis grupos** | Espacios privados creados y administrados por usuarios | Membresía y contenido privado | Acciones del grupo | Privado |

Consecuencias:

- Un jugador puede mantener exactamente el mismo Nivel BRAMU y subir o bajar puestos.
- Dos jugadores con el mismo nivel público redondeado pueden tener puestos distintos si sus valores internos no son idénticos.
- Entrar o salir del ranking no cambia el Nivel BRAMU.
- Abandonar un grupo no altera ninguna posición territorial.
- Un ranking privado de grupo, si se construye más adelante, será una función propia de Mis grupos y no una variante del ranking general.

## 3. Qué aportan las referencias externas

No existe un modelo externo que deba copiarse completo. Las referencias muestran patrones útiles y también decisiones que no corresponden a BRAMU.

| Referencia | Diseño observado | Aprendizaje para BRAMU | Qué no copiar |
|---|---|---|---|
| **LTA / World Tennis Number** | La LTA separa explícitamente un rating universal de habilidad de rankings territoriales por condado, región y nación. También explica que el puesto puede cambiar sin jugar porque otros suman puntos o porque resultados dejan de contar.[^5] | Explicar por separado Nivel y Ranking; aceptar movimientos producidos por el universo. | Puntos por torneos: BRAMU aún no organiza una estructura competitiva equivalente. |
| **UTR** | El rating usa partidos elegibles recientes, distingue proyección de confiabilidad y mejora con volumen y variedad de rivales.[^6] | Excluir estimaciones débiles de puestos oficiales y mantener trazabilidad de evidencia. | Recalcular Ranking BRAMU como promedio móvil independiente del Nivel ya cerrado. |
| **Playtomic** | Separa nivel y confiabilidad; solo los partidos competitivos con score válido y resultado no rechazado alteran el nivel.[^7] | La clasificación debe depender de datos oficiales, no de cualquier partido guardado. | Tratar toda comparación social como matchmaking o copiar su escala. |
| **DUPR** | Muestra rating y confiabilidad por separado; su ranking público ordena por rating y divide formatos y ramas competitivas.[^8][^9] | Un ranking puede ser una vista ordenada del rating sin sumar otro sistema de puntos. | Crear múltiples ratings de BRAMU o fragmentar la V1 antes de tener densidad. |
| **FIP** | El ranking oficial muestra puesto, jugador, país, puntos y movimiento; admite empates visibles y filtros por país.[^10] | Puesto, denominador, movimiento y filtro territorial son un lenguaje deportivo conocido. | Puntos por rondas de torneos profesionales. |
| **Strava** | Los rankings de clubes son sociales, semanales, específicos por actividad y limitan el número de filas visibles.[^11] | Las clasificaciones de grupos o temporadas pueden ser motivacionales sin sustituir el ranking continuo. | Reinicios semanales del ranking general o pérdida de historial. |
| **Investigación sobre leaderboards** | Los efectos motivacionales son heterogéneos y una tabla no mejora automáticamente la experiencia; comparaciones relativas o personalizadas pueden ser más útiles que un Top absoluto.[^12][^13] | Priorizar la posición propia, jugadores cercanos y contexto; evitar que todo gire alrededor del podio. | Premiar agresivamente el Top 3 o enviar alertas ante cada caída. |

La referencia más cercana al problema conceptual de BRAMU es la separación de LTA: rating y ranking contestan preguntas diferentes. La referencia más cercana para la implementación V1 es DUPR: una tabla puede ordenar el rating sin inventar puntos adicionales.

## 4. Trazabilidad de decisiones

### 4.1 Definiciones anteriores a esta investigación

Estas decisiones ya formaban parte de BRAMU:

- Nivel BRAMU y Ranking BRAMU son sistemas distintos.
- El Nivel BRAMU es individual, universal, de 1,0 a 10,0 y mayor significa mejor.
- El Nivel visible usa un decimal; el backend conserva cuatro.
- La fórmula de Nivel BRAMU V1.4 no se modifica desde Ranking.
- Un jugador puede cambiar de puesto aunque su nivel no cambie.
- Las vistas territoriales previstas son Nacional, Provincial y Local.
- Local usa inicialmente la ciudad o localidad declarada por el jugador.
- No se agrupan automáticamente localidades cercanas ni se inventan “zonas”.
- La ubicación se guarda como país, provincia y ciudad/localidad; no se pide dirección, código postal ni GPS.
- Mis jugadores no es Mis grupos.
- Cada fila puede abrir el perfil público del jugador.
- La efectividad puede servir como contexto, pero no estaba confirmada como desempate.
- Solo información oficial y elegible puede afectar Ranking.
- Los jugadores del ranking general no se agregan, eliminan ni ordenan manualmente.
- Los rankings privados de grupos quedan para una evolución futura.
- BRAMU no organiza partidos ni ofrece matchmaking en esta etapa.

Antes de este consolidado, ordenar por el Nivel interno exacto era una propuesta documentada, no una decisión cerrada. También existía una mención provisional a una futura fórmula de puntos de ranking. La revisión del 11 de septiembre resolvió esa ambigüedad.

### 4.2 Decisiones confirmadas el 11 de septiembre de 2026

- Ranking BRAMU V1 se ordena por el Nivel BRAMU interno exacto, de mayor a menor.
- No existe un puntaje adicional de Ranking en V1.
- La clasificación es continua; no se reinicia semanal ni anualmente.
- La variación visible compara la posición actual contra un corte semanal anterior.
- La fila muestra foto, nombre o usuario, Nivel, posición y abre el perfil público.
- Los ámbitos son Local, Provincial, País y Global.
- Global se mantiene bloqueado hasta que existan jugadores elegibles en al menos dos países diferentes.
- Cada ámbito ofrece clasificación General y clasificación por bandas fijas de Nivel BRAMU.
- Las bandas son `Nivel 1`, `Nivel 2`, etc.; por ejemplo, `Nivel 5` reúne los valores públicos de 5,0 a 5,9.
- Con 0–4 elegibles no se publican puestos; con 5–14 se publica una clasificación en formación; desde 15 se considera establecida para la UX inicial.
- Después de cambiar la localidad principal de juego deben transcurrir 30 días para volver a modificarla, con aviso previo al usuario.
- Una posible Race o Temporada BRAMU interesa como evolución separada, pero no forma parte del Ranking V1.

### 4.3 Cierre final de elegibilidad e inactividad

- Los jugadores CALIBRANDO no ocupan posiciones oficiales hasta alcanzar un Nivel consolidado.
- Los jugadores RECALIBRANDO conservan su posición con el último Nivel consolidado válido.
- Al superar 180 días sin partido computable validado, el jugador sale temporalmente del ranking sin perder ni reducir su Nivel.
- Para reingresar necesita un nuevo partido computable validado y aparece como `Nuevo`.
- Las reglas de una futura Race BRAMU requerirán un documento propio; no son una dependencia ni una decisión pendiente de V1.

## 5. Decisión central confirmada: ordenamiento condicionado por Nivel

### 5.1 Regla base

Ranking BRAMU V1 se ordena por:

1. valor interno exacto del **Nivel BRAMU consolidado**, de mayor a menor;
2. si dos valores son exactamente iguales a la precisión almacenada, ambos comparten el mismo puesto;
3. el siguiente puesto utiliza ranking de competición: `1, 1, 3`, no `1, 1, 2`;
4. dentro de un empate, un identificador estable solo fija el orden técnico de las filas y nunca rompe el empate visible.

No se utilizan para ordenar ni desempatar:

- efectividad;
- cantidad total de partidos;
- frecuencia de uso;
- racha de victorias;
- fecha de alta;
- número de amigos o grupos;
- categoría declarada;
- confiabilidad como segundo puntaje.

La igualdad exacta será poco frecuente. Compartir puesto es más transparente que introducir un desempate difícil de explicar. La efectividad puede depender mucho de la dificultad de los rivales y usarla como desempate volvería a premiar calendarios fáciles.

### 5.2 Por qué no crear puntos de ranking en V1

Un sistema separado de puntos tendría sentido si BRAMU organizara torneos, ligas o temporadas con eventos de distinto valor. Hoy no existe esa estructura. Dar puntos por jugar o ganar partidos comunes generaría problemas:

- premiaría volumen por encima de capacidad;
- podría contradecir al Nivel BRAMU;
- abriría una segunda fórmula que explicar y auditar;
- favorecería el farming en grupos cerrados;
- sería especialmente inestable con pocos usuarios.

El ranking sí incorpora lógica propia, pero esa lógica es de **participación y contexto**, no de rendimiento: territorio, elegibilidad, actividad, privacidad y densidad.

## 6. Universo y elegibilidad

### 6.1 Definición de universo

Un universo es el conjunto de jugadores que cumplen simultáneamente:

- el mismo alcance territorial seleccionado;
- las condiciones de participación vigentes;
- los filtros explícitos de la vista, si los hubiera;
- el estado de actividad requerido.

La posición siempre debe mostrarse junto con ese contexto. No existe “puesto 14” a secas; existe, por ejemplo, “14 de 86 · Bella Vista”.

### 6.2 Condiciones para ocupar una posición territorial

Un jugador ocupa puesto en Local, Provincial, País o Global solo si cumple todas estas condiciones:

1. tiene cuenta activa e identidad estable;
2. tiene perfil público;
3. tiene habilitada la opción **Aparecer en Ranking BRAMU**;
4. posee país, provincia y ciudad/localidad seleccionados desde datos estructurados;
5. tiene estado de Nivel BRAMU **CALIBRADO**; o está **RECALIBRANDO** y conserva un nivel consolidado anterior válido;
6. no superó 180 días desde su último partido computable validado;
7. no tiene una participación o cuenta anulada, duplicada, suspendida ni bajo una retención de integridad que impida publicar posición.

La participación recomendada se activa al completar la calibración cuando el perfil es público, con explicación clara y un control para desactivarla desde Privacidad. Desactivarla quita al jugador de todos los rankings sin borrar su Nivel, historial ni perfil.

### 6.3 Estados de participación

| Estado del jugador | Territorial | Mis jugadores | Tratamiento |
|---|---|---|---|
| Sin estimación | Sin puesto | Visible si existe vínculo, sin nivel | “Todavía no tiene Nivel BRAMU” |
| Nivel estimado / calibrando | Sin puesto | Visible al final, sin puesto | Nivel estimado + `CALIBRANDO · X/5` |
| Calibrado y activo | Con puesto si el universo tiene densidad | Con puesto | Tratamiento normal |
| Recalibrando con nivel consolidado | Usa el nivel consolidado anterior | Usa el nivel consolidado anterior | En detalle: “La posición usa tu último nivel consolidado” |
| Más de 180 días sin partido computable | Sin puesto temporal | Visible, marcado sin posición actual | “Sin posición por inactividad” |
| Perfil privado u opt-out | Sin puesto | Solo donde la privacidad lo permita | No publicar motivo privado a terceros |
| Cuenta anulada, duplicada o retenida | Sin puesto | Según política de cuenta | Sin exposición de acusaciones públicas |

La confiabilidad continúa siendo información del Nivel BRAMU. No se crea un umbral adicional de confiabilidad para Ranking V1: el estado CALIBRADO ya representa la evidencia mínima decidida por Nivel V1.4. Agregar otro umbral produciría el caso confuso “nivel calibrado pero no suficientemente calibrado para ranking”.

## 7. Inactividad

### 7.1 Principios cerrados

- La inactividad no baja ni borra el Nivel BRAMU.
- La pérdida de confiabilidad pertenece a Nivel BRAMU y sigue las reglas de V1.4; Ranking no agrega una penalización matemática.
- Ranking necesita una regla de actividad para evitar que personas que abandonaron la aplicación permanezcan indefinidamente arriba.
- Al superar 180 días sin partido computable validado, la salida será temporal y se expresará como **Sin posición por inactividad**, no como descenso.

### 7.2 Regla V1

- De 0 a 60 días sin partido computable: sin cambio de elegibilidad.
- De 61 a 150 días: el jugador conserva su posición; Nivel BRAMU aplica únicamente sus reglas propias de confiabilidad.
- Desde el día 151: aviso privado de que la posición vencerá si llega a 181 días sin actividad computable.
- Al comenzar el día 181: sale de las posiciones oficiales.

### 7.3 Reingreso

Para volver a ser elegible se requiere un nuevo partido computable validado. Al validarse:

1. Nivel BRAMU procesa el partido con la confiabilidad efectiva correspondiente;
2. Ranking usa el nivel consolidado resultante;
3. el jugador reingresa como **Nuevo** en la comparación semanal, no con una variación ficticia respecto de su antigua posición.

El reingreso puede mantenerse cualquiera sea la ventana finalmente elegida. La decisión debe versionarse como regla de Ranking y no requiere alterar la fórmula de Nivel.

## 8. Ranking continuo y temporadas

### 8.1 V1: continuo

El ranking oficial es continuo. Se actualiza cuando ocurre cualquiera de estos eventos:

- validación, corrección o anulación de un partido que cambia un Nivel consolidado;
- finalización de calibración;
- entrada o salida por actividad;
- cambio de ubicación estructurada;
- cambio de privacidad u opción de participación;
- corrección de identidad o duplicado;
- cambio versionado de reglas de Ranking.

La tabla actual puede recalcularse o materializarse en cada evento. La UX debe indicar “Actualizado hoy” o la fecha del último cálculo relevante.

### 8.2 Movimiento semanal

La posición actual es en tiempo real o casi real. “Semanal” describe únicamente la referencia usada para mostrar el movimiento: se compara el puesto actual con el puesto registrado en el último corte semanal equivalente. **La tabla no se reinicia cada semana y no entrega puntos semanales.** Esto evita flechas que cambien varias veces por día.

Ejemplo: Seba estaba 18.º en el corte anterior. Hoy está 14.º porque cambió su Nivel o porque otros jugadores entraron, salieron o modificaron el suyo. La interfaz muestra `+4`, aunque el ranking siga siendo continuo.

Estados de movimiento:

- `+N`: subió N puestos;
- `−N`: bajó N puestos;
- `—`: mismo puesto;
- `Nuevo`: no existía una posición comparable;
- sin indicador: todavía no hay un corte anterior representativo.

No se muestra una “tendencia” verde o roja distinta del movimiento: podría confundirse con una mejora o empeoramiento del Nivel. Al tocar la ayuda se explica que el puesto también cambia por movimientos de otros jugadores.

### 8.3 Futuro: Temporada BRAMU

Una temporada puede ser valiosa cuando exista suficiente volumen o BRAMU organice competencias. Debe llamarse **Temporada BRAMU** o **Race BRAMU**, tener reglas y puntos propios, fecha de inicio y cierre, y reiniciarse sin modificar el Nivel ni el ranking continuo.

La diferencia conceptual sería:

- **Ranking BRAMU:** “¿Quién tiene hoy el mejor Nivel dentro de este universo?”. Es continuo y no se reinicia.
- **Race BRAMU 2027:** “¿Quién consiguió más méritos competitivos durante 2027?”. Empieza en cero, suma puntos según reglas propias y termina al cerrar el año.

No se recomienda crear una temporada que solo copie el Nivel al 1 de enero: no agrega una pregunta nueva. La futura Race debería premiar desempeño dentro de torneos, ligas, eventos o desafíos claramente definidos, no la mera frecuencia de carga. Como BRAMU todavía no organiza esas instancias, queda fuera de V1.

## 9. Ámbitos territoriales

### 9.1 Global

- Universo: todos los jugadores elegibles, independientemente de su país de juego.
- La pestaña se incluye desde V1, inicialmente bloqueada.
- Se desbloquea cuando el universo elegible representa al menos dos países diferentes.
- Una vez desbloqueada, sigue las mismas reglas de densidad: puede abrirse y continuar sin puestos hasta reunir cinco elegibles.
- El estado bloqueado explica: “El Ranking Global se habilitará cuando BRAMU tenga jugadores elegibles en más de un país”.

### 9.2 País

- Universo: jugadores elegibles con el mismo país estructurado.
- En V1 el jugador ve primero su propio país; explorar otros países puede postergarse.
- No se infiere nacionalidad. El campo representa ubicación principal de juego, no ciudadanía.

### 9.3 Provincial

- Universo: jugadores elegibles con el mismo país y la misma provincia/estado estructurados.
- El nombre visible usa la denominación administrativa local.
- Ciudad Autónoma de Buenos Aires debe ser una jurisdicción propia, no una ciudad dentro de Provincia de Buenos Aires.

### 9.4 Local

- Universo: jugadores elegibles con la misma ciudad/localidad estructurada.
- El campo recomendado es **Localidad principal de juego**, no domicilio.
- Cada jugador tiene una sola localidad principal activa.
- No se solicita dirección, código postal ni GPS.
- Bella Vista, Muñiz y San Miguel permanecen separados salvo que en el futuro exista una definición geográfica explícita y versionada.

Si una localidad tiene poca densidad, la UX ofrece **Ver ranking provincial**. No mezcla localidades ni amplia un radio silenciosamente.

### 9.5 Cambios de ubicación

- El usuario puede cambiar su localidad principal de juego mediante selector estructurado.
- El cambio se registra con fecha y valor anterior.
- Después de un cambio confirmado existe un plazo de 30 días antes de permitir otro, salvo una política de soporte futura.
- El jugador entra al nuevo universo como `Nuevo`; no arrastra la variación del territorio anterior.
- Sus snapshots históricos permanecen asociados al territorio vigente en cada fecha.

El cooldown limita cambios tácticos de localidad sin pedir geolocalización invasiva.

## 10. Mis jugadores

Mis jugadores es una **clasificación personal de vínculos directos**, no una comunidad administrable ni un grupo compartido.

### 10.1 Membresía V1 recomendada

Incluye automáticamente:

- jugadores registrados con quienes el usuario compartió al menos un partido validado como compañero o rival;
- el propio usuario.

No incluye por defecto:

- invitados que aún no reclamaron una cuenta;
- personas que solo comparten un grupo sin haber jugado;
- jugadores agregados manualmente para alterar la lista;
- toda la agenda de contactos.

Si BRAMU incorpora seguimiento de perfiles más adelante, los jugadores seguidos podrían sumarse como una sección separada, no mezclarse silenciosamente con los rivales reales.

### 10.2 Funcionamiento

- Ordena con las mismas reglas de Nivel consolidado.
- No aplica los umbrales territoriales de 5 y 15 porque su universo personal es explícito y no pretende representar un territorio.
- Con uno o dos jugadores elegibles no publica puesto: muestra una comparación simple. Desde tres elegibles utiliza “N de total”.
- Siempre muestra “N de total”.
- Los calibrando aparecen debajo, en una sección sin posiciones.
- Los inactivos permanecen visibles como vínculo, pero sin puesto numérico.
- No tiene administradores, invitaciones, chat, muro ni contenido compartido.

Ejemplo: “2 de 7 entre tus jugadores” es válido. Con solo dos personas muestra “Comparación entre 2 jugadores”, no “Nº1”. En ningún caso debe transformarse en una medalla ni en “segundo mejor jugador de tu grupo”.

## 11. Densidad y representatividad

### 11.1 Umbrales V1

Los umbrales se aplican **después** de territorio y filtros:

| Cantidad elegible | Estado | Posiciones | Movimiento | Reconocimientos |
|---:|---|---|---|---|
| 0–4 | Comunidad insuficiente | No | No | No |
| 5–14 | En formación | Sí, siempre con denominador | Sí, cuando exista corte comparable | Sin podio, corona ni pieza compartible de Nº1 |
| 15+ | Establecido | Sí | Sí | Pueden habilitarse reconocimientos sobrios |

Estos no son umbrales estadísticos universales; son barreras de honestidad de producto para el piloto. Deben revisarse con datos reales de distribución y conectividad.

### 11.2 Estados vacíos

Ejemplo local con 4 elegibles:

> **El ranking de Bella Vista está en formación**  
> Hay 4 jugadores elegibles. Las posiciones se habilitan a partir de 5.  
> **Ver Provincia de Buenos Aires**

No se muestra “Sos Nº1” ni una tabla ordenada encubierta. Puede indicarse el avance de la comunidad, pero no usar presión de invitación ni prometer una posición futura.

### 11.3 Cruce de umbral

Cuando un universo llega a 5 jugadores:

- comienza como Clasificación en formación;
- todos los integrantes reciben su primera posición como `Nuevo`;
- el primer movimiento semanal aparece después del primer corte comparable;
- no se reconstruyen flechas anteriores con poblaciones no representativas.

Al alcanzar 15, el ranking pasa a establecido sin reiniciar posiciones.

## 12. Filtros

### 12.1 Filtros que aportan valor en V1

1. **Ámbito:** Mis jugadores, Local, Provincial, País y Global.
2. **Tipo de clasificación:** General o Por Nivel.
3. **Banda de Nivel:** Nivel 1, Nivel 2, etc. Al entrar en Por Nivel se preselecciona la banda actual del usuario.
4. **Búsqueda por nombre o usuario:** localiza a una persona dentro del universo actual; no altera el cálculo.

Los ámbitos y la banda de Nivel forman un cuadro de doble entrada. Por ejemplo: `Provincial + General` o `Provincial + Nivel 5`.

### 12.2 Bandas fijas de Nivel BRAMU

La clasificación Por Nivel no usa categorías competitivas declaradas. Filtra por bandas fijas y compartidas de la escala BRAMU:

- `Nivel 1`: valor público de 1,0 a 1,9;
- `Nivel 2`: valor público de 2,0 a 2,9;
- y así sucesivamente hasta `Nivel 9`;
- `Nivel 10`: valor público 10,0.

La pertenencia a la banda se determina con el Nivel público redondeado a un decimal, para que el jugador vea exactamente por qué integra esa clasificación. Dentro de la banda, el orden continúa usando el valor interno exacto. Por eso, en `Nivel 5`, quien más cerca esté de pasar a Nivel 6 tenderá a ocupar los primeros puestos.

Los umbrales de densidad se aplican después del filtro. Una provincia puede tener un ranking General establecido y, al mismo tiempo, un ranking Nivel 5 todavía en formación.

### 12.3 Categoría competitiva declarada

La categoría debe ser información estructurada y declarada; no se deduce automáticamente del Nivel BRAMU. Las categorías cambian por país, circuito y rama competitiva. “Sexta” no es una escala universal.

Recomendación:

- guardar desde V1, si Perfil ya lo requiere: país/esquema, rama, categoría y fecha de declaración;
- mostrarla como contexto en el perfil público con la etiqueta **declarada**;
- no usarla para ordenar ni desempatar;
- no usarla como filtro del Ranking V1: queda reemplazada en esta etapa por las bandas objetivas de Nivel BRAMU;
- reevaluarla en el futuro si aparece una necesidad competitiva real y el esquema está normalizado.

### 12.4 Género o rama competitiva

No conviene usar identidad de género como atajo para una división deportiva. Si se necesita filtrar competencia, el dato correcto es una **rama competitiva declarada** —por ejemplo, masculina, femenina, abierta/mixta o no declarada— separada de datos personales sensibles.

Recomendación V1:

- ranking universal abierto por defecto;
- conservar el modelo de datos preparado;
- no mostrar el filtro durante el piloto de baja densidad;
- habilitarlo cuando haya definición de perfil y cobertura suficiente tras filtrar.

Rama y categoría competitiva son datos secundarios futuros. No producen fórmulas, niveles ni historiales paralelos.

### 12.5 Filtros que no se recomiendan en V1

- edad;
- radio geográfico;
- barrio;
- club frecuente;
- rangos personalizados o móviles de Nivel;
- efectividad;
- cantidad de partidos;
- “solo activos esta semana”;
- grupos privados.

## 13. Filas, posición propia y perfil público

### 13.1 Datos de cada fila

Orden recomendado:

1. puesto;
2. movimiento semanal;
3. foto o avatar;
4. nombre visible y, si existe, `@usuario`;
5. Nivel BRAMU público con un decimal y check de calibrado;
6. contexto mínimo dependiente de la vista: localidad en Provincial/País/Global o banda de Nivel cuando esté activa.

No mostrar efectividad, cantidad de victorias, rachas ni última fecha exacta de juego en la fila principal. Esos datos recargan la comparación, pueden incentivar calendarios fáciles y pertenecen al perfil.

### 13.2 Precisión visible

La lista puede mostrar:

- jugador A: Nivel 5,4 · puesto 12;
- jugador B: Nivel 5,4 · puesto 13.

Una ayuda breve explica:

> BRAMU muestra el Nivel con un decimal, pero ordena usando su valor interno completo para evitar empates artificiales.

No se revela el valor de cuatro decimales.

### 13.3 Estructura de pantalla

- pestañas de ámbito arriba: Local, Provincial, País y Global;
- selector secundario General / Por Nivel;
- selector de banda cuando Por Nivel esté activo;
- título y cantidad elegible;
- tarjeta fija **Tu posición**;
- bloque **Cerca tuyo** con dos jugadores por encima y dos por debajo;
- acceso a la lista completa y búsqueda;
- fila propia resaltada de forma sobria y fijada si queda fuera del tramo visible;
- ayuda “Cómo funciona el Ranking BRAMU”.

No se recomienda un podio grande en V1. La primera tarea de la pantalla es ubicar al jugador en contexto, no convertir a tres personas en protagonistas permanentes.

### 13.4 Conexión con perfil público

Al tocar una fila se abre el perfil público del jugador. Allí pueden mostrarse:

- Nivel BRAMU y estado;
- posiciones actuales en los ámbitos donde sea elegible;
- localidad principal de juego;
- banda de Nivel y, si el perfil ya lo contempla, categoría competitiva declarada como dato secundario;
- efectividad y partidos oficiales como contexto, con tamaño de muestra;
- historial permitido por privacidad.

El perfil no debe mostrar posiciones de universos que no alcanzan el umbral mínimo. Para el propio usuario, una explicación privada indica qué requisito le falta para aparecer.

## 14. Motivación sin competencia tóxica

Ranking BRAMU debe reforzar progreso y pertenencia, no ansiedad por defender un número.

### 14.1 Elementos recomendados

- “Tu posición” antes del Top general.
- Denominador siempre visible: “18 de 74”.
- Jugadores cercanos en el orden, no solo líderes.
- Movimiento semanal, no notificaciones por cada cambio.
- Hitos sobrios: primera posición oficial, ingreso al Top 50% o mejor posición histórica, solo con ranking establecido.
- Explicaciones neutrales: “Subiste 3 puestos esta semana”.
- Control para dejar de aparecer sin perder el Nivel.
- Reconocer calibración, diversidad de rivales y regreso a la actividad sin otorgar puntos de ranking.

### 14.2 Elementos a evitar

- “Te superó Juan” o mensajes dirigidos contra una persona;
- alertas rojas por bajar puestos;
- cuenta regresiva amenazante por inactividad;
- recompensas por cargar muchos partidos;
- compartir “Nº1” en universos en formación;
- humillación de últimos puestos;
- rachas que penalicen descanso, lesión o vacaciones;
- comparación automática con desconocidos fuera del contexto elegido.

## 15. Integridad y manipulación

La defensa principal es que Ranking no agrega puntos: hereda el Nivel consolidado y sus protecciones. Aun así, necesita reglas propias.

### 15.1 Partidos

Solo afectan el orden cuando ya afectaron oficialmente el Nivel BRAMU. Por lo tanto:

- pendiente de validación: no;
- observado por espectador: no;
- disputado: no;
- anulado: no;
- duplicado: una sola identidad y un solo efecto;
- cargado o validado fuera de la ventana de 30 días: historial sí, Nivel y Ranking no;
- abandono, walkover o score inválido: no en V1;
- corrección: revierte y recalcula según el contrato de Nivel V1.4.

### 15.2 Grupos cerrados

El factor de repetición, compañero y círculo competitivo de Nivel V1.4 ya reduce la inflación producida por jugar siempre dentro de la misma red. Ranking no debe volver a castigar esos partidos ni diseñar un segundo descuento.

Sí debe conservar métricas de integridad:

- proporción de rivales repetidos;
- tamaño del componente competitivo conectado;
- concentración de partidos dentro de grupos pequeños;
- correcciones, rechazos y disputas;
- saltos de nivel o posición anómalos;
- cambios frecuentes de ubicación;
- identidades duplicadas o cuentas coordinadas.

Una señal anómala no equivale automáticamente a fraude. Puede activar revisión o exclusión temporal sin acusación pública y sin reescribir Nivel silenciosamente.

### 15.3 Ubicación y universos pequeños

La combinación de selector estructurado, historial de cambios, cooldown de 30 días, denominador visible y umbrales de densidad reduce el incentivo de declararse en una localidad pequeña para obtener un “Nº1”. No se necesita GPS para V1.

### 15.4 Categoría declarada

Como categoría y rama solo filtran, pero no modifican el orden base, declarar estratégicamente una categoría no aumenta el Nivel. Si el filtro se habilita en el futuro, la etiqueta “declarada” y los umbrales de densidad deben permanecer visibles.

## 16. Dependencias

### 16.1 Nivel BRAMU

Ranking depende de:

- valor interno consolidado de cuatro decimales;
- valor público redondeado;
- estado del Nivel;
- fecha del último partido computable;
- nivel consolidado separado del provisional de recalibración;
- eventos de corrección o anulación;
- versión del algoritmo.

Ranking no recalcula fuerza, expectativa, margen, confianza ni deltas.

### 16.2 Validación de partidos

Sin validación rival y estado oficial no existe efecto en Nivel ni Ranking. El modelo pendiente/validado/disputado/observado es por lo tanto una dependencia funcional, no un detalle posterior.

El ranking puede diseñarse y simularse antes, pero no puede considerarse real mientras los partidos sigan siendo registros locales sin identidad y validación confiables.

### 16.3 Identidad y perfil público

Se necesitan:

- cuenta única por jugador;
- identidad estable independiente del nombre visible;
- `@usuario` único si se implementa;
- perfil público y configuración de privacidad;
- vínculo explícito de invitados reclamados;
- mecanismo para resolver duplicados sin fusionar por coincidencia de nombre.

### 16.4 Ubicación estructurada

El backend debe usar identificadores canónicos para país, provincia y localidad. El texto visible puede cambiar sin romper el universo. Se recomienda almacenar código ISO de país, identificador administrativo y un identificador de localidad del proveedor elegido, además de la etiqueta visible.

## 17. Contrato mínimo de backend

### 17.1 Estado actual del jugador para Ranking

- `player_id` estable;
- `ranking_opt_in`;
- `public_profile_enabled`;
- `ranking_integrity_status`;
- `country_code`;
- `admin_area_id` y etiqueta;
- `locality_id` y etiqueta;
- `location_effective_from`;
- rama competitiva declarada, si existe;
- esquema y categoría declarados, si existen;
- `level_mu_internal` consolidado;
- `level_public`;
- `level_band_key` derivada del Nivel público;
- estado de Nivel;
- `last_rated_at`;
- versión de Nivel;
- estado de elegibilidad derivado y código de motivo.

### 17.2 Eventos que deben conservarse

- entrada o salida por calibración;
- cambio de Nivel consolidado;
- inicio/cierre/expiración de recalibración;
- validación, corrección y anulación de partidos;
- entrada y salida por inactividad, cuando se cierre la ventana correspondiente;
- cambio de ubicación;
- cambio de privacidad u opt-in;
- resolución de duplicados;
- retención o restitución por integridad;
- versión de reglas de Ranking.

Cada evento necesita fecha efectiva, fecha de procesamiento, origen y datos anteriores/nuevos suficientes para auditoría.

### 17.3 Snapshot de ranking

Se recomienda conservar un corte semanal completo de cada universo territorial base. Cada fila del snapshot debe guardar:

- `ranking_snapshot_id` y fecha/hora;
- versión de reglas de Ranking;
- tipo e identificador de universo;
- `player_id`;
- puesto visible y grupo de empate;
- cantidad total elegible;
- estado de densidad: insuficiente, en formación o establecido;
- Nivel interno y público en ese momento;
- banda fija de Nivel en ese momento;
- estado de Nivel;
- última actividad computable;
- ubicación estructurada vigente;
- rama y categoría vigentes;
- estado y motivo de elegibilidad.

No alcanza con guardar solamente “Juan estaba 12º”. Para reconstruir una posición histórica se necesita saber quiénes integraban el universo, qué niveles tenían, qué filtros eran aplicables y qué versión de reglas estaba vigente.

### 17.4 Posición actual y filtros

La posición actual puede calcularse desde una vista materializada o consulta ordenada. La banda fija de Nivel se deriva del Nivel público guardado en el snapshot. No conviene precrear todas las combinaciones posibles de territorio, banda, categoría y rama.

Mis jugadores se calcula sobre vínculos históricos de partidos validados y el estado actual de sus miembros. Si en el futuro se necesita reconstruir su posición personal exacta en una fecha, los vínculos también deben tener vigencia temporal.

### 17.5 Versionado

Debe existir `ranking_rules_version`, independiente de `algorithm_version` de Nivel. Cambiar la ventana de actividad, los umbrales de densidad o la definición de Mis jugadores crea una nueva versión de reglas de Ranking, aunque el Nivel no cambie.

## 18. Casos y límites

### Caso 1 — Mismo decimal, distinto puesto

Ana tiene 5,44 y Paula 5,36 internamente. Ambas ven 5,4. Ana queda arriba. Una ayuda explica que el orden usa precisión interna.

### Caso 2 — Empate exacto

Lucía y Carla tienen 6,1274. Ambas ocupan el puesto 4; el siguiente jugador ocupa el 6. Efectividad y partidos no rompen el empate.

### Caso 3 — Jugador calibrando muy alto

Martín muestra Nivel estimado 8,2 y `CALIBRANDO · 3/5`. No ocupa puesto territorial. En Mis jugadores aparece en la sección Calibrando.

### Caso 4 — Fin de calibración

Martín completa el quinto partido computable y el tercer rival diferente. Entra de inmediato con el Nivel consolidado resultante y movimiento `Nuevo`.

### Caso 5 — Recalibración

Sofía tenía Nivel consolidado 6,4 y una referencia provisional 6,8. Mientras recalibra, su ranking sigue usando 6,4. Al cerrar la recalibración, usa el nuevo consolidado.

### Caso 6 — Baja de puesto sin jugar

Seba conserva Nivel 5,7. Dos jugadores del mismo universo suben a 5,8. Seba baja dos puestos. La UX no afirma que empeoró: muestra solamente `−2 puestos`.

### Caso 7 — Inactividad

Un líder llega al día 181 sin partido computable validado. Sale temporalmente del ranking; su Nivel permanece. Al validar un nuevo partido reingresa como `Nuevo`.

### Caso 8 — Localidad con cuatro personas

Bella Vista tiene cuatro elegibles. No publica posiciones ni “Nº1”. Muestra el estado de comunidad y ofrece ver Provincia de Buenos Aires. Muñiz y San Miguel no se agregan.

### Caso 9 — Universo con 8 personas

La clasificación muestra “3 de 8 · Bella Vista” y la etiqueta `En formación`. No genera podio, corona ni logro compartible.

### Caso 10 — Filtro de Nivel que rompe densidad

Un ranking provincial general establecido tiene 84 jugadores. El filtro `Nivel 5` deja 7: publica posiciones `N de 7`, pero las identifica como clasificación en formación. Si dejara solo 4, no publicaría puestos y ofrecería volver a General.

### Caso 11 — Partido pendiente

Un resultado cargado ayer todavía no fue validado por la pareja rival. No cambia Nivel ni Ranking. Al validarse, ambos sistemas se actualizan.

### Caso 12 — Corrección

Un partido validado tenía ganadora incorrecta. Nivel revierte y recalcula según V1.4; Ranking procesa el nuevo consolidado y conserva el evento. No se edita una fila manualmente.

### Caso 13 — Cambio de localidad

Una jugadora cambia su localidad principal de Bella Vista a Córdoba. Sale de los universos anteriores, entra como `Nuevo` en los nuevos y mantiene el mismo Nivel.

### Caso 14 — Círculo cerrado

Doce amigos juegan casi siempre entre sí. Nivel V1.4 reduce la evidencia de ese círculo. Ranking simplemente ordena el Nivel resultante; no entrega puntos por volumen ni duplica la penalización.

### Caso 15 — Invitados

Un partido computa para los usuarios conocidos según las reglas de disponibilidad de Nivel V1.4. El invitado sin cuenta no aparece en Ranking y la imputación del partido nunca crea un perfil o puesto para él.

### Caso 16 — Mis jugadores con solo dos elegibles

La vista muestra a ambos y sus niveles como comparación personal, pero no asigna “1 de 2” ni genera un líder. Al incorporarse un tercer jugador elegible, habilita posiciones “N de 3”.

### Caso 17 — Cambio de banda de Nivel

Seba pasa de Nivel público 5,9 a 6,0. Sale de la clasificación `Nivel 5` y entra en `Nivel 6` como `Nuevo`, probablemente en una posición más baja dentro de esa banda. Su puesto General se recalcula normalmente y no se reinicia.

### Caso 18 — Apertura de Global

Hasta hoy todos los elegibles estaban en Argentina y la pestaña Global permanecía bloqueada. Entra la primera jugadora elegible con ubicación principal de juego en Uruguay: Global se desbloquea. Si todavía reúne menos de cinco elegibles, informa que el universo está formándose pero no publica puestos.

## 19. UX V1 recomendada

### 19.1 Entrada durante el piloto

Orden de ámbitos:

1. Mis jugadores;
2. Local;
3. Provincial;
4. País;
5. Global.

Mis jugadores se abre por defecto durante el piloto. Las cuatro pestañas territoriales replican el patrón visual de pestañas ya utilizado por Historial y Mis grupos. Cuando el ranking local de un usuario sea establecido y el producto tenga suficiente densidad, puede evaluarse convertir Local en la entrada predeterminada.

### 19.2 Jerarquía

1. **Ámbito**: Local, Provincial, País o Global.
2. **Tipo**: General o Por Nivel; al elegir Por Nivel se habilita el selector de banda.
3. **Tu posición**: puesto, total, Nivel y movimiento semanal.
4. **Cerca tuyo**: dos posiciones superiores y dos inferiores.
5. **Clasificación**: lista completa o primeros resultados con paginación.
6. **Cómo funciona**: explicación breve de elegibilidad, actividad y precisión.

### 19.3 Estados propios

- No completó estimación: CTA a Nivel BRAMU.
- Calibrando: progreso X/5 y aclaración “Todavía no ocupás una posición”.
- Calibrado pero sin ubicación: CTA a elegir localidad principal.
- Perfil privado/opt-out: CTA a revisar privacidad.
- Inactivo: explicación y requisito de un partido computable.
- Universo insuficiente: cantidad actual y acceso al ámbito superior o a General.
- Global bloqueado: explicación de que todavía no hay elegibles en más de un país.
- Elegible: posición completa.

### 19.4 Copy esencial

> **Tu Ranking BRAMU**  
> Tu posición entre jugadores con Nivel BRAMU calibrado y actividad reciente.

> **¿Por qué cambió mi puesto si no jugué?**  
> El ranking compara tu nivel con el de otros jugadores. Podés mantener tu nivel y cambiar de posición cuando otros entran, salen o actualizan el suyo.

> **¿Por qué aparece una variación semanal?**  
> Tu puesto es actual y continuo. La flecha solo lo compara con el último corte semanal; el ranking no empieza de cero cada semana.

> **Sin posición por inactividad**  
> Tu Nivel BRAMU se mantiene. Validá un nuevo partido para volver a aparecer.

## 20. Alcance V1 y evoluciones

### V1

- ranking individual continuo;
- orden por Nivel consolidado exacto;
- sin puntos propios de Ranking;
- elegibilidad automática;
- exclusión de calibrando de posiciones oficiales;
- recalibrando usa consolidado anterior;
- salida temporal al comenzar el día 181 sin partido computable validado;
- Mis jugadores por partidos validados;
- Local, Provincial, País y Global estructurados;
- Global bloqueado hasta representar al menos dos países;
- clasificación General y por bandas fijas de Nivel;
- umbrales 0–4, 5–14 y 15+;
- posiciones compartidas en empate exacto;
- movimiento contra corte semanal;
- posición propia y jugadores cercanos;
- filas simples y acceso al perfil público;
- búsqueda por nombre/usuario;
- snapshots y versionado;
- métricas de densidad e integridad.

### Preparar datos, no exponer todavía

- rama competitiva, esquema y categoría declarada, si Perfil ya los necesita;
- historial de ubicación;
- vínculos temporales de Mis jugadores;
- capacidad de derivar filtros históricos.

### Futuro

- filtros de rama y categoría competitiva cuando haya densidad, normalización y una necesidad diferenciada de las bandas de Nivel;
- barrios, radios o zonas explícitamente definidas;
- explorar otros territorios;
- rankings privados de Mis grupos;
- temporadas o Race BRAMU;
- rankings de clubes o torneos verificados;
- mejores posiciones históricas y logros compartibles;
- rankings por edades, solo si aparece una necesidad competitiva real;
- capas superiores de verificación para premios;
- modelos de conectividad territorial más sofisticados;
- seguimiento voluntario de jugadores sin partido compartido.

## 21. Reglas preparadas para desarrollo

1. Ranking V1 nunca calcula ni modifica Nivel BRAMU.
2. La clave de orden es el Nivel consolidado interno exacto descendente.
3. Empate exacto comparte puesto y utiliza ranking de competición.
4. Solo CALIBRADO y RECALIBRANDO con consolidado previo pueden ser elegibles.
5. El jugador necesita cuenta activa, perfil público, opt-in y ubicación completa.
6. La posición vence al comenzar el día 181 desde `last_rated_at`.
7. Reingresar requiere un partido computable validado y se muestra como `Nuevo`.
8. Partidos no computables nunca generan un efecto directo de Ranking.
9. Localidad es exacta y estructurada; no se agrupan zonas automáticamente.
10. Cambio de ubicación tiene historial y cooldown de 30 días.
11. Con 0–4 elegibles: no publicar puestos.
12. Con 5–14: publicar puestos `N de total` en formación, sin reconocimientos de liderazgo.
13. Desde 15: ranking establecido para la UX inicial.
14. Mis jugadores se define por partidos validados compartidos: exige tres elegibles para publicar puestos, pero no aplica los umbrales territoriales.
15. Efectividad no ordena ni desempata.
16. Cada ámbito tiene vista General y Por Nivel; las bandas se derivan del Nivel público y el orden interno siempre usa el Nivel exacto.
17. Posición actual se actualiza por eventos; movimiento compara cortes semanales equivalentes.
18. Un cambio de universo o primera elegibilidad produce estado `Nuevo`, no delta.
19. Cada puesto visible incluye denominador y universo.
20. Toda fila abre el perfil público respetando privacidad.
21. Ranking conserva eventos, snapshots completos y versión de reglas.
22. No existe administración manual de filas del ranking general.
23. Integridad puede excluir temporalmente por estado, pero no reordenar personas a mano.
24. Global se desbloquea cuando haya elegibles en al menos dos países y luego respeta los umbrales de densidad.
25. Categoría competitiva y rama no alteran Nivel ni orden; son filtros futuros.
26. Mis grupos, matchmaking y temporadas quedan fuera de V1.

## 22. Criterios de aceptación de producto

Ranking BRAMU V1 estará funcionalmente listo para handoff cuando:

- cada jugador de prueba reciba la posición correcta a partir del Nivel interno;
- los empates produzcan puestos `1, 1, 3`;
- calibrando y partidos pendientes no alteren el universo elegible;
- recalibrando use el consolidado anterior;
- la salida al comenzar el día 181 y el reingreso por inactividad sean reproducibles;
- las cuatro jerarquías territoriales usen identificadores estructurados;
- ningún ámbito publique puestos con menos de 5 elegibles;
- las bandas de Nivel se deriven del valor público y ordenen por el valor interno;
- Global permanezca bloqueado hasta representar al menos dos países;
- los cambios semanales se reconstruyan desde snapshots;
- las correcciones y anulaciones no dupliquen efectos;
- el perfil público y la privacidad sean coherentes con la fila;
- Mis jugadores pueda explicarse sin recurrir a Mis grupos;
- las reglas estén versionadas y existan fixtures para todos los casos de la sección 18.

## 23. Métricas para el piloto

Antes de revisar reglas se deben observar al menos:

- cantidad de jugadores elegibles por localidad, provincia, país y Global;
- cantidad de países representados por jugadores elegibles;
- cantidad de elegibles por banda fija de Nivel en cada ámbito;
- porcentaje de universos en cada estado de densidad;
- porcentaje de perfiles calibrados que aparecen en Ranking;
- tiempo desde alta hasta primera posición;
- porcentaje que queda fuera por ubicación, privacidad o inactividad;
- distribución de posiciones y Nivel;
- movimientos semanales medianos y extremos;
- frecuencia de altas, bajas y reingresos;
- cantidad de empates internos exactos y empates solo visibles por redondeo;
- diversidad de rivales y tamaño de componentes competitivos;
- concentración de partidos en círculos cerrados;
- disputas, correcciones, duplicados y cambios de ubicación;
- uso de Mis jugadores frente a ámbitos territoriales;
- consultas a “Cómo funciona” y abandono de la pantalla;
- desactivación voluntaria de Ranking.

Los umbrales iniciales de 5 y 15, la ventana de actividad de 180 días y el cooldown de ubicación de 30 días son parámetros de producto versionados. Pueden cambiar después del piloto sin modificar Nivel BRAMU, siempre que el cambio se documente y no reescriba silenciosamente snapshots históricos.

## 24. Estado de decisiones al 11 de septiembre de 2026

### Cerradas

- Ranking BRAMU V1 es una clasificación relativa condicionada, no una segunda fórmula deportiva.
- Ordena por el Nivel BRAMU consolidado interno exacto.
- No utiliza puntos de ranking, efectividad ni volumen como desempate.
- Es continuo; las temporadas quedan separadas y futuras.
- Los jugadores CALIBRANDO se muestran sin puesto; entran como `Nuevo` al calibrarse.
- Al comenzar el día 181 sin partido computable validado, el jugador pierde temporalmente la posición sin perder su Nivel.
- Recalibrando conserva la posición basada en el último consolidado.
- Local, Provincial, País y Global dependen de ubicación estructurada declarada.
- Global se mantiene bloqueado hasta que haya jugadores elegibles en al menos dos países.
- Local significa localidad exacta; no existe agrupación automática por zona.
- Mis jugadores surge de partidos validados compartidos y no es Mis grupos.
- Con 0–4 elegibles no se publican puestos.
- Con 5–14 la clasificación está en formación y no genera prestigio compartible de liderazgo.
- Desde 15 se considera establecida a efectos de UX inicial.
- Empates exactos comparten puesto.
- Movimiento se compara semanalmente; el orden actual se actualiza por eventos.
- Cada posición incluye universo y denominador.
- Cada ámbito posee una vista General y vistas por bandas fijas de Nivel BRAMU.
- Categoría competitiva y rama son datos secundarios y filtros futuros, no sistemas separados.
- La V1 prioriza posición propia y jugadores cercanos sobre podios.
- Perfil público, validación de partidos, identidad y backend auditable son dependencias obligatorias.

### Sin pendientes funcionales para V1

La Race BRAMU, los rankings privados de grupos y los filtros competitivos futuros están explícitamente fuera de alcance. Requerirán definiciones propias si se priorizan, pero no bloquean el diseño ni el desarrollo de Ranking BRAMU V1.

## Fuentes

[^1]: BRAMU Lab. `Nivel_BRAMU_Formula_V1_4_Cerrada.md`. Documento privado de producto, 10 de septiembre de 2026.
[^2]: BRAMU Lab. `Nivel_BRAMU_Handoff_Desarrollo_V1.md`. Documento privado de producto, 10 de septiembre de 2026.
[^3]: BRAMU Lab. `Nivel_BRAMU_Consolidado_Base.md`. Documento privado de producto, 10 de septiembre de 2026.
[^4]: BRAMU Lab. `BRAMUlab_Backlog.md`, sección 1, “Modelo de validación de partidos”. Documento privado de producto, actualizado el 4 de septiembre de 2026.
[^5]: Lawn Tennis Association. [“Understanding your tennis ranking”](https://www.lta.org.uk/compete/wtn-rankings/understanding-your-lta-ranking/). Consultado el 10 de septiembre de 2026.
[^6]: UTR Sports. [“Understanding the Algorithm — Complete Summary”](https://support.universaltennis.com/en/support/solutions/articles/9000151830-understanding-the-algorithm-complete-summary). Consultado el 10 de septiembre de 2026.
[^7]: Playtomic. [“How the Playtomic level system works”](https://playerhelp.playtomic.com/hc/en-gb/articles/43310980754193-How-the-Playtomic-level-system-works). Actualizado el 9 de junio de 2026; consultado el 10 de septiembre de 2026.
[^8]: DUPR. [“How It Works”](https://www.dupr.com/how-it-works). Consultado el 10 de septiembre de 2026.
[^9]: DUPR. [“DUPR Rankings”](https://www.dupr.com/rankings). Actualizado el 15 de julio de 2026; consultado el 10 de septiembre de 2026.
[^10]: International Padel Federation. [“FIP Rankings”](https://www.padelfip.com/fip-rankings/). Corte publicado el 7 de septiembre de 2026; consultado el 10 de septiembre de 2026.
[^11]: Strava. [“Clubs on Strava — Club Leaderboards”](https://support.strava.com/en-us/articles/15402172-clubs-on-strava). Consultado el 10 de septiembre de 2026.
[^12]: Muhammad Zia Hydari, Idris Adjerid y Aaron D. Striegel. [“Health Wearables, Gamification, and Healthful Activity”](https://arxiv.org/abs/2301.02767). 2023.
[^13]: Mads Kock Pedersen, Nanna Ravn Rasmussen, Jacob F. Sherson y Rajiv Vaid Basaiawmoit. [“Leaderboard Effects on Player Performance in a Citizen Science Game”](https://arxiv.org/abs/1707.03704). 2017.
