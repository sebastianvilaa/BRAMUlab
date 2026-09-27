# BRAMUlab — Hotfix runtime Home h15 tras retest real

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Origen:** retest real del gate visual sobre `04.11-h14`  
**Objetivo:** corregir una regresión runtime bloqueante introducida por comentarios del markup de Último partido.

## Evidencia física

Sesión nueva como Seba / `@seba_qa` sobre Staging:

1. deploy servía `04.11-h14`;
2. Home indicaba `8 partidos en tu historia`;
3. Último partido quedaba en estado cero (`Tu historia empieza con tu primer partido`);
4. esperar no convergía;
5. tras recarga normal, pantalla negra;
6. consola:
   `TypeError: "...".datetime is not a function`
   en `renderPlayerLastMatchCard`, app.js h14 línea 7292.

## Causa raíz confirmada

Dentro del template literal asignado a `body.innerHTML` en `renderPlayerLastMatchCard`, un comentario HTML de la ronda h14 incluyó backticks crudos alrededor de nombres de clase:

- `.datetime`;
- `.player-home-lastmatch__badge-slot`;
- nuevamente `.datetime`.

Al estar esos caracteres dentro de un template literal JavaScript, el primer backtick cierra el string y el fragmento posterior se interpreta como código válido. El navegador termina intentando invocar la propiedad `.datetime` como función, produciendo exactamente el error observado.

Esto explica los dos estados:

- primer render sin cache de partidos: entra por `if (!matches.length)`, deja el estado cero y retorna antes del fragmento roto;
- cuando llega el historial server-backed, el rerender entra al template real y falla;
- después de recargar con cache ya disponible, la excepción ocurre desde el render inicial y puede dejar la app negra.

No es un problema de Supabase, identidad ni cantidad de partidos.

## Cambio

**REEMPLAZAR**

Solo los backticks de documentación interna dentro de ese comentario HTML por texto plano. No cambia markup, CSS, datos ni semántica visual.

**AGREGAR**

Test `h15-runtime-template-regression.test.mjs`:
- ningún comentario HTML dentro de la región de `renderPlayerLastMatchCard` puede contener backticks crudos;
- bundle/cache quartet debe quedar alineado en `04.11-h15`.

**BUMP**

`04.11-h14 → 04.11-h15` en:
- index query strings;
- `Store.BUNDLE_VERSION`;
- service worker cache/assets;
- `version.json`.

## NO TOCAR

- criterios UX 1–11 del documento 45;
- backend;
- Supabase;
- Nivel/Ranking/Intelligence;
- identidad;
- outbox;
- notificaciones;
- main;
- Production;
- BRAMUlive;
- Mis grupos.

## Gate

El gate visual sigue **DETENIDO** hasta retest real del deploy h15.

Retest mínimo obligatorio:

1. sesión nueva como Seba / @seba_qa;
2. confirmar bundle `04.11-h15`;
3. Home muestra historial y Último partido real, sin estado cero falso;
4. esperar refresh no produce excepción;
5. recarga normal no deja pantalla negra;
6. consola sin `.datetime is not a function`.

Solo después de este PASS se retoma el gate visual 1–11 del documento 45.
