# BRAMU — índice general

BRAMU son dos productos independientes: **BRAMUlab** (app de jugadores: partidos ya jugados, Nivel, Ranking, Grupos, Intelligence) y **BRAMUlive** (marcador en vivo). No mezclar sus funciones ni sus entregas. Estado actual y reglas: [docs/BRAMUlab/README.md](docs/BRAMUlab/README.md).

## Documentos maestros — la definición vigente de cada tema

Un solo documento por tema. Si dos documentos se contradicen, manda el maestro.

| Tema | Documento maestro |
|---|---|
| **Nivel BRAMU** | [Nivel_BRAMU.md](docs/BRAMUlab/Nivel_BRAMU.md) |
| **Ranking BRAMU** | [Ranking_BRAMU.md](docs/BRAMUlab/Ranking_BRAMU.md) |
| **Grupos** | [Grupos_BRAMU.md](docs/BRAMUlab/Grupos_BRAMU.md) |
| **Partidos e historial** | [Cargar_Partido.md](docs/BRAMUlab/Cargar_Partido.md) (cargar un partido) · [Experiencia_Inicial.md](docs/BRAMUlab/Experiencia_Inicial.md) (validar, corregir, pendientes, historial) |
| **Experiencia inicial** | [Experiencia_Inicial.md](docs/BRAMUlab/Experiencia_Inicial.md) |
| **BRAMU Intelligence** | [BRAMU_Intelligence.md](docs/BRAMUlab/BRAMU_Intelligence.md) |
| **Identidad visual** | [Identidad_Visual.md](docs/BRAMUlab/Identidad_Visual.md) (los archivos de marca que usa la app: [Marca/](docs/BRAMUlab/Marca/)) |
| **Backend e infraestructura** | [Backend_Infraestructura.md](docs/BRAMUlab/Backend_Infraestructura.md) · operación: [Runbook](docs/BRAMUlab/Runbook_Operacion_y_Salida.md) · Production y deploy: [Operacion_Vercel_Staging_Production.md](docs/BRAMUlab/Operacion_Vercel_Staging_Production.md) |
| **Privacidad y legal** | [Privacidad_Legal.md](docs/BRAMUlab/Privacidad_Legal.md) |
| **Emails** | [Comunicaciones_Emails.md](docs/BRAMUlab/Comunicaciones_Emails.md) |
| **BRAMU Metrics** (en desarrollo, protegido) | [BRAMU_Metrics.md](docs/BRAMUlab/BRAMU_Metrics.md) |
| **BRAMUlive** | [BRAMUlive.md](docs/BRAMUlive/BRAMUlive.md) |
| **Método de trabajo** | [Metodo_Trabajo.md](docs/BRAMUlab/Metodo_Trabajo.md) (incluye las reglas para no volver a acumular documentos) |
| **Ideas futuras y riesgos conocidos** | [BRAMUlab_Backlog.md](docs/BRAMUlab/BRAMUlab_Backlog.md) |

## Qué hay en cada carpeta del repositorio

| Carpeta | Qué es |
|---|---|
| `bramulab/` | La app BRAMUlab. En la raíz: los archivos de la app (`app.js`, `index.html`, `styles.css`, `sw.js`…). `tests/`: **pruebas automáticas** de esa lógica. `scripts/`: herramientas de compilación y publicación. `assets/`, `icons/`, `icons-staging/`: recursos estáticos. `api/`, `terminos/`, `privacidad/`, `eliminar-cuenta/`, `admin/`: endpoints y páginas públicas. (Las 2 pruebas de Metrics siguen en la raíz hasta que termine su desarrollo.) |
| `bramulive/` | La app BRAMUlive (separada). |
| `supabase/` | El servidor: `migrations/` (cambios de la base de datos, en orden), `functions/` (procesos del servidor), `tests/` (verificaciones contra Staging) y `scripts/` (backup, ensayo de salida, `release-check`). |
| `docs/BRAMUlab/` | Documentación. Raíz = documentos maestros. `Implementacion/` = **evidencia** técnica conservada (cierres, seguridad, ensayos). `Versiones/` = **historia** por versión. `Auditorias/` = estudio de convergencia Nivel/Ranking con sus simulaciones. `Referencias/` = material de contexto. `Marca/` = SVG maestros de la marca que usa la app. |
| `docs/BRAMUlive/` | Documentación de BRAMUlive. |
| `docs/check-docs.mjs` | Chequeo de orden documental. |

**Archivos generados (no son fuente, no se versionan):** `bramulab/dist/` es lo que Vercel publica; lo arma `bramulab/scripts/build-dist.mjs` a partir de los archivos de la app, copiando solo lo que el navegador necesita (sin pruebas ni scripts). Lo ejecuta Vercel en cada deploy; en Dropbox no hace falta tenerlo y por eso no se guarda (las pruebas lo construyen en una carpeta temporal). `bramulab/env.generated.js` y `bramulab/robots.generated.txt` los escribe `build-env.mjs`. `supabase/scripts/node_modules/` se regenera con `npm ci`.

## Comandos útiles (los usan los agentes, no hace falta ejecutarlos a mano)

```bash
cd supabase/scripts && npm ci            # una vez por copia nueva (dependencias de pruebas y release-check)
node --test bramulab/tests/*.test.mjs bramulab/metrics-*.test.mjs supabase/functions/_shared/*.test.mjs supabase/scripts/*.test.mjs
node docs/check-docs.mjs                 # orden documental
node supabase/scripts/release-check.mjs  # chequeo previo a un deploy
```

## Cómo interpretar la documentación

- Lo que ya no sirve se **retira**; la historia queda en Git (`git log --diff-filter=D --name-only -- docs/`). No hay carpetas `Archivo/` ni `Backup/`. Las rutas de pruebas citadas en comentarios antiguos del código (`bramulab/<nombre>.test.mjs`) hoy están en `bramulab/tests/`.
- `Temporales/` no se versiona; no dejar allí documentación única.
- El repositorio es público en este estado; no agregar originales privados, secretos ni documentación sensible.
- Los originales de diseño (Illustrator, referencias) y el material privado viven en Dropbox, en `/Otros Trabajos/BRAMU/` (mapa en su `LEEME.md`). No reemplazarlos ni eliminarlos.
- La versión publicada en Production o Staging se verifica en los despliegues, no por el nombre de una carpeta.

Mantenimiento y reorganización: [Issue #31](https://github.com/sebastianvilaa/BRAMUlab/issues/31).
