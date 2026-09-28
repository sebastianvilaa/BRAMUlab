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
- Agregar o quitar miembros no reescribe retroactivamente qué partidos contaron mientras esa persona pertenecía al grupo.
- La pertenencia debe conservar períodos históricos de entrada/salida.
- Salir o ser quitado del grupo no borra puntos históricos ya obtenidos.
- Entrar a un grupo no agrega retroactivamente partidos previos a la pertenencia.
- Un mismo partido puede contar para más de un grupo si cumple las reglas de cada uno.

---

## 4. Qué partidos cuentan

Un partido cuenta automáticamente para un grupo cuando:

1. es un partido oficial/computable bajo la verdad vigente de BRAMU;
2. tiene fecha efectiva válida;
3. al menos **3 de sus 4 jugadores** eran miembros activos del grupo en la fecha del partido.

### Grupo todavía no competitivo

**Un grupo puede existir con 1 o 2 miembros.** No bloquear su creación.

Mientras tenga menos de 3 miembros activos:
- el grupo puede abrirse, renombrarse y administrarse;
- puede tener más de un admin;
- puede agregar/quitar miembros;
- **ningún partido suma puntos todavía**, porque es imposible cumplir la regla 3/4.

La UX debe explicarlo en positivo, por ejemplo:

**Necesitás al menos 3 jugadores en el grupo para empezar a sumar puntos.**

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

Las victorias/derrotas y partidos mostrados como “contados” en la tabla semanal corresponden al mismo subconjunto de hasta 3 partidos que computó para puntos.

---

## 7. Semana, tabla y empates

La competencia semanal va de **lunes a domingo**.

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
- conserva puntos históricos aunque un miembro luego salga del grupo;
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

### DECISIÓN ABIERTA — entrada a “Mis grupos”

Antes de implementar la siguiente ronda visual, definir si la entrada a **Mis grupos** sigue abriendo directamente un grupo activo o evoluciona a una pantalla inicial propia donde:
- se muestren los grupos del usuario como destinos;
- el usuario elija a qué grupo entrar;
- pueda existir una lectura breve y útil de cómo viene cada grupo, solo si surge de datos reales;
- desde ahí también se pueda crear un grupo.

Esta idea **no está aprobada todavía** y debe resolverse en la ronda de producto/UX de Grupos antes de B2. No implementarla por anticipación.

La estructura actual de Grupos ya está bien resuelta y **no se rediseña de forma general**.

La ronda productiva debe concentrarse en:

1. elevar el estado cero;
2. explicar mejor cómo funciona el producto;
3. cerrar visualmente la creación;
4. unificar identidad/avatar server-backed;
5. bajar la jerarquía del CTA administrativo “Agregar jugador”.

La novedad debe venir de composición, jerarquía y relato de producto usando el sistema visual vigente de BRAMUlab. No crear una estética paralela.

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

Debajo de la explicación debe existir una mini preview de una tabla realista de grupo, claramente marcada como:

**EJEMPLO**

Puede mostrar:

- nombre de grupo ficticio;
- 3 jugadores;
- posición;
- puntos;
- una referencia pequeña a Race.

Los datos de ejemplo son solo demostrativos y nunca deben mezclarse con datos reales del usuario.

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

Crear un grupo debe seguir siendo una tarea rápida.

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

- selector de grupo activo;
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
- acceso desde filas a perfiles;
- sistema de colores, tarjetas, tipografía y shells generales de BRAMUlab;
- bottom-nav Mis grupos.

No rehacer estas superficies para “modernizarlas”.

---

## 19. Fuera de alcance V1

No agregar ahora:

- medallas;
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
11. un partido entra automáticamente con al menos 3/4 miembros activos en su fecha;
12. entrar/salir del grupo no reescribe retroactivamente pertenencia histórica;
13. avatar real aparece donde exista y las iniciales son fallback;
14. el CTA Agregar jugador es secundario;
15. Nivel y Ranking permanecen independientes;
16. la estructura actual de grupo no sufre regresiones;
17. los datos son server-backed y sobreviven sesión, dispositivo y deploy;
18. dos usuarios miembros del mismo grupo ven la misma verdad compartida;
19. permisos de admin y membresía se cumplen server-side;
20. ningún dato simulado/local se presenta como verdad productiva.

---

## 22. Decisión de alcance

A partir del 28/09/2026, **Grupos BRAMU deja de considerarse una función diferible del prototipo y pasa a formar parte del producto que debe quedar listo antes de abrir Production a los primeros usuarios.**

Esto modifica la planificación anterior que dejaba los rankings privados de grupos fuera del lanzamiento inicial.

La prioridad no es sumar funciones nuevas: es productivizar la base ya existente y elevar su entrada/explicación sin romper lo que ya funciona.
