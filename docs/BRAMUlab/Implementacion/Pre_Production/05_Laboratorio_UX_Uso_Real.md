# Pre-Production — Laboratorio UX de uso real

**Fecha:** 23/09/2026  
**Estado:** activo hasta retomar implementación técnica.  
**Objetivo:** aprovechar los próximos días para probar BRAMUlab como jugador real, detectar fricciones visuales/UX y consolidar cambios antes de entregarlos a implementación.

## 1. Método

Sebastián prueba BRAMUlab directamente en Staging con sus propios dispositivos/cuentas.

Puede usar, por ejemplo:

- computadora;
- celular;
- dos cuentas distintas;
- recorridos reales de carga, validación, corrección, pendientes, historial, perfiles y Resumen.

Cuando encuentre algo:

1. envía captura o describe la pantalla;
2. explica cómo esperaba que se sintiera o funcionara;
3. ChatGPT central clasifica y documenta;
4. no se implementa inmediatamente salvo bug crítico;
5. al final se consolida un único paquete de cambios para implementación.

La meta es evitar microcambios y microdeploys durante la exploración.

## 2. Clasificación de cada hallazgo

Cada observación debe quedar en una de estas categorías:

### BUG

Algo contradice una regla ya cerrada o rompe el flujo.

Ejemplos:

- botón que no responde;
- estado incorrecto;
- dato falso;
- pantalla que muestra una acción que no corresponde.

### UX / VISUAL

La lógica funciona, pero la presentación no se siente bien.

Ejemplos:

- jerarquía incorrecta;
- botón demasiado protagonista;
- copy confuso;
- espaciado/layout;
- densidad excesiva;
- estado pendiente poco claro.

### PRODUCTO

La prueba revela que hay que decidir cómo debería funcionar algo.

Solo se interrumpe para una decisión humana si cambia materialmente el producto.

### YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA

La documentación ya contiene la decisión correcta, pero la app todavía no la refleja.

Ejemplo actual confirmado:

- Estado Cero / perfiles progresivos.

No presentar esto como idea nueva.

## 3. Qué conviene recorrer

Prioridad de uso real:

1. alta/login/recuperación;
2. Home Estado Cero;
3. carga de partido;
4. pendiente visto desde ambos lados;
5. confirmar;
6. proponer corrección;
7. `No participé`;
8. Historial;
9. Resumen;
10. BRAMU Intelligence;
11. Mi Perfil;
12. Perfil público;
13. Ranking;
14. grupos/notificaciones solo si aparecen naturalmente.

No hace falta cubrir todo en una sola sesión.

## 4. Evidencia útil

Ideal:

- screenshot;
- dispositivo;
- cuenta/rol;
- qué acababas de hacer;
- qué no te gustó;
- cómo te lo imaginabas.

No hace falta lenguaje técnico.

## 5. Rol de ChatGPT central

ChatGPT central debe:

- mantener coherencia con fuentes maestras;
- distinguir bug vs. gusto visual vs. decisión;
- buscar primero si el comportamiento ya estaba definido;
- evitar pedir a Sebastián que reconstruya contexto;
- consolidar cambios en este documento;
- preparar luego un handoff único y priorizado para implementación;
- minimizar deploys.

## 6. Rol de ChatGPT Work

Usar Work solo cuando agregue evidencia única:

- recorrer un flujo completo de navegador;
- comparar viewport móvil/escritorio;
- revisar consola/red;
- validar estados reales del backend;
- reproducir un bug visual específico.

No usar Work como sustituto de Claude Code para cambios medianos/grandes de código.

## 7. Criterio para implementar

Durante estos días, preferir **documentar primero**.

Implementar solo si:

- es un bug crítico;
- bloquea seguir probando;
- compromete datos, identidad, auth o seguridad.

El resto se agrupa.

## 8. Salida del laboratorio

Antes de volver a implementación, producir un consolidado final con:

- CAMBIO OBLIGATORIO antes de Production;
- CONVENIENTE antes de invitar amigos;
- PULIDO FUTURO;
- NO CAMBIAR.

Ese consolidado debe incluir screenshots/referencias suficientes para que el implementador no tenga que reinterpretar la intención visual.


## 9. Regla para el chat paralelo de Laboratorio UX

Este laboratorio se trabaja en un chat separado de coordinación/desarrollo para no mezclar conversación exploratoria con ejecución técnica.

Al comenzar ese chat:

1. leer `docs/BRAMUlab/README.md`;
2. leer `docs/BRAMUlab/Pre_Production.md`;
3. leer `docs/BRAMUlab/Experiencia_Inicial.md`;
4. leer este documento;
5. consultar después únicamente la fuente maestra del sistema que aparezca en la prueba.

### Obligación antes de hacer una pregunta de producto

Antes de preguntarle a Sebastián “¿cómo querés que funcione?”, buscar si esa decisión ya existe en documentación vigente.

Si ya existe:

- recordarla;
- mostrarla en lenguaje simple;
- comparar la app actual contra esa decisión;
- clasificar cualquier diferencia como `YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA`.

Solo preguntar cuando exista una **DECISIÓN ABIERTA real** que no pueda resolverse por las fuentes maestras.

No pedirle a Sebastián que recuerde en qué chat se habló algo.

### Estado Cero

P0.1 está confirmado como implementación incompleta.

Por lo tanto, mientras no se implemente:

- no evaluar el Estado Cero actual como si fuera el diseño final;
- sí se pueden registrar screenshots concretos de gaps;
- no invertir una sesión larga en pulir una pantalla que ya sabemos que va a cambiar;
- la evaluación visual definitiva de Estado Cero se hace después de implementar P0.1.

### Persistencia de decisiones

Al cerrar una idea o pantalla:

- actualizar este documento o un consolidado derivado;
- marcar claramente:
  - `CONFIRMADO`;
  - `PROPUESTA`;
  - `PENDIENTE`;
  - `NO TOCAR`;
- no dejar decisiones importantes solo en el chat.

## 10. Preparación de cuentas para pruebas

No limpiar “todo Staging” por defecto.

La configuración recomendada para UX es:

- **Cuenta A limpia**: usuario principal controlado por Sebastián;
- **Cuenta B limpia**: segundo usuario real controlado por Sebastián desde otro dispositivo/navegador;
- conservar identidades de prueba adicionales cuando sirvan como rivales/compañeros;
- crear/reusar provisionales solo cuando la prueba lo necesite.

Con A + B se pueden probar:

- carga desde un lado;
- recepción desde el otro;
- confirmación por pareja;
- propuesta de corrección;
- estados accionable/no accionable;
- Historial;
- Resumen;
- notificaciones;
- perfil propio/público.

Los otros dos lugares del partido pueden ser identidades de prueba/provisionales cuando el caso lo permita.

### Limpieza

Antes de resetear cuentas:

1. identificar exactamente las dos cuentas de Staging elegidas;
2. revisar qué partidos/claims/datos QA dependen de ellas;
3. preservar cualquier evidencia documental que todavía importe;
4. limpiar solo lo necesario;
5. comprobar que vuelvan a:
   - cuenta nueva;
   - Nivel inicial sin partidos oficiales;
   - 0 historial computable;
   - sin pendientes residuales.

La limpieza de cuentas/datos es destructiva y se hace solo con autorización explícita de Sebastián una vez identificadas las cuentas.

Para probar calibración completa de Nivel, preparar después un escenario controlado específico; no mezclar esa necesidad con la limpieza inicial de UX.


## 11. Cuentas sintéticas de QA — decisión confirmada

**QA = Quality Assurance / control de calidad.** Es una etiqueta interna para distinguir estas cuentas sintéticas de personas reales. No es una función de la app ni tiene que aparecer en el producto final.

Para las pruebas de Staging se prefiere un set fijo de cuentas controladas por BRAMU, sin depender de emails personales.

Set estándar de 8 identidades sintéticas:

- Seba QA
- Matu QA
- Gusti QA
- Esteban QA
- Lucho QA
- Jonah QA
- Diego QA
- Pablito QA

Convención recomendada:

- nombre visible: `Seba QA`, `Matu QA`, etc.;
- @usuario: `@seba_qa`, `@matu_qa`, etc. (si alguno ya existe, usar una variante inequívoca y documentarla);
- email: alias de la casilla de BRAMU mediante plus-addressing, por ejemplo `bramulab+sebaqa@gmail.com`, `bramulab+matuqa@gmail.com`, etc.

Reglas:

- son cuentas sintéticas de Staging, no personas reales ni futuros usuarios;
- no usar datos personales innecesarios de amigos reales;
- pueden compartir una misma contraseña **solo si es una contraseña exclusiva de testing**, nunca reutilizada de cuentas personales ni de Production;
- la contraseña no se guarda en documentación ni se comparte por chat;
- estas cuentas pueden resetearse/eliminarse libremente dentro de Staging cuando una prueba lo requiera;
- Production nunca se siembra con estas cuentas;
- para Nivel se pueden usar respuestas sintéticas/controladas para producir distintos puntos de partida, siempre dejando claro que son fixtures de QA y no autoevaluaciones reales.

Con ocho cuentas controladas alcanza holgadamente para probar:

- partidos completos de dobles;
- validación por parejas;
- correcciones;
- `No participé`;
- identidades provisionales/claims;
- diversidad de rivales suficiente para calibración de Nivel;
- perfiles públicos;
- Ranking/eligibilidad cuando corresponda;
- escenarios cruzados sin depender de cuentas personales.

Las cuentas personales de Sebastián quedan fuera del set estándar de QA salvo que una prueba específica lo requiera.

### Creación

Crear primero **una sola cuenta piloto** para confirmar que:

- Supabase acepta el alias con `+`;
- el OTP llega correctamente a la casilla central;
- el onboarding rápido puede completarse;
- la cuenta queda identificable y separada.

Solo después crear las otras siete.

La intervención debe agrupar cualquier dato que requiera Sebastián (por ejemplo atributos de Perfil o objetivo aproximado de Nivel) en una única consulta, no preguntar cuenta por cuenta.
