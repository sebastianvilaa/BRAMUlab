# Cierre — Grupos BRAMU B1 server-backed

**Fecha:** 28/09/2026  
**Rama:** `staging`  
**Bundle funcional validado:** `04.11-h31`

## Decisión

**B1 queda CERRADO en Staging.**

El objetivo de B1 era conectar la experiencia existente de Grupos a verdad server-backed compartida y demostrarla con QA real multiusuario. Ese objetivo quedó cubierto.

Los ajustes visuales C1-C4 implementados en h30 quedan como pulido visual a revisar junto con B2b / ronda UX; no son un riesgo de autoridad, permisos, persistencia ni cálculo y no bloquean el cierre de B1.

## Evidencia real

QA con dos cuentas/dispositivos confirmó:

- creación de grupo compartida;
- cambios de membresía visibles entre cuentas;
- promoción de admin compartida;
- rename compartido;
- permisos coherentes entre admin/no-admin;
- partido con 2/4 miembros no suma;
- partido con 3/4 miembros sí suma;
- tabla y Race idénticas en ambas cuentas;
- Intelligence basada en la misma verdad compartida;
- alta/reingreso dentro de la semana recupera actividad/puntos de esa misma semana;
- no existe retroactividad a semanas anteriores;
- eliminar un miembro lo quita de Semana actual, Semana pasada, Race e Intelligence sin borrar partidos ni puntos ajenos;
- reingreso vuelve a crear una etapa competitiva visible;
- actividad visible separada correctamente del top 3 de puntos:
  - Seba: 10 partidos · 6 V · 4 D — 17 pts;
  - Esteban: 10 partidos · 4 V · 6 D — 16 pts.

## Backend / verificación

- Fase A backend compartido: PASS.
- Hotfix membresía semanal aplicado exclusivamente en Supabase Staging.
- Migración registrada: `20260928223208 preprod_grupos_b1_membresia_semanal_hotfix`.
- Verify hotfix: `GRUPOS_B1_MEMBRESIA_SEMANAL_HOTFIX_VERIFY_PASS`.
- Verify Fase A actualizado: `GRUPOS_FASE_A_VERIFY_PASS`.
- Vercel BRAMUlab h31: SUCCESS.
- BRAMUlive: ignorado/cancelado por regla de build, correcto.
- No se tocó `main` ni Production.

## Fórmula vigente confirmada

- victoria base 5;
- bonus según fuente maestra;
- máximo 7;
- puntos semanales = 3 mejores partidos puntuables;
- actividad visible = todos los partidos calificables reales del período;
- alta/reingreso = efectiva deportivamente desde el lunes de esa misma semana;
- baja = desaparece de superficies del grupo, sin borrar historia compartida ni recalcular puntos ajenos.

## Derivación UX ya decidida para B2b

La fila competitiva dejará de abrir Perfil directamente:

- Semana actual/pasada → desglose compacto y verificable de puntos/partidos;
- Race → acumulado compacto semana por semana;
- Perfil público sigue disponible como acción secundaria.

Esto es mejora de transparencia, no reabre B1.

## Pendientes no bloqueantes trasladados

Revisar visualmente durante B2b / ronda UX:
- C1 validación contextual del nombre al crear grupo;
- C2 borde ámbar pleno del Resumen pendiente;
- C3 `identity_replacement` dentro de una única tarjeta pendiente;
- C4 copy neutro/contextual en Home tras corrección de participante.

## Siguiente etapa

**B2a — backend del lobby de Grupos**, sin frontend:
- lectura resumida de grupos;
- actividad significativa autoritativa;
- datos suficientes de la semana para construir tarjetas con el mismo motor;
- sin foto todavía.

Después:
- B2b — lobby/estado cero/help/creación/pulido + desglose de puntos;
- B2c — foto de grupo.
