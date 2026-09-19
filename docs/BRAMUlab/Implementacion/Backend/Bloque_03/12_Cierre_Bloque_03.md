# Backend Bloque 3 — Cierre definitivo

**Fecha:** 19/09/2026  
**Rama:** `staging`  
**HEAD funcional validado:** `7b24979a`  
**Estado:** **CERRADO**

## Evidencia automática final

Se ejecutaron en la Mac de Sebastián contra Supabase Staging, con las credenciales ya cargadas en variables de entorno y sin mostrarlas ni escribirlas en el repo:

- `node supabase/tests/verify-bloque2.mjs` → **BLOQUE 2 OK**
- `node supabase/tests/verify-bloque3.mjs` → **BLOQUE 3 OK**
- `node supabase/tests/verify-nivel-parity.mjs` → **PARIDAD OK**

La corrida final ya usa `nivel_inicial_v1_2` en los caminos rápido y completo y confirma paridad exacta Node ↔ Edge Function para `mu` y `confidence`.

## Cuenta de prueba 2 — camino rápido + confirmación anticipada

Secuencia validada:

1. signup nuevo;
2. confirmación anticipada del email;
3. regreso correcto a `TU PERFIL`, sin acceso a Home;
4. backend en `PENDIENTE`;
5. perfil mínimo;
6. camino rápido V1.2;
7. refresh antes de confirmar el Nivel;
8. hotfix `7b24979a` evita pedir OTP otra vez si la sesión ya está confirmada;
9. oficialización;
10. entrada a Home.

Supabase confirmó:

- `status = CALIBRANDO`
- `mu = 5.5`
- `rated_matches = 0`
- `distinct_opponents = 0`
- `algorithm_version = nivel_bramu_v1_0`
- `questionnaire_version = nivel_inicial_v1_2`
- `questionnaire_mode = quick`
- exactamente **1** `initial_estimate`

## Cuenta de prueba 3 — camino completo normal

Secuencia validada:

1. signup nuevo;
2. perfil mínimo;
3. camino recomendado `Ayudame a calcularlo`;
4. cuestionario completo de **6 preguntas**;
5. sin categoría local;
6. sin pregunta de resultados en categoría habitual;
7. resultado público `5.7`;
8. `CONFIRMAR MI NIVEL`;
9. OTP real de 6 dígitos al final;
10. oficialización;
11. entrada directa a Home;
12. Home: `CALIBRANDO · 0 / 5 PARTIDOS`, Nivel `5.7`.

Supabase confirmó:

- `status = CALIBRANDO`
- `mu = 5.6675` → redondeo público `5.7`
- `confidence = 0.18`
- `rated_matches = 0`
- `distinct_opponents = 0`
- `algorithm_version = nivel_bramu_v1_0`
- `questionnaire_version = nivel_inicial_v1_2`
- `questionnaire_mode = full`
- exactamente **1** `initial_estimate`

## Bug cerrado durante la validación

Una cuenta que había confirmado el email anticipadamente podía volver a pedir OTP al tocar `CONFIRMAR MI NIVEL`.

Causa: `confirmNivelOnboarding()` enviaba siempre al step `verify` sin consultar si ya existía una sesión Supabase válida.

Hotfix:

- commit `7b24979a`;
- valida sesión y coincidencia del email del borrador;
- si ya está confirmada, ejecuta `runOfficializeAndEnter()` directamente;
- si no hay sesión válida, conserva el flujo normal de OTP.

No se tocaron `main`, BRAMUlive, migraciones, esquema Supabase ni el motor de partidos.

## Inconsistencia histórica de questionnaire_mode

La primera cuenta de prueba bajo V1.1 había quedado persistida como `quick` aunque visualmente se recordaba haber recorrido el camino completo.

V1.2 se revalidó desde cero con dos cuentas independientes:

- camino rápido → `questionnaire_mode = quick`;
- camino completo → `questionnaire_mode = full`.

No se reproduce como defecto vigente.

## Criterio de cierre

Quedó verificado:

- alta real;
- perfil mínimo;
- OTP real;
- confirmación de email al final;
- confirmación anticipada;
- refresh/reanudación del borrador;
- Nivel universal V1.2;
- caminos rápido y completo;
- Home bloqueado mientras el estado es `PENDIENTE`;
- oficialización idempotente;
- un único `initial_estimate`;
- regresión de Bloque 2;
- seguridad/RLS/carrera de username;
- paridad navegador/servidor.

**Backend Bloque 3: CERRADO.**

Próximo bloque por roadmap: **Bloque 4 — Jugadores, búsqueda e invitados provisionales**.
