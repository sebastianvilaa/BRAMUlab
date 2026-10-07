# BRAMUlab — Estado G3/G4 · dominio + AAIP · 07/10/2026

## Estado

Production sigue sin deploy público final.

Dominio definitivo de la aplicación:
- `https://app.bramulab.com`
- `bramulab.com` registrado en Cloudflare.
- `app.bramulab.com` conectado por CNAME a Vercel, verificado.
- `bramulab.vercel.app` queda como alias técnico/fallback temporal.

## Supabase Production

Proyecto:
- nombre: `bramulab-production`
- ref: `bgnnnfbdywefftvoqiss`
- región: `sa-east-1` (São Paulo, Brasil)
- plan actual: Free
- estado: ACTIVE_HEALTHY

Verificado:
- paridad de migraciones con Staging;
- 12/12 Edge Functions ACTIVE;
- Production sin usuarios, jugadores ni partidos;
- cron semanal de Ranking activo;
- cleanup de altas abandonadas activo y exclusivo de Production;
- Auth Site URL: `https://app.bramulab.com`;
- redirects nuevos del dominio definitivo agregados;
- redirects de `bramulab.vercel.app` conservados temporalmente como fallback;
- `BRAMU_PUBLIC_BASE_URL=https://app.bramulab.com`;
- templates/email logo preparados para el nuevo origen.

## Vercel

Proyecto BRAMUlab:
- dominio definitivo verificado: `app.bramulab.com`;
- variables Production separadas de Preview/Staging;
- no hubo deploy final de Production;
- BRAMUlive no fue modificado.

## AAIP / RNBDP

Responsable privado: inscripto.

Base BRAMUlab:
- trámite presentado el 07/10/2026;
- expediente: `EX-2026-97673851-APN-DNDPD#AAIP`;
- estado informado por TAD al cierre de esta ronda: Iniciación;
- todavía sin número definitivo de registro.

Decisión de salida:
- no esperar el número definitivo para continuar preparando/publicando Production;
- mientras esté pendiente, los textos públicos deben declarar literalmente que la inscripción fue presentada y está pendiente de aprobación/asignación de número;
- cuando AAIP asigne número definitivo, reemplazar ese texto y actualizar la información registrada si fuera necesario.

## Transferencias internacionales

Destinos concretos declarados ante AAIP:
- Brasil: Supabase Production en São Paulo;
- Estados Unidos: proveedores contractuales Vercel Inc. / Google LLC.

Google informa procesamiento potencial en servidores distribuidos globalmente.
Vercel informa procesamiento principal en Estados Unidos y posible procesamiento global.

Mecanismo decidido para destinos sin nivel adecuado:
- consentimiento expreso e informado del usuario.

El alta y el gate de reaceptación ahora expresan explícitamente ese consentimiento junto con la aceptación de Términos y lectura de Política de Privacidad.

## Retención / backups / logs

Supabase Production continúa en plan Free.

Estado real documentado:
- logs operativos accesibles: últimas 24 horas;
- BRAMUlab no dispone en este plan de una ventana de restauración administrada de backups desde el panel;
- no prometer backups propios que todavía no existen;
- las copias técnicas que proveedores puedan mantener siguen sus ciclos internos y no deben reutilizarse para restablecer datos eliminados en el servicio activo.

## Cambios aplicados en staging

- `bramulab/index.html`: consentimiento expreso para transferencias internacionales en alta y reaceptación.
- `bramulab/terminos/index.html`: fecha de vigencia + domicilio publicable autorizado.
- `bramulab/privacidad/index.html`: vigencia, domicilio, AAIP presentado, proveedores/regiones, transferencias y retención real.
- `bramulab/eliminar-cuenta/index.html`: vigencia y retención real.

## Único dato pendiente para liberar el legal guard

`[[PENDIENTE_PRODUCCION:nombre_legal_responsable]]`

Central NO debe inferirlo por username, GitHub, email u otra fuente indirecta.
Debe recibir de Sebastián el nombre legal exacto que autoriza publicar.

Después:
1. reemplazar ese placeholder en Términos/Privacidad;
2. verificar que no quede ningún `[[PENDIENTE_PRODUCCION:*]]`;
3. validar guard de Production;
4. hacer deploy dirigido del proyecto Vercel `bramulab` desde la versión cerrada de BRAMUlab, sin mover `main` entero ni arrastrar BRAMUlive;
5. smoke inicial con Sebastián;
6. mantener seguimiento del expediente AAIP y sustituir por número definitivo cuando llegue.

## No tocar

- BRAMUlive;
- cambios globales de `main` que arrastren el historial completo de Staging;
- repo privado hasta autorización específica posterior;
- funciones nuevas no justificadas.
