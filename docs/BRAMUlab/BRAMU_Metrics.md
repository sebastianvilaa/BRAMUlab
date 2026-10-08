# BRAMU Metrics V1 — definición inicial de producto y ejecución

**Fecha:** 08/10/2026  
**Estado:** propuesta funcional confirmada para iniciar diseño/implementación en Staging; **NO autoriza Production**.  
**Producto:** consola privada de análisis de BRAMUlab; BRAMUlive fuera de alcance.

## 1. Objetivo confirmado
Panel interno para el propietario de BRAMUlab, accesible con su cuenta habitual, sin exposición a jugadores comunes, que permita observar el crecimiento, uso y salud del producto sobre **datos reales de Production**, comparar períodos y extraer decisiones de producto. Este chat de Metrics es el centro de interpretación; el dashboard, la visualización habitual.

## 2. Decisiones cerradas
- Dirección funcional objetivo: `https://app.bramulab.com/admin/metrics`. No subdominio ni aplicación paralela.
- Priorizar reutilizar infraestructura existente (Vercel + Supabase) sin nuevos servicios pagos de analítica ni nueva base.
- Diseño responsive con identidad BRAMU, dirección guardable como marcador o acceso directo móvil. No requiere PWA independiente inicialmente.
- Acceso **exclusivo al administrador explícitamente autorizado**: autenticación de BRAMU + autorización comprobada en servidor en cada endpoint. Ruta oculta ≠ control de acceso. No confiar en username, correo modificable ni metadatos editables por usuario para conferir rol. Resolver identidad administrativa estable con el procedimiento seguro actual, sin almacenar credenciales ni secretos en repositorio.
- Los datos mostrados son de Production. Staging solo para construir y probar, con datos de Staging o mocks **claramente etiquetados para QA**, jamás presentados como Production.
- No instrumentar BRAMUlive ni incorporar marcador en vivo.
- Los indicadores deben ser auditables y derivados de hechos persistidos; evitar doble contabilización de partidos/usuarios provisionales o anulados. Distinguir fechas de carga frente a fechas de juego; validar definiciones según modelo vigente.
- Filtrar períodos (7d, 30d, 90d, histórico y comparación), respetando zona horaria de Buenos Aires cuando corresponda.
- No construir una portada tipo planilla: resumen ejecutivo + exploración por secciones.

## 3. Catálogo inicial (ampliable)
### Usuarios y adopción
Cuentas registradas, altas por período, jugadores con cuenta vs invitados provisionales, localidad/provincia declarada y datos faltantes, actividad DAU/WAU/MAU, retornos y cohortes de retención. **No equiparar último login con uso activo**.

### Activación
Secuencia por usuario registrado: alta completada → Nivel inicial confirmado → primer partido cargado/participado → tercer partido → quinto partido → retorno en otra semana. Mostrar diferencia entre autor de carga y participante. Evitar confundir partidos pendientes con oficiales.

### Partidos
Total creado, totales por estado, partidos validados, pendientes, anulados, tiempo de validación, cargas por día/semana, autores únicos, participantes únicos, días entre registro y primera carga, distribución por fechas jugadas. Definir precedencia ante revisiones/duplicados/recuperación.

### Grupos, Nivel, Ranking
Grupos vigentes, creación por período, membresías activas, actividad en grupos; estados de calibración, distribución de Nivel cuando exista dato real suficiente; elegibilidad y publicaciones efectivas de Ranking, sin presentar datos simulados como reales.

### Uso y calidad
Eventos de producto, páginas/funciones usadas y abandonos **solo si se instrumentan realmente**, latencia/errores agregados donde existan fuentes fiables, fricción de validación y recuperación de identidad. Evitar captura de contenido sensible innecesario.

## 4. Inventario preliminar de fuentes reales (verificar contratos antes de programar)
Consultas de solo lectura a esquema Production efectuadas en el chat Metrics el 08/10/2026 mostraron las tablas `auth.users`, `players`, `profiles`, `locations`, `matches`, `match_participants`, `match_submissions`, `groups`, `group_memberships`, `pilot_events`, `level_states`, `ranking_editions`, `ranking_rows`. La tabla `pilot_events` registraba solamente `signup_completed` y `level_confirmed` en esa inspección. Verificar alcance temporal y semántica de cada dato.

Foto puntual observada en Production (NO usar como fixture ni hardcodear): 6 cuentas, 6 perfiles, 0 partidos, 1 grupo activo y 12 eventos (6 altas y 6 confirmaciones iniciales), localidades 3 Bella Vista, 1 San Miguel, 2 sin localizar. Es una observación histórica y no una cifra del dashboard.

## 5. Definiciones y mediciones faltantes
- **Usuarios activos**: definir evento de actividad real, con usuario autenticado e intervalos; no derivarlo exclusivamente de `auth.users.last_sign_in_at`. Evitar que refrescos automáticos falsifiquen uso.
- Distinguir datos disponibles **ahora**, derivables por consultas y pendientes de **AGREGAR** evento mínimo de uso. No inventar históricos anteriores al comienzo del tracking.
- Se pueden ampliar eventos solo donde respondan una pregunta útil de producto y sin duplicar datos persistentes como carga/validación de partido.
- Si una métrica no dispone de fuente confiable, mostrar “Todavía no medible” con fecha de inicio de captura o abstenerse. No mostrar 0 cuando significa sin instrumentación.
- Retención D1/D7/D30 requiere definir cohorte, ventana y actividad.

## 6. Arquitectura y seguridad (criterio, no implementación prescriptiva)
- Ruta interna `/admin/metrics` dentro de la app; aislada de navegación común.
- Acceso agregado de Production solo a través de backend protegido con autorización administrativa server-side. **Nunca incluir clave service_role, consulta privilegiada, secretos ni datos agregados sensibles en JS público o endpoints accesibles por usuarios normales.**
- No ampliar permisos de lectura de `players`, `profiles`, `auth.users` ni otras tablas a todos los autenticados. Respetar RLS y revocar EXECUTE/PUBLIC en funciones privilegiadas; comprobar acceso denegado para anon y otro usuario.
- Proteger información individual: preferir agregados; si luego se requiere drill-down individual, justificar, limitar datos y auditar.
- Evitar consultas pesadas por cada render. Primero consultas agregadas eficientes / endpoints estrechos, y caching moderado si fuese necesario.
- Integrar consultas de ChatGPT central de solo lectura por conector Supabase existente, compartiendo **definiciones** con dashboard para evitar métricas contradictorias; no suponer que acceder a pantalla autenticada permite al chat usar su sesión.

## 7. Secuencia autorizada y límites
1. **AHORA — Definir y auditar:** fuentes/semántica, catálogo priorizado y wireframe funcional.
2. **AGREGAR en Staging:** lectura admin agregada y protección de autorización; instrumentación mínima de actividad real si hace falta. Probar no-administrador, anónimo y no exposición de datos; verificar conteos con SQL read-only.
3. **AGREGAR en Staging:** dashboard responsive (Inicio, Usuarios, Partidos, Activación, Grupos/Nivel/Ranking, Uso).
4. **NO TOCAR:** `main`, Vercel Production, Supabase Production (salvo lecturas autorizadas para análisis), BRAMUlive, fórmula de Nivel, lógica oficial deportiva, datos de usuarios.
5. Promoción posterior a Production **solo tras autorización explícita** y gates de permisos/regresión. La ruta Production no está publicada por este documento.

## 8. Próxima ejecución técnica
El agente ejecutor debe leer `docs/BRAMUlab/README.md`, `Metodo_Trabajo.md`, `Backend_Infraestructura.md` y esta definición. Debe contrastar el esquema y el pipeline de Staging, entregar plan de implementación por fases y avanzar autónomamente en aquello que no exige decisión humana, sin sobrearquitectura. Si alguna decisión afecta privacidad, identidad admin o integridad deportiva, registrar **DECISIÓN ABIERTA**, seguir con el resto y pedir únicamente la autorización necesaria.

## 9. Por definir en diseño, sin bloquear relevamiento
- Layout final, nomenclatura, gráficos y filtros de cada sección bajo el sistema visual vigente.
- El evento exacto y la periodicidad segura de actividad.
- Si se necesita análisis por jugador individual o solo agregados. V1 prioriza agregados.
