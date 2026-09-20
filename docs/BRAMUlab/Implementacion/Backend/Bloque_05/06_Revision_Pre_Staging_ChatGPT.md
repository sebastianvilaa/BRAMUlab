# Backend Bloque 5 — Revisión pre-Staging de ChatGPT
## Correcciones obligatorias antes de aplicar migraciones

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `992b3ae`

## Veredicto

La implementación es una buena base y la suite local quedó en verde, pero **NO debe aplicarse todavía a Supabase Staging**.

La revisión encontró varios problemas concretos de integridad/alcance que conviene corregir antes del primer intento real. Ninguno requiere decisión de Sebastián.

ChatGPT central sí tiene acceso operativo al proyecto Supabase Staging, así que después de esta corrección no hace falta convertir a Sebastián en operador: ChatGPT podrá aplicar/validar el backend real.

---

## 1. Bloque 5 no debe marcar un partido como `validated`

### Problema

La rama `matched_confirmed` de `create_or_attach_match` actualmente hace:

- `status = 'validated'`;
- `validated_at = now()`;
- acción `validated`;
- evento `match_validated`.

Eso contradice la frontera explícita de `04_Revision_ChatGPT.md`: la validación oficial y sus efectos pertenecen a Bloque 6.

Además, si Bloque 5 expone un partido como `validated` antes de que exista la transacción oficial de Bloque 6, el historial puede afirmar que el partido es oficial mientras Nivel/estadísticas todavía no fueron actualizados.

### Corrección requerida

Cuando el lado opuesto carga el mismo encuentro con score coincidente:

- converger al mismo `match_id`;
- registrar la conformidad rival de forma append-only;
- **mantener `status = 'pending_validation'`**;
- dejar `validated_at = null`;
- NO emitir `match_validated`;
- NO emitir acción `validated`.

Usar la acción `confirmed` ya prevista en `match_actions` para representar la conformidad rival surgida de una segunda declaración coincidente.

Después de la conformidad:

- `action_side = null` porque ya no queda acción humana pendiente;
- la respuesta puede conservar `code = 'matched_confirmed'`, pero debe devolver `status = 'pending_validation'` y, si ayuda al futuro Bloque 6, un flag descriptivo como `readyForValidation: true`.

Bloque 6 será quien consuma ese estado/facto y haga la oficialización atómica + efectos.

---

## 2. El límite de 5 pendientes solo bloquea CREAR un partido nuevo

### Problema

`create_or_attach_match` calcula `pending_action_limit_reached` antes de saber si la carga va a crear o adjuntarse a un encuentro existente.

La regla de producto vigente es:

> 5 pendientes accionables bloquean solamente iniciar una nueva carga.

Un usuario con 5 pendientes debe poder seguir actuando sobre encuentros ya existentes. Bloquear un attach puede impedir justamente resolver los pendientes.

### Corrección requerida

Mover la comprobación del límite al camino **0 candidatos / crear nuevo**.

No bloquear:

- attach a un partido existente;
- segunda declaración del mismo encuentro;
- conformidad rival;
- propuesta/revisión sobre un encuentro existente;
- desambiguación hacia un candidato existente.

Sí bloquear una creación realmente nueva cuando el caller ya tiene 5 pendientes accionables.

Agregar test específico:

- caller con 5 pendientes;
- intenta crear uno nuevo → bloqueado;
- intenta adjuntarse/responder a uno existente → permitido.

---

## 3. La idempotencia todavía tiene una carrera con la MISMA key

### Problema

La función hace:

1. SELECT de `match_submissions`;
2. si no existe, sigue;
3. mucho después hace INSERT.

Dos requests simultáneos con la **misma `idempotency_key`** pueden leer “no existe” al mismo tiempo. El advisory lock actual por fingerprint protege la deduplicación de encuentro, pero no protege todos los caminos de idempotencia, especialmente errores que retornan antes del fingerprint lock.

### Corrección requerida

Tomar al inicio, antes del SELECT de `match_submissions`, un advisory lock transaccional derivado de la `idempotency_key`.

Luego volver a consultar la submission bajo ese lock.

Agregar test concurrente con:

- misma key;
- mismo payload;
- dos requests simultáneos;
- ambos deben devolver el mismo resultado sin unique violation ni efectos dobles.

Mantener además el lock por fingerprint: resuelve otro problema diferente.

---

## 4. El hash de idempotencia debe cubrir todo el payload significativo

### Problema

`v_payload_hash` actual no incluye, entre otros:

- `reported_time_zone`;
- `scoring_system`;
- location name/lat/lng.

La misma key reutilizada con esos valores cambiados podría considerarse “mismo payload”.

### Corrección requerida

Incluir en el hash todos los inputs de negocio relevantes de la RPC, salvo valores puramente derivados internamente.

---

## 5. Las policies directas sobre `match_participants` son recursivas

### Problema

La policy de `match_participants` consulta `public.match_participants` dentro de la propia policy. Esto puede provocar recursión de RLS, y además el resto de las policies dependen indirectamente de esa tabla.

### Decisión técnica para el piloto

Preferir **lectura por RPC solamente**, igual que la filosofía usada en Bloque 4 para superficies acotadas.

Para las 7 tablas de partidos:

- mantener RLS habilitado;
- mantener deny-by-default;
- NO otorgar SELECT directo a `authenticated`;
- eliminar las policies de SELECT directo que no son necesarias;
- `service_role` conserva acceso;
- usuarios autenticados leen únicamente mediante:
  - `get_my_matches`;
  - `get_match_detail`;
  - demás RPCs acotadas.

Esto es más simple y reduce superficie de exposición.

Si durante implementación aparece un camino real que requiera SELECT directo, no agregar una policy recursiva: usar un helper `SECURITY DEFINER` específico y revisado.

---

## 6. `disambiguation_match_id` debe respetar la ventana temporal

### Problema

Cuando el cliente manda `p_disambiguation_match_id`, el SQL valida fingerprint/formato/estado pero no vuelve a validar la ventana temporal compatible.

Un cliente manipulado podría intentar adjuntar una declaración a otro partido histórico de las mismas parejas/formato.

### Corrección requerida

Aplicar al candidato explícito la MISMA condición temporal de ±3 h / mismo día sin hora que usa la búsqueda normal.

Si no cumple, devolver un error de negocio claro y no adjuntar.

---

## 7. El test de ambigüedad no puede crear hoy sus dos candidatos

### Problema

En `verify-bloque5.mjs`, `ambigCreate2` usa mismos participantes/ventana que el primer partido pero score distinto.

Con el algoritmo actual, esa segunda llamada se adjunta al primer partido como revisión; no crea un segundo `match_id`. Por lo tanto el setup de “dos candidatos ambiguos” no es determinístico.

### Corrección requerida

Crear deliberadamente el segundo encuentro con `disambiguationForceNew: true` (o el mecanismo final equivalente).

Después la tercera declaración debe obtener exactamente 2 candidatos y nunca fusionar automáticamente.

---

## 8. Aislar mejor el test del límite de pendientes

La sección final reutiliza cuentas A/B/C/D que ya participaron en muchos fixtures previos. Eso puede contaminar los contadores y bloquear a los propios creadores antes de llegar al caso que se quiere medir.

### Corrección requerida

Hacer el test del límite con fixtures suficientemente aislados para que:

- F empiece comprobablemente en 0;
- quienes crean los 5 pendientes no estén bloqueados por residuos de tests anteriores;
- el resultado sea determinístico.

No hace falta sobreingenierizar: pueden usarse cuentas adicionales de test o limpiar/aislar esa sección.

---

## 9. Tests que deben cambiar/agregarse antes de Staging

El verificador debe demostrar explícitamente:

1. segunda declaración coincidente → mismo `match_id`, conformidad registrada, pero sigue `pending_validation`;
2. no se crea `match_validated` en Bloque 5;
3. Nivel sigue intacto;
4. con 5 pendientes, crear nuevo se bloquea;
5. con 5 pendientes, attach/respuesta a partido existente sigue permitido;
6. misma idempotency key concurrente no duplica ni falla;
7. ambigüedad real con 2 candidatos funciona;
8. `disambiguation_match_id` fuera de ventana es rechazado;
9. acceso directo autenticado a tablas de matches sigue denegado; RPCs autorizadas funcionan.

---

## 10. Qué NO cambiar

Mantener:

- 7 tablas;
- advisory lock por fingerprint;
- canonicalización determinística por parejas;
- ventana ±3 horas / mismo día cuando no hay hora;
- búsqueda también contra futuros partidos `validated`;
- provisionales relacionadas;
- expiración lógica;
- Edge Function con motor JS compartido;
- outbox local escrito pero todavía sin wiring;
- no migrar historial legacy;
- no tocar `main`, Production ni BRAMUlive.

---

## 11. Próximo checkpoint

Claude debe corregir **código + tests + documentación**, correr suite local y pushear a `staging`.

**No aplicar todavía migraciones ni desplegar Edge Function desde Claude.**

Cuando quede el nuevo HEAD, ChatGPT central hará el siguiente paso de forma autónoma:

1. revisar diff final;
2. aplicar las migraciones a Supabase Staging con el conector disponible;
3. desplegar la Edge Function;
4. ejecutar validaciones reales posibles;
5. recién entonces decidir el wiring del frontend.

No se requiere intervención de Sebastián en esta corrección.
