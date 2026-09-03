# BRAMU Lab — Etapa 3 · Fase 2 · Correcciones postprueba

**Estado:** AUTORIZADO PARA IMPLEMENTAR  
**Fecha:** 02 SEP 2026  
**Aplicación:** BRAMU Lab principal (`bramulab/`)  
**Versión de partida:** v1.1  
**Versión objetivo:** v1.2  
**Base técnica verificada:** commit `087634e041b851e8a7e728b9cc53d2bd8690057c` · 373/373 tests OK  
**Fuera de alcance:** BRAMU Lab Partidos (`bramulab-partidos/`) y toda la Fase 3.

---

## 1. Objetivo

Cerrar la Fase 2 después de la prueba real en iPhone, corrigiendo cuatro puntos puntuales detectados en uso:

1. La entrada correcta a la aplicación.
2. La compacidad y jerarquía de la franja de partido en curso.
3. La visualización del resultado parcial completo.
4. La repetición del título «Partido en curso» dentro de la hoja inferior.

No rediseñar otras tarjetas, no iniciar la Fase 3 y no agregar nuevas funcionalidades.

---

## 2. Lo validado en la prueba real

El flujo implementado en v1.1 funciona correctamente:

- El botón central `+` abre «Registrar partido».
- «Cargar mi partido jugado» y «Registrar partido en vivo» conducen a los flujos correctos.
- El segundo nivel permite elegir «Game por game» o «Punto por punto».
- Un partido en vivo puede abandonarse mediante navegación intencional hacia Inicio.
- Al cerrar y volver a abrir la app durante un partido en vivo, se recuperan la pantalla, los jugadores y el marcador exacto.
- Desde Inicio se puede volver al partido en curso.
- La hoja contextual del botón `+` reconoce que existe un partido en curso.

Estas conductas deben preservarse.

---

## 3. Correcciones autorizadas

### 3.1 Entrada correcta a BRAMU Lab

La pantalla predeterminada de la aplicación debe ser el Home del jugador —la pantalla con las tarjetas— y no «Configurar partido».

Reglas:

- Si existe un partido en vivo válido y sin terminar, al abrir o reabrir la app se continúa directamente en ese partido, conservando estado y marcador.
- Si no existe un partido en vivo, la entrada predeterminada es el Home del jugador.
- Si todavía no existe identidad local del jugador, mostrar primero el flujo actual «¿Quién sos?» y, al completarlo, entrar al Home.
- La pantalla actual de jugadores, formato y puntuación pasa a cumplir exclusivamente la función «Configurar partido».
- «Configurar partido» se alcanza desde:
  - `+` → «Registrar partido en vivo» → «Game por game»; o
  - `+` → «Registrar partido en vivo» → «Punto por punto»; o
  - un acceso explícito que diga «Configurar partido», si ya existe y corresponde mantenerlo.
- No romper el ingreso directo o la recuperación de rutas/estados existentes.

### 3.2 Franja compacta de partido en curso en el Home

La versión actual ocupa demasiado alto y se lee como una tarjeta principal. Debe convertirse en una franja compacta y claramente accionable.

Jerarquía propuesta:

- La franja continúa debajo del encabezado y antes de las demás tarjetas.
- Toda la superficie de la franja es tocable y continúa el partido.
- A la izquierda:
  - indicador/latido;
  - etiqueta «PARTIDO EN CURSO»;
  - equipos;
  - resultado parcial completo y modo.
- A la derecha: acción compacta `Continuar ›`.
- Eliminar el botón lima grande «CONTINUAR».
- Reducir materialmente la altura y los espacios verticales.
- Resolver nombres largos de manera responsive sin volver a aumentar innecesariamente la altura.
- Mantener el verde lima como señal de actividad.
- Hacer el latido un poco más perceptible mediante contraste o amplitud, sin acelerarlo ni volverlo invasivo.
- Respetar `prefers-reduced-motion`.

La franja debe comunicar «hay algo activo y podés retomarlo», no competir con todo el Home.

### 3.3 Resultado parcial completo

Cuando el partido ya tiene uno o más sets terminados, el resumen no debe mostrar solamente el set actual.

Ejemplo:

- Primer set terminado: `6–4`
- Segundo set en curso: `3–4`
- Resumen visible: `6–4 · 3–4`

Reglas:

- Mostrar todos los sets completados y el set actual.
- Aplicar la misma lógica tanto a «Game por game» como a «Punto por punto».
- Obtener la información del estado real del motor existente; no duplicar ni inventar reglas de puntuación.
- El modo de registro se mantiene separado del resultado, por ejemplo: `6–4 · 3–4 · Game por game`.
- Antes de que haya avances, usar una representación consistente con el motor actual, por ejemplo `0–0`.
- Reutilizar un helper puro y central para evitar diferencias entre la franja del Home, la hoja contextual y futuras superficies.
- Si el motor ya contempla tie-breaks o sets especiales, reflejarlos mediante su estado existente sin crear nueva lógica deportiva dentro de esta corrección.

Casos mínimos de prueba:

- Primer set en curso.
- Segundo set con el primero terminado.
- Tercer set con dos sets terminados.
- Game por game.
- Punto por punto.
- Tie-break o estado especial, si ya está soportado por el motor actual.

### 3.4 Quitar la repetición en la hoja inferior

En la hoja contextual abierta desde el botón `+` durante un partido activo:

- El título de la hoja debe ser «Registrar partido».
- «PARTIDO EN CURSO» debe aparecer una sola vez, dentro de la tarjeta contextual.
- Mantener dentro de la tarjeta:
  - equipos;
  - resultado parcial completo;
  - modo;
  - acción «Continuar partido».
- Mantener debajo la acción neutral «Registrar partido nuevo».
- Conservar el aviso y la confirmación destructiva ya definidos si se intenta crear otro partido mientras hay uno activo.

La hoja puede conservar el tratamiento visual de sus etiquetas según el sistema actual, pero el texto semántico y la jerarquía deben ser los anteriores.

---

## 4. Versión, caché y actualización

Esta entrega debe publicarse como **BRAMU Lab v1.2**.

Actualizar de manera consistente únicamente en `bramulab/`:

- identificador visible de versión;
- `version.json`;
- constante/versionado interno correspondiente;
- nombre de caché del service worker;
- aviso de nueva versión, si corresponde al mecanismo ya existente.

No modificar versión, caché, manifest ni código de `bramulab-partidos/`, que debe seguir congelado en v14.

---

## 5. Verificación obligatoria

Antes de dar por terminada la corrección:

1. Ejecutar la suite completa existente y mantener todos los tests previos en verde.
2. Agregar tests específicos para las cuatro correcciones.
3. Verificar que sin partido activo la app entra al Home.
4. Verificar que con partido activo la app reabre el marcador exacto.
5. Verificar navegación intencional al Home y retorno mediante la franja compacta.
6. Verificar el parcial completo en al menos dos sets.
7. Verificar ambos modos en vivo.
8. Verificar la hoja contextual sin título duplicado.
9. Verificar cierre, toque fuera y deslizamiento de la hoja donde el entorno de test lo permita.
10. Verificar responsive en ancho de iPhone y escritorio/tablet.
11. Verificar que `bramulab-partidos/` permanezca byte a byte o funcionalmente intacto según el control habitual.
12. Si todo queda verde, hacer commit, push y confirmar el despliegue real de GitHub Pages.

---

## 6. Informe de cierre

Crear un informe autocontenido en:

`docs/bramulab/informes/BRAMU_Lab_Etapa_3_Fase_2_Correcciones_Postprueba_Informe.md`

Debe incluir:

- resumen de lo implementado;
- archivos modificados;
- decisiones técnicas menores tomadas;
- tests agregados y resultado total;
- versión y caché resultantes;
- commit y estado del push;
- verificación de GitHub Pages;
- confirmación expresa de que BRAMU Lab Partidos no cambió;
- limitaciones o validaciones táctiles que deban probarse en iPhone;
- cualquier desvío respecto de este consolidado, con su justificación.

No avanzar a la Fase 3 dentro de este trabajo.

---

## 7. Criterio de cierre

La Fase 2 queda cerrada cuando:

- la app entra al Home si no hay partido activo;
- recupera directamente un partido activo;
- la franja del Home es compacta y totalmente accionable;
- el parcial incluye todos los sets relevantes;
- la hoja contextual no repite «Partido en curso»;
- BRAMU Lab está publicada como v1.2;
- la suite completa está verde;
- BRAMU Lab Partidos permanece intacta;
- existe el informe de cierre.

Después de esa confirmación se puede abrir un chat nuevo con Claude y comenzar la Fase 3 usando este consolidado, su informe y los documentos maestros como contexto.
