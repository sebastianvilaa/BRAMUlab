# Pre-Production — Borrador de requisitos legales y privacidad V1

**Fecha:** 23/09/2026  
**Estado:** **BORRADOR DE PRODUCTO — NO ES TEXTO LEGAL FINAL**  
**Uso:** preparar Términos/Privacidad reales antes de Production y reducir decisiones abiertas. Requiere revisión legal adecuada antes de publicarse.

## 1. Fuentes oficiales consultadas

Argentina:

- Ley 25.326 de Protección de Datos Personales:
  https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion
- AAIP — derechos de titulares:
  https://www.argentina.gob.ar/aaip/datospersonales/derechos
- AAIP — guía sobre políticas de privacidad:
  https://www.argentina.gob.ar/noticias/politicas-de-privacidad-la-aaip-comparte-informacion-clave-para-la-ciudadania
- Ley 24.240 de Defensa del Consumidor:
  https://www.argentina.gob.ar/normativa/nacional/638/actualizacion

La AAIP exige que una política de privacidad explique en lenguaje claro qué datos se tratan, con qué finalidad, quién es responsable, cómo se protegen, con quién se comparten, el canal para ejercer derechos y los plazos/criterios de conservación.

## 2. Decisión de acceso V1

Confirmado para la primera salida:

- login: email + contraseña;
- recuperación: email + OTP;
- @usuario: identidad pública dentro de BRAMU, no credencial V1;
- email: privado frente a otros jugadores.

## 3. Datos que BRAMU trata

### Cuenta / privados

- email;
- credenciales gestionadas por Supabase Auth;
- aceptación/versionado de Términos;
- timestamps técnicos;
- información necesaria de seguridad, rate limiting y auditoría;
- notas privadas del usuario;
- tokens de claim/invitación, nunca públicos.

### Perfil deportivo visible para usuarios autenticados

Según la fuente maestra vigente:

- @usuario;
- nombre/display name;
- avatar;
- localidad deportiva;
- rama competitiva;
- mano/lado cuando el usuario los completa;
- categoría contextual;
- Nivel BRAMU público + estado/calibración;
- posición vigente de Ranking cuando corresponda;
- estadísticas agregadas respaldadas por datos reales.

No publicar perfiles como páginas indexables en Internet durante el lanzamiento inicial.

### Actividad deportiva compartida

- partidos;
- participantes;
- parejas/rivales;
- marcador/sets;
- fecha jugada;
- estado de validación;
- revisiones/correcciones;
- autoría y auditoría;
- snapshots/efectos oficiales necesarios para Nivel, Ranking e Intelligence.

## 4. Finalidades que deben declararse

El texto legal final debe cubrir al menos:

- crear y proteger la cuenta;
- identificar jugadores;
- registrar y compartir partidos entre sus participantes;
- validar/corregir actividad;
- calcular y mostrar Nivel BRAMU;
- publicar Ranking BRAMU dentro del universo elegible;
- producir BRAMU Intelligence sobre evidencia registrada;
- prevenir duplicados/abuso básico;
- operar soporte, recuperación y seguridad;
- medir eventos mínimos necesarios para mejorar el producto.

No declarar publicidad, venta de datos ni finalidades comerciales que BRAMU no usa.

## 5. Supresión / eliminación

La AAIP reconoce derechos de acceso, rectificación, actualización y supresión. El lanzamiento necesita un canal explícito para recibir solicitudes.

### Estado de producto ya definido

- eliminación inicial asistida, no necesariamente autoservicio;
- desactivar acceso;
- anonimizar datos públicos/personales que correspondan;
- no borrar silenciosamente un partido compartido de los otros tres participantes;
- conservar solo la mínima estructura deportiva/histórica que el criterio legal permita conservar;
- representación prevista en interfaces compartidas: `Jugador eliminado`, sin conservar el nombre visible.

### DECISIÓN CERRADA V1 — reingreso después de eliminación

Si la persona vuelve a BRAMU después de eliminar su cuenta:

- crea una identidad nueva desde cero;
- no se recupera ni revincula la identidad deportiva eliminada;
- no se implementa reingreso asistido;
- no se implementa cooldown de 30 días;
- no se retiene hash/HMAC de email ni otra huella antifraude específica para impedir el reingreso inmediato.

Riesgo aceptado V1: una persona podría intentar reiniciar su carrera eliminando y recreando su cuenta.

Si aparece abuso real, recién entonces se evalúa una política anti-reset específica con revisión de privacidad/legal.

## 6. Retención

La Política de Privacidad debe declarar criterios comprensibles de conservación.

Borrador conceptual:

- datos de cuenta: mientras la cuenta esté activa y durante el período estrictamente necesario para seguridad/obligaciones;
- datos compartidos de partidos: conforme a la necesidad de mantener historia coherente para otros participantes, con anonimización cuando corresponda;
- logs técnicos: por un período limitado y proporcional a seguridad/diagnóstico;
- tokens de invitación/reclamo: hasta uso/expiración según su contrato;
- borradores/outbox locales: transitorios;
- datos de Staging/test: nunca mezclados con Production.

Los plazos exactos se cierran con revisión legal y operativa.

## 7. Canal de derechos / soporte

Antes de Production debe existir un contacto real visible.

Debe permitir pedir:

- acceso;
- rectificación;
- actualización;
- supresión/eliminación;
- ayuda de cuenta;
- consulta sobre privacidad.

No hace falta construir un sistema de tickets para 10–20 usuarios: un email dedicado y procedimiento interno documentado alcanza inicialmente si cumple la operación acordada.

## 8. Consentimiento/versionado

Reemplazar:

- `TERMS_VERSION = piloto_v1`;
- “Acepto los Términos y Condiciones de BRAMU (versión piloto)”.

Por versiones reales y enlaces accesibles a:

- Términos y Condiciones;
- Política de Privacidad.

Registrar:

- versión aceptada;
- fecha/hora;
- usuario/cuenta correspondiente.

Si cambia materialmente una versión, definir cómo se solicita nueva aceptación antes de publicar el cambio.

## 9. Menores

La fuente maestra actual orienta el lanzamiento a adultos.

No habilitar deliberadamente onboarding para menores hasta definir consentimiento/tratamiento específico.

Para el lanzamiento inicial, la forma más simple es declarar la edad mínima correspondiente en Términos y evitar recopilar datos de menores como caso normal.

La edad exacta y redacción requieren revisión legal.

## 10. Próximo trabajo

Con la decisión de reingreso ya cerrada:

1. redactar borrador completo de Política de Privacidad;
2. redactar borrador completo de Términos;
3. definir email/canal de contacto;
4. pasar ambos por revisión legal;
5. integrar links + versión real en Staging;
6. QA;
7. recién luego llevarlos a Production.
