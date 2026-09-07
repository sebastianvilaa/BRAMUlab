# BRAMUlab V03.0 — Consolidado de implementación

## Nueva etapa

**Versión objetivo:** BRAMUlab V03.0

Esta versión abre una nueva etapa de producto: pasar desde un jugador local simple hacia una experiencia completa de identidad de jugador.

## Alcance general

- NO conectar backend real todavía.
- NO usar Supabase/Firebase todavía.
- NO implementar ranking definitivo.
- NO implementar amistades, validaciones entre usuarios ni multiusuario real.
- Todo este flujo puede persistir localmente como prototipo.
- El objetivo es diseñar, implementar y probar acceso + creación de jugador + perfil antes de conectar infraestructura real.

---

# 1. PANTALLA INICIAL — ACCESO

## REEMPLAZAR

Reemplazar la entrada actual simplificada por una pantalla con:

- INICIAR SESIÓN
- CREAR CUENTA

Mantener lenguaje visual BRAMU:
- fondo oscuro / degradé actual;
- logo BRAMU;
- alto contraste;
- estética deportiva y moderna;
- evitar apariencia de formulario web genérico.

No implementar autenticación real todavía.

---

# 2. CREAR CUENTA — 3 PASOS

Mostrar progreso visual de 3 pasos, idealmente con pequeños indicadores/pelotas BRAMU.

## PASO 1 — CREAR ACCESO

Campos:
- Email
- Contraseña
- Repetir contraseña

Validaciones:
- email válido;
- email no duplicado localmente;
- contraseña con mayúscula, minúscula, número, símbolo y longitud mínima razonable;
- repetir contraseña debe coincidir.

No usar teléfono/SMS.

Botón: **CONTINUAR**

## PASO 2 — TU IDENTIDAD

Campos:
- Foto de perfil opcional
- Nombre
- Apellido
- @usuario
- Nombre visible

### Foto
- avatar circular;
- sin foto: usar iniciales;
- lapicito/botón de edición;
- permitir elegir imagen del dispositivo;
- abrir cámara si navegador/dispositivo lo permite;
- puede omitirse y agregarse después.

### @usuario
- único dentro de usuarios locales;
- feedback inmediato: Disponible / Ya está en uso;
- sugerir variantes basadas en nombre/apellido solo si no complica la ronda.

Separar claramente:
1. Nombre real: Sebastián Vila
2. Nombre visible: Seba
3. Usuario único: @sebavilaa

Uso futuro:
- nombre visible en partidos, rankings y grupos;
- @usuario para identificar/buscar inequívocamente;
- nombre real como dato de identidad.

No usar el @usuario como nombre visible en partidos.

Botón: **CONTINUAR**

## PASO 3 — TU PÁDEL

Campos:
- Fecha de nacimiento
- Género
- Mano hábil
- Lado habitual
- Categoría actual

Fecha de nacimiento:
- pedir fecha;
- calcular edad automáticamente.

Mano hábil:
- Derecha
- Izquierda

Lado habitual:
- Drive
- Revés
- Indiferente / Ambos

Categoría actual:
- 1ª
- 2ª
- 3ª
- 4ª
- 5ª
- 6ª
- 7ª
- 8ª
- 9ª
- No sé mi categoría

La categoría declarada NO es el Nivel BRAMU. Solo será una semilla futura para calibración.

Si selecciona “No sé mi categoría”:
- guardar ese estado;
- NO desarrollar autotest;
- texto auxiliar posible: “Más adelante BRAMU podrá ayudarte a estimarla.”

Botón final: **CREAR MI JUGADOR**

---

# 3. CUENTA CREADA — MOMENTO DE RECOMPENSA

No mostrar un alert genérico.

Crear pantalla:
**TU JUGADOR ESTÁ LISTO**

Mostrar una **PLAYER CARD BRAMU** inspirada en el lenguaje visual de tarjetas de presentación de jugadores de Premier Padel/FIP:
- sensación de ficha deportiva;
- nombre protagonista;
- datos estructurados;
- estética aspiracional;
- sin copiar logos ni identidad de terceros.

Información:
- Foto/avatar
- Nombre visible
- @usuario
- Edad
- Mano hábil
- Lado habitual
- Categoría declarada

Nivel:
**NIVEL BRAMU**
**CALIBRANDO**
**0 / 5 PARTIDOS**

Texto:
“Completá 5 partidos para conocer tu Nivel BRAMU.”

No calcular todavía un nivel real.

CTA:
**ENTRAR A BRAMU**

Debe llevar al Home.

---

# 4. HOME — CALIBRACIÓN

Para jugadores nuevos con menos de 5 partidos:

REEMPLAZAR temporalmente el número de Nivel BRAMU por:
- CALIBRANDO
- X / 5 PARTIDOS
o
- Te faltan X partidos

En V03.0 usar cantidad de partidos propios registrados como indicador UX.

Al llegar a 5:
- NO inventar nivel real;
- puede mostrar “CALIBRACIÓN COMPLETA”;
- dejar preparada la lógica para reemplazarla luego por el sistema real.

No romper niveles ni datos existentes de usuarios de prueba.

---

# 5. PERFIL — IDENTIDAD DEL JUGADOR

Actualizar Perfil para mostrar y editar:
- foto/avatar;
- nombre visible;
- @usuario;
- nombre y apellido;
- fecha de nacimiento / edad;
- género;
- mano hábil;
- lado habitual;
- categoría declarada.

Foto:
- agregar;
- reemplazar;
- eliminar;
- al eliminar, volver a iniciales.

@usuario:
- editable localmente si sigue siendo único.

NO permitir editar manualmente datos calculados futuros:
- Nivel BRAMU;
- mejor nivel;
- ranking;
- partidos;
- victorias;
- efectividad.

---

# 6. INICIAR SESIÓN — PROTOTIPO LOCAL

Campos:
- Email
- Contraseña

Acciones:
- INICIAR SESIÓN
- volver

No implementar todavía recuperación real de contraseña.

Si credenciales coinciden con usuario local:
- establecer jugador actual;
- ir al Home.

Si no:
- error claro.

Cerrar sesión desde Perfil:
- NO borrar usuario;
- NO borrar partidos;
- solo cerrar sesión actual.

---

# 7. MODELO LOCAL DE DATOS

Auditar primero el modelo actual.

Separar conceptualmente:
- cuenta;
- perfil;
- jugador actual;
- partidos.

Estructura mínima esperada:

User:
- id estable
- email
- password local SOLO como prototipo
- username único
- firstName
- lastName
- displayName
- birthDate
- gender
- dominantHand
- preferredSide
- declaredCategory
- profilePhoto / referencia local
- createdAt

## Seguridad / arquitectura

Esto es solo prototipo local.

Documentar explícitamente:
- las contraseñas NO pueden almacenarse así en producción;
- el sistema será reemplazado por Auth real;
- no construir criptografía casera.

---

# 8. COMPATIBILIDAD CON ESTADO ACTUAL

Actualmente BRAMU usa `currentPlayerName` y tiene datos ya cargados.

NO destruirlos.

Antes de modificar storage:
- auditar claves;
- documentar migración;
- mantener compatibilidad con partidos existentes;
- evitar pérdida de historial.

Elegir la solución más simple y segura:
- migración local;
- perfil inicial;
- o fallback compatible.

---

# 9. JUGADORES SIN CUENTA

MANTENER el sistema actual “Agregar a X”.

No implementar todavía:
- reclamar perfiles;
- vincular históricos;
- confirmar identidad;
- crear usuarios automáticamente.

---

# 10. DISEÑO

Mantener:
- fondo oscuro;
- verde BRAMU #95FF19;
- azul #199FFF;
- texto principal #F8FAFC;
- Inter;
- alto contraste;
- cards modernas;
- estética deportiva.

La sensación debe ser:
“Estoy creando mi jugador”

No:
“Estoy completando un formulario administrativo”.

---

# 11. FUERA DE ALCANCE V03.0

NO implementar:
- Supabase;
- Firebase;
- backend;
- API;
- hosting nuevo;
- SMS;
- Google/Apple login;
- recuperación real de contraseña;
- email verification;
- amigos;
- grupos privados;
- búsqueda online;
- partidos compartidos;
- confirmación entre participantes;
- privacidad pública/privada;
- ranking BRAMU real;
- fórmula de nivel;
- AJPP;
- ranking masculino/femenino;
- mixtos;
- autotest de categoría;
- Player Intelligence nuevo;
- rediseños no necesarios de Home/Historial.

---

# 12. TESTS Y VALIDACIÓN

Agregar tests razonables para:
- creación de usuario local;
- username único;
- email duplicado;
- login correcto;
- login incorrecto;
- logout sin borrar datos;
- persistencia;
- edición de perfil;
- cálculo de edad;
- calibración 0/5 → 5/5;
- migración/compatibilidad.

Validar manualmente mobile y desktop:
A. primer acceso;
B. crear cuenta;
C. omitir foto;
D. cargar foto;
E. username ocupado;
F. completar perfil;
G. ver Player Card;
H. entrar al Home;
I. cerrar sesión;
J. iniciar sesión;
K. editar perfil;
L. comprobar que partidos previos no se pierdan.

---

# 13. ORDEN DE TRABAJO

Antes de implementar:
1. Leer el estado actual completo del sistema de identidad/player.
2. Auditar storage y dependencias.
3. Proponer plan breve.
4. Identificar riesgos de migración.
5. Implementar por etapas.
6. Ejecutar tests.
7. Probar recorrido completo.
8. Publicar.

No rehacer componentes estables sin razón concreta.

---

# 14. ENTREGA

Publicar como:
**BRAMUlab V03.0**

Actualizar:
- Store.VERSION
- version.json
- service worker/cache
- referencias necesarias.

Generar:
`BRAMUlab_V03.0_Informe.md`

El informe debe incluir:
- arquitectura local;
- cambios de storage;
- migración;
- flujo implementado;
- campos;
- Player Card;
- login/logout;
- edición;
- tests;
- validación mobile/desktop;
- hashes;
- tag;
- deploy;
- diferencias justificadas respecto de este consolidado.

---

# CRITERIO PRINCIPAL

V03.0 no busca resolver todavía las cuentas reales.

Busca construir y validar la experiencia completa de identidad del jugador antes de conectar infraestructura.

La sensación final debe ser:

**“Ya tengo mi jugador dentro de BRAMU.”**

No avanzar con backend ni ranking matemático hasta cerrar bien esta experiencia.
