# BRAMUlab V04.10 — Handoff de pulido final de Nivel

**Base:** BRAMUlab V04.9 online y documentación reorganizada.  
**Baseline:** 1394/1394 tests.  
**Commit documental previo:** `6270620`.  
**Objetivo:** cerrar un último paquete corto de UX/UI detectado en la revisión visual real de V04.9, sin reabrir Nivel, Ranking, Intelligence ni Backend.

## Regla de lectura

Antes de trabajar:

1. leer `docs/BRAMUlab/README.md`;
2. usar este handoff como especificación de la ronda;
3. inspeccionar solo los archivos/selectores implicados.

No hacer auditoría general.  
No releer V03.  
No releer V1.4.  
No investigar nuevamente Nivel BRAMU.

La fuente normativa vigente de Nivel sigue siendo `Nivel_BRAMU_Formula_V1.5.md`.

---

## 1. TU PERFIL — volver el avatar arriba

La composición con avatar a la izquierda y Nombre/Apellido/@usuario a la derecha no funcionó visualmente.

### REEMPLAZAR

Volver a una composición vertical:

- avatar/foto arriba, centrado;
- debajo: Nombre;
- Apellido;
- @usuario;
- Nombre visible;
- resto del formulario.

### CONSERVAR

- iniciales dinámicas a partir de nombre/apellido;
- si existe foto, la foto reemplaza iniciales;
- icono/estado neutro antes de tener datos;
- edición/carga de foto existente;
- validaciones actuales.

No volver a inventar otra arquitectura lateral.

---

## 2. Fecha de nacimiento + Género

### FUSIONAR visualmente

En mobile 375 px, ubicar:

- Fecha de nacimiento
- Género

en la misma fila, con dos columnas equilibradas.

Ambos controles deben:

- tener la misma altura visual;
- compartir baseline/alineación;
- mantener legibilidad;
- conservar tap targets cómodos;
- no generar overflow.

No cambiar el significado ni la validación de ninguno.

---

## 3. Ubicación obligatoria — salida si no aparece

Ubicación sigue siendo obligatoria.

Problema: un usuario no puede quedar bloqueado si el selector no encuentra su localidad.

### AGREGAR

Cuando una búsqueda de ubicación no arroje coincidencias útiles, ofrecer una acción discreta:

**No encuentro mi ubicación**

Al usarla, permitir carga manual mínima de:

- Localidad
- Provincia

y guardar una etiqueta visible coherente, por ejemplo:

`Bella Vista, Buenos Aires`

### LÍMITE IMPORTANTE

Una ubicación ingresada manualmente no debe inventar un ID geográfico validado ni volver automáticamente elegible al usuario para un ranking territorial oficial.

Si la estructura actual distingue IDs/keys normalizadas, conservar esa diferencia. El dato manual sirve para completar el perfil y mostrar ubicación; la futura normalización/validación territorial queda para Backend/Ranking real.

No modificar `Ranking_BRAMU.md` ni la lógica normativa de Ranking en esta ronda.

---

## 4. Pantalla posterior al perfil

La pantalla actual dice `TU PERFIL ESTÁ LISTO`, pero todavía falta definir Nivel.

### REEMPLAZAR

Título:

**YA CASI ESTAMOS**

CTA principal:

**DEFINIR MI NIVEL**

CTA secundario:

**IR A MIS DATOS**

Mantener el copy:

`Podés completar tu WhatsApp más adelante desde Mi Perfil.`

No rediseñar el resto de la pantalla salvo lo necesario para estos cambios.

---

## 5. Estado de Nivel antes del cuestionario

En `YA CASI ESTAMOS`, antes de que el usuario confirme su Nivel, la tarjeta NO puede mostrar:

`CALIBRANDO · 0/5`

porque todavía no existe un Nivel confirmado.

### CORREGIR

Antes de confirmar Nivel:

**PENDIENTE**

Después de confirmar Nivel:

**CALIBRANDO · X/5 PARTIDOS**

Esta regla debe ser consistente con Home, Mi Perfil y Perfil público.

No inventar un número ni progreso de calibración antes de confirmar Nivel.

---

## 6. Cuestionario — último ajuste tipográfico

La estructura, preguntas, respuestas y comportamiento de V04.9 están bien.

No cambiar contenido ni lógica.

### AJUSTAR únicamente las opciones del cuestionario

- título/nombre de opción: mantener jerarquía alrededor de `font-weight: 500`;
- descripción: `font-weight: 400`;
- descripción: alrededor de `13px`;
- mantener un `line-height` cómodo cercano al actual mejorado;
- conservar separación/padding logrados en V04.9.

Estos valores son dirección visual; ajustar solo si el CSS real necesita una diferencia mínima para quedar consistente.

No aplicar este cambio globalmente al resto de la app.

---

## 7. No regresión — CALIBRANDO

V04.9 resolvió correctamente el estado CALIBRANDO.

### CONSERVAR

Home nuevo:

- identidad izquierda;
- `NIVEL BRAMU` + número arriba a la derecha;
- `CALIBRANDO · X/5 PARTIDOS` en la banda inferior;
- progreso fino;
- historial debajo.

Mi Perfil nuevo:

- misma geometría que usuario calibrado;
- Nivel arriba a la derecha;
- estado de calibración compacto;
- bloque `EVOLUCIÓN DEL NIVEL BRAMU` en estado CALIBRANDO cuando corresponda.

Cuenta madura/calibrada (ej. Seba 5.5):

- no cambiar su arquitectura;
- no cambiar barra/evolución;
- no introducir regresiones.

Ranking de usuario no elegible/sin posición:

- conservar comportamiento actual.

---

## 8. Fuera de alcance

NO TOCAR:

- `level.js`;
- `level-context.js`;
- `level-calibration.js` en su matemática normativa;
- `nivel_bramu_v1_0`;
- `nivel_inicial_v1_1`;
- pesos/anclas/fixtures matemáticos;
- reglas de calibración/recalibración;
- Ranking BRAMU;
- BRAMU Intelligence;
- Backend/Infraestructura;
- historial/estadísticas;
- navegación general;
- diseño global de Home/Perfil.

No agregar nuevas funciones.

---

## 9. Verificación

Revisar manualmente al menos:

- TU PERFIL vacío;
- TU PERFIL con nombre/apellido e iniciales;
- Fecha + Género en 375 px;
- ubicación encontrada;
- búsqueda sin resultados + fallback manual;
- YA CASI ESTAMOS antes del Nivel;
- cuestionario;
- Home CALIBRANDO;
- Mi Perfil CALIBRANDO;
- Home/Perfil de cuenta calibrada.

No aceptar overflow, solapamientos ni cambios de altura innecesarios.

---

## 10. Tests, versión y documentación

Baseline: **1394/1394**.

Mantener todo verde.

Agregar tests dirigidos solo donde el harness existente lo haga barato, especialmente:

- `PENDIENTE` antes de confirmar Nivel;
- `CALIBRANDO` después de confirmar;
- fallback manual de ubicación si existe una rama fácilmente testeable.

Cerrar como versión plana:

**BRAMUlab V04.10**

Actualizar el versionado público completo que use el proyecto.

Actualizar únicamente lo necesario en:

- `docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md`
- `docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Consolidado.md`
- `docs/BRAMUlab/README.md` para reflejar V04.10 como estado actual.

Al finalizar, este handoff queda consumido. Moverlo a:

`docs/BRAMUlab/Archivo/BRAMUlab_V04/BRAMUlab_V04.10_Handoff.md`

Luego:

1. tests;
2. commit;
3. push a `origin/main`;
4. verificar deploy online.

No pedir una segunda autorización si no aparece una contradicción real.

---

## 11. Respuesta final

Responder corto con:

- archivos tocados;
- tests;
- versión;
- commit;
- push/deploy;
- cualquier excepción real.

Después detenerse para revisión visual humana.
