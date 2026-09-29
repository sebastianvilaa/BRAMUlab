# BRAMUlab — Método de trabajo

> Guía operativa vigente para coordinación de agentes, commits, pruebas y deploys. Corta y aplicable — no es una filosofía de proceso.

---

## Fuentes de verdad

- Empezar siempre por `docs/BRAMUlab/README.md`.
- Después leer solo la fuente maestra del sistema afectado (README §2/§7 indica cuál).
- `Archivo/`, `Backup/` y handoffs ya consumidos **no son autoridad normal** — solo se leen ante pedido explícito de trazabilidad puntual.

## Separación de roles

- **ChatGPT central**: coordinación, producto, revisión, arquitectura, documentación y control de coherencia.
- **Claude Code**: implementación, análisis profundo del repo, migraciones, debugging y tests técnicos.
- **Work**: navegador real, GUI, Vercel y QA visual/manual cuando sea necesaria.
- **Sebastián**: puente mínimo, no operador técnico — decide producto y revisa resultado, no ejecuta comandos ni pruebas que un agente pueda correr.

## Brainstorming / producto

- Una idea nueva **no** se convierte automáticamente en desarrollo.
- Distinguir siempre entre:
  1. decisión ya confirmada;
  2. fricción encontrada;
  3. idea futura.
- No abrir frentes de implementación mientras un bloque dependiente sigue sin cerrar.
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

## Git / commits

- Evitar commits intermedios directamente sobre `staging`.
- Explorar, corregir y probar antes del push cuando sea posible.
- Revisar el diff final antes de commitear.
- Consolidar cada intervención en el menor número razonable de commits — idealmente uno solo, lógico y autocontenido.
- Para una subfase funcional, apuntar a **un único push/deploy intencional**. Un segundo push solo se justifica por un bug real, una corrección necesaria o una evidencia nueva que obligue a cambiar el resultado.
- No crear commits ni pushes solo para "probar por las dudas".
- Cambios únicamente documentales no deben provocar deploys de `bramulab` ni `bramulive` (ver `bramulab/vercel.json`/`bramulive/vercel.json` — `ignoreCommand`). El comando vigente compara `HEAD^` contra `HEAD` dentro de cada Root Directory. **No usar `VERCEL_GIT_PREVIOUS_SHA`**: Vercel puede entregar un clon superficial donde ese SHA histórico no exista y el Ignored Build Step falla con `fatal: bad object`.

## Pruebas

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
