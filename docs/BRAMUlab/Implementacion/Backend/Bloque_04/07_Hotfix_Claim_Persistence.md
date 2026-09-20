# Backend Bloque 4 — Hotfix de persistencia de claim durante signup

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**Estado:** corregido en código; Bloque 4 sigue ABIERTO hasta revalidar el claim completo.

## Falla observada en Staging

Preview probado: `a700759` (assets h10).

El link existente de:

- `Invitado de prueba mua40lea`

fue abierto sin sesión. La UI reconoció la intención de claim y permitió completar alta, Perfil, Nivel y OTP real.

Sin embargo, el resultado server-side fue:

- claim original: sigue `pending`;
- provisional original: sigue sin `auth_user_id`;
- cuenta nueva `@claim_mualea_20`: quedó en un `player_id` distinto;
- Nivel de la cuenta nueva: `CALIBRANDO`;
- no existe evento `provisional_claimed` para esa cuenta.

No se borró ni modificó la provisional ni la cuenta nueva.

## Evidencia que identifica el punto de falla

La cuenta nueva no tiene ninguna fila de `api_rate_limits` para la acción de claim.

Eso es importante porque `claim_provisional_player` consume rate limit al entrar en la RPC, incluso para tokens inválidos.

Por lo tanto, en esta prueba la RPC de claim **nunca fue invocada**.

La falla ocurrió antes del backend: `runOfficializeAndEnter()` llegó sin token pendiente y siguió con `complete_profile` + oficialización de Nivel.

## Causa en frontend

`captureClaimTokenFromUrl()` hacía:

1. leer `?claim=<token>`;
2. llamar a `Store.saveClaimToken(token)`;
3. mostrar el aviso de invitación;
4. borrar `?claim=` de la URL.

Pero ignoraba el valor booleano devuelto por `Store.saveClaimToken()`.

`Store.saveClaimToken()` dependía al 100% de `localStorage`. Si el navegador/contexto privado rechazaba esa escritura:

- la UI igualmente mostraba que había reconocido el claim;
- la app igualmente quitaba el token de la URL;
- no quedaba copia en memoria;
- al terminar OTP, `Store.loadClaimToken()` devolvía `null`;
- `runOfficializeAndEnter()` no llamaba a la RPC y el alta seguía como cuenta normal.

El diseño permitía por lo tanto perder silenciosamente la intención de claim.

## Corrección aplicada

### `store.js`

`CLAIM_TOKEN` ahora tiene fallback volátil en memoria:

- si `localStorage` funciona, se comporta como antes;
- si la escritura falla, el token sigue disponible durante la misma página;
- `clearClaimToken()` limpia almacenamiento y fallback.

### `app.js`

`captureClaimTokenFromUrl()` ahora:

- no descarta el claim si Auth todavía no está configurado;
- revisa si `saveClaimToken` logró persistir;
- si la persistencia falla, conserva `?claim=` en la URL;
- la copia volátil permite continuar el flujo sin depender de la escritura local;
- solo limpia el query param cuando el token quedó persistido.

Así, un fallo de storage ya no puede convertir silenciosamente un alta con claim en un alta normal.

### Cache

Assets bump de `h10` a `h11` para evitar que la revalidación use `store.js`/`app.js` viejos.

## Test automatizado agregado

`supabase/tests/verify-claim-token-storage.mjs`

Debe comprobar:

1. `localStorage.setItem` falla;
2. `saveClaimToken` informa que no persistió;
3. `loadClaimToken` conserva igualmente el token mediante fallback volátil;
4. `clearClaimToken` limpia ese fallback;
5. con storage disponible, el token persiste;
6. una nueva instancia de Store (simulación de reload) recupera el token persistido.

## Estado de los datos manuales

Se conservaron deliberadamente para diagnóstico/revalidación:

- provisional: `Invitado de prueba mua40lea`;
- claim: `pending`, vigente;
- cuenta fallida de prueba: `@claim_mualea_20`, con su `player_id` propio y Nivel `CALIBRANDO`.

**No borrar, no fusionar y no rotar el claim todavía.**

La cuenta `@claim_mualea_20` ya terminó onboarding, por lo que NO debe usarse para auto-reclamar la provisional: ese caso está fuera del auto-merge del piloto.

## Próximo criterio

Antes de pedir otra prueba manual:

- ejecutar el test local nuevo;
- `node --check` de JS tocados;
- suite local existente;
- revisar que no haya regresión en Bloques 2–4.

Solo después de eso se vuelve a Staging para revalidar un signup con claim.
