# Backend Bloque 8 — Validación técnica de Fase D en Staging

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `30b9fb8538cfb0f65f8e43c33d50f7541e4db425`  
**Estado:** **VALIDACIÓN TÉCNICA PASS — pendiente QA real de navegador antes de cerrar Fase D.**

## 1. Revisión central final de código

ChatGPT central revisó D06 sobre el cierre ya aprobado de H01 + D01–D05.

Resultado:

- auditoría completa persistida por checkpoint;
- `allClaims` agrega trazabilidad sin participar de scoring/selección;
- audit conserva claims de B afirmados y descartados;
- audit conserva evaluación de C, scores, penalizaciones y motivos;
- selección principal/secundarios se cruza con `templateId` final de D;
- checkpoints reutilizados reutilizan el audit exacto;
- output público no contiene audit ni memoria interna;
- sin cambios de frontend ni bundle en D06.

Claude reportó **136/136 PASS** para A+B+C+D.

No queda bloqueo de código antes de aplicar Staging.

## 2. Migración — aplicada en Supabase Staging

Proyecto:

- `bramulab-staging`
- ref: `serxtivkfnptzurnvewg`

Antes de aplicar, ChatGPT central ejecutó la migración completa dentro de una transacción con `ROLLBACK`.

Dry-run real:

- tabla creada: PASS;
- `memory_after jsonb not null`: PASS;
- `audit jsonb not null`: PASS;
- RLS activo: PASS.

Migración aplicada:

- nombre Supabase: `bloque8_fased_intelligence_persistence`;
- versión registrada: `20260923175918`;
- archivo fuente: `supabase/migrations/20260923180000_bloque8_fased_intelligence_persistence.sql`.

### Seguridad verificada después de aplicar

`public.intelligence_match_outputs`:

- existe: PASS;
- 8 columnas;
- `memory_after` NOT NULL: PASS;
- `audit` NOT NULL: PASS;
- RLS habilitado: PASS;
- políticas RLS para cliente: **0**;
- `anon` SELECT grant: **false**;
- `authenticated` SELECT grant: **false**;
- `service_role` SELECT: **true**;
- `service_role` INSERT/UPDATE/DELETE: **true**.

El navegador no puede leer ni escribir checkpoints directamente.

## 3. Edge Function — desplegada en Supabase Staging

Función:

`get-match-intelligence`

Estado real después del deploy:

- status: **ACTIVE**;
- version: **1**;
- `verify_jwt=true`;
- sin import map;
- bundle desplegado con los módulos compartidos A→D del mismo HEAD de `staging`.

La función desplegada:

- recibe solo `matchId`;
- deriva `callerPlayerId` desde la sesión;
- obtiene la historia mediante la RPC autenticada de Fase A;
- hace replay cronológico por checkpoints;
- persiste `output + memory_after + audit` únicamente server-side;
- responde al cliente solo con `output`.

## 4. Estado de datos real

Al momento de esta validación Staging tiene:

- 7 jugadores;
- 0 partidos;
- 0 participantes de partidos;
- 0 outputs de Intelligence.

Por eso no corresponde afirmar todavía un PASS end-to-end de una salida real: falta provocar **un único partido real de QA desde la interfaz**.

No se crean fixtures SQL para evitar probar un camino diferente del que usará el usuario.

## 5. Qué evidencia falta para cerrar D

Únicamente QA real de navegador sobre Preview Staging:

1. crear un partido real por la UI;
2. abrir su Resumen;
3. comprobar que BRAMU Intelligence V1 carga desde la Edge Function;
4. verificar anatomía/copy/`Por qué aparece`;
5. reabrir y comprobar idempotencia visual;
6. confirmar que no aparece el Intelligence legacy;
7. confirmar que no hay error de red/runtime originado en BRAMUlab;
8. verificar después en base que existe un checkpoint con `output + memory_after + audit`.

Después de esa evidencia puede cerrarse Fase D.

No avanzar a E antes de ese gate.
