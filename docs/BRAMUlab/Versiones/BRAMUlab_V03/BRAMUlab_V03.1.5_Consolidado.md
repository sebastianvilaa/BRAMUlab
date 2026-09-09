# BRAMUlab V03.1.5 — Corrección de línea en la tarjeta de Evolución

## Objetivo

Corregir un problema puntual introducido en V03.1.4, reportado por el usuario mirando la
versión ya publicada.

Mensaje del usuario:

> Una cosita más para que sepas por qué no quedó bien. En el gráfico de evolución... nivel
> actual y cambio últimos treinta días quedaron en una línea y mejor nivel Bramu quedó en otra
> línea. Debería quedar los tres en la misma línea. Eso quedó mal. Después el resto quedó todo
> bien.

## ALCANCE

### 1. CORREGIR — los 3 datos de la cabecera de Evolución en una sola línea
"Nivel actual", "Cambio últimos 30 días" y "Mejor nivel BRAMU" deben quedar siempre en la misma
fila (Nivel actual y Cambio a la izquierda, Mejor nivel BRAMU anclado a la derecha) — nunca
saltar a una segunda línea, en ningún ancho de pantalla razonable.

## NO TOCAR

Todo lo demás de V03.1.4 quedó confirmado como correcto por el usuario ("el resto quedó todo
bien") — no tocar composición de Efectividad, espaciado, tamaño del donut, lógica de negocio,
Home, Historial, Ranking, Notificaciones, Login, backend.

## FORMA DE TRABAJO

Implementar directamente, validar mobile (320px y 375px) y desktop, correr la suite completa
una sola vez, generar informe, commit, tag, push, deploy.
