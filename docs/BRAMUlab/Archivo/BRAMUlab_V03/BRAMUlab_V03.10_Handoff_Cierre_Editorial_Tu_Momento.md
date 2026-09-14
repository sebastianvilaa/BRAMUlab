# BRAMUlab V03.10 — cierre editorial de TU MOMENTO

## Objetivo

Hacer una micro-ronda final sobre V03.9 para corregir un único problema de producto detectado en QA real:

`TU MOMENTO` no debe destacar una racha/balance reciente negativo como insight principal.

Base publicada: `BRAMUlab V03.9`.

No abrir nuevos frentes.
No tocar Ranking salvo la integración ya existente dentro de `TU MOMENTO`.
No avanzar a V04.

---

## 1. Problema real detectado

Después de cargar varios partidos, con un balance reciente de 0 victorias y 5 derrotas, Home muestra:

`Perdiste 5 de tus últimos 5 partidos.`

El dato es correcto, pero no es el tipo de insight que queremos destacar en `TU MOMENTO`.

La ronda V03.9 corrigió correctamente un problema anterior: no presentar un balance negativo como si fuera positivo.

Ahora cerramos la regla editorial:

> `TU MOMENTO` puede mostrar hechos negativos cuando son parte de una métrica explícita y contextual —por ejemplo movimiento de Ranking—, pero no debe elegir una mala racha reciente como insight editorial principal.

---

## 2. Regla cerrada para forma reciente

La cláusula de forma reciente entra a `TU MOMENTO` únicamente si el balance reciente es positivo:

- victorias > derrotas → mostrar:
  `Ganaste X de tus últimos N partidos.`
- victorias <= derrotas → NO generar cláusula de forma reciente.

No reemplazarla por:
- `Perdiste...`
- `Balance parejo...`
- otro copy negativo o neutro.

Simplemente se omite y el mecanismo actual continúa con el siguiente candidato.

La prioridad general sigue siendo:

`forma reciente positiva > Ranking semanal Local > compañero frecuente > actividad del mes`

Si la forma reciente no califica por ser negativa o neutra, Ranking puede ocupar el primer lugar disponible.

---

## 3. Ranking negativo sí puede aparecer

No modificar el comportamiento actual del insight de Ranking.

Ejemplo válido:

`#5 de 21 en Bella Vista · ↓ 3 esta semana`

Eso es una lectura factual de posición, no un juicio editorial sobre rendimiento.

No atribuir la baja a “jugar peor”.
Las flechas siguen significando puestos.

---

## 4. Relación futura con BRAMU Intelligence

No implementar BRAMU Intelligence acá.

Solo dejar claro en el documento de versión/reporte que esta regla mantiene `TU MOMENTO` como superficie liviana y determinística.

La interpretación más profunda de:
- mala racha;
- recuperación;
- cambio de tendencia;
- contexto temporal;
- señales útiles a pesar de resultados negativos

queda para BRAMU Intelligence en V05.

---

## 5. Alcance técnico

Tocar solo lo mínimo necesario en:
- `bramulab/player-home.js`
- tests relacionados
- versionado/cache
- documentación V03.10/reporte

No tocar:
- lógica semanal de Ranking;
- geografía;
- Mi red;
- Perfil;
- Nivel BRAMU;
- BRAMU Intelligence;
- Backend;
- historial multiusuario;
- WhatsApp;
- Mis grupos;
- registro de partidos;
- diseño global.

---

## 6. Tests mínimos

Agregar/ajustar tests focales:

- 3W / 2L → genera cláusula positiva.
- 2W / 3L → NO genera cláusula de forma reciente.
- 0W / 5L → NO genera cláusula de forma reciente.
- 2W / 2L → NO genera cláusula de forma reciente.
- si forma reciente se omite y existe insight de Ranking, Ranking pasa a ser el primer candidato disponible.
- si tampoco hay Ranking, conserva fallback actual a compañero frecuente / actividad.
- compatibilidad del resto de `TU MOMENTO`.

Suite completa una sola vez al final.

---

## 7. QA manual

Mobile 375px:

1. Home con balance 0W/5L:
   - no debe aparecer `Perdiste 5 de tus últimos 5 partidos`;
   - si hay movimiento de Ranking, ese dato puede aparecer;
   - si hay otro candidato válido, puede completar el segundo lugar.

2. Home con 3W/2L:
   - debe seguir apareciendo `Ganaste 3 de tus últimos 5 partidos`.

3. Sin regresiones visuales.

---

## 8. Versionado

Versión:

`BRAMUlab V03.10`

Actualizar:
- app version;
- `version.json`;
- cache-bust;
- service worker;
- tag `BRAMUlab_V03.10`.

Crear:
- `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.10.md`
- `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.10_Reporte_ChatGPT.md`

Al terminar:
- commit;
- tag;
- push;
- deploy;
- verificar producción;
- detenerse.

No consolidar V03 todavía.
No avanzar a V04.

La siguiente decisión la toma ChatGPT después de auditar el reporte.
