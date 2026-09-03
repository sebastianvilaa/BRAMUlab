# BRAMU — Consolidado V13.2

## OBJETIVO

Base actual: **V13.1**.

V13.2 es una ronda de cierre sobre cuatro problemas detectados en uso real:

1. la pantalla del iPhone se sigue bloqueando durante un partido;
2. el mecanismo de actualización por pulsación larga del logo no resulta suficientemente cómodo;
3. BRAMU Intelligence Por Games todavía puede sonar demasiado mecánica y repetitiva;
4. Editar jugadores puede dejar temporalmente el marcador visual en 0-0 hasta que ocurre otra interacción.

No agregar un nuevo modo ni abrir nuevas ramas de producto.

---

# 1. CORREGIR — MANTENER LA PANTALLA ACTIVA

## Problema real

Probado en iPhone con V13.1.

Durante un partido en curso:
- BRAMU quedó visible;
- pasaron ~30 segundos;
- la pantalla se oscureció;
- el iPhone terminó bloqueándose.

La implementación actual de Wake Lock no está resolviendo el caso real.

## Comportamiento esperado

- al iniciar un partido, BRAMU debe intentar mantener la pantalla activa;
- aplica a Completo y Por Games;
- mientras BRAMU esté visible y el partido siga activo, la pantalla no debería apagarse por inactividad;
- si BRAMU pasa a background, aceptar que el sistema libere el lock;
- al volver a foreground, volver a solicitarlo automáticamente si el partido sigue activo;
- detectar `release` y readquirir cuando corresponda;
- al finalizar/abandonar partido o volver a Home, liberar el Wake Lock;
- no afectar reloj, persistencia ni estado.

## Diagnóstico técnico obligatorio

Revisar:
- cuándo se solicita el Wake Lock;
- si se solicita demasiado temprano;
- si debe engancharse a la interacción de `Empezar partido`;
- si se pierde con renders/reanudación;
- manejo de `visibilitychange`;
- ciclo de vida de la referencia al Wake Lock;
- navegación interna.

No asumir que por existir código con `navigator.wakeLock` el problema está resuelto.

Si el navegador/dispositivo no lo soporta o falla:
- BRAMU sigue funcionando;
- no romper partido;
- registrar el fallo para debugging;
- no mostrar errores técnicos al usuario.

---

# 2. REEMPLAZAR — ACTUALIZACIÓN AUTOMÁTICA DE VERSIÓN

## Problema

En escritorio existe hard refresh. En iPhone/PWA es fácil quedar viendo una versión vieja por Service Worker/cache.

La pulsación larga del logo funciona como herramienta oculta, pero:
- no siempre es cómoda;
- puede intentar seleccionar el logo;
- el usuario debe recordar el gesto;
- no informa por sí misma si realmente existe una versión nueva.

## Nueva dirección

BRAMU debe detectar automáticamente que hay una versión publicada más nueva.

Cuando exista:

### Hay una nueva versión de BRAMU

`V13.2 está disponible.`

**ACTUALIZAR AHORA**

`Más tarde`

El texto puede ajustarse, pero la intención debe ser esa.

## Fuente de versión

Crear/reutilizar una fuente remota confiable:
- `version.json`;
- `version.txt`;
- o equivalente.

Debe leerse con estrategia fresca:
- `cache: no-store`;
- cache-busting;
- o equivalente compatible con la arquitectura actual.

El archivo usado para detectar versión no puede quedar eternamente atrapado por el cache viejo.

## Cuándo comprobar

Como mínimo:
- al abrir BRAMU;
- al volver a foreground.

Evitar chequear en cada render/click.

## Actualizar ahora

Al confirmar:
1. pedir actualización del Service Worker;
2. eliminar/reemplazar solo caches de código/assets necesarios;
3. cargar la versión publicada;
4. recargar;
5. verificar que cambió la versión ejecutada.

## NO BORRAR

Actualizar NO debe borrar:
- localStorage;
- historial;
- partidos terminados;
- partido en curso;
- jugadores;
- preferencias;
- modo seleccionado;
- datos locales.

Si hay partido en curso:
- no actualizar automáticamente;
- permitir `Más tarde`;
- si el usuario confirma actualizar, preservar y restaurar correctamente el partido.

La pulsación larga del logo puede quedar solo como fallback si no molesta. No invertir tiempo en perfeccionarla.

---

# 3. MEJORAR — BRAMU INTELLIGENCE POR GAMES

## Problema observado

Caso simulado:

**6-3 · 6-2**

La salida fue conceptualmente:

> El primer set llegó 3-3 antes de que Seba y Matu ganaran los últimos 3 games seguidos para cerrar 6-3.

> El segundo set llegó 2-2 antes de que Seba y Matu ganaran los últimos 5 games seguidos para cerrar 6-2.

Los hechos son correctos, pero:
- repite la misma estructura;
- parece una plantilla;
- no relaciona ambos sets;
- desaprovecha el patrón global.

## Detectar patrones repetidos

Si dos sets siguen un patrón parecido, relacionarlos.

Ejemplo conceptual:

> El primero se mantuvo abierto hasta el 3-3, cuando Seba y Matu encadenaron tres games para tomarlo 6-3. El segundo siguió un patrón parecido, aunque la diferencia apareció antes: desde el 2-2 volvieron a despegarse y cerraron con mayor margen.

No usar este texto como plantilla fija.

## Relaciones entre sets

Permitir relaciones respaldadas como:
- “el segundo tuvo un desarrollo parecido”;
- “la diferencia apareció antes”;
- “esta vez la reacción llegó del otro lado”;
- “repitieron el patrón del primero”;
- “a diferencia del set anterior…”;
- “el decisivo volvió a ser cerrado…”.

No introducir psicología.

## Evitar repetición sintáctica

No repetir mecánicamente:
- “El primer set llegó…”
- “El segundo set llegó…”
- “El tercer set llegó…”

ni:
- “antes de que X ganaran los últimos N games seguidos para cerrar…”

Variar de forma determinística según:
- tipo de set;
- secuencia;
- relación con set anterior;
- importancia del momento.

No variar por azar puro.

## Sets corridos

En victorias 2-0 analizar si:
- los dos sets fueron parecidos;
- la diferencia apareció antes/tarde;
- el margen aumentó/disminuyó.

Ejemplo 6-3 · 6-2:
puede detectarse que la separación fue mayor en el segundo y apareció antes, si los datos lo respaldan.

No usar términos psicológicos como “ganaron confianza”, “se soltaron”, etc.

## Longitud

No hacer más texto por obligación.

Un 6-1 · 6-0 puede requerir menos que un 7-6 · 6-7 · 7-5.

Prioridad:
1. cronología;
2. tramo decisivo;
3. relación entre sets;
4. paridad/dominio global;
5. estadísticas como evidencia.

---

# 4. CORREGIR — EDITAR JUGADORES Y 0-0 TRANSITORIO

## Bug real de cancha

En segundo set:

1. abrir `EDITAR JUGADORES`;
2. cambiar/guardar un nombre;
3. al volver al marcador aparece temporalmente `0-0`;
4. parece que el partido reinició;
5. al tocar la pantalla, reaparece el score real.

El estado NO se pierde. Es un bug de render/sincronización.

## Esperado

Al guardar:
- volver inmediatamente al score real;
- mismo set;
- mismos points/games;
- mismo sacador;
- mismo reloj;
- mismos eventos;
- mismos Highlights;
- mismo modo;
- solo cambia el nombre visible.

No requerir interacción extra.

Editar nombre debe modificar el mismo `playerId`, no recrear match/engine/session.

Forzar render inmediato desde el estado real persistido.

---

# 5. NO TOCAR

No implementar ahora:
- Cargar partido ya jugado;
- perfiles;
- usuarios;
- contraseñas;
- backend;
- BRAMU Torneos;
- BRAMU Pro;
- ranking;
- grupos;
- registro solo por sets;
- Compartir;
- overhaul de Evolución;
- nuevo diseño de progresión;
- cambios de scoring.

Mantener lo aprobado de V12.2/V13.1.

---

# 6. PRUEBAS OBLIGATORIAS

## Caso A — Wake Lock
- iniciar partido;
- dejar BRAMU visible más tiempo que el auto-lock;
- la pantalla debe permanecer activa;
- mandar a background y volver;
- debe readquirir Wake Lock;
- finalizar partido;
- debe liberarlo.

Si Claude no puede probar iPhone real, dejar implementación lista y detallar prueba exacta para Sebastián.

## Caso B — actualización disponible
Cliente en versión anterior + servidor con versión nueva.

Esperado:
- popup;
- `Actualizar ahora`;
- `Más tarde`.

## Caso C — actualización sin pérdida
Antes:
- historial;
- preferencias;
- partido en curso.

Después:
- versión nueva;
- historial intacto;
- preferencias intactas;
- partido intacto/recuperable.

## Caso D — Intelligence 6-3 · 6-2
- evitar dos frases idénticas;
- relacionar sets si corresponde;
- no inventar psicología.

## Caso E — Intelligence 6-4 · 4-6 · 7-5
Mantener mejoras V13.1:
- cronología;
- paridad;
- tramo 5-5 → 7-5;
- orientación;
- gramática;
- sin redundancias.

## Caso F — Editar jugador en segundo set
- avanzar partido;
- editar nombre;
- guardar;
- mismo score/set/sacador/reloj inmediatamente;
- nunca 0-0 transitorio.

---

# 7. REGRESIÓN

Correr todos los tests actuales.

Agregar cobertura para:
- nuevas relaciones narrativas;
- render post Editar jugadores;
- chequeo/actualización de versión;
- Wake Lock en lo testeable desde navegador.

No romper:
- Completo;
- Por Games;
- TB normal;
- TB extraordinario;
- edición;
- estadísticas;
- Historial;
- metadata;
- datos parciales.

---

# 8. ENTREGA

Implementar como:

**V13.2**

Al terminar:
1. regresión completa;
2. prueba manual desktop/tablet/celular en lo posible;
3. actualizar versión/cache;
4. commit;
5. push;
6. tag;
7. confirmar GitHub Pages;
8. reporte corto para Sebastián/ChatGPT.

El reporte debe explicar especialmente:
- por qué fallaba Wake Lock en V13.1;
- qué cambió para iPhone/PWA;
- cómo detecta versión nueva;
- cómo preserva datos locales;
- qué cambió en Intelligence;
- causa del 0-0 transitorio;
- tests finales.

---

# PRINCIPIO FINAL

V13.2 no suma nuevas ramas.

Cierra cuatro fricciones reales:
- teléfono que se duerme;
- versiones viejas en iPhone;
- Intelligence que suena a plantilla;
- editar un nombre y ver 0-0.

Después de esta ronda, si estos cuatro puntos quedan resueltos, V13 debe considerarse cerrada para avanzar al siguiente problema de producto.
