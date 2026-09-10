# BRAMUlab V03.4 — Mis grupos

## Objetivo

Construir la primera versión de **MIS GRUPOS** como espacio privado de competencia entre jugadores conocidos.

Esta ronda NO implementa el Ranking BRAMU oficial por ciudad/provincia/país.

La idea es crear grupos privados donde:
- hay uno o más administradores;
- los jugadores compiten entre sí;
- los partidos impactan automáticamente cuando corresponden;
- existe una tabla semanal;
- existe una comparación con la semana anterior;
- existe una Race anual;
- BRAMU Intelligence genera una lectura grupal con 2–3 conclusiones útiles.

La competencia del grupo debe sentirse propia, divertida y cambiante.

No debe convertirse en una copia del Nivel BRAMU.

---

# 1. CAMBIO EN BOTTOM NAV

REEMPLAZAR la entrada actual:

`RANKING`

por:

`MIS GRUPOS`

Mantener intactos:
- Inicio
- Historial
- +
- Perfil

La barra queda:

`INICIO | HISTORIAL | + | MIS GRUPOS | PERFIL`

## Icono

Crear/usar un icono simple y coherente con la familia existente.

Dirección recomendada:
- grupo / personas;
- evitar trofeo/copa porque eso se reserva mejor para ranking/competencia oficial;
- mismo peso visual que los otros iconos de la bottom nav.

---

# 2. PRINCIPIO DE PRODUCTO

MIS GRUPOS no representa “quién juega mejor”.

Representa:
**quién está rindiendo mejor dentro de ese grupo y ese período.**

El Nivel BRAMU sigue existiendo como medida global del jugador, pero:
- NO ordena la tabla del grupo;
- NO se muestra necesariamente en la tabla principal;
- puede usarse internamente para calcular dificultad/bonus;
- sigue visible entrando al perfil público del jugador.

No usar:
- amigos;
- followers;
- seguidores;
- likes;
- popularidad;
- contador social.

---

# 3. ESTRUCTURA DE MIS GRUPOS

Al entrar a MIS GRUPOS:

## Header
- título `MIS GRUPOS`;
- botón `+` para crear grupo;
- si hay grupo seleccionado, acceso a configuración mediante icono de engranaje.

## Selector de grupos

Si el usuario pertenece a varios grupos:
- mostrarlos como tabs/chips horizontales;
- ejemplos:
  - `LOS MARTES`
  - `LOS PIBES`
  - `JUEVES`

El usuario puede pertenecer a múltiples grupos.

---

# 4. CREAR GRUPO

Al tocar `+`:

Abrir flujo simple para crear grupo.

Pedir:
- nombre del grupo;
- jugadores iniciales.

El creador:
- queda automáticamente como administrador;
- queda automáticamente dentro del grupo.

No pedir día de cierre.

La semana del grupo es fija:
**lunes 00:00 → domingo 23:59**, según zona horaria local del partido/usuario.

El lunes empieza automáticamente una nueva semana.

---

# 5. ADMINISTRADORES

Cada grupo debe tener:
- un creador/admin inicial;
- posibilidad de agregar otros administradores.

Los administradores pueden:
- cambiar nombre del grupo;
- agregar jugadores;
- quitar jugadores;
- designar otros administradores;
- quitar rol de administrador a otros, salvo que eso deje al grupo sin administradores.

No mostrar privilegios administrativos como parte del ranking deportivo.

En configuración puede mostrarse una etiqueta discreta:
`ADMIN`

---

# 6. PERTENENCIA AL GRUPO

Un jugador puede pertenecer a:
- un grupo;
- varios grupos;
- ningún grupo.

## Regla histórica

Cuando un jugador entra al grupo:
- NO se incorporan retroactivamente sus partidos previos.

Cuando un jugador sale:
- deja de participar en períodos futuros;
- sus resultados históricos ya generados se mantienen;
- sus puntos históricos no desaparecen;
- la Race anual conserva lo conseguido mientras fue miembro.

Guardar fecha de ingreso y, si corresponde, fecha de salida.

---

# 7. QUÉ PARTIDOS CUENTAN

Un partido cuenta automáticamente para un grupo si:

- al menos **3 de los 4 jugadores** pertenecían activamente al grupo en la fecha del partido;
- el partido pertenece al período correspondiente;
- cumple las reglas normales de partido válido del prototipo.

No pedir confirmación adicional.

No agregar selector:
`¿Querés que este partido cuente para... ?`

No hacer que el usuario tenga que acordarse.

La detección debe ser automática.

## Un partido puede contar en más de un grupo

Si cumple la regla de 3 de 4 en varios grupos:
- puede impactar automáticamente en todos ellos.

---

# 8. TABLA SEMANAL — REGLA CENTRAL

Cada grupo tiene una competencia semanal.

La tabla se reinicia todos los lunes.

Para cada jugador cuentan:
**sus 3 mejores partidos puntuables de esa semana dentro del grupo.**

Si juega:
- 1 partido → cuenta 1;
- 2 partidos → cuentan 2;
- 3 partidos → cuentan 3;
- 4 o más → se toman sus 3 mejores puntajes individuales.

Esto evita que simplemente jugar más partidos garantice estar primero.

---

# 9. PUNTOS POR PARTIDO

## Base

### Victoria
`+5 puntos`

### Derrota
`0 puntos`

## Bonificaciones

Cada bonus vale:

`+1 punto`

### Bonus 1 — Sorpresa de nivel

Se suma +1 si:
- la pareja ganadora tenía un Nivel BRAMU promedio al menos **0,5 inferior** al promedio de la pareja rival antes del partido.

Si la diferencia es menor a 0,5:
- no suma bonus.

### Bonus 2 — Remontada

Se suma +1 si:
- la pareja ganadora perdió el primer set;
- terminó ganando el partido.

### Bonus 3 — Victoria clara

Se suma +1 si:
- la pareja gana en 2 sets;
- el rival obtiene **menos de la mitad** de los games totales de la pareja ganadora.

Ejemplos:
- 6–3 / 6–3 → NO suma bonus (12 vs 6).
- 6–3 / 6–2 → SÍ suma bonus (12 vs 5).
- 6–2 / 6–1 → SÍ suma bonus.

## Exclusión lógica

Remontada y Victoria clara son mutuamente excluyentes en la práctica.

Máximo esperable por partido:
- 5 victoria
- +1 sorpresa de nivel
- +1 remontada O victoria clara

**Máximo: 7 puntos.**

No agregar más bonuses en esta ronda.

---

# 10. VISTAS DEL GRUPO

Dentro de cada grupo mostrar tres tabs:

`ACTUAL | ANTERIOR | RACE ANUAL`

## ACTUAL

Semana en curso.

Mostrar:
- BRAMU Intelligence grupal;
- tabla semanal actual.

## ANTERIOR

Semana inmediatamente anterior.

Mostrar:
- tabla final cerrada;
- BRAMU Intelligence correspondiente a esa semana, si existe;
- resultados congelados.

## RACE ANUAL

Acumulación de puntos obtenidos por cada jugador a lo largo del año calendario.

La Race anual:
- suma los puntos efectivos de las semanas;
- respeta el criterio de los 3 mejores partidos por semana;
- no se reinicia semanalmente;
- se reinicia al comenzar un nuevo año;
- el histórico anterior debe preservarse internamente.

No llamar “histórico” en esta pantalla.

Usar:
`RACE ANUAL`

---

# 11. TABLA PRINCIPAL

Mostrar información mínima y competitiva.

Por jugador:
- posición;
- foto/avatar;
- nombre visible;
- puntos;
- segunda línea breve:
  - partidos contados;
  - victorias;
  - derrotas.

Ejemplo:

`1  Matu        17 pts`
`   3 partidos · 2 V · 1 D`

No mostrar en la tabla:
- Nivel BRAMU;
- efectividad;
- mano;
- lado;
- categoría;
- métricas sociales.

Al tocar un jugador:
- abrir su perfil público.

---

# 12. BRAMU INTELLIGENCE — GRUPAL

Agregar un bloque de BRAMU Intelligence dentro de cada grupo.

Este bloque NO debe repetir el `Tu momento` personal del Home.

Debe hablar del **grupo**.

Título sugerido:
`EL MOMENTO DEL GRUPO`

o equivalente BRAMU que encaje mejor con el sistema actual.

## Objetivo

Generar una lectura externa, como “un tercero hablando del grupo”.

Debe sentirse:
- entretenida;
- observadora;
- útil;
- basada en datos;
- no genérica.

## Cantidad

Mostrar mínimo:
**2 conclusiones**

Ideal:
**2–3 conclusiones**

No resolverlo con una sola frase pobre.

## Tipos de conclusiones permitidas

Ejemplos:
- quién lidera;
- qué tan pareja está la semana;
- quién subió respecto a la semana anterior;
- quién viene más sólido;
- quién tuvo la mejor semana;
- quién sumó más puntos;
- quién ganó con mayor dificultad;
- quién consiguió una remontada;
- quién está cerca del líder;
- cambios de posición relevantes;
- comparación con la semana anterior;
- dinámica de la Race anual;
- jugadores que entraron fuertes;
- lucha por el podio.

## Regla

No inventar emociones, clima de grupo ni hechos no registrados.

Todo debe salir de:
- tabla;
- partidos;
- puntos;
- bonuses;
- posiciones;
- comparación semanal;
- Race.

## Longitud

No hacerlo demasiado corto.

La expectativa es que BRAMU devuelva una lectura suficientemente rica como para que el grupo tenga ganas de abrir la app y ver “qué dijo BRAMU esta semana”.

Puede mostrarse como:
- 2–3 mini insights;
- o pequeño bloque narrativo dividido visualmente.

Evitar pared de texto.

---

# 13. ¿CÓMO SE SUMAN LOS PUNTOS?

Agregar al final de la pantalla del grupo un acceso muy sutil:

`¿Cómo se suman los puntos?`

Al tocar:
- abrir bottom sheet corto.

Explicar de forma simple:
- victoria = 5 puntos;
- +1 sorpresa de nivel;
- +1 remontada;
- +1 victoria clara;
- cuentan los 3 mejores partidos de la semana;
- partido válido para el grupo con al menos 3 jugadores miembros.

No mostrar un legal permanente en pantalla.

---

# 14. CONFIGURACIÓN DEL GRUPO

Acceso mediante engranaje en header cuando corresponda.

Permitir:
- editar nombre;
- agregar jugadores;
- quitar jugadores;
- ver administradores;
- designar administradores;
- quitar rol de admin si queda al menos uno.

No implementar todavía:
- imagen del grupo;
- chat;
- descripción larga;
- invitaciones por link;
- privacidad avanzada;
- solicitudes;
- roles adicionales.

---

# 15. DATOS LOCALES / PROTOTIPO

Hasta V04:
- usar persistencia local;
- grupos simulados/locales;
- jugadores del universo ya conocido por la app;
- reutilizar sistema de JUGADORES de V03.3.

Debe quedar aislado para reemplazarse por backend real.

Guardar como mínimo:
- groupId;
- nombre;
- adminIds;
- miembros;
- joinedAt;
- leftAt si corresponde;
- partidos que impactan por período;
- puntos calculados;
- semanas cerradas;
- Race anual.

No duplicar partidos si ya existen en historial.

Calcular desde el partido cuando sea posible.

---

# 16. INTEGRACIÓN CON JUGADORES V03.3

Reutilizar:
- búsqueda de jugadores;
- perfil público;
- avatar;
- nombre visible;
- @usuario;
- lista JUGADORES;
- componente de fila cuando corresponda.

No inventar otra identidad de jugador.

---

# 17. NO IMPLEMENTAR EN ESTA RONDA

No implementar:
- Ranking BRAMU oficial;
- ranking nacional;
- ranking provincial;
- ranking de ciudad;
- ranking entre jugadores agregados;
- ciudad/provincia/país;
- backend real;
- Supabase;
- seguidores;
- amigos;
- mensajería;
- chat;
- invitaciones a partidos;
- armado de partido desde grupo;
- push notifications;
- premios;
- medallas;
- gamificación extra.

El Ranking BRAMU oficial se trabaja por separado.

---

# 18. HOME

No agregar todavía botón `RANKING BRAMU` en esta ronda.

Ese acceso se definirá junto con el Ranking BRAMU oficial.

Mantener:
- BUSCAR JUGADORES;
- resto del Home actual.

---

# 19. COHERENCIA VISUAL

Tomar como fuente:
- Home actual;
- Perfil;
- JUGADORES;
- Perfil público;
- bottom nav actual;
- tabs existentes;
- bottom sheets;
- sistema de botones V03.2.x.

No crear lenguaje visual nuevo.

MIS GRUPOS debe sentirse parte de BRAMU, no una mini app aparte.

---

# 20. QA

## Mobile obligatorio

Probar:
- bottom nav con MIS GRUPOS;
- estado sin grupos;
- crear grupo;
- agregar jugadores;
- cambiar de grupo;
- configuración;
- nombrar admin;
- quitar jugador;
- semana actual;
- semana anterior;
- Race anual;
- explicación de puntos;
- partido con 2 miembros → NO cuenta;
- partido con 3 miembros → SÍ cuenta;
- partido con 4 miembros → SÍ cuenta;
- mismo partido válido para 2 grupos;
- 4+ partidos de un jugador → solo sus 3 mejores puntajes;
- bonus sorpresa ≥0.5;
- diferencia <0.5 → sin bonus;
- remontada;
- victoria clara;
- perfil público desde tabla;
- BRAMU Intelligence con 2–3 conclusiones.

## Desktop

Chequeo visual rápido.

---

# 21. TESTS

Agregar tests reales para:
- pertenencia temporal;
- detección 3 de 4;
- múltiples grupos;
- cálculo base 5;
- bonus sorpresa;
- threshold 0.5;
- bonus remontada;
- bonus victoria clara;
- exclusión práctica de bonuses incompatibles;
- top 3 mejores partidos;
- semana lunes-domingo;
- semana anterior;
- Race anual;
- persistencia;
- admins.

No agregar tests de CSS.

Suite completa una sola vez al cierre.

---

# 22. CRITERIOS DE ÉXITO

V03.4 queda cerrada si:

- Ranking desaparece de bottom nav y aparece MIS GRUPOS;
- el usuario puede crear varios grupos;
- hay admins claros;
- un partido cuenta automáticamente con 3 de 4 miembros;
- un partido puede contar para más de un grupo;
- tabla semanal usa puntos;
- cuentan solo los 3 mejores partidos;
- existen bonuses correctos;
- hay Actual / Anterior / Race anual;
- BRAMU Intelligence genera mínimo 2 insights grupales;
- la tabla no depende del Nivel BRAMU para ordenar;
- los históricos no se reescriben al agregar/quitar miembros;
- la pantalla sigue siendo simple;
- no se implementa todavía Ranking BRAMU oficial.

---

# 23. VERSIONADO

Versión:

**BRAMUlab V03.4**

Actualizar puntos de versión/cache vigentes.

Generar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.4_Informe.md`

El informe debe incluir:
- estructura de grupos;
- modelo local;
- admins;
- reglas de pertenencia;
- cálculo de puntos;
- bonuses;
- top 3;
- semanas;
- Race anual;
- BRAMU Intelligence grupal;
- QA;
- tests;
- commit;
- tag;
- deploy.

---

# FORMA DE TRABAJO

Implementar directamente.

No presentar plan.

Reutilizar componentes existentes y mantener el alcance cerrado.

Solo detenerse por:
- contradicción real de producto;
- riesgo de pérdida de datos;
- necesidad de salir del alcance;
- acción destructiva no prevista.

Al terminar:
- QA mobile;
- chequeo desktop;
- suite completa una sola vez;
- informe;
- commit;
- tag;
- push;
- deploy.
