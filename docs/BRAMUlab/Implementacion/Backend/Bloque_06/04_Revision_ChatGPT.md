# Backend Bloque 6 — Revisión central de análisis y plan

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `f9bec89`  
**Documentos revisados:** `02_Analisis_Claude.md` + `03_Plan_Implementacion_Claude.md`  
**Resultado:** **APROBADO CON AJUSTES OBLIGATORIOS antes/durante implementación**

El análisis de Claude es sólido en lo central: reutiliza correctamente el motor de Nivel ya existente, el patrón Edge Function → motor JS compartido → RPC privada transaccional y la infraestructura heredada de Bloques 3–5. No hace falta rediseñar la arquitectura.

Los siguientes puntos corrigen o precisan el plan.

---

## 1. Decisión abierta #1 — RESUELTA por precedencia documental

No queda abierta.

La fuente normativa de Nivel es `Nivel_BRAMU_Formula_V1.5.md`. Su §12.2 dice que un partido manual debe completar carga/asociación/validación dentro de los **30 días desde la fecha real de juego** para afectar Nivel, y §13 explicita:

- historial: sí;
- Nivel: no;

para un partido cargado o validado fuera de esa ventana.

Por lo tanto:

- Bloque 5 conserva sus reglas operativas:
  - carga retroactiva máxima 14 días;
  - pendiente hasta 30 días desde la carga;
- un partido puede llegar a quedar `validated` después del día 30 desde `played_at`;
- si `validated_at - played_at > 30 días`, sigue siendo partido oficial de historial/estadísticas, pero **NO produce efecto de Nivel**.

No reabrir Bloque 5.

Bloque 6 debe modelar esta diferencia de forma explícita y auditable, idealmente con un reasonCode/resultado de elegibilidad ya derivado del motor, sin inventar un nuevo estado global de partido.

Además, el adaptador server-side debe corregir la interpretación vieja de `level-context.js` que hoy usa `createdAt-playedAt` para esa ventana. Para el camino server-backed la elegibilidad temporal debe usar `validated_at-played_at` según la fórmula normativa.

---

## 2. Decisión abierta #2 — APROBADA con precisión temporal

Se adopta la recomendación de Claude:

> al reemplazar un participante después de validar, usar el estado histórico que ese participante correcto tenía en el momento de la oficialización original, no su Nivel actual al resolver la incidencia.

Precisión:

- debe reconstruirse el estado **inmediatamente anterior a la oficialización original de ese partido**;
- no alcanza con “último evento con created_at <= validated_at” si puede haber dos eventos con timestamps equivalentes;
- la reconstrucción debe tener orden determinístico (timestamp + identificador/orden de evento o snapshot explícito);
- si no existe un estado de Nivel válido para ese jugador en ese momento, se lo trata como participante sin Nivel conocido, aplicando las reglas de imputación/disponibilidad V1.5.

No usar su Nivel actual.

---

## 3. Incidencia de identidad post-validación — corregir alcance de la reversión

El análisis dice que al abrir una incidencia sobre un partido `validated` se revierte “el efecto de Nivel que ese slot había recibido”.

Eso es insuficiente.

La composición de los cuatro jugadores afecta:

- fuerza de pareja;
- expectativa;
- disponibilidad/imputación;
- confianza rival;
- repetición;
- compañero;
- círculo competitivo;
- deltas de los demás jugadores.

Por lo tanto, una identidad incorrecta puede invalidar **el cálculo completo de Nivel de ese partido**, no solo el delta del jugador mal identificado.

Regla para implementación:

1. abrir incidencia post-validación;
2. retirar inmediatamente la identidad incorrecta del slot;
3. **suspender/revertir el efecto completo de Nivel de ese partido** de forma atómica;
4. mientras la incidencia está abierta, no mantener deltas basados en una composición conocida como incorrecta;
5. si se identifica al jugador correcto dentro de 7 días, recalcular y reaplicar el partido completo con los snapshots temporales correctos;
6. si vence sin resolución, el slot queda no identificado y se evalúa el partido con las reglas V1.5 para nivel ausente:
   - si sigue siendo computable, se reaplica el efecto válido para los jugadores conocidos;
   - si no cumple elegibilidad, queda sin efecto de Nivel.

El resultado deportivo puede seguir siendo oficial durante todo el proceso, como define `Experiencia_Inicial.md`.

---

## 4. Ocultar partido NO puede cambiar estadísticas ni Nivel

Bloque 5 cerró una invariancia importante:

> ocultar es solo visual/personal; un partido `validated` oculto sigue teniendo todos sus efectos oficiales.

El plan de Checkpoint 5 propone usar `get_my_matches` como feed de estadísticas y señala que esa RPC ya filtra ocultos. Eso puede reintroducir el bug que Bloque 5 ya corrigió.

Obligatorio:

- el feed computable/oficial debe incluir partidos validados aunque estén ocultos para el usuario;
- la capa de display filtra `hidden`;
- la capa computable NO los filtra.

Antes de agregar `p_only_validated`, auditar y reutilizar la separación ya existente:

- `buildDisplayHistory`;
- `buildComputableHistory`;
- cache server con `includeHidden:true`.

Agregar un parámetro/RPC nueva solo si realmente hace falta.

---

## 5. Estadísticas oficiales — preferir reutilización antes que API nueva

Bloque 5 ya dejó preparado que el historial computable consuma únicamente server matches `validated` y mantenga ocultos computando.

Por eso Checkpoint 5 debe empezar por verificar si, al existir por primera vez partidos `validated` reales, el wiring actual ya alimenta correctamente `stats.js`.

Orden recomendado:

1. probar el camino vigente;
2. corregir solo lo que falte;
3. agregar `p_only_validated` únicamente si resuelve un problema real no cubierto.

No crear una segunda vía de datos innecesaria.

---

## 6. “Jugador no identificado” — mantener modelo simple y coherente

Se aprueba:

- `match_participants.player_id = NULL`;
- no crear un player/provisional fantasma;
- tabla separada de incidencias.

Pero evitar un estado persistido que después nunca se escribe.

Si el vencimiento de 7 días será lógico/lazy, elegir una sola convención:

- o el estado terminal se **deriva** de `opened_at + 7 días`;
- o una operación server-side idempotente lo materializa como `unidentified` cuando se detecta vencimiento.

No dejar simultáneamente “status = open para siempre” y “status enum contiene unidentified” sin una regla clara.

---

## 7. Notificaciones y expiraciones lógicas

El plan usa expiración lógica sin cron, lo cual es aceptable para el piloto.

Pero una notificación persistida de “partido expirado” o un aviso de deadline no puede depender mágicamente de un evento que nadie ejecuta.

Definir explícitamente uno de estos patrones simples:

- derivar avisos temporales al leer;
- o materializar idempotentemente la notificación en la primera lectura/acción posterior al vencimiento.

No agregar cron solo para esto.

---

## 8. Comando administrativo — NO convertir a Seba en operador

Se aprueba el comando administrativo mínimo y el patrón `service_role`-only.

Corrección de operación:

- el script puede existir en repo para trazabilidad/uso autorizado;
- **no planificar que Sebastián lo ejecute manualmente ni que gestione una service-role key**;
- cuando haga falta, debe ejecutarlo un agente/herramienta autorizada desde un entorno seguro;
- nunca pedirle que pegue secretos en chat.

---

## 9. Checkpoints internos ≠ nueve intervenciones humanas

Los nueve checkpoints del plan pueden conservarse como control técnico interno.

Pero no deben transformarse en:

- nueve handoffs;
- nueve aprobaciones de Sebastián;
- nueve idas y vueltas entre chats.

Objetivo de ejecución:

### Fase técnica A — Claude Code
Implementar de forma autónoma los checkpoints backend/core, haciendo sus verificaciones internas y deteniéndose solo ante:
- una DECISIÓN ABIERTA nueva y material;
- un bloqueo técnico real;
- una autorización sensible.

### Fase central
ChatGPT revisa diff/migraciones/functions/tests y aplica/valida en Supabase Staging cuando corresponda.

### Fase técnica B
Frontend/wiring final.

### Fase QA real / Staging
Work valida únicamente los recorridos de navegador que agregan evidencia nueva.

Sebastián debería intervenir principalmente como puente de un mensaje corto entre agentes y para la revisión visual/producto final.

---

## 10. Rutina compartida de oficialización

Se aprueba que los dos triggers:

- `Confirmar`;
- segunda carga rival coincidente con `readyForValidation=true`;

terminen en el mismo núcleo.

Preferencia técnica:

- extraer/importar una rutina compartida reutilizable por las Edge Functions;
- evitar, si no es necesario, una llamada HTTP Edge→Edge hacia el mismo backend solo para reutilizar lógica.

El objetivo es un solo cálculo/un solo contrato, no dos implementaciones parecidas.

---

## 11. Concurrencia corrección + identidad

Se aprueba la recomendación de serializar ambos caminos y **no permitir aceptar una corrección de resultado mientras exista una incidencia de identidad abierta sobre el mismo partido**.

Resolver primero identidad; después resultado.

Esto reduce riesgo de doble reversión y no contradice ninguna fuente maestra.

---

## 12. Cobertura adicional obligatoria

Agregar al plan/tests:

1. partido `validated` oculto sigue contando en Nivel/estadísticas;
2. partido validado entre día 31 y 44 desde `played_at`:
   - historial/estadísticas oficiales sí;
   - Nivel no;
3. incidencia de identidad post-validación revierte el **efecto completo del partido**, no solo un jugador;
4. resolución de identidad recalcula los 4 slots;
5. vencimiento sin identidad:
   - recomputa con slot desconocido si V1.5 lo permite;
   - o queda no computable;
6. corrección de resultado bloqueada mientras haya incidencia de identidad abierta;
7. reconstrucción histórica del jugador correcto con orden determinístico alrededor de `validated_at`.

---

## 13. Resultado de revisión

Con estos ajustes:

- arquitectura general: **APROBADA**;
- tablas propuestas: **APROBADAS con simplificación de estado lazy a definir en implementación**;
- patrón Edge + motor JS + RPC transaccional: **APROBADO**;
- `match_level_results`: **APROBADA**;
- `match_identity_issues`: **APROBADA**;
- notificaciones internas: **APROBADAS**;
- admin mínimo: **APROBADO**;
- plan de implementación: **APROBADO CON LOS AJUSTES DE ESTE DOCUMENTO**.

No queda ninguna decisión de producto que requiera intervención de Sebastián antes de implementar.

Claude debe actualizar `02_Analisis_Claude.md` / `03_Plan_Implementacion_Claude.md` para reflejar esta revisión y puede continuar con implementación técnica autorizada en `staging`, sin tocar Supabase/Vercel reales hasta revisión/aplicación central salvo instrucción posterior.
