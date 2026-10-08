# Pre-Production — índice documental

> Este directorio reúne evidencias de implementación, validaciones y handoffs históricos. **No es una fuente maestra de estado** ni una lista de tareas pendientes.

## Consultar primero

1. [Mapa documental y estado vigente](../../README.md)
2. [Estado general de Pre-Production](../../Pre_Production.md)
3. [Método de trabajo](../../Metodo_Trabajo.md)
4. La fuente maestra del sistema afectado (Nivel, Ranking, Grupos, Identidad, Backend, etc.), indicada en el README principal.

## Cómo leer los documentos de esta carpeta

- **Handoff / plan:** instrucciones de una ronda determinada. Puede estar consumido aunque siga aquí.
- **Resultado / cierre / gate:** evidencia de una ejecución pasada. Su fecha y versión delimitan lo que prueba.
- **Manifiestos de release:** artefactos de una comprobación específica, no autoridad sobre el estado actual.
- **La presencia de un archivo no significa que haya trabajo pendiente.** Contrastar siempre con las fuentes vigentes.

## Regla de mantenimiento

- Conservar las evidencias todavía necesarias para operación, seguridad, migraciones o trazabilidad puntual.
- Al cerrar cada ronda, actualizar la fuente maestra y las referencias operativas antes de retirar handoffs consumidos.
- No borrar ni mover un documento que todavía lea un test o que esté citado por una fuente vigente sin adaptar esa dependencia.
- No duplicar toda la historia en nuevos archivos de backup: Git conserva las versiones anteriores, siempre que la trazabilidad haya sido comprobada.
- No reorganizar documentos de BRAMU Metrics mientras esté en desarrollo.

**Nota:** este índice reemplaza una lista de «vigentes» que había quedado desactualizada y presentaba tareas ya cerradas como pendientes. No se eliminaron informes ni handoffs en este cambio.
