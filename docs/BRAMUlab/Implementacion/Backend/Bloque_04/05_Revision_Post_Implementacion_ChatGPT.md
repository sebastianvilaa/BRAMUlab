# Backend Bloque 4 — Revisión post-implementación ChatGPT
## Correcciones obligatorias antes de aplicar la migración en Staging

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `77455c5a`  
**Estado:** implementación bien encaminada, **NO aplicar todavía a Supabase Staging**.

La revisión de código, migración y tests detectó cuatro problemas que conviene corregir antes de tocar el backend remoto.

---

## 1. Búsqueda: anti-enumeración incompleta

### Problema

`search_players` construye:

`v_like := '%' || v_query || '%'`

y después usa `ILIKE`.

Por lo tanto una query como `%%` (2 caracteres, pasa el mínimo) funciona como wildcard y puede devolver un listado general, anulando el objetivo de “mínimo 2 caracteres” como protección anti-enumeración.

Además, el test llamado “por @usuario” hoy envía el username **sin @**, por lo que no demuestra que escribir `@sebastian` realmente funcione.

### Corrección obligatoria

- Tratar la búsqueda como substring **literal**, no como patrón SQL controlado por el usuario.
- La solución más simple es evitar wildcard aportado por input, por ejemplo con `position(lower(query) in lower(campo)) > 0` o equivalente seguro.
- Aceptar un `@` inicial para username (`@usuario` debe encontrar `usuario`).
- Mantener mínimo 2 caracteres útiles.
- Agregar límite server-side razonable de longitud de query.
- Agregar tests:
  - búsqueda con `@username`;
  - `%%` NO enumera usuarios;
  - `__` NO enumera usuarios;
  - query demasiado larga se rechaza o devuelve vacío de forma controlada.

---

## 2. Claim: un error transitorio hoy puede destruir la posibilidad de reclamar

### Problema

En `runOfficializeAndEnter()`, si `claimProvisionalPlayer()` falla por un error transitorio (red, timeout, `rate_limited`, etc.), el token se conserva **pero el flujo sigue igual** hacia:

1. `complete_profile`;
2. `officializeLevel`.

Eso termina de registrar la cuenta P2. En el próximo intento, el claim ya no puede adoptarse automáticamente porque la cuenta pasó a estar completa (`account_already_registered`).

Es decir: conservar el token no alcanza; el flujo actual puede volver imposible el claim que intentaba preservar.

### Corrección obligatoria

- Si el claim falla con un error **definitivo**:
  - `claim_invalid`;
  - `claim_expired`;
  - `claim_already_used`;
  - `account_already_registered`;
  - `account_already_claimed_identity`;
  limpiar token y permitir que el alta normal continúe.
- Si falla por un error **transitorio**:
  - NO ejecutar `complete_profile`;
  - NO oficializar Nivel;
  - conservar token y borrador;
  - dejar una vía clara de reintento sin pedir un OTP nuevo.

La UI puede reutilizar el flujo existente, pero debe garantizar que, con sesión ya confirmada, reintentar vuelva a `runOfficializeAndEnter()` directamente en vez de volver a consumir el OTP.

Agregar test de lógica/UI para:
- fallo transitorio de claim;
- perfil sigue sin oficializar;
- token permanece;
- reintento posterior puede reclamar y continuar.

---

## 3. Rate limiting del claim: los intentos fallidos no quedan contados

### Problema

`claim_provisional_player` llama a `consume_rate_limit`, pero después usa `raise exception` para errores esperables como:

- `claim_invalid`;
- `claim_expired`;
- `claim_already_used`;
- `account_already_registered`.

En PostgreSQL, la excepción aborta la transacción de la RPC y también revierte el incremento del contador. Por eso el rate limit del claim **no contabiliza intentos inválidos**, que son justamente los que interesa limitar.

El test actual solo verifica rate limiting de búsqueda, no del claim.

### Corrección obligatoria

Para `claim_provisional_player`, los errores de negocio esperables deben poder devolver un resultado estructurado **sin abortar la transacción**, de modo que el incremento del rate limiter persista.

Recomendación mínima:

- cambiar el contrato del claim a un resultado acotado (por ejemplo JSON/tabla con `ok`, `code`, `player_id`);
- devolver `ok=false/code=...` para errores esperables;
- reservar excepciones para errores inesperados/de integridad;
- actualizar wrapper `Auth.claimProvisionalPlayer`;
- actualizar tests.

Agregar test explícito:
- realizar más de 10 tokens inválidos dentro de 15 min con la misma cuenta;
- después del límite, la RPC devuelve `rate_limited`;
- comprobar que los intentos inválidos previos sí consumieron cuota.

La búsqueda puede mantener su estrategia actual de excepción al exceder el límite: las búsquedas exitosas previas ya dejan el contador en el máximo y los siguientes intentos permanecen bloqueados.

---

## 4. Perfil público real: hoy muestra módulos vacíos y una acción local por nombre

### Problema

La rama server-backed de Perfil público:

- mantiene visible “Edad” con `—`, aunque ese dato no forma parte de la superficie pública real;
- deja visibles Efectividad / Partidos / Mejor racha sin datos reales;
- usa el Nivel actual como “Mejor nivel BRAMU”, que no es un máximo histórico comprobado;
- mantiene visible `AGREGAR JUGADOR`, que hoy escribe la lista local histórica por **nombre**, aunque Bloque 4 decidió no migrar esa función todavía.

Esto contradice la regla vigente de Nivel/Perfil:

> con 0 partidos oficiales: identidad + Nivel/estado, sin estadísticas agregadas, evolución ni módulos vacíos.

Y reintroduce una identidad por nombre dentro de un perfil que acabamos de resolver correctamente por `player_id`.

### Corrección obligatoria

Para un Perfil público server-backed mientras Bloque 5 todavía no aporta historial oficial:

- mostrar identidad real + `@usuario`;
- mostrar Nivel público y estado;
- mostrar mano/lado solo si existen;
- **ocultar la Edad**, no mostrar un placeholder;
- ocultar Efectividad/Partidos;
- ocultar Mejor racha;
- ocultar Mejor nivel BRAMU histórico;
- Ranking sigue oculto hasta Bloque 7;
- ocultar `AGREGAR JUGADOR` en esta rama mientras esa lista continúe siendo local/name-based.

El camino local/legacy puede conservar la UI anterior.

Cuando Bloque 5 aporte historial real, esos módulos podrán reactivarse con datos oficiales.

---

## 5. Validaciones de payload menores pero convenientes en el mismo hotfix

Agregar server-side:

- longitud máxima razonable para `p_query`;
- longitud máxima razonable para `p_display_name`;
- validar formato esperado del token de claim (64 hex) antes de procesarlo, **después** de consumir cuota para que un token inválido cuente como intento.

No sobrediseñar normalización de nombres: permitir acentos y caracteres humanos normales; solo impedir payloads absurdamente largos/control chars si corresponde.

---

## 6. Lo que NO hay que cambiar

Mantener:

- token 30 días;
- pgcrypto;
- UUID nuevo para cada provisional creada;
- nunca fusionar por nombre;
- `list_my_provisional_players` en vez de abrir `players`;
- preservación/reasignación de `pilot_events`;
- claim antes de persistir perfil/Nivel;
- Recientes oculto hasta Bloque 5;
- JUGADORES/carga manual fuera de alcance;
- fix de `sw.js` si la línea literal `\n` realmente estaba rompiendo `CACHE_NAME`;
- `main`, BRAMUlive, Supabase remoto y Vercel sin tocar.

---

## 7. Validación requerida después del hotfix

Antes de aplicar la migración remota:

- suite local sigue verde;
- `node --check` sobre JS tocados;
- `verify-bloque4.mjs` actualizado con:
  - @username real;
  - wildcard literal;
  - rate limit de claim sobre intentos inválidos;
  - claim transitorio no deja completar P2;
- documentación actualizada.

Después de esta corrección, recién corresponde aplicar la migración en Supabase Staging y ejecutar Bloques 2/3/4 reales.
