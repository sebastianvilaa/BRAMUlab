# BRAMU Lab — Decisiones futuras sobre registro y validación de partidos

> Backlog conceptual. Estas decisiones quedan documentadas para etapas futuras y no forman parte del próximo consolidado de implementación de la Rama Jugador.

## Principio rector

**Quien registra un partido no necesariamente es quien lo juega.** BRAMU debe separar siempre al autor del registro de los participantes del partido.

Para efectos competitivos aplica la idea: **“Los de afuera son de palo.”** Un espectador puede producir un registro muy valioso, pero no puede modificar el Nivel BRAMU, el ranking ni las estadísticas oficiales de los jugadores.

## 1. Partido declarado por un participante

- Un jugador que participó carga el resultado final, la fecha, el formato y los participantes.
- Su propio equipo se considera inicialmente validado por origen: el cargador declara el partido en representación de su pareja.
- Para convertirlo en partido oficial alcanza con la confirmación de **al menos un integrante del equipo rival**.
- Esta regla reduce la fricción y evita depender de que los cuatro jugadores utilicen activamente la aplicación.
- El compañero del cargador conserva la posibilidad de detectar y proponer una corrección posteriormente.

### Respuesta de los jugadores etiquetados

Cada jugador debe poder elegir:

- **Confirmar que está correcto.**
- **Proponer una corrección.**
- **Indicar que no participó.**

Una corrección debe incluir una nota o motivo. Cuando se modifica un dato relevante —resultado, jugadores, fecha o formato—, se notifica nuevamente al rival que confirmó y el partido vuelve a quedar pendiente hasta que el cambio sea aceptado.

No conviene fijar todavía un límite arbitrario de una o dos ediciones. La alternativa preferida es conservar un historial de revisiones y, si existe abuso o desacuerdo repetido, pasar el partido a estado disputado.

### Validación pendiente

- Mientras falta la confirmación rival, el partido queda pendiente y no afecta Nivel BRAMU ni rankings.
- Antes de que un usuario registre un nuevo partido oficial, BRAMU puede pedirle que resuelva los partidos pendientes en los que fue etiquetado.
- Rechazar o corregir requiere indicar el motivo.
- Un desacuerdo sin resolver no debe producir efectos competitivos.

## 2. Partido registrado por un espectador

- El registro en vivo se entiende, por ahora, como una acción realizada por un espectador, organizador o persona externa al partido.
- No se ofrecerá en el corto plazo la variante “Estoy jugando” dentro del registro en vivo.
- El flujo será simplemente **Registrar partido en vivo → elegir modo Completo o Por Games**.

El espectador puede registrar resultado, puntos, breaks, momentos destacados, evolución y obtener BRAMU Intelligence. También puede etiquetar a los jugadores y compartirles el informe.

Sin embargo, este registro:

- no puede convertirse por sí mismo en partido oficial;
- no modifica Nivel BRAMU;
- no modifica rankings;
- no modifica efectividad, rachas ni estadísticas oficiales;
- queda identificado como **Registrado por [persona]**;
- puede guardarse como contenido complementario o partido observado dentro de la historia de los jugadores.

Los jugadores pueden aprovechar el análisis, la evolución y el detalle para conversar sobre el partido, pero no necesitan validar cada punto, break o situación registrada por un tercero.

## 3. Datos que sí pueden afectar el Nivel BRAMU

El cálculo futuro del Nivel BRAMU debe utilizar únicamente datos objetivos y validados:

- identidad de los participantes;
- resultado final;
- fecha real del partido;
- formato;
- validación mínima de un participante por cada equipo.

Los puntos, breaks, puntos de oro, highlights y demás estadísticas detalladas enriquecen el análisis, pero no determinan el Nivel BRAMU.

## 4. Estados conceptuales

- **Pendiente de validación:** declarado por un participante, todavía sin confirmación rival.
- **Validado:** declarado por un participante y confirmado por al menos un jugador de cada equipo.
- **Disputado:** existe una corrección o desacuerdo sin resolver.
- **Observado:** registrado por una persona externa; informativo y no competitivo.

## 5. Competiciones con premios

La validación de un jugador por equipo es adecuada para el uso social habitual de BRAMU. Si en el futuro existen rankings con premios, torneos oficiales o incentivos económicos, se necesitará un nivel de confianza adicional: organizador, club o torneo verificado, o reglas de validación más estrictas.

## 6. Acceso desde el botón central

Orden propuesto:

1. **Cargar mi partido jugado** — acción principal y de uso más frecuente.
2. **Registrar partido en vivo** — registro realizado por un espectador.
   - Modo Completo.
   - Por Games.

## 7. Historial unificado con pestañas de filtro

El Historial se mantiene como una única línea temporal con todos los partidos ordenados por **fecha real de juego**, no por fecha de carga. Puede incorporar una barra horizontal de pestañas, inspirada en patrones conocidos como Mercado Pago, para filtrar la misma lista sin convertir cada categoría en una pantalla independiente.

Pestañas iniciales propuestas:

- **Todos** — vista predeterminada.
- **Mis partidos** — partidos en los que participó el usuario.
- **Observados** — partidos registrados por terceros o por el usuario como espectador.
- **Pendientes** — resultados que requieren confirmación o corrección; puede mostrar un contador.

La modalidad de registro —Resultado, Por Games o Completo— conviene tratarla como un filtro secundario si más adelante resulta necesaria, no como pestañas principales. Así se evita una barra demasiado extensa y se prioriza la relación del usuario con cada partido.

Cada registro debe dejar claro:

- resultado y participantes;
- quién lo registró;
- modalidad del registro: Resultado, Por Games o Completo;
- estado: Pendiente, Validado, Disputado u Observado;
- relación del usuario con el partido cuando sea necesario.

Ejemplos de metadatos:

- `Resultado cargado por Seba · Validado`
- `Registro completo por Seba · Observado`
- `Resultado cargado por Matu · Pendiente de tu confirmación`

Los partidos pendientes conviven cronológicamente con el resto dentro de Todos, pero deben tener una acción visible para resolverlos. La pestaña Pendientes permite concentrarlos cuando el usuario necesita actuar.

## 8. Consideración arquitectónica para etapas próximas

Aunque la validación social no se implemente en la próxima etapa, el modelo futuro de partido debe contemplar conceptualmente campos separados para:

- identificador estable del partido;
- autor del registro;
- participantes;
- fecha real de juego;
- modalidad y nivel de detalle del registro;
- estado de validación;
- historial de correcciones;
- vínculo opcional con un registro observado.

Claude debe conocer esta dirección para evitar decisiones estructurales incompatibles, pero no debe construir todavía cuentas, notificaciones, confirmaciones, disputas ni rankings reales.
