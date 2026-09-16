# BRAMU — Desarrollo V13–V14 — Backup final del chat

**Propósito:** respaldo práctico de decisiones, criterios, arquitectura y aprendizajes útiles surgidos en este chat. No es una cronología. Debe permitir recuperar el estado conceptual y técnico aunque este chat se elimine.

**Alcance principal:** cierre del marcador V13, incorporación y refinamiento de **Por Games**, evolución de **BRAMU Intelligence**, cambio seguro del sistema de puntuación, primera versión de **Cargar partido jugado** en V14 y separación entre trabajo de **Desarrollo** y **Producto/Negocio/Brainstorming**.

---

# 1. OBJETIVO DE ESTE CHAT

Este chat funcionó como espacio de **desarrollo operativo de BRAMU** para:

- revisar implementaciones de Claude Code;
- convertir hallazgos reales de cancha en especificaciones;
- definir UX/producto antes de programar;
- revisar reportes técnicos;
- armar consolidados por versión;
- distinguir bugs críticos de polish;
- decidir cuándo una versión quedaba suficientemente cerrada.

Metodología consolidada:

**ChatGPT producto/especificación → consolidado `.md` → Claude Code implementa → tests → Git/GitHub → GitHub Pages → prueba manual/real → siguiente ronda.**

Separación de espacios decidida al cierre:

- **Desarrollo:** implementación, bugs, validación, consolidaciones técnicas.
- **Producto/Negocio/Brainstorming:** investigación, competidores, Home, perfiles, grupos, arquitectura Jugador/Espectador.

---

# 2. DECISIONES DE PRODUCTO VIGENTES

## 2.1 BRAMU tiene dos contextos de uso

### BRAMU JUGADOR
La persona está dentro de la cancha o registra partidos que jugó.

Valor potencial:
- cargar partidos ya jugados;
- construir historial personal;
- ver rachas;
- comparar compañeros/rivales;
- head-to-head;
- grupos privados;
- eventualmente ranking;
- eventualmente torneos;
- obtener una lectura acumulada de su historia.

### BRAMU ESPECTADOR
La persona está afuera de la cancha.

Necesidades:
- saber cuánto van;
- registrar el partido;
- no perderse;
- obtener estadísticas;
- ver Evolución;
- leer BRAMU Intelligence.

Acá viven:
- **Modo Completo**;
- **Por Games**;
- eventualmente **BRAMU Pro**.

Estas dos caras pueden compartir motor, jugadores, historial e Intelligence, pero tienen motivaciones y costos de registro distintos.

---

## 2.2 Modos de registro en vivo

### Completo
Registro punto por punto.

Permite máxima profundidad:
- puntos;
- games;
- sets;
- breaks;
- holds;
- Break Points;
- Match Points;
- situaciones decisivas;
- Evolución detallada;
- BRAMU Intelligence profunda.

**Aprendizaje real:** exige demasiada atención para un espectador casual. Puede tener sentido para alguien encargado del partido, torneo, relator, coach u operador.

### Por Games
Un toque por game.

Permite:
- games;
- holds;
- breaks;
- rachas;
- ventajas;
- remontadas;
- Evolución por games;
- resultado;
- Intelligence intermedia.

**Aprendizaje real:** mucho más compatible con mirar un partido socialmente sin sentir que uno está trabajando.

---

## 2.3 “Cargar partido jugado” NO es un tercer modo en vivo

**Confirmado.**

`Completo` y `Por Games` son formas de registrar un partido EN VIVO.

`Cargar partido jugado` es otro flujo:
- partido finalizado;
- mínima carga;
- resultado conocido;
- menor resolución estadística;
- historial;
- BRAMU Intelligence básica.

Internamente puede usar `mode: 'manual'`, pero no debe presentarse como un tercer modo de registro.

---

# 3. BRAMU INTELLIGENCE — PRINCIPIOS VIGENTES

## 3.1 Sensación objetivo

> **“Alguien vio mi partido y me contó qué pasó.”**

No:

> “Una plantilla leyó el resultado.”

## 3.2 Arquitectura conceptual

**DATOS → HECHOS → EVENTOS → JERARQUÍA → RELACIONES → HISTORIA → EVIDENCIA ESTADÍSTICA → REDACCIÓN**

La redacción viene después de decidir qué hechos merecen ser contados.

## 3.3 Profundidad según datos

### Partido cargado — Intelligence básica
Puede usar:
- ganador;
- sets;
- games;
- sets corridos;
- remontada a nivel de sets;
- set más parejo;
- set con mayor margen;
- decisivo cerrado.

No puede inferir:
- breaks;
- holds;
- rachas internas;
- máxima ventaja;
- quién comenzó mejor dentro de un set;
- evolución interna;
- puntos decisivos.

### Por Games — Intelligence intermedia
Puede sumar:
- breaks;
- holds;
- rachas de games;
- ventajas;
- remontadas dentro del set;
- secuencia de games.

### Completo — Intelligence profunda
Puede sumar:
- puntos;
- Break Points;
- Match Points;
- holds bajo presión;
- puntos salvados;
- eventos decisivos.

### Pro — futuro
Datos individuales/técnicos.

**Regla:** nunca inventar lo que no se midió.

---

## 3.4 Jerarquía narrativa

Un hecho fuerte debe ganarle a uno genérico.

Ejemplo validado:

`1-3 → 6-3` con cinco games consecutivos debe tener prioridad sobre `3-3 → 6-3`.

El 3-3 es verdadero, pero no es la historia principal.

---

## 3.5 Exactitud temporal

Frases como:
- “desde ahí”;
- “a partir del…”;
- “encadenaron…”;
- “ganaron los últimos…”;
- “confirmaron el quiebre”;

deben coincidir exactamente con la secuencia real.

No se permiten contradicciones del tipo:

> “desde 4-4 ganaron cinco games y cerraron 6-4”.

---

## 3.6 Narrar también al perdedor cuando aporta historia

El equipo que pierde puede aportar:
- una ventaja;
- una reacción;
- cortar una racha;
- recuperar un break;
- llevar el set a 5-5;
- forzar TB.

No narrar acciones irrelevantes por obligación.

---

## 3.7 Peso desigual de los sets

No imponer mismo largo ni misma estructura a todos los sets.

Un decisivo, TB, remontada o cambio fuerte puede merecer más desarrollo.

---

## 3.8 Presentación → cambio → desenlace

Usarlo como guía de crónica, no como plantilla fija.

---

## 3.9 Voz deportiva sí; psicología inventada no

Permitido si los datos lo sostienen:
- “reaccionaron”;
- “el partido arrancó parejo”;
- “abrieron una diferencia”;
- “cambiaron la tendencia”;
- “forzaron el tercer set”;
- “el segundo tuvo otra historia”;
- “confirmaron el break”;
- “cerraron con mayor margen”.

Evitar:
- “se pusieron nerviosos”;
- “ganaron confianza”;
- “sintieron el golpe”;
- “se soltaron”;
- “demostraron experiencia”;
- “supieron manejar la presión”.

---

## 3.10 Estadísticas como evidencia, no inventario

No repetir la tabla en forma de texto. Usar stats solo si explican/refuerzan una conclusión.

---

## 3.11 Orden de saque no equivale a remontada

Estar `3-4` abajo no implica remontada si el rival empezó sacando y todos venían manteniendo.

Para clasificar remontada/reacción en Por Games usar:
- quién empezó sacando;
- holds;
- breaks;
- score.

---

## 3.12 Lenguaje porcentual correcto

Se detectó y corrigió un caso absurdo: “casi todos sus games de saque, 5 de 10”.

**Regla:** un 50% nunca puede narrarse como “casi todos”, “se hicieron fuertes con el saque” o equivalente.

---

# 4. PRINCIPIOS DE UX CONFIRMADOS

## 4.1 Pedir poco y lograr alta sensación de completitud

> **Si una pantalla pide diez cosas y el usuario deja seis vacías, aprende inconscientemente que completar no importa.**

Preferencia:
- pedir lo mínimo;
- evitar formularios eternos;
- que el usuario sienta que completó el 100%.

## 4.2 La estética es parte del producto

BRAMU debe:
- entrar por los ojos;
- tener personalidad;
- sentirse deportiva y moderna;
- evitar look de formulario/planilla;
- mantener jerarquía visual clara.

Una función útil pero visualmente pobre puede fracasar por percepción.

## 4.3 Consistencia visual

Las nuevas funciones deben reutilizar:
- Equipo A / Equipo B;
- VS;
- lime/azul;
- pastillas/componentes existentes;
- tipografía;
- jerarquía;
- estados activos.

No crear una estética distinta por cada flujo.

---

# 5. SISTEMA DE PUNTUACIÓN — ESTADO VIGENTE

## 5.1 Por Games

El sistema de puntuación:
- no afecta la lógica de los games;
- es metadata;
- puede cambiarse en cualquier momento.

Menú:

`☰ → SISTEMA DE PUNTUACIÓN`

Opciones:
- STAR POINT;
- PUNTO DE ORO;
- CON VENTAJA.

Punto de Oro permanece como default.

## 5.2 Completo — un único sistema por partido

Desde V13.4:

> **el sistema de puntuación es una única propiedad del partido.**

No puede existir un partido válido con games Gold + Star + Ventaja mezclados.

## 5.3 Cambio seguro

Antes del primer 40-40:
- puede cambiarse desde menú;
- los tres sistemas comparten evolución.

En zona sensible:
- 40-40;
- Deuce;
- Ventaja;
- Star Point;

puede corregirse mientras la secuencia siga siendo compatible.

Una vez cerrado el primer game que realmente pasó por 40-40:

> **sistema bloqueado para el resto del partido.**

## 5.4 Botón contextual CAMBIAR

Cuando la regla importa aparece dentro de la franja:

`PUNTO DE ORO · CAMBIAR`

Regla visual:
- `CAMBIAR` anclado a la derecha;
- texto central centrado respecto del ancho total.

Ese micro-polish fue resuelto en V14.

---

# 6. TIMELINE Y EVOLUCIÓN

## 6.1 Timeline Completo

**Set → Game → puntos reales.**

## 6.2 Timeline Por Games

Antes reutilizaba Completo y fabricaba 15/30/40. Corregido en V13.3.

Debe mostrar:

**Set → Game 1 → Game 2 → Game 3…**

Según disponibilidad:
- número de game;
- ganador;
- score después;
- sacador;
- HOLD/BREAK;
- Highlights.

Nunca mostrar 15/30/40/Deuce si no fueron registrados.

## 6.3 Numeración global

En una prueba Set 3 mostraba Game 18, Game 19, etc.

No es incorrecto técnicamente, pero quedó como posible polish: podría ser más natural reiniciar visualmente a Game 1 dentro de cada set.

## 6.4 Evolución en partido manual

**No mostrar Evolución.**

No hay trayectoria real. No fabricar línea a partir del resultado final.

---

# 7. ESTADÍSTICAS — BUGS Y REGLAS

## 7.1 Stats por set y saque inicial

Bug detectado:
- cuando el sacador inicial de un set no coincidía con el Set 1, los stats aislados podían reconstruir mal holds/breaks/denominadores.

Corregido en V13.3.

### Invariantes agregadas
- suma Breaks por sets = Breaks partido;
- suma Holds por sets = Holds partido;
- suma Games por sets = Games partido;
- denominadores de saque deben ser consistentes.

---

# 8. HITOS DE V13

## V12.2 — base previa cerrada

Aspectos relevantes heredados:
- Ajustar;
- corrección de sacador;
- TB extraordinario;
- progresión;
- resultados truthful;
- Intelligence sin duplicar TB extraordinario.

**No reabrir salvo regresión real.**

## V13 — Por Games

Se incorporó:
- selector de modo;
- un toque por game;
- HOLD/BREAK automáticos;
- TB reglamentario sin point logging;
- TB extraordinario;
- Editar Games;
- Highlights;
- stats específicas;
- Evolución por games;
- Intelligence propia;
- Editar jugadores;
- metadata;
- persistencia.

## V13.1

Mejoras:
- Intelligence Games más rica;
- cronología;
- paridad;
- tramo decisivo;
- orientación/gramática;
- TB sin score interno;
- metadata;
- Forzar actualización oculto.

## V13.2

Correcciones:
- Wake Lock real para iPhone/PWA;
- actualización automática por versión;
- Intelligence menos repetitiva;
- bug `Editar jugadores → 0-0 visual`.

Tests reportados: **239/239**.

## V13.3

Cambios:
- racha de cierre desde origen real;
- distinción remontada vs set parejo;
- narrativa del perdedor;
- stats por set;
- Timeline Por Games;
- cambio de sistema en vivo.

Tests reportados: **270/270**.

### OBSOLETO / REEMPLAZADO
La solución de “regla por punto” que permitía cambiar sistema indefinidamente fue descartada.

## V13.4 — cierre funcional real

Se reemplazó el modelo híbrido.

Cambios:
- sistema único por partido;
- bloqueo tras primer game sensible;
- opciones incompatibles deshabilitadas;
- CAMBIAR dentro de la franja;
- popup de actualización apilado;
- falso concepto de remontada por orden de saque;
- lenguaje de porcentajes.

Tests: **295/295**.

**Estado:** V13 quedó **CERRADA FUNCIONALMENTE**.

---

# 9. WAKE LOCK Y ACTUALIZACIÓN

## 9.1 Wake Lock

Implementado en Completo y Por Games.

Comportamiento:
- mantener pantalla activa durante partido;
- background puede liberar;
- al volver a foreground readquirir;
- al finalizar/abandonar/Home liberar.

Prueba real:
- iPhone;
- tablet Xiaomi;
- no se bloquearon;
- al salir y volver, marcador/reloj siguieron correctamente.

## 9.2 Actualización automática

Chequeo:
- al abrir;
- al volver a foreground.

Si hay versión nueva:
- `ACTUALIZAR`;
- `MÁS TARDE`.

No debe borrar:
- localStorage;
- historial;
- partido en curso;
- preferencias.

Layout final:
- ACTUALIZAR arriba;
- MÁS TARDE abajo.

Long press del logo quedó como fallback.

---

# 10. EDITAR JUGADORES — BUG RESUELTO

Bug real:
- editar jugador en segundo set;
- al guardar aparecía 0-0;
- al tocar pantalla reaparecía score real.

No se perdían datos.

Causa:
- Guardar llamaba al renderer de puntos incluso en Por Games.

Corregido en V13.2.

Regla:

> editar nombre modifica la identidad visible del mismo `playerId`; no recrea match/engine/session.

---

# 11. V14 — CARGAR PARTIDO JUGADO

## 11.1 Hipótesis

> **¿Puedo cargar un partido que ya jugué en pocos segundos y recibir algo suficientemente interesante a cambio?**

Hipótesis adicional:

> cada partido cargado hace más interesante la historia acumulada del jugador.

## 11.2 Primera implementación

Se agregó `CARGAR PARTIDO JUGADO` separado de `EMPEZAR PARTIDO`.

Flujo:
- Equipo A/B;
- Formato;
- Sistema de puntuación;
- Resultado;
- Fecha;
- Hora;
- Lugar;
- ubicación opcional;
- Guardar.

Internamente:

`mode: 'manual'`

Mismo Historial.

Sin:
- duración;
- Evolución;
- Momentos Clave;
- Timeline completo.

BRAMU Intelligence básica.

## 11.3 Campos

### Confirmados/implementados
- jugadores/parejas;
- formato;
- resultado;
- fecha;
- sistema;
- hora opcional;
- lugar opcional.

### DESCARTADO por ahora
- duración;
- notas;
- primer sacador;
- secuencia de games;
- puntos;
- Highlights;
- nivel;
- categoría;
- social/competitivo;
- lado de juego;
- confirmación de otros jugadores.

## 11.4 Primer feedback de V14

La funcionalidad funciona técnicamente, pero la UX visual **NO quedó aprobada**.

Problemas:
- resultado demasiado administrativo;
- dropdowns `6-3` poco atractivos;
- el bloque Resultado no se siente como BRAMU;
- pantalla se percibe demasiado formulario;
- Home actual no contiene la futura propuesta de valor.

### Decisión
No seguir parchando V14 desde Desarrollo hasta definir mejor el producto y la experiencia general.

## 11.5 Orden de información — pendiente

Se discutió mover Resultado antes del Sistema, pero el usuario señaló que en BRAMU **Formato + Sistema de puntuación conviven conceptualmente**.

**No quedó cerrado el orden definitivo.**

Resolver en Producto/Brainstorming.

## 11.6 Resultado visual — pendiente

Se consideró un marcador editable parecido al Resumen:
- parejas en filas;
- sets en columnas;
- números grandes;
- interacción sobre cada número.

Gustó más que dropdowns administrativos, pero NO quedó definido.

## 11.7 Bug reglamentario pendiente

En Clásico se intentó cargar `6-7` y el selector no lo ofrecía.

Si `7-6` existe en una orientación, `6-7` debe poder representar el set ganado por la otra pareja.

**Pendiente técnico real:** revisar enumeración/validación de scores en ambas orientaciones.

No se corrigió porque se decidió pausar Desarrollo.

## 11.8 Geolocalización

Implementación:
- permiso desde dispositivo;
- guarda coordenadas;
- confirmación “ubicación guardada”;
- no resuelve nombre del club.

Decisión:
- no agregar reverse geocoding/backend solo por V14;
- lugar sigue editable/manual;
- rechazo no bloquea Guardar.

**Pendiente de producto:** cómo comunicar ubicación si no hay nombre reconocible.

## 11.9 Resumen vs Intelligence

Actualmente:

**Guardar → Resumen → Ver análisis**

Se planteó ir directo a Intelligence, pero no se confirmó.

Mantener por ahora el patrón consistente.

---

# 12. MI JUGADOR / MIS PARTIDOS / HISTORIAL

## 12.1 Mi jugador

BRAMU necesitará saber cuál de los cuatro jugadores es el usuario.

Concepto:

**Mi jugador** = dato de identidad/configuración, no necesariamente sección principal.

Sirve para:
- filtrar partidos propios;
- distinguir vistos vs jugados;
- stats personales.

No implementado.

## 12.2 Mis partidos

Concepto de sección futura.

Posible definición:

**Historial** = todo lo que BRAMU conoce.

**Mis partidos** = vista filtrada donde el usuario participa.

No implementado.

## 12.3 Historial mixto

Con V14 pueden convivir:
- Completo;
- Por Games;
- partido cargado.

Cada uno debe mostrar solo capacidades respaldadas por sus datos.

No mostrar ceros que en realidad significan “desconocido”.

---

# 13. HOME Y NAVEGACIÓN — HIPÓTESIS, NO DECISIÓN

La navegación actual quedó chica.

Puede que BRAMU esté empezando “al revés”: hoy abre cerca de registrar partido, pero una futura Home de jugador podría responder:

> **“¿Cómo viene mi pádel?”**

Hipótesis de contenido:
- último partido;
- G/P recientes;
- partidos del mes;
- win rate;
- racha;
- pequeños gráficos;
- performance;
- actividad reciente;
- CTA cargar partido;
- acceso a registro en vivo.

**No programar todavía.**

Resolver en Producto/Brainstorming.

---

# 14. GRUPOS DE AMIGOS — FUTURO ÚTIL

Caso real:
- grupo de jueves;
- grupo de domingos;
- 8/10/12 jugadores;
- parejas rotativas;
- partidos semanales.

Valor posible:
- quién jugó con quién;
- resultados recientes;
- “hace tres partidos que te gano”;
- head-to-head;
- mejor pareja;
- compañero frecuente;
- rival frecuente;
- rachas;
- actividad mensual;
- ranking privado.

Hipótesis:

> el grupo privado puede ser una unidad de adopción más útil inicialmente que una red social global.

No implementado.

---

# 15. BRAMU TORNEOS — FUTURO

Idea surgida observando un torneo real.

Problemas:
- espectadores se pierden;
- gente anota score en WhatsApp/notas;
- cuadros/resultados difíciles de seguir.

Potencial:

Organizador:
- torneo;
- jugadores;
- grupos;
- brackets;
- resultados;
- posiciones;
- próximos partidos.

Jugador:
- resultados;
- cuadro;
- quién pasó;
- próximo rival;
- historial del torneo.

Posible valor estratégico: puerta de entrada a muchos jugadores.

**Estado:** FUTURO. No desarrollar ahora.

---

# 16. BRAMU PRO — FUTURO

Posible rama separada.

Registro:
- winners;
- errores no forzados;
- smash;
- bandeja;
- jugador;
- posición;
- stats individuales.

Usuarios:
- coach;
- operador;
- broadcast;
- TV;
- análisis profesional.

Podría ser otra app/producto pago.

Esteban podría servir como tester futuro.

**Estado:** FUTURO.

---

# 17. MARCA — BRAMU VS BRAMU LAB

Observación espontánea:

se usa naturalmente **BRAMU** mucho más que **BRAMU Lab**.

Hipótesis futura:

### BRAMU
marca paraguas.

Posibles ramas:
- BRAMU Intelligence;
- BRAMU Pro;
- BRAMU Torneos;
- BRAMU Lab.

No ejecutar rebranding todavía.

---

# 18. COMPETIDORES / REFERENCIAS ÚTILES

## Playtomic
Referencia principal por adopción en España.

Aspectos:
- perfiles;
- historial;
- nivel;
- ranking;
- partidos externos;
- fecha/hora/lugar;
- reservas;
- clubes.

No copiar su fricción: parte de ella existe porque los resultados pueden afectar nivel/ranking y su ecosistema de reservas.

## Padellog
Referencia por:
- quick score entry;
- historial acumulado;
- ranking privado;
- parejas;
- head-to-head;
- win rate;
- compañero/rival;
- club;
- calendario;
- grupos.

Aprendizaje:

> el valor acumulado de 30 partidos puede ser mucho mayor que el de un partido aislado.

## VIBERO
Referencia conceptual especialmente cercana.

Aspectos públicos observados:
- scoring en vivo;
- carga posterior;
- Home/dashboard;
- Last Match;
- widgets;
- performance;
- grupos;
- rating;
- torneos;
- Apple Watch;
- premium;
- AI Coach;
- clips.

Fue el disparador para pausar Desarrollo y volver a pensar el producto completo.

No copiar literalmente.

## Argentina
Se detectaron proyectos como:
- Padelero;
- Padeler;
- Pader.

Conclusión:

> Argentina no está vacía; está poco consolidada.

---

# 19. METODOLOGÍA DE CONTROL CRUZADO

## Iteración normal
Claude Code:
- implementa;
- tests;
- reporte.

ChatGPT:
- revisa lógica/reporte;
- spot-check de repo/código cuando el cambio es delicado.

Usuario:
- prueba lo que requiere interacción/dispositivo real.

## Cambios sensibles
Revisar más:
- scoring;
- persistencia;
- estadísticas;
- cache;
- migraciones;
- Intelligence estructural.

## Hitos importantes
Puede usarse ChatGPT Work / Cloud Browser para prueba funcional independiente.

Principio:

> no hacer “otra IA leyendo el mismo reporte” por rutina.

El control cruzado sirve si hace algo diferente: inspección, test, intento de romper, navegación funcional o revisión de código.

---

# 20. BASELINE DE TESTS E HITOS TÉCNICOS

- **V13.2:** 239/239.
- **V13.3:** 270/270.
- **V13.4:** 295/295.
- **V14:** 323/323 = 295 previos + 28 nuevos.

Antes de V14, Claude propuso por error una baseline 212/212.

Se verificó:
- HEAD = tag V13.4;
- commit `f03c2ef`;
- 295/295.

Aprendizaje:

> verificar baseline real antes de una ronda grande; no confiar en números recordados.

---

# 21. VERSIONES / COMMITS RELEVANTES

## V13.2
Commit: `a698dcb`  
Tag: `v13.2`

## V13.3
Commit: `4c86355`  
Tag: `v13.3`

## V13.4
Commit: `f03c2ef`  
Tag: `v13.4`

## V14
Commit: `5c46337`  
Tag: `v14`

Repo:  
https://github.com/sebastianvilaa/BRAMUlab

Publicación:  
https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/

---

# 22. DOCUMENTOS / CONSOLIDADOS DE REFERENCIA

Generados/usados en este chat:

- `Consolidado V13.2.md`
- `Consolidado V13.3.md`
- `Consolidado V13.4.md`
- `Consolidado V14.md`
- `Reporte V13.3 - para ChatGPT.md`
- `Reporte V13.4 - para ChatGPT.md`
- `Reporte V14 - para ChatGPT.md`
- `BRAMU - Producto Negocio Brainstorming.md`

## Documento principal para continuar fuera de este chat

**`BRAMU - Producto Negocio Brainstorming.md`**

Fue creado para abrir un nuevo ChatGPT Work dedicado a:
- Producto;
- UX;
- negocio;
- competidores;
- brainstorming;
- arquitectura Jugador/Espectador;
- Home;
- perfiles;
- grupos;
- futuro.

Primera misión allí:

> investigar a fondo VIBERO, Playtomic y Padellog antes de seguir diseñando/pidiendo nuevas pantallas.

---

# 23. OBSOLETOS / REEMPLAZADOS

## OBSOLETO — regla por punto en Completo
V13.3 permitía diferentes sistemas dentro del mismo partido.

Reemplazado por V13.4: **un único sistema por partido**.

## OBSOLETO — Timeline Por Games con puntos ficticios
Reemplazado por Timeline basado en games reales.

## OBSOLETO — último empate como origen de racha
Reemplazado por cálculo del origen real de la racha.

## OBSOLETO — cualquier déficit de un game = remontada
Reemplazado por lógica que contempla orden de saque + breaks/holds.

## OBSOLETO — CAMBIAR fuera de la franja
Reemplazado por acción contextual dentro de la franja.

## OBSOLETO — Wake Lock pendiente
Ya implementado y probado en iPhone/Xiaomi.

## OBSOLETO — V14 como simple formulario técnico “ya resuelto”
La implementación existe, pero la UX/product direction NO está aprobada.

La siguiente decisión debe venir del workspace de Producto.

---

# 24. PENDIENTES ABIERTOS AL CIERRE

## Producto / UX
- definir dirección general tras investigar VIBERO / Playtomic / Padellog;
- definir arquitectura Jugador vs Espectador;
- definir Home futura;
- definir navegación;
- definir Mis partidos;
- definir identidad del usuario / Mi jugador;
- definir grupos;
- replantear la carga manual sin perder consistencia visual;
- definir cómo cargar resultado de forma atractiva y rápida;
- decidir orden final Formato / Sistema / Resultado;
- definir recompensa inmediata de partido manual;
- revisar Resumen vs Intelligence directo;
- decidir cómo comunicar geolocalización sin nombre de club.

## Técnico
- corregir score reglamentario `6-7` en Clásico si sigue ausente;
- revisar todas las orientaciones equivalentes de sets/TB;
- no tocar V13 salvo regresión real;
- no ampliar V14 hasta que Producto cierre dirección.

## Futuro
- perfiles/cuentas;
- backend;
- ranking;
- grupos privados;
- BRAMU Torneos;
- BRAMU Pro;
- posible rebranding BRAMU;
- social;
- monetización;
- reservas/clubes solo si algún día se valida ese camino.

---

# 25. PRINCIPIOS FINALES A PRESERVAR

1. La mejor primera versión no es la que tiene más funciones.
2. La cancha manda: las pruebas reales descubren problemas que los tests no ven.
3. Menos input, más recompensa.
4. No inventar datos para parecer más inteligente.
5. La estética es parte de la utilidad.
6. Los datos acumulados pueden valer más que el análisis de un partido aislado.
7. No competir con Playtomic construyendo reservas/pagos/clubes antes de validar el núcleo.
8. No seguir programando si la idea de producto todavía no está clara.
9. Separar brainstorming de desarrollo evita implementar ideas inmaduras.
10. BRAMU Intelligence debe contar una historia respaldada por datos, no recitar una planilla.
11. El producto puede ser valioso aunque termine funcionando solo para grupos pequeños de amigos.
12. No declarar BRAMU muerto ni validado por entusiasmo personal: probar hipótesis concretas.

---

# 26. ESTADO AL ARCHIVAR ESTE CHAT

### Desarrollo
- V13 cerrada funcionalmente.
- V14 técnicamente implementada como primera prueba de carga manual.
- La UX/product direction de V14 NO está cerrada.
- No continuar con V14.x desde Desarrollo sin redefinir producto/UX.

### Próximo espacio
Usar:

**`BRAMU - Producto Negocio Brainstorming.md`**

en ChatGPT Work.

Objetivo:
- investigar;
- comparar;
- hacer brainstorming;
- cerrar dirección de producto;
- volver luego a Desarrollo con un documento de decisión claro.

### Fuente de verdad para futuro
Prioridad:
1. consolidado vigente más reciente;
2. reporte técnico de la versión;
3. código actual del repo;
4. este archivo como BACKUP histórico de decisiones útiles.

---

# FIN DEL BACKUP
