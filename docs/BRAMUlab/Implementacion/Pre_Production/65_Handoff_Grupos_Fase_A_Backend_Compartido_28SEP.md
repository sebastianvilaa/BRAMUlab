# Handoff — Grupos BRAMU · Fase A — Backend compartido

**Fecha:** 28/09/2026  
**Entorno:** únicamente staging  
**Baseline frontend:** BRAMUlab V04.11 / bundle 04.11-h27  
**Handoff paraguas:** `62_Handoff_Grupos_BRAMU_28SEP.md`

## Objetivo de esta fase

Construir la base server-backed compartida de Grupos BRAMU y dejar sus contratos probados en Staging.

**NO conectar todavía la UI de Grupos.**  
**NO hacer cambios UX.**  
**NO reescribir `groups.js`.**

La revisión Central posterior a esta fase debe poder evaluar esquema, permisos y contratos antes de cablear el frontend.

---

## Leer

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Grupos_BRAMU.md`
4. `docs/BRAMUlab/Backend_Infraestructura.md`
5. `docs/BRAMUlab/Implementacion/Pre_Production/62_Handoff_Grupos_BRAMU_28SEP.md`
6. este documento

Después inspeccionar solo los patrones vigentes necesarios de Supabase/RLS/RPC/Edge Functions y:
- `bramulab/groups.js`
- bloque Grupos de `bramulab/store.js`

No leer Archivo/Backup ni reconstruir V03.4.

---

## Decisiones ya cerradas

- identidad siempre por `player_id`, nunca por nombre;
- creador entra como miembro + admin;
- puede haber varios admins;
- nunca puede quedar un grupo activo con cero admins;
- quitar miembro cierra su período: no borra membresía histórica;
- un reingreso abre un período nuevo;
- eliminar grupo no elimina partidos ni reescribe historia deportiva;
- solo miembros autorizados pueden leer un grupo;
- solo admins pueden renombrar, agregar/quitar miembros, cambiar admins o eliminar;
- la experiencia visual actual no se toca en esta fase;
- `localStorage` no será autoridad productiva.

---

## AGREGAR — persistencia mínima

Diseñar nombres concretos compatibles con las convenciones actuales del repo, pero el modelo debe representar como mínimo:

### Grupo
- `group_id` UUID estable;
- nombre;
- `created_by_player_id`;
- `created_at` / `updated_at`;
- estado activo/eliminado y timestamp de eliminación si corresponde.

### Membresía histórica
Representar cada período de pertenencia de forma normalizada, no como un único joined/left que pueda ser pisado al reingresar:

- grupo;
- `player_id`;
- `joined_at`;
- `left_at nullable`;
- timestamps/identificador que permitan más de un período histórico para el mismo jugador.

### Rol admin
Debe quedar históricamente y transaccionalmente coherente con membresía activa.

Puede modelarse dentro de la pertenencia activa o en estructura separada si existe una razón concreta, pero:
- un admin debe ser miembro activo;
- nunca permitir que una mutación deje cero admins activos.

---

## AGREGAR — contratos server-side

Implementar contratos mínimos y transaccionales para:

1. listar mis grupos;
2. obtener detalle de un grupo del que soy miembro;
3. crear grupo;
4. renombrar grupo;
5. agregar miembro por `player_id`;
6. quitar miembro cerrando período;
7. promover admin;
8. quitar admin;
9. eliminar grupo lógicamente.

Preferir RPC/operaciones server-side para mutaciones donde haya invariantes multi-fila.  
No confiar el guardrail “último admin” solo al frontend.

Las respuestas deben ser suficientemente estables para que la Fase B pueda mapearlas a la forma que hoy consume la UI.

No agregar endpoints redundantes si un contrato existente puede resolverlo limpiamente.

---

## AGREGAR — autoridad deportiva compartida

Resolver en esta fase el **contrato de datos** necesario para que, en Fase B, cualquier miembro del mismo grupo pueda calcular/ver la misma competencia.

Problema a evitar:
- el historial personal de cada usuario NO es una fuente suficiente para construir la tabla completa del grupo.

El backend debe ofrecer una lectura autorizada que permita obtener, para un grupo:

- partidos server-backed admitidos por la política de Grupos;
- participantes por `player_id`;
- fecha oficial jugada;
- formato/sets/ganador necesarios por el motor;
- membresía histórica aplicable;
- Nivel oficial histórico anterior al partido cuando exista evidencia para bonus Sorpresa.

### Regla importante

No duplicar la fórmula de puntos/top3/Race en SQL en esta fase.

Conservar `bramulab/groups.js` como fuente de reglas si es viable. El contrato puede entregar datos normalizados para que el mismo motor puro calcule después.

Si para privacidad/seguridad es mejor calcular la salida grupal server-side reutilizando el mismo motor JS mediante shared/symlink, documentar esa decisión y hacerlo sin crear una segunda fórmula.

**No usar Nivel simulado legacy como fallback productivo.**  
Si falta Nivel oficial histórico suficiente para Sorpresa, ese bonus simplemente no se otorga.

---

## RLS / seguridad

Demostrar en tests o SQL de verificación:

- no miembro no puede leer grupo/detalle competitivo;
- miembro sí puede leer;
- miembro no admin no puede mutar;
- admin sí puede mutar;
- no se puede agregar un `player_id` inexistente/no seleccionable según contratos vigentes;
- no se puede quitar/demover al último admin dejando cero;
- eliminación lógica deja inaccesible el grupo por los contratos ordinarios sin borrar historia deportiva.

Usar patrones de seguridad vigentes del repo.  
No exponer service-role al navegador.

---

## NO HACER EN FASE A

- no tocar `index.html`, `styles.css` ni composición visual;
- no cambiar header/naming;
- no hacer estado cero;
- no hacer preview EJEMPLO;
- no hacer “Tu grupo está listo”;
- no modificar CTA Agregar jugador;
- no tocar tabla/Race/Intelligence visual;
- no migrar automáticamente grupos locales de QA;
- no implementar invitaciones;
- no implementar notificaciones;
- no tocar Nivel, Ranking ni fórmula de partidos;
- no tocar main, Production ni BRAMUlive.

---

## Pruebas por riesgo

Mínimo:

1. crear grupo → creador miembro+admin;
2. agregar miembro;
3. reingreso después de salida crea nuevo período sin perder el anterior;
4. no-admin bloqueado en mutaciones;
5. admin puede promover otro admin;
6. último admin no puede ser demovido/quitado;
7. con dos admins puede quitarse uno;
8. eliminar grupo preserva memberships/partidos históricos necesarios y lo retira de lecturas normales;
9. dos jugadores miembros obtienen la misma definición server-backed del grupo;
10. contrato deportivo puede representar un partido con 3/4 miembros;
11. mismo partido puede ser elegible para más de un grupo;
12. ausencia de snapshot histórico de Nivel no fabrica bonus Sorpresa.

Aplicar migraciones primero en Staging y verificar.

---

## Salida

Al terminar:

- migraciones y contratos aplicados/verificados en Staging;
- tests pertinentes;
- diff revisado;
- commit lógico;
- push a `origin/staging`;
- crear **un único resultado corto** para esta fase en `docs/BRAMUlab/Implementacion/Pre_Production/`;
- indicar claramente qué contrato debe consumir Fase B.

Si aparece una decisión humana real, marcar `DECISIÓN ABIERTA` y seguir con todo lo demás.

No iniciar Fase B sin revisión Central.
