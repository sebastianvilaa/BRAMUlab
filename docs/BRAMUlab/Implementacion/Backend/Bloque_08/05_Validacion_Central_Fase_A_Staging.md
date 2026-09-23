# Backend Bloque 8 — Validación central de Fase A en Staging

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `c950391c74501c819074803a584591645e09124d`  
**Estado:** **FASE A — CERRADA EN STAGING**

## 1. Revisión de la corrección C01

ChatGPT central revisó el commit de corrección:

`c950391c74501c819074803a584591645e09124d`

La corrección resuelve el único bloqueo detectado en `03_Revision_Central_Fase_A.md`:

- normalización real de columnas top-level `snake_case` de PostgREST;
- frontera propia de Intelligence mediante `normalizeIntelligenceHistoryRow`;
- `matches.js` y contratos de Bloques 5–7 permanecen intactos;
- los fixtures de Fase A ahora usan la forma real de red;
- 2 tests específicos de regresión C01;
- suite de Fase A: **29/29 PASS**.

No se detectó otro bloqueo que justifique reabrir Fase A.

## 2. Migración aplicada en Supabase Staging real

Proyecto:

- `bramulab-staging`
- ref: `serxtivkfnptzurnvewg`

Migración aplicada correctamente:

- registro Supabase: `20260923050924_bloque8_fasea_intelligence_history_rpc`;
- archivo fuente: `supabase/migrations/20260923100000_bloque8_fasea_intelligence_history_rpc.sql`.

Antes de aplicarla ya había pasado un dry-run completo dentro de transacción + `ROLLBACK`.

Después de aplicarla se verificó:

- `get_player_intelligence_history(integer,timestamptz,boolean)` existe;
- firma real del retorno conserva columnas top-level `snake_case`;
- `authenticated`: EXECUTE habilitado;
- `anon`: EXECUTE denegado;
- llamada simulando una sesión `authenticated` real: **PASS**, sin error de identidad/RPC.

Staging actualmente tiene **0 partidos**, por lo que la llamada devuelve 0 filas. No se fabricaron partidos ni fixtures adicionales solo para obtener una respuesta con contenido.

## 3. Alcance cerrado de Fase A

Queda disponible la capa de datos/derivados para Intelligence V1:

- historia personal ordenada por fecha real jugada;
- perspectiva estable del jugador;
- estructura de sets y margen;
- rachas, récords y cortes;
- forma reciente 5/10;
- hitos acumulativos;
- relaciones con compañero, rival individual, pareja rival exacta y cruce exacto;
- inactividad excepcional;
- separación explícita entre historia personal e impacto oficial;
- preservación de `playedAtTimeKnown`, `officialEligible`, `hidden` y estado de identidad.

No hay UI de Intelligence todavía y no corresponde en esta fase.

## 4. Nota para Fase B/C

Cuando dos partidos tengan el mismo instante técnico pero la hora real sea desconocida, el desempate estable por `matchId` sirve solo para determinismo interno.

No debe convertirse en una afirmación narrativa de secuencia temporal si `playedAtTimeKnown=false`.

## 5. DECISIÓN ABIERTA no bloqueante

Sigue abierta:

**¿Un partido que el usuario ocultó de su Historial puede alimentar BRAMU Intelligence personal?**

La infraestructura ya soporta ambas opciones mediante `p_include_hidden`.

Hasta resolverlo:

- no modificar efectos oficiales de Nivel/Ranking;
- no confundir ocultar con eliminar;
- no bloquear Fase B por esta decisión;
- conservar el comportamiento por defecto actual: `p_include_hidden=false`.

## 6. Decisión de cierre

La evidencia técnica es suficiente y no quedan pasos operativos pendientes de Fase A.

**Backend Bloque 8 — Fase A queda CERRADA en Staging.**

Siguiente intervención autorizada:

**Fase B — Claims y evidencia.**

Debe consumir la capa de Fase A sin reabrirla salvo regresión concreta, construir claims estructurados y trazables, aplicar los umbrales/tamaños de muestra ya cerrados en `BRAMU_Intelligence.md` y mantener el criterio absoluto:

- 0 números incorrectos;
- 0 entidades inventadas;
- 0 acciones no registradas;
- 0 claims sin evidencia.
