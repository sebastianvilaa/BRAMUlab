# BRAMUlab — Auditoría Central de reapertura visual h16 + plan único h17

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Baseline auditada:** BRAMUlab V04.11 / bundle `04.11-h16`  
**Fuente vigente de reapertura:** `05_Laboratorio_UX_Uso_Real.md` §15.36  
**Especificación visual original:** `45_Handoff_Cierre_UX_h13_27SEP.md`

## 0. Estado

**LABORATORIO FÍSICO DE SEBA: DETENIDO.**

El cierre de §15.35 queda invalidado para los criterios 2 y 4 y no se reutiliza como gate general de confianza.

Esta ronda debe terminar con:
1. implementación consolidada de los dos FAIL reales;
2. revisión Central técnica;
3. gate visual interno nuevo 1–11 sobre el deploy resultante;
4. ningún PASS visual por inferencia desde clases/tests/DOM;
5. recién después, decisión sobre retorno o no a Sebastián.

---

# 1. Auditoría Central 1–11 sobre implementación h16

## 1 — Nivel BRAMU

### Implementación
La ruta server-backed usa `PH.levelProgressPct(publicLevel)` y ya no fija 100%. Sin delta real, `--flat` queda en `display:none`.

### Evidencia visual vigente
- Seba 6.0: barra vacía/al inicio — observado.
- delta inventado: no aparece — observado.
- caso decimal 5.8: no observado en la Home de ese jugador.

### Estado Central
**VISUAL PARCIAL / NO CERRAR COMO PASS COMPLETO.**

No requiere cambio de código conocido. En el nuevo gate:
- comprobar 6.0;
- intentar un decimal real sin pedirle a Seba cambiar cuenta;
- si no existe acceso seguro, marcar NO VERIFICABLE PARCIAL.

---

## 2 — Último partido con corrección activa

### Evidencia física h16
**FAIL VISUAL REAL.**

- `CORRECCIÓN PENDIENTE` sigue pareciendo una píldora dominante;
- altera la composición derecha;
- forma + VICTORIA se desplazan verticalmente.

### Causa de implementación confirmada
El intento h14/h16 sigue estructuralmente ligado a la altura de la columna derecha:

- `.player-home-lastmatch__row1` contiene `.player-home-lastmatch__datetime`;
- el status slot vive adentro de esa `.datetime`;
- `--reserved` usa solo `min-height:18px`, no una geometría fija;
- el badge conserva padding/radio/fondo de `.player-home-lastmatch__badge`;
- `.player-home-lastmatch__badge--correction` incluso aumenta font-size;
- si el copy ocupa más alto/ancho del esperado, la fila 1 crece y empuja row2.

El comentario del código afirma invariancia, pero la composición real no la garantiza.

### REEMPLAZAR
No seguir ajustando `min-height` de la píldora.

Recomposición robusta requerida:
- estado de corrección debe ser TEXTO/label ámbar discreto, no una pill dominante;
- el estado debe ocupar un slot geométrico explícito que no modifique la posición de forma/VICTORIA;
- preferir grid/áreas explícitas para top:
  - título;
  - fecha/hora;
  - slot de status;
  - forma;
  - VICTORIA/DERROTA;
- el estado normal y el estado con corrección deben reservar exactamente la misma geometría relevante;
- `CORRECCIÓN PENDIENTE` no debe wrappear en dos líneas en el ancho móvil de referencia;
- score oficial no cambia.

### Criterio visual medible
En dos capturas del mismo componente (normal vs corrección activa) a ~390×844:
- el borde superior de `.player-home-lastmatch__row2` debe quedar visualmente en la misma coordenada;
- forma y VICTORIA/DERROTA no deben moverse;
- el status no debe leerse como CTA/pastilla principal.

No considerar PASS solo por `getBoundingClientRect`; eso puede apoyar la evidencia, no reemplazar captura/inspección visual.

---

## 3 — Grilla de Resumen

### Implementación
Existe primitiva compartida `buildResultRowsHTML` + divisor de fila continuo.

### Evidencia visual
- desktop real 2/3 sets: observado bien;
- móvil real: no validado por gate interno anterior.

### Estado Central
**NO CERRADO VISUALMENTE.**

Sin cambio de código obligatorio conocido antes de verlo.

Nuevo gate debe revisar:
- 2 sets móvil;
- 3 sets móvil;
- 2/3 sets desktop;
- nombres largos razonables;
- divisor continuo;
- columnas de games alineadas.

---

## 4 — Oficial vs propuesta / acciones

### Evidencia física h16
La lectura oficial/propuesta es comprensible, PERO:

**FAIL VISUAL REAL en acciones.**

- `Aceptar corrección` y `Rechazar` no tienen composición pareja;
- primario más alto por wrap;
- secundario más bajo.

El PASS anterior del criterio 4 queda invalidado como criterio completo.

### Causa de implementación confirmada
- `.b6-action-row` solo es `display:flex; gap:10px`;
- `.b6-action-row__btn` solo define `flex:1`;
- `.btn-start` global agrega `margin-top:10px`;
- `.btn-secondary` no;
- el label largo del primario puede wrappear en móvil;
- compartir `min-height:48px` no obliga a misma composición visual.

### REEMPLAZAR / ajustar localmente
Solo dentro de `.b6-action-row`:
- resetear márgenes heredados;
- usar grid de dos columnas iguales o flex realmente simétrico;
- misma altura exterior real;
- mismo padding vertical;
- alineación central;
- tipografía local que permita `ACEPTAR CORRECCIÓN` sin generar un botón visualmente más alto en ~390px;
- mantener aceptar primario y rechazar secundario;
- no cambiar el sistema global de botones.

No acortar el copy confirmado salvo imposibilidad real; preferir ajuste local de font-size/tracking/estructura.

### Criterio visual
A ~390×844:
- ambos botones comparten borde superior e inferior;
- ninguno parece de otro componente;
- `ACEPTAR CORRECCIÓN` no genera mayor altura exterior que `RECHAZAR`.

---

## 5 — Reportar un error

### Evidencia
h16: PASS VISUAL real después del override local.

### Estado Central
**PASS PREVIO REAL, PERO REVISAR REGRESIÓN en el nuevo deploy.**

No modificar salvo que los cambios de h17 lo afecten.

---

## 6 — Identidad incorrecta continua

### Implementación
El código:
- pregunta `¿Seguro que no fue [Nombre]?`;
- ejecuta report;
- tras refresh abre `openIdentityResolveSheet`;
- ofrece `No sé · dejar Por identificar`;
- búsqueda usa patrón canónico.

### Evidencia visual
Solo la confirmación inicial fue observada; continuación completa no fue ejecutada para no tocar un partido real.

### Estado Central
**NO VERIFICABLE VISUALMENTE COMPLETO.**

Nuevo gate:
- usar fixture/caso QA seguro en Staging si puede crearse y limpiarse sin afectar datos de uso actual;
- si no, mantener NO VERIFICABLE;
- nunca declarar PASS visual solo por leer funciones.

---

## 7 — Patrón canónico de jugador

### Evidencia
Matu observado coherente entre Buscar y Perfil público.

### Estado Central
**PASS VISUAL REAL PREVIO.**

Nuevo gate debe hacer una comprobación rápida de no regresión en al menos dos superficies server-backed. No reabrir arquitectura.

---

## 8 — Mi Perfil > Jugadores

### Evidencia
Buscador/listado/búsqueda global en mismo panel observados.

### Estado Central
**PASS VISUAL REAL PREVIO.**

Nuevo gate: smoke visual corto para asegurar no regresión; no repetir investigación.

---

## 9 — Cargar partido / metadata

### Evidencia
Desktop real: orden correcto.
Móvil real: no validado internamente.

### Estado Central
**NO CERRADO VISUALMENTE EN MÓVIL.**

Nuevo gate debe comprobar 390×844 y desktop:
1. header;
2. metadata;
3. Equipo A;
4. Equipo B;
5. sets;
sin solapamiento/duplicación.

---

## 10 — sync_pending / necesita_revision

### Implementación
Código distingue ambos estados y preserva idempotencia/reintento con misma submissionId.

### Evidencia visual
No hubo estado real disponible.

### Estado Central
**NO VERIFICABLE VISUALMENTE.**

No fabricar PASS.

Para el nuevo gate:
- si existe una forma segura de crear un outbox QA descartable en Staging sin tocar datos reales ajenos, usarla y limpiar;
- si no, registrar NO VERIFICABLE con causa;
- no cambiar backend/offline solo para producir una captura.

---

## 11 — Notificaciones

### Evidencia
Lenguaje humano + actor/contexto/score observado en Staging.

### Estado Central
**PASS VISUAL REAL PREVIO.**

Nuevo gate: smoke visual corto de no regresión.

---

# 2. Dirección visual final confirmada por Sebastián para h17

Después de §15.36, Sebastián revisó directamente h16 en iPhone y aportó capturas + dirección visual concreta. Esta sección REEMPLAZA cualquier ambigüedad previa sobre cómo deben resolverse los criterios 2 y 4.

## A. Home — Último partido con corrección

La composición deseada es explícita:

### Renglón 1
- izquierda: `ÚLTIMO PARTIDO`;
- derecha: fecha/hora.

### Renglón 2
- izquierda: forma reciente (puntitos) + `VICTORIA` / `DERROTA`;
- derecha: `CORRECCIÓN PENDIENTE`.

### Tratamiento del estado
- `CORRECCIÓN PENDIENTE` debe ser texto/label ámbar discreto;
- **sin cápsula/píldora/contenedor visual propio**;
- alineado a la derecha debajo de la fecha/hora;
- no puede aumentar el alto del renglón ni mover forma/VICTORIA;
- no wrappear en dos líneas en móvil de referencia;
- no competir con score ni con resultado deportivo.

La tarjeta puede conservar el acento/borde ámbar general para indicar que el partido tiene una novedad pendiente.

**Aceptar solo si:** visualmente se leen dos renglones paralelos y estables; activar/desactivar la corrección no desplaza el segundo renglón.

## B. Resumen — bloque de corrección como una sola unidad

La captura física h16 muestra demasiadas piezas sueltas y texto redundante.

### ELIMINAR
- el texto blanco introductorio: `Esteban propuso una corrección del resultado.`;
- el diff técnico gris: `Set 2: 6–0 → 6–4` (y equivalentes).

La explicación humana ya cumple esa función:
- ejemplo válido: `Esteban indica que el segundo set fue 6–4, no 6–0.`

No mostrar simultáneamente explicación humana + diff técnico si ambos dicen lo mismo.

### CONSERVAR / REFORZAR
- rótulo amarillo `CORRECCIÓN PROPUESTA POR [NOMBRE]`;
- resultado propuesto completo;
- explicación humana;
- acciones de aceptar/rechazar.

### AGRUPAR
Todo lo que pertenece a la propuesta debe sentirse como **una misma unidad visual**:
1. rótulo de corrección;
2. tarjeta/grilla del resultado propuesto;
3. explicación humana;
4. acciones.

No deben parecer cuatro fragmentos independientes flotando en la pantalla.

Dirección visual:
- usar un contenedor/sección cohesiva de corrección;
- el resultado propuesto puede usar borde/acento ámbar para reforzar que es la propuesta;
- mantener la grilla canónica;
- no convertir todo en una caja pesada dentro de otra caja;
- `Reportar un error` queda FUERA de esta unidad: sigue siendo una acción secundaria global del partido, no parte de aceptar/rechazar la propuesta.

## C. Acciones Aceptar / Rechazar — decisión móvil cerrada

En móvil, dejar de intentar resolver los dos botones lado a lado.

### Móvil
- `ACEPTAR CORRECCIÓN`: ancho completo;
- `RECHAZAR`: ancho completo debajo;
- misma altura base, mismo radio y composición;
- aceptar sigue siendo primario lima;
- rechazar sigue siendo secundario;
- sin wrap problemático;
- separación vertical corta y consistente.

### Desktop
Puede conservar disposición horizontal si:
- ambos tienen exactamente la misma altura/composición;
- el texto no wrappea;
- se ve equilibrado.

Si no, usar también vertical. No forzar horizontal solo por aprovechar ancho.

## D. Reportar un error

No reabrir su copy ni tratamiento: h16 ya dio PASS visual real.

Debe permanecer:
- `Reportar un error` en sentence case;
- secundario;
- rojo suave;
- separado conceptualmente de la unidad de corrección.

## E. Mis grupos — IDEA CONFIRMADA, FUERA DE h17

La pantalla vacía actual (`Todavía no creaste ningún grupo` + CTA) se siente insuficiente.

Dirección futura:
- crear una bienvenida/estado cero más explicativo;
- contar en lenguaje simple para qué sirven los grupos;
- explicar que permiten competir con amigos habituales;
- explicar de forma breve cómo se suman puntos;
- conservar CTA claro `Crear grupo`.

**NO IMPLEMENTAR EN h17.** Mis grupos sigue fuera de alcance de esta ronda y queda registrado para el próximo bloque UX específico.

---

# 2.1 Ronda única de implementación h17

Claude debe implementar únicamente las correcciones directamente ligadas a los FAIL de §15.36 y a la dirección visual final anterior:

### A. Último partido
- recomponer los dos renglones exactamente como se define arriba;
- retirar la cápsula de `CORRECCIÓN PENDIENTE`;
- garantizar invariancia geométrica;
- no tocar lógica de resultado/corrección.

### B. Bloque de corrección
- retirar copy blanco redundante;
- retirar diff técnico gris redundante;
- agrupar rótulo + propuesta + explicación + acciones como una misma unidad visual;
- dar acento/borde ámbar a la propuesta sin sobrecargar;
- conservar semántica oficial/propuesta vigente.

### C. Aceptar/Rechazar
- móvil: apilados verticalmente, full width;
- desktop: horizontal solo si queda realmente parejo;
- eliminar asimetrías heredadas de `.btn-start`;
- no tocar sistema global de botones.

No tocar los otros criterios salvo regresión causada por A/B/C.

---

# 3. Pruebas técnicas h17

Tests técnicos necesarios, pero NO suficientes para PASS visual:

- markup/estructura de Último partido normal vs corrección;
- ausencia de pill pesada específica para `CORRECCIÓN PENDIENTE`;
- status slot/áreas presentes en ambos estados;
- acción row sin margen asimétrico;
- móvil: botones apilados verticalmente y full width;
- desktop: paridad real si se usa layout horizontal;
- ausencia del texto blanco redundante de propuesta;
- ausencia del diff técnico redundante;
- presencia de una única unidad visual cohesiva para la corrección;
- bundle/cache quartet;
- suite Node completa;
- `tests.html`;
- smoke boot;
- regresión h15 runtime;
- regresión h16 Reportar un error.

Objetivo de bundle: **`04.11-h17`**.

---

# 4. Gate visual Central obligatorio después de Claude

Claude NO declara apto.

Después del deploy h17, Central/Work debe revisar los 11 criterios del 45 y registrar exactamente:

- `PASS VISUAL`;
- `FAIL VISUAL`;
- `NO VERIFICABLE`.

## Evidencia mínima por tipo

### Criterios 2 y 4
Obligatoriamente:
- viewport móvil real/simulado por navegador a ~390×844;
- captura/inspección visual de composición;
- no aceptar CSS/DOM como único argumento.

### Criterios 3 y 9
Necesitan móvil + desktop.

### Criterios 1, 6 y 10
Si no existe estado accesible seguro:
- NO VERIFICABLE;
- no inferir PASS.

### Criterios 5, 7, 8 y 11
Smoke visual real de no regresión.

---

# 5. NO TOCAR

- main;
- Production;
- BRAMUlive;
- Mis grupos (la idea de nueva bienvenida queda documentada para una ronda futura, no se implementa acá);
- backend;
- Supabase/migraciones;
- fórmula de Nivel;
- Ranking;
- Intelligence;
- self-healing;
- editor funcional de sets;
- semántica oficial/propuesta;
- outbox/idempotencia;
- decisiones cerradas fuera de §15.36.

---

# 6. Entrega de Claude

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/54_Resultado_Correccion_Regresiones_Visuales_h17_27SEP.md`

Debe:
- explicar causa real de los dos FAIL;
- listar cambios exactos;
- tests;
- bundle/commit/deploy;
- NO declarar PASS visual;
- terminar con:

`PENDIENTE DE GATE CENTRAL VISUAL 1–11`

---

# 7. Regla de retorno

**Sebastián NO vuelve al Laboratorio físico** hasta que Central termine el gate posterior a h17.

Si quedan NO VERIFICABLE:
- se documentan como tales;
- Central decide explícitamente si bloquean o si requieren fixture QA interno;
- nunca se disfrazan de PASS.


---

# 8. Regla de traducción visual para esta ronda

Las capturas y explicaciones directas de Sebastián que originaron esta actualización son la referencia de intención visual.

Claude no debe reinterpretar:
- `CORRECCIÓN PENDIENTE` como badge/pill;
- la pareja Aceptar/Rechazar como obligación de layout horizontal en móvil;
- el diff técnico como requisito de trazabilidad visible;
- `Esteban propuso una corrección del resultado` como texto obligatorio.

Si una decisión del código/documentación anterior contradice esta sección, prevalece esta dirección visual confirmada.
