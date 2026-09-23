# Backend Bloque 8 — Handoff QA real Fase D — ChatGPT Work

**Fecha:** 23/09/2026  
**Entorno:** BRAMUlab Staging / Preview  
**Estado previo:** validación técnica PASS; migración aplicada y Edge Function activa.  
**Documento técnico previo:** `21_Validacion_Tecnica_Fase_D_Staging.md`.

## Objetivo

Obtener la evidencia manual/visual mínima y única que falta para cerrar **Fase D — Plantillas y UX** de BRAMU Intelligence.

No desarrollar. No modificar código. No tocar Supabase manualmente. No tocar main/Production/BRAMUlive.

## 1. Antes de empezar

1. Abrir el Preview vigente de BRAMUlab asociado a `staging`.
2. Confirmar que el bundle visible es **04.10-h23**.
3. Si ya existe una sesión válida de Staging, usarla.
4. Si la sesión expiró, pedir a Sebastián únicamente que inicie sesión manualmente en el navegador. No pedir contraseña, OTP ni secretos en el chat.

No repetir QA de Ranking ni otras secciones.

## 2. Crear UN solo partido de QA por el flujo real

Staging parte con 0 partidos.

Usar el usuario autenticado como participante y seleccionar otros 3 jugadores **ya existentes** de Staging.

No crear cuentas nuevas.

Cargar un partido ya jugado, simple:

- formato clásico;
- marcador: **6–3 / 6–4**;
- fecha válida dentro de la ventana permitida;
- sin datos extra innecesarios.

No hace falta validar el partido desde otra cuenta para esta QA: Intelligence personal debe poder operar sobre historia personal registrada aunque el impacto oficial todavía no exista.

Crear **un solo partido**. No generar una batería de fixtures.

## 3. Abrir Resumen y validar BRAMU Intelligence

Después de guardar, abrir el Resumen canónico de ese partido.

Validar:

### A. Carga

- aparece la tarjeta **BRAMU INTELLIGENCE** debajo del bloque de resultado/acciones;
- no queda spinner/cargando infinito;
- no aparece error genérico de backend si la request fue exitosa;
- no aparece el viejo texto legacy de `f.intelligence` / `generateManualIntelligence` como supuesto V1.

### B. Contenido esperado para primer partido

Como Staging parte de 0 partidos, la salida debe ser coherente con una primera historia BRAMU.

Aceptar variantes determinísticas del motor, pero verificar:

- 1 principal como máximo;
- hasta 2 secundarios;
- ningún dato inventado;
- nombres solo de jugadores realmente seleccionados;
- no afirmar Nivel/Ranking todavía;
- no afirmar emociones, técnica, causalidad ni desarrollo game a game.

Registrar **texto visible exacto** de principal y secundarios.

### C. “Por qué aparece”

Abrir el desplegable de evidencia.

Verificar:

- explicación legible y factual;
- no expone UUIDs/IDs técnicos;
- no muestra nombres de tablas/RPCs;
- no muestra score interno de relevancia;
- no muestra `reasonCodes`;
- el alcance personal/oficial está expresado honestamente cuando corresponde.

Registrar texto visible exacto.

### D. Idempotencia visual

1. cerrar el Resumen;
2. volver a abrir el mismo partido;
3. recargar la página una vez si es razonable;
4. volver a abrir el mismo Resumen.

Confirmar que:

- principal/secundarios siguen siendo exactamente los mismos;
- `templateId` no se manifiesta como cambio de copy;
- no aparece una frase distinta solo por reabrir;
- no se duplica la tarjeta.

### E. Navegación / async

- salir del Resumen y volver;
- confirmar que ninguna respuesta tardía pinta Intelligence sobre otra vista;
- cerrar/abrir “Por qué aparece” sin romper layout.

## 4. Consola / red

Inspeccionar solo lo necesario.

Buscar:

- request a `get-match-intelligence`;
- HTTP exitoso en el camino real;
- ausencia de 401/403/404/500 originados por BRAMUlab en esa request;
- ausencia de errores JS de BRAMUlab relacionados con Intelligence.

Ignorar ruido de extensiones/navegador.

Si es posible sin trabajo excesivo, registrar el `matchId` real de QA desde la request/response o el estado de la app. No exponer tokens ni headers de autorización.

## 5. No limpiar el partido todavía

Dejar el único partido de QA en Staging.

ChatGPT central decidirá después si conservarlo para las siguientes pruebas o limpiarlo, evitando borrar datos desde el navegador sin revisar dependencias.

## 6. Criterio de PASS

Fase D browser QA = PASS si:

- Preview correcto;
- partido creado por flujo real;
- Intelligence V1 carga;
- contenido coherente y factual;
- evidencia desplegable correcta;
- idempotencia visible al reabrir;
- sin legacy mezclado;
- sin error funcional de red/JS;
- solo un partido de QA creado.

## 7. Entrega

Guardar el resultado en:

`docs/BRAMUlab/Implementacion/Backend/Bloque_08/23_Resultado_QA_Fase_D_Work.md`

Debe incluir:

- Preview/HEAD/bundle observado;
- PASS/FAIL por A–E;
- texto exacto visible de Intelligence;
- texto exacto de “Por qué aparece”;
- matchId si pudo obtenerse sin exponer secretos;
- cualquier error funcional real;
- conclusión final exacta:
  - `FASE D QA PASS — APTA PARA CIERRE`
  - o `FASE D QA FAIL — BLOQUEO: ...`

No modificar código ni documentación maestra.
