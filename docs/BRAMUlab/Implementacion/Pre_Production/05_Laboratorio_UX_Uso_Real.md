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
