# BRAMUlab V03.0.3.2 — Recuperación desde sesión + tabs de modo

## Objetivo
Parche corto sobre V03.0.3.1 con solo dos objetivos:
1. Permitir recuperar/cambiar contraseña estando logueado aunque no se recuerde la contraseña actual.
2. Refinar visualmente `PUNTO A PUNTO | POR GAMES` para que se lean como tabs/solapas y no como botones grandes.

No rediseñar ninguna otra pantalla.

## 1. AGREGAR — ¿No recordás tu contraseña?
En `CAMBIAR CONTRASEÑA`, mantener el flujo actual con:
- Contraseña actual
- Nueva contraseña
- Repetir nueva contraseña
- Guardar

Debajo de `Contraseña actual`, AGREGAR una acción secundaria:
**¿No recordás tu contraseña?**

Debe ser discreta y consistente con BRAMU.

## 2. REUTILIZAR — recuperación existente sin pedir email
Si el usuario ya está logueado:
- NO pedir email;
- usar la cuenta / `userId` activo;
- reutilizar el flujo V03.0.3.1 empezando en el código.

Flujo:
1. `INGRESÁ EL CÓDIGO`
2. Código local válido: `123456`
3. Código incorrecto: `Código incorrecto.`
4. Código correcto → `NUEVA CONTRASEÑA`
5. Nueva contraseña + repetir
6. Guardar

Reutilizar eye/eye-off, reglas de fuerza y validaciones existentes.

## 3. REGLA CRÍTICA — conservar la misma cuenta
Al guardar, NO cambiar:
- `userId`
- email
- username
- displayName
- nombre/apellido
- foto
- partidos
- historial
- Nivel BRAMU
- notificaciones
- datos deportivos

Solo reemplazar la contraseña local.

Después:
- toast `Contraseña actualizada`
- volver a `MIS DATOS` o a `CAMBIAR CONTRASEÑA` limpio.
- no obligar a login de nuevo si la sesión sigue válida.

Deben convivir:
- Camino A: contraseña actual → nueva → guardar.
- Camino B: no la recuerda → `123456` → nueva → guardar.

## 4. REEMPLAZAR VISUALMENTE — tabs de modo
La lógica actual funciona. Mantener:
- mismos valores;
- misma persistencia;
- misma lógica;
- mismo cambio entre modos.

Cambiar solo presentación.

Tomar como referencia el patrón ya usado en `MI PERFIL | MIS DATOS` y tabs equivalentes de Historial.

Las tabs deben:
- ser más bajas y horizontales;
- integrarse al ancho;
- no parecer CTAs;
- activa en verde/lima;
- inactiva gris;
- usar underline o estado activo equivalente;
- ubicarse debajo del header BRAMU y antes de Equipo A.

No usar:
- dos cards grandes;
- glow de CTA;
- apariencia de botón primario.

No rediseñar:
- Equipo A/B;
- Formato de partido;
- Sistema de puntuación.

La lectura debe ser: `estoy eligiendo un modo`, no `estoy ejecutando una acción`.

Si la pantalla se usa con y sin sesión, compartir el mismo patrón visual.

## 5. NO TOCAR
No modificar:
- Home;
- MI PERFIL;
- MIS DATOS salvo el acceso a recuperación desde Cambiar contraseña;
- Historial;
- Ranking;
- Notificaciones;
- Evolución BRAMU;
- fórmula Nivel BRAMU;
- Player Intelligence;
- lógica de partidos;
- backend;
- social.

## 6. TESTS
Agregar tests focalizados:
1. usuario logueado puede entrar a recuperación sin contraseña actual;
2. usa la cuenta activa;
3. `123456` valida;
4. otro código bloquea;
5. nueva contraseña reemplaza la anterior;
6. `userId` se conserva;
7. perfil/historial/foto/notificaciones se conservan;
8. sesión sigue válida si corresponde;
9. Punto a punto / Por games sigue persistiendo;
10. cambio visual no altera lógica.

Suite completa una sola vez al cierre.

## 7. QA manual mobile + desktop
1. Cambio normal con contraseña actual sigue funcionando.
2. `¿No recordás tu contraseña?` aparece y es secundario.
3. No pide email.
4. Código incorrecto da error.
5. `123456` avanza.
6. Nueva contraseña guarda.
7. Misma cuenta conserva datos.
8. Sesión no se rompe innecesariamente.
9. Tabs se ven como solapas.
10. Activa se entiende.
11. Inactiva no parece CTA.
12. Cambiar tab cambia realmente el modo.
13. Setup general no cambia.
14. Invitado comparte patrón si usa la misma pantalla.
15. Home/Perfil/Historial/Notificaciones sin regresiones.
16. Suite completa verde.

## 8. Forma de trabajo con Claude
Este consolidado está cerrado.

Claude debe:
1. leer completo;
2. auditar brevemente;
3. implementar directamente;
4. no presentar plan;
5. usar tests focalizados;
6. suite completa al final;
7. validar mobile + desktop;
8. corregir dentro del alcance;
9. generar informe;
10. commit;
11. tag;
12. push;
13. deploy.

Solo detenerse por riesgo real de pérdida de datos, contradicción de producto, acción destructiva no prevista o necesidad real de salir del alcance.

## 9. Versionado
Publicar como:
**BRAMUlab V03.0.3.2**

Actualizar:
- `APP_VERSION`
- `version.json`
- service worker/cache
- referencias necesarias

Generar:
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.2_Informe.md`

El informe debe incluir:
- recuperación desde sesión;
- código `123456`;
- preservación de cuenta y `userId`;
- comportamiento de sesión;
- nuevas tabs visuales;
- tests;
- QA;
- hashes;
- tag;
- deploy;
- diferencias justificadas.

# Criterio de éxito
V03.0.3.2 queda cerrada si:
- un usuario logueado puede cambiar contraseña aunque no recuerde la actual;
- no se vuelve a pedir email si la sesión ya identifica la cuenta;
- la misma cuenta conserva todos sus datos;
- `PUNTO A PUNTO | POR GAMES` se entienden como modos;
- no se rediseña nada fuera de alcance;
- no aparecen regresiones.
