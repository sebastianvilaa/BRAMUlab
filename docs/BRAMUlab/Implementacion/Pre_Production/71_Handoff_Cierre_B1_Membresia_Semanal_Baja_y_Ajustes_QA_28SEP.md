# 71 — Handoff · Cierre Grupos B1 + ajustes QA · 28/09/2026

**Rama:** `staging`  
**Objetivo:** cerrar B1 después del QA real multiusuario, alineando reglas nuevas de membresía y corrigiendo regresiones puntuales detectadas en navegador.  
**NO iniciar B2 lobby todavía.**

## Fuentes obligatorias

Leer primero:
- `docs/BRAMUlab/README.md`
- `docs/BRAMUlab/Grupos_BRAMU.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/67_Handoff_Grupos_Fase_B1_Wiring_ServerBacked_28SEP.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/68_Resultado_Grupos_Fase_B1_Wiring_ServerBacked_28SEP.md`
- este handoff

Inspeccionar únicamente lo necesario:
- `bramulab/groups.js`
- bloque Grupos de `bramulab/app.js`
- cliente RPC de Grupos en `auth.js`
- migraciones Fase A / hotfix de Grupos
- tests focales de Grupos B1
- para los tres ajustes visuales no-Grupos: bloque Resumen/Home pendiente de `app.js` y CSS relacionado.

No leer Archivo/Backup. No tocar main, Production ni BRAMUlive.

---

# A. Regla nueva cerrada — alta/reingreso retroactivo dentro de la misma semana

Producto cerró:

- semana BRAMU = lunes a domingo;
- si un jugador entra o reingresa durante una semana, para la competencia del grupo su alta deportiva vale desde el **lunes de esa misma semana**;
- puede sumar partidos oficiales anteriores al instante exacto de alta, siempre que sean de esa misma semana;
- nunca habilita partidos de semanas anteriores;
- si un grupo se crea o llega a 3 miembros a mitad de semana, partidos oficiales anteriores de esa misma semana pueden empezar a contar si pasan a cumplir 3/4.

Ejemplo real QA:
- Esteban + Matu vs Seba + Pablito quedó oficial;
- grupo tenía Esteban + Matu + Seba y sumó 5/5/0;
- Pablito se agregó después y, bajo la nueva regla, puede participar de esa semana.

## Implementación requerida

**REEMPLAZAR** en el camino server-backed la semántica exacta `joined_at <= played_at` por pertenencia deportiva efectiva semanal para el cómputo de Grupos.

Mantener:
- `joined_at` / `left_at` reales e inmutables como auditoría;
- períodos históricos reales;
- regla 3/4;
- fórmula de puntos en `groups.js`;
- Nivel oficial histórico para Sorpresa;
- no duplicar fórmula deportiva en SQL.

Backend y motor deben quedar alineados con una sola regla. No puede ocurrir que SQL excluya un partido que JS consideraría válido o viceversa.

### Semana / timestamps

Reutilizar la semántica vigente de BRAMU para lunes-domingo y `played_at`; no inventar un segundo calendario. Si el backend necesita un helper para inicio de semana, hacerlo determinístico y documentar cómo queda alineado con el frontend. No abrir una decisión humana salvo incompatibilidad real.

## Tests mínimos

Cubrir:
1. alta posterior a derrota, misma semana → el jugador puede reflejar ese partido;
2. alta posterior a victoria, misma semana → puede recibir puntos;
3. alta del tercer miembro después del partido, misma semana → partido pasa de 2/4 a 3/4 y entra;
4. alta actual NO habilita partido de semana anterior;
5. creación de grupo a mitad de semana puede recuperar partidos de esa semana;
6. reingreso = nueva etapa, con la misma regla semanal.

---

# B. Regla nueva cerrada — eliminar miembro = dejar de verlo

Producto simplificó V1:

**Eliminar/quitar miembro = sale del grupo y deja de aparecer en sus superficies competitivas.**

No ofrecer dos modos de baja.

Al eliminarlo:
- deja de aparecer en Semana actual;
- deja de aparecer en Semana pasada;
- deja de aparecer en Race anual;
- deja de aparecer en BRAMU Intelligence grupal.

Pero:
- NO borrar ni modificar partidos reales de BRAMU;
- NO tocar Nivel;
- NO tocar Ranking;
- NO recalcular hacia atrás ni quitar puntos/estadísticas que otros miembros ya obtuvieron por partidos que contaron;
- conservar la membresía histórica internamente para auditoría/trazabilidad.

Si reingresa:
- nueva etapa competitiva;
- aplica regla semanal desde el lunes de la semana de reingreso;
- no revivir automáticamente sus filas/puntos visibles de períodos eliminados anteriores.

## Hallazgo real QA

Matu fue eliminado del grupo y siguió apareciendo en Semana actual / Race.

Eso es regresión funcional bajo la regla vigente y debe quedar corregido.

## Implementación mínima recomendada

Separar claramente:
- **historial de membresía**, necesario para determinar si un partido contó y preservar puntos ajenos;
- **miembros visibles/competidores actuales**, que alimentan filas de Semana actual / Semana pasada / Race / Intelligence.

No borrar períodos históricos para conseguir el ocultamiento.

## Tests mínimos

Cubrir:
1. eliminado desaparece de las tres vistas;
2. eliminado desaparece de Intelligence;
3. puntos de otros miembros permanecen;
4. partido real permanece;
5. Race de otros no cambia;
6. reingreso no revive automáticamente etapas visibles anteriores.

---

# C. Ajustes UX detectados en QA — incluir en esta misma ronda

Son cambios pequeños ya decididos. No abrir rediseño.

## C1 — Crear grupo sin nombre

Hoy se muestra error genérico inferior.

**AGREGAR** feedback contextual en el campo:
- label/línea/borde rojo;
- mensaje breve junto al campo;
- foco visual;
- mantener selección de jugadores;
- error genérico inferior reservado para red/servidor.

## C2 — borde ámbar en Resumen pendiente

Home / Último partido usa ámbar pleno. Resumen pendiente usa `rgba(255,201,61,0.45)`.

**REEMPLAZAR** solo el `border-color` de `.result-card.result-card--pending` por el ámbar pleno equivalente a Último partido.

Mantener glow/sombra actual salvo necesidad técnica.

## C3 — identidad corregida pre-validación vuelve a fragmentar la tarjeta

Cuando un participante es corregido antes de validar, el Resumen vuelve a mostrar:
- tarjeta de resultado;
- bloque contextual separado;
- acciones separadas.

Esto contradice h24.

**FUSIONAR** también el estado `identity_replacement` dentro de la misma `.result-card.result-card--pending`:
- quien debe actuar: contexto + Reportar un error + Validar partido dentro de la tarjeta;
- quien espera: contexto de espera dentro de la misma tarjeta;
- no crear otra card/banner separado.

## C4 — Home usa el creador original como si fuera el evento actual

Caso real:
- Esteban cargó;
- Seba corrigió un participante;
- Esteban debe volver a validar;
- Home de Esteban mostró “Esteban cargó un partido con vos”.

**REEMPLAZAR** el copy para estado accionable por corrección de participante:
- usar actor/evento real cuando esté disponible;
- ejemplo de intención: “Seba corrigió un participante. Revisá el partido.”;
- si no puede resolverse actor con certeza, copy neutro;
- nunca atribuir la carga original como evento accionable actual.

No tocar otros copies ya cerrados.

---

# D. QA ya PASS — NO reabrir

QA real Esteban + Seba confirmó:
- grupo creado por una cuenta visible en la otra;
- membresías compartidas;
- admin compartido;
- rename compartido;
- 2/4 no entra;
- 3/4 sí entra;
- tabla coincide en ambas cuentas;
- Race coincide en ambas cuentas;
- fixture real 5/5/0 correcto;
- Intelligence coincidió tras reingresar a la pantalla.

No repetir pruebas equivalentes salvo para verificar específicamente los cambios de esta ronda.

---

# E. Pruebas y seguridad

Por tocar backend de membresía:
- migración solo en Staging;
- verificar RLS/SECURITY DEFINER y grants;
- no ampliar acceso directo a tablas;
- test transaccional / rollback donde corresponda;
- verificar reingreso y último admin;
- preservar trazabilidad.

Automatizadas:
- ampliar tests B1;
- correr focales de Grupos;
- correr tests afectados por C1-C4;
- suite general solo una vez al final.

---

# F. Salida esperada

1. implementar en `staging`;
2. aplicar/verificar migración en Supabase Staging si hace falta;
3. tests focales;
4. suite general;
5. diff review;
6. bump de bundle si corresponde;
7. commit lógico + push `origin/staging`;
8. Vercel BRAMUlab Staging;
9. resultado corto en `docs/BRAMUlab/Implementacion/Pre_Production/`.

No declarar B1 cerrado hasta que Central/Sebastián hagan el retest focal posterior.

No iniciar B2 lobby.
