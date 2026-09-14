# BRAMUlab V03.9 — microajustes de cierre de V03

## Objetivo

Hacer una ronda mínima y focal posterior a V03.8 para corregir dos problemas reales detectados en QA visual y agregar una verificación determinística del rollover semanal de Ranking.

No abrir nuevos frentes.
No rediseñar Home, Ranking ni Perfil.
No avanzar a V04.

Base publicada: `BRAMUlab V03.8`.

---

## 1. TU MOMENTO — corregir el framing de forma reciente

Problema real detectado:

Después de cargar una derrota, con balance reciente de 2 victorias y 3 derrotas en los últimos 5 partidos, `TU MOMENTO` muestra:

`Venís de ganar 2 de tus últimos 5 partidos.`

El dato es verdadero, pero editorialmente está mal elegido porque presenta en positivo un balance reciente negativo.

### Regla recomendada

Mantener la lógica determinística y basada solo en datos reales, pero elegir el framing según el balance:

- si victorias > derrotas:
  `Ganaste X de tus últimos N partidos.`
- si derrotas > victorias:
  `Perdiste Y de tus últimos N partidos.`
- si victorias = derrotas:
  usar una formulación neutral:
  `En tus últimos N partidos: X victorias y Y derrotas.`

No inventar causalidad ni interpretación.
No usar “venís de ganar” cuando el balance reciente es negativo.

Mantener el criterio existente de muestra suficiente y el tratamiento actual de partidos neutrales/sin resultado definido.

Ranking sigue pudiendo ser el segundo insight de `TU MOMENTO` según la prioridad ya cerrada:

`forma reciente > Ranking semanal Local > compañero frecuente > actividad del mes`

No cambiar esa prioridad.

---

## 2. RANKING > MI RED — estado de TU POSICIÓN con 1–2 elegibles

Problema real detectado:

Cuando `Mi red` tiene solo 1 jugador elegible, la tarjeta `TU POSICIÓN` queda visualmente desbalanceada:
- no hay puesto oficial por la regla vigente;
- `Nivel BRAMU 6.5` queda flotando a la derecha;
- aparece `Comparación entre 1 jugadores · Mi red`, con error de singular.

### Mantener la regla deportiva vigente

NO inventar `#1 de 1`.

La normativa ya define:
- 1–2 elegibles en Mi red = comparación simple, sin puesto;
- desde 3 = posiciones `N de total`.

### Ajuste UX

La tarjeta debe conservar una composición equilibrada incluso sin puesto.

Propuesta:

- encabezado: `TU POSICIÓN`
- zona de puesto: `—`
- contexto:
  - 1 elegible: `Comparación simple · 1 jugador · Mi red`
  - 2 elegibles: `Comparación simple · 2 jugadores · Mi red`
- a la derecha:
  - etiqueta `NIVEL BRAMU`
  - valor del Nivel del corte semanal

Corregir singular/plural dinámico:
- `1 jugador`
- `2 jugadores`

No modificar elegibilidad, densidad ni reglas de Ranking.

---

## 3. ROLLOVER SEMANAL — prueba determinística

Agregar un test focal para verificar el cambio de edición semanal alrededor del corte real de Buenos Aires.

Caso mínimo:

- domingo 13/09/2026 23:59:59 en `America/Argentina/Buenos_Aires`
  debe seguir mostrando:
  `Lun 31 ago — Dom 06 sep`
- lunes 14/09/2026 00:00:00 en `America/Argentina/Buenos_Aires`
  debe pasar a:
  `Lun 07 sep — Dom 13 sep`

Usar las funciones puras existentes de período semanal.
No cambiar la lógica temporal si el test ya pasa.

---

## 4. ALCANCE

Tocar solo lo necesario para:

1. framing de forma reciente en `TU MOMENTO`;
2. visual/copy de `TU POSICIÓN` en `Mi red` con 1–2 elegibles;
3. test de rollover semanal;
4. versionado V03.9;
5. documentación/reporte de la ronda.

No tocar:
- geografía;
- `Explorar rankings`;
- Nivel BRAMU;
- BRAMU Intelligence;
- Backend;
- historial multiusuario;
- validación de partidos;
- WhatsApp;
- Mis grupos;
- diseño global.

---

## 5. TESTS Y QA

Tests focales:

### TU MOMENTO
- 3W / 2L → frase positiva;
- 2W / 3L → frase negativa;
- empate → frase neutral;
- partidos neutrales respetan la lógica existente;
- Ranking conserva su prioridad vigente.

### MI RED
- 1 elegible → sin puesto, singular correcto, composición válida;
- 2 elegibles → sin puesto, plural correcto;
- 3 elegibles → conserva ranking `N de total`;
- no alterar Local/Provincial/País/Global.

### ROLLOVER
- antes y después del lunes 00:00 BA según §3.

Durante desarrollo: focales.
Suite completa una sola vez al final.

QA manual:
- mobile 375px primero;
- Mi red con 1 elegible;
- Home con caso reciente 2W/3L;
- quick check Ranking normal;
- tablet rápido.

---

## 6. VERSIONADO Y DOCUMENTACIÓN

Versión resultante:

`BRAMUlab V03.9`

Actualizar:
- app version;
- `version.json`;
- cache-bust;
- service worker;
- tag `BRAMUlab_V03.9`.

Crear:
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.9.md`

y al finalizar:
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.9_Reporte_ChatGPT.md`

El reporte debe dejar claro:
- qué se corrigió;
- qué no se tocó;
- tests focales;
- suite final;
- QA;
- commit;
- tag;
- deploy;
- cualquier limitación real.

No avanzar a V04.
Detenerse al terminar y esperar auditoría de ChatGPT.
