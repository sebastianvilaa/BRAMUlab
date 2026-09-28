# Handoff — análisis de impacto UX · Lobby de Grupos BRAMU

**Fecha:** 28/09/2026  
**Destino:** Desarrollo / Claude Code  
**Entorno de referencia:** staging  
**Modo:** ANÁLISIS ÚNICAMENTE — no implementar todavía.

---

## Contexto

Producto/UX acaba de cerrar una nueva decisión para la entrada a **Mis grupos**.

La fuente maestra ya fue actualizada:

- `docs/BRAMUlab/Grupos_BRAMU.md`

La Fase A backend compartido y la Fase B1 de wiring server-backed ya existen. B1 sigue pendiente de QA real multiusuario y **no debe reabrirse visualmente** por este análisis.

Resultado técnico más reciente:

- `docs/BRAMUlab/Implementacion/Pre_Production/68_Resultado_Grupos_Fase_B1_Wiring_ServerBacked_28SEP.md`

---

## Objetivo de este análisis

Determinar cómo incorporar el nuevo **lobby de Grupos BRAMU** en la futura Fase B2 sin romper ni sobrearquitectar lo ya construido.

No escribir código.
No tocar migraciones.
No cambiar bundle.
No hacer commit funcional.
No desplegar.

Sí dejar un informe corto en el repo con recomendación de implementación.

---

## Decisión de producto ya cerrada

La bottom-nav **Mis grupos** pasa a abrir siempre un lobby propio, incluso si el usuario tiene un solo grupo.

### Sin grupos
Se mantiene el mini onboarding ya definido, pero la preview EJEMPLO debe usar la misma tarjeta del lobby.

### Con grupos
Mostrar una tarjeta por grupo con:

- foto del grupo opcional;
- fallback con iniciales del nombre;
- nombre;
- cantidad de miembros activos;
- lectura de **Esta semana**;
- hasta 3 posiciones visibles con puntos;
- posición del usuario si queda fuera de las filas visibles;
- empates reales sin forzar oro/plata/bronce artificial;
- estados positivos para 1 miembro, 2 miembros y semana sin partidos.

Toda la tarjeta abre el grupo completo.

El grupo armado no se rediseña.

### Orden
Ordenar por actividad significativa más reciente del grupo, independientemente de si participó el usuario actual.

### Foto
La foto no es obligatoria durante la creación. Se edita luego por admins desde Configuración.

### Selector existente
Se conserva inicialmente dentro del detalle como cambio rápido entre grupos.

### Navegación
- Mis grupos → lobby
- tarjeta → detalle
- volver desde detalle → lobby

---

## Preguntas técnicas que debe resolver el análisis

### 1. Datos del lobby

Evaluar si los contratos actuales permiten construir el lobby eficientemente con varios grupos.

Hoy existen, entre otros:

- `list_my_groups`
- `get_group_detail`
- `get_group_competition_data`

Determinar si conviene:

A. reutilizar estos contratos con llamadas focales; o  
B. agregar una única lectura resumida para el lobby.

Evitar N llamadas costosas si una solución mínima server-side puede entregar directamente el resumen requerido.

No duplicar la fórmula deportiva.

### 2. Actividad reciente

Definir la forma más simple y autoritativa de obtener el orden por actividad significativa:

- partido oficial que entra al grupo;
- corrección oficial que cambia su verdad/puntos;
- membresía;
- admin;
- nombre;
- foto;
- creación.

Un partido que no califica para el grupo no debe moverlo.

Indicar si alcanza con datos existentes o si hace falta un timestamp/evento derivado adicional.

### 3. Foto del grupo

Evaluar el mínimo cambio compatible con el sistema vigente de Storage:

- campo/ruta de avatar de grupo;
- bucket/política reutilizable o recurso nuevo mínimo;
- lectura autenticada;
- edición solo admins;
- fallback sin foto.

No diseñar sistema multimedia nuevo.

### 4. Top semanal resumido

Definir cómo obtener para cada tarjeta:

- posiciones visibles;
- puntos;
- empate;
- posición del usuario cuando queda fuera del bloque visible;
- estado sin partidos.

Debe usar la misma verdad/fórmula de Grupos. No crear otro cálculo divergente solo para el lobby.

### 5. Integración B2

Proponer cómo dividir B2 para minimizar riesgo y deploys.

La recomendación debe decir claramente:
- qué reutilizar;
- qué agregar;
- qué no tocar;
- qué pruebas focales hacen falta;
- si existe alguna **DECISIÓN ABIERTA** humana real.

---

## Restricciones

- no tocar main;
- no tocar Production;
- no tocar BRAMUlive;
- no rediseñar la pantalla del grupo armado;
- no retirar todavía el selector existente;
- no convertir el lobby en dashboard;
- no inventar datos;
- no depender de localStorage como autoridad;
- no implementar chat, notificaciones, badges coleccionables ni funciones fuera de alcance.

---

## Salida esperada

Crear un único documento corto de análisis en:

`docs/BRAMUlab/Implementacion/Pre_Production/`

Debe incluir:

1. factibilidad;
2. impacto exacto en backend/frontend;
3. propuesta mínima;
4. riesgos reales;
5. plan recomendado para B2;
6. decisiones humanas abiertas, si las hubiera.

No implementar hasta revisión de Central.
