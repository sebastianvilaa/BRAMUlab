# Backend Bloque 7 — Handoff Fase 3: RPCs de lectura

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Fases 1–2 aplicadas y validadas en Supabase Staging.  
**Evidencia:** `12_Validacion_Central_Fase_2_Staging.md`

## 1. Objetivo único

Implementar la capa server-side de **lectura de Ranking real** sobre las ediciones ya publicadas.

Esta fase NO conecta todavía el frontend.

Debe dejar contratos estables para que Fase 5 solo consuma datos, sin volver a calcular autoridad competitiva en el navegador.

## 2. Fuentes

Leer:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Ranking_BRAMU.md`
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/03_Revision_Central_Analisis.md`
5. `docs/BRAMUlab/Implementacion/Backend/Bloque_07/12_Validacion_Central_Fase_2_Staging.md`

Inspeccionar solo lo necesario de:

- `ranking_editions`;
- `ranking_rows`;
- `ranking_profile_events`;
- partidos/participantes computables para Mi red;
- `match_user_state` solo si aporta al contrato;
- patrones vigentes de RPC/rate limiting;
- Perfil público/Home únicamente para conocer la forma mínima de datos que deberán consumir después.

## 3. Contrato de edición vigente

Crear una RPC autenticada que devuelva la última edición publicada disponible.

Debe exponer únicamente metadatos necesarios:

- edition_id;
- period_start_at;
- period_end_at;
- published_at;
- timezone;
- ranking_rules_version.

Si no existe edición publicada, devolver estado vacío explícito; no inventar una edición.

## 4. Ranking territorial

Crear contrato autenticado para leer:

- Local;
- Provincial;
- País;
- Global.

Regla crítica de autoridad:

**el cliente NO envía un territorio arbitrario.**

No implementar `Explorar rankings`.

Para la pantalla propia:

- el cliente puede pedir `scope_type`;
- el servidor resuelve el scope propio correspondiente desde el snapshot del caller en la edición;
- Global usa `GLOBAL`.

El cliente puede seleccionar rama:

- `M`;
- `F`.

La rama forma parte de la clasificación real.

No mezclar denominadores/puestos entre ramas.

## 5. Filtro de Nivel

El snapshot persistido de Fase 2 representa `Todos los niveles`.

Fase 3 debe resolver server-side:

- Todos los niveles;
- Nivel 1 … Nivel 10.

Cuando hay filtro de banda:

- filtrar elegibles por `level_band`;
- recalcular posición dentro de esa banda usando `level_internal` congelado;
- empate exacto conserva ranking de competición;
- recalcular denominador;
- recalcular densidad DESPUÉS del filtro;
- no usar ciegamente `position`/`total_eligible` almacenados para el universo sin filtro.

No crear snapshots duplicados por banda.

## 6. Filas públicas

Una fila de clasificación puede exponer solo datos deportivos/públicos necesarios:

- player_id;
- display_name;
- username;
- avatar si existe;
- position;
- total;
- density_status;
- level_public del corte;
- level_band;
- competitive_branch;
- ubicación mínima contextual;
- movimiento semanal cuando corresponda.

NO exponer:

- level_internal;
- reason codes de terceros;
- email;
- auth_user_id;
- efectividad;
- W/L;
- rachas;
- confianza;
- datos privados.

Los no elegibles pueden necesitarse para el estado propio del caller, pero no deben aparecer como jugadores rankeados en una clasificación pública normal.

## 7. Movimiento semanal

Movimiento significa puestos, nunca puntos.

Resolverlo server-side comparando con la edición semanal anterior equivalente:

- mismo scope comparable;
- misma rama;
- mismo filtro/banda cuando corresponda.

Si no existe comparación válida:

- `Nuevo` / estado equivalente;
- no fabricar `0`.

Cambio de territorio o banda rompe comparabilidad y debe resultar `Nuevo`.

La edición anterior nunca se reescribe.

## 8. Tu posición

Crear contrato específico para obtener:

- estado propio;
- puesto/total si existe;
- Nivel del corte;
- movimiento;
- ámbito/filtro activo;
- pequeña ventana alrededor de su fila cuando está posicionado.

Debe soportar el contrato UX de `TU POSICIÓN`: Fase 5 podrá llevar al usuario a su contexto sin descargar toda la clasificación.

Para un caller CALIBRANDO/no elegible:

- devolver estado propio sin inventar puesto.

## 9. Mi red

Mi red V1:

- incluye al propio usuario;
- incluye usuarios registrados con al menos un partido computable/validado compartido dentro de los 180 días anteriores al **cutoff de la edición**, no a `now()`;
- la membresía competitiva permanece estable durante la semana;
- usa el Nivel congelado de esa edición;
- selector M/F filtra la vista;
- 1–2 elegibles: comparación sin puesto;
- 3+ elegibles: posiciones N de total;
- no usa umbrales territoriales.

No materializar otra edición.

Puede calcularse al leer a partir de:

1. relaciones computables as-of-cutoff;
2. `ranking_rows` congeladas de la edición.

### Ocultar/restaurar

El master exige:

- Ocultar de Mi red;
- Ocultos (N);
- Volver a mostrar.

Si todavía no existe persistencia para esto, agregar el **estado mínimo personal** necesario y RPC autenticada/idempotente para ocultar/restaurar.

Ese ocultamiento:

- es solo presentación personal;
- no modifica partidos;
- no modifica Nivel;
- no modifica Ranking oficial;
- no afecta al otro jugador;
- puede aplicarse inmediatamente sin recalcular puestos oficiales territoriales.

No confundirlo con `hide_match_for_me`.

## 10. Perfil y Home

Crear contratos server-side únicos para que después Fase 5 no duplique lógica:

### Perfil

Resumen territorial del jugador del perfil:

- Local;
- Provincia;
- País;
- estado correspondiente a la edición vigente;
- sin inventar puesto si no es elegible.

Debe usar los ámbitos propios congelados de ESE jugador, nunca un territorio enviado libremente por el cliente.

### Home / TU MOMENTO

Contrato mínimo para el insight de Ranking propio:

- edición vigente;
- ámbito principal aplicable;
- posición;
- movimiento semanal;
- estado simple si todavía no tiene posición.

No generar texto de Intelligence en esta fase.

## 11. Búsqueda/paginación

La clasificación debe poder:

- paginar;
- buscar por nombre/username dentro de la clasificación activa;
- obtener una pequeña ventana alrededor de la posición propia.

No traer todo el universo solo para hacer scroll.

Mantener límites razonables server-side.

## 12. Rate limiting y seguridad

Seguir patrones vigentes de Bloques 2–6.

RPCs de usuario:

- `SECURITY DEFINER` solo cuando haga falta;
- caller desde `auth.uid()`;
- PUBLIC/anon revocados salvo contrato explícito;
- `authenticated` únicamente donde corresponda;
- rate limiting donde la lectura pueda abusarse;
- `search_path` fijo.

Tablas server-only siguen sin SELECT directo de terceros.

No exponer `level_internal`.

## 13. Pruebas

Crear runner SQL transaccional específico de Fase 3.

Cubrir como mínimo:

- no edition → respuesta vacía;
- Local resuelto desde scope propio;
- cliente no puede pedir otra localidad arbitraria;
- M/F independientes;
- filtro Nivel recalcula puestos/denominador/densidad;
- empate dentro de banda;
- Global locked;
- Tu posición con y sin puesto;
- movimiento semanal;
- cambio de territorio/banda → Nuevo;
- Perfil propio/público usa scope del jugador objetivo;
- Mi red 180 días as-of-cutoff;
- Mi red 1–2 sin puesto / 3+ con puesto;
- ocultar/restaurar personal;
- búsqueda/paginación;
- columnas privadas no expuestas;
- privilegios PUBLIC/anon/authenticated correctos.

Fixtures solo dentro de `BEGIN/ROLLBACK`.

## 14. No hacer

- NO frontend;
- NO eliminar mocks;
- NO pg_cron;
- NO aplicar migraciones a Supabase todavía;
- NO crear una edición persistente de QA;
- NO Explorar rankings;
- NO Ranking de Grupos;
- NO Race;
- NO matchmaking;
- NO Intelligence;
- NO main/Production/BRAMUlive.

## 15. Entrega

Preparar:

- migración/es de Fase 3;
- runner SQL transaccional;
- `docs/BRAMUlab/Implementacion/Backend/Bloque_07/14_Resultado_Fase_3_Claude.md`.

Un único commit lógico en `staging`.

Al terminar:

- HEAD;
- archivos;
- RPCs creadas;
- tests realmente ejecutados;
- bloqueos reales;
- DECISIÓN ABIERTA solo si el master no la resuelve.

Después detenerse.

NO aplicar Supabase.
NO empezar Fase 4.
