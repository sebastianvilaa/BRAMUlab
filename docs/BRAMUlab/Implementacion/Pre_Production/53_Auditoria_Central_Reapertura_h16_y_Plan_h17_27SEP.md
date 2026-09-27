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

# 2. Ronda única de implementación h17

Claude debe corregir SOLO los dos FAIL confirmados:

### A. Último partido
- reemplazar el status/pill actual por composición que garantice invariancia visual;
- status ámbar discreto;
- no mover forma/VICTORIA;
- no tocar lógica de resultado/corrección.

### B. Aceptar/Rechazar
- eliminar asimetría heredada de `.btn-start`;
- evitar wrap que aumente altura exterior;
- misma composición/altura real;
- solo scope local.

No tocar los otros criterios salvo regresión causada por A/B.

---

# 3. Pruebas técnicas h17

Tests técnicos necesarios, pero NO suficientes para PASS visual:

- markup/estructura de Último partido normal vs corrección;
- ausencia de pill pesada específica para `CORRECCIÓN PENDIENTE`;
- status slot/áreas presentes en ambos estados;
- acción row sin margen asimétrico;
- dos botones en estructura simétrica;
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
- Mis grupos;
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
