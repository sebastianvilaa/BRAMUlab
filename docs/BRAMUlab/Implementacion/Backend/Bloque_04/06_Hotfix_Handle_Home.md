# Backend Bloque 4 — Hotfix handle canónico en Home

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**Estado de Bloque 4:** validación manual todavía abierta; el claim completo sigue pendiente.

## Hallazgo de QA manual

En el Preview de Staging sobre `63a0511`, la misma cuenta real mostraba:

- Home: `@sebastian`
- Perfil → Mi perfil / Mis datos: `@sebas`

No eran dos usernames distintos del backend.

## Causa

`renderPlayerCard()` en Home seguía usando:

`buildPlayerHandle(currentPlayerName)`

Ese helper es legacy y deriva un handle informal a partir del primer nombre visible. Fue creado antes de que existiera un username real/canónico.

En cambio, Perfil ya usa correctamente:

`Store.getCurrentUser().username`

Para la cuenta observada, el nombre visible permite derivar `@sebastian`, pero el username real persistido es `sebas`.

## Corrección

Solo se modifica la fuente del handle de Home:

- si la cuenta activa tiene `username`, Home muestra `@<username>`;
- si es una identidad local/legacy sin username real, se conserva el fallback anterior mediante `buildPlayerHandle(currentPlayerName)`.

No se cambia signup, Perfil, búsqueda, claim, Nivel, Ranking ni ninguna otra resolución de identidad.

Se bumpea el sufijo de assets de `04.10-h9` a `04.10-h10` en `index.html` y `sw.js` para evitar que el service worker sirva el `app.js` anterior durante la revalidación.

## Claim manual pendiente

La prueba manual dejó intencionalmente sin consumir la identidad provisional:

- nombre: `Invitado de prueba mua40lea`
- estado observado en Staging: `provisional`
- claim: `pending`
- el token crudo no se documenta.

**No limpiar ni regenerar esa identidad todavía.** Debe reutilizarse para continuar la prueba de claim completa después de desplegar este hotfix.

## Validación requerida

Antes de cerrar Bloque 4:

1. confirmar en Preview nuevo que Home, Mi Perfil y Mis Datos muestran el mismo `@usuario` real;
2. continuar la prueba manual con el claim pendiente;
3. completar signup + OTP + adopción del `player_id` provisional + Nivel/Home;
4. comprobar segundo uso del link;
5. smoke test normal sin claim.

Bloque 4 permanece abierto hasta completar esa validación.
