# BRAMUlab — cierre documental definitivo de V03

## Objetivo

Cerrar documentalmente la línea V03 después de la validación visual de BRAMUlab V03.10.

Esta ronda es SOLO documental.

No implementar código.
No cambiar versión de la app.
No crear V03.11.
No tocar Nivel BRAMU, BRAMU Intelligence ni Backend.
No avanzar a V04.

Estado publicado final de V03:

- versión: `BRAMUlab V03.10`
- commit de implementación: `baf8453`
- commit de reporte: `008f32c4`
- tag: `BRAMUlab_V03.10`
- suite final: `1060/1060`
- producción validada visualmente por usuario

---

# 1. Documentos a actualizar

Actualizar únicamente:

1. `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Consolidado.md`
2. `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md`

El objetivo es que ambos dejen de terminar en V03.4.6 y reflejen correctamente el cierre real hasta V03.10.

No reescribir desde cero lo que ya está bien de V03.0–V03.4.6.
Mantener la estructura y el valor histórico existente.
Agregar/actualizar desde V03.5 en adelante y corregir únicamente encabezados/estado/arquitectura vigente que hayan quedado obsoletos.

---

# 2. Fuentes mínimas a leer

Leer SOLO lo necesario:

1. `BRAMUlab_V03_Consolidado.md`
2. `BRAMUlab_V03_Informe.md`
3. `BRAMUlab_V03.5.2_Reporte_ChatGPT.md`
4. `BRAMUlab_V03.6_Reporte_ChatGPT.md`
5. `BRAMUlab_V03.7_Reporte_ChatGPT.md`
6. `BRAMUlab_V03.8_Reporte_ChatGPT.md`
7. `BRAMUlab_V03.9_Reporte_ChatGPT.md`
8. `BRAMUlab_V03.10_Reporte_ChatGPT.md`
9. `docs/BRAMUlab/Ranking_BRAMU.md` solo para verificar el estado normativo final del Ranking.

Si algún reporte intermedio no existe con ese nombre exacto, buscar el equivalente vigente dentro de la misma carpeta. No releer documentación histórica eliminada/archivada salvo contradicción concreta.

---

# 3. Qué debe quedar reflejado en el Consolidado

El Consolidado responde principalmente:

> ¿Qué se decidió/especificó en cada ronda de V03?

Agregar una síntesis cronológica clara de:

## V03.5 / V03.5.1 / V03.5.2 — Ranking BRAMU

Registrar como evolución acumulada, sin repetir todo el documento normativo:

- Ranking BRAMU oficial separado de Nivel BRAMU y Mis grupos.
- scopes: Local / Provincial / País / Global / Mi red.
- filtros de género/rama y Nivel.
- Ranking sin puntos propios, ordenado por Nivel consolidado interno.
- evolución definitiva a Ranking SEMANAL:
  - lunes 00:00 → domingo 23:59:59;
  - timezone Buenos Aires;
  - snapshot semanal;
  - posición y Nivel del corte estables durante la semana;
  - validaciones tardías entran en la edición siguiente;
  - flechas = puestos.
- TU POSICIÓN, búsqueda, ayuda, paginado, fila propia.
- localidad exacta y densidad.
- Mi red separada de Mis grupos.

## V03.6 — contacto / WhatsApp + identidad

Registrar:

- `phone` privado + `allowWhatsAppContact` explícito.
- WhatsApp visible en Perfil público solo con teléfono válido + consentimiento.
- teléfono nunca expuesto públicamente.
- mensaje final aprobado.
- correcciones de identidad/Ranking de la ronda.
- limitación conocida de historial compartido en localStorage entre cuentas del mismo navegador, diferida a Backend.

## V03.7 — geografía + Ranking en Perfil público

Registrar:

- corrección real de geografía mock:
  - Local exacto;
  - Provincial mismo país+región;
  - País mismo país;
  - CABA separada de Provincia de Buenos Aires.
- tarjeta territorial semanal en Perfil público:
  - Local / Provincia / País;
  - puesto + denominador + territorio + período;
  - usa el snapshot del jugador del perfil;
  - no inventa Ranking para calibrando/no elegible/sin cuenta real.

## V03.8 — cierre UX de Ranking

Registrar:

- misma tarjeta territorial en Mi Perfil;
- mayor jerarquía visual del puesto;
- TU POSICIÓN formalizada como acceso al contexto cercano de la fila propia;
- Ranking integrado en Home solo vía `TU MOMENTO`;
- `Explorar rankings` definido conceptualmente como función separada futura, fuera de V1;
- Ranking principal sigue siendo contexto geográfico propio.

## V03.9 — microajustes

Registrar:

- framing de forma reciente corregido respecto al balance;
- TU POSICIÓN de Mi red con 1–2 elegibles equilibrada visualmente;
- 1–2 elegibles = comparación simple sin puesto, nunca `#1 de 1`;
- test determinístico del rollover semanal confirmó el cambio automático de edición al lunes 00:00 BA.

## V03.10 — cierre final

Registrar:

- regla conservadora final de `TU MOMENTO`:
  - forma reciente solo si victorias > derrotas;
  - negativa/neutra se omite;
  - Ranking negativo factual puede seguir apareciendo.
- Compañeros/Rivales:
  - identidad agregada por `userId` cuando existe;
  - `Nombre · @username` solo si hay cuenta real resoluble;
  - legacy sin cuenta real = solo nombre;
  - dos cuentas con mismo displayName y distinto userId no se fusionan.
- aclarar que Mis Grupos puede seguir mostrando handles sintéticos del prototipo; Compañeros/Rivales deliberadamente NO los inventa.
- interpretación más profunda de mala racha/TU MOMENTO queda para BRAMU Intelligence.

---

# 4. Qué debe quedar actualizado en el Informe

El Informe responde principalmente:

> ¿Qué se implementó realmente, cómo quedó y qué se verificó?

Actualizar el encabezado y arquitectura acumulada.

Debe quedar explícito:

- estado final publicado: `BRAMUlab V03.10`;
- suite final: `1060/1060`;
- V03 queda CERRADA;
- Ranking BRAMU está implementado a nivel prototipo con snapshots simulados/determinísticos, no backend real;
- `ranking.js` pasa a formar parte de la arquitectura acumulada;
- identidad `userId` sigue siendo autoritativa;
- Compañeros/Rivales desde V03.10 conservan identidad por userId en sus agregados;
- tarjeta territorial de Ranking existe en Perfil público y Mi Perfil;
- Home consume Ranking dentro de TU MOMENTO;
- rollover semanal verificado por test y luego observado en producción real por el usuario;
- geografía V03.7 validada en producción;
- WhatsApp/consentimiento V03.6;
- limitaciones reales conocidas.

Agregar por ronda commits/tags/tests cuando estén disponibles en los reportes, pero mantener el documento legible; no convertirlo en un changelog línea por línea.

---

# 5. Limitaciones / pendientes que deben sobrevivir al cierre

No perder estas decisiones:

## Backend futuro

- snapshot semanal real debe congelar ubicación + opt-in/privacidad al corte;
- snapshots persistidos/auditables;
- historial/visibilidad real debe estar ligado a userId y rol;
- un partido observado nunca debe convertirse en historial deportivo propio;
- validación de partidos entre usuarios registrados antes de impactar oficialmente Nivel/Ranking.

## Ranking futuro

- `Explorar rankings` separado del Ranking principal;
- búsqueda geográfica estructurada;
- fuera de V1 mientras haya poca densidad;
- no cascada gigante País → Provincia → Localidad.

## Identidad / prototipo

- localStorage multi-cuenta comparte historial físico del navegador; deferido a Backend.
- jugadores legacy sin cuenta real no tienen username oficial.
- Mis Grupos conserva comportamientos/prototipos previos que pueden mostrar handles sintéticos; no tratarlos como identidad real.

## TU MOMENTO / Intelligence

- TU MOMENTO queda liviano y determinístico.
- interpretación profunda de tendencias/rachas/contexto corresponde a BRAMU Intelligence.

---

# 6. Corregir referencias obsoletas

En ambos documentos revisar y corregir referencias que hoy hayan quedado viejas, especialmente:

- “V03 es activa” → debe quedar “V03 cerrada en V03.10”.
- “estado actual V03.4.6” → V03.10.
- “backend en futura V04” u otras referencias antiguas → roadmap vigente:
  - V04 = Nivel BRAMU;
  - V05 = BRAMU Intelligence;
  - V06 = Backend / Infraestructura.
- cualquier mención a que Ranking real/fórmula de Nivel siguen siendo el mismo frente de V03 si ya no corresponde.

NO alterar decisiones históricas dentro de la narración de versiones anteriores; corregir solo cuando se presenta como estado vigente actual.

---

# 7. Cierre y git

Esta ronda NO cambia la app.

No tocar:
- `bramulab/*.js`
- HTML/CSS
- tests
- version.json
- service worker
- cache-bust
- tag V03.10

Después de actualizar los dos documentos:

1. revisar diff;
2. confirmar que no se borró información histórica útil;
3. commit documental de cierre de V03;
4. push a `main`;
5. NO crear nueva versión/tag de app;
6. crear:
   `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Cierre_Reporte_ChatGPT.md`
7. hacer un segundo commit solo para ese reporte si la mecánica actual de reportes lo requiere;
8. detenerse.

No borrar ni archivar archivos en esta ronda.
No avanzar a V04.

La siguiente decisión la toma ChatGPT después de auditar el reporte de cierre.
