# Cargar partido

**Rol:** fuente maestra vigente del flujo **Cargar partido** (cargar un partido YA jugado; no hay scoring en vivo en BRAMUlab).  
**Vigente desde:** V04.24; dirección UX V04.26 y ajustes V04.27 (QA humano 02/10/2026, Issue #24). Solo documenta las decisiones actuales. Resultado de implementación V04.27: `docs/BRAMUlab/Implementacion/Pre_Production/110_Resultado_V0427_Cargar_Partido_Pulido_02OCT.md`.

---

## 1. Estructura general — dos instancias

`Cargar partido` se organiza en **dos instancias consecutivas dentro del mismo flujo**:

1. **Jugadores** — definir metadata y los cuatro participantes.
2. **Resultado** — cargar sets sobre una representación tipo resumen y confirmar.

No debe sentirse como una app de marcador separada. La composición reutiliza componentes y lenguaje visual ya existentes en BRAMUlab.

La transición es explícita:
- mientras falten jugadores, `CARGAR RESULTADO` permanece visible pero deshabilitado;
- con los cuatro jugadores completos (invitados incluidos), se habilita;
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

- encabezado **EQUIPO A** (punto de color) **fuera** de la tarjeta + tarjeta del equipo;
- separador **VS** existente: texto entre líneas, **sin fondo, borde ni cápsula**;
- encabezado **EQUIPO B** fuera de la tarjeta + tarjeta del equipo.

Cada equipo vive dentro de una **tarjeta grande BRAMU** que contiene **solo las dos filas de jugador** (ambas con el mismo peso/altura), tomando el lenguaje visual de tarjetas existentes como Último partido:
- fondo oscuro;
- borde completo;
- Equipo A con acento/borde verde;
- Equipo B con acento/borde celeste;
- no usar grandes fondos degradados nuevos como lenguaje principal.

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

El score se carga con un **selector vertical tipo wheel** (scroll-snap), inspirado en el selector horario del dispositivo e integrado a BRAMU. Reemplaza al teclado numérico.

Al tocar una columna/set:
- ese set pasa a estado editable;
- se muestran dos wheels, uno para **Equipo A** y otro para **Equipo B**;
- los valores se reflejan **en vivo** en la propia columna del resumen;
- el set completo es la unidad de edición.

**Wheels independientes:**
- cada wheel muestra los valores **0 a 7** (opciones derivadas del motor, `ML.computeValidNextDigits` sin lado contrario);
- se puede cargar primero A o B;
- **mover A nunca modifica, restringe ni borra B; mover B nunca modifica A**;
- un par temporal inválido (p. ej. 4–4) puede verse mientras se edita;
- la validación deportiva (`E.isValidCompletedSetScore`, única fuente) solo decide si se puede avanzar. No existe una segunda lógica de score.

**Panel del wheel:** título `SET 1` / `SET 2` / `SET 3` centrado; CTA grande **`SIGUIENTE`** al pie del panel. La bottom nav permanece oculta mientras se carga el score.
- Set inválido o incompleto → `SIGUIENTE` completamente disabled (sin toast ni mensaje).
- Set válido + `SIGUIENTE` → confirma el set y avanza: **2–0** → partido decidido, se cierra el wheel y aparece el resumen previo a confirmar; **1–1** → abre directamente el **Set 3** (no hay mensaje de error: es el siguiente paso); **Americano** (un set) → partido decidido.

Implementación: control web móvil robusto (wheel/scroll-snap) para iPhone/PWA.

Si durante implementación aparece una limitación real de iOS/accesibilidad que vuelva este control frágil, marcarla como **DECISIÓN ABIERTA** y continuar todo lo demás; no reemplazar silenciosamente por otra UX.

### 4.3 Edición de sets previos

La corrección V04.25 se conserva conceptualmente:

- tocar un set confirmado lo reabre;
- la unidad de edición es el **set completo**;
- A y B se editan de forma independiente; cambiar un lado no cierra la edición, no hace rebotar la pantalla ni modifica el otro lado;
- al confirmar el set con `SIGUIENTE` se recalcula el estado del partido;
- si editar Set 1/2 vuelve innecesario un **Set 3 ya confirmado**, se mantiene la confirmación explícita antes de quitarlo (pérdida real de información).

### 4.4 Volver / cambiar jugadores

En esta instancia, volver al paso anterior significa **cambiar jugadores**.

Debe existir una acción clara de retorno (`CAMBIAR JUGADORES`, también la flecha ←) que:
- vuelve a la instancia Jugadores;
- conserva **jugadores, metadata, sets confirmados, set parcial en edición y set activo**;
- permite corregir compañero/rivales.

**Cambiar o quitar un participante no borra el score**: el resultado pertenece a los lados Equipo A / Equipo B. Si queda un slot vacío, no se puede cargar resultado ni confirmar hasta completar de nuevo los cuatro, pero el score se conserva. No se descarta nada en silencio y no existe aviso de descarte.

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
- no se muestran mensajes de error por estar en el paso siguiente (p. ej. 1–1 sin Set 3 no es un error).

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

## 8. Borrador local temporal — 15 minutos

- Persistencia local de la carga **nueva** (no ediciones): `Store.loadManualDraft/saveManualDraft/clearManualDraft`, clave `bramulab.manualDraft.v1`, por cuenta.
- TTL: **15 min desde la última modificación relevante** (cada cambio renueva `updatedAt`).
- Guarda formato, sistema, fecha, hora, lugar, participantes y sus referencias (`playerId`/`kind`, incluidos invitados), instancia actual, sets confirmados, set parcial y set activo.
- No es outbox ni Historial ni partido oficial; no usa RPC ni Supabase.
- Navegar a Inicio/Perfil/Historial/otra pantalla **no** lo borra ni pregunta.
- Al elegir `Cargar partido` desde `+` con borrador vigente: modal `Tenés un partido sin terminar` con `CONTINUAR` (arriba, primario lima, ancho completo; restaura exactamente, incluido paso y set parcial) y `EMPEZAR DE NUEVO` (debajo, secundario, ancho completo; limpia y abre una carga vacía). Si venció, se limpia y se abre una carga nueva.
- Se limpia únicamente al guardar correctamente, al `EMPEZAR DE NUEVO` o al vencer.

---

## 9. Límites de alcance (V04.26–V04.27)

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

## 10. Nivel en filas/Home/Perfil (residual #26)

El Nivel se pinta en ámbar **solo con `CALIBRANDO`**. `CALIBRADO` y `RECALIBRANDO` usan la presentación consolidada (número blanco, sin bloque/copy/progreso `CALIBRANDO · X / 5`).

---

## 11. Estado

V04.27 / `04.27-h2` en Staging. Resultado y límites de verificación: `docs/BRAMUlab/Implementacion/Pre_Production/110_Resultado_V0427_Cargar_Partido_Pulido_02OCT.md` (handoff `109` consumido). Pendiente QA humano dirigido en iPhone.
