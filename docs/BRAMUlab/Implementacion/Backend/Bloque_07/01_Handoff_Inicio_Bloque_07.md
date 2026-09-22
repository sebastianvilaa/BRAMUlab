# Backend Bloque 7 — Handoff de inicio

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Bloques 1–6 cerrados en Staging.  
**Objetivo:** iniciar **Ranking real semanal** sin reabrir decisiones de producto ya cerradas.

## 1. Fuente de verdad

Leer en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Ranking_BRAMU.md`
4. únicamente la sección **Bloque 7 — Ranking real semanal** de `docs/BRAMUlab/Backend_Infraestructura.md`
5. la sección final de Bloque 6 en `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` solo para conocer el estado real de entrada.

No usar `Archivo/`, `Backup/` ni handoffs históricos como autoridad normal.

## 2. Estado real de entrada

- Bloques 1–6: **CERRADOS en Staging**.
- Supabase Staging está limpio de los fixtures de navegador de Bloque 6.
- Nivel real/persistente, partidos compartidos y validación oficial ya existen.
- Ranking actual de la UI es **prototipo/local-simulado**: no puede presentarse como Ranking real.
- Ranking V1 de producto/UX está cerrado conceptualmente en `Ranking_BRAMU.md`.
- BRAMUlab sigue en V04.10; el bundle funcional de producto sigue siendo `04.10-h19`.
- No tocar `main`, Production ni BRAMUlive.

## 3. Contrato de producto que NO se reabre

Bloque 7 implementa el contrato vigente de `Ranking_BRAMU.md`.

Principios mínimos:

- Nivel BRAMU y Ranking BRAMU son sistemas distintos.
- Ranking V1 no tiene puntos propios.
- Ranking se publica **semanalmente**.
- Corte: lunes 00:00:00 → domingo 23:59:59.
- Timezone V1: `America/Argentina/Buenos_Aires`.
- Una edición publicada es inmutable.
- Un partido/corrección que queda oficial después del cierre entra en una edición futura.
- Orden: Nivel interno exacto del corte, descendente.
- Empate exacto comparte puesto con ranking de competición.
- Solo cuentas reales elegibles ocupan posición.
- Provisionales nunca ocupan posición.
- Solo `CALIBRADO` y `RECALIBRANDO` con consolidado previo pueden ser elegibles.
- Localidad/rama/`ranking_opt_in` faltantes no inventan posición.
- Usuario con datos completos pero `CALIBRANDO` puede explorar Ranking sin fila propia oficial.
- Densidad: 0–4 sin puestos; 5–14 en formación; 15+ establecida.
- Mi red usa relaciones de juego vigentes de los últimos 180 días según la definición maestra.
- Filtro de Nivel no crea otro sistema de Ranking.
- Movimiento semanal significa puestos, nunca puntos.
- `TU POSICIÓN`, tarjeta territorial en Perfil y aporte a `TU MOMENTO` consumen el mismo snapshot semanal.
- `Explorar rankings`, rankings privados de Grupos, Race y matchmaking quedan fuera de V1.

## 4. Primera fase: análisis técnico, NO implementación

Esta primera ronda debe responder **cómo aterrizar Ranking V1 sobre el backend real ya cerrado**.

Inspeccionar únicamente lo necesario de:

- esquema/migraciones vigentes de Supabase;
- tablas/RPCs relacionadas con `profiles`, `locations`, `level_states`, partidos validados y relaciones entre jugadores;
- `bramulab/ranking.js` y sus puntos de integración en UI;
- Home, Mi Perfil y Perfil público solo donde consuman Ranking;
- configuración/arquitectura server-side ya existente que pueda reutilizarse.

No hacer auditoría general del repositorio.

## 5. Preguntas que el análisis debe cerrar

1. Qué tablas/snapshots necesita Bloque 7 y cuáles pueden reutilizarse.
2. Cómo representar edición semanal, filas inmutables, ámbitos, rama, banda, puesto, empate, denominador, movimiento y motivos de no elegibilidad.
3. Cómo materializar la edición semanal sin sobrearquitectura para la escala actual.
4. Qué mecanismo simple y seguro usar para publicar semanalmente en Staging/Production.
5. Cómo preservar inmutabilidad/auditabilidad si después cambian Nivel, ubicación o una corrección vieja.
6. Cómo resolver elegibilidad y densidad con datos reales existentes, sin inventar datos.
7. Cómo construir `Mi red` desde relaciones de juego reales de 180 días.
8. Qué RPCs/queries necesita el frontend y qué autoridad debe quedar server-side.
9. Cómo reemplazar el Ranking simulado sin dejar fallback a mocks en Production.
10. Qué tests son realmente necesarios para los riesgos del bloque.
11. Qué parte puede probarse automáticamente y qué parte necesitará QA real de navegador.
12. Si existe alguna **DECISIÓN ABIERTA** de producto no resuelta por `Ranking_BRAMU.md`. No inventar una si el master ya la responde.

## 6. Restricciones

En esta ronda:

- **NO implementar código.**
- **NO crear/aplicar migraciones.**
- **NO tocar Supabase.**
- **NO desplegar Edge Functions.**
- **NO tocar Vercel.**
- **NO cambiar UX ni reglas de Ranking.**
- **NO tocar main, Production ni BRAMUlive.**
- **NO iniciar Intelligence.**
- **NO reabrir Nivel ni Bloque 6.**
- **NO agregar puntos propios, Race, rankings de Grupos, Explorar Rankings ni matchmaking.**
- **NO diseñar para escala comercial hipotética.**

## 7. Entrega

Crear:

`docs/BRAMUlab/Implementacion/Backend/Bloque_07/02_Analisis_Claude.md`

Debe contener:

- diagnóstico del estado actual;
- propuesta técnica concreta y simple;
- modelo de datos propuesto;
- contratos server/frontend;
- estrategia de publicación semanal;
- plan de implementación por fases pequeñas;
- matriz de pruebas por riesgo;
- `DECISIÓN ABIERTA` solo si es material y realmente no está resuelta.

No modificar código ni fuentes maestras en esta ronda.

Un único commit lógico en `staging`.

Respuesta final del chat: corta, indicando únicamente HEAD, archivo creado, bloqueos y decisiones abiertas.

Después detenerse.
