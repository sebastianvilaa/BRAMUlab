# Pre-Production — Handoff auditoría read-only — ChatGPT Work

**Fecha:** 23/09/2026  
**Objetivo:** aprovechar Work mientras Claude Code no está disponible, sin convertir Work en implementador del repositorio.

## Regla central

Esta intervención es **READ-ONLY / QA / OPERACIONES**.

NO:

- modificar código;
- editar GitHub;
- cambiar variables;
- crear proyectos;
- aplicar migraciones;
- deployar;
- tocar main;
- tocar Production;
- tocar BRAMUlive;
- borrar datos.

Si encontrás un problema, documentalo. No lo arregles.

## 1. Leer

- `docs/BRAMUlab/README.md`
- `docs/BRAMUlab/Pre_Production.md`

No cargar Archivo/Backup.

## 2. Auditoría visual de Staging

Sobre el Preview vigente:

### Estado Cero / perfiles

Con una cuenta de Staging que tenga 0 partidos oficiales, verificar y registrar:

- Home;
- Mi Perfil;
- Perfil público.

Comparar contra P0.1 de `Pre_Production.md`.

Marcar exactamente:

- módulos vacíos que siguen visibles;
- textos `0`, `—`, `Sin datos...`;
- placeholders;
- cualquier dato pendiente usado indebidamente como estadística oficial.

No crear una cuenta nueva si ya existe una apta.

Si necesitás login y no hay sesión válida, pedile a Sebastián solo que inicie sesión manualmente.

### Alta / legal

Recorrer visualmente el alta hasta el paso de Perfil, sin crear otra cuenta si no hace falta.

Confirmar:

- copy actual de Términos;
- si existe link real a Términos;
- si existe link real a Privacidad;
- si existe un canal visible de soporte/privacidad.

No completar ni enviar un alta innecesaria.

## 3. Auditoría operativa Staging — read-only

Revisar en Vercel/Supabase, sin cambiar nada:

- qué entornos/proyectos existen realmente;
- que Staging apunta solo a Supabase Staging;
- branch/deploy esperado de Staging;
- variables de entorno: registrar solo nombres/presencia, NUNCA valores secretos;
- callbacks/redirect URLs visibles de Auth;
- SMTP configurado y remitente;
- Edge Functions activas;
- cron de Ranking;
- backups/PITR/exportación disponibles según el plan;
- cualquier alerta/limitación operativa visible;
- service worker/cache observado desde navegador;
- robots/noindex o protección equivalente de Staging.

No revisar otra vez RLS fila por fila: Bloques anteriores ya cerraron esa evidencia.

## 4. Production

Solo comprobar si existe o no infraestructura de Production.

NO crearla.

NO configurar nada.

NO abrir main para deploy.

Registrar qué falta objetivamente para poder crearla en Bloque 9.

## 5. Entrega

Crear un informe:

`docs/BRAMUlab/Implementacion/Pre_Production/04_Auditoria_ReadOnly_Work.md`

Como esta intervención no debe editar GitHub, si Work no tiene una vía ya autorizada de escritura al repo, devolver el informe en el chat para que ChatGPT central lo incorpore. No pedirle a Sebastián que copie datos técnicos extensos si Work puede guardar el archivo directamente.

Clasificar hallazgos únicamente como:

- P0 bloqueante antes de Production;
- P1 conveniente antes de amigos;
- OK / ya cubierto;
- fuera de alcance.

No proponer rediseños ni nuevas funciones.
