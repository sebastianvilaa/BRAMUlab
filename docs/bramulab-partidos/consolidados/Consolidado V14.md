# BRAMU — Consolidado V14
## Cargar partido jugado

### OBJETIVO

Base actual: **V13.4 cerrada funcionalmente**.

V14 abre una etapa nueva del producto.

La hipótesis a validar es:

> **¿Puedo cargar un partido que ya jugué en pocos segundos, guardarlo en mi historial y recibir algo suficientemente interesante a cambio?**

Esta versión debe ser **local**, sin usuarios, contraseñas, backend, perfiles públicos, ranking ni grupos.

La prioridad absoluta es:

**mínima carga + máximo aprovechamiento de los datos disponibles.**

---

# 1. PRINCIPIO DE UX — NO REDISEÑAR BRAMU

IMPORTANTE:

**NO crear una nueva estética ni una nueva lógica visual para esta pantalla.**

BRAMU ya tiene un lenguaje de interfaz funcionando.

La nueva carga manual debe sentirse como una extensión natural de la pantalla actual de creación de partido.

REUTILIZAR todo lo posible de la configuración existente:

- tarjetas de Equipo A / Equipo B;
- VS;
- inputs/pastillas de jugadores;
- colores verde/azul;
- selector de Formato de partido;
- selector de Sistema de puntuación;
- tipografía;
- espaciados;
- botones;
- estados activos;
- responsive actual.

No introducir:

- cancha ilustrada;
- avatares nuevos;
- wizard por pasos;
- nueva navegación experimental;
- formulario visualmente distinto al resto de BRAMU.

Claude puede resolver ajustes de layout necesarios, pero siempre manteniendo la esencia actual.

---

# 2. NUEVA ACCIÓN — CARGAR PARTIDO JUGADO

AGREGAR una entrada clara para:

**CARGAR PARTIDO JUGADO**

Debe ser una acción diferente de:

**EMPEZAR PARTIDO**

No convertirla en un tercer modo de registro.

Completo y Por Games siguen significando modos de registro EN VIVO.

“Cargar partido jugado” es otro flujo.

Para V14, resolver el acceso de forma simple y consistente con la interfaz actual, sin rediseñar toda la navegación.

---

# 3. ORDEN EXACTO DE LA PANTALLA

La pantalla debe seguir este orden:

1. Equipo A / Equipo B
2. Formato de partido
3. Sistema de puntuación
4. Resultado
5. Detalles del partido
6. Guardar partido
7. Cancelar

No mover Fecha/Lugar al comienzo.

La lógica debe sentirse como la creación de partido actual y luego agregar la información histórica.

---

# 4. EQUIPO A / EQUIPO B

REUTILIZAR prácticamente tal cual la pantalla actual.

### Equipo A
- Jugador 1
- Jugador 2

### VS

### Equipo B
- Jugador 3
- Jugador 4

Mantener:

- mismas tarjetas;
- mismos colores;
- misma lógica de edición;
- mismas validaciones básicas;
- mismos componentes existentes.

No pedir información extra del jugador.

En V14 no crear todavía:

- perfiles;
- fotos;
- nivel;
- categoría;
- email;
- cuenta.

---

# 5. FORMATO DE PARTIDO

REUTILIZAR exactamente el componente actual:

### CLÁSICO
Al mejor de 3 sets

### AMERICANO
1 set · Tie break en 5-5

Mantener la misma selección visual actual.

---

# 6. SISTEMA DE PUNTUACIÓN

REUTILIZAR exactamente el componente actual:

- STAR POINT
- PUNTO DE ORO
- CON VENTAJA

Mantener Punto de Oro seleccionado por defecto, igual que en la creación actual.

En un partido histórico este dato sirve como contexto/metadata.

No intentar reconstruir puntos a partir de esta selección.

---

# 7. RESULTADO — NUEVO BLOQUE PRINCIPAL

Después de Sistema de puntuación, AGREGAR:

## RESULTADO

Debe ser simple, directo y compacto.

### CLÁSICO

Permitir cargar como máximo 3 sets.

Ejemplo:

| | SET 1 | SET 2 | SET 3 |
|---|---:|---:|---:|
| Seba / Matu | 6 | 6 | — |
| Gusti / Esteban | 3 | 4 | — |

El tercer set debe poder aparecer/agregarse solamente si corresponde.

No mostrar 5 sets.

No pedir secuencia de games.

No pedir puntos.

No pedir quién sacó.

No pedir resultado interno de Tie Break en V14.

Aceptar scores reglamentarios compatibles con el formato actual, por ejemplo:

- 6-0
- 6-1
- 6-2
- 6-3
- 6-4
- 7-5
- 7-6

Para AMERICANO, respetar las reglas existentes del producto.

Validar que el resultado ingresado pueda representar un partido válido.

No permitir guardar resultados imposibles o sin ganador cuando el partido se carga como terminado.

---

# 8. DETALLES DEL PARTIDO

Después del resultado:

## DETALLES DEL PARTIDO

Solo pedir:

### Fecha
- obligatoria;
- valor inicial: hoy;
- editable.

### Hora
- opcional;
- puede sugerir la hora actual;
- editable;
- si el usuario no quiere especificarla, permitir dejarla vacía.

Fecha y Hora deben convivir en una misma línea cuando el ancho lo permita.

### Lugar
- opcional;
- una línea debajo.

Debe permitir:

- escribir manualmente el nombre del lugar/club;
- usar la ubicación actual del dispositivo mediante la Geolocation API cuando el usuario lo autorice.

IMPORTANTE:
No asumir que podemos obtener automáticamente el nombre comercial del club solamente con GPS.

Si no existe infraestructura de reverse geocoding en el proyecto:
- guardar coordenadas cuando el usuario use ubicación;
- mantener el campo de nombre editable;
- no agregar un servicio/backend nuevo solo para V14.

El fallo o rechazo de geolocalización no debe bloquear la carga.

---

# 9. NO AGREGAR MÁS CAMPOS

V14 NO debe pedir:

- duración;
- notas;
- observaciones;
- primer sacador;
- secuencia de games;
- puntos;
- highlights;
- nivel;
- categoría;
- tipo de partido social/competitivo;
- lado de juego;
- clima;
- superficie;
- ranking;
- confirmación de otros jugadores.

Principio:

> **Queremos que el usuario sienta que completó el 100% del partido, no que dejó medio formulario vacío.**

Menos campos y mayor tasa de completitud.

---

# 10. GUARDAR PARTIDO

CTA principal:

## GUARDAR PARTIDO

Debajo:

**Cancelar**

Al guardar:

1. validar jugadores;
2. validar formato;
3. validar resultado;
4. guardar el partido localmente;
5. marcar el origen del partido como `manual` / `played_match` o equivalente interno;
6. incorporarlo al mismo sistema de Historial;
7. generar Resumen;
8. generar BRAMU Intelligence básica;
9. llevar al usuario a la vista de resultado/resumen correspondiente.

No crear una base de historial separada.

---

# 11. HISTORIAL

Los partidos cargados manualmente deben convivir con los registrados en vivo.

Internamente debe quedar claro el nivel/origen de datos.

Ejemplos conceptuales:

- `complete`
- `games`
- `manual`

No mezclar capacidades inexistentes.

Un partido manual NO debe mostrar módulos que impliquen datos nunca registrados.

---

# 12. BRAMU INTELLIGENCE — NIVEL BÁSICO

Un partido manual tiene menos datos, pero BRAMU Intelligence no debe desaparecer.

Debe utilizar únicamente hechos derivados del resultado por sets.

Puede saber:

- ganador;
- resultado final;
- sets ganados/perdidos;
- games totales por pareja;
- diferencia total de games;
- victoria en sets corridos;
- partido a tres sets;
- remontada A NIVEL DE SETS;
- pareja que perdió el primero y ganó los siguientes;
- set más ajustado;
- set con mayor margen;
- si el decisivo fue cerrado;
- contexto de formato/sistema si se cargó.

Ejemplo:

Resultado:

**4-6 · 6-3 · 7-5**

BRAMU puede decir conceptualmente:

> Seba y Matu tuvieron que dar vuelta el partido después de perder el primer set 4-6. Igualaron con un 6-3 y terminaron llevándose un tercer set mucho más cerrado, 7-5.

Eso es válido.

---

# 13. BRAMU INTELLIGENCE — LO QUE NO PUEDE DECIR

NO inferir en un partido manual:

- breaks;
- holds;
- Break Points;
- Match Points;
- rachas de games dentro del set;
- remontadas dentro de un set;
- máxima ventaja durante el set;
- quién comenzó mejor dentro de un parcial;
- cambio de dominio;
- servicio;
- puntos consecutivos;
- presión;
- momentos decisivos internos;
- Evolución.

Si el dato no fue registrado, no existe.

---

# 14. RESUMEN DE PARTIDO MANUAL

Mantener el lenguaje visual actual del Resumen.

Mostrar:

- ganadores;
- jugadores/parejas;
- resultado por sets;
- fecha;
- hora si existe;
- lugar si existe;
- formato;
- sistema de puntuación;
- games totales si aporta;
- acceso a BRAMU Intelligence.

No mostrar estadísticas vacías.

No mostrar métricas con 0 que en realidad significan “dato desconocido”.

---

# 15. EVOLUCIÓN

NO generar gráfico de Evolución para partidos manuales.

No conocemos la trayectoria interna del marcador.

Ocultar el módulo completamente.

No crear una línea ficticia a partir del resultado final de cada set.

---

# 16. MODELO DE DATOS

Diseñar el registro manual para que más adelante pueda integrarse con:

- Mis partidos;
- jugador local;
- perfiles;
- grupos;
- ranking;
- head-to-head;
- compañeros frecuentes;
- rivales frecuentes;
- clubes;
- torneos.

Pero NO implementar todavía esas funciones.

Guardar desde V14 de forma estructurada:

- IDs internos de jugadores;
- parejas;
- fecha;
- hora opcional;
- lugar/nombre opcional;
- coordenadas opcionales;
- formato;
- sistema;
- sets;
- ganador;
- origen/nivel de registro.

No depender solo de strings visuales.

---

# 17. MICRO-POLISH PENDIENTE DE V13

Sin convertirlo en objetivo de V14:

CORREGIR el centrado de la franja contextual de scoring.

Cuando aparece:

`PUNTO DE ORO    CAMBIAR`

el texto `PUNTO DE ORO` debe permanecer centrado respecto del ancho total de la cancha.

`CAMBIAR` queda anclado a la derecha y no desplaza visualmente el título central.

No tocar la lógica ya aprobada de V13.4.

---

# 18. NO TOCAR EN V14

No implementar todavía:

- usuarios;
- login;
- backend;
- sincronización cloud;
- ranking;
- ELO;
- grupos;
- chat;
- reservas;
- BRAMU Torneos;
- BRAMU Pro;
- matchmaking;
- pagos;
- perfiles públicos;
- validación por otros jugadores;
- “Mi jugador”;
- “Mis partidos” como nueva navegación definitiva.

V14 debe validar primero la carga local de partidos jugados.

---

# 19. PRUEBAS OBLIGATORIAS

## A — Clásico 2 sets

Seba / Matu vs Gusti / Esteban

**6-3 · 6-4**

Validar:
- guardado;
- ganador;
- historial;
- resumen;
- Intelligence básica;
- sin Evolución;
- sin stats inventadas.

## B — Clásico 3 sets con remontada

**4-6 · 6-3 · 7-5**

Validar:
- ganador correcto;
- detectar remontada a nivel de sets;
- Intelligence puede decir que perdió el primero y ganó los siguientes;
- no inventar remontada interna.

## C — Tie Break reglamentario

**7-6 · 6-4**

Validar:
- resultado válido;
- no pedir score interno del TB;
- no inventarlo en Intelligence.

## D — Americano

Registrar resultado compatible con reglas actuales.

Validar:
- un solo set;
- ganador correcto;
- historial y resumen correctos.

## E — Hora vacía

Guardar partido con:
- fecha;
- sin hora;
- sin lugar.

Debe funcionar.

## F — Geolocalización rechazada

Rechazar permiso.

Debe:
- seguir funcionando;
- permitir escribir lugar manualmente;
- no mostrar error técnico.

## G — Historial mixto

Tener:
- un partido Completo;
- uno Por Games;
- uno Manual.

Validar:
- todos conviven;
- cada uno abre con sus capacidades reales;
- manual no muestra datos que nunca registró.

---

# 20. REGRESIÓN

Mantener verdes todos los tests V13.4.

No degradar:

- Completo;
- Por Games;
- scoring;
- cambio de sistema;
- Wake Lock;
- Timeline;
- Intelligence existente;
- Historial existente.

Agregar tests específicos de V14.

---

# 21. ENTREGA

Implementar como:

## V14

Al terminar:

1. correr regresión completa;
2. probar manualmente desktop/tablet/mobile;
3. cargar al menos los casos A, B y D;
4. revisar Historial mixto;
5. commit;
6. push;
7. tag `v14`;
8. publicar en GitHub Pages;
9. entregar reporte para Sebastián/ChatGPT.

En el reporte explicar:

- qué componentes actuales se reutilizaron;
- cómo se valida el resultado;
- cómo se guarda el origen manual;
- qué datos utiliza Intelligence básica;
- qué módulos se ocultan por falta de evidencia;
- cómo quedó geolocalización;
- tests finales.

---

# PRINCIPIO FINAL

V14 no tiene que impresionar por cantidad de campos.

Tiene que lograr que registrar un partido ya jugado se sienta:

**rápido, completo y útil.**

La experiencia debe transmitir:

> **“Cargué muy poco, pero BRAMU ya empezó a construir mi historia.”**
