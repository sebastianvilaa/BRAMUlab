# Microparche sobre V03.3.2 — buscador dentro de JUGADORES

Pedido directo del usuario en el chat (sin documento previo), resumido:

> En Mi Perfil, pestaña JUGADORES, están los jugadores que agregué, pero no hay un buscador.
> El día de mañana, si tengo cien jugadores agregados, va a ser difícil encontrarlos ahí. Que
> aparezca un buscador. Lo que no tengo claro es qué jugadores debería mostrar ese buscador —
> hoy lo confundo un poco con el buscador general de Buscar Jugadores.

## Aclaración de alcance (antes de implementar)

Son dos buscadores con propósitos distintos, y quedan así:

- **Buscar Jugadores** (Home): busca en TODO el universo de jugadores conocidos localmente
  (para descubrir/agregar gente nueva).
- **JUGADORES → buscador nuevo**: busca SOLO dentro de la lista que el usuario ya agregó (para
  encontrar a alguien puntual en una lista personal que puede crecer con el tiempo).

## Implementación

- Campo de búsqueda arriba de la lista en la pestaña JUGADORES, mismo componente visual que
  el resto de la app.
- Filtra únicamente los jugadores ya agregados (reutiliza la función de filtro por texto ya
  existente).
- Solo visible si hay al menos un jugador agregado; con la lista vacía se mantiene el estado
  vacío de siempre.
- "Sin coincidencias" si la búsqueda no encuentra a nadie dentro de la lista agregada.
