# Reporte BRAMU Lab V13.4 — para pasar a ChatGPT

Reporte corto, como pide el Consolidado V13.4 (hotfix de cierre sobre V13.3).

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/
**Commit:** [f03c2ef](https://github.com/sebastianvilaa/BRAMUlab/commit/f03c2ef)
**Tag:** `v13.4`

---

## Por qué se reemplazó el modelo "regla por punto"

La prueba manual de V13.3 encontró que se podía terminar un mismo partido con games
jugados bajo Punto de Oro, otros bajo Star Point y otros bajo Con Ventaja — un partido
"híbrido" que no debería existir. Se reemplazó por completo esa lógica: ahora el sistema
de puntuación es **una única propiedad del partido**, no algo que cada punto recuerda por
separado.

## Cómo decide si un cambio es seguro

Antes de reproducir el game en curso bajo el sistema nuevo, se fija si en algún punto
anterior de ESE mismo game el sistema nuevo ya lo habría dado por terminado. Si nunca lo
hubiera cerrado antes, el cambio es seguro y las opciones incompatibles quedan
deshabilitadas en el selector (nunca ocultas sin explicación: se ven pero no se pueden
tocar).

## Cuándo se bloquea definitivamente

En cuanto se cierra el primer game que llegó a 40-40 (el primer game donde el sistema
realmente decidió algo), el sistema queda fijo para el resto del partido — ni desde el
botón "CAMBIAR" ni desde el menú ☰. Un game ganado 4-0/4-1/4-2 nunca cuenta como
"sensible": ahí los tres sistemas se comportan igual.

## Cómo evita estadísticas híbridas

Al ser un único sistema por partido, un partido con Punto de Oro nunca puede tener Star
Points registrados (y viceversa) — no hizo falta agregar ninguna validación extra para
esto: es automático, por cómo se cuentan los puntos.

## Cómo quedó "CAMBIAR"

Se movió a vivir DENTRO de la franja de arriba, junto al texto central ("PUNTO DE
ORO — CAMBIAR", "DEUCE — CAMBIAR"), en vez de aparecer suelto debajo de los botones
Deshacer/Ajustar/Highlight/Editar. También se agregó que la franja muestre "VENTAJA" como
texto (antes se quedaba vacía en ese momento puntual), para que "CAMBIAR" tenga dónde
aparecer en cualquier instante de la zona de deuce. Fuera de esa zona, el cambio sigue
disponible desde el menú ☰ — salvo que ya esté bloqueado.

## Otros dos ajustes de esta ronda

- **Popup de "hay una nueva versión":** ahora ACTUALIZAR queda arriba y MÁS TARDE abajo
  (antes iban lado a lado) — cambio solo visual.
- **BRAMU Intelligence (Por Games):** se corrigió un caso donde una desventaja de 1 game
  causada simplemente por el orden de saque (nunca un quiebre real) se narraba como
  "reacción"/"remontada". Ahora se compara con quién sacaba cada game para no confundir
  bookkeeping de rotación con una racha real.
- **Lenguaje de porcentajes:** un 5 de 10 (50%) ya no se puede describir como "casi
  todos" — se armó una escala de lenguaje acorde al % real, y si el % propio no alcanza
  para hablar de dominio, el comentario directamente se omite.

## Tests finales

**295/295 verde** (270 previos + 25 nuevos/reescritos de esta ronda). Se reemplazaron los
3 casos de V13.3 que probaban el modelo viejo por 3 nuevos sobre el modelo actual (partido
híbrido imposible, corrección segura en 40-40, compatibilidad Star Point ↔ Con Ventaja), y
se sumaron casos para las dos correcciones narrativas y la escala de lenguaje de saque.
Además se corrigió un test de una ronda anterior que —sin que nadie lo notara— dependía
del mismo bug de orden de saque que esta ronda vino a arreglar.

Verificación manual completa en navegador: cambio de sistema en vivo (Completo), bloqueo
tras cerrar el game sensible, opciones deshabilitadas en el selector, "CAMBIAR" dentro de
la franja en Punto de Oro/Deuce/Ventaja, Por Games sigue sin restricciones, y el nuevo
layout del popup de actualización.
