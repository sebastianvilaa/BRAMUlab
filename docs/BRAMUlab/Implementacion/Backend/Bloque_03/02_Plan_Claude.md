# Backend Bloque 3 — Plan de Claude (previo a implementación)

**Fecha:** 19/09/2026
**Estado:** registro operativo — plan producido antes de leer `03_Revision_ChatGPT.md`, guardado tal como fue entregado (con referencias de línea/nombre ajustadas post-revisión donde el propio proceso de revisión las cambió).
**No es fuente maestra de producto.** Ante cualquier diferencia con `docs/BRAMUlab/Backend_Infraestructura.md`, manda el documento maestro.

Este documento es la copia operativa del plan que Claude entregó al usuario tras inspeccionar `staging` en `998eac5`, antes de cualquier autorización de implementación. El usuario lo pasó a revisión de ChatGPT; las correcciones y decisiones cerradas de esa revisión están en `03_Revision_ChatGPT.md` y tienen precedencia sobre cualquier punto de este plan que contradigan (en particular: motor server-side vía Edge Function en vez de puerto PL/pgSQL, `level_states.status` con `PENDIENTE` explícito, `complete_profile` sin `COALESCE` genérico, `is_username_available` abierta a `anon`).

---

## A. Estado real encontrado

**Backend (Bloque 1+2, cerrado y verificado en Staging real):** `players`, `profiles`, `locations`, `reserved_usernames`, `pilot_events` (11 `event_name` ya declarados, incluidos `level_started`/`level_confirmed`/`calibration_1_5|3_5|5_5`). Trigger `handle_email_confirmed` (idempotente) crea `players`+`profiles` (vacío) apenas `email_confirmed_at` deja de ser null — no crea `level_states` (explícitamente diferido a Bloque 3). RPCs `is_username_available`/`complete_profile` (SECURITY DEFINER, solo `authenticated`). `complete_profile` hoy **exige** `competitive_branch` y ubicación. No hay sesión de Supabase antes de confirmar el email.

**Frontend:** wizard de alta actual `[1 (email/pass), 'verify' (OTP), 2 (perfil completo)]` — el OTP bloquea de inmediato, al revés del flujo objetivo. El paso "TU PERFIL" fusiona identidad + rama + ubicación en una sola llamada. No existe ningún borrador local persistente (`signupDraft` es una variable en memoria). No existe ninguna UI de términos y condiciones. El onboarding de Nivel (`#view-nivel-onboarding`, caminos rápido/completo) ya existe y funciona bien, pero solo se dispara si ya existe una cuenta y `Store.isLevelV1PreviewEnabled()` está prendido (flag de laboratorio). `openPlayerHome()` es el único choke point de entrada a Home. `fetchOwnProfile()` deja Nivel/categoría en `null` a propósito.

**Motor de Nivel (100% JS puro):** `ALGORITHM_VERSION='nivel_bramu_v1_0'`, `QUESTIONNAIRE_VERSION='nivel_inicial_v1_1'`. Estados reales en código: `sin_estimacion | calibrando | calibrado | recalibrando` — sin un "PENDIENTE" explícito (se representaba como ausencia de fila en `localStorage`). Calibración: 5 partidos + 3 rivales distintos simultáneos. Ajuste por categoría: máx ±0.5, peso 0.70. **Precisión: pública = 1 decimal, interna = 4 decimales** — ningún documento vigente ni el código mencionan 2 decimales en ningún lugar.

**Laboratorio:** ícono matraz (siempre visible en Home), long-press en el logo → modal "HERRAMIENTAS", botón "Resetear Nivel BRAMU" y botón "Crear usuario de prueba" — ninguno restringido por entorno.

**Tests:** 1408/1408 confirmado con el runner real (`tests.html` en navegador, no conteo por grep) antes de tocar código.

## B. Diferencias contra el objetivo de Bloque 3

- **Backend:** no existen `level_states`/`level_events`; `complete_profile` exige campos que el perfil mínimo no debe pedir; no existen `terms_version`/`terms_accepted_at`; no existe ningún comando server-side que vuelva a ejecutar el estimador.
- **Frontend/onboarding:** orden del wizard invertido; cero persistencia de borrador; cero UI de términos; Nivel atado a cuenta existente + flag de laboratorio; `openPlayerHome`/`nivelOnboardingPending` no saben nada de `level_states` server-side; controles de laboratorio sin restricción de entorno.
- **Persistencia:** todo lo de Nivel sigue siendo 100% local incluso para cuentas reales.
- **Tests:** sin regresión de onboarding reordenado, sin test de paridad motor JS↔servidor, sin test de idempotencia, sin test de la carrera de `@usuario` en el punto de oficialización.
- **Documentación:** `Nivel_BRAMU_Implementacion.md`/`README.md` quedarán desactualizados en cuanto esto se implemente.

## C. Migraciones propuestas (versión previa a la revisión — ver `03_Revision_ChatGPT.md` para los ajustes finales)

1. `profiles`: agregar `terms_version`/`terms_accepted_at` (nullable).
2. `complete_profile`: relajar `competitive_branch`/ubicación a opcionales.
3. `level_states`/`level_events` nuevas.
4. Mecanismo de recálculo server-side del estimador — **este plan proponía originalmente un puerto completo a PL/pgSQL** (`compute_initial_level_estimate`); la revisión de ChatGPT lo reemplazó por una Edge Function que reutiliza el motor JS compartido (ver `03_Revision_ChatGPT.md` §2 y el informe final para el diseño realmente implementado).
5. RPC de oficialización atómica e idempotente.

## D-I. Resto del plan

El resto del plan (cambios de código archivo por archivo, flujo final de onboarding, autoridad del Nivel, plan de tests, orden de implementación y contradicciones a confirmar) se entregó en el mismo formato en el chat de esta sesión, previo a `03_Revision_ChatGPT.md`. Los puntos que esa revisión corrigió explícitamente (precisión 1 decimal confirmada, motor server-side vía Edge Function, `level_states.status` con `PENDIENTE` explícito extendiendo `handle_email_confirmed`, `complete_profile` sin `COALESCE` genérico, `is_username_available` abierta a `anon` acotado, Ranking fuera de alcance, controles de laboratorio env-gateados, idempotencia reforzada con constraint de DB) son los que efectivamente se implementaron — ver `04_Informe_Implementacion_Claude.md` para el diseño final real y las decisiones tomadas durante la implementación.
