# Backend Bloque 6 — Revalidación dirigida hotfix hojas "¿Quién jugó realmente?" / "Proponer corrección"

**Fecha:** 22/09/2026
**Rama:** `staging`
**Base previa a estos hotfixes:** `d4f51494fcad32734981bf6cd2d031e6aa29e80c`
**Bundle esperado:** `04.10-h19`

## Objetivo

Revalidar, en una sola ronda, los dos sheets de Bloque 6 que tenían el mismo bug visual (`.sheet-scrim` sin la clase `is-open`, quedaba invisible/fuera de pantalla):

1. `#identity-resolve-scrim` ("¿Quién jugó realmente?") — Caso 2 BLOQUEADO/FAIL de `17_Validacion_Navegador_Work.md` / `18_Handoff_Revalidacion_Hotfix_Resumen_Work.md`, corregido primero.
2. `#propose-correction-scrim` ("Proponer corrección") — mismo patrón incompleto, encontrado por inspección de código durante el hotfix anterior (nunca reproducido en navegador porque el Caso 1 de esa ronda usa `Responder corrección`, que no abre este sheet).

No repetir toda la QA de Bloque 6. No repetir el Caso 1 de `18_Handoff_Revalidacion_Hotfix_Resumen_Work.md` (corrección aceptada vía `Responder corrección`, ya PASS).

## Fixture

Usar el mismo fixture ya existente para el Caso A (NO crear otro partido):

- resultado: `6–2 / 6–4`;
- estado: `IDENTIDAD CUESTIONADA`;
- slot afectado: antes `sebastian test 3`, ahora `Por identificar`.

Para el Caso B alcanza con cualquier partido `pending_validation` o `validated` (dentro de la ventana de 3 días) donde el usuario pueda proponer una corrección; si no hay uno a mano, puede reutilizarse el mismo fixture del Caso A una vez resuelta la identidad (ya sin incidencia abierta).

## Caso A — Resolver identidad

1. Confirmar el nuevo HEAD y bundle (`04.10-h19`, visible en el pie/consola de la app).
2. Abrir el fixture existente.
3. Pulsar `RESOLVER`.
4. Confirmar que la hoja "¿Quién jugó realmente?" es visible e interactuable (no transparente, no desplazada fuera de pantalla).
5. Seleccionar un jugador registrado válido.
6. Confirmar que la identidad se resuelve una sola vez.
7. Sin salir del Resumen, verificar refresco inmediato:
   - desaparece `IDENTIDAD CUESTIONADA`;
   - desaparece `Por identificar`;
   - aparece el jugador correcto.

## Caso B — Proponer corrección

1. Sobre un partido accionable, pulsar `PROPONER CORRECCIÓN`.
2. Confirmar que la hoja de edición de sets es visible e interactuable (no transparente, no desplazada fuera de pantalla).
3. Cargar un resultado válido y confirmar.
4. Confirmar que la propuesta se registra una sola vez (el partido pasa a esperar respuesta de la otra pareja, o crea la nueva revisión según corresponda al estado previo).
5. Confirmar que la hoja cierra correctamente (sin quedar un scrim residual bloqueando la pantalla).

## Regresión mínima (ambos casos)

- la operación se persiste una sola vez;
- Notificaciones conserva el comportamiento validado;
- no aparece un segundo partido;
- `OCULTAR PARTIDO` sigue siendo el copy del partido server-backed.

## No hacer

- no desarrollar;
- no modificar código;
- no tocar Supabase/migraciones/Edge Functions;
- no tocar Vercel/configuración;
- no tocar `main`, Production, BRAMUlive ni Bloque 7;
- no repetir C-01…C-10 backend ni el Caso 1 de `18_Handoff_Revalidacion_Hotfix_Resumen_Work.md`.

## Criterio

Si ambos casos completan el ciclo (sheet visible → acción → resultado único → Resumen actualizado sin salir de la pantalla, sin scrim residual):

**HOTFIX PASS — BLOQUE 6 APTO PARA CIERRE**
(salvo la deuda de cobertura manual ya aceptada como no bloqueante, ver `18_Handoff_Revalidacion_Hotfix_Resumen_Work.md`).
