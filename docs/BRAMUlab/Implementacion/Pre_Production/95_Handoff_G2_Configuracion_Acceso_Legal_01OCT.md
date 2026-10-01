# 95 — Handoff G2: Configuración, Acceso/Legal y QA browser

**Fecha:** 01/10/2026  
**Entorno:** exclusivamente `staging`  
**Estado UX:** **CERRADO PARA IMPLEMENTAR Y PROBAR**  
**No tocar:** `main`, Production, BRAMUlive, copy/diseño de emails V1.

## 0. Entrada

Leer en orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Pre_Production.md`
4. `docs/BRAMUlab/Privacidad_Legal.md`
5. `docs/BRAMUlab/Experiencia_Inicial.md`
6. `docs/BRAMUlab/Implementacion/Pre_Production/94_Gate_Central_G1_Final_01OCT.md`
7. este handoff.

No leer Archivo/Backup salvo trazabilidad concreta.

## 1. Problema de UX observado

En `Perfil → Mis datos`, las tarjetas actuales mezclan:
- datos del jugador;
- acceso/seguridad;
- legal/privacidad;
- acciones sensibles;
- logout.

Esto hace que `Mis datos` parezca un panel administrativo y deja acciones delicadas demasiado expuestas a un toque.

Además:
- las filas son demasiado altas y el contenido no se percibe bien centrado;
- cambio de email/eliminación disparan un email apenas se toca la fila;
- solicitar copia/contacto saltan directo a mail;
- Términos/Privacidad se abren fuera del shell y el usuario pierde una vuelta clara;
- la reaceptación legal se percibe comprimida arriba con mala jerarquía/espaciado;
- el isotipo/icono instalado de la app sigue sin verse correctamente en iOS incluso tras borrar/reinstalar;
- Supabase Auth hosted conserva `Site URL = http://localhost:3000`; debe corregirse en G2, no en G1.

## 2. Decisión de arquitectura UX

### 2.1 `Mis datos` vuelve a ser datos de jugador

**REEMPLAZAR** la mezcla actual.

`Perfil → Mis datos` debe concentrarse en información personal/deportiva editable ya existente:
- nombre/apellido;
- fecha de nacimiento/edad derivada cuando corresponda;
- género opcional;
- mano dominante;
- lado habitual;
- categoría;
- localidad;
- teléfono/WhatsApp y consentimiento;
- avatar/foto y demás datos de perfil ya definidos.

**SACAR de Mis datos:**
- bloque `Acceso y seguridad`;
- bloque `Legal y privacidad`;
- botón grande `Cerrar sesión`.

No alterar contratos server-backed ya cerrados de Perfil.

### 2.2 Acceso a Configuración

**AGREGAR** en el área Perfil, arriba a la derecha, un icono discreto de **engranaje / configuración**.

Preferencia cerrada: engranaje, no ícono `i`, porque incluye acciones y no solo información.

Debe sentirse consistente con los accesos pequeños usados en otras áreas de BRAMU. No convertirlo en CTA protagonista.

Al tocar:
`Perfil → Configuración`

Debe existir back claro a Perfil.

## 3. Pantalla Configuración

No replicar tarjetas enormes. Usar lista compacta, filas centradas verticalmente, chevrons consistentes, divisores uniformes y altura menor que la implementación actual.

Orden conceptual:

### CUENTA Y SEGURIDAD
- **Email** — mostrar el email actual como dato secundario; chevron.
- **Cambiar contraseña** — chevron.

No mostrar `Cerrar todas las sesiones` como fila permanente.

### PRIVACIDAD Y DATOS
- **Solicitar copia de mis datos** — chevron.

### LEGAL
- **Términos y Condiciones** — chevron.
- **Política de Privacidad** — chevron.

### AYUDA
- **Contacto** — chevron.

### SESIÓN
Al final, separado visualmente:
- **Cerrar sesión**

Al tocar `Cerrar sesión`, abrir un modal/sheet con:
1. `Cerrar sesión`
2. `Cerrar todas las sesiones`
3. `Cancelar`

No disparar el cierre al tocar la fila sin confirmación.

### ZONA DE CUENTA / DESTRUCTIVA
Más abajo y aislado:
- **Eliminar mi cuenta** en rojo/danger.

No mezclarla visualmente con acciones ordinarias.

## 4. Email — pantalla intermedia obligatoria

Tocar `Email` NO envía Email #3.

Abrir una pantalla interna:
- título: `Email`;
- email actual visible;
- explicación breve de la secuencia ya aprobada: para cambiarlo BRAMU verifica primero el email actual y luego el nuevo;
- CTA `Cambiar email`.

**Solo al tocar ese CTA** comienza el flujo G1 y se manda Email #3.

Después conservar exactamente el flujo G1 ya cerrado:
#3 actual → verificar → ingresar nuevo → #4 nuevo → verificar → cambio real → #5 anterior.

No agregar un tercer desafío, link principal ni recovery copy.

## 5. Eliminar cuenta — pantalla intermedia obligatoria

Tocar `Eliminar mi cuenta` NO envía Email #7.

Abrir pantalla interna de contexto previo:
- explicar que la acción es definitiva;
- cuenta/datos personales activos se eliminan o anonimizan;
- partidos compartidos permanecen para terceros;
- identidad histórica pasa a `Jugador eliminado`;
- reingreso crea identidad nueva.

CTA deliberado:
`Continuar con la eliminación`

**Solo ese CTA** inicia el challenge `delete_account` y manda Email #7.

Después conservar el flujo G1/P0.3 ya cerrado. No rehacer backend de eliminación.

## 6. Solicitar copia de mis datos

Tocar la fila NO abre Mail directamente.

Abrir pantalla interna informativa. Debe explicar por **categorías**, no mostrar datos concretos del usuario.

Contenido conceptual:
- datos de cuenta/identidad y perfil;
- actividad deportiva y partidos;
- Nivel/Ranking cuando corresponda;
- grupos/membresías;
- aceptaciones legales;
- datos operativos mínimos necesarios para seguridad/funcionamiento según lo documentado.

No inventar categorías que BRAMU no registra. Tomar `Privacidad_Legal.md` + implementación real como autoridad.

Al final:
`Solicitar copia`

Ese CTA puede continuar con el mecanismo operativo vigente (por ejemplo mail preparado al canal aprobado) si ese es el contrato actual. No construir autoservicio nuevo si no hace falta.

## 7. Contacto

Tocar `Contacto` NO abre Mail directamente.

Pantalla interna mínima:
- `bramulab@gmail.com`;
- explicación corta de que es el canal de soporte/privacidad;
- CTA `Enviar email`.

Recién el CTA abre el cliente de correo.

## 8. Términos y Política de Privacidad

**REEMPLAZAR** la navegación externa/sin salida clara.

Abrir ambos documentos dentro del shell de BRAMUlab:
- header visible con flecha `←`;
- título;
- documento scrolleable;
- volver retorna a Configuración;
- ocultar bottom nav mientras se está leyendo;
- conservar jerarquía/legibilidad de documento.

No alterar contenido legal aprobado salvo ajustes estrictamente necesarios de presentación.

## 9. Reaceptación legal

Reproducir el estado con fixture/cuenta sintética; no depender de que Sebastián tenga otra cuenta pendiente.

Problema reportado:
- contenido demasiado pegado arriba;
- jerarquía débil;
- CTA demasiado cerca del bloque;
- gran vacío inferior en teléfono y desktop.

**FUSIONAR solo layout/jerarquía**, sin cambiar obligación ni copy legal:
- más aire entre título, explicación, links/documentos y CTA;
- distribución vertical equilibrada en mobile y desktop;
- CTA asociado visualmente a la decisión, no pegado al texto;
- Términos/Privacidad claramente accionables;
- no estirar con espacios artificiales;
- respetar safe areas.

## 10. Icono/isotipo instalado — bug real

Sebastián reporta que el isotipo/icono de la app no aparece correctamente en iOS incluso después de borrar y reinstalar.

Investigar y corregir con evidencia:
- `manifest.webmanifest` / manifest vigente;
- `apple-touch-icon`;
- tamaños/referencias;
- MIME/rutas públicas;
- HTML head;
- service worker/cache;
- instalación PWA desde iOS.

Usar solo assets reales de BRAMU. No rediseñar icono ni marca.

Si el problema está en cache/versionado, resolverlo sin romper service worker ni separación de entornos.

## 11. Site URL / redirects de Auth — Staging

Work observó:
- Site URL hosted = `http://localhost:3000`;
- redirect URLs vacíos.

G2 debe dejar esto correcto para Staging.

Reglas:
- identificar el origen real estable de BRAMUlab Staging;
- NO usar GitHub raw como Site URL;
- NO abrir públicamente Vercel Staging solo para resolver el logo;
- configurar Site URL/redirects coherentes con el origen de Staging y los flujos Auth reales;
- no tocar Production/main;
- documentar valor final y evidencia de callback/navegación.

Si la protección de Vercel impide un recorrido Auth que sí necesita navegador externo, resolver la mínima configuración de Preview/Staging sin degradar la protección general; si requiere una decisión humana real, marcarla, continuar el resto.

## 12. Qué NO cambia

- inventario/copy/diseño de los 8 emails V1;
- secuencia de cambio de email;
- backend de challenges;
- eliminación P0.3;
- datos legales;
- política de retención/reingreso;
- Nivel/Ranking/Intelligence;
- BRAMUlive.

## 13. Implementación

Preferencia:
- reutilizar shell/componentes/modales existentes;
- no crear un mini sistema de navegación paralelo;
- mantener look & feel BRAMU;
- reducir altura de filas;
- centrar texto/chevron verticalmente;
- no usar cards dentro de cards sin necesidad;
- no introducir dependencias.

Bundle siguiente esperado: `04.20-h5` salvo que el repo vigente obligue a otro número. Versión pública sigue `V04.20`.

## 14. Tests antes de Work

Cubrir como mínimo:
- Mis datos ya no contiene bloques de seguridad/legal/logout;
- engranaje abre Configuración y back retorna;
- filas sensibles no disparan Edge/mail al primer tap;
- CTA intermedio sí inicia flujo correspondiente;
- cambio de email conserva 2 verificaciones;
- delete conserva challenge específico;
- logout modal diferencia sesión actual vs todas;
- documentos legales retornan correctamente;
- bottom nav oculto al leer documentos;
- reaceptación legal conserva obligación y persistencia;
- no regresión Perfil/Mis datos server-backed;
- iconos/manifest/rutas existen;
- service worker/cache versionado correcto;
- no tocar main/Production/BRAMUlive.

## 15. QA posterior — Work

Después del gate Central, Work debe validar sobre Staging real:
- mobile + desktop;
- Perfil → Configuración;
- todos los backs;
- cambio email: primera pantalla no envía nada; CTA sí;
- eliminación: primera pantalla no envía nada; CTA sí;
- copia/contacto no saltan directo;
- legal in-app;
- reaceptación legal reproducida;
- Site URL/redirects;
- icono PWA en iOS si el entorno permite instalación real;
- Network/console solo donde el riesgo lo justifique.

No repetir QA exhaustiva de emails G1.

## 16. Salida

Guardar:
`docs/BRAMUlab/Implementacion/Pre_Production/96_Resultado_G2_Configuracion_Acceso_Legal_01OCT.md`

Debe incluir:
- cambios UI;
- cambios de navegación;
- fix icono;
- Site URL/redirects si pudo cerrarlos;
- tests;
- deploy Staging;
- residuales reales para Work;
- DECISIONES ABIERTAS solo si existen.

Una sola ronda funcional/commit/push en `staging`. Sin micro-rondas.
