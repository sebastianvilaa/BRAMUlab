# BRAMU Intelligence V1 — Implementación vigente

**Estado:** definición funcional cerrada; todavía no implementada en la app productiva.  
**Alcance:** Intelligence posterior a partidos cargados manualmente / ya jugados.  
**Actualización documental:** 15 de septiembre de 2026.

Este documento reemplaza el handoff anterior que quedó desactualizado en sus referencias a Nivel V1.4 y al Ranking continuo. El detalle normativo completo sigue viviendo en `BRAMU_Intelligence.md`.

---

## 1. Precedencia

Desarrollo debe usar, en este orden:

1. `BRAMU_Intelligence.md` — definición normativa de producto, evidencia, taxonomía, relevancia, UX y ejemplos.
2. `Nivel_BRAMU_Formula_V1.5.md` — autoridad vigente para Nivel, expectativa, confianza, elegibilidad, snapshots y delta.
3. `Ranking_BRAMU.md` — autoridad vigente para Ranking semanal, universos, elegibilidad, densidad y movimiento publicado.
4. `Backend_Infraestructura.md` — autoridad para persistencia, identidad, seguridad, server-side y entornos.
5. `Referencias/BRAMU_Intelligence_IA_Generativa_Evaluacion_2026.md` — proveedor, costos, privacidad y contingencia de la capa generativa.

`Nivel_BRAMU_Formula_V1.4.md` es antecedente histórico. El motor de partidos que Intelligence consume sigue siendo `nivel_bramu_v1_0`, pero la fuente normativa vigente es V1.5.

---

## 2. Arquitectura cerrada

BRAMU Intelligence debe funcionar así:

1. calcular hechos verificables;
2. determinar comparaciones válidas;
3. generar candidatos de insight;
4. descartar los débiles/no sustentados;
5. ordenar por relevancia;
6. seleccionar un principal y hasta dos secundarios;
7. redactar con plantillas siempre disponibles;
8. opcionalmente mejorar redacción con una capa generativa;
9. validar cualquier salida generativa contra claims/valores permitidos;
10. guardar la salida y su evidencia; no regenerarla al abrir una pantalla.

La IA generativa **no** calcula hechos, no decide Nivel, no decide Ranking y no modifica prioridades.

---

## 3. Contrato de evidencia

Cada insight visible debe derivar de un objeto estructurado que conserve como mínimo:

- tipo/familia;
- jugador de perspectiva;
- claim estructurado;
- valores usados;
- partidos fuente;
- alcance de comparación;
- tamaño de muestra;
- nivel de confianza;
- alcance personal/oficial;
- relevancia;
- clave semántica;
- plantilla;
- versión de reglas;
- fecha de corte;
- estado y motivo de descarte/fallback cuando corresponda.

La frase visible nunca es la fuente de verdad.

---

## 4. Límites no negociables

Con carga manual, Intelligence no puede inventar:

- desarrollo punto a punto/game a game;
- quiebres/holds/puntos de oro;
- winners, errores o golpes;
- técnica/táctica individual;
- cansancio, presión, confianza o estados emocionales;
- causalidad del resultado;
- desempeño aislado de un jugador dentro de la pareja.

Historia personal e impacto oficial son alcances distintos. Un partido puede aportar contexto personal aunque no sea computable para Nivel/Ranking.

---

## 5. Dependencia de Nivel BRAMU

Intelligence consume snapshots guardados; nunca recalcula el pasado con niveles actuales.

Puede usar, cuando exista evidencia suficiente:

- Nivel previo;
- confianza/calibración;
- fuerza de parejas;
- expectativa previa;
- delta posterior;
- `reasonCodes`.

Reglas centrales vigentes:

- expectativa 45–55%: partido equilibrado; no produce insight de dificultad por sí sola;
- desde 65%: puede explicar un delta pequeño por resultado favorable esperado;
- con tres niveles conocidos: lenguaje acotado;
- con dos niveles conocidos o niveles aún calibrando: no clasificar dificultad como sorpresa/desafío fuerte;
- no mostrar porcentajes de expectativa en la tarjeta principal;
- no recalcular expectativa con niveles actuales.

Los umbrales exactos y excepciones se toman de `BRAMU_Intelligence.md` y V1.5, no se duplican en UI.

---

## 6. Dependencia de Ranking BRAMU

Ranking vigente es **semanal**.

Por lo tanto, Intelligence no debe generar “subiste X puestos por este partido” inmediatamente después de guardar/validar un encuentro.

Los hitos de Ranking pueden aparecer solo cuando existe una **nueva edición semanal publicada** y el cambio es material/verificable dentro del mismo universo comparable.

Casos habilitados por la definición vigente, cuando corresponda:

- primera entrada a un Ranking establecido;
- entrada al top 10;
- nueva mejor posición material;
- ascenso material de puestos;
- cambio de banda pública de Nivel, tratado como hito de Nivel.

La redacción debe reconocer que otros jugadores también alteran posiciones. No atribuir causalmente un movimiento semanal a un único partido.

---

## 7. Detectores V1

Construir, de forma determinística y testeable:

1. reversión después de perder el primer set;
2. rachas, récords y cortes;
3. forma reciente;
4. primer partido / primera victoria / balance con compañero;
5. primer cruce y balance frente a rivales/pareja rival;
6. primer triunfo luego de antecedentes negativos suficientes;
7. hitos acumulativos y récords con muestra mínima;
8. score excepcional dentro de formatos comparables;
9. expectativa/calibración/evidencia/variación de Nivel;
10. hitos materiales de Ranking semanal.

No agregar recomendaciones técnicas ni datos manuales obligatorios nuevos.

---

## 8. Selección editorial

Mantener el principio de V1:

- seleccionar por excepcionalidad, relevancia personal, especificidad, confianza, actualidad y novedad;
- penalizar repetición de score visible, historias duplicadas y familias/plantillas demasiado recientes;
- descartar candidatos que fallen evidencia, identidad, comparabilidad u oficialidad;
- salida máxima: **1 principal + hasta 2 secundarios**;
- no completar espacios si no hay evidencia suficiente.

La prioridad editorial exacta vive en `BRAMU_Intelligence.md`.

---

## 9. Capa generativa opcional

Puede:

- variar redacción;
- hacer el tono más natural;
- fusionar claims compatibles ya seleccionados;
- adaptar longitud.

No puede agregar claims/números/entidades.

Payload seudonimizado: placeholders y solo valores necesarios. No enviar nombre completo, email, teléfono, fecha de nacimiento, foto, ubicación exacta, auth ID, notas libres ni historial crudo.

Proveedor inicial previsto: Cloudflare Workers AI / Qwen3 30B A3B. Alternativa: Groq / GPT-OSS 20B con Zero Data Retention, sujeto a la evaluación vigente en `Referencias/`.

Siempre debe existir fallback inmediato a plantillas. Apagar IA no apaga BRAMU Intelligence.

---

## 10. Bloques de implementación

### A — Datos y derivados

Identidad estable, partido, fecha real, formato/score, historia personal vs oficial, rachas/forma/relaciones.

### B — Claims y evidencia

Familias V1, comparabilidad, tamaños de muestra, objeto de insight y fixtures.

### C — Relevancia y memoria editorial

Puntaje, deduplicación, cooldowns y abstención.

### D — Plantillas y UX

Principal, secundarios, `Por qué aparece`, estados de aprendizaje y fallback.

### E — Integración Nivel + Ranking

Consumir snapshots/reasonCodes de Nivel y ediciones semanales de Ranking sin recalcularlos.

### F — Generación opcional

Backend seguro, proveedor desacoplado, validador, caché, presupuesto y modo sombra antes de activación pública.

Estos bloques son orden de construcción/prueba, no seis experiencias diferentes para el usuario.

---

## 11. Pruebas mínimas antes de activar

Mantener el banco amplio definido en `BRAMU_Intelligence.md`, incluyendo:

- poco/mucho historial;
- cargas fuera de orden;
- relaciones y nombres corregidos;
- formatos distintos;
- rachas/cortes/récords;
- partidos sin nada excepcional;
- estados pendientes/disputados/observados/fuera de término;
- niveles conocidos/parciales/calibrando;
- ediciones de Ranking semanales;
- correcciones/anulaciones.

Criterio absoluto: **0 números incorrectos, 0 entidades inventadas, 0 acciones no registradas, 0 claims sin evidencia** en fixtures determinísticos.

Si la capa generativa no supera el benchmark, V1 debe poder salir con plantillas sin reabrir el producto.

---

## 12. Próxima acción correcta

No implementar Intelligence antes de tener los datos/identidades/persistencia que exige su contrato.

Cuando llegue su etapa:

1. revisar `Backend_Infraestructura.md` ya implementado o en condiciones de soportar identidad/partidos compartidos;
2. consumir Nivel V1.5 desde snapshots oficiales;
3. consumir Ranking desde ediciones semanales publicadas;
4. construir primero motor determinístico + fixtures;
5. recién después integrar UX y capa generativa opcional.

No volver a investigar desde cero la definición de BRAMU Intelligence salvo que producto decida reabrirla explícitamente.
