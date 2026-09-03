# BRAMU Lab v2 / v2.1 — Prueba guiada con partidos simulados

## Para qué sirve

Esta carga permite comprobar de manera controlada Home, Historial, filtros, Actividad, Efectividad, Último partido, compañeros, rivales y la evolución simulada.

Los datos de la computadora y del iPhone son independientes. Esta prueba debe cargarse en el iPhone donde se quiera evaluar la experiencia.

## Preparación

- Identidad del jugador: Seba.
- Usar Cargar mi partido jugado.
- Formato: Clásico, mejor de 3.
- Sistema: Punto de Oro.
- Cargar los ocho partidos indicados.
- Para probar el orden real, cargar el partido 1 al final. Los demás pueden cargarse del 2 al 8 en ese orden.
- No hace falta usar ubicación real.
- En el partido 8, escribir Pádel House como lugar. En los demás, dejar lugar vacío.

## Partidos

| Nº | Fecha y hora | Pareja de Seba | Rivales | Resultado | Esperado |
|---|---|---|---|---|---|
| 1 | 27 AGO 2026 · 20:00 | Seba / Matu | Esteban / Gusti | 6-3 · 6-4 | Victoria en 2 |
| 2 | 28 AGO 2026 · 21:00 | Seba / Lucho | Matu / Gusti | 4-6 · 6-3 · 3-6 | Derrota en 3 |
| 3 | 29 AGO 2026 · 19:30 | Seba / Matu | Esteban / Gusti | 6-2 · 6-4 | Victoria en 2 |
| 4 | 30 AGO 2026 · 18:00 | Seba / Matu | Esteban / Jona | 6-4 · 4-6 · 6-3 | Victoria en 3 |
| 5 | 31 AGO 2026 · 20:30 | Seba / Esteban | Matu / Lucho | 5-7 · 6-3 · 4-6 | Derrota en 3 |
| 6 | 01 SEP 2026 · 21:00 | Seba / Matu | Esteban / Gusti | 6-1 · 6-2 | Victoria en 2 |
| 7 | 02 SEP 2026 · 20:00 | Seba / Matu | Lucho / Jona | 6-4 · 6-4 | Victoria en 2 |
| 8 | 03 SEP 2026 · 22:00 | Seba / Gusti | Matu / Esteban | 7-6 · 6-3 | Victoria en 2 |

## Resultado exacto esperado

### Home v2.0

- Partidos totales: 8.
- Efectividad últimos 30 días: 75%, 6 de 8.
- Actividad últimos 30 días: 8 partidos.
- Forma de los últimos 5, integrada en Último partido: V · D · V · V · V.
- Racha actual: 3 victorias.
- Mejor compañero: Matu, 5 partidos, 5 victorias, 100%.
- Rival más enfrentado: Esteban, 5 enfrentamientos.
- Último partido: 03SEP · 22:00, Seba / Gusti vs Matu / Esteban, 7-6 · 6-3, Pádel House.
- Cargar el partido del 27 AGO al final no debe convertirlo en Último partido.

### Evolución simulada v2.1

La serie parte de 5.0 y debe quedar así al ordenar por fecha, sin importar el orden de carga:

| Partido | Movimiento | Nivel resultante |
|---|---:|---:|
| Base | — | 5.0 |
| 1 | +0.2 | 5.2 |
| 2 | -0.1 | 5.1 |
| 3 | +0.2 | 5.3 |
| 4 | +0.1 | 5.4 |
| 5 | -0.1 | 5.3 |
| 6 | +0.2 | 5.5 |
| 7 | +0.2 | 5.7 |
| 8 | +0.2 | 5.9 |

Resultado final:

- Nivel actual: 5.9.
- Cambio acumulado: +0.9.
- Partidos considerados: 8.
- Última variación: +0.2.
- El punto final tiene fecha 03 SEP y resultado 7-6 · 6-3.

### Historial v2.1

Con estos ocho partidos:

- Todos: 8.
- Mis partidos: 8.
- Observados: 0.
- Cargados: 8.
- Game por game: 0.
- Punto por punto: 0.
- La lista aparece ordenada del 03 SEP al 27 AGO.

La pestaña Observados debe mostrar un estado vacío contextual, no una pantalla rota. Pendientes todavía no debe aparecer.

## Comprobaciones rápidas después de cargar

1. Abrir el último partido tocando toda la tarjeta.
2. Volver a Historial y confirmar que Volver regresa al Home.
3. Filtrar Mis partidos + Cargados.
4. Abrir Observados y volver con Ver todos.
5. Editar el partido 5 y cambiarlo temporalmente a victoria 7-5 · 6-3. El nivel final debe recalcularse y subir respecto de 5.9, sin duplicar el partido.
6. Restaurar el partido 5 a 5-7 · 6-3 · 4-6. El nivel debe volver exactamente a 5.9.
7. Cerrar y reabrir la app. La identidad, los ocho partidos, filtros por defecto y nivel derivado deben seguir coherentes.

## Qué no hace falta probar manualmente

Claude debe cubrir con pruebas sintéticas:

- Un partido Observado real.
- Filtros Game por game y Punto por punto.
- Un Americano.
- Límites 1.0 y 10.0.
- Partido incompleto excluido.
- Recálculo después de eliminar.
- Viewports tablet y escritorio.

Sebastián solo necesita informar capturas o sensaciones si algo no coincide con los resultados esperados.
