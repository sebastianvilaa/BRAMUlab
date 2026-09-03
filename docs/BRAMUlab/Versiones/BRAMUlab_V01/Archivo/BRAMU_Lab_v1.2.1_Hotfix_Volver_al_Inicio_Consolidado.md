# BRAMU Lab — Hotfix v1.2.1 · Navegación «Volver al inicio»

**Estado:** AUTORIZADO PARA IMPLEMENTAR  
**Fecha:** 02 SEP 2026  
**Aplicación:** BRAMU Lab principal (`bramulab/`)  
**Versión de partida:** v1.2  
**Versión objetivo:** v1.2.1  
**Base verificada:** Fase 2 aprobada en prueba real de iPhone · commit `e59d363410d4103f8551053a24c29df56d202c46` · 382/382 tests OK  
**Fuera de alcance:** BRAMU Lab Partidos (`bramulab-partidos/`), rediseños y Fase 3.

---

## 1. Hallazgo de la prueba real

La actualización a v1.2, la entrada al Home, el registro del partido, la franja compacta, la hoja contextual y el resultado parcial de múltiples sets funcionaron correctamente en iPhone.

Quedó un único error residual:

- Al finalizar un partido y tocar «Volver al inicio», la aplicación abre la pantalla antigua de configuración del marcador en vez del Home del jugador con sus tarjetas.

Este hotfix corrige solamente esa navegación y normaliza la identificación de la versión.

---

## 2. Definición canónica de pantallas

A partir de este trabajo, estos conceptos no deben confundirse:

- **Inicio / Home / Mi pádel:** la pantalla principal del jugador con sus tarjetas, barra inferior, último partido, momento, métricas y demás módulos.
- **Configurar partido:** la pantalla de jugadores, formato y sistema de puntuación previa al marcador.
- **Marcador:** la pantalla de registro del partido en vivo.
- **Resultado/Análisis:** las pantallas posteriores al cierre del partido.

En la interfaz actual, la pestaña inferior puede seguir llamándose **Inicio**. Técnicamente, cualquier acción cuyo texto sea «Volver al inicio» debe abrir el Home del jugador, nunca «Configurar partido».

---

## 3. Corrección autorizada

### 3.1 Destino de «Volver al inicio»

Revisar todas las acciones visibles llamadas «Volver al inicio» o equivalentes dentro de:

- resultado final;
- BRAMU Intelligence/análisis;
- resumen;
- cierre natural del partido;
- finalización manual;
- cualquier otro flujo posterior a un partido terminado.

Todas deben usar la misma función canónica existente para abrir el Home del jugador —preferentemente `openPlayerHome()` o la abstracción central equivalente— y no una función antigua que reinicie o muestre `view-setup`.

No duplicar lógica de navegación.

### 3.2 Estado después de finalizar

Al volver al Home después de terminar un partido:

- el partido debe estar guardado una sola vez en el historial;
- el estado de partido activo debe estar correctamente cerrado/limpio;
- no debe reaparecer la franja «Partido en curso»;
- la tarjeta «Último partido» debe reflejar el partido recién terminado;
- el nombre/identidad local del jugador debe conservarse;
- no debe aparecer «¿Quién sos?» si la identidad ya existía;
- no debe abrirse «Configurar partido».

### 3.3 Acceso a Configurar partido

La corrección no debe eliminar ni romper la pantalla de configuración.

«Configurar partido» debe seguir accesible únicamente mediante accesos explícitos, principalmente:

- `+` → «Registrar partido en vivo» → «Game por game»;
- `+` → «Registrar partido en vivo» → «Punto por punto»;
- el enlace explícito «Configurar partido» si corresponde mantenerlo.

---

## 4. Versión y nomenclatura

Publicar esta corrección como **BRAMU Lab v1.2.1**.

Actualizar de forma consistente únicamente en `bramulab/`:

- versión visible;
- `version.json`;
- versión central del store;
- nombre de caché del service worker;
- mecanismo de aviso de actualización, sin cambiar su funcionamiento.

### Regla de nomenclatura desde este commit

No volver a usar nombres paralelos como «V16», «V17» o similares para identificar releases de BRAMU Lab.

El mensaje del commit debe seguir la versión real de la aplicación. Formato recomendado:

`BRAMU Lab v1.2.1 · hotfix navegación Volver al inicio`

El commit anterior con «V16» no debe reescribirse ni modificarse; queda como antecedente histórico. Esta regla se aplica de ahora en adelante.

BRAMU Lab Partidos debe permanecer congelada en v14 y sin cambios.

---

## 5. Pruebas mínimas obligatorias

Mantener en verde los 382 tests existentes y agregar cobertura para:

1. Finalizar un partido Game por game y tocar «Volver al inicio» → abre Home.
2. Finalizar un partido Punto por punto y tocar «Volver al inicio» → abre Home.
3. Finalización natural → Home.
4. Finalización manual → Home.
5. Acceso desde Resultado/Resumen → Home.
6. Acceso desde BRAMU Intelligence/Análisis → Home.
7. El Home muestra el partido finalizado en «Último partido».
8. No queda partido activo ni franja «Partido en curso».
9. No se duplica el partido en Historial.
10. «Configurar partido» sigue abriendo correctamente desde el flujo explícito del botón `+`.
11. Recarga posterior → vuelve al Home y conserva identidad e historial.
12. BRAMU Lab Partidos continúa intacta en v14.

Si varias acciones comparten el mismo handler central, probar la función común y al menos los puntos de entrada relevantes sin crear tests redundantes artificiales.

---

## 6. Despliegue e informe

Si toda la suite queda verde:

1. Actualizar a v1.2.1.
2. Hacer commit con la nomenclatura nueva.
3. Hacer push.
4. Confirmar el build de GitHub Pages.
5. Verificar la versión publicada y el destino real de «Volver al inicio».

Crear el informe autocontenido en:

`docs/bramulab/informes/BRAMU_Lab_v1.2.1_Hotfix_Volver_al_Inicio_Informe.md`

Debe incluir:

- causa encontrada;
- acciones/handlers corregidos;
- archivos modificados;
- tests agregados y resultado total;
- confirmación del estado del historial y partido activo;
- versión y caché;
- commit, push y despliegue;
- confirmación expresa de que BRAMU Lab Partidos no cambió;
- cualquier validación táctil pendiente en iPhone.

No avanzar a la Fase 3 dentro de este trabajo.

---

## 7. Criterio de cierre

El hotfix queda aprobado cuando, después de finalizar un partido por cualquiera de los modos relevantes, «Volver al inicio» abre el Home con tarjetas, muestra correctamente el último partido y no deja rastros de un partido activo.

Después de la prueba breve en iPhone:

- se cierra definitivamente la Fase 2;
- el próximo desarrollo funcional comienza en un chat nuevo con Claude;
- la próxima versión funcional prevista será v1.3.
