# Cargar partido

**Rol:** fuente maestra vigente del flujo **Cargar partido** (cargar un partido YA jugado; no hay scoring en vivo en BRAMUlab).
**Vigente desde:** V04.24 (Issue #24). Solo documenta las decisiones actuales.

---

## 1. Armado inicial (sin cambios)

Header `CARGAR PARTIDO` + subtítulo `Formato · Puntuación` (ej. “Clásico · Punto de Oro”); tarjeta Formato/Puntuación; línea Fecha/Hora/Lugar; Equipo A, VS, Equipo B con selección de compañero y rivales. Aprobado conceptualmente; no se rediseña.

## 2. Selección de jugadores

Mismas hojas de siempre (recientes, búsqueda, alta sin cuenta). Al completar el roster sin score cargado se abre el teclado del Set 1.

## 3. Formato y puntuación (no se toca)

- Formato: Clásico, Americano. Sistema: Star Point, Punto de Oro, Con ventaja.
- Default: Clásico + Punto de Oro.
- La limitación vigente sobre editar el formato después de guardado no cambia.

## 4. Modo resultado (V04.24)

Problema: en iPhone el teclado numérico tapaba el score que se estaba escribiendo.

Mientras `manualKeypadOpen === true` la vista `#view-manual-load` pasa a `is-score-entry` (derivado en un único punto, `syncManualScoreEntryChrome`):

- se ocultan las tarjetas de Formato/Fecha y Equipo A / VS / Equipo B;
- se mantiene el header y el subtítulo;
- aparece el **matchup compacto** `[ Seba / Matu ] VS [ Diego / Esteban ]` — A con acento verde BRAMU, B con celeste/azul, nombres blancos, truncados con elipsis;
- **fichas de sets** (SET 1 `6–3`, SET 2 `2–6`, SET 3 `— —`): confirmados tocables (`reopenManualSet`), el actual resaltado con su valor en vivo, pendientes apagados;
- **resultado del set actual** siempre arriba del teclado: lado A verde, lado B celeste; el lado editable refuerza borde/glow sin unificar colores;
- teclado BRAMU intacto (1–9, Borrar, 0, Listo) con la misma lógica (`computeValidNextDigits`, teclas deshabilitadas, avance A→B, autoconfirmación del set, auto-apertura del siguiente, reapertura/edición, poda del tercer set, Americano). No hay otra validación de score;
- la **bottom nav se oculta** con el teclado abierto y se restaura al cerrarlo, al volver o al salir de la vista por cualquier camino (`showView` re-sincroniza); `positionManualContinueBar` solo suma la nav si está visible.

Al quedar el partido decidido: se cierra el teclado, se sale del modo compacto, se muestran los sets completos, “Resultado válido” y **CONTINUAR**, y se restaura la nav. No se autoabre Confirmar partido (pausa deliberada).

## 5. Fecha, Hora y Lugar (V04.24)

- Fecha y Hora comparten un solo shell (misma caja, altura y divisor).
- **Hora = `<input type="time">` nativo** (selector del dispositivo, sin entradas inválidas). Valor interno siempre `HH:MM` 24 h o vacío (hora desconocida; se puede borrar con ×). Se eliminó la máscara manual. `buildPlayedAtFromLocalFields` sigue defendiendo ante datos inválidos.
- **Lugar + “Usar ubicación”** en el mismo renglón; Lugar sigue opcional (60 caracteres); la geolocalización existente no cambia (sin permisos nuevos).
- La misma hoja se reutiliza para editar desde Confirmar partido.

## 6. Cierre / confirmación

CONTINUAR abre Confirmar partido; guardar sigue por el pipeline vigente (create-or-attach, validación compartida, correcciones). Sin cambios de backend ni de Nivel/Ranking.
