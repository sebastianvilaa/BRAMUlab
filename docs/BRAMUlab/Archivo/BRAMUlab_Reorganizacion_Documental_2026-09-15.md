# BRAMUlab — Reorganización documental 2026-09-15

**Estado:** cerrada como normalización documental posterior a BRAMUlab V04.9.  
**Objetivo:** reducir ambigüedad, separar fuentes vigentes de antecedentes históricos y evitar lecturas innecesarias de contexto por herramientas de desarrollo.

## 1. Estado de producto al ordenar

- Versión pública/de desarrollo vigente: **BRAMUlab V04.9**.
- Base anterior cerrada: **BRAMUlab V03.10**.
- Nivel BRAMU: motor `nivel_bramu_v1_0` + estimador `nivel_inicial_v1_1`, con **1394/1394 tests** al cierre de V04.9.
- Fórmula normativa vigente: `Nivel_BRAMU_Formula_V1.5.md`.

## 2. Fuentes maestras activas

Para trabajo nuevo, empezar por `docs/BRAMUlab/README.md` y leer solamente la fuente maestra del sistema afectado.

- Nivel: `Nivel_BRAMU_Formula_V1.5.md` → `Nivel_BRAMU_Implementacion.md` → `Nivel_BRAMU.md`.
- Ranking: `Ranking_BRAMU.md`.
- Intelligence: `BRAMU_Intelligence.md` → `BRAMU_Intelligence_Implementacion.md`.
- Backend/Infraestructura: `Backend_Infraestructura.md`.
- Ideas futuras: `BRAMUlab_Backlog.md`.
- Implementación V04: `Versiones/BRAMUlab_V04/BRAMUlab_V04_Consolidado.md` + `BRAMUlab_V04_Informe.md`.

## 3. Archivo histórico

Se movieron fuera de la raíz activa, sin borrar:

- `Nivel_BRAMU_Formula_V1.4.md` → `Archivo/Nivel_BRAMU/`.
- `Nivel_BRAMU_Handoff_Cuestionario_V1.5.md` → `Archivo/Nivel_BRAMU/`.
- `BRAMUlab_V04.6_Handoff.md` → `Archivo/BRAMUlab_V04/`.
- `Backend_Infraestructura_Informe.md` → `Archivo/Backend_Infraestructura/`.

`Archivo/` conserva antecedentes y handoffs consumidos. `Backup/` conserva copias de seguridad deliberadas. `Referencias/` contiene material contextual/no normativo. `Versiones/` contiene Consolidado + Informe por versión mayor.

## 4. Normalización de precedencia

Toda referencia histórica a `Nivel_BRAMU_Formula_V1.4.md` dentro de documentos anteriores debe interpretarse bajo esta regla:

- **V1.5 es la fuente normativa vigente.**
- El motor de partidos conservó `nivel_bramu_v1_0` sin cambios.
- V1.5 reemplazó la estimación inicial de V1.4 por `nivel_inicial_v1_1`.
- Para altas nuevas no se usan las reglas del cuestionario V1.4.

También rige Ranking BRAMU semanal: los movimientos de puesto existen al publicar una nueva edición semanal, no como efecto instantáneo de cada partido.

## 5. Regla operativa para Claude Code / desarrollo

No hacer una auditoría general del árbol documental para cada ronda.

1. Leer `docs/BRAMUlab/README.md`.
2. Ir directo al documento maestro del sistema involucrado.
3. Para una ronda ya cerrada, consultar solo la sección concreta del último Informe si hace falta trazabilidad.
4. No leer `Archivo/`, `Backup/`, Informes completos de versiones anteriores ni handoffs consumidos salvo que el pedido lo requiera explícitamente.
5. Si aparece una referencia histórica a V1.4, aplicar la precedencia V1.5 indicada arriba y no reabrir la definición por ese motivo.
6. Si existe una contradicción material no resuelta por las fuentes maestras vigentes, reportarla; no iniciar investigación amplia por defecto.

## 6. Alcance de esta reorganización

Es una normalización documental. No modifica código, fórmula, tests, UX, Ranking ni Backend. No constituye una nueva versión de BRAMUlab.
