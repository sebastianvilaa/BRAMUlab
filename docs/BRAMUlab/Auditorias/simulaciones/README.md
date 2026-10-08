# Simulaciones de la Auditoría de Nivel y Ranking (aisladas del código operativo)

Reproducen los resultados de `../Auditoria_Nivel_Ranking_Convergencia.md`.

- **No modifican nada**: cargan el motor real de `bramulab/` (solo lectura) dentro de un contexto `vm` y escriben únicamente en `resultados/`.
- **Sin red, sin Supabase, sin datos reales**. Todo es sintético y determinístico (semillas fijas).
- Requisito: Node ≥ 18. Sin dependencias (`npm install` no hace falta).

```bash
cd docs/BRAMUlab/Auditorias/simulaciones
node 00-validacion.mjs                 # valida el simulador contra el Anexo B de Nivel_BRAMU.md y sondea el círculo cerrado
REPS=30 node 01-grupos-cerrados.mjs    # escenarios A, B, C, E (≈ 4 min)
REPS=30 node 02-puentes.mjs            # escenario D (≈ 6 min)
REPS=30 node 03-ranking.mjs            # escenario F (≈ 10 min)
REPS=30 node 04-sesgo-individual.mjs   # escenario H
REPS=30 node 06-ingresantes-y-circulo.mjs   # escenarios G y C2
node 05-resumen.mjs                    # regenera resultados/resumen.md desde los JSON
```

| Archivo | Qué es |
|---|---|
| `sim-core.mjs` | Carga el motor real, mundo simulado, generador de resultados, respuestas del cuestionario, métricas |
| `scenario-lib.mjs` | Reloj, muestreo de cuartetos, agregación |
| `00`–`06` | Un script por familia de escenarios |
| `resultados/*.json` | Salida cruda (media y desvío por celda) |
| `resultados/resumen.md` | Tablas legibles generadas desde los JSON |

## Qué es real y qué es hipótesis

**Código real (importado, no copiado):** estimador del cuestionario `nivel_inicial_v1_3`, elegibilidad/repetición/compañero/círculo (`level-context.js`), motor de partido (`level.js`), diferencia neta aplicada a `level_states` (`match-level-engine.js`), inactividad.

**Modelo simplificado (hipótesis del experimento):** capacidad real θ de cada jugador; cómo responde el cuestionario (percepción = θ + sesgo + ruido → posición del slider más cercana, con la adaptatividad real); generador de resultados juego a juego; la regla CALIBRANDO→CALIBRADO (5 partidos y 3 rivales, tal como la SQL); ritmo de juego (1 partido por jugador por semana salvo indicación); quién juega con quién.

**Modos del orquestador:** `real` (solo los 4 participantes en `playerStates`, como `match-officialize-core.ts`), `fullDict` (contrafactual con todos los jugadores) y `noCircle` (detección de círculo desactivada en memoria, sin tocar archivos).
