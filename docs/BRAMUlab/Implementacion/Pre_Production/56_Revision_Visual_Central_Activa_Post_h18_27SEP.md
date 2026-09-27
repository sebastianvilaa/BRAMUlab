# BRAMUlab — Revisión visual Central activa post-h18

**Fecha:** 27/09/2026  
**Estado:** ACTIVA  
**Baseline:** BRAMUlab V04.11 / bundle 04.11-h18

Este documento reemplaza al chat de Laboratorio como superficie activa para ajustes visuales finos.

El archivo `05_Laboratorio_UX_Uso_Real.md` queda como trazabilidad histórica. No seguir agregando decisiones visuales nuevas allí salvo necesidad excepcional de trazabilidad.

## 1. Método vigente

- Sebastián revisa directamente la app y envía capturas + criterio visual a Central.
- Central consolida las decisiones acá.
- Claude implementa una única tanda cuando Sebastián diga que terminó de revisar.
- No usar el chat de Laboratorio como intermediario.
- No pedir a Sebastián que repita decisiones ya documentadas.
- No convertir cada hallazgo en una ronda separada.

## 2. Sistema de estados de Último partido

La decisión NO es específica de `CORRECCIÓN PENDIENTE`.

Existe un único sistema visual para estados operativos de Último partido.

Composición estable:

**Renglón 1**
- izquierda: Último partido;
- derecha: fecha/hora.

**Renglón 2**
- izquierda: forma reciente + Victoria/Derrota;
- derecha: estado operativo del partido.

Ejemplos de estado operativo:
- Corrección pendiente;
- Pendiente de validación;
- Tu turno: confirmar;
- identidad cuestionada;
- otros estados reales equivalentes.

Reglas:
- todos comparten la misma geometría;
- nunca deben bajar los puntitos o Victoria/Derrota;
- nunca deben crear una tercera línea;
- evitar pills pesadas que alteren altura;
- color/copy puede variar por semántica;
- la estructura NO cambia según el estado.

La implementación h18 resolvió bien el caso Corrección pendiente, pero la evidencia física posterior demuestra que el patrón debe generalizarse al sistema completo.

## 3. Slot/carrusel superior del Home

Esta decisión ya existía y queda reafirmada; no volver a pedirla.

Home debe tener UN único espacio superior para mensajes contextuales.

Ese espacio funciona como carrusel/slot compartido entre:
- acciones pendientes;
- insights de BRAMU;
- mensajes contextuales relevantes.

Reglas:
- NO apilar una tarjeta de acción y otra tarjeta de insight como dos bloques verticales separados;
- si existe una acción pendiente, tiene prioridad visible;
- el resto de mensajes sigue accesible dentro del mismo carrusel/slot;
- tocar una tarjeta accionable debe llevar a resolver ese caso;
- evitar títulos genéricos si se puede explicar directamente qué pasó.

Ejemplos de dirección de copy:
- “Esteban cargó un partido con vos”
- “Esteban propuso una corrección”
- “Tenés una corrección para revisar”

El copy literal se cierra antes de implementar, pero el sistema de carrusel ya está decidido.

## 4. Corrección en Resumen

Dirección confirmada:

### Tarjeta oficial
- “Resultado oficial actual” vive dentro de la tarjeta oficial;
- debajo: ganador + grilla + resumen existente.

### Tarjeta de corrección
Una sola unidad visual contiene:
1. título relativo al usuario:
   - Corrección propuesta por [Nombre], o
   - Tu corrección propuesta;
2. resultado propuesto;
3. explicación humana del cambio;
4. acciones;
5. estado de espera cuando corresponda.

Eliminar redundancias:
- no mostrar “X propuso una corrección del resultado” si el título ya lo comunica;
- no mostrar diff técnico si la frase humana ya explica el cambio.

### Acciones
Dentro de la tarjeta de corrección:
- Aceptar corrección + Rechazar lado a lado;
- mismo tamaño, altura y jerarquía estructural;
- sentence case;
- estilo de selector similar a Clásico/Americano:
  - aceptar: borde/acento verde + texto verde, fondo oscuro/transparente;
  - rechazar: borde neutro + texto claro;
- Reportar un error debajo, ancho completo, rojo suave.

### Acento
- borde ámbar;
- glow/respiración muy sutil;
- no animación invasiva.

## 5. Estados relativos según actor

El estado debe describir qué significa para quien lo mira.

Dirección:
- quien envió una corrección: Corrección enviada / Esperando respuesta;
- quien debe responder: Corrección pendiente.

No usar “Necesita revisión” si existe un copy más específico.

En el Resumen, “Esperando respuesta de la otra pareja” debe integrarse dentro de la tarjeta de corrección, no quedar flotando.

## 6. Pendientes de revisión antes de cerrar la tanda

- investigar si la barra de Nivel perdió una animación/progresión existente en una baseline anterior;
- seguir revisando visualmente la app hasta que Sebastián diga “listo, no veo nada más”;
- Mis grupos: bienvenida/estado cero ya identificado, abordar después de cerrar Home + corrección salvo decisión expresa de Sebastián.

## 7. Cerrado visualmente por ahora

- Último partido con CORRECCIÓN PENDIENTE en h18: composición puntual correcta;
- metadata/formato de Cargar partido: correcta;
- Reportar un error en sentence case: correcto.

No reabrir estos casos salvo que la generalización del sistema produzca una regresión.
