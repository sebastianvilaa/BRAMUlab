# Nivel BRAMU V1.5 — Estado de implementación

**Estado:** motor de partidos V1.0 + estimador inicial V1.1 implementados y testeados localmente hasta **BRAMUlab V04.10**.  
**Versión del motor:** `nivel_bramu_v1_0`.  
**Versión del cuestionario:** `nivel_inicial_v1_1`.  
**Baseline de cierre de Nivel V04.10:** **1400/1400 tests**.  
**Actualización:** 17 de septiembre de 2026.

Este documento reemplaza el handoff previo de implementación que describía trabajo todavía pendiente. Ese handoff histórico se conserva en `Archivo/Nivel_BRAMU/`.

---

## 1. Autoridad documental

Para Nivel BRAMU rige esta precedencia:

1. `Nivel_BRAMU_Formula_V1.5.md` — fórmula normativa vigente, parámetros, fixtures y estimador inicial.
2. `Nivel_BRAMU_Implementacion.md` — este documento; estado técnico actual y límites de implementación.
3. `Nivel_BRAMU.md` — contexto funcional, estados y experiencia de producto.
4. `Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md` — trazabilidad de qué se implementó realmente en cada ronda.

`Nivel_BRAMU_Formula_V1.4.md` es antecedente histórico en `Archivo/Nivel_BRAMU/`. V1.5 conserva el motor `nivel_bramu_v1_0` y reemplaza la estimación inicial por `nivel_inicial_v1_1`.

Ante una contradicción matemática manda V1.5. Desarrollo no debe rediseñar la fórmula por interpretación.

---

## 2. Qué ya está implementado

### Motor puro

Implementado en módulos separados de UI:

- cálculo de Nivel y confianza;
- nivel efectivo;
- fuerza de pareja;
- expectativa;
- factores y deltas;
- precisión interna y redondeo público;
- snapshots y salida auditable;
- `reasonCodes`;
- límites/clamps y comportamiento determinístico.

El motor continúa identificado como `nivel_bramu_v1_0`.

### Elegibilidad y calidad de evidencia

Implementado y testeado:

- partidos computables / pendientes / excluidos / corregidos / anulados / duplicados dentro del contexto local de Nivel;
- invitados e imputación neutral;
- disponibilidad 1.00 / 0.80 / 0.60 según participantes conocidos;
- repetición de rivales;
- compañero repetido;
- círculo competitivo cerrado;
- diversidad de rivales;
- reglas de calibración/recalibración definidas por V1.

### Estimador inicial V1.1

Implementado:

- camino completo;
- camino rápido;
- anclas técnicas V1.1;
- antigüedad/frecuencia como contexto de confianza y no como capacidad directa;
- pregunta competitiva contextual;
- pregunta final de categoría;
- mapa local versionado;
- ajuste automático máximo ±0,5;
- sin stepper manual;
- confianza de origen;
- detección de incoherencia;
- `questionnaireVersion = nivel_inicial_v1_1`;
- trazabilidad del origen del Nivel.

### UX integrada

Hasta V04.10 se implementó y refinó:

- onboarding de Nivel;
- estado `PENDIENTE` antes de confirmar;
- estado `CALIBRANDO` después de confirmar;
- Nivel visible con un decimal;
- medidor 1–10;
- pregunta final de categoría;
- coherencia/revisión de respuestas;
- Player Card / Home;
- Mi Perfil;
- Perfil público;
- progreso de calibración;
- herramientas mínimas de laboratorio para repetir onboarding/resetear Nivel.

La implementación real, ronda por ronda, está documentada en `Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md`.

---

## 3. Qué NO significa “implementado” todavía

Nivel V1 todavía no es una funcionalidad productiva multiusuario completa.

**Actualización Backend Bloque 3 (19/09/2026, implementado, pendiente de validación en Staging):** la estimación INICIAL (cuestionario rápido/completo + ajuste por categoría) ya tiene autenticación real, persistencia server-side (`level_states`/`level_events`) y autoridad server-side para ese cálculo puntual — ejecutada por la Edge Function `officialize-onboarding` sobre el mismo motor JS compartido, nunca reimplementada en SQL ni confiada al navegador. Ver `Backend_Infraestructura.md` §15 Bloque 3 y `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`.

Sigue faltando la infraestructura real para que el Nivel opere con autoridad compartida a lo largo de TODO su ciclo de vida (no solo la estimación inicial):

- validación de partidos entre rivales;
- participantes compartidos con identidad real/provisional;
- actualización de Nivel partido a partido (`match_level_results`, Bloques 5/6) con idempotencia distribuida;
- correcciones/anulaciones oficiales que reprocesen Nivel;
- sincronización multiusuario del historial de partidos;
- métricas reales de distribución/deriva.

Estas dependencias pertenecen a `Backend_Infraestructura.md` (Bloques 4 en adelante). No requieren rediseñar la fórmula de Nivel.

---

## 4. Contrato técnico que debe preservarse

Cuando Nivel se integre con backend real:

- el cálculo sigue siendo puro, determinista y versionado;
- UI no duplica reglas matemáticas;
- servidor es autoridad para operaciones oficiales;
- cada actualización guarda snapshots suficientes para reconstruir el cálculo;
- no se recalcula silenciosamente el historial con niveles actuales;
- correcciones y anulaciones deben ser idempotentes;
- si una revisión oficial de un partido ya computado cambia datos usados por Nivel, Backend debe mantener consistencia mediante reversión/reproceso determinista desde el punto necesario, sin cambiar la fórmula ni reescribir rankings ya publicados;
- un cambio de fórmula exige una nueva versión explícita;
- la precisión interna se conserva separada del valor público;
- Ranking consume Nivel consolidado; nunca calcula Nivel por su cuenta;
- BRAMU Intelligence consume snapshots/códigos guardados; nunca recalcula la expectativa histórica con niveles actuales.

---

## 5. Estados vigentes

### Sin estimación / PENDIENTE

No confirmó todavía el cuestionario/camino rápido. No mostrar un Nivel inventado.

### CALIBRANDO

Comienza al confirmar el punto de partida. Se muestra el Nivel estimado y progreso de calibración.

Para consolidar se requieren simultáneamente:

- 5 partidos computables;
- al menos 3 rivales distintos.

### CALIBRADO

Existe evidencia mínima suficiente. El Nivel sigue evolucionando; “calibrado” no significa permanente.

### RECALIBRANDO

Mantiene el último consolidado válido para usos oficiales hasta completar la recalibración según V1.5.

---

## 6. Fixtures de referencia V1.1

Cuestionario completo, tolerancia interna ±0,01:

- Esteban → 6,11
- Seba → 5,69
- Lucho → 4,75
- Agustín → 2,05

Camino rápido + categoría:

- Esteban → 5,92
- Seba → 5,50
- Lucho → 4,50
- Agustín → 2,00

La batería completa incluye además estrés, coherencia, límites ±0,5, categoría ausente/no soportada, redondeo y no regresión del motor.

Baseline al cierre de V04.10: **1400/1400**.

---

## 7. Estado de V04.10

V04.10 es el cierre local/producto/UX de esta línea antes de la integración productiva con backend.

El tramo V04.9–V04.10 cerró principalmente:

- pulido del onboarding/perfil;
- legibilidad del cuestionario;
- medidor sin marcador blanco redundante;
- jerarquía del número/categoría;
- representación de `CALIBRANDO` sin romper la tarjeta clásica;
- consistencia Home / Mi Perfil;
- `PENDIENTE` correcto en perfil público antes de confirmar Nivel.

No modificó la Fórmula V1.5 ni el motor `nivel_bramu_v1_0` en su lógica normativa.

---

## 8. Próxima etapa correcta

No repetir Etapas A/B/C ni volver a implementar el cuestionario.

Antes de agregar más funciones de Nivel:

1. mantener tests verdes;
2. integrar Nivel con el backend real siguiendo `Backend_Infraestructura.md`;
3. usar el piloto real para validar comprensión y distribución del Nivel;
4. recién con datos reales evaluar ajustes de parámetros/anclas como una nueva versión explícita.

No hay una “Etapa C pendiente” en este documento: el estimador V1.1 ya fue implementado.

---

## 9. Definición de listo para piloto

Nivel BRAMU puede considerarse listo para un piloto controlado cuando:

- V04.10 permanece como cierre visual/UX local;
- 1400/1400 tests de cierre de Nivel permanecen verdes;
- ambos caminos de onboarding producen valores coherentes con fixtures;
- PENDIENTE/CALIBRANDO/CALIBRADO se representan consistentemente;
- no hay migraciones silenciosas desde estados viejos;
- el usuario entiende que el número inicial es un punto de partida;
- el producto registra suficiente trazabilidad para diagnosticar casos reales.

La activación pública productiva multiusuario depende además del backend real y validación de partidos.
