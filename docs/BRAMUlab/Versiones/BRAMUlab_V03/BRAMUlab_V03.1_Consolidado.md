# BRAMUlab V03.1 — Rediseño de MI PERFIL + compactación de MIS DATOS

## Objetivo

Redefinir visual y funcionalmente **MI PERFIL** y ordenar **MIS DATOS** para separar con claridad:

- identidad deportiva pública/compartible;
- información privada y administrativa de cuenta.

**MI PERFIL** debe sentirse como una verdadera ficha deportiva BRAMU.  
**MIS DATOS** debe quedar como espacio privado, compacto y editable.

No rediseñar Home ni abrir funcionalidades nuevas fuera de este alcance.

---

## 1. PRINCIPIO DE PRODUCTO

### MI PERFIL
Representa quién sos como jugador de pádel.

Debe priorizar:
- identidad deportiva;
- Nivel BRAMU;
- rendimiento;
- evolución.

Debe poder servir a futuro como base del perfil visible por otros usuarios.

### MIS DATOS
Representa tu cuenta privada y editable.

Debe concentrar:
- datos legales/personales;
- datos de acceso;
- seguridad;
- datos declarados que no deben competir con la identidad deportiva.

---

## 2. MI PERFIL — CABECERA DE JUGADOR

### MANTENER
La estructura general actual:
- foto de perfil a la izquierda;
- nombre visible;
- `@usuario`;
- Nivel BRAMU a la derecha.

### AJUSTAR
- Mantener el tamaño actual de la foto.
- Mantener Nivel BRAMU como dato principal a la derecha.
- Dar más presencia visual a `@usuario`: no al mismo peso que el nombre, pero sí más visible que ahora.
- El nombre principal visible en MI PERFIL debe ser **Nombre visible**, no nombre y apellido legales.

### AGREGAR dentro de la misma tarjeta
Tres columnas compactas debajo de la línea principal:

**Edad**  
`37 años`

**Mano dominante**  
`Derecha`

**Lado habitual**  
`Revés`

Usar la misma jerarquía visual ya probada en la tarjeta actual de “Datos declarados”:
- label pequeño/lavado;
- valor más grande/blanco;
- buena separación;
- sin texto corrido.

---

## 3. ELIMINAR — DATOS DECLARADOS EN MI PERFIL

Eliminar por completo:
- título `DATOS DECLARADOS`;
- tarjeta separada actual de Edad / Mano dominante / Lado habitual / Categoría.

La información útil se integra en la cabecera.

La categoría NO debe mostrarse en MI PERFIL.

---

## 4. CATEGORÍA DECLARADA — SOLO EN MIS DATOS

La categoría declarada no debe competir con Nivel BRAMU.

### MANTENER / MOVER en MIS DATOS
Mostrar:
- categoría declarada;
- fecha en la que fue declarada.

Ejemplo:
**Categoría declarada**  
`5ª · declarada el 08 SEP 26`

La categoría es un dato histórico/declarado, no identidad deportiva pública.

No inventar lógica automática de actualización de categoría en esta ronda.

---

## 5. MI PERFIL — BLOQUE RENDIMIENTO

Reemplazar la composición actual por un bloque más visual.

Debe incluir exactamente:
- Efectividad
- Partidos jugados
- Partidos ganados
- Racha actual
- Mejor racha

No agregar derrotas como KPI protagonista.

---

## 6. EFECTIVIDAD — KPI PRINCIPAL

La **Efectividad** debe ser el KPI más protagonista.

Usar un tratamiento visual fuerte, por ejemplo:
- donut / aro;
- porcentaje grande;
- label pequeño.

Ejemplo:
`78%`
**Efectividad**

---

## 7. PARTIDOS JUGADOS + PARTIDOS GANADOS

Deben acompañar a Efectividad dentro del mismo bloque visual.

### Composición sugerida
- Efectividad ocupa una columna grande.
- Partidos jugados y Partidos ganados se apilan en la columna vecina.
- La altura combinada de ambos debe equilibrar visualmente la altura de Efectividad.

Evitar duplicar `14/18` dentro de Efectividad si ya se muestran ambos KPIs separados.

---

## 8. RACHA ACTUAL

### Si hay racha positiva
**Racha actual**  
`6 victorias seguidas`

### Si el último partido fue derrota
**Racha actual**  
`—`

No mostrar:
- “1 derrota”;
- racha negativa;
- textos penalizantes.

---

## 9. MEJOR RACHA

Mostrar:
**Mejor racha**  
`6 victorias`

Agregar contexto temporal breve:
- mismo mes: `SEP 26`
- cruza meses: `SEP–OCT 26`

No usar días exactos salvo necesidad técnica.

---

## 10. PRINCIPIO DE DATOS POSITIVOS

En MI PERFIL:
- destacar rendimiento;
- no convertir derrotas en KPI visible;
- usar Efectividad como síntesis.

Esto no impide usar derrotas en otras pantallas analíticas si hiciera falta.

---

## 11. EVOLUCIÓN DEL NIVEL BRAMU — SIMPLIFICAR

Mantener:
- Nivel actual
- cambio reciente
- gráfico

### Mostrar arriba
**Nivel actual**  
`6.5`

**Cambio últimos 30 días**  
Ejemplo: `↑ 0.4`

Si no hubo cambio:
`— sin cambios en los últimos 30 días`

No mostrar información punto por punto al tocar cada partido.

---

## 12. GRÁFICO — PRINCIPIO VISUAL

El gráfico debe ser:
- línea limpia;
- sin puntos visibles;
- sin markers por partido;
- sin tooltips de cada partido;
- lectura rápida;
- ejes claros.

Debe responder de un vistazo:
“cómo subió o bajó mi Nivel BRAMU”.

---

## 13. EJE Y — RANGO ADAPTATIVO

Usar rango adaptativo.

### Regla
- escala en pasos de `0.25`;
- rango visible aproximado de `1.25` niveles cuando alcance;
- 6 líneas horizontales contando extremos;
- si la variación real supera ese rango, ampliarlo automáticamente.

Ejemplo:
`6.75`
`6.50`
`6.25`
`6.00`
`5.75`
`5.50`

No usar una escala fija que aplaste la curva.

---

## 14. EJE X — DENSIDAD ADAPTATIVA

No mostrar un punto/label por partido.

Adaptar densidad al historial:
- pocos días: más referencias;
- ~1 mes: semanas;
- 2–3 meses: semanas o quincenas según densidad;
- varios meses: referencias mensuales.

Objetivo: aproximadamente 4 a 8 referencias legibles.

Ejemplos:
- Semana: `02 SEP · 04 SEP · 06 SEP · 08 SEP`
- Mes: `SEM 1 · SEM 2 · SEM 3 · SEM 4`
- Varios meses: `JUN · JUL · AGO · SEP`

---

## 15. MIS DATOS — COMPACTAR IDENTIDAD

Hoy MIS DATOS consume demasiado espacio vertical.

### REORGANIZAR
En la tarjeta Identidad:
- foto a la izquierda;
- a la derecha:
  - nombre y apellido;
  - `@usuario`;
  - nombre visible.

Mantener la foto editable.

No centrar la foto si desperdicia espacio.

---

## 16. MIS DATOS — COMPACTAR DATOS PERSONALES / DEPORTIVOS

Agrupar en filas de 2 o 3 columnas cuando entren correctamente.

Ejemplo:
- Fila 1: Fecha de nacimiento + Edad
- Fila 2: Género + Mano dominante + Lado habitual
- Fila 3: Categoría declarada + fecha de declaración

Priorizar:
- legibilidad;
- menor scroll;
- mejor uso horizontal.

No forzar 3 columnas si en mobile compromete lectura.

---

## 17. NOMBRE VISIBLE VS NOMBRE LEGAL

### MI PERFIL
Mostrar:
- Nombre visible
- `@usuario`

### MIS DATOS
Mostrar:
- Nombre
- Apellido
- `@usuario`
- Nombre visible

Nombre y apellido quedan como datos reales/privados de cuenta.

---

## 18. FOTO DE PERFIL

Mantener comportamiento actual.

La foto debe poder editarse desde:
- MI PERFIL;
- MIS DATOS.

No volver a agregar “Quitar foto” visible en estas dos pantallas.

---

## 19. ACCESO Y SEGURIDAD — AJUSTES UX

### Cambiar contraseña
El action/button actual quedó demasiado angosto.

Ajustar a:
- touch target correcto;
- altura consistente con el sistema;
- mejor presencia visual.

No cambiar la lógica de contraseña.

---

## 20. CERRAR SESIÓN — SEPARAR Y CONFIRMAR

Actualmente cerrar sesión ocurre con un toque inmediato.

### REEMPLAZAR
- separar visualmente `Cerrar sesión` de `Cambiar contraseña`;
- dar más aire entre ambas acciones;
- al tocar `Cerrar sesión`, mostrar modal de confirmación.

### Modal
**¿Cerrar sesión?**

Texto:
`Vas a tener que volver a ingresar con tu email y contraseña para acceder a tu cuenta.`

Acciones:
- `CANCELAR`
- `CERRAR SESIÓN`

Solo cerrar después de confirmación.

No usar estética alarmista innecesaria.

---

## 21. HOME — NO TOCAR

No modificar:
- Home;
- widgets;
- últimos partidos;
- Tu momento;
- navegación;
- sistema de nivel.

Home sigue siendo fuente de verdad visual general.

---

## 22. RANKING — NO IMPLEMENTAR

No tocar Ranking en esta versión.

No agregar:
- ranking real;
- mejor ranking;
- puntos;
- títulos;
- posiciones ficticias.

---

## 23. TESTS

Agregar/adaptar tests focalizados para:
1. MI PERFIL usa Nombre visible + `@usuario`;
2. categoría no aparece en MI PERFIL;
3. edad/mano/lado renderizan correctamente;
4. categoría declarada permanece en MIS DATOS;
5. fecha de categoría declarada se conserva/renderiza;
6. partidos jugados correctos;
7. partidos ganados correctos;
8. efectividad correcta;
9. racha actual positiva correcta;
10. racha actual tras derrota devuelve `—`;
11. mejor racha correcta;
12. rango temporal de mejor racha correcto;
13. evolución usa datos reales;
14. cambio 30 días correcto;
15. rango Y adaptativo correcto;
16. sesión NO se cierra sin confirmación;
17. cerrar sesión confirmado sí funciona;
18. foto sigue editable;
19. sin regresiones de identidad/session.

Suite completa una sola vez al cierre.

---

## 24. QA MOBILE + DESKTOP

Validar:
1. cabecera compacta y legible;
2. foto conserva tamaño suficiente;
3. `@usuario` tiene mejor presencia;
4. Edad / Mano dominante / Lado habitual entran correctamente;
5. no aparece categoría en MI PERFIL;
6. desaparece bloque “Datos declarados”;
7. Rendimiento se siente visual;
8. Efectividad es protagonista;
9. Partidos jugados/ganados equilibran el bloque;
10. racha actual positiva;
11. racha actual neutral tras derrota;
12. mejor racha muestra fecha breve;
13. gráfico sin puntos;
14. eje Y legible y adaptativo;
15. eje X no se sobrecarga;
16. MIS DATOS ocupa menos alto;
17. foto editable en ambos lugares;
18. Cambiar contraseña tiene touch target correcto;
19. Cerrar sesión separado;
20. modal de cierre funciona;
21. Home sin regresiones;
22. Historial/Notificaciones sin regresiones;
23. suite completa verde.

---

## 25. NO TOCAR

No modificar:
- Home;
- Historial;
- Ranking;
- Notificaciones;
- flujo de registro de partido;
- tabs Punto a punto / Por games;
- Player Intelligence;
- lógica de scoring;
- backend;
- social;
- fórmula real de Nivel BRAMU;
- arquitectura de identidad salvo lo mínimo necesario para fecha de categoría declarada.

---

## 26. FORMA DE TRABAJO CON CLAUDE

Este consolidado se considera **cerrado**.

Claude debe:
1. leer completo;
2. auditar brevemente el estado real;
3. implementar directamente;
4. no presentar plan para aprobación;
5. reutilizar componentes existentes cuando sea razonable;
6. no rediseñar fuera del alcance;
7. usar tests focalizados;
8. correr suite completa una sola vez al final;
9. validar mobile + desktop;
10. corregir errores dentro del alcance;
11. generar informe;
12. commit;
13. tag;
14. push;
15. deploy.

Solo detenerse si aparece:
- riesgo real de pérdida de datos;
- contradicción fuerte de producto;
- acción destructiva no prevista;
- necesidad real de salir del alcance.

---

## 27. VERSIONADO

Publicar como:

**BRAMUlab V03.1**

Actualizar:
- `APP_VERSION`;
- `version.json`;
- service worker/cache;
- referencias necesarias.

Generar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1_Informe.md`

El informe debe incluir:
- nueva arquitectura MI PERFIL / MIS DATOS;
- cambios visuales;
- categoría declarada + fecha;
- KPIs;
- rachas;
- evolución;
- seguridad;
- tests;
- QA;
- hashes;
- tag;
- deploy;
- diferencias justificadas.

---

# CRITERIO DE ÉXITO

V03.1 queda cerrada si:
- MI PERFIL se siente como ficha deportiva;
- MIS DATOS se siente privado, compacto y administrativo;
- Nivel BRAMU domina sobre categoría;
- Efectividad y rendimiento ganan fuerza visual;
- la evolución se entiende de un vistazo;
- cerrar sesión deja de ser accidental;
- no aparecen regresiones;
- no se agrega funcionalidad fuera de alcance.
