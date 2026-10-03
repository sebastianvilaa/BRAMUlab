# Handoff — Migración de chat / Gate Central Invitados V04.29

**Fecha:** 03/10/2026
**Rama:** `staging`
**HEAD al migrar:** `eff016a8186c7dab6f0dd44ba57f5a7cbe0c23b0`
**Estado:** implementación de Claude terminada; gate Central EN CURSO.

## Lectura en el nuevo chat

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. este documento
4. `113_Handoff_Invitados_Identidad_Recuperacion_02OCT.md`
5. `116_Handoff_Implementacion_Invitados_Identidad_Recuperacion_03OCT.md`
6. `117_Resultado_Implementacion_Invitados_Identidad_Recuperacion_03OCT.md`

No reconstruir producto. Las decisiones del 113 siguen cerradas.

## Implementación recibida

Commit `024eb2306821353a3cd322db2538469d465f4efb`: backend de links múltiples, recovery de identidad, replay de Nivel, duplicados y tests.

Commit `eff016a8186c7dab6f0dd44ba57f5a7cbe0c23b0`: frontend V04.29 / 04.29-h1: JUGADORES SIN CUENTA + INVITAR, copiar link, ¿SOS {NOMBRE}?, SOY YO / NO SOY YO, retorno por auth, cuenta existente, recovery y modal de duplicados.

Migraciones nuevas:
- `20261003100000_g3_identity_recovery_links.sql`
- `20261003110000_g3_identity_recovery_core.sql`
- `20261003120000_g3_duplicate_match_resolution.sql`
- `20261003130000_g3_identity_recovery_account_deletion.sql`

Edge nueva:
- `process-identity-recovery`

Claude reportó 867 tests, 864 pass y los mismos 3 fallos preexistentes. Esto todavía no reemplaza el gate de Central.

## Revisión Central ya realizada

Central confirmó el HEAD, revisó el diff y las cuatro migraciones, la Edge y el núcleo de recovery.

También confirmó que:
- la cuenta registrada destino conserva su `player_id`;
- la provisional se reasocia hacia ella y queda como tombstone;
- `legal_acceptances` no se borra ni se muta;
- la DB Staging ya admite `identity_reassignment_delta` en `level_events`.

Las nuevas migraciones todavía NO se aplicaron a Supabase Staging y la Edge nueva todavía NO fue desplegada por Central.

## Hallazgo conocido del gate

La implementación actual de `resolve_duplicate_match_candidate` elige automáticamente un partido canónico cuando dos registros ya están `validated`, usando el `validated_at` más antiguo, y anula/revierte el otro.

Eso no es correcto si los dos partidos validados tienen score/resultado diferente.

## Decisión humana YA CONFIRMADA por Sebastián

Si dos registros ya validados representan el mismo encuentro:

- si el resultado coincide, puede quedar un único encuentro según la lógica segura;
- si el score/resultado difiere, BRAMU NO debe elegir automáticamente cuál gana por antigüedad;
- debe reutilizar el mecanismo vigente de revisión/corrección/validación;
- el conflicto queda pendiente;
- la pareja contraria debe confirmar cuál resultado queda oficial;
- recién después se elimina la doble contabilización;
- no inventar arbitraje nuevo.

Esto no es una decisión abierta. Además coincide con el 113: si scores/revisiones difieren, reutilizar corrección/validación vigente.

## Continuación exacta del gate

En el nuevo chat:

1. terminar la revisión técnica completa del diff;
2. revisar especialmente duplicados SAME/DIFFERENT, dos validated, score igual/distinto, atomicidad y reversión;
3. revisar Nivel recuperado, Grupos, Stats, Intelligence, RLS, rate limits e idempotencia;
4. agrupar todos los hallazgos;
5. si hace falta, devolver UN solo prompt correctivo a Claude;
6. solo cuando pase ese gate, aplicar migraciones en Supabase Staging, desplegar `process-identity-recovery`, correr verifies/concurrencia/advisors y después QA real/visual.

No tocar `main`, Production ni BRAMUlive.

## Estado al migrar

- HEAD: `eff016a8186c7dab6f0dd44ba57f5a7cbe0c23b0`
- V04.29 / 04.29-h1
- Gate Central: EN CURSO
- Migraciones nuevas en Staging: NO aplicadas
- Edge nueva en Staging: NO desplegada
- DECISIÓN ABIERTA humana: ninguna
