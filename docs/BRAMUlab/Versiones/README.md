# Historia de BRAMU — mapa consolidado

**Esto es un mapa, no una fuente de verdad.** Dice qué fue cada etapa y dónde leer su detalle. Cómo funciona cada sistema **hoy** lo dicen las fuentes maestras (`../README.md` §2). Los detalles de cada ronda están en los Informes de esta carpeta y, lo retirado, en Git (`git log --diff-filter=D --name-only -- docs/`).

## Línea de tiempo

| Cuándo | Etapa | Qué fue | Dónde leer el detalle |
|---|---|---|---|
| ago 2026 (24–31/08) | **Marcador original** (V4 → V14) | La app nace como marcador de pádel («Padel Lab» / «BRAMU Lab»): puntos, games, sets, estadísticas e Intelligence narrativa. Es el origen de BRAMUlive. | `../../BRAMUlive/BRAMUlive_Consolidado.md` y `_Informe.md`; versiones V4–V9.2 en el zip de `Archivo histórico` (Dropbox) |
| fin ago – 03/09 | **BRAMUlab V01** | Primera app integral de jugador, todavía local: Home, Historial, Perfil, carga manual de partidos, Nivel simulado. Cierre en v2.2.1. | `BRAMUlab_V01/` |
| 03 – 10/09 | **BRAMUlab V02** | Rediseño visual integral (arena nocturna, acentos verde/azul, fondo unificado). Cierre en V02.9.3. | `BRAMUlab_V02/` |
| 07 – 14/09 | **BRAMUlab V03** | Identidad del jugador, Perfil público, búsqueda de jugadores, Mis grupos, Ranking semanal (prototipo), contacto por WhatsApp, geografía del Ranking. Cierre en V03.10 (tag `BRAMUlab_V03.10`). | `BRAMUlab_V03/` |
| 15 – 16/09 | **BRAMUlab V04.0 – V04.10** | Nivel BRAMU V1 local: cuestionario, calibración, medidor, onboarding. | `BRAMUlab_V04/` (V04.0–V04.10) |
| 16 – 23/09 | **Backend Bloques 1–8** | De app local a producto real: entornos, Auth/perfil, Nivel persistente, jugadores e invitados, partidos e historial compartidos, validación y Nivel oficial, Ranking semanal real, BRAMU Intelligence V1. | `BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`; cierres en `../Implementacion/Backend/` |
| 24/09 – 06/10 | **Pre-Production (V04.11 – V04.37)** | Estado Cero, Perfil editable, Ranking automático, eliminación de cuenta, Grupos server-backed, hardening (9A/9B), emails y acceso (G1/G2), Cargar partido pulido, Nivel V1.3, invitados/identidad/recuperados, Pendientes, Anular carga, identidad visual final, Actividad/Evolución/Race. | `BRAMUlab_V04/BRAMUlab_V04_Informe.md` («registro consolidado de rondas»); evidencia en `../Implementacion/Pre_Production/` |
| 06/10 | **Hardening de exposición / IP** | Motor de Nivel fuera del navegador, `dist/` con allowlist, supabase-js con SRI. | `../Implementacion/Pre_Production/138_…` y `139_…` |
| 07/10 | **Production abierta** | `app.bramulab.com`, Supabase Production, legal publicado; primeros usuarios reales. | `../Operacion/Operacion_Vercel_Staging_Production.md`, `../Operacion/Pre_Production.md` |
| 07 – 08/10 | **Primeros usuarios y BRAMU Metrics** | Hotfixes de scroll/PWA/íconos (h20–h27); consola de métricas F1–F3 en Staging (h28–h29, en desarrollo). | `BRAMUlab_V04_Informe.md`; Metrics en `../Metrics/` |

## Qué documento cubre qué

| Archivo | Contenido |
|---|---|
| `BRAMUlab_V0N/…_Consolidado.md` | Qué se **pidió/especificó** en cada ronda de la línea |
| `BRAMUlab_V0N/…_Informe.md` | Qué se **implementó**, probó y corrigió de verdad |
| `BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` | Informe de implementación del backend por bloque (es parte de la cadena de la fuente maestra de Backend) |

**Regla:** una versión nueva se agrega como sección de su Informe (no como archivo nuevo); una línea mayor nueva (V05) crea su carpeta. Las rutas a documentos retirados que aparecen dentro de estos Informes son históricas y se recuperan con Git.
