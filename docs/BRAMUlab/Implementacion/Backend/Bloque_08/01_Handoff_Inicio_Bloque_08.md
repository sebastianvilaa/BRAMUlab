# Backend Bloque 8 — Handoff de inicio: BRAMU Intelligence V1

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Backend Bloques 1–7 CERRADOS en Staging.  
**Objetivo inmediato:** iniciar Bloque 8 sin reabrir decisiones cerradas ni investigar desde cero.

## 1. Lectura obligatoria y orden

Leer completo y en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/23_Cierre_Bloque_07.md`
4. `docs/BRAMUlab/BRAMU_Intelligence.md`
5. `docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md`
6. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
7. `docs/BRAMUlab/Ranking_BRAMU.md`
8. `docs/BRAMUlab/Backend_Infraestructura.md` — solo lo necesario para Bloque 8 y contratos existentes.

NO usar `Archivo/`, `Backup/` ni handoffs históricos ya consumidos como autoridad.

## 2. Estado que no se reabre

- Bloques Backend 1–7: cerrados en Staging.
- Partidos, identidad, validación, Nivel y Ranking reales ya existen server-side.
- Ranking real semanal está cerrado y sin fallback productivo a mocks.
- HEAD funcional final de Ranking: `44727e61d9d50cedd29c30211fd3a6e43391666e`.
- Bundle funcional final: `04.10-h22`.
- main, Production y BRAMUlive quedan fuera de alcance.

## 3. Contrato de producto de Intelligence

BRAMU Intelligence es un motor selectivo de insights respaldados por evidencia real.

No es:

- relator del partido;
- generador libre de texto;
- recomendador técnico;
- sustituto de Nivel;
- sustituto de Ranking.

Regla central:

> Si BRAMU no registró un hecho, Intelligence no puede afirmarlo.

La frase visible nunca es la fuente de verdad. La autoridad debe ser evidencia estructurada, versionada y trazable.

La salida V1 debe funcionar completamente sin proveedor de IA:

- 1 insight principal;
- 0–2 secundarios;
- plantillas determinísticas;
- abstención cuando no existe evidencia suficiente.

La capa generativa es opcional y queda para la fase correspondiente; no bloquea V1.

## 4. Orden de construcción vigente

Seguir `BRAMU_Intelligence_Implementacion.md`:

- A — Datos y derivados;
- B — Claims y evidencia;
- C — Relevancia y memoria editorial;
- D — Plantillas y UX;
- E — Integración Nivel + Ranking;
- F — Generación opcional.

No intentar implementar A–F en una sola ronda.

## 5. Primera intervención técnica recomendada

Trabajar únicamente en **A — Datos y derivados**.

Objetivo:

- mapear qué datos reales ya están disponibles en los contratos server-side cerrados;
- definir/implementar la capa mínima de datos y derivados que Intelligence necesita;
- reutilizar identidades, partidos oficiales, fecha real, formato/score, Nivel y Ranking existentes;
- separar historia personal de impacto oficial cuando corresponda;
- preparar derivados determinísticos de rachas, forma y relaciones sin producir todavía la experiencia completa de Intelligence;
- agregar fixtures/tests determinísticos suficientes para esta fase;
- no duplicar motores ni recalcular Nivel/Ranking;
- no inventar datos;
- no agregar nuevos campos manuales obligatorios al usuario.

## 6. Restricciones

- NO tocar `main`.
- NO tocar Production.
- NO tocar BRAMUlive.
- NO monetización/ads/planes.
- NO marcador en vivo dentro de BRAMUlab.
- NO generación libre de claims.
- NO implementar recomendaciones técnicas.
- NO usar mocks como verdad productiva.
- NO recalcular Nivel histórico con valores actuales.
- NO atribuir movimiento semanal de Ranking a un único partido.
- NO modificar contratos cerrados de Bloques 1–7 sin una causa concreta y revisión central.

Si aparece una decisión humana real:

- marcarla `DECISIÓN ABIERTA`;
- continuar todo lo que no dependa de ella;
- no detener la ronda completa.

## 7. Pruebas

Las pruebas deben demostrar riesgos concretos de esta fase.

Criterio transversal de Intelligence:

- 0 números incorrectos;
- 0 entidades inventadas;
- 0 acciones no registradas;
- 0 claims sin evidencia.

Para A, priorizar:

- orden por fecha real vs orden de carga;
- formatos comparables/no comparables;
- identidades corregidas;
- partidos pendientes vs oficiales;
- rachas y cortes;
- relaciones compañero/rival;
- historial corto y largo;
- correcciones/anulaciones si afectan derivados.

No repetir QA de Ranking, Nivel o Partidos ya cerrada salvo regresión concreta.

## 8. Entrega esperada

Al terminar la primera ronda:

1. indicar exactamente qué se implementó;
2. listar archivos modificados;
3. reportar tests ejecutados y resultado;
4. indicar cualquier `DECISIÓN ABIERTA`;
5. confirmar que main/Production/BRAMUlive no fueron tocados;
6. dejar documentación suficiente para que ChatGPT central revise sin releer una investigación grande;
7. proponer el siguiente paso acotado, normalmente B — Claims y evidencia, solo si A quedó realmente cerrada.

No avanzar automáticamente a B sin revisión central.
