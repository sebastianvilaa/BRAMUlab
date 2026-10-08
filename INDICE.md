# BRAMU — índice general del repositorio

Este repositorio contiene **dos productos independientes**: BRAMUlab (partidos ya jugados, jugadores, Nivel, Ranking, Grupos e Intelligence) y BRAMUlive (marcador en vivo). No mezclar sus funciones ni sus entregas.

## BRAMUlab

**Empezar siempre por [docs/BRAMUlab/README.md](docs/BRAMUlab/README.md)**: tiene el estado actual y la lista de fuentes maestras (una por sistema).

- [Nivel BRAMU](docs/BRAMUlab/Nivel_BRAMU.md)
- [Ranking BRAMU](docs/BRAMUlab/Ranking_BRAMU.md)
- [Grupos](docs/BRAMUlab/Grupos_BRAMU.md)
- [Cargar partido](docs/BRAMUlab/Cargar_Partido.md) e [Historia y experiencia inicial](docs/BRAMUlab/Experiencia_Inicial.md)
- [BRAMU Intelligence](docs/BRAMUlab/BRAMU_Intelligence.md)
- [Identidad visual](docs/BRAMUlab/Identidad_Visual.md) y [archivos de marca usados por la app](docs/BRAMUlab/Marca/)
- [Backend e infraestructura](docs/BRAMUlab/Backend_Infraestructura.md), [operación y salida](docs/BRAMUlab/Runbook_Operacion_y_Salida.md) y [deploy / Production](docs/BRAMUlab/Operacion_Vercel_Staging_Production.md)
- [Privacidad y legal](docs/BRAMUlab/Privacidad_Legal.md)
- [Método de trabajo entre agentes](docs/BRAMUlab/Metodo_Trabajo.md) (incluye las reglas para no volver a acumular documentos)
- [BRAMU Metrics](docs/BRAMUlab/BRAMU_Metrics.md) — consola interna, independiente de BRAMUlive, **en desarrollo y protegida**; el README explica su estado real

## BRAMUlive

Código: [bramulive/](bramulive/) · Documentación: [docs/BRAMUlive/](docs/BRAMUlive/).

## Qué hay en cada carpeta

| Carpeta | Qué es |
|---|---|
| `bramulab/` | La app BRAMUlab: pantallas, lógica y estilos (`app.js`, `index.html`, `styles.css`…). **Los `*.test.mjs` son pruebas automáticas** de esa lógica (se ejecutan con `node --test bramulab/*.test.mjs`); `scripts/` arma la versión que se publica. |
| `bramulive/` | La app BRAMUlive (separada). |
| `supabase/` | El servidor: `migrations/` (cambios de la base de datos, en orden), `functions/` (procesos del servidor, p. ej. oficializar un partido), `tests/` (verificaciones SQL/JS contra Staging) y `scripts/` (herramientas de operación: backup, ensayo de salida, `release-check`). |
| `docs/BRAMUlab/` | Documentación: fuentes maestras en la raíz; evidencia técnica en `Implementacion/`; historia por versión en `Versiones/`. |
| `docs/BRAMUlab/Auditorias/simulaciones/` | Scripts de investigación (Nivel/Ranking) con sus resultados; no son parte de la app. |
| `docs/check-docs.mjs` | Chequeo de orden documental (`node docs/check-docs.mjs`). |

Los `.mjs`, `.js`, `.ts` y `.sql` son código, pruebas, migraciones o herramientas: **no se mueven ni se borran por criterio visual** sin verificar dependencias.

## Cómo interpretar la documentación

- Las **fuentes maestras** (raíz de `docs/BRAMUlab/`) mandan. `Versiones/` e `Implementacion/` son trazabilidad y evidencia: **no reemplazan** a una fuente maestra.
- Lo que ya no sirve se **retira** del árbol; la historia queda en Git (`git log --diff-filter=D --name-only -- docs/`). No hay carpetas `Archivo/` ni `Backup/`.
- `Temporales/` no se versiona. No dejar allí documentación única: lo sensible va a `Documentos privados/` en Dropbox.
- El repositorio es público en este estado; no agregar originales privados, secretos ni documentación sensible.
- Los originales editables del sistema gráfico (Illustrator y referencias de diseño) se conservan en Dropbox (`/Otros Trabajos/BRAMU/Sistema grafico/`; mapa en el `LEEME.md` de esa carpeta). No reemplazarlos ni eliminarlos.
- La versión efectivamente publicada en Production o Staging se verifica en los respectivos despliegues, no a partir de un nombre de carpeta.

Mantenimiento y reorganización documental: [Issue #31](https://github.com/sebastianvilaa/BRAMUlab/issues/31).
