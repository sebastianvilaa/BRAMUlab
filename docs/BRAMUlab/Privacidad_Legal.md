# BRAMUlab — Privacidad / Legal V1

**Estado:** decisiones humanas de producto CERRADAS · revisión legal profesional PENDIENTE · implementación/verificación técnica PENDIENTE  
**Fecha de consolidación:** 28/09/2026  
**Entorno de trabajo:** Staging hasta autorización explícita de Production.

Este documento es la **fuente maestra vigente** de Privacidad / Legal para BRAMUlab.

No reabrir decisiones de producto cerradas salvo que:
1. una revisión jurídica profesional determine que una obligación concreta exige un cambio; o
2. aparezca una nueva función del producto con impacto legal/privacidad.

Los datos identificatorios privados del responsable (por ejemplo domicilio completo, CUIT u otros datos personales) **no se copian a este repositorio público**. Existen en la fuente privada de trabajo y deben ser revisados por el profesional antes de decidir qué corresponde publicar en Términos/Privacidad o usar solo en trámites.

---

## 1. Alcance territorial V1

- BRAMUlab se lanza, comunica y opera inicialmente desde **Argentina**.
- V1 se diseña bajo normativa y jurisdicción argentina aplicable.
- **No hay geobloqueo:** una persona de otro país puede registrarse y usar el servicio.
- Durante V1 no habrá promoción deliberada, campañas segmentadas ni localización comercial dirigida a mercados extranjeros.
- La comunicación inicial será orgánica/informativa, principalmente mediante Instagram y enlaces de acceso.
- Antes de una expansión internacional deliberada deberá revisarse el impacto jurídico del mercado objetivo.

Esto no debe redactarse como una afirmación de cumplimiento global irrestricto.

---

## 2. Cuenta, acceso y soporte

### Acceso

- Login V1: email + contraseña.
- Recuperación: email + OTP.
- `@usuario` es identidad pública, no credencial de acceso V1.
- El email es privado frente a otros jugadores.

### Canal único V1

- Canal de soporte/privacidad: `bramulab@gmail.com`.
- No habrá sistema de tickets en V1.
- Puede existir acuse automático de recepción, pero las solicitudes reales que lo requieran deberán revisarse/responderse.

### Acceso / copia / rectificación

- Solicitudes de acceso o copia de datos: por email.
- Sin exportación autoservicio V1.
- La respuesta debe generarse con un formato estandarizado alimentado por datos reales de la cuenta.
- Rectificación ordinaria: desde Perfil.
- Casos no corregibles desde la app: por el mismo canal.

---

## 3. Eliminación de cuenta

Decisión V1:

- autoservicio;
- verificación de control del email por código;
- el correo explica consecuencias principales;
- ejecución solo después de ingresar correctamente el código;
- una vez ejecutada, es definitiva y sin período adicional de arrepentimiento;
- si la persona perdió acceso al email, debe recuperarlo por su cuenta;
- V1 no ofrece verificación manual alternativa.

Consecuencias:

- la inactividad **nunca** elimina una cuenta constituida;
- eliminar cuenta no borra partidos compartidos ni historia de terceros;
- la identidad visible histórica pasa a `Jugador eliminado`;
- datos personales activos se eliminan o anonimizan según corresponda;
- backups pueden conservar temporalmente datos durante su ciclo técnico normal, sin reuso ni reaparición en el servicio activo;
- reingreso V1 crea identidad nueva desde cero, sin relink, cooldown ni huella antifraude.

Los plazos reales de backups/logs deben documentarse desde infraestructura real y validarse jurídicamente; no inventarlos.

---

## 4. Alta abandonada

- OTP vigente: 60 minutos, con posibilidad de reenvío al vencer.
- Un alta que nunca verificó email ni terminó de constituirse se conserva durante 24 horas desde el inicio.
- Cumplidas 24 horas, el alta abandonada se elimina y su `@usuario` se libera.
- Si vuelve, inicia registro desde cero.
- Una cuenta verificada/constituida nunca se elimina por inactividad.

---

## 5. Cambio de email, contraseña y sesiones

### Email

- autoservicio;
- requiere acceso al email actual;
- verificación de identidad;
- confirmación del email nuevo;
- aviso al email anterior;
- sin vía manual alternativa V1 si perdió acceso al actual.

### Contraseña

- usuario autenticado puede cambiarla con nueva verificación de identidad;
- aviso por email;
- cierre de las demás sesiones.

### Sesiones

- cerrar sesión actual;
- cerrar todas las sesiones;
- recuperación de contraseña, cambio de email y eliminación deben revocar las demás sesiones;
- V1 no necesita listado avanzado de dispositivos/IP/ubicaciones.

---

## 6. Menores

**Decisión de producto cerrada, sujeta a revisión jurídica profesional obligatoria antes de Production:**

- BRAMUlab V1 no impone por decisión de producto una edad mínima específica;
- el registro previsto es el mismo para mayores y menores;
- se solicita fecha de nacimiento declarada;
- no se exige DNI;
- no se diseña por anticipado un email de adulto responsable, autorización parental separada ni verificación de parentesco/identidad.

### Regla de implementación

**NO implementar todavía un flujo parental o restricción por edad adicional** salvo que la revisión jurídica determine que es obligatoria.

La revisión profesional debe resolver especialmente:
- si este enfoque puede mantenerse bajo normativa argentina vigente;
- si existe una edad mínima jurídicamente necesaria;
- qué ajuste mínimo sería obligatorio;
- impacto en Apple App Store / Google Play si el servicio admite menores.

No presentar la decisión de producto como conclusión jurídica.

---

## 7. Consentimiento y documentos legales

En alta:

**Acepto los Términos y Condiciones y declaro haber leído la Política de Privacidad.**

- checkbox obligatorio único;
- Términos y Privacidad enlazados;
- registrar fecha, hora y versión aceptada;
- nueva aceptación solo ante cambios relevantes/materiales;
- no mezclar con marketing;
- no mezclar con participación en Ranking, que es automática.

Términos y Privacidad deben:
- ser públicos sin login;
- estar disponibles en registro y Configuración;
- mostrar versión y fecha de vigencia;
- mostrar el canal de contacto;
- tener redacción final revisada profesionalmente antes de Production.

Para futura publicación móvil, preparar además la URL pública de eliminación y los enlaces exigidos por tiendas.

---

## 8. Retención y anonimización

Principios cerrados:

- conservar únicamente lo necesario para finalidades reales del producto, seguridad y cumplimiento;
- preservar historial deportivo compartido sin mantener identidad personal visible cuando la cuenta fue eliminada;
- no reutilizar datos de backups;
- no inventar plazos.

Pendiente de revisión profesional:
- categorías de datos;
- fundamento y plazos;
- backups;
- logs;
- registros mínimos de seguridad/cumplimiento.

Desarrollo debe documentar el comportamiento real de infraestructura antes de cerrar la Política.

---

## 9. Nivel, Ranking e Intelligence

- Nivel BRAMU, Ranking BRAMU y BRAMU Intelligence son sistemas propios del producto.
- No representan clasificaciones oficiales de federaciones/asociaciones/circuitos profesionales.
- Dependen de los datos disponibles y no se promete exactitud absoluta.
- BRAMU puede corregir errores y modificar metodologías hacia adelante.
- Ediciones históricas publicadas se conservan como registro del momento y solo se corrigen retrospectivamente ante errores técnicos, datos falsos o fraude comprobado.

La redacción definitiva de estas aclaraciones/limitaciones requiere revisión jurídica profesional.

---

## 10. Contenido, marca y datos deportivos

Decisiones de producto:

- BRAMU conserva derechos sobre marca, identidad visual, aplicación, diseño, textos, metodologías, fórmulas y sistemas propios.
- El usuario conserva la propiedad de sus fotografías/contenido, otorgando la autorización operativa necesaria para almacenarlo/procesarlo/mostrarlo dentro del servicio.
- No usar fotos de usuarios en publicidad externa sin autorización adicional.
- Cada usuario debe tener derecho suficiente para usar imágenes/información que carga.
- Quien carga un partido declara participación y veracidad de jugadores/resultado/datos.
- Está prohibido inventar partidos, participantes o resultados o manipular datos para alterar Nivel/Ranking/estadísticas/Intelligence.
- BRAMU puede corregir, invalidar o excluir del cómputo un partido ante error, fraude, conflicto o información falsa, preservando trazabilidad.

La licencia jurídica definitiva sobre contenido y las facultades de moderación/corrección deben revisarse profesionalmente.

---

## 11. Restricción / suspensión / cierre por abuso

Causas previstas, entre otras:

- falsificación de partidos/resultados;
- manipulación de Nivel o Ranking;
- suplantación;
- acoso;
- fraude;
- abuso;
- riesgos de seguridad;
- incumplimiento legal o de Términos.

La medida puede ser temporal o definitiva según gravedad. En casos graves puede aplicarse sin aviso previo.

El usuario puede pedir revisión por email, sin sistema formal de apelaciones/tickets V1.

La redacción final debe revisarse para evitar facultades abusivas o arbitrarias.

---

## 12. Disponibilidad y evolución del producto

- BRAMUlab puede evolucionar, agregar, modificar o retirar funciones.
- Puede existir mantenimiento, errores o indisponibilidad.
- V1 es gratuito, sin promesa de gratuidad perpetua.
- Una función paga futura requiere información previa y nunca genera cargos retroactivos.
- Cambios materiales que afecten derechos/privacidad/condiciones deben notificarse y, cuando corresponda, requerir nueva aceptación.

---

## 13. Revisión legal profesional pendiente

Antes de cerrar P0.2 / abrir Production debe revisarse profesionalmente, como mínimo:

1. menores y necesidad de edad mínima / consentimiento parental;
2. identificación pública del responsable y qué datos corresponde publicar;
3. inscripción/obligaciones ante AAIP y bases reales operadas;
4. política de retención, anonimización, backups y logs;
5. plazos/contenido de respuestas de acceso/copia/rectificación;
6. transferencias internacionales y contratos de tratamiento;
7. redacción territorial Argentina + acceso internacional sin geobloqueo;
8. Términos y Política de Privacidad definitivos;
9. suspensión/cierre de cuentas;
10. limitaciones de Nivel/Ranking/Intelligence;
11. licencia sobre contenido aportado por usuarios;
12. correspondencia con Apple/Google antes de una publicación móvil.

La revisión profesional es **pendiente real**. No declarar Legal cerrado por tener las decisiones de producto resueltas.

---

## 14. Implementación técnica pendiente

Desarrollo deberá implementar/verificar, según prioridad de Pre-Production:

- flujo autoservicio de eliminación con OTP y revocación de sesiones;
- generación estandarizada del informe de acceso/copia;
- limpieza automática de altas abandonadas a 24 h + liberación de username;
- cambio de email autoservicio con verificaciones y avisos;
- cambio de contraseña autenticado + aviso;
- cerrar sesión actual / todas las sesiones;
- revocación de sesiones en eventos sensibles;
- aceptación versionada y reaceptación por cambios materiales;
- páginas legales públicas + enlaces en alta/Configuración;
- URL pública de eliminación para futura Google Play;
- procedimiento mínimo/auditable para corregir o invalidar partidos excepcionales;
- inventario real de proveedores, regiones, backups, logs, retención, subencargados y DPA;
- identificación real del proveedor de correo transaccional y su tratamiento de datos.

Algunas piezas ya tienen trabajo previo en Staging (por ejemplo eliminación de cuenta); no rehacerlas: verificar contra esta fuente maestra y completar únicamente lo faltante.

---

## 15. Estado de cierre

### Confirmado

- **No quedan decisiones humanas relevantes abiertas** para el taller de producto Legal/Privacidad.
- Argentina es el mercado inicial.
- No hay geobloqueo.
- No hay promoción deliberada en mercados extranjeros V1.

### Pendiente

- revisión legal profesional;
- definición final/publicable de Términos y Política;
- implementación/verificación técnica;
- datos operativos reales de infraestructura/proveedores.

**Legal/Privacidad no está cerrado para Production todavía.**
