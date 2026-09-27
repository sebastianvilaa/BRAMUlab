# BRAMUlab — Revisión Central final h13 antes de retorno a Laboratorio

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `bff04da869be54e97f57368a67822e87337f6fb6`  
**Bundle:** `04.11-h13`

## Veredicto

**APTO PARA RETORNO A LABORATORIO FÍSICO.**

Central revisó la ronda h12 y la corrección final h13 contra:

- `40_Handoff_Ronda_Correctiva_Laboratorio_h11_27SEP.md`
- `42_Revision_Central_h12_Completar_Alcance_27SEP.md`
- fuentes maestras vigentes afectadas.

No se requiere otra ronda de Claude antes del QA físico.

## Evidencia revisada

- Un único commit correctivo h13 sobre la revisión Central.
- Bundle `04.11-h13` presente en `version.json`.
- GitHub/Vercel: `Vercel – bramulab = success`.
- No hay cambios en `bramulive/`, backend, migraciones, fórmula de Nivel, Ranking ni Intelligence.
- Suite reportada por Claude:
  - Node: **325/325 PASS**
  - `tests.html`: **1564/1564 PASS**
  - smoke boot sin error nuevo.

## Cuatro faltantes de h12 — revisión Central

### A. Quien propuso una corrección

PASS por código.

El mismo bloque de comparación oficial/propuesta se usa para ambas partes:
- quien responde ve propuesta completa + Aceptar/Rechazar;
- quien propuso ve propuesta completa, rótulo `Tu corrección propuesta`, estado de espera y NO puede aceptar/rechazar su propia propuesta.

No se creó una segunda fuente de datos.

### B. Corrección propuesta en Home/Historial

PASS para el escenario activo de Laboratorio.

- `CORRECCIÓN PROPUESTA` tiene modificador visual propio;
- gana presencia respecto de un badge ordinario;
- Último partido recibe acento ámbar mientras la corrección está activa;
- `VICTORIA/DERROTA` y score siguen reflejando la última versión oficial.

### C. Nivel real en Compañeros/Rivales

PASS por código.

La misma respuesta batch `Auth.getPlayersCompact` ya usada para avatar/@username aporta también:
- `levelStatus`
- `levelPublic`

No hay llamada N+1 ni Nivel simulado/fabricado.

Central ya había confirmado en Supabase Staging que el caso Matu corresponde a una sola identidad registrada real; la causa era la ruta legacy del frontend.

### D. Salida explícita Por identificar

PASS por código.

El sheet ofrece:
`No sé · dejar Por identificar`

No llama a una nueva RPC porque `report_identity_issue` ya dejó ese estado del lado servidor. La acción solo lo hace explícito para el usuario y cierra el sheet.

## Residual no bloqueante

Existe una inconsistencia preexistente fuera del escenario inmediato:

- `serverMatchStatusLabel` / badge de Historial consideran `pendingCorrectionRevisionId` sin aplicar la ventana física de 3 días;
- el detalle de Resumen y el acento de Último partido sí usan `b6CorrectionWindowOpen`.

Consecuencia potencial: una corrección cuyo puntero siga físicamente presente después de vencer podría conservar el texto `CORRECCIÓN PROPUESTA` en Home/Historial aun cuando ya no sea accionable.

No afecta el QA inmediato h13 ni altera datos/lógica de partido. Registrar para corrección pre-Production o si el Laboratorio encuentra evidencia real. No abrir ahora una mini-ronda adicional solo por este edge case.

## Batería física autorizada

Máximo cinco bloques:

1. **Identidad canónica / Matu**
   - Buscar Jugadores → Matu;
   - Compañeros/Rivales → mismo Matu;
   - avatar, @usuario, Nivel y Perfil deben coincidir.

2. **Corrección de resultado**
   - editar un solo lado de un set existente;
   - invertir un set empezando por cualquiera de los lados;
   - revisar oficial vs propuesta;
   - revisar tanto la vista de quien responde como la de quien propuso.

3. **Identidad incorrecta continua**
   - reportar identidad incorrecta;
   - debe seguir directo a `¿Sabés quién jugó?`;
   - probar reemplazo;
   - probar `No sé · dejar Por identificar`.

4. **Home / Resumen / Reportar error**
   - barra de Nivel;
   - padding de Último partido;
   - grilla del Resumen;
   - jerarquía de corrección activa;
   - tratamiento de Reportar un error;
   - Nivel en Compañeros/Rivales.

5. **Regresión visual rápida**
   - botón central +;
   - navegación principal;
   - sin anomalías visuales obvias nuevas.

No repetir self-healing h11 ni pruebas técnicas ya cubiertas salvo regresión visible.
