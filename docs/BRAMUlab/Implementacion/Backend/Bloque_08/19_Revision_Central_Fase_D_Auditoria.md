# Backend Bloque 8 — Revisión central final de Fase D: auditoría persistida

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Commit revisado:** `95ad23d9ec9ee7d2dd8962d4d1071c667a40df48`  
**Estado:** **D01–D05 APROBADOS. Falta un único bloqueo D06 antes de aplicar/deployar Supabase Staging.**

## 1. Qué queda aprobado

La revisión central da por correctos:

- **H01** — identidad abierta no alimenta relaciones;
- **D01** — replay cronológico por checkpoints, sin memoria del futuro ni autopunición del partido corregido;
- **D02** — fingerprint ampliado con identidad/composición/formato/scoring/hora;
- **D03** — memoria propia de D preservada a través de C;
- **D04** — copy de sets corridos aclara “en games”;
- **D05** — primera lectura de forma no finge una ventana previa equivalente.

También queda aprobado el reemplazo de `intelligence_player_memory` por checkpoints `memory_after` por partido.

Suite reportada por Claude: **128/128 PASS**.

No aplicar todavía la migración ni desplegar la Edge Function: falta D06 y la migración sigue inédita en Staging, por lo que puede corregirse directamente sin deuda ni migración compensatoria.

---

## 2. D06 — la salida persistida no conserva el objeto de evidencia/auditoría exigido por la fuente

**Bloqueante antes de aplicar la migración.**

La fuente maestra cierra dos requisitos explícitos:

### BRAMU_Intelligence.md §6.5

> guardar claims, evidencia, puntajes, descartes y versión de reglas para poder reconstruir la decisión.

### BRAMU_Intelligence_Implementacion.md §2–3

La salida y su evidencia deben guardarse; cada insight visible debe poder trazarse a:

- tipo/familia;
- jugador de perspectiva;
- claim estructurado;
- valores usados;
- partidos fuente;
- alcance de comparación;
- tamaño de muestra;
- confianza;
- alcance personal/oficial;
- relevancia;
- clave semántica;
- template;
- versión de reglas;
- fecha de corte;
- estado/motivo de descarte o fallback.

La implementación actual persiste en `intelligence_match_outputs`:

- `output`: texto/UX visible + algunos metadatos de los insights seleccionados;
- `memory_after`: memoria editorial interna.

Pero **no persiste la decisión auditable completa**:

- el claim estructurado de cada candidato;
- comparisonScope;
- sampleSize;
- score/subscores/penalizaciones;
- candidatos descartados;
- motivo final de descarte/no selección;
- candidatos de Fase B descartados por evidencia/muestra;
- relación exacta entre decisión editorial y salida presentada.

Hoy esa información existe durante la ejecución de A→B→C, pero se pierde al terminar la request.

Eso hace que una salida histórica persistida no pueda auditarse completamente sin volver a ejecutar las reglas actuales, justamente lo que la fuente busca evitar.

---

## 3. Corrección requerida

### Migración

**AGREGAR** a `intelligence_match_outputs` una columna server-only:

`audit jsonb not null`

o nombre equivalente claro.

No exponerla al navegador. La tabla continúa RLS deny-by-default y service_role-only.

Como la migración aún NO fue aplicada, modificar el mismo archivo existente. No crear migración compensatoria.

### Snapshot auditable

Cada checkpoint generado debe guardar un snapshot estructurado suficiente para reconstruir la decisión de ESE partido sin recalcularla.

Debe incluir como mínimo:

- `matchId`;
- `perspectivePlayerId`;
- `dataAsOf/playedAt`;
- versiones A/B/C/D y versión combinada;
- **todos los claims producidos por Fase B**, incluidos los descartados por evidencia/muestra, con:
  - insightType/family;
  - claim estructurado;
  - evidenceMatchIds;
  - comparisonScope;
  - sampleSize/minSampleRequired;
  - confidenceTier;
  - officialScope;
  - discarded;
  - discardReason;
  - rulesVersion/dataAsOf;
- evaluación editorial de C para los claims afirmados:
  - semanticKey;
  - status;
  - editorialStatus;
  - excludedReason;
  - score bruto/subscores/penalizaciones/finalScore;
- qué candidato quedó como principal;
- cuáles quedaron secundarios;
- abstención/fallback;
- templateId final de los seleccionados;
- fuente/fingerprint del checkpoint.

No hace falta guardar historial crudo ni duplicar sets/players completos dentro de `audit`: los `evidenceMatchIds` + claims estructurados son la evidencia trazable.

### Separación de responsabilidades

Preferencia simple:

1. **Fase C** puede extender su objeto de retorno con los `allClaims` que ya recibió de B, sin cambiar ninguna lógica/score/selección.
2. **Fase D** construye un `auditSnapshot` inmutable a partir de:
   - decisión de C;
   - salida renderizada;
   - callerPlayerId;
   - fingerprint/versiones.
3. `runIntelligenceReplay` devuelve por step:
   - output;
   - memoryAfter;
   - audit.
4. La Edge Function persiste los tres.
5. Un checkpoint reutilizado reutiliza también su `audit` exacto; no lo regenera.

Si existe una forma más simple que preserve exactamente el mismo contrato, puede usarse.

---

## 4. Importante: no enviar audit al cliente

La respuesta normal de `get-match-intelligence` sigue devolviendo solamente la salida necesaria para pintar la UI.

`audit` queda server-side para:

- depuración;
- trazabilidad;
- futuras herramientas administrativas;
- demostrar por qué una frase histórica apareció.

“Por qué aparece” sigue usando el resumen humano ya guardado en `output`, no el JSON técnico.

---

## 5. Tests mínimos D06

Agregar cobertura determinística para:

1. un checkpoint nuevo contiene `audit`;
2. el audit contiene claim estructurado + evidenceMatchIds + comparisonScope + sampleSize + confidence + officialScope;
3. un claim descartado por Fase B queda persistido con `discarded=true` y `discardReason`;
4. un candidato descartado por C conserva `editorialStatus` y razón/score;
5. principal/secundarios del audit coinciden con los templateIds/semanticKeys del `output`;
6. un checkpoint reutilizado conserva exactamente el mismo audit;
7. `publicOutputOf` / respuesta al cliente NO contiene `audit` ni memoria interna;
8. 0 claims/números/entidades nuevos son creados por la capa de auditoría.

Mantener verdes A+B+C+D.

---

## 6. Alcance

Este es un **cierre de persistencia/auditoría**, no una nueva fase.

**NO TOCAR** salvo extensión de contrato sin cambio lógico:

- scoring de C;
- selección de C;
- claims/reglas de B;
- templates/copy ya aprobados;
- H01;
- frontend;
- Nivel;
- Ranking;
- Fase E;
- capa generativa;
- main;
- Production;
- BRAMUlive;
- Mis Grupos.

No hacer bump de frontend: D06 no modifica navegador.

---

## 7. Gate final de D

Después de D06:

1. ejecutar tests A+B+C+D;
2. un único commit/push;
3. revisión central corta;
4. ChatGPT central hace dry-run/aplica la migración en Supabase Staging;
5. ChatGPT central deploya `get-match-intelligence`;
6. validación de seguridad/contrato en Staging real;
7. QA visual/manual en Preview;
8. cerrar Fase D;
9. recién entonces preparar Fase E.

No avanzar automáticamente a E.
