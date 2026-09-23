# Backend Bloque 7 — Handoff Fase 5: frontend real de Ranking

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Fases 1–4 de Ranking aplicadas y validadas en Supabase Staging.  
**Evidencia:** `18_Validacion_Central_Fase_4_Staging.md`

## 1. Objetivo único

Conectar el frontend existente de Ranking a los datos/RPCs reales de Staging y retirar el prototipo/mock local como fuente de verdad.

No rediseñar Ranking.

## 2. Fuentes

Leer primero:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Ranking_BRAMU.md`
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/15_Validacion_Central_Fase_3_Staging.md`
5. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/18_Validacion_Central_Fase_4_Staging.md`

Después inspeccionar únicamente lo necesario de:

- `bramulab/ranking.js`;
- integración de Ranking en `app.js`;
- Home / Mi Perfil / Perfil público donde ya existe UI de Ranking;
- service worker/precache si corresponde;
- patrones de llamadas Supabase ya usados por otros módulos.

## 3. Principio

La UI visual/conceptual de Ranking ya está cerrada.

**Fase 5 no inventa otra UX.**

Debe:

- conservar estructura y diseño existentes;
- reemplazar datos simulados por RPCs reales;
- mostrar estados honestos cuando todavía no hay edición o el jugador no tiene posición;
- no calcular autoridad competitiva en navegador.

## 4. RPCs reales

Consumir los contratos de Fase 3:

- `get_current_ranking_edition()`;
- `get_ranking_classification(...)`;
- `get_my_ranking_position(...)`;
- `get_ranking_network(...)`;
- `set_ranking_network_hidden(...)`;
- `get_profile_ranking_summary(...)`;
- `get_home_ranking_insight()`;
- `complete_ranking_profile_data(...)` para el gate de datos de Ranking.

No consultar tablas server-only directamente.

## 5. Pantalla Ranking

Conectar:

- Local;
- Provincial;
- País;
- Global;
- Mi red;
- selector M/F;
- Todos los niveles / Nivel 1–10;
- búsqueda;
- paginación/lazy loading según UI existente;
- Tu posición;
- movimiento semanal;
- estados de densidad;
- Global locked;
- estados sin puesto;
- Mi red 1–2 sin puesto / 3+ con puesto;
- Ocultar / Ocultos (N) / Volver a mostrar.

El navegador nunca recalcula posición, empate, denominador o densidad.

## 6. Gate “Completar datos para Ranking”

Si faltan:

- localidad deportiva válida;
- rama competitiva;
- ranking_opt_in;

usar la UX ya definida por el master y persistir exclusivamente mediante `complete_ranking_profile_data(...)`.

No reutilizar `complete_profile`.

No pedir datos que el backend no necesita.

## 7. Datos reales actuales

Staging puede no tener todavía una edición publicada ni población elegible suficiente.

Eso es válido.

No insertar mocks para “llenar” la pantalla.

Los estados vacíos deben ser honestos y comprensibles.

Para QA de posiciones se crearán fixtures controlados más adelante, no fallback productivo.

## 8. Perfil y Home

Conectar las piezas de Ranking ya diseñadas en:

- Mi Perfil;
- Perfil público;
- Home / TU MOMENTO.

Usar las RPCs específicas.

No duplicar la pantalla completa de Ranking en Home.

No introducir BRAMU Intelligence todavía.

## 9. Mocks

Identificar toda fuente simulada/local de Ranking.

Regla:

- Staging/Production con backend configurado → **sin fallback silencioso a mocks**;
- si una RPC falla → estado/error real;
- datos demo solo pueden quedar aislados para test/desarrollo explícito si ya existe un mecanismo claro y no puede filtrarse a Staging/Production.

Preferencia: retirar el mock productivo por completo.

## 10. Carga/errores

Mantener experiencia ágil:

- loading states;
- error retry donde ya corresponda;
- no bloquear toda la app por una RPC de Ranking;
- evitar múltiples llamadas redundantes para la misma edición/contexto;
- cachear en memoria solo datos derivados del mismo snapshot cuando sea seguro.

No sobrearquitectar.

## 11. Bundle / service worker

Si cambia frontend servido:

- bump de bundle siguiendo la convención vigente;
- actualizar precache/service worker si los archivos modificados lo requieren;
- evitar repetir el problema de B6 donde un JS nuevo no quedó precacheado.

## 12. Pruebas automáticas

Agregar tests dirigidos a:

- no mock fallback;
- mapping RPC → UI;
- estados sin edición;
- sin posición / CALIBRANDO;
- selector scope/rama/nivel;
- movement;
- Global locked;
- Mi red hide/restore;
- gate completar datos;
- Perfil/Home;
- error/loading.

Reutilizar tests existentes.

No duplicar suites equivalentes.

## 13. Vercel

El incidente del Ignored Build Step quedó corregido:

- usar `git diff --quiet HEAD^ HEAD ./`;
- no volver a `VERCEL_GIT_PREVIOUS_SHA`.

Esta Fase 5 sí toca `bramulab/`, por lo que debe generar Preview real de bramulab.

**bramulive debe quedar ignorado.**

No tocar configuración de Vercel salvo que aparezca evidencia nueva.

## 14. No hacer

- NO cambiar reglas de Ranking;
- NO backend nuevo salvo un bug bloqueante descubierto por integración;
- NO pg_cron;
- NO Intelligence;
- NO Ranking de Grupos;
- NO Race;
- NO matchmaking;
- NO main;
- NO Production;
- NO BRAMUlive.

## 15. Entrega

Implementar Fase 5 completa en `staging`.

Antes del commit:

- tests automáticos pertinentes;
- revisar que no queden mocks productivos;
- revisar service worker/bundle.

Un único commit lógico.

Crear:

`docs/BRAMUlab/Implementacion/Backend/Bloque_07/20_Resultado_Fase_5_Claude.md`

Al terminar devolver:

- HEAD;
- bundle;
- archivos principales;
- tests;
- estado del mock;
- bloqueos reales.

Después detenerse.

No iniciar QA de navegador por cuenta propia; ChatGPT central decidirá el recorrido final.
