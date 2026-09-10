# Microparche sobre V03.3.1 — Recientes en Elegir compañero / Buscar Jugadores

Pedido directo del usuario en el chat (sin documento previo):

> Quedó bastante bien, solo me queda una cosita puntual nomás, que no es consistente. Tanto en
> elegir compañero como en buscar jugadores falta como un pequeño título que te muestre como
> "jugadores recientes" o algo por el estilo. Hoy te tira directamente el listado de los
> nombres y no se explica mucho por qué aparecen esos nombres. Y tal vez deberían ser, sí,
> "jugadores recientes" podría ser. Es un título sutil y nada más.

## Alcance

- Agregar un título chico "Recientes" (y su contraparte "Todos" para el resto de la lista)
  arriba del listado, tanto en Elegir compañero/Elegir rival como en Buscar Jugadores —
  mismo componente/patrón, consistente entre ambas pantallas.
- Sutil: reutilizar el label ya existente en el selector de compañero/rival (mismo tamaño,
  mismo tono gris), no inventar un componente nuevo.
- No tocar datos, persistencia, ni el resto de la app.
