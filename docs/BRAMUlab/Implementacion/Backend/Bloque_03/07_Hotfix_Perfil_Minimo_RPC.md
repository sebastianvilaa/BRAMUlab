# Backend Bloque 3 — Hotfix perfil mínimo / RPC complete_profile

**Fecha:** 19/09/2026  
**Estado:** hotfix aplicado en `staging`; validación manual pendiente.

## Síntoma real

Durante la validación manual real, el flujo llegó correctamente a:

`CREAR CUENTA → TU PERFIL → Nivel BRAMU → CONFIRMÁ TU EMAIL`

El OTP real llegó y fue validado. Inmediatamente después, al intentar oficializar el onboarding, la app volvió a `TU PERFIL` con:

`No pudimos guardar tu perfil. Probá de nuevo.`

En Supabase, la nueva cuenta quedó confirmada con:

- `level_states.status = PENDIENTE`;
- perfil todavía vacío;
- sin Nivel oficial persistido.

## Causa

`runOfficializeAndEnter()` llama a `Auth.completeProfile()` con el perfil mínimo. En Bloque 3, `competitive_branch` ya no forma parte del onboarding inicial, por lo que `fields.competitiveBranch` llega como `undefined`.

En `auth.js`, la RPC enviaba:

`p_competitive_branch: fields.competitiveBranch`

Al serializar el payload, el parámetro podía quedar omitido. Sin embargo, la firma vigente de `complete_profile` exige que `p_competitive_branch` esté presente, aunque su valor pueda ser `NULL`.

Los scripts de integración no detectaron este caso porque envían explícitamente `p_competitive_branch: null`.

## Cambio

En `bramulab/auth.js`:

**REEMPLAZAR**

`p_competitive_branch: fields.competitiveBranch`

por:

`p_competitive_branch: fields.competitiveBranch || null`

Así el perfil mínimo real siempre manda el argumento requerido y conserva la decisión de producto de que rama competitiva NO bloquea el onboarding.

Se hizo bump de caché frontend:

`04.10-h4 → 04.10-h5`

en `index.html` y `sw.js`.

No se tocó:

- Supabase;
- migraciones;
- Edge Functions;
- fórmula de Nivel;
- main;
- BRAMUlive.

## Próxima validación

Recargar Staging con el bundle h5 y continuar la misma cuenta/borrador. Resultado esperado:

1. `complete_profile` persiste perfil mínimo y términos;
2. `officialize-onboarding` pasa Nivel de `PENDIENTE` a `CALIBRANDO`;
3. Home se habilita recién después de esa oficialización.
