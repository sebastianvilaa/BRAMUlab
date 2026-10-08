# BRAMUlab — Método de trabajo

> Guía operativa vigente para coordinación de agentes, commits, pruebas y deploys. Corta y aplicable — no es una filosofía de proceso.

---

## Fuentes de verdad

- Empezar siempre por `docs/BRAMUlab/README.md`.
- Después leer solo la fuente maestra del sistema afectado (README §2/§7 indica cuál).
- Los documentos retirados del árbol (handoffs, resultados, gates y revisiones consumidos) viven en Git y **no son autoridad**; solo se recuperan ante pedido explícito de trazabilidad puntual (`git log --diff-filter=D --name-only -- docs/`). No existe `Archivo/` ni `Backup/` en el repositorio.

## Separación de roles

- **ChatGPT central**: coordinación, producto, revisión, arquitectura, documentación y control de coherencia.
- **Claude Code**: implementación, análisis profundo del repo, migraciones, debugging y tests técnicos.
- **Work**: navegador real, GUI, Vercel y QA visual/manual cuando sea necesaria.
- **Sebastián**: puente mínimo, no operador técnico — decide producto y revisa resultado, no ejecuta comandos ni pruebas que un agente pueda correr.

## Brainstorming / producto

El chat de **Brainstorming** es una superficie estable de trabajo de producto, complementaria al chat Central/Desarrollo. Su función es pensar sin convertir cada idea en una tarea técnica inmediata.

### Qué puede vivir en Brainstorming

Cada idea debe terminar clasificada, cuando sea posible, en uno de estos estados:

1. **EN PROCESO / DUDA ABIERTA** — todavía se está pensando; no autoriza implementación.
2. **CONFIRMADA** — la decisión de producto quedó cerrada y puede pasar a Desarrollo cuando corresponda.
3. **DESCARTADA** — se evaluó y se decidió no hacerla. Debe conservarse el motivo para no reabrirla meses después sin evidencia nueva.
4. **FUTURA / DIFERIDA** — la idea sigue siendo válida, pero no corresponde implementarla ahora. Debe quedar claro qué tendría que ocurrir para retomarla cuando sea posible.

Una idea nueva **no** se convierte automáticamente en desarrollo. Una fricción observada tampoco obliga por sí sola a crear una función nueva.

### Trazabilidad de decisiones de Brainstorming

Cuando una idea queda **CONFIRMADA**, **DESCARTADA** o **FUTURA / DIFERIDA**, conservar suficiente contexto para poder responder en el futuro:

- qué problema o posibilidad se discutió;
- qué decisión se tomó;
- por qué se tomó;
- cuándo se tomó, si la fecha aporta trazabilidad;
- qué evidencia nueva justificaría reabrirla, si corresponde.

Las ideas descartadas forman parte de la historia de producto. No eliminarlas simplemente porque no se implementen.

### Traspaso de Brainstorming a Desarrollo

Sebastián decide cuándo hacer el corte diciendo, por ejemplo, **“preparame el traspaso para Desarrollo”**.

En ese momento ChatGPT debe:

1. revisar el Brainstorming acumulado hasta ese corte;
2. contrastarlo con `README.md` y las fuentes maestras vigentes para no transferir ideas ya implementadas, superadas o contradictorias;
3. crear **un único documento de handoff en el repo** con las conclusiones maduras;
4. incluir decisiones **CONFIRMADAS**, ideas **DESCARTADAS** con su motivo y decisiones **FUTURAS / DIFERIDAS** que convenga preservar;
5. no presentar una **DUDA ABIERTA** como decisión ni como autorización de implementación; si sigue realmente abierta, permanece en Brainstorming salvo que sea contexto imprescindible, en cuyo caso debe etiquetarse explícitamente como `DECISIÓN ABIERTA`;
6. entregar a Sebastián un mensaje corto, listo para copiar al chat de Desarrollo, que apunte a ese documento en vez de duplicar todo su contenido;
7. a partir de ese punto, Desarrollo decide la secuencia técnica: qué entra antes de Production, qué durante la preparación de salida y qué queda para después, respetando las prioridades vigentes.

Después del traspaso, Brainstorming vuelve a quedar libre para ideas nuevas. El handoff y las fuentes maestras conservan la memoria de lo ya delegado.

### Límites

- No abrir frentes de implementación mientras un bloque dependiente sigue sin cerrar.
- No usar Brainstorming como segunda fuente maestra permanente: las decisiones que pasan a ejecución deben terminar consolidadas en la documentación vigente del sistema afectado.
- Al cerrar una etapa relevante, tomar primero una "foto real del producto" antes de rediseñar pantallas que dependan de ella.

## Tareas medianas / grandes

- Consolidar contexto primero en un documento del repo.
- Pasar al siguiente agente un handoff corto que apunte a ese documento.
- Ese agente lee el documento y avanza autónomamente.
- Si aparece una decisión humana real, marcar `DECISIÓN ABIERTA` y continuar todo lo no bloqueado por ella.
- No repetir investigaciones grandes ya realizadas.

## Entrega entre agentes

- Una ronda técnica **no se considera terminada** mientras el resultado no sea accesible remotamente para el siguiente agente.
- Salvo que el handoff diga explícitamente `NO PUSH`, Claude Code debe terminar con: pruebas pertinentes → diff revisado → commit lógico → push a `origin/staging` → informe/resultado guardado en el repo.
- Sebastián no debe transportar informes técnicos entre chats. Idealmente solo informa `terminó` y ChatGPT central lee directamente HEAD, diff y documentación desde el repo.
- Si por una limitación real no puede hacerse push, el agente debe dejarlo explícito como bloqueo operativo antes de dar la tarea por terminada.

## Prompt único para Claude Code

Cuando una tarea corresponda a Claude Code, ChatGPT central debe entregar a Sebastián **un único prompt listo para copiar**, sin obligarlo a reconstruir instrucciones ni combinar mensajes anteriores.

Ese prompt debe ser autosuficiente como orden de ejecución, pero **no duplicar documentación extensa** que ya exista en una fuente maestra o handoff vigente. Como mínimo debe incluir:

- objetivo concreto de la ronda;
- fuentes que Claude debe leer;
- alcance expresado, cuando aplique, como **AGREGAR / FUSIONAR / REEMPLAZAR / NO TOCAR**;
- pruebas necesarias según el riesgo real;
- versionado/bundle si la ronda se distribuye;
- reglas de Git, commit, push y deploy;
- salida breve esperada al terminar.

Si el detalle técnico ya está consolidado en un documento o Issue, el prompt debe apuntar a esa fuente en vez de copiarla completa.

Claude debe ejecutar autónomamente todo lo técnico posible. Si aparece una decisión humana real, debe marcarla como **DECISIÓN ABIERTA** y continuar con todo lo que no dependa de ella.

Sebastián no debe actuar como integrador entre agentes ni transportar informes técnicos extensos. Idealmente solo copia el prompt inicial, aporta una decisión humana cuando realmente hace falta y al final informa **“terminó”**. ChatGPT central revisa HEAD, diff, tests y documentación directamente antes de habilitar la siguiente etapa sensible.

## Flujo normal Staging → aprobación → Production

Esta regla es el **default permanente de BRAMUlab** una vez que existe Production.

### 1. Todo cambio nace en Staging

Cuando Sebastián pide cambiar, corregir, probar o explorar algo de BRAMUlab, se entiende por defecto que el trabajo se hace **en Staging**.

Esto aplica también si el problema fue detectado mirando Production: salvo incidente crítico que requiera un hotfix explícitamente autorizado, la corrección se reproduce, implementa y valida primero en Staging.

Production **no se modifica automáticamente** por el solo hecho de que un cambio haya quedado implementado o técnicamente correcto.

### 2. Toda revisión de Sebastián ocurre primero en Staging

Cuando Central pide a Sebastián que mire o pruebe un cambio:
- debe referirse explícitamente a **Staging**;
- debe darle el link directo vigente para evitar ambigüedad;
- debe indicarle qué mirar, de forma breve y focalizada;
- no debe pedirle que compare innecesariamente toda la app si el riesgo es local.

URL operativa actual de Staging:
`https://bramulab-git-staging-bramu-lab.vercel.app`

La URL puede cambiar en el futuro; si cambia, actualizar esta guía y usar siempre el enlace vigente.

### 3. Acumular feedback compatible antes de promover

Si Sebastián encuentra varias correcciones chicas o relacionadas durante la misma revisión:
- mantenerlas en Staging;
- resolverlas allí;
- agruparlas en una sola ronda visual cuando sea razonable;
- evitar promover cada microajuste individualmente a Production.

La intención es reducir deploys, smoke tests y pasadas redundantes.

### 4. Aprobación humana antes de Production

Cuando el bloque queda bien en Staging, Central debe cerrar la revisión con una pregunta simple, por ejemplo:

> “¿Lo pasamos a Production o querés revisar/cambiar algo más antes?”

También vale una autorización espontánea de Sebastián como:
- “pasalo a producción”;
- “sí, quedó bien, publicalo”;
- equivalente inequívoco.

Sin esa aprobación, el cambio **queda en Staging**.

### 5. Promotion controlada

Una vez aprobado:
- promover únicamente la versión/cambio validado;
- no arrastrar cambios no relacionados;
- mantener BRAMUlive fuera del alcance;
- no usar un fast-forward global de `main` mientras esa estrategia pueda arrastrar trabajo ajeno a BRAMUlab;
- verificar entorno/aliases antes de dar por terminado el deploy.

### 6. Smoke corto en Production

Después de promover:
- hacer un smoke **dirigido al riesgo del cambio**;
- usar la cuenta real de Production cuando corresponda;
- no repetir la suite completa ni revalidar áreas no relacionadas;
- si aparece una regresión, volver a Staging para corregirla salvo emergencia explícita.

La secuencia normal queda:

**definir → implementar en Staging → probar en Staging → aprobación de Sebastián → promover a Production → smoke corto.**

Production es el producto real. Staging es el taller.

## Git / commits

- Evitar commits intermedios directamente sobre `staging`.
- Explorar, corregir y probar antes del push cuando sea posible.
- Revisar el diff final antes de commitear.
- Consolidar cada intervención en el menor número razonable de commits — idealmente uno solo, lógico y autocontenido.
- Para una subfase funcional, apuntar a **un único push/deploy intencional**. Un segundo push solo se justifica por un bug real, una corrección necesaria o una evidencia nueva que obligue a cambiar el resultado.
- No crear commits ni pushes solo para "probar por las dudas".
- Cambios únicamente documentales no deben provocar deploys de `bramulab` ni `bramulive` (ver `bramulab/vercel.json`/`bramulive/vercel.json` — `ignoreCommand`). El comando vigente compara `HEAD^` contra `HEAD` dentro de cada Root Directory. **No usar `VERCEL_GIT_PREVIOUS_SHA`**: Vercel puede entregar un clon superficial donde ese SHA histórico no exista y el Ignored Build Step falla con `fatal: bad object`.

## Pruebas

- **Dónde viven:** las pruebas de `bramulab/` están en `bramulab/tests/` (cada una trata `__dirname` como la raíz de `bramulab/`); las de Metrics siguen en la raíz hasta que termine su desarrollo; las de Edge y operación, junto a su código en `supabase/`. Comando completo y `npm ci` previo: `INDICE.md`.

- Probar riesgos concretos, no todo por costumbre.
- Repetir pruebas cuando exista riesgo real de datos, identidad, auth, seguridad, migraciones o regresión.
- No repetir baterías equivalentes si ya existe evidencia suficiente.
- Work se usa para QA manual/visual únicamente cuando aporta evidencia que los tests automáticos no pueden dar.

## Recursos / cuotas

- Antes de una ronda técnica, considerar costo de contexto, créditos, commits y deploys.
- No gastar Work o Claude para releer historia ya consolidada.
- Vercel tiene límites operativos reales y ya se alcanzó el tope diario durante desarrollo. Desde entonces, cada push que pueda disparar un deploy debe tratarse como un recurso a cuidar.
- Evitar micro-pushes, deploys de prueba redundantes y rondas que podrían validarse localmente antes de subir.
- Si el trabajo toca solo documentación o backend fuera de los Root Directory de las apps, conservar esos cambios fuera de `bramulab/` y `bramulive/` para que `ignoreCommand` pueda omitir los builds.
- Si el cupo de Vercel está cerca del límite, posponer deploys no esenciales y reservarlos para validaciones que realmente necesiten Preview.
- Los límites operativos (build-rate-limit, cuotas, etc.) forman parte del diseño del proceso, no un imprevisto externo.

## Presupuesto de contexto y tokens

El tiempo de lanzamiento y las cuotas de los agentes son recursos del proyecto. A partir de ahora:

- un handoff consolidado debe ser autosuficiente; el prompt a Claude debe apuntar a ese handoff y **no repetir su contenido**;
- por defecto Claude lee: README + una fuente maestra afectada + el handoff activo. No releer informes completos, Laboratorio completo ni cadenas de handoffs si el consolidado ya contiene lo necesario;
- usar un chat nuevo por ronda coherente, no por microcorrección; acumular primero el feedback visual compatible y ejecutar una sola tanda;
- para ajustes puramente visuales/CSS/markup usar esfuerzo normal de Claude; reservar esfuerzo Extra para backend, migraciones, identidad/datos, seguridad, debugging difícil o cambios transversales de lógica;
- no pegar logs completos de tests cuando alcanza con total PASS/FAIL y detalle de los fallos;
- ejecutar pruebas según riesgo: focales para cambios visuales/locales; suite completa cuando se toca lógica compartida o antes de un hito de salida;
- una ronda visual consolidada recibe un gate visual completo una vez; los hotfix posteriores se retestean de forma dirigida, salvo evidencia de regresión transversal;
- Central debe evitar volver a leer documentos extensos ya consolidados: usar secciones concretas o el handoff activo;
- si una ronda empieza a consumir contexto de forma desproporcionada, detener expansión de alcance y terminar primero lo ya definido.

## Patrón de ronda eficiente — preferido

Este patrón viene reduciendo tiempo/contexto sin perder control y pasa a ser el default cuando el trabajo ya está bien definido:

1. **Central consolida una sola vez** la decisión vigente en la fuente maestra y, si la ronda es mediana/grande, crea un handoff corto y acotado.
2. El mensaje a Claude funciona como **puntero**, no como duplicado del handoff: objetivo + archivos a leer + límites + salida esperada.
3. Claude **no reabre producto ni relee historia** si la fuente maestra/handoff ya resuelven la pregunta. Inspecciona únicamente el código afectado.
4. Mantener el **mismo chat de Claude mientras la etapa sea una continuación directa y el contexto siga limpio**. Abrir uno nuevo cuando cambia el frente, el chat quedó cargado de ramas descartadas o apareció una investigación distinta; no por cada microajuste.
5. Dividir cambios grandes en **subfases con frontera técnica real** (por ejemplo backend → frontend/UX → Storage), no en microtareas arbitrarias. Cada subfase debe dejar una salida usable por la siguiente.
6. Claude termina en repo remoto con **un resultado corto**. Central lee HEAD/diff/resultado directamente; Sebastián idealmente solo necesita decir **“terminó”**.
7. **Central absorbe aplicación/revisión que pueda hacer con herramientas propias** (por ejemplo Supabase Staging, verificación de migraciones, diff/status, documentación). No devolver esa operación a Sebastián ni volver a Claude si no aporta capacidad adicional.
8. Una ronda backend/documental debe evitar tocar archivos de frontend si no es necesario, para permitir que Vercel omita builds y ahorrar deploys.
9. Los informes de resultado deben registrar **qué cambió, qué pasó, qué falta y qué no se verificó**. No narrar toda la investigación ni pegar logs completos.

La métrica práctica no es “usar menos tokens” por sí sola: es **evitar releer, reexplicar y reprobar lo ya consolidado** manteniendo la misma calidad de evidencia.

## Gate completo y reducción de ping-pong entre agentes

El objetivo no es solo que cada agente haga bien su parte: la ronda debe requerir la menor cantidad posible de relevos manuales de Sebastián.

### Gate completo antes de devolver trabajo

Cuando Central revisa una entrega de Claude, debe ejecutar **todos los gates que ya sean evaluables en ese estado** antes de devolver una corrección.

No debe:
- detener la revisión al encontrar el primer problema;
- devolver una corrección, retomar la revisión después y descubrir enseguida otros problemas que ya podían haberse detectado en la primera pasada;
- usar frases como **“última corrección”**, **“cierre técnico”** o equivalentes mientras todavía queden gates disponibles sin ejecutar.

Sí debe:
- revisar el diff completo relevante;
- contrastar contra las fuentes vigentes;
- revisar tests/resultados;
- validar entorno remoto cuando ya sea posible;
- revisar permisos/seguridad si forman parte del riesgo;
- revisar documentación/estado de deploy cuando corresponda;
- consolidar **todos los hallazgos detectables** en una sola devolución a Claude.

Si después aparece un problema que **solo se vuelve observable al superar un gate anterior** —por ejemplo, una migración que recién puede verificarse en Supabase Staging real—, esa nueva vuelta está justificada como **evidencia nueva**, no como revisión parcial. Central debe explicitarlo.

### Fronteras externas — planificarlas antes

Antes de mandar una ronda a Claude, Central debe identificar si existe algún gate que Claude probablemente no pueda ejecutar por sí mismo, por ejemplo:

- Supabase Staging real;
- navegador/GUI real;
- Vercel;
- OAuth/OTP/autorización humana;
- cualquier entorno o credencial fuera del alcance del agente.

Si existe una frontera externa:
1. definir desde el inicio quién la ejecutará;
2. ubicarla explícitamente dentro de la secuencia de la ronda;
3. procurar que, una vez cruzada, Central haga **una revisión técnica completa** antes de volver a Claude;
4. evitar descubrir restricciones previsibles recién al final por falta de planificación.

### Presupuesto de handoffs

Objetivo normal de una ronda:
- Claude implementa y deja resultado remoto;
- Central hace una revisión completa;
- Sebastián recibe QA/decisión final.

Una vuelta adicional Claude ↔ Central es válida cuando aparece un bug real o una evidencia que no podía observarse antes. No debe convertirse en el modo normal de trabajo.

Cada vez que Central devuelva algo a Claude debe indicar también **qué gate queda después de esa corrección**.

Ejemplo:
“Después de este fix: verify Staging → revisión final Central → QA visual Sebastián.”

Esto permite saber dónde termina realmente la ronda y evita una cadena abierta de “terminó → corregí esto → terminó → corregí aquello”.

### Sebastián no es el scheduler

Sebastián no debe quedar atado a la computadora actuando como botón humano entre agentes.

Mientras no exista una automatización técnica completa entre Claude y Central:
- minimizar al máximo los relevos que dependan de que Sebastián escriba “terminó”;
- agrupar devoluciones;
- evitar pedirle que retransmita resultados técnicos ya disponibles en el repo;
- reservar su presencia para decisiones de producto, autorizaciones sensibles o QA final.

La automatización futura del traspaso entre agentes es un problema de **orquestación**, separado de la calidad del método de revisión.

## Presupuesto de deploys Vercel — regla operativa obligatoria

Incidente real 28/09/2026: el trabajo quedó bloqueado por rate limit de Vercel después de una jornada con demasiados commits/pushes sobre `staging`. El problema no fue la cantidad de cambios funcionales sino la **cantidad de deployments creados por la integración Git**.

### Regla principal

**No usar un commit remoto como unidad de pensamiento. Usar la ronda de trabajo como unidad de push.**

Default desde ahora:

- **Claude:** 1 push funcional por ronda terminada.
- **Central:** como máximo 1 push consolidado posterior por ronda, solo si realmente hace falta corregir/revisar algo.
- documentación, README, PreProduction, resultados y pequeños ajustes relacionados deben **agruparse**; evitar un commit por archivo o por observación.
- no hacer commits “de registro” mientras todavía se está investigando el mismo bloque; acumular las conclusiones y escribirlas juntas al final.
- no hacer commits/no-op para forzar deploy.
- un cambio backend/documental que no necesita frontend no debe generar un nuevo deploy por capricho; si la integración Git igualmente crea intentos, tratarlo como consumo real de cuota.

### BRAMUlab + BRAMUlive en el mismo repo

Un mismo push puede disparar intentos de deployment en más de un proyecto Vercel conectado al repositorio.

**Importante:** un Ignored Build Step puede cancelar el build pero aun así consumir una creación de deployment/cuota. Por eso no alcanza con “que BRAMUlive se cancele” si cada push sigue creando un deployment.

Hasta que se haga una configuración específica para evitarlo:

- asumir conservadoramente que **cada push a staging puede consumir más de un deployment**;
- no tocar BRAMUlive ni su configuración sin autorización explícita;
- cuando exista autorización, ajustar únicamente la configuración de deploy para que cambios exclusivos de BRAMUlab no creen deployments de BRAMUlive.

### Presupuesto práctico por jornada

No perseguir el máximo del plan. Trabajar con margen.

- objetivo normal: **muy pocos pushes por bloque**;
- si una ronda necesita 5+ commits remotos para quedar bien, detenerse y consolidar antes de seguir;
- Central debe preferir edición/batching local o entregar todas las correcciones juntas al siguiente agente antes que encadenar microcommits remotos;
- antes de una ronda larga de UX con muchos retoques, concentrar cambios y hacer **un solo deploy visual relevante** al final de la ronda, salvo que exista un riesgo concreto que requiera validar antes.

### Qué hacer si Vercel entra en rate limit

- **NO** seguir reintentando deploys;
- **NO** generar commits para “ver si entra”;
- seguir trabajando en repo/tests/backend si no depende del deploy;
- acumular el frontend y desplegar una sola vez el HEAD más reciente cuando se libere la cuota;
- registrar el bloqueo una sola vez, no en múltiples commits.

### Criterio de éxito

El método eficiente no se mide solo por tokens/contexto. También debe minimizar:

- pushes;
- deployments;
- builds;
- revisiones repetidas;
- esperas externas evitables.

**Objetivo operativo:** que BRAMU nunca vuelva a perder una jornada de trabajo por una secuencia evitable de microcommits/deployments.


## Rotación preventiva del chat Central

No esperar a que el chat llegue al mensaje de longitud máxima.

Abrir un chat Central nuevo cuando:
- se cierra una ronda grande y empieza otro frente;
- antes de una ronda técnica transversal si el chat actual ya acumuló implementación + gate extensos;
- el contexto quedó cargado de caminos descartados, logs o handoffs consumidos aunque todavía permita seguir escribiendo.

Antes de migrar:
1. dejar un **único handoff de continuidad** como documento de ronda activa (`docs/BRAMUlab/Implementacion/Ronda_<tema>.md`, ver «Higiene documental»);
2. registrar HEAD exacto, estado del gate, qué ya fue verificado, qué falta y decisiones humanas cerradas;
3. el nuevo chat lee por defecto solo **README + Metodo_Trabajo + handoff activo + fuentes maestras indicadas por ese handoff**;
4. no reconstruir la conversación anterior ni releer cadenas completas de handoffs consumidos;
5. los prompts a Claude/Work funcionan como punteros al handoff, no como duplicados extensos;
6. Sebastián no transporta contexto técnico: idealmente abre el chat con un texto corto que apunte al handoff.

Central debe pedir a las herramientas salidas focalizadas (rangos, archivos, hallazgos) y evitar volcar informes/logs completos cuando no aportan a la decisión.

La rotación es **preventiva**: si una ronda ya está cerrada y documentada, se prefiere chat nuevo para el siguiente frente aunque el chat anterior todavía tenga espacio.

## Continuidad entre chats / traspaso obligatorio

Cuando corresponda rotar un chat de Desarrollo/Central —preventivamente o por límite de contexto—, el nuevo chat **no debe depender de memoria conversacional informal** para recuperar el método de trabajo.

El texto de arranque del nuevo chat debe exigir leer, como mínimo:

- `docs/BRAMUlab/README.md`
- `docs/BRAMUlab/Metodo_Trabajo.md`
- `docs/BRAMUlab/Pre_Production.md`
- la fuente maestra del sistema que se esté trabajando;
- el último resultado/handoff vigente del bloque en curso.

Además, el mensaje de traspaso debe recordar explícitamente estas reglas críticas:

- desarrollo solo sobre `staging`;
- no tocar `main`, Production ni BRAMUlive sin autorización;
- evitar microcommits/micropushes;
- una ronda = idealmente 1 push funcional de Claude + como máximo 1 push consolidado de Central;
- no usar Ignored Build Step como supuesto ahorro de cuota;
- no reintentar deploys cuando Vercel está rate-limited;
- agrupar documentación/QA/correcciones menores en un solo push;
- Sebastián no debe convertirse en operador técnico: idealmente solo comunica decisiones y confirma resultados finales.

**Regla de continuidad:** cada vez que Central prepare el texto para abrir un chat nuevo, debe incluir o apuntar a estas instrucciones. Si el método cambia, se actualiza primero `Metodo_Trabajo.md`; el siguiente chat hereda la versión vigente desde el repo.

## Entornos

- Desarrollo activo sobre `staging`.
- No tocar `main`, Production ni BRAMUlive salvo autorización o tarea explícita.
- Cambios de backend, siempre primero en Staging.

## Autonomía

- No pedirle a Sebastián comandos, navegación o pruebas que los agentes puedan ejecutar.
- Cuando su intervención sea necesaria, agruparla y reducirla al mínimo.
- Idealmente Sebastián decide producto al inicio de una ronda y revisa el resultado al final.


## Ajustes visuales finos

Cuando el problema sea de composición, jerarquía, peso visual, espaciado o sensación de interfaz:

- Sebastián entrega captura + explicación de intención directamente a ChatGPT central.
- Central traduce esa evidencia a criterios concretos y los consolida en el repo.
- Claude Code implementa desde ese documento; no decide por sí solo una reinterpretación visual.
- Work valida el deploy real contra la intención/capturas.
- Un test de DOM/CSS puede prevenir regresiones, pero no reemplaza un PASS visual cuando el criterio es visual.
- Evitar chats intermedios de “Laboratorio” para traducir ajustes finos si agregan otra capa de interpretación.

## Versión visible para QA (regla confirmada 01/10/2026)

- Toda versión desplegada que Sebastián deba distinguir/revisar visualmente **incrementa la versión pública** `V04.xx`, secuencialmente: V04.21, V04.22, V04.23…
- Los sufijos `-hN` del bundle quedan reservados para hotfixes técnicos internos que **no** requieren que Sebastián distinga una nueva versión de QA. Un `hN` nunca sustituye una versión visible cuando se le pide QA al usuario.
- Al subir de versión pública el bundle reinicia en `-h1` y se sincronizan `APP_VERSION`, `BUNDLE_VERSION`, `version.json`, `CACHE_NAME`/`CORE_ASSETS` del Service Worker, query strings, manifest y tests de versionado — en el mismo commit, sin un segundo push solo por documentación.

## Higiene documental y orden del repositorio (regla operativa)

Objetivo: que la coordinación entre agentes **no produzca** una colección permanente de handoffs, resultados, gates y versiones `final/final_v2`. **No es una nueva jerarquía de fuentes:** prevalecen `README.md` y la fuente maestra de cada sistema.

**Regla en una línea:** *una fuente maestra por sistema · un documento activo por ronda · una evidencia de cierre solo si agrega valor real.*

### Durante una ronda

1. **Documento activo único:** si la ronda es mediana/grande, existe **un solo** archivo `docs/BRAMUlab/Implementacion/Ronda_<tema>.md`, sin números ni sufijos de versión. Handoff, plan, resultado, corrección y cierre son **secciones del mismo archivo**, que se actualiza en el lugar en cada ida y vuelta. Prohibido crear un archivo nuevo por diagnóstico, hotfix menor, gate o reintento.
2. Los prompts de ChatGPT/Claude/Work apuntan a ese archivo y no duplican su contenido. Decisiones abiertas: `DECISIÓN ABIERTA` dentro del mismo documento.
3. Si la ronda es chica, no se crea documento: se registra en el commit y, al cerrar, en la fuente maestra.

### Al cerrar la ronda (checklist obligatorio)

1. **Fuente maestra actualizada** con cómo funciona el sistema ahora (no con cómo se llegó).
2. **Registro:** una entrada breve en el Informe de la versión (`Versiones/…`) si la ronda cambió el producto; riesgos conocidos, decisiones diferidas e ideas → `BRAMUlab_Backlog.md`.
3. **Evidencia que se conserva:** solo si es técnica y todavía útil (migración aplicada, seguridad, identidad/datos, producción, incidente, ensayo operativo). Se deja **un** documento de cierre identificable; no varios informes equivalentes.
4. **Verificar referencias** antes de retirar: menciones desde README, otras fuentes maestras, tests, scripts y tareas activas (`node docs/check-docs.mjs` + `git grep`). No retirar por patrón ni por nombre; un documento que lee un test o cita una fuente vigente se adapta primero.
5. **Retirar** del árbol el documento de ronda y todo intermedio consumido en el mismo commit documental (`docs:`). Git conserva los documentos versionados; **no** conserva archivos que solo estuvieron en Dropbox.
6. **No tocar código para arreglar citas rotas** en comentarios: las rutas retiradas se recuperan con Git, y editar `bramulab/` o las Edge Functions dispara builds y cambia hashes de release.
7. Agrupar la documentación de cierre en **un solo push** (ver «Presupuesto de deploys»).

### Orden del repositorio

- **Raíz de `docs/BRAMUlab/`:** solo fuentes maestras, Runbook, Operación Vercel, Backlog, Metodo y Metrics. `README.md` es un mapa corto: **el estado va en su tabla §1** (no en párrafos acumulativos) y la narrativa por ronda va al Informe de la versión. Tope orientativo: README ≤ 16 KB (lo verifica `docs/check-docs.mjs`).
- **No existen `Archivo/` ni `Backup/`.** Nada «por inercia»: si un documento no es fuente maestra, evidencia con función o historia con valor concreto, se retira.
- **Código, tests, migraciones y documentación normativa viven en Git.** No reorganizar código por estética ni borrar tests funcionales.
- **Seguridad:** nada es privado por estar fuera de `dist/` si el repo es público. Cambios de visibilidad, GitHub Pages, URL de logos de email y cualquier efecto sobre BRAMUlive son una intervención aparte con verificación de dependencias.
- **BRAMU Metrics** se trata como trabajo en curso: no consolidar ni mover sus archivos hasta que su responsable lo indique.

### Dropbox (originales y material no versionado)

Una única carpeta principal visible, `/Otros Trabajos/BRAMU/` (mapa en su `LEEME.md`; sin carpetas ocultas ni accesos directos):

- **`Desarrollo/`** — la copia de trabajo del repositorio (GitHub es la fuente de verdad) con los dos productos (`bramulab/`, `bramulive/`), `supabase/` y `docs/`. Es una copia limpia (`git clone`) creada el 08/10/2026; **no se mueve ni se renombra** mientras haya sesiones de Claude Code/Git sobre esa ruta (la memoria y el historial de cada proyecto se asocian a la ruta). Nunca guardar acá algo irrecuperable que no esté en Git; `.claude/launch.json` lleva rutas absolutas de esta carpeta.
- **`Sistema grafico/`** — originales de Illustrator, identidad visual, exportaciones y `Referencias/`. **Intocable**: no renombrar, reemplazar ni reconstruir nada de adentro.
- **`Documentos privados/`** — material sensible no versionado (p. ej. las decisiones legales con datos personales del titular); nunca va al repositorio público.
- **`Archivo histórico/`** — dos zips sin copia en Git, explicados en su `LEEME.md`. Nada «por las dudas».

El historial de las sesiones anteriores a la migración sigue consultable desde la app (`list_events`, `search_session_transcripts`) aunque su carpeta original ya no exista. Todo material nuevo se guarda en la sección que le corresponde; nada suelto en `Otros Trabajos`.

No duplicar entre Dropbox y GitHub sin una razón concreta (ni repositorios, ni `node_modules`, ni exports regenerables). Todo lo que se pueda regenerar con un comando (`npm ci`, `dist/`) no es un entregable ni se versiona; la copia local de `supabase/scripts/node_modules` existe solo porque los tests de `bramulab/` importan PGlite desde ahí (si falta: `cd supabase/scripts && npm ci`).

### Mantenimiento

Al cierre de cada bloque (no semanalmente): `node docs/check-docs.mjs` (referencias rotas, `Archivo/`/`Backup/`, nombres tipo `final_v2`, README demasiado grande, documentos de `Implementacion/` que ninguna fuente vigente cita) y barrer handoffs consumidos con el checklist de arriba.
