# BRAMU — Consolidado V13.4

## OBJETIVO

Base actual: **V13.3**.

Esta ronda es un **hotfix de cierre**. La prueba manual de V13.3 encontró que la implementación del cambio de sistema de puntuación en vivo tomó una dirección que no sirve para el producto:

> permitir que cada punto conserve una regla distinta hace posible terminar un mismo partido mezclando Punto de Oro, Star Point y Con Ventaja.

Eso genera una situación que BRAMU no debe permitir y además vuelve ambiguas/inconsistentes las estadísticas y la metadata.

V13.4 debe **REEMPLAZAR esa lógica**, no agregar parches encima.

Además incluye:
- ubicación visual de `CAMBIAR`;
- layout del popup de actualización;
- corrección narrativa cuando una desventaja de un game se explica por el orden de saque;
- corrección semántica de porcentajes de saque.

---

# 1. REEMPLAZAR — SISTEMA DE PUNTUACIÓN EN MODO COMPLETO

## Decisión de producto

En **Modo Completo**, el sistema de puntuación es una propiedad DEL PARTIDO.

Un partido no puede terminar registrado como mezcla de:
- Punto de Oro;
- Star Point;
- Con Ventaja.

La posibilidad de corregir el sistema existe solo para resolver un error de configuración mientras todavía sea deportivamente seguro.

NO es una función para cambiar las reglas hacia adelante.

---

# 2. ELIMINAR COMO COMPORTAMIENTO DE PRODUCTO — REGLA POR PUNTO

V13.3 permitió guardar la regla vigente en cada punto y cambiar indefinidamente.

**REEMPLAZAR esta decisión.**

No permitir:
- games con Punto de Oro;
- luego games con Star Point;
- luego games con Ventaja;
- y metadata final mostrando solamente el último sistema elegido.

La fuente de verdad para un partido válido debe ser:

**match.scoringSystem**

Si internamente queda información histórica por evento por compatibilidad/debug, no usarla para habilitar partidos híbridos nuevos.

---

# 3. REGLA CORRECTA — SE PUEDE CORREGIR HASTA QUE SEA IRREVERSIBLE

Principio:

> **El sistema se puede cambiar mientras los puntos ya registrados sean compatibles con el sistema nuevo y todavía no haya quedado cerrado un game cuya resolución dependa de la regla elegida.**

Una vez que se cierra el primer game en el que el sistema realmente incidió:

**BLOQUEAR EL SISTEMA PARA EL RESTO DEL PARTIDO.**

No permitir más cambios desde menú ni desde la barra.

---

# 4. ANTES DEL PRIMER 40-40

Si el partido todavía no llegó nunca a una situación de 40-40:

- el sistema puede cambiarse desde `☰ → SISTEMA DE PUNTUACIÓN`;
- el score queda intacto;
- los eventos previos son compatibles porque 0/15/30/40 evolucionan igual en los tres sistemas.

Ejemplo:

Se inicia con Punto de Oro.
Se juegan varios games, ninguno llega 40-40.
El usuario descubre que juegan Star Point.

Puede cambiar a Star Point.

Los games anteriores siguen siendo válidos y el partido pasa a tener **STAR POINT** como sistema único.

---

# 5. PRIMER GAME EN ZONA DE DEUCE

Cuando aparece el primer estado donde la regla importa:
- 40-40 / Punto de Oro;
- Deuce;
- Ventaja;
- Deuce 2;
- Star Point;

el sistema todavía puede corregirse **solo si el estado actual es compatible con el sistema destino**.

## Método recomendado

Para decidir si una opción es válida:

1. tomar los puntos/eventos reales del game actual;
2. reproducirlos con el sistema destino;
3. comprobar que:
   - el game no habría terminado antes;
   - el score actual resultante es compatible;
   - no cambia un game ya cerrado.

Si la secuencia no es compatible:

**esa opción no se puede seleccionar.**

---

# 6. EJEMPLOS DE COMPATIBILIDAD

## 40-40
Los tres sistemas todavía son compatibles.

## Punto desde 40-40 bajo Gold
Ese punto cierra el game.
Desde ese momento: **sistema bloqueado**.

## Star Point / Con Ventaja
Mientras la secuencia observada sea válida en ambos sistemas, permitir corregir Star ↔ Ventaja.

Cuando una alternativa habría cerrado el game antes o produzca otro estado, deshabilitarla.

## Cierre del game sensible
Una vez cerrado el primer game cuya secuencia pasó por zona de divergencia:
**bloquear sistema para el resto del partido.**

---

# 7. MENÚ ☰

## Completo
Antes del bloqueo:
`☰ → SISTEMA DE PUNTUACIÓN`

Después del bloqueo:
NO permitir cambiar.

Puede ocultarse la acción o mostrarse el sistema actual como información no editable.

## Por Games
NO cambiar lo aprobado.

En Por Games el sistema es metadata.
Puede cambiarse en cualquier momento desde:
`☰ → SISTEMA DE PUNTUACIÓN`

No altera score, games, stats ni Timeline.

---

# 8. CORREGIR — POSICIÓN DE `CAMBIAR`

## Bug visual real

En V13.3 `CAMBIAR SISTEMA` apareció debajo de:
`DESHACER / AJUSTAR / HIGHLIGHT / EDITAR`.

No era la ubicación pedida.

## Ubicación correcta

Debe aparecer **DENTRO DE LA FRANJA CONTEXTUAL**, junto al texto central.

Ejemplo:

**PUNTO DE ORO     CAMBIAR**

o:

**DEUCE     CAMBIAR**

Etiqueta:
**CAMBIAR**

No `CAMBIAR SISTEMA`.

En estados normales no aparece ahí; el cambio sigue disponible desde ☰ mientras no esté bloqueado.

---

# 9. POPUP DE SISTEMA

Al tocar `CAMBIAR` o `☰ → SISTEMA DE PUNTUACIÓN`:

reutilizar el selector con:
- STAR POINT;
- PUNTO DE ORO;
- CON VENTAJA.

Las opciones incompatibles con la secuencia actual deben quedar deshabilitadas/no seleccionables.

No resetear puntos.
No inventar puntos.
No reabrir ni cerrar games artificialmente.

---

# 10. CORREGIR — ESTADÍSTICAS Y METADATA

La prueba manual V13.3 permitió mezclar los tres sistemas y al final:
- metadata mostraba solo el último sistema;
- las estadísticas reportaban Puntos de Oro de manera no confiable;
- un mismo partido contenía reglas distintas.

Para partidos válidos desde V13.4:
- existe un único `match.scoringSystem`;
- cualquier corrección anterior al bloqueo corrige el sistema DEL PARTIDO;
- al recalcular estado/stats se usa ese sistema único;
- no mezclar Golden Points / Star Points de reglas sucesivas.

Invariantes:

### Punto de Oro
- `goldenPoints` puede ser > 0;
- `starPoints` debe ser 0.

### Star Point
- `starPoints` puede ser > 0;
- `goldenPoints` debe ser 0.

### Con Ventaja
- Golden Points = 0;
- Star Points = 0.

Datos legacy V13.3:
- no borrar;
- manejar sin crash;
- no dedicar migración compleja.

---

# 11. TEST CRÍTICO — IMPOSIBLE CREAR PARTIDO HÍBRIDO

1. iniciar Completo con Punto de Oro;
2. jugar games normales sin 40-40;
3. cambiar a Star Point;
4. llegar a un game con Deuce;
5. cerrar ese game bajo Star Point;
6. intentar cambiar a Punto de Oro o Ventaja.

Esperado:
**NO SE PUEDE.**

Metadata final:
**STAR POINT**

Stats:
- Golden Points = 0;
- Star Points según hechos reales.

---

# 12. TEST — CORRECCIÓN EN 40-40

1. iniciar Punto de Oro;
2. llegar 40-40;
3. `CAMBIAR → CON VENTAJA`;
4. score sigue 40-40/Deuce;
5. jugar un punto;
6. debe quedar VENTAJA, no cerrar game;
7. finalizar el game;
8. sistema queda bloqueado en Con Ventaja.

---

# 13. TEST — STAR ↔ VENTAJA MIENTRAS SON COMPATIBLES

Crear secuencia:
- Deuce;
- Ventaja;
- vuelta a Deuce.

Cambiar Star ↔ Ventaja mientras ambas interpretaciones sigan siendo válidas.

Esperado:
- score intacto;
- sin eventos inventados;
- sin reescribir game cerrado.

Cuando una alternativa ya no sea compatible:
- debe quedar deshabilitada.

---

# 14. CORREGIR — POPUP DE ACTUALIZACIÓN (SOLO VISUAL)

La detección automática funciona.

No tocar lógica.

Cambiar layout:

**ACTUALIZAR**

**MÁS TARDE**

Uno debajo del otro.
Primero acción principal.
Después secundaria.
Mantener estilo actual.

---

# 15. AJUSTE NARRATIVO — POR GAMES, NO CONFUNDIR ORDEN DE SAQUE CON REMONTADA

Caso real:

- Gusti/Esteban comienzan sacando;
- holds normales hasta 4-4;
- Seba/Matu quiebran para 5-4;
- sostienen para 6-4.

V13.3 narró:
> “Abajo 3-4... reaccionaron...”

Eso es engañoso: el 3-4 era producto del orden de saque, no de un break.

Regla:

**una desventaja de un game no se clasifica automáticamente como remontada/reacción si se explica por el orden natural del servicio y no hubo ruptura.**

Usar:
- quién comenzó sacando;
- holds;
- breaks;
- score.

Lectura conceptual correcta:
> El set se mantuvo parejo hasta 4-4. Seba y Matu consiguieron el quiebre para 5-4 y luego sostuvieron el saque para cerrar 6-4.

No usar como plantilla fija.

---

# 16. AJUSTE NARRATIVO — SET QUE FUERZA EL DECISIVO

Si una pareja:
- pierde Set 1;
- gana Set 2;
- deja el partido 1-1;

Intelligence debe poder cerrar ese párrafo con:
- “igualaron el partido”;
- “forzaron el tercer set”;
- “llevaron el encuentro al decisivo”;

según variedad determinística.

Solo cuando sea factual.

---

# 17. CORREGIR — LENGUAJE DE PORCENTAJE DE SAQUE

En una prueba de Completo apareció:

> “se hicieron fuertes con el saque y sostuvieron casi todos sus games, 5 de 10.”

**5/10 = 50%.**

No es “casi todos”.

Regla obligatoria:

**5/10 jamás puede narrarse como “casi todos”, “se hicieron fuertes con el saque” ni equivalente.**

Usar una escala semántica consistente con el porcentaje real o directamente omitir el comentario si no aporta.

Agregar test.

---

# 18. NO TOCAR

No abrir:
- Cargar partido ya jugado;
- perfiles;
- usuarios;
- backend;
- BRAMU Torneos;
- BRAMU Pro;
- ranking;
- compartir;
- rediseño general;
- numeración global/local del Timeline;
- Wake Lock;
- engine Por Games;
- TB;
- actualización automática salvo layout visual.

---

# 19. REGRESIÓN

Correr suite completa.

Agregar tests para:
- sistema único por partido Completo;
- bloqueo tras primer game sensible cerrado;
- cambio seguro antes de divergencia;
- compatibilidad Star/Ventaja;
- imposibilidad de volver a Gold luego del cierre sensible;
- Golden/Star Points consistentes;
- metadata consistente;
- CAMBIAR dentro de franja contextual;
- Por Games mantiene metadata editable;
- 3-4 por orden de saque no se trata como remontada;
- 5/10 no se describe como “casi todos”.

---

# 20. ENTREGA

Implementar como:

**V13.4**

Al terminar:
1. regresión completa;
2. prueba manual del cambio de sistema;
3. intentar mezclar los tres sistemas y confirmar que ya no se puede;
4. revisar estadísticas finales;
5. commit;
6. push;
7. tag `v13.4`;
8. publicar;
9. reporte corto para Sebastián/ChatGPT.

El reporte debe explicar:
- por qué se reemplazó el modelo “regla por punto”;
- cómo decide si un cambio es seguro;
- cuándo se bloquea definitivamente;
- cómo evita stats híbridas;
- cómo quedó `CAMBIAR`;
- tests finales.

---

# PRINCIPIO FINAL

En Modo Completo:

> **BRAMU puede ayudarte a corregir qué sistema estaba usando el partido. No puede convertir el partido en tres sistemas diferentes.**

La corrección existe para arreglar un dato equivocado.

No para cambiar las reglas deportivas durante el encuentro.
