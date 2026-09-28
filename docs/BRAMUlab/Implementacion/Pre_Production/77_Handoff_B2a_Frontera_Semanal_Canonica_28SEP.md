# 77 — Handoff · B2a · frontera semanal canónica + lastActivityAt exacto

**Fecha:** 28/09/2026  
**Rama:** `staging`  
**Objetivo:** corregir el único bloqueo detectado por Central en B2a antes de aplicar la migración a Supabase Staging.

## Decisión de producto cerrada

**Grupos BRAMU V1 usa `America/Argentina/Buenos_Aires` como zona horaria canónica para la semana.**

Semana BRAMU:
- lunes 00:00:00.000;
- domingo 23:59:59.999;
- frontera calculada en Buenos Aires;
- no depende del timezone del dispositivo;
- no hay timezone configurable por grupo en V1.

Esta misma frontera debe gobernar:
- Semana actual;
- Semana pasada;
- alta/reingreso con retroactividad limitada a esa semana;
- calificación 3/4;
- actividad deportiva del lobby;
- cualquier comparación semanal futura de Grupos.

## Problema exacto a corregir

En B2a, `_groups_candidate_matches` conserva una cota amplia de 7 días para no excluir candidatos que luego el motor JS decide con el lunes exacto. Eso es válido para transportar candidatos.

Pero `_groups_last_activity_at` usa hoy esos candidatos amplios como si fueran partidos definitivamente calificables. Un partido de la semana anterior, todavía dentro de esa cota amplia, podría mover `lastActivityAt` por una acción posterior aunque no pertenezca a la semana deportiva efectiva del alta.

No aplicar B2a en Staging hasta corregirlo.

## Qué hacer

1. **AGREGAR/FUSIONAR** una única función/helper de frontera semanal canónica BA reutilizable por backend y frontend.
   - Backend: SQL determinístico para inicio de semana en `America/Argentina/Buenos_Aires`.
   - Frontend/motor: `groups.js` debe dejar de depender del timezone local del dispositivo para Grupos y usar la misma semántica BA.
   - Reutilizar la lógica existente de Ranking si conviene conceptualmente, sin acoplar módulos de forma frágil.

2. **MANTENER** `_groups_candidate_matches` como conjunto amplio si sigue siendo útil para no excluir datos.

3. **REEMPLAZAR** en `_groups_last_activity_at` el criterio "candidato amplio = partido válido para actividad" por un criterio exacto de membresía semanal BRAMU:
   - para cada jugador/membresía, el alta es efectiva desde el lunes BA de la semana de `joined_at`;
   - la baja sigue cortando desde `left_at` real hacia adelante;
   - el partido mueve actividad solo si realmente cumple 3/4 bajo esa regla exacta;
   - `validated` y `correction_accepted` no mueven actividad si el partido no califica.

4. No duplicar fórmula de puntos/bonus en SQL.

5. Preservar contrato JSON de B1 y B2a.

## Tests obligatorios

Agregar cobertura explícita para borde de semana:
- alta lunes BA y partido del domingo anterior → NO califica;
- alta lunes BA y partido del mismo lunes anterior a la hora exacta del alta → SÍ puede calificar;
- alta domingo BA y partido del lunes de esa misma semana → SÍ puede calificar;
- un `correction_accepted` posterior sobre partido de semana anterior que no califica → NO mueve `lastActivityAt`;
- mismo caso dentro de semana calificable → SÍ mueve;
- frontend y backend resuelven la misma semana para timestamps cercanos a medianoche UTC/BA.

Re-correr:
- verify B2a;
- verify B1 membresía semanal;
- verify Fase A;
- focales de `groups.js` afectadas.

## Límites

- no iniciar B2b;
- no foto/Storage;
- no tocar main/Production/BRAMUlive;
- no rediseñar UI;
- no abrir nueva decisión de producto salvo incompatibilidad técnica real.

## Salida esperada

- corregir migración B2a existente o agregar una migración correctiva limpia, según convenga al historial (B2a todavía no fue aplicada en Staging);
- actualizar verify;
- tests focales;
- diff review;
- commit + push `origin/staging`;
- resultado corto en docs.

**NO aplicar todavía a Supabase Staging si el agente no tiene acceso. Central lo hará después de revisar.**
