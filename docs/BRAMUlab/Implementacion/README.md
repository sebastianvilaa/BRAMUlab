# Implementación — evidencia técnica conservada

**No es una fuente de producto ni una lista de tareas.** Cómo funciona cada sistema lo dice su fuente maestra (`../README.md` §2; las fuentes están en `../Producto/`, `../Operacion/`, `../Metrics/` y `../Identidad_Visual/`). Esta carpeta conserva únicamente la evidencia que todavía tiene una función concreta; todo handoff, plan, revisión, gate y resultado consumido se retiró el 08/10/2026 y sigue en Git (`git log --diff-filter=D --name-only -- docs/BRAMUlab/Implementacion/`).

**Regla:** una ronda en curso = **un** documento `Ronda_<tema>.md` en esta carpeta (sin numeración); al cerrar se consolida en la fuente maestra y se retira (`../Metodo_Trabajo.md`, «Higiene documental»). Chequeo: `node docs/check-docs.mjs`.

## Qué se conserva y por qué

| Documento | Qué prueba | Por qué se conserva |
|---|---|---|
| `Backend/Bloque_03/12_Cierre_Bloque_03.md` · `Bloque_04/09_Cierre_…` y `08_Validacion_Final_Staging.md` · `Bloque_05/16_…` · `Bloque_06/20_…` · `Bloque_07/23_…` · `Bloque_08/35_…` | Cierre formal de los Bloques 3–8 del backend (qué quedó aplicado/validado en Staging) | Los cita el Informe de Backend (`Versiones/BRAMUlab_Backend/`) y la cadena de la fuente maestra de Backend |
| `Pre_Production/82_Resultado_Pre_Bloque_9_Hardening_Staging_30SEP.md` | Hardening de permisos/RPC, rate limits, SW/entornos | **Un test lo lee** (`bramulab/tests/prebloque9-hardening.test.mjs`) y `supabase/tests/audit-live-grants.sql` lo cita |
| `Pre_Production/84_Resultado_Bloque_9A_Replay_Limpio_01OCT.md` · `87_Resultado_Bloque_9B_Rehearsal_Operativo_01OCT.md` | Replay limpio de migraciones, línea base de privilegios, ensayo operativo y backup lógico | Evidencia operativa que sustenta `Runbook_Operacion_y_Salida.md` (Production se reconstruye con esto) |
| `Pre_Production/90_Resultado_G1_Emails_Implementacion_Tecnica_01OCT.md` | Sistema de emails/Auth V1: challenges server-side, templates, secrets | Contrato técnico único de emails; lo citan `Backend_Infraestructura.md`, `Privacidad_Legal.md` y `Pre_Production.md` |
| `Pre_Production/122_Cierre_Central_Invitados_V0429_h2_03OCT.md` | Cierre de Invitados / identidad / recuperación (gate técnico + QA visual y límites aceptados) | Único cierre identificable de una ronda de integridad de identidad y datos |
| `Pre_Production/138_Resultado_Auditoria_Exposicion_Seguridad_06OCT.md` · `139_Resultado_Hardening_Exposicion_IP_06OCT.md` | Auditoría de exposición con repo público y hardening aplicado (`dist/` allowlist, motor de Nivel fuera del navegador, SRI) | Seguridad/propiedad intelectual; precondiciones de cualquier cambio de visibilidad del repo, Pages o logo de emails |
| `Pre_Production/146_Cierre_R1_Estado_Cero_Primer_Partido_06OCT.md` | Cierre de Estado Cero / primer partido con cuentas reales de 0 y 1 partido | Evidencia de cierre de P0.1/P0.1B citada por `Pre_Production.md` |
| `Post_Lanzamiento/148_*` · `149_*` | BRAMU Metrics V1 (plan y resultado F1/F2/F3) | **Metrics está en desarrollo: protegido** |
