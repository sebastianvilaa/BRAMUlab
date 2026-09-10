# BRAMUlab V03.4.1 — Microparche sobre V03.4 (Mis grupos)

Pedido directamente en chat (sin archivo adjunto) — transcripto acá tal cual para dejar
registro del alcance de esta ronda, mismo criterio que el resto de `Versiones/`.

No rehacer la lógica general de MIS GRUPOS. El funcionamiento base está bien. Corregir UX,
jerarquía visual, empate e incorporar el ajuste pendiente de ubicación en MIS DATOS.

## 1. MIS GRUPOS — estado vacío

El botón `CREAR GRUPO` está demasiado chico/perdido. Reemplazar por CTA estándar de ancho
completo, usando exactamente el sistema global de botones actual (misma altura, tipografía,
peso, tracking, ancho útil que el resto de CTAs principales). No cambiar el texto.

## 2. MIS GRUPOS — jerarquía entre grupos y período

Hoy compiten visualmente: selector de grupos y ACTUAL/ANTERIOR/RACE ANUAL. Ajustar: el selector
de grupos debe sentirse como una capa superior de navegación/contexto; ACTUAL/ANTERIOR/RACE
ANUAL deben seguir siendo las tabs principales del contenido del grupo; no usar exactamente el
mismo tratamiento visual para ambos niveles; mantener coherencia con el sistema existente, sin
inventar un lenguaje nuevo. Además, hacer más visible cuál es el grupo activo.

## 3. Nombre del grupo + BRAMU Intelligence

El nombre del grupo hoy queda demasiado escondido. Reemplazar "EL MOMENTO DEL GRUPO" por una
composición que incluya el nombre real del grupo (ej. "EL MOMENTO · JUEVES DE PADEL"). El bloque
debe dejar claro de qué grupo está hablando BRAMU.

## 4. BRAMU Intelligence grupal — spacing

Reducir separación vertical entre insights, manteniendo lectura cómoda, para que se perciba como
un único bloque con 2–3 conclusiones — no como tres párrafos aislados. No achicar demasiado el
contenido ni volverlo una sola frase.

## 5. Bug real — empates

Caso reportado: Seba y Esteban jugaron juntos, ganaron el mismo partido y ambos tienen 6 puntos.
Hoy aparece "Esteban lidera con 6" / "Seba le pisa los talones con los mismos 6" — incorrecto.
Regla: si dos o más jugadores tienen el mismo puntaje, deben compartir posición; no inventar
desempate para forzar un líder único (ej. `1 Seba — 6 / 1 Esteban — 6 / 3 Diegote — 0`). BRAMU
Intelligence debe reconocer el empate ("Seba y Esteban comparten el liderazgo con 6 puntos."),
nunca "le pisa los talones"/"está segundo" ante puntaje idéntico. Revisar también Race Anual y
Semana anterior para que usen la misma lógica de empate.

## 6. Tabla del grupo — identidad

Usar foto/avatar real si existe (fallback a inicial solo si no hay foto). Primera línea: nombre
visible + `· @usuario` si entra, si no debajo. Segunda línea: `X partidos · X V · X D`. Derecha:
puntos. No agregar Nivel BRAMU en la tabla.

## 7. `+` superior — ambigüedad

El `+` del header crea un grupo nuevo, pero al estar al lado del engranaje parece una acción
sobre el grupo abierto. Mantener el `+` para CREAR GRUPO, pero hacer más clara su función
visual/contextual — nunca usarlo para agregar miembros. Dentro del grupo debe existir una acción
clara: `+ AGREGAR JUGADOR` (al final del contenido principal del grupo y/o en Configuración).

## 8. Configuración del grupo — botones

`+ AGREGAR JUGADOR` está demasiado angosto. Llevarlo al sistema estándar de botones (ancho
completo, altura/tipografía/padding/tracking estándar). Revisar también `GUARDAR NOMBRE` y
cualquier CTA equivalente para que no vuelva a aparecer una variante arbitraria. No cambiar la
lógica de admins.

## 9. MIS DATOS — ubicación para Ranking BRAMU

Agregar un único campo visible de ubicación ("¿De dónde sos?" o "Localidad"). No pedir tres
campos separados. Al tocar: abrir selector/buscador, el usuario escribe su localidad, elige una
opción normalizada. Por detrás guardar: localidad, provincia/estado/región, país, un campo
preparado para futura `zonaLocalRanking`. No pedir dirección, GPS obligatorio ni código postal
obligatorio — una sola selección. Todavía NO implementar Ranking BRAMU oficial.

## 10. MIS DATOS — compactar selectores

Género/Mano dominante/Lado habitual/Categoría ocupan demasiado espacio con botones grandes.
Reemplazar por filas compactas: label, valor actual, chevron — tap abre bottom sheet/selector.
Mantener las opciones y datos actuales, sin cambiar significado ni validaciones. Fecha de
nacimiento mantiene su tratamiento actual.

## 11. No tocar

Sistema de puntos de grupos, regla 3 de 4, top 3 semanal, semanas lunes-domingo, Race anual,
admins, perfil público, búsqueda de jugadores, Home fuera de regresiones, Historial, scoring,
Nivel BRAMU, Ranking BRAMU oficial, backend.

## 12. QA

QA mobile focal sobre: estado vacío MIS GRUPOS, 2+ grupos, selector de grupo, ACTUAL/ANTERIOR/
RACE ANUAL, empate real en tabla, empate en Intelligence, fotos/@usuario en filas, agregar
jugador, configuración, botones, MIS DATOS, selector de ubicación, nuevos selectores compactos.
Tests focales solo donde se toca lógica: empate/posición compartida, Intelligence ante empate,
persistencia de ubicación. Suite completa una sola vez al cierre.
