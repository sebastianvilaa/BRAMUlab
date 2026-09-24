# Pre-Production — Handoff consolidado P0.1 + Ranking automático — Claude Code

**Fecha:** 24/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Bloques 1–8 cerrados en Staging.  
**Tipo de cambio:** frontend + ajuste acotado de Ranking server-side.  
**Reemplaza:** `01_Handoff_P0_1_Estado_Cero_Claude.md`.

## 1. Objetivo de esta única ronda

Implementar en una sola intervención lógica:

1. **P0.1 — Home Estado Cero + Mi Perfil progresivo + Perfil público progresivo**;
2. **P0.1B — Ranking con participación automática**.

No avanzar a Legal/Privacidad, eliminación de cuenta, Bloque 9 ni Production.

## 2. Lectura obligatoria y mínima

Leer primero:

1. `docs/BRAMUlab/README.md`;
2. `docs/BRAMUlab/Metodo_Trabajo.md`;
3. `docs/BRAMUlab/Pre_Production.md` — P0.1 y P0.1B;
4. `docs/BRAMUlab/Experiencia_Inicial.md`;
5. `docs/BRAMUlab/Ranking_BRAMU.md`.

Para estado de implementación, consultar únicamente las secciones necesarias de:

`docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`

No releer Archivo/Backup ni reauditar Bloques 1–8.

## 3. REEMPLAZAR / FUSIONAR / NO TOCAR

### FUSIONAR

- visibilidad/progresión de Home Estado Cero;
- visibilidad/progresión de Mi Perfil;
- visibilidad/progresión de Perfil público;
- gate de Ranking para pedir solo localidad + rama;
- elegibilidad de Ranking para que `ranking_opt_in` deje de excluir;
- UI de completado de datos de Ranking;
- tests focalizados.

### REEMPLAZAR

- cualquier pregunta ordinaria “participar sí/no” en Ranking;
- cualquier condición de elegibilidad que dependa de `ranking_opt_in=true`;
- cualquier gate que considere `ranking_opt_in` un dato faltante.

### AGREGAR

Solo lo imprescindible para soportar de forma segura el cambio server-side de Ranking en Staging:

- migración nueva si una función/RPC SQL ya publicada debe cambiar;
- cobertura para cuentas legacy con `ranking_opt_in=false`.

### NO TOCAR

- fórmula de Nivel BRAMU;
- reglas de calibración;
- publicación semanal, densidad, ámbitos, filtros y snapshots históricos de Ranking;
- validación/corrección de partidos;
- BRAMU Intelligence;
- Auth;
- Legal/Privacidad;
- eliminación de cuenta;
- BRAMUlive;
- `main`;
- Production.

No borrar la columna `ranking_opt_in` si conservarla como legacy reduce riesgo.

## 4. P0.1 — Estado Cero

Estado Cero = 0 partidos válidos/oficiales, aunque existan cargas pendientes.

### Home — mostrar

- identidad + Nivel;
- `CALIBRANDO · 0/5`;
- si no existe ninguna carga: Último partido convertido en CTA `Cargar primer partido`;
- si existe una carga pendiente: el partido real + su estado pendiente;
- `TU MOMENTO` con promesa de valor, sin inventar evidencia;
- Buscar jugadores;
- carrusel solo si existe contenido temporal relevante.

### Home — ocultar completamente con 0 oficiales

- Actividad;
- Efectividad;
- Racha;
- Partidos totales = 0;
- Mejor compañero;
- Rival más enfrentado;
- Evolución;
- Intelligence sin evidencia;
- `Sin partidos considerados`;
- `Sin racha en curso`;
- `Sin datos suficientes`;
- placeholders, locks o tarjetas grises sin valor.

La Home debe ser más corta, no una Home completa vacía.

### Progresión

Desde el primer partido oficial, revelar módulos únicamente cuando tengan evidencia real.

- Racha + Partidos totales aparecen juntos;
- Mejor compañero + Rival aparecen juntos;
- grillas de pares: 0 / 2 / 4, nunca 1 / 3;
- no usar “5 partidos” como gate visual de Home: eso pertenece a calibración de Nivel.

Los pendientes pueden reconocerse como estado/actividad del partido, pero **no alimentan estadísticas oficiales**.

## 5. Mi Perfil progresivo

Con 0 partidos oficiales, mostrar:

- identidad;
- `@usuario`;
- Nivel inicial;
- estado/calibración;
- edición/completado de datos.

Ocultar:

- efectividad vacía;
- jugados = 0;
- ganados = 0;
- racha = `—`;
- evolución/gráficos sin historial;
- compañeros/rivales sin evidencia;
- cualquier agregado inexistente.

No ocultar el Nivel inicial.

## 6. Perfil público progresivo

Con 0 partidos oficiales, mostrar:

- identidad/avatar;
- `@usuario`;
- Nivel inicial;
- estado `CALIBRANDO`;
- metadata pública que exista realmente.

Ocultar:

- efectividad;
- rendimiento;
- jugados/ganados en cero;
- racha `—`;
- pico de Nivel inexistente;
- gráficos/estadísticas sin evidencia.

Nunca inventar posición de Ranking.

## 7. P0.1B — Ranking automático

Nueva regla vigente:

- todo jugador activo participa automáticamente cuando cumple elegibilidad;
- no existe opt-in / opt-out ordinario;
- al entrar a Ranking, si faltan localidad o rama, se solicitan esos datos;
- `CALIBRANDO` puede explorar Ranking sin posición propia;
- al cumplir elegibilidad, entra automáticamente en la edición semanal correspondiente;
- `ranking_opt_in` queda como compatibilidad histórica y deja de decidir elegibilidad.

### Requisito técnico

Trazar todos los usos de `ranking_opt_in` en frontend, RPCs, funciones SQL, tests y contratos.

Objetivo:

- UI ya no pregunta participar sí/no;
- gate solo exige localidad + rama;
- cálculo/publicación no excluye por `ranking_opt_in=false`;
- una cuenta existente con `ranking_opt_in=false`, si cumple el resto, debe tratarse igual que una elegible normal;
- snapshots semanales ya publicados permanecen inmutables;
- no hacer una migración destructiva de datos históricos solo para “limpiar” el campo legacy.

Si alguna RPC pública existente recibe `ranking_opt_in`, preferir compatibilidad segura sobre ruptura de firma salvo que exista una razón concreta y testeada para cambiarla.

## 8. Riesgos a cubrir

### Estado Cero

1. 0 oficiales / 0 cargados;
2. 0 oficiales / 1 pendiente;
3. 1 oficial;
4. pendientes no alimentan stats;
5. pares de widgets nunca quedan huérfanos;
6. Mi Perfil 0 oficiales;
7. Perfil público 0 oficiales;
8. nombres largos no rompen identidad/Nivel;
9. Home con historial real no regresa.

### Ranking automático

10. faltan localidad + rama → gate;
11. falta solo localidad → gate correcto;
12. falta solo rama → gate correcto;
13. localidad+rama + CALIBRANDO → Ranking explorable sin posición;
14. elegible + legacy `ranking_opt_in=false` → participa;
15. elegible + legacy `ranking_opt_in=true` → mismo resultado;
16. no aparece ninguna UI de opt-in/opt-out;
17. snapshots publicados previos no se reescriben;
18. publicación/cálculo semanal conserva reglas de densidad, scopes, rama, inactividad e integridad.

No repetir suites equivalentes de Bloques 1–8.

## 9. Implementación y deploy

Trabajar primero localmente.

Antes de push:

- revisar diff completo;
- correr tests focalizados;
- correr smoke/regresión mínima directamente afectada;
- aplicar en Supabase Staging cualquier migración necesaria;
- verificar que Staging queda consistente.

Frontend:

- leer bundle vigente;
- hacer **un solo bump**;
- evitar micro-pushes.

Git:

- un commit lógico final de implementación;
- un push final a `origin/staging`;
- no hacer “push para ver”.

No tocar `main` ni Production.

## 10. Informe

Guardar:

`docs/BRAMUlab/Implementacion/Pre_Production/08_Resultado_P0_1_Ranking_Automatico_Claude.md`

El informe debe incluir:

- archivos modificados;
- migraciones aplicadas, si las hubo;
- qué se hizo con `ranking_opt_in`;
- tests ejecutados y resultados;
- bundle final;
- commit SHA;
- cualquier DECISIÓN ABIERTA real que no haya bloqueado el resto.

No pedirle a Sebastián que copie reportes técnicos.

## 11. Condición de finalización

No des por terminada la intervención hasta que:

- implementación esté completa;
- tests focalizados pasen;
- Staging esté consistente;
- commit final exista;
- informe esté escrito;
- todo esté pusheado a `origin/staging`.

Si aparece una decisión humana no documentada, marcar `DECISIÓN ABIERTA` y continuar todo lo que no dependa de ella.
