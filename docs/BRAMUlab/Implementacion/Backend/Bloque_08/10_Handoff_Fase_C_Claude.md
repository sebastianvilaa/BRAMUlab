# Backend Bloque 8 — Handoff Fase C: Relevancia y memoria editorial

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Fase A y Fase B CERRADAS en Staging.  
**HEAD funcional de Fase B:** `d4923d0f30a0b0bf0aac90fd3c59fdccc5943f01`.  
**Objetivo de esta ronda:** implementar únicamente **C — Relevancia y memoria editorial**.

## 1. Lectura obligatoria

Leer completo, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Implementacion/Backend/Bloque_08/09_Validacion_Central_Fase_B.md`
4. `docs/BRAMUlab/BRAMU_Intelligence.md` — especialmente §§6 y 7
5. `docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md`

Consultar código cerrado solo donde haga falta consumir su API:

- `bramulab/intelligence-context.js` — Fase A;
- `bramulab/intelligence-claims.js` — Fase B.

No reabrir A/B salvo regresión concreta.

## 2. Alcance exacto de Fase C

Construir la capa determinística que toma los claims estructurados de Fase B y decide cuáles merecen aparecer.

Debe resolver:

- puntaje de relevancia V1;
- descarte por umbral;
- prioridad editorial;
- deduplicación semántica / “misma historia”;
- selección de 1 principal + hasta 2 secundarios;
- diversidad entre familias/historias;
- cooldowns editoriales;
- abstención;
- contrato de memoria editorial por jugador;
- salida estructurada y auditable, lista para que Fase D redacte/presente sin recalcular evidencia.

No debe redactar frases finales ni tocar UI.

## 3. Parámetros V1 ya cerrados

Fuente: `BRAMU_Intelligence.md` §§6–7.

### Puntaje

Máximo 100:

- cambio o excepcionalidad: 25;
- relevancia personal: 20;
- especificidad relacional: 15;
- confianza de evidencia: 20;
- actualidad narrativa: 10;
- novedad editorial: 10.

Penalizaciones cerradas:

- −30 si repite el score visible sin comparación;
- −20 si otro candidato seleccionado ya cuenta la misma historia;
- −15 si la misma familia fue insight principal en los últimos 2 partidos;
- −10 si reutiliza la misma plantilla exacta de los últimos 5.

Umbral de publicación:

- **55/100**.

### Prioridad ante empate/cercanía

1. hito excepcional o quiebre de tendencia;
2. resultado por encima/debajo de expectativa confiable de Nivel;
3. récord o mejor marca personal;
4. historia específica con compañero/rival/cruce;
5. racha o cambio material de forma;
6. patrón histórico de score;
7. lectura particular del resultado actual;
8. descripción genérica del score.

En esta Fase C todavía no existen claims de Nivel/Ranking de Familia H; el orden debe admitirlos en el futuro sin implementarlos ahora.

### Selección

- máximo 1 principal;
- hasta 2 secundarios;
- secundarios solo si también superan 55;
- familias diferentes;
- historias semánticamente distintas;
- no completar lugares por obligación;
- si no queda candidato válido: abstención / estado de aprendizaje que Fase D resolverá visualmente.

### Cooldowns / memoria

- misma familia como principal: penalización durante 2 partidos;
- mismo hecho relacional: no repetir hasta que cambie el balance o pasen 4 partidos;
- mismo hito: una sola aparición;
- misma plantilla exacta: no reutilizar en los siguientes 5 partidos;
- racha: mostrar al llegar a 3, al igualar récord, al superarlo y al terminar; no necesariamente en cada extensión.

Memoria mínima por jugador:

- familia del principal de los últimos 5 partidos;
- identificador semántico de cada insight mostrado;
- plantilla usada, cuando exista desde Fase D;
- entidades protagonistas;
- fecha/partido de última aparición;
- valor anterior mostrado para detectar cambio material.

## 4. Contrato técnico recomendado

Preferir una solución simple y separada, por ejemplo un módulo puro:

`bramulab/intelligence-editorial.js`

que consuma:

- claims de `PLIntelligenceClaims`;
- contexto mínimo del partido;
- snapshot de memoria editorial previa;

y devuelva un objeto determinístico tipo:

- candidatos evaluados con score bruto, penalizaciones, score final y razones;
- descartes editoriales;
- `principal`;
- `secondary[]`;
- decisión de abstención;
- actualización de memoria propuesta;
- versión de reglas editoriales.

El nombre/forma exacta puede ajustarse si el repo sugiere una solución más coherente, pero mantener esta separación conceptual.

No persistir texto final: Fase D todavía no existe.

## 5. Persistencia: evitar sobrearquitectura

La fuente exige que la decisión pueda reconstruirse y que exista memoria editorial real.

En esta ronda:

1. primero construir y probar el motor puro de selección/memoria;
2. revisar qué persistencia mínima será realmente necesaria para D;
3. **no crear tablas/RPCs solo por anticipación** si aún no hay un consumidor que guarde/muestre la salida;
4. si la persistencia es imprescindible para cerrar C, documentar exactamente por qué y agregar solo el contrato mínimo;
5. si puede diferirse limpiamente a la integración de D, dejar el objeto de memoria listo para persistir y explicarlo en el informe.

No duplicar datos de Partidos, Nivel o Ranking.

## 6. Puntos donde NO se puede inventar silenciosamente

Los pesos máximos están cerrados, pero la fuente no especifica necesariamente una fórmula numérica exhaustiva para convertir cada subtipo de claim en cada subpuntaje.

Regla:

- reutilizar criterios explícitos de la fuente;
- parametrizar decisiones;
- no esconder heurísticas nuevas como si estuvieran documentadas;
- si para cerrar una selección visible hace falta una decisión de producto que la fuente no define, marcarla como `DECISIÓN ABIERTA`;
- continuar todo lo que no dependa de esa decisión.

### Forma reciente

Fase B ya cerró:

- <5 decididos: no hay forma de 5 válida;
- con 5: existe primera lectura de forma;
- con 6+: existe ventana móvil previa;
- con exactamente 5, la ventana previa tiene menos de 5 y no debe compararse como equivalente.

La fuente dice que “mejoró/empeoró” exige una diferencia **material**, pero no fija el umbral numérico.

No inventar ese umbral silenciosamente.

Puede:

- mantener el claim factual de balance exacto;
- abstenerse de asignar semántica de mejora/empeora hasta tener regla material;
- marcar `DECISIÓN ABIERTA` si la selección final depende de fijar ese umbral.

## 7. Semántica / deduplicación

Debe impedir ejemplos como:

- “racha de 4 victorias” + “4 victorias en los últimos 4/5” como dos historias distintas;
- “primer partido con X” + “compañero nuevo X” como dos conclusiones simultáneas si cuentan lo mismo;
- múltiples scopes del mismo rival/cruce cuando narrativamente responden la misma pregunta.

La deduplicación debe ser por `semanticKey`/historia, no por coincidencia de texto.

Un ID estable solo puede desempatar técnicamente; nunca debe decidir que una historia es más importante por sí mismo.

## 8. Plantillas todavía no existen

La penalización de −10 por misma plantilla forma parte del contrato global, pero Fase D asignará `templateId`.

En C:

- dejar soporte para recibir/aplicar memoria de plantilla cuando exista;
- no inventar IDs de plantillas finales;
- si el candidato todavía no tiene `templateId`, esa penalización específica no se aplica.

## 9. Pruebas mínimas de C

Agregar fixtures determinísticos que demuestren como mínimo:

1. candidato bajo 55 => no seleccionado;
2. candidato fuerte => principal;
3. máximo 1 principal + 2 secundarios;
4. secundarios de familias/historias distintas;
5. duplicado semántico penalizado/descartado;
6. misma familia principal en últimos 2 partidos => −15;
7. hecho relacional sin cambio antes de 4 partidos => cooldown;
8. hecho relacional con balance cambiado => puede reaparecer;
9. mismo hito no vuelve a aparecer;
10. racha no se publica automáticamente en cada extensión;
11. empate de score usa prioridad editorial + ID estable, nunca azar;
12. memoria vacía vs. memoria previa produce salida determinística;
13. ningún candidato descartado por Fase B puede ser revivido por C;
14. sin candidatos >55 => abstención;
15. forma reciente con ventana previa incompleta no se convierte en “mejoró/empeoró”;
16. preservar criterio absoluto: 0 claims nuevos, números o entidades inventadas.

Mantener verdes los tests A+B.

## 10. Restricciones

- NO Fase D.
- NO UI.
- NO plantillas finales.
- NO Fase E.
- NO integrar Nivel/Ranking todavía.
- NO Fase F/generativa.
- NO tocar main.
- NO tocar Production.
- NO tocar BRAMUlive.
- NO reabrir A/B salvo regresión concreta.
- NO tocar Supabase salvo que exista una necesidad mínima demostrable para cerrar C.
- NO hacer pushes intermedios.

## 11. Entrega

Al terminar:

1. documentar resultado dentro de `docs/BRAMUlab/Implementacion/Backend/Bloque_08/`;
2. indicar cualquier `DECISIÓN ABIERTA`;
3. ejecutar tests A+B+C;
4. revisar diff final;
5. hacer **un único commit/push lógico** a `origin/staging`;
6. dejar todo accesible remotamente;
7. NO avanzar a D.

La entrega no está terminada hasta el push.
