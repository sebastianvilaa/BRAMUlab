# BRAMUlab — Handoff final de ajuste visual post-h18

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Baseline de partida:** BRAMUlab V04.11 / bundle `04.11-h18`  
**Estado:** LISTO PARA IMPLEMENTAR EN UNA ÚNICA TANDA

Fuente visual activa:
`56_Revision_Visual_Central_Activa_Post_h18_27SEP.md`

No volver al chat de Laboratorio. No releer el Laboratorio completo. No abrir decisiones nuevas salvo bloqueo técnico real.

# Objetivo

Cerrar en una sola ronda los ajustes visuales detectados por Sebastián sobre h18.

No hacer rondas intermedias ni pedir validación a Sebastián durante la implementación.

Al terminar:
- tests pertinentes;
- un commit lógico;
- push a `origin/staging`;
- deploy de BRAMUlab Staging;
- Central revisa técnicamente;
- Sebastián hace la revisión visual final directa.

# A. Sistema único de estados — Último partido

Generalizar el patrón que YA funciona visualmente para `CORRECCIÓN PENDIENTE`.

Composición fija:

**Renglón 1**
- izquierda: `ÚLTIMO PARTIDO`;
- derecha: fecha/hora.

**Renglón 2**
- izquierda: forma reciente + `VICTORIA` / `DERROTA`;
- derecha: estado operativo.

Todos los estados operativos reales deben usar esta misma geometría, por ejemplo:
- corrección pendiente;
- pendiente de validación;
- confirmar partido;
- identidad cuestionada;
- otros equivalentes reales.

Reglas:
- nunca bajar forma/resultado;
- nunca crear tercera línea;
- nunca alterar la altura por una pill grande;
- estado a la derecha con tratamiento textual/compacto;
- color según semántica;
- `white-space: nowrap` cuando sea necesario;
- si un copy no entra, ajustar copy/tipografía antes que romper la geometría.

Copies recomendados:
- quien debe confirmar: `CONFIRMAR PARTIDO`;
- quien cargó y espera: `ESPERANDO VALIDACIÓN`;
- corrección recibida: `CORRECCIÓN PENDIENTE`;
- identidad: conservar copy específico vigente si entra sin romper estructura.

No volver a la solución h18 donde los estados distintos de corrección vivían debajo de fecha/hora.

# B. Slot/carrusel superior del Home

Recuperar la intención ya definida: acciones + insights viven en UN único slot/carrusel superior.

NO:
- una tarjeta de acción grande;
- y debajo otra tarjeta de insight grande.

SÍ:
- un único carrusel/slot;
- una tarjeta visible por vez;
- si hay algo accionable, aparece primero;
- los demás mensajes/insights siguen disponibles en el mismo carrusel;
- tapping de una tarjeta accionable abre el caso correspondiente;
- no duplicar el mismo estado con otro bloque aparte.

Copy orientativo, específico y humano:

## Partido por confirmar
Título:
`PARTIDO POR CONFIRMAR`

Texto:
`Esteban cargó un partido con vos. Revisalo y confirmá el resultado.`

Usar actor real disponible. No inventar nombre si falta.

## Corrección recibida
Título:
`CORRECCIÓN PENDIENTE`

Texto:
`Esteban propuso una corrección. Revisá el resultado.`

## Espera propia
Título:
`ESPERANDO CONFIRMACIÓN`

Texto:
usar el mensaje humano vigente con nombres/contexto real.

Evitar el título genérico `REQUIERE TU ACCIÓN` cuando se conoce qué pasó.

Mantener los insights existentes como elementos del mismo carrusel.

# C. Resumen — tarjeta oficial

Mover `RESULTADO OFICIAL ACTUAL` DENTRO de la tarjeta oficial.

Orden interno:
1. título;
2. ganadores;
3. grilla;
4. sets/games existentes.

No crear una tarjeta extra alrededor.

# D. Resumen — tarjeta de corrección como unidad completa

Una única tarjeta con borde/acento ámbar contiene:

1. título;
2. resultado propuesto;
3. explicación humana;
4. estado de espera si corresponde;
5. acciones correspondientes.

Título:
- quien responde: `CORRECCIÓN PROPUESTA POR [NOMBRE]`;
- quien propuso: `TU CORRECCIÓN PROPUESTA`.

Conservar la explicación humana:
`Esteban indica que el segundo set fue 6–4, no 6–0.`
(o equivalente real).

NO volver a mostrar:
- `Esteban propuso una corrección del resultado.`;
- diff técnico tipo `Set 2: 6–0 → 6–4`.

## Estado para quien propuso
`Esperando respuesta de la otra pareja.`
debe vivir DENTRO de esta tarjeta, como texto auxiliar; nunca flotando entre tarjetas.

# E. Acciones de corrección

Para quien debe responder, dentro de la misma tarjeta:

Primera fila:
- `Aceptar corrección`;
- `Rechazar`.

Los dos:
- lado a lado también en móvil;
- exactamente mismo ancho/altura;
- sentence case;
- no wrap;
- estilo visual inspirado en los selectores `Clásico / Americano` de Cargar partido.

`Aceptar corrección`:
- fondo oscuro/transparente;
- borde verde;
- texto verde;
- seleccionado/positivo pero NO botón lima macizo.

`Rechazar`:
- fondo oscuro/transparente;
- borde neutro;
- texto claro.

Debajo:
- `Reportar un error`;
- ancho completo;
- sentence case;
- rojo suave;
- dentro de la tarjeta de corrección.

Para quien propuso:
- no mostrar Aceptar/Rechazar;
- mostrar el estado de espera dentro de la tarjeta;
- conservar Reportar un error solo si la lógica vigente realmente lo permite para ese actor; no inventar acciones.

# F. Acento de la corrección

La tarjeta de corrección:
- borde ámbar;
- halo/glow ámbar sutil;
- respiración/pulso muy suave opcional;
- respetar `prefers-reduced-motion`;
- nunca parpadeo ni animación fuerte.

Inspiración: la presencia visual sutil que ya usa Último partido cuando requiere atención, no un efecto nuevo estridente.

# G. Historial — estado relativo al actor

Para una corrección abierta:

- quien debe responder: `CORRECCIÓN PENDIENTE`;
- quien la propuso: `ESPERANDO RESPUESTA`.

No usar `NECESITA REVISIÓN` para este caso si se sabe que es una corrección.

No confundir con estados de partido aún no validado.

# H. Barra de Nivel — investigar regresión, no inventar

Sebastián recuerda una animación/progresión visual de la barra de Nivel que ya no aparece.

Antes de modificar:
1. revisar git/history reciente de Home/Nivel;
2. confirmar si existía una animación real de entrada/progreso;
3. si se perdió por regresión, restaurarla de forma acotada;
4. si no hay evidencia clara, NO inventar una nueva y dejarlo documentado como no confirmado.

No tocar fórmula, porcentaje ni datos del Nivel.

# I. Fuera de alcance

NO tocar:
- Mis grupos / nueva bienvenida;
- backend;
- Supabase;
- main;
- Production;
- BRAMUlive;
- Ranking;
- Intelligence;
- lógica de validación/corrección;
- datos reales;
- editor de sets.

Mis grupos se aborda después de cerrar esta tanda.

# J. Pruebas y consumo

Esta es una ronda visual/local. Evitar sobretesting.

Hacer:
- tests focales de markup/estado/carrusel;
- tests existentes afectados;
- smoke boot;
- bundle/cache;
- una suite general solo si es razonable y no duplica trabajo innecesario.

Los tests estructurales NO sustituyen revisión visual.

# K. Entrega

Objetivo de bundle: siguiente hotfix después de h18.

Crear:
`docs/BRAMUlab/Implementacion/Pre_Production/57_Resultado_Ajuste_Visual_Post_h18_27SEP.md`

Incluir brevemente:
- qué cambió;
- tests;
- commit;
- deploy;
- investigación de animación Nivel;
- cualquier desvío.

No declarar PASS visual final.

Terminar con:
`PENDIENTE DE REVISIÓN VISUAL DIRECTA DE SEBASTIÁN`
