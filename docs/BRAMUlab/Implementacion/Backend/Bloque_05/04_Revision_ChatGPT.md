# Backend Bloque 5 — Revisión ChatGPT
## Cierre de decisiones y autorización de implementación

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**Baseline revisado:** HEAD `8ca613c`  
**Documentos revisados:** `02_Analisis_Claude.md` + `03_Plan_Implementacion_Claude.md`

---

## 1. Veredicto

El análisis de Claude es consistente con las fuentes maestras y con los contratos cerrados de Bloques 1–4.

Se autoriza avanzar a implementación de Bloque 5 en `staging`, con las decisiones y ajustes de alcance de este documento.

No reabrir producto ya cerrado. No iniciar Bloque 6.

---

## 2. Decisiones abiertas — CERRADAS

### #1 Ventana temporal compatible para create-or-attach

**DECISIÓN: adoptar opción A.**

- ±3 horas cuando ambas cargas declaran hora conocida.
- Si alguna carga solo tiene fecha sin hora, comparar por mismo día calendario usando la zona horaria canónica definida por backend.
- Nunca usar nombre/apodo para deduplicar.
- La coincidencia temporal nunca alcanza por sí sola: siempre debe coincidir también identidad de los 4 participantes, composición de parejas y formato/modalidad.

Motivo: equilibrio razonable para piloto entre evitar duplicados y evitar fusiones incorrectas. Si el piloto aporta evidencia real de que 3 horas es demasiado o poco, se ajusta luego como regla, sin rediseñar el esquema.

### #2 Carga tardía sobre partido ya validado

**DECISIÓN: adoptar opción A.**

También buscar candidatos `validated`.

- Si identidad/parejas/ventana/formato y score normalizado coinciden: devolver `already_validated`, sin crear duplicado.
- Si coincide el encuentro pero el score difiere: no crear otro partido; devolver un código explícito para derivar en el futuro al circuito de corrección de Bloque 6.
- Bloque 5 no implementa la corrección.

Motivo: evitar registros fantasma y duplicados conocidos.

### #3 Provisionales relacionadas

**DECISIÓN: adoptar opción A.**

Incluir `list_related_provisional_players` en Bloque 5.

Un provisional que ya apareció en un partido compartido puede volver a ser seleccionado por jugadores relacionados, conservando exactamente el mismo `player_id`.

No hacerlo globalmente buscable y no fusionar por nombre.

Motivo: completa la promesa funcional de identidad persistente cerrada en Bloque 4 y permite probar literalmente el mismo provisional en varios partidos.

### #4 Expiración a 30 días

**DECISIÓN: adoptar opción A para Bloque 5.**

Usar expiración lógica/perezosa en lectura y conteos:

`pending_validation + deadline vencido => presentar/tratar como expired`.

No introducir `pg_cron` ni infraestructura adicional ahora.

Motivo: cumple producto con menor complejidad. La materialización física podrá agregarse cuando Ranking/Intelligence o métricas realmente la necesiten.

---

## 3. Ajustes al plan de Claude

### 3.1 No crear un entorno Development nuevo solo para este bloque

El desarrollo activo del proyecto es `staging`.

No crear ni pedir a Sebastián que configure un Supabase Development descartable.

Secuencia preferida:

1. implementar migraciones/RPC/Edge Function y tests localmente;
2. revisar SQL/código y correr tests locales/estáticos;
3. aplicar directamente a **Supabase Staging** de forma controlada;
4. correr el verificador real contra Staging;
5. recién después integrar/validar frontend en Vercel Staging.

Si existe ya un entorno Development funcional y accesible sin intervención humana, puede usarse, pero NO es requisito ni debe crearse para este bloque.

### 3.2 Máxima autonomía

No convertir a Sebastián en operador técnico.

Claude debe ejecutar por sí mismo todo lo que pueda hacer con las herramientas/credenciales ya disponibles:

- escribir migraciones;
- aplicar migraciones a Staging;
- desplegar Edge Function a Staging;
- ejecutar verificadores;
- revisar logs;
- hacer commits/push.

Solo detenerse si aparece una limitación real de autenticación/permiso o una decisión de producto nueva no cubierta por este documento.

Nunca pedir que pegue secretos, contraseñas, OTP o service-role keys en el chat.

### 3.3 Pruebas proporcionales al riesgo

Bloque 5 sí justifica pruebas fuertes en:

- identidad;
- deduplicación;
- idempotencia;
- concurrencia;
- offline/outbox;
- RLS;
- límite de pendientes;
- provisional reutilizado;
- no impacto en Nivel antes de validar.

Evitar smoke tests manuales redundantes si `verify-bloque5.mjs` ya cubre exactamente el mismo riesgo.

No repetir suites completas entre commits pequeños si no se tocó una superficie relevante.

### 3.4 Frontend y UX

Reutilizar la carga de partido existente.

No rediseñar pantallas por gusto.

Los cambios visibles deben limitarse a lo necesario para:

- seleccionar identidades reales/provisionales;
- reflejar `sync_pending`;
- resolver ambigüedad de create-or-attach;
- mostrar estados reales en historial;
- ocultar para mí sin borrar el partido compartido.

Cualquier decisión visual no definida puede dejarse funcional y mínima para posterior revisión UX con Sebastián.

### 3.5 Historial y estadísticas

No migrar automáticamente historial legacy/local existente.

No mezclar partidos pendientes con estadísticas oficiales.

La traducción servidor → forma local puede reutilizar consumidores existentes, pero debe marcar claramente el origen/estado server-backed para impedir efectos falsos.

### 3.6 Frontera con Bloque 6

Bloque 5 NO implementa todavía:

- Confirmar;
- Proponer corrección;
- No participé;
- validación oficial;
- actualización de Nivel;
- correcciones post-validación;
- incidencias de identidad;
- reversión/reproceso.

Puede dejar contratos y datos preparados, pero no adelantar comportamiento de Bloque 6.

---

## 4. Orden recomendado de ejecución

Claude puede avanzar autónomamente en una sola ronda larga hasta este checkpoint:

1. esquema + RLS/GRANTs;
2. RPCs de lectura;
3. create-or-attach + idempotencia/concurrencia;
4. Edge Function;
5. refactor mínimo de validación compartida;
6. `verify-bloque5.mjs`;
7. tests locales/estáticos;
8. aplicar a Supabase Staging;
9. desplegar Edge Function en Staging;
10. correr verificador real en Staging;
11. documentar resultados.

**Checkpoint obligatorio:** detenerse antes de una integración frontend amplia si el backend real de Staging no está completamente verde.

Si el backend queda verde y la integración frontend puede hacerse sin decisiones nuevas de producto, Claude puede continuar también con frontend y tests locales. Si aparece una decisión visual/producto real, marcarla como DECISIÓN ABIERTA y continuar todo lo demás.

---

## 5. Criterio de intervención humana

Sebastián no debe intervenir para SQL, CLI, Supabase, Vercel o tests si Claude/ChatGPT/Work pueden resolverlo.

La intervención humana queda reservada para:

- autenticación que técnicamente requiera presencia humana;
- autorización sensible no otorgada;
- decisión real de producto/UX;
- revisión visual final.

---

## 6. Estado

Las 4 decisiones del análisis quedan **CERRADAS**.

Se autoriza iniciar implementación de Backend Bloque 5 sobre `staging`.

`main`, Production y BRAMUlive permanecen fuera de alcance.
