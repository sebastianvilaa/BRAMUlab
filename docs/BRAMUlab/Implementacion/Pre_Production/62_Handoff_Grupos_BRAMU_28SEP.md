# Handoff — Grupos BRAMU productivo

**Fecha:** 28/09/2026  
**Destino:** Claude Code / Desarrollo  
**Entorno:** únicamente staging  
**No tocar:** main, Production ni BRAMUlive.

---

## Objetivo

Llevar Grupos BRAMU desde la base V03.4/local existente a una experiencia productiva y server-backed, preservando lo que ya funciona y aplicando únicamente los cambios cerrados en la nueva fuente maestra.

La definición de producto está cerrada. No reabrir decisiones de UX ni rediseñar Grupos desde cero.

## Leer primero

1. docs/BRAMUlab/README.md
2. docs/BRAMUlab/Metodo_Trabajo.md
3. docs/BRAMUlab/Grupos_BRAMU.md
4. docs/BRAMUlab/Backend_Infraestructura.md
5. Para sistema visual vigente: docs/BRAMUlab/Implementacion/Pre_Production/59_Handoff_Sistema_Visual_Unificado_h21_27SEP.md

Después inspeccionar la implementación actual real:
- bramulab/groups.js
- bloque Grupos de bramulab/app.js
- markup de Grupos en bramulab/index.html
- estilos asociados en bramulab/styles.css
- store/auth/server-backed patterns existentes.

No leer Archivo/Backup ni reabrir V03.4 salvo una necesidad de trazabilidad puntual.

---

## Regla central

**Conservar la experiencia actual de grupo armado.**

No rediseñar:
- selector de grupos;
- tabs;
- tabla;
- Race;
- BRAMU Intelligence;
- Configuración;
- admins;
- quitar miembro;
- eliminar grupo.

La ronda se concentra en productivización + cambios explícitos del documento maestro.

---

## Trabajo requerido

### AGREGAR

1. Estado cero / mini onboarding de Grupos BRAMU.
2. Preview funcional marcada como EJEMPLO.
3. CTA Crear mi grupo.
4. Acceso Cómo funciona.
5. Estado post-creación Tu grupo está listo.
6. Persistencia server-backed real de grupos y membresías para Staging.
7. Permisos/RLS/operaciones server-side mínimas necesarias.

### FUSIONAR

1. La hoja existente ¿Cómo se suman los puntos? debe evolucionar a Cómo funcionan los Grupos BRAMU.
2. Reutilizar esa misma hoja desde un icono ? en el header; no crear ayuda duplicada.
3. Selector de jugadores: reutilizar identidad server-backed real, avatar real, @usuario y Nivel real.
4. Reutilizar verdad oficial de partidos y Nivel histórico disponible; no crear una segunda fuente.

### REEMPLAZAR

1. Header principal MIS GRUPOS → GRUPOS BRAMU.
2. CTA lima macizo Agregar jugador → familia secundaria lima existente.
3. El toast Grupo creado deja de ser el único cierre; incorporar el estado breve aprobado.
4. Una vez validado el ?, retirar el enlace inferior redundante de puntos si duplica exactamente la misma ayuda.

### NO TOCAR

Todo lo enumerado en Grupos_BRAMU.md §18, incluida la lógica deportiva cerrada salvo adaptación necesaria para fuentes server-backed oficiales.

---

## Backend mínimo

No usar localStorage como autoridad productiva.

Diseñar la mínima estructura compatible con el backend actual para:
- grupos;
- membresías históricas;
- rol admin;
- lectura compartida;
- mutaciones autorizadas;
- cálculo reproducible de puntos/bonuses;
- semana actual/anterior;
- Race anual.

Identidad por player_id.

Para bonus Sorpresa:
- usar Nivel oficial anterior al partido;
- si no hay evidencia suficiente, no otorgar el bonus;
- nunca usar el estimador simulado legacy como verdad de Production.

Los partidos que puntúan deben venir del contrato oficial/computable ya existente.

---

## Pruebas por riesgo

Hacer pruebas adicionales únicamente donde agregan evidencia real:

- persistencia multiusuario;
- RLS/permisos;
- admin único/múltiple;
- entrada/salida sin reescritura histórica;
- mismo partido en varios grupos;
- 3/4 miembros;
- 5/6/7 puntos y nunca 8;
- incompatibilidad Remontada/Victoria clara;
- top 3 semanal;
- empates 1,1,3;
- Race;
- avatar/identidad server-backed;
- regresión visual dirigida sobre la UI existente.

No repetir la suite visual completa de otras áreas si Grupos no las toca.

---

## Salida esperada

Trabajar autónomamente.

Si aparece una decisión humana verdaderamente nueva:
- marcar DECISIÓN ABIERTA;
- continuar todo lo demás que no dependa de ella.

Al terminar:
1. tests pertinentes;
2. diff revisado;
3. commit lógico;
4. push a origin/staging;
5. resultado documentado en docs/BRAMUlab/Implementacion/Pre_Production/.

No tocar Production.

---

## Criterio de cierre

La ronda no está cerrada solo porque “se vea como antes”.

Debe quedar demostrado que Grupos:
- usa verdad server-backed compartida;
- conserva la lógica aprobada;
- suma los cambios UX cerrados;
- no depende de mocks/localStorage como autoridad;
- queda listo para gate final de Staging antes de Production.
