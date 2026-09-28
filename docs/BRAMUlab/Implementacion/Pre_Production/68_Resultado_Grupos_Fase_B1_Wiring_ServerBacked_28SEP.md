# Resultado — Grupos BRAMU · Fase B1 · Wiring server-backed

**Fecha:** 28/09/2026 · **Rama:** `staging` · **Handoff:** `67_Handoff_Grupos_Fase_B1_Wiring_ServerBacked_28SEP.md`
**Bundle:** `04.11-h28` (cuarteto alineado: `Store.BUNDLE_VERSION`, `version.json`, `sw.js` CACHE_NAME + `?v=`, `index.html`). Sin cambios de CSS ni de markup (`index.html` solo cambió el `?v=`).

## Qué se hizo

- **Cliente** (`auth.js`): 10 wrappers finos sobre los contratos de Fase A (`listMyGroups` … `getGroupCompetitionData`). Devuelven `{ok:true,…}` o `{ok:false, code}` (códigos de negocio del servidor + `rate_limited`, `network_error`, `not_configured`); nunca lanzan ni usan service-role.
- **Adaptadores puros** (`groups.js`): `adaptServerGroup` (`groupId→id`, `playerId→userId` solo como compatibilidad interna, `periods` idénticos, nombre por `player_id`, "Jugador" si no hay identidad) y `adaptServerCompetitionMatches` (a la forma que ya lee el motor, con `levelBefore` y `levelsSource:'official'`).
- **Sorpresa** (`groups.js#computeBonusSorpresa`): única fórmula tocada, y solo su fuente de Nivel. Si el partido viene con `levelsSource:'official'`, usa **solo** `levelBefore` de los 4 jugadores (umbral 0,5 y redondeo iguales); si falta cualquiera → `false`. Nunca cae al estimador simulado. El camino legacy (cuentas sin backend/tests) queda idéntico. Base 5, +1 por bonus, máx. 7, top 3, empates y Race no se tocaron.
- **Wiring** (`app.js`, bloque Grupos): en cuentas server-backed la lista, el detalle, la tabla/Race/Intelligence y el CRUD salen del servidor; `Store.loadGroups()` no se lee (los grupos locales viejos no aparecen ni se migran). Cache **efímero en memoria** (por grupo), reconstruido desde el servidor al abrir; `activeGroupId` sigue local sin ser autoridad.
  - Crear/renombrar/agregar/quitar/promover/demoter/eliminar → RPC → refresco (lista + grupo activo). Nada se altera localmente antes del éxito; el servidor decide "último admin" (el guardrail local solo deshabilita botones); `isAdmin` viene del servidor.
  - Errores mapeados a mensajes de UI (sin toasts técnicos); en la hoja de crear/agregar, en su `#create-group-error` de siempre.
  - Doble submit bloqueado (`groupsBusy`); respuestas tardías descartadas (`groupsListRequestId`, `groupPickerRequestId`, datos indexados por `groupId` y repintado solo si sigue siendo el grupo activo); mientras el grupo activo no tiene datos compartidos no se pinta ninguna tabla, y sin primera respuesta no se muestra ni estado vacío.
  - Filas: avatar/`@usuario` reales por `player_id` (`get_players_compact` en batch; sin `@usuario` no se fabrica handle); tocar una fila abre el perfil por `player_id`.
  - Selector de jugadores (crear/agregar), mismo markup/estilos, en modo server: búsqueda real (`search_players`, con debounce) o, sin texto, Mis jugadores + recientes con `player_id`; excluye a uno mismo y a los miembros activos.

## Tests

- Nuevo `bramulab/groups-b1-server-backed.test.mjs`: **17/17 PASS** (adaptador, Sorpresa solo por `levelBefore` incl. umbral exacto y faltante de cualquier jugador, 5/6/7 nunca 8 y Remontada⊥Clara, top 3 / 3-de-4 / empates 1-1-3 / Race con datos de servidor, cliente RPC contra el contrato, guardas estáticas de wiring, bundle).
- Suite `node --test bramulab/*.test.mjs`: 389/390. El único fallo, `h23: flujo inicial dice VALIDAR…`, **ya fallaba antes de estos cambios** (verificado con stash) y no toca Grupos; no se corrigió por estar fuera de alcance.
- Ajuste de guarda existente: `cierre-ux-h13` (P0-G) ya no exime a Mis grupos de navegar por nombre plano, porque ahora navega por `player_id`; `h21` alineado a h28.

## No verificado (honesto)

- **No se probó en navegador ni contra Staging real**: el servidor de desarrollo local no pudo iniciarse en este entorno (permiso sobre la carpeta) y no hay sesión Supabase. **Sin PASS visual ni multiusuario declarado.** La suite HTML `tests.html` no se corrió.
- Pendiente QA real en Staging (Seba + Esteban) según el handoff 67: mismo grupo/tabla/Race en ambas cuentas, permisos de no-admin, persistencia tras recarga/cierre de sesión, no reaparición de grupos locales, y que el grupo armado se vea igual.

## Notas / posibles ajustes tras QA

- Agregar varios jugadores hace una llamada por jugador (el contrato de Fase A no tiene alta en lote); el rate limit (60/min) alcanza para el uso normal.
- Un jugador no resoluble por `get_players_compact` (p. ej. cuenta eliminada) se muestra como "Jugador".
- No se inició Fase B2 (estado cero, EJEMPLO, "Cómo funciona", "Tu grupo está listo", header, CTA).
