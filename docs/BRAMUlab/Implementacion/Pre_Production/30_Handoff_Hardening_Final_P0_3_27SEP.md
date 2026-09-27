# BRAMUlab — Handoff P0.3 hardening final antes de Staging real

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Base revisada:** `21fa4b44802a04711fa6524a11e082f449bccf32`  
**Objetivo:** cerrar ajustes de seguridad/operación del orquestador P0.3 antes de que Central aplique migraciones y haga la prueba destructiva controlada en Supabase Staging.

## 1. Estado de la revisión central

La segunda vuelta resolvió correctamente los tres problemas principales:

- corte de acceso BRAMU ante JWT viejo;
- limpieza de Storage antes de borrar Auth;
- presentación anónima en Ranking publicado sin reescribir `ranking_rows`.

No reabrir esos diseños salvo que uno de los puntos de abajo obligue a ajustar el flujo.

## 2. Ajustes obligatorios encontrados por Central

### A — El `authUserId` no debe quedar retenido permanentemente

La implementación actual persiste:

`pilot_events.properties.authUserId`

para poder retomar Fases 2/3 después de un fallo parcial. Eso es razonable **mientras la eliminación está incompleta**, pero no corresponde conservarlo indefinidamente después de borrar la cuenta Auth: es un identificador técnico de la identidad eliminada y P0.3 ya decidió minimizar/eliminar identificadores personales.

**FUSIONAR** un cierre/finalización del procedimiento:

- mientras la operación esté incompleta, el `authUserId` puede existir solo como dato operativo mínimo para retry;
- después de confirmar que la cuenta Auth ya no existe, borrar ese `authUserId` de la auditoría;
- conservar únicamente `account_deleted`, `player_id` histórico y timestamps/estado mínimo no identificatorio que realmente haga falta;
- el cleanup del identificador debe ser idempotente y reintentable;
- no reemplazarlo por email/hash/HMAC ni otro identificador persistente.

Preferencia simple: RPC administrativa service_role-only de finalización que limpie la clave de `pilot_events.properties`, o mecanismo equivalente igualmente seguro. No dar UPDATE directo al cliente.

### B — La verificación final debe comprobar también Auth

Hoy `verifyAccountDeleted` comprueba DB BRAMU + Storage, pero no confirma que la cuenta Auth haya desaparecido.

**AGREGAR** verificación vía Auth Admin API (por ejemplo `auth.admin.getUserById(authUserId)` mientras todavía se dispone del id operativo) y considerar éxito únicamente si:

- BRAMU está anonimizado/inactivo/desvinculado;
- Storage está limpio;
- Auth ya no existe;
- el identificador operativo persistido ya fue purgado/finalizado.

Si Auth todavía existe, la operación NO debe reportarse como completamente cerrada.

No consultar/modificar internals de `auth.*` por SQL.

### C — El CLI no debe salir con código 0 si la postcondición falla

Actualmente el bootstrap hace:

- `runAccountDeletion(...)`;
- imprime `verifyAccountDeleted(...)`;
- termina con `process.exit(result.ok ? 0 : 1)`.

Eso puede devolver exit code 0 aunque la verificación posterior encuentre una postcondición incumplida.

**REEMPLAZAR** ese criterio:

- exit 0 únicamente si la operación y TODAS las postcondiciones requeridas están confirmadas;
- exit 1 si cualquier postcondición queda falsa/indeterminada;
- salida clara indicando qué fase/postcondición falló para poder reintentar.

### D — Dependencia sin pin/lockfile

`supabase/scripts/package.json` usa:

`"@supabase/supabase-js": "^2"`

y no hay lockfile.

Para un script administrativo destructivo esto es demasiado abierto.

**REEMPLAZAR** por dependencia reproducible:

- instalar una versión concreta vigente/compatible de `@supabase/supabase-js`;
- commit de `package-lock.json`;
- preferir ejecución reproducible con `npm ci`;
- no tocar dependencias del frontend.

Verificar la versión contra documentación vigente de Supabase antes de fijarla.

### E — Endurecer detección de “Auth ya no existe”

La heurística actual depende de strings del mensaje:

- `not found`;
- `does not exist`;
- `user not found`.

**FUSIONAR** primero señales estructuradas disponibles del error (status/code cuando existan; 404 si corresponde) y usar mensaje solo como fallback compatible.

No tragar errores distintos bajo “already gone”.

## 3. Tests adicionales obligatorios

Mantener los 281 actuales y agregar cobertura focalizada para:

1. Auth eliminado confirmado por Admin API.
2. Auth todavía existente => postcondición incompleta/fallo.
3. Cleanup final de `authUserId` después de éxito completo.
4. Retry donde Auth ya no existe pero todavía queda `authUserId` operativo: debe limpiarlo y cerrar.
5. Fallo al limpiar auditoría después de borrar Auth: operación debe quedar recuperable y NO declararse cerrada.
6. CLI exit 1 cuando una postcondición falla.
7. Detección estructurada de 404/already-gone y rechazo de errores reales.
8. Verificar permisos de cualquier RPC de finalización: PUBLIC/anon/authenticated sin EXECUTE; service_role únicamente.

Si es razonablemente simple, agregar al verify SQL una aserción de que la finalización limpia `properties.authUserId`.

## 4. NO hacer todavía

- NO aplicar migraciones a Supabase Staging;
- NO ejecutar el script contra una cuenta real;
- NO desplegar frontend;
- NO tocar `04.11-h10`;
- NO tocar main/Production/BRAMUlive;
- NO abrir P0.2;
- NO abrir Bloque 9;
- NO hacer otra ronda UX.

## 5. Entrega

Actualizar la implementación existente de P0.3 (las migraciones aún no están aplicadas, así que evitar migraciones correctivas innecesarias encima de archivos nunca aplicados) y crear:

`docs/BRAMUlab/Implementacion/Pre_Production/31_Resultado_Hardening_Final_P0_3_27SEP.md`

Antes de terminar:

1. tests locales;
2. diff;
3. commit lógico único;
4. push a `origin/staging`;
5. reportar archivos, tests y cualquier riesgo residual REAL.

No marcar P0.3 cerrado. El cierre lo hace Central después de aplicar y probar en Supabase Staging.
