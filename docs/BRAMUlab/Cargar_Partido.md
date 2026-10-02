# Cargar partido

**Rol:** fuente maestra vigente del flujo **Cargar partido** (cargar un partido YA jugado; no hay scoring en vivo en BRAMUlab).  
**Vigente desde:** V04.24; dirección UX V04.26 cerrada por QA humano el 02/10/2026 (Issue #24). Solo documenta las decisiones actuales.

---

## 1. Estructura general — dos instancias

`Cargar partido` se organiza en **dos instancias consecutivas dentro del mismo flujo**:

1. **Jugadores** — definir metadata y los cuatro participantes.
2. **Resultado** — cargar sets sobre una representación tipo resumen y confirmar.

No debe sentirse como una app de marcador separada. La composición reutiliza componentes y lenguaje visual ya existentes en BRAMUlab.

La transición es explícita:
- mientras falten jugadores, `CARGAR RESULTADO` permanece visible pero deshabilitado;
- con los cuatro jugadores completos, se habilita;
- al entrar a Resultado no se abre automáticamente un paso intermedio de confirmación.

---

## 2. Instancia Jugadores

### 2.1 Metadata superior

Se conserva la solución aprobada:

- header `CARGAR PARTIDO` + subtítulo `Formato · Puntuación`;
- Formato/Puntuación;
- Fecha/Hora/Lugar;
- mismas acciones para modificar;
- Fecha/Hora/Lugar no se rediseñan en esta ronda.

### 2.2 Equipo A / VS / Equipo B

Debajo de la metadata:

- **Equipo A**;
- separador **VS** existente;
- **Equipo B**.

Cada equipo vive dentro de una **tarjeta grande BRAMU**, tomando el lenguaje visual de tarjetas existentes como Último partido:
- fondo oscuro;
- borde completo;
- Equipo A con acento/borde verde;
- Equipo B con acento/borde celeste;
- no usar grandes fondos degradados nuevos como lenguaje principal.

Dentro de cada tarjeta hay dos filas de jugador.

Cada jugador reutiliza la presentación canónica existente de BRAMU:
- foto/avatar o iniciales reales;
- nombre;
- `@usuario` cuando existe;
- Nivel BRAMU real a la derecha, respetando `CALIBRANDO`/consolidado;
- nunca inventar username, Nivel o foto.

El jugador propio ya aparece completo. Los huecos de compañero/rivales se muestran como filas de acción claras (`+ Agregar compañero`, `+ Agregar rival` o copy equivalente) y al tocarlas abren las hojas de selección existentes (recientes, búsqueda, alta sin cuenta).

La selección de jugadores mantiene los contratos vigentes de identidad. No se modifica backend.

### 2.3 CTA

`CARGAR RESULTADO`:
- se muestra desde el inicio;
- usa el botón primario global de BRAMU;
- está **disabled** mientras falte cualquiera de los cuatro jugadores;
- se habilita únicamente con roster completo;
- al tocarlo pasa a la instancia Resultado.

No autoavanzar al completar el cuarto jugador.

---

## 3. Formato y puntuación

- Formato: Clásico, Americano.
- Sistema: Star Point, Punto de Oro, Con ventaja.
- Default: Clásico + Punto de Oro.
- La limitación vigente sobre editar formato después de guardado no cambia.
- Toda validación de score sigue usando el motor actual; no crear reglas paralelas.

---

## 4. Instancia Resultado — el resumen es el formulario

Al entrar a Resultado:

- la metadata superior del partido permanece visible;
- desaparece la UI de selección de jugadores;
- aparece una composición basada en el **resultado/resumen canónico de BRAMU**;
- no debe existir una tarjeta adicional `RESULTADO DEL SET X`.

### 4.1 Composición

Dos equipos, uno arriba del otro:

- nombres de los dos integrantes a la izquierda;
- pueden ocupar dos renglones (un jugador por línea) para ganar altura y legibilidad;
- columnas de Set 1 / Set 2 / Set 3 a la derecha;
- los valores de los sets son **grandes y protagonistas**;
- cada columna mantiene alineación vertical exacta entre Equipo A y Equipo B;
- verde identifica A y celeste identifica B sin crear un lenguaje visual ajeno al resto de la app.

El componente debe derivar del lenguaje ya usado por `.result-card` / resumen de partido, adaptado a edición. No duplicar un segundo diseño de score.

### 4.2 Carga del set — selector tipo wheel/carrusel

V04.26 reemplaza el teclado numérico como interacción principal por un **selector vertical tipo wheel/carrusel**, inspirado en el selector horario del dispositivo pero integrado visualmente a BRAMU.

Al tocar una columna/set:
- ese set pasa a estado editable;
- se muestran dos selectores verticales, uno para **Equipo A** y otro para **Equipo B**;
- los valores seleccionados se reflejan **en vivo** en la propia columna del resumen;
- el set completo es la unidad de edición;
- el usuario puede corregir ambos lados antes de cerrar la edición.

Implementación:
- usar un control web móvil robusto (wheel/scroll-snap o equivalente) que funcione bien en iPhone/PWA;
- no hardcodear un universo de scores desconectado del formato;
- derivar valores/opciones válidas de las validaciones/motor de score existentes;
- si seleccionar un valor restringe válidamente el otro lado, reutilizar esa lógica existente;
- no crear una segunda lógica deportiva.

Si durante implementación aparece una limitación real de iOS/accesibilidad que vuelva este control frágil, marcarla como **DECISIÓN ABIERTA** y continuar todo lo demás; no reemplazar silenciosamente por otra UX.

### 4.3 Edición de sets previos

La corrección V04.25 se conserva conceptualmente:

- tocar un set confirmado lo reabre;
- la unidad de edición es el **set completo**;
- cambiar un lado no cierra ni hace rebotar la pantalla;
- después de completar el set se recalcula el estado del partido;
- se conservan las reglas vigentes de poda del tercer set cuando deja de ser necesario.

### 4.4 Volver / cambiar jugadores

En esta instancia, volver al paso anterior significa **cambiar jugadores**.

Debe existir una acción clara de retorno (`Cambiar jugadores` o equivalente) que:
- vuelve a la instancia Jugadores;
- conserva lo ya seleccionado;
- permite corregir compañero/rivales;
- no guarda ni descarta silenciosamente información.

Si cambiar jugadores invalida el score cargado, usar una confirmación explícita antes de descartar/reiniciar lo necesario; no hacerlo en silencio.

---

## 5. Estado válido antes de confirmar

Mientras se cargan los sets, la misma pantalla muestra progresivamente el resultado.

Cuando el partido ya está decidido y el score es válido, mostrar en esa misma instancia:

- **ganadores**;
- **sets ganados** por equipo;
- **games ganados** por equipo;
- CTA **CONFIRMAR PARTIDO** habilitado.

Mientras el partido no sea válido/completo:
- el CTA permanece visible pero disabled;
- no inventar mensajes de error si basta con mostrar que falta completar un set.

Esta información usa cálculos que BRAMU ya tiene; no crear estadísticas nuevas.

---

## 6. Confirmación y post-partido

Se **elimina el paso intermedio** de “Confirmar partido” que repetía un resumen antes del guardado.

Nuevo recorrido:

`Jugadores → Cargar resultado → Confirmar partido → Guardado → Resumen oficial`

Al tocar `CONFIRMAR PARTIDO`:

1. ejecutar el pipeline vigente de guardado/create-or-attach;
2. mostrar el feedback/modal de **partido guardado** existente, incluyendo el estado de validación/espera que corresponda;
3. abrir después el **Resumen oficial del partido existente**.

El Resumen oficial post-partido **NO SE REDISEÑA en esta ronda**. Debe conservar tal cual:
- BRAMU Intelligence;
- nota privada;
- estado/validación de rivales;
- acciones y contenido ya existentes.

Esta ronda toca únicamente la carga previa al guardado.

---

## 7. Fecha, Hora y Lugar

Solución V04.24 aprobada y **NO TOCAR**:

- Fecha y Hora comparten shell;
- Hora usa `<input type="time">` nativo;
- Lugar + `Usar ubicación` comparten fila;
- Lugar sigue opcional;
- no agregar permisos ni lógica de geolocalización nueva.

---

## 8. Límites de alcance V04.26

**AGREGAR / REEMPLAZAR**
- nueva composición de Equipo A / B en la instancia Jugadores;
- CTA `CARGAR RESULTADO` disabled/enabled;
- transición explícita a Resultado;
- result-card editable;
- selector wheel/carrusel para el set;
- ganador + sets/games antes de confirmar;
- confirmación directa desde Resultado.

**FUSIONAR / REUTILIZAR**
- `.result-card` / grilla canónica de score;
- presentación de jugador `.player-row` / compacta server-backed;
- separador `VS`;
- sistema global de botones y disabled;
- motor y validaciones actuales de score;
- pipeline vigente de guardado y validación.

**NO TOCAR**
- backend/Supabase;
- Nivel BRAMU, salvo leer su presentación real en filas de jugador;
- Ranking;
- Grupos;
- BRAMU Intelligence;
- Resumen oficial post-partido;
- BRAMUlive;
- main / Production.

---

## 9. Ajustes V04.27 (QA humano de V04.26) — vigentes

- **Jugadores:** `EQUIPO A` / `EQUIPO B` son encabezados fuera de las tarjetas (la tarjeta contiene solo las dos filas); `VS` solo texto + líneas, sin cápsula.
- **Wheels independientes 0–7** (opciones del motor, `ML.computeValidNextDigits` sin lado contrario): mover uno nunca toca el otro; un par temporal inválido puede verse. La validez la decide `E.isValidCompletedSetScore`.
- **Panel del wheel:** título `SET n` centrado y CTA `SIGUIENTE` al pie (disabled sin set válido, sin toast/mensaje). Set válido + SIGUIENTE confirma y avanza: 2–0 → decidido; 1–1 → abre Set 3 directo (ya no hay mensaje rojo del tercer set); Americano → decidido. Se mantiene la confirmación solo cuando editar Set 1/2 deja huérfano un Set 3 ya confirmado.
- **Cambiar jugadores:** conserva participantes, metadata, sets confirmados, set parcial y set activo. Cambiar/quitar un participante **no** descarta el score (pertenece a los lados A/B); con un slot vacío no se puede cargar resultado/confirmar hasta completar los cuatro.
- **Borrador local temporal (15 min desde la última modificación relevante):** `Store.loadManualDraft/saveManualDraft/clearManualDraft` (`bramulab.manualDraft.v1`, por cuenta). Solo cargas nuevas; no es outbox ni Historial ni va al servidor. Navegar no lo borra ni pregunta. Tocar `+` con borrador vigente muestra `Tenés un partido sin terminar` → `CONTINUAR` (restaura exacto, incl. paso, set parcial e invitados con su `playerId/kind`) / `EMPEZAR DE NUEVO`. Se limpia al guardar, al empezar de nuevo y al vencer.
- **#26:** Nivel ámbar solo con `CALIBRANDO`; `RECALIBRANDO` queda blanco.

Implementación y límites de verificación: `Implementacion/Pre_Production/110_Resultado_V0427_Cargar_Partido_Pulido_02OCT.md`. Handoff `109` consumido. Pendiente QA humano dirigido en iPhone.
