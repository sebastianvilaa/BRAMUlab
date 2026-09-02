# BRAMU Lab
## Etapa 3 — Fase 1: semántica de fecha del partido

**Estado:** AUTORIZADO PARA IMPLEMENTAR  
**Fecha:** 02 de septiembre de 2026  
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`  
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/`

---

## 1. Forma de trabajo

Este consolidado fue preparado por ChatGPT a partir de las decisiones de producto acordadas con Sebastián y del plan técnico anterior de Claude.

- Sebastián funciona como intermediario entre ChatGPT y Claude.
- Claude debe ejecutar esta fase completa y documentar técnicamente lo realizado.
- Las dudas técnicas, supuestos, decisiones conservadoras, desvíos o riesgos deben quedar escritos en el informe final para que ChatGPT pueda revisarlos.
- No trasladar a Sebastián preguntas técnicas menores que Claude pueda resolver de forma conservadora y documentada.
- Si aparece una ambigüedad que modifica producto, historial o compatibilidad de datos de manera material, detener únicamente esa parte y documentar el bloqueo con alternativas concretas. No avanzar por cuenta propia hacia otra fase.
- No avanzar a la Fase 2.

---

## 2. Objetivo

Corregir la semántica temporal de los partidos para que BRAMU Lab distinga claramente:

- `playedAt`: fecha y hora reales en que se jugó el partido.
- `createdAt`: momento técnico en que el registro fue creado o guardado en BRAMU Lab.
- `startedAt`: momento de inicio del marcador en los registros en vivo.
- `finishedAt`: momento en que terminó o se guardó el registro según el modelo histórico existente.

La historia deportiva debe ordenarse siempre por la fecha real jugada. Cargar hoy un partido que se jugó ayer no puede convertirlo en el “último partido” por haber sido guardado más tarde.

Esta corrección es fundacional para Último partido, Historial, Forma reciente, Tu Momento, hitos, rachas, Actividad de 30 días y Efectividad.

---

## 3. Estado de partida y protección

- La Fase 0 ya está terminada, comiteada, pusheada y verificada.
- BRAMU Lab vive en `bramulab/`.
- BRAMU Lab Partidos vive en `bramulab-partidos/` y está congelado.
- Ambas aplicaciones tienen PWA, caché y almacenamiento separados.
- La suite actual de BRAMU Lab debe tomarse como línea base: 349/349 tests en verde, salvo que Claude verifique un número posterior legítimo antes de empezar.
- No migrar, copiar ni compartir datos entre ambas aplicaciones.
- No tocar ningún archivo dentro de `bramulab-partidos/`.
- No modificar service workers, manifests, rutas, nombres de aplicación ni claves de almacenamiento en esta fase.

---

## 4. Regla de compatibilidad

Centralizar la lectura de la fecha real del partido en una única función pura y testeable, preferentemente dentro de `bramulab/player-home.js`, siguiendo esta prioridad:

1. `playedAt`
2. `startedAt`
3. `finishedAt`

La lógica conceptual es:

`playedAt ?? startedAt ?? finishedAt`

Requisitos:

- No reescribir ni migrar masivamente los registros históricos guardados.
- Los partidos anteriores, que todavía no tengan `playedAt`, deben seguir apareciendo y ordenándose correctamente mediante el fallback.
- La conversión y validación de fechas debe ser defensiva frente a valores ausentes o inválidos.
- No repetir esta cadena de fallback en diferentes pantallas. Debe existir una sola fuente de verdad reutilizable.

---

## 5. Escritura de registros nuevos

### 5.1 Cargar partido jugado

Al guardar un partido cargado manualmente:

- La fecha y hora elegidas por el usuario se persisten como `playedAt`.
- El momento técnico en que se guarda se persiste como `createdAt`.
- Conservar los campos históricos que todavía necesite el modelo actual para no romper compatibilidad.
- No rediseñar todavía la pantalla de carga.

### 5.2 Partido en vivo — Completo

Al finalizar un partido registrado en modo Completo:

- `playedAt` toma el valor de `startedAt`.
- `createdAt` toma el momento técnico de creación del registro final.
- Mantener `finishedAt` con su significado y comportamiento existentes.

### 5.3 Partido en vivo — Por Games

Aplicar exactamente la misma regla:

- `playedAt = startedAt`
- `createdAt` corresponde al momento técnico de guardado.
- Mantener compatibilidad con el modelo previo.

Las tres vías de guardado deben producir registros temporalmente coherentes.

---

## 6. Lecturas que deben corregirse

Reemplazar el uso de `finishedAt` como fecha deportiva por la función central de fecha jugada en todas las superficies relevantes de BRAMU Lab:

1. Orden de partidos del jugador.
2. Último partido del Home.
3. Forma reciente.
4. Historial.
5. Fecha mostrada en el detalle o fila del Historial.
6. Tu Momento, rachas y métricas que dependan del orden cronológico.
7. Cálculos temporales existentes, incluido “Partidos este mes” mientras siga presente.
8. Preparación para la futura ventana móvil de Actividad de 30 días.
9. Fecha mostrada en la pieza o imagen de Compartir, si actualmente utiliza `finishedAt` como fecha jugada.

No cambiar todavía el diseño, los textos generales ni la estructura visual de estas superficies.

---

## 7. Orden y desempate determinístico

Orden principal:

- `playedAt` descendente: el partido más recientemente jugado aparece primero.

Ante igualdad exacta de fecha jugada:

1. usar `createdAt` descendente;
2. para registros históricos sin `createdAt`, usar `finishedAt` descendente;
3. conservar un último criterio estable y documentado si todavía existe igualdad.

El momento de carga solo puede actuar como desempate cuando dos partidos tienen exactamente el mismo `playedAt`. Nunca puede imponerse sobre una fecha jugada diferente.

---

## 8. Implementación técnica esperada

Claude debe:

- inspeccionar las tres rutas reales de finalización/guardado antes de modificar;
- crear o consolidar funciones puras reutilizables para fecha jugada, fecha de creación y comparación cronológica;
- evitar lógica temporal duplicada dentro del DOM;
- limitar los cambios a los archivos necesarios dentro de `bramulab/`;
- mantener compatibilidad con el historial local existente;
- evitar refactors generales que no sean imprescindibles para esta fase;
- agregar tests para toda función pura nueva;
- conservar la arquitectura sin backend ni dependencias nuevas.

Archivos esperables, sujetos a la inspección final de Claude:

- `bramulab/app.js`
- `bramulab/player-home.js`
- `bramulab/tests.html`

Si necesita modificar otro archivo, debe justificarlo expresamente en el informe.

---

## 9. Casos de prueba obligatorios

### 9.1 Precedencia de fechas

Verificar que la función central devuelva:

- `playedAt` cuando existe;
- `startedAt` cuando no existe `playedAt`;
- `finishedAt` cuando no existen los dos anteriores;
- un resultado defensivo y controlado cuando ninguna fecha es válida.

### 9.2 Caso central: hoy y ayer

1. Cargar un partido jugado hoy.
2. Después cargar un partido jugado ayer.
3. El partido de hoy debe continuar siendo Último partido.
4. El Historial debe mostrar primero el partido de hoy.
5. Forma reciente y cualquier relato derivado deben conservar el orden deportivo correcto.

### 9.3 createdAt no altera la historia

Dos registros con diferentes fechas jugadas deben ordenarse por `playedAt`, aunque el más antiguo haya sido creado más tarde.

### 9.4 Compatibilidad histórica

Los registros viejos sin `playedAt` ni `createdAt` deben:

- seguir visibles;
- conservar su resultado;
- ordenarse usando `startedAt` o `finishedAt`;
- no provocar errores en Home, Historial o Compartir.

### 9.5 Nuevos registros

Verificar la escritura correcta de `playedAt` y `createdAt` en:

- Cargar partido jugado;
- Completo;
- Por Games.

### 9.6 Desempate

Verificar que dos partidos con el mismo `playedAt` produzcan siempre el mismo orden mediante el criterio documentado.

### 9.7 Regresión

- Ejecutar la suite completa de BRAMU Lab.
- Todos los tests preexistentes deben continuar en verde.
- Documentar cantidad anterior, cantidad posterior y tests nuevos agregados.

---

## 10. Verificación manual y producción

Antes de cerrar:

1. Probar localmente BRAMU Lab con historial vacío y con historial existente.
2. Ejecutar manualmente el caso “hoy y después ayer”.
3. Confirmar Último partido, Historial y Forma reciente.
4. Confirmar que los partidos históricos siguen visibles.
5. Confirmar que BRAMU Lab Partidos no recibió cambios.
6. Si todos los tests quedan en verde, hacer un único commit claro para esta fase.
7. Hacer push a `main`.
8. Esperar el despliegue de GitHub Pages y verificar la URL pública de BRAMU Lab:
   `https://sebastianvilaa.github.io/BRAMUlab/bramulab/`
9. Verificar que BRAMU Lab Partidos continúa respondiendo sin cambios:
   `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/`
10. No avanzar a la Fase 2.

Si las pruebas no quedan completamente en verde, no hacer push. Documentar el bloqueo.

---

## 11. Informe obligatorio para revisión de ChatGPT

Al terminar, crear:

`docs/bramulab/informes/BRAMU_Lab_Etapa_3_Fase_1_Semantica_Fecha_Informe.md`

El informe debe contener:

1. Diagnóstico breve del estado encontrado.
2. Archivos modificados.
3. Funciones creadas o reutilizadas.
4. Regla final de `playedAt`, `createdAt` y fallbacks.
5. Tratamiento de los tres flujos de guardado.
6. Compatibilidad con registros históricos.
7. Criterio de desempate exacto.
8. Tests agregados y resultados completos.
9. Verificaciones manuales realizadas.
10. Confirmación de que `bramulab-partidos/` no fue modificado.
11. Hash y mensaje del commit.
12. Estado del push y despliegue.
13. URL verificada.
14. Cualquier desviación, supuesto, deuda o decisión técnica tomada.
15. Confirmación explícita de que no avanzó a la Fase 2.

El informe debe ser autosuficiente. ChatGPT debe poder entender y auditar lo realizado leyendo únicamente ese archivo, sin necesitar el chat operativo completo de Claude.
