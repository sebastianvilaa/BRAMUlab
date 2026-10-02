# HANDOFF FINAL — Nivel BRAMU: estimador inicial universal V1.3

**Fecha:** 2 de octubre de 2026  
**Repositorio:** `sebastianvilaa/BRAMUlab`  
**Rama de referencia investigada:** `staging`  
**Destino:** ChatGPT Central  
**Estado:** definición de producto e investigación cerradas; **no implementado**

---

## 1. Mandato para Central

Coordinar la implementación de un nuevo estimador inicial de Nivel BRAMU, identificado como `nivel_inicial_v1_3`, siguiendo exactamente este documento.

Esta investigación no produjo commits, pushes, migraciones ni modificaciones de datos. Antes de implementar, Central debe verificar que el trabajo paralelo de V04.24 haya finalizado o coordinar una integración sin colisiones.

### No tocar

- El motor posterior de partidos `nivel_bramu_v1_0`.
- La condición de cierre de calibración: 5 partidos y al menos 3 rivales distintos.
- Ranking.
- Grupos.
- BRAMUlive.
- `main` ni Production hasta completar implementación y QA en Staging.
- Cuentas existentes, niveles actuales, historial ni datos de partidos.
- No aplicar ajustes, bonificaciones o penalizaciones por género.
- No crear escalas masculina y femenina.
- No preguntar categoría competitiva ni rendimiento contra hombres/mujeres.

---

## 2. Problema detectado

El estimador inicial V1.2 depende demasiado de una autoetiqueta relativa al entorno del jugador. Dos personas con capacidad deportiva diferente pueden considerarse honestamente “Intermedio alto” porque se comparan con grupos distintos. Esto impide garantizar que un mismo número represente aproximadamente la misma capacidad deportiva universal.

El problema no es que una persona necesariamente mienta. La etiqueta puede ser sincera y, aun así, estar mal anclada para una escala universal.

### Caso real que disparó la investigación

Caso de Staging desidentificado:

- Origen: cuestionario completo V1.2.
- Resultado inicial y actual: **5,405**.
- Confianza: **0,15**.
- Partidos computados: **0**.
- Respuestas: autoevaluación “Intermedio alto”; red C; paredes C; entrenamiento regular en el pasado; experiencia 1–5 años; frecuencia 1–2 veces por semana.

Fórmula exacta aplicada:

```text
0,65 × 5,5 + 0,35 × ((5,0 + 5,0) / 2) + 0,08 = 5,405
```

La percepción humana externa situaba a esta persona alrededor de 4,0–4,5. Esa percepción no constituye un “nivel verdadero” registrado por BRAMU, pero permitió detectar que las respuestas observables sobre ritmo, red y paredes no justificaban que una única etiqueta subjetiva dominara el resultado.

### Sensibilidad comprobada en V1.2

Manteniendo todas las demás respuestas idénticas:

| Autoevaluación | Nivel inicial |
|---|---:|
| Intermedio | 4,430 |
| Intermedio alto | 5,405 |
| Avanzado | 6,380 |

- Pasar de “Intermedio” a “Intermedio alto” mueve **+0,975**.
- Pasar de “Intermedio alto” a “Avanzado” mueve **+0,975**.
- Cambiar una sola respuesta técnica de C a B mueve únicamente **−0,35**.

Conclusión: la autoetiqueta tiene una influencia desproporcionada frente a las señales deportivas concretas.

---

## 3. Diagnóstico de V1.2

### Fórmula anterior

```text
technical = (red + walls) / 2
initial_level = clamp(0,65 × self_assessment + 0,35 × technical + training_modifier)
```

Anclas de autoevaluación:

```text
2,0 / 4,0 / 5,5 / 7,0 / 8,5
```

Anclas técnicas A–E:

```text
1,0 / 3,0 / 5,0 / 6,5 / 8,5
```

Modificador por entrenamiento:

```text
0,00 a +0,10
```

Confianza de origen del flujo completo:

```text
0,12 / 0,15 / 0,18 según años y frecuencia
```

El modo rápido utilizaba confianza 0,10. Una brecha de coherencia igual o mayor a 2,0 limitaba la confianza a 0,10.

### Conclusiones del diagnóstico

1. Existe un problema real de diseño del estimador; no puede explicarse solamente como una autoevaluación exagerada.
2. El 65% de peso de la autoevaluación es excesivo porque la señal principal usa etiquetas relativas.
3. “Intermedio”, “Intermedio alto” y “Avanzado” cambian de significado según género, ciudad, circuito, categoría y grupo habitual.
4. Años, frecuencia y entrenamiento son señales débiles de capacidad actual: explican exposición, no ejecución deportiva.
5. Red y paredes son dimensiones útiles, pero las preguntas anteriores no medían suficientemente qué sucede al aumentar ritmo y presión.
6. No hace falta preguntar por fuerza o “pegar más fuerte”. En niveles superiores la diferencia observada está en sostener ritmo, posiciones, decisiones y control con menos entregas evitables.

---

## 4. Calibración posterior: qué corrige y qué no

El motor vigente usa, entre otros elementos:

```text
K = 0,10 + 0,30 × (1 − confidence)
effective_level = 5 + confidence × (mu − 5)
```

### Simulaciones exactas con el motor vigente

#### Jugador sobreestimado en 5,405, cinco derrotas claras y evidencia diversa

```text
5,405 → 5,215 → 5,045 → 4,894 → 4,759 → 4,639
```

Después de diez derrotas consecutivas: aproximadamente **4,198**.

#### Mismos compañeros y rivales repetidos

Por descuentos de repetición y compañero:

```text
5 derrotas: 4,864
10 derrotas: 4,682
```

#### Cinco partidos con 3 derrotas y 2 victorias

Resultado aproximado: **5,107**.

#### Partido mixto simétrico

Dos parejas con un jugador cercano a 5,9/6,0 y una jugadora sobreestimada en 5,405 en cada lado; diez resultados alternados:

- Jugadora A: **5,424**.
- Jugadora B: **5,386**.
- Confianza de ambas: **0,782**.

Los errores simétricos se cancelan y la confianza aumenta sin corregir el anclaje.

#### Círculo cerrado

Ocho jugadores, veinte partidos internos:

- Media inicial del grupo: **5,300**.
- Media final: **5,302**.
- Confianza media final: **0,642**.

El motor ordena diferencias internas, pero no puede descubrir por sí solo que todo el grupo está desplazado respecto de la escala universal.

#### Bajar la confianza inicial no resuelve el problema

Movimiento del primer partido perdido:

| Confianza inicial | Delta aproximado |
|---:|---:|
| 0,10 | −0,1965 |
| 0,12 | −0,1938 |
| 0,15 | −0,1898 |
| 0,18 | −0,1857 |

La diferencia es demasiado pequeña para compensar un mal anclaje inicial.

### Decisión

Mantener sin cambios el motor `nivel_bramu_v1_0` y el cierre en 5 partidos/3 rivales. La solución debe mejorar el punto inicial, no alargar artificialmente la calibración ni aumentar volatilidad.

---

## 5. Nuevo estimador inicial V1.3

### Versiones

- **REEMPLAZAR:** `questionnaire_version = nivel_inicial_v1_2` por `nivel_inicial_v1_3` para nuevos cuestionarios.
- **MANTENER:** `algorithm_version = nivel_bramu_v1_0` para el motor de partidos.
- Conservar la versión histórica de cada registro; no sobrescribir registros V1.2.

### Cambios de producto

- **ELIMINAR** completamente el camino rápido.
- **REEMPLAZAR** ambos caminos por un único cuestionario adaptativo de cinco preguntas.
- **ELIMINAR** del cálculo: autoetiqueta, años, frecuencia y entrenamiento.
- **NO MOSTRAR** categorías como principiante/intermedio/avanzado.
- **MOSTRAR** solamente el número y el estado `Calibrando`.
- Cinco dimensiones con el mismo peso: panorama general, control/ritmo, ataque/red, defensa/paredes y decisiones/consistencia.

---

## 6. UX del cuestionario

### Introducción aprobada

> Pensá en cómo jugás habitualmente, no en tu mejor ni en tu peor partido. Cuanto más realista seas, mejor será tu punto de partida.

### Componente de respuesta

Cada pregunta muestra cuatro descripciones visibles, A–D, conectadas por un slider discreto de diez posiciones:

```text
A · A+⅓ · A+⅔ · B · B+⅓ · B+⅔ · C · C+⅓ · C+⅔ · D
```

Las letras son una notación interna y no tienen que mostrarse como categoría de nivel. En UI, cada extremo/texto debe poder leerse y el control debe permitir elegir los dos puntos intermedios entre descripciones.

Copy auxiliar sugerido:

> Mové el control hasta la descripción que más se parezca a tu juego. También podés dejarlo entre dos opciones.

### Comportamiento adaptativo

- La pregunta 1 es común.
- Antes de cada pregunta 2–5 se calcula la media de los valores ya respondidos.
- Esa media selecciona una rama baja, media o alta para la pregunta siguiente.
- La rama es interna; nunca se comunica como categoría al usuario.
- Si el usuario vuelve atrás y cambia una respuesta y eso altera la rama, **borrar las respuestas posteriores afectadas y volver a preguntarlas**. Nunca reutilizar una posición del slider con textos pertenecientes a otra rama.
- Volver atrás o cambiar una respuesta no reduce confianza.

---

## 7. Banco definitivo de preguntas

### P1 — Panorama general (común)

**Pregunta:** ¿Qué describe mejor tu juego durante un partido habitual?

- **A:** Estoy aprendiendo a ubicarme y a sostener varios golpes seguidos.
- **B:** Sostengo intercambios cómodos; cuando aumenta el ritmo pierdo control u orden.
- **C:** Construyo el punto y utilizo distintos recursos; bajo presión todavía me apuro o dejo una pelota fácil.
- **D:** Sostengo un ritmo alto, buenas posiciones y decisiones; normalmente el rival debe construir el punto para superarme.

### P2 — Control y ritmo

#### Rama baja

- **A:** Me cuesta devolver tres pelotas seguidas aunque lleguen cómodas.
- **B:** Sostengo intercambios cortos a ritmo lento; al moverme o dirigir la pelota pierdo control.
- **C:** Sostengo pelotas cómodas con dirección; la velocidad o profundidad me obliga a devolver fácil.
- **D:** Resuelvo varias pelotas exigentes y recupero mi posición, todavía de manera irregular.

#### Rama media

- **A:** Controlo la pelota a ritmo cómodo; cuando aceleran llego tarde o dejo una pelota fácil.
- **B:** Sostengo un ritmo medio y recupero la posición; si la presión continúa, pierdo dirección o profundidad.
- **C:** Mantengo dirección y profundidad a ritmo alto en la mayoría de las jugadas; una pelota difícil todavía puede dejarme defendiendo.
- **D:** A ritmo alto llego equilibrado, neutralizo la presión y puedo elegir la respuesta.

#### Rama alta

- **A:** Sostengo el ritmo alto, pero la presión repetida termina reduciendo mi profundidad o control.
- **B:** Mantengo profundidad y posición a ritmo alto; una defensa extrema todavía puede dejar una oportunidad cómoda.
- **C:** Absorbo cambios de velocidad, recupero la posición y obligo al rival a sostener la presión.
- **D:** Frente al ritmo máximo anticipo, neutralizo y puedo transformar la defensa en iniciativa.

### P3 — Ataque y red

#### Rama baja

- **A:** Me cuesta ubicarme y controlar la volea, incluso con pelotas cómodas.
- **B:** Devuelvo voleas simples, pero pierdo la posición o quedo superado por el globo.
- **C:** Sostengo la red en intercambios lentos con mi compañero; la presión me obliga a retroceder o dejar una pelota fácil.
- **D:** Utilizo la volea o la bandeja para conservar la red, todavía de manera irregular.

#### Rama media

- **A:** Controlo voleas cómodas; con velocidad o presión pierdo la posición.
- **B:** Sostengo la red y uso la volea o la bandeja; a veces acelero desde una posición desfavorable.
- **C:** Me coordino con mi compañero, conservo la red y elijo una pelota favorable para acelerar.
- **D:** Varío dirección y ritmo, recupero la red después del globo y mantengo la iniciativa bajo presión.

#### Rama alta

- **A:** Controlo la posición; la presión sostenida todavía puede hacerme dejar una pelota cómoda o perder la red.
- **B:** Uso la volea y la bandeja para sostener la posición y recupero la red después del globo; a veces me precipito al definir.
- **C:** Varío direcciones y ritmos, elijo cuándo acelerar y mantengo la iniciativa bajo presión.
- **D:** A velocidad máxima anticipo las respuestas y transformo situaciones difíciles en ataques controlados.

### P4 — Defensa y paredes

#### Rama baja

- **A:** Intento jugar antes de la pared porque todavía no interpreto bien el rebote.
- **B:** Resuelvo rebotes simples y lentos de fondo; suelo llegar tarde o calcular mal.
- **C:** Utilizo la pared de fondo en situaciones habituales; la velocidad o los rebotes laterales me complican.
- **D:** Utilizo paredes de fondo y laterales para continuar el punto; todavía pierdo control en rebotes complejos.

#### Rama media

- **A:** Resuelvo el rebote simple; una pelota rápida, profunda o lateral suele dejarme fuera de posición.
- **B:** Utilizo las paredes de fondo y laterales en situaciones habituales; los rebotes complejos me obligan a devolver fácil.
- **C:** Anticipo paredes simples y dobles, recupero la posición y normalmente mantengo una defensa neutral.
- **D:** Uso las paredes para quitar velocidad, soportar la presión y convertir una defensa difícil en una pelota controlada.

#### Rama alta

- **A:** Controlo los rebotes habituales; una pelota muy profunda o compleja todavía puede dejarme defendiendo corto.
- **B:** Anticipo paredes dobles y sostengo la defensa con velocidad; las situaciones extremas pueden hacerme perder control.
- **C:** Uso las paredes para neutralizar la presión, recuperar la posición y convertir una defensa difícil en una pelota controlada.
- **D:** A velocidad máxima resuelvo rebotes complejos y transformo defensas extremas en contraataques sin perder la posición.

### P5 — Decisiones y consistencia

#### Rama baja

- **A:** Me concentro en devolver la pelota, sin una idea clara de dónde jugar o cómo ubicarme.
- **B:** Conozco ideas como subir a la red o tirar un globo; reacciono tarde o intento atacar una pelota desfavorable.
- **C:** Intento construir el punto y moverme con mi compañero; cuando se prolonga pierdo el orden.
- **D:** Reconozco cuándo defender, reconstruir o atacar; todavía me cuesta ejecutarlo durante todo el partido.

#### Rama media

- **A:** Entiendo la jugada, pero intento resolverla rápido y suelo entregar la iniciativa.
- **B:** Alterno momentos ordenados con otros en los que ataco desde una posición desfavorable.
- **C:** Construyo con paciencia y espero una pelota favorable; si la presión continúa, puedo perder el orden.
- **D:** Mantengo el plan, recupero posiciones y adapto mis decisiones durante todo el partido.

#### Rama alta

- **A:** Construyo bien; la presión sostenida termina haciéndome perder profundidad, dirección o iniciativa.
- **B:** Conservo el orden, elijo una respuesta segura y espero una pelota favorable; ocasionalmente dejo una oportunidad cómoda.
- **C:** Administro ritmos y direcciones, anticipo la jugada y normalmente obligo al rival a construir para superarme.
- **D:** Mantengo lectura y calidad frente a presión extrema durante todo el partido, neutralizando o aprovechando situaciones difíciles.

---

## 8. Fórmula exacta V1.3

### Anclas internas

| Rama | A | B | C | D |
|---|---:|---:|---:|---:|
| P1 común | 1,8 | 3,8 | 5,8 | 7,2 |
| Baja | 1,5 | 2,8 | 3,8 | 4,6 |
| Media | 3,3 | 4,2 | 5,2 | 6,2 |
| Alta | 5,7 | 6,3 | 7,0 | 8,8 |

### Interpolación del slider

Representar cada posición como `p ∈ {0,…,9}`. Para un vector de anclas `a = [A,B,C,D]`:

```text
si p = 9: value = D
si no:
  segment = floor(p / 3)
  fraction = (p mod 3) / 3
  value = a[segment] + fraction × (a[segment + 1] − a[segment])
```

### Selección de rama

Después de cada respuesta, calcular la media de los valores ya obtenidos:

```text
running_mean < 4,1       → rama baja
4,1 ≤ running_mean < 6,4 → rama media
running_mean ≥ 6,4       → rama alta
```

### Resultado inicial

```text
initial_level = clamp((v1 + v2 + v3 + v4 + v5) / 5, 1,0, 9,0)
```

- Cada dimensión pesa exactamente **20%**.
- Guardar con precisión interna de cuatro decimales.
- Mostrar con un decimal en las superficies de producto previstas.
- No agregar modificadores por género, entrenamiento, frecuencia, años ni categoría.

### Confianza inicial

```text
spread = max(v1…v5) − min(v1…v5)

si spread < 2,0  → origin_confidence = 0,15
si spread ≥ 2,0  → origin_confidence = 0,10
```

Cuando la dispersión sea igual o mayor a 2,0, ofrecer revisar las respuestas antes de confirmar, pero no bloquear la finalización. La confianza no se muestra como juicio al usuario; solo controla cuánto puede corregir el motor posteriormente.

---

## 9. Validación cualitativa y contrafactuales

Se simularon seis perfiles conocidos, sin afirmar que sus referencias humanas sean niveles verdaderos registrados por BRAMU.

Resultados de ajuste del prototipo V1.3:

| Perfil desidentificado | Referencia humana aproximada | Resultado V1.3 |
|---|---:|---:|
| Principiante | 3,0–3,5 | 2,98 |
| Caso real que disparó #25 | ~4,5 | 4,72 |
| Desarrollo medio | 4,9–5,0 | 5,05 |
| Intermedio competitivo 1 | ~5,7–5,8 | 5,65 |
| Intermedio competitivo 2 | ~5,9–6,0 | 5,95 |
| Avanzado amateur | ~6,9–7,0 | 6,81 en validación final |

Orden relativo obtenido:

```text
Principiante < Caso #25 < Desarrollo medio < Intermedio 1 < Intermedio 2 < Avanzado amateur
```

La validación final del caso #25 y del perfil avanzado utilizó las respuestas tal como esas personas probablemente se describirían, no la evaluación externa del observador. Esto es importante: el nuevo cuestionario reduce el sesgo aun cuando la persona responde honestamente desde su propia percepción.

Sensibilidad esperada de un solo paso intermedio del slider sobre el resultado final: aproximadamente **0,04–0,13**, según rama y segmento. Ya no existe una única elección subjetiva capaz de mover casi un punto por sí sola.

### Batería mínima obligatoria de contrafactuales automatizados

1. Mantener cuatro respuestas fijas y mover P1 un solo paso; verificar cambio acotado.
2. Mover cada pregunta, de a una, por los diez puntos del slider y comprobar monotonicidad.
3. Probar exactamente los umbrales 4,1 y 6,4.
4. Cambiar una respuesta anterior de modo que cambie la rama; verificar que las posteriores se invaliden.
5. Responder todos los mínimos y todos los máximos; verificar clamp y ausencia de NaN.
6. Respuestas coherentes con spread 1,9999 y 2,0000; verificar confianza 0,15 y 0,10 respectivamente.
7. Confirmar que años, frecuencia, entrenamiento, género y categoría no alteran el resultado.
8. Confirmar que no existe camino rápido accesible por UI, URL, estado previo ni función interna activa.

---

## 10. Evidencia descriptiva de Staging

Se revisaron 17 estimaciones/estados recientes, todos desidentificados. Entre ocho cuentas con al menos cuatro partidos computados:

- Partidos: 4 a 32.
- Deriva mínima: −0,363.
- Deriva máxima: +0,276.
- Deriva media: −0,008.
- Mediana: +0,034.

Actualizaciones durante calibración:

- `n = 46`.
- Delta absoluto medio: 0,091.
- Rango aproximado por actualización: −0,122 a +0,125.
- Evidencia media: 0,563.

Actualizaciones consolidadas:

- `n = 90`.
- Delta absoluto medio: 0,038.

Esta muestra es pequeña, incluye actividad de QA/Staging y no contiene un nivel verdadero externo. Solo permite describir comportamiento; no autoriza conclusiones estadísticas fuertes ni cambios de motor.

---

## 11. Cuentas existentes y despliegue

- **NO MIGRACIÓN de niveles.**
- **NO RESET de cuentas.**
- **NO recalcular automáticamente** jugadores creados con V1.2.
- Una cuenta que ya posee nivel inicial, esté calibrando o consolidada, continúa exactamente desde su estado actual.
- Registrar y preservar `questionnaire_version` para distinguir V1.2 de V1.3.
- V1.3 se aplica a cuestionarios nuevos iniciados después del despliegue.
- Si técnicamente existe un cuestionario V1.2 incompleto persistido, reiniciar únicamente ese cuestionario incompleto bajo V1.3; no alterar cuentas que ya confirmaron un nivel. Central debe comprobar primero si ese estado parcial existe.
- Implementar y validar primero en Staging. No promover a Production dentro de esta tarea sin autorización posterior.

---

## 12. Recalibración

Decisión de producto confirmada:

- Reutilizar el cuestionario adaptativo V1.3 cuando un jugador acceda al mecanismo de recalibración existente.
- Mantener sus límites actuales: el cuestionario nuevo aporta 25%, el movimiento provisional queda limitado a ±0,5 y el proceso se completa con 3 partidos y al menos 2 rivales.
- Mantener cooldown y ventana vigentes.
- No permitir ingresar manualmente un nivel, una categoría ni el nivel del grupo habitual.
- No crear ahora una recalibración nueva “después de 20 partidos”; esa idea queda fuera de alcance hasta analizar abuso y necesidad real.
- Central debe verificar y preservar el disparador, cooldown y ventana que estén vigentes en la implementación actual; no definir otros nuevos dentro de esta tarea.

---

## 13. Tests necesarios

### Unitarios de fórmula

- Interpolación exacta de las diez posiciones en cada vector de anclas.
- Promedio 20% por dimensión.
- Clamp 1,0–9,0.
- Precisión guardada y redondeo de presentación.
- Selección de ramas y bordes 4,1/6,4.
- Confianza según spread.
- Casos de referencia de la sección 9.

### Estado y navegación

- Atrás/adelante sin pérdida cuando la rama no cambia.
- Invalidación de respuestas posteriores cuando cambia la rama.
- Recarga de página y continuación consistente.
- Confirmación única, sin doble escritura.
- Versionado correcto en base de datos.
- Ausencia total del modo rápido.

### UI/UX

- Slider operable por touch, mouse y teclado.
- Diez posiciones discretas reales.
- Textos legibles en móvil sin mostrar 25 respuestas simultáneas.
- Estado seleccionado inequívoco.
- Intro visible antes de comenzar.
- Revisión por alta dispersión sin bloqueo.
- Resultado únicamente numérico + `Calibrando`; sin etiqueta de nivel.
- Accesibilidad: foco, labels, contraste y lector de pantalla.

### Regresión

- El motor de partidos conserva `nivel_bramu_v1_0` y sus resultados previos.
- Continúa cerrando a 5 partidos/3 rivales.
- Perfiles V1.2 existentes no cambian.
- Ranking y Grupos no cambian.
- Búsquedas/perfiles muestran correctamente número + estado de calibración según el diseño general ya aprobado.

---

## 14. Consolidación documental obligatoria antes de Production

Después de implementar y validar V1.3 en Staging, Central debe realizar una consolidación documental específica. No hacerla antes de la implementación, porque la documentación debe describir el comportamiento finalmente probado.

### Única fuente de verdad

`docs/BRAMUlab/Nivel_BRAMU.md` debe quedar como documento maestro y única fuente de verdad operativa de Nivel BRAMU.

Debe **FUSIONAR** dentro de ese archivo todo lo vigente sobre:

- objetivo y principio de escala universal;
- escala y presentación;
- estimador inicial y cuestionario V1.3;
- fórmula exacta, anclas, ramas, slider y confianza;
- calibración posterior mediante partidos;
- recalibración;
- estados y transiciones;
- versionado de cuestionario y algoritmo;
- tratamiento de cuentas existentes;
- UX/copy vigente;
- invariantes, límites y tests esenciales;
- comportamiento ante inactividad, repetición y evidencia, cuando corresponda al Nivel;
- cualquier otra regla activa que hoy exista en documentos secundarios.

### Documentos que deben absorberse o reclasificarse

Central debe comparar y absorber toda información vigente de:

- `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md` o su sucesor al finalizar V04.24;
- `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`;
- documentación de onboarding que todavía describa caminos rápido/completo;
- Issue #25 y su investigación;
- handoffs, reportes o notas de implementación relacionadas con Nivel BRAMU.

Después de comprobar que nada vigente quedó afuera:

- `docs/BRAMUlab/README.md` debe funcionar solamente como índice y enlazar al maestro;
- documentos sustituidos deben eliminarse del conjunto operativo o moverse/marcarse inequívocamente como históricos y no canónicos;
- Issue #25 debe cerrarse con vínculo al PR y al documento maestro solo después del QA;
- fixtures y archivos ejecutables de tests pueden permanecer separados como código, pero las reglas que validan deben estar explicadas en el maestro.

No debe quedar ninguna regla activa o decisión de producto que exista únicamente en un issue, handoff, plan de implementación o documento secundario.

Debe quedar explícito en el maestro que “V1.3” versiona el **estimador inicial/cuestionario**, mientras que el motor posterior sigue siendo `nivel_bramu_v1_0`.

---

## 15. Respuestas finales a las preguntas de producto

1. **¿Problema real o un solo caso exagerado?** Problema real de estimador demostrado por su sensibilidad; el caso particular no prueba por sí solo el nivel verdadero de la jugadora.
2. **¿La autoevaluación tiene demasiado peso?** Sí, especialmente porque usa una etiqueta relativa. Debe eliminarse como factor separado.
3. **¿Las etiquetas son relativas al entorno?** Sí.
4. **¿Mantenerlas internamente pero no mostrarlas?** No usarlas ni como respuesta ni como comunicación. Las ramas internas baja/media/alta son enrutamiento técnico, no categorías del jugador.
5. **¿Hace falta una señal universal de ritmo/presión?** Sí, integrada transversalmente en las cinco preguntas; no como una sexta pregunta aislada.
6. **¿El motor corrige suficientemente rápido?** Corrige errores unilaterales con evidencia diversa, pero no siempre antes del cierre y más lentamente con repetición o resultados mixtos.
7. **¿Riesgo de círculos mal anclados?** Sí. Es una limitación estructural: los resultados internos identifican diferencias relativas, no el desplazamiento absoluto del grupo.
8. **¿Hace falta una versión explícita?** Sí: `nivel_inicial_v1_3`, sin cambiar `nivel_bramu_v1_0`.

---

## 16. Decisiones abiertas

No quedan decisiones de producto abiertas para implementar Nivel inicial V1.3.

Queda deliberadamente fuera de alcance diseñar una nueva regla de elegibilidad para recalibrarse —por ejemplo, habilitarla después de 20 partidos—. Central debe conservar la elegibilidad existente y no interpretar esta exclusión como una decisión pendiente de la implementación V1.3.

---

## 17. Criterio de cierre de implementación

La tarea se considera implementada únicamente cuando:

1. V1.3 funciona en Staging con el cuestionario adaptativo completo.
2. Los contrafactuales y tests pasan.
3. Se prueba en móvil real el slider y la navegación hacia atrás.
4. Se verifica que las cuentas V1.2 no cambiaron.
5. Se verifica que el motor posterior conserva resultados de regresión.
6. Sebastián aprueba visualmente el flujo y los resultados de los perfiles de referencia.
7. `docs/BRAMUlab/Nivel_BRAMU.md` queda consolidado como única fuente de verdad y se verifica que ninguna regla vigente exista solamente en documentación secundaria.
8. Los documentos sustituidos quedan retirados del conjunto operativo o marcados inequívocamente como históricos.

Hasta entonces no promover a Production.



---

# APÉNDICE CENTRAL — preflight de implementación (02/10/2026)

Este apéndice NO cambia ninguna decisión de producto del handoff anterior. Solo fija la baseline y el plan técnico observado por Central antes de implementar.

## Baseline confirmada

- Repo: `sebastianvilaa/BRAMUlab`
- Rama: `staging`
- Baseline previa a este handoff documental: `07842f2ddeb79572216565d635e1fa90cd4e7079`
- Cargar partido V04.27 / 04.27-h2: cerrado con PASS humano en iPhone.
- Issue #24: cerrado.
- Issue #26: cerrado.
- Supabase Staging: `bramulab-staging` / project ref `serxtivkfnptzurnvewg`, ACTIVE_HEALTHY.
- Este archivo es handoff operativo temporal. No sustituye la consolidación final exigida en `docs/BRAMUlab/Nivel_BRAMU.md` después de implementación + QA.

## Colisiones / puntos técnicos detectados

1. El onboarding V1.2 actual vive principalmente en `bramulab/app.js` + `index.html` + `styles.css`; esos archivos también recibieron cambios recientes de Cargar partido. La implementación debe partir del HEAD actual y no revertir V04.27.
2. `bramulab/level-calibration.js` contiene tanto el estimador inicial V1.2 como helpers de recalibración. Reemplazar el estimador inicial por V1.3 preservando cooldown/ventana/peso 25%/±0,5/cierre 3+2 de recalibración.
3. `supabase/functions/officialize-onboarding/index.ts` todavía acepta `mode: quick|full`, calcula V1.2 y re-calcula server-side antes de persistir. Debe pasar a V1.3 manteniendo autoridad server-side.
4. La base actual restringe `questionnaire_mode` a `quick|full`. Para evitar una migración de datos innecesaria, V1.3 puede persistir el único cuestionario adaptativo con `questionnaire_mode='full'` y usar `questionnaire_version='nivel_inicial_v1_3'` como discriminador normativo, salvo que durante implementación aparezca una razón técnica concreta para migrar.
5. El borrador del alta vive en `bramulab.signupDraft.v1` y hoy puede contener datos V1.2. Debe versionarse/detectarse el progreso V1.3 de forma que un cuestionario V1.2 INCOMPLETO se reinicie bajo V1.3 sin tocar perfil, cuenta ni Nivel oficial.
6. El resultado actual del onboarding muestra categoría textual mediante el gauge. V1.3 debe mostrar solamente número + CALIBRANDO según el handoff.
7. La limpieza documental de Nivel queda POSTERGADA hasta implementación + QA, tal como exige el handoff.

## Archivos previstos

**Core / UI**
- `bramulab/level-calibration.js`
- `bramulab/app.js`
- `bramulab/index.html`
- `bramulab/styles.css`
- `bramulab/store.js` solo si hace falta para persistencia/versionado del progreso

**Backend**
- `supabase/functions/officialize-onboarding/index.ts`
- shared engine por los symlinks existentes, sin duplicar fórmula
- migración solo si una restricción real la hace necesaria; evitarla si `questionnaire_mode='full'` resuelve compatibilidad

**Tests**
- tests unitarios/contrafactuales V1.3
- navegación adaptativa, reload y ausencia de quick
- paridad navegador/servidor
- regresión de `nivel_bramu_v1_0`
- preservación de cuentas V1.2

**Versionado**
- APP_VERSION / BUNDLE_VERSION / version.json / SW/cache / manifest/query strings según el patrón vigente.

## Garantía de cuentas existentes

- No ejecutar UPDATE/backfill/recompute sobre `level_states` o `level_events`.
- Tomar snapshot read-only previo de filas/contadores/versiones de Nivel en Staging.
- V1.3 solo puede oficializar un jugador que siga en PENDIENTE y complete un cuestionario nuevo.
- Conservar la idempotencia/único `initial_estimate` vigente.
- Después del deploy repetir snapshot read-only y comprobar que todas las cuentas V1.2 existentes conservan exactamente `status, mu, confidence, rated_matches, distinct_opponents, questionnaire_version, algorithm_version`.
- Un borrador V1.2 incompleto es estado local no oficial: reiniciar solo las respuestas de Nivel, nunca el resto del alta.

## Plan de implementación y validación

1. Implementar el motor puro V1.3 + tests exactos de fórmula/umbrales/monotonicidad/perfiles.
2. Reemplazar la UX por el cuestionario único adaptativo con slider de 10 posiciones, back/forward e invalidación por cambio de rama.
3. Persistir progreso local versionado y soportar reload.
4. Actualizar la Edge Function para recalcular V1.3 server-side desde respuestas crudas.
5. Mantener motor posterior `nivel_bramu_v1_0` sin cambios funcionales.
6. Deploy únicamente a Staging.
7. Verificar cuentas V1.2 intactas antes/después.
8. QA técnico y contrafactuales.
9. QA humano en iPhone: touch del slider, 10 posiciones, volver/cambiar rama, reload, resultado número + CALIBRANDO.
10. Solo después del PASS humano consolidar `docs/BRAMUlab/Nivel_BRAMU.md` como única fuente operativa, reclasificar/eliminar fuentes sustituidas y cerrar Issue #25.
11. No promover a Production sin autorización explícita posterior.

## Recalibración

El handoff confirma que la recalibración sigue existiendo en V1.3 y reutiliza el cuestionario adaptativo. Esta implementación debe preservar su matemática/eligibilidad vigente. La representación visual específica de `RECALIBRANDO` se revisará después del bloque V1.3 si hace falta; no inventar una UX nueva durante esta implementación.
