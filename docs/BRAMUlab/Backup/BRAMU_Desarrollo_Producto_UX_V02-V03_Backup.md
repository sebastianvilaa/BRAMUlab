# BRAMUlab — Backup final de Producto, UX y Desarrollo

**Fecha de cierre:** 10/09/2026  
**Función:** respaldo recuperable de decisiones y criterios útiles de este chat.  
**Prioridad:** si este archivo contradice un consolidado, informe o versión posterior, prevalece la fuente más nueva.

## Objetivo de este chat

Espacio principal de producto, UX, revisión visual y coordinación con Claude Code durante el cierre de V02.x y la preparación de V03.0. Sirvió para detectar problemas, definir pantallas/componentes, revisar capturas reales, convertir decisiones en instrucciones implementables y separar lo confirmado de lo futuro.

## Principios de producto vigentes

BRAMUlab está pensado principalmente para jugadores amateurs de pádel. Debe sentirse deportivo, moderno, claro, visual, ágil, amigable y aspiracional, sin convertirse en una herramienta profesional compleja.

La prioridad sigue siendo registrar un partido con facilidad y devolver suficiente valor después como para querer volver a usar la app.

No inventar estadísticas individuales si no hay datos suficientes. BRAMU Intelligence debe basarse en datos reales.

Es válido acercar códigos visuales del pádel profesional al amateur cuando mejora la experiencia. Las fichas de Premier Padel sirven como referencia para futuras Player Cards.

## Estado útil de V02.x

La etapa V02.x quedó cerrada visualmente antes del salto a V03.0. El usuario mencionó V02.9.3 como estado final.

### Home

- Fondo actual aprobado; no retocarlo por diferencias menores desktop/iPhone sin nueva evidencia.
- Nivel BRAMU: animación con keyframes/transform.
- Actividad: se abandonó la técnica frágil transición + reflow; se migró a keyframes + scaleY().
- Efectividad: criterio final = aro nítido, verde fuerte, sin blur. El usuario pidió finalmente grosor principal de 3px. No forzar glow si genera desenfoque.

### Último partido

Componente madre para representar un partido ya jugado.

Estructura confirmada:
- línea 1: `ÚLTIMO PARTIDO` + fecha/hora;
- línea 2: puntitos de forma + `VICTORIA` / `DERROTA`;
- resultado protagonista;
- participantes abajo izquierda;
- `CLÁSICO` / `PUNTO DE ORO` abajo derecha;
- mantener la estética existente.

Ajuste final manual:
- `.player-home-lastmatch__row1 { margin-bottom: 3px; }`

### Historial

Decisión central: **Historial = versión compacta de Último partido**.

Cada card:
- fecha/hora;
- `VICTORIA` / `DERROTA`;
- resultado;
- participantes;
- `CLÁSICO` / `PUNTO DE ORO`;
- tap abre Resumen.

Ajustes finales:
- score ~30px;
- score weight 800;
- score margin-bottom 3px;
- participantes 13px;
- participantes weight 500;
- color neutro tipo `var(--paper-dim)`;
- no destacar por color ni ganador ni pareja propia.

**OBSOLETO:** destacar ganador o pareja propia, mostrar `PARTIDO CARGADO`, mostrar `POR GAMES` como metadata protagonista, X de borrado en Historial.

### Resumen

- Historial → partido → Resumen funciona.
- `Eliminar partido` vive al final del Resumen.
- Confirmación: `¿Eliminar este partido?` + `Se actualizarán tu historial y tus estadísticas.` + `Cancelar / Eliminar`.

Futuro multiusuario: posible `ocultar de mi historial`, `solicitar eliminación` o requerir confirmación. No implementar todavía.

### Agregar jugador sin cuenta

El CTA grande fue reemplazado por fila contextual integrada a la búsqueda:
- filtra jugadores existentes;
- ofrece `Agregar a “X”`;
- icono persona +;
- diferenciada de un usuario real;
- sin bloque grande aparte.

La versión actual se consideró correcta por el momento.

## Lecciones técnicas relevantes

### Animaciones
El easing global hacía parecer instantáneas algunas animaciones. Se introdujo easing específico para Home sin tocar el global.

### CSS
`styles.css` seguía siendo mantenible. No modularizar solo por tamaño o tokens. Modularizar cuando exista un problema real.

### Comentarios en código
No limpiar por estética solamente. En futura auditoría:
- conservar comentarios que expliquen decisiones no obvias;
- borrar comentarios históricos inútiles;
- borrar TODOs resueltos;
- mover pendientes reales al Backlog;
- usar Git/tags/informes como historial.

## V03.0 — Acceso, identidad y creación de jugador

Documento vigente:
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Consolidado.md`

Objetivo: validar la experiencia completa de identidad antes de conectar backend real.

Sensación buscada: **“Ya tengo mi jugador dentro de BRAMU.”**

### Acceso
- INICIAR SESIÓN
- CREAR CUENTA

### Crear cuenta — 3 pasos

**Paso 1 — Crear acceso**
- email;
- contraseña;
- repetir contraseña;
- validar formato/duplicados;
- contraseña con mayúscula, minúscula, número, símbolo y longitud mínima razonable.
- No SMS/teléfono en esta etapa.

**Paso 2 — Tu identidad**
- foto opcional;
- nombre;
- apellido;
- `@usuario`;
- nombre visible.

Separación confirmada:
1. nombre real;
2. nombre visible;
3. @usuario único.

Uso:
- nombre visible en partidos, rankings y grupos;
- @usuario para identificar/buscar;
- nombre real como identidad.
- No usar @usuario como nombre visible dentro de partidos.

Foto:
- avatar circular;
- iniciales si no hay foto;
- editar con lapicito;
- cargar desde dispositivo/cámara;
- reemplazar/eliminar;
- volver a iniciales al eliminar.

**Paso 3 — Tu pádel**
- fecha de nacimiento;
- género;
- mano hábil;
- lado habitual;
- categoría actual.

Opciones:
- mano: derecha/izquierda;
- lado: drive/revés/indiferente;
- categoría: 1ª a 9ª + `No sé mi categoría`.

La categoría declarada no es el Nivel BRAMU: solo una semilla futura.

### Player Card

Al terminar el alta:
- `TU JUGADOR ESTÁ LISTO`;
- Player Card inspirada en Premier Padel/FIP;
- foto/avatar;
- nombre visible;
- @usuario;
- edad;
- mano hábil;
- lado habitual;
- categoría declarada.

Nivel:
- `NIVEL BRAMU`
- `CALIBRANDO`
- `0 / 5 PARTIDOS`
- `Completá 5 partidos para conocer tu Nivel BRAMU.`

No inventar nivel matemático todavía.

### Perfil

Mostrar/editar:
- foto;
- nombre visible;
- @usuario;
- nombre/apellido;
- fecha nacimiento/edad;
- género;
- mano;
- lado;
- categoría.

No permitir editar datos calculados futuros como nivel, mejor nivel, ranking, partidos, victorias, efectividad.

### Login/logout local

- login local con email + contraseña;
- logout no borra usuario ni historial;
- recuperación real de contraseña fuera de alcance.

## Nivel BRAMU — conceptos recuperables

El algoritmo definitivo NO quedó definido en este chat.

### Categoría declarada
Sirve como semilla inicial, no como nivel definitivo.

### Calibración
- no mostrar nivel definitivo al registrarse;
- usar `CALIBRANDO`;
- objetivo UX inicial: 5 partidos;
- mostrar progreso 0/5 → 5/5;
- si aún no existe fórmula, puede mostrarse `CALIBRACIÓN COMPLETA` sin inventar número.

### Confianza
Concepto clave para investigación:
- 2 partidos no pesan igual que 200;
- jugadores nuevos pueden moverse más rápido;
- jugadores estabilizados deben tener menor volatilidad;
- una victoria aislada contra rivales muy superiores no debería redefinir todo;
- estabilidad dentro de una banda es normal.

Distinguir a futuro:
- nivel actual;
- mejor nivel histórico.

## Ranking, categorías, AJPP y mixtos

Pendiente de investigación profunda.

Investigar:
- Playtomic;
- Elo/Glicko u otros;
- confianza;
- volatilidad;
- calibración;
- fuerza de pareja;
- margen;
- repetición de rivales;
- categorías argentinas;
- AJPP.

AJPP puede servir como dato auxiliar para jugadores fuertes, especialmente 4ª/3ª hacia arriba, pero no implementar todavía.

Mixtos:
- pueden guardarse en historial;
- hipótesis actual: no impactan ranking competitivo masculino/femenino;
- no quedó cerrado matemáticamente.

## Cuentas e identidad futura

### Datos de identidad
- nombre;
- apellido;
- nombre visible;
- @usuario;
- foto.

### Datos declarados
- fecha nacimiento;
- género;
- mano;
- lado;
- categoría.

### Datos calculados
- Nivel BRAMU;
- mejor nivel;
- ranking;
- partidos;
- victorias;
- efectividad;
- rachas;
- evolución.

Los datos calculados no son editables.

### Búsqueda de personas
- @usuario como identificador inequívoco;
- permitir también búsqueda por nombre real/visible;
- mostrar foto/avatar y @usuario para desambiguar.

## Jugadores sin cuenta y partidos compartidos

Problema futuro clave: un jugador temporal no puede vincularse automáticamente a una nueva cuenta solo por coincidir el nombre.

Ideas futuras:
- reclamar participación histórica;
- confirmar identidad;
- validación por otros jugadores;
- vincular partidos antiguos.

Separación conceptual:
1. partido registrado;
2. partido confirmado;
3. partido computable para ranking.

## Backend e infraestructura

Piloto inicial:
- ~8–10 amigos;
- 2–3 meses;
- web app/PWA;
- costo cero como requisito excluyente;
- sin App Store/Google Play por ahora.

Supabase/Vercel se discutieron como candidatos, pero NO son decisión técnica definitiva.

No usar SMS si genera costos.

Modelo conceptual futuro:
- Usuario;
- Perfil deportivo;
- Partido;
- Participante;
- Jugador sin cuenta;
- Relación/amistad;
- Nivel;
- Historial de nivel;
- Ranking.

## Flujo de trabajo acordado

- ChatGPT: producto, UX, decisiones, capturas, consolidados e instrucciones.
- ChatGPT Work: investigaciones profundas, especialmente Ranking/Playtomic.
- Claude Code: implementación, tests, repo, publicación y documentación.

Regla: **definir producto → consolidar → implementar**.

## Hitos y documentos importantes

### V02
- `BRAMUlab_V02.8_Auditoria_Visual_CSS.md`
- `BRAMUlab_V02.8_Consolidado.md`
- `BRAMUlab_V02.8_Informe.md`
- `BRAMUlab_V02.8.1_Informe.md`
- `BRAMUlab_V02.9_Consolidado.md`
- `BRAMUlab_V02.9_Informe.md`
- `BRAMUlab_V02.9.1_Informe.md`

### V03
- `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Consolidado.md`

Cuando exista `BRAMUlab_V03.0_Informe.md`, debe pasar a ser referencia primaria del estado implementado de V03.0.

## Problemas detectados y resolución

- Registro punto por punto demasiado demandante → explorar modos por games y eventualmente sets.
- Efectividad borrosa/pesada → stroke limpio, sin blur.
- Animaciones invisibles → keyframes/transform y easing específico.
- Historial inconsistente → mismo lenguaje que Último partido.
- Borrado demasiado accesible → mover a Resumen.
- Jugador sin cuenta demasiado protagonista → integrar como fila contextual.

## Pendientes abiertos

- Fórmula real de Nivel/Ranking BRAMU.
- Investigación profunda de Playtomic.
- Backend real gratuito.
- Auth real.
- Validación multiusuario.
- Reclamo/vinculación de jugadores sin cuenta.
- Perfil público vs privado.
- Player Card pública.
- Autotest de categoría.
- Mixtos en ranking.
- Mejorar BRAMU Intelligence de partido y perfil.
- Auditoría futura de comentarios del código.

## OBSOLETAS / reemplazadas

- **OBSOLETO:** categoría declarada = Nivel BRAMU definitivo.
- **OBSOLETO:** mostrar nivel numérico inmediatamente al registrarse.
- **OBSOLETO:** usar @usuario como nombre visible en partidos.
- **OBSOLETO:** Historial con lenguaje distinto a Último partido.
- **OBSOLETO:** `PARTIDO CARGADO` como metadata principal.
- **OBSOLETO:** `POR GAMES` como metadata protagonista de cards.
- **OBSOLETO:** X de borrado en Historial.
- **OBSOLETO:** colorear ganador o pareja propia en nombres del Historial.
- **OBSOLETO:** CTA grande para jugador sin cuenta.
- **OBSOLETO:** glow/blur fuerte en Efectividad.
- **OBSOLETO:** modularizar CSS solo por tamaño/tokens.
- **OBSOLETO:** diseñar backend antes de cerrar datos y relaciones.

## Regla de uso del backup

Este archivo es respaldo de contexto, no especificación ejecutable. Si contradice un consolidado posterior, informe posterior o comportamiento validado más nuevo, priorizar siempre la fuente más reciente y explícita.
