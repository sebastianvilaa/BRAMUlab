# BRAMUlab V03.0.3.1 — Recuperación simulada de contraseña + ajustes menores

## Objetivo

Parche corto sobre V03.0.3.

No rediseñar Home, Historial, Ranking, Perfil ni flujo invitado. Resolver únicamente:
- recuperación simulada de contraseña;
- limpieza del Nivel BRAMU en MI PERFIL;
- eliminación de controles redundantes de foto;
- eliminación de la etiqueta visual “SIMULADO”.

---

## 1. AGREGAR — “¿Olvidaste tu contraseña?” en Login

En **INICIAR SESIÓN**, agregar una acción secundaria:

**¿Olvidaste tu contraseña?**

Debe verse integrada al lenguaje BRAMU y no competir con el CTA principal.

---

## 2. AGREGAR — flujo simulado de recuperación

### Paso 1 — Email

Pantalla:
**RECUPERAR CONTRASEÑA**

Campo:
- Email

CTA:
**ENVIAR CÓDIGO**

Validación:
- email inexistente → **“No encontramos una cuenta con ese email.”**
- email existente → avanzar.

No modificar email ni crear otra cuenta.

### Paso 2 — Código

Pantalla:
**INGRESÁ EL CÓDIGO**

Texto:
**“Ingresá el código de 6 dígitos que enviamos a tu email.”**

Código fijo válido en esta versión:
**123456**

- `123456` → avanzar.
- cualquier otro → **“Código incorrecto.”**

Sí validar el código.

No enviar email real.

### IMPORTANTE
No mostrar en UI:
- “Simulado”
- “Código de prueba”
- “Demo”
- avisos de que no se envía email real.

La simulación queda en la lógica, no en la interfaz.

### Paso 3 — Nueva contraseña

Pantalla:
**NUEVA CONTRASEÑA**

Campos:
- Nueva contraseña
- Repetir contraseña

Usar el eye / eye-off existente.

CTA:
**GUARDAR CONTRASEÑA**

---

## 3. REGLA CRÍTICA — conservar la misma cuenta

Al guardar la nueva contraseña:

NO cambiar:
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

Solo reemplazar la contraseña local de esa cuenta.

Luego:
- toast **“Contraseña actualizada”**
- volver a Login con el email precompletado.

La contraseña vieja debe dejar de funcionar.
La nueva debe permitir login.

---

## 4. REEMPLAZAR — Nivel BRAMU en MI PERFIL

En la cabecera/ficha de **MI PERFIL** mostrar solamente el **Nivel BRAMU actual**.

Ejemplo:
**6.5**

Quitar de esa cabecera:
- `+1.5`
- última subida;
- variación reciente.

No borrar la lógica ni el dato; solo dejar de mostrarlo en MI PERFIL.

La variación puede seguir existiendo en Home/evolución donde tenga sentido.

---

## 5. QUITAR — “Quitar foto”

Eliminar el link/texto **“Quitar foto”** en:
- MI PERFIL
- MIS DATOS

Mantener:
- foto tappable;
- icono cámara/lápiz;
- reemplazar foto.

No agregar otro control de eliminación en esta ronda.

---

## 6. QUITAR — etiqueta “SIMULADO”

Eliminar cualquier etiqueta visible **SIMULADO** en la experiencia actual, especialmente si aparece en:
- Nivel BRAMU;
- Ranking;
- Perfil;
- evolución;
- métricas locales.

No cambiar la lógica subyacente.
No convertir datos simulados en reales.

Solo retirar la palabra visible.

Comentarios técnicos/documentación interna pueden permanecer.

---

## 7. Historial / Ranking / Evolución

### Historial
No tocar. Fue revisado y no requiere ajustes ahora.

### Ranking
No crear ranking real ni inventar valores.

Solo quitar “SIMULADO” si está visible.

### Evolución BRAMU
No hacer más cambios del gráfico en esta ronda.
Se revisará después con más calma.

---

## 8. NO TOCAR

No modificar:
- Home salvo dependencia mínima del ajuste de Perfil;
- Historial;
- flujo invitado;
- tabs Punto a punto / Por games;
- Notificaciones;
- fórmula Nivel BRAMU;
- partidos;
- backend;
- social;
- Player Intelligence.

---

## 9. TESTS

Agregar tests focalizados para recuperación:

1. email existente permite avanzar;
2. email inexistente bloquea;
3. `123456` valida;
4. otro código no valida;
5. nueva contraseña reemplaza la anterior;
6. vieja deja de funcionar;
7. nueva permite login;
8. `userId` se conserva;
9. perfil/foto/partidos/notificaciones se conservan;
10. otra cuenta local no se modifica.

QA visual:
- MI PERFIL sin `+X`;
- no aparece “Quitar foto”;
- editar foto sigue funcionando;
- no aparece “SIMULADO”.

Suite completa una sola vez al cierre.

---

## 10. QA manual mobile + desktop

1. Login muestra “¿Olvidaste tu contraseña?”.
2. Email válido → código.
3. Email inválido → error.
4. Código incorrecto → error.
5. `123456` → Nueva contraseña.
6. Eye icon funciona.
7. Guardar funciona.
8. Login con clave vieja falla.
9. Login con clave nueva funciona.
10. La cuenta conserva todos los datos.
11. MI PERFIL muestra solo Nivel BRAMU actual.
12. No aparece “Quitar foto”.
13. Tocar foto sigue permitiendo cambiarla.
14. No aparece “SIMULADO”.
15. Home/Historial/Notificaciones sin regresiones.
16. Suite completa verde.

---

## 11. Forma de trabajo con Claude

Este consolidado se considera cerrado.

Claude debe:
1. leer completo;
2. auditar brevemente;
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
- contradicción de producto;
- acción destructiva no prevista;
- necesidad real de salir del alcance.

---

## 12. Versionado

Publicar como:

**BRAMUlab V03.0.3.1**

Actualizar:
- `APP_VERSION`;
- `version.json`;
- service worker/cache;
- referencias necesarias.

Generar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.1_Informe.md`

El informe debe incluir:
- flujo “Olvidé mi contraseña”;
- código fijo `123456`;
- preservación de `userId` y datos;
- ajuste Nivel BRAMU en MI PERFIL;
- eliminación “Quitar foto”;
- eliminación “SIMULADO”;
- tests;
- QA;
- hashes;
- tag;
- deploy;
- diferencias justificadas.

---

# Criterio de éxito

V03.0.3.1 queda cerrada si:
- el usuario puede recuperar acceso sin conocer la contraseña actual;
- `123456` funciona como token fijo local;
- se conserva exactamente la misma cuenta;
- MI PERFIL muestra un Nivel BRAMU más limpio;
- la edición de foto queda sin controles redundantes;
- desaparece “SIMULADO” de la UI;
- no hay cambios fuera de alcance.
