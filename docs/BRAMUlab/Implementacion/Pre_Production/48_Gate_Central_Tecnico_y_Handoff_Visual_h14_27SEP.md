# BRAMUlab — Gate Central técnico + handoff de validación visual h14

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `301d3b365b204d12ea22818104f8306abacfa9d4`  
**Bundle:** `04.11-h14`  
**Fuente:** `45_Handoff_Cierre_UX_h13_27SEP.md`

## 0. Estado

**GATE TÉCNICO CENTRAL: PASS.**  
**GATE VISUAL CENTRAL: PENDIENTE.**

No declarar todavía `APTO PARA LABORATORIO`.

Central revisó:

- HEAD/diff completo de la ronda h14;
- `47_Resultado_Cierre_UX_h14_27SEP.md`;
- bundle `04.11-h14`;
- deploy GitHub/Vercel BRAMUlab = success;
- los puntos de riesgo principales del código del 45.

No hubo cambios de backend, main, Production, BRAMUlive, Mis grupos, fórmula de Nivel, Ranking ni Intelligence.

## 1. Hallazgos técnicos Central

### 1 — Nivel
PASS técnico:
- el camino V1 calibrado ya no usa 100% fijo;
- usa `PH.levelProgressPct(publicLevel)`;
- el delta sin evidencia real usa `--flat`;
- `.player-card__level-delta--flat{display:none}`, por lo que no queda chip vacío.

Pendiente visual real:
- comprobar 6.0 con barra al inicio/vacía;
- comprobar un decimal no entero con proporción correcta si hay una cuenta disponible.

### 2 — Último partido / corrección
PASS técnico + evidencia visual de Claude:
- slot reservado para estado;
- copy `CORRECCIÓN PENDIENTE`;
- score oficial no cambia;
- fila de forma + VICTORIA/DERROTA no depende de la presencia del badge.

Work debe corroborar sobre el deploy real.

### 3 — Grilla
PASS técnico + evidencia visual de Claude:
- `buildResultRowsHTML` compartida;
- divisor propio `.result-card__divider-row`;
- `grid-column:1/-1`;
- oficial/propuesta usan la misma primitiva.

Work debe corroborar 2 y 3 sets sobre deploy real.

### 4 — Oficial vs propuesta
PASS técnico + evidencia visual de Claude:
- rótulos centrados;
- misma grilla;
- `ML.buildCorrectionHumanSummary`;
- fallback neutro sin actor;
- diff técnico secundario;
- acciones con estructura compartida.

Work debe revisar jerarquía real y comprensión.

### 5 — Reportar error
PASS técnico:
- sentence case;
- tratamiento secundario;
- selector liviano/lista;
- opciones vigentes.

Work debe mirar composición real.

### 6 — Identidad continua
PASS técnico:
- copy `¿Seguro que no fue [Nombre]?`;
- luego abre el sheet de resolución;
- existe `No sé · dejar Por identificar`;
- filas canónicas con datos reales/Recientes.

Work debe recorrerlo si hay un partido seguro para QA sin afectar datos que no correspondan.

### 7 — Patrón de jugador
PASS técnico:
- rutas server-backed auditadas por `player_id`;
- las rutas por nombre plano restantes son legacy/local o Mis grupos fuera de alcance.

Work debe comparar al menos Matu desde dos superficies reales si el estado de Staging lo permite.

### 8 — Mi Perfil > Jugadores
PASS técnico + evidencia visual de Claude:
- buscador siempre visible;
- estado vacío sin pantalla puente;
- búsqueda global en el mismo espacio.

Work debe revisar vacío/listado/búsqueda sobre deploy real.

### 9 — Metadata Cargar partido
PASS técnico + evidencia visual de Claude:
- bloque único movido antes de equipos;
- sin duplicado;
- handlers preservados.

Work debe revisar móvil + desktop.

### 10 — sync_pending / necesita_revision
PASS técnico:
- `sync_pending` recibe explicación explícita;
- `Reintentar` usa `retryOneOutboxEntry`;
- conserva la MISMA `submissionId`;
- reintento automático conserva semántica previa;
- `necesita_revision` muestra motivo por `lastError.code`;
- ambigüedad reutiliza modal vigente;
- errores de negocio no se reintentan ciegamente;
- descartar sigue afectando solo outbox local.

Pendiente visual real:
- banner;
- jerarquía Reintentar/Corregir/Descartar;
- claridad del copy;
- diferencia entre sync y revisión.

### 11 — Notificaciones
PASS técnico:
- mapper único;
- actor/contexto/scores preservados;
- nuevos títulos humanos;
- identity_questioned no inventa nombre ausente;
- selfCaused/read/click preservados.

Pendiente visual real:
- legibilidad de títulos/cuerpo;
- no repetición;
- tono deportivo.

## 2. Gate visual — tarea de Work

Usar **el deploy real de BRAMUlab Staging correspondiente a h14**.

Antes de revisar, confirmar visualmente o mediante `version.json` que la app sirve:

- `BRAMUlab V04.11`
- bundle `04.11-h14`.

Trabajar solo en Staging. No tocar main/Production/BRAMUlive.

### Viewports mínimos

- móvil: aproximadamente 390×844;
- desktop: aproximadamente 1440×900.

### Revisar literalmente 1–11 del documento 45

No usar “se ve razonable” como criterio. Contrastar cada punto con su aceptación literal.

Prioridad visual:

1. Home Nivel: 6.0 debe verse vacío/al inicio, nunca lleno.
2. Último partido: comparar normal vs corrección; forma + VICTORIA/DERROTA no se mueven.
3. Resumen: 2 y 3 sets; las dos parejas deben leerse como tabla limpia con divisor continuo.
4. Oficial vs propuesta: debe entenderse de inmediato cuál es oficial, cuál propuesta, qué cambia y qué botón tomar.
5. Reportar un error: CTA secundario + sheet liviano.
6. Identidad: confirmación humana + continuidad directa al reemplazo/Por identificar.
7. Jugador canónico: mismo avatar/@usuario/Nivel/perfil por player_id en las superficies accesibles.
8. Perfil > Jugadores: buscador siempre visible; agregar desde el mismo espacio.
9. Cargar partido: metadata inequívocamente arriba de equipos, móvil + desktop.
10. Outbox: comprobar estados sync_pending y necesita_revision si pueden generarse de forma segura en Staging; no modificar semántica ni destruir datos reales ajenos.
11. Notificaciones: revisar ejemplos reales de validación/corrección/identidad si existen.

### Autenticación

Si el deploy requiere login y Work no tiene una sesión:

- pedir a Sebastián únicamente que complete el login/OTP en la ventana segura del navegador;
- nunca pedir contraseña/OTP por chat;
- continuar autónomamente después.

### Datos/estados difíciles

Para Nivel/outbox/notificaciones:
- usar primero estados reales ya existentes;
- si hace falta crear fixture, hacerlo solo con capacidades de laboratorio/Staging ya existentes y sin tocar Production;
- no inventar contenido solo para “hacer una captura”;
- si un estado no puede fabricarse de forma segura con las herramientas disponibles, marcarlo `NO VERIFICABLE VISUALMENTE` con razón concreta.

## 3. Salida de Work

Crear o devolver un informe corto con una tabla 1–11:

- PASS VISUAL;
- FAIL VISUAL;
- NO VERIFICABLE;
- evidencia concreta (pantalla/estado/viewport);
- observación exacta si falla.

No corregir producto por interpretación propia.

Si hay FAIL:
- capturar/describir el defecto;
- detener el gate;
- Central decide la corrección técnica.

Si todos son PASS, o los únicos NO VERIFICABLE están claramente justificados y Central decide que no bloquean:
- Central hará el cierre final y recién entonces fusionará decisiones en `05_Laboratorio_UX_Uso_Real.md`.

## 4. Estado actual

**NO volver todavía al Laboratorio físico de Sebastián.**

Siguiente paso: Work realiza este gate visual sobre h14.
