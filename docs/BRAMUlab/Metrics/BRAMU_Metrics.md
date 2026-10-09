# BRAMU Metrics V1 — definición inicial de producto y ejecución

**Fecha:** 08/10/2026  
**Estado:** propuesta funcional confirmada para iniciar diseño/implementación en Staging; **NO autoriza Production**.  
**Producto:** consola privada de análisis de BRAMUlab; BRAMUlive fuera de alcance.



## 09/10/2026 — Corrección de aperturas no registradas (Staging `04.38-h6`)

**Diagnóstico a partir de uso real:** el jugador que aceptó `legal_v2` a las 04:19 hora argentina confirmó haber entrado y navegado por Production, pero `player_activity_days` permanecía vacío. Los logs de Supabase Production muestran `POST /rest/v1/rpc/register_app_presence` desde navegador iPhone a `2026-10-09T07:19:16.752Z`, inmediatamente después del registro de aceptación legal, cuando la captura aún estaba desactivada. El servidor contestó HTTP 200 (respuesta JSON RPC, no equivale a éxito del registro); **cero filas** registradas. El código del cliente `bramulab/auth.js` anterior grababa `lastActivitySentAt` y `localStorage['bramu_activity_ts']` **antes de esperar la respuesta**, así que también bloqueaba reintentos 30 minutos tras errores `measurement_disabled`/conexión. Además, las visitas a Grupos/Perfil/Historial no son nuevas aperturas y no generan evento; solo arranque/reanudación y vuelta a primer plano.

**REEMPLAZAR en Staging:** `bramulab/auth.js` mueve el inicio del throttle de 30 minutos **después** de `data.ok===true`; la respuesta `ok:false` o error no deja marca local. Cambia clave local a `bramu_activity_success_ts_v2` para ignorar la marca de tiempo fallida de la versión anterior, sin borrar otras claves. **AGREGAR:** bump coherente de `index.html`, `store.js`, `sw.js` y `version.json` a `04.38-h6`. **NO TOCAR:** backend, esquema de Metrics, documentos legales, `main`, BRAMUlive y Production sin autorización adicional.

**Verificación técnica realizada:** prueba del archivo `auth.js` real ejecutado con cliente Supabase simulado: primer RPC `measurement_disabled` => ninguna marca local; segundo RPC exitoso => marca nueva; tercer intento inmediato => throttle; marca antigua ignorada. PASS. Pruebas SQL Staging del 09/10 verificaron guardias/anti-duplicados 5 min/retiro de consentimiento con ROLLBACK. Vercel Preview `dpl_HN3JVpjgZKdEGp6vFfuutmZQN5fB` READY y alias Staging redirigido; Production continúa `04.38-h5` deployment `dpl_AteeNe6fyRSD9pnJ3uYAp9wa26Wn`.

**Estado:** corregido solo en Staging. **PENDIENTE autorización explícita** para promover exactamente el hotfix `04.38-h6` a Production, sin otros cambios. Tras promover, las entradas siguientes (arranque o foreground) podrán registrarse para cuentas que aceptaron `legal_v2`, sin reaceptación y sin retroactividad. Monitorear resultado real sin fabricar entradas.

---

## 09/10/2026 04:24 AR — Captura básica de actividad ACTIVADA en Production

**Nueva autorización explícita del titular en el chat Central (posterior a publicar legal_v2):** «con respecto a si lo podemos encender, yo lo encendería ... hagámoslo». Se ejecutó **solo** `UPDATE app_config SET activity_capture_enabled=TRUE` en el proyecto Supabase **Production** `bgnnnfbdywefftvoqiss`, con precondiciones servidor `environment=production`, `legal_version='legal_v2'`, `activity_consent_version='activity_v1'`, interruptor previamente `FALSE` y al menos una aceptación legal_v2 real. Resultado: exactamente una fila actualizada, valor `TRUE` verificado. No se cambió el frontend ni se hizo deploy. Continúa bundle `04.38-h5` en deployment `dpl_AteeNe6fyRSD9pnJ3uYAp9wa26Wn`.

**Estado verificado tras el cambio:** 7 cuentas registradas, 1 aceptación legal_v2 con autorización `activity_v1` granted, 0 filas de actividad al momento de la consulta (nueva captura solo al abrir la app). Solo quedan habilitados quienes aceptaron efectivamente `legal_v2`; los seis restantes todavía NO se miden hasta reaceptar. Server `register_app_presence` exige sesión registrada, versión, autorización `granted` y switch; guarda una fila por jugador/día; incremento de aperturas solo fuera de intervalos de cinco minutos. No hay históricos retrospectivos; la privacidad y revocación siguen vigentes. Mantener métricas `not_instrumented` cuando no hay fuente o evidencia; no inventar estadísticas.

**SITUACIÓN LEGAL NO RESUELTA:** la ampliación del expediente AAIP describe medición opcional y `legal_v2` contiene medición dentro de casilla obligatoria, retirándose desde Configuración posteriormente. El consentimiento efectivamente prestado es verificable, pero **su carácter libre para una medición identificable no esencial no está validado** (Ley 25.326, arts. 5 y 6). La activación es una decisión consciente del responsable bajo ese riesgo, no equivale a aprobación de AAIP. Corresponde consultar/aclarar en el expediente en curso que el procedimiento vigente integra información y consentimiento en el alta/reaceptación legal; no inventar aprobación ni afirmar que la captura es «opt-in separada». **Si la AAIP exige cambiar o detener el tratamiento, usar el interruptor reversible `activity_capture_enabled=FALSE` inmediatamente y ajustar el procedimiento/documentación según resolución; no borrar BRAMUlab o las cuentas sin exigencia legal concreta.**

**NO TOCAR:** `main`, BRAMUlive, cuenta/perfiles/partidos, y TAD sin instrucción específica; no compartir información personal en una corrección administrativa. El aviso a AAIP aún no está presentado para este cambio.

---

## 09/10/2026 — Publicación legal_v2 en Production COMPLETADA

**AUTORIZACIÓN EXPLÍCITA del responsable en el chat Central:** «ok publica» para publicar exclusivamente los documentos legales/aceptación que vio en Staging (un único checkbox para nuevas altas; una reaceptación breve a los siete existentes) y mantener captura de aperturas OFF.

**VERIFICADO EN PRODUCTION:** frontend `04.38-h5`, origen exacto Git SHA `c6c72f0d32dc4c5180d82411d51bbed68d4caf73`, deployment Vercel production `dpl_AteeNe6fyRSD9pnJ3uYAp9wa26Wn` READY, dominios `app.bramulab.com`, `bramulab.vercel.app`, `bramulab-bramu-lab.vercel.app` asignados. Staging conserva su alias de Preview `dpl_7RjDGwKCZrjXz9EP23EozZuJTMub`. No se tocó `main` ni BRAMUlive.

**Backend Production:** se aplicaron, ordenadas, las migraciones `20261009030000`, `20261009031000`, `20261009032000`, `20261009033000`. Config verificada `environment=production`, `legal_version=legal_v2`, `activity_consent_version=activity_v1`, **`activity_capture_enabled=FALSE`** (separado de consentimiento). Las funciones `accept_legal_version` / `handle_email_confirmed` registran `legal_v2` y evidencia `activity_v1` cuando el jugador efectivamente acepta, incluso con captura apagada. El servidor no registra aperturas con FALSE. Comprobación postdespliegue: siete jugadores registrados, 7 aceptaciones `legal_v1` preservadas, 0 aceptaciones `legal_v2` todavía (usuarios aún no ingresaron), 0 consentimientos de actividad, 0 filas de presencia. Los números son la instantánea del momento, no hardcodear.

**QA:** código JS parseado, guardias SQL y pruebas transaccionales Staging PASS (aceptación, bloqueos y retirada); QA visual en Staging corroborado por capturas del responsable. No se completó recorrido nuevo signUp con OTP y reaceptación autenticada en Production; no inventar resultado de esa prueba.

**PENDIENTE LEGAL, no autoriza activación:** la ampliación AAIP presentada describe medición OPCIONAL. Las nuevas condiciones visuales de `legal_v2` la incluyen en un checkbox legal obligatorio. Una aceptación documentada **no resuelve por sí sola** la condición de consentimiento libre para analítica identificable no esencial (Ley 25.326 art. 5), ni su coherencia con el registro en trámite. Si AAIP observa o rechaza ese aspecto, corregir su contenido y la base jurídica; en su caso podría requerirse una nueva versión legal / aceptación. Hasta resolver, dejar `activity_capture_enabled=FALSE` en Production. Ante órdenes formales seguir sus exigencias, sin asumir que una observación aislada exige dar de baja la aplicación.

**REGRA OPERATIVA:** no alterar Production, switch ni expediente sin nueva autorización expresa; monitorizar futuras decisiones AAIP cuando llegue respuesta.

---

## 09/10/2026 — Publicar aceptación legal sin capturar aperturas (bloque técnico resuelto en Staging)

**Necesidad de producto:** evitar que las altas futuras se acumulen en la cohorte de usuarios que deberán volver a aceptar documentos. Publicar `legal_v2` (un único checkbox en el alta, un único gate para `legal_v1`) es **independiente** de habilitar el registro de aperturas. No inventar consentimientos previos. **La aceptación se registra desde la acción real del jugador, aun si la medición está apagada; esto no certifica por sí mismo su suficiencia jurídica.**

**AGREGAR:** migración `20261009033000_metrics_capture_enable_separate.sql` crea `app_config.activity_capture_enabled BOOLEAN NOT NULL DEFAULT FALSE`. `register_app_presence` solo persiste aperturas si `activity_consent_version` está vigente **Y** `activity_capture_enabled=TRUE` **Y** la decisión actual del jugador es `granted`. Las tres condiciones se comprueban en servidor. Con FALSE no escribe, aunque exista aceptación de `legal_v2`.

**FUSIONAR:** `20261009032000_legal_v2_acceptance_before_capture.sql` conserva evidencia `activity_v1` al aceptar realmente `legal_v2` en alta o reaceptación, incluso si `activity_consent_version=NULL`; nunca la inventa para `legal_v1` ni sobreescribe un rechazo previo. **Configuración sugerida para salida parcial:** `legal_version='legal_v2'`, `activity_consent_version='activity_v1'`, `activity_capture_enabled=FALSE`. Así el jugador puede gestionar/revocar la autorización desde Configuración, aunque todavía no se recolecte actividad.

**REEMPLAZAR (cuando corresponda autorizar medición):** habilitar `activity_capture_enabled=TRUE`, **sin cambiar la versión legal**, solo después de confirmar fundamento jurídico y compatibilidad con la ampliación AAIP, que describió consentimiento opcional. Esa promoción a Production requiere **autorización explícita** y QA del flujo; nunca habilitar simultáneamente por accidente durante una promoción parcial.

**NO TOCAR:** Production `legal_v1` / `activity_consent_version=NULL`, las cuentas reales, `main` y BRAMUlive. Todavía no hay autorización para publicar `legal_v2` ni capturar aperturas en Production.

**Verificación Staging:** ambas migraciones aplicadas exitosamente; configuración `legal_v2`, `activity_v1`, `activity_capture_enabled=FALSE`. Prueba SQL transaccional con jugador sintético de Staging (ROLLBACK): la reaceptación insertó `legal_acceptances` y `activity_consents`, `register_app_presence` devolvió `measurement_disabled`, retirada desde Configuración registró `declined`, cero filas nuevas de aperturas. El flujo real de alta con OTP requiere QA específico antes de Production.

---

## Decisión UX prioritaria — 09/10/2026 (prevalece sobre el consentimiento opcional anterior)

**Decisión UX actualizada por Sebastián (09/10/2026 03:21 AR, sustituye la anterior):** UNA única casilla obligatoria en el alta para aceptar Términos, Política, transferencias internacionales y la información **expresa, visible y destacada** relativa a la medición básica. No presentar otra casilla ni la pantalla «Ayudanos a mejorar». Para los 7 usuarios existentes, Sebastián autoriza UNA sola reaceptación de documentos actualizados («Actualizamos nuestros Términos y Política de Privacidad» + checkbox único + «ACEPTAR Y CONTINUAR»). La aceptación nueva se registra con la versión y fecha reales; no atribuir consentimiento anterior ni reconstruir aperturas previas. La medición solo puede comenzar después de la aceptación efectiva y si existe base jurídica suficiente para el tipo de dato tratado.

**Condición legal de ejecución, no una decisión UX pendiente:** no se puede inferir autorización para nuevo tratamiento identificable a partir de la aceptación histórica de `legal_v1`, ni fingir que una aceptación conjunta resuelve por sí sola el requisito de consentimiento libre, expreso e informado del art. 5 Ley 25.326. El propio art. 5 exige que un consentimiento prestado junto con otras declaraciones figure **expresa y destacadamente**. La excepción para datos necesarios a un contrato (art. 5.2.d) no se presume aplicable a métricas de crecimiento. Desarrollar primero una medición agregada **efectivamente anónima** que no persista ni permita reconstruir identidad por persona; separar de ella los KPI de usuarios únicos/retención, que requieren una base legal concreta y no pueden falsificarse mediante simples conteos. Si no existe fundamento suficiente para algún KPI, declararlo no medible, no registrar silenciosamente identidad.

**Experiencia objetivo:** un solo checkbox visible (sin marcar de antemano) con enlace a la Política actualizada, y dentro del texto una referencia **expresa y destacada** al tratamiento de datos vigente que corresponda. No pedir aceptaciones genéricas «para cualquier publicidad futura». Publicidad contextual futura no está descartada, pero nuevos tratamientos (por ejemplo, perfilado/anuncios dirigidos) tendrán evaluación y transparencia específicas; la documentación actual debe describir el presente, sin promesas de prohibición perpetua.

**NO TOCAR:** Production, `main`, BRAMUlive, la inscripción original ni el complemento AAIP ya presentado. La captura identificable opcional actual sigue **apagada** (`activity_consent_version=NULL` en Production). **REEMPLAZAR en Staging, previa revisión técnica/jurídica concreta:** segunda casilla del alta y pantalla opt-in como mecanismos centrales; suprimir/reutilizar sin romper los controles vigentes de datos ni adjudicar consentimiento a los usuarios existentes. **AGREGAR:** conteos anónimos mínimos con controles antiabuso y definiciones honestas de «aperturas» vs. «personas»; **FUSIONAR:** el texto informativo del tratamiento vigente en la única aceptación de registro, destacándolo.

**Estado (09/10/2026): IMPLEMENTACIÓN TÉCNICA EN STAGING, NO PROMOVIDA A PRODUCTION.** Bundle `04.38-h5`, Vercel Staging alias `bramulab-git-staging-bramu-lab.vercel.app` apuntando a deployment `dpl_7RjDGwKCZrjXz9EP23EozZuJTMub` READY. Una sola casilla breve y explícita en alta (HTML) y una sola reaceptación de `legal_v2` (gate); oculto el opt-in secundario; sin modal de petición inicial. Textos legales `terminos/` y `privacidad/` `legal_v2`, registro de consentimiento acoplado en servidor con migraciones `20261009030000` y `20261009031000`, aplicadas en Staging; `app_config.legal_version=legal_v2`, `activity_consent_version=activity_v1` SOLO en Staging. JavaScript analizado sintácticamente (4 archivos PASS), base de datos confirmó ambos contratos, despliegue Vercel READY. **Sin QA integral de flujo real con nueva cuenta y reaceptación** (pendiente de un navegador autenticado). **Production sigue en legal_v1, activity_consent_version NULL: no registra aperturas.** No autorizar Production hasta resolver problema jurídico: si el consentimiento de métricas **no esenciales** puede calificarse libre cuando su aceptación queda incorporada a una casilla indispensable para usar BRAMUlab (Ley 25.326 art. 5), y compatibilidad con la ampliación AAIP presentada como «opcional». El cambio de UX sí está decidido. No se recrean datos previos ni se atribuye consentimiento a las siete cuentas de Production.

---


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
