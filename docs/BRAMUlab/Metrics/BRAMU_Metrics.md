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

## 10. Estado de ejecución y decisiones incorporadas (08/10/2026)
- F1 (presencia diaria), F2 (núcleo protegido + Edge `admin-metrics`) y F3 (consola Inicio/Usuarios/Partidos con detalle de KPI) están aplicados/desplegados en **Staging**; Production sin tocar. Verificación y pendientes: `Implementacion/Post_Lanzamiento/149_Resultado_Metrics_V1_F1_F2_08OCT.md` §7.
- Definiciones vigentes que concretan §3 y §5: activo = **presencia** (apertura real autenticada, 1 fila por jugador y día BA), nunca el último login; umbral de privacidad **k = 5** (n ≥ 10 calibrados para distribución de Nivel); comparación contra el período anterior por defecto y desactivable; cohortes de activación **maduras desde 7 días**; retención semanal W1/W4 como lectura principal (D1/D7/D30 secundarias).
- **D8 CONFIRMADA (Sebastián, 08/10/2026): comparaciones con días completos, hasta ayer.** Los períodos terminan a las 00:00 de hoy (BA) y el anterior mide lo mismo; la actividad de hoy se muestra aparte como «parcial» y no entra en comparaciones. Detalle en `BRAMU_Metrics_Comparaciones_V1.md`.
- **F4** (Activación, Comunidad —Grupos · Nivel · Ranking, separados—, Uso y retención): **implementada en el repo y probada localmente (08/10/2026)**; falta que Central aplique la migración `20261008120000` en Staging y verifique (`149_…` §8). Alcance y criterios en `148_…` §11. Distingue lo ya disponible (31 de 49 KPIs), lo derivable con SQL aditivo sin captura nueva y lo que exige empezar a recopilar (presencia en Production; pantallas/funciones). **La presencia aún no se captura en Production**: su promoción (D1, previa D3 de privacidad) es lo más urgente porque los días sin registro no se recuperan.


## 11. Siguiente bloque de producto — Explorar (F6, diseño de ejecución confirmado, 08/10/2026)

**Propósito:** además de las seis secciones preparadas, Sebastián quiere explorar por sí mismo cualquier métrica medida y entender su evolución. Debe sentirse como una herramienta visual de descubrimiento, **no** una interfaz SQL ni una planilla.

### Recorrido principal
1. Pestaña **Explorar** en la consola existente, con selector de indicador agrupado por Usuarios, Partidos, Activación, Comunidad y Uso. Partir del catálogo verificado (actualmente 55 KPI después de F4); no inventar consultas ni agregar métricas ficticias.
2. Controles de período **7 / 30 / 90 días / Histórico** y **comparación anterior activada por defecto**, coherentes con las otras pantallas. D8 vigente: días completos hasta ayer, hoy parcial separado.
3. Al elegir un indicador, mostrar **valor, unidad, definición, población y disponibilidad**; variación solamente donde tenga base válida. Permitir ver **gráfico temporal** si existen hechos históricos y serie implementada. Si no se puede construir serie auténtica, mostrar el KPI y explicar “Evolución temporal no disponible” (nunca una línea inventada).
4. **Filtros contextuales y progresivos**, solo sobre métricas para las que se haya validado la población y la semántica. Opciones candidatas: localidad (usuarios/partidos, si procede), estado del partido, rama competitiva y estado de Nivel. Un filtro no válido para una métrica no se ofrece. Al cambiar de métrica se limpian filtros incompatibles. **No prometer todos los cruces en V1.**
5. La selección de métrica, fecha y filtros debe ser simple también en celular; escritorio puede tener controles laterales. Reutilizar estética oscura deportiva y componentes F3/F4; el panel preparado nunca se modifica para acomodar el Explorador.

### Requisitos de datos y seguridad
- La API del Explorador utiliza **catálogo cerrado y consultas declaradas**; nunca recibe ni ejecuta SQL o nombres de tablas/columnas proporcionados arbitrariamente por el cliente.
- Misma autorización administrativa en cada solicitud que `admin-metrics` y mismos permisos cerrados de base; no exponer datos personales ni vistas por jugador.
- Aplicar la supresión **k = 5** y reglas de muestra mínima **en SQL** antes de entregar cada filtro/desglose, evitando inferencia por diferencias de totales, filtros cruzados o series con celdas pequeñas. Testear específicamente inferencia por sustracción, no solo ocultar una etiqueta.
- Definiciones idénticas a los paneles preparados: registrar/validar catálogo, numerador, denominador, fechas, exclusión de internas, período anterior y estados antes de exponer cualquier nuevo filtro.
- Priorizar pocos filtros realmente confiables frente a una colección amplia pero equívoca; no instrumentar eventos nuevos ni hacer backfill imaginario.

### Secuencia de ejecución
- Claude implementa **F6 solo en Staging**, apoyándose en la base F4 ya aprobada, con tests dirigidos de permisos, contrato, umbrales y UX responsive. Si un filtro es riesgoso o costoso de verificar, documentar **DECISIÓN ABIERTA** y dejarlo fuera de V1, avanzando con el Explorador y los demás indicadores.
- Central revisa migraciones adicionales, aplica exclusivamente en Supabase Staging y verifica los contratos, luego QA visual con Sebastián. **Ningún cambio en Production, main o BRAMUlive sin autorización específica.**
- Antes de considerar Production siguen pendientes las pruebas reales de sesión administrativa, denegación a usuarios comunes y política de privacidad del registro de presencia.

**Estado al 08/10:** F4 implementada y su migración aplicada y verificada por Central en Supabase Staging; Vercel h30 READY. **Explorador IMPLEMENTADO en el repo (`04.37-h31`, migración `20261008130000`): falta que Central la aplique, **redeploye `admin-metrics`** y verifique (`149_…` §10.4).** Indicadores: los 55 del catálogo; series solo donde hay hechos persistidos; filtros declarados (Localidad, Estado de Nivel, Plataforma, Estado del partido), uno por vez y con k = 5 en SQL. Quedan como **DECISIÓN ABIERTA** la rama competitiva (D9), las series de WAU/MAU y saldos (D10) y los cruces/rango personalizado (D11).

## 12. Salida a Production — preparada, NO ejecutada (08/10/2026)
- Objetivo: consulta privada de datos reales desde celular y computadora, **solo con la cuenta administradora de Production**. Sin funciones nuevas.
- **Acceso:** lista de UUID (`metrics_admins`) sin sembrar en las migraciones (Production arranca con 0 administradores = nadie); Edge con JWT; SQL solo `service_role`; 403 idéntico; la página no decide quién entra.
- **Alcance a Production:** 6 migraciones aditivas (F1, F2, F4, F6, eliminación de actividad con la cuenta, consentimiento) en orden, `admin-metrics` y el frontend; para los jugadores cambia solo la captura de presencia, 1 línea del Service Worker y la versión del bundle (verificado con `bramulab/scripts/promotion-surface.mjs`). **La captura de presencia no puede separarse de la consola** (mismo build) pero **solo corre con consentimiento**: empieza cuando Central enciende la medición y cada jugador acepta; nunca se reconstruyen días anteriores.
- **Privacidad y consentimiento (decisión de Sebastián, 08/10):** se actualiza la Política y se pide una **aceptación informada, opcional** del registro de actividad: usuarios existentes → una pantalla breve; nuevos → casilla opcional dentro del alta; **nada se mide antes del consentimiento ni de quien no consiente** (usa BRAMUlab igual); evidencia append-only (`activity_consents`); sin reconstrucción de aperturas previas; declinar/retirar y eliminar la cuenta **eliminan** la actividad. Implementado y probado **solo en Staging** (V04.38 / `04.38-h1`, migración `20261008150000`; **medición apagada** hasta que Central fije `app_config.activity_consent_version`). Diseño, textos y orden: `Operacion/Privacidad_Legal.md` §18. **Consecuencias para leer los datos:** DAU/WAU/MAU son **de quienes consintieron** (la consola muestra la cobertura, k=5), y la retención solo cuenta cohortes que consintieron desde el día de alta. La única administradora es **`@seba`**. **Pendientes explícitos:** verificación interna del diseño (`Privacidad_Legal.md` §18.6) y verificación de la constancia AAIP (§18.5).
- **Procedimiento, retiro por niveles y verificadores:** `Operacion/Runbook_Operacion_y_Salida.md` Parte D. Evidencia, riesgos y decisiones abiertas: `Implementacion/Post_Lanzamiento/149_…` §12.
- Requiere **autorización explícita de Sebastián con el SHA exacto** y las pruebas con sesión real de Staging (`metrics-access-check.mjs`).
