# Backend Bloque 6 — Revalidación dirigida hotfix hoja "¿Quién jugó realmente?"

**Fecha:** 22/09/2026
**Rama:** `staging`
**Base previa al hotfix:** `d4f51494fcad32734981bf6cd2d031e6aa29e80c`
**Bundle esperado:** `04.10-h18`

## Objetivo

Revalidar únicamente el Caso 2 (BLOQUEADO/FAIL) de `17_Validacion_Navegador_Work.md` / `18_Handoff_Revalidacion_Hotfix_Resumen_Work.md`: la hoja "¿Quién jugó realmente?" no se hacía visible al pulsar `RESOLVER`.

No repetir toda la QA de Bloque 6. No repetir el Caso 1 (ya PASS).

## Fixture

Usar el mismo fixture ya existente (NO crear otro partido):

- resultado: `6–2 / 6–4`;
- estado: `IDENTIDAD CUESTIONADA`;
- slot afectado: antes `sebastian test 3`, ahora `Por identificar`.

## Pasos

1. Confirmar el nuevo HEAD y bundle (`04.10-h18`, visible en el pie/consola de la app).
2. Abrir el fixture existente.
3. Pulsar `RESOLVER`.
4. Confirmar que la hoja "¿Quién jugó realmente?" es visible e interactuable (no transparente, no desplazada fuera de pantalla).
5. Seleccionar un jugador registrado válido.
6. Confirmar que la identidad se resuelve una sola vez.
7. Sin salir del Resumen, verificar refresco inmediato:
   - desaparece `IDENTIDAD CUESTIONADA`;
   - desaparece `Por identificar`;
   - aparece el jugador correcto.
8. Confirmar que `OCULTAR PARTIDO` sigue siendo el copy del partido server-backed.
9. Confirmar que no apareció un segundo partido.

## No hacer

- no desarrollar;
- no modificar código;
- no tocar Supabase/migraciones/Edge Functions;
- no tocar Vercel/configuración;
- no tocar `main`, Production, BRAMUlive ni Bloque 7;
- no repetir C-01…C-10 backend ni el Caso 1 de la ronda anterior.

## Criterio

Si el Caso 2 completa el ciclo (sheet visible → selección → resolución única → Resumen actualizado sin salir de la pantalla):

**HOTFIX PASS — BLOQUE 6 APTO PARA CIERRE**
(salvo la deuda de cobertura manual ya aceptada como no bloqueante, ver `18_Handoff_Revalidacion_Hotfix_Resumen_Work.md`).

## Nota para la siguiente ronda (no bloquea esta revalidación)

Durante este hotfix se encontró, por inspección de código (no reproducido en navegador todavía), que `#propose-correction-scrim` (hoja "Proponer corrección") tiene el mismo patrón incompleto que tenía `#identity-resolve-scrim`: alterna `hidden` pero nunca agrega/quita la clase `is-open`. El Caso 1 de la ronda anterior no lo ejercitó porque usa `Responder corrección` (aceptar/rechazar directo, sin abrir esa hoja), no `Proponer corrección`. Queda fuera de alcance de este hotfix (acotado exclusivamente a `identity-resolve-scrim`) — si se confirma en navegador, es el mismo fix de una línea aplicado acá, sobre `openProposeCorrection`/`closeProposeCorrection` en `bramulab/app.js`.
