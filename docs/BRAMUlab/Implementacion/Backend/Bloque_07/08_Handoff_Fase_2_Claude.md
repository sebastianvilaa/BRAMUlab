# Backend Bloque 7 — Handoff Fase 2: cálculo semanal

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Fase 1 aplicada y validada en Supabase Staging.  
**Evidencia:** `07_Validacion_Central_Fase_1_Staging.md`

## 1. Objetivo único

Implementar la **Fase 2 de Bloque 7**:

> función server-side que construye de forma atómica e idempotente una edición semanal de Ranking para un cutoff dado y puede invocarse manualmente en Staging.

Esta fase todavía NO incluye:

- cron;
- RPCs de lectura para frontend;
- frontend;
- eliminación de mocks;
- Production.

## 2. Fuentes

Leer:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Ranking_BRAMU.md`
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/03_Revision_Central_Analisis.md`
5. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/05_Revision_Central_Fase_1.md`
6. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/07_Validacion_Central_Fase_1_Staging.md`

Inspeccionar únicamente las migraciones/funciones reales necesarias de Nivel, perfiles, ubicaciones y partidos.

## 3. Contrato temporal

V1:

- timezone: `America/Argentina/Buenos_Aires`;
- semana competitiva: lunes 00:00:00 → domingo 23:59:59;
- la edición publicada el lunes representa la semana que acaba de terminar;
- el cutoff efectivo es el lunes 00:00:00 BA siguiente al período;
- `period_start_at = cutoff - 7 días`;
- `period_end_at = cutoff - 1 unidad temporal mínima razonable`;
- `published_at` es el instante real de materialización;
- la edición histórica nunca se reescribe.

La función debe validar que el cutoff recibido representa un lunes 00:00:00 en Buenos Aires. No aceptar un timestamp arbitrario como edición oficial.

## 4. Nivel congelado

NO recalcular Nivel.

Reutilizar el ledger real.

Crear/extender el helper server-only mínimo necesario para devolver, as-of cutoff:

- estado vigente de Nivel;
- Nivel consolidado que Ranking debe usar;
- `algorithm_version`;
- última actividad computable;
- información suficiente para distinguir:
  - `CALIBRADO`;
  - `RECALIBRANDO` usando el último consolidado válido;
  - `CALIBRANDO`;
  - `PENDIENTE`.

Regla crítica:

- si el estado al corte es `RECALIBRANDO`, el valor provisional NO entra al Ranking;
- usar el último `CALIBRADO` anterior;
- si no existe consolidado anterior, no es elegible.

`last_computable_at` debe representar actividad de partido computable/validado. No usar un timestamp de cuestionario como sustituto si semánticamente no corresponde.

El helper nuevo debe ser service-only; revocar PUBLIC/anon/authenticated salvo que exista una razón explícita y documentada.

## 5. Estado de perfil as-of cutoff

Antes de escribir la función final, verificar qué inputs mutables de elegibilidad pueden reconstruirse realmente para el cutoff:

- `ranking_opt_in`;
- `competitive_branch`;
- ubicación;
- cuenta activa;
- exclusión de integridad.

NO usar silenciosamente `now()` para reconstruir un cutoff pasado si el dato puede haber cambiado después.

Si el esquema actual no permite reconstruir algún dato que el master exige congelar:

- agregar el contrato histórico/effective-time mínimo necesario;
- documentar exactamente por qué;
- no crear una arquitectura genérica de eventos si no hace falta.

Production todavía no tiene usuarios, por lo que este es el momento para cerrar correctamente el contrato antes del primer dato real.

## 6. Candidatos y elegibilidad

Solo cuentas reales/registradas pueden ocupar posición.

Evaluar, como mínimo, las condiciones vigentes:

- cuenta registrada, activa e identidad estable;
- política vigente de perfil visible;
- `ranking_opt_in=true`;
- ubicación estructurada/canónica suficiente;
- rama competitiva;
- Nivel `CALIBRADO` o `RECALIBRANDO` con consolidado anterior;
- actividad computable dentro de 180 días del cutoff;
- no excluido por integridad.

No inventar elegibilidad.

Los motivos deben usar vocabulario estable y auditable.

## 7. Scopes territoriales

Materializar solo los ámbitos oficiales propios:

- `local`;
- `provincial`;
- `pais`;
- `global`.

NO Mi red en esta fase.

Keys:

- Local → ID canónico de localidad;
- Provincial → clave canónica de país + provincia/área;
- País → country_code;
- Global → `GLOBAL`.

Una ubicación manual/no verificada no habilita Ranking territorial.

Para candidatos sin información suficiente para construir un scope territorial, no inventar un `scope_key`. Asegurar de todos modos auditabilidad de su exclusión mediante el mínimo mecanismo coherente con el esquema vigente.

## 8. Posición, empate y densidad

Orden por:

- `level_internal` exacto congelado, descendente;
- identificador estable únicamente como orden técnico, nunca para romper empate visible.

Empate exacto:

- competición `1,1,3`.

Densidad territorial:

- 0–4 → sin posiciones;
- 5–14 → `forming`;
- 15+ → `established`.

Global:

- se desbloquea solo cuando existen elegibles de al menos dos países;
- después aplica la misma densidad;
- si no está desbloqueado, no otorgar posiciones Global aunque el conteo bruto sea alto.

El snapshot base corresponde a `Todos los niveles`.

El filtro de Nivel se resolverá server-side sobre este snapshot en Fase 3:

- dentro de la banda se vuelve a ordenar por Nivel interno congelado;
- densidad se aplica después del filtro;
- el navegador nunca recalcula autoridad.

No crear snapshots separados por banda.

## 9. Atomicidad e idempotencia

Una edición visible implica edición completa.

La función debe:

- construir edición + filas en una sola transacción;
- nunca dejar `ranking_editions` sin todas sus filas;
- no UPDATE/DELETE de ediciones previas;
- ser idempotente para el mismo período/cutoff;
- tolerar dos invocaciones concurrentes sin crear dos ediciones ni una edición parcial.

Elegir el mecanismo más simple compatible con PostgreSQL, por ejemplo lock transaccional + unique ya existente.

## 10. Estado actual de Staging

Hoy no hay jugadores reales `CALIBRADO` después de la limpieza de Bloque 6.

Por lo tanto una edición real calculada hoy puede legítimamente no publicar posiciones.

Eso es PASS si refleja los datos reales.

NO fabricar población para que “se vea” Ranking.

Para probar puestos/empates/densidad, usar fixtures exclusivamente dentro de transacciones con `ROLLBACK`.

## 11. Seguridad

La función de publicación/cálculo:

- server-only;
- PUBLIC/anon/authenticated sin EXECUTE;
- service_role solo si realmente debe invocarla manualmente;
- `search_path` fijo;
- no aceptar player_id/scope_key del cliente;
- no debilitar RLS ni los REVOKE append-only de Fase 1.

Revisar explícitamente privilegios después de CREATE FUNCTION: PostgreSQL concede EXECUTE a PUBLIC por defecto.

## 12. Validación

Crear un runner SQL transaccional seguro para Fase 2.

Debe cubrir como mínimo:

- cutoff inválido;
- edición vacía/honesta con los datos reales actuales;
- idempotencia mismo cutoff;
- una edición no cambia si luego cambia Nivel LIVE;
- empate `1,1,3`;
- densidad 0–4 / 5–14 / 15+;
- Global bloqueado con un solo país;
- Global habilitado con 2+ países;
- CALIBRANDO sin puesto;
- RECALIBRANDO usa último consolidado;
- inactividad >180 días fuera;
- opt-out / ubicación no verificada / rama faltante / cuenta excluida con reason code correcto;
- ninguna edición previa se modifica.

Fixtures solo dentro de `BEGIN/ROLLBACK`.

No crear un runner HTTP que dependa de borrar después filas append-only.

## 13. Entrega de Claude

Preparar:

- migración/es de Fase 2;
- runner SQL transaccional;
- `docs/BRAMUlab/Implementacion/Backend/Bloque_07/09_Resultado_Fase_2_Claude.md`.

NO aplicar a Supabase todavía.

Un único commit lógico en `staging`.

Al terminar, respuesta corta:

- HEAD;
- archivos;
- tests estáticos realmente ejecutados;
- bloqueos reales;
- decisiones abiertas solo si el master no permite resolverlas.

Después detenerse.
