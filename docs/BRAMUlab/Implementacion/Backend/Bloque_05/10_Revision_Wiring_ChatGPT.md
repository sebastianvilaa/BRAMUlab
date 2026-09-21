# Backend Bloque 5 — Revisión del wiring frontend por ChatGPT
## Hotfixes posteriores a la implementación de Claude

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**Implementación revisada:** `4c7fa1f`  
**HEAD al terminar esta revisión:** consultar rama `staging`.

## Veredicto

El wiring de Claude es una base correcta y puede avanzar a validación real de navegador, pero la revisión central detectó cuatro problemas concretos antes de esa prueba. Ya fueron corregidos por ChatGPT central.

No hay decisiones abiertas de producto.

---

## 1. Forma reciente no puede usar partidos pendientes

`renderPlayerLastMatchCard` recibía el historial de exhibición completo y calculaba también desde ahí `computeRecentForm`.

Eso hacía que un partido `pending_validation`, `sync_pending` o `expired` pudiera sumar visualmente una victoria/derrota a la forma reciente, contradiciendo `Experiencia_Inicial.md`: el pendiente puede aparecer como Último partido, pero produce **0 estadísticas oficiales**.

### Corrección

La tarjeta sigue mostrando el último partido de `displayHistory`, pero la forma reciente recibe por separado el historial computable.

Si el último partido visible es pendiente:
- se muestra el encuentro real;
- los dots solo reflejan partidos computables previos;
- ningún dot se marca falsamente como el partido pendiente actual.

---

## 2. Orden de historial por fecha realmente jugada

`match-sync.js` ordenaba la mezcla local/server/outbox por `createdAt`.

Un partido legacy cargado retroactivamente hoy podía quedar por encima de un partido realmente jugado después.

### Corrección

El orden usa:

`playedAt || startedAt || createdAt`

Mismo criterio conceptual que el resto de BRAMU para “último partido”.

---

## 3. Ocultar para mí podía volver a mostrar el partido

`refreshServerMatches()` pedía `includeHidden:true`, y `buildDisplayHistory` no filtraba `hidden`.

Por lo tanto, después de `hide_match_for_me`, el cache podía volver a incluir el partido oculto y Home/Historial seguir mostrándolo.

### Corrección

- el feed normal se pide con `includeHidden:false`;
- `buildDisplayHistory` además filtra `row.hidden` como defensa;
- `buildComputableHistory` NO filtra hidden: ocultar es una preferencia visual privada y nunca elimina efectos oficiales de un partido validado.

---

## 4. Feed server-backed perdía hora conocida, zona, lugar y nota privada

`get_my_matches` no devolvía:
- `played_at_time_known`;
- `reported_time_zone`;
- ubicación;
- nota privada del caller.

El frontend por eso asumía `timeKnown=true`, podía inventar una hora para un partido cargado sin hora, perdía el lugar y al reabrir desde Historial no recuperaba la nota privada.

### Corrección backend

Nueva migración:

`supabase/migrations/20260921033000_bloque5_feed_metadata.sql`

Aplicada correctamente a Supabase Staging.

`get_my_matches` ahora devuelve esos metadatos y `get_match_detail` también conserva explícitamente `playedAtTimeKnown` y `reportedTimeZone`.

La nota incluida es exclusivamente la del caller autenticado.

### Validación real en Staging

PASS transaccional con rollback:

- `timeKnown=false` llega intacto;
- timezone llega intacta;
- location name/lat/lng llegan intactos;
- private note del caller llega intacta;
- partido oculto no aparece con `includeHidden:false`;
- aparece como hidden solo con `includeHidden:true`.

No quedaron fixtures de la prueba.

---

## 5. Cache del frontend

Como hubo cambios posteriores al bundle `04.10-h12`, se hizo bump a:

`04.10-h13`

en `index.html` y `sw.js`.

Esto evita que el navegador siga sirviendo el wiring anterior desde Cache Storage.

---

## 6. Tests agregados

Se ampliaron tests de Bloque 5 para cubrir:

- `timeKnown=false`;
- timezone/lugar/nota privada;
- orden por fecha jugada real;
- hidden fuera del Historial personal;
- hidden validated todavía computable.

Falta únicamente que Claude corra la suite local completa sobre este HEAD para confirmar que los hotfixes centrales no introdujeron regresión sintáctica/unitaria.

---

## 7. Próximo paso

Claude debe hacer una ronda **corta de verificación**, sin nueva investigación ni cambios salvo que algún test falle:

1. pull de `staging`;
2. leer este documento;
3. correr suite local completa;
4. correr checks estáticos;
5. si todo está verde, no tocar lógica;
6. informar resultado y detenerse.

Después ChatGPT/Work hará la validación de navegador real sobre Vercel Staging.

No tocar:
- main;
- Production;
- BRAMUlive;
- Bloque 6.
