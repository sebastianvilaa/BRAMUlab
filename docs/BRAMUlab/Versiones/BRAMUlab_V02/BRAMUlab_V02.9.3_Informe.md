# BRAMUlab V02.9.3
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.9.2 (commit `3da5815`, tag `BRAMUlab_V02.9.2`).
**Origen de esta ronda:** Sebastián probó los valores en vivo con el inspector de Chrome sobre la app publicada y confirmó que se veían mejor — sin `Consolidado` propio, dos ajustes puntuales.
**Estado:** publicado en producción.

Dos correcciones puntuales: Historial cierra su jerarquía (resultado protagonista, jugadores neutros, sin ningún color de énfasis) y el encabezado de Último partido queda más compacto.

---

## 1. Qué se cambió

### Historial — jerarquía final (§1)

| Elemento | Antes (V02.9.1) | Ahora (V02.9.3) |
|---|---|---|
| `.history-item__score` | 20px / 800 / margin-bottom 8px | **30px / 800 / margin-bottom 3px** |
| `.history-item__teams` | 14px / 700 / `--paper-dim`, con color de equipo para "propia" | **13px / 500 / `--paper-dim`, SIN ningún color de énfasis** |

Se retira por completo el color de énfasis en los nombres — ni al equipo ganador (ya sin uso desde V02.9.1 en partidos propios) ni a la pareja propia (la variante que sí seguía activa desde V02.9.1). `VICTORIA`/`DERROTA` (o "GANÓ" en Observados, que sigue existiendo como texto) ya comunica el resultado; una segunda señal de color en los nombres quedaba redundante. Se retiran las clases `.history-item__winner--a/-b` y `.history-item__mine--a/-b` de `styles.css`, y el cálculo/aplicación de esas clases en `app.js:renderHistory` (ya no hace falta distinguir "propia" del rival para nada visual). El resultado, ahora a 30px, queda claramente como el dato más grande de la card.

### Último partido — encabezado más compacto (§2)

`.player-home-lastmatch__row1` (línea 1: título + fecha) baja su `margin-bottom` de 10px a 3px, acercándola a la línea 2 (forma + badge) — se leen como un solo encabezado. Nada más de la tarjeta se tocó.

---

## 2. Verificación

- **Computed style real**: `.history-item__score` confirmado en `30px/800/3px`; `.history-item__teams` en `13px/500/rgb(154,167,181)` (`--paper-dim`); `.player-home-lastmatch__row1` en `margin-bottom:3px`.
- **Visual real**, mobile (375px) y desktop (1024px real): 2 partidos cargados (uno ganado, uno perdido) contra los mismos rivales — en ambas cards "Seba / Fernan" y "Gusti / Esteban" se ven con el mismo tratamiento neutro, sin distinción de color entre sí ni según quién ganó; el resultado (30px) domina claramente la lectura de la card.
- **Regresión**: sin overflow horizontal nuevo (`document.body.scrollWidth === window.innerWidth`).
- **Tests:** 571/571 OK, sin cambios respecto de la base.

---

## 3. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.9.2"` → **`"BRAMUlab V02.9.3"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v02-9-2` → **`bramulab-v02-9-3`**.
- **Commit de implementación (código):** `9653c748f2ce2e789de1eda9079c63dd9f8f60c4`.
- **Push:** a `main` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 4. Hash exacto y tag

- Commit de implementación (código): `9653c748f2ce2e789de1eda9079c63dd9f8f60c4`.
- Commit de este informe: `044c64366614f1d013ecebdaf148846d6484d821`.
- Tag `BRAMUlab_V02.9.3` apuntará al commit inmediatamente posterior a este.

---

## 5. Qué no se tocó

Efectividad (3px/3.7px, sin cambios), CLÁSICO/PUNTO DE ORO, badges VICTORIA/DERROTA y "GANÓ", resto de la tarjeta de Último partido, Resumen, alta de jugador sin cuenta, Nivel BRAMU, Actividad, BRAMU Intelligence, Ranking, Perfil.
