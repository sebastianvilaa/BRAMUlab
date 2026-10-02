# 109 — Handoff V04.27: cierre de QA de Cargar partido

**Fecha:** 02/10/2026  
**Estado:** decisión humana cerrada; listo para implementación en `staging`.  
**Base funcional:** V04.26 / `04.26-h1` — HEAD `ed8b589a42925f2ed09462a4778d5afccdc208e3`.  
**Fuente maestra:** `docs/BRAMUlab/Cargar_Partido.md`. Este handoff agrega únicamente los ajustes surgidos del QA humano posterior a V04.26; en caso de contradicción puntual con el detalle V04.26, prevalece este handoff para la ronda V04.27.

## 1. QA humano ya validado

Sebastián probó en iPhone y dio por buena la nueva dirección visual/funcional de V04.26.

Quedaron comprobados:
- carga Clásico normal;
- carga con invitado real + validación por rival;
- Americano de un set;
- cambio de jugadores;
- edición de sets previos;
- confirmación directa sin resumen intermedio;
- navegación al Resumen oficial existente.

No repetir auditoría completa en V04.27.

## 2. Pulido de la instancia Jugadores

- Mover `EQUIPO A` y `EQUIPO B` fuera de las tarjetas, como encabezados superiores con punto/acento de color.
- La tarjeta debe contener solo las dos filas de jugadores para que ambas tengan la misma altura.
- Mantener borde completo verde en A y celeste en B.
- En el separador `VS`, mantener líneas + texto y quitar fondo/borde/cápsula.
- No rediseñar las hojas de selección de jugador en esta ronda.
- Invitados siguen contando como participantes válidos para completar el roster y habilitar `CARGAR RESULTADO`.

## 3. Resultado — wheels independientes

La UX de wheel queda aprobada, con una corrección importante:

- A y B deben poder editarse en cualquier orden.
- Mostrar siempre valores 0–7 en ambos wheels para los formatos actuales.
- Mover un wheel nunca borra, limita ni cambia automáticamente el otro.
- El valor elegido se mantiene aunque el par temporal sea inválido.
- El motor actual valida el par completo únicamente para habilitar el avance.
- No crear una segunda lógica deportiva.

Principio: BRAMU conserva lo que el usuario escribió y valida cuándo puede avanzar.

## 4. SET / SIGUIENTE

- Centrar el título `SET 1` / `SET 2` / `SET 3`.
- Reemplazar `LISTO` por un CTA grande `SIGUIENTE` al pie del panel.
- Mientras el wheel esté abierto, la bottom nav sigue oculta.
- `SIGUIENTE` está completamente disabled mientras el set no sea válido.
- No mostrar toast/error al tocar un botón disabled.
- Set válido + `SIGUIENTE` avanza al siguiente set.
- Si Set 1 y Set 2 quedan 1–1, abrir Set 3 directamente.
- Retirar en esta secuencia el mensaje rojo `Con 1 set para cada equipo, falta definir el tercer set`: no es un error, es el siguiente paso.
- Si el partido queda decidido, `SIGUIENTE` cierra el wheel y deja visible Ganadores + sets/games + `CONFIRMAR PARTIDO`.
- Americano: set válido + `SIGUIENTE` → partido decidido.

## 5. Cambiar jugadores / conservar score

- Volver a `CAMBIAR JUGADORES` conserva participantes, metadata, sets confirmados y el set parcial en edición.
- Cambiar o quitar un participante no debe borrar automáticamente el score ya cargado.
- El score sigue asociado a Equipo A / Equipo B.
- Si queda un slot vacío, bloquear avance/confirmación hasta volver a completar los cuatro.
- Retirar el aviso actual que informa que cambiar jugador descartará el resultado, porque en V04.27 ya no se descarta.
- Mantener la confirmación existente solo para el caso distinto en que editar sets vuelva innecesario un Set 3 ya confirmado.

## 6. Borrador local temporal — 15 minutos

Agregar persistencia local temporal de la carga.

- TTL: 15 minutos desde la última modificación relevante.
- Guardar metadata, participantes/referencias, instancia actual, sets confirmados, set parcial y set activo.
- Navegar a Inicio/Perfil/Historial u otra pantalla no borra el borrador ni pide confirmación.
- El borrador no va a Supabase, no aparece en Historial y no reutiliza el outbox server-backed.
- Al elegir nuevamente `Cargar partido` desde el `+` dentro del TTL, mostrar:
  - `Tenés un partido sin terminar`
  - `CONTINUAR` → restaurar exactamente el borrador.
  - `EMPEZAR DE NUEVO` → abrir una carga limpia.
- Limpiar borrador al guardar correctamente, al empezar de nuevo o al vencer el TTL.
- Evitar que tocar `+` re-inicialice silenciosamente una carga vigente.

## 7. Residual Nivel #26 a agrupar en esta ronda

Issue #26 ya tuvo QA humano positivo para CALIBRANDO.

Corregir el residual técnico ya documentado por Central:
- Home y Mi Perfil hoy colorean ámbar cualquier estado distinto de `CALIBRATED`.
- `RECALIBRANDO` conserva Nivel consolidado y debe permanecer con valor blanco/normal.
- Ámbar corresponde solo a `CALIBRANDO`.

No tocar fórmula, estados, backend, Ranking ni UX aprobada de CALIBRANDO.

## 8. Alcance

**AGREGAR / REEMPLAZAR**
- pulido Equipo A/B + VS;
- wheels independientes;
- `SIGUIENTE`;
- avance natural a Set 3;
- conservación de score/set parcial;
- borrador local 15 min + Continuar/Empezar de nuevo;
- residual visual RECALIBRANDO #26.

**NO TOCAR**
- Supabase/backend;
- fórmula de Nivel;
- Ranking;
- Grupos;
- Intelligence;
- Resumen oficial post-partido;
- BRAMUlive;
- main / Production.

## 9. Versionado y entrega

Nueva versión visible: **BRAMUlab V04.27**.  
Bundle inicial: **04.27-h1**.

Una sola ronda, idealmente un único commit/push/deploy. QA posterior debe ser dirigida a estos ajustes, no una reauditoría de V04.26.
