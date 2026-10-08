# BRAMU — índice general

BRAMU son dos productos independientes: **BRAMUlab** (app de jugadores: partidos ya jugados, Nivel, Ranking, Grupos, Intelligence) y **BRAMUlive** (marcador en vivo). No mezclar sus funciones ni sus entregas. Estado actual y reglas: [docs/BRAMUlab/README.md](docs/BRAMUlab/README.md).

## Documentos maestros — la definición vigente de cada tema

Un solo documento por tema. Si dos documentos se contradicen, manda el maestro. Todos están en [`docs/BRAMUlab/`](docs/BRAMUlab/README.md), agrupados por función:

| Tema | Documento maestro |
|---|---|
| **Nivel BRAMU** | [Producto/Nivel_BRAMU.md](docs/BRAMUlab/Producto/Nivel_BRAMU.md) |
| **Ranking BRAMU** | [Producto/Ranking_BRAMU.md](docs/BRAMUlab/Producto/Ranking_BRAMU.md) |
| **Grupos** | [Producto/Grupos_BRAMU.md](docs/BRAMUlab/Producto/Grupos_BRAMU.md) |
| **Partidos e historial** | [Producto/Cargar_Partido.md](docs/BRAMUlab/Producto/Cargar_Partido.md) (cargar un partido) · [Producto/Experiencia_Inicial.md](docs/BRAMUlab/Producto/Experiencia_Inicial.md) (validar, corregir, pendientes, historial) |
| **Experiencia inicial** | [Producto/Experiencia_Inicial.md](docs/BRAMUlab/Producto/Experiencia_Inicial.md) |
| **BRAMU Intelligence** | [Producto/BRAMU_Intelligence.md](docs/BRAMUlab/Producto/BRAMU_Intelligence.md) |
| **Emails** | [Producto/Comunicaciones_Emails.md](docs/BRAMUlab/Producto/Comunicaciones_Emails.md) |
| **BRAMU Metrics** (en desarrollo, protegido) | [Metrics/README.md](docs/BRAMUlab/Metrics/README.md) → [BRAMU_Metrics.md](docs/BRAMUlab/Metrics/BRAMU_Metrics.md) |
| **Identidad visual** | [Identidad_Visual/Identidad_Visual.md](docs/BRAMUlab/Identidad_Visual/Identidad_Visual.md) (archivos de marca que usa la app: [Marca/](docs/BRAMUlab/Identidad_Visual/Marca/)) |
| **Backend e infraestructura** | [Operacion/Backend_Infraestructura.md](docs/BRAMUlab/Operacion/Backend_Infraestructura.md) |
| **Operación, deploy y Production** | [Operacion/Runbook_Operacion_y_Salida.md](docs/BRAMUlab/Operacion/Runbook_Operacion_y_Salida.md) · [Operacion/Operacion_Vercel_Staging_Production.md](docs/BRAMUlab/Operacion/Operacion_Vercel_Staging_Production.md) · [Operacion/Pre_Production.md](docs/BRAMUlab/Operacion/Pre_Production.md) (salida a Production y pendientes) |
| **Privacidad y legal** | [Operacion/Privacidad_Legal.md](docs/BRAMUlab/Operacion/Privacidad_Legal.md) |
| **BRAMUlive** | [BRAMUlive.md](docs/BRAMUlive/BRAMUlive.md) |
| **Método de trabajo** | [Metodo_Trabajo.md](docs/BRAMUlab/Metodo_Trabajo.md) (incluye las reglas para no volver a acumular documentos) |
| **Ideas futuras y riesgos conocidos** | [Producto/BRAMUlab_Backlog.md](docs/BRAMUlab/Producto/BRAMUlab_Backlog.md) |
| **Historia** (qué fue cada etapa) | [Versiones/README.md](docs/BRAMUlab/Versiones/README.md) |

## Qué hay en cada carpeta del repositorio

| Carpeta | Qué es |
|---|---|
| `bramulab/` | La app BRAMUlab. En la raíz: los archivos de la app (`app.js`, `index.html`, `styles.css`, `sw.js`…). `tests/`: **pruebas automáticas** de esa lógica. `scripts/`: herramientas de compilación y publicación. `assets/`, `icons/`, `icons-staging/`: recursos estáticos. `api/`, `terminos/`, `privacidad/`, `eliminar-cuenta/`, `admin/`: endpoints y páginas públicas. (Las 2 pruebas de Metrics siguen en la raíz hasta que termine su desarrollo.) |
| `bramulive/` | La app BRAMUlive (separada). |
| `supabase/` | El servidor: `migrations/` (cambios de la base de datos, en orden), `functions/` (procesos del servidor), `tests/` (verificaciones contra Staging) y `scripts/` (backup, ensayo de salida, `release-check`). |
| `docs/BRAMUlab/` | Documentación, por función: **`Producto/`** (qué hace la app), **`Metrics/`**, **`Operacion/`** (backend, deploy, legal), **`Identidad_Visual/`** (+ `Marca/`), **`Implementacion/`** (evidencia técnica conservada), **`Versiones/`** (historia), `Auditorias/` (estudio Nivel/Ranking con sus simulaciones, que importan el motor y por eso no se mueven). |
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

- Lo que ya no sirve se **retira**; la historia queda en Git (`git log --diff-filter=D --name-only -- docs/`). No hay carpetas `Archivo/` ni `Backup/`. Las rutas de pruebas citadas en comentarios antiguos del código (`bramulab/<nombre>.test.mjs`) hoy están en `bramulab/tests/`. Los comentarios que citan `docs/BRAMUlab/<Documento>.md` se refieren al mismo documento dentro de su carpeta (`Producto/`, `Operacion/`, `Metrics/`, `Identidad_Visual/`).
- `Temporales/` no se versiona; no dejar allí documentación única.
- El repositorio es público en este estado; no agregar originales privados, secretos ni documentación sensible.
- Los originales de diseño (Illustrator, referencias) y el material privado viven en Dropbox, en `/Otros Trabajos/BRAMU/` (mapa en su `LEEME.md`). No reemplazarlos ni eliminarlos.
- La versión publicada en Production o Staging se verifica en los despliegues, no por el nombre de una carpeta.

Mantenimiento y reorganización: [Issue #31](https://github.com/sebastianvilaa/BRAMUlab/issues/31).
