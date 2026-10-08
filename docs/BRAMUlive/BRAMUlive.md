# BRAMUlive — definición de producto (fuente maestra)

**Estado:** producto independiente, separado de BRAMUlab. Código en `bramulive/` (misma repo, otro proyecto de Vercel); historia de versiones V10–V14 en `BRAMUlive_Consolidado.md` y `BRAMUlive_Informe.md` (esta carpeta). Este documento fusiona la visión de producto del handoff de separación del 18/09/2026 (ya consumido; el original está en Dropbox, `Archivo histórico/BRAMUlive/`). Nada de lo marcado «futuro» está autorizado para implementar.

## Qué es
Herramienta para **registrar un partido de pádel mientras sucede** (puntos, games, sets) y conservar datos estructurados para consultar después: evolución del marcador, duración, correcciones, resumen final y estadísticas derivadas **solo** de lo capturado. Nació dentro de BRAMUlab como marcador/registro en vivo (versiones V4–V9.2, luego V10–V14) y se separó para evolucionar por su cuenta.

## Límite con BRAMUlab
- **BRAMUlab** = historia deportiva del jugador: cuenta, Perfil, Nivel, Ranking, Grupos, Intelligence y carga de partidos **propios ya jugados**.
- **BRAMUlab no incluye** marcador en vivo, seguimiento punto a punto o game a game, carga como espectador ni la categoría `Observados`. `+` en BRAMUlab lleva directo a «Cargar mi partido».
- **BRAMUlive no es** «una función eliminada de BRAMUlab»: es un producto hermano del mismo universo BRAMU.

## Público objetivo potencial (hipótesis, futuro)
Canales de TV, periodistas deportivos, relatores, productores, creadores de contenido y podcasts de pádel, analistas: personas que necesitan seguir un partido y reconstruir luego lo sucedido con precisión. La visión futura puede ser más profesional que la versión actual.

## Modelo comercial (hipótesis, NO implementar)
Acceso por cuenta/licencia profesional (no necesariamente un Perfil de jugador con Nivel/Ranking); prueba por cantidad de partidos en vez de por días; límites mensuales; plan de uso intensivo; eventual suscripción. No asumir que será gratuito ni integrado para todos los usuarios de BRAMUlab.

## Principios de independencia
1. BRAMUlab no vuelve a llenarse de complejidad por el marcador ni se contamina su roadmap con necesidades de BRAMUlive.
2. No perder nada del producto de marcador: debe poder retomarse sin reconstruirlo desde commits.
3. Sin arquitectura compleja anticipada para un negocio todavía no validado; la separación física futura (repo, proyecto, infraestructura) se decide con el estado real del código.
4. BRAMUlive puede tener cuenta/licencia, infraestructura e identidad visual propias; **no hay cuenta, base de datos ni backend compartidos por obligación**.
5. Integración con BRAMUlab (exportar/compartir/enviar un partido), si algún día existe, será **opcional y explícita**, entre productos, nunca una dependencia estructural.
6. Mantener trazabilidad de la última versión funcional heredada de BRAMUlab (V14 en `BRAMUlive_Consolidado.md`).

## Marca
Familia BRAMU: comparten ADN de logo, tipografía, lenguaje gráfico, iconografía, calidad visual y parte de la paleta; no deben sentirse una mega-suite. BRAMUlive puede diferenciarse con un recurso tipo punto rojo / indicador `LIVE` y un tratamiento más instrumental. La identidad visual vigente es la de `docs/BRAMUlab/Identidad_Visual/Identidad_Visual.md`; cualquier variante propia de BRAMUlive es decisión futura.

## Reglas operativas
No tocar `bramulive/` ni su configuración de Vercel en rondas de BRAMUlab sin autorización explícita (ver `docs/BRAMUlab/Metodo_Trabajo.md`).
