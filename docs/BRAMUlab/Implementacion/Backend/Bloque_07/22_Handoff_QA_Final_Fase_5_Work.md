# Backend Bloque 7 — Handoff QA final de Fase 5 (ChatGPT Work)

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Objetivo:** QA real de navegador de Ranking server-backed antes de cerrar Bloque 7.

## Estado técnico de entrada

- Backend Ranking Fases 1–4: aplicado/validado en Supabase Staging.
- Frontend Fase 5: conectado a RPCs reales.
- Corrección GeoRef F5-C01: revisada en código y validada contra Supabase Staging con rollback:
  - mismo `location_id`;
  - `verified_for_ranking=true`;
  - sin degradación a ubicación manual.
- F5-C02: shell de Ranking detrás del gate.
- Corrección central adicional: `AHORA NO` ya NO desbloquea la clasificación con datos faltantes; cierra el overlay y vuelve a Home.
- Bundle esperado: `04.10-h22`.
- No usar mocks ni fallback local en Staging.

## Restricciones

- NO desarrollar.
- NO modificar código.
- NO tocar Supabase ni crear fixtures.
- NO tocar Vercel config.
- NO tocar main/Production/BRAMUlive.
- NO empezar Intelligence.
- Usar únicamente el Preview de BRAMUlab correspondiente al HEAD indicado por ChatGPT central.
- Si requiere autenticación y no hay sesión/cuenta utilizable en el navegador de Work, detenerse solo en ese bloqueo y reportarlo; no pedir ni manipular secretos.

## QA dirigida

### A. Confirmación de deploy

1. Confirmar que el Preview servido corresponde al HEAD esperado.
2. Confirmar bundle `04.10-h22`.
3. Confirmar que es BRAMUlab, no BRAMUlive.

### B. Gate de datos de Ranking

Con una cuenta real de Staging que tenga datos de Ranking incompletos:

1. Desde Home tocar Ranking.
2. Confirmar que la pantalla/shell de Ranking aparece DETRÁS.
3. Confirmar overlay simple delante:
   - título/copy de completar datos;
   - CTA `COMPLETAR DATOS`;
   - acción `AHORA NO`.
4. Confirmar que la clasificación detrás no es interactuable mientras el overlay está abierto.
5. Tocar `AHORA NO`:
   - debe volver a Home;
   - NO debe dejar Ranking interactivo;
   - no debe guardar nada.
6. Volver a Ranking y tocar `COMPLETAR DATOS`.
7. Confirmar formulario de:
   - rama;
   - localidad;
   - opt-in.
8. Confirmar `VOLVER` vuelve al paso simple sin persistir nada.

### C. Guardado real

1. Completar datos válidos usando el selector real de localidad.
2. Guardar.
3. Confirmar:
   - overlay cierra;
   - permanece en Ranking;
   - no hay error de RPC;
   - la cuenta queda recacheada sin logout/login;
   - no vuelve a abrir el gate al reingresar.
4. Confirmar que Staging NO muestra datos simulados si no hay edición publicada:
   - estado vacío/error honesto;
   - jamás nombres/puestos mock.

### D. Ranking server-backed

Con el estado real disponible en Staging, recorrer sin fabricar datos:

- Local / Provincia / País / Global;
- selector M/F;
- filtro Todos/Nivel;
- búsqueda;
- Tu posición;
- Mi red;
- Perfil propio;
- Perfil público si hay acceso;
- Home / TU MOMENTO.

No exigir puestos donde los datos reales no alcancen. La ausencia honesta es PASS.

### E. Regresiones mínimas

- navegación Home ↔ Ranking;
- botón volver;
- abrir/cerrar ayuda de Ranking;
- scroll sin overlay;
- consola sin errores nuevos relevantes;
- ningún cambio visible en BRAMUlive.

## Resultado

Crear/entregar un informe corto con:

- HEAD/bundle realmente servidos;
- PASS/FAIL por A–E;
- screenshots solo de fallos o de estados visuales que requieran evaluación;
- errores de consola/red relevantes;
- cualquier bloqueo real.

Conclusión final exacta:

- `FASE 5 QA PASS — BLOQUE 7 APTO PARA CIERRE`
o
- `FASE 5 QA FAIL — <motivo concreto>`
