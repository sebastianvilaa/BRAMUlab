# BRAMU Metrics V1 — auditoría inicial de medición y propuesta de pantalla

Fecha: 08/10/2026. Estado: AUDITORÍA DE LECTURA; no hay implementación ni aprobación de Production.
Autoridad de producto: `docs/BRAMUlab/Metrics/BRAMU_Metrics.md`. Leer antes `README.md`. Este documento precisa fuentes, pero no sustituye las fuentes maestras deportivas.

## Comprobado (esquema de Supabase Production consultado solo en lectura)
- `auth.users` cuenta registros e inicios de sesión, pero `last_sign_in_at` **no** demuestra uso diario; también hay que revisar eliminación y confirmación.
- `players` contiene tipo, vínculo de auth, flags activo/borrado y recuperación: **no** contar provisionales como cuentas.
- `profiles` + `locations` contienen localidad declarada, provincia y campos deportivos. Ubicación vacía ≠ otra localidad; campos del perfil no constituyen geolocalización automática.
- `pilot_events` tiene `event_name`, `player_id`, `properties`, `created_at`. En la primera foto de Production solo figuraron `signup_completed` y `level_confirmed`, no vistas ni sesiones de uso.
- `matches`: `match_id`, autor, `created_at` (carga), `played_at` (fecha jugada), `status`, `validated_at`, `annulled_at`; `match_participants` relaciona participantes; `match_actions` registra acciones, y `match_submissions` intentos/resultados de carga.
- `level_states`: estado, confianza, cantidad de partidos de Nivel y rivales; NO tratar `rated_matches` como total histórico absoluto de partidos registrados.
- `ranking_editions` + `ranking_rows`: publicaciones y elegibilidad/puestos históricos. La ausencia de edición real no es un Ranking simulado.
- `groups` + `group_memberships`: grupos y membresías, con bajas históricas (`left_at`).

## Semáforo de medibilidad V1

### A. Directas/derivables hoy, sujetas a condiciones deportivas vigentes
1. **Usuarios**: cuentas actuales con registro confirmado, altas por día/semana/mes, nuevos vs acumulados, jugadores con cuenta y jugadores provisionales, perfil con localidad, por localidad/provincia, perfiles sin localidad.
2. **Onboarding**: altas y confirmaciones iniciales como eventos persistidos; porcentaje que completó cuestionario entre cohortes elegibles; distinguir evento de estado definitivo.
3. **Partidos**: cargas únicas por `matches.match_id`, serie de `created_at`, fechas reales de juego (`played_at`), distribución por estado, validados y anulados, autores únicos por período, jugadores participantes con cuenta, validaciones por período, demora de validación solo cuando timestamps sean comparables.
4. **Grupos**: grupos activos y creados por período, miembros actuales e históricos, distribución de tamaño, grupos con partidos según relaciones oficiales confirmadas.
5. **Nivel / Ranking**: estados de calibración, distribución de niveles públicos sobre población definida, participantes elegibles en ediciones publicadas, cobertura de localidad/rama y variaciones comparables entre ediciones; abstenerse de afirmaciones con muestras exiguas.

### B. Necesitan instrumentación o estudio específico
1. **DAU/WAU/MAU reales**: registrar uso auténtico de un usuario autenticado (no refresco silencioso de sesión); fecha exacta de inicio del tracking.
2. **Retención D1/D7/D30**: cohortes completas, al menos una acción/visita auténtica en ventana definida; cohortes inmaduras se excluyen del denominador.
3. **Pantallas más vistas, abandonos de flujos, interacciones por función**: eventos deliberados con nombres estables, sin registrar datos deportivos privados en `properties`, sin coleccionar clicks indiscriminadamente.
4. **Instalaciones reales PWA**: no afirmar instalaciones a partir de clics en banner. Requiere señal verificable, potencialmente incompleta por plataforma.
5. **Errores y latencia de cliente**: requiere fuente consistente y política de datos; no usar alertas circunstanciales como métrica histórica.
6. **Atribución de origen de adquisición**: no inferir “de dónde vino” a partir de localidad, invitación o navegador sin medición explícita.

### C. No medir como si existieran
Tiempo en cancha, golpes, calorías, distancias o estadísticas técnicas de pádel que la app no registra; usuarios activos antes de instrumentar; cualquier clasificación basada en algoritmos de Nivel simulados.

## Contratos propuestos para unificar el dashboard y ChatGPT
- Fechas y ventanas: Buenos Aires, ventana semiabierta [desde, hasta), series completas, mostrar fecha de corte/actualización.
- Mostrar en cada KPI etiqueta, definición, denominador/población, fecha de captura y disponibilidad (válida, sin evidencia, no instrumentada, muestra insuficiente).
- Registrar `primer_partido_cargado` como derivado de `matches.created_by_player_id`, y `primer_partido_jugado` como derivado de participantes de un partido computable; no equivalentes.
- Activación principal: altas → Nivel inicial completado → primer partido cargado **o** participado (series separadas) → 3 → 5 partidos → retorno a otra semana.
- Uso: presencia de actividad intencional al menos una vez en un día local, usuarios únicos para WAU y MAU (no sumar DAU). Definir eventos exactos con implementación y documentar desde cuándo.
- Partidos: separar creación, validación y fecha de juego; excluir anulados de métricas deportivas oficiales, sin borrar el hecho operativo de que hubo un intento/carga anulada. Respaldar definiciones con estados vigentes.
- Cumplir privacidad y minimización: mostrar números agregados por defecto y evitar identificar jugadores con cruces de cohortes diminutas.

## Wireframe funcional de primera versión (no diseño final)
**Inicio:** encabezado fecha/filtro (7d/30d/90d/histórico) + comparación con período anterior; 6 KPI ancla (registrados, nuevos, activos *solo instrumentados*, cargas, validados, grupos activos); series usuarios y partidos; embudo de activación y estado de recolección.
**Usuarios:** altas, ubicación, fichas completadas, DAU/WAU/MAU, cohortes/retención cuando exista señal real.
**Partidos:** cargados, validados, pendientes, anulados, autores y participantes únicos, tiempo de validación, dos ejes temporales (registrado vs jugado).
**Activación:** pasos del primer uso al 5.º partido, separación autor/participante, retorno.
**Comunidad:** grupos, Nivel, Ranking oficial, faltantes de elegibilidad, sin confundir sistemas.
**Uso:** catálogo de eventos, vistas/acciones instrumentadas y calidad de datos.

## Comprobaciones obligatorias antes de crear endpoints
- Identidad estable del único administrador, guardada server-side en una lista de autorizados; prueba negativa con cuenta real normal, anon y token inválido.
- RLS/grants en función privilegiada y tráfico HTTP: ningún cliente normal obtiene agregados globales.
- Concordancia Dashboard vs consultas de solo lectura sobre los mismos filtros y periodo.
- Zero rows ≠ ausencia de instrumentación; Staging nunca se presenta como Production.
- Entorno/caché no cruza Production y Staging; no se expone un `service_role` al navegador.
- Revisar reglas de anulaciones, duplicados, revisiones, recuperación y estado computable antes de cerrar SQL.

## Siguiente acción recomendada
Enviar este documento a Claude Code para auditoría técnica más profunda y esquema de implementación en rama `staging`; **fase de exploración y arquitectura primero**, sin desplegar ni modificar Production. Luego diseño visual del dashboard con Sebastián. Los límites de autorización ya están fijados en `BRAMU_Metrics.md`.
