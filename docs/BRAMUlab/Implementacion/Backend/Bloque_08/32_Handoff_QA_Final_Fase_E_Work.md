# Backend Bloque 8 — Handoff QA final Fase E — ChatGPT Work

**Fecha:** 23/09/2026  
**Entorno:** BRAMUlab Staging / Preview  
**Objetivo:** cerrar la única evidencia manual pendiente de Fase E con el menor trabajo posible.

## 1. No investigar ni desarrollar

NO:

- modificar código;
- tocar Supabase manualmente;
- crear fixtures SQL;
- crear otro partido;
- repetir QA de Ranking/Bloques 1–7;
- tocar main/Production/BRAMUlive;
- hacer una auditoría visual general.

Leer solo:

`docs/BRAMUlab/Implementacion/Backend/Bloque_08/31_Validacion_Tecnica_Final_Fase_E.md`

## 2. Preview

Abrir el Preview vigente de `staging`.

Confirmar:

- bundle visible: **04.10-h26**;
- si puede obtenerse sin esfuerzo, HEAD servido: `ba3a0b9360e2e88730a0ab8a3a9532bb765293ec`.

Si no puede verificarse HEAD sin gastar tiempo, no bloquear: bundle h26 es suficiente para continuar.

## 3. Usar SOLO el partido existente

Match:

`4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`

Resultado cargado:

**6–3 / 6–4**

NO crear otro partido.

## 4. Paso A — creator, todavía pending

Con la cuenta creadora `sebastian`:

1. abrir el partido existente;
2. abrir su Resumen;
3. verificar que BRAMU Intelligence carga;
4. registrar el texto visible exacto;
5. confirmar que no aparece un claim oficial de Nivel fuerte mientras el partido sigue pendiente;
6. cerrar el Resumen.

No repetir aperturas innecesarias.

## 5. Paso B — validar por el flujo real

El partido está esperando acción del **equipo A**.

Participantes del equipo A:

- `sebastian test 2`;
- `sebastian test 3`.

Usar una sesión ya existente de una de esas cuentas si el navegador la tiene.

Si no existe sesión válida, pedirle a Sebastián **solo que inicie sesión manualmente en el navegador** con una de esas cuentas. No pedir ni recibir contraseña/OTP por chat.

Desde la UI real:

1. entrar al pendiente accionable;
2. confirmar la participación/resultado sin cambiar el partido;
3. seguir el flujo normal hasta que el partido quede validado/oficializado.

No usar SQL ni backend manual para forzar el estado.

Si la UI exige una acción adicional de otro participante para completar el flujo, seguir únicamente lo que la propia app solicite y pedir una nueva autenticación manual solo si realmente es imprescindible.

## 6. Paso C — volver al creator

Volver a la cuenta `sebastian`.

Abrir el mismo partido y su Resumen.

Validar:

- Intelligence carga sin error;
- ningún dato inventado;
- ningún claim fuerte de sorpresa/dificultad confiable: los cuatro Niveles de este fixture están CALIBRANDO;
- si aparece texto de Nivel/calibración, debe ser factual y del estilo:
  - `Este partido suma evidencia; tu Nivel BRAMU sigue calibrando.`
  - o evidencia limitada equivalente;
- nunca:
  - “resultado por encima de lo esperado”;
  - “batacazo”;
  - expectativa precisa presentada como confiable;
- el resto de las historias personales puede seguir apareciendo si editorialmente gana el score.

Registrar texto exacto visible y “Por qué aparece” si hay Familia H visible.

## 7. Paso D — idempotencia mínima

Cerrar el Resumen y abrirlo una vez más.

Confirmar:

- mismo texto;
- sin cambio aleatorio de template;
- sin tarjeta duplicada;
- sin error.

No hacer más reaperturas.

## 8. Paso E — Home / Ranking

Ir al Home una sola vez.

Confirmar que TU MOMENTO:

- no inventa un hito de Ranking en un universo insuficiente/sin edición apta;
- no muestra “subiste puestos por este partido”;
- no cambia Nivel/Ranking con causalidad falsa de un partido.

No intentar fabricar un hito semanal.

## 9. Consola/red

Solo si está disponible de forma rápida:

- `get-match-intelligence` debe responder 200;
- no debe haber 401/403/404/500 funcional en ese camino;
- ignorar ruido de extensiones.

## 10. Entrega

Guardar:

`docs/BRAMUlab/Implementacion/Backend/Bloque_08/33_Resultado_QA_Final_Fase_E_Work.md`

Incluir únicamente:

- bundle/HEAD observado;
- PASS/FAIL de A–E;
- texto exacto antes de validar;
- texto exacto después de validar;
- texto de “Por qué aparece” si apareció Nivel;
- si el match terminó realmente `validated`;
- errores funcionales reales, si hubo;
- conclusión exacta:
  - `FASE E QA PASS — APTA PARA CIERRE`
  - o `FASE E QA FAIL — BLOQUEO: ...`

No hacer trabajo adicional.
