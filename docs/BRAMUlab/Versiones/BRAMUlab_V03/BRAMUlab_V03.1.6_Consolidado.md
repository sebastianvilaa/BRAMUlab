# BRAMUlab V03.1.6 — Corrección de loop infinito de actualización

## Objetivo

Corregir un bug real reportado por el usuario en producción: al actualizar a V03.1.5, la app
vuelve a mostrar el cartel de "hay una nueva versión" apenas se toca ACTUALIZAR, en loop
infinito.

Mensaje del usuario:

> Algo quedó mal, me aparece el cartel de que hay una nueva versión de Braham, la tres punto
> uno punto cinco. Le doy actualizar y me vuelve a aparecer el cartel y me vuelve a aparecer el
> cartel y me vuelve a aparecer el cartel. No sé qué está pasando.

## ALCANCE

### 1. CORREGIR — loop de actualización infinito
Investigar y corregir la causa raíz de que "ACTUALIZAR" no despeje el cartel de nueva versión
de forma definitiva.

## NO TOCAR

Ninguna lógica de negocio, ninguna pantalla — este es un bug de infraestructura de
actualización (caché del navegador), no de producto. Home, Historial, Ranking, Notificaciones,
Login, MI PERFIL, MIS DATOS, backend: sin cambios.

## FORMA DE TRABAJO

Diagnosticar la causa raíz (no solo el síntoma), corregir, validar, generar informe, commit,
tag, push, deploy — con prioridad, al ser un bug que bloquea a un usuario real en producción.
