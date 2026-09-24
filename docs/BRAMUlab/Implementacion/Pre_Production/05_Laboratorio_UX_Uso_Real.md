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

**QA = Quality Assurance / control de calidad.** Es una etiqueta interna para distinguir cuentas sintéticas de usuarios reales. No forma parte del producto final.

Para Staging se adopta un set fijo de ocho cuentas sintéticas controladas por BRAMU:

- Seba
- Matu
- Gusti
- Esteban
- Lucho
- Jonah
- Diego
- Pablito

### Convención de identidad

La experiencia visible debe parecer la de usuarios normales:

- nombre visible: nombre habitual, sin sufijo QA;
- @usuario: incluir `_qa` para distinguir inequívocamente la cuenta sintética, por ejemplo `@seba_qa`;
- email: usar plus-addressing de la casilla central **sin agregar QA al alias**, por ejemplo `bramulab+seba@gmail.com`, `bramulab+matu@gmail.com`, etc.

Set objetivo de emails:

- `bramulab+seba@gmail.com`
- `bramulab+matu@gmail.com`
- `bramulab+gusti@gmail.com`
- `bramulab+esteban@gmail.com`
- `bramulab+lucho@gmail.com`
- `bramulab+jonah@gmail.com`
- `bramulab+diego@gmail.com`
- `bramulab+pablito@gmail.com`

### Perfil de prueba

Estas cuentas deben quedar lo más completas posible para que sirvan también para Perfil y recorridos posteriores.

Antes de crearlas, Work debe hacer **una sola consulta agrupada** a Sebastián con todos los datos que falten para las ocho identidades, por ejemplo:

- nombre y apellido;
- fecha de nacimiento aproximada/sintética si se quiere probar edad;
- mano dominante;
- lado preferido;
- cualquier otro dato de Perfil que la UI vigente permita completar;
- objetivo aproximado de Nivel inicial o respuestas del cuestionario necesarias para generar niveles distintos.

No preguntar cuenta por cuenta si puede resolverse en una sola tabla.

Los datos pueden ser sintéticos o aproximados; no deben presentarse como datos reales de las personas cuyos nombres se usan como referencia.

### Credencial de testing

Las ocho cuentas pueden compartir la misma contraseña **solo en Staging**, siempre que sea una contraseña exclusiva de testing y no reutilizada en cuentas personales ni Production.

Si Sebastián decide compartir esa contraseña con Work para automatizar el alta, Work puede usarla dentro de esa sesión operativa, pero:

- no debe escribirla en el repositorio;
- no debe incluirla en informes;
- no debe persistirla en documentación;
- no debe usarla fuera de Staging.

### Creación

Work puede crear las ocho cuentas en una sola ronda de trabajo, pero antes debe:

1. confirmar que `bramulab+seba@gmail.com` recibe correctamente el primer OTP en la casilla central;
2. si el alias funciona, continuar con las otras siete;
3. completar onboarding/perfil según los datos acordados;
4. verificar que cada cuenta tenga identidad separada y el @usuario correcto;
5. dejar constancia de qué cuentas quedaron creadas y cualquier incidencia, sin registrar contraseñas.

No crear usuarios directamente por SQL/Admin si el objetivo es validar también el flujo real de alta.

### Uso

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


## 12. Secuencia del laboratorio — decisión vigente

No es obligatorio crear las ocho cuentas ni ejecutar ahora el recorrido completo de QA.

Se prioriza esta secuencia:

1. cerrar primero las decisiones de producto/UX que ya pueden resolverse sin datos de prueba;
2. implementar P0.1 Estado Cero / perfiles progresivos y el resto del paquete visual priorizado;
3. recién entonces crear/preparar el set completo de ocho cuentas sintéticas si todavía es necesario;
4. ejecutar un laboratorio integrado sobre una versión más cercana a la experiencia final;
5. cerrar con QA final de punta a punta antes de Production.

Motivo: evita gastar tiempo evaluando pantallas que ya sabemos que van a cambiar y permite que el testing posterior sea más representativo de la experiencia real.

Las cuentas sintéticas siguen siendo el universo recomendado de QA, pero su creación puede diferirse hasta que aporte evidencia útil.
