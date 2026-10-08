# Cierre Central — Invitados / Identidad / Recuperación V04.29-h2

> **Nota de mantenimiento (08/10/2026):** los documentos intermedios que este texto cita por nombre (handoffs, validaciones, gates, revisiones y manifests) se retiraron del árbol activo al consolidarse; siguen en Git: `git log --diff-filter=D --name-only -- docs/BRAMUlab/Implementacion/` y `git show <commit>^:<ruta>`.

**Fecha:** 03/10/2026  
**Rama:** `staging`  
**HEAD funcional:** `50675a8331a12eb1db8f6ca4055097990d36d9df`  
**Versión:** BRAMUlab **V04.29** · bundle **04.29-h2**  
**Resultado:** **CERRADO EN STAGING / PASS CENTRAL**

## 1. Evidencia consolidada

Este cierre toma como evidencia acumulativa:

- `119_Resultado_Correccion_Gate_Invitados_V0429_h2_03OCT.md`: correcciones G3b y pruebas locales, incluida concurrencia real multi-conexión.
- `120_Gate_Central_Tecnico_Invitados_V0429_h2_03OCT.md`: PASS técnico de Central sobre Supabase Staging real, incluidos duplicados históricos con score distinto (aceptación y rechazo), contadores de Nivel y seguridad/ACL.
- `121_QA_Visual_Invitados_V0429_h2_03OCT.md`: PASS del flujo visual real sobre Staging para duplicado histórico con score distinto → SAME → corrección pendiente → rechazo desde la otra pareja → un único partido efectivo y sin corrección fantasma.

No se reabre ninguno de esos gates.

## 2. Decisión de Central sobre los límites del QA visual

El 121 dejó dos coberturas no observadas directamente durante ese recorrido:

1. inspección de consola/red del Cloud Browser;
2. ejecución específica en un dispositivo iPhone físico.

Central **acepta explícitamente esos límites como no bloqueantes para cerrar P0.4C en Staging**.

### Consola/red

No se afirma que el recorrido visual haya tenido consola limpia ni que se hayan inspeccionado todos los requests.

Sin embargo, para el riesgo concreto de esta ronda existe evidencia funcional suficiente e independiente:

- el gate 120 ejercitó el lifecycle real en Supabase Staging;
- el flujo visual completó la transición de estados desde la UI;
- después de la acción de la pareja contraria, el servidor quedó en `resolved_same`, secundario `annulled`, sin `pending_correction_revision_id`;
- Historial mostró `Pendientes 0` y un único partido efectivo;
- no apareció un fallo funcional durante el recorrido.

Por lo tanto, repetir todo el flujo únicamente para obtener una lectura de DevTools sería prueba redundante y no responde a un riesgo material nuevo.

### iPhone físico

No se atribuye el 121 a un iPhone físico. La evidencia visual sí cubrió un ancho de aplicación aproximado de **390 px**, con acciones, scores y metadatos legibles y sin solapamientos.

Este seam no incorpora API nativa ni comportamiento específico de dispositivo; reutiliza el flujo web ya existente de correcciones. El riesgo restante de Safari/iPhone es de compatibilidad general y puede quedar dentro de la QA integrada pre-Production, sin mantener abierta esta ronda específica.

## 3. Bloqueo de Cloud Browser

El error genérico de login / lag observado por Work se clasifica como **limitación del entorno de QA**, no como regresión demostrada de Invitados/Identidad/Recuperación.

No se abre un bug de producto por ese síntoma sin evidencia reproducible fuera de ese entorno.

## 4. Estado final

Queda **CERRADO EN STAGING** el alcance V04.29 de Invitados / Identidad / Recuperación:

- invitaciones y claim/recuperación;
- replay de evidencia de Nivel del jugador recuperado;
- Ranking publicado sin reescritura histórica;
- coherencia con Grupos e Intelligence;
- conflictos de identidad fail-closed;
- detección de duplicados;
- duplicados con mismo score;
- duplicados con score distinto y confirmación por la otra pareja;
- resolución histórica fuera de la ventana ordinaria de 3 días solo para origen duplicado;
- contadores de calibración coherentes;
- concurrencia protegida y unicidad defensiva;
- UX visual del flujo de score distinto.

**DECISIÓN ABIERTA:** ninguna.

## 5. No implica

Este cierre:

- **NO** autoriza tocar `main`;
- **NO** autoriza Production;
- **NO** toca BRAMUlive;
- **NO** exige repetir aceptación y rechazo visualmente;
- **NO** afirma que el 121 inspeccionó consola/red;
- **NO** afirma que el 121 se ejecutó en iPhone físico.

La ronda puede salir del listado de pendientes de P0.4C y continuar con los pendientes pre-Production reales.
