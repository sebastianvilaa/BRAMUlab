# 124 — Handoff activo QA Invitados / Identidad / Pendientes

**Fecha:** 04/10/2026  
**Rama:** `staging`  
**Estado:** ronda focalizada abierta antes de Production.

El consolidado completo de esta ronda vive en **GitHub Issue #29 — “V04.30 — Correcciones QA Invitados / Identidad / Pendientes”**.

Claude Code debe leer, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Experiencia_Inicial.md`
4. Issue #29 completo

Issue #29 contiene:
- PASS funcionales ya comprobados y que no deben repetirse salvo regresión;
- bugs técnicos B1/B2/B3 con reproducción y diagnóstico;
- decisiones UX confirmadas de claim/recuperación;
- alcance AGREGAR/FUSIONAR/REEMPLAZAR/NO TOCAR;
- pruebas requeridas;
- reglas Git/deploy;
- gate posterior.

No tocar `main`, Production ni BRAMUlive.

Al terminar, Claude debe crear:
`docs/BRAMUlab/Implementacion/Pre_Production/125_Resultado_Correcciones_QA_Invitados_04OCT.md`
y actualizar las fuentes maestras afectadas con el estado real.
