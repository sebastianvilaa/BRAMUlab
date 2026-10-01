# Handoff 83 — Bloque 9A: clean-room replay y rehearsal de salida

**Fecha:** 01/10/2026  
**Entorno permitido:** local/efímero + lectura de Staging.  
**NO tocar:** main, Production, BRAMUlive.

## Estado de entrada

- V04.20 / bundle 04.20-h2 en Staging.
- L1/L2/L3 técnico: PASS Central.
- Pre-Bloque 9 / Issue #17: PASS real en Staging.
- P0.2 todavía depende de Comunicaciones/Auth-email, QA browser y E2E destructivo con OTP.
- Production NO existe y no está autorizada.

## Objetivo

Demostrar, antes de abrir Production, que el repositorio actual puede reconstruir una instancia nueva de BRAMU de forma limpia y reproducible, sin depender de residuos históricos de Staging.

Esta ronda es un **rehearsal técnico**, no un deploy productivo.

## Leer

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Backend_Infraestructura.md` — Bloque 9
4. `docs/BRAMUlab/Pre_Production.md` — P0.5
5. `docs/BRAMUlab/Runbook_Operacion_y_Salida.md`
6. este handoff

No releer Archivo/Backup.

## A. Replay de migraciones desde cero

Intentar con Supabase local / Postgres efímero / Docker según herramientas disponibles.

Objetivo:
- base vacía;
- ejecutar TODAS las migraciones vigentes en orden;
- ninguna depende de datos preexistentes de Staging;
- ningún nombre/version de migración duplicado;
- ninguna migración requiere intervención manual intermedia;
- el schema final es utilizable y coherente con los contratos actuales.

Si Docker/Supabase local no está disponible:
- no frenar;
- ejecutar la validación estática/SQL más fuerte posible;
- documentar exactamente qué parte no pudo probarse.

### Auditar explícitamente

- project refs;
- URLs de Supabase;
- dominios Vercel;
- emails de QA;
- IDs/UUID de fixtures;
- nombres de usuarios de prueba;
- `environment='staging'` hardcodeado;
- secrets;
- service-role;
- datos semilla;
- mocks;
- cualquier dependencia en estado acumulado del Staging actual.

No eliminar datos o compatibilidad legacy solo por estética. Corregir únicamente si rompería un replay limpio o Production.

## B. Estado inicial de una Production nueva

Verificar qué deja realmente el replay:

- `app_config`;
- `legal_versions`;
- buckets/policies;
- cron helpers;
- tablas/RLS/grants;
- Ranking sin ediciones falsas;
- Nivel sin usuarios;
- Intelligence sin outputs;
- Grupos sin fixtures;
- ausencia de cuentas/partidos/seeds.

Definir qué valores DEBEN configurarse después del replay y antes del primer smoke, sin ejecutarlos en Production.

## C. Edge Functions

Para todas las funciones que requiere el runbook:

- resolver recursivamente sus imports locales;
- comprobar que cada bundle se puede construir/deployar desde el repo actual;
- detectar imports/paths faltantes;
- detectar project refs/URLs/secrets hardcodeados;
- registrar `verify_jwt` esperado de cada una;
- no desplegar nada a Production.

Puede usar Staging únicamente para contrastar la lista/versión activa; no redeployar por rutina si no cambió código.

## D. Builds y guardas de entorno

Verificar:

- build Staging válido;
- build Production con placeholders legales actuales debe **fallar a propósito** y por la razón esperada;
- credenciales cruzadas Staging/Production deben fallar;
- service-role no puede entrar al bundle cliente;
- laboratorio/mocks/seeds no quedan habilitados en Production;
- Service Worker/cache names no mezclan entornos o versiones.

No completar placeholders legales: pertenecen al cierre P0.2/Production.

## E. Manifest de release reproducible

No duplicar el Runbook. Complementarlo solo con evidencia automatizable:

- script/check que detecte migraciones duplicadas;
- script/check de hardcodes prohibidos;
- lista derivada de Edge Functions y `verify_jwt`;
- validación de “base limpia”;
- smoke técnico que pueda repetirse antes del futuro deploy real.

Si ya existe una herramienta equivalente, FUSIONAR/REUTILIZAR.

## F. NO TOCAR

- templates/copy/diseño de emails;
- SMTP / Secure Email Change;
- E2E destructivo OTP;
- textos legales pendientes de datos reales;
- AAIP/RNBDP;
- main;
- Production;
- BRAMUlive;
- reglas/UX de Nivel, Ranking, Grupos, partidos o Intelligence;
- P1 visual;
- infraestructura comercial innecesaria.

## Criterio de cambio

Primero auditar.

Si todo replaya limpio:
- no inventar refactors;
- agregar solo checks/scripts/documentación que reduzcan riesgo real de salida.

Si aparece un defecto:
- corregirlo sobre `staging`;
- pruebas focalizadas;
- nunca crear recursos Production.

## Salida

Guardar:

`docs/BRAMUlab/Implementacion/Pre_Production/84_Resultado_Bloque_9A_Replay_Limpio_01OCT.md`

Debe decir:
- PASS/FAIL del replay limpio;
- mecanismo usado;
- migraciones/configuración problemáticas si existen;
- hardcodes encontrados;
- estado inicial real resultante;
- Edge Functions verificadas;
- resultado de builds/guards;
- cambios realizados;
- qué queda para Comunicaciones/Work/OTP;
- qué queda exclusivamente para autorización de Production;
- DECISIONES ABIERTAS reales.

## Git

- solo `staging`;
- idealmente un único commit/push;
- no micro-pushes;
- no tocar main/Production/BRAMUlive;
- revisar diff completo antes de push.

Central hará después un único gate.
