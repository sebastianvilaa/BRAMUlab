# BRAMUlab V03.4.2 — Microparche sobre MIS GRUPOS + ubicación

Pedido directamente en chat (sin archivo adjunto) — transcripto acá tal cual para dejar
registro del alcance de esta ronda, mismo criterio que el resto de `Versiones/`.

No cambiar lógica de puntos, regla 3 de 4, top 3 semanal, Race anual, admins ni funcionamiento
general.

## 1. Selector de grupo — reemplazar chips actuales

Los chips competían visualmente con ACTUAL/ANTERIOR/RACE ANUAL. Reemplazar por un único
selector de grupo activo: debajo del header, una fila "Nombre del grupo activo ▾". Al tocar,
abrir bottom sheet con todos los grupos del usuario (check en el activo) y, separado al final,
"+ CREAR GRUPO" (abre el flujo existente). Seleccionar un grupo cambia el activo y cierra el
sheet. Eliminar los chips/pastillas actuales.

## 2. Header MIS GRUPOS

Mantener flecha atrás, título, engranaje (siempre configura el grupo actualmente seleccionado).
Quitar el "+" de crear grupo del header — la creación pasa al selector. Evita mezclar
"configurar grupo actual" con "crear un grupo nuevo".

## 3. Tabs temporales

ACTUAL/ANTERIOR/RACE ANUAL deben usar exactamente el mismo patrón visual/tipográfico que las
tabs de HISTORIAL (Todos/Mis partidos/Observados) — mismo font-size, peso, mayúsculas/
minúsculas, color activo/inactivo, espaciado, indicador activo, altura. No inventar tamaños ni
ajustar a ojo. No usar como referencia las tabs MI PERFIL/MIS DATOS/JUGADORES.

## 4. BRAMU Intelligence grupal

Reemplazar "EL MOMENTO · {grupo}" por "BRAMU INTELLIGENCE" (con el mismo ícono/pelotita/acento
visual que ya identifica BRAMU Intelligence en otros lugares) y, debajo, como segunda
jerarquía, el nombre del grupo. Mantener las 2-3 conclusiones. No volver a separar
excesivamente los insights.

## 5. Crear grupo — nombre

Quitar el placeholder pesado "Ej. Los martes". Dejar un placeholder neutro o vacío si el label
ya resuelve la función. No debe parecer que ya existe un nombre cargado.

## 6. Configuración — editar nombre

Quitar el botón grande "GUARDAR NOMBRE". Convertir la edición en interacción compacta: nombre
actual + lápiz de edición, tocar lápiz habilita edición, confirmar con acción mínima/check/blur
coherente con el sistema, guardar sin CTA grande. No perder cambios accidentalmente.

## 7. Configuración — eliminar grupo

Agregar al final de Configuración "ELIMINAR GRUPO", tratamiento destructivo coherente con
"ELIMINAR PARTIDO" (baja jerarquía, rojo), solo visible para admins. Al tocar, modal de
confirmación estándar. Título: "¿Eliminar este grupo?". Texto: "Se eliminará el grupo para
todos sus miembros. Esta acción no elimina los partidos de sus historiales." Acciones:
CANCELAR / ELIMINAR GRUPO. No borrar partidos.

## 8. Ubicación — reemplazar dataset local incompleto

El buscador local (~180 localidades) dejaba afuera casos reales como General Las Heras.
Reemplazar la fuente principal por la API oficial GeoRef de Argentina: buscar localidades
reales, devolver opciones normalizadas, guardar locality/region/country, evitar texto libre,
cubrir Argentina completa. Mantener un único campo visible "¿De dónde sos?". No pedir código
postal, GPS obligatorio, ni país/provincia/localidad en formularios separados. Mantener
`rankingLocalZone` preparado/null. Si la API no responde: manejar el error de forma simple, no
inventar resultados; se puede mantener un fallback local mínimo solo como contingencia, nunca
como fuente principal.

## 9. No tocar

Puntos, bonuses, empates ya corregidos, tabla, identidad de jugadores, 3 de 4, top 3, semanas,
Race, perfil público, Home, Historial, Nivel BRAMU, Ranking BRAMU oficial, backend.

## 10. QA

Mobile: un grupo, múltiples grupos, cambio de grupo desde selector, crear grupo desde selector,
engranaje configura grupo activo, tabs comparadas contra Historial, Intelligence, renombrar
grupo, eliminar grupo + cancelación + confirmación, buscar Bella Vista, buscar General Las
Heras, localidad inexistente, fallo/no conexión de GeoRef. Tests focales solo para lógica
nueva. Suite completa una sola vez al cierre.
