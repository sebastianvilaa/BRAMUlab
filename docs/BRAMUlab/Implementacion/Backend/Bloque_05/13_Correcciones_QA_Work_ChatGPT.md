# Backend Bloque 5 — Correcciones posteriores a QA real de Work

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**Reporte de origen:** `12_Validacion_Navegador_Work.md`  
**Bundle nuevo:** `04.10-h15`

## Resultado de la revisión central

La validación real de Work confirmó que el flujo principal de Bloque 5 funciona de punta a punta en navegador: carga server-backed, un único partido compartido, estado pendiente, exclusión de métricas oficiales, persistencia, nota privada y ocultamiento personal.

Work encontró dos bugs reproducibles y dos observaciones UX. Los cuatro puntos se corrigieron en `staging` sin tocar backend de negocio, Supabase, Bloque 6, main, Production ni BRAMUlive.

---

## 1. B5-WORK-01 — mismos nombres visibles, identidades distintas

### Bug

La selección server-backed resolvía correctamente cada persona por `player_id`, pero al validar el formulario completo se seguía llamando a la validación legacy basada en nombres visibles.

Por eso dos cuentas distintas con display name `Prueba` disparaban falsamente:

`players-duplicate`.

### Corrección

`manualCurrentDraft()` ahora bifurca:

- camino server-backed:
  - exige 4 `player_id`;
  - deduplica exclusivamente por `player_id`;
  - reutiliza la validación de score/formato/fecha con labels internos inequívocos;
- camino local/legacy:
  - conserva exactamente la validación por nombre anterior.

Esto mantiene compatibilidad local y elimina el falso positivo para cuentas reales homónimas.

---

## 2. B5-WORK-02 — 00:00 con hora desconocida

### Bug

El modelo traducido ya preservaba correctamente `timeKnown=false`, pero la fila de Historial renderizaba siempre:

`fecha · formatRealTime(...)`

y por eso mostraba `00:00`.

### Corrección

Historial usa ahora el mismo criterio que Último partido y Resumen:

- si `timeKnown === false` → mostrar solo fecha;
- si la hora es conocida → fecha + hora.

Nunca se inventa `00:00`.

---

## 3. UX REVIEW — pendiente visible en Último partido

La fuente maestra de experiencia exige que, cuando todavía hay 0 partidos oficiales pero existe uno cargado pendiente, Último partido muestre ese encuentro **y su estado pendiente**.

Work comprobó que la tarjeta mostraba VICTORIA pero no el estado.

### Corrección

Último partido conserva el resultado descriptivo y agrega, cuando corresponda, un badge neutro con el estado server-backed:

- PENDIENTE DE VALIDACIÓN;
- PENDIENTE DE SINCRONIZACIÓN;
- VENCIDO;
- NECESITA REVISIÓN.

El badge de estado es neutro y no se presenta como logro ni error.

---

## 4. UX REVIEW — Eliminar vs Ocultar

### Problema

En un partido compartido ya aceptado por servidor, el botón visible decía `Eliminar partido`, aunque la acción real era solo `hide_match_for_me`.

### Corrección

El copy del botón ahora refleja la acción real:

- borrador/outbox → `DESCARTAR CARGA`;
- server-backed aceptado → `OCULTAR PARTIDO`;
- local legacy → `ELIMINAR PARTIDO`.

La lógica subyacente no cambia.

---

## 5. Cache

Se hizo bump de bundle:

`04.10-h14` → `04.10-h15`

para evitar que la Preview siga sirviendo el código previo desde el service worker.

---

## 6. Fixture QA de Work

El partido creado por Work sigue existiendo en Staging como fixture QA:

- match_id: `f41041e8-2ff0-4530-8c9a-2d2841b57d5f`
- estado: `pending_validation`
- lugar: `QA B5 Work`
- hora conocida: `false`
- oculto para `@sebas`: sí
- nota privada de `@sebas`: preservada

No eliminarlo ni modificarlo automáticamente. Puede servir como evidencia/fixture hasta el cierre final y limpiarse después de forma controlada.

---

## 7. Próximo checkpoint

Antes de volver a Work:

1. Claude corre suite local completa + checks estáticos sobre HEAD actual.
2. Si queda verde, Work hace una **revalidación dirigida**, no repite todo Bloque 5:
   - dos usuarios distintos con mismo nombre visible;
   - partido sin hora no muestra 00:00;
   - Último partido muestra PENDIENTE DE VALIDACIÓN;
   - botón server-backed dice OCULTAR PARTIDO;
   - confirmar rápidamente que métricas oficiales siguen intactas.

No repetir concurrencia/RLS/idempotencia/backend ni otras pruebas ya cubiertas.

No iniciar Bloque 6 todavía.
