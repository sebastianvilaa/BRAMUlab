# BRAMUlab — Handoff ronda correctiva consolidada de Laboratorio h11

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Baseline física:** BRAMUlab V04.11 / bundle `04.11-h11`  
**Objetivo de salida:** una única ronda técnica consolidada, un único push/deploy intencional y devolución a Laboratorio sobre `04.11-h12` si no aparece un bloqueo real.

## 0. Forma de trabajo de esta ronda

Esta NO es una serie de mini-rondas.

Desarrollo debe:

1. leer las fuentes vigentes;
2. investigar primero las causas reales;
3. implementar toda la tanda compatible entre sí;
4. probar localmente antes del push;
5. revisar el diff completo;
6. hacer idealmente un único commit lógico;
7. push a `origin/staging`;
8. permitir un único deploy intencional de BRAMUlab;
9. dejar una batería física corta para Sebastián.

Si aparece una DECISIÓN ABIERTA humana real:
- documentarla;
- continuar todo lo demás;
- no frenar la ronda completa salvo dependencia estricta.

No pedirle a Sebastián comandos, navegación técnica ni pruebas intermedias.

## 1. Fuentes obligatorias

Leer primero, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`
4. `docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md`
   - especialmente §15.31
   - §15.32
   - §15.33
5. fuente maestra específica de cada sistema afectado:
   - `Experiencia_Inicial.md` para ciclo de partido/correcciones;
   - `Backend_Infraestructura.md` para identidad/partidos/validación;
   - `Nivel_BRAMU_*.md` solo si hace falta entender presentación de Nivel, NO para modificar fórmula.

No usar Archivo/Backup/handoffs históricos como autoridad salvo trazabilidad puntual.

## 2. Baseline que NO debe reabrirse

El hotfix de validación `04.11-h11` está verificado E2E real en Staging.

Partido de evidencia:

`aa41e8d9-6d16-4c47-8928-187c5fad5ccd`

Central confirmó:

- llamada real a `officialize-match`;
- HTTP 200;
- convergencia a `validated`;
- resultado de Nivel aplicado.

**NO TOCAR** ese self-healing salvo regresión concreta derivada de esta ronda.

La capacidad del editor de corrección de:

- agregar tercer set;
- cambiar el ganador final;

ya tuvo PASS físico. No repetir ese caso salvo regresión.

## 3. Orden de implementación dentro de la misma ronda

Prioridad interna:

### P1 — identidad canónica / Matu
### P2 — editor de corrección de sets
### P3 — UX completa de corrección post-validación
### P4 — componente único de jugador + continuidad de identidad
### P5 — Home/Resumen/Reportar error/+ visual

La ronda termina junta; este orden solo evita diseñar encima de datos incorrectos.

---

# P1 — BUG DE IDENTIDAD CANÓNICA — PRIORIDAD ALTA

## Evidencia física

El mismo jugador visible como “Matu” se resuelve distinto según ruta.

Desde Buscar jugadores:

- `@matu_qa`
- Nivel 5.9
- avatar real
- estadísticas correctas

Desde Compañeros / otras superficies:

- `@matu`
- Nivel 6.3
- sin avatar
- datos distintos/incompletos

Esto NO es polish.

## Requerimiento

Todas las superficies deben resolver por el mismo `player_id` real.

**PROHIBIDO:**

- matching por nombre visible;
- resolver identidad por `display_name`;
- fabricar username;
- usar fixtures/IDs legacy como sustituto silencioso;
- fusionar o borrar cuentas reales solo porque comparten nombre.

## Investigación obligatoria

Trazar, al menos:

- Buscar jugadores;
- Perfil público;
- Compañeros;
- Rivales;
- reemplazo de identidad;
- Recientes si existe;
- caches locales;
- fixtures/legacy IDs;
- cualquier helper que traduzca `userId/playerId/displayName`.

Encontrar la causa real antes de tocar visuales.

Si en Staging existen DOS `player_id` realmente distintos para dos cuentas distintas llamadas Matu:

- NO fusionarlas por nombre;
- determinar qué superficie está apuntando al ID incorrecto;
- corregir esa ruta/origen;
- no destruir datos para “hacer coincidir” la UI.

Si se detecta contaminación de fixture/cache legacy:
- corregir la fuente;
- invalidar/normalizar cache solo si puede hacerse sin perder datos reales;
- documentar exactamente qué pasó.

## PASS

Para un `player_id` puntual:

- avatar;
- nombre;
- `@username`;
- Nivel;
- estadísticas;
- Perfil público;

deben ser coherentes sin importar desde qué superficie se abrió.

---

# P2 — BUG FUNCIONAL DEL EDITOR DE CORRECCIÓN DE SETS

## Caso A

Set existente: `2–6`.

Se modifica solo `2 → 3`.

UI muestra `3–6`, pero `Enviar corrección` no habilita hasta volver a tocar manualmente el 6.

## Caso B

Set existente: `3–6`.

Se quiere cambiar a `6–4`.

Si se intenta primero `3 → 6`, el 6 aparece deshabilitado porque todavía está seleccionado en el rival.

## Causa esperada a investigar

Hay divergencia entre:

- valor pintado;
- estado interno;
- validación del CTA;
- lógica de habilitación del keypad.

No hacer parche cosmético.

## REEMPLAZAR / FUSIONAR

- al abrir edición de un set existente, ambos games deben inicializarse en el estado real;
- UI y validación deben leer la misma fuente;
- cambiar un solo lado conserva el otro valor existente;
- el usuario puede editar cualquiera de los lados en cualquier orden;
- cambiar ganador/perdedor no queda bloqueado por el valor viejo del rival;
- si una transición intermedia es inválida, resolverla de manera explícita y comprensible, no con estado stale invisible;
- el CTA valida el score completo visible.

## Tests mínimos

Cubrir de forma determinística:

1. prefill `2–6` realmente carga ambos lados;
2. `2–6 → 3–6` habilita CTA sin retocar el 6;
3. `3–6 → 6–4` se puede completar empezando por cualquiera de los lados;
4. score inválido real sigue bloqueado;
5. agregar/eliminar tercer set no regresa;
6. cambio de ganador final no regresa.

---

# P3 — CORRECCIÓN POST-VALIDACIÓN — SEMÁNTICA NO CAMBIA, UX SÍ

## Regla de producto confirmada

Cuando un partido YA es oficial y alguien propone una corrección:

- la última versión validada sigue siendo oficial;
- la propuesta no reemplaza todavía el resultado;
- recién al aceptar la otra pareja pasa a ser la nueva versión oficial;
- recién ahí se recalculan/actualizan derivados según contratos vigentes.

**NO CAMBIAR ESTA SEMÁNTICA.**

Principio visual:

> La propuesta no reemplaza a la verdad oficial, pero mientras está abierta sí reemplaza al estado normal/cerrado del partido.

## REEMPLAZAR presentación del Resumen

Para quien debe aceptar/rechazar:

### Bloque 1 — RESULTADO OFICIAL ACTUAL

Mostrar claramente:

- etiqueta explícita;
- parejas;
- sets oficiales;
- ganador vigente.

### Bloque 2 — CORRECCIÓN PROPUESTA POR [nombre]

Mostrar con jerarquía comparable:

- parejas;
- resultado completo propuesto;
- ganador que tendría si se acepta.

### Delta secundario

Puede mostrarse debajo como apoyo:

- `Set 2: 3–6 → 6–0`
- `Set 3 agregado: 6–0`

No usar el delta como sustituto de la propuesta completa.

### Acciones

- `Aceptar corrección` = primaria;
- `Rechazar` = secundaria;
- misma altura/alineación/composición consistente.

No mostrar dos resultados sin rotular qué es oficial y qué es propuesta.

## Para quien propuso

Mantener:

- resultado oficial vigente;
- estado claro `Corrección propuesta`;
- `Esperando respuesta de la otra pareja`;
- posibilidad de revisar dentro del Resumen la propuesta completa enviada.

## Home / Historial

- mantener score oficial hasta aceptación;
- mantener VICTORIA/DERROTA oficial separada;
- mostrar `CORRECCIÓN PROPUESTA` como estado de primer nivel, no una píldora decorativa;
- debe quedar claro que ese partido tiene algo pendiente importante;
- no reemplazar silenciosamente el score oficial.

## Cuando se acepta

Recién entonces deben converger:

- Home;
- Historial;
- Resumen;
- Nivel;
- Intelligence;
- cualquier derivado vigente.

No crear lógica paralela nueva para esos sistemas: reutilizar el contrato canónico existente.

---

# P4 — IDENTIDAD INCORRECTA: FLUJO CONTINUO + COMPONENTE ÚNICO DE JUGADOR

## Copy

REEMPLAZAR:

- `¿Confirmás que no participó?`
- `Sí, no participó`

por una formulación centrada en la persona, por ejemplo:

`¿Estás seguro de que no fue Lucho?`

Acciones simples y no ambiguas.

Ajustar el nombre real dinámicamente; no hardcodear Lucho.

## Flujo continuo

Hoy:

1. cuestiona identidad;
2. muestra `Identidad cuestionada`;
3. obliga a cerrar;
4. volver a Resolver;
5. recién ahí reemplazar.

Debe pasar a:

1. confirmar que la identidad es incorrecta;
2. inmediatamente preguntar `¿Sabés quién jugó?`;
3. permitir buscar/reemplazar ahí mismo;
4. permitir `Por identificar` si no lo sabe;
5. terminar sin obligar a salir y reentrar.

Mantener contratos y ventanas de identidad vigentes.

No permitir reemplazar por un jugador ya presente en el partido.

## Componente único de jugador

**FUSIONAR** las variantes visuales/técnicas existentes hacia un patrón compartido o helpers compartidos, sin sobrearquitectura.

Toda búsqueda/selección real debe mostrar cuando los datos existan:

- avatar real;
- nombre;
- `@username`;
- Nivel BRAMU vigente.

Aplicar a:

- Buscar jugadores;
- reemplazo de identidad;
- Compañeros;
- Rivales;
- selectores equivalentes.

La identidad se resuelve SIEMPRE por `player_id`, nunca por texto.

### Recientes

AGREGAR una sección `Recientes` cuando pueda derivarse de relaciones/historial REAL ya disponible o mediante una extensión mínima segura del contrato actual.

No inventar “recientes” por orden alfabético, hash, mocks ni heurística sin evidencia.

Si para implementarlo correctamente hiciera falta abrir un sistema nuevo desproporcionado para esta ronda:
- documentar ese subpunto como pendiente;
- continuar todo lo demás;
- no frenar la entrega completa.

---

# P5 — HOME / RESUMEN / REPORTAR ERROR / BOTÓN +

## Home — Nivel

AGREGAR / RECUPERAR la barra visual debajo del Nivel calibrado.

Reglas:

- NO representa XP;
- NO representa progreso lineal `5.9 → 6.0`;
- recuperar delta reciente solo cuando exista dato real;
- no inventar delta sin evidencia;
- respetar la fuente real de evolución/Nivel ya existente.

No tocar fórmula de Nivel.

## Home — Último partido

REEMPLAZAR padding actual (~20/22 px) por base 16 px, coherente con módulos comparables.

Mantener:

- borde verde victoria;
- borde rojo derrota.

## Resumen — grilla

REEMPLAZAR/CORREGIR estructura, no solo márgenes aislados.

Problemas:

- pareja inferior desalineada;
- boxes de sets no alinean correctamente con cada fila;
- `result-card__divider` se mezcla con el renglón;
- nombres / scores / estadísticas no se separan con claridad.

Esperado:

- cada pareja alineada verticalmente con sus scores;
- nombres + sets funcionan como una unidad;
- divisor entre parejas conceptualmente distinto del divisor previo a estadísticas;
- validar especialmente layout iPhone;
- no degradar desktop actual aunque responsive desktop general siga fuera de alcance.

## Reportar un error

REEMPLAZAR copy:

`REPORTAR UN ERROR` → `Reportar un error`

Tratamiento:

- secundario;
- borde/texto rojo suave;
- no competir con CTA principal.

Hoja `¿Qué está mal?`:

REEMPLAZAR dos cards pesadas por opciones más livianas:

- título;
- subtítulo;
- divisor/separación simple;
- área táctil suficiente.

## Botón central +

Mantener círculo/tamaño actual.

Solo:

- engrosar moderadamente el trazo del símbolo `+`;
- no agrandar otra vez el círculo.

---

# 4. NO TOCAR

NO TOCAR en esta ronda:

- BRAMUlive;
- main;
- Production;
- Mis grupos;
- popup futuro al abrir BRAMU;
- realtime/polling;
- responsive desktop general;
- reubicación definitiva de Ocultar partido;
- múltiples identidades simultáneas;
- `Otros datos` de Reportar error;
- P0.2 legal;
- P0.3 eliminación;
- fórmula de Nivel;
- algoritmo de Ranking;
- lógica de Intelligence;
- hotfix h11 de self-healing salvo regresión demostrada.

Trabajar únicamente sobre `staging`.

---

# 5. Estrategia técnica esperada

## AGREGAR

Solo lo necesario para:

- estado/editor correcto de corrección;
- comparación oficial/propuesta;
- continuidad de identidad;
- componente/helper compartido de jugador;
- tests dirigidos.

## FUSIONAR

- variantes de player rows;
- resolución por player_id;
- visuales duplicados de jugador;
- lógica de score del editor hacia una única fuente de estado.

## REEMPLAZAR

- UX de corrección post-validación actual;
- interacción defectuosa del keypad;
- copy de identidad;
- tratamiento pesado de Reportar un error;
- grilla visual rota del Resumen.

## NO TOCAR

Todo lo indicado en §4.

Preferir soluciones simples y compatibles con lo existente.

No crear un framework de componentes ni una arquitectura nueva solo por esta tanda.

---

# 6. Backend / datos

Esta ronda puede investigar Staging y usar evidencia real.

Si la inconsistencia de identidad exige un cambio backend:

- demostrar primero por qué;
- mantener compatibilidad;
- escribir migración/test si corresponde;
- probar primero en Staging;
- NO tocar Production.

Si el problema puede resolverse correctamente solo en frontend/cache/fixtures, no agregar backend innecesario.

No borrar/fusionar cuentas reales ni reescribir historial para resolver un problema visual.

Si hace falta una limpieza puntual de fixture de Staging:
- documentar exactamente cuál;
- no asumir que un homónimo es duplicado;
- preservar trazabilidad.

---

# 7. Pruebas

Las pruebas deben cubrir riesgos concretos.

## Obligatorias

- suite Node completa;
- `tests.html`;
- tests nuevos del editor de corrección;
- tests de resolución por `player_id`;
- tests de continuidad del flujo de identidad;
- tests/guardas de oficial vs propuesta;
- smoke de carga de app.

## Focales

Verificar que esta ronda no regrese:

- h11 self-healing;
- validación/aceptación/rechazo;
- cambio de ganador;
- tercer set;
- búsqueda real;
- Perfil público;
- Home/Historial;
- Nivel/Intelligence solo después de aceptación.

No repetir pruebas manuales ya demostradas si los cambios no las afectan.

---

# 8. Versionado y deploy

Como esta ronda toca `bramulab/`:

- trabajar y probar todo localmente antes de push;
- un único bump final de bundle;
- objetivo: `04.11-h12`;
- actualizar cuarteto completo de versión/cache;
- idealmente un único commit lógico;
- push a `origin/staging`;
- un único deploy intencional de Vercel Staging;
- verificar deploy verde.

No hacer micro-pushes para probar.

---

# 9. Entrega

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/41_Resultado_Ronda_Correctiva_Laboratorio_h12_27SEP.md`

Debe incluir:

1. causa raíz del bug de Matu;
2. player_id/caminos involucrados sin exponer datos sensibles innecesarios;
3. qué se corrigió;
4. cómo quedó el editor de sets;
5. cómo quedó oficial vs propuesta;
6. cómo quedó el flujo continuo de identidad;
7. qué se unificó del componente de jugadores;
8. ajustes visuales realizados;
9. tests ejecutados y resultados;
10. commit;
11. bundle;
12. deploy;
13. riesgos residuales reales;
14. DECISIONES ABIERTAS, si existieron;
15. batería física FINAL, corta y priorizada para Sebastián.

Actualizar `05_Laboratorio_UX_Uso_Real.md` y/o checklist vigente solo con estado objetivo de lo implementado; no declarar PASS físico de algo que Sebastián todavía no vio.

## Criterio de devolución a Laboratorio

No devolver una lista de 20 pruebas.

Agrupar la validación física en máximo 5 bloques:

1. identidad canónica / Matu;
2. corrección de resultado (editor + oficial/propuesta);
3. identidad incorrecta continua;
4. Home/Resumen/Reportar error;
5. regresión visual rápida del + y navegación principal.

El objetivo es que Sebastián haga una nueva pasada corta de producto, no que repita QA técnico ya cubierto por agentes.
