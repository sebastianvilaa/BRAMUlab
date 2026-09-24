# Backend Bloque 8 — Cierre BRAMU Intelligence V1

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional final:** `ba3a0b9360e2e88730a0ab8a3a9532bb765293ec`  
**Bundle final:** `04.10-h26`  
**Estado:** **BLOQUE 8 CERRADO EN STAGING**

## 1. Resultado

BRAMU Intelligence V1 queda implementada de punta a punta con núcleo determinístico y evidencia real.

Fases obligatorias:

- A — Datos y derivados: CERRADA;
- B — Claims y evidencia: CERRADA;
- C — Relevancia y memoria editorial: CERRADA;
- D — Plantillas, persistencia y UX: CERRADA;
- E — Integración Nivel + Ranking: CERRADA.

F — capa generativa: **opcional**, no bloquea la primera salida productiva.

## 2. Garantías cerradas

Intelligence V1:

- no inventa estadísticas;
- no inventa entidades;
- no inventa acciones no registradas;
- no emite claims sin evidencia;
- distingue historia personal de impacto oficial;
- usa identidad estable para relaciones;
- conserva evidencia y auditoría server-side;
- persiste output y memoria por checkpoint cronológico;
- no cambia el texto histórico al reabrir sin cambio de fuente/reglas;
- invalida determinísticamente ante corrección, identidad o autoridad oficial nueva;
- consume Nivel oficial sin recalcularlo;
- consume Ranking semanal sin atribuir causalidad a un partido;
- puede abstenerse.

## 3. Componentes productivos en Staging

Backend:

- `get_player_intelligence_history`;
- `intelligence_match_outputs`;
- `get-match-intelligence` version 2;
- ampliación de `get_my_ranking_position` para hitos históricos.

Frontend:

- Resumen del partido con BRAMU Intelligence V1;
- principal + secundarios;
- “Por qué aparece”;
- integración Home / TU MOMENTO para hitos semanales materiales;
- bundle `04.10-h26`.

## 4. QA

Se validó el camino real:

- partido creado por UI;
- Intelligence personal pending;
- validación real;
- oficialización de Nivel;
- regeneración por snapshot oficial;
- auditoría Familia H;
- idempotencia;
- Home sin hito falso de Ranking.

## 5. Decisión abierta no bloqueante

Permanece para una decisión posterior de producto:

**¿Un partido oculto del Historial puede alimentar BRAMU Intelligence personal?**

Comportamiento vigente:

- `p_include_hidden=false`;
- ocultos no alimentan Intelligence personal.

No bloquea el cierre técnico de V1 ni la preparación de Production.

## 6. Próximo paso

No implementar F por defecto.

El siguiente trabajo recomendado es:

1. consolidar **pendientes reales pre-Production** ya definidos en documentación/decisiones previas;
2. separar:
   - obligatorio antes de abrir Production;
   - conveniente antes de invitar amigos;
   - futuro;
3. después ejecutar **Bloque 9 — endurecimiento y salida**.

No tocar main/Production hasta autorización explícita.
