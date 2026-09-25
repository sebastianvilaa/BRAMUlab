# BRAMUlab — Handoff de implementación · Ronda UX 25/09/2026

**Rama:** `staging`  
**NO tocar:** `main`, Production, BRAMUlive.  
**Origen:** Laboratorio UX con uso real en iPhone + navegador, cuentas sintéticas QA y backend Staging real.  
**Fuente de detalle:** `docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md`, especialmente §15.2–§15.22.

## 1. Objetivo de esta ronda

Implementar el paquete central de hallazgos ya suficientemente observados durante el Laboratorio UX, sin reabrir reglas de negocio cerradas ni convertir esta ronda en un rediseño total.

Antes de tocar código:

1. leer `docs/BRAMUlab/README.md`;
2. leer `docs/BRAMUlab/Metodo_Trabajo.md`;
3. leer `docs/BRAMUlab/Experiencia_Inicial.md`;
4. leer las secciones §15.2–§15.22 de `05_Laboratorio_UX_Uso_Real.md`;
5. para Nivel, consultar solo `Nivel_BRAMU_Formula_V1.5.md`;
6. para Ranking, consultar solo `Ranking_BRAMU.md`.

No pedir a Sebastián que reconstruya el laboratorio. Este documento resuelve las contradicciones de la sesión.

---

# 2. IMPLEMENTAR AHORA — prioridad alta

## A. Perspectiva personal correcta en Home e Historial

### Problema
Las tarjetas compactas no siempre presentan nombres y score desde la misma perspectiva.

Ejemplo observado:
- backend canónico: Seba/Pablito 4–6 / 4–6 Matu/Diego;
- Home de Matu llegó a mostrar `Matu / Diego vs Seba / Pablito` pero `4–6 · 4–6`.

Historial también conservó a veces el orden canónico aunque la superficie es personal.

### REEMPLAZAR
En toda superficie personal compacta:
- pareja del usuario actual primero;
- rivales después;
- score orientado en ese mismo sentido.

Aplicar como mínimo a:
- Último partido / Home;
- Historial;
- cualquier componente compacto compartido equivalente.

### NO TOCAR
El Resumen detallado puede conservar un orden canónico estable compartido entre participantes.

### Acceptance
Para un mismo partido, Seba y Matu pueden ver orden/score invertidos entre sí, pero cada uno debe verlo correctamente desde su propia perspectiva.

---

## B. Estado normal oficial: retirar `VALIDADO` persistente

### REEMPLAZAR
En partidos oficiales normales:
- eliminar badge persistente `VALIDADO` de Home;
- eliminar `VALIDADO` de Historial;
- no usar `Partido oficial` como banner permanente en Resumen.

El estado oficial es el estado ordinario.

### CONSERVAR
- toast transitorio `Partido confirmado.`;
- trazabilidad útil dentro del detalle.

---

## C. Resultado vs. estado del partido

Separar visualmente:
- **resultado:** VICTORIA / DERROTA;
- **estado:** pendiente, identidad cuestionada, corrección, etc.

### Semántica preferida para Staging
- victoria: verde;
- derrota: rojo;
- requiere acción del usuario: lima;
- pendiente esperando a terceros / proceso no final: ámbar;
- información secundaria: gris/neutro.

`CALIBRANDO` puede seguir usando ámbar: comparte la semántica “todavía no final”.

### Home — borde de Último partido
- oficial ganado: acento/borde verde sutil;
- oficial perdido: acento/borde rojo sutil;
- pendiente accionable: prima el lima;
- pendiente en espera: prima el tratamiento de proceso/ámbar;
- evitar glow rojo agresivo.

### Historial
El estado debe ir en línea/zona propia debajo del resultado, no pegado al badge VICTORIA/DERROTA.

---

## D. Carrusel superior unificado de Home

### AGREGAR / REEMPLAZAR
La zona superior de contenido temporal/relevante debe ser un único carrusel horizontal.

Puede convivir:
1. pendiente que requiere acción;
2. pendiente esperando a otros;
3. tips/destacados informativos celestes;
4. otros destacados temporales ya previstos.

### Reglas
- prioridad: accionables → espera → informativos;
- no apilar múltiples tarjetas grandes verticalmente;
- reducir altura de la tarjeta actual;
- eliminar botón grande `REVISAR`;
- toda la tarjeta es tappable;
- con una tarjeta, se ve como una única tarjeta compacta;
- con varias, swipe horizontal.

No transformar Home en una pantalla de alertas.

---

## E. Resumen del partido — jerarquía, trazabilidad y acciones

### Metadata
### REEMPLAZAR
La cabecera actual que mezcla fecha/formato/estado por trazabilidad útil.

Dirección:
- `Cargado por Esteban · 24 SEP 26 · 21:30`
- segunda línea: `Clásico · Punto de Oro`
- cuando corresponda: `Confirmado por Seba` / actor relevante.

No mostrar `TU TURNO: CONFIRMAR` dentro de esa metadata.

### QUITAR
- banner redundante `Te toca confirmar este resultado.` cuando el CTA principal ya lo expresa;
- `Partido oficial.` como banner persistente.

### FIX VISUAL
Alinear verticalmente las dos filas de parejas + games; en QA la fila inferior quedó ópticamente corrida hacia arriba.

### Acciones
- primaria: `CONFIRMAR PARTIDO`;
- secundaria: `REPORTAR UN ERROR`.

`REPORTAR UN ERROR` debe abrir un flujo que pregunte qué está mal:
- resultado;
- participante;
- otros datos editables ya soportados por contrato vigente.

`No participé` deja de competir como tercera acción principal y vive dentro de error de participante.

### Consistencia de patrones
- edición/selección: usar un patrón coherente, preferentemente bottom sheet;
- confirmación final de una acción sensible puede usar diálogo/modal.

---

## F. Corrección de resultado

### BUG
La corrección actual:
- usa otro lenguaje visual distinto de Cargar partido;
- solo permite editar sets existentes;
- no permite convertir un partido de 2 sets en uno de 3 sets.

### REEMPLAZAR
Reutilizar composición/lógica del editor de resultado de `Cargar partido`, prellenada con el score actual.

Debe permitir agregar/quitar sets dentro de las reglas reales del formato.

No duplicar validadores ni inventar otra gramática de score.

### Después de enviar
Dar feedback inequívoco de éxito; el toast actual pasó inadvertido en uso real.

---

## G. Recepción de una corrección

### BUG / IMPLEMENTACIÓN INCOMPLETA
Una corrección propuesta se presenta como si fuera una carga nueva y vuelve al flujo genérico de confirmación.

### REEMPLAZAR
El receptor debe entender:
- quién propuso la corrección;
- qué cambió;
- que ahora debe aceptar esa revisión.

Ejemplo conceptual:
- `Seba propuso una corrección`
- `Set 2: 6–3 → 6–4`

CTA principal contextual:
- `ACEPTAR CORRECCIÓN`

No hacer una edición silenciosa. Mantener revisiones append-only y trazabilidad.

---

## H. Identidad incorrecta

### NO TOCAR en lo esencial
El flujo real funcionó bien:
- jugador incorrecto reporta;
- sale de sus superficies;
- el partido sigue existiendo;
- otro participante resuelve el slot;
- reemplazo recibe el partido;
- reemplazo confirma;
- identidad errónea no conserva efectos deportivos.

### CONSERVAR
Tarjeta de incidencia:
- `Por identificar`;
- `Identidad cuestionada`;
- CTA `RESOLVER`.

### MEJORAR
- hacer tappable toda la tarjeta además de `RESOLVER`;
- selector de reemplazo: nombre + `@username` como mínimo; avatar si el patrón ya lo soporta.

### REEMPLAZAR
En `REPORTAR UN ERROR > participante`:
- no ofrecer al autor original del partido como candidato a “no participó”; el flujo de carga propia ya obliga al autor a ocupar un slot;
- conservar autoría como dato separado para auditoría.

No ampliar en esta ronda el caso de múltiples identidades incorrectas si exige arquitectura nueva.

---

## I. Eventos y copies: creación ≠ corrección ≠ identidad

### BUG
La UI usa textos de “registró un partido” para eventos que en realidad fueron:
- corrección de resultado;
- resolución/cambio de identidad;
- incorporación posterior de un reemplazo.

### REEMPLAZAR
Generar copy según el evento real y el actor real.

Ejemplos conceptuales:
- `Esteban cargó un partido en el que participaste.`
- `Seba propuso una corrección en el partido con Lucho.`
- `Matu aceptó la corrección del partido con Pablito.`
- `Matu corrigió un participante y quedaste incluido en este partido.`

No usar la pareja como “actor” si la acción la hizo una persona concreta.

---

## J. Notificaciones

### Problema
La bandeja actual queda llena de tarjetas indistinguibles:
`Partido oficial · Tu partido ya quedó validado.`

### REEMPLAZAR
1. **Tareas accionables**
   - persisten aunque se lean;
   - desaparecen cuando se resuelve la tarea;
   - leer ≠ resolver.

2. **Informativas**
   - solo para acciones externas relevantes;
   - acciones propias no generan una informativa redundante al mismo actor;
   - una vez leídas no cuentan en badge;
   - pueden quedar como historial reciente.

3. **Contexto obligatorio**
   - actor;
   - acción;
   - partido suficiente para identificarlo.

4. **Interacción**
   - tocar abre el partido correspondiente.

5. **Marcar todas como leídas**
   - solo afecta informativas;
   - nunca resuelve tareas accionables.

No definir todavía una política compleja de retención temporal.

---

## K. Historial — cambios externos no vistos

### AGREGAR
Cuando un partido cambia por acción externa:
- mostrar un pequeño indicador en el acceso a Historial;
- al abrir Historial, destacar sutilmente las filas que cambiaron;
- con abrir Historial se considera visto: no exigir abrir partido por partido;
- retirar luego badge/resaltado.

Evitar un borde blanco permanente. El tratamiento debe ser temporal y no competir con victoria/derrota/pendiente.

### SIMPLIFICAR
`Todos` y `Mis partidos` son redundantes en BRAMUlab actual porque solo se registran partidos propios.

Eliminar/simplificar estas tabs salvo que exista hoy una distinción real documentada.

---

## L. Nivel calibrado — Home y Mi Perfil

### BUG VISUAL
Al pasar Seba 4/5 → 5/5:
- la tarjeta de Home se recompuso mal;
- Nivel dejó su posición natural;
- la píldora `NIVEL CALIBRADO` deformó el layout.

### REEMPLAZAR
Una vez calibrado:
- quitar píldora persistente `NIVEL CALIBRADO`;
- mostrar identidad + Nivel BRAMU numérico con composición normal;
- no hace falta otro badge: la desaparición de `CALIBRANDO` ya comunica el estado.

Aplicar el mismo criterio a Mi Perfil.

La finalización puede tener feedback transitorio si ya existe un patrón seguro, pero no un badge permanente.

---

## M. Evolución del Nivel BRAMU al calibrarse

### BUG DE ESTADO/COPY
Después de 5/5, el módulo dice `NIVEL CALIBRADO` pero debajo conserva:
`Es una primera referencia basada en tus respuestas — todavía no es una medición de tu juego. BRAMU la va a calibrar con partidos reales.`

Eso es falso después de completar calibración.

### REEMPLAZAR
- nunca mostrar ese copy una vez calibrado;
- inspeccionar si la UI server-backed dispone de serie real suficiente en `level_events`;
- si existe, renderizar evolución únicamente con evidencia real;
- si no existe un camino real ya disponible, ocultar temporalmente el módulo antes que simular o mostrar copy falso.

NO usar evolución legacy/simulada para una cuenta server-backed real.

---

## N. Selector de jugadores recientes al cargar partido

### IMPLEMENTACIÓN INCOMPLETA
El camino server-backed obliga a buscar por texto aunque ya existan jugadores con los que el usuario compartió partidos.

### AGREGAR
Sección `RECIENTES` real en el selector:
- basada en participantes reales de partidos compartidos;
- identidad por `player_id`;
- no duplicar luego esos jugadores en búsqueda;
- conservar búsqueda server-backed con mínimo vigente.

No inventar “recientes” por datos locales legacy.

---

# 3. CONVENIENTE EN ESTA MISMA RONDA SI ES BARATO

## O. Headers / blur superior
Corregir el degradé/fade superior que invade títulos/logo, especialmente en Home y Cargar partido.

Debe resolverse como patrón transversal de CSS, no con parches pantalla por pantalla.

## P. BRAMU Intelligence
Contenido observado: correcto.

Pulido:
- evitar `+ POR QUÉ APARECE` repetido bajo cada insight;
- evaluar un único acceso al final del bloque que agrupe la evidencia.

No cambiar claims ni lógica de Intelligence.

## Q. TU MOMENTO
Evitar copies que atribuyen al usuario haber “cargado” un partido cuando lo cargó otra persona.

Preferir lenguaje de historia:
`Tu primer partido ya forma parte de tu historia` o equivalente.

---

# 4. JUGADORES — migración incompleta, NO reactivar legacy

En perfiles públicos server-backed el botón `AGREGAR JUGADOR` está oculto deliberadamente.

La implementación vigente documenta por qué:
- la lista histórica usa `Store.addPlayerToList` por nombre;
- Backend Bloque 4 migró identidad real a `player_id`;
- volver a mostrar ese botón reintroduciría identidad por nombre.

### NO HACER
No reactivar el botón legacy.

### RECOMENDACIÓN PARA ESTA RONDA
No crear un sistema social/follow nuevo.

Si `JUGADORES` no puede migrarse de forma pequeña y segura a una lista server-backed por `player_id`, ocultar temporalmente la pestaña/promesa `JUGADORES` en cuentas server-backed y dejar la migración real para la futura ronda de relaciones/Mis grupos.

Si ya existe una infraestructura server-backed mínima reutilizable, documentar la propuesta antes de expandir schema.

---

# 5. NO TOCAR EN ESTA RONDA

- Mis grupos: requiere ronda propia de producto/UX; Sebastián lo considera una superficie central y no quiere un parche rápido.
- responsive/ancho escritorio: queda para comparación visual específica posterior.
- Realtime/polling: no agregar; foreground/navigation refresh ya quedó validado.
- Ranking semanal: `Todavía sin posición oficial` inmediatamente después de calibrar no es bug por sí solo; Ranking se publica semanalmente.
- backend de Nivel / fórmula V1.5: no modificar.
- reglas 14 días / 30 días / 3 días / 10+7 / límite 5 pendientes: no reauditar.
- BRAMUlive.
- main / Production.
- identity provisional/claim: backend ya cerrado; recorrido visual puede retomarse después de esta implementación.
- monetización / publicidad / escalado.

---

# 6. Bug menor observado pero NO mezclar sin reproducir

Durante la sesión hubo un fallo al intentar cambiar la foto de perfil:
`No pudimos guardar la foto. Probá de nuevo.`

No abrir una investigación grande por esto dentro de la ronda UX principal.

Si al revisar el camino actual de avatar server-backed el problema es obvio/reproducible, corregirlo y probarlo. Si no, dejarlo documentado para una reproducción dirigida posterior.

---

# 7. Orden técnico recomendado

Claude Code puede reagrupar internamente, pero se recomienda:

### Ronda 1 — corrección funcional/estado
1. perspectiva personal de score/nombres;
2. corrección de score con sets dinámicos;
3. evento/copy contextual de correcciones e identidad;
4. Nivel 5/5: tarjeta + copy de Evolución;
5. recientes server-backed.

### Ronda 2 — jerarquía visual
6. estado resultado/pendiente;
7. carrusel superior;
8. Resumen/trazabilidad/acciones;
9. Historial simplificado + cambios no vistos;
10. notificaciones.

### Ronda 3 — pulido barato
11. blur de header;
12. TU MOMENTO;
13. BRAMU Intelligence `Por qué aparece`;
14. tratamiento temporal de JUGADORES server-backed.

No hacer deploy después de cada microcambio si una sola ronda agrupada puede validarse de forma segura.

---

# 8. Pruebas necesarias

No repetir toda la QA histórica.

Cubrir riesgos concretos:

1. score orientado correctamente desde Team A y Team B;
2. 2 sets ↔ 3 sets en propuesta de corrección;
3. aceptar corrección conserva revision append-only;
4. identidad incorrecta sigue desacoplando al jugador erróneo;
5. actor/copy correcto en notificaciones y carrusel;
6. calibrando 4/5 → calibrado 5/5 sin layout roto ni copy falso;
7. estadísticas oficiales no incorporan pendientes;
8. recientes usan player_id y no fusionan homónimos;
9. regresión mínima Home/Historial/Resumen/Perfil;
10. suite existente completa.

Backend/migraciones solo si son estrictamente necesarias. Si una migración resulta necesaria para notificaciones o JUGADORES, probar exclusivamente en Staging y documentar rollback/impacto antes de continuar.

---

# 9. Salida esperada del implementador

Al terminar:

- lista exacta de archivos cambiados;
- qué puntos de este handoff quedaron implementados;
- qué se dejó fuera y por qué;
- tests ejecutados;
- bundle/versión técnica resultante;
- commit(s) en `staging`;
- NO desplegar/tocar Production;
- dejar un resumen corto listo para el chat central.

Si aparece una decisión humana real:
- marcar `DECISIÓN ABIERTA`;
- continuar todo lo que no dependa de ella;
- no frenar la ronda completa.
