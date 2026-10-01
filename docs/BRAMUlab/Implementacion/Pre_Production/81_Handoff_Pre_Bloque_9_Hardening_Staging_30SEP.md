# Handoff 81 — Pre-Bloque 9: hardening de Staging independiente de Comunicaciones

**Fecha:** 30/09/2026  
**Entorno:** únicamente `staging`  
**Estado de entrada:** V04.20 con PASS técnico Central. P0.2 sigue abierto solo por gates externos de emails/Auth, QA browser y E2E destructivo con OTP.

## Objetivo

Aprovechar la espera del trabajo de Comunicaciones para adelantar todo el endurecimiento de salida que **no depende del contenido/configuración final de emails ni de Production**.

Esto es preparación/hardening previo a Bloque 9. No habilita abrir Production ni reemplaza los gates pendientes de P0.2.

## Leer

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Backend_Infraestructura.md` — Bloque 9
4. `docs/BRAMUlab/Pre_Production.md` — P0.5
5. este handoff

No releer Archivo/Backup ni informes históricos salvo trazabilidad puntual necesaria.

## Alcance

### AGREGAR / VERIFICAR

1. **RLS, permisos y superficie RPC**
   - inventariar grants reales de `anon`, `authenticated` y `service_role`;
   - clasificar los advisors vigentes: intencional / histórico / corregible;
   - corregir solo exposición realmente involuntaria;
   - prestar especial atención a helpers internos `SECURITY DEFINER`, RPCs administrativas y funciones de soporte;
   - mantener públicas únicamente las RPC que el cliente necesita y cuya autorización interna sea correcta.

2. **Rate limits**
   - inventariar endpoints sensibles y los límites ya existentes;
   - detectar huecos reales en signup/claim/búsqueda/contacto/partidos/correcciones/acciones administrativas;
   - agregar únicamente límites faltantes con riesgo concreto;
   - no convertir esto en infraestructura antiabuso avanzada.

3. **Caché / service worker / separación de entornos**
   - verificar que Staging/Production no puedan compartir autoridad, cache names, borradores privados ni configuración;
   - comprobar fail-closed ante variables faltantes/cruzadas;
   - revisar limpieza/versionado de Service Worker para evitar assets o mocks viejos;
   - no cambiar UX salvo que sea necesario para corregir un defecto real.

4. **Métricas mínimas**
   - trazar qué eventos reales ya existen;
   - definir una consulta/vista mínima útil para salud operativa de los primeros usuarios sin datos sensibles;
   - reutilizar infraestructura existente; no integrar analítica de terceros;
   - no inventar KPIs que BRAMU no registra.

5. **Backup / exportación / operación administrativa**
   - verificar qué puede hacerse hoy en Staging y qué dependerá del futuro proyecto Production;
   - consolidar procedimiento para exportación/backup, cuenta problemática, corrección/anulación excepcional y eliminación;
   - reutilizar scripts/RPCs existentes, no crear un segundo motor.

6. **Checklist reproducible de salida**
   - preparar el orden exacto para una futura creación de Supabase Production, variables Vercel Production, replay de migraciones, Edge Functions, cron/jobs y smoke;
   - marcar claramente cada paso que requiera autorización futura de Sebastián;
   - **NO ejecutar ninguno de esos pasos ahora**.

### FUSIONAR / CORREGIR

- corregir documentación desfasada de hardening solo cuando el código/infra real lo justifique;
- si una advertencia del advisor es intencional, dejar evidencia explícita del porqué en vez de “silenciarla” con cambios peligrosos;
- si una corrección necesita migración, dejarla versionada y con verify focalizado para que Central pueda aplicarla en Staging.

### NO TOCAR

- contenido, diseño o templates de emails;
- Secure Email Change / SMTP / configuración de Comunicaciones;
- flujo legal pendiente que dependa de esos emails;
- E2E destructivo con OTP;
- `main`, Production o creación del proyecto Supabase Production;
- BRAMUlive;
- Nivel BRAMU, Ranking, Grupos, Intelligence o reglas deportivas;
- rediseños visuales o P1;
- monetización, analytics externos o arquitectura comercial.

## Criterio de implementación

Primero auditar. Cambiar código/backend solo donde haya un riesgo concreto de salida.

No perseguir “cero warnings” si el warning describe una RPC intencional y segura. Sí corregir helpers/admin grants abiertos por accidente, aislamiento de entorno, permisos o rate limits si existe evidencia.

Evitar tocar `bramulab/` si no es necesario para ahorrar deploy. Si hay un cambio frontend real, consolidarlo en un único push.

## Pruebas

Según riesgo:

- SQL verifies focalizados para permisos/RLS/rate limits/migraciones nuevas;
- tests Node focalizados para cache/env si se modifica código compartido;
- suite completa solo si cambia lógica transversal;
- advisors de Supabase como evidencia, no como objetivo cosmético;
- no hace falta QA browser en esta ronda salvo que aparezca una regresión visible inevitable.

## Salida esperada

Guardar un resultado corto en:

`docs/BRAMUlab/Implementacion/Pre_Production/82_Resultado_Pre_Bloque_9_Hardening_Staging_30SEP.md`

Debe registrar:

- qué se auditó;
- riesgos reales encontrados;
- qué se corrigió;
- tests/verifies ejecutados;
- qué queda pendiente exclusivamente por Comunicaciones/Work/OTP/Production;
- cualquier **DECISIÓN ABIERTA** real.

## Git

- trabajar solo sobre `staging`;
- ideal: un único commit/push lógico;
- no tocar main/Production/BRAMUlive;
- si hay migraciones, dejarlas en repo pero **no asumir que están aplicadas remotamente**: Central hará el gate Staging;
- al terminar, push a `origin/staging` y reportar solo HEAD + PASS/FAIL + pendientes reales.
