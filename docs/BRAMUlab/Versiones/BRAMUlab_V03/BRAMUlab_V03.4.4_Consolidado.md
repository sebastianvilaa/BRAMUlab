# BRAMUlab V03.4.4 — Microparche final sobre V03.4.3

Pedido directamente en chat (sin archivo adjunto) — transcripto acá tal cual para dejar
registro del alcance de esta ronda, mismo criterio que el resto de `Versiones/`.

Microparche final sobre V03.4.3.

No tocar lógica de grupos, puntos, tabs, Intelligence, ubicación ni comportamiento general.
Solo resolver estos ajustes visuales puntuales.

## 1. MIS GRUPOS — acción `+ CREAR GRUPO`

En el selector / bottom sheet de grupos, hoy `+ CREAR GRUPO` queda demasiado perdido como texto
simple.

REEMPLAZAR por un botón de jerarquía terciaria/outline, reutilizando el mismo lenguaje visual de
acciones como:
- `EDITAR PARTIDO`
- `CERRAR SESIÓN`

Pero en este caso con acento VERDE.

Dirección visual:
- borde verde;
- texto verde;
- fondo muy sutil / lavado;
- mismo alto, padding, radio, tipografía, peso y tracking que ese sistema de botones;
- no convertirlo en CTA primario lima sólido.

Debe verse como una acción clara, pero secundaria respecto del grupo seleccionado.

## 2. MIS GRUPOS — información de cada grupo

En la lista de grupos del selector, agregar cantidad de jugadores como segunda lectura.

Formato recomendado:

`Jueves De Padel · 6 jugadores`

Jerarquía:
- nombre del grupo: color/texto principal;
- separador `·`;
- cantidad de jugadores: color secundario/lavado, usando el token equivalente al `Paper Dim` o
  el color secundario real ya existente en el sistema.

No mostrar nombres de todos los miembros.

Cuidar singular/plural:
- `1 jugador`
- `6 jugadores`

El check del grupo activo se mantiene.

## 3. SPLASH — composición

La pantalla splash actual dejó el logo demasiado arriba.

AJUSTAR la composición:
- recentrar verticalmente el branding;
- dar más protagonismo al wordmark;
- usar `BRAMUlab` más grande;
- quitar el ISO/icono de app del splash si actualmente aparece separado del wordmark.

La intención es:
- una sola marca protagonista;
- más limpia;
- centrada;
- sin duplicar ISO + wordmark.

No tocar la pantalla de acceso/login con este cambio.

## 4. ÍCONO DE LA APP

Revisar el icono de app actual.

Problema:
- todavía conserva un fondo/tono verde que ya no está alineado con la identidad visual actual.

AJUSTAR para que use el sistema vigente:
- fondo azul noche / oscuro;
- B / iso en verde lima;
- conservar la personalidad del icono ya definido;
- evitar fondo verde dominante;
- evitar inventar una marca nueva.

Tomar como referencia el lenguaje visual actual de BRAMUlab:
- azul noche;
- lima;
- alto contraste;
- limpio.

Actualizar los assets necesarios para que el nuevo icono se refleje correctamente donde
corresponda.

## 5. NO TOCAR

No modificar:
- tabla de grupos;
- posiciones;
- puntos;
- Race anual;
- admins;
- BRAMU Intelligence;
- tabs;
- GeoRef;
- Perfil;
- Historial;
- Home;
- Ranking BRAMU oficial;
- backend.

## 6. QA

QA visual mobile:
- selector con 1 y 2+ grupos;
- botón `CREAR GRUPO`;
- singular/plural de cantidad de jugadores;
- splash;
- icono de app.

Chequeo rápido desktop.

Sin tests nuevos salvo que se toque lógica accidentalmente.
Suite completa una sola vez al cierre.

Implementar directamente.
Informe, commit, tag, push y deploy.
