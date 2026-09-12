# Ranking BRAMU

**Estado:** V1 cerrada y lista para handoff de producto, UX y desarrollo.  
**Alcance:** Ranking BRAMU individual para pádel amateur de dobles. No redefine Nivel BRAMU, no crea matchmaking y no incluye rankings privados de grupos.  
**Fecha de actualización:** 11 de septiembre de 2026.  
**Cambio normativo principal de esta revisión:** Ranking BRAMU pasa de continuo a **publicación semanal**. Nivel BRAMU continúa siendo dinámico y se actualiza partido a partido.

---

## Resumen ejecutivo

Ranking BRAMU representa la **posición relativa y contextual de un jugador dentro de un universo elegible**, ordenado por el valor interno exacto de su **Nivel BRAMU consolidado**.

Nivel BRAMU y Ranking BRAMU responden preguntas distintas:

- **Nivel BRAMU:** qué capacidad competitiva estima BRAMU para este jugador.
- **Ranking BRAMU:** en qué puesto quedó publicado este jugador dentro de un universo concreto en la edición semanal vigente.

Ranking BRAMU V1 **no tiene puntos propios**. No existe “puntaje BRAMU de Ranking”. El orden se obtiene exclusivamente a partir del Nivel BRAMU consolidado interno exacto y de las reglas de elegibilidad, territorio, actividad, privacidad y densidad.

### Cadencia cerrada

- **Nivel BRAMU es dinámico:** puede cambiar después de cada partido computable y validado.
- **Ranking BRAMU es semanal:** se publica una vez por semana.
- Semana computable inicial: **lunes 00:00:00 a domingo 23:59:59**.
- Zona horaria inicial: **`America/Argentina/Buenos_Aires`**.
- El lunes 00:00:00 queda constituida una nueva edición del Ranking usando el Nivel BRAMU consolidado vigente de cada jugador al cierre del domingo.
- La posición publicada y el Nivel usado para esa edición permanecen estables durante toda la semana.
- Los partidos computables que se validen después del cierre pueden cambiar el Nivel actual del jugador, pero impactan recién en la siguiente edición del Ranking.
- Un Ranking ya publicado **no se reescribe retroactivamente** porque un partido viejo se cargue o valide tarde.

La publicación semanal toma como referencia el patrón deportivo habitual de rankings profesionales, pero BRAMU **no copia** sistemas de puntos ni ventanas de 52 semanas: su Ranking sigue siendo una clasificación por Nivel.

---

## 1. Fuentes y autoridad documental

Ranking BRAMU depende de la normativa vigente de Nivel BRAMU:

1. `Nivel_BRAMU_Formula_V1.4.md` — fórmula y parámetros.
2. `Nivel_BRAMU_Implementacion.md` — contrato de implementación y versionado.
3. `Nivel_BRAMU.md` — contexto funcional y estados.
4. `BRAMUlab_Backlog.md` — validación de partidos y decisiones futuras relacionadas.

Ranking no modifica la fórmula de Nivel BRAMU.

En caso de contradicción entre una versión anterior de este documento y esta revisión, prevalece esta revisión del 11 de septiembre de 2026.

---

## 2. Tres conceptos que no deben mezclarse

| Concepto | Qué representa | Unidad | Cuándo cambia |
|---|---|---|---|
| **Nivel BRAMU** | Estimación individual de capacidad competitiva | 1,0–10,0 | Partido a partido, según reglas de Nivel |
| **Ranking BRAMU** | Posición publicada dentro de un universo elegible | Puesto “N de total” | En la publicación semanal |
| **Mis grupos** | Espacios sociales/privados | Membresía y puntos propios del grupo si aplica | Según lógica de cada grupo |

Consecuencias:

- Un jugador puede mejorar su Nivel el miércoles y conservar el mismo puesto de Ranking hasta el lunes siguiente.
- Dos jugadores pueden mostrar el mismo Nivel público redondeado y ocupar puestos distintos porque el orden usa el valor interno exacto congelado en el snapshot semanal.
- Entrar o salir del Ranking no modifica el Nivel.
- Mis grupos no modifica Ranking oficial.
- No existe un sistema de “puntos BRAMU” de Ranking.

---

## 3. Decisión central: Ranking semanal ordenado por Nivel

### 3.1 Regla de orden

Cada edición semanal se ordena por:

1. Nivel BRAMU consolidado interno exacto, descendente;
2. si dos valores son exactamente iguales a la precisión almacenada, comparten puesto;
3. el siguiente puesto usa ranking de competición: `1, 1, 3`;
4. un identificador estable solo ordena técnicamente filas empatadas y nunca rompe el empate visible.

No se utiliza para ordenar ni desempatar:

- efectividad;
- victorias o derrotas;
- rachas;
- cantidad de partidos;
- frecuencia de uso;
- categoría declarada;
- número de contactos;
- pertenencia a grupos.

### 3.2 Sin puntos propios

Ranking V1 no suma puntos por ganar, jugar más o participar más.

Crear puntos de Ranking en esta etapa:

- duplicaría una lógica deportiva que ya resuelve Nivel;
- podría contradecir el Nivel;
- favorecería volumen/farming;
- agregaría una segunda fórmula difícil de explicar.

La unidad deportiva base sigue siendo **Nivel BRAMU**. Ranking solo publica su orden relativo.

---

## 4. Semana de Ranking y cierre

### 4.1 Ventana temporal

Semana de Ranking:

- inicio: **lunes 00:00:00**;
- cierre: **domingo 23:59:59**;
- timezone V1: **`America/Argentina/Buenos_Aires`**.

Ejemplo:

`Ranking semanal · Lun 31 ago — Dom 06 sep`

La edición resultante se publica al comenzar el lunes siguiente.

### 4.2 Qué dato se congela

Para cada jugador elegible se conserva en el snapshot:

- Nivel interno exacto usado para ordenar;
- Nivel público visible correspondiente a ese corte;
- posición;
- denominador;
- universo;
- estado de elegibilidad;
- ubicación;
- banda de Nivel;
- reglas/versiones aplicadas.

Durante la semana siguiente, el Perfil/Home puede mostrar un Nivel actual distinto del Nivel del corte de Ranking.

Ejemplo:

- Nivel actual en Perfil: **5,6**
- Nivel usado por el Ranking semanal vigente: **5,3**
- Ranking: **#18 de 124**

Eso es correcto y debe poder explicarse desde la ayuda.

### 4.3 Partidos cargados tarde

Para afectar una edición semanal, el partido debe haber quedado **computable y validado antes del cierre**.

Un partido jugado el domingo a las 22:00 pero cargado o validado el lunes:

- puede modificar el Nivel actual cuando quede computable;
- **no modifica retroactivamente** el Ranking ya publicado;
- impacta en la edición siguiente.

Esta regla mantiene snapshots auditables y evita reescribir posiciones históricas.

### 4.4 Importancia de cargar el partido al terminar

BRAMU debe recomendar cargar el partido apenas termina.

Motivos:

- reduce olvidos y errores de score;
- facilita la validación de los demás jugadores mientras el partido está fresco;
- permite que el Nivel se actualice cuanto antes;
- aumenta la probabilidad de que el resultado entre en la edición semanal que corresponde;
- evita que un partido del domingo quede fuera del corte por haberse cargado después.

Copy orientativo:

> **Cargá el partido cuando termina.**  
> Así el resultado puede validarse a tiempo, actualizar tu Nivel y entrar en el próximo Ranking semanal.

No debe presentarse como amenaza ni penalización: es una recomendación de uso y una consecuencia natural del cierre semanal.

---

## 5. Movimiento semanal

La flecha de Ranking expresa **puestos**, nunca puntos.

Ejemplos:

- `↑ 4 puestos` = subió cuatro posiciones respecto de la edición semanal anterior comparable.
- `↓ 2 puestos` = bajó dos posiciones.
- `—` = mantuvo el mismo puesto.
- `Nuevo` = no existe una posición comparable anterior.

No existe “subió 4 puntos BRAMU” dentro del Ranking.

### 5.1 Regla comparativa

El movimiento compara:

**posición de la edición semanal vigente**
vs.
**posición de la edición semanal anterior equivalente**

Debe compararse el mismo universo/filtro cuando sea posible.

Un jugador puede subir sin haber jugado si, por ejemplo, otros jugadores:

- salen por inactividad;
- cambian de territorio;
- dejan de ser elegibles;
- quedan debajo por su Nivel al nuevo corte.

La UX nunca debe interpretar automáticamente `↑` como “jugó mejor esta semana”; solo significa **movimiento de puestos**.

### 5.2 Copy recomendado

Preferir, cuando haya espacio:

`↑ 4 puestos vs. semana anterior`

En espacios compactos puede mostrarse `↑ 4`, siempre que la ayuda deje claro que son puestos.

---

## 6. Universo y elegibilidad

Un universo es el conjunto de jugadores que cumplen simultáneamente:

- mismo ámbito seleccionado;
- filtros explícitos vigentes;
- participación habilitada;
- condiciones de elegibilidad;
- actividad requerida.

Un jugador ocupa puesto territorial solo si:

1. tiene cuenta activa e identidad estable;
2. perfil público;
3. opt-in de Ranking habilitado;
4. ubicación estructurada completa;
5. estado de Nivel `CALIBRADO`, o `RECALIBRANDO` con consolidado anterior;
6. no superó 180 días sin partido computable validado;
7. no está excluido por integridad/cuenta.

### 6.1 Calibración

Para completar calibración se requieren simultáneamente:

- mínimo **5 partidos computables**;
- mínimo **3 rivales distintos**.

Los jugadores calibrando no ocupan posiciones oficiales.

### 6.2 Recalibración

Mientras un jugador está recalibrando:

- conserva su último Nivel consolidado válido para Ranking;
- el nuevo valor provisional no altera su puesto hasta consolidarse y llegar al siguiente corte semanal.

---

## 7. Inactividad

- 0–60 días: sin cambio de elegibilidad.
- 61–150 días: conserva posición.
- desde día 151: puede aparecer aviso privado.
- al comenzar el día 181: deja de ocupar posición oficial.

La inactividad no borra ni reduce el Nivel BRAMU.

Para reingresar:

1. debe existir un nuevo partido computable validado;
2. Nivel procesa el partido;
3. en la siguiente publicación semanal elegible vuelve a aparecer;
4. su movimiento se muestra como `Nuevo`, no como delta contra una posición antigua no comparable.

---

## 8. Ámbitos

Orden UX vigente:

1. **Local**
2. **Provincial**
3. **País**
4. **Global**
5. **Mi red**

**Local** es el estado inicial del Ranking.

### 8.1 Local

- localidad principal de juego exacta;
- no se agrupan automáticamente Bella Vista, Muñiz, San Miguel ni otras localidades;
- no se usa GPS;
- si hay poca densidad, se ofrece ver Provincial.

### 8.2 Provincial

Mismo país y misma provincia/estado.

### 8.3 País

Mismo país de ubicación principal de juego.

### 8.4 Global

- se desbloquea cuando existen jugadores elegibles en al menos dos países;
- una vez desbloqueado respeta las mismas reglas de densidad.

### 8.5 Cambio de ubicación

- usa datos estructurados;
- queda auditado;
- cooldown inicial de 30 días;
- al cambiar de universo entra como `Nuevo` en la siguiente edición semanal;
- no arrastra una flecha del territorio anterior.

---

## 9. Mi red

`Mi red` reemplaza el antiguo nombre `Mis jugadores` dentro del Ranking.

Es una vista personal de vínculos deportivos, no una lista manual de contactos y no es Mis grupos.

Incluye automáticamente:

- el propio usuario;
- jugadores registrados con quienes compartió al menos un partido computable/validado dentro de los últimos **180 días**.

No incluye automáticamente:

- toda la agenda;
- personas agregadas manualmente sin partido;
- miembros de grupos con quienes nunca jugó;
- invitados no reclamados como usuarios.

### 9.1 Ventana de 180 días

La relación permanece en Mi red mientras exista al menos un partido computable compartido dentro de los últimos 180 días.

Si vuelven a jugar, la vigencia se renueva.

### 9.2 Ocultar

El usuario puede elegir:

`Ocultar de Mi red`

Eso:

- no elimina partidos;
- no modifica Nivel;
- no modifica Ranking oficial;
- no afecta al otro jugador;
- solo cambia la vista personal.

Los ocultos se gestionan mediante:

`Ocultos (N)`

y pueden restaurarse con:

`Volver a mostrar en Mi red`

---

## 10. Densidad y representatividad

Umbrales territoriales V1:

| Elegibles | Estado | Posiciones |
|---:|---|---|
| 0–4 | Comunidad insuficiente | No |
| 5–14 | En formación | Sí, siempre `N de total`, sin prestigio/podio |
| 15+ | Establecido | Sí, tratamiento normal |

Los umbrales se aplican después de filtros.

`Mi red` no usa los umbrales territoriales:

- 1–2 elegibles: comparación simple, sin puesto;
- desde 3: posiciones `N de total`;
- calibrando/inactivos pueden verse sin puesto.

---

## 11. Género / rama competitiva en V1

La UI vigente del prototipo separa Ranking:

- Masculino
- Femenino

El selector es compacto y por defecto usa la rama/género deportivo correspondiente al usuario.

Para backend real, conviene guardar la **rama competitiva declarada** como dato específico de competición, separado de otros datos personales.

`Mi red` puede contener personas de ambas ramas; el selector determina qué clasificación se muestra.

El lima sigue siendo el color principal de BRAMU; azul y magenta pueden usarse como acentos secundarios.

---

## 12. Filtro de Nivel

Nivel es **un filtro del Ranking**, no un modo paralelo.

UI:

- `Todos los niveles`
- `Mi nivel · Nivel X`
- `Nivel 1` ... `Nivel 10`

Las bandas se determinan por Nivel público:

- Nivel 1: 1,0–1,9
- ...
- Nivel 9: 9,0–9,9
- Nivel 10: 10,0

Dentro de cada banda el orden usa el valor interno exacto congelado en el snapshot semanal.

Los umbrales de densidad se aplican después del filtro.

---

## 13. UX vigente recomendada

### 13.1 Header

`RANKING BRAMU` + lupa + ayuda `?`

- lupa: búsqueda/filtro de jugadores dentro de la clasificación activa;
- ayuda: abre “Cómo funciona el Ranking BRAMU”.

### 13.2 Jerarquía

1. Ámbito.
2. Género/rama.
3. Filtro de Nivel.
4. Tarjeta `TU POSICIÓN`.
5. Clasificación.
6. Acciones secundarias.

### 13.3 Tarjeta Tu posición

Debe mostrar como mínimo:

- puesto;
- total;
- Nivel **del corte semanal**;
- movimiento en **puestos** respecto de la semana anterior;
- ámbito/filtro vigente.

La tarjeta no es sticky.

Tocarla lleva suavemente a la fila propia dentro de la clasificación.

### 13.4 Clasificación

- comienza desde #1;
- carga progresiva en bloques;
- fila propia resaltada;
- `↑ Ir al inicio` cuando el usuario se aleja suficientemente del comienzo.

### 13.5 Identificación de la edición

Cerca del título de Clasificación debe verse claramente la edición semanal.

Formato recomendado:

`CLASIFICACIÓN · 21 jugadores elegibles`

`Ranking semanal · Lun 31 ago — Dom 06 sep`

No usar “Actualizado hoy”, porque el Ranking no es continuo.

---

## 14. Ayuda “Cómo funciona”

La ayuda debe explicar de forma breve:

- diferencia entre Nivel y Ranking;
- Ranking no usa puntos propios;
- Nivel cambia partido a partido;
- Ranking se publica semanalmente;
- semana: lunes 00:00:00 a domingo 23:59:59;
- zona horaria inicial: Buenos Aires;
- el Nivel mostrado en Ranking es el del corte;
- cargar/validar tarde un partido lo mueve a la edición siguiente;
- las flechas indican **puestos**, no puntos;
- por qué puede cambiar el puesto aunque el usuario no haya jugado;
- calibración, actividad y densidad;
- precisión interna vs. decimal visible.

Copy base:

> **¿Cuándo se actualiza el Ranking?**  
> Cada lunes se publica una nueva edición con los Niveles consolidados al cierre del domingo.

> **¿Por qué mi Nivel actual puede ser distinto?**  
> Tu Nivel BRAMU puede cambiar durante la semana. El Ranking conserva el Nivel que tenías al último cierre semanal hasta la próxima publicación.

> **¿Qué significa ↑ 4?**  
> Que subiste 4 puestos respecto de la edición semanal anterior.

---

## 15. Filas y perfil público

Cada fila puede mostrar:

- posición;
- movimiento semanal;
- foto/avatar;
- nombre identificable;
- `@usuario`;
- Nivel público del corte;
- ubicación/contexto mínimo.

No mostrar como parte de la fila principal:

- efectividad;
- victorias/derrotas;
- rachas;
- cantidad total de partidos.

Cada fila abre Perfil público.

El back debe respetar el origen: Ranking → Perfil → volver a Ranking.

---

## 16. Integridad y partidos

Solo impactan en Nivel —y por lo tanto en una futura edición de Ranking— los partidos oficialmente computables según Nivel V1.4.

No impactan:

- pendientes;
- observados sin validación;
- disputados;
- anulados;
- duplicados;
- score inválido;
- invitados sin identidad elegible.

Una corrección de partido recalcula Nivel según su contrato, pero **no reescribe una edición semanal ya publicada** salvo una política excepcional de integridad que se defina explícitamente en el futuro.

El historial debe conservar fecha efectiva y fecha de procesamiento para auditoría.

---

## 17. Contrato mínimo de backend

### 17.1 Estado de jugador

- `player_id`
- `ranking_opt_in`
- `public_profile_enabled`
- `ranking_integrity_status`
- `country_code`
- `admin_area_id`
- `locality_id`
- `location_effective_from`
- rama competitiva
- `level_mu_internal`
- `level_public`
- `level_band_key`
- estado de Nivel
- `last_rated_at`
- `algorithm_version`
- estado/motivo de elegibilidad

### 17.2 Snapshot semanal

Cada edición debe guardar, como mínimo:

- `ranking_snapshot_id`
- `ranking_rules_version`
- `period_start_at`
- `period_end_at`
- `published_at`
- `timezone`
- universo y tipo
- `player_id`
- puesto
- grupo de empate
- total elegible
- estado de densidad
- Nivel interno del corte
- Nivel público del corte
- banda del corte
- estado de Nivel
- última actividad computable
- ubicación vigente
- rama vigente
- elegibilidad y motivo

### 17.3 Regla de publicación

V1 conceptual:

- período: lunes 00:00:00 → domingo 23:59:59;
- publicación lógica: lunes 00:00:00;
- timezone: `America/Argentina/Buenos_Aires`.

La infraestructura puede materializar el snapshot segundos/minutos después si lo necesita, pero el **instante efectivo** de corte debe seguir siendo lunes 00:00:00.

### 17.4 Historial y auditabilidad

Nunca alcanza con guardar “Juan estaba #12”.

Debe poder reconstruirse:

- qué universo existía;
- quién era elegible;
- qué Nivel tenía cada jugador;
- qué regla/versionado se aplicó.

---

## 18. Casos de borde

### Caso 1 — Nivel cambia durante la semana

Seba publica el lunes como #18 con Nivel de corte 5,3. El jueves juega y su Nivel actual pasa a 5,5.

Durante esa semana:

- Perfil/Home: 5,5
- Ranking: #18 · Nivel de corte 5,3

El lunes siguiente se calcula su nueva posición con el Nivel consolidado vigente al cierre del domingo.

### Caso 2 — Partido del domingo cargado el lunes

Se jugó domingo 22:00, pero quedó computable el lunes 00:10.

No altera la edición recién publicada. Entra en la siguiente.

### Caso 3 — Flecha

Seba fue #18 la semana anterior y esta semana publica #14.

Muestra:

`↑ 4 puestos`

No significa cuatro puntos.

### Caso 4 — Baja sin jugar

Seba mantiene su Nivel del corte anterior, pero otros jugadores publican por encima suyo.

Puede bajar puestos aunque no haya jugado.

### Caso 5 — Cambio de banda

El domingo Seba cierra con Nivel público 6,0. En la edición del lunes deja `Nivel 5` y entra `Nivel 6` como `Nuevo` en esa clasificación de banda.

### Caso 6 — Calibrando

Un jugador estimado en 8,2 pero calibrando no ocupa puesto territorial.

### Caso 7 — Inactividad

Al superar 180 días queda fuera de elegibilidad. Su siguiente aparición semanal, luego de un partido computable, es `Nuevo`.

### Caso 8 — Empate exacto

Dos jugadores con 6,1274 comparten puesto. El siguiente salta un número: `4, 4, 6`.

### Caso 9 — Universo insuficiente

Una localidad con cuatro elegibles no publica posiciones.

---

## 19. Reglas preparadas para desarrollo

1. Ranking nunca calcula ni modifica Nivel.
2. Ranking V1 no tiene puntos propios.
3. Ranking se publica semanalmente.
4. La semana va de lunes 00:00:00 a domingo 23:59:59.
5. Timezone inicial: `America/Argentina/Buenos_Aires`.
6. El snapshot usa el Nivel consolidado vigente al cierre.
7. El Nivel mostrado dentro del Ranking es el del snapshot, no necesariamente el Nivel actual.
8. Un partido validado después del cierre impacta en la edición siguiente.
9. No se reescribe retrospectivamente una edición publicada por carga tardía ordinaria.
10. La clave de orden es Nivel consolidado interno exacto descendente.
11. Empate exacto comparte puesto.
12. Solo `CALIBRADO` y `RECALIBRANDO` con consolidado previo pueden ser elegibles.
13. Reingreso por inactividad aparece como `Nuevo`.
14. Localidad es exacta y estructurada.
15. Cambio de ubicación tiene historial y cooldown.
16. 0–4 elegibles: no hay puestos.
17. 5–14: clasificación en formación.
18. 15+: establecida.
19. Mi red usa relaciones de juego de los últimos 180 días.
20. Mi red permite ocultar/restaurar localmente.
21. Nivel es filtro, no modo paralelo.
22. La rama competitiva separa Masculino/Femenino en la UI V1.
23. Movimiento `↑/↓ N` significa **N puestos** respecto de la edición semanal anterior.
24. Cada posición incluye universo y denominador.
25. Cada fila abre Perfil público.
26. Ranking conserva snapshots completos y `ranking_rules_version`.
27. Mis grupos, matchmaking y Race quedan fuera de V1.

---

## 20. Criterios de aceptación

Ranking V1 estará listo para implementación real cuando pueda demostrarse que:

- el snapshot semanal congela el conjunto correcto de jugadores y Niveles;
- la semana respeta timezone y límites exactos;
- una validación posterior al cierre no altera el snapshot anterior;
- los puestos se reconstruyen correctamente desde Nivel interno;
- empates producen `1,1,3`;
- calibrando no ocupa posición;
- recalibrando usa consolidado anterior;
- inactividad/reingreso es reproducible;
- las jerarquías territoriales usan IDs estructurados;
- densidad funciona;
- los filtros de Nivel usan el valor público del snapshot;
- movimiento semanal compara snapshots equivalentes y expresa puestos;
- privacidad, integridad y Perfil público son coherentes;
- existe auditabilidad completa de snapshots y reglas.

---

## 21. Métricas para piloto

Observar:

- elegibles por ámbito;
- elegibles por banda;
- distribución de posiciones;
- movimiento semanal mediano/extremo;
- tiempo desde alta hasta primera posición;
- exclusiones por calibración, ubicación, privacidad o inactividad;
- reingresos;
- uso de Mi red vs. ámbitos territoriales;
- jugadores ocultos/restaurados en Mi red;
- uso de búsqueda y ayuda;
- cantidad de partidos jugados cerca del cierre pero cargados después;
- tiempo medio entre fin del partido y carga/validación;
- porcentaje de partidos que pierden una edición semanal por validación tardía.

---

## 22. Estado de decisiones al 11 de septiembre de 2026

### Cerradas

- Ranking BRAMU V1 ordena por Nivel consolidado interno exacto.
- No tiene puntos propios.
- **Ranking es semanal, no continuo.**
- Nivel BRAMU sigue siendo dinámico.
- Semana V1: lunes 00:00:00 a domingo 23:59:59.
- Timezone V1: `America/Argentina/Buenos_Aires`.
- El lunes se publica una nueva edición usando el Nivel vigente al cierre del domingo.
- La edición permanece estable durante la semana.
- El Nivel de Ranking es el Nivel del corte.
- Partidos computables después del cierre entran en la edición siguiente.
- Carga tardía ordinaria no reescribe rankings históricos.
- Las flechas `↑/↓` expresan **puestos**, nunca puntos.
- Se recomienda cargar partidos inmediatamente al terminar para favorecer validación, Nivel actualizado y entrada en el corte correcto.
- Local, Provincial, País, Global y Mi red son los ámbitos UX vigentes.
- Local abre por defecto.
- Mi red usa vínculos de los últimos 180 días y permite ocultar/restaurar.
- Género/rama y Nivel son filtros compactos.
- Calibrando queda fuera de posiciones oficiales.
- Recalibrando usa el último consolidado.
- Día 181 de inactividad: sale de posición sin perder Nivel.
- 0–4: sin posiciones; 5–14: en formación; 15+: establecido.
- Global requiere al menos dos países para desbloquearse.
- Empates exactos comparten puesto.
- Ranking y Mis grupos siguen siendo productos distintos.

### Fuera de alcance V1

- Race/temporada con puntos;
- rankings privados de grupos;
- matchmaking;
- torneos propios;
- puntos de Ranking independientes del Nivel;
- reescritura retroactiva ordinaria de rankings publicados.

---

## 23. Referencias externas de criterio

Las referencias profesionales sirven solo para la **cadencia de publicación y lenguaje deportivo**, no para copiar su sistema de puntuación.

- ATP: rankings publicados semanalmente.
- FIP / Premier Padel: actualización/publicación semanal de ranking.
- BRAMU adopta la idea de una edición semanal estable, pero la ordena por Nivel BRAMU consolidado y no por puntos de torneo.

La diferencia es deliberada: BRAMU busca que el jugador amateur tenga una referencia clara y estable durante la semana sin crear una segunda fórmula deportiva.

---

## Nota de migración desde la definición anterior

Versiones anteriores de `Ranking_BRAMU.md` describían el Ranking como **continuo**, con movimiento semanal calculado contra un snapshot previo.

Esa definición queda reemplazada.

Desde esta revisión:

- el Nivel continúa actualizándose por eventos;
- el Ranking se materializa/publica semanalmente;
- las flechas comparan dos ediciones semanales;
- la UI debe identificar claramente el período del Ranking vigente.

Esta revisión debe tratarse como la fuente vigente para futuras decisiones de backend e implementación.
