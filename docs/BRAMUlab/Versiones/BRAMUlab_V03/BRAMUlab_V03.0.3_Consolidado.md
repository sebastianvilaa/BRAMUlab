# BRAMUlab V03.0.3 — Perfil deportivo, acceso público y correcciones visuales

## Objetivo

V03.0.2 quedó publicada y funcional. La prueba real dejó tres frentes concretos:

1. **MI PERFIL todavía no funciona como una ficha deportiva real.**
2. **Bienvenida / Login / Crear cuenta / Completar acceso todavía no se sienten suficientemente BRAMU.**
3. Persisten ajustes puntuales: avatar superpuesto, escala del gráfico, edición de foto y flechas superiores.

**El Home actual sigue siendo la referencia visual y NO se rediseña.**

La diferencia conceptual queda así:

- **Home:** estado actual / lectura rápida.
- **MI PERFIL:** ficha deportiva / trayectoria / rendimiento.
- **MIS DATOS:** identidad, datos declarados, acceso y seguridad.

No inventar estadísticas ni ranking.

---

## 1. BUG — avatar del Home

### CORREGIR DEFINITIVAMENTE

En V03.0.2 siguen viéndose simultáneamente la foto y el fallback genérico.

Cuando existe `profilePhoto`:
- mostrar únicamente la foto;
- ocultar completamente el fallback, también a nivel CSS/layout.

Cuando no existe:
- mostrar únicamente el fallback.

Seguir usando `Store.getCurrentUser().profilePhoto`.

### QA obligatorio
Probar:
- cuenta con foto;
- cuenta sin foto;
- cambiar foto;
- quitar foto;
- recargar;
- logout/login.

Nunca deben aparecer las dos capas simultáneamente.

---

## 2. MI PERFIL — convertirlo en ficha deportiva

### REEMPLAZAR / FUSIONAR

La cabecera de MI PERFIL debe tomar el lenguaje de la tarjeta del jugador del Home, sin copiarla pixel por pixel.

Debe incluir:
- foto/avatar;
- nombre visible;
- @usuario;
- Nivel BRAMU o calibración;
- progreso/variación cuando corresponda.

La cantidad de partidos puede salir de esa cabecera y pasar al bloque de estadísticas si mejora la lectura.

### FOTO EDITABLE

La foto debe poder editarse tocándola desde MI PERFIL:
- reemplazar;
- quitar;
- reutilizar upload + resize/compression actual.

Agregar affordance pequeño (cámara/lápiz), no un botón grande.

---

## 3. Datos de la ficha deportiva

### AGREGAR — datos declarados existentes
- Edad
- Mano dominante
- Lado habitual
- Categoría declarada

### AGREGAR — rendimiento ya calculable
- Partidos jugados
- Partidos ganados
- Efectividad
- Racha actual
- Mejor racha

### Nivel BRAMU
Mostrar:
- nivel actual si corresponde;
- mejor Nivel BRAMU histórico, solo si puede calcularse con la serie real existente;
- variación acumulada si ya existe y está respaldada por datos.

### NO MOSTRAR todavía
- ranking actual real;
- mejor ranking;
- puntos;
- títulos;
- posición nacional/categoría.

BRAMU todavía no tiene ranking real. No usar placeholders que parezcan datos verdaderos.

### UX
Evitar una sucesión de tarjetas grandes.
Preferir una ficha compacta, uno o dos bloques y filas/mini-KPIs.

Debe sentirse como:
**“esta es mi ficha como jugador”**,
no como otra copia del Home.

---

## 4. Evolución del Nivel BRAMU

La V03.0.2 agregó ejes, pero el eje Y sigue siendo engañoso porque abre demasiado la escala.

### REEMPLAZAR escala visual Y
1. obtener mínimo y máximo reales de la serie;
2. agregar margen pequeño arriba/abajo;
3. redondear a pasos legibles;
4. mostrar 3–5 marcas como máximo.

Ejemplo: si la serie real va de 5.9 a 6.6, no usar una escala tipo 4.3–7.2.

No exagerar visualmente variaciones pequeñas.

### Eje X
Usar fechas reales y evitar labels repetidos/confusos:
- rango corto → día/mes;
- semanas → fechas espaciadas;
- meses → mes/año.

No usar scroll horizontal como solución principal.

Para cuentas en calibración:
- respetar el gate existente;
- no mostrar evolución numérica ficticia.

---

## 5. MIS DATOS

La estructura actual queda aprobada.

### AGREGAR
Mostrar foto/avatar en la parte superior del bloque de identidad.

Debe poder editarse también desde MIS DATOS.

### MANTENER
- lápiz de edición;
- identidad;
- datos personales/deportivos;
- acceso y seguridad.

No volver al botón full-width “EDITAR DATOS”.

---

## 6. Cerrar sesión

Mantener en:

**MIS DATOS → Acceso y seguridad**

Es una acción de baja frecuencia y pertenece a la cuenta.

Solo mejorar visibilidad/spacing si hace falta.
No convertirla en CTA principal.

---

## 7. Restaurar flechas superiores

La eliminación de flechas en V03.0.2 no quedó bien.

### REEMPLAZAR
Volver a mostrar flecha “atrás” en:
- Historial
- Ranking
- Perfil

La bottom nav se mantiene. Ambas formas de navegación pueden convivir.

### Comportamiento
- si no existe origen especial → volver a Home;
- si Historial fue abierto desde otro flujo → conservar comportamiento contextual existente.

Mantener misma posición/altura de header ya unificada.

---

## 8. Familia sin sesión — identidad BRAMU

Pantallas:
- Bienvenida
- Iniciar sesión
- Crear cuenta
- Completar acceso

La lógica funciona. El problema es visual.

### OBJETIVO
Que se sientan claramente BRAMU usando las constantes ya validadas:
- wordmark;
- fondo;
- márgenes;
- tipografía;
- radios;
- verde/azul;
- jerarquía;
- densidad.

No crear una exploración visual paralela ni rediseñar el Home.

---

## 9. Bienvenida sin sesión

Mantener exactamente:
1. INICIAR SESIÓN
2. CREAR CUENTA
3. REGISTRAR PARTIDO SIN CUENTA

### AJUSTAR
- dar más presencia y mejor ubicación al wordmark;
- reducir botones sobredimensionados;
- mejorar ritmo vertical;
- tercera acción clara y deliberada, no link perdido.

Texto auxiliar permitido:
**“Jugá sin crear perfil ni guardar historial.”**

No mostrar bottom nav personal.

---

## 10. Login

Mantener lógica actual.

### AJUSTAR
- identidad visual;
- header;
- tamaños;
- espaciado;
- error con aire suficiente;
- eye icon actual;
- CTA menos sobredimensionado.

### NO AGREGAR “Olvidé mi contraseña”
Todavía no existe recuperación real por email porque la autenticación es local.

Documentar como pendiente de la etapa backend.

---

## 11. Crear cuenta / Completar acceso

Mantener:
- flujo;
- pasos;
- validaciones;
- lógica.

Aplicar las mismas constantes visuales de Bienvenida/Login.

No perder identidad al entrar en formularios.

---

## 12. Registrar partido sin cuenta

La lógica actual se mantiene: invitado no persiste historial personal ni `userId`.

### REEMPLAZAR selector de modo
Quitar el selector actual “Punto a punto / Por games” del encabezado.

Usar dos solapas/tabs claras, debajo del header BRAMU:

**PUNTO A PUNTO | POR GAMES**

Antes de equipos/configuración.

La elección debe ser evidente, táctil y mobile-first.

### Navegación
Sin sesión:
- no mostrar bottom nav personal;
- agregar al final una acción discreta:
  **Volver al inicio**

No mostrar Historial / Ranking / Perfil.

### Header
Mantener wordmark BRAMU visible.
No meter el selector de modo dentro del wordmark/header.

---

## 13. Notificaciones

La estructura funcional de V03.0.2 queda aprobada.

No rediseñar lógica ni agregar nuevos tipos salvo necesidad directa de esta ronda.

Solo adaptar:
- flecha;
- header;
- constantes visuales si corresponde.

Mantener:
- pantalla completa;
- badge;
- read/unread;
- agrupación temporal;
- persistencia por `userId`.

---

## 14. Integridad de métricas

### Permitido
Solo si los datos actuales lo permiten:
- jugados;
- ganados;
- perdidos;
- efectividad;
- racha actual;
- mejor racha;
- mejor Nivel BRAMU histórico.

### No permitido
- ranking real;
- puntos;
- títulos;
- posiciones;
- estadísticas individuales de golpes.

No inventar datos.

---

## 15. NO TOCAR

No implementar:
- backend;
- Supabase/Firebase;
- recuperación real de contraseña;
- ranking real;
- social/amigos;
- compartir partidos;
- notificaciones push;
- nueva fórmula de Nivel BRAMU;
- Player Intelligence nuevo;
- rediseño general del Home;
- rediseño general de Historial;
- rediseño completo del marcador;
- arquitectura nueva de identidad.

---

## 16. Tests y eficiencia

Durante implementación:
- usar tests focalizados;
- no correr suite completa después de cada ajuste visual;
- suite completa una sola vez al cierre.

Agregar tests solo para lógica nueva real.

### Casos mínimos
- foto/fallback excluyentes;
- mejor racha;
- mejor nivel histórico si se implementa;
- escala del gráfico con rangos diferentes;
- tabs Punto a punto / Por games;
- invitado sigue sin persistir historial ni `userId`;
- “Volver al inicio”;
- flechas raíz y origen contextual;
- editar foto desde MI PERFIL y MIS DATOS conserva mismo `profilePhoto`.

### QA manual mobile + desktop
1. Home sin regresiones.
2. Avatar sin superposición.
3. MI PERFIL se siente ficha deportiva.
4. Foto editable desde MI PERFIL.
5. Foto editable desde MIS DATOS.
6. Edad/mano/lado/categoría correctos.
7. Jugados/ganados/efectividad correctos.
8. Racha actual/mejor racha correctas.
9. Mejor Nivel BRAMU correcto si aplica.
10. Gráfico con escala Y cercana a datos reales.
11. Eje X legible.
12. Perfil/Historial/Ranking con flecha.
13. Cerrar sesión accesible.
14. Bienvenida integrada visualmente.
15. Login integrado visualmente.
16. Crear cuenta integrado visualmente.
17. Completar acceso integrado visualmente.
18. Invitado muestra tabs de modo.
19. “Volver al inicio” funciona.
20. Sin sesión no aparece bottom nav personal.
21. Notificaciones siguen funcionando.
22. Suite completa sin regresiones.

---

## 17. Forma de trabajo con Claude

Este consolidado se considera cerrado.

Claude debe:
1. leer completo;
2. auditar brevemente el estado real;
3. implementar directamente;
4. no presentar plan para aprobación;
5. usar tests focalizados;
6. correr suite completa al final;
7. validar mobile + desktop;
8. corregir errores dentro del alcance;
9. generar informe;
10. commit;
11. tag;
12. push;
13. deploy.

Solo detenerse por:
- riesgo real de pérdida de datos;
- contradicción que cambie producto;
- acción destructiva no prevista;
- necesidad real de salir del alcance.

---

## 18. Versionado

Publicar como:

**BRAMUlab V03.0.3**

Actualizar:
- `APP_VERSION`;
- `version.json`;
- service worker/cache;
- referencias necesarias.

Generar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3_Informe.md`

El informe debe incluir:
- corrección avatar;
- nueva MI PERFIL;
- métricas;
- mejor racha;
- mejor nivel si aplica;
- gráfico;
- foto editable;
- flechas;
- familia sin sesión;
- tabs de registro;
- navegación invitado;
- tests;
- QA;
- hashes;
- tag;
- deploy;
- diferencias justificadas.

---

# Criterio de éxito

V03.0.3 queda bien si:

- Home sigue intacto salvo bugs;
- MI PERFIL empieza a sentirse como la ficha deportiva real del jugador;
- MIS DATOS conserva su rol administrativo;
- el gráfico se entiende sin escalas engañosas;
- editar la foto es natural;
- Perfil/Historial/Ranking recuperan navegación superior;
- Bienvenida/Login/Crear cuenta/Completar acceso se sienten BRAMU;
- registrar sin cuenta tiene una elección clara de modo;
- no se inventa ningún dato que todavía no existe.
