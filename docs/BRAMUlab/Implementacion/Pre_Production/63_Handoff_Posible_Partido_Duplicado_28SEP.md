# Handoff — Posible partido duplicado / desambiguación focal

**Fecha:** 28/09/2026  
**Entorno:** solo staging  
**Baseline funcional previa:** BRAMUlab V04.11 / bundle 04.11-h25  
**No tocar:** main, Production, BRAMUlive, visual h21–h25 aprobado, Grupos.

## Problema confirmado

Caso real de Staging:

- mismos 4 jugadores;
- mismas parejas;
- mismo formato;
- otra carga dentro de la ventana actual de ±3 h;
- marcador diferente.

Hoy `create_or_attach_match` encuentra un único partido candidato. Si ese candidato ya está validado y el score difiere devuelve:

`validated_match_needs_bloque6_correction`

El frontend guarda entonces el borrador local como `necesita_revision` y Home muestra **NECESITA REVISIÓN**. Para el usuario parece un error genérico y el nuevo encuentro no aparece del otro lado.

La regla de detección actual no es el problema: en la vida real esa coincidencia es rara y conviene advertir. Pero pueden existir dos partidos reales consecutivos entre las mismas cuatro personas.

## Decisión de producto

**FUSIONAR / corregir de forma mínima:**

Cuando existe un candidato cercano con mismos 4 jugadores + mismas parejas + formato compatible y el score NUEVO difiere, BRAMU no debe decidir solo que es una corrección ni dejarlo como error genérico.

Debe pedir confirmación explícita:

- **Es el mismo partido** → continuar por el flujo de corrección ya existente; no crear una segunda lógica de correcciones.
- **Es otro partido** → crear un `match_id` nuevo usando el mecanismo `disambiguationForceNew` ya existente.

Reutilizar el modal/infraestructura de desambiguación existente. Adaptarlo para que funcione también con **un único candidato**.

### Copy

Mientras esta coincidencia esté sin resolver, NO mostrar **NECESITA REVISIÓN**.

Usar un estado claro tipo:

**POSIBLE PARTIDO DUPLICADO**

y un CTA de revisión/desambiguación coherente.

`NECESITA REVISIÓN` puede seguir existiendo para otros errores de negocio que realmente requieran corregir datos.

## NO CAMBIAR

- no cambiar la ventana ±3 h en esta ronda;
- no agregar límite de cantidad de partidos consecutivos;
- no rediseñar el flujo de carga;
- no tocar create-or-attach fuera de este caso;
- no reabrir validación/correcciones ya cerradas;
- no hacer auditoría general.

## Pruebas focales mínimas

1. mismos 4 + mismas parejas + dentro de ±3 h + mismo score → comportamiento actual de attach/conformidad;
2. mismos 4 + mismas parejas + dentro de ±3 h + score diferente → pide desambiguación explícita;
3. elegir **Es el mismo partido** → deriva al flujo de corrección vigente, sin duplicar partido;
4. elegir **Es otro partido** → crea un match nuevo;
5. fuera de la ventana → crea nuevo como hoy;
6. múltiples candidatos → conserva la desambiguación existente;
7. Home/Resumen no muestran `NECESITA REVISIÓN` para este caso, sino el copy específico de posible duplicado.

## Ejecución

Trabajar autónomamente. Leer solo:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Experiencia_Inicial.md`
4. este handoff

Inspeccionar únicamente los archivos/migraciones necesarios para `create_or_attach_match`, outbox y modal existente.

Hacer tests focales. Suite amplia solo si aparece riesgo transversal real.

Al terminar: diff revisado → commit lógico → push a `origin/staging` → resultado corto en repo. No tocar Production.
