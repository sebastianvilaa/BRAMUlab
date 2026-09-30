# Grupos BRAMU

**Estado:** producto y UX V1 cerrados para implementación productiva.  
**Fecha:** 28 de septiembre de 2026.  
**Rol:** fuente maestra vigente de Grupos BRAMU.  
**Precedencia:** este documento reemplaza como autoridad de producto a la definición histórica de V03.4. La implementación existente de V03.4 sigue siendo la base a conservar, pero cualquier contradicción se resuelve a favor de este documento.

---

## 1. Qué es Grupos BRAMU

Grupos BRAMU es la competencia privada de BRAMUlab entre jugadores que comparten partidos reales.

No es el Ranking BRAMU oficial y no intenta responder quién es “mejor” globalmente. Responde otra pregunta:

> **¿Quién está rindiendo mejor dentro de este grupo y este período?**

La función debe convertirse en una de las superficies centrales de BRAMUlab porque transforma la actividad individual en conversación compartida: posiciones, puntos, Race, remontadas, sorpresas y movimiento semanal.

Principio de producto:

> **Vos jugás. BRAMU lleva la cuenta.**

La experiencia debe sentirse deportiva, social, clara y deseable, sin convertirse en una plataforma compleja de torneos ni en una capa de gamificación artificial.

BRAMU mantiene su claim general **“Donde vive tu pádel”**. Grupos materializa esa idea en una experiencia compartida entre personas que juegan juntas.

---

## 2. Relación con Nivel y Ranking

Tres conceptos separados:

- **Nivel BRAMU:** estimación dinámica de capacidad deportiva.
- **Ranking BRAMU:** posición oficial semanal dentro de un universo elegible.
- **Grupos BRAMU:** competencia privada con puntos propios del grupo.

Consecuencias obligatorias:

- los puntos de Grupos nunca modifican el Nivel;
- los puntos de Grupos nunca modifican el Ranking oficial;
- pertenecer a un grupo no cambia elegibilidad ni posición de Ranking;
- Nivel puede usarse únicamente como evidencia para el bonus “Sorpresa de nivel”;
- la tabla del grupo se ordena por puntos del grupo, nunca por Nivel.

---

## 3. Membresía y administración

- El creador del grupo queda como administrador.
- Puede haber varios administradores.
- El grupo nunca puede quedarse sin al menos un administrador activo.
- La pertenencia debe conservar períodos históricos reales de entrada/salida para auditoría.
- **Regla deportiva semanal de alta:** cuando un jugador entra o reingresa a un grupo, para el cómputo deportivo su pertenencia se considera vigente desde el **lunes de esa misma semana BRAMU**, usando la frontera canónica de Buenos Aires definida en este documento. Puede sumar por partidos anteriores a la hora/día exactos del alta, pero nunca por semanas anteriores.
- Esto también aplica al crear un grupo a mitad de semana: los partidos de esa misma semana pueden entrar retroactivamente si, con los miembros incorporados, cumplen las reglas del grupo.
- **Eliminar/quitar un miembro significa sacarlo del grupo también a nivel visible:** deja de aparecer en Semana actual, Semana pasada, Race anual y BRAMU Intelligence del grupo. No ofrecer dos modos de baja en V1.
- Eliminar un miembro **no borra ni modifica los partidos reales de BRAMU**, ni toca Nivel/Ranking.
- Los puntos/estadísticas de los demás miembros ya obtenidos por partidos que contaron para el grupo se conservan; quitar a una persona no debe hacer desaparecer ni recalcular hacia atrás los puntos de los demás.
- La pertenencia histórica real se conserva internamente para auditoría y trazabilidad, aunque el miembro eliminado deje de ser visible en las superficies del grupo.
- Si una persona eliminada vuelve a ser agregada más adelante, entra como una nueva etapa deportiva: para las superficies competitivas se toma su **último período de alta**, con la regla semanal vigente (efectivo desde el lunes de esa semana). No reaparecen automáticamente sus filas/puntos de períodos eliminados anteriores.
- Un mismo partido puede contar para más de un grupo si cumple las reglas de cada uno.

---

## 4. Qué partidos cuentan

Un partido cuenta automáticamente para un grupo cuando:

1. es un partido oficial/computable bajo la verdad vigente de BRAMU;
2. tiene fecha efectiva válida;
3. al menos **3 de sus 4 jugadores** pertenecen al grupo para esa **semana BRAMU**. Un alta realizada más tarde dentro de la misma semana vale retroactivamente desde el lunes de esa semana; nunca habilita partidos de semanas anteriores.

### Grupo todavía no competitivo

**Un grupo puede existir con 1 o 2 miembros.** No bloquear su creación.

Mientras tenga menos de 3 miembros activos:
- el grupo puede abrirse, renombrarse y administrarse;
- puede tener más de un admin;
- puede agregar/quitar miembros;
- **ningún partido suma puntos todavía**, porque es imposible cumplir la regla 3/4.

La UX debe explicarlo en positivo, por ejemplo:

**Necesitás al menos 3 jugadores en el grupo para empezar a sumar puntos.**

Si el grupo llega a 3 o más miembros a mitad de semana, BRAMU puede incorporar automáticamente partidos oficiales de esa misma semana que pasen a cumplir la regla 3/4.

Evitar presentar esto como error o impedir crear el grupo. Al llegar a 3 miembros activos, el grupo queda competitivo automáticamente, sin configuración adicional.

No existe selector manual de “sumar a este grupo”.

En Production/Staging server-backed, Grupos debe reutilizar la verdad oficial del partido. No debe crear una segunda validación paralela ni tomar un partido pendiente como resultado definitivo.

Si una corrección oficial cambia posteriormente la verdad del partido, Grupos debe consumir esa verdad oficial; no mantener una copia divergente.

---

## 5. Puntos por partido

### Base

- Victoria: **5 puntos** para cada jugador de la pareja ganadora.
- Derrota: **0 puntos**.

Los puntos no se reparten entre compañeros: si una pareja gana 5 puntos, ambos ganadores reciben 5.

### Bonus — máximo +2 combinables en un mismo partido

Cada bonus vale **+1 punto**.

#### Sorpresa de nivel

+1 si la pareja ganadora tenía, antes del partido, un Nivel BRAMU promedio al menos **0,5 inferior** al de la pareja rival.

Para implementación productiva:
- usar Nivel BRAMU oficial anterior al partido;
- nunca usar un Nivel inventado o simulado;
- si no existe evidencia suficiente para calcular el bonus, no se concede.

#### Remontada

+1 si la pareja ganadora perdió el primer set y después ganó el partido.

#### Victoria clara

+1 si la pareja gana **2-0** y la pareja rival suma menos de la mitad de los games totales de la ganadora.

### Máximo real

**Una victoria puede valer 5, 6 o 7 puntos. Nunca 8.**

Remontada y Victoria clara son incompatibles:
- para Remontada hay que perder el primer set;
- para Victoria clara hay que ganar 2-0.

Sorpresa sí puede combinarse con cualquiera de las dos.

---

## 6. Regla de los 3 mejores partidos

La tabla semanal toma, para cada jugador, como máximo sus **3 mejores partidos puntuables de la semana**.

- Si jugó 1, 2 o 3, cuentan todos.
- Si jugó más de 3, se conservan los 3 que más puntos le dieron.
- Jugar más cantidad de partidos no debe producir por sí solo una ventaja ilimitada.

Ejemplo:

- partido A: 7 pts;
- partido B: 6 pts;
- partido C: 5 pts;
- partido D: 5 pts;
- partido E: 0 pts.

Puntaje semanal: **18 pts**.

**La línea visible de actividad NO se limita al top 3.** Debe mostrar la actividad real del jugador dentro del grupo durante esa semana: total de partidos que calificaron para el grupo, victorias reales y derrotas reales. La regla de los 3 mejores afecta únicamente el puntaje.

Ejemplo: si un jugador disputó 10 partidos calificables, ganó 6 y perdió 4, pero sus 3 mejores resultados suman 17 puntos, la fila debe mostrar:

**10 partidos · 6 V · 4 D** — **17 pts**

No mostrar `3 partidos · 3 V · 0 D` solo porque esos fueron los tres resultados que computaron para puntos: genera una lectura falsa de invicto.

---

## 7. Semana, tabla y empates

La competencia semanal va de **lunes a domingo**.

### Zona horaria canónica V1

Para que todos los miembros de un grupo compartan exactamente la misma frontera semanal, **Grupos BRAMU V1 usa `America/Argentina/Buenos_Aires` como zona horaria canónica**:

- semana: lunes 00:00 a domingo 23:59:59.999 de Buenos Aires;
- esta frontera es autoritativa tanto para backend como para frontend;
- no depende de la zona horaria/configuración del dispositivo;
- no existe configuración de zona horaria por grupo en V1.

Si BRAMU expande uso internacional de forma relevante, esta decisión puede revisarse más adelante sin cambiar la lógica deportiva base.

La tabla semanal:

- ordena por puntos descendentes;
- si dos jugadores tienen el mismo puntaje, comparten posición;
- usa ranking de competición: **1, 1, 3**;
- los criterios secundarios pueden ordenar visualmente filas empatadas, pero nunca romper el empate visible de posición.

Las vistas vigentes se conservan:

- **Semana actual**
- **Semana pasada**
- **Race anual**

---

## 8. Race anual

La Race acumula durante el año calendario los puntos que efectivamente computaron semana a semana bajo la regla de los 3 mejores partidos.

No es un “top 3 anual”.

La Race:

- suma los puntos semanales efectivos;
- en la línea secundaria muestra la actividad real acumulada del año dentro del grupo (partidos calificables, victorias y derrotas reales), no solo los partidos que aportaron puntos al top 3 semanal;
- muestra únicamente miembros actualmente activos del grupo;
- si un miembro es eliminado, deja de aparecer en la Race aunque sus partidos reales sigan existiendo y los puntos ya obtenidos por otros miembros se conserven;
- si un miembro eliminado reingresa, su nueva etapa competitiva arranca desde la semana de reingreso y no revive automáticamente su Race anterior;
- se reinicia al cambiar de año calendario;
- usa la misma regla de empate visible que la tabla semanal.

---

## 9. BRAMU Intelligence grupal

La superficie existente de BRAMU Intelligence se conserva.

Debe producir únicamente conclusiones respaldadas por datos reales del grupo, por ejemplo:

- liderazgo o empate real;
- diferencias de puntos;
- bonus destacados;
- movimiento respecto de la semana anterior;
- liderazgo de Race;
- actividad real de la semana.

Reglas:

- no inventar hechos;
- no forzar 2–3 insights si no existe evidencia;
- nunca presentar un líder único cuando hay empate;
- no interpretar un movimiento como capacidad global del jugador.

---

# 10. Dirección UX — principio general

### DECISIÓN CERRADA — “Mis grupos” pasa a tener lobby propio

La entrada desde la bottom-nav **Mis grupos** ya no debe abrir automáticamente el último grupo activo.

Debe abrir una pantalla inicial propia de **GRUPOS BRAMU** que funcione como lobby de las competencias privadas del usuario.

El lobby tiene dos estados:

1. **sin grupos:** mini onboarding + ejemplo de lo que podría existir;
2. **con uno o más grupos:** tarjetas reales de los grupos del usuario, ordenadas por actividad reciente.

Esta pantalla debe existir incluso cuando el usuario tenga un solo grupo. La consistencia del producto y la lectura semanal valen más que ahorrar un tap.

Tocar una tarjeta abre el grupo completo. Dentro del grupo se conserva la experiencia ya aprobada.

### Navegación al detalle

- bottom-nav **Mis grupos** → lobby;
- tarjeta de grupo → detalle del grupo;
- volver desde el detalle → lobby;
- el selector de grupo existente **se conserva en esta primera versión** como acceso rápido entre grupos mientras se está dentro de uno.

No retirar todavía el selector. Si el uso real demuestra que el lobby lo vuelve redundante, se evalúa después.

La estructura actual del grupo armado ya está bien resuelta y **no se rediseña de forma general**.

La ronda productiva debe concentrarse en:

1. construir el lobby;
2. elevar el estado cero;
3. explicar mejor cómo funciona el producto;
4. cerrar visualmente la creación;
5. unificar identidad/avatar server-backed;
6. bajar la jerarquía del CTA administrativo “Agregar jugador”.

La novedad debe venir de composición, jerarquía y relato de producto usando el sistema visual vigente de BRAMUlab. No crear una estética paralela.

---

## 10.1 Lobby con grupos — anatomía de tarjeta

Cada grupo se representa con una tarjeta completa, tapeable.

### Identidad

Mostrar:

- foto del grupo;
- nombre;
- cantidad de miembros activos.

La foto es opcional y funciona con la lógica visual habitual de BRAMU:

- si existe foto, mostrarla;
- si no existe, usar iniciales del nombre del grupo como fallback.

La foto puede ser una foto de los jugadores, un meme, un escudo o cualquier imagen que identifique al grupo. No imponer estética deportiva.

Solo admins pueden cambiar la identidad del grupo. La foto **no debe ser obligatoria durante la creación**: el grupo puede nacer con iniciales y editarse después desde Configuración.

### Lectura semanal

La tarjeta responde una sola pregunta:

> **¿Qué está pasando esta semana en este grupo?**

No convertirla en dashboard.

Cuando existe competencia semanal con puntos, mostrar hasta 3 posiciones visibles:

- posición;
- indicador visual de oro/plata/bronce cuando corresponda;
- nombre;
- puntos.

Ejemplo:

🥇 Seba · 18 pts  
🥈 Matu · 13 pts  
🥉 Lucho · 7 pts

Si el usuario actual no está dentro de las filas visibles, agregar debajo una línea personal:

**Vos · #5 · 5 pts**

Si ya aparece en las filas visibles, no duplicarlo.

No mostrar en la tarjeta:
- Race anual;
- BRAMU Intelligence completa;
- Nivel;
- estadísticas adicionales;
- datos decorativos sin función.

El objetivo es pantallazo + deseo de entrar.

### Empates

La tarjeta debe respetar exactamente la semántica real de posiciones del grupo.

Ejemplo válido:

🥇 Seba · 12 pts  
🥇 Matu · 12 pts  
🥉 Lucho · 7 pts

Nunca convertir un empate en 1.º/2.º artificial para poder repartir medallas.

Si un empate produce más filas de las que conviene mostrar en la tarjeta, comprimirlo sin inventar posiciones, por ejemplo:

**4 jugadores comparten la punta · 12 pts**

y dejar el detalle completo dentro del grupo.

Las medallas acá son únicamente indicadores visuales de posición actual; **no son premios, badges coleccionables ni gamificación persistente**.

---

## 10.2 Estados contextuales de tarjeta

Todas las tarjetas comparten la misma estructura general. El bloque semanal cambia según la verdad del grupo.

### 3+ miembros y actividad semanal

Mostrar top semanal + línea “Vos” solo cuando corresponda.

No agregar una frase narrativa extra por defecto: el top ya cuenta la historia y evita ruido/redundancia.

### 3+ miembros y todavía sin partidos contables esta semana

Reemplazar el podio por una frase breve y descontracturada.

Tono aprobado como referencia:

**Esta semana están todos vagos 😴**  
**¿Cuándo se arma partido?**

La redacción puede pulirse visualmente, pero debe mantener el tono humano y no administrativo.

### 2 miembros activos

**Ya son 2. Falta uno para empezar a sumar.**  
**Con 3 jugadores activos arranca la competencia.**

### 1 miembro activo

**El grupo ya existe. Ahora falta la banda.**  
**Con 3 jugadores activos empieza la competencia.**

Nunca usar:
- “grupo incompleto”;
- “error”;
- “no cumple requisitos”;
- bloqueo de acceso.

### Menos de 3 jugadores con partidos externos

No insinuar que esos partidos puntuaron. Hasta llegar a 3 miembros activos el grupo todavía no suma.

---

## 10.3 Orden de los grupos

Las tarjetas se ordenan por **actividad significativa más reciente del grupo**, descendente.

La actividad es del grupo, no del usuario actual: si otros miembros juegan o modifican el grupo, puede subir al primer lugar aunque el usuario no haya participado.

Eventos que actualizan la actividad:

1. un partido oficial/computable que entra al grupo o una corrección oficial que cambia sus puntos;
2. alta/baja/reingreso de miembro;
3. cambio de admin;
4. cambio de nombre;
5. cambio de foto;
6. creación del grupo.

No usar como actividad un partido que no cumple la regla del grupo.

Resultado esperado:
- los grupos con movimiento reciente quedan arriba;
- los grupos inactivos van cayendo naturalmente al final;
- no hace falta que el usuario ordene manualmente.

En empate exacto de timestamp, usar un criterio estable y no visible.

---

## 10.4 Crear otro grupo desde el lobby

Cuando ya existen grupos, crear uno nuevo sigue disponible pero deja de ser el protagonista.

Usar una acción secundaria coherente con el sistema vigente, por ejemplo:

**Crear otro grupo**

No usar un CTA primario enorme por encima de las tarjetas existentes.

---

## 11. Naming

### Bottom navigation

Se conserva:

**Mis grupos**

Es claro como destino personal dentro de la navegación.

### Header principal

Cambiar:

MIS GRUPOS

por:

**GRUPOS BRAMU**

El selector de grupos puede seguir titulándose MIS GRUPOS, porque ahí sí describe literalmente la lista privada del usuario.

No renombrar la función como Liga, Torneo, Race u otro concepto más específico.

---

## 12. Estado cero — mini onboarding

### Objetivo

La pantalla sin grupos no debe sentirse como un formulario vacío. Debe vender la función y permitir entenderla antes de crear nada.

### Estructura aprobada

#### Claim

**Tu grupo de siempre. Una competencia nueva cada semana.**

#### Bajada

**Creá un grupo con la gente con la que jugás. BRAMU detecta los partidos que corresponden, suma los puntos y arma la competencia automáticamente.**

#### Tres módulos compactos

**Ganá y sumá**  
5 puntos por victoria + bonus por partidos especiales.

**Tus 3 mejores cuentan**  
Así competir no depende simplemente de quién juega más.

**Cada semana vuelve a empezar**  
Tabla semanal + Race anual con tu grupo.

Usar componentes/tarjetas existentes de BRAMUlab. No crear un sistema visual nuevo ni tres cards sobredimensionadas.

### Preview funcional

Debajo de la explicación debe existir una preview claramente marcada como:

**EJEMPLO**

La preview debe reutilizar **la misma tarjeta de grupo del lobby con datos demostrativos**, no inventar un segundo componente.

Puede mostrar:

- identidad/foto o fallback de un grupo ficticio;
- nombre del grupo;
- cantidad de jugadores;
- bloque **Esta semana**;
- top 3 ilustrativo con puntos.

No necesita mostrar Race anual dentro de la tarjeta.

Los datos son únicamente demostrativos y nunca deben mezclarse con datos reales del usuario.

El concepto es:

> **Sin grupos, te mostramos qué podría existir acá. Con grupos, ves lo que está pasando de verdad.**

El objetivo es que antes de crear un grupo la persona entienda visualmente qué obtiene.

### CTAs

Primario:

**Crear mi grupo**

Secundario:

**Cómo funciona**

El CTA principal puede usar la familia primaria lima porque en estado cero es la acción central de la pantalla.

---

## 13. Ayuda — “Cómo funcionan los Grupos BRAMU”

La app ya tiene una hoja “¿Cómo se suman los puntos?”. **No crear un segundo sistema de ayuda.**

### FUSIONAR

Evolucionar esa misma hoja a:

**Cómo funcionan los Grupos BRAMU**

y hacerla accesible mediante un icono discreto ? en el header de Grupos, siempre visible para miembros y admins.

El engranaje sigue siendo exclusivamente configuración y continúa visible solo cuando corresponde.

Para evitar duplicación visual, el enlace inferior “¿Cómo se suman los puntos?” puede retirarse una vez que el acceso ? sea evidente y validado.

### Contenido mínimo

**¿Qué partidos cuentan?**  
Un partido entra automáticamente cuando al menos 3 de los 4 jugadores pertenecían al grupo cuando se jugó.

**¿Cómo sumás?**  
Victoria: 5 puntos. Derrota: 0. Podés sumar +1 por Sorpresa de nivel, Remontada o Victoria clara. El máximo posible por partido es 7 puntos.

**¿Por qué cuentan solo 3?**  
Cada semana usamos tus 3 mejores partidos para que jugar más veces no sea una ventaja automática.

**¿Qué pasa cada semana?**  
La tabla semanal vuelve a empezar y los puntos que computaron siguen alimentando la Race anual.

**¿Afecta mi Nivel o Ranking?**  
No. Los puntos del grupo son una competencia privada e independiente.

No convertir esta ayuda en reglamento largo.

---

## 14. Crear grupo

La hoja existente de creación se conserva como base:

- nombre del grupo;
- buscador;
- selección múltiple de jugadores;
- Nivel BRAMU cuando exista;
- CTA de creación.

No agregar configuración de reglas, puntos, temporadas ni límites personalizados.

BRAMU define las reglas; el usuario solo crea su grupo.

La foto del grupo es opcional y no se agrega como requisito del flujo inicial. El grupo nace con fallback de iniciales y un admin puede cargar/cambiar la foto después desde Configuración.

Crear un grupo debe seguir siendo una tarea rápida.

### Validación del nombre

Si el usuario intenta crear el grupo sin completar un nombre válido, evitar el error genérico al pie como única señal.

**AGREGAR** feedback contextual sobre el propio campo:
- label / línea / borde del campo en rojo;
- mensaje breve junto al campo indicando que falta completar el nombre;
- llevar foco visual al campo;
- conservar el resto de la selección ya realizada;
- no presentar esto como error de conexión o fallo técnico.

El mensaje genérico inferior puede quedar como respaldo solo para fallos reales de red/servidor.

---

## 15. Estado posterior a la creación

### AGREGAR

Después de una creación exitosa, reemplazar el simple toast como único cierre por un estado breve de recompensa/confirmación.

Contenido:

**Tu grupo está listo**

{Nombre del grupo}  
{N jugadores}

**Desde ahora, los partidos que cumplan las reglas del grupo entran automáticamente.**

Microcopy permitido:

**Vos jugás. BRAMU lleva la cuenta.**

CTA:

**Ir al grupo**

Debe ser breve; no transformar la creación en un onboarding largo.

---

## 16. Agregar jugadores — identidad y avatar

La estructura actual del selector se conserva.

### FUSIONAR

Usar la misma resolución de identidad server-backed vigente en otras listas de BRAMU:

- foto real/avatar cuando exista;
- iniciales como fallback;
- nombre real;
- @usuario real;
- Nivel BRAMU real cuando corresponda.

No fabricar handles ni niveles.

La Race/tabla ya demuestra el patrón visual correcto; reutilizar esa lógica/componente en el selector de jugadores en vez de mantener una resolución local separada.

---

## 16.1 Desglose de puntos desde la tabla del grupo

### DECISIÓN CERRADA — fila del ranking = explicación de puntos

Dentro de **Semana actual** y **Semana pasada**, tocar la fila de un jugador ya no abre directamente su Perfil.

En el contexto competitivo del grupo, la pregunta prioritaria es **cómo se formó ese puntaje**.

Al tocar una fila abrir un sheet/panel de desglose del jugador para esa semana.

### Jerarquía

Mantener el lenguaje visual de la tabla actual:

- avatar + nombre + @usuario;
- actividad real del período;
- **puntos totales alineados a la derecha, en la misma posición y jerarquía visual que hoy**;
- acceso secundario y discreto **Ver perfil** para conservar el acceso al perfil público sin convertirlo en la acción principal.

No crear una pantalla pesada ni una planilla deportiva.

### Partidos — formato compacto

El cuerpo muestra los partidos calificables del jugador **línea por línea**, con una altura cercana a la fila actual de jugadores.

Cada línea debe permitir entender:

- fecha;
- pareja;
- rivales;
- resultado;
- puntos aportados por ese partido, alineados a la derecha.

Cuando corresponda, indicar de forma breve el bonus real que produjo el punto extra:
- Sorpresa;
- Remontada;
- Victoria clara.

La explicación debe salir del mismo motor/evidencia real que calcula Grupos. No reconstruir ni inventar motivos.

### Qué aportó al total

Los **3 partidos que efectivamente aportan al puntaje semanal** deben distinguirse visualmente de forma simple.

Los demás partidos calificables de la semana también pueden mostrarse para explicar la actividad real, pero deben quedar claramente como:
- `0 pts` si fueron derrota; o
- **No entra en tus 3 mejores** si fue un resultado puntuable desplazado por otros tres mejores.

No esconder partidos de la actividad real solo para que cierre la suma.

### Race anual

Tocar una fila de **Race anual** abre un resumen compacto del jugador **semana por semana**.

Cada línea muestra, como mínimo:
- semana/rango de fechas;
- actividad resumida de esa semana cuando aporte contexto;
- puntos efectivos de esa semana alineados a la derecha.

V1 **no necesita desplegar dentro de Race todos los partidos de todas las semanas**. La lectura principal es una línea por semana para explicar cómo se construyó el acumulado anual.

Si más adelante se necesita profundizar una semana concreta, puede navegarse al desglose semanal sin convertir Race en una vista enorme.

### Navegación

REEMPLAZAR la regla anterior:
- ~~fila de tabla → Perfil público~~

por:
- **fila de Semana actual/pasada → desglose semanal del jugador**;
- **fila de Race → acumulado semana por semana**;
- **Ver perfil** queda como acción secundaria dentro de ese contexto.

Esta transparencia forma parte de la confianza del sistema de Grupos: cualquier miembro debe poder comprobar qué partidos y qué bonus explican los puntos visibles.

---

## 17. CTA “Agregar jugador”

En la pantalla principal del grupo y en Configuración:

### REEMPLAZAR estilo

El CTA actual lima macizo debe pasar a la familia **secundaria lima** ya existente:

- borde lima;
- texto lima;
- fondo verde/lima muy sutil;
- misma altura y sistema tipográfico del componente vigente.

No cambia la función.

Motivo: es una acción administrativa secundaria y no debe competir con el contenido deportivo principal del grupo.

---

## 18. NO TOCAR

Salvo regresión concreta, conservar:

- selector de grupo activo dentro del detalle *(se conserva inicialmente como cambio rápido entre grupos)*;
- sheet MIS GRUPOS;
- cantidad de jugadores en el selector;
- scroll horizontal de las tabs;
- Semana actual;
- Semana pasada;
- Race anual;
- estructura y jerarquía de la tabla;
- empates compartiendo posición;
- BRAMU Intelligence grupal;
- engranaje de configuración;
- edición inline del nombre;
- admins múltiples;
- guardrail de al menos un admin;
- quitar miembro;
- eliminar grupo;
- lógica histórica de membresía;
- acceso al Perfil público como acción secundaria desde el desglose de puntos; la fila competitiva ya no abre Perfil directamente;
- sistema de colores, tarjetas, tipografía y shells generales de BRAMUlab;
- bottom-nav Mis grupos.

No rehacer estas superficies para “modernizarlas”.

---

## 19. Fuera de alcance V1

No agregar ahora:

- medallas/badges coleccionables o persistentes *(los indicadores oro/plata/bronce del lobby sí están permitidos como representación visual de la posición semanal actual)*;
- monedas;
- premios virtuales;
- desafíos artificiales;
- capitán/MVP manual;
- apuestas;
- chat interno;
- torneos configurables;
- reglas personalizadas por grupo;
- cantidad configurable de partidos computables;
- sistema de temporadas complejo;
- puntos que afecten Nivel o Ranking;
- marcador en vivo dentro de BRAMUlab.

BRAMUlive sigue siendo un producto separado.

---

## 20. Contrato productivo mínimo

Grupos BRAMU forma parte del alcance previo a Production.

No puede salir a usuarios reales dependiendo de localStorage como autoridad.

La implementación productiva debe persistir, como mínimo:

### Grupo

- group_id;
- nombre;
- creador;
- timestamps;
- estado activo/eliminado.

### Membresías

- group_id;
- player_id;
- rol/admin;
- períodos de pertenencia;
- timestamps.

### Autoridad

- lectura del grupo: miembros autorizados;
- cambios de nombre/miembros/admin/eliminación: admins;
- nunca dejar cero admins;
- operaciones sensibles server-side/RLS;
- identidad siempre por player_id, no por nombre.

### Cálculo

Puede conservarse el motor puro existente como fuente de reglas donde sea compatible, pero debe alimentarse de:

- partidos oficiales/computables server-backed;
- identidades reales;
- fechas oficiales;
- Nivel oficial histórico para Sorpresa.

No duplicar la fórmula en SQL si puede conservarse una única implementación auditable.

### Persistencia histórica

La arquitectura puede calcular tabla/Race en servidor o materializar snapshots si lo necesita, pero debe preservar:

- membresía histórica;
- puntos reproducibles;
- semanas anteriores;
- Race;
- trazabilidad de qué partido produjo qué puntos/bonus.

No inventar ni reconstruir Nivel histórico cuando no exista evidencia.

---

## 21. Criterios de aceptación de producto

Grupos BRAMU está listo para Production cuando puede demostrarse en Staging que:

1. un usuario sin grupos entiende la propuesta antes de crear uno;
2. Crear mi grupo abre el flujo existente y permite crear sin configurar reglas;
3. al finalizar aparece Tu grupo está listo y luego entra al grupo;
4. el ? explica reglas sin duplicar otro sistema de ayuda;
5. una victoria normal suma 5;
6. bonus válidos llevan a 6 o 7, nunca 8;
7. Remontada y Victoria clara nunca coinciden;
8. cada jugador computa como máximo sus 3 mejores partidos semanales;
9. con empate de puntos se comparte puesto;
10. Race acumula los puntos semanales efectivos;
11. un partido entra automáticamente con al menos 3/4 miembros válidos para esa semana BRAMU;
12. un alta/reingreso puede hacer contar partidos de esa misma semana desde el lunes, pero nunca de semanas anteriores; al eliminar un miembro deja de aparecer en tablas/Race/Intelligence, sin borrar partidos reales ni recalcular los puntos históricos de los demás;
13. avatar real aparece donde exista y las iniciales son fallback;
14. el CTA Agregar jugador es secundario;
15. Nivel y Ranking permanecen independientes;
16. la estructura actual de grupo no sufre regresiones;
17. los datos son server-backed y sobreviven sesión, dispositivo y deploy;
18. dos usuarios miembros del mismo grupo ven la misma verdad compartida;
19. permisos de admin y membresía se cumplen server-side;
20. ningún dato simulado/local se presenta como verdad productiva;
21. la bottom-nav Mis grupos abre el lobby incluso con un solo grupo;
22. el lobby ordena grupos por actividad significativa más reciente, sin depender de que el usuario actual haya participado;
23. cada tarjeta muestra identidad del grupo + lectura semanal y no se convierte en dashboard;
24. foto de grupo real cuando existe; iniciales del nombre como fallback;
25. estado semanal con top visible respeta empates reales;
26. si el usuario queda fuera de las filas visibles, se muestra su posición sin duplicarlo cuando ya aparece;
27. los grupos con 1 o 2 miembros se muestran de forma positiva y nunca como error;
28. el estado cero reutiliza la misma tarjeta del lobby como EJEMPLO;
29. el selector interno de grupo se conserva en esta primera versión;
30. volver desde el detalle de un grupo lleva al lobby.
31. tocar una fila semanal abre un desglose compacto y verificable de cómo se formaron sus puntos;
32. el desglose semanal conserva puntos a la derecha y muestra fecha/pareja/rivales/resultado/puntos por partido sin convertirse en planilla;
33. partidos fuera del top 3 siguen visibles como actividad, marcados como 0 pts o fuera de los 3 mejores;
34. Race explica el acumulado con una línea compacta por semana;
35. el Perfil público sigue accesible como acción secundaria desde el desglose.

---

## 22. Decisión de alcance

A partir del 28/09/2026, **Grupos BRAMU deja de considerarse una función diferible del prototipo y pasa a formar parte del producto que debe quedar listo antes de abrir Production a los primeros usuarios.**

Esto modifica la planificación anterior que dejaba los rankings privados de grupos fuera del lanzamiento inicial.

La prioridad no es sumar funciones nuevas: es productivizar la base ya existente y elevar su entrada/explicación sin romper lo que ya funciona.

---

## 23. Ajustes finales B2b tras QA real en iPhone (V04.12 / bundle 04.12-h1)

Decisiones ya confirmadas e implementadas:

- **Lobby — top de la tarjeta:** cada jugador visible lleva un avatar chico (foto real si existe, iniciales como fallback); las medidas finales quedaron fijadas en §24; la tarjeta crece naturalmente. Máximo 3 posiciones visibles.
- **Medallas:** `🥇 🥈 🥉` según la posición de competición real, respetando empates (`1,1,3` → `🥇 🥇 🥉`; nunca se fabrica plata). Son solo un indicador visual de la posición, no un premio ni un badge persistente.
- **Botón del lobby:** "Nuevo grupo".
- **Agregar jugador:** únicamente en Configuración (no en Semana actual/pasada/Race). Es una acción administrativa: CTA secundario lima (composición final en §24).
- **Ayuda:** un único `?` en el header del detalle, junto al engranaje; sin link inferior.
- **Desglose semanal — formato final por partido:** fecha; `Titular / Compañero vs Rival / Rival`; resultado real por set + motivo (`6–4 · 6–2 · Victoria clara`, o `Victoria` / `Derrota`); puntos a la derecha (o "No entra en tus 3 mejores"). Las parejas se separan con `/`, nunca con `+`. No se inventan scores ni bonus.
- **Ver perfil:** link secundario discreto al final del sheet ("Ver perfil de {Nombre} ›"); sin card grande. El sheet ocupa ~82 % del viewport y reserva 12 px a la derecha para el indicador de scroll.
- **Contenido sobre la bottom-nav:** `.analysis-scroll` suma `var(--bottomnav-h)` (medida en runtime por `showView()`, `0px` sin barra) para que la última fila de la tabla quede completamente visible.

---

## 24. Microcierre visual B2b (V04.13 / bundle 04.13-h1)

Composición final probada por Sebastián en el inspector sobre la UI real:

- **Lobby:** `.lobby-card__head` con `margin-bottom: 15px`; avatar del grupo (`.lobby-card__avatar`) de **50×50** (por ahora con iniciales; la foto real del grupo llega con B2c y reutilizará este mismo contenedor); avatar de cada jugador del top (`.lobby-card__row-avatar`) de **45×45**; `.lobby-card__body` con `gap: 6px`. Se mantienen medallas 🥇🥈🥉, semántica 1,1,3, foto real o iniciales, nombre, puntos y máximo 3 posiciones. Sin fondo celeste ni superficie nueva.
- **Configuración — miembros:** mismo patrón de identidad que la tabla deportiva: avatar real (o iniciales), nombre, `@usuario` secundario solo si existe realmente y tag `ADMIN` donde corresponde. A la derecha, Hacer/Quitar admin y Quitar del grupo. No se muestran Nivel, partidos, V/D ni efectividad. Reutiliza `groupRowIdentity`/`buildGroupAvatarHTML` y `groupsServer.identities` (cargado por el detalle): sin RPC ni N+1 por fila, y sin resolver identidad por nombre en sesión server-backed.
- **Configuración — Agregar jugador:** vuelve a la misma composición del CTA `CREAR GRUPO` del selector de grupos: ancho completo, `.btn-secondary--lime`, altura estándar (~48 px), texto `+ AGREGAR JUGADOR`. Se elimina el override compacto de V04.12. Sigue existiendo únicamente en Configuración.
