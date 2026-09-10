# BRAMUlab V03.3 — Perfil público, búsqueda y sistema de jugadores

## Objetivo

Construir la primera experiencia de “jugadores” de BRAMU sin implementar todavía una red social completa.

Esta ronda debe permitir:
- descubrir jugadores;
- abrir el perfil público de otro jugador;
- agregarlo a una lista personal de jugadores;
- consultar esa lista desde Perfil;
- reutilizar el mismo patrón visual de jugador en búsqueda y selección de compañero/rival.

No implementar seguidores, amigos, popularidad, mensajes, invitaciones ni armado de partidos desde perfiles.

La lógica de esta ronda puede seguir siendo local/simulada. El backend real se implementará más adelante.

---

# 1. PRINCIPIO DE PRODUCTO

BRAMU no tendrá, por ahora:
- amigos;
- seguidores;
- followers;
- contadores públicos;
- métricas de popularidad.

La relación será simplemente:

**JUGADORES**

Una persona puede agregar jugadores para tenerlos a mano.

No implica amistad, seguimiento recíproco ni jerarquía social.

No mostrar:
- cuántos jugadores tiene agregados una persona;
- quién agregó a quién;
- ningún número de popularidad.

---

# 2. NUEVA PANTALLA — PERFIL PÚBLICO DE JUGADOR

Crear una pantalla simulada de “perfil visto por otro jugador”.

No usar tabs `MI PERFIL / MIS DATOS`.

Debe ser una sola pantalla pública.

## 2.1 Cabecera / identidad

Reutilizar visualmente la tarjeta de identidad actual de MI PERFIL.

Mostrar:
- foto/avatar;
- nombre visible;
- `@usuario`;
- Nivel BRAMU actual;
- edad;
- mano dominante;
- lado habitual.

No mostrar:
- email;
- fecha de nacimiento;
- género;
- categoría declarada;
- datos de acceso;
- contraseña;
- información privada;
- controles de edición.

## 2.2 Nombre real

No convertir nombre y apellido reales en protagonista de la cabecera.

La identidad principal sigue siendo:
- nombre visible;
- `@usuario`.

El nombre real puede quedar disponible para búsqueda/identificación interna del prototipo, pero no agregar una nueva línea visible si no es necesaria para la composición.

## 2.3 Rendimiento público

Reutilizar la tarjeta actual de Efectividad:

Mostrar:
- Efectividad;
- Partidos jugados;
- Partidos ganados.

Debajo mostrar dos tarjetas:

### Mejor racha
- cantidad máxima de victorias consecutivas;
- fecha breve como en MI PERFIL.

### Mejor nivel BRAMU
- valor máximo histórico;
- `ACT` si coincide con el nivel actual;
- si no coincide, fecha breve `MON YY`.

## NO mostrar
- Racha actual.
- Evolución del Nivel BRAMU.
- gráficos personales de evolución.
- cualquier dato privado.

La evolución es información personal del usuario y permanece solo en MI PERFIL.

---

# 3. ACCIÓN “AGREGAR JUGADOR”

Al final del perfil público agregar una acción clara:

`AGREGAR JUGADOR`

Cuando ya esté agregado, reemplazar el estado visual por:

`JUGADOR AGREGADO`

No implementar todavía:
- mensajes;
- invitaciones;
- compartir;
- bloquear;
- seguir;
- amistad;
- reciprocidad.

La acción solo agrega/remueve de la lista local personal de jugadores.

Si hace falta una acción para quitarlo, puede resolverse desde el estado `JUGADOR AGREGADO` mediante una interacción simple y consistente, sin crear un flujo complejo.

---

# 4. HOME — AGREGAR “BUSCAR JUGADORES”

Agregar al final del contenido principal del Home, después de las tarjetas actuales de compañeros/rivales, una tarjeta horizontal coherente con el sistema existente.

Contenido:
- icono lupa;
- texto `BUSCAR JUGADORES`.

Debe sentirse como una tarjeta/entrada de navegación, no como un input editable embebido en Home.

Al tocar:
- abrir una pantalla completa de búsqueda de jugadores.

No alterar las tarjetas existentes del Home.

---

# 5. NUEVA PANTALLA — BUSCAR JUGADORES

Crear una pantalla completa de búsqueda.

## Header
Usar el mismo sistema visual de headers ya aprobado.

Título:
`BUSCAR JUGADORES`

## Buscador
Campo de búsqueda arriba.

Placeholder:
`Buscar jugador...`

Buscar por:
- `@usuario`;
- nombre visible;
- nombre real/apellido si existe en datos simulados.

El resultado debe servir para identificar personas, no para mostrar estadísticas completas.

---

# 6. COMPONENTE ÚNICO — FILA DE JUGADOR

No crear una nueva tarjeta compleja.

Reutilizar y mejorar el patrón existente de:
- Elegir compañero;
- Elegir rival.

Crear un componente visual único para filas de jugador y reutilizarlo en:
- Buscar jugadores;
- Elegir compañero;
- Elegir rival;
- lista JUGADORES dentro de Perfil.

## Contenido de cada fila

Izquierda:
- foto/avatar;
- nombre visible;
- `@usuario`.

Derecha:
- número de Nivel BRAMU en tamaño destacado;
- debajo, label chica `NIVEL BRAMU`.

Ejemplo conceptual:

[avatar]  Matu
          @matu                    5.8
                                 NIVEL BRAMU

No mostrar en esta fila:
- efectividad;
- mano;
- lado;
- racha;
- partidos;
- categoría.

## Separación

Agregar una línea divisoria horizontal muy suave entre jugadores.

La línea debe:
- ayudar a escanear;
- no parecer una tabla pesada;
- mantener el estilo dark/navy de BRAMU.

Toda la fila debe ser clickeable.

---

# 7. ACOMODAR “ELEGIR COMPAÑERO / ELEGIR RIVAL”

Actualizar el selector actual para usar el mismo componente definido en §6.

AGREGAR:
- separadores suaves;
- Nivel BRAMU a la derecha;
- label `NIVEL BRAMU`.

Mantener:
- buscador actual;
- avatar;
- nombre;
- @usuario;
- lógica de selección;
- navegación.

No cambiar funcionamiento del partido.

---

# 8. PERFIL — AGREGAR TERCERA TAB

En la pantalla Perfil, agregar una tercera pestaña:

`JUGADORES`

Quedan:
- `MI PERFIL`
- `MIS DATOS`
- `JUGADORES`

No usar “Mis jugadores”.

La palabra `JUGADORES` describe la sección sin dar una sensación posesiva o social.

## Contenido de JUGADORES

Mostrar la lista de jugadores agregados por el usuario usando exactamente el mismo componente de fila definido en §6.

Al tocar una fila:
- abrir perfil público del jugador.

Si no hay jugadores:
mostrar estado vacío breve y claro con acción para buscar jugadores.

Ejemplo:
`Todavía no agregaste jugadores.`

CTA:
`BUSCAR JUGADORES`

No agregar métricas ni contadores.

---

# 9. DATOS SIMULADOS

Hasta que exista backend real:
- usar jugadores simulados/locales;
- reutilizar los nombres ya existentes en el prototipo cuando sea posible;
- asignar Nivel BRAMU simulado coherente para poder probar la interfaz;
- no inventar una red social completa.

La relación de “jugador agregado” puede persistirse en localStorage como dato temporal del prototipo.

Debe quedar claramente aislada para poder reemplazarse por backend real en V04.

---

# 10. ACCESOS AL PERFIL PÚBLICO

Para esta ronda, implementar como mínimo:

1. Desde `BUSCAR JUGADORES`.
2. Desde la tab `JUGADORES`.
3. Desde tarjetas del Home donde el jugador ya está individualizado:
   - Mejor compañero.
   - Rival más enfrentado.

Si técnicamente es simple y no rompe nada, también puede habilitarse desde otros contextos donde el jugador esté claramente identificado.

NO forzar acceso desde Resumen del partido si la UI actual no lo permite naturalmente.

No rediseñar Resumen para esta ronda.

---

# 11. NO IMPLEMENTAR TODAVÍA

No implementar:
- seguidores;
- amigos;
- solicitudes de amistad;
- contador de seguidores;
- contador de jugadores;
- popularidad;
- mensajes;
- chat;
- invitaciones;
- armado de partido desde perfil;
- compartir perfil;
- bloqueo;
- privacidad avanzada;
- recomendaciones sociales;
- grupos;
- notificaciones sociales.

Todo eso queda futuro.

---

# 12. COHERENCIA VISUAL

Tomar como fuente de verdad:
- Home actual;
- MI PERFIL;
- MIS DATOS;
- selector Elegir compañero/rival;
- sistema de botones V03.2.x.

No crear otro lenguaje visual.

Reutilizar:
- bordes;
- radios;
- fondos;
- tipografía actual;
- spacing;
- colores;
- headers;
- tabs;
- filas;
- botones.

No usar Montserrat ni introducir otra tipografía.
Usar la fuente real vigente del sistema.

---

# 13. TESTS Y QA

## Tests
Agregar tests solo si se incorpora lógica local nueva de:
- agregar/quitar jugador;
- persistencia;
- búsqueda;
- navegación a perfil público.

No crear tests de CSS.

Suite completa una sola vez al cierre.

## QA mobile obligatorio
Revisar:
- Home con Buscar jugadores;
- pantalla Buscar jugadores;
- resultados de búsqueda;
- perfil público;
- estado Agregar jugador;
- estado Jugador agregado;
- tab JUGADORES;
- lista vacía;
- lista con jugadores;
- Elegir compañero;
- Elegir rival;
- accesos desde Mejor compañero / Rival más enfrentado.

## Desktop
Chequeo rápido.

---

# 14. CRITERIOS DE ÉXITO

La ronda queda cerrada si:

- existe un perfil público claro y sin datos privados;
- la búsqueda usa filas compactas;
- Nivel BRAMU ayuda a identificar al jugador;
- el mismo patrón de fila se reutiliza en búsqueda/selección/listado;
- existe una lista JUGADORES dentro de Perfil;
- no se introduce lógica de seguidores/amigos;
- no aparecen contadores sociales;
- Home incorpora Buscar jugadores sin romper su jerarquía;
- no se rediseñan pantallas estables;
- el flujo completo funciona en mobile.

---

# 15. VERSIONADO

Usar:

**BRAMUlab V03.3**

Actualizar los puntos de versión/cache vigentes.

Generar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.3_Informe.md`

El informe debe incluir:
- pantallas agregadas;
- componente de fila reutilizado;
- datos simulados;
- persistencia local;
- accesos implementados;
- tests;
- QA;
- commit;
- tag;
- deploy.

---

# FORMA DE TRABAJO

Implementar directamente.

No presentar plan.

Resolver de forma sistémica y reutilizando componentes existentes.

No rediseñar Home, MI PERFIL, MIS DATOS ni selector de jugadores más allá de los puntos expresamente indicados.

Solo detenerse por:
- riesgo de pérdida de datos;
- contradicción real de producto;
- necesidad de salir del alcance;
- acción destructiva no prevista.

Al terminar:
- QA mobile;
- chequeo desktop;
- suite completa una sola vez;
- informe;
- commit;
- tag;
- push;
- deploy.
