# BRAMUlab — Handoff hotfix validación atascada / self-healing faltante

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Bundle afectado:** `04.11-h10`  
**Objetivo:** corregir una regresión real detectada en Laboratorio físico: un partido puede quedar con ambas parejas confirmadas, `readyForValidation=true`, pero seguir `pending_validation`; h10 conserva ese flag pero no ejecuta el self-healing que el backend ya diseñó.

## 1. Evidencia real de Central

Cuenta física de Sebastián, sesión iPhone Staging.

Partido observado:

`aa41e8d9-6d16-4c47-8928-187c5fad5ccd`

Estado real leído en Supabase Staging:

- `status = pending_validation`
- `action_side = null`
- `has_open_identity = false`
- deadline vigente
- las dos parejas ya registraron conformidad
- último ciclo de acciones:
  - revisión propuesta;
  - confirmación de la otra pareja;
  - revisión propuesta;
  - confirmación de la otra pareja;
  - revisión propuesta;
  - confirmación final de la otra pareja.
- por contrato de lectura, este estado equivale a `readyForValidation=true`.

Logs alrededor de la reproducción física:

- lecturas normales `get_my_matches` / `get_match_detail`: HTTP 200;
- NO aparece ninguna invocación nueva a `officialize-match` cuando la app relee este estado;
- hubo un 401 transitorio de `level_states` al reabrir sesión, seguido inmediatamente por refresh token 200 y lecturas 200; no es la causa de esta validación atascada.

## 2. Causa raíz confirmada por código

El backend ya implementó el contrato de recuperación:

- `get_my_matches` y `get_match_detail` exponen `readyForValidation`;
- `matches.js` lo normaliza;
- `match-sync.js` lo conserva en la forma local.

La Edge Function `supabase/functions/officialize-match/index.ts` documenta explícitamente:

> “El reintento silencioso que el cliente dispara al detectar readyForValidation=true en una lectura (self-healing...)”

y `confirm_match_validation` soporta exactamente el estado atascado:

- si `status=pending_validation`;
- `action_side IS NULL`;
- sin incidencia abierta;
- deadline vigente;

devuelve:

`{ok:true, code:'already_confirmed', readyForValidation:true, idempotentReturn:true}`

y la Edge Function continúa hacia `officializeMatch(..., trigger='initial')`.

**Pero h10 no consume `readyForValidation` en `app.js`.**

La búsqueda de Central confirmó que:

- `readyForValidation` se transporta correctamente por `matches.js` / `match-sync.js`;
- no existe lógica activa en `app.js` que dispare el reintento silencioso;
- `refreshServerMatches()` únicamente guarda el cache;
- `paintB6Actions()` decide acciones por `isActionMine/actionSide` y con `actionSide=null` no deja ninguna vía de recuperación.

Esto deja un partido imposible de completar desde UI si la primera oficialización falló DESPUÉS de registrar la segunda conformidad.

## 3. Hotfix esperado

### FUSIONAR — self-healing real, acotado e idempotente

Implementar el contrato que ya estaba diseñado:

Cuando una lectura server-backed detecta un partido con:

- `status === 'pending_validation'`;
- `readyForValidation === true`;
- sin incidencia de identidad abierta;

el cliente debe intentar **una vez de forma silenciosa**:

`MV.officializeMatch(matchId)`

y, si tiene éxito, releer el estado canónico.

### Recomendación de integración

Preferir un único choke point en/desde `refreshServerMatches()`, porque:

- ya es la lectura canónica usada al abrir Home/Historial y después de acciones;
- recibe `ready_for_validation` real;
- evita depender de que el usuario abra el Resumen;
- cumple exactamente el comentario contractual de “al detectar readyForValidation=true en una lectura”.

Puede extraerse a helper puro/testeable si simplifica las pruebas.

Debe existir una guardia explícita para evitar:

- recursión infinita;
- dos llamadas simultáneas para el mismo `matchId`;
- loop continuo si el backend devuelve error persistente.

Patrón esperado, conceptualmente:

1. leer `get_my_matches`;
2. persistir/cachear la lectura;
3. detectar candidatos `readyForValidation`;
4. por cada candidato elegible, ejecutar como máximo un intento dentro de ese ciclo;
5. si alguno oficializa con éxito, hacer UNA relectura canónica con self-heal desactivado para esa reentrada;
6. si falla, no mostrar toast por una acción automática ni hacer loop; dejar evidencia de consola y permitir un intento futuro en una lectura posterior.

No convertir esto en polling/realtime.

### UX

Mientras el self-healing es silencioso:

- no inventar un CTA nuevo si no hace falta;
- no mostrar “Partido confirmado” como si el usuario acabara de tocar algo;
- el estado debe simplemente converger a oficial/validado al refrescar.

Si se considera imprescindible mostrar algo en Resumen mientras converge, usar texto neutral tipo `Finalizando validación…`, pero evitar agregar UI si el auto-reintento resuelve correctamente.

## 4. Mantener intacto

**NO TOCAR:**

- fórmula de Nivel;
- `officialize_match_validation` salvo que una evidencia nueva demuestre un defecto;
- `confirm_match_validation` (ya soporta `action_side=null` correctamente);
- Ranking;
- Intelligence;
- P0.2/P0.3;
- main / Production / BRAMUlive;
- popup de eventos;
- realtime/polling.

No rehacer el fix de precisión: Central ya verificó que el partido real `aa41...` puede oficializar correctamente con el backend actualizado cuando la llamada efectivamente llega.

## 5. Pruebas mínimas obligatorias

### Unitarias/frontend

Agregar cobertura para:

1. fila `pending_validation + readyForValidation=true` dispara exactamente una invocación a `MV.officializeMatch`;
2. una fila normal `pending_validation + readyForValidation=false` no dispara nada;
3. una fila `validated` no dispara nada;
4. una fila con identidad abierta no dispara self-heal;
5. fallo del intento automático no crea loop ni segunda llamada en el mismo ciclo;
6. éxito provoca una sola relectura canónica;
7. dos refresh concurrentes no duplican oficialización para el mismo match;
8. no aparece toast de acción manual por el self-heal.

### Regresión

- suite completa Node;
- `tests.html`;
- validar que h10 no cambia ninguna otra UX de validación/corrección/identidad.

## 6. Staging real

Después de implementación local + tests:

1. commit lógico único;
2. push a `origin/staging`;
3. Vercel Staging verde;
4. identificar nuevo bundle como `04.11-h11` (hotfix, no nueva función);
5. **NO tocar la fila real `aa41...` por SQL manual**;
6. dejar que el frontend h11 la detecte y la auto-repare mediante el camino real `officialize-match`.

Eso convierte el mismo caso roto en prueba E2E real del hotfix.

Después de deploy, Central revisará logs + estado de ese mismo match antes de pedirle a Sebastián que repita la validación.

## 7. Entrega

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/38_Resultado_Hotfix_Validacion_Self_Healing_27SEP.md`

Incluir:

- causa raíz;
- archivos tocados;
- tests;
- bundle;
- commit;
- deploy;
- cualquier riesgo residual REAL.

No cerrar el punto D del Laboratorio hasta que Central confirme el mismo partido en Staging real.
