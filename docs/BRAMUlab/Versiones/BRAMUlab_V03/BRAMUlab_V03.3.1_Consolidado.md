# Microparche sobre V03.3 — Perfil público / Jugadores

Aplicar estos ajustes puntuales sin abrir una nueva ronda grande:

## 1) Home — BUSCAR JUGADORES
- Agregar ~10px de margen superior respecto de las tarjetas anteriores para recuperar el ritmo vertical.
- Mantener icono lupa en lima y chevron.
- Bajar el protagonismo del texto: usar el mismo tono gris/secundario que ya usa el sistema en labels como ACTIVIDAD / EFECTIVIDAD.
- No cambiar tamaño ni estructura de la tarjeta.

## 2) Componente `.player-row`
- Quitar el `border-radius` de la fila para que los separadores horizontales queden rectos.
- Mantener los separadores suaves entre jugadores.
- Aplicar el cambio al componente compartido para que se vea igual en:
  - Buscar jugadores
  - JUGADORES
  - Elegir compañero
  - Elegir rival
- Verificar que no genere regresiones en otros usos.

## 3) Perfil público — header
- Reemplazar el nombre del jugador como título del header por:
  `PERFIL DE JUGADOR`
- El nombre visible del jugador sigue apareciendo dentro de la tarjeta de identidad, como ahora.

## 4) Agregar jugador — feedback
Al tocar `AGREGAR JUGADOR`:
- agregar el jugador normalmente;
- mostrar el mismo tipo de toast pequeño que ya usa la app para `Datos guardados`;
- texto:
  `Jugador agregado`

No usar modal.

## 5) Jugador ya agregado
- El botón grande neutro `JUGADOR AGREGADO` no debe quedar como estado final.
- Reemplazarlo por una acción destructiva de menor jerarquía:
  `ELIMINAR DE JUGADORES`
- Visualmente seguir la lógica de `ELIMINAR PARTIDO`:
  rojo,
  sin pastilla/fondo fuerte,
  claramente secundario respecto del resto del perfil.

Al tocar:
- quitarlo de la lista;
- mostrar toast:
  `Jugador eliminado`
- usar la variante visual destructiva/roja del mismo patrón de toast si ya existe; si no existe, crear solo una variante mínima coherente con el sistema.

## 6) Perfil > JUGADORES
- No implementar swipe.
- Para eliminar un jugador, el flujo queda:
  JUGADORES → abrir perfil → ELIMINAR DE JUGADORES.

## No tocar
- datos mostrados del perfil público;
- efectividad;
- mejor racha;
- mejor nivel BRAMU;
- lógica de búsqueda;
- persistencia;
- Home fuera de Buscar jugadores;
- Perfil fuera de JUGADORES;
- Historial;
- Ranking;
- backend;
- Nivel BRAMU.

Es un microparche visual/UX. Implementar directamente, QA mobile, tests focales solo si se toca lógica, suite completa una sola vez al cierre, informe, commit, tag, push y deploy.
