# Pre-Production — índice activo

La fuente maestra es `docs/BRAMUlab/Pre_Production.md`.

Esta carpeta contiene únicamente documentos que siguen teniendo valor operativo hoy.

## Vigentes

- `10_Resultado_Perfil_Editable_ServerBacked_Claude.md` — evidencia de P0.1C cerrado.
- `31_Resultado_Hardening_Final_P0_3_27SEP.md` + `32_Resultado_Aplicacion_Staging_P0_3_27SEP.md` — estado técnico vigente de eliminación de cuenta; falta E2E destructivo real.
- `34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md`, `36_Resultado_Correccion_P0_2_Fase_A_27SEP.md`, `61_Cierre_Decisiones_Legales_Compliance_V1_27SEP.md` — soporte temporal del frente Legal. El chat Legal/Work debe consolidarlos y retirarlos cuando cree la fuente maestra final.
- `60_Resultado_Sistema_Visual_Unificado_h21_27SEP.md` — baseline visual/técnica actual; pendiente revisión directa de Sebastián.
- `62_Handoff_Grupos_BRAMU_28SEP.md` — handoff activo para productivización de Grupos.
- `89_Handoff_G1_Emails_Implementacion_01OCT.md` + `90_Resultado_G1_Emails_Implementacion_Tecnica_01OCT.md` — G1 Emails/Auth V1: contrato y resultado técnico (pendiente aplicar en Staging + QA real).
- `129_Handoff_Rediseno_Recuperados_Pendientes_V0433_05OCT.md` + `130_Resultado_Rediseno_Recuperados_Pendientes_V0433_05OCT.md` — V04.33: Recuperados automático + validación rápida + Partidos pendientes (Issue #29); migración `20261005200000` pendiente de aplicar en Staging.
- `131_Handoff_Cierre_QA_V0433_Correccion_Final_V0434_06OCT.md` + `132_Resultado_Cierre_QA_V0434_06OCT.md` — V04.34: cierre post-QA humano (Partidos pendientes como pantalla propia, unificación visual, pre-check y decisión durable de `ES OTRO PARTIDO`); migración `20261006100000` pendiente de aplicar en Staging.

## Regla

No recrear cadenas de handoffs/revisiones/hotfixes. Una ronda mantiene:
- un handoff mientras está activa;
- un resultado/cierre cuando termina.

Al consolidar, el handoff consumido se elimina. Git conserva la trazabilidad.
