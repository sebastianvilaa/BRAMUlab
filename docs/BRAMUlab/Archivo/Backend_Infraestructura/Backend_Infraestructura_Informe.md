# BRAMUlab — Informe de preparación y cierre de Backend/Infraestructura

**Estado:** informe diagnóstico pendiente de revisión y consolidación  
**Propósito:** preservar y ordenar el análisis realizado antes de implementar Backend/Infraestructura  
**Importante:** este documento no reemplaza ni modifica `Backend_Infraestructura.md`. Tampoco convierte preguntas abiertas en decisiones confirmadas.

---

## 0. Alcance de este informe

Este archivo conserva el estado exacto del análisis realizado para determinar qué faltaba saber, definir o cerrar antes de considerar Backend/Infraestructura listo para implementación.

El análisis se realizó cruzando:

- `Backend_Infraestructura.md`;
- `Ranking_BRAMU.md`;
- `Nivel_BRAMU_Formula_V1.4.md`;
- `Nivel_BRAMU_Implementacion.md`;
- `Nivel_BRAMU.md`;
- `BRAMU_Intelligence.md`;
- `BRAMU_Intelligence_Implementacion.md`;
- `Referencias/BRAMU_Intelligence_IA_Generativa_Evaluacion_2026.md`;
- `BRAMUlab_Backlog.md`;
- los consolidados e informes vigentes de V03 disponibles en ese momento.

No se incorporan aquí decisiones posteriores a aquel análisis. Las preguntas permanecen abiertas aunque después puedan haber sido tratadas en otros chats. Antes de implementar, el chat principal de desarrollo debe contrastarlas con la documentación vigente y marcar cuáles ya fueron resueltas.

### Prioridades utilizadas

- **P0 — Bloqueante general:** debe resolverse antes de diseñar definitivamente la base de datos o el contrato central del backend.
- **P1 — Bloqueante del bloque funcional:** no impide preparar la infraestructura general, pero debe resolverse antes de implementar esa función.
- **P2 — Postergable:** puede quedar preparada o documentada sin bloquear el primer piloto.

---

## 1. Decisiones que ya estaban confirmadas

Estas definiciones ya existían y no debían volver a abrirse durante el cierre técnico.

### 1.1 Alcance, costo y publicación

- El primer piloto real está pensado para aproximadamente 100 usuarios como máximo inicial.
- Debe mantenerse el costo cero mientras exista una alternativa razonable y segura.
- La aplicación continúa como web app/PWA; no se publica todavía en App Store ni Google Play.
- No se compra dominio durante el piloto.
- GitHub continúa como repositorio e historial del proyecto.
- GitHub Pages conserva la V03 mientras se desarrolla y prueba V04.
- La recomendación vigente para publicar V04 es Vercel, conectado al mismo repositorio.
- Supabase es la recomendación principal para autenticación, base de datos y permisos.
- El piloto debe usar entornos separados de prueba y producción.
- Se prevén al menos diez usuarios sintéticos permanentes en pruebas, sin correos falsos y sin mezclarlos con usuarios reales.

### 1.2 Cuentas, identidad y recuperación

- Cada persona real debe tener un identificador técnico interno estable.
- El perfil contempla `@usuario` único, nombre para mostrar, nombre real y apellido real.
- El correo se utiliza para autenticación y recuperación, y no es público.
- Las contraseñas deben ser administradas por Supabase Auth; no pueden guardarse en `localStorage` ni en tablas propias.
- La recuperación utiliza un código aleatorio de seis dígitos, de un solo uso, con vigencia inicial de 60 minutos.
- Deben existir límites de reintento y mensajes que no revelen si un correo está registrado.
- V04 comienza vacía: no se importan usuarios, contraseñas, sesiones ni partidos simulados de V03.

### 1.3 Partidos compartidos

- Un partido real debe existir una sola vez en la base de datos.
- Los jugadores asociados consultan el mismo partido desde sus historiales; no se crean copias independientes por dispositivo.
- BRAMU modela pádel de dobles: dos parejas y hasta cuatro participantes.
- El sistema distingue autor del registro, participantes, usuarios registrados, invitados y observadores.
- Puede haber uno o varios invitados sin cuenta.
- Un invitado nunca se asocia automáticamente con una cuenta futura por coincidencia de nombre.
- Si un participante carga un resultado oficial, queda pendiente de confirmación rival.
- Alcanza la confirmación de un solo rival registrado.
- Quien cargó el partido no puede confirmarse a sí mismo y su compañero no reemplaza la confirmación rival.
- Una modificación relevante vuelve a dejar el partido pendiente.
- Un partido disputado no afecta Nivel ni Ranking mientras no se resuelva.
- Los partidos observados por un espectador no afectan Nivel, Ranking ni estadísticas oficiales.
- No se permite eliminar unilateralmente un partido compartido.
- Cada usuario puede ocultar un partido solo de su propio historial.
- La eliminación global debe representarse como anulación lógica y auditable.
- Las notas privadas pertenecen únicamente a quien las escribió.

### 1.4 Conexión inestable

- El partido en curso debe conservarse localmente para evitar perder el tanteo.
- Si no hay conexión al finalizar, se guarda una copia pendiente de sincronización.
- La aplicación reintenta al recuperar conexión.
- Debe mostrar claramente los estados pendiente de sincronizar, sincronizado y error.
- Los reintentos no deben generar partidos duplicados.

### 1.5 Nivel, Ranking e Intelligence

- Nivel BRAMU V1.4 estaba conceptualmente cerrado para piloto.
- Ranking BRAMU V1 estaba conceptualmente cerrado.
- BRAMU Intelligence V1 estaba conceptualmente cerrado.
- Nivel pertenece a la persona, no a la pareja.
- Solo los partidos compatibles, computables y validados pueden modificar Nivel y Ranking.
- Nivel conserva precisión interna y expone un decimal público.
- Ranking V1 no tiene puntos propios: ordena por el Nivel consolidado interno exacto.
- Ranking es continuo y compara movimientos contra un corte semanal.
- Intelligence utiliza un motor determinístico como fuente de verdad.
- La IA generativa es opcional, reversible y posterior a los claims aprobados.
- Cloudflare/Qwen era el primer proveedor previsto para evaluación y Groq/GPT-OSS la contingencia.
- La aplicación debe seguir funcionando con plantillas si el proveedor generativo falla o se desactiva.

---

## 2. Contradicciones y ambigüedades documentales detectadas

Estas diferencias explican por qué algunas preguntas no podían cerrarse por interpretación técnica.

| Tema | Documentos involucrados | Estado detectado |
|---|---|---|
| Actualización de Nivel | `Backend_Infraestructura.md` §5 menciona una posible actualización cada 15 días. `Nivel_BRAMU_Formula_V1.4.md` §12.1 establece actualización inmediata al validarse el partido. | Debe prevalecer Nivel V1.4. No constituye una nueva pregunta de producto. |
| Precisión pública del Nivel | Backend §5 menciona dos decimales. Nivel §2 y Ranking §13.2 establecen un decimal público y cuatro internos. | Debe prevalecer la definición normativa de Nivel y Ranking. |
| Estado del Ranking | Backend §5 y §11.6 todavía presentan la fórmula y la incorporación de Ranking como futuras. | Quedó desactualizado frente a `Ranking_BRAMU.md`, ya cerrado. |
| Invitados | Backend §4.2 deja el reclamo de invitados fuera del piloto. Nivel §12.2 y §21 dependen de asociación y validación dentro de 30 días. | Falta definir el flujo de asociación/reclamo; no la fórmula de Nivel. |
| Perfil público o privado | Backend §3.3 declara públicos y buscables nombre, apellido, display name y `@usuario`. Ranking §6.2–6.3 y V03.5 §15 contemplan perfil privado. | Requiere una definición explícita de privacidad. |
| Jugadores personales | V03 Consolidado §8 tiene una lista manual de jugadores agregados. Ranking §10 define “Mis jugadores” automáticamente por partidos validados y excluye agregados manuales. | Debe definirse si son dos listas distintas o si una reemplaza a la otra. |
| Grupos | Backend §5 dice que no se implementan grupos. V03 Consolidado §9 e Informe §21 confirman que Mis grupos ya existe. | Debe definirse si V04 conserva y persiste la función o acepta una regresión temporal. |
| Búsquedas | Backend §3.3 define búsqueda global por nombre, apellido, display name y username. V03.5 §13 busca por display name y username dentro del ranking seleccionado. | Probablemente sean buscadores diferentes, pero su alcance debe quedar explícito. |
| Referencias del handoff de Nivel | `Nivel_BRAMU_Implementacion.md` §2 apunta a nombres anteriores de archivos; el README activo usa `Nivel_BRAMU_Formula_V1.4.md`, `Nivel_BRAMU.md` y `Nivel_BRAMU_Implementacion.md`. | Referencia documental desactualizada, sin cambio funcional. |
| Hosting en la referencia de IA | La evaluación de IA §5 todavía representa la app en GitHub Pages. Backend §3.2 recomienda Vercel para V04. | El diseño server-side sigue siendo válido, pero el contexto de publicación quedó viejo. |

---

## 3. Dependencias y preguntas abiertas de Nivel BRAMU

### P0 — Contrato técnico de Nivel

#### N1. Contrato canónico

¿Cuál es el contrato definitivo y literal que entrega Nivel al backend?

Se necesitan nombres, tipos, obligatoriedad y valores posibles para:

- estado actual del jugador;
- nivel consolidado y provisional;
- confiabilidad almacenada y efectiva;
- contadores de calibración;
- snapshots prepartido;
- resultado del cálculo;
- eventos de Nivel.

También debe confirmarse si la versión inicial se guarda literalmente como `nivel_bramu_v1_0`.

#### N2. Eventos de Nivel

¿Qué eventos exactos puede emitir Nivel y qué contiene cada uno?

Como mínimo:

- creación de estimación inicial;
- ajuste inicial;
- partido computado;
- partido no computable;
- inicio de recalibración;
- cierre de recalibración;
- expiración de recalibración;
- reversión;
- corrección;
- anulación.

La respuesta debe incluir los nombres canónicos de estados y eventos, no solo descripciones humanas.

### P1 — Estados y recálculos

#### N3. Datos durante recalibración

Durante una recalibración, ¿qué campos se actualizan con cada partido y cuáles permanecen congelados hasta cerrarla?

Debe precisarse el tratamiento de:

- nivel provisional;
- nivel consolidado;
- confianza;
- evidencia;
- partidos computables;
- rivales distintos.

#### N4. Correcciones y anulaciones

Cuando se corrige o anula un partido computado, además de revertir el delta, ¿qué ocurre con:

- `rated_matches`;
- `distinct_opponents`;
- evidencia acumulada;
- confianza;
- `last_rated_at`;
- progreso de calibración;
- progreso de recalibración;
- métricas de diversidad y círculo competitivo?

#### N5. Asociación posterior de invitados

Si un invitado se vincula con una cuenta dentro de los 30 días, ¿qué evento recibe Nivel y en qué casos debe procesar el partido retroactivamente?

Debe distinguirse entre:

- partido todavía pendiente;
- partido ya validado socialmente;
- partido no computado por falta de identidades;
- reclamo efectuado después del límite.

---

## 4. Dependencias y preguntas abiertas de Ranking BRAMU

### P0 — Elegibilidad y universos

#### R1. Contrato de elegibilidad

¿Cuál es la salida canónica de elegibilidad que recibe el backend?

Se necesita definir:

- elegible o no;
- estado de participación;
- motivo canónico de exclusión;
- universos territoriales correspondientes;
- nivel usado para ordenar;
- fecha efectiva de la elegibilidad.

Los motivos deben ser códigos estables para que la interfaz no interprete textos libres.

#### R2. Ubicación estructurada

¿Cuál será la fuente canónica de país, provincia/estado y localidad?

También debe definirse:

- si el piloto admite únicamente ubicaciones argentinas o también otros países;
- qué identificadores se guardan;
- cómo se representa una localidad extranjera;
- qué ocurre si GeoRef no encuentra una localidad;
- si un perfil puede permanecer sin ubicación indefinidamente.

#### R3. Activación de Ranking

La activación automática al terminar la calibración estaba redactada como recomendación. ¿Queda confirmada como comportamiento final o el usuario debe activarla manualmente?

### P1 — Snapshots, movimientos e historial

#### R4. Corte semanal

¿Qué día, hora y zona horaria definen el corte semanal?

También debe establecerse:

- qué ocurre durante la primera semana sin corte anterior;
- qué pasa si el proceso semanal falla;
- si se recupera posteriormente o se salta esa semana.

#### R5. Orden de actualización

¿Cuál es el orden exacto cuando un partido cambia Nivel y Ranking?

El análisis anterior identificó como secuencia a confirmar:

1. validar el partido;
2. guardar snapshots previos;
3. actualizar Nivel;
4. recalcular la posición actual;
5. detectar movimientos materiales;
6. emitir el evento consumido por Intelligence.

#### R6. Retención de snapshots

¿Los snapshots semanales completos se conservan indefinidamente o existe una política mínima de retención?

#### R7. Mis jugadores y Jugadores agregados

¿“Mis jugadores” de Ranking y “Jugadores agregados” de V03 son dos funciones diferentes?

Si conviven, debe definirse:

- nombre de cada relación;
- origen automático o manual;
- si una persona puede estar en ambas;
- qué lista utiliza cada pantalla;
- qué ocurre al eliminar a alguien de la lista manual.

#### R8. Integridad

¿Quién establece y resuelve los estados de integridad, duplicado, suspensión o retención que excluyen del Ranking?

Para el piloto debe aclararse si:

- interviene un administrador;
- se resuelve automáticamente;
- o los estados solo quedan preparados y sin uso inicial.

---

## 5. Dependencias y preguntas abiertas de BRAMU Intelligence

El proveedor inicial, la contingencia y la arquitectura híbrida ya estaban definidos. No correspondía volver a comparar Cloudflare, Groq o Gemini.

### P0 — Alcance, momento y destinatarios

#### I1. Alcance dentro de V04

¿Qué parte de Intelligence debe incluir la primera V04 real?

El análisis identificó tres alcances posibles que debían cerrarse, sin elegir uno:

- motor determinístico completo desde el primer piloto;
- backend preparado y activación después de Nivel y Ranking;
- únicamente Intelligence postpartido, dejando “Tu momento” y grupos para otro bloque.

#### I2. Perspectivas generadas

¿Para qué jugadores se genera Intelligence después de un partido?

Debe indicarse si se genera:

- solamente para quien lo cargó;
- para cada participante registrado;
- para cada participante que valida;
- para todos los participantes registrados aunque todavía no hayan abierto el partido.

También debe definirse el tratamiento de invitados.

#### I3. Estado disparador

¿En qué estado del partido se genera cada tipo de insight?

Debe separarse:

- pendiente;
- validado;
- disputado;
- observado;
- anulado;
- histórico fuera de 30 días.

En particular, debe aclararse si un partido pendiente puede generar historia personal no oficial y luego reemplazarla o ampliarla al validarse.

### P1 — Persistencia y recálculo

#### I4. Alcance del recálculo

Cuando se corrige o anula un partido antiguo, ¿hasta dónde debe recalcular Intelligence?

- solo el insight de ese partido;
- rachas y balances posteriores;
- ventanas de últimos cinco y diez;
- todos los insights dependientes del resultado.

#### I5. Textos históricos obsoletos

Cuando un texto que el usuario ya vio queda obsoleto, ¿qué debe mostrar luego el historial?

Está definido que no debe reescribirse silenciosamente. Falta precisar si:

- se conserva visible con advertencia;
- se oculta pero queda auditable;
- se muestra junto con la versión corregida.

#### I6. Contrato del insight

Debe entregarse el contrato definitivo del objeto `Insight`, incluyendo:

- estados posibles;
- evidencia;
- perspectiva;
- fecha de corte;
- versión de reglas;
- versión de plantilla;
- estado de vigencia;
- motivo de obsolescencia;
- vínculo con una generación externa cuando exista.

### P2 — Capa generativa

#### I7. Activación inicial

¿La primera apertura real sale con generación externa apagada hasta completar benchmark y modo sombra?

#### I8. Consentimiento

Para el piloto opt-in de IA, ¿el consentimiento será general, por usuario o por generación?

También debe definirse qué ocurre con los textos generados si el usuario retira el consentimiento.

---

## 6. Identidad, cuentas, perfiles y usuarios

### P0 — Modelo de identidad y privacidad

#### U1. Significado de perfil privado

¿Qué significa exactamente “perfil privado”?

Debe definirse qué puede seguir viendo o encontrando otra persona:

- `@usuario`;
- nombre para mostrar;
- nombre y apellido;
- avatar;
- Nivel;
- ubicación;
- estadísticas;
- historial.

Esta respuesta debe resolver la diferencia entre Backend §3.3 y Ranking §6/V03.5 §15.

#### U2. Campos deportivos públicos

¿Cuáles son los campos deportivos públicos exactos del piloto?

Para cada dato debe indicarse si es público, privado o configurable:

- Nivel y estado;
- edad o rango de edad;
- mano;
- lado;
- categoría declarada;
- ubicación;
- efectividad;
- partidos oficiales;
- mejor racha;
- mejor Nivel;
- posiciones de Ranking;
- historial de partidos.

#### U3. Alcance de las búsquedas

¿Cuáles son los buscadores definitivos y qué campos usa cada uno?

Debe separarse:

- búsqueda global de jugadores;
- búsqueda dentro de jugadores agregados;
- búsqueda dentro de un Ranking;
- selección de compañero o rival.

#### U4. Reglas de `@usuario`

Falta cerrar:

- caracteres permitidos;
- longitud mínima y máxima;
- mayúsculas y minúsculas;
- tildes;
- palabras reservadas;
- posibilidad de cambiarlo;
- plazo entre cambios;
- comportamiento de enlaces o menciones antiguas.

#### U5. Verificación de correo

¿Una cuenta puede utilizar la app antes de verificar el correo?

En caso afirmativo, debe indicarse si puede:

- completar perfil;
- cargar partidos;
- aparecer en búsquedas;
- validar partidos;
- entrar al Ranking.

#### U6. Cuenta, perfil e invitado

¿Cuál es la diferencia definitiva entre:

- cuenta autenticada;
- perfil de jugador;
- invitado dentro de un partido?

También debe confirmarse si la relación entre cuenta y perfil deportivo es siempre uno a uno.

### P1 — Casos excepcionales

#### U7. Cuentas duplicadas

¿Cómo se resuelven dos cuentas que pertenecen a la misma persona?

Debe definirse:

- quién inicia la fusión;
- cómo se comprueba la identidad;
- qué cuenta sobrevive;
- qué ocurre con partidos, Nivel, Ranking, grupos e historial.

#### U8. Eliminación de cuenta

¿Qué ocurre cuando una persona elimina su cuenta?

En particular con:

- su nombre dentro de partidos compartidos;
- historial;
- Nivel;
- snapshots de Ranking;
- grupos;
- insights ya mostrados;
- registros de auditoría.

#### U9. Menores de edad

¿BRAMU permitirá cuentas de menores de edad durante el piloto?

Esto condiciona fecha de nacimiento, privacidad, consentimiento y la futura activación de proveedores externos.

### P2 — Foto

#### U10. Foto de perfil

¿La foto real forma parte del primer piloto o se comienza con avatar e iniciales?

---

## 7. Partidos y validación

### P0 — Estado y clasificación

#### M1. Máquina de estados canónica

Debe entregarse una única máquina de estados del partido.

Como mínimo debe contemplar:

- borrador;
- pendiente de sincronización;
- pendiente de validación;
- validado;
- disputado;
- observado;
- vencido para cómputo;
- corregido;
- anulado;
- duplicado.

Para cada transición debe indicarse quién puede ejecutarla y qué evento se genera.

#### M2. Clasificaciones del partido

¿Cuáles son las clasificaciones definitivas y quién las define?

Se necesitan valores canónicos para:

- origen: participante, espectador u organizador;
- carácter: oficial, competitivo, casual, entrenamiento o torneo/liga;
- modo de registro: resultado, por games o completo;
- elegibilidad separada para historial personal, estadísticas oficiales, Nivel y Ranking.

#### M3. Asociación de invitados

¿Cuál es el flujo exacto para vincular un invitado con una cuenta real?

Debe indicar:

- quién propone el vínculo;
- cómo se identifica a la persona correcta;
- quién lo acepta;
- si puede reclamarlo el propio invitado;
- si necesita confirmación de quien cargó el partido;
- si actualiza todos los partidos con el mismo nombre o solamente uno;
- qué ocurre ante dos reclamos.

### P1 — Validación, correcciones y disputas

La regla “un rival registrado alcanza para validar” ya estaba cerrada y no debía discutirse nuevamente.

#### M4. Acciones del rival

Además de confirmar, ¿el rival puede:

- proponer una corrección;
- rechazar el resultado;
- declarar que no participó;
- denunciar un duplicado?

#### M5. Corrección de partido validado

¿Quién puede iniciar una corrección y quién debe aprobarla?

Debe distinguirse entre cambios de:

- participantes;
- parejas;
- fecha;
- formato;
- sets o resultado;
- datos detallados que no afectan Nivel.

#### M6. Disputa sin acuerdo

Si nadie cede, ¿el partido:

- permanece disputado indefinidamente;
- vence después de un tiempo;
- requiere intervención manual;
- conserva una de las versiones;
- se anula?

#### M7. Aprobación de anulación

¿Cuántas aprobaciones requiere anular un partido validado y quién representa a la contraparte cuando existen cuatro cuentas registradas?

#### M8. Vencimiento de 30 días

Al cumplirse 30 días sin asociación o validación, ¿qué estado adquiere el partido?

Debe definirse si:

- sigue permitiendo validación social;
- queda histórico para siempre;
- puede corregirse;
- puede asociarse a una cuenta aunque ya no compute;
- debe mostrar el motivo por el que no afecta Nivel o Ranking.

#### M9. Partidos observados

¿Cómo se muestra un partido observado a las personas identificadas como participantes?

¿Se incorpora a sus historiales, requiere aceptación o permanece solo en el historial del observador?

#### M10. Duplicados reales

¿Cómo se resuelve un mismo partido cargado de forma independiente por dos personas?

Este caso debe distinguirse del duplicado técnico producido por reintentos de sincronización.

#### M11. Conflictos offline

Si dos dispositivos editan el mismo partido o una edición offline llega después de otra, ¿qué comportamiento espera el producto?

#### M12. Formatos y resultados especiales

Debe entregarse la lista definitiva de formatos y tipos de set, incluyendo el tratamiento de:

- abandono;
- resultado incompleto;
- walkover;
- match tie-break;
- formato corto;
- score inválido.

#### M13. Notificación mínima

¿Cuál es el mecanismo mínimo para descubrir validaciones, correcciones y anulaciones pendientes?

Debe definirse si el piloto requiere:

- bandeja interna;
- correo;
- contador en la campana;
- notificación push.

Push puede postergarse, pero debe existir alguna vía concreta para descubrir solicitudes.

---

## 8. Decisiones propias de Backend/Infraestructura

Estas preguntas no reabren las reglas de Nivel, Ranking o Intelligence. Deben resolverse durante el cierre técnico.

### P0 — Alcance y autoridad

#### B1. Alcance funcional de V04

Además de cuentas, perfiles, partidos, Nivel, Ranking e Intelligence, debe confirmarse si V04 conserva desde el inicio:

- Jugadores agregados;
- Mis grupos;
- ranking semanal de grupos;
- Intelligence grupal;
- notificaciones;
- partidos observados.

Sin esta respuesta no puede cerrarse el conjunto mínimo de tablas sin riesgo de perder funciones existentes.

#### B2. Autoridad server-side

¿Se confirma que toda operación capaz de modificar validación, Nivel, Ranking o Intelligence se ejecuta y autoriza del lado servidor?

El navegador puede mostrar cálculos preliminares, pero no debería adjudicarse resultados oficiales.

#### B3. Operaciones atómicas

¿Qué operaciones deben completarse enteras o no completarse?

El caso principal combina:

- validación del partido;
- snapshots;
- actualización de Nivel;
- registro de eventos;
- actualización de elegibilidad o posición;
- invalidación de Intelligence anterior.

### P1 — Seguridad y operación

#### B4. Matriz de permisos

Debe definirse quién puede leer, crear o modificar:

- perfiles;
- partidos;
- participantes;
- invitados;
- validaciones;
- notas privadas;
- grupos;
- snapshots;
- insights.

#### B5. Procesos inmediatos y procesos en segundo plano

Debe clasificarse:

- actualización de Nivel;
- posición actual;
- corte semanal;
- recálculo de Intelligence;
- generación externa;
- corrección de históricos.

#### B6. Correo real

¿Qué proveedor SMTP gratuito supera la prueba de entrega y permite el remitente elegido sin dominio propio?

La arquitectura ya contemplaba SMTP; faltaba su validación técnica.

#### B7. Respaldo y recuperación

¿Cuál es el respaldo mínimo del piloto y cómo se prueba que puede recuperarse?

#### B8. Logs y privacidad

¿Qué registros técnicos se conservan, durante cuánto tiempo y qué datos privados deben excluirse o eliminarse?

#### B9. Versionado

¿Cómo se versionan:

- esquema de base;
- formato de partido;
- algoritmo de Nivel;
- reglas de Ranking;
- reglas de Intelligence;
- plantillas y prompts?

#### B10. Administración mínima

¿Qué operaciones necesitan una herramienta privada durante el piloto?

Posibles casos identificados:

- crear usuarios Test;
- resolver duplicados;
- suspender o restituir cuentas;
- revisar disputas;
- reintentar procesos fallidos.

Esto no implica construir un panel complejo; puede ser una herramienta interna mínima.

#### B11. Política de sincronización offline

Debe cerrarse:

- qué queda local;
- durante cuánto tiempo;
- identificador para evitar duplicados;
- cantidad y frecuencia de reintentos;
- resolución de conflictos;
- avisos al usuario;
- limpieza de datos sincronizados.

#### B12. Separación de entornos

¿Cómo se separan desarrollo, pruebas y piloto entre GitHub, Vercel y Supabase?

Los proyectos separados ya estaban recomendados. Faltaba mapear ramas, variables y datos sintéticos para impedir mezclas.

---

## 9. Bloqueantes generales antes de implementar

El análisis anterior agrupó los bloqueantes P0 en ocho paquetes de decisión.

### 9.1 Alcance de V04

Definir qué funciones existentes de V03 deben sobrevivir, especialmente Mis grupos y Jugadores agregados.

### 9.2 Privacidad e identidad

Definir perfil privado, identidad visible, campos públicos y reglas de `@usuario`.

### 9.3 Cuenta, perfil e invitado

Definir la relación entre esos tres objetos y el mecanismo seguro de reclamo o asociación.

### 9.4 Partido canónico

Cerrar estados, clasificaciones, transiciones y permisos básicos.

### 9.5 Contrato de Nivel

Cerrar campos, eventos, snapshots, versiones y tratamiento de correcciones.

### 9.6 Contrato de Ranking

Cerrar elegibilidad, ubicación estructurada, opt-in y relación con Mis jugadores.

### 9.7 Contrato de Intelligence

Cerrar momento de generación, destinatarios, perspectivas y alcance inicial.

### 9.8 Orquestación segura

Definir qué se ejecuta del lado servidor y como una única operación al validar, corregir o anular.

En términos de las preguntas anteriores, los principales bloqueantes eran:

- N1–N2;
- R1–R3 y R7;
- I1–I3;
- U1–U6;
- M1–M3;
- B1–B3.

Las preguntas P1 no impedían preparar los entornos, pero sí debían resolverse antes de implementar sus respectivos bloques.

---

## 10. Cuestiones postergables

El análisis consideró que estas decisiones no bloqueaban el primer piloto:

- dominio propio;
- publicación en App Store o Google Play;
- notificaciones push, si existe una bandeja interna suficiente;
- fotos reales de perfil;
- interfaz pública de soporte o administración;
- automatización sofisticada de fraude;
- política definitiva de compresión o archivo de snapshots antiguos;
- IA generativa visible para usuarios;
- proveedor generativo posterior a Cloudflare/Groq;
- temporadas o Race BRAMU oficial;
- premios y torneos;
- clubes y matchmaking;
- seguidores, chat o red social;
- migración de partidos y cuentas de V03, ya descartada para V04;
- fotos y recuerdos asociados a partidos;
- integraciones nativas y smartwatch.

---

## 11. Qué quedaría habilitado al responder los bloqueantes

Con las respuestas correspondientes, Backend/Infraestructura quedaría en condiciones de:

- congelar un contrato único entre Partidos, Nivel, Ranking e Intelligence;
- diseñar las tablas definitivas de la primera V04 sin infraestructura innecesaria;
- definir permisos de seguridad para cada tipo de usuario y dato;
- preparar migraciones de esquema partiendo de una base vacía;
- implementar autenticación, recuperación y perfiles reales;
- implementar el partido compartido y su máquina de estados;
- implementar sincronización offline sin duplicados;
- ejecutar validación, snapshots y actualizaciones de Nivel de forma segura;
- calcular posición actual y cortes semanales de Ranking;
- conservar movimientos, historial y motivos de elegibilidad;
- generar, guardar e invalidar Intelligence de forma reproducible;
- mantener la capa generativa apagable y separada del núcleo funcional;
- preparar entornos de prueba y piloto;
- dividir el desarrollo en handoffs pequeños, con pruebas y criterios de aceptación claros.

La conclusión del análisis fue que, una vez respondidos esos bloqueantes, ya no faltarían decisiones importantes de producto para diseñar el backend mínimo. Quedarían trabajo técnico, pruebas y validación operativa.

---

## 12. Regla para la revisión posterior

Este informe debe utilizarse como lista de control, no como nueva fuente normativa.

Al revisarlo:

1. contrastar cada pregunta con los documentos vigentes;
2. marcar cuáles ya fueron resueltas después de este análisis;
3. no reabrir decisiones que tengan una fuente normativa posterior;
4. trasladar al consolidado principal únicamente las respuestas efectivamente confirmadas;
5. mantener como pendientes las preguntas que todavía no tengan una decisión explícita.

