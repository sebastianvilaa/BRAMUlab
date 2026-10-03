# Gate Central técnico — Invitados / Identidad / Recuperación V04.29-h2

**Fecha:** 03/10/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `50675a8331a12eb1db8f6ca4055097990d36d9df`  
**Versión:** BRAMUlab **V04.29** · bundle **04.29-h2**  
**Estado:** **PASS TÉCNICO CENTRAL EN STAGING**. Pendiente únicamente QA visual/browser del flujo de duplicados con score distinto.

## 1. Qué revisó Central

Central retomó desde el handoff 118, leyó 113/116/117 y las fuentes maestras afectadas, y revisó el único commit correctivo de Claude más la migración forward-only:

`supabase/migrations/20261003140000_g3b_duplicate_score_confirmation_counts_locks.sql`

No se tocó `main`, Production ni BRAMUlive.

## 2. Estado remoto encontrado

Antes de aplicar G3b, Supabase Staging ya tenía aplicadas las cuatro migraciones G3 base y `process-identity-recovery` estaba ACTIVE v1. El preflight dio:

- doble-slot existentes: **0**;
- `player_identity_recoveries`: **0**;
- `match_duplicate_candidates`: **0**.

Por eso no hubo data repair/backfill.

## 3. Aplicación en Staging

Central aplicó únicamente:

`g3b_duplicate_score_confirmation_counts_locks`

Supabase la registró como versión:

`20261003162527`

La Edge `process-identity-recovery` no cambió y continúa ACTIVE v1 con JWT obligatorio.

El deployment Vercel asociado al commit funcional figura SUCCESS.

## 4. Gate estructural / seguridad

PASS:

- `match_duplicate_candidates.status` admite `awaiting_confirmation`;
- existe `match_participants_one_slot_per_player`;
- siguen existiendo 0 doble-slot;
- helpers G3b internos no son ejecutables por anon/authenticated;
- RPC públicas necesarias siguen authenticated-only;
- `get_my_matches` quedó correctamente re-granted después de drop/create;
- verify transaccional `verify-g3-identity-recovery.sql`: PASS con ROLLBACK y sin residuos.

Advisors después de DDL:

- sin hallazgo nuevo bloqueante;
- RLS enabled/no-policy en tablas server-only es intencional deny-by-default;
- warnings de SECURITY DEFINER corresponden a RPC autenticadas deliberadas;
- dos índices G3b figuran unused inmediatamente después de crearse, sin significado de regresión.

## 5. Gate funcional real en Supabase Staging

Central agregó pruebas remotas puntuales dentro de transacciones con ROLLBACK.

### Duplicado histórico — score distinto — rechazo

Fixture validated+validated de más de 3 días:

1. `SÍ, ES EL MISMO` devolvió `merge_pending_confirmation`;
2. candidato pasó a `awaiting_confirmation`;
3. ambos partidos siguieron validated, sin anulación prematura;
4. la pareja contraria pudo responder aunque la ventana ordinaria de 3 días estaba vencida;
5. al rechazar, se conservó el score vigente;
6. recién entonces se anuló exactamente un secundario;
7. candidate quedó `resolved_same`;
8. corrección pendiente quedó limpia.

**PASS.**

### Duplicado histórico — score distinto — aceptación

Mismo seam:

1. SAME dejó revisión alternativa pendiente;
2. la pareja contraria autorizó aceptación fuera de los 3 días por origen duplicado;
3. `officialize_match_validation(trigger=correction_accepted)` promovió la revisión alternativa;
4. la finalización ocurrió en la misma transacción;
5. recién entonces se anuló exactamente un secundario;
6. candidate quedó `resolved_same`;
7. `chosenScore = alternative`.

**PASS.**

### Nivel — contadores 5+3

Fixture con dos partidos donde ambos tienen `match_level_results applied+eligible`, pero solo uno posee fila propia del target en `match_level_result_players`.

Resultado:

- `_level_evidence_counts(target)` → 1 partido y únicamente los rivales del partido computable;
- `_level_recovery_counts(target)` devuelve la misma verdad;
- los rivales exclusivos del partido sin fila propia no cuentan.

**PASS.**

## 6. Concurrencia

La revisión del SQL confirma la jerarquía consistente:

`provisional advisory lock → target advisory lock → matches ordenados`

más la unicidad defensiva `(match_id, player_id)`.

Claude agregó y ejecutó concurrencia sobre Postgres real multi-conexión:

- 6/6 escenarios;
- 40 iteraciones por corrida;
- dos corridas;
- sin deadlocks/doble-slot/tombstone reincorporado;
- excluyendo G3b, 5/6 escenarios detectan el bug previo.

Central no repitió una batería equivalente sobre Staging real porque ese script deja evidencia append-only y la prueba adicional sería redundante frente al riesgo ya cubierto.

## 7. Hallazgos del gate 118

1. **Scores distintos:** corregido y verificado remoto.
2. **distinct_opponents / rated_matches:** corregido y verificado remoto.
3. **carreras doble-slot / provisional recuperada:** corregido, con revisión estructural + UNIQUE + test real multi-conexión de Claude.
4. **Frontend afirma “Unificamos” antes de tiempo:** corregido; backend distingue `merged` de `merge_pending_confirmation` y frontend usa copy pendiente.

No apareció una decisión humana nueva.

## 8. Único pendiente

QA visual/browser sobre Staging protegido:

- provocar/reutilizar un caso de duplicado con score distinto;
- confirmar que SAME muestra: `Listo. El resultado quedó pendiente de confirmación de la otra pareja.`;
- desde la pareja contraria, abrir la corrección existente;
- probar aceptación y/o rechazo;
- confirmar que el flujo se siente como corrección normal, sin pantalla nueva ni estado incoherente.

Central intentó acceder mediante el conector Vercel disponible, pero ese conector no está autorizado para el scope protegido `bramu-lab`. No se requiere intervención técnica manual de Sebastián: este punto debe resolverse con un agente navegador con acceso al Staging protegido.

## 9. No tocar

- `main`;
- Production;
- BRAMUlive.

Hasta cerrar el gate visual, no declarar G3 completamente cerrado para Production.
