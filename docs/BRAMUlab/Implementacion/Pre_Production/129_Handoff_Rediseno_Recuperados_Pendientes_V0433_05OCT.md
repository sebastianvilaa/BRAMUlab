# 129 — Handoff · Rediseño de Recuperados + validación rápida + Partidos pendientes

**Fecha:** 05/10/2026  
**Rama única:** `staging`  
**Base funcional:** BRAMUlab V04.32 / bundle 04.32-h1  
**HEAD de referencia antes de este handoff:** `8d3e38d955dfca96d2b0881ae4ba85fb27c396af`  
**Tracking principal:** Issue #29  
**Estado:** decisiones de producto/UX confirmadas tras QA humano de V04.31/V04.32. Este handoff **reemplaza** la revisión obligatoria partido por partido que hoy existe en `PARTIDOS RECUPERADOS` y consolida la experiencia general de pendientes/validación rápida.

## 0. Objetivo de la ronda

Resolver en una sola ronda coherente dos fricciones que en realidad forman parte del mismo sistema:

1. **Recuperar una identidad no debe obligar a auditar uno por uno todos los partidos históricos.**
2. **Cuando un jugador tiene varios partidos que requieren respuesta, BRAMU debe permitir resolverlos rápido sin entrar al Resumen de cada partido.**

La solución debe sentirse deportiva, simple y ágil. No convertir Home/Historial en una bandeja administrativa.

---

# 1. Principio de producto confirmado

## Claim de identidad = recuperación automática

Cuando el usuario confirma `SÍ, SOY YO`, BRAMU vincula automáticamente a su cuenta **todos los partidos asociados a esa identidad provisional**.

Ya no existe la obligación de responder `SÍ, LO JUGUÉ` / `NO, NO LO JUGUÉ` partido por partido para completar la recuperación.

El caso normal debe ser fácil; las excepciones se corrigen después mediante el flujo existente de `REPORTAR UN ERROR`.

### Efectos deportivos

- Los partidos que ya estaban **validados** pasan inmediatamente a formar parte del historial real de la cuenta reclamada.
- Esos partidos computan para calibración/Nivel/estadísticas según las reglas vigentes.
- No reescribir rankings semanales ya publicados ni historia deportiva de terceros fuera de las reglas existentes.
- Los partidos todavía pendientes siguen sin producir efectos oficiales hasta quedar validados, como hoy.

El claim confirma la identidad histórica; no se agrega una segunda confirmación individual para partidos ya validados.

---

# 2. Entrada por invitación — modal `¿SOS X?`

Se conserva el modal/sheet de identidad.

## Contexto que debe mostrar

En lugar de usar un partido arbitrario o simplemente el más reciente, mostrar **el partido que originó ESA invitación** siempre que el contrato actual permita identificarlo.

Ese partido es el contexto humano más fuerte: es el motivo real por el cual alguien compartió el link.

Enriquecer la representación de los jugadores de ese partido con identidad visual compacta:

- foto/avatar si existe;
- nombre;
- `@usuario` en jerarquía secundaria cuando exista;
- fallback normal para jugadores sin cuenta.

No crear cuatro fichas grandes de perfil. Debe ser una representación compacta de las dos parejas para reconocer el contexto de un vistazo.

Si existen más partidos asociados a esa identidad, indicar por ejemplo:

`+ 17 partidos más asociados a Mariano`

## Acciones

- `NO, NO SOY YO`
- `SÍ, SOY YO`

`NO, NO SOY YO` conserva las reglas actuales: no consume el link y no debe encadenar modales stale.

---

# 3. Después de `SÍ, SOY YO`: pantalla completa de Recuperados

No mutar el modal en un popup gigante.

Después del claim exitoso:

1. cerrar el modal;
2. abrir una **pantalla completa** de Recuperados.

Cabecera conceptual:

**RECUPERAMOS 18 PARTIDOS**  
`Ya forman parte de tu historial.`

No hace falta usar exactamente ese copy si existe una variante más consistente con el sistema visual, pero el mensaje debe ser directo y positivo.

## 3.1 Si no hay partidos accionables

La pantalla es breve.

Mostrar:
- cantidad recuperada;
- explicación;
- CTA secundario `VER LOS 18 RECUPERADOS`;
- CTA principal `ENTRAR A BRAMU`.

No pedir confirmación individual de participación.

## 3.2 Si hay partidos que ahora requieren respuesta del recuperado

Mostrar inmediatamente debajo:

**N PARTIDOS NECESITAN TU RESPUESTA**

Y listar **todos** los partidos accionables en scroll; no limitar artificialmente a 3.

Cada partido usa el componente de **validación rápida** definido en §5.

Abajo:
- `VER LOS 18 RECUPERADOS`
- `OMITIR`

`OMITIR` debe permanecer disponible aunque existan 5, 8 o más pendientes. Registrarse/reclamar identidad nunca debe convertirse en una trampa.

Cuando todos los accionables de esa pantalla se resuelven, `OMITIR` deja de tener sentido y la salida pasa a `ENTRAR A BRAMU`.

Los pendientes no accionables para el recuperado no se muestran como tarea en esta pantalla; simplemente quedan en su estado normal de `ESPERANDO VALIDACIÓN`.

---

# 4. Historial > Recuperados — ventana especial de 30 días

Agregar/mantener una superficie temporal **RECUPERADOS** dentro de Historial.

Objetivo: permitir que el usuario audite el lote recuperado sin convertir el alta en una checklist obligatoria.

Reglas:

- muestra los partidos recuperados por claim;
- permanece destacada durante **30 días** desde la recuperación;
- transcurrido ese período desaparece el filtro/pestaña especial;
- los partidos NO desaparecen: siguen en `TODOS` / historial normal;
- el derecho a reportar un error no vence a los 30 días.

El período de 30 días es de **visibilidad especial**, no un plazo de caducidad de derechos ni de corrección.

Si un partido recuperado es incorrecto, usar el circuito existente:
`REPORTAR UN ERROR` → `NO PARTICIPÉ` / causa correspondiente.

No crear un sistema paralelo de impugnación.

---

# 5. Componente reutilizable — VALIDACIÓN RÁPIDA

Crear/unificar un componente de card para partidos que requieren respuesta del usuario.

Este componente debe servir en:

1. pantalla post-claim de Recuperados;
2. `Historial > Pendientes`;
3. acceso desde la nueva card de Home `PARTIDOS PENDIENTES`;
4. gate de máximo de pendientes (`VER PARTIDOS PENDIENTES`).

## 5.1 Anatomía

Basarse visualmente en la card de Historial / mock validado por producto:

- fecha;
- resultado prominente;
- parejas;
- formato;
- estado contextual;
- dos acciones en la base cuando el usuario puede responder.

Acciones para un partido `POR VALIDAR`:

- izquierda, outline rojo: `REPORTAR UN ERROR`
- derecha, verde: `VALIDAR PARTIDO`

No sumar `SÍ, LO JUGUÉ` / `NO, NO LO JUGUÉ` como tercera capa en esta superficie. Si el usuario no participó, lo resuelve dentro del flujo existente de Reportar un error.

## 5.2 Abrir Resumen

Tocar el cuerpo/resultado de la card abre el Resumen completo.

Al volver:
- regresar a la lista de la que salió;
- conservar el contexto y, si es razonable, posición de scroll.

El Resumen sigue permitiendo validar/reportar como hoy. La validación rápida es una segunda puerta, no reemplaza el Resumen.

## 5.3 Feedback al validar

No abrir modal de éxito.

Al tocar `VALIDAR PARTIDO`:

1. bloquear doble tap mientras responde;
2. al confirmar server-side, reemplazar las acciones por un estado integrado de ancho completo:
   `✓ PARTIDO VALIDADO`;
3. mantenerlo visible aproximadamente **0,8–1 segundo**;
4. contraer/desvanecer la card con una transición sutil;
5. las demás cards suben y ocupan su lugar.

No pintar el borde completo de verde: verde también comunica victoria y una derrota validada no debe parecer una victoria.

Si falla la validación, conservar la card y mostrar el error real; no fingir éxito.

---

# 6. Sistema general — PARTIDOS PENDIENTES

`PARTIDOS PENDIENTES` es el paraguas general.

Dentro de la experiencia, distinguir tres categorías:

1. **POR VALIDAR** — depende del usuario / su pareja y puede actuar ahora.
2. **POR RESOLVER** — existe una incidencia que requiere una acción distinta de validar.
3. **ESPERANDO VALIDACIÓN** — depende de otra persona/pareja; el usuario no puede actuar.

Orden de la pantalla completa:

1. `POR VALIDAR`
2. `POR RESOLVER`
3. `ESPERANDO VALIDACIÓN`

Las dos primeras son accionables; la tercera es informativa.

## 6.1 POR VALIDAR

Usar cards de Validación rápida (§5).

## 6.2 POR RESOLVER

Reutilizar los flujos existentes de resolución/corrección.

Para problemas de identidad, reemplazar el copy duro de usuario final `IDENTIDAD CUESTIONADA` por:

**JUGADOR POR IDENTIFICAR**

Texto breve recomendado dentro del caso:

`Revisá este partido para confirmar quién jugó.`

Esto puede cubrir uno o más jugadores afectados sin acusar a nadie.

El estado interno/backend puede conservar sus nombres técnicos actuales. El cambio es de lenguaje de producto.

## 6.3 ESPERANDO VALIDACIÓN

Mostrar las mismas cards base, pero **sin botones de acción**.

No agregar debajo un párrafo redundante tipo:
`El partido con X está esperando validación`.

El título de sección + badge `ESPERANDO VALIDACIÓN` ya explican el estado.

---

# 7. Historial > Pendientes como lugar canónico de resolución

Mantener el acceso de Historial a Pendientes, pero alinearlo con esta nueva experiencia.

Producto esperado:

- `Historial > Pendientes` debe mostrar/usar la misma estructura de §6;
- evitar implementar dos listas diferentes con lógicas distintas;
- Home y el gate de 5 deben deep-linkear a esta misma experiencia o al mismo componente/ruta;
- `Historial > Recuperados` sigue siendo un filtro separado, temporal, porque responde a otra pregunta: “qué partidos llegaron a mi cuenta por el claim”.

Un mismo partido puede aparecer en:
- `RECUPERADOS` por su origen;
- `PENDIENTES` por su estado actual.

No hay contradicción: son filtros distintos.

---

# 8. Home — destacados y nueva card `PARTIDOS PENDIENTES`

## 8.1 Carrusel/tarjetas superiores

Conservarlas, pero mostrar arriba **solo lo que exige acción del usuario**.

Sí mostrar:
- `POR VALIDAR`;
- casos `POR RESOLVER` / `JUGADOR POR IDENTIFICAR` cuando el usuario puede actuar.

No mostrar arriba:
- `ESPERANDO VALIDACIÓN`.

Los waiting actuales generan ruido porque el usuario no puede hacer nada.

El item accionable puede seguir abriendo directamente el partido específico.

## 8.2 Nueva card ancha en Home

Agregar una card de ancho completo **PARTIDOS PENDIENTES**, preferentemente en la zona baja del Home, antes de `BUSCAR JUGADORES` o en la ubicación equivalente que mejor respete la composición actual.

Debe tener un icono de atención/alerta en lenguaje amarillo/ámbar, no rojo de error.

Referencia visual: estructura de tres columnas similar conceptualmente a la card de Ranking BRAMU.

Ejemplo:

**PARTIDOS PENDIENTES**

| POR VALIDAR | ESPERANDO | POR RESOLVER |
| --- | --- | --- |
| 2 | 6 | 1 |

Puede mantener las tres columnas incluso con algún cero para estabilidad visual. Si el total es 0, no mostrar la card.

Tocar la card abre `Historial > Pendientes` / pantalla canónica de Partidos pendientes.

---

# 9. Gate de máximo de pendientes

La regla general no cambia:

- 1–2 accionables: sin warning especial;
- 3–4: aviso y puede omitir;
- 5: no puede iniciar una carga propia hasta resolver al menos uno.

Pero el CTA `VER PARTIDOS PENDIENTES` debe llevar a la nueva experiencia de validación rápida.

Esto transforma el bloqueo en una salida útil:
- abre lista;
- valida uno rápidamente;
- la card desaparece;
- queda en 4;
- puede volver a cargar.

El claim de identidad **no** queda bloqueado aunque al recuperar aparezcan 5+ pendientes.

---

# 10. Lenguaje unificado de estados

Unificar en Home, Historial, Resumen, Recuperados, notificaciones y superficies nuevas cuando corresponda:

- **POR VALIDAR** = depende de vos;
- **ESPERANDO VALIDACIÓN** = depende del otro lado;
- **POR RESOLVER** = umbrella para incidencias accionables;
- **JUGADOR POR IDENTIFICAR** = copy humano para incidencias de identidad.

Eliminar/reemplazar en UI cuando representen el mismo concepto:
- `TU TURNO: CONFIRMAR`;
- `IDENTIDAD CUESTIONADA`;
- usos ambiguos de `PENDIENTE DE VALIDACIÓN` que no distinguen quién debe actuar.

No renombrar enums/estados internos solo por copy si no hace falta.

---

# 11. Notificación de recuperación

Después de un claim exitoso, crear/usar una notificación para el propio usuario reclamante:

**RECUPERAMOS 18 PARTIDOS**  
`Los partidos que estaban registrados como Mariano ya están en tu historial.`

Al tocar:
- abrir `Historial > Recuperados`.

La notificación puede marcarse como leída, pero permanece en el historial normal del Centro de Notificaciones como las demás.

Esto es distinto de la notificación ya existente al invitador `X ya se sumó a BRAMU...`, que se conserva si sigue vigente.

---

# 12. Qué de V04.32 queda REEMPLAZADO

La lógica actual de V04.32 fue útil para validar el concepto técnico, pero esta ronda cambia la experiencia.

### REEMPLAZAR

- revisión obligatoria uno por uno de todos los recuperados;
- botones `SÍ, LO JUGUÉ` / `NO, NO LO JUGUÉ` como requisito de cierre;
- Home destacando `ESPERANDO VALIDACIÓN` arriba;
- copy `TU TURNO: CONFIRMAR`;
- copy visible `IDENTIDAD CUESTIONADA`;
- experiencia donde el gate manda a una lista que obliga a entrar partido por partido.

### CONSERVAR

- claim seguro y explícito;
- separación entre identidad y validación de resultado;
- acciones canónicas `VALIDAR PARTIDO` / `REPORTAR UN ERROR`;
- Resumen completo;
- correcciones existentes;
- límite 3/4/5;
- backend Team A/B;
- mi equipo verde/rival azul en presentación;
- deduplicación ya validada;
- notificaciones existentes que no contradigan este diseño;
- mínimo 1 cuenta + 3 provisionales.

---

# 13. Alcance técnico esperado

## AGREGAR

- recuperación automática sin checklist individual;
- pantalla post-claim full-screen;
- filtro temporal `RECUPERADOS` 30 días;
- notificación al reclamante;
- componente de Validación rápida;
- pantalla/estructura canónica de Partidos pendientes;
- card agregada de Home con 3 contadores;
- feedback/animación inline de validación.

## FUSIONAR

- `Historial > Pendientes` con la nueva estructura;
- gate de 5 con Validación rápida;
- Recuperados accionables con el mismo componente;
- copies de estado en todas las superficies;
- navegación Resumen ↔ lista conservando contexto.

## REEMPLAZAR

- checklist obligatoria de participación por partido recuperado;
- waiting no accionable en destacados superiores;
- copies ambiguos/duros indicados en §10.

## NO TOCAR

- `main`;
- Production;
- BRAMUlive;
- fórmula de Nivel;
- Ranking publicado/histórico;
- Grupos;
- Legal;
- deduplicación cerrada;
- B1/B2/B3/C1/C2 ya cerrados salvo regresión concreta;
- Team A/B canónicos del backend.

---

# 14. Implementación — criterio de simplicidad

Antes de crear tablas/RPC/Edge nuevos:

1. inspeccionar qué datos de `provisional_claims`, links y matches ya permiten:
   - conocer el partido origen de la invitación;
   - conocer la fecha/lote de recuperación;
   - derivar POR VALIDAR / POR RESOLVER / ESPERANDO.
2. reutilizar lo existente siempre que sea seguro.
3. si el filtro de 30 días o la notificación al reclamante requieren persistencia nueva, hacer el cambio mínimo forward-only en Staging.

No fabricar estados duplicados si se pueden derivar de la autoridad server-side vigente.

---

# 15. QA y pruebas por riesgo

No repetir toda la batería histórica de Invitados.

## Obligatorio — técnico

### Claim / Recuperados
- claim con 1 partido validado;
- claim con varios validados;
- claim con mezcla validado + pendiente accionable + esperando;
- ningún `SÍ, LO JUGUÉ` obligatorio;
- validados entran al historial/Nivel según reglas;
- `NO, NO SOY YO` conserva comportamiento;
- partido mostrado en `¿SOS X?` es el origen de esa invitación cuando está disponible;
- `RECUPERADOS` visible 30 días sin sacar partidos del historial después;
- notificación al reclamante abre Recuperados.

### Validación rápida
- validar desde card oficializa exactamente el match correcto;
- idempotencia / doble tap;
- feedback inline → desaparición;
- error real conserva card;
- abrir Resumen y volver restaura lista/contexto;
- reportar error reutiliza circuito existente.

### Pendientes
- derivación correcta POR VALIDAR / POR RESOLVER / ESPERANDO;
- waiting no aparece en destacados superiores;
- card Home cuenta correctamente cada categoría;
- Historial > Pendientes usa la misma lógica;
- gate 5 abre lista y al validar uno permite volver a 4.

### Regresión
- Team A/B backend intactos;
- mi equipo verde sigue siendo solo presentación;
- deduplicación mínima no rota;
- 1 cuenta + 3 provisionales sigue válido.

## QA humano posterior — corto

No hacer otra maratón.

1. un claim real con 2–3 partidos para verificar modal enriquecido + pantalla de Recuperados;
2. un partido validado entra sin pregunta individual;
3. un pendiente accionable se valida desde card rápida y desaparece;
4. Home: card Partidos pendientes + destacados superiores solo accionables;
5. Historial > Pendientes: secciones y copies;
6. Historial > Recuperados: filtro visible;
7. humo móvil de scroll/animación.

---

# 16. Versionado / documentación / salida

Versión sugerida si no hay conflicto con convención vigente:

- **BRAMUlab V04.33**
- bundle **04.33-h1**

Al terminar:

- actualizar `docs/BRAMUlab/README.md`;
- actualizar `docs/BRAMUlab/Experiencia_Inicial.md` en lo afectado;
- actualizar Issue #29;
- guardar un único informe/resultado de la ronda en `docs/BRAMUlab/Implementacion/Pre_Production/`;
- informar HEAD final, archivos, migraciones/RPC/Edge si existieran, tests y QA humano mínimo restante.

Preferir una sola intervención coherente, un commit/push lógico y un deploy intencional. Evitar micro-pushes y micro-QA.

**Production sigue prohibida.**
