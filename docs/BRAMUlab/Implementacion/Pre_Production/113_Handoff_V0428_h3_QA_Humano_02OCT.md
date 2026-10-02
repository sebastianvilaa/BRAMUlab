# BRAMUlab V04.28 — Handoff h3 post-QA humano

**Fecha:** 02/10/2026  
**Rama:** `staging`  
**Base funcional:** `48d29c2ca5de08be9feb58a0e77108326bfbc2cf` — V04.28 / 04.28-h2  
**HEAD previo a este documento:** `558de20f2b53ea7df0afb6a749601a8a2a830de1` — commit docs-only de invitados/recuperación de identidad; conservarlo.  
**Issue:** #25 sigue abierto.  
**Objetivo:** una única ronda h3 de pulido UX + un bug de reanudación del alta detectados en QA real de iPhone. No reabrir V1.3.

## 1. QA real confirmado

Alta real completada en Staging con `@sebastian_vila`.

Persistencia server-side verificada por Central:
- status: `CALIBRANDO`
- mu: `5.32` (UI 5.3)
- confidence: `0.15`
- rated_matches: `0`
- distinct_opponents: `0`
- questionnaire_version: `nivel_inicial_v1_3`
- questionnaire_mode: `full`
- algorithm_version: `nivel_bramu_v1_0`
- `level_events.initial_estimate` persistido con `confirmedLevel=5.32`.

Adaptatividad observada en iPhone: PASS.  
Slider vertical: aprobado como dirección.  
Edge Function `officialize-onboarding`: ACTIVE v13 / JWT ON.  
No tocar DB/backend en esta ronda.

## 2. Intro de Nivel — legibilidad

No rediseñar la pantalla.

Mantener el copy actual:
> Pensá en cómo jugás habitualmente, no en tu mejor ni en tu peor partido. Cuanto más realista seas, mejor será tu punto de partida.

Ajustar:
- mayor contraste (cercano a blanco, sin competir con título/CTA);
- tamaño ligeramente mayor;
- más aire/interlineado para mejorar lectura.

`5 PREGUNTAS · CERCA DE 2 MINUTOS`:
- un poco más grande;
- más contraste;
- sigue siendo secundario.

## 3. Slider V1.3 — refinamiento visual confirmado

Mantener:
- orientación vertical;
- diez posiciones internas exactas;
- snap 0..9;
- tap directo en tarjetas 0/3/6/9;
- nada preseleccionado;
- CTA disabled sin interacción;
- mismas preguntas/copy/fórmula/ramas.

### Copy auxiliar
Reemplazar por:
> **Tocá una descripción. Si estás entre dos opciones, usá el control para ajustar tu respuesta.**

### Rail
- mantenerlo neutro/oscuro; no convertirlo en escala verde ni multicolor;
- ocultar visualmente los 6 dots intermedios;
- mostrar solo los 4 checkpoints-ancla alineados con las 4 tarjetas;
- los 10 puntos internos siguen existiendo funcionalmente aunque 6 no se dibujen.

### Thumb
- conservar azul/cyan BRAMU;
- agregar un pequeño pico/indicador hacia la derecha para que se perciba que el control “apunta” a las tarjetas;
- no reducir el área táctil.

### Énfasis de tarjetas
Hoy, en una posición intermedia, ambas tarjetas vecinas reciben el mismo énfasis. Cambiarlo para reflejar cercanía.

Con 2 pasos intermedios por segmento:
- ancla izquierda: 100 / 0;
- primer intermedio: aprox. 67 / 33;
- segundo intermedio: aprox. 33 / 67;
- ancla derecha: 0 / 100.

El porcentaje es guía visual, no dato de producto.

Implementar la ponderación mediante fondo/borde/glow/intensidad del tratamiento activo. **No bajar opacidad del texto** ni perjudicar legibilidad.

## 4. Resultado inicial — CALIBRANDO

En la pantalla `TU PUNTO DE PARTIDA EN BRAMU`:
- el número (ej. 5.3) debe ser ámbar, consistente con el estado `CALIBRANDO`;
- `CALIBRANDO` permanece ámbar;
- el arco puede mantenerse azul;
- no agregar categoría ni información nueva.

## 5. Bug real — volver desde OTP obliga a repetir las 5 preguntas

Flujo reproducido:
1. completar 5 preguntas;
2. ver resultado;
3. `CONFIRMAR MI NIVEL`;
4. llegar a confirmación de email/OTP;
5. volver atrás a Perfil;
6. volver a Nivel.

Estado actual:
- `signupDraft.nivelState` y `signupDraft.nivelAnswers` ya existen;
- `NIVEL_PROGRESS` se limpia al confirmar;
- `openNivelOnboardingIntro()` solo reconstruye desde `NIVEL_PROGRESS`;
- resultado: el usuario debe responder de nuevo las 5 preguntas.

Comportamiento correcto:
- hasta que el alta quede oficializada, el Nivel ya confirmado localmente debe seguir recuperable;
- volver desde OTP y reentrar a Nivel debe llevar al resultado ya calculado, con respuestas disponibles;
- `Revisar respuestas` debe permitir volver al cuestionario conservando las respuestas;
- si una respuesta cambia de rama, aplicar la invalidación adaptativa ya vigente;
- una vez oficializada la cuenta con éxito, limpiar el borrador/progreso como hoy.

Resolver con la mínima fuente estable posible:
- reconstruir desde `signupDraft.nivelAnswers/nivelState`, o
- posponer la limpieza de `NIVEL_PROGRESS` para el contexto draft hasta oficialización.

Elegir la variante más simple/segura sin crear dos autoridades contradictorias.

No tocar Auth/OTP más allá de lo necesario para preservar este estado local.

## 6. Home Estado Cero — única mejora aprobada

La estructura actual de Home Estado Cero es PASS y no debe rediseñarse.

Único cambio: hacer más protagonista la tarjeta que hoy representa el primer partido.

Cuando el jugador tiene 0 partidos asociados y corresponde `Cargar primer partido`, usar:

**Eyebrow:** `PRIMER PARTIDO`

**Título:** `CARGÁ TU PRIMER PARTIDO`

**Bajada:**  
`Registrá el resultado y empezá a construir tu historial en BRAMU.`

**CTA lima full-width:**  
`CARGAR PARTIDO`

Visual:
- misma familia de tarjeta oscura;
- conservar el borde/acento ya coherente con Estado Cero;
- más jerarquía mediante título + bajada + botón lima;
- no crear hero nuevo ni otro onboarding.

No tocar `TU MOMENTO`, `Buscar jugadores`, identidad/Nivel ni reglas de progresión.

Regresión crítica:
- si ya existe un partido real pendiente, la tarjeta debe seguir mostrando ese partido y su estado; no mostrar la CTA de “primer partido”.

## 7. Fuera de alcance

NO tocar:
- fórmula V1.3;
- anclas;
- umbrales/ramas;
- confianza;
- `nivel_bramu_v1_0`;
- Edge Function;
- Supabase/DB;
- recalibración ni UX de RECALIBRANDO;
- Ranking;
- Grupos;
- Cargar partido;
- BRAMUlive;
- main/Production;
- otros ajustes generales del alta (username disponible, etc.); se revisarán en un frente separado.

## 8. Versionado

Versión visible: `BRAMUlab V04.28`  
Bundle objetivo: `04.28-h3`.

Actualizar versionado/cache/query strings siguiendo el patrón vigente.

## 9. QA esperado

Focal:
1. intro más legible en iPhone;
2. 4 anclajes visibles, 10 posiciones funcionales;
3. thumb con pico y touch correcto;
4. exacto 100% / intermedios 67-33 y 33-67 visuales;
5. adaptatividad intacta;
6. volver/cambiar rama intacto;
7. resultado con número ámbar;
8. confirmar Nivel → OTP → volver → reentrar a Nivel recupera resultado/respuestas;
9. Revisar respuestas conserva estado;
10. oficialización final limpia borradores como antes;
11. Home 0 partidos muestra nueva tarjeta;
12. Home con pendiente real no muestra CTA de primer partido;
13. regresión mínima V1.3 + versionado h3.

## 10. Documentación

En h3 actualizar solo estado/resultado real e Issue #25.

**NO consolidar todavía** `docs/BRAMUlab/Nivel_BRAMU.md` como única fuente maestra. Esa consolidación sigue pendiente del PASS humano final posterior a h3.
