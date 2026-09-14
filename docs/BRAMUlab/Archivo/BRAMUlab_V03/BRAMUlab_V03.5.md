# BRAMUlab V03.5 — Ranking BRAMU

**Estado:** CERRADA — implementada, verificada y publicada (Bloques 1-4 completos). Ver §25 para el cierre.  
**Base funcional:** BRAMUlab V03.4.6.  
**Fuente funcional de Ranking:** `docs/BRAMUlab/Ranking_BRAMU.md`.  
**Objetivo de esta versión:** diseñar e implementar dentro del prototipo actual la experiencia completa de Ranking BRAMU V1 utilizando datos simulados/coherentes, sin backend real y sin modificar la fórmula de Nivel BRAMU.

---

## 1. Alcance de V03.5

V03.5 incorpora Ranking BRAMU al prototipo de la rama Jugador.

Esta versión debe resolver:

- acceso al Ranking desde la interfaz actual;
- pantalla principal de Ranking BRAMU;
- navegación por ámbitos;
- clasificación General y Por Nivel;
- visualización de la posición propia;
- contexto de jugadores cercanos;
- clasificación completa;
- búsqueda;
- acceso al perfil público;
- estados de producto definidos por Ranking BRAMU V1;
- comportamiento responsive y coherencia visual con el resto de la aplicación.

V03.5 NO convierte todavía al Ranking en un sistema real multiusuario.

En esta versión:

- los datos de ranking pueden ser simulados;
- el Nivel mostrado puede apoyarse en los datos simulados existentes del prototipo;
- no se implementa backend;
- no se implementa validación real multiusuario;
- no se implementan snapshots reales semanales;
- no se modifica Nivel BRAMU;
- no se crean puntos propios de Ranking.

La interfaz debe quedar preparada para sustituir posteriormente los datos simulados por datos reales sin rediseñar la experiencia.

---

## 2. Fuente de verdad

Antes de implementar cualquier bloque de V03.5 debe leerse completo:

`docs/BRAMUlab/Ranking_BRAMU.md`

Ese documento define la lógica funcional cerrada de Ranking BRAMU V1.

No deben reabrirse ni reinterpretarse decisiones funcionales ya cerradas.

Ranking BRAMU:

- ordena por el Nivel BRAMU consolidado interno exacto;
- no tiene puntos propios;
- no modifica Nivel BRAMU;
- es continuo;
- compara el movimiento visible contra un corte semanal;
- distingue Ranking BRAMU, Nivel BRAMU y Mis grupos;
- aplica reglas de elegibilidad y densidad;
- utiliza localidad exacta, no agrupaciones territoriales automáticas;
- conecta cada fila de jugador con su perfil público.

La fórmula y reglas de Nivel BRAMU permanecen fuera del alcance de V03.5.

---

## 3. Principios de diseño

Ranking debe sentirse parte de BRAMUlab, no un módulo visual independiente.

Reutilizar al máximo:

- sistema de headers actual;
- tipografía y jerarquías existentes;
- tabs de Historial y Mis grupos;
- filas de jugadores;
- avatares/fotos;
- nombre visible y `@usuario`;
- presentación de Nivel BRAMU;
- buscador;
- Perfil público;
- bottom sheets;
- estados vacíos existentes;
- patrones responsive ya corregidos en V03.4.6.

No crear un sistema visual nuevo si un componente existente puede resolver la misma función.

Home sigue siendo referencia visual principal.

No rediseñar Home.

---

## 4. Acceso a Ranking BRAMU

Ranking BRAMU NO vuelve a la bottom navigation.

La bottom nav permanece:

`Inicio | Historial | + | Mis grupos | Perfil`

El acceso a Ranking se agrega en el header del Home.

Orden conceptual:

`[logo BRAMUlab]                     [Ranking] [Notificaciones]`

Agregar un icono específico de Ranking junto al actual icono de Notificaciones.

El icono debe comunicar:

- clasificación;
- ranking;
- leaderboard;
- posición.

Evitar una copa demasiado asociada a premio o campeón si existe una alternativa más clara.

No agregar una tarjeta grande adicional al Home para acceder al Ranking.

Al tocar el icono se abre la pantalla principal de Ranking BRAMU.

---

## 5. Pantalla principal

Ranking BRAMU utiliza UNA sola pantalla principal.

Los cambios de ámbito o clasificación ocurren dentro de esa misma pantalla.

### 5.1 Header

Título:

`RANKING BRAMU`

Debe utilizar el mismo sistema visual de headers ya vigente.

Debe permitir volver correctamente a Home.

---

## 6. Ámbitos

Orden inicial durante el piloto:

1. Mis jugadores
2. Local
3. Provincial
4. País
5. Global

Por ahora `Mis jugadores` abre por defecto.

La decisión podrá reevaluarse cuando haya densidad real suficiente para que Local sea más útil como entrada principal.

Las tabs deben reutilizar el patrón visual existente en Historial/Mis grupos.

No crear un sistema de tabs nuevo.

---

## 7. Tipo de clasificación

Debajo del ámbito existe un selector:

`General | Por Nivel`

### General

Incluye todos los jugadores elegibles del universo seleccionado.

### Por Nivel

Filtra por banda fija de Nivel BRAMU.

Cuando está activo debe aparecer un selector de banda:

- Nivel 1
- Nivel 2
- Nivel 3
- Nivel 4
- Nivel 5
- Nivel 6
- Nivel 7
- Nivel 8
- Nivel 9
- Nivel 10

Por defecto se preselecciona la banda correspondiente al Nivel público del usuario.

Las bandas se determinan con el Nivel público visible, pero el orden dentro de la banda utiliza el Nivel interno exacto.

---

## 8. Jerarquía de contenido

Orden recomendado de la pantalla:

1. Header Ranking BRAMU
2. Tabs de ámbito
3. General / Por Nivel
4. Selector de banda si corresponde
5. Contexto del ranking actual
6. Tarjeta `TU POSICIÓN`
7. Bloque `CERCA TUYO`
8. Clasificación completa
9. Búsqueda
10. Ayuda `Cómo funciona el Ranking BRAMU`

No utilizar un podio grande como elemento principal.

La primera función de la pantalla es que el jugador entienda dónde está parado.

---

## 9. Tu posición

Debe aparecer antes de la clasificación completa.

Tiene alta jerarquía visual, pero debe seguir siendo compacta.

Información mínima:

- puesto actual;
- total del universo;
- Nivel BRAMU público;
- movimiento semanal;
- ámbito/contexto;
- tipo de clasificación.

Ejemplo conceptual:

`#18 de 74`  
`Nivel BRAMU 5,4`  
`↑ 3 esta semana`  
`Bella Vista · General`

Este ejemplo define contenido, no diseño literal.

### Acción: Verme en la clasificación

Debe existir una acción equivalente a:

`VERME EN LA CLASIFICACIÓN`

Si el usuario ocupa una posición lejana, por ejemplo 275, no debe ser necesario cargar manualmente desde la posición 1.

La acción debe cargar directamente el tramo correspondiente y ubicar visualmente la fila del usuario.

---

## 10. Cerca tuyo

Mostrar el contexto inmediato de la posición propia.

Referencia inicial:

- dos jugadores inmediatamente superiores;
- usuario actual;
- dos jugadores inmediatamente inferiores.

No es un ranking separado.

Su función es permitir comprender rápidamente la distancia competitiva alrededor del usuario.

---

## 11. Clasificación completa

### 11.1 Datos de fila

Reutilizar el componente actual de fila de jugador cuando sea posible.

Cada fila debe poder mostrar:

- posición;
- movimiento semanal;
- foto/avatar;
- nombre visible;
- `@usuario`, cuando exista;
- Nivel BRAMU público;
- contexto mínimo según la vista.

No mostrar en la fila principal:

- efectividad;
- victorias;
- derrotas;
- rachas;
- cantidad total de partidos;
- última fecha exacta de juego.

Estos datos pertenecen al Perfil público.

### 11.2 Fila propia

Cuando el usuario actual aparezca dentro de la clasificación, su fila debe quedar resaltada de forma sobria y reconocible.

Debe conservar la estructura de las otras filas.

No transformarla en una tarjeta completamente distinta.

El objetivo es que pueda encontrarse rápidamente durante el scroll.

---

## 12. Carga progresiva

La clasificación completa se carga por bloques de 50 jugadores.

Primera carga:

`1–50`

Al alcanzar el final:

`51–100`

Luego:

`101–150`

y así sucesivamente.

Puede resolverse mediante scroll progresivo o acción equivalente según lo que mejor encaje con la arquitectura actual.

No cargar innecesariamente cientos de filas desde el inicio.

La acción `Verme en la clasificación` debe poder cargar directamente el bloque que contiene al usuario.

---

## 13. Búsqueda

Debe existir búsqueda por:

- nombre visible;
- `@usuario`.

La búsqueda actúa únicamente dentro del universo/filtro actualmente seleccionado.

No modifica el cálculo del ranking.

Los resultados utilizan la misma fila de jugador y abren el Perfil público.

---

## 14. Perfil público

Tocar una fila abre el Perfil público existente.

No crear una nueva ficha exclusiva para Ranking.

El Perfil público podrá incorporar posteriormente posiciones vigentes como información contextual, pero V03.5 debe priorizar reutilizar la pantalla existente.

La propia fila del usuario puede abrir MI PERFIL si ese patrón continúa siendo el más coherente con el comportamiento actual de la app.

---

## 15. Estados que debe soportar V03.5

La experiencia final debe contemplar:

- usuario sin Nivel;
- calibrando;
- recalibrando con Nivel consolidado anterior;
- calibrado y activo;
- sin ubicación;
- perfil privado;
- Ranking deshabilitado;
- inactivo;
- comunidad territorial con 0–4 elegibles;
- clasificación en formación con 5–14;
- ranking establecido con 15+;
- Global bloqueado;
- nuevo ingreso;
- reingreso;
- cambio de universo;
- sin corte semanal comparable;
- error;
- Mis jugadores con 1 o 2 elegibles;
- Mis jugadores con calibrando;
- Mis jugadores con inactivos.

Estos estados deben implementarse progresivamente por bloques.

---

## 16. Reglas de densidad

### Territoriales

0–4 elegibles:
- no publicar puestos;
- explicar cuántos faltan;
- ofrecer ámbito superior o volver a General.

5–14:
- clasificación en formación;
- mostrar puesto con denominador;
- sin podio ni reconocimiento de Nº1.

15+:
- ranking establecido;
- tratamiento normal.

### Mis jugadores

No utiliza los mismos umbrales territoriales.

- con 1–2 elegibles: comparación simple, sin `N de total`;
- desde 3 elegibles: habilitar posiciones;
- calibrando e inactivos pueden permanecer visibles sin puesto.

---

## 17. Global

La pestaña Global existe desde V03.5.

Inicialmente debe poder mostrarse bloqueada.

Copy funcional de referencia:

`El Ranking Global se habilitará cuando BRAMU tenga jugadores elegibles en más de un país.`

Cuando en el futuro se desbloquee, deberá seguir las mismas reglas de densidad territorial.

---

## 18. Movimiento semanal

Estados previstos:

- `+N`
- `−N`
- `—`
- `Nuevo`
- sin indicador si todavía no existe una comparación válida.

El movimiento representa cambio de puesto respecto del último corte semanal comparable.

No implica necesariamente que el Nivel haya mejorado o empeorado.

Evitar tratamiento visual rojo/verde excesivamente asociado a éxito o fracaso.

---

## 19. Ayuda

Debe existir acceso a:

`Cómo funciona el Ranking BRAMU`

Puede utilizar el patrón actual de bottom sheet.

Debe explicar de forma breve:

- diferencia entre Nivel y Ranking;
- por qué puede cambiar el puesto sin jugar;
- qué significa la variación semanal;
- por qué alguien puede no tener posición;
- que el Nivel visible se redondea pero el orden usa precisión interna;
- reglas generales de actividad y densidad.

No convertirlo en una copia completa de `Ranking_BRAMU.md`.

---

# 20. Plan de implementación

V03.5 se implementa en bloques pequeños, verificables y reversibles.

El plan completo debe ser conocido desde el inicio, pero cada bloque requiere autorización antes de implementarse.

---

## BLOQUE 1 — Estructura y navegación

### Objetivo

Validar la arquitectura visual y de navegación antes de implementar lógica simulada completa.

### Implementar

- icono Ranking en header del Home;
- nueva pantalla Ranking BRAMU;
- navegación Home → Ranking → Home;
- tabs:
  - Mis jugadores
  - Local
  - Provincial
  - País
  - Global
- selector:
  - General
  - Por Nivel
- selector visual de banda cuando Por Nivel esté activo;
- estructura preparada para:
  - Tu posición
  - Cerca tuyo
  - Clasificación
- mobile primero;
- reutilización de componentes visuales existentes.

### No implementar todavía

- dataset completo;
- ranking real;
- todos los estados;
- paginación funcional;
- búsqueda final;
- movimiento semanal completo;
- lógica avanzada de densidad;
- backend.

### QA

Verificar:

- Home no cambia salvo nuevo acceso;
- bottom nav no cambia;
- Historial no cambia;
- Mis grupos no cambia;
- Perfil no cambia;
- pantalla funciona en mobile;
- tabs no rompen responsive;
- navegación de regreso correcta.

---

## BLOQUE 2 — Ranking establecido simulado

### Objetivo

Construir la experiencia principal del ranking con datos simulados coherentes.

### Implementar

- dataset mock estable;
- orden por Nivel interno simulado;
- posición propia;
- denominador;
- Cerca tuyo;
- clasificación completa;
- movimiento semanal simulado;
- fila propia resaltada;
- carga por bloques de 50;
- `Verme en la clasificación`;
- búsqueda;
- apertura del Perfil público;
- General;
- Por Nivel;
- bandas de Nivel.

El dataset debe ser determinístico y estable entre renders.

No inventar una segunda fórmula de Nivel.

---

## BLOQUE 3 — Estados de producto

### Objetivo

Completar la UX funcional de Ranking BRAMU V1.

### Implementar

- calibrando;
- recalibrando;
- inactivo;
- sin ubicación;
- perfil privado;
- opt-out;
- 0–4 elegibles;
- 5–14 en formación;
- 15+ establecido;
- Global bloqueado;
- Nuevo;
- reingreso;
- sin comparación semanal;
- error;
- Mis jugadores con pocos elegibles;
- calibrando/inactivos dentro de Mis jugadores;
- ayuda `Cómo funciona el Ranking BRAMU`.

No agregar estados no definidos por `Ranking_BRAMU.md` sin justificarlo.

---

## BLOQUE 4 — QA y cierre

### Objetivo

Cerrar V03.5 como experiencia completa y estable.

### Verificar

- mobile principal;
- iPad Mini/tablet;
- desktop quick check;
- scroll;
- tabs;
- filtros;
- carga progresiva;
- búsqueda;
- navegación;
- Perfil público;
- todos los estados;
- consistencia visual con Home/Historial/Mis grupos/Perfil.

### Tests

- tests focales únicamente cuando un bloque toque lógica pura;
- no crear tests artificiales para cambios exclusivamente CSS/markup;
- full suite una sola vez al cierre;
- no repetir full suite si ya quedó verde y no hubo cambios posteriores relevantes.

### Cierre

Al finalizar V03.5:

- documentar qué quedó implementado;
- registrar adaptaciones justificadas;
- commit;
- tag;
- push;
- deploy;
- actualizar documentación correspondiente.

---

## 21. Reglas técnicas

- No modificar fórmula de Nivel BRAMU.
- No calcular Nivel dentro de Ranking.
- No modificar motor del marcador.
- No modificar estadísticas.
- No tocar Historial salvo reutilización estrictamente necesaria y sin regresiones.
- No modificar Mis grupos.
- No rediseñar Perfil.
- No cambiar bottom navigation.
- No refactorizar globalmente la app.
- No reemplazar componentes que ya funcionan sin una razón concreta.
- Reutilizar módulos y componentes existentes cuando sea razonable.
- Mantener identidad por `userId`.
- Datos simulados de V03.5 deben quedar claramente separables de una futura fuente backend.
- No exponer conceptos de backend en la interfaz.

---

## 22. Criterios de aceptación de V03.5

V03.5 podrá considerarse cerrada cuando:

- Ranking sea accesible desde Home;
- la navegación no altere la bottom nav;
- los cinco ámbitos estén representados;
- General y Por Nivel funcionen;
- las bandas funcionen;
- Tu posición sea clara;
- Cerca tuyo funcione;
- el listado completo funcione;
- la fila propia sea reconocible;
- la carga progresiva funcione;
- `Verme en la clasificación` ubique al usuario;
- la búsqueda funcione;
- cada fila abra el Perfil público;
- todos los estados V1 necesarios estén representados;
- Global bloqueado tenga UX correcta;
- mobile/tablet/desktop sean coherentes;
- no existan regresiones en V03.4.6;
- los tests correspondientes estén verdes;
- el comportamiento siga siendo compatible con una futura fuente de datos real.

---

## 23. Fuera de alcance

No forman parte de V03.5:

- backend real;
- Supabase;
- validación real de partidos;
- snapshots reales;
- notificaciones push;
- Race BRAMU;
- temporadas;
- ranking privado de Mis grupos;
- filtros por género;
- filtros por categoría competitiva;
- ranking por edad;
- clubes;
- matchmaking;
- torneos;
- premios;
- compartir Nº1;
- arquitectura definitiva de endpoints.

---

## 24. Estrategia documental de la línea V03

`BRAMUlab_V03.5.md` es el documento operativo de esta etapa.

Las siguientes iteraciones pueden documentarse como:

- `BRAMUlab_V03.5.1.md`
- `BRAMUlab_V03.5.2.md`
- `BRAMUlab_V03.5.3.md`
- etc.

Cada documento posterior debe registrar únicamente los cambios, decisiones, implementación y QA correspondientes a esa ronda.

Cuando V03 quede definitivamente cerrada, toda la información vigente de estas iteraciones se volverá a sintetizar en:

- `BRAMUlab_V03_Consolidado.md`
- `BRAMUlab_V03_Informe.md`

Los documentos intermedios podrán eliminarse del repositorio una vez confirmado que la consolidación no pierde información relevante y que permanecen recuperables desde el historial de Git.

---

## 25. Cierre de V03.5 (Bloque 4)

**Tag:** `BRAMUlab_V03.5`. **Base:** BRAMUlab_V03.4.6. **Tests finales:** 901/901 (828 previos + 73 nuevos de Ranking, en `ranking.js`/`tests.html`).

### 25.1 Qué quedó implementado

Los cuatro bloques completos, sin recortes de alcance respecto de lo pedido:

- **Bloque 1** — ícono de Ranking en el header del Home (nunca en la bottom nav), pantalla única `RANKING BRAMU`, tabs de ámbito (Mis jugadores/Local/Provincial/País/Global), selector General/Por Nivel, bandas 1-10.
- **Bloque 2** — dataset territorial mock determinístico (`ranking.js`), orden por Nivel interno (competencia "1,1,3" vía `PG.assignPositions`, reutilizada), Tu posición, Cerca tuyo, clasificación paginada en bloques de 50, "Verme en la clasificación", movimiento semanal simulado, búsqueda por nombre/@usuario, fila propia resaltada, apertura de Perfil público/Mi Perfil.
- **Bloque 3** — estados de producto: sin Nivel, calibrando (partidos Y rivales distintos — ver §25.2), calibrado y activo, inactivo (180 días), Nuevo/reingreso, sin ubicación, perfil privado/opt-out (lógica lista, sin toggle en Perfil — ver limitaciones), densidad territorial 0-4/5-14/15+, densidad de Mis jugadores 1-2/3+, Global bloqueado, ayuda "Cómo funciona el Ranking BRAMU".
- **Bloque 4** — QA completo, un bug real corregido (ver 25.3), full suite verde, publicación.

### 25.2 Adaptaciones reales respecto de los documentos

- **Calibración**: corregida durante el Bloque 3 para exigir 5 partidos computables Y 3 rivales distintos a la vez (no solo la cantidad), tal como cierra el Caso 4 de `Ranking_BRAMU.md`.
- **Nivel interno mock** (`sortNudge` en `ranking.js`): aproximación exclusiva de esta versión para evitar empates masivos del dataset mock (precisión de un decimal). Nunca modifica `PH.computeSimulatedJugadorLevel` ni se muestra: debe eliminarse cuando exista el Nivel consolidado interno real (V04+).
- **Mis jugadores** (`ML.computeRecentPlayers`): sustitución temporal de "partidos validados" — este prototipo no tiene validación multiusuario real todavía. Se reemplaza por vínculos derivados de partidos validados cuando exista backend.
- **Recalibrando**: sin disparador real posible hoy — el prototipo no distingue Nivel consolidado de provisional en ningún lado (la fórmula real de Nivel BRAMU no está implementada). No se fabricó un estado falso.
- **Perfil privado / Ranking opt-out**: lógica completa y testeada (`computeSelfStatus` ya lee `user.isPublicProfile`/`user.rankingOptOut`), pero sin toggle en Perfil — esos campos no existen en el modelo de cuenta y agregarlos excedía "representar estados" hacia "diseñar Privacidad", fuera del pedido del Bloque 3.
- **Cambio de universo / sin corte semanal comparable**: sin snapshots persistidos en este prototipo (todo se recalcula por render), así que no existe un corte viejo que pudiera arrastrarse mal entre universos — la garantía del documento queda satisfecha por diseño, no como un estado con gatillo propio.
- **Bandas 1, 2, 8, 9 y 10** quedan vacías en el dataset mock (el Nivel simulado de jugadores sin historial vive en 3,0-7,5) — estado vacío honesto, sin inventar niveles.

### 25.3 Bug real encontrado y corregido durante el Bloque 4

Ninguno nuevo. El único bug real de todo V03.5 (`buildRankingEntries` inventándole una localidad mock a compañeros reales de Mis jugadores) se encontró y corrigió durante el propio Bloque 2/3 QA — ver el detalle ya registrado en esas rondas. El Bloque 4 no encontró regresiones ni bugs nuevos.

### 25.4 Limitaciones conocidas, propias del prototipo (no bugs)

- Dataset territorial 100% mock/Argentina — Global permanece siempre bloqueado en este build (no hay forma de tener un segundo país real).
- "Perfil privado"/"Ranking opt-out" no son alcanzables desde la UI (sin toggle en Perfil todavía).
- "Recalibrando" no tiene representación real (depende de que exista Nivel BRAMU consolidado real).
- Movimiento semanal es simulado (jitter estable por jugador), no un corte semanal real persistido.
- `Mis jugadores` usa partidos guardados sin validación multiusuario real (ver 25.2).
