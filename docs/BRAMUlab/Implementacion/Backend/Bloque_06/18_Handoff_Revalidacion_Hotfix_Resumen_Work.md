# Backend Bloque 6 — Revalidación dirigida hotfix Resumen

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**Base previa al hotfix:** `02a23aad6c82de2c19d9b6838d2787f6683fdd48`  
**Bundle esperado:** `04.10-h17`

## Objetivo

Revalidar únicamente el bug visual documentado en `17_Validacion_Navegador_Work.md`.

No repetir toda la QA de Bloque 6.

## Caso 1 — corrección aceptada

1. Abrir un partido validado.
2. Proponer una corrección de score.
3. Desde la otra pareja, aceptar.
4. Sin salir del Resumen, comprobar inmediatamente:
   - desaparece `CORRECCIÓN PROPUESTA`;
   - aparece `VALIDADO`;
   - el marcador ya muestra el score corregido.

No debe ser necesario navegar a Historial/Home y volver.

## Caso 2 — identidad resuelta

1. Sobre un partido validado, cuestionar una identidad.
2. Resolverla con un jugador registrado/provisional válido.
3. Sin salir del Resumen, comprobar inmediatamente:
   - desaparece `IDENTIDAD CUESTIONADA`;
   - desaparece `Por identificar`;
   - aparece el jugador correcto;
   - el partido queda visualmente alineado con el estado canónico nuevo.

No debe ser necesario navegar a Home/Historial y volver.

## Regresión mínima

Durante esos mismos recorridos confirmar solamente que:

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
- no repetir C-01…C-10 backend;
- no repetir la deuda de cobertura del segundo integrante del lado accionable: sigue siendo deuda manual, no bug.

## Criterio

Si ambos casos actualizan el Resumen abierto inmediatamente:

**HOTFIX PASS — BLOQUE 6 APTO PARA CIERRE**  
(salvo la deuda de cobertura manual ya aceptada como no bloqueante).
