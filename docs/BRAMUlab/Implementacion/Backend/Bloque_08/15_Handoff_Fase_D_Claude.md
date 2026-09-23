# Backend Bloque 8 — Handoff Fase D: Plantillas, persistencia mínima y UX

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Fases A, B y C cerradas en Staging.  
**HEAD funcional de C:** `a08fb358f4b0e251810815ffd33106b1769f2efc`.  
**Objetivo de esta ronda:** implementar **D — Plantillas y UX** de punta a punta, sin avanzar a E.

> Antes de D hay un único hardening transversal H01 detectado al preparar el wiring real: la identidad cuestionada no puede alimentar relaciones de Intelligence. Resolver H01 de forma mínima dentro de la misma ronda para evitar otro push/deploy separado.

---

## 1. Lectura obligatoria

Leer completo, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Implementacion/Backend/Bloque_08/14_Validacion_Central_Fase_C.md`
4. `docs/BRAMUlab/BRAMU_Intelligence.md` — especialmente §§6–12 y ejemplos de §10
5. `docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md`
6. `docs/BRAMUlab/Backend_Infraestructura.md` — Bloque 8 y principios de autoridad/persistencia

Después inspeccionar únicamente el código vigente necesario:

- `bramulab/intelligence-context.js`
- `bramulab/intelligence-claims.js`
- `bramulab/intelligence-editorial.js`
- `bramulab/match-sync.js`
- `bramulab/app.js`
- `bramulab/index.html`
- `bramulab/styles.css`
- las migraciones/Edge Functions vigentes que sirvan de patrón.

No leer Archivo/Backup ni reabrir decisiones cerradas.

---

## 2. H01 — hardening previo obligatorio: identidad estable

La fuente maestra dice:

- identidad estable de cada participante es dato mínimo;
- sin identidad estable, insights de compañero/rival son frágiles;
- el motor debe descartar candidatos que fallen identidad.

Fase A ya preserva `hasOpenIdentityIssue`, pero hoy los agregados/claims relacionales pueden usar igualmente partidos con una incidencia de identidad abierta.

### Resultado obligatorio

Un partido con `hasOpenIdentityIssue=true` **no puede aportar evidencia relacional** a:

- compañero;
- rival individual;
- pareja rival exacta;
- cruce exacto;
- “compañero nuevo”;
- “dificultad previa frente a rival”;
- “mejor compañero”.

Y si el **partido actual** tiene una incidencia de identidad abierta, no producir claims relacionales sobre los participantes cuestionados de ese partido.

Como Fase A solo dispone hoy del booleano global del partido, es preferible ser conservador antes que atribuir una relación a la persona incorrecta.

### Solución esperada

Aplicar la corrección mínima en la capa correcta:

- excluir partidos con identidad abierta de agregados relacionales;
- impedir claims relacionales del partido actual mientras su identidad esté cuestionada;
- mantener disponibles los hechos no relacionales que siguen siendo verificables (score, racha propia, hitos, forma, inactividad, etc.) cuando corresponda.

No convertir una incidencia de identidad en eliminación del partido.

Agregar tests y mantener A+B+C verdes.

**No hacer una reauditoría de A/B/C. H01 es el único motivo autorizado para tocarlas.**

---

## 3. Qué debe cerrar Fase D

Fase D debe convertir la decisión estructurada de C en una experiencia real y persistente:

1. templates determinísticos siempre disponibles;
2. `templateId` estable/versionado;
3. título + cuerpo del principal;
4. cuerpo de secundarios;
5. evidencia humana para “Por qué aparece”;
6. estados de aprendizaje;
7. abstención/fallback honesto;
8. memoria de templates;
9. persistencia de la salida y evidencia;
10. integración en el Resumen real del partido.

No implementar Nivel/Ranking todavía. Familia H sigue para E.

---

## 4. Plantillas determinísticas

Crear una capa pura separada, por ejemplo:

`bramulab/intelligence-presentation.js`

o nombre equivalente coherente con el repo.

Debe consumir exclusivamente:

- la decisión de `PLIntelligenceEditorial`;
- los claims/evidencia ya seleccionados;
- un resolver de nombres basado en identidades reales del historial.

Nunca recalcular hechos.

### Salida estructurada recomendada

Cada insight visible debe quedar representado con algo equivalente a:

- `insightType`;
- `family`;
- `semanticKey`;
- `templateId`;
- `title` — solo principal;
- `body`;
- `evidenceSummary` / `why`;
- `officialScope`;
- `confidenceTier`;
- `evidenceMatchIds`;
- versiones de reglas de A/B/C/D.

La frase visible nunca reemplaza al claim.

### Reglas de copy

Fuente: `BRAMU_Intelligence.md`.

Principal:

- título 3–7 palabras;
- cuerpo objetivo ~12–24 palabras;
- una idea principal;
- tono deportivo/moderno, no coach;
- victoria/hito: celebratorio moderado;
- derrota: factual;
- muestra baja: exploratoria;
- nunca emoción/psicología/causalidad/técnica.

Secundarios:

- una frase;
- ~10–20 palabras;
- no repetir el título principal;
- máximo 2.

Alcance:

- `personal` / `mixto`: hablar de “partidos registrados” cuando haga falta aclarar;
- `oficial`: puede usar lenguaje oficial solo cuando realmente corresponda;
- nunca transformar un claim personal en claim oficial por redacción.

### Entidades/nombres

Resolver nombres desde `playerId` real del historial.

- cambiar displayName no rompe identidad;
- no deduplicar por nombre;
- si un nombre visible no está disponible, usar una formulación neutral (“ese compañero”, “ese rival”) antes que inventar una entidad.

---

## 5. Templates y repetición

Las variantes deben ser **controladas y determinísticas**, nunca aleatorias.

Fase C ya conserva `recentTemplateIds`.

D debe:

- asignar `templateId`;
- evitar reutilizar la misma plantilla exacta en los siguientes 5 partidos cuando haya una variante compatible;
- actualizar la ventana de templates mostrados;
- si no existe alternativa, usar un fallback estable y dejar la decisión auditada;
- no reescribir el contenido histórico al cambiar las plantillas futuras.

No hace falta reabrir la tabla de subpuntajes de C.

---

## 6. Estado de aprendizaje y abstención

Respetar §8 y §9.5.

Mensajes de aprendizaje V1:

- 1 partido: “Primer partido de tu historia BRAMU.”
- 3 partidos: “Ya aparecen tus primeros antecedentes con este grupo.”
- 5 partidos: “Tu forma reciente ya puede leerse sobre tus últimos 5.”

Aparecen **una vez por hito**, no en todos los partidos.

Si C se abstiene y no hay un hito de aprendizaje nuevo:

- usar una lectura mínima y factual del score, o
- omitir conclusiones secundarias;

pero nunca fabricar una historia para llenar espacio.

Ejemplo válido:

“Partido guardado. No apareció una conclusión histórica más relevante que el resultado.”

No usar el viejo texto genérico de `S.generateManualIntelligence` como BRAMU Intelligence V1.

---

## 7. “Por qué aparece”

Debe ser desplegable y factual.

Puede mostrar:

- qué partidos/ventana se consideraron;
- tamaño de muestra;
- alcance: registrados/oficiales;
- dato anterior y nuevo cuando existan;
- confianza/muestra en lenguaje humano;
- “partidos ordenados por fecha jugada” cuando sea útil.

No mostrar:

- IDs;
- nombres de tablas/RPCs;
- scores internos de relevancia;
- `reasonCodes` técnicos;
- implementación;
- datos privados no necesarios.

La evidencia visible se deriva del objeto guardado. No recalcular al abrir el desplegable.

---

## 8. Persistencia mínima obligatoria

La arquitectura vigente exige:

> guardar la salida y su evidencia; no regenerarla al abrir una pantalla.

Ahora existe un consumidor real, por lo que ya corresponde persistir.

### Requisitos

Diseñar la persistencia mínima compatible con el esquema actual.

Debe existir una salida **por jugador/perspectiva y partido**, porque cuatro jugadores pueden recibir Intelligence diferente sobre el mismo encuentro.

Persistir como mínimo:

- jugador;
- partido;
- estado válido/invalidado;
- versiones de reglas A/B/C/D;
- salida principal/secundarios;
- claims/evidencia necesarios para auditar;
- `templateId`;
- decisión de abstención/aprendizaje;
- fecha de generación;
- una firma/fingerprint de la historia fuente usada.

La memoria editorial puede persistirse:

- como snapshot asociado a la salida, o
- en una estructura separada por jugador;

elegir la opción más simple que permita reproducibilidad y continuidad.

### Idempotencia y no-regeneración

Abrir un Resumen:

- si existe una salida válida con mismas versiones + misma historia fuente → devolverla;
- no volver a elegir otra frase;
- no cambiar template;
- no alterar memoria.

Si la fuente cambió de verdad:

- corrección;
- anulación;
- identidad resuelta/cambiada;
- partido retroactivo que entra antes del partido objetivo;

la salida afectada puede invalidarse/recalcularse de forma determinística.

### Orden histórico

La generación/memoria debe seguir **fecha jugada**, no orden de carga.

Como se permite carga retroactiva, no usar “último generado” como sustituto ciego de “partido anterior por fecha”.

Una solución válida y simple para la escala inicial es guardar un **fingerprint determinístico del prefijo de historia** usado para cada salida y regenerar solo cuando el fingerprint ya no coincide.

No crear colas/microservicios/event sourcing innecesario.

---

## 9. Autoridad server-side

La generación persistente de BRAMU Intelligence para usuarios reales debe ser server-side.

Preferir una Edge Function Supabase siguiendo los patrones ya vigentes y reutilizando los módulos compartidos por symlink:

- context;
- claims;
- editorial;
- presentation.

El cliente debe enviar como máximo el `matchId`.

La función:

- deriva al jugador desde la sesión autenticada;
- nunca acepta un `playerId` arbitrario del navegador;
- carga historia real;
- trunca por el partido objetivo según fecha jugada + desempate estable;
- genera o devuelve la salida persistida;
- escribe memoria/salida con autoridad server-side;
- es idempotente.

No usar service-role en el navegador.

RLS/GRANT:

- cliente nunca escribe outputs/memoria directamente;
- lectura solo del propio jugador si se expone por tabla/RPC;
- preferir devolver la salida desde la función autenticada si eso mantiene el contrato más simple;
- tablas server-only con deny-by-default si no necesitan lectura directa.

No aplicar nada a Production.

Claude debe crear migraciones/función/tests, pero **no necesita aplicar/deployar Supabase Staging** si su entorno no tiene autorización. ChatGPT central lo hará después de revisar el commit.

---

## 10. Integración con la UI actual

La pantalla canónica ya existe:

`#view-analysis` / “RESUMEN DEL PARTIDO”.

Orden actual:

1. resultado;
2. acciones B6;
3. nota de cobertura;
4. `#analysis-intelligence`;
5. estadísticas...

Ese es el lugar correcto.

### REEMPLAZAR

El contenido legacy actual:

`#analysis-intelligence-text <- f.intelligence`

no debe seguir siendo la fuente de BRAMU Intelligence V1 para partidos server-backed reales.

`match-sync.js` puede conservar `S.generateManualIntelligence` como compatibilidad descriptiva legacy donde todavía haga falta, pero:

- NO presentarlo como V1 en el camino real server-backed;
- NO usarlo como fallback histórico;
- NO mezclar ambos motores.

### UX

Reutilizar la tarjeta existente y llevarla a la anatomía V1:

- label BRAMU INTELLIGENCE;
- principal con título y cuerpo;
- hasta 2 secundarios;
- “Por qué aparece” expandible;
- estado aprendizaje/abstención cuando corresponda.

No crear una pantalla nueva.

Las acciones B6 siguen arriba de Intelligence.

### Async

La UI no puede quedar con texto viejo mientras espera red.

- mostrar un estado de carga discreto o mantener la tarjeta oculta hasta resolver;
- proteger contra respuestas tardías si el usuario ya abrió otro partido;
- error transitorio → fallback honesto, nunca legacy inventado.

### Offline / outbox

Para `sync_pending` / carga todavía no disponible en servidor:

- no fingir Intelligence histórica;
- mostrar un estado breve tipo “BRAMU Intelligence se completa cuando la carga quede sincronizada” o equivalente;
- una vez sincronizado y con `matchId` real, usar el flujo normal.

---

## 11. No confundir con BRAMUlive ni grupos

- BRAMUlive: NO TOCAR.
- “BRAMU Intelligence grupal” de Mis Grupos es otra función legacy/local: NO TOCAR en esta fase.
- Este trabajo es exclusivamente Intelligence personal post-partido de BRAMUlab.

---

## 12. Fase E sigue fuera de alcance

NO integrar todavía:

- expectativa de Nivel;
- delta de Nivel;
- reasonCodes de Nivel como insights;
- hitos semanales de Ranking;
- movimiento de Ranking;
- banda pública de Nivel como hito.

D debe quedar extensible para que E agregue Familia H sin rediseñar templates/persistencia/UI.

---

## 13. Tests mínimos de D

Además de mantener A+B+C verdes y los tests de H01:

### H01 identidad

1. partido con identidad abierta no entra en agregado relacional;
2. current match con identidad abierta no produce claims relacionales;
3. claims no relacionales verificables siguen disponibles;
4. identidad estable/resuelta conserva comportamiento normal.

### Templates

5. cada `insightType` A–G seleccionable tiene template determinístico;
6. 0 placeholders sin resolver;
7. 0 IDs técnicos visibles;
8. números del texto corresponden exactamente al claim;
9. nombres provienen del resolver real;
10. personal/oficial/mixto no se confunden;
11. variantes/templateId son determinísticos;
12. una plantilla reciente se evita cuando hay alternativa;
13. ningún template agrega técnica, emoción o causalidad.

### UX/estado

14. 1 principal + 0–2 secundarios;
15. abstención no fuerza insight;
16. hitos de aprendizaje aparecen una vez;
17. “Por qué aparece” deriva de evidencia guardada;
18. pending sync no muestra Intelligence histórica falsa;
19. respuesta async vieja no pisa el partido actualmente abierto.

### Persistencia/backend

20. misma sesión + mismo match + misma fuente devuelve exactamente la misma salida guardada;
21. reabrir no cambia template ni memoria;
22. caller no puede pedir/generar Intelligence como otro jugador;
23. cliente no puede escribir outputs/memoria;
24. historia retroactiva/fingerprint distinto invalida la salida afectada;
25. corrección/identidad que cambia fuente produce fingerprint distinto;
26. historia ordenada por playedAt, no createdAt;
27. salida de un partido viejo no incluye partidos jugados después;
28. 0 claims/números/entidades inventados.

Correr además la batería de frontend afectada por `app.js/index.html/styles.css/sw.js`.

No hace falta Work todavía: la QA visual/manual real se hace **después** de revisión central + aplicación/deploy Staging.

---

## 14. Archivos y versión

Mantener separación clara:

### AGREGAR

- módulo puro de presentación/templates;
- cliente mínimo de Intelligence si corresponde;
- migración/persistencia mínima;
- Edge Function server-side;
- tests;
- documentación de resultado.

### FUSIONAR

- `app.js`: wiring al Resumen canónico;
- `index.html`: estructura dentro de `#analysis-intelligence`;
- `styles.css`: solo estilos necesarios;
- service worker/versionado si esos archivos entran al bundle;
- memoria editorial/template IDs.

### REEMPLAZAR

- uso de `f.intelligence` como contenido de BRAMU Intelligence en el camino server-backed real.

### NO TOCAR

- main;
- Production;
- BRAMUlive;
- Ranking;
- motor de Nivel;
- Mis Grupos;
- capa generativa;
- pantallas ajenas al Resumen salvo wiring estrictamente necesario.

Si se modifica frontend, hacer **un único bump de bundle/version** para toda la Fase D. No hacer micro-bumps.

---

## 15. Entrega / cuota Vercel

- trabajar y probar localmente;
- NO hacer pushes intermedios;
- revisar diff completo;
- un único commit/push final a `origin/staging`;
- documentar migraciones/Edge Function que ChatGPT central deba aplicar/deployar;
- indicar DECISIÓN ABIERTA solo si realmente cambia producto y no está resuelta por la fuente;
- NO avanzar a E.

Por la cuota de Vercel, esta ronda debe producir **un solo deploy intencional de BRAMUlab**.

La entrega no está terminada hasta que commit + informe estén accesibles en `origin/staging`.
