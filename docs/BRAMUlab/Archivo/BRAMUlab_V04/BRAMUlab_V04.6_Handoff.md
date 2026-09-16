# BRAMUlab V04.6 — Handoff de implementación

**Estado:** listo para implementación.  
**Base:** BRAMUlab V04.5 online, feature flag / modo laboratorio activo.  
**Baseline de tests:** 1338/1338.  
**Objetivo de la ronda:** sustituir de forma acotada el estimador inicial V1.4 por `nivel_inicial_v1_1`, integrar la nueva UX inmediata de Nivel y dejar V04.6 desplegada para revisión visual.

---

## 1. Fuentes vigentes

Para Nivel BRAMU, respetar esta precedencia:

1. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
2. `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
3. `docs/BRAMUlab/Nivel_BRAMU.md`
4. `docs/BRAMUlab/Nivel_BRAMU_Handoff_Cuestionario_V1.5.md`

Este handoff agrega únicamente decisiones de UX, laboratorio y operación para V04.6. No puede alterar la matemática normativa de V1.5.

`Nivel_BRAMU_Formula_V1.4.md` queda como antecedente histórico. No usar sus §§3.1–3.7 para altas nuevas.

---

## 2. Límites estrictos de la ronda

### CONSERVAR íntegramente

- `bramulab/level.js`
- motor `nivel_bramu_v1_0`
- `PARAMS` del motor de partidos
- expectativa, fuerza de pareja, deltas, margen, formatos, confianza por partidos
- invitados, disponibilidad, repetición, compañero, círculo competitivo e inactividad
- estados `CALIBRANDO` / `CALIBRADO`
- umbral 5 partidos computables + 3 rivales distintos
- recalibración vigente
- feature flag / modo preview
- historial y datos ficticios ya existentes

### NO TOCAR

- Ranking BRAMU
- BRAMU Intelligence
- Backend / autenticación real
- lógica competitiva posterior al nivel inicial
- migraciones productivas
- equivalencias universales rígidas entre categoría local y Nivel BRAMU

---

## 3. Estimador inicial V1.1

### REEMPLAZAR

- estimador inicial implementado en V04.3–V04.5 por `nivel_inicial_v1_1`
- cuestionario, cálculo y fixtures específicos V1.4
- fórmula anterior `Q = Σ(w×q)` / `1 + 7.5×Q` para altas nuevas
- stepper manual libre de ±0,5
- etiqueta superior `Competición` por `Profesional`
- copys antiguos de opciones rápidas por los definidos en V1.5

### AGREGAR

Persistir la trazabilidad definida por V1.5:

- `questionnaireVersion: 'nivel_inicial_v1_1'`
- `baseLevel`
- `technicalAnchor`
- `trainingModifier`
- `categoryContextKey`
- `declaredCategory`
- `competitionAnswer`
- `categoryReference`
- `categoryAdjustment`
- `confidenceOrigin`
- `coherenceFlag`

La confianza completa debe ser variable `0.12 / 0.15 / 0.18`.
Ante brecha de coherencia ≥ 2,0, ofrecer revisión y limitar confianza a `0.10` si el usuario confirma sin modificar sus respuestas.

---

## 4. Crear cuenta / perfil

### REEMPLAZAR

- Quitar **Categoría** del alta inicial. No deben existir dos categorías independientes.
- `TU PÁDEL` → `TU PERFIL`.
- `Tu jugador está listo` → `Tu perfil está listo`.
- Evitar lenguaje tipo “crear jugador” que suene a videojuego. Usar lenguaje de perfil/cuenta coherente con el flujo.

### MODIFICAR

- **Ubicación deja de ser opcional.**
- Eliminar `(opcional)` y exigir una ubicación válida antes de continuar.
- No resolver ahora mapas internacionales ni nuevos circuitos. La ubicación se guarda; si no existe un mapa de categoría compatible, la categoría no ajusta Nivel.
- Mantener el encabezado / marca BRAMU Lab y una estructura visual consistente durante el onboarding.
- Dar más aire superior a títulos y bloques. Corregir el amontonamiento detectado en mobile.

### NO CAMBIAR EN ESTA RONDA

- Género como dato de perfil. La futura rama competitiva del Ranking es un concepto separado y queda fuera de V04.6.

---

## 5. Elección del camino de Nivel

La pantalla debe mantener dos caminos.

### Orden

1. **Ayudame a calcularlo** — arriba y recomendado.
2. **Elegir mi nivel** — alternativa rápida.

### Copy

El camino completo debe comunicar **mayor precisión del punto de partida**, no “mejora tu Ranking” ni promete ventajas competitivas.

El camino rápido debe sentirse válido y útil, no una opción incorrecta. Su menor información ya se expresa matemáticamente con `confidence = 0.10`.

---

## 6. Categoría como último paso de ambos caminos

La categoría se pregunta **solo dentro de Nivel**, después de obtener una primera estimación.

Debe aplicarse tanto al camino completo como al rápido.

Pregunta normativa:

**Una última pregunta para afinar tu nivel**  
**¿En qué categoría suelen ser parejos tus partidos?**

Reglas:

- ninguna opción preseleccionada;
- ninguna categoría sugerida o destacada;
- incluir `No compito`;
- incluir `No estoy seguro`;
- si se elige una de esas dos, `categoryAdjustment = 0`;
- si el contexto no tiene mapa validado, guardar categoría pero aplicar ajuste `0`;
- ajuste automático máximo absoluto ±0,5;
- sin stepper manual adicional.

En camino rápido no inventar la pregunta competitiva que no se hizo. Aplicar la regla específica de V1.5.

---

## 7. Nueva pantalla de resultado / medidor

Esta UX forma parte de V04.6 porque reemplaza directamente el stepper retirado.

### Antes de responder categoría

Mostrar:

**Tu estimación inicial**

y un medidor visual.

### Medidor

Implementar un **semicírculo tipo velocímetro**:

- escala visual 1 → 10;
- aguja / indicador de posición;
- número BRAMU grande en el centro;
- categoría de comunicación debajo (`Intermedio`, `Intermedio alto`, etc.);
- diseño limpio, deportivo y legible en exterior;
- reutilizar el **azul existente del sistema BRAMU** como color principal del arco/indicador; no inventar una nueva paleta;
- reservar el lime principalmente para acciones/confirmación/estado activo;
- no usar gradiente “rojo = malo / verde = bueno”: el Nivel expresa categoría de juego, no una nota moral.

### Ajuste por categoría

La pregunta de categoría debe aparecer en la misma pantalla, debajo del medidor.

Al seleccionar categoría:

- recalcular mediante V1.5;
- si cambia el resultado, mover suavemente la aguja/indicador desde la estimación inicial al valor afinado;
- actualizar el número;
- el movimiento máximo visible es ±0,5;
- si la categoría no modifica el nivel, no inventar animación ni cambio ficticio.

Después del ajuste, el título/estado pasa a:

**Tu punto de partida en BRAMU**

CTA final:

**CONFIRMAR MI NIVEL**

No volver a ofrecer ajuste manual.

---

## 8. Coherencia

Cuando `coherenceFlag` corresponda, evitar lenguaje acusatorio.

Copy recomendado:

**Algunas respuestas describen niveles diferentes. ¿Querés revisarlas?**

Acciones:

- **Revisar respuestas**
- continuar/confirmar según lo definido por V1.5

No “castigar” automáticamente `mu`. La consecuencia matemática es la confianza de origen limitada cuando corresponde.

---

## 9. Responsive / superficies existentes

### Mobile first

Verificar manualmente al menos 375 px de ancho.

En la pantalla de resultado deben respirar correctamente:

- encabezado;
- medidor;
- número;
- categoría de comunicación;
- pregunta final;
- opciones de categoría;
- CTA.

### Home y Perfil

Corregir la tarjeta de Nivel que en V04.5 queda visualmente pobre/apretada en celular.

Requisitos:

- mismo valor en Home y Perfil;
- mismo estado `CALIBRANDO`;
- progreso coherente (`0/5` en una cuenta nueva);
- sin overflow, bloques partidos ni jerarquía visual rota en 375 px;
- no rediseñar otras tarjetas de Home/Perfil fuera de lo necesario.

---

## 10. Modo laboratorio

El ícono del matraz existente sigue siendo la puerta al modo laboratorio.

Agregar ayudas **mínimas**, sin construir un sistema de testing sofisticado.

### A. Crear usuario de prueba

Con laboratorio activo, ofrecer una acción discreta:

**Crear usuario de prueba**

Debe:

- crear un usuario local temporal con `userId` único;
- evitar mail/contraseña y validaciones de autenticación;
- entrar directamente al flujo de onboarding que queremos revisar;
- permitir repetir el recorrido muchas veces;
- permanecer aislado del comportamiento normal con laboratorio apagado.

No invertir tiempo en un sistema complejo de credenciales falsas.

### B. Resetear solo Nivel

Con laboratorio activo, permitir en una cuenta existente:

**Resetear Nivel BRAMU**

Debe borrar/resetear exclusivamente el estado/origen de Nivel necesario para volver a ejecutar el onboarding.

Debe **conservar**:

- historial de partidos;
- estadísticas;
- red;
- jugadores;
- grupos;
- cuenta/perfil;
- los partidos ficticios existentes del perfil principal de prueba.

Objetivo: poder volver a generar el Nivel con `nivel_inicial_v1_1` sin perder la base ficticia acumulada.

### Estados preview antiguos

No mezclar silenciosamente un origen V1.4 con `nivel_inicial_v1_1`.

Para cuentas de laboratorio, limpiar/resetear de manera explícita cuando sea necesario. No programar una migración productiva de datos ficticios.

---

## 11. Categoría / ubicación después de confirmar Nivel

Una edición posterior de ubicación o categoría **no recalcula retroactivamente** el nivel inicial confirmado.

El Nivel inicial es una fotografía de origen y después evoluciona por las reglas del motor.

Guardar el nuevo dato para uso futuro/recalibración cuando corresponda, pero no reescribir el historial ni `mu` silenciosamente.

No implementar FAQ ahora; registrar esta decisión para producto futuro.

---

## 12. Tests V1.1 obligatorios

Baseline previo: 1338/1338.

Reemplazar únicamente fixtures específicos del cuestionario V1.4 y agregar los casos V1.1.

Fixtures completos, tolerancia interna ±0,01:

- Esteban → 6,11
- Seba → 5,69
- Lucho → 4,75
- Agustín → 2,05

Camino rápido + categoría:

- Esteban → 5,92
- Seba → 5,50
- Lucho → 4,50
- Agustín → 2,00

Agregar también:

- ocho perfiles de estrés de V1.5 §3.8;
- incoherencia;
- límite ±0,5;
- `No compito`;
- `No estoy seguro`;
- contexto no soportado;
- redondeo público;
- persistencia de `questionnaireVersion`;
- no regresión de fixtures del motor de partidos;
- reset de Nivel en laboratorio preservando historial.

`level.js` y sus fixtures deben permanecer sin cambios funcionales.

---

## 13. Documentación V04

Durante esta ronda:

### ACTUALIZAR

`docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Consolidado.md`

Normalizar la precedencia de Nivel de V1.4 → V1.5 y reflejar que la Etapa C vigente usa `nivel_inicial_v1_1`, sin stepper manual.

No reescribir secciones históricas cerradas; agregar una nota de superación cuando corresponda.

### AGREGAR AL FINAL

`docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md`

Crear la sección V04.6 con:

- diagnóstico;
- archivos tocados;
- implementación real;
- tests;
- decisiones UX;
- riesgos/deuda;
- commit;
- push/deploy.

No reescribir V04.0–V04.5.

---

## 14. Versionado y cierre operativo

Esta ronda se llama exactamente:

**BRAMUlab V04.6**

No usar subversiones tipo `V04.5.1` o `V04.6.1`.

Si la implementación y el arnés quedan verdes:

1. bump completo de versión pública:
   - `APP_VERSION`
   - `version.json`
   - `sw.js` / cache name
   - queries `?v=` necesarias
2. commit;
3. push a `origin/main`;
4. verificar que el deployment online termine correctamente.

No dejar el push para una segunda ronda.

---

## 15. Ahorro de contexto / créditos de Cloud

- No releer V03.
- No repetir auditorías generales.
- No investigar nuevamente Nivel BRAMU.
- Leer completo el handoff V1.5 y este handoff V04.6.
- Consultar `Nivel_BRAMU_Formula_V1.5.md` solo donde haga falta para implementar §3 y fixtures relacionados.
- Inspeccionar de forma dirigida los archivos realmente afectados.
- Si el diagnóstico no detecta una contradicción real de producto, avanzar en la misma ronda sin pedir otra autorización.
- No hacer una ronda aparte para tests, otra para commit y otra para push.
- Informe final corto.

---

## 16. Gate de producto para revisión humana

V04.6 queda lista para revisión visual cuando:

- el arnés completo está verde;
- los perfiles V1.1 dan los valores aprobados;
- ambos caminos terminan en la misma pregunta final de categoría;
- ya no existe el stepper ±0,5;
- el medidor 1–10 se entiende sin explicación externa;
- mobile 375 px se ve correctamente;
- Home y Perfil coinciden;
- laboratorio permite repetir onboarding sin credenciales;
- reset de Nivel no borra historial;
- V04.6 está online y verificada.

Después de eso, Sebastián hará la revisión visual. No avanzar automáticamente a Ranking, Intelligence, Backend ni otra etapa.
