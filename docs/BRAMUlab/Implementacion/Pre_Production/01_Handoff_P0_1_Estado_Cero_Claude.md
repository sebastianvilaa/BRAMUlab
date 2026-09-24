# Pre-Production P0.1 — Handoff Estado Cero + perfiles progresivos — Claude Code

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Bloques 1–8 cerrados.  
**Fuente de prioridad:** `docs/BRAMUlab/Pre_Production.md` P0.1.  
**Fuente maestra UX:** `docs/BRAMUlab/Experiencia_Inicial.md` §§3–5.6.

## 1. Objetivo

Completar únicamente la implementación ya definida de:

- Home Estado Cero;
- Mi Perfil con 0 partidos oficiales;
- Perfil público con 0 partidos oficiales;
- progresión de módulos desde el primer partido válido.

No rediseñar componentes. No agregar funciones.

## 2. Lectura mínima

Leer:

1. `docs/BRAMUlab/README.md`;
2. `docs/BRAMUlab/Pre_Production.md` — solo P0.1;
3. `docs/BRAMUlab/Experiencia_Inicial.md` — §§3, 4 y 5;
4. código vigente relevante en:
   - `bramulab/app.js`;
   - `bramulab/player-home.js`;
   - `bramulab/index.html`;
   - `bramulab/styles.css`.

No releer Bloques 1–8 ni Archivo/Backup.

## 3. Home Estado Cero — comportamiento obligatorio

Estado Cero = 0 partidos válidos/oficiales, aunque existan pendientes.

### Mostrar

- identidad + Nivel;
- `CALIBRANDO · 0/5`;
- Último partido convertido en `Cargar primer partido` solo si no existe ninguna carga;
- si hay carga pendiente, mostrar ese partido real + estado pendiente;
- TU MOMENTO;
- Buscar jugadores;
- carrusel solo si existe contenido temporal relevante.

### Ocultar completamente

Con 0 partidos oficiales:

- Actividad;
- Efectividad;
- Racha;
- Partidos totales;
- Mejor compañero;
- Rival más enfrentado;
- Evolución;
- cualquier estadística `0` que signifique “sin evidencia”;
- mensajes `Sin partidos considerados`;
- `Sin racha en curso`;
- `Sin datos suficientes`;
- placeholders / tarjetas grises / locks.

La Home debe ser más corta, no “completa pero vacía”.

### Regla crítica

Partidos pendientes pueden reconocerse como actividad/estado del partido, pero **no alimentan estadísticas oficiales**.

Usar los helpers server-backed vigentes que ya distinguen historial visible vs computable; no reimplementar esa lógica.

## 4. Desde el primer partido válido

Revelar progresivamente:

- Actividad;
- Efectividad;
- Racha + Partidos totales como pareja;
- Último partido real.

`Mejor compañero + Rival más enfrentado` aparecen juntos únicamente cuando ambos son legítimos.

Grilla:

**0 / 2 / 4 tarjetas. Nunca 1 / 3.**

No hacer depender Home de “tener 5 partidos”; 5 computables + 3 rivales es regla de calibración de Nivel, no gate de Home.

## 5. Mi Perfil — 0 partidos oficiales

Mostrar:

- identidad;
- `@usuario`;
- Nivel inicial;
- calibración;
- edición/completado de datos.

Ocultar:

- Efectividad vacía;
- partidos jugados = 0 como protagonista;
- partidos ganados = 0;
- mejor racha = `—`;
- evolución sin historial;
- gráficos sin datos;
- módulos de compañeros/rivales sin evidencia;
- cualquier agregado que todavía no exista.

No ocultar el Nivel inicial.

## 6. Perfil público — 0 partidos oficiales

Mostrar:

- nombre/avatar;
- `@usuario`;
- Nivel inicial estimado;
- estado `CALIBRANDO`;
- metadata de perfil que exista realmente y sea pública.

Ocultar:

- Efectividad;
- rendimiento;
- jugados/ganados en cero;
- mejor racha `—`;
- pico de Nivel inexistente;
- gráficos/estadísticas sin evidencia.

Ranking respeta su contrato real: nunca inventar posición.

## 7. No tocar

- Backend;
- Supabase;
- Nivel;
- Ranking;
- Intelligence;
- lógica de pendientes/validación;
- Auth;
- textos legales;
- main;
- Production;
- BRAMUlive.

## 8. Implementación

Preferir cambios de visibilidad/estructura mínima sobre rehacer markup.

Esperable:

### FUSIONAR

- `app.js`: gates de visibilidad y renders;
- `player-home.js`: helpers puros si mejora testabilidad;
- `index.html`: solo wrappers/ids si son imprescindibles;
- `styles.css`: solo si ocultar/reordenar necesita ajuste;
- tests.

### NO TOCAR

El cálculo real de las métricas.

No convertir un `0` legítimo posterior al primer partido en “sin dato”. La regla especial es para ausencia de partidos oficiales.

## 9. Tests mínimos

Cubrir como mínimo:

1. 0 oficiales / 0 cargados → Home corta, CTA primer partido, sin módulos estadísticos;
2. 0 oficiales / 1 pending → partido pendiente visible, sin stats oficiales;
3. 1 oficial → Actividad/Efectividad aparecen;
4. Racha + total siempre juntas;
5. partner+rival nunca aparecen como tarjeta huérfana;
6. Mi Perfil 0 oficiales → identidad/Nivel sí, estadísticas no;
7. Perfil público 0 oficiales → identidad/Nivel sí, rendimiento no;
8. pending no alimenta Mi Perfil/Perfil público;
9. nombres largos no desplazan Nivel;
10. no regresión en Home con historial real existente.

Correr únicamente suites directamente afectadas + smoke pertinente.

No repetir baterías de Bloques 1–8.

## 10. Bundle/deploy

Esta ronda toca frontend.

- trabajar/testear localmente;
- un único bump de bundle;
- un único commit/push final;
- no micro-pushes;
- no “push para ver”.

No elegir número de bundle sin leer el vigente.

## 11. Entrega

Guardar resultado en:

`docs/BRAMUlab/Implementacion/Pre_Production/02_Resultado_P0_1_Estado_Cero_Claude.md`

Al terminar:

- tests;
- diff;
- commit lógico;
- push a `origin/staging`;
- no avanzar a legal/privacidad ni Bloque 9.

La tarea no termina hasta que el resultado esté remoto.
