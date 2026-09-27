# BRAMUlab — Handoff P0.3 Fase A — eliminación / anonimización de cuenta

**Fecha:** 27/09/2026  
**Rama activa:** `staging`  
**Objetivo:** aprovechar una ventana de trabajo técnico sin interferir con la validación física pendiente de `04.11-h10`.

## 1. Fuentes obligatorias

Leer, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Pre_Production.md` — especialmente P0.3
4. `docs/BRAMUlab/Backend_Infraestructura.md` — privacidad, Auth/eliminación y Bloque 9
5. `docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md` — especialmente §§5–8

No reconstruir la historia desde chats ni leer Archivo/Backup salvo una contradicción puntual.

## 2. Decisiones de producto ya cerradas — NO reabrir

Para V1:

- la inactividad nunca elimina cuenta, Nivel ni historial;
- la eliminación de cuenta puede ser asistida por administración; no hace falta autoservicio;
- eliminar una cuenta desactiva/elimina acceso e identificadores personales;
- los partidos compartidos NO se borran;
- la historia competitiva de terceros NO se destruye;
- en superficies compartidas la persona eliminada pasa a mostrarse como `Jugador eliminado`;
- no conservar su nombre visible;
- conservar únicamente la estructura deportiva/histórica mínima necesaria;
- salir de listas/grupos personales donde corresponda;
- la identidad deportiva eliminada no se recupera ni revincula;
- si vuelve, crea una identidad nueva desde cero;
- no implementar cooldown, hash/HMAC de email ni huella antifraude V1;
- riesgo de “reset de carrera” aceptado para V1.

## 3. Alcance de ESTA fase

Esta fase puede avanzar técnicamente, pero no debe alterar la versión que Sebastián está por validar en el Laboratorio.

### HACER

1. Auditar el esquema y código vigentes para identificar:
   - todas las tablas/campos con PII o referencias de cuenta;
   - relación real `auth.users → profiles → players`;
   - referencias desde partidos, participantes, Nivel, Ranking, Intelligence, notificaciones, listas personales, Storage/avatar, claims/invitaciones y auditoría;
   - constraints/FK que condicionen una anonimización segura;
   - qué datos deben borrarse, nullearse, anonimizarse o preservarse para cumplir las decisiones cerradas.

2. Diseñar el procedimiento administrativo mínimo V1:
   - operación privilegiada, nunca invocable por usuario común;
   - autoridad `service_role` / administración;
   - idempotencia;
   - transacción/atomicidad;
   - auditoría suficiente sin retener PII innecesaria;
   - comportamiento ante reintento;
   - comportamiento si la cuenta ya fue eliminada;
   - separación entre borrar/desactivar Auth y anonimizar identidad deportiva.

3. Si el contrato puede cerrarse sin inventar decisiones legales:
   - **AGREGAR** migración(es) aditivas necesarias;
   - **AGREGAR** función/RPC administrativa server-only o mecanismo equivalente;
   - **AGREGAR** tests SQL/transaccionales que demuestren anonimización + preservación de historial;
   - **AGREGAR** verificación explícita de permisos (PUBLIC/anon/authenticated sin ejecución; service_role únicamente);
   - incluir fixtures y rollback limpio.

4. Crear un documento de resultado en:
   `docs/BRAMUlab/Implementacion/Pre_Production/27_Resultado_P0_3_Fase_A_Eliminacion_Cuenta.md`

5. Actualizar `Pre_Production.md` solamente si el resultado cambia de forma comprobable el estado de P0.3. No marcar P0.3 completo si todavía falta UI, operación remota o revisión central.

### NO HACER

- NO tocar `main`;
- NO tocar Production;
- NO tocar BRAMUlive;
- NO aplicar migraciones a Supabase Staging remoto en esta fase;
- NO desplegar Edge Functions;
- NO tocar frontend `bramulab/` salvo que sea estrictamente necesario para tests no funcionales; preferencia: cero cambios frontend;
- NO cambiar bundle `04.11-h10`;
- NO cambiar `version.json`, Service Worker ni assets;
- NO abrir P0.2/legal final;
- NO empezar Bloque 9;
- NO implementar popup §15.26, Mis grupos ni otras ideas UX;
- NO borrar datos reales de Staging;
- NO convertir esto en un sistema de moderación/antiabuso.

## 4. Criterio ante decisiones faltantes

Si aparece una decisión humana REAL que cambia qué PII se conserva/elimina o requiere criterio legal no cerrado:

- marcarla como **DECISIÓN ABIERTA**;
- no inventar una regla;
- continuar todo lo demás que no dependa de esa decisión;
- si esa decisión impide escribir una migración segura, dejar la migración sin implementar y entregar el contrato exacto + bloqueo.

No frenar por dudas técnicas que puedan resolverse leyendo el repo.

## 5. Riesgos que los tests deben cubrir

Como mínimo, si se implementa backend:

- usuario A eliminado no puede volver a autenticarse con esa identidad;
- nombre/email/teléfono/avatar/PII no quedan disponibles en superficies ordinarias;
- partidos compartidos de B/C/D permanecen;
- participantes históricos siguen estructuralmente válidos;
- Nivel/Ranking/Intelligence históricos de terceros no se corrompen;
- búsquedas no devuelven al jugador eliminado como jugador activo;
- relaciones personales/listas dejan de tratarlo como activo;
- repetición de la operación no duplica ni rompe nada;
- usuario común no puede ejecutar la operación;
- no quedan fixtures al terminar el verify.

## 6. Entrega

Antes de terminar:

1. correr los tests locales pertinentes;
2. revisar diff;
3. no realizar ningún deploy remoto;
4. commit lógico único;
5. push a `origin/staging`;
6. informar:
   - commit;
   - archivos cambiados;
   - tests;
   - qué quedó implementado;
   - qué quedó solo diseñado;
   - decisiones abiertas reales;
   - pasos que Central debería hacer después.

Este push no debe cambiar el bundle ni el frontend que Sebastián validará como `04.11-h10`.
