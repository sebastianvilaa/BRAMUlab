# BRAMU — índice general del repositorio

Este repositorio contiene **dos productos independientes**: BRAMUlab (partidos ya jugados, jugadores, Nivel, Ranking, Grupos e Intelligence) y BRAMUlive (marcador en vivo). No mezclar sus funciones ni sus entregas.

## BRAMUlab

**Empezar siempre por [docs/BRAMUlab/README.md](docs/BRAMUlab/README.md)**: identifica las fuentes maestras y el estado vigente. No tomar los nombres de los archivos históricos como una lista de tareas pendientes.

- [Nivel BRAMU](docs/BRAMUlab/Nivel_BRAMU.md)
- [Ranking BRAMU](docs/BRAMUlab/Ranking_BRAMU.md)
- [Grupos](docs/BRAMUlab/Grupos_BRAMU.md)
- [Cargar partido](docs/BRAMUlab/Cargar_Partido.md) e [Historia y experiencia inicial](docs/BRAMUlab/Experiencia_Inicial.md)
- [BRAMU Intelligence](docs/BRAMUlab/BRAMU_Intelligence.md)
- [Identidad visual](docs/BRAMUlab/Identidad_Visual.md) y [archivos de marca usados por la app](docs/BRAMUlab/Marca/)
- [Backend e infraestructura](docs/BRAMUlab/Backend_Infraestructura.md)
- [Método de trabajo entre agentes](docs/BRAMUlab/Metodo_Trabajo.md)
- [BRAMU Metrics](docs/BRAMUlab/BRAMU_Metrics.md) — consola interna, independiente de BRAMUlive; consultar el README para conocer su estado real

Código: [bramulab/](bramulab/) · Backend y migraciones: [supabase/](supabase/) · Evidencias históricas y de implementación: [docs/BRAMUlab/Implementacion/](docs/BRAMUlab/Implementacion/).

## BRAMUlive

Código: [bramulive/](bramulive/) · Documentación: [docs/BRAMUlive/](docs/BRAMUlive/).

## Cómo interpretar las carpetas

- `docs/BRAMUlab/Archivo/`, `Auditorias/`, `Versiones/` e `Implementacion/` contienen antecedentes, evidencias y consolidados **que no reemplazan las fuentes maestras**.
- `Temporales/` no se versiona. Evitar dejar allí documentación normativa única.
- Los `.mjs`, `.js`, `.ts` y `.sql` son código, tests y migraciones: no moverlos por criterio visual sin verificar dependencias.
- El repositorio es público en este estado; no agregar originales privados, secretos ni documentación sensible.
- Los originales editables del sistema gráfico (Illustrator y referencias de diseño) se conservan separados en Dropbox. No reemplazarlos ni eliminarlos.
- La versión efectivamente publicada en Production o Staging se verifica en los respectivos despliegues, no a partir de un nombre de carpeta.

Mantenimiento y reorganización documental: [Issue #31](https://github.com/sebastianvilaa/BRAMUlab/issues/31).
