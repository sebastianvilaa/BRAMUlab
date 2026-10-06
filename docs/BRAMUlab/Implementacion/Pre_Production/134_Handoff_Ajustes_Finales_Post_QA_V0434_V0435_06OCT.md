# 134 — Handoff · Ajustes finales post-QA V04.34 → V04.35

**Fecha:** 06/10/2026  
**Rama única:** `staging`  
**Base documental de referencia:** `753912ff574ece850ad50e43fb6ee83907d7a88f`  
**Objetivo:** cerrar en una sola ronda los últimos ajustes visuales detectados en QA humano de V04.34 y corregir un problema real de relevancia/copy en BRAMU Intelligence. No reabrir arquitectura ni repetir QA histórica.

Leer antes:
1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Implementacion/Pre_Production/133_Traspaso_Central_Post_V0434_06OCT.md`
4. `docs/BRAMUlab/BRAMU_Intelligence.md`
5. Issue #29 completo.

## 1. Estado del QA humano V04.34

PASS observado en Staging real:
- Home: waiting fuera del carrusel superior; card ancha `PARTIDOS PENDIENTES`; contadores; abre pantalla propia y no Historial.
- Validación rápida: `Validar partido` → `✓ PARTIDO VALIDADO` → contracción/recomposición de lista, sin modal.
- Pantalla propia de Pendientes: secciones y quick cards correctas; `Revisar partido` abre Resumen.
- Identidad: bloque `JUGADOR POR IDENTIFICAR` + CTA `IDENTIFICAR JUGADOR` funciona y lleva al flujo correcto.
- Resumen esperando: `ESPERANDO VALIDACIÓN` correcto; mi pareja arriba y verde.
- Perspectiva desde Seba sobre partido validado: `Seba / Leo` arriba y verde, rival abajo y azul, sin alterar resultado canónico.
- Pre-check temprano de duplicado: aparece antes del score con el partido correcto y opciones `ES ESTE PARTIDO / ES OTRO PARTIDO / CANCELAR`.
- `ES OTRO PARTIDO`: permitió continuar a score y crear un nuevo encuentro distinto 6–1 · 6–1.
- Central verificó en Supabase Staging que el nuevo encuentro quedó relacionado como `resolved_different` contra los dos encuentros equivalentes existentes, con 0 necesidad de repetir claim para comprobar la persistencia. El fix durable V04.34 queda considerado PASS.

No repetir estos casos salvo regresión causada por V04.35.

## 2. Ajustes visuales finales aprobados

### 2.1 Carrusel superior de Home

Problema: con una sola tarjeta, la altura fija deja demasiado aire vacío.

REEMPLAZAR la regla actual por:
- si hay **2 o más tarjetas**, mantener una altura común/fija entre ellas;
- si hay **1 sola tarjeta**, usar altura compacta según contenido, sin forzar el alto pensado para el carrusel múltiple.

Mantener límites de título/cuerpo y ellipsis para que textos largos no rompan layout.

### 2.2 Card `PARTIDOS PENDIENTES` en Home

Mantener:
- icono, título y borde/acento ámbar;
- estructura de tres columnas.

AJUSTAR:
- números de los tres contadores en **blanco/neutro**, no ámbar;
- labels `POR VALIDAR / ESPERANDO / POR RESOLVER` con un poco más de presencia, usando una jerarquía equivalente a headings como `RACHA ACTUAL` / `PARTIDOS TOTALES`;
- no convertirla en semáforo ni agregar colores distintos por columna.

### 2.3 Pantalla `PARTIDOS PENDIENTES`

AJUSTAR headings para que cantidad y título se lean como una unidad:
- `POR VALIDAR · 1`
- `POR RESOLVER · 1`
- `ESPERANDO VALIDACIÓN · 6`

No dejar el número aislado en el margen derecho.

Reducir moderadamente el espacio vertical entre el final de una sección/card y el heading siguiente. Mantener separación clara entre secciones; no compactar en exceso.

### 2.4 Disclaimer de Intelligence en partido pendiente

El espacio excesivo observado es **debajo de `+ POR QUÉ APARECEN ESTOS INSIGHTS` y antes del disclaimer pendiente**.

Hoy el disclaimer tiene aproximadamente `margin-top: 22px`.

REEMPLAZAR por **5px** (o equivalente exacto en la regla real que produzca ese resultado visual).

No quitar `+ POR QUÉ APARECEN ESTOS INSIGHTS`.
No cambiar el copy del disclaimer en esta ronda.

### 2.5 Modal `POSIBLE PARTIDO DUPLICADO`

La estructura general quedó aprobada. NO cambiar título, score, jerarquía de botones ni acciones.

AJUSTAR solo el mini-partido:
- filas de jugadores un poco más altas;
- avatares un poco más grandes;
- mostrar `@usuario` debajo del nombre cuando exista;
- no inventar usuario para provisionales/sin cuenta;
- nombres en blanco/neutro;
- conservar verde/azul únicamente en las líneas/acento lateral de cada pareja.

Objetivo: más legibilidad y menos sensación de “videojuego”, sin agrandar innecesariamente el modal.

## 3. BRAMU Intelligence — bug de relevancia detectado

### Caso observado

En el partido nuevo:
`Seba / Leo vs Esteban / Gastón` — 6–1 · 6–1

BRAMU Intelligence mostró:
- título: `Tu mejor compañero`
- texto: `Tu mejor balance es con Gusti: 8 en 11.`

Problemas:
1. el copy `8 en 11` no explica claramente que son 8 victorias en 11 partidos;
2. **Gusti no participa en este partido**, por lo que ese insight relacional resulta desconectado del análisis post-partido actual.

Esto no es solo cosmético. Es un problema de selección/relevancia del insight.

### Regla de producto confirmada para V04.35

En **BRAMU Intelligence de un partido**, los insights relacionales de compañero/rival/cruce deben referirse a jugadores o relaciones que participan en **ese partido actual**.

No mostrar como insight de partido un “mejor compañero” o “mejor rival” global que no participa en el encuentro analizado.

Si al filtrar ese candidato no existe otro insight que supere el umbral vigente:
- mostrar menos insights;
- no forzar un reemplazo débil.

No crear ahora una nueva función de Home. Los insights globales tipo “tu mejor compañero histórico” conceptualmente pertenecen a una superficie longitudinal como `Tu momento`, pero moverlos allí queda fuera de esta ronda.

### Copy

Cuando el balance con un compañero actual sí sea elegible, preferir copy explícito:
- `Con Gusti ganaste 8 de 11 partidos registrados.`

Evitar:
- `Tu mejor balance es con Gusti: 8 en 11.`

Actualizar `BRAMU_Intelligence.md` para dejar esta regla como fuente maestra, sin contradecir umbrales ni sistema de relevancia vigente.

## 4. Alcance técnico

### AGREGAR
- tests focalizados para la nueva regla de relevancia relacional de Intelligence;
- tests visuales/DOM necesarios para los ajustes anteriores.

### FUSIONAR
- regla de selección de Intelligence con el motor determinístico existente;
- mini-partido de duplicado con datos de @usuario ya disponibles, sin crear un sistema paralelo.

### REEMPLAZAR
- altura fija innecesaria cuando Home tiene una sola tarjeta;
- contadores ámbar de la card Pendientes por blanco/neutro;
- cantidad aislada a la derecha de cada sección por heading `TÍTULO · N`;
- gap de 22px del disclaimer por 5px;
- copy ambiguo `8 en 11` por frase explícita.

### NO TOCAR
- `main`;
- Production;
- BRAMUlive;
- Team A/B canónico;
- lógica de claim/recovery;
- ventana Recuperados 30 días;
- gate 3/4/5;
- fórmula de Nivel;
- Ranking publicado;
- Grupos;
- dedupe SAME;
- persistencia `resolved_different` ya validada;
- backend final de deduplicación;
- acciones/orden funcional del modal de duplicado;
- arquitectura de pantalla propia Pendientes.

## 5. Versión

Es una ronda visible que Sebastián revisará.

Usar:
- **BRAMUlab V04.35**
- bundle **04.35-h1**

Sincronizar versionado según `Metodo_Trabajo.md`.

## 6. Pruebas necesarias

No repetir batería histórica.

Mínimo:
- focales de Home/Pendientes/modal duplicado/Intelligence;
- test de Intelligence: un candidato de compañero externo al partido queda fuera;
- test de Intelligence: compañero actual elegible sigue pudiendo aparecer;
- test de fallback: si al filtrar no hay candidato suficiente, se muestran menos insights y no se fuerza uno débil;
- test de copy explícito de balance;
- suite pertinente completa porque cambia selección compartida de Intelligence;
- si se modifica código de la Edge Function `get-match-intelligence`, dejar explícito si requiere redeploy en Supabase Staging y no asumir que el push de Git lo hace.

No hace falta nueva migración salvo evidencia técnica real. Si aparece necesidad de migración, detener y marcar DECISIÓN ABIERTA antes de inventarla.

## 7. Git / deploy

- solo `staging`;
- una única ronda;
- idealmente un único commit/push funcional de Claude;
- revisar diff antes de push;
- no micro-pushes;
- no tocar BRAMUlive;
- Production prohibida.

## 8. Salida esperada

Crear un único resultado:
`docs/BRAMUlab/Implementacion/Pre_Production/135_Resultado_Ajustes_Finales_V0435_06OCT.md`

Debe incluir:
- HEAD final;
- archivos tocados;
- si hubo o no cambio/redeploy de Edge Function;
- tests y resultado;
- qué se modificó exactamente;
- cualquier residual real;
- qué requiere Central para gate final.

Después:
1. Central revisa diff/tests/Edge/Vercel;
2. QA humano mínimo solo de los elementos cambiados;
3. si PASS, cerrar Issue #29 y el bloque Invitados / Recuperados / Pendientes;
4. no avanzar a Production automáticamente;
5. recién entonces recibir el traspaso de Brainstorming.
